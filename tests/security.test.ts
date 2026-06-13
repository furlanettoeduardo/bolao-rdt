// Testes de hardening de segurança — validação de href (anti-XSS/open-redirect)
// usada no sino de notificações. React já escapa texto; o href é o ponto que
// não tem escape automático, então é validado explicitamente.

import { describe, expect, it } from "vitest";
import { isSafeInternalHref } from "@/lib/security";

describe("isSafeInternalHref — só caminhos internos relativos", () => {
  it("aceita caminhos internos típicos do app", () => {
    for (const href of ["/", "/jogos/abc123", "/ranking", "/chaveamento"]) {
      expect(isSafeInternalHref(href)).toBe(true);
    }
  });

  it("rejeita esquema javascript: (XSS clássico em href)", () => {
    expect(isSafeInternalHref("javascript:alert(document.cookie)")).toBe(false);
    expect(isSafeInternalHref("JavaScript:alert(1)")).toBe(false);
  });

  it("rejeita data: e outros esquemas perigosos", () => {
    expect(isSafeInternalHref("data:text/html,<script>alert(1)</script>")).toBe(
      false
    );
    expect(isSafeInternalHref("vbscript:msgbox(1)")).toBe(false);
  });

  it("rejeita URLs absolutas (open redirect)", () => {
    expect(isSafeInternalHref("http://evil.com")).toBe(false);
    expect(isSafeInternalHref("https://evil.com/phish")).toBe(false);
  });

  it("rejeita URLs protocolo-relativas (//evil.com)", () => {
    expect(isSafeInternalHref("//evil.com")).toBe(false);
    expect(isSafeInternalHref("//evil.com/jogos/1")).toBe(false);
  });

  it("rejeita barra invertida (normalização de navegador)", () => {
    expect(isSafeInternalHref("/\\evil.com")).toBe(false);
    expect(isSafeInternalHref("\\\\evil.com")).toBe(false);
  });

  it("rejeita vazio, null e não-strings", () => {
    expect(isSafeInternalHref(null)).toBe(false);
    expect(isSafeInternalHref(undefined)).toBe(false);
    expect(isSafeInternalHref("")).toBe(false);
    // não começa com "/"
    expect(isSafeInternalHref("jogos/1")).toBe(false);
  });
});
