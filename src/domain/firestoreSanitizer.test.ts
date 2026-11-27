import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSanitizedDisciplineConfigPayload,
  buildSanitizedMatchPayload,
  buildSanitizedPlayerPayload,
  buildSanitizedTeamPayload,
  clampSafeInt,
  stripUndefinedDeep,
} from './firestoreSanitizer';
import type { DisciplineFormatConfig, Match, Player, Team } from '../types/tournament';

function assertNoUndefinedOrNaN(obj: unknown, path = 'root'): void {
  assert.notStrictEqual(obj, undefined, `Found undefined at ${path}`);
  if (typeof obj === 'number') {
    assert.ok(Number.isFinite(obj), `Found non-finite number (${obj}) at ${path}`);
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => assertNoUndefinedOrNaN(item, `${path}[${idx}]`));
    return;
  }
  if (obj && typeof obj === 'object') {
    const proto = Object.getPrototypeOf(obj);
    if (proto === Object.prototype || proto === null) {
      for (const [key, val] of Object.entries(obj)) {
        assert.notStrictEqual(val, undefined, `Found explicit undefined property at ${path}.${key}`);
        assertNoUndefinedOrNaN(val, `${path}.${key}`);
      }
    }
  }
}

describe('firestoreSanitizer', () => {
  it('stripUndefinedDeep removes nested undefined properties and array holes while preserving class instances (like serverTimestamp)', () => {
    class MockFieldValue {
      readonly sentinel = 'serverTimestamp';
    }
    const ts = new MockFieldValue();

    const input = {
      a: 1,
      b: undefined,
      c: Number.NaN,
      nested: {
        ok: 'hello',
        bad: undefined,
        arr: [1, undefined, { x: 'y', z: undefined }],
      },
      updatedAt: ts,
    };

    const cleaned = stripUndefinedDeep(input);
    assertNoUndefinedOrNaN(cleaned);
    assert.equal('b' in cleaned, false);
    assert.equal(cleaned.c, 0);
    assert.equal('bad' in cleaned.nested, false);
    assert.deepEqual(cleaned.nested.arr, [1, { x: 'y' }]);
    assert.strictEqual(cleaned.updatedAt, ts);
  });

  it('clampSafeInt safely handles undefined, null, NaN, and out-of-range numbers', () => {
    assert.equal(clampSafeInt(undefined, 0, 10, 2), 2);
    assert.equal(clampSafeInt(null, 0, 10, 2), 2);
    assert.equal(clampSafeInt('', 0, 10, 2), 2);
    assert.equal(clampSafeInt(Number.NaN, 0, 10, 2), 2);
    assert.equal(clampSafeInt(Infinity, 0, 10, 2), 2);
    assert.equal(clampSafeInt(-5, 0, 10, 2), 0);
    assert.equal(clampSafeInt(99, 0, 10, 2), 10);
    assert.equal(clampSafeInt(4.9, 0, 10, 2), 4);
  });

  it('buildSanitizedMatchPayload strips player-less undefined event fields and finalizeMatch undefined scoresheetValidation fields', () => {
    const matchWithUndefineds: Match = {
      id: 'PAR32',
      disciplineId: 'voley-m',
      groupName: '',
      fase: 'Grupos',
      jornada: Number.NaN,
      fecha: '',
      hora: '',
      cancha: '',
      homeTeamId: 'team-1',
      awayTeamId: 'team-2',
      homeScore: 2,
      awayScore: 1,
      status: 'FINALIZADO',
      periodLabel: 'Finalizado',
      clock: 'Set 3',
      periods: [
        { home: 25, away: 19 },
        { home: 21, away: 25 },
        { home: Number.NaN, away: 11 },
      ],
      fouls: { home: Number.NaN, away: 2 },
      timeouts: { home: 1, away: Number.NaN },
      events: [
        {
          id: 'ev-1',
          minuteOrPeriod: 'Set 1',
          teamId: 'team-1',
          playerId: undefined,
          playerName: undefined,
          type: 'TIEMPO_MUERTO',
          detail: 'Tiempo técnico pedido por Equipo Local',
        },
        {
          id: 'ev-2',
          minuteOrPeriod: 'Set 2',
          teamId: 'team-2',
          playerId: 'p-10',
          playerName: 'Camila Soto',
          type: 'PUNTO_VOLEY',
          detail: 'Punto de Camila Soto',
          pointsDelta: 1,
          periodIndex: 1,
          triggeredSetWin: undefined,
        },
      ],
      refereeId: 'ref-1',
      scoresheetValidation: {
        validatedAt: '2026-05-01T18:00:00.000Z',
        refereeName: 'Árbitro Vóley',
        method: 'MANUAL_ARBITRO',
        imagePreview: undefined,
        aiResult: undefined,
        manualNotes: 'Marcador confirmado por planilla física',
        finalHomeScore: 2,
        finalAwayScore: 1,
      },
    };

    const updatePayload = buildSanitizedMatchPayload(matchWithUndefineds, false, 'arbitro');
    assertNoUndefinedOrNaN(updatePayload);

    const events = updatePayload.events as Array<Record<string, unknown>>;
    assert.equal(events.length, 2);
    assert.equal('playerId' in events[0], false);
    assert.equal('playerName' in events[0], false);
    assert.equal(events[1].playerId, 'p-10');
    assert.equal('triggeredSetWin' in events[1], false);

    const sv = updatePayload.scoresheetValidation as Record<string, unknown>;
    assert.equal('imagePreview' in sv, false);
    assert.equal('aiResult' in sv, false);
    assert.equal(sv.manualNotes, 'Marcador confirmado por planilla física');

    // Also verify create payload satisfies firestore.rules min-length bounds
    const createPayload = buildSanitizedMatchPayload(matchWithUndefineds, true, 'admin');
    assertNoUndefinedOrNaN(createPayload);
    assert.ok((createPayload.groupName as string).length >= 1);
    assert.ok((createPayload.fecha as string).length >= 8);
    assert.ok((createPayload.hora as string).length >= 4);
    assert.ok((createPayload.cancha as string).length >= 2);
    assert.equal(createPayload.jornada, 1);
  });

  it('buildSanitizedPlayerPayload guarantees firestore.rules constraints for Google Sheets Volleyball imports', () => {
    const sheetPlayer: Player = {
      id: 'pl-voley-m-1',
      teamId: 't-voley-m-1',
      disciplineId: 'voley-m',
      dorsal: Number.NaN,
      posicion: '',
      nombre: 'Valentina',
      apellidoPaterno: 'Rojas',
      apellidoMaterno: '',
      carrera: 'A',
      facultad: '',
      rut: '',
      numeroMatricula: '',
      correoInstitucional: '',
      nivelAcademico: 'Pregrado',
      fechaNacimiento: '',
      fotografia: '',
      esSeleccionadoUfro: false,
      stats: {
        partidosJugados: Number.NaN,
        goles: 0,
        asistencias: 0,
        tarjetasAmarillas: 0,
        tarjetasRojas: 0,
        puntos: 12,
        rebotes: 0,
        triples: 0,
        faltas: 0,
        aces: 3,
        bloqueos: 2,
      },
    };

    const createPayload = buildSanitizedPlayerPayload(sheetPlayer, true, 'admin');
    assertNoUndefinedOrNaN(createPayload);
    assert.equal(createPayload.dorsal, 0);
    assert.equal(createPayload.posicion, 'Jugador');
    assert.equal(createPayload.apellidoMaterno, '-');
    assert.equal(createPayload.carrera, 'Carrera UFRO');
    assert.equal(createPayload.facultad, 'Universidad de La Frontera');
    assert.equal((createPayload.stats as Record<string, number>).partidosJugados, 0);
  });

  it('buildSanitizedDisciplineConfigPayload guards against NaN maxTransferenciasPorEquipo', () => {
    const brokenConfig: DisciplineFormatConfig = {
      disciplineId: 'voley-m',
      temporada: '',
      maxCupos: Number.NaN,
      numGrupos: 2,
      clasificadosPorGrupo: 2,
      formatoPlayoff: 4,
      inscripcionesAbiertas: true,
      transferenciasAbiertas: false,
      maxTransferenciasPorEquipo: Number.NaN,
      faseActual: 'FASE_GRUPOS',
    };

    const payload = buildSanitizedDisciplineConfigPayload(brokenConfig);
    assertNoUndefinedOrNaN(payload);
    assert.equal(payload.temporada, '2026');
    assert.equal(payload.maxCupos, 16);
    assert.equal(payload.maxTransferenciasPorEquipo, 2);
  });

  it('buildSanitizedTeamPayload omits undefined optional fields and enforces min lengths', () => {
    const team: Team = {
      id: 't-vm-1',
      nombre: 'V',
      sigla: '',
      disciplineId: 'voley-m',
      carrera: '',
      facultad: '',
      groupName: '',
      escudo: undefined,
      anioFundacion: Number.NaN,
      logrosAnteriores: undefined,
    };

    const payload = buildSanitizedTeamPayload(team, 'uid-admin', true, 'admin');
    assertNoUndefinedOrNaN(payload);
    assert.ok((payload.nombre as string).length >= 2);
    assert.ok((payload.sigla as string).length >= 2);
    assert.equal('escudo' in payload, false);
    assert.equal('anioFundacion' in payload, false);
    assert.equal('logrosAnteriores' in payload, false);
  });
});
