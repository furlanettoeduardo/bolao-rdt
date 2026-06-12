// Skeleton genérico de carregamento de página (substitui o antigo spinner).
// Aproxima o layout comum: título + alguns cards, com animação de pulse.

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="h-3 w-24 rounded bg-slate-200" />
        <div className="h-5 w-16 rounded-full bg-slate-200" />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-full bg-slate-200" />
          <div className="h-4 w-20 rounded bg-slate-200" />
        </div>
        <div className="h-6 w-12 rounded bg-slate-200" />
        <div className="flex items-center gap-2">
          <div className="h-4 w-20 rounded bg-slate-200" />
          <div className="size-7 rounded-full bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className="animate-pulse space-y-6"
    >
      {/* Título da página */}
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-lg bg-slate-200" />
        <div className="h-4 w-64 rounded bg-slate-200" />
      </div>

      {/* Faixa/banner */}
      <div className="h-24 rounded-xl bg-slate-200" />

      {/* Grade de cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <span className="sr-only">Carregando…</span>
    </div>
  );
}
