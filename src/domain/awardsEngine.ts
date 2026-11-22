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
  position: PositionCategoryMeta;
  totalVotesForSlot: number;
  winner: RankedVoteCandidate | null;
  runnerUps: RankedVoteCandidate[];
}

export interface CommunityTotyResult {
  disciplineId: DisciplineId;
  totalBallots: number;
  slots: TotySlotResult[];
}

/**
 * Computes the Community Team of the Year (TOTY) for a discipline.
 * Each user submits a TotyBallotRecord mapping `positionKey -> playerId`.
 * For each position, the player with the highest total votes wins the TOTY spot.
 */
export function computeCommunityToty(
  disciplineId: DisciplineId,
  sportType: SportType,
  ballots: TotyBallotRecord[],
  players: Player[],
  teams: Team[]
): CommunityTotyResult {
  const categories = getPositionsForSport(sportType);
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const discBallots = ballots.filter((b) => b.disciplineId === disciplineId);

  const slots: TotySlotResult[] = categories.map((pos) => {
    const counts = new Map<string, number>();
    let totalVotesForSlot = 0;

    for (const ballot of discBallots) {
      const pickedPlayerId = ballot.selections?.[pos.key];
      if (!pickedPlayerId || typeof pickedPlayerId !== 'string') continue;
      counts.set(pickedPlayerId, (counts.get(pickedPlayerId) ?? 0) + 1);
      totalVotesForSlot += 1;
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
          posicion: player?.posicion ?? pos.label,
          dorsal: player?.dorsal ?? 0,
          votes: count,
          percentage: totalVotesForSlot > 0 ? Math.round((count / totalVotesForSlot) * 100) : 0,
        };
      })
      .sort((a, b) => b.votes - a.votes || a.playerName.localeCompare(b.playerName, 'es'));

    return {
      position: pos,
      totalVotesForSlot,
      winner: ranked[0] ?? null,
      runnerUps: ranked.slice(1, 4),
    };
  });

  return {
    disciplineId,
    totalBallots: discBallots.length,
    slots,
  };
}
