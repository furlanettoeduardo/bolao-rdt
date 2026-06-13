// ─────────────────────────────────────────────────────────────────────────────
// Sincronização com o provedor de dados:
//   1. Atualiza jogos (status, placares, horários, times definidos no mata-mata)
//   2. Pontua os palpites de jogos que finalizaram
//   3. Atualiza a classificação dos grupos
//   4. Credita o bônus de campeão quando a final termina
//   5. Registra a execução em SyncLog
// Chamada por POST/GET /api/cron/sync e pelo painel admin.
// ─────────────────────────────────────────────────────────────────────────────

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { MAX_GOALS, SCORING } from "./config";
import { getProvider, type ProviderMatch } from "./football/provider";
import { isFinishedStatus, isKnockoutStage, syncWindow } from "./match-rules";
import { generateNotifications } from "./notifications";
import { scorePrediction } from "./scoring";

export type SyncScope = "window" | "full" | "manual";

export interface SyncResult {
  ok: boolean;
  message: string;
  matchesUpdated: number;
  matchesScored: number;
  standingsUpdated: number;
  durationMs: number;
}

export async function runSync(scope: SyncScope): Promise<SyncResult> {
  const startedAt = Date.now();
  let matchesUpdated = 0;
  let matchesScored = 0;
  let standingsUpdated = 0;

  try {
    const provider = getProvider();
    const query = scope === "window" ? syncWindow() : undefined;
    const providerMatches = await provider.getMatches(query);

    const teams = await prisma.team.findMany({
      select: { id: true, externalId: true, group: true },
    });
    const teamByExternalId = new Map(teams.map((t) => [t.externalId, t]));

    const toRescore: string[] = [];
    const justFinishedMatchIds: string[] = [];
    const goalMatchIds: string[] = [];

    for (const pm of providerMatches) {
      const result = await upsertMatch(pm, teamByExternalId);
      if (result.changed) matchesUpdated++;
      if (result.needsScoring) toRescore.push(result.matchId);
      if (result.justFinished) justFinishedMatchIds.push(result.matchId);
      if (result.goalsAdded) goalMatchIds.push(result.matchId);
    }

    for (const matchId of toRescore) {
      await rescoreMatch(matchId);
      matchesScored++;
    }

    // Classificação dos grupos — o endpoint de standings já aplica os
    // critérios oficiais de desempate da FIFA.
    try {
      const rows = await provider.getStandings();
      for (const row of rows) {
        const team = teamByExternalId.get(row.teamExternalId);
        if (!team) continue;
        await prisma.groupStanding.upsert({
          where: { group_teamId: { group: row.group, teamId: team.id } },
          create: {
            group: row.group,
            teamId: team.id,
            position: row.position,
            played: row.played,
            won: row.won,
            drawn: row.drawn,
            lost: row.lost,
            goalsFor: row.goalsFor,
            goalsAgainst: row.goalsAgainst,
            goalDifference: row.goalDifference,
            points: row.points,
          },
          update: {
            position: row.position,
            played: row.played,
            won: row.won,
            drawn: row.drawn,
            lost: row.lost,
            goalsFor: row.goalsFor,
            goalsAgainst: row.goalsAgainst,
            goalDifference: row.goalDifference,
            points: row.points,
          },
        });
        if (team.group !== row.group) {
          await prisma.team.update({
            where: { id: team.id },
            data: { group: row.group },
          });
          team.group = row.group;
        }
        standingsUpdated++;
      }
    } catch (err) {
      // Standings podem falhar de forma independente (ex.: rate limit após
      // a chamada de matches) — não derruba o sync de placares.
      console.error("Falha ao atualizar standings:", err);
    }

    await creditChampionIfFinalFinished();

    // Notificações (sino) — idempotente; roda após rescore/crédito de campeão
    // para refletir pontos e ranking corretos. Não derruba o sync se falhar.
    try {
      await generateNotifications({ justFinishedMatchIds, goalMatchIds });
    } catch (err) {
      console.error("Falha ao gerar notificações:", err);
    }

    // Diagnóstico de latência: o que a API retornou para os jogos ao vivo, e se
    // algum jogo já passou do horário mas a API ainda o reporta como agendado
    // (sinal de que o atraso está no provedor, não no nosso pipeline/cron).
    const nowMs = Date.now();
    const liveProvider = providerMatches.filter(
      (m) => m.status === "IN_PLAY" || m.status === "PAUSED"
    );
    const startedButScheduled = providerMatches.filter(
      (m) =>
        m.status === "SCHEDULED" &&
        new Date(m.kickoffUtc).getTime() <= nowMs &&
        // janela de 4h para ignorar jogos antigos sem placar
        new Date(m.kickoffUtc).getTime() >= nowMs - 4 * 60 * 60 * 1000
    );
    const liveInfo = liveProvider
      .map(
        (m) =>
          `#${m.externalId} ${m.regulation?.home ?? "-"}x${m.regulation?.away ?? "-"} ${m.status}`
      )
      .join(", ");
    console.log(
      `[sync] provider: ${providerMatches.length} jogos; ao vivo: ${liveProvider.length}` +
        (liveInfo ? ` (${liveInfo})` : "") +
        `; passaram do horário mas "agendado" p/ API: ${startedButScheduled.length}` +
        (startedButScheduled.length
          ? ` (${startedButScheduled.map((m) => `#${m.externalId}`).join(", ")})`
          : "")
    );

    const durationMs = Date.now() - startedAt;
    const message =
      `${matchesUpdated} jogo(s) atualizado(s), ${matchesScored} pontuado(s), ${standingsUpdated} linha(s) de classificação. ` +
      `Ao vivo p/ API: ${liveProvider.length}${liveInfo ? ` (${liveInfo})` : ""}.` +
      (startedButScheduled.length > 0
        ? ` ⚠ ${startedButScheduled.length} jogo(s) já no horário mas a API ainda diz "agendado" — atraso do provedor.`
        : "");
    await prisma.syncLog.create({
      data: { ok: true, scope, message, durationMs },
    });
    return { ok: true, message, matchesUpdated, matchesScored, standingsUpdated, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    await prisma.syncLog
      .create({ data: { ok: false, scope, message, durationMs } })
      .catch(() => {
        // Banco indisponível — nada mais a fazer além de propagar o erro.
      });
    return { ok: false, message, matchesUpdated, matchesScored, standingsUpdated, durationMs };
  }
}

interface UpsertOutcome {
  matchId: string;
  changed: boolean;
  needsScoring: boolean;
  /** Transitou para encerrado neste sync */
  justFinished: boolean;
  /** O placar (gols) aumentou neste sync */
  goalsAdded: boolean;
}

/**
 * Cronômetro interno do jogo (a API grátis não fornece o minuto). Mantém o
 * início do segmento em andamento e os minutos já acumulados; congela no
 * intervalo e recomeça quando o jogo volta a ficar ao vivo.
 */
function nextClock(
  prevStatus: string | null,
  prevSegStart: Date | null,
  prevBase: number | null,
  newStatus: string,
  kickoff: Date,
  now: Date
): { liveSegmentStart: Date | null; clockBaseMinutes: number } {
  const base = prevBase ?? 0;
  if (newStatus === "IN_PLAY") {
    if (prevStatus === "IN_PLAY" && prevSegStart) {
      return { liveSegmentStart: prevSegStart, clockBaseMinutes: base };
    }
    if (base > 0) {
      // retomada (ex.: 2º tempo) — cronometra a partir de agora
      return { liveSegmentStart: now, clockBaseMinutes: base };
    }
    // 1º tempo — cronometra desde o kickoff (mais preciso que "agora")
    const start = kickoff.getTime() <= now.getTime() ? kickoff : now;
    return { liveSegmentStart: start, clockBaseMinutes: 0 };
  }
  if (
    newStatus === "PAUSED" ||
    newStatus === "FINISHED" ||
    newStatus === "AWARDED"
  ) {
    if (prevStatus === "IN_PLAY" && prevSegStart) {
      const mins = Math.max(
        0,
        Math.round((now.getTime() - prevSegStart.getTime()) / 60000)
      );
      return { liveSegmentStart: null, clockBaseMinutes: base + mins };
    }
    return { liveSegmentStart: null, clockBaseMinutes: base };
  }
  // SCHEDULED / SUSPENDED / CANCELLED / POSTPONED → zera o cronômetro
  return { liveSegmentStart: null, clockBaseMinutes: 0 };
}

/** Minuto estimado "agora" a partir do cronômetro (null se não dá para estimar). */
function currentMinuteOf(
  clock: { liveSegmentStart: Date | null; clockBaseMinutes: number },
  now: Date
): number | null {
  if (!clock.liveSegmentStart) {
    return clock.clockBaseMinutes > 0 ? clock.clockBaseMinutes : null;
  }
  const mins = Math.max(
    0,
    Math.round((now.getTime() - clock.liveSegmentStart.getTime()) / 60000)
  );
  return clock.clockBaseMinutes + mins;
}

/**
 * Acerta os gols gravados para bater com o placar do tempo regulamentar.
 * Os gols são detectados pela mudança de placar; o autor não é gravado (a API
 * grátis não fornece) e o minuto é estimado pelo cronômetro interno.
 */
async function reconcileGoals(
  matchId: string,
  homeScore: number | null,
  awayScore: number | null,
  minute: number | null
): Promise<void> {
  for (const side of ["HOME", "AWAY"] as const) {
    // Teto defensivo: o provider já é validado em pair(), mas limitar aqui
    // evita qualquer criação em massa de linhas em MatchGoal por dado anômalo.
    const target = Math.min((side === "HOME" ? homeScore : awayScore) ?? 0, MAX_GOALS);
    const goals = await prisma.matchGoal.findMany({
      where: { matchId, side },
      orderBy: { createdAt: "asc" },
    });
    if (target > goals.length) {
      await prisma.matchGoal.createMany({
        data: Array.from({ length: target - goals.length }, () => ({
          matchId,
          side,
          minute,
        })),
      });
    } else if (target < goals.length) {
      const remove = goals.slice(target).map((g) => g.id);
      await prisma.matchGoal.deleteMany({ where: { id: { in: remove } } });
    }
  }
}

async function upsertMatch(
  pm: ProviderMatch,
  teamByExternalId: Map<number, { id: string; externalId: number; group: string | null }>
): Promise<UpsertOutcome> {
  const homeTeamId =
    pm.homeTeamExternalId != null
      ? (teamByExternalId.get(pm.homeTeamExternalId)?.id ?? null)
      : null;
  const awayTeamId =
    pm.awayTeamExternalId != null
      ? (teamByExternalId.get(pm.awayTeamExternalId)?.id ?? null)
      : null;
  const winnerTeamId =
    pm.winnerExternalId != null
      ? (teamByExternalId.get(pm.winnerExternalId)?.id ?? null)
      : null;

  const finished = isFinishedStatus(pm.status);
  const knockout = isKnockoutStage(pm.stage);

  // Quem avançou: só faz sentido no mata-mata e com o jogo decidido.
  const advancingTeamId = knockout && finished ? winnerTeamId : null;
  const penaltyWinnerTeamId = pm.penalties ? winnerTeamId : null;

  const now = new Date();
  const kickoffDate = new Date(pm.kickoffUtc);
  const newHome = pm.regulation?.home ?? null;
  const newAway = pm.regulation?.away ?? null;

  const existing = await prisma.match.findUnique({
    where: { externalId: pm.externalId },
  });

  // Cronômetro interno (minuto de jogo) — depende do estado anterior.
  const clock = nextClock(
    existing?.status ?? null,
    existing?.liveSegmentStart ?? null,
    existing?.clockBaseMinutes ?? null,
    pm.status,
    kickoffDate,
    now
  );

  const data: Prisma.MatchUncheckedUpdateInput = {
    stage: pm.stage,
    group: pm.group,
    matchday: pm.matchday,
    kickoff: kickoffDate,
    status: pm.status,
    homeTeamId,
    awayTeamId,
    homePlaceholder: pm.homePlaceholder,
    awayPlaceholder: pm.awayPlaceholder,
    homeScore: newHome,
    awayScore: newAway,
    homeScoreET: pm.afterExtraTime?.home ?? null,
    awayScoreET: pm.afterExtraTime?.away ?? null,
    homePenalties: pm.penalties?.home ?? null,
    awayPenalties: pm.penalties?.away ?? null,
    penaltyWinnerTeamId,
    advancingTeamId,
    venue: pm.venue,
    referee: pm.referee,
    liveSegmentStart: clock.liveSegmentStart,
    clockBaseMinutes: clock.clockBaseMinutes,
  };

  if (!existing) {
    // Resiliência: jogo que não veio no seed (não deve acontecer em condições
    // normais, já que o calendário está completo).
    const created = await prisma.match.create({
      data: {
        ...(data as Prisma.MatchUncheckedCreateInput),
        externalId: pm.externalId,
        kickoff: kickoffDate,
        stage: pm.stage,
        status: pm.status,
      },
    });
    if (newHome != null || newAway != null) {
      await reconcileGoals(created.id, newHome, newAway, currentMinuteOf(clock, now));
    }
    return {
      matchId: created.id,
      changed: true,
      needsScoring: finished,
      justFinished: finished,
      goalsAdded: (newHome ?? 0) + (newAway ?? 0) > 0,
    };
  }

  const changed =
    existing.status !== pm.status ||
    existing.kickoff.getTime() !== new Date(pm.kickoffUtc).getTime() ||
    existing.stage !== pm.stage ||
    existing.group !== pm.group ||
    existing.matchday !== pm.matchday ||
    existing.homeScore !== (pm.regulation?.home ?? null) ||
    existing.awayScore !== (pm.regulation?.away ?? null) ||
    existing.homeScoreET !== (pm.afterExtraTime?.home ?? null) ||
    existing.awayScoreET !== (pm.afterExtraTime?.away ?? null) ||
    existing.homePenalties !== (pm.penalties?.home ?? null) ||
    existing.awayPenalties !== (pm.penalties?.away ?? null) ||
    existing.homeTeamId !== homeTeamId ||
    existing.awayTeamId !== awayTeamId ||
    existing.homePlaceholder !== pm.homePlaceholder ||
    existing.awayPlaceholder !== pm.awayPlaceholder ||
    existing.venue !== pm.venue ||
    existing.referee !== pm.referee ||
    existing.penaltyWinnerTeamId !== penaltyWinnerTeamId ||
    existing.advancingTeamId !== advancingTeamId;

  if (changed) {
    await prisma.match.update({ where: { id: existing.id }, data });
  }

  // Detecção de gols pela mudança de placar (regulamentar): grava o time e o
  // minuto estimado pelo cronômetro (sem o autor — indisponível no plano grátis).
  if (existing.homeScore !== newHome || existing.awayScore !== newAway) {
    await reconcileGoals(existing.id, newHome, newAway, currentMinuteOf(clock, now));
  }

  // Pontua sempre que o jogo está finalizado e algo mudou, ou se há palpites
  // ainda sem pontos (idempotente — recomputar dá o mesmo resultado).
  // Também repontua quando o jogo DEIXA de estar finalizado (provedor reverteu
  // FINISHED → IN_PLAY etc.): rescoreMatch zera os pontos nesse caso.
  let needsScoring = false;
  if (finished) {
    if (changed || !isFinishedStatus(existing.status)) {
      needsScoring = true;
    } else {
      const unscored = await prisma.prediction.count({
        where: { matchId: existing.id, points: null },
      });
      needsScoring = unscored > 0;
    }
  } else if (changed && isFinishedStatus(existing.status)) {
    needsScoring = true;
  }

  const justFinished = finished && !isFinishedStatus(existing.status);
  const oldTotal = (existing.homeScore ?? 0) + (existing.awayScore ?? 0);
  const newTotal = (newHome ?? 0) + (newAway ?? 0);
  const goalsAdded = newTotal > oldTotal;

  return { matchId: existing.id, changed, needsScoring, justFinished, goalsAdded };
}

/**
 * Recalcula os pontos de todos os palpites de um jogo finalizado.
 * Idempotente — pode ser chamada quantas vezes for preciso (ex.: correção
 * manual de resultado no painel admin).
 */
export async function rescoreMatch(matchId: string): Promise<number> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { predictions: true },
  });
  if (!match) return 0;

  // Jogo não está mais finalizado (ou sem placar): zera os pontos de volta para
  // null, para não deixar pontuação fantasma contando no ranking. Idempotente.
  if (
    !isFinishedStatus(match.status) ||
    match.homeScore == null ||
    match.awayScore == null
  ) {
    const { count } = await prisma.prediction.updateMany({
      where: { matchId, points: { not: null } },
      data: { points: null },
    });
    return count;
  }

  const result = { homeScore: match.homeScore, awayScore: match.awayScore };
  const knockout = isKnockoutStage(match.stage)
    ? {
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        advancingTeamId: match.advancingTeamId,
      }
    : null;

  let updated = 0;
  for (const prediction of match.predictions) {
    const { total } = scorePrediction(prediction, result, knockout);
    if (prediction.points !== total) {
      await prisma.prediction.update({
        where: { id: prediction.id },
        data: { points: total },
      });
      updated++;
    }
  }
  return updated;
}

/**
 * Quando a final termina, credita o bônus de campeão a quem acertou
 * (e zera o campo para quem errou). Idempotente.
 */
export async function creditChampionIfFinalFinished(): Promise<void> {
  const final = await prisma.match.findFirst({
    where: { stage: "FINAL" },
    orderBy: { kickoff: "desc" },
  });
  if (!final || !isFinishedStatus(final.status) || !final.advancingTeamId) {
    // Final ainda não decidida (ou des-finalizada): garante que nenhum bônus
    // de campeão fique pendurado. Idempotente.
    await prisma.championPick.updateMany({
      where: { points: { not: null } },
      data: { points: null },
    });
    return;
  }
  await prisma.championPick.updateMany({
    where: { teamId: final.advancingTeamId },
    data: { points: SCORING.CHAMPION_BONUS },
  });
  await prisma.championPick.updateMany({
    where: { teamId: { not: final.advancingTeamId } },
    data: { points: 0 },
  });
}
