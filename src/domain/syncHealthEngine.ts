export type CloudErrorKind = 'quota_exceeded' | 'permission_denied' | 'network' | 'unknown';

export type CloudSyncStatus = 'syncing' | 'healthy' | 'degraded' | 'quota_exceeded';

export interface CloudSyncIncident {
  kind: CloudErrorKind;
  context: string;
  detail: string;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrences: number;
  affectedStreams: string[];
}

export interface SyncHealthState {
  settledStreams: string[];
  failedStreams: string[];
  lastSuccessfulSyncAt: string | null;
  incident: CloudSyncIncident | null;
}

export interface SyncHealthSummary {
  status: CloudSyncStatus;
  statusLabel: string;
  quotaExceeded: boolean;
  hasReadIssues: boolean;
  activeStreamsCount: number;
  failedStreamsCount: number;
  totalTrackedStreams: number;
  settledStreams: string[];
  failedStreams: string[];
  affectedStreamLabels: string[];
  lastSuccessfulSyncAt: string | null;
  incident: CloudSyncIncident | null;
  usingLocalCache: boolean;
  publicNoticeMessage: string;
  adminHeadline: string;
  adminDescription: string;
}

export const PUBLIC_STREAM_LABELS: Record<string, string> = {
  settings: 'Configuración general',
  configs: 'Formatos por disciplina',
  teams: 'Equipos',
  players: 'Jugadores',
  matches: 'Partidos y marcadores',
  news: 'Noticias',
  transfers: 'Transferencias',
  photos: 'Galería',
  mvpVotes: 'Votos POTM',
  awardNominees: 'Nominados MVP',
  championshipMvpVotes: 'Votos MVP torneo',
  positionAwardVotes: 'Premios por posición',
  leyendasLeaderboard: 'Ranking Leyendas',
  toty: 'Votaciones TOTYs',
};

export const PUBLIC_TOTAL_TRACKED_STREAMS = 13;
export const QUOTA_LOG_COOLDOWN_MS = 60_000;

export const PUBLIC_READ_DEGRADED_NOTICE =
  'La web está presentando problemas temporales de lectura de datos, por lo que parte de la información podría cargarse de forma parcial o no mostrarse en su totalidad.';

export function createInitialSyncHealthState(): SyncHealthState {
  return {
    settledStreams: [],
    failedStreams: [],
    lastSuccessfulSyncAt: null,
    incident: null,
  };
}

/**
 * Classifies raw Firestore/Firebase errors into structured categories so the UI
 * can separate public-friendly messaging from Admin diagnostic telemetry.
 */
export function classifyFirestoreError(err: unknown): CloudErrorKind {
  const code = String((err as { code?: string })?.code ?? '').toLowerCase();
  const message = (
    err instanceof Error ? err.message : typeof err === 'string' ? err : String(err ?? '')
  ).toLowerCase();
  const combined = `${code} ${message}`;

  if (
    combined.includes('quota exceeded') ||
    combined.includes('quota limit exceeded') ||
    combined.includes('resource-exhausted') ||
    combined.includes('free daily read units') ||
    combined.includes('daily read units')
  ) {
    return 'quota_exceeded';
  }

  if (
    combined.includes('permission-denied') ||
    combined.includes('permission denied') ||
    combined.includes('missing or insufficient permissions')
  ) {
    return 'permission_denied';
  }

  if (
    combined.includes('unavailable') ||
    combined.includes('network') ||
    combined.includes('offline') ||
    combined.includes('failed to get document because the client is offline') ||
    combined.includes('deadline-exceeded')
  ) {
    return 'network';
  }

  return 'unknown';
}

export function extractErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err.trim();
  return 'Error de sincronización con la base de datos.';
}

/**
 * Throttles repetitive console logging when all 13+ Firestore streams fail simultaneously
 * due to a project-wide quota limit.
 */
export function shouldEmitThrottledQuotaLog(
  lastLoggedAtMs: number | null,
  nowMs: number = Date.now(),
  cooldownMs: number = QUOTA_LOG_COOLDOWN_MS
): boolean {
  if (lastLoggedAtMs === null) return true;
  return nowMs - lastLoggedAtMs >= cooldownMs;
}

/**
 * Marks a Firestore stream as healthy and clears stale incident status once all
 * previously failing streams have recovered.
 */
export function markSyncStreamHealthy(
  state: SyncHealthState,
  streamKey: string,
  nowIso: string = new Date().toISOString()
): SyncHealthState {
  const settledSet = new Set(state.settledStreams);
  settledSet.add(streamKey);

  const failedSet = new Set(state.failedStreams);
  failedSet.delete(streamKey);

  const nextFailed = Array.from(failedSet);
  const nextIncident = nextFailed.length === 0 ? null : state.incident;

  return {
    settledStreams: Array.from(settledSet),
    failedStreams: nextFailed,
    lastSuccessfulSyncAt: nowIso,
    incident: nextIncident,
  };
}

/**
 * Deduplicates cloud/Firestore incidents across multiple streams into a single
 * consolidated incident record instead of spamming repeated error banners.
 */
export function recordSyncIncident(
  state: SyncHealthState,
  params: {
    streamKey?: string;
    context: string;
    err: unknown;
    nowIso?: string;
  }
): SyncHealthState {
  const { streamKey, context, err, nowIso = new Date().toISOString() } = params;
  const kind = classifyFirestoreError(err);
  const detail = extractErrorMessage(err);

  const failedSet = new Set(state.failedStreams);
  const settledSet = new Set(state.settledStreams);
  if (streamKey) {
    failedSet.add(streamKey);
    settledSet.delete(streamKey);
  }

  const prev = state.incident;
  // Prioritize quota_exceeded if either existing or incoming incident is quota_exceeded
  const resolvedKind: CloudErrorKind =
    prev?.kind === 'quota_exceeded' || kind === 'quota_exceeded' ? 'quota_exceeded' : kind;

  const affectedStreamsSet = new Set<string>(prev?.affectedStreams ?? []);
  if (streamKey) affectedStreamsSet.add(streamKey);

  const nextIncident: CloudSyncIncident = prev
    ? {
        kind: resolvedKind,
        context: resolvedKind === 'quota_exceeded' ? 'Cuota diaria de Firestore alcanzada' : context,
        detail: kind === 'quota_exceeded' ? detail : prev.detail,
        firstSeenAt: prev.firstSeenAt,
        lastSeenAt: nowIso,
        occurrences: prev.occurrences + 1,
        affectedStreams: Array.from(affectedStreamsSet),
      }
    : {
        kind: resolvedKind,
        context: resolvedKind === 'quota_exceeded' ? 'Cuota diaria de Firestore alcanzada' : context,
        detail,
        firstSeenAt: nowIso,
        lastSeenAt: nowIso,
        occurrences: 1,
        affectedStreams: Array.from(affectedStreamsSet),
      };

  return {
    settledStreams: Array.from(settledSet),
    failedStreams: Array.from(failedSet),
    lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
    incident: nextIncident,
  };
}

/**
 * Determines whether the calm public notice banner should be shown to regular visitors.
 * Once dismissed for the current incident kind in the active session, it stays silent
 * even when additional collections fail with the same root cause.
 */
export function shouldShowPublicReadNotice(params: {
  summary: SyncHealthSummary;
  dismissedKind: CloudErrorKind | null;
}): boolean {
  const { summary, dismissedKind } = params;
  if (!summary.hasReadIssues || !summary.incident) return false;
  if (dismissedKind === summary.incident.kind) return false;
  return true;
}

/**
 * Computes the complete diagnostic summary consumed by both the public reader notice
 * and the Administration General sync status card.
 */
export function computeSyncHealthSummary(
  state: SyncHealthState,
  options: {
    usingLocalCache: boolean;
    totalTrackedStreams?: number;
  }
): SyncHealthSummary {
  const totalTrackedStreams = options.totalTrackedStreams ?? PUBLIC_TOTAL_TRACKED_STREAMS;
  const activeStreamsCount = state.settledStreams.length;
  const failedStreamsCount = state.failedStreams.length;
  const quotaExceeded = state.incident?.kind === 'quota_exceeded';
  const hasReadIssues = quotaExceeded || failedStreamsCount > 0;

  let status: CloudSyncStatus = 'syncing';
  let statusLabel = 'Conectando';
  let adminHeadline = 'Sincronizando colecciones en tiempo real';
  let adminDescription = 'Estableciendo conexión con Firestore para cargar el campeonato.';

  if (quotaExceeded) {
    status = 'quota_exceeded';
    statusLabel = 'Cuota diaria alcanzada';
    adminHeadline = 'Límite diario de lecturas de Firestore excedido';
    adminDescription =
      'Firestore está rechazando lecturas hasta que la cuota gratuita se restablezca mañana o se actualice el plan. Los visitantes ven un aviso informativo discreto y los datos en caché local siguen disponibles cuando existen.';
  } else if (failedStreamsCount > 0) {
    status = 'degraded';
    statusLabel = 'Lectura parcial';
    adminHeadline = 'Problemas de sincronización en algunas colecciones';
    adminDescription =
      state.incident?.kind === 'network'
        ? 'Se detectaron interrupciones de red al leer desde Firestore. Puedes reintentar la sincronización cuando la conexión se estabilice.'
        : 'Una o más colecciones no pudieron sincronizarse correctamente. Revisa el detalle técnico e intenta reconectar.';
  } else if (activeStreamsCount > 0) {
    status = 'healthy';
    statusLabel = 'Sincronizado';
    adminHeadline = 'Base de datos sincronizada normalmente';
    adminDescription =
      'Todas las colecciones activas responden sin errores de cuota ni lectura.';
  }

  const affectedStreamLabels = (state.incident?.affectedStreams ?? state.failedStreams).map(
    (key) => PUBLIC_STREAM_LABELS[key] ?? key
  );

  return {
    status,
    statusLabel,
    quotaExceeded,
    hasReadIssues,
    activeStreamsCount,
    failedStreamsCount,
    totalTrackedStreams,
    settledStreams: state.settledStreams,
    failedStreams: state.failedStreams,
    affectedStreamLabels,
    lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
    incident: state.incident,
    usingLocalCache: options.usingLocalCache,
    publicNoticeMessage: PUBLIC_READ_DEGRADED_NOTICE,
    adminHeadline,
    adminDescription,
  };
}
