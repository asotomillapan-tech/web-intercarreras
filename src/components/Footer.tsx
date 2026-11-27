import type { MouseEvent } from 'react';
import { LOGO_LIGHT_SVG } from '../data/ufroSeed';
import { getSectionPath, isPrimarySpaNavigationClick, type NavSection } from '../domain/navigationRoutes';

interface FooterProps {
  onNavigate: (section: NavSection) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  const handleLinkClick = (event: MouseEvent<HTMLAnchorElement>, section: NavSection) => {
    if (!isPrimarySpaNavigationClick(event)) return;
    event.preventDefault();
    onNavigate(section);
  };

  return (
    <footer className="bg-[#050507] text-zinc-300 border-t border-white/[0.08]">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-white/[0.07]">
          <div className="md:col-span-5 space-y-4">
            <a
              href={getSectionPath('inicio')}
              onClick={(e) => handleLinkClick(e, 'inicio')}
              className="inline-flex items-center gap-3 hover:opacity-90 transition-opacity"
            >
              <img
                src={LOGO_LIGHT_SVG}
                alt="Isotipo Intercarreras UFRO"
                className="h-7 w-auto"
                referrerPolicy="no-referrer"
              />
              <span className="text-lg font-medium tracking-[-0.02em] text-white">
                Campeonato <span className="font-editorial text-xl text-zinc-300">Intercarreras</span>
              </span>
            </a>
            <p className="text-sm text-zinc-500 max-w-sm leading-relaxed">
              Universidad de La Frontera, Temuco. Fútbol 7, Básquetbol y Voleibol oficial.
            </p>
          </div>

          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-medium text-zinc-500">Competencia</h3>
            <ul className="space-y-2.5 text-sm text-zinc-400">
              <li>
                <a
                  href={getSectionPath('inicio')}
                  onClick={(e) => handleLinkClick(e, 'inicio')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Inicio
                </a>
              </li>
              <li>
                <a
                  href={getSectionPath('posiciones')}
                  onClick={(e) => handleLinkClick(e, 'posiciones')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Posiciones y playoffs
                </a>
              </li>
              <li>
                <a
                  href={getSectionPath('equipos')}
                  onClick={(e) => handleLinkClick(e, 'equipos')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Equipos
                </a>
              </li>
              <li>
                <a
                  href={getSectionPath('jugadores')}
                  onClick={(e) => handleLinkClick(e, 'jugadores')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Jugadores
                </a>
              </li>
              <li>
                <a
                  href={getSectionPath('votaciones')}
                  onClick={(e) => handleLinkClick(e, 'votaciones')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Votaciones
                </a>
              </li>
              <li>
                <a
                  href={getSectionPath('minijuegos')}
                  onClick={(e) => handleLinkClick(e, 'minijuegos')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Minijuegos
                </a>
              </li>
              <li>
                <a
                  href={getSectionPath('galeria')}
                  onClick={(e) => handleLinkClick(e, 'galeria')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Galería
                </a>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-3">
            <h3 className="text-xs font-medium text-zinc-500">Gestión</h3>
            <ul className="space-y-2.5 text-sm text-zinc-400">
              <li>
                <a
                  href={getSectionPath('cuenta')}
                  onClick={(e) => handleLinkClick(e, 'cuenta')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Mi Cuenta
                </a>
              </li>
              <li>
                <a
                  href={getSectionPath('inscripciones')}
                  onClick={(e) => handleLinkClick(e, 'inscripciones')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Inscripciones
                </a>
              </li>
              <li>
                <a
                  href={getSectionPath('transferencias-publicas')}
                  onClick={(e) => handleLinkClick(e, 'transferencias-publicas')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Transferencias oficiales
                </a>
              </li>
              <li>
                <a
                  href={getSectionPath('panel')}
                  onClick={(e) => handleLinkClick(e, 'panel')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Panel Oficial
                </a>
              </li>
              <li>
                <a
                  href={getSectionPath('privacidad')}
                  onClick={(e) => handleLinkClick(e, 'privacidad')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Privacidad
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
          <span>© 2026 Campeonato Intercarreras · UFRO, Temuco</span>
          <div className="flex flex-wrap items-center gap-5">
            <a
              href={getSectionPath('privacidad')}
              onClick={(e) => handleLinkClick(e, 'privacidad')}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              Política de Privacidad
            </a>
            <span>División de Deportes UFRO</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
