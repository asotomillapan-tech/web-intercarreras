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

/**
 * Checks whether two player records refer to the same real student across multiple teams/disciplines.
 */
export function isSamePerson(a: Player, b: Player): boolean {
  if (a.id === b.id) return true;

  // 1. Strongest signal: normalized RUT match
  const rutA = normalizeRutKey(a.rut);
  const rutB = normalizeRutKey(b.rut);
  if (rutA && rutB) {
    return rutA === rutB;
  }

  // 2. Institutional email match
  const emailA = (a.correoInstitucional ?? '').trim().toLowerCase();
  const emailB = (b.correoInstitucional ?? '').trim().toLowerCase();
  if (emailA && emailB && emailA.includes('@') && emailB.includes('@')) {
    return emailA === emailB;
  }

  // 3. Student registration number (matrícula) match
  const matA = normalizeTextToken(a.numeroMatricula);
  const matB = normalizeTextToken(b.numeroMatricula);
  if (matA && matB && matA.length >= 6 && matB.length >= 6) {
    return matA === matB;
  }

  // 4. Normalized full name match (works even for public visitors when PII is hidden)
  const nameA = normalizePlayerNameParts(a);
  const nameB = normalizePlayerNameParts(b);

  // Require at least first name + paternal surname to avoid merging single-word nicknames
  if (!nameA.shortKey || !nameB.shortKey || !nameA.shortKey.includes(' ')) {
    return false;
  }

  // Exact full name match
  if (nameA.fullKey === nameB.fullKey) {
    return true;
  }

  // If one record omitted apellidoMaterno while nombre + apellidoPaterno match exactly
  const hasMatA = normalizeTextToken(a.apellidoMaterno).length > 0;
  const hasMatB = normalizeTextToken(b.apellidoMaterno).length > 0;
  if ((!hasMatA || !hasMatB) && nameA.shortKey === nameB.shortKey) {
    // Extra safety: if both have careers populated, require matching career (or one empty)
    const carA = normalizeTextToken(a.carrera);
    const carB = normalizeTextToken(b.carrera);
    if (!carA || !carB || carA === carB) {
      return true;
    }
  }

  return false;
}

/**
 * Consolidates all Player records belonging to the same student across different teams
 * and disciplines into a single UnifiedPlayerProfile per person.
 */
export function buildUnifiedPlayers(
  players: Player[],
  teams: Team[]
): UnifiedPlayerProfile[] {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const groups: Player[][] = [];

  for (const player of players) {
    const existingGroup = groups.find((grp) => grp.some((member) => isSamePerson(member, player)));
    if (existingGroup) {
      existingGroup.push(player);
    } else {
      groups.push([player]);
    }
  }

  return groups
    .map((records) => {
      // Pick the richest record as primary (prefer one with photo, RUT, maternal surname)
      const sortedRecords = [...records].sort((a, b) => {
        const score = (p: Player) =>
          (p.fotografia ? 4 : 0) +
          (normalizeRutKey(p.rut) ? 3 : 0) +
          (p.apellidoMaterno.trim() ? 2 : 0) +
          (p.correoInstitucional.trim() ? 1 : 0);
        const diff = score(b) - score(a);
        if (diff !== 0) return diff;
        return a.disciplineId.localeCompare(b.disciplineId);
      });

      const primaryRecord = sortedRecords[0];
      const participations: PlayerParticipation[] = sortedRecords.map((p) => ({
        player: p,
        team: teamMap.get(p.teamId),
        disciplineId: p.disciplineId,
      }));

      const disciplines = Array.from(new Set(sortedRecords.map((p) => p.disciplineId)));
      const teamIds = Array.from(new Set(sortedRecords.map((p) => p.teamId)));
      const totalPartidosJugados = sortedRecords.reduce(
        (sum, p) => sum + (p.stats?.partidosJugados ?? 0),
        0
      );
      const esSeleccionadoUfro = sortedRecords.some((p) => p.esSeleccionadoUfro);

      const rutKey = normalizeRutKey(primaryRecord.rut);
      const { fullKey } = normalizePlayerNameParts(primaryRecord);
      const personKey = rutKey ? `rut:${rutKey}` : `name:${fullKey || primaryRecord.id}`;

      return {
        personKey,
        primaryRecord,
        records: sortedRecords,
        participations,
        disciplines,
        teamIds,
        totalPartidosJugados,
        esSeleccionadoUfro,
      };
    })
    .sort((a, b) => {
      const nameA = `${a.primaryRecord.nombre} ${a.primaryRecord.apellidoPaterno}`;
      const nameB = `${b.primaryRecord.nombre} ${b.primaryRecord.apellidoPaterno}`;
      return nameA.localeCompare(nameB, 'es');
    });
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
  const matching = allPlayers.filter((p) => isSamePerson(p, target));
  const list = matching.length > 0 ? matching : [target];
  return list.map((p) => ({
    player: p,
    team: teamMap.get(p.teamId),
    disciplineId: p.disciplineId,
  }));
}

/**
 * Consolidates teams with the same or very similar club name across multiple disciplines
 * into unified clubs (e.g. "Real Efineza FEM", "Real Efineza FC", "Real Efineza Básquetbol"
 * -> single club "Real Efineza"). Teams with genuinely different names remain separate even
 * if they belong to the same career.
 */
export function buildUnifiedClubs(
  teams: Team[],
  players: Player[],
  matches: Match[]
): UnifiedClubProfile[] {
  const groups: Team[][] = [];

  for (const team of teams) {
    const existingGroup = groups.find((grp) =>
      grp.some((member) => areClubNamesEquivalent(member.nombre, team.nombre))
    );
    if (existingGroup) {
      existingGroup.push(team);
    } else {
      groups.push([team]);
    }
  }

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
      const clubPlayers = players.filter((p) => teamIdSet.has(p.teamId));
      const uniquePlayerCount = buildUnifiedPlayers(clubPlayers, sortedTeams).length;

      // Count total finalized matches & wins across all squads
      let totalMatchesPlayed = 0;
      let totalWins = 0;
      for (const m of matches) {
        if (m.status !== 'FINALIZADO') continue;
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
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));
}

/**
 * Given any single Team ID, returns all Team records belonging to the same unified club
 * (including itself), plus the unified display name.
 */
export function findClubSquadsForTeam(
  targetTeam: Team,
  allTeams: Team[]
): { displayName: string; squads: Team[] } {
  const squads = allTeams.filter((t) => areClubNamesEquivalent(t.nombre, targetTeam.nombre));
  const resolved = squads.length > 0 ? squads : [targetTeam];
  const sorted = [...resolved].sort((a, b) => a.disciplineId.localeCompare(b.disciplineId));
  return {
    displayName: formatUnifiedClubDisplayName(sorted),
    squads: sorted,
  };
}
