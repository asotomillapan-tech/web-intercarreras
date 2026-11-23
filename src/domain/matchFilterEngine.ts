import type { DisciplineId, Match, MatchPhase } from '../types/tournament';
import { normalizeMatchDateToIso } from './calendarEngine';

export const MATCH_STAGE_ORDER: MatchPhase[] = [
  'Grupos',
  'Octavos',
  'Cuartos',
  'Semifinal',
  'Tercer Lugar',
  'Final',
];

export type MatchGroupByMode = 'none' | 'disciplina' | 'grupo' | 'fase';

export type MatchSortOrder = 'newest' | 'oldest';

export interface MatchOrgFilter {
  disciplineId?: 'ALL' | DisciplineId;
  groupName?: 'ALL' | string;
  fase?: 'ALL' | MatchPhase;
}

export interface MatchOrgSection {
  key: string;
  label: string;
  matches: Match[];
}

function normalizeGroupLabel(raw: string | undefined | null): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed || trimmed === '-') return '';
  return trimmed;
}

/**
 * Extracts unique, naturally sorted group names from matches (optionally scoped by discipline and stage).
 */
export function extractMatchGroups(
  matches: Match[],
  options?: { disciplineId?: 'ALL' | DisciplineId; fase?: 'ALL' | MatchPhase }
): string[] {
  const set = new Set<string>();
  for (const m of matches) {
    if (options?.disciplineId && options.disciplineId !== 'ALL' && m.disciplineId !== options.disciplineId) {
      continue;
    }
    if (options?.fase && options.fase !== 'ALL' && m.fase !== options.fase) {
      continue;
    }
    const g = normalizeGroupLabel(m.groupName);
    if (g) set.add(g);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
}

/**
 * Extracts unique tournament stages present in matches (ordered by canonical tournament progression).
 */
export function extractMatchStages(
  matches: Match[],
  options?: { disciplineId?: 'ALL' | DisciplineId; groupName?: 'ALL' | string }
): MatchPhase[] {
  const present = new Set<MatchPhase>();
  for (const m of matches) {
    if (options?.disciplineId && options.disciplineId !== 'ALL' && m.disciplineId !== options.disciplineId) {
      continue;
    }
    if (
      options?.groupName &&
      options.groupName !== 'ALL' &&
      normalizeGroupLabel(m.groupName) !== options.groupName
    ) {
      continue;
    }
    if (m.fase) present.add(m.fase);
  }
  return MATCH_STAGE_ORDER.filter((stage) => present.has(stage));
}

/**
 * Filters a list of matches by discipline, group name, and tournament stage.
 */
export function filterMatchesByOrg(matches: Match[], filter: MatchOrgFilter): Match[] {
  return matches.filter((m) => {
    if (filter.disciplineId && filter.disciplineId !== 'ALL' && m.disciplineId !== filter.disciplineId) {
      return false;
    }
    if (
      filter.groupName &&
      filter.groupName !== 'ALL' &&
      normalizeGroupLabel(m.groupName) !== filter.groupName
    ) {
      return false;
    }
    if (filter.fase && filter.fase !== 'ALL' && m.fase !== filter.fase) {
      return false;
    }
    return true;
  });
}

/**
 * Groups matches cleanly by discipline, group, or stage in canonical order.
 */
export function groupMatchesByOrg(
  matches: Match[],
  mode: MatchGroupByMode,
  disciplineLabels?: Partial<Record<DisciplineId, string>>,
  disciplineOrder?: DisciplineId[]
): MatchOrgSection[] {
  if (mode === 'none') {
    return matches.length > 0 ? [{ key: 'all', label: 'Todos los encuentros', matches }] : [];
  }

  const buckets = new Map<string, { label: string; matches: Match[] }>();

  for (const m of matches) {
    let key: string;
    let label: string;

    if (mode === 'disciplina') {
      key = m.disciplineId;
      label = disciplineLabels?.[m.disciplineId] ?? m.disciplineId;
    } else if (mode === 'fase') {
      key = m.fase || 'Grupos';
      label = m.fase === 'Grupos' ? 'Fase de Grupos' : m.fase;
    } else {
      const normalized = normalizeGroupLabel(m.groupName);
      key = normalized || (m.fase !== 'Grupos' ? m.fase : 'Sin grupo');
      label = key;
    }

    const existing = buckets.get(key);
    if (existing) {
      existing.matches.push(m);
    } else {
      buckets.set(key, { label, matches: [m] });
    }
  }

  const entries = Array.from(buckets.entries());

  if (mode === 'fase') {
    entries.sort(([a], [b]) => {
      const idxA = MATCH_STAGE_ORDER.indexOf(a as MatchPhase);
      const idxB = MATCH_STAGE_ORDER.indexOf(b as MatchPhase);
      const rankA = idxA === -1 ? 99 : idxA;
      const rankB = idxB === -1 ? 99 : idxB;
      return rankA - rankB;
    });
  } else if (mode === 'disciplina' && disciplineOrder) {
    entries.sort(([a], [b]) => {
      const idxA = disciplineOrder.indexOf(a as DisciplineId);
      const idxB = disciplineOrder.indexOf(b as DisciplineId);
      const rankA = idxA === -1 ? 99 : idxA;
      const rankB = idxB === -1 ? 99 : idxB;
      return rankA - rankB;
    });
  } else {
    entries.sort(([, a], [, b]) => a.label.localeCompare(b.label, 'es', { numeric: true }));
  }

  return entries.map(([key, bucket]) => ({
    key,
    label: bucket.label,
    matches: bucket.matches,
  }));
}

export interface MatchFilterFacets {
  totalCount: number;
  matchingCount: number;
  disciplineCounts: Partial<Record<DisciplineId, number>>;
  groupCounts: Record<string, number>;
  stageCounts: Partial<Record<MatchPhase, number>>;
  availableGroups: string[];
  availableStages: MatchPhase[];
}

/**
 * Computes simultaneous faceted counts so Disciplina, Grupo, and Fase dropdowns
 * reflect real match counts under the other active selections.
 */
export function computeMatchFilterFacets(
  matches: Match[],
  active: MatchOrgFilter
): MatchFilterFacets {
  const disc = active.disciplineId ?? 'ALL';
  const group = active.groupName ?? 'ALL';
  const fase = active.fase ?? 'ALL';

  const availableGroups = extractMatchGroups(matches, { disciplineId: disc });
  const effectiveGroup = group !== 'ALL' && availableGroups.includes(group) ? group : 'ALL';

  const disciplineCounts: Partial<Record<DisciplineId, number>> = {};
  const groupCounts: Record<string, number> = {};
  const stageCounts: Partial<Record<MatchPhase, number>> = {};

  let matchingCount = 0;

  for (const m of matches) {
    const gLabel = normalizeGroupLabel(m.groupName);
    const matchDisc = disc === 'ALL' || m.disciplineId === disc;
    const matchGroup = effectiveGroup === 'ALL' || gLabel === effectiveGroup;
    const matchStage = fase === 'ALL' || m.fase === fase;

    // Discipline facet: respects active stage (and group if matching)
    if (matchStage && (effectiveGroup === 'ALL' || gLabel === effectiveGroup)) {
      disciplineCounts[m.disciplineId] = (disciplineCounts[m.disciplineId] ?? 0) + 1;
    }

    // Group facet: respects active discipline & stage
    if (matchDisc && matchStage && gLabel) {
      groupCounts[gLabel] = (groupCounts[gLabel] ?? 0) + 1;
    }

    // Stage facet: respects active discipline & group
    if (matchDisc && matchGroup && m.fase) {
      stageCounts[m.fase] = (stageCounts[m.fase] ?? 0) + 1;
    }

    if (matchDisc && matchGroup && matchStage) {
      matchingCount += 1;
    }
  }

  return {
    totalCount: matches.length,
    matchingCount,
    disciplineCounts,
    groupCounts,
    stageCounts,
    availableGroups,
    availableStages: MATCH_STAGE_ORDER,
  };
}

function normalizeTimeSortable(hora: string | undefined | null): string {
  const raw = (hora ?? '').trim();
  const match = /^(\d{1,2}):(\d{2})/.exec(raw);
  if (!match) return '00:00';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function getMatchChronologicalKey(match: Match): string {
  const isoDate = normalizeMatchDateToIso(match.fecha) ?? '0000-00-00';
  const time = normalizeTimeSortable(match.hora);
  return `${isoDate}T${time}`;
}

/**
 * Sorts matches chronologically.
 * - 'newest' (default): EN_VIVO first, then most recent / upcoming scheduled date-time descending down to oldest.
 * - 'oldest': earliest date-time ascending up to newest / upcoming scheduled.
 */
export function sortMatchesChronologically(
  matches: Match[],
  order: MatchSortOrder = 'newest'
): Match[] {
  return [...matches].sort((a, b) => {
    if (order === 'newest') {
      const liveA = a.status === 'EN_VIVO' ? 1 : 0;
      const liveB = b.status === 'EN_VIVO' ? 1 : 0;
      if (liveA !== liveB) return liveB - liveA;
    }

    const keyA = getMatchChronologicalKey(a);
    const keyB = getMatchChronologicalKey(b);
    const cmp = order === 'newest' ? keyB.localeCompare(keyA) : keyA.localeCompare(keyB);
    if (cmp !== 0) return cmp;

    const jCmp = order === 'newest' ? (b.jornada ?? 0) - (a.jornada ?? 0) : (a.jornada ?? 0) - (b.jornada ?? 0);
    if (jCmp !== 0) return jCmp;

    return a.id.localeCompare(b.id);
  });
}

