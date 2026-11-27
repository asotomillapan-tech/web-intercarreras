import type {
  Match,
  MatchAttendanceRecord,
  MatchAttendanceStatus,
  Player,
  SportType,
} from '../types/tournament';
import { autoSelectStartingLineup } from './liveMatchEngine';

export const MAX_ATTENDANCE_PLAYERS_PER_TEAM = 40;

export interface PlayerAttendanceMatchEntry {
  matchId: string;
  fecha: string;
  jornada: number;
  opponentTeamId: string;
  present: boolean;
}

export interface PlayerAttendanceSummary {
  attendedMatches: number;
  registeredTeamMatches: number;
  omittedTeamMatches: number;
  attendanceRate: number | null;
  history: PlayerAttendanceMatchEntry[];
}

export interface MatchesAttendanceOverview {
  totalMatches: number;
  registeredCount: number;
  omittedCount: number;
  unregisteredCount: number;
}

function sanitizeIdList(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim().slice(0, 128);
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= MAX_ATTENDANCE_PLAYERS_PER_TEAM) break;
  }
  return out;
}

function sanitizeRecorderName(name?: string): string | undefined {
  if (!name) return undefined;
  const trimmed = name.trim().slice(0, 120);
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeNotes(notes?: string): string | undefined {
  if (!notes) return undefined;
  const trimmed = notes.trim().slice(0, 240);
  return trimmed.length > 0 ? trimmed : undefined;
}

export function sanitizeMatchDorsalsMap(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, number> = {};
  let count = 0;
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const cleanKey = key.trim().slice(0, 128);
    if (!cleanKey) continue;
    const num = typeof val === 'number' ? val : Number(val);
    if (!Number.isFinite(num)) continue;
    const intVal = Math.trunc(num);
    if (intVal < 1 || intVal > 99) continue;
    out[cleanKey] = intVal;
    count += 1;
    if (count >= 80) break;
  }
  return count > 0 ? out : undefined;
}

/**
 * Returns the effective jersey number for a player in a specific match:
 * prefers the per-match override recorded during attendance (`matchDorsals`),
 * falling back to the player's permanent registered dorsal (0 = "Sin número definido").
 */
export function getEffectiveMatchDorsal(
  match: Pick<Match, 'attendance'> | null | undefined,
  player: Pick<Player, 'id' | 'dorsal'>
): number {
  const override = match?.attendance?.matchDorsals?.[player.id];
  if (typeof override === 'number' && Number.isFinite(override) && override >= 1 && override <= 99) {
    return Math.trunc(override);
  }
  return typeof player.dorsal === 'number' && Number.isFinite(player.dorsal) && player.dorsal > 0
    ? Math.trunc(player.dorsal)
    : 0;
}

export function formatDorsalLabel(dorsal: number): string {
  return dorsal > 0 ? `#${dorsal}` : 'S/N';
}

export function getNormalizedMatchAttendance(match: Match): MatchAttendanceRecord {
  const raw = match.attendance;
  const status: MatchAttendanceStatus =
    raw?.status === 'REGISTRADA' || raw?.status === 'OMITIDA' || raw?.status === 'NO_REGISTRADA'
      ? raw.status
      : 'NO_REGISTRADA';

  const normalized: MatchAttendanceRecord = {
    status,
    homePresentIds: status === 'OMITIDA' ? [] : sanitizeIdList(raw?.homePresentIds),
    awayPresentIds: status === 'OMITIDA' ? [] : sanitizeIdList(raw?.awayPresentIds),
  };

  const matchDorsals = sanitizeMatchDorsalsMap(raw?.matchDorsals);
  if (matchDorsals) normalized.matchDorsals = matchDorsals;

  if (typeof raw?.recordedAt === 'string' && raw.recordedAt.trim().length > 0) {
    normalized.recordedAt = raw.recordedAt.trim().slice(0, 64);
  }
  const recorder = sanitizeRecorderName(raw?.recordedByName);
  if (recorder) normalized.recordedByName = recorder;
  const notes = sanitizeNotes(raw?.notes);
  if (notes) normalized.notes = notes;

  return normalized;
}

export function setPlayerMatchDorsal(params: {
  match: Match;
  playerId: string;
  dorsal: number | null;
  recorderName?: string;
  nowIso?: string;
}): Match {
  const { match, playerId, dorsal, recorderName, nowIso } = params;
  const trimmedId = playerId.trim().slice(0, 128);
  if (!trimmedId) return match;

  const current = getNormalizedMatchAttendance(match);
  const nextDorsals: Record<string, number> = { ...(current.matchDorsals ?? {}) };

  if (dorsal === null || !Number.isFinite(dorsal) || Math.trunc(dorsal) < 1) {
    delete nextDorsals[trimmedId];
  } else {
    nextDorsals[trimmedId] = Math.max(1, Math.min(99, Math.trunc(dorsal)));
  }

  const sanitizedDorsals = sanitizeMatchDorsalsMap(nextDorsals);
  const nextAttendance: MatchAttendanceRecord = {
    status: current.status,
    homePresentIds: current.homePresentIds,
    awayPresentIds: current.awayPresentIds,
    recordedAt: (nowIso ?? new Date().toISOString()).slice(0, 64),
  };

  if (sanitizedDorsals) nextAttendance.matchDorsals = sanitizedDorsals;
  const recorder = sanitizeRecorderName(recorderName ?? current.recordedByName);
  if (recorder) nextAttendance.recordedByName = recorder;
  if (current.notes) nextAttendance.notes = current.notes;

  return {
    ...match,
    attendance: nextAttendance,
  };
}

export function togglePlayerAttendance(params: {
  match: Match;
  side: 'home' | 'away';
  playerId: string;
  recorderName?: string;
  nowIso?: string;
}): Match {
  const { match, side, playerId, recorderName, nowIso } = params;
  const trimmedId = playerId.trim().slice(0, 128);
  if (!trimmedId) return match;

  const current = getNormalizedMatchAttendance(match);
  const currentList = side === 'home' ? current.homePresentIds : current.awayPresentIds;
  const exists = currentList.includes(trimmedId);
  const nextSideList = exists
    ? currentList.filter((id) => id !== trimmedId)
    : sanitizeIdList([...currentList, trimmedId]);

  const nextAttendance: MatchAttendanceRecord = {
    status: 'REGISTRADA',
    homePresentIds: side === 'home' ? nextSideList : current.homePresentIds,
    awayPresentIds: side === 'away' ? nextSideList : current.awayPresentIds,
    recordedAt: (nowIso ?? new Date().toISOString()).slice(0, 64),
  };

  if (current.matchDorsals) nextAttendance.matchDorsals = current.matchDorsals;
  const recorder = sanitizeRecorderName(recorderName ?? current.recordedByName);
  if (recorder) nextAttendance.recordedByName = recorder;
  if (current.notes) nextAttendance.notes = current.notes;

  return {
    ...match,
    attendance: nextAttendance,
  };
}

export function setTeamAttendanceAll(params: {
  match: Match;
  side: 'home' | 'away';
  rosterPlayerIds: string[];
  present: boolean;
  recorderName?: string;
  nowIso?: string;
}): Match {
  const { match, side, rosterPlayerIds, present, recorderName, nowIso } = params;
  const current = getNormalizedMatchAttendance(match);
  const nextSideList = present ? sanitizeIdList(rosterPlayerIds) : [];

  const nextAttendance: MatchAttendanceRecord = {
    status: 'REGISTRADA',
    homePresentIds: side === 'home' ? nextSideList : current.homePresentIds,
    awayPresentIds: side === 'away' ? nextSideList : current.awayPresentIds,
    recordedAt: (nowIso ?? new Date().toISOString()).slice(0, 64),
  };

  if (current.matchDorsals) nextAttendance.matchDorsals = current.matchDorsals;
  const recorder = sanitizeRecorderName(recorderName ?? current.recordedByName);
  if (recorder) nextAttendance.recordedByName = recorder;
  if (current.notes) nextAttendance.notes = current.notes;

  return {
    ...match,
    attendance: nextAttendance,
  };
}

export function markMatchAttendanceOmitted(params: {
  match: Match;
  recorderName?: string;
  notes?: string;
  nowIso?: string;
}): Match {
  const { match, recorderName, notes, nowIso } = params;
  const current = getNormalizedMatchAttendance(match);
  const nextAttendance: MatchAttendanceRecord = {
    status: 'OMITIDA',
    homePresentIds: [],
    awayPresentIds: [],
    recordedAt: (nowIso ?? new Date().toISOString()).slice(0, 64),
  };

  if (current.matchDorsals) nextAttendance.matchDorsals = current.matchDorsals;
  const recorder = sanitizeRecorderName(recorderName ?? current.recordedByName);
  if (recorder) nextAttendance.recordedByName = recorder;
  const cleanedNotes = sanitizeNotes(notes);
  if (cleanedNotes) nextAttendance.notes = cleanedNotes;

  return {
    ...match,
    attendance: nextAttendance,
  };
}

export function resumeMatchAttendance(params: {
  match: Match;
  recorderName?: string;
  nowIso?: string;
}): Match {
  const { match, recorderName, nowIso } = params;
  const current = getNormalizedMatchAttendance(match);
  const nextAttendance: MatchAttendanceRecord = {
    status: 'REGISTRADA',
    homePresentIds: current.homePresentIds,
    awayPresentIds: current.awayPresentIds,
    recordedAt: (nowIso ?? new Date().toISOString()).slice(0, 64),
  };

  if (current.matchDorsals) nextAttendance.matchDorsals = current.matchDorsals;
  const recorder = sanitizeRecorderName(recorderName ?? current.recordedByName);
  if (recorder) nextAttendance.recordedByName = recorder;

  return {
    ...match,
    attendance: nextAttendance,
  };
}

export function syncOnCourtPlayersIntoAttendance(params: {
  match: Match;
  side: 'home' | 'away';
  onCourtIds: string[];
  recorderName?: string;
  nowIso?: string;
}): Match {
  const { match, side, onCourtIds, recorderName, nowIso } = params;
  const current = getNormalizedMatchAttendance(match);
  const existing = side === 'home' ? current.homePresentIds : current.awayPresentIds;
  const merged = sanitizeIdList([...existing, ...onCourtIds]);

  const nextAttendance: MatchAttendanceRecord = {
    status: 'REGISTRADA',
    homePresentIds: side === 'home' ? merged : current.homePresentIds,
    awayPresentIds: side === 'away' ? merged : current.awayPresentIds,
    recordedAt: (nowIso ?? new Date().toISOString()).slice(0, 64),
  };

  if (current.matchDorsals) nextAttendance.matchDorsals = current.matchDorsals;
  const recorder = sanitizeRecorderName(recorderName ?? current.recordedByName);
  if (recorder) nextAttendance.recordedByName = recorder;
  if (current.notes) nextAttendance.notes = current.notes;

  return {
    ...match,
    attendance: nextAttendance,
  };
}

/**
 * Selects starting lineup automatically, prioritizing players marked as present
 * whenever attendance has been recorded for the match. Falls back to the full
 * roster if attendance is omitted, unregistered, or has fewer present players
 * than required on court.
 */
export function selectStartersWithAttendance(params: {
  roster: Player[];
  match: Match;
  side: 'home' | 'away';
  sportType: SportType;
  excludedIds?: string[];
}): string[] {
  const { roster, match, side, sportType, excludedIds = [] } = params;
  const attendance = getNormalizedMatchAttendance(match);
  const presentIds = side === 'home' ? attendance.homePresentIds : attendance.awayPresentIds;

  if (attendance.status === 'REGISTRADA' && presentIds.length > 0) {
    const presentSet = new Set(presentIds);
    const presentRoster = roster.filter((p) => presentSet.has(p.id));
    const fromPresent = autoSelectStartingLineup(presentRoster, sportType, excludedIds);
    if (fromPresent.length > 0) {
      return fromPresent;
    }
  }

  return autoSelectStartingLineup(roster, sportType, excludedIds);
}

/**
 * Computes verified attendance metrics for a player on a given team.
 * Matches where attendance was omitted or not recorded are tracked separately
 * and excluded from the attendance rate denominator so skipping attendance
 * never unfairly penalizes a player.
 */
export function computePlayerAttendanceSummary(
  matches: Match[],
  playerId: string,
  teamId: string
): PlayerAttendanceSummary {
  let attendedMatches = 0;
  let registeredTeamMatches = 0;
  let omittedTeamMatches = 0;
  const history: PlayerAttendanceMatchEntry[] = [];

  for (const m of matches) {
    const isHome = m.homeTeamId === teamId;
    const isAway = m.awayTeamId === teamId;
    if (!isHome && !isAway) continue;

    const att = getNormalizedMatchAttendance(m);
    if (att.status === 'OMITIDA') {
      omittedTeamMatches += 1;
      continue;
    }
    if (att.status !== 'REGISTRADA') continue;

    const teamPresentIds = isHome ? att.homePresentIds : att.awayPresentIds;
    // Only count a team match as registered for this team if attendance was recorded
    // and at least one team had players checked in (or either team was marked)
    if (att.homePresentIds.length === 0 && att.awayPresentIds.length === 0) continue;

    registeredTeamMatches += 1;
    const present = teamPresentIds.includes(playerId);
    if (present) attendedMatches += 1;

    history.push({
      matchId: m.id,
      fecha: m.fecha,
      jornada: m.jornada,
      opponentTeamId: isHome ? m.awayTeamId : m.homeTeamId,
      present,
    });
  }

  history.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.jornada - a.jornada);

  return {
    attendedMatches,
    registeredTeamMatches,
    omittedTeamMatches,
    attendanceRate:
      registeredTeamMatches > 0 ? Math.round((attendedMatches / registeredTeamMatches) * 100) : null,
    history,
  };
}

export function computeMatchesAttendanceOverview(matches: Match[]): MatchesAttendanceOverview {
  let registeredCount = 0;
  let omittedCount = 0;
  let unregisteredCount = 0;

  for (const m of matches) {
    const att = getNormalizedMatchAttendance(m);
    if (att.status === 'REGISTRADA') {
      registeredCount += 1;
    } else if (att.status === 'OMITIDA') {
      omittedCount += 1;
    } else {
      unregisteredCount += 1;
    }
  }

  return {
    totalMatches: matches.length,
    registeredCount,
    omittedCount,
    unregisteredCount,
  };
}
