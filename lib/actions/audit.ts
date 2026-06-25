"use server";

// Leitura da trilha de auditoria pelo painel admin (paginação + filtros).
// Exige role ADMIN — revalidada contra o banco (defesa em profundidade).

import { z } from "zod";
import { auth } from "@/auth";
import {
  AUDIT_CATEGORIES,
  queryAuditLogs,
  type AuditLogPage,
} from "@/lib/audit-query";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/lib/types";

async function isAdmin(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  return user?.role === "ADMIN";
}

const querySchema = z.object({
  page: z.number().int().min(0).max(100000).default(0),
  pageSize: z.number().int().min(1).max(100).default(20),
  category: z.enum(AUDIT_CATEGORIES).nullish(),
  search: z.string().trim().max(120).nullish(),
});

export type GetAuditLogPageInput = z.input<typeof querySchema>;

export async function getAuditLogPage(
  input: GetAuditLogPageInput
): Promise<ActionResult<AuditLogPage>> {
  if (!(await isAdmin())) return { ok: false, error: "Acesso negado." };

  const parsed = querySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Filtros inválidos." };

  const data = await queryAuditLogs(parsed.data);
  return { ok: true, data };
}
