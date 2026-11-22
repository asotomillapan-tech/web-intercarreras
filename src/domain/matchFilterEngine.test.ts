import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Match } from '../types/tournament';
import {
  extractMatchGroups,
  extractMatchStages,
  filterMatchesByOrg,
  groupMatchesByOrg,
} from './matchFilterEngine';

function makeMatch(overrides: Partial<Match>): Match {
  return {
    id: overrides.id ?? 'm1',
    disciplineId: overrides.disciplineId ?? 'f7-h-1',
    groupName: overrides.groupName ?? 'Grupo A',
    fase: overrides.fase ?? 'Grupos',
    jornada: overrides.jornada ?? 1,
    fecha: overrides.fecha ?? '2026-05-10',
    hora: overrides.hora ?? '18:00',
    cancha: overrides.cancha ?? 'Cancha 1',
    homeTeamId: overrides.homeTeamId ?? 't1',
    awayTeamId: overrides.awayTeamId ?? 't2',
    homeScore: overrides.homeScore ?? 0,
    awayScore: overrides.awayScore ?? 0,
    status: overrides.status ?? 'PROGRAMADO',
    periodLabel: '1T',
    clock: '00:00',
    periods: [],
    fouls: { home: 0, away: 0 },
    timeouts: { home: 0, away: 0 },
    events: [],
    refereeId: 'ref-f7-1',
  };
}

describe('matchFilterEngine', () => {
  const sampleMatches: Match[] = [
    makeMatch({ id: 'm1', disciplineId: 'f7-h-1', groupName: 'Grupo B', fase: 'Grupos' }),
    makeMatch({ id: 'm2', disciplineId: 'f7-h-1', groupName: 'Grupo A', fase: 'Grupos' }),
    makeMatch({ id: 'm3', disciplineId: 'f7-h-1', groupName: 'Playoffs', fase: 'Semifinal' }),
    makeMatch({ id: 'm4', disciplineId: 'f7-h-1', groupName: 'Playoffs', fase: 'Final' }),
    makeMatch({ id: 'm5', disciplineId: 'f7-m', groupName: 'Grupo C', fase: 'Grupos' }),
    makeMatch({ id: 'm6', disciplineId: 'basquet-h', groupName: 'Playoffs', fase: 'Tercer Lugar' }),
  ];

  it('extracts sorted unique groups scoped by discipline', () => {
    assert.deepEqual(extractMatchGroups(sampleMatches, { disciplineId: 'ALL' }), [
      'Grupo A',
      'Grupo B',
      'Grupo C',
      'Playoffs',
    ]);
    assert.deepEqual(extractMatchGroups(sampleMatches, { disciplineId: 'f7-h-1' }), [
      'Grupo A',
      'Grupo B',
      'Playoffs',
    ]);
    assert.deepEqual(extractMatchGroups(sampleMatches, { disciplineId: 'f7-m' }), ['Grupo C']);
  });

  it('extracts stages in canonical tournament order', () => {
    assert.deepEqual(extractMatchStages(sampleMatches), [
      'Grupos',
      'Semifinal',
      'Tercer Lugar',
      'Final',
    ]);
    assert.deepEqual(extractMatchStages(sampleMatches, { disciplineId: 'f7-h-1' }), [
      'Grupos',
      'Semifinal',
      'Final',
    ]);
  });

  it('filters matches by discipline, group, and stage combined', () => {
    const res1 = filterMatchesByOrg(sampleMatches, {
      disciplineId: 'f7-h-1',
      groupName: 'Grupo A',
      fase: 'Grupos',
    });
    assert.deepEqual(
      res1.map((m) => m.id),
      ['m2']
    );

    const res2 = filterMatchesByOrg(sampleMatches, {
      disciplineId: 'ALL',
      groupName: 'Playoffs',
      fase: 'Tercer Lugar',
    });
    assert.deepEqual(
      res2.map((m) => m.id),
      ['m6']
    );
  });

  it('groups matches by stage in canonical progression order', () => {
    const sections = groupMatchesByOrg(sampleMatches, 'fase');
    assert.deepEqual(
      sections.map((s) => s.key),
      ['Grupos', 'Semifinal', 'Tercer Lugar', 'Final']
    );
    assert.equal(sections[0].label, 'Fase de Grupos');
    assert.equal(sections[0].matches.length, 3);
  });

  it('groups matches by discipline respecting canonical discipline order', () => {
    const sections = groupMatchesByOrg(
      sampleMatches,
      'disciplina',
      {
        'f7-h-1': 'Fútbol 7 1ª Div.',
        'f7-m': 'Fútbol 7 Damas',
        'basquet-h': 'Básquetbol Varones',
      },
      ['f7-h-1', 'f7-m', 'basquet-h']
    );
    assert.deepEqual(
      sections.map((s) => s.label),
      ['Fútbol 7 1ª Div.', 'Fútbol 7 Damas', 'Básquetbol Varones']
    );
  });
});
