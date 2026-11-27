import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Award, Lock, Medal, Star, Trophy } from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
import {
  filterMatchesByOrg,
  groupMatchesByOrg,
  sortMatchesChronologically,
  type MatchGroupByMode,
  type MatchSortOrder,
} from '../domain/matchFilterEngine';
import { canVoteMatchMvp, shouldRevealPublicMatchData } from '../domain/rbacEngine';
import { buildFullPlayoffTree, computeStandings } from '../domain/tournamentEngine';
import type {
  AppUserProfile,
  DisciplineId,
  Match,
  MatchPhase,
  PlayoffBracketSlot,
  StandingsRow,
  TournamentState,
} from '../types/tournament';
import { MatchFilterBar } from './MatchFilterBar';
import { SectionKicker } from './MotionPrimitives';

interface StandingsViewProps {
  state: TournamentState;
  currentUser: AppUserProfile | null;
  selectedDiscipline: DisciplineId;
  onSelectDiscipline: (id: DisciplineId) => void;
  onInspectTeam: (teamId: string) => void;
  onOpenMatchModal: (match: Match) => void;
  onToggleFavoriteTeam: (teamId: string) => void;
  onOpenAuth: () => void;
}

function formatShortMatchDate(fecha: string): string {
  const trimmed = (fecha || '').trim();
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return `${iso[3].padStart(2, '0')}/${iso[2].padStart(2, '0')}`;
  }
  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}`;
  }
  return trimmed || 'Por confirmar';
}

export function StandingsView({
  state,
  currentUser,
  selectedDiscipline,
  onSelectDiscipline,
  onInspectTeam,
  onOpenMatchModal,
  onToggleFavoriteTeam,
  onOpenAuth,
}: StandingsViewProps) {
  const [subTab, setSubTab] = useState<'grupos' | 'playoffs' | 'partidos'>('grupos');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [matchDisciplineFilter, setMatchDisciplineFilter] = useState<'ALL' | DisciplineId>(
    selectedDiscipline
  );
  const [matchGroupFilter, setMatchGroupFilter] = useState<'ALL' | string>('ALL');
  const [matchStageFilter, setMatchStageFilter] = useState<'ALL' | MatchPhase>('ALL');
  const [matchGroupBy, setMatchGroupBy] = useState<MatchGroupByMode>('fase');
  const [matchSortOrder, setMatchSortOrder] = useState<MatchSortOrder>('newest');

  useEffect(() => {
    setMatchDisciplineFilter(selectedDiscipline);
    setMatchGroupFilter('ALL');
    setMatchStageFilter('ALL');
  }, [selectedDiscipline]);

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

  const fullBracket = useMemo(
    () =>
      buildFullPlayoffTree({
        standingsByGroup,
        clasificadosPorGrupo: config.clasificadosPorGrupo,
        formatoPlayoff: config.formatoPlayoff,
        incluyeTercerLugar: config.incluyeTercerLugar !== false,
        playoffsIdaYVuelta: Boolean(config.playoffsIdaYVuelta),
        disciplineMatches,
        teamMap,
      }),
    [
      standingsByGroup,
      config.clasificadosPorGrupo,
      config.formatoPlayoff,
      config.incluyeTercerLugar,
      config.playoffsIdaYVuelta,
      disciplineMatches,
      teamMap,
    ]
  );

  const displayedGroups =
    selectedGroup === 'ALL' || !groups.includes(selectedGroup) ? groups : [selectedGroup];

  const organizedDisciplineMatches = useMemo(() => {
    const filtered = sortMatchesChronologically(
      filterMatchesByOrg(state.matches, {
        disciplineId: matchDisciplineFilter,
        groupName: matchGroupFilter,
        fase: matchStageFilter,
      }),
      matchSortOrder
    );
    return groupMatchesByOrg(
      filtered,
      matchGroupBy,
      Object.fromEntries(DISCIPLINES.map((d) => [d.id, d.nombre])) as Record<DisciplineId, string>,
      DISCIPLINES.map((d) => d.id)
    );
  }, [
    state.matches,
    matchDisciplineFilter,
    matchGroupFilter,
    matchStageFilter,
    matchGroupBy,
    matchSortOrder,
  ]);

  const totalFilteredMatches = useMemo(
    () => organizedDisciplineMatches.reduce((acc, sec) => acc + sec.matches.length, 0),
    [organizedDisciplineMatches]
  );

  const isVolley = meta.sportType === 'voleibol';
  const isBasket = meta.sportType === 'basquetbol' || meta.sportType === 'basquetbol3x3';

  return (
    <div className="bg-[#050507] text-zinc-100 min-h-[75vh] pb-20">
      {/* Obsidian Header */}
      <div className="border-b border-white/[0.06]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <SectionKicker index="01" label={`Posiciones · ${state.temporada}`} />
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mt-3">
            <div>
              <h1 className="text-4xl sm:text-5xl font-medium tracking-[-0.035em] text-white">
                {meta.nombre.includes(' — ') ? (
                  <>
                    {meta.nombre.split(' — ')[0]}{' '}
                    <span className="font-editorial text-[#c8ceff] font-normal">
                      {meta.nombre.split(' — ')[1]}
                    </span>
                  </>
                ) : (
                  <>
                    {meta.nombre.split(' ').slice(0, -1).join(' ')}{' '}
                    <span className="font-editorial text-[#c8ceff] font-normal">
                      {meta.nombre.split(' ').slice(-1)[0]}
                    </span>
                  </>
                )}
              </h1>
              <p className="text-sm text-zinc-400 mt-2.5">
                {disciplineTeams.length} equipos · {groups.length} grupos · Top {config.formatoPlayoff}
                {config.playoffsIdaYVuelta ? ' (Ida y Vuelta)' : ''} · {meta.sedePrincipal}
              </p>
            </div>

            <div className="inline-flex flex-wrap lg:flex-nowrap items-center gap-1 rounded-full bg-white/[0.04] border border-white/[0.08] p-1 self-start lg:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setSubTab('grupos')}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  subTab === 'grupos'
                    ? 'bg-white text-[#050507]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Grupos
              </button>
              <button
                type="button"
                onClick={() => setSubTab('playoffs')}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  subTab === 'playoffs'
                    ? 'bg-white text-[#050507]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Playoffs (Top {config.formatoPlayoff})
              </button>
              <button
                type="button"
                onClick={() => setSubTab('partidos')}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  subTab === 'partidos'
                    ? 'bg-white text-[#050507]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Partidos ({disciplineMatches.length})
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-6 mt-7 border-t border-white/[0.07]">
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
                    setMatchGroupFilter('ALL');
                    setMatchStageFilter('ALL');
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
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
      </div>

      {/* Main Content */}
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {subTab === 'grupos' ? (
          <div className="space-y-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedGroup('ALL')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                    selectedGroup === 'ALL'
                      ? 'bg-white text-[#050507]'
                      : 'bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white'
                  }`}
                >
                  Todos ({groups.length})
                </button>
                {groups.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSelectedGroup(g)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                      selectedGroup === g
                        ? 'bg-[#707ef9] text-white'
                        : 'bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>

              <div className="text-xs text-zinc-500 flex flex-wrap items-center gap-3">
                <span>
                  <strong className="text-[#a5b0ff] font-medium">
                    Top {config.clasificadosPorGrupo}:
                  </strong>{' '}
                  clasifican
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {isVolley
                    ? '3 (2-0) · 2 (2-1) · 1 (1-2)'
                    : isBasket
                    ? '2 victoria · 1 derrota'
                    : '3 victoria · 1 empate'}
                </span>
              </div>
            </div>

            {displayedGroups.length === 0 && (
              <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-12 text-center space-y-2.5">
                <p className="text-xl font-medium text-white">Sin equipos en {meta.nombre}</p>
                <p className="text-sm text-zinc-500 max-w-md mx-auto">
                  {config.maxCupos} cupos habilitados en {config.numGrupos} grupos.
                </p>
              </div>
            )}

            {displayedGroups.map((group) => {
              const rows = standingsByGroup[group] ?? [];
              const gMatches = sortMatchesChronologically(
                disciplineMatches.filter((m) => m.groupName === group),
                'newest'
              ).slice(0, 6);

              return (
                <section key={group} className="space-y-4">
                  <div className="flex items-baseline justify-between border-b border-white/[0.07] pb-2.5">
                    <h2 className="text-2xl font-medium tracking-[-0.02em] text-white">{group}</h2>
                    <span className="text-xs text-zinc-500 tabular-nums">{rows.length} equipos</span>
                  </div>

                  <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.07] text-[11px] text-zinc-500">
                          <th className="py-3 px-4 w-12 font-medium">#</th>
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
                          <th className="py-3 px-3 text-right font-medium text-zinc-200 tabular-nums">
                            PTS
                          </th>
                          <th className="py-3 px-4 text-right hidden sm:table-cell font-medium">
                            Racha
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {rows.map((row, idx) => {
                          const qualifies = idx < config.clasificadosPorGrupo;
                          return (
                            <tr
                              key={row.teamId}
                              className={
                                qualifies
                                  ? 'bg-[#707ef9]/[0.06] hover:bg-[#707ef9]/[0.1]'
                                  : 'hover:bg-white/[0.03]'
                              }
                            >
                              <td className="py-3.5 px-4 tabular-nums font-medium">
                                <span className={qualifies ? 'text-[#a5b0ff]' : 'text-zinc-500'}>
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="py-3.5 px-3 font-medium text-zinc-100">
                                <div className="flex items-center gap-2.5">
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
                                    className="text-zinc-600 hover:text-[#9aa5ff] cursor-pointer shrink-0 transition-colors"
                                  >
                                    <Star
                                      className={`w-3.5 h-3.5 ${
                                        currentUser?.favoriteTeamIds.includes(row.teamId)
                                          ? 'fill-[#707ef9] text-[#707ef9]'
                                          : ''
                                      }`}
                                    />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onInspectTeam(row.teamId)}
                                    className="text-left group cursor-pointer"
                                  >
                                    <span className="group-hover:text-[#c8ceff] transition-colors">
                                      {row.teamName}
                                    </span>
                                    <span className="md:hidden block text-xs font-normal text-zinc-500">
                                      {row.carrera}
                                    </span>
                                  </button>
                                </div>
                              </td>
                              <td className="py-3.5 px-3 hidden md:table-cell text-xs text-zinc-500">
                                {row.carrera}
                              </td>
                              <td className="py-3.5 px-3 text-right tabular-nums text-zinc-400">
                                {row.pj}
                              </td>
                              <td className="py-3.5 px-3 text-right tabular-nums text-zinc-400">
                                {row.pg}
                              </td>
                              {!isVolley && !isBasket && (
                                <td className="py-3.5 px-3 text-right tabular-nums text-zinc-400">
                                  {row.pe}
                                </td>
                              )}
                              <td className="py-3.5 px-3 text-right tabular-nums text-zinc-400">
                                {row.pp}
                              </td>
                              <td className="py-3.5 px-3 text-right tabular-nums text-zinc-400">
                                {isVolley ? row.setsFavor : row.favor}
                              </td>
                              <td className="py-3.5 px-3 text-right tabular-nums text-zinc-400">
                                {isVolley ? row.setsContra : row.contra}
                              </td>
                              <td className="py-3.5 px-3 text-right tabular-nums text-zinc-300">
                                {row.diferencia > 0 ? `+${row.diferencia}` : row.diferencia}
                              </td>
                              <td className="py-3.5 px-3 text-right tabular-nums font-semibold text-white">
                                {row.puntos}
                              </td>
                              <td className="py-3.5 px-4 text-right hidden sm:table-cell text-xs">
                                <span className="font-mono tracking-widest text-zinc-500">
                                  {row.racha.length > 0 ? row.racha.join(' ') : '—'}
                                </span>
                                {qualifies && (
                                  <span className="ml-2 text-[#a5b0ff] font-medium">Q</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

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
                            className="text-left rounded-2xl border border-white/[0.08] bg-[#0c0c10] p-4 hover:border-white/[0.2] transition-colors cursor-pointer"
                          >
                            <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-2 gap-2">
                              <span className="tabular-nums truncate">
                                {m.fecha} · {m.hora}
                              </span>
                              <span
                                className={
                                  votingOpen
                                    ? 'text-[#a5b0ff] font-medium inline-flex items-center gap-1'
                                    : ''
                                }
                              >
                                {votingOpen ? (
                                  <>
                                    <Award className="w-3 h-3" />
                                    <span>MVP</span>
                                  </>
                                ) : reveal ? (
                                  'Final'
                                ) : (
                                  'Programado'
                                )}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs font-medium text-zinc-100">
                              <span className="truncate pr-2">
                                {teamMap.get(m.homeTeamId)?.nombre}
                              </span>
                              <span className="tabular-nums font-semibold">
                                {reveal ? (
                                  m.homeScore
                                ) : votingOpen ? (
                                  <Lock className="w-3 h-3 text-zinc-500" />
                                ) : (
                                  '—'
                                )}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs font-medium text-zinc-100 mt-1">
                              <span className="truncate pr-2">
                                {teamMap.get(m.awayTeamId)?.nombre}
                              </span>
                              <span className="tabular-nums font-semibold">
                                {reveal ? (
                                  m.awayScore
                                ) : votingOpen ? (
                                  <Lock className="w-3 h-3 text-zinc-500" />
                                ) : (
                                  '—'
                                )}
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
        ) : subTab === 'partidos' ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/[0.07] pb-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-medium tracking-[-0.025em] text-white">
                  {matchDisciplineFilter === 'ALL'
                    ? 'Todos los partidos'
                    : `Partidos · ${meta.nombreCorto}`}
                </h2>
              </div>
              <span className="text-xs text-zinc-500 tabular-nums">
                {totalFilteredMatches} de{' '}
                {matchDisciplineFilter === 'ALL' ? state.matches.length : disciplineMatches.length}{' '}
                encuentros
              </span>
            </div>

            <MatchFilterBar
              idPrefix="standings-matches"
              matches={state.matches}
              disciplineFilter={matchDisciplineFilter}
              onDisciplineChange={(val) => {
                setMatchDisciplineFilter(val);
                setMatchGroupFilter('ALL');
                if (val !== 'ALL') {
                  onSelectDiscipline(val);
                }
              }}
              groupFilter={matchGroupFilter}
              onGroupChange={setMatchGroupFilter}
              stageFilter={matchStageFilter}
              onStageChange={setMatchStageFilter}
              sortOrder={matchSortOrder}
              onSortOrderChange={setMatchSortOrder}
              groupBy={matchGroupBy}
              onGroupByChange={setMatchGroupBy}
              filteredCount={totalFilteredMatches}
              totalCount={state.matches.length}
              onReset={() => {
                setMatchDisciplineFilter(selectedDiscipline);
                setMatchGroupFilter('ALL');
                setMatchStageFilter('ALL');
                setMatchGroupBy('fase');
                setMatchSortOrder('newest');
              }}
            />

            {organizedDisciplineMatches.length === 0 ? (
              <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-12 text-center space-y-2">
                <p className="text-lg font-medium text-white">Sin encuentros</p>
                <p className="text-xs text-zinc-500">Prueba ajustando el grupo o la fase.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {organizedDisciplineMatches.map((section) => (
                  <section key={section.key} className="space-y-3">
                    {matchGroupBy !== 'none' && (
                      <div className="flex items-center justify-between border-b border-white/[0.07] pb-2">
                        <h3 className="text-lg font-medium text-white">{section.label}</h3>
                        <span className="text-xs text-zinc-500 tabular-nums">
                          {section.matches.length}{' '}
                          {section.matches.length === 1 ? 'partido' : 'partidos'}
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {section.matches.map((m) => {
                        const reveal = shouldRevealPublicMatchData(m);
                        const votingOpen = canVoteMatchMvp(m);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => onOpenMatchModal(m)}
                            className="text-left rounded-2xl border border-white/[0.08] bg-[#0c0c10] p-4 hover:border-white/[0.2] transition-colors cursor-pointer space-y-3"
                          >
                            <div className="flex items-center justify-between text-[11px] text-zinc-500 gap-2">
                              <span className="truncate text-zinc-300">
                                {m.fase}
                                {m.groupName && m.groupName !== '-' ? ` · ${m.groupName}` : ''}
                                {m.fase !== 'Grupos' &&
                                (m.playoffLeg === 'IDA' || m.playoffLeg === 'VUELTA')
                                  ? ` · ${m.playoffLeg}`
                                  : ''}
                              </span>
                              <span
                                className={
                                  votingOpen
                                    ? 'text-[#a5b0ff] font-medium inline-flex items-center gap-1 shrink-0'
                                    : 'shrink-0'
                                }
                              >
                                {votingOpen ? (
                                  <>
                                    <Award className="w-3 h-3" />
                                    <span>MVP</span>
                                  </>
                                ) : reveal ? (
                                  'Final'
                                ) : (
                                  'Programado'
                                )}
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-sm font-medium text-white">
                                <span className="truncate pr-2">
                                  {teamMap.get(m.homeTeamId)?.nombre ?? m.homeTeamId}
                                </span>
                                <span className="tabular-nums font-semibold">
                                  {reveal ? (
                                    m.homeScore
                                  ) : votingOpen ? (
                                    <Lock className="w-3 h-3 text-zinc-500" />
                                  ) : (
                                    '—'
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm font-medium text-white">
                                <span className="truncate pr-2">
                                  {teamMap.get(m.awayTeamId)?.nombre ?? m.awayTeamId}
                                </span>
                                <span className="tabular-nums font-semibold">
                                  {reveal ? (
                                    m.awayScore
                                  ) : votingOpen ? (
                                    <Lock className="w-3 h-3 text-zinc-500" />
                                  ) : (
                                    '—'
                                  )}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-2.5 border-t border-white/[0.06] tabular-nums">
                              <span>
                                {formatShortMatchDate(m.fecha)} · {m.hora}
                              </span>
                              <span className="truncate max-w-[140px]">{m.cancha}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Playoff Bracket Tree */
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-medium tracking-[-0.025em] text-white">
                  Eliminación <span className="font-editorial text-[#c8ceff]">directa</span> · Top{' '}
                  {config.formatoPlayoff}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 shrink-0">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
                  <Trophy className="w-3.5 h-3.5 text-[#9aa5ff]" />
                  <span>{config.clasificadosPorGrupo} por grupo</span>
                </span>
                {fullBracket.isTwoLegged && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#707ef9]/15 border border-[#707ef9]/30 text-[#c7ceff]">
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Ida y Vuelta</span>
                  </span>
                )}
                {fullBracket.thirdPlace && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
                    <Medal className="w-3.5 h-3.5 text-[#9aa5ff]" />
                    <span>3° Lugar</span>
                  </span>
                )}
              </div>
            </div>

            {(fullBracket.championName || fullBracket.thirdPlaceWinnerName) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fullBracket.championName && (
                  <div className="rounded-3xl bg-[#707ef9]/12 border border-[#707ef9]/35 p-6 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-[#a5b0ff] font-medium">
                        Campeón · {meta.nombreCorto}
                      </p>
                      <p className="text-2xl sm:text-3xl font-medium tracking-[-0.02em] text-white mt-1">
                        {fullBracket.championName}
                      </p>
                    </div>
                    <Trophy className="w-8 h-8 text-[#9aa5ff] shrink-0" />
                  </div>
                )}
                {fullBracket.thirdPlaceWinnerName && (
                  <div className="rounded-3xl bg-[#0c0c10] border border-white/[0.1] p-6 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-zinc-400">Tercer lugar · {meta.nombreCorto}</p>
                      <p className="text-2xl sm:text-3xl font-medium tracking-[-0.02em] text-white mt-1">
                        {fullBracket.thirdPlaceWinnerName}
                      </p>
                    </div>
                    <Medal className="w-8 h-8 text-zinc-400 shrink-0" />
                  </div>
                )}
              </div>
            )}

            {fullBracket.rounds.length === 0 ? (
              <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-12 text-center space-y-2">
                <p className="text-lg font-medium text-white">Llave pendiente de fase de grupos</p>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Los cruces Top {config.formatoPlayoff} se generarán al completarse los grupos.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto pb-4">
                <div
                  className={`grid gap-5 ${
                    fullBracket.rounds.length === 4
                      ? fullBracket.isTwoLegged
                        ? 'grid-cols-4 min-w-[1160px]'
                        : 'grid-cols-4 min-w-[1040px]'
                      : fullBracket.rounds.length === 3
                      ? fullBracket.isTwoLegged
                        ? 'grid-cols-3 min-w-[900px]'
                        : 'grid-cols-3 min-w-[780px]'
                      : fullBracket.isTwoLegged
                      ? 'grid-cols-2 min-w-[620px]'
                      : 'grid-cols-2 min-w-[540px]'
                  }`}
                >
                  {fullBracket.rounds.map((col, colIdx) => {
                    const isFinalColumn = col.round === 'Final';
                    const renderSlotCard = (slot: PlayoffBracketSlot, accentThirdPlace = false) => {
                      const isHomeWinner = slot.winnerSide === 'home';
                      const isAwayWinner = slot.winnerSide === 'away';

                      if (slot.isTwoLegged) {
                        const firstLeg = slot.firstLegMatch;
                        const secondLeg = slot.secondLegMatch;
                        const revealFirst = firstLeg ? shouldRevealPublicMatchData(firstLeg) : false;
                        const revealSecond = secondLeg ? shouldRevealPublicMatchData(secondLeg) : false;
                        const votingFirst = firstLeg ? canVoteMatchMvp(firstLeg) : false;
                        const votingSecond = secondLeg ? canVoteMatchMvp(secondLeg) : false;
                        const anyVotingOpen = votingFirst || votingSecond;
                        const hasRevealedFirst =
                          revealFirst &&
                          slot.homeFirstLegScore !== undefined &&
                          slot.awayFirstLegScore !== undefined;
                        const hasRevealedSecond =
                          revealSecond &&
                          slot.homeSecondLegScore !== undefined &&
                          slot.awaySecondLegScore !== undefined;
                        const hasAnyRevealedLeg = hasRevealedFirst || hasRevealedSecond;
                        const visibleHomeGlobal =
                          (hasRevealedFirst ? slot.homeFirstLegScore ?? 0 : 0) +
                          (hasRevealedSecond ? slot.homeSecondLegScore ?? 0 : 0);
                        const visibleAwayGlobal =
                          (hasRevealedFirst ? slot.awayFirstLegScore ?? 0 : 0) +
                          (hasRevealedSecond ? slot.awaySecondLegScore ?? 0 : 0);

                        const headerStatus = slot.isAggregateDraw
                          ? 'Empate global'
                          : hasRevealedFirst && hasRevealedSecond
                          ? 'Global final'
                          : anyVotingOpen
                          ? 'En juego'
                          : hasRevealedFirst
                          ? 'Ida jugada'
                          : 'Ida y vuelta';

                        return (
                          <div
                            key={slot.id}
                            className={`rounded-2xl border bg-[#0c0c10] overflow-hidden transition-colors ${
                              isFinalColumn
                                ? 'border-[#707ef9]/45'
                                : accentThirdPlace
                                ? 'border-white/[0.16]'
                                : 'border-white/[0.08]'
                            }`}
                          >
                            <div
                              className={`px-3.5 py-2 border-b flex items-center justify-between gap-2 text-[11px] ${
                                isFinalColumn
                                  ? 'bg-[#707ef9]/20 text-[#d4daff] border-[#707ef9]/30'
                                  : 'bg-white/[0.03] text-zinc-400 border-white/[0.07]'
                              }`}
                            >
                              <span className="font-medium truncate">
                                {accentThirdPlace
                                  ? '3° Lugar'
                                  : isFinalColumn
                                  ? 'Gran Final'
                                  : `${slot.round} · #${slot.slot}`}
                              </span>
                              <span className="tabular-nums shrink-0">{headerStatus}</span>
                            </div>

                            <div className="grid grid-cols-[minmax(0,1fr)_2rem_2rem_2.5rem] items-center gap-1 px-3 py-1.5 bg-white/[0.015] border-b border-white/[0.06] text-[10px] text-zinc-500">
                              <span>Equipo</span>
                              <span className="text-center">Ida</span>
                              <span className="text-center">Vta</span>
                              <span className="text-center text-zinc-300 font-medium">Glb</span>
                            </div>

                            <div className="divide-y divide-white/[0.06]">
                              {[
                                {
                                  name: slot.homeTeamName,
                                  seed: slot.homeSeed,
                                  id: slot.homeTeamId,
                                  winner: isHomeWinner,
                                  s1: slot.homeFirstLegScore,
                                  s2: slot.homeSecondLegScore,
                                  glb: visibleHomeGlobal,
                                },
                                {
                                  name: slot.awayTeamName,
                                  seed: slot.awaySeed,
                                  id: slot.awayTeamId,
                                  winner: isAwayWinner,
                                  s1: slot.awayFirstLegScore,
                                  s2: slot.awaySecondLegScore,
                                  glb: visibleAwayGlobal,
                                },
                              ].map((side, idx) => (
                                <div
                                  key={idx}
                                  className={`grid grid-cols-[minmax(0,1fr)_2rem_2rem_2.5rem] items-center gap-1 px-3 py-2.5 ${
                                    side.winner ? 'bg-[#707ef9]/10' : ''
                                  }`}
                                >
                                  <div className="min-w-0 pr-1">
                                    <p
                                      className={`text-sm truncate ${
                                        side.winner
                                          ? 'font-semibold text-white'
                                          : side.id
                                          ? 'text-zinc-200'
                                          : 'text-zinc-500 italic'
                                      }`}
                                    >
                                      {side.name}
                                    </p>
                                    <p className="text-[10px] text-zinc-600 truncate">{side.seed}</p>
                                  </div>
                                  <span className="text-center text-xs tabular-nums text-zinc-400 flex justify-center">
                                    {hasRevealedFirst ? (
                                      side.s1
                                    ) : votingFirst ? (
                                      <Lock className="w-3 h-3 text-zinc-600" />
                                    ) : (
                                      '—'
                                    )}
                                  </span>
                                  <span className="text-center text-xs tabular-nums text-zinc-400 flex justify-center">
                                    {hasRevealedSecond ? (
                                      side.s2
                                    ) : votingSecond ? (
                                      <Lock className="w-3 h-3 text-zinc-600" />
                                    ) : (
                                      '—'
                                    )}
                                  </span>
                                  <span
                                    className={`text-center text-base font-semibold tabular-nums flex justify-center ${
                                      side.winner ? 'text-[#a5b0ff]' : 'text-white'
                                    }`}
                                  >
                                    {hasAnyRevealedLeg ? (
                                      side.glb
                                    ) : anyVotingOpen ? (
                                      <Lock className="w-3.5 h-3.5 text-zinc-600" />
                                    ) : (
                                      '—'
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {slot.isAggregateDraw && (
                              <div className="px-3 py-1.5 bg-amber-500/10 border-t border-amber-500/20 text-[10px] text-amber-300">
                                Empate global — definición oficial
                              </div>
                            )}

                            <div className="grid grid-cols-2 divide-x divide-white/[0.06] border-t border-white/[0.06] bg-white/[0.02] text-[11px]">
                              {firstLeg ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenMatchModal(firstLeg)}
                                  className="px-2.5 py-2 text-left hover:bg-white/[0.05] transition-colors cursor-pointer flex items-center justify-between gap-1 min-w-0"
                                >
                                  <span className="truncate text-zinc-300">
                                    Ida · {formatShortMatchDate(firstLeg.fecha)}
                                  </span>
                                  <span className="text-[#a5b0ff] shrink-0">
                                    {votingFirst ? 'MVP' : '→'}
                                  </span>
                                </button>
                              ) : (
                                <div className="px-2.5 py-2 text-zinc-600 truncate">Ida · —</div>
                              )}
                              {secondLeg ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenMatchModal(secondLeg)}
                                  className="px-2.5 py-2 text-left hover:bg-white/[0.05] transition-colors cursor-pointer flex items-center justify-between gap-1 min-w-0"
                                >
                                  <span className="truncate text-zinc-300">
                                    Vta · {formatShortMatchDate(secondLeg.fecha)}
                                  </span>
                                  <span className="text-[#a5b0ff] shrink-0">
                                    {votingSecond ? 'MVP' : '→'}
                                  </span>
                                </button>
                              ) : (
                                <div className="px-2.5 py-2 text-zinc-600 truncate">Vta · —</div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      const linkedMatch = slot.match;
                      const revealScore = linkedMatch ? shouldRevealPublicMatchData(linkedMatch) : false;
                      const votingOpen = linkedMatch ? canVoteMatchMvp(linkedMatch) : false;
                      const isClickable = Boolean(linkedMatch);

                      const cardInner = (
                        <div
                          className={`rounded-2xl border bg-[#0c0c10] overflow-hidden transition-colors ${
                            isFinalColumn
                              ? 'border-[#707ef9]/45'
                              : accentThirdPlace
                              ? 'border-white/[0.16]'
                              : 'border-white/[0.08]'
                          } ${isClickable ? 'hover:border-white/[0.25]' : ''}`}
                        >
                          <div
                            className={`px-3.5 py-2 border-b flex items-center justify-between gap-2 text-[11px] ${
                              isFinalColumn
                                ? 'bg-[#707ef9]/20 text-[#d4daff] border-[#707ef9]/30'
                                : 'bg-white/[0.03] text-zinc-400 border-white/[0.07]'
                            }`}
                          >
                            <span className="font-medium truncate">
                              {accentThirdPlace
                                ? '3° Lugar'
                                : isFinalColumn
                                ? 'Gran Final'
                                : `${slot.round} · #${slot.slot}`}
                            </span>
                            <span className="tabular-nums shrink-0">
                              {linkedMatch
                                ? votingOpen
                                  ? 'En juego'
                                  : revealScore
                                  ? 'Final'
                                  : `${formatShortMatchDate(linkedMatch.fecha)} ${linkedMatch.hora}`
                                : 'Proyectado'}
                            </span>
                          </div>

                          <div className="divide-y divide-white/[0.06]">
                            {[
                              {
                                name: slot.homeTeamName,
                                seed: slot.homeSeed,
                                id: slot.homeTeamId,
                                winner: isHomeWinner,
                                score: slot.homeScore,
                              },
                              {
                                name: slot.awayTeamName,
                                seed: slot.awaySeed,
                                id: slot.awayTeamId,
                                winner: isAwayWinner,
                                score: slot.awayScore,
                              },
                            ].map((side, idx) => (
                              <div
                                key={idx}
                                className={`px-3.5 py-2.5 flex items-center justify-between gap-2 ${
                                  side.winner ? 'bg-[#707ef9]/10' : ''
                                }`}
                              >
                                <div className="min-w-0">
                                  <p
                                    className={`text-sm truncate ${
                                      side.winner
                                        ? 'font-semibold text-white'
                                        : side.id
                                        ? 'text-zinc-200'
                                        : 'text-zinc-500 italic'
                                    }`}
                                  >
                                    {side.name}
                                  </p>
                                  <p className="text-[10px] text-zinc-600 truncate">{side.seed}</p>
                                </div>
                                <span
                                  className={`text-base font-semibold tabular-nums shrink-0 px-1.5 ${
                                    side.winner ? 'text-[#a5b0ff]' : 'text-white'
                                  }`}
                                >
                                  {revealScore && side.score !== undefined ? (
                                    side.score
                                  ) : votingOpen ? (
                                    <Lock className="w-3.5 h-3.5 text-zinc-600" />
                                  ) : (
                                    '—'
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>

                          {linkedMatch && (
                            <div className="px-3.5 py-2 bg-white/[0.02] border-t border-white/[0.06] flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                              <span className="truncate">{linkedMatch.cancha}</span>
                              <span className="text-[#a5b0ff] shrink-0">
                                {votingOpen ? 'MVP →' : 'Ficha →'}
                              </span>
                            </div>
                          )}
                        </div>
                      );

                      if (linkedMatch) {
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => onOpenMatchModal(linkedMatch)}
                            className="w-full text-left cursor-pointer block"
                          >
                            {cardInner}
                          </button>
                        );
                      }

                      return <div key={slot.id}>{cardInner}</div>;
                    };

                    return (
                      <div key={col.round} className="flex flex-col">
                        <div className="rounded-full bg-white/[0.05] border border-white/[0.08] text-white px-4 py-2 mb-4 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium">{col.title}</span>
                          <span className="text-[11px] text-zinc-500 tabular-nums">
                            {col.slots.length}
                          </span>
                        </div>

                        <div
                          className={`flex-1 flex flex-col ${
                            colIdx === 0 ? 'gap-4' : 'justify-around gap-6'
                          }`}
                        >
                          {col.slots.map((slot) => renderSlotCard(slot, false))}

                          {isFinalColumn && fullBracket.thirdPlace && (
                            <div className="pt-4 border-t border-dashed border-white/[0.1] space-y-2">
                              <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                                <Medal className="w-3.5 h-3.5 text-[#9aa5ff]" />
                                <span>Tercer lugar</span>
                              </p>
                              {renderSlotCard(fullBracket.thirdPlace, true)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
