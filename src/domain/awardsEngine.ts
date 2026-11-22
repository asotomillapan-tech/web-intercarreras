import type {
  ChampionshipMvpVoteRecord,
  DisciplineId,
  Player,
  PositionAwardVoteRecord,
  SportType,
  Team,
  TotyBallotRecord,
} from '../types/tournament';

export interface PositionCategoryMeta {
  key: string;
  label: string;
  awardTitle: string;
  shortCode: string;
  totyRow: number; // Tactical visual row (0 = back/goal, higher = attack)
  matchKeywords: string[];
}

export const SPORT_POSITIONS: Record<SportType, PositionCategoryMeta[]> = {
  futbol7: [
    {
      key: 'arquero',
      label: 'Arquero / Portero',
      awardTitle: 'Mejor Arquero',
      shortCode: 'ARQ',
      totyRow: 0,
      matchKeywords: ['arquero', 'portero', 'guardameta', 'golero', 'arq', 'gk'],
    },
    {
      key: 'defensa',
      label: 'Defensa',
      awardTitle: 'Mejor Defensa',
      shortCode: 'DEF',
      totyRow: 1,
      matchKeywords: ['defensa', 'central', 'lateral', 'zaguero', 'carrilero', 'def', 'libero'],
    },
    {
      key: 'mediocampista',
      label: 'Mediocampista',
      awardTitle: 'Mejor Mediocampista',
      shortCode: 'MED',
      totyRow: 2,
      matchKeywords: ['medio', 'volante', 'interior', 'enganche', 'contencion', 'pivote', 'med', 'mixto'],
    },
    {
      key: 'delantero',
      label: 'Delantero',
      awardTitle: 'Mejor Delantero',
      shortCode: 'DEL',
      totyRow: 3,
      matchKeywords: ['delantero', 'extremo', 'punta', 'atacante', 'ariete', 'centrodelantero', 'del'],
    },
  ],
  basquetbol: [
    {
      key: 'base',
      label: 'Base (PG)',
      awardTitle: 'Mejor Base',
      shortCode: 'PG',
      totyRow: 0,
      matchKeywords: ['base', 'armador', 'point', 'pg', 'conductor'],
    },
    {
      key: 'escolta',
      label: 'Escolta (SG)',
      awardTitle: 'Mejor Escolta',
      shortCode: 'SG',
      totyRow: 1,
      matchKeywords: ['escolta', 'shooting', 'sg', 'tirador', 'perimetral'],
    },
    {
      key: 'alero',
      label: 'Alero (SF)',
      awardTitle: 'Mejor Alero',
      shortCode: 'SF',
      totyRow: 1,
      matchKeywords: ['alero', 'small', 'sf', 'ala '],
    },
    {
      key: 'ala_pivot',
      label: 'Ala-Pívot (PF)',
      awardTitle: 'Mejor Ala-Pívot',
      shortCode: 'PF',
      totyRow: 2,
      matchKeywords: ['ala-pivot', 'ala pivot', 'alapivot', 'power', 'pf'],
    },
    {
      key: 'pivot',
      label: 'Pívot (C)',
      awardTitle: 'Mejor Pívot',
      shortCode: 'C',
      totyRow: 2,
      matchKeywords: ['pivot', 'pívot', 'centro', 'center', 'poste', 'interior'],
    },
  ],
  basquetbol3x3: [
    {
      key: 'base',
      label: 'Base / Perimetral',
      awardTitle: 'Mejor Base / Perimetral',
      shortCode: 'PER',
      totyRow: 0,
      matchKeywords: ['base', 'escolta', 'perimetral', 'guard', 'armador', 'pg', 'sg'],
    },
    {
      key: 'alero',
      label: 'Alero / Versátil',
      awardTitle: 'Mejor Alero',
      shortCode: 'ALE',
      totyRow: 1,
      matchKeywords: ['alero', 'ala', 'wing', 'sf', 'pf'],
    },
    {
      key: 'pivot',
      label: 'Pívot / Interior',
      awardTitle: 'Mejor Pívot',
      shortCode: 'PIV',
      totyRow: 2,
      matchKeywords: ['pivot', 'pívot', 'interior', 'centro', 'poste', 'center'],
    },
  ],
  voleibol: [
    {
      key: 'armador',
      label: 'Armador / Levantador',
      awardTitle: 'Mejor Armador',
      shortCode: 'ARM',
      totyRow: 0,
      matchKeywords: ['armador', 'levantador', 'colocador', 'setter', 'arm'],
    },
    {
      key: 'punta',
      label: 'Punta Receptor',
      awardTitle: 'Mejor Punta Receptor',
      shortCode: 'PTA',
      totyRow: 1,
      matchKeywords: ['punta', 'receptor', 'exterior', 'banda', 'outside', 'atacante'],
    },
    {
      key: 'central',
      label: 'Central / Bloqueador',
      awardTitle: 'Mejor Central',
      shortCode: 'CEN',
      totyRow: 2,
      matchKeywords: ['central', 'bloqueador', 'middle', 'medio'],
    },
    {
      key: 'opuesto',
      label: 'Opuesto',
      awardTitle: 'Mejor Opuesto',
      shortCode: 'OPU',
      totyRow: 1,
      matchKeywords: ['opuesto', 'opposite', 'salida'],
    },
    {
      key: 'libero',
      label: 'Líbero',
      awardTitle: 'Mejor Líbero',
      shortCode: 'LIB',
      totyRow: 0,
      matchKeywords: ['libero', 'líbero', 'defensa'],
    },
  ],
};

function normalizeStr(val: string): string {
  return val
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export interface TotyFormationSlot {
  slotKey: string;
  positionKey: string;
  label: string;
  shortCode: string;
  row: number; // Tactical visual row (0 = bottom/goal/libero, higher = top/attack/net)
  rowLabel: string;
  isLibero?: boolean;
}

export interface TotyFormationConfig {
  sportType: SportType;
  formationName: string;
  summaryText: string;
  slots: TotyFormationSlot[];
}

export const TOTY_FORMATIONS: Record<SportType, TotyFormationConfig> = {
  futbol7: {
    sportType: 'futbol7',
    formationName: 'Formación 1-2-2-2',
    summaryText: '1 Portero · 2 Defensas · 2 Mediocampistas · 2 Delanteros',
    slots: [
      {
        slotKey: 'arquero',
        positionKey: 'arquero',
        label: 'Portero',
        shortCode: 'ARQ',
        row: 0,
        rowLabel: 'Portería (1)',
      },
      {
        slotKey: 'defensa_1',
        positionKey: 'defensa',
        label: 'Defensa 1',
        shortCode: 'DEF 1',
        row: 1,
        rowLabel: 'Defensa (2)',
      },
      {
        slotKey: 'defensa_2',
        positionKey: 'defensa',
        label: 'Defensa 2',
        shortCode: 'DEF 2',
        row: 1,
        rowLabel: 'Defensa (2)',
      },
      {
        slotKey: 'mediocampista_1',
        positionKey: 'mediocampista',
        label: 'Mediocampista 1',
        shortCode: 'MED 1',
        row: 2,
        rowLabel: 'Mediocampo (2)',
      },
      {
        slotKey: 'mediocampista_2',
        positionKey: 'mediocampista',
        label: 'Mediocampista 2',
        shortCode: 'MED 2',
        row: 2,
        rowLabel: 'Mediocampo (2)',
      },
      {
        slotKey: 'delantero_1',
        positionKey: 'delantero',
        label: 'Delantero 1',
        shortCode: 'DEL 1',
        row: 3,
        rowLabel: 'Delantera (2)',
      },
      {
        slotKey: 'delantero_2',
        positionKey: 'delantero',
        label: 'Delantero 2',
        shortCode: 'DEL 2',
        row: 3,
        rowLabel: 'Delantera (2)',
      },
    ],
  },
  basquetbol: {
    sportType: 'basquetbol',
    formationName: 'Quinteto Ideal 5x5',
    summaryText: 'Base (PG) · Escolta (SG) · Alero (SF) · Ala-Pívot (PF) · Pívot (C)',
    slots: [
      {
        slotKey: 'base',
        positionKey: 'base',
        label: 'Base (PG)',
        shortCode: 'PG',
        row: 0,
        rowLabel: 'Conducción (1)',
      },
      {
        slotKey: 'escolta',
        positionKey: 'escolta',
        label: 'Escolta (SG)',
        shortCode: 'SG',
        row: 1,
        rowLabel: 'Perímetro / Alas (2)',
      },
      {
        slotKey: 'alero',
        positionKey: 'alero',
        label: 'Alero (SF)',
        shortCode: 'SF',
        row: 1,
        rowLabel: 'Perímetro / Alas (2)',
      },
      {
        slotKey: 'ala_pivot',
        positionKey: 'ala_pivot',
        label: 'Ala-Pívot (PF)',
        shortCode: 'PF',
        row: 2,
        rowLabel: 'Juego Interior (2)',
      },
      {
        slotKey: 'pivot',
        positionKey: 'pivot',
        label: 'Pívot (C)',
        shortCode: 'C',
        row: 2,
        rowLabel: 'Juego Interior (2)',
      },
    ],
  },
  basquetbol3x3: {
    sportType: 'basquetbol3x3',
    formationName: 'Trío Ideal 3x3',
    summaryText: 'Base / Perimetral · Alero / Versátil · Pívot / Interior',
    slots: [
      {
        slotKey: 'base',
        positionKey: 'base',
        label: 'Base / Perimetral',
        shortCode: 'PER',
        row: 0,
        rowLabel: 'Perímetro (1)',
      },
      {
        slotKey: 'alero',
        positionKey: 'alero',
        label: 'Alero / Versátil',
        shortCode: 'ALE',
        row: 1,
        rowLabel: 'Frente de Ataque (2)',
      },
      {
        slotKey: 'pivot',
        positionKey: 'pivot',
        label: 'Pívot / Interior',
        shortCode: 'PIV',
        row: 1,
        rowLabel: 'Frente de Ataque (2)',
      },
    ],
  },
  voleibol: {
    sportType: 'voleibol',
    formationName: 'Sexteto Titular + Líbero',
    summaryText: '1 Armador · 2 Puntas · 2 Centrales · 1 Opuesto + 1 Líbero',
    slots: [
      {
        slotKey: 'armador',
        positionKey: 'armador',
        label: 'Armador / Levantador',
        shortCode: 'ARM',
        row: 1,
        rowLabel: 'Segunda Línea (3)',
      },
      {
        slotKey: 'punta_1',
        positionKey: 'punta',
        label: 'Punta Receptor 1',
        shortCode: 'PTA 1',
        row: 2,
        rowLabel: 'Primera Línea / Red (3)',
      },
      {
        slotKey: 'punta_2',
        positionKey: 'punta',
        label: 'Punta Receptor 2',
        shortCode: 'PTA 2',
        row: 1,
        rowLabel: 'Segunda Línea (3)',
      },
      {
        slotKey: 'central_1',
        positionKey: 'central',
        label: 'Central 1',
        shortCode: 'CEN 1',
        row: 2,
        rowLabel: 'Primera Línea / Red (3)',
      },
      {
        slotKey: 'central_2',
        positionKey: 'central',
        label: 'Central 2',
        shortCode: 'CEN 2',
        row: 1,
        rowLabel: 'Segunda Línea (3)',
      },
      {
        slotKey: 'opuesto',
        positionKey: 'opuesto',
        label: 'Opuesto',
        shortCode: 'OPU',
        row: 2,
        rowLabel: 'Primera Línea / Red (3)',
      },
      {
        slotKey: 'libero',
        positionKey: 'libero',
        label: 'Líbero',
        shortCode: 'LIB',
        row: 0,
        rowLabel: 'Especialista Defensivo (+1)',
        isLibero: true,
      },
    ],
  },
};

export function getTotyFormationForSport(sportType: SportType): TotyFormationConfig {
  return TOTY_FORMATIONS[sportType] ?? TOTY_FORMATIONS.futbol7;
}

/**
 * Normalizes a saved TOTY ballot into the current formation's `slotKey -> playerId` shape:
 * - Preserves direct matches for current `slotKey`s.
 * - Migrates legacy single-position keys (e.g. `defensa` -> `defensa_1`, `punta` -> `punta_1`).
 * - Guarantees no duplicate playerId occupies two slots in the same ballot.
 */
export function normalizeTotyBallotSelections(
  rawSelections: Record<string, string> | undefined,
  sportType: SportType
): Record<string, string> {
  if (!rawSelections) return {};
  const formation = getTotyFormationForSport(sportType);
  const normalized: Record<string, string> = {};
  const usedPlayerIds = new Set<string>();

  // 1. Direct slotKey assignments first
  for (const slot of formation.slots) {
    const pid = rawSelections[slot.slotKey];
    if (typeof pid === 'string' && pid.trim() && !usedPlayerIds.has(pid.trim())) {
      normalized[slot.slotKey] = pid.trim();
      usedPlayerIds.add(pid.trim());
    }
  }

  // 2. Fallback migration from legacy positionKey (e.g., 'defensa' -> first empty defensa slot)
  for (const slot of formation.slots) {
    if (normalized[slot.slotKey]) continue;
    const legacyPid = rawSelections[slot.positionKey];
    if (
      typeof legacyPid === 'string' &&
      legacyPid.trim() &&
      !usedPlayerIds.has(legacyPid.trim())
    ) {
      normalized[slot.slotKey] = legacyPid.trim();
      usedPlayerIds.add(legacyPid.trim());
    }
  }

  return normalized;
}

export function getPositionsForSport(sportType: SportType): PositionCategoryMeta[] {
  return SPORT_POSITIONS[sportType] ?? SPORT_POSITIONS.futbol7;
}

/**
 * Matches a player's free-text `posicion` string to the canonical positionKey for their sport.
 * Checks longer/more specific keywords first (e.g., 'ala-pivot' before 'pivot' or 'alero').
 */
export function matchPlayerToPositionKey(
  playerPosicion: string,
  sportType: SportType
): string | null {
  const norm = normalizeStr(playerPosicion || '');
  if (!norm) return null;

  const categories = getPositionsForSport(sportType);

  // Exact key or label match first
  for (const cat of categories) {
    if (norm === cat.key || norm === normalizeStr(cat.label)) {
      return cat.key;
    }
  }

  // Sort keywords by length descending so 'ala-pivot' matches before 'pivot'
  const weighted: { key: string; kw: string }[] = [];
  for (const cat of categories) {
    for (const kw of cat.matchKeywords) {
      weighted.push({ key: cat.key, kw: normalizeStr(kw) });
    }
  }
  weighted.sort((a, b) => b.kw.length - a.kw.length);

  for (const item of weighted) {
    if (norm.includes(item.kw)) {
      return item.key;
    }
  }
  return null;
}

/**
 * Returns eligible players for a specific position within a discipline:
 * - `matched`: players whose `posicion` matches the positionKey.
 * - `all`: all players in the discipline (used as fallback when teams haven't standardized position names).
 */
export function getEligiblePlayersForPosition(
  disciplinePlayers: Player[],
  sportType: SportType,
  positionKey: string
): { matched: Player[]; all: Player[] } {
  const matched = disciplinePlayers.filter(
    (p) => matchPlayerToPositionKey(p.posicion, sportType) === positionKey
  );
  return {
    matched,
    all: disciplinePlayers,
  };
}

export interface RankedVoteCandidate {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  teamSigla: string;
  teamEscudo?: string;
  posicion: string;
  dorsal: number;
  votes: number;
  percentage: number;
}

/**
 * Aggregates Championship MVP votes strictly among the Admin-nominated players (up to 5).
 */
export function aggregateChampionshipMvpVotes(
  disciplineId: DisciplineId,
  nomineeIds: string[],
  votes: ChampionshipMvpVoteRecord[],
  players: Player[],
  teams: Team[]
): { totalVotes: number; candidates: RankedVoteCandidate[] } {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const uniqueNominees = Array.from(new Set(nomineeIds)).slice(0, 5);
  const nomineeSet = new Set(uniqueNominees);

  const counts = new Map<string, number>();
  uniqueNominees.forEach((id) => counts.set(id, 0));

  const discVotes = votes.filter(
    (v) => v.disciplineId === disciplineId && nomineeSet.has(v.playerId)
  );

  for (const v of discVotes) {
    counts.set(v.playerId, (counts.get(v.playerId) ?? 0) + 1);
  }

  const totalVotes = discVotes.length;

  const candidates: RankedVoteCandidate[] = uniqueNominees
    .map((pid) => {
      const player = playerMap.get(pid);
      const team = player ? teamMap.get(player.teamId) : undefined;
      const count = counts.get(pid) ?? 0;
      return {
        playerId: pid,
        playerName: player
          ? `${player.nombre} ${player.apellidoPaterno}`.trim()
          : pid,
        teamId: player?.teamId ?? '',
        teamName: team?.nombre ?? 'Equipo UFRO',
        teamSigla: team?.sigla ?? 'UFRO',
        teamEscudo: team?.escudo,
        posicion: player?.posicion ?? 'Jugador',
        dorsal: player?.dorsal ?? 0,
        votes: count,
        percentage: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
      };
    })
    .sort((a, b) => b.votes - a.votes || a.playerName.localeCompare(b.playerName, 'es'));

  return { totalVotes, candidates };
}

export interface PositionAwardStanding {
  position: PositionCategoryMeta;
  totalVotes: number;
  leader: RankedVoteCandidate | null;
  rankings: RankedVoteCandidate[];
}

/**
 * Aggregates Position Award votes for every position of a discipline's sport.
 */
export function aggregatePositionAwardVotes(
  disciplineId: DisciplineId,
  sportType: SportType,
  votes: PositionAwardVoteRecord[],
  players: Player[],
  teams: Team[]
): PositionAwardStanding[] {
  const categories = getPositionsForSport(sportType);
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  return categories.map((pos) => {
    const posVotes = votes.filter(
      (v) => v.disciplineId === disciplineId && v.positionKey === pos.key
    );
    const totalVotes = posVotes.length;
    const countMap = new Map<string, { votes: number; fallbackName: string; fallbackTeamId: string }>();

    for (const v of posVotes) {
      const current = countMap.get(v.playerId);
      if (current) {
        current.votes += 1;
      } else {
        countMap.set(v.playerId, {
          votes: 1,
          fallbackName: v.playerName,
          fallbackTeamId: v.teamId,
        });
      }
    }

    const rankings: RankedVoteCandidate[] = Array.from(countMap.entries())
      .map(([playerId, info]) => {
        const player = playerMap.get(playerId);
        const teamId = player?.teamId ?? info.fallbackTeamId;
        const team = teamMap.get(teamId);
        return {
          playerId,
          playerName: player
            ? `${player.nombre} ${player.apellidoPaterno}`.trim()
            : info.fallbackName,
          teamId,
          teamName: team?.nombre ?? 'Equipo UFRO',
          teamSigla: team?.sigla ?? 'UFRO',
          teamEscudo: team?.escudo,
          posicion: player?.posicion ?? pos.label,
          dorsal: player?.dorsal ?? 0,
          votes: info.votes,
          percentage: totalVotes > 0 ? Math.round((info.votes / totalVotes) * 100) : 0,
        };
      })
      .sort((a, b) => b.votes - a.votes || a.playerName.localeCompare(b.playerName, 'es'));

    return {
      position: pos,
      totalVotes,
      leader: rankings[0] ?? null,
      rankings,
    };
  });
}

export interface TotySlotResult {
  slot: TotyFormationSlot;
  position: PositionCategoryMeta;
  totalVotesForSlot: number;
  winner: RankedVoteCandidate | null;
  runnerUps: RankedVoteCandidate[];
}

export interface CommunityTotyResult {
  disciplineId: DisciplineId;
  formation: TotyFormationConfig;
  totalBallots: number;
  slots: TotySlotResult[];
}

/**
 * Computes the full-formation Community Team of the Year (TOTY) for a discipline:
 * - Fútbol 7: 1 Portero + 2 Defensas + 2 Mediocampistas + 2 Delanteros (7)
 * - Básquetbol 5x5: Quinteto completo PG, SG, SF, PF, C (5)
 * - Básquetbol 3x3: Trío completo PER, ALE, PIV (3)
 * - Voleibol: Sexteto titular (Armador, 2 Puntas, 2 Centrales, Opuesto) + Líbero (7)
 *
 * For multi-slot positions (e.g. 2 defensas, 2 delanteros, 2 puntas, 2 centrales), votes
 * across all slots of that position are pooled so candidates don't split votes between
 * slot 1 and slot 2, and the top N distinct players fill those N spots cleanly.
 */
export function computeCommunityToty(
  disciplineId: DisciplineId,
  sportType: SportType,
  ballots: TotyBallotRecord[],
  players: Player[],
  teams: Team[]
): CommunityTotyResult {
  const formation = getTotyFormationForSport(sportType);
  const categories = getPositionsForSport(sportType);
  const categoryMap = new Map(categories.map((c) => [c.key, c]));
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const discBallots = ballots.filter((b) => b.disciplineId === disciplineId);

  // Group formation slots by positionKey
  const slotsByPosition = new Map<string, TotyFormationSlot[]>();
  for (const slot of formation.slots) {
    const arr = slotsByPosition.get(slot.positionKey) ?? [];
    arr.push(slot);
    slotsByPosition.set(slot.positionKey, arr);
  }

  // Aggregate unique votes per position pool across all ballots
  const poolStats = new Map<
    string,
    { ballotsContributing: number; ranked: RankedVoteCandidate[] }
  >();

  for (const [posKey, groupSlots] of slotsByPosition.entries()) {
    const posMeta = categoryMap.get(posKey) ?? categories[0];
    const counts = new Map<string, number>();
    let ballotsContributing = 0;

    for (const ballot of discBallots) {
      const normalized = normalizeTotyBallotSelections(ballot.selections, sportType);
      const uniquePicksInGroup = new Set<string>();
      for (const s of groupSlots) {
        const pid = normalized[s.slotKey];
        if (pid) uniquePicksInGroup.add(pid);
      }
      if (uniquePicksInGroup.size === 0) continue;
      ballotsContributing += 1;
      for (const pid of uniquePicksInGroup) {
        counts.set(pid, (counts.get(pid) ?? 0) + 1);
      }
    }

    const ranked: RankedVoteCandidate[] = Array.from(counts.entries())
      .map(([playerId, count]) => {
        const player = playerMap.get(playerId);
        const team = player ? teamMap.get(player.teamId) : undefined;
        return {
          playerId,
          playerName: player
            ? `${player.nombre} ${player.apellidoPaterno}`.trim()
            : playerId,
          teamId: player?.teamId ?? '',
          teamName: team?.nombre ?? 'Equipo UFRO',
          teamSigla: team?.sigla ?? 'UFRO',
          teamEscudo: team?.escudo,
          posicion: player?.posicion ?? posMeta.label,
          dorsal: player?.dorsal ?? 0,
          votes: count,
          percentage:
            ballotsContributing > 0
              ? Math.min(100, Math.round((count / ballotsContributing) * 100))
              : 0,
        };
      })
      .sort((a, b) => b.votes - a.votes || a.playerName.localeCompare(b.playerName, 'es'));

    poolStats.set(posKey, { ballotsContributing, ranked });
  }

  // Assign distinct winners across the full formation so no player appears twice on the pitch/court
  const globallyAssignedIds = new Set<string>();
  const slotResultMap = new Map<string, TotySlotResult>();

  for (const [posKey, groupSlots] of slotsByPosition.entries()) {
    const posMeta = categoryMap.get(posKey) ?? categories[0];
    const pool = poolStats.get(posKey) ?? { ballotsContributing: 0, ranked: [] };
    const available = pool.ranked.filter((c) => !globallyAssignedIds.has(c.playerId));
    const chosenForGroup = available.slice(0, groupSlots.length);
    chosenForGroup.forEach((c) => globallyAssignedIds.add(c.playerId));
    const remainingRunnerUps = available.slice(groupSlots.length, groupSlots.length + 3);

    groupSlots.forEach((slot, idx) => {
      slotResultMap.set(slot.slotKey, {
        slot,
        position: posMeta,
        totalVotesForSlot: pool.ballotsContributing,
        winner: chosenForGroup[idx] ?? null,
        runnerUps: idx === 0 ? remainingRunnerUps : [],
      });
    });
  }

  const slots: TotySlotResult[] = formation.slots.map(
    (slot) =>
      slotResultMap.get(slot.slotKey) ?? {
        slot,
        position: categoryMap.get(slot.positionKey) ?? categories[0],
        totalVotesForSlot: 0,
        winner: null,
        runnerUps: [],
      }
  );

  return {
    disciplineId,
    formation,
    totalBallots: discBallots.length,
    slots,
  };
}
