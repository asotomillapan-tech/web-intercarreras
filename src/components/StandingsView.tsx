import { useMemo, useState } from 'react';
import { ArrowLeftRight, Award, Lock, Medal, Star, Trophy } from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
import { canVoteMatchMvp, shouldRevealPublicMatchData } from '../domain/rbacEngine';
import { buildFullPlayoffTree, computeStandings } from '../domain/tournamentEngine';
import type {
  AppUserProfile,
  DisciplineId,
  Match,
  PlayoffBracketSlot,
  StandingsRow,
  TournamentState,
} from '../types/tournament';

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
  return trimmed || 'Fecha por confirmar';
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
                {config.formatoPlayoff}
                {config.playoffsIdaYVuelta ? ' (Ida y Vuelta)' : ''}
                {config.incluyeTercerLugar !== false ? ' + 3° Lugar' : ''} · Sede:{' '}
                {meta.sedePrincipal}
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
                                  <button
                                    type="button"
                                    onClick={() => onInspectTeam(row.teamId)}
                                    className="text-left group cursor-pointer"
                                  >
                                    <span className="group-hover:text-[#707ef9] transition-colors underline-offset-2 group-hover:underline">
                                      {row.teamName}
                                    </span>
                                    <span className="md:hidden block text-xs font-normal text-neutral-500">
                                      {row.carrera}
                                    </span>
                                  </button>
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
          /* Full Single-Elimination Playoff Bracket Tree + 3rd Place Match */
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                  Cuadro Completo de Eliminación Directa · Top {config.formatoPlayoff}
                </h2>
                <p className="text-sm text-neutral-600 mt-1">
                  {fullBracket.isTwoLegged
                    ? `Series a doble partido (Ida y Vuelta) con definición por marcador global desde ${fullBracket.rounds[0]?.title ?? 'Playoffs'} hasta la Gran Final${fullBracket.thirdPlace ? ' y el Partido por el Tercer Lugar' : ''}.`
                    : `Visualización completa de todas las fases eliminatorias desde ${fullBracket.rounds[0]?.title ?? 'Playoffs'} hasta la Gran Final${fullBracket.thirdPlace ? ' y el Partido por el Tercer Lugar' : ''}.`}
                </p>
              </div>
              <div className="flex flex-wrap items-center sm:justify-end gap-2.5 text-xs text-neutral-600 shrink-0">
                <span className="inline-flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-[#707ef9]" />
                  <span>
                    Clasifican {config.clasificadosPorGrupo} por grupo · Cuadro de{' '}
                    {config.formatoPlayoff}
                  </span>
                </span>
                {fullBracket.isTwoLegged && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#707ef9]/10 border border-[#707ef9]/35 text-[#4250d6] font-bold uppercase tracking-wider text-[11px]">
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Ida y Vuelta · Global</span>
                  </span>
                )}
                {fullBracket.thirdPlace && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#f5f6f8] border border-neutral-200 text-[#0d0d0d] font-medium">
                    <Medal className="w-3.5 h-3.5 text-[#707ef9]" />
                    <span>Incluye 3° Lugar</span>
                  </span>
                )}
              </div>
            </div>

            {/* Podium Banner when Champion or 3rd Place is defined */}
            {(fullBracket.championName || fullBracket.thirdPlaceWinnerName) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fullBracket.championName && (
                  <div className="bg-[#0d0d0d] text-white p-5 border-l-4 border-[#707ef9] flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-[#707ef9] font-bold">
                        Campeón Oficial · {meta.nombreCorto}
                      </p>
                      <p className="font-display text-3xl uppercase tracking-wide mt-1">
                        {fullBracket.championName}
                      </p>
                    </div>
                    <Trophy className="w-8 h-8 text-[#707ef9] shrink-0" />
                  </div>
                )}
                {fullBracket.thirdPlaceWinnerName && (
                  <div className="bg-[#f5f6f8] text-[#0d0d0d] p-5 border border-neutral-300 border-l-4 border-l-[#0d0d0d] flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-neutral-500 font-bold">
                        Tercer Lugar · Podio {meta.nombreCorto}
                      </p>
                      <p className="font-display text-3xl uppercase tracking-wide mt-1">
                        {fullBracket.thirdPlaceWinnerName}
                      </p>
                    </div>
                    <Medal className="w-8 h-8 text-[#0d0d0d] shrink-0" />
                  </div>
                )}
              </div>
            )}

            {fullBracket.rounds.length === 0 ? (
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
              <div className="overflow-x-auto pb-4">
                <div
                  className={`grid gap-6 ${
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
                          revealFirst && slot.homeFirstLegScore !== undefined && slot.awayFirstLegScore !== undefined;
                        const hasRevealedSecond =
                          revealSecond && slot.homeSecondLegScore !== undefined && slot.awaySecondLegScore !== undefined;
                        const hasAnyRevealedLeg = hasRevealedFirst || hasRevealedSecond;
                        const visibleHomeGlobal =
                          (hasRevealedFirst ? slot.homeFirstLegScore ?? 0 : 0) +
                          (hasRevealedSecond ? slot.homeSecondLegScore ?? 0 : 0);
                        const visibleAwayGlobal =
                          (hasRevealedFirst ? slot.awayFirstLegScore ?? 0 : 0) +
                          (hasRevealedSecond ? slot.awaySecondLegScore ?? 0 : 0);

                        const headerStatus = slot.isAggregateDraw
                          ? 'EMPATE GLOBAL'
                          : hasRevealedFirst && hasRevealedSecond
                          ? 'GLOBAL FINAL'
                          : anyVotingOpen
                          ? 'EN HORARIO'
                          : hasRevealedFirst
                          ? 'IDA JUGADA'
                          : 'IDA Y VUELTA';

                        return (
                          <div
                            key={slot.id}
                            className={`border bg-white transition-colors ${
                              accentThirdPlace
                                ? 'border-[#0d0d0d]'
                                : isFinalColumn
                                ? 'border-[#707ef9] shadow-sm'
                                : 'border-neutral-300'
                            }`}
                          >
                            <div
                              className={`px-3.5 py-2 border-b flex items-center justify-between gap-2 text-[11px] ${
                                accentThirdPlace
                                  ? 'bg-[#0d0d0d] text-white border-[#0d0d0d]'
                                  : isFinalColumn
                                  ? 'bg-[#707ef9] text-white border-[#707ef9]'
                                  : 'bg-[#f5f6f8] text-neutral-600 border-neutral-200'
                              }`}
                            >
                              <span className="font-display font-bold uppercase tracking-wider truncate">
                                {accentThirdPlace
                                  ? '3° Lugar · Ida y Vuelta'
                                  : isFinalColumn
                                  ? 'Gran Final · Ida y Vuelta'
                                  : `${slot.round} · Llave ${slot.slot}`}
                              </span>
                              <span className="tabular-nums shrink-0 opacity-90 font-semibold">
                                {headerStatus}
                              </span>
                            </div>

                            {/* Column header for IDA / VTA / GLB */}
                            <div className="grid grid-cols-[minmax(0,1fr)_2rem_2rem_2.5rem] items-center gap-1 px-3 py-1 bg-[#f9fafb] border-b border-neutral-200 text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                              <span>Equipo</span>
                              <span className="text-center">Ida</span>
                              <span className="text-center">Vta</span>
                              <span className="text-center font-bold text-[#0d0d0d]">Glb</span>
                            </div>

                            <div className="divide-y divide-neutral-200">
                              {/* Home / Seed A Row */}
                              <div
                                className={`grid grid-cols-[minmax(0,1fr)_2rem_2rem_2.5rem] items-center gap-1 px-3 py-2.5 ${
                                  isHomeWinner ? 'bg-[#707ef9]/10' : ''
                                }`}
                              >
                                <div className="min-w-0 pr-1">
                                  <p
                                    className={`text-sm truncate ${
                                      isHomeWinner
                                        ? 'font-bold text-[#0d0d0d]'
                                        : slot.homeTeamId
                                        ? 'font-medium text-[#0d0d0d]'
                                        : 'text-neutral-500 italic'
                                    }`}
                                  >
                                    {slot.homeTeamName}
                                  </p>
                                  <p className="text-[10px] font-mono text-neutral-400 truncate">
                                    {slot.homeSeed}
                                  </p>
                                </div>

                                <span className="text-center font-mono text-xs tabular-nums text-neutral-700 flex justify-center">
                                  {hasRevealedFirst ? (
                                    slot.homeFirstLegScore
                                  ) : votingFirst ? (
                                    <Lock className="w-3 h-3 text-neutral-400" />
                                  ) : (
                                    '—'
                                  )}
                                </span>

                                <span className="text-center font-mono text-xs tabular-nums text-neutral-700 flex justify-center">
                                  {hasRevealedSecond ? (
                                    slot.homeSecondLegScore
                                  ) : votingSecond ? (
                                    <Lock className="w-3 h-3 text-neutral-400" />
                                  ) : (
                                    '—'
                                  )}
                                </span>

                                <span
                                  className={`text-center font-display text-xl tabular-nums flex justify-center ${
                                    isHomeWinner
                                      ? 'text-[#707ef9] font-bold'
                                      : 'text-[#0d0d0d] font-bold'
                                  }`}
                                >
                                  {hasAnyRevealedLeg ? (
                                    visibleHomeGlobal
                                  ) : anyVotingOpen ? (
                                    <Lock className="w-3.5 h-3.5 text-neutral-400" />
                                  ) : (
                                    '—'
                                  )}
                                </span>
                              </div>

                              {/* Away / Seed B Row */}
                              <div
                                className={`grid grid-cols-[minmax(0,1fr)_2rem_2rem_2.5rem] items-center gap-1 px-3 py-2.5 ${
                                  isAwayWinner ? 'bg-[#707ef9]/10' : ''
                                }`}
                              >
                                <div className="min-w-0 pr-1">
                                  <p
                                    className={`text-sm truncate ${
                                      isAwayWinner
                                        ? 'font-bold text-[#0d0d0d]'
                                        : slot.awayTeamId
                                        ? 'font-medium text-[#0d0d0d]'
                                        : 'text-neutral-500 italic'
                                    }`}
                                  >
                                    {slot.awayTeamName}
                                  </p>
                                  <p className="text-[10px] font-mono text-neutral-400 truncate">
                                    {slot.awaySeed}
                                  </p>
                                </div>

                                <span className="text-center font-mono text-xs tabular-nums text-neutral-700 flex justify-center">
                                  {hasRevealedFirst ? (
                                    slot.awayFirstLegScore
                                  ) : votingFirst ? (
                                    <Lock className="w-3 h-3 text-neutral-400" />
                                  ) : (
                                    '—'
                                  )}
                                </span>

                                <span className="text-center font-mono text-xs tabular-nums text-neutral-700 flex justify-center">
                                  {hasRevealedSecond ? (
                                    slot.awaySecondLegScore
                                  ) : votingSecond ? (
                                    <Lock className="w-3 h-3 text-neutral-400" />
                                  ) : (
                                    '—'
                                  )}
                                </span>

                                <span
                                  className={`text-center font-display text-xl tabular-nums flex justify-center ${
                                    isAwayWinner
                                      ? 'text-[#707ef9] font-bold'
                                      : 'text-[#0d0d0d] font-bold'
                                  }`}
                                >
                                  {hasAnyRevealedLeg ? (
                                    visibleAwayGlobal
                                  ) : anyVotingOpen ? (
                                    <Lock className="w-3.5 h-3.5 text-neutral-400" />
                                  ) : (
                                    '—'
                                  )}
                                </span>
                              </div>
                            </div>

                            {slot.isAggregateDraw && (
                              <div className="px-3 py-1.5 bg-amber-50 border-t border-amber-200 text-[10px] font-medium text-amber-900">
                                Empate en marcador global — definición por penales / criterio oficial
                              </div>
                            )}

                            {/* Interactive Ida & Vuelta Footer Buttons */}
                            <div className="grid grid-cols-2 divide-x divide-neutral-200 border-t border-neutral-200 bg-[#f9fafb] text-[11px]">
                              {firstLeg ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenMatchModal(firstLeg)}
                                  className="px-2.5 py-2 text-left hover:bg-[#707ef9]/10 transition-colors cursor-pointer flex items-center justify-between gap-1 min-w-0"
                                >
                                  <span className="truncate text-neutral-700 font-medium">
                                    Ida · {formatShortMatchDate(firstLeg.fecha)}
                                  </span>
                                  <span className="text-[#707ef9] font-bold shrink-0">
                                    {votingFirst ? 'MVP →' : '→'}
                                  </span>
                                </button>
                              ) : (
                                <div className="px-2.5 py-2 text-neutral-400 truncate">
                                  Ida · Por programar
                                </div>
                              )}

                              {secondLeg ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenMatchModal(secondLeg)}
                                  className="px-2.5 py-2 text-left hover:bg-[#707ef9]/10 transition-colors cursor-pointer flex items-center justify-between gap-1 min-w-0"
                                >
                                  <span className="truncate text-neutral-700 font-medium">
                                    Vta · {formatShortMatchDate(secondLeg.fecha)}
                                  </span>
                                  <span className="text-[#707ef9] font-bold shrink-0">
                                    {votingSecond ? 'MVP →' : '→'}
                                  </span>
                                </button>
                              ) : (
                                <div className="px-2.5 py-2 text-neutral-400 truncate">
                                  Vta · Por programar
                                </div>
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
                          className={`border bg-white transition-colors ${
                            accentThirdPlace
                              ? 'border-[#0d0d0d]'
                              : isFinalColumn
                              ? 'border-[#707ef9] shadow-sm'
                              : 'border-neutral-300'
                          } ${isClickable ? 'hover:border-[#707ef9]' : ''}`}
                        >
                          <div
                            className={`px-3.5 py-2 border-b flex items-center justify-between gap-2 text-[11px] ${
                              accentThirdPlace
                                ? 'bg-[#0d0d0d] text-white border-[#0d0d0d]'
                                : isFinalColumn
                                ? 'bg-[#707ef9] text-white border-[#707ef9]'
                                : 'bg-[#f5f6f8] text-neutral-600 border-neutral-200'
                            }`}
                          >
                            <span className="font-display font-bold uppercase tracking-wider truncate">
                              {accentThirdPlace
                                ? 'Partido por el 3° Lugar'
                                : isFinalColumn
                                ? 'Gran Final'
                                : `${slot.round} · Llave ${slot.slot}`}
                            </span>
                            <span className="tabular-nums shrink-0 opacity-90">
                              {linkedMatch
                                ? votingOpen
                                  ? 'EN HORARIO'
                                  : revealScore
                                  ? 'FINAL'
                                  : `${formatShortMatchDate(linkedMatch.fecha)} ${linkedMatch.hora}`
                                : 'Proyectado'}
                            </span>
                          </div>

                          <div className="divide-y divide-neutral-200">
                            <div
                              className={`px-3.5 py-2.5 flex items-center justify-between gap-2 ${
                                isHomeWinner ? 'bg-[#707ef9]/10' : ''
                              }`}
                            >
                              <div className="min-w-0">
                                <p
                                  className={`text-sm truncate ${
                                    isHomeWinner
                                      ? 'font-bold text-[#0d0d0d]'
                                      : slot.homeTeamId
                                      ? 'font-medium text-[#0d0d0d]'
                                      : 'text-neutral-500 italic'
                                  }`}
                                >
                                  {slot.homeTeamName}
                                </p>
                                <p className="text-[10px] font-mono text-neutral-400 truncate">
                                  {slot.homeSeed}
                                </p>
                              </div>
                              <span
                                className={`font-display text-xl tabular-nums shrink-0 px-1.5 ${
                                  isHomeWinner
                                    ? 'text-[#707ef9] font-bold'
                                    : 'text-[#0d0d0d] font-bold'
                                }`}
                              >
                                {revealScore && slot.homeScore !== undefined ? (
                                  slot.homeScore
                                ) : votingOpen ? (
                                  <Lock className="w-3.5 h-3.5 text-neutral-400" />
                                ) : (
                                  '—'
                                )}
                              </span>
                            </div>

                            <div
                              className={`px-3.5 py-2.5 flex items-center justify-between gap-2 ${
                                isAwayWinner ? 'bg-[#707ef9]/10' : ''
                              }`}
                            >
                              <div className="min-w-0">
                                <p
                                  className={`text-sm truncate ${
                                    isAwayWinner
                                      ? 'font-bold text-[#0d0d0d]'
                                      : slot.awayTeamId
                                      ? 'font-medium text-[#0d0d0d]'
                                      : 'text-neutral-500 italic'
                                  }`}
                                >
                                  {slot.awayTeamName}
                                </p>
                                <p className="text-[10px] font-mono text-neutral-400 truncate">
                                  {slot.awaySeed}
                                </p>
                              </div>
                              <span
                                className={`font-display text-xl tabular-nums shrink-0 px-1.5 ${
                                  isAwayWinner
                                    ? 'text-[#707ef9] font-bold'
                                    : 'text-[#0d0d0d] font-bold'
                                }`}
                              >
                                {revealScore && slot.awayScore !== undefined ? (
                                  slot.awayScore
                                ) : votingOpen ? (
                                  <Lock className="w-3.5 h-3.5 text-neutral-400" />
                                ) : (
                                  '—'
                                )}
                              </span>
                            </div>
                          </div>

                          {linkedMatch && (
                            <div className="px-3.5 py-1.5 bg-[#f9fafb] border-t border-neutral-200 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
                              <span className="truncate">{linkedMatch.cancha}</span>
                              <span className="text-[#707ef9] font-medium shrink-0">
                                {votingOpen ? 'Votar MVP →' : 'Ficha →'}
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
                        <div className="bg-[#0d0d0d] text-white px-3.5 py-2.5 mb-4 flex items-center justify-between gap-2">
                          <span className="font-display text-base font-bold uppercase tracking-wider">
                            {col.title}
                          </span>
                          <span className="text-[11px] text-neutral-400 tabular-nums">
                            {col.slots.length}{' '}
                            {col.slots.length === 1
                              ? fullBracket.isTwoLegged
                                ? 'llave'
                                : 'partido'
                              : 'llaves'}
                          </span>
                        </div>

                        <div
                          className={`flex-1 flex flex-col ${
                            colIdx === 0 ? 'gap-4' : 'justify-around gap-6'
                          }`}
                        >
                          {col.slots.map((slot) => renderSlotCard(slot, false))}

                          {isFinalColumn && fullBracket.thirdPlace && (
                            <div className="pt-4 border-t border-dashed border-neutral-300 space-y-2">
                              <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
                                <Medal className="w-3.5 h-3.5 text-[#707ef9]" />
                                <span>Definición del Bronce</span>
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
