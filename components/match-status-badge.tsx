import { Badge } from "@/components/ui/badge";
import { LiveMinute } from "@/components/live-minute";
import { STATUS_LABELS } from "@/lib/format";
import { isFinishedStatus, isLiveStatus } from "@/lib/match-rules";
import type { MatchDTO, MatchStatus } from "@/lib/types";

export function MatchStatusBadge({
  status,
  match,
}: {
  status: MatchStatus;
  /** Opcional — quando fornecido e o jogo está IN_PLAY, mostra o minuto */
  match?: MatchDTO;
}) {
  if (isLiveStatus(status)) {
    return (
      <Badge variant="live">
        <span aria-hidden className="live-dot size-1.5 rounded-full bg-white" />
        {STATUS_LABELS[status]}
        {status === "IN_PLAY" && match?.liveSegmentStart ? (
          <LiveMinute
            liveSegmentStart={match.liveSegmentStart}
            clockBaseMinutes={match.clockBaseMinutes}
          />
        ) : null}
      </Badge>
    );
  }
  if (isFinishedStatus(status)) {
    return <Badge variant="neutral">{STATUS_LABELS[status]}</Badge>;
  }
  if (status === "POSTPONED" || status === "SUSPENDED" || status === "CANCELLED") {
    return <Badge variant="warning">{STATUS_LABELS[status]}</Badge>;
  }
  return <Badge variant="info">{STATUS_LABELS[status]}</Badge>;
}
