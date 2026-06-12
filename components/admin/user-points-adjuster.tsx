"use client";

// Ajuste manual de pontos por usuário: o admin escolhe um participante e
// acrescenta (+) ou remove (−) pontos, com um motivo opcional. Cada lançamento
// vira um item no histórico (removível) e soma no total do ranking geral.

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError, FormSuccess, Label } from "@/components/ui/input";
import { LocalTime } from "@/components/local-time";
import {
  addUserAdjustment,
  adminListUserAdjustments,
  deleteUserAdjustment,
  type UserAdjustmentRow,
} from "@/lib/actions/admin";
import { cn } from "@/lib/cn";
import type { AdminUser } from "./users-table";

type Feedback =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

const controlClass = cn(
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900",
  "focus:border-field-600 focus:outline-2 focus:outline-field-600/30",
  "disabled:cursor-not-allowed disabled:bg-slate-100"
);

export function UserPointsAdjuster({ users }: { users: AdminUser[] }) {
  const [selectedId, setSelectedId] = useState("");
  const [rows, setRows] = useState<UserAdjustmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" });
  const [isLoading, startLoad] = useTransition();
  const [isSaving, startSave] = useTransition();

  function load(userId: string, silent = false) {
    // silent = recarregar após uma ação sem desmontar a lista (evita flicker)
    if (!silent) {
      setRows([]);
      setTotal(0);
      setLoaded(false);
    }
    startLoad(async () => {
      const result = await adminListUserAdjustments(userId);
      if (result.ok && result.data) {
        setRows(result.data.rows);
        setTotal(result.data.total);
        setLoaded(true);
      } else {
        setFeedback({
          kind: "error",
          message: result.ok ? "Sem dados." : result.error,
        });
      }
    });
  }

  function handleSelect(userId: string) {
    setSelectedId(userId);
    setAmount("");
    setReason("");
    setFeedback({ kind: "idle" });
    if (userId) load(userId);
    else {
      setRows([]);
      setTotal(0);
      setLoaded(false);
    }
  }

  function apply(sign: 1 | -1) {
    setFeedback({ kind: "idle" });
    const magnitude = Number(amount);
    if (!Number.isInteger(magnitude) || magnitude <= 0) {
      setFeedback({ kind: "error", message: "Informe um valor inteiro maior que zero." });
      return;
    }
    if (magnitude > 1000) {
      setFeedback({ kind: "error", message: "Use um valor entre 1 e 1000." });
      return;
    }
    const delta = sign * magnitude;
    startSave(async () => {
      const result = await addUserAdjustment({
        userId: selectedId,
        delta,
        reason: reason.trim() || undefined,
      });
      if (result.ok) {
        setFeedback({
          kind: "success",
          message: `${delta > 0 ? "+" : ""}${delta} ponto${
            Math.abs(delta) === 1 ? "" : "s"
          } lançado(s).`,
        });
        setAmount("");
        setReason("");
        load(selectedId, true);
      } else {
        setFeedback({ kind: "error", message: result.error });
      }
    });
  }

  function remove(id: string) {
    setFeedback({ kind: "idle" });
    startSave(async () => {
      const result = await deleteUserAdjustment(id);
      if (result.ok) {
        setFeedback({ kind: "success", message: "Lançamento removido." });
        load(selectedId, true);
      } else {
        setFeedback({ kind: "error", message: result.error });
      }
    });
  }

  const sortedUsers = [...users].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR")
  );
  const busy = isLoading || isSaving;

  return (
    <Card>
      <CardHeader
        title="Ajustar pontos por usuário"
        subtitle="Acrescente ou remova pontos de um participante (entra no ranking geral)"
      />
      <CardBody>
        <Label htmlFor="admin-adjust-user">Participante</Label>
        <select
          id="admin-adjust-user"
          value={selectedId}
          onChange={(e) => handleSelect(e.target.value)}
          disabled={busy}
          className={controlClass}
        >
          <option value="">Selecione um participante…</option>
          {sortedUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        {isLoading && !loaded ? (
          <p className="mt-3 text-sm text-slate-500">Carregando ajustes…</p>
        ) : null}

        {selectedId && loaded ? (
          <>
            <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-sm font-medium text-slate-600">
                Total de ajustes
              </span>
              <span
                className={cn(
                  "text-base font-bold tabular-nums",
                  total > 0
                    ? "text-field-700"
                    : total < 0
                      ? "text-cup-red"
                      : "text-slate-500"
                )}
              >
                {total > 0 ? "+" : ""}
                {total} pts
              </span>
            </div>

            <form
              className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                apply(1);
              }}
            >
              <div className="w-24 shrink-0">
                <Label htmlFor="admin-adjust-amount">Pontos</Label>
                <input
                  id="admin-adjust-amount"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1000}
                  step={1}
                  value={amount}
                  placeholder="0"
                  disabled={isSaving}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d{1,4}$/.test(v)) setAmount(v);
                  }}
                  className={cn(controlClass, "text-center font-bold tabular-nums")}
                />
              </div>
              <div className="min-w-0 flex-1">
                <Label htmlFor="admin-adjust-reason">Motivo (opcional)</Label>
                <input
                  id="admin-adjust-reason"
                  type="text"
                  maxLength={120}
                  value={reason}
                  placeholder="Ex.: acertou o pódio do bolão paralelo"
                  disabled={isSaving}
                  onChange={(e) => setReason(e.target.value)}
                  className={controlClass}
                />
              </div>
              <div className="flex shrink-0 gap-2">
                <Button type="submit" disabled={isSaving}>
                  + Acrescentar
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={isSaving}
                  onClick={() => apply(-1)}
                >
                  − Remover
                </Button>
              </div>
            </form>

            {feedback.kind === "success" ? (
              <div className="mt-2">
                <FormSuccess>{feedback.message}</FormSuccess>
              </div>
            ) : null}
            {feedback.kind === "error" ? (
              <div className="mt-2">
                <FormError>{feedback.message}</FormError>
              </div>
            ) : null}

            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Histórico de ajustes
            </h3>
            {rows.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                Nenhum ajuste lançado para este participante.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm">
                        <span
                          className={cn(
                            "font-bold tabular-nums",
                            row.delta >= 0 ? "text-field-700" : "text-cup-red"
                          )}
                        >
                          {row.delta > 0 ? "+" : ""}
                          {row.delta}
                        </span>
                        <span className="truncate text-slate-700">
                          {row.reason ?? (
                            <span className="italic text-slate-400">
                              sem motivo
                            </span>
                          )}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400">
                        <LocalTime iso={row.createdAt} mode="datetime" />
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isSaving}
                      onClick={() => remove(row.id)}
                      className="shrink-0 text-cup-red hover:bg-red-50"
                      aria-label="Remover lançamento"
                    >
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}

        {feedback.kind === "error" && !loaded ? (
          <div className="mt-3">
            <FormError>{feedback.message}</FormError>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
