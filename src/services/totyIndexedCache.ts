import { DISCIPLINES } from '../data/ufroSeed';
import type {
  DisciplineId,
  DisciplineTotyConfig,
  TotyBallotRecord,
} from '../types/tournament';

export const TOTY_CACHE_INDEX_KEY = 'ufro_toty_cache_index_v1';
export const TOTY_DISCIPLINE_KEY_PREFIX = 'ufro_toty_disc_v1_';

/** Freshness window where navigating voting tabs serves directly from localStorage with 0 Firestore reads */
export const TOTY_DISCIPLINE_FRESH_TTL_MS = 1000 * 60 * 5; // 5 minutes
/** Maximum age for stale-while-revalidate fallback before discarding cached TOTY data */
export const TOTY_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24 hours

const VALID_DISCIPLINE_IDS = new Set<DisciplineId>(DISCIPLINES.map((d) => d.id));

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface TotyDisciplineIndexEntry {
  disciplineId: DisciplineId;
  savedAt: number;
  ballotCount: number;
  hasConfig: boolean;
  voterUids: string[];
}

export interface TotyCacheIndex {
  version: 1;
  temporada: string;
  updatedAt: number;
  allDisciplinesSyncedAt: number | null;
  disciplines: Partial<Record<DisciplineId, TotyDisciplineIndexEntry>>;
}

export interface TotyDisciplineCacheRecord {
  version: 1;
  disciplineId: DisciplineId;
  savedAt: number;
  config: DisciplineTotyConfig | null;
  /** Primary index: ballotId -> TotyBallotRecord */
  ballotsById: Record<string, TotyBallotRecord>;
  /** Secondary index: voterUid -> ballotId for O(1) voter lookup */
  ballotIdByVoter: Record<string, string>;
}

export interface LoadedTotyDisciplineCache {
  disciplineId: DisciplineId;
  savedAt: number;
  isFresh: boolean;
  config: DisciplineTotyConfig | null;
  ballots: TotyBallotRecord[];
  ballotsById: Record<string, TotyBallotRecord>;
  ballotIdByVoter: Record<string, string>;
}

export interface LoadedAllTotyCache {
  ballots: TotyBallotRecord[];
  configs: Partial<Record<DisciplineId, DisciplineTotyConfig>>;
  freshDisciplines: DisciplineId[];
  cachedDisciplines: DisciplineId[];
  latestSavedAt: number | null;
}

function resolveStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage !== undefined) return storage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export function getTotyDisciplineStorageKey(disciplineId: DisciplineId): string {
  return `${TOTY_DISCIPLINE_KEY_PREFIX}${disciplineId}`;
}

function createEmptyIndex(temporada = '2026', nowMs = Date.now()): TotyCacheIndex {
  return {
    version: 1,
    temporada,
    updatedAt: nowMs,
    allDisciplinesSyncedAt: null,
    disciplines: {},
  };
}

function isValidDisciplineId(value: unknown): value is DisciplineId {
  return typeof value === 'string' && VALID_DISCIPLINE_IDS.has(value as DisciplineId);
}

/**
 * Reads the lightweight master TOTY index from localStorage without parsing
 * individual discipline payloads.
 */
export function readTotyCacheIndex(
  storage?: StorageLike | null
): TotyCacheIndex | null {
  const store = resolveStorage(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(TOTY_CACHE_INDEX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TotyCacheIndex;
    if (
      !parsed ||
      parsed.version !== 1 ||
      typeof parsed.updatedAt !== 'number' ||
      !parsed.disciplines ||
      typeof parsed.disciplines !== 'object'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeTotyCacheIndex(
  index: TotyCacheIndex,
  storage?: StorageLike | null
): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    store.setItem(TOTY_CACHE_INDEX_KEY, JSON.stringify(index));
    return true;
  } catch {
    return false;
  }
}

/**
 * O(1) freshness check using only the master index entry for a discipline.
 */
export function isTotyDisciplineFresh(
  disciplineId: DisciplineId,
  storage?: StorageLike | null,
  nowMs: number = Date.now(),
  freshTtlMs: number = TOTY_DISCIPLINE_FRESH_TTL_MS
): boolean {
  const index = readTotyCacheIndex(storage);
  const entry = index?.disciplines?.[disciplineId];
  if (!entry || typeof entry.savedAt !== 'number') return false;
  return nowMs - entry.savedAt >= 0 && nowMs - entry.savedAt < freshTtlMs;
}

/**
 * O(1) check confirming whether all requested disciplines have fresh cached entries.
 */
export function areAllTotyDisciplinesFresh(
  disciplineIds: DisciplineId[] = DISCIPLINES.map((d) => d.id),
  storage?: StorageLike | null,
  nowMs: number = Date.now(),
  freshTtlMs: number = TOTY_DISCIPLINE_FRESH_TTL_MS
): boolean {
  const index = readTotyCacheIndex(storage);
  if (!index) return false;
  return disciplineIds.every((discId) => {
    const entry = index.disciplines[discId];
    return (
      Boolean(entry) &&
      typeof entry!.savedAt === 'number' &&
      nowMs - entry!.savedAt >= 0 &&
      nowMs - entry!.savedAt < freshTtlMs
    );
  });
}

function buildDisciplineCacheRecord(
  disciplineId: DisciplineId,
  ballots: TotyBallotRecord[],
  config: DisciplineTotyConfig | null,
  nowMs: number
): TotyDisciplineCacheRecord {
  const ballotsById: Record<string, TotyBallotRecord> = {};
  const ballotIdByVoter: Record<string, string> = {};

  for (const b of ballots) {
    if (b.disciplineId !== disciplineId || !b.id) continue;
    ballotsById[b.id] = b;
    if (b.voterUid) {
      ballotIdByVoter[b.voterUid] = b.id;
    }
  }

  return {
    version: 1,
    disciplineId,
    savedAt: nowMs,
    config,
    ballotsById,
    ballotIdByVoter,
  };
}

/**
 * Loads one partitioned discipline entry from localStorage using its indexed maps.
 * Returns null only if missing, corrupted, or older than maxAgeMs (24h).
 */
export function loadCachedTotyForDiscipline(
  disciplineId: DisciplineId,
  storage?: StorageLike | null,
  nowMs: number = Date.now(),
  freshTtlMs: number = TOTY_DISCIPLINE_FRESH_TTL_MS,
  maxAgeMs: number = TOTY_CACHE_MAX_AGE_MS
): LoadedTotyDisciplineCache | null {
  const store = resolveStorage(storage);
  if (!store || !isValidDisciplineId(disciplineId)) return null;

  try {
    const raw = store.getItem(getTotyDisciplineStorageKey(disciplineId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TotyDisciplineCacheRecord;
    if (
      !parsed ||
      parsed.version !== 1 ||
      parsed.disciplineId !== disciplineId ||
      typeof parsed.savedAt !== 'number' ||
      !parsed.ballotsById ||
      typeof parsed.ballotsById !== 'object'
    ) {
      return null;
    }

    const age = nowMs - parsed.savedAt;
    if (age > maxAgeMs) {
      return null;
    }

    const ballots = Object.values(parsed.ballotsById);
    const ballotIdByVoter: Record<string, string> =
      parsed.ballotIdByVoter && typeof parsed.ballotIdByVoter === 'object'
        ? parsed.ballotIdByVoter
        : {};

    return {
      disciplineId,
      savedAt: parsed.savedAt,
      isFresh: age >= 0 && age < freshTtlMs,
      config: parsed.config ?? null,
      ballots,
      ballotsById: parsed.ballotsById,
      ballotIdByVoter,
    };
  } catch {
    return null;
  }
}

/**
 * O(1) lookup for a single user's cached TOTY ballot inside a discipline.
 */
export function getCachedUserTotyBallot(
  disciplineId: DisciplineId,
  voterUid: string,
  storage?: StorageLike | null,
  nowMs: number = Date.now()
): TotyBallotRecord | null {
  if (!voterUid) return null;
  const loaded = loadCachedTotyForDiscipline(disciplineId, storage, nowMs);
  if (!loaded) return null;
  const ballotId = loaded.ballotIdByVoter[voterUid] ?? `${disciplineId}_${voterUid}`;
  return loaded.ballotsById[ballotId] ?? null;
}

/**
 * Hydrates all non-expired discipline TOTY partitions listed in the master index.
 */
export function loadAllCachedTotyData(
  storage?: StorageLike | null,
  nowMs: number = Date.now(),
  freshTtlMs: number = TOTY_DISCIPLINE_FRESH_TTL_MS,
  maxAgeMs: number = TOTY_CACHE_MAX_AGE_MS
): LoadedAllTotyCache {
  const index = readTotyCacheIndex(storage);
  if (!index) {
    return {
      ballots: [],
      configs: {},
      freshDisciplines: [],
      cachedDisciplines: [],
      latestSavedAt: null,
    };
  }

  const ballots: TotyBallotRecord[] = [];
  const configs: Partial<Record<DisciplineId, DisciplineTotyConfig>> = {};
  const freshDisciplines: DisciplineId[] = [];
  const cachedDisciplines: DisciplineId[] = [];
  let latestSavedAt: number | null = null;

  for (const key of Object.keys(index.disciplines)) {
    if (!isValidDisciplineId(key)) continue;
    const loaded = loadCachedTotyForDiscipline(key, storage, nowMs, freshTtlMs, maxAgeMs);
    if (!loaded) continue;

    cachedDisciplines.push(key);
    if (loaded.isFresh) freshDisciplines.push(key);
    if (latestSavedAt === null || loaded.savedAt > latestSavedAt) {
      latestSavedAt = loaded.savedAt;
    }
    ballots.push(...loaded.ballots);
    if (loaded.config) {
      configs[key] = loaded.config;
    }
  }

  return {
    ballots,
    configs,
    freshDisciplines,
    cachedDisciplines,
    latestSavedAt,
  };
}

/**
 * Saves one discipline's TOTY ballots and formation config into its dedicated
 * indexed partition and updates the master index.
 */
export function saveCachedTotyForDiscipline(
  disciplineId: DisciplineId,
  payload: {
    ballots: TotyBallotRecord[];
    config?: DisciplineTotyConfig | null;
    temporada?: string;
  },
  storage?: StorageLike | null,
  nowMs: number = Date.now()
): boolean {
  const store = resolveStorage(storage);
  if (!store || !isValidDisciplineId(disciplineId)) return false;

  const existing = loadCachedTotyForDiscipline(disciplineId, store, nowMs);
  const resolvedConfig =
    payload.config !== undefined ? payload.config : existing?.config ?? null;

  const record = buildDisciplineCacheRecord(
    disciplineId,
    payload.ballots,
    resolvedConfig,
    nowMs
  );

  try {
    store.setItem(getTotyDisciplineStorageKey(disciplineId), JSON.stringify(record));
  } catch {
    return false;
  }

  const index = readTotyCacheIndex(store) ?? createEmptyIndex(payload.temporada ?? '2026', nowMs);
  if (payload.temporada) {
    index.temporada = payload.temporada;
  }
  index.updatedAt = nowMs;
  index.disciplines[disciplineId] = {
    disciplineId,
    savedAt: nowMs,
    ballotCount: Object.keys(record.ballotsById).length,
    hasConfig: Boolean(record.config),
    voterUids: Object.keys(record.ballotIdByVoter),
  };

  return writeTotyCacheIndex(index, store);
}

/**
 * Partitions a full multi-discipline TOTY snapshot into per-discipline indexed keys
 * and updates the master index in one pass.
 */
export function saveAllCachedTotySnapshot(
  params: {
    ballots: TotyBallotRecord[];
    configs: Partial<Record<DisciplineId, DisciplineTotyConfig>>;
    disciplineIds?: DisciplineId[];
    temporada?: string;
  },
  storage?: StorageLike | null,
  nowMs: number = Date.now()
): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;

  const targetDisciplines = params.disciplineIds ?? DISCIPLINES.map((d) => d.id);
  const grouped = new Map<DisciplineId, TotyBallotRecord[]>();
  for (const discId of targetDisciplines) {
    grouped.set(discId, []);
  }
  for (const ballot of params.ballots) {
    if (!isValidDisciplineId(ballot.disciplineId)) continue;
    const list = grouped.get(ballot.disciplineId) ?? [];
    list.push(ballot);
    grouped.set(ballot.disciplineId, list);
  }

  const index = readTotyCacheIndex(store) ?? createEmptyIndex(params.temporada ?? '2026', nowMs);
  if (params.temporada) {
    index.temporada = params.temporada;
  }

  let wroteAny = true;
  for (const discId of targetDisciplines) {
    const discBallots = grouped.get(discId) ?? [];
    const discConfig = params.configs[discId] ?? null;
    const record = buildDisciplineCacheRecord(discId, discBallots, discConfig, nowMs);
    try {
      store.setItem(getTotyDisciplineStorageKey(discId), JSON.stringify(record));
      index.disciplines[discId] = {
        disciplineId: discId,
        savedAt: nowMs,
        ballotCount: Object.keys(record.ballotsById).length,
        hasConfig: Boolean(record.config),
        voterUids: Object.keys(record.ballotIdByVoter),
      };
    } catch {
      wroteAny = false;
    }
  }

  index.updatedAt = nowMs;
  index.allDisciplinesSyncedAt = nowMs;
  return writeTotyCacheIndex(index, store) && wroteAny;
}

/**
 * Write-through update: merges newly submitted single or multi-discipline TOTY ballots
 * into ONLY their corresponding discipline partitions without touching other disciplines
 * or requiring a Firestore re-read.
 */
export function upsertCachedTotyBallots(
  ballots: TotyBallotRecord[],
  storage?: StorageLike | null,
  nowMs: number = Date.now()
): DisciplineId[] {
  const store = resolveStorage(storage);
  if (!store || ballots.length === 0) return [];

  const byDiscipline = new Map<DisciplineId, TotyBallotRecord[]>();
  for (const b of ballots) {
    if (!isValidDisciplineId(b.disciplineId)) continue;
    const arr = byDiscipline.get(b.disciplineId) ?? [];
    arr.push(b);
    byDiscipline.set(b.disciplineId, arr);
  }

  const updatedDisciplines: DisciplineId[] = [];
  const index = readTotyCacheIndex(store) ?? createEmptyIndex('2026', nowMs);

  for (const [discId, incoming] of byDiscipline.entries()) {
    const existing = loadCachedTotyForDiscipline(discId, store, nowMs);
    const ballotsById: Record<string, TotyBallotRecord> = {
      ...(existing?.ballotsById ?? {}),
    };
    const ballotIdByVoter: Record<string, string> = {
      ...(existing?.ballotIdByVoter ?? {}),
    };

    for (const ballot of incoming) {
      ballotsById[ballot.id] = ballot;
      if (ballot.voterUid) {
        ballotIdByVoter[ballot.voterUid] = ballot.id;
      }
      if (ballot.temporada) {
        index.temporada = ballot.temporada;
      }
    }

    // Preserve prior savedAt if this discipline had a full sync timestamp, otherwise stamp nowMs
    // so an uncached discipline still gets a valid write-through entry.
    const nextSavedAt = existing?.savedAt ?? nowMs;
    const record: TotyDisciplineCacheRecord = {
      version: 1,
      disciplineId: discId,
      savedAt: nextSavedAt,
      config: existing?.config ?? null,
      ballotsById,
      ballotIdByVoter,
    };

    try {
      store.setItem(getTotyDisciplineStorageKey(discId), JSON.stringify(record));
      index.disciplines[discId] = {
        disciplineId: discId,
        savedAt: nextSavedAt,
        ballotCount: Object.keys(ballotsById).length,
        hasConfig: Boolean(record.config),
        voterUids: Object.keys(ballotIdByVoter),
      };
      updatedDisciplines.push(discId);
    } catch {
      // Ignore storage quota failures gracefully
    }
  }

  if (updatedDisciplines.length > 0) {
    index.updatedAt = nowMs;
    writeTotyCacheIndex(index, store);
  }

  return updatedDisciplines;
}

/**
 * Write-through update for an Admin-saved TOTY formation config.
 */
export function upsertCachedTotyConfig(
  config: DisciplineTotyConfig,
  storage?: StorageLike | null,
  nowMs: number = Date.now()
): boolean {
  const store = resolveStorage(storage);
  if (!store || !isValidDisciplineId(config.disciplineId)) return false;

  const existing = loadCachedTotyForDiscipline(config.disciplineId, store, nowMs);
  const nextSavedAt = existing?.savedAt ?? nowMs;
  const record: TotyDisciplineCacheRecord = {
    version: 1,
    disciplineId: config.disciplineId,
    savedAt: nextSavedAt,
    config,
    ballotsById: existing?.ballotsById ?? {},
    ballotIdByVoter: existing?.ballotIdByVoter ?? {},
  };

  try {
    store.setItem(getTotyDisciplineStorageKey(config.disciplineId), JSON.stringify(record));
  } catch {
    return false;
  }

  const index = readTotyCacheIndex(store) ?? createEmptyIndex(config.temporada || '2026', nowMs);
  index.updatedAt = nowMs;
  index.disciplines[config.disciplineId] = {
    disciplineId: config.disciplineId,
    savedAt: nextSavedAt,
    ballotCount: Object.keys(record.ballotsById).length,
    hasConfig: true,
    voterUids: Object.keys(record.ballotIdByVoter),
  };
  return writeTotyCacheIndex(index, store);
}

/**
 * Write-through removal when Admin resets a discipline's TOTY formation to default.
 */
export function removeCachedTotyConfig(
  disciplineId: DisciplineId,
  storage?: StorageLike | null,
  nowMs: number = Date.now()
): boolean {
  const store = resolveStorage(storage);
  if (!store || !isValidDisciplineId(disciplineId)) return false;

  const existing = loadCachedTotyForDiscipline(disciplineId, store, nowMs);
  if (!existing) return true;

  const record: TotyDisciplineCacheRecord = {
    version: 1,
    disciplineId,
    savedAt: existing.savedAt,
    config: null,
    ballotsById: existing.ballotsById,
    ballotIdByVoter: existing.ballotIdByVoter,
  };

  try {
    store.setItem(getTotyDisciplineStorageKey(disciplineId), JSON.stringify(record));
  } catch {
    return false;
  }

  const index = readTotyCacheIndex(store) ?? createEmptyIndex('2026', nowMs);
  index.updatedAt = nowMs;
  if (index.disciplines[disciplineId]) {
    index.disciplines[disciplineId] = {
      ...index.disciplines[disciplineId]!,
      hasConfig: false,
    };
  }
  return writeTotyCacheIndex(index, store);
}

/**
 * Invalidates either a single discipline's TOTY cache or the entire indexed TOTY cache.
 */
export function invalidateTotyCache(
  disciplineId?: DisciplineId,
  storage?: StorageLike | null
): void {
  const store = resolveStorage(storage);
  if (!store) return;

  try {
    if (disciplineId) {
      store.removeItem(getTotyDisciplineStorageKey(disciplineId));
      const index = readTotyCacheIndex(store);
      if (index && index.disciplines[disciplineId]) {
        delete index.disciplines[disciplineId];
        index.allDisciplinesSyncedAt = null;
        index.updatedAt = Date.now();
        writeTotyCacheIndex(index, store);
      }
      return;
    }

    for (const disc of DISCIPLINES) {
      store.removeItem(getTotyDisciplineStorageKey(disc.id));
    }
    store.removeItem(TOTY_CACHE_INDEX_KEY);
  } catch {
    // Ignore storage removal errors
  }
}
