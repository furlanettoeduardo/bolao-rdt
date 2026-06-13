// Regras de estado de um jogo — trava de palpite, visibilidade e fim.
// Comparações SEMPRE em UTC no servidor; nunca confiar no relógio do cliente.

import type { MatchStatus, Stage } from "./types";

interface MatchLike {
  kickoff: Date | string;
  status: MatchStatus;
}

/** Status que contam como "jogo terminou e o resultado vale" */
export function isFinishedStatus(status: MatchStatus): boolean {
  return status === "FINISHED" || status === "AWARDED";
}

export function isLiveStatus(status: MatchStatus): boolean {
  return status === "IN_PLAY" || status === "PAUSED";
}

/**
 * Palpite travado? Trava no kickoff (UTC) ou assim que o jogo sai de
 * "agendado". Jogos suspensos/cancelados ficam travados; adiados (POSTPONED)
 * reabrem quando o sync grava o novo horário futuro.
 */
export function isMatchLocked(match: MatchLike, now: Date = new Date()): boolean {
  if (isLiveStatus(match.status) || isFinishedStatus(match.status)) return true;
  if (match.status === "SUSPENDED" || match.status === "CANCELLED") return true;
  return new Date(match.kickoff).getTime() <= now.getTime();
}

/**
 * Palpites dos outros usuários só aparecem depois que o jogo REALMENTE começou
 * (anti-cópia). Diferente da trava de edição, a revelação nunca pode acontecer
 * em estados de limbo (adiado/suspenso/cancelado): se revelasse e o jogo depois
 * reabrisse para edição, daria pra copiar/contra-apostar os palpites já vistos.
 * Antes da revelação, mostre apenas quem "já palpitou".
 */
export function arePredictionsVisible(match: MatchLike, now: Date = new Date()): boolean {
  if (isLiveStatus(match.status) || isFinishedStatus(match.status)) return true;
  if (
    match.status === "POSTPONED" ||
    match.status === "SUSPENDED" ||
    match.status === "CANCELLED"
  ) {
    return false;
  }
  // SCHEDULED com kickoff no passado = bola rolando, provedor ainda não atualizou.
  return new Date(match.kickoff).getTime() <= now.getTime();
}

export function isKnockoutStage(stage: Stage): boolean {
  return stage !== "GROUP";
}

/**
 * Trava do palpite de campeão: fecha quando QUALQUER jogo do mata-mata já
 * começou ou terminou. Diferente de confiar só no kickoff do primeiro jogo
 * (que reabriria a janela se esse jogo fosse adiado), considera o status de
 * todos os confrontos. POSTPONED é deliberadamente IGNORADO — um adiamento
 * puro não deve travar nem reabrir indevidamente; a trava passa a depender de
 * algum jogo realmente ter iniciado. Recebe a lista de jogos do mata-mata.
 */
export function hasKnockoutStarted(
  matches: MatchLike[],
  now: Date = new Date()
): boolean {
  return matches.some((m) => {
    if (isLiveStatus(m.status) || isFinishedStatus(m.status)) return true;
    if (m.status === "SUSPENDED" || m.status === "CANCELLED") return true;
    if (m.status === "POSTPONED") return false;
    // SCHEDULED com kickoff no passado = bola rolando, provedor ainda não atualizou.
    return new Date(m.kickoff).getTime() <= now.getTime();
  });
}

/** Janela "ontem → amanhã" em UTC, usada pelo sync incremental */
export function syncWindow(now: Date = new Date()): { dateFrom: string; dateTo: string } {
  const day = 24 * 60 * 60 * 1000;
  const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);
  return {
    dateFrom: toIsoDate(new Date(now.getTime() - day)),
    // +2 dias para cobrir "amanhã" inteiro mesmo se a API tratar dateTo como exclusivo
    dateTo: toIsoDate(new Date(now.getTime() + 2 * day)),
  };
}
