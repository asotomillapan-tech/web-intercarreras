import type { DisciplineId, Match, MatchStatus } from '../types/tournament';

export interface CalendarFilterOptions {
  disciplineId: 'ALL' | DisciplineId;
  venue: 'ALL' | string;
  statusFilter: 'PROGRAMADO' | 'ALL' | MatchStatus;
}

export interface CalendarDateGroup {
  fecha: string;
  weekdayLabel: string;
  shortDateLabel: string;
  fullDateLabel: string;
  matches: Match[];
}

export interface CalendarDayCell {
  dateIso: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  matchCount: number;
  scheduledCount: number;
  liveCount: number;
  finalizedCount: number;
}

const WEEKDAYS_ES = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

const MONTHS_SHORT_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

export const MONTHS_LONG_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/**
 * Normalizes a match date string into canonical YYYY-MM-DD format.
 * Supports ISO (YYYY-MM-DD, YYYY/MM/DD) and Chilean/Sheets (DD/MM/YYYY, DD-MM-YYYY).
 */
export function normalizeMatchDateToIso(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // YYYY-MM-DD or YYYY/MM/DD (with optional trailing timestamp)
  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(trimmed);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return null;
  }

  // Chilean / Sheets format: DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(trimmed);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return null;
  }

  return null;
}

function parseIsoDateLocal(raw: string): { year: number; month: number; day: number } | null {
  const iso = normalizeMatchDateToIso(raw);
  if (!iso) return null;
  const [yStr, mStr, dStr] = iso.split('-');
  const year = Number(yStr);
  const month = Number(mStr) - 1;
  const day = Number(dStr);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function formatIsoDateParts(year: number, monthIndex: number, day: number): string {
  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function formatCalendarDateEs(dateIso: string): {
  weekdayLabel: string;
  shortDateLabel: string;
  fullDateLabel: string;
} {
  const parts = parseIsoDateLocal(dateIso);
  if (!parts) {
    return {
      weekdayLabel: 'Fecha',
      shortDateLabel: dateIso,
      fullDateLabel: dateIso,
    };
  }
  const dt = new Date(Date.UTC(parts.year, parts.month, parts.day, 12, 0, 0));
  const weekday = WEEKDAYS_ES[dt.getUTCDay()] ?? '';
  const monthShort = MONTHS_SHORT_ES[parts.month] ?? '';
  const monthLong = MONTHS_LONG_ES[parts.month] ?? '';
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return {
    weekdayLabel: capitalizedWeekday,
    shortDateLabel: `${String(parts.day).padStart(2, '0')} ${monthShort}`,
    fullDateLabel: `${capitalizedWeekday} ${parts.day} de ${monthLong.toLowerCase()} ${parts.year}`,
  };
}

/**
 * Extracts unique, trimmed, alphabetically sorted venue/sede names across matches.
 */
export function extractCalendarVenues(matches: Match[]): string[] {
  const set = new Set<string>();
  for (const m of matches) {
    const v = m.cancha?.trim();
    if (v) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
}

/**
 * Filters matches by discipline, venue (sede/cancha), and match status.
 */
export function filterCalendarMatches(
  matches: Match[],
  filters: CalendarFilterOptions
): Match[] {
  return matches.filter((m) => {
    if (filters.disciplineId !== 'ALL' && m.disciplineId !== filters.disciplineId) {
      return false;
    }
    if (filters.venue !== 'ALL' && m.cancha.trim() !== filters.venue) {
      return false;
    }
    if (filters.statusFilter !== 'ALL' && m.status !== filters.statusFilter) {
      return false;
    }
    return true;
  });
}

/**
 * Groups matches chronologically by YYYY-MM-DD date.
 * - 'newest' (default): most recent / upcoming scheduled dates first, latest hour first within a day (EN_VIVO prioritized).
 * - 'oldest': earliest dates first, earliest hour first within a day.
 */
export function groupMatchesByDate(
  matches: Match[],
  order: 'newest' | 'oldest' = 'newest'
): CalendarDateGroup[] {
  const map = new Map<string, Match[]>();

  for (const match of matches) {
    const key = normalizeMatchDateToIso(match.fecha) || match.fecha?.trim() || 'Sin fecha';
    const list = map.get(key) ?? [];
    list.push(match);
    map.set(key, list);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => (order === 'newest' ? b.localeCompare(a) : a.localeCompare(b)))
    .map(([fecha, list]) => {
      const sortedMatches = [...list].sort((a, b) => {
        if (order === 'newest') {
          const liveA = a.status === 'EN_VIVO' ? 1 : 0;
          const liveB = b.status === 'EN_VIVO' ? 1 : 0;
          if (liveA !== liveB) return liveB - liveA;
        }
        const timeA = (a.hora || '').padStart(5, '0');
        const timeB = (b.hora || '').padStart(5, '0');
        const timeCmp = order === 'newest' ? timeB.localeCompare(timeA) : timeA.localeCompare(timeB);
        if (timeCmp !== 0) return timeCmp;
        const discCmp = a.disciplineId.localeCompare(b.disciplineId);
        if (discCmp !== 0) return discCmp;
        return a.id.localeCompare(b.id);
      });
      const labels = formatCalendarDateEs(fecha);
      return {
        fecha,
        ...labels,
        matches: sortedMatches,
      };
    });
}

/**
 * Generates a 7-column Monday-first calendar grid (35 or 42 cells) with per-day match counts.
 */
export function buildCalendarMonthGrid(
  year: number,
  monthIndex: number,
  matches: Match[]
): CalendarDayCell[] {
  const countsByDate = new Map<
    string,
    { total: number; scheduled: number; live: number; finalized: number }
  >();

  for (const m of matches) {
    const key = normalizeMatchDateToIso(m.fecha);
    if (!key) continue;
    const prev = countsByDate.get(key) ?? { total: 0, scheduled: 0, live: 0, finalized: 0 };
    prev.total += 1;
    if (m.status === 'PROGRAMADO') prev.scheduled += 1;
    else if (m.status === 'EN_VIVO') prev.live += 1;
    else prev.finalized += 1;
    countsByDate.set(key, prev);
  }

  const firstDayUtc = new Date(Date.UTC(year, monthIndex, 1, 12, 0, 0));
  // Convert Sunday=0..Saturday=6 into Monday=0..Sunday=6
  const startWeekdayMon = (firstDayUtc.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0, 12, 0, 0)).getUTCDate();
  const totalCells = startWeekdayMon + daysInMonth > 35 ? 42 : 35;

  const cells: CalendarDayCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - startWeekdayMon + 1;
    const cellDate = new Date(Date.UTC(year, monthIndex, dayOffset, 12, 0, 0));
    const cellYear = cellDate.getUTCFullYear();
    const cellMonth = cellDate.getUTCMonth();
    const cellDay = cellDate.getUTCDate();
    const dateIso = formatIsoDateParts(cellYear, cellMonth, cellDay);
    const stats = countsByDate.get(dateIso);

    cells.push({
      dateIso,
      dayNumber: cellDay,
      inCurrentMonth: cellYear === year && cellMonth === monthIndex,
      matchCount: stats?.total ?? 0,
      scheduledCount: stats?.scheduled ?? 0,
      liveCount: stats?.live ?? 0,
      finalizedCount: stats?.finalized ?? 0,
    });
  }

  return cells;
}

/**
 * Selects the best initial month to display in the calendar:
 * 1) Earliest upcoming PROGRAMADO or EN_VIVO match date
 * 2) Otherwise most recent match date
 * 3) Otherwise fallback date (default today)
 */
export function pickInitialCalendarMonth(
  matches: Match[],
  fallbackDateIso?: string
): { year: number; monthIndex: number } {
  const activeOrScheduled = matches
    .map((m) => ({ m, iso: normalizeMatchDateToIso(m.fecha) }))
    .filter((entry): entry is { m: Match; iso: string } =>
      Boolean(entry.iso) && (entry.m.status === 'PROGRAMADO' || entry.m.status === 'EN_VIVO')
    )
    .sort((a, b) => a.iso.localeCompare(b.iso));

  if (activeOrScheduled.length > 0) {
    const parts = parseIsoDateLocal(activeOrScheduled[0].iso)!;
    return { year: parts.year, monthIndex: parts.month };
  }

  const dated = matches
    .map((m) => ({ m, iso: normalizeMatchDateToIso(m.fecha) }))
    .filter((entry): entry is { m: Match; iso: string } => Boolean(entry.iso))
    .sort((a, b) => b.iso.localeCompare(a.iso));

  if (dated.length > 0) {
    const parts = parseIsoDateLocal(dated[0].iso)!;
    return { year: parts.year, monthIndex: parts.month };
  }

  if (fallbackDateIso) {
    const parsed = parseIsoDateLocal(fallbackDateIso);
    if (parsed) return { year: parsed.year, monthIndex: parsed.month };
  }

  const now = new Date();
  return { year: now.getFullYear(), monthIndex: now.getMonth() };
}
