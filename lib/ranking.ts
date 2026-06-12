// Ranking do bolão com critérios de desempate, nesta ordem:
//   1. Mais pontos
//   2. Mais placares exatos
//   3. Mais resultados certos
//   4. Data de cadastro mais antiga

import { prisma } from "./db";
import { outcomeOf } from "./scoring";
import type { Stage } from "./types";

export interface RankingRow {
  position: number;
  userId: string;
  name: string;
  totalPoints: number;
  exactCount: number;
  resultCount: number;
  scoredPredictions: number;
  championPoints: number;
  /** Soma dos ajustes manuais do admin (bônus/penalidade); 0 no ranking por fase */
  adjustmentPoints: number;
  createdAt: Date;
}

/**
 * Calcula o ranking completo. Com `stage`, considera apenas os jogos daquela
 * fase (o bônus de campeão entra somente no ranking geral).
 */
export async function computeRanking(stage?: Stage): Promise<RankingRow[]> {
  const [users, predictions, adjustments] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        championPick: { select: { points: true } },
      },
    }),
    prisma.prediction.findMany({
      where: {
        OR: [{ points: { not: null } }, { pointsOverride: { not: null } }],
        ...(stage ? { match: { stage } } : {}),
      },
      select: {
        userId: true,
        homeScore: true,
        awayScore: true,
        points: true,
        pointsOverride: true,
        match: { select: { homeScore: true, awayScore: true } },
      },
    }),
    // Ajustes manuais entram só no ranking geral (como o bônus de campeão).
    stage
      ? Promise.resolve(
          [] as { userId: string; _sum: { delta: number | null } }[]
        )
      : prisma.pointAdjustment.groupBy({
          by: ["userId"],
          _sum: { delta: true },
        }),
  ]);

  const adjustmentByUser = new Map<string, number>(
    adjustments.map((a) => [a.userId, a._sum.delta ?? 0])
  );

  const rows = new Map<string, RankingRow>();
  for (const user of users) {
    const championPoints = stage ? 0 : (user.championPick?.points ?? 0);
    const adjustmentPoints = stage ? 0 : (adjustmentByUser.get(user.id) ?? 0);
    rows.set(user.id, {
      position: 0,
      userId: user.id,
      name: user.name,
      totalPoints: championPoints + adjustmentPoints,
      exactCount: 0,
      resultCount: 0,
      scoredPredictions: 0,
      championPoints,
      adjustmentPoints,
      createdAt: user.createdAt,
    });
  }

  for (const p of predictions) {
    const row = rows.get(p.userId);
    if (!row) continue;
    // Pontos efetivos: override manual do admin prevalece sobre o automático.
    const effective = p.pointsOverride ?? p.points;
    if (effective == null) continue;
    row.totalPoints += effective;
    row.scoredPredictions++;
    // Exatos/resultados (desempate) vêm sempre do placar real, não dos pontos.
    if (p.match.homeScore != null && p.match.awayScore != null) {
      const exact =
        p.homeScore === p.match.homeScore && p.awayScore === p.match.awayScore;
      const correctResult =
        outcomeOf(p.homeScore, p.awayScore) ===
        outcomeOf(p.match.homeScore, p.match.awayScore);
      if (exact) row.exactCount++;
      if (correctResult) row.resultCount++;
    }
  }

  const sorted = [...rows.values()].sort(
    (a, b) =>
      b.totalPoints - a.totalPoints ||
      b.exactCount - a.exactCount ||
      b.resultCount - a.resultCount ||
      a.createdAt.getTime() - b.createdAt.getTime()
  );

  sorted.forEach((row, i) => {
    row.position = i + 1;
  });
  return sorted;
}
