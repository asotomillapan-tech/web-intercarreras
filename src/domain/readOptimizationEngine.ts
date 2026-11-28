import type { DisciplineId, Player, Team } from '../types/tournament';
import type { NavSection } from '../components/Navbar';
import { normalizeTextToken, type UnifiedPlayerProfile } from './identityCrossRefEngine';

/** Strictly show at most 10 players on the initial /jugadores directory view */
export const PLAYERS_PREVIEW_LIMIT = 10;

/** Curated teams displayed directly beneath the 10-player preview */
export const FEATURED_TEAMS_PREVIEW_COUNT = 8;

/** Maximum search results rendered in public player directory without team selection */
export const PLAYERS_SEARCH_DISPLAY_CAP = 30;

/** Fresh TTL for core public collections (settings, configs, teams, matches) */
export const PUBLIC_CORE_CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

/** Fresh TTL for lazy per-section collections (news, photos, transfers, votes, leyendas) */
export const SECTION_CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

/** Fresh TTL for per-team roster fetches so re-selecting a team costs 0 Firestore reads */
export const TEAM_ROSTER_CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes

export type LazyCollectionKey =
  | 'news'
  | 'playersPreview'
  | 'photos'
  | 'transfers'
  | 'leyendasLeaderboard'
  | 'votingSecondary';

/**
 * Maps each navigation route to ONLY the secondary Firestore collections it actually
 * needs, avoiding bulk loading of unrelated collections on initial page load.
 */
export function getLazyCollectionsForSection(section: NavSection): LazyCollectionKey[] {
  switch (section) {
    case 'inicio':
      return ['news'];
    case 'jugadores':
      return ['playersPreview'];
    case 'votaciones':
      return ['votingSecondary'];
    case 'minijuegos':
      return ['leyendasLeaderboard'];
    case 'galeria':
      return ['photos'];
    case 'transferencias':
    case 'transferencias-publicas':
      return ['transfers'];
    case 'panel':
      return ['news', 'transfers', 'photos', 'votingSecondary'];
    case 'posiciones':
    case 'equipos':
    case 'inscripciones':
    case 'cuenta':
    case 'privacidad':
    default:
      return [];
  }
}

/**
 * Checks whether a timestamped cache entry is still within its freshness window.
 */
export function isCacheTimestampFresh(
  savedAtMs: number | null | undefined,
  nowMs: number = Date.now(),
  ttlMs: number = SECTION_CACHE_TTL_MS
): boolean {
  if (typeof savedAtMs !== 'number' || !Number.isFinite(savedAtMs)) return false;
  const age = nowMs - savedAtMs;
  return age >= 0 && age < ttlMs;
}

/**
 * Merges lazily loaded player records (preview, single-team roster, or targeted search)
 * into the existing in-memory player cache without discarding other loaded teams
 * and while preserving any authorized PII already hydrated for staff/delegates/players.
 */
export function mergeLazyPlayersPreservingPii(
  prevPlayers: Player[],
  incomingPlayers: Player[]
): Player[] {
  if (incomingPlayers.length === 0) return prevPlayers;
  if (prevPlayers.length === 0) return incomingPlayers;

  const byId = new Map<string, Player>();
  for (const prev of prevPlayers) {
    byId.set(prev.id, prev);
  }

  for (const incoming of incomingPlayers) {
    const existing = byId.get(incoming.id);
    if (!existing) {
      byId.set(incoming.id, incoming);
      continue;
    }
    byId.set(incoming.id, {
      ...incoming,
      rut: incoming.rut || existing.rut,
      numeroMatricula: incoming.numeroMatricula || existing.numeroMatricula,
      correoInstitucional: incoming.correoInstitucional || existing.correoInstitucional,
      fechaNacimiento: incoming.fechaNacimiento || existing.fechaNacimiento,
    });
  }

  return Array.from(byId.values());
}

function toTitleCaseWord(word: string): string {
  if (!word) return '';
  return word.charAt(0).toLocaleUpperCase('es-CL') + word.slice(1).toLocaleLowerCase('es-CL');
}

/**
 * Produces compact equality candidates for index-free Firestore `where('nombre', '==', ...)`
 * and `where('apellidoPaterno', '==', ...)` queries (no composite index needed).
 */
export function buildFirestoreNameEqualityCandidates(rawQuery: string): string[] {
  const cleaned = rawQuery.trim().replace(/\s+/g, ' ');
  if (cleaned.length < 2) return [];

  const tokens = cleaned
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 2);

  const candidates = new Set<string>();
  for (const token of tokens) {
    candidates.add(toTitleCaseWord(token));
    candidates.add(token.toLocaleUpperCase('es-CL'));
    if (token !== toTitleCaseWord(token) && token !== token.toLocaleUpperCase('es-CL')) {
      candidates.add(token);
    }
  }

  return Array.from(candidates).slice(0, 4);
}

export interface DirectorySliceResult {
  profiles: UnifiedPlayerProfile[];
  isPreviewCapped: boolean;
  totalMatchedInCache: number;
}

/**
 * Computes the exact list of player profiles to display on /jugadores:
 * - When a team is selected: ONLY players belonging to that team (full team roster).
 * - When searching or filtering (no team selected): filtered matches capped cleanly.
 * - Default view (no team, no search, no extra filters): strictly at most 10 players.
 */
export function slicePlayersForDirectoryView(params: {
  matchedProfiles: UnifiedPlayerProfile[];
  selectedTeamId: string | null;
  hasActiveSearchOrFilter: boolean;
  previewLimit?: number;
  searchCap?: number;
}): DirectorySliceResult {
  const {
    matchedProfiles,
    selectedTeamId,
    hasActiveSearchOrFilter,
    previewLimit = PLAYERS_PREVIEW_LIMIT,
    searchCap = PLAYERS_SEARCH_DISPLAY_CAP,
  } = params;

  if (selectedTeamId) {
    const teamOnly = matchedProfiles.filter((profile) =>
      profile.participations.some((part) => part.player.teamId === selectedTeamId)
    );
    return {
      profiles: teamOnly,
      isPreviewCapped: false,
      totalMatchedInCache: teamOnly.length,
    };
  }

  if (hasActiveSearchOrFilter) {
    return {
      profiles: matchedProfiles.slice(0, searchCap),
      isPreviewCapped: matchedProfiles.length > searchCap,
      totalMatchedInCache: matchedProfiles.length,
    };
  }

  return {
    profiles: matchedProfiles.slice(0, previewLimit),
    isPreviewCapped: matchedProfiles.length > previewLimit,
    totalMatchedInCache: matchedProfiles.length,
  };
}

/**
 * Filters teams for the quick-select strip and team search bar below the 10-player preview.
 */
export function filterTeamsForQuickSelect(
  teams: Team[],
  options: {
    query: string;
    disciplineFilter?: 'ALL' | DisciplineId;
    maxPreviewCount?: number;
    maxSearchResults?: number;
  }
): { teams: Team[]; totalMatching: number; isFiltered: boolean } {
  const {
    query,
    disciplineFilter = 'ALL',
    maxPreviewCount = FEATURED_TEAMS_PREVIEW_COUNT,
    maxSearchResults = 24,
  } = options;

  const scoped =
    disciplineFilter === 'ALL'
      ? teams
      : teams.filter((t) => t.disciplineId === disciplineFilter);

  const normalizedQuery = normalizeTextToken(query);
  const terms = normalizedQuery ? normalizedQuery.split(' ') : [];

  const matched =
    terms.length === 0
      ? [...scoped].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      : scoped
          .filter((t) => {
            const hay = normalizeTextToken(
              `${t.nombre} ${t.sigla} ${t.carrera} ${t.facultad} ${t.groupName} ${t.clubName ?? ''}`
            );
            return terms.every((tok) => hay.includes(tok));
          })
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const isFiltered = terms.length > 0 || disciplineFilter !== 'ALL';
  const limit = terms.length > 0 ? maxSearchResults : maxPreviewCount;

  return {
    teams: matched.slice(0, limit),
    totalMatching: matched.length,
    isFiltered,
  };
}
