import { useMemo, useState } from 'react';
import { ArrowRight, Calendar, Search, Shield, Trophy, Users } from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
import { computeTeamHistoricalStats } from '../domain/tournamentEngine';
import type { DisciplineId, Team, TournamentState } from '../types/tournament';
import { TeamCrest } from './TeamCrest';

interface TeamsViewProps {
  state: TournamentState;
  selectedDiscipline: DisciplineId;
  onSelectDiscipline: (id: DisciplineId) => void;
  onOpenTeamProfile: (team: Team) => void;
}

export function TeamsView({
  state,
  selectedDiscipline,
  onSelectDiscipline,
  onOpenTeamProfile,
}: TeamsViewProps) {
  const [showAllDisciplines, setShowAllDisciplines] = useState(false);
  const [groupFilter, setGroupFilter] = useState<string>('ALL');
  const [queryText, setQueryText] = useState('');

  const scopedTeams = useMemo(() => {
    const base = showAllDisciplines
      ? state.teams
      : state.teams.filter((t) => t.disciplineId === selectedDiscipline);
    return base;
  }, [state.teams, selectedDiscipline, showAllDisciplines]);

  const availableGroups = useMemo(() => {
    return Array.from(new Set(scopedTeams.map((t) => t.groupName).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'es')
    );
  }, [scopedTeams]);

  const filteredTeams = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return scopedTeams
      .filter((t) => {
        if (groupFilter !== 'ALL' && t.groupName !== groupFilter) return false;
        if (!q) return true;
        return (
          t.nombre.toLowerCase().includes(q) ||
          t.sigla.toLowerCase().includes(q) ||
          t.carrera.toLowerCase().includes(q) ||
          t.facultad.toLowerCase().includes(q) ||
          (t.logrosAnteriores ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [scopedTeams, groupFilter, queryText]);

  const rosterCountMap = useMemo(() => {
    const map = new Map<string, number>();
    state.players.forEach((p) => {
      map.set(p.teamId, (map.get(p.teamId) ?? 0) + 1);
    });
    return map;
  }, [state.players]);

  const activeDisciplineMeta = DISCIPLINE_MAP[selectedDiscipline];

  return (
    <div className="min-h-screen bg-[#f5f6f8] pb-16">
      {/* Carbon Editorial Header */}
      <section className="bg-[#0d0d0d] text-white border-b border-white/10">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#707ef9] font-medium">
                Directorio Oficial · Temporada {state.temporada}
              </p>
              <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-tight mt-2">
                Equipos del Campeonato
              </h1>
              <p className="text-sm text-neutral-300 mt-2 max-w-2xl">
                Explora la identidad oficial de cada club intercarreras: escudo institucional, año de
                fundación, palmarés histórico, plantel inscrito y rendimiento acumulado.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-6 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-8">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-neutral-400">
                  Equipos visibles
                </p>
                <p className="font-display text-3xl font-bold tabular-nums mt-0.5">
                  {filteredTeams.length}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-neutral-400">
                  Con escudo
                </p>
                <p className="font-display text-3xl font-bold tabular-nums text-[#707ef9] mt-0.5">
                  {filteredTeams.filter((t) => Boolean(t.escudo)).length}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-neutral-400">
                  Total torneo
                </p>
                <p className="font-display text-3xl font-bold tabular-nums mt-0.5">
                  {state.teams.length}
                </p>
              </div>
            </div>
          </div>

          {/* Discipline Switcher */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 border-t border-white/10 pt-5">
            <button
              type="button"
              onClick={() => {
                setShowAllDisciplines(true);
                setGroupFilter('ALL');
              }}
              className={`px-3.5 py-2 text-xs font-display font-bold uppercase tracking-wider whitespace-nowrap transition-colors cursor-pointer ${
                showAllDisciplines
                  ? 'bg-[#707ef9] text-white'
                  : 'bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              Todas las disciplinas
            </button>
            {DISCIPLINES.map((d) => {
              const active = !showAllDisciplines && selectedDiscipline === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setShowAllDisciplines(false);
                    onSelectDiscipline(d.id);
                    setGroupFilter('ALL');
                  }}
                  className={`px-3.5 py-2 text-xs font-display font-bold uppercase tracking-wider whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#707ef9] text-white'
                      : 'bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {d.nombreCorto}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Filter Bar + Directory Grid */}
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        <div className="bg-white border border-neutral-200 p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Buscar por equipo, sigla, carrera o títulos..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-300 focus:border-[#707ef9] focus:outline-none bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {availableGroups.length > 1 && (
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="px-3 py-2 text-xs font-medium border border-neutral-300 bg-white focus:border-[#707ef9] focus:outline-none"
                aria-label="Filtrar por grupo"
              >
                <option value="ALL">Todos los grupos</option>
                {availableGroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            )}
            <span className="text-xs text-neutral-500 font-mono">
              {showAllDisciplines
                ? 'Vista general'
                : `${activeDisciplineMeta.nombre} · ${filteredTeams.length} equipos`}
            </span>
          </div>
        </div>

        {filteredTeams.length === 0 ? (
          <div className="bg-white border border-neutral-200 p-12 text-center space-y-2">
            <Shield className="w-10 h-10 text-neutral-300 mx-auto" />
            <h2 className="font-display text-xl font-bold uppercase text-[#0d0d0d]">
              Sin equipos para los filtros seleccionados
            </h2>
            <p className="text-sm text-neutral-600 max-w-md mx-auto">
              Ajusta tu búsqueda o cambia de disciplina para consultar los planteles oficiales del
              campeonato.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
            {filteredTeams.map((team) => {
              const disc = DISCIPLINE_MAP[team.disciplineId];
              const stats = computeTeamHistoricalStats(team, disc.sportType, state.matches);
              const playerCount = rosterCountMap.get(team.id) ?? 0;

              return (
                <article
                  key={team.id}
                  onClick={() => onOpenTeamProfile(team)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenTeamProfile(team);
                    }
                  }}
                  className="group bg-white border border-neutral-200 hover:border-[#0d0d0d] transition-colors flex flex-col justify-between cursor-pointer"
                >
                  <div className="p-5 space-y-4">
                    {/* Top row: Crest + Name + Discipline */}
                    <div className="flex items-start gap-4">
                      <TeamCrest
                        escudo={team.escudo}
                        sigla={team.sigla}
                        nombre={team.nombre}
                        size="lg"
                        surface="light"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono uppercase tracking-wider text-[#707ef9] font-semibold">
                            {team.sigla} · {team.groupName}
                          </span>
                          {team.anioFundacion && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500 font-mono">
                              <Calendar className="w-3 h-3" />
                              Est. {team.anioFundacion}
                            </span>
                          )}
                        </div>
                        <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-[#0d0d0d] group-hover:text-[#707ef9] transition-colors leading-tight mt-0.5 truncate">
                          {team.nombre}
                        </h2>
                        <p className="text-xs text-neutral-600 truncate mt-0.5">{team.carrera}</p>
                        <p className="text-[11px] text-neutral-400 truncate">{disc.nombreCorto}</p>
                      </div>
                    </div>

                    {/* Titles / Honors */}
                    <div className="border-t border-neutral-100 pt-3 min-h-[44px]">
                      {team.logrosAnteriores ? (
                        <div className="flex items-start gap-2 text-xs text-neutral-700">
                          <Trophy className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <p className="line-clamp-2">{team.logrosAnteriores}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-400 italic">
                          Sin títulos anteriores registrados en ficha.
                        </p>
                      )}
                    </div>

                    {/* Compact Campaign Strip */}
                    <div className="grid grid-cols-4 gap-2 bg-[#f5f6f8] border border-neutral-200/80 p-2.5 text-center">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                          Plantel
                        </p>
                        <p className="font-display text-base font-bold text-[#0d0d0d] tabular-nums">
                          {playerCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-neutral-500">PJ</p>
                        <p className="font-display text-base font-bold text-[#0d0d0d] tabular-nums">
                          {stats.pj}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-neutral-500">PG</p>
                        <p className="font-display text-base font-bold text-emerald-700 tabular-nums">
                          {stats.pg}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-neutral-500">PTS</p>
                        <p className="font-display text-base font-bold text-[#707ef9] tabular-nums">
                          {stats.puntos}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="px-5 py-3 border-t border-neutral-200 bg-neutral-50/70 flex items-center justify-between text-xs font-display font-bold uppercase tracking-wider text-[#0d0d0d] group-hover:bg-[#0d0d0d] group-hover:text-white transition-colors">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      Ver ficha y plantel completo
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
