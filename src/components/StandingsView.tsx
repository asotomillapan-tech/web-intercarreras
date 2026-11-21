import { useMemo, useState } from 'react';
import { Award, Lock, Star, Trophy } from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
import { canVoteMatchMvp, shouldRevealPublicMatchData } from '../domain/rbacEngine';
import { computeStandings, generatePlayoffBracket } from '../domain/tournamentEngine';
import type {
  AppUserProfile,
  DisciplineId,
  Match,
  StandingsRow,
  TournamentState,
} from '../types/tournament';

interface StandingsViewProps {
  state: TournamentState;
  currentUser: AppUserProfile | null;
  selectedDiscipline: DisciplineId;
  onSelectDiscipline: (id: DisciplineId) => void;
  onOpenMatchModal: (match: Match) => void;
  onToggleFavoriteTeam: (teamId: string) => void;
  onOpenAuth: () => void;
}

export function StandingsView({
  state,
  currentUser,
  selectedDiscipline,
  onSelectDiscipline,
  onOpenMatchModal,
  onToggleFavoriteTeam,
  onOpenAuth,
}: StandingsViewProps) {
  const [subTab, setSubTab] = useState<'grupos' | 'playoffs'>('grupos');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');

  const meta = DISCIPLINE_MAP[selectedDiscipline];
  const config = state.configs[selectedDiscipline];
  const teamMap = useMemo(() => new Map(state.teams.map((t) => [t.id, t])), [state.teams]);

  const disciplineTeams = useMemo(
    () => state.teams.filter((t) => t.disciplineId === selectedDiscipline),
    [state.teams, selectedDiscipline]
  );

  const disciplineMatches = useMemo(
    () => state.matches.filter((m) => m.disciplineId === selectedDiscipline),
    [state.matches, selectedDiscipline]
  );

  const groups = useMemo(
    () => Array.from(new Set(disciplineTeams.map((t) => t.groupName))).sort(),
    [disciplineTeams]
  );

  const standingsByGroup = useMemo(() => {
    const map: Record<string, StandingsRow[]> = {};
    for (const group of groups) {
      const gTeams = disciplineTeams.filter((t) => t.groupName === group);
      const gMatches = disciplineMatches.filter((m) => m.groupName === group);
      map[group] = computeStandings(meta.sportType, gTeams, gMatches);
    }
    return map;
  }, [groups, disciplineTeams, disciplineMatches, meta.sportType]);

  const playoffMatchups = useMemo(
    () =>
      generatePlayoffBracket(
        standingsByGroup,
        config.clasificadosPorGrupo,
        config.formatoPlayoff
      ),
    [standingsByGroup, config.clasificadosPorGrupo, config.formatoPlayoff]
  );

  const displayedGroups =
    selectedGroup === 'ALL' || !groups.includes(selectedGroup) ? groups : [selectedGroup];

  const isVolley = meta.sportType === 'voleibol';
  const isBasket = meta.sportType === 'basquetbol' || meta.sportType === 'basquetbol3x3';

  return (
    <div className="bg-white min-h-[75vh]">
      {/* Carbon Sub-header */}
      <div className="bg-[#0d0d0d] text-white border-b border-white/10">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
            Tablas oficiales · Temporada {state.temporada}
          </p>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mt-2">
            <div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight">
                {meta.nombre}
              </h1>
              <p className="text-sm text-neutral-400 mt-2">
                {disciplineTeams.length} equipos distribuidos equitativamente en {groups.length}{' '}
                grupos · Clasifican {config.clasificadosPorGrupo} por grupo a llave de{' '}
                {config.formatoPlayoff} · Sede: {meta.sedePrincipal}
              </p>
            </div>

            <div className="flex items-center gap-1 bg-white/5 p-1 self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setSubTab('grupos')}
                className={`px-4 py-2 text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap ${
                  subTab === 'grupos'
                    ? 'bg-[#707ef9] text-white'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                Fase de Grupos
              </button>
              <button
                type="button"
                onClick={() => setSubTab('playoffs')}
                className={`px-4 py-2 text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap ${
                  subTab === 'playoffs'
                    ? 'bg-[#707ef9] text-white'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                Llave de Playoffs (Top {config.formatoPlayoff})
              </button>
            </div>
          </div>

          {/* Discipline Switcher Bar */}
          <div className="flex flex-wrap items-center gap-1.5 pt-6 mt-6 border-t border-white/10">
            {DISCIPLINES.map((d) => {
              const active = d.id === selectedDiscipline;
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    onSelectDiscipline(d.id);
                    setSelectedGroup('ALL');
                  }}
                  className={`px-3.5 py-2 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-[#0d0d0d] font-bold'
                      : 'bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {d.nombreCorto}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {subTab === 'grupos' ? (
          <div className="space-y-10">
            {/* Group Filter Tabs & Legend */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedGroup('ALL')}
                  className={`px-3 py-1.5 text-xs font-medium cursor-pointer ${
                    selectedGroup === 'ALL'
                      ? 'bg-[#0d0d0d] text-white'
                      : 'bg-[#f5f6f8] text-neutral-700 hover:text-[#0d0d0d]'
                  }`}
                >
                  Todos los grupos ({groups.length})
                </button>
                {groups.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSelectedGroup(g)}
                    className={`px-3 py-1.5 text-xs font-medium cursor-pointer ${
                      selectedGroup === g
                        ? 'bg-[#707ef9] text-white'
                        : 'bg-[#f5f6f8] text-neutral-700 hover:text-[#0d0d0d]'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>

              <div className="text-xs text-neutral-600 flex items-center gap-4">
                <span>
                  <strong className="text-[#707ef9]">Pos. 1–{config.clasificadosPorGrupo}:</strong>{' '}
                  Zona de clasificación a Playoffs
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {isVolley
                    ? 'Pts: 3 (2-0), 2 (2-1), 1 (1-2)'
                    : isBasket
                    ? 'Pts: 2 victoria, 1 derrota'
                    : 'Pts: 3 victoria, 1 empate'}
                </span>
              </div>
            </div>

            {displayedGroups.length === 0 && (
              <div className="border border-neutral-200 bg-[#f5f6f8] p-12 text-center space-y-3">
                <p className="font-display text-2xl font-bold uppercase text-[#0d0d0d]">
                  Sin equipos inscritos en {meta.nombre}
                </p>
                <p className="text-sm text-neutral-600 max-w-xl mx-auto">
                  Cupos habilitados para la temporada {state.temporada}:{' '}
                  <strong>{config.maxCupos} equipos</strong> distribuidos en{' '}
                  <strong>{config.numGrupos} grupos equitativos</strong>. Las tablas se activarán
                  automáticamente a medida que se inscriban las nóminas oficiales.
                </p>
              </div>
            )}

            {displayedGroups.map((group) => {
              const rows = standingsByGroup[group] ?? [];
              const gMatches = disciplineMatches.filter((m) => m.groupName === group).slice(0, 6);

              return (
                <section key={group} className="space-y-4">
                  <div className="flex items-baseline justify-between border-b border-neutral-200 pb-2">
                    <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                      {group}
                    </h2>
                    <span className="text-xs text-neutral-500 tabular-nums">
                      {rows.length} equipos · Todos contra todos
                    </span>
                  </div>

                  <div className="border border-neutral-200 overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-[#f5f6f8] border-b border-neutral-200 text-xs text-neutral-500 uppercase">
                          <th className="py-3 px-3 w-12 font-medium">Pos</th>
                          <th className="py-3 px-3 font-medium">Equipo</th>
                          <th className="py-3 px-3 hidden md:table-cell font-medium">Carrera</th>
                          <th className="py-3 px-3 text-right font-medium tabular-nums">PJ</th>
                          <th className="py-3 px-3 text-right font-medium tabular-nums">PG</th>
                          {!isVolley && !isBasket && (
                            <th className="py-3 px-3 text-right font-medium tabular-nums">PE</th>
                          )}
                          <th className="py-3 px-3 text-right font-medium tabular-nums">PP</th>
                          <th className="py-3 px-3 text-right font-medium tabular-nums">
                            {isVolley ? 'SF' : isBasket ? 'PF' : 'GF'}
                          </th>
                          <th className="py-3 px-3 text-right font-medium tabular-nums">
                            {isVolley ? 'SC' : isBasket ? 'PC' : 'GC'}
                          </th>
                          <th className="py-3 px-3 text-right font-medium tabular-nums">DIF</th>
                          <th className="py-3 px-3 text-right font-bold text-[#0d0d0d] tabular-nums">PTS</th>
                          <th className="py-3 px-3 text-right hidden sm:table-cell font-medium">Estado / Racha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {rows.map((row, idx) => {
                          const qualifies = idx < config.clasificadosPorGrupo;
                          return (
                            <tr
                              key={row.teamId}
                              className={qualifies ? 'bg-[#707ef9]/[0.03] hover:bg-[#707ef9]/[0.06]' : 'hover:bg-[#f9fafb]'}
                            >
                              <td className="py-3 px-3 tabular-nums font-bold">
                                <span className={qualifies ? 'text-[#707ef9]' : 'text-neutral-500'}>
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-medium text-[#0d0d0d]">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      currentUser ? onToggleFavoriteTeam(row.teamId) : onOpenAuth()
                                    }
                                    aria-label={
                                      currentUser?.favoriteTeamIds.includes(row.teamId)
                                        ? `Quitar ${row.teamName} de favoritos`
                                        : `Guardar ${row.teamName} en favoritos`
                                    }
                                    className="text-neutral-400 hover:text-[#707ef9] cursor-pointer shrink-0"
                                  >
                                    <Star
                                      className={`w-3.5 h-3.5 ${
                                        currentUser?.favoriteTeamIds.includes(row.teamId)
                                          ? 'fill-[#707ef9] text-[#707ef9]'
                                          : ''
                                      }`}
                                    />
                                  </button>
                                  <div>
                                    <span>{row.teamName}</span>
                                    <span className="md:hidden block text-xs font-normal text-neutral-500">
                                      {row.carrera}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-3 hidden md:table-cell text-xs text-neutral-500">
                                {row.carrera}
                              </td>
                              <td className="py-3 px-3 text-right tabular-nums text-neutral-700">{row.pj}</td>
                              <td className="py-3 px-3 text-right tabular-nums text-neutral-700">{row.pg}</td>
                              {!isVolley && !isBasket && (
                                <td className="py-3 px-3 text-right tabular-nums text-neutral-700">{row.pe}</td>
                              )}
                              <td className="py-3 px-3 text-right tabular-nums text-neutral-700">{row.pp}</td>
                              <td className="py-3 px-3 text-right tabular-nums text-neutral-700">
                                {isVolley ? row.setsFavor : row.favor}
                              </td>
                              <td className="py-3 px-3 text-right tabular-nums text-neutral-700">
                                {isVolley ? row.setsContra : row.contra}
                              </td>
                              <td className="py-3 px-3 text-right tabular-nums text-neutral-700">
                                {row.diferencia > 0 ? `+${row.diferencia}` : row.diferencia}
                              </td>
                              <td className="py-3 px-3 text-right tabular-nums font-bold text-[#0d0d0d]">
                                {row.puntos}
                              </td>
                              <td className="py-3 px-3 text-right hidden sm:table-cell text-xs">
                                <span className="font-mono tracking-widest text-neutral-600">
                                  {row.racha.length > 0 ? row.racha.join(' ') : '—'}
                                </span>
                                {qualifies && (
                                  <span className="ml-2 text-[#707ef9] font-medium">Clasifica</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Recent Group Fixtures Strip */}
                  {gMatches.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                      {gMatches.map((m) => {
                        const reveal = shouldRevealPublicMatchData(m);
                        const votingOpen = canVoteMatchMvp(m);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => onOpenMatchModal(m)}
                            className="text-left border border-neutral-200 p-3.5 hover:border-[#707ef9] transition-colors bg-white cursor-pointer"
                          >
                            <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-2">
                              <span className="tabular-nums">
                                {m.fecha} · {m.hora}
                              </span>
                              <span
                                className={
                                  votingOpen
                                    ? 'text-[#707ef9] font-bold inline-flex items-center gap-1'
                                    : ''
                                }
                              >
                                {votingOpen ? (
                                  <>
                                    <Award className="w-3 h-3" />
                                    <span>Votar MVP</span>
                                  </>
                                ) : reveal ? (
                                  'Final'
                                ) : (
                                  'Programado'
                                )}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs font-medium text-[#0d0d0d]">
                              <span className="truncate pr-2">
                                {teamMap.get(m.homeTeamId)?.nombre}
                              </span>
                              <span className="tabular-nums font-bold">
                                {reveal ? m.homeScore : votingOpen ? <Lock className="w-3 h-3 text-neutral-400" /> : '—'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs font-medium text-[#0d0d0d] mt-1">
                              <span className="truncate pr-2">
                                {teamMap.get(m.awayTeamId)?.nombre}
                              </span>
                              <span className="tabular-nums font-bold">
                                {reveal ? m.awayScore : votingOpen ? <Lock className="w-3 h-3 text-neutral-400" /> : '—'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          /* Dynamic Playoff Bracket View */
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4">
              <div>
                <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                  Proyección de Llave · {playoffMatchups[0]?.round ?? 'Playoffs'}
                </h2>
                <p className="text-sm text-neutral-600 mt-1">
                  Cruce automático según posiciones actuales de Fase de Grupos (configurable desde el
                  Panel Oficial según inscripciones de cada temporada).
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <Trophy className="w-4 h-4 text-[#707ef9]" />
                <span>Clasifican {config.clasificadosPorGrupo} por grupo · Cuadro de {config.formatoPlayoff}</span>
              </div>
            </div>

            {playoffMatchups.length === 0 ? (
              <div className="border border-neutral-200 bg-[#f5f6f8] p-12 text-center space-y-2">
                <p className="font-display text-xl font-bold uppercase text-[#0d0d0d]">
                  Llave de Playoffs pendiente de fase de grupos
                </p>
                <p className="text-xs text-neutral-600 max-w-md mx-auto">
                  Los cruces de eliminación directa (Top {config.formatoPlayoff}) se generarán
                  automáticamente en cuanto existan equipos inscritos en los grupos.
                </p>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {playoffMatchups.map((matchup) => (
                <div
                  key={matchup.id}
                  className="border border-neutral-200 bg-white flex flex-col justify-between"
                >
                  <div className="bg-[#f5f6f8] px-4 py-2 border-b border-neutral-200 flex items-center justify-between text-xs text-neutral-500">
                    <span className="font-medium text-[#0d0d0d]">
                      {matchup.round} · Llave {matchup.slot}
                    </span>
                    <span>Eliminación directa</span>
                  </div>
                  <div className="divide-y divide-neutral-200">
                    <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                      <span className="font-medium text-sm text-[#0d0d0d] truncate">
                        {matchup.homeTeamName}
                      </span>
                      <span className="text-xs font-mono text-[#707ef9] shrink-0">
                        {matchup.homeSeed}
                      </span>
                    </div>
                    <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                      <span className="font-medium text-sm text-[#0d0d0d] truncate">
                        {matchup.awayTeamName}
                      </span>
                      <span className="text-xs font-mono text-neutral-500 shrink-0">
                        {matchup.awaySeed}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
