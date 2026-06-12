// Dashboard — visão geral do bolão: jogos de hoje/ao vivo, palpites
// pendentes, palpite de campeão e top 10 do ranking.

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Countdown } from "@/components/countdown";
import { LiveRefresh } from "@/components/live-refresh";
import { LocalTime } from "@/components/local-time";
import { MatchCard } from "@/components/match-card";
import { TeamFlag } from "@/components/team-flag";
import { TeamLabel } from "@/components/team-label";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { SCORING } from "@/lib/config";
import {
  getChampionPick,
  getNextBrazilMatch,
  getPendingMatches,
  getRankingTop,
  getTodayAndLiveMatches,
  getUserPredictionsMap,
} from "@/lib/queries";

export const metadata = { title: "Início" };

const MEDALS = ["🥇", "🥈", "🥉"] as const;

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;
  const firstName = session.user.name?.trim().split(/\s+/)[0] ?? "torcedor";

  const [
    todayMatches,
    predictions,
    pendingMatches,
    championPick,
    topTen,
    nextBrazil,
  ] = await Promise.all([
    getTodayAndLiveMatches(),
    getUserPredictionsMap(userId),
    getPendingMatches(userId, 6),
    getChampionPick(userId),
    getRankingTop(10),
    getNextBrazilMatch(),
  ]);

  return (
    <div className="space-y-8">
      <LiveRefresh />

      {/* Banner do bolão */}
      <section aria-label="Bolão de Urussanga">
        <div className="overflow-hidden rounded-xl border border-field-700 bg-gradient-to-r from-field-800 to-field-600 p-5 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-field-100">
            Bolão da Copa 2026
          </p>
          <h2 className="mt-0.5 text-xl font-bold sm:text-2xl">
            Bolão de Urussanga ⚽
          </h2>
          <p className="mt-1 max-w-prose text-sm text-field-50">
            Palpite nos 104 jogos da Copa do Mundo, pontue a cada acerto e
            dispute o ranking da cidade.
          </p>
        </div>
      </section>

      {/* Próximo jogo do Brasil — contagem regressiva */}
      {nextBrazil ? (
        <section aria-labelledby="brasil-heading">
          <Link
            href={`/jogos/${nextBrazil.match.id}`}
            className="block overflow-hidden rounded-xl border border-amber-400 bg-gradient-to-br from-amber-400 via-yellow-400 to-field-600 p-0.5 shadow-sm transition-transform hover:scale-[1.005]"
          >
            <div className="flex flex-col gap-3 rounded-[10px] bg-field-800 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p
                  id="brasil-heading"
                  className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-300"
                >
                  <span aria-hidden>🇧🇷</span>
                  {nextBrazil.live
                    ? "Brasil em campo agora"
                    : "Próximo jogo do Brasil"}
                </p>
                <div className="mt-1.5 flex items-center gap-2 text-base font-bold">
                  <BrazilSide
                    team={nextBrazil.match.homeTeam}
                    placeholder={nextBrazil.match.homePlaceholder}
                  />
                  <span className="text-white/60">×</span>
                  <BrazilSide
                    team={nextBrazil.match.awayTeam}
                    placeholder={nextBrazil.match.awayPlaceholder}
                    reverse
                  />
                </div>
                <p className="mt-1 text-xs text-white/70">
                  <LocalTime iso={nextBrazil.match.kickoff} mode="datetime" />
                </p>
              </div>
              <div className="shrink-0 sm:text-right">
                <Countdown targetIso={nextBrazil.match.kickoff} />
              </div>
            </div>
          </Link>
        </section>
      ) : null}

      {/* Saudação */}
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Olá, {firstName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          <LocalTime iso={new Date().toISOString()} mode="day-heading" />
        </p>
      </header>

      {/* Hoje e ao vivo */}
      <section aria-labelledby="hoje-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="hoje-heading" className="text-base font-semibold text-slate-900">
            Hoje e ao vivo
          </h2>
          <Link
            href="/jogos"
            className="text-sm font-semibold text-field-700 hover:text-field-800 hover:underline"
          >
            Ver todos os jogos
          </Link>
        </div>

        {todayMatches.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {todayMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                prediction={predictions.get(match.id) ?? null}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nenhum jogo hoje"
            description="Aproveite a folga para revisar seus palpites e conferir o calendário completo da Copa."
            action={
              <Link href="/jogos" className={buttonClasses("outline", "sm")}>
                Ver calendário de jogos
              </Link>
            }
          />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Palpites pendentes */}
        <section aria-labelledby="pendentes-heading">
          <Card>
            <CardHeader
              title={<span id="pendentes-heading">Palpites pendentes</span>}
              subtitle="Próximos jogos abertos sem palpite seu"
            />
            <CardBody>
              {pendingMatches.length > 0 ? (
                <div className="space-y-3">
                  <ul className="space-y-2">
                    {pendingMatches.map((match) => (
                      <li key={match.id}>
                        <Link
                          href="/palpites?exibir=pendentes"
                          className="block rounded-lg border border-amber-300 bg-amber-50/40 px-3 py-2 transition-colors hover:border-amber-400 hover:bg-amber-50"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                            <LocalTime iso={match.kickoff} mode="datetime" />
                            <Badge variant="warning">Aberto</Badge>
                          </div>
                          <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                            <TeamLabel
                              team={match.homeTeam}
                              placeholder={match.homePlaceholder}
                              flagSize="sm"
                            />
                            <span aria-hidden className="text-xs text-slate-400">
                              ×
                            </span>
                            <TeamLabel
                              team={match.awayTeam}
                              placeholder={match.awayPlaceholder}
                              flagSize="sm"
                              reverse
                            />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/palpites?exibir=pendentes"
                    className={buttonClasses("primary", "md", "w-full")}
                  >
                    Fazer palpites
                  </Link>
                </div>
              ) : (
                <p className="flex items-center gap-2 py-2 text-sm font-medium text-field-700">
                  <span aria-hidden>✓</span>
                  Você está em dia com seus palpites
                </p>
              )}
            </CardBody>
          </Card>
        </section>

        {/* Top 10 do ranking */}
        <section aria-labelledby="ranking-heading">
          <Card>
            <CardHeader
              title={<span id="ranking-heading">Top 10 do ranking</span>}
              action={
                <Link
                  href="/ranking"
                  className="text-xs font-semibold text-field-700 hover:text-field-800 hover:underline"
                >
                  Ver ranking completo
                </Link>
              }
            />
            <CardBody className="px-2">
              {topTen.length > 0 ? (
                <ol className="space-y-0.5">
                  {topTen.map((row) => {
                    const medal = MEDALS[row.position - 1];
                    const isCurrentUser = row.userId === userId;
                    return (
                      <li
                        key={row.userId}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-2 py-2 text-sm",
                          isCurrentUser && "bg-field-50 font-semibold"
                        )}
                      >
                        <span className="w-8 shrink-0 text-center tabular-nums text-slate-500">
                          {medal ? (
                            <>
                              <span aria-hidden className="text-base">
                                {medal}
                              </span>
                              <span className="sr-only">
                                {row.position}º lugar
                              </span>
                            </>
                          ) : (
                            `${row.position}º`
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-slate-800">
                          {row.name}
                          {isCurrentUser ? (
                            <span className="ml-1 text-xs font-normal text-field-700">
                              (você)
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                          {row.totalPoints} pts
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="px-2 py-2 text-sm text-slate-500">
                  O ranking aparece assim que houver participantes.
                </p>
              )}
            </CardBody>
          </Card>
        </section>
      </div>

      {/* Palpite de campeão — largura total */}
      <section aria-labelledby="campeao-heading">
        <Card>
          <CardHeader
            title={<span id="campeao-heading">Palpite de campeão</span>}
            subtitle={`Vale +${SCORING.CHAMPION_BONUS} pts ao final do torneio`}
          />
          <CardBody>
            {championPick ? (
              <Link
                href="/chaveamento"
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:border-field-400 hover:bg-field-50/40"
              >
                <TeamFlag
                  flagUrl={championPick.team.flagUrl}
                  name={championPick.team.name}
                  code={championPick.team.code}
                  size="lg"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {championPick.team.name}
                  </span>
                  <span className="block text-xs text-slate-500">
                    Seu campeão da Copa 2026
                  </span>
                </span>
                {championPick.points != null ? (
                  <Badge variant="gold">+{championPick.points} pts</Badge>
                ) : (
                  <span className="text-xs font-semibold text-field-700">
                    Ver chaveamento
                  </span>
                )}
              </Link>
            ) : (
              <div className="flex flex-col items-start gap-3 py-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">
                  Você ainda não escolheu seu campeão. Garanta o bônus antes do
                  início do mata-mata!
                </p>
                <Link
                  href="/chaveamento"
                  className={buttonClasses("primary", "md", "shrink-0")}
                >
                  Escolha seu campeão (+{SCORING.CHAMPION_BONUS} pts)
                </Link>
              </div>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}

/** Lado de um confronto no card do Brasil — texto branco sobre fundo escuro. */
function BrazilSide({
  team,
  placeholder,
  reverse = false,
}: {
  team: { name: string; code: string; flagUrl: string } | null;
  placeholder: string | null;
  reverse?: boolean;
}) {
  if (!team) {
    return (
      <span className="text-sm font-medium italic text-white/70">
        {placeholder ?? "A definir"}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-2",
        reverse && "flex-row-reverse"
      )}
    >
      <TeamFlag
        flagUrl={team.flagUrl}
        name={team.name}
        code={team.code}
        size="sm"
      />
      <span className="truncate">{team.name}</span>
    </span>
  );
}
