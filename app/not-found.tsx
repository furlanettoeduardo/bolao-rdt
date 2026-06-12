import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="text-5xl" aria-hidden>🥅</p>
      <h1 className="text-xl font-bold text-slate-900">Página não encontrada</h1>
      <p className="text-sm text-slate-500">
        Essa bola foi pra fora. Volte para o início do bolão.
      </p>
      <Link href="/" className={buttonClasses("primary")}>
        Ir para o início
      </Link>
    </div>
  );
}
