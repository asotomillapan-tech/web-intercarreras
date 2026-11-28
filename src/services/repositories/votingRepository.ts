import { sanitizeTotySelections, type TotyBallotBatchItem } from '../../domain/totyBatchQueue';
import type {
  ChampionshipMvpVoteRecord,
  DisciplineId,
  DisciplineTotyConfig,
  LeyendasLeaderboardEntry,
  MvpVoteRecord,
  Player,
  PositionAwardVoteRecord,
  TotyBallotRecord,
} from '../../types/tournament';
import { tursoRequest } from '../tursoApiClient';

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
  totyVotingDeadline: string | null;
}> {
  const res = await tursoRequest<{
    config: DisciplineTotyConfig | null;
    ownBallot: TotyBallotRecord | null;
    totyVotingDeadline?: string | null;
  }>(`/toty/public/${encodeURIComponent(disciplineId)}`);
  return {
    config: res.config ?? null,
    ownBallot: res.ownBallot ?? null,
    totyVotingDeadline: res.totyVotingDeadline ?? null,
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
