// Utilidades de segurança puras (sem dependências) — fáceis de testar.

/**
 * Aceita apenas caminhos internos relativos seguros (ex.: "/jogos/abc").
 * Rejeita esquemas perigosos (`javascript:`, `data:`), URLs absolutas
 * (`http://…`) e protocolo-relativas (`//evil.com`). Defesa em profundidade
 * contra XSS/open-redirect caso algum href passe a derivar de input de usuário.
 */
export function isSafeInternalHref(href: string | null | undefined): boolean {
  if (typeof href !== "string" || href.length === 0) return false;
  // Precisa começar com uma única barra e NÃO ser protocolo-relativo ("//").
  if (!href.startsWith("/") || href.startsWith("//")) return false;
  // Sem barra invertida (alguns navegadores normalizam "\" para "/").
  if (href.includes("\\")) return false;
  return true;
}
