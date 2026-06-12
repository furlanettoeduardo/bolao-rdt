"use client";

// Override manual de pontos por palpite. O admin escolhe um jogo, vê o palpite
// de cada participante (com os pontos automáticos) e pode fixar um valor. Vazio
// = volta ao cálculo automático. O valor fixado sobrevive a syncs e a edições
// de resultado.

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError, FormSuccess, Label } from "@/components/ui/input";
import {
  adminListMatchPredictions,
  setPredictionPointsBatch,
  type AdminPredictionRow,
} from "@/lib/actions/admin";
import { cn } from "@/lib/cn";
import type { AdminMatch } from "./match-editor";

type Feedback =
  | { kind: "idle" }
  | { kind: "success"; count: number }
  | { kind: "error"; message: string };

interface Row extends AdminPredictionRow {
  /** valor do input — "" significa "usar o automático" (sem override) */
  value: string;
}

const selectClass = cn(
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900",
  "focus:border-field-600 focus:outline-2 focus:outline-field-600/30",
  "disabled:cursor-not-allowed disabled:bg-slate-100"
);

export function PointsEditor({ matches }: { matches: AdminMatch[] }) {
  const [selectedId, setSelectedId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" });
  const [isLoading, startLoad] = useTransition();
  const [isSaving, startSave] = useTransition();

  const withPredictions = matches.filter((m) => m.predictionCount > 0);

  function handleSelect(id: string) {
    setSelectedId(id);
    setRows([]);
    setLoaded(false);
    setFeedback({ kind: "idle" });
    if (!id) return;
    startLoad(async () => {
      const result = await adminListMatchPredictions(id);
      if (result.ok && result.data) {
        setRows(
          result.data.map((r) => ({
            ...r,
            value: r.override != null ? String(r.override) : "",
          }))
        );
        setLoaded(true);
      } else {
        setFeedback({
          kind: "error",
          message: result.ok ? "Sem dados." : result.error,
        });
      }
    });
  }

  function setValue(predictionId: string, value: string) {
    if (value !== "" && !/^\d{1,3}$/.test(value)) return;
    setRows((prev) =>
      prev.map((r) => (r.predictionId === predictionId ? { ...r, value } : r))
    );
  }

  function handleSave() {
    setFeedback({ kind: "idle" });
    const updates = rows.map((r) => ({
      predictionId: r.predictionId,
      override: r.value === "" ? null : Number(r.value),
    }));
    startSave(async () => {
      const result = await setPredictionPointsBatch(updates);
      if (result.ok) {
        setFeedback({
          kind: "success",
          count: result.data?.updated ?? updates.length,
        });
        setRows((prev) =>
          prev.map((r) => ({
            ...r,
            override: r.value === "" ? null : Number(r.value),
          }))
        );
      } else {
        setFeedback({ kind: "error", message: result.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="Ajustar pontos dos palpites"
        subtitle="Sobrescreve os pontos de um palpite — fica fixo, não é recalculado"
      />
      <CardBody>
        <Label htmlFor="admin-points-match">Jogo</Label>
        <select
          id="admin-points-match"
          value={selectedId}
          onChange={(e) => handleSelect(e.target.value)}
          disabled={isLoading || isSaving}
          className={selectClass}
        >
          <option value="">Selecione um jogo…</option>
          {withPredictions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} ({m.predictionCount} palpite
              {m.predictionCount === 1 ? "" : "s"})
            </option>
          ))}
        </select>

        {withPredictions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Ainda não há jogos com palpites para ajustar.
          </p>
        ) : null}

        {isLoading ? (
          <p className="mt-3 text-sm text-slate-500">Carregando palpites…</p>
        ) : null}

        {loaded && rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Ninguém palpitou neste jogo.
          </p>
        ) : null}

        {loaded && rows.length > 0 ? (
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {rows.map((r) => {
                const overridden = r.value !== "";
                return (
                  <li
                    key={r.predictionId}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {r.userName}
                      </p>
                      <p className="text-xs text-slate-500">
                        Palpite {r.homeScore}×{r.awayScore} · auto:{" "}
                        {r.autoPoints ?? "—"}
                      </p>
                    </div>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      step={1}
                      value={r.value}
                      placeholder={
                        r.autoPoints != null ? String(r.autoPoints) : "auto"
                      }
                      aria-label={`Pontos de ${r.userName}`}
                      disabled={isSaving}
                      onChange={(e) => setValue(r.predictionId, e.target.value)}
                      className={cn(
                        "h-9 w-16 shrink-0 rounded-lg border px-2 text-center text-sm font-bold tabular-nums",
                        overridden
                          ? "border-field-500 bg-field-50 text-field-800"
                          : "border-slate-300 text-slate-900",
                        "focus:border-field-600 focus:outline-2 focus:outline-field-600/30",
                        "disabled:cursor-not-allowed disabled:bg-slate-100"
                      )}
                    />
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-slate-500">
              Deixe o campo <strong>vazio</strong> para usar o cálculo
              automático. Um valor fixa os pontos (sobrevive a syncs e à edição
              de resultado).
            </p>
            <div className="flex items-center justify-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Salvando…" : "Salvar pontos"}
              </Button>
            </div>
            {feedback.kind === "success" ? (
              <FormSuccess>
                Pontos atualizados ({feedback.count} palpite
                {feedback.count === 1 ? "" : "s"}).
              </FormSuccess>
            ) : null}
            {feedback.kind === "error" ? (
              <FormError>{feedback.message}</FormError>
            ) : null}
          </form>
        ) : null}

        {feedback.kind === "error" && !loaded ? (
          <FormError>{feedback.message}</FormError>
        ) : null}
      </CardBody>
    </Card>
  );
}
