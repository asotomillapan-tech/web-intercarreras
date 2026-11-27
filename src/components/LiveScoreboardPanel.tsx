import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle2,
  Minus,
  Pause,
  Play,
  Plus,
  Repeat2,
  RotateCcw,
  Search,
  ShieldAlert,
  Target,
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
  formatDorsalLabel,
  getEffectiveMatchDorsal,
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
      return { label: 'CAMBIO', className: 'bg-[#707ef9]/20 text-[#c8ceff]' };
    case 'GOL':
      return { label: 'GOL', className: 'bg-emerald-500/20 text-emerald-300' };
    case 'ASISTENCIA':
      return { label: 'ASIST.', className: 'bg-indigo-500/20 text-indigo-300' };
    case 'AMARILLA':
      return { label: 'AMARILLA', className: 'bg-amber-500/20 text-amber-300' };
    case 'ROJA':
      return { label: 'ROJA', className: 'bg-red-500/20 text-red-300' };
    case 'PUNTO_1':
    case 'PUNTO_2':
    case 'PUNTO_3':
      return {
        label: type.replace('PUNTO_', '+') + ' PTS',
        className: 'bg-emerald-500/20 text-emerald-300',
      };
    case 'REBOTE':
      return { label: 'REBOTE', className: 'bg-white/[0.08] text-zinc-200' };
    case 'PUNTO_VOLEY':
      return { label: 'PUNTO', className: 'bg-emerald-500/20 text-emerald-300' };
    case 'ACE':
      return { label: 'ACE', className: 'bg-[#707ef9]/20 text-[#c8ceff]' };
    case 'BLOQUEO':
      return { label: 'BLOQUEO', className: 'bg-white/[0.14] text-white' };
    case 'FALTA':
      return { label: 'FALTA', className: 'bg-orange-500/20 text-orange-300' };
    case 'TIEMPO_MUERTO':
      return { label: 'TIEMPO', className: 'bg-white/[0.08] text-zinc-300' };
    default:
      return { label: type, className: 'bg-white/[0.08] text-zinc-300' };
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
  const [pickerSearch, setPickerSearch] = useState<string>('');
  const [liveNotice, setLiveNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(
    null
  );

  // Lineup & Substitutions state
  const [lineupSide, setLineupSide] = useState<'home' | 'away'>('home');
  const [editingStarters, setEditingStarters] = useState<boolean>(false);
  const [subOutId, setSubOutId] = useState<string>('');
  const [subInId, setSubInId] = useState<string>('');

  const substitutionSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setClockRunning(false);
    setClockSeconds(getNormalizedLiveState(match, sportType).clockSeconds);
    setPendingAction(null);
    setPendingPlayerId('');
    setPickerSearch('');
    setLiveNotice(null);
    setEditingStarters(false);
    setSubOutId('');
    setSubInId('');
  }, [match.id, sportType]);

  useEffect(() => {
    if (!clockRunning) {
      setClockSeconds(liveState.clockSeconds);
    }
  }, [liveState.clockSeconds, clockRunning]);

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

  const withCurrentClock = (
    targetMatch: Match,
    overrideSec?: number,
    overrideStoppage?: number
  ): Match => {
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

  // Penalty Shootout Controls (Fútbol 7)
  const handleTogglePenalties = () => {
    if (match.penaltyScore) {
      const { penaltyScore: _removed, ...rest } = match;
      onUpdateMatch({
        ...rest,
        penaltyScore: undefined,
      });
      setLiveNotice({ tone: 'info', text: 'Definición por penales eliminada.' });
    } else {
      onUpdateMatch({
        ...match,
        status: match.status === 'PROGRAMADO' ? 'EN_VIVO' : match.status,
        periodLabel: 'Penales',
        penaltyScore: { home: 0, away: 0 },
      });
      setLiveNotice({ tone: 'info', text: 'Definición por penales activada.' });
    }
  };

  const handleAdjustPenalty = (side: 'home' | 'away', delta: number) => {
    const current = match.penaltyScore ?? { home: 0, away: 0 };
    const next = {
      ...current,
      [side]: Math.max(0, Math.min(50, current[side] + delta)),
    };
    onUpdateMatch({
      ...match,
      status: match.status === 'PROGRAMADO' ? 'EN_VIVO' : match.status,
      penaltyScore: next,
    });
  };

  // Sort rosters by effective match dorsal (numbered first, S/N last)
  const sortRosterByMatchDorsal = (list: Player[]) =>
    [...list].sort((a, b) => {
      const da = getEffectiveMatchDorsal(match, a);
      const db = getEffectiveMatchDorsal(match, b);
      const ka = da > 0 ? da : 999;
      const kb = db > 0 ? db : 999;
      if (ka !== kb) return ka - kb;
      return `${a.nombre} ${a.apellidoPaterno}`.localeCompare(
        `${b.nombre} ${b.apellidoPaterno}`,
        'es'
      );
    });

  const homeRoster = useMemo(
    () => sortRosterByMatchDorsal(matchPlayers.filter((p) => p.teamId === match.homeTeamId)),
    [matchPlayers, match.homeTeamId, match.attendance?.matchDorsals]
  );
  const awayRoster = useMemo(
    () => sortRosterByMatchDorsal(matchPlayers.filter((p) => p.teamId === match.awayTeamId)),
    [matchPlayers, match.awayTeamId, match.attendance?.matchDorsals]
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
      text: `Titulares asignados (${starters.length}/${rules.onCourtCount}) para ${
        side === 'home' ? homeTeam?.nombre ?? 'Local' : awayTeam?.nombre ?? 'Visita'
      }${presentCount > 0 ? ' desde presentes' : ''}.`,
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
        text: 'Selecciona el jugador que sale de cancha y el jugador que ingresa.',
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

  const handleChooseLiveAction = (
    side: 'home' | 'away',
    actionType: MatchEvent['type'],
    label: string,
    pointsDelta = 0
  ) => {
    setPendingAction({ side, actionType, pointsDelta, label });
    setPendingPlayerId('');
    setPickerSearch('');
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
    setPickerSearch('');
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
      {/* 1. BROADCAST SCOREBOARD + CLOCK CONTROLS */}
      <div className="rounded-3xl overflow-hidden border border-white/[0.08] bg-[#0c0c10]">
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
          embedded
        />

        {/* Integrated Dark Control Strip */}
        <div className="bg-[#111118] text-white border-t border-white/[0.08] px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {sportType !== 'voleibol' && (
              <>
                <button
                  type="button"
                  onClick={handleToggleClock}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                    clockRunning
                      ? 'bg-amber-400 text-[#050507] hover:bg-amber-300'
                      : 'bg-[#707ef9] text-white hover:bg-[#5f6ef5]'
                  }`}
                >
                  {clockRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{clockRunning ? 'Pausar reloj' : 'Correr reloj'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustClock(-60)}
                  title="Restar 1 minuto"
                  className="px-2.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.14] text-[11px] font-mono cursor-pointer transition-colors"
                >
                  -1m
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustClock(60)}
                  title="Sumar 1 minuto"
                  className="px-2.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.14] text-[11px] font-mono cursor-pointer transition-colors"
                >
                  +1m
                </button>
                {sportType !== 'futbol7' ? (
                  <button
                    type="button"
                    onClick={() => handleAdjustClock(10)}
                    title="Sumar 10 segundos"
                    className="px-2.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.14] text-[11px] font-mono cursor-pointer transition-colors"
                  >
                    +10s
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleAddStoppageMinute}
                    title="Agregar 1 minuto adicional"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.14] text-[11px] font-mono cursor-pointer transition-colors"
                  >
                    <Plus className="w-3 h-3 text-[#9aa5ff]" />
                    <span>1&apos; Adic.</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleResetClock}
                  aria-label="Reiniciar reloj del período"
                  title="Reiniciar reloj"
                  className="p-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.14] text-zinc-300 hover:text-white cursor-pointer transition-colors"
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
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.14] text-[11px] font-medium cursor-pointer transition-colors"
              >
                <ArrowLeftRight className="w-3 h-3 text-[#9aa5ff]" />
                <span>Posesión</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAdvancePeriod}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-xs font-medium text-white cursor-pointer transition-colors"
            >
              <Play className="w-3 h-3 text-[#9aa5ff]" />
              <span>{advancePeriodButtonLabel}</span>
            </button>

            <button
              type="button"
              disabled={match.events.length === 0}
              onClick={() => {
                if (match.events[0]) handleRevertEvent(match.events[0].id);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-red-500/80 text-xs font-medium text-zinc-200 hover:text-white transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
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
          className={`rounded-2xl px-4 py-3 text-xs flex items-center justify-between gap-2 border ${
            liveNotice.tone === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-200'
              : 'bg-[#101018] border-[#707ef9]/35 text-zinc-200'
          }`}
        >
          <span className="flex items-center gap-2">
            {liveNotice.tone === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#9aa5ff] shrink-0" />
            )}
            <span>{liveNotice.text}</span>
          </span>
          <button
            type="button"
            onClick={() => setLiveNotice(null)}
            aria-label="Cerrar aviso"
            className="text-zinc-500 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. STEP 1: SPORT-SPECIFIC ACTIONS */}
      <div className="space-y-4">
        <p className="text-xs text-zinc-400">
          <strong className="text-zinc-200">Paso 1:</strong> Selecciona la acción del equipo y luego
          toca el dorsal del jugador.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(['home', 'away'] as const).map((side) => {
            const label = side === 'home' ? homeTeam?.nombre ?? 'Local' : awayTeam?.nombre ?? 'Visita';
            const isActiveBtn = (type: MatchEvent['type']) =>
              pendingAction?.side === side && pendingAction.actionType === type;

            return (
              <div
                key={side}
                className="rounded-2xl border border-white/[0.08] p-4 space-y-3 bg-[#0c0c10]"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white truncate">
                    <span className="text-zinc-500 mr-1.5">
                      {side === 'home' ? 'Local' : 'Visita'}
                    </span>
                    {label}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleOpenSubForSide(side)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#a5b0ff] hover:text-white shrink-0 cursor-pointer transition-colors"
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
                      className={`py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                        isActiveBtn('GOL')
                          ? 'bg-white text-[#050507] ring-2 ring-[#707ef9]'
                          : 'bg-[#707ef9] hover:bg-[#5f6ef5] text-white'
                      }`}
                    >
                      Gol ({side === 'home' ? 'Local' : 'Visita'})
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('ASISTENCIA')}
                      onClick={() => handleChooseLiveAction(side, 'ASISTENCIA', 'Asistencia')}
                      className={`py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-colors border ${
                        isActiveBtn('ASISTENCIA')
                          ? 'bg-white text-[#050507] border-white'
                          : 'bg-white/[0.04] hover:bg-white/[0.1] border-white/[0.08] text-zinc-200'
                      }`}
                    >
                      Asistencia
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('AMARILLA')}
                      onClick={() => handleChooseLiveAction(side, 'AMARILLA', 'Tarjeta Amarilla')}
                      className={`py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors border ${
                        isActiveBtn('AMARILLA')
                          ? 'bg-amber-400 text-[#050507] border-amber-300'
                          : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/30 text-amber-200'
                      }`}
                    >
                      T. Amarilla
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('ROJA')}
                      onClick={() => handleChooseLiveAction(side, 'ROJA', 'Tarjeta Roja')}
                      className={`py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors border ${
                        isActiveBtn('ROJA')
                          ? 'bg-red-500 text-white border-red-400'
                          : 'bg-red-500/15 hover:bg-red-500/25 border-red-500/30 text-red-200'
                      }`}
                    >
                      T. Roja
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('FALTA')}
                      onClick={() => handleChooseLiveAction(side, 'FALTA', 'Falta')}
                      className={`col-span-2 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors border ${
                        isActiveBtn('FALTA')
                          ? 'bg-white text-[#050507] border-white'
                          : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/[0.08] text-zinc-300'
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
                      className={`py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-colors border ${
                        isActiveBtn('PUNTO_1')
                          ? 'bg-white text-[#050507] border-white'
                          : 'bg-white/[0.08] hover:bg-[#707ef9] border-white/[0.1] text-white'
                      }`}
                    >
                      +1 TL
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('PUNTO_2')}
                      onClick={() => handleChooseLiveAction(side, 'PUNTO_2', '+2 Doble', 2)}
                      className={`py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                        isActiveBtn('PUNTO_2')
                          ? 'bg-white text-[#050507]'
                          : 'bg-[#707ef9] hover:bg-[#5f6ef5] text-white'
                      }`}
                    >
                      +2 Doble
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('PUNTO_3')}
                      onClick={() => handleChooseLiveAction(side, 'PUNTO_3', '+3 Triple', 3)}
                      className={`py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                        isActiveBtn('PUNTO_3')
                          ? 'bg-white text-[#050507]'
                          : 'bg-[#707ef9] hover:bg-[#5f6ef5] text-white'
                      }`}
                    >
                      +3 Triple
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('REBOTE')}
                      onClick={() => handleChooseLiveAction(side, 'REBOTE', 'Rebote')}
                      className={`py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors border ${
                        isActiveBtn('REBOTE')
                          ? 'bg-white text-[#050507] border-white'
                          : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.08] text-zinc-200'
                      }`}
                    >
                      Rebote
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('ASISTENCIA')}
                      onClick={() => handleChooseLiveAction(side, 'ASISTENCIA', 'Asistencia')}
                      className={`py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors border ${
                        isActiveBtn('ASISTENCIA')
                          ? 'bg-white text-[#050507] border-white'
                          : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.08] text-zinc-200'
                      }`}
                    >
                      Asistencia
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('TIEMPO_MUERTO')}
                      onClick={() => handleChooseLiveAction(side, 'TIEMPO_MUERTO', 'Tiempo Muerto')}
                      className={`py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors border ${
                        isActiveBtn('TIEMPO_MUERTO')
                          ? 'bg-white text-[#050507] border-white'
                          : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.08] text-zinc-200'
                      }`}
                    >
                      T. Muerto
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('FALTA')}
                      onClick={() => handleChooseLiveAction(side, 'FALTA', 'Falta Personal')}
                      className={`col-span-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors border ${
                        isActiveBtn('FALTA')
                          ? 'bg-orange-500 text-white border-orange-400'
                          : 'bg-orange-500/15 hover:bg-orange-500/25 text-orange-200 border-orange-500/30'
                      }`}
                    >
                      +1 Falta Personal / Equipo
                    </button>
                  </div>
                )}

                {/* Básquetbol 3x3 Actions */}
                {sportType === 'basquetbol3x3' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('PUNTO_1')}
                      onClick={() =>
                        handleChooseLiveAction(side, 'PUNTO_1', '+1 Interior / Tiro Libre', 1)
                      }
                      className={`py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                        isActiveBtn('PUNTO_1')
                          ? 'bg-white text-[#050507]'
                          : 'bg-[#707ef9] hover:bg-[#5f6ef5] text-white'
                      }`}
                    >
                      +1 Interior / TL
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('PUNTO_2')}
                      onClick={() => handleChooseLiveAction(side, 'PUNTO_2', '+2 Exterior 3x3', 2)}
                      className={`py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-colors border ${
                        isActiveBtn('PUNTO_2')
                          ? 'bg-white text-[#050507] border-white'
                          : 'bg-white/[0.08] hover:bg-[#707ef9] border-white/[0.1] text-white'
                      }`}
                    >
                      +2 Exterior
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('REBOTE')}
                      onClick={() => handleChooseLiveAction(side, 'REBOTE', 'Rebote')}
                      className={`py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors border ${
                        isActiveBtn('REBOTE')
                          ? 'bg-white text-[#050507] border-white'
                          : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.08] text-zinc-200'
                      }`}
                    >
                      Rebote
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('ASISTENCIA')}
                      onClick={() => handleChooseLiveAction(side, 'ASISTENCIA', 'Asistencia')}
                      className={`py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors border ${
                        isActiveBtn('ASISTENCIA')
                          ? 'bg-white text-[#050507] border-white'
                          : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.08] text-zinc-200'
                      }`}
                    >
                      Asistencia
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('FALTA')}
                      onClick={() => handleChooseLiveAction(side, 'FALTA', 'Falta 3x3')}
                      className={`py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors border ${
                        isActiveBtn('FALTA')
                          ? 'bg-orange-500 text-white border-orange-400'
                          : 'bg-orange-500/15 hover:bg-orange-500/25 text-orange-200 border-orange-500/30'
                      }`}
                    >
                      +1 Falta
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('TIEMPO_MUERTO')}
                      onClick={() => handleChooseLiveAction(side, 'TIEMPO_MUERTO', 'Tiempo Muerto')}
                      className={`py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors border ${
                        isActiveBtn('TIEMPO_MUERTO')
                          ? 'bg-white text-[#050507] border-white'
                          : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.08] text-zinc-200'
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
                      className={`col-span-2 py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                        isActiveBtn('PUNTO_VOLEY')
                          ? 'bg-white text-[#050507]'
                          : 'bg-[#707ef9] hover:bg-[#5f6ef5] text-white'
                      }`}
                    >
                      +1 Punto Set ({side === 'home' ? 'Local' : 'Visita'})
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('ACE')}
                      onClick={() => handleChooseLiveAction(side, 'ACE', '+1 Ace', 1)}
                      className={`py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors border ${
                        isActiveBtn('ACE')
                          ? 'bg-white text-[#050507] border-white'
                          : 'bg-white/[0.08] hover:bg-[#707ef9] border-white/[0.1] text-white'
                      }`}
                    >
                      +1 Ace
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('BLOQUEO')}
                      onClick={() => handleChooseLiveAction(side, 'BLOQUEO', '+1 Bloqueo', 1)}
                      className={`py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors border ${
                        isActiveBtn('BLOQUEO')
                          ? 'bg-white text-[#050507] border-white'
                          : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.08] text-zinc-200'
                      }`}
                    >
                      +1 Bloqueo
                    </button>
                    <button
                      type="button"
                      aria-pressed={isActiveBtn('TIEMPO_MUERTO')}
                      onClick={() => handleChooseLiveAction(side, 'TIEMPO_MUERTO', 'Tiempo Técnico')}
                      className={`col-span-2 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors border ${
                        isActiveBtn('TIEMPO_MUERTO')
                          ? 'bg-white text-[#050507] border-white'
                          : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/[0.08] text-zinc-300'
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

        {/* FOOTBALL PENALTY SHOOTOUT CONTROL CARD */}
        {sportType === 'futbol7' && (
          <div
            data-testid="football-penalties-panel"
            className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Target className="w-4 h-4 text-[#9aa5ff] shrink-0" />
                <div>
                  <h3 className="text-sm font-medium text-white">Definición por penales</h3>
                  <p className="text-[11px] text-zinc-500">
                    Registra el desenlace desde el punto penal en caso de empate.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleTogglePenalties}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  match.penaltyScore
                    ? 'bg-red-500/15 border border-red-500/30 text-red-200 hover:bg-red-500/25'
                    : 'bg-white/[0.06] border border-white/[0.12] text-zinc-100 hover:bg-white/[0.12]'
                }`}
              >
                {match.penaltyScore ? 'Quitar penales' : 'Activar penales'}
              </button>
            </div>

            {match.penaltyScore && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/[0.07]">
                {(
                  [
                    { side: 'home' as const, label: homeTeam?.nombre ?? 'Local', score: match.penaltyScore.home },
                    { side: 'away' as const, label: awayTeam?.nombre ?? 'Visita', score: match.penaltyScore.away },
                  ] as const
                ).map((item) => (
                  <div
                    key={item.side}
                    className="rounded-xl bg-[#111118] border border-white/[0.08] px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                        Penales {item.side === 'home' ? 'Local' : 'Visita'}
                      </p>
                      <p className="text-sm font-medium text-white truncate">{item.label}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleAdjustPenalty(item.side, -1)}
                        aria-label={`Restar penal a ${item.label}`}
                        className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/[0.1] flex items-center justify-center text-zinc-200 cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span
                        data-testid={`penalty-score-${item.side}`}
                        className="w-8 text-center font-mono text-xl font-semibold text-[#c8ceff] tabular-nums"
                      >
                        {item.score}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAdjustPenalty(item.side, 1)}
                        aria-label={`Sumar penal a ${item.label}`}
                        className="w-8 h-8 rounded-full bg-[#707ef9] hover:bg-[#5f6ef5] flex items-center justify-center text-white cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: NUMBER-FIRST FAST PLAYER PICKER */}
        {pendingAction && (
          <div
            data-testid="live-action-player-menu"
            className="rounded-3xl border border-[#707ef9]/60 bg-[#10111c] p-5 space-y-4 shadow-2xl shadow-black/60"
          >
            {(() => {
              const targetSide = pendingAction.side;
              const targetTeamName =
                targetSide === 'home' ? homeTeam?.nombre ?? 'Local' : awayTeam?.nombre ?? 'Visita';
              const teamRoster = targetSide === 'home' ? homeRoster : awayRoster;
              const sideOnCourtSet = new Set(liveState.onCourt[targetSide]);
              const sideExcludedSet = new Set(liveState.excludedPlayerIds[targetSide]);

              const normFilter = pickerSearch
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .trim();

              const matchesFilter = (p: Player) => {
                if (!normFilter) return true;
                const eff = getEffectiveMatchDorsal(match, p);
                const lbl = formatDorsalLabel(eff);
                const hay = `${eff} ${lbl} ${p.nombre} ${p.apellidoPaterno} ${p.posicion}`
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .toLowerCase();
                return normFilter.split(/\s+/).every((tok) => hay.includes(tok));
              };

              const courtList = teamRoster.filter(
                (p) => sideOnCourtSet.has(p.id) && !sideExcludedSet.has(p.id) && matchesFilter(p)
              );
              const benchList = teamRoster.filter(
                (p) => !sideOnCourtSet.has(p.id) && !sideExcludedSet.has(p.id) && matchesFilter(p)
              );

              const renderPlayerChip = (p: Player, isOnCourt: boolean) => {
                const selected = pendingPlayerId === p.id;
                const effDorsal = getEffectiveMatchDorsal(match, p);
                const dorsalLbl = formatDorsalLabel(effDorsal);
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
                    className={`px-3 py-2 rounded-xl text-xs border transition-all cursor-pointer text-left inline-flex items-center gap-2 ${
                      selected
                        ? 'bg-white text-[#050507] border-white font-semibold'
                        : isOnCourt
                        ? 'bg-[#17192b] text-white border-[#707ef9]/45 hover:border-[#707ef9]'
                        : 'bg-[#0c0c10] text-zinc-300 border-white/[0.1] hover:border-white/[0.28]'
                    }`}
                  >
                    <span
                      className={`inline-flex items-center justify-center min-w-[30px] px-1.5 py-0.5 rounded-md font-mono text-xs font-bold tabular-nums ${
                        selected
                          ? 'bg-[#050507] text-[#a5b0ff]'
                          : effDorsal > 0
                          ? 'bg-[#707ef9]/20 text-[#c8ceff]'
                          : 'bg-white/[0.08] text-zinc-400'
                      }`}
                    >
                      {dorsalLbl}
                    </span>
                    <span className="truncate max-w-[150px]">
                      {p.nombre} {p.apellidoPaterno}
                    </span>
                    {badge && (
                      <span
                        className={`text-[10px] font-mono ${
                          selected
                            ? 'text-zinc-600'
                            : foulWarn || yellowWarn
                            ? 'text-amber-300 font-semibold'
                            : 'text-zinc-500'
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
                  <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] pb-3.5">
                    <div className="flex items-center gap-2.5">
                      <UserCheck className="w-5 h-5 text-[#9aa5ff] shrink-0" />
                      <div>
                        <p className="text-[11px] font-medium text-[#9aa5ff]">
                          Paso 2 · Toca el dorsal o busca por número
                        </p>
                        <p className="text-lg font-medium text-white">
                          {pendingAction.label} — {targetTeamName}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingAction(null);
                        setPendingPlayerId('');
                        setPickerSearch('');
                      }}
                      aria-label="Cancelar acción pendiente"
                      className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.12] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Fast Number / Name Filter + Select */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                        placeholder="Filtrar rápido por # dorsal o nombre..."
                        aria-label="Filtrar jugador por dorsal o nombre"
                        className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-[#0a0a0f] border border-white/[0.12] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
                      />
                      {pickerSearch && (
                        <button
                          type="button"
                          onClick={() => setPickerSearch('')}
                          aria-label="Limpiar filtro"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <select
                      id="pending-action-player"
                      aria-label={`Jugador que realiza la acción (${targetTeamName})`}
                      value={pendingPlayerId}
                      onChange={(e) => setPendingPlayerId(e.target.value)}
                      className="w-full rounded-xl bg-[#0a0a0f] border border-white/[0.12] px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[#707ef9]"
                    >
                      <option value="">Sin jugador específico ({targetTeamName})</option>
                      {courtList.length > 0 && (
                        <optgroup label={`En cancha (${courtList.length})`}>
                          {courtList.map((p) => (
                            <option key={p.id} value={p.id}>
                              {formatDorsalLabel(getEffectiveMatchDorsal(match, p))} · {p.nombre}{' '}
                              {p.apellidoPaterno}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {benchList.length > 0 && (
                        <optgroup label={courtList.length > 0 ? `Banca (${benchList.length})` : 'Plantel'}>
                          {benchList.map((p) => (
                            <option key={p.id} value={p.id}>
                              {formatDorsalLabel(getEffectiveMatchDorsal(match, p))} · {p.nombre}{' '}
                              {p.apellidoPaterno}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  {courtList.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium text-[#9aa5ff]">
                        En cancha ({courtList.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {courtList.map((p) => renderPlayerChip(p, true))}
                      </div>
                    </div>
                  )}

                  {benchList.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium text-zinc-500">
                        {courtList.length > 0 ? `Banca (${benchList.length})` : 'Plantel'}
                      </p>
                      <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto pr-1">
                        {benchList.map((p) => renderPlayerChip(p, false))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingAction(null);
                        setPendingPlayerId('');
                        setPickerSearch('');
                      }}
                      className="px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.1] hover:bg-white/[0.1] text-xs font-medium text-zinc-300 cursor-pointer transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmPendingAction}
                      className="px-5 py-2 rounded-full bg-[#707ef9] hover:bg-[#5f6ef5] text-white font-medium text-xs transition-colors cursor-pointer"
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

      {/* 3. REGISTRO DE ASISTENCIA + DORSALES ROTATIVOS */}
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

      {/* 4. ALINEACIÓN EN CANCHA Y CAMBIOS */}
      <div
        ref={substitutionSectionRef}
        data-testid="live-substitutions-panel"
        className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] overflow-hidden"
      >
        <div className="bg-white/[0.025] border-b border-white/[0.08] px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Repeat2 className="w-4 h-4 text-[#9aa5ff]" />
            <div>
              <h3 className="text-sm font-medium text-white">Alineación en cancha y cambios</h3>
              <p className="text-[11px] text-zinc-500">{rules.onCourtLabel}</p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1 rounded-full bg-[#101016] border border-white/[0.08] p-1 self-start">
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
                  className={`px-3 py-1 rounded-full text-xs font-medium tabular-nums cursor-pointer transition-colors ${
                    selected ? 'bg-white text-[#050507]' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {name} ({count}/{rules.onCourtCount}) · {subs}C
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
            <div className="text-xs text-zinc-400 tabular-nums">
              <strong className="text-white">{activeLineupTeamName}</strong> · En cancha:{' '}
              <strong className="text-zinc-200">
                {onCourtPlayers.length}/{rules.onCourtCount}
              </strong>{' '}
              · Banca: <strong className="text-zinc-200">{benchPlayers.length}</strong> · Cambios:{' '}
              <strong className="text-zinc-200">
                {liveState.substitutionsCount[lineupSide]}
                {rules.maxSubstitutionsPerPeriod ? `/${rules.maxSubstitutionsPerPeriod}` : ''}
              </strong>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleAutoSelectStarters(lineupSide)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-xs text-zinc-200 cursor-pointer transition-colors"
              >
                <Users className="w-3.5 h-3.5 text-[#9aa5ff]" />
                <span>Auto-titulares</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingStarters((prev) => !prev);
                  setSubOutId('');
                  setSubInId('');
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
                  editingStarters
                    ? 'bg-white text-[#050507] border-white'
                    : 'bg-white/[0.03] border-white/[0.1] text-zinc-300 hover:text-white'
                }`}
              >
                {editingStarters ? 'Listo' : 'Editar titulares'}
              </button>
            </div>
          </div>

          {activeLineupRoster.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Este equipo no tiene jugadores inscritos en la nómina oficial.
            </p>
          ) : editingStarters ? (
            <div className="space-y-2.5">
              <p className="text-xs text-zinc-400">
                Marca los titulares <strong className="text-white">en cancha</strong> para{' '}
                {activeLineupTeamName} (recomendado: {rules.onCourtCount}).
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
                      className={`px-3 py-2 rounded-xl text-left text-xs border flex items-center justify-between gap-2 transition-colors ${
                        isExcluded
                          ? 'bg-red-500/10 border-red-500/25 text-red-300 opacity-60 cursor-not-allowed'
                          : isStarter
                          ? 'bg-[#17192b] text-white border-[#707ef9] cursor-pointer'
                          : 'bg-[#101016] text-zinc-300 border-white/[0.08] hover:border-white/[0.2] cursor-pointer'
                      }`}
                    >
                      <span className="truncate">
                        <span className="font-mono text-[#9aa5ff] mr-1.5">
                          {formatDorsalLabel(getEffectiveMatchDorsal(match, p))}
                        </span>
                        <strong className="font-medium">
                          {p.nombre} {p.apellidoPaterno}
                        </strong>
                      </span>
                      <span className="text-[10px] uppercase tracking-wider font-medium shrink-0">
                        {isExcluded ? 'Excluido' : isStarter ? 'En cancha' : 'Banca'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : onCourtPlayers.length === 0 ? (
            <div className="rounded-xl bg-[#101016] border border-white/[0.08] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-zinc-400">
                Carga los titulares de <strong className="text-white">{activeLineupTeamName}</strong>{' '}
                para habilitar los cambios rápidos Sale → Entra.
              </p>
              <button
                type="button"
                onClick={() => handleAutoSelectStarters(lineupSide)}
                className="px-4 py-2 rounded-full bg-[#707ef9] hover:bg-[#5f6ef5] text-white text-xs font-medium shrink-0 cursor-pointer transition-colors"
              >
                Cargar {rules.onCourtCount} titulares
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Column A: Sale */}
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-emerald-300">
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
                          className={`w-full px-3 py-2 rounded-xl text-left text-xs border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                            selected
                              ? 'bg-red-500/20 text-white border-red-400'
                              : 'bg-[#101016] text-zinc-200 border-white/[0.08] hover:border-red-400/50'
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="truncate block">
                              <span className="font-mono text-[#9aa5ff] mr-1.5">
                                {formatDorsalLabel(getEffectiveMatchDorsal(match, p))}
                              </span>
                              {p.nombre} {p.apellidoPaterno}
                            </span>
                            {statsStr && (
                              <span className="text-[10px] text-zinc-500 block truncate">
                                {statsStr}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] uppercase tracking-wider shrink-0 font-semibold">
                            {selected ? 'SALE' : 'Cancha'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Column B: Entra */}
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-[#9aa5ff]">
                    2. Entra desde banca ({benchPlayers.length})
                  </p>
                  {benchPlayers.length === 0 ? (
                    <p className="text-xs text-zinc-500 rounded-xl bg-[#101016] border border-white/[0.07] p-3">
                      Sin suplentes disponibles.
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
                            className={`w-full px-3 py-2 rounded-xl text-left text-xs border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                              selected
                                ? 'bg-emerald-500/20 text-white border-emerald-400'
                                : 'bg-[#101016] text-zinc-300 border-white/[0.08] hover:border-emerald-400/50'
                            }`}
                          >
                            <div className="min-w-0">
                              <span className="truncate block">
                                <span className="font-mono text-zinc-400 mr-1.5">
                                  {formatDorsalLabel(getEffectiveMatchDorsal(match, p))}
                                </span>
                                {p.nombre} {p.apellidoPaterno}
                              </span>
                              {statsStr && (
                                <span className="text-[10px] text-zinc-500 block truncate">
                                  {statsStr}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] uppercase tracking-wider shrink-0 font-semibold">
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
                <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-3.5 py-2.5 space-y-1">
                  <p className="text-[11px] font-medium text-red-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>
                      {sportType === 'basquetbol'
                        ? 'Eliminados por 5 faltas personales'
                        : 'Expulsados del encuentro'}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-red-200">
                    {excludedPlayers.map((p) => (
                      <span key={p.id}>
                        {formatDorsalLabel(getEffectiveMatchDorsal(match, p))} {p.nombre}{' '}
                        {p.apellidoPaterno}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirm Substitution Bar */}
              <div className="rounded-xl bg-[#101016] border border-white/[0.08] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-zinc-400">
                  {subOutId || subInId ? (
                    <span>
                      Sale:{' '}
                      <strong className="text-red-300">
                        {subOutId
                          ? (() => {
                              const p = activeLineupRoster.find((x) => x.id === subOutId);
                              return p
                                ? `${formatDorsalLabel(getEffectiveMatchDorsal(match, p))} ${p.nombre} ${p.apellidoPaterno}`
                                : '—';
                            })()
                          : 'Seleccionar...'}
                      </strong>{' '}
                      → Entra:{' '}
                      <strong className="text-emerald-300">
                        {subInId
                          ? (() => {
                              const p = activeLineupRoster.find((x) => x.id === subInId);
                              return p
                                ? `${formatDorsalLabel(getEffectiveMatchDorsal(match, p))} ${p.nombre} ${p.apellidoPaterno}`
                                : '—';
                            })()
                          : 'Seleccionar...'}
                      </strong>
                    </span>
                  ) : (
                    <span>Selecciona un jugador en cancha y uno en banca para registrar el cambio.</span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!subOutId || !subInId}
                  onClick={handleConfirmSubstitution}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-[#707ef9] hover:bg-[#5f6ef5] text-white font-medium text-xs shrink-0 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                >
                  <Repeat2 className="w-3.5 h-3.5" />
                  <span>Confirmar cambio</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. BITÁCORA DEL ENCUENTRO */}
      <div className="rounded-2xl border border-white/[0.08] p-4 space-y-3 bg-[#0c0c10]">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-zinc-300">
            Bitácora del encuentro ({match.events.length})
          </p>
          {match.events.length > 0 && (
            <span className="text-[11px] text-zinc-500">Cada acción se puede revertir</span>
          )}
        </div>
        {match.events.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Aún no se registran eventos ni cambios en este partido.
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.06] max-h-72 overflow-y-auto text-xs">
            {match.events.slice(0, 40).map((ev) => {
              const badge = getEventBadgeStyle(ev.type);
              return (
                <li key={ev.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-start gap-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 mt-0.5 ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <div className="min-w-0">
                      <span className="text-zinc-100 block break-words">{ev.detail}</span>
                      <span className="text-[11px] text-zinc-500 tabular-nums">
                        {ev.minuteOrPeriod}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevertEvent(ev.id)}
                    aria-label={`Revertir ${ev.detail}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-red-500/25 bg-red-500/10 hover:bg-red-500 text-red-300 hover:text-white text-[11px] font-medium transition-colors shrink-0 cursor-pointer"
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
