// Formatação e rótulos pt-BR. Seguro para importar em componentes client.

import { DEFAULT_TIMEZONE } from "./config";
import type { MatchStatus, Stage } from "./types";

export const STAGE_LABELS: Record<Stage, string> = {
  GROUP: "Fase de grupos",
  ROUND_32: "16 avos de final",
  ROUND_16: "Oitavas de final",
  QUARTER: "Quartas de final",
  SEMI: "Semifinais",
  THIRD_PLACE: "Disputa de 3º lugar",
  FINAL: "Final",
};

export const STAGE_ORDER: Record<Stage, number> = {
  GROUP: 0,
  ROUND_32: 1,
  ROUND_16: 2,
  QUARTER: 3,
  SEMI: 4,
  THIRD_PLACE: 5,
  FINAL: 6,
};

export const STATUS_LABELS: Record<MatchStatus, string> = {
  SCHEDULED: "Agendado",
  IN_PLAY: "Ao vivo",
  PAUSED: "Intervalo",
  FINISHED: "Encerrado",
  SUSPENDED: "Suspenso",
  POSTPONED: "Adiado",
  CANCELLED: "Cancelado",
  AWARDED: "W.O.",
};

const dateFmt = (tz: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: tz,
  });

const timeFmt = (tz: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  });

const fullFmt = (tz: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  });

export function formatMatchDate(date: Date | string, tz = DEFAULT_TIMEZONE) {
  return dateFmt(tz).format(new Date(date));
}

export function formatMatchTime(date: Date | string, tz = DEFAULT_TIMEZONE) {
  return timeFmt(tz).format(new Date(date));
}

export function formatMatchDateTime(date: Date | string, tz = DEFAULT_TIMEZONE) {
  return fullFmt(tz).format(new Date(date));
}

/** Chave de agrupamento por dia no fuso de exibição (ex.: "2026-06-11") */
export function dayKey(date: Date | string, tz = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).format(new Date(date));
}

export function formatDayHeading(date: Date | string, tz = DEFAULT_TIMEZONE) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: tz,
  }).format(new Date(date));
}
