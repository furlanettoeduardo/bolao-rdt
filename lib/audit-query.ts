// Leitura paginada da trilha de auditoria (AuditLog). Sem checagem de acesso
// aqui — quem chama (página admin / server action) é responsável por exigir
// ADMIN. Retorna DTOs já serializáveis (datas como ISO string).

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export const AUDIT_CATEGORIES = [
  "auth",
  "prediction",
  "profile",
  "admin",
] as const;
export type AuditCategoryFilter = (typeof AUDIT_CATEGORIES)[number];

export interface AuditLogDTO {
  id: string;
  /** ISO UTC */
  createdAt: string;
  category: string;
  action: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  summary: string;
  metadata: unknown;
  ip: string | null;
  userAgent: string | null;
  ok: boolean;
}

export interface AuditLogPage {
  rows: AuditLogDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditQueryParams {
  page?: number;
  pageSize?: number;
  category?: AuditCategoryFilter | null;
  search?: string | null;
}

export async function queryAuditLogs(
  params: AuditQueryParams = {}
): Promise<AuditLogPage> {
  const page = Math.max(0, Math.floor(params.page ?? 0));
  const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 20)));
  const search = params.search?.trim();

  const where: Prisma.AuditLogWhereInput = {
    ...(params.category ? { category: params.category } : {}),
    ...(search
      ? {
          OR: [
            { summary: { contains: search, mode: "insensitive" } },
            { action: { contains: search, mode: "insensitive" } },
            { actorName: { contains: search, mode: "insensitive" } },
            { actorEmail: { contains: search, mode: "insensitive" } },
            { targetLabel: { contains: search, mode: "insensitive" } },
            { ip: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  let total = 0;
  let rows: Awaited<ReturnType<typeof prisma.auditLog.findMany>> = [];
  try {
    [total, rows] = await prisma.$transaction([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: page * pageSize,
        take: pageSize,
      }),
    ]);
  } catch (err) {
    // P2021 = tabela não existe (código no ar antes da migração rodar).
    // Falha suave: devolve página vazia em vez de quebrar o /admin.
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2021"
    ) {
      return { rows: [], total: 0, page, pageSize };
    }
    throw err;
  }

  return {
    total,
    page,
    pageSize,
    rows: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      category: r.category,
      action: r.action,
      actorId: r.actorId,
      actorName: r.actorName,
      actorEmail: r.actorEmail,
      targetType: r.targetType,
      targetId: r.targetId,
      targetLabel: r.targetLabel,
      summary: r.summary,
      metadata: r.metadata ?? null,
      ip: r.ip,
      userAgent: r.userAgent,
      ok: r.ok,
    })),
  };
}
