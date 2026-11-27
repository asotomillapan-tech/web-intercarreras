import type { ReactNode } from 'react';
import { motion } from 'motion/react';

export const EDITORIAL_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className = '' }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.32, ease: EDITORIAL_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface RevealSectionProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function RevealSection({ children, className = '', delay = 0 }: RevealSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: 0.48, delay, ease: EDITORIAL_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface SectionKickerProps {
  index: string;
  label: string;
  className?: string;
}

export function SectionKicker({ index, label, className = '' }: SectionKickerProps) {
  return (
    <div className={`inline-flex items-center gap-2 text-xs font-medium tracking-tight ${className}`}>
      <span className="text-zinc-500 tabular-nums">({index})</span>
      <span className="text-zinc-200">{label}</span>
    </div>
  );
}

interface ModalBackdropProps {
  children: ReactNode;
  onClose?: () => void;
  className?: string;
  ariaLabel?: string;
  role?: 'dialog' | 'alertdialog';
}

export function ModalBackdrop({
  children,
  onClose,
  className = '',
  ariaLabel,
  role = 'dialog',
}: ModalBackdropProps) {
  return (
    <motion.div
      role={role}
      aria-modal="true"
      aria-label={ariaLabel}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={(e) => {
        if (onClose && e.target === e.currentTarget) onClose();
      }}
      className={`fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto ${className}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.26, ease: EDITORIAL_EASE }}
        className="w-full flex justify-center"
        onClick={(e) => {
          if (onClose && e.target === e.currentTarget) onClose();
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
