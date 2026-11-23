import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  ChampionshipMvpVoteRecord,
  DisciplineTotyConfig,
  Player,
  PositionAwardVoteRecord,
  Team,
  TotyBallotRecord,
} from '../types/tournament.ts';
import {
  aggregateChampionshipMvpVotes,
  aggregatePositionAwardVotes,
  buildTotyFormationConfig,
  computeCommunityToty,
  getPositionsForSport,
  getTotyFormationForSport,
  matchPlayerToPositionKey,
  normalizeTotyBallotSelections,
  validateDisciplineTotyConfig,
} from './awardsEngine.ts';

const sampleTeams: Team[] = [
  {
    id: 't1',
    nombre: 'Ingeniería FC',
    sigla: 'ING',
    disciplineId: 'f7-h-1',
    carrera: 'Ingeniería Civil Informática',
    facultad: 'Facultad de Ingeniería y Ciencias',
    groupName: 'Grupo A',
  },
  {
    id: 't2',
    nombre: 'Medicina FC',
    sigla: 'MED',
    disciplineId: 'f7-h-1',
    carrera: 'Medicina',
    facultad: 'Facultad de Medicina',
    groupName: 'Grupo A',
  },
];

const makePlayer = (id: string, nombre: string, posicion: string, teamId = 't1'): Player => ({
  id,
  teamId,
  disciplineId: 'f7-h-1',
  dorsal: 10,
  posicion,
  nombre,
  apellidoPaterno: 'UFRO',
  apellidoMaterno: 'Test',
  carrera: 'Ingeniería Civil Informática',
  facultad: 'Facultad de Ingeniería y Ciencias',
  rut: '',
  numeroMatricula: '',
  correoInstitucional: '',
  nivelAcademico: 'Pregrado',
  fechaNacimiento: '',
  fotografia: '',
  esSeleccionadoUfro: false,
  stats: {
    partidosJugados: 3,
    goles: 4,
    asistencias: 2,
    tarjetasAmarillas: 0,
    tarjetasRojas: 0,
    puntos: 0,
    rebotes: 0,
    triples: 0,
    faltas: 0,
    aces: 0,
    bloqueos: 0,
  },
});

const samplePlayers: Player[] = [
  makePlayer('p-gk', 'Lucas', 'Portero', 't1'),
  makePlayer('p-def-1', 'Matías', 'Defensa Central', 't1'),
  makePlayer('p-def-2', 'Felipe', 'Defensa Lateral', 't2'),
  makePlayer('p-mid-1', 'Diego', 'Volante Mixto', 't2'),
  makePlayer('p-mid-2', 'Sebastián', 'Mediocampista', 't1'),
  makePlayer('p-fw-a', 'Jugador A', 'Delantero', 't1'),
  makePlayer('p-fw-b', 'Jugador B', 'Extremo / Delantero', 't2'),
  makePlayer('p-fw-c', 'Jugador C', 'Delantero Centro', 't1'),
];

test('sport positions cover football, basketball 5x5, basketball 3x3, and volleyball', () => {
  assert.deepEqual(
    getPositionsForSport('futbol7').map((p) => p.key),
    ['arquero', 'defensa', 'mediocampista', 'delantero']
  );
  assert.deepEqual(
    getPositionsForSport('basquetbol').map((p) => p.key),
    ['base', 'escolta', 'alero', 'ala_pivot', 'pivot']
  );
  assert.deepEqual(
    getPositionsForSport('basquetbol3x3').map((p) => p.key),
    ['base', 'alero', 'pivot']
  );
  assert.deepEqual(
    getPositionsForSport('voleibol').map((p) => p.key),
    ['armador', 'punta', 'central', 'opuesto', 'libero']
  );
});

test('TOTY formations match full lineups: F7 (1-2-2-2 = 7), Basket 5x5 (quintet = 5), Basket 3x3 (3), Volley (6 + Libero = 7)', () => {
  const f7 = getTotyFormationForSport('futbol7');
  assert.equal(f7.slots.length, 7);
  assert.equal(f7.slots.filter((s) => s.positionKey === 'arquero').length, 1);
  assert.equal(f7.slots.filter((s) => s.positionKey === 'defensa').length, 2);
  assert.equal(f7.slots.filter((s) => s.positionKey === 'mediocampista').length, 2);
  assert.equal(f7.slots.filter((s) => s.positionKey === 'delantero').length, 2);

  const basket = getTotyFormationForSport('basquetbol');
  assert.equal(basket.slots.length, 5);
  assert.deepEqual(
    basket.slots.map((s) => s.positionKey),
    ['base', 'escolta', 'alero', 'ala_pivot', 'pivot']
  );

  const basket3x3 = getTotyFormationForSport('basquetbol3x3');
  assert.equal(basket3x3.slots.length, 3);

  const volley = getTotyFormationForSport('voleibol');
  assert.equal(volley.slots.length, 7);
  assert.equal(volley.slots.filter((s) => s.positionKey === 'armador').length, 1);
  assert.equal(volley.slots.filter((s) => s.positionKey === 'punta').length, 2);
  assert.equal(volley.slots.filter((s) => s.positionKey === 'central').length, 2);
  assert.equal(volley.slots.filter((s) => s.positionKey === 'opuesto').length, 1);
  assert.equal(volley.slots.filter((s) => s.positionKey === 'libero').length, 1);
});

test('matchPlayerToPositionKey maps specific keywords before generic ones', () => {
  assert.equal(matchPlayerToPositionKey('Portero Titular', 'futbol7'), 'arquero');
  assert.equal(matchPlayerToPositionKey('Ala-Pívot', 'basquetbol'), 'ala_pivot');
  assert.equal(matchPlayerToPositionKey('Pívot', 'basquetbol'), 'pivot');
  assert.equal(matchPlayerToPositionKey('Líbero', 'voleibol'), 'libero');
  assert.equal(matchPlayerToPositionKey('Punta Receptor', 'voleibol'), 'punta');
});

test('aggregateChampionshipMvpVotes counts only votes for the 5 admin nominees', () => {
  const votes: ChampionshipMvpVoteRecord[] = [
    {
      id: 'f7-h-1_u1',
      disciplineId: 'f7-h-1',
      temporada: '2026',
      voterUid: 'u1',
      playerId: 'p-fw-b',
      playerName: 'Jugador B UFRO',
      teamId: 't2',
      createdAt: '2026-05-01T10:00:00Z',
    },
    {
      id: 'f7-h-1_u2',
      disciplineId: 'f7-h-1',
      temporada: '2026',
      voterUid: 'u2',
      playerId: 'p-fw-b',
      playerName: 'Jugador B UFRO',
      teamId: 't2',
      createdAt: '2026-05-01T10:05:00Z',
    },
    {
      id: 'f7-h-1_u3',
      disciplineId: 'f7-h-1',
      temporada: '2026',
      voterUid: 'u3',
      playerId: 'p-fw-a',
      playerName: 'Jugador A UFRO',
      teamId: 't1',
      createdAt: '2026-05-01T10:10:00Z',
    },
    {
      id: 'f7-h-1_u4',
      disciplineId: 'f7-h-1',
      temporada: '2026',
      voterUid: 'u4',
      playerId: 'non-nominee',
      playerName: 'Otro',
      teamId: 't1',
      createdAt: '2026-05-01T10:12:00Z',
    },
  ];

  const res = aggregateChampionshipMvpVotes(
    'f7-h-1',
    ['p-gk', 'p-def-1', 'p-mid-1', 'p-fw-a', 'p-fw-b'],
    votes,
    samplePlayers,
    sampleTeams
  );

  assert.equal(res.totalVotes, 3);
  assert.equal(res.candidates.length, 5);
  assert.equal(res.candidates[0].playerId, 'p-fw-b');
  assert.equal(res.candidates[0].votes, 2);
  assert.equal(res.candidates[0].percentage, 67);
});

test('aggregatePositionAwardVotes ranks players per position', () => {
  const votes: PositionAwardVoteRecord[] = [
    {
      id: 'f7-h-1_arquero_u1',
      disciplineId: 'f7-h-1',
      temporada: '2026',
      positionKey: 'arquero',
      positionLabel: 'Arquero / Portero',
      voterUid: 'u1',
      playerId: 'p-gk',
      playerName: 'Lucas UFRO',
      teamId: 't1',
      createdAt: '2026-05-01T10:00:00Z',
    },
  ];

  const standings = aggregatePositionAwardVotes(
    'f7-h-1',
    'futbol7',
    votes,
    samplePlayers,
    sampleTeams
  );

  const gkAward = standings.find((s) => s.position.key === 'arquero');
  assert.ok(gkAward);
  assert.equal(gkAward.totalVotes, 1);
  assert.equal(gkAward.leader?.playerId, 'p-gk');
});

test('normalizeTotyBallotSelections migrates legacy single-position keys and removes duplicates', () => {
  const migrated = normalizeTotyBallotSelections(
    {
      arquero: 'p-gk',
      defensa: 'p-def-1',
      delantero_1: 'p-fw-a',
      delantero_2: 'p-fw-a', // duplicate should be dropped
    },
    'futbol7'
  );
  assert.equal(migrated.arquero, 'p-gk');
  assert.equal(migrated.defensa_1, 'p-def-1');
  assert.equal(migrated.delantero_1, 'p-fw-a');
  assert.equal(migrated.delantero_2, undefined);
});

test('computeCommunityToty pools multi-slot positions in F7 1-2-2-2 and picks top distinct winners per line', () => {
  const ballots: TotyBallotRecord[] = [];
  // 10 voters pick p-fw-a & p-fw-b (reversed order across ballots to verify slot-agnostic pooling)
  for (let i = 0; i < 10; i++) {
    ballots.push({
      id: `f7-h-1_userA_${i}`,
      disciplineId: 'f7-h-1',
      temporada: '2026',
      voterUid: `userA_${i}`,
      selections: {
        arquero: 'p-gk',
        defensa_1: 'p-def-1',
        defensa_2: 'p-def-2',
        mediocampista_1: 'p-mid-1',
        mediocampista_2: 'p-mid-2',
        delantero_1: 'p-fw-a',
        delantero_2: 'p-fw-b',
      },
      updatedAt: '2026-05-02T12:00:00Z',
    });
  }
  // 12 voters pick p-fw-b & p-fw-c (so p-fw-b has 22 votes, p-fw-c has 12, p-fw-a has 10)
  for (let i = 0; i < 12; i++) {
    ballots.push({
      id: `f7-h-1_userB_${i}`,
      disciplineId: 'f7-h-1',
      temporada: '2026',
      voterUid: `userB_${i}`,
      selections: {
        arquero: 'p-gk',
        defensa_1: 'p-def-2',
        defensa_2: 'p-def-1',
        mediocampista_1: 'p-mid-2',
        mediocampista_2: 'p-mid-1',
        delantero_1: 'p-fw-b',
        delantero_2: 'p-fw-c',
      },
      updatedAt: '2026-05-02T12:05:00Z',
    });
  }

  const toty = computeCommunityToty('f7-h-1', 'futbol7', ballots, samplePlayers, sampleTeams);
  assert.equal(toty.totalBallots, 22);
  assert.equal(toty.slots.length, 7);

  const del1 = toty.slots.find((s) => s.slot.slotKey === 'delantero_1');
  const del2 = toty.slots.find((s) => s.slot.slotKey === 'delantero_2');
  assert.equal(del1?.winner?.playerId, 'p-fw-b');
  assert.equal(del1?.winner?.votes, 22);
  assert.equal(del2?.winner?.playerId, 'p-fw-c');
  assert.equal(del2?.winner?.votes, 12);
  assert.equal(del1?.runnerUps[0]?.playerId, 'p-fw-a');
  assert.equal(del1?.runnerUps[0]?.votes, 10);

  // All 7 starters must be distinct players
  const winnerIds = toty.slots.map((s) => s.winner?.playerId).filter(Boolean);
  assert.equal(new Set(winnerIds).size, 7);
});

test('validateDisciplineTotyConfig enforces valid ranges, unknown positions, and total slot cap (1..10)', () => {
  const ok = validateDisciplineTotyConfig(
    'futbol7',
    { arquero: 1, defensa: 3, mediocampista: 2, delantero: 1 },
    'Formación 1-3-2-1'
  );
  assert.equal(ok.valid, true);
  assert.equal(ok.totalSlots, 7);
  assert.equal(ok.sanitizedName, 'Formación 1-3-2-1');

  const empty = validateDisciplineTotyConfig(
    'futbol7',
    { arquero: 0, defensa: 0, mediocampista: 0, delantero: 0 },
    'Vacía'
  );
  assert.equal(empty.valid, false);

  const tooMany = validateDisciplineTotyConfig(
    'futbol7',
    { arquero: 2, defensa: 4, mediocampista: 3, delantero: 2 },
    'Once'
  );
  assert.equal(tooMany.valid, false);

  const wrongPos = validateDisciplineTotyConfig(
    'futbol7',
    { arquero: 1, libero: 1 },
    'Inválida'
  );
  assert.equal(wrongPos.valid, false);
});

test('buildTotyFormationConfig builds custom formations for F7, Basketball Small Ball, and Volleyball without libero', () => {
  const f7Custom: DisciplineTotyConfig = {
    disciplineId: 'f7-h-1',
    temporada: '2026',
    formationName: 'Formación 1-3-2-1',
    positionCounts: { arquero: 1, defensa: 3, mediocampista: 2, delantero: 1 },
  };
  const f7Formation = buildTotyFormationConfig('futbol7', f7Custom);
  assert.equal(f7Formation.slots.length, 7);
  assert.deepEqual(
    f7Formation.slots.map((s) => s.slotKey),
    ['arquero', 'defensa_1', 'defensa_2', 'defensa_3', 'mediocampista_1', 'mediocampista_2', 'delantero']
  );

  const basketSmallBall: DisciplineTotyConfig = {
    disciplineId: 'basquet-h',
    temporada: '2026',
    formationName: 'Quinteto Small Ball',
    positionCounts: { base: 2, escolta: 1, alero: 1, ala_pivot: 1, pivot: 0 },
  };
  const bkFormation = buildTotyFormationConfig('basquetbol', basketSmallBall);
  assert.equal(bkFormation.slots.length, 5);
  assert.equal(bkFormation.slots.filter((s) => s.positionKey === 'base').length, 2);
  assert.equal(bkFormation.slots.filter((s) => s.positionKey === 'pivot').length, 0);

  const volleyNoLibero: DisciplineTotyConfig = {
    disciplineId: 'voley-m',
    temporada: '2026',
    formationName: 'Sexteto Titular 6',
    positionCounts: { armador: 1, punta: 2, central: 2, opuesto: 1, libero: 0 },
  };
  const vlFormation = buildTotyFormationConfig('voleibol', volleyNoLibero);
  assert.equal(vlFormation.slots.length, 6);
  assert.equal(vlFormation.slots.some((s) => s.positionKey === 'libero'), false);
});

test('normalizeTotyBallotSelections migrates contracted multi-slot keys back to single slot keys cleanly', () => {
  const custom1321: DisciplineTotyConfig = {
    disciplineId: 'f7-h-1',
    temporada: '2026',
    formationName: 'Formación 1-3-2-1',
    positionCounts: { arquero: 1, defensa: 3, mediocampista: 2, delantero: 1 },
  };
  const migrated = normalizeTotyBallotSelections(
    {
      arquero: 'p-gk',
      defensa_1: 'p-def-1',
      defensa_2: 'p-def-2',
      delantero_1: 'p-fw-a',
      delantero_2: 'p-fw-b',
    },
    'futbol7',
    custom1321
  );
  assert.equal(migrated.arquero, 'p-gk');
  assert.equal(migrated.defensa_1, 'p-def-1');
  assert.equal(migrated.defensa_2, 'p-def-2');
  assert.equal(migrated.delantero, 'p-fw-a');
});

test('computeCommunityToty honors custom formation, pools legacy/reconfigured keys, and flags cutoff ties', () => {
  const custom1321: DisciplineTotyConfig = {
    disciplineId: 'f7-h-1',
    temporada: '2026',
    formationName: 'Formación 1-3-2-1',
    positionCounts: { arquero: 1, defensa: 3, mediocampista: 2, delantero: 1 },
  };
  // Two ballots: p-fw-a gets 1 vote (via legacy delantero_1), p-fw-b gets 1 vote (via delantero) -> cutoff tie at 1 striker slot!
  const ballots: TotyBallotRecord[] = [
    {
      id: 'f7-h-1_u1',
      disciplineId: 'f7-h-1',
      temporada: '2026',
      voterUid: 'u1',
      selections: {
        arquero: 'p-gk',
        defensa_1: 'p-def-1',
        delantero_1: 'p-fw-a',
      },
      updatedAt: '2026-05-03T10:00:00Z',
    },
    {
      id: 'f7-h-1_u2',
      disciplineId: 'f7-h-1',
      temporada: '2026',
      voterUid: 'u2',
      selections: {
        arquero: 'p-gk',
        defensa_1: 'p-def-2',
        delantero: 'p-fw-b',
      },
      updatedAt: '2026-05-03T10:05:00Z',
    },
  ];

  const toty = computeCommunityToty(
    'f7-h-1',
    'futbol7',
    ballots,
    samplePlayers,
    sampleTeams,
    custom1321
  );
  assert.equal(toty.formation.formationName, 'Formación 1-3-2-1');
  assert.equal(toty.slots.length, 7);

  const strikerSlot = toty.slots.find((s) => s.slot.slotKey === 'delantero');
  assert.ok(strikerSlot);
  assert.equal(strikerSlot.isTiedWithRunnerUp, true);
  assert.equal(strikerSlot.winner?.votes, 1);

  const fwBreakdown = toty.positionBreakdowns.find((b) => b.position.key === 'delantero');
  assert.ok(fwBreakdown);
  assert.equal(fwBreakdown.slotsAllocated, 1);
  assert.equal(fwBreakdown.ballotsContributing, 2);
  assert.equal(fwBreakdown.hasCutoffTie, true);
  assert.equal(fwBreakdown.candidates.length, 2);
});
