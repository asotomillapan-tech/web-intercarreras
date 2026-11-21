import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCalendarMonthGrid,
  extractCalendarVenues,
  filterCalendarMatches,
  formatCalendarDateEs,
  groupMatchesByDate,
  normalizeMatchDateToIso,
  pickInitialCalendarMonth,
} from './calendarEngine';
import type { Match } from '../types/tournament';

function makeMatch(overrides: Partial<Match>): Match {
  return {
    id: 'm-1',
    disciplineId: 'f7-h-1',
    groupName: 'Grupo A',
    fase: 'Grupos',
    jornada: 1,
    fecha: '2026-11-18',
    hora: '18:00',
    cancha: 'Cancha Sintética 1',
    homeTeamId: 't-1',
    awayTeamId: 't-2',
    homeScore: 0,
    awayScore: 0,
    status: 'PROGRAMADO',
    periodLabel: 'Por iniciar',
    clock: '00:00',
    periods: [],
    fouls: { home: 0, away: 0 },
    timeouts: { home: 0, away: 0 },
    events: [],
    refereeId: 'ref-1',
    ...overrides,
  };
}

test('extractCalendarVenues returns deduplicated sorted venues', () => {
  const matches = [
    makeMatch({ id: 'm1', cancha: 'Gimnasio Olímpico UFRO' }),
    makeMatch({ id: 'm2', cancha: 'Cancha Sintética 1' }),
    makeMatch({ id: 'm3', cancha: 'Cancha Sintética 1 ' }),
    makeMatch({ id: 'm4', cancha: '' }),
  ];

  assert.deepEqual(extractCalendarVenues(matches), [
    'Cancha Sintética 1',
    'Gimnasio Olímpico UFRO',
  ]);
});

test('filterCalendarMatches filters accurately by discipline, venue, and status', () => {
  const matches = [
    makeMatch({ id: 'm1', disciplineId: 'f7-h-1', cancha: 'Cancha 1', status: 'PROGRAMADO' }),
    makeMatch({ id: 'm2', disciplineId: 'f7-m', cancha: 'Cancha 1', status: 'PROGRAMADO' }),
    makeMatch({ id: 'm3', disciplineId: 'basquet-h', cancha: 'Gimnasio UFRO', status: 'FINALIZADO' }),
    makeMatch({ id: 'm4', disciplineId: 'f7-h-1', cancha: 'Cancha 2', status: 'EN_VIVO' }),
  ];

  const byDisc = filterCalendarMatches(matches, {
    disciplineId: 'f7-h-1',
    venue: 'ALL',
    statusFilter: 'ALL',
  });
  assert.deepEqual(
    byDisc.map((m) => m.id),
    ['m1', 'm4']
  );

  const byVenueAndScheduled = filterCalendarMatches(matches, {
    disciplineId: 'ALL',
    venue: 'Cancha 1',
    statusFilter: 'PROGRAMADO',
  });
  assert.deepEqual(
    byVenueAndScheduled.map((m) => m.id),
    ['m1', 'm2']
  );

  const combined = filterCalendarMatches(matches, {
    disciplineId: 'basquet-h',
    venue: 'Gimnasio UFRO',
    statusFilter: 'FINALIZADO',
  });
  assert.deepEqual(
    combined.map((m) => m.id),
    ['m3']
  );
});

test('groupMatchesByDate groups chronologically and sorts matches within a day by hora', () => {
  const matches = [
    makeMatch({ id: 'm3', fecha: '2026-11-20', hora: '19:00' }),
    makeMatch({ id: 'm1', fecha: '2026-11-18', hora: '20:30' }),
    makeMatch({ id: 'm2', fecha: '2026-11-18', hora: '17:00' }),
  ];

  const groups = groupMatchesByDate(matches);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].fecha, '2026-11-18');
  assert.deepEqual(
    groups[0].matches.map((m) => m.id),
    ['m2', 'm1']
  );
  assert.equal(groups[1].fecha, '2026-11-20');
  assert.equal(formatCalendarDateEs('2026-11-18').shortDateLabel, '18 nov');
});

test('buildCalendarMonthGrid builds Monday-first grid with exact match counts per date', () => {
  const matches = [
    makeMatch({ id: 'm1', fecha: '2026-11-18', status: 'PROGRAMADO' }),
    makeMatch({ id: 'm2', fecha: '2026-11-18', status: 'EN_VIVO' }),
    makeMatch({ id: 'm3', fecha: '2026-11-25', status: 'FINALIZADO' }),
  ];

  const grid = buildCalendarMonthGrid(2026, 10, matches); // November 2026
  assert.ok(grid.length === 35 || grid.length === 42);

  const nov18 = grid.find((c) => c.dateIso === '2026-11-18');
  assert.ok(nov18);
  assert.equal(nov18.inCurrentMonth, true);
  assert.equal(nov18.matchCount, 2);
  assert.equal(nov18.scheduledCount, 1);
  assert.equal(nov18.liveCount, 1);

  const nov25 = grid.find((c) => c.dateIso === '2026-11-25');
  assert.ok(nov25);
  assert.equal(nov25.finalizedCount, 1);
});

test('pickInitialCalendarMonth prioritizes earliest scheduled/live match, then latest finalized match', () => {
  const mixed = [
    makeMatch({ id: 'm1', fecha: '2026-09-10', status: 'FINALIZADO' }),
    makeMatch({ id: 'm2', fecha: '2026-11-22', status: 'PROGRAMADO' }),
    makeMatch({ id: 'm3', fecha: '2026-10-14', status: 'PROGRAMADO' }),
  ];
  assert.deepEqual(pickInitialCalendarMonth(mixed), { year: 2026, monthIndex: 9 });

  const onlyFinished = [
    makeMatch({ id: 'm1', fecha: '2026-08-05', status: 'FINALIZADO' }),
    makeMatch({ id: 'm2', fecha: '2026-10-20', status: 'FINALIZADO' }),
  ];
  assert.deepEqual(pickInitialCalendarMonth(onlyFinished), { year: 2026, monthIndex: 9 });

  assert.deepEqual(pickInitialCalendarMonth([], '2026-05-01'), { year: 2026, monthIndex: 4 });
});

test('supports Chilean DD/MM/YYYY dates from Google Sheets across grid, grouping, and formatting', () => {
  assert.equal(normalizeMatchDateToIso('12/11/2026'), '2026-11-12');
  assert.equal(normalizeMatchDateToIso('5-9-2026'), '2026-09-05');
  assert.equal(normalizeMatchDateToIso('2026-11-14'), '2026-11-14');

  const sheetMatches = [
    makeMatch({ id: 's1', fecha: '12/11/2026', hora: '17:00', status: 'PROGRAMADO' }),
    makeMatch({ id: 's2', fecha: '14/11/2026', hora: '13:00', status: 'PROGRAMADO' }),
    makeMatch({ id: 's3', fecha: '14/11/2026', hora: '15:00', status: 'PROGRAMADO' }),
  ];

  assert.deepEqual(pickInitialCalendarMonth(sheetMatches), { year: 2026, monthIndex: 10 });

  const grid = buildCalendarMonthGrid(2026, 10, sheetMatches);
  assert.equal(grid.find((c) => c.dateIso === '2026-11-12')?.matchCount, 1);
  assert.equal(grid.find((c) => c.dateIso === '2026-11-14')?.matchCount, 2);

  const groups = groupMatchesByDate(sheetMatches);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].fecha, '2026-11-12');
  assert.equal(groups[0].fullDateLabel, 'Jueves 12 de noviembre 2026');
  assert.equal(groups[1].fecha, '2026-11-14');
  assert.equal(groups[1].matches.length, 2);
});

