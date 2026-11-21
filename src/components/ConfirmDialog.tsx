import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  details = [],
  confirmLabel = 'Confirmar y sincronizar',
  cancelLabel = 'Cancelar',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="bg-white text-[#0d0d0d] w-full max-w-lg border border-neutral-200 shadow-2xl">
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-[#707ef9] shrink-0" />
            <h2
              id="confirm-dialog-title"
              className="font-display text-xl font-bold uppercase tracking-wide text-[#0d0d0d]"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            aria-label="Cerrar confirmación"
            className="p-1 text-neutral-500 hover:text-[#0d0d0d] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-neutral-700 leading-relaxed">{description}</p>
          {details.length > 0 && (
            <ul className="bg-[#f5f6f8] border border-neutral-200 p-4 space-y-1.5 text-xs text-neutral-700">
              {details.map((item, idx) => (
                <li key={idx} className="tabular-nums">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-6 py-4 bg-[#f5f6f8] border-t border-neutral-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2.5 text-xs font-display font-bold uppercase tracking-widest text-white bg-[#707ef9] hover:bg-[#5766eb] disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
