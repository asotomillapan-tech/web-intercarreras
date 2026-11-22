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
    <div className="min-h-screen bg-[#f5f6f8] pb-20">
      {/* Carbon Editorial Header */}
      <section className="bg-[#0d0d0d] text-white border-b border-white/10">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[#707ef9] font-medium">
            <Gamepad2 className="w-4 h-4" />
            <span>Zona Interactiva · Campeonato Intercarreras UFRO</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-tight">
            Minijuegos del Campeonato
          </h1>
          <p className="text-sm sm:text-base text-neutral-300 max-w-2xl leading-relaxed">
            Experiencias interactivas conectadas directamente a los equipos, escudos, carreras y
            resultados reales de Intercarreras UFRO. Ya puedes jugar <strong className="text-white">LEYENDAS</strong>{' '}
            mientras preparamos Fantasy 2027.
          </p>
        </div>
      </section>

      {/* Featured Games Grid */}
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Card 1: LEYENDAS (Playable Now) */}
          <article className="bg-white border-2 border-[#0d0d0d] flex flex-col justify-between">
            <div>
              <div className="bg-[#0d0d0d] text-white p-6 border-b border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#707ef9]">
                    Modo 01 · Simulador de Carrera UFRO
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-emerald-400 font-semibold">
                    <span className="w-2 h-2 bg-emerald-400 inline-block" />
                    Disponible ahora
                  </span>
                </div>
                <h2 className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-tight mt-2">
                  LEYENDAS
                </h2>
                <p className="text-sm text-neutral-300 mt-2 leading-relaxed">
                  Forja tu carrera universitaria semestre a semestre desde mechón hasta ídolo del
                  campus: juega con los clubes reales de Intercarreras UFRO, disputa playoffs, llega
                  a la Selección UFRO y entra al Top Global Semanal.
                </p>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="border border-neutral-200 bg-[#f5f6f8] p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0d0d0d]">
                      <Crown className="w-4 h-4 text-[#707ef9]" />
                      Equipos Reales UFRO
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      Pruebas mechonas, préstamos y mercado de pases integrados con los clubes,
                      divisiones y escudos inscritos en el campeonato.
                    </p>
                  </div>

                  <div className="border border-neutral-200 bg-[#f5f6f8] p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0d0d0d]">
                      <GraduationCap className="w-4 h-4 text-[#707ef9]" />
                      Carrera y Postgrados
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      Equilibra rendimiento deportivo y vida académica con eventos exclusivos por
                      carrera, Beca Deportiva, Magíster y Doctorado.
                    </p>
                  </div>

                  <div className="border border-neutral-200 bg-[#f5f6f8] p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0d0d0d]">
                      <Trophy className="w-4 h-4 text-[#707ef9]" />
                      Top Global Semanal
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      Publica tu carrera retirada en el ranking oficial de la semana y compite en
                      categorías de OVR, títulos, goles, puntos y palmarés.
                    </p>
                  </div>

                  <div className="border border-neutral-200 bg-[#f5f6f8] p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0d0d0d]">
                      <ImageIcon className="w-4 h-4 text-[#707ef9]" />
                      Tarjeta Final PNG
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      Al retirarte genera tu póster coleccionable 1080×1920 con tu escudo, trofeos,
                      hitos y estadística histórica para compartir.
                    </p>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    id="btn-launch-leyendas"
                    onClick={() => setActiveGame('leyendas')}
                    className="w-full bg-[#0d0d0d] hover:bg-[#707ef9] text-white font-display text-2xl uppercase tracking-wider py-3.5 px-6 transition-colors flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>Jugar LEYENDAS</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600">
              <span>
                Fútbol 11 · Fútbol 7 · Básquetbol · Voleibol (Hombres y Mujeres)
              </span>
              <span className="font-mono uppercase text-[11px] text-[#0d0d0d] font-semibold">
                {state.teams.length} equipos reales · {state.leyendasLeaderboard.length} leyendas registradas
              </span>
            </div>
          </article>

          {/* Card 2: Fantasy Intercarreras 2027 (Upcoming) */}
          <article className="bg-white border border-neutral-200 flex flex-col justify-between">
            <div>
              <div className="bg-[#0d0d0d] text-white p-6 border-b border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#707ef9]">
                    Modo 02 · Temporada 2027
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-300 font-medium">
                    <CalendarClock className="w-3.5 h-3.5" />
                    En preparación
                  </span>
                </div>
                <h2 className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-tight mt-2">
                  Fantasy Intercarreras 2027
                </h2>
                <p className="text-sm text-neutral-300 mt-2 leading-relaxed">
                  Arma tu equipo ideal con presupuesto oficial usando jugadores reales inscritos en
                  Intercarreras UFRO y suma puntos fecha a fecha con las planillas arbitrales.
                </p>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="border border-neutral-200 bg-[#f5f6f8] p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0d0d0d]">
                      <Users className="w-4 h-4 text-[#707ef9]" />
                      Plantel y Presupuesto
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      Selecciona titulares y suplentes respetando el límite de presupuesto y cupos
                      por carrera en cada disciplina.
                    </p>
                  </div>

                  <div className="border border-neutral-200 bg-[#f5f6f8] p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0d0d0d]">
                      <Trophy className="w-4 h-4 text-[#707ef9]" />
                      Puntaje Real UFRO
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      Goles, asistencias, vallas invictas, puntos, bloqueos y premios POTM se
                      sincronizarán directo desde cada partido finalizado.
                    </p>
                  </div>

                  <div className="border border-neutral-200 bg-[#f5f6f8] p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0d0d0d]">
                      <Layers className="w-4 h-4 text-[#707ef9]" />
                      Ligas por Facultad
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      Compite en la tabla general del campus o crea ligas privadas con compañeros de
                      tu carrera.
                    </p>
                  </div>

                  <div className="border border-neutral-200 bg-[#f5f6f8] p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0d0d0d]">
                      <Sparkles className="w-4 h-4 text-[#707ef9]" />
                      Mercado Semanal
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      Ajusta tu capitán (puntos x2) y realiza cambios estratégicos antes del cierre
                      de cada jornada.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600">
              <span>Lanzamiento proyectado: Temporada Oficial 2027</span>
              <span className="font-mono uppercase text-[11px] text-[#0d0d0d] font-semibold">
                Base lista: {state.teams.length} equipos · {state.players.length} jugadores
              </span>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
