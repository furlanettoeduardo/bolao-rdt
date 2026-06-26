// Endpoint barato de polling (SWR no cliente) — consulta apenas o NOSSO
// banco. `stamp` muda quando qualquer jogo da janela ao vivo/hoje é
// atualizado pelo sync; o cliente usa isso para dar router.refresh().

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saoPauloTodayUtcRange } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const { start, end } = saoPauloTodayUtcRange();
  // `soon`: jogo a começar em ~1h (alinhado ao lead do sync e ao aviso "Falta
  // 1h"). O cliente usa isto para voltar ao polling rápido um pouco antes do
  // kickoff. É um sinal compartilhado (não por usuário), então cacheia na CDN.
  const now = new Date();
  const soonEnd = new Date(now.getTime() + 65 * 60 * 1000);

  const [agg, liveCount, soonCount] = await Promise.all([
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
    prisma.match.count({
      where: { status: "SCHEDULED", kickoff: { gt: now, lte: soonEnd } },
    }),
  ]);

  return NextResponse.json(
    {
      stamp: `${agg._count}-${agg._max.updatedAt?.toISOString() ?? "none"}`,
      liveCount,
      soon: soonCount > 0,
    },
    {
      // Endpoint público sem sessão: a CDN da Vercel serve a mesma resposta a
      // todos por 15s, colapsando milhares de req/s (e qualquer abuso anônimo)
      // em ~1 hit de origem por janela. O polling do cliente é de 45s, então o
      // atraso ao vivo é no máximo ~15s.
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
      },
    }
  );
}
