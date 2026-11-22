import { DISCIPLINE_MAP } from '../data/ufroSeed';
import { validateTransferEligibility } from './tournamentEngine';
import type {
  AppUserProfile,
  DisciplineFormatConfig,
  DisciplineId,
  Player,
  Team,
  TransferRecord,
} from '../types/tournament';

export type PublicTransferSportFilter = 'ALL' | 'futbol7' | 'basquetbol' | 'voleibol';
export type PublicTransferRamaFilter = 'ALL' | 'Hombres' | 'Mujeres';

export interface PublicTransferFilters {
  sport: PublicTransferSportFilter;
  rama: PublicTransferRamaFilter;
  disciplineId: 'ALL' | DisciplineId;
  search: string;
}

export type DelegateTransferRole = 'CAN_APPROVE' | 'WAITING_COUNTERPART' | 'NONE';

export const SPORT_FILTER_LABELS: Record<PublicTransferSportFilter, string> = {
  ALL: 'Todos los deportes',
  futbol7: 'Fútbol 7',
  basquetbol: 'Básquetbol',
  voleibol: 'Voleibol',
};

export function getSportCategoryForDiscipline(
  disciplineId: DisciplineId
): Exclude<PublicTransferSportFilter, 'ALL'> {
  const meta = DISCIPLINE_MAP[disciplineId];
  if (meta.sportType === 'futbol7') return 'futbol7';
  if (meta.sportType === 'voleibol') return 'voleibol';
  return 'basquetbol';
}

export function getDivisionLabelForDiscipline(disciplineId: DisciplineId): string {
  switch (disciplineId) {
    case 'f7-h-1':
      return 'Primera División';
    case 'f7-h-2':
      return 'Segunda División';
    case 'f7-h-3':
      return 'Tercera División';
    case 'f7-m':
      return 'División Única Mujeres';
    case 'basquet-h':
      return 'División Única Hombres';
    case 'basquet-3x3-m':
      return 'Modalidad 3x3 Mujeres';
    case 'voley-m':
      return 'División Única Mujeres';
    case 'voley-h':
      return 'División Única Hombres';
  }
}

/**
 * Determines what action (if any) a signed-in delegate can take on a transfer request.
 */
export function getDelegateTransferActionRole(
  user: AppUserProfile | null,
  transfer: TransferRecord
): DelegateTransferRole {
  if (!user || user.role !== 'delegado' || !user.delegatedTeamId) {
    return 'NONE';
  }
  if (transfer.estado !== 'PENDIENTE') {
    return 'NONE';
  }

  const isFromDelegate = user.delegatedTeamId === transfer.fromTeamId;
  const isToDelegate = user.delegatedTeamId === transfer.toTeamId;
  if (!isFromDelegate && !isToDelegate) {
    return 'NONE';
  }

  const fromApproved = Boolean(transfer.fromTeamApproved);
  const toApproved = Boolean(transfer.toTeamApproved);

  if (isFromDelegate) {
    return fromApproved ? 'WAITING_COUNTERPART' : 'CAN_APPROVE';
  }
  return toApproved ? 'WAITING_COUNTERPART' : 'CAN_APPROVE';
}

/**
 * Creates a new mutual-approval transfer request initiated strictly by a Delegado
 * belonging to either the origin team or the destination team.
 * The transfer starts in PENDIENTE with only the initiating delegate's side approved.
 */
export function createDelegateTransferRequest(params: {
  actor: AppUserProfile | null;
  temporada: string;
  config: DisciplineFormatConfig;
  player: Player;
  fromTeam: Team;
  toTeam: Team;
  motivo: string;
  existingTransfers: TransferRecord[];
  toTeamPlayers: Player[];
  maxSeleccionadosPorEquipo: number;
  nowIso?: string;
}): { ok: true; transfer: TransferRecord } | { ok: false; errors: string[] } {
  const { actor, config, player, fromTeam, toTeam, existingTransfers, toTeamPlayers } = params;
  const errors: string[] = [];

  if (!actor || actor.role !== 'delegado') {
    return {
      ok: false,
      errors: ['Únicamente los Delegados de Equipo pueden enviar solicitudes de transferencia.'],
    };
  }

  if (!actor.delegatedTeamId) {
    return {
      ok: false,
      errors: [
        'Tu cuenta de Delegado aún no tiene un equipo asignado. Solicita al Administrador la vinculación de tu equipo.',
      ],
    };
  }

  const isFromDelegate = actor.delegatedTeamId === fromTeam.id;
  const isToDelegate = actor.delegatedTeamId === toTeam.id;

  if (!isFromDelegate && !isToDelegate) {
    return {
      ok: false,
      errors: [
        'Solo puedes enviar solicitudes donde tu equipo asignado sea el equipo de origen o el de destino.',
      ],
    };
  }

  if (player.teamId !== fromTeam.id) {
    errors.push('El estudiante seleccionado no pertenece actualmente al equipo de origen.');
  }

  const cleanMotivo = params.motivo.trim();
  if (cleanMotivo.length < 6) {
    errors.push('Indica brevemente el motivo deportivo o reglamentario de la solicitud (mín. 6 caracteres).');
  }

  const hasPendingForPlayer = existingTransfers.some(
    (t) => t.playerId === player.id && t.estado === 'PENDIENTE'
  );
  if (hasPendingForPlayer) {
    errors.push('Ya existe una solicitud de transferencia pendiente para este estudiante.');
  }

  const eligibility = validateTransferEligibility({
    config,
    player,
    fromTeam,
    toTeam,
    existingTransfers,
    toTeamPlayers,
    maxSeleccionadosPorEquipo: params.maxSeleccionadosPorEquipo,
  });
  if (!eligibility.valid) {
    errors.push(...eligibility.errors);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const nowIso = params.nowIso ?? new Date().toISOString();
  const suffix = String(Date.now()).slice(-5);
  const transfer: TransferRecord = {
    id: `TR-${params.temporada}-${String(existingTransfers.length + 1).padStart(3, '0')}-${suffix}`,
    disciplineId: fromTeam.disciplineId,
    playerId: player.id,
    playerName: `${player.nombre} ${player.apellidoPaterno} ${player.apellidoMaterno}`.trim(),
    playerRut: player.rut || undefined,
    fromTeamId: fromTeam.id,
    fromTeamName: fromTeam.nombre,
    toTeamId: toTeam.id,
    toTeamName: toTeam.nombre,
    fecha: nowIso.slice(0, 10),
    motivo: cleanMotivo.slice(0, 300),
    estado: 'PENDIENTE',
    createdByUid: actor.uid,
    requestedByTeamId: actor.delegatedTeamId,
    requestedByName: actor.displayName.trim().slice(0, 120),
    fromTeamApproved: isFromDelegate,
    fromTeamApprovedByUid: isFromDelegate ? actor.uid : undefined,
    toTeamApproved: isToDelegate,
    toTeamApprovedByUid: isToDelegate ? actor.uid : undefined,
    updatedAt: nowIso,
  };

  return { ok: true, transfer };
}

/**
 * Processes the counterpart delegate's ACCEPT or either involved delegate's REJECT
 * on a pending mutual-approval transfer request.
 */
export function respondToTransferRequest(params: {
  transfer: TransferRecord;
  actor: AppUserProfile | null;
  decision: 'ACCEPT' | 'REJECT';
  config: DisciplineFormatConfig;
  player?: Player;
  fromTeam?: Team;
  toTeam?: Team;
  existingTransfers: TransferRecord[];
  toTeamPlayers: Player[];
  maxSeleccionadosPorEquipo: number;
  nowIso?: string;
}): { ok: true; updated: TransferRecord } | { ok: false; errors: string[] } {
  const { transfer, actor, decision } = params;

  if (!actor || actor.role !== 'delegado' || !actor.delegatedTeamId) {
    return {
      ok: false,
      errors: ['Solo el Delegado de uno de los equipos involucrados puede responder esta solicitud.'],
    };
  }

  if (transfer.estado !== 'PENDIENTE') {
    return {
      ok: false,
      errors: ['Esta solicitud de transferencia ya fue resuelta y no admite nuevos cambios.'],
    };
  }

  const isFromDelegate = actor.delegatedTeamId === transfer.fromTeamId;
  const isToDelegate = actor.delegatedTeamId === transfer.toTeamId;
  if (!isFromDelegate && !isToDelegate) {
    return {
      ok: false,
      errors: ['Tu equipo asignado no forma parte de esta solicitud de transferencia.'],
    };
  }

  const nowIso = params.nowIso ?? new Date().toISOString();

  if (decision === 'REJECT') {
    return {
      ok: true,
      updated: {
        ...transfer,
        estado: 'RECHAZADA',
        rejectedByUid: actor.uid,
        rejectedAt: nowIso,
        updatedAt: nowIso,
      },
    };
  }

  // ACCEPT path: strictly require the counterpart delegate (cannot self-approve both sides)
  const roleState = getDelegateTransferActionRole(actor, transfer);
  if (roleState !== 'CAN_APPROVE') {
    return {
      ok: false,
      errors: [
        'Tu equipo ya aprobó esta solicitud. Debe ser aceptada por el delegado del otro equipo para efectuarse.',
      ],
    };
  }

  if (params.player && params.fromTeam && params.toTeam) {
    const eligibility = validateTransferEligibility({
      config: params.config,
      player: params.player,
      fromTeam: params.fromTeam,
      toTeam: params.toTeam,
      existingTransfers: params.existingTransfers.filter((t) => t.id !== transfer.id),
      toTeamPlayers: params.toTeamPlayers,
      maxSeleccionadosPorEquipo: params.maxSeleccionadosPorEquipo,
    });
    if (!eligibility.valid) {
      return { ok: false, errors: eligibility.errors };
    }
  } else if (!params.config.transferenciasAbiertas) {
    return {
      ok: false,
      errors: ['La ventana de transferencias está cerrada para esta disciplina.'],
    };
  }

  const updated: TransferRecord = {
    ...transfer,
    fromTeamApproved: true,
    fromTeamApprovedByUid: isFromDelegate ? actor.uid : transfer.fromTeamApprovedByUid,
    toTeamApproved: true,
    toTeamApprovedByUid: isToDelegate ? actor.uid : transfer.toTeamApprovedByUid,
    estado: 'APROBADA',
    fecha: nowIso.slice(0, 10),
    approvedAt: nowIso,
    updatedAt: nowIso,
  };

  return { ok: true, updated };
}

/**
 * Returns ONLY finalized, publicly announced transfers (estado === 'APROBADA'),
 * ordered from newest to oldest.
 */
export function getPublicApprovedTransfers(transfers: TransferRecord[]): TransferRecord[] {
  return transfers
    .filter((t) => t.estado === 'APROBADA')
    .sort((a, b) => {
      const timeA = a.approvedAt || a.updatedAt || a.fecha || '';
      const timeB = b.approvedAt || b.updatedAt || b.fecha || '';
      const cmp = timeB.localeCompare(timeA);
      if (cmp !== 0) return cmp;
      return b.id.localeCompare(a.id);
    });
}

/**
 * Filters public approved transfers by sport, rama (Hombres/Mujeres), division/discipline, and search text.
 */
export function filterPublicTransfers(
  transfers: TransferRecord[],
  filters: PublicTransferFilters
): TransferRecord[] {
  const approved = getPublicApprovedTransfers(transfers);
  const query = filters.search.trim().toLowerCase();

  return approved.filter((t) => {
    const meta = DISCIPLINE_MAP[t.disciplineId];
    if (!meta) return false;

    if (filters.sport !== 'ALL' && getSportCategoryForDiscipline(t.disciplineId) !== filters.sport) {
      return false;
    }
    if (filters.rama !== 'ALL' && meta.rama !== filters.rama) {
      return false;
    }
    if (filters.disciplineId !== 'ALL' && t.disciplineId !== filters.disciplineId) {
      return false;
    }
    if (query) {
      const division = getDivisionLabelForDiscipline(t.disciplineId).toLowerCase();
      const matchesText =
        t.playerName.toLowerCase().includes(query) ||
        t.fromTeamName.toLowerCase().includes(query) ||
        t.toTeamName.toLowerCase().includes(query) ||
        meta.nombre.toLowerCase().includes(query) ||
        division.includes(query) ||
        t.motivo.toLowerCase().includes(query);
      if (!matchesText) return false;
    }
    return true;
  });
}
