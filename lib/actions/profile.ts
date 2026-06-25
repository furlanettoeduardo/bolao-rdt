"use server";

// Ações de perfil — alterar nome e senha.

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth, unstable_update } from "@/auth";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";

export interface ProfileFormState {
  error?: string;
  success?: string;
}

const nameSchema = z
  .string()
  .trim()
  .min(2, "Informe seu nome (mínimo 2 caracteres).")
  .max(60, "Nome muito longo (máximo 60 caracteres).");

export async function updateNameAction(
  _prev: ProfileFormState | undefined,
  formData: FormData
): Promise<ProfileFormState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sessão expirada. Entre novamente." };

  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nome inválido." };
  }

  const previousName = session.user.name ?? null;
  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data },
  });
  await recordAudit({
    action: "profile.update_name",
    category: "profile",
    summary: `Alterou o nome de "${previousName ?? "—"}" para "${parsed.data}".`,
    targetType: "user",
    targetId: session.user.id,
    targetLabel: parsed.data,
    actor: {
      id: session.user.id,
      name: parsed.data,
      email: session.user.email,
    },
    metadata: { from: previousName, to: parsed.data },
  });
  // Atualiza o nome gravado no JWT — sem isso, header e saudação mostrariam o
  // nome antigo até o usuário relogar (a sessão é JWT, não consulta o banco).
  await unstable_update({ user: { name: parsed.data } });
  revalidatePath("/");
  revalidatePath("/perfil");
  revalidatePath("/ranking");
  revalidatePath(`/usuarios/${session.user.id}`);
  return { success: "Nome atualizado." };
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Informe sua senha atual."),
  newPassword: z
    .string()
    .min(8, "A nova senha deve ter no mínimo 8 caracteres."),
});

export async function changePasswordAction(
  _prev: ProfileFormState | undefined,
  formData: FormData
): Promise<ProfileFormState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sessão expirada. Entre novamente." };

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) return { error: "Usuário não encontrado." };

  const currentOk = await bcrypt.compare(
    parsed.data.currentPassword,
    user.passwordHash
  );
  if (!currentOk) return { error: "Senha atual incorreta." };

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });
  await recordAudit({
    action: "profile.change_password",
    category: "profile",
    summary: "Alterou a própria senha.",
    targetType: "user",
    targetId: user.id,
    targetLabel: user.name,
    actor: { id: user.id, name: user.name, email: user.email },
  });
  return { success: "Senha alterada com sucesso." };
}
