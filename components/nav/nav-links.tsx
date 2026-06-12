"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export const NAV_ITEMS = [
  { href: "/", label: "Início" },
  { href: "/palpites", label: "Palpites" },
  { href: "/jogos", label: "Jogos" },
  { href: "/grupos", label: "Grupos" },
  { href: "/chaveamento", label: "Chaveamento" },
  { href: "/ranking", label: "Ranking" },
] as const;

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Navegação principal — visível em telas md+ (mobile usa a barra inferior) */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegação principal" className="hidden items-center gap-1 md:flex">
      {NAV_ITEMS.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-field-700 text-white"
                : "text-slate-200 hover:bg-field-800 hover:text-white"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
