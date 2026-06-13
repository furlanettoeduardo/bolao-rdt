"use client";

// Sino de notificações no header. Busca /api/notifications via SWR (polling
// ~60s), mostra um ponto vermelho quando há não-lidas e um dropdown com a lista.
// Abrir o sino marca tudo como lido (o ponto some); itens não-lidos ficam
// destacados até a próxima abertura.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { markNotificationsRead } from "@/lib/actions/notifications";
import { cn } from "@/lib/cn";

interface NotifItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
}
interface Payload {
  unread: number;
  items: NotifItem[];
}

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<Payload>);

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data, mutate } = useSWR<Payload>("/api/notifications", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  });

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await markNotificationsRead();
      mutate();
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={
          unread > 0 ? `Notificações (${unread} não lidas)` : "Notificações"
        }
        className={cn(
          "relative flex size-9 items-center justify-center rounded-full text-white transition-colors",
          open ? "bg-field-800" : "hover:bg-field-800"
        )}
      >
        <BellIcon className="size-5" />
        {unread > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cup-red opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-cup-red ring-2 ring-field-900" />
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <div className="border-b border-slate-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-slate-800">
              Notificações
            </span>
          </div>
          <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto sm:max-h-96">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-slate-400">
                Nenhuma notificação ainda.
              </li>
            ) : (
              items.map((n) => {
                const content = (
                  <>
                    <p className="text-sm font-medium text-slate-800">
                      {n.title}
                    </p>
                    {n.body ? (
                      <p className="mt-0.5 text-xs text-slate-500">{n.body}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-slate-400">
                      {timeAgo(n.createdAt)}
                    </p>
                  </>
                );
                const cls = cn(
                  "block px-4 py-3 transition-colors hover:bg-slate-50",
                  !n.read && "bg-field-50/60"
                );
                return (
                  <li key={n.id}>
                    {n.href ? (
                      <Link
                        href={n.href}
                        onClick={() => setOpen(false)}
                        className={cls}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className={cls}>{content}</div>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 0 0-4-5.7V5a2 2 0 1 0-4 0v.3A6 6 0 0 0 6 11v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
      />
    </svg>
  );
}
