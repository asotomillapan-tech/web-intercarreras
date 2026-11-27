import { useMemo, useState, type MouseEvent } from 'react';
import { Bell, LogIn, Menu, Shield, User, X } from 'lucide-react';
import { LOGO_LIGHT_SVG } from '../data/ufroSeed';
import {
  getSectionPath,
  HEADER_NAV_ITEMS,
  isPrimarySpaNavigationClick,
  type NavSection,
} from '../domain/navigationRoutes';
import {
  buildFavoriteNotifications,
  canAccessAdminPanel,
  canAccessDelegateTransfers,
  ROLE_META,
} from '../domain/rbacEngine';
import { getDelegateTransferActionRole } from '../domain/transfersEngine';
import type { AppUserProfile, Match, TournamentState } from '../types/tournament';

export type { NavSection };

interface NavbarProps {
  activeSection: NavSection;
  currentUser: AppUserProfile | null;
  state: TournamentState;
  onNavigate: (section: NavSection) => void;
  onOpenAuth: () => void;
  onOpenMatchModal: (match: Match) => void;
}

export function Navbar({
  activeSection,
  currentUser,
  state,
  onNavigate,
  onOpenAuth,
  onOpenMatchModal,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const notifications = useMemo(
    () => buildFavoriteNotifications(currentUser, state.matches, state.teams, state.mvpVotes),
    [currentUser, state.matches, state.teams, state.mvpVotes]
  );

  const matchMap = useMemo(
    () => new Map(state.matches.map((m) => [m.id, m])),
    [state.matches]
  );

  const handleSelect = (section: NavSection) => {
    onNavigate(section);
    setMobileOpen(false);
    setNotifOpen(false);
  };

  const handleLinkClick = (event: MouseEvent<HTMLAnchorElement>, section: NavSection) => {
    if (!isPrimarySpaNavigationClick(event)) return;
    event.preventDefault();
    handleSelect(section);
  };

  const hasOfficialAccess = canAccessAdminPanel(currentUser);
  const isDelegadoUser = canAccessDelegateTransfers(currentUser);

  const visibleNavItems = useMemo(
    () =>
      isDelegadoUser
        ? [
            ...HEADER_NAV_ITEMS,
            {
              id: 'transferencias' as NavSection,
              label: 'Transferencias',
              href: getSectionPath('transferencias'),
            },
          ]
        : HEADER_NAV_ITEMS,
    [isDelegadoUser]
  );

  const pendingDelegateTransferCount = useMemo(() => {
    if (!isDelegadoUser) return 0;
    return state.transfers.filter(
      (t) => getDelegateTransferActionRole(currentUser, t) === 'CAN_APPROVE'
    ).length;
  }, [isDelegadoUser, currentUser, state.transfers]);

  return (
    <header className="sticky top-0 z-40 bg-[#0d0d0d] text-white border-b border-white/10">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 lg:gap-6">
        {/* Zone 1: Single-line Brand Lockup (Primary route: /) */}
        <a
          href={getSectionPath('inicio')}
          aria-current={activeSection === 'inicio' ? 'page' : undefined}
          onClick={(e) => handleLinkClick(e, 'inicio')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#707ef9]"
        >
          <img
            src={LOGO_LIGHT_SVG}
            alt="Isotipo Campeonato Intercarreras UFRO"
            className="h-7 w-auto shrink-0"
            referrerPolicy="no-referrer"
          />
          <span className="font-display text-base lg:text-lg font-bold tracking-wider uppercase text-white">
            Intercarreras
          </span>
        </a>

        {/* Zone 2: Concise single-line nav links (Transferencias visible exclusively to Delegados) */}
        <nav aria-label="Navegación principal" className="hidden xl:flex items-center gap-4">
          {visibleNavItems.map((item) => {
            const isActive = activeSection === item.id;
            const showPendingCount =
              item.id === 'transferencias' && pendingDelegateTransferCount > 0;
            return (
              <a
                key={item.id}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                onClick={(e) => handleLinkClick(e, item.id)}
                className={`relative h-16 flex items-center gap-1.5 text-[13px] font-medium tracking-wide transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#707ef9] ${
                  isActive ? 'text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                {showPendingCount && (
                  <span className="min-w-[18px] h-[18px] px-1 bg-[#707ef9] text-white text-[10px] font-bold tabular-nums inline-flex items-center justify-center">
                    {pendingDelegateTransferCount}
                  </span>
                )}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#707ef9]"
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* Medium desktop nav (compact spacing) */}
        <nav aria-label="Navegación principal compacta" className="hidden lg:flex xl:hidden items-center gap-2.5">
          {visibleNavItems.map((item) => {
            const isActive = activeSection === item.id;
            const showPendingCount =
              item.id === 'transferencias' && pendingDelegateTransferCount > 0;
            return (
              <a
                key={item.id}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                onClick={(e) => handleLinkClick(e, item.id)}
                className={`relative h-16 flex items-center gap-1 text-xs font-medium tracking-wide transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive ? 'text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                {showPendingCount && (
                  <span className="min-w-[16px] h-[16px] px-1 bg-[#707ef9] text-white text-[10px] font-bold tabular-nums inline-flex items-center justify-center">
                    {pendingDelegateTransferCount}
                  </span>
                )}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#707ef9]"
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: Notifications + Account/Login + Panel Oficial */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Notifications Bell (visible when signed in) */}
          {currentUser && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                aria-label="Abrir notificaciones de equipos favoritos"
                aria-expanded={notifOpen}
                className="relative inline-flex items-center justify-center w-9 h-9 border border-white/15 hover:border-[#707ef9] text-neutral-300 hover:text-white transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-[#707ef9] text-white text-[10px] font-bold tabular-nums flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white text-[#0d0d0d] border border-neutral-200 shadow-2xl z-50">
                  <div className="bg-[#0d0d0d] text-white px-4 py-3 flex items-center justify-between border-b border-white/10">
                    <span className="font-display text-xs font-bold uppercase tracking-widest">
                      Notificaciones Favoritos ({notifications.length})
                    </span>
                    <a
                      href={getSectionPath('cuenta')}
                      onClick={(e) => handleLinkClick(e, 'cuenta')}
                      className="text-[11px] text-[#707ef9] hover:underline cursor-pointer"
                    >
                      Gestionar
                    </a>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-neutral-200">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-xs text-neutral-500">
                        Guarda equipos en favoritos desde Mi Cuenta o Posiciones para recibir alertas.
                      </p>
                    ) : (
                      notifications.slice(0, 6).map((n) => {
                        const m = matchMap.get(n.matchId);
                        return (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => {
                              setNotifOpen(false);
                              if (m) onOpenMatchModal(m);
                            }}
                            className="w-full text-left p-3.5 hover:bg-[#f5f6f8] transition-colors block cursor-pointer"
                          >
                            <p
                              className={`text-[11px] font-bold uppercase tracking-wider ${
                                n.isLiveMvp ? 'text-[#707ef9]' : 'text-[#0d0d0d]'
                              }`}
                            >
                              {n.title}
                            </p>
                            <p className="text-xs text-neutral-600 mt-1 line-clamp-2">{n.detail}</p>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Account / Login & Official Panel CTAs */}
          {currentUser ? (
            <>
              <a
                href={getSectionPath('cuenta')}
                aria-current={activeSection === 'cuenta' ? 'page' : undefined}
                onClick={(e) => handleLinkClick(e, 'cuenta')}
                className={`hidden sm:inline-flex items-center gap-2 px-3 py-2 border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeSection === 'cuenta'
                    ? 'bg-white text-[#0d0d0d] border-white'
                    : 'border-white/20 text-white hover:border-[#707ef9]'
                }`}
              >
                <User className="w-3.5 h-3.5 text-[#707ef9] shrink-0" />
                <span className="max-w-[110px] truncate">
                  {currentUser.displayName.split(' ')[0]}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-[#707ef9] font-display font-bold">
                  {ROLE_META[currentUser.role].shortLabel}
                </span>
              </a>

              {hasOfficialAccess && (
                <a
                  href={getSectionPath('panel')}
                  aria-current={activeSection === 'panel' ? 'page' : undefined}
                  onClick={(e) => handleLinkClick(e, 'panel')}
                  className={`hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-display font-bold uppercase tracking-widest transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeSection === 'panel'
                      ? 'bg-white text-[#0d0d0d]'
                      : 'bg-[#707ef9] text-white hover:bg-[#5766eb]'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>{currentUser.role === 'prensa' ? 'Sala de Prensa' : 'Panel Oficial'}</span>
                </a>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-[#707ef9] hover:bg-[#5766eb] text-white text-xs font-display font-bold uppercase tracking-widest transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Iniciar Sesión</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
            aria-expanded={mobileOpen}
            className="lg:hidden inline-flex items-center justify-center w-10 h-10 text-white hover:text-[#707ef9] transition-colors cursor-pointer"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <nav
          aria-label="Navegación móvil"
          className="lg:hidden bg-[#0d0d0d] border-t border-white/10 px-4 py-3 space-y-1"
        >
          {visibleNavItems.map((item) => {
            const isActive = activeSection === item.id;
            const showPendingCount =
              item.id === 'transferencias' && pendingDelegateTransferCount > 0;
            return (
              <a
                key={item.id}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                onClick={(e) => handleLinkClick(e, item.id)}
                className={`w-full text-left px-3 py-3 text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                  isActive
                    ? 'text-white bg-white/5 border-b border-[#707ef9]'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                {showPendingCount && (
                  <span className="min-w-[18px] h-[18px] px-1.5 bg-[#707ef9] text-white text-[10px] font-bold tabular-nums inline-flex items-center justify-center">
                    {pendingDelegateTransferCount}
                  </span>
                )}
              </a>
            );
          })}
          <div className="pt-2 space-y-2 border-t border-white/10">
            {currentUser ? (
              <>
                <a
                  href={getSectionPath('cuenta')}
                  onClick={(e) => handleLinkClick(e, 'cuenta')}
                  className="w-full py-2.5 px-3 border border-white/20 text-white text-left text-xs font-display font-bold uppercase tracking-widest flex items-center justify-between"
                >
                  <span>Mi Cuenta · {currentUser.displayName}</span>
                  <span className="text-[#707ef9]">{ROLE_META[currentUser.role].shortLabel}</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    onOpenAuth();
                  }}
                  className="w-full py-2.5 px-3 bg-white/10 text-white font-display font-bold uppercase tracking-widest text-xs"
                >
                  Cambiar cuenta / Cerrar sesión
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onOpenAuth();
                }}
                className="w-full py-3 bg-[#707ef9] text-white font-display font-bold uppercase tracking-widest text-sm"
              >
                Iniciar Sesión UFRO
              </button>
            )}

            {hasOfficialAccess && (
              <a
                href={getSectionPath('panel')}
                onClick={(e) => handleLinkClick(e, 'panel')}
                className="block w-full py-3 bg-[#707ef9] text-white text-center font-display font-bold uppercase tracking-widest text-sm"
              >
                {currentUser?.role === 'prensa' ? 'Sala de Prensa' : 'Panel Oficial'}
              </a>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
