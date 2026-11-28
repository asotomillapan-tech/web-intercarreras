import { createClient, type Client } from '@libsql/client';
import { resolveTursoCredentialsFromEnv } from '../src/domain/tursoHelpers.ts';

let cachedClient: Client | null = null;
let schemaReadyPromise: Promise<void> | null = null;

export function isTursoConfigured(): boolean {
  const { url } = resolveTursoCredentialsFromEnv(process.env);
  return url.length > 0;
}

export function getTursoClient(): Client {
  if (cachedClient) return cachedClient;

  const { url, authToken } = resolveTursoCredentialsFromEnv(process.env);

  if (!url) {
    throw new Error(
      'TURSO_DATABASE_URL no está configurada en las variables de entorno del servidor.'
    );
  }

  cachedClient = createClient({
    url,
    authToken: authToken || undefined,
  });

  return cachedClient;
}

const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS configs (
    discipline_id TEXT PRIMARY KEY,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    uid TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'tradicional',
    delegated_team_id TEXT,
    linked_player_id TEXT,
    data_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,
  `CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    discipline_id TEXT NOT NULL,
    nombre TEXT NOT NULL,
    data_json TEXT NOT NULL,
    created_by_uid TEXT,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_teams_disc ON teams(discipline_id)`,
  `CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    discipline_id TEXT NOT NULL,
    dorsal INTEGER NOT NULL DEFAULT 0,
    nombre TEXT NOT NULL,
    apellido_paterno TEXT NOT NULL,
    search_text TEXT NOT NULL,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id)`,
  `CREATE INDEX IF NOT EXISTS idx_players_disc ON players(discipline_id)`,
  `CREATE INDEX IF NOT EXISTS idx_players_search ON players(search_text)`,
  `CREATE TABLE IF NOT EXISTS player_private (
    player_id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    rut TEXT NOT NULL DEFAULT '',
    numero_matricula TEXT NOT NULL DEFAULT '',
    correo_institucional TEXT NOT NULL DEFAULT '',
    fecha_nacimiento TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_player_private_team ON player_private(team_id)`,
  `CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    discipline_id TEXT NOT NULL,
    home_team_id TEXT NOT NULL,
    away_team_id TEXT NOT NULL,
    status TEXT NOT NULL,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_matches_disc ON matches(discipline_id)`,
  `CREATE TABLE IF NOT EXISTS news (
    id TEXT PRIMARY KEY,
    published INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_news_pub_created ON news(published, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    discipline_id TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL,
    data_json TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_photos_created ON photos(created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS transfers (
    id TEXT PRIMARY KEY,
    discipline_id TEXT NOT NULL,
    estado TEXT NOT NULL,
    from_team_id TEXT NOT NULL,
    to_team_id TEXT NOT NULL,
    fecha TEXT NOT NULL,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_transfers_estado ON transfers(estado, fecha DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_transfers_from ON transfers(from_team_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transfers_to ON transfers(to_team_id)`,
  `CREATE TABLE IF NOT EXISTS mvp_votes (
    id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL,
    discipline_id TEXT NOT NULL,
    voter_uid TEXT NOT NULL,
    data_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mvp_votes_disc ON mvp_votes(discipline_id)`,
  `CREATE TABLE IF NOT EXISTS award_nominees (
    discipline_id TEXT PRIMARY KEY,
    temporada TEXT NOT NULL,
    nominees_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS championship_mvp_votes (
    id TEXT PRIMARY KEY,
    discipline_id TEXT NOT NULL,
    voter_uid TEXT NOT NULL,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_champ_mvp_disc ON championship_mvp_votes(discipline_id)`,
  `CREATE TABLE IF NOT EXISTS position_award_votes (
    id TEXT PRIMARY KEY,
    discipline_id TEXT NOT NULL,
    position_key TEXT NOT NULL,
    voter_uid TEXT NOT NULL,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pos_award_disc ON position_award_votes(discipline_id)`,
  `CREATE TABLE IF NOT EXISTS toty_configs (
    discipline_id TEXT PRIMARY KEY,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS toty_ballots (
    id TEXT PRIMARY KEY,
    discipline_id TEXT NOT NULL,
    voter_uid TEXT NOT NULL,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_toty_ballots_disc ON toty_ballots(discipline_id)`,
  `CREATE INDEX IF NOT EXISTS idx_toty_ballots_voter ON toty_ballots(voter_uid)`,
  `CREATE TABLE IF NOT EXISTS leyendas_leaderboard (
    id TEXT PRIMARY KEY,
    sport_key TEXT NOT NULL,
    week_key TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    uid TEXT NOT NULL,
    data_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_leyendas_score ON leyendas_leaderboard(score DESC)`,
];

/**
 * Lazily and idempotently initializes all libSQL tables and indexes on first API request.
 * Safe under concurrent requests (reuses the same in-flight promise, retries if it failed).
 */
export async function ensureTursoSchema(): Promise<Client> {
  const client = getTursoClient();
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await client.batch(
        SCHEMA_STATEMENTS.map((sql) => ({ sql, args: [] })),
        'write'
      );
    })().catch((err) => {
      schemaReadyPromise = null;
      throw err;
    });
  }
  await schemaReadyPromise;
  return client;
}
