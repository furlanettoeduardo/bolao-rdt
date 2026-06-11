// Configuração edge-safe do Auth.js — usada pelo proxy (middleware).
// NÃO importe Prisma nem bcrypt aqui: este arquivo roda no Edge Runtime.

import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/lib/types";

/** Rotas acessíveis sem login */
const PUBLIC_PATHS = new Set(["/login", "/cadastro", "/regras"]);

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
        if (isLoggedIn && pathname !== "/regras") {
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
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
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
