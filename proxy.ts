// Proteção de rotas (proxy = middleware do Next 16).
// Usa apenas auth.config.ts — edge-safe, sem Prisma/bcrypt.

import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Tudo, exceto rotas de API (auth/cron têm proteção própria) e assets
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
