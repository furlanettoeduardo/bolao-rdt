import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant =
  | "neutral"
  | "success"
  | "live"
  | "warning"
  | "info"
  | "gold";

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: "bg-slate-100 text-slate-600",
  success: "bg-field-100 text-field-800",
  live: "bg-cup-red text-white",
  warning: "bg-amber-100 text-amber-800",
  info: "bg-sky-100 text-sky-800",
  gold: "bg-amber-400/20 text-amber-700",
};

export function Badge({
  variant = "neutral",
  className,
  children,
}: {
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        VARIANTS[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
