"use client";

// "Tempo real" no front: SWR consulta /api/live (nosso banco — nunca a API
// externa) em intervalos de 30–60s e dispara router.refresh() quando algo
// muda, re-renderizando os Server Components com dados frescos.

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import useSWR from "swr";

interface LivePayload {
  stamp: string;
  liveCount: number;
}

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Falha ao consultar jogos ao vivo");
    return res.json() as Promise<LivePayload>;
  });

export function LiveRefresh({
  intervalSeconds = 45,
}: {
  intervalSeconds?: number;
}) {
  const router = useRouter();
  const lastStamp = useRef<string | null>(null);

  const { data } = useSWR<LivePayload>("/api/live", fetcher, {
    refreshInterval: intervalSeconds * 1000,
    revalidateOnFocus: true,
    dedupingInterval: 10_000,
  });

  useEffect(() => {
    if (!data) return;
    if (lastStamp.current !== null && lastStamp.current !== data.stamp) {
      router.refresh();
    }
    lastStamp.current = data.stamp;
  }, [data, router]);

  return null;
}
