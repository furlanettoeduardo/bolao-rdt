// Cabeçalho do site — Server Component que lê a sessão.

import Link from "next/link";
import { auth } from "@/auth";
import { APP_NAME } from "@/lib/config";
import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";

export async function Header() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-40">
      <div aria-hidden className="cup-stripe h-1" />
      <div className="bg-field-900 text-white shadow-md">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-base font-bold tracking-tight"
          >
            <span aria-hidden>⚽</span>
            <span>{APP_NAME}</span>
          </Link>

          {session?.user ? (
            <div className="flex items-center gap-2">
              <NavLinks />
              <UserMenu
                name={session.user.name ?? "Usuário"}
                isAdmin={session.user.role === "ADMIN"}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm font-medium">
              <Link href="/regras" className="text-slate-200 hover:text-white">
                Regras
              </Link>
              <Link
                href="/login"
                className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20"
              >
                Entrar
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
