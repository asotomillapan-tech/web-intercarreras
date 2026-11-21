import { DISCIPLINE_MAP } from '../data/ufroSeed';
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

/**
 * Dedicated managed tab names prefixed with "Web_" so syncing into an existing Master Sheet
 * (such as the official Fútbol Hombres Master) NEVER overwrites or deletes the organizer's
 * own custom tabs, formulas, or historical sheets.
 */
export const TEMPLATE_TABS = [
  'Web_Equipos',
  'Web_Jugadores',
  'Web_Partidos',
  'Web_Transferencias',
  'Web_Formato',
] as const;

export type TemplateTabName = (typeof TEMPLATE_TABS)[number];

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
  const entries: Array<{ key: MasterSheetKey; meta: MasterSheetGroupMeta; spreadsheetId: string }> = [];
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
  const allowedSet = disciplineFilter ? new Set<DisciplineId>(disciplineFilter) : null;
  const matchDiscipline = (d: DisciplineId) => !allowedSet || allowedSet.has(d);

  const filteredTeams = state.teams.filter((t) => matchDiscipline(t.disciplineId));
  const filteredPlayers = state.players.filter((p) => matchDiscipline(p.disciplineId));
  const filteredMatches = state.matches.filter((m) => matchDiscipline(m.disciplineId));
  const filteredTransfers = state.transfers.filter((tr) => matchDiscipline(tr.disciplineId));
  const filteredConfigs = Object.values(state.configs).filter((cfg) =>
    matchDiscipline(cfg.disciplineId)
  );

  const teamById = new Map(state.teams.map((t) => [t.id, t]));

  const equiposRows: string[][] = [
    [
      'ID_Equipo',
      'Disciplina',
      'Grupo',
      'Nombre_Equipo',
      'Sigla',
      'Carrera',
      'Facultad',
      'Correo_Capitan',
      'Logros_Anteriores',
    ],
    ...filteredTeams.map((t) => [
      t.id,
      DISCIPLINE_MAP[t.disciplineId]?.nombre ?? t.disciplineId,
      t.groupName,
      t.nombre,
      t.sigla,
      t.carrera,
      t.facultad,
      t.capitanCorreo ?? '',
      t.logrosAnteriores ?? '',
    ]),
  ];

  // Exact 12 official UFRO fields + sports stats
  const jugadoresRows: string[][] = [
    [
      'ID_Jugador',
      'Disciplina',
      'Equipo',
      'Dorsal',
      'Posicion',
      'Nombre',
      'Apellido_Paterno',
      'Apellido_Materno',
      'Carrera',
      'Facultad',
      'RUT',
      'Numero_Matricula',
      'Correo_Institucional',
      'Nivel_Academico',
      'Fecha_Nacimiento',
      'Fotografia',
      'Seleccionado_UFRO',
      'PJ',
      'Goles',
      'Asistencias',
      'Puntos',
      'Aces',
      'Bloqueos',
    ],
    ...filteredPlayers.map((p) => [
      p.id,
      DISCIPLINE_MAP[p.disciplineId]?.nombre ?? p.disciplineId,
      teamById.get(p.teamId)?.nombre ?? p.teamId,
      String(p.dorsal),
      p.posicion,
      p.nombre,
      p.apellidoPaterno,
      p.apellidoMaterno,
      p.carrera,
      p.facultad,
      p.rut,
      p.numeroMatricula,
      p.correoInstitucional,
      p.nivelAcademico,
      p.fechaNacimiento,
      p.fotografia
        ? p.fotografia.startsWith('data:')
          ? '[Imagen adjunta en web]'
          : p.fotografia
        : 'Sin foto',
      p.esSeleccionadoUfro ? 'Sí' : 'No',
      String(p.stats.partidosJugados),
      String(p.stats.goles),
      String(p.stats.asistencias),
      String(p.stats.puntos),
      String(p.stats.aces),
      String(p.stats.bloqueos),
    ]),
  ];

  const resultadosRows: string[][] = [
    [
      'ID_Partido',
      'Disciplina',
      'Fase',
      'Grupo',
      'Fecha',
      'Hora',
      'Cancha',
      'Local',
      'Marcador_Local',
      'Marcador_Visita',
      'Visita',
      'Estado',
      'Validacion_Planilla',
    ],
    ...filteredMatches.map((m) => [
      m.id,
      DISCIPLINE_MAP[m.disciplineId]?.nombre ?? m.disciplineId,
      m.fase,
      m.groupName,
      m.fecha,
      m.hora,
      m.cancha,
      teamById.get(m.homeTeamId)?.nombre ?? m.homeTeamId,
      String(m.homeScore),
      String(m.awayScore),
      teamById.get(m.awayTeamId)?.nombre ?? m.awayTeamId,
      m.status,
      m.scoresheetValidation
        ? `${m.scoresheetValidation.method} (${m.scoresheetValidation.refereeName})`
        : 'Pendiente',
    ]),
  ];

  const transferenciasRows: string[][] = [
    [
      'ID_Transferencia',
      'Disciplina',
      'Fecha',
      'Jugador',
      'RUT',
      'Equipo_Origen',
      'Equipo_Destino',
      'Motivo',
      'Estado',
    ],
    ...filteredTransfers.map((tr) => [
      tr.id,
      DISCIPLINE_MAP[tr.disciplineId]?.nombre ?? tr.disciplineId,
      tr.fecha,
      tr.playerName,
      tr.playerRut ?? '',
      tr.fromTeamName,
      tr.toTeamName,
      tr.motivo,
      tr.estado,
    ]),
  ];

  const configRows: string[][] = [
    [
      'Disciplina',
      'Temporada',
      'Cupos_Maximos',
      'Num_Grupos',
      'Clasificados_Por_Grupo',
      'Formato_Playoff',
      'Inscripciones_Abiertas',
      'Transferencias_Abiertas',
      'Fase_Actual',
    ],
    ...filteredConfigs.map((cfg) => [
      DISCIPLINE_MAP[cfg.disciplineId]?.nombre ?? cfg.disciplineId,
      cfg.temporada,
      String(cfg.maxCupos),
      String(cfg.numGrupos),
      String(cfg.clasificadosPorGrupo),
      `Top ${cfg.formatoPlayoff}`,
      cfg.inscripcionesAbiertas ? 'Abiertas' : 'Cerradas',
      cfg.transferenciasAbiertas ? 'Abiertas' : 'Cerradas',
      cfg.faseActual,
    ]),
  ];

  return {
    Web_Equipos: equiposRows,
    Web_Jugadores: jugadoresRows,
    Web_Partidos: resultadosRows,
    Web_Transferencias: transferenciasRows,
    Web_Formato: configRows,
  };
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
  return syncMasterSheet(accessToken, masterKey, created.spreadsheetId, state, created.spreadsheetUrl);
}

/**
 * Backward-compatible alias for creating a consolidated Master Sheet.
 */
export async function createMasterGoogleSheet(
  accessToken: string,
  state: TournamentState
): Promise<SheetSyncSummary> {
  return createMasterGoogleSheetForGroup(accessToken, 'consolidado', state);
}

/**
 * Synchronizes a specific discipline group's Master Sheet.
 * - Fetches existing tabs first (never assumes hardcoded tab names).
 * - Creates missing Web_* tabs without touching the organizer's own custom tabs.
 * - Clears only the 5 managed Web_* tabs so deleted/edited records leave no stale rows.
 * - Writes filtered rows for the disciplines belonging to that Master Sheet.
 */
export async function syncMasterSheet(
  accessToken: string,
  masterKey: MasterSheetKey,
  spreadsheetId: string,
  state: TournamentState,
  knownUrl?: string
): Promise<SheetSyncSummary> {
  const meta = MASTER_SHEET_GROUP_MAP[masterKey];
  return syncStateToExistingSpreadsheet(accessToken, spreadsheetId, state, {
    knownUrl,
    masterKey,
    masterLabel: meta.label,
    disciplineFilter: meta.disciplineIds,
  });
}

/**
 * Synchronizes championship tabs into an existing Google Spreadsheet ID.
 */
export async function syncStateToExistingSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  state: TournamentState,
  options?: {
    knownUrl?: string;
    masterKey?: MasterSheetKey;
    masterLabel?: string;
    disciplineFilter?: DisciplineId[];
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

  // Create only the managed Web_* tabs if missing; leave all other user tabs untouched
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

  // Clear ONLY the 5 managed Web_* tabs so no stale trailing rows remain
  const clearRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cleanId)}/values:batchClear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ranges: TEMPLATE_TABS.map((tab) => `'${tab}'!A:Z`),
      }),
    }
  );
  if (!clearRes.ok) {
    const errText = await clearRes.text();
    throw new Error(`Error al limpiar pestañas Web_* (${clearRes.status}): ${errText}`);
  }

  const payloads = buildTemplateSheetPayloads(state, options?.disciplineFilter);
  const dataEntries = TEMPLATE_TABS.map((tab) => ({
    range: `'${tab}'!A1`,
    values: payloads[tab],
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

  const totalRowsWritten = TEMPLATE_TABS.reduce((sum, tab) => sum + payloads[tab].length, 0);

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
  };
}

/**
 * Syncs all configured Master Spreadsheets (or a specified subset of MasterSheetKeys).
 */
export async function syncMultipleMasterSheets(
  accessToken: string,
  state: TournamentState,
  onlyKeys?: MasterSheetKey[]
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
      const summary = await syncMasterSheet(accessToken, target.key, target.spreadsheetId, state);
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
