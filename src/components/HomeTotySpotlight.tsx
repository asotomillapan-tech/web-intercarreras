import { ArrowRight, ChevronRight } from 'lucide-react';
import { DISCIPLINES } from '../data/ufroSeed';
import type { DisciplineId, TournamentState } from '../types/tournament';
import { RevealSection, SectionKicker } from './MotionPrimitives';
import type { NavSection } from './Navbar';
import {
  TotyCoBrandLockup,
  TotyDoubleShieldFrame,
  TotyWordmark,
} from './TotyVisuals';

interface HomeTotySpotlightProps {
  state: TournamentState;
  onNavigate: (section: NavSection) => void;
  onSelectDiscipline: (id: DisciplineId) => void;
}

const SPORT_FORMATIONS: {
  disciplineId: DisciplineId;
  title: string;
  formation: string;
  subtitle: string;
}[] = [
  {
    disciplineId: 'f7-h-1',
    title: 'Fútbol 7',
    formation: '1-2-2-2',
    subtitle: '1ª Div. · 2ª Div. · 3ª Div. · Damas',
  },
  {
    disciplineId: 'basquet-h',
    title: 'Básquetbol',
    formation: 'Quinteto Ideal',
    subtitle: 'Varones · 3×3 Damas',
  },
  {
    disciplineId: 'voley-m',
    title: 'Voleibol',
    formation: '6 + Líbero',
    subtitle: 'Damas · Varones',
  },
];

export function HomeTotySpotlight({
  state,
  onNavigate,
  onSelectDiscipline,
}: HomeTotySpotlightProps) {
  return (
    <section
      aria-labelledby="home-toty-heading"
      className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-18 border-b border-white/[0.06]"
    >
      <RevealSection>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-7">
          <SectionKicker index="02" label={`Premios Comunidad · ${state.temporada}`} />
          <p className="text-xs text-zinc-400">
            {DISCIPLINES.length} categorías · {state.teams.length} equipos en competencia
          </p>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] toty-stage-bg border border-[#9ec8ff]/25 shadow-[0_28px_70px_-34px_rgba(24,78,224,0.68)]">
          {/* Fine monochrome grain matching the TOTYs identity */}
          <div aria-hidden="true" className="absolute inset-0 toty-grain" />

          {/* Architectural official Escudo_TOTY background accent */}
          <div
            aria-hidden="true"
            className="pointer-events-none hidden lg:flex items-center justify-center absolute right-[31%] top-1/2 -translate-y-1/2 h-[88%] opacity-35"
          >
            <TotyDoubleShieldFrame className="h-full w-auto" />
          </div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 p-7 sm:p-10 lg:p-12 items-center">
            {/* Left column: TOTYs headline, lockup, CTA */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#b8dcff]/20 pb-5">
                <span className="text-xs font-medium tracking-[0.22em] uppercase text-[#c7e2ff]">
                  Votación Oficial TOTYs {state.temporada}
                </span>
                <TotyCoBrandLockup compact />
              </div>

              <div className="space-y-3">
                <h2 id="home-toty-heading" className="sr-only">
                  TOTYs — Team of the Year {state.temporada}
                </h2>
                <TotyWordmark size="hero" />
                <p className="text-lg sm:text-xl font-medium tracking-[-0.02em] text-[#d9ecff] pt-1">
                  Vota por tus favoritos.
                </p>
                <p className="text-sm text-[#c7dcff]/80 max-w-xl leading-relaxed">
                  Arma tu formación titular en cualquiera de las {DISCIPLINES.length} disciplinas del
                  campeonato y elige a las figuras de los{' '}
                  <span className="font-editorial text-white text-base">TOTYs</span>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('votaciones')}
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-gradient-to-r from-[#eef6ff] via-white to-[#d2e7ff] hover:brightness-105 text-[#06102e] text-sm font-semibold shadow-[0_14px_32px_-12px_rgba(184,220,255,0.75)] transition-transform duration-200 hover:-translate-y-0.5 cursor-pointer whitespace-nowrap"
                >
                  <span>Votar en los TOTYs</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <span className="text-xs text-[#c7e2ff]/80">
                  Votación abierta · {DISCIPLINES.length} disciplinas
                </span>
              </div>
            </div>

            {/* Right column: Double-shield framed discipline quick-entry card */}
            <div className="lg:col-span-5">
              <div className="relative rounded-3xl border border-[#b8dcff]/30 bg-[#050a1e]/78 backdrop-blur-md p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-[#b8dcff]/15 pb-3.5">
                  <div>
                    <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#9ec8ff]">
                      Formaciones TOTYs
                    </p>
                    <p className="text-base font-medium text-white mt-0.5">
                      Elige tu disciplina
                    </p>
                  </div>
                  <span className="font-editorial text-lg text-[#c7e2ff]">{state.temporada}</span>
                </div>

                <div className="space-y-2.5">
                  {SPORT_FORMATIONS.map((item) => (
                    <button
                      key={item.disciplineId}
                      type="button"
                      onClick={() => {
                        onSelectDiscipline(item.disciplineId);
                        onNavigate('votaciones');
                      }}
                      className="w-full text-left toty-collector-card rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 cursor-pointer group"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white group-hover:text-[#dbeeff] transition-colors">
                            {item.title}
                          </span>
                          <span className="text-xs font-mono text-[#8bbaff]">
                            · {item.formation}
                          </span>
                        </div>
                        <p className="text-xs text-[#b8d4f8]/65 mt-0.5 truncate">
                          {item.subtitle}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#9ec8ff] shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </RevealSection>
    </section>
  );
}
