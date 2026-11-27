import type {
  AiScoresheetResult,
  DisciplineFormatConfig,
  DisciplineId,
  FullPlayoffBracket,
  Match,
  MatchPhase,
  Player,
  PlayoffBracketSlot,
  PlayoffMatchup,
  PlayoffRoundColumn,
  SportType,
  StandingsRow,
  Team,
  TransferRecord,
} from '../types/tournament';
import { normalizeMatchDateToIso } from './calendarEngine';

/**
 * Validates a Chilean RUT using modulo-11 verifier digit algorithm.
 */
export function validateRut(rawRut: string): boolean {
  const cleaned = rawRut.replace(/[.\-\s]/g, '').toUpperCase();
  if (!/^\d{7,8}[0-9K]$/.test(cleaned)) {
    return false;
  }
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  const expectedDv = remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);
  return dv === expectedDv;
}

/**
 * Formats a Chilean RUT cleanly as XX.XXX.XXX-X.
 */
export function formatRut(rawRut: string): string {
  const cleaned = rawRut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (cleaned.length < 2) return cleaned;
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formattedBody}-${dv}`;
}

/**
 * Validates official Universidad de La Frontera institutional email.
 */
export function validateUfroEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return /^[a-z0-9._%+-]+@(ufromail\.cl|ufrontera\.cl)$/.test(normalized);
}

/**
 * Equitably distributes registered teams across N groups (sizes differ by at most 1).
 * Uses snake-style distribution so career/faculty representatives are balanced across groups.
 */
export function generateEquitableGroups(teams: Team[], numGrupos: number): Team[] {
  const safeGroups = Math.max(1, Math.min(numGrupos, Math.max(1, teams.length)));
  const groupLabels = Array.from({ length: safeGroups }, (_, i) => `Grupo ${String.fromCharCode(65 + i)}`);

  return teams.map((team, idx) => {
    const row = Math.floor(idx / safeGroups);
    const col = idx % safeGroups;
    const groupIdx = row % 2 === 0 ? col : safeGroups - 1 - col;
    return {
      ...team,
      groupName: groupLabels[groupIdx],
    };
  });
}

/**
 * Generates a complete round-robin ("todos contra todos") fixture list for a group of teams.
 */
export function generateRoundRobinMatches(
  disciplineId: DisciplineId,
  groupName: string,
  groupTeams: Team[],
  sede: string,
  refereeId: string,
  startDateIso = '2026-11-24'
): Match[] {
  const list: (Team | null)[] = [...groupTeams];
  if (list.length < 2) return [];
  if (list.length % 2 !== 0) {
    list.push(null); // Bye
  }

  const totalRounds = list.length - 1;
  const half = list.length / 2;
  const generated: Match[] = [];
  const baseDate = new Date(`${startDateIso}T18:00:00`);

  for (let round = 0; round < totalRounds; round++) {
    const matchDate = new Date(baseDate.getTime() + round * 7 * 24 * 60 * 60 * 1000);
    const fechaStr = matchDate.toISOString().slice(0, 10);

    for (let i = 0; i < half; i++) {
      const home = list[i];
      const away = list[list.length - 1 - i];
      if (!home || !away) continue;

      const hour = 17 + (i % 4);
      const mins = (i % 2) * 30;
      const horaStr = `${String(hour).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

      generated.push({
        id: `m-${disciplineId}-${groupName.replace(/\s+/g, '')}-j${round + 1}-${i + 1}`,
        disciplineId,
        groupName,
        fase: 'Grupos',
        jornada: round + 1,
        fecha: fechaStr,
        hora: horaStr,
        cancha: sede,
        homeTeamId: round % 2 === 0 ? home.id : away.id,
        awayTeamId: round % 2 === 0 ? away.id : home.id,
        homeScore: 0,
        awayScore: 0,
        status: 'PROGRAMADO',
        periodLabel: 'Por iniciar',
        clock: '00:00',
        periods: [],
        fouls: { home: 0, away: 0 },
        timeouts: { home: 0, away: 0 },
        events: [],
        refereeId,
      });
    }

    // Circle method rotation keeping index 0 fixed
    const last = list.pop()!;
    list.splice(1, 0, last);
  }

  return generated;
}

/**
 * Computes official standings table for a discipline & group using sport-specific rules.
 */
export function computeStandings(
  sportType: SportType,
  teams: Team[],
  matches: Match[]
): StandingsRow[] {
  const rowMap = new Map<string, StandingsRow>();

  for (const team of teams) {
    rowMap.set(team.id, {
      teamId: team.id,
      teamName: team.nombre,
      sigla: team.sigla,
      carrera: team.carrera,
      groupName: team.groupName,
      pj: 0,
      pg: 0,
      pe: 0,
      pp: 0,
      favor: 0,
      contra: 0,
      diferencia: 0,
      setsFavor: sportType === 'voleibol' ? 0 : undefined,
      setsContra: sportType === 'voleibol' ? 0 : undefined,
      puntos: 0,
      racha: [],
    });
  }

  const countedMatches = matches.filter(
    (m) => m.fase === 'Grupos' && (m.status === 'FINALIZADO' || m.status === 'EN_VIVO')
  );

  for (const match of countedMatches) {
    const home = rowMap.get(match.homeTeamId);
    const away = rowMap.get(match.awayTeamId);
    if (!home || !away) continue;

    home.pj += 1;
    away.pj += 1;

    if (sportType === 'voleibol') {
      // homeScore/awayScore represent sets won; periods store point breakdown
      const homeSets = match.homeScore;
      const awaySets = match.awayScore;
      const homePts = match.periods.reduce((acc, p) => acc + p.home, 0);
      const awayPts = match.periods.reduce((acc, p) => acc + p.away, 0);

      home.setsFavor = (home.setsFavor ?? 0) + homeSets;
      home.setsContra = (home.setsContra ?? 0) + awaySets;
      away.setsFavor = (away.setsFavor ?? 0) + awaySets;
      away.setsContra = (away.setsContra ?? 0) + homeSets;

      home.favor += homePts || homeSets * 25;
      home.contra += awayPts || awaySets * 25;
      away.favor += awayPts || awaySets * 25;
      away.contra += homePts || homeSets * 25;

      if (homeSets > awaySets) {
        home.pg += 1;
        away.pp += 1;
        // 3 pts for 2-0 or 3-0/3-1; 2 pts for tiebreak win (2-1 or 3-2), 1 pt for tiebreak loss
        const isTiebreak = homeSets - awaySets === 1 && awaySets >= 1;
        home.puntos += isTiebreak ? 2 : 3;
        away.puntos += isTiebreak ? 1 : 0;
        home.racha.push('G');
        away.racha.push('P');
      } else if (awaySets > homeSets) {
        away.pg += 1;
        home.pp += 1;
        const isTiebreak = awaySets - homeSets === 1 && homeSets >= 1;
        away.puntos += isTiebreak ? 2 : 3;
        home.puntos += isTiebreak ? 1 : 0;
        away.racha.push('G');
        home.racha.push('P');
      }
    } else if (sportType === 'basquetbol' || sportType === 'basquetbol3x3') {
      home.favor += match.homeScore;
      home.contra += match.awayScore;
      away.favor += match.awayScore;
      away.contra += match.homeScore;

      if (match.homeScore > match.awayScore) {
        home.pg += 1;
        away.pp += 1;
        home.puntos += 2;
        away.puntos += 1;
        home.racha.push('G');
        away.racha.push('P');
      } else if (match.awayScore > match.homeScore) {
        away.pg += 1;
        home.pp += 1;
        away.puntos += 2;
        home.puntos += 1;
        away.racha.push('G');
        home.racha.push('P');
      } else {
        home.pe += 1;
        away.pe += 1;
        home.puntos += 1;
        away.puntos += 1;
        home.racha.push('E');
        away.racha.push('E');
      }
    } else {
      // Fútbol 7: 3 pts win, 1 pt draw, 0 pts loss
      home.favor += match.homeScore;
      home.contra += match.awayScore;
      away.favor += match.awayScore;
      away.contra += match.homeScore;

      if (match.homeScore > match.awayScore) {
        home.pg += 1;
        away.pp += 1;
        home.puntos += 3;
        home.racha.push('G');
        away.racha.push('P');
      } else if (match.awayScore > match.homeScore) {
        away.pg += 1;
        home.pp += 1;
        away.puntos += 3;
        away.racha.push('G');
        home.racha.push('P');
      } else {
        home.pe += 1;
        away.pe += 1;
        home.puntos += 1;
        away.puntos += 1;
        home.racha.push('E');
        away.racha.push('E');
      }
    }
  }

  const rows = Array.from(rowMap.values()).map((row) => ({
    ...row,
    diferencia:
      sportType === 'voleibol'
        ? (row.setsFavor ?? 0) - (row.setsContra ?? 0)
        : row.favor - row.contra,
    racha: row.racha.slice(-5),
  }));

  rows.sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    if (b.diferencia !== a.diferencia) return b.diferencia - a.diferencia;
    if (b.favor !== a.favor) return b.favor - a.favor;
    return a.teamName.localeCompare(b.teamName, 'es');
  });

  return rows;
}

/**
 * Generates dynamic playoff matchups based on group standings and configurable qualifiers.
 */
export function generatePlayoffBracket(
  standingsByGroup: Record<string, StandingsRow[]>,
  clasificadosPorGrupo: number,
  formatoPlayoff: 4 | 8 | 16
): PlayoffMatchup[] {
  const groups = Object.keys(standingsByGroup).sort();
  const qualifiers: Array<{ seed: string; teamName: string; teamId: string; rank: number; pts: number; dif: number }> = [];

  for (const group of groups) {
    const shortG = group.replace('Grupo ', '');
    const rows = standingsByGroup[group] ?? [];
    for (let i = 0; i < Math.min(clasificadosPorGrupo, rows.length); i++) {
      qualifiers.push({
        seed: `${i + 1}° ${shortG}`,
        teamName: rows[i].teamName,
        teamId: rows[i].teamId,
        rank: i + 1,
        pts: rows[i].puntos,
        dif: rows[i].diferencia,
      });
    }
  }

  // Sort qualifiers by rank first (all 1st places, then 2nd places, etc.), then points & diff
  qualifiers.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (b.pts !== a.pts) return b.pts - a.pts;
    return b.dif - a.dif;
  });

  const bracketSize = formatoPlayoff;
  const roundLabel: PlayoffMatchup['round'] =
    bracketSize === 16 ? 'Octavos' : bracketSize === 8 ? 'Cuartos' : 'Semifinal';

  const seeded = qualifiers.slice(0, bracketSize);
  const matchups: PlayoffMatchup[] = [];
  const pairs = bracketSize / 2;

  for (let i = 0; i < pairs; i++) {
    const top = seeded[i];
    const bottom = seeded[bracketSize - 1 - i];
    matchups.push({
      id: `po-${roundLabel.toLowerCase()}-${i + 1}`,
      round: roundLabel,
      slot: i + 1,
      homeSeed: top ? top.seed : `Clasif. #${i + 1}`,
      awaySeed: bottom ? bottom.seed : `Clasif. #${bracketSize - i}`,
      homeTeamName: top ? top.teamName : 'Por definir',
      awayTeamName: bottom ? bottom.teamName : 'Por definir',
      homeTeamId: top?.teamId,
      awayTeamId: bottom?.teamId,
    });
  }

  return matchups;
}

const ROUND_TITLES: Record<'Octavos' | 'Cuartos' | 'Semifinal' | 'Final', string> = {
  Octavos: 'Octavos de Final',
  Cuartos: 'Cuartos de Final',
  Semifinal: 'Semifinales',
  Final: 'Gran Final',
};

const ROUND_SINGULAR: Record<'Octavos' | 'Cuartos' | 'Semifinal' | 'Final', string> = {
  Octavos: 'Octavo',
  Cuartos: 'Cuarto',
  Semifinal: 'Semifinal',
  Final: 'Final',
};

function getRoundSequence(formatoPlayoff: 4 | 8 | 16): Array<'Octavos' | 'Cuartos' | 'Semifinal' | 'Final'> {
  if (formatoPlayoff === 16) return ['Octavos', 'Cuartos', 'Semifinal', 'Final'];
  if (formatoPlayoff === 8) return ['Cuartos', 'Semifinal', 'Final'];
  return ['Semifinal', 'Final'];
}

function getScoreForTeamInMatch(match: Match, teamId?: string): number | undefined {
  if (!teamId) return undefined;
  if (match.homeTeamId === teamId) return match.homeScore;
  if (match.awayTeamId === teamId) return match.awayScore;
  return undefined;
}

function resolveSlotOutcome(
  slot: PlayoffBracketSlot,
  teamMap: Map<string, Pick<Team, 'nombre'>>
): PlayoffBracketSlot {
  if (!slot.match) return slot;
  const m = slot.match;
  const homeTeamId = m.homeTeamId || slot.homeTeamId;
  const awayTeamId = m.awayTeamId || slot.awayTeamId;
  const homeTeamName =
    (homeTeamId ? teamMap.get(homeTeamId)?.nombre : undefined) ?? slot.homeTeamName;
  const awayTeamName =
    (awayTeamId ? teamMap.get(awayTeamId)?.nombre : undefined) ?? slot.awayTeamName;

  const swappedSides =
    Boolean(slot.homeTeamId && m.awayTeamId === slot.homeTeamId) ||
    Boolean(slot.awayTeamId && m.homeTeamId === slot.awayTeamId);
  const homeSeed = swappedSides ? slot.awaySeed : slot.homeSeed;
  const awaySeed = swappedSides ? slot.homeSeed : slot.awaySeed;

  let winnerSide: 'home' | 'away' | null = null;
  if (m.status === 'FINALIZADO' && m.homeScore !== m.awayScore) {
    winnerSide = m.homeScore > m.awayScore ? 'home' : 'away';
  }

  return {
    ...slot,
    isTwoLegged: false,
    homeSeed,
    awaySeed,
    homeTeamId,
    awayTeamId,
    homeTeamName,
    awayTeamName,
    homeScore: m.status === 'PROGRAMADO' ? undefined : m.homeScore,
    awayScore: m.status === 'PROGRAMADO' ? undefined : m.awayScore,
    winnerSide,
    status: m.status,
  };
}

function resolveTwoLeggedSlotOutcome(
  slot: PlayoffBracketSlot,
  legMatches: Match[],
  teamMap: Map<string, Pick<Team, 'nombre'>>
): PlayoffBracketSlot {
  if (legMatches.length === 0) {
    return { ...slot, isTwoLegged: true };
  }

  let firstLegMatch: Match | undefined;
  let secondLegMatch: Match | undefined;

  if (legMatches.length === 1) {
    const only = legMatches[0];
    if (only.playoffLeg === 'VUELTA') {
      secondLegMatch = only;
    } else {
      firstLegMatch = only;
    }
  } else {
    const explicitIda = legMatches.find((m) => m.playoffLeg === 'IDA');
    const explicitVuelta = legMatches.find((m) => m.playoffLeg === 'VUELTA' && m.id !== explicitIda?.id);
    if (explicitIda || explicitVuelta) {
      firstLegMatch = explicitIda ?? legMatches.find((m) => m.id !== explicitVuelta?.id);
      secondLegMatch = explicitVuelta ?? legMatches.find((m) => m.id !== firstLegMatch?.id);
    } else {
      firstLegMatch = legMatches[0];
      secondLegMatch = legMatches[1];
    }
  }

  const refMatch = firstLegMatch ?? secondLegMatch!;
  // Preserve seeded slot orientation if known; otherwise inherit from Ida (or available leg)
  const homeTeamId = slot.homeTeamId ?? refMatch.homeTeamId;
  const awayTeamId =
    slot.awayTeamId ??
    (refMatch.homeTeamId === homeTeamId ? refMatch.awayTeamId : refMatch.homeTeamId);

  const homeTeamName =
    (homeTeamId ? teamMap.get(homeTeamId)?.nombre : undefined) ?? slot.homeTeamName;
  const awayTeamName =
    (awayTeamId ? teamMap.get(awayTeamId)?.nombre : undefined) ?? slot.awayTeamName;

  const leg1Played = Boolean(firstLegMatch && firstLegMatch.status !== 'PROGRAMADO');
  const leg2Played = Boolean(secondLegMatch && secondLegMatch.status !== 'PROGRAMADO');

  const homeFirstLegScore =
    leg1Played && firstLegMatch ? getScoreForTeamInMatch(firstLegMatch, homeTeamId) : undefined;
  const awayFirstLegScore =
    leg1Played && firstLegMatch ? getScoreForTeamInMatch(firstLegMatch, awayTeamId) : undefined;

  const homeSecondLegScore =
    leg2Played && secondLegMatch ? getScoreForTeamInMatch(secondLegMatch, homeTeamId) : undefined;
  const awaySecondLegScore =
    leg2Played && secondLegMatch ? getScoreForTeamInMatch(secondLegMatch, awayTeamId) : undefined;

  const hasAnyScore = homeFirstLegScore !== undefined || homeSecondLegScore !== undefined;
  const aggHome = hasAnyScore
    ? (homeFirstLegScore ?? 0) + (homeSecondLegScore ?? 0)
    : undefined;
  const aggAway = hasAnyScore
    ? (awayFirstLegScore ?? 0) + (awaySecondLegScore ?? 0)
    : undefined;

  const isSingleUnicoMatch =
    legMatches.length === 1 && legMatches[0].playoffLeg === 'UNICO';
  const bothLegsFinalized =
    Boolean(firstLegMatch && secondLegMatch) &&
    firstLegMatch!.status === 'FINALIZADO' &&
    secondLegMatch!.status === 'FINALIZADO';

  let status: PlayoffBracketSlot['status'] = 'PROGRAMADO';
  if (firstLegMatch?.status === 'EN_VIVO' || secondLegMatch?.status === 'EN_VIVO') {
    status = 'EN_VIVO';
  } else if (bothLegsFinalized || (isSingleUnicoMatch && refMatch.status === 'FINALIZADO')) {
    status = 'FINALIZADO';
  }

  let winnerSide: 'home' | 'away' | null = null;
  let isAggregateDraw = false;

  if (status === 'FINALIZADO' && aggHome !== undefined && aggAway !== undefined) {
    if (aggHome > aggAway) {
      winnerSide = 'home';
    } else if (aggAway > aggHome) {
      winnerSide = 'away';
    } else {
      isAggregateDraw = true;
    }
  }

  return {
    ...slot,
    isTwoLegged: true,
    match: secondLegMatch ?? firstLegMatch,
    firstLegMatch,
    secondLegMatch,
    homeTeamId,
    awayTeamId,
    homeTeamName,
    awayTeamName,
    homeFirstLegScore,
    awayFirstLegScore,
    homeSecondLegScore,
    awaySecondLegScore,
    homeScore: aggHome,
    awayScore: aggAway,
    isAggregateDraw,
    winnerSide,
    status,
  };
}

function getSlotWinner(slot: PlayoffBracketSlot): { teamId?: string; teamName: string } | null {
  if (slot.winnerSide === 'home') {
    return { teamId: slot.homeTeamId, teamName: slot.homeTeamName };
  }
  if (slot.winnerSide === 'away') {
    return { teamId: slot.awayTeamId, teamName: slot.awayTeamName };
  }
  return null;
}

function getSlotLoser(slot: PlayoffBracketSlot): { teamId?: string; teamName: string } | null {
  if (slot.winnerSide === 'home') {
    return { teamId: slot.awayTeamId, teamName: slot.awayTeamName };
  }
  if (slot.winnerSide === 'away') {
    return { teamId: slot.homeTeamId, teamName: slot.homeTeamName };
  }
  return null;
}

function getUnorderedPairKey(homeTeamId: string, awayTeamId: string): string {
  return homeTeamId < awayTeamId ? `${homeTeamId}|${awayTeamId}` : `${awayTeamId}|${homeTeamId}`;
}

function normalizeSortableDate(fecha: string): string {
  const trimmed = fecha.trim();
  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  }
  return trimmed;
}

function attachMatchesToSlots(
  slots: PlayoffBracketSlot[],
  phaseMatches: Match[],
  teamMap: Map<string, Pick<Team, 'nombre'>>,
  isTwoLegged = false
): PlayoffBracketSlot[] {
  const usedMatchIds = new Set<string>();
  const sortedPhaseMatches = [...phaseMatches].sort((a, b) => {
    const keyA = `${normalizeSortableDate(a.fecha)}-${a.hora}-${String(a.jornada).padStart(2, '0')}-${a.id}`;
    const keyB = `${normalizeSortableDate(b.fecha)}-${b.hora}-${String(b.jornada).padStart(2, '0')}-${b.id}`;
    return keyA.localeCompare(keyB);
  });

  if (!isTwoLegged) {
    // Single-leg attachment (existing behavior)
    const matchedFirstPass = slots.map((slot) => {
      if (!slot.homeTeamId || !slot.awayTeamId) return slot;
      const found = sortedPhaseMatches.find(
        (m) =>
          !usedMatchIds.has(m.id) &&
          ((m.homeTeamId === slot.homeTeamId && m.awayTeamId === slot.awayTeamId) ||
            (m.homeTeamId === slot.awayTeamId && m.awayTeamId === slot.homeTeamId))
      );
      if (!found) return slot;
      usedMatchIds.add(found.id);
      return resolveSlotOutcome({ ...slot, match: found }, teamMap);
    });

    const matchedSecondPass = matchedFirstPass.map((slot) => {
      if (slot.match) return slot;
      if (!slot.homeTeamId && !slot.awayTeamId) return slot;
      const found = sortedPhaseMatches.find(
        (m) =>
          !usedMatchIds.has(m.id) &&
          ((slot.homeTeamId && (m.homeTeamId === slot.homeTeamId || m.awayTeamId === slot.homeTeamId)) ||
            (slot.awayTeamId && (m.homeTeamId === slot.awayTeamId || m.awayTeamId === slot.awayTeamId)))
      );
      if (!found) return slot;
      usedMatchIds.add(found.id);
      return resolveSlotOutcome({ ...slot, match: found }, teamMap);
    });

    const remainingMatches = sortedPhaseMatches.filter((m) => !usedMatchIds.has(m.id));
    let remIdx = 0;
    return matchedSecondPass.map((slot) => {
      if (slot.match) return slot;
      const fallback = remainingMatches[remIdx];
      if (!fallback) return slot;
      remIdx += 1;
      usedMatchIds.add(fallback.id);
      return resolveSlotOutcome({ ...slot, match: fallback }, teamMap);
    });
  }

  // Two-legged (Ida y Vuelta) attachment: group up to 2 legs per team pair per slot
  const matchedFirstPass = slots.map((slot) => {
    if (!slot.homeTeamId || !slot.awayTeamId) return { ...slot, isTwoLegged: true };
    const foundLegs = sortedPhaseMatches
      .filter(
        (m) =>
          !usedMatchIds.has(m.id) &&
          ((m.homeTeamId === slot.homeTeamId && m.awayTeamId === slot.awayTeamId) ||
            (m.homeTeamId === slot.awayTeamId && m.awayTeamId === slot.homeTeamId))
      )
      .slice(0, 2);
    if (foundLegs.length === 0) return { ...slot, isTwoLegged: true };
    foundLegs.forEach((m) => usedMatchIds.add(m.id));
    return resolveTwoLeggedSlotOutcome(slot, foundLegs, teamMap);
  });

  const matchedSecondPass = matchedFirstPass.map((slot) => {
    if (slot.firstLegMatch || slot.secondLegMatch) return slot;
    if (!slot.homeTeamId && !slot.awayTeamId) return slot;
    const anchor = sortedPhaseMatches.find(
      (m) =>
        !usedMatchIds.has(m.id) &&
        ((slot.homeTeamId && (m.homeTeamId === slot.homeTeamId || m.awayTeamId === slot.homeTeamId)) ||
          (slot.awayTeamId && (m.homeTeamId === slot.awayTeamId || m.awayTeamId === slot.awayTeamId)))
    );
    if (!anchor) return slot;
    const key = getUnorderedPairKey(anchor.homeTeamId, anchor.awayTeamId);
    const pairLegs = sortedPhaseMatches
      .filter((m) => !usedMatchIds.has(m.id) && getUnorderedPairKey(m.homeTeamId, m.awayTeamId) === key)
      .slice(0, 2);
    pairLegs.forEach((m) => usedMatchIds.add(m.id));
    return resolveTwoLeggedSlotOutcome(slot, pairLegs, teamMap);
  });

  // Pass 3: remaining unmatched matches grouped by unordered team pair
  const remainingPairGroups: Match[][] = [];
  const pairIndexMap = new Map<string, number>();
  for (const m of sortedPhaseMatches) {
    if (usedMatchIds.has(m.id)) continue;
    const key = getUnorderedPairKey(m.homeTeamId, m.awayTeamId);
    const existingIdx = pairIndexMap.get(key);
    if (existingIdx !== undefined && remainingPairGroups[existingIdx].length < 2) {
      remainingPairGroups[existingIdx].push(m);
    } else {
      pairIndexMap.set(key, remainingPairGroups.length);
      remainingPairGroups.push([m]);
    }
  }

  let remGroupIdx = 0;
  return matchedSecondPass.map((slot) => {
    if (slot.firstLegMatch || slot.secondLegMatch) return slot;
    const fallbackGroup = remainingPairGroups[remGroupIdx];
    if (!fallbackGroup) return slot;
    remGroupIdx += 1;
    fallbackGroup.forEach((m) => usedMatchIds.add(m.id));
    return resolveTwoLeggedSlotOutcome(slot, fallbackGroup, teamMap);
  });
}

/**
 * Builds the complete multi-round playoff bracket from opening round all the way
 * to the Grand Final, plus the optional Third Place match ("Tercer Lugar").
 * Supports both single-leg elimination and two-legged (Ida y Vuelta) aggregate ties.
 */
export function buildFullPlayoffTree(params: {
  standingsByGroup: Record<string, StandingsRow[]>;
  clasificadosPorGrupo: number;
  formatoPlayoff: 4 | 8 | 16;
  incluyeTercerLugar?: boolean;
  playoffsIdaYVuelta?: boolean;
  disciplineMatches: Match[];
  teamMap: Map<string, Pick<Team, 'nombre'>>;
}): FullPlayoffBracket {
  const {
    standingsByGroup,
    clasificadosPorGrupo,
    formatoPlayoff,
    incluyeTercerLugar = true,
    playoffsIdaYVuelta = false,
    disciplineMatches,
    teamMap,
  } = params;

  const sequence = getRoundSequence(formatoPlayoff);
  const openingMatchups = generatePlayoffBracket(
    standingsByGroup,
    clasificadosPorGrupo,
    formatoPlayoff
  );

  const matchesByPhase = new Map<Match['fase'], Match[]>();
  for (const m of disciplineMatches) {
    const existing = matchesByPhase.get(m.fase) ?? [];
    existing.push(m);
    matchesByPhase.set(m.fase, existing);
  }

  const rounds: PlayoffRoundColumn[] = [];

  for (let rIdx = 0; rIdx < sequence.length; rIdx++) {
    const round = sequence[rIdx];
    let baseSlots: PlayoffBracketSlot[];

    if (rIdx === 0) {
      baseSlots = openingMatchups.map((m) => ({
        ...m,
        isTwoLegged: playoffsIdaYVuelta,
        winnerSide: null,
        status: 'PROYECTADO',
      }));
    } else {
      const prevColumn = rounds[rIdx - 1];
      const prevSingular = ROUND_SINGULAR[prevColumn.round];
      const pairCount = Math.max(1, Math.floor(prevColumn.slots.length / 2));
      baseSlots = [];

      for (let i = 0; i < pairCount; i++) {
        const leftPrev = prevColumn.slots[i * 2];
        const rightPrev = prevColumn.slots[i * 2 + 1];
        const leftWinner = leftPrev ? getSlotWinner(leftPrev) : null;
        const rightWinner = rightPrev ? getSlotWinner(rightPrev) : null;

        const leftLabel = `Ganador ${prevSingular} ${i * 2 + 1}`;
        const rightLabel = `Ganador ${prevSingular} ${i * 2 + 2}`;

        baseSlots.push({
          id: `po-${round.toLowerCase()}-${i + 1}`,
          round,
          slot: i + 1,
          isTwoLegged: playoffsIdaYVuelta,
          homeSeed: leftLabel,
          awaySeed: rightLabel,
          homeTeamName: leftWinner ? leftWinner.teamName : leftLabel,
          awayTeamName: rightWinner ? rightWinner.teamName : rightLabel,
          homeTeamId: leftWinner?.teamId,
          awayTeamId: rightWinner?.teamId,
          winnerSide: null,
          status: 'PROYECTADO',
        });
      }
    }

    const resolvedSlots = attachMatchesToSlots(
      baseSlots,
      matchesByPhase.get(round) ?? [],
      teamMap,
      playoffsIdaYVuelta
    );

    rounds.push({
      round,
      title: ROUND_TITLES[round],
      slots: resolvedSlots,
    });
  }

  // Third place match (losers of Semifinals — single match unless 2 legs are explicitly scheduled)
  let thirdPlace: PlayoffBracketSlot | null = null;
  if (incluyeTercerLugar) {
    const semiColumn = rounds.find((r) => r.round === 'Semifinal');
    const semi1 = semiColumn?.slots[0];
    const semi2 = semiColumn?.slots[1];
    const semi1Loser = semi1 ? getSlotLoser(semi1) : null;
    const semi2Loser = semi2 ? getSlotLoser(semi2) : null;
    const thirdMatches = matchesByPhase.get('Tercer Lugar') ?? [];
    const thirdIsTwoLegged =
      thirdMatches.length >= 2 ||
      thirdMatches.some((m) => m.playoffLeg === 'IDA' || m.playoffLeg === 'VUELTA');

    const baseThird: PlayoffBracketSlot = {
      id: 'po-tercer-lugar-1',
      round: 'Tercer Lugar',
      slot: 1,
      isTwoLegged: thirdIsTwoLegged,
      homeSeed: 'Perdedor Semifinal 1',
      awaySeed: 'Perdedor Semifinal 2',
      homeTeamName: semi1Loser ? semi1Loser.teamName : 'Perdedor Semifinal 1',
      awayTeamName: semi2Loser ? semi2Loser.teamName : 'Perdedor Semifinal 2',
      homeTeamId: semi1Loser?.teamId,
      awayTeamId: semi2Loser?.teamId,
      winnerSide: null,
      status: 'PROYECTADO',
    };

    const [resolvedThird] = attachMatchesToSlots(
      [baseThird],
      thirdMatches,
      teamMap,
      thirdIsTwoLegged
    );
    thirdPlace = resolvedThird;
  }

  const finalSlot = rounds[rounds.length - 1]?.slots[0];
  const champion = finalSlot ? getSlotWinner(finalSlot) : null;
  const thirdWinner = thirdPlace ? getSlotWinner(thirdPlace) : null;

  return {
    rounds,
    thirdPlace,
    isTwoLegged: playoffsIdaYVuelta,
    championName: champion?.teamName,
    thirdPlaceWinnerName: thirdWinner?.teamName,
  };
}

/**
 * Validates whether a post-group-stage player transfer complies with tournament regulations.
 */
export function validateTransferEligibility(params: {
  config: DisciplineFormatConfig;
  player: Player;
  fromTeam: Team;
  toTeam: Team;
  existingTransfers: TransferRecord[];
  toTeamPlayers: Player[];
  maxSeleccionadosPorEquipo: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!params.config.transferenciasAbiertas) {
    errors.push('La ventana de transferencias post-fase de grupos está cerrada para esta disciplina.');
  }
  if (params.fromTeam.id === params.toTeam.id) {
    errors.push('El equipo de origen y el equipo de destino deben ser distintos.');
  }
  if (params.fromTeam.disciplineId !== params.toTeam.disciplineId) {
    errors.push('Las transferencias solo están permitidas dentro de la misma disciplina y división.');
  }

  const incomingCount = params.existingTransfers.filter(
    (t) => t.toTeamId === params.toTeam.id && t.estado === 'APROBADA'
  ).length;
  if (incomingCount >= params.config.maxTransferenciasPorEquipo) {
    errors.push(
      `${params.toTeam.nombre} ya alcanzó el máximo de ${params.config.maxTransferenciasPorEquipo} refuerzos permitidos.`
    );
  }

  const alreadyTransferred = params.existingTransfers.some(
    (t) => t.playerId === params.player.id && t.estado === 'APROBADA'
  );
  if (alreadyTransferred) {
    errors.push('Este estudiante ya realizó una transferencia oficial en esta temporada.');
  }

  if (params.player.esSeleccionadoUfro) {
    const currentSelected = params.toTeamPlayers.filter((p) => p.esSeleccionadoUfro).length;
    if (currentSelected >= params.maxSeleccionadosPorEquipo) {
      errors.push(
        `${params.toTeam.nombre} ya cuenta con el máximo de ${params.maxSeleccionadosPorEquipo} seleccionados UFRO en su nómina.`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Compares live scoreboard values with AI-extracted scoresheet data to flag discrepancies.
 */
export function compareScoresheetWithLive(
  liveMatch: Pick<Match, 'homeScore' | 'awayScore'>,
  aiResult: AiScoresheetResult
): {
  matchesLive: boolean;
  discrepancies: string[];
  requiresManualReview: boolean;
} {
  const discrepancies = [...aiResult.discrepancies];

  if (aiResult.homeScoreDetected !== liveMatch.homeScore) {
    discrepancies.push(
      `Puntaje local difiere: marcador en vivo (${liveMatch.homeScore}) vs planilla detectada (${aiResult.homeScoreDetected}).`
    );
  }
  if (aiResult.awayScoreDetected !== liveMatch.awayScore) {
    discrepancies.push(
      `Puntaje visitante difiere: marcador en vivo (${liveMatch.awayScore}) vs planilla detectada (${aiResult.awayScoreDetected}).`
    );
  }

  const matchesLive =
    aiResult.homeScoreDetected === liveMatch.homeScore &&
    aiResult.awayScoreDetected === liveMatch.awayScore;
  const requiresManualReview =
    !matchesLive || aiResult.confidence !== 'alta' || aiResult.requiresManualReview || discrepancies.length > 0;

  return {
    matchesLive,
    discrepancies: Array.from(new Set(discrepancies)),
    requiresManualReview,
  };
}

/**
 * Evaluates whether a Volleyball set has been won (25 pts with >= 2 pt lead, or 15 in deciding set).
 */
export function isVolleyballSetWon(homePts: number, awayPts: number, setNumber: number): 'home' | 'away' | null {
  const target = setNumber >= 3 ? 15 : 25;
  if (homePts >= target && homePts - awayPts >= 2) return 'home';
  if (awayPts >= target && awayPts - homePts >= 2) return 'away';
  return null;
}

export type TeamMatchOutcome = 'G' | 'E' | 'P' | 'EN_VIVO' | 'PROGRAMADO';

export interface TeamHistoryMatchItem {
  match: Match;
  isHome: boolean;
  opponentTeamId: string;
  teamScore: number;
  opponentScore: number;
  outcome: TeamMatchOutcome;
}

export interface TeamHistoricalStats {
  teamId: string;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  favor: number;
  contra: number;
  diferencia: number;
  setsFavor?: number;
  setsContra?: number;
  puntos: number;
  winRatePct: number;
  racha: ('G' | 'E' | 'P')[];
  history: TeamHistoryMatchItem[];
}

const PHASE_SORT_RANK: Record<MatchPhase, number> = {
  Grupos: 0,
  Octavos: 1,
  Cuartos: 2,
  Semifinal: 3,
  'Tercer Lugar': 4,
  Final: 5,
};

const SHORT_MONTHS_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

function normalizeHoraSortable(hora: string | undefined | null): string {
  const raw = (hora ?? '').trim();
  const match = /^(\d{1,2}):(\d{2})/.exec(raw);
  if (!match) return '99:99';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function formatShortDateEs(dateIso: string | null, fallback: string): string {
  if (!dateIso) return fallback;
  const parts = dateIso.split('-');
  if (parts.length !== 3) return fallback;
  const monthIdx = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  if (monthIdx < 0 || monthIdx > 11 || !Number.isFinite(day) || day < 1) return fallback;
  return `${String(day).padStart(2, '0')} ${SHORT_MONTHS_ES[monthIdx]}`;
}

/**
 * Compares two matches in true chronological ascending order (oldest -> newest).
 * Normalizes ISO, Chilean DD/MM/YYYY, DD-MM-YYYY, and Spanish textual dates so
 * day-first strings never sort out of order. Undated matches fall back to phase + jornada.
 */
export function compareMatchesByDateAsc(a: Match, b: Match): number {
  const isoA = normalizeMatchDateToIso(a.fecha);
  const isoB = normalizeMatchDateToIso(b.fecha);

  if (isoA && isoB) {
    if (isoA !== isoB) return isoA.localeCompare(isoB);
    const timeA = normalizeHoraSortable(a.hora);
    const timeB = normalizeHoraSortable(b.hora);
    if (timeA !== timeB) return timeA.localeCompare(timeB);
  } else if (isoA && !isoB) {
    return -1;
  } else if (!isoA && isoB) {
    return 1;
  }

  const phaseA = PHASE_SORT_RANK[a.fase] ?? 99;
  const phaseB = PHASE_SORT_RANK[b.fase] ?? 99;
  if (phaseA !== phaseB) return phaseA - phaseB;
  if (a.jornada !== b.jornada) return a.jornada - b.jornada;
  return a.id.localeCompare(b.id);
}

/**
 * Computes complete historical match list and aggregate performance statistics for a single team
 * across ALL phases (Grupos + Playoffs).
 */
export function computeTeamHistoricalStats(
  team: Team,
  sportType: SportType,
  allMatches: Match[]
): TeamHistoricalStats {
  const teamMatches = allMatches
    .filter((m) => m.homeTeamId === team.id || m.awayTeamId === team.id)
    .sort((a, b) => compareMatchesByDateAsc(b, a));

  let pj = 0;
  let pg = 0;
  let pe = 0;
  let pp = 0;
  let favor = 0;
  let contra = 0;
  let setsFavor = 0;
  let setsContra = 0;
  let puntos = 0;
  const rachaChronological: ('G' | 'E' | 'P')[] = [];

  // Process chronologically for accurate streak (racha)
  const chronological = [...teamMatches].reverse();
  const outcomeByMatchId = new Map<string, TeamMatchOutcome>();

  for (const match of chronological) {
    const isHome = match.homeTeamId === team.id;
    const teamScore = isHome ? match.homeScore : match.awayScore;
    const opponentScore = isHome ? match.awayScore : match.homeScore;

    if (match.status === 'PROGRAMADO') {
      outcomeByMatchId.set(match.id, 'PROGRAMADO');
      continue;
    }

    if (match.status === 'EN_VIVO') {
      outcomeByMatchId.set(match.id, 'EN_VIVO');
      continue;
    }

    // FINALIZADO: counts in full historical stats
    pj += 1;

    if (sportType === 'voleibol') {
      setsFavor += teamScore;
      setsContra += opponentScore;
      const homePts = match.periods.reduce((acc, p) => acc + p.home, 0);
      const awayPts = match.periods.reduce((acc, p) => acc + p.away, 0);
      const teamPts = isHome ? homePts : awayPts;
      const oppPts = isHome ? awayPts : homePts;
      favor += teamPts || teamScore * 25;
      contra += oppPts || opponentScore * 25;

      if (teamScore > opponentScore) {
        pg += 1;
        const isTiebreak = teamScore - opponentScore === 1 && opponentScore >= 1;
        puntos += isTiebreak ? 2 : 3;
        rachaChronological.push('G');
        outcomeByMatchId.set(match.id, 'G');
      } else if (opponentScore > teamScore) {
        pp += 1;
        const isTiebreak = opponentScore - teamScore === 1 && teamScore >= 1;
        puntos += isTiebreak ? 1 : 0;
        rachaChronological.push('P');
        outcomeByMatchId.set(match.id, 'P');
      } else {
        pe += 1;
        rachaChronological.push('E');
        outcomeByMatchId.set(match.id, 'E');
      }
    } else if (sportType === 'basquetbol' || sportType === 'basquetbol3x3') {
      favor += teamScore;
      contra += opponentScore;
      if (teamScore > opponentScore) {
        pg += 1;
        puntos += 2;
        rachaChronological.push('G');
        outcomeByMatchId.set(match.id, 'G');
      } else if (opponentScore > teamScore) {
        pp += 1;
        puntos += 1;
        rachaChronological.push('P');
        outcomeByMatchId.set(match.id, 'P');
      } else {
        pe += 1;
        puntos += 1;
        rachaChronological.push('E');
        outcomeByMatchId.set(match.id, 'E');
      }
    } else {
      favor += teamScore;
      contra += opponentScore;
      if (teamScore > opponentScore) {
        pg += 1;
        puntos += 3;
        rachaChronological.push('G');
        outcomeByMatchId.set(match.id, 'G');
      } else if (opponentScore > teamScore) {
        pp += 1;
        rachaChronological.push('P');
        outcomeByMatchId.set(match.id, 'P');
      } else {
        pe += 1;
        puntos += 1;
        rachaChronological.push('E');
        outcomeByMatchId.set(match.id, 'E');
      }
    }
  }

  const history: TeamHistoryMatchItem[] = teamMatches.map((match) => {
    const isHome = match.homeTeamId === team.id;
    return {
      match,
      isHome,
      opponentTeamId: isHome ? match.awayTeamId : match.homeTeamId,
      teamScore: isHome ? match.homeScore : match.awayScore,
      opponentScore: isHome ? match.awayScore : match.homeScore,
      outcome: outcomeByMatchId.get(match.id) ?? 'PROGRAMADO',
    };
  });

  return {
    teamId: team.id,
    pj,
    pg,
    pe,
    pp,
    favor,
    contra,
    diferencia: sportType === 'voleibol' ? setsFavor - setsContra : favor - contra,
    setsFavor: sportType === 'voleibol' ? setsFavor : undefined,
    setsContra: sportType === 'voleibol' ? setsContra : undefined,
    puntos,
    winRatePct: pj > 0 ? Math.round((pg / pj) * 100) : 0,
    racha: rachaChronological.slice(-5),
    history,
  };
}

export interface TeamProgressionPoint {
  matchId: string;
  index: number;
  label: string;
  fullLabel: string;
  fecha: string;
  dateIso: string | null;
  shortDate: string;
  fase: Match['fase'];
  jornada: number;
  opponentId: string;
  opponentName: string;
  opponentSigla: string;
  isHome: boolean;
  outcome: 'G' | 'E' | 'P';
  favor: number;
  contra: number;
  diferencia: number;
  acumuladoFavor: number;
  acumuladoContra: number;
  acumuladoDiferencia: number;
  periodPointsFavor?: number;
  periodPointsContra?: number;
}

export interface TeamMatchExtremeRecord {
  matchId: string;
  opponentId: string;
  opponentName: string;
  opponentSigla: string;
  favor: number;
  contra: number;
  diferencia: number;
  fecha: string;
  dateIso: string | null;
  shortDate: string;
  fullLabel: string;
  isHome: boolean;
  outcome: 'G' | 'E' | 'P';
  periodPointsFavor?: number;
  periodPointsContra?: number;
}

export interface TeamScoringExtremes {
  /** Largest margin victory inflicted by this team (diferencia > 0) */
  biggestWin: TeamMatchExtremeRecord | null;
  /** Single match where this team scored the most goals/points/sets (favor > 0) */
  mostScoredMatch: TeamMatchExtremeRecord | null;
  /** Largest margin defeat suffered by this team (diferencia < 0) */
  worstDefeat: TeamMatchExtremeRecord | null;
  /** Single match where an opponent scored the most goals/points/sets against this team (contra > 0) */
  mostConcededMatch: TeamMatchExtremeRecord | null;
}

/**
 * Computes chronological match-by-match and cumulative progression of goals/points/sets
 * scored (a favor) vs conceded (en contra) across all finalized matches for a team.
 */
export function computeTeamMatchProgression(
  team: Team,
  allMatches: Match[],
  teamLookup?: Map<string, Pick<Team, 'nombre' | 'sigla'>>
): TeamProgressionPoint[] {
  const finishedMatches = allMatches
    .filter(
      (m) =>
        m.status === 'FINALIZADO' &&
        (m.homeTeamId === team.id || m.awayTeamId === team.id)
    )
    .sort(compareMatchesByDateAsc);

  let acumuladoFavor = 0;
  let acumuladoContra = 0;

  return finishedMatches.map((match, idx) => {
    const isHome = match.homeTeamId === team.id;
    const opponentId = isHome ? match.awayTeamId : match.homeTeamId;
    const opponentInfo = teamLookup?.get(opponentId);
    const favor = isHome ? match.homeScore : match.awayScore;
    const contra = isHome ? match.awayScore : match.homeScore;
    const diferencia = favor - contra;

    const hasPeriodScores = match.periods.length > 0;
    const homePeriodPts = hasPeriodScores
      ? match.periods.reduce((acc, p) => acc + p.home, 0)
      : 0;
    const awayPeriodPts = hasPeriodScores
      ? match.periods.reduce((acc, p) => acc + p.away, 0)
      : 0;
    const periodPointsFavor =
      hasPeriodScores && (homePeriodPts > 0 || awayPeriodPts > 0)
        ? isHome
          ? homePeriodPts
          : awayPeriodPts
        : undefined;
    const periodPointsContra =
      hasPeriodScores && (homePeriodPts > 0 || awayPeriodPts > 0)
        ? isHome
          ? awayPeriodPts
          : homePeriodPts
        : undefined;

    acumuladoFavor += favor;
    acumuladoContra += contra;

    const outcome: 'G' | 'E' | 'P' =
      favor > contra ? 'G' : favor < contra ? 'P' : 'E';

    const shortPhaseLabel =
      match.fase === 'Grupos'
        ? `F${match.jornada}`
        : match.fase === 'Octavos'
        ? '8vos'
        : match.fase === 'Cuartos'
        ? '4tos'
        : match.fase === 'Semifinal'
        ? 'Semi'
        : match.fase === 'Tercer Lugar'
        ? '3° Lugar'
        : 'Final';

    const dateIso = normalizeMatchDateToIso(match.fecha);
    const shortDate = formatShortDateEs(dateIso, shortPhaseLabel);

    return {
      matchId: match.id,
      index: idx + 1,
      label: shortPhaseLabel,
      fullLabel:
        match.fase === 'Grupos'
          ? `Fecha ${match.jornada} · ${match.groupName}`
          : `${match.fase} · Jornada ${match.jornada}`,
      fecha: match.fecha,
      dateIso,
      shortDate,
      fase: match.fase,
      jornada: match.jornada,
      opponentId,
      opponentName: opponentInfo?.nombre ?? opponentId,
      opponentSigla: opponentInfo?.sigla ?? opponentId.slice(0, 3).toUpperCase(),
      isHome,
      outcome,
      favor,
      contra,
      diferencia,
      acumuladoFavor,
      acumuladoContra,
      acumuladoDiferencia: acumuladoFavor - acumuladoContra,
      periodPointsFavor,
      periodPointsContra,
    };
  });
}

function toExtremeRecord(p: TeamProgressionPoint): TeamMatchExtremeRecord {
  return {
    matchId: p.matchId,
    opponentId: p.opponentId,
    opponentName: p.opponentName,
    opponentSigla: p.opponentSigla,
    favor: p.favor,
    contra: p.contra,
    diferencia: p.diferencia,
    fecha: p.fecha,
    dateIso: p.dateIso,
    shortDate: p.shortDate,
    fullLabel: p.fullLabel,
    isHome: p.isHome,
    outcome: p.outcome,
    periodPointsFavor: p.periodPointsFavor,
    periodPointsContra: p.periodPointsContra,
  };
}

/**
 * Extracts a team's biggest thrashing/win inflicted, highest-scoring match,
 * worst defeat suffered, and highest-conceded match from its progression series.
 */
export function computeTeamScoringExtremes(
  progression: TeamProgressionPoint[],
  sportType: SportType
): TeamScoringExtremes {
  if (progression.length === 0) {
    return {
      biggestWin: null,
      mostScoredMatch: null,
      worstDefeat: null,
      mostConcededMatch: null,
    };
  }

  let bestWin: TeamProgressionPoint | null = null;
  let bestScored: TeamProgressionPoint | null = null;
  let worstLoss: TeamProgressionPoint | null = null;
  let worstConceded: TeamProgressionPoint | null = null;

  const isVolley = sportType === 'voleibol';

  for (const p of progression) {
    // 1. Biggest win (strictly positive margin)
    if (p.diferencia > 0) {
      if (!bestWin) {
        bestWin = p;
      } else {
        const diffDelta = p.diferencia - bestWin.diferencia;
        const pVolleyDiff = (p.periodPointsFavor ?? 0) - (p.periodPointsContra ?? 0);
        const bVolleyDiff = (bestWin.periodPointsFavor ?? 0) - (bestWin.periodPointsContra ?? 0);
        if (
          diffDelta > 0 ||
          (diffDelta === 0 && isVolley && pVolleyDiff > bVolleyDiff) ||
          (diffDelta === 0 &&
            (!isVolley || pVolleyDiff === bVolleyDiff) &&
            (p.favor > bestWin.favor || (p.favor === bestWin.favor && p.index > bestWin.index)))
        ) {
          bestWin = p;
        }
      }
    }

    // 2. Most goals/points/sets scored in a single match
    if (p.favor > 0) {
      if (!bestScored) {
        bestScored = p;
      } else {
        const pPts = isVolley ? p.periodPointsFavor ?? p.favor : p.favor;
        const bPts = isVolley ? bestScored.periodPointsFavor ?? bestScored.favor : bestScored.favor;
        const primaryDelta = isVolley ? pPts - bPts : p.favor - bestScored.favor;
        if (
          primaryDelta > 0 ||
          (primaryDelta === 0 &&
            (p.diferencia > bestScored.diferencia ||
              (p.diferencia === bestScored.diferencia && p.index > bestScored.index)))
        ) {
          bestScored = p;
        }
      }
    }

    // 3. Worst defeat (strictly negative margin)
    if (p.diferencia < 0) {
      if (!worstLoss) {
        worstLoss = p;
      } else {
        // More negative diferencia = worse defeat
        const marginWorse = p.diferencia < worstLoss.diferencia;
        const marginSame = p.diferencia === worstLoss.diferencia;
        const pVolleyDeficit = (p.periodPointsContra ?? 0) - (p.periodPointsFavor ?? 0);
        const wVolleyDeficit =
          (worstLoss.periodPointsContra ?? 0) - (worstLoss.periodPointsFavor ?? 0);
        if (
          marginWorse ||
          (marginSame && isVolley && pVolleyDeficit > wVolleyDeficit) ||
          (marginSame &&
            (!isVolley || pVolleyDeficit === wVolleyDeficit) &&
            (p.contra > worstLoss.contra ||
              (p.contra === worstLoss.contra && p.index > worstLoss.index)))
        ) {
          worstLoss = p;
        }
      }
    }

    // 4. Most goals/points/sets conceded in a single match
    if (p.contra > 0) {
      if (!worstConceded) {
        worstConceded = p;
      } else {
        const pPts = isVolley ? p.periodPointsContra ?? p.contra : p.contra;
        const wPts = isVolley
          ? worstConceded.periodPointsContra ?? worstConceded.contra
          : worstConceded.contra;
        const primaryDelta = isVolley ? pPts - wPts : p.contra - worstConceded.contra;
        if (
          primaryDelta > 0 ||
          (primaryDelta === 0 &&
            (p.diferencia < worstConceded.diferencia ||
              (p.diferencia === worstConceded.diferencia && p.index > worstConceded.index)))
        ) {
          worstConceded = p;
        }
      }
    }
  }

  return {
    biggestWin: bestWin ? toExtremeRecord(bestWin) : null,
    mostScoredMatch: bestScored ? toExtremeRecord(bestScored) : null,
    worstDefeat: worstLoss ? toExtremeRecord(worstLoss) : null,
    mostConcededMatch: worstConceded ? toExtremeRecord(worstConceded) : null,
  };
}

