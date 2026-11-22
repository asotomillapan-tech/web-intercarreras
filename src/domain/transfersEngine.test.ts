import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDelegateTransferRequest,
  filterPublicTransfers,
  getDelegateTransferActionRole,
  getPublicApprovedTransfers,
  respondToTransferRequest,
} from './transfersEngine';
import type {
  AppUserProfile,
  DisciplineFormatConfig,
  Player,
  Team,
  TransferRecord,
} from '../types/tournament';

const openConfig: DisciplineFormatConfig = {
  disciplineId: 'f7-h-1',
  temporada: '2026',
  maxCupos: 20,
  numGrupos: 4,
  clasificadosPorGrupo: 2,
  formatoPlayoff: 8,
  incluyeTercerLugar: true,
  inscripcionesAbiertas: false,
  transferenciasAbiertas: true,
  maxTransferenciasPorEquipo: 2,
  faseActual: 'TRANSFERENCIAS',
};

const teamA: Team = {
  id: 'team-a',
  nombre: 'Real Efineza FC',
  sigla: 'REF',
  disciplineId: 'f7-h-1',
  carrera: 'Educación Física',
  facultad: 'Facultad de Educación',
  groupName: 'Grupo A',
};

const teamB: Team = {
  id: 'team-b',
  nombre: 'Manchester Civil',
  sigla: 'MCV',
  disciplineId: 'f7-h-1',
  carrera: 'Ingeniería Civil',
  facultad: 'Facultad de Ingeniería y Ciencias',
  groupName: 'Grupo B',
};

const playerA: Player = {
  id: 'pl-1',
  teamId: 'team-a',
  disciplineId: 'f7-h-1',
  dorsal: 10,
  posicion: 'Delantero',
  nombre: 'Matías',
  apellidoPaterno: 'Rojas',
  apellidoMaterno: 'Pérez',
  carrera: 'Educación Física',
  facultad: 'Facultad de Educación',
  rut: '20.111.222-3',
  numeroMatricula: '2023001',
  correoInstitucional: 'm.rojas@ufromail.cl',
  nivelAcademico: 'Pregrado',
  fechaNacimiento: '2003-04-12',
  fotografia: '',
  esSeleccionadoUfro: false,
  stats: {
    partidosJugados: 3,
    goles: 4,
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

function makeUser(overrides: Partial<AppUserProfile>): AppUserProfile {
  return {
    uid: 'u-1',
    displayName: 'Delegado Test',
    email: 'delegado@ufromail.cl',
    role: 'delegado',
    favoriteTeamIds: [],
    notificationsEnabled: true,
    authSource: 'google',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('only a delegate of one of the involved teams can create a pending transfer request', () => {
  const adminUser = makeUser({ uid: 'u-admin', role: 'admin' });
  const nonDelegateRes = createDelegateTransferRequest({
    actor: adminUser,
    temporada: '2026',
    config: openConfig,
    player: playerA,
    fromTeam: teamA,
    toTeam: teamB,
    motivo: 'Refuerzo playoffs',
    existingTransfers: [],
    toTeamPlayers: [],
    maxSeleccionadosPorEquipo: 2,
  });
  assert.equal(nonDelegateRes.ok, false);

  const unrelatedDelegate = makeUser({ uid: 'u-del-c', role: 'delegado', delegatedTeamId: 'team-c' });
  const unrelatedRes = createDelegateTransferRequest({
    actor: unrelatedDelegate,
    temporada: '2026',
    config: openConfig,
    player: playerA,
    fromTeam: teamA,
    toTeam: teamB,
    motivo: 'Refuerzo playoffs',
    existingTransfers: [],
    toTeamPlayers: [],
    maxSeleccionadosPorEquipo: 2,
  });
  assert.equal(unrelatedRes.ok, false);

  const delegateTo = makeUser({
    uid: 'u-del-b',
    displayName: 'Camila Torres',
    role: 'delegado',
    delegatedTeamId: 'team-b',
  });
  const created = createDelegateTransferRequest({
    actor: delegateTo,
    temporada: '2026',
    config: openConfig,
    player: playerA,
    fromTeam: teamA,
    toTeam: teamB,
    motivo: 'Refuerzo para cuartos de final tras cierre de grupos',
    existingTransfers: [],
    toTeamPlayers: [],
    maxSeleccionadosPorEquipo: 2,
    nowIso: '2026-11-15T12:00:00.000Z',
  });

  assert.equal(created.ok, true);
  if (created.ok) {
    assert.equal(created.transfer.estado, 'PENDIENTE');
    assert.equal(created.transfer.toTeamApproved, true);
    assert.equal(created.transfer.fromTeamApproved, false);
    assert.equal(created.transfer.toTeamApprovedByUid, 'u-del-b');
    assert.equal(created.transfer.fromTeamApprovedByUid, undefined);
    assert.equal(getDelegateTransferActionRole(delegateTo, created.transfer), 'WAITING_COUNTERPART');
  }
});

test('transfer requires mutual approval: initiating delegate cannot self-approve, counterpart delegate finalizes it', () => {
  const delegateFrom = makeUser({ uid: 'u-del-a', role: 'delegado', delegatedTeamId: 'team-a' });
  const delegateTo = makeUser({ uid: 'u-del-b', role: 'delegado', delegatedTeamId: 'team-b' });

  const created = createDelegateTransferRequest({
    actor: delegateTo,
    temporada: '2026',
    config: openConfig,
    player: playerA,
    fromTeam: teamA,
    toTeam: teamB,
    motivo: 'Refuerzo ofensivo para llaves eliminatorias',
    existingTransfers: [],
    toTeamPlayers: [],
    maxSeleccionadosPorEquipo: 2,
    nowIso: '2026-11-15T12:00:00.000Z',
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  // Same delegate trying to double-approve must be rejected
  const selfApprove = respondToTransferRequest({
    transfer: created.transfer,
    actor: delegateTo,
    decision: 'ACCEPT',
    config: openConfig,
    player: playerA,
    fromTeam: teamA,
    toTeam: teamB,
    existingTransfers: [created.transfer],
    toTeamPlayers: [],
    maxSeleccionadosPorEquipo: 2,
  });
  assert.equal(selfApprove.ok, false);

  // Counterpart delegate (fromTeam) can approve and finalize
  assert.equal(getDelegateTransferActionRole(delegateFrom, created.transfer), 'CAN_APPROVE');
  const accepted = respondToTransferRequest({
    transfer: created.transfer,
    actor: delegateFrom,
    decision: 'ACCEPT',
    config: openConfig,
    player: playerA,
    fromTeam: teamA,
    toTeam: teamB,
    existingTransfers: [created.transfer],
    toTeamPlayers: [],
    maxSeleccionadosPorEquipo: 2,
    nowIso: '2026-11-15T14:30:00.000Z',
  });
  assert.equal(accepted.ok, true);
  if (accepted.ok) {
    assert.equal(accepted.updated.estado, 'APROBADA');
    assert.equal(accepted.updated.fromTeamApproved, true);
    assert.equal(accepted.updated.toTeamApproved, true);
    assert.equal(accepted.updated.fromTeamApprovedByUid, 'u-del-a');
    assert.equal(accepted.updated.approvedAt, '2026-11-15T14:30:00.000Z');

    // Terminal state: cannot reject after approval
    const lateReject = respondToTransferRequest({
      transfer: accepted.updated,
      actor: delegateFrom,
      decision: 'REJECT',
      config: openConfig,
      existingTransfers: [accepted.updated],
      toTeamPlayers: [],
      maxSeleccionadosPorEquipo: 2,
    });
    assert.equal(lateReject.ok, false);
  }
});

test('public transfer list hides pending/rejected transfers and filters approved ones by sport, rama, division, and query', () => {
  const sampleTransfers: TransferRecord[] = [
    {
      id: 'TR-1',
      disciplineId: 'f7-h-1',
      playerId: 'p1',
      playerName: 'Matías Rojas',
      fromTeamId: 't1',
      fromTeamName: 'Real Efineza FC',
      toTeamId: 't2',
      toTeamName: 'Manchester Civil',
      fecha: '2026-11-15',
      motivo: 'Refuerzo Playoffs',
      estado: 'APROBADA',
      approvedAt: '2026-11-15T18:00:00.000Z',
    },
    {
      id: 'TR-2',
      disciplineId: 'f7-h-2',
      playerId: 'p2',
      playerName: 'Diego Soto',
      fromTeamId: 't3',
      fromTeamName: 'Hormigón Armado',
      toTeamId: 't4',
      toTeamName: 'Efiorentina',
      fecha: '2026-11-16',
      motivo: 'Refuerzo 2da Div',
      estado: 'PENDIENTE',
    },
    {
      id: 'TR-3',
      disciplineId: 'voley-m',
      playerId: 'p3',
      playerName: 'Valentina Fuentes',
      fromTeamId: 't5',
      fromTeamName: 'Enfermería Voley',
      toTeamId: 't6',
      toTeamName: 'Medicina Damas',
      fecha: '2026-11-17',
      motivo: 'Refuerzo armadora',
      estado: 'APROBADA',
      approvedAt: '2026-11-17T10:00:00.000Z',
    },
    {
      id: 'TR-4',
      disciplineId: 'basquet-3x3-m',
      playerId: 'p4',
      playerName: 'Sofía Méndez',
      fromTeamId: 't7',
      fromTeamName: 'Psicología 3x3',
      toTeamId: 't8',
      toTeamName: 'Derecho 3x3',
      fecha: '2026-11-14',
      motivo: 'Reemplazo por lesión',
      estado: 'RECHAZADA',
    },
  ];

  const publicAll = getPublicApprovedTransfers(sampleTransfers);
  assert.deepEqual(
    publicAll.map((t) => t.id),
    ['TR-3', 'TR-1']
  );

  const onlyFutbol = filterPublicTransfers(sampleTransfers, {
    sport: 'futbol7',
    rama: 'ALL',
    disciplineId: 'ALL',
    search: '',
  });
  assert.deepEqual(
    onlyFutbol.map((t) => t.id),
    ['TR-1']
  );

  const onlyWomen = filterPublicTransfers(sampleTransfers, {
    sport: 'ALL',
    rama: 'Mujeres',
    disciplineId: 'ALL',
    search: '',
  });
  assert.deepEqual(
    onlyWomen.map((t) => t.id),
    ['TR-3']
  );

  const byDivisionSearch = filterPublicTransfers(sampleTransfers, {
    sport: 'ALL',
    rama: 'ALL',
    disciplineId: 'f7-h-1',
    search: 'civil',
  });
  assert.deepEqual(
    byDivisionSearch.map((t) => t.id),
    ['TR-1']
  );
});
