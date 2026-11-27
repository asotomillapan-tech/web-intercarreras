import { DISCIPLINES, DISCIPLINE_MAP, UFRO_CAREERS } from '../data/ufroSeed';
import type {
  AcademicLevel,
  DisciplineFormatConfig,
  DisciplineId,
  Match,
  MatchPhase,
  MatchStatus,
  Player,
  PlayerStats,
  Team,
  TournamentStage,
  TournamentState,
} from '../types/tournament';

export const MANAGED_SHEET_TABS = [
  'Web_Equipos',
  'Web_Jugadores',
  'Web_Partidos',
  'Web_Transferencias',
  'Web_Formato',
] as const;

export type ManagedSheetTabName = (typeof MANAGED_SHEET_TABS)[number];

export type SheetTabRows = Record<ManagedSheetTabName, string[][]>;

export interface DeletedEntityIds {
  teamIds?: string[];
  playerIds?: string[];
  matchIds?: string[];
}

export interface SheetImportDelta {
  teamsToCreate: Team[];
  teamsToUpdate: Team[];
  playersToCreate: Player[];
  playersToUpdate: Player[];
  matchesToCreate: Match[];
  matchesToUpdate: Match[];
  configsToUpdate: DisciplineFormatConfig[];
}

export interface SheetMergeStats {
  pulledNewTeams: number;
  pulledUpdatedTeams: number;
  pulledNewPlayers: number;
  pulledUpdatedPlayers: number;
  pulledNewMatches: number;
  pulledUpdatedMatches: number;
  pulledUpdatedConfigs: number;
  pushedToSheet: number;
  preservedExtraColumns: number;
  preservedUnparsedSheetRows: number;
}

export interface BidirectionalMergeResult {
  mergedTabs: SheetTabRows;
  imports: SheetImportDelta;
  stats: SheetMergeStats;
}

export const STANDARD_HEADERS: Record<ManagedSheetTabName, string[]> = {
  Web_Equipos: [
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
  Web_Jugadores: [
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
  Web_Partidos: [
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
  Web_Transferencias: [
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
  Web_Formato: [
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
};

// ---------------------------------------------------------------------------
// Normalization & Parsing Helpers
// ---------------------------------------------------------------------------

function normalizeText(value: string | undefined | null): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function cleanCell(value: string | undefined | null): string {
  return String(value ?? '').trim();
}

export function sanitizeFirestoreId(raw: string, fallbackPrefix: string, seedIndex: number): string {
  const cleaned = raw
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  if (cleaned.length >= 2) return cleaned;
  return `${fallbackPrefix}-${Date.now().toString(36)}-${seedIndex}`;
}

export function resolveDisciplineId(
  raw: string | undefined,
  disciplineFilter?: DisciplineId[]
): DisciplineId {
  const norm = normalizeText(raw);
  if (norm) {
    for (const d of DISCIPLINES) {
      if (
        normalizeText(d.id) === norm ||
        normalizeText(d.nombre) === norm ||
        normalizeText(d.nombreCorto) === norm
      ) {
        return d.id;
      }
    }
    // Partial fuzzy match for organizer edits like "1ra division", "futbol mujeres", etc.
    for (const d of DISCIPLINES) {
      if (normalizeText(d.nombre).includes(norm) || norm.includes(normalizeText(d.nombreCorto))) {
        return d.id;
      }
    }
  }
  return disciplineFilter?.[0] ?? 'f7-h-1';
}

function parseBoundedInt(raw: string | undefined, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(String(raw ?? '').replace(/[^0-9-]/g, ''), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function parseBoolYesNo(raw: string | undefined, fallback: boolean): boolean {
  const norm = normalizeText(raw);
  if (!norm) return fallback;
  if (['si', 's', 'yes', 'true', '1', 'abierta', 'abiertas', 'activo', 'activa', 'x'].includes(norm)) {
    return true;
  }
  if (['no', 'n', 'false', '0', 'cerrada', 'cerradas', 'inactivo', 'inactiva'].includes(norm)) {
    return false;
  }
  return fallback;
}

function parseAcademicLevel(raw: string | undefined, fallback: AcademicLevel): AcademicLevel {
  const norm = normalizeText(raw);
  if (norm.includes('post') || norm.includes('magister') || norm.includes('doctor')) {
    return 'Postgrado';
  }
  if (norm.includes('pre')) return 'Pregrado';
  return fallback;
}

function parseMatchPhase(raw: string | undefined, fallback: MatchPhase): MatchPhase {
  const norm = normalizeText(raw);
  if (norm.includes('octav')) return 'Octavos';
  if (norm.includes('cuart')) return 'Cuartos';
  if (norm.includes('semi')) return 'Semifinal';
  if (norm.includes('tercer') || norm.includes('3er') || norm.includes('3°') || norm.includes('bronce')) {
    return 'Tercer Lugar';
  }
  if (norm === 'final' || norm.includes('final')) return 'Final';
  if (norm.includes('grup')) return 'Grupos';
  return fallback;
}

function parseMatchStatus(raw: string | undefined, fallback: MatchStatus): MatchStatus {
  const norm = normalizeText(raw);
  if (norm.includes('final')) return 'FINALIZADO';
  if (norm.includes('vivo') || norm.includes('curso') || norm.includes('jugando')) return 'EN_VIVO';
  if (norm.includes('prog') || norm.includes('pend')) return 'PROGRAMADO';
  return fallback;
}

function parseTournamentStage(raw: string | undefined, fallback: TournamentStage): TournamentStage {
  const norm = normalizeText(raw);
  if (norm.includes('inscrip')) return 'INSCRIPCIONES';
  if (norm.includes('transf')) return 'TRANSFERENCIAS';
  if (norm.includes('playoff') || norm.includes('final')) return 'PLAYOFFS';
  if (norm.includes('grup')) return 'FASE_GRUPOS';
  return fallback;
}

function buildSiglaFromName(nombre: string): string {
  const words = nombre
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, 4)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 6);
  }
  const single = (words[0] ?? 'UFRO').toUpperCase().slice(0, 4);
  return single.length >= 2 ? single : 'UFRO';
}

function emptyPlayerStats(): PlayerStats {
  return {
    partidosJugados: 0,
    goles: 0,
    asistencias: 0,
    tarjetasAmarillas: 0,
    tarjetasRojas: 0,
    puntos: 0,
    rebotes: 0,
    triples: 0,
    faltas: 0,
    aces: 0,
    bloqueos: 0,
  };
}

function isRowEmpty(row: string[]): boolean {
  return row.every((cell) => cleanCell(cell) === '');
}

// ---------------------------------------------------------------------------
// Sheet Table Indexing (Preserves Extra User-Added Columns!)
// ---------------------------------------------------------------------------

interface ParsedSheetTable {
  standardColIndex: number[];
  extraHeaders: string[];
  extraColIndices: number[];
  rows: Array<{
    standardCells: string[];
    extraCells: string[];
    rawRowIndex: number;
  }>;
}

function parseSheetTable(
  rawRows: string[][] | undefined,
  standardHeaders: string[]
): ParsedSheetTable {
  if (!rawRows || rawRows.length === 0) {
    return {
      standardColIndex: standardHeaders.map((_, idx) => idx),
      extraHeaders: [],
      extraColIndices: [],
      rows: [],
    };
  }

  const headerRow = rawRows[0] ?? [];
  const normStandard = standardHeaders.map((h) => normalizeText(h));
  const usedSheetCols = new Set<number>();

  // Match header columns by normalized name; fall back to positional index if header looks missing
  let headerMatchesCount = 0;
  const standardColIndex = normStandard.map((stdName) => {
    const idx = headerRow.findIndex(
      (cell, colIdx) => !usedSheetCols.has(colIdx) && normalizeText(cell) === stdName
    );
    if (idx >= 0) {
      usedSheetCols.add(idx);
      headerMatchesCount++;
    }
    return idx;
  });

  const hasValidHeader = headerMatchesCount >= Math.min(3, standardHeaders.length);
  const resolvedStandardCols = hasValidHeader
    ? standardColIndex
    : standardHeaders.map((_, idx) => idx);

  const extraHeaders: string[] = [];
  const extraColIndices: number[] = [];

  if (hasValidHeader) {
    headerRow.forEach((h, colIdx) => {
      if (!usedSheetCols.has(colIdx) && cleanCell(h) !== '') {
        extraHeaders.push(cleanCell(h));
        extraColIndices.push(colIdx);
      }
    });
  }

  const dataStart = hasValidHeader ? 1 : 0;
  const rows: ParsedSheetTable['rows'] = [];

  for (let r = dataStart; r < rawRows.length; r++) {
    const raw = rawRows[r] ?? [];
    if (isRowEmpty(raw)) continue;
    const standardCells = resolvedStandardCols.map((colIdx) =>
      colIdx >= 0 ? cleanCell(raw[colIdx]) : ''
    );
    const extraCells = extraColIndices.map((colIdx) => cleanCell(raw[colIdx]));
    rows.push({ standardCells, extraCells, rawRowIndex: r });
  }

  return {
    standardColIndex: resolvedStandardCols,
    extraHeaders,
    extraColIndices,
    rows,
  };
}

/**
 * 3-way field resolver:
 * - Guarantees that edits made directly in Google Sheets are NEVER erased.
 * - If a baseline exists:
 *    - Sheet changed & Web unchanged -> Sheet wins
 *    - Web changed & Sheet unchanged -> Web wins
 *    - Both changed -> Sheet wins (preserves manual Sheet edits)
 * - If NO baseline exists (first bidirectional sync):
 *    - Non-empty Sheet value differing from Web -> Sheet wins
 *    - Empty Sheet value when Web has a value -> Web wins (prevents accidental blanking)
 */
function resolveThreeWayField(params: {
  webVal: string;
  sheetVal: string;
  baseVal?: string;
  allowEmptySheetOverride?: boolean;
  isPhotoPlaceholderProtected?: boolean;
}): { value: string; fromSheet: boolean } {
  const w = cleanCell(params.webVal);
  const s = cleanCell(params.sheetVal);

  if (params.isPhotoPlaceholderProtected) {
    const sNorm = normalizeText(s);
    if (!s || sNorm === '[imagen adjunta en web]' || sNorm === 'sin foto') {
      return { value: w, fromSheet: false };
    }
  }

  if (normalizeText(w) === normalizeText(s)) {
    return { value: s || w, fromSheet: false };
  }

  if (params.baseVal !== undefined) {
    const b = cleanCell(params.baseVal);
    const sheetChanged = normalizeText(s) !== normalizeText(b);
    const webChanged = normalizeText(w) !== normalizeText(b);

    if (sheetChanged && !webChanged) {
      if (!s && !params.allowEmptySheetOverride) {
        return { value: w, fromSheet: false };
      }
      return { value: s, fromSheet: true };
    }
    if (webChanged && !sheetChanged) {
      return { value: w, fromSheet: false };
    }
    if (sheetChanged && webChanged) {
      if (!s && !params.allowEmptySheetOverride) {
        return { value: w, fromSheet: false };
      }
      return { value: s, fromSheet: true };
    }
    return { value: w, fromSheet: false };
  }

  // First sync without a prior baseline: preserve non-empty Sheet edits so nothing in Sheets is wiped
  if (s !== '') {
    return { value: s, fromSheet: true };
  }
  return { value: w, fromSheet: false };
}

// ---------------------------------------------------------------------------
// Serialize Current Web State into Standard Sheet Rows
// ---------------------------------------------------------------------------

export function buildStandardSheetPayloads(
  state: TournamentState,
  disciplineFilter?: DisciplineId[]
): SheetTabRows {
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
    [...STANDARD_HEADERS.Web_Equipos],
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

  const jugadoresRows: string[][] = [
    [...STANDARD_HEADERS.Web_Jugadores],
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

  const partidosRows: string[][] = [
    [...STANDARD_HEADERS.Web_Partidos],
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
    [...STANDARD_HEADERS.Web_Transferencias],
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

  const formatoRows: string[][] = [
    [...STANDARD_HEADERS.Web_Formato],
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
    Web_Partidos: partidosRows,
    Web_Transferencias: transferenciasRows,
    Web_Formato: formatoRows,
  };
}

// ---------------------------------------------------------------------------
// Core Bidirectional 3-Way Merge Engine
// ---------------------------------------------------------------------------

export function mergeTournamentWithSheets(params: {
  webState: TournamentState;
  sheetTabs: Partial<Record<ManagedSheetTabName, string[][]>>;
  baselineTabs?: Partial<Record<ManagedSheetTabName, string[][]>>;
  disciplineFilter?: DisciplineId[];
  deletedIds?: DeletedEntityIds;
}): BidirectionalMergeResult {
  const { webState, sheetTabs, baselineTabs, disciplineFilter, deletedIds } = params;
  const allowedSet = disciplineFilter ? new Set<DisciplineId>(disciplineFilter) : null;
  const inScope = (d: DisciplineId) => !allowedSet || allowedSet.has(d);

  const deletedTeamSet = new Set(deletedIds?.teamIds ?? []);
  const deletedPlayerSet = new Set(deletedIds?.playerIds ?? []);
  const deletedMatchSet = new Set(deletedIds?.matchIds ?? []);

  const webPayloads = buildStandardSheetPayloads(webState, disciplineFilter);

  const imports: SheetImportDelta = {
    teamsToCreate: [],
    teamsToUpdate: [],
    playersToCreate: [],
    playersToUpdate: [],
    matchesToCreate: [],
    matchesToUpdate: [],
    configsToUpdate: [],
  };

  const stats: SheetMergeStats = {
    pulledNewTeams: 0,
    pulledUpdatedTeams: 0,
    pulledNewPlayers: 0,
    pulledUpdatedPlayers: 0,
    pulledNewMatches: 0,
    pulledUpdatedMatches: 0,
    pulledUpdatedConfigs: 0,
    pushedToSheet: 0,
    preservedExtraColumns: 0,
    preservedUnparsedSheetRows: 0,
  };

  const defaultCareer = UFRO_CAREERS[0];

  // =========================================================================
  // 1. MERGE Web_Equipos
  // =========================================================================
  const eqSheet = parseSheetTable(sheetTabs.Web_Equipos, STANDARD_HEADERS.Web_Equipos);
  const eqBase = parseSheetTable(baselineTabs?.Web_Equipos, STANDARD_HEADERS.Web_Equipos);
  stats.preservedExtraColumns += eqSheet.extraHeaders.length;

  const baseTeamsById = new Map<string, string[]>();
  eqBase.rows.forEach((r) => {
    const id = r.standardCells[0];
    if (id) baseTeamsById.set(id, r.standardCells);
  });

  const webTeamsInScope = webState.teams.filter((t) => inScope(t.disciplineId));
  const webTeamById = new Map(webTeamsInScope.map((t) => [t.id, t]));
  const webTeamRowById = new Map<string, string[]>();
  webPayloads.Web_Equipos.slice(1).forEach((row) => {
    if (row[0]) webTeamRowById.set(row[0], row);
  });

  const mergedTeamsRows: string[][] = [
    [...STANDARD_HEADERS.Web_Equipos, ...eqSheet.extraHeaders],
  ];
  const seenTeamIds = new Set<string>();
  const globalTeamIds = new Set<string>(webState.teams.map((t) => t.id));
  const remappedTeamIds = new Map<string, string>();

  const allocateUniqueScopedId = (
    rawCandidate: string,
    discId: DisciplineId,
    fallbackPrefix: string,
    idx: number,
    usedGlobal: Set<string>,
    usedSeen: Set<string>
  ): string => {
    const base = sanitizeFirestoreId(rawCandidate, fallbackPrefix, idx);
    if (!usedGlobal.has(base) && !usedSeen.has(base)) {
      usedGlobal.add(base);
      return base;
    }
    const scoped = sanitizeFirestoreId(`${discId}-${base}`, `${discId}-${fallbackPrefix}`, idx);
    if (!usedGlobal.has(scoped) && !usedSeen.has(scoped)) {
      usedGlobal.add(scoped);
      return scoped;
    }
    let suffix = 2;
    let candidate = sanitizeFirestoreId(`${scoped}-${suffix}`, `${discId}-${fallbackPrefix}`, idx);
    while (usedGlobal.has(candidate) || usedSeen.has(candidate)) {
      suffix++;
      candidate = sanitizeFirestoreId(`${scoped}-${suffix}`, `${discId}-${fallbackPrefix}`, idx);
    }
    usedGlobal.add(candidate);
    return candidate;
  };

  // Combined team lookup (existing + newly imported from Sheet) for resolving players & matches
  const allTeamsEffective = new Map<string, Team>(webState.teams.map((t) => [t.id, t]));

  const findTeamByNameOrId = (ref: string, preferredDisc?: DisciplineId): Team | undefined => {
    const trimmed = cleanCell(ref);
    if (!trimmed) return undefined;
    const remappedId = remappedTeamIds.get(trimmed);
    if (remappedId) {
      const remappedTeam = allTeamsEffective.get(remappedId);
      if (remappedTeam && (!preferredDisc || remappedTeam.disciplineId === preferredDisc)) {
        return remappedTeam;
      }
    }
    if (preferredDisc) {
      const scopedDirect = allTeamsEffective.get(`${preferredDisc}-${trimmed}`);
      if (scopedDirect && scopedDirect.disciplineId === preferredDisc) return scopedDirect;
    }
    const direct = allTeamsEffective.get(trimmed);
    if (direct && (!preferredDisc || direct.disciplineId === preferredDisc)) return direct;
    const norm = normalizeText(trimmed);
    const list = Array.from(allTeamsEffective.values());
    if (preferredDisc) {
      const exactDisc = list.find(
        (t) =>
          t.disciplineId === preferredDisc &&
          (normalizeText(t.nombre) === norm || normalizeText(t.sigla) === norm)
      );
      if (exactDisc) return exactDisc;
    }
    if (direct) return direct;
    return list.find(
      (t) => normalizeText(t.nombre) === norm || normalizeText(t.sigla) === norm
    );
  };

  eqSheet.rows.forEach((sRow, idx) => {
    const rawId = sRow.standardCells[0];
    const rowDiscId = resolveDisciplineId(sRow.standardCells[1], disciplineFilter);
    const scopedExistingId = rawId ? `${rowDiscId}-${rawId}` : '';
    const webTeam =
      (rawId ? webTeamById.get(rawId) : undefined) ??
      (scopedExistingId ? webTeamById.get(scopedExistingId) : undefined);
    const baseCells =
      (rawId ? baseTeamsById.get(rawId) : undefined) ??
      (scopedExistingId ? baseTeamsById.get(scopedExistingId) : undefined);

    if (webTeam) {
      if (rawId && rawId !== webTeam.id) {
        remappedTeamIds.set(rawId, webTeam.id);
      }
      seenTeamIds.add(webTeam.id);
      const webCells = webTeamRowById.get(webTeam.id) ?? [];

      const grupoRes = resolveThreeWayField({
        webVal: webCells[2] ?? webTeam.groupName,
        sheetVal: sRow.standardCells[2],
        baseVal: baseCells?.[2],
      });
      const nombreRes = resolveThreeWayField({
        webVal: webCells[3] ?? webTeam.nombre,
        sheetVal: sRow.standardCells[3],
        baseVal: baseCells?.[3],
      });
      const siglaRes = resolveThreeWayField({
        webVal: webCells[4] ?? webTeam.sigla,
        sheetVal: sRow.standardCells[4],
        baseVal: baseCells?.[4],
      });
      const carreraRes = resolveThreeWayField({
        webVal: webCells[5] ?? webTeam.carrera,
        sheetVal: sRow.standardCells[5],
        baseVal: baseCells?.[5],
      });
      const facultadRes = resolveThreeWayField({
        webVal: webCells[6] ?? webTeam.facultad,
        sheetVal: sRow.standardCells[6],
        baseVal: baseCells?.[6],
      });
      const correoRes = resolveThreeWayField({
        webVal: webCells[7] ?? webTeam.capitanCorreo ?? '',
        sheetVal: sRow.standardCells[7],
        baseVal: baseCells?.[7],
        allowEmptySheetOverride: true,
      });
      const logrosRes = resolveThreeWayField({
        webVal: webCells[8] ?? webTeam.logrosAnteriores ?? '',
        sheetVal: sRow.standardCells[8],
        baseVal: baseCells?.[8],
        allowEmptySheetOverride: true,
      });

      const anyFromSheet =
        grupoRes.fromSheet ||
        nombreRes.fromSheet ||
        siglaRes.fromSheet ||
        carreraRes.fromSheet ||
        facultadRes.fromSheet ||
        correoRes.fromSheet ||
        logrosRes.fromSheet;

      const resolvedNombre = nombreRes.value.length >= 2 ? nombreRes.value.slice(0, 120) : webTeam.nombre;
      const resolvedSigla =
        siglaRes.value.length >= 2
          ? siglaRes.value.toUpperCase().slice(0, 8)
          : webTeam.sigla;
      const resolvedCarrera =
        carreraRes.value.length >= 2 ? carreraRes.value.slice(0, 140) : webTeam.carrera;
      const resolvedFacultad =
        facultadRes.value.length >= 2 ? facultadRes.value.slice(0, 140) : webTeam.facultad;
      const resolvedGrupo = (grupoRes.value || webTeam.groupName || 'Grupo A').slice(0, 40);

      const mergedTeam: Team = {
        ...webTeam,
        nombre: resolvedNombre,
        sigla: resolvedSigla,
        carrera: resolvedCarrera,
        facultad: resolvedFacultad,
        groupName: resolvedGrupo,
        capitanCorreo: correoRes.value || undefined,
        logrosAnteriores: logrosRes.value || undefined,
      };

      allTeamsEffective.set(mergedTeam.id, mergedTeam);

      if (anyFromSheet) {
        imports.teamsToUpdate.push(mergedTeam);
        stats.pulledUpdatedTeams++;
      }

      mergedTeamsRows.push([
        mergedTeam.id,
        DISCIPLINE_MAP[mergedTeam.disciplineId]?.nombre ?? mergedTeam.disciplineId,
        mergedTeam.groupName,
        mergedTeam.nombre,
        mergedTeam.sigla,
        mergedTeam.carrera,
        mergedTeam.facultad,
        mergedTeam.capitanCorreo ?? '',
        mergedTeam.logrosAnteriores ?? '',
        ...sRow.extraCells,
      ]);
      return;
    }

    // Row only exists in Sheet!
    if (rawId && deletedTeamSet.has(rawId)) {
      // Explicitly deleted by an admin in the Web UI -> propagate deletion to Sheets
      return;
    }

    const nombre = cleanCell(sRow.standardCells[3]);
    if (nombre.length >= 2) {
      const discId = resolveDisciplineId(sRow.standardCells[1], disciplineFilter);
      const id = allocateUniqueScopedId(
        rawId || `tm-${discId}-${nombre}`,
        discId,
        `tm-${discId}`,
        idx,
        globalTeamIds,
        seenTeamIds
      );
      if (rawId && rawId !== id) {
        remappedTeamIds.set(rawId, id);
      }
      const matchedCareer = UFRO_CAREERS.find(
        (c) => normalizeText(c.carrera) === normalizeText(sRow.standardCells[5])
      );
      const carrera =
        cleanCell(sRow.standardCells[5]).length >= 2
          ? cleanCell(sRow.standardCells[5]).slice(0, 140)
          : defaultCareer.carrera;
      const facultad =
        cleanCell(sRow.standardCells[6]).length >= 2
          ? cleanCell(sRow.standardCells[6]).slice(0, 140)
          : matchedCareer?.facultad ?? defaultCareer.facultad;
      const siglaRaw = cleanCell(sRow.standardCells[4]);
      const sigla =
        siglaRaw.length >= 2 ? siglaRaw.toUpperCase().slice(0, 8) : buildSiglaFromName(nombre);
      const groupName = (cleanCell(sRow.standardCells[2]) || 'Grupo A').slice(0, 40);

      const newTeam: Team = {
        id,
        nombre: nombre.slice(0, 120),
        sigla,
        disciplineId: discId,
        carrera,
        facultad,
        groupName,
        capitanCorreo: cleanCell(sRow.standardCells[7]) || undefined,
        logrosAnteriores: cleanCell(sRow.standardCells[8]) || undefined,
      };

      seenTeamIds.add(newTeam.id);
      allTeamsEffective.set(newTeam.id, newTeam);
      imports.teamsToCreate.push(newTeam);
      stats.pulledNewTeams++;

      mergedTeamsRows.push([
        newTeam.id,
        DISCIPLINE_MAP[newTeam.disciplineId]?.nombre ?? newTeam.disciplineId,
        newTeam.groupName,
        newTeam.nombre,
        newTeam.sigla,
        newTeam.carrera,
        newTeam.facultad,
        newTeam.capitanCorreo ?? '',
        newTeam.logrosAnteriores ?? '',
        ...sRow.extraCells,
      ]);
    } else {
      // Unparsed draft row added in Sheets -> preserve as-is so we NEVER delete user content!
      stats.preservedUnparsedSheetRows++;
      mergedTeamsRows.push([...sRow.standardCells, ...sRow.extraCells]);
    }
  });

  // Append Web teams not yet present in Sheets
  webTeamsInScope.forEach((t) => {
    if (seenTeamIds.has(t.id)) return;
    stats.pushedToSheet++;
    mergedTeamsRows.push([
      t.id,
      DISCIPLINE_MAP[t.disciplineId]?.nombre ?? t.disciplineId,
      t.groupName,
      t.nombre,
      t.sigla,
      t.carrera,
      t.facultad,
      t.capitanCorreo ?? '',
      t.logrosAnteriores ?? '',
      ...eqSheet.extraHeaders.map(() => ''),
    ]);
  });

  // =========================================================================
  // 2. MERGE Web_Jugadores
  // =========================================================================
  const plSheet = parseSheetTable(sheetTabs.Web_Jugadores, STANDARD_HEADERS.Web_Jugadores);
  const plBase = parseSheetTable(baselineTabs?.Web_Jugadores, STANDARD_HEADERS.Web_Jugadores);
  stats.preservedExtraColumns += plSheet.extraHeaders.length;

  const basePlayersById = new Map<string, string[]>();
  plBase.rows.forEach((r) => {
    const id = r.standardCells[0];
    if (id) basePlayersById.set(id, r.standardCells);
  });

  const webPlayersInScope = webState.players.filter((p) => inScope(p.disciplineId));
  const webPlayerById = new Map(webPlayersInScope.map((p) => [p.id, p]));
  const webPlayerRowById = new Map<string, string[]>();
  webPayloads.Web_Jugadores.slice(1).forEach((row) => {
    if (row[0]) webPlayerRowById.set(row[0], row);
  });

  const mergedPlayersRows: string[][] = [
    [...STANDARD_HEADERS.Web_Jugadores, ...plSheet.extraHeaders],
  ];
  const seenPlayerIds = new Set<string>();
  const globalPlayerIds = new Set<string>(webState.players.map((p) => p.id));

  plSheet.rows.forEach((sRow, idx) => {
    const rawId = sRow.standardCells[0];
    const rowDiscId = resolveDisciplineId(sRow.standardCells[1], disciplineFilter);
    const scopedPlayerId = rawId ? `${rowDiscId}-${rawId}` : '';
    const webPlayer =
      (rawId ? webPlayerById.get(rawId) : undefined) ??
      (scopedPlayerId ? webPlayerById.get(scopedPlayerId) : undefined);
    const baseCells =
      (rawId ? basePlayersById.get(rawId) : undefined) ??
      (scopedPlayerId ? basePlayersById.get(scopedPlayerId) : undefined);

    if (webPlayer) {
      seenPlayerIds.add(webPlayer.id);
      const webCells = webPlayerRowById.get(webPlayer.id) ?? [];

      const teamRes = resolveThreeWayField({
        webVal: webCells[2] ?? allTeamsEffective.get(webPlayer.teamId)?.nombre ?? webPlayer.teamId,
        sheetVal: sRow.standardCells[2],
        baseVal: baseCells?.[2],
      });
      const dorsalRes = resolveThreeWayField({
        webVal: String(webPlayer.dorsal),
        sheetVal: sRow.standardCells[3],
        baseVal: baseCells?.[3],
      });
      const posRes = resolveThreeWayField({
        webVal: webPlayer.posicion,
        sheetVal: sRow.standardCells[4],
        baseVal: baseCells?.[4],
      });
      const nombreRes = resolveThreeWayField({
        webVal: webPlayer.nombre,
        sheetVal: sRow.standardCells[5],
        baseVal: baseCells?.[5],
      });
      const appRes = resolveThreeWayField({
        webVal: webPlayer.apellidoPaterno,
        sheetVal: sRow.standardCells[6],
        baseVal: baseCells?.[6],
      });
      const apmRes = resolveThreeWayField({
        webVal: webPlayer.apellidoMaterno,
        sheetVal: sRow.standardCells[7],
        baseVal: baseCells?.[7],
      });
      const carreraRes = resolveThreeWayField({
        webVal: webPlayer.carrera,
        sheetVal: sRow.standardCells[8],
        baseVal: baseCells?.[8],
      });
      const facultadRes = resolveThreeWayField({
        webVal: webPlayer.facultad,
        sheetVal: sRow.standardCells[9],
        baseVal: baseCells?.[9],
      });
      const rutRes = resolveThreeWayField({
        webVal: webPlayer.rut,
        sheetVal: sRow.standardCells[10],
        baseVal: baseCells?.[10],
      });
      const matRes = resolveThreeWayField({
        webVal: webPlayer.numeroMatricula,
        sheetVal: sRow.standardCells[11],
        baseVal: baseCells?.[11],
      });
      const emailRes = resolveThreeWayField({
        webVal: webPlayer.correoInstitucional,
        sheetVal: sRow.standardCells[12],
        baseVal: baseCells?.[12],
      });
      const nivelRes = resolveThreeWayField({
        webVal: webPlayer.nivelAcademico,
        sheetVal: sRow.standardCells[13],
        baseVal: baseCells?.[13],
      });
      const dobRes = resolveThreeWayField({
        webVal: webPlayer.fechaNacimiento,
        sheetVal: sRow.standardCells[14],
        baseVal: baseCells?.[14],
      });
      const fotoRes = resolveThreeWayField({
        webVal: webCells[15] ?? '',
        sheetVal: sRow.standardCells[15],
        baseVal: baseCells?.[15],
        isPhotoPlaceholderProtected: true,
      });
      const selecRes = resolveThreeWayField({
        webVal: webPlayer.esSeleccionadoUfro ? 'Sí' : 'No',
        sheetVal: sRow.standardCells[16],
        baseVal: baseCells?.[16],
      });
      const pjRes = resolveThreeWayField({
        webVal: String(webPlayer.stats.partidosJugados),
        sheetVal: sRow.standardCells[17],
        baseVal: baseCells?.[17],
      });
      const golesRes = resolveThreeWayField({
        webVal: String(webPlayer.stats.goles),
        sheetVal: sRow.standardCells[18],
        baseVal: baseCells?.[18],
      });
      const asistRes = resolveThreeWayField({
        webVal: String(webPlayer.stats.asistencias),
        sheetVal: sRow.standardCells[19],
        baseVal: baseCells?.[19],
      });
      const ptsRes = resolveThreeWayField({
        webVal: String(webPlayer.stats.puntos),
        sheetVal: sRow.standardCells[20],
        baseVal: baseCells?.[20],
      });
      const acesRes = resolveThreeWayField({
        webVal: String(webPlayer.stats.aces),
        sheetVal: sRow.standardCells[21],
        baseVal: baseCells?.[21],
      });
      const bloqRes = resolveThreeWayField({
        webVal: String(webPlayer.stats.bloqueos),
        sheetVal: sRow.standardCells[22],
        baseVal: baseCells?.[22],
      });

      const resolvedTeam =
        teamRes.fromSheet
          ? findTeamByNameOrId(teamRes.value, webPlayer.disciplineId)
          : allTeamsEffective.get(webPlayer.teamId);

      const resolvedPhoto =
        fotoRes.fromSheet && /^https?:\/\//i.test(fotoRes.value)
          ? fotoRes.value
          : webPlayer.fotografia;

      const mergedPlayer: Player = {
        ...webPlayer,
        teamId: resolvedTeam?.id ?? webPlayer.teamId,
        dorsal: parseBoundedInt(dorsalRes.value, 0, 99, webPlayer.dorsal),
        posicion: (posRes.value || webPlayer.posicion || 'Jugador').slice(0, 60),
        nombre: (nombreRes.value || webPlayer.nombre).slice(0, 80),
        apellidoPaterno: (appRes.value || webPlayer.apellidoPaterno || '-').slice(0, 80),
        apellidoMaterno: (apmRes.value || webPlayer.apellidoMaterno || '-').slice(0, 80),
        carrera:
          carreraRes.value.length >= 2
            ? carreraRes.value.slice(0, 140)
            : webPlayer.carrera.length >= 2
            ? webPlayer.carrera
            : 'Carrera UFRO',
        facultad:
          facultadRes.value.length >= 2
            ? facultadRes.value.slice(0, 140)
            : webPlayer.facultad.length >= 2
            ? webPlayer.facultad
            : 'Universidad de La Frontera',
        rut: rutRes.value,
        numeroMatricula: matRes.value,
        correoInstitucional: emailRes.value.toLowerCase(),
        nivelAcademico: parseAcademicLevel(nivelRes.value, webPlayer.nivelAcademico),
        fechaNacimiento: dobRes.value,
        fotografia: resolvedPhoto,
        esSeleccionadoUfro: parseBoolYesNo(selecRes.value, webPlayer.esSeleccionadoUfro),
        stats: {
          ...webPlayer.stats,
          partidosJugados: parseBoundedInt(pjRes.value, 0, 200, webPlayer.stats.partidosJugados),
          goles: parseBoundedInt(golesRes.value, 0, 500, webPlayer.stats.goles),
          asistencias: parseBoundedInt(asistRes.value, 0, 500, webPlayer.stats.asistencias),
          puntos: parseBoundedInt(ptsRes.value, 0, 5000, webPlayer.stats.puntos),
          aces: parseBoundedInt(acesRes.value, 0, 1000, webPlayer.stats.aces),
          bloqueos: parseBoundedInt(bloqRes.value, 0, 1000, webPlayer.stats.bloqueos),
        },
      };

      const anyFromSheet =
        (teamRes.fromSheet && Boolean(resolvedTeam)) ||
        dorsalRes.fromSheet ||
        posRes.fromSheet ||
        nombreRes.fromSheet ||
        appRes.fromSheet ||
        apmRes.fromSheet ||
        carreraRes.fromSheet ||
        facultadRes.fromSheet ||
        rutRes.fromSheet ||
        matRes.fromSheet ||
        emailRes.fromSheet ||
        nivelRes.fromSheet ||
        dobRes.fromSheet ||
        (fotoRes.fromSheet && /^https?:\/\//i.test(fotoRes.value)) ||
        selecRes.fromSheet ||
        pjRes.fromSheet ||
        golesRes.fromSheet ||
        asistRes.fromSheet ||
        ptsRes.fromSheet ||
        acesRes.fromSheet ||
        bloqRes.fromSheet;

      if (anyFromSheet) {
        imports.playersToUpdate.push(mergedPlayer);
        stats.pulledUpdatedPlayers++;
      }

      const displayTeamName = allTeamsEffective.get(mergedPlayer.teamId)?.nombre ?? mergedPlayer.teamId;
      mergedPlayersRows.push([
        mergedPlayer.id,
        DISCIPLINE_MAP[mergedPlayer.disciplineId]?.nombre ?? mergedPlayer.disciplineId,
        displayTeamName,
        String(mergedPlayer.dorsal),
        mergedPlayer.posicion,
        mergedPlayer.nombre,
        mergedPlayer.apellidoPaterno,
        mergedPlayer.apellidoMaterno,
        mergedPlayer.carrera,
        mergedPlayer.facultad,
        mergedPlayer.rut,
        mergedPlayer.numeroMatricula,
        mergedPlayer.correoInstitucional,
        mergedPlayer.nivelAcademico,
        mergedPlayer.fechaNacimiento,
        mergedPlayer.fotografia
          ? mergedPlayer.fotografia.startsWith('data:')
            ? '[Imagen adjunta en web]'
            : mergedPlayer.fotografia
          : 'Sin foto',
        mergedPlayer.esSeleccionadoUfro ? 'Sí' : 'No',
        String(mergedPlayer.stats.partidosJugados),
        String(mergedPlayer.stats.goles),
        String(mergedPlayer.stats.asistencias),
        String(mergedPlayer.stats.puntos),
        String(mergedPlayer.stats.aces),
        String(mergedPlayer.stats.bloqueos),
        ...sRow.extraCells,
      ]);
      return;
    }

    // Player row exists only in Sheets
    if (rawId && deletedPlayerSet.has(rawId)) {
      return;
    }

    const nombre = cleanCell(sRow.standardCells[5]);
    const apellidoPaterno = cleanCell(sRow.standardCells[6]);
    const discId = resolveDisciplineId(sRow.standardCells[1], disciplineFilter);
    const matchedTeam = findTeamByNameOrId(sRow.standardCells[2], discId);

    if (nombre.length >= 1 && apellidoPaterno.length >= 1 && matchedTeam) {
      const id = allocateUniqueScopedId(
        rawId || `pl-${matchedTeam.disciplineId}-${nombre}-${apellidoPaterno}`,
        matchedTeam.disciplineId,
        `pl-${matchedTeam.disciplineId}`,
        idx,
        globalPlayerIds,
        seenPlayerIds
      );
      const apellidoMaterno = cleanCell(sRow.standardCells[7]) || '-';
      const carreraRaw = cleanCell(sRow.standardCells[8]);
      const matchedCareer = UFRO_CAREERS.find(
        (c) => normalizeText(c.carrera) === normalizeText(carreraRaw)
      );
      const carrera =
        carreraRaw.length >= 2 ? carreraRaw.slice(0, 140) : matchedTeam.carrera || defaultCareer.carrera;
      const facultadRaw = cleanCell(sRow.standardCells[9]);
      const facultad =
        facultadRaw.length >= 2
          ? facultadRaw.slice(0, 140)
          : matchedCareer?.facultad ?? matchedTeam.facultad ?? defaultCareer.facultad;

      const fotoCell = cleanCell(sRow.standardCells[15]);
      const fotografia = /^https?:\/\//i.test(fotoCell) ? fotoCell : '';

      const newPlayer: Player = {
        id,
        teamId: matchedTeam.id,
        disciplineId: matchedTeam.disciplineId,
        dorsal: parseBoundedInt(sRow.standardCells[3], 0, 99, 0),
        posicion: (cleanCell(sRow.standardCells[4]) || 'Jugador').slice(0, 60),
        nombre: nombre.slice(0, 80),
        apellidoPaterno: apellidoPaterno.slice(0, 80),
        apellidoMaterno: apellidoMaterno.slice(0, 80),
        carrera,
        facultad,
        rut: cleanCell(sRow.standardCells[10]),
        numeroMatricula: cleanCell(sRow.standardCells[11]),
        correoInstitucional: cleanCell(sRow.standardCells[12]).toLowerCase(),
        nivelAcademico: parseAcademicLevel(sRow.standardCells[13], 'Pregrado'),
        fechaNacimiento: cleanCell(sRow.standardCells[14]),
        fotografia,
        esSeleccionadoUfro: parseBoolYesNo(sRow.standardCells[16], false),
        stats: {
          ...emptyPlayerStats(),
          partidosJugados: parseBoundedInt(sRow.standardCells[17], 0, 200, 0),
          goles: parseBoundedInt(sRow.standardCells[18], 0, 500, 0),
          asistencias: parseBoundedInt(sRow.standardCells[19], 0, 500, 0),
          puntos: parseBoundedInt(sRow.standardCells[20], 0, 5000, 0),
          aces: parseBoundedInt(sRow.standardCells[21], 0, 1000, 0),
          bloqueos: parseBoundedInt(sRow.standardCells[22], 0, 1000, 0),
        },
      };

      seenPlayerIds.add(newPlayer.id);
      imports.playersToCreate.push(newPlayer);
      stats.pulledNewPlayers++;

      mergedPlayersRows.push([
        newPlayer.id,
        DISCIPLINE_MAP[newPlayer.disciplineId]?.nombre ?? newPlayer.disciplineId,
        matchedTeam.nombre,
        String(newPlayer.dorsal),
        newPlayer.posicion,
        newPlayer.nombre,
        newPlayer.apellidoPaterno,
        newPlayer.apellidoMaterno,
        newPlayer.carrera,
        newPlayer.facultad,
        newPlayer.rut,
        newPlayer.numeroMatricula,
        newPlayer.correoInstitucional,
        newPlayer.nivelAcademico,
        newPlayer.fechaNacimiento,
        newPlayer.fotografia || 'Sin foto',
        newPlayer.esSeleccionadoUfro ? 'Sí' : 'No',
        String(newPlayer.stats.partidosJugados),
        String(newPlayer.stats.goles),
        String(newPlayer.stats.asistencias),
        String(newPlayer.stats.puntos),
        String(newPlayer.stats.aces),
        String(newPlayer.stats.bloqueos),
        ...sRow.extraCells,
      ]);
    } else {
      // Preserve incomplete/draft Sheet row intact
      stats.preservedUnparsedSheetRows++;
      mergedPlayersRows.push([...sRow.standardCells, ...sRow.extraCells]);
    }
  });

  // Append Web players not yet in Sheets
  webPlayersInScope.forEach((p) => {
    if (seenPlayerIds.has(p.id)) return;
    stats.pushedToSheet++;
    mergedPlayersRows.push([
      p.id,
      DISCIPLINE_MAP[p.disciplineId]?.nombre ?? p.disciplineId,
      allTeamsEffective.get(p.teamId)?.nombre ?? p.teamId,
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
      ...plSheet.extraHeaders.map(() => ''),
    ]);
  });

  // =========================================================================
  // 3. MERGE Web_Partidos
  // =========================================================================
  const mtSheet = parseSheetTable(sheetTabs.Web_Partidos, STANDARD_HEADERS.Web_Partidos);
  const mtBase = parseSheetTable(baselineTabs?.Web_Partidos, STANDARD_HEADERS.Web_Partidos);
  stats.preservedExtraColumns += mtSheet.extraHeaders.length;

  const baseMatchesById = new Map<string, string[]>();
  mtBase.rows.forEach((r) => {
    const id = r.standardCells[0];
    if (id) baseMatchesById.set(id, r.standardCells);
  });

  const webMatchesInScope = webState.matches.filter((m) => inScope(m.disciplineId));
  const webMatchById = new Map(webMatchesInScope.map((m) => [m.id, m]));
  const webMatchRowById = new Map<string, string[]>();
  webPayloads.Web_Partidos.slice(1).forEach((row) => {
    if (row[0]) webMatchRowById.set(row[0], row);
  });

  const mergedMatchesRows: string[][] = [
    [...STANDARD_HEADERS.Web_Partidos, ...mtSheet.extraHeaders],
  ];
  const seenMatchIds = new Set<string>();
  const globalMatchIds = new Set<string>(webState.matches.map((m) => m.id));

  mtSheet.rows.forEach((sRow, idx) => {
    const rawId = sRow.standardCells[0];
    const rowDiscId = resolveDisciplineId(sRow.standardCells[1], disciplineFilter);
    const scopedMatchId = rawId ? `${rowDiscId}-${rawId}` : '';
    const webMatch =
      (rawId ? webMatchById.get(rawId) : undefined) ??
      (scopedMatchId ? webMatchById.get(scopedMatchId) : undefined);
    const baseCells =
      (rawId ? baseMatchesById.get(rawId) : undefined) ??
      (scopedMatchId ? baseMatchesById.get(scopedMatchId) : undefined);

    if (webMatch) {
      seenMatchIds.add(webMatch.id);
      const webCells = webMatchRowById.get(webMatch.id) ?? [];

      const faseRes = resolveThreeWayField({
        webVal: webMatch.fase,
        sheetVal: sRow.standardCells[2],
        baseVal: baseCells?.[2],
      });
      const grupoRes = resolveThreeWayField({
        webVal: webMatch.groupName,
        sheetVal: sRow.standardCells[3],
        baseVal: baseCells?.[3],
      });
      const fechaRes = resolveThreeWayField({
        webVal: webMatch.fecha,
        sheetVal: sRow.standardCells[4],
        baseVal: baseCells?.[4],
      });
      const horaRes = resolveThreeWayField({
        webVal: webMatch.hora,
        sheetVal: sRow.standardCells[5],
        baseVal: baseCells?.[5],
      });
      const canchaRes = resolveThreeWayField({
        webVal: webMatch.cancha,
        sheetVal: sRow.standardCells[6],
        baseVal: baseCells?.[6],
      });
      const homeTeamRes = resolveThreeWayField({
        webVal: webCells[7] ?? allTeamsEffective.get(webMatch.homeTeamId)?.nombre ?? webMatch.homeTeamId,
        sheetVal: sRow.standardCells[7],
        baseVal: baseCells?.[7],
      });
      const homeScoreRes = resolveThreeWayField({
        webVal: String(webMatch.homeScore),
        sheetVal: sRow.standardCells[8],
        baseVal: baseCells?.[8],
      });
      const awayScoreRes = resolveThreeWayField({
        webVal: String(webMatch.awayScore),
        sheetVal: sRow.standardCells[9],
        baseVal: baseCells?.[9],
      });
      const awayTeamRes = resolveThreeWayField({
        webVal: webCells[10] ?? allTeamsEffective.get(webMatch.awayTeamId)?.nombre ?? webMatch.awayTeamId,
        sheetVal: sRow.standardCells[10],
        baseVal: baseCells?.[10],
      });
      const statusRes = resolveThreeWayField({
        webVal: webMatch.status,
        sheetVal: sRow.standardCells[11],
        baseVal: baseCells?.[11],
      });

      const resolvedHomeTeam = homeTeamRes.fromSheet
        ? findTeamByNameOrId(homeTeamRes.value, webMatch.disciplineId)
        : allTeamsEffective.get(webMatch.homeTeamId);
      const resolvedAwayTeam = awayTeamRes.fromSheet
        ? findTeamByNameOrId(awayTeamRes.value, webMatch.disciplineId)
        : allTeamsEffective.get(webMatch.awayTeamId);

      const nextHomeId = resolvedHomeTeam?.id ?? webMatch.homeTeamId;
      const nextAwayId =
        resolvedAwayTeam && resolvedAwayTeam.id !== nextHomeId
          ? resolvedAwayTeam.id
          : webMatch.awayTeamId;

      const nextStatus = parseMatchStatus(statusRes.value, webMatch.status);

      const mergedMatch: Match = {
        ...webMatch,
        fase: parseMatchPhase(faseRes.value, webMatch.fase),
        groupName: (grupoRes.value || webMatch.groupName || 'Grupo A').slice(0, 40),
        fecha:
          fechaRes.value.length >= 8
            ? fechaRes.value.slice(0, 20)
            : webMatch.fecha.length >= 8
            ? webMatch.fecha
            : new Date().toISOString().slice(0, 10),
        hora:
          horaRes.value.length >= 4
            ? horaRes.value.slice(0, 12)
            : webMatch.hora.length >= 4
            ? webMatch.hora
            : '18:00',
        cancha:
          canchaRes.value.length >= 2
            ? canchaRes.value.slice(0, 120)
            : webMatch.cancha.length >= 2
            ? webMatch.cancha
            : DISCIPLINE_MAP[webMatch.disciplineId]?.sedePrincipal ?? 'Campus UFRO',
        homeTeamId: nextHomeId,
        awayTeamId: nextAwayId,
        homeScore: parseBoundedInt(homeScoreRes.value, 0, 300, webMatch.homeScore),
        awayScore: parseBoundedInt(awayScoreRes.value, 0, 300, webMatch.awayScore),
        status: nextStatus,
        periodLabel:
          nextStatus === 'FINALIZADO'
            ? 'Finalizado'
            : nextStatus === 'EN_VIVO'
            ? 'En vivo'
            : webMatch.periodLabel,
      };

      const anyFromSheet =
        faseRes.fromSheet ||
        grupoRes.fromSheet ||
        fechaRes.fromSheet ||
        horaRes.fromSheet ||
        canchaRes.fromSheet ||
        (homeTeamRes.fromSheet && Boolean(resolvedHomeTeam)) ||
        homeScoreRes.fromSheet ||
        awayScoreRes.fromSheet ||
        (awayTeamRes.fromSheet && Boolean(resolvedAwayTeam)) ||
        statusRes.fromSheet;

      if (anyFromSheet) {
        imports.matchesToUpdate.push(mergedMatch);
        stats.pulledUpdatedMatches++;
      }

      mergedMatchesRows.push([
        mergedMatch.id,
        DISCIPLINE_MAP[mergedMatch.disciplineId]?.nombre ?? mergedMatch.disciplineId,
        mergedMatch.fase,
        mergedMatch.groupName,
        mergedMatch.fecha,
        mergedMatch.hora,
        mergedMatch.cancha,
        allTeamsEffective.get(mergedMatch.homeTeamId)?.nombre ?? mergedMatch.homeTeamId,
        String(mergedMatch.homeScore),
        String(mergedMatch.awayScore),
        allTeamsEffective.get(mergedMatch.awayTeamId)?.nombre ?? mergedMatch.awayTeamId,
        mergedMatch.status,
        mergedMatch.scoresheetValidation
          ? `${mergedMatch.scoresheetValidation.method} (${mergedMatch.scoresheetValidation.refereeName})`
          : sRow.standardCells[12] || 'Pendiente',
        ...sRow.extraCells,
      ]);
      return;
    }

    if (rawId && deletedMatchSet.has(rawId)) {
      return;
    }

    const discId = resolveDisciplineId(sRow.standardCells[1], disciplineFilter);
    const homeTeam = findTeamByNameOrId(sRow.standardCells[7], discId);
    const awayTeam = findTeamByNameOrId(sRow.standardCells[10], discId);

    if (homeTeam && awayTeam && homeTeam.id !== awayTeam.id) {
      const id = allocateUniqueScopedId(
        rawId || `m-${discId}-${homeTeam.sigla}-${awayTeam.sigla}`,
        discId,
        `m-${discId}`,
        idx,
        globalMatchIds,
        seenMatchIds
      );
      const status = parseMatchStatus(sRow.standardCells[11], 'PROGRAMADO');
      const fecha =
        cleanCell(sRow.standardCells[4]).length >= 8
          ? cleanCell(sRow.standardCells[4]).slice(0, 20)
          : new Date().toISOString().slice(0, 10);
      const hora =
        cleanCell(sRow.standardCells[5]).length >= 4
          ? cleanCell(sRow.standardCells[5]).slice(0, 12)
          : '18:00';
      const cancha =
        cleanCell(sRow.standardCells[6]).length >= 2
          ? cleanCell(sRow.standardCells[6]).slice(0, 120)
          : DISCIPLINE_MAP[discId]?.sedePrincipal ?? 'Campus UFRO';

      const newMatch: Match = {
        id,
        disciplineId: discId,
        groupName: (cleanCell(sRow.standardCells[3]) || homeTeam.groupName || 'Grupo A').slice(0, 40),
        fase: parseMatchPhase(sRow.standardCells[2], 'Grupos'),
        jornada: 1,
        fecha,
        hora,
        cancha,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        homeScore: parseBoundedInt(sRow.standardCells[8], 0, 300, 0),
        awayScore: parseBoundedInt(sRow.standardCells[9], 0, 300, 0),
        status,
        periodLabel: status === 'FINALIZADO' ? 'Finalizado' : status === 'EN_VIVO' ? 'En vivo' : 'Programado',
        clock: status === 'FINALIZADO' ? 'Final' : 'Por iniciar',
        periods: [],
        fouls: { home: 0, away: 0 },
        timeouts: { home: 0, away: 0 },
        events: [],
        refereeId: '',
      };

      seenMatchIds.add(newMatch.id);
      imports.matchesToCreate.push(newMatch);
      stats.pulledNewMatches++;

      mergedMatchesRows.push([
        newMatch.id,
        DISCIPLINE_MAP[newMatch.disciplineId]?.nombre ?? newMatch.disciplineId,
        newMatch.fase,
        newMatch.groupName,
        newMatch.fecha,
        newMatch.hora,
        newMatch.cancha,
        homeTeam.nombre,
        String(newMatch.homeScore),
        String(newMatch.awayScore),
        awayTeam.nombre,
        newMatch.status,
        sRow.standardCells[12] || 'Pendiente',
        ...sRow.extraCells,
      ]);
    } else {
      stats.preservedUnparsedSheetRows++;
      mergedMatchesRows.push([...sRow.standardCells, ...sRow.extraCells]);
    }
  });

  // Append Web matches not yet in Sheets
  webMatchesInScope.forEach((m) => {
    if (seenMatchIds.has(m.id)) return;
    stats.pushedToSheet++;
    mergedMatchesRows.push([
      m.id,
      DISCIPLINE_MAP[m.disciplineId]?.nombre ?? m.disciplineId,
      m.fase,
      m.groupName,
      m.fecha,
      m.hora,
      m.cancha,
      allTeamsEffective.get(m.homeTeamId)?.nombre ?? m.homeTeamId,
      String(m.homeScore),
      String(m.awayScore),
      allTeamsEffective.get(m.awayTeamId)?.nombre ?? m.awayTeamId,
      m.status,
      m.scoresheetValidation
        ? `${m.scoresheetValidation.method} (${m.scoresheetValidation.refereeName})`
        : 'Pendiente',
      ...mtSheet.extraHeaders.map(() => ''),
    ]);
  });

  // =========================================================================
  // 4. MERGE Web_Transferencias (Non-destructive preservation of Sheet rows + extra cols)
  // =========================================================================
  const trSheet = parseSheetTable(sheetTabs.Web_Transferencias, STANDARD_HEADERS.Web_Transferencias);
  stats.preservedExtraColumns += trSheet.extraHeaders.length;
  const webTransferRowsById = new Map<string, string[]>();
  webPayloads.Web_Transferencias.slice(1).forEach((row) => {
    if (row[0]) webTransferRowsById.set(row[0], row);
  });

  const mergedTransfersRows: string[][] = [
    [...STANDARD_HEADERS.Web_Transferencias, ...trSheet.extraHeaders],
  ];
  const seenTransferIds = new Set<string>();

  trSheet.rows.forEach((sRow) => {
    const id = sRow.standardCells[0];
    if (id && webTransferRowsById.has(id)) {
      seenTransferIds.add(id);
      const webRow = webTransferRowsById.get(id)!;
      // Preserve any manual edits made in Sheets on transfer rows (e.g. notes/estado)
      const mergedStd = webRow.map((wVal, cIdx) =>
        cleanCell(sRow.standardCells[cIdx]) !== '' ? cleanCell(sRow.standardCells[cIdx]) : wVal
      );
      mergedTransfersRows.push([...mergedStd, ...sRow.extraCells]);
    } else {
      // Preserve Sheet-only transfer rows verbatim
      mergedTransfersRows.push([...sRow.standardCells, ...sRow.extraCells]);
    }
  });

  webPayloads.Web_Transferencias.slice(1).forEach((row) => {
    if (row[0] && seenTransferIds.has(row[0])) return;
    stats.pushedToSheet++;
    mergedTransfersRows.push([...row, ...trSheet.extraHeaders.map(() => '')]);
  });

  // =========================================================================
  // 5. MERGE Web_Formato
  // =========================================================================
  const cfgSheet = parseSheetTable(sheetTabs.Web_Formato, STANDARD_HEADERS.Web_Formato);
  const cfgBase = parseSheetTable(baselineTabs?.Web_Formato, STANDARD_HEADERS.Web_Formato);
  stats.preservedExtraColumns += cfgSheet.extraHeaders.length;

  const baseConfigByDisc = new Map<DisciplineId, string[]>();
  cfgBase.rows.forEach((r) => {
    const disc = resolveDisciplineId(r.standardCells[0], disciplineFilter);
    baseConfigByDisc.set(disc, r.standardCells);
  });

  const mergedConfigsRows: string[][] = [
    [...STANDARD_HEADERS.Web_Formato, ...cfgSheet.extraHeaders],
  ];
  const seenConfigDiscs = new Set<DisciplineId>();

  cfgSheet.rows.forEach((sRow) => {
    const discId = resolveDisciplineId(sRow.standardCells[0], disciplineFilter);
    const webCfg = webState.configs[discId];
    if (!webCfg || !inScope(discId) || seenConfigDiscs.has(discId)) {
      mergedConfigsRows.push([...sRow.standardCells, ...sRow.extraCells]);
      return;
    }

    seenConfigDiscs.add(discId);
    const baseCells = baseConfigByDisc.get(discId);

    const tempRes = resolveThreeWayField({
      webVal: webCfg.temporada,
      sheetVal: sRow.standardCells[1],
      baseVal: baseCells?.[1],
    });
    const cuposRes = resolveThreeWayField({
      webVal: String(webCfg.maxCupos),
      sheetVal: sRow.standardCells[2],
      baseVal: baseCells?.[2],
    });
    const gruposRes = resolveThreeWayField({
      webVal: String(webCfg.numGrupos),
      sheetVal: sRow.standardCells[3],
      baseVal: baseCells?.[3],
    });
    const clasifRes = resolveThreeWayField({
      webVal: String(webCfg.clasificadosPorGrupo),
      sheetVal: sRow.standardCells[4],
      baseVal: baseCells?.[4],
    });
    const playoffRes = resolveThreeWayField({
      webVal: `Top ${webCfg.formatoPlayoff}`,
      sheetVal: sRow.standardCells[5],
      baseVal: baseCells?.[5],
    });
    const inscRes = resolveThreeWayField({
      webVal: webCfg.inscripcionesAbiertas ? 'Abiertas' : 'Cerradas',
      sheetVal: sRow.standardCells[6],
      baseVal: baseCells?.[6],
    });
    const transfRes = resolveThreeWayField({
      webVal: webCfg.transferenciasAbiertas ? 'Abiertas' : 'Cerradas',
      sheetVal: sRow.standardCells[7],
      baseVal: baseCells?.[7],
    });
    const faseRes = resolveThreeWayField({
      webVal: webCfg.faseActual,
      sheetVal: sRow.standardCells[8],
      baseVal: baseCells?.[8],
    });

    const parsedPlayoffNum = parseBoundedInt(playoffRes.value, 4, 16, webCfg.formatoPlayoff);
    const formatoPlayoff: 4 | 8 | 16 =
      parsedPlayoffNum === 4 || parsedPlayoffNum === 8 || parsedPlayoffNum === 16
        ? parsedPlayoffNum
        : webCfg.formatoPlayoff;

    const mergedCfg: DisciplineFormatConfig = {
      ...webCfg,
      temporada: (tempRes.value || webCfg.temporada).slice(0, 16),
      maxCupos: parseBoundedInt(cuposRes.value, 2, 128, webCfg.maxCupos),
      numGrupos: parseBoundedInt(gruposRes.value, 1, 16, webCfg.numGrupos),
      clasificadosPorGrupo: parseBoundedInt(clasifRes.value, 1, 8, webCfg.clasificadosPorGrupo),
      formatoPlayoff,
      inscripcionesAbiertas: parseBoolYesNo(inscRes.value, webCfg.inscripcionesAbiertas),
      transferenciasAbiertas: parseBoolYesNo(transfRes.value, webCfg.transferenciasAbiertas),
      faseActual: parseTournamentStage(faseRes.value, webCfg.faseActual),
    };

    const anyFromSheet =
      tempRes.fromSheet ||
      cuposRes.fromSheet ||
      gruposRes.fromSheet ||
      clasifRes.fromSheet ||
      playoffRes.fromSheet ||
      inscRes.fromSheet ||
      transfRes.fromSheet ||
      faseRes.fromSheet;

    if (anyFromSheet) {
      imports.configsToUpdate.push(mergedCfg);
      stats.pulledUpdatedConfigs++;
    }

    mergedConfigsRows.push([
      DISCIPLINE_MAP[mergedCfg.disciplineId]?.nombre ?? mergedCfg.disciplineId,
      mergedCfg.temporada,
      String(mergedCfg.maxCupos),
      String(mergedCfg.numGrupos),
      String(mergedCfg.clasificadosPorGrupo),
      `Top ${mergedCfg.formatoPlayoff}`,
      mergedCfg.inscripcionesAbiertas ? 'Abiertas' : 'Cerradas',
      mergedCfg.transferenciasAbiertas ? 'Abiertas' : 'Cerradas',
      mergedCfg.faseActual,
      ...sRow.extraCells,
    ]);
  });

  Object.values(webState.configs)
    .filter((cfg) => inScope(cfg.disciplineId) && !seenConfigDiscs.has(cfg.disciplineId))
    .forEach((cfg) => {
      stats.pushedToSheet++;
      mergedConfigsRows.push([
        DISCIPLINE_MAP[cfg.disciplineId]?.nombre ?? cfg.disciplineId,
        cfg.temporada,
        String(cfg.maxCupos),
        String(cfg.numGrupos),
        String(cfg.clasificadosPorGrupo),
        `Top ${cfg.formatoPlayoff}`,
        cfg.inscripcionesAbiertas ? 'Abiertas' : 'Cerradas',
        cfg.transferenciasAbiertas ? 'Abiertas' : 'Cerradas',
        cfg.faseActual,
        ...cfgSheet.extraHeaders.map(() => ''),
      ]);
    });

  return {
    mergedTabs: {
      Web_Equipos: mergedTeamsRows,
      Web_Jugadores: mergedPlayersRows,
      Web_Partidos: mergedMatchesRows,
      Web_Transferencias: mergedTransfersRows,
      Web_Formato: mergedConfigsRows,
    },
    imports,
    stats,
  };
}

export function hasAnySheetImports(imports: SheetImportDelta): boolean {
  return (
    imports.teamsToCreate.length > 0 ||
    imports.teamsToUpdate.length > 0 ||
    imports.playersToCreate.length > 0 ||
    imports.playersToUpdate.length > 0 ||
    imports.matchesToCreate.length > 0 ||
    imports.matchesToUpdate.length > 0 ||
    imports.configsToUpdate.length > 0
  );
}

/**
 * Converts a 1-based column index into Google Sheets A1 column letters (1 -> A, 27 -> AA).
 */
export function columnNumberToA1(col: number): string {
  let n = Math.max(1, Math.trunc(col));
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}
