import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import type { Client, InValue } from '@libsql/client';
import { ensureTursoSchema, isTursoConfigured } from './tursoClient.ts';
import {
  buildPlayerSearchText,
  canActorEditPlayer,
  canActorManageTransfer,
  canActorReadPlayerPii,
  isAdminOrModeratorRole,
  isPhotographerOrPressOrAdminRole,
  isPressOrAdminRole,
  isRefereeOrAdminRole,
  isValidDisciplineId,
  isValidEntityId,
  isValidUserRole,
  normalizeSearchText,
  parseFirestoreTotyBallotDocument,
  parseFirestoreTotyConfigDocument,
  resolveBootstrapRole,
  sanitizeAdminImportedTotyBallot,
  sanitizeAdminImportedTotyConfig,
  stripPlayerPii,
  stripTeamPrivateFields,
} from '../src/domain/tursoHelpers.ts';
import type {
  AppUserProfile,
  ChampionshipMvpVoteRecord,
  DisciplineFormatConfig,
  DisciplineId,
  DisciplineTotyConfig,
  LeyendasLeaderboardEntry,
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
} from '../src/types/tournament';

export interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export type AuthedRequest = Request & { firebaseUser?: VerifiedFirebaseUser };

export interface TursoRouterDeps {
  verifyFirebaseIdToken: (idToken: string) => Promise<VerifiedFirebaseUser>;
  requireFirebaseAuth: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

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

function safeParseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

interface FirestoreAppletMeta {
  projectId: string;
  firestoreDatabaseId: string;
  apiKey: string;
}

function loadFirestoreAppletMeta(): FirestoreAppletMeta | null {
  const candidates = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(process.cwd(), '..', 'firebase-applet-config.json'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as Partial<FirestoreAppletMeta>;
        if (parsed.projectId && parsed.firestoreDatabaseId && parsed.apiKey) {
          return {
            projectId: parsed.projectId,
            firestoreDatabaseId: parsed.firestoreDatabaseId,
            apiKey: parsed.apiKey,
          };
        }
      }
    } catch {
      // Try next candidate
    }
  }
  return null;
}

async function fetchAllFirestoreRestCollection(params: {
  meta: FirestoreAppletMeta;
  collectionName: 'toty_ballots' | 'toty_configs';
  authHeader?: string;
}): Promise<{
  quotaExceeded: boolean;
  errorStatus?: number;
  errorMessage?: string;
  documents: Array<{ name?: string; fields?: Record<string, unknown>; updateTime?: string }>;
}> {
  const { meta, collectionName, authHeader } = params;
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(meta.projectId)}/databases/${encodeURIComponent(meta.firestoreDatabaseId)}/documents/${collectionName}`;
  const documents: Array<{ name?: string; fields?: Record<string, unknown>; updateTime?: string }> = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 60; page += 1) {
    const qs = new URLSearchParams({
      pageSize: '200',
      key: meta.apiKey,
    });
    if (pageToken) qs.set('pageToken', pageToken);

    const headers: Record<string, string> = {};
    if (authHeader && authHeader.startsWith('Bearer ')) {
      headers.Authorization = authHeader;
    }

    const res = await fetch(`${baseUrl}?${qs.toString()}`, { headers });
    const body = (await res.json().catch(() => ({}))) as {
      documents?: Array<{ name?: string; fields?: Record<string, unknown>; updateTime?: string }>;
      nextPageToken?: string;
      error?: { status?: string; message?: string };
    };

    if (!res.ok) {
      const errMsg = body.error?.message || `HTTP ${res.status}`;
      const isQuota =
        res.status === 429 ||
        body.error?.status === 'RESOURCE_EXHAUSTED' ||
        /quota/i.test(errMsg);
      return {
        quotaExceeded: isQuota,
        errorStatus: res.status,
        errorMessage: errMsg,
        documents,
      };
    }

    if (Array.isArray(body.documents) && body.documents.length > 0) {
      documents.push(...body.documents);
    }

    if (!body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }

  return { quotaExceeded: false, documents };
}

async function upsertTotyRecordsInTurso(
  client: Client,
  ballots: TotyBallotRecord[],
  configs: DisciplineTotyConfig[]
): Promise<void> {
  const stmts: Array<{ sql: string; args: InValue[] }> = [];

  for (const b of ballots) {
    stmts.push({
      sql: `INSERT INTO toty_ballots (id, discipline_id, voter_uid, data_json, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              data_json = excluded.data_json,
              updated_at = excluded.updated_at`,
      args: [b.id, b.disciplineId, b.voterUid, JSON.stringify(b), b.updatedAt],
    });
  }

  const fallbackNow = new Date().toISOString();
  for (const cfg of configs) {
    const updatedAt = cfg.updatedAt || fallbackNow;
    stmts.push({
      sql: `INSERT INTO toty_configs (discipline_id, data_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(discipline_id) DO UPDATE SET
              data_json = excluded.data_json,
              updated_at = excluded.updated_at`,
      args: [cfg.disciplineId, JSON.stringify({ ...cfg, updatedAt }), updatedAt],
    });
  }

  for (let i = 0; i < stmts.length; i += 80) {
    await client.batch(stmts.slice(i, i + 80), 'write');
  }
}

async function getDbOrRespond(res: Response): Promise<Client | null> {
  if (!isTursoConfigured()) {
    res.status(503).json({
      error:
        'La base de datos Turso no está configurada todavía (falta TURSO_DATABASE_URL en el servidor).',
    });
    return null;
  }
  try {
    return await ensureTursoSchema();
  } catch (err) {
    console.error('[Turso] Schema/connection error:', err);
    res.status(503).json({
      error: 'No se pudo conectar con la base de datos Turso en este momento.',
    });
    return null;
  }
}

async function fetchUserProfile(client: Client, uid: string): Promise<AppUserProfile | null> {
  const rs = await client.execute({
    sql: 'SELECT data_json FROM users WHERE uid = ? LIMIT 1',
    args: [uid],
  });
  if (rs.rows.length === 0) return null;
  return safeParseJson<AppUserProfile | null>(rs.rows[0].data_json, null);
}

async function resolveActorProfile(
  client: Client,
  firebaseUser?: VerifiedFirebaseUser
): Promise<AppUserProfile | null> {
  if (!firebaseUser?.uid) return null;
  const existing = await fetchUserProfile(client, firebaseUser.uid);
  if (existing) {
    // Keep primary admin bootstrap consistent even if DB row was edited
    const authoritativeRole = resolveBootstrapRole(firebaseUser.email || existing.email, existing.role);
    if (authoritativeRole !== existing.role) {
      return { ...existing, role: authoritativeRole };
    }
    return existing;
  }
  if (firebaseUser.email) {
    const role = resolveBootstrapRole(firebaseUser.email);
    const now = new Date().toISOString();
    return {
      uid: firebaseUser.uid,
      displayName: firebaseUser.name || firebaseUser.email.split('@')[0] || 'Usuario UFRO',
      email: firebaseUser.email,
      photoURL: firebaseUser.picture,
      role,
      favoriteTeamIds: [],
      notificationsEnabled: true,
      authSource: 'google',
      createdAt: now,
      updatedAt: now,
    };
  }
  return null;
}

async function tryOptionalAuth(
  req: Request,
  verifyFirebaseIdToken: (token: string) => Promise<VerifiedFirebaseUser>
): Promise<VerifiedFirebaseUser | null> {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  try {
    return await verifyFirebaseIdToken(token);
  } catch {
    return null;
  }
}

export function createTursoRouter({
  verifyFirebaseIdToken,
  requireFirebaseAuth,
}: TursoRouterDeps): express.Router {
  const router = express.Router();

  // -------------------------------------------------------------------------
  // 0. Health Check (does not expose secrets or raw connection details)
  // -------------------------------------------------------------------------
  router.get('/health', async (_req: Request, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    try {
      await client.execute({ sql: 'SELECT 1 AS ok', args: [] });
      res.json({ ok: true, engine: 'turso-libsql' });
    } catch (err) {
      console.error('[Turso] Health check failed:', err);
      res.status(503).json({ ok: false, error: 'Turso health check failed.' });
    }
  });

  // -------------------------------------------------------------------------
  // 1. Core Public Tournament Snapshot (settings, configs, teams, matches)
  // -------------------------------------------------------------------------
  router.get('/core', async (_req: Request, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    try {
      const [settingsRs, configsRs, teamsRs, matchesRs] = await client.batch(
        [
          { sql: 'SELECT data_json FROM settings WHERE id = ? LIMIT 1', args: ['tournament'] },
          { sql: 'SELECT discipline_id, data_json FROM configs', args: [] },
          { sql: 'SELECT data_json FROM teams ORDER BY nombre ASC', args: [] },
          { sql: 'SELECT data_json FROM matches', args: [] },
        ],
        'read'
      );

      const settings =
        settingsRs.rows.length > 0
          ? safeParseJson<Partial<TournamentState>>(settingsRs.rows[0].data_json, {})
          : {};

      const configs: Partial<Record<DisciplineId, DisciplineFormatConfig>> = {};
      for (const row of configsRs.rows) {
        const discId = String(row.discipline_id);
        if (isValidDisciplineId(discId)) {
          const parsed = safeParseJson<DisciplineFormatConfig | null>(row.data_json, null);
          if (parsed) configs[discId] = parsed;
        }
      }

      const teams: Team[] = teamsRs.rows
        .map((row) => safeParseJson<Team | null>(row.data_json, null))
        .filter((t): t is Team => Boolean(t))
        .map(stripTeamPrivateFields);

      const matches: Match[] = matchesRs.rows
        .map((row) => safeParseJson<Match | null>(row.data_json, null))
        .filter((m): m is Match => Boolean(m));

      res.json({
        settings,
        configs: Object.keys(configs).length > 0 ? configs : undefined,
        teams,
        matches,
      });
    } catch (err) {
      console.error('[Turso] GET /core failed:', err);
      res.status(500).json({ error: 'No se pudieron cargar los datos principales del torneo.' });
    }
  });

  // -------------------------------------------------------------------------
  // 2. Public Players (Bounded preview, single-team roster, partial search, by ID)
  // -------------------------------------------------------------------------
  router.get('/players/preview', async (req: Request, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    try {
      const rawLimit = Number(req.query.limit ?? 10);
      const safeLimit = Number.isFinite(rawLimit)
        ? Math.max(1, Math.min(25, Math.trunc(rawLimit)))
        : 10;
      const discParam = typeof req.query.disciplineId === 'string' ? req.query.disciplineId : '';

      const rs = isValidDisciplineId(discParam)
        ? await client.execute({
            sql: 'SELECT data_json FROM players WHERE discipline_id = ? ORDER BY nombre ASC, apellido_paterno ASC LIMIT ?',
            args: [discParam, safeLimit],
          })
        : await client.execute({
            sql: 'SELECT data_json FROM players ORDER BY nombre ASC, apellido_paterno ASC LIMIT ?',
            args: [safeLimit],
          });

      const players = rs.rows
        .map((row) => safeParseJson<Player | null>(row.data_json, null))
        .filter((p): p is Player => Boolean(p))
        .map(stripPlayerPii);

      res.json({ players });
    } catch (err) {
      console.error('[Turso] GET /players/preview failed:', err);
      res.status(500).json({ error: 'No se pudo cargar la vista previa de jugadores.' });
    }
  });

  router.get('/players/by-team/:teamId', async (req: Request, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const teamId = String(req.params.teamId || '').trim();
    if (!isValidEntityId(teamId)) {
      res.status(400).json({ error: 'ID de equipo inválido.' });
      return;
    }
    try {
      const discParam = typeof req.query.disciplineId === 'string' ? req.query.disciplineId : '';
      const rs = isValidDisciplineId(discParam)
        ? await client.execute({
            sql: 'SELECT data_json FROM players WHERE team_id = ? AND discipline_id = ? ORDER BY dorsal ASC, apellido_paterno ASC LIMIT 60',
            args: [teamId, discParam],
          })
        : await client.execute({
            sql: 'SELECT data_json FROM players WHERE team_id = ? ORDER BY dorsal ASC, apellido_paterno ASC LIMIT 60',
            args: [teamId],
          });

      const players = rs.rows
        .map((row) => safeParseJson<Player | null>(row.data_json, null))
        .filter((p): p is Player => Boolean(p))
        .map(stripPlayerPii);

      res.json({ players });
    } catch (err) {
      console.error('[Turso] GET /players/by-team failed:', err);
      res.status(500).json({ error: 'No se pudo cargar el plantel del equipo.' });
    }
  });

  router.get('/players/search', async (req: Request, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const rawQ = typeof req.query.q === 'string' ? req.query.q : '';
    const norm = normalizeSearchText(rawQ);
    if (norm.length < 2) {
      res.json({ players: [] });
      return;
    }
    const tokens = norm.split(' ').filter((t) => t.length >= 1).slice(0, 4);
    const discParam = typeof req.query.disciplineId === 'string' ? req.query.disciplineId : '';

    try {
      const clauses: string[] = [];
      const args: InValue[] = [];
      if (isValidDisciplineId(discParam)) {
        clauses.push('discipline_id = ?');
        args.push(discParam);
      }
      for (const tok of tokens) {
        clauses.push('search_text LIKE ?');
        args.push(`%${tok}%`);
      }
      args.push(30);

      const rs = await client.execute({
        sql: `SELECT data_json FROM players WHERE ${clauses.join(' AND ')} ORDER BY nombre ASC, apellido_paterno ASC LIMIT ?`,
        args,
      });

      const players = rs.rows
        .map((row) => safeParseJson<Player | null>(row.data_json, null))
        .filter((p): p is Player => Boolean(p))
        .map(stripPlayerPii);

      res.json({ players });
    } catch (err) {
      console.error('[Turso] GET /players/search failed:', err);
      res.status(500).json({ error: 'No se pudo realizar la búsqueda de jugadores.' });
    }
  });

  router.get('/players/admin-all', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor || !isAdminOrModeratorRole(actor.role)) {
        res.status(403).json({ error: 'Solo administradores o moderadores pueden descargar el padrón completo.' });
        return;
      }
      const rs = await client.execute({
        sql: 'SELECT data_json FROM players ORDER BY apellido_paterno ASC, nombre ASC',
        args: [],
      });
      const players = rs.rows
        .map((row) => safeParseJson<Player | null>(row.data_json, null))
        .filter((p): p is Player => Boolean(p))
        .map(stripPlayerPii);
      res.json({ players });
    } catch (err) {
      console.error('[Turso] GET /players/admin-all failed:', err);
      res.status(500).json({ error: 'No se pudo cargar el padrón completo de jugadores.' });
    }
  });

  router.post('/players/private', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor) {
        res.status(401).json({ error: 'Usuario no autenticado.' });
        return;
      }

      let rows: Array<Record<string, unknown>> = [];
      if (isAdminOrModeratorRole(actor.role)) {
        const rs = await client.execute({
          sql: 'SELECT player_id, team_id, rut, numero_matricula, correo_institucional, fecha_nacimiento FROM player_private',
          args: [],
        });
        rows = rs.rows as unknown as Array<Record<string, unknown>>;
      } else if (actor.role === 'delegado' && actor.delegatedTeamId) {
        const rs = await client.execute({
          sql: 'SELECT player_id, team_id, rut, numero_matricula, correo_institucional, fecha_nacimiento FROM player_private WHERE team_id = ?',
          args: [actor.delegatedTeamId],
        });
        rows = rs.rows as unknown as Array<Record<string, unknown>>;
      } else if (actor.role === 'jugador' && actor.linkedPlayerId) {
        const rs = await client.execute({
          sql: 'SELECT player_id, team_id, rut, numero_matricula, correo_institucional, fecha_nacimiento FROM player_private WHERE player_id = ? LIMIT 1',
          args: [actor.linkedPlayerId],
        });
        rows = rs.rows as unknown as Array<Record<string, unknown>>;
      }

      const privateMap: Record<
        string,
        {
          rut: string;
          numeroMatricula: string;
          correoInstitucional: string;
          fechaNacimiento: string;
        }
      > = {};

      for (const row of rows) {
        const pid = String(row.player_id || '');
        const tid = String(row.team_id || '');
        if (!pid || !canActorReadPlayerPii(actor, pid, tid)) continue;
        privateMap[pid] = {
          rut: String(row.rut || ''),
          numeroMatricula: String(row.numero_matricula || ''),
          correoInstitucional: String(row.correo_institucional || ''),
          fechaNacimiento: String(row.fecha_nacimiento || ''),
        };
      }

      res.json({ privateMap });
    } catch (err) {
      console.error('[Turso] POST /players/private failed:', err);
      res.status(500).json({ error: 'No se pudieron cargar los datos privados autorizados.' });
    }
  });

  router.get('/players/:playerId', async (req: Request, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const playerId = String(req.params.playerId || '').trim();
    if (!isValidEntityId(playerId)) {
      res.status(400).json({ error: 'ID de jugador inválido.' });
      return;
    }
    try {
      const rs = await client.execute({
        sql: 'SELECT data_json FROM players WHERE id = ? LIMIT 1',
        args: [playerId],
      });
      if (rs.rows.length === 0) {
        res.json({ player: null });
        return;
      }
      const parsed = safeParseJson<Player | null>(rs.rows[0].data_json, null);
      res.json({ player: parsed ? stripPlayerPii(parsed) : null });
    } catch (err) {
      console.error('[Turso] GET /players/:playerId failed:', err);
      res.status(500).json({ error: 'No se pudo cargar la ficha del jugador.' });
    }
  });

  // -------------------------------------------------------------------------
  // 3. Public Bounded Sections (News, Photos, Approved Transfers, Leyendas, Voting)
  // -------------------------------------------------------------------------
  router.get('/news', async (req: Request, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const rawLimit = Number(req.query.limit ?? 25);
    const safeLimit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.trunc(rawLimit))) : 25;
    try {
      const rs = await client.execute({
        sql: 'SELECT data_json FROM news WHERE published = 1 ORDER BY created_at DESC LIMIT ?',
        args: [safeLimit],
      });
      const news = rs.rows
        .map((r) => safeParseJson<NewsArticle | null>(r.data_json, null))
        .filter((n): n is NewsArticle => Boolean(n));
      res.json({ news });
    } catch (err) {
      console.error('[Turso] GET /news failed:', err);
      res.status(500).json({ error: 'No se pudieron cargar las noticias.' });
    }
  });

  router.get('/news/all', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor || !isPressOrAdminRole(actor.role)) {
        res.status(403).json({ error: 'Permisos insuficientes para leer borradores de noticias.' });
        return;
      }
      const rs = await client.execute({
        sql: 'SELECT data_json FROM news ORDER BY created_at DESC',
        args: [],
      });
      const news = rs.rows
        .map((r) => safeParseJson<NewsArticle | null>(r.data_json, null))
        .filter((n): n is NewsArticle => Boolean(n));
      res.json({ news });
    } catch (err) {
      console.error('[Turso] GET /news/all failed:', err);
      res.status(500).json({ error: 'No se pudieron cargar todas las noticias.' });
    }
  });

  router.get('/photos', async (req: Request, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const rawLimit = Number(req.query.limit ?? 60);
    const safeLimit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(200, Math.trunc(rawLimit))) : 60;
    try {
      const rs = await client.execute({
        sql: 'SELECT data_json FROM photos ORDER BY created_at DESC LIMIT ?',
        args: [safeLimit],
      });
      const photos = rs.rows
        .map((r) => safeParseJson<PhotoEntry | null>(r.data_json, null))
        .filter((p): p is PhotoEntry => Boolean(p));
      res.json({ photos });
    } catch (err) {
      console.error('[Turso] GET /photos failed:', err);
      res.status(500).json({ error: 'No se pudo cargar la galería.' });
    }
  });

  router.get('/transfers/approved', async (req: Request, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const rawLimit = Number(req.query.limit ?? 60);
    const safeLimit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(200, Math.trunc(rawLimit))) : 60;
    try {
      const rs = await client.execute({
        sql: 'SELECT data_json FROM transfers WHERE estado = ? ORDER BY fecha DESC LIMIT ?',
        args: ['APROBADA', safeLimit],
      });
      const transfers = rs.rows
        .map((r) => safeParseJson<TransferRecord | null>(r.data_json, null))
        .filter((t): t is TransferRecord => Boolean(t))
        .map((t) => ({ ...t, playerRut: undefined }));
      res.json({ transfers });
    } catch (err) {
      console.error('[Turso] GET /transfers/approved failed:', err);
      res.status(500).json({ error: 'No se pudieron cargar las transferencias.' });
    }
  });

  router.get('/transfers/delegate', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor) {
        res.status(401).json({ error: 'Autenticación requerida.' });
        return;
      }
      const teamId = isAdminOrModeratorRole(actor.role)
        ? String(req.query.teamId || actor.delegatedTeamId || '').trim()
        : actor.delegatedTeamId || '';
      if (!teamId) {
        res.json({ transfers: [] });
        return;
      }
      const rs = await client.execute({
        sql: 'SELECT data_json FROM transfers WHERE from_team_id = ? OR to_team_id = ? ORDER BY fecha DESC',
        args: [teamId, teamId],
      });
      const transfers = rs.rows
        .map((r) => safeParseJson<TransferRecord | null>(r.data_json, null))
        .filter((t): t is TransferRecord => Boolean(t));
      res.json({ transfers });
    } catch (err) {
      console.error('[Turso] GET /transfers/delegate failed:', err);
      res.status(500).json({ error: 'No se pudieron cargar las solicitudes de transferencia.' });
    }
  });

  router.get('/transfers/all', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor || !isAdminOrModeratorRole(actor.role)) {
        res.status(403).json({ error: 'Permisos insuficientes para ver todas las transferencias.' });
        return;
      }
      const rs = await client.execute({
        sql: 'SELECT data_json FROM transfers ORDER BY fecha DESC',
        args: [],
      });
      const transfers = rs.rows
        .map((r) => safeParseJson<TransferRecord | null>(r.data_json, null))
        .filter((t): t is TransferRecord => Boolean(t));
      res.json({ transfers });
    } catch (err) {
      console.error('[Turso] GET /transfers/all failed:', err);
      res.status(500).json({ error: 'No se pudieron cargar las transferencias.' });
    }
  });

  router.get('/leyendas', async (req: Request, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const rawLimit = Number(req.query.limit ?? 50);
    const safeLimit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.trunc(rawLimit))) : 50;
    try {
      const rs = await client.execute({
        sql: 'SELECT data_json FROM leyendas_leaderboard ORDER BY score DESC LIMIT ?',
        args: [safeLimit],
      });
      const entries = rs.rows
        .map((r) => safeParseJson<LeyendasLeaderboardEntry | null>(r.data_json, null))
        .filter((e): e is LeyendasLeaderboardEntry => Boolean(e));
      res.json({ entries });
    } catch (err) {
      console.error('[Turso] GET /leyendas failed:', err);
      res.status(500).json({ error: 'No se pudo cargar el ranking de Leyendas UFRO.' });
    }
  });

  router.get('/voting/:disciplineId', async (req: Request, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const discId = String(req.params.disciplineId || '');
    if (!isValidDisciplineId(discId)) {
      res.status(400).json({ error: 'Disciplina inválida.' });
      return;
    }
    try {
      const [nomineesRs, mvpRs, champRs, posRs] = await client.batch(
        [
          { sql: 'SELECT discipline_id, nominees_json FROM award_nominees', args: [] },
          {
            sql: 'SELECT data_json FROM mvp_votes WHERE discipline_id = ? LIMIT 300',
            args: [discId],
          },
          {
            sql: 'SELECT data_json FROM championship_mvp_votes WHERE discipline_id = ? LIMIT 300',
            args: [discId],
          },
          {
            sql: 'SELECT data_json FROM position_award_votes WHERE discipline_id = ? LIMIT 400',
            args: [discId],
          },
        ],
        'read'
      );

      const awardNominees: Partial<Record<DisciplineId, string[]>> = {};
      for (const row of nomineesRs.rows) {
        const d = String(row.discipline_id);
        if (isValidDisciplineId(d)) {
          awardNominees[d] = safeParseJson<string[]>(row.nominees_json, []);
        }
      }

      const idsForDisc = (awardNominees[discId] || []).filter(isValidEntityId).slice(0, 15);
      let nominatedPlayers: Player[] = [];
      if (idsForDisc.length > 0) {
        const placeholders = idsForDisc.map(() => '?').join(', ');
        const pRs = await client.execute({
          sql: `SELECT data_json FROM players WHERE id IN (${placeholders})`,
          args: idsForDisc,
        });
        nominatedPlayers = pRs.rows
          .map((r) => safeParseJson<Player | null>(r.data_json, null))
          .filter((p): p is Player => Boolean(p))
          .map(stripPlayerPii);
      }

      res.json({
        awardNominees,
        mvpVotes: mvpRs.rows
          .map((r) => safeParseJson<MvpVoteRecord | null>(r.data_json, null))
          .filter((v): v is MvpVoteRecord => Boolean(v)),
        championshipMvpVotes: champRs.rows
          .map((r) => safeParseJson<ChampionshipMvpVoteRecord | null>(r.data_json, null))
          .filter((v): v is ChampionshipMvpVoteRecord => Boolean(v)),
        positionAwardVotes: posRs.rows
          .map((r) => safeParseJson<PositionAwardVoteRecord | null>(r.data_json, null))
          .filter((v): v is PositionAwardVoteRecord => Boolean(v)),
        nominatedPlayers,
      });
    } catch (err) {
      console.error('[Turso] GET /voting/:disciplineId failed:', err);
      res.status(500).json({ error: 'No se pudieron cargar las votaciones de la disciplina.' });
    }
  });

  // Public Write-Only TOTY Config + Caller's Own Ballot (never exposes live public tally)
  router.get('/toty/public/:disciplineId', async (req: Request, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const discId = String(req.params.disciplineId || '');
    if (!isValidDisciplineId(discId)) {
      res.status(400).json({ error: 'Disciplina inválida.' });
      return;
    }
    try {
      const authed = await tryOptionalAuth(req, verifyFirebaseIdToken);
      const configRs = await client.execute({
        sql: 'SELECT data_json FROM toty_configs WHERE discipline_id = ? LIMIT 1',
        args: [discId],
      });
      const config =
        configRs.rows.length > 0
          ? safeParseJson<DisciplineTotyConfig | null>(configRs.rows[0].data_json, null)
          : null;

      let ownBallot: TotyBallotRecord | null = null;
      if (authed?.uid) {
        const ballotId = `${discId}_${authed.uid}`;
        const ballotRs = await client.execute({
          sql: 'SELECT data_json FROM toty_ballots WHERE id = ? LIMIT 1',
          args: [ballotId],
        });
        if (ballotRs.rows.length > 0) {
          ownBallot = safeParseJson<TotyBallotRecord | null>(ballotRs.rows[0].data_json, null);
        }
      }

      res.json({ config, ownBallot });
    } catch (err) {
      console.error('[Turso] GET /toty/public failed:', err);
      res.status(500).json({ error: 'No se pudo cargar la configuración de TOTYs.' });
    }
  });

  router.get('/toty/admin-all', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor || !isAdminOrModeratorRole(actor.role)) {
        res.status(403).json({ error: 'Solo administración puede ver el recuento completo de TOTYs.' });
        return;
      }
      const [ballotsRs, configsRs] = await client.batch(
        [
          { sql: 'SELECT data_json FROM toty_ballots ORDER BY updated_at DESC', args: [] },
          { sql: 'SELECT discipline_id, data_json FROM toty_configs', args: [] },
        ],
        'read'
      );
      const ballots = ballotsRs.rows
        .map((r) => safeParseJson<TotyBallotRecord | null>(r.data_json, null))
        .filter((b): b is TotyBallotRecord => Boolean(b));
      const configs: Partial<Record<DisciplineId, DisciplineTotyConfig>> = {};
      for (const row of configsRs.rows) {
        const d = String(row.discipline_id);
        if (isValidDisciplineId(d)) {
          const parsed = safeParseJson<DisciplineTotyConfig | null>(row.data_json, null);
          if (parsed) configs[d] = parsed;
        }
      }
      res.json({ ballots, configs });
    } catch (err) {
      console.error('[Turso] GET /toty/admin-all failed:', err);
      res.status(500).json({ error: 'No se pudo cargar el panel TOTY.' });
    }
  });

  // -------------------------------------------------------------------------
  // 4. Auth Profile Sync, Preferences, Users & Referee Roster
  // -------------------------------------------------------------------------
  router.post('/auth/sync', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client || !req.firebaseUser) return;
    try {
      const uid = req.firebaseUser.uid;
      const email = (req.firebaseUser.email || '').trim().toLowerCase();
      const bodyName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
      const bodyPhoto = typeof req.body?.photoURL === 'string' ? req.body.photoURL.trim() : '';
      const now = new Date().toISOString();

      const existing = await fetchUserProfile(client, uid);
      const authoritativeRole = resolveBootstrapRole(email, existing?.role);

      const profile: AppUserProfile = existing
        ? {
            ...existing,
            uid,
            email: email || existing.email,
            displayName: existing.displayName || bodyName || req.firebaseUser.name || 'Usuario UFRO',
            photoURL: bodyPhoto || req.firebaseUser.picture || existing.photoURL,
            role: authoritativeRole,
            authSource: 'google',
            updatedAt: now,
          }
        : {
            uid,
            displayName: bodyName || req.firebaseUser.name || email.split('@')[0] || 'Usuario UFRO',
            email,
            photoURL: bodyPhoto || req.firebaseUser.picture || undefined,
            role: authoritativeRole,
            favoriteTeamIds: [],
            notificationsEnabled: true,
            authSource: 'google',
            createdAt: now,
            updatedAt: now,
          };

      await client.execute({
        sql: `INSERT INTO users (uid, email, display_name, role, delegated_team_id, linked_player_id, data_json, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(uid) DO UPDATE SET
                email = excluded.email,
                display_name = excluded.display_name,
                role = excluded.role,
                delegated_team_id = excluded.delegated_team_id,
                linked_player_id = excluded.linked_player_id,
                data_json = excluded.data_json,
                updated_at = excluded.updated_at`,
        args: [
          profile.uid,
          profile.email,
          profile.displayName,
          profile.role,
          profile.delegatedTeamId ?? null,
          profile.linkedPlayerId ?? null,
          JSON.stringify(profile),
          profile.createdAt,
          now,
        ],
      });

      res.json({ profile });
    } catch (err) {
      console.error('[Turso] POST /auth/sync failed:', err);
      res.status(500).json({ error: 'No se pudo sincronizar el perfil de usuario.' });
    }
  });

  router.patch('/auth/preferences', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client || !req.firebaseUser) return;
    try {
      const uid = req.firebaseUser.uid;
      const existing = await resolveActorProfile(client, req.firebaseUser);
      if (!existing) {
        res.status(404).json({ error: 'Perfil no encontrado.' });
        return;
      }
      const patch = req.body || {};
      const now = new Date().toISOString();
      const updated: AppUserProfile = {
        ...existing,
        favoriteTeamIds: Array.isArray(patch.favoriteTeamIds)
          ? patch.favoriteTeamIds.filter((x: unknown) => typeof x === 'string').slice(0, 40)
          : existing.favoriteTeamIds,
        notificationsEnabled:
          typeof patch.notificationsEnabled === 'boolean'
            ? patch.notificationsEnabled
            : existing.notificationsEnabled,
        displayName:
          typeof patch.displayName === 'string' && patch.displayName.trim()
            ? patch.displayName.trim().slice(0, 120)
            : existing.displayName,
        fechaNacimiento:
          typeof patch.fechaNacimiento === 'string'
            ? patch.fechaNacimiento.trim().slice(0, 20)
            : existing.fechaNacimiento,
        carrera:
          typeof patch.carrera === 'string' ? patch.carrera.trim().slice(0, 120) : existing.carrera,
        facultad:
          typeof patch.facultad === 'string' ? patch.facultad.trim().slice(0, 120) : existing.facultad,
        telefono:
          typeof patch.telefono === 'string' ? patch.telefono.trim().slice(0, 30) : existing.telefono,
        updatedAt: now,
      };

      await client.execute({
        sql: `INSERT INTO users (uid, email, display_name, role, delegated_team_id, linked_player_id, data_json, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(uid) DO UPDATE SET
                display_name = excluded.display_name,
                data_json = excluded.data_json,
                updated_at = excluded.updated_at`,
        args: [
          updated.uid,
          updated.email,
          updated.displayName,
          updated.role,
          updated.delegatedTeamId ?? null,
          updated.linkedPlayerId ?? null,
          JSON.stringify(updated),
          updated.createdAt,
          now,
        ],
      });

      res.json({ profile: updated });
    } catch (err) {
      console.error('[Turso] PATCH /auth/preferences failed:', err);
      res.status(500).json({ error: 'No se pudieron guardar tus preferencias.' });
    }
  });

  router.get('/users', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor || !isAdminOrModeratorRole(actor.role)) {
        res.status(403).json({ error: 'Solo administración puede listar usuarios.' });
        return;
      }
      const rs = await client.execute({
        sql: 'SELECT data_json FROM users ORDER BY display_name ASC',
        args: [],
      });
      const users = rs.rows
        .map((r) => safeParseJson<AppUserProfile | null>(r.data_json, null))
        .filter((u): u is AppUserProfile => Boolean(u));
      res.json({ users });
    } catch (err) {
      console.error('[Turso] GET /users failed:', err);
      res.status(500).json({ error: 'No se pudo cargar la lista de usuarios.' });
    }
  });

  router.get('/referee-roster', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor || !isRefereeOrAdminRole(actor.role)) {
        res.status(403).json({ error: 'Permisos insuficientes para consultar el padrón arbitral.' });
        return;
      }
      const rs = await client.execute({
        sql: `SELECT uid, display_name, role, updated_at FROM users
              WHERE role IN ('arbitro', 'jefe_arbitros_futbol', 'jefe_arbitros_basquetbol', 'jefe_arbitros_voleibol')
              ORDER BY display_name ASC`,
        args: [],
      });
      const roster: RefereeRosterEntry[] = rs.rows.map((r) => ({
        uid: String(r.uid),
        displayName: String(r.display_name || 'Árbitro UFRO'),
        role: String(r.role) as RefereeRosterEntry['role'],
        updatedAt: String(r.updated_at || ''),
      }));
      res.json({ roster });
    } catch (err) {
      console.error('[Turso] GET /referee-roster failed:', err);
      res.status(500).json({ error: 'No se pudo cargar el padrón arbitral.' });
    }
  });

  router.patch('/users/:uid/role', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const targetUid = String(req.params.uid || '').trim();
    if (!isValidEntityId(targetUid)) {
      res.status(400).json({ error: 'UID de usuario inválido.' });
      return;
    }
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor || !isAdminOrModeratorRole(actor.role)) {
        res.status(403).json({ error: 'Solo administradores o moderadores pueden modificar roles.' });
        return;
      }
      const nextRole = req.body?.role;
      if (!isValidUserRole(nextRole)) {
        res.status(400).json({ error: 'Rol de usuario inválido.' });
        return;
      }
      if (actor.role === 'moderador' && (nextRole === 'admin' || nextRole === 'moderador')) {
        res.status(403).json({ error: 'Un moderador no puede asignar roles de administrador o moderador.' });
        return;
      }
      const existing = await fetchUserProfile(client, targetUid);
      if (!existing) {
        res.status(404).json({ error: 'Usuario destino no encontrado.' });
        return;
      }
      if (actor.role === 'moderador' && existing.role === 'admin') {
        res.status(403).json({ error: 'No puedes modificar el rol de un administrador.' });
        return;
      }

      const now = new Date().toISOString();
      const delegatedTeamId =
        nextRole === 'delegado' && typeof req.body?.delegatedTeamId === 'string' && req.body.delegatedTeamId.trim()
          ? req.body.delegatedTeamId.trim()
          : undefined;
      const linkedPlayerId =
        nextRole === 'jugador' && typeof req.body?.linkedPlayerId === 'string' && req.body.linkedPlayerId.trim()
          ? req.body.linkedPlayerId.trim()
          : undefined;

      const updated: AppUserProfile = {
        ...existing,
        role: nextRole as UserRole,
        delegatedTeamId,
        linkedPlayerId,
        updatedAt: now,
      };

      await client.execute({
        sql: `UPDATE users SET role = ?, delegated_team_id = ?, linked_player_id = ?, data_json = ?, updated_at = ? WHERE uid = ?`,
        args: [
          updated.role,
          updated.delegatedTeamId ?? null,
          updated.linkedPlayerId ?? null,
          JSON.stringify(updated),
          now,
          targetUid,
        ],
      });

      res.json({ profile: updated });
    } catch (err) {
      console.error('[Turso] PATCH /users/:uid/role failed:', err);
      res.status(500).json({ error: 'No se pudo actualizar el rol del usuario.' });
    }
  });

  // -------------------------------------------------------------------------
  // 5. Settings & Discipline Configs (Admin/Moderator)
  // -------------------------------------------------------------------------
  router.put('/settings', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor || !isAdminOrModeratorRole(actor.role)) {
        res.status(403).json({ error: 'Solo administración puede actualizar la configuración del torneo.' });
        return;
      }
      const existingRs = await client.execute({
        sql: 'SELECT data_json FROM settings WHERE id = ? LIMIT 1',
        args: ['tournament'],
      });
      const existing =
        existingRs.rows.length > 0
          ? safeParseJson<Record<string, unknown>>(existingRs.rows[0].data_json, {})
          : {};
      const merged = { ...existing, ...(req.body || {}) };
      const now = new Date().toISOString();

      await client.execute({
        sql: `INSERT INTO settings (id, data_json, updated_at) VALUES (?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`,
        args: ['tournament', JSON.stringify(merged), now],
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('[Turso] PUT /settings failed:', err);
      res.status(500).json({ error: 'No se pudo guardar la configuración.' });
    }
  });

  router.put('/configs/:disciplineId', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const discId = String(req.params.disciplineId || '');
    if (!isValidDisciplineId(discId)) {
      res.status(400).json({ error: 'Disciplina inválida.' });
      return;
    }
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor || !isAdminOrModeratorRole(actor.role)) {
        res.status(403).json({ error: 'Solo administración puede modificar el formato de disciplina.' });
        return;
      }
      const config = { ...(req.body || {}), disciplineId: discId };
      const now = new Date().toISOString();
      await client.execute({
        sql: `INSERT INTO configs (discipline_id, data_json, updated_at) VALUES (?, ?, ?)
              ON CONFLICT(discipline_id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`,
        args: [discId, JSON.stringify(config), now],
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('[Turso] PUT /configs failed:', err);
      res.status(500).json({ error: 'No se pudo guardar la configuración de disciplina.' });
    }
  });

  router.post('/configs/ensure', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor || !isAdminOrModeratorRole(actor.role)) {
        res.status(403).json({ error: 'Solo administración puede inicializar configuraciones.' });
        return;
      }
      const incoming = (req.body?.configs || {}) as Record<string, DisciplineFormatConfig>;
      const existingRs = await client.execute({ sql: 'SELECT discipline_id FROM configs', args: [] });
      const existingSet = new Set(existingRs.rows.map((r) => String(r.discipline_id)));
      const now = new Date().toISOString();
      const stmts = ALL_DISCIPLINE_IDS.filter((id) => !existingSet.has(id) && incoming[id]).map((id) => ({
        sql: `INSERT OR IGNORE INTO configs (discipline_id, data_json, updated_at) VALUES (?, ?, ?)`,
        args: [id, JSON.stringify({ ...incoming[id], disciplineId: id }), now],
      }));
      if (stmts.length > 0) {
        await client.batch(stmts, 'write');
      }
      res.json({ ok: true, created: stmts.length });
    } catch (err) {
      console.error('[Turso] POST /configs/ensure failed:', err);
      res.status(500).json({ error: 'No se pudieron inicializar las configuraciones.' });
    }
  });

  // -------------------------------------------------------------------------
  // 6. Teams CRUD & Bulk Update
  // -------------------------------------------------------------------------
  router.put('/teams/:teamId', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const teamId = String(req.params.teamId || '').trim();
    const team = req.body?.team as Team | undefined;
    const isNew = Boolean(req.body?.isNew);
    if (!isValidEntityId(teamId) || !team || !isValidDisciplineId(team.disciplineId)) {
      res.status(400).json({ error: 'Datos de equipo inválidos.' });
      return;
    }
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor) {
        res.status(401).json({ error: 'Autenticación requerida.' });
        return;
      }
      let allowed = isAdminOrModeratorRole(actor.role);
      if (!allowed && actor.role === 'delegado' && actor.delegatedTeamId === teamId) {
        allowed = true;
      }
      if (!allowed && isNew) {
        const existingTeamRs = await client.execute({
          sql: 'SELECT id FROM teams WHERE id = ? LIMIT 1',
          args: [teamId],
        });
        if (existingTeamRs.rows.length === 0) {
          const cfgRs = await client.execute({
            sql: 'SELECT data_json FROM configs WHERE discipline_id = ? LIMIT 1',
            args: [team.disciplineId],
          });
          const cfg =
            cfgRs.rows.length > 0
              ? safeParseJson<DisciplineFormatConfig | null>(cfgRs.rows[0].data_json, null)
              : null;
          if (cfg?.inscripcionesAbiertas) allowed = true;
        }
      }
      if (!allowed) {
        res.status(403).json({ error: 'No tienes permisos para crear o editar este equipo.' });
        return;
      }

      const now = new Date().toISOString();
      const sanitizedTeam: Team = {
        ...team,
        id: teamId,
        nombre: String(team.nombre || '').trim().slice(0, 120),
        sigla: String(team.sigla || '').trim().toUpperCase().slice(0, 8),
        createdByUid: team.createdByUid || actor.uid,
      };

      await client.execute({
        sql: `INSERT INTO teams (id, discipline_id, nombre, data_json, created_by_uid, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                discipline_id = excluded.discipline_id,
                nombre = excluded.nombre,
                data_json = excluded.data_json,
                updated_at = excluded.updated_at`,
        args: [
          sanitizedTeam.id,
          sanitizedTeam.disciplineId,
          sanitizedTeam.nombre,
          JSON.stringify(sanitizedTeam),
          sanitizedTeam.createdByUid || actor.uid,
          now,
        ],
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('[Turso] PUT /teams/:teamId failed:', err);
      res.status(500).json({ error: 'No se pudo guardar el equipo.' });
    }
  });

  router.post('/teams/bulk', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor || !isAdminOrModeratorRole(actor.role)) {
        res.status(403).json({ error: 'Solo administración puede actualizar equipos masivamente.' });
        return;
      }
      const teams = Array.isArray(req.body?.teams) ? (req.body.teams as Team[]) : [];
      const clearLogros = Boolean(req.body?.clearLogros);
      const clearAnioFundacion = Boolean(req.body?.clearAnioFundacion);
      const clubName = typeof req.body?.clubName === 'string' ? req.body.clubName : undefined;
      if (teams.length === 0) {
        res.json({ updatedCount: 0 });
        return;
      }
      const now = new Date().toISOString();
      const stmts = teams
        .filter((t) => isValidEntityId(t.id) && isValidDisciplineId(t.disciplineId))
        .map((team) => {
          const nextTeam: Team = {
            ...team,
            ...(clearLogros ? { logrosAnteriores: '' } : {}),
            ...(clearAnioFundacion ? { anioFundacion: undefined } : {}),
            ...(clubName !== undefined ? { clubName: clubName.trim().slice(0, 120) } : {}),
          };
          return {
            sql: `INSERT INTO teams (id, discipline_id, nombre, data_json, created_by_uid, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    discipline_id = excluded.discipline_id,
                    nombre = excluded.nombre,
                    data_json = excluded.data_json,
                    updated_at = excluded.updated_at`,
            args: [
              nextTeam.id,
              nextTeam.disciplineId,
              nextTeam.nombre,
              JSON.stringify(nextTeam),
              nextTeam.createdByUid || actor.uid,
              now,
            ] as InValue[],
          };
        });
      for (let i = 0; i < stmts.length; i += 80) {
        await client.batch(stmts.slice(i, i + 80), 'write');
      }
      res.json({ updatedCount: stmts.length });
    } catch (err) {
      console.error('[Turso] POST /teams/bulk failed:', err);
      res.status(500).json({ error: 'No se pudo completar la actualización masiva de equipos.' });
    }
  });

  router.delete('/teams/:teamId', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const teamId = String(req.params.teamId || '').trim();
    if (!isValidEntityId(teamId)) {
      res.status(400).json({ error: 'ID de equipo inválido.' });
      return;
    }
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor || !isAdminOrModeratorRole(actor.role)) {
        res.status(403).json({ error: 'Solo administración puede eliminar equipos.' });
        return;
      }
      const stmts: Array<{ sql: string; args: InValue[] }> = [
        { sql: 'DELETE FROM teams WHERE id = ?', args: [teamId] },
        { sql: 'DELETE FROM player_private WHERE team_id = ?', args: [teamId] },
        { sql: 'DELETE FROM players WHERE team_id = ?', args: [teamId] },
        { sql: 'DELETE FROM matches WHERE home_team_id = ? OR away_team_id = ?', args: [teamId, teamId] },
      ];
      const extraPlayerIds = Array.isArray(req.body?.playerIds)
        ? (req.body.playerIds as unknown[]).filter(isValidEntityId).slice(0, 120)
        : [];
      const extraMatchIds = Array.isArray(req.body?.matchIds)
        ? (req.body.matchIds as unknown[]).filter(isValidEntityId).slice(0, 200)
        : [];
      for (const pid of extraPlayerIds) {
        stmts.push({ sql: 'DELETE FROM players WHERE id = ?', args: [pid] });
        stmts.push({ sql: 'DELETE FROM player_private WHERE player_id = ?', args: [pid] });
      }
      for (const mid of extraMatchIds) {
        stmts.push({ sql: 'DELETE FROM matches WHERE id = ?', args: [mid] });
      }
      await client.batch(stmts, 'write');
      res.json({ ok: true });
    } catch (err) {
      console.error('[Turso] DELETE /teams/:teamId failed:', err);
      res.status(500).json({ error: 'No se pudo eliminar el equipo.' });
    }
  });

  // -------------------------------------------------------------------------
  // 7. Players CRUD, Stats Update & Isolated PII Storage
  // -------------------------------------------------------------------------
  router.put('/players/:playerId', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const playerId = String(req.params.playerId || '').trim();
    const incoming = req.body?.player as Player | undefined;
    const isNew = Boolean(req.body?.isNew);
    if (!isValidEntityId(playerId) || !incoming || !isValidDisciplineId(incoming.disciplineId)) {
      res.status(400).json({ error: 'Datos de jugador inválidos.' });
      return;
    }
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      let regOpen = false;
      if (isNew) {
        const cfgRs = await client.execute({
          sql: 'SELECT data_json FROM configs WHERE discipline_id = ? LIMIT 1',
          args: [incoming.disciplineId],
        });
        const cfg =
          cfgRs.rows.length > 0
            ? safeParseJson<DisciplineFormatConfig | null>(cfgRs.rows[0].data_json, null)
            : null;
        regOpen = Boolean(cfg?.inscripcionesAbiertas);
      }

      const existingRs = await client.execute({
        sql: 'SELECT data_json FROM players WHERE id = ? LIMIT 1',
        args: [playerId],
      });
      const existingPlayer =
        existingRs.rows.length > 0
          ? safeParseJson<Player | null>(existingRs.rows[0].data_json, null)
          : null;

      const effectiveTeamId = existingPlayer?.teamId || incoming.teamId;
      const authz = canActorEditPlayer(
        actor,
        { id: playerId, teamId: effectiveTeamId },
        !existingPlayer,
        regOpen
      );
      if (!authz.allowed) {
        res.status(403).json({ error: 'No tienes permisos para modificar este jugador.' });
        return;
      }

      const publicPlayer: Player = stripPlayerPii({
        ...incoming,
        id: playerId,
        teamId: authz.restrictStatsAndTeam && existingPlayer ? existingPlayer.teamId : incoming.teamId,
        stats: authz.restrictStatsAndTeam && existingPlayer ? existingPlayer.stats : incoming.stats,
      });

      const searchText = buildPlayerSearchText(publicPlayer);
      const now = new Date().toISOString();

      const stmts: Array<{ sql: string; args: InValue[] }> = [
        {
          sql: `INSERT INTO players (id, team_id, discipline_id, dorsal, nombre, apellido_paterno, search_text, data_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  team_id = excluded.team_id,
                  discipline_id = excluded.discipline_id,
                  dorsal = excluded.dorsal,
                  nombre = excluded.nombre,
                  apellido_paterno = excluded.apellido_paterno,
                  search_text = excluded.search_text,
                  data_json = excluded.data_json,
                  updated_at = excluded.updated_at`,
          args: [
            publicPlayer.id,
            publicPlayer.teamId,
            publicPlayer.disciplineId,
            Number(publicPlayer.dorsal) || 0,
            publicPlayer.nombre || '',
            publicPlayer.apellidoPaterno || '',
            searchText,
            JSON.stringify(publicPlayer),
            now,
          ],
        },
      ];

      const rut = (incoming.rut || '').trim();
      const matricula = (incoming.numeroMatricula || '').trim();
      const correo = (incoming.correoInstitucional || '').trim();
      const fechaNac = (incoming.fechaNacimiento || '').trim();

      if (rut || matricula || correo || fechaNac) {
        stmts.push({
          sql: `INSERT INTO player_private (player_id, team_id, rut, numero_matricula, correo_institucional, fecha_nacimiento, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(player_id) DO UPDATE SET
                  team_id = excluded.team_id,
                  rut = CASE WHEN excluded.rut != '' THEN excluded.rut ELSE player_private.rut END,
                  numero_matricula = CASE WHEN excluded.numero_matricula != '' THEN excluded.numero_matricula ELSE player_private.numero_matricula END,
                  correo_institucional = CASE WHEN excluded.correo_institucional != '' THEN excluded.correo_institucional ELSE player_private.correo_institucional END,
                  fecha_nacimiento = CASE WHEN excluded.fecha_nacimiento != '' THEN excluded.fecha_nacimiento ELSE player_private.fecha_nacimiento END,
                  updated_at = excluded.updated_at`,
          args: [
            publicPlayer.id,
            publicPlayer.teamId,
            rut.slice(0, 20),
            matricula.slice(0, 30),
            correo.slice(0, 160),
            fechaNac.slice(0, 20),
            now,
          ],
        });
      }

      await client.batch(stmts, 'write');
      res.json({ ok: true });
    } catch (err) {
      console.error('[Turso] PUT /players/:playerId failed:', err);
      res.status(500).json({ error: 'No se pudo guardar el jugador.' });
    }
  });

  router.patch('/players/:playerId/stats', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const playerId = String(req.params.playerId || '').trim();
    const stats = req.body?.stats as PlayerStats | undefined;
    if (!isValidEntityId(playerId) || !stats) {
      res.status(400).json({ error: 'Datos de estadísticas inválidos.' });
      return;
    }
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor || !isRefereeOrAdminRole(actor.role)) {
        res.status(403).json({ error: 'Solo árbitros o administración pueden actualizar estadísticas.' });
        return;
      }
      const existingRs = await client.execute({
        sql: 'SELECT data_json FROM players WHERE id = ? LIMIT 1',
        args: [playerId],
      });
      if (existingRs.rows.length === 0) {
        res.status(404).json({ error: 'Jugador no encontrado.' });
        return;
      }
      const existing = safeParseJson<Player | null>(existingRs.rows[0].data_json, null);
      if (!existing) {
        res.status(404).json({ error: 'Jugador no encontrado.' });
        return;
      }
      const updated: Player = stripPlayerPii({ ...existing, stats });
      await client.execute({
        sql: 'UPDATE players SET data_json = ?, updated_at = ? WHERE id = ?',
        args: [JSON.stringify(updated), new Date().toISOString(), playerId],
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('[Turso] PATCH /players/:playerId/stats failed:', err);
      res.status(500).json({ error: 'No se pudieron actualizar las estadísticas del jugador.' });
    }
  });

  router.delete('/players/:playerId', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const playerId = String(req.params.playerId || '').trim();
    if (!isValidEntityId(playerId)) {
      res.status(400).json({ error: 'ID de jugador inválido.' });
      return;
    }
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor || !isAdminOrModeratorRole(actor.role)) {
        res.status(403).json({ error: 'Solo administración puede eliminar jugadores.' });
        return;
      }
      await client.batch(
        [
          { sql: 'DELETE FROM players WHERE id = ?', args: [playerId] },
          { sql: 'DELETE FROM player_private WHERE player_id = ?', args: [playerId] },
        ],
        'write'
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('[Turso] DELETE /players/:playerId failed:', err);
      res.status(500).json({ error: 'No se pudo eliminar el jugador.' });
    }
  });

  // -------------------------------------------------------------------------
  // 8. Matches CRUD
  // -------------------------------------------------------------------------
  router.put('/matches/:matchId', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const matchId = String(req.params.matchId || '').trim();
    const match = req.body?.match as Match | undefined;
    if (!isValidEntityId(matchId) || !match || !isValidDisciplineId(match.disciplineId)) {
      res.status(400).json({ error: 'Datos de partido inválidos.' });
      return;
    }
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor || !isRefereeOrAdminRole(actor.role)) {
        res.status(403).json({ error: 'Solo árbitros o administración pueden modificar partidos.' });
        return;
      }
      const sanitized: Match = { ...match, id: matchId };
      const now = new Date().toISOString();
      await client.execute({
        sql: `INSERT INTO matches (id, discipline_id, home_team_id, away_team_id, status, data_json, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                discipline_id = excluded.discipline_id,
                home_team_id = excluded.home_team_id,
                away_team_id = excluded.away_team_id,
                status = excluded.status,
                data_json = excluded.data_json,
                updated_at = excluded.updated_at`,
        args: [
          sanitized.id,
          sanitized.disciplineId,
          sanitized.homeTeamId,
          sanitized.awayTeamId,
          sanitized.status,
          JSON.stringify(sanitized),
          now,
        ],
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('[Turso] PUT /matches/:matchId failed:', err);
      res.status(500).json({ error: 'No se pudo guardar el partido.' });
    }
  });

  router.delete('/matches/batch', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor || !isAdminOrModeratorRole(actor.role)) {
        res.status(403).json({ error: 'Solo administración puede eliminar partidos.' });
        return;
      }
      const matchIds = Array.isArray(req.body?.matchIds)
        ? (req.body.matchIds as unknown[]).filter(isValidEntityId)
        : [];
      if (matchIds.length === 0) {
        res.json({ ok: true, deleted: 0 });
        return;
      }
      const stmts = matchIds.map((id) => ({
        sql: 'DELETE FROM matches WHERE id = ?',
        args: [id] as InValue[],
      }));
      for (let i = 0; i < stmts.length; i += 100) {
        await client.batch(stmts.slice(i, i + 100), 'write');
      }
      res.json({ ok: true, deleted: stmts.length });
    } catch (err) {
      console.error('[Turso] DELETE /matches/batch failed:', err);
      res.status(500).json({ error: 'No se pudieron eliminar los partidos.' });
    }
  });

  // -------------------------------------------------------------------------
  // 9. Transfers (Create, Approve atomically moving player, Reject)
  // -------------------------------------------------------------------------
  router.post('/transfers', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const transfer = req.body?.transfer as TransferRecord | undefined;
    if (!transfer || !isValidEntityId(transfer.id) || !isValidDisciplineId(transfer.disciplineId)) {
      res.status(400).json({ error: 'Datos de transferencia inválidos.' });
      return;
    }
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      const existingTransferRs = await client.execute({
        sql: 'SELECT data_json FROM transfers WHERE id = ? LIMIT 1',
        args: [transfer.id],
      });
      if (existingTransferRs.rows.length > 0) {
        const existingTransfer = safeParseJson<TransferRecord | null>(
          existingTransferRs.rows[0].data_json,
          null
        );
        if (existingTransfer && !canActorManageTransfer(actor, existingTransfer)) {
          res.status(403).json({ error: 'No tienes permisos para modificar esta transferencia.' });
          return;
        }
      }
      if (!canActorManageTransfer(actor, transfer)) {
        res.status(403).json({ error: 'No tienes permisos para solicitar esta transferencia.' });
        return;
      }
      const now = new Date().toISOString();
      const record: TransferRecord = {
        ...transfer,
        createdByUid: actor!.uid,
        updatedAt: now,
      };
      await client.execute({
        sql: `INSERT INTO transfers (id, discipline_id, estado, from_team_id, to_team_id, fecha, data_json, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                estado = excluded.estado,
                data_json = excluded.data_json,
                updated_at = excluded.updated_at`,
        args: [
          record.id,
          record.disciplineId,
          record.estado,
          record.fromTeamId,
          record.toTeamId,
          record.fecha || now.slice(0, 10),
          JSON.stringify(record),
          now,
        ],
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('[Turso] POST /transfers failed:', err);
      res.status(500).json({ error: 'No se pudo registrar la solicitud de transferencia.' });
    }
  });

  router.patch('/transfers/:id/approve', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const transferId = String(req.params.id || '').trim();
    const updatedTransfer = req.body?.transfer as TransferRecord | undefined;
    if (!isValidEntityId(transferId) || !updatedTransfer) {
      res.status(400).json({ error: 'Datos de transferencia inválidos.' });
      return;
    }
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      const existingRs = await client.execute({
        sql: 'SELECT data_json FROM transfers WHERE id = ? LIMIT 1',
        args: [transferId],
      });
      const existingTransfer =
        existingRs.rows.length > 0
          ? safeParseJson<TransferRecord | null>(existingRs.rows[0].data_json, null)
          : null;

      if (!existingTransfer && (!actor || !isAdminOrModeratorRole(actor.role))) {
        res.status(404).json({ error: 'Transferencia no encontrada.' });
        return;
      }

      const authTarget = existingTransfer || updatedTransfer;
      if (!canActorManageTransfer(actor, authTarget)) {
        res.status(403).json({ error: 'No tienes permisos para aprobar esta transferencia.' });
        return;
      }

      const now = new Date().toISOString();
      const record: TransferRecord = existingTransfer && !isAdminOrModeratorRole(actor!.role)
        ? {
            ...existingTransfer,
            ...updatedTransfer,
            id: transferId,
            playerId: existingTransfer.playerId,
            fromTeamId: existingTransfer.fromTeamId,
            toTeamId: existingTransfer.toTeamId,
            disciplineId: existingTransfer.disciplineId,
            updatedAt: now,
          }
        : { ...updatedTransfer, id: transferId, updatedAt: now };

      const stmts: Array<{ sql: string; args: InValue[] }> = [
        {
          sql: `INSERT INTO transfers (id, discipline_id, estado, from_team_id, to_team_id, fecha, data_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  estado = excluded.estado,
                  data_json = excluded.data_json,
                  updated_at = excluded.updated_at`,
          args: [
            record.id,
            record.disciplineId,
            record.estado,
            record.fromTeamId,
            record.toTeamId,
            record.fecha || now.slice(0, 10),
            JSON.stringify(record),
            now,
          ],
        },
      ];

      if (record.estado === 'APROBADA' && isValidEntityId(record.playerId)) {
        const pRs = await client.execute({
          sql: 'SELECT data_json FROM players WHERE id = ? LIMIT 1',
          args: [record.playerId],
        });
        if (pRs.rows.length > 0) {
          const existingP = safeParseJson<Player | null>(pRs.rows[0].data_json, null);
          if (existingP) {
            const moved = stripPlayerPii({ ...existingP, teamId: record.toTeamId });
            stmts.push({
              sql: 'UPDATE players SET team_id = ?, data_json = ?, updated_at = ? WHERE id = ?',
              args: [record.toTeamId, JSON.stringify(moved), now, record.playerId],
            });
          }
        }
        stmts.push({
          sql: 'UPDATE player_private SET team_id = ?, updated_at = ? WHERE player_id = ?',
          args: [record.toTeamId, now, record.playerId],
        });
      }

      await client.batch(stmts, 'write');
      res.json({ ok: true });
    } catch (err) {
      console.error('[Turso] PATCH /transfers/:id/approve failed:', err);
      res.status(500).json({ error: 'No se pudo aprobar la transferencia.' });
    }
  });

  router.patch('/transfers/:id/reject', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const transferId = String(req.params.id || '').trim();
    if (!isValidEntityId(transferId)) {
      res.status(400).json({ error: 'ID de transferencia inválido.' });
      return;
    }
    try {
      const existingRs = await client.execute({
        sql: 'SELECT data_json FROM transfers WHERE id = ? LIMIT 1',
        args: [transferId],
      });
      if (existingRs.rows.length === 0) {
        res.status(404).json({ error: 'Transferencia no encontrada.' });
        return;
      }
      const existingTransfer = safeParseJson<TransferRecord | null>(existingRs.rows[0].data_json, null);
      if (!existingTransfer) {
        res.status(404).json({ error: 'Transferencia no encontrada.' });
        return;
      }
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!canActorManageTransfer(actor, existingTransfer)) {
        res.status(403).json({ error: 'No tienes permisos para rechazar esta transferencia.' });
        return;
      }
      const now = new Date().toISOString();
      const record: TransferRecord = {
        ...existingTransfer,
        id: transferId,
        estado: 'RECHAZADA',
        rejectedByUid: actor!.uid,
        rejectedAt: now,
        updatedAt: now,
      };
      await client.execute({
        sql: 'UPDATE transfers SET estado = ?, data_json = ?, updated_at = ? WHERE id = ?',
        args: ['RECHAZADA', JSON.stringify(record), now, transferId],
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('[Turso] PATCH /transfers/:id/reject failed:', err);
      res.status(500).json({ error: 'No se pudo rechazar la transferencia.' });
    }
  });

  // -------------------------------------------------------------------------
  // 10. News & Gallery Photos CRUD
  // -------------------------------------------------------------------------
  router.put('/news/:newsId', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const newsId = String(req.params.newsId || '').trim();
    const article = req.body?.article as NewsArticle | undefined;
    if (!isValidEntityId(newsId) || !article) {
      res.status(400).json({ error: 'Datos de noticia inválidos.' });
      return;
    }
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor || !isPressOrAdminRole(actor.role)) {
        res.status(403).json({ error: 'Solo prensa o administración pueden publicar noticias.' });
        return;
      }
      const now = new Date().toISOString();
      const record: NewsArticle = {
        ...article,
        id: newsId,
        authorUid: article.authorUid || actor.uid,
        createdAt: article.createdAt || now,
        updatedAt: now,
      };
      await client.execute({
        sql: `INSERT INTO news (id, published, created_at, data_json, updated_at)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                published = excluded.published,
                data_json = excluded.data_json,
                updated_at = excluded.updated_at`,
        args: [record.id, record.published ? 1 : 0, record.createdAt, JSON.stringify(record), now],
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('[Turso] PUT /news/:newsId failed:', err);
      res.status(500).json({ error: 'No se pudo guardar la noticia.' });
    }
  });

  router.delete('/news/:newsId', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const newsId = String(req.params.newsId || '').trim();
    if (!isValidEntityId(newsId)) {
      res.status(400).json({ error: 'ID de noticia inválido.' });
      return;
    }
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor || !isPressOrAdminRole(actor.role)) {
        res.status(403).json({ error: 'Solo prensa o administración pueden eliminar noticias.' });
        return;
      }
      await client.execute({ sql: 'DELETE FROM news WHERE id = ?', args: [newsId] });
      res.json({ ok: true });
    } catch (err) {
      console.error('[Turso] DELETE /news/:newsId failed:', err);
      res.status(500).json({ error: 'No se pudo eliminar la noticia.' });
    }
  });

  router.put('/photos/:photoId', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const photoId = String(req.params.photoId || '').trim();
    const photo = req.body?.photo as PhotoEntry | undefined;
    if (!isValidEntityId(photoId) || !photo) {
      res.status(400).json({ error: 'Datos de fotografía inválidos.' });
      return;
    }
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor || !isPhotographerOrPressOrAdminRole(actor.role)) {
        res.status(403).json({ error: 'Solo fotógrafos, prensa o administración pueden subir fotos.' });
        return;
      }
      const now = new Date().toISOString();
      const record: PhotoEntry = {
        ...photo,
        id: photoId,
        photographerUid: actor.uid,
        createdAt: photo.createdAt || now,
      };
      await client.execute({
        sql: `INSERT INTO photos (id, discipline_id, source, created_at, data_json)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                discipline_id = excluded.discipline_id,
                source = excluded.source,
                data_json = excluded.data_json`,
        args: [
          record.id,
          String(record.disciplineId || 'general'),
          record.source || 'upload',
          record.createdAt,
          JSON.stringify(record),
        ],
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('[Turso] PUT /photos/:photoId failed:', err);
      res.status(500).json({ error: 'No se pudo guardar la fotografía.' });
    }
  });

  router.delete('/photos/:photoId', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const photoId = String(req.params.photoId || '').trim();
    if (!isValidEntityId(photoId)) {
      res.status(400).json({ error: 'ID de foto inválido.' });
      return;
    }
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor || !isPhotographerOrPressOrAdminRole(actor.role)) {
        res.status(403).json({ error: 'No tienes permisos para eliminar fotografías.' });
        return;
      }
      if (!isPressOrAdminRole(actor.role)) {
        const photoRs = await client.execute({
          sql: 'SELECT data_json FROM photos WHERE id = ? LIMIT 1',
          args: [photoId],
        });
        const existingPhoto =
          photoRs.rows.length > 0
            ? safeParseJson<PhotoEntry | null>(photoRs.rows[0].data_json, null)
            : null;
        if (existingPhoto && existingPhoto.photographerUid && existingPhoto.photographerUid !== actor.uid) {
          res.status(403).json({ error: 'Solo puedes eliminar fotografías subidas por tu cuenta.' });
          return;
        }
      }
      await client.execute({ sql: 'DELETE FROM photos WHERE id = ?', args: [photoId] });
      res.json({ ok: true });
    } catch (err) {
      console.error('[Turso] DELETE /photos/:photoId failed:', err);
      res.status(500).json({ error: 'No se pudo eliminar la fotografía.' });
    }
  });

  // -------------------------------------------------------------------------
  // 11. Votes (Match MVP, Award Nominees, Championship MVP, Position Awards, TOTY, Leyendas)
  // -------------------------------------------------------------------------
  router.post('/votes/mvp', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client || !req.firebaseUser) return;
    const body = req.body || {};
    if (!isValidEntityId(body.matchId) || !isValidDisciplineId(body.disciplineId) || !isValidEntityId(body.playerId)) {
      res.status(400).json({ error: 'Datos de voto MVP inválidos.' });
      return;
    }
    try {
      const voterUid = req.firebaseUser.uid;
      const id = `${body.matchId}_${voterUid}`;
      const now = new Date().toISOString();
      const record: MvpVoteRecord = {
        id,
        matchId: body.matchId,
        disciplineId: body.disciplineId,
        playerId: body.playerId,
        playerName: String(body.playerName || '').slice(0, 120),
        teamId: String(body.teamId || ''),
        voterUid,
        voterName: String(body.voterName || req.firebaseUser.name || 'Estudiante UFRO').slice(0, 120),
        createdAt: now,
      };
      await client.execute({
        sql: `INSERT INTO mvp_votes (id, match_id, discipline_id, voter_uid, data_json, created_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, created_at = excluded.created_at`,
        args: [id, record.matchId, record.disciplineId, voterUid, JSON.stringify(record), now],
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('[Turso] POST /votes/mvp failed:', err);
      res.status(500).json({ error: 'No se pudo registrar tu voto MVP.' });
    }
  });

  router.put('/award-nominees/:disciplineId', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const discId = String(req.params.disciplineId || '');
    if (!isValidDisciplineId(discId)) {
      res.status(400).json({ error: 'Disciplina inválida.' });
      return;
    }
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor || !isAdminOrModeratorRole(actor.role)) {
        res.status(403).json({ error: 'Solo administración puede definir nominados.' });
        return;
      }
      const nominees = Array.isArray(req.body?.mvpNomineeIds)
        ? (req.body.mvpNomineeIds as unknown[]).filter(isValidEntityId).slice(0, 5)
        : [];
      const temporada = String(req.body?.temporada || '2026').slice(0, 16);
      const now = new Date().toISOString();
      await client.execute({
        sql: `INSERT INTO award_nominees (discipline_id, temporada, nominees_json, updated_at)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(discipline_id) DO UPDATE SET
                temporada = excluded.temporada,
                nominees_json = excluded.nominees_json,
                updated_at = excluded.updated_at`,
        args: [discId, temporada, JSON.stringify(nominees), now],
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('[Turso] PUT /award-nominees failed:', err);
      res.status(500).json({ error: 'No se pudieron guardar los nominados.' });
    }
  });

  router.post('/votes/championship-mvp', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client || !req.firebaseUser) return;
    const body = req.body || {};
    if (!isValidDisciplineId(body.disciplineId) || !isValidEntityId(body.playerId)) {
      res.status(400).json({ error: 'Datos de voto MVP del campeonato inválidos.' });
      return;
    }
    try {
      const voterUid = req.firebaseUser.uid;
      const id = `${body.disciplineId}_${voterUid}`;
      const now = new Date().toISOString();
      const record: ChampionshipMvpVoteRecord = {
        id,
        disciplineId: body.disciplineId,
        temporada: String(body.temporada || '2026').slice(0, 16),
        voterUid,
        playerId: body.playerId,
        playerName: String(body.playerName || '').slice(0, 120),
        teamId: String(body.teamId || ''),
        createdAt: now,
        updatedAt: now,
      };
      await client.execute({
        sql: `INSERT INTO championship_mvp_votes (id, discipline_id, voter_uid, data_json, updated_at)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`,
        args: [id, record.disciplineId, voterUid, JSON.stringify(record), now],
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('[Turso] POST /votes/championship-mvp failed:', err);
      res.status(500).json({ error: 'No se pudo registrar tu voto al MVP del campeonato.' });
    }
  });

  router.post('/votes/position-award', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client || !req.firebaseUser) return;
    const body = req.body || {};
    if (
      !isValidDisciplineId(body.disciplineId) ||
      !isValidEntityId(body.positionKey) ||
      !isValidEntityId(body.playerId)
    ) {
      res.status(400).json({ error: 'Datos de voto por posición inválidos.' });
      return;
    }
    try {
      const voterUid = req.firebaseUser.uid;
      const id = `${body.disciplineId}_${body.positionKey}_${voterUid}`;
      const now = new Date().toISOString();
      const record: PositionAwardVoteRecord = {
        id,
        disciplineId: body.disciplineId,
        temporada: String(body.temporada || '2026').slice(0, 16),
        positionKey: String(body.positionKey).slice(0, 60),
        positionLabel: String(body.positionLabel || body.positionKey).slice(0, 80),
        voterUid,
        playerId: body.playerId,
        playerName: String(body.playerName || '').slice(0, 120),
        teamId: String(body.teamId || ''),
        createdAt: now,
        updatedAt: now,
      };
      await client.execute({
        sql: `INSERT INTO position_award_votes (id, discipline_id, position_key, voter_uid, data_json, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`,
        args: [id, record.disciplineId, record.positionKey, voterUid, JSON.stringify(record), now],
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('[Turso] POST /votes/position-award failed:', err);
      res.status(500).json({ error: 'No se pudo registrar tu voto por posición.' });
    }
  });

  router.post('/toty/ballots/batch', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client || !req.firebaseUser) return;
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (rawItems.length === 0) {
      res.json({ committed: 0 });
      return;
    }
    try {
      const voterUid = req.firebaseUser.uid;
      const now = new Date().toISOString();
      const stmts: Array<{ sql: string; args: InValue[] }> = [];

      for (const item of rawItems.slice(0, 16)) {
        const ballot = item?.ballot as TotyBallotRecord | undefined;
        if (!ballot || !isValidDisciplineId(ballot.disciplineId)) continue;
        const id = `${ballot.disciplineId}_${voterUid}`;
        const sanitizedSelections: Record<string, string> = {};
        if (ballot.selections && typeof ballot.selections === 'object') {
          for (const [k, v] of Object.entries(ballot.selections).slice(0, 12)) {
            if (typeof k === 'string' && typeof v === 'string' && v.trim()) {
              sanitizedSelections[k.trim().slice(0, 40)] = v.trim().slice(0, 160);
            }
          }
        }
        const record: TotyBallotRecord = {
          id,
          disciplineId: ballot.disciplineId,
          temporada: String(ballot.temporada || '2026').slice(0, 16),
          voterUid,
          selections: sanitizedSelections,
          updatedAt: now,
        };
        stmts.push({
          sql: `INSERT INTO toty_ballots (id, discipline_id, voter_uid, data_json, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`,
          args: [id, record.disciplineId, voterUid, JSON.stringify(record), now],
        });
      }

      if (stmts.length > 0) {
        await client.batch(stmts, 'write');
      }
      res.json({ committed: stmts.length });
    } catch (err) {
      console.error('[Turso] POST /toty/ballots/batch failed:', err);
      res.status(500).json({ error: 'No se pudieron guardar tus papeletas de TOTYs.' });
    }
  });

  router.put('/toty/config/:disciplineId', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const discId = String(req.params.disciplineId || '');
    if (!isValidDisciplineId(discId)) {
      res.status(400).json({ error: 'Disciplina inválida.' });
      return;
    }
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor || !isAdminOrModeratorRole(actor.role)) {
        res.status(403).json({ error: 'Solo administración puede editar la formación TOTY.' });
        return;
      }
      const now = new Date().toISOString();
      const config: DisciplineTotyConfig = {
        ...(req.body?.config || {}),
        disciplineId: discId,
        updatedAt: now,
      };
      await client.execute({
        sql: `INSERT INTO toty_configs (discipline_id, data_json, updated_at)
              VALUES (?, ?, ?)
              ON CONFLICT(discipline_id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`,
        args: [discId, JSON.stringify(config), now],
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('[Turso] PUT /toty/config failed:', err);
      res.status(500).json({ error: 'No se pudo guardar la configuración TOTY.' });
    }
  });

  router.delete('/toty/config/:disciplineId', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client) return;
    const discId = String(req.params.disciplineId || '');
    if (!isValidDisciplineId(discId)) {
      res.status(400).json({ error: 'Disciplina inválida.' });
      return;
    }
    try {
      const actor = await resolveActorProfile(client, req.firebaseUser);
      if (!actor || !isAdminOrModeratorRole(actor.role)) {
        res.status(403).json({ error: 'Solo administración puede restablecer la formación TOTY.' });
        return;
      }
      await client.execute({
        sql: 'DELETE FROM toty_configs WHERE discipline_id = ?',
        args: [discId],
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('[Turso] DELETE /toty/config failed:', err);
      res.status(500).json({ error: 'No se pudo restablecer la configuración TOTY.' });
    }
  });

  router.post(
    '/toty/migrate-from-firestore',
    requireFirebaseAuth,
    async (req: AuthedRequest, res: Response) => {
      const client = await getDbOrRespond(res);
      if (!client) return;
      try {
        const actor = await resolveActorProfile(client, req.firebaseUser);
        if (!actor || !isAdminOrModeratorRole(actor.role)) {
          res.status(403).json({
            error: 'Solo administradores o moderadores pueden migrar papeletas desde Firestore.',
          });
          return;
        }

        const meta = loadFirestoreAppletMeta();
        if (!meta) {
          res.status(500).json({
            error: 'No se encontró la configuración del proyecto Firestore para leer las papeletas.',
          });
          return;
        }

        const authHeader = req.headers.authorization;
        const [ballotsRes, configsRes] = await Promise.all([
          fetchAllFirestoreRestCollection({
            meta,
            collectionName: 'toty_ballots',
            authHeader,
          }),
          fetchAllFirestoreRestCollection({
            meta,
            collectionName: 'toty_configs',
            authHeader,
          }),
        ]);

        if (ballotsRes.quotaExceeded || configsRes.quotaExceeded) {
          res.status(429).json({
            quotaExceeded: true,
            error:
              'La cuota diaria gratuita de lecturas de Firestore aún sigue agotada hoy. Cuando Google la reinicie mañana, vuelve a presionar este botón para copiar todas las papeletas a Turso automáticamente.',
          });
          return;
        }

        if (ballotsRes.errorStatus || configsRes.errorStatus) {
          res.status(502).json({
            error:
              ballotsRes.errorMessage ||
              configsRes.errorMessage ||
              'No se pudieron leer las papeletas desde Firestore.',
          });
          return;
        }

        const now = new Date().toISOString();
        const ballots = ballotsRes.documents
          .map((d) => parseFirestoreTotyBallotDocument(d, now))
          .filter((b): b is TotyBallotRecord => Boolean(b));
        const configs = configsRes.documents
          .map((d) => parseFirestoreTotyConfigDocument(d, now))
          .filter((c): c is DisciplineTotyConfig => Boolean(c));

        await upsertTotyRecordsInTurso(client, ballots, configs);

        const [allBallotsRs, allConfigsRs] = await client.batch(
          [
            { sql: 'SELECT data_json FROM toty_ballots ORDER BY updated_at DESC', args: [] },
            { sql: 'SELECT discipline_id, data_json FROM toty_configs', args: [] },
          ],
          'read'
        );

        const allBallots = allBallotsRs.rows
          .map((r) => safeParseJson<TotyBallotRecord | null>(r.data_json, null))
          .filter((b): b is TotyBallotRecord => Boolean(b));
        const allConfigs: Partial<Record<DisciplineId, DisciplineTotyConfig>> = {};
        for (const row of allConfigsRs.rows) {
          const d = String(row.discipline_id);
          if (isValidDisciplineId(d)) {
            const parsed = safeParseJson<DisciplineTotyConfig | null>(row.data_json, null);
            if (parsed) allConfigs[d] = parsed;
          }
        }

        res.json({
          ok: true,
          migratedBallots: ballots.length,
          migratedConfigs: configs.length,
          ballots: allBallots,
          configs: allConfigs,
        });
      } catch (err) {
        console.error('[Turso] POST /toty/migrate-from-firestore failed:', err);
        res.status(500).json({ error: 'No se pudo completar la migración de papeletas desde Firestore.' });
      }
    }
  );

  router.post(
    '/toty/import-admin',
    requireFirebaseAuth,
    async (req: AuthedRequest, res: Response) => {
      const client = await getDbOrRespond(res);
      if (!client) return;
      try {
        const actor = await resolveActorProfile(client, req.firebaseUser);
        if (!actor || !isAdminOrModeratorRole(actor.role)) {
          res.status(403).json({
            error: 'Solo administradores o moderadores pueden importar papeletas de usuarios.',
          });
          return;
        }

        const now = new Date().toISOString();
        const rawBallots = Array.isArray(req.body?.ballots) ? req.body.ballots.slice(0, 5000) : [];
        const rawConfigsObj =
          req.body?.configs && typeof req.body.configs === 'object'
            ? (req.body.configs as Record<string, unknown>)
            : {};

        const ballots = rawBallots
          .map((item: unknown) => sanitizeAdminImportedTotyBallot(item, now))
          .filter((b: TotyBallotRecord | null): b is TotyBallotRecord => Boolean(b));

        const configs = Object.values(rawConfigsObj)
          .slice(0, 16)
          .map((item: unknown) => sanitizeAdminImportedTotyConfig(item, now))
          .filter((c: DisciplineTotyConfig | null): c is DisciplineTotyConfig => Boolean(c));

        await upsertTotyRecordsInTurso(client, ballots, configs);

        const [allBallotsRs, allConfigsRs] = await client.batch(
          [
            { sql: 'SELECT data_json FROM toty_ballots ORDER BY updated_at DESC', args: [] },
            { sql: 'SELECT discipline_id, data_json FROM toty_configs', args: [] },
          ],
          'read'
        );

        const allBallots = allBallotsRs.rows
          .map((r) => safeParseJson<TotyBallotRecord | null>(r.data_json, null))
          .filter((b): b is TotyBallotRecord => Boolean(b));
        const allConfigs: Partial<Record<DisciplineId, DisciplineTotyConfig>> = {};
        for (const row of allConfigsRs.rows) {
          const d = String(row.discipline_id);
          if (isValidDisciplineId(d)) {
            const parsed = safeParseJson<DisciplineTotyConfig | null>(row.data_json, null);
            if (parsed) allConfigs[d] = parsed;
          }
        }

        res.json({
          ok: true,
          importedBallots: ballots.length,
          importedConfigs: configs.length,
          ballots: allBallots,
          configs: allConfigs,
        });
      } catch (err) {
        console.error('[Turso] POST /toty/import-admin failed:', err);
        res.status(500).json({ error: 'No se pudieron importar las papeletas a Turso.' });
      }
    }
  );

  router.post('/leyendas', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const client = await getDbOrRespond(res);
    if (!client || !req.firebaseUser) return;
    const entry = req.body?.entry as LeyendasLeaderboardEntry | undefined;
    if (!entry || !isValidEntityId(entry.id)) {
      res.status(400).json({ error: 'Datos de partida de Leyendas UFRO inválidos.' });
      return;
    }
    try {
      const uid = req.firebaseUser.uid;
      const existingRs = await client.execute({
        sql: 'SELECT uid FROM leyendas_leaderboard WHERE id = ? LIMIT 1',
        args: [entry.id],
      });
      if (existingRs.rows.length > 0 && String(existingRs.rows[0].uid || '') !== uid) {
        res.status(403).json({ error: 'No puedes sobrescribir el puntaje de otro usuario.' });
        return;
      }
      const now = new Date().toISOString();
      const record: LeyendasLeaderboardEntry = {
        ...entry,
        uid,
        createdAt: entry.createdAt || now,
      };
      await client.execute({
        sql: `INSERT INTO leyendas_leaderboard (id, sport_key, week_key, score, uid, data_json, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                score = excluded.score,
                data_json = excluded.data_json`,
        args: [
          record.id,
          record.sportKey,
          record.weekKey || '2026-W01',
          Number(record.score) || 0,
          uid,
          JSON.stringify(record),
          record.createdAt,
        ],
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('[Turso] POST /leyendas failed:', err);
      res.status(500).json({ error: 'No se pudo registrar tu puntaje en Leyendas UFRO.' });
    }
  });

  return router;
}
