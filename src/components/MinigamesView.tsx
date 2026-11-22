import { Award, CalendarClock, Crown, Gamepad2, Layers, Sparkles, Trophy, Users } from 'lucide-react';
import type { TournamentState } from '../types/tournament';

interface MinigamesViewProps {
  state: TournamentState;
}

export function MinigamesView({ state }: MinigamesViewProps) {
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
            Espacio oficial reservado para las experiencias interactivas conectadas directamente a
            los planteles, estadísticas y resultados reales de Intercarreras UFRO. Próximamente
            habilitaremos ambos modos de juego.
          </p>
        </div>
      </section>

      {/* Two Featured Upcoming Game Blueprints */}
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Card 1: Fantasy Intercarreras 2027 */}
          <article className="bg-white border border-neutral-200 flex flex-col justify-between">
            <div>
              <div className="bg-[#0d0d0d] text-white p-6 border-b border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#707ef9]">
                    Modo 01 · Temporada 2027
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-300 font-medium">
                    <CalendarClock className="w-3.5 h-3.5" />
                    En preparación
                  </span>
                </div>
                <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight mt-2">
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

          {/* Card 2: Leyendas Intercarreras */}
          <article className="bg-white border border-neutral-200 flex flex-col justify-between">
            <div>
              <div className="bg-[#0d0d0d] text-white p-6 border-b border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#707ef9]">
                    Modo 02 · Formato Intercarreras
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-300 font-medium">
                    <CalendarClock className="w-3.5 h-3.5" />
                    En preparación
                  </span>
                </div>
                <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight mt-2">
                  Leyendas Intercarreras
                </h2>
                <p className="text-sm text-neutral-300 mt-2 leading-relaxed">
                  El clásico desafío de conocimiento y memoria deportiva adaptado al universo
                  Intercarreras UFRO: identifica figuras, carreras, dorsales, clubes y campeones.
                </p>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="border border-neutral-200 bg-[#f5f6f8] p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0d0d0d]">
                      <Crown className="w-4 h-4 text-[#707ef9]" />
                      Jugador Misterioso
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      Adivina al protagonista del día usando pistas de facultad, carrera, posición,
                      dorsal, disciplina y equipo actual.
                    </p>
                  </div>

                  <div className="border border-neutral-200 bg-[#f5f6f8] p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0d0d0d]">
                      <Award className="w-4 h-4 text-[#707ef9]" />
                      Cuadrícula de Clubes
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      Completa retos cruzando escudos, traspasos históricos y logros de temporadas
                      anteriores en el menor número de intentos.
                    </p>
                  </div>

                  <div className="border border-neutral-200 bg-[#f5f6f8] p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0d0d0d]">
                      <Trophy className="w-4 h-4 text-[#707ef9]" />
                      Rachas del Campus
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      Guarda tu racha diaria asociada a tu cuenta UFRO y compite por el ranking de
                      historiadores del torneo.
                    </p>
                  </div>

                  <div className="border border-neutral-200 bg-[#f5f6f8] p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0d0d0d]">
                      <Sparkles className="w-4 h-4 text-[#707ef9]" />
                      Memoria de Campeones
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      Alimentado con los escudos oficiales, años de fundación y palmarés que los
                      equipos ya están registrando hoy.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600">
              <span>Estado: Sección habilitada · Mecánicas en desarrollo</span>
              <span className="font-mono uppercase text-[11px] text-[#0d0d0d] font-semibold">
                Próximamente disponible
              </span>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
