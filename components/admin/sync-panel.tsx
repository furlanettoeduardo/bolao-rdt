"use client";

// Painel de sincronização manual — dispara o sync com a API externa e
// lista as últimas execuções registradas no SyncLog.

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError, FormSuccess } from "@/components/ui/input";
import { LocalTime } from "@/components/local-time";
import { triggerSyncAction } from "@/lib/actions/admin";

export interface SyncLogDTO {
  id: string;
  /** ISO UTC */
  ranAt: string;
  ok: boolean;
  scope: string;
  message: string;
  durationMs: number | null;
}

type Feedback =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function formatDuration(durationMs: number | null): string {
  if (durationMs == null) return "–";
  return `${(durationMs / 1000).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} s`;
}

export function SyncPanel({ logs }: { logs: SyncLogDTO[] }) {
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  function handleSync() {
    setFeedback({ kind: "idle" });
    startTransition(async () => {
      const result = await triggerSyncAction();
      if (result.ok) {
        setFeedback({
          kind: "success",
          message: result.data?.message ?? "Sincronização concluída.",
        });
      } else {
        setFeedback({ kind: "error", message: result.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="Sincronização"
        subtitle="Busca placares e status na Football-Data.org"
        action={
          <Button size="sm" onClick={handleSync} disabled={isPending}>
            {isPending ? "Sincronizando…" : "Sincronizar agora"}
          </Button>
        }
      />
      <CardBody>
        {feedback.kind === "success" ? (
          <FormSuccess>{feedback.message}</FormSuccess>
        ) : null}
        {feedback.kind === "error" ? (
          <FormError>{feedback.message}</FormError>
        ) : null}

        <h3 className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Últimas execuções
        </h3>
        {logs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Nenhuma sincronização registrada ainda.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {logs.map((log) => (
              <li key={log.id} className="flex items-start gap-2 py-2 text-sm">
                {log.ok ? (
                  <span
                    aria-label="Sucesso"
                    role="img"
                    className="mt-0.5 font-bold text-field-600"
                  >
                    ✓
                  </span>
                ) : (
                  <span
                    aria-label="Falha"
                    role="img"
                    className="mt-0.5 font-bold text-cup-red"
                  >
                    ✗
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                    <LocalTime iso={log.ranAt} mode="datetime" />
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                      {log.scope}
                    </span>
                    <span className="tabular-nums">
                      {formatDuration(log.durationMs)}
                    </span>
                  </p>
                  <p
                    className="truncate text-sm text-slate-700"
                    title={log.message}
                  >
                    {log.message}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
          O sync automático roda via cron (Vercel diário + GitHub Actions a
          cada 5 min).
        </p>
      </CardBody>
    </Card>
  );
}
