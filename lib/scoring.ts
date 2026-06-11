// ─────────────────────────────────────────────────────────────────────────────
// Lógica de pontuação do bolão — funções puras, sem dependência de banco.
// Regras (valores em lib/config.ts):
//   Placar exato ............................................. 10 pts
//   Resultado certo + gols de um dos times ....................  7 pts
//   Apenas o resultado certo ..................................  5 pts
//   Resultado errado, mas gols de um dos times certos .........  2 pts
//   Nenhum acerto .............................................  0 pts
//   Mata-mata: acertou quem avançou (bônus, vale pênaltis) .... +3 pts
// A comparação usa SEMPRE o placar do tempo regulamentar (90 min).
// ─────────────────────────────────────────────────────────────────────────────

import { SCORING } from "./config";

export type Outcome = "HOME" | "AWAY" | "DRAW";

export interface PredictionLike {
  homeScore: number;
  awayScore: number;
  /** Escolhido pelo usuário quando o palpite é empate no mata-mata */
  advancingTeamId?: string | null;
}

export interface RegulationResult {
  homeScore: number;
  awayScore: number;
}

export interface KnockoutContext {
  homeTeamId: string | null;
  awayTeamId: string | null;
  /** Quem avançou de fato (90 min, prorrogação ou pênaltis) */
  advancingTeamId: string | null;
}

export interface PointsBreakdown {
  /** Pontos do placar (0, 2, 5, 7 ou 10) */
  base: number;
  /** Bônus por acertar quem avançou no mata-mata (0 ou 3) */
  advancingBonus: number;
  total: number;
  exact: boolean;
  correctResult: boolean;
}

export function outcomeOf(homeScore: number, awayScore: number): Outcome {
  if (homeScore > awayScore) return "HOME";
  if (homeScore < awayScore) return "AWAY";
  return "DRAW";
}

/**
 * Time que o palpite indica como classificado num jogo de mata-mata.
 * Placar com vencedor → inferido do próprio placar.
 * Placar empatado → o time escolhido explicitamente pelo usuário.
 */
export function predictedAdvancingTeamId(
  prediction: PredictionLike,
  homeTeamId: string | null,
  awayTeamId: string | null
): string | null {
  const outcome = outcomeOf(prediction.homeScore, prediction.awayScore);
  if (outcome === "HOME") return homeTeamId;
  if (outcome === "AWAY") return awayTeamId;
  return prediction.advancingTeamId ?? null;
}

/** Pontos do placar (sem bônus de mata-mata). */
export function baseMatchPoints(
  prediction: RegulationResult,
  result: RegulationResult
): number {
  const exact =
    prediction.homeScore === result.homeScore &&
    prediction.awayScore === result.awayScore;
  const sameOutcome =
    outcomeOf(prediction.homeScore, prediction.awayScore) ===
    outcomeOf(result.homeScore, result.awayScore);
  const oneScoreRight =
    prediction.homeScore === result.homeScore ||
    prediction.awayScore === result.awayScore;

  if (exact) return SCORING.EXACT;
  if (sameOutcome && oneScoreRight) return SCORING.RESULT_AND_ONE_SCORE;
  if (sameOutcome) return SCORING.RESULT_ONLY;
  if (oneScoreRight) return SCORING.ONE_SCORE_ONLY;
  return SCORING.MISS;
}

/**
 * Pontuação completa de um palpite contra o resultado do tempo regulamentar.
 * Para jogos de mata-mata, passe o contexto (`knockout`) para aplicar o bônus
 * de classificado — válido mesmo quando a vaga foi decidida nos pênaltis.
 */
export function scorePrediction(
  prediction: PredictionLike,
  result: RegulationResult,
  knockout?: KnockoutContext | null
): PointsBreakdown {
  const base = baseMatchPoints(prediction, result);
  const exact =
    prediction.homeScore === result.homeScore &&
    prediction.awayScore === result.awayScore;
  const correctResult =
    outcomeOf(prediction.homeScore, prediction.awayScore) ===
    outcomeOf(result.homeScore, result.awayScore);

  let advancingBonus = 0;
  if (knockout && knockout.advancingTeamId) {
    const predicted = predictedAdvancingTeamId(
      prediction,
      knockout.homeTeamId,
      knockout.awayTeamId
    );
    if (predicted !== null && predicted === knockout.advancingTeamId) {
      advancingBonus = SCORING.ADVANCING_BONUS;
    }
  }

  return {
    base,
    advancingBonus,
    total: base + advancingBonus,
    exact,
    correctResult,
  };
}
