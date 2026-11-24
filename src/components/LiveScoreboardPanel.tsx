import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle2,
  Pause,
  Play,
  Plus,
  Repeat2,
  RotateCcw,
  ShieldAlert,
  Undo2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  SPORT_LIVE_RULES,
  advanceMatchPeriod,
  applyMatchLiveEvent,
  applyPlayerSubstitution,
  computePlayerMatchCounters,
  formatMatchClock,
  getNormalizedLiveState,
  revertMatchLiveEvent,
  setTeamOnCourtPlayers,
  type PlayerMatchCounter,
  type PlayerStatDelta,
} from '../domain/liveMatchEngine';
import {
  getNormalizedMatchAttendance,
  selectStartersWithAttendance,
} from '../domain/attendanceEngine';
import type { Match, MatchEvent, Player, SportType, Team } from '../types/tournament';
import { MatchAttendancePanel } from './MatchAttendancePanel';
import { SportScoreboard } from './SportScoreboard';

interface LiveScoreboardPanelProps {
  match: Match;
  sportType: SportType;
  disciplineName: string;
  homeTeam?: Team;
  awayTeam?: Team;
  matchPlayers: Player[];
  recorderName?: string;
  canEditAttendance?: boolean;
  onUpdateMatch: (match: Match, scorerPlayerId?: string, statDelta?: PlayerStatDelta) => void;
}

interface PendingActionState {
  side: 'home' | 'away';
  actionType: MatchEvent['type'];
  pointsDelta: number;
  label: string;
}

function formatPlayerLiveBadges(
  counter: PlayerMatchCounter | undefined,
  sportType: SportType
): string {
  if (!counter) return '';
  const parts: string[] = [];
  if (sportType === 'futbol7') {
    if (counter.goals > 0) parts.push(`${counter.goals}G`);
    if (counter.assists > 0) parts.push(`${counter.assists}A`);
    if (counter.yellows > 0) parts.push(`${counter.yellows} TA`);
    if (counter.reds > 0) parts.push(`${counter.reds} TR`);
    if (counter.fouls > 0) parts.push(`${counter.fouls}F`);
  } else if (sportType === 'basquetbol' || sportType === 'basquetbol3x3') {
    if (counter.points > 0) parts.push(`${counter.points} pts`);
    if (counter.rebounds > 0) parts.push(`${counter.rebounds} reb`);
    if (counter.assists > 0) parts.push(`${counter.assists} ast`);
    if (counter.fouls > 0) parts.push(`${counter.fouls}F`);
  } else {
    if (counter.points > 0) parts.push(`${counter.points} pts`);
    if (counter.aces > 0) parts.push(`${counter.aces} Ace`);
    if (counter.blocks > 0) parts.push(`${counter.blocks} Blq`);
  }
  return parts.join(' · ');
}

function getEventBadgeStyle(type: MatchEvent['type']): { label: string; className: string } {
  switch (type) {
    case 'CAMBIO':
      return { label: 'CAMBIO', className: 'bg-[#707ef9]/15 text-[#4351d8]' };
    case 'GOL':
      return { label: 'GOL', className: 'bg-emerald-100 text-emerald-900' };
    case 'ASISTENCIA':
      return { label: 'ASIST.', className: 'bg-indigo-100 text-indigo-900' };
    case 'AMARILLA':
      return { label: 'AMARILLA', className: 'bg-amber-100 text-amber-900' };
    case 'ROJA':
      return { label: 'ROJA', className: 'bg-red-100 text-red-900' };
    case 'PUNTO_1':
    case 'PUNTO_2':
    case 'PUNTO_3':
      return { label: type.replace('PUNTO_', '+') + ' PTS', className: 'bg-emerald-100 text-emerald-900' };
    case 'REBOTE':
      return { label: 'REBOTE', className: 'bg-neutral-200 text-neutral-800' };
    case 'PUNTO_VOLEY':
      return { label: 'PUNTO', className: 'bg-emerald-100 text-emerald-900' };
    case 'ACE':
      return { label: 'ACE', className: 'bg-[#707ef9]/15 text-[#4351d8]' };
    case 'BLOQUEO':
      return { label: 'BLOQUEO', className: 'bg-neutral-900 text-white' };
    case 'FALTA':
      return { label: 'FALTA', className: 'bg-orange-100 text-orange-900' };
    case 'TIEMPO_MUERTO':
      return { label: 'TIEMPO', className: 'bg-neutral-200 text-neutral-800' };
    default:
      return { label: type, className: 'bg-neutral-100 text-neutral-700' };
  }
}

export function LiveScoreboardPanel({
  match,
  sportType,
  disciplineName,
  homeTeam,
  awayTeam,
  matchPlayers,
  recorderName,
  canEditAttendance = true,
  onUpdateMatch,
}: LiveScoreboardPanelProps) {
  const rules = SPORT_LIVE_RULES[sportType];
  const liveState = useMemo(() => getNormalizedLiveState(match, sportType), [match, sportType]);
  const playerCounters = useMemo(() => computePlayerMatchCounters(match.events), [match.events]);

  // Clock runtime state (persisted to Firestore on pause, adjust, period change, or action)
  const [clockSeconds, setClockSeconds] = useState<number>(liveState.clockSeconds);
  const [clockRunning, setClockRunning] = useState<boolean>(false);

  // Action-first workflow state
  const [pendingAction, setPendingAction] = useState<PendingActionState | null>(null);
  const [pendingPlayerId, setPendingPlayerId] = useState<string>('');
  const [liveNotice, setLiveNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(
    null
  );

  // Lineup & Substitutions state
  const [lineupSide, setLineupSide] = useState<'home' | 'away'>('home');
  const [editingStarters, setEditingStarters] = useState<boolean>(false);
  const [subOutId, setSubOutId] = useState<string>('');
  const [subInId, setSubInId] = useState<string>('');

  const substitutionSectionRef = useRef<HTMLDivElement | null>(null);

  // Reset UI states cleanly when match changes
  useEffect(() => {
    setClockRunning(false);
    setClockSeconds(getNormalizedLiveState(match, sportType).clockSeconds);
    setPendingAction(null);
    setPendingPlayerId('');
    setLiveNotice(null);
    setEditingStarters(false);
    setSubOutId('');
    setSubInId('');
  }, [match.id, sportType]);

  // Sync external clockSeconds updates when timer is paused
  useEffect(() => {
    if (!clockRunning) {
      setClockSeconds(liveState.clockSeconds);
    }
  }, [liveState.clockSeconds, clockRunning]);

  // 1-second local clock tick (never spams Firestore per second)
  useEffect(() => {
    if (!clockRunning || sportType === 'voleibol') return;
    const id = window.setInterval(() => {
      setClockSeconds((prev) => {
        if (rules.clockDirection === 'down') {
          if (prev <= 1) {
            setClockRunning(false);
            return 0;
          }
          return prev - 1;
        }
        return Math.min(7200, prev + 1);
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [clockRunning, sportType, rules.clockDirection]);

  // Helper to attach current live clock snapshot onto a match before saving
  const withCurrentClock = (targetMatch: Match, overrideSec?: number, overrideStoppage?: number): Match => {
    const sec = Math.max(0, Math.min(7200, Math.trunc(overrideSec ?? clockSeconds)));
    const nextLive = getNormalizedLiveState(targetMatch, sportType);
    const stopp =
      overrideStoppage !== undefined
        ? Math.max(0, Math.min(30, Math.trunc(overrideStoppage)))
        : nextLive.stoppageMinutes;
    nextLive.clockSeconds = sec;
    nextLive.stoppageMinutes = stopp;
    return {
      ...targetMatch,
      clock:
        sportType === 'voleibol'
          ? targetMatch.periodLabel
          : formatMatchClock(sec, sportType, stopp),
      liveState: nextLive,
    };
  };

  const handleToggleClock = () => {
    if (clockRunning) {
      setClockRunning(false);
      onUpdateMatch(withCurrentClock(match));
    } else {
      setClockRunning(true);
      if (match.status === 'PROGRAMADO') {
        const started = advanceMatchPeriod(match, sportType);
        const startSec = getNormalizedLiveState(started, sportType).clockSeconds;
        setClockSeconds(startSec);
        onUpdateMatch(started);
      }
    }
  };

  const handleAdjustClock = (deltaSeconds: number) => {
    const nextSec = Math.max(0, Math.min(7200, clockSeconds + deltaSeconds));
    setClockSeconds(nextSec);
    onUpdateMatch(withCurrentClock(match, nextSec));
  };

  const handleResetClock = () => {
    setClockRunning(false);
    const defaultSec =
      sportType === 'futbol7'
        ? match.periods.length >= 2
          ? 25 * 60
          : 0
        : rules.periodDurationSeconds;
    setClockSeconds(defaultSec);
    onUpdateMatch(withCurrentClock(match, defaultSec, 0));
  };

  const handleAddStoppageMinute = () => {
    const nextStoppage = Math.min(30, liveState.stoppageMinutes + 1);
    onUpdateMatch(withCurrentClock(match, clockSeconds, nextStoppage));
  };

  const handleToggleServeOrPossession = (nextSide: 'home' | 'away') => {
    const nextLive = getNormalizedLiveState(match, sportType);
    nextLive.servingSide = nextSide;
    onUpdateMatch({
      ...match,
      liveState: nextLive,
    });
  };

  const handleAdvancePeriod = () => {
    setClockRunning(false);
    const nextMatch = advanceMatchPeriod(match, sportType);
    const nextSec = getNormalizedLiveState(nextMatch, sportType).clockSeconds;
    setClockSeconds(nextSec);
    onUpdateMatch(nextMatch);
    setLiveNotice({
      tone: 'info',
      text: `Período actualizado: ${nextMatch.periodLabel}`,
    });
  };

  // Rosters for both teams
  const homeRoster = useMemo(
    () =>
      matchPlayers
        .filter((p) => p.teamId === match.homeTeamId)
        .sort((a, b) => a.dorsal - b.dorsal),
    [matchPlayers, match.homeTeamId]
  );
  const awayRoster = useMemo(
    () =>
      matchPlayers
        .filter((p) => p.teamId === match.awayTeamId)
        .sort((a, b) => a.dorsal - b.dorsal),
    [matchPlayers, match.awayTeamId]
  );

  const activeLineupRoster = lineupSide === 'home' ? homeRoster : awayRoster;
  const activeLineupTeamName =
    lineupSide === 'home' ? homeTeam?.nombre ?? 'Local' : awayTeam?.nombre ?? 'Visita';
  const activeOnCourtIds = liveState.onCourt[lineupSide];
  const activeExcludedIds = liveState.excludedPlayerIds[lineupSide];
  const activeOnCourtSet = new Set(activeOnCourtIds);
  const activeExcludedSet = new Set(activeExcludedIds);

  const onCourtPlayers = activeLineupRoster.filter(
    (p) => activeOnCourtSet.has(p.id) && !activeExcludedSet.has(p.id)
  );
  const benchPlayers = activeLineupRoster.filter(
    (p) => !activeOnCourtSet.has(p.id) && !activeExcludedSet.has(p.id)
  );
  const excludedPlayers = activeLineupRoster.filter((p) => activeExcludedSet.has(p.id));

  const handleAutoSelectStarters = (side: 'home' | 'away') => {
    const roster = side === 'home' ? homeRoster : awayRoster;
    const att = getNormalizedMatchAttendance(match);
    const presentCount =
      att.status === 'REGISTRADA'
        ? (side === 'home' ? att.homePresentIds : att.awayPresentIds).length
        : 0;
    const starters = selectStartersWithAttendance({
      roster,
      match,
      side,
      sportType,
      excludedIds: liveState.excludedPlayerIds[side],
    });
    const updated = setTeamOnCourtPlayers(match, sportType, side, starters);
    onUpdateMatch(updated);
    setSubOutId('');
    setSubInId('');
    setLiveNotice({
      tone: 'info',
      text: `Titulares asignados automáticamente (${starters.length}/${rules.onCourtCount}) para ${
        side === 'home' ? homeTeam?.nombre ?? 'Local' : awayTeam?.nombre ?? 'Visita'
      }${presentCount > 0 ? ' desde la lista de presentes' : ''}.`,
    });
  };

  const handleToggleStarterPlayer = (playerId: string) => {
    const current = liveState.onCourt[lineupSide];
    const next = current.includes(playerId)
      ? current.filter((id) => id !== playerId)
      : [...current, playerId];
    onUpdateMatch(setTeamOnCourtPlayers(match, sportType, lineupSide, next));
  };

  const handleConfirmSubstitution = () => {
    const playerOut = activeLineupRoster.find((p) => p.id === subOutId);
    const playerIn = activeLineupRoster.find((p) => p.id === subInId);
    if (!playerOut || !playerIn) {
      setLiveNotice({
        tone: 'error',
        text: 'Selecciona primero el jugador que sale de cancha y el jugador que ingresa desde la banca.',
      });
      return;
    }

    const matchWithClock = withCurrentClock(match);
    const result = applyPlayerSubstitution({
      match: matchWithClock,
      sportType,
      side: lineupSide,
      teamName: activeLineupTeamName,
      playerOut,
      playerIn,
    });

    if (!result.ok) {
      setLiveNotice({ tone: 'error', text: result.error });
      return;
    }

    onUpdateMatch(result.updatedMatch);
    setSubOutId('');
    setSubInId('');
    setLiveNotice({ tone: 'info', text: result.event.detail });
  };

  const handleOpenSubForSide = (side: 'home' | 'away') => {
    setLineupSide(side);
    setEditingStarters(false);
    setSubOutId('');
    setSubInId('');
    setPendingAction(null);
    substitutionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  // Step 1 -> Step 2 Action Handlers
  const handleChooseLiveAction = (
    side: 'home' | 'away',
    actionType: MatchEvent['type'],
    label: string,
    pointsDelta = 0
  ) => {
    setPendingAction({ side, actionType, pointsDelta, label });
    setPendingPlayerId('');
    setLiveNotice(null);
  };

  const handleConfirmPendingAction = () => {
    if (!pendingAction) return;
    const teamId = pendingAction.side === 'home' ? match.homeTeamId : match.awayTeamId;
    const teamName =
      pendingAction.side === 'home' ? homeTeam?.nombre ?? 'Local' : awayTeam?.nombre ?? 'Visita';
    const player = pendingPlayerId
      ? matchPlayers.find((p) => p.id === pendingPlayerId && p.teamId === teamId)
      : undefined;

    const matchWithClock = withCurrentClock(match);
    const result = applyMatchLiveEvent({
      match: matchWithClock,
      sportType,
      side: pendingAction.side,
      actionType: pendingAction.actionType,
      pointsDelta: pendingAction.pointsDelta,
      teamName,
      player,
    });

    onUpdateMatch(result.updatedMatch, player?.id, result.statDelta);
    setLiveNotice({ tone: 'info', text: `Registrado: ${result.event.detail}` });
    setPendingAction(null);
    setPendingPlayerId('');
  };

  const handleRevertEvent = (eventId: string) => {
    const reverted = revertMatchLiveEvent({ match, sportType, eventId });
    if (!reverted) return;
    onUpdateMatch(
      reverted.updatedMatch,
      reverted.revertedEvent.playerId,
      reverted.statDelta
    );
    setLiveNotice({
      tone: 'info',
      text: `Acción revertida: ${reverted.revertedEvent.detail}`,
    });
  };

  const advancePeriodButtonLabel =
    match.status === 'PROGRAMADO'
      ? 'Iniciar encuentro'
      : sportType === 'futbol7'
      ? match.periods.length < 2
        ? 'Pasar a 2° Tiempo'
        : 'Iniciar Prórroga'
      : sportType === 'voleibol'
      ? 'Abrir siguiente Set'
      : sportType === 'basquetbol3x3'
      ? 'Prórroga 3x3'
      : match.periods.length < 4
      ? `Pasar a ${match.periods.length + 1}° Cuarto`
      : 'Agregar Prórroga (OT)';

  return (
    <div className="space-y-6">
      {/* 1. SPORT-SPECIFIC BROADCAST SCOREBOARD + CLOCK CONTROLS */}
      <div>
        <SportScoreboard
          match={match}
          sportType={sportType}
          disciplineName={disciplineName}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          mode="live"
          clockSeconds={clockSeconds}
          clockRunning={clockRunning}
          onToggleServeSide={handleToggleServeOrPossession}
        />

        {/* Integrated Dark Control Strip (Clock + Period + Undo) */}
        <div className="bg-[#14141a] text-white border-x border-b border-white/10 px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2.5">
          {/* Clock Controls for Timed Sports */}
          <div className="flex flex-wrap items-center gap-1.5">
            {sportType !== 'voleibol' && (
              <>
                <button
                  type="button"
                  onClick={handleToggleClock}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-bold uppercase tracking-wider cursor-pointer ${
                    clockRunning
                      ? 'bg-amber-400 text-[#0d0d0d] hover:bg-amber-300'
                      : 'bg-[#707ef9] text-white hover:bg-[#5766eb]'
                  }`}
                >
                  {clockRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{clockRunning ? 'Pausar reloj' : 'Correr reloj'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustClock(-60)}
                  title="Restar 1 minuto"
                  className="px-2 py-1.5 bg-white/10 hover:bg-white/20 text-[11px] font-mono cursor-pointer"
                >
                  -1m
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustClock(60)}
                  title="Sumar 1 minuto"
                  className="px-2 py-1.5 bg-white/10 hover:bg-white/20 text-[11px] font-mono cursor-pointer"
                >
                  +1m
                </button>
                {sportType !== 'futbol7' ? (
                  <button
                    type="button"
                    onClick={() => handleAdjustClock(10)}
                    title="Sumar 10 segundos"
                    className="px-2 py-1.5 bg-white/10 hover:bg-white/20 text-[11px] font-mono cursor-pointer"
                  >
                    +10s
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleAddStoppageMinute}
                    title="Agregar 1 minuto de tiempo adicional"
                    className="inline-flex items-center gap-1 px-2 py-1.5 bg-white/10 hover:bg-white/20 text-[11px] font-mono cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-[#707ef9]" />
                    <span>1&apos; Adic.</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleResetClock}
                  aria-label="Reiniciar reloj del período"
                  title="Reiniciar reloj"
                  className="p-1.5 bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {sportType === 'basquetbol' && (
              <button
                type="button"
                onClick={() =>
                  handleToggleServeOrPossession(liveState.servingSide === 'home' ? 'away' : 'home')
                }
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-[11px] font-medium cursor-pointer"
              >
                <ArrowLeftRight className="w-3 h-3 text-[#707ef9]" />
                <span>Posesión</span>
              </button>
            )}
          </div>

          {/* Period Advance & Undo */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAdvancePeriod}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-medium text-white cursor-pointer"
            >
              <Play className="w-3 h-3 text-[#707ef9]" />
              <span>{advancePeriodButtonLabel}</span>
            </button>

            <button
              type="button"
              disabled={match.events.length === 0}
              onClick={() => {
                if (match.events[0]) handleRevertEvent(match.events[0].id);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-red-600/80 text-xs font-medium text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Revertir última</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Action Notice */}
      {liveNotice && (
        <div
          role={liveNotice.tone === 'error' ? 'alert' : 'status'}
          className={`px-4 py-2.5 text-xs flex items-center justify-between gap-2 border ${
            liveNotice.tone === 'error'
              ? 'bg-red-50 border-red-300 text-red-900'
              : 'bg-[#f5f6f8] border-neutral-300 text-[#0d0d0d]'
          }`}
        >
          <span className="flex items-center gap-2">
            {liveNotice.tone === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#707ef9] shrink-0" />
            )}
            <span>{liveNotice.text}</span>
          </span>
          <button
            type="button"
            onClick={() => setLiveNotice(null)}
            aria-label="Cerrar aviso"
            className="text-neutral-500 hover:text-[#0d0d0d] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. STEP 1: SPORT-SPECIFIC MATCH ACTIONS (LOCAL vs VISITA) */}
      <div className="space-y-4">
        <p className="text-xs text-neutral-600">
          <strong>Paso 1:</strong> Selecciona la acción del equipo correspondiente. Luego elige al
          jugador (los titulares <strong>en cancha</strong> aparecen primero) y confirma.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(['home', 'away'] as const).map((side) => {
            const label = side === 'home' ? homeTeam?.nombre ?? 'Local' : awayTeam?.nombre ?? 'Visita';
            const isActiveBtn = (type: MatchEvent['type']) =>
              pendingAction?.side === side && pendingAction.actionType === type;

            return (
              <div key={side} className="border border-neutral-200 p-4 space-y-3 bg-white">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-sm font-bold uppercase tracking-wide text-[#0d0d0d] truncate">
                    {side === 'home' ? 'Local' : 'Visita'}: {label}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleOpenSubForSide(side)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#707ef9] hover:text-[#0d0d0d] shrink-0 cursor-pointer"
                  >
                    <Repeat2 className="w-3.5 h-3.5" />
                    <span>Cambio</span>
                  </button>
                </div>

                {/* Fútbol 7 Actions */}
                {sportType === 'futbol7' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('GOL')}
                      onClick={() => handleChooseLiveAction(side, 'GOL', 'Gol (+1)', 1)}
                      className={`py-2.5 text-xs font-display font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                        isActiveBtn('GOL')
                          ? 'bg-[#0d0d0d] text-white ring-2 ring-[#707ef9]'
                          : 'bg-[#707ef9] hover:bg-[#5766eb] text-white'
                      }`}
                    >
                      Gol ({side === 'home' ? 'Local' : 'Visita'})
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('ASISTENCIA')}
                      onClick={() => handleChooseLiveAction(side, 'ASISTENCIA', 'Asistencia')}
                      className={`py-2.5 text-xs font-medium cursor-pointer transition-colors ${
                        isActiveBtn('ASISTENCIA')
                          ? 'bg-[#0d0d0d] text-white ring-2 ring-[#707ef9]'
                          : 'bg-[#f5f6f8] hover:bg-neutral-200 text-[#0d0d0d]'
                      }`}
                    >
                      Asistencia
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('AMARILLA')}
                      onClick={() => handleChooseLiveAction(side, 'AMARILLA', 'Tarjeta Amarilla')}
                      className={`py-2 text-xs font-medium cursor-pointer transition-colors ${
                        isActiveBtn('AMARILLA')
                          ? 'bg-amber-400 text-[#0d0d0d] ring-2 ring-[#0d0d0d] font-bold'
                          : 'bg-amber-100 hover:bg-amber-200 text-amber-950'
                      }`}
                    >
                      T. Amarilla
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('ROJA')}
                      onClick={() => handleChooseLiveAction(side, 'ROJA', 'Tarjeta Roja')}
                      className={`py-2 text-xs font-medium cursor-pointer transition-colors ${
                        isActiveBtn('ROJA')
                          ? 'bg-red-600 text-white ring-2 ring-[#0d0d0d] font-bold'
                          : 'bg-red-100 hover:bg-red-200 text-red-950'
                      }`}
                    >
                      T. Roja
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('FALTA')}
                      onClick={() => handleChooseLiveAction(side, 'FALTA', 'Falta')}
                      className={`col-span-2 py-2 text-xs font-medium cursor-pointer transition-colors ${
                        isActiveBtn('FALTA')
                          ? 'bg-[#0d0d0d] text-white ring-2 ring-[#707ef9]'
                          : 'bg-[#f5f6f8] hover:bg-neutral-200 text-[#0d0d0d]'
                      }`}
                    >
                      +1 Falta
                    </button>
                  </div>
                )}

                {/* Básquetbol 5x5 Actions */}
                {sportType === 'basquetbol' && (
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('PUNTO_1')}
                      onClick={() => handleChooseLiveAction(side, 'PUNTO_1', '+1 Tiro Libre', 1)}
                      className={`py-2.5 text-xs font-display font-bold cursor-pointer ${
                        isActiveBtn('PUNTO_1')
                          ? 'bg-[#707ef9] text-white ring-2 ring-[#0d0d0d]'
                          : 'bg-[#0d0d0d] hover:bg-[#707ef9] text-white'
                      }`}
                    >
                      +1 TL
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('PUNTO_2')}
                      onClick={() => handleChooseLiveAction(side, 'PUNTO_2', '+2 Doble', 2)}
                      className={`py-2.5 text-xs font-display font-bold cursor-pointer ${
                        isActiveBtn('PUNTO_2')
                          ? 'bg-[#0d0d0d] text-white ring-2 ring-[#707ef9]'
                          : 'bg-[#707ef9] hover:bg-[#5766eb] text-white'
                      }`}
                    >
                      +2 Doble
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('PUNTO_3')}
                      onClick={() => handleChooseLiveAction(side, 'PUNTO_3', '+3 Triple', 3)}
                      className={`py-2.5 text-xs font-display font-bold cursor-pointer ${
                        isActiveBtn('PUNTO_3')
                          ? 'bg-[#0d0d0d] text-white ring-2 ring-[#707ef9]'
                          : 'bg-[#707ef9] hover:bg-[#5766eb] text-white'
                      }`}
                    >
                      +3 Triple
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('REBOTE')}
                      onClick={() => handleChooseLiveAction(side, 'REBOTE', 'Rebote')}
                      className={`py-2 text-xs font-medium cursor-pointer ${
                        isActiveBtn('REBOTE')
                          ? 'bg-[#0d0d0d] text-white ring-2 ring-[#707ef9]'
                          : 'bg-[#f5f6f8] hover:bg-neutral-200 text-[#0d0d0d]'
                      }`}
                    >
                      Rebote
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('ASISTENCIA')}
                      onClick={() => handleChooseLiveAction(side, 'ASISTENCIA', 'Asistencia')}
                      className={`py-2 text-xs font-medium cursor-pointer ${
                        isActiveBtn('ASISTENCIA')
                          ? 'bg-[#0d0d0d] text-white ring-2 ring-[#707ef9]'
                          : 'bg-[#f5f6f8] hover:bg-neutral-200 text-[#0d0d0d]'
                      }`}
                    >
                      Asistencia
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('TIEMPO_MUERTO')}
                      onClick={() => handleChooseLiveAction(side, 'TIEMPO_MUERTO', 'Tiempo Muerto')}
                      className={`py-2 text-xs font-medium cursor-pointer ${
                        isActiveBtn('TIEMPO_MUERTO')
                          ? 'bg-[#0d0d0d] text-white ring-2 ring-[#707ef9]'
                          : 'bg-[#f5f6f8] hover:bg-neutral-200 text-[#0d0d0d]'
                      }`}
                    >
                      T. Muerto
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('FALTA')}
                      onClick={() => handleChooseLiveAction(side, 'FALTA', 'Falta Personal')}
                      className={`col-span-3 py-2 text-xs font-medium cursor-pointer ${
                        isActiveBtn('FALTA')
                          ? 'bg-orange-600 text-white ring-2 ring-[#0d0d0d]'
                          : 'bg-orange-50 hover:bg-orange-100 text-orange-950 border border-orange-200'
                      }`}
                    >
                      +1 Falta Personal / Equipo
                    </button>
                  </div>
                )}

                {/* Básquetbol 3x3 Authentic Scoring (+1 Interior / TL, +2 Exterior) */}
                {sportType === 'basquetbol3x3' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('PUNTO_1')}
                      onClick={() =>
                        handleChooseLiveAction(side, 'PUNTO_1', '+1 Interior / Tiro Libre', 1)
                      }
                      className={`py-2.5 text-xs font-display font-bold cursor-pointer ${
                        isActiveBtn('PUNTO_1')
                          ? 'bg-[#0d0d0d] text-white ring-2 ring-[#707ef9]'
                          : 'bg-[#707ef9] hover:bg-[#5766eb] text-white'
                      }`}
                    >
                      +1 Interior / TL
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('PUNTO_2')}
                      onClick={() => handleChooseLiveAction(side, 'PUNTO_2', '+2 Exterior 3x3', 2)}
                      className={`py-2.5 text-xs font-display font-bold cursor-pointer ${
                        isActiveBtn('PUNTO_2')
                          ? 'bg-[#707ef9] text-white ring-2 ring-[#0d0d0d]'
                          : 'bg-[#0d0d0d] hover:bg-[#707ef9] text-white'
                      }`}
                    >
                      +2 Exterior
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('REBOTE')}
                      onClick={() => handleChooseLiveAction(side, 'REBOTE', 'Rebote')}
                      className={`py-2 text-xs font-medium cursor-pointer ${
                        isActiveBtn('REBOTE')
                          ? 'bg-[#0d0d0d] text-white ring-2 ring-[#707ef9]'
                          : 'bg-[#f5f6f8] hover:bg-neutral-200 text-[#0d0d0d]'
                      }`}
                    >
                      Rebote
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('ASISTENCIA')}
                      onClick={() => handleChooseLiveAction(side, 'ASISTENCIA', 'Asistencia')}
                      className={`py-2 text-xs font-medium cursor-pointer ${
                        isActiveBtn('ASISTENCIA')
                          ? 'bg-[#0d0d0d] text-white ring-2 ring-[#707ef9]'
                          : 'bg-[#f5f6f8] hover:bg-neutral-200 text-[#0d0d0d]'
                      }`}
                    >
                      Asistencia
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('FALTA')}
                      onClick={() => handleChooseLiveAction(side, 'FALTA', 'Falta 3x3')}
                      className={`py-2 text-xs font-medium cursor-pointer ${
                        isActiveBtn('FALTA')
                          ? 'bg-orange-600 text-white ring-2 ring-[#0d0d0d]'
                          : 'bg-orange-50 hover:bg-orange-100 text-orange-950 border border-orange-200'
                      }`}
                    >
                      +1 Falta
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('TIEMPO_MUERTO')}
                      onClick={() => handleChooseLiveAction(side, 'TIEMPO_MUERTO', 'Tiempo Muerto')}
                      className={`py-2 text-xs font-medium cursor-pointer ${
                        isActiveBtn('TIEMPO_MUERTO')
                          ? 'bg-[#0d0d0d] text-white ring-2 ring-[#707ef9]'
                          : 'bg-[#f5f6f8] hover:bg-neutral-200 text-[#0d0d0d]'
                      }`}
                    >
                      T. Muerto
                    </button>
                  </div>
                )}

                {/* Voleibol Actions */}
                {sportType === 'voleibol' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('PUNTO_VOLEY')}
                      onClick={() => handleChooseLiveAction(side, 'PUNTO_VOLEY', '+1 Punto Set', 1)}
                      className={`col-span-2 py-2.5 text-xs font-display font-bold uppercase tracking-wider cursor-pointer ${
                        isActiveBtn('PUNTO_VOLEY')
                          ? 'bg-[#0d0d0d] text-white ring-2 ring-[#707ef9]'
                          : 'bg-[#707ef9] hover:bg-[#5766eb] text-white'
                      }`}
                    >
                      +1 Punto Set ({side === 'home' ? 'Local' : 'Visita'})
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('ACE')}
                      onClick={() => handleChooseLiveAction(side, 'ACE', '+1 Ace', 1)}
                      className={`py-2 text-xs font-medium cursor-pointer ${
                        isActiveBtn('ACE')
                          ? 'bg-[#707ef9] text-white ring-2 ring-[#0d0d0d]'
                          : 'bg-[#0d0d0d] hover:bg-neutral-800 text-white'
                      }`}
                    >
                      +1 Ace
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('BLOQUEO')}
                      onClick={() => handleChooseLiveAction(side, 'BLOQUEO', '+1 Bloqueo', 1)}
                      className={`py-2 text-xs font-medium cursor-pointer ${
                        isActiveBtn('BLOQUEO')
                          ? 'bg-[#0d0d0d] text-white ring-2 ring-[#707ef9]'
                          : 'bg-[#f5f6f8] hover:bg-neutral-200 text-[#0d0d0d]'
                      }`}
                    >
                      +1 Bloqueo
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('TIEMPO_MUERTO')}
                      onClick={() => handleChooseLiveAction(side, 'TIEMPO_MUERTO', 'Tiempo Técnico')}
                      className={`col-span-2 py-2 text-xs font-medium cursor-pointer ${
                        isActiveBtn('TIEMPO_MUERTO')
                          ? 'bg-[#0d0d0d] text-white ring-2 ring-[#707ef9]'
                          : 'bg-[#f5f6f8] hover:bg-neutral-200 text-[#0d0d0d]'
                      }`}
                    >
                      Tiempo Técnico (2 por set)
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* STEP 2: INLINE PLAYER PICKER (EN CANCHA FIRST) */}
        {pendingAction && (
          <div
            data-testid="live-action-player-menu"
            className="border-2 border-[#707ef9] bg-[#f5f6f8] p-5 space-y-4"
          >
            {(() => {
              const targetSide = pendingAction.side;
              const targetTeamName =
                targetSide === 'home' ? homeTeam?.nombre ?? 'Local' : awayTeam?.nombre ?? 'Visita';
              const teamRoster = targetSide === 'home' ? homeRoster : awayRoster;
              const sideOnCourtSet = new Set(liveState.onCourt[targetSide]);
              const sideExcludedSet = new Set(liveState.excludedPlayerIds[targetSide]);
              const courtList = teamRoster.filter(
                (p) => sideOnCourtSet.has(p.id) && !sideExcludedSet.has(p.id)
              );
              const benchList = teamRoster.filter(
                (p) => !sideOnCourtSet.has(p.id) && !sideExcludedSet.has(p.id)
              );

              const renderPlayerChip = (p: Player, isOnCourt: boolean) => {
                const selected = pendingPlayerId === p.id;
                const badge = formatPlayerLiveBadges(playerCounters[p.id], sportType);
                const foulWarn =
                  sportType === 'basquetbol' && (playerCounters[p.id]?.fouls ?? 0) >= 4;
                const yellowWarn =
                  sportType === 'futbol7' && (playerCounters[p.id]?.yellows ?? 0) >= 1;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPendingPlayerId(selected ? '' : p.id)}
                    className={`px-2.5 py-1.5 text-xs border transition-colors cursor-pointer text-left ${
                      selected
                        ? 'bg-[#0d0d0d] text-white border-[#0d0d0d] font-bold'
                        : isOnCourt
                        ? 'bg-white text-[#0d0d0d] border-[#707ef9]/50 hover:border-[#707ef9]'
                        : 'bg-neutral-100 text-neutral-700 border-neutral-300 hover:border-[#0d0d0d]'
                    }`}
                  >
                    <span className={`font-mono mr-1 ${selected ? 'text-[#707ef9]' : 'text-[#707ef9] font-bold'}`}>
                      #{p.dorsal}
                    </span>
                    <span>
                      {p.nombre} {p.apellidoPaterno}
                    </span>
                    {badge && (
                      <span
                        className={`ml-1.5 text-[10px] font-mono ${
                          selected
                            ? 'text-neutral-300'
                            : foulWarn || yellowWarn
                            ? 'text-amber-700 font-bold'
                            : 'text-neutral-500'
                        }`}
                      >
                        ({badge})
                      </span>
                    )}
                  </button>
                );
              };

              return (
                <>
                  <div className="flex items-start justify-between gap-3 border-b border-neutral-300 pb-3">
                    <div className="flex items-center gap-2.5">
                      <UserCheck className="w-5 h-5 text-[#707ef9] shrink-0" />
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-[#707ef9]">
                          Paso 2 · Seleccionar jugador y confirmar
                        </p>
                        <p className="font-display text-xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                          {pendingAction.label} — {targetTeamName}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingAction(null);
                        setPendingPlayerId('');
                      }}
                      aria-label="Cancelar acción pendiente"
                      className="p-1 text-neutral-500 hover:text-[#0d0d0d] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <label
                      htmlFor="pending-action-player"
                      className="block text-xs font-medium text-neutral-700"
                    >
                      Jugador que realiza la acción ({targetTeamName})
                    </label>
                    <select
                      id="pending-action-player"
                      value={pendingPlayerId}
                      onChange={(e) => setPendingPlayerId(e.target.value)}
                      className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-sm font-medium text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
                    >
                      <option value="">
                        Sin jugador específico (Asignar a {targetTeamName})
                      </option>
                      {courtList.length > 0 && (
                        <optgroup label={`En cancha (${courtList.length})`}>
                          {courtList.map((p) => (
                            <option key={p.id} value={p.id}>
                              #{p.dorsal} · {p.nombre} {p.apellidoPaterno} ({p.posicion})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {benchList.length > 0 && (
                        <optgroup label={courtList.length > 0 ? `Banca (${benchList.length})` : 'Plantel'}>
                          {benchList.map((p) => (
                            <option key={p.id} value={p.id}>
                              #{p.dorsal} · {p.nombre} {p.apellidoPaterno} ({p.posicion})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>

                    {courtList.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[#707ef9]">
                          En cancha ({courtList.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {courtList.map((p) => renderPlayerChip(p, true))}
                        </div>
                      </div>
                    )}

                    {benchList.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                          {courtList.length > 0 ? `Banca (${benchList.length})` : 'Plantel disponible'}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {benchList.slice(0, 12).map((p) => renderPlayerChip(p, false))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-neutral-300">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingAction(null);
                        setPendingPlayerId('');
                      }}
                      className="px-4 py-2.5 bg-white border border-neutral-300 hover:border-[#0d0d0d] text-xs font-medium text-neutral-700 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmPendingAction}
                      className="px-5 py-2.5 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
                    >
                      Registrar acción
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* 3. REGISTRO DE ASISTENCIA DE JUGADORES (OPCIONAL) */}
      <MatchAttendancePanel
        match={match}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        homeRoster={homeRoster}
        awayRoster={awayRoster}
        recorderName={recorderName}
        canEdit={canEditAttendance}
        onUpdateMatch={(updatedMatch) => onUpdateMatch(updatedMatch)}
        onUsePresentForLineup={(side) => {
          setLineupSide(side);
          handleAutoSelectStarters(side);
        }}
      />

      {/* 4. ALINEACIÓN EN CANCHA Y CAMBIOS DE JUGADORES */}
      <div
        ref={substitutionSectionRef}
        data-testid="live-substitutions-panel"
        className="border border-neutral-200 bg-white"
      >
        {/* Header & Team Selector */}
        <div className="bg-[#f5f6f8] border-b border-neutral-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Repeat2 className="w-4 h-4 text-[#707ef9]" />
            <div>
              <h3 className="font-display text-base font-bold uppercase tracking-wide text-[#0d0d0d]">
                Alineación en Cancha y Cambios
              </h3>
              <p className="text-[11px] text-neutral-500">{rules.onCourtLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {(['home', 'away'] as const).map((side) => {
              const selected = lineupSide === side;
              const name = side === 'home' ? homeTeam?.sigla ?? 'LOC' : awayTeam?.sigla ?? 'VIS';
              const count = liveState.onCourt[side].length;
              const subs = liveState.substitutionsCount[side];
              return (
                <button
                  key={side}
                  type="button"
                  onClick={() => {
                    setLineupSide(side);
                    setSubOutId('');
                    setSubInId('');
                  }}
                  className={`px-3 py-1.5 text-xs font-display font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                    selected
                      ? 'bg-[#0d0d0d] text-white'
                      : 'bg-white border border-neutral-300 text-neutral-700 hover:border-[#0d0d0d]'
                  }`}
                >
                  {name} ({count}/{rules.onCourtCount}) · {subs}C
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Quick Lineup Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-neutral-100">
            <div className="text-xs text-neutral-600 tabular-nums">
              <strong className="text-[#0d0d0d]">{activeLineupTeamName}</strong> · En cancha:{' '}
              <strong>
                {onCourtPlayers.length}/{rules.onCourtCount}
              </strong>{' '}
              · Banca: <strong>{benchPlayers.length}</strong> · Cambios:{' '}
              <strong>
                {liveState.substitutionsCount[lineupSide]}
                {rules.maxSubstitutionsPerPeriod ? `/${rules.maxSubstitutionsPerPeriod}` : ''}
              </strong>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleAutoSelectStarters(lineupSide)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#f5f6f8] hover:bg-neutral-200 border border-neutral-300 text-xs font-medium text-[#0d0d0d] cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-[#707ef9]" />
                <span>Auto-titulares</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingStarters((prev) => !prev);
                  setSubOutId('');
                  setSubInId('');
                }}
                className={`px-2.5 py-1.5 text-xs font-medium border cursor-pointer ${
                  editingStarters
                    ? 'bg-[#0d0d0d] text-white border-[#0d0d0d]'
                    : 'bg-white border-neutral-300 text-neutral-700 hover:border-[#0d0d0d]'
                }`}
              >
                {editingStarters ? 'Listo (cerrar edición)' : 'Editar titulares'}
              </button>
            </div>
          </div>

          {activeLineupRoster.length === 0 ? (
            <p className="text-xs text-neutral-500">
              Este equipo no tiene jugadores inscritos en la nómina oficial para realizar cambios.
            </p>
          ) : editingStarters ? (
            /* Manual Starting Lineup Editor */
            <div className="space-y-2.5">
              <p className="text-xs text-neutral-600">
                Marca los jugadores que inician <strong>en cancha</strong> para {activeLineupTeamName}{' '}
                (recomendado: {rules.onCourtCount}).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeLineupRoster.map((p) => {
                  const isExcluded = activeExcludedSet.has(p.id);
                  const isStarter = activeOnCourtSet.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={isExcluded}
                      onClick={() => handleToggleStarterPlayer(p.id)}
                      className={`px-3 py-2 text-left text-xs border flex items-center justify-between gap-2 transition-colors ${
                        isExcluded
                          ? 'bg-red-50 border-red-200 text-red-700 opacity-60 cursor-not-allowed'
                          : isStarter
                          ? 'bg-[#0d0d0d] text-white border-[#0d0d0d] cursor-pointer'
                          : 'bg-white text-[#0d0d0d] border-neutral-300 hover:border-[#707ef9] cursor-pointer'
                      }`}
                    >
                      <span className="truncate">
                        <span className="font-mono text-[#707ef9] mr-1.5">#{p.dorsal}</span>
                        <strong>
                          {p.nombre} {p.apellidoPaterno}
                        </strong>{' '}
                        <span className="opacity-70">({p.posicion})</span>
                      </span>
                      <span className="text-[10px] uppercase tracking-wider font-bold shrink-0">
                        {isExcluded ? 'Excluido' : isStarter ? 'En cancha' : 'Banca'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : onCourtPlayers.length === 0 ? (
            /* First-time prompt to initialize starters before substituting */
            <div className="bg-[#f5f6f8] border border-neutral-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-neutral-700">
                Aún no se han definido los titulares en cancha para{' '}
                <strong>{activeLineupTeamName}</strong>. Carga el quinteto/equipo titular para
                habilitar los cambios rápidos Sale → Entra.
              </p>
              <button
                type="button"
                onClick={() => handleAutoSelectStarters(lineupSide)}
                className="px-4 py-2 bg-[#707ef9] hover:bg-[#5766eb] text-white text-xs font-display font-bold uppercase tracking-wider shrink-0 cursor-pointer"
              >
                Cargar {rules.onCourtCount} titulares
              </button>
            </div>
          ) : (
            /* Live Substitution Flow: Click Sale (En Cancha) + Click Entra (Banca) -> Confirm */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Column A: En Cancha (Sale) */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                    1. Sale de cancha ({onCourtPlayers.length})
                  </p>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {onCourtPlayers.map((p) => {
                      const selected = subOutId === p.id;
                      const statsStr = formatPlayerLiveBadges(playerCounters[p.id], sportType);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSubOutId(selected ? '' : p.id)}
                          className={`w-full px-3 py-2 text-left text-xs border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                            selected
                              ? 'bg-red-600 text-white border-red-700 font-bold'
                              : 'bg-white text-[#0d0d0d] border-neutral-200 hover:border-red-400'
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="truncate block">
                              <span
                                className={`font-mono mr-1.5 ${
                                  selected ? 'text-red-100' : 'text-[#707ef9] font-bold'
                                }`}
                              >
                                #{p.dorsal}
                              </span>
                              {p.nombre} {p.apellidoPaterno}
                            </span>
                            <span
                              className={`text-[10px] block truncate ${
                                selected ? 'text-red-100' : 'text-neutral-500'
                              }`}
                            >
                              {p.posicion}
                              {statsStr ? ` · ${statsStr}` : ''}
                            </span>
                          </div>
                          <span className="text-[10px] uppercase tracking-wider shrink-0 font-bold">
                            {selected ? 'SALE' : 'En cancha'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Column B: Banca (Entra) */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#707ef9]">
                    2. Entra desde banca ({benchPlayers.length})
                  </p>
                  {benchPlayers.length === 0 ? (
                    <p className="text-xs text-neutral-500 bg-[#f5f6f8] border border-neutral-200 p-3">
                      No hay suplentes disponibles en la banca de {activeLineupTeamName}.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {benchPlayers.map((p) => {
                        const selected = subInId === p.id;
                        const statsStr = formatPlayerLiveBadges(playerCounters[p.id], sportType);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSubInId(selected ? '' : p.id)}
                            className={`w-full px-3 py-2 text-left text-xs border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                              selected
                                ? 'bg-emerald-600 text-white border-emerald-700 font-bold'
                                : 'bg-[#f5f6f8] text-[#0d0d0d] border-neutral-200 hover:border-emerald-500'
                            }`}
                          >
                            <div className="min-w-0">
                              <span className="truncate block">
                                <span
                                  className={`font-mono mr-1.5 ${
                                    selected ? 'text-emerald-100' : 'text-neutral-600 font-bold'
                                  }`}
                                >
                                  #{p.dorsal}
                                </span>
                                {p.nombre} {p.apellidoPaterno}
                              </span>
                              <span
                                className={`text-[10px] block truncate ${
                                  selected ? 'text-emerald-100' : 'text-neutral-500'
                                }`}
                              >
                                {p.posicion}
                                {statsStr ? ` · ${statsStr}` : ''}
                              </span>
                            </div>
                            <span className="text-[10px] uppercase tracking-wider shrink-0 font-bold">
                              {selected ? 'ENTRA' : 'Banca'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Excluded / Fouled-out Players */}
              {excludedPlayers.length > 0 && (
                <div className="bg-red-50 border border-red-200 px-3 py-2.5 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-red-800 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>
                      {sportType === 'basquetbol'
                        ? 'Eliminados por 5 faltas personales'
                        : 'Expulsados del encuentro'}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-red-900">
                    {excludedPlayers.map((p) => (
                      <span key={p.id} className="font-medium">
                        #{p.dorsal} {p.nombre} {p.apellidoPaterno}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirm Substitution Bar */}
              <div className="bg-[#f5f6f8] border border-neutral-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-neutral-700">
                  {subOutId || subInId ? (
                    <span>
                      Sale:{' '}
                      <strong className="text-red-700">
                        {subOutId
                          ? (() => {
                              const p = activeLineupRoster.find((x) => x.id === subOutId);
                              return p ? `#${p.dorsal} ${p.nombre} ${p.apellidoPaterno}` : '—';
                            })()
                          : 'Seleccionar...'}
                      </strong>{' '}
                      → Entra:{' '}
                      <strong className="text-emerald-700">
                        {subInId
                          ? (() => {
                              const p = activeLineupRoster.find((x) => x.id === subInId);
                              return p ? `#${p.dorsal} ${p.nombre} ${p.apellidoPaterno}` : '—';
                            })()
                          : 'Seleccionar...'}
                      </strong>
                    </span>
                  ) : (
                    <span>
                      Selecciona un jugador de <strong>En cancha</strong> y uno de{' '}
                      <strong>Banca</strong> para registrar el cambio.
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!subOutId || !subInId}
                  onClick={handleConfirmSubstitution}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-xs shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Repeat2 className="w-3.5 h-3.5" />
                  <span>Confirmar cambio</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. BITÁCORA DEL ENCUENTRO CON REVERTIR */}
      <div className="border border-neutral-200 p-4 space-y-3 bg-white">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Bitácora del encuentro ({match.events.length} incidencias)
          </p>
          {match.events.length > 0 && (
            <span className="text-[11px] text-neutral-500">
              Cualquier acción o cambio se puede revertir
            </span>
          )}
        </div>
        {match.events.length === 0 ? (
          <p className="text-xs text-neutral-500">
            Aún no se registran eventos ni cambios en vivo para este encuentro.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 max-h-72 overflow-y-auto text-xs">
            {match.events.slice(0, 30).map((ev) => {
              const badge = getEventBadgeStyle(ev.type);
              return (
                <li key={ev.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-start gap-2.5">
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 mt-0.5 ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <div className="min-w-0">
                      <span className="text-[#0d0d0d] font-medium block break-words">
                        {ev.detail}
                      </span>
                      <span className="text-[11px] text-neutral-400 tabular-nums">
                        {ev.minuteOrPeriod}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevertEvent(ev.id)}
                    aria-label={`Revertir ${ev.detail}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 border border-red-200 bg-red-50 hover:bg-red-600 text-red-700 hover:text-white text-[11px] font-medium transition-colors shrink-0 cursor-pointer"
                  >
                    <Undo2 className="w-3 h-3" />
                    <span>Revertir</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
