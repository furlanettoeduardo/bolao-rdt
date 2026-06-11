// Endpoint de sincronização — protegido por CRON_SECRET.
//   GET  → usado pelo cron nativo da Vercel (envia o Bearer automaticamente)
//   POST → usado pelo GitHub Actions / cron-job.org
// Query: ?scope=window (padrão, ontem→amanhã) | ?scope=full (todos os jogos)

import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
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
