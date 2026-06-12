// ─────────────────────────────────────────────────────────────────────────────
// Camada de leitura (somente server) — queries Prisma + mapeamento para DTOs
// serializáveis usados por páginas e componentes client.
// ─────────────────────────────────────────────────────────────────────────────

import type { Match, Prediction, Team } from "@prisma/client";
import { prisma } from "./db";
import { computeRanking, type RankingRow } from "./ranking";
import { arePredictionsVisible, isLiveStatus, isMatchLocked } from "./match-rules";
import { STAGE_ORDER } from "./format";
import { teamNamePt } from "./team-names";
import type { MatchDTO, Stage, TeamDTO } from "./types";

// ── DTOs ─────────────────────────────────────────────────────────────────────

export function toTeamDTO(team: Team): TeamDTO {
  return {
    id: team.id,
    name: teamNamePt(team.code, team.name),
    code: team.code,
    flagUrl: team.flagUrl,
    group: team.group,
  };
}

type MatchWithTeams = Match & {
  homeTeam: Team | null;
  awayTeam: Team | null;
};

export function toMatchDTO(match: MatchWithTeams): MatchDTO {
  return {
    id: match.id,
    externalId: match.externalId,
    stage: match.stage,
    group: match.group,
    kickoff: match.kickoff.toISOString(),
    status: match.status,
    homeTeam: match.homeTeam ? toTeamDTO(match.homeTeam) : null,
    awayTeam: match.awayTeam ? toTeamDTO(match.awayTeam) : null,
    homePlaceholder: match.homePlaceholder,
    awayPlaceholder: match.awayPlaceholder,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    homeScoreET: match.homeScoreET,
    awayScoreET: match.awayScoreET,
    homePenalties: match.homePenalties,
    awayPenalties: match.awayPenalties,
    advancingTeamId: match.advancingTeamId,
    venue: match.venue,
    city: match.city,
  };
}

export interface PredictionDTO {
  id: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  advancingTeamId: string | null;
  points: number | null;
}

export function toPredictionDTO(p: Prediction): PredictionDTO {
  return {
    id: p.id,
    matchId: p.matchId,
    homeScore: p.homeScore,
    awayScore: p.awayScore,
    advancingTeamId: p.advancingTeamId,
    points: p.points,
  };
}

const withTeams = { homeTeam: true, awayTeam: true } as const;

// ── Jogos ────────────────────────────────────────────────────────────────────

export interface MatchFilters {
  stage?: Stage;
  group?: string;
  /** "open" = agendados no futuro; "live"; "finished"; ausente = todos */
  status?: "open" | "live" | "finished";
}

export async function listMatches(filters: MatchFilters = {}): Promise<MatchDTO[]> {
  const matches = await prisma.match.findMany({
    where: {
      ...(filters.stage ? { stage: filters.stage } : {}),
      ...(filters.group ? { group: filters.group } : {}),
      ...(filters.status === "live"
        ? { status: { in: ["IN_PLAY", "PAUSED"] } }
        : {}),
      ...(filters.status === "finished"
        ? { status: { in: ["FINISHED", "AWARDED"] } }
        : {}),
      ...(filters.status === "open"
        ? { status: "SCHEDULED", kickoff: { gt: new Date() } }
        : {}),
    },
    include: withTeams,
    orderBy: { kickoff: "asc" },
  });
  return matches.map(toMatchDTO);
}

export async function getMatchById(id: string): Promise<MatchDTO | null> {
  const match = await prisma.match.findUnique({
    where: { id },
    include: withTeams,
  });
  return match ? toMatchDTO(match) : null;
}

/**
 * Início e fim do dia de hoje no fuso de São Paulo, em UTC.
 * America/Sao_Paulo é UTC-3 fixo (sem horário de verão desde 2019).
 */
export function saoPauloTodayUtcRange(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const spDay = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(now);
  const [y, m, d] = spDay.split("-").map(Number) as [number, number, number];
  const start = new Date(Date.UTC(y, m - 1, d, 3, 0, 0));
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/** Jogos ao vivo + jogos de hoje (fuso de exibição padrão) */
export async function getTodayAndLiveMatches(): Promise<MatchDTO[]> {
  const { start, end } = saoPauloTodayUtcRange();
  const matches = await prisma.match.findMany({
    where: {
      OR: [
        { status: { in: ["IN_PLAY", "PAUSED"] } },
        { kickoff: { gte: start, lt: end } },
      ],
    },
    include: withTeams,
    orderBy: { kickoff: "asc" },
  });
  return matches.map(toMatchDTO);
}

export async function hasLiveMatches(): Promise<boolean> {
  const count = await prisma.match.count({
    where: { status: { in: ["IN_PLAY", "PAUSED"] } },
  });
  return count > 0;
}

/** Jogos de mata-mata na ordem do chaveamento */
export async function getKnockoutMatches(): Promise<MatchDTO[]> {
  const matches = await prisma.match.findMany({
    where: { stage: { not: "GROUP" } },
    include: withTeams,
    orderBy: { kickoff: "asc" },
  });
  return matches
    .map(toMatchDTO)
    .sort(
      (a, b) =>
        STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] ||
        a.kickoff.localeCompare(b.kickoff)
    );
}

/** Kickoff do primeiro jogo do mata-mata — trava do palpite de campeão */
export async function getFirstKnockoutKickoff(): Promise<Date | null> {
  const first = await prisma.match.findFirst({
    where: { stage: { not: "GROUP" } },
    orderBy: { kickoff: "asc" },
    select: { kickoff: true },
  });
  return first?.kickoff ?? null;
}

// ── Palpites ─────────────────────────────────────────────────────────────────

/** Palpites do usuário indexados por matchId */
export async function getUserPredictionsMap(
  userId: string
): Promise<Map<string, PredictionDTO>> {
  const predictions = await prisma.prediction.findMany({
    where: { userId },
  });
  return new Map(predictions.map((p) => [p.matchId, toPredictionDTO(p)]));
}

/** Próximos jogos abertos para os quais o usuário ainda não palpitou */
export async function getPendingMatches(
  userId: string,
  limit = 8
): Promise<MatchDTO[]> {
  const matches = await prisma.match.findMany({
    where: {
      status: "SCHEDULED",
      kickoff: { gt: new Date() },
      predictions: { none: { userId } },
    },
    include: withTeams,
    orderBy: { kickoff: "asc" },
    take: limit,
  });
  return matches.map(toMatchDTO);
}

export interface MatchPredictionRow {
  userId: string;
  userName: string;
  homeScore: number;
  awayScore: number;
  advancingTeamId: string | null;
  points: number | null;
}

/**
 * Palpites de todos os usuários para um jogo — chamar APENAS depois que o
 * jogo travou (anti-cópia). A página deve verificar `isMatchLocked` antes.
 */
export async function getMatchPredictions(
  matchId: string
): Promise<MatchPredictionRow[]> {
  const predictions = await prisma.prediction.findMany({
    where: { matchId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: [{ points: "desc" }, { user: { name: "asc" } }],
  });
  return predictions.map((p) => ({
    userId: p.user.id,
    userName: p.user.name,
    homeScore: p.homeScore,
    awayScore: p.awayScore,
    advancingTeamId: p.advancingTeamId,
    points: p.points,
  }));
}

export interface ParticipantStatus {
  userId: string;
  userName: string;
  hasPredicted: boolean;
}

/** Antes do jogo travar: apenas quem "já palpitou" (sem revelar o palpite) */
export async function getMatchParticipation(
  matchId: string
): Promise<ParticipantStatus[]> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      predictions: { where: { matchId }, select: { id: true } },
    },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({
    userId: u.id,
    userName: u.name,
    hasPredicted: u.predictions.length > 0,
  }));
}

export interface HistoryEntry {
  match: MatchDTO;
  prediction: PredictionDTO;
}

/**
 * Histórico de palpites de um usuário. Quando `viewerIsOwner` é false,
 * inclui apenas jogos já travados (anti-cópia).
 */
export async function getUserHistory(
  targetUserId: string,
  viewerIsOwner: boolean
): Promise<HistoryEntry[]> {
  const predictions = await prisma.prediction.findMany({
    where: { userId: targetUserId },
    include: { match: { include: withTeams } },
    orderBy: { match: { kickoff: "desc" } },
  });
  const now = new Date();
  return predictions
    .filter((p) => viewerIsOwner || arePredictionsVisible(p.match, now))
    .map((p) => ({ match: toMatchDTO(p.match), prediction: toPredictionDTO(p) }));
}

// ── Campeão ──────────────────────────────────────────────────────────────────

export interface ChampionPickDTO {
  team: TeamDTO;
  points: number | null;
}

export async function getChampionPick(
  userId: string
): Promise<ChampionPickDTO | null> {
  const pick = await prisma.championPick.findUnique({
    where: { userId },
    include: { team: true },
  });
  return pick ? { team: toTeamDTO(pick.team), points: pick.points } : null;
}

export async function listTeams(): Promise<TeamDTO[]> {
  const teams = await prisma.team.findMany({ orderBy: { name: "asc" } });
  return teams.map(toTeamDTO);
}

// ── Grupos ───────────────────────────────────────────────────────────────────

export interface GroupTableRow {
  team: TeamDTO;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export const GROUP_LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
] as const;

/**
 * Tabelas dos 12 grupos. Sem standings sincronizados ainda, monta tabelas
 * zeradas a partir dos times de cada grupo.
 */
export async function getGroupTables(): Promise<Map<string, GroupTableRow[]>> {
  const [standings, teams] = await Promise.all([
    prisma.groupStanding.findMany({ include: { team: true } }),
    prisma.team.findMany({ where: { group: { not: null } } }),
  ]);

  const tables = new Map<string, GroupTableRow[]>();
  for (const letter of GROUP_LETTERS) tables.set(letter, []);

  if (standings.length > 0) {
    for (const s of standings) {
      tables.get(s.group)?.push({
        team: toTeamDTO(s.team),
        position: s.position,
        played: s.played,
        won: s.won,
        drawn: s.drawn,
        lost: s.lost,
        goalsFor: s.goalsFor,
        goalsAgainst: s.goalsAgainst,
        goalDifference: s.goalDifference,
        points: s.points,
      });
    }
    for (const rows of tables.values()) {
      rows.sort((a, b) => a.position - b.position);
    }
  }

  // Completa grupos sem standings com tabela zerada (ordem alfabética)
  for (const team of teams) {
    const rows = tables.get(team.group!);
    if (!rows || rows.some((r) => r.team.id === team.id)) continue;
    rows.push({
      team: toTeamDTO(team),
      position: rows.length + 1,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  }
  return tables;
}

// ── Ranking ──────────────────────────────────────────────────────────────────

export async function getRanking(stage?: Stage): Promise<RankingRow[]> {
  return computeRanking(stage);
}

export async function getRankingTop(n: number): Promise<RankingRow[]> {
  const ranking = await computeRanking();
  return ranking.slice(0, n);
}

// ── Admin ────────────────────────────────────────────────────────────────────

export async function getSyncLogs(limit = 30) {
  return prisma.syncLog.findMany({
    orderBy: { ranAt: "desc" },
    take: limit,
  });
}

export async function listUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { predictions: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

// Reexporta helpers usados junto com as queries nas páginas
export { isMatchLocked, isLiveStatus, arePredictionsVisible };
