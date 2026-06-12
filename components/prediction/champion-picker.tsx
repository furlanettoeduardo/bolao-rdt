"use client";

// Seletor do palpite de campeão — editável até o kickoff do primeiro jogo
// do mata-mata. A trava REAL é validada no servidor (UTC); aqui é só UX.

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { TeamFlag } from "@/components/team-flag";
import { saveChampionPick } from "@/lib/actions/predictions";
import { cn } from "@/lib/cn";
import type { TeamDTO } from "@/lib/types";

type SaveState =
  | { kind: "idle" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export function ChampionPicker({
  teams,
  current,
  locked,
  pointsValue,
}: {
  /** As 48 seleções disponíveis */
  teams: TeamDTO[];
  /** Escolha atual do usuário (null = ainda não escolheu) */
  current: TeamDTO | null;
  /** Calculado no servidor: o mata-mata já começou? */
  locked: boolean;
  /** Pontos do bônus de campeão (SCORING.CHAMPION_BONUS) */
  pointsValue: number;
}) {
  const [selected, setSelected] = useState(current?.id ?? "");
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [teams]
  );

  const isDirty = selected !== "" && selected !== (current?.id ?? "");

  function submit() {
    if (locked || isPending || !isDirty) return;
    startTransition(async () => {
      const result = await saveChampionPick(selected);
      setState(
        result.ok
          ? { kind: "saved" }
          : { kind: "error", message: result.error }
      );
    });
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-1.5">
            <span aria-hidden>🏆</span> Seu campeão
          </span>
        }
        subtitle="Quem levanta a taça da Copa 2026?"
        action={
          locked ? (
            <Badge variant="neutral">🔒 Travado — o mata-mata começou</Badge>
          ) : (
            <Badge variant="gold">+{pointsValue} pts</Badge>
          )
        }
      />
      <CardBody className="flex flex-col gap-3">
        {current ? (
          <div className="flex items-center gap-3 rounded-lg bg-field-50 px-3 py-2.5">
            <TeamFlag
              flagUrl={current.flagUrl}
              name={current.name}
              code={current.code}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-slate-900">
                {current.name}
              </p>
              <p className="text-xs text-slate-500">Sua seleção campeã</p>
            </div>
            <Badge variant="gold" className="shrink-0">
              +{pointsValue} pts
            </Badge>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Você ainda não escolheu sua seleção campeã.
          </p>
        )}

        {locked ? null : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Label htmlFor="champion-select">
                  Escolha sua seleção campeã
                </Label>
                <select
                  id="champion-select"
                  value={selected}
                  disabled={isPending}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    setState({ kind: "idle" });
                  }}
                  className={cn(
                    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900",
                    "focus:border-field-600 focus:outline-2 focus:outline-field-600/30",
                    "disabled:cursor-not-allowed disabled:bg-slate-100"
                  )}
                >
                  <option value="" disabled>
                    Selecione uma seleção…
                  </option>
                  {sortedTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                onClick={submit}
                disabled={isPending || !isDirty}
                className="shrink-0"
              >
                {isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>

            <div aria-live="polite" className="min-h-4 text-xs">
              {state.kind === "saved" && !isDirty ? (
                <span className="font-semibold text-field-700">Salvo ✓</span>
              ) : null}
              {state.kind === "error" ? (
                <span role="alert" className="font-semibold text-cup-red">
                  {state.message}
                </span>
              ) : null}
            </div>

            <p className="text-xs text-slate-400">
              Editável até o início do primeiro jogo do mata-mata.
            </p>
          </>
        )}
      </CardBody>
    </Card>
  );
}
