"use server";

// Ações do painel admin — sync manual, edição de resultado (resiliência
// quando a API falha) e gerenciamento de usuários. Todas exigem role ADMIN.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { MAX_GOALS } from "@/lib/config";
import { prisma } from "@/lib/db";
import { isFinishedStatus, isKnockoutStage } from "@/lib/match-rules";
import { creditChampionIfFinalFinished, rescoreMatch, runSync } from "@/lib/sync";
import type { ActionResult, MatchStatus } from "@/lib/types";

async function requireAdmin(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  // Revalida a role contra o banco — o claim do JWT pode estar defasado por até
  // a vida do token (admin rebaixado via setUserRoleAction, ou conta excluída).
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || user.role !== "ADMIN") return null;
  return session.user.id;
}

function revalidateAll() {
  for (const path of ["/", "/palpites", "/jogos", "/grupos", "/chaveamento", "/ranking", "/admin"]) {
    revalidatePath(path);
  }
}

export async function triggerSyncAction(): Promise<
  ActionResult<{ message: string }>
> {
  if (!(await requireAdmin())) return { ok: false, error: "Acesso negado." };

  const result = await runSync("manual");
  revalidateAll();
  return result.ok
    ? { ok: true, data: { message: result.message } }
    : { ok: false, error: result.message };
}

const matchUpdateSchema = z.object({
  matchId: z.string().min(1),
  status: z.enum([
    "SCHEDULED",
    "IN_PLAY",
    "PAUSED",
    "FINISHED",
    "SUSPENDED",
    "POSTPONED",
    "CANCELLED",
    "AWARDED",
  ] satisfies readonly MatchStatus[]),
  homeScore: z.number().int().min(0).max(MAX_GOALS).nullable(),
  awayScore: z.number().int().min(0).max(MAX_GOALS).nullable(),
  advancingTeamId: z.string().min(1).nullish(),
});

export type AdminMatchUpdateInput = z.input<typeof matchUpdateSchema>;

/**
 * Edição manual de resultado/status — usada quando a API externa falha.
 * Ao finalizar um jogo, repontua todos os palpites automaticamente.
 */
export async function updateMatchAction(
  input: AdminMatchUpdateInput
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Acesso negado." };

  const parsed = matchUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos." };
  }
  const { matchId, status, homeScore, awayScore } = parsed.data;

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return { ok: false, error: "Jogo não encontrado." };

  const finished = isFinishedStatus(status);
  if (finished && (homeScore == null || awayScore == null)) {
    return {
      ok: false,
      error: "Para finalizar um jogo, informe o placar dos dois times.",
    };
  }

  let advancingTeamId: string | null = null;
  if (isKnockoutStage(match.stage) && finished) {
    if (homeScore! > awayScore!) {
      advancingTeamId = match.homeTeamId;
    } else if (awayScore! > homeScore!) {
      advancingTeamId = match.awayTeamId;
    } else {
      // Empate no tempo regulamentar — o admin informa quem avançou
      const choice = parsed.data.advancingTeamId ?? null;
      if (
        !choice ||
        (choice !== match.homeTeamId && choice !== match.awayTeamId)
      ) {
        return {
          ok: false,
          error:
            "Empate no mata-mata: informe quem avançou (prorrogação/pênaltis).",
        };
      }
      advancingTeamId = choice;
    }
  }

  await prisma.match.update({
    where: { id: matchId },
    data: { status, homeScore, awayScore, advancingTeamId },
  });

  // Repontua sempre: ao finalizar, calcula os pontos; ao "des-finalizar" um
  // jogo (correção de engano), rescoreMatch zera os pontos antigos.
  await rescoreMatch(matchId);
  await creditChampionIfFinalFinished();

  await prisma.syncLog.create({
    data: {
      ok: true,
      scope: "manual",
      message: `Resultado editado manualmente (jogo ${match.externalId}): ${homeScore ?? "-"}x${awayScore ?? "-"}, status ${status}.`,
    },
  });

  revalidateAll();
  return { ok: true };
}

export async function setUserRoleAction(
  userId: string,
  role: "USER" | "ADMIN"
): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { ok: false, error: "Acesso negado." };
  if (userId === adminId) {
    return { ok: false, error: "Você não pode alterar seu próprio papel." };
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteUserAction(userId: string): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { ok: false, error: "Acesso negado." };
  if (userId === adminId) {
    return { ok: false, error: "Você não pode excluir a própria conta." };
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidateAll();
  return { ok: true };
}
