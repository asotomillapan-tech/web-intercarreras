import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMatchLiveEvent,
  applyStatDeltaClamped,
  revertMatchLiveEvent,
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

test('Futbol 7: applies and cleanly reverts Gol, Falta, and Tarjeta Roja with player stat deltas', () => {
  const player = { id: 'p-9', nombre: 'Matías', apellidoPaterno: 'Rojas', dorsal: 9 };
  let stats = emptyStats();

  // 1. Register goal
  const goalRes = applyMatchLiveEvent({
    match: baseMatch(),
    sportType: 'futbol7',
    side: 'home',
    actionType: 'GOL',
    teamName: 'Ingeniería FC',
    player,
    eventId: 'ev-goal-1',
  });
  assert.equal(goalRes.updatedMatch.status, 'EN_VIVO');
  assert.equal(goalRes.updatedMatch.homeScore, 1);
  assert.equal(goalRes.statDelta.goles, 1);
  stats = applyStatDeltaClamped(stats, goalRes.statDelta);
  assert.equal(stats.goles, 1);

  // 2. Register foul
  const foulRes = applyMatchLiveEvent({
    match: goalRes.updatedMatch,
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

  // 3. Register red card
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
  stats = applyStatDeltaClamped(stats, redRes.statDelta);
  assert.equal(stats.tarjetasRojas, 1);
  assert.equal(redRes.updatedMatch.events.length, 3);

  // 4. Revert red card
  const revRed = revertMatchLiveEvent({
    match: redRes.updatedMatch,
    sportType: 'futbol7',
    eventId: 'ev-red-1',
  });
  assert.ok(revRed);
  assert.equal(revRed.statDelta.tarjetasRojas, -1);
  stats = applyStatDeltaClamped(stats, revRed.statDelta);
  assert.equal(stats.tarjetasRojas, 0);
  assert.equal(revRed.updatedMatch.events.length, 2);

  // 5. Revert goal (out of order — even when foul was recorded after)
  const revGoal = revertMatchLiveEvent({
    match: revRed.updatedMatch,
    sportType: 'futbol7',
    eventId: 'ev-goal-1',
  });
  assert.ok(revGoal);
  assert.equal(revGoal.updatedMatch.homeScore, 0);
  assert.equal(revGoal.statDelta.goles, -1);
  stats = applyStatDeltaClamped(stats, revGoal.statDelta);
  assert.equal(stats.goles, 0);

  // 6. Revert foul
  const revFoul = revertMatchLiveEvent({
    match: revGoal.updatedMatch,
    sportType: 'futbol7',
    eventId: 'ev-foul-1',
  });
  assert.ok(revFoul);
  assert.equal(revFoul.updatedMatch.fouls.home, 0);
  stats = applyStatDeltaClamped(stats, revFoul.statDelta);
  assert.equal(stats.faltas, 0);
  assert.equal(revFoul.updatedMatch.events.length, 0);
});

test('Basquetbol: applies and reverts +3 triple updating period score, total score, and triples stat', () => {
  const player = { id: 'p-23', nombre: 'Lucas', apellidoPaterno: 'Mora', dorsal: 23 };
  const match = baseMatch({
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

  const reverted = revertMatchLiveEvent({
    match: applied.updatedMatch,
    sportType: 'basquetbol',
    eventId: 'ev-3pt',
  });
  assert.ok(reverted);
  assert.equal(reverted.updatedMatch.awayScore, 15);
  assert.equal(reverted.updatedMatch.periods[1].away, 5);
  assert.equal(reverted.statDelta.puntos, -3);
  assert.equal(reverted.statDelta.triples, -1);
});

test('Voleibol: reverting a set-winning Ace restores set count, removes empty next set, and decrements set score', () => {
  const player = { id: 'p-7', nombre: 'Camila', apellidoPaterno: 'Díaz', dorsal: 7 };
  const match = baseMatch({
    disciplineId: 'voley-m',
    status: 'EN_VIVO',
    periodLabel: 'Set 1',
    clock: 'Set 1',
    homeScore: 0,
    awayScore: 0,
    periods: [{ home: 24, away: 20 }],
  });

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
  assert.equal(wonSet.event.triggeredSetWin, true);

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

test('applyStatDeltaClamped never drops any stat below zero', () => {
  const clamped = applyStatDeltaClamped(emptyStats(), {
    goles: -5,
    tarjetasRojas: -2,
    faltas: -3,
  });
  assert.equal(clamped.goles, 0);
  assert.equal(clamped.tarjetasRojas, 0);
  assert.equal(clamped.faltas, 0);
});
