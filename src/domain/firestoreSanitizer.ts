import type {
  AcademicLevel,
  AiScoresheetResult,
  DisciplineFormatConfig,
  Match,
  MatchEvent,
  MatchPhase,
  MatchStatus,
  PeriodScore,
  Player,
  PlayerStats,
  ScoresheetValidationRecord,
  Team,
  TournamentStage,
  UserRole,
} from '../types/tournament';

const VALID_MATCH_PHASES: ReadonlySet<MatchPhase> = new Set([
  'Grupos',
  'Octavos',
  'Cuartos',
  'Semifinal',
  'Tercer Lugar',
  'Final',
]);

const VALID_MATCH_STATUSES: ReadonlySet<MatchStatus> = new Set([
  'PROGRAMADO',
  'EN_VIVO',
  'FINALIZADO',
]);

const VALID_TOURNAMENT_STAGES: ReadonlySet<TournamentStage> = new Set([
  'INSCRIPCIONES',
  'FASE_GRUPOS',
  'TRANSFERENCIAS',
  'PLAYOFFS',
]);

const VALID_EVENT_TYPES: ReadonlySet<MatchEvent['type']> = new Set([
  'GOL',
  'ASISTENCIA',
  'AMARILLA',
  'ROJA',
  'PUNTO_1',
  'PUNTO_2',
  'PUNTO_3',
  'REBOTE',
  'FALTA',
  'TIEMPO_MUERTO',
  'PUNTO_VOLEY',
  'ACE',
  'BLOQUEO',
  'SET_GANADO',
  'CAMBIO',
]);

/**
 * Checks whether a value is a plain JS object (object literal or Object.create(null)).
 * Non-plain instances such as Firestore FieldValue (serverTimestamp()), Timestamp, Date, etc.
 * return false so they pass through stripUndefinedDeep untouched.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Recursively strips all `undefined` properties from plain objects and `undefined`
 * items from arrays, while preserving class instances (e.g., Firestore serverTimestamp()
 * FieldValue sentinels and Timestamp objects) untouched.
 * Also guards against NaN / Infinity numbers by replacing them with 0.
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (typeof value === 'number') {
    return (Number.isFinite(value) ? value : 0) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const cleaned: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) continue;
      cleaned[key] = stripUndefinedDeep(entry);
    }
    return cleaned as T;
  }
  return value;
}

/**
 * Safely coerces an unknown numeric value into a finite integer clamped to [min, max].
 * Unlike `Number(x) ?? fallback`, this properly catches NaN, Infinity, null, and undefined.
 */
export function clampSafeInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const num = typeof value === 'number' ? value : value === '' || value === null || value === undefined ? NaN : Number(value);
  if (!Number.isFinite(num)) {
    return Math.max(min, Math.min(max, Math.trunc(fallback)));
  }
  return Math.max(min, Math.min(max, Math.trunc(num)));
}

/**
 * Trims and clamps a string to [minLen, maxLen], returning `fallback` when the trimmed
 * value is shorter than `minLen`.
 */
export function ensureBoundedString(
  value: unknown,
  fallback: string,
  minLen: number,
  maxLen: number
): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  const sliced = raw.slice(0, maxLen);
  if (sliced.length >= minLen) return sliced;
  return fallback.slice(0, maxLen);
}

export function sanitizePlayerStatsRecord(raw: Partial<PlayerStats> | undefined): PlayerStats {
  return {
    partidosJugados: clampSafeInt(raw?.partidosJugados, 0, 200, 0),
    goles: clampSafeInt(raw?.goles, 0, 500, 0),
    asistencias: clampSafeInt(raw?.asistencias, 0, 500, 0),
    tarjetasAmarillas: clampSafeInt(raw?.tarjetasAmarillas, 0, 100, 0),
    tarjetasRojas: clampSafeInt(raw?.tarjetasRojas, 0, 50, 0),
    puntos: clampSafeInt(raw?.puntos, 0, 5000, 0),
    rebotes: clampSafeInt(raw?.rebotes, 0, 2000, 0),
    triples: clampSafeInt(raw?.triples, 0, 1000, 0),
    faltas: clampSafeInt(raw?.faltas, 0, 500, 0),
    aces: clampSafeInt(raw?.aces, 0, 1000, 0),
    bloqueos: clampSafeInt(raw?.bloqueos, 0, 1000, 0),
  };
}

export function sanitizeMatchPeriods(periods: PeriodScore[] | undefined): PeriodScore[] {
  if (!Array.isArray(periods)) return [];
  return periods
    .filter((p): p is PeriodScore => Boolean(p && typeof p === 'object'))
    .slice(0, 10)
    .map((p) => ({
      home: clampSafeInt(p.home, 0, 300, 0),
      away: clampSafeInt(p.away, 0, 300, 0),
    }));
}

export function sanitizeMatchEvent(raw: MatchEvent, index = 0): MatchEvent {
  const safeType: MatchEvent['type'] = VALID_EVENT_TYPES.has(raw.type) ? raw.type : 'GOL';
  const cleaned: MatchEvent = {
    id: ensureBoundedString(raw.id, `ev-${index}`, 1, 128),
    minuteOrPeriod: ensureBoundedString(raw.minuteOrPeriod, '00:00', 1, 40),
    teamId: ensureBoundedString(raw.teamId, 'unknown', 1, 128),
    type: safeType,
    detail: ensureBoundedString(raw.detail, safeType, 1, 240),
  };

  if (typeof raw.playerId === 'string' && raw.playerId.trim().length > 0) {
    cleaned.playerId = raw.playerId.trim().slice(0, 128);
  }
  if (typeof raw.playerName === 'string' && raw.playerName.trim().length > 0) {
    cleaned.playerName = raw.playerName.trim().slice(0, 120);
  }
  if (typeof raw.playerOutId === 'string' && raw.playerOutId.trim().length > 0) {
    cleaned.playerOutId = raw.playerOutId.trim().slice(0, 128);
  }
  if (typeof raw.playerOutName === 'string' && raw.playerOutName.trim().length > 0) {
    cleaned.playerOutName = raw.playerOutName.trim().slice(0, 120);
  }
  if (typeof raw.pointsDelta === 'number' && Number.isFinite(raw.pointsDelta)) {
    cleaned.pointsDelta = clampSafeInt(raw.pointsDelta, 0, 300, 0);
  }
  if (typeof raw.periodIndex === 'number' && Number.isFinite(raw.periodIndex)) {
    cleaned.periodIndex = clampSafeInt(raw.periodIndex, 0, 20, 0);
  }
  if (typeof raw.triggeredSetWin === 'boolean') {
    cleaned.triggeredSetWin = raw.triggeredSetWin;
  }

  return cleaned;
}

export function sanitizeMatchEvents(events: MatchEvent[] | undefined): MatchEvent[] {
  if (!Array.isArray(events)) return [];
  return events
    .filter((e): e is MatchEvent => Boolean(e && typeof e === 'object'))
    .slice(0, 200)
    .map((e, idx) => sanitizeMatchEvent(e, idx));
}

function sanitizeAiScoresheetResult(raw: unknown): AiScoresheetResult | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const confidence =
    obj.confidence === 'alta' || obj.confidence === 'media' || obj.confidence === 'baja'
      ? obj.confidence
      : 'media';

  const detectedEvents = Array.isArray(obj.detectedEvents)
    ? obj.detectedEvents
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim().slice(0, 200))
        .slice(0, 50)
    : [];

  const discrepancies = Array.isArray(obj.discrepancies)
    ? obj.discrepancies
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim().slice(0, 240))
        .slice(0, 25)
    : [];

  return {
    homeScoreDetected: clampSafeInt(obj.homeScoreDetected, 0, 300, 0),
    awayScoreDetected: clampSafeInt(obj.awayScoreDetected, 0, 300, 0),
    periodBreakdown: sanitizeMatchPeriods(obj.periodBreakdown as PeriodScore[] | undefined),
    detectedEvents,
    confidence,
    discrepancies,
    requiresManualReview: Boolean(obj.requiresManualReview),
    summary: ensureBoundedString(obj.summary, 'Validación registrada', 1, 600),
  };
}

export function sanitizeScoresheetValidation(
  raw: ScoresheetValidationRecord | undefined
): ScoresheetValidationRecord | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const method: ScoresheetValidationRecord['method'] =
    raw.method === 'IA_AUTOMATICA' ? 'IA_AUTOMATICA' : 'MANUAL_ARBITRO';

  const out: ScoresheetValidationRecord = {
    validatedAt: ensureBoundedString(raw.validatedAt, new Date().toISOString(), 8, 64),
    refereeName: ensureBoundedString(raw.refereeName, 'Árbitro Oficial UFRO', 1, 120),
    method,
    finalHomeScore: clampSafeInt(raw.finalHomeScore, 0, 300, 0),
    finalAwayScore: clampSafeInt(raw.finalAwayScore, 0, 300, 0),
  };

  // Cap data-URL preview so the match document stays safely well under Firestore's 1MB limit
  if (typeof raw.imagePreview === 'string' && raw.imagePreview.trim().length > 0) {
    const trimmedPreview = raw.imagePreview.trim();
    if (trimmedPreview.length <= 160000) {
      out.imagePreview = trimmedPreview;
    }
  }

  const sanitizedAi = sanitizeAiScoresheetResult(raw.aiResult);
  if (sanitizedAi) {
    out.aiResult = sanitizedAi;
  }

  if (typeof raw.manualNotes === 'string' && raw.manualNotes.trim().length > 0) {
    out.manualNotes = raw.manualNotes.trim().slice(0, 500);
  }

  return out;
}

export function sanitizeMatchLiveStateRecord(raw: unknown): Match['liveState'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const rawOnCourt = (obj.onCourt && typeof obj.onCourt === 'object' ? obj.onCourt : {}) as Record<
    string,
    unknown
  >;
  const sanitizeIdArr = (val: unknown): string[] =>
    Array.isArray(val)
      ? Array.from(
          new Set(
            val
              .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
              .map((item) => item.trim().slice(0, 128))
          )
        ).slice(0, 15)
      : [];
  const sanitizeCountMap = (val: unknown): { home: number; away: number } | undefined => {
    if (!val || typeof val !== 'object') return undefined;
    const m = val as Record<string, unknown>;
    return {
      home: clampSafeInt(m.home, 0, 200, 0),
      away: clampSafeInt(m.away, 0, 200, 0),
    };
  };

  const out: NonNullable<Match['liveState']> = {
    onCourt: {
      home: sanitizeIdArr(rawOnCourt.home),
      away: sanitizeIdArr(rawOnCourt.away),
    },
  };

  if (obj.excludedPlayerIds && typeof obj.excludedPlayerIds === 'object') {
    const rawEx = obj.excludedPlayerIds as Record<string, unknown>;
    out.excludedPlayerIds = {
      home: sanitizeIdArr(rawEx.home),
      away: sanitizeIdArr(rawEx.away),
    };
  }
  const pf = sanitizeCountMap(obj.periodFouls);
  if (pf) out.periodFouls = pf;
  if (obj.servingSide === 'home' || obj.servingSide === 'away') {
    out.servingSide = obj.servingSide;
  }
  const sc = sanitizeCountMap(obj.substitutionsCount);
  if (sc) out.substitutionsCount = sc;
  if (typeof obj.clockSeconds === 'number' && Number.isFinite(obj.clockSeconds)) {
    out.clockSeconds = clampSafeInt(obj.clockSeconds, 0, 7200, 0);
  }
  if (typeof obj.stoppageMinutes === 'number' && Number.isFinite(obj.stoppageMinutes)) {
    out.stoppageMinutes = clampSafeInt(obj.stoppageMinutes, 0, 30, 0);
  }

  return out;
}

export function sanitizeMatchAttendanceRecord(raw: unknown): Match['attendance'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const status =
    obj.status === 'REGISTRADA' || obj.status === 'OMITIDA' || obj.status === 'NO_REGISTRADA'
      ? obj.status
      : 'NO_REGISTRADA';

  const sanitizeAttendanceList = (val: unknown): string[] =>
    Array.isArray(val)
      ? Array.from(
          new Set(
            val
              .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
              .map((item) => item.trim().slice(0, 128))
          )
        ).slice(0, 40)
      : [];

  const out: NonNullable<Match['attendance']> = {
    status,
    homePresentIds: status === 'OMITIDA' ? [] : sanitizeAttendanceList(obj.homePresentIds),
    awayPresentIds: status === 'OMITIDA' ? [] : sanitizeAttendanceList(obj.awayPresentIds),
  };

  if (typeof obj.recordedAt === 'string' && obj.recordedAt.trim().length > 0) {
    out.recordedAt = obj.recordedAt.trim().slice(0, 64);
  }
  if (typeof obj.recordedByName === 'string' && obj.recordedByName.trim().length > 0) {
    out.recordedByName = obj.recordedByName.trim().slice(0, 120);
  }
  if (typeof obj.notes === 'string' && obj.notes.trim().length > 0) {
    out.notes = obj.notes.trim().slice(0, 240);
  }

  return out;
}

/**
 * Produces a Firestore-safe, rules-compliant payload (without serverTimestamp sentinels)
 * for creating or updating a match document.
 */
export function buildSanitizedMatchPayload(
  match: Match,
  isNew: boolean,
  actorRole: UserRole
): Record<string, unknown> {
  const safeGroupName = ensureBoundedString(match.groupName, 'Grupo A', 1, 40);
  const safeFase: MatchPhase = VALID_MATCH_PHASES.has(match.fase) ? match.fase : 'Grupos';
  const safeStatus: MatchStatus = VALID_MATCH_STATUSES.has(match.status) ? match.status : 'PROGRAMADO';
  const safeJornada = clampSafeInt(match.jornada, 1, 50, 1);
  const safeFecha = ensureBoundedString(match.fecha, new Date().toISOString().slice(0, 10), 8, 20);
  const safeHora = ensureBoundedString(match.hora, '18:00', 4, 12);
  const safeCancha = ensureBoundedString(match.cancha, 'Campus UFRO', 2, 120);
  const safeHomeScore = clampSafeInt(match.homeScore, 0, 300, 0);
  const safeAwayScore = clampSafeInt(match.awayScore, 0, 300, 0);
  const safePeriodLabel = ensureBoundedString(match.periodLabel, 'Programado', 0, 60);
  const safeClock = ensureBoundedString(match.clock, 'Por iniciar', 0, 24);
  const safePeriods = sanitizeMatchPeriods(match.periods);
  const safeFouls = {
    home: clampSafeInt(match.fouls?.home, 0, 200, 0),
    away: clampSafeInt(match.fouls?.away, 0, 200, 0),
  };
  const safeTimeouts = {
    home: clampSafeInt(match.timeouts?.home, 0, 50, 0),
    away: clampSafeInt(match.timeouts?.away, 0, 50, 0),
  };
  const safeEvents = sanitizeMatchEvents(match.events);
  const safeLiveState = sanitizeMatchLiveStateRecord(match.liveState);
  const safeAttendance = sanitizeMatchAttendanceRecord(match.attendance);
  const safeScoresheetValidation = sanitizeScoresheetValidation(match.scoresheetValidation);
  const safeRefereeId = typeof match.refereeId === 'string' ? match.refereeId.trim().slice(0, 128) : '';

  if (isNew) {
    const payload: Record<string, unknown> = {
      id: match.id,
      disciplineId: match.disciplineId,
      groupName: safeGroupName,
      fase: safeFase,
      jornada: safeJornada,
      fecha: safeFecha,
      hora: safeHora,
      cancha: safeCancha,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeScore: safeHomeScore,
      awayScore: safeAwayScore,
      status: safeStatus,
      periodLabel: safePeriodLabel,
      clock: safeClock,
      periods: safePeriods,
      fouls: safeFouls,
      timeouts: safeTimeouts,
      events: safeEvents,
      refereeId: safeRefereeId,
    };
    if (safeLiveState) {
      payload.liveState = safeLiveState;
    }
    if (safeAttendance) {
      payload.attendance = safeAttendance;
    }
    if (
      match.playoffLeg === 'IDA' ||
      match.playoffLeg === 'VUELTA' ||
      match.playoffLeg === 'UNICO'
    ) {
      payload.playoffLeg = match.playoffLeg;
    }
    if (safeScoresheetValidation) {
      payload.scoresheetValidation = safeScoresheetValidation;
    }
    return stripUndefinedDeep(payload);
  }

  const updatePayload: Record<string, unknown> = {
    homeScore: safeHomeScore,
    awayScore: safeAwayScore,
    status: safeStatus,
    periodLabel: safePeriodLabel,
    clock: safeClock,
    periods: safePeriods,
    fouls: safeFouls,
    timeouts: safeTimeouts,
    events: safeEvents,
  };
  if (safeLiveState) {
    updatePayload.liveState = safeLiveState;
  }
  if (safeAttendance) {
    updatePayload.attendance = safeAttendance;
  }
  if (safeScoresheetValidation) {
    updatePayload.scoresheetValidation = safeScoresheetValidation;
  }
  if (actorRole === 'admin') {
    updatePayload.groupName = safeGroupName;
    updatePayload.fase = safeFase;
    if (
      match.playoffLeg === 'IDA' ||
      match.playoffLeg === 'VUELTA' ||
      match.playoffLeg === 'UNICO'
    ) {
      updatePayload.playoffLeg = match.playoffLeg;
    }
    updatePayload.jornada = safeJornada;
    updatePayload.fecha = safeFecha;
    updatePayload.hora = safeHora;
    updatePayload.cancha = safeCancha;
    updatePayload.homeTeamId = match.homeTeamId;
    updatePayload.awayTeamId = match.awayTeamId;
    updatePayload.refereeId = safeRefereeId;
  }
  return stripUndefinedDeep(updatePayload);
}

/**
 * Produces a Firestore-safe, rules-compliant payload (without serverTimestamp sentinels)
 * for creating or updating a public player document.
 */
export function buildSanitizedPlayerPayload(
  player: Player,
  isNew: boolean,
  actorRole: UserRole
): Record<string, unknown> {
  const safeDorsal = clampSafeInt(player.dorsal, 0, 99, 0);
  const safePosicion = ensureBoundedString(player.posicion, 'Jugador', 1, 60);
  const safeNombre = ensureBoundedString(player.nombre, 'Jugador', 1, 80);
  const safeApellidoPaterno = ensureBoundedString(player.apellidoPaterno, '-', 1, 80);
  const safeApellidoMaterno = ensureBoundedString(player.apellidoMaterno, '-', 1, 80);
  const safeCarrera = ensureBoundedString(player.carrera, 'Carrera UFRO', 2, 140);
  const safeFacultad = ensureBoundedString(
    player.facultad,
    'Universidad de La Frontera',
    2,
    140
  );
  const safeNivel: AcademicLevel =
    player.nivelAcademico === 'Postgrado' ? 'Postgrado' : 'Pregrado';
  const safeFoto =
    typeof player.fotografia === 'string' && player.fotografia.length <= 159000
      ? player.fotografia
      : '';
  const safeStats = sanitizePlayerStatsRecord(player.stats);

  if (isNew) {
    return stripUndefinedDeep({
      id: player.id,
      teamId: player.teamId,
      disciplineId: player.disciplineId,
      dorsal: safeDorsal,
      posicion: safePosicion,
      nombre: safeNombre,
      apellidoPaterno: safeApellidoPaterno,
      apellidoMaterno: safeApellidoMaterno,
      carrera: safeCarrera,
      facultad: safeFacultad,
      nivelAcademico: safeNivel,
      fotografia: safeFoto,
      esSeleccionadoUfro: Boolean(player.esSeleccionadoUfro),
      stats: safeStats,
    });
  }

  const pubUpdate: Record<string, unknown> = {
    dorsal: safeDorsal,
    posicion: safePosicion,
    nombre: safeNombre,
    apellidoPaterno: safeApellidoPaterno,
    apellidoMaterno: safeApellidoMaterno,
    carrera: safeCarrera,
    facultad: safeFacultad,
    nivelAcademico: safeNivel,
    fotografia: safeFoto,
  };
  if (actorRole === 'admin' || actorRole === 'delegado') {
    pubUpdate.esSeleccionadoUfro = Boolean(player.esSeleccionadoUfro);
  }
  if (actorRole === 'admin') {
    pubUpdate.teamId = player.teamId;
    pubUpdate.stats = safeStats;
  }
  return stripUndefinedDeep(pubUpdate);
}

/**
 * Produces a Firestore-safe, rules-compliant payload (without serverTimestamp sentinels)
 * for creating or updating a discipline config document.
 */
export function buildSanitizedDisciplineConfigPayload(
  config: DisciplineFormatConfig
): Record<string, unknown> {
  const safeFormato =
    config.formatoPlayoff === 4 || config.formatoPlayoff === 8 || config.formatoPlayoff === 16
      ? config.formatoPlayoff
      : 8;
  const safeFase: TournamentStage = VALID_TOURNAMENT_STAGES.has(config.faseActual)
    ? config.faseActual
    : 'INSCRIPCIONES';

  return stripUndefinedDeep({
    disciplineId: config.disciplineId,
    temporada: ensureBoundedString(config.temporada, '2026', 4, 16),
    maxCupos: clampSafeInt(config.maxCupos, 2, 128, 16),
    numGrupos: clampSafeInt(config.numGrupos, 1, 16, 4),
    clasificadosPorGrupo: clampSafeInt(config.clasificadosPorGrupo, 1, 8, 2),
    formatoPlayoff: safeFormato,
    incluyeTercerLugar: config.incluyeTercerLugar !== false,
    playoffsIdaYVuelta: Boolean(config.playoffsIdaYVuelta),
    inscripcionesAbiertas: Boolean(config.inscripcionesAbiertas),
    transferenciasAbiertas: Boolean(config.transferenciasAbiertas),
    maxTransferenciasPorEquipo: clampSafeInt(config.maxTransferenciasPorEquipo, 0, 10, 2),
    faseActual: safeFase,
  });
}

/**
 * Produces a Firestore-safe, rules-compliant payload (without serverTimestamp sentinels)
 * for creating or updating a team document.
 */
export function buildSanitizedTeamPayload(
  team: Team,
  actorUid: string,
  isNew: boolean,
  actorRole?: UserRole
): Record<string, unknown> {
  const rawNombre = (team.nombre || '').trim().slice(0, 120);
  const nombre = rawNombre.length >= 2 ? rawNombre : rawNombre.padEnd(2, 'X');
  const rawSigla = (team.sigla || '').trim().toUpperCase().slice(0, 8);
  const sigla =
    rawSigla.length >= 2 ? rawSigla : nombre.slice(0, 3).toUpperCase().padEnd(2, 'X');
  const carrera = ensureBoundedString(team.carrera, 'Carrera UFRO', 2, 140);
  const facultad = ensureBoundedString(team.facultad, 'Universidad de La Frontera', 2, 140);
  const groupName = ensureBoundedString(team.groupName, 'Grupo A', 1, 40);

  const validYear =
    typeof team.anioFundacion === 'number' &&
    Number.isFinite(team.anioFundacion) &&
    Math.trunc(team.anioFundacion) >= 1950 &&
    Math.trunc(team.anioFundacion) <= 2035
      ? Math.trunc(team.anioFundacion)
      : undefined;

  if (isNew) {
    const payload: Record<string, unknown> = {
      id: team.id,
      nombre,
      sigla,
      disciplineId: team.disciplineId,
      carrera,
      facultad,
      groupName,
      createdByUid: actorUid,
    };
    if (typeof team.escudo === 'string' && team.escudo.length > 0 && team.escudo.length <= 160000) {
      payload.escudo = team.escudo;
    }
    if (validYear !== undefined) {
      payload.anioFundacion = validYear;
    }
    if (typeof team.logrosAnteriores === 'string' && team.logrosAnteriores.trim().length > 0) {
      payload.logrosAnteriores = team.logrosAnteriores.trim().slice(0, 160);
    }
    return stripUndefinedDeep(payload);
  }

  const updatePayload: Record<string, unknown> = {
    nombre,
    sigla,
  };
  if (actorRole !== 'delegado') {
    updatePayload.carrera = carrera;
    updatePayload.facultad = facultad;
    updatePayload.groupName = groupName;
  }
  if (typeof team.escudo === 'string' && team.escudo.length <= 160000) {
    updatePayload.escudo = team.escudo;
  }
  if (validYear !== undefined) {
    updatePayload.anioFundacion = validYear;
  }
  if (typeof team.logrosAnteriores === 'string') {
    updatePayload.logrosAnteriores = team.logrosAnteriores.trim().slice(0, 160);
  }
  return stripUndefinedDeep(updatePayload);
}
