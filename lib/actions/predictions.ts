"use server";

// Ações de palpite — placar por jogo e palpite de campeão.
// Regras críticas:
//   • trava SEMPRE comparada em UTC no servidor (nunca o relógio do cliente)
//   • mata-mata: palpite empatado exige escolher quem avança
//   • campeão: editável até o kickoff do primeiro jogo do mata-mata

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { MAX_GOALS } from "@/lib/config";
import { prisma } from "@/lib/db";
import { isKnockoutStage, isMatchLocked } from "@/lib/match-rules";
import type { ActionResult } from "@/lib/types";

const predictionSchema = z.object({
  matchId: z.string().min(1),
  homeScore: z.number().int().min(0).max(MAX_GOALS),
  awayScore: z.number().int().min(0).max(MAX_GOALS),
  advancingTeamId: z.string().min(1).nullish(),
});

export type SavePredictionInput = z.input<typeof predictionSchema>;

function revalidateMatchPages(matchId: string, userId: string) {
  revalidatePath("/");
  revalidatePath("/palpites");
  revalidatePath("/jogos");
  revalidatePath(`/jogos/${matchId}`);
  revalidatePath("/perfil");
  revalidatePath(`/usuarios/${userId}`);
}

export async function savePrediction(
  input: SavePredictionInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Faça login para palpitar." };
  }

  const parsed = predictionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Palpite inválido: placares de 0 a ${MAX_GOALS}.`,
    };
  }
  const { matchId, homeScore, awayScore } = parsed.data;

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) {
    return { ok: false, error: "Jogo não encontrado." };
  }
  if (isMatchLocked(match)) {
    return { ok: false, error: "Palpites encerrados para este jogo." };
  }

  // Mata-mata: empate exige escolher quem avança; vitória infere do placar
  let advancingTeamId: string | null = null;
  if (isKnockoutStage(match.stage) && homeScore === awayScore) {
    const choice = parsed.data.advancingTeamId ?? null;
    if (!match.homeTeamId || !match.awayTeamId) {
      return {
        ok: false,
        error:
          "Os times deste confronto ainda não foram definidos — para palpitar empate, aguarde a definição.",
      };
    }
    if (
      !choice ||
      (choice !== match.homeTeamId && choice !== match.awayTeamId)
    ) {
      return {
        ok: false,
        error: "Em caso de empate no mata-mata, escolha quem avança.",
      };
    }
    advancingTeamId = choice;
  }

  await prisma.prediction.upsert({
    where: { userId_matchId: { userId: session.user.id, matchId } },
    create: {
      userId: session.user.id,
      matchId,
      homeScore,
      awayScore,
      advancingTeamId,
    },
    update: { homeScore, awayScore, advancingTeamId },
  });

  revalidateMatchPages(matchId, session.user.id);
  return { ok: true };
}

// ── Salvamento em lote (botão "Salvar todos") ────────────────────────────────

const batchSchema = z.array(predictionSchema).min(1).max(120);

export interface BatchSaveResult {
  /** Quantos palpites foram efetivamente gravados */
  saved: number;
  /** Palpites recusados pelo servidor (travados, inválidos, etc.) */
  failed: { matchId: string; error: string }[];
}

/**
 * Salva vários palpites de uma vez. Cada item é validado individualmente com as
 * MESMAS regras de `savePrediction` (trava em UTC no servidor, mata-mata exige
 * quem avança). Itens válidos são gravados numa única transação; os recusados
 * voltam em `failed` sem abortar os demais.
 */
export async function savePredictions(
  inputs: SavePredictionInput[]
): Promise<ActionResult<BatchSaveResult>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Faça login para palpitar." };
  }
  const userId = session.user.id;

  const parsed = batchSchema.safeParse(inputs);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Palpite inválido: placares de 0 a ${MAX_GOALS}.`,
    };
  }
  const items = parsed.data;

  // Carrega todos os jogos referenciados de uma vez (evita N queries)
  const ids = [...new Set(items.map((i) => i.matchId))];
  const matches = await prisma.match.findMany({ where: { id: { in: ids } } });
  const byId = new Map(matches.map((m) => [m.id, m]));

  const now = new Date();
  const valid: {
    matchId: string;
    homeScore: number;
    awayScore: number;
    advancingTeamId: string | null;
  }[] = [];
  const failed: { matchId: string; error: string }[] = [];

  for (const item of items) {
    const match = byId.get(item.matchId);
    if (!match) {
      failed.push({ matchId: item.matchId, error: "Jogo não encontrado." });
      continue;
    }
    if (isMatchLocked(match, now)) {
      failed.push({
        matchId: item.matchId,
        error: "Palpites encerrados para este jogo.",
      });
      continue;
    }

    let advancingTeamId: string | null = null;
    if (isKnockoutStage(match.stage) && item.homeScore === item.awayScore) {
      const choice = item.advancingTeamId ?? null;
      if (!match.homeTeamId || !match.awayTeamId) {
        failed.push({
          matchId: item.matchId,
          error: "Times do confronto ainda não definidos.",
        });
        continue;
      }
      if (
        !choice ||
        (choice !== match.homeTeamId && choice !== match.awayTeamId)
      ) {
        failed.push({
          matchId: item.matchId,
          error: "Empate no mata-mata: escolha quem avança.",
        });
        continue;
      }
      advancingTeamId = choice;
    }

    valid.push({
      matchId: item.matchId,
      homeScore: item.homeScore,
      awayScore: item.awayScore,
      advancingTeamId,
    });
  }

  if (valid.length > 0) {
    await prisma.$transaction(
      valid.map((v) =>
        prisma.prediction.upsert({
          where: { userId_matchId: { userId, matchId: v.matchId } },
          create: {
            userId,
            matchId: v.matchId,
            homeScore: v.homeScore,
            awayScore: v.awayScore,
            advancingTeamId: v.advancingTeamId,
          },
          update: {
            homeScore: v.homeScore,
            awayScore: v.awayScore,
            advancingTeamId: v.advancingTeamId,
          },
        })
      )
    );

    revalidatePath("/");
    revalidatePath("/palpites");
    revalidatePath("/jogos");
    revalidatePath("/perfil");
    revalidatePath(`/usuarios/${userId}`);
  }

  return { ok: true, data: { saved: valid.length, failed } };
}

export async function saveChampionPick(teamId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Faça login para escolher seu campeão." };
  }

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    return { ok: false, error: "Seleção não encontrada." };
  }

  const firstKnockout = await prisma.match.findFirst({
    where: { stage: { not: "GROUP" } },
    orderBy: { kickoff: "asc" },
    select: { kickoff: true },
  });
  if (firstKnockout && firstKnockout.kickoff.getTime() <= Date.now()) {
    return {
      ok: false,
      error: "O mata-mata já começou — palpite de campeão encerrado.",
    };
  }

  await prisma.championPick.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, teamId },
    update: { teamId },
  });

  revalidatePath("/");
  revalidatePath("/chaveamento");
  revalidatePath("/perfil");
  return { ok: true };
}
