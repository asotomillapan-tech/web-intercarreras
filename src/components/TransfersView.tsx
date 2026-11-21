import { useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Lock, RefreshCw } from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
import { canManageRegistrationsAndTransfers } from '../domain/rbacEngine';
import { validateTransferEligibility } from '../domain/tournamentEngine';
import type {
  AppUserProfile,
  DisciplineId,
  TournamentState,
  TransferRecord,
} from '../types/tournament';

interface TransfersViewProps {
  state: TournamentState;
  currentUser: AppUserProfile | null;
  onExecuteTransfer: (transfer: TransferRecord) => void;
  onOpenSheetsSync: () => void;
  onOpenAuth: () => void;
}

export function TransfersView({
  state,
  currentUser,
  onExecuteTransfer,
  onOpenSheetsSync,
  onOpenAuth,
}: TransfersViewProps) {
  const [disciplineId, setDisciplineId] = useState<DisciplineId>('f7-h-1');
  const [fromTeamId, setFromTeamId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [toTeamId, setToTeamId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const canTransfer = canManageRegistrationsAndTransfers(currentUser);
  const delegatedTeam = currentUser?.delegatedTeamId
    ? state.teams.find((t) => t.id === currentUser.delegatedTeamId)
    : undefined;

  const config = state.configs[disciplineId];
  const meta = DISCIPLINE_MAP[disciplineId];

  const disciplineTeams = useMemo(
    () =>
      state.teams
        .filter((t) => t.disciplineId === disciplineId)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [state.teams, disciplineId]
  );

  const effectiveFromTeamId =
    fromTeamId && disciplineTeams.some((t) => t.id === fromTeamId)
      ? fromTeamId
      : disciplineTeams[0]?.id ?? '';

  const effectiveToTeamId =
    toTeamId && disciplineTeams.some((t) => t.id === toTeamId)
      ? toTeamId
      : disciplineTeams[1]?.id ?? '';

  const fromTeamPlayers = useMemo(
    () => state.players.filter((p) => p.teamId === effectiveFromTeamId),
    [state.players, effectiveFromTeamId]
  );

  const effectivePlayerId =
    playerId && fromTeamPlayers.some((p) => p.id === playerId)
      ? playerId
      : fromTeamPlayers[0]?.id ?? '';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);

    if (!canTransfer) {
      setErrors([
        'Solo los perfiles de Delegado de Equipo o Administrador UFRO están autorizados para registrar transferencias.',
      ]);
      return;
    }

    const fromTeam = disciplineTeams.find((t) => t.id === effectiveFromTeamId);
    const toTeam = disciplineTeams.find((t) => t.id === effectiveToTeamId);
    const player = state.players.find((p) => p.id === effectivePlayerId);

    if (!fromTeam || !toTeam || !player) {
      setErrors(['Selecciona un equipo de origen, un estudiante y un equipo de destino válidos.']);
      return;
    }

    if (!motivo.trim() || motivo.trim().length < 6) {
      setErrors(['Indica brevemente el motivo deportivo o reglamentario de la transferencia.']);
      return;
    }

    const toTeamPlayers = state.players.filter((p) => p.teamId === toTeam.id);
    const check = validateTransferEligibility({
      config,
      player,
      fromTeam,
      toTeam,
      existingTransfers: state.transfers,
      toTeamPlayers,
      maxSeleccionadosPorEquipo: meta.maxSeleccionadosPorEquipo,
    });

    if (!check.valid) {
      setErrors(check.errors);
      return;
    }

    const record: TransferRecord = {
      id: `TR-${state.temporada}-${String(state.transfers.length + 1).padStart(3, '0')}`,
      disciplineId,
      playerId: player.id,
      playerName: `${player.nombre} ${player.apellidoPaterno} ${player.apellidoMaterno}`,
      playerRut: player.rut,
      fromTeamId: fromTeam.id,
      fromTeamName: fromTeam.nombre,
      toTeamId: toTeam.id,
      toTeamName: toTeam.nombre,
      fecha: new Date().toISOString().slice(0, 10),
      motivo: motivo.trim(),
      estado: 'APROBADA',
    };

    onExecuteTransfer(record);
    setErrors([]);
    setMotivo('');
    setSuccessMsg(
      `Transferencia aprobada: ${record.playerName} ahora integra ${record.toTeamName}.`
    );
  };

  return (
    <div className="bg-white min-h-[75vh]">
      {/* Dark Header */}
      <div className="bg-[#0d0d0d] text-white border-b border-white/10">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
            Ventana intermedia · Post-Fase de Grupos
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight mt-2">
            Mercado de Transferencias
          </h1>
          <p className="text-sm text-neutral-400 mt-2 max-w-2xl">
            Habilitado exclusivamente al finalizar la Fase de Grupos para que equipos clasificados a
            Playoffs puedan incorporar refuerzos respetando el tope de seleccionados UFRO.
          </p>
        </div>
      </div>

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {/* Transfer Request Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 border border-neutral-200 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-4">
              <div>
                <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                  Registrar traspaso oficial
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Límite en {meta.nombreCorto}: {config.maxTransferenciasPorEquipo} refuerzo(s) por
                  equipo · Máx. {meta.maxSeleccionadosPorEquipo} seleccionados UFRO.
                </p>
              </div>
              <span
                className={`text-xs font-bold uppercase tracking-wider whitespace-nowrap ${
                  config.transferenciasAbiertas ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {config.transferenciasAbiertas ? 'Ventana Abierta' : 'Ventana Cerrada'}
              </span>
            </div>

            {!canTransfer && (
              <div className="bg-[#f5f6f8] border-l-4 border-[#707ef9] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-neutral-700">
                <div className="flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-[#707ef9] shrink-0 mt-0.5" />
                  <span className="text-xs leading-relaxed">
                    El registro de traspasos está reservado para{' '}
                    <strong>Delegados de Equipo</strong> y <strong>Administradores UFRO</strong>. El
                    historial oficial de transferencias permanece público más abajo.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="px-3.5 py-2 bg-[#0d0d0d] hover:bg-[#707ef9] text-white text-xs font-display font-bold uppercase tracking-widest whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Iniciar sesión
                </button>
              </div>
            )}

            {canTransfer && currentUser?.role === 'delegado' && delegatedTeam && (
              <div className="bg-[#f5f6f8] border border-neutral-200 p-3.5 text-xs text-neutral-700">
                Sesión de Delegado activa para{' '}
                <strong className="text-[#0d0d0d]">{delegatedTeam.nombre}</strong> (
                {DISCIPLINE_MAP[delegatedTeam.disciplineId].nombreCorto}). Puedes gestionar
                refuerzos y salidas oficiales de tu plantel.
              </div>
            )}

            {!config.transferenciasAbiertas && (
              <div className="bg-[#f5f6f8] border border-neutral-200 p-4 flex items-center gap-3 text-sm text-neutral-700">
                <Lock className="w-4 h-4 text-neutral-500 shrink-0" />
                <span>
                  La ventana de transferencias para <strong>{meta.nombre}</strong> está actualmente
                  cerrada. Un administrador puede habilitarla tras el cierre de grupos en{' '}
                  <strong>Panel Oficial → Formato y Cupos</strong>.
                </span>
              </div>
            )}

            {successMsg && (
              <div
                role="status"
                className="border border-emerald-300 bg-emerald-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 text-sm text-emerald-950 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{successMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={onOpenSheetsSync}
                  className="text-xs font-display font-bold uppercase tracking-wider text-[#0d0d0d] underline cursor-pointer whitespace-nowrap"
                >
                  Sincronizar Sheets
                </button>
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="tr-disc" className="block text-xs font-medium text-neutral-700 mb-1">
                  Disciplina
                </label>
                <select
                  id="tr-disc"
                  value={disciplineId}
                  onChange={(e) => {
                    setDisciplineId(e.target.value as DisciplineId);
                    setFromTeamId('');
                    setToTeamId('');
                    setPlayerId('');
                  }}
                  className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:border-[#707ef9]"
                >
                  {DISCIPLINES.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre} {state.configs[d.id].transferenciasAbiertas ? '(Abierta)' : '(Cerrada)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="tr-from" className="block text-xs font-medium text-neutral-700 mb-1">
                    Equipo de Origen
                  </label>
                  <select
                    id="tr-from"
                    value={effectiveFromTeamId}
                    onChange={(e) => {
                      setFromTeamId(e.target.value);
                      setPlayerId('');
                    }}
                    className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:border-[#707ef9]"
                  >
                    {disciplineTeams.length === 0 ? (
                      <option value="">Sin equipos inscritos en esta disciplina</option>
                    ) : (
                      disciplineTeams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nombre} ({t.groupName})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="tr-to" className="block text-xs font-medium text-neutral-700 mb-1">
                    Equipo de Destino (Playoffs)
                  </label>
                  <select
                    id="tr-to"
                    value={effectiveToTeamId}
                    onChange={(e) => setToTeamId(e.target.value)}
                    className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:border-[#707ef9]"
                  >
                    {disciplineTeams.length === 0 ? (
                      <option value="">Sin equipos disponibles</option>
                    ) : (
                      disciplineTeams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nombre} ({t.groupName})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="tr-player" className="block text-xs font-medium text-neutral-700 mb-1">
                  Estudiante a transferir
                </label>
                <select
                  id="tr-player"
                  value={effectivePlayerId}
                  onChange={(e) => setPlayerId(e.target.value)}
                  className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:border-[#707ef9]"
                >
                  {fromTeamPlayers.length === 0 ? (
                    <option value="">Sin jugadores registrados en el equipo origen</option>
                  ) : (
                    fromTeamPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} {p.apellidoPaterno} {p.apellidoMaterno}
                        {p.rut ? ` · ${p.rut}` : ''}
                        {p.esSeleccionadoUfro ? ' [Seleccionado UFRO]' : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="tr-motivo" className="block text-xs font-medium text-neutral-700 mb-1">
                  Motivo / Observación de la transferencia
                </label>
                <textarea
                  id="tr-motivo"
                  rows={2}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej: Refuerzo habilitado tras eliminación en Fase de Grupos para llave de Cuartos de Final."
                  className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-[#707ef9]"
                />
              </div>

              <button
                type="submit"
                disabled={!canTransfer || !config.transferenciasAbiertas}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Ejecutar transferencia oficial</span>
              </button>
            </form>
          </div>

          {/* Regulations Summary Column */}
          <div className="lg:col-span-5 bg-[#f5f6f8] border border-neutral-200 p-6 sm:p-8 space-y-6">
            <h3 className="font-display text-xl font-bold uppercase tracking-wide text-[#0d0d0d]">
              Reglamento de Transferencias UFRO
            </h3>
            <ul className="space-y-4 text-sm text-neutral-700">
              <li className="border-b border-neutral-200 pb-3">
                <strong className="text-[#0d0d0d] block">01. Apertura post-grupos</strong>
                Solo se habilitan movimientos una vez cerrada la tabla definitiva de la Fase de
                Grupos en cada disciplina.
              </li>
              <li className="border-b border-neutral-200 pb-3">
                <strong className="text-[#0d0d0d] block">02. Misma disciplina y división</strong>
                Los jugadores solo pueden transferirse entre equipos pertenecientes a la misma
                categoría competitiva.
              </li>
              <li className="border-b border-neutral-200 pb-3">
                <strong className="text-[#0d0d0d] block">03. Cupo de Seleccionados UFRO</strong>
                El equipo receptor no puede superar el máximo reglamentario de deportistas
                seleccionados universitarios en su nómina.
              </li>
              <li>
                <strong className="text-[#0d0d0d] block">04. Trazabilidad en Google Sheets</strong>
                Cada traspaso aprobado actualiza automáticamente la nómina del jugador y se registra
                en la pestaña <code className="text-xs">Transferencias</code>.
              </li>
            </ul>
          </div>
        </div>

        {/* Official Transfer Ledger */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between border-b border-neutral-200 pb-2">
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
              Historial de Transferencias Oficiales
            </h2>
            <span className="text-xs text-neutral-500 tabular-nums">
              {state.transfers.length} movimiento(s) registrado(s)
            </span>
          </div>

          <div className="border border-neutral-200 overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#f5f6f8] border-b border-neutral-200 text-xs text-neutral-500 uppercase">
                  <th className="py-3 px-4 font-medium">Fecha / ID</th>
                  <th className="py-3 px-3 font-medium">Estudiante</th>
                  <th className="py-3 px-3 font-medium">Disciplina</th>
                  <th className="py-3 px-3 font-medium">Movimiento</th>
                  <th className="py-3 px-3 hidden md:table-cell font-medium">Motivo</th>
                  <th className="py-3 px-4 text-right font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {state.transfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 px-4 text-center text-xs text-neutral-500">
                      Aún no se registran transferencias en la temporada {state.temporada}.
                    </td>
                  </tr>
                ) : (
                state.transfers.map((tr) => (
                  <tr key={tr.id} className="hover:bg-[#f9fafb]">
                    <td className="py-3.5 px-4 tabular-nums text-xs text-neutral-600">
                      <span className="font-medium text-[#0d0d0d] block">{tr.fecha}</span>
                      <span>{tr.id}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      <p className="font-medium text-[#0d0d0d]">{tr.playerName}</p>
                      <p className="text-xs text-neutral-500 tabular-nums">
                        {tr.playerRut || 'Ficha oficial'}
                      </p>
                    </td>
                    <td className="py-3.5 px-3 text-xs text-neutral-600">
                      {DISCIPLINE_MAP[tr.disciplineId]?.nombreCorto}
                    </td>
                    <td className="py-3.5 px-3 text-xs font-medium text-[#0d0d0d]">
                      <span className="inline-flex items-center gap-1.5 flex-wrap">
                        <span className="text-neutral-500">{tr.fromTeamName}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#707ef9]" />
                        <span>{tr.toTeamName}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-3 hidden md:table-cell text-xs text-neutral-600 max-w-xs">
                      {tr.motivo}
                    </td>
                    <td className="py-3.5 px-4 text-right text-xs font-bold uppercase text-emerald-700">
                      {tr.estado}
                    </td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
