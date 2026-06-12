// ─────────────────────────────────────────────────────────────────────────────
// Interface do provedor de dados de futebol.
// Para trocar de provedor (ex.: API-Football), implemente FootballProvider
// e ajuste apenas a factory getProvider() — o resto do código não muda.
// ─────────────────────────────────────────────────────────────────────────────

import type { MatchStatus, Stage } from "../types";
import { FootballDataProvider } from "./football-data";

export interface ProviderTeam {
  externalId: number;
  name: string;
  code: string; // sigla TLA, ex.: BRA
  flagUrl: string;
  /** "A".."L" quando o provedor informa o grupo */
  group: string | null;
}

export interface ProviderScore {
  home: number;
  away: number;
}

export interface ProviderMatch {
  externalId: number;
  stage: Stage;
  group: string | null;
  matchday: number | null;
  kickoffUtc: string; // ISO 8601
  status: MatchStatus;
  homeTeamExternalId: number | null;
  awayTeamExternalId: number | null;
  /** Texto do provedor para vaga ainda não definida (ex.: "1º do Grupo A") */
  homePlaceholder: string | null;
  awayPlaceholder: string | null;
  /** Placar do tempo regulamentar (90 min) */
  regulation: ProviderScore | null;
  /** Placar acumulado após a prorrogação (120 min), quando houver */
  afterExtraTime: ProviderScore | null;
  penalties: ProviderScore | null;
  /** Vencedor da partida como um todo (inclui pênaltis), se decidida */
  winnerExternalId: number | null;
  venue: string | null;
  city: string | null;
  /** Nome do árbitro principal, quando disponível */
  referee: string | null;
}

export interface ProviderStandingRow {
  group: string; // "A".."L"
  position: number;
  teamExternalId: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface MatchQuery {
  /** YYYY-MM-DD (UTC) */
  dateFrom?: string;
  dateTo?: string;
}

export interface FootballProvider {
  getTeams(): Promise<ProviderTeam[]>;
  getMatches(query?: MatchQuery): Promise<ProviderMatch[]>;
  getStandings(): Promise<ProviderStandingRow[]>;
}

export function getProvider(): FootballProvider {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    throw new Error(
      "FOOTBALL_DATA_TOKEN não definido. Obtenha um token gratuito em https://www.football-data.org/client/register"
    );
  }
  return new FootballDataProvider(token);
}
