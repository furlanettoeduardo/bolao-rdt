"use client";

// Formulário "Esqueceu sua senha?" — pede o e-mail e dispara o envio do link.
// A resposta é sempre neutra (não revela se o e-mail tem conta cadastrada).

import { useActionState } from "react";
import { requestPasswordResetAction } from "@/lib/actions/password-reset";
import { Button } from "@/components/ui/button";
import { FormError, FormSuccess, Input, Label } from "@/components/ui/input";

export function RequestResetForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordResetAction,
    undefined
  );

  if (state?.sent) {
    return (
      <FormSuccess>
        Se houver uma conta com esse e-mail, enviamos um link para redefinir a
        senha. Verifique sua caixa de entrada (e o spam). O link vale por 1 hora.
      </FormSuccess>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="forgot-email">Email</Label>
        <Input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="voce@exemplo.com"
        />
      </div>

      <FormError>{state?.error}</FormError>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Enviando…" : "Enviar link de redefinição"}
      </Button>
    </form>
  );
}
