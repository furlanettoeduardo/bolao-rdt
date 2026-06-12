import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/format";
import { isFinishedStatus, isLiveStatus } from "@/lib/match-rules";
import type { MatchStatus } from "@/lib/types";

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  if (isLiveStatus(status)) {
    return (
      <Badge variant="live">
        <span aria-hidden className="live-dot size-1.5 rounded-full bg-white" />
        {STATUS_LABELS[status]}
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
