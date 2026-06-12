// Lista de jogos com filtros por fase, grupo e status (chips server-rendered).
// Protegida pelo middleware; a sessão é usada para carregar os palpites do usuário.

import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { LiveRefresh } from "@/components/live-refresh";
import { LocalTime } from "@/components/local-time";
import { MatchCard } from "@/components/match-card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { STAGE_LABELS, dayKey } from "@/lib/format";
import {
  GROUP_LETTERS,
  getUserPredictionsMap,
  listMatches,
  type MatchFilters,
} from "@/lib/queries";
import type { MatchDTO, Stage } from "@/lib/types";

export const metadata = { title: "Jogos" };

// ── Filtros válidos ──────────────────────────────────────────────────────────

const STAGES: readonly Stage[] = [
  "GROUP",
  "ROUND_32",
  "ROUND_16",
  "QUARTER",
  "SEMI",
  "THIRD_PLACE",
  "FINAL",
];

const STATUS_OPTIONS = [
  { param: "abertos", label: "Abertos", query: "open" },
  { param: "aovivo", label: "Ao vivo", query: "live" },
  { param: "encerrados", label: "Encerrados", query: "finished" },
] as const;

type StatusOption = (typeof STATUS_OPTIONS)[number];
type GroupLetter = (typeof GROUP_LETTERS)[number];

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseStage(value: string | undefined): Stage | undefined {
  return value !== undefined && (STAGES as readonly string[]).includes(value)
    ? (value as Stage)
    : undefined;
}

function parseGroup(value: string | undefined): GroupLetter | undefined {
  return value !== undefined && (GROUP_LETTERS as readonly string[]).includes(value)
    ? (value as GroupLetter)
    : undefined;
}

function parseStatus(value: string | undefined): StatusOption | undefined {
  return STATUS_OPTIONS.find((option) => option.param === value);
}

// ── Construção dos hrefs preservando os demais filtros ──────────────────────

interface ActiveFilters {
  fase?: Stage;
  grupo?: GroupLetter;
  status?: StatusOption["param"];
}

function buildHref(filters: ActiveFilters): string {
  const params = new URLSearchParams();
  if (filters.fase) params.set("fase", filters.fase);
  if (filters.grupo) params.set("grupo", filters.grupo);
  if (filters.status) params.set("status", filters.status);
  const qs = params.toString();
  return qs ? `/jogos?${qs}` : "/jogos";
}

// ── UI dos chips ─────────────────────────────────────────────────────────────

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-field-700 bg-field-700 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-field-400 hover:text-field-800"
      )}
    >
      {children}
    </Link>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="w-14 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </nav>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────

export default async function JogosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sp = await searchParams;
  const fase = parseStage(firstValue(sp.fase));
  const grupo = parseGroup(firstValue(sp.grupo));
  const statusOption = parseStatus(firstValue(sp.status));

  const filters: MatchFilters = {
    ...(fase ? { stage: fase } : {}),
    ...(grupo ? { group: grupo } : {}),
    ...(statusOption ? { status: statusOption.query } : {}),
  };

  const [matches, predictions] = await Promise.all([
    listMatches(filters),
    getUserPredictionsMap(session.user.id),
  ]);

  // Agrupa por dia no fuso de exibição (lista já vem ordenada por kickoff)
  const byDay = new Map<string, MatchDTO[]>();
  for (const match of matches) {
    const key = dayKey(match.kickoff);
    const list = byDay.get(key);
    if (list) {
      list.push(match);
    } else {
      byDay.set(key, [match]);
    }
  }

  const active: ActiveFilters = {
    ...(fase ? { fase } : {}),
    ...(grupo ? { grupo } : {}),
    ...(statusOption ? { status: statusOption.param } : {}),
  };

  return (
    <div className="space-y-6">
      <LiveRefresh />

      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Jogos</h1>
        <p className="text-sm text-slate-500" aria-live="polite">
          {matches.length === 1 ? "1 jogo" : `${matches.length} jogos`}
        </p>
      </header>

      <section
        aria-label="Filtros de jogos"
        className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
      >
        <FilterRow label="Fase">
          <FilterChip href={buildHref({ ...active, fase: undefined })} active={!fase}>
            Todas
          </FilterChip>
          {STAGES.map((stage) => (
            <FilterChip
              key={stage}
              href={buildHref({ ...active, fase: stage })}
              active={fase === stage}
            >
              {STAGE_LABELS[stage]}
            </FilterChip>
          ))}
        </FilterRow>

        <FilterRow label="Grupo">
          <FilterChip href={buildHref({ ...active, grupo: undefined })} active={!grupo}>
            Todos
          </FilterChip>
          {GROUP_LETTERS.map((letter) => (
            <FilterChip
              key={letter}
              href={buildHref({ ...active, grupo: letter })}
              active={grupo === letter}
            >
              {letter}
            </FilterChip>
          ))}
        </FilterRow>

        <FilterRow label="Status">
          <FilterChip
            href={buildHref({ ...active, status: undefined })}
            active={!statusOption}
          >
            Todos
          </FilterChip>
          {STATUS_OPTIONS.map((option) => (
            <FilterChip
              key={option.param}
              href={buildHref({ ...active, status: option.param })}
              active={statusOption?.param === option.param}
            >
              {option.label}
            </FilterChip>
          ))}
        </FilterRow>
      </section>

      {matches.length === 0 ? (
        <EmptyState
          title="Nenhum jogo encontrado"
          description="Nenhum jogo corresponde aos filtros selecionados. Ajuste os filtros ou limpe-os para ver todos os jogos."
          action={
            <Link
              href="/jogos"
              className="text-sm font-semibold text-field-700 underline-offset-2 hover:underline"
            >
              Limpar filtros
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {Array.from(byDay.entries()).map(([key, dayMatches]) => {
            const first = dayMatches[0];
            if (!first) return null;
            return (
              <section key={key} aria-label={`Jogos do dia ${key}`} className="space-y-2">
                <h2 className="text-sm font-semibold capitalize text-slate-600">
                  <LocalTime iso={first.kickoff} mode="day-heading" />
                </h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {dayMatches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      prediction={predictions.get(match.id) ?? null}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
