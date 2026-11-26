import type { NewsArticle, Player, TransferRecord } from '../types/tournament';

export type CoreRealtimeStreamKey =
  | 'settings'
  | 'configs'
  | 'teams'
  | 'players'
  | 'matches'
  | 'news';

export type PublicRealtimeStreamKey =
  | CoreRealtimeStreamKey
  | 'transfers'
  | 'photos'
  | 'mvpVotes'
  | 'awardNominees'
  | 'championshipMvpVotes'
  | 'positionAwardVotes'
  | 'leyendasLeaderboard';

export const CORE_REALTIME_STREAMS: readonly CoreRealtimeStreamKey[] = [
  'settings',
  'configs',
  'teams',
  'players',
  'matches',
  'news',
];

export type InitialSyncPhase = 'loading' | 'ready' | 'error';

/**
 * Merges incoming public player snapshots from Firestore while preserving any
 * authorized student PII (rut, numeroMatricula, correoInstitucional, fechaNacimiento)
 * already hydrated in memory for Admin / Delegado / Jugador sessions.
 */
export function mergePublicPlayersPreservingPii(
  prevPlayers: Player[],
  incomingPublicPlayers: Player[]
): Player[] {
  if (prevPlayers.length === 0) return incomingPublicPlayers;

  const piiById = new Map<
    string,
    Pick<Player, 'rut' | 'numeroMatricula' | 'correoInstitucional' | 'fechaNacimiento'>
  >();

  for (const prev of prevPlayers) {
    if (
      prev.rut ||
      prev.numeroMatricula ||
      prev.correoInstitucional ||
      prev.fechaNacimiento
    ) {
      piiById.set(prev.id, {
        rut: prev.rut,
        numeroMatricula: prev.numeroMatricula,
        correoInstitucional: prev.correoInstitucional,
        fechaNacimiento: prev.fechaNacimiento,
      });
    }
  }

  if (piiById.size === 0) return incomingPublicPlayers;

  return incomingPublicPlayers.map((incoming) => {
    const existingPii = piiById.get(incoming.id);
    if (!existingPii) return incoming;
    return {
      ...incoming,
      rut: incoming.rut || existingPii.rut,
      numeroMatricula: incoming.numeroMatricula || existingPii.numeroMatricula,
      correoInstitucional: incoming.correoInstitucional || existingPii.correoInstitucional,
      fechaNacimiento: incoming.fechaNacimiento || existingPii.fechaNacimiento,
    };
  });
}

/**
 * Merges live published news snapshots while preserving unpublished drafts
 * currently loaded for Admin / Prensa Oficial sessions.
 */
export function mergePublicNewsPreservingDrafts(
  prevNews: NewsArticle[],
  incomingPublishedNews: NewsArticle[],
  keepUnpublished: boolean
): NewsArticle[] {
  const byId = new Map<string, NewsArticle>();

  if (keepUnpublished) {
    for (const article of prevNews) {
      if (!article.published) {
        byId.set(article.id, article);
      }
    }
  }

  for (const publishedArticle of incomingPublishedNews) {
    byId.set(publishedArticle.id, publishedArticle);
  }

  return Array.from(byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Merges live approved transfer snapshots while preserving pending/rejected
 * transfer requests already loaded for Admin / Delegado sessions.
 */
export function mergePublicTransfersPreservingPrivate(
  prevTransfers: TransferRecord[],
  incomingApprovedTransfers: TransferRecord[],
  keepPrivate: boolean
): TransferRecord[] {
  const byId = new Map<string, TransferRecord>();

  if (keepPrivate) {
    for (const tr of prevTransfers) {
      if (tr.estado !== 'APROBADA') {
        byId.set(tr.id, tr);
      }
    }
  }

  for (const approved of incomingApprovedTransfers) {
    byId.set(approved.id, approved);
  }

  return Array.from(byId.values()).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/**
 * Determines whether a first-visit device should display the editorial loading state,
 * the live tournament UI, or a connection retry state.
 */
export function computeInitialSyncPhase(params: {
  hasCachedSnapshot: boolean;
  settledCoreStreams: ReadonlySet<CoreRealtimeStreamKey>;
  failedCoreStreams: ReadonlySet<CoreRealtimeStreamKey>;
  timedOut: boolean;
}): InitialSyncPhase {
  const { hasCachedSnapshot, settledCoreStreams, failedCoreStreams, timedOut } = params;

  if (hasCachedSnapshot) return 'ready';

  const resolvedCount = CORE_REALTIME_STREAMS.filter(
    (k) => settledCoreStreams.has(k) && !failedCoreStreams.has(k)
  ).length;

  const accountedCount = CORE_REALTIME_STREAMS.filter(
    (k) => settledCoreStreams.has(k) || failedCoreStreams.has(k)
  ).length;

  if (accountedCount >= CORE_REALTIME_STREAMS.length) {
    return resolvedCount > 0 ? 'ready' : 'error';
  }

  if (timedOut) {
    return resolvedCount > 0 ? 'ready' : 'error';
  }

  return 'loading';
}
