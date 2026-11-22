import type {
  AppUserProfile,
  Match,
  MvpVoteRecord,
  Player,
  Team,
  UserNotification,
  UserRole,
} from '../types/tournament';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'a.sotomillapan@gmail.com';

export const ALL_USER_ROLES: UserRole[] = [
  'tradicional',
  'jugador',
  'delegado',
  'arbitro',
  'fotografo',
  'prensa',
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
      'Explorar tablas, jugadores y galería fotográfica 2025/2026',
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
      'Oficial de mesa con acceso a la consola arbitral en tiempo real por disciplina, escaneo IA de planillas y validación manual.',
    permissions: [
      'Registrar marcadores e incidencias en la Mesa Arbitral',
      'Subir planilla física para validación con IA o cierre manual',
      'Publicar resultados oficiales al finalizar cada encuentro',
    ],
  },
  fotografo: {
    label: 'Fotógrafo Oficial',
    shortLabel: 'Fotógrafo',
    description:
      'Fotógrafo acreditado habilitado para subir fotografías por disciplina y encuentro a la base de datos web del campeonato.',
    permissions: [
      'Subir y catalogar fotografías oficiales por disciplina y partido',
      'Vincular y sincronizar álbumes desde Google Drive',
      'Administrar sus propias publicaciones en la galería',
    ],
  },
  prensa: {
    label: 'Prensa Oficial',
    shortLabel: 'Prensa',
    description:
      'Equipo de comunicaciones acreditado para redactar, editar, publicar anuncios destacados y generar noticias breves del campeonato.',
    permissions: [
      'Crear, editar y publicar anuncios y noticias destacadas en la portada',
      'Generar borradores de noticias breves automáticas a partir de los resultados',
      'Gestionar el módulo de Noticias del Campeonato en el Panel Oficial',
    ],
  },
  admin: {
    label: 'Administrador UFRO',
    shortLabel: 'Admin',
    description:
      'Control total del campeonato: revisión y modificación de datos, perfiles, noticias, formato anual, Google Sheets y asignación exclusiva de roles.',
    permissions: [
      'Cambiar el rol de cualquier usuario (incluyendo Prensa, Fotógrafo y Árbitro)',
      'Revisar y editar cualquier perfil, equipo, partido, noticia o fotografía',
      'Configurar formato anual, cupos, ventanas y sincronización Google Sheets',
    ],
  },
};

export function canManageRoles(user: AppUserProfile | null): boolean {
  return user?.role === 'admin';
}

export function canManageNews(user: AppUserProfile | null): boolean {
  return user?.role === 'admin' || user?.role === 'prensa';
}

export function canAccessAdminPanel(user: AppUserProfile | null): boolean {
  return user?.role === 'admin' || user?.role === 'arbitro' || user?.role === 'prensa';
}

export function canRefereeMatches(user: AppUserProfile | null): boolean {
  return user?.role === 'admin' || user?.role === 'arbitro';
}

export function canManageFormatAndSheets(user: AppUserProfile | null): boolean {
  return user?.role === 'admin';
}

export function canManageRegistrationsAndTransfers(user: AppUserProfile | null): boolean {
  return user?.role === 'admin' || user?.role === 'delegado';
}

export function canAccessDelegateTransfers(user: AppUserProfile | null): boolean {
  return user?.role === 'delegado';
}

export function canUploadPhotos(user: AppUserProfile | null): boolean {
  return user?.role === 'admin' || user?.role === 'fotografo';
}

export function canEditPlayerProfile(user: AppUserProfile | null, player: Player): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
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
  if (user.role === 'admin') return true;
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
  if (user.role === 'admin') return true;
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
 * Validates that only an Admin can change another user's role.
 */
export function validateRoleChange(
  actor: AppUserProfile | null,
  targetUser: AppUserProfile,
  nextRole: UserRole
): { allowed: boolean; error?: string } {
  if (!actor || actor.role !== 'admin') {
    return {
      allowed: false,
      error: 'Solo un Administrador UFRO puede modificar el rol de un usuario.',
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
  return { allowed: true };
}
