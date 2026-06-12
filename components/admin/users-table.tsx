"use client";

// Tabela de gerenciamento de usuários — troca de papel (USER/ADMIN) e
// exclusão de conta com confirmação. Feedback de erro por linha.

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { LocalTime } from "@/components/local-time";
import { deleteUserAction, setUserRoleAction } from "@/lib/actions/admin";
import { cn } from "@/lib/cn";
import type { Role } from "@/lib/types";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** ISO UTC */
  createdAt: string;
  predictionCount: number;
}

export function UsersTable({
  users,
  currentUserId,
}: {
  users: AdminUser[];
  currentUserId: string;
}) {
  return (
    <Card>
      <CardHeader
        title="Usuários"
        subtitle={`${users.length} participante${users.length === 1 ? "" : "s"} no bolão`}
      />
      <CardBody className="px-0 py-0">
        {users.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">
            Nenhum usuário cadastrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Nome
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Email
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">
                    Palpites
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Desde
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Papel
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    isCurrentUser={user.id === currentUserId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function UserRow({
  user,
  isCurrentUser,
}: {
  user: AdminUser;
  isCurrentUser: boolean;
}) {
  const [role, setRole] = useState<Role>(user.role);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRoleChange(nextRole: Role) {
    const previous = role;
    setRole(nextRole);
    setError(null);
    startTransition(async () => {
      const result = await setUserRoleAction(user.id, nextRole);
      if (!result.ok) {
        setRole(previous);
        setError(result.error);
      }
    });
  }

  function handleDelete() {
    const confirmed = window.confirm(
      `Excluir ${user.name}? Todos os palpites serão apagados.`
    );
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteUserAction(user.id);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <tr className="align-middle">
      <td className="px-4 py-2.5 font-medium text-slate-900">
        {user.name}
        {isCurrentUser ? (
          <span className="ml-1.5 text-xs font-normal text-slate-400">
            (você)
          </span>
        ) : null}
      </td>
      <td className="px-4 py-2.5 text-slate-600">{user.email}</td>
      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
        {user.predictionCount}
      </td>
      <td className="px-4 py-2.5 text-slate-600">
        <LocalTime iso={user.createdAt} mode="date" />
      </td>
      <td className="px-4 py-2.5">
        <select
          value={role}
          onChange={(e) => handleRoleChange(e.target.value as Role)}
          disabled={isCurrentUser || isPending}
          aria-label={`Papel de ${user.name}`}
          className={cn(
            "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900",
            "focus:border-field-600 focus:outline-2 focus:outline-field-600/30",
            "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
          )}
        >
          <option value="USER">Usuário</option>
          <option value="ADMIN">Admin</option>
        </select>
      </td>
      <td className="px-4 py-2.5 text-right">
        <Button
          variant="danger"
          size="sm"
          onClick={handleDelete}
          disabled={isCurrentUser || isPending}
        >
          {isPending ? "Aguarde…" : "Excluir"}
        </Button>
        {error ? (
          <p role="alert" className="mt-1 text-xs font-medium text-cup-red">
            {error}
          </p>
        ) : null}
      </td>
    </tr>
  );
}
