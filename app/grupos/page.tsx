// Classificação dos 12 grupos da Copa do Mundo FIFA 2026.

import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TeamLabel } from "@/components/team-label";
import {
  GROUP_LETTERS,
  getGroupTables,
  type GroupTableRow,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Grupos" };

type StatKey =
  | "points"
  | "played"
  | "won"
  | "drawn"
  | "lost"
  | "goalsFor"
  | "goalsAgainst"
  | "goalDifference";

interface StatColumn {
  key: StatKey;
  abbr: string;
  title: string;
  width: string;
  emphasis?: boolean;
  signed?: boolean;
}

const STAT_COLUMNS: readonly StatColumn[] = [
  { key: "points", abbr: "P", title: "Pontos", width: "w-8", emphasis: true },
  { key: "played", abbr: "J", title: "Jogos", width: "w-7" },
  { key: "won", abbr: "V", title: "Vitórias", width: "w-7" },
  { key: "drawn", abbr: "E", title: "Empates", width: "w-7" },
  { key: "lost", abbr: "D", title: "Derrotas", width: "w-7" },
  { key: "goalsFor", abbr: "GP", title: "Gols pró", width: "w-8" },
  { key: "goalsAgainst", abbr: "GC", title: "Gols contra", width: "w-8" },
  { key: "goalDifference", abbr: "SG", title: "Saldo de gols", width: "w-8", signed: true },
];

function formatStat(value: number, signed: boolean | undefined): string {
  return signed && value > 0 ? `+${value}` : String(value);
}

function rowHighlight(position: number): { row: string; edge: string } {
  if (position <= 2) {
    return { row: "bg-field-50", edge: "border-l-2 border-l-field-500" };
  }
  if (position === 3) {
    return { row: "bg-amber-50", edge: "border-l-2 border-l-amber-400" };
  }
  return { row: "", edge: "border-l-2 border-l-transparent" };
}

function GroupTable({ letter, rows }: { letter: string; rows: GroupTableRow[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title={`Grupo ${letter}`} />
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-xs">
          <caption className="sr-only">
            Classificação do Grupo {letter}
          </caption>
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              <th scope="col" className="w-6 py-2 text-center">
                <abbr title="Posição" className="no-underline">
                  #
                </abbr>
              </th>
              <th scope="col" className="px-1.5 py-2 text-left font-medium">
                Seleção
              </th>
              {STAT_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`${col.width} px-0.5 py-2 text-center`}
                >
                  <abbr title={col.title} className="no-underline">
                    {col.abbr}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const highlight = rowHighlight(row.position);
              return (
                <tr
                  key={row.team.id}
                  className={`border-b border-slate-100 last:border-b-0 ${highlight.row}`}
                >
                  <td
                    className={`py-1.5 text-center font-semibold tabular-nums text-slate-600 ${highlight.edge}`}
                  >
                    {row.position}
                  </td>
                  <th scope="row" className="px-1.5 py-1.5 text-left font-normal">
                    <TeamLabel
                      team={row.team}
                      placeholder={null}
                      flagSize="sm"
                      fullName
                    />
                  </th>
                  {STAT_COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className={`px-0.5 py-1.5 text-center tabular-nums ${
                        col.emphasis
                          ? "font-semibold text-slate-900"
                          : "text-slate-600"
                      }`}
                    >
                      {formatStat(row[col.key], col.signed)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default async function GruposPage() {
  const tables = await getGroupTables();
  const hasTeams = Array.from(tables.values()).some((rows) => rows.length > 0);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Fase de grupos
        </h1>
        <p className="text-sm text-slate-600">
          1º e 2º classificados · os 8 melhores 3ºs também avançam
        </p>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <li className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-sm border border-field-300 bg-field-50"
            />
            1º e 2º lugares
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-sm border border-amber-300 bg-amber-50"
            />
            3º lugar (repescagem dos melhores)
          </li>
        </ul>
      </header>

      {hasTeams ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {GROUP_LETTERS.map((letter) => (
            <GroupTable
              key={letter}
              letter={letter}
              rows={tables.get(letter) ?? []}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Tabelas ainda não disponíveis"
          description="As seleções e os grupos ainda não foram carregados. Peça a um administrador para rodar a sincronização de dados (seed) no painel administrativo."
        />
      )}
    </div>
  );
}
