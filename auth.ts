// Instância completa do Auth.js (runtime Node) — inclui o provider
// Credentials com verificação de senha via bcrypt contra o banco.

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { authConfig } from "./auth.config";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  // Auditoria de login/logout — o login BEM-sucedido (inclusive o auto-login
  // após o cadastro) e o logout passam por aqui. Tentativa de login falha é
  // registrada na própria loginAction. recordAudit nunca quebra o fluxo.
  events: {
    async signIn({ user }) {
      await recordAudit({
        action: "auth.login",
        category: "auth",
        summary: `Login de ${user.email ?? user.name ?? "usuário"}.`,
        actor: {
          id: user.id ?? null,
          name: user.name ?? null,
          email: user.email ?? null,
        },
        targetType: "user",
        targetId: user.id ?? null,
        targetLabel: user.name ?? null,
      });
    },
    async signOut(message) {
      const token = "token" in message ? message.token : null;
      await recordAudit({
        action: "auth.logout",
        category: "auth",
        summary: `Logout${token?.email ? ` de ${token.email}` : ""}.`,
        actor: token
          ? {
              id: token.sub ?? null,
              name: token.name ?? null,
              email: token.email ?? null,
            }
          : { id: null, name: null, email: null },
        targetType: "user",
        targetId: token?.sub ?? null,
      });
    },
  },
  providers: [
    Credentials({
      name: "Credenciais",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const passwordOk = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash
        );
        if (!passwordOk) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
});
