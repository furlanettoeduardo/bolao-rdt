import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// Tooltip leve, só com CSS — aparece no hover e no foco (teclado/toque).
// O gatilho é focável (tabIndex=0) com aria-label, então leitores de tela e
// usuários de teclado/celular também acessam a explicação.

export function Tooltip({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("group relative inline-flex", className)}>
      <span tabIndex={0} aria-label={label} className="cursor-help outline-none">
        {children}
      </span>
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute right-0 top-full z-20 mt-1 w-52 rounded-lg bg-slate-900 px-3 py-2",
          "text-left text-[11px] font-medium normal-case leading-snug tracking-normal text-white shadow-lg",
          "opacity-0 transition-opacity duration-150",
          "group-hover:opacity-100 group-focus-within:opacity-100"
        )}
      >
        {label}
      </span>
    </span>
  );
}
