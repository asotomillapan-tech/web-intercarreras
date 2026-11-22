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
  maxOvr: number;
  gpa: number;
  hasScholarship: boolean;
  injuredSemesters: number;
  returningFromInjury: boolean;
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
  } | null;
  pendingLoanOffers: LeyendasClub[];
  pendingTransferOffers: LeyendasTransferOffer[];
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

export function buildTryoutPool(
  allClubs: LeyendasClub[],
  sportKey: LeyendasSportKey,
  branch: LeyendasBranch,
  selectedCareer: string,
  rng: () => number = Math.random
): LeyendasClub[] {
  const scoped = allClubs.filter((c) => c.sportKey === sportKey && c.branch === branch);
  if (scoped.length === 0) return [];

  const normCareer = selectedCareer.toLowerCase().trim();
  const sameCareerReal = scoped.filter(
    (c) => c.isRealTeam && c.carrera.toLowerCase().trim() === normCareer
  );
  const sameCareerFallback = scoped.filter(
    (c) => !c.isRealTeam && c.carrera.toLowerCase().trim() === normCareer
  );
  const realOthers = scoped.filter(
    (c) => c.isRealTeam && c.carrera.toLowerCase().trim() !== normCareer
  );
  const fallbackOthers = scoped.filter(
    (c) => !c.isRealTeam && c.carrera.toLowerCase().trim() !== normCareer
  );

  const shuffle = <T,>(arr: T[]) => [...arr].sort(() => rng() - 0.5);
  const pool: LeyendasClub[] = [];

  // Real UFRO clubs from the player's career always appear first, then other real UFRO teams
  for (const candidate of [
    ...shuffle(sameCareerReal),
    ...shuffle(sameCareerFallback),
    ...shuffle(realOthers),
    ...shuffle(fallbackOthers),
  ]) {
    if (pool.length >= 4) break;
    if (!pool.some((p) => p.id === candidate.id)) {
      pool.push(candidate);
    }
  }

  return pool.sort((a, b) => b.ovr - a.ovr);
}

export function buildFallbackTryoutTeams(
  allClubs: LeyendasClub[],
  sportKey: LeyendasSportKey,
  branch: LeyendasBranch,
  excludeClubId?: string
): LeyendasClub[] {
  const scoped = allClubs
    .filter((c) => c.sportKey === sportKey && c.branch === branch && c.id !== excludeClubId)
    .sort((a, b) => a.ovr - b.ovr);
  return scoped.slice(0, 3);
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
    ovrDelta: 4,
    gpaDelta: -0.25,
    statMult: 1.25,
    injuryRiskDelta: 0.06,
    flair: 'Subes fuerte tu nivel competitivo, pero exige tiempo de estudio.',
  },
  {
    id: 'focus-seleccion-ufro',
    tier: 'ORO',
    title: 'Sparring con Selección UFRO',
    subtitle: 'Entrenamiento táctico de alta intensidad',
    ovrDelta: 5,
    gpaDelta: -0.35,
    statMult: 1.3,
    injuryRiskDelta: 0.08,
    flair: 'Ritmo de selección universitaria. Salto élite en OVR.',
  },
  {
    id: 'focus-equilibrio',
    tier: 'PLATA',
    title: 'Método Atleta-Estudiante',
    subtitle: 'Planificación entre Gimnasio Olímpico y Biblioteca',
    ovrDelta: 2,
    gpaDelta: 0.35,
    statMult: 1.05,
    injuryRiskDelta: -0.02,
    flair: 'Crecimiento constante y notas sólidas para Beca y Postgrado.',
  },
  {
    id: 'focus-tactico',
    tier: 'PLATA',
    title: 'Videoanálisis con el DT',
    subtitle: 'Lectura de rivales y pelota detenida',
    ovrDelta: 3,
    gpaDelta: 0.05,
    statMult: 1.15,
    injuryRiskDelta: -0.02,
    flair: 'Mejora inteligente sin desgaste físico extra.',
  },
  {
    id: 'focus-gimnasio',
    tier: 'PLATA',
    title: 'Potencia en Gimnasio Olímpico',
    subtitle: 'Fuerza explosiva y prevención de lesiones',
    ovrDelta: 3,
    gpaDelta: -0.1,
    statMult: 1.12,
    injuryRiskDelta: -0.05,
    flair: 'Más potencia en cancha con menor riesgo físico.',
  },
  {
    id: 'focus-biblioteca',
    tier: 'BRONCE',
    title: 'Modo Biblioteca Central',
    subtitle: 'Prioridad absoluta a certámenes y promedio',
    ovrDelta: 0,
    gpaDelta: 0.65,
    statMult: 0.88,
    injuryRiskDelta: -0.04,
    flair: 'Rescata tu semestre académico y asegura Beca Deportiva.',
  },
  {
    id: 'focus-kine',
    tier: 'BRONCE',
    title: 'Recuperación Kinesiológica',
    subtitle: 'Descarga muscular en clínica UFRO',
    ovrDelta: 1,
    gpaDelta: 0.2,
    statMult: 0.95,
    injuryRiskDelta: -0.08,
    flair: 'Llegas fresco a playoffs y evitas lesiones largas.',
  },
  {
    id: 'focus-camarin',
    tier: 'BRONCE',
    title: 'Liderazgo de Camarín',
    subtitle: 'Cohesión con mechones y capitanes de carrera',
    ovrDelta: 2,
    gpaDelta: 0.1,
    statMult: 1.08,
    injuryRiskDelta: -0.01,
    flair: 'Sube la química del plantel y tus asistencias clave.',
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
  rng: () => number = Math.random
): LeyendasRival {
  const sameDiv = allClubs.filter(
    (c) =>
      c.sportKey === playerTeam.sportKey &&
      c.branch === branch &&
      c.id !== playerTeam.id
  );
  const club = sameDiv[Math.floor(rng() * Math.max(1, sameDiv.length))] ?? playerTeam;
  const names = branch === 'mujer' ? RANDOM_NAMES_FEMALE : RANDOM_NAMES_MALE;
  const name = names[Math.floor(rng() * names.length)];
  return {
    name,
    clubId: club.id,
    clubName: club.name,
    ovr: Math.min(96, Math.max(68, club.ovr + Math.floor(rng() * 6) - 1)),
    h2hWins: 0,
    h2hLosses: 0,
  };
}

function getCareerExclusiveEvent(careerName: string): LeyendasGameEvent {
  const lower = careerName.toLowerCase();
  if (lower.includes('medicina') || lower.includes('enfermer') || lower.includes('obstetricia')) {
    return {
      id: 'ev-career-salud',
      category: 'CARRERA',
      tag: 'EXCLUSIVO SALUD UFRO',
      title: 'Turno en Hospital Hernán Henríquez',
      description:
        'Tu turno clínico choca con la tarde previa a la fecha clave en el Complejo Deportivo UFRO.',
      options: [
        {
          id: 'opt-doblar',
          label: 'Cumplir turno y correr directo a cancha',
          hint: '+3 OVR · +0.25 GPA · riesgo fatiga',
          ovrDelta: 3,
          gpaDelta: 0.25,
          statBonus: 2,
          injuryChance: 0.12,
          outcomeSuccess: 'Demostraste garra de acero: llegaste con delantal en el bolso y la rompiste en cancha.',
        },
        {
          id: 'opt-permutar',
          label: 'Permutar turno con compañero y descansar',
          hint: '+2 OVR · -0.1 GPA · sin riesgo físico',
          ovrDelta: 2,
          gpaDelta: -0.1,
          statBonus: 1,
          outcomeSuccess: 'Llegaste descansado y lúcido al partido decisivo.',
        },
      ],
    };
  }
  if (lower.includes('ingeniería civil') || lower.includes('construcción')) {
    return {
      id: 'ev-career-ing',
      category: 'CARRERA',
      tag: 'EXCLUSIVO INGENIERÍA',
      title: 'Maratón de Cálculo y Proyecto FICA',
      description:
        'Semana de solemnes en el edificio D1 y entrega de proyecto justo antes de los cruces de grupo.',
      options: [
        {
          id: 'opt-trasnoche',
          label: 'Estudiar en grupo y entrenar igual',
          hint: '+2 OVR · +0.35 GPA · desgaste moderado',
          ovrDelta: 2,
          gpaDelta: 0.35,
          statBonus: 1,
          injuryChance: 0.08,
          outcomeSuccess: 'Aprobaste el solemne con nota azul y sumaste minutos de calidad.',
        },
        {
          id: 'opt-cancha',
          label: 'Priorizar táctica con el equipo',
          hint: '+4 OVR · -0.35 GPA',
          ovrDelta: 4,
          gpaDelta: -0.35,
          statBonus: 3,
          outcomeSuccess: 'En cancha fuiste figura indiscutida, aunque tocará remontar el promedio.',
        },
      ],
    };
  }
  if (lower.includes('comercial') || lower.includes('contador') || lower.includes('derecho')) {
    return {
      id: 'ev-career-fcje',
      category: 'CARRERA',
      tag: 'EXCLUSIVO FCJE UFRO',
      title: 'Gestión de Auspicio y Litigación',
      description:
        'Conseguiste un auspiciador local de Temuco para indumentaria nueva si lideras la presentación del club.',
      options: [
        {
          id: 'opt-auspicio',
          label: 'Cerrar auspicio y potenciar al plantel',
          hint: '+2 OVR · +2 OVR para tu equipo · +0.15 GPA',
          ovrDelta: 2,
          gpaDelta: 0.15,
          statBonus: 1,
          teamOvrBoost: 2,
          outcomeSuccess: 'Indumentaria nueva y motivación a tope: el club sube +2 OVR.',
        },
        {
          id: 'opt-enfoque',
          label: 'Delegar la gestión y concentrarte en entrenar',
          hint: '+3 OVR · +0.1 GPA',
          ovrDelta: 3,
          gpaDelta: 0.1,
          statBonus: 2,
          outcomeSuccess: 'Tu enfoque deportivo rindió frutos inmediatos en el torneo.',
        },
      ],
    };
  }
  if (lower.includes('educación física')) {
    return {
      id: 'ev-career-efi',
      category: 'CARRERA',
      tag: 'EXCLUSIVO ED. FÍSICA',
      title: 'Evaluación de Rendimiento Deportivo',
      description:
        'Tus laboratorios de fisiología del ejercicio te permiten optimizar tu preparación física.',
      options: [
        {
          id: 'opt-pico',
          label: 'Aplicar microciclo de potencia máxima',
          hint: '+4 OVR · +0.25 GPA',
          ovrDelta: 4,
          gpaDelta: 0.25,
          statBonus: 3,
          outcomeSuccess: 'Tus registros físicos volaron por los aires en el Complejo UFRO.',
        },
        {
          id: 'opt-prevencion',
          label: 'Blindar articulaciones y resistencia',
          hint: '+2 OVR · +0.35 GPA · cero lesiones',
          ovrDelta: 2,
          gpaDelta: 0.35,
          statBonus: 1,
          outcomeSuccess: 'Rendimiento parejo todo el semestre sin molestias físicas.',
        },
      ],
    };
  }
  return {
    id: 'ev-career-ufro',
    category: 'CARRERA',
    tag: 'VIDA UNIVERSITARIA UFRO',
    title: 'Semana de Carrera en Campus Andrés Bello',
    description:
      'Tu centro de estudiantes organiza actividades y pide que lideres la delegación deportiva.',
    options: [
      {
        id: 'opt-abanderado',
        label: 'Liderar la barra y jugar con la cinta',
        hint: '+3 OVR · +1 OVR al equipo',
        ovrDelta: 3,
        gpaDelta: -0.05,
        statBonus: 2,
        teamOvrBoost: 1,
        outcomeSuccess: 'El campus entero coreó a tu carrera y el plantel respondió en la cancha.',
      },
      {
        id: 'opt-estudio',
        label: 'Adelantar trabajos para liberar playoffs',
        hint: '+1 OVR · +0.45 GPA',
        ovrDelta: 1,
        gpaDelta: 0.45,
        statBonus: 0,
        outcomeSuccess: 'Quedaste libre de entregas justo cuando llegan los partidos decisivos.',
      },
    ],
  };
}

const STANDARD_EVENTS: LeyendasGameEvent[] = [
  {
    id: 'ev-lluvia-temuco',
    category: 'CAMPUS',
    tag: 'CLIMA DE LA ARAUCANÍA',
    title: 'Temporal Sureño en Cancha Sintética',
    description:
      'Diluvio clásico de Temuco a las 19:30 hrs. El balón corre rapidísimo y muchos piden suspender.',
    options: [
      {
        id: 'opt-barro',
        label: 'Jugar a máxima intensidad bajo la lluvia',
        hint: '70% éxito (+4 OVR) · 30% resbalón (-1 OVR)',
        ovrDelta: 4,
        gpaDelta: 0,
        statBonus: 3,
        successChance: 0.7,
        altOvrDelta: -1,
        altGpaDelta: 0,
        outcomeSuccess: 'Te luciste bajo la lluvia sureña: actuación inolvidable frente a la galería.',
        outcomeFail: 'Un resbalón te quitó precisión, pero el equipo valoró el sacrificio.',
      },
      {
        id: 'opt-control',
        label: 'Juego corto, seguro y táctico',
        hint: '+2 OVR garantizado · +0.1 GPA',
        ovrDelta: 2,
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
        hint: '65% éxito (+5 OVR) · 35% exceso de confianza (-1 OVR)',
        ovrDelta: 5,
        gpaDelta: -0.05,
        statBonus: 3,
        successChance: 0.65,
        altOvrDelta: -1,
        altGpaDelta: 0,
        outcomeSuccess: 'El técnico anotó tu nombre y dorsal en rojo en su libreta.',
        outcomeFail: 'Intentaste demasiado solo y el DT te pidió más juego colectivo.',
      },
      {
        id: 'opt-equipo',
        label: 'Jugar disciplinado para el colectivo',
        hint: '+2 OVR · +1 OVR equipo',
        ovrDelta: 2,
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
        hint: '+2 OVR · +0.15 GPA',
        ovrDelta: 2,
        gpaDelta: 0.15,
        statBonus: 1,
        outcomeSuccess: 'Reforzaste la amistad del plantel y amaneciste impecable.',
      },
      {
        id: 'opt-todo',
        label: 'Quedarse hasta el cierre (50/50 mística)',
        hint: '50% inspiración (+4 OVR) · 50% resaca (-2 OVR)',
        ovrDelta: 4,
        gpaDelta: -0.2,
        statBonus: 2,
        successChance: 0.5,
        altOvrDelta: -2,
        altGpaDelta: -0.25,
        outcomeSuccess: 'Inexplicablemente jugaste el mejor partido de tu vida al día siguiente.',
        outcomeFail: 'Las piernas no respondieron en el segundo tiempo. Lección aprendida.',
      },
    ],
  },
];

export function pickSemesterEvent(
  career: LeyendasCareerState,
  rng: () => number = Math.random
): LeyendasGameEvent {
  if (career.returningFromInjury) {
    return {
      id: 'ev-retorno-triunfal',
      category: 'RETORNO',
      tag: 'REGRESO TRIUNFAL',
      title: 'Alta Kinesiológica en el Campus',
      description:
        'Superaste la rehabilitación y el camarín espera tu retorno a la titularidad en Intercarreras.',
      options: [
        {
          id: 'opt-titular',
          label: 'Volver desde el primer minuto con hambre de gloria',
          hint: '+4 OVR · gran impulso estadístico',
          ovrDelta: 4,
          gpaDelta: 0.1,
          statBonus: 3,
          outcomeSuccess: 'Regreso soñado: ovación en la cancha y nivel superior al que tenías antes.',
        },
        {
          id: 'opt-gradual',
          label: 'Reintegración progresiva cuidando el físico',
          hint: '+2 OVR · +0.25 GPA',
          ovrDelta: 2,
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
          hint: '45% milagro (+3 OVR) · 55% +1 semestre extra',
          ovrDelta: 3,
          gpaDelta: 0.2,
          statBonus: 2,
          successChance: 0.45,
          altOvrDelta: 1,
          altGpaDelta: -0.2,
          extraSemester: true,
          outcomeSuccess: 'Pasaste raspando con un 4.0 y brillaste en el campeonato.',
          outcomeFail: 'Echaste el ramo: tu estadía en la UFRO se alarga 1 semestre más (¡más fútbol!).',
        },
      ],
    };
  }

  if (career.rival && rng() < 0.28) {
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
          hint: 'Probabilidad basada en tu OVR · +4 OVR si ganas',
          ovrDelta: 4,
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
          hint: '+2 OVR seguro · +1 OVR equipo',
          ovrDelta: 2,
          gpaDelta: 0.1,
          statBonus: 1,
          teamOvrBoost: 1,
          outcomeSuccess: 'Neutralizaste a tu rival sin caer en provocaciones.',
        },
      ],
    };
  }

  if (rng() < 0.4) {
    return getCareerExclusiveEvent(career.career);
  }

  return STANDARD_EVENTS[Math.floor(rng() * STANDARD_EVENTS.length)];
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
            baseSuccess: 0.72,
            ovrWeight: 0.008,
            successOvrDelta: 2,
            failOvrDelta: -1,
            statBoost: 2,
            successText: '¡GOLAZO! Definición quirúrgica para desatar la locura en el banco.',
            failText: 'El arquero adivinó el palo en el último instante.',
          },
          {
            id: 'c-panenka',
            label: 'Picarla a lo Panenka al centro',
            riskTag: 'AUDAZ',
            baseSuccess: 0.48,
            ovrWeight: 0.012,
            successOvrDelta: 4,
            failOvrDelta: -2,
            statBoost: 4,
            successText: '¡ESCÁNDALO EN LA UFRO! Panenka fría que se vuelve viral en toda la universidad.',
            failText: 'Se quedó demasiado suave y la atrapó el portero. Silencio en la galería.',
          },
          {
            id: 'c-potencia',
            label: 'Remate potente al ángulo superior',
            riskTag: 'EQUILIBRADO',
            baseSuccess: 0.62,
            ovrWeight: 0.01,
            successOvrDelta: 3,
            failOvrDelta: -1,
            statBoost: 3,
            successText: '¡INATAJABLE! Balón clavado en la escuadra para sellar el triunfo.',
            failText: 'El travesaño devolvió el bombazo por centímetros.',
          },
        ],
      },
      {
        id: 'km-f7-contra',
        title: 'Contragolpe 2 contra 1 en Tiempo Adicional',
        context: `Conduces a toda velocidad por la banda derecha defendiendo a ${career.team.name}.`,
        choices: [
          {
            id: 'c-pase',
            label: 'Ceder el pase de la muerte al compañero',
            riskTag: 'SEGURO',
            baseSuccess: 0.75,
            ovrWeight: 0.007,
            successOvrDelta: 2,
            failOvrDelta: 0,
            statBoost: 2,
            successText: 'Asistencia milimétrica y abrazo colectivo con todo el plantel.',
            failText: 'El defensor alcanzó a interceptar la línea de pase.',
          },
          {
            id: 'c-enganche',
            label: 'Enganchar hacia adentro y definir al segundo palo',
            riskTag: 'AUDAZ',
            baseSuccess: 0.54,
            ovrWeight: 0.011,
            successOvrDelta: 4,
            failOvrDelta: -1,
            statBoost: 3,
            successText: '¡OBRA DE ARTE! Amague limpio y golazo al segundo poste.',
            failText: 'El remate se fue rozando el vertical izquierdo.',
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
          baseSuccess: 0.7,
          ovrWeight: 0.008,
          successOvrDelta: 2,
          failOvrDelta: -1,
          statBoost: 5,
          successText: '¡DOBLE Y FALTA! Temple de acero para dar vuelta el marcador.',
          failText: 'Un tapón rival en la pintura cerró el aro sobre la bocina.',
        },
        {
          id: 'c-triple',
          label: 'Step-back de tres puntos sobre la chicharra',
          riskTag: 'AUDAZ',
          baseSuccess: 0.5,
          ovrWeight: 0.012,
          successOvrDelta: 4,
          failOvrDelta: -2,
          statBoost: 9,
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
        successOvrDelta: 2,
        failOvrDelta: -1,
        statBoost: 4,
        successText: '¡PUNTO DE ORO! Lectura perfecta que dejó sin reacción al rival.',
        failText: 'El líbero contrario voló para salvarla con una mano.',
      },
      {
        id: 'c-diagonal',
        label: 'Remache cruzado a máxima potencia',
        riskTag: 'AUDAZ',
        baseSuccess: 0.54,
        ovrWeight: 0.011,
        successOvrDelta: 4,
        failOvrDelta: -2,
        statBoost: 7,
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

/**
 * Simulates a complete semester (S1 Groups + Copa Facultad, or S2 Playoffs + Ascenso/Descenso + Interfacultades + Selección UFRO).
 */
export function simulateSemesterFull(params: {
  career: LeyendasCareerState;
  allClubs: LeyendasClub[];
  focusCard: LeyendasFocusCard;
  eventDelta: { ovrDelta: number; gpaDelta: number; statBonus: number; teamOvrBoost?: number; extraSemester?: boolean; injuryTriggered?: boolean };
  momentDelta: { ovrDelta: number; statBoost: number };
  rng?: () => number;
}): LeyendasCareerState {
  const rng = params.rng ?? Math.random;
  const prev = params.career;

  const isInjured = Boolean(params.eventDelta.injuryTriggered);
  const scholarshipBonus = prev.hasScholarship ? 1 : 0;
  const rawOvrDelta =
    params.focusCard.ovrDelta +
    params.eventDelta.ovrDelta +
    params.momentDelta.ovrDelta +
    scholarshipBonus +
    (isInjured ? -2 : 0);

  // Allow GOAT territory above 99 (up to 105) if the player is truly dominant
  const ovrCap = prev.trophies.length >= 2 || prev.ovr >= 94 ? 105 : 99;
  const nextOvr = Math.max(55, Math.min(ovrCap, prev.ovr + rawOvrDelta));
  const nextMaxOvr = Math.max(prev.maxOvr, nextOvr);

  const nextGpa = updateHiddenGpa(
    prev.gpa,
    params.focusCard.gpaDelta + params.eventDelta.gpaDelta,
    prev.hasScholarship
  );
  const nextScholarship = evaluateSportsScholarship(nextOvr, nextGpa);

  const boostedTeam: LeyendasClub = {
    ...prev.team,
    ovr: Math.min(93, prev.team.ovr + (params.eventDelta.teamOvrBoost ?? 0)),
  };

  // Effective team strength blends club OVR and player impact
  const teamStrength = boostedTeam.ovr * 0.65 + nextOvr * 0.35;
  const matchesPlayed = isInjured ? 3 : prev.semester === 1 ? 6 : 8;

  const semStats = generateSemesterStats({
    sportKey: prev.sportKey,
    pos: prev.pos,
    ovr: nextOvr,
    statMult: isInjured ? 0.55 : params.focusCard.statMult,
    extraBonus: params.eventDelta.statBonus + params.momentDelta.statBoost,
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
  let nextTeam = boostedTeam;
  let nextCaps = prev.caps;
  let nextClimbed = prev.climbedFromThirdToFirst;
  let headline = '';
  let subheadline = '';

  const perfRoll = teamStrength + (rng() * 20 - 10);

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
        detail: `Cerraste S1 con ${nextOvr} OVR${isInjured ? ' (con molestias físicas)' : ''}.`,
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
    const wonIntercarreras = perfRoll >= 84;
    const finalist = !wonIntercarreras && perfRoll >= 79;
    const thirdPlace = !wonIntercarreras && !finalist && perfRoll >= 75;
    const relegated =
      prev.sportKey === 'futbol' &&
      prev.branch === 'hombre' &&
      (boostedTeam.div === '1ª Div' || boostedTeam.div === '2ª Div') &&
      perfRoll < 65;

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
      headline = `¡CAMPEÓN INTERCARRERAS ${prev.year}!`;
      subheadline = `${boostedTeam.name} conquistó la Gran Final en ${boostedTeam.div}.`;
      newTimeline.push({
        id: `tl-champ-${prev.year}`,
        year: prev.year,
        semester: 2,
        badge: 'TÍTULO',
        title: `¡${titleText} ${prev.year}!`,
        detail: `Figura en la Gran Final con ${boostedTeam.name} (${nextOvr} OVR).`,
        tone: 'gold',
      });

      // Promotion in Fútbol 7 Hombres
      if (prev.sportKey === 'futbol' && prev.branch === 'hombre') {
        if (boostedTeam.div === '3ª Div') {
          nextTeam = { ...boostedTeam, div: '2ª Div', ovr: Math.min(84, boostedTeam.ovr + 4) };
          promotedLabel = 'Ascenso histórico a 2ª División';
        } else if (boostedTeam.div === '2ª Div') {
          nextTeam = { ...boostedTeam, div: '1ª Div', ovr: Math.min(89, boostedTeam.ovr + 4) };
          promotedLabel = '¡Ascenso a Primera División UFRO!';
          if (prev.startedDiv === '3ª Div') {
            nextClimbed = true;
          }
        }
      }
    } else if (finalist) {
      headline = `Subcampeón Intercarreras ${prev.year}`;
      subheadline = `${boostedTeam.name} cayó en una final vibrante de ${boostedTeam.div}.`;
      if (prev.sportKey === 'futbol' && prev.branch === 'hombre' && boostedTeam.div === '3ª Div') {
        nextTeam = { ...boostedTeam, div: '2ª Div', ovr: Math.min(82, boostedTeam.ovr + 3) };
        promotedLabel = 'Ascenso a 2ª División como Subcampeón';
      } else if (prev.sportKey === 'futbol' && prev.branch === 'hombre' && boostedTeam.div === '2ª Div') {
        nextTeam = { ...boostedTeam, div: '1ª Div', ovr: Math.min(88, boostedTeam.ovr + 3) };
        promotedLabel = 'Ascenso a Primera División como Subcampeón';
        if (prev.startedDiv === '3ª Div') nextClimbed = true;
      }
      newTimeline.push({
        id: `tl-sub-${prev.year}`,
        year: prev.year,
        semester: 2,
        badge: 'FINAL',
        title: `Subcampeón ${boostedTeam.div} (${prev.year})`,
        detail: `Gran campaña con ${boostedTeam.name} hasta el último partido.`,
        tone: 'accent',
      });
    } else if (thirdPlace) {
      headline = `Podio · Tercer Lugar ${prev.year}`;
      subheadline = `${boostedTeam.name} cerró el año ganando el partido por el bronce.`;
      newTimeline.push({
        id: `tl-3rd-${prev.year}`,
        year: prev.year,
        semester: 2,
        badge: 'PODIO',
        title: `Tercer Lugar en ${boostedTeam.div}`,
        detail: `Victoria en la definición por el 3° puesto con ${boostedTeam.name}.`,
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
      headline = `Cuartos de Final · Temporada ${prev.year}`;
      subheadline = `${boostedTeam.name} compitió en playoffs pero quedó en el camino.`;
      newTimeline.push({
        id: `tl-qf-${prev.year}`,
        year: prev.year,
        semester: 2,
        badge: 'PLAYOFFS',
        title: `Campaña sólida en ${boostedTeam.div}`,
        detail: `Sumaste experiencia clave y subiste a ${nextOvr} OVR.`,
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
    if (nextOvr >= 80 && !isInjured) {
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
      ovr: Math.min(97, nextRival.ovr + (rng() < 0.6 ? 1 : 0)),
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

  const updatedBase: LeyendasCareerState = {
    ...prev,
    year: reachedGraduation ? prev.year : nextYear,
    semester: reachedGraduation ? prev.semester : nextSemester,
    semestersPlayed: nextSemestersPlayed,
    totalSemesters: nextTotalSemesters,
    ovr: nextOvr,
    maxOvr: nextMaxOvr,
    gpa: nextGpa,
    hasScholarship: nextScholarship,
    injuredSemesters: isInjured ? 1 : 0,
    returningFromInjury: isInjured,
    team: finalTeamForNext,
    homeClub: nextHomeClub,
    onLoan: nextOnLoan,
    climbedFromThirdToFirst: nextClimbed,
    role: computeRoleFromOvr(nextOvr, finalTeamForNext.ovr, nextSemestersPlayed),
    caps: nextCaps,
    stats: nextStats,
    stints: nextStints,
    trophies: [...prev.trophies, ...trophiesWon],
    awards: [...prev.awards, ...awardsWon],
    timeline: [...newTimeline, ...prev.timeline].slice(0, 40),
    rival: nextRival,
    lastSemesterCelebration: {
      headline,
      subheadline,
      trophiesWon,
      awardsWon,
      promoted: promotedLabel,
      relegated: relegatedLabel,
      seleccionUfro: seleccionLabel,
    },
    pendingLoanOffers,
    pendingTransferOffers: [],
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
    updatedBase.pendingTransferOffers = generateTransferOffers(updatedBase, params.allClubs, rng);
  }

  return updatedBase;
}

export function computeCreativeLegacyBanner(career: LeyendasCareerState): {
  title: string;
  subtitle: string;
  tier: 'GOAT' | 'LEYENDA' | 'ICONO' | 'FIGURA' | 'PROMESA';
} {
  const uniqueClubs = new Set(career.stints.map((s) => s.team)).size;
  if (career.maxOvr >= 100 || (career.trophies.length >= 5 && career.maxOvr >= 90)) {
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
  const rival = initRecurringRival(params.allClubs, params.team, params.branch, rng);
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
    maxOvr: startOvr,
    gpa: createInitialGpa(),
    hasScholarship: evaluateSportsScholarship(startOvr, createInitialGpa()),
    injuredSemesters: 0,
    returningFromInjury: false,
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
