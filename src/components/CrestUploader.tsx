import { useRef, useState, type ChangeEvent } from 'react';
import { CheckCircle2, Eraser, Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import {
  DEFAULT_WHITE_THRESHOLD,
  processCrestImageFile,
  reprocessCrestDataUrl,
} from '../domain/crestProcessor';

interface CrestUploaderProps {
  value?: string;
  onChange: (nextDataUrl: string | undefined) => void;
  teamName?: string;
  compact?: boolean;
}

const THRESHOLD_PRESETS = [
  { label: 'Suave', value: 245, hint: 'Solo blanco puro' },
  { label: 'Normal', value: DEFAULT_WHITE_THRESHOLD, hint: 'Recomendado' },
  { label: 'Fuerte', value: 218, hint: 'Incluye grises claros' },
];

export function CrestUploader({
  value,
  onChange,
  teamName = 'Equipo',
  compact = false,
}: CrestUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rawOriginalUrl, setRawOriginalUrl] = useState<string | null>(null);
  const [removeWhiteBg, setRemoveWhiteBg] = useState(true);
  const [threshold, setThreshold] = useState<number>(DEFAULT_WHITE_THRESHOLD);
  const [previewBg, setPreviewBg] = useState<'checker' | 'dark' | 'light'>('dark');
  const [formatBadge, setFormatBadge] = useState<'png' | 'svg' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const isCurrentSvg = Boolean(value?.startsWith('data:image/svg+xml'));

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessing(true);
    setError(null);
    setStatusNote(null);

    const lower = file.name.toLowerCase();
    const isSvg = file.type === 'image/svg+xml' || lower.endsWith('.svg');

    // Keep raw source for raster files so the delegate can toggle white-bg removal or adjust tolerance live
    if (!isSvg) {
      const reader = new FileReader();
      reader.onload = () => setRawOriginalUrl(String(reader.result || ''));
      reader.readAsDataURL(file);
    } else {
      setRawOriginalUrl(null);
    }

    const res = await processCrestImageFile(file, {
      removeWhiteBg: !isSvg && removeWhiteBg,
      threshold,
    });

    setProcessing(false);
    e.target.value = '';

    if (!res.ok || !res.dataUrl) {
      setError(res.error ?? 'No se pudo procesar el archivo del escudo.');
      return;
    }

    onChange(res.dataUrl);
    setFormatBadge(res.format ?? null);
    if (res.format === 'svg') {
      setStatusNote('SVG vectorial sanitizado y listo con transparencia nativa.');
    } else if (res.removedBackground) {
      setStatusNote('Fondo blanco removido automáticamente a PNG transparente.');
    } else {
      setStatusNote('PNG cargado conservando su transparencia original.');
    }
  };

  const applyRasterReprocess = async (nextRemove: boolean, nextThreshold: number) => {
    setRemoveWhiteBg(nextRemove);
    setThreshold(nextThreshold);
    if (!rawOriginalUrl || isCurrentSvg) return;

    setProcessing(true);
    setError(null);
    const res = await reprocessCrestDataUrl(rawOriginalUrl, {
      removeWhiteBg: nextRemove,
      threshold: nextThreshold,
    });
    setProcessing(false);

    if (!res.ok || !res.dataUrl) {
      setError(res.error ?? 'No se pudo reprocesar el escudo.');
      return;
    }
    onChange(res.dataUrl);
    setStatusNote(
      nextRemove
        ? 'Fondo blanco convertido a transparencia.'
        : 'Transparencia original restaurada sin recorte.'
    );
  };

  const handleRemove = () => {
    onChange(undefined);
    setRawOriginalUrl(null);
    setFormatBadge(null);
    setError(null);
    setStatusNote(null);
  };

  const previewSurfaceClass =
    previewBg === 'dark'
      ? 'bg-[#0d0d0d] border-neutral-800'
      : previewBg === 'light'
      ? 'bg-white border-neutral-300'
      : 'bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#ffffff_0%_50%)] [background-size:16px_16px] border-neutral-300';

  return (
    <div className={`border border-neutral-200 bg-[#f5f6f8] ${compact ? 'p-4' : 'p-5'} space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#0d0d0d] flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#707ef9]" />
            Escudo Oficial del Equipo (PNG transparente, SVG o fondo blanco)
          </p>
          <p className="text-xs text-neutral-600 mt-1">
            Sube un <strong>PNG con transparencia</strong>, un archivo <strong>SVG</strong>, o una
            imagen sobre <strong>fondo blanco</strong> para remover automáticamente el fondo y
            obtener solo el escudo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/svg+xml,image/jpeg,image/webp,.svg,.png,.jpg,.jpeg,.webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            disabled={processing}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#0d0d0d] hover:bg-[#707ef9] disabled:opacity-50 text-white text-xs font-display font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            {value ? 'Cambiar Escudo' : 'Subir Escudo'}
          </button>
          {value && (
            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-neutral-300 bg-white hover:border-red-500 hover:text-red-600 text-neutral-700 text-xs font-medium transition-colors cursor-pointer"
              title="Quitar escudo"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Quitar
            </button>
          )}
        </div>
      </div>

      {/* White-background transparency controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-neutral-200">
        <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-800 cursor-pointer">
          <input
            type="checkbox"
            checked={removeWhiteBg}
            disabled={isCurrentSvg || processing}
            onChange={(e) => applyRasterReprocess(e.target.checked, threshold)}
            className="w-4 h-4 accent-[#707ef9]"
          />
          <Eraser className="w-3.5 h-3.5 text-[#707ef9]" />
          <span>Quitar fondo blanco automáticamente (preserva detalles blancos internos)</span>
        </label>

        {removeWhiteBg && !isCurrentSvg && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-wider text-neutral-500 mr-1">
              Tolerancia:
            </span>
            {THRESHOLD_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={processing}
                onClick={() => applyRasterReprocess(true, preset.value)}
                title={preset.hint}
                className={`px-2 py-1 text-[11px] font-medium border transition-colors cursor-pointer ${
                  threshold === preset.value
                    ? 'bg-[#707ef9] text-white border-[#707ef9]'
                    : 'bg-white text-neutral-700 border-neutral-300 hover:border-[#0d0d0d]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Live Preview over transparent / dark / light surfaces */}
      {value && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2 border-t border-neutral-200">
          <div
            className={`w-24 h-24 p-2.5 border flex items-center justify-center shrink-0 ${previewSurfaceClass}`}
          >
            <img
              src={value}
              alt={`Vista previa escudo ${teamName}`}
              className="w-full h-full object-contain"
            />
          </div>

          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {statusNote ?? 'Escudo cargado correctamente.'}
              </span>
              {formatBadge && (
                <span className="text-[11px] font-mono uppercase text-neutral-500">
                  [{formatBadge.toUpperCase()}]
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-neutral-500">
                Verificar transparencia sobre:
              </span>
              {(
                [
                  { id: 'dark', label: 'Fondo Oscuro' },
                  { id: 'checker', label: 'Damero' },
                  { id: 'light', label: 'Fondo Blanco' },
                ] as const
              ).map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setPreviewBg(bg.id)}
                  className={`px-2 py-0.5 text-[11px] border cursor-pointer ${
                    previewBg === bg.id
                      ? 'bg-[#0d0d0d] text-white border-[#0d0d0d]'
                      : 'bg-white text-neutral-700 border-neutral-300 hover:border-neutral-500'
                  }`}
                >
                  {bg.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>
      )}
    </div>
  );
}
