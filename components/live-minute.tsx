"use client";

// Minuto de jogo ao vivo, calculado no cliente a partir do cronômetro interno
// (liveSegmentStart + clockBaseMinutes gravados pelo sync). Atualiza sozinho a
// cada ~20s. Não vem de API — é uma estimativa.

import { useSyncExternalStore } from "react";

const PERIOD_MS = 20_000;

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, PERIOD_MS);
  return () => clearInterval(id);
}
// Quantizado por período → valor estável dentro de cada janela (evita o aviso
// "getSnapshot should be cached" e re-render em loop).
function getSnapshot() {
  return Math.floor(Date.now() / PERIOD_MS);
}
function getServerSnapshot() {
  return 0;
}

export function LiveMinute({
  liveSegmentStart,
  clockBaseMinutes,
}: {
  liveSegmentStart: string;
  clockBaseMinutes: number | null;
}) {
  const tick = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const nowMs = tick * PERIOD_MS;

  let text = "";
  if (nowMs > 0) {
    const elapsedMin = Math.floor(
      (nowMs - new Date(liveSegmentStart).getTime()) / 60000
    );
    const minute = (clockBaseMinutes ?? 0) + Math.max(0, elapsedMin) + 1;
    text = `${minute}ʼ`;
  }

  return (
    <span suppressHydrationWarning className="tabular-nums">
      {text ? ` · ${text}` : null}
    </span>
  );
}
