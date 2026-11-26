import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { createInitialTournamentState, DISCIPLINE_MAP } from './data/ufroSeed';
import { validateRoleChange } from './domain/rbacEngine';
import { generateEquitableGroups, generateRoundRobinMatches } from './domain/tournamentEngine';
import { applyStatDeltaClamped, type PlayerStatDelta } from './domain/liveMatchEngine';
import {
  CORE_REALTIME_STREAMS,
  computeInitialSyncPhase,
  mergePublicNewsPreservingDrafts,
  mergePublicPlayersPreservingPii,
  mergePublicTransfersPreservingPrivate,
  type CoreRealtimeStreamKey,
  type PublicRealtimeStreamKey,
} from './domain/realtimeSyncEngine';
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
  createFirestoreTransferRequest,
  deleteFirestoreMatchesForDiscipline,
  deleteFirestoreNewsArticle,
  deleteFirestorePhoto,
  deleteFirestorePlayer,
  deleteFirestoreTeam,
  deleteFirestoreTotyConfig,
  ensureAllConfigsInFirestore,
  listAllFirestoreNews,
  listAllFirestoreTransfers,
  listDelegateFirestoreTransfers,
  listFirestoreUsers,
  loadAuthorizedPlayerPrivateMap,
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
  saveFirestoreTotyBallot,
  saveFirestoreTotyConfig,
  subscribeToPublicTournamentState,
  subscribeToTotyBallots,
  subscribeToTotyConfigs,
  syncGoogleUserToFirestore,
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

function isPrivacyPath(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, '').toLowerCase();
  return (
    clean === '/privacidad' ||
    clean === '/politica-de-privacidad' ||
    clean === '/privacy' ||
    clean === '/privacy-policy'
  );
}

function AppContent() {
  const [initialBoot] = useState<{ state: TournamentState; hasCachedSnapshot: boolean }>(() => {
    const base = createInitialTournamentState();
    const cached = loadCachedPublicTournamentState();
    if (!cached?.data) {
      return { state: base, hasCachedSnapshot: false };
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
      totyBallots: cached.data.totyBallots ?? base.totyBallots,
      totyConfigs: cached.data.totyConfigs ?? base.totyConfigs,
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
    return { state: merged, hasCachedSnapshot: hasMeaningfulData };
  });
  const [state, setState] = useState<TournamentState>(() => initialBoot.state);
  const [activeSection, setActiveSection] = useState<NavSection>(() =>
    typeof window !== 'undefined' && isPrivacyPath(window.location.pathname)
      ? 'privacidad'
      : 'inicio'
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
  const [totyLastSyncAt, setTotyLastSyncAt] = useState<string | null>(null);
  const [totyRealtimeActive, setTotyRealtimeActive] = useState(false);

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

  const reportCloudError = useCallback((context: string, err: unknown) => {
    const detail = err instanceof Error ? err.message : 'Error de sincronización con Firestore.';
    console.error(`[Firestore] ${context}:`, err);
    setCloudError(`${context}: ${detail}`);
  }, []);

  const currentUserRoleRef = useRef<UserRole | null>(null);

  const handleRetryInitialSync = useCallback(() => {
    setSettledCoreStreams(new Set());
    setFailedCoreStreams(new Set());
    setInitialSyncTimedOut(false);
    setInitialSyncErrorDetail(null);
    setCloudError(null);
    setRealtimeRetryNonce((n) => n + 1);
  }, []);

  // 1. Live Real-Time Firestore Subscriptions for all public tournament collections
  // Any change published by an Admin, Referee, Delegate, or Press user propagates instantly across devices.
  useEffect(() => {
    const coreSet = new Set<string>(CORE_REALTIME_STREAMS);
    const markCoreSettled = (key: CoreRealtimeStreamKey) => {
      setSettledCoreStreams((prev) => {
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      setFailedCoreStreams((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    };

    const timeoutId = window.setTimeout(() => {
      setInitialSyncTimedOut(true);
    }, 10_000);

    const unsubscribePublic = subscribeToPublicTournamentState({
      onSettings: (patch) => {
        setState((prev) => ({
          ...prev,
          temporada: patch.temporada ?? prev.temporada,
          homeFeatured: patch.homeFeatured !== undefined ? patch.homeFeatured : prev.homeFeatured,
          driveUploadRootFolderId: patch.driveUploadRootFolderId ?? prev.driveUploadRootFolderId,
          driveUploadRootFolderName:
            patch.driveUploadRootFolderName ?? prev.driveUploadRootFolderName,
          masterSheets: patch.masterSheets ?? prev.masterSheets,
          autoSyncSheetsEnabled: patch.autoSyncSheetsEnabled ?? prev.autoSyncSheetsEnabled,
          lastSyncedSpreadsheetId: patch.lastSyncedSpreadsheetId ?? prev.lastSyncedSpreadsheetId,
          lastSyncedAt: patch.lastSyncedAt ?? prev.lastSyncedAt,
        }));
        markCoreSettled('settings');
      },
      onConfigs: (configs) => {
        setState((prev) => ({ ...prev, configs }));
        markCoreSettled('configs');
      },
      onTeams: (teams) => {
        setState((prev) => ({ ...prev, teams }));
        markCoreSettled('teams');
      },
      onPlayers: (incomingPlayers) => {
        setState((prev) => ({
          ...prev,
          players: mergePublicPlayersPreservingPii(prev.players, incomingPlayers),
        }));
        markCoreSettled('players');
      },
      onMatches: (matches) => {
        setState((prev) => ({ ...prev, matches }));
        markCoreSettled('matches');
      },
      onNews: (publishedNews) => {
        const keepDrafts =
          currentUserRoleRef.current === 'admin' || currentUserRoleRef.current === 'prensa';
        setState((prev) => ({
          ...prev,
          news: mergePublicNewsPreservingDrafts(prev.news, publishedNews, keepDrafts),
        }));
        markCoreSettled('news');
      },
      onTransfers: (approvedTransfers) => {
        const keepPrivate =
          currentUserRoleRef.current === 'admin' || currentUserRoleRef.current === 'delegado';
        setState((prev) => ({
          ...prev,
          transfers: mergePublicTransfersPreservingPrivate(
            prev.transfers,
            approvedTransfers,
            keepPrivate
          ),
        }));
      },
      onPhotos: (photos) => {
        setState((prev) => ({ ...prev, photos }));
      },
      onMvpVotes: (mvpVotes) => {
        setState((prev) => ({ ...prev, mvpVotes }));
      },
      onAwardNominees: (awardNominees) => {
        setState((prev) => ({ ...prev, awardNominees }));
      },
      onChampionshipMvpVotes: (championshipMvpVotes) => {
        setState((prev) => ({ ...prev, championshipMvpVotes }));
      },
      onPositionAwardVotes: (positionAwardVotes) => {
        setState((prev) => ({ ...prev, positionAwardVotes }));
      },
      onLeyendasLeaderboard: (leyendasLeaderboard) => {
        setState((prev) => ({ ...prev, leyendasLeaderboard }));
      },
      onStreamError: (stream: PublicRealtimeStreamKey, err: unknown) => {
        const detail =
          err instanceof Error ? err.message : 'Error de conexión en tiempo real con Firestore.';
        if (detail.toLowerCase().includes('quota exceeded')) {
          reportCloudError('Cuota diaria de Firestore alcanzada', err);
        }
        if (coreSet.has(stream)) {
          const coreKey = stream as CoreRealtimeStreamKey;
          setFailedCoreStreams((prev) => {
            if (prev.has(coreKey)) return prev;
            const next = new Set(prev);
            next.add(coreKey);
            return next;
          });
          setInitialSyncErrorDetail((prev) => prev ?? detail);
        }
      },
    });

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribePublic();
    };
  }, [realtimeRetryNonce, reportCloudError]);

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
        profile.role === 'admin' ||
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

      // If signed-in user is Admin or Prensa Oficial, load all news (including unpublished drafts)
      if (profile.role === 'admin' || profile.role === 'prensa') {
        try {
          const allNews = await listAllFirestoreNews();
          setState((prev) => ({ ...prev, news: allNews }));
        } catch (err) {
          console.error('Error cargando borradores de noticias:', err);
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

      // If signed-in user is an Admin, load all Firestore users, all transfers & ensure 8 discipline configs exist
      if (profile.role === 'admin') {
        try {
          const [cloudUsers, allTransfers] = await Promise.all([
            listFirestoreUsers(),
            listAllFirestoreTransfers().catch(() => null),
            ensureAllConfigsInFirestore(currentConfigs).catch(() => undefined),
          ]);
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

          await hydrateForAuthenticatedProfile(
            profile,
            stateRef.current.players,
            stateRef.current.configs
          );
        } catch (err) {
          reportCloudError('Error sincronizando sesión con Firestore', err);
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

  // 2B. Real-time Firestore listeners for TOTY ballots & discipline formation configs
  useEffect(() => {
    if (activeSection !== 'panel' && activeSection !== 'votaciones') {
      setTotyRealtimeActive(false);
      return;
    }
    const unsubBallots = subscribeToTotyBallots(
      (ballots) => {
        setState((prev) => ({ ...prev, totyBallots: ballots }));
        setTotyLastSyncAt(new Date().toISOString());
        setTotyRealtimeActive(true);
      },
      (err) => {
        console.warn('Error en suscripción en vivo de papeletas TOTY:', err);
        setTotyRealtimeActive(false);
      }
    );
    const unsubConfigs = subscribeToTotyConfigs(
      (totyConfigs) => {
        setState((prev) => ({ ...prev, totyConfigs }));
        setTotyLastSyncAt(new Date().toISOString());
        setTotyRealtimeActive(true);
      },
      (err) => {
        console.warn('Error en suscripción en vivo de configuración TOTY:', err);
      }
    );
    return () => {
      unsubBallots();
      unsubConfigs();
      setTotyRealtimeActive(false);
    };
  }, [activeSection]);

  const currentUser: AppUserProfile | null = useMemo(() => {
    if (!currentUserUid) return null;
    return state.users.find((u) => u.uid === currentUserUid) ?? null;
  }, [currentUserUid, state.users]);

  useEffect(() => {
    currentUserRoleRef.current = currentUser?.role ?? null;
  }, [currentUser?.role]);

  // 2C. Hydrate authorized student PII once players stream finishes arriving for signed-in staff/delegates/players
  const piiHydratedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentUser) {
      piiHydratedKeyRef.current = null;
      return;
    }
    if (
      currentUser.role !== 'admin' &&
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

      // 2. Persist every Sheet-side change to Firestore
      try {
        await Promise.all([
          ...imports.teamsToCreate.map((t) => saveFirestoreTeam(t, currentUser.uid, true)),
          ...imports.teamsToUpdate.map((t) => saveFirestoreTeam(t, currentUser.uid, false)),
          ...imports.playersToCreate.map((p) => saveFirestorePlayer(p, true, currentUser.role)),
          ...imports.playersToUpdate.map((p) => saveFirestorePlayer(p, false, currentUser.role)),
          ...imports.matchesToCreate.map((m) => saveFirestoreMatch(m, true, currentUser.role)),
          ...imports.matchesToUpdate.map((m) => saveFirestoreMatch(m, false, currentUser.role)),
          ...imports.configsToUpdate.map((cfg) => saveFirestoreDisciplineConfig(cfg)),
        ]);
      } catch (err) {
        reportCloudError('Error aplicando cambios importados desde Google Sheets a Firestore', err);
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
      currentUser?.role !== 'admin'
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

  useEffect(() => {
    const onPopState = () => {
      if (isPrivacyPath(window.location.pathname)) {
        setActiveSection('privacidad');
      } else {
        setActiveSection((prev) => (prev === 'privacidad' ? 'inicio' : prev));
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleNavigate = (section: NavSection) => {
    setActiveSection(section);
    if (section !== 'jugadores') {
      setInspectedPlayer(null);
    }
    if (typeof window !== 'undefined') {
      if (section === 'privacidad' && !isPrivacyPath(window.location.pathname)) {
        window.history.pushState({}, '', '/privacidad');
      } else if (section !== 'privacidad' && isPrivacyPath(window.location.pathname)) {
        window.history.pushState({}, '', '/');
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    try {
      await signOutGoogle();
    } catch {
      // Ignore if already signed out
    }
    setAutoSyncSessionApproved(false);
    setCurrentUserUid(null);
  };

  const handleRefreshUsers = async () => {
    if (currentUser?.role !== 'admin') return;
    try {
      const cloudUsers = await listFirestoreUsers();
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
    if (!currentUser || currentUser.role !== 'admin') return;
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
    if (!currentUser || currentUser.role !== 'admin') return;
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
      setTotyLastSyncAt(new Date().toISOString());
    } catch (err) {
      reportCloudError('Error guardando configuración TOTY por disciplina', err);
      throw err;
    }
  };

  const handleResetTotyConfig = async (disciplineId: DisciplineId) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    setState((prev) => {
      const nextConfigs = { ...prev.totyConfigs };
      delete nextConfigs[disciplineId];
      return { ...prev, totyConfigs: nextConfigs };
    });
    try {
      await deleteFirestoreTotyConfig(disciplineId);
      setTotyLastSyncAt(new Date().toISOString());
    } catch (err) {
      reportCloudError('Error restaurando formación TOTY estándar', err);
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

  const handleSubmitTotyBallot = async (
    disciplineId: DisciplineId,
    selections: Record<string, string>
  ) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    const ballotId = `${disciplineId}_${currentUser.uid}`;
    const now = new Date().toISOString();
    const ballot: TotyBallotRecord = {
      id: ballotId,
      disciplineId,
      temporada: stateRef.current.temporada,
      voterUid: currentUser.uid,
      selections,
      updatedAt: now,
    };
    setState((prev) => {
      const exists = prev.totyBallots.some((b) => b.id === ballotId);
      return {
        ...prev,
        totyBallots: exists
          ? prev.totyBallots.map((b) => (b.id === ballotId ? ballot : b))
          : [ballot, ...prev.totyBallots],
      };
    });
    try {
      await saveFirestoreTotyBallot(ballot);
    } catch (err) {
      reportCloudError('Error guardando boleta de Equipo Ideal (TOTY)', err);
    }
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
      reportCloudError('Error registrando estudiante en Firestore', err)
    );
  };

  const handleDeletePlayer = (player: Player) => {
    if (!currentUser || currentUser.role !== 'admin') return;
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
      reportCloudError('Error eliminando jugador en Firestore', err)
    );
  };

  const handleAdminAddTeam = (team: Team) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    const enriched: Team = { ...team, createdByUid: currentUser.uid };
    setState((prev) => ({
      ...prev,
      teams: [...prev.teams, enriched],
    }));
    queueMasterSyncForDiscipline(enriched.disciplineId);
    void saveFirestoreTeam(enriched, currentUser.uid, true).catch((err) =>
      reportCloudError('Error agregando equipo en Firestore', err)
    );
  };

  const handleUpdateTeam = (team: Team) => {
    if (!currentUser) return;
    const isAdmin = currentUser.role === 'admin';
    const isAuthorizedDelegado =
      currentUser.role === 'delegado' &&
      (currentUser.delegatedTeamId === team.id || team.createdByUid === currentUser.uid);
    if (!isAdmin && !isAuthorizedDelegado) return;

    setState((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => (t.id === team.id ? { ...t, ...team } : t)),
    }));
    queueMasterSyncForDiscipline(team.disciplineId);
    void saveFirestoreTeam(team, currentUser.uid, false, currentUser.role).catch((err) =>
      reportCloudError('Error actualizando equipo en Firestore', err)
    );
  };

  const handleAdminDeleteTeam = (team: Team) => {
    if (!currentUser || currentUser.role !== 'admin') return;
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
    }).catch((err) => reportCloudError('Error eliminando equipo en Firestore', err));
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
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'prensa')) return;
    await saveFirestoreNewsArticle(article, true);
    setState((prev) => ({
      ...prev,
      news: [article, ...prev.news],
    }));
  };

  const handleUpdateNews = async (article: NewsArticle) => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'prensa')) return;
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
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'prensa')) return;
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

    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.uid === targetUid ? updatedTarget : u)),
    }));
  };

  const handleInspectPlayerFromHome = (player: Player) => {
    setInspectedPlayer(player);
    setActiveSection('jugadores');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenMatchInReferee = (matchId: string) => {
    setFocusedMatchId(matchId);
    setPanelInitialSubTab('arbitro');
    setActiveSection('panel');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAdminEditMatch = (matchId: string) => {
    setFocusedMatchId(matchId);
    setPanelInitialSubTab('partidos');
    setActiveSection('panel');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenSheetsSync = () => {
    setPanelInitialSubTab('sheets');
    setActiveSection('panel');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenNewsManager = () => {
    setPanelInitialSubTab('noticias');
    setActiveSection('panel');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenFeaturedManager = () => {
    setPanelInitialSubTab('portada');
    setActiveSection('panel');
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
      reportCloudError('Error actualizando marcador en Firestore', err)
    );
    if (updatedPlayerForCloud) {
      const target = updatedPlayerForCloud as Player;
      void updateFirestorePlayerStats(target.id, target.stats).catch((err) =>
        reportCloudError('Error actualizando estadísticas del jugador', err)
      );
    }
  };

  const handleAdminAddMatch = (newMatch: Match) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    setState((prev) => ({
      ...prev,
      matches: [newMatch, ...prev.matches],
    }));
    queueMasterSyncForDiscipline(newMatch.disciplineId);
    void saveFirestoreMatch(newMatch, true, 'admin').catch((err) =>
      reportCloudError('Error programando nuevo encuentro en Firestore', err)
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
        reportCloudError('Error guardando inscripción del equipo en Firestore', err);
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
      reportCloudError('Error enviando solicitud de transferencia en Firestore', err)
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
      (err) => reportCloudError('Error confirmando transferencia en Firestore', err)
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
      reportCloudError('Error rechazando solicitud de transferencia en Firestore', err)
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
    <div className="min-h-screen flex flex-col bg-white text-[#0d0d0d]">
      <Navbar
        activeSection={activeSection}
        currentUser={currentUser}
        state={state}
        onNavigate={handleNavigate}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenMatchModal={(match) => setActiveMatchModalId(match.id)}
      />

      {cloudError && (
        <div
          role="alert"
          className="bg-red-50 border-b border-red-300 text-red-900 px-4 py-2.5 text-xs"
        >
          <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{cloudError}</span>
            </span>
            <button
              type="button"
              onClick={() => setCloudError(null)}
              aria-label="Cerrar alerta"
              className="p-1 text-red-700 hover:text-red-950 cursor-pointer"
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
            onRetry={handleRetryInitialSync}
          />
        ) : (
          <>
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
                onAddPlayer={handleAddPlayerToTeam}
                onUpdatePlayer={handleUpdatePlayer}
                onDeletePlayer={handleDeletePlayer}
                onAddNews={handleAddNews}
                onUpdateNews={handleUpdateNews}
                onDeleteNews={handleDeleteNews}
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
                onSaveHomeFeatured={handleSaveHomeFeatured}
                onRefreshUsers={handleRefreshUsers}
                onOpenAuth={() => setAuthModalOpen(true)}
              />
            )}

            {activeSection === 'privacidad' && (
              <PrivacyPolicyView onNavigate={handleNavigate} />
            )}
          </>
        )}
      </main>

      <Footer onNavigate={handleNavigate} />

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
      <AppContent />
    </ErrorBoundary>
  );
}
