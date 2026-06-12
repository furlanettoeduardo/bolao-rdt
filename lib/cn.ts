/** Junta classes condicionais (mini-clsx, sem dependência externa). */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
