import type {
  LeyendasBranch,
  LeyendasClub,
  LeyendasMiniGameKind,
  LeyendasMiniGameScenario,
  LeyendasSportKey,
} from './leyendasEngine';

// ---------------------------------------------------------------------------
// 1. Hardcore OVR Progression Balance Engine
// ---------------------------------------------------------------------------

export const OVR_MIN = 55;
export const OVR_STANDARD_CAP = 99;
export const OVR_LEGEND_CAP = 100;

/**
 * XP required to advance from `currentOvr` to `currentOvr + 1`.
 * Steep exponential-like curve makes early progression rewarding while making
 * reaching 95+ and especially the 99/100 OVR limit genuinely extraordinary.
 */
export function getXpRequiredForNextOvr(currentOvr: number): number {
  const ovr = Math.floor(currentOvr);
  if (ovr < 68) return 72;
  if (ovr < 73) return 95;
  if (ovr < 78) return 130;
  if (ovr < 83) return 185;
  if (ovr < 87) return 270;
  if (ovr < 90) return 390;
  if (ovr < 93) return 560;
  if (ovr < 96) return 800;
  if (ovr < 98) return 1120;
  return 1550;
}

export function getOvrCapForCareer(params: {
  trophiesCount: number;
  gauntletsWon: number;
  ovr: number;
}): number {
  // Reaching 100 ("Leyenda Absoluta") is only unlocked for truly historic careers
  if (params.ovr >= 99 && params.trophiesCount >= 4 && params.gauntletsWon >= 1) {
    return OVR_LEGEND_CAP;
  }
  return OVR_STANDARD_CAP;
}

export function getOvrProgressPercent(ovr: number, ovrProgress: number, cap: number = OVR_STANDARD_CAP): number {
  if (ovr >= cap) return 100;
  const req = getXpRequiredForNextOvr(ovr);
  return Math.max(0, Math.min(99, Math.round((Math.max(0, ovrProgress) / req) * 100)));
}

export function getOvrTierLabel(ovr: number): {
  label: string;
  accent: 'gold' | 'indigo' | 'emerald' | 'neutral';
} {
  if (ovr >= 99) return { label: 'Inmortal UFRO', accent: 'gold' };
  if (ovr >= 93) return { label: 'Leyenda del Campus', accent: 'gold' };
  if (ovr >= 86) return { label: 'Élite Intercarreras', accent: 'indigo' };
  if (ovr >= 78) return { label: 'Figura Consolidada', accent: 'emerald' };
  if (ovr >= 70) return { label: 'Titular en Ascenso', accent: 'neutral' };
  return { label: 'Promesa Mechona', accent: 'neutral' };
}

/**
 * Applies OVR experience points (positive or negative) with strict diminishing
 * returns, per-step caps, and clean level-up / level-down handling.
 */
export function applyOvrXpDelta(params: {
  currentOvr: number;
  currentProgress: number;
  xpDelta: number;
  ovrCap?: number;
  semestersPlayed?: number;
  momentum?: number;
}): {
  nextOvr: number;
  nextProgress: number;
  ovrDelta: number;
  appliedXp: number;
} {
  const cap = params.ovrCap ?? OVR_STANDARD_CAP;
  const momentum = params.momentum ?? 0;
  const semestersPlayed = params.semestersPlayed ?? 0;

  let effectiveXp = params.xpDelta;

  if (effectiveXp > 0) {
    // Subtle momentum bonus (+6% per positive streak step, max +18%)
    const momentumMult = momentum > 0 ? 1 + Math.min(3, momentum) * 0.06 : 1;
    // Veteran wear after 14 semesters slows late-career inflation
    const veteranMult = semestersPlayed >= 14 ? 0.82 : semestersPlayed >= 10 ? 0.92 : 1;
    // Extra friction near the ceiling
    const ceilingMult = params.currentOvr >= 95 ? 0.72 : params.currentOvr >= 90 ? 0.85 : 1;
    effectiveXp = Math.round(effectiveXp * momentumMult * veteranMult * ceilingMult);
    // Hard single-activity XP cap so no single event catapults multiple OVR points
    effectiveXp = Math.min(220, effectiveXp);
  } else if (effectiveXp < 0) {
    // Setbacks hurt slightly more at high ratings (harder to stay at the very top)
    const highPressureMult = params.currentOvr >= 90 ? 1.2 : 1;
    effectiveXp = Math.max(-220, Math.round(effectiveXp * highPressureMult));
  }

  let ovr = Math.max(OVR_MIN, Math.min(cap, Math.round(params.currentOvr)));
  let progress = Math.max(0, Math.round(params.currentProgress)) + effectiveXp;

  let levelsGained = 0;
  let levelsLost = 0;

  while (progress >= getXpRequiredForNextOvr(ovr) && ovr < cap && levelsGained < 2) {
    progress -= getXpRequiredForNextOvr(ovr);
    ovr += 1;
    levelsGained += 1;
  }

  if (ovr >= cap) {
    progress = 0;
  } else if (levelsGained >= 2) {
    // Cap leftover progress just below next level to prevent +3 jumps in a single beat
    progress = Math.min(progress, Math.floor(getXpRequiredForNextOvr(ovr) * 0.65));
  }

  while (progress < 0 && ovr > OVR_MIN && levelsLost < 2) {
    ovr -= 1;
    levelsLost += 1;
    progress += getXpRequiredForNextOvr(ovr);
  }

  if (progress < 0) {
    progress = 0;
  }

  return {
    nextOvr: ovr,
    nextProgress: Math.round(progress),
    ovrDelta: ovr - params.currentOvr,
    appliedXp: effectiveXp,
  };
}

/**
 * Converts legacy small integer OVR deltas (-2..+2) into balanced OVR XP.
 */
export function legacyOvrDeltaToXp(rawDelta: number): number {
  if (rawDelta === 0) return 0;
  if (rawDelta > 0) {
    if (rawDelta === 1) return 24;
    if (rawDelta === 2) return 44;
    return 62;
  }
  if (rawDelta === -1) return -34;
  return -64;
}

// ---------------------------------------------------------------------------
// 2. Mid-Semester Dynamic Crossroads (Pase de Fase vs Selección UFRO)
// ---------------------------------------------------------------------------

export type MidSemesterDilemmaKind = 'seleccion_vs_pase' | 'pase_de_fase_bisagra';

export interface LeyendasMidSemesterOption {
  id: string;
  badge: string;
  label: string;
  summary: string;
  riskTag: 'CLUB' | 'SELECCIÓN' | 'DOBLE FRENTE' | 'TÁCTICO';
  disabled?: boolean;
  disabledReason?: string;
  baseSuccessChance: number;
  ovrWeight: number;
  successXp: number;
  failXp: number;
  gpaDelta: number;
  injuryRiskDelta: number;
  qualificationBonusSuccess: number;
  qualificationBonusFail: number;
  capsGainSuccess: number;
  capsGainFail: number;
  statBonusSuccess: number;
  teamOvrBoostSuccess?: number;
  seleccionTournamentName?: string;
  successNarrative: string;
  failNarrative: string;
}

export interface LeyendasMidSemesterDilemma {
  id: string;
  kind: MidSemesterDilemmaKind;
  kicker: string;
  title: string;
  description: string;
  stakesLabel: string;
  options: LeyendasMidSemesterOption[];
}

export interface LeyendasMidSemesterResolution {
  dilemmaKind: MidSemesterDilemmaKind;
  optionId: string;
  choiceTag: LeyendasMidSemesterOption['riskTag'];
  success: boolean;
  xpDelta: number;
  gpaDelta: number;
  injuryRiskDelta: number;
  qualificationBonus: number;
  capsGain: number;
  statBonus: number;
  teamOvrBoost: number;
  seleccionTournamentName?: string;
  headline: string;
  narrative: string;
  timelineBadge: string;
  timelineTitle: string;
}

const SELECCION_TOURNAMENTS = [
  'FENAUDE Nacional',
  'LDES Araucanía',
  'CNU Universitario',
  'Copa Univerciudad',
];

export function shouldTriggerMidSemesterDilemma(params: {
  semestersPlayed: number;
  semester: 1 | 2;
  ovr: number;
  hasActiveInjury: boolean;
  rng?: () => number;
}): boolean {
  if (params.hasActiveInjury) return false;
  const rng = params.rng ?? Math.random;
  // First semester always introduces a dynamic mid-semester crossroads on ~65% of runs,
  // and later semesters trigger ~58% of the time (higher when Selección UFRO is watching).
  const baseChance = params.ovr >= 74 ? 0.68 : 0.52;
  return rng() < baseChance;
}

export function generateMidSemesterDilemma(params: {
  year: number;
  semester: 1 | 2;
  ovr: number;
  teamName: string;
  teamDiv: string;
  sportName: string;
  rivalClubName: string;
  gpa: number;
  injuryRisk: number;
  hasActiveInjury: boolean;
  rng?: () => number;
}): LeyendasMidSemesterDilemma {
  const rng = params.rng ?? Math.random;
  const tourney = SELECCION_TOURNAMENTS[(params.year + params.semester) % SELECCION_TOURNAMENTS.length];

  // When OVR >= 74 (or rare early call-up at >= 70), present the signature Selección UFRO vs Pase de Fase dilemma
  const triggerSeleccion = params.ovr >= 74 || (params.ovr >= 70 && rng() < 0.45);

  if (triggerSeleccion) {
    const canDoubleFront = !params.hasActiveInjury && params.injuryRisk <= 58;
    const phaseLabel = params.semester === 1 ? 'el pase a Playoffs' : 'el pase a Semifinales';

    return {
      id: `ms-sel-${params.year}-s${params.semester}`,
      kind: 'seleccion_vs_pase',
      kicker: `Cruce a Medio Semestre · ${params.year} S${params.semester}`,
      title: '¿Pase de fase con tu carrera o Selección UFRO?',
      description: `El cuerpo técnico de la Selección UFRO te convocó de urgencia para disputar ${tourney} este fin de semana, pero coincide exactamente con el duelo donde ${params.teamName} se juega ${phaseLabel} ante ${params.rivalClubName}.`,
      stakesLabel: `${tourney} vs. ${phaseLabel} (${params.teamDiv})`,
      options: [
        {
          id: 'ms-opt-club-pase',
          badge: 'Prioridad Intercarreras',
          label: `Quedarme con ${params.teamName} y jugarme el pase de fase`,
          summary:
            'Respaldas al plantel de tu carrera en el partido bisagra. Sube fuerte la clasificación y la química del camarín, pero cedes esta citación.',
          riskTag: 'CLUB',
          baseSuccessChance: 0.72,
          ovrWeight: 0.008,
          successXp: 42,
          failXp: -28,
          gpaDelta: 0.05,
          injuryRiskDelta: 6,
          qualificationBonusSuccess: 9,
          qualificationBonusFail: -3,
          capsGainSuccess: 0,
          capsGainFail: 0,
          statBonusSuccess: 3,
          teamOvrBoostSuccess: 1,
          successNarrative: `Lideraste a ${params.teamName} en el partido clave ante ${params.rivalClubName} y sellaste ${phaseLabel} con ovación de toda tu carrera.`,
          failNarrative: `Te quedaste a pelear ${phaseLabel}, pero ${params.rivalClubName} cerró los espacios y complicó la llave.`,
        },
        {
          id: 'ms-opt-seleccion-ufro',
          badge: `Citación ${tourney}`,
          label: `Viajar con la Selección UFRO (${tourney})`,
          summary:
            'Sumas partidos oficiales con la camiseta UFRO y roce competitivo de élite (+OVR XP), pero tu equipo afronta el cruce decisivo sin su figura.',
          riskTag: 'SELECCIÓN',
          baseSuccessChance: 0.68,
          ovrWeight: 0.009,
          successXp: 64,
          failXp: -22,
          gpaDelta: -0.15,
          injuryRiskDelta: 10,
          qualificationBonusSuccess: -6,
          qualificationBonusFail: -9,
          capsGainSuccess: 3,
          capsGainFail: 1,
          statBonusSuccess: 2,
          seleccionTournamentName: tourney,
          successNarrative: `Destacaste con la Selección UFRO en ${tourney} (+3 caps) y subiste tu nivel contra rivales nacionales, aunque ${params.teamName} sufrió tu ausencia en el pase de fase.`,
          failNarrative: `El nivel en ${tourney} fue feroz (+1 cap): sumaste roce universitario, pero el desgaste se notó y ${params.teamName} sintió tu baja.`,
        },
        {
          id: 'ms-opt-doble-frente',
          badge: 'Esfuerzo Límite',
          label: 'Doble frente: jugar por la Selección y volver al cruce decisivo',
          summary:
            'Agenda extrema en 48 horas. Si respondes en ambos frentes ganas caps, clasificación y enorme impulso; si fallas, fuerte desgaste físico y académico.',
          riskTag: 'DOBLE FRENTE',
          disabled: !canDoubleFront,
          disabledReason: 'Requiere carga física ≤ 58% y estar sin lesión activa.',
          baseSuccessChance: 0.46,
          ovrWeight: 0.008,
          successXp: 82,
          failXp: -48,
          gpaDelta: -0.32,
          injuryRiskDelta: 24,
          qualificationBonusSuccess: 7,
          qualificationBonusFail: -6,
          capsGainSuccess: 2,
          capsGainFail: 1,
          statBonusSuccess: 4,
          teamOvrBoostSuccess: 1,
          seleccionTournamentName: tourney,
          successNarrative: `¡Hazaña histórica! Defendiste a la Selección UFRO en ${tourney} (+2 caps) y llegaste directo a sellar ${phaseLabel} con ${params.teamName}.`,
          failNarrative: `Las piernas no dieron para dos torneos en 48 horas: terminaste exhausto, perdiste ritmo y pusiste en riesgo el semestre.`,
        },
      ],
    };
  }

  // Scenario B: Mid-semester phase qualification battle (early career or non-call-up window)
  const phaseLabel = params.semester === 1 ? 'el pase a Playoffs' : 'el cupo a la fase final';
  return {
    id: `ms-pase-${params.year}-s${params.semester}`,
    kind: 'pase_de_fase_bisagra',
    kicker: `Fecha Bisagra · ${params.year} S${params.semester}`,
    title: `Partido a todo o nada por ${phaseLabel}`,
    description: `A mitad de semestre ${params.teamName} pelea punto a punto contra ${params.rivalClubName} en ${params.teamDiv}. El DT te consulta cómo encarar el partido que define el pase de fase.`,
    stakesLabel: `Definición de medio semestre · ${params.sportName}`,
    options: [
      {
        id: 'ms-opt-allin',
        badge: 'Riesgo Alto',
        label: 'Asumir el liderazgo ofensivo y buscar el triunfo directo',
        summary:
          'Pides cada posesión decisiva. Gran recompensa en OVR y clasificación si respondes; duro golpe a tu confianza si fallas.',
        riskTag: 'CLUB',
        baseSuccessChance: 0.56,
        ovrWeight: 0.009,
        successXp: 54,
        failXp: -36,
        gpaDelta: -0.1,
        injuryRiskDelta: 12,
        qualificationBonusSuccess: 10,
        qualificationBonusFail: -6,
        capsGainSuccess: 0,
        capsGainFail: 0,
        statBonusSuccess: 3,
        teamOvrBoostSuccess: 1,
        successNarrative: `Te echaste a ${params.teamName} al hombro: victoria clave ante ${params.rivalClubName} y pase de fase encaminado.`,
        failNarrative: `La presión del duelo directo pasó la cuenta y ${params.rivalClubName} se llevó los puntos en el cierre.`,
      },
      {
        id: 'ms-opt-tactico',
        badge: 'Control Táctico',
        label: 'Jugar inteligente, dosificar energía y asegurar el empate/diferencia',
        summary:
          'Menor techo de OVR XP, pero cuidas tus piernas, proteges tus notas y sumas puntos sólidos en la tabla.',
        riskTag: 'TÁCTICO',
        baseSuccessChance: 0.78,
        ovrWeight: 0.006,
        successXp: 28,
        failXp: -16,
        gpaDelta: 0.14,
        injuryRiskDelta: -4,
        qualificationBonusSuccess: 5,
        qualificationBonusFail: -2,
        capsGainSuccess: 0,
        capsGainFail: 0,
        statBonusSuccess: 1,
        successNarrative: `Partido serio y calculado: ${params.teamName} sostuvo el resultado y dio un paso firme hacia la siguiente fase.`,
        failNarrative: `Un detalle en los últimos minutos complicó el plan conservador y habrá que remar en el cierre.`,
      },
    ],
  };
}

export function resolveMidSemesterOption(params: {
  dilemma: LeyendasMidSemesterDilemma;
  option: LeyendasMidSemesterOption;
  playerOvr: number;
  rng?: () => number;
}): LeyendasMidSemesterResolution {
  const rng = params.rng ?? Math.random;
  const { option, dilemma } = params;
  const prob = Math.max(
    0.22,
    Math.min(0.9, option.baseSuccessChance + (params.playerOvr - 75) * option.ovrWeight)
  );
  const success = rng() < prob;

  const capsGain = success ? option.capsGainSuccess : option.capsGainFail;
  const xpDelta = success ? option.successXp : option.failXp;
  const qualificationBonus = success
    ? option.qualificationBonusSuccess
    : option.qualificationBonusFail;

  return {
    dilemmaKind: dilemma.kind,
    optionId: option.id,
    choiceTag: option.riskTag,
    success,
    xpDelta,
    gpaDelta: option.gpaDelta,
    injuryRiskDelta: option.injuryRiskDelta,
    qualificationBonus,
    capsGain,
    statBonus: success ? option.statBonusSuccess : 0,
    teamOvrBoost: success ? option.teamOvrBoostSuccess ?? 0 : 0,
    seleccionTournamentName:
      option.seleccionTournamentName && capsGain > 0
        ? option.seleccionTournamentName
        : undefined,
    headline: success
      ? option.riskTag === 'SELECCIÓN'
        ? `Brillaste con la Selección UFRO (+${capsGain} caps)`
        : option.riskTag === 'DOBLE FRENTE'
        ? '¡Doble frente superado con épica!'
        : '¡Golpe de autoridad en el pase de fase!'
      : option.riskTag === 'DOBLE FRENTE'
      ? 'El desgaste del doble frente pasó la cuenta'
      : 'Cruce cuesta arriba a medio semestre',
    narrative: success ? option.successNarrative : option.failNarrative,
    timelineBadge:
      option.riskTag === 'SELECCIÓN'
        ? 'SELECCIÓN UFRO'
        : option.riskTag === 'DOBLE FRENTE'
        ? 'DOBLE FRENTE'
        : 'PASE DE FASE',
    timelineTitle:
      option.riskTag === 'SELECCIÓN'
        ? `Citación ${option.seleccionTournamentName ?? 'Selección UFRO'} (+${capsGain} caps)`
        : option.riskTag === 'DOBLE FRENTE'
        ? success
          ? 'Hazaña en doble frente: Selección + Club'
          : 'Desgaste en doble frente'
        : success
        ? 'Triunfo clave por el pase de fase'
        : 'Tropiezo en el partido bisagra',
  };
}

// ---------------------------------------------------------------------------
// 3. Rare Special Long Activity: Playoff Elimination Gauntlet (Octavos/Cuartos -> Final)
// ---------------------------------------------------------------------------

export type GauntletStageCode = 'OCTAVOS' | 'CUARTOS' | 'SEMIFINAL' | 'FINAL';

export interface LeyendasGauntletTactic {
  id: 'TEMPLE' | 'EQUILIBRADO' | 'HEROICO';
  label: string;
  description: string;
  sweetSpotMod: number;
  goodZoneMod: number;
  speedMod: number;
  xpBonus: number;
}

export interface LeyendasGauntletRound {
  roundIndex: number;
  stageCode: GauntletStageCode;
  stageLabel: string;
  rivalClub: LeyendasClub;
  scoreboardText: string;
  clockText: string;
  stakesText: string;
  scenario: LeyendasMiniGameScenario;
  tactics: LeyendasGauntletTactic[];
}

export interface LeyendasPlayoffGauntlet {
  id: string;
  title: string;
  subtitle: string;
  sportKey: LeyendasSportKey;
  teamName: string;
  teamDiv: string;
  startStage: 'OCTAVOS' | 'CUARTOS';
  rounds: LeyendasGauntletRound[];
}

export interface LeyendasGauntletResult {
  gauntletId: string;
  wonChampionship: boolean;
  roundsCleared: number;
  totalRounds: number;
  perfectRounds: number;
  eliminatedAtStage?: string;
  totalXpEarned: number;
  totalStatBoost: number;
  finalStageReached: 'OCTAVOS' | 'CUARTOS' | 'SEMIFINAL' | 'FINAL' | 'CAMPEÓN';
  headline: string;
  narrative: string;
}

/**
 * Determines whether a rare special multi-match Playoff Gauntlet activates this semester.
 * Intentionally rare (~17-22% in S2, with a 2-year cooldown) so it stays truly special!
 */
export function shouldTriggerPlayoffGauntlet(params: {
  semester: 1 | 2;
  year: number;
  lastGauntletYear: number | null;
  hasActiveInjury: boolean;
  ovr: number;
  momentum: number;
  rng?: () => number;
}): boolean {
  if (params.semester !== 2) return false;
  if (params.hasActiveInjury) return false;
  // Minimum 2-year cooldown between gauntlets so they remain rare special events
  if (params.lastGauntletYear !== null && params.year - params.lastGauntletYear < 2) {
    return false;
  }
  const rng = params.rng ?? Math.random;
  let chance = 0.18;
  if (params.ovr >= 82) chance += 0.05;
  if (params.momentum >= 2) chance += 0.05;
  return rng() < chance;
}

function getGauntletTactics(sportKey: LeyendasSportKey, stage: GauntletStageCode): LeyendasGauntletTactic[] {
  const isFinal = stage === 'FINAL';
  if (sportKey === 'futbol') {
    return [
      {
        id: 'TEMPLE',
        label: 'Asegurar el toque limpio',
        description: 'Zona verde un poco más amplia, ritmo controlado y premio moderado.',
        sweetSpotMod: 2,
        goodZoneMod: 5,
        speedMod: -0.08,
        xpBonus: 8,
      },
      {
        id: 'EQUILIBRADO',
        label: 'Jugada preparada del DT',
        description: 'Balance ideal entre precisión, velocidad y ganancia de valoración.',
        sweetSpotMod: 0,
        goodZoneMod: 0,
        speedMod: 0,
        xpBonus: 18,
      },
      {
        id: 'HEROICO',
        label: isFinal ? 'Definición de antología' : 'Asumir el remate imposible',
        description: 'Medidor más rápido y estrecho, pero otorga gran salto de OVR XP.',
        sweetSpotMod: -2,
        goodZoneMod: -5,
        speedMod: 0.14,
        xpBonus: 36,
      },
    ];
  }
  if (sportKey === 'basquet') {
    return [
      {
        id: 'TEMPLE',
        label: 'Cortina y tiro de alta probabilidad',
        description: 'Mayor margen de precisión y ritmo sereno para asegurar el paso.',
        sweetSpotMod: 2,
        goodZoneMod: 5,
        speedMod: -0.08,
        xpBonus: 8,
      },
      {
        id: 'EQUILIBRADO',
        label: 'Sistema de cierre oficial',
        description: 'Ejecución estándar de playoffs con buena recompensa de experiencia.',
        sweetSpotMod: 0,
        goodZoneMod: 0,
        speedMod: 0,
        xpBonus: 18,
      },
      {
        id: 'HEROICO',
        label: isFinal ? 'Step-back para la historia' : 'Aislamiento 1 contra 1',
        description: 'Ventana más exigente y veloz; recompensa élite si aciertas.',
        sweetSpotMod: -2,
        goodZoneMod: -5,
        speedMod: 0.14,
        xpBonus: 36,
      },
    ];
  }
  return [
    {
      id: 'TEMPLE',
      label: 'Colocada táctica a zona vacía',
      description: 'Zona de acierto más cómoda y velocidad contenida.',
      sweetSpotMod: 2,
      goodZoneMod: 5,
      speedMod: -0.08,
      xpBonus: 8,
    },
    {
      id: 'EQUILIBRADO',
      label: 'Combinación rápida de red',
      description: 'Balance sólido entre dificultad de ejecución y ganancia de OVR XP.',
      sweetSpotMod: 0,
      goodZoneMod: 0,
      speedMod: 0,
      xpBonus: 18,
    },
    {
      id: 'HEROICO',
      label: isFinal ? 'Remache a la línea con todo' : 'Potencia máxima sobre bloqueo doble',
      description: 'Máxima velocidad de medidor y premio de leyenda al ejecutar.',
      sweetSpotMod: -2,
      goodZoneMod: -5,
      speedMod: 0.14,
      xpBonus: 36,
    },
  ];
}

function buildRoundScoreboard(
  sportKey: LeyendasSportKey,
  teamName: string,
  rivalName: string,
  stageIndex: number
): { scoreboardText: string; clockText: string } {
  if (sportKey === 'futbol') {
    const scores = ['1 — 1', '2 — 2', '3 — 3', '2 — 2'];
    const clocks = ["49'", "50'", "50'+1", "50'+2"];
    return {
      scoreboardText: `${teamName} ${scores[stageIndex % scores.length]} ${rivalName}`,
      clockText: `Minuto ${clocks[stageIndex % clocks.length]}`,
    };
  }
  if (sportKey === 'basquet') {
    const scores = ['58 — 59', '64 — 66', '71 — 72', '76 — 78'];
    const clocks = ['00:05', '00:04', '00:03', '00:02'];
    return {
      scoreboardText: `${teamName} ${scores[stageIndex % scores.length]} ${rivalName}`,
      clockText: `4° Cuarto · ${clocks[stageIndex % clocks.length]}`,
    };
  }
  const scores = ['Set 3 · 13 — 13', 'Set 3 · 14 — 14', 'Set 5 · 13 — 14', 'Set 5 · 14 — 14'];
  return {
    scoreboardText: `${teamName} vs ${rivalName}`,
    clockText: scores[stageIndex % scores.length],
  };
}

export function buildPlayoffGauntlet(params: {
  year: number;
  sportKey: LeyendasSportKey;
  branch: LeyendasBranch;
  pos: string;
  playerOvr: number;
  team: LeyendasClub;
  allClubs: LeyendasClub[];
  buildScenario: (rivalName: string, lastKind: LeyendasMiniGameKind | null, speedBump: number) => LeyendasMiniGameScenario;
  rng?: () => number;
}): LeyendasPlayoffGauntlet {
  const rng = params.rng ?? Math.random;
  // 45% 4-round epic from Octavos, 55% 3-round gauntlet from Cuartos
  const startFromOctavos = rng() < 0.45;
  const stages: Array<{ code: GauntletStageCode; label: string; stakes: string; speedBump: number }> =
    startFromOctavos
      ? [
          { code: 'OCTAVOS', label: 'Octavos de Final', stakes: 'Cruce eliminatorio inicial · Un fallo te deja fuera', speedBump: 0.02 },
          { code: 'CUARTOS', label: 'Cuartos de Final', stakes: 'Boleto entre los cuatro mejores del campus', speedBump: 0.09 },
          { code: 'SEMIFINAL', label: 'Semifinal', stakes: 'A una jugada de la Gran Final Intercarreras', speedBump: 0.16 },
          { code: 'FINAL', label: 'Gran Final', stakes: 'Última pelota del año · Título Intercarreras en juego', speedBump: 0.24 },
        ]
      : [
          { code: 'CUARTOS', label: 'Cuartos de Final', stakes: 'Eliminación directa · Última posesión del partido', speedBump: 0.05 },
          { code: 'SEMIFINAL', label: 'Semifinal', stakes: 'A una jugada de la Gran Final Intercarreras', speedBump: 0.14 },
          { code: 'FINAL', label: 'Gran Final', stakes: 'Última pelota del año · Título Intercarreras en juego', speedBump: 0.23 },
        ];

  const rivalsPool = params.allClubs
    .filter(
      (c) =>
        c.sportKey === params.sportKey &&
        c.branch === params.branch &&
        c.id !== params.team.id
    )
    .sort((a, b) => a.ovr - b.ovr);

  const pickedRivals: LeyendasClub[] = [];
  if (rivalsPool.length >= stages.length) {
    // Escalating opponent strength: weaker in early round, strongest club in Final
    const step = (rivalsPool.length - 1) / Math.max(1, stages.length - 1);
    for (let i = 0; i < stages.length; i += 1) {
      const idx = Math.min(rivalsPool.length - 1, Math.round(i * step));
      const candidate = rivalsPool[idx];
      if (!pickedRivals.some((r) => r.id === candidate.id)) {
        pickedRivals.push(candidate);
      } else {
        const alt = rivalsPool.find((r) => !pickedRivals.some((p) => p.id === r.id)) ?? candidate;
        pickedRivals.push(alt);
      }
    }
  } else {
    for (let i = 0; i < stages.length; i += 1) {
      pickedRivals.push(rivalsPool[i % Math.max(1, rivalsPool.length)] ?? params.team);
    }
  }

  let prevKind: LeyendasMiniGameKind | null = null;
  const rounds: LeyendasGauntletRound[] = stages.map((st, idx) => {
    const rival = pickedRivals[idx] ?? params.team;
    const baseScenario = params.buildScenario(rival.name, prevKind, st.speedBump);
    prevKind = baseScenario.kind;
    const { scoreboardText, clockText } = buildRoundScoreboard(
      params.sportKey,
      params.team.name,
      rival.name,
      idx
    );
    return {
      roundIndex: idx,
      stageCode: st.code,
      stageLabel: st.label,
      rivalClub: rival,
      scoreboardText,
      clockText,
      stakesText: st.stakes,
      scenario: {
        ...baseScenario,
        id: `gauntlet-${params.year}-${st.code.toLowerCase()}-${idx}`,
        title: `${st.label} · ${baseScenario.title}`,
        context: `${scoreboardText} (${clockText}). ${st.stakes}.`,
        rivalName: rival.name,
      },
      tactics: getGauntletTactics(params.sportKey, st.code),
    };
  });

  return {
    id: `gauntlet-${params.year}-${startFromOctavos ? 'r16' : 'qf'}`,
    title: startFromOctavos
      ? 'Ruta Épica de Playoffs · Desde Octavos a la Final'
      : 'Noche de Eliminación Directa · Cuartos a la Final',
    subtitle: `Evento especial poco frecuente: decide la última jugada de cada partido consecutivo con ${params.team.name}. Un solo fallo te elimina.`,
    sportKey: params.sportKey,
    teamName: params.team.name,
    teamDiv: params.team.div,
    startStage: startFromOctavos ? 'OCTAVOS' : 'CUARTOS',
    rounds,
  };
}

export function applyTacticToScenario(
  scenario: LeyendasMiniGameScenario,
  tactic: LeyendasGauntletTactic
): LeyendasMiniGameScenario {
  return {
    ...scenario,
    sweetSpotWidth: Math.max(7, Math.min(20, scenario.sweetSpotWidth + tactic.sweetSpotMod)),
    goodZoneWidth: Math.max(20, Math.min(42, scenario.goodZoneWidth + tactic.goodZoneMod)),
    speedMultiplier: Math.max(0.88, Math.min(1.52, Number((scenario.speedMultiplier + tactic.speedMod).toFixed(2)))),
  };
}

export function buildGauntletFinalResult(params: {
  gauntlet: LeyendasPlayoffGauntlet;
  roundsCleared: number;
  perfectRounds: number;
  tacticXpAccumulated: number;
  statBoostAccumulated: number;
  eliminatedAtRoundIndex: number | null;
}): LeyendasGauntletResult {
  const totalRounds = params.gauntlet.rounds.length;
  const wonChampionship = params.eliminatedAtRoundIndex === null && params.roundsCleared >= totalRounds;

  if (wonChampionship) {
    // Huge rare reward for sweeping the entire elimination bracket!
    const perfectSweepBonus = params.perfectRounds === totalRounds ? 55 : params.perfectRounds * 14;
    const totalXpEarned = 115 + params.tacticXpAccumulated + perfectSweepBonus;
    return {
      gauntletId: params.gauntlet.id,
      wonChampionship: true,
      roundsCleared: totalRounds,
      totalRounds,
      perfectRounds: params.perfectRounds,
      totalXpEarned,
      totalStatBoost: params.statBoostAccumulated + 4,
      finalStageReached: 'CAMPEÓN',
      headline:
        params.perfectRounds === totalRounds
          ? '¡CAMPEÓN INVICTO EN TODAS LAS JUGADAS DECISIVAS!'
          : '¡CAMPEÓN DE LA RUTA DE ELIMINACIÓN DIRECTA!',
      narrative: `Decidiste las ${totalRounds} últimas jugadas consecutivas desde ${params.gauntlet.rounds[0].stageLabel} hasta levantar la copa con ${params.gauntlet.teamName}.`,
    };
  }

  const elimIdx = params.eliminatedAtRoundIndex ?? Math.max(0, params.roundsCleared);
  const elimRound = params.gauntlet.rounds[elimIdx];
  const stageCode = elimRound?.stageCode ?? 'CUARTOS';
  const stageLabel = elimRound?.stageLabel ?? 'Playoffs';
  const baseXp = params.roundsCleared === 0 ? -36 : params.roundsCleared * 24 - 12;
  const totalXpEarned = baseXp + Math.round(params.tacticXpAccumulated * 0.5);

  return {
    gauntletId: params.gauntlet.id,
    wonChampionship: false,
    roundsCleared: params.roundsCleared,
    totalRounds,
    perfectRounds: params.perfectRounds,
    eliminatedAtStage: stageLabel,
    totalXpEarned,
    totalStatBoost: params.statBoostAccumulated,
    finalStageReached: stageCode,
    headline:
      stageCode === 'FINAL'
        ? 'Subcampeón · Cayó en la última jugada de la Gran Final'
        : `Eliminados en ${stageLabel}`,
    narrative:
      params.roundsCleared > 0
        ? `Superaste ${params.roundsCleared} llave(s) dramática(s), pero ${elimRound?.rivalClub.name ?? 'el rival'} frenó tu sueño en ${stageLabel}.`
        : `${elimRound?.rivalClub.name ?? 'El rival'} ganó la última jugada en ${stageLabel} y cortó el camino de ${params.gauntlet.teamName}.`,
  };
}
