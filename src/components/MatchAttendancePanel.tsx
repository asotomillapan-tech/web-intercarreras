import { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Hash,
  Lock,
  RotateCcw,
  Search,
  SkipForward,
  Square,
  Users,
  X,
} from 'lucide-react';
import {
  formatDorsalLabel,
  getEffectiveMatchDorsal,
  getNormalizedMatchAttendance,
  markMatchAttendanceOmitted,
  resumeMatchAttendance,
  setPlayerMatchDorsal,
  setTeamAttendanceAll,
  togglePlayerAttendance,
} from '../domain/attendanceEngine';
import type { Match, Player, Team } from '../types/tournament';

interface MatchAttendancePanelProps {
  match: Match;
  homeTeam?: Team;
  awayTeam?: Team;
  homeRoster: Player[];
  awayRoster: Player[];
  recorderName?: string;
  canEdit: boolean;
  onUpdateMatch: (match: Match) => void;
  onUsePresentForLineup?: (side: 'home' | 'away') => void;
}

export function MatchAttendancePanel({
  match,
  homeTeam,
  awayTeam,
  homeRoster,
  awayRoster,
  recorderName,
  canEdit,
  onUpdateMatch,
  onUsePresentForLineup,
}: MatchAttendancePanelProps) {
  const attendance = useMemo(() => getNormalizedMatchAttendance(match), [match]);
  const [expanded, setExpanded] = useState<boolean>(
    attendance.status !== 'OMITIDA' && match.status !== 'FINALIZADO'
  );
  const [activeSide, setActiveSide] = useState<'home' | 'away'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [omitNoteDraft, setOmitNoteDraft] = useState(attendance.notes ?? '');

  useEffect(() => {
    const norm = getNormalizedMatchAttendance(match);
    setOmitNoteDraft(norm.notes ?? '');
    setSearchQuery('');
    setExpanded(norm.status !== 'OMITIDA' && match.status !== 'FINALIZADO');
  }, [match.id]);

  const homePresentSet = useMemo(
    () => new Set(attendance.homePresentIds),
    [attendance.homePresentIds]
  );
  const awayPresentSet = useMemo(
    () => new Set(attendance.awayPresentIds),
    [attendance.awayPresentIds]
  );

  const activeRoster = activeSide === 'home' ? homeRoster : awayRoster;
  const activePresentSet = activeSide === 'home' ? homePresentSet : awayPresentSet;
  const activeTeamName =
    activeSide === 'home' ? homeTeam?.nombre ?? 'Local' : awayTeam?.nombre ?? 'Visita';

  const normalizedQuery = searchQuery
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const sortedAndFilteredRoster = useMemo(() => {
    const withDorsal = activeRoster.map((p) => ({
      player: p,
      effectiveDorsal: getEffectiveMatchDorsal(match, p),
    }));

    withDorsal.sort((a, b) => {
      const aNum = a.effectiveDorsal > 0 ? a.effectiveDorsal : 999;
      const bNum = b.effectiveDorsal > 0 ? b.effectiveDorsal : 999;
      if (aNum !== bNum) return aNum - bNum;
      return `${a.player.nombre} ${a.player.apellidoPaterno}`.localeCompare(
        `${b.player.nombre} ${b.player.apellidoPaterno}`,
        'es'
      );
    });

    if (!normalizedQuery) return withDorsal;

    return withDorsal.filter(({ player: p, effectiveDorsal }) => {
      const dorsalLabel = formatDorsalLabel(effectiveDorsal);
      const text = `${p.nombre} ${p.apellidoPaterno} ${dorsalLabel} ${effectiveDorsal} #${p.dorsal} ${p.posicion}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      return normalizedQuery.split(/\s+/).every((token) => text.includes(token));
    });
  }, [activeRoster, match, normalizedQuery]);

  const homePresentCount = homeRoster.filter((p) => homePresentSet.has(p.id)).length;
  const awayPresentCount = awayRoster.filter((p) => awayPresentSet.has(p.id)).length;
  const totalPresentCount = homePresentCount + awayPresentCount;
  const overrideCount = Object.keys(attendance.matchDorsals ?? {}).length;

  const handleTogglePlayer = (playerId: string) => {
    if (!canEdit) return;
    onUpdateMatch(
      togglePlayerAttendance({
        match,
        side: activeSide,
        playerId,
        recorderName,
      })
    );
  };

  const handleChangeMatchDorsal = (player: Player, rawValue: string) => {
    if (!canEdit) return;
    const trimmed = rawValue.trim();
    if (trimmed === '') {
      onUpdateMatch(
        setPlayerMatchDorsal({
          match,
          playerId: player.id,
          dorsal: 0,
          recorderName,
        })
      );
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.max(0, Math.min(99, Math.trunc(parsed)));
    onUpdateMatch(
      setPlayerMatchDorsal({
        match,
        playerId: player.id,
        dorsal: clamped === player.dorsal ? null : clamped,
        recorderName,
      })
    );
  };

  const handleResetMatchDorsal = (playerId: string) => {
    if (!canEdit) return;
    onUpdateMatch(
      setPlayerMatchDorsal({
        match,
        playerId,
        dorsal: null,
        recorderName,
      })
    );
  };

  const handleSetAll = (present: boolean) => {
    if (!canEdit) return;
    onUpdateMatch(
      setTeamAttendanceAll({
        match,
        side: activeSide,
        rosterPlayerIds: activeRoster.map((p) => p.id),
        present,
        recorderName,
      })
    );
  };

  const handleOmitAttendance = (customNotes?: string) => {
    if (!canEdit) return;
    onUpdateMatch(
      markMatchAttendanceOmitted({
        match,
        recorderName,
        notes: customNotes ?? omitNoteDraft,
      })
    );
  };

  const handleResumeAttendance = () => {
    if (!canEdit) return;
    onUpdateMatch(
      resumeMatchAttendance({
        match,
        recorderName,
      })
    );
    setExpanded(true);
  };

  return (
    <section
      data-testid="match-attendance-panel"
      aria-label="Registro de asistencia y dorsales del partido"
      className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] overflow-hidden"
    >
      {/* Header Bar */}
      <div className="bg-white/[0.025] border-b border-white/[0.08] px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-2.5 text-left min-w-0 flex-1 cursor-pointer group"
        >
          <ClipboardCheck className="w-4 h-4 text-[#9aa5ff] shrink-0" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium text-white group-hover:text-[#c8ceff] transition-colors">
                Asistencia y dorsales del partido
              </h3>
              <span className="text-[11px] text-zinc-500">Opcional</span>
              {overrideCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#707ef9]/20 text-[#c8ceff] text-[10px] font-medium tabular-nums">
                  {overrideCount} dorsal{overrideCount === 1 ? '' : 'es'} ajustado{overrideCount === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 tabular-nums mt-0.5">
              {attendance.status === 'REGISTRADA' ? (
                <span className="text-emerald-300">
                  Registrada · {homeTeam?.sigla ?? 'LOC'} {homePresentCount}/{homeRoster.length} ·{' '}
                  {awayTeam?.sigla ?? 'VIS'} {awayPresentCount}/{awayRoster.length} ({totalPresentCount}{' '}
                  presentes)
                </span>
              ) : attendance.status === 'OMITIDA' ? (
                <span className="text-amber-300">Asistencia omitida en este encuentro</span>
              ) : (
                <span>Marca presentes y ajusta el dorsal que usarán hoy si es rotativo</span>
              )}
            </p>
          </div>
          <span className="text-zinc-500 ml-1 shrink-0">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            {attendance.status === 'OMITIDA' ? (
              <button
                type="button"
                onClick={handleResumeAttendance}
                className="px-3.5 py-1.5 rounded-full bg-[#707ef9] hover:bg-[#5f6ef5] text-white text-xs font-medium cursor-pointer transition-colors"
              >
                Registrar asistencia
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleOmitAttendance()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.1] text-xs text-zinc-300 cursor-pointer transition-colors"
              >
                <SkipForward className="w-3.5 h-3.5 text-zinc-400" />
                <span>Omitir</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Collapsible Body */}
      {expanded && (
        <div className="p-4 space-y-4">
          {!canEdit && (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] px-3.5 py-2.5 text-xs text-zinc-400 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span>
                Encuentro finalizado: asistencia en modo lectura (solo Administración puede modificar
                partidos cerrados).
              </span>
            </div>
          )}

          {attendance.status === 'OMITIDA' ? (
            <div className="rounded-2xl bg-[#101016] border border-white/[0.08] p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-amber-300">Asistencia omitida</p>
                  <p className="text-xs text-zinc-400">
                    Puedes arbitrar y cerrar el partido normalmente sin afectar porcentajes de asistencia.
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={handleResumeAttendance}
                    className="px-4 py-2 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium shrink-0 cursor-pointer transition-colors"
                  >
                    Tomar asistencia igual
                  </button>
                )}
              </div>

              {canEdit && (
                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-white/[0.07]">
                  <input
                    type="text"
                    value={omitNoteDraft}
                    onChange={(e) => setOmitNoteDraft(e.target.value)}
                    maxLength={240}
                    placeholder="Motivo opcional (ej: inicio contra el tiempo)..."
                    aria-label="Motivo opcional de omisión de asistencia"
                    className="flex-1 rounded-xl bg-[#14141c] border border-white/[0.1] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
                  />
                  <button
                    type="button"
                    onClick={() => handleOmitAttendance(omitNoteDraft)}
                    className="px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.12] hover:bg-white/[0.12] text-xs font-medium text-zinc-100 shrink-0 cursor-pointer transition-colors"
                  >
                    Guardar nota
                  </button>
                </div>
              )}

              {!canEdit && attendance.notes && (
                <p className="text-xs text-zinc-300 pt-2 border-t border-white/[0.07]">
                  <strong className="text-white">Nota:</strong> {attendance.notes}
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Team Tabs + Bulk Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div
                  className="inline-flex items-center gap-1 rounded-full bg-[#101016] border border-white/[0.08] p-1 self-start"
                  role="tablist"
                  aria-label="Equipos del partido"
                >
                  {(['home', 'away'] as const).map((side) => {
                    const isSelected = activeSide === side;
                    const sigla = side === 'home' ? homeTeam?.sigla ?? 'LOC' : awayTeam?.sigla ?? 'VIS';
                    const count = side === 'home' ? homePresentCount : awayPresentCount;
                    const total = side === 'home' ? homeRoster.length : awayRoster.length;
                    return (
                      <button
                        key={side}
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        onClick={() => {
                          setActiveSide(side);
                          setSearchQuery('');
                        }}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium tabular-nums cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-white text-[#050507]'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {side === 'home' ? 'Local' : 'Visita'} · {sigla} ({count}/{total})
                      </button>
                    );
                  })}
                </div>

                {canEdit && activeRoster.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSetAll(true)}
                      className="px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-xs text-zinc-200 cursor-pointer transition-colors"
                    >
                      Marcar todos
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetAll(false)}
                      className="px-3 py-1.5 rounded-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-zinc-400 hover:text-white cursor-pointer transition-colors"
                    >
                      Limpiar
                    </button>
                    {onUsePresentForLineup && activePresentSet.size > 0 && (
                      <button
                        type="button"
                        onClick={() => onUsePresentForLineup(activeSide)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#707ef9]/20 hover:bg-[#707ef9] text-[#c8ceff] hover:text-white border border-[#707ef9]/40 text-xs font-medium transition-colors cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Auto-titulares</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Rotating Jersey Helper Strip */}
              <div className="rounded-xl bg-[#101016] border border-white/[0.07] px-3.5 py-2 flex items-center gap-2 text-[11px] text-zinc-400">
                <Hash className="w-3.5 h-3.5 text-[#9aa5ff] shrink-0" />
                <span>
                  Edita el número a la derecha de cada jugador para asignar su dorsal de hoy (solo
                  aplica a este partido).
                </span>
              </div>

              {/* Search within team roster */}
              {activeRoster.length > 5 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Buscar en ${activeTeamName} por nombre o dorsal...`}
                    aria-label={`Buscar jugador en ${activeTeamName}`}
                    className="w-full pl-9 pr-8 py-2 rounded-full text-xs border border-white/[0.1] bg-[#111117] text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Limpiar búsqueda de asistencia"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Roster Checklist with Inline Match Dorsal Override */}
              {activeRoster.length === 0 ? (
                <p className="text-xs text-zinc-500 rounded-xl bg-[#101016] border border-white/[0.07] p-3.5">
                  {activeTeamName} no tiene jugadores inscritos en la nómina oficial.
                </p>
              ) : sortedAndFilteredRoster.length === 0 ? (
                <p className="text-xs text-zinc-500 py-2">
                  Sin coincidencias para &ldquo;{searchQuery}&rdquo;.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                  {sortedAndFilteredRoster.map(({ player, effectiveDorsal }) => {
                    const isPresent = activePresentSet.has(player.id);
                    const hasOverride =
                      attendance.matchDorsals !== undefined &&
                      Object.prototype.hasOwnProperty.call(attendance.matchDorsals, player.id);

                    return (
                      <div
                        key={player.id}
                        className={`rounded-xl px-3 py-2 text-xs border flex items-center justify-between gap-2 transition-colors ${
                          isPresent
                            ? 'bg-[#151728] text-white border-[#707ef9]/50'
                            : 'bg-[#101016] text-zinc-300 border-white/[0.07] hover:border-white/[0.18]'
                        }`}
                      >
                        <button
                          type="button"
                          disabled={!canEdit}
                          aria-pressed={isPresent}
                          onClick={() => handleTogglePlayer(player.id)}
                          className={`flex items-center gap-2.5 min-w-0 flex-1 text-left ${
                            canEdit ? 'cursor-pointer' : 'cursor-default'
                          }`}
                        >
                          {isPresent ? (
                            <CheckSquare className="w-4 h-4 text-[#9aa5ff] shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-zinc-600 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {player.nombre} {player.apellidoPaterno}
                            </p>
                            <p className="text-[10px] text-zinc-500 truncate">
                              {isPresent ? 'Presente' : 'Ausente'}
                              {hasOverride
                                ? ` · Inscrito: ${formatDorsalLabel(player.dorsal)}`
                                : player.dorsal === 0
                                ? ' · Sin n° inscrito'
                                : ''}
                            </p>
                          </div>
                        </button>

                        {/* Per-match Dorsal Input */}
                        <div className="flex items-center gap-1 shrink-0">
                          <label className="sr-only" htmlFor={`att-dorsal-${player.id}`}>
                            Dorsal en este partido para {player.nombre} {player.apellidoPaterno}
                          </label>
                          <div className="relative flex items-center">
                            <span className="text-[10px] font-mono text-zinc-500 absolute left-2 pointer-events-none">
                              #
                            </span>
                            <input
                              id={`att-dorsal-${player.id}`}
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={99}
                              disabled={!canEdit}
                              value={effectiveDorsal === 0 ? '' : effectiveDorsal}
                              placeholder="S/N"
                              title="Dorsal para este partido (vacío o 0 = S/N)"
                              onChange={(e) => handleChangeMatchDorsal(player, e.target.value)}
                              className={`w-14 pl-4 pr-1.5 py-1 rounded-lg text-xs font-mono font-semibold text-center tabular-nums focus:outline-none transition-colors ${
                                hasOverride
                                  ? 'bg-[#707ef9]/25 border border-[#707ef9] text-white'
                                  : 'bg-[#09090d] border border-white/[0.12] text-zinc-200 focus:border-[#707ef9]'
                              } disabled:opacity-60`}
                            />
                          </div>
                          {canEdit && hasOverride && (
                            <button
                              type="button"
                              onClick={() => handleResetMatchDorsal(player.id)}
                              title={`Restaurar dorsal inscrito (${formatDorsalLabel(player.dorsal)})`}
                              aria-label={`Restaurar dorsal de ${player.nombre}`}
                              className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.08] cursor-pointer transition-colors"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer Record Meta */}
              {attendance.status === 'REGISTRADA' && (attendance.recordedByName || attendance.recordedAt) && (
                <div className="pt-2.5 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
                  <span>
                    Guardado en planilla
                    {attendance.recordedByName ? ` · Mesa: ${attendance.recordedByName}` : ''}
                  </span>
                  <span className="tabular-nums">
                    Presentes: {totalPresentCount} / {homeRoster.length + awayRoster.length}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
