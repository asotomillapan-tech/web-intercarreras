import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeftRight,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Link2,
  Plus,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  hasAnySheetImports,
  type DeletedEntityIds,
  type SheetImportDelta,
  type SheetMergeStats,
} from '../domain/sheetsMergeEngine';
import {
  getGoogleAccessToken,
  initGoogleAuth,
  signInWithGoogleSheets,
  signOutGoogle,
} from '../services/firebaseAuth';
import {
  MASTER_SHEET_GROUPS,
  MASTER_SHEET_GROUP_MAP,
  TEMPLATE_TABS,
  buildTemplateSheetPayloads,
  createMasterGoogleSheetForGroup,
  downloadTemplateCsv,
  extractSpreadsheetId,
  getConfiguredMasterEntries,
  inspectSpreadsheetMetadata,
  pullChangesFromMasterSheet,
  syncMasterSheet,
  syncMultipleMasterSheets,
  type MasterSheetInspection,
  type SheetSyncSummary,
  type TemplateTabName,
} from '../services/googleSheets';
import type {
  MasterSheetKey,
  MasterSheetsConfig,
  TournamentState,
} from '../types/tournament';
import { ConfirmDialog } from './ConfirmDialog';

export interface AutoSyncStatusInfo {
  status: 'idle' | 'syncing' | 'synced' | 'error';
  message?: string;
  lastSyncedAt?: string;
}

interface MasterSheetsPanelProps {
  state: TournamentState;
  pendingSyncKeys: MasterSheetKey[];
  deletedIds?: DeletedEntityIds;
  autoSyncSessionApproved: boolean;
  autoSyncState: AutoSyncStatusInfo;
  onSaveMasterSheets: (
    nextMasterSheets: MasterSheetsConfig,
    nextAutoSyncEnabled?: boolean
  ) => Promise<void>;
  onApproveAutoSyncSession: (approved: boolean) => void;
  onClearPendingSyncKeys: (keys: MasterSheetKey[]) => void;
  onClearDeletedTombstones?: () => void;
  onApplySheetImports: (imports: SheetImportDelta) => Promise<void>;
  onMarkSynced: (spreadsheetId: string) => void;
}

type PendingConfirmAction =
  | { type: 'sync-one'; masterKey: MasterSheetKey; spreadsheetId: string }
  | { type: 'sync-all' }
  | { type: 'create-one'; masterKey: MasterSheetKey }
  | { type: 'enable-autosync' };

function formatMergeStatsLine(stats: SheetMergeStats, mode: 'bidirectional' | 'pull'): string {
  const pulledNew = stats.pulledNewTeams + stats.pulledNewPlayers + stats.pulledNewMatches;
  const pulledUpdated =
    stats.pulledUpdatedTeams +
    stats.pulledUpdatedPlayers +
    stats.pulledUpdatedMatches +
    stats.pulledUpdatedConfigs;
  const parts: string[] = [];
  if (pulledNew > 0) parts.push(`${pulledNew} nuevo(s) importado(s)`);
  if (pulledUpdated > 0) parts.push(`${pulledUpdated} actualizado(s) desde Sheets`);
  if (mode === 'bidirectional' && stats.pushedToSheet > 0) {
    parts.push(`${stats.pushedToSheet} enviado(s) desde web`);
  }
  if (stats.preservedExtraColumns > 0) {
    parts.push(`${stats.preservedExtraColumns} col. extra conservada(s)`);
  }
  if (parts.length === 0) {
    return mode === 'pull'
      ? 'Sin cambios nuevos en Google Sheets.'
      : 'Web y Google Sheets sincronizados.';
  }
  return parts.join(' · ');
}

export function MasterSheetsPanel({
  state,
  pendingSyncKeys,
  deletedIds,
  autoSyncSessionApproved,
  autoSyncState,
  onSaveMasterSheets,
  onApproveAutoSyncSession,
  onClearPendingSyncKeys,
  onClearDeletedTombstones,
  onApplySheetImports,
  onMarkSynced,
}: MasterSheetsPanelProps) {
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(getGoogleAccessToken());
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [draftIds, setDraftIds] = useState<Record<MasterSheetKey, string>>(() => ({
    futbol_hombres: state.masterSheets.futbol_hombres ?? '',
    futbol_mujeres: state.masterSheets.futbol_mujeres ?? '',
    basquet_hombres: state.masterSheets.basquet_hombres ?? '',
    basquet_3x3_mujeres: state.masterSheets.basquet_3x3_mujeres ?? '',
    voley_mujeres: state.masterSheets.voley_mujeres ?? '',
    voley_hombres: state.masterSheets.voley_hombres ?? '',
    consolidado: state.masterSheets.consolidado ?? '',
  }));
  const [savingKey, setSavingKey] = useState<MasterSheetKey | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const [inspections, setInspections] = useState<
    Partial<Record<MasterSheetKey, MasterSheetInspection>>
  >({});
  const [inspectingKey, setInspectingKey] = useState<MasterSheetKey | null>(null);
  const [pullingKey, setPullingKey] = useState<MasterSheetKey | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResults, setSyncResults] = useState<SheetSyncSummary[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<PendingConfirmAction | null>(null);

  const [previewMasterKey, setPreviewMasterKey] = useState<MasterSheetKey>('futbol_hombres');
  const [previewTab, setPreviewTab] = useState<TemplateTabName>('Web_Jugadores');

  useEffect(() => {
    setDraftIds({
      futbol_hombres: state.masterSheets.futbol_hombres ?? '',
      futbol_mujeres: state.masterSheets.futbol_mujeres ?? '',
      basquet_hombres: state.masterSheets.basquet_hombres ?? '',
      basquet_3x3_mujeres: state.masterSheets.basquet_3x3_mujeres ?? '',
      voley_mujeres: state.masterSheets.voley_mujeres ?? '',
      voley_hombres: state.masterSheets.voley_hombres ?? '',
      consolidado: state.masterSheets.consolidado ?? '',
    });
  }, [state.masterSheets]);

  useEffect(() => {
    const unsub = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => unsub();
  }, []);

  const configuredMasters = useMemo(
    () => getConfiguredMasterEntries(state.masterSheets),
    [state.masterSheets]
  );

  const previewPayloads = useMemo(() => {
    const meta = MASTER_SHEET_GROUP_MAP[previewMasterKey];
    return buildTemplateSheetPayloads(state, meta.disciplineIds);
  }, [state, previewMasterKey]);

  const isAutoSyncLive = Boolean(
    state.autoSyncSheetsEnabled && autoSyncSessionApproved && googleToken
  );

  const handleGoogleConnect = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await signInWithGoogleSheets();
      setGoogleUser(res.user);
      setGoogleToken(res.accessToken);
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error ? err.message : 'No se pudo conectar con Google Workspace.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSaveMasterId = async (key: MasterSheetKey) => {
    const cleanId = extractSpreadsheetId(draftIds[key] ?? '');
    setSavingKey(key);
    setSyncError(null);
    setSavedToast(null);
    try {
      const nextConfig: MasterSheetsConfig = { ...state.masterSheets };
      if (cleanId) nextConfig[key] = cleanId;
      else delete nextConfig[key];
      await onSaveMasterSheets(nextConfig);
      setDraftIds((prev) => ({ ...prev, [key]: cleanId }));
      setSavedToast(
        cleanId
          ? `Master "${MASTER_SHEET_GROUP_MAP[key].shortLabel}" vinculado.`
          : `Master "${MASTER_SHEET_GROUP_MAP[key].shortLabel}" desvinculado.`
      );
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : 'No se pudo guardar el ID.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleInspectMaster = async (key: MasterSheetKey, rawId: string) => {
    if (!googleToken) {
      setAuthError('Conecta tu cuenta Google primero.');
      return;
    }
    const cleanId = extractSpreadsheetId(rawId);
    if (!cleanId) return;
    setInspectingKey(key);
    setSyncError(null);
    try {
      const info = await inspectSpreadsheetMetadata(googleToken, cleanId);
      setInspections((prev) => ({ ...prev, [key]: info }));
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : 'Error verificando la planilla.');
    } finally {
      setInspectingKey(null);
    }
  };

  const handlePullFromMaster = async (key: MasterSheetKey, rawId: string) => {
    if (!googleToken) {
      setAuthError('Conecta tu cuenta Google primero.');
      return;
    }
    const cleanId = extractSpreadsheetId(rawId);
    if (!cleanId) return;
    setPullingKey(key);
    setSyncError(null);
    setSavedToast(null);
    try {
      const summary = await pullChangesFromMasterSheet(googleToken, key, cleanId, state);
      if (hasAnySheetImports(summary.imports)) {
        await onApplySheetImports(summary.imports);
      }
      setSyncResults([summary]);
      setSavedToast(
        `Lectura desde ${MASTER_SHEET_GROUP_MAP[key].shortLabel}: ${formatMergeStatsLine(
          summary.mergeStats,
          'pull'
        )}`
      );
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : 'Error leyendo desde Google Sheets.');
    } finally {
      setPullingKey(null);
    }
  };

  const handleDisableAutoSync = async () => {
    setSyncError(null);
    onApproveAutoSyncSession(false);
    try {
      await onSaveMasterSheets(state.masterSheets, false);
      setSavedToast('Auto-sync desactivado.');
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : 'Error guardando preferencia.');
    }
  };

  const applySummaryImports = async (summaries: SheetSyncSummary[]) => {
    for (const s of summaries) {
      if (hasAnySheetImports(s.imports)) {
        await onApplySheetImports(s.imports);
      }
    }
  };

  const executeConfirmedAction = async () => {
    if (!confirmAction) return;
    if (!googleToken) {
      setSyncError('Tu sesión de Google Workspace no tiene token activo. Vuelve a conectar.');
      setConfirmAction(null);
      return;
    }

    setSyncLoading(true);
    setSyncError(null);

    try {
      if (confirmAction.type === 'enable-autosync') {
        await onSaveMasterSheets(state.masterSheets, true);
        onApproveAutoSyncSession(true);
        const { succeeded, failed } = await syncMultipleMasterSheets(
          googleToken,
          state,
          undefined,
          deletedIds
        );
        await applySummaryImports(succeeded);
        setSyncResults(succeeded);
        if (succeeded.length > 0) {
          onMarkSynced(succeeded[0].spreadsheetId);
          onClearPendingSyncKeys(
            succeeded.map((s) => s.masterKey).filter((k): k is MasterSheetKey => Boolean(k))
          );
          onClearDeletedTombstones?.();
        }
        if (failed.length > 0) {
          setSyncError(
            `Error inicial en: ${failed.map((f) => `${f.label} (${f.error})`).join(' | ')}`
          );
        } else {
          setSavedToast(`Auto-sync activado (${succeeded.length} planillas fusionadas).`);
        }
      } else if (confirmAction.type === 'sync-one') {
        const cleanId = extractSpreadsheetId(confirmAction.spreadsheetId);
        if (cleanId && state.masterSheets[confirmAction.masterKey] !== cleanId) {
          await onSaveMasterSheets({ ...state.masterSheets, [confirmAction.masterKey]: cleanId });
        }
        const summary = await syncMasterSheet(
          googleToken,
          confirmAction.masterKey,
          cleanId,
          state,
          undefined,
          deletedIds
        );
        await applySummaryImports([summary]);
        setSyncResults([summary]);
        onMarkSynced(summary.spreadsheetId);
        onClearPendingSyncKeys([confirmAction.masterKey]);
        onClearDeletedTombstones?.();
      } else if (confirmAction.type === 'sync-all') {
        const { succeeded, failed } = await syncMultipleMasterSheets(
          googleToken,
          state,
          undefined,
          deletedIds
        );
        await applySummaryImports(succeeded);
        setSyncResults(succeeded);
        if (succeeded.length > 0) {
          onMarkSynced(succeeded[0].spreadsheetId);
          onClearPendingSyncKeys(
            succeeded.map((s) => s.masterKey).filter((k): k is MasterSheetKey => Boolean(k))
          );
          onClearDeletedTombstones?.();
        }
        if (failed.length > 0) {
          setSyncError(
            `Error en algunas planillas: ${failed.map((f) => `${f.label}: ${f.error}`).join(' | ')}`
          );
        }
      } else if (confirmAction.type === 'create-one') {
        const summary = await createMasterGoogleSheetForGroup(
          googleToken,
          confirmAction.masterKey,
          state
        );
        const nextConfig: MasterSheetsConfig = {
          ...state.masterSheets,
          [confirmAction.masterKey]: summary.spreadsheetId,
        };
        await onSaveMasterSheets(nextConfig);
        setDraftIds((prev) => ({ ...prev, [confirmAction.masterKey]: summary.spreadsheetId }));
        setSyncResults([summary]);
        onMarkSynced(summary.spreadsheetId);
        onClearPendingSyncKeys([confirmAction.masterKey]);
      }
      setConfirmAction(null);
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : 'Error sincronizando con Google Sheets.');
      setConfirmAction(null);
    } finally {
      setSyncLoading(false);
    }
  };

  const dialogProps = useMemo(() => {
    if (!confirmAction) return null;

    if (confirmAction.type === 'enable-autosync') {
      return {
        title: 'Activar sincronización automática (Web ⇄ Sheets)',
        description:
          'Cada cambio en la web se fusionará con Google Sheets leyendo primero tus cambios manuales para no sobrescribir ediciones.',
        details: configuredMasters.map((m) => `${m.meta.shortLabel} → ${m.spreadsheetId}`),
        confirmLabel: 'Activar auto-sync',
      };
    }

    if (confirmAction.type === 'sync-all') {
      return {
        title: `Sincronizar ${configuredMasters.length} planilla(s) Master`,
        description:
          'Se leerán primero las ediciones en Google Sheets, se aplicarán en Firestore y luego se fusionarán las pestañas Web_*.',
        details: configuredMasters.map((m) => `${m.meta.label} · ${m.spreadsheetId}`),
        confirmLabel: 'Sincronizar Web ⇄ Sheets',
      };
    }

    if (confirmAction.type === 'create-one') {
      const meta = MASTER_SHEET_GROUP_MAP[confirmAction.masterKey];
      return {
        title: `Crear nuevo ${meta.label}`,
        description: `Se creará una nueva hoja de cálculo en tu Google Drive para ${meta.label} con las 5 pestañas Web_*.`,
        details: [`Pestañas: ${TEMPLATE_TABS.join(', ')}`],
        confirmLabel: 'Crear Master',
      };
    }

    const meta = MASTER_SHEET_GROUP_MAP[confirmAction.masterKey];
    const cleanId = extractSpreadsheetId(confirmAction.spreadsheetId);
    const payloads = buildTemplateSheetPayloads(state, meta.disciplineIds);
    return {
      title: `Sincronización bidireccional — ${meta.label}`,
      description: `Fusionará las pestañas Web_* de "${cleanId}" respetando filas nuevas y columnas extra.`,
      details: [
        `Equipos: ${payloads.Web_Equipos.length - 1} · Jugadores: ${payloads.Web_Jugadores.length - 1} · Partidos: ${payloads.Web_Partidos.length - 1}`,
      ],
      confirmLabel: 'Fusionar Web ⇄ Sheets',
    };
  }, [confirmAction, configuredMasters, state]);

  return (
    <div className="space-y-6">
      {/* Header & Connection Bar */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#101016] p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#a5b0ff]">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Google Sheets · Sincronización Bidireccional</span>
            </div>
            <h2 className="text-2xl font-medium tracking-[-0.025em] text-white">
              Planillas{' '}
              <span className="font-editorial italic font-normal text-[#c8ceff]">Master</span>
            </h2>
            <p className="text-xs text-zinc-400">
              {configuredMasters.length} de {MASTER_SHEET_GROUPS.length} planillas vinculadas.
              {state.lastSyncedAt && (
                <> · Última sync: {new Date(state.lastSyncedAt).toLocaleString('es-CL')}</>
              )}
            </p>
          </div>

          {!googleToken ? (
            <button
              type="button"
              onClick={handleGoogleConnect}
              disabled={authLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-[#050507] text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              <span>{authLoading ? 'Conectando...' : 'Conectar Google Sheets'}</span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1.5 flex items-center gap-2 text-emerald-200">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{googleUser?.email || 'Google conectado'}</span>
              </div>
              <button
                type="button"
                onClick={() => signOutGoogle()}
                className="text-zinc-400 hover:text-red-300 underline cursor-pointer"
              >
                Desconectar
              </button>
            </div>
          )}
        </div>

        {/* Auto-Sync Action Row */}
        <div className="rounded-2xl bg-[#050507] border border-white/[0.08] p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap
                className={`w-4 h-4 ${isAutoSyncLive ? 'text-emerald-400' : 'text-[#a5b0ff]'}`}
              />
              <span className="text-xs font-medium text-white">
                Auto-Sync:{' '}
                {isAutoSyncLive
                  ? 'Activo'
                  : state.autoSyncSheetsEnabled
                  ? 'Confirmar sesión Google'
                  : 'Desactivado'}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              {autoSyncState.status === 'syncing'
                ? 'Fusionando cambios con Google Sheets...'
                : autoSyncState.message
                ? autoSyncState.message
                : pendingSyncKeys.length > 0
                ? `Pendientes: ${pendingSyncKeys
                    .map((k) => MASTER_SHEET_GROUP_MAP[k].shortLabel)
                    .join(', ')}.`
                : 'Fusiona cambios bidireccionalmente sin sobrescribir ediciones manuales.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAutoSyncLive ? (
              <button
                type="button"
                onClick={handleDisableAutoSync}
                className="px-4 py-2 rounded-full border border-white/[0.12] bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-zinc-200 cursor-pointer"
              >
                Desactivar Auto-Sync
              </button>
            ) : (
              <button
                type="button"
                disabled={!googleToken || configuredMasters.length === 0 || syncLoading}
                onClick={() => setConfirmAction({ type: 'enable-autosync' })}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#707ef9] hover:bg-[#5c6bf0] text-xs font-medium text-white cursor-pointer disabled:opacity-40"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Activar Auto-Sync</span>
              </button>
            )}

            <button
              type="button"
              disabled={!googleToken || configuredMasters.length === 0 || syncLoading}
              onClick={() => setConfirmAction({ type: 'sync-all' })}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium cursor-pointer disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncLoading ? 'animate-spin' : ''}`} />
              <span>Sincronizar todos ({configuredMasters.length})</span>
            </button>
          </div>
        </div>

        {authError && (
          <div
            role="alert"
            className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-200 flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{authError}</span>
          </div>
        )}

        {syncError && (
          <div
            role="alert"
            className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-200 flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{syncError}</span>
          </div>
        )}

        {savedToast && (
          <div
            role="status"
            className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200 flex items-start gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{savedToast}</span>
          </div>
        )}

        {syncResults.length > 0 && (
          <div
            role="status"
            className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2 text-xs text-emerald-200"
          >
            <p className="font-medium text-white">
              {syncResults[0].mode === 'pull'
                ? 'Importación completada'
                : `Sincronización completada (${syncResults.length} planilla${
                    syncResults.length > 1 ? 's' : ''
                  })`}
            </p>
            <ul className="space-y-2">
              {syncResults.map((res) => (
                <li
                  key={`${res.spreadsheetId}-${res.syncedAt}`}
                  className="flex flex-wrap items-center justify-between gap-2 border-t border-emerald-500/20 pt-2 first:border-t-0 first:pt-0"
                >
                  <div>
                    <p className="text-white font-medium">
                      {res.masterLabel || res.spreadsheetTitle || res.spreadsheetId}
                    </p>
                    <p className="text-emerald-200/80">
                      {formatMergeStatsLine(res.mergeStats, res.mode)}
                    </p>
                  </div>
                  <a
                    href={res.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[#c8ceff] hover:text-white underline shrink-0"
                  >
                    <span>Abrir Sheet</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Master Spreadsheets Registry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {MASTER_SHEET_GROUPS.map((group) => {
          const draftVal = draftIds[group.key] ?? '';
          const savedId = state.masterSheets[group.key] ?? '';
          const cleanDraftId = extractSpreadsheetId(draftVal);
          const hasUnsavedEdit = cleanDraftId !== savedId;
          const isPending = pendingSyncKeys.includes(group.key);
          const inspection = inspections[group.key];
          const discTeamsCount = state.teams.filter((t) =>
            group.disciplineIds.includes(t.disciplineId)
          ).length;
          const discPlayersCount = state.players.filter((p) =>
            group.disciplineIds.includes(p.disciplineId)
          ).length;
          const discMatchesCount = state.matches.filter((m) =>
            group.disciplineIds.includes(m.disciplineId)
          ).length;

          return (
            <div
              key={group.key}
              className={`rounded-3xl border p-5 space-y-4 ${
                group.key === 'futbol_hombres'
                  ? 'border-[#707ef9]/35 bg-[#101016]'
                  : 'border-white/[0.08] bg-[#0c0c10]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-medium text-white">{group.label}</h4>
                    {savedId && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        Vinculado
                      </span>
                    )}
                    {isPending && savedId && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        Pendiente
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{group.description}</p>
                  <p className="text-[11px] text-zinc-500 mt-1 tabular-nums">
                    {discTeamsCount} eq. · {discPlayersCount} jug. · {discMatchesCount} part.
                  </p>
                </div>

                {savedId && (
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${savedId}/edit`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[#a5b0ff] hover:text-white shrink-0"
                  >
                    <span>Abrir</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  id={`master-sheet-${group.key}`}
                  type="text"
                  value={draftVal}
                  onChange={(e) =>
                    setDraftIds((prev) => ({ ...prev, [group.key]: e.target.value }))
                  }
                  placeholder="URL o ID de Google Sheets..."
                  aria-label={`ID o URL para ${group.label}`}
                  className="flex-1 min-w-0 rounded-xl bg-[#050507] border border-white/[0.1] px-3 py-2 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#707ef9]"
                />
                <button
                  type="button"
                  disabled={savingKey === group.key || !hasUnsavedEdit}
                  onClick={() => handleSaveMasterId(group.key)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium cursor-pointer disabled:opacity-35 shrink-0"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>{savingKey === group.key ? '...' : 'Guardar'}</span>
                </button>
              </div>

              {inspection && (
                <div className="rounded-xl bg-[#050507] border border-white/[0.08] p-3 text-[11px] space-y-1">
                  <p className="text-white font-medium">
                    Archivo: <span className="text-[#a5b0ff]">{inspection.title}</span>
                  </p>
                  <p className="text-zinc-500">
                    Pestañas ({inspection.existingTabs.length}):{' '}
                    {inspection.existingTabs.join(', ') || 'Sin pestañas'}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {cleanDraftId ? (
                  <>
                    <button
                      type="button"
                      disabled={!googleToken || syncLoading || pullingKey === group.key}
                      onClick={() =>
                        setConfirmAction({
                          type: 'sync-one',
                          masterKey: group.key,
                          spreadsheetId: cleanDraftId,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#707ef9] hover:bg-[#5c6bf0] text-xs font-medium text-white cursor-pointer disabled:opacity-40"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      <span>Sincronizar</span>
                    </button>
                    <button
                      type="button"
                      disabled={!googleToken || syncLoading || pullingKey === group.key}
                      onClick={() => void handlePullFromMaster(group.key, cleanDraftId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-xs text-zinc-200 cursor-pointer disabled:opacity-40"
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                      <span>{pullingKey === group.key ? 'Leyendo...' : 'Traer'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={!googleToken || inspectingKey === group.key}
                      onClick={() => handleInspectMaster(group.key, cleanDraftId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.1] hover:border-white/25 text-xs text-zinc-300 cursor-pointer disabled:opacity-40"
                    >
                      <SearchCheck className="w-3.5 h-3.5 text-[#a5b0ff]" />
                      <span>{inspectingKey === group.key ? '...' : 'Verificar'}</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={!googleToken || syncLoading}
                    onClick={() => setConfirmAction({ type: 'create-one', masterKey: group.key })}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-zinc-200 cursor-pointer disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Crear Master en Drive</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setPreviewMasterKey(group.key)}
                  className={`ml-auto text-xs underline cursor-pointer ${
                    previewMasterKey === group.key
                      ? 'text-[#a5b0ff]'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Vista previa
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Preview & CSV Export */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-medium text-white">
              Vista previa — {MASTER_SHEET_GROUP_MAP[previewMasterKey].label}
            </h3>
            <p className="text-xs text-zinc-500">
              Filas actuales preparadas para pestañas <code className="font-mono">Web_*</code>.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setPreviewTab(tab)}
                className={`px-3 py-1 rounded-full text-xs cursor-pointer transition-colors ${
                  previewTab === tab
                    ? 'bg-white text-[#050507] font-medium'
                    : 'bg-white/[0.04] text-zinc-400 hover:text-white'
                }`}
              >
                {tab} ({previewPayloads[tab].length - 1})
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] overflow-x-auto max-h-[360px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-[#101016] border-b border-white/[0.08]">
              <tr>
                {previewPayloads[previewTab][0].slice(0, 9).map((col, idx) => (
                  <th key={idx} className="py-2.5 px-3 font-medium text-zinc-300 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {previewPayloads[previewTab].length <= 1 ? (
                <tr>
                  <td colSpan={9} className="py-6 px-4 text-center text-zinc-500">
                    Sin registros todavía en {previewTab}.
                  </td>
                </tr>
              ) : (
                previewPayloads[previewTab].slice(1, 13).map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-white/[0.02]">
                    {row.slice(0, 9).map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className="py-2 px-3 text-zinc-400 whitespace-nowrap max-w-[180px] truncate tabular-nums"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pt-3 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">
            CSV offline ({MASTER_SHEET_GROUP_MAP[previewMasterKey].shortLabel}):
          </p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => downloadTemplateCsv(tab, state, previewMasterKey)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-xs text-zinc-200 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#a5b0ff]" />
                <span>{tab}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmAction !== null && dialogProps !== null}
        title={dialogProps?.title ?? ''}
        description={dialogProps?.description ?? ''}
        details={dialogProps?.details}
        confirmLabel={dialogProps?.confirmLabel ?? 'Confirmar'}
        loading={syncLoading}
        onConfirm={executeConfirmedAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
