import Link from "next/link";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { SCORING } from "@/lib/config";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/format";
import { getRanking } from "@/lib/queries";
import type { Stage } from "@/lib/types";

export const metadata = { title: "Ranking" };

const STAGES = (Object.keys(STAGE_LABELS) as Stage[]).sort(
  (a, b) => STAGE_ORDER[a] - STAGE_ORDER[b]
);

const MEDALS: Partial<Record<number, string>> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

function parseStage(value: string | string[] | undefined): Stage | undefined {
  if (typeof value !== "string") return undefined;
  return (STAGES as readonly string[]).includes(value)
    ? (value as Stage)
    : undefined;
}

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
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "bg-field-700 text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-field-50 hover:text-field-800"
      )}
    >
      {children}
    </Link>
  );
}

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, sp] = await Promise.all([auth(), searchParams]);
  const fase = parseStage(sp.fase);
  const ranking = await getRanking(fase);

  const currentUserId = session?.user?.id;
  const isGeneral = fase === undefined;
  const participants =
    ranking.length === 1
      ? "1 participante"
      : `${ranking.length} participantes`;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-900">Ranking</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {participants} · {isGeneral ? "classificação geral" : STAGE_LABELS[fase]}
        </p>
      </header>

      <nav
        aria-label="Filtrar ranking por fase"
        className="flex flex-wrap gap-2"
      >
        <FilterChip href="/ranking" active={isGeneral}>
          Geral
        </FilterChip>
        {STAGES.map((stage) => (
          <FilterChip
            key={stage}
            href={`/ranking?fase=${stage}`}
            active={fase === stage}
          >
            {STAGE_LABELS[stage]}
          </FilterChip>
        ))}
      </nav>

      {ranking.length === 0 ? (
        <EmptyState
          title="Nenhum participante ainda"
          description="Assim que alguém se cadastrar no bolão, o ranking aparece aqui."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <caption className="sr-only">
                Ranking do bolão — {isGeneral ? "geral" : STAGE_LABELS[fase]}:
                posição, nome, pontos, placares exatos e resultados certos
              </caption>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-2 py-2 text-center sm:px-4">
                    Pos
                  </th>
                  <th scope="col" className="px-2 py-2 sm:px-4">
                    Nome
                  </th>
                  <th scope="col" className="px-2 py-2 text-center sm:px-4">
                    Pontos
                  </th>
                  <th scope="col" className="px-2 py-2 text-center sm:px-4">
                    Exatos
                  </th>
                  <th scope="col" className="px-2 py-2 text-center sm:px-4">
                    Resultados
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ranking.map((row) => {
                  const isCurrentUser = row.userId === currentUserId;
                  const medal = isGeneral ? MEDALS[row.position] : undefined;
                  return (
                    <tr
                      key={row.userId}
                      className={cn(isCurrentUser && "bg-field-50")}
                    >
                      <td className="px-2 py-2 text-center font-semibold text-slate-700 sm:px-4 sm:py-2.5">
                        {medal ? (
                          <>
                            <span aria-hidden className="text-base sm:text-lg">
                              {medal}
                            </span>
                            <span className="sr-only">{row.position}º</span>
                          </>
                        ) : (
                          <>{row.position}º</>
                        )}
                      </td>
                      <td className="max-w-36 truncate px-2 py-2 sm:max-w-none sm:px-4 sm:py-2.5">
                        <Link
                          href={`/usuarios/${row.userId}`}
                          className="font-medium text-slate-800 hover:text-field-700 hover:underline"
                        >
                          {row.name}
                        </Link>
                        {isCurrentUser ? (
                          <span className="ml-1 text-[11px] font-semibold text-field-700">
                            (você)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-center font-bold text-slate-900 sm:px-4 sm:py-2.5">
                        {row.totalPoints}
                      </td>
                      <td className="px-2 py-2 text-center text-slate-600 sm:px-4 sm:py-2.5">
                        {row.exactCount}
                      </td>
                      <td className="px-2 py-2 text-center text-slate-600 sm:px-4 sm:py-2.5">
                        {row.resultCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="text-xs text-slate-500">
        Desempate: mais placares exatos → mais resultados certos → cadastro
        mais antigo. O bônus de campeão (+{SCORING.CHAMPION_BONUS}) conta
        apenas no ranking geral.
      </p>
    </div>
  );
}
