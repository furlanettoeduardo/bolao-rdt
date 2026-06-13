// Lista de notificações do usuário logado (consumida pelo sino via SWR).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ unread: 0, items: [] });
  }
  const userId = session.user.id;

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  return NextResponse.json(
    {
      unread,
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        href: n.href,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      })),
    },
    {
      // Dados por usuário → cache PRIVADO (nunca em CDN/compartilhado). Curto o
      // suficiente para amortecer um loop de GET do mesmo cliente sem atrasar o
      // sino (polling de 60s).
      headers: { "Cache-Control": "private, max-age=15" },
    }
  );
}
