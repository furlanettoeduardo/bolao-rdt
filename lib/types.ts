// Tipos compartilhados entre server e client.
// Espelham os enums do Prisma (string literals estruturalmente compatíveis)
// para que componentes client não precisem importar @prisma/client.

export type Stage =
  | "GROUP"
  | "ROUND_32"
  | "ROUND_16"
  | "QUARTER"
  | "SEMI"
  | "THIRD_PLACE"
  | "FINAL";

export type MatchStatus =
  | "SCHEDULED"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "SUSPENDED"
  | "POSTPONED"
  | "CANCELLED"
  | "AWARDED";

export type Role = "USER" | "ADMIN";

/** DTO de time para componentes e APIs internas */
export interface TeamDTO {
  id: string;
  name: string;
  code: string;
  flagUrl: string;
  group: string | null;
}

/** DTO de jogo usado nas listagens e no polling SWR */
export interface MatchDTO {
  id: string;
  externalId: number;
  stage: Stage;
  group: string | null;
  kickoff: string; // ISO UTC
  status: MatchStatus;
  homeTeam: TeamDTO | null;
  awayTeam: TeamDTO | null;
  homePlaceholder: string | null;
  awayPlaceholder: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeScoreET: number | null;
  awayScoreET: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
  advancingTeamId: string | null;
  venue: string | null;
  city: string | null;
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };
