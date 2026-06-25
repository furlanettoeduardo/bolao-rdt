"use client";

// Trilha de auditoria (somente admin): lista paginada de todas as ações
// interativas, com filtro por categoria, busca textual e detalhes (metadata).
// A paginação/filtragem é server-side via a action getAuditLogPage.

import { Fragment, useCallback, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LocalTime } from "@/components/local-time";
import { getAuditLogPage } from "@/lib/actions/audit";
import {
  AUDIT_CATEGORIES,
  type AuditCategoryFilter,
  type AuditLogPage,
} from "@/lib/audit-query";

const CATEGORY_LABELS: Record<string, string> = {
  auth: "Autenticação",
  prediction: "Palpites",
  profile: "Perfil",
  admin: "Admin",
};

const CATEGORY_BADGE: Record<string, string> = {
  auth: "bg-amber-100 text-amber-800",
  prediction: "bg-field-100 text-field-800",
  profile: "bg-sky-100 text-sky-800",
  admin: "bg-violet-100 text-violet-800",
};

export function AuditLogPanel({ initial }: { initial: AuditLogPage }) {
  const [data, setData] = useState<AuditLogPage>(initial);
  const [category, setCategory] = useState<"" | AuditCategoryFilter>("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));

  const load = useCallback(
    (opts: { page?: number; category?: "" | AuditCategoryFilter; search?: string }) => {
      const page = opts.page ?? 0;
      const cat = opts.category ?? category;
      const q = opts.search ?? search;
      startTransition(async () => {
        const res = await getAuditLogPage({
          page,
          pageSize: data.pageSize,
          category: cat === "" ? null : cat,
          search: q.trim() || null,
        });
        if (res.ok && res.data) {
          setData(res.data);
          setError(null);
          setExpanded(null);
        } else if (!res.ok) {
          setError(res.error);
        }
      });
    },
    [category, search, data.pageSize]
  );

  return (
    <Card>
      <CardHeader
        title="Logs de auditoria"
        subtitle={`${data.total.toLocaleString("pt-BR")} registro(s) — todas as ações dos usuários`}
      />
      <CardBody>
        {/* Filtros */}
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            load({ page: 0 });
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Categoria
            <select
              value={category}
              onChange={(e) => {
                const value = e.target.value as "" | AuditCategoryFilter;
                setCategory(value);
                load({ page: 0, category: value });
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-field-600 focus:outline-2 focus:outline-field-600/30"
            >
              <option value="">Todas</option>
              {AUDIT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c] ?? c}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
            Busca
            <Input
              type="search"
              placeholder="resumo, nome, e-mail, IP, ação…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <Button type="submit" variant="outline" size="sm" disabled={isPending}>
            {isPending ? "Buscando…" : "Buscar"}
          </Button>
        </form>

        {error ? (
          <p role="alert" className="mt-2 text-sm text-cup-red">
            {error}
          </p>
        ) : null}

        {/* Tabela */}
        {data.rows.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Nenhum registro para os filtros atuais.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Quando</th>
                  <th className="py-2 pr-3 font-semibold">Quem</th>
                  <th className="py-2 pr-3 font-semibold">IP</th>
                  <th className="py-2 pr-3 font-semibold">Categoria</th>
                  <th className="py-2 pr-3 font-semibold">Ação</th>
                  <th className="py-2 pr-3 font-semibold"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((row) => (
                  <Fragment key={row.id}>
                    <tr className={row.ok ? "" : "bg-red-50/60"}>
                      <td className="py-2 pr-3 align-top whitespace-nowrap text-xs text-slate-500">
                        <LocalTime iso={row.createdAt} mode="datetime" />
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <span className="block font-medium text-slate-800">
                          {row.actorName ?? "—"}
                        </span>
                        {row.actorEmail ? (
                          <span className="block text-xs text-slate-400">
                            {row.actorEmail}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <span className="font-mono text-xs text-slate-600">
                          {row.ip ?? "—"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${
                            CATEGORY_BADGE[row.category] ??
                            "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {CATEGORY_LABELS[row.category] ?? row.category}
                        </span>
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <span className="block text-slate-800">
                          {row.summary}
                        </span>
                        <span className="block font-mono text-[11px] text-slate-400">
                          {row.action}
                          {row.ok ? "" : " · falhou"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 align-top text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((id) => (id === row.id ? null : row.id))
                          }
                          className="text-xs font-medium text-field-700 hover:underline"
                        >
                          {expanded === row.id ? "Ocultar" : "Detalhes"}
                        </button>
                      </td>
                    </tr>
                    {expanded === row.id ? (
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="px-3 py-3">
                          <dl className="grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                            {row.targetLabel ? (
                              <div>
                                <dt className="inline font-semibold">Alvo: </dt>
                                <dd className="inline">
                                  {row.targetType
                                    ? `${row.targetType} · `
                                    : ""}
                                  {row.targetLabel}
                                </dd>
                              </div>
                            ) : null}
                            {row.targetId ? (
                              <div>
                                <dt className="inline font-semibold">ID: </dt>
                                <dd className="inline font-mono">
                                  {row.targetId}
                                </dd>
                              </div>
                            ) : null}
                            {row.userAgent ? (
                              <div className="sm:col-span-2">
                                <dt className="inline font-semibold">
                                  User-agent:{" "}
                                </dt>
                                <dd className="inline break-all">
                                  {row.userAgent}
                                </dd>
                              </div>
                            ) : null}
                          </dl>
                          {row.metadata != null ? (
                            <pre className="mt-2 overflow-x-auto rounded bg-slate-900/90 p-2 text-[11px] leading-relaxed text-slate-100">
                              {JSON.stringify(row.metadata, null, 2)}
                            </pre>
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => load({ page: Math.max(0, data.page - 1) })}
            disabled={isPending || data.page <= 0}
          >
            ← Recentes
          </Button>
          <span className="text-xs tabular-nums text-slate-500">
            Página {data.page + 1} de {pageCount}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              load({ page: Math.min(pageCount - 1, data.page + 1) })
            }
            disabled={isPending || data.page >= pageCount - 1}
          >
            Antigas →
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
