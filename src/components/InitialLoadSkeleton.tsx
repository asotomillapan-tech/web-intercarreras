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
        className="bg-[#0d0d0d] text-white py-20 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-2xl mx-auto border border-white/15 bg-[#15151c] p-8 sm:p-10 space-y-5">
          <div className="flex items-center gap-2.5 text-[#707ef9] text-xs font-bold uppercase tracking-widest">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Conexión interrumpida</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight">
            No se pudieron cargar los datos oficiales del campeonato
          </h1>
          <p className="text-sm text-neutral-300 leading-relaxed">
            Revisa tu conexión a internet e intenta nuevamente para descargar los equipos,
            partidos, tablas y noticias en vivo desde la base oficial UFRO.
          </p>
          {errorDetail && (
            <p className="text-xs text-neutral-400 border-t border-white/10 pt-3 break-words">
              Detalle: {errorDetail}
            </p>
          )}
          <div className="pt-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reintentar conexión</span>
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
      className="w-full"
    >
      {/* Carbon Editorial Hero Skeleton */}
      <section className="bg-[#0d0d0d] text-white border-b border-white/10">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#707ef9] font-medium">
                <span className="inline-block w-2 h-2 bg-[#707ef9] animate-pulse" />
                <span>Universidad de La Frontera · Sincronizando datos oficiales</span>
              </div>
              <h1 className="font-display text-4xl sm:text-6xl font-bold uppercase tracking-tight leading-[0.95]">
                Campeonato Intercarreras UFRO
              </h1>
              <p className="text-sm sm:text-base text-neutral-400 max-w-xl">
                Cargando resultados, tablas de posiciones, planteles y programación actualizada...
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <div className="h-11 w-44 bg-white/10 animate-pulse" />
                <div className="h-11 w-40 bg-white/5 border border-white/10 animate-pulse" />
              </div>
            </div>

            <div className="lg:col-span-5 border border-white/10 bg-white/[0.03] p-6 space-y-4">
              <div className="h-3 w-36 bg-[#707ef9]/35 animate-pulse" />
              <div className="h-7 w-4/5 bg-white/15 animate-pulse" />
              <div className="space-y-2">
                <div className="h-3.5 w-full bg-white/10 animate-pulse" />
                <div className="h-3.5 w-5/6 bg-white/10 animate-pulse" />
              </div>
              <div className="h-10 w-40 bg-white/10 animate-pulse pt-2" />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-8 border-t border-white/10">
            {[0, 1, 2, 3].map((idx) => (
              <div key={idx} className="space-y-2">
                <div className="h-8 w-16 bg-white/15 animate-pulse" />
                <div className="h-3.5 w-36 bg-white/10 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Light Editorial Body Skeleton */}
      <section className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="space-y-2">
          <div className="h-3 w-48 bg-[#707ef9]/25 animate-pulse" />
          <div className="h-8 w-72 bg-neutral-200 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="border border-neutral-200 bg-[#f5f6f8] p-6 space-y-4">
              <div className="h-3 w-28 bg-neutral-300 animate-pulse" />
              <div className="h-6 w-3/4 bg-neutral-200 animate-pulse" />
              <div className="h-16 w-full bg-neutral-200/70 animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
