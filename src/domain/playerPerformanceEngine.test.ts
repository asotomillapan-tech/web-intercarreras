import test from 'node:test';
import assert from 'node:assert/strict';
import type { Match, Player, Team } from '../types/tournament';
import { computePlayerSeasonPerformance } from './playerPerformanceEngine';

function createPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p-1',
    teamId: 't-1',
    disciplineId: 'f7-h-1',
    dorsal: 10,
    posicion: 'Delantero',
    nombre: 'Ignacio',
    apellidoPaterno: 'Torres',
    apellidoMaterno: 'Pérez',
    carrera: 'Ingeniería Civil Mecánica',
    facultad: 'FICA',
    rut: '',
    numeroMatricula: '',
    correoInstitucional: '',
    nivelAcademico: 'Pregrado',
    fechaNacimiento: '',
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
    ...overrides,
  };
}

function createMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm-1',
    disciplineId: 'f7-h-1',
    groupName: 'Grupo A',
    fase: 'Grupos',
    jornada: 1,
    fecha: '2026-09-10',
    hora: '15:00',
    cancha: 'Cancha 1',
    homeTeamId: 't-1',
    awayTeamId: 't-2',
    homeScore: 2,
    awayScore: 1,
    status: 'FINALIZADO',
    periodLabel: 'Finalizado',
    clock: '50:00',
    periods: [],
    fouls: { home: 0, away: 0 },
    timeouts: { home: 0, away: 0 },
    events: [],
    refereeId: 'ref-1',
    ...overrides,
  };
}

const teamLookup = new Map<string, Pick<Team, 'nombre' | 'sigla'>>([
  ['t-1', { nombre: 'Club Atlético Kineiro', sigla: 'CAK' }],
  ['t-2', { nombre: 'Industrial Gunners', sigla: 'IND' }],
  ['t-3', { nombre: 'Real Efineza FC', sigla: 'REF' }],
  ['t-4', { nombre: 'West hambiental', sigla: 'WHA' }],
]);

test('computePlayerSeasonPerformance aggregates exact Fútbol 7 events chronologically with cumulative totals', () => {
  const player = createPlayer({
    stats: {
      ...createPlayer().stats,
      partidosJugados: 2,
      goles: 3,
      asistencias: 2,
      tarjetasAmarillas: 1,
      tarjetasRojas: 1,
    },
  });

  const m2 = createMatch({
    id: 'm-2',
    fase: 'Cuartos',
    jornada: 5,
    fecha: '2026-10-05',
    homeTeamId: 't-3',
    awayTeamId: 't-1',
    homeScore: 1,
    awayScore: 2,
    events: [
      { id: 'e4', minuteOrPeriod: '12\'', teamId: 't-1', playerId: 'p-1', type: 'GOL', detail: 'Gol' },
      { id: 'e5', minuteOrPeriod: '30\'', teamId: 't-1', playerId: 'p-1', type: 'ASISTENCIA', detail: 'Asist' },
      { id: 'e6', minuteOrPeriod: '44\'', teamId: 't-1', playerId: 'p-1', type: 'ROJA', detail: 'Expulsión' },
    ],
  });

  const m1 = createMatch({
    id: 'm-1',
    fase: 'Grupos',
    jornada: 1,
    fecha: '2026-09-10',
    homeTeamId: 't-1',
    awayTeamId: 't-2',
    homeScore: 3,
    awayScore: 1,
    events: [
      { id: 'e1', minuteOrPeriod: '10\'', teamId: 't-1', playerId: 'p-1', type: 'GOL', detail: 'Gol 1' },
      { id: 'e2', minuteOrPeriod: '22\'', teamId: 't-1', playerId: 'p-1', type: 'GOL', detail: 'Gol 2' },
      { id: 'e3', minuteOrPeriod: '28\'', teamId: 't-1', playerId: 'p-1', type: 'ASISTENCIA', detail: 'Asist' },
      { id: 'e7', minuteOrPeriod: '35\'', teamId: 't-1', playerId: 'p-1', type: 'AMARILLA', detail: 'TA' },
      // Other player event should be ignored
      { id: 'e8', minuteOrPeriod: '40\'', teamId: 't-1', playerId: 'p-other', type: 'GOL', detail: 'Otro' },
    ],
  });

  const scheduled = createMatch({
    id: 'm-3',
    status: 'PROGRAMADO',
    fecha: '2026-10-12',
  });

  const summary = computePlayerSeasonPerformance(player, [m2, scheduled, m1], 'futbol7', teamLookup);

  assert.equal(summary.source, 'eventos_partido');
  assert.equal(summary.matchesCount, 2);
  assert.deepEqual(
    summary.points.map((p) => p.label),
    ['F1', '4tos']
  );

  // Match 1
  assert.equal(summary.points[0].goles, 2);
  assert.equal(summary.points[0].asistencias, 1);
  assert.equal(summary.points[0].tarjetasAmarillas, 1);
  assert.equal(summary.points[0].tarjetasRojas, 0);
  assert.equal(summary.points[0].tarjetas, 1);
  assert.equal(summary.points[0].opponentName, 'Industrial Gunners');

  // Match 2 cumulative
  assert.equal(summary.points[1].goles, 1);
  assert.equal(summary.points[1].tarjetasRojas, 1);
  assert.equal(summary.points[1].acumuladoGoles, 3);
  assert.equal(summary.points[1].acumuladoAsistencias, 2);
  assert.equal(summary.points[1].acumuladoTarjetasAmarillas, 1);
  assert.equal(summary.points[1].acumuladoTarjetasRojas, 1);
  assert.equal(summary.points[1].acumuladoTarjetas, 2);
  assert.equal(summary.bestMatch?.label, 'F1');
  assert.equal(summary.bestMatch?.primaryValue, 2);
});

test('computePlayerSeasonPerformance preserves exact official totals for historical Sheets matches without event logs', () => {
  const player = createPlayer({
    stats: {
      ...createPlayer().stats,
      partidosJugados: 3,
      goles: 7,
      asistencias: 3,
      tarjetasAmarillas: 2,
      tarjetasRojas: 1,
    },
  });

  const matches = [
    createMatch({ id: 'm-1', jornada: 1, fecha: '2026-09-01', homeScore: 4, awayScore: 1, events: [] }),
    createMatch({ id: 'm-2', jornada: 2, fecha: '2026-09-08', homeScore: 0, awayScore: 2, events: [] }),
    createMatch({ id: 'm-3', jornada: 3, fecha: '2026-09-15', homeScore: 3, awayScore: 2, events: [] }),
  ];

  const summary = computePlayerSeasonPerformance(player, matches, 'futbol7', teamLookup);

  assert.equal(summary.source, 'resumen_planilla');
  assert.equal(summary.matchesCount, 3);
  assert.equal(summary.totals.goles, 7);
  assert.equal(summary.totals.asistencias, 3);
  assert.equal(summary.totals.tarjetasAmarillas, 2);
  assert.equal(summary.totals.tarjetasRojas, 1);
  assert.equal(summary.totals.tarjetas, 3);

  // Match 2 had 0 team goals, so score-anchored soft caps place 0 goals there!
  assert.equal(summary.points[1].goles, 0);
  // Final cumulative point equals exact official season totals
  const last = summary.points[summary.points.length - 1];
  assert.equal(last.acumuladoGoles, 7);
  assert.equal(last.acumuladoAsistencias, 3);
  assert.equal(last.acumuladoTarjetas, 3);
});

test('computePlayerSeasonPerformance handles Basketball and Volleyball event types accurately', () => {
  const bPlayer = createPlayer({
    id: 'pb-1',
    disciplineId: 'basquet-h',
    stats: { ...createPlayer().stats, partidosJugados: 1, puntos: 8, rebotes: 2, triples: 1, faltas: 3 },
  });
  const bMatch = createMatch({
    id: 'mb-1',
    disciplineId: 'basquet-h',
    homeScore: 60,
    awayScore: 52,
    events: [
      { id: 'b1', minuteOrPeriod: 'Q1', teamId: 't-1', playerId: 'pb-1', type: 'PUNTO_3', detail: 'Triple' },
      { id: 'b2', minuteOrPeriod: 'Q2', teamId: 't-1', playerId: 'pb-1', type: 'PUNTO_2', detail: 'Doble' },
      { id: 'b3', minuteOrPeriod: 'Q2', teamId: 't-1', playerId: 'pb-1', type: 'PUNTO_2', detail: 'Doble' },
      { id: 'b4', minuteOrPeriod: 'Q3', teamId: 't-1', playerId: 'pb-1', type: 'PUNTO_1', detail: 'Libre' },
      { id: 'b5', minuteOrPeriod: 'Q3', teamId: 't-1', playerId: 'pb-1', type: 'REBOTE', detail: 'Rebote' },
      { id: 'b6', minuteOrPeriod: 'Q4', teamId: 't-1', playerId: 'pb-1', type: 'REBOTE', detail: 'Rebote' },
      { id: 'b7', minuteOrPeriod: 'Q4', teamId: 't-1', playerId: 'pb-1', type: 'FALTA', detail: 'Falta' },
      { id: 'b8', minuteOrPeriod: 'Q4', teamId: 't-1', playerId: 'pb-1', type: 'FALTA', detail: 'Falta' },
      { id: 'b9', minuteOrPeriod: 'Q4', teamId: 't-1', playerId: 'pb-1', type: 'FALTA', detail: 'Falta' },
    ],
  });

  const bSummary = computePlayerSeasonPerformance(bPlayer, [bMatch], 'basquetbol', teamLookup);
  assert.equal(bSummary.source, 'eventos_partido');
  assert.equal(bSummary.totals.puntos, 8);
  assert.equal(bSummary.totals.triples, 1);
  assert.equal(bSummary.totals.rebotes, 2);
  assert.equal(bSummary.totals.faltas, 3);

  const vPlayer = createPlayer({
    id: 'pv-1',
    disciplineId: 'voley-h',
    stats: { ...createPlayer().stats, partidosJugados: 1, puntos: 3, aces: 1, bloqueos: 1 },
  });
  const vMatch = createMatch({
    id: 'mv-1',
    disciplineId: 'voley-h',
    homeScore: 2,
    awayScore: 1,
    events: [
      { id: 'v1', minuteOrPeriod: 'Set 1', teamId: 't-1', playerId: 'pv-1', type: 'PUNTO_VOLEY', detail: 'Remate' },
      { id: 'v2', minuteOrPeriod: 'Set 1', teamId: 't-1', playerId: 'pv-1', type: 'ACE', detail: 'Ace' },
      { id: 'v3', minuteOrPeriod: 'Set 2', teamId: 't-1', playerId: 'pv-1', type: 'BLOQUEO', detail: 'Bloqueo' },
    ],
  });

  const vSummary = computePlayerSeasonPerformance(vPlayer, [vMatch], 'voleibol', teamLookup);
  assert.equal(vSummary.source, 'eventos_partido');
  assert.equal(vSummary.totals.puntos, 3);
  assert.equal(vSummary.totals.aces, 1);
  assert.equal(vSummary.totals.bloqueos, 1);
});

test('computePlayerSeasonPerformance returns sin_datos when player has no matches and zero stats', () => {
  const emptyPlayer = createPlayer();
  const summary = computePlayerSeasonPerformance(emptyPlayer, [], 'futbol7', teamLookup);

  assert.equal(summary.source, 'sin_datos');
  assert.equal(summary.matchesCount, 0);
  assert.equal(summary.points.length, 0);
  assert.equal(summary.bestMatch, null);
});

test('computePlayerSeasonPerformance sorts Grupos before Playoffs and disambiguates duplicate jornadas and two-legged ties', () => {
  const player = createPlayer({
    stats: { ...createPlayer().stats, partidosJugados: 4, goles: 4 },
  });

  const matches = [
    createMatch({ id: 'qf-vta', fase: 'Cuartos', playoffLeg: 'VUELTA', jornada: 1, fecha: '2026-09-20' }),
    createMatch({ id: 'g-2', fase: 'Grupos', jornada: 1, fecha: '2026-10-01' }),
    createMatch({ id: 'qf-ida', fase: 'Cuartos', playoffLeg: 'IDA', jornada: 1, fecha: '2026-09-18' }),
    createMatch({ id: 'g-1', fase: 'Grupos', jornada: 1, fecha: '2026-09-05' }),
  ];

  const summary = computePlayerSeasonPerformance(player, matches, 'futbol7', teamLookup);

  assert.deepEqual(
    summary.points.map((p) => p.label),
    ['F1', 'F2', '4tos Ida', '4tos Vta']
  );
});

