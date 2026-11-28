import { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'navbar' | 'mobile-menu' | 'footer';
}

export function PWAInstallButton({ variant = 'navbar' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = () => {
    if (isInstallable) {
      void install();
      return;
    }
    setShowGuide(true);
  };

  if (variant === 'navbar' && !isInstallable && !isIOS) {
    return null;
  }

  const buttonClasses =
    variant === 'navbar'
      ? 'hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.14] hover:border-[#707ef9]/50 text-zinc-100 text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer'
      : variant === 'mobile-menu'
      ? 'w-full py-3 px-4 rounded-xl border border-[#707ef9]/35 bg-[#707ef9]/12 text-[#c8ceff] hover:bg-[#707ef9]/20 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer'
      : 'inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.14] bg-white/[0.04] hover:bg-white/[0.1] text-zinc-200 hover:text-white text-xs font-medium transition-colors cursor-pointer';

  const label = isInstallable
    ? 'Instalar app'
    : isIOS
    ? 'Instalar en iPhone'
    : 'Instalar en celular';

  return (
    <>
      <button type="button" onClick={handleClick} className={buttonClasses}>
        {isInstallable ? (
          <Download className="w-3.5 h-3.5 text-[#9aa5ff] shrink-0" />
        ) : (
          <Smartphone className="w-3.5 h-3.5 text-[#9aa5ff] shrink-0" />
        )}
        <span>{label}</span>
      </button>

      {showGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-guide-title"
          onClick={() => setShowGuide(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#0c0c12] border border-white/[0.12] p-6 text-zinc-100 shadow-2xl shadow-black/90 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#9aa5ff] font-medium">
                  {isIOS ? 'App Web · iOS Safari' : 'App Web · Android e iOS'}
                </p>
                <h3 id="pwa-install-guide-title" className="text-lg font-medium text-white mt-1">
                  {isIOS ? 'Instalar en tu iPhone o iPad' : 'Instalar en tu teléfono'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Cerrar instrucciones de instalación"
                className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Guarda el Campeonato Intercarreras en tu pantalla de inicio para consultar horarios y
              tablas incluso con mala señal en las canchas:
            </p>

            <ol className="space-y-3 text-xs text-zinc-200">
              {isIOS ? (
                <>
                  <li className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                    <span className="w-5 h-5 rounded-full bg-[#707ef9]/25 text-[#c8ceff] font-semibold flex items-center justify-center shrink-0">
                      1
                    </span>
                    <span>
                      Toca el botón{' '}
                      <strong className="text-white inline-flex items-center gap-1">
                        <Share className="w-3 h-3 inline text-[#9aa5ff]" /> Compartir
                      </strong>{' '}
                      en la barra inferior de Safari.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                    <span className="w-5 h-5 rounded-full bg-[#707ef9]/25 text-[#c8ceff] font-semibold flex items-center justify-center shrink-0">
                      2
                    </span>
                    <span>
                      Desliza hacia abajo y selecciona{' '}
                      <strong className="text-white">Agregar a inicio</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                    <span className="w-5 h-5 rounded-full bg-[#707ef9]/25 text-[#c8ceff] font-semibold flex items-center justify-center shrink-0">
                      3
                    </span>
                    <span>
                      Confirma tocando <strong className="text-white">Agregar</strong> en la esquina
                      superior derecha.
                    </span>
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                    <span className="w-5 h-5 rounded-full bg-[#707ef9]/25 text-[#c8ceff] font-semibold flex items-center justify-center shrink-0">
                      1
                    </span>
                    <span>
                      <strong className="text-white">Android (Chrome):</strong> toca el menú{' '}
                      <strong className="text-white">⋮</strong> y elige{' '}
                      <strong className="text-white">Instalar aplicación</strong> o{' '}
                      <strong className="text-white">Añadir a pantalla de inicio</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                    <span className="w-5 h-5 rounded-full bg-[#707ef9]/25 text-[#c8ceff] font-semibold flex items-center justify-center shrink-0">
                      2
                    </span>
                    <span>
                      <strong className="text-white">iPhone / iPad (Safari):</strong> toca{' '}
                      <strong className="text-white inline-flex items-center gap-1">
                        <Share className="w-3 h-3 inline text-[#9aa5ff]" /> Compartir
                      </strong>{' '}
                      y luego <strong className="text-white">Agregar a inicio</strong>.
                    </span>
                  </li>
                </>
              )}
            </ol>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
