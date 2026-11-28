export function SectionLoadingFallback({ label = 'Cargando sección' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-20"
    >
      <div className="rounded-3xl border border-white/[0.08] bg-[#0b0b10] p-8 sm:p-10 space-y-6 animate-pulse">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#707ef9]" />
          <span className="text-xs tracking-[0.14em] uppercase text-zinc-400">{label}…</span>
        </div>
        <div className="h-8 w-64 max-w-full rounded-xl bg-white/[0.06]" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="h-32 rounded-2xl bg-white/[0.04]" />
          <div className="h-32 rounded-2xl bg-white/[0.04]" />
          <div className="h-32 rounded-2xl bg-white/[0.04]" />
        </div>
      </div>
    </div>
  );
}
