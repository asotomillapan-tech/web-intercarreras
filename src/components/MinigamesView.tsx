import { useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  Crown,
  Gamepad2,
  GraduationCap,
  Image as ImageIcon,
  Layers,
  Play,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import type {
  AppUserProfile,
  LeyendasLeaderboardEntry,
  TournamentState,
} from '../types/tournament';
import { LeyendasGame } from './LeyendasGame';
import { RevealSection, SectionKicker } from './MotionPrimitives';

interface MinigamesViewProps {
  state: TournamentState;
  currentUser: AppUserProfile | null;
  onOpenAuth: () => void;
  onSaveLeyendasEntry: (entry: LeyendasLeaderboardEntry) => Promise<void>;
}

export function MinigamesView({
  state,
  currentUser,
  onOpenAuth,
  onSaveLeyendasEntry,
}: MinigamesViewProps) {
  const [activeGame, setActiveGame] = useState<'hub' | 'leyendas'>('hub');

  if (activeGame === 'leyendas') {
    return (
      <LeyendasGame
        state={state}
        currentUser={currentUser}
        onOpenAuth={onOpenAuth}
        onSaveLeyendasEntry={onSaveLeyendasEntry}
        onBackToHub={() => setActiveGame('hub')}
      />
    );
  }

  return (
    <div className="min-h-[80vh] bg-[#050507] text-zinc-100 pb-20">
      {/* Obsidian Editorial Header */}
      <section className="border-b border-white/[0.08]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-4">
          <SectionKicker index="01" label="Zona Interactiva · UFRO" />
          <div className="flex items-center gap-3">
            <h1 className="text-4xl sm:text-5xl font-medium tracking-[-0.035em] text-white">
              Minijuegos del <span className="font-editorial text-[#c8ceff]">campeonato</span>
            </h1>
          </div>
          <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
            Experiencias conectadas a los equipos, escudos y carreras reales de Intercarreras UFRO.
          </p>
        </div>
      </section>

      {/* Featured Games Grid */}
      <RevealSection className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Card 1: LEYENDAS (Playable Now) */}
          <article className="rounded-3xl bg-[#0c0c10] border border-[#707ef9]/35 overflow-hidden flex flex-col justify-between transition-colors hover:border-[#707ef9]/60">
            <div>
              <div className="p-7 border-b border-white/[0.08] bg-gradient-to-br from-[#707ef9]/[0.12] via-[#0c0c10] to-[#0c0c10]">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#a5b0ff] font-medium">
                    <Gamepad2 className="w-3.5 h-3.5" />
                    <span>Simulador de carrera</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] text-emerald-300 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Disponible
                  </span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-medium tracking-[-0.03em] text-white mt-4">
                  <span className="font-editorial text-[#c8ceff]">LEYENDAS</span> UFRO
                </h2>
                <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                  Forja tu carrera semestre a semestre desde mechón hasta ídolo del campus con los
                  clubes reales del campeonato.
                </p>
              </div>

              <div className="p-7 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {[
                    {
                      icon: Crown,
                      title: 'Clubes reales',
                      desc: 'Divisiones, escudos y mercado de pases integrados.',
                    },
                    {
                      icon: GraduationCap,
                      title: 'Vida académica',
                      desc: 'Eventos por carrera, Beca Deportiva y postgrados.',
                    },
                    {
                      icon: Trophy,
                      title: 'Top global semanal',
                      desc: 'Ranking por OVR, títulos, goles y palmarés.',
                    },
                    {
                      icon: ImageIcon,
                      title: 'Tarjeta PNG',
                      desc: 'Póster 1080×1920 coleccionable al retirarte.',
                    },
                  ].map((feat) => {
                    const Icon = feat.icon;
                    return (
                      <div
                        key={feat.title}
                        className="rounded-2xl border border-white/[0.08] bg-[#111117] p-4 space-y-1.5"
                      >
                        <div className="flex items-center gap-2 text-xs font-medium text-white">
                          <Icon className="w-3.5 h-3.5 text-[#a5b0ff]" />
                          <span>{feat.title}</span>
                        </div>
                        <p className="text-xs text-zinc-500 leading-relaxed">{feat.desc}</p>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  id="btn-launch-leyendas"
                  onClick={() => setActiveGame('leyendas')}
                  className="w-full rounded-full bg-white hover:bg-zinc-200 text-[#050507] text-sm font-medium py-3.5 px-6 transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Jugar LEYENDAS</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="px-7 py-4 border-t border-white/[0.08] bg-white/[0.02] flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
              <span>Fútbol · Básquetbol · Voleibol</span>
              <span className="font-mono text-[11px] text-zinc-300 tabular-nums">
                {state.teams.length} equipos · {state.leyendasLeaderboard.length} leyendas
              </span>
            </div>
          </article>

          {/* Card 2: Fantasy Intercarreras 2027 (Upcoming) */}
          <article className="rounded-3xl bg-[#0c0c10] border border-white/[0.08] overflow-hidden flex flex-col justify-between">
            <div>
              <div className="p-7 border-b border-white/[0.08]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-zinc-500 font-medium">Temporada 2027</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-[11px] text-amber-300 font-medium">
                    <CalendarClock className="w-3 h-3" />
                    Próximamente
                  </span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-medium tracking-[-0.03em] text-white mt-4">
                  Fantasy <span className="font-editorial text-zinc-400">2027</span>
                </h2>
                <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                  Arma tu equipo ideal con presupuesto oficial usando jugadores inscritos y suma
                  puntos fecha a fecha.
                </p>
              </div>

              <div className="p-7">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {[
                    {
                      icon: Users,
                      title: 'Presupuesto oficial',
                      desc: 'Titulares y suplentes respetando cupos por carrera.',
                    },
                    {
                      icon: Trophy,
                      title: 'Puntaje en vivo',
                      desc: 'Sincronizado directo con planillas arbitrales.',
                    },
                    {
                      icon: Layers,
                      title: 'Ligas privadas',
                      desc: 'Compite en la general o con tu facultad.',
                    },
                    {
                      icon: Sparkles,
                      title: 'Capitán ×2',
                      desc: 'Cambios estratégicos antes de cada jornada.',
                    },
                  ].map((feat) => {
                    const Icon = feat.icon;
                    return (
                      <div
                        key={feat.title}
                        className="rounded-2xl border border-white/[0.06] bg-[#101016] p-4 space-y-1.5 opacity-85"
                      >
                        <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                          <Icon className="w-3.5 h-3.5 text-[#9aa5ff]" />
                          <span>{feat.title}</span>
                        </div>
                        <p className="text-xs text-zinc-500 leading-relaxed">{feat.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-7 py-4 border-t border-white/[0.08] bg-white/[0.02] flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
              <span>Lanzamiento proyectado 2027</span>
              <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                {state.teams.length} equipos · {state.players.length} jugadores
              </span>
            </div>
          </article>
        </div>
      </RevealSection>
    </div>
  );
}
