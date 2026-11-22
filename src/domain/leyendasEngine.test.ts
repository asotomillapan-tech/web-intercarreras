import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLeaderboardEntryFromCareer,
  buildLeyendasTeamsFromTournament,
  buildTryoutPool,
  buildWeeklyLeaderboardViews,
  calculateCareerLeaderboardScore,
  computeCreativeLegacyBanner,
  createInitialCareerState,
  drawSemesterFocusCards,
  evaluateSportsScholarship,
  formatWeeklyCountdown,
  getChileWeekInfo,
  getPostgradEligibility,
  getTrialAcceptanceChance,
  inferCareerYears,
  pickContextualKeyMoment,
  pickSemesterEvent,
  resolveKeyMomentChoice,
  simulateSemesterFull,
} from './leyendasEngine.ts';
import type { Match, Team } from '../types/tournament.ts';

const SAMPLE_TEAMS: Team[] = [
  {
    id: 'eq-ind-1',
    nombre: 'Industrial FC Real',
    sigla: 'IND',
    disciplineId: 'f7-h-1',
    carrera: 'Ingeniería Civil Industrial',
    facultad: 'Facultad de Ingeniería y Ciencias',
    groupName: 'Grupo A',
    logrosAnteriores: 'Campeón 2025',
  },
  {
    id: 'eq-med-1',
    nombre: 'Medicina Real',
    sigla: 'MED',
    disciplineId: 'f7-h-1',
    carrera: 'Medicina',
    facultad: 'Facultad de Medicina',
    groupName: 'Grupo A',
  },
  {
    id: 'eq-fem-1',
    nombre: 'Kine Damas Real',
    sigla: 'KIN',
    disciplineId: 'f7-m',
    carrera: 'Kinesiología',
    facultad: 'Facultad de Medicina',
    groupName: 'Grupo A',
  },
];

const SAMPLE_MATCHES: Match[] = [
  {
    id: 'm1',
    disciplineId: 'f7-h-1',
    groupName: 'Grupo A',
    fase: 'Grupos',
    jornada: 1,
    fecha: '2026-05-01',
    hora: '18:00',
    cancha: 'Cancha 1',
    homeTeamId: 'eq-ind-1',
    awayTeamId: 'eq-med-1',
    homeScore: 4,
    awayScore: 1,
    status: 'FINALIZADO',
    periodLabel: 'Final',
    clock: "50'",
    periods: [],
    fouls: { home: 2, away: 3 },
    timeouts: { home: 0, away: 0 },
    events: [],
    refereeId: 'ref-f7-1',
  },
];

describe('leyendasEngine', () => {
  it('hydrates real platform teams with win-rate OVR and fills sparse divisions cleanly', () => {
    const clubs = buildLeyendasTeamsFromTournament(SAMPLE_TEAMS, SAMPLE_MATCHES);
    const ind = clubs.find((c) => c.realTeamId === 'eq-ind-1');
    const med = clubs.find((c) => c.realTeamId === 'eq-med-1');
    assert.ok(ind && ind.isRealTeam);
    assert.ok(med && med.isRealTeam);
    assert.ok(ind.ovr > med.ovr, 'Winning champion team should have higher OVR than losing team');

    // Empty discipline (voley-h) must still have at least 8 clubs
    const voleyH = clubs.filter((c) => c.disciplineId === 'voley-h');
    assert.ok(voleyH.length >= 8);
  });

  it('infers UFRO career durations accurately', () => {
    assert.equal(inferCareerYears('Medicina'), 7);
    assert.equal(inferCareerYears('Ingeniería Civil Informática'), 6);
    assert.equal(inferCareerYears('Derecho'), 6);
    assert.equal(inferCareerYears('Periodismo'), 5);
  });

  it('activates Mathias Bello 90 OVR easter egg and builds tryout pools', () => {
    const clubs = buildLeyendasTeamsFromTournament(SAMPLE_TEAMS, SAMPLE_MATCHES);
    const pool = buildTryoutPool(clubs, 'futbol', 'hombre', 'Ingeniería Civil Industrial', () => 0.4);
    assert.equal(pool.length, 4);
    assert.ok(pool.some((c) => c.realTeamId === 'eq-ind-1'));

    const career = createInitialCareerState({
      playerName: 'Mathias Bello',
      careerName: 'Ingeniería Civil Industrial',
      sportKey: 'futbol',
      branch: 'hombre',
      pos: 'DEL',
      team: pool[0],
      allClubs: clubs,
      rng: () => 0.5,
    });
    assert.equal(career.ovr, 90);
    assert.equal(career.totalSemesters, 12);
    assert.ok(career.hasScholarship);
  });

  it('computes trial acceptance chance with own-career bonus', () => {
    const base = getTrialAcceptanceChance(66, 78, false);
    const own = getTrialAcceptanceChance(66, 78, true);
    assert.ok(own > base);
    assert.ok(base >= 16 && own <= 96);
  });

  it('draws 4 tiered focus cards and resolves key moments & full semesters cleanly', () => {
    const clubs = buildLeyendasTeamsFromTournament(SAMPLE_TEAMS, SAMPLE_MATCHES);
    const team = clubs.find((c) => c.realTeamId === 'eq-ind-1')!;
    const initial = createInitialCareerState({
      playerName: 'Lucas Morales',
      careerName: 'Medicina',
      sportKey: 'futbol',
      branch: 'hombre',
      pos: 'DEL',
      team,
      allClubs: clubs,
      rng: () => 0.5,
    });

    const cards = drawSemesterFocusCards(() => 0.25);
    assert.equal(cards.length, 4);
    assert.equal(cards[0].tier, 'ORO');

    const ev = pickSemesterEvent(initial, () => 0.3);
    assert.ok(ev.options.length >= 2);

    const km = pickContextualKeyMoment(initial, () => 0.1);
    const res = resolveKeyMomentChoice(initial.ovr, km.choices[0], () => 0.1);
    assert.equal(res.success, true);

    const afterS1 = simulateSemesterFull({
      career: initial,
      allClubs: clubs,
      focusCard: cards[0],
      eventDelta: { ovrDelta: 3, gpaDelta: 0.2, statBonus: 2 },
      momentDelta: { ovrDelta: res.ovrDelta, statBoost: res.statBoost },
      rng: () => 0.4,
    });

    assert.equal(afterS1.semestersPlayed, 1);
    assert.equal(afterS1.semester, 2);
    assert.ok(afterS1.stats.m > 0);
    assert.ok(afterS1.lastSemesterCelebration !== null);
  });

  it('evaluates sports scholarship, postgrad eligibility, legacy banner, and weekly ranking', () => {
    assert.equal(evaluateSportsScholarship(80, 5.4), true);
    assert.equal(evaluateSportsScholarship(72, 6.0), false);

    const clubs = buildLeyendasTeamsFromTournament(SAMPLE_TEAMS, SAMPLE_MATCHES);
    const team = clubs.find((c) => c.realTeamId === 'eq-ind-1')!;
    const career = createInitialCareerState({
      playerName: 'Valentina Millapán',
      careerName: 'Kinesiología',
      sportKey: 'futbol',
      branch: 'mujer',
      pos: 'MED',
      team,
      allClubs: clubs,
      rng: () => 0.5,
    });
    career.ovr = 96;
    career.maxOvr = 101;
    career.trophies = [
      { id: 't1', title: 'Campeón Intercarreras', year: 2026, team: team.name },
      { id: 't2', title: 'Copa Facultad', year: 2027, team: team.name },
    ];
    assert.equal(getPostgradEligibility(career), 'MAGISTER');

    const legacy = computeCreativeLegacyBanner(career);
    assert.equal(legacy.tier, 'GOAT');

    const score = calculateCareerLeaderboardScore(career);
    assert.ok(score > 2500);

    const now = new Date('2026-06-10T15:00:00Z');
    const week = getChileWeekInfo(now);
    assert.match(week.weekKey, /^\d{4}-W\d{2}$/);
    assert.ok(week.msRemaining > 0);
    assert.match(formatWeeklyCountdown(week.msRemaining), /^\d+d \d{2}h \d{2}m \d{2}s$/);

    const entry = buildLeaderboardEntryFromCareer(career, 'uid-test-123', now);
    const view = buildWeeklyLeaderboardViews([entry], week.weekKey, 'futbol-m');
    assert.equal(view.length, 1);
    assert.equal(view[0].playerName, 'Valentina Millapán');
  });
});
