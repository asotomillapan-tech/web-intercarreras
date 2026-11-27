import { AlertCircle, RefreshCw } from 'lucide-react';
import type { InitialSyncPhase } from '../domain/realtimeSyncEngine';

interface InitialLoadSkeletonProps {
  phase: Exclude<InitialSyncPhase, 'ready'>;
  errorDetail?: string | null;
  onRetry: () => void;
}

export function InitialLoadSkeleton({
  phase,
  errorDetail,
  onRetry,
}: InitialLoadSkeletonProps) {
  if (phase === 'error') {
    return (
      <section
        data-testid="initial-sync-error"
        aria-label="Error de conexión inicial"
        className="bg-[#050507] text-white py-24 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-xl mx-auto rounded-3xl border border-white/[0.1] bg-[#0c0c10] p-8 sm:p-10 space-y-5">
          <div className="flex items-center gap-2 text-[#9aa5ff] text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Conexión interrumpida</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-medium tracking-[-0.03em] leading-tight">
            No pudimos cargar el <span className="font-editorial text-zinc-300">campeonato</span>
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Verifica tu conexión e intenta nuevamente para sincronizar resultados y tablas en vivo.
          </p>
          {errorDetail && (
            <p className="text-xs text-zinc-500 border-t border-white/[0.08] pt-3 break-words">
              {errorDetail}
            </p>
          )}
          <div className="pt-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#050507] hover:bg-zinc-200 font-medium text-xs transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reintentar</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div
      data-testid="initial-sync-loading"
      role="status"
      aria-live="polite"
      aria-label="Cargando datos oficiales del Campeonato Intercarreras UFRO"
      className="w-full bg-[#050507] text-white"
    >
      <section className="border-b border-white/[0.06]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
                <span>(01)</span>
                <span className="text-zinc-300">Sincronizando</span>
              </div>
              <h1 className="text-4xl sm:text-6xl font-medium tracking-[-0.035em] leading-[1.02]">
                Campeonato <span className="font-editorial text-zinc-300">Intercarreras</span> UFRO
              </h1>
              <p className="text-sm text-zinc-500 max-w-md">
                Cargando resultados, posiciones y programación oficial…
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <div className="h-10 w-36 rounded-full bg-white/10 animate-pulse" />
                <div className="h-10 w-36 rounded-full bg-white/[0.04] border border-white/[0.08] animate-pulse" />
              </div>
            </div>

            <div className="lg:col-span-5 rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-7 space-y-4">
              <div className="h-3 w-28 rounded-full bg-[#707ef9]/30 animate-pulse" />
              <div className="h-7 w-4/5 rounded-lg bg-white/10 animate-pulse" />
              <div className="space-y-2">
                <div className="h-3.5 w-full rounded bg-white/[0.07] animate-pulse" />
                <div className="h-3.5 w-5/6 rounded bg-white/[0.06] animate-pulse" />
              </div>
              <div className="h-9 w-36 rounded-full bg-white/10 animate-pulse" />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-8 border-t border-white/[0.07]">
            {[0, 1, 2, 3].map((idx) => (
              <div key={idx} className="space-y-2">
                <div className="h-8 w-16 rounded-lg bg-white/10 animate-pulse" />
                <div className="h-3 w-28 rounded bg-white/[0.06] animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-8">
        <div className="space-y-2">
          <div className="h-3 w-32 rounded bg-white/[0.08] animate-pulse" />
          <div className="h-8 w-64 rounded-lg bg-white/10 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-6 space-y-4 h-72"
            >
              <div className="h-3 w-24 rounded bg-white/[0.08] animate-pulse" />
              <div className="h-6 w-3/4 rounded bg-white/10 animate-pulse" />
              <div className="h-24 w-full rounded-2xl bg-white/[0.05] animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
