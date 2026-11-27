import test from 'node:test';
import assert from 'node:assert/strict';
import type { TotyBallotRecord } from '../types/tournament';
import {
  areTotySelectionsEqual,
  enqueueTotyBallotItem,
  mergeTotyBallotsIntoState,
  planTotyBallotBatch,
  sanitizeTotySelections,
} from './totyBatchQueue';

test('sanitizeTotySelections trims values, drops empties, and caps at 10 slots', () => {
  const raw: Record<string, string> = {};
  for (let i = 1; i <= 12; i++) {
    raw[`  slot_${i}  `] = `  player_${i}  `;
  }
  raw['empty_slot'] = '   ';

  const clean = sanitizeTotySelections(raw);
  assert.equal(Object.keys(clean).length, 10);
  assert.equal(clean['slot_1'], 'player_1');
  assert.equal(clean['empty_slot'], undefined);
});

test('areTotySelectionsEqual ignores key insertion order and surrounding whitespace', () => {
  assert.equal(
    areTotySelectionsEqual({ arq: 'p1', def_1: 'p2' }, { def_1: ' p2 ', arq: 'p1' }),
    true
  );
  assert.equal(
    areTotySelectionsEqual({ arq: 'p1', def_1: 'p2' }, { arq: 'p1', def_1: 'p3' }),
    false
  );
});

test('planTotyBallotBatch combines multiple disciplines into one batch and skips unchanged/empty ballots', () => {
  const persisted: TotyBallotRecord[] = [
    {
      id: 'f7-h-1_user1',
      disciplineId: 'f7-h-1',
      temporada: '2026',
      voterUid: 'user1',
      selections: { portero_1: 'p1', defensa_1: 'p2' },
      updatedAt: '2026-05-01T10:00:00.000Z',
    },
    {
      id: 'basquet-h_user1',
      disciplineId: 'basquet-h',
      temporada: '2026',
      voterUid: 'user1',
      selections: { base_1: 'b1' },
      updatedAt: '2026-05-01T10:00:00.000Z',
    },
  ];

  const plan = planTotyBallotBatch({
    submissions: [
      // Unchanged ballot -> must be skipped (0 reads/writes)
      { disciplineId: 'f7-h-1', selections: { defensa_1: 'p2', portero_1: 'p1' } },
      // Updated existing ballot -> isUpdate: true
      { disciplineId: 'basquet-h', selections: { base_1: 'b2', pivot_1: 'b5' } },
      // New ballot submitted twice -> coalesced into 1 create with latest picks
      { disciplineId: 'voley-m', selections: { armadora_1: 'v1' } },
      { disciplineId: 'voley-m', selections: { armadora_1: 'v1', libero_1: 'v7' } },
      // Empty ballot -> must be skipped
      { disciplineId: 'f7-m', selections: { portero_1: '   ' } },
    ],
    persistedBallots: persisted,
    voterUid: 'user1',
    temporada: '2026',
    nowIso: '2026-05-02T12:00:00.000Z',
  });

  assert.equal(plan.items.length, 2);
  assert.equal(plan.chunks.length, 1);
  assert.deepEqual(plan.skippedDisciplineIds.sort(), ['f7-h-1', 'f7-m']);

  const basquetItem = plan.items.find((i) => i.ballot.disciplineId === 'basquet-h');
  const voleyItem = plan.items.find((i) => i.ballot.disciplineId === 'voley-m');
  assert.equal(basquetItem?.isUpdate, true);
  assert.deepEqual(basquetItem?.ballot.selections, { base_1: 'b2', pivot_1: 'b5' });
  assert.equal(voleyItem?.isUpdate, false);
  assert.deepEqual(voleyItem?.ballot.selections, { armadora_1: 'v1', libero_1: 'v7' });
});

test('enqueueTotyBallotItem coalesces repeated discipline edits while preserving update flag', () => {
  const first = enqueueTotyBallotItem([], {
    ballot: {
      id: 'f7-m_u1',
      disciplineId: 'f7-m',
      temporada: '2026',
      voterUid: 'u1',
      selections: { portero_1: 'p1' },
      updatedAt: '2026-05-01T10:00:00.000Z',
    },
    isUpdate: true,
  });

  const second = enqueueTotyBallotItem(first, {
    ballot: {
      id: 'basquet-h_u1',
      disciplineId: 'basquet-h',
      temporada: '2026',
      voterUid: 'u1',
      selections: { base_1: 'b1' },
      updatedAt: '2026-05-01T10:01:00.000Z',
    },
    isUpdate: false,
  });

  const third = enqueueTotyBallotItem(second, {
    ballot: {
      id: 'f7-m_u1',
      disciplineId: 'f7-m',
      temporada: '2026',
      voterUid: 'u1',
      selections: { portero_1: 'p9', delantero_1: 'p10' },
      updatedAt: '2026-05-01T10:02:00.000Z',
    },
    isUpdate: false,
  });

  assert.equal(third.length, 2);
  const f7m = third.find((i) => i.ballot.disciplineId === 'f7-m');
  assert.equal(f7m?.isUpdate, true);
  assert.deepEqual(f7m?.ballot.selections, { portero_1: 'p9', delantero_1: 'p10' });
});

test('planTotyBallotBatch splits into multiple chunks when exceeding chunkSize', () => {
  const plan = planTotyBallotBatch({
    submissions: [
      { disciplineId: 'f7-h-1', selections: { portero_1: 'p1' } },
      { disciplineId: 'f7-h-2', selections: { portero_1: 'p2' } },
      { disciplineId: 'f7-m', selections: { portero_1: 'p3' } },
    ],
    persistedBallots: [],
    voterUid: 'u1',
    temporada: '2026',
    chunkSize: 2,
  });

  assert.equal(plan.chunks.length, 2);
  assert.equal(plan.chunks[0].length, 2);
  assert.equal(plan.chunks[1].length, 1);
});

test('mergeTotyBallotsIntoState updates existing ballots and prepends new ones without duplicates', () => {
  const existing: TotyBallotRecord[] = [
    {
      id: 'f7-h-1_u1',
      disciplineId: 'f7-h-1',
      temporada: '2026',
      voterUid: 'u1',
      selections: { portero_1: 'old' },
      updatedAt: '2026-05-01T00:00:00.000Z',
    },
  ];
  const merged = mergeTotyBallotsIntoState(existing, [
    {
      id: 'f7-h-1_u1',
      disciplineId: 'f7-h-1',
      temporada: '2026',
      voterUid: 'u1',
      selections: { portero_1: 'new' },
      updatedAt: '2026-05-02T00:00:00.000Z',
    },
    {
      id: 'voley-m_u1',
      disciplineId: 'voley-m',
      temporada: '2026',
      voterUid: 'u1',
      selections: { libero_1: 'v1' },
      updatedAt: '2026-05-02T00:00:00.000Z',
    },
  ]);

  assert.equal(merged.length, 2);
  assert.equal(merged.find((b) => b.id === 'f7-h-1_u1')?.selections.portero_1, 'new');
  assert.equal(merged.find((b) => b.id === 'voley-m_u1')?.selections.libero_1, 'v1');
});
