// Detalhe de um jogo — confronto, palpite do usuário e, após a trava,
// os palpites de todos os participantes (anti-cópia garantida no servidor).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { LiveRefresh } from "@/components/live-refresh";
import { LocalTime } from "@/components/local-time";
import {
  ExtraTimeNote,
  MatchScoreOrTime,
  pointsBadgeVariant,
} from "@/components/match-card";
import { MatchStatusBadge } from "@/components/match-status-badge";
import { PredictionCard } from "@/components/prediction/prediction-card";
import { TeamLabel } from "@/components/team-label";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { STAGE_LABELS } from "@/lib/format";
import {
  arePredictionsVisible,
  isFinishedStatus,
  isKnockoutStage,
} from "@/lib/match-rules";
import {
  getMatchById,
  getMatchGoals,
  getMatchParticipation,
  getMatchPredictions,
  getUserPredictionsMap,
  isMatchLocked,
  type MatchGoalDTO,
  type PredictionDTO,
} from "@/lib/queries";
import type { MatchDTO, TeamDTO } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

function matchTitle(match: MatchDTO): string {
  const home = match.homeTeam?.name ?? match.homePlaceholder ?? "A definir";
  const away = match.awayTeam?.name ?? match.awayPlaceholder ?? "A definir";
  return `${home} × ${away}`;
}

function stageLabel(match: MatchDTO): string {
  return match.stage === "GROUP" && match.group
    ? `Grupo ${match.group}`
    : STAGE_LABELS[match.stage];
}

/** Resolve o time correspondente a um advancingTeamId dentro do confronto */
function teamInMatch(match: MatchDTO, teamId: string | null): TeamDTO | null {
  if (!teamId) return null;
  if (match.homeTeam?.id === teamId) return match.homeTeam;
  if (match.awayTeam?.id === teamId) return match.awayTeam;
  return null;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const match = await getMatchById(id);
  return { title: match ? matchTitle(match) : "Jogo não encontrado" };
}

export default async function MatchDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const match = await getMatchById(id);
  if (!match) notFound();

  const locked = isMatchLocked(match);
  const revealed = arePredictionsVisible(match);
  const goals = await getMatchGoals(match.id);
  const myPredictions = await getUserPredictionsMap(userId);
  const myPrediction = myPredictions.get(match.id) ?? null;
  const advancingTeam = teamInMatch(match, match.advancingTeamId);
  const knockout = isKnockoutStage(match.stage);

  return (
    <div className="space-y-6">
      <LiveRefresh />

      <Link
        href="/jogos"
        className="inline-flex items-center gap-1 text-sm font-medium text-field-700 hover:underline"
      >
        ← Todos os jogos
      </Link>

      {/* Cabeçalho do confronto */}
      <Card>
        <CardBody className="py-5">
          <div className="flex items-center justify-center gap-2">
            <Badge variant="info">{stageLabel(match)}</Badge>
            <MatchStatusBadge status={match.status} />
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <TeamLabel
              team={match.homeTeam}
              placeholder={match.homePlaceholder}
              flagSize="lg"
              bold
              className="justify-end text-right"
            />
            <MatchScoreOrTime match={match} />
            <TeamLabel
              team={match.awayTeam}
              placeholder={match.awayPlaceholder}
              flagSize="lg"
              bold
              reverse
              className="justify-end"
            />
          </div>

          <div className="mt-3 space-y-1">
            <ExtraTimeNote match={match} />
            <p className="text-center text-xs text-slate-500">
              <LocalTime iso={match.kickoff} mode="datetime" />
              {match.venue ? <span> · {match.venue}</span> : null}
              {match.city ? <span> · {match.city}</span> : null}
            </p>
            {match.referee ? (
              <p className="text-center text-xs text-slate-500">
                <span aria-hidden>🧑‍⚖️</span> Árbitro: {match.referee}
              </p>
            ) : null}
          </div>

          {knockout && isFinishedStatus(match.status) && advancingTeam ? (
            <p className="mx-auto mt-3 w-fit rounded-lg bg-field-50 px-3 py-1.5 text-center text-sm font-semibold text-field-800">
              Classificado: {advancingTeam.name}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {goals.length > 0 ? <GoalsCard match={match} goals={goals} /> : null}

      {revealed ? (
        <LockedSections
          match={match}
          myPrediction={myPrediction}
          currentUserId={userId}
          knockout={knockout}
        />
      ) : (
        <OpenSections
          match={match}
          myPrediction={myPrediction}
          locked={locked}
        />
      )}
    </div>
  );
}

// ── Gols (detectados pela mudança de placar; sem autor, minuto estimado) ─────

function GoalsCard({
  match,
  goals,
}: {
  match: MatchDTO;
  goals: MatchGoalDTO[];
}) {
  return (
    <Card>
      <CardHeader
        title="Gols"
        subtitle="Minutos estimados pelo sistema — o autor não está disponível no plano gratuito"
      />
      <CardBody className="p-0">
        <ul className="divide-y divide-slate-100">
          {goals.map((g, i) => {
            const team = g.side === "HOME" ? match.homeTeam : match.awayTeam;
            const name =
              team?.name ?? (g.side === "HOME" ? "Mandante" : "Visitante");
            return (
              <li
                key={`${g.side}-${i}`}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <span aria-hidden>⚽</span>
                <span className="w-12 shrink-0 tabular-nums text-slate-500">
                  {g.minute != null ? `~${g.minute}ʼ` : "—"}
                </span>
                <span className="font-medium text-slate-800">{name}</span>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}

// ── Jogo aberto: palpitar + quem já palpitou (sem revelar placares) ──────────

async function OpenSections({
  match,
  myPrediction,
  locked,
}: {
  match: MatchDTO;
  myPrediction: PredictionDTO | null;
  locked: boolean;
}) {
  const participants = await getMatchParticipation(match.id);

  return (
    <>
      <section aria-labelledby="meu-palpite">
        <h2
          id="meu-palpite"
          className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500"
        >
          Seu palpite
        </h2>
        <PredictionCard match={match} prediction={myPrediction} locked={locked} />
      </section>

      <Card>
        <CardHeader
          title="Quem já palpitou"
          subtitle="Os palpites de todos são revelados no início do jogo — assim ninguém copia ninguém."
        />
        <CardBody className="p-0">
          {participants.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Nenhum participante encontrado"
                description="Assim que houver participantes no bolão, eles aparecem aqui."
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {participants.map((p) => (
                <li
                  key={p.userId}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <span className="truncate text-sm text-slate-800">
                    {p.userName}
                  </span>
                  {p.hasPredicted ? (
                    <Badge variant="success">Já palpitou ✓</Badge>
                  ) : (
                    <Badge variant="neutral">Sem palpite</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}

// ── Jogo travado: meu palpite + palpites de todos ────────────────────────────

async function LockedSections({
  match,
  myPrediction,
  currentUserId,
  knockout,
}: {
  match: MatchDTO;
  myPrediction: PredictionDTO | null;
  currentUserId: string;
  knockout: boolean;
}) {
  const predictions = await getMatchPredictions(match.id);
  const finished = isFinishedStatus(match.status);

  return (
    <section aria-labelledby="palpites-de-todos" className="space-y-4">
      <div>
        <h2
          id="meu-palpite-travado"
          className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500"
        >
          Seu palpite
        </h2>
        <PredictionCard match={match} prediction={myPrediction} locked={true} />
      </div>

      <Card>
        <CardHeader
          title={<span id="palpites-de-todos">Palpites de todos</span>}
          subtitle={
            finished
              ? "Pontuação calculada pelo resultado oficial."
              : "Jogo travado — palpites revelados. Pontos saem após o apito final."
          }
        />
        <CardBody className="p-0">
          {predictions.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Ninguém palpitou neste jogo"
                description="Nenhum participante registrou palpite antes do início da partida."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-4 py-2 font-semibold">
                      Participante
                    </th>
                    <th scope="col" className="px-2 py-2 text-center font-semibold">
                      Palpite
                    </th>
                    {knockout ? (
                      <th scope="col" className="px-2 py-2 text-center font-semibold">
                        Classificado
                      </th>
                    ) : null}
                    <th scope="col" className="px-4 py-2 text-right font-semibold">
                      Pontos
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {predictions.map((row) => {
                    const isMe = row.userId === currentUserId;
                    const advancingPick = teamInMatch(match, row.advancingTeamId);
                    return (
                      <tr
                        key={row.userId}
                        className={cn(isMe && "bg-field-50")}
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/usuarios/${row.userId}`}
                            className="font-medium text-slate-800 hover:text-field-700 hover:underline"
                          >
                            {row.userName}
                          </Link>
                          {isMe ? (
                            <span className="ml-1.5 text-xs font-semibold text-field-700">
                              (você)
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2.5 text-center font-bold tabular-nums text-slate-900">
                          {row.homeScore}
                          <span className="px-0.5 font-normal text-slate-400">×</span>
                          {row.awayScore}
                        </td>
                        {knockout ? (
                          <td className="px-2 py-2.5 text-center text-slate-700">
                            {advancingPick ? (
                              <span className="font-semibold">
                                {advancingPick.code}
                              </span>
                            ) : (
                              <span aria-hidden className="text-slate-300">
                                —
                              </span>
                            )}
                          </td>
                        ) : null}
                        <td className="px-4 py-2.5 text-right">
                          {row.points != null ? (
                            <Badge variant={pointsBadgeVariant(row.points)}>
                              +{row.points} pts
                            </Badge>
                          ) : (
                            <span aria-label="Pontos ainda não calculados" className="text-slate-300">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </section>
  );
}
