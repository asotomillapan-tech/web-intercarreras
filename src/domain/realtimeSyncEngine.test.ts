import test from 'node:test';
import assert from 'node:assert/strict';
import type { NewsArticle, Player, TransferRecord } from '../types/tournament';
import {
  CORE_REALTIME_STREAMS,
  computeInitialSyncPhase,
  mergePublicNewsPreservingDrafts,
  mergePublicPlayersPreservingPii,
  mergePublicTransfersPreservingPrivate,
  type CoreRealtimeStreamKey,
} from './realtimeSyncEngine';

function createPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p-1',
    teamId: 't-1',
    disciplineId: 'f7-h-1',
    dorsal: 10,
    posicion: 'Delantero',
    nombre: 'Matías',
    apellidoPaterno: 'Rojas',
    apellidoMaterno: 'Soto',
    carrera: 'Ingeniería',
    facultad: 'FICA',
    rut: '',
    numeroMatricula: '',
    correoInstitucional: '',
    nivelAcademico: 'Pregrado',
    fechaNacimiento: '',
    fotografia: '',
    esSeleccionadoUfro: false,
    stats: {
      partidosJugados: 1,
      goles: 2,
      asistencias: 0,
      tarjetasAmarillas: 0,
      tarjetasRojas: 0,
      puntos: 0,
      rebotes: 0,
      triples: 0,
      faltas: 0,
      aces: 0,
      bloqueos: 0,
    },
    ...overrides,
  };
}

function createNews(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: 'n-1',
    title: 'Noticia UFRO',
    summary: 'Resumen',
    content: 'Contenido',
    category: 'ANUNCIO',
    featured: false,
    published: true,
    authorUid: 'u-1',
    authorName: 'Admin',
    authorRole: 'admin',
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  };
}

function createTransfer(overrides: Partial<TransferRecord> = {}): TransferRecord {
  return {
    id: 'tr-1',
    disciplineId: 'f7-h-1',
    playerId: 'p-1',
    playerName: 'Matías Rojas',
    fromTeamId: 't-1',
    fromTeamName: 'Equipo A',
    toTeamId: 't-2',
    toTeamName: 'Equipo B',
    fecha: '2026-05-10',
    motivo: 'Cambio de plantel',
    estado: 'APROBADA',
    ...overrides,
  };
}

test('mergePublicPlayersPreservingPii updates public stats/team while keeping authorized PII intact', () => {
  const prev = [
    createPlayer({
      id: 'p-1',
      rut: '20.123.456-7',
      numeroMatricula: '20261234',
      correoInstitucional: 'm.rojas@ufromail.cl',
      fechaNacimiento: '2003-04-12',
      stats: { ...createPlayer().stats, goles: 2 },
    }),
  ];
  const incomingPublic = [
    createPlayer({
      id: 'p-1',
      dorsal: 9,
      stats: { ...createPlayer().stats, goles: 5 },
    }),
    createPlayer({ id: 'p-2', nombre: 'Sofía', dorsal: 7 }),
  ];

  const merged = mergePublicPlayersPreservingPii(prev, incomingPublic);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].dorsal, 9);
  assert.equal(merged[0].stats.goles, 5);
  assert.equal(merged[0].rut, '20.123.456-7');
  assert.equal(merged[0].correoInstitucional, 'm.rojas@ufromail.cl');
  assert.equal(merged[1].rut, '');
});

test('mergePublicNewsPreservingDrafts keeps unpublished drafts only when authorized and removes drafts once published', () => {
  const prev = [
    createNews({ id: 'draft-1', published: false, createdAt: '2026-05-05T10:00:00.000Z' }),
    createNews({ id: 'pub-old', published: true, createdAt: '2026-05-01T10:00:00.000Z' }),
  ];
  const incomingPublished = [
    createNews({ id: 'pub-new', published: true, createdAt: '2026-05-06T10:00:00.000Z' }),
  ];

  const forAdmin = mergePublicNewsPreservingDrafts(prev, incomingPublished, true);
  assert.deepEqual(
    forAdmin.map((n) => n.id),
    ['pub-new', 'draft-1']
  );

  const forPublic = mergePublicNewsPreservingDrafts(prev, incomingPublished, false);
  assert.deepEqual(
    forPublic.map((n) => n.id),
    ['pub-new']
  );

  // When draft-1 gets published, incoming published version replaces the draft cleanly
  const publishedNow = mergePublicNewsPreservingDrafts(
    prev,
    [createNews({ id: 'draft-1', published: true, title: 'Ahora Publicada', createdAt: '2026-05-05T10:00:00.000Z' })],
    true
  );
  assert.equal(publishedNow.length, 1);
  assert.equal(publishedNow[0].published, true);
  assert.equal(publishedNow[0].title, 'Ahora Publicada');
});

test('mergePublicTransfersPreservingPrivate keeps pending transfers for delegates/admins and promotes approved ones', () => {
  const prev = [
    createTransfer({ id: 'tr-pend', estado: 'PENDIENTE', fecha: '2026-05-12' }),
    createTransfer({ id: 'tr-old', estado: 'APROBADA', fecha: '2026-05-01' }),
  ];
  const incomingApproved = [
    createTransfer({ id: 'tr-pend', estado: 'APROBADA', fecha: '2026-05-13' }),
    createTransfer({ id: 'tr-new', estado: 'APROBADA', fecha: '2026-05-14' }),
  ];

  const mergedAdmin = mergePublicTransfersPreservingPrivate(prev, incomingApproved, true);
  assert.deepEqual(
    mergedAdmin.map((t) => ({ id: t.id, estado: t.estado })),
    [
      { id: 'tr-new', estado: 'APROBADA' },
      { id: 'tr-pend', estado: 'APROBADA' },
    ]
  );

  const mergedWithStillPending = mergePublicTransfersPreservingPrivate(
    [createTransfer({ id: 'tr-still-pend', estado: 'PENDIENTE', fecha: '2026-05-15' })],
    [createTransfer({ id: 'tr-new', estado: 'APROBADA', fecha: '2026-05-14' })],
    true
  );
  assert.equal(mergedWithStillPending.length, 2);
  assert.equal(mergedWithStillPending[0].id, 'tr-still-pend');
});

test('computeInitialSyncPhase transitions cleanly across cached, first-visit loading, partial recovery, and total failure', () => {
  // Returning device with cache is immediately ready
  assert.equal(
    computeInitialSyncPhase({
      hasCachedSnapshot: true,
      settledCoreStreams: new Set(),
      failedCoreStreams: new Set(),
      timedOut: false,
    }),
    'ready'
  );

  // Brand-new device waits while core streams are still resolving
  assert.equal(
    computeInitialSyncPhase({
      hasCachedSnapshot: false,
      settledCoreStreams: new Set<CoreRealtimeStreamKey>(['settings', 'teams']),
      failedCoreStreams: new Set(),
      timedOut: false,
    }),
    'loading'
  );

  // Brand-new device becomes ready once all core streams settle
  assert.equal(
    computeInitialSyncPhase({
      hasCachedSnapshot: false,
      settledCoreStreams: new Set<CoreRealtimeStreamKey>(CORE_REALTIME_STREAMS),
      failedCoreStreams: new Set(),
      timedOut: false,
    }),
    'ready'
  );

  // Brand-new device shows error if every core stream fails
  assert.equal(
    computeInitialSyncPhase({
      hasCachedSnapshot: false,
      settledCoreStreams: new Set(),
      failedCoreStreams: new Set<CoreRealtimeStreamKey>(CORE_REALTIME_STREAMS),
      timedOut: false,
    }),
    'error'
  );

  // Timeout with partial data still shows ready; timeout with zero data shows error
  assert.equal(
    computeInitialSyncPhase({
      hasCachedSnapshot: false,
      settledCoreStreams: new Set<CoreRealtimeStreamKey>(['teams']),
      failedCoreStreams: new Set(),
      timedOut: true,
    }),
    'ready'
  );
  assert.equal(
    computeInitialSyncPhase({
      hasCachedSnapshot: false,
      settledCoreStreams: new Set(),
      failedCoreStreams: new Set(),
      timedOut: true,
    }),
    'error'
  );
});
