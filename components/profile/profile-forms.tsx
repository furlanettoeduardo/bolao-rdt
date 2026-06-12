"use client";

// Formulários do perfil — alterar nome e alterar senha, cada um com sua
// própria Server Action e estado independente (useActionState).

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormError, FormSuccess, Input, Label } from "@/components/ui/input";
import {
  changePasswordAction,
  updateNameAction,
} from "@/lib/actions/profile";

export function ProfileForms({ initialName }: { initialName: string }) {
  const [nameState, nameAction, namePending] = useActionState(
    updateNameAction,
    undefined
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    changePasswordAction,
    undefined
  );

  return (
    <div className="space-y-6">
      <form action={nameAction} className="space-y-3" aria-label="Alterar nome">
        <div>
          <Label htmlFor="profile-name">Nome</Label>
          <Input
            id="profile-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            maxLength={60}
            defaultValue={initialName}
            placeholder="Como você aparece no ranking"
          />
        </div>

        <FormError>{nameState?.error}</FormError>
        <FormSuccess>{nameState?.success}</FormSuccess>

        <Button type="submit" disabled={namePending}>
          {namePending ? "Salvando…" : "Salvar nome"}
        </Button>
      </form>

      <form
        action={passwordAction}
        className="space-y-3 border-t border-slate-100 pt-5"
        aria-label="Alterar senha"
      >
        <h3 className="text-sm font-semibold text-slate-900">Alterar senha</h3>

        <div>
          <Label htmlFor="profile-current-password">Senha atual</Label>
          <Input
            id="profile-current-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Sua senha atual"
          />
        </div>

        <div>
          <Label htmlFor="profile-new-password">Nova senha</Label>
          <Input
            id="profile-new-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Nova senha"
            aria-describedby="profile-new-password-hint"
          />
          <p
            id="profile-new-password-hint"
            className="mt-1 text-xs text-slate-500"
          >
            Mínimo de 8 caracteres.
          </p>
        </div>

        <FormError>{passwordState?.error}</FormError>
        <FormSuccess>{passwordState?.success}</FormSuccess>

        <Button type="submit" disabled={passwordPending}>
          {passwordPending ? "Alterando…" : "Alterar senha"}
        </Button>
      </form>
    </div>
  );
}
