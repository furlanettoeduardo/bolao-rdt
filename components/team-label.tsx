// Nome da seleção com bandeira — ou o placeholder da API enquanto o
// confronto não está definido (ex.: "1º do Grupo A").

import { cn } from "@/lib/cn";
import type { TeamDTO } from "@/lib/types";
import { TeamFlag } from "./team-flag";

export function TeamLabel({
  team,
  placeholder,
  flagSize = "md",
  bold = false,
  reverse = false,
  className,
}: {
  team: TeamDTO | null;
  placeholder: string | null;
  flagSize?: "sm" | "md" | "lg";
  bold?: boolean;
  /** true → nome antes da bandeira (lado direito do confronto) */
  reverse?: boolean;
  className?: string;
}) {
  if (!team) {
    return (
      <span
        className={cn(
          "text-xs italic text-slate-400 sm:text-sm",
          reverse && "text-right",
          className
        )}
      >
        {placeholder ?? "A definir"}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-2",
        reverse && "flex-row-reverse",
        className
      )}
    >
      <TeamFlag
        flagUrl={team.flagUrl}
        name={team.name}
        code={team.code}
        size={flagSize}
      />
      <span
        className={cn(
          "truncate text-sm text-slate-800",
          bold && "font-semibold"
        )}
      >
        <span className="sm:hidden">{team.code}</span>
        <span className="hidden sm:inline">{team.name}</span>
      </span>
    </span>
  );
}
