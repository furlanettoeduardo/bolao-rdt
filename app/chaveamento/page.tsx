// Chaveamento do mata-mata + palpite de campeão.
// Server Component protegido pelo middleware; a trava do palpite de campeão
// é calculada AQUI no servidor (UTC) e passada como prop ao client component.

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LocalTime } from "@/components/local-time";
import { ChampionPicker } from "@/components/prediction/champion-picker";
import { TeamFlag } from "@/components/team-flag";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { SCORING } from "@/lib/config";
import { STAGE_LABELS } from "@/lib/format";
import { isFinishedStatus, isLiveStatus } from "@/lib/match-rules";
import {
  getChampionPick,
  getFirstKnockoutKickoff,
  getKnockoutMatches,
  listTeams,
} from "@/lib/queries";
import type { MatchDTO, Stage, TeamDTO } from "@/lib/types";

export const metadata = { title: "Chaveamento" };

/** Colunas principais do funil (3º lugar e Final ficam na última coluna) */
const MAIN_STAGES = ["ROUND_32", "ROUND_16", "QUARTER", "SEMI"] as const satisfies readonly Stage[];

/** Trava do palpite de campeão — sempre relógio do servidor, em UTC */
function isChampionPickLocked(firstKickoff: Date | null): boolean {
  return firstKickoff != null && firstKickoff.getTime() <= Date.now();
}

export default async function ChaveamentoPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const [matches, championPick, firstKickoff, teams] = await Promise.all([
    getKnockoutMatches(),
    getChampionPick(userId),
    getFirstKnockoutKickoff(),
    listTeams(),
  ]);

  const championLocked = isChampionPickLocked(firstKickoff);
  const championTeamId = championPick?.team.id ?? null;

  const byStage = new Map<Stage, MatchDTO[]>();
  for (const match of matches) {
    const list = byStage.get(match.stage) ?? [];
    list.push(match);
    byStage.set(match.stage, list);
  }

  const mainColumns = MAIN_STAGES.map((stage) => ({
    stage,
    matches: byStage.get(stage) ?? [],
  })).filter((column) => column.matches.length > 0);
  const thirdPlace = byStage.get("THIRD_PLACE") ?? [];
  const finals = byStage.get("FINAL") ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900">Chaveamento</h1>
        <p className="mt-1 text-sm text-slate-500">
          O caminho até a taça — dos 16 avos de final à grande decisão.
        </p>
      </header>

      <section aria-label="Seu palpite de campeão">
        <ChampionPicker
          teams={teams}
          current={championPick?.team ?? null}
          locked={championLocked}
          pointsValue={SCORING.CHAMPION_BONUS}
        />
      </section>

      {matches.length === 0 ? (
        <EmptyState
          title="O chaveamento ainda não está disponível"
          description="Os confrontos do mata-mata aparecerão aqui assim que forem definidos e sincronizados."
        />
      ) : (
        <section aria-label="Chaveamento do mata-mata" className="flex flex-col gap-2">
          <p className="text-xs text-slate-500">
            Deslize para o lado para ver todas as fases.
            {championPick
              ? ` Jogos de ${championPick.team.name}, sua aposta de campeão, aparecem com contorno dourado.`
              : ""}
          </p>

          <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
            <div className="flex min-w-max items-stretch gap-3 sm:gap-4">
              {mainColumns.map((column) => (
                <section
                  key={column.stage}
                  aria-label={STAGE_LABELS[column.stage]}
                  className="flex w-56 shrink-0 flex-col"
                >
                  <ColumnHeading>{STAGE_LABELS[column.stage]}</ColumnHeading>
                  <div className="flex flex-1 flex-col justify-around gap-3">
                    {column.matches.map((match) => (
                      <BracketTile
                        key={match.id}
                        match={match}
                        championTeamId={championTeamId}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {thirdPlace.length > 0 || finals.length > 0 ? (
                <section
                  aria-label="Decisões"
                  className="flex w-56 shrink-0 flex-col gap-4"
                >
                  {thirdPlace.length > 0 ? (
                    <div>
                      <h2 className="mb-2 rounded-lg bg-slate-200 px-3 py-1 text-center text-[11px] font-bold uppercase tracking-wide text-slate-600">
                        {STAGE_LABELS.THIRD_PLACE}
                      </h2>
                      <div className="flex flex-col gap-3">
                        {thirdPlace.map((match) => (
                          <BracketTile
                            key={match.id}
                            match={match}
                            championTeamId={championTeamId}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {finals.length > 0 ? (
                    <div className="flex flex-1 flex-col">
                      <ColumnHeading>
                        <span aria-hidden>🏆</span> {STAGE_LABELS.FINAL}
                      </ColumnHeading>
                      <div className="flex flex-1 flex-col justify-around gap-3">
                        {finals.map((match) => (
                          <BracketTile
                            key={match.id}
                            match={match}
                            championTeamId={championTeamId}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 rounded-lg bg-field-700 px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wide text-white">
      {children}
    </h2>
  );
}

function BracketTile({
  match,
  championTeamId,
}: {
  match: MatchDTO;
  championTeamId: string | null;
}) {
  const hasChampionTeam =
    championTeamId != null &&
    (match.homeTeam?.id === championTeamId ||
      match.awayTeam?.id === championTeamId);
  const showScore =
    match.homeScore != null &&
    match.awayScore != null &&
    (isLiveStatus(match.status) || isFinishedStatus(match.status));

  return (
    <Link
      href={`/jogos/${match.id}`}
      className={cn(
        "block rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm transition-colors",
        "hover:border-field-400 hover:bg-field-50/40",
        hasChampionTeam && "ring-2 ring-cup-gold"
      )}
    >
      <TileTeamRow
        team={match.homeTeam}
        placeholder={match.homePlaceholder}
        score={showScore ? match.homeScore : null}
        advancing={
          match.homeTeam != null && match.advancingTeamId === match.homeTeam.id
        }
      />
      <TileTeamRow
        team={match.awayTeam}
        placeholder={match.awayPlaceholder}
        score={showScore ? match.awayScore : null}
        advancing={
          match.awayTeam != null && match.advancingTeamId === match.awayTeam.id
        }
      />

      {match.homePenalties != null && match.awayPenalties != null ? (
        <p className="mt-1 text-[10px] text-slate-500">
          Pênaltis {match.homePenalties}×{match.awayPenalties}
        </p>
      ) : match.homeScoreET != null && match.awayScoreET != null ? (
        <p className="mt-1 text-[10px] text-slate-500">
          Prorrogação {match.homeScoreET}×{match.awayScoreET}
        </p>
      ) : null}

      {isLiveStatus(match.status) ? (
        <p className="mt-1 text-[11px] font-semibold text-cup-red">
          <span aria-hidden className="live-dot mr-1 inline-block size-1.5 rounded-full bg-cup-red align-middle" />
          Ao vivo
        </p>
      ) : match.status === "SCHEDULED" ? (
        <p className="mt-1 text-[11px] text-slate-400">
          <LocalTime iso={match.kickoff} mode="date" />
        </p>
      ) : null}
    </Link>
  );
}

function TileTeamRow({
  team,
  placeholder,
  score,
  advancing,
}: {
  team: TeamDTO | null;
  placeholder: string | null;
  score: number | null;
  advancing: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      {team ? (
        <span className="flex min-w-0 items-center gap-1.5">
          <TeamFlag
            flagUrl={team.flagUrl}
            name={team.name}
            code={team.code}
            size="sm"
          />
          <span
            className={cn(
              "truncate text-xs",
              advancing
                ? "font-bold text-slate-900 underline decoration-cup-gold decoration-2 underline-offset-2"
                : "text-slate-700"
            )}
          >
            {team.name}
          </span>
        </span>
      ) : (
        <span className="truncate text-xs italic text-slate-400">
          {placeholder ?? "A definir"}
        </span>
      )}
      {score != null ? (
        <span
          className={cn(
            "shrink-0 text-xs tabular-nums",
            advancing ? "font-bold text-slate-900" : "text-slate-600"
          )}
        >
          {score}
        </span>
      ) : null}
    </div>
  );
}
