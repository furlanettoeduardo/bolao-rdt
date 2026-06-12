// "Palpites da galera" — palpites de todos os participantes, jogo a jogo.
// Só mostra jogos que já começaram (anti-cópia garantido no servidor).

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LiveRefresh } from "@/components/live-refresh";
import { LocalTime } from "@/components/local-time";
import {
  ExtraTimeNote,
  MatchScoreOrTime,
  pointsBadgeVariant,
} from "@/components/match-card";
import { MatchStatusBadge } from "@/components/match-status-badge";
import { TeamLabel } from "@/components/team-label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { STAGE_LABELS, dayKey, formatDayHeading } from "@/lib/format";
import { isKnockoutStage } from "@/lib/match-rules";
import { getCrowdPredictions, type CrowdMatch } from "@/lib/queries";
import type { MatchDTO, TeamDTO } from "@/lib/types";

export const metadata = { title: "Palpites da galera" };

function teamInMatch(match: MatchDTO, teamId: string | null): TeamDTO | null {
  if (!teamId) return null;
  if (match.homeTeam?.id === teamId) return match.homeTeam;
  if (match.awayTeam?.id === teamId) return match.awayTeam;
  return null;
}

export default async function GaleraPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const crowd = await getCrowdPredictions();

  const byDay = new Map<string, CrowdMatch[]>();
  for (const item of crowd) {
    const key = dayKey(item.match.kickoff);
    const list = byDay.get(key) ?? [];
    list.push(item);
    byDay.set(key, list);
  }

  return (
    <div className="space-y-6">
      <LiveRefresh />

      <header className="space-y-1">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Palpites da galera
        </h1>
        <p className="text-sm text-slate-600">
          O palpite de cada um é revelado quando o jogo começa — antes disso,
          fica em segredo (anti-cópia).
        </p>
      </header>

      {byDay.size === 0 ? (
        <EmptyState
          title="Nenhum palpite revelado ainda"
          description="Assim que os jogos começarem, os palpites de todos aparecem aqui. Faça os seus em “Palpites”."
          action={
            <Link
              href="/palpites"
              className="text-sm font-semibold text-field-700 hover:underline"
            >
              Ir para os palpites →
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {[...byDay.entries()].map(([key, items]) => {
            const first = items[0];
            if (!first) return null;
            return (
              <section key={key} className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-field-800">
                  <span className="capitalize">
                    {formatDayHeading(first.match.kickoff)}
                  </span>
                </h2>
                {items.map((item) => (
                  <CrowdCard
                    key={item.match.id}
                    item={item}
                    currentUserId={userId}
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CrowdCard({
  item,
  currentUserId,
}: {
  item: CrowdMatch;
  currentUserId: string;
}) {
  const { match, predictions } = item;
  const knockout = isKnockoutStage(match.stage);
  const stageLabel =
    match.stage === "GROUP" && match.group
      ? `Grupo ${match.group}`
      : STAGE_LABELS[match.stage];

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span className="flex items-center gap-2">
          <span>{stageLabel}</span>
          <LocalTime iso={match.kickoff} mode="time" />
        </span>
        <MatchStatusBadge status={match.status} />
      </div>

      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TeamLabel team={match.homeTeam} placeholder={match.homePlaceholder} bold />
        <MatchScoreOrTime match={match} />
        <TeamLabel
          team={match.awayTeam}
          placeholder={match.awayPlaceholder}
          bold
          reverse
        />
      </div>
      <ExtraTimeNote match={match} />

      <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
        {predictions.map((p) => {
          const isMe = p.userId === currentUserId;
          const advancing = teamInMatch(match, p.advancingTeamId);
          return (
            <li
              key={p.userId}
              className={cn(
                "flex items-center justify-between gap-2 py-1.5 text-sm",
                isMe && "rounded-md bg-field-50 px-1.5"
              )}
            >
              <Link
                href={`/usuarios/${p.userId}`}
                className="truncate font-medium text-slate-700 hover:text-field-700 hover:underline"
              >
                {p.userName}
                {isMe ? (
                  <span className="ml-1 text-xs font-semibold text-field-700">
                    (você)
                  </span>
                ) : null}
              </Link>
              <span className="flex shrink-0 items-center gap-2">
                <span className="tabular-nums font-semibold text-slate-800">
                  {p.homeScore}
                  <span className="px-0.5 font-normal text-slate-400">×</span>
                  {p.awayScore}
                </span>
                {knockout && advancing ? (
                  <span
                    className="text-xs text-slate-500"
                    title={`Classificado no palpite: ${advancing.name}`}
                  >
                    → {advancing.code}
                  </span>
                ) : null}
                {p.points != null ? (
                  <Badge variant={pointsBadgeVariant(p.points)}>
                    +{p.points}
                  </Badge>
                ) : (
                  <span
                    aria-label="Pontos ainda não calculados"
                    className="text-xs text-slate-300"
                  >
                    —
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
