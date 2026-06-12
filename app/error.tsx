"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="text-5xl" aria-hidden>🟥</p>
      <h1 className="text-xl font-bold text-slate-900">Algo deu errado</h1>
      <p className="max-w-sm text-sm text-slate-500">
        Ocorreu um erro inesperado. Tente novamente — se persistir, avise o
        administrador do bolão.
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
