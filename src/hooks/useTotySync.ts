import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { NavSection } from '../domain/navigationRoutes';
import { isAdminOrModerator } from '../domain/rbacEngine';
import { mergeLazyPlayersPreservingPii } from '../domain/readOptimizationEngine';
import {
  enqueueTotyBallotItem,
  mergeTotyBallotsIntoState,
  planTotyBallotBatch,
  type TotyBallotBatchItem,
  type TotyBallotSubmissionInput,
} from '../domain/totyBatchQueue';
import {
  deleteFirestoreTotyConfig,
  fetchAllFirestoreTotyData,
  fetchAllPlayersForAdmin,
  fetchPlayerById,
  fetchPublicTotyConfigAndOwnBallot,
  importAdminTotyBallotsToTurso,
  migrateTotyBallotsFromFirestoreToTurso,
  saveFirestoreSettings,
  saveFirestoreTotyBallotsBatch,
  saveFirestoreTotyConfig,
} from '../services/firestoreService';
import {
  areAllTotyDisciplinesFresh,
  loadAllCachedTotyData,
  loadCachedTotyForDiscipline,
  removeCachedTotyConfig,
  saveAllCachedTotySnapshot,
  saveCachedTotyForDiscipline,
  upsertCachedTotyBallots,
  upsertCachedTotyConfig,
} from '../services/totyIndexedCache';
import type {
  AppUserProfile,
  DisciplineId,
  DisciplineTotyConfig,
  Player,
  TotyBallotRecord,
  TournamentState,
} from '../types/tournament';

interface UseTotySyncParams {
  initialBallots: TotyBallotRecord[];
  initialCachedAtIso: string | null;
  activeSection: NavSection;
  selectedDiscipline: DisciplineId;
  currentUser: AppUserProfile | null;
  currentUserUid: string | null;
  realtimeRetryNonce: number;
  stateRef: MutableRefObject<TournamentState>;
  adminFullPlayersLoadedRef: MutableRefObject<boolean>;
  setState: Dispatch<SetStateAction<TournamentState>>;
  onRequireAuth: () => void;
  onPlayersStreamHealthy: () => void;
  reportCloudError: (context: string, err: unknown, streamKey?: string) => void;
}

export function useTotySync({
  initialBallots,
  initialCachedAtIso,
  activeSection,
  selectedDiscipline,
  currentUser,
  currentUserUid,
  realtimeRetryNonce,
  stateRef,
  adminFullPlayersLoadedRef,
  setState,
  onRequireAuth,
  onPlayersStreamHealthy,
  reportCloudError,
}: UseTotySyncParams) {
  const [totyLastSyncAt, setTotyLastSyncAt] = useState<string | null>(() => initialCachedAtIso);
  const [totyRealtimeActive, setTotyRealtimeActive] = useState(false);
  const [pendingTotyDisciplines, setPendingTotyDisciplines] = useState<DisciplineId[]>([]);
  const persistedTotyBallotsRef = useRef<TotyBallotRecord[]>(initialBallots);
  const pendingTotyQueueRef = useRef<TotyBallotBatchItem[]>([]);
  const pendingTotyTimerRef = useRef<number | null>(null);
  const inFlightTotyDisciplinesRef = useRef<Set<DisciplineId>>(new Set());

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
    [setState]
  );

  // Public TOTY sync on /votaciones
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
          ]).catch(() => undefined);
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

        if (resolvedBallot && !cancelled) {
          const existingIds = new Set(stateRef.current.players.map((p) => p.id));
          const missingIds = Array.from(
            new Set(
              Object.values(resolvedBallot.selections).filter(
                (id) => Boolean(id) && !existingIds.has(id)
              )
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
  }, [
    activeSection,
    selectedDiscipline,
    currentUserUid,
    applyDisciplineTotyToState,
    reportCloudError,
    setState,
    stateRef,
  ]);

  // Admin TOTY + full roster sync on /panel
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

    if (!areAllTotyDisciplinesFresh() || realtimeRetryNonce > 0) {
      fetchAllFirestoreTotyData()
        .then(({ ballots, configs }) => {
          if (cancelled) return;
          persistedTotyBallotsRef.current = ballots;
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

    if (!adminFullPlayersLoadedRef.current) {
      adminFullPlayersLoadedRef.current = true;
      fetchAllPlayersForAdmin()
        .then((allPlayers) => {
          if (cancelled) return;
          setState((prev) => ({
            ...prev,
            players: mergeLazyPlayersPreservingPii(prev.players, allPlayers),
          }));
          onPlayersStreamHealthy();
        })
        .catch((err) => {
          adminFullPlayersLoadedRef.current = false;
          reportCloudError('Cargando padrón completo para panel admin', err, 'players');
        });
    }

    return () => {
      cancelled = true;
    };
  }, [
    activeSection,
    currentUser,
    realtimeRetryNonce,
    adminFullPlayersLoadedRef,
    onPlayersStreamHealthy,
    reportCloudError,
    setState,
    stateRef,
  ]);

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

  const handleSubmitTotyBallot = async (
    disciplineIdOrBatch: DisciplineId | TotyBallotSubmissionInput[],
    selections?: Record<string, string>
  ): Promise<{ committedCount: number; queuedCount: number; skippedCount: number }> => {
    if (!currentUser) {
      onRequireAuth();
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

  return {
    totyLastSyncAt,
    totyRealtimeActive,
    pendingTotyDisciplines,
    pendingTotyQueueRef,
    flushPendingTotyBallots,
    handleSubmitTotyBallot,
    handleSaveTotyConfig,
    handleResetTotyConfig,
    handleSaveTotyDeadline,
    handleMigrateTotyFromFirestore,
    handleImportLocalTotyBackup,
  };
}
