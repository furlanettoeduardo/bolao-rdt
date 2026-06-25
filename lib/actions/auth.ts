"use server";

// Ações de autenticação — cadastro, login e logout.
// Validação com zod; senha com bcrypt; código de acesso opcional via env.

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";

export interface AuthFormState {
  error?: string;
}

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe seu nome (mínimo 2 caracteres).")
    .max(60, "Nome muito longo (máximo 60 caracteres)."),
  email: z.email("Informe um email válido."),
  password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres."),
  registrationCode: z.string().optional(),
});

export async function registerAction(
  _prev: AuthFormState | undefined,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    registrationCode: formData.get("registrationCode") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const requiredCode = process.env.REGISTRATION_CODE;
  if (requiredCode && parsed.data.registrationCode !== requiredCode) {
    return { error: "Código de acesso inválido." };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Mensagem neutra: evita confirmar de forma determinística que o email já
    // tem conta (mitiga enumeração), mas guia quem de fato já é cadastrado.
    return {
      error:
        "Não foi possível concluir o cadastro. Se você já tem conta, faça login.",
    };
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const created = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash,
      role: adminEmail && email === adminEmail ? "ADMIN" : "USER",
    },
  });

  await recordAudit({
    action: "auth.register",
    category: "auth",
    summary: `Novo cadastro: ${created.name} (${created.email}).`,
    actor: { id: created.id, name: created.name, email: created.email },
    targetType: "user",
    targetId: created.id,
    targetLabel: created.name,
    metadata: { role: created.role },
  });

  // Login automático após o cadastro (lança NEXT_REDIRECT em caso de sucesso)
  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Conta criada, mas o login falhou. Entre manualmente." };
    }
    throw error;
  }
  return {};
}

export async function loginAction(
  _prev: AuthFormState | undefined,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Informe email e senha." };
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      // Tentativa de login malsucedida — registra com IP (valor de segurança).
      // O login BEM-sucedido é registrado pelo evento signIn do Auth.js.
      await recordAudit({
        action: "auth.login.failed",
        category: "auth",
        summary: `Tentativa de login falhou: ${email}.`,
        ok: false,
        actor: { id: null, name: null, email },
        metadata: { reason: error.type },
      });
      return error.type === "CredentialsSignin"
        ? { error: "Email ou senha incorretos." }
        : { error: "Não foi possível entrar. Tente novamente." };
    }
    throw error; // NEXT_REDIRECT — login deu certo
  }
  return {};
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
