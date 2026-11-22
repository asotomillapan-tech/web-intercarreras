import { useMemo, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Lock,
  Send,
  ShieldAlert,
  X,
} from 'lucide-react';
import { DISCIPLINE_MAP } from '../data/ufroSeed';
import { canAccessDelegateTransfers } from '../domain/rbacEngine';
import {
  createDelegateTransferRequest,
  getDelegateTransferActionRole,
  getDivisionLabelForDiscipline,
  respondToTransferRequest,
} from '../domain/transfersEngine';
import type {
  AppUserProfile,
  TournamentState,
  TransferRecord,
} from '../types/tournament';
import type { NavSection } from './Navbar';

interface TransfersViewProps {
  state: TournamentState;
  currentUser: AppUserProfile | null;
  onCreateTransferRequest: (transfer: TransferRecord) => void;
  onApproveTransferRequest: (updatedTransfer: TransferRecord, isFromDelegate: boolean) => void;
  onRejectTransferRequest: (updatedTransfer: TransferRecord) => void;
  onNavigate: (section: NavSection) => void;
  onOpenAuth: () => void;
}

type RequestDirection = 'INCOMING_REINFORCEMENT' | 'OUTGOING_RELEASE';

export function TransfersView({
  state,
  currentUser,
  onCreateTransferRequest,
  onApproveTransferRequest,
  onRejectTransferRequest,
  onNavigate,
  onOpenAuth,
}: TransfersViewProps) {
  const [direction, setDirection] = useState<RequestDirection>('INCOMING_REINFORCEMENT');
  const [counterpartTeamId, setCounterpartTeamId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isDelegado = canAccessDelegateTransfers(currentUser);
  const delegatedTeam = useMemo(
    () =>
      currentUser?.delegatedTeamId
        ? state.teams.find((t) => t.id === currentUser.delegatedTeamId)
        : undefined,
    [currentUser, state.teams]
  );

  const disciplineId = delegatedTeam?.disciplineId ?? 'f7-h-1';
  const config = state.configs[disciplineId];
  const meta = DISCIPLINE_MAP[disciplineId];

  // Rival teams in the exact same discipline/division
  const rivalTeams = useMemo(() => {
    if (!delegatedTeam) return [];
    return state.teams
      .filter((t) => t.disciplineId === delegatedTeam.disciplineId && t.id !== delegatedTeam.id)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [state.teams, delegatedTeam]);

  const effectiveCounterpartId =
    counterpartTeamId && rivalTeams.some((t) => t.id === counterpartTeamId)
      ? counterpartTeamId
      : rivalTeams[0]?.id ?? '';

  const effectiveFromTeamId =
    direction === 'INCOMING_REINFORCEMENT'
      ? effectiveCounterpartId
      : delegatedTeam?.id ?? '';

  const effectiveToTeamId =
    direction === 'INCOMING_REINFORCEMENT'
      ? delegatedTeam?.id ?? ''
      : effectiveCounterpartId;

  const eligiblePlayers = useMemo(
    () =>
      state.players
        .filter((p) => p.teamId === effectiveFromTeamId)
        .sort((a, b) => a.apellidoPaterno.localeCompare(b.apellidoPaterno, 'es')),
    [state.players, effectiveFromTeamId]
  );

  const effectivePlayerId =
    playerId && eligiblePlayers.some((p) => p.id === playerId)
      ? playerId
      : eligiblePlayers[0]?.id ?? '';

  // Partition transfers relevant to the signed-in delegate's team
  const {
    awaitingMyApproval,
    waitingCounterpart,
    teamHistory,
  } = useMemo(() => {
    if (!isDelegado || !delegatedTeam) {
      return {
        awaitingMyApproval: [] as TransferRecord[],
        waitingCounterpart: [] as TransferRecord[],
        teamHistory: [] as TransferRecord[],
      };
    }

    const mine = state.transfers.filter(
      (t) => t.fromTeamId === delegatedTeam.id || t.toTeamId === delegatedTeam.id
    );

    const incoming: TransferRecord[] = [];
    const outgoing: TransferRecord[] = [];
    const resolved: TransferRecord[] = [];

    mine.forEach((tr) => {
      if (tr.estado === 'PENDIENTE') {
        const role = getDelegateTransferActionRole(currentUser, tr);
        if (role === 'CAN_APPROVE') incoming.push(tr);
        else if (role === 'WAITING_COUNTERPART') outgoing.push(tr);
      } else {
        resolved.push(tr);
      }
    });

    resolved.sort((a, b) =>
      (b.approvedAt || b.rejectedAt || b.fecha).localeCompare(
        a.approvedAt || a.rejectedAt || a.fecha
      )
    );

    return {
      awaitingMyApproval: incoming,
      waitingCounterpart: outgoing,
      teamHistory: resolved,
    };
  }, [isDelegado, delegatedTeam, state.transfers, currentUser]);

  const handleCreateSubmit = (e: FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setErrors([]);

    if (!delegatedTeam || !currentUser) {
      setErrors(['Debes tener una cuenta de Delegado con equipo asignado para enviar solicitudes.']);
      return;
    }

    const fromTeam = state.teams.find((t) => t.id === effectiveFromTeamId);
    const toTeam = state.teams.find((t) => t.id === effectiveToTeamId);
    const player = state.players.find((p) => p.id === effectivePlayerId);

    if (!fromTeam || !toTeam || !player) {
      setErrors(['Selecciona un equipo contraparte y un estudiante válidos.']);
      return;
    }

    const toTeamPlayers = state.players.filter((p) => p.teamId === toTeam.id);
    const result = createDelegateTransferRequest({
      actor: currentUser,
      temporada: state.temporada,
      config,
      player,
      fromTeam,
      toTeam,
      motivo,
      existingTransfers: state.transfers,
      toTeamPlayers,
      maxSeleccionadosPorEquipo: meta.maxSeleccionadosPorEquipo,
    });

    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    onCreateTransferRequest(result.transfer);
    setMotivo('');
    setErrors([]);
    const counterpartName =
      fromTeam.id === delegatedTeam.id ? toTeam.nombre : fromTeam.nombre;
    setStatusMessage(
      `Solicitud enviada a ${counterpartName}. Quedará en estado PENDIENTE hasta que el delegado de ${counterpartName} la acepte.`
    );
  };

  const handleDecision = (transfer: TransferRecord, decision: 'ACCEPT' | 'REJECT') => {
    setStatusMessage(null);
    setErrors([]);

    if (!currentUser || !delegatedTeam) return;

    const trConfig = state.configs[transfer.disciplineId];
    const trMeta = DISCIPLINE_MAP[transfer.disciplineId];
    const player = state.players.find((p) => p.id === transfer.playerId);
    const fromTeam = state.teams.find((t) => t.id === transfer.fromTeamId);
    const toTeam = state.teams.find((t) => t.id === transfer.toTeamId);
    const toTeamPlayers = state.players.filter((p) => p.teamId === transfer.toTeamId);

    const res = respondToTransferRequest({
      transfer,
      actor: currentUser,
      decision,
      config: trConfig,
      player,
      fromTeam,
      toTeam,
      existingTransfers: state.transfers,
      toTeamPlayers,
      maxSeleccionadosPorEquipo: trMeta.maxSeleccionadosPorEquipo,
    });

    if (!res.ok) {
      setErrors(res.errors);
      return;
    }

    if (decision === 'ACCEPT') {
      const isFromDelegate = delegatedTeam.id === transfer.fromTeamId;
      onApproveTransferRequest(res.updated, isFromDelegate);
      setStatusMessage(
        `Transferencia confirmada por ambos delegados: ${transfer.playerName} pasa de ${transfer.fromTeamName} a ${transfer.toTeamName} y ya fue anunciada públicamente.`
      );
    } else {
      onRejectTransferRequest(res.updated);
      setStatusMessage(
        `Solicitud de transferencia por ${transfer.playerName} rechazada / cancelada.`
      );
    }
  };

  // Strict Delegate-Only Portal Gate
  if (!isDelegado) {
    return (
      <div className="bg-white min-h-[75vh]">
        <div className="bg-[#0d0d0d] text-white border-b border-white/10">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
              Acceso Restringido · Rol Delegado de Equipo
            </p>
            <h1 className="font-display text-4xl font-bold uppercase tracking-tight mt-2">
              Gestión de Solicitudes de Transferencia
            </h1>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="border border-neutral-200 bg-[#f5f6f8] p-8 space-y-5">
            <div className="flex items-start gap-3">
              <Lock className="w-6 h-6 text-[#707ef9] shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                  Exclusivo para Delegados de Equipo UFRO
                </h2>
                <p className="text-sm text-neutral-700 leading-relaxed">
                  Únicamente los <strong>Delegados de Equipo</strong> pueden enviar solicitudes de
                  transferencia y aprobar los movimientos entre planteles. Una vez que ambos
                  delegados aceptan la solicitud, la transferencia se anuncia públicamente en el
                  campeonato.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('transferencias-publicas')}
                className="inline-flex items-center gap-2 px-5 py-3 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
              >
                <span>Ver transferencias oficiales efectuadas</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              {!currentUser && (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="px-5 py-3 bg-[#0d0d0d] hover:bg-neutral-800 text-white font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
                >
                  Iniciar sesión como Delegado
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-[75vh]">
      {/* Dark Header */}
      <div className="bg-[#0d0d0d] text-white border-b border-white/10">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
              Portal Exclusivo de Delegados · Doble Aprobación Obligatoria
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-tight">
              Solicitudes de Transferencia
            </h1>
            <p className="text-sm text-neutral-400 max-w-2xl">
              Envía solicitudes de refuerzo o cesión para tu equipo y aprueba o rechaza solicitudes
              de otros delegados. Toda transferencia aceptada por ambas partes se anuncia
              públicamente en el inicio.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('transferencias-publicas')}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-white/20 hover:border-[#707ef9] text-white font-display font-bold uppercase tracking-widest text-xs transition-colors self-start lg:self-auto cursor-pointer whitespace-nowrap"
          >
            <span>Ver anuncios públicos</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {!delegatedTeam ? (
          <div className="border border-amber-300 bg-amber-50 p-6 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm text-amber-950">
              <p className="font-bold uppercase font-display tracking-wide text-base">
                Tu cuenta de Delegado aún no tiene un equipo asignado
              </p>
              <p className="text-xs leading-relaxed">
                Solicita a la Administración UFRO que vincule tu cuenta con tu equipo en{' '}
                <strong>Panel Oficial → Usuarios y Roles</strong> para poder enviar y aceptar
                solicitudes de transferencia.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Delegate Team Banner */}
            <div className="bg-[#f5f6f8] border border-neutral-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#707ef9]">
                  Equipo Delegado Activo
                </p>
                <p className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d] mt-0.5">
                  {delegatedTeam.nombre}{' '}
                  <span className="text-neutral-500 text-lg">· {meta.nombre}</span>
                </p>
                <p className="text-xs text-neutral-600 mt-0.5">
                  {getDivisionLabelForDiscipline(delegatedTeam.disciplineId)} · Límite:{' '}
                  {config.maxTransferenciasPorEquipo} refuerzo(s) por equipo · Máx.{' '}
                  {meta.maxSeleccionadosPorEquipo} seleccionados UFRO
                </p>
              </div>
              <div className="shrink-0">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-bold uppercase tracking-wider ${
                    config.transferenciasAbiertas
                      ? 'bg-emerald-700 text-white'
                      : 'bg-red-600 text-white'
                  }`}
                >
                  {config.transferenciasAbiertas ? 'Ventana Abierta' : 'Ventana Cerrada'}
                </span>
              </div>
            </div>

            {/* Feedback Alerts */}
            {statusMessage && (
              <div
                role="status"
                className="border border-emerald-300 bg-emerald-50 p-4 flex items-center gap-2.5 text-sm text-emerald-950 font-medium"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            {errors.length > 0 && (
              <div role="alert" className="border border-red-300 bg-red-50 p-4 space-y-1">
                {errors.map((err, i) => (
                  <p key={i} className="text-sm text-red-800">
                    {err}
                  </p>
                ))}
              </div>
            )}

            {/* Section 1: Pending Requests Requiring THIS Delegate's Approval */}
            <section className="space-y-4">
              <div className="flex items-baseline justify-between border-b border-neutral-200 pb-2">
                <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                  Solicitudes pendientes de tu aprobación
                </h2>
                <span className="text-xs font-bold uppercase tracking-wider text-[#707ef9] tabular-nums">
                  {awaitingMyApproval.length} por responder
                </span>
              </div>

              {awaitingMyApproval.length === 0 ? (
                <div className="border border-neutral-200 bg-[#f5f6f8] p-6 text-xs text-neutral-600">
                  No tienes solicitudes de otros delegados esperando tu confirmación en este
                  momento.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {awaitingMyApproval.map((tr) => {
                    const isOrigin = tr.fromTeamId === delegatedTeam.id;
                    return (
                      <div
                        key={tr.id}
                        className="border-2 border-[#707ef9] bg-white p-5 space-y-4"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="px-2 py-0.5 bg-[#707ef9] text-white font-display font-bold uppercase tracking-wider">
                            {isOrigin ? 'Solicitud de salida' : 'Oferta de incorporación'}
                          </span>
                          <span className="text-neutral-500 tabular-nums">{tr.fecha}</span>
                        </div>

                        <div>
                          <h3 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                            {tr.playerName}
                          </h3>
                          <p className="text-xs text-neutral-600 mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium">{tr.fromTeamName}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#707ef9]" />
                            <span className="font-bold text-[#0d0d0d]">{tr.toTeamName}</span>
                          </p>
                        </div>

                        <p className="text-xs text-neutral-700 bg-[#f5f6f8] border border-neutral-200 p-3 leading-relaxed">
                          <strong className="text-[#0d0d0d]">Motivo:</strong> {tr.motivo}
                        </p>

                        <p className="text-[11px] text-neutral-500">
                          Aprobada por{' '}
                          <strong className="text-[#0d0d0d]">
                            {tr.fromTeamApproved ? tr.fromTeamName : tr.toTeamName}
                          </strong>
                          {tr.requestedByName ? ` (${tr.requestedByName})` : ''}. Falta tu
                          confirmación para efectuar el traspaso y anunciarlo públicamente.
                        </p>

                        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-neutral-100">
                          <button
                            type="button"
                            onClick={() => handleDecision(tr, 'ACCEPT')}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-display font-bold uppercase tracking-widest text-xs cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            <span>Aceptar y efectuar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDecision(tr, 'REJECT')}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-red-300 text-red-700 hover:bg-red-50 font-display font-bold uppercase tracking-widest text-xs cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                            <span>Rechazar</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Section 2: Outgoing Requests Waiting for Counterpart Delegate */}
            {waitingCounterpart.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-baseline justify-between border-b border-neutral-200 pb-2">
                  <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                    Solicitudes enviadas esperando al otro delegado
                  </h2>
                  <span className="text-xs text-neutral-500 tabular-nums">
                    {waitingCounterpart.length} en espera
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {waitingCounterpart.map((tr) => {
                    const counterpartName =
                      tr.fromTeamId === delegatedTeam.id ? tr.toTeamName : tr.fromTeamName;
                    return (
                      <div
                        key={tr.id}
                        className="border border-neutral-200 bg-[#f5f6f8] p-5 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-amber-800">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Esperando a {counterpartName}</span>
                          </span>
                          <span className="text-neutral-500 tabular-nums">{tr.fecha}</span>
                        </div>

                        <div>
                          <p className="font-display text-xl font-bold uppercase text-[#0d0d0d]">
                            {tr.playerName}
                          </p>
                          <p className="text-xs text-neutral-600 flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span>{tr.fromTeamName}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#707ef9]" />
                            <span className="font-semibold text-[#0d0d0d]">{tr.toTeamName}</span>
                          </p>
                        </div>

                        <p className="text-xs text-neutral-600">{tr.motivo}</p>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-200 text-[11px]">
                          <span className="text-emerald-700 font-semibold">
                            ✓ Aprobada por tu equipo ({delegatedTeam.nombre})
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDecision(tr, 'REJECT')}
                            className="text-red-700 hover:underline font-semibold cursor-pointer"
                          >
                            Cancelar solicitud
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Section 3: Create New Transfer Request Form + Rules */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 border border-neutral-200 p-6 sm:p-8 space-y-6">
                <div className="border-b border-neutral-200 pb-4">
                  <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                    Enviar nueva solicitud de transferencia
                  </h2>
                  <p className="text-xs text-neutral-500 mt-1">
                    La solicitud quedará en estado <strong>PENDIENTE</strong> hasta ser aceptada
                    por el delegado del otro equipo.
                  </p>
                </div>

                {!config.transferenciasAbiertas && (
                  <div className="bg-[#f5f6f8] border border-neutral-200 p-4 flex items-center gap-3 text-xs text-neutral-700">
                    <Lock className="w-4 h-4 text-neutral-500 shrink-0" />
                    <span>
                      La ventana de transferencias para <strong>{meta.nombre}</strong> está
                      cerrada actualmente. Cuando Administración la habilite podrás enviar
                      solicitudes.
                    </span>
                  </div>
                )}

                <form onSubmit={handleCreateSubmit} className="space-y-5">
                  {/* Direction Toggle */}
                  <div>
                    <p className="block text-xs font-medium text-neutral-700 mb-2">
                      Tipo de solicitud
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDirection('INCOMING_REINFORCEMENT');
                          setPlayerId('');
                        }}
                        className={`p-3 border text-left transition-colors cursor-pointer ${
                          direction === 'INCOMING_REINFORCEMENT'
                            ? 'bg-[#0d0d0d] text-white border-[#0d0d0d]'
                            : 'bg-white text-[#0d0d0d] border-neutral-300 hover:border-[#0d0d0d]'
                        }`}
                      >
                        <span className="font-display text-sm font-bold uppercase tracking-wider block">
                          Solicitar jugador para mi equipo
                        </span>
                        <span
                          className={`text-[11px] block mt-0.5 ${
                            direction === 'INCOMING_REINFORCEMENT'
                              ? 'text-neutral-300'
                              : 'text-neutral-500'
                          }`}
                        >
                          Incorporar refuerzo hacia {delegatedTeam.nombre}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDirection('OUTGOING_RELEASE');
                          setPlayerId('');
                        }}
                        className={`p-3 border text-left transition-colors cursor-pointer ${
                          direction === 'OUTGOING_RELEASE'
                            ? 'bg-[#0d0d0d] text-white border-[#0d0d0d]'
                            : 'bg-white text-[#0d0d0d] border-neutral-300 hover:border-[#0d0d0d]'
                        }`}
                      >
                        <span className="font-display text-sm font-bold uppercase tracking-wider block">
                          Ceder jugador de mi equipo
                        </span>
                        <span
                          className={`text-[11px] block mt-0.5 ${
                            direction === 'OUTGOING_RELEASE'
                              ? 'text-neutral-300'
                              : 'text-neutral-500'
                          }`}
                        >
                          Proponer salida desde {delegatedTeam.nombre}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Counterpart Team */}
                  <div>
                    <label
                      htmlFor="del-tr-counterpart"
                      className="block text-xs font-medium text-neutral-700 mb-1"
                    >
                      {direction === 'INCOMING_REINFORCEMENT'
                        ? 'Equipo de origen del estudiante'
                        : 'Equipo de destino'}
                    </label>
                    <select
                      id="del-tr-counterpart"
                      value={effectiveCounterpartId}
                      onChange={(e) => {
                        setCounterpartTeamId(e.target.value);
                        setPlayerId('');
                      }}
                      className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:border-[#707ef9]"
                    >
                      {rivalTeams.length === 0 ? (
                        <option value="">
                          No hay otros equipos inscritos en {meta.nombreCorto}
                        </option>
                      ) : (
                        rivalTeams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nombre} ({t.groupName})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Player Selection */}
                  <div>
                    <label
                      htmlFor="del-tr-player"
                      className="block text-xs font-medium text-neutral-700 mb-1"
                    >
                      Estudiante a transferir
                    </label>
                    <select
                      id="del-tr-player"
                      value={effectivePlayerId}
                      onChange={(e) => setPlayerId(e.target.value)}
                      className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:border-[#707ef9]"
                    >
                      {eligiblePlayers.length === 0 ? (
                        <option value="">Sin jugadores registrados en el equipo de origen</option>
                      ) : (
                        eligiblePlayers.map((p) => (
                          <option key={p.id} value={p.id}>
                            #{p.dorsal} {p.nombre} {p.apellidoPaterno} {p.apellidoMaterno}
                            {p.esSeleccionadoUfro ? ' [Seleccionado UFRO]' : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Motivo */}
                  <div>
                    <label
                      htmlFor="del-tr-motivo"
                      className="block text-xs font-medium text-neutral-700 mb-1"
                    >
                      Motivo de la solicitud
                    </label>
                    <textarea
                      id="del-tr-motivo"
                      rows={3}
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Ej: Solicitud de refuerzo para fase de Playoffs previo acuerdo entre delegados."
                      className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-[#707ef9]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!config.transferenciasAbiertas || rivalTeams.length === 0 || eligiblePlayers.length === 0}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>Enviar solicitud al otro delegado</span>
                  </button>
                </form>
              </div>

              {/* Protocol Summary */}
              <div className="lg:col-span-5 bg-[#f5f6f8] border border-neutral-200 p-6 sm:p-8 space-y-5">
                <h3 className="font-display text-xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                  Protocolo de Doble Aprobación UFRO
                </h3>
                <ul className="space-y-4 text-sm text-neutral-700">
                  <li className="border-b border-neutral-200 pb-3">
                    <strong className="text-[#0d0d0d] block">
                      01. Exclusivo para Delegados
                    </strong>
                    Solo los delegados asignados al equipo de origen o destino pueden iniciar y
                    responder solicitudes.
                  </li>
                  <li className="border-b border-neutral-200 pb-3">
                    <strong className="text-[#0d0d0d] block">
                      02. Confirmación bilateral obligatoria
                    </strong>
                    Al enviar la solicitud queda aprobada solo por tu equipo. El jugador cambia de
                    plantel únicamente cuando el delegado del equipo contraparte la acepta.
                  </li>
                  <li className="border-b border-neutral-200 pb-3">
                    <strong className="text-[#0d0d0d] block">
                      03. Anuncio público automático
                    </strong>
                    Al completarse ambas aprobaciones, el traspaso se publica automáticamente en la
                    sección <strong>Últimas Transferencias</strong> de la página principal y en el
                    directorio oficial.
                  </li>
                  <li>
                    <strong className="text-[#0d0d0d] block">
                      04. Reglas deportivas vigentes
                    </strong>
                    Se valida ventana abierta, misma disciplina/división, tope de refuerzos por
                    equipo y máximo de seleccionados UFRO.
                  </li>
                </ul>
              </div>
            </div>

            {/* Section 4: Team Transfer History */}
            <section className="space-y-4">
              <div className="flex items-baseline justify-between border-b border-neutral-200 pb-2">
                <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                  Historial de mi equipo ({delegatedTeam.nombre})
                </h2>
                <span className="text-xs text-neutral-500 tabular-nums">
                  {teamHistory.length} resuelta(s)
                </span>
              </div>

              <div className="border border-neutral-200 overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#f5f6f8] border-b border-neutral-200 text-xs text-neutral-500 uppercase">
                      <th className="py-3 px-4 font-medium">Fecha</th>
                      <th className="py-3 px-3 font-medium">Estudiante</th>
                      <th className="py-3 px-3 font-medium">Movimiento</th>
                      <th className="py-3 px-3 hidden md:table-cell font-medium">Motivo</th>
                      <th className="py-3 px-4 text-right font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {teamHistory.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-8 px-4 text-center text-xs text-neutral-500"
                        >
                          Tu equipo aún no registra transferencias resueltas en la temporada{' '}
                          {state.temporada}.
                        </td>
                      </tr>
                    ) : (
                      teamHistory.map((tr) => (
                        <tr key={tr.id} className="hover:bg-[#f9fafb]">
                          <td className="py-3.5 px-4 tabular-nums text-xs text-neutral-600">
                            <span className="font-medium text-[#0d0d0d] block">{tr.fecha}</span>
                            <span>{tr.id}</span>
                          </td>
                          <td className="py-3.5 px-3 font-medium text-[#0d0d0d]">
                            {tr.playerName}
                          </td>
                          <td className="py-3.5 px-3 text-xs">
                            <span className="inline-flex items-center gap-1.5 flex-wrap">
                              <span className="text-neutral-500">{tr.fromTeamName}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-[#707ef9]" />
                              <span className="font-semibold text-[#0d0d0d]">{tr.toTeamName}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-3 hidden md:table-cell text-xs text-neutral-600 max-w-xs">
                            {tr.motivo}
                          </td>
                          <td className="py-3.5 px-4 text-right text-xs font-bold uppercase">
                            <span
                              className={
                                tr.estado === 'APROBADA'
                                  ? 'text-emerald-700'
                                  : 'text-red-600'
                              }
                            >
                              {tr.estado === 'APROBADA' ? 'Efectuada' : 'Rechazada'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
