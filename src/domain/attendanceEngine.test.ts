import test from 'node:test';
import assert from 'node:assert/strict';
import type { Match, Player } from '../types/tournament';
import {
  MAX_ATTENDANCE_PLAYERS_PER_TEAM,
  computeMatchesAttendanceOverview,
  computePlayerAttendanceSummary,
  getNormalizedMatchAttendance,
  markMatchAttendanceOmitted,
  resumeMatchAttendance,
  selectStartersWithAttendance,
  setTeamAttendanceAll,
  syncOnCourtPlayersIntoAttendance,
  togglePlayerAttendance,
} from './attendanceEngine';

function createMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    disciplineId: 'f7-h-1',
    groupName: 'Grupo A',
    fase: 'Grupos',
    jornada: 1,
    fecha: '2026-05-10',
    hora: '16:00',
    cancha: 'Cancha 1 UFRO',
    homeTeamId: 'team-home',
    awayTeamId: 'team-away',
    homeScore: 0,
    awayScore: 0,
    status: 'PROGRAMADO',
    periodLabel: 'Programado',
    clock: 'Por iniciar',
    periods: [],
    fouls: { home: 0, away: 0 },
    timeouts: { home: 0, away: 0 },
    events: [],
    refereeId: 'ref-1',
    ...overrides,
  };
}

function createPlayer(id: string, teamId: string, dorsal: number): Player {
  return {
    id,
    teamId,
    disciplineId: 'f7-h-1',
    dorsal,
    posicion: 'Mediocampista',
    nombre: `Jugador${dorsal}`,
    apellidoPaterno: 'UFRO',
    apellidoMaterno: 'Test',
    carrera: 'Ingeniería',
    facultad: 'FICA',
    rut: '20.111.222-3',
    numeroMatricula: `2026${dorsal}`,
    correoInstitucional: `j${dorsal}@ufromail.cl`,
    nivelAcademico: 'Pregrado',
    fechaNacimiento: '2003-01-01',
    fotografia: '',
    esSeleccionadoUfro: false,
    stats: {
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
    },
  };
}

test('getNormalizedMatchAttendance returns NO_REGISTRADA default when absent', () => {
  const m = createMatch();
  const att = getNormalizedMatchAttendance(m);
  assert.equal(att.status, 'NO_REGISTRADA');
  assert.deepEqual(att.homePresentIds, []);
  assert.deepEqual(att.awayPresentIds, []);
});

test('togglePlayerAttendance marks player present, sets REGISTRADA, and toggles off cleanly', () => {
  const m0 = createMatch();
  const m1 = togglePlayerAttendance({
    match: m0,
    side: 'home',
    playerId: 'p-1',
    recorderName: 'Árbitro Central',
    nowIso: '2026-05-10T16:00:00.000Z',
  });
  assert.equal(m1.attendance?.status, 'REGISTRADA');
  assert.deepEqual(m1.attendance?.homePresentIds, ['p-1']);
  assert.deepEqual(m1.attendance?.awayPresentIds, []);
  assert.equal(m1.attendance?.recordedByName, 'Árbitro Central');
  assert.equal(m1.attendance?.recordedAt, '2026-05-10T16:00:00.000Z');

  const m2 = togglePlayerAttendance({
    match: m1,
    side: 'away',
    playerId: 'p-9',
    nowIso: '2026-05-10T16:01:00.000Z',
  });
  assert.deepEqual(m2.attendance?.homePresentIds, ['p-1']);
  assert.deepEqual(m2.attendance?.awayPresentIds, ['p-9']);

  const m3 = togglePlayerAttendance({
    match: m2,
    side: 'home',
    playerId: 'p-1',
    nowIso: '2026-05-10T16:02:00.000Z',
  });
  assert.deepEqual(m3.attendance?.homePresentIds, []);
  assert.deepEqual(m3.attendance?.awayPresentIds, ['p-9']);
  assert.equal(m3.attendance?.status, 'REGISTRADA');
});

test('setTeamAttendanceAll deduplicates, enforces 40-player Firestore cap, and clears cleanly', () => {
  const manyIds = Array.from({ length: 55 }, (_, idx) => `p-${idx}`);
  manyIds.push('p-0', 'p-1', '  ');

  const m1 = setTeamAttendanceAll({
    match: createMatch(),
    side: 'home',
    rosterPlayerIds: manyIds,
    present: true,
    recorderName: 'Mesa Técnica',
  });
  assert.equal(m1.attendance?.status, 'REGISTRADA');
  assert.equal(m1.attendance?.homePresentIds.length, MAX_ATTENDANCE_PLAYERS_PER_TEAM);
  assert.equal(m1.attendance?.homePresentIds[0], 'p-0');

  const m2 = setTeamAttendanceAll({
    match: m1,
    side: 'home',
    rosterPlayerIds: manyIds,
    present: false,
  });
  assert.deepEqual(m2.attendance?.homePresentIds, []);
  assert.equal(m2.attendance?.status, 'REGISTRADA');
});

test('markMatchAttendanceOmitted sets OMITIDA, clears present lists, and resumeMatchAttendance re-enables', () => {
  const m1 = setTeamAttendanceAll({
    match: createMatch(),
    side: 'home',
    rosterPlayerIds: ['p-1', 'p-2'],
    present: true,
  });
  const omitted = markMatchAttendanceOmitted({
    match: m1,
    recorderName: 'Árbitro 1',
    notes: 'Partido iniciado con retraso',
    nowIso: '2026-05-10T16:05:00.000Z',
  });
  assert.equal(omitted.attendance?.status, 'OMITIDA');
  assert.deepEqual(omitted.attendance?.homePresentIds, []);
  assert.deepEqual(omitted.attendance?.awayPresentIds, []);
  assert.equal(omitted.attendance?.notes, 'Partido iniciado con retraso');

  const resumed = resumeMatchAttendance({
    match: omitted,
    recorderName: 'Árbitro 1',
  });
  assert.equal(resumed.attendance?.status, 'REGISTRADA');
  assert.deepEqual(resumed.attendance?.homePresentIds, []);
});

test('selectStartersWithAttendance prioritizes present players when attendance is REGISTRADA and falls back when OMITIDA', () => {
  const roster = Array.from({ length: 10 }, (_, i) => createPlayer(`p-${i + 1}`, 'team-home', i + 1));

  // Mark only dorsals 4..10 as present (7 players)
  const withAttendance = setTeamAttendanceAll({
    match: createMatch(),
    side: 'home',
    rosterPlayerIds: ['p-4', 'p-5', 'p-6', 'p-7', 'p-8', 'p-9', 'p-10'],
    present: true,
  });

  const startersFromPresent = selectStartersWithAttendance({
    roster,
    match: withAttendance,
    side: 'home',
    sportType: 'futbol7',
  });
  assert.deepEqual(startersFromPresent, ['p-4', 'p-5', 'p-6', 'p-7', 'p-8', 'p-9', 'p-10']);

  // When omitted, falls back to first 7 dorsals from full roster
  const omitted = markMatchAttendanceOmitted({ match: withAttendance });
  const startersFallback = selectStartersWithAttendance({
    roster,
    match: omitted,
    side: 'home',
    sportType: 'futbol7',
  });
  assert.deepEqual(startersFallback, ['p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6', 'p-7']);
});

test('syncOnCourtPlayersIntoAttendance merges on-court IDs without duplicating existing present players', () => {
  const m1 = setTeamAttendanceAll({
    match: createMatch(),
    side: 'home',
    rosterPlayerIds: ['p-1', 'p-2'],
    present: true,
  });
  const synced = syncOnCourtPlayersIntoAttendance({
    match: m1,
    side: 'home',
    onCourtIds: ['p-2', 'p-3', 'p-4'],
  });
  assert.deepEqual(synced.attendance?.homePresentIds, ['p-1', 'p-2', 'p-3', 'p-4']);
});

test('computePlayerAttendanceSummary excludes omitted and unregistered matches from attendanceRate denominator', () => {
  const mRegisteredPresent = createMatch({
    id: 'm1',
    jornada: 1,
    fecha: '2026-05-01',
    attendance: {
      status: 'REGISTRADA',
      homePresentIds: ['p-1', 'p-2'],
      awayPresentIds: ['a-1'],
    },
  });
  const mRegisteredAbsent = createMatch({
    id: 'm2',
    jornada: 2,
    fecha: '2026-05-08',
    homeTeamId: 'team-other',
    awayTeamId: 'team-home',
    attendance: {
      status: 'REGISTRADA',
      homePresentIds: ['o-1'],
      awayPresentIds: ['p-2'],
    },
  });
  const mOmitted = createMatch({
    id: 'm3',
    jornada: 3,
    fecha: '2026-05-15',
    attendance: {
      status: 'OMITIDA',
      homePresentIds: [],
      awayPresentIds: [],
    },
  });
  const mUnregistered = createMatch({
    id: 'm4',
    jornada: 4,
    fecha: '2026-05-22',
  });

  const summary = computePlayerAttendanceSummary(
    [mRegisteredPresent, mRegisteredAbsent, mOmitted, mUnregistered],
    'p-1',
    'team-home'
  );
  assert.equal(summary.attendedMatches, 1);
  assert.equal(summary.registeredTeamMatches, 2);
  assert.equal(summary.omittedTeamMatches, 1);
  assert.equal(summary.attendanceRate, 50);
  assert.equal(summary.history.length, 2);
  assert.equal(summary.history[0].matchId, 'm2');
  assert.equal(summary.history[0].present, false);
  assert.equal(summary.history[1].matchId, 'm1');
  assert.equal(summary.history[1].present, true);

  const overview = computeMatchesAttendanceOverview([
    mRegisteredPresent,
    mRegisteredAbsent,
    mOmitted,
    mUnregistered,
  ]);
  assert.deepEqual(overview, {
    totalMatches: 4,
    registeredCount: 2,
    omittedCount: 1,
    unregisteredCount: 1,
  });
});
