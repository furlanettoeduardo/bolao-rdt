// Testes das regras de estado do jogo — trava de palpite (sempre UTC),
// visibilidade anti-cópia e janela de sincronização.

import { describe, expect, it } from "vitest";
import {
  arePredictionsVisible,
  hasKnockoutStarted,
  isFinishedStatus,
  isKnockoutStage,
  isLiveStatus,
  isMatchLocked,
  syncWindow,
} from "@/lib/match-rules";

const KICKOFF = new Date("2026-06-11T19:00:00.000Z");

describe("isMatchLocked — trava no kickoff (UTC)", () => {
  it("aberto antes do kickoff", () => {
    expect(
      isMatchLocked(
        { kickoff: KICKOFF, status: "SCHEDULED" },
        new Date("2026-06-11T18:59:59.999Z")
      )
    ).toBe(false);
  });

  it("trava exatamente no horário do jogo", () => {
    expect(
      isMatchLocked({ kickoff: KICKOFF, status: "SCHEDULED" }, KICKOFF)
    ).toBe(true);
  });

  it("trava depois do kickoff mesmo com status ainda SCHEDULED", () => {
    expect(
      isMatchLocked(
        { kickoff: KICKOFF, status: "SCHEDULED" },
        new Date("2026-06-11T19:00:01.000Z")
      )
    ).toBe(true);
  });

  it("trava assim que o jogo está ao vivo, independente do relógio", () => {
    expect(
      isMatchLocked(
        { kickoff: KICKOFF, status: "IN_PLAY" },
        new Date("2026-06-11T00:00:00.000Z")
      )
    ).toBe(true);
    expect(
      isMatchLocked(
        { kickoff: KICKOFF, status: "PAUSED" },
        new Date("2026-06-11T00:00:00.000Z")
      )
    ).toBe(true);
  });

  it("jogo finalizado está sempre travado", () => {
    expect(
      isMatchLocked(
        { kickoff: KICKOFF, status: "FINISHED" },
        new Date("2026-06-01T00:00:00.000Z")
      )
    ).toBe(true);
  });

  it("jogo suspenso fica travado", () => {
    expect(
      isMatchLocked(
        { kickoff: KICKOFF, status: "SUSPENDED" },
        new Date("2026-06-01T00:00:00.000Z")
      )
    ).toBe(true);
  });

  it("jogo cancelado fica travado mesmo com kickoff futuro", () => {
    expect(
      isMatchLocked(
        { kickoff: KICKOFF, status: "CANCELLED" },
        new Date("2026-06-01T00:00:00.000Z")
      )
    ).toBe(true);
  });

  it("jogo adiado reabre quando o sync grava o novo horário futuro", () => {
    const newKickoff = new Date("2026-06-13T19:00:00.000Z");
    expect(
      isMatchLocked(
        { kickoff: newKickoff, status: "POSTPONED" },
        new Date("2026-06-12T10:00:00.000Z")
      )
    ).toBe(false);
  });

  it("aceita kickoff como string ISO", () => {
    expect(
      isMatchLocked(
        { kickoff: "2026-06-11T19:00:00.000Z", status: "SCHEDULED" },
        new Date("2026-06-11T20:00:00.000Z")
      )
    ).toBe(true);
  });
});

describe("arePredictionsVisible — anti-cópia", () => {
  it("palpites dos outros escondidos antes do jogo", () => {
    expect(
      arePredictionsVisible(
        { kickoff: KICKOFF, status: "SCHEDULED" },
        new Date("2026-06-11T12:00:00.000Z")
      )
    ).toBe(false);
  });

  it("palpites visíveis a partir do kickoff (jogo ao vivo)", () => {
    expect(
      arePredictionsVisible({ kickoff: KICKOFF, status: "IN_PLAY" }, KICKOFF)
    ).toBe(true);
  });

  it("palpites visíveis em jogo encerrado", () => {
    expect(
      arePredictionsVisible(
        { kickoff: KICKOFF, status: "FINISHED" },
        new Date("2026-06-12T00:00:00.000Z")
      )
    ).toBe(true);
  });

  it("SCHEDULED com kickoff no passado revela (bola rolando, sync atrasado)", () => {
    expect(
      arePredictionsVisible(
        { kickoff: KICKOFF, status: "SCHEDULED" },
        new Date("2026-06-11T19:05:00.000Z")
      )
    ).toBe(true);
  });

  // Anti-cópia: estados de limbo NÃO revelam, mesmo com kickoff no passado —
  // senão, revelar e depois reabrir para edição permitiria copiar palpites.
  it("jogo ADIADO não revela palpites mesmo com kickoff no passado", () => {
    expect(
      arePredictionsVisible(
        { kickoff: KICKOFF, status: "POSTPONED" },
        new Date("2026-06-11T19:05:00.000Z")
      )
    ).toBe(false);
  });

  it("jogo SUSPENSO antes do início não revela palpites", () => {
    expect(
      arePredictionsVisible(
        { kickoff: KICKOFF, status: "SUSPENDED" },
        new Date("2026-06-11T19:05:00.000Z")
      )
    ).toBe(false);
  });

  it("jogo CANCELADO não revela palpites", () => {
    expect(
      arePredictionsVisible(
        { kickoff: KICKOFF, status: "CANCELLED" },
        new Date("2026-06-11T19:05:00.000Z")
      )
    ).toBe(false);
  });
});

describe("status helpers", () => {
  it("FINISHED e AWARDED contam como finalizados", () => {
    expect(isFinishedStatus("FINISHED")).toBe(true);
    expect(isFinishedStatus("AWARDED")).toBe(true);
    expect(isFinishedStatus("IN_PLAY")).toBe(false);
  });

  it("IN_PLAY e PAUSED contam como ao vivo", () => {
    expect(isLiveStatus("IN_PLAY")).toBe(true);
    expect(isLiveStatus("PAUSED")).toBe(true);
    expect(isLiveStatus("FINISHED")).toBe(false);
  });

  it("toda fase exceto GROUP é mata-mata", () => {
    expect(isKnockoutStage("GROUP")).toBe(false);
    for (const stage of [
      "ROUND_32",
      "ROUND_16",
      "QUARTER",
      "SEMI",
      "THIRD_PLACE",
      "FINAL",
    ] as const) {
      expect(isKnockoutStage(stage)).toBe(true);
    }
  });
});

describe("hasKnockoutStarted — trava do palpite de campeão (robusta a adiamento)", () => {
  const NOW = new Date("2026-07-04T12:00:00.000Z");
  const FUTURE = new Date("2026-07-05T19:00:00.000Z");
  const PAST = new Date("2026-07-03T19:00:00.000Z");

  it("aberto quando não há nenhum jogo de mata-mata", () => {
    expect(hasKnockoutStarted([], NOW)).toBe(false);
  });

  it("aberto quando todos os confrontos são agendados no futuro", () => {
    expect(
      hasKnockoutStarted(
        [
          { kickoff: FUTURE, status: "SCHEDULED" },
          { kickoff: FUTURE, status: "SCHEDULED" },
        ],
        NOW
      )
    ).toBe(false);
  });

  it("fecha assim que qualquer confronto está ao vivo", () => {
    expect(
      hasKnockoutStarted(
        [
          { kickoff: FUTURE, status: "SCHEDULED" },
          { kickoff: PAST, status: "IN_PLAY" },
        ],
        NOW
      )
    ).toBe(true);
  });

  it("fecha quando um confronto já terminou", () => {
    expect(
      hasKnockoutStarted([{ kickoff: PAST, status: "FINISHED" }], NOW)
    ).toBe(true);
  });

  it("fecha com SCHEDULED de kickoff no passado (bola rolando, sync atrasado)", () => {
    expect(
      hasKnockoutStarted([{ kickoff: PAST, status: "SCHEDULED" }], NOW)
    ).toBe(true);
  });

  it("SUSPENDED/CANCELLED contam como começado", () => {
    expect(
      hasKnockoutStarted([{ kickoff: PAST, status: "SUSPENDED" }], NOW)
    ).toBe(true);
    expect(
      hasKnockoutStarted([{ kickoff: PAST, status: "CANCELLED" }], NOW)
    ).toBe(true);
  });

  // Regressão do achado: adiar o 1º jogo NÃO deve reabrir a janela se outro
  // confronto já começou; e um adiamento puro (sem nenhum jogo iniciado) não trava.
  it("adiamento de um confronto NÃO reabre se outro já está ao vivo", () => {
    expect(
      hasKnockoutStarted(
        [
          { kickoff: FUTURE, status: "POSTPONED" },
          { kickoff: PAST, status: "IN_PLAY" },
        ],
        NOW
      )
    ).toBe(true);
  });

  it("POSTPONED para o futuro, sem nenhum jogo iniciado, mantém aberto", () => {
    expect(
      hasKnockoutStarted(
        [
          { kickoff: FUTURE, status: "POSTPONED" },
          { kickoff: FUTURE, status: "SCHEDULED" },
        ],
        NOW
      )
    ).toBe(false);
  });
});

describe("syncWindow — janela ontem → amanhã em UTC", () => {
  it("calcula dateFrom = ontem e dateTo = depois de amanhã (dateTo exclusivo)", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    expect(syncWindow(now)).toEqual({
      dateFrom: "2026-06-14",
      dateTo: "2026-06-17",
    });
  });

  it("vira o dia corretamente perto da meia-noite UTC", () => {
    const now = new Date("2026-07-01T00:30:00.000Z");
    expect(syncWindow(now)).toEqual({
      dateFrom: "2026-06-30",
      dateTo: "2026-07-03",
    });
  });
});
