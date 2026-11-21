import {
  buildStandardSheetPayloads,
  columnNumberToA1,
  MANAGED_SHEET_TABS,
  mergeTournamentWithSheets,
  type DeletedEntityIds,
  type ManagedSheetTabName,
  type SheetImportDelta,
  type SheetMergeStats,
  type SheetTabRows,
} from '../domain/sheetsMergeEngine';
import type {
  DisciplineId,
  MasterSheetKey,
  MasterSheetsConfig,
  TournamentState,
} from '../types/tournament';

export interface SheetSyncSummary {
  masterKey?: MasterSheetKey;
  masterLabel?: string;
  spreadsheetId: string;
  spreadsheetTitle?: string;
  spreadsheetUrl: string;
  tabsUpdated: string[];
  totalRowsWritten: number;
  syncedAt: string;
  mode: 'bidirectional' | 'pull';
  imports: SheetImportDelta;
  mergeStats: SheetMergeStats;
}

export interface MasterSheetInspection {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  existingTabs: string[];
}

export interface MasterSheetGroupMeta {
  key: MasterSheetKey;
  label: string;
  shortLabel: string;
  description: string;
  disciplineIds: DisciplineId[];
}

export const MASTER_SHEET_GROUPS: MasterSheetGroupMeta[] = [
  {
    key: 'futbol_hombres',
    label: 'Master Fútbol 7 Hombres (1ª, 2ª y 3ª Div.)',
    shortLabel: 'Fútbol 7 Hombres',
    description:
      'Planilla maestra oficial de las tres divisiones de Fútbol 7 Varones (1ª, 2ª y 3ª División).',
    disciplineIds: ['f7-h-1', 'f7-h-2', 'f7-h-3'],
  },
  {
    key: 'futbol_mujeres',
    label: 'Master Fútbol 7 Mujeres',
    shortLabel: 'Fútbol 7 Mujeres',
    description: 'Planilla maestra oficial de Fútbol 7 Damas.',
    disciplineIds: ['f7-m'],
  },
  {
    key: 'basquet_hombres',
    label: 'Master Básquetbol Hombres',
    shortLabel: 'Básquetbol Hombres',
    description: 'Planilla maestra oficial de Básquetbol 5x5 Varones.',
    disciplineIds: ['basquet-h'],
  },
  {
    key: 'basquet_3x3_mujeres',
    label: 'Master Básquetbol 3x3 Mujeres',
    shortLabel: 'Básquet 3x3 Mujeres',
    description: 'Planilla maestra oficial de Básquetbol 3x3 Damas.',
    disciplineIds: ['basquet-3x3-m'],
  },
  {
    key: 'voley_mujeres',
    label: 'Master Voleibol Mujeres',
    shortLabel: 'Voleibol Mujeres',
    description: 'Planilla maestra oficial de Voleibol Damas.',
    disciplineIds: ['voley-m'],
  },
  {
    key: 'voley_hombres',
    label: 'Master Voleibol Hombres',
    shortLabel: 'Voleibol Hombres',
    description: 'Planilla maestra oficial de Voleibol Varones.',
    disciplineIds: ['voley-h'],
  },
  {
    key: 'consolidado',
    label: 'Master General Consolidado (Opcional)',
    shortLabel: 'General (Todas)',
    description: 'Respaldo único que reúne las 8 disciplinas del campeonato en un solo libro.',
    disciplineIds: [
      'f7-h-1',
      'f7-h-2',
      'f7-h-3',
      'f7-m',
      'basquet-h',
      'basquet-3x3-m',
      'voley-m',
      'voley-h',
    ],
  },
];

export const MASTER_SHEET_GROUP_MAP: Record<MasterSheetKey, MasterSheetGroupMeta> =
  Object.fromEntries(MASTER_SHEET_GROUPS.map((g) => [g.key, g])) as Record<
    MasterSheetKey,
    MasterSheetGroupMeta
  >;

export const TEMPLATE_TABS = MANAGED_SHEET_TABS;
export type TemplateTabName = ManagedSheetTabName;

// ---------------------------------------------------------------------------
// Per-Spreadsheet 3-Way Sync Baseline Storage (localStorage)
// ---------------------------------------------------------------------------

const BASELINE_STORAGE_PREFIX = 'ufro_sheets_sync_baseline_v1_';

function loadSyncBaseline(spreadsheetId: string): Partial<SheetTabRows> | undefined {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return undefined;
    const raw = window.localStorage.getItem(`${BASELINE_STORAGE_PREFIX}${spreadsheetId}`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<SheetTabRows>;
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function saveSyncBaseline(spreadsheetId: string, mergedTabs: SheetTabRows): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(
      `${BASELINE_STORAGE_PREFIX}${spreadsheetId}`,
      JSON.stringify(mergedTabs)
    );
  } catch {
    // Non-fatal if storage quota is full
  }
}

/**
 * Extracts a clean Google Spreadsheet ID whether the user pastes a full URL or a bare ID.
 */
export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{15,120})/);
  if (urlMatch?.[1]) return urlMatch[1];
  const idMatch = trimmed.match(/^[a-zA-Z0-9_-]{15,120}$/);
  return idMatch ? trimmed : trimmed;
}

export function getMasterKeyForDiscipline(disciplineId: DisciplineId): MasterSheetKey {
  if (disciplineId === 'f7-h-1' || disciplineId === 'f7-h-2' || disciplineId === 'f7-h-3') {
    return 'futbol_hombres';
  }
  if (disciplineId === 'f7-m') return 'futbol_mujeres';
  if (disciplineId === 'basquet-h') return 'basquet_hombres';
  if (disciplineId === 'basquet-3x3-m') return 'basquet_3x3_mujeres';
  if (disciplineId === 'voley-m') return 'voley_mujeres';
  return 'voley_hombres';
}

export function getConfiguredMasterEntries(
  masterSheets: MasterSheetsConfig | undefined
): Array<{ key: MasterSheetKey; meta: MasterSheetGroupMeta; spreadsheetId: string }> {
  if (!masterSheets) return [];
  const entries: Array<{ key: MasterSheetKey; meta: MasterSheetGroupMeta; spreadsheetId: string }> =
    [];
  for (const meta of MASTER_SHEET_GROUPS) {
    const id = extractSpreadsheetId(masterSheets[meta.key] ?? '');
    if (id) {
      entries.push({ key: meta.key, meta, spreadsheetId: id });
    }
  }
  return entries;
}

export function buildTemplateSheetPayloads(
  state: TournamentState,
  disciplineFilter?: DisciplineId[]
): Record<TemplateTabName, string[][]> {
  return buildStandardSheetPayloads(state, disciplineFilter);
}

/**
 * Read-only metadata inspection to verify access and display the real title & existing tabs
 * of a Google Spreadsheet Master before writing.
 */
export async function inspectSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<MasterSheetInspection> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  if (!cleanId) {
    throw new Error('Ingresa un ID o enlace válido de Google Sheets.');
  }
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cleanId)}?fields=spreadsheetUrl,properties.title,sheets.properties.title`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    if (res.status === 403 || res.status === 404) {
      throw new Error(
        `No tienes acceso a la planilla (${res.status}). Verifica que el ID sea correcto y que tu cuenta Google tenga permisos de edición sobre ese archivo.`
      );
    }
    const errText = await res.text();
    throw new Error(`Error consultando Google Sheets (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    spreadsheetUrl?: string;
    properties?: { title?: string };
    sheets?: Array<{ properties?: { title?: string } }>;
  };

  return {
    spreadsheetId: cleanId,
    title: data.properties?.title || 'Planilla sin título',
    spreadsheetUrl:
      data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${cleanId}/edit`,
    existingTabs: (data.sheets ?? [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => Boolean(t)),
  };
}

/**
 * Reads all existing managed Web_* tabs from Google Sheets (columns A:ZZ)
 * so manual edits, Sheet-added rows, and extra user columns are NEVER overwritten.
 */
async function readManagedTabsFromSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  existingTitles: Set<string>
): Promise<Partial<SheetTabRows>> {
  const presentTabs = TEMPLATE_TABS.filter((tab) => existingTitles.has(tab));
  if (presentTabs.length === 0) {
    return {};
  }

  const params = new URLSearchParams();
  presentTabs.forEach((tab) => {
    params.append('ranges', `'${tab}'!A:ZZ`);
  });
  params.set('valueRenderOption', 'FORMATTED_VALUE');

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error leyendo datos actuales de Google Sheets (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    valueRanges?: Array<{ range?: string; values?: string[][] }>;
  };

  const tabRows: Partial<SheetTabRows> = {};
  (data.valueRanges ?? []).forEach((vr, index) => {
    const tabName = presentTabs[index];
    if (tabName) {
      tabRows[tabName] = Array.isArray(vr.values)
        ? vr.values.map((row) => row.map((cell) => String(cell ?? '')))
        : [];
    }
  });

  return tabRows;
}

/**
 * Creates a brand-new Master Google Sheet for a specific discipline group (or consolidated)
 * and immediately writes its managed Web_* tabs.
 */
export async function createMasterGoogleSheetForGroup(
  accessToken: string,
  masterKey: MasterSheetKey,
  state: TournamentState
): Promise<SheetSyncSummary> {
  const meta = MASTER_SHEET_GROUP_MAP[masterKey];
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: `Campeonato Intercarreras UFRO ${state.temporada} — ${meta.label}`,
        locale: 'es_CL',
      },
      sheets: TEMPLATE_TABS.map((title) => ({ properties: { title } })),
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Error al crear Google Sheet (${createRes.status}): ${errText}`);
  }

  const created = (await createRes.json()) as { spreadsheetId: string; spreadsheetUrl: string };
  return syncMasterSheet(
    accessToken,
    masterKey,
    created.spreadsheetId,
    state,
    created.spreadsheetUrl
  );
}

export async function createMasterGoogleSheet(
  accessToken: string,
  state: TournamentState
): Promise<SheetSyncSummary> {
  return createMasterGoogleSheetForGroup(accessToken, 'consolidado', state);
}

/**
 * Read-Only Pull from Google Sheets -> Web/Firestore.
 * Reads existing Web_* tabs and computes new/updated entities edited in Google Sheets
 * WITHOUT modifying a single cell in Google Sheets.
 */
export async function pullChangesFromMasterSheet(
  accessToken: string,
  masterKey: MasterSheetKey,
  spreadsheetId: string,
  state: TournamentState
): Promise<SheetSyncSummary> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const metaGroup = MASTER_SHEET_GROUP_MAP[masterKey];
  const info = await inspectSpreadsheetMetadata(accessToken, cleanId);
  const existingTitles = new Set(info.existingTabs);

  const sheetTabs = await readManagedTabsFromSpreadsheet(accessToken, cleanId, existingTitles);
  const baselineTabs = loadSyncBaseline(cleanId);

  const merged = mergeTournamentWithSheets({
    webState: state,
    sheetTabs,
    baselineTabs,
    disciplineFilter: metaGroup.disciplineIds,
  });

  // Update baseline to reflect the merged snapshot after pull
  saveSyncBaseline(cleanId, merged.mergedTabs);

  return {
    masterKey,
    masterLabel: metaGroup.label,
    spreadsheetId: cleanId,
    spreadsheetTitle: info.title,
    spreadsheetUrl: info.spreadsheetUrl,
    tabsUpdated: TEMPLATE_TABS.filter((t) => existingTitles.has(t)),
    totalRowsWritten: 0,
    syncedAt: new Date().toISOString(),
    mode: 'pull',
    imports: merged.imports,
    mergeStats: merged.stats,
  };
}

/**
 * Bidirectional Non-Destructive Synchronization for a Master Sheet:
 * 1. Reads current Web_* rows from Google Sheets BEFORE any write.
 * 2. Performs a 3-way field merge preserving all edits made in Google Sheets,
 *    rows added directly in Google Sheets, and any extra custom user columns.
 * 3. Writes the merged table back to Sheets (clearing ONLY trailing excess rows
 *    strictly below the merged row count, never wiping the whole tab).
 * 4. Returns all Sheet-side changes (`imports`) so the app immediately persists them to Firestore.
 */
export async function syncMasterSheet(
  accessToken: string,
  masterKey: MasterSheetKey,
  spreadsheetId: string,
  state: TournamentState,
  knownUrl?: string,
  deletedIds?: DeletedEntityIds
): Promise<SheetSyncSummary> {
  const meta = MASTER_SHEET_GROUP_MAP[masterKey];
  return syncStateToExistingSpreadsheet(accessToken, spreadsheetId, state, {
    knownUrl,
    masterKey,
    masterLabel: meta.label,
    disciplineFilter: meta.disciplineIds,
    deletedIds,
  });
}

export async function syncStateToExistingSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  state: TournamentState,
  options?: {
    knownUrl?: string;
    masterKey?: MasterSheetKey;
    masterLabel?: string;
    disciplineFilter?: DisciplineId[];
    deletedIds?: DeletedEntityIds;
  }
): Promise<SheetSyncSummary> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cleanId)}?fields=spreadsheetUrl,properties.title,sheets.properties.title`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!metaRes.ok) {
    if (metaRes.status === 403 || metaRes.status === 404) {
      throw new Error(
        `No se pudo acceder a la planilla (${metaRes.status}). Asegúrate de que tu cuenta Google tenga permiso de Editor en el documento ${cleanId}.`
      );
    }
    const errText = await metaRes.text();
    throw new Error(`No se pudo acceder a la planilla (${metaRes.status}): ${errText}`);
  }

  const meta = (await metaRes.json()) as {
    spreadsheetUrl?: string;
    properties?: { title?: string };
    sheets?: Array<{ properties?: { title?: string } }>;
  };
  const existingTitles = new Set(
    (meta.sheets ?? []).map((s) => s.properties?.title).filter(Boolean) as string[]
  );

  // 1. Read existing managed tabs BEFORE creating/writing so Sheet edits are never lost
  const currentSheetTabs = await readManagedTabsFromSpreadsheet(
    accessToken,
    cleanId,
    existingTitles
  );

  // 2. Create only missing managed Web_* tabs; leave all organizer custom tabs untouched
  const missingTabs = TEMPLATE_TABS.filter((tab) => !existingTitles.has(tab));
  if (missingTabs.length > 0) {
    const addRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cleanId)}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: missingTabs.map((title) => ({ addSheet: { properties: { title } } })),
        }),
      }
    );
    if (!addRes.ok) {
      const errText = await addRes.text();
      throw new Error(`Error al crear pestañas Web_* (${addRes.status}): ${errText}`);
    }
  }

  // 3. Perform 3-way bidirectional non-destructive merge
  const baselineTabs = loadSyncBaseline(cleanId);
  const merged = mergeTournamentWithSheets({
    webState: state,
    sheetTabs: currentSheetTabs,
    baselineTabs,
    disciplineFilter: options?.disciplineFilter,
    deletedIds: options?.deletedIds,
  });

  // 4. Write merged payloads starting at A1 (preserving extra user columns!)
  const dataEntries = TEMPLATE_TABS.map((tab) => ({
    range: `'${tab}'!A1`,
    values: merged.mergedTabs[tab],
  }));

  const batchRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cleanId)}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: dataEntries,
      }),
    }
  );

  if (!batchRes.ok) {
    const errText = await batchRes.text();
    throw new Error(`Error al escribir datos en Google Sheets (${batchRes.status}): ${errText}`);
  }

  // 5. Clear ONLY trailing stale rows strictly below the new merged row count
  // (e.g., after an explicit admin deletion) without ever wiping custom extra columns!
  const trailingClearRanges: string[] = [];
  for (const tab of TEMPLATE_TABS) {
    const prevRows = currentSheetTabs[tab]?.length ?? 0;
    const nextRows = merged.mergedTabs[tab].length;
    if (prevRows > nextRows) {
      const colWidth = Math.max(
        merged.mergedTabs[tab][0]?.length ?? 1,
        currentSheetTabs[tab]?.[0]?.length ?? 1
      );
      const endColLetter = columnNumberToA1(colWidth);
      trailingClearRanges.push(`'${tab}'!A${nextRows + 1}:${endColLetter}${prevRows}`);
    }
  }

  if (trailingClearRanges.length > 0) {
    const clearRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cleanId)}/values:batchClear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ranges: trailingClearRanges,
        }),
      }
    );
    if (!clearRes.ok) {
      const errText = await clearRes.text();
      throw new Error(`Error limpiando filas sobrantes en Google Sheets (${clearRes.status}): ${errText}`);
    }
  }

  // 6. Persist merged baseline for future 3-way merges
  saveSyncBaseline(cleanId, merged.mergedTabs);

  const totalRowsWritten = TEMPLATE_TABS.reduce(
    (sum, tab) => sum + merged.mergedTabs[tab].length,
    0
  );

  return {
    masterKey: options?.masterKey,
    masterLabel: options?.masterLabel,
    spreadsheetId: cleanId,
    spreadsheetTitle: meta.properties?.title,
    spreadsheetUrl:
      options?.knownUrl ??
      meta.spreadsheetUrl ??
      `https://docs.google.com/spreadsheets/d/${cleanId}/edit`,
    tabsUpdated: [...TEMPLATE_TABS],
    totalRowsWritten,
    syncedAt: new Date().toISOString(),
    mode: 'bidirectional',
    imports: merged.imports,
    mergeStats: merged.stats,
  };
}

/**
 * Syncs all configured Master Spreadsheets (or a specified subset of MasterSheetKeys)
 * using the bidirectional non-destructive merge pipeline.
 */
export async function syncMultipleMasterSheets(
  accessToken: string,
  state: TournamentState,
  onlyKeys?: MasterSheetKey[],
  deletedIds?: DeletedEntityIds
): Promise<{
  succeeded: SheetSyncSummary[];
  failed: Array<{ masterKey: MasterSheetKey; label: string; error: string }>;
}> {
  const configured = getConfiguredMasterEntries(state.masterSheets);
  const targets = onlyKeys
    ? configured.filter((entry) => onlyKeys.includes(entry.key))
    : configured;

  const succeeded: SheetSyncSummary[] = [];
  const failed: Array<{ masterKey: MasterSheetKey; label: string; error: string }> = [];

  for (const target of targets) {
    try {
      const summary = await syncMasterSheet(
        accessToken,
        target.key,
        target.spreadsheetId,
        state,
        undefined,
        deletedIds
      );
      succeeded.push(summary);
    } catch (err: unknown) {
      failed.push({
        masterKey: target.key,
        label: target.meta.label,
        error: err instanceof Error ? err.message : 'Error sincronizando planilla.',
      });
    }
  }

  return { succeeded, failed };
}

/**
 * Exports any template tab directly as a UTF-8 CSV file (Excel/Google Sheets compatible).
 */
export function downloadTemplateCsv(
  tabName: TemplateTabName,
  state: TournamentState,
  masterKey?: MasterSheetKey
): void {
  const disciplineFilter = masterKey ? MASTER_SHEET_GROUP_MAP[masterKey].disciplineIds : undefined;
  const rows = buildTemplateSheetPayloads(state, disciplineFilter)[tabName];
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell ?? '');
          return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
        })
        .join(',')
    )
    .join('\n');

  const suffix = masterKey ? `_${masterKey}` : '';
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `UFRO_Intercarreras_${tabName}${suffix}_${state.temporada}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
