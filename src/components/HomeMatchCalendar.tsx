import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Lock,
  MapPin,
  RotateCcw,
} from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
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
  canRefereeMatches,
  canVoteMatchMvp,
  shouldRevealPublicMatchData,
} from '../domain/rbacEngine';
import type {
  AppUserProfile,
  DisciplineId,
  Match,
  Team,
} from '../types/tournament';

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
  const [venueFilter, setVenueFilter] = useState<'ALL' | string>('ALL');
  const [statusMode, setStatusMode] = useState<'PROGRAMADO' | 'ALL'>('PROGRAMADO');
  const [userToggledStatus, setUserToggledStatus] = useState(false);
  const [selectedDateIso, setSelectedDateIso] = useState<string | null>(null);

  const initialMonth = useMemo(() => pickInitialCalendarMonth(matches), [matches]);
  const [viewYear, setViewYear] = useState(initialMonth.year);
  const [viewMonth, setViewMonth] = useState(initialMonth.monthIndex);
  const [userNavigatedMonth, setUserNavigatedMonth] = useState(false);

  // Keep initial month & status aligned when cloud matches hydrate asynchronously
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

  const venues = useMemo(() => {
    const scope =
      disciplineFilter === 'ALL'
        ? matches
        : matches.filter((m) => m.disciplineId === disciplineFilter);
    return extractCalendarVenues(scope);
  }, [matches, disciplineFilter]);

  // Reset venue if selected venue no longer exists under the chosen discipline
  useEffect(() => {
    if (venueFilter !== 'ALL' && !venues.includes(venueFilter)) {
      setVenueFilter('ALL');
    }
  }, [venueFilter, venues]);

  const filteredMatches = useMemo(
    () =>
      filterCalendarMatches(matches, {
        disciplineId: disciplineFilter,
        venue: venueFilter,
        statusFilter: statusMode,
      }),
    [matches, disciplineFilter, venueFilter, statusMode]
  );

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
      return groupMatchesByDate(dayMatches);
    }
    if (monthMatches.length > 0) {
      return groupMatchesByDate(monthMatches);
    }
    return groupMatchesByDate(filteredMatches);
  }, [selectedDateIso, filteredMatches, monthMatches]);

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
    setVenueFilter('ALL');
    setSelectedDateIso(null);
    setUserToggledStatus(false);
    setStatusMode(hasAnyScheduled ? 'PROGRAMADO' : 'ALL');
    setUserNavigatedMonth(false);
    setViewYear(initialMonth.year);
    setViewMonth(initialMonth.monthIndex);
  };

  const hasActiveFilters =
    disciplineFilter !== 'ALL' || venueFilter !== 'ALL' || selectedDateIso !== null;

  const selectedDateLabel = selectedDateIso
    ? formatCalendarDateEs(selectedDateIso).fullDateLabel
    : null;

  return (
    <section
      aria-labelledby="home-calendar-heading"
      className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-14 border-b border-neutral-200"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-medium text-[#707ef9] uppercase tracking-widest">
            Programación Oficial · Temporada {temporada}
          </p>
          <h2
            id="home-calendar-heading"
            className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#0d0d0d] mt-1"
          >
            Calendario de Partidos
          </h2>
          <p className="text-sm text-neutral-600 mt-1">
            Explora los encuentros por fecha, filtra por disciplina o sede deportiva y accede a cada
            ficha oficial.
          </p>
        </div>

        {/* Status Toggle: Programados vs Todos */}
        <div className="flex items-center gap-1 bg-[#f5f6f8] border border-neutral-200 p-1 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => {
              setUserToggledStatus(true);
              setStatusMode('PROGRAMADO');
              setSelectedDateIso(null);
            }}
            className={`px-3.5 py-2 text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap ${
              statusMode === 'PROGRAMADO'
                ? 'bg-[#0d0d0d] text-white'
                : 'text-neutral-600 hover:text-[#0d0d0d]'
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
            className={`px-3.5 py-2 text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap ${
              statusMode === 'ALL'
                ? 'bg-[#707ef9] text-white'
                : 'text-neutral-600 hover:text-[#0d0d0d]'
            }`}
          >
            Todos ({matches.length})
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-[#f5f6f8] border border-neutral-200 p-4 mb-6 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-5">
          <label
            htmlFor="cal-filter-discipline"
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-600 mb-1.5"
          >
            <Filter className="w-3.5 h-3.5 text-[#707ef9]" />
            <span>Disciplina</span>
          </label>
          <select
            id="cal-filter-discipline"
            value={disciplineFilter}
            onChange={(e) => {
              setDisciplineFilter(e.target.value as 'ALL' | DisciplineId);
              setSelectedDateIso(null);
            }}
            className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm text-[#0d0d0d] font-medium focus:outline-none focus:border-[#707ef9]"
          >
            <option value="ALL">Todas las disciplinas ({DISCIPLINES.length})</option>
            {DISCIPLINES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-5">
          <label
            htmlFor="cal-filter-venue"
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-600 mb-1.5"
          >
            <MapPin className="w-3.5 h-3.5 text-[#707ef9]" />
            <span>Sede / Cancha</span>
          </label>
          <select
            id="cal-filter-venue"
            value={venueFilter}
            onChange={(e) => {
              setVenueFilter(e.target.value);
              setSelectedDateIso(null);
            }}
            className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm text-[#0d0d0d] font-medium focus:outline-none focus:border-[#707ef9]"
          >
            <option value="ALL">Todas las sedes ({venues.length})</option>
            {venues.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleResetFilters}
            disabled={!hasActiveFilters}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-neutral-300 hover:border-[#0d0d0d] text-xs font-medium text-[#0d0d0d] cursor-pointer disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpiar</span>
          </button>
        </div>
      </div>

      {/* Main 12-Col Split: Monthly Calendar Grid + Chronological Date Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 5 cols: Interactive Month Calendar */}
        <div className="lg:col-span-5 border border-neutral-200 bg-white">
          <div className="bg-[#0d0d0d] text-white px-4 py-3.5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Mes anterior"
              className="p-1.5 hover:bg-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center">
              <p className="font-display text-xl font-bold uppercase tracking-wider">
                {MONTHS_LONG_ES[viewMonth]} {viewYear}
              </p>
              <p className="text-[11px] text-neutral-400 tabular-nums">
                {monthMatches.length}{' '}
                {monthMatches.length === 1 ? 'encuentro este mes' : 'encuentros este mes'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Mes siguiente"
              className="p-1.5 hover:bg-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-neutral-200 bg-[#f5f6f8]">
            {WEEKDAY_HEADERS.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-neutral-200">
            {monthCells.map((cell) => {
              const isSelected = selectedDateIso === cell.dateIso;
              const hasMatches = cell.matchCount > 0;
              return (
                <button
                  key={cell.dateIso}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setSelectedDateIso(null);
                    } else {
                      setSelectedDateIso(cell.dateIso);
                    }
                  }}
                  aria-label={`${cell.dateIso}, ${cell.matchCount} partidos`}
                  aria-pressed={isSelected}
                  className={`min-h-[58px] p-1.5 flex flex-col items-center justify-between transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-[#0d0d0d] text-white'
                      : cell.inCurrentMonth
                      ? hasMatches
                        ? 'bg-white hover:bg-[#707ef9]/10 text-[#0d0d0d]'
                        : 'bg-white hover:bg-[#f5f6f8] text-neutral-600'
                      : 'bg-[#f9fafb] text-neutral-400 hover:bg-neutral-100'
                  }`}
                >
                  <span
                    className={`text-xs tabular-nums ${
                      isSelected
                        ? 'font-bold text-white'
                        : hasMatches
                        ? 'font-bold text-[#0d0d0d]'
                        : ''
                    }`}
                  >
                    {cell.dayNumber}
                  </span>

                  {hasMatches ? (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none ${
                        isSelected
                          ? 'bg-[#707ef9] text-white'
                          : cell.liveCount > 0 || cell.scheduledCount > 0
                          ? 'bg-[#707ef9] text-white'
                          : 'bg-[#0d0d0d] text-white'
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

          <div className="px-4 py-3 bg-[#f5f6f8] border-t border-neutral-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-600">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#707ef9] inline-block" aria-hidden="true" />
                <span>Programado / En vivo</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#0d0d0d] inline-block" aria-hidden="true" />
                <span>Finalizado</span>
              </span>
            </div>
            {selectedDateIso && (
              <button
                type="button"
                onClick={() => setSelectedDateIso(null)}
                className="text-[#707ef9] hover:text-[#0d0d0d] font-bold uppercase tracking-wider cursor-pointer"
              >
                Ver todo el mes
              </button>
            )}
          </div>
        </div>

        {/* Right 7 cols: Chronological Schedule List by Date */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-neutral-200">
            <div className="flex items-center gap-2 text-xs text-neutral-600">
              <CalendarIcon className="w-4 h-4 text-[#707ef9] shrink-0" />
              <span className="font-bold uppercase tracking-wider text-[#0d0d0d]">
                {selectedDateLabel
                  ? selectedDateLabel
                  : monthMatches.length > 0
                  ? `Agenda de ${MONTHS_LONG_ES[viewMonth]} ${viewYear}`
                  : `Todos los encuentros filtrados (${filteredMatches.length})`}
              </span>
            </div>
            <span className="text-xs text-neutral-500 tabular-nums">
              {visibleDateGroups.reduce((acc, g) => acc + g.matches.length, 0)} partidos visibles
            </span>
          </div>

          {visibleDateGroups.length === 0 ? (
            <div className="border border-neutral-200 bg-[#f5f6f8] p-8 text-center space-y-3">
              <p className="font-display text-2xl font-bold uppercase text-[#0d0d0d]">
                Sin partidos para esta selección
              </p>
              <p className="text-xs text-neutral-600 max-w-md mx-auto">
                {selectedDateIso
                  ? `No hay encuentros registrados el ${selectedDateLabel} con los filtros activos.`
                  : statusMode === 'PROGRAMADO'
                  ? 'No hay encuentros programados con los filtros actuales. Puedes cambiar a "Todos" para consultar resultados recientes.'
                  : 'Ajusta el filtro de disciplina o sede para explorar otros encuentros del campeonato.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                {selectedDateIso && (
                  <button
                    type="button"
                    onClick={() => setSelectedDateIso(null)}
                    className="px-4 py-2 bg-[#0d0d0d] hover:bg-[#707ef9] text-white font-display font-bold uppercase tracking-widest text-xs cursor-pointer"
                  >
                    Ver todas las fechas
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
                    className="px-4 py-2 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-xs cursor-pointer"
                  >
                    Ver todos los partidos ({matches.length})
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-h-[540px] overflow-y-auto pr-1">
              {visibleDateGroups.map((group) => (
                <div key={group.fecha} className="border border-neutral-200 bg-white">
                  <div className="bg-[#f5f6f8] px-4 py-2.5 border-b border-neutral-200 flex items-center justify-between gap-2">
                    <h3 className="font-display text-base font-bold uppercase tracking-wide text-[#0d0d0d]">
                      {group.fullDateLabel}
                    </h3>
                    <span className="text-[11px] text-neutral-500 tabular-nums">
                      {group.matches.length}{' '}
                      {group.matches.length === 1 ? 'partido' : 'partidos'}
                    </span>
                  </div>

                  <div className="divide-y divide-neutral-200">
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
                          className="p-4 hover:bg-[#f9fafb] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                              <span className="inline-flex items-center gap-1 font-bold text-[#0d0d0d] tabular-nums">
                                <Clock className="w-3 h-3 text-[#707ef9]" />
                                {match.hora || 'Por confirmar'}
                              </span>
                              <span className="text-neutral-300" aria-hidden="true">
                                ·
                              </span>
                              <span className="font-bold text-[#707ef9] uppercase tracking-wider">
                                {disc.nombreCorto}
                              </span>
                              {phaseBadge && (
                                <span
                                  className={`px-1.5 py-0.5 text-[10px] font-display font-bold uppercase tracking-wider ${
                                    match.fase === 'Final' || match.fase === 'Tercer Lugar'
                                      ? 'bg-[#0d0d0d] text-white'
                                      : isKnockout
                                      ? 'bg-[#707ef9]/15 text-[#4250d6]'
                                      : 'bg-[#f5f6f8] text-neutral-600'
                                  }`}
                                >
                                  {phaseBadge}
                                </span>
                              )}
                            </div>

                            <p className="font-display text-lg font-bold uppercase tracking-wide text-[#0d0d0d] leading-snug">
                              <span>{home?.nombre ?? match.homeTeamId}</span>{' '}
                              <span className="text-neutral-400 font-sans text-xs mx-1">vs</span>{' '}
                              <span>{away?.nombre ?? match.awayTeamId}</span>
                            </p>

                            <p className="text-xs text-neutral-500 flex items-center gap-1.5 truncate">
                              <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                              <span className="truncate">{match.cancha || disc.sedePrincipal}</span>
                            </p>
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                            {revealData ? (
                              <span className="px-2.5 py-1 bg-[#0d0d0d] text-white font-display text-lg font-bold tabular-nums">
                                {match.homeScore} — {match.awayScore}
                              </span>
                            ) : votingOpen ? (
                              <span className="px-2.5 py-1 bg-[#707ef9]/10 border border-[#707ef9]/40 text-[#707ef9] text-[11px] font-display font-bold uppercase tracking-wider inline-flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                <span>En horario</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-[#f5f6f8] border border-neutral-200 text-neutral-700 text-[11px] font-display font-bold uppercase tracking-wider">
                                Programado
                              </span>
                            )}

                            <div className="flex items-center gap-3 text-xs">
                              <button
                                type="button"
                                onClick={() => onOpenMatchModal(match)}
                                className="inline-flex items-center gap-1 font-medium text-[#0d0d0d] hover:text-[#707ef9] cursor-pointer whitespace-nowrap"
                              >
                                {votingOpen ? (
                                  <>
                                    <Award className="w-3.5 h-3.5 text-[#707ef9]" />
                                    <span className="text-[#707ef9] font-bold">Votar MVP</span>
                                  </>
                                ) : (
                                  <span>{revealData ? 'Ver resultado →' : 'Ver ficha →'}</span>
                                )}
                              </button>
                              {isOfficial && (
                                <button
                                  type="button"
                                  onClick={() => onOpenMatchInReferee(match.id)}
                                  className="text-neutral-500 hover:text-[#0d0d0d] font-medium cursor-pointer whitespace-nowrap"
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
    </section>
  );
}
