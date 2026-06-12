// Painel admin — sincronização manual, edição de resultados e gestão de
// usuários. O middleware já bloqueia não-admins; a checagem aqui é defesa
// em profundidade.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MatchEditor, type AdminMatch } from "@/components/admin/match-editor";
import { SyncPanel, type SyncLogDTO } from "@/components/admin/sync-panel";
import { UserPointsAdjuster } from "@/components/admin/user-points-adjuster";
import { UsersTable, type AdminUser } from "@/components/admin/users-table";
import { prisma } from "@/lib/db";
import { STAGE_LABELS } from "@/lib/format";
import { getSyncLogs, listUsers } from "@/lib/queries";

export const metadata = { title: "Painel admin" };

/** Data UTC curta para o rótulo do <select> (ex.: "11/06") */
function shortUtcDate(kickoff: Date): string {
  const iso = kickoff.toISOString();
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export default async function AdminPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const [syncLogs, users, matches] = await Promise.all([
    getSyncLogs(120),
    listUsers(),
    prisma.match.findMany({
      include: {
        homeTeam: true,
        awayTeam: true,
        _count: { select: { predictions: true } },
      },
      orderBy: { kickoff: "asc" },
    }),
  ]);

  // Serializa datas como ISO strings antes de passar a client components
  const logs: SyncLogDTO[] = syncLogs.map((log) => ({
    id: log.id,
    ranAt: log.ranAt.toISOString(),
    ok: log.ok,
    scope: log.scope,
    message: log.message,
    durationMs: log.durationMs,
  }));

  const adminUsers: AdminUser[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    predictionCount: user._count.predictions,
  }));

  const adminMatches: AdminMatch[] = matches.map((match) => {
    const phase =
      match.stage === "GROUP" && match.group
        ? `Grupo ${match.group}`
        : STAGE_LABELS[match.stage];
    const home = match.homeTeam?.code ?? match.homePlaceholder ?? "A definir";
    const away = match.awayTeam?.code ?? match.awayPlaceholder ?? "A definir";
    return {
      id: match.id,
      externalId: match.externalId,
      label: `${phase} · ${home} × ${away} · ${shortUtcDate(match.kickoff)}`,
      status: match.status,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      stage: match.stage,
      homeTeamId: match.homeTeamId,
      homeTeamName: match.homeTeam?.name ?? null,
      awayTeamId: match.awayTeamId,
      awayTeamName: match.awayTeam?.name ?? null,
      predictionCount: match._count.predictions,
    };
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Painel admin</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sincronização de dados, edição manual de resultados e gestão de
          participantes.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <SyncPanel logs={logs} />
        <MatchEditor matches={adminMatches} />
      </div>

      <UserPointsAdjuster users={adminUsers} />

      <UsersTable users={adminUsers} currentUserId={session.user.id} />
    </div>
  );
}
