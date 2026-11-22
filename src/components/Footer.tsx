import { LOGO_LIGHT_SVG } from '../data/ufroSeed';
import type { NavSection } from './Navbar';

interface FooterProps {
  onNavigate: (section: NavSection) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="bg-[#0d0d0d] text-white border-t border-white/10">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-white/10">
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src={LOGO_LIGHT_SVG}
                alt="Isotipo Intercarreras UFRO"
                className="h-8 w-auto"
                referrerPolicy="no-referrer"
              />
              <span className="font-display text-xl font-bold uppercase tracking-wider">
                Campeonato Intercarreras UFRO
              </span>
            </div>
            <p className="text-sm text-neutral-400 max-w-md leading-relaxed">
              Competencia deportiva oficial de la Universidad de La Frontera, Temuco. Integrando
              Fútbol 7, Básquetbol y Voleibol para toda la comunidad estudiantil de pregrado y
              postgrado.
            </p>
          </div>

          <div className="md:col-span-3 space-y-3">
            <h3 className="font-display text-xs font-bold uppercase tracking-widest text-neutral-400">
              Competencia
            </h3>
            <ul className="space-y-2 text-sm text-neutral-300">
              <li>
                <button type="button" onClick={() => onNavigate('inicio')} className="hover:text-[#707ef9] cursor-pointer">
                  Inicio y calendario oficial
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('posiciones')} className="hover:text-[#707ef9] cursor-pointer">
                  Tablas de posiciones y playoffs
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('equipos')} className="hover:text-[#707ef9] cursor-pointer">
                  Equipos, escudos e historia
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('jugadores')} className="hover:text-[#707ef9] cursor-pointer">
                  Perfiles de jugadores
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('votaciones')} className="hover:text-[#707ef9] cursor-pointer">
                  Votaciones (POTM, MVP y TOTY)
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('minijuegos')} className="hover:text-[#707ef9] cursor-pointer">
                  Minijuegos (Fantasy 2027 y Leyendas)
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('galeria')} className="hover:text-[#707ef9] cursor-pointer">
                  Galería fotográfica 2025/2026
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-3">
            <h3 className="font-display text-xs font-bold uppercase tracking-widest text-neutral-400">
              Gestión y Reglamentos
            </h3>
            <ul className="space-y-2 text-sm text-neutral-300">
              <li>
                <button type="button" onClick={() => onNavigate('cuenta')} className="hover:text-[#707ef9] cursor-pointer">
                  Mi Cuenta, favoritos y notificaciones
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('inscripciones')} className="hover:text-[#707ef9] cursor-pointer">
                  Inscripción de equipos y cupos
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('transferencias-publicas')}
                  className="hover:text-[#707ef9] cursor-pointer"
                >
                  Transferencias oficiales efectuadas
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('panel')} className="hover:text-[#707ef9] cursor-pointer">
                  Panel de arbitraje, roles y Google Sheets
                </button>
              </li>
              <li>
                <a
                  href="/privacidad"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('privacidad');
                  }}
                  className="hover:text-[#707ef9] cursor-pointer"
                >
                  Política de Privacidad
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <span>© 2026 Campeonato Intercarreras · Universidad de La Frontera, Temuco, Chile</span>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="/privacidad"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('privacidad');
              }}
              className="text-neutral-300 hover:text-[#707ef9] underline"
            >
              Política de Privacidad
            </a>
            <span>Dirección de Desarrollo Estudiantil · División de Deportes</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
