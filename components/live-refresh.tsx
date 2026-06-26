"use client";

// "Tempo real" no front: consulta /api/live (nosso banco — nunca a API externa)
// via useLiveActive e dispara router.refresh() quando algo muda, re-renderizando
// os Server Components com dados frescos. O intervalo se ajusta sozinho: rápido
// quando há jogo ao vivo/próximo, lento quando ocioso (deixando o Neon dormir).

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useLiveActive } from "./use-live-active";

export function LiveRefresh() {
  const router = useRouter();
  const lastStamp = useRef<string | null>(null);
  const { data } = useLiveActive();

  useEffect(() => {
    if (!data) return;
    if (lastStamp.current !== null && lastStamp.current !== data.stamp) {
      router.refresh();
    }
    lastStamp.current = data.stamp;
  }, [data, router]);

  return null;
}
