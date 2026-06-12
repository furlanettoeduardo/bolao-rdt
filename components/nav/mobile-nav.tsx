"use client";

// Barra de navegação inferior — mobile-first.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { isActivePath } from "./nav-links";

const ITEMS = [
  { href: "/", label: "Início", icon: HomeIcon },
  { href: "/palpites", label: "Palpites", icon: PencilIcon },
  { href: "/jogos", label: "Jogos", icon: BallIcon },
  { href: "/grupos", label: "Grupos", icon: TableIcon },
  { href: "/ranking", label: "Ranking", icon: TrophyIcon },
] as const;

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                  active ? "text-field-700" : "text-slate-500"
                )}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type IconProps = { className?: string };

function HomeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />
    </svg>
  );
}

function PencilIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.86 4.49 2.65 2.65L7.62 19.02l-3.62 1 .97-3.65zm0 0 1.06-1.06a1.87 1.87 0 0 1 2.65 2.65l-1.06 1.06" />
    </svg>
  );
}

function BallIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5 8 10.4l1.5 4.6h5L16 10.4zM12 3v4.5M3.6 9.5l4.4.9M5.5 18.5l4-3.5M14.5 15l4 3.5M20.4 9.5l-4.4.9" />
    </svg>
  );
}

function TableIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M3 14h18M9 4v16" />
    </svg>
  );
}

function TrophyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 4h8v5a4 4 0 0 1-8 0zM8 5H5a3 3 0 0 0 3 4M16 5h3a3 3 0 0 1-3 4M12 13v3m-3.5 4h7M10 17h4l.5 3h-5z" />
    </svg>
  );
}
