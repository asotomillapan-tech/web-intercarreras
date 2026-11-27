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
import { RevealSection, SectionKicker } from './MotionPrimitives';
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
      `Solicitud enviada a ${counterpartName}. Quedará pendiente hasta su aprobación.`
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
        `Transferencia confirmada: ${transfer.playerName} pasa de ${transfer.fromTeamName} a ${transfer.toTeamName}.`
      );
    } else {
      onRejectTransferRequest(res.updated);
      setStatusMessage(`Solicitud por ${transfer.playerName} rechazada.`);
    }
  };

  if (!isDelegado) {
    return (
      <div className="bg-[#050507] text-zinc-100 min-h-[80vh]">
        <div className="border-b border-white/[0.08]">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-3">
            <SectionKicker index="01" label="Portal Delegados" />
            <h1 className="text-4xl font-medium tracking-[-0.03em] text-white">
              Gestión de <span className="font-editorial text-[#c8ceff]">transferencias</span>
            </h1>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-8 space-y-5">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-[#9aa5ff] shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h2 className="text-xl font-medium text-white">Exclusivo para Delegados</h2>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Solo los delegados de equipo pueden iniciar y aprobar traspasos. Los movimientos
                  confirmados se publican en el boletín oficial.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('transferencias-publicas')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium transition-colors cursor-pointer"
              >
                <span>Ver transferencias oficiales</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              {!currentUser && (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="px-5 py-2.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  Iniciar sesión
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#050507] text-zinc-100 min-h-[80vh]">
      <div className="border-b border-white/[0.08]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-3">
            <SectionKicker index="01" label="Portal Delegados · Doble Aprobación" />
            <h1 className="text-4xl sm:text-5xl font-medium tracking-[-0.035em] text-white">
              Solicitudes de <span className="font-editorial text-[#c8ceff]">transferencia</span>
            </h1>
            <p className="text-sm text-zinc-400 max-w-xl">
              Envía solicitudes de refuerzo o cesión y aprueba movimientos de otros delegados.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('transferencias-publicas')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.1] text-white text-xs font-medium transition-colors self-start lg:self-auto cursor-pointer whitespace-nowrap"
          >
            <span>Ver boletín público</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <RevealSection className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {!delegatedTeam ? (
          <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm text-amber-100">
              <p className="font-medium text-base">Sin equipo asignado</p>
              <p className="text-xs text-amber-200/80">
                Solicita a Administración vincular tu cuenta de Delegado con tu equipo.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Delegate Team Banner */}
            <div className="rounded-3xl bg-[#0c0c10] border border-white/[0.08] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs text-[#9aa5ff] font-medium">Equipo delegado activo</p>
                <p className="text-xl sm:text-2xl font-medium text-white mt-0.5">
                  {delegatedTeam.nombre}{' '}
                  <span className="text-zinc-500 text-base">· {meta.nombre}</span>
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {getDivisionLabelForDiscipline(delegatedTeam.disciplineId)} · Máx.{' '}
                  {config.maxTransferenciasPorEquipo} refuerzos · Máx.{' '}
                  {meta.maxSeleccionadosPorEquipo} seleccionados UFRO
                </p>
              </div>
              <span
                className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-medium self-start sm:self-auto ${
                  config.transferenciasAbiertas
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/15 border border-red-500/30 text-red-300'
                }`}
              >
                {config.transferenciasAbiertas ? 'Ventana abierta' : 'Ventana cerrada'}
              </span>
            </div>

            {statusMessage && (
              <div
                role="status"
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-2.5 text-sm text-emerald-200"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            {errors.length > 0 && (
              <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 space-y-1">
                {errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-200">
                    {err}
                  </p>
                ))}
              </div>
            )}

            {/* Pending Approvals */}
            <section className="space-y-4">
              <div className="flex items-baseline justify-between border-b border-white/[0.08] pb-3">
                <h2 className="text-xl font-medium text-white">Pendientes de tu aprobación</h2>
                <span className="text-xs text-[#a5b0ff] tabular-nums">
                  {awaitingMyApproval.length} por responder
                </span>
              </div>

              {awaitingMyApproval.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] p-6 text-xs text-zinc-500">
                  Sin solicitudes esperando tu confirmación.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {awaitingMyApproval.map((tr) => {
                    const isOrigin = tr.fromTeamId === delegatedTeam.id;
                    return (
                      <div
                        key={tr.id}
                        className="rounded-3xl border border-[#707ef9]/45 bg-[#0c0c10] p-5 space-y-4"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="px-2.5 py-0.5 rounded-full bg-[#707ef9]/20 border border-[#707ef9]/35 text-[#c8ceff] font-medium">
                            {isOrigin ? 'Salida' : 'Incorporación'}
                          </span>
                          <span className="text-zinc-500 tabular-nums">{tr.fecha}</span>
                        </div>

                        <div>
                          <h3 className="text-xl font-medium text-white">{tr.playerName}</h3>
                          <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5 flex-wrap">
                            <span>{tr.fromTeamName}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#9aa5ff]" />
                            <span className="text-white font-medium">{tr.toTeamName}</span>
                          </p>
                        </div>

                        <p className="text-xs text-zinc-300 rounded-xl bg-[#111117] border border-white/[0.06] p-3">
                          {tr.motivo}
                        </p>

                        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-white/[0.06]">
                          <button
                            type="button"
                            onClick={() => handleDecision(tr, 'ACCEPT')}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-[#050507] text-xs font-medium cursor-pointer transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Aceptar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDecision(tr, 'REJECT')}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-red-500/35 text-red-300 hover:bg-red-500/15 text-xs font-medium cursor-pointer transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Rechazar</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Waiting Counterpart */}
            {waitingCounterpart.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-baseline justify-between border-b border-white/[0.08] pb-3">
                  <h2 className="text-xl font-medium text-white">Esperando al otro delegado</h2>
                  <span className="text-xs text-zinc-500 tabular-nums">
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
                        className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] p-5 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="inline-flex items-center gap-1.5 text-amber-300 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Esperando a {counterpartName}</span>
                          </span>
                          <span className="text-zinc-500 tabular-nums">{tr.fecha}</span>
                        </div>
                        <p className="text-lg font-medium text-white">{tr.playerName}</p>
                        <p className="text-xs text-zinc-400">{tr.motivo}</p>
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06] text-xs">
                          <span className="text-emerald-400">✓ Aprobada por tu equipo</span>
                          <button
                            type="button"
                            onClick={() => handleDecision(tr, 'REJECT')}
                            className="text-red-400 hover:text-red-300 cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Create Request + Protocol */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-6 sm:p-8 space-y-6">
                <div className="border-b border-white/[0.08] pb-4">
                  <h2 className="text-xl font-medium text-white">Nueva solicitud</h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    Requiere aprobación del delegado contraparte.
                  </p>
                </div>

                {!config.transferenciasAbiertas && (
                  <div className="rounded-2xl bg-[#111117] border border-white/[0.08] p-4 flex items-center gap-3 text-xs text-zinc-400">
                    <Lock className="w-4 h-4 text-zinc-500 shrink-0" />
                    <span>Ventana cerrada para {meta.nombre}.</span>
                  </div>
                )}

                <form onSubmit={handleCreateSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      {
                        id: 'INCOMING_REINFORCEMENT' as const,
                        title: 'Solicitar jugador',
                        sub: `Hacia ${delegatedTeam.nombre}`,
                      },
                      {
                        id: 'OUTGOING_RELEASE' as const,
                        title: 'Ceder jugador',
                        sub: `Desde ${delegatedTeam.nombre}`,
                      },
                    ].map((opt) => {
                      const active = direction === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setDirection(opt.id);
                            setPlayerId('');
                          }}
                          className={`p-3.5 rounded-2xl border text-left transition-colors cursor-pointer ${
                            active
                              ? 'bg-white text-[#050507] border-white'
                              : 'bg-[#111117] text-zinc-200 border-white/[0.08] hover:border-white/[0.2]'
                          }`}
                        >
                          <span className="text-xs font-medium block">{opt.title}</span>
                          <span className={`text-[11px] block mt-0.5 ${active ? 'text-zinc-600' : 'text-zinc-500'}`}>
                            {opt.sub}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <label htmlFor="del-tr-counterpart" className="block text-xs text-zinc-400 mb-1.5">
                      {direction === 'INCOMING_REINFORCEMENT' ? 'Equipo de origen' : 'Equipo de destino'}
                    </label>
                    <select
                      id="del-tr-counterpart"
                      value={effectiveCounterpartId}
                      onChange={(e) => {
                        setCounterpartTeamId(e.target.value);
                        setPlayerId('');
                      }}
                      className="w-full rounded-xl bg-[#111117] border border-white/[0.1] px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[#707ef9]"
                    >
                      {rivalTeams.length === 0 ? (
                        <option value="">Sin otros equipos en {meta.nombreCorto}</option>
                      ) : (
                        rivalTeams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nombre} ({t.groupName})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="del-tr-player" className="block text-xs text-zinc-400 mb-1.5">
                      Jugador
                    </label>
                    <select
                      id="del-tr-player"
                      value={effectivePlayerId}
                      onChange={(e) => setPlayerId(e.target.value)}
                      className="w-full rounded-xl bg-[#111117] border border-white/[0.1] px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[#707ef9]"
                    >
                      {eligiblePlayers.length === 0 ? (
                        <option value="">Sin jugadores registrados</option>
                      ) : (
                        eligiblePlayers.map((p) => (
                          <option key={p.id} value={p.id}>
                            #{p.dorsal} {p.nombre} {p.apellidoPaterno} {p.apellidoMaterno}
                            {p.esSeleccionadoUfro ? ' [Sel. UFRO]' : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="del-tr-motivo" className="block text-xs text-zinc-400 mb-1.5">
                      Motivo
                    </label>
                    <textarea
                      id="del-tr-motivo"
                      rows={3}
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Ej: Refuerzo para Playoffs previo acuerdo entre delegados."
                      className="w-full rounded-xl bg-[#111117] border border-white/[0.1] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!config.transferenciasAbiertas || rivalTeams.length === 0 || eligiblePlayers.length === 0}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#707ef9] hover:bg-[#5c6bf0] text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-45"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar solicitud</span>
                  </button>
                </form>
              </div>

              {/* Protocol */}
              <div className="lg:col-span-5 rounded-3xl bg-[#0c0c10] border border-white/[0.08] p-6 sm:p-8 space-y-5">
                <h3 className="text-lg font-medium text-white">Protocolo bilateral</h3>
                <ul className="space-y-4 text-xs text-zinc-400 leading-relaxed">
                  {[
                    ['01', 'Solo delegados', 'Únicamente delegados asignados inician y responden solicitudes.'],
                    ['02', 'Doble confirmación', 'El cambio se ejecuta solo cuando ambos equipos aprueban.'],
                    ['03', 'Publicación automática', 'Se anuncia en portada y en el boletín oficial.'],
                    ['04', 'Reglas vigentes', 'Valida ventana abierta, misma división y cupo de seleccionados.'],
                  ].map(([num, title, desc]) => (
                    <li key={num} className="border-b border-white/[0.06] pb-3 last:border-b-0 last:pb-0">
                      <span className="font-mono text-[#9aa5ff] mr-2">({num})</span>
                      <strong className="text-zinc-200 font-medium">{title}</strong>
                      <p className="mt-1">{desc}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* History */}
            <section className="space-y-4">
              <div className="flex items-baseline justify-between border-b border-white/[0.08] pb-3">
                <h2 className="text-xl font-medium text-white">
                  Historial · {delegatedTeam.nombre}
                </h2>
                <span className="text-xs text-zinc-500 tabular-nums">{teamHistory.length}</span>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-white/[0.08] text-xs text-zinc-500">
                      <th className="py-3 px-4 font-medium">Fecha</th>
                      <th className="py-3 px-3 font-medium">Jugador</th>
                      <th className="py-3 px-3 font-medium">Movimiento</th>
                      <th className="py-3 px-3 hidden md:table-cell font-medium">Motivo</th>
                      <th className="py-3 px-4 text-right font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {teamHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 px-4 text-center text-xs text-zinc-500">
                          Sin transferencias resueltas en {state.temporada}.
                        </td>
                      </tr>
                    ) : (
                      teamHistory.map((tr) => (
                        <tr key={tr.id} className="hover:bg-white/[0.02]">
                          <td className="py-3.5 px-4 tabular-nums text-xs text-zinc-400">
                            <span className="font-medium text-zinc-200 block">{tr.fecha}</span>
                            <span className="text-zinc-600">{tr.id}</span>
                          </td>
                          <td className="py-3.5 px-3 font-medium text-white">{tr.playerName}</td>
                          <td className="py-3.5 px-3 text-xs">
                            <span className="inline-flex items-center gap-1.5 flex-wrap">
                              <span className="text-zinc-400">{tr.fromTeamName}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-[#9aa5ff]" />
                              <span className="font-medium text-white">{tr.toTeamName}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-3 hidden md:table-cell text-xs text-zinc-400 max-w-xs">
                            {tr.motivo}
                          </td>
                          <td className="py-3.5 px-4 text-right text-xs font-medium">
                            <span
                              className={
                                tr.estado === 'APROBADA' ? 'text-emerald-400' : 'text-red-400'
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
      </RevealSection>
    </div>
  );
}
