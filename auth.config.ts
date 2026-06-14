// Configuração edge-safe do Auth.js — usada pelo proxy (middleware).
// NÃO importe Prisma nem bcrypt aqui: este arquivo roda no Edge Runtime.

import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/lib/types";

/** Rotas acessíveis sem login */
const PUBLIC_PATHS = new Set([
  "/login",
  "/cadastro",
  "/regras",
  "/esqueci-senha",
  "/redefinir-senha",
]);

// Rotas públicas que NÃO devem expulsar quem já está logado — caso de quem
// abre um link de reset (recebido por e-mail) com uma sessão ainda ativa.
const PUBLIC_WHEN_LOGGED_IN = new Set([
  "/regras",
  "/esqueci-senha",
  "/redefinir-senha",
]);

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    // O provider Credentials (com Prisma + bcrypt) é adicionado em auth.ts,
    // que só roda no runtime Node.
  ],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;

      if (PUBLIC_PATHS.has(pathname)) {
        // Usuário logado não precisa ver login/cadastro
        if (isLoggedIn && !PUBLIC_WHEN_LOGGED_IN.has(pathname)) {
          return Response.redirect(new URL("/", request.nextUrl));
        }
        return true;
      }

      if (pathname.startsWith("/admin")) {
        if (!isLoggedIn) return false; // redireciona para /login
        if (auth.user.role !== "ADMIN") {
          return Response.redirect(new URL("/", request.nextUrl));
        }
        return true;
      }

      return isLoggedIn;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      // Disparado por unstable_update (ex.: troca de nome no perfil) — reflete o
      // novo nome no token para o header/saudação sem exigir novo login.
      if (trigger === "update" && session && typeof session === "object") {
        const newName = (session as { user?: { name?: string | null } }).user
          ?.name;
        if (newName) token.name = newName;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
