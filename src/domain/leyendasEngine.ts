import { DISCIPLINE_MAP, UFRO_CAREERS } from '../data/ufroSeed';
import type {
  DisciplineId,
  LeyendasAwardRecord,
  LeyendasLeaderboardEntry,
  LeyendasStintRecord,
  LeyendasTrophyRecord,
  Match,
  Team,
} from '../types/tournament';
import {
  applyOvrXpDelta,
  getOvrCapForCareer,
  legacyOvrDeltaToXp,
  type LeyendasGauntletResult,
  type LeyendasMidSemesterResolution,
} from './leyendasSpecialModes';

export * from './leyendasSpecialModes';

export type LeyendasSportKey = 'futbol' | 'basquet' | 'voley';
export type LeyendasBranch = 'hombre' | 'mujer';
export type LeyendasRankingCategory = 'general' | 'futbol-h' | 'futbol-m' | 'basquet' | 'voley';

export interface LeyendasClub {
  id: string;
  realTeamId?: string;
  name: string;
  sigla: string;
  escudo?: string;
  disciplineId: DisciplineId;
  sportKey: LeyendasSportKey;
  branch: LeyendasBranch;
  div: string;
  ovr: number;
  carrera: string;
  facultad: string;
  logrosAnteriores?: string;
  isRealTeam: boolean;
}

export interface LeyendasPositionMeta {
  code: string;
  label: string;
  shortDesc: string;
}

export interface LeyendasFocusCard {
  id: string;
  tier: 'ORO' | 'PLATA' | 'BRONCE';
  title: string;
  subtitle: string;
  ovrDelta: number;
  ovrXpDelta: number;
  gpaDelta: number;
  statMult: number;
  injuryRiskDelta: number;
  flair: string;
}

export interface LeyendasEventOption {
  id: string;
  label: string;
  hint: string;
  ovrDelta: number;
  gpaDelta: number;
  statBonus: number;
  injuryChance?: number;
  extraSemester?: boolean;
  teamOvrBoost?: number;
  successChance?: number;
  altOvrDelta?: number;
  altGpaDelta?: number;
  outcomeSuccess: string;
  outcomeFail?: string;
}

export interface LeyendasGameEvent {
  id: string;
  category: 'CARRERA' | 'ACADEMICO' | 'LESION' | 'CAMPUS' | 'RIVAL' | 'RETORNO';
  tag: string;
  title: string;
  description: string;
  options: LeyendasEventOption[];
}

export interface LeyendasKeyMomentChoice {
  id: string;
  label: string;
  riskTag: 'SEGURO' | 'EQUILIBRADO' | 'AUDAZ';
  baseSuccess: number; // 0..1
  ovrWeight: number;
  successOvrDelta: number;
  failOvrDelta: number;
  statBoost: number;
  successText: string;
  failText: string;
}

export interface LeyendasKeyMoment {
  id: string;
  title: string;
  context: string;
  choices: LeyendasKeyMomentChoice[];
}

export interface LeyendasTransferOffer {
  id: string;
  club: LeyendasClub;
  tag: 'TRAICIÓN' | 'MISMA CARRERA' | 'SALTO DE DIVISIÓN' | 'EQUIPO REAL UFRO' | 'PROYECTO COMPETITIVO';
  pitch: string;
  rolePromise: 'Titular Indiscutido' | 'Estrella del Plantel' | 'Rotación Clave';
}

export interface LeyendasTimelineEntry {
  id: string;
  year: number;
  semester: 1 | 2;
  badge: string;
  title: string;
  detail: string;
  tone: 'neutral' | 'accent' | 'gold' | 'danger';
}

export interface LeyendasRival {
  name: string;
  clubId: string;
  clubName: string;
  ovr: number;
  h2hWins: number;
  h2hLosses: number;
}

export interface LeyendasStats {
  g: number;
  a: number;
  m: number;
  pts: number;
  reb: number;
  ast: number;
  blk: number;
  ace: number;
}

export interface LeyendasInjury {
  id: string;
  name: string;
  severity: 'LEVE' | 'MEDIA' | 'GRAVE';
  semestersRemaining: number;
  ovrPenalty: number;
  description: string;
}

export interface LeyendasCoachRenewalResult {
  renewed: boolean;
  coachName: string;
  reason: string;
  coachQuote: string;
}

export interface LeyendasTryoutDirectory {
  careerClubs: LeyendasClub[];
  otherCampusClubs: LeyendasClub[];
}

export type LeyendasMiniGameKind =
  | 'penalty_kick'
  | 'free_kick'
  | 'one_on_one'
  | 'goal_line_tackle'
  | 'penalty_save'
  | 'keeper_reflex'
  | 'buzzer_beater'
  | 'free_throw_clutch'
  | 'fastbreak_dunk'
  | 'volleyball_spike'
  | 'volleyball_block'
  | 'volleyball_serve';

export interface LeyendasMiniGameChoice {
  id: 'LEFT' | 'CENTER' | 'RIGHT';
  label: string;
}

export interface LeyendasMiniGameScenario {
  id: string;
  kind: LeyendasMiniGameKind;
  sportKey: LeyendasSportKey;
  title: string;
  subtitle: string;
  context: string;
  venue: string;
  teamName: string;
  rivalName: string;
  actionButtonLabel: string;
  actionChoices?: LeyendasMiniGameChoice[];
  sweetSpotWidth: number; // percentage width of PERFECT zone (higher OVR = slightly wider)
  goodZoneWidth: number; // percentage width of GOOD zone
  speedMultiplier: number;
}

export interface LeyendasMiniGameOutcome {
  tier: 'PERFECT' | 'GOOD' | 'MISS';
  success: boolean;
  ovrDelta: number;
  ovrXpDelta: number;
  statBoost: number;
  headline: string;
  narrative: string;
}

export interface LeyendasCareerState {
  playerName: string;
  career: string;
  facultad: string;
  sportKey: LeyendasSportKey;
  branch: LeyendasBranch;
  pos: string;
  startYear: number;
  year: number;
  semester: 1 | 2;
  semestersPlayed: number;
  totalSemesters: number;
  postgradStage: 'PREGRADO' | 'MAGISTER' | 'DOCTORADO';
  ovr: number;
  ovrProgress: number;
  maxOvr: number;
  lastOvrDelta: number;
  momentum: number; // -2..3 streak
  lastGauntletYear: number | null;
  gauntletsWon: number;
  gpa: number;
  hasScholarship: boolean;
  injuredSemesters: number;
  returningFromInjury: boolean;
  activeInjury: LeyendasInjury | null;
  injuryRisk: number; // 0..100 cumulative physical load
  injuriesCount: number;
  team: LeyendasClub;
  homeClub: LeyendasClub | null;
  onLoan: boolean;
  startedDiv: string;
  climbedFromThirdToFirst: boolean;
  role: 'Reserva' | 'Rotación' | 'Titular' | 'Figura' | 'Capitán Leyenda';
  caps: number;
  stats: LeyendasStats;
  stints: LeyendasStintRecord[];
  trophies: LeyendasTrophyRecord[];
  awards: LeyendasAwardRecord[];
  timeline: LeyendasTimelineEntry[];
  rival: LeyendasRival | null;
  lastEventSummary: string | null;
  lastMomentSummary: string | null;
  lastSemesterCelebration: {
    headline: string;
    subheadline: string;
    trophiesWon: LeyendasTrophyRecord[];
    awardsWon: LeyendasAwardRecord[];
    promoted?: string;
    relegated?: string;
    seleccionUfro?: string;
    injuryNote?: string;
    ovrChange?: number;
    gauntletBadge?: string;
  } | null;
  pendingLoanOffers: LeyendasClub[];
  pendingTransferOffers: LeyendasTransferOffer[];
  pendingReleaseNotice: LeyendasCoachRenewalResult | null;
  pendingPostgradOption: 'MAGISTER' | 'DOCTORADO' | null;
  finished: boolean;
}

export const SPORT_CONFIG: Record<
  LeyendasSportKey,
  {
    name: string;
    shortName: string;
    hasThreeDivisionsMale: boolean;
    positions: LeyendasPositionMeta[];
  }
> = {
  futbol: {
    name: 'Fútbol 7',
    shortName: 'Fútbol 7',
    hasThreeDivisionsMale: true,
    positions: [
      { code: 'DEL', label: 'Delantero/a', shortDesc: 'Goles y definición en área' },
      { code: 'MED', label: 'Mediocampista', shortDesc: 'Asistencias y control de juego' },
      { code: 'DEF', label: 'Defensa', shortDesc: 'Solidez táctica y marca' },
      { code: 'ARQ', label: 'Arquero/a', shortDesc: 'Vallas invictas y penales' },
    ],
  },
  basquet: {
    name: 'Básquetbol',
    shortName: 'Básquetbol',
    hasThreeDivisionsMale: false,
    positions: [
      { code: 'BASE', label: 'Base', shortDesc: 'Dirección y asistencias' },
      { code: 'ESC', label: 'Escolta', shortDesc: 'Triples y anotación exterior' },
      { code: 'ALA', label: 'Alero', shortDesc: 'Versatilidad en ambos costados' },
      { code: 'PIV', label: 'Pívot', shortDesc: 'Rebotes y dominio de pintura' },
    ],
  },
  voley: {
    name: 'Voleibol',
    shortName: 'Voleibol',
    hasThreeDivisionsMale: false,
    positions: [
      { code: 'ARM', label: 'Armador/a', shortDesc: 'Distribución y lectura de red' },
      { code: 'PUN', label: 'Punta', shortDesc: 'Ataque potente y recepción' },
      { code: 'CEN', label: 'Central', shortDesc: 'Bloqueos y primer tiempo' },
      { code: 'LIB', label: 'Líbero', shortDesc: 'Defensa extrema y cobertura' },
    ],
  },
};

export const RANDOM_NAMES_MALE = [
  'Matías Valdivia',
  'Benjamín Paredes',
  'Tomás Riquelme',
  'Vicente Alarcón',
  'Sebastián Orellana',
  'Lucas Morales',
  'Joaquín Fuentealba',
  'Nicolás Sepúlveda',
  'Diego Cárdenas',
  'Cristóbal Muñoz',
  'Martín Huenchuleo',
  'Felipe Sanhueza',
  'Bastián Lagos',
  'Ignacio Riffo',
  'Gabriel Salgado',
  'Agustín Carrasco',
];

export const RANDOM_NAMES_FEMALE = [
  'Valentina Millapán',
  'Sofía Contreras',
  'Antonia Figueroa',
  'Isidora Morales',
  'Camila Sepúlveda',
  'Catalina Riquelme',
  'Javiera Alarcón',
  'Fernanda Lagos',
  'Martina Sanhueza',
  'Florencia Carrasco',
  'Josefa Riffo',
  'Constanza Muñoz',
  'Maite Salgado',
  'Emilia Paredes',
  'Trinidad Orellana',
  'Paz Cárdenas',
];

export function getSportPositions(sportKey: LeyendasSportKey): LeyendasPositionMeta[] {
  return SPORT_CONFIG[sportKey].positions;
}

export function inferCareerYears(careerName: string): number {
  const norm = careerName.toLowerCase();
  if (norm.includes('medicina') && !norm.includes('veterinaria')) return 7;
  if (
    norm.includes('odontolog') ||
    norm.includes('ingeniería civil') ||
    norm.includes('derecho') ||
    norm.includes('bioquímica') ||
    norm.includes('veterinaria') ||
    norm.includes('química y farmacia')
  ) {
    return 6;
  }
  return 5;
}

export function getPlayerAge(startYear: number, currentYear: number): number {
  return 18 + Math.max(0, currentYear - startYear);
}

function disciplineToSportBranchDiv(disciplineId: DisciplineId): {
  sportKey: LeyendasSportKey;
  branch: LeyendasBranch;
  div: string;
  baseOvr: number;
} {
  switch (disciplineId) {
    case 'f7-h-1':
      return { sportKey: 'futbol', branch: 'hombre', div: '1ª Div', baseOvr: 80 };
    case 'f7-h-2':
      return { sportKey: 'futbol', branch: 'hombre', div: '2ª Div', baseOvr: 73 };
    case 'f7-h-3':
      return { sportKey: 'futbol', branch: 'hombre', div: '3ª Div', baseOvr: 66 };
    case 'f7-m':
      return { sportKey: 'futbol', branch: 'mujer', div: 'Femenina', baseOvr: 76 };
    case 'basquet-h':
      return { sportKey: 'basquet', branch: 'hombre', div: '1ª Div', baseOvr: 77 };
    case 'basquet-3x3-m':
      return { sportKey: 'basquet', branch: 'mujer', div: '3x3 Damas', baseOvr: 75 };
    case 'voley-h':
      return { sportKey: 'voley', branch: 'hombre', div: '1ª Div', baseOvr: 76 };
    case 'voley-m':
      return { sportKey: 'voley', branch: 'mujer', div: 'Femenina', baseOvr: 76 };
  }
}

const FALLBACK_CLUB_BLUEPRINTS: Array<{
  careerMatch: string;
  suffixF7: string;
  suffixBk: string;
  suffixVl: string;
  sigla: string;
  tierBoost: number;
}> = [
  { careerMatch: 'Ingeniería Civil Industrial', suffixF7: 'Industrial FC', suffixBk: 'Industrial Basket', suffixVl: 'Industrial Vóley', sigla: 'ICI', tierBoost: 4 },
  { careerMatch: 'Medicina', suffixF7: 'Medicina UFRO', suffixBk: 'Medicina Hoops', suffixVl: 'Medicina Vóley', sigla: 'MED', tierBoost: 3 },
  { careerMatch: 'Derecho', suffixF7: 'Derecho FC', suffixBk: 'Derecho Club', suffixVl: 'Derecho Vóley', sigla: 'DER', tierBoost: 2 },
  { careerMatch: 'Pedagogía en Educación Física, Deportes y Recreación', suffixF7: 'Ed. Física FC', suffixBk: 'Ed. Física Basket', suffixVl: 'Ed. Física Vóley', sigla: 'EFI', tierBoost: 5 },
  { careerMatch: 'Ingeniería Comercial', suffixF7: 'ICO United', suffixBk: 'ICO Hoops', suffixVl: 'ICO Vóley', sigla: 'ICO', tierBoost: 2 },
  { careerMatch: 'Kinesiología', suffixF7: 'Kinesiología FC', suffixBk: 'Kine Basket', suffixVl: 'Kine Vóley', sigla: 'KIN', tierBoost: 1 },
  { careerMatch: 'Odontología', suffixF7: 'Odonto FC', suffixBk: 'Odonto Club', suffixVl: 'Odonto Vóley', sigla: 'ODO', tierBoost: 0 },
  { careerMatch: 'Agronomía', suffixF7: 'Agronomía FC', suffixBk: 'Agro Basket', suffixVl: 'Agro Vóley', sigla: 'AGR', tierBoost: -1 },
  { careerMatch: 'Psicología', suffixF7: 'Psicología FC', suffixBk: 'Psico Basket', suffixVl: 'Psico Vóley', sigla: 'PSI', tierBoost: -2 },
  { careerMatch: 'Enfermería', suffixF7: 'Enfermería FC', suffixBk: 'Enfermería Club', suffixVl: 'Enfermería Vóley', sigla: 'ENF', tierBoost: -1 },
  { careerMatch: 'Ingeniería Civil Informática', suffixF7: 'Informática FC', suffixBk: 'Info Basket', suffixVl: 'Info Vóley', sigla: 'INF', tierBoost: 1 },
  { careerMatch: 'Contador Público y Auditor', suffixF7: 'Auditoría FC', suffixBk: 'Auditoría Club', suffixVl: 'Auditoría Vóley', sigla: 'CPA', tierBoost: -2 },
];

/**
 * Hydrates LEYENDAS clubs directly from the platform's live Firestore teams & match records,
 * and supplements any sparse/empty division with canonical UFRO career clubs so every sport
 * and branch is immediately playable with competitive 8-team pools.
 */
export function buildLeyendasTeamsFromTournament(
  teams: Team[],
  matches: Match[]
): LeyendasClub[] {
  const perf = new Map<string, { wins: number; draws: number; losses: number }>();

  for (const m of matches) {
    if (m.status !== 'FINALIZADO') continue;
    const h = perf.get(m.homeTeamId) ?? { wins: 0, draws: 0, losses: 0 };
    const a = perf.get(m.awayTeamId) ?? { wins: 0, draws: 0, losses: 0 };
    if (m.homeScore > m.awayScore) {
      h.wins += 1;
      a.losses += 1;
    } else if (m.awayScore > m.homeScore) {
      a.wins += 1;
      h.losses += 1;
    } else {
      h.draws += 1;
      a.draws += 1;
    }
    perf.set(m.homeTeamId, h);
    perf.set(m.awayTeamId, a);
  }

  const clubs: LeyendasClub[] = teams.map((team) => {
    const meta = disciplineToSportBranchDiv(team.disciplineId);
    const rec = perf.get(team.id);
    let ovr = meta.baseOvr;

    if (rec) {
      const total = rec.wins + rec.draws + rec.losses;
      if (total > 0) {
        const winRatio = (rec.wins + rec.draws * 0.45) / total;
        ovr += Math.round((winRatio - 0.5) * 14);
      }
    } else {
      // Deterministic slight spread by id hash so equal-division teams have personality
      let hash = 0;
      for (let i = 0; i < team.id.length; i += 1) {
        hash = (hash * 31 + team.id.charCodeAt(i)) % 97;
      }
      ovr += (hash % 7) - 3;
    }

    if (
      team.logrosAnteriores &&
      /(campe[oó]n|t[ií]tulo|1°|oro|bicampe)/i.test(team.logrosAnteriores)
    ) {
      ovr += 2;
    }

    return {
      id: `real-${team.id}`,
      realTeamId: team.id,
      name: team.nombre,
      sigla: team.sigla || team.nombre.slice(0, 3).toUpperCase(),
      escudo: team.escudo,
      disciplineId: team.disciplineId,
      sportKey: meta.sportKey,
      branch: meta.branch,
      div: meta.div,
      ovr: Math.max(60, Math.min(91, ovr)),
      carrera: team.carrera,
      facultad: team.facultad,
      logrosAnteriores: team.logrosAnteriores,
      isRealTeam: true,
    };
  });

  // Ensure every official discipline has at least 8 clubs so groups & playoffs always run smoothly
  const allDisciplines: DisciplineId[] = [
    'f7-h-1',
    'f7-h-2',
    'f7-h-3',
    'f7-m',
    'basquet-h',
    'basquet-3x3-m',
    'voley-h',
    'voley-m',
  ];

  for (const discId of allDisciplines) {
    const existing = clubs.filter((c) => c.disciplineId === discId);
    if (existing.length >= 8) continue;

    const meta = disciplineToSportBranchDiv(discId);
    const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));
    const needed = 8 - existing.length;
    let added = 0;

    for (const bp of FALLBACK_CLUB_BLUEPRINTS) {
      if (added >= needed) break;
      const careerObj =
        UFRO_CAREERS.find((c) => c.carrera === bp.careerMatch) ?? UFRO_CAREERS[0];
      const baseName =
        meta.sportKey === 'futbol'
          ? bp.suffixF7
          : meta.sportKey === 'basquet'
          ? bp.suffixBk
          : bp.suffixVl;
      const label =
        meta.branch === 'mujer' && !baseName.toLowerCase().includes('damas')
          ? `${baseName} Fem`
          : discId === 'f7-h-3'
          ? `${baseName} B`
          : baseName;

      if (existingNames.has(label.toLowerCase())) continue;
      existingNames.add(label.toLowerCase());
      clubs.push({
        id: `ufro-${discId}-${bp.sigla.toLowerCase()}`,
        name: label,
        sigla: bp.sigla,
        disciplineId: discId,
        sportKey: meta.sportKey,
        branch: meta.branch,
        div: meta.div,
        ovr: Math.max(60, Math.min(89, meta.baseOvr + bp.tierBoost)),
        carrera: careerObj.carrera,
        facultad: careerObj.facultad,
        isRealTeam: false,
      });
      added += 1;
    }
  }

  return clubs;
}

export function getTrialAcceptanceChance(
  playerOvr: number,
  clubOvr: number,
  isOwnCareer: boolean
): number {
  const diff = playerOvr - clubOvr;
  let chance = 58 + diff * 3.1 + (isOwnCareer ? 22 : 0);
  if (clubOvr >= 82 && !isOwnCareer) chance -= 10;
  return Math.max(16, Math.min(96, Math.round(chance)));
}

/**
 * Applies a gradual, organic OVR progression delta so OVR never jumps abruptly in a single turn.
 * Soft diminishing returns apply at elite ratings (>=86 and >=93) while still allowing GOAT territory (105).
 */
export function applyGradualOvrDelta(
  currentOvr: number,
  rawDelta: number,
  ovrCap: number = 99
): { nextOvr: number; appliedDelta: number } {
  if (rawDelta === 0) {
    return { nextOvr: currentOvr, appliedDelta: 0 };
  }

  let scaled = rawDelta;
  if (rawDelta > 0) {
    if (currentOvr >= 95) {
      scaled = Math.min(1, rawDelta);
    } else if (currentOvr >= 88) {
      scaled = Math.max(1, Math.round(rawDelta * 0.6));
    } else if (currentOvr >= 82) {
      scaled = Math.max(1, Math.round(rawDelta * 0.78));
    }
    // Never jump more than +3 in a single step
    scaled = Math.min(3, scaled);
  } else {
    // Never crash more than -3 in a single step
    scaled = Math.max(-3, Math.round(rawDelta));
  }

  const nextOvr = Math.max(55, Math.min(ovrCap, currentOvr + scaled));
  return { nextOvr, appliedDelta: nextOvr - currentOvr };
}

function makeCareerSigla(careerName: string): string {
  const words = careerName
    .replace(/ingeniería/gi, 'Ing')
    .replace(/pedagogía/gi, 'Ped')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^(de|en|del|la|los|las|y)$/i.test(w));
  const raw = words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (raw || careerName.slice(0, 3).toUpperCase()).slice(0, 4);
}

/**
 * Builds the full tryout directory for a player's career:
 * - `careerClubs` includes ALL clubs matching `selectedCareer` in the chosen sport/branch (no 4-club cap).
 *   If no real/fallback club exists yet for that exact career, creates a canonical career squad in that discipline
 *   so the player can always represent their own UFRO career.
 * - `otherCampusClubs` includes ALL remaining clubs in that sport/branch sorted by real UFRO teams first & OVR.
 */
export function buildCareerTryoutList(
  allClubs: LeyendasClub[],
  sportKey: LeyendasSportKey,
  branch: LeyendasBranch,
  selectedCareer: string
): LeyendasTryoutDirectory {
  const scoped = allClubs.filter((c) => c.sportKey === sportKey && c.branch === branch);
  const normCareer = selectedCareer.toLowerCase().trim();

  const matchesCareer = (club: LeyendasClub) => {
    const cNorm = club.carrera.toLowerCase().trim();
    return cNorm === normCareer || (normCareer.length >= 6 && cNorm.includes(normCareer));
  };

  const sortClubs = (list: LeyendasClub[]) =>
    [...list].sort((a, b) => {
      if (a.isRealTeam !== b.isRealTeam) return a.isRealTeam ? -1 : 1;
      return b.ovr - a.ovr || a.name.localeCompare(b.name, 'es');
    });

  const careerClubs = sortClubs(scoped.filter(matchesCareer));
  const otherCampusClubs = sortClubs(scoped.filter((c) => !matchesCareer(c)));

  // Guarantee at least one representative club for the player's exact UFRO career
  if (careerClubs.length === 0) {
    const careerMeta = UFRO_CAREERS.find(
      (c) => c.carrera.toLowerCase().trim() === normCareer
    );
    const defaultDisc: DisciplineId =
      sportKey === 'futbol'
        ? branch === 'hombre'
          ? 'f7-h-3'
          : 'f7-m'
        : sportKey === 'basquet'
        ? branch === 'hombre'
          ? 'basquet-h'
          : 'basquet-3x3-m'
        : branch === 'hombre'
        ? 'voley-h'
        : 'voley-m';
    const meta = disciplineToSportBranchDiv(defaultDisc);
    const suffix =
      sportKey === 'futbol' ? 'FC' : sportKey === 'basquet' ? 'Basket' : 'Vóley';
    const shortCareer = selectedCareer
      .replace(/^Ingeniería Civil\s+/i, 'Ing. ')
      .replace(/^Pedagogía en\s+/i, 'Ped. ')
      .split(',')[0]
      .trim();

    careerClubs.push({
      id: `career-custom-${defaultDisc}-${makeCareerSigla(selectedCareer).toLowerCase()}`,
      name: `${shortCareer} ${suffix}${branch === 'mujer' ? ' Fem' : ''}`,
      sigla: makeCareerSigla(selectedCareer),
      disciplineId: defaultDisc,
      sportKey,
      branch,
      div: meta.div,
      ovr: Math.max(64, Math.min(76, meta.baseOvr)),
      carrera: careerMeta?.carrera ?? selectedCareer,
      facultad: careerMeta?.facultad ?? 'Universidad de La Frontera',
      isRealTeam: false,
    });
  }

  return { careerClubs, otherCampusClubs };
}

export function buildTryoutPool(
  allClubs: LeyendasClub[],
  sportKey: LeyendasSportKey,
  branch: LeyendasBranch,
  selectedCareer: string
): LeyendasClub[] {
  const { careerClubs, otherCampusClubs } = buildCareerTryoutList(
    allClubs,
    sportKey,
    branch,
    selectedCareer
  );
  // Always return ALL clubs of the player's career first; pad with other campus clubs only if fewer than 4 exist
  if (careerClubs.length >= 4) {
    return careerClubs;
  }
  return [...careerClubs, ...otherCampusClubs.slice(0, Math.max(0, 4 - careerClubs.length))];
}

export function buildFallbackTryoutTeams(
  allClubs: LeyendasClub[],
  sportKey: LeyendasSportKey,
  branch: LeyendasBranch,
  excludeClubIds: string | string[] = []
): LeyendasClub[] {
  const excluded = new Set(Array.isArray(excludeClubIds) ? excludeClubIds : [excludeClubIds]);
  const scoped = allClubs
    .filter((c) => c.sportKey === sportKey && c.branch === branch && !excluded.has(c.id))
    .sort((a, b) => a.ovr - b.ovr);
  return scoped.slice(0, 4);
}

export function createInitialGpa(): number {
  return 5.3;
}

export function updateHiddenGpa(currentGpa: number, delta: number, hasScholarship: boolean): number {
  const protectedDelta = delta < 0 && hasScholarship ? delta * 0.75 : delta;
  const next = Math.round((currentGpa + protectedDelta) * 100) / 100;
  return Math.max(2.0, Math.min(7.0, next));
}

export function getAcademicNarrativeHint(gpa: number, hasScholarship: boolean): {
  label: string;
  tone: 'good' | 'ok' | 'warn' | 'danger';
  detail: string;
} {
  if (gpa >= 5.8) {
    return {
      label: hasScholarship ? 'Excelencia · Beca Deportiva Activa' : 'Rendimiento Sobresaliente',
      tone: 'good',
      detail: 'Tus ramos van al día y tienes perfil de Postgrado asegurado.',
    };
  }
  if (gpa >= 5.0) {
    return {
      label: hasScholarship ? 'Al día · Beca Deportiva Vigente' : 'Semestre Equilibrado',
      tone: 'ok',
      detail: 'Mantienes un buen balance entre entrenamientos y pruebas.',
    };
  }
  if (gpa >= 4.2) {
    return {
      label: 'Carga Académica Exigente',
      tone: 'warn',
      detail: 'Conviene dedicar un bloque a estudiar para no arriesgar un ramo.',
    };
  }
  return {
    label: 'Riesgo de Ramo Crítico',
    tone: 'danger',
    detail: 'Cuidado: reprobar un ramo puede alargar tu estadía o afectar tu rendimiento.',
  };
}

export function evaluateSportsScholarship(ovr: number, gpa: number): boolean {
  return ovr >= 78 && gpa >= 5.2;
}

export function getPostgradEligibility(
  career: LeyendasCareerState
): 'MAGISTER' | 'DOCTORADO' | null {
  if (career.postgradStage === 'PREGRADO') {
    if (career.gpa >= 5.0 || career.trophies.length >= 1) return 'MAGISTER';
    return null;
  }
  if (career.postgradStage === 'MAGISTER') {
    if (career.gpa >= 5.5 || career.trophies.length >= 3) return 'DOCTORADO';
    return null;
  }
  return null;
}

export function computeRoleFromOvr(ovr: number, teamOvr: number, semestersPlayed: number): LeyendasCareerState['role'] {
  const diff = ovr - teamOvr;
  if (ovr >= 92 || (diff >= 10 && semestersPlayed >= 4)) return 'Capitán Leyenda';
  if (diff >= 5 || ovr >= 84) return 'Figura';
  if (diff >= -2 || semestersPlayed >= 2) return 'Titular';
  if (diff >= -8) return 'Rotación';
  return 'Reserva';
}

const FOCUS_CARD_POOL: LeyendasFocusCard[] = [
  {
    id: 'focus-estadio-ufro',
    tier: 'ORO',
    title: 'Pretemporada Estadio UFRO',
    subtitle: 'Doble jornada física y técnica con balón/aro',
    ovrDelta: 2,
    ovrXpDelta: 38,
    gpaDelta: -0.22,
    statMult: 1.22,
    injuryRiskDelta: 0.12,
    flair: 'Ritmo intenso: progreso sólido en cancha, exige carga física y estudio.',
  },
  {
    id: 'focus-seleccion-ufro',
    tier: 'ORO',
    title: 'Sparring con Selección UFRO',
    subtitle: 'Entrenamiento táctico de máxima exigencia',
    ovrDelta: 2,
    ovrXpDelta: 42,
    gpaDelta: -0.28,
    statMult: 1.28,
    injuryRiskDelta: 0.16,
    flair: 'Exigencia de selección universitaria. Alto impacto estadístico y fatiga.',
  },
  {
    id: 'focus-equilibrio',
    tier: 'PLATA',
    title: 'Método Atleta-Estudiante',
    subtitle: 'Planificación entre Gimnasio Olímpico y Biblioteca',
    ovrDelta: 1,
    ovrXpDelta: 22,
    gpaDelta: 0.35,
    statMult: 1.05,
    injuryRiskDelta: -0.05,
    flair: 'Crecimiento constante y notas sólidas para Beca y Postgrado.',
  },
  {
    id: 'focus-tactico',
    tier: 'PLATA',
    title: 'Videoanálisis con el DT',
    subtitle: 'Lectura de rivales y pelota detenida',
    ovrDelta: 1,
    ovrXpDelta: 26,
    gpaDelta: 0.08,
    statMult: 1.15,
    injuryRiskDelta: -0.04,
    flair: 'Mejora táctica progresiva sin desgaste físico extra.',
  },
  {
    id: 'focus-gimnasio',
    tier: 'PLATA',
    title: 'Potencia en Gimnasio Olímpico',
    subtitle: 'Fuerza explosiva y prevención de lesiones',
    ovrDelta: 1,
    ovrXpDelta: 24,
    gpaDelta: -0.08,
    statMult: 1.12,
    injuryRiskDelta: -0.08,
    flair: 'Más potencia en cancha reduciendo el riesgo de lesión.',
  },
  {
    id: 'focus-biblioteca',
    tier: 'BRONCE',
    title: 'Modo Biblioteca Central',
    subtitle: 'Prioridad absoluta a certámenes y promedio',
    ovrDelta: 0,
    ovrXpDelta: 0,
    gpaDelta: 0.65,
    statMult: 0.9,
    injuryRiskDelta: -0.08,
    flair: 'Rescata tu semestre académico y asegura Beca Deportiva.',
  },
  {
    id: 'focus-kine',
    tier: 'BRONCE',
    title: 'Recuperación Kinesiológica',
    subtitle: 'Descarga muscular en clínica UFRO',
    ovrDelta: 1,
    ovrXpDelta: 10,
    gpaDelta: 0.2,
    statMult: 0.96,
    injuryRiskDelta: -0.16,
    flair: 'Descarga muscular completa: previene lesiones largas en playoffs.',
  },
  {
    id: 'focus-camarin',
    tier: 'BRONCE',
    title: 'Liderazgo de Camarín',
    subtitle: 'Cohesión con mechones y capitanes de carrera',
    ovrDelta: 1,
    ovrXpDelta: 14,
    gpaDelta: 0.12,
    statMult: 1.08,
    injuryRiskDelta: -0.03,
    flair: 'Sube la química del plantel y tu peso ante el DT.',
  },
];

export function drawSemesterFocusCards(rng: () => number = Math.random): LeyendasFocusCard[] {
  const oro = FOCUS_CARD_POOL.filter((c) => c.tier === 'ORO');
  const plata = FOCUS_CARD_POOL.filter((c) => c.tier === 'PLATA');
  const bronce = FOCUS_CARD_POOL.filter((c) => c.tier === 'BRONCE');

  const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
  const chosenPlata = [...plata].sort(() => rng() - 0.5).slice(0, 2);
  return [pick(oro), chosenPlata[0], chosenPlata[1], pick(bronce)];
}

export function initRecurringRival(
  allClubs: LeyendasClub[],
  playerTeam: LeyendasClub,
  branch: LeyendasBranch,
  rng: () => number = Math.random,
  excludePlayerName?: string
): LeyendasRival {
  const sameDiv = allClubs.filter(
    (c) =>
      c.sportKey === playerTeam.sportKey &&
      c.branch === branch &&
      c.id !== playerTeam.id
  );
  const club = sameDiv[Math.floor(rng() * Math.max(1, sameDiv.length))] ?? playerTeam;
  const rawNames = branch === 'mujer' ? RANDOM_NAMES_FEMALE : RANDOM_NAMES_MALE;
  const excluded = (excludePlayerName ?? '').trim().toLowerCase();
  const eligibleNames = excluded
    ? rawNames.filter((n) => n.trim().toLowerCase() !== excluded)
    : rawNames;
  const pool = eligibleNames.length > 0 ? eligibleNames : rawNames;
  const name = pool[Math.floor(rng() * pool.length)];
  return {
    name,
    clubId: club.id,
    clubName: club.name,
    ovr: Math.min(96, Math.max(68, club.ovr + Math.floor(rng() * 6) - 1)),
    h2hWins: 0,
    h2hLosses: 0,
  };
}

export function rollSportInjury(
  sportKey: LeyendasSportKey,
  severity: 'LEVE' | 'MEDIA' | 'GRAVE',
  rng: () => number = Math.random
): LeyendasInjury {
  const catalog: Record<LeyendasSportKey, Record<'LEVE' | 'MEDIA' | 'GRAVE', Array<{ name: string; desc: string }>>> = {
    futbol: {
      LEVE: [
        { name: 'Contractura de isquiotibiales', desc: 'Tirón muscular tras un pique largo en cancha sintética.' },
        { name: 'Sobrecarga en aductor', desc: 'Molestia muscular por acumulación de partidos y lluvia.' },
      ],
      MEDIA: [
        { name: 'Esguince de tobillo grado II', desc: 'Torcedura en una pelota dividida en Cancha 1.' },
        { name: 'Microdesgarro de gemelo', desc: 'Lesión muscular que exige pausa y kinesioterapia.' },
      ],
      GRAVE: [
        { name: 'Desgarro de cuádriceps', desc: 'Lesión de mediana-alta duración que te margina varias fechas.' },
        { name: 'Esguince de rodilla (LCM)', desc: 'Impacto fuerte en playoffs; rehabilitación obligatoria en clínica UFRO.' },
      ],
    },
    basquet: {
      LEVE: [
        { name: 'Sobrecarga plantar', desc: 'Dolor en la planta del pie tras doble jornada en el Olímpico.' },
        { name: 'Contusión de cadera', desc: 'Golpe fuerte en pantalla defensiva en la pintura.' },
      ],
      MEDIA: [
        { name: 'Esguince de tobillo en rebote', desc: 'Mal apoyo al caer tras un rebote ofensivo.' },
        { name: 'Esguince de muñeca', desc: 'Molestia en la mano de tiro tras una falta dura.' },
      ],
      GRAVE: [
        { name: 'Tendinitis rotuliana aguda', desc: 'Inflamación severa que limita tus saltos por un semestre.' },
        { name: 'Desgarro de pantorrilla', desc: 'Pausa obligada en la Clínica Kinesiológica UFRO.' },
      ],
    },
    voley: {
      LEVE: [
        { name: 'Esguince leve de dedo en bloqueo', desc: 'Choque con remache potente sobre la red.' },
        { name: 'Contractura lumbar', desc: 'Fatiga acumulada por saltos continuos en 5 sets.' },
      ],
      MEDIA: [
        { name: 'Tendinitis de hombro de ataque', desc: 'Sobrecarga en manguito rotador por volumen de remaches.' },
        { name: 'Esguince de tobillo bajo la red', desc: 'Pisada involuntaria al caer de un bloqueo doble.' },
      ],
      GRAVE: [
        { name: 'Esguince de rodilla en caída', desc: 'Requiere protocolo completo de kinesioterapia deportiva.' },
        { name: 'Desgarro abdominal de saque', desc: 'Dolor agudo al ejecutar el saque con salto.' },
      ],
    },
  };

  const options = catalog[sportKey][severity];
  const picked = options[Math.floor(rng() * options.length)];
  return {
    id: `inj-${sportKey}-${severity.toLowerCase()}-${Math.floor(rng() * 9999)}`,
    name: picked.name,
    severity,
    semestersRemaining: severity === 'GRAVE' ? 2 : 1,
    ovrPenalty: severity === 'GRAVE' ? -2 : -1,
    description: picked.desc,
  };
}

export function getCareerExclusiveEvent(
  careerName: string,
  seedIndex: number = 0
): LeyendasGameEvent {
  const lower = careerName.toLowerCase();

  const pickBySeed = (events: LeyendasGameEvent[]) =>
    events[Math.abs(seedIndex) % events.length];

  if (lower.includes('odontolog')) {
    return pickBySeed([
      {
        id: 'ev-career-odo-coda',
        category: 'CARRERA',
        tag: 'EXCLUSIVO ODONTOLOGÍA UFRO',
        title: 'Turno en Clínica Odontológica CODA',
        description:
          'Tu paciente de clínica confirmó tarde justo a dos horas del cruce de Intercarreras.',
        options: [
          {
            id: 'opt-odo-cumplir',
            label: 'Atender perfecto y salir corriendo al Complejo',
            hint: '+1 OVR · +0.35 GPA · desgaste físico',
            ovrDelta: 1,
            gpaDelta: 0.35,
            statBonus: 2,
            injuryChance: 0.14,
            outcomeSuccess: 'Aprobaste clínica con nota destacada y llegaste justo al pitazo inicial.',
          },
          {
            id: 'opt-odo-reagendar',
            label: 'Coordinar reemplazo y priorizar calentamiento',
            hint: '+2 OVR · -0.1 GPA · sin riesgo de lesión',
            ovrDelta: 2,
            gpaDelta: -0.1,
            statBonus: 2,
            outcomeSuccess: 'Entraste fresco y concentrado, marcando diferencias desde el primer minuto.',
          },
        ],
      },
      {
        id: 'ev-career-odo-protector',
        category: 'CARRERA',
        tag: 'EXCLUSIVO ODONTOLOGÍA UFRO',
        title: 'Protectores Bucales para el Plantel',
        description:
          'Con tus compañeros de taller confeccionan protectores deportivos a medida para todo el equipo.',
        options: [
          {
            id: 'opt-odo-equipo',
            label: 'Liderar el proyecto con todo el camarín',
            hint: '+1 OVR · +2 OVR al equipo · +0.2 GPA',
            ovrDelta: 1,
            gpaDelta: 0.2,
            statBonus: 1,
            teamOvrBoost: 2,
            outcomeSuccess: 'Gran gesto de liderazgo: el plantel juega más confiado y unido (+2 OVR club).',
          },
          {
            id: 'opt-odo-entreno',
            label: 'Apoyar brevemente y hacer sesión extra de cancha',
            hint: '+2 OVR · +0.05 GPA',
            ovrDelta: 2,
            gpaDelta: 0.05,
            statBonus: 2,
            outcomeSuccess: 'Tu técnica dio un salto visible esta semana.',
          },
        ],
      },
    ]);
  }

  if (
    lower.includes('kinesiolog') ||
    lower.includes('nutrici') ||
    lower.includes('fonoaudiolog') ||
    lower.includes('terapia ocupacional')
  ) {
    return pickBySeed([
      {
        id: 'ev-career-kine-plan',
        category: 'CARRERA',
        tag: 'EXCLUSIVO REHABILITACIÓN Y SALUD',
        title: 'Protocolo Propio de Recuperación y Nutrición',
        description:
          'Aplicas tus ramos de biomecánica y nutrición deportiva para optimizar cargas antes de playoffs.',
        options: [
          {
            id: 'opt-kine-plantel',
            label: 'Diseñar plan preventivo para todo el equipo',
            hint: '+1 OVR · +2 OVR al equipo · +0.3 GPA',
            ovrDelta: 1,
            gpaDelta: 0.3,
            statBonus: 1,
            teamOvrBoost: 2,
            outcomeSuccess: 'Tu club bajó a cero las molestias musculares y subió su nivel colectivo.',
          },
          {
            id: 'opt-kine-personal',
            label: 'Personalizar tu pico físico individual',
            hint: '+2 OVR · +0.15 GPA · reduce fatiga',
            ovrDelta: 2,
            gpaDelta: 0.15,
            statBonus: 2,
            outcomeSuccess: 'Rendimiento físico impecable sin sobrecargas durante el semestre.',
          },
        ],
      },
      {
        id: 'ev-career-kine-vendaje',
        category: 'CARRERA',
        tag: 'EXCLUSIVO SALUD DEPORTIVA UFRO',
        title: 'Emergencia en el Camarín Previa al Clásico',
        description:
          'El goleador/figura de tu equipo llega con una sobrecarga muscular 30 minutos antes del partido.',
        options: [
          {
            id: 'opt-kine-taping',
            label: 'Hacer vendaje funcional y activación exprés',
            hint: '+1 OVR · +2 OVR al equipo · +0.2 GPA',
            ovrDelta: 1,
            gpaDelta: 0.2,
            statBonus: 2,
            teamOvrBoost: 2,
            outcomeSuccess: 'Tu compañero pudo jugar al 100% y el camarín te ovacionó.',
          },
          {
            id: 'opt-kine-asumir',
            label: 'Recomendar reposo y asumir tú el protagonismo',
            hint: '+2 OVR · +3 bonus estadístico · riesgo fatiga',
            ovrDelta: 2,
            gpaDelta: 0.05,
            statBonus: 3,
            injuryChance: 0.12,
            outcomeSuccess: 'Cargaste con la ofensiva del equipo y brillaste como referente.',
          },
        ],
      },
    ]);
  }

  if (lower.includes('medicina') || lower.includes('enfermer') || lower.includes('obstetricia')) {
    return pickBySeed([
      {
        id: 'ev-career-salud-turno',
        category: 'CARRERA',
        tag: 'EXCLUSIVO SALUD UFRO',
        title: 'Turno en Hospital Hernán Henríquez',
        description:
          'Tu turno clínico termina justo antes de la fecha clave en el Complejo Deportivo UFRO.',
        options: [
          {
            id: 'opt-doblar',
            label: 'Cumplir turno y correr directo a cancha',
            hint: '+2 OVR · +0.25 GPA · riesgo de lesión por fatiga',
            ovrDelta: 2,
            gpaDelta: 0.25,
            statBonus: 2,
            injuryChance: 0.18,
            outcomeSuccess: 'Garra total: llegaste con delantal en el bolso y dejaste todo en cancha.',
          },
          {
            id: 'opt-permutar',
            label: 'Permutar turno con compañero y descansar',
            hint: '+1 OVR · -0.1 GPA · llegas al 100% físico',
            ovrDelta: 1,
            gpaDelta: -0.1,
            statBonus: 2,
            outcomeSuccess: 'Llegaste descansado y lúcido al partido decisivo.',
          },
        ],
      },
      {
        id: 'ev-career-salud-anatomia',
        category: 'CARRERA',
        tag: 'EXCLUSIVO FACULTAD DE MEDICINA',
        title: 'Gymkhana de Anatomía y Certamen Acumulativo',
        description:
          'Semana brutal en la Facultad de Medicina en Claro Solar justo en medio de la fase decisiva.',
        options: [
          {
            id: 'opt-anato-equilibrio',
            label: 'Estudiar con tarjetas entre entrenamientos',
            hint: '+1 OVR · +0.4 GPA',
            ovrDelta: 1,
            gpaDelta: 0.4,
            statBonus: 1,
            outcomeSuccess: 'Disciplina de reloj: aprobaste la gymkhana sin perder ritmo de juego.',
          },
          {
            id: 'opt-anato-cancha',
            label: 'Apostar todo al clásico de la fecha',
            hint: '+2 OVR · -0.3 GPA · +2 bonus estadístico',
            ovrDelta: 2,
            gpaDelta: -0.3,
            statBonus: 2,
            outcomeSuccess: 'Partidazo memorable en cancha, aunque tocará trasnochar para el certamen.',
          },
        ],
      },
    ]);
  }

  if (lower.includes('informát') || lower.includes('computaci')) {
    return pickBySeed([
      {
        id: 'ev-career-inf-hack',
        category: 'CARRERA',
        tag: 'EXCLUSIVO INFORMÁTICA UFRO',
        title: 'Hackathon Nocturna y Entrega de Proyecto',
        description:
          'Tu equipo de desarrollo compite en el edificio de Ingeniería justo la noche previa al partido.',
        options: [
          {
            id: 'opt-inf-script',
            label: 'Cerrar el deploy a medianoche y dormir 6 horas',
            hint: '+1 OVR · +0.35 GPA · +1 OVR equipo',
            ovrDelta: 1,
            gpaDelta: 0.35,
            statBonus: 1,
            teamOvrBoost: 1,
            outcomeSuccess: 'Entregaron a tiempo, analizaron estadísticas del rival y ganaron en cancha.',
          },
          {
            id: 'opt-inf-redbull',
            label: 'Amanecer programando y jugar igual el sábado',
            hint: '60% épica (+2 OVR) · 40% fatiga (-1 OVR + riesgo lesión)',
            ovrDelta: 2,
            gpaDelta: 0.45,
            statBonus: 2,
            successChance: 0.6,
            altOvrDelta: -1,
            altGpaDelta: 0.25,
            injuryChance: 0.2,
            outcomeSuccess: '¡Locura! Ganaron la hackathon y además jugaste con lucidez inexplicable.',
            outcomeFail: 'El sueño te pasó la cuenta en el segundo tiempo.',
          },
        ],
      },
      {
        id: 'ev-career-inf-scouting',
        category: 'CARRERA',
        tag: 'EXCLUSIVO INFORMÁTICA UFRO',
        title: 'Dashboard de Scouting Intercarreras',
        description:
          'Programas un analizador de tendencias y jugadas repetidas de los punteros de tu división.',
        options: [
          {
            id: 'opt-inf-dt',
            label: 'Compartir el informe completo con el DT',
            hint: '+1 OVR · +2 OVR al equipo · +0.2 GPA',
            ovrDelta: 1,
            gpaDelta: 0.2,
            statBonus: 1,
            teamOvrBoost: 2,
            outcomeSuccess: 'El cuerpo técnico desarmó al rival gracias a tus datos (+2 OVR club).',
          },
          {
            id: 'opt-inf-duelo',
            label: 'Estudiar exclusivamente a tu marcador directo',
            hint: '+2 OVR · +2 bonus estadístico',
            ovrDelta: 2,
            gpaDelta: 0.1,
            statBonus: 2,
            outcomeSuccess: 'Leíste cada movimiento de tu rival como si tuvieras el código fuente.',
          },
        ],
      },
    ]);
  }

  if (lower.includes('ingeniería') || lower.includes('construcción')) {
    return pickBySeed([
      {
        id: 'ev-career-ing-d1',
        category: 'CARRERA',
        tag: 'EXCLUSIVO INGENIERÍA FICA',
        title: 'Maratón de Cálculo y Proyecto en Edificio D1',
        description:
          'Semana de solemnes en el D1 y entrega de taller justo antes de los cruces de grupo.',
        options: [
          {
            id: 'opt-trasnoche',
            label: 'Organizar estudio en grupo y entrenar parejo',
            hint: '+1 OVR · +0.35 GPA · desgaste controlado',
            ovrDelta: 1,
            gpaDelta: 0.35,
            statBonus: 1,
            injuryChance: 0.08,
            outcomeSuccess: 'Aprobaste el solemne con nota azul y sumaste minutos de calidad.',
          },
          {
            id: 'opt-cancha',
            label: 'Priorizar táctica y definición con el equipo',
            hint: '+2 OVR · -0.3 GPA · +2 bonus estadístico',
            ovrDelta: 2,
            gpaDelta: -0.3,
            statBonus: 2,
            outcomeSuccess: 'En cancha fuiste figura indiscutida, aunque tocará remontar el promedio.',
          },
        ],
      },
      {
        id: 'ev-career-ing-barra',
        category: 'CARRERA',
        tag: 'EXCLUSIVO INGENIERÍA FICA',
        title: 'Clásico de Ingenierías en Cancha 1',
        description:
          'El centro de alumnos organizó lienzos y batucada para enfrentar a otra ingeniería en fecha estelar.',
        options: [
          {
            id: 'opt-ing-liderar',
            label: 'Asumir la capitanía emocional del partido',
            hint: '70% figura (+2 OVR, +1 club) · 30% presión (-1 OVR)',
            ovrDelta: 2,
            gpaDelta: 0,
            statBonus: 3,
            teamOvrBoost: 1,
            successChance: 0.7,
            altOvrDelta: -1,
            altGpaDelta: 0,
            outcomeSuccess: 'Manejaste el partido con jerarquía frente a toda la Facultad.',
            outcomeFail: 'La ansiedad del clásico te jugó una mala pasada en los minutos finales.',
          },
          {
            id: 'opt-ing-frio',
            label: 'Jugar cabeza fría y sin caer en provocaciones',
            hint: '+1 OVR garantizado · +0.15 GPA',
            ovrDelta: 1,
            gpaDelta: 0.15,
            statBonus: 1,
            outcomeSuccess: 'Lectura fría y precisa: el DT elogió tu madurez competitiva.',
          },
        ],
      },
    ]);
  }

  if (lower.includes('derecho')) {
    return pickBySeed([
      {
        id: 'ev-career-der-alegato',
        category: 'CARRERA',
        tag: 'EXCLUSIVO DERECHO UFRO',
        title: 'Juicio Simulado y Apelación en Tribunal Deportivo',
        description:
          'El equipo tiene una fecha clave el mismo día de tu examen oral de Derecho Civil.',
        options: [
          {
            id: 'opt-der-oral',
            label: 'Rendir el examen oral impecable y llegar al 2° tiempo',
            hint: '+1 OVR · +0.45 GPA · entrada decisiva',
            ovrDelta: 1,
            gpaDelta: 0.45,
            statBonus: 2,
            outcomeSuccess: 'Sacaste un 6.2 en el oral y entraste en el segundo tiempo a cerrar el partido.',
          },
          {
            id: 'opt-der-reglamento',
            label: 'Preparar defensa reglamentaria para habilitar a un compañero',
            hint: '+1 OVR · +2 OVR al equipo · +0.2 GPA',
            ovrDelta: 1,
            gpaDelta: 0.2,
            statBonus: 1,
            teamOvrBoost: 2,
            outcomeSuccess: 'Tu apelación fue aceptada y recuperaron a una pieza clave del plantel.',
          },
        ],
      },
    ]);
  }

  if (lower.includes('comercial') || lower.includes('contador') || lower.includes('auditor')) {
    return pickBySeed([
      {
        id: 'ev-career-fcje-auspicio',
        category: 'CARRERA',
        tag: 'EXCLUSIVO FCJE UFRO',
        title: 'Gestión de Auspicio en Temuco',
        description:
          'Conseguiste un auspiciador local de Avenida Alemania para indumentaria nueva si lideras la presentación del club.',
        options: [
          {
            id: 'opt-auspicio',
            label: 'Cerrar auspicio y equipar al plantel',
            hint: '+1 OVR · +2 OVR al equipo · +0.2 GPA',
            ovrDelta: 1,
            gpaDelta: 0.2,
            statBonus: 1,
            teamOvrBoost: 2,
            outcomeSuccess: 'Camisetas nuevas y motivación a tope: el club sube +2 OVR.',
          },
          {
            id: 'opt-enfoque',
            label: 'Delegar la gestión y concentrarte en entrenar',
            hint: '+2 OVR · +0.05 GPA',
            ovrDelta: 2,
            gpaDelta: 0.05,
            statBonus: 2,
            outcomeSuccess: 'Tu enfoque deportivo rindió frutos inmediatos en el torneo.',
          },
        ],
      },
    ]);
  }

  if (lower.includes('educación física')) {
    return pickBySeed([
      {
        id: 'ev-career-efi-lab',
        category: 'CARRERA',
        tag: 'EXCLUSIVO ED. FÍSICA UFRO',
        title: 'Laboratorio de Fisiología del Ejercicio',
        description:
          'Tus evaluaciones de VO2 máx y potencia en laboratorio te permiten ajustar tu preparación.',
        options: [
          {
            id: 'opt-pico',
            label: 'Aplicar microciclo de potencia máxima',
            hint: '+2 OVR · +0.2 GPA · ligera sobrecarga',
            ovrDelta: 2,
            gpaDelta: 0.2,
            statBonus: 3,
            injuryChance: 0.1,
            outcomeSuccess: 'Tus registros físicos destacaron en todo el Complejo Deportivo UFRO.',
          },
          {
            id: 'opt-prevencion',
            label: 'Blindar articulaciones y resistencia aeróbica',
            hint: '+1 OVR · +0.35 GPA · cero riesgo físico',
            ovrDelta: 1,
            gpaDelta: 0.35,
            statBonus: 1,
            outcomeSuccess: 'Rendimiento parejo todo el semestre sin una sola molestia física.',
          },
        ],
      },
    ]);
  }

  if (
    lower.includes('psicolog') ||
    lower.includes('sociolog') ||
    lower.includes('periodismo') ||
    lower.includes('trabajo social')
  ) {
    return pickBySeed([
      {
        id: 'ev-career-fecsh-mental',
        category: 'CARRERA',
        tag: 'EXCLUSIVO CIENCIAS SOCIALES FECSH',
        title: 'Charla Motivacional y Cobertura Ufrovisión',
        description:
          'El plantel viene golpeado tras una derrota ajustada y las cámaras universitarias siguen la fecha.',
        options: [
          {
            id: 'opt-fecsh-charla',
            label: 'Liderar sesión de cohesión grupal en el camarín',
            hint: '+1 OVR · +2 OVR al equipo · +0.25 GPA',
            ovrDelta: 1,
            gpaDelta: 0.25,
            statBonus: 1,
            teamOvrBoost: 2,
            outcomeSuccess: 'El equipo recuperó la confianza y salió enchufado desde el calentamiento.',
          },
          {
            id: 'opt-fecsh-entrevista',
            label: 'Dar la cara ante las cámaras y responder en cancha',
            hint: '68% partidazo (+2 OVR) · 32% presión mediática (-1 OVR)',
            ovrDelta: 2,
            gpaDelta: 0.1,
            statBonus: 3,
            successChance: 0.68,
            altOvrDelta: -1,
            altGpaDelta: 0,
            outcomeSuccess: 'Tus declaraciones y tu rendimiento se compartieron en todas las redes del campus.',
            outcomeFail: 'La presión extra te hizo apurar decisiones clave en el partido.',
          },
        ],
      },
    ]);
  }

  if (
    lower.includes('agronom') ||
    lower.includes('biotecnolog') ||
    lower.includes('veterinari') ||
    lower.includes('recursos naturales')
  ) {
    return pickBySeed([
      {
        id: 'ev-career-agro-maquehue',
        category: 'CARRERA',
        tag: 'EXCLUSIVO AGRO / CAMPO MAQUEHUE',
        title: 'Salida a Terreno en Campo Experimental Maquehue',
        description:
          'Vuelves en bus institucional desde Maquehue con el tiempo justo antes del pitazo inicial.',
        options: [
          {
            id: 'opt-agro-bajar',
            label: 'Bajarte con el bolso listo y entrar a calentar',
            hint: '+2 OVR · +0.25 GPA · riesgo fatiga',
            ovrDelta: 2,
            gpaDelta: 0.25,
            statBonus: 2,
            injuryChance: 0.12,
            outcomeSuccess: 'Mística pura del sur: jugaste con una intensidad contagiosa.',
          },
          {
            id: 'opt-agro-informe',
            label: 'Entregar informe temprano y descansar bien',
            hint: '+1 OVR · +0.35 GPA · físico intacto',
            ovrDelta: 1,
            gpaDelta: 0.35,
            statBonus: 1,
            outcomeSuccess: 'Cerraste el ramo práctico con excelente nota y piernas frescas.',
          },
        ],
      },
    ]);
  }

  if (lower.includes('bioquím') || lower.includes('farmacia') || lower.includes('tecnología médica')) {
    return pickBySeed([
      {
        id: 'ev-career-ciencia-lab',
        category: 'CARRERA',
        tag: 'EXCLUSIVO LABORATORIO UFRO',
        title: 'Jornada Doble de Laboratorio Químico',
        description:
          'Los informes de laboratorio consumen toda la tarde, justo cuando el equipo entrena jugadas preparadas.',
        options: [
          {
            id: 'opt-lab-doble',
            label: 'Optimizar protocolos y alcanzar el último bloque de cancha',
            hint: '+1 OVR · +0.35 GPA',
            ovrDelta: 1,
            gpaDelta: 0.35,
            statBonus: 1,
            outcomeSuccess: 'Precisión de laboratorio en los ramos y en la definición.',
          },
          {
            id: 'opt-lab-cancha',
            label: 'Entrenar la sesión táctica completa y redactar de noche',
            hint: '+2 OVR · -0.15 GPA · riesgo cansancio',
            ovrDelta: 2,
            gpaDelta: -0.15,
            statBonus: 2,
            injuryChance: 0.1,
            outcomeSuccess: 'Entendiste a la perfección la pizarra del DT para este semestre.',
          },
        ],
      },
    ]);
  }

  return pickBySeed([
    {
      id: 'ev-career-ufro-semana',
      category: 'CARRERA',
      tag: 'VIDA UNIVERSITARIA UFRO',
      title: 'Semana de Carrera en Campus Andrés Bello',
      description:
        'Tu centro de estudiantes organiza actividades y pide que lideres la delegación deportiva.',
      options: [
        {
          id: 'opt-abanderado',
          label: 'Liderar la barra y jugar con la cinta',
          hint: '+2 OVR · +1 OVR al equipo',
          ovrDelta: 2,
          gpaDelta: -0.05,
          statBonus: 2,
          teamOvrBoost: 1,
          outcomeSuccess: 'El campus entero coreó a tu carrera y el plantel respondió en la cancha.',
        },
        {
          id: 'opt-estudio',
          label: 'Adelantar trabajos para liberar playoffs',
          hint: '+1 OVR · +0.4 GPA',
          ovrDelta: 1,
          gpaDelta: 0.4,
          statBonus: 0,
          outcomeSuccess: 'Quedaste libre de entregas justo cuando llegan los partidos decisivos.',
        },
      ],
    },
    {
      id: 'ev-career-ufro-practica',
      category: 'CARRERA',
      tag: 'VIDA UNIVERSITARIA UFRO',
      title: 'Talleres y Práctica Profesional en Temuco',
      description:
        'Comienzan tus horas prácticas fuera del campus y debes coordinar horarios con el capitán.',
      options: [
        {
          id: 'opt-prac-plan',
          label: 'Ajustar rutina de madrugada para no faltar',
          hint: '+2 OVR · +0.2 GPA · ligera fatiga',
          ovrDelta: 2,
          gpaDelta: 0.2,
          statBonus: 2,
          injuryChance: 0.1,
          outcomeSuccess: 'Tu compromiso profesional impresionó tanto a tu tutor como al DT.',
        },
        {
          id: 'opt-prac-foco',
          label: 'Priorizar tu evaluación práctica esta semana',
          hint: '+0 OVR · +0.5 GPA · descanso físico',
          ovrDelta: 0,
          gpaDelta: 0.5,
          statBonus: 0,
          outcomeSuccess: 'Sumaste una excelente nota de práctica y descargaste piernas.',
        },
      ],
    },
  ]);
}

const STANDARD_EVENTS: LeyendasGameEvent[] = [
  {
    id: 'ev-lluvia-temuco',
    category: 'CAMPUS',
    tag: 'CLIMA DE LA ARAUCANÍA',
    title: 'Temporal Sureño en Cancha Sintética',
    description:
      'Diluvio clásico de Temuco a las 19:30 hrs. El balón corre rapidísimo y la superficie está resbalosa.',
    options: [
      {
        id: 'opt-barro',
        label: 'Jugar a máxima intensidad bajo la lluvia',
        hint: '68% épica (+2 OVR) · 32% resbalón (-1 OVR + riesgo lesión)',
        ovrDelta: 2,
        gpaDelta: 0,
        statBonus: 3,
        successChance: 0.68,
        altOvrDelta: -1,
        altGpaDelta: 0,
        injuryChance: 0.16,
        outcomeSuccess: 'Te luciste bajo la lluvia sureña: actuación inolvidable frente a la galería.',
        outcomeFail: 'Un resbalón te quitó precisión y te dejó tocado físicamente.',
      },
      {
        id: 'opt-control',
        label: 'Juego corto, seguro y táctico',
        hint: '+1 OVR garantizado · +0.1 GPA',
        ovrDelta: 1,
        gpaDelta: 0.1,
        statBonus: 1,
        outcomeSuccess: 'Controlaste el ritmo sin cometer errores en una noche difícil.',
      },
    ],
  },
  {
    id: 'ev-entreno-seleccion',
    category: 'CAMPUS',
    tag: 'OJEO DE SELECCIÓN',
    title: 'Observador de Deportes UFRO en Gradas',
    description:
      'El cuerpo técnico de la Selección UFRO está mirando talento para los torneos CNU y LDES.',
    options: [
      {
        id: 'opt-show',
        label: 'Arriesgar jugadas individuales para destacar',
        hint: '62% brillo (+2 OVR) · 38% exceso de confianza (-1 OVR)',
        ovrDelta: 2,
        gpaDelta: -0.05,
        statBonus: 3,
        successChance: 0.62,
        altOvrDelta: -1,
        altGpaDelta: 0,
        outcomeSuccess: 'El técnico anotó tu nombre y dorsal en rojo en su libreta.',
        outcomeFail: 'Intentaste demasiado solo y el DT te pidió más juego colectivo.',
      },
      {
        id: 'opt-equipo',
        label: 'Jugar disciplinado para el colectivo',
        hint: '+1 OVR · +1 OVR equipo',
        ovrDelta: 1,
        gpaDelta: 0.05,
        statBonus: 2,
        teamOvrBoost: 1,
        outcomeSuccess: 'Tu inteligencia táctica dejó una impresión muy seria en Deportes UFRO.',
      },
    ],
  },
  {
    id: 'ev-carrete-campus',
    category: 'CAMPUS',
    tag: 'VIDA EN TEMUCO',
    title: 'Invitación Post-Certamen en Avenida Alemania',
    description:
      'Tus compañeros celebran el fin de pruebas el viernes, pero juegas el sábado a las 10:00 AM.',
    options: [
      {
        id: 'opt-ir-rato',
        label: 'Pasar un rato y volver temprano a descansar',
        hint: '+1 OVR · +0.15 GPA',
        ovrDelta: 1,
        gpaDelta: 0.15,
        statBonus: 1,
        outcomeSuccess: 'Reforzaste la amistad del plantel y amaneciste impecable.',
      },
      {
        id: 'opt-todo',
        label: 'Quedarse hasta el cierre (50/50 mística)',
        hint: '50% inspiración (+2 OVR) · 50% resaca (-2 OVR + riesgo lesión)',
        ovrDelta: 2,
        gpaDelta: -0.2,
        statBonus: 2,
        successChance: 0.5,
        altOvrDelta: -2,
        altGpaDelta: -0.25,
        injuryChance: 0.18,
        outcomeSuccess: 'Inexplicablemente jugaste un partidazo al día siguiente.',
        outcomeFail: 'Las piernas no respondieron en el segundo tiempo. El DT tomó nota.',
      },
    ],
  },
];

export function pickSemesterEvent(
  career: LeyendasCareerState,
  rng: () => number = Math.random
): LeyendasGameEvent {
  // Active injury requires medical decision first
  if (career.activeInjury) {
    const inj = career.activeInjury;
    return {
      id: `ev-lesion-${inj.id}`,
      category: 'LESION',
      tag: `LESIÓN ${inj.severity} · CLÍNICA UFRO`,
      title: `Recuperación: ${inj.name}`,
      description: `${inj.description} El kinesiólogo recomienda rehabilitación completa, pero el plantel te necesita en cancha.`,
      options: [
        {
          id: 'opt-rehab-segura',
          label: 'Cumplir rehabilitación completa en Clínica Kinesiológica UFRO',
          hint: '0 OVR · +0.35 GPA · sanas sin riesgo de recaída',
          ovrDelta: 0,
          gpaDelta: 0.35,
          statBonus: 0,
          injuryChance: 0,
          outcomeSuccess: `Rehabilitación ejemplar de tu ${inj.name.toLowerCase()}. Volverás sano y con los ramos al día.`,
        },
        {
          id: 'opt-forzar-retorno',
          label: 'Infiltrarte y forzar minutos en fechas decisivas',
          hint: '55% épica (+1 OVR, +2 stats) · 45% recaída (-2 OVR y sigue lesionado)',
          ovrDelta: 1,
          gpaDelta: -0.1,
          statBonus: 2,
          successChance: 0.55,
          altOvrDelta: -2,
          altGpaDelta: -0.1,
          injuryChance: 0.45,
          outcomeSuccess: 'Aguantaste el dolor con vendaje firme y ayudaste al equipo en un momento crítico.',
          outcomeFail: 'Forzar el regreso provocó una recaída dolorosa que preocupó al cuerpo técnico.',
        },
      ],
    };
  }

  if (career.returningFromInjury) {
    return {
      id: 'ev-retorno-triunfal',
      category: 'RETORNO',
      tag: 'ALTA MÉDICA UFRO',
      title: 'Regreso a las Canchas tras Lesión',
      description:
        'Superaste la rehabilitación y el camarín espera tu retorno en Intercarreras.',
      options: [
        {
          id: 'opt-titular',
          label: 'Volver desde el primer minuto con hambre de revancha',
          hint: '+2 OVR · gran impulso estadístico · pequeño riesgo',
          ovrDelta: 2,
          gpaDelta: 0.1,
          statBonus: 3,
          injuryChance: 0.08,
          outcomeSuccess: 'Regreso soñado: ovación en la cancha y gran nivel tras la recuperación.',
        },
        {
          id: 'opt-gradual',
          label: 'Reintegración progresiva cuidando el físico',
          hint: '+1 OVR · +0.25 GPA · cero riesgo',
          ovrDelta: 1,
          gpaDelta: 0.25,
          statBonus: 1,
          outcomeSuccess: 'Volviste firme, maduro y sin recaídas durante todo el semestre.',
        },
      ],
    };
  }

  if (career.gpa < 4.2 && rng() < 0.65) {
    return {
      id: 'ev-ramo-critico',
      category: 'ACADEMICO',
      tag: 'ALERTA ACADÉMICA',
      title: 'Examen de Repetición en Juego',
      description:
        'Tu promedio está al límite en un ramo troncal. Reprobarlo te sumaría un semestre extra en la UFRO.',
      options: [
        {
          id: 'opt-salvar',
          label: 'Encerrarte 72 horas a salvar el ramo',
          hint: '+0.9 GPA · -1 OVR deportivo',
          ovrDelta: -1,
          gpaDelta: 0.9,
          statBonus: 0,
          outcomeSuccess: '¡Salvaste el ramo con un 4.8 heroico! Tu carrera sigue intacta.',
        },
        {
          id: 'opt-jugar-todo',
          label: 'Arriesgar el examen y jugar todos los partidos',
          hint: '45% milagro (+2 OVR) · 55% +1 semestre extra',
          ovrDelta: 2,
          gpaDelta: 0.2,
          statBonus: 2,
          successChance: 0.45,
          altOvrDelta: 0,
          altGpaDelta: -0.2,
          extraSemester: true,
          outcomeSuccess: 'Pasaste raspando con un 4.0 y brillaste en el campeonato.',
          outcomeFail: 'Echaste el ramo: tu estadía en la UFRO se alarga 1 semestre más (¡más deporte!).',
        },
      ],
    };
  }

  if (career.rival && rng() < 0.24) {
    return {
      id: `ev-rival-${career.year}-${career.semester}`,
      category: 'RIVAL',
      tag: 'DUELO DE RIVALES',
      title: `Cruce Caliente vs ${career.rival.name} (${career.rival.clubName})`,
      description:
        'En redes del campeonato todos hablan de tu duelo directo. La galería está repleta.',
      options: [
        {
          id: 'opt-duelo',
          label: 'Aceptar el mano a mano directo en cancha',
          hint: 'Probabilidad según tu OVR · +2 OVR si ganas',
          ovrDelta: 2,
          gpaDelta: 0,
          statBonus: 3,
          successChance: Math.max(0.3, Math.min(0.85, 0.5 + (career.ovr - career.rival.ovr) * 0.03)),
          altOvrDelta: -1,
          altGpaDelta: 0,
          outcomeSuccess: `Superaste con autoridad a ${career.rival.name} y te llevaste los aplausos del campus.`,
          outcomeFail: `${career.rival.name} ganó este capítulo, pero queda revancha en playoffs.`,
        },
        {
          id: 'opt-inteligente',
          label: 'Anularlo tácticamente con ayuda del equipo',
          hint: '+1 OVR seguro · +1 OVR equipo',
          ovrDelta: 1,
          gpaDelta: 0.1,
          statBonus: 1,
          teamOvrBoost: 1,
          outcomeSuccess: 'Neutralizaste a tu rival sin caer en provocaciones.',
        },
      ],
    };
  }

  // High priority for career-exclusive UFRO events (~60%) so players experience their career identity
  if (rng() < 0.62) {
    return getCareerExclusiveEvent(career.career, career.semestersPlayed + career.year);
  }

  return STANDARD_EVENTS[Math.floor(rng() * STANDARD_EVENTS.length)];
}

/**
 * Generates an interactive visual mini-game scenario tailored to the player's sport & position,
 * rotating across rich distinct mini-games so semesters never feel repetitive.
 */
export function getVisualMiniGameScenario(
  career: LeyendasCareerState,
  rng: () => number = Math.random,
  lastKind?: LeyendasMiniGameKind | null,
  overrides?: { rivalName?: string; speedBump?: number }
): LeyendasMiniGameScenario {
  const rivalName = overrides?.rivalName ?? career.rival?.clubName ?? 'Clásico Rival UFRO';
  const ovrBonusWidth = Math.max(-3, Math.min(8, Math.round((career.ovr - 70) * 0.3)));
  const injuredPenalty = career.activeInjury ? -3 : 0;
  const sweetSpotWidth = Math.max(10, Math.min(22, 14 + Math.round(ovrBonusWidth * 0.5) + injuredPenalty));
  const goodZoneWidth = Math.max(26, Math.min(44, 34 + ovrBonusWidth + injuredPenalty));
  const speedMultiplier = Number(
    ((career.semester === 2 ? 1.12 : 1.0) + (overrides?.speedBump ?? 0)).toFixed(2)
  );

  let pool: LeyendasMiniGameKind[];
  if (career.sportKey === 'futbol') {
    if (career.pos === 'ARQ') {
      pool = ['penalty_save', 'keeper_reflex'];
    } else if (career.pos === 'DEF') {
      pool = ['goal_line_tackle', 'free_kick', 'penalty_kick', 'one_on_one'];
    } else if (career.pos === 'MED') {
      pool = ['free_kick', 'one_on_one', 'penalty_kick', 'goal_line_tackle'];
    } else {
      pool = ['one_on_one', 'free_kick', 'penalty_kick', 'goal_line_tackle'];
    }
  } else if (career.sportKey === 'basquet') {
    pool = ['buzzer_beater', 'fastbreak_dunk', 'free_throw_clutch'];
  } else {
    pool =
      career.pos === 'LIB'
        ? ['volleyball_serve', 'volleyball_block', 'volleyball_spike']
        : ['volleyball_spike', 'volleyball_block', 'volleyball_serve'];
  }

  const filteredPool =
    lastKind && pool.length > 1 ? pool.filter((k) => k !== lastKind) : pool;
  const kind = filteredPool[Math.floor(rng() * filteredPool.length)] ?? pool[0];
  const baseId = `mg-${kind}-${career.year}-${career.semester}-${Math.floor(rng() * 999)}`;

  const baseMeta = {
    id: baseId,
    kind,
    sportKey: career.sportKey,
    teamName: career.team.name,
    rivalName,
    sweetSpotWidth,
    goodZoneWidth,
    speedMultiplier,
  };

  switch (kind) {
    case 'penalty_save':
      return {
        ...baseMeta,
        title: "Minuto 50' · Atajada de Penal Decisivo",
        subtitle: 'Elige el palo y frena el reflejo en la zona verde para tapar el disparo',
        context: `${career.team.name} defiende la ventaja ante ${rivalName}. Todo el Complejo UFRO contiene la respiración.`,
        venue: 'Cancha 1 · Complejo Deportivo UFRO',
        actionButtonLabel: 'Lanzarse a Atajar',
        actionChoices: [
          { id: 'LEFT', label: 'Volar Izquierda' },
          { id: 'CENTER', label: 'Aguantar Centro' },
          { id: 'RIGHT', label: 'Volar Derecha' },
        ],
      };

    case 'keeper_reflex':
      return {
        ...baseMeta,
        title: 'Achique Mano a Mano · Reflejo Puro',
        subtitle: 'Lee el perfil del delantero rival y sal a achicar justo en el instante perfecto',
        context: `Contragolpe letal de ${rivalName} en el cierre del partido. Solo quedas tú bajo los tres palos de ${career.team.name}.`,
        venue: 'Cancha 1 · Complejo Deportivo UFRO',
        actionButtonLabel: 'Salir a Achicar',
        actionChoices: [
          { id: 'LEFT', label: 'Cerrar Primer Palo' },
          { id: 'CENTER', label: 'Achique Frontal' },
          { id: 'RIGHT', label: 'Cubrir Segundo Palo' },
        ],
      };

    case 'free_kick':
      return {
        ...baseMeta,
        title: 'Tiro Libre al Borde del Área · Barrera Armada',
        subtitle: 'Elige el efecto sobre la barrera y frena el medidor en el punto exacto',
        context: `Falta peligrosa a 18 metros del arco de ${rivalName}. La barrera de tres jugadores cubre el primer palo.`,
        venue: 'Cancha 1 · Complejo Deportivo UFRO',
        actionButtonLabel: 'Ejecutar Tiro Libre',
        actionChoices: [
          { id: 'LEFT', label: 'Comba Izquierda' },
          { id: 'CENTER', label: 'Por Arriba Barrera' },
          { id: 'RIGHT', label: 'Palo del Arquero' },
        ],
      };

    case 'one_on_one':
      return {
        ...baseMeta,
        title: 'Mano a Mano vs el Arquero · Contragolpe',
        subtitle: 'Escoge tu recurso de definición y presiona justo antes de que el portero te cierre el ángulo',
        context: `Pase filtrado perfecto al espacio para ${career.team.name}. Quedas cara a cara contra el arquero de ${rivalName}.`,
        venue: 'Cancha 1 · Complejo Deportivo UFRO',
        actionButtonLabel: 'Definir Mano a Mano',
        actionChoices: [
          { id: 'LEFT', label: 'Remate Cruzado' },
          { id: 'CENTER', label: 'Vaselina Suave' },
          { id: 'RIGHT', label: 'Amague y Regate' },
        ],
      };

    case 'goal_line_tackle':
      return {
        ...baseMeta,
        title: 'Cruce Defensivo al Límite · Barrida Salvadora',
        subtitle: 'Anticipa el carril del delantero rival y frena en la zona verde para cortar sin falta',
        context: `El goleador de ${rivalName} se escapó solo hacia el área de ${career.team.name}. Un cruce limpio salva el resultado.`,
        venue: 'Cancha 1 · Complejo Deportivo UFRO',
        actionButtonLabel: 'Ejecutar Cruce Limpio',
        actionChoices: [
          { id: 'LEFT', label: 'Cerrar Banda Izq.' },
          { id: 'CENTER', label: 'Trabar de Frente' },
          { id: 'RIGHT', label: 'Barrida Derecha' },
        ],
      };

    case 'penalty_kick':
      return {
        ...baseMeta,
        title: 'Penal al Último Minuto · Cancha 1',
        subtitle: 'Apunta a un rincón del arco y presiona PATEAR justo en la zona óptima',
        context: `Empate en el cierre para ${career.team.name} vs ${rivalName}. El balón está en el punto penal.`,
        venue: 'Cancha 1 · Complejo Deportivo UFRO',
        actionButtonLabel: 'Patear Penal',
        actionChoices: [
          { id: 'LEFT', label: 'Palo Izquierdo' },
          { id: 'CENTER', label: 'Al Centro' },
          { id: 'RIGHT', label: 'Palo Derecho' },
        ],
      };

    case 'free_throw_clutch':
      return {
        ...baseMeta,
        title: 'Tiros Libres Decisivos · Reloj en 00:01',
        subtitle: 'Ajusta el arco del tiro libre y suelta la pelota en la zona verde con temple total',
        context: `Falta en la última posesión: ${career.team.name} necesita encestar frente a un Gimnasio Olímpico repleto ante ${rivalName}.`,
        venue: 'Gimnasio Olímpico UFRO',
        actionButtonLabel: 'Lanzar Tiro Libre',
        actionChoices: [
          { id: 'LEFT', label: 'Arco Alto' },
          { id: 'CENTER', label: 'Lanzamiento Limpio' },
          { id: 'RIGHT', label: 'Con Tablero' },
        ],
      };

    case 'fastbreak_dunk':
      return {
        ...baseMeta,
        title: 'Contragolpe al Aro · Duelo en la Pintura',
        subtitle: 'Elige tu movimiento para esquivar al defensor de la pintura y define en el momento exacto',
        context: `Robo de balón y carrera a toda velocidad para ${career.team.name}. El pívot de ${rivalName} espera bajo el aro.`,
        venue: 'Gimnasio Olímpico UFRO',
        actionButtonLabel: 'Definir al Aro',
        actionChoices: [
          { id: 'LEFT', label: 'Bandeja Izquierda' },
          { id: 'CENTER', label: 'Flotadora Alta' },
          { id: 'RIGHT', label: 'Eurostep Derecha' },
        ],
      };

    case 'buzzer_beater':
      return {
        ...baseMeta,
        title: 'Tiro sobre la Chicharra · 00:02',
        subtitle: 'Suelta el lanzamiento cuando el indicador cruce la zona verde del aro',
        context: `${career.team.name} cae por 2 puntos frente a ${rivalName} en el Gimnasio Olímpico.`,
        venue: 'Gimnasio Olímpico UFRO',
        actionButtonLabel: 'Soltar Triple',
      };

    case 'volleyball_block':
      return {
        ...baseMeta,
        title: 'Bloqueo Doble en la Red · Set Point Rival',
        subtitle: 'Lee hacia dónde arma el rival y salta en la zona verde para sellar la red',
        context: `${rivalName} tiene pelota de ataque directo. Tu lectura en la red puede darle vida a ${career.team.name}.`,
        venue: 'Gimnasio Olímpico UFRO',
        actionButtonLabel: 'Saltar al Bloqueo',
        actionChoices: [
          { id: 'LEFT', label: 'Cerrar Punta Izq.' },
          { id: 'CENTER', label: 'Bloquear Centro' },
          { id: 'RIGHT', label: 'Sellar Opuesto' },
        ],
      };

    case 'volleyball_serve':
      return {
        ...baseMeta,
        title: 'Saque Ace de Cierre · Presión Máxima',
        subtitle: 'Apunta a una zona vulnerable de recepción y golpea el saque en el punto dulce',
        context: `Turno clave al saque para ${career.team.name} frente a ${rivalName} en el cierre del set definitivo.`,
        venue: 'Gimnasio Olímpico UFRO',
        actionButtonLabel: 'Ejecutar Saque',
        actionChoices: [
          { id: 'LEFT', label: 'Línea Izquierda' },
          { id: 'CENTER', label: 'Saque Corto Red' },
          { id: 'RIGHT', label: 'Zona 5 Profunda' },
        ],
      };

    case 'volleyball_spike':
    default:
      return {
        ...baseMeta,
        title: 'Match Point 14-14 · Remache Decisivo',
        subtitle: 'Impacta el balón justo cuando entre en el punto máximo sobre la red',
        context: `Set definitivo para ${career.team.name} frente a ${rivalName}. La armadora te deja la pelota perfecta.`,
        venue: 'Gimnasio Olímpico UFRO',
        actionButtonLabel: 'Ejecutar Remache',
      };
  }
}

export function evaluateVisualMiniGameOutcome(
  scenario: LeyendasMiniGameScenario,
  tier: 'PERFECT' | 'GOOD' | 'MISS'
): LeyendasMiniGameOutcome {
  const base = evaluateVisualMiniGameOutcomeBase(scenario, tier);
  return {
    ...base,
    ovrXpDelta: tier === 'PERFECT' ? 48 : tier === 'GOOD' ? 22 : -34,
  };
}

function evaluateVisualMiniGameOutcomeBase(
  scenario: LeyendasMiniGameScenario,
  tier: 'PERFECT' | 'GOOD' | 'MISS'
): Omit<LeyendasMiniGameOutcome, 'ovrXpDelta'> {
  switch (scenario.kind) {
    case 'penalty_kick':
      if (tier === 'PERFECT') {
        return {
          tier,
          success: true,
          ovrDelta: 2,
          statBoost: 3,
          headline: '¡GOLAZO AL ÁNGULO!',
          narrative: `Ejecución quirúrgica al ángulo superior: el arquero de ${scenario.rivalName} ni la vio pasar. Estalla la reja del Complejo UFRO.`,
        };
      }
      if (tier === 'GOOD') {
        return {
          tier,
          success: true,
          ovrDelta: 1,
          statBoost: 2,
          headline: '¡GOL CON TEMPLE!',
          narrative: `Remate firme y esquinado para darle la victoria a ${scenario.teamName} sobre la hora.`,
        };
      }
      return {
        tier,
        success: false,
        ovrDelta: -1,
        statBoost: 0,
        headline: 'ATAJADO / AL PALO',
        narrative: `El arquero de ${scenario.rivalName} adivinó la intención y desvió el penal. Silencio duro en la galería.`,
      };

    case 'free_kick':
      if (tier === 'PERFECT') {
        return {
          tier,
          success: true,
          ovrDelta: 2,
          statBoost: 3,
          headline: '¡TIRO LIBRE DE ANTOLOGÍA!',
          narrative: `La pelota pasó por encima de la barrera con rosca perfecta y se clavó en la escuadra de ${scenario.rivalName}. Ovación total en Cancha 1.`,
        };
      }
      if (tier === 'GOOD') {
        return {
          tier,
          success: true,
          ovrDelta: 1,
          statBoost: 2,
          headline: '¡GOL DE PELOTA DETENIDA!',
          narrative: `Disparo seco y bien direccionado que venció la estirada del portero rival para ${scenario.teamName}.`,
        };
      }
      return {
        tier,
        success: false,
        ovrDelta: -1,
        statBoost: 0,
        headline: 'REBOTÓ EN LA BARRERA',
        narrative: `El impacto salió bajo y la barrera de ${scenario.rivalName} bloqueó el tiro libre con solvencia.`,
      };

    case 'one_on_one':
      if (tier === 'PERFECT') {
        return {
          tier,
          success: true,
          ovrDelta: 2,
          statBoost: 3,
          headline: '¡DEFINICIÓN DE CRACK!',
          narrative: `Dejaste desparramado al arquero de ${scenario.rivalName} con frialdad absoluta y definiste a placer para ${scenario.teamName}.`,
        };
      }
      if (tier === 'GOOD') {
        return {
          tier,
          success: true,
          ovrDelta: 1,
          statBoost: 2,
          headline: '¡ADENTRO EN EL MANO A MANO!',
          narrative: `Definiste rápido por abajo antes del achique y desataste el festejo de toda tu carrera.`,
        };
      }
      return {
        tier,
        success: false,
        ovrDelta: -1,
        statBoost: 0,
        headline: 'ACHIQUE SALVADOR DEL ARQUERO',
        narrative: `Demoraste una fracción de segundo y el portero de ${scenario.rivalName} cerró el ángulo con el pecho.`,
      };

    case 'goal_line_tackle':
      if (tier === 'PERFECT') {
        return {
          tier,
          success: true,
          ovrDelta: 2,
          statBoost: 2,
          headline: '¡CRUCE HEROICO EN LA LÍNEA!',
          narrative: `Barrida limpia al balón que levantó aplausos en toda la reja. Le negaste el gol cantado a ${scenario.rivalName}.`,
        };
      }
      if (tier === 'GOOD') {
        return {
          tier,
          success: true,
          ovrDelta: 1,
          statBoost: 1,
          headline: '¡CIERRE TÁCTICO SALVADOR!',
          narrative: `Lograste incomodar al delantero y mandar la pelota al córner para proteger el arco de ${scenario.teamName}.`,
        };
      }
      return {
        tier,
        success: false,
        ovrDelta: -1,
        statBoost: 0,
        headline: 'EL DELANTERO TE QUEBRÓ LA CINTURA',
        narrative: `El enganche rival llegó un instante antes y ${scenario.rivalName} aprovechó el espacio en el área.`,
      };

    case 'penalty_save':
      if (tier === 'PERFECT') {
        return {
          tier,
          success: true,
          ovrDelta: 2,
          statBoost: 3,
          headline: '¡ATAJADÓN HEROICO!',
          narrative: `Volaste al rincón exacto y ahogaste el grito de gol de ${scenario.rivalName}. Todo ${scenario.teamName} corre a abrazarte.`,
        };
      }
      if (tier === 'GOOD') {
        return {
          tier,
          success: true,
          ovrDelta: 1,
          statBoost: 2,
          headline: '¡MANOTAZO SALVADOR!',
          narrative: `Alcanzaste a desviar el remate con la punta de los dedos hacia el tiro de esquina.`,
        };
      }
      return {
        tier,
        success: false,
        ovrDelta: -1,
        statBoost: 0,
        headline: 'NO ALCANZASTE A LLEGAR',
        narrative: `El ejecutante de ${scenario.rivalName} te cambió el palo con frialdad en el último instante.`,
      };

    case 'keeper_reflex':
      if (tier === 'PERFECT') {
        return {
          tier,
          success: true,
          ovrDelta: 2,
          statBoost: 3,
          headline: '¡TAPADA A QUEMARROPA!',
          narrative: `Achicaste con valentía y sacaste una mano milagrosa que dejó sin palabras al banco de ${scenario.rivalName}.`,
        };
      }
      if (tier === 'GOOD') {
        return {
          tier,
          success: true,
          ovrDelta: 1,
          statBoost: 2,
          headline: '¡ACHIQUE PERFECTO!',
          narrative: `Cerraste el ángulo justo a tiempo y el remate rebotó en tus piernas hacia la banda.`,
        };
      }
      return {
        tier,
        success: false,
        ovrDelta: -1,
        statBoost: 0,
        headline: 'DEFINICIÓN CRUZADA INATAJABLE',
        narrative: `El delantero de ${scenario.rivalName} picó el balón justo cuando iniciaste el achique.`,
      };

    case 'buzzer_beater':
      if (tier === 'PERFECT') {
        return {
          tier,
          success: true,
          ovrDelta: 2,
          statBoost: 7,
          headline: '¡TRIPLE LIMPIO SOBRE LA CHICHARRA!',
          narrative: `Solo red al sonar la bocina del Gimnasio Olímpico. Victoria histórica para ${scenario.teamName}.`,
        };
      }
      if (tier === 'GOOD') {
        return {
          tier,
          success: true,
          ovrDelta: 1,
          statBoost: 4,
          headline: '¡TABLERO Y ADENTRO!',
          narrative: `El balón tocó el tablero y cayó dentro del aro con el reloj en 00:00. Triunfo agónico.`,
        };
      }
      return {
        tier,
        success: false,
        ovrDelta: -1,
        statBoost: 0,
        headline: 'BAILÓ EN EL ARO Y SALIÓ',
        narrative: `El lanzamiento pegó en el hierro delantero y salió hacia afuera justo con la chicharra.`,
      };

    case 'free_throw_clutch':
      if (tier === 'PERFECT') {
        return {
          tier,
          success: true,
          ovrDelta: 2,
          statBoost: 6,
          headline: '¡HIELO EN LAS VENAS! 2 DE 2 LIMPIOS',
          narrative: `Silenciaste el Gimnasio Olímpico con dos tiros libres perfectos solo red para sellar el triunfo de ${scenario.teamName}.`,
        };
      }
      if (tier === 'GOOD') {
        return {
          tier,
          success: true,
          ovrDelta: 1,
          statBoost: 4,
          headline: '¡ADENTRO CON SUSPENSO!',
          narrative: `El tiro dio un bote en el aro y terminó cayendo dentro para mantener arriba a ${scenario.teamName}.`,
        };
      }
      return {
        tier,
        success: false,
        ovrDelta: -1,
        statBoost: 0,
        headline: 'CORTO EN EL ARO',
        narrative: `La presión del reloj se sintió en la muñeca y el balón dio en el borde frontal sin entrar.`,
      };

    case 'fastbreak_dunk':
      if (tier === 'PERFECT') {
        return {
          tier,
          success: true,
          ovrDelta: 2,
          statBoost: 7,
          headline: '¡DOBLE Y FALTA ESPECTACULAR!',
          narrative: `Rompiste la defensa de ${scenario.rivalName} en la pintura con un recurso de lujo y levantaste a toda la galería.`,
        };
      }
      if (tier === 'GOOD') {
        return {
          tier,
          success: true,
          ovrDelta: 1,
          statBoost: 5,
          headline: '¡BANDEJA DE MANUAL!',
          narrative: `Usaste bien el cuerpo para proteger el balón y anotar dos puntos clave para ${scenario.teamName}.`,
        };
      }
      return {
        tier,
        success: false,
        ovrDelta: -1,
        statBoost: 0,
        headline: 'TAPÓN EN LA PINTURA',
        narrative: `El protector del aro de ${scenario.rivalName} leyó tu paso y bloqueó la bandeja contra el tablero.`,
      };

    case 'volleyball_block':
      if (tier === 'PERFECT') {
        return {
          tier,
          success: true,
          ovrDelta: 2,
          statBoost: 6,
          headline: '¡MURO IMPENETRABLE! PUNTO DIRECTO',
          narrative: `Leíste el armado a la perfección y clavaste el balón en los tres metros de ${scenario.rivalName}.`,
        };
      }
      if (tier === 'GOOD') {
        return {
          tier,
          success: true,
          ovrDelta: 1,
          statBoost: 4,
          headline: '¡TOQUE DE BLOQUEO Y CONTRAATAQUE!',
          narrative: `Amortiguaste el remache en la red permitiendo que ${scenario.teamName} cerrara el punto en la transición.`,
        };
      }
      return {
        tier,
        success: false,
        ovrDelta: -1,
        statBoost: 0,
        headline: 'BLOQUEO FUERA DE TIEMPO',
        narrative: `El atacante de ${scenario.rivalName} encontró el hueco entre tus manos y la antena.`,
      };

    case 'volleyball_serve':
      if (tier === 'PERFECT') {
        return {
          tier,
          success: true,
          ovrDelta: 2,
          statBoost: 6,
          headline: '¡SAQUE ACE EN LA LÍNEA!',
          narrative: `Potencia y precisión quirúrgica directo a la esquina: la recepción de ${scenario.rivalName} ni pudo reaccionar.`,
        };
      }
      if (tier === 'GOOD') {
        return {
          tier,
          success: true,
          ovrDelta: 1,
          statBoost: 4,
          headline: '¡SAQUE COMPLICADO QUE ROMPE RECEPCIÓN!',
          narrative: `Tu saque flotante desordenó a ${scenario.rivalName} y le dio pelota regalada a ${scenario.teamName}.`,
        };
      }
      return {
        tier,
        success: false,
        ovrDelta: -1,
        statBoost: 0,
        headline: 'SAQUE LARGO / A LA RED',
        narrative: `Excediste la fuerza por centímetros y el balón se escapó por la línea de fondo.`,
      };

    case 'volleyball_spike':
    default:
      if (tier === 'PERFECT') {
        return {
          tier,
          success: true,
          ovrDelta: 2,
          statBoost: 6,
          headline: '¡MISIL EN LA DIAGONAL! MATCH POINT',
          narrative: `Contacto perfecto en el punto más alto: remache imparable por encima del bloqueo doble de ${scenario.rivalName}.`,
        };
      }
      if (tier === 'GOOD') {
        return {
          tier,
          success: true,
          ovrDelta: 1,
          statBoost: 4,
          headline: '¡TOQUE INTELIGENTE Y PUNTO!',
          narrative: `Aprovechaste las manos del bloqueo rival para mandar la pelota afuera y cerrar el set.`,
        };
      }
      return {
        tier,
        success: false,
        ovrDelta: -1,
        statBoost: 0,
        headline: 'BLOQUEO RIVAL EN LA RED',
        narrative: `El tiempo de salto se adelantó un segundo y el bloqueo de ${scenario.rivalName} cerró la red.`,
      };
  }
}

export function pickContextualKeyMoment(
  career: LeyendasCareerState,
  rng: () => number = Math.random
): LeyendasKeyMoment {
  if (career.sportKey === 'futbol') {
    const moments: LeyendasKeyMoment[] = [
      {
        id: 'km-f7-penal',
        title: 'Último Minuto · Penal Decisivo en Cancha 1',
        context: `Empate en el marcador para ${career.team.name}. Todo el público rodea la reja del Complejo UFRO.`,
        choices: [
          {
            id: 'c-seguro',
            label: 'Asegurar raso y esquinado al palo',
            riskTag: 'SEGURO',
            baseSuccess: 0.74,
            ovrWeight: 0.008,
            successOvrDelta: 1,
            failOvrDelta: -1,
            statBoost: 2,
            successText: '¡GOLAZO! Definición quirúrgica para desatar la locura en el banco.',
            failText: 'El arquero adivinó el palo en el último instante.',
          },
          {
            id: 'c-panenka',
            label: 'Picarla a lo Panenka al centro',
            riskTag: 'AUDAZ',
            baseSuccess: 0.52,
            ovrWeight: 0.011,
            successOvrDelta: 2,
            failOvrDelta: -1,
            statBoost: 3,
            successText: '¡ESCÁNDALO EN LA UFRO! Panenka fría que se vuelve viral en toda la universidad.',
            failText: 'Se quedó demasiado suave y la atrapó el portero. Silencio en la galería.',
          },
        ],
      },
    ];
    return moments[Math.floor(rng() * moments.length)];
  }

  if (career.sportKey === 'basquet') {
    return {
      id: 'km-bk-buzzer',
      title: 'Últimos 6 Segundos en el Gimnasio Olímpico',
      context: `${career.team.name} cae por 2 puntos. La pelota quema en tus manos en el perímetro.`,
      choices: [
        {
          id: 'c-penetracion',
          label: 'Penetrar al aro buscando bandeja o falta',
          riskTag: 'SEGURO',
          baseSuccess: 0.72,
          ovrWeight: 0.008,
          successOvrDelta: 1,
          failOvrDelta: -1,
          statBoost: 4,
          successText: '¡DOBLE Y FALTA! Temple de acero para dar vuelta el marcador.',
          failText: 'Un tapón rival en la pintura cerró el aro sobre la bocina.',
        },
        {
          id: 'c-triple',
          label: 'Step-back de tres puntos sobre la chicharra',
          riskTag: 'AUDAZ',
          baseSuccess: 0.52,
          ovrWeight: 0.011,
          successOvrDelta: 2,
          failOvrDelta: -1,
          statBoost: 7,
          successText: '¡BOMBAZO DE TRES SOBRE LA CHICHARRA! Explota el Gimnasio Olímpico UFRO.',
          failText: 'El tiro bailó en el aro y salió hacia afuera.',
        },
      ],
    };
  }

  return {
    id: 'km-vl-matchpoint',
    title: 'Match Point en Set 3 (14-14) · Gimnasio Olímpico',
    context: `Punto definitivo para ${career.team.name}. Toda la cancha contiene la respiración.`,
    choices: [
      {
        id: 'c-colocada',
        label: 'Toque inteligente al espacio vacío',
        riskTag: 'SEGURO',
        baseSuccess: 0.72,
        ovrWeight: 0.008,
        successOvrDelta: 1,
        failOvrDelta: -1,
        statBoost: 4,
        successText: '¡PUNTO DE ORO! Lectura perfecta que dejó sin reacción al rival.',
        failText: 'El líbero contrario voló para salvarla con una mano.',
      },
      {
        id: 'c-diagonal',
        label: 'Remache cruzado a máxima potencia',
        riskTag: 'AUDAZ',
        baseSuccess: 0.55,
        ovrWeight: 0.011,
        successOvrDelta: 2,
        failOvrDelta: -1,
        statBoost: 6,
        successText: '¡MISIL IMPARABLE EN LA DIAGONAL! Set y partido para tu equipo.',
        failText: 'El bloqueo doble cerró la diagonal justo a tiempo.',
      },
    ],
  };
}

export function resolveKeyMomentChoice(
  ovr: number,
  choice: LeyendasKeyMomentChoice,
  rng: () => number = Math.random
): {
  success: boolean;
  ovrDelta: number;
  statBoost: number;
  narrative: string;
} {
  const prob = Math.max(0.2, Math.min(0.94, choice.baseSuccess + (ovr - 72) * choice.ovrWeight));
  const success = rng() < prob;
  return {
    success,
    ovrDelta: success ? choice.successOvrDelta : choice.failOvrDelta,
    statBoost: success ? choice.statBoost : 0,
    narrative: success ? choice.successText : choice.failText,
  };
}

export function generateSemesterStats(params: {
  sportKey: LeyendasSportKey;
  pos: string;
  ovr: number;
  statMult: number;
  extraBonus: number;
  matchesPlayed: number;
  rng?: () => number;
}): LeyendasStats {
  const rng = params.rng ?? Math.random;
  const power = Math.max(0.45, (params.ovr - 52) / 36) * params.statMult;
  const m = params.matchesPlayed;

  if (params.sportKey === 'futbol') {
    let gRate = 0.45;
    let aRate = 0.35;
    if (params.pos === 'DEL') {
      gRate = 1.05;
      aRate = 0.35;
    } else if (params.pos === 'MED') {
      gRate = 0.45;
      aRate = 0.85;
    } else if (params.pos === 'DEF') {
      gRate = 0.18;
      aRate = 0.32;
    } else if (params.pos === 'ARQ') {
      gRate = 0.03;
      aRate = 0.12;
    }
    const g = Math.max(0, Math.round(m * gRate * power * (0.75 + rng() * 0.55) + params.extraBonus * (params.pos === 'ARQ' ? 0 : 0.4)));
    const a = Math.max(0, Math.round(m * aRate * power * (0.75 + rng() * 0.55) + params.extraBonus * 0.3));
    return { g, a, m, pts: 0, reb: 0, ast: 0, blk: 0, ace: 0 };
  }

  if (params.sportKey === 'basquet') {
    const ptsRate = params.pos === 'ESC' || params.pos === 'ALA' ? 14.5 : params.pos === 'BASE' ? 11.5 : 12.5;
    const rebRate = params.pos === 'PIV' ? 8.8 : params.pos === 'ALA' ? 5.6 : 3.2;
    const astRate = params.pos === 'BASE' ? 6.5 : params.pos === 'ESC' ? 3.4 : 2.2;
    const blkRate = params.pos === 'PIV' ? 2.1 : 0.7;
    const pts = Math.max(2, Math.round(m * ptsRate * power * (0.8 + rng() * 0.4) + params.extraBonus * 2));
    const reb = Math.max(1, Math.round(m * rebRate * power * (0.8 + rng() * 0.4)));
    const ast = Math.max(1, Math.round(m * astRate * power * (0.8 + rng() * 0.4)));
    const blk = Math.max(0, Math.round(m * blkRate * power * (0.7 + rng() * 0.6)));
    return { g: 0, a: 0, m, pts, reb, ast, blk, ace: 0 };
  }

  // Voleibol
  const ptsRate = params.pos === 'PUN' ? 11.5 : params.pos === 'CEN' ? 8.5 : params.pos === 'ARM' ? 4.5 : 1.5;
  const blkRate = params.pos === 'CEN' ? 3.8 : params.pos === 'PUN' ? 1.8 : 0.6;
  const aceRate = params.pos === 'PUN' || params.pos === 'ARM' ? 2.2 : 1.1;
  const astRate = params.pos === 'ARM' ? 16.0 : params.pos === 'LIB' ? 9.5 : 3.0;
  const pts = Math.max(1, Math.round(m * ptsRate * power * (0.8 + rng() * 0.4) + params.extraBonus));
  const blk = Math.max(0, Math.round(m * blkRate * power * (0.75 + rng() * 0.5)));
  const ace = Math.max(0, Math.round(m * aceRate * power * (0.75 + rng() * 0.5)));
  const ast = Math.max(1, Math.round(m * astRate * power * (0.8 + rng() * 0.4)));
  return { g: 0, a: 0, m, pts, reb: 0, ast, blk, ace };
}

export function generateTransferOffers(
  career: LeyendasCareerState,
  allClubs: LeyendasClub[],
  rng: () => number = Math.random
): LeyendasTransferOffer[] {
  const sameSportBranch = allClubs.filter(
    (c) =>
      c.sportKey === career.sportKey &&
      c.branch === career.branch &&
      c.id !== career.team.id
  );
  if (sameSportBranch.length === 0) return [];

  const desiredMin = career.ovr - 10;
  const desiredMax = career.ovr + 10;
  const eligible = sameSportBranch.filter((c) => c.ovr >= desiredMin && c.ovr <= desiredMax);
  const pool = eligible.length >= 3 ? eligible : sameSportBranch;

  const shuffled = [...pool].sort(() => rng() - 0.5);
  const chosen: LeyendasClub[] = [];

  // Prioritize player's own career or rival or higher division if available
  const ownCareerClub = pool.find(
    (c) => c.carrera.toLowerCase() === career.career.toLowerCase()
  );
  if (ownCareerClub) chosen.push(ownCareerClub);

  const rivalClub = career.rival
    ? pool.find((c) => c.id === career.rival?.clubId)
    : undefined;
  if (rivalClub && !chosen.some((c) => c.id === rivalClub.id)) chosen.push(rivalClub);

  for (const club of shuffled) {
    if (chosen.length >= 3) break;
    if (!chosen.some((c) => c.id === club.id)) chosen.push(club);
  }

  return chosen.map((club) => {
    let tag: LeyendasTransferOffer['tag'] = 'PROYECTO COMPETITIVO';
    if (career.rival && club.id === career.rival.clubId) {
      tag = 'TRAICIÓN';
    } else if (club.carrera.toLowerCase() === career.career.toLowerCase()) {
      tag = 'MISMA CARRERA';
    } else if (
      (career.team.div === '3ª Div' && (club.div === '2ª Div' || club.div === '1ª Div')) ||
      (career.team.div === '2ª Div' && club.div === '1ª Div')
    ) {
      tag = 'SALTO DE DIVISIÓN';
    } else if (club.isRealTeam) {
      tag = 'EQUIPO REAL UFRO';
    }

    const rolePromise: LeyendasTransferOffer['rolePromise'] =
      career.ovr >= club.ovr + 3
        ? 'Estrella del Plantel'
        : career.ovr >= club.ovr - 3
        ? 'Titular Indiscutido'
        : 'Rotación Clave';

    const pitch =
      tag === 'TRAICIÓN'
        ? `Tu clásico rival quiere ficharte para dominar ${club.div}.`
        : tag === 'MISMA CARRERA'
        ? `El equipo oficial de tu carrera te ofrece la capitanía.`
        : tag === 'SALTO DE DIVISIÓN'
        ? `Oportunidad inmediata de ascender a ${club.div} y pelear el título.`
        : `Plantel competitivo (${club.ovr} OVR) con ambición de playoffs.`;

    return {
      id: `offer-${club.id}-${career.year}`,
      club,
      tag,
      pitch,
      rolePromise,
    };
  });
}

const COACH_NAMES = [
  'Profe Rodrigo Paredes',
  'DT Marcelo Alarcón',
  'DT Carolina Riffo',
  'Profe Cristian Huenchuleo',
  'DT Javiera Muñoz',
  'Profe Eduardo Lagos',
];

/**
 * Evaluates at the end of Semester 2 whether the club's DT renews the player for the next season.
 * Players who perform below club expectations (low OVR relative to team, Reserva role, poor season,
 * or recurring injury absence without impact) risk being released into Free Agency.
 */
export function evaluateCoachRenewal(params: {
  career: LeyendasCareerState;
  perfRoll: number;
  wasInjured: boolean;
  momentSuccess: boolean;
  rng?: () => number;
}): LeyendasCoachRenewalResult {
  const rng = params.rng ?? Math.random;
  const { career, perfRoll, wasInjured, momentSuccess } = params;
  const coachName = COACH_NAMES[(career.year + career.team.name.length) % COACH_NAMES.length];

  // Captains, stars, and players clearly above club level are always renewed
  const ovrGap = career.ovr - career.team.ovr;
  if (career.role === 'Capitán Leyenda' || career.role === 'Figura' || ovrGap >= 2) {
    return {
      renewed: true,
      coachName,
      reason: 'Pieza clave en la columna vertebral del plantel.',
      coachQuote: `Contamos contigo como referente de ${career.team.name} para la próxima temporada.`,
    };
  }

  // Calculate non-renewal risk based on performance & fit
  let cutChance = 0;
  const reasons: string[] = [];

  if (ovrGap <= -7) {
    cutChance += 0.55;
    reasons.push(`tu valoración (${career.ovr} OVR) quedó por debajo de la exigencia de ${career.team.name} (${career.team.ovr} OVR)`);
  } else if (ovrGap <= -4) {
    cutChance += 0.32;
    reasons.push(`el plantel subió su exigencia competitiva en ${career.team.div}`);
  }

  if (career.role === 'Reserva') {
    cutChance += 0.35;
    reasons.push('tuviste pocos minutos desde la banca');
  } else if (career.role === 'Rotación' && perfRoll < 74) {
    cutChance += 0.18;
    reasons.push('el DT busca un perfil más determinante en tu puesto');
  }

  if (perfRoll < 68) {
    cutChance += 0.22;
    reasons.push('el club decidió hacer una reestructuración profunda tras una campaña irregular');
  }

  if (wasInjured && !momentSuccess) {
    cutChance += 0.16;
    reasons.push('las lesiones limitaron tu continuidad en los partidos clave');
  }

  if (!momentSuccess && perfRoll < 76) {
    cutChance += 0.1;
  }

  const finalCutChance = Math.min(0.88, Math.max(0, cutChance));
  const released = finalCutChance > 0 && rng() < finalCutChance;

  if (!released) {
    return {
      renewed: true,
      coachName,
      reason: 'El cuerpo técnico valora tu proyección para el siguiente año.',
      coachQuote: `Buen cierre de año en ${career.team.name}. Tienes las puertas abiertas para renovar.`,
    };
  }

  const primaryReason =
    reasons.length > 0
      ? `El cuerpo técnico decidió no renovar tu cupo porque ${reasons.slice(0, 2).join(' y ')}.`
      : `El cuerpo técnico hará una renovación de plantel en ${career.team.name} y liberará tu cupo.`;

  return {
    renewed: false,
    coachName,
    reason: primaryReason,
    coachQuote: `"Agradecemos tu entrega en ${career.team.name}, pero para el próximo año no contaré contigo en la nómina. Busca minutos en otro club del campeonato y vuelve más fuerte."`,
  };
}

/**
 * Simulates a complete semester (S1 Groups + Copa Facultad, or S2 Playoffs + Ascenso/Descenso + Interfacultades + Selección UFRO).
 * Note: `incrementalOvrAlreadyApplied` lets the UI apply gradual OVR steps during Focus/Event/Mini-Game
 * so OVR never jumps abruptly at the end of the semester.
 */
export function simulateSemesterFull(params: {
  career: LeyendasCareerState;
  allClubs: LeyendasClub[];
  focusCard: LeyendasFocusCard;
  eventDelta: {
    ovrDelta: number;
    gpaDelta: number;
    statBonus: number;
    teamOvrBoost?: number;
    extraSemester?: boolean;
    injuryTriggered?: boolean;
    rehabCompleted?: boolean;
  };
  momentDelta: { ovrDelta: number; statBoost: number; success?: boolean; ovrXpDelta?: number };
  midSemesterImpact?: LeyendasMidSemesterResolution | null;
  gauntletResult?: LeyendasGauntletResult | null;
  incrementalOvrAlreadyApplied?: boolean;
  rng?: () => number;
}): LeyendasCareerState {
  const rng = params.rng ?? Math.random;
  const prev = params.career;
  const mid = params.midSemesterImpact ?? null;
  const gauntlet = params.gauntletResult ?? null;

  // Update physical load / injury risk (0..100)
  const riskShift =
    Math.round(params.focusCard.injuryRiskDelta * 100) + (mid?.injuryRiskDelta ?? 0);
  const nextInjuryRisk = Math.max(0, Math.min(90, prev.injuryRisk + riskShift));

  // Determine injury status for this semester and next
  let nextActiveInjury: LeyendasInjury | null = null;
  let injuryNote: string | undefined;
  let newInjuriesCount = prev.injuriesCount;
  let sufferedInjuryThisSemester = Boolean(prev.activeInjury);

  if (prev.activeInjury) {
    if (params.eventDelta.injuryTriggered) {
      // Relapse from forcing return
      nextActiveInjury = {
        ...prev.activeInjury,
        semestersRemaining: 1,
        description: `Recaída de ${prev.activeInjury.name} por forzar el regreso.`,
      };
      injuryNote = `Recaída física: ${prev.activeInjury.name}`;
      sufferedInjuryThisSemester = true;
    } else if (prev.activeInjury.semestersRemaining > 1 && !params.eventDelta.rehabCompleted) {
      nextActiveInjury = {
        ...prev.activeInjury,
        semestersRemaining: prev.activeInjury.semestersRemaining - 1,
      };
      injuryNote = `En rehabilitación de ${prev.activeInjury.name}`;
    } else {
      nextActiveInjury = null;
      injuryNote = `Alta médica completa de ${prev.activeInjury.name}`;
    }
  } else {
    const fatigueRollChance = nextInjuryRisk >= 45 ? (nextInjuryRisk - 35) / 140 : 0;
    const triggeredNew =
      Boolean(params.eventDelta.injuryTriggered) ||
      (fatigueRollChance > 0 && rng() < fatigueRollChance);

    if (triggeredNew) {
      const sevRoll = rng();
      const severity: 'LEVE' | 'MEDIA' | 'GRAVE' =
        sevRoll < 0.45 ? 'LEVE' : sevRoll < 0.82 ? 'MEDIA' : 'GRAVE';
      nextActiveInjury = rollSportInjury(prev.sportKey, severity, rng);
      newInjuriesCount += 1;
      sufferedInjuryThisSemester = true;
      injuryNote = `Lesión (${severity}): ${nextActiveInjury.name}`;
    }
  }

  const nextGauntletsWon = (prev.gauntletsWon ?? 0) + (gauntlet?.wonChampionship ? 1 : 0);
  const ovrCap = getOvrCapForCareer({
    trophiesCount: prev.trophies.length,
    gauntletsWon: nextGauntletsWon,
    ovr: prev.ovr,
  });

  const scholarshipXp = prev.hasScholarship ? 14 : 0;
  const injuryXp = sufferedInjuryThisSemester && !prev.activeInjury ? -46 : 0;

  let nextOvr = prev.ovr;
  let nextOvrProgress = prev.ovrProgress ?? 0;
  let appliedDelta = 0;

  if (params.incrementalOvrAlreadyApplied) {
    // Only apply end-of-semester subtle adjustment (scholarship / injury setback)
    const endXp = scholarshipXp + injuryXp;
    const res = applyOvrXpDelta({
      currentOvr: prev.ovr,
      currentProgress: prev.ovrProgress ?? 0,
      xpDelta: endXp,
      ovrCap,
      semestersPlayed: prev.semestersPlayed,
      momentum: prev.momentum ?? 0,
    });
    nextOvr = res.nextOvr;
    nextOvrProgress = res.nextProgress;
    appliedDelta = res.ovrDelta;
  } else {
    const focusXp =
      params.focusCard.ovrXpDelta ?? legacyOvrDeltaToXp(params.focusCard.ovrDelta);
    const eventXp = legacyOvrDeltaToXp(params.eventDelta.ovrDelta);
    const midXp = mid?.xpDelta ?? 0;
    const momentXp = gauntlet
      ? gauntlet.totalXpEarned
      : params.momentDelta.ovrXpDelta ?? legacyOvrDeltaToXp(params.momentDelta.ovrDelta);
    const totalXp = focusXp + eventXp + midXp + momentXp + scholarshipXp + injuryXp;
    const res = applyOvrXpDelta({
      currentOvr: prev.ovr,
      currentProgress: prev.ovrProgress ?? 0,
      xpDelta: totalXp,
      ovrCap,
      semestersPlayed: prev.semestersPlayed,
      momentum: prev.momentum ?? 0,
    });
    nextOvr = res.nextOvr;
    nextOvrProgress = res.nextProgress;
    appliedDelta = res.ovrDelta;
  }

  const nextMaxOvr = Math.max(prev.maxOvr, nextOvr);

  const nextGpa = updateHiddenGpa(
    prev.gpa,
    params.focusCard.gpaDelta + params.eventDelta.gpaDelta + (mid?.gpaDelta ?? 0),
    prev.hasScholarship
  );
  const nextScholarship = evaluateSportsScholarship(nextOvr, nextGpa);

  const boostedTeam: LeyendasClub = {
    ...prev.team,
    ovr: Math.min(
      93,
      prev.team.ovr + (params.eventDelta.teamOvrBoost ?? 0) + (mid?.teamOvrBoost ?? 0)
    ),
  };

  // Effective team strength blends club OVR and player impact
  const teamStrength = boostedTeam.ovr * 0.65 + nextOvr * 0.35;
  const matchesPlayed = sufferedInjuryThisSemester
    ? nextActiveInjury?.severity === 'GRAVE'
      ? 2
      : 4
    : prev.semester === 1
    ? 6
    : 8;

  const semStats = generateSemesterStats({
    sportKey: prev.sportKey,
    pos: prev.pos,
    ovr: nextOvr,
    statMult: sufferedInjuryThisSemester ? 0.6 : params.focusCard.statMult,
    extraBonus:
      params.eventDelta.statBonus +
      (mid?.statBonus ?? 0) +
      (gauntlet ? gauntlet.totalStatBoost : params.momentDelta.statBoost),
    matchesPlayed,
    rng,
  });

  const nextStats: LeyendasStats = {
    g: prev.stats.g + semStats.g,
    a: prev.stats.a + semStats.a,
    m: prev.stats.m + semStats.m,
    pts: prev.stats.pts + semStats.pts,
    reb: prev.stats.reb + semStats.reb,
    ast: prev.stats.ast + semStats.ast,
    blk: prev.stats.blk + semStats.blk,
    ace: prev.stats.ace + semStats.ace,
  };

  const trophiesWon: LeyendasTrophyRecord[] = [];
  const awardsWon: LeyendasAwardRecord[] = [];
  const newTimeline: LeyendasTimelineEntry[] = [];
  let pendingLoanOffers: LeyendasClub[] = [];
  let promotedLabel: string | undefined;
  let relegatedLabel: string | undefined;
  let seleccionLabel: string | undefined;
  let gauntletBadge: string | undefined;
  let nextTeam = boostedTeam;
  let nextCaps = prev.caps + (mid?.capsGain ?? 0);
  let nextClimbed = prev.climbedFromThirdToFirst;
  let headline = '';
  let subheadline = '';

  if (mid) {
    newTimeline.push({
      id: `tl-mid-${prev.year}-${prev.semester}`,
      year: prev.year,
      semester: prev.semester,
      badge: mid.timelineBadge,
      title: mid.timelineTitle,
      detail: mid.narrative,
      tone: mid.success
        ? mid.choiceTag === 'SELECCIÓN' || mid.choiceTag === 'DOBLE FRENTE'
          ? 'gold'
          : 'accent'
        : 'danger',
    });

    if (mid.capsGain > 0 && mid.seleccionTournamentName) {
      seleccionLabel = `Selección UFRO · ${mid.seleccionTournamentName} (+${mid.capsGain} caps)`;
      if (mid.success && prev.semester === 2 && nextOvr >= 84 && rng() < 0.45) {
        trophiesWon.push({
          id: `sel-mid-${prev.year}`,
          title: `Selección UFRO · ${mid.seleccionTournamentName}`,
          year: prev.year,
          team: 'Selección UFRO',
        });
      }
    }
  }

  if (nextActiveInjury && !prev.activeInjury) {
    newTimeline.push({
      id: `tl-inj-${prev.year}-${prev.semester}`,
      year: prev.year,
      semester: prev.semester,
      badge: `LESIÓN ${nextActiveInjury.severity}`,
      title: nextActiveInjury.name,
      detail: `${nextActiveInjury.description} Solo pudiste disputar ${matchesPlayed} partidos.`,
      tone: 'danger',
    });
  }

  const perfRoll =
    teamStrength +
    (rng() * 20 - 10) +
    (mid?.qualificationBonus ?? 0) -
    (sufferedInjuryThisSemester ? 3 : 0);

  // Update Momentum streak (-2..+3)
  let nextMomentum = prev.momentum ?? 0;
  if (gauntlet) {
    nextMomentum = gauntlet.wonChampionship
      ? Math.min(3, nextMomentum + 2)
      : Math.max(-2, nextMomentum - 1);
  } else if (params.momentDelta.success === true) {
    nextMomentum = Math.min(3, nextMomentum + 1);
  } else if (params.momentDelta.success === false) {
    nextMomentum = Math.max(-2, nextMomentum - 1);
  }

  const nextLastGauntletYear = gauntlet ? prev.year : (prev.lastGauntletYear ?? null);

  if (prev.semester === 1) {
    // S1: Fase de Grupos + Copa Facultad
    const qualified = perfRoll >= 74;
    const wonCopaFacultad = perfRoll >= 84 && rng() < 0.55;

    if (wonCopaFacultad) {
      const trophy: LeyendasTrophyRecord = {
        id: `copa-fac-${prev.year}`,
        title: `Copa Facultad · ${SPORT_CONFIG[prev.sportKey].shortName}`,
        year: prev.year,
        team: boostedTeam.name,
      };
      trophiesWon.push(trophy);
      newTimeline.push({
        id: `tl-copafac-${prev.year}`,
        year: prev.year,
        semester: 1,
        badge: 'CAMPEÓN',
        title: `¡Campeón Copa Facultad ${prev.year}!`,
        detail: `Levantaste la Copa Facultad con ${boostedTeam.name} tras un Apertura brillante.`,
        tone: 'gold',
      });
    }

    if (qualified) {
      headline = wonCopaFacultad
        ? `¡Campeón de Copa Facultad y Clasificado a Playoffs!`
        : `Clasificados a Playoffs ${prev.year}`;
      subheadline = `${boostedTeam.name} superó la Fase de Grupos en ${boostedTeam.div} y jugará por el título en el Semestre 2.`;
      newTimeline.push({
        id: `tl-s1-${prev.year}`,
        year: prev.year,
        semester: 1,
        badge: 'GRUPOS',
        title: `Clasificación a Playoffs (${boostedTeam.div})`,
        detail: `Cerraste S1 con ${nextOvr} OVR${sufferedInjuryThisSemester ? ' (afectado por lesión)' : ''}.`,
        tone: 'accent',
      });
    } else {
      headline = `Eliminados en Fase de Grupos (${boostedTeam.div})`;
      subheadline = `${boostedTeam.name} no avanzó a los playoffs, pero clubes clasificados buscan refuerzos a préstamo para el S2.`;
      const contenders = params.allClubs
        .filter(
          (c) =>
            c.sportKey === prev.sportKey &&
            c.branch === prev.branch &&
            c.id !== boostedTeam.id &&
            c.ovr >= boostedTeam.ovr - 2
        )
        .sort(() => rng() - 0.5)
        .slice(0, 2);
      pendingLoanOffers = contenders;
      newTimeline.push({
        id: `tl-s1-elim-${prev.year}`,
        year: prev.year,
        semester: 1,
        badge: 'GRUPOS',
        title: `Eliminación temprana en ${boostedTeam.div}`,
        detail: `Quedaste fuera de playoffs en S1; se abre ventana de préstamo para S2.`,
        tone: 'neutral',
      });
    }
  } else {
    // S2: Playoffs + Ascenso/Descenso + Interfacultades + Selección UFRO + Premios Individuales
    const wonIntercarreras = gauntlet
      ? gauntlet.finalStageReached === 'CAMPEÓN'
      : perfRoll >= 84;
    const finalist = gauntlet
      ? gauntlet.finalStageReached === 'FINAL'
      : !wonIntercarreras && perfRoll >= 79;
    const thirdPlace = gauntlet
      ? gauntlet.finalStageReached === 'SEMIFINAL'
      : !wonIntercarreras && !finalist && perfRoll >= 75;
    const relegated = gauntlet
      ? false
      : prev.sportKey === 'futbol' &&
        prev.branch === 'hombre' &&
        (boostedTeam.div === '1ª Div' || boostedTeam.div === '2ª Div') &&
        perfRoll < 65;

    if (gauntlet) {
      gauntletBadge = gauntlet.wonChampionship
        ? `Ruta Épica superada (${gauntlet.roundsCleared}/${gauntlet.totalRounds})`
        : `Eliminación Directa · ${gauntlet.eliminatedAtStage ?? 'Playoffs'}`;
    }

    if (wonIntercarreras) {
      const titleText =
        prev.sportKey === 'futbol' && prev.branch === 'hombre'
          ? `Campeón Intercarreras · ${boostedTeam.div}`
          : `Campeón Intercarreras · ${SPORT_CONFIG[prev.sportKey].shortName}`;
      trophiesWon.push({
        id: `ic-${prev.year}-${boostedTeam.div}`,
        title: titleText,
        year: prev.year,
        team: boostedTeam.name,
      });
      headline = gauntlet ? gauntlet.headline : `¡Campeón Intercarreras ${prev.year}!`;
      subheadline = gauntlet
        ? gauntlet.narrative
        : `${boostedTeam.name} conquistó la Gran Final en ${boostedTeam.div}.`;
      newTimeline.push({
        id: `tl-champ-${prev.year}`,
        year: prev.year,
        semester: 2,
        badge: gauntlet ? 'RUTA ÉPICA' : 'TÍTULO',
        title: `¡${titleText} ${prev.year}!`,
        detail: gauntlet
          ? gauntlet.narrative
          : `Figura en la Gran Final con ${boostedTeam.name} (${nextOvr} OVR).`,
        tone: 'gold',
      });

      if (prev.sportKey === 'futbol' && prev.branch === 'hombre') {
        if (boostedTeam.div === '3ª Div') {
          nextTeam = { ...boostedTeam, div: '2ª Div', ovr: Math.min(84, boostedTeam.ovr + 3) };
          promotedLabel = 'Ascenso histórico a 2ª División';
        } else if (boostedTeam.div === '2ª Div') {
          nextTeam = { ...boostedTeam, div: '1ª Div', ovr: Math.min(89, boostedTeam.ovr + 3) };
          promotedLabel = '¡Ascenso a Primera División UFRO!';
          if (prev.startedDiv === '3ª Div') {
            nextClimbed = true;
          }
        }
      }
    } else if (finalist) {
      headline = gauntlet ? gauntlet.headline : `Subcampeón Intercarreras ${prev.year}`;
      subheadline = gauntlet
        ? gauntlet.narrative
        : `${boostedTeam.name} cayó en una final vibrante de ${boostedTeam.div}.`;
      if (prev.sportKey === 'futbol' && prev.branch === 'hombre' && boostedTeam.div === '3ª Div') {
        nextTeam = { ...boostedTeam, div: '2ª Div', ovr: Math.min(82, boostedTeam.ovr + 2) };
        promotedLabel = 'Ascenso a 2ª División como Subcampeón';
      } else if (prev.sportKey === 'futbol' && prev.branch === 'hombre' && boostedTeam.div === '2ª Div') {
        nextTeam = { ...boostedTeam, div: '1ª Div', ovr: Math.min(88, boostedTeam.ovr + 2) };
        promotedLabel = 'Ascenso a Primera División como Subcampeón';
        if (prev.startedDiv === '3ª Div') nextClimbed = true;
      }
      newTimeline.push({
        id: `tl-sub-${prev.year}`,
        year: prev.year,
        semester: 2,
        badge: 'FINAL',
        title: `Subcampeón ${boostedTeam.div} (${prev.year})`,
        detail: gauntlet
          ? gauntlet.narrative
          : `Gran campaña con ${boostedTeam.name} hasta el último partido.`,
        tone: 'accent',
      });
    } else if (thirdPlace) {
      headline = gauntlet
        ? `Semifinalista · Ruta de Playoffs ${prev.year}`
        : `Podio · Tercer Lugar ${prev.year}`;
      subheadline = gauntlet
        ? gauntlet.narrative
        : `${boostedTeam.name} cerró el año ganando el partido por el bronce.`;
      newTimeline.push({
        id: `tl-3rd-${prev.year}`,
        year: prev.year,
        semester: 2,
        badge: gauntlet ? 'SEMIFINAL' : 'PODIO',
        title: gauntlet
          ? `Semifinalista en ${boostedTeam.div}`
          : `Tercer Lugar en ${boostedTeam.div}`,
        detail: gauntlet
          ? gauntlet.narrative
          : `Victoria en la definición por el 3° puesto con ${boostedTeam.name}.`,
        tone: 'neutral',
      });
    } else if (relegated) {
      const nextDiv = boostedTeam.div === '1ª Div' ? '2ª Div' : '3ª Div';
      nextTeam = { ...boostedTeam, div: nextDiv, ovr: Math.max(62, boostedTeam.ovr - 3) };
      relegatedLabel = `Descenso a ${nextDiv}`;
      headline = `Temporada Dura · Descenso a ${nextDiv}`;
      subheadline = `${boostedTeam.name} perdió la categoría tras un Clausura muy cuesta arriba.`;
      newTimeline.push({
        id: `tl-rel-${prev.year}`,
        year: prev.year,
        semester: 2,
        badge: 'DESCENSO',
        title: `Descenso a ${nextDiv}`,
        detail: `Toca decidir si reconstruyes en el club o escuchas ofertas del mercado.`,
        tone: 'danger',
      });
    } else {
      headline = gauntlet
        ? `${gauntlet.headline} · Temporada ${prev.year}`
        : `Cuartos de Final · Temporada ${prev.year}`;
      subheadline = gauntlet
        ? gauntlet.narrative
        : `${boostedTeam.name} compitió en playoffs pero quedó en el camino.`;
      newTimeline.push({
        id: `tl-qf-${prev.year}`,
        year: prev.year,
        semester: 2,
        badge: 'PLAYOFFS',
        title: gauntlet
          ? `Eliminación en ${gauntlet.eliminatedAtStage ?? 'Playoffs'} (${boostedTeam.div})`
          : `Campaña sólida en ${boostedTeam.div}`,
        detail: gauntlet
          ? gauntlet.narrative
          : `Sumaste experiencia clave y cerraste con ${nextOvr} OVR.`,
        tone: 'neutral',
      });
    }

    // Interfacultades bonus cup
    if (perfRoll >= 86 && rng() < 0.45) {
      trophiesWon.push({
        id: `interfac-${prev.year}`,
        title: `Campeón Interfacultades UFRO`,
        year: prev.year,
        team: boostedTeam.facultad,
      });
    }

    // Selección UFRO (CNU / LDES / Univerciudad / FENAUDE)
    if (nextOvr >= 80 && !sufferedInjuryThisSemester) {
      const tournaments = ['FENAUDE Nacional', 'LDES Araucanía', 'CNU Universitario', 'Univerciudad'];
      const chosenTourney = tournaments[prev.year % tournaments.length];
      const addedCaps = nextOvr >= 88 ? 4 : 2;
      nextCaps += addedCaps;
      seleccionLabel = `Convocado Selección UFRO · ${chosenTourney} (+${addedCaps} caps)`;
      if (nextOvr >= 86 && rng() < 0.42) {
        trophiesWon.push({
          id: `sel-${prev.year}`,
          title: `Selección UFRO · ${chosenTourney}`,
          year: prev.year,
          team: 'Selección UFRO',
        });
      }
      newTimeline.push({
        id: `tl-sel-${prev.year}`,
        year: prev.year,
        semester: 2,
        badge: 'SELECCIÓN',
        title: `Nómina Selección UFRO (${chosenTourney})`,
        detail: `Representaste a la Universidad de La Frontera sumando ${addedCaps} partidos oficiales.`,
        tone: 'accent',
      });
    }

    // Individual Awards
    if (nextOvr >= 85 && (wonIntercarreras || finalist) && rng() < 0.72) {
      awardsWon.push({ id: `mvp-${prev.year}`, title: `MVP del Campeonato ${prev.year}`, year: prev.year });
    }
    if (
      (prev.sportKey === 'futbol' && semStats.g >= 8) ||
      (prev.sportKey === 'basquet' && semStats.pts >= 105) ||
      (prev.sportKey === 'voley' && semStats.pts >= 80)
    ) {
      awardsWon.push({
        id: `scorer-${prev.year}`,
        title: prev.sportKey === 'futbol' ? `Goleador Intercarreras ${prev.year}` : `Máximo Anotador ${prev.year}`,
        year: prev.year,
      });
    }
    if (
      (prev.sportKey === 'futbol' && semStats.a >= 6) ||
      (prev.sportKey === 'basquet' && semStats.ast >= 42) ||
      (prev.sportKey === 'voley' && semStats.ast >= 95)
    ) {
      awardsWon.push({
        id: `assist-${prev.year}`,
        title: `Líder en Asistencias ${prev.year}`,
        year: prev.year,
      });
    }
    if (prev.sportKey === 'futbol' && prev.pos === 'ARQ' && nextOvr >= 78 && rng() < 0.65) {
      awardsWon.push({ id: `gloves-${prev.year}`, title: `Guante de Oro ${prev.year}`, year: prev.year });
    }
    if (nextOvr >= 78 && awardsWon.length === 0 && rng() < 0.55) {
      awardsWon.push({
        id: `toty-${prev.year}`,
        title: `Equipo Ideal (TOTY) ${prev.year}`,
        year: prev.year,
      });
    }
  }

  // Update Rival H2H
  let nextRival = prev.rival;
  if (nextRival) {
    const wonH2h = nextOvr + (rng() * 14 - 7) >= nextRival.ovr;
    nextRival = {
      ...nextRival,
      ovr: Math.min(97, nextRival.ovr + (rng() < 0.55 ? 1 : 0)),
      h2hWins: nextRival.h2hWins + (wonH2h ? 1 : 0),
      h2hLosses: nextRival.h2hLosses + (wonH2h ? 0 : 1),
    };
  }

  const nextSemestersPlayed = prev.semestersPlayed + 1;
  const nextTotalSemesters = prev.totalSemesters + (params.eventDelta.extraSemester ? 1 : 0);

  // Return from loan automatically at end of S2
  let finalTeamForNext = nextTeam;
  let nextOnLoan = prev.onLoan;
  let nextHomeClub = prev.homeClub;
  if (prev.semester === 2 && prev.onLoan && prev.homeClub) {
    finalTeamForNext = prev.homeClub;
    nextOnLoan = false;
    nextHomeClub = null;
  }

  // Update career stints cleanly
  const nextStints = [...prev.stints];
  const lastStint = nextStints[nextStints.length - 1];
  if (lastStint && lastStint.team === boostedTeam.name) {
    const startYr = lastStint.years.split('–')[0];
    nextStints[nextStints.length - 1] = {
      ...lastStint,
      div: finalTeamForNext.div,
      years: startYr === String(prev.year) ? String(prev.year) : `${startYr}–${prev.year}`,
    };
  } else {
    nextStints.push({
      team: boostedTeam.name,
      teamId: boostedTeam.realTeamId,
      sigla: boostedTeam.sigla,
      escudo: boostedTeam.escudo,
      div: boostedTeam.div,
      years: String(prev.year),
    });
  }

  const nextYear = prev.semester === 2 ? prev.year + 1 : prev.year;
  const nextSemester: 1 | 2 = prev.semester === 1 ? 2 : 1;
  const reachedGraduation = nextSemestersPlayed >= nextTotalSemesters;
  const nextRole = computeRoleFromOvr(nextOvr, finalTeamForNext.ovr, nextSemestersPlayed);

  const updatedBase: LeyendasCareerState = {
    ...prev,
    year: reachedGraduation ? prev.year : nextYear,
    semester: reachedGraduation ? prev.semester : nextSemester,
    semestersPlayed: nextSemestersPlayed,
    totalSemesters: nextTotalSemesters,
    ovr: nextOvr,
    ovrProgress: nextOvrProgress,
    maxOvr: nextMaxOvr,
    lastOvrDelta: appliedDelta,
    momentum: nextMomentum,
    lastGauntletYear: nextLastGauntletYear,
    gauntletsWon: nextGauntletsWon,
    gpa: nextGpa,
    hasScholarship: nextScholarship,
    injuredSemesters: nextActiveInjury ? prev.injuredSemesters + 1 : 0,
    returningFromInjury: Boolean(prev.activeInjury && !nextActiveInjury),
    activeInjury: nextActiveInjury,
    injuryRisk: nextActiveInjury ? 15 : nextInjuryRisk,
    injuriesCount: newInjuriesCount,
    team: finalTeamForNext,
    homeClub: nextHomeClub,
    onLoan: nextOnLoan,
    climbedFromThirdToFirst: nextClimbed,
    role: nextRole,
    caps: nextCaps,
    stats: nextStats,
    stints: nextStints,
    trophies: [...prev.trophies, ...trophiesWon],
    awards: [...prev.awards, ...awardsWon],
    timeline: [...newTimeline, ...prev.timeline].slice(0, 45),
    rival: nextRival,
    lastSemesterCelebration: {
      headline,
      subheadline,
      trophiesWon,
      awardsWon,
      promoted: promotedLabel,
      relegated: relegatedLabel,
      seleccionUfro: seleccionLabel,
      injuryNote,
      ovrChange: appliedDelta,
      gauntletBadge,
    },
    pendingLoanOffers,
    pendingTransferOffers: [],
    pendingReleaseNotice: null,
    pendingPostgradOption: null,
    finished: false,
  };

  if (reachedGraduation) {
    const postgrad = getPostgradEligibility(updatedBase);
    if (postgrad) {
      updatedBase.pendingPostgradOption = postgrad;
    } else {
      updatedBase.finished = true;
    }
  } else if (prev.semester === 2) {
    const renewal = evaluateCoachRenewal({
      career: updatedBase,
      perfRoll,
      wasInjured: sufferedInjuryThisSemester,
      momentSuccess: params.momentDelta.success ?? params.momentDelta.ovrDelta > 0,
      rng,
    });

    updatedBase.pendingTransferOffers = generateTransferOffers(updatedBase, params.allClubs, rng);

    if (!renewal.renewed && updatedBase.pendingTransferOffers.length > 0) {
      updatedBase.pendingReleaseNotice = renewal;
      const releaseEntry: LeyendasTimelineEntry = {
        id: `tl-release-${prev.year}`,
        year: prev.year,
        semester: 2,
        badge: 'NO RENOVACIÓN',
        title: `${finalTeamForNext.name} no renovó tu cupo`,
        detail: renewal.reason,
        tone: 'danger',
      };
      updatedBase.timeline = [releaseEntry, ...updatedBase.timeline].slice(0, 45);
    }
  }

  return updatedBase;
}

export function computeCreativeLegacyBanner(career: LeyendasCareerState): {
  title: string;
  subtitle: string;
  tier: 'GOAT' | 'LEYENDA' | 'ICONO' | 'FIGURA' | 'PROMESA';
} {
  const uniqueClubs = new Set(career.stints.map((s) => s.team)).size;
  if (career.maxOvr >= 99 || (career.trophies.length >= 5 && career.maxOvr >= 90)) {
    return {
      title: 'GOAT Absoluto del Campus UFRO',
      subtitle: 'Tu camiseta y tu apellido quedaron grabados en la historia grande de Intercarreras.',
      tier: 'GOAT',
    };
  }
  if (career.climbedFromThirdToFirst && career.trophies.length >= 2) {
    return {
      title: 'Héroe del Ascenso 3ª → 1ª',
      subtitle: 'De las canchas de Tercera División hasta levantar gloria en la élite universitaria.',
      tier: 'LEYENDA',
    };
  }
  if (uniqueClubs === 1 && career.trophies.length >= 3) {
    return {
      title: 'Leyenda de Un Solo Escudo',
      subtitle: `Fidelidad absoluta a ${career.team.name} con una vitrina repleta de copas.`,
      tier: 'LEYENDA',
    };
  }
  if (career.caps >= 10) {
    return {
      title: 'Estrella de Selección UFRO',
      subtitle: 'Llevaste la bandera universitaria a lo más alto en torneos nacionales.',
      tier: 'ICONO',
    };
  }
  if (career.postgradStage === 'DOCTORADO' && career.trophies.length >= 1) {
    return {
      title: 'Doctor Honoris Causa de la Cancha',
      subtitle: 'Excelencia académica hasta el Doctorado y jerarquía intacta en playoffs.',
      tier: 'ICONO',
    };
  }
  if (career.trophies.length >= 2 || career.awards.length >= 3) {
    return {
      title: 'Ídolo de Intercarreras',
      subtitle: 'Referente indiscutido de tu generación en la Universidad de La Frontera.',
      tier: 'FIGURA',
    };
  }
  if (uniqueClubs >= 4) {
    return {
      title: 'Trotamundos del Campus',
      subtitle: 'Defendiste múltiples escudos dejando huella en cada camarín.',
      tier: 'FIGURA',
    };
  }
  return {
    title: 'Guerrero Universitario UFRO',
    subtitle: 'Defendiste tu carrera con orgullo desde el mechoneo hasta el egreso.',
    tier: 'PROMESA',
  };
}

export function calculateCareerLeaderboardScore(career: LeyendasCareerState): number {
  const uniqueClubs = new Set(career.stints.map((s) => s.team)).size;
  let score = 0;
  score += career.maxOvr * 25;
  score += career.trophies.length * 420;
  score += career.awards.length * 260;
  score += career.caps * 65;
  score += career.stats.g * 16 + career.stats.a * 11;
  score += Math.round(career.stats.pts * 1.4 + career.stats.reb * 1.2 + career.stats.ast * 1.6 + career.stats.blk * 4 + career.stats.ace * 5);
  if (career.climbedFromThirdToFirst) score += 600;
  if (uniqueClubs === 1 && career.semestersPlayed >= 8) score += 350;
  if (career.hasScholarship) score += 200;
  if (career.postgradStage === 'MAGISTER') score += 150;
  if (career.postgradStage === 'DOCTORADO') score += 350;
  return Math.max(0, Math.min(100000, Math.round(score)));
}

/**
 * Returns the current Chile (America/Santiago) ISO week key ("YYYY-Www")
 * and milliseconds remaining until the next Monday 00:00 Chile time.
 */
export function getChileWeekInfo(now: Date = new Date()): {
  weekKey: string;
  label: string;
  msRemaining: number;
} {
  // Format date parts in America/Santiago safely
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const y = Number(parts.year) || now.getUTCFullYear();
  const m = Number(parts.month) || now.getUTCMonth() + 1;
  const d = Number(parts.day) || now.getUTCDate();
  const hh = Number(parts.hour) || 0;
  const mm = Number(parts.minute) || 0;
  const ss = Number(parts.second) || 0;

  // ISO week number calculation in UTC using Santiago wall date
  const temp = new Date(Date.UTC(y, m - 1, d));
  const dayNum = temp.getUTCDay() || 7; // Mon=1 .. Sun=7
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const weekKey = `${temp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;

  // Time remaining until next Monday 00:00 in Santiago
  const daysLeft = 7 - dayNum;
  const secondsPassedToday = hh * 3600 + mm * 60 + ss;
  const secondsLeftToday = 86400 - secondsPassedToday;
  const msRemaining = Math.max(0, (daysLeft * 86400 + secondsLeftToday) * 1000);

  return {
    weekKey,
    label: `Semana ${String(weekNo).padStart(2, '0')} · ${temp.getUTCFullYear()}`,
    msRemaining,
  };
}

export function formatWeeklyCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${days}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
}

export function buildWeeklyLeaderboardViews(
  entries: LeyendasLeaderboardEntry[],
  weekKey: string,
  category: LeyendasRankingCategory
): LeyendasLeaderboardEntry[] {
  const weekly = entries.filter((e) => e.weekKey === weekKey);
  const scoped = weekly.filter((e) => {
    if (category === 'general') return true;
    if (category === 'futbol-h') return e.sportKey === 'futbol' && e.branch === 'hombre';
    if (category === 'futbol-m') return e.sportKey === 'futbol' && e.branch === 'mujer';
    if (category === 'basquet') return e.sportKey === 'basquet';
    if (category === 'voley') return e.sportKey === 'voley';
    return true;
  });

  return [...scoped]
    .sort((a, b) => b.score - a.score || b.maxOvr - a.maxOvr || b.titlesCount - a.titlesCount)
    .slice(0, 20);
}

export function createInitialCareerState(params: {
  playerName: string;
  careerName: string;
  sportKey: LeyendasSportKey;
  branch: LeyendasBranch;
  pos: string;
  team: LeyendasClub;
  allClubs: LeyendasClub[];
  startYear?: number;
  rng?: () => number;
}): LeyendasCareerState {
  const rng = params.rng ?? Math.random;
  const trimmedName = params.playerName.trim() || 'Leyenda UFRO';
  const isMathiasEgg = trimmedName.toLowerCase() === 'mathias bello';
  const startOvr = isMathiasEgg ? 90 : 63 + Math.floor(rng() * 6);
  const careerObj =
    UFRO_CAREERS.find((c) => c.carrera === params.careerName) ?? UFRO_CAREERS[0];
  const years = inferCareerYears(careerObj.carrera);
  const startYear = params.startYear ?? 2026;
  const rival = initRecurringRival(params.allClubs, params.team, params.branch, rng, trimmedName);
  const discLabel = DISCIPLINE_MAP[params.team.disciplineId]?.nombreCorto ?? params.team.div;

  return {
    playerName: trimmedName,
    career: careerObj.carrera,
    facultad: careerObj.facultad,
    sportKey: params.sportKey,
    branch: params.branch,
    pos: params.pos,
    startYear,
    year: startYear,
    semester: 1,
    semestersPlayed: 0,
    totalSemesters: years * 2,
    postgradStage: 'PREGRADO',
    ovr: startOvr,
    ovrProgress: 0,
    maxOvr: startOvr,
    lastOvrDelta: 0,
    momentum: 0,
    lastGauntletYear: null,
    gauntletsWon: 0,
    gpa: createInitialGpa(),
    hasScholarship: evaluateSportsScholarship(startOvr, createInitialGpa()),
    injuredSemesters: 0,
    returningFromInjury: false,
    activeInjury: null,
    injuryRisk: 8,
    injuriesCount: 0,
    team: params.team,
    homeClub: null,
    onLoan: false,
    startedDiv: params.team.div,
    climbedFromThirdToFirst: false,
    role: computeRoleFromOvr(startOvr, params.team.ovr, 0),
    caps: 0,
    stats: { g: 0, a: 0, m: 0, pts: 0, reb: 0, ast: 0, blk: 0, ace: 0 },
    stints: [
      {
        team: params.team.name,
        teamId: params.team.realTeamId,
        sigla: params.team.sigla,
        escudo: params.team.escudo,
        div: params.team.div,
        years: String(startYear),
      },
    ],
    trophies: [],
    awards: [],
    timeline: [
      {
        id: `tl-debut-${startYear}`,
        year: startYear,
        semester: 1,
        badge: isMathiasEgg ? 'MODO LEYENDA' : 'DEBUT',
        title: isMathiasEgg
          ? `¡Modo Leyenda Oculto! Debut con ${startOvr} OVR en ${params.team.name}`
          : `Fichaje Mechón en ${params.team.name}`,
        detail: `Arrancas tu carrera en ${discLabel} estudiando ${careerObj.carrera} (${years} años).`,
        tone: isMathiasEgg ? 'gold' : 'accent',
      },
    ],
    rival,
    lastEventSummary: null,
    lastMomentSummary: null,
    lastSemesterCelebration: null,
    pendingLoanOffers: [],
    pendingTransferOffers: [],
    pendingReleaseNotice: null,
    pendingPostgradOption: null,
    finished: false,
  };
}

export function buildLeaderboardEntryFromCareer(
  career: LeyendasCareerState,
  uid: string,
  now: Date = new Date()
): LeyendasLeaderboardEntry {
  const legacy = computeCreativeLegacyBanner(career);
  const score = calculateCareerLeaderboardScore(career);
  const week = getChileWeekInfo(now);
  const cleanId = `ley_${uid.slice(0, 10)}_${now.getTime()}`;

  return {
    id: cleanId,
    uid,
    playerName: career.playerName.slice(0, 80),
    career: career.career.slice(0, 120),
    sportKey: career.sportKey,
    branch: career.branch,
    pos: career.pos.slice(0, 12),
    ovr: Math.round(career.ovr),
    maxOvr: Math.round(career.maxOvr),
    score,
    legacyTitle: legacy.title.slice(0, 100),
    legacyDesc: legacy.subtitle.slice(0, 220),
    titlesCount: career.trophies.length,
    awardsCount: career.awards.length,
    capsCount: career.caps,
    semestersPlayed: career.semestersPlayed,
    stats: { ...career.stats },
    finalTeam: career.team.name.slice(0, 100),
    finalTeamId: career.team.realTeamId,
    finalTeamEscudo:
      career.team.escudo && career.team.escudo.length <= 160000
        ? career.team.escudo
        : undefined,
    stints: career.stints.slice(0, 15).map((s) => ({
      team: s.team.slice(0, 100),
      teamId: s.teamId,
      sigla: s.sigla?.slice(0, 8),
      div: s.div.slice(0, 24),
      years: s.years.slice(0, 20),
    })),
    trophies: career.trophies.slice(0, 60).map((t) => ({
      id: t.id.slice(0, 60),
      title: t.title.slice(0, 100),
      year: t.year,
      team: t.team.slice(0, 100),
    })),
    awards: career.awards.slice(0, 40).map((a) => ({
      id: a.id.slice(0, 60),
      title: a.title.slice(0, 100),
      year: a.year,
    })),
    weekKey: week.weekKey,
    createdAt: now.toISOString(),
  };
}
