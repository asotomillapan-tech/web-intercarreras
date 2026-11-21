import type {
  AiScoresheetResult,
  DisciplineFormatConfig,
  DisciplineId,
  Match,
  Player,
  PlayoffMatchup,
  SportType,
  StandingsRow,
  Team,
  TransferRecord,
} from '../types/tournament';

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
    .sort((a, b) => {
      const aKey = `${a.fecha} ${a.hora}`;
      const bKey = `${b.fecha} ${b.hora}`;
      return bKey.localeCompare(aKey);
    });

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
    .sort((a, b) => {
      const aDateKey = `${a.fecha} ${a.hora}`;
      const bDateKey = `${b.fecha} ${b.hora}`;
      if (aDateKey !== bDateKey) return aDateKey.localeCompare(bDateKey);
      if (a.jornada !== b.jornada) return a.jornada - b.jornada;
      return a.id.localeCompare(b.id);
    });

  let acumuladoFavor = 0;
  let acumuladoContra = 0;

  return finishedMatches.map((match, idx) => {
    const isHome = match.homeTeamId === team.id;
    const opponentId = isHome ? match.awayTeamId : match.homeTeamId;
    const opponentInfo = teamLookup?.get(opponentId);
    const favor = isHome ? match.homeScore : match.awayScore;
    const contra = isHome ? match.awayScore : match.homeScore;
    const diferencia = favor - contra;

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
        : 'Final';

    return {
      matchId: match.id,
      index: idx + 1,
      label: shortPhaseLabel,
      fullLabel:
        match.fase === 'Grupos'
          ? `Fecha ${match.jornada} · ${match.groupName}`
          : `${match.fase} · Jornada ${match.jornada}`,
      fecha: match.fecha,
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
    };
  });
}

