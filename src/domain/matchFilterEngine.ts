import type { DisciplineId, Match, MatchPhase } from '../types/tournament';

export const MATCH_STAGE_ORDER: MatchPhase[] = [
  'Grupos',
  'Octavos',
  'Cuartos',
  'Semifinal',
  'Tercer Lugar',
  'Final',
];

export type MatchGroupByMode = 'none' | 'disciplina' | 'grupo' | 'fase';

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
