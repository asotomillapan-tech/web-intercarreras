import { useMemo, useState } from 'react';
import { ArrowRight, Calendar, Layers, Search, Shield, Trophy, Users } from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
import { buildUnifiedClubs, type UnifiedClubProfile } from '../domain/identityCrossRefEngine';
import { computeTeamHistoricalStats } from '../domain/tournamentEngine';
import type { DisciplineId, Team, TournamentState } from '../types/tournament';
import { SectionKicker } from './MotionPrimitives';
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
    <div className="min-h-screen bg-[#050507] text-zinc-100 pb-20">
      {/* Editorial Header */}
      <section className="border-b border-white/[0.06]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <SectionKicker index="01" label={`Directorio ${state.temporada}`} />
              <h1 className="text-4xl sm:text-5xl font-medium tracking-[-0.035em] text-white">
                Clubes y <span className="font-editorial text-[#c8ceff]">equipos</span>
              </h1>
              <p className="text-sm text-zinc-400 max-w-lg">
                Clubes intercarreras unificados por nombre con acceso directo a cada rama y plantel.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-6 border-t md:border-t-0 md:border-l border-white/[0.08] pt-5 md:pt-0 md:pl-8">
              <div>
                <p className="text-xs text-zinc-500">Clubes</p>
                <p className="text-3xl font-light tabular-nums text-white mt-0.5">
                  {filteredClubs.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Multirrama</p>
                <p className="text-3xl font-light tabular-nums text-[#a5b0ff] mt-0.5">
                  {multiDisciplineClubCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Planteles</p>
                <p className="text-3xl font-light tabular-nums text-white mt-0.5">
                  {state.teams.length}
                </p>
              </div>
            </div>
          </div>

          {/* Discipline Switcher */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-white/[0.07] pt-6">
            <button
              type="button"
              onClick={() => {
                setShowAllDisciplines(true);
                setGroupFilter('ALL');
              }}
              className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                showAllDisciplines
                  ? 'bg-white text-[#050507]'
                  : 'bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white'
              }`}
            >
              Todos ({allUnifiedClubs.length})
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
                  className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#707ef9] text-white'
                      : 'bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white'
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
        <div className="rounded-2xl bg-[#0c0c10] border border-white/[0.08] p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Buscar club, disciplina, sigla o carrera..."
              aria-label="Buscar equipos y clubes"
              className="w-full rounded-xl pl-10 pr-3 py-2 text-sm bg-[#111117] border border-white/[0.1] text-zinc-100 placeholder:text-zinc-500 focus:border-[#707ef9] focus:outline-none transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {availableGroups.length > 1 && (
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="px-3.5 py-2 rounded-xl text-xs bg-[#111117] border border-white/[0.1] text-zinc-200 focus:border-[#707ef9] focus:outline-none"
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
            <span className="text-xs text-zinc-500 tabular-nums">
              {showAllDisciplines
                ? `${filteredClubs.length} clubes`
                : `${activeDisciplineMeta.nombreCorto} · ${filteredClubs.length}`}
            </span>
          </div>
        </div>

        {filteredClubs.length === 0 ? (
          <div className="rounded-3xl bg-[#0c0c10] border border-white/[0.08] p-14 text-center space-y-2.5">
            <Shield className="w-9 h-9 text-zinc-700 mx-auto" />
            <h2 className="text-lg font-medium text-white">Sin resultados</h2>
            <p className="text-sm text-zinc-500 max-w-sm mx-auto">
              Ajusta tu búsqueda o cambia de disciplina para explorar los planteles.
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
                  className="group rounded-3xl bg-[#0c0c10] border border-white/[0.08] hover:border-white/[0.2] transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between overflow-hidden"
                >
                  <div className="p-5 sm:p-6 space-y-4">
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
                        surface="dark"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-[#a5b0ff] font-medium truncate">
                            {club.sigla}
                            {!isMulti
                              ? ` · ${targetSquad.groupName}`
                              : ` · ${club.disciplines.length} ramas`}
                          </span>
                          {club.anioFundacion && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 tabular-nums shrink-0">
                              <Calendar className="w-3 h-3" />
                              {club.anioFundacion}
                            </span>
                          )}
                        </div>
                        <h2 className="text-xl font-medium tracking-[-0.02em] text-white group-hover:text-[#c8ceff] transition-colors leading-snug mt-0.5 truncate">
                          {club.displayName}
                        </h2>
                        <p className="text-xs text-zinc-500 truncate mt-0.5">
                          {club.careers.join(' · ')}
                        </p>
                      </div>
                    </button>

                    <div className="border-t border-white/[0.06] pt-3.5 space-y-2">
                      <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                        <Layers className="w-3 h-3 text-[#9aa5ff]" />
                        <span>{isMulti ? `Ramas (${club.teams.length})` : 'Disciplina'}</span>
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
                              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
                                isCurrentScope
                                  ? 'bg-white text-[#050507] border-white'
                                  : 'bg-white/[0.04] text-zinc-300 border-white/[0.09] hover:border-[#707ef9] hover:text-white'
                              }`}
                              title={`Abrir ficha de ${sq.nombre} (${sqDisc.nombre})`}
                            >
                              {sqDisc.nombreCorto}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {club.logrosAnteriores && (
                      <div className="border-t border-white/[0.06] pt-3">
                        <div className="flex items-start gap-2 text-xs text-zinc-400">
                          <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <p className="line-clamp-2">{club.logrosAnteriores}</p>
                        </div>
                      </div>
                    )}

                    {showAllDisciplines && isMulti ? (
                      <div className="grid grid-cols-4 gap-2 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                        <div>
                          <p className="text-[10px] text-zinc-500">Ramas</p>
                          <p className="text-base font-medium text-[#a5b0ff] tabular-nums mt-0.5">
                            {club.disciplines.length}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500">Plantel</p>
                          <p className="text-base font-medium text-white tabular-nums mt-0.5">
                            {cardRosterCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500">PJ</p>
                          <p className="text-base font-medium text-white tabular-nums mt-0.5">
                            {club.totalMatchesPlayed}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500">PG</p>
                          <p className="text-base font-medium text-emerald-400 tabular-nums mt-0.5">
                            {club.totalWins}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                        <div>
                          <p className="text-[10px] text-zinc-500">Plantel</p>
                          <p className="text-base font-medium text-white tabular-nums mt-0.5">
                            {cardRosterCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500">PJ</p>
                          <p className="text-base font-medium text-white tabular-nums mt-0.5">
                            {singleStats.pj}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500">PG</p>
                          <p className="text-base font-medium text-emerald-400 tabular-nums mt-0.5">
                            {singleStats.pg}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500">PTS</p>
                          <p className="text-base font-medium text-[#a5b0ff] tabular-nums mt-0.5">
                            {singleStats.puntos}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenTeamProfile(targetSquad)}
                    className="w-full px-6 py-3.5 border-t border-white/[0.07] bg-white/[0.02] flex items-center justify-between text-xs font-medium text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#9aa5ff]" />
                      {isMulti ? 'Ver club y ramas' : 'Ver ficha y plantel'}
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
