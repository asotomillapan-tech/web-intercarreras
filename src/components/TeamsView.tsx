import { useMemo, useState } from 'react';
import { ArrowRight, Calendar, Layers, Search, Shield, Trophy, Users } from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
import { buildUnifiedClubs, type UnifiedClubProfile } from '../domain/identityCrossRefEngine';
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
  const [showAllDisciplines, setShowAllDisciplines] = useState(true);
  const [groupFilter, setGroupFilter] = useState<string>('ALL');
  const [queryText, setQueryText] = useState('');

  // Cross-reference all clubs by name equivalence across disciplines
  const allUnifiedClubs = useMemo(
    () => buildUnifiedClubs(state.teams, state.players, state.matches),
    [state.teams, state.players, state.matches]
  );

  const multiDisciplineClubCount = useMemo(
    () => allUnifiedClubs.filter((c) => c.disciplines.length > 1).length,
    [allUnifiedClubs]
  );

  const scopedClubs = useMemo(() => {
    if (showAllDisciplines) return allUnifiedClubs;
    return allUnifiedClubs.filter((club) => club.disciplines.includes(selectedDiscipline));
  }, [allUnifiedClubs, selectedDiscipline, showAllDisciplines]);

  const availableGroups = useMemo(() => {
    const groups = new Set<string>();
    scopedClubs.forEach((club) => {
      club.teams.forEach((t) => {
        if (showAllDisciplines || t.disciplineId === selectedDiscipline) {
          if (t.groupName) groups.add(t.groupName);
        }
      });
    });
    return Array.from(groups).sort((a, b) => a.localeCompare(b, 'es'));
  }, [scopedClubs, showAllDisciplines, selectedDiscipline]);

  const filteredClubs = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return scopedClubs.filter((club) => {
      if (groupFilter !== 'ALL') {
        const matchesGroup = club.teams.some(
          (t) =>
            (showAllDisciplines || t.disciplineId === selectedDiscipline) &&
            t.groupName === groupFilter
        );
        if (!matchesGroup) return false;
      }
      if (!q) return true;
      return (
        club.displayName.toLowerCase().includes(q) ||
        club.sigla.toLowerCase().includes(q) ||
        club.careers.some((c) => c.toLowerCase().includes(q)) ||
        club.faculties.some((f) => f.toLowerCase().includes(q)) ||
        (club.logrosAnteriores ?? '').toLowerCase().includes(q) ||
        club.teams.some(
          (t) =>
            t.nombre.toLowerCase().includes(q) ||
            DISCIPLINE_MAP[t.disciplineId].nombre.toLowerCase().includes(q) ||
            DISCIPLINE_MAP[t.disciplineId].nombreCorto.toLowerCase().includes(q)
        )
      );
    });
  }, [scopedClubs, groupFilter, queryText, showAllDisciplines, selectedDiscipline]);

  const rosterCountMap = useMemo(() => {
    const map = new Map<string, number>();
    state.players.forEach((p) => {
      map.set(p.teamId, (map.get(p.teamId) ?? 0) + 1);
    });
    return map;
  }, [state.players]);

  const activeDisciplineMeta = DISCIPLINE_MAP[selectedDiscipline];

  const resolveOpeningSquad = (club: UnifiedClubProfile): Team => {
    if (!showAllDisciplines) {
      const exact = club.teams.find((t) => t.disciplineId === selectedDiscipline);
      if (exact) return exact;
    }
    return club.primaryTeam;
  };

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
                Equipos y Clubes del Campeonato
              </h1>
              <p className="text-sm text-neutral-300 mt-2 max-w-2xl">
                Clubes intercarreras consolidados por nombre en todas las disciplinas: si un mismo
                club participa en varios deportes, se presenta unificado con acceso directo a cada
                rama y plantel.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-6 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-8">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-neutral-400">
                  Clubes visibles
                </p>
                <p className="font-display text-3xl font-bold tabular-nums mt-0.5">
                  {filteredClubs.length}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-neutral-400">
                  Multidisciplina
                </p>
                <p className="font-display text-3xl font-bold tabular-nums text-[#707ef9] mt-0.5">
                  {multiDisciplineClubCount}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-neutral-400">
                  Planteles totales
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
              Todos los clubes ({allUnifiedClubs.length})
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
              placeholder="Buscar por club, disciplina, sigla, carrera o títulos..."
              aria-label="Buscar equipos y clubes"
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
                ? `${filteredClubs.length} clubes unificados`
                : `${activeDisciplineMeta.nombre} · ${filteredClubs.length} equipo(s)`}
            </span>
          </div>
        </div>

        {filteredClubs.length === 0 ? (
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
            {filteredClubs.map((club) => {
              const targetSquad = resolveOpeningSquad(club);
              const isMulti = club.teams.length > 1;
              const targetDisc = DISCIPLINE_MAP[targetSquad.disciplineId];
              const singleStats = computeTeamHistoricalStats(
                targetSquad,
                targetDisc.sportType,
                state.matches
              );

              const cardRosterCount = showAllDisciplines
                ? club.uniquePlayerCount
                : rosterCountMap.get(targetSquad.id) ?? 0;

              return (
                <article
                  key={club.clubKey}
                  className="group bg-white border border-neutral-200 hover:border-[#0d0d0d] transition-colors flex flex-col justify-between"
                >
                  <div className="p-5 space-y-4">
                    {/* Top row: Crest + Unified Name + Year */}
                    <button
                      type="button"
                      onClick={() => onOpenTeamProfile(targetSquad)}
                      className="w-full text-left flex items-start gap-4 cursor-pointer"
                    >
                      <TeamCrest
                        escudo={club.escudo}
                        sigla={club.sigla}
                        nombre={club.displayName}
                        size="lg"
                        surface="light"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono uppercase tracking-wider text-[#707ef9] font-semibold truncate">
                            {club.sigla}
                            {!isMulti ? ` · ${targetSquad.groupName}` : ` · ${club.disciplines.length} ramas`}
                          </span>
                          {club.anioFundacion && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500 font-mono shrink-0">
                              <Calendar className="w-3 h-3" />
                              Est. {club.anioFundacion}
                            </span>
                          )}
                        </div>
                        <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-[#0d0d0d] group-hover:text-[#707ef9] transition-colors leading-tight mt-0.5 truncate">
                          {club.displayName}
                        </h2>
                        <p className="text-xs text-neutral-600 truncate mt-0.5">
                          {club.careers.join(' · ')}
                        </p>
                      </div>
                    </button>

                    {/* Disciplines Breakdown (Interactive squad buttons for multi-discipline clubs) */}
                    <div className="border-t border-neutral-100 pt-3 space-y-1.5">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                        <Layers className="w-3 h-3 text-[#707ef9]" />
                        <span>
                          {isMulti
                            ? `Disciplinas del club (${club.teams.length})`
                            : 'Disciplina inscrita'}
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {club.teams.map((sq) => {
                          const sqDisc = DISCIPLINE_MAP[sq.disciplineId];
                          const isCurrentScope =
                            !showAllDisciplines && sq.disciplineId === selectedDiscipline;
                          return (
                            <button
                              key={sq.id}
                              type="button"
                              onClick={() => onOpenTeamProfile(sq)}
                              className={`px-2 py-1 text-[11px] font-medium border transition-colors cursor-pointer ${
                                isCurrentScope
                                  ? 'bg-[#0d0d0d] text-white border-[#0d0d0d]'
                                  : 'bg-[#f5f6f8] text-[#0d0d0d] border-neutral-200 hover:border-[#707ef9] hover:text-[#707ef9]'
                              }`}
                              title={`Abrir ficha de ${sq.nombre} (${sqDisc.nombre})`}
                            >
                              {sqDisc.nombreCorto}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Titles / Honors */}
                    <div className="border-t border-neutral-100 pt-3 min-h-[40px]">
                      {club.logrosAnteriores ? (
                        <div className="flex items-start gap-2 text-xs text-neutral-700">
                          <Trophy className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <p className="line-clamp-2">{club.logrosAnteriores}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-400 italic">
                          Sin títulos anteriores registrados en ficha.
                        </p>
                      )}
                    </div>

                    {/* Compact Campaign Strip */}
                    {showAllDisciplines && isMulti ? (
                      <div className="grid grid-cols-4 gap-2 bg-[#f5f6f8] border border-neutral-200/80 p-2.5 text-center">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                            Ramas
                          </p>
                          <p className="font-display text-base font-bold text-[#707ef9] tabular-nums">
                            {club.disciplines.length}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                            Jugadores
                          </p>
                          <p className="font-display text-base font-bold text-[#0d0d0d] tabular-nums">
                            {cardRosterCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                            PJ Club
                          </p>
                          <p className="font-display text-base font-bold text-[#0d0d0d] tabular-nums">
                            {club.totalMatchesPlayed}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                            PG Club
                          </p>
                          <p className="font-display text-base font-bold text-emerald-700 tabular-nums">
                            {club.totalWins}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 bg-[#f5f6f8] border border-neutral-200/80 p-2.5 text-center">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                            Plantel
                          </p>
                          <p className="font-display text-base font-bold text-[#0d0d0d] tabular-nums">
                            {cardRosterCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                            PJ
                          </p>
                          <p className="font-display text-base font-bold text-[#0d0d0d] tabular-nums">
                            {singleStats.pj}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                            PG
                          </p>
                          <p className="font-display text-base font-bold text-emerald-700 tabular-nums">
                            {singleStats.pg}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                            PTS
                          </p>
                          <p className="font-display text-base font-bold text-[#707ef9] tabular-nums">
                            {singleStats.puntos}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <button
                    type="button"
                    onClick={() => onOpenTeamProfile(targetSquad)}
                    className="w-full px-5 py-3 border-t border-neutral-200 bg-neutral-50/70 flex items-center justify-between text-xs font-display font-bold uppercase tracking-wider text-[#0d0d0d] hover:bg-[#0d0d0d] hover:text-white transition-colors cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      {isMulti ? 'Ver ficha del club y ramas' : 'Ver ficha y plantel completo'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

