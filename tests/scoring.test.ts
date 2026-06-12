// Testes da lógica de pontuação — todos os cenários da tabela de regras,
// incluindo mata-mata, empates e inferência do classificado.

import { describe, expect, it } from "vitest";
import { SCORING } from "@/lib/config";
import {
  baseMatchPoints,
  outcomeOf,
  predictedAdvancingTeamId,
  scorePrediction,
} from "@/lib/scoring";

const HOME = "team-home";
const AWAY = "team-away";

describe("outcomeOf", () => {
  it("identifica vitória do mandante", () => {
    expect(outcomeOf(2, 1)).toBe("HOME");
  });
  it("identifica vitória do visitante", () => {
    expect(outcomeOf(0, 3)).toBe("AWAY");
  });
  it("identifica empate", () => {
    expect(outcomeOf(1, 1)).toBe("DRAW");
  });
});

describe("baseMatchPoints — tabela de pontuação", () => {
  it("placar exato vale 10", () => {
    expect(baseMatchPoints({ homeScore: 2, awayScore: 1 }, { homeScore: 2, awayScore: 1 })).toBe(
      SCORING.EXACT
    );
  });

  it("empate exato vale 10", () => {
    expect(baseMatchPoints({ homeScore: 0, awayScore: 0 }, { homeScore: 0, awayScore: 0 })).toBe(
      SCORING.EXACT
    );
  });

  it("resultado certo + gols de um dos times vale 7", () => {
    // Palpite 2x1, resultado 2x0 → vencedor certo, gols do mandante certos
    expect(baseMatchPoints({ homeScore: 2, awayScore: 1 }, { homeScore: 2, awayScore: 0 })).toBe(
      SCORING.RESULT_AND_ONE_SCORE
    );
    // Palpite 3x1, resultado 2x1 → vencedor certo, gols do visitante certos
    expect(baseMatchPoints({ homeScore: 3, awayScore: 1 }, { homeScore: 2, awayScore: 1 })).toBe(
      SCORING.RESULT_AND_ONE_SCORE
    );
  });

  it("apenas o resultado certo vale 5", () => {
    // Palpite 3x1, resultado 2x0 → vencedor certo, nenhum placar individual
    expect(baseMatchPoints({ homeScore: 3, awayScore: 1 }, { homeScore: 2, awayScore: 0 })).toBe(
      SCORING.RESULT_ONLY
    );
    // Empate previsto e ocorrido, placares diferentes: 1x1 contra 2x2
    expect(baseMatchPoints({ homeScore: 1, awayScore: 1 }, { homeScore: 2, awayScore: 2 })).toBe(
      SCORING.RESULT_ONLY
    );
  });

  it("resultado errado mas gols de um time certos vale 2", () => {
    // Palpite 2x0 (casa), resultado 2x3 (fora) → acertou os gols do mandante
    expect(baseMatchPoints({ homeScore: 2, awayScore: 0 }, { homeScore: 2, awayScore: 3 })).toBe(
      SCORING.ONE_SCORE_ONLY
    );
    // Palpite 0x1 (fora), resultado 1x1 (empate) → acertou os gols do visitante
    expect(baseMatchPoints({ homeScore: 0, awayScore: 1 }, { homeScore: 1, awayScore: 1 })).toBe(
      SCORING.ONE_SCORE_ONLY
    );
  });

  it("nenhum acerto vale 0", () => {
    expect(baseMatchPoints({ homeScore: 2, awayScore: 0 }, { homeScore: 0, awayScore: 1 })).toBe(
      SCORING.MISS
    );
    // Empate previsto, vitória ocorrida, sem placar individual: 1x1 contra 2x0
    expect(baseMatchPoints({ homeScore: 1, awayScore: 1 }, { homeScore: 2, awayScore: 0 })).toBe(
      SCORING.MISS
    );
  });
});

describe("predictedAdvancingTeamId — inferência do classificado", () => {
  it("vitória do mandante no palpite → mandante avança", () => {
    expect(
      predictedAdvancingTeamId({ homeScore: 2, awayScore: 1 }, HOME, AWAY)
    ).toBe(HOME);
  });

  it("vitória do visitante no palpite → visitante avança", () => {
    expect(
      predictedAdvancingTeamId({ homeScore: 0, awayScore: 1 }, HOME, AWAY)
    ).toBe(AWAY);
  });

  it("empate no palpite → usa o time escolhido pelo usuário", () => {
    expect(
      predictedAdvancingTeamId(
        { homeScore: 1, awayScore: 1, advancingTeamId: AWAY },
        HOME,
        AWAY
      )
    ).toBe(AWAY);
  });

  it("empate sem escolha explícita → null (palpite incompleto)", () => {
    expect(
      predictedAdvancingTeamId({ homeScore: 0, awayScore: 0 }, HOME, AWAY)
    ).toBeNull();
  });
});

describe("scorePrediction — fase de grupos (sem bônus)", () => {
  it("placar exato: 10, sem bônus", () => {
    const r = scorePrediction({ homeScore: 1, awayScore: 0 }, { homeScore: 1, awayScore: 0 });
    expect(r).toEqual({
      base: SCORING.EXACT,
      advancingBonus: 0,
      total: SCORING.EXACT,
      exact: true,
      correctResult: true,
    });
  });

  it("contexto de mata-mata nulo não gera bônus", () => {
    const r = scorePrediction(
      { homeScore: 2, awayScore: 0 },
      { homeScore: 2, awayScore: 0 },
      null
    );
    expect(r.total).toBe(SCORING.EXACT);
    expect(r.advancingBonus).toBe(0);
  });
});

describe("scorePrediction — mata-mata (bônus de classificado)", () => {
  const knockout = (advancingTeamId: string | null) => ({
    homeTeamId: HOME,
    awayTeamId: AWAY,
    advancingTeamId,
  });

  it("placar exato + classificado certo: 10 + 3 = 13", () => {
    const r = scorePrediction(
      { homeScore: 2, awayScore: 1 },
      { homeScore: 2, awayScore: 1 },
      knockout(HOME)
    );
    expect(r.base).toBe(SCORING.EXACT);
    expect(r.advancingBonus).toBe(SCORING.ADVANCING_BONUS);
    expect(r.total).toBe(SCORING.EXACT + SCORING.ADVANCING_BONUS);
  });

  it("placar errado mas classificado certo (decidido nos pênaltis): 0 + 3", () => {
    // Palpite 2x1 (casa avança); jogo terminou 0x0 e a casa avançou nos pênaltis
    const r = scorePrediction(
      { homeScore: 2, awayScore: 1 },
      { homeScore: 0, awayScore: 0 },
      knockout(HOME)
    );
    expect(r.base).toBe(SCORING.MISS);
    expect(r.advancingBonus).toBe(SCORING.ADVANCING_BONUS);
    expect(r.total).toBe(SCORING.ADVANCING_BONUS);
  });

  it("palpite de empate com escolha certa do classificado: 10 + 3", () => {
    // Palpite 1x1 escolhendo o visitante; jogo 1x1 e o visitante avançou
    const r = scorePrediction(
      { homeScore: 1, awayScore: 1, advancingTeamId: AWAY },
      { homeScore: 1, awayScore: 1 },
      knockout(AWAY)
    );
    expect(r.base).toBe(SCORING.EXACT);
    expect(r.advancingBonus).toBe(SCORING.ADVANCING_BONUS);
    expect(r.total).toBe(13);
  });

  it("palpite de empate com escolha errada do classificado: exato mas sem bônus", () => {
    const r = scorePrediction(
      { homeScore: 1, awayScore: 1, advancingTeamId: HOME },
      { homeScore: 1, awayScore: 1 },
      knockout(AWAY)
    );
    expect(r.base).toBe(SCORING.EXACT);
    expect(r.advancingBonus).toBe(0);
    expect(r.total).toBe(SCORING.EXACT);
  });

  it("palpite de empate sem escolha do classificado: nunca ganha bônus", () => {
    const r = scorePrediction(
      { homeScore: 0, awayScore: 0 },
      { homeScore: 0, awayScore: 0 },
      knockout(HOME)
    );
    expect(r.advancingBonus).toBe(0);
    expect(r.total).toBe(SCORING.EXACT);
  });

  it("vencedor previsto no placar errado e classificado errado: só pontos do placar", () => {
    // Palpite 2x0 (casa); jogo 1x2 (visitante avançou no tempo normal)
    const r = scorePrediction(
      { homeScore: 2, awayScore: 0 },
      { homeScore: 1, awayScore: 2 },
      knockout(AWAY)
    );
    expect(r.base).toBe(SCORING.MISS);
    expect(r.advancingBonus).toBe(0);
    expect(r.total).toBe(0);
  });

  it("resultado certo + um placar + classificado certo: 7 + 3 = 10", () => {
    const r = scorePrediction(
      { homeScore: 2, awayScore: 1 },
      { homeScore: 2, awayScore: 0 },
      knockout(HOME)
    );
    expect(r.total).toBe(SCORING.RESULT_AND_ONE_SCORE + SCORING.ADVANCING_BONUS);
  });

  it("classificado ainda não definido (advancingTeamId null): sem bônus", () => {
    const r = scorePrediction(
      { homeScore: 1, awayScore: 0 },
      { homeScore: 1, awayScore: 0 },
      knockout(null)
    );
    expect(r.advancingBonus).toBe(0);
  });

  it("empate no tempo normal: quem previu vitória do classificado leva o bônus", () => {
    // Jogo 1x1, casa avança na prorrogação. Palpite 2x1 (casa) → 5 do resultado? Não:
    // resultado real é EMPATE, palpite é vitória → resultado errado.
    // Acertou gols do visitante (1) → 2 pts + 3 de bônus = 5.
    const r = scorePrediction(
      { homeScore: 2, awayScore: 1 },
      { homeScore: 1, awayScore: 1 },
      knockout(HOME)
    );
    expect(r.base).toBe(SCORING.ONE_SCORE_ONLY);
    expect(r.advancingBonus).toBe(SCORING.ADVANCING_BONUS);
    expect(r.total).toBe(SCORING.ONE_SCORE_ONLY + SCORING.ADVANCING_BONUS);
  });
});
