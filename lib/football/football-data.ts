// Implementação do provedor para a Football-Data.org (API v4).
// Competição: FIFA World Cup — id 2000, code "WC".
// Free tier: 10 requisições/minuto — cada sync usa no máximo 2 chamadas.

import { COMPETITION } from "../config";
import type { MatchStatus, Stage } from "../types";
import type {
  FootballProvider,
  MatchQuery,
  ProviderMatch,
  ProviderScore,
  ProviderStandingRow,
  ProviderTeam,
} from "./provider";

const BASE_URL = "https://api.football-data.org/v4";

// ── Tipos da resposta da API (apenas os campos que usamos) ──────────────────

interface FDTeamRef {
  id: number | null;
  name: string | null;
  shortName?: string | null;
  tla?: string | null;
  crest?: string | null;
}

interface FDScorePair {
  home: number | null;
  away: number | null;
}

interface FDScore {
  winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
  duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
  fullTime: FDScorePair;
  halfTime?: FDScorePair;
  regularTime?: FDScorePair;
  extraTime?: FDScorePair;
  penalties?: FDScorePair;
}

interface FDMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number | null;
  stage: string;
  group: string | null;
  homeTeam: FDTeamRef;
  awayTeam: FDTeamRef;
  score: FDScore;
  venue?: string | null;
  referees?: {
    id: number;
    name: string | null;
    type?: string | null;
    nationality?: string | null;
  }[];
}

interface FDStandingTable {
  position: number;
  team: { id: number };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

interface FDStanding {
  stage: string;
  type: string;
  group: string | null;
  table: FDStandingTable[];
}

// ── Mapeamentos ──────────────────────────────────────────────────────────────

const STAGE_MAP: Record<string, Stage> = {
  GROUP_STAGE: "GROUP",
  LAST_32: "ROUND_32",
  ROUND_OF_32: "ROUND_32",
  PLAYOFFS: "ROUND_32",
  LAST_16: "ROUND_16",
  ROUND_OF_16: "ROUND_16",
  QUARTER_FINALS: "QUARTER",
  SEMI_FINALS: "SEMI",
  THIRD_PLACE: "THIRD_PLACE",
  THIRD_PLACE_PLAYOFF: "THIRD_PLACE",
  FINAL: "FINAL",
};

const STATUS_MAP: Record<string, MatchStatus> = {
  SCHEDULED: "SCHEDULED",
  TIMED: "SCHEDULED",
  IN_PLAY: "IN_PLAY",
  PAUSED: "PAUSED",
  FINISHED: "FINISHED",
  SUSPENDED: "SUSPENDED",
  POSTPONED: "POSTPONED",
  CANCELLED: "CANCELLED",
  AWARDED: "AWARDED",
};

function mapStage(stage: string): Stage {
  const mapped = STAGE_MAP[stage];
  if (!mapped) {
    throw new Error(`Fase desconhecida vinda da API: "${stage}"`);
  }
  return mapped;
}

function mapStatus(status: string): MatchStatus {
  return STATUS_MAP[status] ?? "SCHEDULED";
}

/**
 * Normaliza o grupo para a letra A–L, aceitando os vários formatos que a API
 * usa: "GROUP_A" (endpoint de matches), "Group J" (endpoint de standings),
 * "Grupo A" ou já "A". Retorna null para qualquer coisa fora de A–L.
 */
function mapGroup(group: string | null): string | null {
  if (!group) return null;
  const m = group.match(/([A-L])\s*$/i);
  return m?.[1]?.toUpperCase() ?? null;
}

function pair(p: FDScorePair | undefined): ProviderScore | null {
  if (!p || p.home === null || p.away === null) return null;
  return { home: p.home, away: p.away };
}

/**
 * Placar do tempo regulamentar. Na v4, quando há prorrogação, `fullTime` é o
 * placar acumulado dos 120 min e `regularTime` guarda os 90 min.
 */
function regulationScore(score: FDScore): ProviderScore | null {
  if (score.duration === "REGULAR") return pair(score.fullTime);
  return pair(score.regularTime) ?? pair(score.fullTime);
}

function afterExtraTimeScore(score: FDScore): ProviderScore | null {
  if (score.duration === "REGULAR") return null;
  return pair(score.fullTime);
}

// ── Provider ────────────────────────────────────────────────────────────────

export class FootballDataProvider implements FootballProvider {
  constructor(private readonly token: string) {}

  private async request<T>(path: string): Promise<T> {
    const startedAt = Date.now();
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "X-Auth-Token": this.token },
      // Sempre dados frescos — o cache fica no nosso banco, não aqui.
      cache: "no-store",
    });
    // Log de diagnóstico (aparece nos logs de runtime da Vercel). O token vai no
    // header, então o path é seguro de logar.
    console.log(
      `[football-data] GET ${path} → ${res.status} em ${Date.now() - startedAt}ms`
    );
    if (res.status === 429) {
      throw new Error(
        "Football-Data.org: limite de requisições atingido (10/min no plano gratuito). Tente novamente em instantes."
      );
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Football-Data.org respondeu ${res.status} em ${path}: ${body.slice(0, 200)}`
      );
    }
    return (await res.json()) as T;
  }

  async getTeams(): Promise<ProviderTeam[]> {
    const data = await this.request<{
      teams: { id: number; name: string; shortName?: string; tla?: string; crest?: string }[];
    }>(`/competitions/${COMPETITION.id}/teams`);

    return data.teams.map((t) => ({
      externalId: t.id,
      name: t.shortName || t.name,
      code: t.tla ?? t.name.slice(0, 3).toUpperCase(),
      flagUrl: t.crest ?? "",
      // O endpoint de teams não traz o grupo; ele é preenchido via standings.
      group: null,
    }));
  }

  async getMatches(query?: MatchQuery): Promise<ProviderMatch[]> {
    const params = new URLSearchParams();
    if (query?.dateFrom) params.set("dateFrom", query.dateFrom);
    if (query?.dateTo) params.set("dateTo", query.dateTo);
    const qs = params.size > 0 ? `?${params.toString()}` : "";

    const data = await this.request<{ matches: FDMatch[] }>(
      `/competitions/${COMPETITION.id}/matches${qs}`
    );

    return data.matches.map((m) => {
      const homeDefined = m.homeTeam?.id != null;
      const awayDefined = m.awayTeam?.id != null;
      const winner =
        m.score.winner === "HOME_TEAM"
          ? m.homeTeam?.id ?? null
          : m.score.winner === "AWAY_TEAM"
            ? m.awayTeam?.id ?? null
            : null;

      return {
        externalId: m.id,
        stage: mapStage(m.stage),
        group: mapGroup(m.group),
        matchday: m.matchday ?? null,
        kickoffUtc: m.utcDate,
        status: mapStatus(m.status),
        homeTeamExternalId: homeDefined ? m.homeTeam.id : null,
        awayTeamExternalId: awayDefined ? m.awayTeam.id : null,
        homePlaceholder: !homeDefined ? m.homeTeam?.name ?? null : null,
        awayPlaceholder: !awayDefined ? m.awayTeam?.name ?? null : null,
        regulation: regulationScore(m.score),
        afterExtraTime: afterExtraTimeScore(m.score),
        penalties: pair(m.score.penalties),
        winnerExternalId: winner,
        venue: m.venue ?? null,
        city: null,
        referee:
          m.referees?.find((r) => r.type === "REFEREE")?.name ??
          m.referees?.[0]?.name ??
          null,
      };
    });
  }

  async getStandings(): Promise<ProviderStandingRow[]> {
    const data = await this.request<{ standings: FDStanding[] }>(
      `/competitions/${COMPETITION.id}/standings`
    );

    const rows: ProviderStandingRow[] = [];
    for (const standing of data.standings) {
      // Apenas tabelas TOTAL da fase de grupos
      if (standing.type !== "TOTAL") continue;
      const group = mapGroup(standing.group);
      if (!group) continue;
      for (const row of standing.table) {
        rows.push({
          group,
          position: row.position,
          teamExternalId: row.team.id,
          played: row.playedGames,
          won: row.won,
          drawn: row.draw,
          lost: row.lost,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
          goalDifference: row.goalDifference,
          points: row.points,
        });
      }
    }
    return rows;
  }
}
