// ─────────────────────────────────────────────────────────────────────────────
// Configuração central do bolão.
// Todos os valores de pontuação vivem aqui — ajuste apenas neste arquivo.
// ─────────────────────────────────────────────────────────────────────────────

export const SCORING = {
  /** Placar exato do tempo regulamentar */
  EXACT: 10,
  /** Acertou o resultado (vencedor ou empate) + nº de gols de um dos times */
  RESULT_AND_ONE_SCORE: 7,
  /** Acertou apenas o resultado */
  RESULT_ONLY: 5,
  /** Errou o resultado, mas acertou os gols de um dos times */
  ONE_SCORE_ONLY: 2,
  /** Nenhum acerto */
  MISS: 0,
  /** Mata-mata: acertou quem avançou (vale prorrogação/pênaltis) */
  ADVANCING_BONUS: 3,
  /** Acertou o campeão — creditado ao final do torneio */
  CHAMPION_BONUS: 15,
} as const;

/** Fuso horário padrão para exibição (o servidor sempre compara em UTC) */
export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/** Limite de gols aceito num palpite (sanidade do formulário) */
export const MAX_GOALS = 30;

/** Football-Data.org — Copa do Mundo FIFA */
export const COMPETITION = {
  id: 2000,
  code: "WC",
} as const;

export const APP_NAME = "Bolão da Copa 2026";
