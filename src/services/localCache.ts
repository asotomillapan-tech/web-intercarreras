import type { Editorial2025Photos } from './googleDrive';
import type { TournamentState } from '../types/tournament';

const PUBLIC_STATE_CACHE_KEY = 'ufro_tournament_public_cache_v2';
const EDITORIAL_PHOTOS_CACHE_KEY = 'ufro_editorial_photos_cache_v1';

// Stale-while-revalidate soft TTLs: cached state renders immediately on startup,
// while fresh Firestore/Drive data still updates silently in the background.
export const PUBLIC_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24 hours max staleness
export const EDITORIAL_PHOTOS_TTL_MS = 1000 * 60 * 30; // 30 minutes

interface CachedPublicEnvelope {
  version: 2;
  savedAt: number;
  data: Partial<TournamentState>;
}

interface CachedPhotosEnvelope {
  version: 1;
  savedAt: number;
  data: Editorial2025Photos;
}

/**
 * Strips ALL PII, private user lists, unpublished drafts, and non-approved transfer requests
 * before persisting a public snapshot to localStorage.
 */
export function sanitizePublicStateForCache(state: Partial<TournamentState>): Partial<TournamentState> {
  return {
    temporada: state.temporada,
    homeFeatured: state.homeFeatured,
    driveUploadRootFolderId: state.driveUploadRootFolderId,
    driveUploadRootFolderName: state.driveUploadRootFolderName,
    masterSheets: state.masterSheets,
    autoSyncSheetsEnabled: state.autoSyncSheetsEnabled,
    lastSyncedSpreadsheetId: state.lastSyncedSpreadsheetId,
    lastSyncedAt: state.lastSyncedAt,
    configs: state.configs,
    teams: state.teams?.map((t) => ({
      ...t,
      capitanCorreo: undefined,
    })),
    players: state.players?.map((p) => ({
      ...p,
      rut: '',
      numeroMatricula: '',
      correoInstitucional: '',
      fechaNacimiento: '',
      // Avoid bloating localStorage with giant base64 photos
      fotografia: p.fotografia && p.fotografia.startsWith('data:') ? '' : p.fotografia,
    })),
    matches: state.matches?.map((m) => ({
      ...m,
      scoresheetValidation: m.scoresheetValidation
        ? {
            ...m.scoresheetValidation,
            imagePreview: undefined,
          }
        : undefined,
    })),
    transfers: state.transfers?.filter((tr) => tr.estado === 'APROBADA'),
    mvpVotes: state.mvpVotes,
    awardNominees: state.awardNominees,
    championshipMvpVotes: state.championshipMvpVotes,
    positionAwardVotes: state.positionAwardVotes,
    totyBallots: state.totyBallots,
    totyConfigs: state.totyConfigs,
    totyVotingDeadline: state.totyVotingDeadline,
    photos: state.photos?.slice(0, 80).map((ph) => ({
      ...ph,
      imageUrl: ph.imageUrl.startsWith('data:') ? '' : ph.imageUrl,
    })),
    news: state.news?.filter((n) => n.published),
    leyendasLeaderboard: state.leyendasLeaderboard?.slice(0, 60),
  };
}

export function loadCachedPublicTournamentState(
  storage: Pick<Storage, 'getItem'> | undefined = typeof window !== 'undefined' ? window.localStorage : undefined,
  nowMs: number = Date.now()
): { data: Partial<TournamentState>; savedAt: number } | null {
  try {
    if (!storage) return null;
    const raw = storage.getItem(PUBLIC_STATE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPublicEnvelope;
    if (!parsed || parsed.version !== 2 || typeof parsed.savedAt !== 'number' || !parsed.data) {
      return null;
    }
    if (nowMs - parsed.savedAt > PUBLIC_CACHE_MAX_AGE_MS) {
      return null;
    }
    return { data: parsed.data, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

export function saveCachedPublicTournamentState(
  state: Partial<TournamentState>,
  storage: Pick<Storage, 'setItem'> | undefined = typeof window !== 'undefined' ? window.localStorage : undefined,
  nowMs: number = Date.now()
): boolean {
  try {
    if (!storage) return false;
    const sanitized = sanitizePublicStateForCache(state);
    const envelope: CachedPublicEnvelope = {
      version: 2,
      savedAt: nowMs,
      data: sanitized,
    };
    const serialized = JSON.stringify(envelope);
    // Keep cache well under typical 5MB localStorage limit
    if (serialized.length > 2_500_000) {
      const compact: CachedPublicEnvelope = {
        version: 2,
        savedAt: nowMs,
        data: {
          ...sanitized,
          teams: sanitized.teams?.map((t) => ({
            ...t,
            escudo: t.escudo && t.escudo.startsWith('data:') ? undefined : t.escudo,
          })),
          photos: [],
        },
      };
      storage.setItem(PUBLIC_STATE_CACHE_KEY, JSON.stringify(compact));
      return true;
    }
    storage.setItem(PUBLIC_STATE_CACHE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

export function loadCachedEditorialPhotos(
  storage: Pick<Storage, 'getItem'> | undefined = typeof window !== 'undefined' ? window.localStorage : undefined,
  nowMs: number = Date.now()
): { data: Editorial2025Photos; isFresh: boolean } | null {
  try {
    if (!storage) return null;
    const raw = storage.getItem(EDITORIAL_PHOTOS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPhotosEnvelope;
    if (!parsed || parsed.version !== 1 || !parsed.data || typeof parsed.savedAt !== 'number') {
      return null;
    }
    return {
      data: parsed.data,
      isFresh: nowMs - parsed.savedAt < EDITORIAL_PHOTOS_TTL_MS,
    };
  } catch {
    return null;
  }
}

export function saveCachedEditorialPhotos(
  photos: Editorial2025Photos,
  storage: Pick<Storage, 'setItem'> | undefined = typeof window !== 'undefined' ? window.localStorage : undefined,
  nowMs: number = Date.now()
): boolean {
  try {
    if (!storage) return false;
    const envelope: CachedPhotosEnvelope = {
      version: 1,
      savedAt: nowMs,
      data: photos,
    };
    storage.setItem(EDITORIAL_PHOTOS_CACHE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}
