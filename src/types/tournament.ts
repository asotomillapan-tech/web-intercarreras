export type DisciplineId =
  | 'f7-h-1'
  | 'f7-h-2'
  | 'f7-h-3'
  | 'f7-m'
  | 'basquet-h'
  | 'basquet-3x3-m'
  | 'voley-m'
  | 'voley-h';

export type SportType = 'futbol7' | 'basquetbol' | 'basquetbol3x3' | 'voleibol';

export type AcademicLevel = 'Pregrado' | 'Postgrado';

export type MatchStatus = 'PROGRAMADO' | 'EN_VIVO' | 'FINALIZADO';

export type MatchPhase =
  | 'Grupos'
  | 'Octavos'
  | 'Cuartos'
  | 'Semifinal'
  | 'Tercer Lugar'
  | 'Final';

export type MatchPlayoffLeg = 'IDA' | 'VUELTA' | 'UNICO';

export type TournamentStage = 'INSCRIPCIONES' | 'FASE_GRUPOS' | 'TRANSFERENCIAS' | 'PLAYOFFS';

export interface DisciplineMeta {
  id: DisciplineId;
  nombre: string;
  nombreCorto: string;
  rama: 'Hombres' | 'Mujeres';
  sportType: SportType;
  sedePrincipal: string;
  minJugadores: number;
  maxJugadores: number;
  maxSeleccionadosPorEquipo: number;
  imagenEditorial: string;
}

export interface DisciplineFormatConfig {
  disciplineId: DisciplineId;
  temporada: string;
  maxCupos: number;
  numGrupos: number;
  clasificadosPorGrupo: number;
  formatoPlayoff: 4 | 8 | 16;
  incluyeTercerLugar?: boolean;
  playoffsIdaYVuelta?: boolean;
  inscripcionesAbiertas: boolean;
  transferenciasAbiertas: boolean;
  maxTransferenciasPorEquipo: number;
  faseActual: TournamentStage;
}

export interface CareerOption {
  carrera: string;
  facultad: string;
}

export interface Team {
  id: string;
  nombre: string;
  sigla: string;
  disciplineId: DisciplineId;
  carrera: string;
  facultad: string;
  groupName: string;
  escudo?: string;
  clubName?: string;
  anioFundacion?: number;
  logrosAnteriores?: string;
  capitanCorreo?: string;
  createdByUid?: string;
}

export interface PlayerStats {
  partidosJugados: number;
  goles: number;
  asistencias: number;
  tarjetasAmarillas: number;
  tarjetasRojas: number;
  puntos: number;
  rebotes: number;
  triples: number;
  faltas: number;
  aces: number;
  bloqueos: number;
}

export interface Player {
  id: string;
  teamId: string;
  disciplineId: DisciplineId;
  dorsal: number;
  posicion: string;
  // 12 mandatory official UFRO fields (PII fields are isolated in /player_private in Firestore)
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  carrera: string;
  facultad: string;
  rut: string;
  numeroMatricula: string;
  correoInstitucional: string;
  nivelAcademico: AcademicLevel;
  fechaNacimiento: string;
  fotografia: string;
  esSeleccionadoUfro: boolean;
  stats: PlayerStats;
}

export interface MatchEvent {
  id: string;
  minuteOrPeriod: string;
  teamId: string;
  playerId?: string;
  playerName?: string;
  playerOutId?: string;
  playerOutName?: string;
  type:
    | 'GOL'
    | 'ASISTENCIA'
    | 'AMARILLA'
    | 'ROJA'
    | 'PUNTO_1'
    | 'PUNTO_2'
    | 'PUNTO_3'
    | 'REBOTE'
    | 'FALTA'
    | 'TIEMPO_MUERTO'
    | 'PUNTO_VOLEY'
    | 'ACE'
    | 'BLOQUEO'
    | 'SET_GANADO'
    | 'CAMBIO';
  detail: string;
  pointsDelta?: number;
  periodIndex?: number;
  triggeredSetWin?: boolean;
}

export interface PeriodScore {
  home: number;
  away: number;
}

export interface MatchLiveState {
  onCourt: { home: string[]; away: string[] };
  excludedPlayerIds?: { home: string[]; away: string[] };
  periodFouls?: { home: number; away: number };
  servingSide?: 'home' | 'away';
  substitutionsCount?: { home: number; away: number };
  clockSeconds?: number;
  stoppageMinutes?: number;
}

export interface AiScoresheetResult {
  homeScoreDetected: number;
  awayScoreDetected: number;
  periodBreakdown: PeriodScore[];
  detectedEvents: string[];
  confidence: 'alta' | 'media' | 'baja';
  discrepancies: string[];
  requiresManualReview: boolean;
  summary: string;
}

export interface ScoresheetValidationRecord {
  validatedAt: string;
  refereeName: string;
  method: 'IA_AUTOMATICA' | 'MANUAL_ARBITRO';
  imagePreview?: string;
  aiResult?: AiScoresheetResult;
  manualNotes?: string;
  finalHomeScore: number;
  finalAwayScore: number;
}

export type MatchAttendanceStatus = 'NO_REGISTRADA' | 'REGISTRADA' | 'OMITIDA';

export interface MatchAttendanceRecord {
  status: MatchAttendanceStatus;
  homePresentIds: string[];
  awayPresentIds: string[];
  /** Per-match jersey number overrides for teams with rotating kits (playerId -> 1..99). */
  matchDorsals?: Record<string, number>;
  recordedAt?: string;
  recordedByName?: string;
  notes?: string;
}

export interface Match {
  id: string;
  disciplineId: DisciplineId;
  groupName: string;
  fase: MatchPhase;
  playoffLeg?: MatchPlayoffLeg;
  jornada: number;
  fecha: string;
  hora: string;
  cancha: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  /** Optional penalty shootout score for Fútbol 7 tiebreaks. */
  penaltyScore?: PeriodScore;
  status: MatchStatus;
  periodLabel: string;
  clock: string;
  periods: PeriodScore[];
  fouls: { home: number; away: number };
  timeouts: { home: number; away: number };
  events: MatchEvent[];
  liveState?: MatchLiveState;
  attendance?: MatchAttendanceRecord;
  refereeId: string;
  /** UID of the assigned referee user for scoped visibility in Mesa Arbitral. */
  assignedRefereeUid?: string;
  assignedRefereeName?: string;
  scoresheetValidation?: ScoresheetValidationRecord;
}

export interface RefereeRosterEntry {
  uid: string;
  displayName: string;
  role: 'arbitro' | 'jefe_arbitros_futbol' | 'jefe_arbitros_basquetbol' | 'jefe_arbitros_voleibol';
  updatedAt?: string;
}

export interface RefereeProfile {
  id: string;
  nombre: string;
  rut: string;
  sportType: SportType;
  disciplinaLabel: string;
  licencia: string;
  partidosDirigidos: number;
}

export interface TransferRecord {
  id: string;
  disciplineId: DisciplineId;
  playerId: string;
  playerName: string;
  playerRut?: string;
  fromTeamId: string;
  fromTeamName: string;
  toTeamId: string;
  toTeamName: string;
  fecha: string;
  motivo: string;
  estado: 'APROBADA' | 'PENDIENTE' | 'RECHAZADA';
  createdByUid?: string;
  requestedByTeamId?: string;
  requestedByName?: string;
  fromTeamApproved?: boolean;
  fromTeamApprovedByUid?: string;
  toTeamApproved?: boolean;
  toTeamApprovedByUid?: string;
  approvedAt?: string;
  rejectedByUid?: string;
  rejectedAt?: string;
  updatedAt?: string;
}

export interface StandingsRow {
  teamId: string;
  teamName: string;
  sigla: string;
  carrera: string;
  groupName: string;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  favor: number;
  contra: number;
  diferencia: number;
  setsFavor?: number;
  setsContra?: number;
  puntos: number;
  racha: ('G' | 'E' | 'P')[];
}

export interface PlayoffMatchup {
  id: string;
  round: 'Octavos' | 'Cuartos' | 'Semifinal' | 'Tercer Lugar' | 'Final';
  slot: number;
  homeSeed: string;
  awaySeed: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId?: string;
  awayTeamId?: string;
}

export interface PlayoffBracketSlot extends PlayoffMatchup {
  match?: Match;
  isTwoLegged?: boolean;
  firstLegMatch?: Match;
  secondLegMatch?: Match;
  homeFirstLegScore?: number;
  awayFirstLegScore?: number;
  homeSecondLegScore?: number;
  awaySecondLegScore?: number;
  homeScore?: number;
  awayScore?: number;
  isAggregateDraw?: boolean;
  winnerSide?: 'home' | 'away' | null;
  status: 'PROYECTADO' | MatchStatus;
}

export interface PlayoffRoundColumn {
  round: 'Octavos' | 'Cuartos' | 'Semifinal' | 'Final';
  title: string;
  slots: PlayoffBracketSlot[];
}

export interface FullPlayoffBracket {
  rounds: PlayoffRoundColumn[];
  thirdPlace: PlayoffBracketSlot | null;
  isTwoLegged?: boolean;
  championName?: string;
  thirdPlaceWinnerName?: string;
}

export type UserRole =
  | 'tradicional'
  | 'jugador'
  | 'delegado'
  | 'arbitro'
  | 'jefe_arbitros_futbol'
  | 'jefe_arbitros_basquetbol'
  | 'jefe_arbitros_voleibol'
  | 'fotografo'
  | 'prensa'
  | 'moderador'
  | 'admin';

export interface AppUserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  fechaNacimiento?: string;
  carrera?: string;
  facultad?: string;
  telefono?: string;
  role: UserRole;
  favoriteTeamIds: string[];
  linkedPlayerId?: string;
  delegatedTeamId?: string;
  notificationsEnabled: boolean;
  authSource: 'google' | 'demo';
  createdAt: string;
  updatedAt: string;
}

export interface MvpVoteRecord {
  id: string;
  matchId: string;
  disciplineId: DisciplineId;
  playerId: string;
  playerName: string;
  teamId: string;
  voterUid: string;
  voterName: string;
  createdAt: string;
}

export interface PhotoEntry {
  id: string;
  title: string;
  disciplineId: string;
  stageLabel?: string;
  matchLabel: string;
  season: string;
  source: 'upload' | 'drive';
  imageUrl: string;
  thumbnailUrl?: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveFolderPath?: string;
  photographerUid: string;
  photographerName: string;
  createdAt: string;
}

export interface DriveNode {
  id: string;
  name: string;
  isFolder: boolean;
  webViewLink: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  modifiedDate?: string;
}

export interface UserNotification {
  id: string;
  type: 'RESULTADO' | 'VOTACION_MVP' | 'PROXIMO_ENCUENTRO';
  teamId: string;
  teamName: string;
  matchId: string;
  title: string;
  detail: string;
  createdAt: string;
  isLiveMvp?: boolean;
}

export type MasterSheetKey =
  | 'futbol_hombres'
  | 'futbol_mujeres'
  | 'basquet_hombres'
  | 'basquet_3x3_mujeres'
  | 'voley_mujeres'
  | 'voley_hombres'
  | 'consolidado';

export type MasterSheetsConfig = Partial<Record<MasterSheetKey, string>>;

export type NewsCategory =
  | 'ANUNCIO'
  | 'RESULTADOS'
  | 'DESTACADO'
  | 'CONVOCATORIA'
  | 'PLAYOFFS';

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: NewsCategory;
  disciplineId?: DisciplineId | 'general';
  coverImageUrl?: string;
  featured: boolean;
  published: boolean;
  aiGenerated?: boolean;
  authorUid: string;
  authorName: string;
  authorRole: 'admin' | 'moderador' | 'prensa';
  createdAt: string;
  updatedAt: string;
}

export interface AwardNomineesConfig {
  disciplineId: DisciplineId;
  temporada: string;
  mvpNomineeIds: string[];
  updatedAt?: string;
}

export interface ChampionshipMvpVoteRecord {
  id: string;
  disciplineId: DisciplineId;
  temporada: string;
  voterUid: string;
  playerId: string;
  playerName: string;
  teamId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PositionAwardVoteRecord {
  id: string;
  disciplineId: DisciplineId;
  temporada: string;
  positionKey: string;
  positionLabel: string;
  voterUid: string;
  playerId: string;
  playerName: string;
  teamId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TotyBallotRecord {
  id: string;
  disciplineId: DisciplineId;
  temporada: string;
  voterUid: string;
  selections: Record<string, string>;
  updatedAt: string;
}

export interface DisciplineTotyConfig {
  disciplineId: DisciplineId;
  temporada: string;
  formationName: string;
  positionCounts: Record<string, number>;
  updatedAt?: string;
}

export interface LeyendasStintRecord {
  team: string;
  teamId?: string;
  sigla?: string;
  escudo?: string;
  div: string;
  years: string;
}

export interface LeyendasTrophyRecord {
  id: string;
  title: string;
  year: number;
  team: string;
}

export interface LeyendasAwardRecord {
  id: string;
  title: string;
  year: number;
}

export interface LeyendasLeaderboardEntry {
  id: string;
  uid: string;
  playerName: string;
  career: string;
  sportKey: 'futbol' | 'basquet' | 'voley';
  branch: 'hombre' | 'mujer';
  pos: string;
  ovr: number;
  maxOvr: number;
  score: number;
  legacyTitle: string;
  legacyDesc: string;
  titlesCount: number;
  awardsCount: number;
  capsCount: number;
  semestersPlayed: number;
  stats: {
    g: number;
    a: number;
    m: number;
    pts: number;
    reb: number;
    ast: number;
    blk: number;
    ace: number;
  };
  finalTeam: string;
  finalTeamId?: string;
  finalTeamEscudo?: string;
  stints: LeyendasStintRecord[];
  trophies: LeyendasTrophyRecord[];
  awards: LeyendasAwardRecord[];
  weekKey: string;
  createdAt: string;
}

export type HomeFeaturedMode = 'auto' | 'match' | 'custom';

export type HomeFeaturedCtaSection =
  | 'posiciones'
  | 'equipos'
  | 'jugadores'
  | 'votaciones'
  | 'galeria'
  | 'noticias'
  | 'inscripciones';

export interface HomeFeaturedConfig {
  mode: HomeFeaturedMode;
  matchId?: string;
  badgeLabel?: string;
  customTitle?: string;
  customSubtitle?: string;
  customDescription?: string;
  ctaLabel?: string;
  ctaSection?: HomeFeaturedCtaSection;
  updatedAt?: string;
}

export interface TournamentState {
  temporada: string;
  homeFeatured?: HomeFeaturedConfig;
  configs: Record<DisciplineId, DisciplineFormatConfig>;
  teams: Team[];
  players: Player[];
  matches: Match[];
  transfers: TransferRecord[];
  referees: RefereeProfile[];
  refereeRoster?: RefereeRosterEntry[];
  users: AppUserProfile[];
  mvpVotes: MvpVoteRecord[];
  awardNominees: Partial<Record<DisciplineId, string[]>>;
  championshipMvpVotes: ChampionshipMvpVoteRecord[];
  positionAwardVotes: PositionAwardVoteRecord[];
  totyBallots: TotyBallotRecord[];
  totyConfigs: Partial<Record<DisciplineId, DisciplineTotyConfig>>;
  photos: PhotoEntry[];
  news: NewsArticle[];
  leyendasLeaderboard: LeyendasLeaderboardEntry[];
  driveUploadRootFolderId?: string;
  driveUploadRootFolderName?: string;
  masterSheets: MasterSheetsConfig;
  autoSyncSheetsEnabled?: boolean;
  lastSyncedSpreadsheetId?: string;
  lastSyncedAt?: string;
}
