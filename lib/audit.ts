// ─────────────────────────────────────────────────────────────────────────────
// Auditoria — registra ações interativas dos usuários (cadastro, login, palpites,
// perfil, reset de senha e ações de admin) numa trilha imutável (AuditLog),
// visível somente no painel admin.
//
// REGRA DE OURO: `recordAudit` NUNCA pode quebrar a ação que está auditando.
// Tudo roda em try/catch; se a tabela ainda não existir (código no ar antes da
// migração) ou o banco falhar, apenas registramos no console e seguimos.
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export type AuditCategory = "auth" | "prediction" | "profile" | "admin";

export interface AuditActor {
  id?: string | null;
  name?: string | null;
  email?: string | null;
}

export interface RecordAuditInput {
  /** Chave da ação, ex.: "admin.user.delete", "prediction.save" */
  action: string;
  category: AuditCategory;
  /** Descrição curta em pt-BR mostrada na tabela */
  summary: string;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  /** Detalhes estruturados (antes/depois, valores). Deve ser JSON-serializável. */
  metadata?: Record<string, unknown> | null;
  ok?: boolean;
  /**
   * Ator da ação. Se omitido, é resolvido pela sessão atual. Passe explícito
   * quando o ator não vem da sessão (cadastro, reset de senha, eventos do
   * Auth.js) ou para evitar uma chamada extra a `auth()`.
   */
  actor?: AuditActor;
}

export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    const ip = fwd ? (fwd.split(",")[0]?.trim() ?? null) : h.get("x-real-ip");
    const userAgent = h.get("user-agent");

    let actor = input.actor;
    if (actor === undefined) {
      // Import dinâmico evita ciclo de import com auth.ts (que registra
      // login/logout via eventos do Auth.js, sempre passando o ator explícito).
      const { auth } = await import("@/auth");
      const session = await auth();
      actor = session?.user
        ? {
            id: session.user.id ?? null,
            name: session.user.name ?? null,
            email: session.user.email ?? null,
          }
        : { id: null, name: null, email: null };
    }

    await prisma.auditLog.create({
      data: {
        action: input.action,
        category: input.category,
        summary: input.summary,
        actorId: actor.id ?? null,
        actorName: actor.name ?? null,
        actorEmail: actor.email ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        targetLabel: input.targetLabel ?? null,
        metadata:
          input.metadata == null
            ? undefined
            : (input.metadata as Prisma.InputJsonValue),
        ip: ip ?? null,
        userAgent: userAgent ?? null,
        ok: input.ok ?? true,
      },
    });
  } catch (err) {
    // Auditoria é best-effort: nunca propaga para a ação auditada.
    console.error("[audit] falha ao registrar evento:", err);
  }
}
