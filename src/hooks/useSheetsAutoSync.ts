import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { AutoSyncStatusInfo } from '../components/MasterSheetsPanel';
import { canManageFormatAndSheets } from '../domain/rbacEngine';
import {
  hasAnySheetImports,
  type DeletedEntityIds,
  type SheetImportDelta,
} from '../domain/sheetsMergeEngine';
import { getGoogleAccessToken } from '../services/firebaseAuth';
import {
  saveFirestoreDisciplineConfig,
  saveFirestoreMatch,
  saveFirestorePlayer,
  saveFirestoreSettings,
  saveFirestoreTeam,
} from '../services/firestoreService';
import type {
  AppUserProfile,
  DisciplineId,
  MasterSheetKey,
  MasterSheetsConfig,
  TournamentState,
} from '../types/tournament';

function resolveMasterKeyForDiscipline(disciplineId: DisciplineId): MasterSheetKey {
  if (disciplineId.startsWith('f7-h')) return 'futbol_hombres';
  if (disciplineId === 'f7-m') return 'futbol_mujeres';
  if (disciplineId === 'basquet-h') return 'basquet_hombres';
  if (disciplineId === 'basquet-3x3-m') return 'basquet_3x3_mujeres';
  if (disciplineId === 'voley-m') return 'voley_mujeres';
  return 'voley_hombres';
}

interface UseSheetsAutoSyncParams {
  state: TournamentState;
  setState: Dispatch<SetStateAction<TournamentState>>;
  stateRef: MutableRefObject<TournamentState>;
  currentUser: AppUserProfile | null;
  reportCloudError: (context: string, err: unknown, streamKey?: string) => void;
}

export function useSheetsAutoSync({
  state,
  setState,
  stateRef,
  currentUser,
  reportCloudError,
}: UseSheetsAutoSyncParams) {
  const [autoSyncSessionApproved, setAutoSyncSessionApproved] = useState(false);
  const [pendingSyncKeys, setPendingSyncKeys] = useState<MasterSheetKey[]>([]);
  const [deletedTombstones, setDeletedTombstones] = useState<DeletedEntityIds>({
    teamIds: [],
    playerIds: [],
    matchIds: [],
  });
  const [autoSyncState, setAutoSyncState] = useState<AutoSyncStatusInfo>({ status: 'idle' });
  const deletedTombstonesRef = useRef(deletedTombstones);

  useEffect(() => {
    deletedTombstonesRef.current = deletedTombstones;
  }, [deletedTombstones]);

  const queueMasterSyncForDiscipline = useCallback(
    (disciplineId: DisciplineId) => {
      const primaryKey = resolveMasterKeyForDiscipline(disciplineId);
      setPendingSyncKeys((prev) => {
        const next = new Set<MasterSheetKey>(prev);
        next.add(primaryKey);
        if (stateRef.current.masterSheets.consolidado) {
          next.add('consolidado');
        }
        return Array.from(next);
      });
    },
    [stateRef]
  );

  const handleClearDeletedTombstones = useCallback(() => {
    setDeletedTombstones({ teamIds: [], playerIds: [], matchIds: [] });
  }, []);

  const handleApplySheetImports = useCallback(
    async (imports: SheetImportDelta) => {
      if (!currentUser || !hasAnySheetImports(imports)) return;

      setState((prev) => {
        const teamMap = new Map(prev.teams.map((t) => [t.id, t]));
        imports.teamsToCreate.forEach((t) =>
          teamMap.set(t.id, { ...t, createdByUid: currentUser.uid })
        );
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
        reportCloudError(
          'Error aplicando cambios importados desde Google Sheets a la base de datos',
          err
        );
      }
    },
    [currentUser, reportCloudError, setState]
  );

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
        message:
          'Reconecta Google Workspace en Panel → Google Sheets para aplicar los cambios pendientes.',
      });
      return;
    }

    const keysSnapshot = [...pendingSyncKeys];
    const timer = window.setTimeout(async () => {
      try {
        const { MASTER_SHEET_GROUP_MAP, syncMultipleMasterSheets } = await import(
          '../services/googleSheets'
        );
        setAutoSyncState({
          status: 'syncing',
          message: `Fusionando bidireccionalmente: ${keysSnapshot
            .map((k) => MASTER_SHEET_GROUP_MAP[k].shortLabel)
            .join(', ')}...`,
        });
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
    currentUser,
    handleApplySheetImports,
    handleClearDeletedTombstones,
    setState,
    stateRef,
  ]);

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

  return {
    autoSyncSessionApproved,
    setAutoSyncSessionApproved,
    pendingSyncKeys,
    deletedTombstones,
    setDeletedTombstones,
    autoSyncState,
    queueMasterSyncForDiscipline,
    handleClearDeletedTombstones,
    handleApplySheetImports,
    handleSaveMasterSheets,
    handleClearPendingSyncKeys,
    handleMarkSynced,
  };
}
