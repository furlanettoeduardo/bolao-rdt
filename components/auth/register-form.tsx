"use client";

// Formulário de cadastro — envia nome, email, senha e (se exigido) o código
// de acesso para a Server Action registerAction.

import { useActionState } from "react";
import { registerAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { FormError, Input, Label } from "@/components/ui/input";

export function RegisterForm({ requireCode }: { requireCode: boolean }) {
  const [state, formAction, pending] = useActionState(registerAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="register-name">Nome</Label>
        <Input
          id="register-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          maxLength={60}
          placeholder="Como você quer aparecer no ranking"
        />
      </div>

      <div>
        <Label htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="voce@exemplo.com"
        />
      </div>

      <div>
        <Label htmlFor="register-password">Senha</Label>
        <Input
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-describedby="register-password-hint"
          placeholder="Crie uma senha"
        />
        <p id="register-password-hint" className="mt-1 text-xs text-slate-500">
          Mínimo 8 caracteres.
        </p>
      </div>

      {requireCode ? (
        <div>
          <Label htmlFor="register-code">Código de acesso</Label>
          <Input
            id="register-code"
            name="registrationCode"
            type="text"
            autoComplete="off"
            required
            placeholder="Código fornecido pelo organizador"
          />
        </div>
      ) : null}

      <FormError>{state?.error}</FormError>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Criando…" : "Criar conta"}
      </Button>
    </form>
  );
}
