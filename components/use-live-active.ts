"use client";

// Hook compartilhado que diz se há "algo acontecendo" (jogo ao vivo ou a começar
// em ~1h) consultando /api/live — endpoint barato e cacheado na CDN. Tanto o
// LiveRefresh quanto o sino de notificações usam isto para só fazer polling
// pesado quando vale a pena; ociosos, deixam o banco (Neon) suspender em vez de
// acordá-lo de 45/60s o dia todo. O SWR deduplica a chamada entre os dois
// componentes por usarem a mesma key.

import useSWR from "swr";

export interface LivePayload {
  stamp: string;
  liveCount: number;
  /** Algum jogo agendado para começar em ~1h (alinhado ao lead do sync) */
  soon: boolean;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Falha ao consultar jogos ao vivo");
    return r.json() as Promise<LivePayload>;
  });

// Ativo (jogo rolando ou a começar em ~1h) → polling rápido. Ocioso → poll lento,
// só para descobrir a transição: a CDN segura o custo e ~10 min entre checagens
// dá folga para o banco dormir. Como o aviso "Falta 1h" usa janela de 60 min,
// 10 min de folga ainda detectam o jogo bem antes do kickoff.
const ACTIVE_MS = 45_000;
const IDLE_MS = 10 * 60_000;

export function useLiveActive(): {
  data: LivePayload | undefined;
  active: boolean;
} {
  const { data } = useSWR<LivePayload>("/api/live", fetcher, {
    // Intervalo decidido a partir do último dado: começa ocioso e acelera sozinho
    // quando /api/live indica jogo ao vivo/próximo (e desacelera quando acaba).
    refreshInterval: (latest) =>
      latest && (latest.liveCount > 0 || latest.soon) ? ACTIVE_MS : IDLE_MS,
    revalidateOnFocus: true,
    dedupingInterval: 10_000,
  });

  const active = !!data && (data.liveCount > 0 || data.soon);
  return { data, active };
}
