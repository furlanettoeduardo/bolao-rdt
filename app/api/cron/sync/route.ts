// Endpoint de sincronização — protegido por CRON_SECRET.
//   GET  → usado pelo cron nativo da Vercel (envia o Bearer automaticamente)
//   POST → usado pelo GitHub Actions / cron-job.org
// Query: ?scope=window (padrão, ontem→amanhã) | ?scope=full (todos os jogos)

import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Comparação em tempo constante: o hash SHA-256 garante buffers de comprimento
// fixo (32 bytes) dos dois lados, satisfazendo o timingSafeEqual e sem vazar o
// comprimento do segredo. Evita o curto-circuito de `!==` byte a byte.
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (!secret || !header || !safeEqual(header, `Bearer ${secret}`)) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado" },
      { status: 401 }
    );
  }

  const scope =
    req.nextUrl.searchParams.get("scope") === "full" ? "full" : "window";
  const result = await runSync(scope);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

export { handle as GET, handle as POST };
