"use client";

// Menu do usuário (dropdown) — perfil, regras, admin e sair.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/cn";

export function UserMenu({
  name,
  isAdmin,
}: {
  name: string;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = name.trim().charAt(0).toUpperCase() || "?";

  const itemClass =
    "block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Menu de ${name}`}
        className={cn(
          "flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium text-white transition-colors",
          open ? "bg-field-800" : "hover:bg-field-800"
        )}
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-cup-gold text-xs font-bold text-field-950">
          {initial}
        </span>
        <span className="hidden max-w-28 truncate sm:inline">{name}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          <Link href="/perfil" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            Meu perfil
          </Link>
          <Link href="/galera" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            Palpites da galera
          </Link>
          <Link href="/chaveamento" role="menuitem" className={cn(itemClass, "md:hidden")} onClick={() => setOpen(false)}>
            Chaveamento
          </Link>
          <Link href="/regras" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            Regras do bolão
          </Link>
          {isAdmin ? (
            <Link href="/admin" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
              Painel admin
            </Link>
          ) : null}
          <form action={logoutAction}>
            <button type="submit" role="menuitem" className={cn(itemClass, "border-t border-slate-100 text-cup-red")}>
              Sair
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
