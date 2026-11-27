import test from 'node:test';
import assert from 'node:assert/strict';
import type { DisciplineTotyConfig, TotyBallotRecord } from '../types/tournament';
import {
  areAllTotyDisciplinesFresh,
  getCachedUserTotyBallot,
  getTotyDisciplineStorageKey,
  invalidateTotyCache,
  isTotyDisciplineFresh,
  loadAllCachedTotyData,
  loadCachedTotyForDiscipline,
  readTotyCacheIndex,
  removeCachedTotyConfig,
  saveAllCachedTotySnapshot,
  saveCachedTotyForDiscipline,
  TOTY_CACHE_INDEX_KEY,
  TOTY_CACHE_MAX_AGE_MS,
  TOTY_DISCIPLINE_FRESH_TTL_MS,
  upsertCachedTotyBallots,
  upsertCachedTotyConfig,
  type StorageLike,
} from './totyIndexedCache';

function createMemoryStorage(options?: { failSet?: boolean }): StorageLike & {
  store: Map<string, string>;
} {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (options?.failSet) {
        throw new Error('QuotaExceededError');
      }
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

const sampleBallotF7: TotyBallotRecord = {
  id: 'f7-h-1_user-1',
  disciplineId: 'f7-h-1',
  temporada: '2026',
  voterUid: 'user-1',
  selections: { ARQ_1: 'p-1', DEL_1: 'p-2' },
  updatedAt: '2026-11-27T10:00:00.000Z',
};

const sampleBallotBasquet: TotyBallotRecord = {
  id: 'basquet-h_user-1',
  disciplineId: 'basquet-h',
  temporada: '2026',
  voterUid: 'user-1',
  selections: { BASE_1: 'p-10' },
  updatedAt: '2026-11-27T10:01:00.000Z',
};

const sampleConfigF7: DisciplineTotyConfig = {
  disciplineId: 'f7-h-1',
  temporada: '2026',
  formationName: '7 Ideal 1-2-3-1',
  positionCounts: { ARQ: 1, DEF: 2, MED: 3, DEL: 1 },
  updatedAt: '2026-11-27T09:00:00.000Z',
};

test('saveCachedTotyForDiscipline partitions data, builds secondary voter index, and updates master index', () => {
  const storage = createMemoryStorage();
  const t0 = 1_700_000_000_000;

  const ok = saveCachedTotyForDiscipline(
    'f7-h-1',
    { ballots: [sampleBallotF7], config: sampleConfigF7, temporada: '2026' },
    storage,
    t0
  );
  assert.equal(ok, true);

  // Master index exists and tracks f7-h-1 metadata
  const idx = readTotyCacheIndex(storage);
  assert.ok(idx);
  assert.equal(idx.temporada, '2026');
  assert.equal(idx.disciplines['f7-h-1']?.ballotCount, 1);
  assert.equal(idx.disciplines['f7-h-1']?.hasConfig, true);
  assert.deepEqual(idx.disciplines['f7-h-1']?.voterUids, ['user-1']);

  // Partition key is isolated per discipline
  assert.ok(storage.store.has(getTotyDisciplineStorageKey('f7-h-1')));
  assert.equal(storage.store.has(getTotyDisciplineStorageKey('basquet-h')), false);

  // O(1) user ballot lookup works via secondary index
  const found = getCachedUserTotyBallot('f7-h-1', 'user-1', storage, t0 + 1000);
  assert.deepEqual(found, sampleBallotF7);
  assert.equal(getCachedUserTotyBallot('f7-h-1', 'unknown-user', storage, t0 + 1000), null);
});

test('freshness TTL distinguishes fresh (0 Firestore reads), stale-while-revalidate, and expired entries', () => {
  const storage = createMemoryStorage();
  const t0 = 1_700_000_000_000;

  saveCachedTotyForDiscipline('f7-h-1', { ballots: [sampleBallotF7], config: null }, storage, t0);

  // Within 5 min TTL -> fresh
  assert.equal(isTotyDisciplineFresh('f7-h-1', storage, t0 + TOTY_DISCIPLINE_FRESH_TTL_MS - 1), true);
  const freshLoad = loadCachedTotyForDiscipline('f7-h-1', storage, t0 + 60_000);
  assert.ok(freshLoad);
  assert.equal(freshLoad.isFresh, true);
  assert.equal(freshLoad.ballots.length, 1);

  // After 5 min but before 24h -> stale-while-revalidate (still returns cached ballots, isFresh = false)
  assert.equal(isTotyDisciplineFresh('f7-h-1', storage, t0 + TOTY_DISCIPLINE_FRESH_TTL_MS + 1000), false);
  const staleLoad = loadCachedTotyForDiscipline('f7-h-1', storage, t0 + TOTY_DISCIPLINE_FRESH_TTL_MS + 1000);
  assert.ok(staleLoad);
  assert.equal(staleLoad.isFresh, false);
  assert.equal(staleLoad.ballots.length, 1);

  // Past 24h max age -> discarded
  const expiredLoad = loadCachedTotyForDiscipline('f7-h-1', storage, t0 + TOTY_CACHE_MAX_AGE_MS + 1000);
  assert.equal(expiredLoad, null);
});

test('upsertCachedTotyBallots writes through across multiple disciplines without overwriting untouched ones', () => {
  const storage = createMemoryStorage();
  const t0 = 1_700_000_000_000;

  saveCachedTotyForDiscipline('f7-h-1', { ballots: [sampleBallotF7], config: sampleConfigF7 }, storage, t0);
  saveCachedTotyForDiscipline('basquet-h', { ballots: [sampleBallotBasquet], config: null }, storage, t0);

  const editedF7: TotyBallotRecord = {
    ...sampleBallotF7,
    selections: { ARQ_1: 'p-1', DEL_1: 'p-99' },
  };
  const newUserBasquet: TotyBallotRecord = {
    id: 'basquet-h_user-2',
    disciplineId: 'basquet-h',
    temporada: '2026',
    voterUid: 'user-2',
    selections: { BASE_1: 'p-20' },
    updatedAt: '2026-11-27T10:05:00.000Z',
  };

  const touched = upsertCachedTotyBallots([editedF7, newUserBasquet], storage, t0 + 5000);
  assert.deepEqual(touched.sort(), ['basquet-h', 'f7-h-1']);

  const f7Loaded = loadCachedTotyForDiscipline('f7-h-1', storage, t0 + 5000);
  assert.equal(f7Loaded?.ballotsById['f7-h-1_user-1']?.selections.DEL_1, 'p-99');
  assert.deepEqual(f7Loaded?.config, sampleConfigF7);

  const basqLoaded = loadCachedTotyForDiscipline('basquet-h', storage, t0 + 5000);
  assert.equal(basqLoaded?.ballots.length, 2);
  assert.equal(basqLoaded?.ballotIdByVoter['user-2'], 'basquet-h_user-2');
});

test('saveAllCachedTotySnapshot, loadAllCachedTotyData, and config write-through stay consistent', () => {
  const storage = createMemoryStorage();
  const t0 = 1_700_000_000_000;

  const ok = saveAllCachedTotySnapshot(
    {
      ballots: [sampleBallotF7, sampleBallotBasquet],
      configs: { 'f7-h-1': sampleConfigF7 },
      disciplineIds: ['f7-h-1', 'basquet-h'],
      temporada: '2026',
    },
    storage,
    t0
  );
  assert.equal(ok, true);
  assert.equal(areAllTotyDisciplinesFresh(['f7-h-1', 'basquet-h'], storage, t0 + 10_000), true);
  assert.equal(areAllTotyDisciplinesFresh(['f7-h-1', 'basquet-h', 'voley-h'], storage, t0 + 10_000), false);

  const all = loadAllCachedTotyData(storage, t0 + 10_000);
  assert.equal(all.ballots.length, 2);
  assert.equal(all.configs['f7-h-1']?.formationName, '7 Ideal 1-2-3-1');
  assert.deepEqual(all.freshDisciplines.sort(), ['basquet-h', 'f7-h-1']);

  // Write-through config upsert & remove
  const basqConfig: DisciplineTotyConfig = {
    disciplineId: 'basquet-h',
    temporada: '2026',
    formationName: 'Quinteto Ideal',
    positionCounts: { BASE: 1, ESC: 1, ALE: 1, AP: 1, PIV: 1 },
    updatedAt: '2026-11-27T11:00:00.000Z',
  };
  assert.equal(upsertCachedTotyConfig(basqConfig, storage, t0 + 12_000), true);
  assert.equal(loadCachedTotyForDiscipline('basquet-h', storage, t0 + 12_000)?.config?.formationName, 'Quinteto Ideal');

  assert.equal(removeCachedTotyConfig('basquet-h', storage, t0 + 13_000), true);
  assert.equal(loadCachedTotyForDiscipline('basquet-h', storage, t0 + 13_000)?.config, null);
});

test('invalidateTotyCache removes single discipline or clears entire indexed cache', () => {
  const storage = createMemoryStorage();
  const t0 = 1_700_000_000_000;

  saveAllCachedTotySnapshot(
    {
      ballots: [sampleBallotF7, sampleBallotBasquet],
      configs: { 'f7-h-1': sampleConfigF7 },
      disciplineIds: ['f7-h-1', 'basquet-h'],
    },
    storage,
    t0
  );

  invalidateTotyCache('f7-h-1', storage);
  assert.equal(loadCachedTotyForDiscipline('f7-h-1', storage, t0 + 1000), null);
  assert.ok(loadCachedTotyForDiscipline('basquet-h', storage, t0 + 1000));

  invalidateTotyCache(undefined, storage);
  assert.equal(readTotyCacheIndex(storage), null);
  assert.equal(loadCachedTotyForDiscipline('basquet-h', storage, t0 + 1000), null);
});

test('handles corrupted JSON and localStorage quota exceptions gracefully without throwing', () => {
  const corruptStorage = createMemoryStorage();
  corruptStorage.store.set(TOTY_CACHE_INDEX_KEY, '{bad-json');
  corruptStorage.store.set(getTotyDisciplineStorageKey('f7-h-1'), 'not-json');

  assert.equal(readTotyCacheIndex(corruptStorage), null);
  assert.equal(loadCachedTotyForDiscipline('f7-h-1', corruptStorage), null);
  assert.deepEqual(loadAllCachedTotyData(corruptStorage).ballots, []);

  const fullStorage = createMemoryStorage({ failSet: true });
  assert.equal(
    saveCachedTotyForDiscipline('f7-h-1', { ballots: [sampleBallotF7], config: null }, fullStorage),
    false
  );
  assert.deepEqual(upsertCachedTotyBallots([sampleBallotF7], fullStorage), []);
});
