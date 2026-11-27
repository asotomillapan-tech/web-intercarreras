import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  MapPin,
} from 'lucide-react';
import { DISCIPLINE_MAP } from '../data/ufroSeed';
import {
  buildCalendarMonthGrid,
  extractCalendarVenues,
  filterCalendarMatches,
  formatCalendarDateEs,
  groupMatchesByDate,
  MONTHS_LONG_ES,
  normalizeMatchDateToIso,
  pickInitialCalendarMonth,
} from '../domain/calendarEngine';
import {
  extractMatchGroups,
  filterMatchesByOrg,
  type MatchSortOrder,
} from '../domain/matchFilterEngine';
import {
  canRefereeMatches,
  canVoteMatchMvp,
  shouldRevealPublicMatchData,
} from '../domain/rbacEngine';
import type {
  AppUserProfile,
  DisciplineId,
  Match,
  MatchPhase,
  Team,
} from '../types/tournament';
import { MatchFilterBar } from './MatchFilterBar';
import { RevealSection, SectionKicker } from './MotionPrimitives';

interface HomeMatchCalendarProps {
  matches: Match[];
  teams: Team[];
  temporada: string;
  currentUser: AppUserProfile | null;
  onOpenMatchModal: (match: Match) => void;
  onOpenMatchInReferee: (matchId: string) => void;
}

const WEEKDAY_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function HomeMatchCalendar({
  matches,
  teams,
  temporada,
  currentUser,
  onOpenMatchModal,
  onOpenMatchInReferee,
}: HomeMatchCalendarProps) {
  const hasAnyScheduled = useMemo(
    () => matches.some((m) => m.status === 'PROGRAMADO'),
    [matches]
  );

  const [disciplineFilter, setDisciplineFilter] = useState<'ALL' | DisciplineId>('ALL');
  const [groupFilter, setGroupFilter] = useState<'ALL' | string>('ALL');
  const [stageFilter, setStageFilter] = useState<'ALL' | MatchPhase>('ALL');
  const [venueFilter, setVenueFilter] = useState<'ALL' | string>('ALL');
  const [sortOrder, setSortOrder] = useState<MatchSortOrder>('newest');
  const [statusMode, setStatusMode] = useState<'PROGRAMADO' | 'ALL'>('PROGRAMADO');
  const [userToggledStatus, setUserToggledStatus] = useState(false);
  const [selectedDateIso, setSelectedDateIso] = useState<string | null>(null);

  const initialMonth = useMemo(() => pickInitialCalendarMonth(matches), [matches]);
  const [viewYear, setViewYear] = useState(initialMonth.year);
  const [viewMonth, setViewMonth] = useState(initialMonth.monthIndex);
  const [userNavigatedMonth, setUserNavigatedMonth] = useState(false);

  useEffect(() => {
    if (!userNavigatedMonth) {
      setViewYear(initialMonth.year);
      setViewMonth(initialMonth.monthIndex);
    }
  }, [initialMonth.year, initialMonth.monthIndex, userNavigatedMonth]);

  useEffect(() => {
    if (!userToggledStatus) {
      setStatusMode(hasAnyScheduled ? 'PROGRAMADO' : 'ALL');
    }
  }, [hasAnyScheduled, userToggledStatus]);

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const isOfficial = canRefereeMatches(currentUser);

  const statusScopedMatches = useMemo(
    () => (statusMode === 'PROGRAMADO' ? matches.filter((m) => m.status === 'PROGRAMADO') : matches),
    [matches, statusMode]
  );

  const availableGroups = useMemo(
    () => extractMatchGroups(statusScopedMatches, { disciplineId: disciplineFilter }),
    [statusScopedMatches, disciplineFilter]
  );

  const venues = useMemo(() => {
    const scope = filterMatchesByOrg(matches, {
      disciplineId: disciplineFilter,
      groupName: groupFilter,
      fase: stageFilter,
    });
    return extractCalendarVenues(scope);
  }, [matches, disciplineFilter, groupFilter, stageFilter]);

  useEffect(() => {
    if (groupFilter !== 'ALL' && !availableGroups.includes(groupFilter)) {
      setGroupFilter('ALL');
    }
  }, [groupFilter, availableGroups]);

  useEffect(() => {
    if (venueFilter !== 'ALL' && !venues.includes(venueFilter)) {
      setVenueFilter('ALL');
    }
  }, [venueFilter, venues]);

  const filteredMatches = useMemo(() => {
    const orgScoped = filterMatchesByOrg(matches, {
      disciplineId: disciplineFilter,
      groupName: groupFilter,
      fase: stageFilter,
    });
    return filterCalendarMatches(orgScoped, {
      disciplineId: disciplineFilter,
      venue: venueFilter,
      statusFilter: statusMode,
    });
  }, [matches, disciplineFilter, groupFilter, stageFilter, venueFilter, statusMode]);

  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;

  const monthCells = useMemo(
    () => buildCalendarMonthGrid(viewYear, viewMonth, filteredMatches),
    [viewYear, viewMonth, filteredMatches]
  );

  const monthMatches = useMemo(
    () =>
      filteredMatches.filter((m) => {
        const iso = normalizeMatchDateToIso(m.fecha);
        return iso ? iso.startsWith(monthPrefix) : false;
      }),
    [filteredMatches, monthPrefix]
  );

  const visibleDateGroups = useMemo(() => {
    if (selectedDateIso) {
      const dayMatches = filteredMatches.filter(
        (m) => normalizeMatchDateToIso(m.fecha) === selectedDateIso
      );
      return groupMatchesByDate(dayMatches, sortOrder);
    }
    if (monthMatches.length > 0) {
      return groupMatchesByDate(monthMatches, sortOrder);
    }
    return groupMatchesByDate(filteredMatches, sortOrder);
  }, [selectedDateIso, filteredMatches, monthMatches, sortOrder]);

  const handlePrevMonth = () => {
    setUserNavigatedMonth(true);
    setSelectedDateIso(null);
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    setUserNavigatedMonth(true);
    setSelectedDateIso(null);
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleResetFilters = () => {
    setDisciplineFilter('ALL');
    setGroupFilter('ALL');
    setStageFilter('ALL');
    setVenueFilter('ALL');
    setSortOrder('newest');
    setSelectedDateIso(null);
    setUserToggledStatus(false);
    setStatusMode(hasAnyScheduled ? 'PROGRAMADO' : 'ALL');
    setUserNavigatedMonth(false);
    setViewYear(initialMonth.year);
    setViewMonth(initialMonth.monthIndex);
  };

  const selectedDateLabel = selectedDateIso
    ? formatCalendarDateEs(selectedDateIso).fullDateLabel
    : null;

  return (
    <section
      aria-labelledby="home-calendar-heading"
      className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 border-b border-white/[0.06]"
    >
      <RevealSection>
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
          <div className="space-y-2.5">
            <SectionKicker index="04" label={`Programación ${temporada}`} />
            <h2
              id="home-calendar-heading"
              className="text-3xl sm:text-4xl font-medium tracking-[-0.03em] text-white"
            >
              Calendario de <span className="font-editorial text-[#c8ceff]">partidos</span>
            </h2>
          </div>

          <div className="inline-flex items-center gap-1 rounded-full bg-white/[0.03] border border-white/[0.08] p-1 self-start lg:self-auto">
            <button
              type="button"
              onClick={() => {
                setUserToggledStatus(true);
                setStatusMode('PROGRAMADO');
                setSelectedDateIso(null);
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                statusMode === 'PROGRAMADO'
                  ? 'bg-white text-[#050507]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Programados ({matches.filter((m) => m.status === 'PROGRAMADO').length})
            </button>
            <button
              type="button"
              onClick={() => {
                setUserToggledStatus(true);
                setStatusMode('ALL');
                setSelectedDateIso(null);
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                statusMode === 'ALL'
                  ? 'bg-[#707ef9] text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Todos ({matches.length})
            </button>
          </div>
        </div>

        <div className="mb-6">
          <MatchFilterBar
            idPrefix="cal-filter"
            matches={statusScopedMatches}
            disciplineFilter={disciplineFilter}
            onDisciplineChange={(val) => {
              setDisciplineFilter(val);
              setSelectedDateIso(null);
            }}
            groupFilter={groupFilter}
            onGroupChange={(val) => {
              setGroupFilter(val);
              setSelectedDateIso(null);
            }}
            stageFilter={stageFilter}
            onStageChange={(val) => {
              setStageFilter(val);
              setSelectedDateIso(null);
            }}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            filteredCount={filteredMatches.length}
            totalCount={statusScopedMatches.length}
            hasExtraActiveFilters={venueFilter !== 'ALL' || selectedDateIso !== null}
            onReset={handleResetFilters}
            extraControls={
              <div className="min-w-[175px] flex-1">
                <label
                  htmlFor="cal-filter-venue"
                  className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 mb-1.5"
                >
                  <MapPin className="w-3 h-3 text-[#9aa5ff]" />
                  <span>Sede</span>
                </label>
                <select
                  id="cal-filter-venue"
                  value={venueFilter}
                  onChange={(e) => {
                    setVenueFilter(e.target.value);
                    setSelectedDateIso(null);
                  }}
                  className="w-full rounded-xl bg-[#111117] border border-white/[0.1] hover:border-white/[0.18] px-3 py-2 text-xs sm:text-sm text-zinc-100 focus:outline-none focus:border-[#707ef9] transition-colors"
                >
                  <option value="ALL">Todas ({venues.length})</option>
                  {venues.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            }
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Monthly Calendar */}
          <div className="lg:col-span-5 rounded-3xl border border-white/[0.08] bg-[#0c0c10] overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between gap-2 border-b border-white/[0.07]">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Mes anterior"
                className="w-8 h-8 rounded-full inline-flex items-center justify-center hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-center">
                <p className="text-base font-medium tracking-tight text-white capitalize">
                  {MONTHS_LONG_ES[viewMonth]}{' '}
                  <span className="font-editorial text-zinc-400">{viewYear}</span>
                </p>
                <p className="text-[11px] text-zinc-500 tabular-nums">
                  {monthMatches.length}{' '}
                  {monthMatches.length === 1 ? 'encuentro' : 'encuentros'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Mes siguiente"
                className="w-8 h-8 rounded-full inline-flex items-center justify-center hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 border-b border-white/[0.06] bg-white/[0.02]">
              {WEEKDAY_HEADERS.map((day) => (
                <div
                  key={day}
                  className="py-2.5 text-center text-[11px] font-medium text-zinc-500"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-px bg-white/[0.05]">
              {monthCells.map((cell) => {
                const isSelected = selectedDateIso === cell.dateIso;
                const hasMatches = cell.matchCount > 0;
                return (
                  <button
                    key={cell.dateIso}
                    type="button"
                    onClick={() => setSelectedDateIso(isSelected ? null : cell.dateIso)}
                    aria-label={`${cell.dateIso}, ${cell.matchCount} partidos`}
                    aria-pressed={isSelected}
                    className={`min-h-[56px] p-1.5 flex flex-col items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#707ef9] text-white'
                        : cell.inCurrentMonth
                        ? hasMatches
                          ? 'bg-[#0f0f15] hover:bg-white/[0.08] text-white'
                          : 'bg-[#0c0c10] hover:bg-white/[0.04] text-zinc-500'
                        : 'bg-[#08080b] text-zinc-700 hover:bg-white/[0.03]'
                    }`}
                  >
                    <span
                      className={`text-xs tabular-nums ${
                        isSelected
                          ? 'font-semibold text-white'
                          : hasMatches
                          ? 'font-medium text-zinc-100'
                          : ''
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {hasMatches ? (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums leading-none ${
                          isSelected
                            ? 'bg-white text-[#050507]'
                            : cell.liveCount > 0 || cell.scheduledCount > 0
                            ? 'bg-[#707ef9]/25 text-[#c7ceff]'
                            : 'bg-white/[0.1] text-zinc-300'
                        }`}
                      >
                        {cell.matchCount}
                      </span>
                    ) : (
                      <span className="h-3.5" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="px-4 py-3 bg-white/[0.02] border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
              <div className="flex items-center gap-3.5">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#707ef9] inline-block" aria-hidden="true" />
                  <span>Programado</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-zinc-500 inline-block" aria-hidden="true" />
                  <span>Finalizado</span>
                </span>
              </div>
              {selectedDateIso && (
                <button
                  type="button"
                  onClick={() => setSelectedDateIso(null)}
                  className="text-[#9aa5ff] hover:text-white font-medium cursor-pointer"
                >
                  Ver todo el mes
                </button>
              )}
            </div>
          </div>

          {/* Chronological Date Agenda */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/[0.07]">
              <div className="flex items-center gap-2 text-xs text-zinc-300">
                <CalendarIcon className="w-4 h-4 text-[#9aa5ff] shrink-0" />
                <span className="font-medium">
                  {selectedDateLabel
                    ? selectedDateLabel
                    : monthMatches.length > 0
                    ? `${MONTHS_LONG_ES[viewMonth]} ${viewYear}`
                    : `Encuentros filtrados (${filteredMatches.length})`}
                </span>
              </div>
              <span className="text-xs text-zinc-500 tabular-nums">
                {visibleDateGroups.reduce((acc, g) => acc + g.matches.length, 0)} visibles
              </span>
            </div>

            {visibleDateGroups.length === 0 ? (
              <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-8 text-center space-y-3">
                <p className="text-lg font-medium text-white">Sin partidos en esta vista</p>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  {selectedDateIso
                    ? `Sin encuentros registrados el ${selectedDateLabel}.`
                    : 'Prueba cambiando a "Todos" o ajustando los filtros.'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {selectedDateIso && (
                    <button
                      type="button"
                      onClick={() => setSelectedDateIso(null)}
                      className="px-4 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-medium cursor-pointer"
                    >
                      Todas las fechas
                    </button>
                  )}
                  {statusMode === 'PROGRAMADO' && matches.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserToggledStatus(true);
                        setStatusMode('ALL');
                        setSelectedDateIso(null);
                      }}
                      className="px-4 py-2 rounded-full bg-[#707ef9] hover:bg-[#5f6ef5] text-white text-xs font-medium cursor-pointer"
                    >
                      Ver todos ({matches.length})
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[540px] overflow-y-auto pr-1">
                {visibleDateGroups.map((group) => (
                  <div
                    key={group.fecha}
                    className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] overflow-hidden"
                  >
                    <div className="bg-white/[0.025] px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between gap-2">
                      <h3 className="text-xs font-medium text-zinc-200">{group.fullDateLabel}</h3>
                      <span className="text-[11px] text-zinc-500 tabular-nums">
                        {group.matches.length}{' '}
                        {group.matches.length === 1 ? 'partido' : 'partidos'}
                      </span>
                    </div>

                    <div className="divide-y divide-white/[0.06]">
                      {group.matches.map((match) => {
                        const home = teamMap.get(match.homeTeamId);
                        const away = teamMap.get(match.awayTeamId);
                        const disc = DISCIPLINE_MAP[match.disciplineId];
                        const revealData = shouldRevealPublicMatchData(match);
                        const votingOpen = canVoteMatchMvp(match);
                        const isKnockout = match.fase !== 'Grupos';
                        const rawPhaseBadge =
                          match.fase === 'Grupos' ? match.groupName : match.fase;
                        const phaseBadge =
                          rawPhaseBadge && rawPhaseBadge.trim() && rawPhaseBadge.trim() !== '-'
                            ? rawPhaseBadge.trim()
                            : '';

                        return (
                          <div
                            key={match.id}
                            className="p-4 hover:bg-white/[0.025] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1.5 min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                <span className="inline-flex items-center gap-1 text-zinc-300 tabular-nums">
                                  <Clock className="w-3 h-3 text-[#9aa5ff]" />
                                  {match.hora || 'Por confirmar'}
                                </span>
                                <span className="text-zinc-700" aria-hidden="true">·</span>
                                <span className="text-[#a5b0ff] font-medium">
                                  {disc.nombreCorto}
                                </span>
                                {phaseBadge && (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                      match.fase === 'Final' || match.fase === 'Tercer Lugar'
                                        ? 'bg-white text-[#050507]'
                                        : isKnockout
                                        ? 'bg-[#707ef9]/20 text-[#c7ceff]'
                                        : 'bg-white/[0.06] text-zinc-400'
                                    }`}
                                  >
                                    {phaseBadge}
                                  </span>
                                )}
                                {isKnockout &&
                                  (match.playoffLeg === 'IDA' || match.playoffLeg === 'VUELTA') && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/[0.1] text-zinc-200">
                                      {match.playoffLeg === 'IDA' ? 'Ida' : 'Vuelta'}
                                    </span>
                                  )}
                              </div>

                              <p className="text-sm sm:text-base font-medium text-white leading-snug">
                                <span>{home?.nombre ?? match.homeTeamId}</span>{' '}
                                <span className="text-zinc-500 font-editorial text-sm mx-1">vs</span>{' '}
                                <span>{away?.nombre ?? match.awayTeamId}</span>
                              </p>

                              <p className="text-xs text-zinc-500 flex items-center gap-1.5 truncate">
                                <MapPin className="w-3 h-3 text-zinc-600 shrink-0" />
                                <span className="truncate">{match.cancha || disc.sedePrincipal}</span>
                              </p>
                            </div>

                            <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                              {revealData ? (
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className="px-3 py-1 rounded-full bg-white/[0.08] border border-white/[0.1] text-white text-sm font-semibold tabular-nums">
                                    {match.homeScore} — {match.awayScore}
                                  </span>
                                  {match.penaltyScore && (
                                    <span className="text-[10px] font-mono text-[#a5b0ff] tabular-nums">
                                      Pen. {match.penaltyScore.home} — {match.penaltyScore.away}
                                    </span>
                                  )}
                                </div>
                              ) : votingOpen ? (
                                <span className="px-2.5 py-1 rounded-full bg-[#707ef9]/20 border border-[#707ef9]/35 text-[#c7ceff] text-[11px] font-medium inline-flex items-center gap-1">
                                  <Lock className="w-3 h-3" />
                                  <span>En juego</span>
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-zinc-400 text-[11px]">
                                  Programado
                                </span>
                              )}

                              <div className="flex items-center gap-3 text-xs">
                                <button
                                  type="button"
                                  onClick={() => onOpenMatchModal(match)}
                                  className="inline-flex items-center gap-1 text-zinc-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  {votingOpen ? (
                                    <>
                                      <Award className="w-3.5 h-3.5 text-[#9aa5ff]" />
                                      <span className="text-[#a5b0ff] font-medium">Votar MVP</span>
                                    </>
                                  ) : (
                                    <span>{revealData ? 'Resumen →' : 'Ficha →'}</span>
                                  )}
                                </button>
                                {isOfficial && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenMatchInReferee(match.id)}
                                    className="text-zinc-500 hover:text-white cursor-pointer whitespace-nowrap"
                                  >
                                    Arbitrar
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </RevealSection>
    </section>
  );
}
