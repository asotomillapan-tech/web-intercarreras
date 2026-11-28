import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOvrXpDelta,
  applyTacticToScenario,
  buildGauntletFinalResult,
  buildPlayoffGauntlet,
  generateMidSemesterDilemma,
  getOvrCapForCareer,
  getXpRequiredForNextOvr,
  OVR_STANDARD_CAP,
  resolveMidSemesterOption,
  shouldTriggerPlayoffGauntlet,
} from './leyendasSpecialModes.ts';
import type { LeyendasClub, LeyendasMiniGameScenario } from './leyendasEngine.ts';

function makeDeterministicRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const MOCK_CLUBS: LeyendasClub[] = [
  { id: 'c1', name: 'Industrial FC', sigla: 'IND', disciplineId: 'f7-h-1', sportKey: 'futbol', branch: 'hombre', div: '1ª Div', ovr: 82, carrera: 'Ingeniería Civil Industrial', facultad: 'FICA', isRealTeam: true },
  { id: 'c2', name: 'Medicina FC', sigla: 'MED', disciplineId: 'f7-h-1', sportKey: 'futbol', branch: 'hombre', div: '1ª Div', ovr: 80, carrera: 'Medicina', facultad: 'Medicina', isRealTeam: true },
  { id: 'c3', name: 'Derecho FC', sigla: 'DER', disciplineId: 'f7-h-1', sportKey: 'futbol', branch: 'hombre', div: '1ª Div', ovr: 78, carrera: 'Derecho', facultad: 'FCJE', isRealTeam: true },
  { id: 'c4', name: 'Ed. Física FC', sigla: 'EFI', disciplineId: 'f7-h-1', sportKey: 'futbol', branch: 'hombre', div: '1ª Div', ovr: 85, carrera: 'Ed. Física', facultad: 'FECSH', isRealTeam: true },
  { id: 'c5', name: 'Kine United', sigla: 'KIN', disciplineId: 'f7-h-1', sportKey: 'futbol', branch: 'hombre', div: '1ª Div', ovr: 75, carrera: 'Kinesiología', facultad: 'Medicina', isRealTeam: true },
  { id: 'c6', name: 'Informática FC', sigla: 'INF', disciplineId: 'f7-h-1', sportKey: 'futbol', branch: 'hombre', div: '1ª Div', ovr: 77, carrera: 'Informática', facultad: 'FICA', isRealTeam: true },
];

describe('leyendasSpecialModes — OVR Balance, Mid-Semester Crossroads & Rare Playoff Gauntlet', () => {
  it('enforces a steep OVR XP curve where early growth is smooth and reaching 99 OVR is extremely rare in Monte Carlo simulation', () => {
    assert.ok(getXpRequiredForNextOvr(65) < getXpRequiredForNextOvr(75));
    assert.ok(getXpRequiredForNextOvr(80) < getXpRequiredForNextOvr(90));
    assert.ok(getXpRequiredForNextOvr(92) < getXpRequiredForNextOvr(97));

    // Simulate 300 realistic 12-semester careers (6-year degree) with mixed outcomes
    const rng = makeDeterministicRng(42026);
    let maxReached = 0;
    let reached99Count = 0;
    let sumPeakOvr = 0;

    for (let run = 0; run < 300; run += 1) {
      let ovr = 63 + Math.floor(rng() * 4); // 63..66
      let progress = 0;
      let peak = ovr;
      let momentum = 0;

      for (let sem = 0; sem < 12; sem += 1) {
        // Focus card (+12..+42 XP)
        const focusXp = rng() < 0.35 ? 42 : rng() < 0.8 ? 26 : 12;
        let step = applyOvrXpDelta({ currentOvr: ovr, currentProgress: progress, xpDelta: focusXp, semestersPlayed: sem, momentum });
        ovr = step.nextOvr;
        progress = step.nextProgress;

        // Event (+18..+48 or -34 on risk fail)
        const eventXp = rng() < 0.72 ? 24 + Math.floor(rng() * 20) : -34;
        step = applyOvrXpDelta({ currentOvr: ovr, currentProgress: progress, xpDelta: eventXp, semestersPlayed: sem, momentum });
        ovr = step.nextOvr;
        progress = step.nextProgress;

        // Mid-semester crossroads (~60% trigger)
        if (rng() < 0.6) {
          const msXp = rng() < 0.65 ? 44 : -26;
          step = applyOvrXpDelta({ currentOvr: ovr, currentProgress: progress, xpDelta: msXp, semestersPlayed: sem, momentum });
          ovr = step.nextOvr;
          progress = step.nextProgress;
        }

        // Mini-game (22% PERFECT +52, 48% GOOD +24, 30% MISS -36)
        const mgRoll = rng();
        const mgXp = mgRoll < 0.22 ? 52 : mgRoll < 0.7 ? 24 : -36;
        momentum = mgRoll < 0.22 ? Math.min(3, momentum + 1) : mgRoll < 0.7 ? momentum : 0;
        step = applyOvrXpDelta({ currentOvr: ovr, currentProgress: progress, xpDelta: mgXp, semestersPlayed: sem, momentum });
        ovr = step.nextOvr;
        progress = step.nextProgress;

        // Occasional injury setback (~16% per semester)
        if (rng() < 0.16) {
          step = applyOvrXpDelta({ currentOvr: ovr, currentProgress: progress, xpDelta: -75, semestersPlayed: sem, momentum: 0 });
          ovr = step.nextOvr;
          progress = step.nextProgress;
        }

        if (ovr > peak) peak = ovr;
      }

      sumPeakOvr += peak;
      if (peak > maxReached) maxReached = peak;
      if (peak >= OVR_STANDARD_CAP) reached99Count += 1;
    }

    const avgPeak = sumPeakOvr / 300;
    assert.ok(avgPeak >= 72 && avgPeak <= 84, `Expected average 6-year peak OVR in 72..84, got ${avgPeak.toFixed(1)}`);
    assert.ok(reached99Count <= 3, `Hitting 99 OVR must be extremely rare (<1%), got ${reached99Count}/300`);
    assert.ok(maxReached < 99, `Normal 12-semester career should almost never cap at 99 (max=${maxReached})`);
  });

  it('unlocks OVR 100 legend cap only after hitting 99 with 4+ titles and at least 1 gauntlet win', () => {
    assert.equal(getOvrCapForCareer({ trophiesCount: 2, gauntletsWon: 0, ovr: 99 }), 99);
    assert.equal(getOvrCapForCareer({ trophiesCount: 4, gauntletsWon: 0, ovr: 99 }), 99);
    assert.equal(getOvrCapForCareer({ trophiesCount: 4, gauntletsWon: 1, ovr: 99 }), 100);
  });

  it('generates Selección UFRO vs Pase de Fase dilemma when OVR >= 74 and resolves real caps vs qualification tradeoffs', () => {
    const dilemma = generateMidSemesterDilemma({
      year: 2027,
      semester: 1,
      ovr: 78,
      teamName: 'Industrial FC',
      teamDiv: '1ª Div',
      sportName: 'Fútbol 7',
      rivalClubName: 'Medicina FC',
      gpa: 5.5,
      injuryRisk: 22,
      hasActiveInjury: false,
      rng: () => 0.3,
    });

    assert.equal(dilemma.kind, 'seleccion_vs_pase');
    assert.equal(dilemma.options.length, 3);

    const clubOpt = dilemma.options.find((o) => o.riskTag === 'CLUB')!;
    const selOpt = dilemma.options.find((o) => o.riskTag === 'SELECCIÓN')!;
    const doubleOpt = dilemma.options.find((o) => o.riskTag === 'DOBLE FRENTE')!;
    assert.equal(doubleOpt.disabled, false);

    const clubRes = resolveMidSemesterOption({ dilemma, option: clubOpt, playerOvr: 78, rng: () => 0.1 });
    assert.equal(clubRes.success, true);
    assert.ok(clubRes.qualificationBonus > 0);
    assert.equal(clubRes.capsGain, 0);

    const selRes = resolveMidSemesterOption({ dilemma, option: selOpt, playerOvr: 78, rng: () => 0.1 });
    assert.equal(selRes.success, true);
    assert.ok(selRes.capsGain >= 2, 'Choosing Selección UFRO must award official caps');
    assert.ok(selRes.qualificationBonus < 0, 'Leaving club mid-semester carries qualification risk');
    assert.ok(selRes.xpDelta > clubRes.xpDelta, 'Elite national competition awards higher OVR XP');
  });

  it('generates mid-semester phase qualification dilemma for early-career players and disables double-front when fatigued', () => {
    const earlyDilemma = generateMidSemesterDilemma({
      year: 2026,
      semester: 1,
      ovr: 66,
      teamName: 'Industrial FC',
      teamDiv: '3ª Div',
      sportName: 'Fútbol 7',
      rivalClubName: 'Derecho FC',
      gpa: 5.2,
      injuryRisk: 15,
      hasActiveInjury: false,
      rng: () => 0.5,
    });
    assert.equal(earlyDilemma.kind, 'pase_de_fase_bisagra');
    assert.equal(earlyDilemma.options.length, 2);

    const fatiguedDilemma = generateMidSemesterDilemma({
      year: 2028,
      semester: 2,
      ovr: 82,
      teamName: 'Industrial FC',
      teamDiv: '1ª Div',
      sportName: 'Fútbol 7',
      rivalClubName: 'Medicina FC',
      gpa: 5.4,
      injuryRisk: 72,
      hasActiveInjury: false,
      rng: () => 0.2,
    });
    const doubleOpt = fatiguedDilemma.options.find((o) => o.riskTag === 'DOBLE FRENTE')!;
    assert.equal(doubleOpt.disabled, true);
  });

  it('keeps Playoff Gauntlets rare with 2-year cooldown and builds escalating Octavos/Cuartos-to-Final sequences', () => {
    // Never triggers in S1 or during cooldown
    assert.equal(
      shouldTriggerPlayoffGauntlet({ semester: 1, year: 2026, lastGauntletYear: null, hasActiveInjury: false, ovr: 85, momentum: 2, rng: () => 0.01 }),
      false
    );
    assert.equal(
      shouldTriggerPlayoffGauntlet({ semester: 2, year: 2027, lastGauntletYear: 2026, hasActiveInjury: false, ovr: 85, momentum: 2, rng: () => 0.01 }),
      false
    );
    // Triggers rarely in S2 when roll is low
    assert.equal(
      shouldTriggerPlayoffGauntlet({ semester: 2, year: 2028, lastGauntletYear: 2026, hasActiveInjury: false, ovr: 85, momentum: 1, rng: () => 0.1 }),
      true
    );
    assert.equal(
      shouldTriggerPlayoffGauntlet({ semester: 2, year: 2028, lastGauntletYear: 2026, hasActiveInjury: false, ovr: 85, momentum: 1, rng: () => 0.7 }),
      false
    );

    const makeScenario = (rivalName: string, _lastKind: unknown, speedBump: number): LeyendasMiniGameScenario => ({
      id: `sc-${rivalName}`,
      kind: 'penalty_kick',
      sportKey: 'futbol',
      title: 'Penal Decisivo',
      subtitle: 'Frena en la zona óptima',
      context: `vs ${rivalName}`,
      venue: 'Cancha 1 UFRO',
      teamName: 'Industrial FC',
      rivalName,
      actionButtonLabel: 'Patear',
      sweetSpotWidth: 14,
      goodZoneWidth: 32,
      speedMultiplier: 1 + speedBump,
    });

    // Octavos -> Final (4 rounds)
    const r16Gauntlet = buildPlayoffGauntlet({
      year: 2028,
      sportKey: 'futbol',
      branch: 'hombre',
      pos: 'DEL',
      playerOvr: 84,
      team: MOCK_CLUBS[0],
      allClubs: MOCK_CLUBS,
      buildScenario: makeScenario,
      rng: () => 0.2,
    });
    assert.equal(r16Gauntlet.startStage, 'OCTAVOS');
    assert.equal(r16Gauntlet.rounds.length, 4);
    assert.deepEqual(
      r16Gauntlet.rounds.map((r) => r.stageCode),
      ['OCTAVOS', 'CUARTOS', 'SEMIFINAL', 'FINAL']
    );
    assert.ok(
      r16Gauntlet.rounds[3].scenario.speedMultiplier > r16Gauntlet.rounds[0].scenario.speedMultiplier,
      'Final round should be faster/tenser than Octavos'
    );

    // Tactic modifies scenario cleanly
    const heroic = r16Gauntlet.rounds[0].tactics.find((t) => t.id === 'HEROICO')!;
    const tuned = applyTacticToScenario(r16Gauntlet.rounds[0].scenario, heroic);
    assert.ok(tuned.sweetSpotWidth < r16Gauntlet.rounds[0].scenario.sweetSpotWidth);
    assert.ok(tuned.speedMultiplier > r16Gauntlet.rounds[0].scenario.speedMultiplier);

    // Full championship sweep vs early elimination
    const winRes = buildGauntletFinalResult({
      gauntlet: r16Gauntlet,
      roundsCleared: 4,
      perfectRounds: 4,
      tacticXpAccumulated: 72,
      statBoostAccumulated: 10,
      eliminatedAtRoundIndex: null,
    });
    assert.equal(winRes.wonChampionship, true);
    assert.equal(winRes.finalStageReached, 'CAMPEÓN');
    assert.ok(winRes.totalXpEarned >= 200);

    const elimRes = buildGauntletFinalResult({
      gauntlet: r16Gauntlet,
      roundsCleared: 1,
      perfectRounds: 0,
      tacticXpAccumulated: 18,
      statBoostAccumulated: 2,
      eliminatedAtRoundIndex: 1,
    });
    assert.equal(elimRes.wonChampionship, false);
    assert.equal(elimRes.finalStageReached, 'CUARTOS');
    assert.equal(elimRes.eliminatedAtStage, 'Cuartos de Final');
  });
});
