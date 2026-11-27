import type { DisciplineId, Match, Player, Team } from '../types/tournament';

export interface PlayerParticipation {
  player: Player;
  team?: Team;
  disciplineId: DisciplineId;
}

export interface UnifiedPlayerProfile {
  personKey: string;
  primaryRecord: Player;
  records: Player[];
  participations: PlayerParticipation[];
  disciplines: DisciplineId[];
  teamIds: string[];
  totalPartidosJugados: number;
  esSeleccionadoUfro: boolean;
}

export interface UnifiedClubProfile {
  clubKey: string;
  displayName: string;
  primaryTeam: Team;
  teams: Team[];
  disciplines: DisciplineId[];
  careers: string[];
  faculties: string[];
  escudo?: string;
  sigla: string;
  anioFundacion?: number;
  logrosAnteriores?: string;
  uniquePlayerCount: number;
  totalMatchesPlayed: number;
  totalWins: number;
}

/**
 * Strips diacritics, lowercases, and collapses whitespace.
 */
export function normalizeTextToken(raw: string | undefined | null): string {
  return (raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes a Chilean RUT to bare digits + verifier (e.g., "19.876.543-K" -> "19876543k").
 * Returns empty string if empty or too short to be a reliable identifier.
 */
export function normalizeRutKey(raw: string | undefined | null): string {
  const cleaned = (raw ?? '').replace(/[^0-9kK]/g, '').toLowerCase();
  return cleaned.length >= 7 ? cleaned : '';
}

/**
 * Computes normalized full name key for a player (first name + paternal + maternal surname).
 */
export function normalizePlayerNameParts(player: Pick<Player, 'nombre' | 'apellidoPaterno' | 'apellidoMaterno'>): {
  fullKey: string;
  shortKey: string;
} {
  const first = normalizeTextToken(player.nombre);
  const paternal = normalizeTextToken(player.apellidoPaterno);
  const maternal = normalizeTextToken(player.apellidoMaterno);
  const shortKey = [first, paternal].filter(Boolean).join(' ').trim();
  const fullKey = [first, paternal, maternal].filter(Boolean).join(' ').trim();
  return { fullKey, shortKey };
}

/**
 * Tokens that denote a sport, division, branch/gender, or generic club suffix/prefix
 * and should NOT split the same multi-discipline club into separate club identities.
 * NOTE: Single letters like "a" or "b" are intentionally NOT stripped so "Equipo A"
 * and "Equipo B" remain distinct clubs.
 */
const CLUB_STRIP_TOKENS = new Set<string>([
  // Generic club designators
  'fc',
  'cf',
  'cd',
  'sc',
  'ac',
  'bc',
  'vc',
  'club',
  'deportivo',
  'deportiva',
  'equipo',
  'team',
  'seleccion',
  // Sports & formats
  'f7',
  'f5',
  'f11',
  'futbol',
  'futbolito',
  'futsal',
  'soccer',
  'basquet',
  'basquetbol',
  'basketball',
  'basket',
  'bask',
  'baloncesto',
  '3x3',
  '5x5',
  'voley',
  'voleybol',
  'voleibol',
  'volleyball',
  'volley',
  'voleyball',
  'handball',
  'balonmano',
  // Gender / branch qualifiers
  'fem',
  'femenino',
  'femenina',
  'femenil',
  'damas',
  'dama',
  'mujeres',
  'mujer',
  'masc',
  'masculino',
  'masculina',
  'varones',
  'varon',
  'hombres',
  'hombre',
  'mixto',
  'mixta',
  // Division qualifiers
  'div',
  'division',
  'primera',
  'segunda',
  'tercera',
  '1ra',
  '2da',
  '3ra',
  '1a',
  '2a',
  '3a',
]);

/**
 * Produces the canonical club base name by removing sport/branch/division qualifiers
 * (e.g. "Real Efineza FEM", "Real Efineza FC", "Real Efineza Basquetbol" -> "real efineza").
 */
export function normalizeClubBaseName(rawName: string): string {
  const normalized = normalizeTextToken(rawName);
  if (!normalized) return '';

  const tokens = normalized.split(' ').filter(Boolean);
  const kept = tokens.filter((token) => !CLUB_STRIP_TOKENS.has(token));

  // If stripping removed every word (e.g., team literally named "Club Futbol"), fall back to normalized
  if (kept.length === 0) {
    return normalized;
  }
  return kept.join(' ');
}

/**
 * Computes Levenshtein edit distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/**
 * Determines whether two team names represent the same club across disciplines.
 * Strictly based on name equivalence / very high similarity (NEVER merges distinct
 * team names just because they belong to the same career).
 */
export function areClubNamesEquivalent(nameA: string, nameB: string): boolean {
  const baseA = normalizeClubBaseName(nameA);
  const baseB = normalizeClubBaseName(nameB);
  if (!baseA || !baseB) return false;
  if (baseA === baseB) return true;

  // Compact space-insensitive check (e.g., "RealEfineza" vs "Real Efineza")
  const compactA = baseA.replace(/\s+/g, '');
  const compactB = baseB.replace(/\s+/g, '');
  if (compactA === compactB) return true;

  // Prevent merging short names like "Equipo A" and "Equipo B" or "Los 1" and "Los 2"
  const tokensA = baseA.split(' ');
  const tokensB = baseB.split(' ');
  if (
    tokensA.length === tokensB.length &&
    tokensA.length >= 2 &&
    tokensA.slice(0, -1).join(' ') === tokensB.slice(0, -1).join(' ')
  ) {
    const lastA = tokensA[tokensA.length - 1];
    const lastB = tokensB[tokensB.length - 1];
    if (lastA.length <= 2 && lastB.length <= 2 && lastA !== lastB) {
      return false;
    }
  }

  // Allow tiny spelling typos (e.g. 1 char difference on a >= 7 char club name like "Efiorentina" vs "Efiorentinna")
  const maxLen = Math.max(compactA.length, compactB.length);
  if (maxLen >= 7) {
    const dist = levenshteinDistance(compactA, compactB);
    const similarity = 1 - dist / maxLen;
    if (dist <= 1 || (maxLen >= 10 && dist <= 2 && similarity >= 0.85)) {
      return true;
    }
  }

  return false;
}

/**
 * Builds a clean, title-preserving display name for a unified multi-discipline club.
 * Strips trailing sport/gender suffixes (like "FC", "FEM", "Básquetbol") while keeping
 * original capitalization and accents.
 */
export function formatUnifiedClubDisplayName(teams: Team[]): string {
  if (teams.length === 0) return '';

  // Prefer explicit clubName when assigned by an administrator
  const explicitCounts = new Map<string, { label: string; count: number }>();
  for (const t of teams) {
    const rawClub = (t.clubName ?? '').trim();
    if (!rawClub) continue;
    const key = normalizeTextToken(rawClub);
    if (!key) continue;
    const existing = explicitCounts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      explicitCounts.set(key, { label: rawClub, count: 1 });
    }
  }
  if (explicitCounts.size > 0) {
    return Array.from(explicitCounts.values()).sort((a, b) => b.count - a.count)[0].label;
  }

  if (teams.length === 1) return teams[0].nombre.trim();

  const cleanedCandidates = teams.map((t) => {
    const words = t.nombre.trim().split(/\s+/).filter(Boolean);
    const filtered = words.filter((w) => {
      const norm = normalizeTextToken(w);
      return norm.length > 0 && !CLUB_STRIP_TOKENS.has(norm);
    });
    return filtered.length > 0 ? filtered.join(' ') : t.nombre.trim();
  });

  // Prefer the cleanest, shortest non-empty base representation (preserving diacritics/casing)
  const counts = new Map<string, { label: string; count: number }>();
  for (const cand of cleanedCandidates) {
    const key = normalizeTextToken(cand);
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
      // Prefer version with accents or nicer casing (not all-lowercase)
      if (cand.length > existing.label.length) {
        existing.label = cand;
      }
    } else {
      counts.set(key, { label: cand, count: 1 });
    }
  }

  const ranked = Array.from(counts.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.label.length - b.label.length;
  });

  return ranked[0]?.label ?? teams[0].nombre.trim();
}

const ES_COLLATOR = new Intl.Collator('es', { sensitivity: 'base' });

interface NormalizedPlayerKeys {
  id: string;
  rutKey: string;
  emailKey: string;
  matKey: string;
  shortKey: string;
  fullKey: string;
  hasMaternal: boolean;
  careerKey: string;
}

function extractNormalizedPlayerKeys(p: Player): NormalizedPlayerKeys {
  const rutKey = normalizeRutKey(p.rut);
  const rawEmail = (p.correoInstitucional ?? '').trim().toLowerCase();
  const emailKey = rawEmail.includes('@') ? rawEmail : '';
  const rawMat = normalizeTextToken(p.numeroMatricula);
  const matKey = rawMat.length >= 6 ? rawMat : '';

  const first = normalizeTextToken(p.nombre);
  const paternal = normalizeTextToken(p.apellidoPaterno);
  const maternal = normalizeTextToken(p.apellidoMaterno);
  const shortKey = first && paternal ? `${first} ${paternal}` : first || paternal;
  const fullKey = maternal ? (shortKey ? `${shortKey} ${maternal}` : maternal) : shortKey;
  const careerKey = normalizeTextToken(p.carrera);

  return {
    id: p.id,
    rutKey,
    emailKey,
    matKey,
    shortKey,
    fullKey,
    hasMaternal: maternal.length > 0,
    careerKey,
  };
}

/**
 * Zero-allocation equivalence check operating on precomputed normalized player keys.
 * Preserves exact negative-signal guards (two records with different RUT/email/matrícula
 * never merge even if they share a full name).
 */
function areNormalizedKeysSamePerson(a: NormalizedPlayerKeys, b: NormalizedPlayerKeys): boolean {
  if (a.id === b.id) return true;

  // 1. Strongest signal: normalized RUT match
  if (a.rutKey && b.rutKey) {
    return a.rutKey === b.rutKey;
  }

  // 2. Institutional email match
  if (a.emailKey && b.emailKey) {
    return a.emailKey === b.emailKey;
  }

  // 3. Student registration number (matrícula) match
  if (a.matKey && b.matKey) {
    return a.matKey === b.matKey;
  }

  // 4. Normalized full name match (requires at least first name + paternal surname)
  if (!a.shortKey || !b.shortKey || !a.shortKey.includes(' ')) {
    return false;
  }

  if (a.fullKey === b.fullKey) {
    return true;
  }

  // 5. One record omitted apellidoMaterno while nombre + apellidoPaterno match exactly
  if ((!a.hasMaternal || !b.hasMaternal) && a.shortKey === b.shortKey) {
    if (!a.careerKey || !b.careerKey || a.careerKey === b.careerKey) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether two player records refer to the same real student across multiple teams/disciplines.
 */
export function isSamePerson(a: Player, b: Player): boolean {
  if (a.id === b.id) return true;
  return areNormalizedKeysSamePerson(
    extractNormalizedPlayerKeys(a),
    extractNormalizedPlayerKeys(b)
  );
}

/**
 * Consolidates all Player records belonging to the same student across different teams
 * and disciplines into a single UnifiedPlayerProfile per person.
 *
 * Uses O(N) precomputed key extraction + hash-bucketed Disjoint Set Union (Union-Find)
 * so thousands of student records unify in a few milliseconds without blocking the UI.
 */
export function buildUnifiedPlayers(
  players: Player[],
  teams: Team[]
): UnifiedPlayerProfile[] {
  const n = players.length;
  if (n === 0) return [];

  const teamMap = new Map<string, Team>();
  for (const t of teams) teamMap.set(t.id, t);

  // 1. Single O(N) pass: precompute normalized identity keys once per player
  const keys: NormalizedPlayerKeys[] = new Array(n);
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    keys[i] = extractNormalizedPlayerKeys(players[i]);
    parent[i] = i;
  }

  const find = (x: number): number => {
    let root = x;
    while (parent[root] !== root) {
      root = parent[root];
    }
    let curr = x;
    while (parent[curr] !== root) {
      const next = parent[curr];
      parent[curr] = root;
      curr = next;
    }
    return root;
  };

  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) {
      if (ra < rb) parent[rb] = ra;
      else parent[ra] = rb;
    }
  };

  // 2. Hash-bucketed matching (O(N) expected time)
  const byRut = new Map<string, number>();
  const byEmail = new Map<string, number[]>();
  const byMat = new Map<string, number[]>();
  const byShortName = new Map<string, number[]>();

  for (let i = 0; i < n; i++) {
    const ki = keys[i];

    if (ki.rutKey) {
      const firstIdx = byRut.get(ki.rutKey);
      if (firstIdx !== undefined) {
        union(i, firstIdx);
      } else {
        byRut.set(ki.rutKey, i);
      }
    }

    if (ki.emailKey) {
      const bucket = byEmail.get(ki.emailKey);
      if (bucket) {
        for (let b = 0; b < bucket.length; b++) {
          if (areNormalizedKeysSamePerson(ki, keys[bucket[b]])) {
            union(i, bucket[b]);
            break;
          }
        }
        bucket.push(i);
      } else {
        byEmail.set(ki.emailKey, [i]);
      }
    }

    if (ki.matKey) {
      const bucket = byMat.get(ki.matKey);
      if (bucket) {
        for (let b = 0; b < bucket.length; b++) {
          if (areNormalizedKeysSamePerson(ki, keys[bucket[b]])) {
            union(i, bucket[b]);
            break;
          }
        }
        bucket.push(i);
      } else {
        byMat.set(ki.matKey, [i]);
      }
    }

    if (ki.shortKey && ki.shortKey.includes(' ')) {
      const bucket = byShortName.get(ki.shortKey);
      if (bucket) {
        for (let b = 0; b < bucket.length; b++) {
          if (areNormalizedKeysSamePerson(ki, keys[bucket[b]])) {
            union(i, bucket[b]);
          }
        }
        bucket.push(i);
      } else {
        byShortName.set(ki.shortKey, [i]);
      }
    }
  }

  // 3. Collect connected components into groups
  const groupIndices = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const grp = groupIndices.get(root);
    if (grp) grp.push(i);
    else groupIndices.set(root, [i]);
  }

  // 4. Build unified profiles
  const profiles: UnifiedPlayerProfile[] = [];
  for (const idxList of groupIndices.values()) {
    if (idxList.length > 1) {
      idxList.sort((ia, ib) => {
        const a = players[ia];
        const b = players[ib];
        const scoreA =
          (a.fotografia ? 4 : 0) +
          (keys[ia].rutKey ? 3 : 0) +
          (a.apellidoMaterno.trim() ? 2 : 0) +
          (a.correoInstitucional.trim() ? 1 : 0);
        const scoreB =
          (b.fotografia ? 4 : 0) +
          (keys[ib].rutKey ? 3 : 0) +
          (b.apellidoMaterno.trim() ? 2 : 0) +
          (b.correoInstitucional.trim() ? 1 : 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.disciplineId.localeCompare(b.disciplineId);
      });
    }

    const primaryIdx = idxList[0];
    const primaryRecord = players[primaryIdx];
    const primaryKeys = keys[primaryIdx];

    const records: Player[] = new Array(idxList.length);
    const participations: PlayerParticipation[] = new Array(idxList.length);
    const disciplineSet = new Set<DisciplineId>();
    const teamIdSet = new Set<string>();
    let totalPartidosJugados = 0;
    let esSeleccionadoUfro = false;

    for (let k = 0; k < idxList.length; k++) {
      const p = players[idxList[k]];
      records[k] = p;
      participations[k] = {
        player: p,
        team: teamMap.get(p.teamId),
        disciplineId: p.disciplineId,
      };
      disciplineSet.add(p.disciplineId);
      teamIdSet.add(p.teamId);
      totalPartidosJugados += p.stats?.partidosJugados ?? 0;
      if (p.esSeleccionadoUfro) esSeleccionadoUfro = true;
    }

    const personKey = primaryKeys.rutKey
      ? `rut:${primaryKeys.rutKey}`
      : `name:${primaryKeys.fullKey || primaryRecord.id}`;

    profiles.push({
      personKey,
      primaryRecord,
      records,
      participations,
      disciplines: Array.from(disciplineSet),
      teamIds: Array.from(teamIdSet),
      totalPartidosJugados,
      esSeleccionadoUfro,
    });
  }

  // Ensure unique personKeys if two distinct people share a name (e.g. different RUTs, one missing)
  const usedKeys = new Set<string>();
  for (const profile of profiles) {
    if (usedKeys.has(profile.personKey)) {
      profile.personKey = `${profile.personKey}:${profile.primaryRecord.id}`;
    }
    usedKeys.add(profile.personKey);
  }

  profiles.sort((a, b) => {
    const nameA = `${a.primaryRecord.nombre} ${a.primaryRecord.apellidoPaterno}`;
    const nameB = `${b.primaryRecord.nombre} ${b.primaryRecord.apellidoPaterno}`;
    return ES_COLLATOR.compare(nameA, nameB);
  });

  return profiles;
}

/**
 * Finds all team/discipline participations for a given player record.
 */
export function findPlayerParticipations(
  target: Player,
  allPlayers: Player[],
  teams: Team[]
): PlayerParticipation[] {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const targetKeys = extractNormalizedPlayerKeys(target);
  const matching: Player[] = [];
  for (let i = 0; i < allPlayers.length; i++) {
    const candidate = allPlayers[i];
    if (
      candidate.id === target.id ||
      areNormalizedKeysSamePerson(extractNormalizedPlayerKeys(candidate), targetKeys)
    ) {
      matching.push(candidate);
    }
  }
  const list = matching.length > 0 ? matching : [target];
  return list.map((p) => ({
    player: p,
    team: teamMap.get(p.teamId),
    disciplineId: p.disciplineId,
  }));
}

/**
 * Determines whether two Team records belong to the same unified club.
 * If both specify an explicit `clubName`, compares those directly; if only one
 * specifies `clubName`, compares it against the other's name; otherwise falls
 * back to normalized team-name equivalence.
 */
export function areTeamsInSameClub(a: Team, b: Team): boolean {
  const clubA = (a.clubName ?? '').trim();
  const clubB = (b.clubName ?? '').trim();
  if (clubA && clubB) {
    return normalizeTextToken(clubA) === normalizeTextToken(clubB);
  }
  if (clubA && !clubB) {
    return areClubNamesEquivalent(clubA, b.nombre);
  }
  if (!clubA && clubB) {
    return areClubNamesEquivalent(a.nombre, clubB);
  }
  return areClubNamesEquivalent(a.nombre, b.nombre);
}

/**
 * Consolidates teams with the same explicit clubName or equivalent club name
 * across multiple disciplines into unified clubs.
 */
export function buildUnifiedClubs(
  teams: Team[],
  players: Player[],
  matches: Match[]
): UnifiedClubProfile[] {
  const groups: Team[][] = [];

  for (const team of teams) {
    const existingGroup = groups.find((grp) =>
      grp.some((member) => areTeamsInSameClub(member, team))
    );
    if (existingGroup) {
      existingGroup.push(team);
    } else {
      groups.push([team]);
    }
  }

  // Pre-index players by teamId in O(P) instead of scanning all players per club
  const playersByTeam = new Map<string, Player[]>();
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const list = playersByTeam.get(p.teamId);
    if (list) list.push(p);
    else playersByTeam.set(p.teamId, [p]);
  }

  // Pre-filter finalized matches once
  const finalizedMatches = matches.filter((m) => m.status === 'FINALIZADO');

  return groups
    .map((clubTeams) => {
      const sortedTeams = [...clubTeams].sort((a, b) => {
        // Prefer team with crest, then by discipline order / name
        if (Boolean(b.escudo) !== Boolean(a.escudo)) return b.escudo ? 1 : -1;
        return a.disciplineId.localeCompare(b.disciplineId);
      });

      const primaryTeam = sortedTeams[0];
      const displayName = formatUnifiedClubDisplayName(sortedTeams);
      const clubKey = normalizeClubBaseName(displayName) || primaryTeam.id;
      const teamIdSet = new Set(sortedTeams.map((t) => t.id));
      const disciplines = Array.from(new Set(sortedTeams.map((t) => t.disciplineId)));
      const careers = Array.from(new Set(sortedTeams.map((t) => t.carrera).filter(Boolean)));
      const faculties = Array.from(new Set(sortedTeams.map((t) => t.facultad).filter(Boolean)));

      const escudo = sortedTeams.find((t) => Boolean(t.escudo))?.escudo;
      const years = sortedTeams
        .map((t) => t.anioFundacion)
        .filter((y): y is number => typeof y === 'number' && Number.isFinite(y));
      const anioFundacion = years.length > 0 ? Math.min(...years) : undefined;

      const logrosList = Array.from(
        new Set(
          sortedTeams
            .map((t) => (t.logrosAnteriores ?? '').trim())
            .filter((val) => Boolean(val) && !/^[-–—\s.]+$/.test(val))
        )
      );
      const logrosAnteriores = logrosList.length > 0 ? logrosList.join(' · ') : undefined;

      // Count unique individuals across all squads of this club
      const clubPlayers: Player[] = [];
      for (const tid of teamIdSet) {
        const roster = playersByTeam.get(tid);
        if (roster) {
          for (let i = 0; i < roster.length; i++) clubPlayers.push(roster[i]);
        }
      }
      const uniquePlayerCount = buildUnifiedPlayers(clubPlayers, sortedTeams).length;

      // Count total finalized matches & wins across all squads
      let totalMatchesPlayed = 0;
      let totalWins = 0;
      for (let i = 0; i < finalizedMatches.length; i++) {
        const m = finalizedMatches[i];
        const isHome = teamIdSet.has(m.homeTeamId);
        const isAway = teamIdSet.has(m.awayTeamId);
        if (!isHome && !isAway) continue;
        totalMatchesPlayed += 1;
        if (isHome && m.homeScore > m.awayScore) totalWins += 1;
        if (isAway && m.awayScore > m.homeScore) totalWins += 1;
      }

      return {
        clubKey,
        displayName,
        primaryTeam,
        teams: sortedTeams,
        disciplines,
        careers,
        faculties,
        escudo,
        sigla: primaryTeam.sigla,
        anioFundacion,
        logrosAnteriores,
        uniquePlayerCount,
        totalMatchesPlayed,
        totalWins,
      };
    })
    .sort((a, b) => ES_COLLATOR.compare(a.displayName, b.displayName));
}

/**
 * Given any single Team ID, returns all Team records belonging to the same unified club
 * (including itself), plus the unified display name.
 */
export function findClubSquadsForTeam(
  targetTeam: Team,
  allTeams: Team[]
): { displayName: string; squads: Team[] } {
  const squads = allTeams.filter((t) => areTeamsInSameClub(t, targetTeam));
  const resolved = squads.length > 0 ? squads : [targetTeam];
  const sorted = [...resolved].sort((a, b) => a.disciplineId.localeCompare(b.disciplineId));
  return {
    displayName: formatUnifiedClubDisplayName(sorted),
    squads: sorted,
  };
}
