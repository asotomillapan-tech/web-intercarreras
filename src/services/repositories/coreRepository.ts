import type { PublicRealtimeStreamKey } from '../../domain/realtimeSyncEngine';
import type {
  DisciplineFormatConfig,
  DisciplineId,
  HomeFeaturedConfig,
  MasterSheetsConfig,
  Match,
  Team,
  TournamentState,
} from '../../types/tournament';
import { tursoRequest } from '../tursoApiClient';

export interface CorePublicFetchReport {
  settings?: Partial<TournamentState>;
  configs?: Record<DisciplineId, DisciplineFormatConfig>;
  teams?: Team[];
  matches?: Match[];
  settledStreams: PublicRealtimeStreamKey[];
  errors: Array<{ stream: PublicRealtimeStreamKey; error: unknown }>;
}

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
  totyVotingDeadline?: string | null;
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
