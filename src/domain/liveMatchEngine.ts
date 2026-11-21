import { isVolleyballSetWon } from './tournamentEngine';
import type { Match, MatchEvent, Player, PlayerStats, SportType } from '../types/tournament';

export type PlayerStatDelta = Partial<{
  goles: number;
  tarjetasAmarillas: number;
  tarjetasRojas: number;
  puntos: number;
  triples: number;
  faltas: number;
  aces: number;
  bloqueos: number;
}>;

export interface ApplyLiveEventParams {
  match: Match;
  sportType: SportType;
  side: 'home' | 'away';
  actionType: MatchEvent['type'];
  pointsDelta?: number;
  teamName: string;
  player?: Pick<Player, 'id' | 'nombre' | 'apellidoPaterno' | 'dorsal'>;
  eventId?: string;
}

export interface ApplyLiveEventResult {
  updatedMatch: Match;
  event: MatchEvent;
  statDelta: PlayerStatDelta;
}

export interface RevertLiveEventResult {
  updatedMatch: Match;
  revertedEvent: MatchEvent;
  statDelta: PlayerStatDelta;
}

/**
 * Safely applies a positive or negative stat delta while clamping all counters at >= 0.
 */
export function applyStatDeltaClamped(stats: PlayerStats, delta: PlayerStatDelta): PlayerStats {
  return {
    ...stats,
    goles: Math.max(0, stats.goles + (delta.goles ?? 0)),
    tarjetasAmarillas: Math.max(0, stats.tarjetasAmarillas + (delta.tarjetasAmarillas ?? 0)),
    tarjetasRojas: Math.max(0, stats.tarjetasRojas + (delta.tarjetasRojas ?? 0)),
    puntos: Math.max(0, stats.puntos + (delta.puntos ?? 0)),
    triples: Math.max(0, stats.triples + (delta.triples ?? 0)),
    faltas: Math.max(0, stats.faltas + (delta.faltas ?? 0)),
    aces: Math.max(0, stats.aces + (delta.aces ?? 0)),
    bloqueos: Math.max(0, stats.bloqueos + (delta.bloqueos ?? 0)),
  };
}

function inferPointsDelta(eventType: MatchEvent['type'], explicitDelta?: number): number {
  if (typeof explicitDelta === 'number' && explicitDelta > 0) return explicitDelta;
  switch (eventType) {
    case 'GOL':
    case 'PUNTO_1':
    case 'PUNTO_VOLEY':
    case 'ACE':
    case 'BLOQUEO':
      return 1;
    case 'PUNTO_2':
      return 2;
    case 'PUNTO_3':
      return 3;
    default:
      return 0;
  }
}

function buildPositiveStatDelta(actionType: MatchEvent['type'], pointsDelta: number): PlayerStatDelta {
  const delta: PlayerStatDelta = {};
  if (actionType === 'GOL') delta.goles = 1;
  if (actionType === 'AMARILLA') delta.tarjetasAmarillas = 1;
  if (actionType === 'ROJA') delta.tarjetasRojas = 1;
  if (actionType === 'PUNTO_1' || actionType === 'PUNTO_2' || actionType === 'PUNTO_3') {
    delta.puntos = pointsDelta;
    if (actionType === 'PUNTO_3') delta.triples = 1;
  }
  if (actionType === 'FALTA') delta.faltas = 1;
  if (actionType === 'PUNTO_VOLEY') delta.puntos = 1;
  if (actionType === 'ACE') {
    delta.puntos = 1;
    delta.aces = 1;
  }
  if (actionType === 'BLOQUEO') {
    delta.puntos = 1;
    delta.bloqueos = 1;
  }
  return delta;
}

function negateStatDelta(delta: PlayerStatDelta): PlayerStatDelta {
  const negated: PlayerStatDelta = {};
  if (delta.goles) negated.goles = -delta.goles;
  if (delta.tarjetasAmarillas) negated.tarjetasAmarillas = -delta.tarjetasAmarillas;
  if (delta.tarjetasRojas) negated.tarjetasRojas = -delta.tarjetasRojas;
  if (delta.puntos) negated.puntos = -delta.puntos;
  if (delta.triples) negated.triples = -delta.triples;
  if (delta.faltas) negated.faltas = -delta.faltas;
  if (delta.aces) negated.aces = -delta.aces;
  if (delta.bloqueos) negated.bloqueos = -delta.bloqueos;
  return negated;
}

/**
 * Pure transition that registers a live match action (goal, foul, card, points, timeout)
 * and records exact metadata so any event can later be cleanly reverted.
 */
export function applyMatchLiveEvent(params: ApplyLiveEventParams): ApplyLiveEventResult {
  const { match, sportType, side, actionType, teamName, player } = params;
  const resolvedPoints = inferPointsDelta(actionType, params.pointsDelta);
  const teamId = side === 'home' ? match.homeTeamId : match.awayTeamId;
  const actorLabel = player
    ? `${player.nombre} ${player.apellidoPaterno} (#${player.dorsal})`
    : teamName;

  let nextHome = match.homeScore;
  let nextAway = match.awayScore;
  let nextPeriods = match.periods.map((p) => ({ ...p }));
  let nextPeriodLabel = match.periodLabel;
  const nextFouls = { ...match.fouls };
  const nextTimeouts = { ...match.timeouts };
  let detail = '';
  let periodIndex: number | undefined;
  let triggeredSetWin = false;

  if (sportType === 'futbol7') {
    if (actionType === 'GOL') {
      if (side === 'home') nextHome += 1;
      else nextAway += 1;
      detail = `Gol anotado por ${actorLabel}`;
    } else if (actionType === 'AMARILLA') {
      detail = `Tarjeta amarilla para ${actorLabel}`;
    } else if (actionType === 'ROJA') {
      detail = `Tarjeta roja directa para ${actorLabel}`;
    } else if (actionType === 'FALTA') {
      if (side === 'home') nextFouls.home += 1;
      else nextFouls.away += 1;
      detail = player ? `Falta cometida por ${actorLabel}` : `Falta acumulada (${teamName})`;
    }
  } else if (sportType === 'basquetbol' || sportType === 'basquetbol3x3') {
    if (actionType === 'PUNTO_1' || actionType === 'PUNTO_2' || actionType === 'PUNTO_3') {
      if (side === 'home') nextHome += resolvedPoints;
      else nextAway += resolvedPoints;
      if (nextPeriods.length === 0) nextPeriods = [{ home: 0, away: 0 }];
      periodIndex = nextPeriods.length - 1;
      const last = nextPeriods[periodIndex];
      if (side === 'home') last.home += resolvedPoints;
      else last.away += resolvedPoints;
      detail = `+${resolvedPoints} pts (${
        actionType === 'PUNTO_3' ? 'Triple' : actionType === 'PUNTO_2' ? 'Doble' : 'Tiro libre'
      }) · ${actorLabel}`;
    } else if (actionType === 'FALTA') {
      if (side === 'home') nextFouls.home += 1;
      else nextFouls.away += 1;
      detail = `Falta personal/equipo · ${actorLabel}`;
    } else if (actionType === 'TIEMPO_MUERTO') {
      if (side === 'home') nextTimeouts.home += 1;
      else nextTimeouts.away += 1;
      detail = `Tiempo muerto solicitado por ${teamName}`;
    }
  } else {
    // Voleibol
    if (actionType === 'PUNTO_VOLEY' || actionType === 'ACE' || actionType === 'BLOQUEO') {
      if (nextPeriods.length === 0) nextPeriods = [{ home: 0, away: 0 }];
      const setIdx = nextPeriods.length - 1;
      periodIndex = setIdx;
      if (side === 'home') nextPeriods[setIdx].home += 1;
      else nextPeriods[setIdx].away += 1;

      const winner = isVolleyballSetWon(
        nextPeriods[setIdx].home,
        nextPeriods[setIdx].away,
        setIdx + 1
      );
      detail =
        actionType === 'ACE'
          ? `Ace directo de ${actorLabel} (Set ${setIdx + 1}: ${nextPeriods[setIdx].home}-${nextPeriods[setIdx].away})`
          : actionType === 'BLOQUEO'
          ? `Bloqueo ganador de ${actorLabel} (Set ${setIdx + 1}: ${nextPeriods[setIdx].home}-${nextPeriods[setIdx].away})`
          : `Punto de ${actorLabel} (Set ${setIdx + 1}: ${nextPeriods[setIdx].home}-${nextPeriods[setIdx].away})`;

      if (winner) {
        triggeredSetWin = true;
        if (winner === 'home') nextHome += 1;
        else nextAway += 1;
        if (nextHome < 2 && nextAway < 2) {
          nextPeriods.push({ home: 0, away: 0 });
          nextPeriodLabel = `Set ${nextPeriods.length}`;
        } else {
          nextPeriodLabel = 'Partido definido (pendiente planilla)';
        }
      }
    } else if (actionType === 'TIEMPO_MUERTO') {
      if (side === 'home') nextTimeouts.home += 1;
      else nextTimeouts.away += 1;
      detail = `Tiempo técnico pedido por ${teamName}`;
    }
  }

  const resolvedPeriodLabel =
    nextPeriodLabel === 'Programado' || nextPeriodLabel === 'Por iniciar'
      ? sportType === 'futbol7'
        ? '1° Tiempo'
        : sportType === 'voleibol'
        ? 'Set 1'
        : '1° Cuarto'
      : nextPeriodLabel;

  const resolvedClock =
    match.clock === 'Por iniciar' || match.clock === '00:00'
      ? sportType === 'futbol7'
        ? "01'"
        : sportType === 'voleibol'
        ? 'Set 1'
        : '10:00'
      : match.clock;

  const newEvent: MatchEvent = {
    id: params.eventId ?? `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    minuteOrPeriod: match.clock === 'Por iniciar' ? resolvedPeriodLabel : resolvedClock,
    teamId,
    playerId: player?.id,
    playerName: player ? `${player.nombre} ${player.apellidoPaterno}` : undefined,
    type: actionType,
    detail,
    ...(resolvedPoints > 0 ? { pointsDelta: resolvedPoints } : {}),
    ...(periodIndex !== undefined ? { periodIndex } : {}),
    ...(triggeredSetWin ? { triggeredSetWin: true } : {}),
  };

  const statDelta = buildPositiveStatDelta(actionType, resolvedPoints);

  const updatedMatch: Match = {
    ...match,
    status: match.status === 'PROGRAMADO' ? 'EN_VIVO' : match.status,
    periodLabel: resolvedPeriodLabel,
    clock: resolvedClock,
    homeScore: nextHome,
    awayScore: nextAway,
    periods: nextPeriods,
    fouls: nextFouls,
    timeouts: nextTimeouts,
    events: [newEvent, ...match.events],
  };

  return { updatedMatch, event: newEvent, statDelta };
}

/**
 * Pure transition that cleanly reverts a previously registered live event (goal, foul,
 * yellow/red card, basketball points, volleyball point/set win, timeout) and returns
 * the negative player stat delta so linked player totals stay consistent.
 */
export function revertMatchLiveEvent(params: {
  match: Match;
  sportType: SportType;
  eventId: string;
}): RevertLiveEventResult | null {
  const { match, sportType, eventId } = params;
  const targetEvent = match.events.find((e) => e.id === eventId);
  if (!targetEvent) return null;

  const side: 'home' | 'away' = targetEvent.teamId === match.homeTeamId ? 'home' : 'away';
  const points = inferPointsDelta(targetEvent.type, targetEvent.pointsDelta);

  let nextHome = match.homeScore;
  let nextAway = match.awayScore;
  const nextPeriods = match.periods.map((p) => ({ ...p }));
  let nextPeriodLabel = match.periodLabel;
  const nextFouls = { ...match.fouls };
  const nextTimeouts = { ...match.timeouts };

  if (sportType === 'futbol7') {
    if (targetEvent.type === 'GOL') {
      if (side === 'home') nextHome = Math.max(0, nextHome - 1);
      else nextAway = Math.max(0, nextAway - 1);
    } else if (targetEvent.type === 'FALTA') {
      if (side === 'home') nextFouls.home = Math.max(0, nextFouls.home - 1);
      else nextFouls.away = Math.max(0, nextFouls.away - 1);
    }
  } else if (sportType === 'basquetbol' || sportType === 'basquetbol3x3') {
    if (
      targetEvent.type === 'PUNTO_1' ||
      targetEvent.type === 'PUNTO_2' ||
      targetEvent.type === 'PUNTO_3'
    ) {
      if (side === 'home') nextHome = Math.max(0, nextHome - points);
      else nextAway = Math.max(0, nextAway - points);

      const pIdx =
        targetEvent.periodIndex !== undefined && targetEvent.periodIndex < nextPeriods.length
          ? targetEvent.periodIndex
          : nextPeriods.length - 1;
      if (pIdx >= 0 && nextPeriods[pIdx]) {
        if (side === 'home') nextPeriods[pIdx].home = Math.max(0, nextPeriods[pIdx].home - points);
        else nextPeriods[pIdx].away = Math.max(0, nextPeriods[pIdx].away - points);
      }
    } else if (targetEvent.type === 'FALTA') {
      if (side === 'home') nextFouls.home = Math.max(0, nextFouls.home - 1);
      else nextFouls.away = Math.max(0, nextFouls.away - 1);
    } else if (targetEvent.type === 'TIEMPO_MUERTO') {
      if (side === 'home') nextTimeouts.home = Math.max(0, nextTimeouts.home - 1);
      else nextTimeouts.away = Math.max(0, nextTimeouts.away - 1);
    }
  } else {
    // Voleibol
    if (
      targetEvent.type === 'PUNTO_VOLEY' ||
      targetEvent.type === 'ACE' ||
      targetEvent.type === 'BLOQUEO'
    ) {
      let setIdx =
        targetEvent.periodIndex !== undefined && targetEvent.periodIndex < nextPeriods.length
          ? targetEvent.periodIndex
          : nextPeriods.length - 1;

      if (targetEvent.triggeredSetWin) {
        if (side === 'home') nextHome = Math.max(0, nextHome - 1);
        else nextAway = Math.max(0, nextAway - 1);
        // Remove empty trailing set if it was auto-created upon winning the previous set
        const last = nextPeriods[nextPeriods.length - 1];
        if (
          nextPeriods.length > 1 &&
          last &&
          last.home === 0 &&
          last.away === 0 &&
          setIdx === nextPeriods.length - 2
        ) {
          nextPeriods.pop();
        }
        nextPeriodLabel = `Set ${setIdx + 1}`;
      }

      if (setIdx >= nextPeriods.length) setIdx = nextPeriods.length - 1;
      if (setIdx >= 0 && nextPeriods[setIdx]) {
        if (side === 'home') nextPeriods[setIdx].home = Math.max(0, nextPeriods[setIdx].home - 1);
        else nextPeriods[setIdx].away = Math.max(0, nextPeriods[setIdx].away - 1);
      }
    } else if (targetEvent.type === 'TIEMPO_MUERTO') {
      if (side === 'home') nextTimeouts.home = Math.max(0, nextTimeouts.home - 1);
      else nextTimeouts.away = Math.max(0, nextTimeouts.away - 1);
    }
  }

  const positiveDelta = buildPositiveStatDelta(targetEvent.type, points);
  const statDelta = negateStatDelta(positiveDelta);

  const updatedMatch: Match = {
    ...match,
    homeScore: nextHome,
    awayScore: nextAway,
    periods: nextPeriods,
    periodLabel: nextPeriodLabel,
    fouls: nextFouls,
    timeouts: nextTimeouts,
    events: match.events.filter((e) => e.id !== eventId),
  };

  return {
    updatedMatch,
    revertedEvent: targetEvent,
    statDelta,
  };
}
