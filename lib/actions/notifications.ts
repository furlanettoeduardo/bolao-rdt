"use server";

// Ações de notificação. Marcar como lidas é chamado pelo sino ao abrir.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function markNotificationsRead(): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };

  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });
  return { ok: true };
}
