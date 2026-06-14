// Helpers do fluxo "Esqueceu sua senha?" — geração/hash de token e validação.
// O token cru só aparece no link enviado por e-mail; no banco guardamos apenas
// o hash sha256 (o token tem 256 bits de entropia, então sha256 basta — não
// precisa de bcrypt como nas senhas escolhidas por humanos).

import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

/** Validade do link de redefinição (minutos). */
export const RESET_TOKEN_TTL_MINUTES = 60;
/** Janela e limite do throttle por usuário (anti-abuso de envio de e-mail). */
export const RESET_THROTTLE_WINDOW_MINUTES = 15;
export const RESET_MAX_REQUESTS_PER_WINDOW = 3;

/** Gera o token cru (vai no link) — 32 bytes ⇒ 256 bits de entropia. */
export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Hash determinístico guardado no banco. */
export function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Base pública do site para montar links absolutos no e-mail. Prioriza
 * NEXT_PUBLIC_APP_URL (domínio próprio); cai para as URLs de runtime da Vercel.
 * Lança se nada estiver configurado — melhor falhar e logar do que enviar um
 * link relativo quebrado por e-mail.
 */
export function resolveAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (explicit) return explicit;
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost}`;
  throw new Error(
    "NEXT_PUBLIC_APP_URL não configurada — não dá para montar o link de redefinição."
  );
}

/** Monta o link absoluto enviado por e-mail. */
export function buildResetUrl(rawToken: string): string {
  return `${resolveAppBaseUrl()}/redefinir-senha?token=${rawToken}`;
}

/**
 * Busca o token válido (existe, não usado e não expirado) a partir do valor
 * cru. Retorna o registro ou null. Usado tanto na validação da tela quanto na
 * Server Action de reset.
 */
export async function findValidResetToken(rawToken: string) {
  if (!rawToken) return null;
  const token = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(rawToken) },
  });
  if (!token) return null;
  if (token.usedAt) return null;
  if (token.expiresAt.getTime() <= Date.now()) return null;
  return token;
}
