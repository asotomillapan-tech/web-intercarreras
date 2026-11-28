import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { AnimatePresence, MotionConfig } from 'motion/react';
import { PageTransition } from './components/MotionPrimitives';
import { createInitialTournamentState, DISCIPLINE_MAP } from './data/ufroSeed';
import {
  getSectionPath,
  getSectionTitle,
  normalizePathname,
  resolveSectionFromPath,
} from './domain/navigationRoutes';
import {
  canAssignReferees,
  canManageFormatAndSheets,
  canManageNews,
  canManageRoles,
  isAdminOrModerator,
  isRefereeOrChiefRole,
  validateRoleChange,
} from './domain/rbacEngine';
import { generateEquitableGroups, generateRoundRobinMatches } from './domain/tournamentEngine';
import { applyStatDeltaClamped, type PlayerStatDelta } from './domain/liveMatchEngine';
import {
  CORE_REALTIME_STREAMS,
  computeInitialSyncPhase,
  mergePublicNewsPreservingDrafts,
  mergePublicTransfersPreservingPrivate,
  type CoreRealtimeStreamKey,
  type PublicRealtimeStreamKey,
} from './domain/realtimeSyncEngine';
import {
  getLazyCollectionsForSection,
  isCacheTimestampFresh,
  mergeLazyPlayersPreservingPii,
  PLAYERS_PREVIEW_LIMIT,
  PUBLIC_CORE_CACHE_TTL_MS,
  SECTION_CACHE_TTL_MS,
  TEAM_ROSTER_CACHE_TTL_MS,
} from './domain/readOptimizationEngine';
import {
  enqueueTotyBallotItem,
  mergeTotyBallotsIntoState,
  planTotyBallotBatch,
  type TotyBallotBatchItem,
  type TotyBallotSubmissionInput,
} from './domain/totyBatchQueue';
import {
  classifyFirestoreError,
  computeSyncHealthSummary,
  createInitialSyncHealthState,
  markSyncStreamHealthy,
  recordSyncIncident,
  shouldEmitThrottledQuotaLog,
  shouldShowPublicReadNotice,
  type CloudErrorKind,
  type SyncHealthState,
} from './domain/syncHealthEngine';
import {
  getGoogleAccessToken,
  initGoogleAuth,
  signInWithGoogleBasic,
  signOutGoogle,
} from './services/firebaseAuth';
import {
  getMasterKeyForDiscipline,
  MASTER_SHEET_GROUP_MAP,
  syncMultipleMasterSheets,
} from './services/googleSheets';
import {
  hasAnySheetImports,
  type DeletedEntityIds,
  type SheetImportDelta,
} from './domain/sheetsMergeEngine';
import {
  adminUpdateFirestoreUserRole,
  approveFirestoreTransferRequest,
  bulkUpdateFirestoreTeams,
  createFirestoreTransferRequest,
  deleteFirestoreMatchesForDiscipline,
  deleteFirestoreNewsArticle,
  deleteFirestorePhoto,
  deleteFirestorePlayer,
  deleteFirestoreTeam,
  deleteFirestoreTotyConfig,
  ensureAllConfigsInFirestore,
  fetchAllFirestoreTotyData,
  fetchAllPlayersForAdmin,
  fetchApprovedTransfersBounded,
  fetchCorePublicTournamentSnapshot,
  fetchPlayerById,
  fetchPlayersByTeam,
  fetchPlayersPreview,
  fetchPublicNewsBounded,
  fetchPublicPhotosBounded,
  fetchPublicTotyConfigAndOwnBallot,
  fetchVotingSecondaryForDiscipline,
  fetchWeeklyLeyendasBounded,
  importAdminTotyBallotsToTurso,
  listAllFirestoreNews,
  listAllFirestoreTransfers,
  listDelegateFirestoreTransfers,
  listFirestoreRefereeRoster,
  listFirestoreUsers,
  loadAuthorizedPlayerPrivateMap,
  migrateTotyBallotsFromFirestoreToTurso,
  rejectFirestoreTransferRequest,
  saveFirestoreAwardNominees,
  saveFirestoreChampionshipMvpVote,
  saveFirestoreDisciplineConfig,
  saveFirestoreLeyendasEntry,
  saveFirestoreMatch,
  saveFirestoreMvpVote,
  saveFirestoreNewsArticle,
  saveFirestorePhoto,
  saveFirestorePlayer,
  saveFirestorePositionAwardVote,
  saveFirestoreSettings,
  saveFirestoreTeam,
  saveFirestoreTotyBallotsBatch,
  saveFirestoreTotyConfig,
  searchPlayersInFirestoreByName,
  syncGoogleUserToFirestore,
  syncRefereeRosterFromUsers,
  updateFirestorePlayerStats,
  updateFirestoreUserPreferences,
} from './services/firestoreService';
import {
  fetch2025RandomEditorialPhotos,
  type Editorial2025Photos,
} from './services/googleDrive';
import {
  loadCachedEditorialPhotos,
  loadCachedPublicTournamentState,
  saveCachedEditorialPhotos,
  saveCachedPublicTournamentState,
} from './services/localCache';
import {
  areAllTotyDisciplinesFresh,
  loadAllCachedTotyData,
  loadCachedTotyForDiscipline,
  removeCachedTotyConfig,
  saveAllCachedTotySnapshot,
  saveCachedTotyForDiscipline,
  upsertCachedTotyBallots,
  upsertCachedTotyConfig,
} from './services/totyIndexedCache';
import { AccountView } from './components/AccountView';
import { AdminRefereeView, type PanelSubTab } from './components/AdminRefereeView';
import { AuthModal } from './components/AuthModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { GalleryView } from './components/GalleryView';
import { HomeView } from './components/HomeView';
import { InitialLoadSkeleton } from './components/InitialLoadSkeleton';
import { MatchMvpModal } from './components/MatchMvpModal';
import { MinigamesView } from './components/MinigamesView';
import { Navbar, type NavSection } from './components/Navbar';
import { NewsArticleModal } from './components/NewsArticleModal';
import { PlayersView } from './components/PlayersView';
import { PrivacyPolicyView } from './components/PrivacyPolicyView';
import { PublicTransfersView } from './components/PublicTransfersView';
import { RegistrationView } from './components/RegistrationView';
import { StandingsView } from './components/StandingsView';
import { TeamProfileModal } from './components/TeamProfileModal';
import { TeamsView } from './components/TeamsView';
import { TransfersView } from './components/TransfersView';
import { VotationsView } from './components/VotationsView';
import type {
  AppUserProfile,
  ChampionshipMvpVoteRecord,
  DisciplineFormatConfig,
  DisciplineId,
  DisciplineTotyConfig,
  HomeFeaturedConfig,
  LeyendasLeaderboardEntry,
  MasterSheetKey,
  MasterSheetsConfig,
  Match,
  MvpVoteRecord,
  NewsArticle,
  PhotoEntry,
  Player,
  PositionAwardVoteRecord,
  Team,
  TotyBallotRecord,
  TournamentState,
  TransferRecord,
  UserRole,
} from './types/tournament';
import type { AutoSyncStatusInfo } from './components/MasterSheetsPanel';

function AppContent() {
  const [initialBoot] = useState<{
    state: TournamentState;
    hasCachedSnapshot: boolean;
    cachedAtMs: number | null;
    totyCachedAtIso: string | null;
  }>(() => {
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
  });
  const [state, setState] = useState<TournamentState>(() => initialBoot.state);
  const [activeSection, setActiveSection] = useState<NavSection>(() =>
    typeof window !== 'undefined' ? resolveSectionFromPath(window.location.pathname) : 'inicio'
  );
  const [selectedDiscipline, setSelectedDiscipline] = useState<DisciplineId>('f7-h-1');
  const [inspectedPlayer, setInspectedPlayer] = useState<Player | null>(null);
  const [inspectedTeamId, setInspectedTeamId] = useState<string | null>(null);
  const [editorialPhotos, setEditorialPhotos] = useState<Editorial2025Photos | null>(
    () => loadCachedEditorialPhotos()?.data ?? null
  );
  const [panelInitialSubTab, setPanelInitialSubTab] = useState<PanelSubTab>('arbitro');
  const [focusedMatchId, setFocusedMatchId] = useState<string | null>(null);

  // Auth, Modal & Cloud Sync Feedback State
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [activeMatchModalId, setActiveMatchModalId] = useState<string | null>(null);
  const [activeNewsArticle, setActiveNewsArticle] = useState<NewsArticle | null>(null);
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false);
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [syncHealthState, setSyncHealthState] = useState<SyncHealthState>(() =>
    createInitialSyncHealthState()
  );
  const [dismissedPublicNoticeKind, setDismissedPublicNoticeKind] = useState<CloudErrorKind | null>(
    null
  );
  const lastQuotaLogAtRef = useRef<number | null>(null);
  const [totyLastSyncAt, setTotyLastSyncAt] = useState<string | null>(
    () => initialBoot.totyCachedAtIso
  );
  const [totyRealtimeActive, setTotyRealtimeActive] = useState(false);
  const [pendingTotyDisciplines, setPendingTotyDisciplines] = useState<DisciplineId[]>([]);
  const persistedTotyBallotsRef = useRef<TotyBallotRecord[]>(initialBoot.state.totyBallots);
  const pendingTotyQueueRef = useRef<TotyBallotBatchItem[]>([]);
  const pendingTotyTimerRef = useRef<number | null>(null);
  const inFlightTotyDisciplinesRef = useRef<Set<DisciplineId>>(new Set());

  // Real-Time Initial Hydration State (prevents empty "0 equipos" flash on brand-new devices)
  const [settledCoreStreams, setSettledCoreStreams] = useState<Set<CoreRealtimeStreamKey>>(
    () => new Set()
  );
  const [failedCoreStreams, setFailedCoreStreams] = useState<Set<CoreRealtimeStreamKey>>(
    () => new Set()
  );
  const [initialSyncTimedOut, setInitialSyncTimedOut] = useState(false);
  const [initialSyncErrorDetail, setInitialSyncErrorDetail] = useState<string | null>(null);
  const [realtimeRetryNonce, setRealtimeRetryNonce] = useState(0);

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

  // Master Google Sheets Auto-Sync Engine (requires explicit session confirmation via ConfirmDialog)
  const [autoSyncSessionApproved, setAutoSyncSessionApproved] = useState(false);
  const [pendingSyncKeys, setPendingSyncKeys] = useState<MasterSheetKey[]>([]);
  const [deletedTombstones, setDeletedTombstones] = useState<DeletedEntityIds>({
    teamIds: [],
    playerIds: [],
    matchIds: [],
  });
  const [autoSyncState, setAutoSyncState] = useState<AutoSyncStatusInfo>({ status: 'idle' });
  const stateRef = useRef(state);
  const deletedTombstonesRef = useRef(deletedTombstones);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    deletedTombstonesRef.current = deletedTombstones;
  }, [deletedTombstones]);

  const queueMasterSyncForDiscipline = useCallback((disciplineId: DisciplineId) => {
    const primaryKey = getMasterKeyForDiscipline(disciplineId);
    setPendingSyncKeys((prev) => {
      const next = new Set<MasterSheetKey>(prev);
      next.add(primaryKey);
      if (stateRef.current.masterSheets.consolidado) {
        next.add('consolidado');
      }
      return Array.from(next);
    });
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
      // Do not spam raw quota dumps into the dismissible top error toast;
      // the single calm public read notice and Admin General diagnostics handle it cleanly.
      return;
    }

    const detail = err instanceof Error ? err.message : 'Error de sincronización con la base de datos.';
    console.error(`[DB] ${context}:`, err);
    setCloudError(`${context}: ${detail}`);
  }, []);

  const currentUserRoleRef = useRef<UserRole | null>(null);
  const lazyFetchedAtRef = useRef<Record<string, number>>({});
  const teamRosterFetchedAtRef = useRef<Record<string, number>>({});
  const searchedQueriesAtRef = useRef<Record<string, number>>({});
  const adminFullPlayersLoadedRef = useRef(false);

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

  // On-demand single-team roster loader (10-min per-team TTL -> 0 reads on repeat visits)
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
    [reportCloudError]
  );

  // On-demand index-free name search across Firestore (5-min query TTL, never downloads all players)
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
    [reportCloudError]
  );

  // 1. Optimized Cache-First Core Boot:
  // Replaces 13 eager onSnapshot listeners with a lightweight 4-collection core fetch
  // (settings, configs, teams, matches) skipped completely when the local cache is fresh (< 5 min).
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
            // players & news are intentionally lazy-loaded per section
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
                    ? 'Cuota diaria de Firestore alcanzada'
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
                ? 'Cuota diaria de Firestore alcanzada'
                : 'Error leyendo datos principales del torneo',
            err,
          })
        );

        if (kind === 'quota_exceeded') {
          const nowMs = Date.now();
          if (shouldEmitThrottledQuotaLog(lastQuotaLogAtRef.current, nowMs)) {
            lastQuotaLogAtRef.current = nowMs;
            console.warn('[Firestore] Cuota diaria de lecturas alcanzada (carga principal).');
          }
        }

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
  }, [realtimeRetryNonce, initialBoot.hasCachedSnapshot, initialBoot.cachedAtMs]);

  // 1-Lazy. Section-scoped bounded loaders (0 reads for unvisited sections or fresh cache hits)
  useEffect(() => {
    let cancelled = false;
    const needed = getLazyCollectionsForSection(activeSection);
    if (needed.length === 0) return;

    const nowMs = Date.now();
    const bootCacheFresh =
      realtimeRetryNonce === 0 &&
      initialBoot.hasCachedSnapshot &&
      isCacheTimestampFresh(initialBoot.cachedAtMs, nowMs, PUBLIC_CORE_CACHE_TTL_MS);

    for (const key of needed) {
      const ttlKey = key === 'votingSecondary' ? `votingSecondary:${selectedDiscipline}` : key;
      if (isCacheTimestampFresh(lazyFetchedAtRef.current[ttlKey], nowMs, SECTION_CACHE_TTL_MS)) {
        continue;
      }

      if (key === 'news') {
        if (bootCacheFresh && stateRef.current.news.length > 0) {
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
    realtimeRetryNonce,
    initialBoot.hasCachedSnapshot,
    initialBoot.cachedAtMs,
    reportCloudError,
  ]);

  // 1A. Debounced persistence of public tournament snapshot to localStorage (only after initial hydration)
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

  // 1B. Fetch random real photographs from the 2025 UFRO Google Drive gallery (with 30-min cache)
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
        // Non-fatal fallback: dark carbon editorial background remains clean
      });
    return () => {
      active = false;
    };
  }, []);

  const hydrateForAuthenticatedProfile = useCallback(
    async (profile: AppUserProfile, currentPlayers: Player[], currentConfigs: Record<DisciplineId, DisciplineFormatConfig>) => {
      // Hydrate authorized isolated student PII (/player_private)
      if (
        isAdminOrModerator(profile) ||
        profile.role === 'delegado' ||
        profile.role === 'jugador'
      ) {
        try {
          const privateMap = await loadAuthorizedPlayerPrivateMap(profile, currentPlayers);
          if (Object.keys(privateMap).length > 0) {
            setState((prev) => ({
              ...prev,
              players: prev.players.map((p) => {
                const pii = privateMap[p.id];
                return pii ? { ...p, ...pii } : p;
              }),
            }));
          }
        } catch (err) {
          console.error('Error hidratando datos privados de jugadores:', err);
        }
      }

      // Load all news (including unpublished drafts) for Admin, Moderador & Prensa
      if (canManageNews(profile)) {
        try {
          const allNews = await listAllFirestoreNews();
          setState((prev) => ({ ...prev, news: allNews }));
        } catch (err) {
          console.error('Error cargando borradores de noticias:', err);
        }
      }

      // Load zero-PII referee roster for Referee Chiefs & Admins
      if (canAssignReferees(profile)) {
        try {
          const roster = await listFirestoreRefereeRoster();
          setState((prev) => ({ ...prev, refereeRoster: roster }));
        } catch (err) {
          console.error('Error cargando padrón arbitral:', err);
        }
      }

      // If signed-in user is a Delegado with assigned team, load pending/rejected transfers involving their team
      if (profile.role === 'delegado' && profile.delegatedTeamId) {
        try {
          const delegateTransfers = await listDelegateFirestoreTransfers(profile.delegatedTeamId);
          setState((prev) => {
            const byId = new Map(prev.transfers.map((t) => [t.id, t]));
            delegateTransfers.forEach((tr) => byId.set(tr.id, tr));
            return { ...prev, transfers: Array.from(byId.values()) };
          });
        } catch (err) {
          console.error('Error cargando solicitudes de transferencia del delegado:', err);
        }
      }

      // If signed-in user is Admin or Moderador, load all Firestore users, transfers & sync referee roster
      if (isAdminOrModerator(profile)) {
        try {
          const [cloudUsers, allTransfers] = await Promise.all([
            listFirestoreUsers(),
            listAllFirestoreTransfers().catch(() => null),
            ensureAllConfigsInFirestore(currentConfigs).catch(() => undefined),
          ]);
          void syncRefereeRosterFromUsers(cloudUsers);
          setState((prev) => {
            const byUid = new Map(prev.users.map((u) => [u.uid, u]));
            cloudUsers.forEach((cu) => byUid.set(cu.uid, cu));
            return {
              ...prev,
              users: Array.from(byUid.values()),
              transfers: allTransfers ?? prev.transfers,
            };
          });
        } catch (err) {
          reportCloudError('Error cargando directorio de usuarios', err);
        }
      }
    },
    [reportCloudError]
  );

  // 2. Subscribe to real Firebase Google Auth state (NO demo/test users)
  useEffect(() => {
    const unsub = initGoogleAuth(
      async (firebaseUser) => {
        try {
          const profile = await syncGoogleUserToFirestore(firebaseUser);
          currentUserRoleRef.current = profile.role;

          setState((prev) => {
            const exists = prev.users.some((u) => u.uid === profile.uid);
            const mergedUsers = exists
              ? prev.users.map((u) => (u.uid === profile.uid ? profile : u))
              : [profile, ...prev.users];
            return { ...prev, users: mergedUsers };
          });
          setCurrentUserUid(profile.uid);
          setCloudError(null);

          await hydrateForAuthenticatedProfile(
            profile,
            stateRef.current.players,
            stateRef.current.configs
          );
        } catch (err) {
          reportCloudError('Error sincronizando sesión con la base de datos', err);
        }
      },
      () => {
        currentUserRoleRef.current = null;
        setCurrentUserUid(null);
        // Strip isolated PII, unpublished news drafts, and private transfer requests from memory on sign-out
        setState((prev) => ({
          ...prev,
          users: [],
          news: prev.news.filter((n) => n.published),
          transfers: prev.transfers.filter((t) => t.estado === 'APROBADA'),
          players: prev.players.map((p) => ({
            ...p,
            rut: '',
            numeroMatricula: '',
            correoInstitucional: '',
            fechaNacimiento: '',
          })),
        }));
      }
    );
    return () => unsub();
  }, [hydrateForAuthenticatedProfile, reportCloudError]);

  const currentUser: AppUserProfile | null = useMemo(() => {
    if (!currentUserUid) return null;
    return state.users.find((u) => u.uid === currentUserUid) ?? null;
  }, [currentUserUid, state.users]);

  useEffect(() => {
    currentUserRoleRef.current = currentUser?.role ?? null;
  }, [currentUser?.role]);

  // 2A. Role-scoped auto-hydration: delegates load only their own team roster; linked players load only their own doc (1 read).
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'delegado' && currentUser.delegatedTeamId) {
      void handleLoadTeamPlayers(currentUser.delegatedTeamId);
    }
    if (currentUser.role === 'jugador' && currentUser.linkedPlayerId) {
      const alreadyLoaded = stateRef.current.players.some(
        (p) => p.id === currentUser.linkedPlayerId
      );
      if (!alreadyLoaded) {
        fetchPlayerById(currentUser.linkedPlayerId)
          .then((playerDoc) => {
            if (!playerDoc) return;
            setState((prev) => ({
              ...prev,
              players: mergeLazyPlayersPreservingPii(prev.players, [playerDoc]),
            }));
          })
          .catch(() => {
            // Non-blocking fallback
          });
      }
    }
  }, [currentUser, handleLoadTeamPlayers]);

  // 2B. Write-Only Public TOTY Sync & On-Demand Admin Panel Loader:
  // - On /votaciones: NEVER scans toty_ballots! Reads ONLY toty_configs/{disc} and the signed-in user's
  //   own single ballot doc (0–2 reads total, served from localStorage cache when fresh).
  // - On /panel (Admin/Moderator only): performs a single cache-first fetch of TOTY & full players on demand
  //   instead of attaching permanent multi-discipline onSnapshot listeners.
  const applyDisciplineTotyToState = useCallback(
    (
      disciplineId: DisciplineId,
      ballots: TotyBallotRecord[],
      config: DisciplineTotyConfig | null
    ) => {
      const otherPersisted = persistedTotyBallotsRef.current.filter(
        (b) => b.disciplineId !== disciplineId
      );
      const nextPersisted = [...ballots, ...otherPersisted];
      persistedTotyBallotsRef.current = nextPersisted;

      const pendingBallots = pendingTotyQueueRef.current.map((item) => item.ballot);
      const mergedBallots =
        pendingBallots.length > 0
          ? mergeTotyBallotsIntoState(nextPersisted, pendingBallots)
          : nextPersisted;

      setState((prev) => {
        const nextConfigs = { ...prev.totyConfigs };
        if (config) {
          nextConfigs[disciplineId] = config;
        } else {
          delete nextConfigs[disciplineId];
        }
        return {
          ...prev,
          totyBallots: mergedBallots,
          totyConfigs: nextConfigs,
        };
      });
    },
    []
  );

  useEffect(() => {
    if (activeSection !== 'votaciones') return;

    let cancelled = false;
    const cachedDisc = loadCachedTotyForDiscipline(selectedDiscipline);
    const cachedOwnBallot =
      currentUserUid && cachedDisc
        ? cachedDisc.ballots.find((b) => b.voterUid === currentUserUid) ?? null
        : null;

    if (cachedDisc) {
      applyDisciplineTotyToState(
        selectedDiscipline,
        cachedOwnBallot ? [cachedOwnBallot] : [],
        cachedDisc.config
      );
      setTotyLastSyncAt(new Date(cachedDisc.savedAt).toISOString());
      if (cachedDisc.isFresh && (!currentUserUid || Boolean(cachedOwnBallot))) {
        // Fresh indexed cache hit -> 0 Firestore reads!
        return;
      }
    }

    if (inFlightTotyDisciplinesRef.current.has(selectedDiscipline)) {
      return;
    }

    inFlightTotyDisciplinesRef.current.add(selectedDiscipline);
    fetchPublicTotyConfigAndOwnBallot(selectedDiscipline, currentUserUid ?? undefined)
      .then(async ({ config, ownBallot, totyVotingDeadline }) => {
        let resolvedBallot = ownBallot;
        // Automatic self-migration: if the signed-in voter still has their own ballot in local cache
        // from before the Turso migration and Turso doesn't have it yet, sync it to Turso automatically.
        if (
          !resolvedBallot &&
          currentUserUid &&
          cachedOwnBallot &&
          cachedOwnBallot.voterUid === currentUserUid &&
          Object.keys(cachedOwnBallot.selections || {}).length > 0
        ) {
          resolvedBallot = cachedOwnBallot;
          void saveFirestoreTotyBallotsBatch([
            { ballot: cachedOwnBallot, isUpdate: false },
          ]).catch(() => {
            // Will retry naturally on next visit or explicit save
          });
        }

        const ballotList = resolvedBallot ? [resolvedBallot] : [];
        saveCachedTotyForDiscipline(selectedDiscipline, {
          ballots: ballotList,
          config,
          temporada: stateRef.current.temporada,
        });
        if (!cancelled) {
          applyDisciplineTotyToState(selectedDiscipline, ballotList, config);
          setState((prev) => {
            const nextDeadline = totyVotingDeadline || undefined;
            if (prev.totyVotingDeadline === nextDeadline) return prev;
            return { ...prev, totyVotingDeadline: nextDeadline };
          });
          setTotyLastSyncAt(new Date().toISOString());
        }

        // Hydrate ONLY the specific player docs referenced in the user's own saved ballot (if missing locally)
        if (resolvedBallot && !cancelled) {
          const existingIds = new Set(stateRef.current.players.map((p) => p.id));
          const missingIds = Array.from(
            new Set(
              Object.values(resolvedBallot.selections).filter((id) => Boolean(id) && !existingIds.has(id))
            )
          );
          if (missingIds.length > 0) {
            const loaded = (await Promise.all(missingIds.map((id) => fetchPlayerById(id)))).filter(
              (p): p is Player => p !== null
            );
            if (!cancelled && loaded.length > 0) {
              setState((prev) => ({
                ...prev,
                players: mergeLazyPlayersPreservingPii(prev.players, loaded),
              }));
            }
          }
        }
      })
      .catch((err) => {
        reportCloudError(`Cargando configuración TOTY (${selectedDiscipline})`, err, 'toty');
      })
      .finally(() => {
        inFlightTotyDisciplinesRef.current.delete(selectedDiscipline);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSection, selectedDiscipline, currentUserUid, applyDisciplineTotyToState, reportCloudError]);

  useEffect(() => {
    if (activeSection !== 'panel') {
      setTotyRealtimeActive(false);
      return;
    }

    let cancelled = false;
    const isAdminPanelUser = Boolean(currentUser && isAdminOrModerator(currentUser));

    const cachedAll = loadAllCachedTotyData();
    if (cachedAll.ballots.length > 0 || Object.keys(cachedAll.configs).length > 0) {
      persistedTotyBallotsRef.current = mergeTotyBallotsIntoState(
        persistedTotyBallotsRef.current,
        cachedAll.ballots
      );
      setState((prev) => ({
        ...prev,
        totyBallots: mergeTotyBallotsIntoState(prev.totyBallots, cachedAll.ballots),
        totyConfigs: { ...prev.totyConfigs, ...cachedAll.configs },
      }));
      if (cachedAll.latestSavedAt) {
        setTotyLastSyncAt(new Date(cachedAll.latestSavedAt).toISOString());
      }
    }

    if (!isAdminPanelUser) return;

    // One-shot Admin TOTY fetch only when local cache is stale or retry requested (no permanent listeners)
    if (!areAllTotyDisciplinesFresh() || realtimeRetryNonce > 0) {
      fetchAllFirestoreTotyData()
        .then(({ ballots, configs }) => {
          if (cancelled) return;
          persistedTotyBallotsRef.current = ballots;
          // Preserve any pre-migration local backup in localStorage if Turso doesn't have ballots yet
          if (ballots.length > 0 || cachedAll.ballots.length === 0) {
            saveAllCachedTotySnapshot({
              ballots,
              configs,
              temporada: stateRef.current.temporada,
            });
          }
          const pendingBallots = pendingTotyQueueRef.current.map((item) => item.ballot);
          setState((prev) => ({
            ...prev,
            totyBallots:
              pendingBallots.length > 0
                ? mergeTotyBallotsIntoState(ballots, pendingBallots)
                : ballots,
            totyConfigs: configs,
          }));
          setTotyLastSyncAt(new Date().toISOString());
          setTotyRealtimeActive(true);
        })
        .catch((err) => {
          if (cancelled) return;
          reportCloudError('Cargando panel TOTY de administración', err, 'toty');
          setTotyRealtimeActive(false);
        });
    } else {
      setTotyRealtimeActive(true);
    }

    // Load full /players once per Admin/Moderator panel session for Sheets/Awards/Admin roster tools
    if (!adminFullPlayersLoadedRef.current) {
      adminFullPlayersLoadedRef.current = true;
      fetchAllPlayersForAdmin()
        .then((allPlayers) => {
          if (cancelled) return;
          setState((prev) => ({
            ...prev,
            players: mergeLazyPlayersPreservingPii(prev.players, allPlayers),
          }));
          setSyncHealthState((prev) => markSyncStreamHealthy(prev, 'players'));
        })
        .catch((err) => {
          adminFullPlayersLoadedRef.current = false;
          reportCloudError('Cargando padrón completo para panel admin', err, 'players');
        });
    }

    return () => {
      cancelled = true;
    };
  }, [activeSection, currentUser, realtimeRetryNonce, reportCloudError]);

  // 2C. Hydrate authorized student PII once players stream finishes arriving for signed-in staff/delegates/players
  const piiHydratedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentUser) {
      piiHydratedKeyRef.current = null;
      return;
    }
    if (
      !isAdminOrModerator(currentUser) &&
      currentUser.role !== 'delegado' &&
      currentUser.role !== 'jugador'
    ) {
      return;
    }
    if (state.players.length === 0) return;

    const hydrationKey = `${currentUser.uid}:${currentUser.role}:${state.players.length}`;
    if (piiHydratedKeyRef.current === hydrationKey) return;
    piiHydratedKeyRef.current = hydrationKey;

    let active = true;
    loadAuthorizedPlayerPrivateMap(currentUser, state.players)
      .then((privateMap) => {
        if (!active || Object.keys(privateMap).length === 0) return;
        setState((prev) => ({
          ...prev,
          players: prev.players.map((p) => {
            const pii = privateMap[p.id];
            return pii ? { ...p, ...pii } : p;
          }),
        }));
      })
      .catch((err) => {
        console.error('Error hidratando datos privados de jugadores:', err);
      });

    return () => {
      active = false;
    };
  }, [currentUser, state.players.length]);

  const handleClearDeletedTombstones = useCallback(() => {
    setDeletedTombstones({ teamIds: [], playerIds: [], matchIds: [] });
  }, []);

  const handleApplySheetImports = useCallback(
    async (imports: SheetImportDelta) => {
      if (!currentUser || !hasAnySheetImports(imports)) return;

      // 1. Merge imported/updated records cleanly into local React state
      setState((prev) => {
        const teamMap = new Map(prev.teams.map((t) => [t.id, t]));
        imports.teamsToCreate.forEach((t) => teamMap.set(t.id, { ...t, createdByUid: currentUser.uid }));
        imports.teamsToUpdate.forEach((t) => teamMap.set(t.id, t));

        const playerMap = new Map(prev.players.map((p) => [p.id, p]));
        imports.playersToCreate.forEach((p) => playerMap.set(p.id, p));
        imports.playersToUpdate.forEach((p) => playerMap.set(p.id, p));

        const matchMap = new Map(prev.matches.map((m) => [m.id, m]));
        imports.matchesToCreate.forEach((m) => matchMap.set(m.id, m));
        imports.matchesToUpdate.forEach((m) => matchMap.set(m.id, m));

        const nextConfigs = { ...prev.configs };
        imports.configsToUpdate.forEach((cfg) => {
          nextConfigs[cfg.disciplineId] = cfg;
        });

        return {
          ...prev,
          teams: Array.from(teamMap.values()),
          players: Array.from(playerMap.values()),
          matches: Array.from(matchMap.values()),
          configs: nextConfigs,
        };
      });

      // 2. Persist every Sheet-side change to Firestore (teams first, then players/matches/configs, using upsert-safe mode)
      try {
        if (imports.teamsToCreate.length > 0 || imports.teamsToUpdate.length > 0) {
          await Promise.all([
            ...imports.teamsToCreate.map((t) =>
              saveFirestoreTeam(t, currentUser.uid, true, currentUser.role, true)
            ),
            ...imports.teamsToUpdate.map((t) =>
              saveFirestoreTeam(t, currentUser.uid, false, currentUser.role, true)
            ),
          ]);
        }
        await Promise.all([
          ...imports.playersToCreate.map((p) =>
            saveFirestorePlayer(p, true, currentUser.role, true)
          ),
          ...imports.playersToUpdate.map((p) =>
            saveFirestorePlayer(p, false, currentUser.role, true)
          ),
          ...imports.matchesToCreate.map((m) =>
            saveFirestoreMatch(m, true, currentUser.role, true)
          ),
          ...imports.matchesToUpdate.map((m) =>
            saveFirestoreMatch(m, false, currentUser.role, true)
          ),
          ...imports.configsToUpdate.map((cfg) => saveFirestoreDisciplineConfig(cfg)),
        ]);
      } catch (err) {
        reportCloudError('Error aplicando cambios importados desde Google Sheets a la base de datos', err);
      }
    },
    [currentUser, reportCloudError]
  );

  // Debounced Automatic Bidirectional Master Sheets Sync (runs ONLY after explicit session approval by an Admin)
  useEffect(() => {
    if (
      pendingSyncKeys.length === 0 ||
      !autoSyncSessionApproved ||
      !state.autoSyncSheetsEnabled ||
      !canManageFormatAndSheets(currentUser)
    ) {
      return;
    }

    const token = getGoogleAccessToken();
    if (!token) {
      setAutoSyncState({
        status: 'idle',
        message: 'Reconecta Google Workspace en Panel → Google Sheets para aplicar los cambios pendientes.',
      });
      return;
    }

    const keysSnapshot = [...pendingSyncKeys];
    const timer = window.setTimeout(async () => {
      setAutoSyncState({
        status: 'syncing',
        message: `Fusionando bidireccionalmente: ${keysSnapshot
          .map((k) => MASTER_SHEET_GROUP_MAP[k].shortLabel)
          .join(', ')}...`,
      });
      try {
        const { succeeded, failed } = await syncMultipleMasterSheets(
          token,
          stateRef.current,
          keysSnapshot,
          deletedTombstonesRef.current
        );
        if (succeeded.length > 0) {
          for (const summary of succeeded) {
            if (hasAnySheetImports(summary.imports)) {
              await handleApplySheetImports(summary.imports);
            }
          }
          const syncedKeys = new Set(
            succeeded.map((s) => s.masterKey).filter((k): k is MasterSheetKey => Boolean(k))
          );
          setPendingSyncKeys((prev) => prev.filter((k) => !syncedKeys.has(k)));
          handleClearDeletedTombstones();
          const syncedAt = new Date().toISOString();
          const lastId = succeeded[0].spreadsheetId;
          setState((prev) => ({
            ...prev,
            lastSyncedSpreadsheetId: lastId,
            lastSyncedAt: syncedAt,
          }));
          void saveFirestoreSettings({
            temporada: stateRef.current.temporada,
            driveUploadRootFolderId: stateRef.current.driveUploadRootFolderId,
            driveUploadRootFolderName: stateRef.current.driveUploadRootFolderName,
            masterSheets: stateRef.current.masterSheets,
            autoSyncSheetsEnabled: stateRef.current.autoSyncSheetsEnabled,
            lastSyncedSpreadsheetId: lastId,
            lastSyncedAt: syncedAt,
          }).catch(() => undefined);
        }
        if (failed.length > 0) {
          setAutoSyncState({
            status: 'error',
            message: `Error en auto-sync (${failed.map((f) => `${f.label}: ${f.error}`).join(' | ')})`,
          });
        } else if (succeeded.length > 0) {
          setAutoSyncState({
            status: 'synced',
            lastSyncedAt: new Date().toISOString(),
            message: `Auto-sincronizado (${new Date().toLocaleTimeString('es-CL')}): ${succeeded
              .map((s) => `${s.masterLabel || s.spreadsheetId} (${s.totalRowsWritten} filas)`)
              .join(' · ')}`,
          });
        } else {
          setPendingSyncKeys((prev) => prev.filter((k) => !keysSnapshot.includes(k)));
          setAutoSyncState({ status: 'idle' });
        }
      } catch (err: unknown) {
        setAutoSyncState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Error en sincronización automática.',
        });
      }
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [
    pendingSyncKeys,
    autoSyncSessionApproved,
    state.autoSyncSheetsEnabled,
    currentUser?.role,
    handleApplySheetImports,
    handleClearDeletedTombstones,
  ]);

  const activeModalMatch: Match | null = useMemo(() => {
    if (!activeMatchModalId) return null;
    return state.matches.find((m) => m.id === activeMatchModalId) ?? null;
  }, [activeMatchModalId, state.matches]);

  const inspectedTeam: Team | null = useMemo(() => {
    if (!inspectedTeamId) return null;
    return state.teams.find((t) => t.id === inspectedTeamId) ?? null;
  }, [inspectedTeamId, state.teams]);

  const syncBrowserUrlForSection = useCallback((section: NavSection, replace = false) => {
    if (typeof window === 'undefined') return;
    const targetPath = getSectionPath(section);
    const currentPath = normalizePathname(window.location.pathname);
    if (currentPath !== targetPath || window.location.pathname !== targetPath) {
      if (replace) {
        window.history.replaceState({ section }, '', targetPath);
      } else {
        window.history.pushState({ section }, '', targetPath);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Normalize aliases (e.g. /posiciones -> /tabla-posiciones, /inicio -> /) without adding extra history entry
    const resolved = resolveSectionFromPath(window.location.pathname);
    const canonicalPath = getSectionPath(resolved);
    if (window.location.pathname !== canonicalPath) {
      const searchAndHash = `${window.location.search}${window.location.hash}`;
      window.history.replaceState({ section: resolved }, '', `${canonicalPath}${searchAndHash}`);
    }

    const onPopState = () => {
      const nextSection = resolveSectionFromPath(window.location.pathname);
      setActiveSection(nextSection);
      if (nextSection !== 'jugadores') {
        setInspectedPlayer(null);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = getSectionTitle(activeSection);
    }
  }, [activeSection]);

  const handleNavigate = useCallback(
    (section: NavSection) => {
      setActiveSection(section);
      if (section !== 'jugadores') {
        setInspectedPlayer(null);
      }
      syncBrowserUrlForSection(section);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [syncBrowserUrlForSection]
  );

  const handleGoogleSignIn = async () => {
    setGoogleAuthLoading(true);
    setGoogleAuthError(null);
    try {
      const { user } = await signInWithGoogleBasic();
      const profile = await syncGoogleUserToFirestore(user);
      setState((prev) => {
        const exists = prev.users.some((u) => u.uid === profile.uid);
        const nextUsers = exists
          ? prev.users.map((u) => (u.uid === profile.uid ? profile : u))
          : [profile, ...prev.users];
        return { ...prev, users: nextUsers };
      });
      setCurrentUserUid(profile.uid);
      setAuthModalOpen(false);
      await hydrateForAuthenticatedProfile(profile, state.players, state.configs);
    } catch (err: unknown) {
      setGoogleAuthError(
        err instanceof Error
          ? err.message
          : 'No se pudo iniciar sesión con Google. Verifica que las ventanas emergentes estén habilitadas.'
      );
    } finally {
      setGoogleAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (pendingTotyQueueRef.current.length > 0) {
      await flushPendingTotyBallots();
    }
    try {
      await signOutGoogle();
    } catch {
      // Ignore if already signed out
    }
    setAutoSyncSessionApproved(false);
    setCurrentUserUid(null);
  };

  const handleRefreshUsers = async () => {
    if (!canManageRoles(currentUser)) return;
    try {
      const cloudUsers = await listFirestoreUsers();
      void syncRefereeRosterFromUsers(cloudUsers);
      setState((prev) => ({ ...prev, users: cloudUsers }));
    } catch (err) {
      reportCloudError('No se pudo actualizar la lista de usuarios', err);
    }
  };

  const handleToggleFavoriteTeam = (teamId: string) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    const exists = currentUser.favoriteTeamIds.includes(teamId);
    const nextFavs = exists
      ? currentUser.favoriteTeamIds.filter((id) => id !== teamId)
      : [...currentUser.favoriteTeamIds, teamId].slice(0, 20);

    const updatedUser: AppUserProfile = {
      ...currentUser,
      favoriteTeamIds: nextFavs,
      updatedAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.uid === currentUser.uid ? updatedUser : u)),
    }));

    void updateFirestoreUserPreferences(currentUser.uid, { favoriteTeamIds: nextFavs }).catch(
      (err) => reportCloudError('Error actualizando favoritos', err)
    );
  };

  const handleToggleNotifications = (enabled: boolean) => {
    if (!currentUser) return;
    const updatedUser: AppUserProfile = {
      ...currentUser,
      notificationsEnabled: enabled,
      updatedAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.uid === currentUser.uid ? updatedUser : u)),
    }));

    void updateFirestoreUserPreferences(currentUser.uid, {
      notificationsEnabled: enabled,
    }).catch((err) => reportCloudError('Error actualizando notificaciones', err));
  };

  const handleUpdateUserProfile = async (updates: {
    displayName: string;
    fechaNacimiento: string;
    carrera: string;
    facultad: string;
    telefono: string;
  }) => {
    if (!currentUser) return;
    const sanitized = {
      displayName: updates.displayName.trim().slice(0, 120),
      fechaNacimiento: updates.fechaNacimiento.trim().slice(0, 20),
      carrera: updates.carrera.trim().slice(0, 140),
      facultad: updates.facultad.trim().slice(0, 140),
      telefono: updates.telefono.trim().slice(0, 30),
    };
    if (!sanitized.displayName) {
      throw new Error('Ingresa un nombre válido.');
    }

    await updateFirestoreUserPreferences(currentUser.uid, sanitized);

    const updatedUser: AppUserProfile = {
      ...currentUser,
      ...sanitized,
      updatedAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.uid === currentUser.uid ? updatedUser : u)),
    }));
  };

  const handleVoteMvp = (match: Match, player: Player) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    const voteId = `${match.id}_${currentUser.uid}`;
    const voteRecord: MvpVoteRecord = {
      id: voteId,
      matchId: match.id,
      disciplineId: match.disciplineId,
      playerId: player.id,
      playerName: `${player.nombre} ${player.apellidoPaterno}`,
      teamId: player.teamId,
      voterUid: currentUser.uid,
      voterName: currentUser.displayName,
      createdAt: new Date().toISOString(),
    };

    setState((prev) => {
      const existingIdx = prev.mvpVotes.findIndex((v) => v.id === voteId);
      const nextVotes =
        existingIdx >= 0
          ? prev.mvpVotes.map((v, idx) => (idx === existingIdx ? voteRecord : v))
          : [voteRecord, ...prev.mvpVotes];
      return { ...prev, mvpVotes: nextVotes };
    });

    void saveFirestoreMvpVote({
      matchId: match.id,
      disciplineId: match.disciplineId,
      playerId: player.id,
      playerName: voteRecord.playerName,
      teamId: player.teamId,
      voterUid: currentUser.uid,
    }).catch((err) => reportCloudError('Error guardando voto POTM', err));
  };

  const handleSaveAwardNominees = async (disciplineId: DisciplineId, nomineeIds: string[]) => {
    if (!isAdminOrModerator(currentUser)) return;
    const cleaned = Array.from(new Set(nomineeIds.map((id) => id.trim()).filter(Boolean))).slice(0, 5);
    setState((prev) => ({
      ...prev,
      awardNominees: {
        ...prev.awardNominees,
        [disciplineId]: cleaned,
      },
    }));
    try {
      await saveFirestoreAwardNominees(disciplineId, stateRef.current.temporada, cleaned);
    } catch (err) {
      reportCloudError('Error guardando nominados al MVP del Campeonato', err);
      throw err;
    }
  };

  const handleSaveTotyConfig = async (config: DisciplineTotyConfig) => {
    if (!isAdminOrModerator(currentUser)) return;
    const normalized: DisciplineTotyConfig = {
      ...config,
      temporada: config.temporada || stateRef.current.temporada,
      updatedAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      totyConfigs: {
        ...prev.totyConfigs,
        [normalized.disciplineId]: normalized,
      },
    }));
    try {
      await saveFirestoreTotyConfig(normalized);
      upsertCachedTotyConfig(normalized);
      setTotyLastSyncAt(new Date().toISOString());
    } catch (err) {
      reportCloudError('Error guardando configuración TOTY por disciplina', err);
      throw err;
    }
  };

  const handleResetTotyConfig = async (disciplineId: DisciplineId) => {
    if (!isAdminOrModerator(currentUser)) return;
    setState((prev) => {
      const nextConfigs = { ...prev.totyConfigs };
      delete nextConfigs[disciplineId];
      return { ...prev, totyConfigs: nextConfigs };
    });
    try {
      await deleteFirestoreTotyConfig(disciplineId);
      removeCachedTotyConfig(disciplineId);
      setTotyLastSyncAt(new Date().toISOString());
    } catch (err) {
      reportCloudError('Error restaurando formación TOTY estándar', err);
      throw err;
    }
  };

  const handleMigrateTotyFromFirestore = async () => {
    if (!isAdminOrModerator(currentUser)) {
      throw new Error('Solo administración puede migrar papeletas.');
    }
    const result = await migrateTotyBallotsFromFirestoreToTurso();
    persistedTotyBallotsRef.current = result.ballots;
    saveAllCachedTotySnapshot({
      ballots: result.ballots,
      configs: result.configs,
      temporada: stateRef.current.temporada,
    });
    setState((prev) => ({
      ...prev,
      totyBallots: result.ballots,
      totyConfigs: result.configs,
    }));
    setTotyLastSyncAt(new Date().toISOString());
    return {
      migratedBallots: result.migratedBallots,
      migratedConfigs: result.migratedConfigs,
    };
  };

  const handleImportLocalTotyBackup = async (payload: {
    ballots: TotyBallotRecord[];
    configs: Partial<Record<DisciplineId, DisciplineTotyConfig>>;
  }) => {
    if (!isAdminOrModerator(currentUser)) {
      throw new Error('Solo administración puede importar papeletas.');
    }
    const result = await importAdminTotyBallotsToTurso(payload);
    persistedTotyBallotsRef.current = result.ballots;
    saveAllCachedTotySnapshot({
      ballots: result.ballots,
      configs: result.configs,
      temporada: stateRef.current.temporada,
    });
    setState((prev) => ({
      ...prev,
      totyBallots: result.ballots,
      totyConfigs: result.configs,
    }));
    setTotyLastSyncAt(new Date().toISOString());
    return {
      importedBallots: result.importedBallots,
      importedConfigs: result.importedConfigs,
    };
  };

  const handleSaveTotyDeadline = async (deadlineIso: string | null) => {
    if (!isAdminOrModerator(currentUser)) {
      throw new Error('Solo administración puede configurar el temporizador TOTY.');
    }
    const normalized = deadlineIso && deadlineIso.trim() ? deadlineIso.trim() : null;
    try {
      await saveFirestoreSettings({
        temporada: stateRef.current.temporada,
        totyVotingDeadline: normalized,
      });
      setState((prev) => ({
        ...prev,
        totyVotingDeadline: normalized ?? undefined,
      }));
    } catch (err) {
      reportCloudError('Error guardando temporizador TOTY', err);
      throw err;
    }
  };

  const handleVoteChampionshipMvp = async (disciplineId: DisciplineId, player: Player) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    const voteId = `${disciplineId}_${currentUser.uid}`;
    const now = new Date().toISOString();
    const record: ChampionshipMvpVoteRecord = {
      id: voteId,
      disciplineId,
      temporada: stateRef.current.temporada,
      voterUid: currentUser.uid,
      playerId: player.id,
      playerName: `${player.nombre} ${player.apellidoPaterno}`,
      teamId: player.teamId,
      createdAt: now,
      updatedAt: now,
    };
    setState((prev) => {
      const exists = prev.championshipMvpVotes.some((v) => v.id === voteId);
      return {
        ...prev,
        championshipMvpVotes: exists
          ? prev.championshipMvpVotes.map((v) => (v.id === voteId ? record : v))
          : [record, ...prev.championshipMvpVotes],
      };
    });
    try {
      await saveFirestoreChampionshipMvpVote(record);
    } catch (err) {
      reportCloudError('Error guardando voto MVP del Campeonato', err);
    }
  };

  const handleVotePositionAward = async (
    disciplineId: DisciplineId,
    positionKey: string,
    positionLabel: string,
    player: Player
  ) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    const voteId = `${disciplineId}_${positionKey}_${currentUser.uid}`;
    const now = new Date().toISOString();
    const record: PositionAwardVoteRecord = {
      id: voteId,
      disciplineId,
      temporada: stateRef.current.temporada,
      positionKey,
      positionLabel,
      voterUid: currentUser.uid,
      playerId: player.id,
      playerName: `${player.nombre} ${player.apellidoPaterno}`,
      teamId: player.teamId,
      createdAt: now,
      updatedAt: now,
    };
    setState((prev) => {
      const exists = prev.positionAwardVotes.some((v) => v.id === voteId);
      return {
        ...prev,
        positionAwardVotes: exists
          ? prev.positionAwardVotes.map((v) => (v.id === voteId ? record : v))
          : [record, ...prev.positionAwardVotes],
      };
    });
    try {
      await saveFirestorePositionAwardVote(record);
    } catch (err) {
      reportCloudError('Error guardando voto por posición', err);
    }
  };

  const flushPendingTotyBallots = useCallback(async (): Promise<number> => {
    if (pendingTotyTimerRef.current !== null) {
      window.clearTimeout(pendingTotyTimerRef.current);
      pendingTotyTimerRef.current = null;
    }
    const itemsToCommit = pendingTotyQueueRef.current;
    if (itemsToCommit.length === 0) return 0;

    pendingTotyQueueRef.current = [];
    setPendingTotyDisciplines([]);

    try {
      const committedCount = await saveFirestoreTotyBallotsBatch(itemsToCommit);
      const committedBallots = itemsToCommit.map((item) => item.ballot);
      persistedTotyBallotsRef.current = mergeTotyBallotsIntoState(
        persistedTotyBallotsRef.current,
        committedBallots
      );
      upsertCachedTotyBallots(committedBallots);
      setTotyLastSyncAt(new Date().toISOString());
      return committedCount;
    } catch (err) {
      let restored = itemsToCommit;
      for (const newer of pendingTotyQueueRef.current) {
        restored = enqueueTotyBallotItem(restored, newer);
      }
      pendingTotyQueueRef.current = restored;
      setPendingTotyDisciplines(restored.map((item) => item.ballot.disciplineId));
      reportCloudError('Error guardando papeletas de TOTYs en lote', err);
      return 0;
    }
  }, [reportCloudError]);

  // Flush any queued TOTY ballots when leaving Votaciones or hiding the tab
  useEffect(() => {
    if (activeSection !== 'votaciones' && pendingTotyQueueRef.current.length > 0) {
      void flushPendingTotyBallots();
    }
  }, [activeSection, flushPendingTotyBallots]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && pendingTotyQueueRef.current.length > 0) {
        void flushPendingTotyBallots();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (pendingTotyTimerRef.current !== null) {
        window.clearTimeout(pendingTotyTimerRef.current);
        pendingTotyTimerRef.current = null;
      }
    };
  }, [flushPendingTotyBallots]);

  const handleSubmitTotyBallot = async (
    disciplineIdOrBatch: DisciplineId | TotyBallotSubmissionInput[],
    selections?: Record<string, string>
  ): Promise<{ committedCount: number; queuedCount: number; skippedCount: number }> => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return { committedCount: 0, queuedCount: 0, skippedCount: 0 };
    }

    const isExplicitBatch = Array.isArray(disciplineIdOrBatch);
    const incomingSubmissions: TotyBallotSubmissionInput[] = isExplicitBatch
      ? disciplineIdOrBatch
      : [{ disciplineId: disciplineIdOrBatch, selections: selections ?? {} }];

    const queuedSubmissions: TotyBallotSubmissionInput[] = pendingTotyQueueRef.current.map(
      (item) => ({
        disciplineId: item.ballot.disciplineId,
        selections: item.ballot.selections,
      })
    );

    const plan = planTotyBallotBatch({
      submissions: isExplicitBatch
        ? [...queuedSubmissions, ...incomingSubmissions]
        : incomingSubmissions,
      persistedBallots: persistedTotyBallotsRef.current,
      voterUid: currentUser.uid,
      temporada: stateRef.current.temporada,
    });

    if (isExplicitBatch) {
      if (pendingTotyTimerRef.current !== null) {
        window.clearTimeout(pendingTotyTimerRef.current);
        pendingTotyTimerRef.current = null;
      }
      pendingTotyQueueRef.current = [];
      setPendingTotyDisciplines([]);

      if (plan.items.length === 0) {
        return {
          committedCount: 0,
          queuedCount: 0,
          skippedCount: plan.skippedDisciplineIds.length,
        };
      }

      const ballotsToMerge = plan.items.map((item) => item.ballot);
      setState((prev) => ({
        ...prev,
        totyBallots: mergeTotyBallotsIntoState(prev.totyBallots, ballotsToMerge),
      }));

      try {
        const committedCount = await saveFirestoreTotyBallotsBatch(plan.items);
        persistedTotyBallotsRef.current = mergeTotyBallotsIntoState(
          persistedTotyBallotsRef.current,
          ballotsToMerge
        );
        upsertCachedTotyBallots(ballotsToMerge);
        setTotyLastSyncAt(new Date().toISOString());
        return {
          committedCount,
          queuedCount: 0,
          skippedCount: plan.skippedDisciplineIds.length,
        };
      } catch (err) {
        pendingTotyQueueRef.current = plan.items;
        setPendingTotyDisciplines(plan.items.map((item) => item.ballot.disciplineId));
        reportCloudError('Error guardando papeletas de TOTYs en lote', err);
        throw err;
      }
    }

    // Single-discipline submission: skip no-op edits with 0 Firestore reads/writes
    if (plan.items.length === 0) {
      const disciplineId = incomingSubmissions[0]?.disciplineId;
      if (
        disciplineId &&
        pendingTotyQueueRef.current.some((i) => i.ballot.disciplineId === disciplineId)
      ) {
        pendingTotyQueueRef.current = pendingTotyQueueRef.current.filter(
          (i) => i.ballot.disciplineId !== disciplineId
        );
        setPendingTotyDisciplines(pendingTotyQueueRef.current.map((i) => i.ballot.disciplineId));
        const persistedVersion = persistedTotyBallotsRef.current.find(
          (b) => b.disciplineId === disciplineId && b.voterUid === currentUser.uid
        );
        if (persistedVersion) {
          setState((prev) => ({
            ...prev,
            totyBallots: mergeTotyBallotsIntoState(prev.totyBallots, [persistedVersion]),
          }));
        }
      }
      return {
        committedCount: 0,
        queuedCount: pendingTotyQueueRef.current.length,
        skippedCount: plan.skippedDisciplineIds.length,
      };
    }

    // Coalesce rapid multi-discipline submits into one writeBatch after a short debounce window
    let nextQueue = pendingTotyQueueRef.current;
    for (const item of plan.items) {
      nextQueue = enqueueTotyBallotItem(nextQueue, item);
    }
    pendingTotyQueueRef.current = nextQueue;
    setPendingTotyDisciplines(nextQueue.map((item) => item.ballot.disciplineId));

    setState((prev) => ({
      ...prev,
      totyBallots: mergeTotyBallotsIntoState(
        prev.totyBallots,
        plan.items.map((item) => item.ballot)
      ),
    }));

    if (pendingTotyTimerRef.current !== null) {
      window.clearTimeout(pendingTotyTimerRef.current);
    }
    pendingTotyTimerRef.current = window.setTimeout(() => {
      void flushPendingTotyBallots();
    }, 1800);

    return {
      committedCount: 0,
      queuedCount: nextQueue.length,
      skippedCount: plan.skippedDisciplineIds.length,
    };
  };

  const handleSaveLeyendasEntry = async (entry: LeyendasLeaderboardEntry) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      throw new Error('Debes iniciar sesión con Google para publicar en el Top Global.');
    }
    try {
      await saveFirestoreLeyendasEntry(entry);
      setState((prev) => {
        const filtered = prev.leyendasLeaderboard.filter((item) => item.id !== entry.id);
        const next = [entry, ...filtered].sort((a, b) => b.score - a.score);
        return {
          ...prev,
          leyendasLeaderboard: next,
        };
      });
    } catch (err) {
      reportCloudError('Error publicando carrera en el Top Global de LEYENDAS', err);
      throw err;
    }
  };

  const handleUpdatePlayer = (updatedPlayer: Player) => {
    if (!currentUser) return;
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) => (p.id === updatedPlayer.id ? updatedPlayer : p)),
    }));
    queueMasterSyncForDiscipline(updatedPlayer.disciplineId);
    void saveFirestorePlayer(updatedPlayer, false, currentUser.role).catch((err) =>
      reportCloudError('Error actualizando ficha del estudiante', err)
    );
  };

  const handleAddPlayerToTeam = (newPlayer: Player) => {
    if (!currentUser) return;
    setState((prev) => ({ ...prev, players: [newPlayer, ...prev.players] }));
    queueMasterSyncForDiscipline(newPlayer.disciplineId);
    void saveFirestorePlayer(newPlayer, true, currentUser.role).catch((err) =>
      reportCloudError('Error registrando estudiante en la base de datos', err)
    );
  };

  const handleDeletePlayer = (player: Player) => {
    if (!isAdminOrModerator(currentUser)) return;
    setState((prev) => ({
      ...prev,
      players: prev.players.filter((p) => p.id !== player.id),
    }));
    setDeletedTombstones((prev) => ({
      ...prev,
      playerIds: Array.from(new Set([...(prev.playerIds ?? []), player.id])),
    }));
    queueMasterSyncForDiscipline(player.disciplineId);
    void deleteFirestorePlayer(player.id).catch((err) =>
      reportCloudError('Error eliminando jugador en la base de datos', err)
    );
  };

  const handleAdminAddTeam = (team: Team) => {
    if (!currentUser || !isAdminOrModerator(currentUser)) return;
    const enriched: Team = { ...team, createdByUid: currentUser.uid };
    setState((prev) => ({
      ...prev,
      teams: [...prev.teams, enriched],
    }));
    queueMasterSyncForDiscipline(enriched.disciplineId);
    void saveFirestoreTeam(enriched, currentUser.uid, true, currentUser.role).catch((err) =>
      reportCloudError('Error agregando equipo en la base de datos', err)
    );
  };

  const handleUpdateTeam = (team: Team) => {
    if (!currentUser) return;
    const isStaff = isAdminOrModerator(currentUser);
    const isAuthorizedDelegado =
      currentUser.role === 'delegado' &&
      (currentUser.delegatedTeamId === team.id || team.createdByUid === currentUser.uid);
    if (!isStaff && !isAuthorizedDelegado) return;

    setState((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => (t.id === team.id ? { ...t, ...team } : t)),
    }));
    queueMasterSyncForDiscipline(team.disciplineId);
    void saveFirestoreTeam(team, currentUser.uid, false, currentUser.role).catch((err) =>
      reportCloudError('Error actualizando equipo en la base de datos', err)
    );
  };

  const handleBulkUpdateTeams = async (
    updates: Array<{ team: Team; clearAnioFundacion?: boolean }>
  ) => {
    if (!currentUser || !isAdminOrModerator(currentUser) || updates.length === 0) return;
    const updateMap = new Map(updates.map((u) => [u.team.id, u]));
    setState((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => {
        const match = updateMap.get(t.id);
        if (!match) return t;
        const merged: Team = { ...t, ...match.team };
        if (match.clearAnioFundacion) {
          merged.anioFundacion = undefined;
        }
        return merged;
      }),
    }));
    const affectedDisciplines = new Set(updates.map((u) => u.team.disciplineId));
    affectedDisciplines.forEach((d) => queueMasterSyncForDiscipline(d));
    try {
      await bulkUpdateFirestoreTeams({
        teams: updates.map((u) => u.team),
        actorUid: currentUser.uid,
        actorRole: currentUser.role,
        clearAnioFundacion: updates.some((u) => u.clearAnioFundacion),
      });
    } catch (err) {
      reportCloudError('Error aplicando edición masiva de equipos en la base de datos', err);
      throw err;
    }
  };

  const handleAdminDeleteTeam = (team: Team) => {
    if (!isAdminOrModerator(currentUser)) return;
    const affectedPlayerIds = stateRef.current.players
      .filter((p) => p.teamId === team.id)
      .map((p) => p.id);
    const affectedMatchIds = stateRef.current.matches
      .filter((m) => m.homeTeamId === team.id || m.awayTeamId === team.id)
      .map((m) => m.id);

    setState((prev) => ({
      ...prev,
      teams: prev.teams.filter((t) => t.id !== team.id),
      players: prev.players.filter((p) => p.teamId !== team.id),
      matches: prev.matches.filter((m) => m.homeTeamId !== team.id && m.awayTeamId !== team.id),
    }));
    if (inspectedTeamId === team.id) {
      setInspectedTeamId(null);
    }
    setDeletedTombstones((prev) => ({
      teamIds: Array.from(new Set([...(prev.teamIds ?? []), team.id])),
      playerIds: Array.from(new Set([...(prev.playerIds ?? []), ...affectedPlayerIds])),
      matchIds: Array.from(new Set([...(prev.matchIds ?? []), ...affectedMatchIds])),
    }));
    queueMasterSyncForDiscipline(team.disciplineId);
    void deleteFirestoreTeam(team.id, {
      playerIds: affectedPlayerIds,
      matchIds: affectedMatchIds,
    }).catch((err) => reportCloudError('Error eliminando equipo en la base de datos', err));
  };

  const handleAddPhoto = async (photo: PhotoEntry) => {
    await saveFirestorePhoto(photo);
    setState((prev) => ({ ...prev, photos: [photo, ...prev.photos] }));
  };

  const handleDeletePhoto = async (photoId: string) => {
    await deleteFirestorePhoto(photoId);
    setState((prev) => ({
      ...prev,
      photos: prev.photos.filter((p) => p.id !== photoId),
    }));
  };

  const handleAddNews = async (article: NewsArticle) => {
    if (!canManageNews(currentUser)) return;
    await saveFirestoreNewsArticle(article, true);
    setState((prev) => ({
      ...prev,
      news: [article, ...prev.news],
    }));
  };

  const handleUpdateNews = async (article: NewsArticle) => {
    if (!canManageNews(currentUser)) return;
    await saveFirestoreNewsArticle(article, false);
    setState((prev) => ({
      ...prev,
      news: prev.news.map((n) => (n.id === article.id ? article : n)),
    }));
    if (activeNewsArticle?.id === article.id) {
      setActiveNewsArticle(article);
    }
  };

  const handleDeleteNews = async (article: NewsArticle) => {
    if (!canManageNews(currentUser)) return;
    await deleteFirestoreNewsArticle(article.id);
    setState((prev) => ({
      ...prev,
      news: prev.news.filter((n) => n.id !== article.id),
    }));
    if (activeNewsArticle?.id === article.id) {
      setActiveNewsArticle(null);
    }
  };

  const handleSaveDriveRootFolder = async (folderId: string, folderName: string) => {
    await saveFirestoreSettings({
      temporada: state.temporada,
      driveUploadRootFolderId: folderId,
      driveUploadRootFolderName: folderName,
      masterSheets: state.masterSheets,
      autoSyncSheetsEnabled: state.autoSyncSheetsEnabled,
      lastSyncedSpreadsheetId: state.lastSyncedSpreadsheetId,
      lastSyncedAt: state.lastSyncedAt,
    });
    setState((prev) => ({
      ...prev,
      driveUploadRootFolderId: folderId,
      driveUploadRootFolderName: folderName,
    }));
  };

  const handleAdminChangeUserRole = async (
    targetUid: string,
    nextRole: UserRole,
    delegatedTeamId?: string,
    linkedPlayerId?: string
  ) => {
    const targetUser = state.users.find((u) => u.uid === targetUid);
    if (!targetUser || !currentUser) return;
    const check = validateRoleChange(currentUser, targetUser, nextRole);
    if (!check.allowed) {
      throw new Error(check.error || 'No autorizado para modificar roles.');
    }

    await adminUpdateFirestoreUserRole({
      actorUid: currentUser.uid,
      targetUid: targetUser.uid,
      targetEmail: targetUser.email,
      targetDisplayName: targetUser.displayName,
      nextRole,
      delegatedTeamId: nextRole === 'delegado' ? delegatedTeamId : undefined,
      linkedPlayerId: nextRole === 'jugador' ? linkedPlayerId : undefined,
    });

    const updatedTarget: AppUserProfile = {
      ...targetUser,
      role: nextRole,
      delegatedTeamId: nextRole === 'delegado' ? delegatedTeamId : undefined,
      linkedPlayerId: nextRole === 'jugador' ? linkedPlayerId : undefined,
      updatedAt: new Date().toISOString(),
    };

    setState((prev) => {
      const nextRoster = (prev.refereeRoster ?? []).filter((r) => r.uid !== targetUid);
      if (isRefereeOrChiefRole(nextRole)) {
        nextRoster.push({
          uid: targetUid,
          displayName: targetUser.displayName,
          role: nextRole as 'arbitro' | 'jefe_arbitros_futbol' | 'jefe_arbitros_basquetbol' | 'jefe_arbitros_voleibol',
          updatedAt: new Date().toISOString(),
        });
        nextRoster.sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));
      }
      return {
        ...prev,
        users: prev.users.map((u) => (u.uid === targetUid ? updatedTarget : u)),
        refereeRoster: nextRoster,
      };
    });
  };

  const handleInspectPlayerFromHome = (player: Player) => {
    setInspectedPlayer(player);
    setActiveSection('jugadores');
    syncBrowserUrlForSection('jugadores');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenMatchInReferee = (matchId: string) => {
    setFocusedMatchId(matchId);
    setPanelInitialSubTab('arbitro');
    setActiveSection('panel');
    syncBrowserUrlForSection('panel');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAdminEditMatch = (matchId: string) => {
    setFocusedMatchId(matchId);
    setPanelInitialSubTab('partidos');
    setActiveSection('panel');
    syncBrowserUrlForSection('panel');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenSheetsSync = () => {
    setPanelInitialSubTab('sheets');
    setActiveSection('panel');
    syncBrowserUrlForSection('panel');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenNewsManager = () => {
    setPanelInitialSubTab('noticias');
    setActiveSection('panel');
    syncBrowserUrlForSection('panel');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenFeaturedManager = () => {
    setPanelInitialSubTab('portada');
    setActiveSection('panel');
    syncBrowserUrlForSection('panel');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateMatch = (
    updatedMatch: Match,
    scorerPlayerId?: string,
    statDelta?: PlayerStatDelta
  ) => {
    if (!currentUser) return;
    let updatedPlayerForCloud: Player | null = null;

    setState((prev) => {
      const nextMatches = prev.matches.map((m) => (m.id === updatedMatch.id ? updatedMatch : m));
      const nextPlayers =
        scorerPlayerId && statDelta
          ? prev.players.map((p) => {
              if (p.id !== scorerPlayerId) return p;
              const nextP: Player = {
                ...p,
                stats: applyStatDeltaClamped(p.stats, statDelta),
              };
              updatedPlayerForCloud = nextP;
              return nextP;
            })
          : prev.players;

      return {
        ...prev,
        matches: nextMatches,
        players: nextPlayers,
      };
    });

    queueMasterSyncForDiscipline(updatedMatch.disciplineId);

    void saveFirestoreMatch(updatedMatch, false, currentUser.role).catch((err) =>
      reportCloudError('Error actualizando marcador en la base de datos', err)
    );
    if (updatedPlayerForCloud) {
      const target = updatedPlayerForCloud as Player;
      void updateFirestorePlayerStats(target.id, target.stats).catch((err) =>
        reportCloudError('Error actualizando estadísticas del jugador', err)
      );
    }
  };

  const handleAdminAddMatch = (newMatch: Match) => {
    if (!currentUser || !isAdminOrModerator(currentUser)) return;
    setState((prev) => ({
      ...prev,
      matches: [newMatch, ...prev.matches],
    }));
    queueMasterSyncForDiscipline(newMatch.disciplineId);
    void saveFirestoreMatch(newMatch, true, currentUser.role).catch((err) =>
      reportCloudError('Error programando nuevo encuentro en la base de datos', err)
    );
  };

  const handleRegisterTeam = (team: Team, roster: Player[]) => {
    if (!currentUser) return;
    setState((prev) => ({
      ...prev,
      teams: [...prev.teams, team],
      players: [...roster, ...prev.players],
    }));
    queueMasterSyncForDiscipline(team.disciplineId);

    void (async () => {
      try {
        await saveFirestoreTeam(team, currentUser.uid, true);
        await Promise.all(roster.map((p) => saveFirestorePlayer(p, true, currentUser.role)));
      } catch (err) {
        reportCloudError('Error guardando inscripción del equipo en la base de datos', err);
      }
    })();
  };

  const handleCreateTransferRequest = (transfer: TransferRecord) => {
    if (!currentUser || currentUser.role !== 'delegado') return;
    const enrichedTransfer: TransferRecord = { ...transfer, createdByUid: currentUser.uid };
    setState((prev) => ({
      ...prev,
      transfers: [enrichedTransfer, ...prev.transfers],
    }));

    void createFirestoreTransferRequest(enrichedTransfer, currentUser.uid).catch((err) =>
      reportCloudError('Error enviando solicitud de transferencia en la base de datos', err)
    );
  };

  const handleApproveTransferRequest = (
    updatedTransfer: TransferRecord,
    isFromDelegate: boolean
  ) => {
    if (!currentUser || currentUser.role !== 'delegado') return;
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.id === updatedTransfer.playerId ? { ...p, teamId: updatedTransfer.toTeamId } : p
      ),
      transfers: prev.transfers.map((t) =>
        t.id === updatedTransfer.id ? updatedTransfer : t
      ),
    }));
    queueMasterSyncForDiscipline(updatedTransfer.disciplineId);

    void approveFirestoreTransferRequest(updatedTransfer, currentUser.uid, isFromDelegate).catch(
      (err) => reportCloudError('Error confirmando transferencia en la base de datos', err)
    );
  };

  const handleRejectTransferRequest = (updatedTransfer: TransferRecord) => {
    if (!currentUser || currentUser.role !== 'delegado') return;
    setState((prev) => ({
      ...prev,
      transfers: prev.transfers.map((t) =>
        t.id === updatedTransfer.id ? updatedTransfer : t
      ),
    }));

    void rejectFirestoreTransferRequest(updatedTransfer.id, currentUser.uid).catch((err) =>
      reportCloudError('Error rechazando solicitud de transferencia en la base de datos', err)
    );
  };

  const handleUpdateConfig = (
    disciplineId: DisciplineId,
    config: DisciplineFormatConfig,
    rebuildGroups: boolean
  ) => {
    if (!currentUser) return;
    let nextTeams = state.teams;
    let nextMatches = state.matches;
    let regroupedForCloud: Team[] = [];
    let oldMatchIdsToDelete: string[] = [];
    let rebuiltMatchesForCloud: Match[] = [];

    if (rebuildGroups) {
      const otherTeams = state.teams.filter((t) => t.disciplineId !== disciplineId);
      const discTeams = state.teams.filter((t) => t.disciplineId === disciplineId);
      regroupedForCloud = generateEquitableGroups(discTeams, config.numGrupos);
      nextTeams = [...otherTeams, ...regroupedForCloud];

      oldMatchIdsToDelete = state.matches
        .filter((m) => m.disciplineId === disciplineId)
        .map((m) => m.id);
      const otherMatches = state.matches.filter((m) => m.disciplineId !== disciplineId);
      const meta = DISCIPLINE_MAP[disciplineId];
      const refId =
        meta.sportType === 'futbol7'
          ? 'ref-f7-1'
          : meta.sportType === 'voleibol'
          ? 'ref-vl-1'
          : 'ref-bk-1';
      const groups = Array.from(new Set(regroupedForCloud.map((t) => t.groupName))).sort();
      rebuiltMatchesForCloud = groups.flatMap((g) =>
        generateRoundRobinMatches(
          disciplineId,
          g,
          regroupedForCloud.filter((t) => t.groupName === g),
          meta.sedePrincipal,
          refId
        )
      );
      nextMatches = [...otherMatches, ...rebuiltMatchesForCloud];
    }

    setState((prev) => ({
      ...prev,
      configs: {
        ...prev.configs,
        [disciplineId]: config,
      },
      teams: nextTeams,
      matches: nextMatches,
    }));
    if (oldMatchIdsToDelete.length > 0) {
      setDeletedTombstones((prev) => ({
        ...prev,
        matchIds: Array.from(new Set([...(prev.matchIds ?? []), ...oldMatchIdsToDelete])),
      }));
    }
    queueMasterSyncForDiscipline(disciplineId);

    void (async () => {
      try {
        await saveFirestoreDisciplineConfig(config);
        if (rebuildGroups) {
          await Promise.all(
            regroupedForCloud.map((t) => saveFirestoreTeam(t, currentUser.uid, false))
          );
          if (oldMatchIdsToDelete.length > 0) {
            await deleteFirestoreMatchesForDiscipline(oldMatchIdsToDelete);
          }
          await Promise.all(
            rebuiltMatchesForCloud.map((m) => saveFirestoreMatch(m, true, currentUser.role))
          );
        }
      } catch (err) {
        reportCloudError('Error guardando configuración del campeonato', err);
      }
    })();
  };

  const handleSaveMasterSheets = async (
    nextMasterSheets: MasterSheetsConfig,
    nextAutoSyncEnabled?: boolean
  ) => {
    const resolvedAutoSync =
      nextAutoSyncEnabled !== undefined ? nextAutoSyncEnabled : state.autoSyncSheetsEnabled;
    await saveFirestoreSettings({
      temporada: state.temporada,
      driveUploadRootFolderId: state.driveUploadRootFolderId,
      driveUploadRootFolderName: state.driveUploadRootFolderName,
      masterSheets: nextMasterSheets,
      autoSyncSheetsEnabled: resolvedAutoSync,
      lastSyncedSpreadsheetId: state.lastSyncedSpreadsheetId,
      lastSyncedAt: state.lastSyncedAt,
    });
    setState((prev) => ({
      ...prev,
      masterSheets: nextMasterSheets,
      autoSyncSheetsEnabled: resolvedAutoSync,
    }));
  };

  const handleClearPendingSyncKeys = (keys: MasterSheetKey[]) => {
    const cleared = new Set(keys);
    setPendingSyncKeys((prev) => prev.filter((k) => !cleared.has(k)));
  };

  const handleMarkSynced = (spreadsheetId: string) => {
    const syncedAt = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      lastSyncedSpreadsheetId: spreadsheetId,
      lastSyncedAt: syncedAt,
    }));
    void saveFirestoreSettings({
      temporada: state.temporada,
      driveUploadRootFolderId: state.driveUploadRootFolderId,
      driveUploadRootFolderName: state.driveUploadRootFolderName,
      masterSheets: state.masterSheets,
      autoSyncSheetsEnabled: state.autoSyncSheetsEnabled,
      lastSyncedSpreadsheetId: spreadsheetId,
      lastSyncedAt: syncedAt,
    }).catch((err) => reportCloudError('Error guardando ID de Google Sheets', err));
  };

  const handleSaveHomeFeatured = async (config: HomeFeaturedConfig) => {
    await saveFirestoreSettings({
      temporada: state.temporada,
      driveUploadRootFolderId: state.driveUploadRootFolderId,
      driveUploadRootFolderName: state.driveUploadRootFolderName,
      masterSheets: state.masterSheets,
      autoSyncSheetsEnabled: state.autoSyncSheetsEnabled,
      lastSyncedSpreadsheetId: state.lastSyncedSpreadsheetId,
      lastSyncedAt: state.lastSyncedAt,
      homeFeatured: config,
    });
    setState((prev) => {
      const next = { ...prev, homeFeatured: config };
      saveCachedPublicTournamentState(next);
      return next;
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#050507] text-zinc-100">
      <Navbar
        activeSection={activeSection}
        currentUser={currentUser}
        state={state}
        onNavigate={handleNavigate}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenMatchModal={(match) => setActiveMatchModalId(match.id)}
      />

      {/* Calm, single, session-dismissible notice for conventional visitors when read issues occur */}
      {!(activeSection === 'panel' && isAdminOrModerator(currentUser)) &&
        !(activeSection !== 'privacidad' && initialSyncPhase === 'error') &&
        shouldShowPublicReadNotice({
          summary: syncHealth,
          dismissedKind: dismissedPublicNoticeKind,
        }) && (
          <div
            data-testid="public-read-notice"
            role="status"
            className="bg-[#12100b]/95 border-b border-amber-400/25 text-amber-100/95 px-4 py-2.5 text-xs backdrop-blur-md"
          >
            <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-3">
              <span className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-300 shrink-0" />
                <span>{syncHealth.publicNoticeMessage}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  if (syncHealth.incident) {
                    setDismissedPublicNoticeKind(syncHealth.incident.kind);
                  }
                }}
                aria-label="Cerrar aviso de lectura"
                className="p-1 text-amber-200/75 hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      {/* Actionable non-quota write/operation error banner (e.g., permission/validation on explicit action) */}
      {cloudError && (
        <div
          role="alert"
          className="bg-red-950/60 border-b border-red-500/30 text-red-200 px-4 py-2.5 text-xs backdrop-blur-md"
        >
          <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{cloudError}</span>
            </span>
            <button
              type="button"
              onClick={() => setCloudError(null)}
              aria-label="Cerrar alerta"
              className="p-1 text-red-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        {activeSection !== 'privacidad' && initialSyncPhase !== 'ready' ? (
          <InitialLoadSkeleton
            phase={initialSyncPhase}
            errorDetail={initialSyncErrorDetail}
            isQuotaOrReadIssue={syncHealth.hasReadIssues}
            isAdmin={isAdminOrModerator(currentUser)}
            onRetry={handleRetryInitialSync}
          />
        ) : (
          <AnimatePresence mode="wait">
            <PageTransition key={activeSection}>
            {activeSection === 'inicio' && (
              <HomeView
                state={state}
                currentUser={currentUser}
                selectedDiscipline={selectedDiscipline}
                editorialPhotos={editorialPhotos}
                onSelectDiscipline={setSelectedDiscipline}
                onNavigate={handleNavigate}
                onInspectPlayer={handleInspectPlayerFromHome}
                onInspectTeam={setInspectedTeamId}
                onOpenMatchModal={(match) => setActiveMatchModalId(match.id)}
                onOpenMatchInReferee={handleOpenMatchInReferee}
                onOpenNewsArticle={setActiveNewsArticle}
                onOpenNewsManager={handleOpenNewsManager}
                onOpenFeaturedManager={handleOpenFeaturedManager}
                onToggleFavoriteTeam={handleToggleFavoriteTeam}
                onOpenAuth={() => setAuthModalOpen(true)}
              />
            )}

            {activeSection === 'posiciones' && (
              <StandingsView
                state={state}
                currentUser={currentUser}
                selectedDiscipline={selectedDiscipline}
                onSelectDiscipline={setSelectedDiscipline}
                onInspectTeam={setInspectedTeamId}
                onOpenMatchModal={(match) => setActiveMatchModalId(match.id)}
                onToggleFavoriteTeam={handleToggleFavoriteTeam}
                onOpenAuth={() => setAuthModalOpen(true)}
              />
            )}

            {activeSection === 'equipos' && (
              <TeamsView
                state={state}
                selectedDiscipline={selectedDiscipline}
                onSelectDiscipline={setSelectedDiscipline}
                onOpenTeamProfile={(team) => setInspectedTeamId(team.id)}
              />
            )}

            {activeSection === 'jugadores' && (
              <PlayersView
                state={state}
                currentUser={currentUser}
                selectedPlayer={inspectedPlayer}
                onSelectPlayer={setInspectedPlayer}
                onInspectTeam={setInspectedTeamId}
                onUpdatePlayer={handleUpdatePlayer}
                onLoadTeamPlayers={handleLoadTeamPlayers}
                onSearchPlayers={handleSearchPlayers}
              />
            )}

            {activeSection === 'votaciones' && (
              <VotationsView
                state={state}
                selectedDiscipline={selectedDiscipline}
                currentUser={currentUser}
                onSelectDiscipline={setSelectedDiscipline}
                onOpenAuth={() => setAuthModalOpen(true)}
                onOpenMatchMvp={(match) => setActiveMatchModalId(match.id)}
                onVoteChampionshipMvp={handleVoteChampionshipMvp}
                onVotePositionAward={handleVotePositionAward}
                onSubmitTotyBallot={handleSubmitTotyBallot}
                pendingTotyDisciplines={pendingTotyDisciplines}
                onFlushTotyBatch={flushPendingTotyBallots}
                onLoadTeamPlayers={handleLoadTeamPlayers}
                onSearchPlayers={handleSearchPlayers}
              />
            )}

            {activeSection === 'minijuegos' && (
              <MinigamesView
                state={state}
                currentUser={currentUser}
                onOpenAuth={() => setAuthModalOpen(true)}
                onSaveLeyendasEntry={handleSaveLeyendasEntry}
              />
            )}

            {activeSection === 'galeria' && (
              <GalleryView
                state={state}
                currentUser={currentUser}
                onAddPhoto={handleAddPhoto}
                onDeletePhoto={handleDeletePhoto}
                onSaveDriveRootFolder={handleSaveDriveRootFolder}
                onOpenAuth={() => setAuthModalOpen(true)}
              />
            )}

            {activeSection === 'inscripciones' && (
              <RegistrationView
                state={state}
                currentUser={currentUser}
                onRegisterTeam={handleRegisterTeam}
                onUpdateTeam={handleUpdateTeam}
                onUpdatePlayer={handleUpdatePlayer}
                onAddPlayerToTeam={handleAddPlayerToTeam}
                onOpenSheetsSync={handleOpenSheetsSync}
                onOpenAuth={() => setAuthModalOpen(true)}
              />
            )}

            {activeSection === 'transferencias' && (
              <TransfersView
                state={state}
                currentUser={currentUser}
                onCreateTransferRequest={handleCreateTransferRequest}
                onApproveTransferRequest={handleApproveTransferRequest}
                onRejectTransferRequest={handleRejectTransferRequest}
                onNavigate={handleNavigate}
                onOpenAuth={() => setAuthModalOpen(true)}
                onLoadTeamPlayers={handleLoadTeamPlayers}
              />
            )}

            {activeSection === 'transferencias-publicas' && (
              <PublicTransfersView
                state={state}
                currentUser={currentUser}
                onInspectTeam={setInspectedTeamId}
                onNavigate={handleNavigate}
              />
            )}

            {activeSection === 'cuenta' && (
              <AccountView
                state={state}
                currentUser={currentUser}
                onOpenAuth={() => setAuthModalOpen(true)}
                onToggleFavoriteTeam={handleToggleFavoriteTeam}
                onToggleNotifications={handleToggleNotifications}
                onUpdateUserProfile={handleUpdateUserProfile}
                onUpdatePlayerProfile={handleUpdatePlayer}
                onInspectTeam={setInspectedTeamId}
                onOpenMatchModal={(match) => setActiveMatchModalId(match.id)}
                onNavigate={handleNavigate}
              />
            )}

            {activeSection === 'panel' && (
              <AdminRefereeView
                state={state}
                currentUser={currentUser}
                editorialPhotos={editorialPhotos}
                initialSubTab={panelInitialSubTab}
                focusedMatchId={focusedMatchId}
                pendingSyncKeys={pendingSyncKeys}
                deletedIds={deletedTombstones}
                autoSyncSessionApproved={autoSyncSessionApproved}
                autoSyncState={autoSyncState}
                onUpdateMatch={handleUpdateMatch}
                onAddMatch={handleAdminAddMatch}
                onAddTeam={handleAdminAddTeam}
                onUpdateTeam={handleUpdateTeam}
                onDeleteTeam={handleAdminDeleteTeam}
                onBulkUpdateTeams={handleBulkUpdateTeams}
                onAddPlayer={handleAddPlayerToTeam}
                onUpdatePlayer={handleUpdatePlayer}
                onDeletePlayer={handleDeletePlayer}
                onAddNews={handleAddNews}
                onUpdateNews={handleUpdateNews}
                onDeleteNews={handleDeleteNews}
                onAddPhoto={handleAddPhoto}
                onDeletePhoto={handleDeletePhoto}
                onSaveDriveRootFolder={handleSaveDriveRootFolder}
                onUpdateConfig={handleUpdateConfig}
                onSaveMasterSheets={handleSaveMasterSheets}
                onApproveAutoSyncSession={setAutoSyncSessionApproved}
                onClearPendingSyncKeys={handleClearPendingSyncKeys}
                onClearDeletedTombstones={handleClearDeletedTombstones}
                onApplySheetImports={handleApplySheetImports}
                onMarkSynced={handleMarkSynced}
                onAdminChangeUserRole={handleAdminChangeUserRole}
                onSaveAwardNominees={handleSaveAwardNominees}
                totyLastSyncAt={totyLastSyncAt}
                totyRealtimeActive={totyRealtimeActive}
                onSaveTotyConfig={handleSaveTotyConfig}
                onResetTotyConfig={handleResetTotyConfig}
                onSaveTotyDeadline={handleSaveTotyDeadline}
                onMigrateTotyFromFirestore={handleMigrateTotyFromFirestore}
                onImportLocalTotyBackup={handleImportLocalTotyBackup}
                onSaveHomeFeatured={handleSaveHomeFeatured}
                onRefreshUsers={handleRefreshUsers}
                syncHealth={syncHealth}
                onRetryCloudSync={handleRetryInitialSync}
                onOpenAuth={() => setAuthModalOpen(true)}
              />
            )}

            {activeSection === 'privacidad' && (
              <PrivacyPolicyView onNavigate={handleNavigate} />
            )}
            </PageTransition>
          </AnimatePresence>
        )}
      </main>

      <Footer
        onNavigate={handleNavigate}
        hasOpenRegistrations={Object.values(state.configs).some(
          (c) => c.inscripcionesAbiertas
        )}
      />

      <NewsArticleModal
        article={activeNewsArticle}
        onClose={() => setActiveNewsArticle(null)}
      />

      <TeamProfileModal
        team={inspectedTeam}
        teams={state.teams}
        players={state.players}
        matches={state.matches}
        mvpVotes={state.mvpVotes}
        currentUser={currentUser}
        onClose={() => setInspectedTeamId(null)}
        onToggleFavoriteTeam={handleToggleFavoriteTeam}
        onOpenMatchModal={(match) => setActiveMatchModalId(match.id)}
        onInspectPlayer={handleInspectPlayerFromHome}
        onAdminEditMatch={handleAdminEditMatch}
        onLoadTeamPlayers={handleLoadTeamPlayers}
      />

      <MatchMvpModal
        match={activeModalMatch}
        teams={state.teams}
        players={state.players}
        mvpVotes={state.mvpVotes}
        currentUser={currentUser}
        onClose={() => setActiveMatchModalId(null)}
        onVoteMvp={handleVoteMvp}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenMatchInReferee={handleOpenMatchInReferee}
        onToggleFavoriteTeam={handleToggleFavoriteTeam}
        onLoadTeamPlayers={handleLoadTeamPlayers}
      />

      <AuthModal
        open={authModalOpen}
        currentUser={currentUser}
        googleAuthLoading={googleAuthLoading}
        googleAuthError={googleAuthError}
        onClose={() => setAuthModalOpen(false)}
        onGoogleSignIn={handleGoogleSignIn}
        onSignOut={handleSignOut}
        onOpenAccountHub={() => handleNavigate('cuenta')}
        onOpenPrivacy={() => handleNavigate('privacidad')}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <AppContent />
      </MotionConfig>
    </ErrorBoundary>
  );
}
