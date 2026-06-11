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
import { SCORING } from "./config";
import { getProvider, type ProviderMatch } from "./football/provider";
import { isFinishedStatus, isKnockoutStage, syncWindow } from "./match-rules";
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

    for (const pm of providerMatches) {
      const result = await upsertMatch(pm, teamByExternalId);
      if (result.changed) matchesUpdated++;
      if (result.needsScoring) toRescore.push(result.matchId);
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

    const durationMs = Date.now() - startedAt;
    const message = `${matchesUpdated} jogo(s) atualizado(s), ${matchesScored} pontuado(s), ${standingsUpdated} linha(s) de classificação.`;
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

  const data: Prisma.MatchUncheckedUpdateInput = {
    stage: pm.stage,
    group: pm.group,
    matchday: pm.matchday,
    kickoff: new Date(pm.kickoffUtc),
    status: pm.status,
    homeTeamId,
    awayTeamId,
    homePlaceholder: pm.homePlaceholder,
    awayPlaceholder: pm.awayPlaceholder,
    homeScore: pm.regulation?.home ?? null,
    awayScore: pm.regulation?.away ?? null,
    homeScoreET: pm.afterExtraTime?.home ?? null,
    awayScoreET: pm.afterExtraTime?.away ?? null,
    homePenalties: pm.penalties?.home ?? null,
    awayPenalties: pm.penalties?.away ?? null,
    penaltyWinnerTeamId,
    advancingTeamId,
    venue: pm.venue,
  };

  const existing = await prisma.match.findUnique({
    where: { externalId: pm.externalId },
  });

  if (!existing) {
    // Resiliência: jogo que não veio no seed (não deve acontecer em condições
    // normais, já que o calendário está completo).
    const created = await prisma.match.create({
      data: {
        ...(data as Prisma.MatchUncheckedCreateInput),
        externalId: pm.externalId,
        kickoff: new Date(pm.kickoffUtc),
        stage: pm.stage,
        status: pm.status,
      },
    });
    return { matchId: created.id, changed: true, needsScoring: finished };
  }

  const changed =
    existing.status !== pm.status ||
    existing.kickoff.getTime() !== new Date(pm.kickoffUtc).getTime() ||
    existing.homeScore !== (pm.regulation?.home ?? null) ||
    existing.awayScore !== (pm.regulation?.away ?? null) ||
    existing.homeScoreET !== (pm.afterExtraTime?.home ?? null) ||
    existing.awayScoreET !== (pm.afterExtraTime?.away ?? null) ||
    existing.homePenalties !== (pm.penalties?.home ?? null) ||
    existing.awayPenalties !== (pm.penalties?.away ?? null) ||
    existing.homeTeamId !== homeTeamId ||
    existing.awayTeamId !== awayTeamId ||
    existing.advancingTeamId !== advancingTeamId;

  if (changed) {
    await prisma.match.update({ where: { id: existing.id }, data });
  }

  // Pontua sempre que o jogo está finalizado e algo mudou, ou se há palpites
  // ainda sem pontos (idempotente — recomputar dá o mesmo resultado).
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
  }

  return { matchId: existing.id, changed, needsScoring };
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
  if (!isFinishedStatus(match.status)) return 0;
  if (match.homeScore == null || match.awayScore == null) return 0;

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
