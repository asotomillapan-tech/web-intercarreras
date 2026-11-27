import test from 'node:test';
import assert from 'node:assert/strict';
import {
  areClubNamesEquivalent,
  buildUnifiedClubs,
  buildUnifiedPlayers,
  findClubSquadsForTeam,
  findPlayerParticipations,
  formatUnifiedClubDisplayName,
  normalizeClubBaseName,
} from './identityCrossRefEngine';
import type { Match, Player, Team } from '../types/tournament';

function makeTeam(overrides: Partial<Team>): Team {
  return {
    id: overrides.id ?? 't-1',
    nombre: overrides.nombre ?? 'Real Efineza FC',
    sigla: overrides.sigla ?? 'REF',
    disciplineId: overrides.disciplineId ?? 'f7-h-1',
    carrera: overrides.carrera ?? 'Pedagogía en Educación Física',
    facultad: overrides.facultad ?? 'FECSH',
    groupName: overrides.groupName ?? 'Grupo A',
    ...overrides,
  };
}

function makePlayer(overrides: Partial<Player>): Player {
  return {
    id: overrides.id ?? 'p-1',
    teamId: overrides.teamId ?? 't-1',
    disciplineId: overrides.disciplineId ?? 'f7-h-1',
    dorsal: overrides.dorsal ?? 10,
    posicion: overrides.posicion ?? 'Delantero',
    nombre: overrides.nombre ?? 'Camila',
    apellidoPaterno: overrides.apellidoPaterno ?? 'Rojas',
    apellidoMaterno: overrides.apellidoMaterno ?? 'Mendoza',
    carrera: overrides.carrera ?? 'Ingeniería Civil Industrial',
    facultad: overrides.facultad ?? 'FICA',
    rut: overrides.rut ?? '',
    numeroMatricula: overrides.numeroMatricula ?? '',
    correoInstitucional: overrides.correoInstitucional ?? '',
    nivelAcademico: overrides.nivelAcademico ?? 'Pregrado',
    fechaNacimiento: overrides.fechaNacimiento ?? '',
    fotografia: overrides.fotografia ?? '',
    esSeleccionadoUfro: overrides.esSeleccionadoUfro ?? false,
    stats: overrides.stats ?? {
      partidosJugados: 3,
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
  };
}

test('normalizeClubBaseName strips sport, gender, and club suffixes cleanly', () => {
  assert.equal(normalizeClubBaseName('Real Efineza FEM'), 'real efineza');
  assert.equal(normalizeClubBaseName('Real Efineza FC'), 'real efineza');
  assert.equal(normalizeClubBaseName('Real Efineza Básquetbol'), 'real efineza');
  assert.equal(normalizeClubBaseName('Efiorentina Voley'), 'efiorentina');
  assert.equal(normalizeClubBaseName('Efiorentina Damas F7'), 'efiorentina');
  assert.equal(normalizeClubBaseName('Efiorentina'), 'efiorentina');
});

test('areClubNamesEquivalent merges Real Efineza variants but keeps distinct teams in same career separate', () => {
  assert.equal(areClubNamesEquivalent('Real Efineza FEM', 'Real Efineza FC'), true);
  assert.equal(areClubNamesEquivalent('Real Efineza FC', 'Real Efineza Basquetbol'), true);
  assert.equal(areClubNamesEquivalent('Efiorentina', 'Efiorentina Voleibol'), true);
  assert.equal(areClubNamesEquivalent('Efiorentina', 'Efiorentinna FC'), true);

  // Different team names sharing the same career MUST stay separate
  assert.equal(areClubNamesEquivalent('Manchester Watts', 'Comercial Niupi'), false);
  assert.equal(areClubNamesEquivalent('Manchester Watts', 'Real Efineza'), false);
  assert.equal(areClubNamesEquivalent('Los Halcones', 'Dragones UFRO'), false);
  assert.equal(areClubNamesEquivalent('Equipo A', 'Equipo B'), false);
});

test('buildUnifiedClubs consolidates multi-discipline clubs and keeps different teams in same career independent', () => {
  const teams: Team[] = [
    makeTeam({ id: 're-f7m', nombre: 'Real Efineza FEM', disciplineId: 'f7-m', carrera: 'Educación Física', escudo: 'https://example.com/re.png' }),
    makeTeam({ id: 're-f7h', nombre: 'Real Efineza FC', disciplineId: 'f7-h-1', carrera: 'Educación Física' }),
    makeTeam({ id: 're-bask', nombre: 'Real Efineza Basquetbol', disciplineId: 'basquet-h', carrera: 'Educación Física' }),
    makeTeam({ id: 'other-ef', nombre: 'Atlético Temuco', disciplineId: 'f7-h-1', carrera: 'Educación Física' }),
  ];

  const clubs = buildUnifiedClubs(teams, [], [] as Match[]);
  assert.equal(clubs.length, 2);

  const realEfineza = clubs.find((c) => c.clubKey === 'real efineza');
  assert.ok(realEfineza);
  assert.equal(realEfineza.displayName, 'Real Efineza');
  assert.equal(realEfineza.teams.length, 3);
  assert.deepEqual(realEfineza.disciplines.sort(), ['basquet-h', 'f7-h-1', 'f7-m']);
  assert.equal(realEfineza.escudo, 'https://example.com/re.png');

  const atletico = clubs.find((c) => c.clubKey === 'atletico temuco');
  assert.ok(atletico);
  assert.equal(atletico.teams.length, 1);
});

test('formatUnifiedClubDisplayName preserves clean display name for single and multi-discipline clubs', () => {
  const single = [makeTeam({ nombre: 'Manchester Watts' })];
  assert.equal(formatUnifiedClubDisplayName(single), 'Manchester Watts');

  const multi = [
    makeTeam({ nombre: 'Real Efineza FEM', disciplineId: 'f7-m' }),
    makeTeam({ nombre: 'Real Efineza FC', disciplineId: 'f7-h-1' }),
    makeTeam({ nombre: 'Real Efineza Básquetbol', disciplineId: 'basquet-h' }),
  ];
  assert.equal(formatUnifiedClubDisplayName(multi), 'Real Efineza');
});

test('findClubSquadsForTeam locates all sibling discipline squads for a team', () => {
  const teams: Team[] = [
    makeTeam({ id: 'ef-1', nombre: 'Efiorentina FC', disciplineId: 'f7-h-1' }),
    makeTeam({ id: 'ef-2', nombre: 'Efiorentina Voleibol', disciplineId: 'voley-h' }),
    makeTeam({ id: 'mw-1', nombre: 'Manchester Watts', disciplineId: 'f7-h-1' }),
  ];
  const res = findClubSquadsForTeam(teams[0], teams);
  assert.equal(res.displayName, 'Efiorentina');
  assert.equal(res.squads.length, 2);
});

test('buildUnifiedPlayers merges the same student across Basket (Equipo A) and Voley (Equipo B) into ONE profile', () => {
  const teams: Team[] = [
    makeTeam({ id: 'eq-a', nombre: 'Equipo A', disciplineId: 'basquet-h' }),
    makeTeam({ id: 'eq-b', nombre: 'Equipo B', disciplineId: 'voley-h' }),
  ];
  const players: Player[] = [
    makePlayer({
      id: 'p-bask',
      teamId: 'eq-a',
      disciplineId: 'basquet-h',
      nombre: 'Matías',
      apellidoPaterno: 'Sánchez',
      apellidoMaterno: 'Vera',
      dorsal: 7,
      posicion: 'Base',
      stats: { ...makePlayer({}).stats, partidosJugados: 4, puntos: 42 },
    }),
    makePlayer({
      id: 'p-voley',
      teamId: 'eq-b',
      disciplineId: 'voley-h',
      nombre: 'Matias',
      apellidoPaterno: 'Sanchez',
      apellidoMaterno: 'Vera',
      dorsal: 12,
      posicion: 'Armador',
      stats: { ...makePlayer({}).stats, partidosJugados: 3, puntos: 18, aces: 5 },
    }),
    makePlayer({
      id: 'p-other',
      teamId: 'eq-a',
      disciplineId: 'basquet-h',
      nombre: 'Lucas',
      apellidoPaterno: 'Pérez',
      apellidoMaterno: 'Díaz',
      dorsal: 9,
      posicion: 'Pívot',
    }),
  ];

  const unified = buildUnifiedPlayers(players, teams);
  assert.equal(unified.length, 2);

  const matias = unified.find((u) => u.primaryRecord.apellidoPaterno.startsWith('S'));
  assert.ok(matias);
  assert.equal(matias.participations.length, 2);
  assert.deepEqual(matias.disciplines.sort(), ['basquet-h', 'voley-h']);
  assert.equal(matias.totalPartidosJugados, 7);

  const participations = findPlayerParticipations(players[0], players, teams);
  assert.equal(participations.length, 2);
});

test('buildUnifiedPlayers merges by RUT even when name spelling varies slightly', () => {
  const teams: Team[] = [
    makeTeam({ id: 't1', nombre: 'Equipo A', disciplineId: 'f7-h-1' }),
    makeTeam({ id: 't2', nombre: 'Equipo B', disciplineId: 'basquet-h' }),
  ];
  const players: Player[] = [
    makePlayer({
      id: 'p1',
      teamId: 't1',
      disciplineId: 'f7-h-1',
      nombre: 'José Ignacio',
      apellidoPaterno: 'Muñoz',
      apellidoMaterno: 'Soto',
      rut: '20.123.456-7',
    }),
    makePlayer({
      id: 'p2',
      teamId: 't2',
      disciplineId: 'basquet-h',
      nombre: 'Jose',
      apellidoPaterno: 'Munoz',
      apellidoMaterno: 'Soto',
      rut: '20123456-7',
    }),
  ];
  const unified = buildUnifiedPlayers(players, teams);
  assert.equal(unified.length, 1);
  assert.equal(unified[0].teamIds.length, 2);
});

test('buildUnifiedPlayers never merges homonyms who have distinct RUTs and keeps unique personKeys', () => {
  const teams: Team[] = [
    makeTeam({ id: 't1', nombre: 'Equipo A', disciplineId: 'f7-h-1' }),
    makeTeam({ id: 't2', nombre: 'Equipo B', disciplineId: 'f7-h-2' }),
  ];
  const players: Player[] = [
    makePlayer({
      id: 'homonym-1',
      teamId: 't1',
      disciplineId: 'f7-h-1',
      nombre: 'Sebastián',
      apellidoPaterno: 'González',
      apellidoMaterno: 'Pérez',
      rut: '20.111.222-3',
    }),
    makePlayer({
      id: 'homonym-2',
      teamId: 't2',
      disciplineId: 'f7-h-2',
      nombre: 'Sebastián',
      apellidoPaterno: 'González',
      apellidoMaterno: 'Pérez',
      rut: '21.999.888-7',
    }),
  ];

  const unified = buildUnifiedPlayers(players, teams);
  assert.equal(unified.length, 2);
  assert.notEqual(unified[0].personKey, unified[1].personKey);
});

test('buildUnifiedPlayers scales linearly: 3,000 players unify in under 250ms', () => {
  const teams: Team[] = Array.from({ length: 80 }, (_, idx) =>
    makeTeam({
      id: `team-${idx}`,
      nombre: `Club UFRO ${idx}`,
      disciplineId: idx % 2 === 0 ? 'f7-h-1' : 'voley-m',
    })
  );

  // Create 3,000 player records including 300 multi-discipline students
  const players: Player[] = Array.from({ length: 3000 }, (_, i) => {
    const personIdx = i < 2700 ? i : i - 2700;
    return makePlayer({
      id: `pl-${i}`,
      teamId: teams[i % teams.length].id,
      disciplineId: i < 2700 ? 'f7-h-1' : 'voley-m',
      nombre: `Nombre${personIdx}`,
      apellidoPaterno: `Paterno${personIdx}`,
      apellidoMaterno: `Materno${personIdx}`,
      rut: '',
      carrera: `Carrera ${personIdx % 25}`,
    });
  });

  const t0 = performance.now();
  const unified = buildUnifiedPlayers(players, teams);
  const elapsedMs = performance.now() - t0;

  assert.equal(unified.length, 2700);
  const multiCount = unified.filter((u) => u.participations.length > 1).length;
  assert.equal(multiCount, 300);
  assert.ok(
    elapsedMs < 250,
    `Expected O(N) buildUnifiedPlayers(3000) to run under 250ms, took ${elapsedMs.toFixed(1)}ms`
  );
});

