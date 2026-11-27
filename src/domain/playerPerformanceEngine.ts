import type {
  Match,
  MatchPhase,
  Player,
  SportType,
  Team,
} from '../types/tournament';

export type PlayerHistorySource =
  | 'eventos_partido'
  | 'mixto'
  | 'resumen_planilla'
  | 'sin_datos';

export interface PlayerPerformancePoint {
  matchId: string;
  index: number;
  label: string;
  fullLabel: string;
  fecha: string;
  fase: MatchPhase | 'Temporada';
  jornada: number;
  opponentName: string;
  opponentSigla: string;
  isHome: boolean;
  teamScore: number | null;
  opponentScore: number | null;
  outcome: 'G' | 'E' | 'P' | null;
  // Fútbol 7 per-match
  goles: number;
  asistencias: number;
  tarjetasAmarillas: number;
  tarjetasRojas: number;
  tarjetas: number;
  // Básquetbol / Voleibol per-match
  puntos: number;
  rebotes: number;
  triples: number;
  faltas: number;
  aces: number;
  bloqueos: number;
  // Cumulative season totals
  acumuladoGoles: number;
  acumuladoAsistencias: number;
  acumuladoTarjetasAmarillas: number;
  acumuladoTarjetasRojas: number;
  acumuladoTarjetas: number;
  acumuladoPuntos: number;
  acumuladoRebotes: number;
  acumuladoTriples: number;
  acumuladoFaltas: number;
  acumuladoAces: number;
  acumuladoBloqueos: number;
  hasExactEvents: boolean;
}

export interface PlayerPerformanceSummary {
  sportType: SportType;
  source: PlayerHistorySource;
  matchesCount: number;
  points: PlayerPerformancePoint[];
  totals: {
    goles: number;
    asistencias: number;
    tarjetasAmarillas: number;
    tarjetasRojas: number;
    tarjetas: number;
    puntos: number;
    rebotes: number;
    triples: number;
    faltas: number;
    aces: number;
    bloqueos: number;
  };
  averages: {
    goles: number;
    asistencias: number;
    tarjetas: number;
    puntos: number;
    rebotes: number;
    aces: number;
    bloqueos: number;
  };
  bestMatch: {
    label: string;
    opponentName: string;
    primaryValue: number;
    primaryUnit: string;
  } | null;
}

interface MetricBucket {
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
}

function emptyBucket(): MetricBucket {
  return {
    goles: 0,
    asistencias: 0,
    tarjetasAmarillas: 0,
    tarjetasRojas: 0,
    puntos: 0,
    rebotes: 0,
    triples: 0,
    faltas: 0,
    aces: 0,
    bloqueos: 0,
  };
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const PHASE_SORT_ORDER: Record<MatchPhase, number> = {
  Grupos: 0,
  Octavos: 1,
  Cuartos: 2,
  Semifinal: 3,
  'Tercer Lugar': 4,
  Final: 5,
};

function getPlayoffLegOrder(leg: Match['playoffLeg']): number {
  if (leg === 'IDA') return 0;
  if (leg === 'VUELTA') return 1;
  return 2;
}

function formatBasePhaseLabel(match: Match): string {
  if (match.fase === 'Grupos') return `F${match.jornada}`;
  if (match.fase === 'Octavos') return '8vos';
  if (match.fase === 'Cuartos') return '4tos';
  if (match.fase === 'Semifinal') return 'Semi';
  if (match.fase === 'Tercer Lugar') return '3°';
  return 'Final';
}

function formatFullPhaseLabel(match: Match, groupSequentialIdx?: number): string {
  if (match.fase === 'Grupos') {
    const labelNum = groupSequentialIdx ?? match.jornada;
    return `Fecha ${labelNum} · ${match.groupName}`;
  }
  const legSuffix =
    match.playoffLeg === 'IDA'
      ? ' · Ida'
      : match.playoffLeg === 'VUELTA'
      ? ' · Vuelta'
      : '';
  return `${match.fase}${legSuffix}`;
}

function extractMatchEventsForPlayer(match: Match, playerId: string): {
  bucket: MetricBucket;
  eventCount: number;
} {
  const bucket = emptyBucket();
  let eventCount = 0;

  for (const ev of match.events ?? []) {
    if (ev.playerId !== playerId) continue;
    if (ev.type === 'CAMBIO' || ev.type === 'TIEMPO_MUERTO' || ev.type === 'SET_GANADO') {
      continue;
    }

    eventCount += 1;
    switch (ev.type) {
      case 'GOL':
        bucket.goles += 1;
        break;
      case 'ASISTENCIA':
        bucket.asistencias += 1;
        break;
      case 'AMARILLA':
        bucket.tarjetasAmarillas += 1;
        break;
      case 'ROJA':
        bucket.tarjetasRojas += 1;
        break;
      case 'PUNTO_1':
        bucket.puntos += ev.pointsDelta ?? 1;
        break;
      case 'PUNTO_2':
        bucket.puntos += ev.pointsDelta ?? 2;
        break;
      case 'PUNTO_3':
        bucket.puntos += ev.pointsDelta ?? 3;
        bucket.triples += 1;
        break;
      case 'REBOTE':
        bucket.rebotes += 1;
        break;
      case 'FALTA':
        bucket.faltas += 1;
        break;
      case 'PUNTO_VOLEY':
        bucket.puntos += ev.pointsDelta ?? 1;
        break;
      case 'ACE':
        bucket.aces += 1;
        bucket.puntos += ev.pointsDelta ?? 1;
        break;
      case 'BLOQUEO':
        bucket.bloqueos += 1;
        bucket.puntos += ev.pointsDelta ?? 1;
        break;
      default:
        break;
    }
  }

  return { bucket, eventCount };
}

/**
 * Deterministically distributes a non-negative integer total across candidate slots
 * using optional weights (e.g. team goals scored per match) and optional soft caps.
 * Guarantees exact conservation: sum(output) === total.
 */
function distributeTotalAcrossSlots(
  total: number,
  weights: number[],
  seed: number,
  softCaps?: number[]
): number[] {
  const count = weights.length;
  if (count === 0) return [];
  const result = new Array<number>(count).fill(0);
  if (total <= 0) return result;

  const normalizedWeights = weights.map((w) => Math.max(0, w));
  const totalWeight = normalizedWeights.reduce((acc, w) => acc + w, 0);

  let remaining = Math.trunc(total);

  // First pass: respect soft caps (e.g. team's actual goals in each match)
  if (softCaps && softCaps.length === count) {
    const capSum = softCaps.reduce((acc, c) => acc + Math.max(0, c), 0);
    if (capSum > 0) {
      const targetFirstPass = Math.min(remaining, capSum);
      const effectiveWeights = normalizedWeights.map((w, idx) =>
        softCaps[idx] > 0 ? Math.max(1, w) : 0
      );
      const effSum = effectiveWeights.reduce((acc, w) => acc + w, 0);

      if (effSum > 0) {
        const quotas = effectiveWeights.map((w, idx) => {
          const raw = (targetFirstPass * w) / effSum;
          return {
            idx,
            floor: Math.min(softCaps[idx], Math.floor(raw)),
            frac: raw - Math.floor(raw),
          };
        });

        for (const q of quotas) {
          result[q.idx] += q.floor;
          remaining -= q.floor;
        }

        // Distribute fractional remainder deterministically respecting soft caps
        const order = [...quotas].sort((a, b) => {
          if (b.frac !== a.frac) return b.frac - a.frac;
          return ((a.idx + seed) % count) - ((b.idx + seed) % count);
        });

        let guard = 0;
        while (remaining > 0 && guard < count * 5) {
          let placed = false;
          for (const item of order) {
            if (remaining <= 0) break;
            if (result[item.idx] < softCaps[item.idx]) {
              result[item.idx] += 1;
              remaining -= 1;
              placed = true;
            }
          }
          if (!placed) break;
          guard += 1;
        }
      }
    }
  }

  // Second pass: distribute any leftover across all slots evenly/weighted
  if (remaining > 0) {
    if (totalWeight > 0) {
      const quotas = normalizedWeights.map((w, idx) => {
        const raw = (remaining * w) / totalWeight;
        return { idx, floor: Math.floor(raw), frac: raw - Math.floor(raw) };
      });
      for (const q of quotas) {
        result[q.idx] += q.floor;
        remaining -= q.floor;
      }
      const order = [...quotas].sort((a, b) => {
        if (b.frac !== a.frac) return b.frac - a.frac;
        return ((a.idx + seed) % count) - ((b.idx + seed) % count);
      });
      let cursor = 0;
      while (remaining > 0) {
        const target = order[cursor % order.length];
        result[target.idx] += 1;
        remaining -= 1;
        cursor += 1;
      }
    } else {
      let cursor = seed % count;
      while (remaining > 0) {
        result[cursor % count] += 1;
        remaining -= 1;
        cursor += 1;
      }
    }
  }

  return result;
}

function hasAnySeasonStats(player: Player, sportType: SportType): boolean {
  const s = player.stats;
  if (sportType === 'futbol7') {
    return (
      s.goles > 0 ||
      s.asistencias > 0 ||
      s.tarjetasAmarillas > 0 ||
      s.tarjetasRojas > 0 ||
      s.partidosJugados > 0
    );
  }
  if (sportType === 'voleibol') {
    return (
      s.puntos > 0 ||
      s.aces > 0 ||
      s.bloqueos > 0 ||
      s.tarjetasAmarillas > 0 ||
      s.tarjetasRojas > 0 ||
      s.partidosJugados > 0
    );
  }
  return (
    s.puntos > 0 ||
    s.rebotes > 0 ||
    s.triples > 0 ||
    s.faltas > 0 ||
    s.asistencias > 0 ||
    s.partidosJugados > 0
  );
}

/**
 * Computes chronological season performance progression for a player across finalized matches.
 * - Uses exact `match.events` when refereed live (`source: 'eventos_partido'`).
 * - Preserves exact official `player.stats` totals for Google Sheets historical matches that lack
 *   per-minute event logs (`source: 'resumen_planilla'` or `'mixto'`).
 */
export function computePlayerSeasonPerformance(
  player: Player,
  allMatches: Match[],
  sportType: SportType,
  teamLookup?: Map<string, Pick<Team, 'nombre' | 'sigla'>>
): PlayerPerformanceSummary {
  const relevantMatches = allMatches
    .filter((m) => {
      if (m.status !== 'FINALIZADO') return false;
      if (m.disciplineId !== player.disciplineId) return false;
      const teamPlayed = m.homeTeamId === player.teamId || m.awayTeamId === player.teamId;
      const playerRecordedEvent = (m.events ?? []).some((e) => e.playerId === player.id);
      return teamPlayed || playerRecordedEvent;
    })
    .sort((a, b) => {
      const phaseDiff = PHASE_SORT_ORDER[a.fase] - PHASE_SORT_ORDER[b.fase];
      if (phaseDiff !== 0) return phaseDiff;
      const aKey = `${a.fecha} ${a.hora}`;
      const bKey = `${b.fecha} ${b.hora}`;
      if (aKey !== bKey) return aKey.localeCompare(bKey);
      if (a.jornada !== b.jornada) return a.jornada - b.jornada;
      const legDiff = getPlayoffLegOrder(a.playoffLeg) - getPlayoffLegOrder(b.playoffLeg);
      if (legDiff !== 0) return legDiff;
      return a.id.localeCompare(b.id);
    });

  // Case 1: No finalized matches in state.matches
  if (relevantMatches.length === 0) {
    if (!hasAnySeasonStats(player, sportType)) {
      return {
        sportType,
        source: 'sin_datos',
        matchesCount: 0,
        points: [],
        totals: {
          goles: 0,
          asistencias: 0,
          tarjetasAmarillas: 0,
          tarjetasRojas: 0,
          tarjetas: 0,
          puntos: 0,
          rebotes: 0,
          triples: 0,
          faltas: 0,
          aces: 0,
          bloqueos: 0,
        },
        averages: {
          goles: 0,
          asistencias: 0,
          tarjetas: 0,
          puntos: 0,
          rebotes: 0,
          aces: 0,
          bloqueos: 0,
        },
        bestMatch: null,
      };
    }

    // Build deterministic synthetic dates strictly from official player.stats when matches aren't loaded yet
    const syntheticCount = Math.max(1, Math.min(16, Math.trunc(player.stats.partidosJugados) || 1));
    const seed = hashString(player.id);
    const uniformWeights = new Array<number>(syntheticCount).fill(1);

    const golesArr = distributeTotalAcrossSlots(player.stats.goles, uniformWeights, seed + 1);
    const asistArr = distributeTotalAcrossSlots(player.stats.asistencias, uniformWeights, seed + 2);
    const taArr = distributeTotalAcrossSlots(player.stats.tarjetasAmarillas, uniformWeights, seed + 3);
    const trArr = distributeTotalAcrossSlots(player.stats.tarjetasRojas, uniformWeights, seed + 4);
    const ptsArr = distributeTotalAcrossSlots(player.stats.puntos, uniformWeights, seed + 5);
    const rebArr = distributeTotalAcrossSlots(player.stats.rebotes, uniformWeights, seed + 6);
    const triArr = distributeTotalAcrossSlots(player.stats.triples, uniformWeights, seed + 7);
    const falArr = distributeTotalAcrossSlots(player.stats.faltas, uniformWeights, seed + 8);
    const aceArr = distributeTotalAcrossSlots(player.stats.aces, uniformWeights, seed + 9);
    const bloArr = distributeTotalAcrossSlots(player.stats.bloqueos, uniformWeights, seed + 10);

    const syntheticEntries = Array.from({ length: syntheticCount }, (_, idx) => ({
      matchId: `season-slot-${idx + 1}`,
      label: `F${idx + 1}`,
      fullLabel: `Fecha ${idx + 1} · Planilla Oficial`,
      fecha: 'Temporada',
      fase: 'Temporada' as const,
      jornada: idx + 1,
      opponentName: 'Planilla acumulada',
      opponentSigla: `F${idx + 1}`,
      isHome: true,
      teamScore: null,
      opponentScore: null,
      outcome: null,
      hasExactEvents: false,
      bucket: {
        goles: golesArr[idx],
        asistencias: asistArr[idx],
        tarjetasAmarillas: taArr[idx],
        tarjetasRojas: trArr[idx],
        puntos: ptsArr[idx],
        rebotes: rebArr[idx],
        triples: triArr[idx],
        faltas: falArr[idx],
        aces: aceArr[idx],
        bloqueos: bloArr[idx],
      },
    }));

    return buildSummaryFromEntries(syntheticEntries, sportType, 'resumen_planilla');
  }

  // Case 2: Extract real match events per finalized match with guaranteed unique X-axis labels
  const groupMatches = relevantMatches.filter((m) => m.fase === 'Grupos');
  const uniqueGroupJornadas = new Set(groupMatches.map((m) => m.jornada));
  const groupHasDuplicateJornadas = uniqueGroupJornadas.size < groupMatches.length;

  const phaseTotals = new Map<string, number>();
  for (const m of relevantMatches) {
    if (m.fase !== 'Grupos') {
      const base = formatBasePhaseLabel(m);
      phaseTotals.set(base, (phaseTotals.get(base) ?? 0) + 1);
    }
  }
  const phaseSeen = new Map<string, number>();
  let groupCursor = 0;

  let totalMatchedEvents = 0;
  const entries = relevantMatches.map((match) => {
    const isHome = match.homeTeamId === player.teamId;
    const isAway = match.awayTeamId === player.teamId;
    const playerSideIsHome = isHome
      ? true
      : isAway
      ? false
      : (match.events ?? []).find((e) => e.playerId === player.id)?.teamId === match.homeTeamId;

    const opponentId = playerSideIsHome ? match.awayTeamId : match.homeTeamId;
    const opponentInfo = teamLookup?.get(opponentId);
    const teamScore = playerSideIsHome ? match.homeScore : match.awayScore;
    const opponentScore = playerSideIsHome ? match.awayScore : match.homeScore;
    const outcome: 'G' | 'E' | 'P' =
      teamScore > opponentScore ? 'G' : teamScore < opponentScore ? 'P' : 'E';

    const extracted = extractMatchEventsForPlayer(match, player.id);
    totalMatchedEvents += extracted.eventCount;

    let label: string;
    let fullLabel: string;
    if (match.fase === 'Grupos') {
      groupCursor += 1;
      const num = groupHasDuplicateJornadas ? groupCursor : match.jornada;
      label = `F${num}`;
      fullLabel = formatFullPhaseLabel(match, num);
    } else {
      const base = formatBasePhaseLabel(match);
      const countForPhase = phaseTotals.get(base) ?? 1;
      const seenIdx = (phaseSeen.get(base) ?? 0) + 1;
      phaseSeen.set(base, seenIdx);
      if (match.playoffLeg === 'IDA') {
        label = `${base} Ida`;
      } else if (match.playoffLeg === 'VUELTA') {
        label = `${base} Vta`;
      } else if (countForPhase > 1) {
        label = `${base} #${seenIdx}`;
      } else {
        label = base;
      }
      fullLabel = formatFullPhaseLabel(match);
    }

    return {
      matchId: match.id,
      label,
      fullLabel,
      fecha: match.fecha,
      fase: match.fase,
      jornada: match.jornada,
      opponentName: opponentInfo?.nombre ?? opponentId,
      opponentSigla: opponentInfo?.sigla ?? opponentId.slice(0, 3).toUpperCase(),
      isHome: playerSideIsHome,
      teamScore,
      opponentScore,
      outcome,
      hasExactEvents: (match.events ?? []).length > 0,
      bucket: extracted.bucket,
    };
  });

  // Sum extracted event totals
  const eventTotals = entries.reduce(
    (acc, item) => ({
      goles: acc.goles + item.bucket.goles,
      asistencias: acc.asistencias + item.bucket.asistencias,
      tarjetasAmarillas: acc.tarjetasAmarillas + item.bucket.tarjetasAmarillas,
      tarjetasRojas: acc.tarjetasRojas + item.bucket.tarjetasRojas,
      puntos: acc.puntos + item.bucket.puntos,
      rebotes: acc.rebotes + item.bucket.rebotes,
      triples: acc.triples + item.bucket.triples,
      faltas: acc.faltas + item.bucket.faltas,
      aces: acc.aces + item.bucket.aces,
      bloqueos: acc.bloqueos + item.bucket.bloqueos,
    }),
    emptyBucket()
  );

  // Compute any unattributed historical totals from player.stats (e.g. Google Sheets imports)
  const residual: MetricBucket = {
    goles: Math.max(0, player.stats.goles - eventTotals.goles),
    asistencias: Math.max(0, player.stats.asistencias - eventTotals.asistencias),
    tarjetasAmarillas: Math.max(0, player.stats.tarjetasAmarillas - eventTotals.tarjetasAmarillas),
    tarjetasRojas: Math.max(0, player.stats.tarjetasRojas - eventTotals.tarjetasRojas),
    puntos: Math.max(0, player.stats.puntos - eventTotals.puntos),
    rebotes: Math.max(0, player.stats.rebotes - eventTotals.rebotes),
    triples: Math.max(0, player.stats.triples - eventTotals.triples),
    faltas: Math.max(0, player.stats.faltas - eventTotals.faltas),
    aces: Math.max(0, player.stats.aces - eventTotals.aces),
    bloqueos: Math.max(0, player.stats.bloqueos - eventTotals.bloqueos),
  };

  const hasResidual =
    residual.goles > 0 ||
    residual.asistencias > 0 ||
    residual.tarjetasAmarillas > 0 ||
    residual.tarjetasRojas > 0 ||
    residual.puntos > 0 ||
    residual.rebotes > 0 ||
    residual.triples > 0 ||
    residual.faltas > 0 ||
    residual.aces > 0 ||
    residual.bloqueos > 0;

  let source: PlayerHistorySource =
    totalMatchedEvents > 0 ? 'eventos_partido' : 'eventos_partido';

  if (hasResidual) {
    // Prefer distributing residuals onto matches that had no live event log
    const legacyIndices = entries
      .map((e, idx) => (!e.hasExactEvents ? idx : -1))
      .filter((idx) => idx >= 0);
    const targetIndices =
      legacyIndices.length > 0 ? legacyIndices : entries.map((_, idx) => idx);

    const scoreWeights = targetIndices.map((idx) => Math.max(0, entries[idx].teamScore ?? 1));
    const scoreCaps =
      sportType === 'futbol7'
        ? targetIndices.map((idx) => Math.max(0, entries[idx].teamScore ?? 0))
        : undefined;
    const uniformWeights = targetIndices.map(() => 1);
    const seed = hashString(player.id);

    const distGoles = distributeTotalAcrossSlots(residual.goles, scoreWeights, seed + 1, scoreCaps);
    const distAsist = distributeTotalAcrossSlots(residual.asistencias, scoreWeights, seed + 2, scoreCaps);
    const distTa = distributeTotalAcrossSlots(residual.tarjetasAmarillas, uniformWeights, seed + 3);
    const distTr = distributeTotalAcrossSlots(residual.tarjetasRojas, uniformWeights, seed + 4);
    const distPts = distributeTotalAcrossSlots(residual.puntos, scoreWeights, seed + 5);
    const distReb = distributeTotalAcrossSlots(residual.rebotes, uniformWeights, seed + 6);
    const distTri = distributeTotalAcrossSlots(residual.triples, scoreWeights, seed + 7);
    const distFal = distributeTotalAcrossSlots(residual.faltas, uniformWeights, seed + 8);
    const distAce = distributeTotalAcrossSlots(residual.aces, uniformWeights, seed + 9);
    const distBlo = distributeTotalAcrossSlots(residual.bloqueos, uniformWeights, seed + 10);

    targetIndices.forEach((entryIdx, slotPos) => {
      entries[entryIdx].bucket.goles += distGoles[slotPos];
      entries[entryIdx].bucket.asistencias += distAsist[slotPos];
      entries[entryIdx].bucket.tarjetasAmarillas += distTa[slotPos];
      entries[entryIdx].bucket.tarjetasRojas += distTr[slotPos];
      entries[entryIdx].bucket.puntos += distPts[slotPos];
      entries[entryIdx].bucket.rebotes += distReb[slotPos];
      entries[entryIdx].bucket.triples += distTri[slotPos];
      entries[entryIdx].bucket.faltas += distFal[slotPos];
      entries[entryIdx].bucket.aces += distAce[slotPos];
      entries[entryIdx].bucket.bloqueos += distBlo[slotPos];
    });

    source = totalMatchedEvents > 0 ? 'mixto' : 'resumen_planilla';
  }

  return buildSummaryFromEntries(entries, sportType, source);
}

function buildSummaryFromEntries(
  entries: Array<{
    matchId: string;
    label: string;
    fullLabel: string;
    fecha: string;
    fase: MatchPhase | 'Temporada';
    jornada: number;
    opponentName: string;
    opponentSigla: string;
    isHome: boolean;
    teamScore: number | null;
    opponentScore: number | null;
    outcome: 'G' | 'E' | 'P' | null;
    hasExactEvents: boolean;
    bucket: MetricBucket;
  }>,
  sportType: SportType,
  source: PlayerHistorySource
): PlayerPerformanceSummary {
  let accGoles = 0;
  let accAsist = 0;
  let accTa = 0;
  let accTr = 0;
  let accPts = 0;
  let accReb = 0;
  let accTri = 0;
  let accFal = 0;
  let accAce = 0;
  let accBlo = 0;

  const points: PlayerPerformancePoint[] = entries.map((entry, idx) => {
    const tarjetas = entry.bucket.tarjetasAmarillas + entry.bucket.tarjetasRojas;
    accGoles += entry.bucket.goles;
    accAsist += entry.bucket.asistencias;
    accTa += entry.bucket.tarjetasAmarillas;
    accTr += entry.bucket.tarjetasRojas;
    accPts += entry.bucket.puntos;
    accReb += entry.bucket.rebotes;
    accTri += entry.bucket.triples;
    accFal += entry.bucket.faltas;
    accAce += entry.bucket.aces;
    accBlo += entry.bucket.bloqueos;

    return {
      matchId: entry.matchId,
      index: idx + 1,
      label: entry.label,
      fullLabel: entry.fullLabel,
      fecha: entry.fecha,
      fase: entry.fase,
      jornada: entry.jornada,
      opponentName: entry.opponentName,
      opponentSigla: entry.opponentSigla,
      isHome: entry.isHome,
      teamScore: entry.teamScore,
      opponentScore: entry.opponentScore,
      outcome: entry.outcome,
      goles: entry.bucket.goles,
      asistencias: entry.bucket.asistencias,
      tarjetasAmarillas: entry.bucket.tarjetasAmarillas,
      tarjetasRojas: entry.bucket.tarjetasRojas,
      tarjetas,
      puntos: entry.bucket.puntos,
      rebotes: entry.bucket.rebotes,
      triples: entry.bucket.triples,
      faltas: entry.bucket.faltas,
      aces: entry.bucket.aces,
      bloqueos: entry.bucket.bloqueos,
      acumuladoGoles: accGoles,
      acumuladoAsistencias: accAsist,
      acumuladoTarjetasAmarillas: accTa,
      acumuladoTarjetasRojas: accTr,
      acumuladoTarjetas: accTa + accTr,
      acumuladoPuntos: accPts,
      acumuladoRebotes: accReb,
      acumuladoTriples: accTri,
      acumuladoFaltas: accFal,
      acumuladoAces: accAce,
      acumuladoBloqueos: accBlo,
      hasExactEvents: entry.hasExactEvents,
    };
  });

  const count = points.length;
  const round1 = (n: number) => (count > 0 ? Math.round((n / count) * 10) / 10 : 0);

  let bestMatch: PlayerPerformanceSummary['bestMatch'] = null;
  if (count > 0) {
    const primaryKey = sportType === 'futbol7' ? 'goles' : 'puntos';
    const primaryUnit = sportType === 'futbol7' ? 'goles' : 'pts';
    const best = points.reduce(
      (winner, cur) => (cur[primaryKey] > winner[primaryKey] ? cur : winner),
      points[0]
    );
    if (best[primaryKey] > 0) {
      bestMatch = {
        label: best.label,
        opponentName: best.opponentName,
        primaryValue: best[primaryKey],
        primaryUnit,
      };
    }
  }

  return {
    sportType,
    source,
    matchesCount: count,
    points,
    totals: {
      goles: accGoles,
      asistencias: accAsist,
      tarjetasAmarillas: accTa,
      tarjetasRojas: accTr,
      tarjetas: accTa + accTr,
      puntos: accPts,
      rebotes: accReb,
      triples: accTri,
      faltas: accFal,
      aces: accAce,
      bloqueos: accBlo,
    },
    averages: {
      goles: round1(accGoles),
      asistencias: round1(accAsist),
      tarjetas: round1(accTa + accTr),
      puntos: round1(accPts),
      rebotes: round1(accReb),
      aces: round1(accAce),
      bloqueos: round1(accBlo),
    },
    bestMatch,
  };
}
