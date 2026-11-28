import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { createInitialTournamentState } from '../data/ufroSeed';
import type { NavSection } from '../domain/navigationRoutes';
import {
  getLazyCollectionsForSection,
  isCacheTimestampFresh,
  mergeLazyPlayersPreservingPii,
  PLAYERS_PREVIEW_LIMIT,
  PUBLIC_CORE_CACHE_TTL_MS,
  SECTION_CACHE_TTL_MS,
  TEAM_ROSTER_CACHE_TTL_MS,
} from '../domain/readOptimizationEngine';
import {
  CORE_REALTIME_STREAMS,
  computeInitialSyncPhase,
  mergePublicNewsPreservingDrafts,
  mergePublicTransfersPreservingPrivate,
  type CoreRealtimeStreamKey,
  type PublicRealtimeStreamKey,
} from '../domain/realtimeSyncEngine';
import {
  classifyFirestoreError,
  computeSyncHealthSummary,
  createInitialSyncHealthState,
  markSyncStreamHealthy,
  recordSyncIncident,
  shouldEmitThrottledQuotaLog,
  type CloudErrorKind,
  type SyncHealthState,
} from '../domain/syncHealthEngine';
import { mergeTotyBallotsIntoState } from '../domain/totyBatchQueue';
import {
  fetchApprovedTransfersBounded,
  fetchCorePublicTournamentSnapshot,
  fetchPlayersByTeam,
  fetchPlayersPreview,
  fetchPublicNewsBounded,
  fetchPublicPhotosBounded,
  fetchVotingSecondaryForDiscipline,
  fetchWeeklyLeyendasBounded,
  searchPlayersInFirestoreByName,
} from '../services/firestoreService';
import {
  fetch2025RandomEditorialPhotos,
  type Editorial2025Photos,
} from '../services/googleDrive';
import {
  loadCachedEditorialPhotos,
  loadCachedPublicTournamentState,
  saveCachedEditorialPhotos,
  saveCachedPublicTournamentState,
} from '../services/localCache';
import { loadAllCachedTotyData } from '../services/totyIndexedCache';
import type { DisciplineId, Player, TournamentState, UserRole } from '../types/tournament';

export interface InitialBootSnapshot {
  state: TournamentState;
  hasCachedSnapshot: boolean;
  cachedAtMs: number | null;
  totyCachedAtIso: string | null;
}

export function buildInitialBootSnapshot(): InitialBootSnapshot {
  const base = createInitialTournamentState();
  const cached = loadCachedPublicTournamentState();
  const indexedToty = loadAllCachedTotyData();
  const totyCachedAtIso = indexedToty.latestSavedAt
    ? new Date(indexedToty.latestSavedAt).toISOString()
    : null;

  const baseTotyBallots = cached?.data?.totyBallots ?? base.totyBallots;
  const mergedTotyBallots =
    indexedToty.ballots.length > 0
      ? mergeTotyBallotsIntoState(baseTotyBallots, indexedToty.ballots)
      : baseTotyBallots;
  const mergedTotyConfigs = {
    ...(cached?.data?.totyConfigs ?? base.totyConfigs),
    ...indexedToty.configs,
  };

  if (!cached?.data) {
    return {
      state: {
        ...base,
        totyBallots: mergedTotyBallots,
        totyConfigs: mergedTotyConfigs,
      },
      hasCachedSnapshot: false,
      cachedAtMs: null,
      totyCachedAtIso,
    };
  }

  const merged: TournamentState = {
    ...base,
    ...cached.data,
    configs: cached.data.configs ?? base.configs,
    masterSheets: cached.data.masterSheets ?? base.masterSheets,
    teams: cached.data.teams ?? base.teams,
    players: cached.data.players ?? base.players,
    matches: cached.data.matches ?? base.matches,
    transfers: cached.data.transfers ?? base.transfers,
    mvpVotes: cached.data.mvpVotes ?? base.mvpVotes,
    awardNominees: cached.data.awardNominees ?? base.awardNominees,
    championshipMvpVotes: cached.data.championshipMvpVotes ?? base.championshipMvpVotes,
    positionAwardVotes: cached.data.positionAwardVotes ?? base.positionAwardVotes,
    totyBallots: mergedTotyBallots,
    totyConfigs: mergedTotyConfigs,
    photos: cached.data.photos ?? base.photos,
    news: cached.data.news ?? base.news,
    leyendasLeaderboard: cached.data.leyendasLeaderboard ?? base.leyendasLeaderboard,
  };

  const hasMeaningfulData =
    merged.teams.length > 0 ||
    merged.players.length > 0 ||
    merged.matches.length > 0 ||
    merged.news.length > 0 ||
    Boolean(merged.homeFeatured);

  return {
    state: merged,
    hasCachedSnapshot: hasMeaningfulData,
    cachedAtMs: cached.savedAt,
    totyCachedAtIso,
  };
}

interface UseTournamentCoreDataParams {
  initialBoot: InitialBootSnapshot;
  state: TournamentState;
  setState: Dispatch<SetStateAction<TournamentState>>;
  stateRef: MutableRefObject<TournamentState>;
  currentUserRoleRef: MutableRefObject<UserRole | null>;
  activeSection: NavSection;
  selectedDiscipline: DisciplineId;
  activeNewsArticleId: string | null;
}

export function useTournamentCoreData({
  initialBoot,
  state,
  setState,
  stateRef,
  currentUserRoleRef,
  activeSection,
  selectedDiscipline,
  activeNewsArticleId,
}: UseTournamentCoreDataParams) {
  const [editorialPhotos, setEditorialPhotos] = useState<Editorial2025Photos | null>(
    () => loadCachedEditorialPhotos()?.data ?? null
  );
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [syncHealthState, setSyncHealthState] = useState<SyncHealthState>(() =>
    createInitialSyncHealthState()
  );
  const [dismissedPublicNoticeKind, setDismissedPublicNoticeKind] =
    useState<CloudErrorKind | null>(null);
  const lastQuotaLogAtRef = useRef<number | null>(null);

  const [settledCoreStreams, setSettledCoreStreams] = useState<Set<CoreRealtimeStreamKey>>(
    () => new Set()
  );
  const [failedCoreStreams, setFailedCoreStreams] = useState<Set<CoreRealtimeStreamKey>>(
    () => new Set()
  );
  const [initialSyncTimedOut, setInitialSyncTimedOut] = useState(false);
  const [initialSyncErrorDetail, setInitialSyncErrorDetail] = useState<string | null>(null);
  const [realtimeRetryNonce, setRealtimeRetryNonce] = useState(0);

  const lazyFetchedAtRef = useRef<Record<string, number>>({});
  const teamRosterFetchedAtRef = useRef<Record<string, number>>({});
  const searchedQueriesAtRef = useRef<Record<string, number>>({});
  const adminFullPlayersLoadedRef = useRef(false);

  const syncHealth = useMemo(
    () =>
      computeSyncHealthSummary(syncHealthState, {
        usingLocalCache: initialBoot.hasCachedSnapshot,
      }),
    [syncHealthState, initialBoot.hasCachedSnapshot]
  );

  const initialSyncPhase = useMemo(
    () =>
      computeInitialSyncPhase({
        hasCachedSnapshot: initialBoot.hasCachedSnapshot,
        settledCoreStreams,
        failedCoreStreams,
        timedOut: initialSyncTimedOut,
      }),
    [
      initialBoot.hasCachedSnapshot,
      settledCoreStreams,
      failedCoreStreams,
      initialSyncTimedOut,
    ]
  );

  const clearCloudError = useCallback(() => setCloudError(null), []);

  const markPlayersStreamHealthy = useCallback(() => {
    setSyncHealthState((prev) => markSyncStreamHealthy(prev, 'players'));
  }, []);

  const reportCloudError = useCallback((context: string, err: unknown, streamKey?: string) => {
    const kind = classifyFirestoreError(err);
    const nowMs = Date.now();

    setSyncHealthState((prev) =>
      recordSyncIncident(prev, {
        streamKey,
        context,
        err,
        nowIso: new Date(nowMs).toISOString(),
      })
    );

    if (kind === 'quota_exceeded') {
      if (shouldEmitThrottledQuotaLog(lastQuotaLogAtRef.current, nowMs)) {
        lastQuotaLogAtRef.current = nowMs;
        console.warn(`[Firestore] ${context} (límite diario de lecturas alcanzado).`);
      }
      return;
    }

    const detail =
      err instanceof Error ? err.message : 'Error de sincronización con la base de datos.';
    console.error(`[DB] ${context}:`, err);
    setCloudError(`${context}: ${detail}`);
  }, []);

  const handleRetryInitialSync = useCallback(() => {
    setSettledCoreStreams(new Set());
    setFailedCoreStreams(new Set());
    setInitialSyncTimedOut(false);
    setInitialSyncErrorDetail(null);
    setCloudError(null);
    setSyncHealthState(createInitialSyncHealthState());
    setDismissedPublicNoticeKind(null);
    lastQuotaLogAtRef.current = null;
    lazyFetchedAtRef.current = {};
    teamRosterFetchedAtRef.current = {};
    searchedQueriesAtRef.current = {};
    adminFullPlayersLoadedRef.current = false;
    setRealtimeRetryNonce((n) => n + 1);
  }, []);

  const handleLoadTeamPlayers = useCallback(
    async (teamId: string, disciplineId?: DisciplineId): Promise<Player[]> => {
      if (!teamId) return [];
      const nowMs = Date.now();
      const cachedLocal = stateRef.current.players.filter((p) => p.teamId === teamId);
      if (
        isCacheTimestampFresh(
          teamRosterFetchedAtRef.current[teamId],
          nowMs,
          TEAM_ROSTER_CACHE_TTL_MS
        )
      ) {
        return cachedLocal;
      }

      const resolvedDiscipline =
        disciplineId ?? stateRef.current.teams.find((t) => t.id === teamId)?.disciplineId;
      try {
        const fetched = await fetchPlayersByTeam(teamId, resolvedDiscipline);
        teamRosterFetchedAtRef.current[teamId] = Date.now();
        setSyncHealthState((prev) => markSyncStreamHealthy(prev, 'players'));
        if (fetched.length > 0) {
          setState((prev) => ({
            ...prev,
            players: mergeLazyPlayersPreservingPii(prev.players, fetched),
          }));
        }
        return fetched.length > 0 ? fetched : cachedLocal;
      } catch (err) {
        reportCloudError('Cargando plantel del equipo', err, 'players');
        return cachedLocal;
      }
    },
    [reportCloudError, setState, stateRef]
  );

  const handleSearchPlayers = useCallback(
    async (rawQuery: string, disciplineId?: DisciplineId): Promise<Player[]> => {
      const cleaned = rawQuery.trim();
      if (cleaned.length < 2) return [];
      const cacheKey = `${disciplineId ?? 'ALL'}::${cleaned.toLowerCase()}`;
      const nowMs = Date.now();
      if (isCacheTimestampFresh(searchedQueriesAtRef.current[cacheKey], nowMs, SECTION_CACHE_TTL_MS)) {
        return [];
      }

      try {
        const fetched = await searchPlayersInFirestoreByName(cleaned, disciplineId);
        searchedQueriesAtRef.current[cacheKey] = Date.now();
        setSyncHealthState((prev) => markSyncStreamHealthy(prev, 'players'));
        if (fetched.length > 0) {
          setState((prev) => ({
            ...prev,
            players: mergeLazyPlayersPreservingPii(prev.players, fetched),
          }));
        }
        return fetched;
      } catch (err) {
        reportCloudError('Buscando jugadores por nombre', err, 'players');
        return [];
      }
    },
    [reportCloudError, setState]
  );

  // 1. Core Cache-First Boot
  useEffect(() => {
    let cancelled = false;
    const allCoreKeys: CoreRealtimeStreamKey[] = [...CORE_REALTIME_STREAMS];

    const markAllCoreReady = () => {
      setSettledCoreStreams(new Set(allCoreKeys));
      setFailedCoreStreams(new Set());
      setSyncHealthState((prev) =>
        (['settings', 'configs', 'teams', 'matches'] as PublicRealtimeStreamKey[]).reduce(
          (acc, k) => markSyncStreamHealthy(acc, k),
          prev
        )
      );
    };

    if (
      realtimeRetryNonce === 0 &&
      initialBoot.hasCachedSnapshot &&
      isCacheTimestampFresh(initialBoot.cachedAtMs, Date.now(), PUBLIC_CORE_CACHE_TTL_MS)
    ) {
      markAllCoreReady();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setInitialSyncTimedOut(true);
    }, 10_000);

    fetchCorePublicTournamentSnapshot()
      .then((core) => {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          temporada: core.settings?.temporada ?? prev.temporada,
          homeFeatured:
            core.settings?.homeFeatured !== undefined
              ? core.settings.homeFeatured
              : prev.homeFeatured,
          totyVotingDeadline: core.settings
            ? core.settings.totyVotingDeadline || undefined
            : prev.totyVotingDeadline,
          driveUploadRootFolderId:
            core.settings?.driveUploadRootFolderId ?? prev.driveUploadRootFolderId,
          driveUploadRootFolderName:
            core.settings?.driveUploadRootFolderName ?? prev.driveUploadRootFolderName,
          masterSheets: core.settings?.masterSheets ?? prev.masterSheets,
          autoSyncSheetsEnabled:
            core.settings?.autoSyncSheetsEnabled ?? prev.autoSyncSheetsEnabled,
          lastSyncedSpreadsheetId:
            core.settings?.lastSyncedSpreadsheetId ?? prev.lastSyncedSpreadsheetId,
          lastSyncedAt: core.settings?.lastSyncedAt ?? prev.lastSyncedAt,
          configs: core.configs ?? prev.configs,
          teams: core.teams ?? prev.teams,
          matches: core.matches ?? prev.matches,
        }));

        if (core.settledStreams.length > 0) {
          setSyncHealthState((prev) =>
            core.settledStreams.reduce((acc, k) => markSyncStreamHealthy(acc, k), prev)
          );
          setSettledCoreStreams((prev) => {
            const next = new Set(prev);
            for (const s of core.settledStreams) {
              if (allCoreKeys.includes(s as CoreRealtimeStreamKey)) {
                next.add(s as CoreRealtimeStreamKey);
              }
            }
            next.add('players');
            next.add('news');
            return next;
          });
        }

        if (core.errors.length > 0) {
          const failedKeys = new Set<CoreRealtimeStreamKey>();
          let firstDetail: string | null = null;
          let loggedQuota = false;

          setSyncHealthState((prev) => {
            let next = prev;
            for (const item of core.errors) {
              const kind = classifyFirestoreError(item.error);
              if (kind === 'quota_exceeded' && !loggedQuota) {
                loggedQuota = true;
                const nowMs = Date.now();
                if (shouldEmitThrottledQuotaLog(lastQuotaLogAtRef.current, nowMs)) {
                  lastQuotaLogAtRef.current = nowMs;
                  console.warn('[Firestore] Cuota diaria de lecturas alcanzada (carga principal).');
                }
              }
              next = recordSyncIncident(next, {
                streamKey: item.stream,
                context:
                  kind === 'quota_exceeded'
                    ? 'Cuota diaria alcanzada'
                    : `Error leyendo colección ${item.stream}`,
                err: item.error,
              });
              if (allCoreKeys.includes(item.stream as CoreRealtimeStreamKey)) {
                failedKeys.add(item.stream as CoreRealtimeStreamKey);
              }
              if (!firstDetail && item.error instanceof Error) {
                firstDetail = item.error.message;
              }
            }
            return next;
          });

          if (failedKeys.size > 0) {
            setFailedCoreStreams(failedKeys);
            setInitialSyncErrorDetail(
              (prev) => prev ?? firstDetail ?? 'Error al sincronizar los datos principales.'
            );
          }
        } else {
          markAllCoreReady();
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const detail =
          err instanceof Error ? err.message : 'Error al sincronizar los datos principales.';
        const kind = classifyFirestoreError(err);

        setSyncHealthState((prev) =>
          recordSyncIncident(prev, {
            streamKey: 'teams',
            context:
              kind === 'quota_exceeded'
                ? 'Cuota diaria alcanzada'
                : 'Error leyendo datos principales del torneo',
            err,
          })
        );

        setFailedCoreStreams(new Set(['settings', 'configs', 'teams', 'matches']));
        setInitialSyncErrorDetail((prev) => prev ?? detail);
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [realtimeRetryNonce, initialBoot.hasCachedSnapshot, initialBoot.cachedAtMs, setState]);

  // 2. Section-scoped lazy data loaders (+ direct /noticias/:id hydration)
  useEffect(() => {
    let cancelled = false;
    const needed = [...getLazyCollectionsForSection(activeSection)];
    if (activeNewsArticleId && !needed.includes('news')) {
      needed.push('news');
    }
    if (needed.length === 0) return;

    const nowMs = Date.now();
    const bootCacheFresh =
      realtimeRetryNonce === 0 &&
      initialBoot.hasCachedSnapshot &&
      isCacheTimestampFresh(initialBoot.cachedAtMs, nowMs, PUBLIC_CORE_CACHE_TTL_MS);

    for (const key of needed) {
      const ttlKey = key === 'votingSecondary' ? `votingSecondary:${selectedDiscipline}` : key;
      const missingDirectNews =
        key === 'news' &&
        Boolean(activeNewsArticleId) &&
        !stateRef.current.news.some((n) => n.id === activeNewsArticleId);

      if (
        !missingDirectNews &&
        isCacheTimestampFresh(lazyFetchedAtRef.current[ttlKey], nowMs, SECTION_CACHE_TTL_MS)
      ) {
        continue;
      }

      if (key === 'news') {
        if (!missingDirectNews && bootCacheFresh && stateRef.current.news.length > 0) {
          lazyFetchedAtRef.current[ttlKey] = nowMs;
          continue;
        }
        lazyFetchedAtRef.current[ttlKey] = nowMs;
        fetchPublicNewsBounded(25)
          .then((publishedNews) => {
            if (cancelled) return;
            const keepDrafts =
              currentUserRoleRef.current === 'admin' ||
              currentUserRoleRef.current === 'moderador' ||
              currentUserRoleRef.current === 'prensa';
            setState((prev) => ({
              ...prev,
              news: mergePublicNewsPreservingDrafts(prev.news, publishedNews, keepDrafts),
            }));
            setSyncHealthState((prev) => markSyncStreamHealthy(prev, 'news'));
          })
          .catch((err) => {
            delete lazyFetchedAtRef.current[ttlKey];
            reportCloudError('Cargando noticias del campeonato', err, 'news');
          });
      } else if (key === 'playersPreview') {
        if (bootCacheFresh && stateRef.current.players.length >= PLAYERS_PREVIEW_LIMIT) {
          lazyFetchedAtRef.current[ttlKey] = nowMs;
          continue;
        }
        lazyFetchedAtRef.current[ttlKey] = nowMs;
        fetchPlayersPreview(PLAYERS_PREVIEW_LIMIT)
          .then((previewPlayers) => {
            if (cancelled) return;
            setState((prev) => ({
              ...prev,
              players: mergeLazyPlayersPreservingPii(prev.players, previewPlayers),
            }));
            setSyncHealthState((prev) => markSyncStreamHealthy(prev, 'players'));
          })
          .catch((err) => {
            delete lazyFetchedAtRef.current[ttlKey];
            reportCloudError('Cargando vista previa de jugadores', err, 'players');
          });
      } else if (key === 'photos') {
        if (bootCacheFresh && stateRef.current.photos.length > 0) {
          lazyFetchedAtRef.current[ttlKey] = nowMs;
          continue;
        }
        lazyFetchedAtRef.current[ttlKey] = nowMs;
        fetchPublicPhotosBounded(60)
          .then((photos) => {
            if (cancelled) return;
            setState((prev) => ({ ...prev, photos }));
            setSyncHealthState((prev) => markSyncStreamHealthy(prev, 'photos'));
          })
          .catch((err) => {
            delete lazyFetchedAtRef.current[ttlKey];
            reportCloudError('Cargando galería fotográfica', err, 'photos');
          });
      } else if (key === 'transfers') {
        if (bootCacheFresh && stateRef.current.transfers.length > 0) {
          lazyFetchedAtRef.current[ttlKey] = nowMs;
          continue;
        }
        lazyFetchedAtRef.current[ttlKey] = nowMs;
        fetchApprovedTransfersBounded(60)
          .then((approvedTransfers) => {
            if (cancelled) return;
            const keepPrivate =
              currentUserRoleRef.current === 'admin' ||
              currentUserRoleRef.current === 'moderador' ||
              currentUserRoleRef.current === 'delegado';
            setState((prev) => ({
              ...prev,
              transfers: mergePublicTransfersPreservingPrivate(
                prev.transfers,
                approvedTransfers,
                keepPrivate
              ),
            }));
            setSyncHealthState((prev) => markSyncStreamHealthy(prev, 'transfers'));
          })
          .catch((err) => {
            delete lazyFetchedAtRef.current[ttlKey];
            reportCloudError('Cargando registro de transferencias', err, 'transfers');
          });
      } else if (key === 'leyendasLeaderboard') {
        if (bootCacheFresh && stateRef.current.leyendasLeaderboard.length > 0) {
          lazyFetchedAtRef.current[ttlKey] = nowMs;
          continue;
        }
        lazyFetchedAtRef.current[ttlKey] = nowMs;
        fetchWeeklyLeyendasBounded(50)
          .then((leyendasLeaderboard) => {
            if (cancelled) return;
            setState((prev) => ({ ...prev, leyendasLeaderboard }));
            setSyncHealthState((prev) => markSyncStreamHealthy(prev, 'leyendasLeaderboard'));
          })
          .catch((err) => {
            delete lazyFetchedAtRef.current[ttlKey];
            reportCloudError('Cargando ranking de Leyendas UFRO', err, 'leyendasLeaderboard');
          });
      } else if (key === 'votingSecondary') {
        lazyFetchedAtRef.current[ttlKey] = nowMs;
        const disc = selectedDiscipline;
        fetchVotingSecondaryForDiscipline(disc)
          .then((res) => {
            if (cancelled) return;
            setState((prev) => ({
              ...prev,
              awardNominees: res.awardNominees
                ? { ...prev.awardNominees, ...res.awardNominees }
                : prev.awardNominees,
              mvpVotes: res.mvpVotes
                ? [...prev.mvpVotes.filter((v) => v.disciplineId !== disc), ...res.mvpVotes]
                : prev.mvpVotes,
              championshipMvpVotes: res.championshipMvpVotes
                ? [
                    ...prev.championshipMvpVotes.filter((v) => v.disciplineId !== disc),
                    ...res.championshipMvpVotes,
                  ]
                : prev.championshipMvpVotes,
              positionAwardVotes: res.positionAwardVotes
                ? [
                    ...prev.positionAwardVotes.filter((v) => v.disciplineId !== disc),
                    ...res.positionAwardVotes,
                  ]
                : prev.positionAwardVotes,
              players:
                res.nominatedPlayers.length > 0
                  ? mergeLazyPlayersPreservingPii(prev.players, res.nominatedPlayers)
                  : prev.players,
            }));
            setSyncHealthState((prev) => markSyncStreamHealthy(prev, 'mvpVotes'));
          })
          .catch((err) => {
            delete lazyFetchedAtRef.current[ttlKey];
            reportCloudError('Cargando nominados y votaciones de disciplina', err, 'mvpVotes');
          });
      }
    }

    return () => {
      cancelled = true;
    };
  }, [
    activeSection,
    selectedDiscipline,
    activeNewsArticleId,
    realtimeRetryNonce,
    initialBoot.hasCachedSnapshot,
    initialBoot.cachedAtMs,
    currentUserRoleRef,
    reportCloudError,
    setState,
    stateRef,
  ]);

  // 3. Persist public state snapshot to localStorage for offline field access
  useEffect(() => {
    if (initialSyncPhase !== 'ready') return;
    const timer = window.setTimeout(() => {
      saveCachedPublicTournamentState(state);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [
    initialSyncPhase,
    state.temporada,
    state.homeFeatured,
    state.totyVotingDeadline,
    state.configs,
    state.teams,
    state.players,
    state.matches,
    state.transfers,
    state.mvpVotes,
    state.awardNominees,
    state.championshipMvpVotes,
    state.positionAwardVotes,
    state.totyBallots,
    state.totyConfigs,
    state.photos,
    state.news,
    state.leyendasLeaderboard,
  ]);

  // 4. Editorial 2025 photos (30-min cache)
  useEffect(() => {
    const cachedPhotos = loadCachedEditorialPhotos();
    if (cachedPhotos?.isFresh && cachedPhotos.data?.heroUrl) {
      return;
    }
    let active = true;
    fetch2025RandomEditorialPhotos()
      .then((photos) => {
        if (!active) return;
        setEditorialPhotos(photos);
        saveCachedEditorialPhotos(photos);
      })
      .catch(() => {
        // Non-fatal fallback
      });
    return () => {
      active = false;
    };
  }, []);

  return {
    editorialPhotos,
    cloudError,
    setCloudError,
    clearCloudError,
    syncHealth,
    dismissedPublicNoticeKind,
    setDismissedPublicNoticeKind,
    initialSyncPhase,
    initialSyncErrorDetail,
    realtimeRetryNonce,
    adminFullPlayersLoadedRef,
    markPlayersStreamHealthy,
    reportCloudError,
    handleRetryInitialSync,
    handleLoadTeamPlayers,
    handleSearchPlayers,
  };
}
