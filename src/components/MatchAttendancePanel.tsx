import { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Lock,
  Search,
  SkipForward,
  Square,
  Users,
  X,
} from 'lucide-react';
import {
  getNormalizedMatchAttendance,
  markMatchAttendanceOmitted,
  resumeMatchAttendance,
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

  const filteredRoster = useMemo(() => {
    if (!normalizedQuery) return activeRoster;
    return activeRoster.filter((p) => {
      const text = `${p.nombre} ${p.apellidoPaterno} #${p.dorsal} ${p.dorsal} ${p.posicion}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      return normalizedQuery.split(/\s+/).every((token) => text.includes(token));
    });
  }, [activeRoster, normalizedQuery]);

  const homePresentCount = homeRoster.filter((p) => homePresentSet.has(p.id)).length;
  const awayPresentCount = awayRoster.filter((p) => awayPresentSet.has(p.id)).length;
  const totalPresentCount = homePresentCount + awayPresentCount;

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
      aria-label="Registro de asistencia de jugadores del partido"
      className="border border-neutral-200 bg-white"
    >
      {/* Header Bar */}
      <div className="bg-[#f5f6f8] border-b border-neutral-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-2.5 text-left min-w-0 flex-1 cursor-pointer group"
        >
          <ClipboardCheck className="w-4 h-4 text-[#707ef9] shrink-0" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-bold uppercase tracking-wide text-[#0d0d0d] group-hover:text-[#707ef9] transition-colors">
                Asistencia de Jugadores
              </h3>
              <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                Opcional
              </span>
            </div>
            <p className="text-[11px] text-neutral-600 tabular-nums mt-0.5">
              {attendance.status === 'REGISTRADA' ? (
                <span className="text-emerald-800 font-medium">
                  Registrada · {homeTeam?.sigla ?? 'LOC'} {homePresentCount}/{homeRoster.length} ·{' '}
                  {awayTeam?.sigla ?? 'VIS'} {awayPresentCount}/{awayRoster.length} ({totalPresentCount}{' '}
                  presentes)
                </span>
              ) : attendance.status === 'OMITIDA' ? (
                <span className="text-amber-800 font-medium">
                  Asistencia omitida en este partido
                </span>
              ) : (
                <span>Sin registrar — marca los jugadores presentes o puedes omitirla</span>
              )}
            </p>
          </div>
          <span className="text-neutral-500 ml-1 shrink-0">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            {attendance.status === 'OMITIDA' ? (
              <button
                type="button"
                onClick={handleResumeAttendance}
                className="px-3 py-1.5 bg-[#707ef9] hover:bg-[#5766eb] text-white text-xs font-display font-bold uppercase tracking-wider cursor-pointer"
              >
                Registrar asistencia
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleOmitAttendance()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-100 border border-neutral-300 text-xs font-medium text-neutral-700 cursor-pointer"
              >
                <SkipForward className="w-3.5 h-3.5 text-neutral-500" />
                <span>Omitir asistencia</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Collapsible Body */}
      {expanded && (
        <div className="p-4 space-y-4">
          {!canEdit && (
            <div className="bg-neutral-50 border border-neutral-200 px-3 py-2 text-xs text-neutral-600 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              <span>
                Encuentro finalizado: el registro de asistencia queda en modo lectura para árbitros
                (solo Administración puede modificar partidos cerrados).
              </span>
            </div>
          )}

          {attendance.status === 'OMITIDA' ? (
            <div className="bg-[#f5f6f8] border border-neutral-200 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
                    Asistencia marcada como omitida
                  </p>
                  <p className="text-xs text-neutral-600">
                    Puedes continuar arbitrando y cerrar el encuentro normalmente. Este partido no
                    penalizará el porcentaje de asistencia de los jugadores.
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={handleResumeAttendance}
                    className="px-3.5 py-2 bg-[#0d0d0d] hover:bg-[#707ef9] text-white text-xs font-display font-bold uppercase tracking-wider shrink-0 cursor-pointer transition-colors"
                  >
                    Tomar asistencia igual
                  </button>
                )}
              </div>

              {canEdit && (
                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-neutral-200">
                  <input
                    type="text"
                    value={omitNoteDraft}
                    onChange={(e) => setOmitNoteDraft(e.target.value)}
                    maxLength={240}
                    placeholder="Motivo opcional de omisión (ej: Inicio contra el tiempo, sin planilla física)..."
                    aria-label="Motivo opcional de omisión de asistencia"
                    className="flex-1 bg-white border border-neutral-300 px-3 py-1.5 text-xs text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
                  />
                  <button
                    type="button"
                    onClick={() => handleOmitAttendance(omitNoteDraft)}
                    className="px-3 py-1.5 bg-white border border-neutral-300 hover:border-[#0d0d0d] text-xs font-medium text-[#0d0d0d] shrink-0 cursor-pointer"
                  >
                    Guardar nota
                  </button>
                </div>
              )}

              {!canEdit && attendance.notes && (
                <p className="text-xs text-neutral-700 pt-2 border-t border-neutral-200">
                  <strong>Nota:</strong> {attendance.notes}
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Team Tabs + Bulk Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5" role="tablist" aria-label="Equipos del partido">
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
                        className={`px-3 py-1.5 text-xs font-display font-bold uppercase tracking-wider tabular-nums cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#0d0d0d] text-white'
                            : 'bg-white border border-neutral-300 text-neutral-700 hover:border-[#0d0d0d]'
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
                      className="px-2.5 py-1.5 bg-[#f5f6f8] hover:bg-neutral-200 border border-neutral-300 text-xs font-medium text-[#0d0d0d] cursor-pointer"
                    >
                      Marcar todos
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetAll(false)}
                      className="px-2.5 py-1.5 bg-white hover:bg-neutral-100 border border-neutral-300 text-xs font-medium text-neutral-700 cursor-pointer"
                    >
                      Limpiar
                    </button>
                    {onUsePresentForLineup && activePresentSet.size > 0 && (
                      <button
                        type="button"
                        onClick={() => onUsePresentForLineup(activeSide)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#707ef9]/10 hover:bg-[#707ef9] text-[#4351d8] hover:text-white border border-[#707ef9]/35 text-xs font-medium transition-colors cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Auto-titulares con presentes</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Search within team roster */}
              {activeRoster.length > 6 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Buscar en plantel de ${activeTeamName} por nombre o dorsal...`}
                    aria-label={`Buscar jugador en ${activeTeamName}`}
                    className="w-full pl-8 pr-8 py-1.5 text-xs border border-neutral-300 bg-white text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Limpiar búsqueda de asistencia"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-[#0d0d0d] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Roster Checklist */}
              {activeRoster.length === 0 ? (
                <p className="text-xs text-neutral-500 bg-[#f5f6f8] border border-neutral-200 p-3">
                  {activeTeamName} no tiene jugadores inscritos en la nómina oficial.
                </p>
              ) : filteredRoster.length === 0 ? (
                <p className="text-xs text-neutral-500 py-2">
                  No se encontraron jugadores con &ldquo;{searchQuery}&rdquo;.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-1">
                  {filteredRoster.map((player) => {
                    const isPresent = activePresentSet.has(player.id);
                    return (
                      <button
                        key={player.id}
                        type="button"
                        disabled={!canEdit}
                        aria-pressed={isPresent}
                        onClick={() => handleTogglePlayer(player.id)}
                        className={`px-3 py-2 text-left text-xs border flex items-center justify-between gap-2 transition-colors ${
                          !canEdit ? 'cursor-default' : 'cursor-pointer'
                        } ${
                          isPresent
                            ? 'bg-[#0d0d0d] text-white border-[#0d0d0d]'
                            : 'bg-white text-[#0d0d0d] border-neutral-200 hover:border-[#707ef9]'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          {isPresent ? (
                            <CheckSquare className="w-4 h-4 text-[#707ef9] shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-neutral-400 shrink-0" />
                          )}
                          <span className="truncate">
                            <span
                              className={`font-mono mr-1.5 ${
                                isPresent ? 'text-[#707ef9] font-bold' : 'text-neutral-500 font-bold'
                              }`}
                            >
                              #{player.dorsal}
                            </span>
                            <strong className="font-medium">
                              {player.nombre} {player.apellidoPaterno}
                            </strong>
                          </span>
                        </span>
                        <span
                          className={`text-[10px] uppercase tracking-wider font-bold shrink-0 ${
                            isPresent ? 'text-emerald-300' : 'text-neutral-400'
                          }`}
                        >
                          {isPresent ? 'Presente' : 'Ausente'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Footer Record Meta */}
              {attendance.status === 'REGISTRADA' && (attendance.recordedByName || attendance.recordedAt) && (
                <div className="pt-2 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500">
                  <span>
                    Registro guardado automáticamente en el partido
                    {attendance.recordedByName ? ` · Mesa: ${attendance.recordedByName}` : ''}
                  </span>
                  <span className="tabular-nums">
                    Total presentes: {totalPresentCount} / {homeRoster.length + awayRoster.length}
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
