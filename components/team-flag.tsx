"use client";

// Bandeira/escudo da seleção com fallback para a sigla quando a imagem
// não existe ou falha ao carregar.

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";

const SIZES = {
  sm: { px: 20, className: "size-5" },
  md: { px: 28, className: "size-7" },
  lg: { px: 40, className: "size-10" },
} as const;

export function TeamFlag({
  flagUrl,
  name,
  code,
  size = "md",
  className,
}: {
  flagUrl: string;
  name: string;
  code: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const { px, className: sizeClass } = SIZES[size];

  if (!flagUrl || failed) {
    return (
      <span
        aria-hidden
        className={cn(
          sizeClass,
          "inline-flex shrink-0 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-600",
          className
        )}
      >
        {code.slice(0, 3)}
      </span>
    );
  }

  return (
    <Image
      src={flagUrl}
      alt={`Bandeira: ${name}`}
      width={px}
      height={px}
      className={cn(sizeClass, "shrink-0 rounded-sm object-contain", className)}
      onError={() => setFailed(true)}
      unoptimized
    />
  );
}
