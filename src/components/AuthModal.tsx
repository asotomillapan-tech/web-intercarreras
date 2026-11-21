import { useState } from 'react';
import { AlertCircle, LogOut, ShieldCheck, X } from 'lucide-react';
import { LOGO_LIGHT_SVG } from '../data/ufroSeed';
import { ROLE_META } from '../domain/rbacEngine';
import type { AppUserProfile } from '../types/tournament';

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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 overflow-y-auto"
    >
      <div className="bg-white w-full max-w-lg border border-neutral-200 shadow-2xl my-8 overflow-hidden">
        {/* Carbon Editorial Header */}
        <div className="bg-[#0d0d0d] text-white px-6 py-5 flex items-center justify-between gap-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img
              src={LOGO_LIGHT_SVG}
              alt=""
              aria-hidden="true"
              className="h-6 w-auto shrink-0"
              referrerPolicy="no-referrer"
            />
            <div>
              <p className="text-[11px] uppercase tracking-widest text-[#707ef9] font-medium">
                Autenticación Oficial · Intercarreras UFRO
              </p>
              <h2
                id="auth-modal-title"
                className="font-display text-2xl font-bold uppercase tracking-tight"
              >
                {currentUser ? 'Sesión Activa UFRO' : 'Iniciar Sesión'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de acceso"
            className="p-2 text-neutral-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Active Session Summary */}
          {currentUser && (
            <div className="bg-[#f5f6f8] border border-neutral-200 p-4 space-y-4">
              <div className="flex items-center gap-3.5 min-w-0">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName}
                    className="w-11 h-11 object-cover border border-neutral-300 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-11 h-11 bg-[#0d0d0d] text-white font-display text-sm font-bold flex items-center justify-center shrink-0">
                    {currentUser.displayName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm text-[#0d0d0d] truncate">
                      {currentUser.displayName}
                    </p>
                    <span className="text-[11px] font-display font-bold uppercase tracking-wider px-2 py-0.5 bg-[#707ef9] text-white">
                      {ROLE_META[currentUser.role].label}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 truncate mt-0.5">{currentUser.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAccountHub();
                  }}
                  className="flex-1 px-3.5 py-2.5 bg-[#0d0d0d] hover:bg-[#707ef9] text-white text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer"
                >
                  Ir a Mi Cuenta
                </button>
                <button
                  type="button"
                  onClick={handleSignOutClick}
                  disabled={signingOut}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 border border-neutral-300 text-xs font-medium text-neutral-700 hover:border-red-500 hover:text-red-700 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{signingOut ? 'Saliendo...' : 'Cerrar sesión'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Official Firebase Google Sign-In */}
          <div className="space-y-4">
            <div>
              <h3 className="font-display text-base font-bold uppercase tracking-wide text-[#0d0d0d]">
                {currentUser ? 'Cambiar o reconectar cuenta Google' : 'Acceso con Cuenta Google'}
              </h3>
              <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                Inicia sesión de forma segura con tu cuenta Google (institucional UFRO o personal).
                Las cuentas nuevas se registran automáticamente como{' '}
                <strong>Usuario Tradicional</strong> (favoritos, notificaciones y votación MVP).
              </p>
            </div>

            {googleAuthError && (
              <div
                role="alert"
                className="bg-red-50 border border-red-300 p-3 text-xs text-red-900 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{googleAuthError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={onGoogleSignIn}
              disabled={googleAuthLoading}
              className="w-full inline-flex items-center justify-center gap-3 bg-white hover:bg-neutral-50 border border-neutral-300 px-5 py-3 text-sm font-medium text-[#1f1f1f] transition-colors cursor-pointer disabled:opacity-50"
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
              <span>{googleAuthLoading ? 'Conectando con Google...' : 'Sign in with Google'}</span>
            </button>

            <div className="bg-[#f5f6f8] border border-neutral-200 p-3.5 flex items-start gap-2.5 text-xs text-neutral-600">
              <ShieldCheck className="w-4 h-4 text-[#707ef9] shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Los roles de <strong>Administrador</strong>, <strong>Árbitro</strong>,{' '}
                <strong>Fotógrafo</strong>, <strong>Delegado</strong> y <strong>Jugador</strong> son
                asignados exclusivamente por la administración oficial del campeonato una vez que la
                persona ha iniciado sesión por primera vez.
              </p>
            </div>

            <p className="text-[11px] text-neutral-500 text-center">
              Al iniciar sesión, aceptas el tratamiento de datos descrito en nuestra{' '}
              <a
                href="/privacidad"
                onClick={(e) => {
                  if (onOpenPrivacy) {
                    e.preventDefault();
                    onClose();
                    onOpenPrivacy();
                  }
                }}
                className="text-[#707ef9] font-medium underline"
              >
                Política de Privacidad
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
