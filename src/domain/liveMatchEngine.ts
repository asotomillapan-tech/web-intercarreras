import { isVolleyballSetWon } from './tournamentEngine';
import type {
  Match,
  MatchEvent,
  MatchLiveState,
  Player,
  PlayerStats,
  SportType,
} from '../types/tournament';

export type PlayerStatDelta = Partial<{
  goles: number;
  asistencias: number;
  tarjetasAmarillas: number;
  tarjetasRojas: number;
  puntos: number;
  rebotes: number;
  triples: number;
  faltas: number;
  aces: number;
  bloqueos: number;
}>;

export interface SportLiveRules {
  onCourtCount: number;
  onCourtLabel: string;
  periodDurationSeconds: number;
  clockDirection: 'up' | 'down';
  maxRegularPeriods: number;
  periodShortPrefix: string;
  maxTimeoutsPerPeriod: number;
  bonusFoulThreshold: number | null;
  doubleBonusFoulThreshold: number | null;
  personalFoulLimit: number | null;
  maxSubstitutionsPerPeriod: number | null;
  targetScore: number | null;
  tiebreakTargetScore: number | null;
}

export const SPORT_LIVE_RULES: Record<SportType, SportLiveRules> = {
  futbol7: {
    onCourtCount: 7,
    onCourtLabel: '7 titulares en cancha',
    periodDurationSeconds: 25 * 60,
    clockDirection: 'up',
    maxRegularPeriods: 2,
    periodShortPrefix: 'T',
    maxTimeoutsPerPeriod: 0,
    bonusFoulThreshold: null,
    doubleBonusFoulThreshold: null,
    personalFoulLimit: null,
    maxSubstitutionsPerPeriod: null,
    targetScore: null,
    tiebreakTargetScore: null,
  },
  basquetbol: {
    onCourtCount: 5,
    onCourtLabel: '5 en cancha (Quinteto)',
    periodDurationSeconds: 10 * 60,
    clockDirection: 'down',
    maxRegularPeriods: 4,
    periodShortPrefix: 'Q',
    maxTimeoutsPerPeriod: 2,
    bonusFoulThreshold: 5,
    doubleBonusFoulThreshold: null,
    personalFoulLimit: 5,
    maxSubstitutionsPerPeriod: null,
    targetScore: null,
    tiebreakTargetScore: null,
  },
  basquetbol3x3: {
    onCourtCount: 3,
    onCourtLabel: '3 en cancha (Trío 3x3)',
    periodDurationSeconds: 10 * 60,
    clockDirection: 'down',
    maxRegularPeriods: 1,
    periodShortPrefix: 'P',
    maxTimeoutsPerPeriod: 1,
    bonusFoulThreshold: 7,
    doubleBonusFoulThreshold: 10,
    personalFoulLimit: null,
    maxSubstitutionsPerPeriod: null,
    targetScore: 21,
    tiebreakTargetScore: null,
  },
  voleibol: {
    onCourtCount: 6,
    onCourtLabel: '6 en cancha (+ Líbero)',
    periodDurationSeconds: 0,
    clockDirection: 'up',
    maxRegularPeriods: 3,
    periodShortPrefix: 'Set ',
    maxTimeoutsPerPeriod: 2,
    bonusFoulThreshold: null,
    doubleBonusFoulThreshold: null,
    personalFoulLimit: null,
    maxSubstitutionsPerPeriod: 6,
    targetScore: 25,
    tiebreakTargetScore: 15,
  },
};

export interface PlayerMatchCounter {
  goals: number;
  assists: number;
  yellows: number;
  reds: number;
  points: number;
  rebounds: number;
  triples: number;
  fouls: number;
  aces: number;
  blocks: number;
}

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

export interface ApplySubstitutionParams {
  match: Match;
  sportType: SportType;
  side: 'home' | 'away';
  teamName: string;
  playerOut: Pick<Player, 'id' | 'nombre' | 'apellidoPaterno' | 'dorsal'>;
  playerIn: Pick<Player, 'id' | 'nombre' | 'apellidoPaterno' | 'dorsal'>;
  eventId?: string;
}

export type ApplySubstitutionResult =
  | { ok: true; updatedMatch: Match; event: MatchEvent }
  | { ok: false; error: string };

export function getNormalizedLiveState(match: Match, sportType: SportType): Required<MatchLiveState> {
  const rules = SPORT_LIVE_RULES[sportType];
  const ls = match.liveState;
  const defaultClockSec = rules.clockDirection === 'down' ? rules.periodDurationSeconds : 0;

  return {
    onCourt: {
      home: Array.isArray(ls?.onCourt?.home) ? [...ls.onCourt.home] : [],
      away: Array.isArray(ls?.onCourt?.away) ? [...ls.onCourt.away] : [],
    },
    excludedPlayerIds: {
      home: Array.isArray(ls?.excludedPlayerIds?.home) ? [...ls.excludedPlayerIds.home] : [],
      away: Array.isArray(ls?.excludedPlayerIds?.away) ? [...ls.excludedPlayerIds.away] : [],
    },
    periodFouls: {
      home: ls?.periodFouls?.home ?? (sportType === 'basquetbol3x3' ? match.fouls.home : 0),
      away: ls?.periodFouls?.away ?? (sportType === 'basquetbol3x3' ? match.fouls.away : 0),
    },
    servingSide: ls?.servingSide ?? 'home',
    substitutionsCount: {
      home: ls?.substitutionsCount?.home ?? 0,
      away: ls?.substitutionsCount?.away ?? 0,
    },
    clockSeconds:
      typeof ls?.clockSeconds === 'number' && Number.isFinite(ls.clockSeconds)
        ? Math.max(0, Math.trunc(ls.clockSeconds))
        : defaultClockSec,
    stoppageMinutes:
      typeof ls?.stoppageMinutes === 'number' && Number.isFinite(ls.stoppageMinutes)
        ? Math.max(0, Math.trunc(ls.stoppageMinutes))
        : 0,
  };
}

export function formatMatchClock(
  clockSeconds: number,
  sportType: SportType,
  stoppageMinutes = 0
): string {
  const safeSec = Math.max(0, Math.trunc(clockSeconds));
  const mins = Math.floor(safeSec / 60);
  const secs = safeSec % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  if (sportType === 'futbol7' && stoppageMinutes > 0) {
    return `${mm}:${ss} +${stoppageMinutes}'`;
  }
  return `${mm}:${ss}`;
}

export function computePlayerMatchCounters(
  events: MatchEvent[]
): Record<string, PlayerMatchCounter> {
  const map: Record<string, PlayerMatchCounter> = {};
  const ensure = (pid: string): PlayerMatchCounter => {
    if (!map[pid]) {
      map[pid] = {
        goals: 0,
        assists: 0,
        yellows: 0,
        reds: 0,
        points: 0,
        rebounds: 0,
        triples: 0,
        fouls: 0,
        aces: 0,
        blocks: 0,
      };
    }
    return map[pid];
  };

  for (const ev of events) {
    if (!ev.playerId) continue;
    const c = ensure(ev.playerId);
    switch (ev.type) {
      case 'GOL':
        c.goals += 1;
        break;
      case 'ASISTENCIA':
        c.assists += 1;
        break;
      case 'AMARILLA':
        c.yellows += 1;
        break;
      case 'ROJA':
        c.reds += 1;
        break;
      case 'PUNTO_1':
        c.points += ev.pointsDelta ?? 1;
        break;
      case 'PUNTO_2':
        c.points += ev.pointsDelta ?? 2;
        break;
      case 'PUNTO_3':
        c.points += ev.pointsDelta ?? 3;
        c.triples += 1;
        break;
      case 'REBOTE':
        c.rebounds += 1;
        break;
      case 'FALTA':
        c.fouls += 1;
        break;
      case 'PUNTO_VOLEY':
        c.points += 1;
        break;
      case 'ACE':
        c.points += 1;
        c.aces += 1;
        break;
      case 'BLOQUEO':
        c.points += 1;
        c.blocks += 1;
        break;
      default:
        break;
    }
  }
  return map;
}

export function getBasketballBonusStatus(
  sportType: SportType,
  teamPeriodFouls: number
): 'NONE' | 'BONUS' | 'DOUBLE_BONUS' {
  const rules = SPORT_LIVE_RULES[sportType];
  if (rules.doubleBonusFoulThreshold !== null && teamPeriodFouls >= rules.doubleBonusFoulThreshold) {
    return 'DOUBLE_BONUS';
  }
  if (rules.bonusFoulThreshold !== null && teamPeriodFouls >= rules.bonusFoulThreshold) {
    return 'BONUS';
  }
  return 'NONE';
}

export function getVolleyballSetPointStatus(match: Match): {
  side: 'home' | 'away';
  kind: 'SET_POINT' | 'MATCH_POINT';
  setNumber: number;
} | null {
  if (match.status === 'FINALIZADO' || match.periods.length === 0) return null;
  const setNumber = match.periods.length;
  const currentSet = match.periods[setNumber - 1];
  if (!currentSet) return null;

  // Already won?
  if (isVolleyballSetWon(currentSet.home, currentSet.away, setNumber)) return null;

  const target = setNumber >= 3 ? 15 : 25;
  const homeCanWinNext = currentSet.home + 1 >= target && currentSet.home + 1 - currentSet.away >= 2;
  const awayCanWinNext = currentSet.away + 1 >= target && currentSet.away + 1 - currentSet.home >= 2;

  if (homeCanWinNext && !awayCanWinNext) {
    return {
      side: 'home',
      kind: match.homeScore >= 1 ? 'MATCH_POINT' : 'SET_POINT',
      setNumber,
    };
  }
  if (awayCanWinNext && !homeCanWinNext) {
    return {
      side: 'away',
      kind: match.awayScore >= 1 ? 'MATCH_POINT' : 'SET_POINT',
      setNumber,
    };
  }
  return null;
}

/**
 * Picks default starters for a team roster prioritizing goalkeeper/libero and lower dorsal numbers.
 */
export function autoSelectStartingLineup(
  roster: Pick<Player, 'id' | 'dorsal' | 'posicion'>[],
  sportType: SportType,
  excludedIds: string[] = []
): string[] {
  const excludedSet = new Set(excludedIds);
  const eligible = roster.filter((p) => !excludedSet.has(p.id));
  const limit = SPORT_LIVE_RULES[sportType].onCourtCount;

  const priorityScore = (pos: string): number => {
    const norm = pos
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (sportType === 'futbol7' && (norm.includes('porter') || norm.includes('arquer'))) return 0;
    if (sportType === 'voleibol' && (norm.includes('armador') || norm.includes('colocador'))) return 0;
    return 1;
  };

  return [...eligible]
    .sort((a, b) => {
      const pa = priorityScore(a.posicion);
      const pb = priorityScore(b.posicion);
      if (pa !== pb) return pa - pb;
      if (a.dorsal !== b.dorsal) return a.dorsal - b.dorsal;
      return a.id.localeCompare(b.id);
    })
    .slice(0, limit)
    .map((p) => p.id);
}

/**
 * Updates the active on-court lineup for a team (e.g., before kickoff or manual lineup setup).
 */
export function setTeamOnCourtPlayers(
  match: Match,
  sportType: SportType,
  side: 'home' | 'away',
  playerIds: string[]
): Match {
  const liveState = getNormalizedLiveState(match, sportType);
  const excludedSet = new Set(liveState.excludedPlayerIds[side]);
  const deduped = Array.from(new Set(playerIds))
    .filter((id) => !excludedSet.has(id))
    .slice(0, 15);

  liveState.onCourt[side] = deduped;

  return {
    ...match,
    liveState,
  };
}

/**
 * Pure transition that executes a live player substitution (Sale -> Entra),
 * updates on-court roster & substitution counter, and logs a reversible CAMBIO event.
 */
export function applyPlayerSubstitution(params: ApplySubstitutionParams): ApplySubstitutionResult {
  const { match, sportType, side, teamName, playerOut, playerIn } = params;
  if (playerOut.id === playerIn.id) {
    return { ok: false, error: 'El jugador que entra debe ser distinto al que sale.' };
  }

  const liveState = getNormalizedLiveState(match, sportType);
  if (liveState.excludedPlayerIds[side].includes(playerIn.id)) {
    return {
      ok: false,
      error: `${playerIn.nombre} ${playerIn.apellidoPaterno} está expulsado/eliminado y no puede ingresar.`,
    };
  }

  const currentOnCourt = liveState.onCourt[side];
  if (currentOnCourt.length > 0 && !currentOnCourt.includes(playerOut.id)) {
    return {
      ok: false,
      error: `${playerOut.nombre} ${playerOut.apellidoPaterno} no figura actualmente en cancha.`,
    };
  }
  if (currentOnCourt.includes(playerIn.id)) {
    return {
      ok: false,
      error: `${playerIn.nombre} ${playerIn.apellidoPaterno} ya se encuentra en cancha.`,
    };
  }

  const nextOnCourt = currentOnCourt.filter((id) => id !== playerOut.id);
  nextOnCourt.push(playerIn.id);
  liveState.onCourt[side] = nextOnCourt;
  liveState.substitutionsCount[side] += 1;

  const teamId = side === 'home' ? match.homeTeamId : match.awayTeamId;
  const resolvedPeriodLabel =
    match.periodLabel === 'Programado' || match.periodLabel === 'Por iniciar'
      ? defaultFirstPeriodLabel(sportType)
      : match.periodLabel;
  const resolvedClock =
    match.clock === 'Por iniciar'
      ? sportType === 'voleibol'
        ? resolvedPeriodLabel
        : formatMatchClock(liveState.clockSeconds, sportType, liveState.stoppageMinutes)
      : match.clock;

  const inLabel = `#${playerIn.dorsal} ${playerIn.nombre} ${playerIn.apellidoPaterno}`;
  const outLabel = `#${playerOut.dorsal} ${playerOut.nombre} ${playerOut.apellidoPaterno}`;

  const event: MatchEvent = {
    id: params.eventId ?? `ev-sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    minuteOrPeriod: resolvedClock,
    teamId,
    playerId: playerIn.id,
    playerName: `${playerIn.nombre} ${playerIn.apellidoPaterno}`,
    playerOutId: playerOut.id,
    playerOutName: `${playerOut.nombre} ${playerOut.apellidoPaterno}`,
    type: 'CAMBIO',
    detail: `Cambio (${teamName}): Entra ${inLabel} por ${outLabel}`,
    ...(match.periods.length > 0 ? { periodIndex: match.periods.length - 1 } : {}),
  };

  const updatedMatch: Match = {
    ...match,
    status: match.status === 'PROGRAMADO' ? 'EN_VIVO' : match.status,
    periodLabel: resolvedPeriodLabel,
    clock: resolvedClock,
    liveState,
    events: [event, ...match.events],
  };

  return { ok: true, updatedMatch, event };
}

function defaultFirstPeriodLabel(sportType: SportType): string {
  if (sportType === 'futbol7') return '1° Tiempo';
  if (sportType === 'voleibol') return 'Set 1';
  if (sportType === 'basquetbol3x3') return 'Tiempo Regular 3x3';
  return '1° Cuarto';
}

/**
 * Advances the match to the next official period/quarter/set according to sport rules,
 * resetting per-quarter fouls (Basketball) or per-set timeouts & substitutions (Volleyball).
 */
export function advanceMatchPeriod(match: Match, sportType: SportType): Match {
  const liveState = getNormalizedLiveState(match, sportType);
  const nextPeriods = match.periods.map((p) => ({ ...p }));
  let nextLabel = match.periodLabel;
  let nextClock = match.clock;
  const nextTimeouts = { ...match.timeouts };

  if (match.status === 'PROGRAMADO' || match.periodLabel === 'Por iniciar' || match.periodLabel === 'Programado') {
    if (nextPeriods.length === 0) {
      nextPeriods.push({ home: 0, away: 0 });
    }
    nextLabel = defaultFirstPeriodLabel(sportType);
    if (sportType === 'futbol7') {
      liveState.clockSeconds = 0;
      liveState.stoppageMinutes = 0;
      nextClock = '00:00';
    } else if (sportType === 'voleibol') {
      liveState.clockSeconds = 0;
      nextClock = 'Set 1';
    } else {
      liveState.clockSeconds = SPORT_LIVE_RULES[sportType].periodDurationSeconds;
      nextClock = formatMatchClock(liveState.clockSeconds, sportType);
    }
  } else if (sportType === 'futbol7') {
    if (nextPeriods.length < 2) {
      while (nextPeriods.length < 2) nextPeriods.push({ home: 0, away: 0 });
      nextLabel = '2° Tiempo';
      liveState.clockSeconds = 25 * 60;
      liveState.stoppageMinutes = 0;
      liveState.periodFouls = { home: 0, away: 0 };
      nextClock = '25:00';
    } else if (nextPeriods.length === 2) {
      nextPeriods.push({ home: 0, away: 0 });
      nextLabel = 'Prórroga';
      liveState.clockSeconds = 50 * 60;
      liveState.stoppageMinutes = 0;
      nextClock = '50:00';
    } else {
      // Already in extra time -> keep label cleanly
      nextLabel = 'Prórroga';
    }
  } else if (sportType === 'basquetbol') {
    const nextIdx = nextPeriods.length + 1;
    if (nextPeriods.length < 10) {
      nextPeriods.push({ home: 0, away: 0 });
    }
    if (nextIdx <= 4) {
      nextLabel = `${nextIdx}° Cuarto`;
      liveState.clockSeconds = 10 * 60;
      nextClock = '10:00';
    } else {
      const otNum = nextIdx - 4;
      nextLabel = otNum === 1 ? 'Prórroga (OT)' : `Prórroga ${otNum} (OT${otNum})`;
      liveState.clockSeconds = 5 * 60;
      nextClock = '05:00';
    }
    // Reset team fouls per quarter/OT under FIBA rules
    liveState.periodFouls = { home: 0, away: 0 };
  } else if (sportType === 'basquetbol3x3') {
    if (nextPeriods.length < 2) {
      while (nextPeriods.length < 2) nextPeriods.push({ home: 0, away: 0 });
      nextLabel = 'Prórroga 3x3 (+2 pts)';
      liveState.clockSeconds = 0;
      nextClock = 'OT 3x3';
    } else {
      nextLabel = 'Prórroga 3x3 (+2 pts)';
    }
  } else {
    // Voleibol
    const s = Math.min(3, nextPeriods.length + 1);
    if (nextPeriods.length < 3) {
      nextPeriods.push({ home: 0, away: 0 });
    }
    nextLabel = s === 3 ? 'Set 3 (Tiebreak)' : `Set ${s}`;
    nextClock = `Set ${s}`;
    // Reset per-set technical timeouts and substitutions counter
    nextTimeouts.home = 0;
    nextTimeouts.away = 0;
    liveState.substitutionsCount = { home: 0, away: 0 };
  }

  return {
    ...match,
    status: 'EN_VIVO',
    periodLabel: nextLabel,
    clock: nextClock,
    periods: nextPeriods,
    timeouts: nextTimeouts,
    liveState,
  };
}

/**
 * Safely applies a positive or negative stat delta while clamping all counters at >= 0.
 */
export function applyStatDeltaClamped(stats: PlayerStats, delta: PlayerStatDelta): PlayerStats {
  return {
    ...stats,
    goles: Math.max(0, stats.goles + (delta.goles ?? 0)),
    asistencias: Math.max(0, stats.asistencias + (delta.asistencias ?? 0)),
    tarjetasAmarillas: Math.max(0, stats.tarjetasAmarillas + (delta.tarjetasAmarillas ?? 0)),
    tarjetasRojas: Math.max(0, stats.tarjetasRojas + (delta.tarjetasRojas ?? 0)),
    puntos: Math.max(0, stats.puntos + (delta.puntos ?? 0)),
    rebotes: Math.max(0, stats.rebotes + (delta.rebotes ?? 0)),
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
  if (actionType === 'ASISTENCIA') delta.asistencias = 1;
  if (actionType === 'AMARILLA') delta.tarjetasAmarillas = 1;
  if (actionType === 'ROJA') delta.tarjetasRojas = 1;
  if (actionType === 'PUNTO_1' || actionType === 'PUNTO_2' || actionType === 'PUNTO_3') {
    delta.puntos = pointsDelta;
    if (actionType === 'PUNTO_3') delta.triples = 1;
  }
  if (actionType === 'REBOTE') delta.rebotes = 1;
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
  if (delta.asistencias) negated.asistencias = -delta.asistencias;
  if (delta.tarjetasAmarillas) negated.tarjetasAmarillas = -delta.tarjetasAmarillas;
  if (delta.tarjetasRojas) negated.tarjetasRojas = -delta.tarjetasRojas;
  if (delta.puntos) negated.puntos = -delta.puntos;
  if (delta.rebotes) negated.rebotes = -delta.rebotes;
  if (delta.triples) negated.triples = -delta.triples;
  if (delta.faltas) negated.faltas = -delta.faltas;
  if (delta.aces) negated.aces = -delta.aces;
  if (delta.bloqueos) negated.bloqueos = -delta.bloqueos;
  return negated;
}

/**
 * Pure transition that registers a live match action (goal, assist, foul, card, points,
 * rebound, timeout, volleyball rally) with full sport-specific rules and exact metadata
 * so any event can later be cleanly reverted.
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
  const liveState = getNormalizedLiveState(match, sportType);
  const priorCounters = computePlayerMatchCounters(match.events);
  let detail = '';
  let periodIndex: number | undefined;
  let triggeredSetWin = false;

  if (sportType === 'futbol7') {
    if (actionType === 'GOL') {
      if (side === 'home') nextHome += 1;
      else nextAway += 1;
      if (nextPeriods.length === 0) nextPeriods = [{ home: 0, away: 0 }];
      periodIndex = nextPeriods.length - 1;
      if (side === 'home') nextPeriods[periodIndex].home += 1;
      else nextPeriods[periodIndex].away += 1;
      detail = `Gol anotado por ${actorLabel}`;
    } else if (actionType === 'ASISTENCIA') {
      detail = `Asistencia de ${actorLabel}`;
    } else if (actionType === 'AMARILLA') {
      const priorYellows = player ? (priorCounters[player.id]?.yellows ?? 0) : 0;
      if (player && priorYellows >= 1) {
        if (!liveState.excludedPlayerIds[side].includes(player.id)) {
          liveState.excludedPlayerIds[side].push(player.id);
        }
        liveState.onCourt[side] = liveState.onCourt[side].filter((id) => id !== player.id);
        detail = `2ª Tarjeta amarilla (Expulsión) para ${actorLabel}`;
      } else {
        detail = `Tarjeta amarilla para ${actorLabel}`;
      }
    } else if (actionType === 'ROJA') {
      if (player) {
        if (!liveState.excludedPlayerIds[side].includes(player.id)) {
          liveState.excludedPlayerIds[side].push(player.id);
        }
        liveState.onCourt[side] = liveState.onCourt[side].filter((id) => id !== player.id);
      }
      detail = `Tarjeta roja directa para ${actorLabel}`;
    } else if (actionType === 'FALTA') {
      if (side === 'home') nextFouls.home += 1;
      else nextFouls.away += 1;
      liveState.periodFouls[side] += 1;
      detail = player ? `Falta cometida por ${actorLabel}` : `Falta acumulada (${teamName})`;
    }
  } else if (sportType === 'basquetbol' || sportType === 'basquetbol3x3') {
    const is3x3 = sportType === 'basquetbol3x3';
    if (actionType === 'PUNTO_1' || actionType === 'PUNTO_2' || actionType === 'PUNTO_3') {
      if (side === 'home') nextHome += resolvedPoints;
      else nextAway += resolvedPoints;
      if (nextPeriods.length === 0) nextPeriods = [{ home: 0, away: 0 }];
      periodIndex = nextPeriods.length - 1;
      const last = nextPeriods[periodIndex];
      if (side === 'home') last.home += resolvedPoints;
      else last.away += resolvedPoints;

      const shotLabel = is3x3
        ? actionType === 'PUNTO_2'
          ? 'Exterior (2 pts)'
          : 'Interior / TL (1 pt)'
        : actionType === 'PUNTO_3'
        ? 'Triple'
        : actionType === 'PUNTO_2'
        ? 'Doble'
        : 'Tiro libre';

      const newTeamScore = side === 'home' ? nextHome : nextAway;
      const targetReached = is3x3 && newTeamScore >= 21;
      if (targetReached) {
        nextPeriodLabel = 'Meta 21 pts alcanzada (pendiente planilla)';
      }
      detail = `+${resolvedPoints} pts (${shotLabel}) · ${actorLabel}${
        targetReached ? ' · ¡Meta 21 pts!' : ''
      }`;
    } else if (actionType === 'REBOTE') {
      detail = `Rebote capturado por ${actorLabel}`;
    } else if (actionType === 'ASISTENCIA') {
      detail = `Asistencia de ${actorLabel}`;
    } else if (actionType === 'FALTA') {
      if (side === 'home') nextFouls.home += 1;
      else nextFouls.away += 1;
      liveState.periodFouls[side] += 1;
      const limit = SPORT_LIVE_RULES[sportType].personalFoulLimit;
      const nextPersonalFouls = player ? (priorCounters[player.id]?.fouls ?? 0) + 1 : 0;
      if (player && limit !== null && nextPersonalFouls >= limit) {
        if (!liveState.excludedPlayerIds[side].includes(player.id)) {
          liveState.excludedPlayerIds[side].push(player.id);
        }
        liveState.onCourt[side] = liveState.onCourt[side].filter((id) => id !== player.id);
        detail = `Falta personal (${nextPersonalFouls}ª — Eliminado) · ${actorLabel}`;
      } else {
        detail = player
          ? `Falta personal (${nextPersonalFouls}ª) · ${actorLabel}`
          : `Falta de equipo · ${teamName}`;
      }
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
      // Under rally-point rules, scoring side retains or gains the serve
      liveState.servingSide = side;

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
          const newSetNumber = nextPeriods.length;
          nextPeriodLabel = newSetNumber === 3 ? 'Set 3 (Tiebreak)' : `Set ${newSetNumber}`;
          // Reset per-set timeouts & substitutions when opening next set
          nextTimeouts.home = 0;
          nextTimeouts.away = 0;
          liveState.substitutionsCount = { home: 0, away: 0 };
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
      ? defaultFirstPeriodLabel(sportType)
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
    ...(player
      ? {
          playerId: player.id,
          playerName: `${player.nombre} ${player.apellidoPaterno}`,
        }
      : {}),
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
    liveState,
    events: [newEvent, ...match.events],
  };

  return { updatedMatch, event: newEvent, statDelta };
}

/**
 * Pure transition that cleanly reverts ANY previously registered live event (including
 * player substitutions, goals, assists, rebounds, fouls, cards, basketball points,
 * volleyball set wins, and timeouts) and returns the negative player stat delta.
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
  const liveState = getNormalizedLiveState(match, sportType);
  const remainingEvents = match.events.filter((e) => e.id !== eventId);

  if (targetEvent.type === 'CAMBIO') {
    // Swap playerIn back to bench and playerOut back onto the court
    if (targetEvent.playerId) {
      liveState.onCourt[side] = liveState.onCourt[side].filter((id) => id !== targetEvent.playerId);
    }
    if (
      targetEvent.playerOutId &&
      !liveState.onCourt[side].includes(targetEvent.playerOutId) &&
      !liveState.excludedPlayerIds[side].includes(targetEvent.playerOutId)
    ) {
      liveState.onCourt[side].push(targetEvent.playerOutId);
    }
    liveState.substitutionsCount[side] = Math.max(0, liveState.substitutionsCount[side] - 1);
  } else if (sportType === 'futbol7') {
    if (targetEvent.type === 'GOL') {
      if (side === 'home') nextHome = Math.max(0, nextHome - 1);
      else nextAway = Math.max(0, nextAway - 1);
      const pIdx =
        targetEvent.periodIndex !== undefined && targetEvent.periodIndex < nextPeriods.length
          ? targetEvent.periodIndex
          : nextPeriods.length - 1;
      if (pIdx >= 0 && nextPeriods[pIdx]) {
        if (side === 'home') nextPeriods[pIdx].home = Math.max(0, nextPeriods[pIdx].home - 1);
        else nextPeriods[pIdx].away = Math.max(0, nextPeriods[pIdx].away - 1);
      }
    } else if (targetEvent.type === 'FALTA') {
      if (side === 'home') nextFouls.home = Math.max(0, nextFouls.home - 1);
      else nextFouls.away = Math.max(0, nextFouls.away - 1);
      liveState.periodFouls[side] = Math.max(0, liveState.periodFouls[side] - 1);
    } else if ((targetEvent.type === 'ROJA' || targetEvent.type === 'AMARILLA') && targetEvent.playerId) {
      const remCounters = computePlayerMatchCounters(remainingEvents);
      const stillExcluded =
        (remCounters[targetEvent.playerId]?.reds ?? 0) > 0 ||
        (remCounters[targetEvent.playerId]?.yellows ?? 0) >= 2;
      if (!stillExcluded) {
        liveState.excludedPlayerIds[side] = liveState.excludedPlayerIds[side].filter(
          (id) => id !== targetEvent.playerId
        );
      }
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
      if (sportType === 'basquetbol3x3' && nextHome < 21 && nextAway < 21 && nextPeriodLabel.includes('Meta 21')) {
        nextPeriodLabel = 'Tiempo Regular 3x3';
      }
    } else if (targetEvent.type === 'FALTA') {
      if (side === 'home') nextFouls.home = Math.max(0, nextFouls.home - 1);
      else nextFouls.away = Math.max(0, nextFouls.away - 1);
      liveState.periodFouls[side] = Math.max(0, liveState.periodFouls[side] - 1);
      if (targetEvent.playerId) {
        const limit = SPORT_LIVE_RULES[sportType].personalFoulLimit;
        const remCounters = computePlayerMatchCounters(remainingEvents);
        if (limit !== null && (remCounters[targetEvent.playerId]?.fouls ?? 0) < limit) {
          liveState.excludedPlayerIds[side] = liveState.excludedPlayerIds[side].filter(
            (id) => id !== targetEvent.playerId
          );
        }
      }
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
        nextPeriodLabel = setIdx === 2 ? 'Set 3 (Tiebreak)' : `Set ${setIdx + 1}`;
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
    liveState,
    events: remainingEvents,
  };

  return {
    updatedMatch,
    revertedEvent: targetEvent,
    statDelta,
  };
}
