import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertCircle,
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
  autoSyncSessionApproved: boolean;
  autoSyncState: AutoSyncStatusInfo;
  onSaveMasterSheets: (
    nextMasterSheets: MasterSheetsConfig,
    nextAutoSyncEnabled?: boolean
  ) => Promise<void>;
  onApproveAutoSyncSession: (approved: boolean) => void;
  onClearPendingSyncKeys: (keys: MasterSheetKey[]) => void;
  onMarkSynced: (spreadsheetId: string) => void;
}

type PendingConfirmAction =
  | { type: 'sync-one'; masterKey: MasterSheetKey; spreadsheetId: string }
  | { type: 'sync-all' }
  | { type: 'create-one'; masterKey: MasterSheetKey }
  | { type: 'enable-autosync' };

export function MasterSheetsPanel({
  state,
  pendingSyncKeys,
  autoSyncSessionApproved,
  autoSyncState,
  onSaveMasterSheets,
  onApproveAutoSyncSession,
  onClearPendingSyncKeys,
  onMarkSynced,
}: MasterSheetsPanelProps) {
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(getGoogleAccessToken());
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Editable Master Spreadsheet IDs per discipline group
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

  // Inspection & Sync Feedback
  const [inspections, setInspections] = useState<
    Partial<Record<MasterSheetKey, MasterSheetInspection>>
  >({});
  const [inspectingKey, setInspectingKey] = useState<MasterSheetKey | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResults, setSyncResults] = useState<SheetSyncSummary[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<PendingConfirmAction | null>(null);

  // Live Preview Controls
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
        err instanceof Error
          ? err.message
          : 'No se pudo conectar con Google Workspace. Verifica que las ventanas emergentes estén permitidas.'
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
      if (cleanId) {
        nextConfig[key] = cleanId;
      } else {
        delete nextConfig[key];
      }
      await onSaveMasterSheets(nextConfig);
      setDraftIds((prev) => ({ ...prev, [key]: cleanId }));
      setSavedToast(
        cleanId
          ? `Master "${MASTER_SHEET_GROUP_MAP[key].shortLabel}" vinculado en Firestore (${cleanId}).`
          : `Master "${MASTER_SHEET_GROUP_MAP[key].shortLabel}" desvinculado.`
      );
    } catch (err: unknown) {
      setSyncError(
        err instanceof Error ? err.message : 'No se pudo guardar el ID de planilla en Firestore.'
      );
    } finally {
      setSavingKey(null);
    }
  };

  const handleInspectMaster = async (key: MasterSheetKey, rawId: string) => {
    if (!googleToken) {
      setAuthError('Conecta tu cuenta Google primero para verificar el acceso a esta planilla.');
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

  const handleDisableAutoSync = async () => {
    setSyncError(null);
    onApproveAutoSyncSession(false);
    try {
      await onSaveMasterSheets(state.masterSheets, false);
      setSavedToast('Sincronización automática desactivada. Puedes sincronizar manualmente cuando desees.');
    } catch (err: unknown) {
      setSyncError(
        err instanceof Error ? err.message : 'Error guardando preferencia de auto-sincronización.'
      );
    }
  };

  const executeConfirmedAction = async () => {
    if (!confirmAction) return;
    if (!googleToken) {
      setSyncError('Tu sesión de Google Workspace no tiene token activo. Vuelve a conectar Google.');
      setConfirmAction(null);
      return;
    }

    setSyncLoading(true);
    setSyncError(null);

    try {
      if (confirmAction.type === 'enable-autosync') {
        await onSaveMasterSheets(state.masterSheets, true);
        onApproveAutoSyncSession(true);
        // Perform immediate initial sync of all configured Masters so they start 100% up to date
        const { succeeded, failed } = await syncMultipleMasterSheets(googleToken, state);
        setSyncResults(succeeded);
        if (succeeded.length > 0) {
          onMarkSynced(succeeded[0].spreadsheetId);
          onClearPendingSyncKeys(
            succeeded
              .map((s) => s.masterKey)
              .filter((k): k is MasterSheetKey => Boolean(k))
          );
        }
        if (failed.length > 0) {
          setSyncError(
            `Auto-sync activado, pero falló la sincronización inicial en: ${failed
              .map((f) => `${f.label} (${f.error})`)
              .join(' | ')}`
          );
        } else {
          setSavedToast(
            `Auto-sync activado y ${succeeded.length} planilla(s) Master sincronizada(s) al día.`
          );
        }
      } else if (confirmAction.type === 'sync-one') {
        const cleanId = extractSpreadsheetId(confirmAction.spreadsheetId);
        // Ensure edited ID is also persisted if changed
        if (cleanId && state.masterSheets[confirmAction.masterKey] !== cleanId) {
          await onSaveMasterSheets({ ...state.masterSheets, [confirmAction.masterKey]: cleanId });
        }
        const summary = await syncMasterSheet(
          googleToken,
          confirmAction.masterKey,
          cleanId,
          state
        );
        setSyncResults([summary]);
        onMarkSynced(summary.spreadsheetId);
        onClearPendingSyncKeys([confirmAction.masterKey]);
      } else if (confirmAction.type === 'sync-all') {
        const { succeeded, failed } = await syncMultipleMasterSheets(googleToken, state);
        setSyncResults(succeeded);
        if (succeeded.length > 0) {
          onMarkSynced(succeeded[0].spreadsheetId);
          onClearPendingSyncKeys(
            succeeded
              .map((s) => s.masterKey)
              .filter((k): k is MasterSheetKey => Boolean(k))
          );
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
      setSyncError(
        err instanceof Error ? err.message : 'Error sincronizando con Google Sheets.'
      );
      setConfirmAction(null);
    } finally {
      setSyncLoading(false);
    }
  };

  // Compute ConfirmDialog copy based on pending action
  const dialogProps = useMemo(() => {
    if (!confirmAction) return null;

    if (confirmAction.type === 'enable-autosync') {
      return {
        title: 'Activar sincronización automática con Sheets Master',
        description:
          'Al confirmar, cada vez que inscribas equipos, edites jugadores, cierres partidos, registres transferencias o cambies el formato durante esta sesión, la web actualizará automáticamente las 5 pestañas Web_* en las planillas Master correspondientes (sin tocar tus otras pestañas).',
        details: [
          ...configuredMasters.map(
            (m) => `${m.meta.shortLabel} → ID ${m.spreadsheetId}`
          ),
          `Pestañas gestionadas (no destructivas): ${TEMPLATE_TABS.join(', ')}`,
          'Además se ejecutará una sincronización inicial inmediata ahora mismo.',
        ],
        confirmLabel: 'Confirmar y activar auto-sync',
      };
    }

    if (confirmAction.type === 'sync-all') {
      return {
        title: `Sincronizar ${configuredMasters.length} planilla(s) Master`,
        description:
          'Se actualizarán las 5 pestañas gestionadas (Web_Equipos, Web_Jugadores, Web_Partidos, Web_Transferencias y Web_Formato) en cada Master configurado, filtrando automáticamente los datos de su disciplina. Tus pestañas propias no se modificarán.',
        details: configuredMasters.map(
          (m) => `${m.meta.label} · ID ${m.spreadsheetId}`
        ),
        confirmLabel: 'Sincronizar todos los Masters',
      };
    }

    if (confirmAction.type === 'create-one') {
      const meta = MASTER_SHEET_GROUP_MAP[confirmAction.masterKey];
      return {
        title: `Crear nuevo ${meta.label}`,
        description: `Se creará una nueva hoja de cálculo en tu cuenta Google para ${meta.label}, se vinculará automáticamente en Firestore y se llenarán sus 5 pestañas Web_*.`,
        details: [
          `Disciplinas incluidas: ${meta.disciplineIds.length}`,
          `Pestañas: ${TEMPLATE_TABS.join(', ')}`,
        ],
        confirmLabel: 'Crear y vincular Master',
      };
    }

    // sync-one
    const meta = MASTER_SHEET_GROUP_MAP[confirmAction.masterKey];
    const cleanId = extractSpreadsheetId(confirmAction.spreadsheetId);
    const payloads = buildTemplateSheetPayloads(state, meta.disciplineIds);
    return {
      title: `Sincronizar ${meta.label}`,
      description: `Se actualizarán únicamente las 5 pestañas gestionadas (Web_*) dentro de la hoja ID "${cleanId}" con los datos actuales de ${meta.shortLabel}. Cualquier otra pestaña propia del archivo permanecerá intacta.`,
      details: [
        `Web_Equipos: ${payloads.Web_Equipos.length - 1} equipo(s)`,
        `Web_Jugadores (12 campos UFRO): ${payloads.Web_Jugadores.length - 1} jugador(es)`,
        `Web_Partidos: ${payloads.Web_Partidos.length - 1} partido(s)`,
        `Web_Transferencias: ${payloads.Web_Transferencias.length - 1} transferencia(s)`,
        `Web_Formato: ${payloads.Web_Formato.length - 1} disciplina(s)`,
      ],
      confirmLabel: 'Sincronizar ahora',
    };
  }, [confirmAction, configuredMasters, state]);

  return (
    <div className="space-y-8">
      {/* How It Works Architecture Strip */}
      <div className="bg-[#f5f6f8] border border-neutral-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileSpreadsheet className="w-4 h-4 text-[#707ef9]" />
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-[#0d0d0d]">
            Cómo funciona la sincronización con tus Google Sheets Master
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-neutral-700 leading-relaxed">
          <div className="bg-white border border-neutral-200 p-3.5">
            <p className="font-bold text-[#0d0d0d] uppercase tracking-wider mb-1">
              1. Base en tiempo real + Respaldo Master
            </p>
            <p>
              Todo lo que ocurre en la web se guarda al instante en <strong>Firestore</strong>.
              Luego, cada disciplina se vincula a su propio <strong>Google Sheet Master</strong>{' '}
              (Fútbol 7 Hombres ya viene enlazado a tu planilla oficial).
            </p>
          </div>
          <div className="bg-white border border-neutral-200 p-3.5">
            <p className="font-bold text-[#0d0d0d] uppercase tracking-wider mb-1">
              2. Pestañas seguras (<code className="font-mono">Web_*</code>)
            </p>
            <p>
              La sincronización escribe solo en 5 pestañas propias (
              <code className="font-mono">Web_Equipos</code>,{' '}
              <code className="font-mono">Web_Jugadores</code>,{' '}
              <code className="font-mono">Web_Partidos</code>,{' '}
              <code className="font-mono">Web_Transferencias</code> y{' '}
              <code className="font-mono">Web_Formato</code>). Tus pestañas y fórmulas previas no se
              borran.
            </p>
          </div>
          <div className="bg-white border border-neutral-200 p-3.5">
            <p className="font-bold text-[#0d0d0d] uppercase tracking-wider mb-1">
              3. Modo Auto-Sync en sesión de Admin
            </p>
            <p>
              Conecta Google y activa <strong>Auto-Sync</strong>: cada inscripción, ficha, marcador
              finalizado o transferencia actualizará automáticamente el Master de esa disciplina
              en segundos.
            </p>
          </div>
        </div>
      </div>

      {/* Connection + Auto-Sync Control Bar */}
      <div className="border border-neutral-200 p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4">
          <div>
            <h3 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
              Conexión Google Workspace y Auto-Sync
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              {configuredMasters.length} de {MASTER_SHEET_GROUPS.length} planillas Master vinculadas
              en Firestore.
              {state.lastSyncedAt && (
                <> · Última escritura: {new Date(state.lastSyncedAt).toLocaleString('es-CL')}</>
              )}
            </p>
          </div>

          {!googleToken ? (
            <button
              type="button"
              onClick={handleGoogleConnect}
              disabled={authLoading}
              className="gsi-material-button"
            >
              <div className="gsi-material-button-icon">
                <svg viewBox="0 0 48 48" style={{ display: 'block' }}>
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
              </div>
              <span>{authLoading ? 'Conectando...' : 'Conectar Google Sheets'}</span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="bg-[#f5f6f8] border border-neutral-200 px-3 py-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium text-[#0d0d0d]">
                  {googleUser?.email || 'Cuenta Google conectada'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => signOutGoogle()}
                className="text-neutral-600 hover:text-red-600 underline cursor-pointer"
              >
                Desconectar
              </button>
            </div>
          )}
        </div>

        {/* Auto-Sync Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0d0d0d] text-white p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap
                className={`w-4 h-4 ${isAutoSyncLive ? 'text-emerald-400' : 'text-[#707ef9]'}`}
              />
              <span className="font-display text-sm font-bold uppercase tracking-wider">
                Sincronización Automática con Masters:{' '}
                {isAutoSyncLive
                  ? 'ACTIVA EN ESTA SESIÓN'
                  : state.autoSyncSheetsEnabled
                  ? 'REQUIERE CONFIRMAR SESIÓN GOOGLE'
                  : 'DESACTIVADA'}
              </span>
            </div>
            <p className="text-xs text-white/75">
              {autoSyncState.status === 'syncing'
                ? 'Sincronizando cambios automáticamente con Google Sheets...'
                : autoSyncState.message
                ? autoSyncState.message
                : pendingSyncKeys.length > 0
                ? `Tienes cambios pendientes en: ${pendingSyncKeys
                    .map((k) => MASTER_SHEET_GROUP_MAP[k].shortLabel)
                    .join(', ')}.`
                : 'Al activarla, cada cambio en equipos, jugadores, partidos, transferencias o formato se enviará solo al Master correspondiente.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isAutoSyncLive ? (
              <button
                type="button"
                onClick={handleDisableAutoSync}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-display font-bold uppercase tracking-widest text-xs cursor-pointer"
              >
                Desactivar Auto-Sync
              </button>
            ) : (
              <button
                type="button"
                disabled={!googleToken || configuredMasters.length === 0 || syncLoading}
                onClick={() => setConfirmAction({ type: 'enable-autosync' })}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-xs cursor-pointer disabled:opacity-45"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Activar Auto-Sync</span>
              </button>
            )}

            <button
              type="button"
              disabled={!googleToken || configuredMasters.length === 0 || syncLoading}
              onClick={() => setConfirmAction({ type: 'sync-all' })}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-[#0d0d0d] hover:bg-neutral-200 font-display font-bold uppercase tracking-widest text-xs cursor-pointer disabled:opacity-45"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncLoading ? 'animate-spin' : ''}`} />
              <span>Sincronizar todos ({configuredMasters.length})</span>
            </button>
          </div>
        </div>

        {/* Alerts & Sync Results */}
        {authError && (
          <div role="alert" className="bg-red-50 border border-red-300 p-3.5 text-xs text-red-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{authError}</span>
          </div>
        )}

        {syncError && (
          <div role="alert" className="bg-red-50 border border-red-300 p-3.5 text-xs text-red-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{syncError}</span>
          </div>
        )}

        {savedToast && (
          <div role="status" className="bg-emerald-50 border border-emerald-300 p-3.5 text-xs text-emerald-950 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{savedToast}</span>
          </div>
        )}

        {syncResults.length > 0 && (
          <div role="status" className="bg-emerald-50 border border-emerald-300 p-4 space-y-2 text-xs text-emerald-950">
            <p className="font-bold uppercase tracking-wider">
              Sincronización completada ({syncResults.length} planilla{syncResults.length > 1 ? 's' : ''})
            </p>
            <ul className="space-y-1.5">
              {syncResults.map((res) => (
                <li key={`${res.spreadsheetId}-${res.syncedAt}`} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>{res.masterLabel || res.spreadsheetTitle || res.spreadsheetId}</strong>:{' '}
                    {res.totalRowsWritten} filas escritas en {res.tabsUpdated.join(', ')}.
                  </span>
                  <a
                    href={res.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-[#707ef9] underline"
                  >
                    <span>Abrir en Google Sheets</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Master Spreadsheets Registry by Discipline Group */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="font-display text-xl font-bold uppercase tracking-wide text-[#0d0d0d]">
              Planillas Master por Disciplina
            </h3>
            <p className="text-xs text-neutral-500">
              Pega el enlace completo o el ID de cada Google Sheet Master y guarda para compartirlo
              con todos los administradores vía Firestore.
            </p>
          </div>
        </div>

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
                className={`border p-5 space-y-4 ${
                  group.key === 'futbol_hombres'
                    ? 'border-[#707ef9] bg-[#f8f9ff]'
                    : 'border-neutral-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-display text-base font-bold uppercase tracking-wide text-[#0d0d0d]">
                        {group.label}
                      </h4>
                      {savedId && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-100 text-emerald-800">
                          Vinculado
                        </span>
                      )}
                      {isPending && savedId && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-amber-100 text-amber-900">
                          Cambios pendientes
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-600 mt-0.5">{group.description}</p>
                    <p className="text-[11px] text-neutral-500 mt-1 tabular-nums">
                      {discTeamsCount} equipos · {discPlayersCount} jugadores · {discMatchesCount}{' '}
                      partidos
                    </p>
                  </div>

                  {savedId && (
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${savedId}/edit`}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir en Google Sheets"
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#707ef9] hover:underline shrink-0"
                    >
                      <span>Abrir</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* ID / URL Input */}
                <div className="space-y-1.5">
                  <label
                    htmlFor={`master-sheet-${group.key}`}
                    className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600"
                  >
                    ID o URL de Google Sheets Master
                  </label>
                  <div className="flex gap-2">
                    <input
                      id={`master-sheet-${group.key}`}
                      type="text"
                      value={draftVal}
                      onChange={(e) =>
                        setDraftIds((prev) => ({ ...prev, [group.key]: e.target.value }))
                      }
                      placeholder="Pega la URL de Google Sheets o su ID..."
                      className="flex-1 min-w-0 bg-white border border-neutral-300 px-3 py-2 text-xs font-mono"
                    />
                    <button
                      type="button"
                      disabled={savingKey === group.key || !hasUnsavedEdit}
                      onClick={() => handleSaveMasterId(group.key)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#0d0d0d] hover:bg-neutral-800 text-white font-display font-bold uppercase tracking-wider text-[11px] cursor-pointer disabled:opacity-40 shrink-0"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>{savingKey === group.key ? 'Guardando...' : 'Guardar ID'}</span>
                    </button>
                  </div>
                </div>

                {/* Inspection Output */}
                {inspection && (
                  <div className="bg-white border border-neutral-200 p-3 text-[11px] space-y-1">
                    <p className="font-bold text-[#0d0d0d]">
                      Archivo detectado: <span className="text-[#707ef9]">{inspection.title}</span>
                    </p>
                    <p className="text-neutral-600">
                      Pestañas actuales ({inspection.existingTabs.length}):{' '}
                      {inspection.existingTabs.join(', ') || 'Sin pestañas'}
                    </p>
                  </div>
                )}

                {/* Per-Master Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {cleanDraftId ? (
                    <>
                      <button
                        type="button"
                        disabled={!googleToken || syncLoading}
                        onClick={() =>
                          setConfirmAction({
                            type: 'sync-one',
                            masterKey: group.key,
                            spreadsheetId: cleanDraftId,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-wider text-[11px] cursor-pointer disabled:opacity-45"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Sincronizar este Master</span>
                      </button>
                      <button
                        type="button"
                        disabled={!googleToken || inspectingKey === group.key}
                        onClick={() => handleInspectMaster(group.key, cleanDraftId)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-neutral-300 hover:bg-neutral-100 text-[#0d0d0d] font-medium text-xs cursor-pointer disabled:opacity-45"
                      >
                        <SearchCheck className="w-3.5 h-3.5 text-[#707ef9]" />
                        <span>
                          {inspectingKey === group.key ? 'Verificando...' : 'Verificar acceso'}
                        </span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={!googleToken || syncLoading}
                      onClick={() =>
                        setConfirmAction({ type: 'create-one', masterKey: group.key })
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0d0d0d] hover:bg-neutral-800 text-white font-display font-bold uppercase tracking-wider text-[11px] cursor-pointer disabled:opacity-45"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Crear Master nuevo en mi Drive</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setPreviewMasterKey(group.key)}
                    className={`ml-auto text-xs underline cursor-pointer ${
                      previewMasterKey === group.key
                        ? 'font-bold text-[#707ef9]'
                        : 'text-neutral-500 hover:text-[#0d0d0d]'
                    }`}
                  >
                    Ver vista previa
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filtered Live Preview & Offline CSV Export */}
      <div className="border border-neutral-200 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold uppercase tracking-wide text-[#0d0d0d]">
              Vista previa de datos — {MASTER_SHEET_GROUP_MAP[previewMasterKey].label}
            </h3>
            <p className="text-xs text-neutral-500">
              Filas exactas que se escribirán en las pestañas <code className="font-mono">Web_*</code>{' '}
              de este Master.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setPreviewTab(tab)}
                className={`px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                  previewTab === tab
                    ? 'bg-[#0d0d0d] text-white'
                    : 'bg-[#f5f6f8] text-neutral-600 hover:text-[#0d0d0d]'
                }`}
              >
                {tab} ({previewPayloads[tab].length - 1})
              </button>
            ))}
          </div>
        </div>

        <div className="border border-neutral-200 overflow-x-auto max-h-[380px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-[#f5f6f8] border-b border-neutral-200">
              <tr>
                {previewPayloads[previewTab][0].slice(0, 9).map((col, idx) => (
                  <th
                    key={idx}
                    className="py-2.5 px-3 font-bold text-[#0d0d0d] whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {previewPayloads[previewTab].length <= 1 ? (
                <tr>
                  <td colSpan={9} className="py-6 px-4 text-center text-neutral-500">
                    Sin registros todavía en {previewTab} para{' '}
                    {MASTER_SHEET_GROUP_MAP[previewMasterKey].shortLabel}. Al inscribir equipos o
                    registrar encuentros aparecerán aquí automáticamente.
                  </td>
                </tr>
              ) : (
                previewPayloads[previewTab].slice(1, 13).map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-[#f9fafb]">
                    {row.slice(0, 9).map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className="py-2 px-3 text-neutral-700 whitespace-nowrap max-w-[180px] truncate tabular-nums"
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

        {/* Offline CSV Downloads for Selected Master */}
        <div className="pt-3 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-neutral-500">
            Descarga CSV manual ({MASTER_SHEET_GROUP_MAP[previewMasterKey].shortLabel}):
          </p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => downloadTemplateCsv(tab, state, previewMasterKey)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#f5f6f8] hover:bg-neutral-200 text-xs font-medium text-[#0d0d0d] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#707ef9]" />
                <span>{tab}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mandatory User Confirmation Dialog for all Google Sheets Write Operations */}
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
