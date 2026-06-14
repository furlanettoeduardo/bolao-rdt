"use server";

// Ações do fluxo "Esqueceu sua senha?":
//  - requestPasswordResetAction: gera token, guarda o hash e envia o link.
//    SEMPRE responde de forma neutra (não revela se o e-mail tem conta).
//  - resetPasswordAction: valida o token e grava a nova senha (uso único).

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import {
  RESET_MAX_REQUESTS_PER_WINDOW,
  RESET_THROTTLE_WINDOW_MINUTES,
  RESET_TOKEN_TTL_MINUTES,
  buildResetUrl,
  findValidResetToken,
  generateResetToken,
  hashResetToken,
} from "@/lib/password-reset";

export interface RequestResetState {
  error?: string;
  sent?: boolean;
}

const requestSchema = z.object({
  email: z.email("Informe um email válido."),
});

export async function requestPasswordResetAction(
  _prev: RequestResetState | undefined,
  formData: FormData
): Promise<RequestResetState> {
  const parsed = requestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Email inválido." };
  }

  const email = parsed.data.email.trim().toLowerCase();

  // Todo o trabalho roda APÓS a resposta (next/server `after`): assim a
  // latência é a mesma exista ou não o e-mail, e o tempo de resposta não vira
  // um oráculo de enumeração. Na Vercel o `after` mantém a função viva até
  // concluir (waitUntil), então o e-mail é enviado de forma confiável.
  after(async () => {
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return;

      const now = Date.now();

      // Limpa tokens já expirados (não afeta a janela do throttle, menor que o
      // TTL, então as contagens recentes permanecem intactas).
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, expiresAt: { lt: new Date(now) } },
      });

      // Throttle por usuário: no máximo N pedidos por janela (anti-abuso).
      const since = new Date(now - RESET_THROTTLE_WINDOW_MINUTES * 60_000);
      const recent = await prisma.passwordResetToken.count({
        where: { userId: user.id, createdAt: { gte: since } },
      });
      if (recent >= RESET_MAX_REQUESTS_PER_WINDOW) return;

      const rawToken = generateResetToken();
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashResetToken(rawToken),
          expiresAt: new Date(now + RESET_TOKEN_TTL_MINUTES * 60_000),
        },
      });
      await sendPasswordResetEmail(
        user.email,
        user.name,
        buildResetUrl(rawToken)
      );
    } catch (err) {
      // Nunca propaga para a resposta (neutra por design); só registra.
      console.error("[password-reset] falha ao processar pedido:", err);
    }
  });

  // Resposta sempre neutra e de tempo constante — não revela se o e-mail
  // existe (anti-enumeração).
  return { sent: true };
}

export interface ResetPasswordState {
  error?: string;
}

const resetSchema = z
  .object({
    token: z.string().min(1, "Token ausente."),
    password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "As senhas não coincidem.",
    path: ["confirm"],
  });

export async function resetPasswordAction(
  _prev: ResetPasswordState | undefined,
  formData: FormData
): Promise<ResetPasswordState> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const token = await findValidResetToken(parsed.data.token);
  if (!token) {
    return {
      error: "Link inválido ou expirado. Solicite um novo na tela de login.",
    };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  // Grava a nova senha, marca este token como usado (uso único explícito, lido
  // por findValidResetToken) e remove todos os OUTROS tokens do usuário — após
  // o reset, qualquer link ainda em circulação deixa de funcionar.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: token.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { userId: token.userId, id: { not: token.id } },
    }),
  ]);

  redirect("/login?reset=ok");
}
