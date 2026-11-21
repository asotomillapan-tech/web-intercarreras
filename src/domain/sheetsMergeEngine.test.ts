import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialTournamentState } from '../data/ufroSeed';
import type { Match, Player, Team, TournamentState } from '../types/tournament';
import {
  buildStandardSheetPayloads,
  columnNumberToA1,
  mergeTournamentWithSheets,
  STANDARD_HEADERS,
} from './sheetsMergeEngine';

function buildFixtureState(): TournamentState {
  const base = createInitialTournamentState();
  const teamA: Team = {
    id: 'tm-efio',
    nombre: 'Efiorentina',
    sigla: 'EFI',
    disciplineId: 'f7-h-1',
    carrera: 'Pedagogía en Educación Física',
    facultad: 'Facultad de Educación, Ciencias Sociales y Humanidades',
    groupName: 'Grupo A',
    logrosAnteriores: 'Campeón 2024',
  };
  const teamB: Team = {
    id: 'tm-ing',
    nombre: 'Ingeniería FC',
    sigla: 'ING',
    disciplineId: 'f7-h-1',
    carrera: 'Ingeniería Civil Informática',
    facultad: 'Facultad de Ingeniería y Ciencias',
    groupName: 'Grupo A',
  };
  const player1: Player = {
    id: 'pl-1',
    teamId: 'tm-efio',
    disciplineId: 'f7-h-1',
    dorsal: 10,
    posicion: 'Delantero',
    nombre: 'Matías',
    apellidoPaterno: 'Soto',
    apellidoMaterno: 'Millapán',
    carrera: 'Pedagogía en Educación Física',
    facultad: 'Facultad de Educación, Ciencias Sociales y Humanidades',
    rut: '20.123.456-7',
    numeroMatricula: '20231234',
    correoInstitucional: 'm.soto@ufromail.cl',
    nivelAcademico: 'Pregrado',
    fechaNacimiento: '2003-05-12',
    fotografia: 'data:image/jpeg;base64,AAAA_MOCK_PHOTO',
    esSeleccionadoUfro: false,
    stats: {
      partidosJugados: 2,
      goles: 3,
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
  const match1: Match = {
    id: 'm-1',
    disciplineId: 'f7-h-1',
    groupName: 'Grupo A',
    fase: 'Grupos',
    jornada: 1,
    fecha: '2026-04-15',
    hora: '18:30',
    cancha: 'Cancha Sintética UFRO 1',
    homeTeamId: 'tm-efio',
    awayTeamId: 'tm-ing',
    homeScore: 2,
    awayScore: 1,
    status: 'PROGRAMADO',
    periodLabel: 'Programado',
    clock: 'Por iniciar',
    periods: [],
    fouls: { home: 0, away: 0 },
    timeouts: { home: 0, away: 0 },
    events: [],
    refereeId: 'ref-f7-1',
  };

  return {
    ...base,
    teams: [teamA, teamB],
    players: [player1],
    matches: [match1],
  };
}

test('3-way merge: Sheet edit wins when Web did not change, and Web edit wins when Sheet did not change', () => {
  const baselineState = buildFixtureState();
  const baselineTabs = buildStandardSheetPayloads(baselineState, ['f7-h-1', 'f7-h-2', 'f7-h-3']);

  // Organizer edits Efiorentina's group to "Grupo B" directly in Google Sheets
  const sheetTabs = structuredClone(baselineTabs);
  sheetTabs.Web_Equipos[1][2] = 'Grupo B';

  // Admin edits Efiorentina's logrosAnteriores in the Web UI
  const webState = buildFixtureState();
  webState.teams[0].logrosAnteriores = 'Bicampeón 2024-2025';

  const result = mergeTournamentWithSheets({
    webState,
    sheetTabs,
    baselineTabs,
    disciplineFilter: ['f7-h-1', 'f7-h-2', 'f7-h-3'],
  });

  // Both changes must coexist!
  assert.equal(result.imports.teamsToUpdate.length, 1);
  assert.equal(result.imports.teamsToUpdate[0].groupName, 'Grupo B');
  assert.equal(result.imports.teamsToUpdate[0].logrosAnteriores, 'Bicampeón 2024-2025');

  const mergedTeamRow = result.mergedTabs.Web_Equipos.find((r) => r[0] === 'tm-efio');
  assert.ok(mergedTeamRow);
  assert.equal(mergedTeamRow[2], 'Grupo B');
  assert.equal(mergedTeamRow[8], 'Bicampeón 2024-2025');
});

test('First sync without baseline NEVER overwrites manual edits made in Google Sheets', () => {
  const webState = buildFixtureState();
  const sheetTabs = buildStandardSheetPayloads(webState, ['f7-h-1', 'f7-h-2', 'f7-h-3']);

  // Organizer edited player's goals from 3 to 7 and dorsal from 10 to 9 in Google Sheets
  sheetTabs.Web_Jugadores[1][3] = '9';
  sheetTabs.Web_Jugadores[1][18] = '7';
  // And edited match score + finalized it in Sheets
  sheetTabs.Web_Partidos[1][8] = '4';
  sheetTabs.Web_Partidos[1][9] = '2';
  sheetTabs.Web_Partidos[1][11] = 'FINALIZADO';

  const result = mergeTournamentWithSheets({
    webState,
    sheetTabs,
    baselineTabs: undefined,
    disciplineFilter: ['f7-h-1', 'f7-h-2', 'f7-h-3'],
  });

  assert.equal(result.imports.playersToUpdate.length, 1);
  assert.equal(result.imports.playersToUpdate[0].dorsal, 9);
  assert.equal(result.imports.playersToUpdate[0].stats.goles, 7);
  // Base64 photo in web MUST NOT be erased by "[Imagen adjunta en web]" placeholder!
  assert.equal(
    result.imports.playersToUpdate[0].fotografia,
    'data:image/jpeg;base64,AAAA_MOCK_PHOTO'
  );

  assert.equal(result.imports.matchesToUpdate.length, 1);
  assert.equal(result.imports.matchesToUpdate[0].homeScore, 4);
  assert.equal(result.imports.matchesToUpdate[0].awayScore, 2);
  assert.equal(result.imports.matchesToUpdate[0].status, 'FINALIZADO');
});

test('New team and new player added directly in Google Sheets with blank IDs are imported cleanly', () => {
  const webState = buildFixtureState();
  const sheetTabs = buildStandardSheetPayloads(webState, ['f7-h-1', 'f7-h-2', 'f7-h-3']);

  // Organizer adds a brand new team in Web_Equipos without typing an ID
  sheetTabs.Web_Equipos.push([
    '',
    'f7-h-1',
    'Grupo B',
    'Medicina UFRO',
    'MED',
    'Medicina',
    'Facultad de Medicina',
    'capitan@ufromail.cl',
    '',
  ]);

  // And adds a new player referencing that new team by name in Web_Jugadores
  sheetTabs.Web_Jugadores.push([
    '',
    'f7-h-1',
    'Medicina UFRO',
    '7',
    'Mediocampista',
    'Lucas',
    'Paredes',
    'Ríos',
    'Medicina',
    'Facultad de Medicina',
    '21.345.678-9',
    '20249876',
    'l.paredes@ufromail.cl',
    'Pregrado',
    '2004-08-20',
    'Sin foto',
    'Sí',
    '1',
    '2',
    '1',
    '0',
    '0',
    '0',
  ]);

  const result = mergeTournamentWithSheets({
    webState,
    sheetTabs,
    disciplineFilter: ['f7-h-1', 'f7-h-2', 'f7-h-3'],
  });

  assert.equal(result.imports.teamsToCreate.length, 1);
  const createdTeam = result.imports.teamsToCreate[0];
  assert.equal(createdTeam.nombre, 'Medicina UFRO');
  assert.equal(createdTeam.sigla, 'MED');
  assert.match(createdTeam.id, /^[a-zA-Z0-9_-]{2,128}$/);

  assert.equal(result.imports.playersToCreate.length, 1);
  const createdPlayer = result.imports.playersToCreate[0];
  assert.equal(createdPlayer.teamId, createdTeam.id);
  assert.equal(createdPlayer.nombre, 'Lucas');
  assert.equal(createdPlayer.dorsal, 7);
  assert.equal(createdPlayer.esSeleccionadoUfro, true);
  assert.equal(createdPlayer.stats.goles, 2);
});

test('Preserves extra user-added columns and unparsed draft rows in Google Sheets', () => {
  const webState = buildFixtureState();
  const sheetTabs = buildStandardSheetPayloads(webState, ['f7-h-1', 'f7-h-2', 'f7-h-3']);

  // Organizer added two custom columns to Web_Equipos
  sheetTabs.Web_Equipos[0].push('Estado_Pago', 'Notas_Organizacion');
  sheetTabs.Web_Equipos[1].push('Pagado', 'Camiseta azul');
  sheetTabs.Web_Equipos[2].push('Pendiente', 'Revisar nómina');
  // Plus a manual draft/note row at the bottom
  sheetTabs.Web_Equipos.push(['', '', '', '', '', '', '', '', '', 'Total:', '=COUNTA(D2:D3)']);

  const result = mergeTournamentWithSheets({
    webState,
    sheetTabs,
    disciplineFilter: ['f7-h-1', 'f7-h-2', 'f7-h-3'],
  });

  assert.equal(result.stats.preservedExtraColumns, 2);
  assert.equal(result.stats.preservedUnparsedSheetRows, 1);
  assert.deepEqual(
    result.mergedTabs.Web_Equipos[0].slice(STANDARD_HEADERS.Web_Equipos.length),
    ['Estado_Pago', 'Notas_Organizacion']
  );
  const efioRow = result.mergedTabs.Web_Equipos.find((r) => r[0] === 'tm-efio');
  assert.ok(efioRow);
  assert.equal(efioRow[9], 'Pagado');
  assert.equal(efioRow[10], 'Camiseta azul');

  const lastRow = result.mergedTabs.Web_Equipos[result.mergedTabs.Web_Equipos.length - 1];
  assert.equal(lastRow[9], 'Total:');
  assert.equal(lastRow[10], '=COUNTA(D2:D3)');
});

test('Explicit Web deletion tombstones remove deleted items from Sheet without touching Sheet-added items', () => {
  const baselineState = buildFixtureState();
  const sheetTabs = buildStandardSheetPayloads(baselineState, ['f7-h-1', 'f7-h-2', 'f7-h-3']);

  // Organizer also added a new team in Sheets
  sheetTabs.Web_Equipos.push([
    'tm-derecho',
    'f7-h-1',
    'Grupo A',
    'Derecho FC',
    'DER',
    'Derecho',
    'Facultad de Ciencias Jurídicas y Empresariales',
    '',
    '',
  ]);

  // Admin deleted tm-ing in the Web UI
  const webState = buildFixtureState();
  webState.teams = webState.teams.filter((t) => t.id !== 'tm-ing');

  const result = mergeTournamentWithSheets({
    webState,
    sheetTabs,
    baselineTabs: buildStandardSheetPayloads(baselineState, ['f7-h-1', 'f7-h-2', 'f7-h-3']),
    disciplineFilter: ['f7-h-1', 'f7-h-2', 'f7-h-3'],
    deletedIds: { teamIds: ['tm-ing'] },
  });

  const idsInMerged = result.mergedTabs.Web_Equipos.slice(1).map((r) => r[0]);
  assert.ok(!idsInMerged.includes('tm-ing'), 'Deleted team should be removed from Sheet');
  assert.ok(idsInMerged.includes('tm-efio'), 'Existing team should remain');
  assert.ok(idsInMerged.includes('tm-derecho'), 'Sheet-added team must be preserved and imported');
  assert.equal(result.imports.teamsToCreate.length, 1);
  assert.equal(result.imports.teamsToCreate[0].id, 'tm-derecho');
});

test('Web_Formato toggles edited in Google Sheets pull back into discipline configs', () => {
  const webState = buildFixtureState();
  const sheetTabs = buildStandardSheetPayloads(webState, ['f7-h-1', 'f7-h-2', 'f7-h-3']);

  // Close registrations and open transfers for f7-h-1 in Google Sheets
  sheetTabs.Web_Formato[1][6] = 'Cerradas';
  sheetTabs.Web_Formato[1][7] = 'Abiertas';

  const result = mergeTournamentWithSheets({
    webState,
    sheetTabs,
    disciplineFilter: ['f7-h-1', 'f7-h-2', 'f7-h-3'],
  });

  assert.equal(result.imports.configsToUpdate.length, 1);
  assert.equal(result.imports.configsToUpdate[0].disciplineId, 'f7-h-1');
  assert.equal(result.imports.configsToUpdate[0].inscripcionesAbiertas, false);
  assert.equal(result.imports.configsToUpdate[0].transferenciasAbiertas, true);
});

test('columnNumberToA1 converts column indices accurately', () => {
  assert.equal(columnNumberToA1(1), 'A');
  assert.equal(columnNumberToA1(26), 'Z');
  assert.equal(columnNumberToA1(27), 'AA');
  assert.equal(columnNumberToA1(28), 'AB');
});
