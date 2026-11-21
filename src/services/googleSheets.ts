import { DISCIPLINE_MAP } from '../data/ufroSeed';
import type { TournamentState } from '../types/tournament';

export interface SheetSyncSummary {
  spreadsheetId: string;
  spreadsheetUrl: string;
  tabsUpdated: string[];
  totalRowsWritten: number;
}

export const TEMPLATE_TABS = [
  'Equipos',
  'Jugadores_Plantilla',
  'Resultados_Partidos',
  'Transferencias',
  'Configuracion_Formato',
] as const;

export function buildTemplateSheetPayloads(state: TournamentState): Record<(typeof TEMPLATE_TABS)[number], string[][]> {
  const teamById = new Map(state.teams.map((t) => [t.id, t]));

  const equiposRows: string[][] = [
    ['ID_Equipo', 'Disciplina', 'Grupo', 'Nombre_Equipo', 'Sigla', 'Carrera', 'Facultad', 'Correo_Capitan', 'Logros_Anteriores'],
    ...state.teams.map((t) => [
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

  // Exact 12 official fields requested by the user for every student player
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
    ...state.players.map((p) => [
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
      p.fotografia ? (p.fotografia.startsWith('data:') ? '[Imagen adjunta]' : p.fotografia) : 'Sin foto',
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
    ...state.matches.map((m) => [
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
      m.scoresheetValidation ? `${m.scoresheetValidation.method} (${m.scoresheetValidation.refereeName})` : 'Pendiente',
    ]),
  ];

  const transferenciasRows: string[][] = [
    ['ID_Transferencia', 'Disciplina', 'Fecha', 'Jugador', 'RUT', 'Equipo_Origen', 'Equipo_Destino', 'Motivo', 'Estado'],
    ...state.transfers.map((tr) => [
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
    ['Disciplina', 'Temporada', 'Cupos_Maximos', 'Num_Grupos', 'Clasificados_Por_Grupo', 'Formato_Playoff', 'Inscripciones_Abiertas', 'Transferencias_Abiertas', 'Fase_Actual'],
    ...Object.values(state.configs).map((cfg) => [
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
    Equipos: equiposRows,
    Jugadores_Plantilla: jugadoresRows,
    Resultados_Partidos: resultadosRows,
    Transferencias: transferenciasRows,
    Configuracion_Formato: configRows,
  };
}

/**
 * Creates a brand-new multi-tab Google Sheets Master Workbook in the user's account
 * and writes all championship template data.
 */
export async function createMasterGoogleSheet(
  accessToken: string,
  state: TournamentState
): Promise<SheetSyncSummary> {
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: `Campeonato Intercarreras UFRO ${state.temporada} — Plantilla Oficial`,
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
  return syncStateToExistingSpreadsheet(accessToken, created.spreadsheetId, state, created.spreadsheetUrl);
}

/**
 * Synchronizes championship tabs into an existing Google Spreadsheet ID.
 * Fetches existing tab titles first (best practice) and ensures all required tabs exist.
 */
export async function syncStateToExistingSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  state: TournamentState,
  knownUrl?: string
): Promise<SheetSyncSummary> {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetUrl,sheets.properties.title`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!metaRes.ok) {
    const errText = await metaRes.text();
    throw new Error(`No se pudo acceder a la planilla (${metaRes.status}): ${errText}`);
  }

  const meta = (await metaRes.json()) as {
    spreadsheetUrl?: string;
    sheets?: Array<{ properties?: { title?: string } }>;
  };
  const existingTitles = new Set(
    (meta.sheets ?? []).map((s) => s.properties?.title).filter(Boolean) as string[]
  );

  const missingTabs = TEMPLATE_TABS.filter((tab) => !existingTitles.has(tab));
  if (missingTabs.length > 0) {
    const addRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
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
      throw new Error(`Error al preparar pestañas (${addRes.status}): ${errText}`);
    }
  }

  const payloads = buildTemplateSheetPayloads(state);
  const dataEntries = TEMPLATE_TABS.map((tab) => ({
    range: `'${tab}'!A1`,
    values: payloads[tab],
  }));

  const batchRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
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
    spreadsheetId,
    spreadsheetUrl: knownUrl ?? meta.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    tabsUpdated: [...TEMPLATE_TABS],
    totalRowsWritten,
  };
}

/**
 * Exports any template tab directly as a UTF-8 CSV file (Excel/Google Sheets compatible).
 */
export function downloadTemplateCsv(tabName: (typeof TEMPLATE_TABS)[number], state: TournamentState): void {
  const rows = buildTemplateSheetPayloads(state)[tabName];
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

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `UFRO_Intercarreras_${tabName}_${state.temporada}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
