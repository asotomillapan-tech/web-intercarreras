import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFullPlayoffTree,
  compareScoresheetWithLive,
  computeStandings,
  computeTeamHistoricalStats,
  computeTeamMatchProgression,
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

test('computeTeamMatchProgression returns chronological per-match and cumulative favor/contra series for finalized matches only', () => {
  const teamA: Team = {
    id: 'a',
    nombre: 'Ingeniería FC',
    sigla: 'ING',
    disciplineId: 'f7-h-1',
    carrera: 'Ingeniería Civil',
    facultad: 'FICA',
    groupName: 'Grupo A',
  };
  const lookup = new Map<string, Pick<Team, 'nombre' | 'sigla'>>([
    ['b', { nombre: 'Medicina FC', sigla: 'MED' }],
    ['c', { nombre: 'Derecho FC', sigla: 'DER' }],
    ['d', { nombre: 'Kinesiología FC', sigla: 'KIN' }],
  ]);
  const makeMatch = (overrides: Partial<Match>): Match => ({
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
    homeScore: 0,
    awayScore: 0,
    status: 'FINALIZADO',
    periodLabel: 'Final',
    clock: '50:00',
    periods: [],
    fouls: { home: 0, away: 0 },
    timeouts: { home: 0, away: 0 },
    events: [],
    refereeId: 'ref-1',
    ...overrides,
  });

  // Intentionally unsorted input with PROGRAMADO and EN_VIVO matches mixed in
  const matches: Match[] = [
    makeMatch({ id: 'm3', fase: 'Cuartos', jornada: 3, fecha: '2026-10-15', homeTeamId: 'a', awayTeamId: 'd', homeScore: 1, awayScore: 3 }),
    makeMatch({ id: 'm4', jornada: 4, fecha: '2026-10-22', homeTeamId: 'a', awayTeamId: 'b', homeScore: 5, awayScore: 0, status: 'PROGRAMADO' }),
    makeMatch({ id: 'm1', jornada: 1, fecha: '2026-10-01', homeTeamId: 'a', awayTeamId: 'b', homeScore: 4, awayScore: 1 }),
    makeMatch({ id: 'm5', jornada: 5, fecha: '2026-10-29', homeTeamId: 'a', awayTeamId: 'c', homeScore: 1, awayScore: 0, status: 'EN_VIVO' }),
    makeMatch({ id: 'm2', jornada: 2, fecha: '2026-10-08', homeTeamId: 'c', awayTeamId: 'a', homeScore: 2, awayScore: 2 }),
  ];

  const series = computeTeamMatchProgression(teamA, matches, lookup);
  assert.equal(series.length, 3);

  assert.equal(series[0].matchId, 'm1');
  assert.equal(series[0].label, 'F1');
  assert.equal(series[0].opponentName, 'Medicina FC');
  assert.equal(series[0].favor, 4);
  assert.equal(series[0].contra, 1);
  assert.equal(series[0].acumuladoFavor, 4);
  assert.equal(series[0].acumuladoContra, 1);
  assert.equal(series[0].acumuladoDiferencia, 3);
  assert.equal(series[0].outcome, 'G');

  assert.equal(series[1].matchId, 'm2');
  assert.equal(series[1].label, 'F2');
  assert.equal(series[1].isHome, false);
  assert.equal(series[1].favor, 2);
  assert.equal(series[1].contra, 2);
  assert.equal(series[1].acumuladoFavor, 6);
  assert.equal(series[1].acumuladoContra, 3);
  assert.equal(series[1].acumuladoDiferencia, 3);
  assert.equal(series[1].outcome, 'E');

  assert.equal(series[2].matchId, 'm3');
  assert.equal(series[2].label, '4tos');
  assert.equal(series[2].favor, 1);
  assert.equal(series[2].contra, 3);
  assert.equal(series[2].diferencia, -2);
  assert.equal(series[2].acumuladoFavor, 7);
  assert.equal(series[2].acumuladoContra, 6);
  assert.equal(series[2].acumuladoDiferencia, 1);
  assert.equal(series[2].outcome, 'P');

  // Empty state when no finalized matches exist
  const emptySeries = computeTeamMatchProgression(teamA, [matches[1], matches[3]], lookup);
  assert.deepEqual(emptySeries, []);
});

test('buildFullPlayoffTree generates all elimination rounds, propagates winners to Final, and losers to Tercer Lugar', () => {
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

  const teamMap = new Map<string, Pick<Team, 'nombre'>>([
    ['a1', { nombre: 'Alpha' }],
    ['a2', { nombre: 'Beta' }],
    ['b1', { nombre: 'Gamma' }],
    ['b2', { nombre: 'Delta' }],
  ]);

  // 1) Projected 8-team bracket shows Cuartos -> Semifinal -> Final + Tercer Lugar
  const tree8 = buildFullPlayoffTree({
    standingsByGroup,
    clasificadosPorGrupo: 2,
    formatoPlayoff: 8,
    incluyeTercerLugar: true,
    disciplineMatches: [],
    teamMap,
  });
  assert.deepEqual(
    tree8.rounds.map((r) => [r.round, r.slots.length]),
    [
      ['Cuartos', 4],
      ['Semifinal', 2],
      ['Final', 1],
    ]
  );
  assert.equal(tree8.rounds[1].slots[0].homeTeamName, 'Ganador Cuarto 1');
  assert.equal(tree8.rounds[2].slots[0].awayTeamName, 'Ganador Semifinal 2');
  assert.ok(tree8.thirdPlace);
  assert.equal(tree8.thirdPlace.homeTeamName, 'Perdedor Semifinal 1');
  assert.equal(tree8.thirdPlace.awayTeamName, 'Perdedor Semifinal 2');

  // 2) 16-team bracket includes Octavos -> Cuartos -> Semifinal -> Final
  const tree16 = buildFullPlayoffTree({
    standingsByGroup,
    clasificadosPorGrupo: 2,
    formatoPlayoff: 16,
    incluyeTercerLugar: false,
    disciplineMatches: [],
    teamMap,
  });
  assert.deepEqual(
    tree16.rounds.map((r) => [r.round, r.slots.length]),
    [
      ['Octavos', 8],
      ['Cuartos', 4],
      ['Semifinal', 2],
      ['Final', 1],
    ]
  );
  assert.equal(tree16.thirdPlace, null);

  // 3) 4-team bracket with real Semifinal + Tercer Lugar + Final matches propagates real teams and podium
  const makePoMatch = (overrides: Partial<Match>): Match => ({
    id: 'm',
    disciplineId: 'f7-h-1',
    groupName: 'Playoffs',
    fase: 'Semifinal',
    jornada: 1,
    fecha: '2026-11-20',
    hora: '19:00',
    cancha: 'Cancha 1',
    homeTeamId: 'a1',
    awayTeamId: 'b2',
    homeScore: 0,
    awayScore: 0,
    status: 'FINALIZADO',
    periodLabel: 'Final',
    clock: '50:00',
    periods: [],
    fouls: { home: 0, away: 0 },
    timeouts: { home: 0, away: 0 },
    events: [],
    refereeId: 'ref-1',
    ...overrides,
  });

  const tree4 = buildFullPlayoffTree({
    standingsByGroup,
    clasificadosPorGrupo: 2,
    formatoPlayoff: 4,
    incluyeTercerLugar: true,
    disciplineMatches: [
      makePoMatch({ id: 'sf1', fase: 'Semifinal', homeTeamId: 'a1', awayTeamId: 'b2', homeScore: 3, awayScore: 1 }),
      makePoMatch({ id: 'sf2', fase: 'Semifinal', homeTeamId: 'b1', awayTeamId: 'a2', homeScore: 1, awayScore: 2 }),
      makePoMatch({ id: 'tp1', fase: 'Tercer Lugar', homeTeamId: 'b2', awayTeamId: 'b1', homeScore: 0, awayScore: 2 }),
      makePoMatch({ id: 'fn1', fase: 'Final', homeTeamId: 'a1', awayTeamId: 'a2', homeScore: 4, awayScore: 2 }),
    ],
    teamMap,
  });

  assert.equal(tree4.rounds[1].slots[0].homeTeamId, 'a1');
  assert.equal(tree4.rounds[1].slots[0].awayTeamId, 'a2');
  assert.equal(tree4.championName, 'Alpha');
  assert.ok(tree4.thirdPlace);
  assert.equal(tree4.thirdPlace.homeTeamId, 'b2');
  assert.equal(tree4.thirdPlace.awayTeamId, 'b1');
  assert.equal(tree4.thirdPlaceWinnerName, 'Gamma');

  // 4) computeTeamMatchProgression labels Tercer Lugar cleanly as '3° Lugar'
  const teamGamma: Team = {
    id: 'b1',
    nombre: 'Gamma',
    sigla: 'GAM',
    disciplineId: 'f7-h-1',
    carrera: 'Ing',
    facultad: 'FICA',
    groupName: 'Grupo B',
  };
  const prog = computeTeamMatchProgression(
    teamGamma,
    [makePoMatch({ id: 'tp1', fase: 'Tercer Lugar', homeTeamId: 'b2', awayTeamId: 'b1', homeScore: 0, awayScore: 2 })]
  );
  assert.equal(prog[0].label, '3° Lugar');
});

test('buildFullPlayoffTree supports Ida y Vuelta (two-legged) ties with swapped home/away legs and global aggregate', () => {
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

  const teamMap = new Map<string, Pick<Team, 'nombre'>>([
    ['a1', { nombre: 'Alpha' }],
    ['a2', { nombre: 'Beta' }],
    ['b1', { nombre: 'Gamma' }],
    ['b2', { nombre: 'Delta' }],
  ]);

  const makeLeg = (overrides: Partial<Match>): Match => ({
    id: 'leg',
    disciplineId: 'f7-h-1',
    groupName: 'Playoffs',
    fase: 'Semifinal',
    playoffLeg: 'IDA',
    jornada: 1,
    fecha: '2026-11-20',
    hora: '19:00',
    cancha: 'Cancha 1',
    homeTeamId: 'a1',
    awayTeamId: 'b2',
    homeScore: 0,
    awayScore: 0,
    status: 'FINALIZADO',
    periodLabel: 'Final',
    clock: '50:00',
    periods: [],
    fouls: { home: 0, away: 0 },
    timeouts: { home: 0, away: 0 },
    events: [],
    refereeId: 'ref-1',
    ...overrides,
  });

  // 1) Only Ida finalized -> must NOT advance a winner yet
  const treeOnlyIda = buildFullPlayoffTree({
    standingsByGroup,
    clasificadosPorGrupo: 2,
    formatoPlayoff: 4,
    incluyeTercerLugar: true,
    playoffsIdaYVuelta: true,
    disciplineMatches: [
      makeLeg({ id: 'sf1-ida', fase: 'Semifinal', playoffLeg: 'IDA', homeTeamId: 'a1', awayTeamId: 'b2', homeScore: 2, awayScore: 1, status: 'FINALIZADO' }),
      makeLeg({ id: 'sf1-vta', fase: 'Semifinal', playoffLeg: 'VUELTA', fecha: '2026-11-27', homeTeamId: 'b2', awayTeamId: 'a1', homeScore: 0, awayScore: 0, status: 'PROGRAMADO' }),
    ],
    teamMap,
  });

  assert.equal(treeOnlyIda.isTwoLegged, true);
  const sf1Pending = treeOnlyIda.rounds[0].slots[0];
  assert.equal(sf1Pending.isTwoLegged, true);
  assert.equal(sf1Pending.homeFirstLegScore, 2);
  assert.equal(sf1Pending.awayFirstLegScore, 1);
  assert.equal(sf1Pending.homeSecondLegScore, undefined);
  assert.equal(sf1Pending.winnerSide, null);
  assert.equal(treeOnlyIda.rounds[1].slots[0].homeTeamId, undefined);

  // 2) Both legs finalized with swapped localía:
  // SF1: Ida Alpha 2-1 Delta, Vuelta Delta 3-0 Alpha => Global Alpha 2 - 4 Delta (Delta advances!)
  // SF2: Ida Gamma 1-1 Beta, Vuelta Beta 1-1 Gamma => Global Gamma 2 - 2 Beta (Aggregate draw, no auto-winner)
  const treeBothLegs = buildFullPlayoffTree({
    standingsByGroup,
    clasificadosPorGrupo: 2,
    formatoPlayoff: 4,
    incluyeTercerLugar: true,
    playoffsIdaYVuelta: true,
    disciplineMatches: [
      makeLeg({ id: 'sf1-ida', fase: 'Semifinal', playoffLeg: 'IDA', fecha: '2026-11-20', homeTeamId: 'a1', awayTeamId: 'b2', homeScore: 2, awayScore: 1 }),
      makeLeg({ id: 'sf1-vta', fase: 'Semifinal', playoffLeg: 'VUELTA', fecha: '2026-11-27', homeTeamId: 'b2', awayTeamId: 'a1', homeScore: 3, awayScore: 0 }),
      makeLeg({ id: 'sf2-ida', fase: 'Semifinal', playoffLeg: 'IDA', fecha: '2026-11-20', homeTeamId: 'b1', awayTeamId: 'a2', homeScore: 1, awayScore: 1 }),
      makeLeg({ id: 'sf2-vta', fase: 'Semifinal', playoffLeg: 'VUELTA', fecha: '2026-11-27', homeTeamId: 'a2', awayTeamId: 'b1', homeScore: 1, awayScore: 1 }),
    ],
    teamMap,
  });

  const sf1Done = treeBothLegs.rounds[0].slots[0];
  assert.equal(sf1Done.homeTeamId, 'a1');
  assert.equal(sf1Done.awayTeamId, 'b2');
  assert.equal(sf1Done.homeFirstLegScore, 2);
  assert.equal(sf1Done.awayFirstLegScore, 1);
  assert.equal(sf1Done.homeSecondLegScore, 0);
  assert.equal(sf1Done.awaySecondLegScore, 3);
  assert.equal(sf1Done.homeScore, 2);
  assert.equal(sf1Done.awayScore, 4);
  assert.equal(sf1Done.winnerSide, 'away');
  assert.equal(sf1Done.isAggregateDraw, false);
  // Delta advanced to Final, Alpha dropped to Tercer Lugar
  assert.equal(treeBothLegs.rounds[1].slots[0].homeTeamId, 'b2');
  assert.equal(treeBothLegs.thirdPlace?.homeTeamId, 'a1');

  const sf2Draw = treeBothLegs.rounds[0].slots[1];
  assert.equal(sf2Draw.homeScore, 2);
  assert.equal(sf2Draw.awayScore, 2);
  assert.equal(sf2Draw.winnerSide, null);
  assert.equal(sf2Draw.isAggregateDraw, true);
  assert.equal(treeBothLegs.rounds[1].slots[0].awayTeamId, undefined);

  // 3) DD/MM/YYYY dates from Google Sheets without explicit playoffLeg sort chronologically
  const treeDmy = buildFullPlayoffTree({
    standingsByGroup,
    clasificadosPorGrupo: 2,
    formatoPlayoff: 4,
    incluyeTercerLugar: false,
    playoffsIdaYVuelta: true,
    disciplineMatches: [
      makeLeg({ id: 'dmy-vta', fase: 'Semifinal', playoffLeg: undefined, fecha: '02/11/2026', homeTeamId: 'b2', awayTeamId: 'a1', homeScore: 1, awayScore: 4 }),
      makeLeg({ id: 'dmy-ida', fase: 'Semifinal', playoffLeg: undefined, fecha: '29/10/2026', homeTeamId: 'a1', awayTeamId: 'b2', homeScore: 3, awayScore: 2 }),
    ],
    teamMap,
  });
  const dmySlot = treeDmy.rounds[0].slots[0];
  assert.equal(dmySlot.firstLegMatch?.id, 'dmy-ida');
  assert.equal(dmySlot.secondLegMatch?.id, 'dmy-vta');
  assert.equal(dmySlot.homeFirstLegScore, 3);
  assert.equal(dmySlot.awayFirstLegScore, 2);
  assert.equal(dmySlot.homeSecondLegScore, 4);
  assert.equal(dmySlot.awaySecondLegScore, 1);
  assert.equal(dmySlot.homeScore, 7);
  assert.equal(dmySlot.awayScore, 3);
  assert.equal(dmySlot.winnerSide, 'home');
});



