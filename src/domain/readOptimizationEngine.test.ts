import test from 'node:test';
import assert from 'node:assert/strict';
import type { Player, Team } from '../types/tournament';
import { buildUnifiedPlayers } from './identityCrossRefEngine';
import {
  PLAYERS_PREVIEW_LIMIT,
  buildFirestoreNameEqualityCandidates,
  filterTeamsForQuickSelect,
  getLazyCollectionsForSection,
  isCacheTimestampFresh,
  mergeLazyPlayersPreservingPii,
  slicePlayersForDirectoryView,
} from './readOptimizationEngine';

function makePlayer(id: string, teamId: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    teamId,
    disciplineId: 'f7-h-1',
    dorsal: 10,
    posicion: 'Delantero',
    nombre: `Jugador${id}`,
    apellidoPaterno: `Apellido${id}`,
    apellidoMaterno: 'UFRO',
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
    ...overrides,
  };
}

function makeTeam(id: string, nombre: string, overrides: Partial<Team> = {}): Team {
  return {
    id,
    nombre,
    sigla: id.slice(0, 3).toUpperCase(),
    disciplineId: 'f7-h-1',
    carrera: 'Ingeniería',
    facultad: 'FICA',
    groupName: 'Grupo A',
    ...overrides,
  };
}

test('getLazyCollectionsForSection loads only section-scoped collections and never bulk-loads unrelated streams', () => {
  assert.deepEqual(getLazyCollectionsForSection('inicio'), ['news']);
  assert.deepEqual(getLazyCollectionsForSection('posiciones'), []);
  assert.deepEqual(getLazyCollectionsForSection('equipos'), []);
  assert.deepEqual(getLazyCollectionsForSection('jugadores'), ['playersPreview']);
  assert.deepEqual(getLazyCollectionsForSection('votaciones'), ['votingSecondary']);
  assert.deepEqual(getLazyCollectionsForSection('minijuegos'), ['leyendasLeaderboard']);
  assert.deepEqual(getLazyCollectionsForSection('galeria'), ['photos']);
  assert.deepEqual(getLazyCollectionsForSection('transferencias-publicas'), ['transfers']);
});

test('isCacheTimestampFresh enforces TTL boundaries accurately', () => {
  const now = 1_000_000;
  assert.equal(isCacheTimestampFresh(undefined, now, 300_000), false);
  assert.equal(isCacheTimestampFresh(null, now, 300_000), false);
  assert.equal(isCacheTimestampFresh(now - 60_000, now, 300_000), true);
  assert.equal(isCacheTimestampFresh(now - 300_000, now, 300_000), false);
  assert.equal(isCacheTimestampFresh(now + 5_000, now, 300_000), false);
});

test('mergeLazyPlayersPreservingPii merges newly loaded team rosters without losing prior teams or authorized PII', () => {
  const prev = [
    makePlayer('p1', 't1', {
      rut: '20.111.222-3',
      correoInstitucional: 'p1@ufromail.cl',
      dorsal: 9,
    }),
    makePlayer('p2', 't2'),
  ];
  const incoming = [
    makePlayer('p1', 't1', { dorsal: 11, rut: '', correoInstitucional: '' }),
    makePlayer('p3', 't3'),
  ];

  const merged = mergeLazyPlayersPreservingPii(prev, incoming);
  assert.equal(merged.length, 3);
  const p1 = merged.find((p) => p.id === 'p1');
  assert.equal(p1?.dorsal, 11);
  assert.equal(p1?.rut, '20.111.222-3');
  assert.equal(p1?.correoInstitucional, 'p1@ufromail.cl');
  assert.ok(merged.some((p) => p.id === 'p2'));
  assert.ok(merged.some((p) => p.id === 'p3'));
});

test('buildFirestoreNameEqualityCandidates returns compact case variants for >=2 char tokens', () => {
  assert.deepEqual(buildFirestoreNameEqualityCandidates('a'), []);
  assert.deepEqual(buildFirestoreNameEqualityCandidates('   '), []);

  const single = buildFirestoreNameEqualityCandidates('lucas');
  assert.ok(single.includes('Lucas'));
  assert.ok(single.includes('LUCAS'));
  assert.ok(single.length <= 4);

  const multi = buildFirestoreNameEqualityCandidates('matías soto');
  assert.ok(multi.includes('Matías'));
  assert.ok(multi.includes('Soto'));
  assert.ok(multi.length <= 4);
});

test('slicePlayersForDirectoryView caps default view strictly at 10 players and shows full team roster when a team is selected', () => {
  const teams = [makeTeam('t1', 'Ingeniería FC'), makeTeam('t2', 'Medicina FC')];
  const players: Player[] = [];
  for (let i = 1; i <= 14; i++) {
    players.push(makePlayer(`a${i}`, 't1', { nombre: `Alpha${i}`, apellidoPaterno: `Uno${i}` }));
  }
  for (let i = 1; i <= 6; i++) {
    players.push(makePlayer(`b${i}`, 't2', { nombre: `Beta${i}`, apellidoPaterno: `Dos${i}` }));
  }
  const unified = buildUnifiedPlayers(players, teams);

  // Default view: strictly 10 players
  const defaultSlice = slicePlayersForDirectoryView({
    matchedProfiles: unified,
    selectedTeamId: null,
    hasActiveSearchOrFilter: false,
  });
  assert.equal(defaultSlice.profiles.length, PLAYERS_PREVIEW_LIMIT);
  assert.equal(defaultSlice.isPreviewCapped, true);

  // Team selected: all 14 players of t1, zero players of t2
  const teamSlice = slicePlayersForDirectoryView({
    matchedProfiles: unified,
    selectedTeamId: 't1',
    hasActiveSearchOrFilter: false,
  });
  assert.equal(teamSlice.profiles.length, 14);
  assert.equal(teamSlice.isPreviewCapped, false);
  assert.ok(
    teamSlice.profiles.every((prof) =>
      prof.participations.some((part) => part.player.teamId === 't1')
    )
  );
});

test('filterTeamsForQuickSelect returns curated preview by default and matches team search accurately', () => {
  const teams = Array.from({ length: 15 }, (_, idx) =>
    makeTeam(`t${idx + 1}`, idx === 12 ? 'Kinesiología UFRO' : `Equipo ${String(idx + 1).padStart(2, '0')}`, {
      disciplineId: idx % 2 === 0 ? 'f7-h-1' : 'basquet-h',
      carrera: idx === 12 ? 'Kinesiología' : 'Ingeniería',
    })
  );

  const preview = filterTeamsForQuickSelect(teams, { query: '' });
  assert.equal(preview.teams.length, 8);
  assert.equal(preview.totalMatching, 15);
  assert.equal(preview.isFiltered, false);

  const searched = filterTeamsForQuickSelect(teams, { query: 'kine' });
  assert.equal(searched.teams.length, 1);
  assert.equal(searched.teams[0].nombre, 'Kinesiología UFRO');
  assert.equal(searched.isFiltered, true);

  const byDisc = filterTeamsForQuickSelect(teams, { query: '', disciplineFilter: 'basquet-h' });
  assert.ok(byDisc.teams.every((t) => t.disciplineId === 'basquet-h'));
  assert.equal(byDisc.isFiltered, true);
});
