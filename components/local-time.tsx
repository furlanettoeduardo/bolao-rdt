"use client";

// Exibe datas/horários no fuso do navegador do usuário.
// No servidor (e na hidratação) renderiza em America/Sao_Paulo (padrão);
// no cliente reformata no fuso local — a trava de palpite continua 100%
// no servidor, isto é apenas exibição.

import { useSyncExternalStore } from "react";
import {
  formatDayHeading,
  formatMatchDate,
  formatMatchDateTime,
  formatMatchTime,
} from "@/lib/format";

type Mode = "time" | "date" | "datetime" | "day-heading";

const FORMATTERS: Record<Mode, (iso: string, tz?: string) => string> = {
  time: formatMatchTime,
  date: formatMatchDate,
  datetime: formatMatchDateTime,
  "day-heading": formatDayHeading,
};

// Detector de hidratação sem useEffect: false no servidor, true no cliente.
const emptySubscribe = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export function LocalTime({
  iso,
  mode = "time",
  className,
}: {
  iso: string;
  mode?: Mode;
  className?: string;
}) {
  const hydrated = useHydrated();
  const tz = hydrated
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : undefined;
  const text = FORMATTERS[mode](iso, tz);

  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
