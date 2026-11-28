import type {
  AppUserProfile,
  DisciplineId,
  Player,
  Team,
  TransferRecord,
  UserRole,
} from '../types/tournament';

export const PRIMARY_ADMIN_EMAILS = new Set<string>([
  'a.sotomillapan@gmail.com',
]);

export const VALID_DISCIPLINE_IDS = new Set<DisciplineId>([
  'f7-h-1',
  'f7-h-2',
  'f7-h-3',
  'f7-m',
  'basquet-h',
  'basquet-3x3-m',
  'voley-m',
  'voley-h',
]);

export const VALID_USER_ROLES = new Set<UserRole>([
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
]);

export function isValidDisciplineId(value: unknown): value is DisciplineId {
  return typeof value === 'string' && VALID_DISCIPLINE_IDS.has(value as DisciplineId);
}

export function isValidUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && VALID_USER_ROLES.has(value as UserRole);
}

export function isValidEntityId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 160;
}

/**
 * Strips diacritics, lowercases, and collapses whitespace so Turso LIKE queries
 * match regardless of accents or capitalization.
 */
export function normalizeSearchText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildPlayerSearchText(
  player: Pick<
    Player,
    'nombre' | 'apellidoPaterno' | 'apellidoMaterno' | 'carrera' | 'posicion' | 'dorsal'
  >
): string {
  const parts = [
    player.nombre || '',
    player.apellidoPaterno || '',
    player.apellidoMaterno || '',
    player.carrera || '',
    player.posicion || '',
    String(player.dorsal ?? ''),
  ];
  return normalizeSearchText(parts.join(' '));
}

/**
 * Strips private contact info from Team before returning in any public API route.
 */
export function stripTeamPrivateFields(team: Team): Team {
  const copy: Team = { ...team };
  delete copy.capitanCorreo;
  return copy;
}

/**
 * Guarantees student PII is never exposed on public player queries.
 */
export function stripPlayerPii(player: Player): Player {
  return {
    ...player,
    rut: '',
    numeroMatricula: '',
    correoInstitucional: '',
    fechaNacimiento: '',
  };
}

export function isAdminOrModeratorRole(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'moderador';
}

export function isPressOrAdminRole(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'moderador' || role === 'prensa';
}

export function isPhotographerOrPressOrAdminRole(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'moderador' || role === 'prensa' || role === 'fotografo';
}

export function isRefereeOrAdminRole(role: UserRole | null | undefined): boolean {
  return (
    role === 'admin' ||
    role === 'moderador' ||
    role === 'arbitro' ||
    role === 'jefe_arbitros_futbol' ||
    role === 'jefe_arbitros_basquetbol' ||
    role === 'jefe_arbitros_voleibol'
  );
}

/**
 * Resolves the authoritative role on sign-in. Primary admin email is always
 * promoted to 'admin' if not already set; other users keep their stored role
 * or start as 'tradicional'.
 */
export function resolveBootstrapRole(email: string, existingRole?: UserRole): UserRole {
  const normalized = email.trim().toLowerCase();
  if (PRIMARY_ADMIN_EMAILS.has(normalized)) {
    return 'admin';
  }
  if (existingRole && isValidUserRole(existingRole)) {
    return existingRole;
  }
  return 'tradicional';
}

export function canActorReadPlayerPii(
  actor: Pick<AppUserProfile, 'role' | 'delegatedTeamId' | 'linkedPlayerId'> | null,
  playerId: string,
  playerTeamId: string
): boolean {
  if (!actor) return false;
  if (isAdminOrModeratorRole(actor.role)) return true;
  if (actor.role === 'delegado' && actor.delegatedTeamId && actor.delegatedTeamId === playerTeamId) {
    return true;
  }
  if (actor.role === 'jugador' && actor.linkedPlayerId && actor.linkedPlayerId === playerId) {
    return true;
  }
  return false;
}

export function canActorEditPlayer(
  actor: Pick<AppUserProfile, 'role' | 'delegatedTeamId' | 'linkedPlayerId'> | null,
  targetPlayer: { id: string; teamId: string },
  isNew: boolean,
  registrationsOpenForDiscipline = false
): { allowed: boolean; restrictStatsAndTeam: boolean } {
  if (!actor) return { allowed: false, restrictStatsAndTeam: true };
  if (isAdminOrModeratorRole(actor.role)) {
    return { allowed: true, restrictStatsAndTeam: false };
  }
  if (
    actor.role === 'delegado' &&
    actor.delegatedTeamId &&
    actor.delegatedTeamId === targetPlayer.teamId
  ) {
    return { allowed: true, restrictStatsAndTeam: true };
  }
  if (isNew && registrationsOpenForDiscipline) {
    return { allowed: true, restrictStatsAndTeam: true };
  }
  if (
    !isNew &&
    actor.role === 'jugador' &&
    actor.linkedPlayerId &&
    actor.linkedPlayerId === targetPlayer.id
  ) {
    return { allowed: true, restrictStatsAndTeam: true };
  }
  return { allowed: false, restrictStatsAndTeam: true };
}

export function canActorManageTransfer(
  actor: Pick<AppUserProfile, 'role' | 'delegatedTeamId'> | null,
  transfer: Pick<TransferRecord, 'fromTeamId' | 'toTeamId'>
): boolean {
  if (!actor) return false;
  if (isAdminOrModeratorRole(actor.role)) return true;
  if (
    actor.role === 'delegado' &&
    actor.delegatedTeamId &&
    (actor.delegatedTeamId === transfer.fromTeamId || actor.delegatedTeamId === transfer.toTeamId)
  ) {
    return true;
  }
  return false;
}

function sanitizeEnvSecret(value: string | undefined): string {
  if (!value) return '';
  return value.trim().replace(/^['"]+|['"]+$/g, '').trim();
}

/**
 * Resolves Turso libSQL connection credentials from server environment variables,
 * stripping accidental surrounding quotes and supporting standard Turso/libSQL aliases.
 */
export function resolveTursoCredentialsFromEnv(
  env: Record<string, string | undefined>
): { url: string; authToken: string } {
  const directUrl =
    sanitizeEnvSecret(env.TURSO_DATABASE_URL) ||
    sanitizeEnvSecret(env.TURSO_DB_URL) ||
    sanitizeEnvSecret(env.LIBSQL_URL);

  const fallbackDbUrl = sanitizeEnvSecret(env.DATABASE_URL);
  const isFallbackLibsql =
    fallbackDbUrl.startsWith('libsql://') ||
    fallbackDbUrl.includes('.turso.io');

  const url = directUrl || (isFallbackLibsql ? fallbackDbUrl : '');
  const authToken =
    sanitizeEnvSecret(env.TURSO_AUTH_TOKEN) ||
    sanitizeEnvSecret(env.LIBSQL_AUTH_TOKEN) ||
    sanitizeEnvSecret(env.TURSO_TOKEN);

  return { url, authToken };
}

