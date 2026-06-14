"use client";

// Formulário de nova senha — recebe o token (campo oculto) e grava a senha
// nova. Em caso de sucesso, a Server Action redireciona para /login?reset=ok.

import { useActionState } from "react";
import { resetPasswordAction } from "@/lib/actions/password-reset";
import { Button } from "@/components/ui/button";
import { FormError, Input, Label } from "@/components/ui/input";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    undefined
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div>
        <Label htmlFor="reset-password">Nova senha</Label>
        <Input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-describedby="reset-password-hint"
          placeholder="Crie uma nova senha"
        />
        <p id="reset-password-hint" className="mt-1 text-xs text-slate-500">
          Mínimo 8 caracteres.
        </p>
      </div>

      <div>
        <Label htmlFor="reset-confirm">Confirmar nova senha</Label>
        <Input
          id="reset-confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Repita a nova senha"
        />
      </div>

      <FormError>{state?.error}</FormError>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Salvando…" : "Redefinir senha"}
      </Button>
    </form>
  );
}
