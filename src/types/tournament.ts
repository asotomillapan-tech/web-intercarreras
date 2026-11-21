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

export type MatchPhase = 'Grupos' | 'Octavos' | 'Cuartos' | 'Semifinal' | 'Final';

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
  type:
    | 'GOL'
    | 'AMARILLA'
    | 'ROJA'
    | 'PUNTO_1'
    | 'PUNTO_2'
    | 'PUNTO_3'
    | 'FALTA'
    | 'TIEMPO_MUERTO'
    | 'PUNTO_VOLEY'
    | 'ACE'
    | 'BLOQUEO'
    | 'SET_GANADO';
  detail: string;
}

export interface PeriodScore {
  home: number;
  away: number;
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

export interface Match {
  id: string;
  disciplineId: DisciplineId;
  groupName: string;
  fase: MatchPhase;
  jornada: number;
  fecha: string;
  hora: string;
  cancha: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  status: MatchStatus;
  periodLabel: string;
  clock: string;
  periods: PeriodScore[];
  fouls: { home: number; away: number };
  timeouts: { home: number; away: number };
  events: MatchEvent[];
  refereeId: string;
  scoresheetValidation?: ScoresheetValidationRecord;
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
  round: 'Octavos' | 'Cuartos' | 'Semifinal' | 'Final';
  slot: number;
  homeSeed: string;
  awaySeed: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId?: string;
  awayTeamId?: string;
}

export type UserRole =
  | 'tradicional'
  | 'jugador'
  | 'delegado'
  | 'arbitro'
  | 'fotografo'
  | 'admin';

export interface AppUserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
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

export interface TournamentState {
  temporada: string;
  configs: Record<DisciplineId, DisciplineFormatConfig>;
  teams: Team[];
  players: Player[];
  matches: Match[];
  transfers: TransferRecord[];
  referees: RefereeProfile[];
  users: AppUserProfile[];
  mvpVotes: MvpVoteRecord[];
  photos: PhotoEntry[];
  driveUploadRootFolderId?: string;
  driveUploadRootFolderName?: string;
  masterSheets: MasterSheetsConfig;
  autoSyncSheetsEnabled?: boolean;
  lastSyncedSpreadsheetId?: string;
  lastSyncedAt?: string;
}
