// Perfil público de um participante — avatar, estatísticas no ranking e
// histórico de palpites. Anti-cópia: para visitantes, getUserHistory só
// retorna palpites de jogos já travados (a regra é aplicada no servidor).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { pointsBadgeVariant } from "@/components/match-card";
import { MatchStatusBadge } from "@/components/match-status-badge";
import { LocalTime } from "@/components/local-time";
import { TeamLabel } from "@/components/team-label";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";
import { STAGE_LABELS } from "@/lib/format";
import { getRanking, getUserHistory, type HistoryEntry } from "@/lib/queries";

// Deduplica a busca do usuário entre generateMetadata e a página
const getUser = cache(async (id: string) =>
  prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, createdAt: true },
  })
);

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const user = await getUser(id);
  return { title: user ? user.name : "Participante não encontrado" };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { id } = await params;
  const user = await getUser(id);
  if (!user) notFound();

  const session = await auth();
  const viewerIsOwner = session?.user?.id === user.id;

  const [ranking, history] = await Promise.all([
    getRanking(),
    getUserHistory(user.id, viewerIsOwner),
  ]);
  const stats = ranking.find((row) => row.userId === user.id);

  const initial = user.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="space-y-6">
      {viewerIsOwner ? (
        <p
          role="note"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-field-200 bg-field-50 px-4 py-3 text-sm text-field-800"
        >
          <span>
            Este é seu perfil público — é assim que os demais participantes
            veem você.
          </span>
          <Link
            href="/perfil"
            className="font-semibold underline underline-offset-2 hover:text-field-900"
          >
            Ir para meu perfil
          </Link>
        </p>
      ) : null}

      <Card>
        <div className="flex items-center gap-4 px-4 py-5">
          <span
            aria-hidden
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-cup-gold text-2xl font-bold text-field-950"
          >
            {initial}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-slate-900">
              {user.name}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Participante desde{" "}
              <LocalTime iso={user.createdAt.toISOString()} mode="date" />
            </p>
          </div>
        </div>
      </Card>

      <section aria-labelledby="estatisticas-heading">
        <h2 id="estatisticas-heading" className="sr-only">
          Estatísticas no bolão
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Posição"
            value={stats ? `${stats.position}º` : "—"}
            highlight
          />
          <StatTile label="Pontos" value={stats ? stats.totalPoints : "—"} />
          <StatTile
            label="Placares exatos"
            value={stats ? stats.exactCount : "—"}
          />
          <StatTile
            label="Resultados certos"
            value={stats ? stats.resultCount : "—"}
          />
        </dl>
      </section>

      <section aria-labelledby="historico-heading" className="space-y-3">
        <div>
          <h2
            id="historico-heading"
            className="text-base font-bold text-slate-900"
          >
            Histórico de palpites
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {viewerIsOwner
              ? "Lista completa, incluindo jogos futuros — só você vê tudo isso."
              : "Palpites de jogos que ainda não começaram ficam ocultos."}
          </p>
        </div>

        {history.length === 0 ? (
          viewerIsOwner ? (
            <EmptyState
              title="Você ainda não registrou palpites"
              description="Comece agora e dispute o ranking com os outros participantes."
              action={
                <Link href="/palpites" className={buttonClasses("primary", "sm")}>
                  Fazer meus palpites
                </Link>
              }
            />
          ) : (
            <EmptyState
              title="Nenhum palpite visível por aqui"
              description="Palpites de jogos que ainda não começaram ficam ocultos. Volte depois do apito inicial!"
            />
          )
        ) : (
          <Card>
            <ul className="divide-y divide-slate-100">
              {history.map((entry) => (
                <HistoryRow key={entry.prediction.id} entry={entry} />
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd
        className={`mt-1 text-2xl font-bold tabular-nums ${
          highlight ? "text-field-700" : "text-slate-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const { match, prediction } = entry;

  const stageLabel =
    match.stage === "GROUP" && match.group
      ? `Grupo ${match.group}`
      : STAGE_LABELS[match.stage];

  const hasResult = match.homeScore != null && match.awayScore != null;

  // Sigla de quem avança no palpite (mata-mata com empate)
  const advancingCode =
    prediction.advancingTeamId == null
      ? null
      : prediction.advancingTeamId === match.homeTeam?.id
        ? match.homeTeam.code
        : prediction.advancingTeamId === match.awayTeam?.id
          ? match.awayTeam.code
          : null;

  return (
    <li>
      <Link
        href={`/jogos/${match.id}`}
        className="block px-4 py-3 transition-colors hover:bg-field-50/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-field-700"
      >
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <LocalTime iso={match.kickoff} mode="date" />
            <span aria-hidden>·</span>
            <span>{stageLabel}</span>
          </span>
          {prediction.points != null ? (
            <Badge variant={pointsBadgeVariant(prediction.points)}>
              +{prediction.points} pts
            </Badge>
          ) : (
            <MatchStatusBadge status={match.status} match={match} />
          )}
        </div>

        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <TeamLabel
            team={match.homeTeam}
            placeholder={match.homePlaceholder}
            flagSize="sm"
          />
          <span className="flex min-w-14 flex-col items-center">
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Palpite
            </span>
            <span className="text-base font-bold tabular-nums text-slate-900">
              {prediction.homeScore}
              <span aria-hidden className="px-0.5 text-slate-400">
                ×
              </span>
              {prediction.awayScore}
            </span>
          </span>
          <TeamLabel
            team={match.awayTeam}
            placeholder={match.awayPlaceholder}
            flagSize="sm"
            reverse
          />
        </div>

        <p className="mt-1.5 text-center text-xs text-slate-500">
          {advancingCode ? (
            <>
              Avança no palpite:{" "}
              <strong className="text-slate-700">{advancingCode}</strong>
              <span aria-hidden> · </span>
            </>
          ) : null}
          {hasResult ? (
            <>
              Resultado:{" "}
              <strong className="tabular-nums text-slate-700">
                {match.homeScore}×{match.awayScore}
              </strong>
            </>
          ) : (
            <>Aguardando resultado</>
          )}
        </p>
      </Link>
    </li>
  );
}
