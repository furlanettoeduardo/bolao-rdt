"use client";

// Cartão de palpite — placar editável até o kickoff, com salvamento
// otimista via Server Action. No mata-mata, palpite empatado exige
// escolher quem avança (o classificado de palpite com vencedor é inferido).
// A trava REAL é validada no servidor (UTC); aqui é só UX.

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LocalTime } from "@/components/local-time";
import { MatchStatusBadge } from "@/components/match-status-badge";
import { TeamLabel } from "@/components/team-label";
import { savePrediction } from "@/lib/actions/predictions";
import { cn } from "@/lib/cn";
import { MAX_GOALS } from "@/lib/config";
import { STAGE_LABELS } from "@/lib/format";
import type { PredictionDTO } from "@/lib/queries";
import type { MatchDTO } from "@/lib/types";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export function PredictionCard({
  match,
  prediction,
  locked,
}: {
  match: MatchDTO;
  prediction: PredictionDTO | null;
  /** Calculado no servidor no momento da renderização */
  locked: boolean;
}) {
  const [home, setHome] = useState(
    prediction != null ? String(prediction.homeScore) : ""
  );
  const [away, setAway] = useState(
    prediction != null ? String(prediction.awayScore) : ""
  );
  const [advancing, setAdvancing] = useState<string | null>(
    prediction?.advancingTeamId ?? null
  );
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  const isKnockout = match.stage !== "GROUP";
  const homeNum = home === "" ? null : Number(home);
  const awayNum = away === "" ? null : Number(away);
  const isDraw =
    homeNum != null && awayNum != null && homeNum === awayNum;
  const needsAdvancing = isKnockout && isDraw;
  const canChooseAdvancing = match.homeTeam != null && match.awayTeam != null;

  const isDirty = useMemo(() => {
    if (prediction == null) return home !== "" || away !== "";
    return (
      home !== String(prediction.homeScore) ||
      away !== String(prediction.awayScore) ||
      (needsAdvancing && advancing !== prediction.advancingTeamId)
    );
  }, [home, away, advancing, needsAdvancing, prediction]);

  const valid =
    homeNum != null &&
    awayNum != null &&
    Number.isInteger(homeNum) &&
    Number.isInteger(awayNum) &&
    homeNum >= 0 &&
    awayNum >= 0 &&
    homeNum <= MAX_GOALS &&
    awayNum <= MAX_GOALS &&
    (!needsAdvancing || (canChooseAdvancing && advancing != null));

  function submit() {
    if (!valid || locked) return;
    setState({ kind: "saving" });
    startTransition(async () => {
      const result = await savePrediction({
        matchId: match.id,
        homeScore: homeNum!,
        awayScore: awayNum!,
        advancingTeamId: needsAdvancing ? advancing : null,
      });
      if (result.ok) {
        setState({ kind: "saved" });
      } else {
        setState({ kind: "error", message: result.error });
      }
    });
  }

  const stageLabel =
    match.stage === "GROUP" && match.group
      ? `Grupo ${match.group}`
      : STAGE_LABELS[match.stage];

  const scored = prediction?.points != null;

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-3 shadow-sm",
        locked ? "border-slate-200" : "border-field-200"
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span className="flex items-center gap-2">
          <span>{stageLabel}</span>
          <LocalTime iso={match.kickoff} mode="time" className="font-semibold" />
          {match.venue ? (
            <span className="hidden truncate sm:inline">· {match.venue}</span>
          ) : null}
        </span>
        <span className="flex items-center gap-1.5">
          {scored ? (
            <Badge variant={prediction!.points! >= 10 ? "gold" : prediction!.points! > 0 ? "success" : "neutral"}>
              +{prediction!.points} pts
            </Badge>
          ) : locked ? (
            <Badge variant="neutral">🔒 Travado</Badge>
          ) : prediction ? (
            <Badge variant="success">Palpite feito</Badge>
          ) : (
            <Badge variant="warning">Aberto</Badge>
          )}
          <MatchStatusBadge status={match.status} match={match} />
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TeamLabel team={match.homeTeam} placeholder={match.homePlaceholder} bold />
        <div className="flex items-center gap-1.5">
          <ScoreInput
            value={home}
            onChange={setHome}
            disabled={locked || isPending}
            label={`Gols de ${match.homeTeam?.name ?? "time da casa"}`}
          />
          <span className="text-sm font-bold text-slate-400">×</span>
          <ScoreInput
            value={away}
            onChange={setAway}
            disabled={locked || isPending}
            label={`Gols de ${match.awayTeam?.name ?? "time visitante"}`}
          />
        </div>
        <TeamLabel team={match.awayTeam} placeholder={match.awayPlaceholder} bold reverse />
      </div>

      {locked && match.homeScore != null && match.awayScore != null ? (
        <p className="mt-2 text-center text-xs text-slate-500">
          Resultado: <strong className="tabular-nums">{match.homeScore}×{match.awayScore}</strong>
        </p>
      ) : null}

      {!locked && needsAdvancing ? (
        canChooseAdvancing ? (
          <fieldset className="mt-3 rounded-lg bg-slate-50 p-2">
            <legend className="px-1 text-xs font-semibold text-slate-600">
              Empate no mata-mata — quem avança?
            </legend>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {[match.homeTeam!, match.awayTeam!].map((team) => (
                <label
                  key={team.id}
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-2 py-1.5 text-sm",
                    advancing === team.id
                      ? "border-field-600 bg-field-50 font-semibold text-field-800"
                      : "border-slate-200 bg-white text-slate-600"
                  )}
                >
                  <input
                    type="radio"
                    name={`advancing-${match.id}`}
                    value={team.id}
                    checked={advancing === team.id}
                    onChange={() => setAdvancing(team.id)}
                    className="sr-only"
                  />
                  {team.code}
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Para palpitar empate, aguarde a definição dos times do confronto.
          </p>
        )
      ) : null}

      {!locked ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400">
            Editável até o início do jogo
          </span>
          <span className="flex items-center gap-2">
            {state.kind === "saved" && !isDirty ? (
              <span className="text-xs font-semibold text-field-700">Salvo ✓</span>
            ) : null}
            {state.kind === "error" ? (
              <span role="alert" className="text-xs font-semibold text-cup-red">
                {state.message}
              </span>
            ) : null}
            <Button
              size="sm"
              onClick={submit}
              disabled={!valid || !isDirty || isPending}
            >
              {isPending ? "Salvando…" : prediction ? "Atualizar" : "Salvar"}
            </Button>
          </span>
        </div>
      ) : (
        <div className="mt-2 text-right">
          <Link
            href={`/jogos/${match.id}`}
            className="text-xs font-medium text-field-700 hover:underline"
          >
            Ver palpites de todos →
          </Link>
        </div>
      )}
    </div>
  );
}

function ScoreInput({
  value,
  onChange,
  disabled,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={MAX_GOALS}
      step={1}
      value={value}
      placeholder="–"
      aria-label={label}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "" || (/^\d{1,2}$/.test(v) && Number(v) <= MAX_GOALS)) {
          onChange(v);
        }
      }}
      className={cn(
        "h-10 w-11 rounded-lg border border-slate-300 text-center text-base font-bold tabular-nums",
        "focus:border-field-600 focus:outline-2 focus:outline-field-600/30",
        "disabled:bg-slate-100 disabled:text-slate-500"
      )}
    />
  );
}
