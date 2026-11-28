import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPlayerSearchText,
  canActorEditPlayer,
  canActorManageTransfer,
  canActorReadPlayerPii,
  normalizeSearchText,
  resolveBootstrapRole,
  stripPlayerPii,
  stripTeamPrivateFields,
} from './tursoHelpers.ts';
import type { Player, Team } from '../types/tournament';

test('normalizeSearchText removes Spanish diacritics and extra spaces', () => {
  assert.equal(normalizeSearchText('  Matías   Núñez-Peña  '), 'matias nunez-pena');
  assert.equal(normalizeSearchText('INGENIERÍA CIVIL'), 'ingenieria civil');
});

test('buildPlayerSearchText combines name, career, position, and dorsal cleanly', () => {
  const txt = buildPlayerSearchText({
    nombre: 'Sebastián',
    apellidoPaterno: 'Araya',
    apellidoMaterno: 'Muñoz',
    carrera: 'Ingeniería Informática',
    posicion: 'Portero',
    dorsal: 1,
  });
  assert.equal(txt, 'sebastian araya munoz ingenieria informatica portero 1');
});

test('stripPlayerPii and stripTeamPrivateFields remove sensitive fields without mutating originals', () => {
  const player = {
    id: 'p1',
    teamId: 't1',
    disciplineId: 'f7-h-1',
    dorsal: 9,
    posicion: 'Delantero',
    nombre: 'Matías',
    apellidoPaterno: 'Soto',
    apellidoMaterno: '',
    carrera: 'Informática',
    facultad: 'Ingeniería',
    rut: '20.111.222-3',
    numeroMatricula: '20241234',
    correoInstitucional: 'm.soto@ufromail.cl',
    nivelAcademico: 'Pregrado',
    fechaNacimiento: '2003-05-01',
    fotografia: '',
    esSeleccionadoUfro: false,
    stats: {
      partidosJugados: 1,
      goles: 2,
      asistencias: 1,
      tarjetasAmarillas: 0,
      tarjetasRojas: 0,
      puntos: 0,
      rebotes: 0,
      triples: 0,
      faltas: 0,
      aces: 0,
      bloqueos: 0,
    },
  } as Player;

  const pub = stripPlayerPii(player);
  assert.equal(pub.rut, '');
  assert.equal(pub.numeroMatricula, '');
  assert.equal(pub.correoInstitucional, '');
  assert.equal(pub.fechaNacimiento, '');
  assert.equal(player.rut, '20.111.222-3');

  const team: Team = {
    id: 't1',
    nombre: 'Informática FC',
    sigla: 'INF',
    disciplineId: 'f7-h-1',
    carrera: 'Informática',
    facultad: 'Ingeniería',
    groupName: 'Grupo A',
    capitanCorreo: 'cap@ufromail.cl',
  };
  const pubTeam = stripTeamPrivateFields(team);
  assert.equal(pubTeam.capitanCorreo, undefined);
  assert.equal(team.capitanCorreo, 'cap@ufromail.cl');
});

test('resolveBootstrapRole elevates primary admin and protects against self-escalation', () => {
  assert.equal(resolveBootstrapRole('A.SOTOMILLAPAN@GMAIL.COM'), 'admin');
  assert.equal(resolveBootstrapRole('student@ufromail.cl'), 'tradicional');
  assert.equal(resolveBootstrapRole('ref@ufromail.cl', 'arbitro'), 'arbitro');
});

test('canActorReadPlayerPii enforces admin/moderator, own team delegate, and own linked player', () => {
  assert.equal(canActorReadPlayerPii(null, 'p1', 't1'), false);
  assert.equal(canActorReadPlayerPii({ role: 'tradicional' }, 'p1', 't1'), false);
  assert.equal(canActorReadPlayerPii({ role: 'admin' }, 'p1', 't1'), true);
  assert.equal(canActorReadPlayerPii({ role: 'moderador' }, 'p1', 't1'), true);
  assert.equal(
    canActorReadPlayerPii({ role: 'delegado', delegatedTeamId: 't1' }, 'p1', 't1'),
    true
  );
  assert.equal(
    canActorReadPlayerPii({ role: 'delegado', delegatedTeamId: 't2' }, 'p1', 't1'),
    false
  );
  assert.equal(
    canActorReadPlayerPii({ role: 'jugador', linkedPlayerId: 'p1' }, 'p1', 't1'),
    true
  );
  assert.equal(
    canActorReadPlayerPii({ role: 'jugador', linkedPlayerId: 'p2' }, 'p1', 't1'),
    false
  );
});

test('canActorEditPlayer restricts stats/team mutations for non-admin actors', () => {
  assert.deepEqual(
    canActorEditPlayer({ role: 'admin' }, { id: 'p1', teamId: 't1' }, false),
    { allowed: true, restrictStatsAndTeam: false }
  );
  assert.deepEqual(
    canActorEditPlayer(
      { role: 'delegado', delegatedTeamId: 't1' },
      { id: 'p1', teamId: 't1' },
      false
    ),
    { allowed: true, restrictStatsAndTeam: true }
  );
  assert.deepEqual(
    canActorEditPlayer(
      { role: 'delegado', delegatedTeamId: 't2' },
      { id: 'p1', teamId: 't1' },
      false
    ),
    { allowed: false, restrictStatsAndTeam: true }
  );
  assert.deepEqual(
    canActorEditPlayer(
      { role: 'tradicional' },
      { id: 'p-new', teamId: 't1' },
      true,
      true
    ),
    { allowed: true, restrictStatsAndTeam: true }
  );
  assert.deepEqual(
    canActorEditPlayer(
      { role: 'tradicional' },
      { id: 'p-new', teamId: 't1' },
      true,
      false
    ),
    { allowed: false, restrictStatsAndTeam: true }
  );
});

test('canActorManageTransfer restricts delegate actions to involved teams only', () => {
  assert.equal(
    canActorManageTransfer({ role: 'delegado', delegatedTeamId: 't1' }, { fromTeamId: 't1', toTeamId: 't2' }),
    true
  );
  assert.equal(
    canActorManageTransfer({ role: 'delegado', delegatedTeamId: 't2' }, { fromTeamId: 't1', toTeamId: 't2' }),
    true
  );
  assert.equal(
    canActorManageTransfer({ role: 'delegado', delegatedTeamId: 't3' }, { fromTeamId: 't1', toTeamId: 't2' }),
    false
  );
  assert.equal(
    canActorManageTransfer({ role: 'admin' }, { fromTeamId: 't1', toTeamId: 't2' }),
    true
  );
});

test('resolveTursoCredentialsFromEnv strips accidental quotes and supports standard Turso/libSQL aliases', async () => {
  const { resolveTursoCredentialsFromEnv } = await import('./tursoHelpers.ts');

  assert.deepEqual(
    resolveTursoCredentialsFromEnv({
      TURSO_DATABASE_URL: ' "libsql://demo-ufro.turso.io" ',
      TURSO_AUTH_TOKEN: "'tok_123'",
    }),
    { url: 'libsql://demo-ufro.turso.io', authToken: 'tok_123' }
  );

  assert.deepEqual(
    resolveTursoCredentialsFromEnv({
      LIBSQL_URL: 'libsql://alt-ufro.turso.io',
      LIBSQL_AUTH_TOKEN: 'tok_alt',
    }),
    { url: 'libsql://alt-ufro.turso.io', authToken: 'tok_alt' }
  );

  assert.deepEqual(
    resolveTursoCredentialsFromEnv({
      DATABASE_URL: 'postgresql://user:pass@host/db',
    }),
    { url: '', authToken: '' }
  );
});

test('parseFirestoreTotyBallotDocument and parseFirestoreTotyConfigDocument decode Firestore REST payloads accurately', async () => {
  const {
    parseFirestoreTotyBallotDocument,
    parseFirestoreTotyConfigDocument,
    sanitizeAdminImportedTotyBallot,
  } = await import('./tursoHelpers.ts');

  const ballot = parseFirestoreTotyBallotDocument(
    {
      name: 'projects/p/databases/d/documents/toty_ballots/f7-h-1_user123',
      fields: {
        disciplineId: { stringValue: 'f7-h-1' },
        temporada: { stringValue: '2026' },
        voterUid: { stringValue: 'user123' },
        updatedAt: { timestampValue: '2026-11-20T12:00:00Z' },
        selections: {
          mapValue: {
            fields: {
              'arquero-1': { stringValue: 'player-a' },
              'delantero-1': { stringValue: 'player-b' },
            },
          },
        },
      },
    },
    '2026-11-28T00:00:00Z'
  );

  assert.deepEqual(ballot, {
    id: 'f7-h-1_user123',
    disciplineId: 'f7-h-1',
    temporada: '2026',
    voterUid: 'user123',
    selections: {
      'arquero-1': 'player-a',
      'delantero-1': 'player-b',
    },
    updatedAt: '2026-11-20T12:00:00Z',
  });

  const cfg = parseFirestoreTotyConfigDocument(
    {
      name: 'projects/p/databases/d/documents/toty_configs/basquet-h',
      fields: {
        temporada: { stringValue: '2026' },
        formationName: { stringValue: 'Quinteto Ideal' },
        positionCounts: {
          mapValue: {
            fields: {
              base: { integerValue: '1' },
              escolta: { integerValue: '2' },
              pivot: { integerValue: '2' },
            },
          },
        },
      },
      updateTime: '2026-11-21T10:00:00Z',
    },
    '2026-11-28T00:00:00Z'
  );

  assert.deepEqual(cfg, {
    disciplineId: 'basquet-h',
    temporada: '2026',
    formationName: 'Quinteto Ideal',
    positionCounts: { base: 1, escolta: 2, pivot: 2 },
    updatedAt: '2026-11-21T10:00:00Z',
  });

  assert.equal(
    sanitizeAdminImportedTotyBallot(
      { disciplineId: 'invalid-disc', voterUid: 'u1', selections: { a: 'p1' } },
      '2026-11-28T00:00:00Z'
    ),
    null
  );
  assert.equal(
    sanitizeAdminImportedTotyBallot(
      { disciplineId: 'f7-h-1', voterUid: 'u1', selections: {} },
      '2026-11-28T00:00:00Z'
    ),
    null
  );
});


