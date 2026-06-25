"use server";

// Ações do painel admin — sync manual, edição de resultado (resiliência
// quando a API falha) e gerenciamento de usuários. Todas exigem role ADMIN.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { recordAudit } from "@/lib/audit";
import { MAX_GOALS } from "@/lib/config";
import { prisma } from "@/lib/db";
import { isFinishedStatus, isKnockoutStage } from "@/lib/match-rules";
import {
  creditChampionIfFinalFinished,
  reconcileGoals,
  rescoreMatch,
  runSync,
} from "@/lib/sync";
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
  for (const path of [
    "/",
    "/palpites",
    "/jogos",
    "/grupos",
    "/chaveamento",
    "/ranking",
    "/galera",
    "/perfil",
    "/admin",
  ]) {
    revalidatePath(path);
  }
}

export async function triggerSyncAction(): Promise<
  ActionResult<{ message: string }>
> {
  if (!(await requireAdmin())) return { ok: false, error: "Acesso negado." };

  const result = await runSync("manual");
  revalidateAll();
  await recordAudit({
    action: "admin.sync",
    category: "admin",
    summary: `Disparou sincronização manual. ${result.message}`,
    ok: result.ok,
    metadata: {
      matchesUpdated: result.matchesUpdated,
      matchesScored: result.matchesScored,
      standingsUpdated: result.standingsUpdated,
    },
  });
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
  // Trava o jogo contra a sincronização com a API. Liga por padrão: o sentido
  // da edição manual é justamente não ser sobrescrito pelo provedor. Desligar
  // devolve o controle à API (o próximo sync volta a atualizar este jogo).
  manualOverride: z.boolean().default(true),
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
  const { matchId, status, homeScore, awayScore, manualOverride } = parsed.data;

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
    data: { status, homeScore, awayScore, advancingTeamId, manualOverride },
  });

  // Acerta a linha do tempo de gols (MatchGoal) para bater com o placar manual,
  // já que a edição não passa pela detecção de gols do sync. Minuto = null
  // (correção manual não tem estimativa de cronômetro).
  await reconcileGoals(matchId, homeScore, awayScore, null);

  // Repontua sempre: ao finalizar, calcula os pontos; ao "des-finalizar" um
  // jogo (correção de engano), rescoreMatch zera os pontos antigos.
  await rescoreMatch(matchId);
  await creditChampionIfFinalFinished();

  await prisma.syncLog.create({
    data: {
      ok: true,
      scope: "manual",
      message: `Resultado editado manualmente (jogo ${match.externalId}): ${homeScore ?? "-"}x${awayScore ?? "-"}, status ${status}${manualOverride ? " — travado da API" : " — liberado p/ API"}.`,
    },
  });

  await recordAudit({
    action: "admin.match.update",
    category: "admin",
    summary: `Editou o resultado do jogo #${match.externalId}: ${homeScore ?? "-"}×${awayScore ?? "-"} (${status})${manualOverride ? " — travado da API" : " — liberado p/ API"}.`,
    targetType: "match",
    targetId: matchId,
    targetLabel: `#${match.externalId}`,
    metadata: {
      before: {
        status: match.status,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
      },
      after: { status, homeScore, awayScore, advancingTeamId },
      manualOverride,
    },
  });

  revalidateAll();
  return { ok: true };
}

// ── Override manual de pontos por palpite ────────────────────────────────────

export interface AdminPredictionRow {
  predictionId: string;
  userName: string;
  homeScore: number;
  awayScore: number;
  /** Pontos calculados automaticamente (null = ainda não pontuado) */
  autoPoints: number | null;
  /** Override manual atual (null = usando o automático) */
  override: number | null;
}

/** Lista os palpites de um jogo para o admin editar os pontos. */
export async function adminListMatchPredictions(
  matchId: string
): Promise<ActionResult<AdminPredictionRow[]>> {
  if (!(await requireAdmin())) return { ok: false, error: "Acesso negado." };

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      predictions: {
        select: {
          id: true,
          homeScore: true,
          awayScore: true,
          points: true,
          pointsOverride: true,
          user: { select: { name: true } },
        },
        orderBy: { user: { name: "asc" } },
      },
    },
  });
  if (!match) return { ok: false, error: "Jogo não encontrado." };

  const rows: AdminPredictionRow[] = match.predictions.map((p) => ({
    predictionId: p.id,
    userName: p.user.name,
    homeScore: p.homeScore,
    awayScore: p.awayScore,
    autoPoints: p.points,
    override: p.pointsOverride,
  }));
  return { ok: true, data: rows };
}

const pointsOverrideSchema = z.object({
  predictionId: z.string().min(1),
  // null = limpar o override (volta ao cálculo automático)
  override: z.number().int().min(0).max(100).nullable(),
});

/**
 * Define/limpa o override de pontos de vários palpites de uma vez. O valor fica
 * fixo: rescoreMatch e o ranking passam a usá-lo no lugar do cálculo automático.
 */
export async function setPredictionPointsBatch(
  updates: { predictionId: string; override: number | null }[]
): Promise<ActionResult<{ updated: number }>> {
  if (!(await requireAdmin())) return { ok: false, error: "Acesso negado." };

  const parsed = z.array(pointsOverrideSchema).max(500).safeParse(updates);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Valores de pontos inválidos (use inteiros de 0 a 100, ou vazio).",
    };
  }
  if (parsed.data.length === 0) return { ok: true, data: { updated: 0 } };

  await prisma.$transaction(
    parsed.data.map((u) =>
      prisma.prediction.update({
        where: { id: u.predictionId },
        data: { pointsOverride: u.override },
      })
    )
  );

  await recordAudit({
    action: "admin.prediction.points_override",
    category: "admin",
    summary: `Ajustou os pontos (override) de ${parsed.data.length} palpite(s).`,
    metadata: { updates: parsed.data },
  });

  revalidateAll();
  return { ok: true, data: { updated: parsed.data.length } };
}

// ── Ajuste manual de pontos por usuário (bônus/penalidade) ───────────────────

export interface UserAdjustmentRow {
  id: string;
  delta: number;
  reason: string | null;
  /** ISO UTC */
  createdAt: string;
}

/** Lista os ajustes de pontos de um usuário e o total acumulado. */
export async function adminListUserAdjustments(
  userId: string
): Promise<ActionResult<{ rows: UserAdjustmentRow[]; total: number }>> {
  if (!(await requireAdmin())) return { ok: false, error: "Acesso negado." };

  const adjustments = await prisma.pointAdjustment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  const rows: UserAdjustmentRow[] = adjustments.map((a) => ({
    id: a.id,
    delta: a.delta,
    reason: a.reason,
    createdAt: a.createdAt.toISOString(),
  }));
  const total = rows.reduce((sum, r) => sum + r.delta, 0);
  return { ok: true, data: { rows, total } };
}

const adjustmentSchema = z.object({
  userId: z.string().min(1),
  delta: z
    .number()
    .int()
    .min(-1000)
    .max(1000)
    .refine((n) => n !== 0, "Informe um valor diferente de zero."),
  reason: z.string().trim().max(120).optional(),
});

export type AddUserAdjustmentInput = z.input<typeof adjustmentSchema>;

/** Acrescenta (delta > 0) ou remove (delta < 0) pontos de um usuário. */
export async function addUserAdjustment(
  input: AddUserAdjustmentInput
): Promise<ActionResult<UserAdjustmentRow>> {
  if (!(await requireAdmin())) return { ok: false, error: "Acesso negado." };

  const parsed = adjustmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        "Ajuste inválido (use inteiros de -1000 a 1000, ≠ 0).",
    };
  }
  const { userId, delta, reason } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });
  if (!user) return { ok: false, error: "Usuário não encontrado." };

  const created = await prisma.pointAdjustment.create({
    data: { userId, delta, reason: reason && reason.length > 0 ? reason : null },
  });

  await recordAudit({
    action: "admin.adjustment.add",
    category: "admin",
    summary: `Lançou ajuste de ${delta > 0 ? "+" : ""}${delta} ponto(s) para ${user.name}${reason ? ` (${reason})` : ""}.`,
    targetType: "user",
    targetId: user.id,
    targetLabel: user.name,
    metadata: { delta, reason: reason ?? null },
  });

  revalidateAll();
  return {
    ok: true,
    data: {
      id: created.id,
      delta: created.delta,
      reason: created.reason,
      createdAt: created.createdAt.toISOString(),
    },
  };
}

/** Remove um lançamento de ajuste de pontos. */
export async function deleteUserAdjustment(
  adjustmentId: string
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Acesso negado." };

  // Lê antes de apagar para registrar o que foi removido na auditoria.
  const adj = await prisma.pointAdjustment.findUnique({
    where: { id: adjustmentId },
    include: { user: { select: { id: true, name: true } } },
  });

  await prisma.pointAdjustment.delete({ where: { id: adjustmentId } });

  await recordAudit({
    action: "admin.adjustment.delete",
    category: "admin",
    summary: adj
      ? `Removeu ajuste de ${adj.delta > 0 ? "+" : ""}${adj.delta} ponto(s) de ${adj.user.name}.`
      : "Removeu um ajuste de pontos.",
    targetType: "user",
    targetId: adj?.user.id ?? null,
    targetLabel: adj?.user.name ?? null,
    metadata: adj ? { delta: adj.delta, reason: adj.reason } : null,
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

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, role: true },
  });
  await prisma.user.update({ where: { id: userId }, data: { role } });
  await recordAudit({
    action: "admin.user.set_role",
    category: "admin",
    summary: `Alterou o papel de ${target?.name ?? userId} para ${role}.`,
    targetType: "user",
    targetId: userId,
    targetLabel: target?.name ?? null,
    metadata: { from: target?.role ?? null, to: role },
  });
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteUserAction(userId: string): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { ok: false, error: "Acesso negado." };
  if (userId === adminId) {
    return { ok: false, error: "Você não pode excluir a própria conta." };
  }

  // Captura os dados ANTES de excluir — o snapshot fica preservado no log.
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, role: true },
  });
  await prisma.user.delete({ where: { id: userId } });
  await recordAudit({
    action: "admin.user.delete",
    category: "admin",
    summary: `Excluiu o usuário ${target?.name ?? userId}${target?.email ? ` (${target.email})` : ""}.`,
    targetType: "user",
    targetId: userId,
    targetLabel: target?.name ?? null,
    metadata: { email: target?.email ?? null, role: target?.role ?? null },
  });
  revalidateAll();
  return { ok: true };
}
