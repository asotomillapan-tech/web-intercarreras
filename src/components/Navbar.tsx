import { useMemo, useState, type MouseEvent } from 'react';
import { Bell, LogIn, Menu, Shield, User, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
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
import { EDITORIAL_EASE } from './MotionPrimitives';

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
    <header className="sticky top-0 z-40 bg-[#050507]/80 backdrop-blur-xl border-b border-white/[0.06] text-zinc-100">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        {/* Brand Lockup (Primary route: /) */}
        <a
          href={getSectionPath('inicio')}
          aria-current={activeSection === 'inicio' ? 'page' : undefined}
          onClick={(e) => handleLinkClick(e, 'inicio')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 cursor-pointer group focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#707ef9]"
        >
          <img
            src={LOGO_LIGHT_SVG}
            alt="Isotipo Campeonato Intercarreras UFRO"
            className="h-7 w-auto shrink-0 transition-transform duration-300 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
          <span className="text-[17px] font-medium tracking-[-0.02em] text-white">
            Inter<span className="font-editorial text-[19px] text-zinc-300">carreras</span>
          </span>
        </a>

        {/* Centered floating glass navigation capsule (Artfolio reference rhythm) */}
        <nav
          aria-label="Navegación principal"
          className="hidden lg:flex items-center p-1 rounded-full bg-white/[0.03] border border-white/[0.08]"
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
                className={`relative px-3.5 xl:px-4 py-1.5 rounded-full text-[13px] font-normal transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#707ef9] ${
                  isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-active-capsule"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-full bg-white/[0.09] border border-white/[0.15]"
                    aria-hidden="true"
                  />
                )}
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  <span>{item.label}</span>
                  {showPendingCount && (
                    <span className="min-w-[17px] h-[17px] px-1 rounded-full bg-[#707ef9] text-white text-[10px] font-semibold tabular-nums inline-flex items-center justify-center">
                      {pendingDelegateTransferCount}
                    </span>
                  )}
                </span>
              </a>
            );
          })}
        </nav>

        {/* Right Controls: Notifications + Account / Login + Panel */}
        <div className="flex items-center gap-2 shrink-0">
          {currentUser && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                aria-label="Abrir notificaciones de equipos favoritos"
                aria-expanded={notifOpen}
                className="relative inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.03] border border-white/[0.1] hover:border-white/25 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[#707ef9] text-white text-[10px] font-semibold tabular-nums flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: EDITORIAL_EASE }}
                    className="absolute right-0 mt-2.5 w-80 sm:w-96 rounded-2xl bg-[#0e0e13] text-zinc-100 border border-white/[0.1] shadow-2xl shadow-black/80 overflow-hidden z-50"
                  >
                    <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.08] bg-white/[0.02]">
                      <span className="text-xs font-medium text-zinc-200">
                        Notificaciones ({notifications.length})
                      </span>
                      <a
                        href={getSectionPath('cuenta')}
                        onClick={(e) => handleLinkClick(e, 'cuenta')}
                        className="text-xs text-[#9aa5ff] hover:text-white transition-colors cursor-pointer"
                      >
                        Gestionar
                      </a>
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.06]">
                      {notifications.length === 0 ? (
                        <p className="p-4 text-xs text-zinc-500">
                          Sigue equipos en favoritos para recibir alertas de partidos.
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
                              className="w-full text-left p-3.5 hover:bg-white/[0.04] transition-colors block cursor-pointer"
                            >
                              <p
                                className={`text-xs font-medium ${
                                  n.isLiveMvp ? 'text-[#9aa5ff]' : 'text-white'
                                }`}
                              >
                                {n.title}
                              </p>
                              <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{n.detail}</p>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {currentUser ? (
            <>
              <a
                href={getSectionPath('cuenta')}
                aria-current={activeSection === 'cuenta' ? 'page' : undefined}
                onClick={(e) => handleLinkClick(e, 'cuenta')}
                className={`hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeSection === 'cuenta'
                    ? 'bg-white text-[#050507] border-white'
                    : 'bg-white/[0.03] border-white/[0.12] text-zinc-200 hover:border-white/30 hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5 text-[#707ef9] shrink-0" />
                <span className="max-w-[100px] truncate">
                  {currentUser.displayName.split(' ')[0]}
                </span>
                <span className="text-[11px] text-zinc-400">
                  {ROLE_META[currentUser.role].shortLabel}
                </span>
              </a>

              {hasOfficialAccess && (
                <a
                  href={getSectionPath('panel')}
                  aria-current={activeSection === 'panel' ? 'page' : undefined}
                  onClick={(e) => handleLinkClick(e, 'panel')}
                  className={`hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeSection === 'panel'
                      ? 'bg-white text-[#050507]'
                      : 'bg-[#707ef9] text-white hover:bg-[#5f6ef5]'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>{currentUser.role === 'prensa' ? 'Prensa' : 'Panel'}</span>
                </a>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.14] hover:border-white/30 text-zinc-100 text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-[#9aa5ff]" />
              <span>Iniciar Sesión</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
            aria-expanded={mobileOpen}
            className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.08] text-zinc-200 hover:text-white transition-colors cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            aria-label="Navegación móvil"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: EDITORIAL_EASE }}
            className="lg:hidden overflow-hidden bg-[#08080c] border-t border-white/[0.08]"
          >
            <div className="px-4 py-4 space-y-1">
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
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-normal transition-colors flex items-center justify-between cursor-pointer ${
                      isActive
                        ? 'text-white bg-white/[0.08] border border-white/[0.12]'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                    }`}
                  >
                    <span>{item.label}</span>
                    {showPendingCount && (
                      <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-[#707ef9] text-white text-[10px] font-semibold tabular-nums inline-flex items-center justify-center">
                        {pendingDelegateTransferCount}
                      </span>
                    )}
                  </a>
                );
              })}

              <div className="pt-3 mt-2 space-y-2 border-t border-white/[0.08]">
                {currentUser ? (
                  <>
                    <a
                      href={getSectionPath('cuenta')}
                      onClick={(e) => handleLinkClick(e, 'cuenta')}
                      className="w-full py-3 px-4 rounded-xl border border-white/[0.12] bg-white/[0.03] text-white text-left text-xs font-medium flex items-center justify-between"
                    >
                      <span>Mi Cuenta · {currentUser.displayName}</span>
                      <span className="text-[#9aa5ff]">{ROLE_META[currentUser.role].shortLabel}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileOpen(false);
                        onOpenAuth();
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-white/[0.06] text-zinc-200 font-medium text-xs cursor-pointer"
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
                    className="w-full py-3 rounded-full bg-white text-[#050507] font-medium text-sm cursor-pointer"
                  >
                    Iniciar Sesión UFRO
                  </button>
                )}

                {hasOfficialAccess && (
                  <a
                    href={getSectionPath('panel')}
                    onClick={(e) => handleLinkClick(e, 'panel')}
                    className="block w-full py-3 rounded-full bg-[#707ef9] text-white text-center font-medium text-sm"
                  >
                    {currentUser?.role === 'prensa' ? 'Sala de Prensa' : 'Panel Oficial'}
                  </a>
                )}
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
