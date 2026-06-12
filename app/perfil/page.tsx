// Perfil do usuário logado — dados pessoais, estatísticas no bolão e
// histórico completo de palpites (viewerIsOwner = true: vê tudo, inclusive
// palpites de jogos ainda abertos).

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { pointsBadgeVariant } from "@/components/match-card";
import { LocalTime } from "@/components/local-time";
import { ProfileForms } from "@/components/profile/profile-forms";
import { TeamFlag } from "@/components/team-flag";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { prisma } from "@/lib/db";
import { isFinishedStatus } from "@/lib/match-rules";
import {
  getChampionPick,
  getRanking,
  getUserHistory,
  type HistoryEntry,
} from "@/lib/queries";
import type { TeamDTO } from "@/lib/types";

export const metadata = { title: "Meu perfil" };

export default async function PerfilPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const [user, ranking, championPick, history] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, createdAt: true },
    }),
    getRanking(),
    getChampionPick(userId),
    getUserHistory(userId, true),
  ]);
  if (!user) redirect("/login");

  const myRow = ranking.find((row) => row.userId === userId);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-900">Meu perfil</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Seus dados, suas estatísticas e todos os seus palpites no bolão.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader
            title="Meus dados"
            subtitle="Atualize seu nome de exibição e sua senha"
          />
          <CardBody className="space-y-5">
            <dl className="space-y-1 text-sm">
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-slate-700">Email:</dt>
                <dd className="text-slate-600">{user.email}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-slate-700">No bolão desde:</dt>
                <dd className="text-slate-600">
                  <LocalTime iso={user.createdAt.toISOString()} mode="date" />
                </dd>
              </div>
            </dl>
            <ProfileForms initialName={user.name} />
          </CardBody>
        </Card>

        <Card className="self-start">
          <CardHeader
            title="Minhas estatísticas"
            subtitle="Desempenho no ranking geral"
          />
          <CardBody>
            <dl className="grid grid-cols-2 gap-3">
              <Stat
                label="Posição no ranking"
                value={myRow ? `#${myRow.position} de ${ranking.length}` : "—"}
              />
              <Stat label="Pontos totais" value={myRow?.totalPoints ?? 0} />
              <Stat label="Placares exatos" value={myRow?.exactCount ?? 0} />
              <Stat label="Resultados certos" value={myRow?.resultCount ?? 0} />
            </dl>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Palpite de campeão
              </h3>
              {championPick ? (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <TeamFlag
                      flagUrl={championPick.team.flagUrl}
                      name={championPick.team.name}
                      code={championPick.team.code}
                      size="md"
                    />
                    <span className="text-sm font-semibold text-slate-800">
                      {championPick.team.name}
                    </span>
                    {championPick.points != null ? (
                      <Badge variant="gold">+{championPick.points} pts</Badge>
                    ) : null}
                  </span>
                  <Link
                    href="/chaveamento"
                    className="text-xs font-medium text-field-700 hover:underline"
                  >
                    Ver chaveamento →
                  </Link>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  Você ainda não escolheu seu campeão.{" "}
                  <Link
                    href="/chaveamento"
                    className="font-medium text-field-700 hover:underline"
                  >
                    Escolher no chaveamento →
                  </Link>
                </p>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Histórico de palpites"
          subtitle={
            history.length > 0
              ? `${history.length} ${history.length === 1 ? "palpite" : "palpites"} · mais recentes primeiro`
              : undefined
          }
        />
        {history.length === 0 ? (
          <CardBody>
            <EmptyState
              title="Você ainda não fez nenhum palpite"
              description="Registre seus placares antes do apito inicial e comece a somar pontos no ranking."
              action={
                <Link href="/palpites" className={buttonClasses("primary", "sm")}>
                  Fazer meus palpites
                </Link>
              }
            />
          </CardBody>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((entry) => (
              <li key={entry.prediction.id}>
                <HistoryRow entry={entry} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">
        {value}
      </dd>
    </div>
  );
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const { match, prediction } = entry;
  const finished = isFinishedStatus(match.status);
  const hasResult =
    finished && match.homeScore != null && match.awayScore != null;

  return (
    <Link
      href={`/jogos/${match.id}`}
      className="flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-field-50/40 sm:flex-row sm:items-center sm:gap-4"
    >
      <LocalTime
        iso={match.kickoff}
        mode="date"
        className="text-xs text-slate-500 sm:w-24 sm:shrink-0"
      />

      <span className="flex min-w-0 flex-1 items-center gap-2">
        <CompactTeam team={match.homeTeam} placeholder={match.homePlaceholder} />
        <span aria-hidden className="shrink-0 text-xs text-slate-400">
          ×
        </span>
        <CompactTeam
          team={match.awayTeam}
          placeholder={match.awayPlaceholder}
          reverse
        />
      </span>

      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:shrink-0 sm:justify-end">
        <span className="text-slate-500">
          Palpite{" "}
          <strong className="tabular-nums text-slate-800">
            {prediction.homeScore}×{prediction.awayScore}
          </strong>
        </span>
        {hasResult ? (
          <span className="text-slate-500">
            Resultado{" "}
            <strong className="tabular-nums text-slate-800">
              {match.homeScore}×{match.awayScore}
            </strong>
          </span>
        ) : null}
        {prediction.points != null ? (
          <Badge variant={pointsBadgeVariant(prediction.points)}>
            +{prediction.points} pts
          </Badge>
        ) : (
          <Badge variant="neutral">Aguardando</Badge>
        )}
      </span>
    </Link>
  );
}

function CompactTeam({
  team,
  placeholder,
  reverse = false,
}: {
  team: TeamDTO | null;
  placeholder: string | null;
  reverse?: boolean;
}) {
  if (!team) {
    return (
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-xs italic text-slate-400",
          reverse && "text-right"
        )}
      >
        {placeholder ?? "A definir"}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex min-w-0 flex-1 items-center gap-1.5",
        reverse && "flex-row-reverse"
      )}
    >
      <TeamFlag
        flagUrl={team.flagUrl}
        name={team.name}
        code={team.code}
        size="sm"
      />
      <span className="text-sm font-semibold text-slate-800">{team.code}</span>
    </span>
  );
}
