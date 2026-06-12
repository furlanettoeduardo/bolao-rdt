// Página central do bolão — formulário de palpites agrupado por dia.
// Server Component: a trava de cada jogo é calculada AQUI (UTC, relógio do
// servidor) e passada como prop para o PredictionCard (client).

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LiveRefresh } from "@/components/live-refresh";
import { LocalTime } from "@/components/local-time";
import { PredictionCard } from "@/components/prediction/prediction-card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { dayKey } from "@/lib/format";
import { isFinishedStatus, isMatchLocked } from "@/lib/match-rules";
import { getUserPredictionsMap, listMatches } from "@/lib/queries";
import type { MatchDTO } from "@/lib/types";

export const metadata = { title: "Palpites" };

const FILTERS = [
  { key: "abertos", label: "Abertos" },
  { key: "todos", label: "Todos" },
  { key: "encerrados", label: "Encerrados" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function parseFilter(raw: string | string[] | undefined): FilterKey {
  return raw === "todos" || raw === "encerrados" ? raw : "abertos";
}

const EMPTY_MESSAGES: Record<FilterKey, { title: string; description: string }> = {
  abertos: {
    title: "Nenhum jogo aberto para palpite",
    description:
      "Todos os jogos disponíveis já começaram ou terminaram. Confira seus acertos na aba Encerrados.",
  },
  todos: {
    title: "Nenhum jogo cadastrado",
    description:
      "A tabela da Copa ainda não foi sincronizada. Volte em breve para registrar seus palpites.",
  },
  encerrados: {
    title: "Nenhum jogo encerrado ainda",
    description:
      "Assim que os primeiros jogos terminarem, eles aparecem aqui com a sua pontuação.",
  },
};

export default async function PalpitesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, sp] = await Promise.all([auth(), searchParams]);
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const exibir = parseFilter(sp.exibir);

  const [matches, predictions] = await Promise.all([
    listMatches(),
    getUserPredictionsMap(userId),
  ]);

  // Um único "agora" para toda a renderização — trava consistente entre cards
  const now = new Date();

  const pendingCount = matches.filter(
    (m) => !isMatchLocked(m, now) && !predictions.has(m.id)
  ).length;

  const counts: Record<FilterKey, number> = {
    abertos: matches.filter((m) => !isFinishedStatus(m.status)).length,
    todos: matches.length,
    encerrados: matches.filter((m) => isFinishedStatus(m.status)).length,
  };

  const filtered = matches.filter((m) => {
    if (exibir === "encerrados") return isFinishedStatus(m.status);
    if (exibir === "abertos") return !isFinishedStatus(m.status);
    return true;
  });

  // Agrupa por dia (fuso de exibição); listMatches já vem por kickoff asc,
  // então a ordem de inserção dos dias é cronológica.
  const byDay = new Map<string, MatchDTO[]>();
  for (const match of filtered) {
    const key = dayKey(match.kickoff);
    const group = byDay.get(key);
    if (group) {
      group.push(match);
    } else {
      byDay.set(key, [match]);
    }
  }
  for (const group of byDay.values()) {
    group.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-field-900">Palpites</h1>
        <p className="mt-1 text-sm text-slate-500">
          Registre seu placar para cada jogo até o apito inicial.
        </p>
      </header>

      {pendingCount > 0 ? (
        <p
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800"
        >
          <span aria-hidden>⏳</span>{" "}
          {pendingCount === 1
            ? "1 palpite pendente"
            : `${pendingCount} palpites pendentes`}{" "}
          — preencha antes do início dos jogos!
        </p>
      ) : (
        <p
          role="status"
          className="rounded-xl border border-field-200 bg-field-50 px-4 py-3 text-sm font-medium text-field-800"
        >
          <span aria-hidden>✅</span> Nenhum palpite pendente — você está em dia!
        </p>
      )}

      <nav aria-label="Filtrar jogos" className="flex flex-wrap gap-2">
        {FILTERS.map(({ key, label }) => {
          const active = exibir === key;
          return (
            <Link
              key={key}
              href={`/palpites?exibir=${key}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
                active
                  ? "border-field-700 bg-field-700 text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:border-field-400 hover:text-field-700"
              )}
            >
              {label}
              <span
                className={cn(
                  "text-xs font-bold tabular-nums",
                  active ? "text-field-100" : "text-slate-400"
                )}
              >
                {counts[key]}
              </span>
            </Link>
          );
        })}
      </nav>

      {filtered.length === 0 ? (
        <EmptyState
          title={EMPTY_MESSAGES[exibir].title}
          description={EMPTY_MESSAGES[exibir].description}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {[...byDay.entries()].map(([key, dayMatches]) => {
            const first = dayMatches[0];
            if (!first) return null;
            return (
              <section key={key} className="flex flex-col gap-3">
                <h2 className="flex items-center gap-3 text-sm font-bold uppercase tracking-wide text-field-800">
                  <LocalTime
                    iso={first.kickoff}
                    mode="day-heading"
                    className="capitalize"
                  />
                  <span
                    aria-hidden
                    className="h-px flex-1 bg-slate-200"
                  />
                </h2>
                {dayMatches.map((match) => (
                  <PredictionCard
                    key={match.id}
                    match={match}
                    prediction={predictions.get(match.id) ?? null}
                    locked={isMatchLocked(match, now)}
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}

      <LiveRefresh />
    </div>
  );
}
