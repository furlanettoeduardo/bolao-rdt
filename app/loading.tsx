export default function Loading() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-label="Carregando">
      <span className="size-8 animate-spin rounded-full border-4 border-field-200 border-t-field-700" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
