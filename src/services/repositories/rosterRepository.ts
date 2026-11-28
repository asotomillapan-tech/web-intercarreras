import { PLAYERS_PREVIEW_LIMIT } from '../../domain/readOptimizationEngine';
import type {
  AppUserProfile,
  DisciplineId,
  Match,
  Player,
  PlayerStats,
  Team,
  TransferRecord,
  UserRole,
} from '../../types/tournament';
import { tursoRequest } from '../tursoApiClient';

export async function saveFirestoreTeam(
  team: Team,
  _actorUid: string,
  isNew: boolean,
  _actorRole?: UserRole,
  _upsertFromSync = false
): Promise<void> {
  await tursoRequest(`/teams/${encodeURIComponent(team.id)}`, {
    method: 'PUT',
    requiresAuth: true,
    body: { team, isNew },
  });
}

export async function bulkUpdateFirestoreTeams(params: {
  teams: Team[];
  actorUid: string;
  actorRole: UserRole;
  clearLogros?: boolean;
  clearAnioFundacion?: boolean;
  clubName?: string;
}): Promise<number> {
  if (params.teams.length === 0) return 0;
  const res = await tursoRequest<{ updatedCount: number }>('/teams/bulk', {
    method: 'POST',
    requiresAuth: true,
    body: {
      teams: params.teams,
      clearLogros: params.clearLogros,
      clearAnioFundacion: params.clearAnioFundacion,
      clubName: params.clubName,
    },
  });
  return res.updatedCount ?? 0;
}

export async function deleteFirestoreTeam(
  teamId: string,
  cascadeIds?: { playerIds?: string[]; matchIds?: string[] }
): Promise<void> {
  await tursoRequest(`/teams/${encodeURIComponent(teamId)}`, {
    method: 'DELETE',
    requiresAuth: true,
    body: cascadeIds,
  });
}

export async function fetchPlayersPreview(
  limitCount: number = PLAYERS_PREVIEW_LIMIT,
  disciplineId?: DisciplineId
): Promise<Player[]> {
  const qs = new URLSearchParams({ limit: String(limitCount) });
  if (disciplineId) qs.set('disciplineId', disciplineId);
  const res = await tursoRequest<{ players: Player[] }>(`/players/preview?${qs.toString()}`);
  return res.players ?? [];
}

export async function fetchPlayersByTeam(
  teamId: string,
  disciplineId?: DisciplineId
): Promise<Player[]> {
  if (!teamId.trim()) return [];
  const qs = disciplineId ? `?disciplineId=${encodeURIComponent(disciplineId)}` : '';
  const res = await tursoRequest<{ players: Player[] }>(
    `/players/by-team/${encodeURIComponent(teamId.trim())}${qs}`
  );
  return res.players ?? [];
}

export async function fetchPlayerById(playerId: string): Promise<Player | null> {
  if (!playerId.trim()) return null;
  const res = await tursoRequest<{ player: Player | null }>(
    `/players/${encodeURIComponent(playerId.trim())}`
  );
  return res.player ?? null;
}

export async function searchPlayersInFirestoreByName(
  rawQuery: string,
  disciplineId?: DisciplineId
): Promise<Player[]> {
  const cleaned = rawQuery.trim();
  if (cleaned.length < 2) return [];
  const qs = new URLSearchParams({ q: cleaned });
  if (disciplineId) qs.set('disciplineId', disciplineId);
  const res = await tursoRequest<{ players: Player[] }>(`/players/search?${qs.toString()}`);
  return res.players ?? [];
}

export async function fetchAllPlayersForAdmin(): Promise<Player[]> {
  const res = await tursoRequest<{ players: Player[] }>('/players/admin-all', {
    requiresAuth: true,
  });
  return res.players ?? [];
}

export async function loadAuthorizedPlayerPrivateMap(
  _user: AppUserProfile,
  _players: Player[]
): Promise<
  Record<
    string,
    { rut: string; numeroMatricula: string; correoInstitucional: string; fechaNacimiento: string }
  >
> {
  const res = await tursoRequest<{
    privateMap: Record<
      string,
      { rut: string; numeroMatricula: string; correoInstitucional: string; fechaNacimiento: string }
    >;
  }>('/players/private', {
    method: 'POST',
    requiresAuth: true,
    body: {},
  });
  return res.privateMap ?? {};
}

export async function saveFirestorePlayer(
  player: Player,
  isNew: boolean,
  _actorRole: UserRole,
  _upsertFromSync = false
): Promise<void> {
  await tursoRequest(`/players/${encodeURIComponent(player.id)}`, {
    method: 'PUT',
    requiresAuth: true,
    body: { player, isNew },
  });
}

export async function updateFirestorePlayerStats(
  playerId: string,
  stats: PlayerStats
): Promise<void> {
  await tursoRequest(`/players/${encodeURIComponent(playerId)}/stats`, {
    method: 'PATCH',
    requiresAuth: true,
    body: { stats },
  });
}

export async function deleteFirestorePlayer(playerId: string): Promise<void> {
  await tursoRequest(`/players/${encodeURIComponent(playerId)}`, {
    method: 'DELETE',
    requiresAuth: true,
  });
}

export async function saveFirestoreMatch(
  match: Match,
  isNew: boolean,
  _actorRole: UserRole,
  _upsertFromSync = false
): Promise<void> {
  await tursoRequest(`/matches/${encodeURIComponent(match.id)}`, {
    method: 'PUT',
    requiresAuth: true,
    body: { match, isNew },
  });
}

export async function deleteFirestoreMatchesForDiscipline(matchIds: string[]): Promise<void> {
  if (matchIds.length === 0) return;
  await tursoRequest('/matches/batch', {
    method: 'DELETE',
    requiresAuth: true,
    body: { matchIds },
  });
}

export async function fetchApprovedTransfersBounded(
  maxDocs: number = 60
): Promise<TransferRecord[]> {
  const res = await tursoRequest<{ transfers: TransferRecord[] }>(
    `/transfers/approved?limit=${maxDocs}`
  );
  return res.transfers ?? [];
}

export async function listDelegateFirestoreTransfers(
  delegatedTeamId: string
): Promise<TransferRecord[]> {
  const res = await tursoRequest<{ transfers: TransferRecord[] }>(
    `/transfers/delegate?teamId=${encodeURIComponent(delegatedTeamId)}`,
    { requiresAuth: true }
  );
  return res.transfers ?? [];
}

export async function listAllFirestoreTransfers(): Promise<TransferRecord[]> {
  const res = await tursoRequest<{ transfers: TransferRecord[] }>('/transfers/all', {
    requiresAuth: true,
  });
  return res.transfers ?? [];
}

export async function createFirestoreTransferRequest(
  transfer: TransferRecord,
  _actorUid: string
): Promise<void> {
  await tursoRequest('/transfers', {
    method: 'POST',
    requiresAuth: true,
    body: { transfer },
  });
}

export async function approveFirestoreTransferRequest(
  transfer: TransferRecord,
  _actorUid: string,
  _isFromDelegate: boolean
): Promise<void> {
  await tursoRequest(`/transfers/${encodeURIComponent(transfer.id)}/approve`, {
    method: 'PATCH',
    requiresAuth: true,
    body: { transfer },
  });
}

export async function rejectFirestoreTransferRequest(
  transferId: string,
  _actorUid: string
): Promise<void> {
  await tursoRequest(`/transfers/${encodeURIComponent(transferId)}/reject`, {
    method: 'PATCH',
    requiresAuth: true,
    body: {},
  });
}
