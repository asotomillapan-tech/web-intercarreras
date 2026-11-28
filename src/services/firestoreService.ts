import type { User } from 'firebase/auth';
import type { PublicRealtimeStreamKey } from '../domain/realtimeSyncEngine';
import { PLAYERS_PREVIEW_LIMIT } from '../domain/readOptimizationEngine';
import { sanitizeTotySelections, type TotyBallotBatchItem } from '../domain/totyBatchQueue';
import type {
  AppUserProfile,
  ChampionshipMvpVoteRecord,
  DisciplineFormatConfig,
  DisciplineId,
  DisciplineTotyConfig,
  HomeFeaturedConfig,
  LeyendasLeaderboardEntry,
  MasterSheetsConfig,
  Match,
  MvpVoteRecord,
  NewsArticle,
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
import { tursoRequest } from './tursoApiClient';

export interface CorePublicFetchReport {
  settings?: Partial<TournamentState>;
  configs?: Record<DisciplineId, DisciplineFormatConfig>;
  teams?: Team[];
  matches?: Match[];
  settledStreams: PublicRealtimeStreamKey[];
  errors: Array<{ stream: PublicRealtimeStreamKey; error: unknown }>;
}

// ---------------------------------------------------------------------------
// 1. Core Public Tournament Snapshot (Turso libSQL via /api/db/core)
// ---------------------------------------------------------------------------

export async function fetchCorePublicTournamentSnapshot(): Promise<CorePublicFetchReport> {
  try {
    const res = await tursoRequest<{
      settings?: Partial<TournamentState>;
      configs?: Record<DisciplineId, DisciplineFormatConfig>;
      teams?: Team[];
      matches?: Match[];
    }>('/core');

    return {
      settings: res.settings ?? {},
      configs: res.configs,
      teams: res.teams ?? [],
      matches: res.matches ?? [],
      settledStreams: ['settings', 'configs', 'teams', 'matches'],
      errors: [],
    };
  } catch (error) {
    return {
      settledStreams: [],
      errors: [{ stream: 'teams', error }],
    };
  }
}

// ---------------------------------------------------------------------------
// 2. Auth Profile, Preferences, Users & Referee Roster
// ---------------------------------------------------------------------------

export async function syncGoogleUserToFirestore(user: User): Promise<AppUserProfile> {
  const res = await tursoRequest<{ profile: AppUserProfile }>('/auth/sync', {
    method: 'POST',
    requiresAuth: true,
    body: {
      displayName: user.displayName || user.email?.split('@')[0] || 'Usuario UFRO',
      photoURL: user.photoURL || undefined,
    },
  });
  return res.profile;
}

export async function updateFirestoreUserPreferences(
  _uid: string,
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
  await tursoRequest('/auth/preferences', {
    method: 'PATCH',
    requiresAuth: true,
    body: updates,
  });
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
  await tursoRequest(`/users/${encodeURIComponent(params.targetUid)}/role`, {
    method: 'PATCH',
    requiresAuth: true,
    body: {
      role: params.nextRole,
      delegatedTeamId: params.delegatedTeamId,
      linkedPlayerId: params.linkedPlayerId,
    },
  });
}

export async function listFirestoreUsers(): Promise<AppUserProfile[]> {
  const res = await tursoRequest<{ users: AppUserProfile[] }>('/users', {
    requiresAuth: true,
  });
  return res.users ?? [];
}

export async function listFirestoreRefereeRoster(): Promise<RefereeRosterEntry[]> {
  try {
    const res = await tursoRequest<{ roster: RefereeRosterEntry[] }>('/referee-roster', {
      requiresAuth: true,
    });
    return res.roster ?? [];
  } catch {
    return [];
  }
}

export async function syncRefereeRosterFromUsers(_users: AppUserProfile[]): Promise<void> {
  // Turso resolves the referee roster directly from the indexed `users` table (zero duplication needed).
}

// ---------------------------------------------------------------------------
// 3. Tournament Settings & Discipline Configs
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
  await tursoRequest('/settings', {
    method: 'PUT',
    requiresAuth: true,
    body: settings,
  });
}

export async function saveFirestoreDisciplineConfig(config: DisciplineFormatConfig): Promise<void> {
  await tursoRequest(`/configs/${encodeURIComponent(config.disciplineId)}`, {
    method: 'PUT',
    requiresAuth: true,
    body: config,
  });
}

export async function ensureAllConfigsInFirestore(
  configs: Record<DisciplineId, DisciplineFormatConfig>
): Promise<void> {
  await tursoRequest('/configs/ensure', {
    method: 'POST',
    requiresAuth: true,
    body: { configs },
  });
}

// ---------------------------------------------------------------------------
// 4. Teams & Players (Public + Isolated Private PII)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 5. Matches
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 6. Transfers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 7. News & Photos
// ---------------------------------------------------------------------------

export async function fetchPublicNewsBounded(maxDocs: number = 25): Promise<NewsArticle[]> {
  const res = await tursoRequest<{ news: NewsArticle[] }>(`/news?limit=${maxDocs}`);
  return res.news ?? [];
}

export async function listAllFirestoreNews(): Promise<NewsArticle[]> {
  const res = await tursoRequest<{ news: NewsArticle[] }>('/news/all', {
    requiresAuth: true,
  });
  return res.news ?? [];
}

export async function saveFirestoreNewsArticle(
  article: NewsArticle,
  isNew: boolean
): Promise<void> {
  await tursoRequest(`/news/${encodeURIComponent(article.id)}`, {
    method: 'PUT',
    requiresAuth: true,
    body: { article, isNew },
  });
}

export async function deleteFirestoreNewsArticle(newsId: string): Promise<void> {
  await tursoRequest(`/news/${encodeURIComponent(newsId)}`, {
    method: 'DELETE',
    requiresAuth: true,
  });
}

export async function fetchPublicPhotosBounded(maxDocs: number = 60): Promise<PhotoEntry[]> {
  const res = await tursoRequest<{ photos: PhotoEntry[] }>(`/photos?limit=${maxDocs}`);
  return res.photos ?? [];
}

export async function saveFirestorePhoto(photo: PhotoEntry): Promise<void> {
  await tursoRequest(`/photos/${encodeURIComponent(photo.id)}`, {
    method: 'PUT',
    requiresAuth: true,
    body: { photo },
  });
}

export async function deleteFirestorePhoto(photoId: string): Promise<void> {
  await tursoRequest(`/photos/${encodeURIComponent(photoId)}`, {
    method: 'DELETE',
    requiresAuth: true,
  });
}

// ---------------------------------------------------------------------------
// 8. Votes, TOTYs & Leyendas UFRO
// ---------------------------------------------------------------------------

export async function fetchVotingSecondaryForDiscipline(
  disciplineId: DisciplineId
): Promise<{
  awardNominees?: Partial<Record<DisciplineId, string[]>>;
  mvpVotes?: MvpVoteRecord[];
  championshipMvpVotes?: ChampionshipMvpVoteRecord[];
  positionAwardVotes?: PositionAwardVoteRecord[];
  nominatedPlayers: Player[];
}> {
  const res = await tursoRequest<{
    awardNominees?: Partial<Record<DisciplineId, string[]>>;
    mvpVotes?: MvpVoteRecord[];
    championshipMvpVotes?: ChampionshipMvpVoteRecord[];
    positionAwardVotes?: PositionAwardVoteRecord[];
    nominatedPlayers?: Player[];
  }>(`/voting/${encodeURIComponent(disciplineId)}`);

  return {
    awardNominees: res.awardNominees,
    mvpVotes: res.mvpVotes,
    championshipMvpVotes: res.championshipMvpVotes,
    positionAwardVotes: res.positionAwardVotes,
    nominatedPlayers: res.nominatedPlayers ?? [],
  };
}

export async function saveFirestoreMvpVote(params: {
  matchId: string;
  disciplineId: DisciplineId;
  playerId: string;
  playerName: string;
  teamId: string;
  voterUid: string;
  voterName?: string;
}): Promise<void> {
  await tursoRequest('/votes/mvp', {
    method: 'POST',
    requiresAuth: true,
    body: params,
  });
}

export async function saveFirestoreAwardNominees(
  disciplineId: DisciplineId,
  temporada: string,
  mvpNomineeIds: string[]
): Promise<void> {
  await tursoRequest(`/award-nominees/${encodeURIComponent(disciplineId)}`, {
    method: 'PUT',
    requiresAuth: true,
    body: { temporada, mvpNomineeIds },
  });
}

export async function saveFirestoreChampionshipMvpVote(
  vote: ChampionshipMvpVoteRecord
): Promise<void> {
  await tursoRequest('/votes/championship-mvp', {
    method: 'POST',
    requiresAuth: true,
    body: vote,
  });
}

export async function saveFirestorePositionAwardVote(
  vote: PositionAwardVoteRecord
): Promise<void> {
  await tursoRequest('/votes/position-award', {
    method: 'POST',
    requiresAuth: true,
    body: vote,
  });
}

export async function fetchPublicTotyConfigAndOwnBallot(
  disciplineId: DisciplineId,
  _voterUid?: string | null
): Promise<{
  config: DisciplineTotyConfig | null;
  ownBallot: TotyBallotRecord | null;
}> {
  const res = await tursoRequest<{
    config: DisciplineTotyConfig | null;
    ownBallot: TotyBallotRecord | null;
  }>(`/toty/public/${encodeURIComponent(disciplineId)}`);
  return {
    config: res.config ?? null,
    ownBallot: res.ownBallot ?? null,
  };
}

export async function fetchAllFirestoreTotyData(): Promise<{
  ballots: TotyBallotRecord[];
  configs: Partial<Record<DisciplineId, DisciplineTotyConfig>>;
}> {
  const res = await tursoRequest<{
    ballots: TotyBallotRecord[];
    configs: Partial<Record<DisciplineId, DisciplineTotyConfig>>;
  }>('/toty/admin-all', { requiresAuth: true });
  return {
    ballots: res.ballots ?? [],
    configs: res.configs ?? {},
  };
}

export async function saveFirestoreTotyBallotsBatch(
  items: TotyBallotBatchItem[]
): Promise<number> {
  const validItems = items
    .map((item) => ({
      ballot: {
        ...item.ballot,
        selections: sanitizeTotySelections(item.ballot.selections),
      },
      isUpdate: item.isUpdate,
    }))
    .filter((entry) => Object.keys(entry.ballot.selections).length > 0);

  if (validItems.length === 0) return 0;

  const res = await tursoRequest<{ committed: number }>('/toty/ballots/batch', {
    method: 'POST',
    requiresAuth: true,
    body: { items: validItems },
  });
  return res.committed ?? validItems.length;
}

export async function saveFirestoreTotyConfig(config: DisciplineTotyConfig): Promise<void> {
  await tursoRequest(`/toty/config/${encodeURIComponent(config.disciplineId)}`, {
    method: 'PUT',
    requiresAuth: true,
    body: { config },
  });
}

export async function deleteFirestoreTotyConfig(disciplineId: DisciplineId): Promise<void> {
  await tursoRequest(`/toty/config/${encodeURIComponent(disciplineId)}`, {
    method: 'DELETE',
    requiresAuth: true,
  });
}

export async function migrateTotyBallotsFromFirestoreToTurso(): Promise<{
  migratedBallots: number;
  migratedConfigs: number;
  ballots: TotyBallotRecord[];
  configs: Partial<Record<DisciplineId, DisciplineTotyConfig>>;
}> {
  const res = await tursoRequest<{
    migratedBallots: number;
    migratedConfigs: number;
    ballots: TotyBallotRecord[];
    configs: Partial<Record<DisciplineId, DisciplineTotyConfig>>;
  }>('/toty/migrate-from-firestore', {
    method: 'POST',
    requiresAuth: true,
  });
  return {
    migratedBallots: res.migratedBallots ?? 0,
    migratedConfigs: res.migratedConfigs ?? 0,
    ballots: res.ballots ?? [],
    configs: res.configs ?? {},
  };
}

export async function importAdminTotyBallotsToTurso(payload: {
  ballots: TotyBallotRecord[];
  configs: Partial<Record<DisciplineId, DisciplineTotyConfig>>;
}): Promise<{
  importedBallots: number;
  importedConfigs: number;
  ballots: TotyBallotRecord[];
  configs: Partial<Record<DisciplineId, DisciplineTotyConfig>>;
}> {
  const res = await tursoRequest<{
    importedBallots: number;
    importedConfigs: number;
    ballots: TotyBallotRecord[];
    configs: Partial<Record<DisciplineId, DisciplineTotyConfig>>;
  }>('/toty/import-admin', {
    method: 'POST',
    requiresAuth: true,
    body: payload,
  });
  return {
    importedBallots: res.importedBallots ?? 0,
    importedConfigs: res.importedConfigs ?? 0,
    ballots: res.ballots ?? [],
    configs: res.configs ?? {},
  };
}

export async function fetchWeeklyLeyendasBounded(
  maxDocs: number = 50
): Promise<LeyendasLeaderboardEntry[]> {
  const res = await tursoRequest<{ entries: LeyendasLeaderboardEntry[] }>(
    `/leyendas?limit=${maxDocs}`
  );
  return res.entries ?? [];
}

export async function saveFirestoreLeyendasEntry(
  entry: LeyendasLeaderboardEntry
): Promise<void> {
  await tursoRequest('/leyendas', {
    method: 'POST',
    requiresAuth: true,
    body: { entry },
  });
}
