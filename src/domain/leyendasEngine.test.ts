import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyGradualOvrDelta,
  buildCareerTryoutList,
  buildLeaderboardEntryFromCareer,
  buildLeyendasTeamsFromTournament,
  buildTryoutPool,
  buildWeeklyLeaderboardViews,
  calculateCareerLeaderboardScore,
  computeCreativeLegacyBanner,
  createInitialCareerState,
  drawSemesterFocusCards,
  evaluateCoachRenewal,
  evaluateSportsScholarship,
  evaluateVisualMiniGameOutcome,
  formatWeeklyCountdown,
  getCareerExclusiveEvent,
  getChileWeekInfo,
  getPostgradEligibility,
  getTrialAcceptanceChance,
  getVisualMiniGameScenario,
  inferCareerYears,
  pickContextualKeyMoment,
  pickSemesterEvent,
  resolveKeyMomentChoice,
  rollSportInjury,
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
    id: 'eq-ind-2',
    nombre: 'Industrial B',
    sigla: 'INB',
    disciplineId: 'f7-h-2',
    carrera: 'Ingeniería Civil Industrial',
    facultad: 'Facultad de Ingeniería y Ciencias',
    groupName: 'Grupo A',
  },
  {
    id: 'eq-ind-3',
    nombre: 'Industrial C',
    sigla: 'INC',
    disciplineId: 'f7-h-3',
    carrera: 'Ingeniería Civil Industrial',
    facultad: 'Facultad de Ingeniería y Ciencias',
    groupName: 'Grupo A',
  },
  {
    id: 'eq-ind-4',
    nombre: 'Industrial Mechones',
    sigla: 'INM',
    disciplineId: 'f7-h-3',
    carrera: 'Ingeniería Civil Industrial',
    facultad: 'Facultad de Ingeniería y Ciencias',
    groupName: 'Grupo B',
  },
  {
    id: 'eq-ind-5',
    nombre: 'Industrial Seniors',
    sigla: 'INS',
    disciplineId: 'f7-h-2',
    carrera: 'Ingeniería Civil Industrial',
    facultad: 'Facultad de Ingeniería y Ciencias',
    groupName: 'Grupo B',
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

    const voleyH = clubs.filter((c) => c.disciplineId === 'voley-h');
    assert.ok(voleyH.length >= 8);
  });

  it('infers UFRO career durations accurately', () => {
    assert.equal(inferCareerYears('Medicina'), 7);
    assert.equal(inferCareerYears('Ingeniería Civil Informática'), 6);
    assert.equal(inferCareerYears('Derecho'), 6);
    assert.equal(inferCareerYears('Periodismo'), 5);
  });

  it('returns ALL clubs of the selected career in tryouts without a 4-club cap', () => {
    const clubs = buildLeyendasTeamsFromTournament(SAMPLE_TEAMS, SAMPLE_MATCHES);
    const dir = buildCareerTryoutList(clubs, 'futbol', 'hombre', 'Ingeniería Civil Industrial');
    assert.ok(
      dir.careerClubs.length >= 5,
      `Expected all 5+ Industrial clubs, got ${dir.careerClubs.length}`
    );
    assert.ok(dir.careerClubs.some((c) => c.realTeamId === 'eq-ind-1'));
    assert.ok(dir.careerClubs.some((c) => c.realTeamId === 'eq-ind-5'));
    assert.ok(dir.otherCampusClubs.length > 0);

    // Even a career with 0 pre-existing teams still gets its own canonical career club
    const customDir = buildCareerTryoutList(clubs, 'voley', 'mujer', 'Biotecnología');
    assert.equal(customDir.careerClubs.length, 1);
    assert.equal(customDir.careerClubs[0].carrera, 'Biotecnología');
  });

  it('activates Mathias Bello 90 OVR easter egg and builds tryout pools', () => {
    const clubs = buildLeyendasTeamsFromTournament(SAMPLE_TEAMS, SAMPLE_MATCHES);
    const pool = buildTryoutPool(clubs, 'futbol', 'hombre', 'Ingeniería Civil Industrial');
    assert.ok(pool.length >= 5);
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

  it('applies gradual OVR progression with no abrupt jumps and elite diminishing returns', () => {
    const bigRaw = applyGradualOvrDelta(68, 9, 99);
    assert.ok(bigRaw.appliedDelta <= 3, 'Single step OVR gain must be capped at +3');
    assert.equal(bigRaw.nextOvr, 71);

    const elite = applyGradualOvrDelta(96, 3, 105);
    assert.equal(elite.appliedDelta, 1, 'At >=95 OVR gains must progress smoothly by +1');
    assert.equal(elite.nextOvr, 97);

    const bigDrop = applyGradualOvrDelta(75, -8, 99);
    assert.equal(bigDrop.appliedDelta, -3, 'Single step OVR drop must be capped at -3');
  });

  it('provides distinct career-exclusive UFRO events across diverse careers', () => {
    const odo = getCareerExclusiveEvent('Odontología', 0);
    const inf = getCareerExclusiveEvent('Ingeniería Civil Informática', 0);
    const kine = getCareerExclusiveEvent('Kinesiología', 1);
    const agro = getCareerExclusiveEvent('Agronomía', 0);
    const der = getCareerExclusiveEvent('Derecho', 0);
    assert.match(odo.tag, /ODONTOLOGÍA/i);
    assert.match(inf.tag, /INFORMÁTICA/i);
    assert.match(kine.tag, /SALUD/i);
    assert.match(agro.tag, /MAQUEHUE|AGRO/i);
    assert.match(der.tag, /DERECHO/i);
  });

  it('computes trial acceptance chance with own-career bonus', () => {
    const base = getTrialAcceptanceChance(66, 78, false);
    const own = getTrialAcceptanceChance(66, 78, true);
    assert.ok(own > base);
    assert.ok(base >= 16 && own <= 96);
  });

  it('handles injuries, recovery events, and coach non-renewal cleanly', () => {
    const clubs = buildLeyendasTeamsFromTournament(SAMPLE_TEAMS, SAMPLE_MATCHES);
    const topTeam = clubs.find((c) => c.realTeamId === 'eq-ind-1')!;
    const initial = createInitialCareerState({
      playerName: 'Diego Cárdenas',
      careerName: 'Medicina',
      sportKey: 'futbol',
      branch: 'hombre',
      pos: 'DEL',
      team: topTeam,
      allClubs: clubs,
      rng: () => 0.5,
    });

    const inj = rollSportInjury('futbol', 'MEDIA', () => 0.2);
    assert.equal(inj.severity, 'MEDIA');
    assert.ok(inj.name.length > 5);

    const injuredCareer = { ...initial, activeInjury: inj };
    const recoveryEvent = pickSemesterEvent(injuredCareer, () => 0.5);
    assert.equal(recoveryEvent.category, 'LESION');
    assert.equal(recoveryEvent.options.length, 2);

    // Underperforming Reserva player at a high-OVR club gets released by DT
    const weakCareer = {
      ...initial,
      ovr: 64,
      role: 'Reserva' as const,
      team: { ...topTeam, ovr: 85 },
    };
    const cutRes = evaluateCoachRenewal({
      career: weakCareer,
      perfRoll: 62,
      wasInjured: true,
      momentSuccess: false,
      rng: () => 0.1,
    });
    assert.equal(cutRes.renewed, false);
    assert.ok(cutRes.coachQuote.length > 20);

    // Star player is renewed
    const starCareer = { ...initial, ovr: 89, role: 'Figura' as const };
    const keepRes = evaluateCoachRenewal({
      career: starCareer,
      perfRoll: 84,
      wasInjured: false,
      momentSuccess: true,
      rng: () => 0.01,
    });
    assert.equal(keepRes.renewed, true);
  });

  it('rotates across diverse visual mini-games across all 3 sports and never repeats back-to-back', () => {
    const clubs = buildLeyendasTeamsFromTournament(SAMPLE_TEAMS, SAMPLE_MATCHES);
    const team = clubs.find((c) => c.realTeamId === 'eq-ind-1')!;
    const delCareer = createInitialCareerState({
      playerName: 'Lucas Morales',
      careerName: 'Ingeniería Civil Industrial',
      sportKey: 'futbol',
      branch: 'hombre',
      pos: 'DEL',
      team,
      allClubs: clubs,
      rng: () => 0.5,
    });

    // Football field players get 4 distinct kinds: one_on_one, free_kick, penalty_kick, goal_line_tackle
    const futbolKinds = new Set<string>();
    for (const seed of [0.05, 0.3, 0.6, 0.9]) {
      const sc = getVisualMiniGameScenario(delCareer, () => seed);
      futbolKinds.add(sc.kind);
      assert.ok(sc.actionButtonLabel.length > 3);
      assert.equal(sc.actionChoices?.length, 3);
      const perfect = evaluateVisualMiniGameOutcome(sc, 'PERFECT');
      const good = evaluateVisualMiniGameOutcome(sc, 'GOOD');
      const miss = evaluateVisualMiniGameOutcome(sc, 'MISS');
      assert.equal(perfect.success, true);
      assert.equal(perfect.ovrDelta, 2);
      assert.equal(good.success, true);
      assert.equal(good.ovrDelta, 1);
      assert.equal(miss.success, false);
      assert.equal(miss.ovrDelta, -1);
    }
    assert.equal(futbolKinds.size, 4, 'Football field players must have 4 distinct mini-games');

    // Non-repeating rotation check: passing lastKind never returns the same kind
    const first = getVisualMiniGameScenario(delCareer, () => 0.1);
    for (const seed of [0.0, 0.25, 0.5, 0.75, 0.99]) {
      const next = getVisualMiniGameScenario(delCareer, () => seed, first.kind);
      assert.notEqual(next.kind, first.kind, 'Consecutive semesters must not repeat the same mini-game');
    }

    // Football goalkeeper has 2 distinct mini-games (penalty_save & keeper_reflex)
    const arq1 = getVisualMiniGameScenario({ ...delCareer, pos: 'ARQ' }, () => 0.1);
    const arq2 = getVisualMiniGameScenario({ ...delCareer, pos: 'ARQ' }, () => 0.1, arq1.kind);
    assert.notEqual(arq1.kind, arq2.kind);
    assert.ok(['penalty_save', 'keeper_reflex'].includes(arq1.kind));
    assert.ok(['penalty_save', 'keeper_reflex'].includes(arq2.kind));

    // Basketball has 3 distinct mini-games
    const bkKinds = new Set<string>();
    for (const seed of [0.05, 0.5, 0.9]) {
      const sc = getVisualMiniGameScenario({ ...delCareer, sportKey: 'basquet', pos: 'BASE' }, () => seed);
      bkKinds.add(sc.kind);
      assert.equal(evaluateVisualMiniGameOutcome(sc, 'PERFECT').success, true);
    }
    assert.equal(bkKinds.size, 3, 'Basketball must have 3 distinct mini-games');

    // Volleyball has 3 distinct mini-games
    const vlKinds = new Set<string>();
    for (const seed of [0.05, 0.5, 0.9]) {
      const sc = getVisualMiniGameScenario({ ...delCareer, sportKey: 'voley', pos: 'PUN' }, () => seed);
      vlKinds.add(sc.kind);
      assert.equal(evaluateVisualMiniGameOutcome(sc, 'PERFECT').success, true);
    }
    assert.equal(vlKinds.size, 3, 'Volleyball must have 3 distinct mini-games');
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
      eventDelta: { ovrDelta: 2, gpaDelta: 0.2, statBonus: 2 },
      momentDelta: { ovrDelta: res.ovrDelta, statBoost: res.statBoost, success: res.success },
      rng: () => 0.4,
    });

    assert.equal(afterS1.semestersPlayed, 1);
    assert.equal(afterS1.semester, 2);
    assert.ok(afterS1.stats.m > 0);
    assert.ok(afterS1.lastSemesterCelebration !== null);
    assert.ok(afterS1.ovr - initial.ovr <= 3, 'OVR must grow smoothly per semester');
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

  it('never generates a recurring rival with the exact same name as the player', () => {
    const clubs = buildLeyendasTeamsFromTournament(SAMPLE_TEAMS, SAMPLE_MATCHES);
    const team = clubs.find((c) => c.realTeamId === 'eq-ind-1')!;
    for (let step = 0; step < 20; step++) {
      const seed = (step + 0.01) / 20;
      const career = createInitialCareerState({
        playerName: 'Lucas Morales',
        careerName: 'Ingeniería Civil Industrial',
        sportKey: 'futbol',
        branch: 'hombre',
        pos: 'DEL',
        team,
        allClubs: clubs,
        rng: () => seed,
      });
      assert.ok(career.rival !== null);
      assert.notEqual(
        career.rival.name.toLowerCase(),
        career.playerName.toLowerCase(),
        'Rival name must never duplicate player name'
      );
    }
  });
});
