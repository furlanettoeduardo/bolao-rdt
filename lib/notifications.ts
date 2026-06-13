// ─────────────────────────────────────────────────────────────────────────────
// Geração de notificações (sino do header). Chamada pelo runSync após gravar os
// jogos/pontos. É IDEMPOTENTE: cada notificação tem uma `key` única por usuário
// e usamos createMany({ skipDuplicates }) — então rodar o sync a cada minuto não
// duplica nada.
//
// Tipos: match_soon | match_finished | prediction_result | goal | ranking | champion
// Escopo de gols/encerramento: jogos que o usuário palpitou + jogos do Brasil.
// "Jogo começando" (match_soon, ~1h antes) vale para qualquer jogo e para TODOS:
// quem palpitou recebe um aviso de que vai começar; quem não palpitou, um
// lembrete de última chance (mesma notificação, texto diferente).
// ─────────────────────────────────────────────────────────────────────────────

import { SCORING } from "./config";
import { prisma } from "./db";
import { computeRanking } from "./ranking";
import { teamNamePt } from "./team-names";

export interface SyncEvents {
  /** Jogos que transitaram para encerrado neste sync */
  justFinishedMatchIds: string[];
  /** Jogos cujo placar (gols) aumentou neste sync */
  goalMatchIds: string[];
}

interface NotifInput {
  userId: string;
  key: string;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
}

async function insert(items: NotifInput[]): Promise<void> {
  if (items.length === 0) return;
  await prisma.notification.createMany({
    data: items.map((n) => ({
      userId: n.userId,
      key: n.key,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      href: n.href ?? null,
    })),
    skipDuplicates: true,
  });
}

function label(
  team: { code: string; name: string } | null,
  placeholder: string | null
): string {
  return team ? teamNamePt(team.code, team.name) : (placeholder ?? "A definir");
}

/** Ponto de entrada — chamado pelo runSync. Cada bloco é isolado por try/catch. */
export async function generateNotifications(events: SyncEvents): Promise<void> {
  await safe(notifyUpcomingMatches());
  await safe(notifyFinished(events.justFinishedMatchIds));
  await safe(notifyGoals(events.goalMatchIds));
  if (events.justFinishedMatchIds.length > 0) {
    await safe(notifyRankingChanges(events.justFinishedMatchIds[0]!));
    await safe(notifyChampionIfFinal(events.justFinishedMatchIds));
  }
}

async function safe(p: Promise<void>): Promise<void> {
  try {
    await p;
  } catch (err) {
    console.error("[notifications] falha ao gerar:", err);
  }
}

// ── Jogo começando (~1h antes do kickoff) ────────────────────────────────────
// Notifica todos: aviso para quem palpitou; lembrete para quem não palpitou.

async function notifyUpcomingMatches(): Promise<void> {
  const now = Date.now();
  const upcoming = await prisma.match.findMany({
    where: {
      status: "SCHEDULED",
      kickoff: { gt: new Date(now), lte: new Date(now + 60 * 60 * 1000) },
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      predictions: { select: { userId: true } },
    },
    orderBy: { kickoff: "asc" },
  });
  if (upcoming.length === 0) return;

  const [brazil, users] = await Promise.all([
    prisma.team.findFirst({ where: { code: "BRA" }, select: { id: true } }),
    prisma.user.findMany({ select: { id: true } }),
  ]);

  const notifs: NotifInput[] = [];
  for (const m of upcoming) {
    const predicted = new Set(m.predictions.map((p) => p.userId));
    const home = label(m.homeTeam, m.homePlaceholder);
    const away = label(m.awayTeam, m.awayPlaceholder);
    const isBrazil =
      brazil != null &&
      (m.homeTeamId === brazil.id || m.awayTeamId === brazil.id);

    for (const u of users) {
      const hasPredicted = predicted.has(u.id);
      // Quem palpitou: aviso de que o jogo vai começar.
      // Quem não palpitou: lembrete de última chance.
      const title = isBrazil
        ? hasPredicted
          ? "⏰ Falta 1h para o Brasil!"
          : "⏰ Falta 1h para o Brasil — palpite!"
        : hasPredicted
          ? "⏰ Seu jogo vai começar!"
          : "⏰ Última chance de palpitar";
      const body = hasPredicted
        ? `${home} x ${away} começa em ~1h. Seu palpite está valendo — bora torcer!`
        : `${home} x ${away} começa em ~1h e você ainda não palpitou. Garanta seu palpite!`;

      notifs.push({
        userId: u.id,
        key: `upcoming:${m.id}`,
        type: "match_soon",
        title,
        body,
        href: `/jogos/${m.id}`,
      });
    }
  }
  await insert(notifs);
}

// ── Jogo encerrou + resultado do palpite / pontos ────────────────────────────

async function notifyFinished(matchIds: string[]): Promise<void> {
  if (matchIds.length === 0) return;

  const [matches, brazil, users] = await Promise.all([
    prisma.match.findMany({
      where: { id: { in: matchIds } },
      include: {
        homeTeam: true,
        awayTeam: true,
        predictions: {
          select: {
            userId: true,
            homeScore: true,
            awayScore: true,
            points: true,
            pointsOverride: true,
          },
        },
      },
    }),
    prisma.team.findFirst({ where: { code: "BRA" }, select: { id: true } }),
    prisma.user.findMany({ select: { id: true } }),
  ]);

  const notifs: NotifInput[] = [];
  for (const m of matches) {
    const home = label(m.homeTeam, m.homePlaceholder);
    const away = label(m.awayTeam, m.awayPlaceholder);
    const scoreLine = `${home} ${m.homeScore ?? "-"}x${m.awayScore ?? "-"} ${away}`;
    const predictorIds = new Set<string>();

    for (const p of m.predictions) {
      predictorIds.add(p.userId);
      const pts = p.pointsOverride ?? p.points;
      notifs.push({
        userId: p.userId,
        key: `result:${m.id}`,
        type: "prediction_result",
        title: `🏁 ${scoreLine}`,
        body:
          `Seu palpite: ${p.homeScore}x${p.awayScore} — ` +
          (pts != null ? `você fez +${pts} pts.` : "aguardando pontuação."),
        href: `/jogos/${m.id}`,
      });
    }

    // Jogo do Brasil: avisa todo mundo que terminou (quem não palpitou também).
    const isBrazil =
      brazil != null &&
      (m.homeTeamId === brazil.id || m.awayTeamId === brazil.id);
    if (isBrazil) {
      for (const u of users) {
        if (predictorIds.has(u.id)) continue;
        notifs.push({
          userId: u.id,
          key: `finished:${m.id}`,
          type: "match_finished",
          title: `🏁 ${scoreLine}`,
          body: "O jogo do Brasil terminou.",
          href: `/jogos/${m.id}`,
        });
      }
    }
  }
  await insert(notifs);
}

// ── Gols (jogos palpitados + Brasil) ─────────────────────────────────────────

async function notifyGoals(matchIds: string[]): Promise<void> {
  if (matchIds.length === 0) return;

  const [matches, brazil] = await Promise.all([
    prisma.match.findMany({
      where: { id: { in: matchIds } },
      include: {
        homeTeam: true,
        awayTeam: true,
        predictions: { select: { userId: true } },
      },
    }),
    prisma.team.findFirst({ where: { code: "BRA" }, select: { id: true } }),
  ]);

  let allUserIds: string[] | null = null;
  const notifs: NotifInput[] = [];

  for (const m of matches) {
    const home = label(m.homeTeam, m.homePlaceholder);
    const away = label(m.awayTeam, m.awayPlaceholder);
    const total = (m.homeScore ?? 0) + (m.awayScore ?? 0);
    const scoreLine = `${home} ${m.homeScore ?? 0}x${m.awayScore ?? 0} ${away}`;

    const recipients = new Set<string>(m.predictions.map((p) => p.userId));
    const isBrazil =
      brazil != null &&
      (m.homeTeamId === brazil.id || m.awayTeamId === brazil.id);
    if (isBrazil) {
      if (!allUserIds) {
        allUserIds = (await prisma.user.findMany({ select: { id: true } })).map(
          (u) => u.id
        );
      }
      for (const id of allUserIds) recipients.add(id);
    }

    for (const userId of recipients) {
      notifs.push({
        userId,
        // total no key → cada novo gol gera uma notificação distinta
        key: `goal:${m.id}:${total}`,
        type: "goal",
        title: `⚽ Gol! ${scoreLine}`,
        body: null,
        href: `/jogos/${m.id}`,
      });
    }
  }
  await insert(notifs);
}

// ── Mudança de posição no ranking ────────────────────────────────────────────

async function notifyRankingChanges(triggerMatchId: string): Promise<void> {
  const ranking = await computeRanking();
  const users = await prisma.user.findMany({
    select: { id: true, lastRankingPosition: true },
  });
  const prevById = new Map(users.map((u) => [u.id, u.lastRankingPosition]));

  const notifs: NotifInput[] = [];
  for (const row of ranking) {
    const prev = prevById.get(row.userId) ?? null;
    if (prev === row.position) continue;

    await prisma.user.update({
      where: { id: row.userId },
      data: { lastRankingPosition: row.position },
    });

    // Só notifica quando já havia uma posição anterior conhecida (não no 1º cálculo).
    if (prev == null) continue;
    const movedUp = row.position < prev;
    notifs.push({
      userId: row.userId,
      key: `rank:${triggerMatchId}:${row.position}`,
      type: "ranking",
      title: movedUp
        ? `📈 Você subiu para ${row.position}º no ranking`
        : `📉 Você caiu para ${row.position}º no ranking`,
      body: `Sua posição mudou de ${prev}º para ${row.position}º.`,
      href: "/ranking",
    });
  }
  await insert(notifs);
}

// ── Bônus de campeão (quando a final encerra) ────────────────────────────────

async function notifyChampionIfFinal(matchIds: string[]): Promise<void> {
  const final = await prisma.match.findFirst({
    where: { stage: "FINAL", id: { in: matchIds } },
    include: { advancingTeam: true },
  });
  if (!final || !final.advancingTeamId) return;

  const champ = final.advancingTeam
    ? teamNamePt(final.advancingTeam.code, final.advancingTeam.name)
    : "o campeão";

  const picks = await prisma.championPick.findMany({
    select: { userId: true, teamId: true, points: true },
  });
  await insert(
    picks.map((pick) => {
      const won = pick.teamId === final.advancingTeamId;
      return {
        userId: pick.userId,
        key: `champion:${final.id}`,
        type: "champion",
        title: won ? "🏆 Você acertou o campeão!" : "🏁 Fim da Copa!",
        body: won
          ? `${champ} é o campeão — você ganhou +${pick.points ?? SCORING.CHAMPION_BONUS} pts de bônus!`
          : `${champ} levantou a taça. Seu palpite de campeão não saiu desta vez.`,
        href: "/chaveamento",
      };
    })
  );
}
