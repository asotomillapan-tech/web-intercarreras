import type {
  AppUserProfile,
  DisciplineId,
  Match,
  MvpVoteRecord,
  Player,
  Team,
  UserNotification,
  UserRole,
} from '../types/tournament';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'a.sotomillapan@gmail.com';

export type RefereeChiefRole =
  | 'jefe_arbitros_futbol'
  | 'jefe_arbitros_basquetbol'
  | 'jefe_arbitros_voleibol';

export type OfficialPanelId = 'general' | 'prensa' | 'arbitraje';

export const REFEREE_CHIEF_DISCIPLINES: Record<RefereeChiefRole, DisciplineId[]> = {
  jefe_arbitros_futbol: ['f7-h-1', 'f7-h-2', 'f7-h-3', 'f7-m'],
  jefe_arbitros_basquetbol: ['basquet-h', 'basquet-3x3-m'],
  jefe_arbitros_voleibol: ['voley-m', 'voley-h'],
};

export const ALL_DISCIPLINE_IDS_RBAC: DisciplineId[] = [
  'f7-h-1',
  'f7-h-2',
  'f7-h-3',
  'f7-m',
  'basquet-h',
  'basquet-3x3-m',
  'voley-m',
  'voley-h',
];

export const ALL_USER_ROLES: UserRole[] = [
  'tradicional',
  'jugador',
  'delegado',
  'arbitro',
  'jefe_arbitros_futbol',
  'jefe_arbitros_basquetbol',
  'jefe_arbitros_voleibol',
  'fotografo',
  'prensa',
  'moderador',
  'admin',
];

export const ROLE_META: Record<
  UserRole,
  {
    label: string;
    shortLabel: string;
    description: string;
    permissions: string[];
  }
> = {
  tradicional: {
    label: 'Usuario Tradicional',
    shortLabel: 'Tradicional',
    description:
      'Acceso público al campeonato, guardado de equipos favoritos con notificaciones y votación de MVP durante encuentros.',
    permissions: [
      'Guardar equipos en favoritos y recibir alertas de resultados',
      'Votar por el MVP durante el horario programado de cada partido',
      'Explorar tablas, jugadores y galería fotográfica',
    ],
  },
  jugador: {
    label: 'Jugador UFRO',
    shortLabel: 'Jugador',
    description:
      'Deportista inscrito con permiso para editar y mantener actualizados sus propios datos estudiantiles oficiales.',
    permissions: [
      'Editar los 12 campos de su propia ficha oficial UFRO',
      'Guardar equipos favoritos y votar MVP en partidos en juego',
      'Visualizar sus estadísticas y nómina de su equipo',
    ],
  },
  delegado: {
    label: 'Delegado de Equipo',
    shortLabel: 'Delegado',
    description:
      'Representante oficial de equipo habilitado para inscribir nóminas, modificar jugadores de su plantel y gestionar transferencias.',
    permissions: [
      'Inscribir equipos y administrar cupos de su disciplina',
      'Modificar datos de los jugadores de su plantel asignado',
      'Ejecutar transferencias oficiales al término de la fase de grupos',
    ],
  },
  arbitro: {
    label: 'Árbitro Oficial',
    shortLabel: 'Árbitro',
    description:
      'Oficial de mesa con acceso exclusivo a los partidos designados por su Jefatura de Arbitraje para operar marcador, asistencia y planilla.',
    permissions: [
      'Visualizar y dirigir únicamente los partidos designados a su cuenta',
      'Pasar asistencia con dorsales rotativos por partido y registrar eventos',
      'Subir planilla física para validación con IA o cierre oficial',
    ],
  },
  jefe_arbitros_futbol: {
    label: 'Jefe de Árbitros · Fútbol 7',
    shortLabel: 'Jefe F7',
    description:
      'Jefatura arbitral para todas las categorías de Fútbol 7 (1ª, 2ª, 3ª División Hombres y Mujeres). Designa árbitros y supervisa la mesa.',
    permissions: [
      'Designar árbitros a todos los partidos de Fútbol 7 (todas las categorías)',
      'Visualizar y operar la Mesa Arbitral en todos los encuentros de Fútbol 7',
      'Registrar definiciones por penales y validar planillas oficiales',
    ],
  },
  jefe_arbitros_basquetbol: {
    label: 'Jefe de Árbitros · Básquetbol',
    shortLabel: 'Jefe Básquet',
    description:
      'Jefatura arbitral unificada para Básquetbol Hombres 5x5 y Básquetbol 3x3 Mujeres. Designa árbitros y supervisa la mesa.',
    permissions: [
      'Designar árbitros en Básquetbol 5x5 Hombres y Básquetbol 3x3 Mujeres',
      'Visualizar y operar la Mesa Arbitral en ambas categorías de Básquetbol',
      'Validar planillas y controlar incidencias de mesa',
    ],
  },
  jefe_arbitros_voleibol: {
    label: 'Jefe de Árbitros · Voleibol',
    shortLabel: 'Jefe Vóley',
    description:
      'Jefatura arbitral unificada para Voleibol Mujeres y Voleibol Hombres. Designa árbitros y supervisa la mesa.',
    permissions: [
      'Designar árbitros en Voleibol Mujeres y Voleibol Hombres',
      'Visualizar y operar la Mesa Arbitral en ambas categorías de Voleibol',
      'Validar sets, puntos y actas de cierre de partido',
    ],
  },
  fotografo: {
    label: 'Fotógrafo Oficial',
    shortLabel: 'Fotógrafo',
    description:
      'Fotógrafo acreditado con acceso al Panel de Prensa para gestionar la galería oficial y subir fotografías por disciplina.',
    permissions: [
      'Acceder al Panel de Prensa (módulo Galería y Fotografía)',
      'Subir y catalogar fotografías oficiales por disciplina y partido',
      'Administrar sus publicaciones y carpetas de Google Drive',
    ],
  },
  prensa: {
    label: 'Prensa Oficial',
    shortLabel: 'Prensa',
    description:
      'Equipo de comunicaciones acreditado con acceso al Panel de Prensa para redactar, editar y publicar noticias y anuncios.',
    permissions: [
      'Acceder al Panel de Prensa (módulo Noticias y Comunicados)',
      'Crear, editar y publicar anuncios y noticias destacadas en portada',
      'Generar borradores automáticos a partir de los resultados',
    ],
  },
  moderador: {
    label: 'Moderador General',
    shortLabel: 'Moderador',
    description:
      'Gestión integral del campeonato en Administración General: partidos, jugadores, equipos, períodos, formatos, votaciones, usuarios y Google Sheets.',
    permissions: [
      'Revisar y editar partidos, jugadores, equipos, períodos y formatos',
      'Configurar votaciones MVP/TOTY y sincronizar Google Sheets',
      'Gestionar roles de usuarios operativos y contenido de prensa',
    ],
  },
  admin: {
    label: 'Administrador UFRO',
    shortLabel: 'Admin',
    description:
      'Control total del campeonato en todos los paneles: Administración General, Panel de Prensa y Panel de Arbitraje.',
    permissions: [
      'Acceso irrestricto a Administración General, Prensa y Arbitraje',
      'Asignar cualquier rol (incluyendo Moderadores y Jefes de Árbitros)',
      'Edición y eliminación masiva de equipos, partidos, jugadores y formato',
    ],
  },
};

export function isRefereeChiefRole(role: UserRole | undefined | null): role is RefereeChiefRole {
  return (
    role === 'jefe_arbitros_futbol' ||
    role === 'jefe_arbitros_basquetbol' ||
    role === 'jefe_arbitros_voleibol'
  );
}

export function isRefereeOrChiefRole(role: UserRole | undefined | null): boolean {
  return role === 'arbitro' || isRefereeChiefRole(role);
}

export function isAdminOrModerator(user: AppUserProfile | null): boolean {
  return user?.role === 'admin' || user?.role === 'moderador';
}

export function isRefereeChief(user: AppUserProfile | null): boolean {
  return isRefereeChiefRole(user?.role);
}

export function getRefereeChiefDisciplines(user: AppUserProfile | null): DisciplineId[] {
  if (!user) return [];
  if (user.role === 'admin') return ALL_DISCIPLINE_IDS_RBAC;
  if (isRefereeChiefRole(user.role)) {
    return REFEREE_CHIEF_DISCIPLINES[user.role];
  }
  return [];
}

export function canAccessGeneralAdminPanel(user: AppUserProfile | null): boolean {
  return isAdminOrModerator(user);
}

export function canAccessPressPanel(user: AppUserProfile | null): boolean {
  return isAdminOrModerator(user) || user?.role === 'prensa' || user?.role === 'fotografo';
}

export function canAccessRefereePanel(user: AppUserProfile | null): boolean {
  return user?.role === 'admin' || isRefereeChief(user) || user?.role === 'arbitro';
}

export function getAccessibleOfficialPanels(user: AppUserProfile | null): OfficialPanelId[] {
  const panels: OfficialPanelId[] = [];
  if (canAccessGeneralAdminPanel(user)) panels.push('general');
  if (canAccessPressPanel(user)) panels.push('prensa');
  if (canAccessRefereePanel(user)) panels.push('arbitraje');
  return panels;
}

export function getOfficialPanelButtonLabel(user: AppUserProfile | null): string {
  if (!user) return 'Panel';
  if (user.role === 'prensa' || user.role === 'fotografo') return 'Prensa';
  if (user.role === 'arbitro' || isRefereeChiefRole(user.role)) return 'Arbitraje';
  return 'Panel';
}

export function canManageRoles(user: AppUserProfile | null): boolean {
  return isAdminOrModerator(user);
}

export function canManageNews(user: AppUserProfile | null): boolean {
  return isAdminOrModerator(user) || user?.role === 'prensa';
}

export function canAccessAdminPanel(user: AppUserProfile | null): boolean {
  return (
    canAccessGeneralAdminPanel(user) ||
    canAccessPressPanel(user) ||
    canAccessRefereePanel(user)
  );
}

export function canRefereeMatches(user: AppUserProfile | null): boolean {
  return user?.role === 'admin' || isRefereeChief(user) || user?.role === 'arbitro';
}

export function canAssignReferees(user: AppUserProfile | null): boolean {
  return user?.role === 'admin' || isRefereeChief(user);
}

export function canAssignRefereesForDiscipline(
  user: AppUserProfile | null,
  disciplineId: DisciplineId
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (isRefereeChiefRole(user.role)) {
    return REFEREE_CHIEF_DISCIPLINES[user.role].includes(disciplineId);
  }
  return false;
}

export function canViewMatchInRefereeDesk(
  user: AppUserProfile | null,
  match: Pick<Match, 'disciplineId' | 'assignedRefereeUid' | 'refereeId'>
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (isRefereeChiefRole(user.role)) {
    return REFEREE_CHIEF_DISCIPLINES[user.role].includes(match.disciplineId);
  }
  if (user.role === 'arbitro') {
    return match.assignedRefereeUid === user.uid || match.refereeId === user.uid;
  }
  return false;
}

export function canEditMatchInRefereeDesk(
  user: AppUserProfile | null,
  match: Pick<Match, 'disciplineId' | 'assignedRefereeUid' | 'refereeId' | 'status'>
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (isRefereeChiefRole(user.role)) {
    return REFEREE_CHIEF_DISCIPLINES[user.role].includes(match.disciplineId);
  }
  if (user.role === 'arbitro') {
    return (
      (match.assignedRefereeUid === user.uid || match.refereeId === user.uid) &&
      match.status !== 'FINALIZADO'
    );
  }
  return false;
}

export function canManageFormatAndSheets(user: AppUserProfile | null): boolean {
  return isAdminOrModerator(user);
}

export function canManageRegistrationsAndTransfers(user: AppUserProfile | null): boolean {
  return isAdminOrModerator(user) || user?.role === 'delegado';
}

export function canAccessDelegateTransfers(user: AppUserProfile | null): boolean {
  return user?.role === 'delegado';
}

export function canUploadPhotos(user: AppUserProfile | null): boolean {
  return isAdminOrModerator(user) || user?.role === 'fotografo';
}

export function canEditPlayerProfile(user: AppUserProfile | null, player: Player): boolean {
  if (!user) return false;
  if (isAdminOrModerator(user)) return true;
  if (user.role === 'delegado') {
    if (!user.delegatedTeamId) return false;
    return player.teamId === user.delegatedTeamId;
  }
  if (user.role === 'jugador') {
    if (user.linkedPlayerId && user.linkedPlayerId === player.id) return true;
    return player.correoInstitucional.toLowerCase() === user.email.toLowerCase();
  }
  return false;
}

export function canEditTeamRoster(user: AppUserProfile | null, teamId: string): boolean {
  if (!user) return false;
  if (isAdminOrModerator(user)) return true;
  if (user.role === 'delegado') {
    return Boolean(user.delegatedTeamId && user.delegatedTeamId === teamId);
  }
  return false;
}

export function canDeletePhoto(
  user: AppUserProfile | null,
  photographerUid: string
): boolean {
  if (!user) return false;
  if (isAdminOrModerator(user)) return true;
  return user.role === 'fotografo' && user.uid === photographerUid;
}

/**
 * Championship Match Visibility Rule:
 * Public match scores, period breakdowns, and stats are ONLY revealed once the match finishes.
 * Referees and Admins continue seeing real-time data inside the private Mesa Arbitral console.
 */
export function shouldRevealPublicMatchData(match: Pick<Match, 'status'>): boolean {
  return match.status === 'FINALIZADO';
}

/**
 * MVP Voting Window Rule:
 * During the scheduled match hour (status === 'EN_VIVO'), ALL users regardless of role can vote for MVP.
 */
export function canVoteMatchMvp(match: Pick<Match, 'status'>): boolean {
  return match.status === 'EN_VIVO';
}

export interface MvpCandidateTally {
  playerId: string;
  playerName: string;
  teamId: string;
  votes: number;
  percentage: number;
}

export function computeMatchMvpStandings(
  matchId: string,
  votes: MvpVoteRecord[]
): { totalVotes: number; candidates: MvpCandidateTally[]; winner: MvpCandidateTally | null } {
  const matchVotes = votes.filter((v) => v.matchId === matchId);
  const totalVotes = matchVotes.length;
  const counts = new Map<
    string,
    { playerId: string; playerName: string; teamId: string; votes: number }
  >();

  for (const vote of matchVotes) {
    const existing = counts.get(vote.playerId);
    if (existing) {
      existing.votes += 1;
    } else {
      counts.set(vote.playerId, {
        playerId: vote.playerId,
        playerName: vote.playerName,
        teamId: vote.teamId,
        votes: 1,
      });
    }
  }

  const candidates: MvpCandidateTally[] = Array.from(counts.values())
    .map((entry) => ({
      ...entry,
      percentage: totalVotes > 0 ? Math.round((entry.votes / totalVotes) * 100) : 0,
    }))
    .sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      return a.playerName.localeCompare(b.playerName, 'es');
    });

  return {
    totalVotes,
    candidates,
    winner: candidates[0] ?? null,
  };
}

/**
 * Generates actionable notifications for a user's favorite teams:
 * - Active MVP voting windows during scheduled match hour
 * - Newly finalized match results (with MVP winner if voted)
 * - Upcoming scheduled fixtures
 */
export function buildFavoriteNotifications(
  user: AppUserProfile | null,
  matches: Match[],
  teams: Team[],
  mvpVotes: MvpVoteRecord[]
): UserNotification[] {
  if (!user || !user.notificationsEnabled || user.favoriteTeamIds.length === 0) {
    return [];
  }

  const favSet = new Set(user.favoriteTeamIds);
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const notifications: UserNotification[] = [];

  for (const match of matches) {
    const homeFav = favSet.has(match.homeTeamId);
    const awayFav = favSet.has(match.awayTeamId);
    if (!homeFav && !awayFav) continue;

    const favTeamId = homeFav ? match.homeTeamId : match.awayTeamId;
    const favTeam = teamMap.get(favTeamId);
    const homeName = teamMap.get(match.homeTeamId)?.nombre ?? match.homeTeamId;
    const awayName = teamMap.get(match.awayTeamId)?.nombre ?? match.awayTeamId;

    if (match.status === 'EN_VIVO') {
      notifications.push({
        id: `notif-mvp-${match.id}`,
        type: 'VOTACION_MVP',
        teamId: favTeamId,
        teamName: favTeam?.nombre ?? favTeamId,
        matchId: match.id,
        title: `Votación MVP abierta · ${favTeam?.nombre ?? favTeamId}`,
        detail: `${homeName} vs ${awayName} está en su horario programado (${match.hora}). El marcador oficial se publicará al terminar, pero ya puedes votar por el MVP.`,
        createdAt: match.fecha,
        isLiveMvp: true,
      });
    } else if (match.status === 'FINALIZADO') {
      const mvp = computeMatchMvpStandings(match.id, mvpVotes).winner;
      notifications.push({
        id: `notif-res-${match.id}`,
        type: 'RESULTADO',
        teamId: favTeamId,
        teamName: favTeam?.nombre ?? favTeamId,
        matchId: match.id,
        title: `Resultado oficial publicado · ${favTeam?.nombre ?? favTeamId}`,
        detail: `${homeName} ${match.homeScore} - ${match.awayScore} ${awayName}${mvp ? ` · MVP: ${mvp.playerName}` : ''}.`,
        createdAt: match.scoresheetValidation?.validatedAt ?? match.fecha,
      });
    } else {
      notifications.push({
        id: `notif-prog-${match.id}`,
        type: 'PROXIMO_ENCUENTRO',
        teamId: favTeamId,
        teamName: favTeam?.nombre ?? favTeamId,
        matchId: match.id,
        title: `Próximo partido · ${favTeam?.nombre ?? favTeamId}`,
        detail: `${homeName} vs ${awayName} · ${match.fecha} a las ${match.hora} en ${match.cancha}.`,
        createdAt: match.fecha,
      });
    }
  }

  const priority = (t: UserNotification['type']) =>
    t === 'VOTACION_MVP' ? 0 : t === 'RESULTADO' ? 1 : 2;

  return notifications.sort((a, b) => priority(a.type) - priority(b.type)).slice(0, 15);
}

/**
 * Validates role changes:
 * - Admin can assign any role (except demoting the bootstrapped admin).
 * - Moderador can assign non-admin roles and cannot modify existing admins.
 */
export function validateRoleChange(
  actor: AppUserProfile | null,
  targetUser: AppUserProfile,
  nextRole: UserRole
): { allowed: boolean; error?: string } {
  if (!actor || (actor.role !== 'admin' && actor.role !== 'moderador')) {
    return {
      allowed: false,
      error: 'Solo un Administrador o Moderador puede modificar el rol de un usuario.',
    };
  }
  if (!ALL_USER_ROLES.includes(nextRole)) {
    return { allowed: false, error: 'Rol de usuario inválido.' };
  }
  if (
    targetUser.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL &&
    nextRole !== 'admin'
  ) {
    return {
      allowed: false,
      error: 'La cuenta administradora principal no puede perder su rol de Administrador.',
    };
  }
  if (actor.role === 'moderador' && (nextRole === 'admin' || targetUser.role === 'admin')) {
    return {
      allowed: false,
      error: 'Un Moderador no puede otorgar ni revocar el rol de Administrador.',
    };
  }
  return { allowed: true };
}
