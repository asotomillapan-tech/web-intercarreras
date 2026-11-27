import type { DisciplineId, TotyBallotRecord } from '../types/tournament';

export interface TotyBallotSubmissionInput {
  disciplineId: DisciplineId;
  selections: Record<string, string>;
}

export interface TotyBallotBatchItem {
  ballot: TotyBallotRecord;
  isUpdate: boolean;
}

export interface TotyBatchPlan {
  items: TotyBallotBatchItem[];
  skippedDisciplineIds: DisciplineId[];
  chunks: TotyBallotBatchItem[][];
}

export const FIRESTORE_TOTY_BATCH_CHUNK_SIZE = 450;

/**
 * Sanitizes TOTY slot selections to satisfy Firestore security rules:
 * max 10 entries, non-empty trimmed keys (<= 32 chars) and values (<= 128 chars).
 */
export function sanitizeTotySelections(
  selections: Record<string, string> | undefined | null
): Record<string, string> {
  if (!selections || typeof selections !== 'object') return {};
  const clean: Record<string, string> = {};
  const entries = Object.entries(selections);
  for (const [rawKey, rawVal] of entries) {
    if (Object.keys(clean).length >= 10) break;
    const key = String(rawKey || '').trim().slice(0, 32);
    const val = String(rawVal || '').trim().slice(0, 128);
    if (key && val) {
      clean[key] = val;
    }
  }
  return clean;
}

/**
 * Deterministic structural equality check for two TOTY selection maps.
 * Used to avoid redundant Firestore writes/reads when a user submits unchanged picks.
 */
export function areTotySelectionsEqual(
  a: Record<string, string> | undefined | null,
  b: Record<string, string> | undefined | null
): boolean {
  const cleanA = sanitizeTotySelections(a);
  const cleanB = sanitizeTotySelections(b);
  const keysA = Object.keys(cleanA);
  const keysB = Object.keys(cleanB);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => cleanA[k] === cleanB[k]);
}

/**
 * Coalesces a new TOTY ballot item into an existing pending queue.
 * Multiple edits for the same discipline collapse into a single write while
 * preserving the original `isUpdate` flag.
 */
export function enqueueTotyBallotItem(
  queue: TotyBallotBatchItem[],
  nextItem: TotyBallotBatchItem
): TotyBallotBatchItem[] {
  const cleanSelections = sanitizeTotySelections(nextItem.ballot.selections);
  const normalizedNext: TotyBallotBatchItem = {
    ballot: {
      ...nextItem.ballot,
      selections: cleanSelections,
    },
    isUpdate: nextItem.isUpdate,
  };

  const existingIdx = queue.findIndex(
    (entry) => entry.ballot.disciplineId === normalizedNext.ballot.disciplineId
  );
  if (existingIdx === -1) {
    return [...queue, normalizedNext];
  }

  return queue.map((entry, idx) =>
    idx === existingIdx
      ? {
          ballot: normalizedNext.ballot,
          isUpdate: entry.isUpdate || normalizedNext.isUpdate,
        }
      : entry
  );
}

/**
 * Builds an optimized Firestore writeBatch plan for one or more TOTY discipline ballots.
 * - Deduplicates repeated disciplines (latest submission wins)
 * - Skips empty ballots and ballots identical to the persisted Firestore version (0 reads/writes)
 * - Resolves create vs update from known persisted ballots (eliminating pre-write getDoc reads)
 * - Splits into Firestore-safe chunks (<= 450 operations per writeBatch)
 */
export function planTotyBallotBatch(params: {
  submissions: TotyBallotSubmissionInput[];
  persistedBallots: TotyBallotRecord[];
  voterUid: string;
  temporada: string;
  nowIso?: string;
  chunkSize?: number;
}): TotyBatchPlan {
  const {
    submissions,
    persistedBallots,
    voterUid,
    temporada,
    nowIso = new Date().toISOString(),
    chunkSize = FIRESTORE_TOTY_BATCH_CHUNK_SIZE,
  } = params;

  const persistedById = new Map<string, TotyBallotRecord>();
  for (const b of persistedBallots) {
    persistedById.set(b.id, b);
  }

  // Collapse duplicate disciplines in input order (latest wins)
  const latestByDiscipline = new Map<DisciplineId, Record<string, string>>();
  for (const sub of submissions) {
    latestByDiscipline.set(sub.disciplineId, sanitizeTotySelections(sub.selections));
  }

  const items: TotyBallotBatchItem[] = [];
  const skippedDisciplineIds: DisciplineId[] = [];

  for (const [disciplineId, cleanSelections] of latestByDiscipline.entries()) {
    if (Object.keys(cleanSelections).length === 0) {
      skippedDisciplineIds.push(disciplineId);
      continue;
    }

    const ballotId = `${disciplineId}_${voterUid}`;
    const existing = persistedById.get(ballotId);

    if (existing && areTotySelectionsEqual(existing.selections, cleanSelections)) {
      skippedDisciplineIds.push(disciplineId);
      continue;
    }

    items.push({
      ballot: {
        id: ballotId,
        disciplineId,
        temporada: (temporada || '2026').slice(0, 16),
        voterUid,
        selections: cleanSelections,
        updatedAt: nowIso,
      },
      isUpdate: Boolean(existing),
    });
  }

  const safeChunkSize = Math.max(1, Math.min(500, Math.trunc(chunkSize)));
  const chunks: TotyBallotBatchItem[][] = [];
  for (let i = 0; i < items.length; i += safeChunkSize) {
    chunks.push(items.slice(i, i + safeChunkSize));
  }

  return { items, skippedDisciplineIds, chunks };
}

/**
 * Merges a batch of ballots into the current TournamentState ballots array without duplicates.
 */
export function mergeTotyBallotsIntoState(
  currentBallots: TotyBallotRecord[],
  incomingBallots: TotyBallotRecord[]
): TotyBallotRecord[] {
  if (incomingBallots.length === 0) return currentBallots;
  const incomingById = new Map(incomingBallots.map((b) => [b.id, b]));
  const updatedExisting = currentBallots.map((b) => incomingById.get(b.id) ?? b);
  const existingIds = new Set(currentBallots.map((b) => b.id));
  const brandNew = incomingBallots.filter((b) => !existingIds.has(b.id));
  return [...brandNew, ...updatedExisting];
}
