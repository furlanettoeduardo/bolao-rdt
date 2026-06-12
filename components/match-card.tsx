// Cartão de jogo usado nas listagens (dashboard, /jogos, chaveamento).
// Mostra placar (ao vivo/encerrado) ou horário (agendado), badge de status
// e, opcionalmente, o palpite do usuário com os pontos ganhos.

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LocalTime } from "@/components/local-time";
import { MatchStatusBadge } from "@/components/match-status-badge";
import { TeamLabel } from "@/components/team-label";
import { cn } from "@/lib/cn";
import { STAGE_LABELS } from "@/lib/format";
import { isFinishedStatus, isLiveStatus } from "@/lib/match-rules";
import type { PredictionDTO } from "@/lib/queries";
import type { MatchDTO } from "@/lib/types";

export function pointsBadgeVariant(points: number) {
  if (points >= 10) return "gold" as const;
  if (points > 0) return "success" as const;
  return "neutral" as const;
}

export function MatchScoreOrTime({ match }: { match: MatchDTO }) {
  const live = isLiveStatus(match.status);
  const finished = isFinishedStatus(match.status);

  if ((live || finished) && match.homeScore != null && match.awayScore != null) {
    return (
      <span
        className={cn(
          "min-w-14 text-center text-lg font-bold tabular-nums",
          live ? "text-cup-red" : "text-slate-900"
        )}
      >
        {match.homeScore}
        <span className="px-1 text-slate-400">×</span>
        {match.awayScore}
      </span>
    );
  }

  return (
    <span className="min-w-14 text-center">
      <LocalTime
        iso={match.kickoff}
        mode="time"
        className="text-sm font-semibold tabular-nums text-slate-700"
      />
    </span>
  );
}

/** Linha extra para prorrogação/pênaltis em jogos de mata-mata */
export function ExtraTimeNote({ match }: { match: MatchDTO }) {
  if (match.homePenalties != null && match.awayPenalties != null) {
    return (
      <p className="text-center text-xs text-slate-500">
        Prorrogação {match.homeScoreET ?? "-"}×{match.awayScoreET ?? "-"} ·
        Pênaltis {match.homePenalties}×{match.awayPenalties}
      </p>
    );
  }
  if (match.homeScoreET != null && match.awayScoreET != null) {
    return (
      <p className="text-center text-xs text-slate-500">
        Prorrogação: {match.homeScoreET}×{match.awayScoreET}
      </p>
    );
  }
  return null;
}

export function MatchCard({
  match,
  prediction,
  href,
  showStage = true,
}: {
  match: MatchDTO;
  prediction?: PredictionDTO | null;
  href?: string;
  showStage?: boolean;
}) {
  const stageLabel =
    match.stage === "GROUP" && match.group
      ? `Grupo ${match.group}`
      : STAGE_LABELS[match.stage];

  const body = (
    <>
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span className="flex items-center gap-2">
          {showStage ? <span>{stageLabel}</span> : null}
          <LocalTime iso={match.kickoff} mode="date" />
        </span>
        <MatchStatusBadge status={match.status} />
      </div>

      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TeamLabel
          team={match.homeTeam}
          placeholder={match.homePlaceholder}
          bold
        />
        <MatchScoreOrTime match={match} />
        <TeamLabel
          team={match.awayTeam}
          placeholder={match.awayPlaceholder}
          bold
          reverse
        />
      </div>

      <ExtraTimeNote match={match} />

      {prediction ? (
        <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
          <span className="text-slate-500">
            Seu palpite:{" "}
            <strong className="tabular-nums text-slate-700">
              {prediction.homeScore}×{prediction.awayScore}
            </strong>
          </span>
          {prediction.points != null ? (
            <Badge variant={pointsBadgeVariant(prediction.points)}>
              +{prediction.points} pts
            </Badge>
          ) : null}
        </div>
      ) : null}
    </>
  );

  const cardClass =
    "block rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors";

  if (href === undefined) {
    href = `/jogos/${match.id}`;
  }
  if (href === "") {
    return <div className={cardClass}>{body}</div>;
  }
  return (
    <Link
      href={href}
      className={cn(cardClass, "hover:border-field-400 hover:bg-field-50/40")}
    >
      {body}
    </Link>
  );
}
