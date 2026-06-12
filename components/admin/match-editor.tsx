"use client";

// Editor manual de resultado — resiliência para quando a API externa falha.
// O admin escolhe o jogo, informa placar e status; em mata-mata empatado
// e finalizado, informa quem avançou (prorrogação/pênaltis).

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError, FormSuccess, Label } from "@/components/ui/input";
import { updateMatchAction } from "@/lib/actions/admin";
import { cn } from "@/lib/cn";
import { MAX_GOALS } from "@/lib/config";
import { STATUS_LABELS } from "@/lib/format";
import type { MatchStatus, Stage } from "@/lib/types";

export interface AdminMatch {
  id: string;
  externalId: number;
  /** Ex.: "Grupo A · BRA × MEX · 11/06" */
  label: string;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  stage: Stage;
  homeTeamId: string | null;
  homeTeamName: string | null;
  awayTeamId: string | null;
  awayTeamName: string | null;
}

const STATUS_OPTIONS = [
  "SCHEDULED",
  "IN_PLAY",
  "PAUSED",
  "FINISHED",
  "SUSPENDED",
  "POSTPONED",
  "CANCELLED",
  "AWARDED",
] as const satisfies readonly MatchStatus[];

type Feedback =
  | { kind: "idle" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export function MatchEditor({ matches }: { matches: AdminMatch[] }) {
  const [selectedId, setSelectedId] = useState("");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [status, setStatus] = useState<MatchStatus>("SCHEDULED");
  const [advancing, setAdvancing] = useState("");
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  const selected = matches.find((m) => m.id === selectedId) ?? null;

  function handleSelect(id: string) {
    setSelectedId(id);
    setFeedback({ kind: "idle" });
    setAdvancing("");
    const match = matches.find((m) => m.id === id);
    if (match) {
      setHome(match.homeScore != null ? String(match.homeScore) : "");
      setAway(match.awayScore != null ? String(match.awayScore) : "");
      setStatus(match.status);
    } else {
      setHome("");
      setAway("");
      setStatus("SCHEDULED");
    }
  }

  const homeNum = home === "" ? null : Number(home);
  const awayNum = away === "" ? null : Number(away);
  const isFinishedChoice = status === "FINISHED" || status === "AWARDED";
  const isDraw = homeNum != null && awayNum != null && homeNum === awayNum;
  const needsAdvancing =
    selected != null &&
    selected.stage !== "GROUP" &&
    isDraw &&
    isFinishedChoice;
  const canChooseAdvancing =
    selected != null &&
    selected.homeTeamId != null &&
    selected.awayTeamId != null;

  function handleSave() {
    if (!selected) return;
    setFeedback({ kind: "idle" });
    startTransition(async () => {
      const result = await updateMatchAction({
        matchId: selected.id,
        status,
        homeScore: homeNum,
        awayScore: awayNum,
        advancingTeamId: needsAdvancing && advancing !== "" ? advancing : null,
      });
      if (result.ok) {
        setFeedback({ kind: "success" });
      } else {
        setFeedback({ kind: "error", message: result.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="Editar resultado"
        subtitle="Edição manual para quando a API externa falhar"
      />
      <CardBody>
        <Label htmlFor="admin-match-select">Jogo</Label>
        <select
          id="admin-match-select"
          value={selectedId}
          onChange={(e) => handleSelect(e.target.value)}
          className={cn(
            "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900",
            "focus:border-field-600 focus:outline-2 focus:outline-field-600/30"
          )}
        >
          <option value="">Selecione um jogo…</option>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>

        {selected ? (
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="admin-home-score">
                  Gols · {selected.homeTeamName ?? "Casa"}
                </Label>
                <ScoreField
                  id="admin-home-score"
                  value={home}
                  onChange={setHome}
                  disabled={isPending}
                />
              </div>
              <div>
                <Label htmlFor="admin-away-score">
                  Gols · {selected.awayTeamName ?? "Fora"}
                </Label>
                <ScoreField
                  id="admin-away-score"
                  value={away}
                  onChange={setAway}
                  disabled={isPending}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="admin-match-status">Status</Label>
              <select
                id="admin-match-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as MatchStatus)}
                disabled={isPending}
                className={cn(
                  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900",
                  "focus:border-field-600 focus:outline-2 focus:outline-field-600/30",
                  "disabled:cursor-not-allowed disabled:bg-slate-100"
                )}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            {needsAdvancing ? (
              canChooseAdvancing ? (
                <div>
                  <Label htmlFor="admin-advancing">Quem avançou?</Label>
                  <select
                    id="admin-advancing"
                    value={advancing}
                    onChange={(e) => setAdvancing(e.target.value)}
                    disabled={isPending}
                    className={cn(
                      "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900",
                      "focus:border-field-600 focus:outline-2 focus:outline-field-600/30",
                      "disabled:cursor-not-allowed disabled:bg-slate-100"
                    )}
                  >
                    <option value="">Selecione o classificado…</option>
                    <option value={selected.homeTeamId!}>
                      {selected.homeTeamName ?? "Time da casa"}
                    </option>
                    <option value={selected.awayTeamId!}>
                      {selected.awayTeamName ?? "Time visitante"}
                    </option>
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    Empate no mata-mata: informe quem se classificou
                    (prorrogação/pênaltis).
                  </p>
                </div>
              ) : (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Os dois times do confronto precisam estar definidos para
                  informar quem avançou.
                </p>
              )
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-amber-700">
                ⚠️ Finalizar um jogo repontua todos os palpites
                automaticamente.
              </p>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando…" : "Salvar resultado"}
              </Button>
            </div>

            {feedback.kind === "success" ? (
              <FormSuccess>Resultado salvo com sucesso.</FormSuccess>
            ) : null}
            {feedback.kind === "error" ? (
              <FormError>{feedback.message}</FormError>
            ) : null}
          </form>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            Selecione um jogo acima para editar placar e status.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function ScoreField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      min={0}
      max={MAX_GOALS}
      step={1}
      value={value}
      placeholder="–"
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "" || (/^\d{1,2}$/.test(v) && Number(v) <= MAX_GOALS)) {
          onChange(v);
        }
      }}
      className={cn(
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-sm font-bold tabular-nums text-slate-900",
        "focus:border-field-600 focus:outline-2 focus:outline-field-600/30",
        "disabled:cursor-not-allowed disabled:bg-slate-100"
      )}
    />
  );
}
