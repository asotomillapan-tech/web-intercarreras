import { useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, LogOut, ShieldCheck, X } from 'lucide-react';
import { LOGO_LIGHT_SVG } from '../data/ufroSeed';
import { ROLE_META } from '../domain/rbacEngine';
import type { AppUserProfile } from '../types/tournament';
import { EDITORIAL_EASE } from './MotionPrimitives';

interface AuthModalProps {
  open: boolean;
  currentUser: AppUserProfile | null;
  googleAuthLoading: boolean;
  googleAuthError: string | null;
  onClose: () => void;
  onGoogleSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onOpenAccountHub: () => void;
  onOpenPrivacy?: () => void;
}

export function AuthModal({
  open,
  currentUser,
  googleAuthLoading,
  googleAuthError,
  onClose,
  onGoogleSignIn,
  onSignOut,
  onOpenAccountHub,
  onOpenPrivacy,
}: AuthModalProps) {
  const [signingOut, setSigningOut] = useState(false);

  if (!open) return null;

  const handleSignOutClick = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
      onClose();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: EDITORIAL_EASE }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0a0a0e] text-zinc-100 w-full max-w-md rounded-3xl border border-white/[0.1] shadow-[0_32px_90px_rgba(0,0,0,0.85)] my-8 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between gap-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={LOGO_LIGHT_SVG}
              alt=""
              aria-hidden="true"
              className="h-6 w-auto shrink-0 opacity-90"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <p className="text-[11px] text-[#9aa5ff] font-medium">Intercarreras UFRO</p>
              <h2
                id="auth-modal-title"
                className="text-xl sm:text-2xl font-medium tracking-[-0.02em] text-white"
              >
                {currentUser ? (
                  <>
                    Sesión <span className="font-editorial text-[#c8ceff]">activa</span>
                  </>
                ) : (
                  <>
                    Iniciar <span className="font-editorial text-[#c8ceff]">sesión</span>
                  </>
                )}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de acceso"
            className="w-9 h-9 rounded-full bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.1] flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Active Session Summary */}
          {currentUser && (
            <div className="rounded-2xl bg-[#101016] border border-white/[0.08] p-4 space-y-4">
              <div className="flex items-center gap-3.5 min-w-0">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName}
                    className="w-11 h-11 rounded-full object-cover border border-white/[0.14] shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-white/[0.08] border border-white/[0.14] text-white text-sm font-medium flex items-center justify-center shrink-0">
                    {currentUser.displayName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm text-white truncate">
                      {currentUser.displayName}
                    </p>
                    <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#707ef9]/20 border border-[#707ef9]/35 text-[#c8ceff]">
                      {ROLE_META[currentUser.role].label}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">{currentUser.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAccountHub();
                  }}
                  className="flex-1 px-4 py-2.5 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  Ir a mi cuenta
                </button>
                <button
                  type="button"
                  onClick={handleSignOutClick}
                  disabled={signingOut}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-white/[0.04] hover:bg-red-500/15 border border-white/[0.1] hover:border-red-500/35 text-xs font-medium text-zinc-300 hover:text-red-300 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{signingOut ? 'Saliendo...' : 'Salir'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Official Firebase Google Sign-In */}
          <div className="space-y-4">
            <p className="text-xs text-zinc-400 leading-relaxed">
              {currentUser
                ? 'Reconecta o cambia tu cuenta Google institucional o personal.'
                : 'Accede con tu cuenta Google para seguir equipos, votar MVP y gestionar tu perfil.'}
            </p>

            {googleAuthError && (
              <div
                role="alert"
                className="rounded-2xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-200 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{googleAuthError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={onGoogleSignIn}
              disabled={googleAuthLoading}
              className="w-full inline-flex items-center justify-center gap-3 rounded-full bg-white hover:bg-zinc-200 px-5 py-3 text-sm font-medium text-[#050507] transition-colors cursor-pointer disabled:opacity-50"
            >
              <svg
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                className="w-5 h-5 block shrink-0"
                aria-hidden="true"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
                <path fill="none" d="M0 0h48v48H0z" />
              </svg>
              <span>{googleAuthLoading ? 'Conectando...' : 'Continuar con Google'}</span>
            </button>

            <div className="rounded-2xl bg-[#101016] border border-white/[0.06] p-3.5 flex items-start gap-2.5 text-xs text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-[#9aa5ff] shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Los roles administrativos, arbitrales y de prensa se asignan desde la organización oficial.
              </p>
            </div>

            <p className="text-[11px] text-zinc-500 text-center">
              Al continuar aceptas nuestra{' '}
              <a
                href="/privacidad"
                onClick={(e) => {
                  if (onOpenPrivacy) {
                    e.preventDefault();
                    onClose();
                    onOpenPrivacy();
                  }
                }}
                className="text-zinc-300 hover:text-white underline underline-offset-4 transition-colors"
              >
                Política de Privacidad
              </a>
              .
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
