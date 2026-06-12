// Endpoint barato de polling (SWR no cliente) — consulta apenas o NOSSO
// banco. `stamp` muda quando qualquer jogo da janela ao vivo/hoje é
// atualizado pelo sync; o cliente usa isso para dar router.refresh().

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saoPauloTodayUtcRange } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const { start, end } = saoPauloTodayUtcRange();

  const [agg, liveCount] = await Promise.all([
    prisma.match.aggregate({
      where: {
        OR: [
          { status: { in: ["IN_PLAY", "PAUSED"] } },
          { kickoff: { gte: start, lt: end } },
        ],
      },
      _max: { updatedAt: true },
      _count: true,
    }),
    prisma.match.count({ where: { status: { in: ["IN_PLAY", "PAUSED"] } } }),
  ]);

  return NextResponse.json({
    stamp: `${agg._count}-${agg._max.updatedAt?.toISOString() ?? "none"}`,
    liveCount,
  });
}
