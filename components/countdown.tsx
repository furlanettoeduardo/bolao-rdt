"use client";

// Contagem regressiva até um instante (ISO UTC), atualizada a cada segundo.
// Segue o padrão de LiveMinute: useSyncExternalStore com um tick por segundo,
// e getServerSnapshot=0 para um placeholder estável durante a hidratação.

import { useSyncExternalStore } from "react";

const PERIOD_MS = 1000;

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, PERIOD_MS);
  return () => clearInterval(id);
}
function getSnapshot() {
  return Math.floor(Date.now() / PERIOD_MS);
}
function getServerSnapshot() {
  return 0;
}

function Segment({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex flex-col items-center">
      <span className="min-w-[2.25rem] rounded-lg bg-white/15 px-1.5 py-1 text-center text-xl font-bold tabular-nums">
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">
        {label}
      </span>
    </span>
  );
}

export function Countdown({ targetIso }: { targetIso: string }) {
  const tick = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const nowMs = tick * PERIOD_MS;

  // Antes da hidratação (tick=0), placeholder neutro — evita mismatch de SSR.
  if (tick === 0) {
    return (
      <span suppressHydrationWarning className="text-sm font-semibold text-white/80">
        carregando…
      </span>
    );
  }

  const diffMs = new Date(targetIso).getTime() - nowMs;
  if (diffMs <= 0) {
    return (
      <span suppressHydrationWarning className="text-base font-bold text-white">
        ⚽ Bola rolando!
      </span>
    );
  }

  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  return (
    <span suppressHydrationWarning className="flex items-end gap-1.5">
      {days > 0 ? <Segment value={days} label="dias" /> : null}
      <Segment value={hours} label="h" />
      <Segment value={minutes} label="min" />
      <Segment value={seconds} label="seg" />
    </span>
  );
}
