import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadCachedPublicTournamentState,
  PUBLIC_CACHE_MAX_AGE_MS,
  sanitizePublicStateForCache,
  saveCachedPublicTournamentState,
} from './localCache';
import type { TournamentState } from '../types/tournament';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
}

test('sanitizePublicStateForCache strips player PII, unpublished news, and pending transfers', () => {
  const sample: Partial<TournamentState> = {
    temporada: '2026',
    players: [
      {
        id: 'p1',
        teamId: 't1',
        disciplineId: 'f7-h-1',
        dorsal: 10,
        posicion: 'Delantero',
        nombre: 'Ana',
        apellidoPaterno: 'López',
        apellidoMaterno: 'Silva',
        carrera: 'Medicina',
        facultad: 'Medicina',
        rut: '19.111.222-3',
        numeroMatricula: '20231234',
        correoInstitucional: 'a.lopez@ufromail.cl',
        fechaNacimiento: '2001-05-05',
        nivelAcademico: 'Pregrado',
        fotografia: '',
        esSeleccionadoUfro: false,
        stats: {
          partidosJugados: 1,
          goles: 1,
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
      },
    ],
    transfers: [
      {
        id: 'tr1',
        disciplineId: 'f7-h-1',
        playerId: 'p1',
        playerName: 'Ana López',
        fromTeamId: 't1',
        fromTeamName: 'A',
        toTeamId: 't2',
        toTeamName: 'B',
        fecha: '2026-05-01',
        motivo: 'Cambio',
        estado: 'PENDIENTE',
      },
      {
        id: 'tr2',
        disciplineId: 'f7-h-1',
        playerId: 'p1',
        playerName: 'Ana López',
        fromTeamId: 't1',
        fromTeamName: 'A',
        toTeamId: 't2',
        toTeamName: 'B',
        fecha: '2026-05-02',
        motivo: 'Cambio',
        estado: 'APROBADA',
      },
    ],
    news: [
      {
        id: 'n1',
        title: 'Borrador',
        summary: 's',
        content: 'c',
        category: 'ANUNCIO',
        featured: false,
        published: false,
        authorUid: 'u1',
        authorName: 'Admin',
        authorRole: 'admin',
        createdAt: '2026-05-01',
        updatedAt: '2026-05-01',
      },
      {
        id: 'n2',
        title: 'Publicada',
        summary: 's',
        content: 'c',
        category: 'ANUNCIO',
        featured: true,
        published: true,
        authorUid: 'u1',
        authorName: 'Admin',
        authorRole: 'admin',
        createdAt: '2026-05-01',
        updatedAt: '2026-05-01',
      },
    ],
  };

  const sanitized = sanitizePublicStateForCache(sample);
  assert.equal(sanitized.players?.[0]?.rut, '');
  assert.equal(sanitized.players?.[0]?.correoInstitucional, '');
  assert.equal(sanitized.players?.[0]?.numeroMatricula, '');
  assert.equal(sanitized.transfers?.length, 1);
  assert.equal(sanitized.transfers?.[0]?.id, 'tr2');
  assert.equal(sanitized.news?.length, 1);
  assert.equal(sanitized.news?.[0]?.id, 'n2');
});

test('saveCachedPublicTournamentState and loadCachedPublicTournamentState round-trip and expire after TTL', () => {
  const storage = createMemoryStorage();
  const t0 = 1_700_000_000_000;
  const saved = saveCachedPublicTournamentState(
    {
      temporada: '2026',
      homeFeatured: { mode: 'match', matchId: 'm-123', badgeLabel: 'Clásico UFRO' },
    },
    storage,
    t0
  );
  assert.equal(saved, true);

  const loaded = loadCachedPublicTournamentState(storage, t0 + 1000);
  assert.ok(loaded);
  assert.equal(loaded.data.temporada, '2026');
  assert.equal(loaded.data.homeFeatured?.matchId, 'm-123');

  const expired = loadCachedPublicTournamentState(storage, t0 + PUBLIC_CACHE_MAX_AGE_MS + 10);
  assert.equal(expired, null);
});
