import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { DEFAULT_MASTER_SHEETS, INITIAL_CONFIGS } from '../data/ufroSeed';
import { BOOTSTRAPPED_ADMIN_EMAIL } from '../domain/rbacEngine';
import type {
  AcademicLevel,
  AppUserProfile,
  DisciplineFormatConfig,
  DisciplineId,
  MasterSheetKey,
  MasterSheetsConfig,
  Match,
  MvpVoteRecord,
  PhotoEntry,
  Player,
  PlayerStats,
  Team,
  TournamentState,
  TransferRecord,
  UserRole,
} from '../types/tournament';
import { db, handleFirestoreError, OperationType } from './firebaseAuth';

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

function defaultStats(): PlayerStats {
  return {
    partidosJugados: 0,
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

function sanitizeStats(raw: Partial<PlayerStats> | undefined): PlayerStats {
  const base = defaultStats();
  if (!raw) return base;
  return {
    partidosJugados: Math.max(0, Math.min(200, Math.trunc(Number(raw.partidosJugados) || 0))),
    goles: Math.max(0, Math.min(500, Math.trunc(Number(raw.goles) || 0))),
    asistencias: Math.max(0, Math.min(500, Math.trunc(Number(raw.asistencias) || 0))),
    tarjetasAmarillas: Math.max(0, Math.min(100, Math.trunc(Number(raw.tarjetasAmarillas) || 0))),
    tarjetasRojas: Math.max(0, Math.min(50, Math.trunc(Number(raw.tarjetasRojas) || 0))),
    puntos: Math.max(0, Math.min(5000, Math.trunc(Number(raw.puntos) || 0))),
    rebotes: Math.max(0, Math.min(2000, Math.trunc(Number(raw.rebotes) || 0))),
    triples: Math.max(0, Math.min(1000, Math.trunc(Number(raw.triples) || 0))),
    faltas: Math.max(0, Math.min(500, Math.trunc(Number(raw.faltas) || 0))),
    aces: Math.max(0, Math.min(1000, Math.trunc(Number(raw.aces) || 0))),
    bloqueos: Math.max(0, Math.min(1000, Math.trunc(Number(raw.bloqueos) || 0))),
  };
}

// ---------------------------------------------------------------------------
// 1. Public Tournament Hydration (Runs for all visitors)
// ---------------------------------------------------------------------------

export async function loadPublicTournamentState(): Promise<Partial<TournamentState>> {
  const [settingsRes, configsRes, teamsRes, playersRes, matchesRes, transfersRes, votesRes, photosRes] =
    await Promise.allSettled([
      getDoc(doc(db, 'settings', 'tournament')),
      getDocs(query(collection(db, 'configs'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS))),
      getDocs(query(collection(db, 'teams'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS))),
      getDocs(query(collection(db, 'players'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS))),
      getDocs(query(collection(db, 'matches'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS))),
      getDocs(query(collection(db, 'transfers'), where('disciplineId', 'in', ALL_DISCIPLINE_IDS))),
      getDocs(query(collection(db, 'mvp_votes'), where('matchId', '>=', ''))),
      getDocs(query(collection(db, 'photos'), where('season', '>=', ''))),
    ]);

  const result: Partial<TournamentState> = {};

  if (settingsRes.status === 'fulfilled' && settingsRes.value.exists()) {
    const s = settingsRes.value.data();
    if (typeof s.temporada === 'string') result.temporada = s.temporada;
    if (typeof s.driveUploadRootFolderId === 'string') {
      result.driveUploadRootFolderId = s.driveUploadRootFolderId;
    }
    if (typeof s.driveUploadRootFolderName === 'string') {
      result.driveUploadRootFolderName = s.driveUploadRootFolderName;
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
      result.masterSheets = merged;
    }
    if (typeof s.autoSyncSheetsEnabled === 'boolean') {
      result.autoSyncSheetsEnabled = s.autoSyncSheetsEnabled;
    }
    if (typeof s.lastSyncedSpreadsheetId === 'string') {
      result.lastSyncedSpreadsheetId = s.lastSyncedSpreadsheetId;
    }
    if (typeof s.lastSyncedAt === 'string') {
      result.lastSyncedAt = s.lastSyncedAt;
    }
  }

  if (configsRes.status === 'fulfilled' && !configsRes.value.empty) {
    const mergedConfigs: Record<DisciplineId, DisciplineFormatConfig> = { ...INITIAL_CONFIGS };
    configsRes.value.docs.forEach((d) => {
      const data = d.data();
      const id = data.disciplineId as DisciplineId;
      if (id in mergedConfigs) {
        mergedConfigs[id] = {
          disciplineId: id,
          temporada: String(data.temporada || '2026'),
          maxCupos: Number(data.maxCupos) || mergedConfigs[id].maxCupos,
          numGrupos: Number(data.numGrupos) || mergedConfigs[id].numGrupos,
          clasificadosPorGrupo: Number(data.clasificadosPorGrupo) || mergedConfigs[id].clasificadosPorGrupo,
          formatoPlayoff: ([4, 8, 16].includes(Number(data.formatoPlayoff))
            ? Number(data.formatoPlayoff)
            : mergedConfigs[id].formatoPlayoff) as 4 | 8 | 16,
          inscripcionesAbiertas: Boolean(data.inscripcionesAbiertas),
          transferenciasAbiertas: Boolean(data.transferenciasAbiertas),
          maxTransferenciasPorEquipo: Number(data.maxTransferenciasPorEquipo) ?? 2,
          faseActual: (data.faseActual as DisciplineFormatConfig['faseActual']) || 'INSCRIPCIONES',
        };
      }
    });
    result.configs = mergedConfigs;
  }

  if (teamsRes.status === 'fulfilled') {
    result.teams = teamsRes.value.docs.map((d) => {
      const data = d.data();
      return {
        id: String(data.id || d.id),
        nombre: String(data.nombre || ''),
        sigla: String(data.sigla || ''),
        disciplineId: data.disciplineId as DisciplineId,
        carrera: String(data.carrera || ''),
        facultad: String(data.facultad || ''),
        groupName: String(data.groupName || 'Grupo A'),
        logrosAnteriores: typeof data.logrosAnteriores === 'string' ? data.logrosAnteriores : undefined,
        createdByUid: typeof data.createdByUid === 'string' ? data.createdByUid : undefined,
      };
    });
  }

  if (playersRes.status === 'fulfilled') {
    result.players = playersRes.value.docs.map((d) => {
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
    });
  }

  if (matchesRes.status === 'fulfilled') {
    result.matches = matchesRes.value.docs.map((d) => {
      const data = d.data();
      return {
        id: String(data.id || d.id),
        disciplineId: data.disciplineId as DisciplineId,
        groupName: String(data.groupName || 'Grupo A'),
        fase: (data.fase as Match['fase']) || 'Grupos',
        jornada: Number(data.jornada) || 1,
        fecha: String(data.fecha || ''),
        hora: String(data.hora || ''),
        cancha: String(data.cancha || ''),
        homeTeamId: String(data.homeTeamId || ''),
        awayTeamId: String(data.awayTeamId || ''),
        homeScore: Number(data.homeScore) || 0,
        awayScore: Number(data.awayScore) || 0,
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
        refereeId: String(data.refereeId || ''),
        scoresheetValidation:
          data.scoresheetValidation && typeof data.scoresheetValidation === 'object'
            ? data.scoresheetValidation
            : undefined,
      };
    });
  }

  if (transfersRes.status === 'fulfilled') {
    result.transfers = transfersRes.value.docs.map((d) => {
      const data = d.data();
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
        estado: (data.estado as TransferRecord['estado']) || 'APROBADA',
        createdByUid: typeof data.createdByUid === 'string' ? data.createdByUid : undefined,
      };
    });
  }

  if (votesRes.status === 'fulfilled') {
    result.mvpVotes = votesRes.value.docs.map((d) => {
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
    });
  }

  if (photosRes.status === 'fulfilled') {
    result.photos = photosRes.value.docs
      .map((d) => {
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
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return result;
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

  if (user.role === 'admin') {
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
  updates: { favoriteTeamIds?: string[]; notificationsEnabled?: boolean; displayName?: string }
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
    await updateDoc(userRef, safeUpdate);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminUpdateFirestoreUserRole(params: {
  actorUid: string;
  targetUid: string;
  targetEmail: string;
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

    const adminDocRef = doc(db, 'admins', params.targetUid);
    if (params.nextRole === 'admin') {
      await setDoc(adminDocRef, {
        uid: params.targetUid,
        email: params.targetEmail.slice(0, 160),
        grantedBy: params.actorUid,
        createdAt: serverTimestamp(),
      });
    } else if (params.targetEmail.toLowerCase() !== BOOTSTRAPPED_ADMIN_EMAIL) {
      // Revoke from /admins registry if previously an admin
      const existingAdmin = await getDoc(adminDocRef);
      if (existingAdmin.exists()) {
        await deleteDoc(adminDocRef);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
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

export async function saveFirestoreDisciplineConfig(config: DisciplineFormatConfig): Promise<void> {
  const path = `configs/${config.disciplineId}`;
  try {
    const ref = doc(db, 'configs', config.disciplineId);
    const payload = {
      disciplineId: config.disciplineId,
      temporada: config.temporada.slice(0, 16),
      maxCupos: Math.max(2, Math.min(128, Math.trunc(config.maxCupos))),
      numGrupos: Math.max(1, Math.min(16, Math.trunc(config.numGrupos))),
      clasificadosPorGrupo: Math.max(1, Math.min(8, Math.trunc(config.clasificadosPorGrupo))),
      formatoPlayoff: config.formatoPlayoff,
      inscripcionesAbiertas: Boolean(config.inscripcionesAbiertas),
      transferenciasAbiertas: Boolean(config.transferenciasAbiertas),
      maxTransferenciasPorEquipo: Math.max(0, Math.min(10, Math.trunc(config.maxTransferenciasPorEquipo))),
      faseActual: config.faseActual,
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

export async function saveFirestoreTeam(team: Team, actorUid: string, isNew: boolean): Promise<void> {
  const path = `teams/${team.id}`;
  try {
    const ref = doc(db, 'teams', team.id);
    if (isNew) {
      const payload: Record<string, unknown> = {
        id: team.id,
        nombre: team.nombre.trim().slice(0, 120),
        sigla: team.sigla.trim().slice(0, 8),
        disciplineId: team.disciplineId,
        carrera: team.carrera.trim().slice(0, 140),
        facultad: team.facultad.trim().slice(0, 140),
        groupName: team.groupName.trim().slice(0, 40),
        createdByUid: actorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (team.logrosAnteriores) {
        payload.logrosAnteriores = team.logrosAnteriores.trim().slice(0, 160);
      }
      await setDoc(ref, payload);
    } else {
      const updatePayload: Record<string, unknown> = {
        nombre: team.nombre.trim().slice(0, 120),
        sigla: team.sigla.trim().slice(0, 8),
        carrera: team.carrera.trim().slice(0, 140),
        facultad: team.facultad.trim().slice(0, 140),
        groupName: team.groupName.trim().slice(0, 40),
        updatedAt: serverTimestamp(),
      };
      if (team.logrosAnteriores !== undefined) {
        updatePayload.logrosAnteriores = team.logrosAnteriores.trim().slice(0, 160);
      }
      await updateDoc(ref, updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function saveFirestorePlayer(
  player: Player,
  isNew: boolean,
  actorRole: UserRole
): Promise<void> {
  const pubPath = `players/${player.id}`;
  const privPath = `player_private/${player.id}`;
  try {
    const pubRef = doc(db, 'players', player.id);
    if (isNew) {
      await setDoc(pubRef, {
        id: player.id,
        teamId: player.teamId,
        disciplineId: player.disciplineId,
        dorsal: Math.max(0, Math.min(99, Math.trunc(player.dorsal))),
        posicion: player.posicion.trim().slice(0, 60),
        nombre: player.nombre.trim().slice(0, 80),
        apellidoPaterno: player.apellidoPaterno.trim().slice(0, 80),
        apellidoMaterno: player.apellidoMaterno.trim().slice(0, 80),
        carrera: player.carrera.trim().slice(0, 140),
        facultad: player.facultad.trim().slice(0, 140),
        nivelAcademico: player.nivelAcademico,
        fotografia: (player.fotografia || '').slice(0, 159000),
        esSeleccionadoUfro: Boolean(player.esSeleccionadoUfro),
        stats: sanitizeStats(player.stats),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const pubUpdate: Record<string, unknown> = {
        dorsal: Math.max(0, Math.min(99, Math.trunc(player.dorsal))),
        posicion: player.posicion.trim().slice(0, 60),
        nombre: player.nombre.trim().slice(0, 80),
        apellidoPaterno: player.apellidoPaterno.trim().slice(0, 80),
        apellidoMaterno: player.apellidoMaterno.trim().slice(0, 80),
        carrera: player.carrera.trim().slice(0, 140),
        facultad: player.facultad.trim().slice(0, 140),
        nivelAcademico: player.nivelAcademico,
        fotografia: (player.fotografia || '').slice(0, 159000),
        updatedAt: serverTimestamp(),
      };
      if (actorRole === 'admin' || actorRole === 'delegado') {
        pubUpdate.esSeleccionadoUfro = Boolean(player.esSeleccionadoUfro);
      }
      if (actorRole === 'admin') {
        pubUpdate.teamId = player.teamId;
        pubUpdate.stats = sanitizeStats(player.stats);
      }
      await updateDoc(pubRef, pubUpdate);
    }

    // Write isolated student PII only when all 4 PII fields are present
    if (
      player.rut.trim().length >= 7 &&
      player.numeroMatricula.trim().length >= 4 &&
      player.correoInstitucional.trim().length >= 5 &&
      player.fechaNacimiento.trim().length >= 8
    ) {
      const privRef = doc(db, 'player_private', player.id);
      const privPayload = {
        playerId: player.id,
        teamId: player.teamId,
        rut: player.rut.trim().slice(0, 20),
        numeroMatricula: player.numeroMatricula.trim().slice(0, 30),
        correoInstitucional: player.correoInstitucional.trim().slice(0, 160),
        fechaNacimiento: player.fechaNacimiento.trim().slice(0, 20),
        updatedAt: serverTimestamp(),
      };
      if (isNew) {
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
          await updateDoc(privRef, updatePriv);
        } else {
          await setDoc(privRef, privPayload);
        }
      }
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, `${pubPath} / ${privPath}`);
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

export async function saveFirestoreMatch(match: Match, isNew: boolean, actorRole: UserRole): Promise<void> {
  const path = `matches/${match.id}`;
  try {
    const ref = doc(db, 'matches', match.id);
    if (isNew) {
      const payload: Record<string, unknown> = {
        id: match.id,
        disciplineId: match.disciplineId,
        groupName: match.groupName.slice(0, 40),
        fase: match.fase,
        jornada: Math.max(1, Math.min(50, Math.trunc(match.jornada))),
        fecha: match.fecha.slice(0, 20),
        hora: match.hora.slice(0, 12),
        cancha: match.cancha.slice(0, 120),
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        homeScore: Math.max(0, Math.min(300, Math.trunc(match.homeScore))),
        awayScore: Math.max(0, Math.min(300, Math.trunc(match.awayScore))),
        status: match.status,
        periodLabel: match.periodLabel.slice(0, 60),
        clock: match.clock.slice(0, 24),
        periods: match.periods.slice(0, 10),
        fouls: { home: Math.trunc(match.fouls.home), away: Math.trunc(match.fouls.away) },
        timeouts: { home: Math.trunc(match.timeouts.home), away: Math.trunc(match.timeouts.away) },
        events: match.events.slice(0, 120),
        refereeId: (match.refereeId || '').slice(0, 128),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (match.scoresheetValidation) {
        payload.scoresheetValidation = match.scoresheetValidation;
      }
      await setDoc(ref, payload);
    } else {
      const updatePayload: Record<string, unknown> = {
        homeScore: Math.max(0, Math.min(300, Math.trunc(match.homeScore))),
        awayScore: Math.max(0, Math.min(300, Math.trunc(match.awayScore))),
        status: match.status,
        periodLabel: match.periodLabel.slice(0, 60),
        clock: match.clock.slice(0, 24),
        periods: match.periods.slice(0, 10),
        fouls: { home: Math.trunc(match.fouls.home), away: Math.trunc(match.fouls.away) },
        timeouts: { home: Math.trunc(match.timeouts.home), away: Math.trunc(match.timeouts.away) },
        events: match.events.slice(0, 120),
        updatedAt: serverTimestamp(),
      };
      if (match.scoresheetValidation) {
        updatePayload.scoresheetValidation = match.scoresheetValidation;
      }
      if (actorRole === 'admin') {
        updatePayload.groupName = match.groupName.slice(0, 40);
        updatePayload.fase = match.fase;
        updatePayload.jornada = Math.max(1, Math.min(50, Math.trunc(match.jornada)));
        updatePayload.fecha = match.fecha.slice(0, 20);
        updatePayload.hora = match.hora.slice(0, 12);
        updatePayload.cancha = match.cancha.slice(0, 120);
        updatePayload.homeTeamId = match.homeTeamId;
        updatePayload.awayTeamId = match.awayTeamId;
        updatePayload.refereeId = (match.refereeId || '').slice(0, 128);
      }
      await updateDoc(ref, updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
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

export async function executeFirestoreTransfer(
  transfer: TransferRecord,
  actorUid: string
): Promise<void> {
  const transferPath = `transfers/${transfer.id}`;
  try {
    await updateDoc(doc(db, 'players', transfer.playerId), {
      teamId: transfer.toTeamId,
      updatedAt: serverTimestamp(),
    });
    // Also update teamId in isolated private PII doc if present
    try {
      const privRef = doc(db, 'player_private', transfer.playerId);
      const privSnap = await getDoc(privRef);
      if (privSnap.exists()) {
        await updateDoc(privRef, {
          teamId: transfer.toTeamId,
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Non-fatal if private record is restricted
    }

    await setDoc(doc(db, 'transfers', transfer.id), {
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
      estado: transfer.estado,
      createdByUid: actorUid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, transferPath);
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

    await setDoc(doc(db, 'photos', photo.id), payload);
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
