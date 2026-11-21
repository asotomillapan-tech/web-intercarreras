import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareScoresheetWithLive,
  computeStandings,
  computeTeamHistoricalStats,
  formatRut,
  generateEquitableGroups,
  generatePlayoffBracket,
  generateRoundRobinMatches,
  isVolleyballSetWon,
  validateRut,
  validateTransferEligibility,
  validateUfroEmail,
} from './tournamentEngine';
import type { DisciplineFormatConfig, Match, Player, Team } from '../types/tournament';

test('Chilean RUT validation & formatting handles valid, K-digit, and invalid RUTs', () => {
  assert.equal(validateRut('20.456.789-1'), true);
  assert.equal(validateRut('11.111.111-1'), true);
  assert.equal(validateRut('20.000.003-K'), true);
  assert.equal(validateRut('21345678-K'), false);
  assert.equal(validateRut('12345678-5'), true);
  assert.equal(validateRut('12345678-9'), false);
  assert.equal(formatRut('204567891'), '20.456.789-1');
});

test('UFRO institutional email validation accepts @ufromail.cl and @ufrontera.cl only', () => {
  assert.equal(validateUfroEmail('m.perez01@ufromail.cl'), true);
  assert.equal(validateUfroEmail('deportes@ufrontera.cl'), true);
  assert.equal(validateUfroEmail('usuario@gmail.com'), false);
  assert.equal(validateUfroEmail(''), false);
});

test('generateEquitableGroups splits 19 teams across 4 groups equitably (5,5,5,4)', () => {
  const teams: Team[] = Array.from({ length: 19 }, (_, i) => ({
    id: `t-${i + 1}`,
    nombre: `Equipo ${i + 1}`,
    sigla: `E${i + 1}`,
    disciplineId: 'f7-h-1',
    carrera: 'Ingeniería Civil',
    facultad: 'Facultad de Ingeniería y Ciencias',
    groupName: 'Sin asignar',
  }));

  const grouped = generateEquitableGroups(teams, 4);
  const counts = grouped.reduce<Record<string, number>>((acc, t) => {
    acc[t.groupName] = (acc[t.groupName] ?? 0) + 1;
    return acc;
  }, {});

  const sizes = Object.values(counts).sort((a, b) => b - a);
  assert.deepEqual(sizes, [5, 5, 5, 4]);
});

test('generateRoundRobinMatches generates exact N*(N-1)/2 matches for todos contra todos', () => {
  const teams: Team[] = Array.from({ length: 5 }, (_, i) => ({
    id: `t-${i + 1}`,
    nombre: `Equipo ${i + 1}`,
    sigla: `E${i + 1}`,
    disciplineId: 'f7-h-1',
    carrera: 'Medicina',
    facultad: 'Facultad de Medicina',
    groupName: 'Grupo A',
  }));

  const fixtures = generateRoundRobinMatches('f7-h-1', 'Grupo A', teams, 'Cancha 1', 'ref-1');
  assert.equal(fixtures.length, 10); // 5 * 4 / 2
});

test('computeStandings applies sport-specific point systems for Futbol 7, Basquetbol, and Voleibol', () => {
  const teams: Team[] = [
    { id: 'a', nombre: 'Equipo A', sigla: 'EQA', disciplineId: 'f7-h-1', carrera: 'Medicina', facultad: 'Medicina', groupName: 'Grupo A' },
    { id: 'b', nombre: 'Equipo B', sigla: 'EQB', disciplineId: 'f7-h-1', carrera: 'Derecho', facultad: 'FCJE', groupName: 'Grupo A' },
  ];

  const f7Match: Match[] = [
    {
      id: 'm1',
      disciplineId: 'f7-h-1',
      groupName: 'Grupo A',
      fase: 'Grupos',
      jornada: 1,
      fecha: '2026-11-18',
      hora: '18:00',
      cancha: 'Cancha 1',
      homeTeamId: 'a',
      awayTeamId: 'b',
      homeScore: 3,
      awayScore: 1,
      status: 'FINALIZADO',
      periodLabel: 'Final',
      clock: '50:00',
      periods: [],
      fouls: { home: 2, away: 3 },
      timeouts: { home: 0, away: 0 },
      events: [],
      refereeId: 'ref-1',
    },
  ];

  const f7Table = computeStandings('futbol7', teams, f7Match);
  assert.equal(f7Table[0].teamId, 'a');
  assert.equal(f7Table[0].puntos, 3);
  assert.equal(f7Table[1].puntos, 0);

  const basketTable = computeStandings('basquetbol', teams, [
    { ...f7Match[0], homeScore: 68, awayScore: 62 },
  ]);
  assert.equal(basketTable[0].puntos, 2);
  assert.equal(basketTable[1].puntos, 1);

  const voleyTable = computeStandings('voleibol', teams, [
    {
      ...f7Match[0],
      homeScore: 2,
      awayScore: 1,
      periods: [
        { home: 25, away: 20 },
        { home: 22, away: 25 },
        { home: 15, away: 12 },
      ],
    },
  ]);
  assert.equal(voleyTable[0].puntos, 2); // 2-1 tiebreak win
  assert.equal(voleyTable[1].puntos, 1); // 1-2 tiebreak loss
});

test('generatePlayoffBracket seeds 1st vs lowest qualifier across groups', () => {
  const standingsByGroup = {
    'Grupo A': [
      { teamId: 'a1', teamName: 'Alpha', sigla: 'ALP', carrera: 'Med', groupName: 'Grupo A', pj: 3, pg: 3, pe: 0, pp: 0, favor: 9, contra: 1, diferencia: 8, puntos: 9, racha: [] },
      { teamId: 'a2', teamName: 'Beta', sigla: 'BET', carrera: 'Der', groupName: 'Grupo A', pj: 3, pg: 2, pe: 0, pp: 1, favor: 6, contra: 3, diferencia: 3, puntos: 6, racha: [] },
    ],
    'Grupo B': [
      { teamId: 'b1', teamName: 'Gamma', sigla: 'GAM', carrera: 'Ing', groupName: 'Grupo B', pj: 3, pg: 3, pe: 0, pp: 0, favor: 7, contra: 2, diferencia: 5, puntos: 9, racha: [] },
      { teamId: 'b2', teamName: 'Delta', sigla: 'DEL', carrera: 'Kin', groupName: 'Grupo B', pj: 3, pg: 1, pe: 1, pp: 1, favor: 4, contra: 4, diferencia: 0, puntos: 4, racha: [] },
    ],
  };

  const bracket = generatePlayoffBracket(standingsByGroup, 2, 4);
  assert.equal(bracket.length, 2);
  assert.equal(bracket[0].homeTeamId, 'a1');
  assert.equal(bracket[0].awayTeamId, 'b2');
  assert.equal(bracket[1].homeTeamId, 'b1');
  assert.equal(bracket[1].awayTeamId, 'a2');
});

test('validateTransferEligibility enforces open transfer window and UFRO selected player limits', () => {
  const config: DisciplineFormatConfig = {
    disciplineId: 'f7-h-1',
    temporada: '2026',
    maxCupos: 20,
    numGrupos: 4,
    clasificadosPorGrupo: 2,
    formatoPlayoff: 8,
    inscripcionesAbiertas: false,
    transferenciasAbiertas: true,
    maxTransferenciasPorEquipo: 2,
    faseActual: 'TRANSFERENCIAS',
  };
  const fromTeam: Team = { id: 't1', nombre: 'Equipo 1', sigla: 'E1', disciplineId: 'f7-h-1', carrera: 'Medicina', facultad: 'Med', groupName: 'Grupo A' };
  const toTeam: Team = { id: 't2', nombre: 'Equipo 2', sigla: 'E2', disciplineId: 'f7-h-1', carrera: 'Derecho', facultad: 'FCJE', groupName: 'Grupo B' };
  const player: Player = {
    id: 'p1',
    teamId: 't1',
    disciplineId: 'f7-h-1',
    dorsal: 10,
    posicion: 'Delantero',
    nombre: 'Diego',
    apellidoPaterno: 'Soto',
    apellidoMaterno: 'Ríos',
    carrera: 'Medicina',
    facultad: 'Medicina',
    rut: '20.456.789-2',
    numeroMatricula: '20456789221',
    correoInstitucional: 'd.soto01@ufromail.cl',
    nivelAcademico: 'Pregrado',
    fechaNacimiento: '2003-04-12',
    fotografia: '',
    esSeleccionadoUfro: true,
    stats: { partidosJugados: 3, goles: 4, asistencias: 2, tarjetasAmarillas: 0, tarjetasRojas: 0, puntos: 0, rebotes: 0, triples: 0, faltas: 0, aces: 0, bloqueos: 0 },
  };

  const ok = validateTransferEligibility({
    config,
    player,
    fromTeam,
    toTeam,
    existingTransfers: [],
    toTeamPlayers: [],
    maxSeleccionadosPorEquipo: 2,
  });
  assert.equal(ok.valid, true);

  const closed = validateTransferEligibility({
    config: { ...config, transferenciasAbiertas: false },
    player,
    fromTeam,
    toTeam,
    existingTransfers: [],
    toTeamPlayers: [],
    maxSeleccionadosPorEquipo: 2,
  });
  assert.equal(closed.valid, false);
});

test('compareScoresheetWithLive flags mismatches and low AI confidence for manual validation', () => {
  const mismatch = compareScoresheetWithLive(
    { homeScore: 2, awayScore: 1 },
    {
      homeScoreDetected: 3,
      awayScoreDetected: 1,
      periodBreakdown: [],
      detectedEvents: [],
      confidence: 'alta',
      discrepancies: [],
      requiresManualReview: false,
      summary: 'Planilla leída',
    }
  );
  assert.equal(mismatch.matchesLive, false);
  assert.equal(mismatch.requiresManualReview, true);
  assert.ok(mismatch.discrepancies.length > 0);

  const clean = compareScoresheetWithLive(
    { homeScore: 2, awayScore: 1 },
    {
      homeScoreDetected: 2,
      awayScoreDetected: 1,
      periodBreakdown: [],
      detectedEvents: [],
      confidence: 'alta',
      discrepancies: [],
      requiresManualReview: false,
      summary: 'Coincide completamente',
    }
  );
  assert.equal(clean.matchesLive, true);
  assert.equal(clean.requiresManualReview, false);
});

test('isVolleyballSetWon checks 25-point and 15-point tiebreak 2-point lead rules', () => {
  assert.equal(isVolleyballSetWon(25, 23, 1), 'home');
  assert.equal(isVolleyballSetWon(25, 24, 1), null);
  assert.equal(isVolleyballSetWon(26, 24, 1), 'home');
  assert.equal(isVolleyballSetWon(15, 13, 3), 'home');
  assert.equal(isVolleyballSetWon(14, 15, 3), null);
});

test('computeTeamHistoricalStats aggregates complete match history across groups and playoffs', () => {
  const teamA: Team = {
    id: 'a',
    nombre: 'Ingeniería FC',
    sigla: 'ING',
    disciplineId: 'f7-h-1',
    carrera: 'Ingeniería Civil Informática',
    facultad: 'Facultad de Ingeniería y Ciencias',
    groupName: 'Grupo A',
  };
  const baseMatch: Match = {
    id: 'm1',
    disciplineId: 'f7-h-1',
    groupName: 'Grupo A',
    fase: 'Grupos',
    jornada: 1,
    fecha: '2026-10-01',
    hora: '18:00',
    cancha: 'Cancha 1',
    homeTeamId: 'a',
    awayTeamId: 'b',
    homeScore: 4,
    awayScore: 1,
    status: 'FINALIZADO',
    periodLabel: 'Final',
    clock: '50:00',
    periods: [],
    fouls: { home: 2, away: 3 },
    timeouts: { home: 0, away: 0 },
    events: [],
    refereeId: 'ref-1',
  };
  const matches: Match[] = [
    baseMatch,
    {
      ...baseMatch,
      id: 'm2',
      jornada: 2,
      fecha: '2026-10-08',
      homeTeamId: 'c',
      awayTeamId: 'a',
      homeScore: 2,
      awayScore: 2,
    },
    {
      ...baseMatch,
      id: 'm3',
      fase: 'Cuartos',
      jornada: 3,
      fecha: '2026-10-15',
      homeTeamId: 'a',
      awayTeamId: 'd',
      homeScore: 1,
      awayScore: 3,
    },
    {
      ...baseMatch,
      id: 'm4',
      jornada: 4,
      fecha: '2026-10-22',
      homeTeamId: 'a',
      awayTeamId: 'e',
      homeScore: 0,
      awayScore: 0,
      status: 'PROGRAMADO',
    },
  ];

  const stats = computeTeamHistoricalStats(teamA, 'futbol7', matches);
  assert.equal(stats.pj, 3);
  assert.equal(stats.pg, 1);
  assert.equal(stats.pe, 1);
  assert.equal(stats.pp, 1);
  assert.equal(stats.favor, 7);
  assert.equal(stats.contra, 6);
  assert.equal(stats.diferencia, 1);
  assert.equal(stats.puntos, 4);
  assert.equal(stats.winRatePct, 33);
  assert.deepEqual(stats.racha, ['G', 'E', 'P']);
  assert.equal(stats.history.length, 4);
  assert.equal(stats.history[0].match.id, 'm4');
  assert.equal(stats.history[0].outcome, 'PROGRAMADO');
});
