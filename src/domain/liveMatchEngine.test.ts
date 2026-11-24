import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceMatchPeriod,
  applyMatchLiveEvent,
  applyPlayerSubstitution,
  applyStatDeltaClamped,
  autoSelectStartingLineup,
  computePlayerMatchCounters,
  formatMatchClock,
  getBasketballBonusStatus,
  getVolleyballSetPointStatus,
  revertMatchLiveEvent,
  setTeamOnCourtPlayers,
} from './liveMatchEngine';
import type { Match, PlayerStats } from '../types/tournament';

function baseMatch(overrides?: Partial<Match>): Match {
  return {
    id: 'm-live-1',
    disciplineId: 'f7-h-1',
    groupName: 'Grupo A',
    fase: 'Grupos',
    jornada: 1,
    fecha: '2026-11-18',
    hora: '18:00',
    cancha: 'Cancha 1',
    homeTeamId: 'team-home',
    awayTeamId: 'team-away',
    homeScore: 0,
    awayScore: 0,
    status: 'PROGRAMADO',
    periodLabel: 'Por iniciar',
    clock: 'Por iniciar',
    periods: [],
    fouls: { home: 0, away: 0 },
    timeouts: { home: 0, away: 0 },
    events: [],
    refereeId: 'ref-1',
    ...overrides,
  };
}

function emptyStats(): PlayerStats {
  return {
    partidosJugados: 1,
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

test('Futbol 7: applies and cleanly reverts Gol (with period breakdown), Asistencia, Falta, and Tarjeta Roja/2a Amarilla', () => {
  const player = { id: 'p-9', nombre: 'Matías', apellidoPaterno: 'Rojas', dorsal: 9 };
  const teammate = { id: 'p-10', nombre: 'Diego', apellidoPaterno: 'Silva', dorsal: 10 };
  let stats = emptyStats();

  let match = setTeamOnCourtPlayers(baseMatch(), 'futbol7', 'home', ['p-9', 'p-10']);

  // 1. Register goal in 1° Tiempo -> updates homeScore AND periods[0]
  const goalRes = applyMatchLiveEvent({
    match,
    sportType: 'futbol7',
    side: 'home',
    actionType: 'GOL',
    teamName: 'Ingeniería FC',
    player,
    eventId: 'ev-goal-1',
  });
  assert.equal(goalRes.updatedMatch.status, 'EN_VIVO');
  assert.equal(goalRes.updatedMatch.homeScore, 1);
  assert.equal(goalRes.updatedMatch.periods[0].home, 1);
  assert.equal(goalRes.statDelta.goles, 1);
  stats = applyStatDeltaClamped(stats, goalRes.statDelta);
  assert.equal(stats.goles, 1);

  // 2. Register assist
  const assistRes = applyMatchLiveEvent({
    match: goalRes.updatedMatch,
    sportType: 'futbol7',
    side: 'home',
    actionType: 'ASISTENCIA',
    teamName: 'Ingeniería FC',
    player: teammate,
    eventId: 'ev-ast-1',
  });
  assert.equal(assistRes.statDelta.asistencias, 1);

  // 3. Register foul
  const foulRes = applyMatchLiveEvent({
    match: assistRes.updatedMatch,
    sportType: 'futbol7',
    side: 'home',
    actionType: 'FALTA',
    teamName: 'Ingeniería FC',
    player,
    eventId: 'ev-foul-1',
  });
  assert.equal(foulRes.updatedMatch.fouls.home, 1);
  assert.equal(foulRes.statDelta.faltas, 1);
  stats = applyStatDeltaClamped(stats, foulRes.statDelta);
  assert.equal(stats.faltas, 1);

  // 4. Register red card -> excludes player and removes from onCourt
  const redRes = applyMatchLiveEvent({
    match: foulRes.updatedMatch,
    sportType: 'futbol7',
    side: 'home',
    actionType: 'ROJA',
    teamName: 'Ingeniería FC',
    player,
    eventId: 'ev-red-1',
  });
  assert.equal(redRes.statDelta.tarjetasRojas, 1);
  assert.ok(redRes.updatedMatch.liveState?.excludedPlayerIds?.home.includes('p-9'));
  assert.ok(!redRes.updatedMatch.liveState?.onCourt.home.includes('p-9'));
  stats = applyStatDeltaClamped(stats, redRes.statDelta);
  assert.equal(stats.tarjetasRojas, 1);

  // 5. Revert red card -> clears exclusion
  const revRed = revertMatchLiveEvent({
    match: redRes.updatedMatch,
    sportType: 'futbol7',
    eventId: 'ev-red-1',
  });
  assert.ok(revRed);
  assert.equal(revRed.statDelta.tarjetasRojas, -1);
  assert.ok(!revRed.updatedMatch.liveState?.excludedPlayerIds?.home.includes('p-9'));
  stats = applyStatDeltaClamped(stats, revRed.statDelta);
  assert.equal(stats.tarjetasRojas, 0);

  // 6. Revert goal -> decrements both homeScore and periods[0].home
  const revGoal = revertMatchLiveEvent({
    match: revRed.updatedMatch,
    sportType: 'futbol7',
    eventId: 'ev-goal-1',
  });
  assert.ok(revGoal);
  assert.equal(revGoal.updatedMatch.homeScore, 0);
  assert.equal(revGoal.updatedMatch.periods[0].home, 0);
  assert.equal(revGoal.statDelta.goles, -1);

  // 7. 2nd yellow card also triggers exclusion
  const y1 = applyMatchLiveEvent({
    match: revGoal.updatedMatch,
    sportType: 'futbol7',
    side: 'home',
    actionType: 'AMARILLA',
    teamName: 'Ingeniería FC',
    player: teammate,
    eventId: 'ev-y1',
  });
  assert.ok(!y1.updatedMatch.liveState?.excludedPlayerIds?.home.includes('p-10'));
  const y2 = applyMatchLiveEvent({
    match: y1.updatedMatch,
    sportType: 'futbol7',
    side: 'home',
    actionType: 'AMARILLA',
    teamName: 'Ingeniería FC',
    player: teammate,
    eventId: 'ev-y2',
  });
  assert.ok(y2.updatedMatch.liveState?.excludedPlayerIds?.home.includes('p-10'));
  assert.match(y2.event.detail, /Expulsión/);
});

test('Player substitution swaps on-court/bench players, blocks expelled players, and cleanly reverts', () => {
  const outP = { id: 'p-1', nombre: 'Felipe', apellidoPaterno: 'Soto', dorsal: 7 };
  const inP = { id: 'p-8', nombre: 'Bastián', apellidoPaterno: 'Muñoz', dorsal: 14 };
  const expelledP = { id: 'p-9', nombre: 'Tomás', apellidoPaterno: 'Vega', dorsal: 9 };

  let match = setTeamOnCourtPlayers(baseMatch(), 'futbol7', 'home', ['p-1', 'p-2', 'p-3']);
  // Mark p-9 as excluded via red card
  match = applyMatchLiveEvent({
    match,
    sportType: 'futbol7',
    side: 'home',
    actionType: 'ROJA',
    teamName: 'Ingeniería FC',
    player: expelledP,
    eventId: 'ev-red-9',
  }).updatedMatch;

  // Reject substituting in an expelled player
  const blocked = applyPlayerSubstitution({
    match,
    sportType: 'futbol7',
    side: 'home',
    teamName: 'Ingeniería FC',
    playerOut: outP,
    playerIn: expelledP,
  });
  assert.equal(blocked.ok, false);

  // Valid substitution: p-1 out -> p-8 in
  const sub = applyPlayerSubstitution({
    match,
    sportType: 'futbol7',
    side: 'home',
    teamName: 'Ingeniería FC',
    playerOut: outP,
    playerIn: inP,
    eventId: 'ev-sub-1',
  });
  assert.equal(sub.ok, true);
  if (!sub.ok) return;
  assert.equal(sub.updatedMatch.status, 'EN_VIVO');
  assert.ok(!sub.updatedMatch.liveState?.onCourt.home.includes('p-1'));
  assert.ok(sub.updatedMatch.liveState?.onCourt.home.includes('p-8'));
  assert.equal(sub.updatedMatch.liveState?.substitutionsCount?.home, 1);
  assert.equal(sub.event.type, 'CAMBIO');
  assert.equal(sub.event.playerId, 'p-8');
  assert.equal(sub.event.playerOutId, 'p-1');

  // Revert substitution -> restores p-1 on court, removes p-8, decrements count
  const reverted = revertMatchLiveEvent({
    match: sub.updatedMatch,
    sportType: 'futbol7',
    eventId: 'ev-sub-1',
  });
  assert.ok(reverted);
  assert.ok(reverted.updatedMatch.liveState?.onCourt.home.includes('p-1'));
  assert.ok(!reverted.updatedMatch.liveState?.onCourt.home.includes('p-8'));
  assert.equal(reverted.updatedMatch.liveState?.substitutionsCount?.home, 0);
});

test('Basquetbol 5x5: +3 triple, rebound, bonus at 5 quarter fouls, 5th personal foul exclusion, and quarter advance resets period fouls', () => {
  const player = { id: 'p-23', nombre: 'Lucas', apellidoPaterno: 'Mora', dorsal: 23 };
  let match = baseMatch({
    disciplineId: 'basquet-h',
    status: 'EN_VIVO',
    periodLabel: '2° Cuarto',
    clock: '06:40',
    homeScore: 18,
    awayScore: 15,
    periods: [
      { home: 12, away: 10 },
      { home: 6, away: 5 },
    ],
  });
  match = setTeamOnCourtPlayers(match, 'basquetbol', 'away', ['p-23']);

  const applied = applyMatchLiveEvent({
    match,
    sportType: 'basquetbol',
    side: 'away',
    actionType: 'PUNTO_3',
    pointsDelta: 3,
    teamName: 'Derecho Basket',
    player,
    eventId: 'ev-3pt',
  });
  assert.equal(applied.updatedMatch.awayScore, 18);
  assert.equal(applied.updatedMatch.periods[1].away, 8);
  assert.equal(applied.statDelta.puntos, 3);
  assert.equal(applied.statDelta.triples, 1);

  const reb = applyMatchLiveEvent({
    match: applied.updatedMatch,
    sportType: 'basquetbol',
    side: 'away',
    actionType: 'REBOTE',
    teamName: 'Derecho Basket',
    player,
    eventId: 'ev-reb-1',
  });
  assert.equal(reb.statDelta.rebotes, 1);

  // Accumulate 5 personal & quarter fouls -> Bonus active + player fouled out
  let mFoul = reb.updatedMatch;
  for (let i = 1; i <= 5; i++) {
    mFoul = applyMatchLiveEvent({
      match: mFoul,
      sportType: 'basquetbol',
      side: 'away',
      actionType: 'FALTA',
      teamName: 'Derecho Basket',
      player,
      eventId: `ev-f-${i}`,
    }).updatedMatch;
  }
  assert.equal(mFoul.liveState?.periodFouls?.away, 5);
  assert.equal(getBasketballBonusStatus('basquetbol', 5), 'BONUS');
  assert.ok(mFoul.liveState?.excludedPlayerIds?.away.includes('p-23'));
  assert.ok(!mFoul.liveState?.onCourt.away.includes('p-23'));

  // Advancing to 3° Cuarto resets quarter fouls to 0
  const nextQ = advanceMatchPeriod(mFoul, 'basquetbol');
  assert.equal(nextQ.periodLabel, '3° Cuarto');
  assert.equal(nextQ.periods.length, 3);
  assert.equal(nextQ.liveState?.periodFouls?.away, 0);

  // Revert 3-pointer cleanly
  const reverted = revertMatchLiveEvent({
    match: applied.updatedMatch,
    sportType: 'basquetbol',
    eventId: 'ev-3pt',
  });
  assert.ok(reverted);
  assert.equal(reverted.updatedMatch.awayScore, 15);
  assert.equal(reverted.updatedMatch.periods[1].away, 5);
  assert.equal(reverted.statDelta.triples, -1);
});

test('Basquetbol 3x3: +1/+2 scoring, 21-point target detection, and Bonus (7) / Double Bonus (10)', () => {
  const player = { id: 'p-5', nombre: 'Sofía', apellidoPaterno: 'Paredes', dorsal: 5 };
  const match = baseMatch({
    disciplineId: 'basquet-3x3-m',
    status: 'EN_VIVO',
    periodLabel: 'Tiempo Regular 3x3',
    clock: '03:12',
    homeScore: 19,
    awayScore: 16,
    periods: [{ home: 19, away: 16 }],
  });

  assert.equal(getBasketballBonusStatus('basquetbol3x3', 6), 'NONE');
  assert.equal(getBasketballBonusStatus('basquetbol3x3', 7), 'BONUS');
  assert.equal(getBasketballBonusStatus('basquetbol3x3', 10), 'DOUBLE_BONUS');

  const hit21 = applyMatchLiveEvent({
    match,
    sportType: 'basquetbol3x3',
    side: 'home',
    actionType: 'PUNTO_2',
    pointsDelta: 2,
    teamName: 'Medicina 3x3',
    player,
    eventId: 'ev-3x3-win',
  });
  assert.equal(hit21.updatedMatch.homeScore, 21);
  assert.match(hit21.updatedMatch.periodLabel, /Meta 21/);
  assert.match(hit21.event.detail, /Exterior/);

  const undone = revertMatchLiveEvent({
    match: hit21.updatedMatch,
    sportType: 'basquetbol3x3',
    eventId: 'ev-3x3-win',
  });
  assert.ok(undone);
  assert.equal(undone.updatedMatch.homeScore, 19);
  assert.equal(undone.updatedMatch.periodLabel, 'Tiempo Regular 3x3');
});

test('Voleibol: serve transfer, Set Point & Match Point detection, set-win reset of timeouts/subs, and clean undo', () => {
  const player = { id: 'p-7', nombre: 'Camila', apellidoPaterno: 'Díaz', dorsal: 7 };
  const match = baseMatch({
    disciplineId: 'voley-m',
    status: 'EN_VIVO',
    periodLabel: 'Set 1',
    clock: 'Set 1',
    homeScore: 0,
    awayScore: 0,
    timeouts: { home: 2, away: 1 },
    periods: [{ home: 24, away: 20 }],
    liveState: {
      onCourt: { home: ['p-7'], away: [] },
      servingSide: 'away',
      substitutionsCount: { home: 3, away: 2 },
    },
  });

  // 24-20 in Set 1 -> Home Set Point!
  const sp = getVolleyballSetPointStatus(match);
  assert.deepEqual(sp, { side: 'home', kind: 'SET_POINT', setNumber: 1 });

  const wonSet = applyMatchLiveEvent({
    match,
    sportType: 'voleibol',
    side: 'home',
    actionType: 'ACE',
    teamName: 'Medicina Voley',
    player,
    eventId: 'ev-set1-win',
  });

  assert.equal(wonSet.updatedMatch.homeScore, 1);
  assert.equal(wonSet.updatedMatch.periods.length, 2);
  assert.equal(wonSet.updatedMatch.periods[0].home, 25);
  assert.equal(wonSet.updatedMatch.liveState?.servingSide, 'home');
  assert.equal(wonSet.updatedMatch.timeouts.home, 0);
  assert.equal(wonSet.updatedMatch.liveState?.substitutionsCount?.home, 0);
  assert.equal(wonSet.event.triggeredSetWin, true);

  // Match point detection when leading 1-0 and 24-22 in Set 2
  const matchPointCheck = getVolleyballSetPointStatus({
    ...wonSet.updatedMatch,
    periods: [
      { home: 25, away: 20 },
      { home: 24, away: 22 },
    ],
  });
  assert.deepEqual(matchPointCheck, { side: 'home', kind: 'MATCH_POINT', setNumber: 2 });

  const reverted = revertMatchLiveEvent({
    match: wonSet.updatedMatch,
    sportType: 'voleibol',
    eventId: 'ev-set1-win',
  });
  assert.ok(reverted);
  assert.equal(reverted.updatedMatch.homeScore, 0);
  assert.equal(reverted.updatedMatch.periods.length, 1);
  assert.equal(reverted.updatedMatch.periods[0].home, 24);
  assert.equal(reverted.updatedMatch.periodLabel, 'Set 1');
  assert.equal(reverted.statDelta.aces, -1);
  assert.equal(reverted.statDelta.puntos, -1);
});

test('Helpers: autoSelectStartingLineup, formatMatchClock, computePlayerMatchCounters, and applyStatDeltaClamped', () => {
  const roster = [
    { id: 'p-10', dorsal: 10, posicion: 'Delantero' },
    { id: 'p-1', dorsal: 12, posicion: 'Portero' },
    { id: 'p-4', dorsal: 4, posicion: 'Defensa' },
  ];
  const starters = autoSelectStartingLineup(roster, 'futbol7');
  assert.equal(starters[0], 'p-1'); // Goalkeeper prioritized first

  assert.equal(formatMatchClock(25 * 60 + 12, 'futbol7', 2), "25:12 +2'");
  assert.equal(formatMatchClock(545, 'basquetbol'), '09:05');

  const counters = computePlayerMatchCounters([
    { id: 'e1', minuteOrPeriod: 'Q1', teamId: 't1', playerId: 'p1', type: 'PUNTO_3', detail: '+3', pointsDelta: 3 },
    { id: 'e2', minuteOrPeriod: 'Q1', teamId: 't1', playerId: 'p1', type: 'REBOTE', detail: 'Reb' },
  ]);
  assert.equal(counters['p1'].points, 3);
  assert.equal(counters['p1'].triples, 1);
  assert.equal(counters['p1'].rebounds, 1);

  const clamped = applyStatDeltaClamped(emptyStats(), {
    goles: -5,
    asistencias: -2,
    rebotes: -4,
    tarjetasRojas: -2,
    faltas: -3,
  });
  assert.equal(clamped.goles, 0);
  assert.equal(clamped.asistencias, 0);
  assert.equal(clamped.rebotes, 0);
  assert.equal(clamped.tarjetasRojas, 0);
  assert.equal(clamped.faltas, 0);
});
