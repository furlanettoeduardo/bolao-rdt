"use client";

// Coordena o salvamento em lote dos palpites da página /palpites.
// Cada PredictionCard se registra aqui e expõe seu rascunho atual via getter;
// a barra "Salvar todos" coleta os rascunhos salváveis e chama a Server Action
// em lote. O salvamento individual e o auto-save no blur continuam funcionando
// — esta barra é só um atalho para gravar tudo de uma vez.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { savePredictions, type SavePredictionInput } from "@/lib/actions/predictions";

export interface PredictionDraft {
  matchId: string;
  homeScore: number;
  awayScore: number;
  advancingTeamId: string | null;
  /** dirty && válido && não travado — pronto para gravar */
  saveable: boolean;
}

interface BoardApi {
  register: (matchId: string, getDraft: () => PredictionDraft) => () => void;
  report: () => void;
}

const PredictionsBoardContext = createContext<BoardApi | null>(null);

/** Disponível para os PredictionCard; null fora da página de palpites. */
export function usePredictionsBoard(): BoardApi | null {
  return useContext(PredictionsBoardContext);
}

type Feedback =
  | { kind: "idle" }
  | { kind: "success"; saved: number }
  | { kind: "partial"; saved: number; failed: number }
  | { kind: "error"; message: string };

export function PredictionsBoard({ children }: { children: ReactNode }) {
  const registry = useRef(new Map<string, () => PredictionDraft>());
  const [pendingCount, setPendingCount] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  const recompute = useCallback(() => {
    let count = 0;
    for (const getDraft of registry.current.values()) {
      if (getDraft().saveable) count += 1;
    }
    setPendingCount(count);
  }, []);

  const register = useCallback<BoardApi["register"]>(
    (matchId, getDraft) => {
      registry.current.set(matchId, getDraft);
      return () => {
        registry.current.delete(matchId);
      };
    },
    []
  );

  const api = useMemo<BoardApi>(
    () => ({ register, report: recompute }),
    [register, recompute]
  );

  const handleSaveAll = useCallback(() => {
    const drafts: PredictionDraft[] = [];
    for (const getDraft of registry.current.values()) {
      const draft = getDraft();
      if (draft.saveable) drafts.push(draft);
    }
    if (drafts.length === 0) return;

    const inputs: SavePredictionInput[] = drafts.map((d) => ({
      matchId: d.matchId,
      homeScore: d.homeScore,
      awayScore: d.awayScore,
      advancingTeamId: d.advancingTeamId,
    }));

    setFeedback({ kind: "idle" });
    startTransition(async () => {
      const result = await savePredictions(inputs);
      if (result.ok) {
        const { saved, failed } = result.data!;
        setFeedback(
          failed.length > 0
            ? { kind: "partial", saved, failed: failed.length }
            : { kind: "success", saved }
        );
      } else {
        setFeedback({ kind: "error", message: result.error });
      }
      // Os cards re-renderizam com props frescas após a revalidação e reportam
      // de novo; recalculamos aqui também para não depender só desse ciclo.
      recompute();
    });
  }, [recompute]);

  // Limpa a mensagem de sucesso/parcial automaticamente após alguns segundos.
  useEffect(() => {
    if (feedback.kind !== "success" && feedback.kind !== "partial") return;
    const id = setTimeout(() => setFeedback({ kind: "idle" }), 5000);
    return () => clearTimeout(id);
  }, [feedback]);

  const show = pendingCount > 0 || feedback.kind !== "idle";

  return (
    <PredictionsBoardContext.Provider value={api}>
      {children}
      {show ? (
        <div className="pointer-events-none sticky bottom-20 z-30 flex justify-center md:bottom-6">
          <div className="pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full border border-field-700 bg-field-800 py-2 pl-4 pr-2 text-white shadow-lg">
            <span className="min-w-0 text-sm font-semibold" aria-live="polite">
              {feedback.kind === "error" ? (
                <span className="text-amber-200">{feedback.message}</span>
              ) : feedback.kind === "success" ? (
                <>
                  {feedback.saved}{" "}
                  {feedback.saved === 1 ? "palpite salvo" : "palpites salvos"} ✓
                  <span className="font-normal text-white/70">
                    {" "}· dá pra atualizar até o jogo começar
                  </span>
                </>
              ) : feedback.kind === "partial" ? (
                <>
                  {feedback.saved} salvo{feedback.saved === 1 ? "" : "s"} ·{" "}
                  <span className="text-amber-200">
                    {feedback.failed} recusado{feedback.failed === 1 ? "" : "s"}
                  </span>
                </>
              ) : pendingCount === 1 ? (
                "1 palpite para salvar"
              ) : (
                `${pendingCount} palpites para salvar`
              )}
            </span>
            {pendingCount > 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveAll}
                disabled={isPending}
                className="shrink-0 border-white/30 bg-white/10 text-white hover:bg-white/20"
              >
                {isPending ? "Salvando…" : "Salvar todos"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </PredictionsBoardContext.Provider>
  );
}
