import { motion } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { EDITORIAL_EASE } from './MotionPrimitives';

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
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: EDITORIAL_EASE }}
        className="bg-[#0a0a0e] text-zinc-100 w-full max-w-lg rounded-3xl border border-white/[0.1] shadow-[0_32px_90px_rgba(0,0,0,0.85)] overflow-hidden"
      >
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#707ef9]/15 border border-[#707ef9]/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-[#a5b0ff]" />
            </div>
            <h2
              id="confirm-dialog-title"
              className="text-lg font-medium tracking-[-0.02em] text-white"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            aria-label="Cerrar confirmación"
            className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.1] flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-zinc-300 leading-relaxed">{description}</p>
          {details.length > 0 && (
            <ul className="rounded-2xl bg-[#101016] border border-white/[0.08] p-4 space-y-1.5 text-xs text-zinc-400">
              {details.map((item, idx) => (
                <li key={idx} className="tabular-nums">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-6 py-4 bg-white/[0.02] border-t border-white/[0.08] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2.5 rounded-full text-xs font-medium text-zinc-300 bg-white/[0.04] border border-white/[0.1] hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2.5 rounded-full text-xs font-medium text-white bg-[#707ef9] hover:bg-[#5c6bf0] disabled:opacity-60 transition-colors cursor-pointer"
          >
            {loading ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
