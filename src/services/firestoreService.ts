import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { DEFAULT_MASTER_SHEETS, INITIAL_CONFIGS } from '../data/ufroSeed';
import {
  buildSanitizedDisciplineConfigPayload,
  buildSanitizedMatchPayload,
  buildSanitizedPlayerPayload,
  buildSanitizedTeamPayload,
  clampSafeInt,
  sanitizeMatchAttendanceRecord,
  sanitizeMatchLiveStateRecord,
  sanitizePenaltyScoreRecord,
  sanitizePlayerStatsRecord,
  stripUndefinedDeep,
} from '../domain/firestoreSanitizer';
import { BOOTSTRAPPED_ADMIN_EMAIL, isRefereeOrChiefRole } from '../domain/rbacEngine';
import type { PublicRealtimeStreamKey } from '../domain/realtimeSyncEngine';
import {
  FIRESTORE_TOTY_BATCH_CHUNK_SIZE,
  sanitizeTotySelections,
  type TotyBallotBatchItem,
} from '../domain/totyBatchQueue';
import {
  classifyFirestoreError,
  shouldEmitThrottledQuotaLog,
} from '../domain/syncHealthEngine';
import type {
  AcademicLevel,
  AppUserProfile,
  ChampionshipMvpVoteRecord,
  DisciplineFormatConfig,
  DisciplineId,
  DisciplineTotyConfig,
  HomeFeaturedConfig,
  HomeFeaturedCtaSection,
  LeyendasLeaderboardEntry,
  MasterSheetKey,
  MasterSheetsConfig,
  Match,
  MvpVoteRecord,
  NewsArticle,
  NewsCategory,
  PhotoEntry,
  Player,
  PlayerStats,
  PositionAwardVoteRecord,
  RefereeRosterEntry,
  Team,
  TotyBallotRecord,
  TournamentState,
  TransferRecord,
  UserRole,
} from '../types/tournament';
import { auth, db, handleFirestoreError, OperationType } from './firebaseAuth';

const ALL_DISCIPLINE_IDS: DisciplineId[] = [
  'f7-h-1',
  'f7-h-2',
  'f7-h-3',
  'f7-m',
  'basquet-h',
  'basquet-3x3-m',
  'voley-m',
  'voley-h',
];

function toIso(val: unknown): string {
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as Timestamp).toDate === 'function') {
    return (val as Timestamp).toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function sanitizeStats(raw: Partial<PlayerStats> | undefined): PlayerStats {
  return sanitizePlayerStatsRecord(raw);
}

const ALLOWED_FEATURED_CTA_SECTIONS: HomeFeaturedCtaSection[] = [
  'posiciones',
  'equipos',
  'jugadores',
  'votaciones',
  'galeria',
  'noticias',
  'inscripciones',
];

function sanitizeHomeFeatured(raw: unknown): HomeFeaturedConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const mode = obj.mode === 'match' || obj.mode === 'custom' || obj.mode === 'auto' ? obj.mode : 'auto';
  const result: HomeFeaturedConfig = { mode };

  if (typeof obj.matchId === 'string' && obj.matchId.trim()) {
    result.matchId = obj.matchId.trim().slice(0, 128);
  }
  if (typeof obj.badgeLabel === 'string' && obj.badgeLabel.trim()) {
    result.badgeLabel = obj.badgeLabel.trim().slice(0, 80);
  }
  if (typeof obj.customTitle === 'string' && obj.customTitle.trim()) {
    result.customTitle = obj.customTitle.trim().slice(0, 140);
  }
  if (typeof obj.customSubtitle === 'string' && obj.customSubtitle.trim()) {
    result.customSubtitle = obj.customSubtitle.trim().slice(0, 160);
  }
  if (typeof obj.customDescription === 'string' && obj.customDescription.trim()) {
    result.customDescription = obj.customDescription.trim().slice(0, 400);
  }
  if (typeof obj.ctaLabel === 'string' && obj.ctaLabel.trim()) {
    result.ctaLabel = obj.ctaLabel.trim().slice(0, 60);
  }
  if (
    typeof obj.ctaSection === 'string' &&
    ALLOWED_FEATURED_CTA_SECTIONS.includes(obj.ctaSection as HomeFeaturedCtaSection)
  ) {
    result.ctaSection = obj.ctaSection as HomeFeaturedCtaSection;
  }
  if (typeof obj.updatedAt === 'string' && obj.updatedAt.trim()) {
    result.updatedAt = obj.updatedAt.trim().slice(0, 64);
  }

  return result;
}

// ---------------------------------------------------------------------------
// 1. Public Tournament Mappers, Hydration & Real-Time Subscriptions
// ---------------------------------------------------------------------------

let lastQuotaSnapshotLogAtMs: number | null = null;

function logFirestoreSnapshotError(error: unknown, operationType: OperationType, path: string): void {
  const kind = classifyFirestoreError(error);
  const nowMs = Date.now();
  if (kind === 'quota_exceeded') {
    if (!shouldEmitThrottledQuotaLog(lastQuotaSnapshotLogAtMs, nowMs)) {
      return;
    }
    lastQuotaSnapshotLogAtMs = nowMs;
  }

  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

function mapSettingsData(s: Record<string, unknown>): Partial<TournamentState> {
  const out: Partial<TournamentState> = {};
  if (typeof s.temporada === 'string') out.temporada = s.temporada;
  if (typeof s.driveUploadRootFolderId === 'string') {
    out.driveUploadRootFolderId = s.driveUploadRootFolderId;
  }
  if (typeof s.driveUploadRootFolderName === 'string') {
    out.driveUploadRootFolderName = s.driveUploadRootFolderName;
  }
  if (s.masterSheets && typeof s.masterSheets === 'object') {
    const merged: MasterSheetsConfig = { ...DEFAULT_MASTER_SHEETS };
    const allowedKeys: MasterSheetKey[] = [
      'futbol_hombres',
      'futbol_mujeres',
      'basquet_hombres',
      'basquet_3x3_mujeres',
      'voley_mujeres',
      'voley_hombres',
      'consolidado',
    ];
    for (const key of allowedKeys) {
      const val = (s.masterSheets as Record<string, unknown>)[key];
      if (typeof val === 'string') {
        if (val.trim()) {
          merged[key] = val.trim().slice(0, 128);
        } else if (key !== 'futbol_hombres') {
          delete merged[key];
        }
      }
    }
    out.masterSheets = merged;
  }
  if (typeof s.autoSyncSheetsEnabled === 'boolean') {
    out.autoSyncSheetsEnabled = s.autoSyncSheetsEnabled;
  }
  if (typeof s.lastSyncedSpreadsheetId === 'string') {
    out.lastSyncedSpreadsheetId = s.lastSyncedSpreadsheetId;
  }
  if (typeof s.lastSyncedAt === 'string') {
    out.lastSyncedAt = s.lastSyncedAt;
  }
  const parsedFeatured = sanitizeHomeFeatured(s.homeFeatured);
  if (parsedFeatured) {
    out.homeFeatured = parsedFeatured;
  }
  return out;
}

function mapConfigsDocs(
  docs: QueryDocumentSnapshot[]
): Record<DisciplineId, DisciplineFormatConfig> {
  const mergedConfigs: Record<DisciplineId, DisciplineFormatConfig> = { ...INITIAL_CONFIGS };
  docs.forEach((d) => {
    const data = d.data();
    const id = data.disciplineId as DisciplineId;
    if (id in mergedConfigs) {
      mergedConfigs[id] = {
        disciplineId: id,
        temporada: String(data.temporada || '2026'),
        maxCupos: Number(data.maxCupos) || mergedConfigs[id].maxCupos,
        numGrupos: Number(data.numGrupos) || mergedConfigs[id].numGrupos,
        clasificadosPorGrupo:
          Number(data.clasificadosPorGrupo) || mergedConfigs[id].clasificadosPorGrupo,
        formatoPlayoff: ([4, 8, 16].includes(Number(data.formatoPlayoff))
          ? Number(data.formatoPlayoff)
          : mergedConfigs[id].formatoPlayoff) as 4 | 8 | 16,
        incluyeTercerLugar:
          typeof data.incluyeTercerLugar === 'boolean' ? data.incluyeTercerLugar : true,
        playoffsIdaYVuelta:
          typeof data.playoffsIdaYVuelta === 'boolean'
            ? data.playoffsIdaYVuelta
            : id === 'f7-h-1',
        inscripcionesAbiertas: Boolean(data.inscripcionesAbiertas),
        transferenciasAbiertas: Boolean(data.transferenciasAbiertas),
        maxTransferenciasPorEquipo: clampSafeInt(data.maxTransferenciasPorEquipo, 0, 10, 2),
        faseActual: (data.faseActual as DisciplineFormatConfig['faseActual']) || 'INSCRIPCIONES',
      };
    }
  });
  return mergedConfigs;
}

function mapTeamDoc(d: QueryDocumentSnapshot): Team {
  const data = d.data();
  return {
    id: String(data.id || d.id),
    nombre: String(data.nombre || ''),
    sigla: String(data.sigla || ''),
    disciplineId: data.disciplineId as DisciplineId,
    carrera: String(data.carrera || ''),
    facultad: String(data.facultad || ''),
    groupName: String(data.groupName || 'Grupo A'),
    escudo: typeof data.escudo === 'string' && data.escudo ? data.escudo : undefined,
    clubName:
      typeof data.clubName === 'string' && data.clubName.trim() ? data.clubName.trim() : undefined,
    anioFundacion:
      typeof data.anioFundacion === 'number' && Number.isFinite(data.anioFundacion)
        ? Math.trunc(data.anioFundacion)
        : undefined,
    logrosAnteriores: typeof data.logrosAnteriores === 'string' ? data.logrosAnteriores : undefined,
    createdByUid: typeof data.createdByUid === 'string' ? data.createdByUid : undefined,
  };
}

function mapPlayerPublicDoc(d: QueryDocumentSnapshot): Player {
  const data = d.data();
  return {
    id: String(data.id || d.id),
    teamId: String(data.teamId || ''),
    disciplineId: data.disciplineId as DisciplineId,
    dorsal: Number(data.dorsal) || 0,
    posicion: String(data.posicion || ''),
    nombre: String(data.nombre || ''),
    apellidoPaterno: String(data.apellidoPaterno || ''),
    apellidoMaterno: String(data.apellidoMaterno || ''),
    carrera: String(data.carrera || ''),
    facultad: String(data.facultad || ''),
    // PII fields stay empty for public visitors and are hydrated only for authorized roles
    rut: '',
    numeroMatricula: '',
    correoInstitucional: '',
    fechaNacimiento: '',
    nivelAcademico: (data.nivelAcademico as AcademicLevel) || 'Pregrado',
    fotografia: typeof data.fotografia === 'string' ? data.fotografia : '',
    esSeleccionadoUfro: Boolean(data.esSeleccionadoUfro),
    stats: sanitizeStats(data.stats as Partial<PlayerStats> | undefined),
  };
}

function mapMatchDoc(d: QueryDocumentSnapshot): Match {
  const data = d.data();
  return {
    id: String(data.id || d.id),
    disciplineId: data.disciplineId as DisciplineId,
    groupName: String(data.groupName || 'Grupo A'),
    fase: (data.fase as Match['fase']) || 'Grupos',
    playoffLeg:
      data.playoffLeg === 'IDA' || data.playoffLeg === 'VUELTA' || data.playoffLeg === 'UNICO'
        ? (data.playoffLeg as Match['playoffLeg'])
        : undefined,
    jornada: Number(data.jornada) || 1,
    fecha: String(data.fecha || ''),
    hora: String(data.hora || ''),
    cancha: String(data.cancha || ''),
    homeTeamId: String(data.homeTeamId || ''),
    awayTeamId: String(data.awayTeamId || ''),
    homeScore: Number(data.homeScore) || 0,
    awayScore: Number(data.awayScore) || 0,
    penaltyScore: sanitizePenaltyScoreRecord(data.penaltyScore),
    status: (data.status as Match['status']) || 'PROGRAMADO',
    periodLabel: String(data.periodLabel || 'Programado'),
    clock: String(data.clock || 'Por iniciar'),
    periods: Array.isArray(data.periods) ? data.periods : [],
    fouls:
      data.fouls && typeof data.fouls === 'object'
        ? { home: Number(data.fouls.home) || 0, away: Number(data.fouls.away) || 0 }
        : { home: 0, away: 0 },
    timeouts:
      data.timeouts && typeof data.timeouts === 'object'
        ? { home: Number(data.timeouts.home) || 0, away: Number(data.timeouts.away) || 0 }
        : { home: 0, away: 0 },
    events: Array.isArray(data.events) ? data.events : [],
    liveState: sanitizeMatchLiveState(data.liveState),
    attendance: sanitizeMatchAttendance(data.attendance),
    refereeId: String(data.refereeId || ''),
    assignedRefereeUid:
      typeof data.assignedRefereeUid === 'string' && data.assignedRefereeUid.trim()
        ? data.assignedRefereeUid.trim()
        : undefined,
    assignedRefereeName:
      typeof data.assignedRefereeName === 'string' && data.assignedRefereeName.trim()
        ? data.assignedRefereeName.trim()
        : undefined,
    scoresheetValidation:
      data.scoresheetValidation && typeof data.scoresheetValidation === 'object'
        ? data.scoresheetValidation
        : undefined,
  };
}

function mapMvpVoteDoc(d: QueryDocumentSnapshot): MvpVoteRecord {
  const data = d.data();
  return {
    id: d.id,
    matchId: String(data.matchId || ''),
    disciplineId: data.disciplineId as DisciplineId,
    playerId: String(data.playerId || ''),
    playerName: String(data.playerName || ''),
    teamId: String(data.teamId || ''),
    voterUid: String(data.voterUid || ''),
    voterName: 'Usuario UFRO',
    createdAt: toIso(data.createdAt),
  };
}

function mapPhotoDoc(d: QueryDocumentSnapshot): PhotoEntry {
  const data = d.data();
  return {
    id: String(data.id || d.id),
    title: String(data.title || ''),
    disciplineId: String(data.disciplineId || 'f7-h-1'),
    stageLabel: typeof data.stageLabel === 'string' ? data.stageLabel : undefined,
    matchLabel: String(data.matchLabel || ''),
    season: String(data.season || '2026'),
    source: (data.source as 'upload' | 'drive') || 'drive',
    imageUrl: String(data.imageUrl || ''),
    thumbnailUrl: typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : undefined,
    driveFileId: typeof data.driveFileId === 'string' ? data.driveFileId : undefined,
    driveWebViewLink: typeof data.driveWebViewLink === 'string' ? data.driveWebViewLink : undefined,
    driveFolderPath: typeof data.driveFolderPath === 'string' ? data.driveFolderPath : undefined,
    photographerUid: String(data.photographerUid || ''),
    photographerName: String(data.photographerName || 'Prensa UFRO'),
    createdAt: toIso(data.createdAt),
  };
}

function mapAwardNomineesDocs(docs: QueryDocumentSnapshot[]): Partial<Record<DisciplineId, string[]>> {
  const map: Partial<Record<DisciplineId, string[]>> = {};
  docs.forEach((d) => {
    const data = d.data();
    const discId = (data.disciplineId || d.id) as DisciplineId;
    if (ALL_DISCIPLINE_IDS.includes(discId) && Array.isArray(data.mvpNomineeIds)) {
      map[discId] = data.mvpNomineeIds
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .slice(0, 5);
    }
  });
  return map;
}

function mapChampionshipMvpVoteDoc(d: QueryDocumentSnapshot): ChampionshipMvpVoteRecord {
  const data = d.data();
  return {
    id: d.id,
    disciplineId: data.disciplineId as DisciplineId,
    temporada: String(data.temporada || '2026'),
    voterUid: String(data.voterUid || ''),
    playerId: String(data.playerId || ''),
    playerName: String(data.playerName || ''),
    teamId: String(data.teamId || ''),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

function mapPositionAwardVoteDoc(d: QueryDocumentSnapshot): PositionAwardVoteRecord {
  const data = d.data();
  return {
    id: d.id,
    disciplineId: data.disciplineId as DisciplineId,
    temporada: String(data.temporada || '2026'),
    positionKey: String(data.positionKey || ''),
    positionLabel: String(data.positionLabel || ''),
    voterUid: String(data.voterUid || ''),
    playerId: String(data.playerId || ''),
    playerName: String(data.playerName || ''),
    teamId: String(data.teamId || ''),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

function mapLeyendasDoc(d: QueryDocumentSnapshot): LeyendasLeaderboardEntry {
  const data = d.data();
  const rawStats = (data.stats && typeof data.stats === 'object' ? data.stats : {}) as Record<
    string,
    unknown
  >;
  return {
    id: String(data.id || d.id),
    uid: String(data.uid || ''),
    playerName: String(data.playerName || 'Leyenda UFRO'),
    career: String(data.career || 'Carrera UFRO'),
    sportKey: (data.sportKey === 'basquet' || data.sportKey === 'voley'
      ? data.sportKey
      : 'futbol') as LeyendasLeaderboardEntry['sportKey'],
    branch: (data.branch === 'mujer' ? 'mujer' : 'hombre') as LeyendasLeaderboardEntry['branch'],
    pos: String(data.pos || 'DEL'),
    ovr: Number(data.ovr) || 70,
    maxOvr: Number(data.maxOvr) || Number(data.ovr) || 70,
    score: Number(data.score) || 0,
    legacyTitle: String(data.legacyTitle || 'Guerrero Universitario UFRO'),
    legacyDesc: String(data.legacyDesc || ''),
    titlesCount: Number(data.titlesCount) || 0,
    awardsCount: Number(data.awardsCount) || 0,
    capsCount: Number(data.capsCount) || 0,
    semestersPlayed: Number(data.semestersPlayed) || 1,
    stats: {
      g: Number(rawStats.g) || 0,
      a: Number(rawStats.a) || 0,
      m: Number(rawStats.m) || 0,
      pts: Number(rawStats.pts) || 0,
      reb: Number(rawStats.reb) || 0,
      ast: Number(rawStats.ast) || 0,
      blk: Number(rawStats.blk) || 0,
      ace: Number(rawStats.ace) || 0,
    },
    finalTeam: String(data.finalTeam || ''),
    finalTeamId: typeof data.finalTeamId === 'string' ? data.finalTeamId : undefined,
    finalTeamEscudo: typeof data.finalTeamEscudo === 'string' ? data.finalTeamEscudo : undefined,
    stints: Array.isArray(data.stints) ? data.stints : [],
    trophies: Array.isArray(data.trophies) ? data.trophies : [],
    awards: Array.isArray(data.awards) ? data.awards : [],
    weekKey: String(data.weekKey || ''),
    createdAt: toIso(data.createdAt),
  };
}

export interface PublicRealtimeCallbacks {
  onSettings: (patch: Partial<TournamentState>, fromServer: boolean) => void;
  onConfigs: (configs: Record<DisciplineId, DisciplineFormatConfig>, fromServer: boolean) => void;
  onTeams: (teams: Team[], fromServer: boolean) => void;
  onPlayers: (players: Player[], fromServer: boolean) => void;
  onMatches: (matches: Match[], fromServer: boolean) => void;
  onNews: (publishedNews: NewsArticle[], fromServer: boolean) => void;
  onTransfers: (approvedTransfers: TransferRecord[], fromServer: boolean) => void;
  onPhotos: (photos: PhotoEntry[], fromServer: boolean) => void;
  onMvpVotes: (votes: MvpVoteRecord[], fromServer: boolean) => void;
  onAwardNominees: (nominees: Partial<Record<DisciplineId, string[]>>, fromServer: boolean) => void;
  onChampionshipMvpVotes: (votes: ChampionshipMvpVoteRecord[], fromServer: boolean) => void;
  onPositionAwardVotes: (votes: PositionAwardVoteRecord[], fromServer: boolean) => void;
  onLeyendasLeaderboard: (entries: LeyendasLeaderboardEntry[], fromServer: boolean) => void;
  onStreamError: (stream: PublicRealtimeStreamKey, error: unknown) => void;
}

/**
 * Subscribes to live Firestore snapshots for all public championship collections.
 * Protects brand-new devices from IndexedDB cold-start empty flashes by ignoring
 * empty cache-only snapshots until either non-empty cached data or the authoritative
 * server snapshot arrives.
 */
export function subscribeToPublicTournamentState(
  callbacks: PublicRealtimeCallbacks
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];
  const snapshotOpts = { includeMetadataChanges: true } as const;

  // 1. Settings (temporada, homeFeatured, masterSheets, Drive root)
  unsubs.push(
    onSnapshot(
      doc(db, 'settings', 'tournament'),
      snapshotOpts,
      (snap) => {
        const fromServer = !snap.metadata.fromCache;
        if (!fromServer && !snap.exists()) return;
        const patch = snap.exists() ? mapSettingsData(snap.data() as Record<string, unknown>) : {};
        callbacks.onSettings(patch, fromServer);
      },
      (error) => {
        logFirestoreSnapshotError(error, OperationType.GET, 'settings/tournament');
        callbacks.onStreamError('settings', error);
      }
    )
  );

  // 2. Discipline configs
  unsubs.push(
    onSnapshot(
      query(collection(db, 'configs'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS)),
      snapshotOpts,
      (snap) => {
        const fromServer = !snap.metadata.fromCache;
        if (!fromServer && snap.empty) return;
        callbacks.onConfigs(mapConfigsDocs(snap.docs), fromServer);
      },
      (error) => {
        logFirestoreSnapshotError(error, OperationType.LIST, 'configs');
        callbacks.onStreamError('configs', error);
      }
    )
  );

  // 3. Teams
  unsubs.push(
    onSnapshot(
      query(collection(db, 'teams'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS)),
      snapshotOpts,
      (snap) => {
        const fromServer = !snap.metadata.fromCache;
        if (!fromServer && snap.empty) return;
        callbacks.onTeams(snap.docs.map((d) => mapTeamDoc(d)), fromServer);
      },
      (error) => {
        logFirestoreSnapshotError(error, OperationType.LIST, 'teams');
        callbacks.onStreamError('teams', error);
      }
    )
  );

  // 4. Players (public profiles)
  unsubs.push(
    onSnapshot(
      query(collection(db, 'players'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS)),
      snapshotOpts,
      (snap) => {
        const fromServer = !snap.metadata.fromCache;
        if (!fromServer && snap.empty) return;
        callbacks.onPlayers(snap.docs.map((d) => mapPlayerPublicDoc(d)), fromServer);
      },
      (error) => {
        logFirestoreSnapshotError(error, OperationType.LIST, 'players');
        callbacks.onStreamError('players', error);
      }
    )
  );

  // 5. Matches (schedule, live scores, substitutions, attendance, finalizations)
  unsubs.push(
    onSnapshot(
      query(collection(db, 'matches'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS)),
      snapshotOpts,
      (snap) => {
        const fromServer = !snap.metadata.fromCache;
        if (!fromServer && snap.empty) return;
        callbacks.onMatches(snap.docs.map((d) => mapMatchDoc(d)), fromServer);
      },
      (error) => {
        logFirestoreSnapshotError(error, OperationType.LIST, 'matches');
        callbacks.onStreamError('matches', error);
      }
    )
  );

  // 6. Published News
  unsubs.push(
    onSnapshot(
      query(collection(db, 'news'), where('published', '==', true)),
      snapshotOpts,
      (snap) => {
        const fromServer = !snap.metadata.fromCache;
        if (!fromServer && snap.empty) return;
        const news = snap.docs
          .map((d) => mapNewsDoc(d.id, d.data()))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        callbacks.onNews(news, fromServer);
      },
      (error) => {
        logFirestoreSnapshotError(error, OperationType.LIST, 'news');
        callbacks.onStreamError('news', error);
      }
    )
  );

  // 7. Approved Transfers
  unsubs.push(
    onSnapshot(
      query(collection(db, 'transfers'), where('estado', '==', 'APROBADA')),
      snapshotOpts,
      (snap) => {
        const fromServer = !snap.metadata.fromCache;
        if (!fromServer && snap.empty) return;
        callbacks.onTransfers(snap.docs.map((d) => mapTransferDoc(d)), fromServer);
      },
      (error) => {
        logFirestoreSnapshotError(error, OperationType.LIST, 'transfers');
        callbacks.onStreamError('transfers', error);
      }
    )
  );

  // 8. Official Gallery Photos
  unsubs.push(
    onSnapshot(
      query(collection(db, 'photos'), where('source', 'in', ['upload', 'drive'])),
      snapshotOpts,
      (snap) => {
        const fromServer = !snap.metadata.fromCache;
        if (!fromServer && snap.empty) return;
        const photos = snap.docs
          .map((d) => mapPhotoDoc(d))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        callbacks.onPhotos(photos, fromServer);
      },
      (error) => {
        logFirestoreSnapshotError(error, OperationType.LIST, 'photos');
        callbacks.onStreamError('photos', error);
      }
    )
  );

  // 9. Live POTM Votes
  unsubs.push(
    onSnapshot(
      query(collection(db, 'mvp_votes'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS)),
      snapshotOpts,
      (snap) => {
        const fromServer = !snap.metadata.fromCache;
        if (!fromServer && snap.empty) return;
        callbacks.onMvpVotes(snap.docs.map((d) => mapMvpVoteDoc(d)), fromServer);
      },
      (error) => {
        logFirestoreSnapshotError(error, OperationType.LIST, 'mvp_votes');
        callbacks.onStreamError('mvpVotes', error);
      }
    )
  );

  // 10. Award Nominees
  unsubs.push(
    onSnapshot(
      query(collection(db, 'award_nominees'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS)),
      snapshotOpts,
      (snap) => {
        const fromServer = !snap.metadata.fromCache;
        if (!fromServer && snap.empty) return;
        callbacks.onAwardNominees(mapAwardNomineesDocs(snap.docs), fromServer);
      },
      (error) => {
        logFirestoreSnapshotError(error, OperationType.LIST, 'award_nominees');
        callbacks.onStreamError('awardNominees', error);
      }
    )
  );

  // 11. Championship MVP Votes
  unsubs.push(
    onSnapshot(
      query(
        collection(db, 'championship_mvp_votes'),
        where('disciplineId', 'in', ALL_DISCIPLINE_IDS)
      ),
      snapshotOpts,
      (snap) => {
        const fromServer = !snap.metadata.fromCache;
        if (!fromServer && snap.empty) return;
        callbacks.onChampionshipMvpVotes(
          snap.docs.map((d) => mapChampionshipMvpVoteDoc(d)),
          fromServer
        );
      },
      (error) => {
        logFirestoreSnapshotError(error, OperationType.LIST, 'championship_mvp_votes');
        callbacks.onStreamError('championshipMvpVotes', error);
      }
    )
  );

  // 12. Position Award Votes
  unsubs.push(
    onSnapshot(
      query(
        collection(db, 'position_award_votes'),
        where('disciplineId', 'in', ALL_DISCIPLINE_IDS)
      ),
      snapshotOpts,
      (snap) => {
        const fromServer = !snap.metadata.fromCache;
        if (!fromServer && snap.empty) return;
        callbacks.onPositionAwardVotes(
          snap.docs.map((d) => mapPositionAwardVoteDoc(d)),
          fromServer
        );
      },
      (error) => {
        logFirestoreSnapshotError(error, OperationType.LIST, 'position_award_votes');
        callbacks.onStreamError('positionAwardVotes', error);
      }
    )
  );

  // 13. Leyendas Leaderboard
  unsubs.push(
    onSnapshot(
      query(
        collection(db, 'leyendas_leaderboard'),
        where('sportKey', 'in', ['futbol', 'basquet', 'voley'])
      ),
      snapshotOpts,
      (snap) => {
        const fromServer = !snap.metadata.fromCache;
        if (!fromServer && snap.empty) return;
        const entries = snap.docs
          .map((d) => mapLeyendasDoc(d))
          .sort((a, b) => b.score - a.score);
        callbacks.onLeyendasLeaderboard(entries, fromServer);
      },
      (error) => {
        logFirestoreSnapshotError(error, OperationType.LIST, 'leyendas_leaderboard');
        callbacks.onStreamError('leyendasLeaderboard', error);
      }
    )
  );

  return () => {
    unsubs.forEach((u) => u());
  };
}

export async function loadPublicTournamentState(): Promise<Partial<TournamentState>> {
  const [
    settingsRes,
    configsRes,
    teamsRes,
    playersRes,
    matchesRes,
    transfersRes,
    votesRes,
    photosRes,
    newsRes,
    nomineesRes,
    champMvpRes,
    posAwardsRes,
    totyRes,
    totyConfigsRes,
    leyendasRes,
  ] = await Promise.allSettled([
    getDoc(doc(db, 'settings', 'tournament')),
    getDocs(query(collection(db, 'configs'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS))),
    getDocs(query(collection(db, 'teams'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS))),
    getDocs(query(collection(db, 'players'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS))),
    getDocs(query(collection(db, 'matches'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS))),
    getDocs(query(collection(db, 'transfers'), where('estado', '==', 'APROBADA'))),
    getDocs(query(collection(db, 'mvp_votes'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS))),
    getDocs(query(collection(db, 'photos'), where('source', 'in', ['upload', 'drive']))),
    getDocs(query(collection(db, 'news'), where('published', '==', true))),
    getDocs(query(collection(db, 'award_nominees'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS))),
    getDocs(query(collection(db, 'championship_mvp_votes'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS))),
    getDocs(query(collection(db, 'position_award_votes'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS))),
    getDocs(query(collection(db, 'toty_ballots'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS))),
    getDocs(query(collection(db, 'toty_configs'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS))),
    getDocs(query(collection(db, 'leyendas_leaderboard'), where('sportKey', 'in', ['futbol', 'basquet', 'voley']))),
  ]);

  const result: Partial<TournamentState> = {};

  if (settingsRes.status === 'fulfilled' && settingsRes.value.exists()) {
    Object.assign(result, mapSettingsData(settingsRes.value.data() as Record<string, unknown>));
  }

  if (configsRes.status === 'fulfilled' && !configsRes.value.empty) {
    result.configs = mapConfigsDocs(configsRes.value.docs);
  }

  if (teamsRes.status === 'fulfilled') {
    result.teams = teamsRes.value.docs.map((d) => mapTeamDoc(d));
  }

  if (playersRes.status === 'fulfilled') {
    result.players = playersRes.value.docs.map((d) => mapPlayerPublicDoc(d));
  }

  if (matchesRes.status === 'fulfilled') {
    result.matches = matchesRes.value.docs.map((d) => mapMatchDoc(d));
  }

  if (transfersRes.status === 'fulfilled') {
    result.transfers = transfersRes.value.docs.map((d) => mapTransferDoc(d));
  }

  if (votesRes.status === 'fulfilled') {
    result.mvpVotes = votesRes.value.docs.map((d) => mapMvpVoteDoc(d));
  }

  if (photosRes.status === 'fulfilled') {
    result.photos = photosRes.value.docs
      .map((d) => mapPhotoDoc(d))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  if (newsRes.status === 'fulfilled') {
    result.news = newsRes.value.docs
      .map((d) => mapNewsDoc(d.id, d.data()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  if (nomineesRes.status === 'fulfilled') {
    result.awardNominees = mapAwardNomineesDocs(nomineesRes.value.docs);
  }

  if (champMvpRes.status === 'fulfilled') {
    result.championshipMvpVotes = champMvpRes.value.docs.map((d) => mapChampionshipMvpVoteDoc(d));
  }

  if (posAwardsRes.status === 'fulfilled') {
    result.positionAwardVotes = posAwardsRes.value.docs.map((d) => mapPositionAwardVoteDoc(d));
  }

  if (totyRes.status === 'fulfilled') {
    result.totyBallots = totyRes.value.docs.map((d) => mapTotyBallotDoc(d.id, d.data()));
  }

  if (totyConfigsRes.status === 'fulfilled') {
    const configMap: Partial<Record<DisciplineId, DisciplineTotyConfig>> = {};
    totyConfigsRes.value.docs.forEach((d) => {
      const mapped = mapTotyConfigDoc(d.id, d.data());
      if (mapped) {
        configMap[mapped.disciplineId] = mapped;
      }
    });
    result.totyConfigs = configMap;
  }

  if (leyendasRes.status === 'fulfilled') {
    result.leyendasLeaderboard = leyendasRes.value.docs
      .map((d) => mapLeyendasDoc(d))
      .sort((a, b) => b.score - a.score);
  } else {
    console.error('Error leyendo ranking semanal leyendas_leaderboard:', leyendasRes.reason);
  }

  return result;
}

function mapNewsDoc(docId: string, data: Record<string, unknown>): NewsArticle {
  const validCategories: NewsCategory[] = [
    'ANUNCIO',
    'RESULTADOS',
    'DESTACADO',
    'CONVOCATORIA',
    'PLAYOFFS',
  ];
  const rawCategory = String(data.category || 'ANUNCIO') as NewsCategory;
  const category: NewsCategory = validCategories.includes(rawCategory) ? rawCategory : 'ANUNCIO';
  return {
    id: String(data.id || docId),
    title: String(data.title || ''),
    summary: String(data.summary || ''),
    content: String(data.content || ''),
    category,
    disciplineId:
      typeof data.disciplineId === 'string' && data.disciplineId
        ? (data.disciplineId as DisciplineId | 'general')
        : 'general',
    coverImageUrl: typeof data.coverImageUrl === 'string' ? data.coverImageUrl : undefined,
    featured: Boolean(data.featured),
    published: Boolean(data.published),
    aiGenerated: Boolean(data.aiGenerated),
    authorUid: String(data.authorUid || ''),
    authorName: String(data.authorName || 'Prensa Oficial UFRO'),
    authorRole:
      data.authorRole === 'prensa'
        ? 'prensa'
        : data.authorRole === 'moderador'
        ? 'moderador'
        : 'admin',
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

/**
 * Hydrates isolated student PII (/player_private) strictly according to the caller's role.
 */
export async function loadAuthorizedPlayerPrivateMap(
  user: AppUserProfile,
  players: Player[]
): Promise<
  Record<
    string,
    { rut: string; numeroMatricula: string; correoInstitucional: string; fechaNacimiento: string }
  >
> {
  const map: Record<
    string,
    { rut: string; numeroMatricula: string; correoInstitucional: string; fechaNacimiento: string }
  > = {};

  if (user.role === 'admin' || user.role === 'moderador') {
    const path = 'player_private';
    try {
      const snap = await getDocs(collection(db, path));
      snap.docs.forEach((d) => {
        const data = d.data();
        map[d.id] = {
          rut: String(data.rut || ''),
          numeroMatricula: String(data.numeroMatricula || ''),
          correoInstitucional: String(data.correoInstitucional || ''),
          fechaNacimiento: String(data.fechaNacimiento || ''),
        };
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    return map;
  }

  const targetIds: string[] = [];
  if (user.role === 'delegado' && user.delegatedTeamId) {
    players
      .filter((p) => p.teamId === user.delegatedTeamId)
      .forEach((p) => targetIds.push(p.id));
  } else if (user.role === 'jugador' && user.linkedPlayerId) {
    targetIds.push(user.linkedPlayerId);
  }

  await Promise.all(
    targetIds.map(async (pid) => {
      try {
        const snap = await getDoc(doc(db, 'player_private', pid));
        if (snap.exists()) {
          const data = snap.data();
          map[pid] = {
            rut: String(data.rut || ''),
            numeroMatricula: String(data.numeroMatricula || ''),
            correoInstitucional: String(data.correoInstitucional || ''),
            fechaNacimiento: String(data.fechaNacimiento || ''),
          };
        }
      } catch {
        // Ignore individual missing private docs
      }
    })
  );

  return map;
}

// ---------------------------------------------------------------------------
// 2. Users & Exclusive Admin Role Management
// ---------------------------------------------------------------------------

const inFlightUserSyncs = new Map<string, Promise<AppUserProfile>>();

export function syncGoogleUserToFirestore(user: User): Promise<AppUserProfile> {
  const existingPromise = inFlightUserSyncs.get(user.uid);
  if (existingPromise) {
    return existingPromise;
  }

  const syncPromise = (async (): Promise<AppUserProfile> => {
    const path = `users/${user.uid}`;
    const userRef = doc(db, 'users', user.uid);
    const isBootstrappedAdmin =
      Boolean(user.emailVerified) &&
      (user.email ?? '').toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;

    let snap;
    try {
      snap = await getDoc(userRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }

    if (snap.exists()) {
      const data = snap.data();
      let resolvedRole: UserRole = (data.role as UserRole) || 'tradicional';

      // Auto-promote bootstrapped admin if an older profile doc existed with a lower role
      if (isBootstrappedAdmin && resolvedRole !== 'admin') {
        try {
          await updateDoc(userRef, {
            role: 'admin',
            updatedAt: serverTimestamp(),
          });
          resolvedRole = 'admin';
        } catch (err) {
          console.warn('No se pudo promover automáticamente el documento del admin principal:', err);
        }
      }

      if (isBootstrappedAdmin) {
        try {
          const adminRef = doc(db, 'admins', user.uid);
          const adminSnap = await getDoc(adminRef);
          if (!adminSnap.exists()) {
            await setDoc(adminRef, {
              uid: user.uid,
              email: (user.email || BOOTSTRAPPED_ADMIN_EMAIL).slice(0, 160),
              grantedBy: user.uid,
              createdAt: serverTimestamp(),
            });
          }
        } catch {
          // Verified via bootstrapped admin email rule even if /admins write is skipped
        }
      }

      return {
        uid: user.uid,
        displayName: String(data.displayName || user.displayName || 'Estudiante UFRO'),
        email: String(data.email || user.email || ''),
        photoURL: typeof data.photoURL === 'string' ? data.photoURL : user.photoURL ?? undefined,
        fechaNacimiento: typeof data.fechaNacimiento === 'string' ? data.fechaNacimiento : undefined,
        carrera: typeof data.carrera === 'string' ? data.carrera : undefined,
        facultad: typeof data.facultad === 'string' ? data.facultad : undefined,
        telefono: typeof data.telefono === 'string' ? data.telefono : undefined,
        role: isBootstrappedAdmin ? 'admin' : resolvedRole,
        favoriteTeamIds: Array.isArray(data.favoriteTeamIds) ? data.favoriteTeamIds : [],
        linkedPlayerId: typeof data.linkedPlayerId === 'string' ? data.linkedPlayerId : undefined,
        delegatedTeamId: typeof data.delegatedTeamId === 'string' ? data.delegatedTeamId : undefined,
        notificationsEnabled:
          typeof data.notificationsEnabled === 'boolean' ? data.notificationsEnabled : true,
        authSource: 'google',
        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt),
      };
    }

    const initialRole: UserRole = isBootstrappedAdmin ? 'admin' : 'tradicional';
    const safeDisplayName =
      (user.displayName || user.email?.split('@')[0] || 'Estudiante UFRO').trim().slice(0, 120) ||
      'Estudiante UFRO';
    const safeEmail = (user.email || '').trim().slice(0, 160);

    const payload: Record<string, unknown> = {
      uid: user.uid,
      displayName: safeDisplayName,
      email: safeEmail,
      role: initialRole,
      favoriteTeamIds: [],
      notificationsEnabled: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (user.photoURL && user.photoURL.trim()) {
      payload.photoURL = user.photoURL.trim().slice(0, 500);
    }

    try {
      await setDoc(userRef, payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }

    // Ensure bootstrapped admin is also recorded in /admins for delegation consistency
    if (isBootstrappedAdmin) {
      try {
        await setDoc(doc(db, 'admins', user.uid), {
          uid: user.uid,
          email: (safeEmail || BOOTSTRAPPED_ADMIN_EMAIL).slice(0, 160),
          grantedBy: user.uid,
          createdAt: serverTimestamp(),
        });
      } catch {
        // Already exists or verified via email bootstrap rule
      }
    }

    const nowIso = new Date().toISOString();
    return {
      uid: user.uid,
      displayName: safeDisplayName,
      email: safeEmail,
      photoURL: user.photoURL ?? undefined,
      role: initialRole,
      favoriteTeamIds: [],
      notificationsEnabled: true,
      authSource: 'google',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  })().finally(() => {
    inFlightUserSyncs.delete(user.uid);
  });

  inFlightUserSyncs.set(user.uid, syncPromise);
  return syncPromise;
}

export async function updateFirestoreUserPreferences(
  uid: string,
  updates: {
    favoriteTeamIds?: string[];
    notificationsEnabled?: boolean;
    displayName?: string;
    fechaNacimiento?: string;
    carrera?: string;
    facultad?: string;
    telefono?: string;
  }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    const safeUpdate: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (updates.favoriteTeamIds !== undefined) {
      safeUpdate.favoriteTeamIds = updates.favoriteTeamIds.slice(0, 20);
    }
    if (updates.notificationsEnabled !== undefined) {
      safeUpdate.notificationsEnabled = updates.notificationsEnabled;
    }
    if (updates.displayName !== undefined && updates.displayName.trim()) {
      safeUpdate.displayName = updates.displayName.trim().slice(0, 120);
    }
    if (updates.fechaNacimiento !== undefined) {
      safeUpdate.fechaNacimiento = updates.fechaNacimiento.trim().slice(0, 20);
    }
    if (updates.carrera !== undefined) {
      safeUpdate.carrera = updates.carrera.trim().slice(0, 140);
    }
    if (updates.facultad !== undefined) {
      safeUpdate.facultad = updates.facultad.trim().slice(0, 140);
    }
    if (updates.telefono !== undefined) {
      safeUpdate.telefono = updates.telefono.trim().slice(0, 30);
    }
    await updateDoc(userRef, safeUpdate);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminUpdateFirestoreUserRole(params: {
  actorUid: string;
  targetUid: string;
  targetEmail: string;
  targetDisplayName?: string;
  nextRole: UserRole;
  delegatedTeamId?: string;
  linkedPlayerId?: string;
}): Promise<void> {
  const path = `users/${params.targetUid}`;
  try {
    const userRef = doc(db, 'users', params.targetUid);
    const updatePayload: Record<string, unknown> = {
      role: params.nextRole,
      updatedAt: serverTimestamp(),
    };
    if (params.delegatedTeamId !== undefined) {
      updatePayload.delegatedTeamId = params.delegatedTeamId.slice(0, 128);
    }
    if (params.linkedPlayerId !== undefined) {
      updatePayload.linkedPlayerId = params.linkedPlayerId.slice(0, 128);
    }
    await updateDoc(userRef, updatePayload);

    // Sync /admins registry (only Admin can write /admins; moderators cannot grant/revoke admin)
    if (params.nextRole === 'admin') {
      const adminDocRef = doc(db, 'admins', params.targetUid);
      await setDoc(adminDocRef, {
        uid: params.targetUid,
        email: params.targetEmail.slice(0, 160),
        grantedBy: params.actorUid,
        createdAt: serverTimestamp(),
      });
    } else if (params.targetEmail.toLowerCase() !== BOOTSTRAPPED_ADMIN_EMAIL) {
      try {
        const adminDocRef = doc(db, 'admins', params.targetUid);
        const existingAdmin = await getDoc(adminDocRef);
        if (existingAdmin.exists()) {
          await deleteDoc(adminDocRef);
        }
      } catch {
        // Moderators do not have /admins write permission and never touch admin accounts
      }
    }

    // Sync zero-PII /referee_roster registry so Referee Chiefs can assign matches safely
    try {
      const rosterRef = doc(db, 'referee_roster', params.targetUid);
      if (isRefereeOrChiefRole(params.nextRole)) {
        const safeName =
          (params.targetDisplayName || params.targetEmail.split('@')[0] || 'Árbitro UFRO')
            .trim()
            .slice(0, 120) || 'Árbitro UFRO';
        await setDoc(rosterRef, {
          uid: params.targetUid,
          displayName: safeName,
          role: params.nextRole,
          updatedAt: serverTimestamp(),
        });
      } else {
        const existingRoster = await getDoc(rosterRef);
        if (existingRoster.exists()) {
          await deleteDoc(rosterRef);
        }
      }
    } catch {
      // Non-fatal if roster sync skipped
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function listFirestoreRefereeRoster(): Promise<RefereeRosterEntry[]> {
  const path = 'referee_roster';
  try {
    const snap = await getDocs(
      query(
        collection(db, path),
        where('role', 'in', [
          'arbitro',
          'jefe_arbitros_futbol',
          'jefe_arbitros_basquetbol',
          'jefe_arbitros_voleibol',
        ])
      )
    );
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          uid: String(data.uid || d.id),
          displayName: String(data.displayName || 'Árbitro UFRO'),
          role: (data.role as RefereeRosterEntry['role']) || 'arbitro',
          updatedAt: toIso(data.updatedAt),
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));
  } catch (error) {
    console.warn('No se pudo cargar el padrón arbitral:', error);
    return [];
  }
}

export async function syncRefereeRosterFromUsers(users: AppUserProfile[]): Promise<void> {
  const refUsers = users.filter((u) => isRefereeOrChiefRole(u.role));
  if (refUsers.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const u of refUsers.slice(0, 300)) {
      batch.set(doc(db, 'referee_roster', u.uid), {
        uid: u.uid,
        displayName: (u.displayName || 'Árbitro UFRO').trim().slice(0, 120) || 'Árbitro UFRO',
        role: u.role,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch {
    // Non-fatal background sync
  }
}

export async function listFirestoreUsers(): Promise<AppUserProfile[]> {
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: String(data.uid || d.id),
        displayName: String(data.displayName || 'Usuario UFRO'),
        email: String(data.email || ''),
        photoURL: typeof data.photoURL === 'string' ? data.photoURL : undefined,
        fechaNacimiento: typeof data.fechaNacimiento === 'string' ? data.fechaNacimiento : undefined,
        carrera: typeof data.carrera === 'string' ? data.carrera : undefined,
        facultad: typeof data.facultad === 'string' ? data.facultad : undefined,
        telefono: typeof data.telefono === 'string' ? data.telefono : undefined,
        role: (data.role as UserRole) || 'tradicional',
        favoriteTeamIds: Array.isArray(data.favoriteTeamIds) ? data.favoriteTeamIds : [],
        linkedPlayerId: typeof data.linkedPlayerId === 'string' ? data.linkedPlayerId : undefined,
        delegatedTeamId: typeof data.delegatedTeamId === 'string' ? data.delegatedTeamId : undefined,
        notificationsEnabled: typeof data.notificationsEnabled === 'boolean' ? data.notificationsEnabled : true,
        authSource: 'google',
        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// ---------------------------------------------------------------------------
// 3. Tournament Settings & Discipline Configs (Admin Only Writes)
// ---------------------------------------------------------------------------

export async function saveFirestoreSettings(settings: {
  temporada: string;
  drive2025FolderId?: string;
  driveUploadRootFolderId?: string;
  driveUploadRootFolderName?: string;
  masterSheets?: MasterSheetsConfig;
  autoSyncSheetsEnabled?: boolean;
  lastSyncedSpreadsheetId?: string;
  lastSyncedAt?: string;
  homeFeatured?: HomeFeaturedConfig;
}): Promise<void> {
  const path = 'settings/tournament';
  try {
    const ref = doc(db, 'settings', 'tournament');
    const payload: Record<string, unknown> = {
      temporada: settings.temporada.slice(0, 16),
      updatedAt: serverTimestamp(),
    };
    if (settings.drive2025FolderId) payload.drive2025FolderId = settings.drive2025FolderId.slice(0, 128);
    if (settings.driveUploadRootFolderId) payload.driveUploadRootFolderId = settings.driveUploadRootFolderId.slice(0, 128);
    if (settings.driveUploadRootFolderName) payload.driveUploadRootFolderName = settings.driveUploadRootFolderName.slice(0, 160);
    if (settings.masterSheets) {
      const sanitized: Record<string, string> = {};
      const allowedKeys: MasterSheetKey[] = [
        'futbol_hombres',
        'futbol_mujeres',
        'basquet_hombres',
        'basquet_3x3_mujeres',
        'voley_mujeres',
        'voley_hombres',
        'consolidado',
      ];
      for (const key of allowedKeys) {
        const raw = settings.masterSheets[key];
        if (typeof raw === 'string' && raw.trim()) {
          sanitized[key] = raw.trim().slice(0, 128);
        }
      }
      payload.masterSheets = sanitized;
    }
    if (typeof settings.autoSyncSheetsEnabled === 'boolean') {
      payload.autoSyncSheetsEnabled = settings.autoSyncSheetsEnabled;
    }
    if (settings.lastSyncedSpreadsheetId) payload.lastSyncedSpreadsheetId = settings.lastSyncedSpreadsheetId.slice(0, 128);
    if (settings.lastSyncedAt) payload.lastSyncedAt = settings.lastSyncedAt.slice(0, 64);
    if (settings.homeFeatured) {
      const sanitizedFeatured = sanitizeHomeFeatured({
        ...settings.homeFeatured,
        updatedAt: settings.homeFeatured.updatedAt || new Date().toISOString(),
      });
      if (sanitizedFeatured) {
        payload.homeFeatured = sanitizedFeatured;
      }
    }

    const cleanPayload = stripUndefinedDeep(payload);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, cleanPayload);
    } else {
      await setDoc(ref, cleanPayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveFirestoreDisciplineConfig(config: DisciplineFormatConfig): Promise<void> {
  const path = `configs/${config.disciplineId}`;
  try {
    const ref = doc(db, 'configs', config.disciplineId);
    const payload = {
      ...buildSanitizedDisciplineConfigPayload(config),
      updatedAt: serverTimestamp(),
    };
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function ensureAllConfigsInFirestore(
  configs: Record<DisciplineId, DisciplineFormatConfig>
): Promise<void> {
  const snap = await getDocs(
    query(collection(db, 'configs'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS))
  );
  const existingIds = new Set(snap.docs.map((d) => d.id));
  const missing = ALL_DISCIPLINE_IDS.filter((id) => !existingIds.has(id));
  await Promise.all(missing.map((id) => saveFirestoreDisciplineConfig(configs[id])));
}

// ---------------------------------------------------------------------------
// 4. Teams, Players (Public + Isolated Private PII), Matches & Transfers
// ---------------------------------------------------------------------------

export async function saveFirestoreTeam(
  team: Team,
  actorUid: string,
  isNew: boolean,
  actorRole?: UserRole,
  _upsertFromSync = false
): Promise<void> {
  const path = `teams/${team.id}`;
  let effectiveIsNew = isNew;
  try {
    const ref = doc(db, 'teams', team.id);
    let existingData: Record<string, unknown> | undefined;
    if (!isNew) {
      const existing = await getDoc(ref);
      if (!existing.exists()) {
        effectiveIsNew = true;
      } else {
        existingData = existing.data() as Record<string, unknown>;
      }
    }

    const basePayload = buildSanitizedTeamPayload(team, actorUid, effectiveIsNew, actorRole);
    if (effectiveIsNew) {
      await setDoc(ref, {
        ...basePayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const finalUpdate: Record<string, unknown> = {
        ...basePayload,
        updatedAt: serverTimestamp(),
      };
      // Allow explicitly clearing anioFundacion when admin clears the field
      if (
        team.anioFundacion === undefined &&
        existingData &&
        existingData.anioFundacion !== undefined
      ) {
        finalUpdate.anioFundacion = deleteField();
      }
      await updateDoc(ref, finalUpdate);
    }
  } catch (error) {
    handleFirestoreError(error, effectiveIsNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function bulkUpdateFirestoreTeams(params: {
  teams: Team[];
  actorUid: string;
  actorRole: UserRole;
  clearLogros?: boolean;
  clearAnioFundacion?: boolean;
  clubName?: string;
}): Promise<number> {
  const { teams, actorUid, actorRole, clearLogros, clearAnioFundacion, clubName } = params;
  if (teams.length === 0) return 0;

  let updatedCount = 0;
  const CHUNK_SIZE = 350;
  for (let i = 0; i < teams.length; i += CHUNK_SIZE) {
    const chunk = teams.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const team of chunk) {
      const ref = doc(db, 'teams', team.id);
      const nextTeam: Team = {
        ...team,
        ...(clearLogros ? { logrosAnteriores: '' } : {}),
        ...(clearAnioFundacion ? { anioFundacion: undefined } : {}),
        ...(clubName !== undefined ? { clubName: clubName.trim().slice(0, 120) } : {}),
      };
      const payload = buildSanitizedTeamPayload(nextTeam, actorUid, false, actorRole);
      const updateObj: Record<string, unknown> = {
        ...payload,
        updatedAt: serverTimestamp(),
      };
      if (clearAnioFundacion) {
        updateObj.anioFundacion = deleteField();
      }
      batch.update(ref, updateObj);
      updatedCount += 1;
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'teams (bulk)');
    }
  }
  return updatedCount;
}

export async function saveFirestorePlayer(
  player: Player,
  isNew: boolean,
  actorRole: UserRole,
  upsertFromSync = false
): Promise<void> {
  const pubPath = `players/${player.id}`;
  const privPath = `player_private/${player.id}`;
  let effectiveIsNew = isNew;
  try {
    const pubRef = doc(db, 'players', player.id);
    if (upsertFromSync) {
      const existing = await getDoc(pubRef);
      effectiveIsNew = !existing.exists();
    }

    const basePayload = buildSanitizedPlayerPayload(player, effectiveIsNew, actorRole);
    if (effectiveIsNew) {
      await setDoc(pubRef, {
        ...basePayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(pubRef, {
        ...basePayload,
        updatedAt: serverTimestamp(),
      });
    }

    // Write isolated student PII only when all 4 PII fields are present
    const rut = (player.rut || '').trim();
    const numeroMatricula = (player.numeroMatricula || '').trim();
    const correoInstitucional = (player.correoInstitucional || '').trim();
    const fechaNacimiento = (player.fechaNacimiento || '').trim();
    if (
      rut.length >= 7 &&
      numeroMatricula.length >= 4 &&
      correoInstitucional.length >= 5 &&
      fechaNacimiento.length >= 8
    ) {
      const privRef = doc(db, 'player_private', player.id);
      const privPayload = stripUndefinedDeep({
        playerId: player.id,
        teamId: player.teamId,
        rut: rut.slice(0, 20),
        numeroMatricula: numeroMatricula.slice(0, 30),
        correoInstitucional: correoInstitucional.slice(0, 160),
        fechaNacimiento: fechaNacimiento.slice(0, 20),
        updatedAt: serverTimestamp(),
      });
      if (effectiveIsNew) {
        await setDoc(privRef, privPayload);
      } else {
        const privSnap = await getDoc(privRef);
        if (privSnap.exists()) {
          const updatePriv: Record<string, unknown> = {
            rut: privPayload.rut,
            numeroMatricula: privPayload.numeroMatricula,
            correoInstitucional: privPayload.correoInstitucional,
            fechaNacimiento: privPayload.fechaNacimiento,
            updatedAt: serverTimestamp(),
          };
          if (actorRole === 'admin' || actorRole === 'delegado') {
            updatePriv.teamId = player.teamId;
          }
          await updateDoc(privRef, stripUndefinedDeep(updatePriv));
        } else {
          await setDoc(privRef, privPayload);
        }
      }
    }
  } catch (error) {
    handleFirestoreError(
      error,
      effectiveIsNew ? OperationType.CREATE : OperationType.UPDATE,
      `${pubPath} / ${privPath}`
    );
  }
}

export async function updateFirestorePlayerStats(playerId: string, stats: PlayerStats): Promise<void> {
  const path = `players/${playerId}`;
  try {
    await updateDoc(doc(db, 'players', playerId), {
      stats: sanitizeStats(stats),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteFirestorePlayer(playerId: string): Promise<void> {
  const pubPath = `players/${playerId}`;
  try {
    await deleteDoc(doc(db, 'players', playerId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, pubPath);
  }
  // Also delete isolated student PII record if present
  try {
    const privRef = doc(db, 'player_private', playerId);
    const privSnap = await getDoc(privRef);
    if (privSnap.exists()) {
      await deleteDoc(privRef);
    }
  } catch {
    // Non-fatal if private doc didn't exist
  }
}

export async function deleteFirestoreTeam(
  teamId: string,
  cascade?: { playerIds?: string[]; matchIds?: string[] }
): Promise<void> {
  const teamPath = `teams/${teamId}`;
  try {
    await deleteDoc(doc(db, 'teams', teamId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, teamPath);
  }

  if (cascade?.playerIds && cascade.playerIds.length > 0) {
    await Promise.all(cascade.playerIds.map((pid) => deleteFirestorePlayer(pid)));
  }

  if (cascade?.matchIds && cascade.matchIds.length > 0) {
    await deleteFirestoreMatchesForDiscipline(cascade.matchIds);
  }
}

function sanitizeMatchLiveState(raw: unknown): Match['liveState'] | undefined {
  return sanitizeMatchLiveStateRecord(raw);
}

function sanitizeMatchAttendance(raw: unknown): Match['attendance'] | undefined {
  return sanitizeMatchAttendanceRecord(raw);
}

export async function saveFirestoreMatch(
  match: Match,
  isNew: boolean,
  actorRole: UserRole,
  _upsertFromSync = false
): Promise<void> {
  const path = `matches/${match.id}`;
  let effectiveIsNew = isNew;
  try {
    const ref = doc(db, 'matches', match.id);
    let existingData: Record<string, unknown> | undefined;

    // Always verify existence before updateDoc: prevents Firestore returning
    // "Missing or insufficient permissions" when a sheet-imported/cached match
    // does not yet exist in Firestore (e.g., matches/PVOLM037).
    if (!isNew) {
      const existing = await getDoc(ref);
      if (!existing.exists()) {
        effectiveIsNew = true;
      } else {
        existingData = existing.data() as Record<string, unknown>;
      }
    }

    const basePayload = buildSanitizedMatchPayload(match, effectiveIsNew, actorRole);
    if (effectiveIsNew) {
      await setDoc(ref, {
        ...basePayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const updateObj: Record<string, unknown> = {
        ...basePayload,
        updatedAt: serverTimestamp(),
      };
      // Explicitly remove penaltyScore when user clears it
      if (
        match.penaltyScore === undefined &&
        existingData &&
        existingData.penaltyScore !== undefined
      ) {
        updateObj.penaltyScore = deleteField();
      }
      // Repair legacy/sheet-imported match docs that lacked required fields
      const isGeneralAdmin = actorRole === 'admin' || actorRole === 'moderador';
      if (isGeneralAdmin && existingData) {
        if (!existingData.createdAt) {
          updateObj.createdAt = serverTimestamp();
        }
        if (existingData.id !== match.id) {
          updateObj.id = match.id;
        }
      }
      await updateDoc(ref, updateObj);
    }
  } catch (error) {
    handleFirestoreError(error, effectiveIsNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteFirestoreMatchesForDiscipline(matchIds: string[]): Promise<void> {
  await Promise.all(
    matchIds.map(async (id) => {
      try {
        await deleteDoc(doc(db, 'matches', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `matches/${id}`);
      }
    })
  );
}

function mapTransferDoc(d: QueryDocumentSnapshot): TransferRecord {
  const data = d.data();
  const estado = (data.estado as TransferRecord['estado']) || 'APROBADA';
  return {
    id: String(data.id || d.id),
    disciplineId: data.disciplineId as DisciplineId,
    playerId: String(data.playerId || ''),
    playerName: String(data.playerName || ''),
    fromTeamId: String(data.fromTeamId || ''),
    fromTeamName: String(data.fromTeamName || ''),
    toTeamId: String(data.toTeamId || ''),
    toTeamName: String(data.toTeamName || ''),
    fecha: String(data.fecha || ''),
    motivo: String(data.motivo || ''),
    estado,
    createdByUid: typeof data.createdByUid === 'string' ? data.createdByUid : undefined,
    requestedByTeamId: typeof data.requestedByTeamId === 'string' ? data.requestedByTeamId : undefined,
    requestedByName: typeof data.requestedByName === 'string' ? data.requestedByName : undefined,
    fromTeamApproved:
      typeof data.fromTeamApproved === 'boolean'
        ? data.fromTeamApproved
        : estado === 'APROBADA',
    fromTeamApprovedByUid:
      typeof data.fromTeamApprovedByUid === 'string' ? data.fromTeamApprovedByUid : undefined,
    toTeamApproved:
      typeof data.toTeamApproved === 'boolean' ? data.toTeamApproved : estado === 'APROBADA',
    toTeamApprovedByUid:
      typeof data.toTeamApprovedByUid === 'string' ? data.toTeamApprovedByUid : undefined,
    approvedAt: data.approvedAt ? toIso(data.approvedAt) : undefined,
    rejectedByUid: typeof data.rejectedByUid === 'string' ? data.rejectedByUid : undefined,
    rejectedAt: data.rejectedAt ? toIso(data.rejectedAt) : undefined,
    updatedAt: data.updatedAt ? toIso(data.updatedAt) : data.createdAt ? toIso(data.createdAt) : undefined,
  };
}

export async function listDelegateFirestoreTransfers(
  delegatedTeamId: string
): Promise<TransferRecord[]> {
  try {
    const [fromSnap, toSnap] = await Promise.all([
      getDocs(query(collection(db, 'transfers'), where('fromTeamId', '==', delegatedTeamId))),
      getDocs(query(collection(db, 'transfers'), where('toTeamId', '==', delegatedTeamId))),
    ]);
    const byId = new Map<string, TransferRecord>();
    fromSnap.docs.forEach((d) => {
      const rec = mapTransferDoc(d);
      byId.set(rec.id, rec);
    });
    toSnap.docs.forEach((d) => {
      const rec = mapTransferDoc(d);
      byId.set(rec.id, rec);
    });
    return Array.from(byId.values());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'transfers');
    return [];
  }
}

export async function listAllFirestoreTransfers(): Promise<TransferRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'transfers'));
    return snap.docs.map((d) => mapTransferDoc(d));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'transfers');
    return [];
  }
}

export async function createFirestoreTransferRequest(
  transfer: TransferRecord,
  actorUid: string
): Promise<void> {
  const transferPath = `transfers/${transfer.id}`;
  try {
    const payload: Record<string, unknown> = {
      id: transfer.id,
      disciplineId: transfer.disciplineId,
      playerId: transfer.playerId,
      playerName: transfer.playerName.slice(0, 140),
      fromTeamId: transfer.fromTeamId,
      fromTeamName: transfer.fromTeamName.slice(0, 120),
      toTeamId: transfer.toTeamId,
      toTeamName: transfer.toTeamName.slice(0, 120),
      fecha: transfer.fecha.slice(0, 20),
      motivo: transfer.motivo.slice(0, 300),
      estado: 'PENDIENTE',
      createdByUid: actorUid,
      requestedByTeamId: transfer.requestedByTeamId ?? transfer.fromTeamId,
      fromTeamApproved: Boolean(transfer.fromTeamApproved),
      toTeamApproved: Boolean(transfer.toTeamApproved),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (transfer.requestedByName && transfer.requestedByName.trim()) {
      payload.requestedByName = transfer.requestedByName.trim().slice(0, 120);
    }
    if (transfer.fromTeamApproved && transfer.fromTeamApprovedByUid) {
      payload.fromTeamApprovedByUid = transfer.fromTeamApprovedByUid;
    }
    if (transfer.toTeamApproved && transfer.toTeamApprovedByUid) {
      payload.toTeamApprovedByUid = transfer.toTeamApprovedByUid;
    }

    await setDoc(doc(db, 'transfers', transfer.id), stripUndefinedDeep(payload));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, transferPath);
  }
}

export async function approveFirestoreTransferRequest(
  transfer: TransferRecord,
  actorUid: string,
  isFromDelegate: boolean
): Promise<void> {
  const transferPath = `transfers/${transfer.id}`;
  try {
    const batch = writeBatch(db);
    const transferRef = doc(db, 'transfers', transfer.id);
    const playerRef = doc(db, 'players', transfer.playerId);

    const approvalPatch: Record<string, unknown> = {
      estado: 'APROBADA',
      fecha: transfer.fecha.slice(0, 20),
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (isFromDelegate) {
      approvalPatch.fromTeamApproved = true;
      approvalPatch.fromTeamApprovedByUid = actorUid;
    } else {
      approvalPatch.toTeamApproved = true;
      approvalPatch.toTeamApprovedByUid = actorUid;
    }

    batch.update(transferRef, approvalPatch);
    batch.update(playerRef, {
      teamId: transfer.toTeamId,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    // Best-effort sync of teamId on isolated private student record
    try {
      await updateDoc(doc(db, 'player_private', transfer.playerId), {
        teamId: transfer.toTeamId,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Non-fatal if private record does not exist
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, transferPath);
  }
}

export async function rejectFirestoreTransferRequest(
  transferId: string,
  actorUid: string
): Promise<void> {
  const transferPath = `transfers/${transferId}`;
  try {
    await updateDoc(doc(db, 'transfers', transferId), {
      estado: 'RECHAZADA',
      rejectedByUid: actorUid,
      rejectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, transferPath);
  }
}

// ---------------------------------------------------------------------------
// 5. MVP Votes & Official Photography Index
// ---------------------------------------------------------------------------

export async function saveFirestoreMvpVote(params: {
  matchId: string;
  disciplineId: DisciplineId;
  playerId: string;
  playerName: string;
  teamId: string;
  voterUid: string;
}): Promise<void> {
  const voteId = `${params.matchId}_${params.voterUid}`;
  const path = `mvp_votes/${voteId}`;
  try {
    const ref = doc(db, 'mvp_votes', voteId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        playerId: params.playerId,
        playerName: params.playerName.slice(0, 120),
        teamId: params.teamId,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        matchId: params.matchId,
        disciplineId: params.disciplineId,
        playerId: params.playerId,
        playerName: params.playerName.slice(0, 120),
        teamId: params.teamId,
        voterUid: params.voterUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveFirestorePhoto(photo: PhotoEntry): Promise<void> {
  const path = `photos/${photo.id}`;
  try {
    const payload: Record<string, unknown> = {
      id: photo.id,
      title: photo.title.slice(0, 160),
      disciplineId: photo.disciplineId.slice(0, 40),
      matchLabel: photo.matchLabel.slice(0, 160),
      season: photo.season.slice(0, 16),
      source: photo.source,
      imageUrl: photo.imageUrl.slice(0, 199000),
      photographerUid: photo.photographerUid,
      photographerName: photo.photographerName.slice(0, 120),
      createdAt: serverTimestamp(),
    };
    if (photo.stageLabel) payload.stageLabel = photo.stageLabel.slice(0, 80);
    if (photo.thumbnailUrl) payload.thumbnailUrl = photo.thumbnailUrl.slice(0, 1000);
    if (photo.driveFileId) payload.driveFileId = photo.driveFileId.slice(0, 128);
    if (photo.driveWebViewLink) payload.driveWebViewLink = photo.driveWebViewLink.slice(0, 500);
    if (photo.driveFolderPath) payload.driveFolderPath = photo.driveFolderPath.slice(0, 300);

    await setDoc(doc(db, 'photos', photo.id), stripUndefinedDeep(payload));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteFirestorePhoto(photoId: string): Promise<void> {
  const path = `photos/${photoId}`;
  try {
    await deleteDoc(doc(db, 'photos', photoId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// 6. Championship News & Announcements (Prensa Oficial + Admin)
// ---------------------------------------------------------------------------

export async function listAllFirestoreNews(): Promise<NewsArticle[]> {
  const path = 'news';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs
      .map((d) => mapNewsDoc(d.id, d.data()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveFirestoreNewsArticle(
  article: NewsArticle,
  isNew: boolean
): Promise<void> {
  const path = `news/${article.id}`;
  try {
    const ref = doc(db, 'news', article.id);
    const sanitizedTitle = article.title.trim().slice(0, 160);
    const sanitizedSummary = article.summary.trim().slice(0, 360);
    const sanitizedContent = article.content.trim().slice(0, 12000);
    const sanitizedDiscipline = (article.disciplineId || 'general').slice(0, 40);
    const sanitizedCover = article.coverImageUrl ? article.coverImageUrl.trim().slice(0, 1000) : '';

    if (isNew) {
      const resolvedAuthorRole =
        article.authorRole === 'prensa'
          ? 'prensa'
          : article.authorRole === 'moderador'
          ? 'moderador'
          : 'admin';
      const payload: Record<string, unknown> = {
        id: article.id,
        title: sanitizedTitle,
        summary: sanitizedSummary,
        content: sanitizedContent,
        category: article.category,
        disciplineId: sanitizedDiscipline,
        featured: Boolean(article.featured),
        published: Boolean(article.published),
        aiGenerated: Boolean(article.aiGenerated),
        authorUid: article.authorUid,
        authorName: article.authorName.trim().slice(0, 120) || 'Prensa Oficial UFRO',
        authorRole: resolvedAuthorRole,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (sanitizedCover) {
        payload.coverImageUrl = sanitizedCover;
      }
      await setDoc(ref, payload);
    } else {
      const resolvedAuthorRole =
        article.authorRole === 'prensa'
          ? 'prensa'
          : article.authorRole === 'moderador'
          ? 'moderador'
          : 'admin';
      const updatePayload: Record<string, unknown> = {
        title: sanitizedTitle,
        summary: sanitizedSummary,
        content: sanitizedContent,
        category: article.category,
        disciplineId: sanitizedDiscipline,
        coverImageUrl: sanitizedCover,
        featured: Boolean(article.featured),
        published: Boolean(article.published),
        aiGenerated: Boolean(article.aiGenerated),
        authorName: article.authorName.trim().slice(0, 120) || 'Prensa Oficial UFRO',
        authorRole: resolvedAuthorRole,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(ref, updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteFirestoreNewsArticle(newsId: string): Promise<void> {
  const path = `news/${newsId}`;
  try {
    await deleteDoc(doc(db, 'news', newsId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// 7. Championship Awards, MVP Nominees, Position Awards & TOTY Ballots
// ---------------------------------------------------------------------------

export async function saveFirestoreAwardNominees(
  disciplineId: DisciplineId,
  temporada: string,
  mvpNomineeIds: string[]
): Promise<void> {
  const path = `award_nominees/${disciplineId}`;
  try {
    const ref = doc(db, 'award_nominees', disciplineId);
    const cleanedIds = Array.from(new Set(mvpNomineeIds.map((id) => id.trim()).filter(Boolean))).slice(
      0,
      5
    );
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        temporada: (temporada || '2026').slice(0, 16),
        mvpNomineeIds: cleanedIds,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        disciplineId,
        temporada: (temporada || '2026').slice(0, 16),
        mvpNomineeIds: cleanedIds,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveFirestoreChampionshipMvpVote(
  vote: ChampionshipMvpVoteRecord
): Promise<void> {
  const voteId = `${vote.disciplineId}_${vote.voterUid}`;
  const path = `championship_mvp_votes/${voteId}`;
  try {
    const ref = doc(db, 'championship_mvp_votes', voteId);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        playerId: vote.playerId,
        playerName: vote.playerName.trim().slice(0, 120),
        teamId: vote.teamId,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        disciplineId: vote.disciplineId,
        temporada: (vote.temporada || '2026').slice(0, 16),
        voterUid: vote.voterUid,
        playerId: vote.playerId,
        playerName: vote.playerName.trim().slice(0, 120),
        teamId: vote.teamId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveFirestorePositionAwardVote(
  vote: PositionAwardVoteRecord
): Promise<void> {
  const voteId = `${vote.disciplineId}_${vote.positionKey}_${vote.voterUid}`;
  const path = `position_award_votes/${voteId}`;
  try {
    const ref = doc(db, 'position_award_votes', voteId);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        positionLabel: vote.positionLabel.trim().slice(0, 60),
        playerId: vote.playerId,
        playerName: vote.playerName.trim().slice(0, 120),
        teamId: vote.teamId,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        disciplineId: vote.disciplineId,
        temporada: (vote.temporada || '2026').slice(0, 16),
        positionKey: vote.positionKey.trim().slice(0, 32),
        positionLabel: vote.positionLabel.trim().slice(0, 60),
        voterUid: vote.voterUid,
        playerId: vote.playerId,
        playerName: vote.playerName.trim().slice(0, 120),
        teamId: vote.teamId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Writes one or multiple TOTY ballots across disciplines in atomic Firestore writeBatch chunks.
 * Avoids per-document getDoc() reads by relying on known persisted state (`item.isUpdate`),
 * cutting Firestore read/write overhead when users vote across multiple disciplines.
 */
export async function saveFirestoreTotyBallotsBatch(
  items: TotyBallotBatchItem[]
): Promise<number> {
  const validItems = items
    .map((item) => ({
      ballot: item.ballot,
      isUpdate: item.isUpdate,
      cleanSelections: sanitizeTotySelections(item.ballot.selections),
    }))
    .filter((entry) => Object.keys(entry.cleanSelections).length > 0);

  if (validItems.length === 0) return 0;

  let committedCount = 0;
  for (let i = 0; i < validItems.length; i += FIRESTORE_TOTY_BATCH_CHUNK_SIZE) {
    const chunk = validItems.slice(i, i + FIRESTORE_TOTY_BATCH_CHUNK_SIZE);
    const batchPath =
      chunk.length === 1
        ? `toty_ballots/${chunk[0].ballot.disciplineId}_${chunk[0].ballot.voterUid}`
        : `toty_ballots/batch(${chunk.map((c) => c.ballot.disciplineId).join(',')})`;

    const commitChunk = async (chunkToWrite: typeof chunk) => {
      const batch = writeBatch(db);
      for (const entry of chunkToWrite) {
        const ballotId = `${entry.ballot.disciplineId}_${entry.ballot.voterUid}`;
        const ref = doc(db, 'toty_ballots', ballotId);
        if (entry.isUpdate) {
          batch.update(ref, {
            selections: entry.cleanSelections,
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(ref, {
            disciplineId: entry.ballot.disciplineId,
            temporada: (entry.ballot.temporada || '2026').slice(0, 16),
            voterUid: entry.ballot.voterUid,
            selections: entry.cleanSelections,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
      await batch.commit();
    };

    try {
      await commitChunk(chunk);
      committedCount += chunk.length;
    } catch (error) {
      // Only if a stale `isUpdate: true` targeted a document removed on server (`not-found`),
      // retry once using set() for update-marked items without burning extra getDoc reads.
      const errCode = String((error as { code?: string })?.code ?? '').toLowerCase();
      const errMsg = String((error as { message?: string })?.message ?? '').toLowerCase();
      const isNotFound =
        errCode.includes('not-found') || errMsg.includes('no document to update');
      const hasUpdateItem = chunk.some((entry) => entry.isUpdate);

      if (isNotFound && hasUpdateItem) {
        try {
          await commitChunk(chunk.map((entry) => ({ ...entry, isUpdate: false })));
          committedCount += chunk.length;
          continue;
        } catch (retryError) {
          handleFirestoreError(retryError, OperationType.WRITE, batchPath);
        }
      }
      handleFirestoreError(error, OperationType.WRITE, batchPath);
    }
  }

  return committedCount;
}

export async function saveFirestoreTotyBallot(
  ballot: TotyBallotRecord,
  isKnownExisting?: boolean
): Promise<void> {
  if (typeof isKnownExisting === 'boolean') {
    await saveFirestoreTotyBallotsBatch([{ ballot, isUpdate: isKnownExisting }]);
    return;
  }

  const ballotId = `${ballot.disciplineId}_${ballot.voterUid}`;
  const path = `toty_ballots/${ballotId}`;
  try {
    const ref = doc(db, 'toty_ballots', ballotId);
    const cleanSelections = sanitizeTotySelections(ballot.selections);
    if (Object.keys(cleanSelections).length === 0) return;

    const existing = await getDoc(ref);
    await saveFirestoreTotyBallotsBatch([
      {
        ballot: { ...ballot, selections: cleanSelections },
        isUpdate: existing.exists(),
      },
    ]);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

function mapTotyBallotDoc(docId: string, data: Record<string, unknown>): TotyBallotRecord {
  const rawSel = data.selections && typeof data.selections === 'object' ? data.selections : {};
  const selections: Record<string, string> = {};
  Object.entries(rawSel as Record<string, unknown>).forEach(([k, v]) => {
    if (typeof v === 'string' && v.trim()) {
      selections[k] = v.trim();
    }
  });
  return {
    id: docId,
    disciplineId: data.disciplineId as DisciplineId,
    temporada: String(data.temporada || '2026'),
    voterUid: String(data.voterUid || ''),
    selections,
    updatedAt: toIso(data.updatedAt),
  };
}

function mapTotyConfigDoc(
  docId: string,
  data: Record<string, unknown>
): DisciplineTotyConfig | null {
  const discId = (data.disciplineId || docId) as DisciplineId;
  if (!ALL_DISCIPLINE_IDS.includes(discId)) return null;
  const rawCounts =
    data.positionCounts && typeof data.positionCounts === 'object'
      ? (data.positionCounts as Record<string, unknown>)
      : {};
  const positionCounts: Record<string, number> = {};
  Object.entries(rawCounts).forEach(([key, val]) => {
    const num = Math.trunc(Number(val));
    if (key.trim() && Number.isFinite(num) && num >= 0 && num <= 6) {
      positionCounts[key.trim().slice(0, 32)] = num;
    }
  });
  if (Object.keys(positionCounts).length === 0) return null;
  return {
    disciplineId: discId,
    temporada: String(data.temporada || '2026'),
    formationName: String(data.formationName || '').trim().slice(0, 80),
    positionCounts,
    updatedAt: toIso(data.updatedAt),
  };
}

export async function saveFirestoreTotyConfig(config: DisciplineTotyConfig): Promise<void> {
  const path = `toty_configs/${config.disciplineId}`;
  try {
    const ref = doc(db, 'toty_configs', config.disciplineId);
    const cleanCounts: Record<string, number> = {};
    Object.entries(config.positionCounts)
      .slice(0, 8)
      .forEach(([posKey, count]) => {
        const key = posKey.trim().slice(0, 32);
        const val = Math.max(0, Math.min(6, Math.trunc(Number(count) || 0)));
        if (key) cleanCounts[key] = val;
      });
    const safeName = (config.formationName || '').trim().slice(0, 80);
    const formationName = safeName.length >= 2 ? safeName : 'Formación TOTY';
    const temporada = (config.temporada || '2026').trim().slice(0, 16) || '2026';

    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        temporada,
        formationName,
        positionCounts: cleanCounts,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        disciplineId: config.disciplineId,
        temporada,
        formationName,
        positionCounts: cleanCounts,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteFirestoreTotyConfig(disciplineId: DisciplineId): Promise<void> {
  const path = `toty_configs/${disciplineId}`;
  try {
    await deleteDoc(doc(db, 'toty_configs', disciplineId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * One-shot discipline-scoped fetch for TOTY ballots + formation config.
 * Only reads documents belonging to the active discipline instead of scanning
 * all 8 disciplines, working in tandem with the indexed localStorage TOTY cache.
 */
export async function fetchFirestoreTotyForDiscipline(
  disciplineId: DisciplineId
): Promise<{
  ballots: TotyBallotRecord[];
  config: DisciplineTotyConfig | null;
}> {
  try {
    const [ballotsSnap, configSnap] = await Promise.all([
      getDocs(query(collection(db, 'toty_ballots'), where('disciplineId', '==', disciplineId))),
      getDoc(doc(db, 'toty_configs', disciplineId)),
    ]);

    const ballots = ballotsSnap.docs.map((d) => mapTotyBallotDoc(d.id, d.data()));
    const config = configSnap.exists()
      ? mapTotyConfigDoc(configSnap.id, configSnap.data() as Record<string, unknown>)
      : null;

    return { ballots, config };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `toty_ballots(${disciplineId})`);
    return { ballots: [], config: null };
  }
}

/**
 * One-shot fetch for all disciplines' TOTY ballots and configs (used for full cache sync).
 */
export async function fetchAllFirestoreTotyData(): Promise<{
  ballots: TotyBallotRecord[];
  configs: Partial<Record<DisciplineId, DisciplineTotyConfig>>;
}> {
  try {
    const [ballotsSnap, configsSnap] = await Promise.all([
      getDocs(query(collection(db, 'toty_ballots'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS))),
      getDocs(query(collection(db, 'toty_configs'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS))),
    ]);

    const ballots = ballotsSnap.docs.map((d) => mapTotyBallotDoc(d.id, d.data()));
    const configs: Partial<Record<DisciplineId, DisciplineTotyConfig>> = {};
    configsSnap.docs.forEach((d) => {
      const mapped = mapTotyConfigDoc(d.id, d.data());
      if (mapped) {
        configs[mapped.disciplineId] = mapped;
      }
    });

    return { ballots, configs };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'toty_ballots');
    return { ballots: [], configs: {} };
  }
}

export function subscribeToTotyBallots(
  onUpdate: (ballots: TotyBallotRecord[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const q = query(collection(db, 'toty_ballots'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS));
  return onSnapshot(
    q,
    (snapshot) => {
      const ballots = snapshot.docs.map((d) => mapTotyBallotDoc(d.id, d.data()));
      onUpdate(ballots);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export function subscribeToTotyConfigs(
  onUpdate: (configs: Partial<Record<DisciplineId, DisciplineTotyConfig>>) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const q = query(collection(db, 'toty_configs'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS));
  return onSnapshot(
    q,
    (snapshot) => {
      const configMap: Partial<Record<DisciplineId, DisciplineTotyConfig>> = {};
      snapshot.docs.forEach((d) => {
        const mapped = mapTotyConfigDoc(d.id, d.data());
        if (mapped) {
          configMap[mapped.disciplineId] = mapped;
        }
      });
      onUpdate(configMap);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export async function saveFirestoreLeyendasEntry(entry: LeyendasLeaderboardEntry): Promise<void> {
  const safeId = entry.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128) || `ley_${Date.now()}`;
  const path = `leyendas_leaderboard/${safeId}`;
  try {
    const ref = doc(db, 'leyendas_leaderboard', safeId);
    const clampInt = (n: number, min: number, max: number) =>
      Math.max(min, Math.min(max, Math.trunc(Number(n) || 0)));

    const ensureMinStr = (val: string | undefined, fallback: string, minLen: number, maxLen: number) => {
      const trimmed = (val || '').trim().slice(0, maxLen);
      return trimmed.length >= minLen ? trimmed : fallback;
    };

    const payload: Record<string, unknown> = {
      id: safeId,
      uid: entry.uid.slice(0, 128),
      playerName: ensureMinStr(entry.playerName, 'Leyenda UFRO', 1, 80),
      career: ensureMinStr(entry.career, 'Carrera UFRO', 2, 120),
      sportKey: entry.sportKey,
      branch: entry.branch,
      pos: ensureMinStr(entry.pos, 'DEL', 1, 12),
      ovr: clampInt(entry.ovr, 50, 110),
      maxOvr: clampInt(entry.maxOvr, 50, 110),
      score: clampInt(entry.score, 0, 100000),
      legacyTitle: ensureMinStr(entry.legacyTitle, 'Guerrero Universitario UFRO', 2, 100),
      legacyDesc: ensureMinStr(entry.legacyDesc, 'Carrera universitaria UFRO', 2, 220),
      titlesCount: clampInt(entry.titlesCount, 0, 60),
      awardsCount: clampInt(entry.awardsCount, 0, 40),
      capsCount: clampInt(entry.capsCount, 0, 200),
      semestersPlayed: clampInt(entry.semestersPlayed, 1, 40),
      stats: {
        g: clampInt(entry.stats.g, 0, 1000),
        a: clampInt(entry.stats.a, 0, 1000),
        m: clampInt(entry.stats.m, 0, 500),
        pts: clampInt(entry.stats.pts, 0, 15000),
        reb: clampInt(entry.stats.reb, 0, 5000),
        ast: clampInt(entry.stats.ast, 0, 5000),
        blk: clampInt(entry.stats.blk, 0, 3000),
        ace: clampInt(entry.stats.ace, 0, 3000),
      },
      finalTeam: ensureMinStr(entry.finalTeam, 'Club UFRO', 2, 100),
      stints: entry.stints.slice(0, 15).map((s) => ({
        team: s.team.slice(0, 100),
        ...(s.teamId ? { teamId: s.teamId.slice(0, 128) } : {}),
        ...(s.sigla ? { sigla: s.sigla.slice(0, 8) } : {}),
        div: s.div.slice(0, 24),
        years: s.years.slice(0, 20),
      })),
      trophies: entry.trophies.slice(0, 60).map((t) => ({
        id: t.id.slice(0, 60),
        title: t.title.slice(0, 100),
        year: clampInt(t.year, 2000, 2100),
        team: t.team.slice(0, 100),
      })),
      awards: entry.awards.slice(0, 40).map((a) => ({
        id: a.id.slice(0, 60),
        title: a.title.slice(0, 100),
        year: clampInt(a.year, 2000, 2100),
      })),
      weekKey: ensureMinStr(entry.weekKey, '2026-W01', 7, 16),
      createdAt: serverTimestamp(),
    };

    if (entry.finalTeamId && /^[a-zA-Z0-9_-]{1,128}$/.test(entry.finalTeamId)) {
      payload.finalTeamId = entry.finalTeamId;
    }
    if (entry.finalTeamEscudo && entry.finalTeamEscudo.length <= 160000) {
      payload.finalTeamEscudo = entry.finalTeamEscudo;
    }

    await setDoc(ref, stripUndefinedDeep(payload));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}


