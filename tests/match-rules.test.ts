// Testes das regras de estado do jogo — trava de palpite (sempre UTC),
// visibilidade anti-cópia e janela de sincronização.

import { describe, expect, it } from "vitest";
import {
  arePredictionsVisible,
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

  it("palpites visíveis a partir do kickoff", () => {
    expect(
      arePredictionsVisible({ kickoff: KICKOFF, status: "IN_PLAY" }, KICKOFF)
    ).toBe(true);
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
