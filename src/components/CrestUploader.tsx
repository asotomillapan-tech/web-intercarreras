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
      setStatusNote('SVG vectorial listo con transparencia nativa.');
    } else if (res.removedBackground) {
      setStatusNote('Fondo blanco removido a PNG transparente.');
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
        : 'Transparencia original restaurada.'
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
      ? 'bg-[#050507] border-white/[0.12]'
      : previewBg === 'light'
      ? 'bg-white border-white/30'
      : 'bg-[repeating-conic-gradient(#27272a_0%_25%,#18181b_0%_50%)] [background-size:16px_16px] border-white/[0.12]';

  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-[#101016] ${
        compact ? 'p-4' : 'p-5'
      } space-y-4`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#a5b0ff]" />
            <span>Escudo oficial</span>
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            PNG transparente, SVG o imagen sobre fondo blanco para recorte automático.
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-[#050507] hover:bg-zinc-200 disabled:opacity-50 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{value ? 'Cambiar escudo' : 'Subir escudo'}</span>
          </button>
          {value && (
            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-white/[0.12] bg-white/[0.04] hover:border-red-400/50 hover:text-red-300 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
              title="Quitar escudo"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Quitar</span>
            </button>
          )}
        </div>
      </div>

      {/* White-background transparency controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/[0.06]">
        <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={removeWhiteBg}
            disabled={isCurrentSvg || processing}
            onChange={(e) => applyRasterReprocess(e.target.checked, threshold)}
            className="w-4 h-4 accent-[#707ef9]"
          />
          <Eraser className="w-3.5 h-3.5 text-[#a5b0ff]" />
          <span>Quitar fondo blanco automáticamente</span>
        </label>

        {removeWhiteBg && !isCurrentSvg && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-500 mr-1">Tolerancia:</span>
            {THRESHOLD_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={processing}
                onClick={() => applyRasterReprocess(true, preset.value)}
                title={preset.hint}
                className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
                  threshold === preset.value
                    ? 'bg-[#707ef9] text-white border-[#707ef9]'
                    : 'bg-white/[0.03] text-zinc-300 border-white/[0.1] hover:border-white/[0.25]'
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-3 border-t border-white/[0.06]">
          <div
            className={`w-24 h-24 rounded-2xl p-2.5 border flex items-center justify-center shrink-0 ${previewSurfaceClass}`}
          >
            <img
              src={value}
              alt={`Vista previa escudo ${teamName}`}
              className="w-full h-full object-contain"
            />
          </div>

          <div className="space-y-2.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 text-emerald-300 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{statusNote ?? 'Escudo cargado correctamente.'}</span>
              </span>
              {formatBadge && (
                <span className="text-[11px] font-mono uppercase text-zinc-500">
                  [{formatBadge.toUpperCase()}]
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-zinc-500 mr-1">Fondo de prueba:</span>
              {(
                [
                  { id: 'dark', label: 'Oscuro' },
                  { id: 'checker', label: 'Damero' },
                  { id: 'light', label: 'Claro' },
                ] as const
              ).map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setPreviewBg(bg.id)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] border transition-colors cursor-pointer ${
                    previewBg === bg.id
                      ? 'bg-white text-[#050507] border-white font-medium'
                      : 'bg-white/[0.03] text-zinc-400 border-white/[0.1] hover:text-white'
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
        <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl px-3.5 py-2.5">
          {error}
        </p>
      )}
    </div>
  );
}
