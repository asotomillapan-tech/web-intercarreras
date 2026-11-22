import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  Crown,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
import {
  aggregateChampionshipMvpVotes,
  aggregatePositionAwardVotes,
  computeCommunityToty,
  getEligiblePlayersForPosition,
  getPositionsForSport,
  getTotyFormationForSport,
  normalizeTotyBallotSelections,
} from '../domain/awardsEngine';
import { filterMatchesByOrg } from '../domain/matchFilterEngine';
import {
  canVoteMatchMvp,
  computeMatchMvpStandings,
  shouldRevealPublicMatchData,
} from '../domain/rbacEngine';
import type {
  AppUserProfile,
  DisciplineId,
  Match,
  MatchPhase,
  Player,
  Team,
  TournamentState,
} from '../types/tournament';
import { MatchFilterBar } from './MatchFilterBar';
import { TeamCrest } from './TeamCrest';

type VotationTab = 'potm' | 'mvp' | 'posiciones' | 'toty';

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function playerMatchesQuery(player: Player, team: Team | undefined, rawQuery: string): boolean {
  const q = normalizeSearchText(rawQuery);
  if (!q) return true;
  const haystack = normalizeSearchText(
    `${player.nombre} ${player.apellidoPaterno} ${player.apellidoMaterno ?? ''} #${player.dorsal} ${player.dorsal} ${player.posicion} ${player.carrera} ${team?.nombre ?? ''} ${team?.sigla ?? ''}`
  );
  return q.split(/\s+/).every((token) => haystack.includes(token));
}

interface TotyPlayerSearchPickerProps {
  posKey: string;
  shortCode: string;
  label: string;
  matched: Player[];
  all: Player[];
  teamMap: Map<string, Team>;
  selectedPlayerId: string;
  excludedPlayerIds?: Set<string>;
  highlightAccent?: boolean;
  onSelect: (playerId: string) => void;
}

function TotyPlayerSearchPicker({
  posKey,
  shortCode,
  label,
  matched,
  all,
  teamMap,
  selectedPlayerId,
  excludedPlayerIds,
  highlightAccent = false,
  onSelect,
}: TotyPlayerSearchPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selectedPlayer = useMemo(
    () => all.find((p) => p.id === selectedPlayerId),
    [all, selectedPlayerId]
  );
  const selectedTeam = selectedPlayer ? teamMap.get(selectedPlayer.teamId) : undefined;

  const matchedIdSet = useMemo(() => new Set(matched.map((p) => p.id)), [matched]);

  const results = useMemo(() => {
    const q = normalizeSearchText(query);
    if (!q) {
      // Show specialists first, then rest of discipline
      const rest = all.filter((p) => !matchedIdSet.has(p.id));
      return [...matched, ...rest].slice(0, 20);
    }
    const filtered = all.filter((p) => playerMatchesQuery(p, teamMap.get(p.teamId), q));
    // Rank position specialists first among search hits
    return filtered.sort((a, b) => {
      const aSpec = matchedIdSet.has(a.id) ? 0 : 1;
      const bSpec = matchedIdSet.has(b.id) ? 0 : 1;
      return aSpec - bSpec;
    });
  }, [query, matched, all, matchedIdSet, teamMap]);

  return (
    <div className="space-y-1.5 relative">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#0d0d0d]">
        <label htmlFor={`toty-search-${posKey}`} className="flex items-center gap-1.5">
          <span
            className={`font-mono text-[10px] px-1.5 py-0.5 ${
              highlightAccent
                ? 'bg-[#707ef9] text-white'
                : 'bg-[#0d0d0d] text-white'
            }`}
          >
            {shortCode}
          </span>
          <span>{label}</span>
        </label>
        {matched.length > 0 && (
          <span className="font-normal text-[11px] text-neutral-500">
            {matched.length} en posición
          </span>
        )}
      </div>

      {selectedPlayer && !open ? (
        <div className="border border-[#707ef9] bg-[#707ef9]/5 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <TeamCrest
              escudo={selectedTeam?.escudo}
              sigla={selectedTeam?.sigla ?? 'EQ'}
              nombre={selectedTeam?.nombre ?? selectedPlayer.teamId}
              size="xs"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#0d0d0d] truncate">
                #{selectedPlayer.dorsal} {selectedPlayer.nombre} {selectedPlayer.apellidoPaterno}
              </p>
              <p className="text-[11px] text-neutral-500 truncate">
                {selectedTeam?.nombre ?? selectedPlayer.teamId} · {selectedPlayer.posicion}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setOpen(true);
              }}
              className="text-[11px] font-medium text-[#707ef9] hover:underline cursor-pointer"
            >
              Cambiar
            </button>
            <button
              type="button"
              onClick={() => {
                onSelect('');
                setQuery('');
              }}
              aria-label={`Quitar selección de ${label}`}
              className="p-1 text-neutral-400 hover:text-red-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id={`toty-search-${posKey}`}
              type="text"
              value={query}
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              placeholder={`Buscar jugador para ${label} (nombre, dorsal o equipo)...`}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm border border-neutral-300 bg-white focus:border-[#707ef9] focus:outline-none"
            />
            {(query || open) && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setOpen(false);
                }}
                aria-label="Cerrar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-[#0d0d0d] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {open && (
            <div
              role="listbox"
              aria-label={`Opciones de jugadores para ${label}`}
              className="border border-neutral-300 bg-white max-h-52 overflow-y-auto divide-y divide-neutral-100 shadow-lg"
            >
              {results.length === 0 ? (
                <p className="px-3 py-3 text-xs text-neutral-500 text-center">
                  Sin jugadores que coincidan con &ldquo;{query}&rdquo;.
                </p>
              ) : (
                results.map((p) => {
                  const tm = teamMap.get(p.teamId);
                  const isSpec = matchedIdSet.has(p.id);
                  const isCurrent = p.id === selectedPlayerId;
                  const isUsedElsewhere = Boolean(
                    excludedPlayerIds && excludedPlayerIds.has(p.id) && !isCurrent
                  );
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="option"
                      aria-selected={isCurrent}
                      disabled={isUsedElsewhere}
                      onClick={() => {
                        if (isUsedElsewhere) return;
                        onSelect(p.id);
                        setQuery('');
                        setOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
                        isUsedElsewhere
                          ? 'bg-neutral-50 opacity-50 cursor-not-allowed'
                          : isCurrent
                          ? 'bg-[#707ef9]/10 cursor-pointer'
                          : 'hover:bg-[#f5f6f8] cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <TeamCrest
                          escudo={tm?.escudo}
                          sigla={tm?.sigla ?? 'EQ'}
                          nombre={tm?.nombre ?? p.teamId}
                          size="xs"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#0d0d0d] truncate">
                            #{p.dorsal} {p.nombre} {p.apellidoPaterno}
                          </p>
                          <p className="text-[11px] text-neutral-500 truncate">
                            {tm?.nombre ?? p.teamId} · {p.posicion}
                          </p>
                        </div>
                      </div>
                      {isUsedElsewhere ? (
                        <span className="text-[10px] font-mono uppercase text-neutral-500 font-semibold shrink-0">
                          Ya en tu TOTY
                        </span>
                      ) : isSpec ? (
                        <span className="text-[10px] font-mono uppercase text-[#707ef9] font-semibold shrink-0">
                          Posición
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface VotationsViewProps {
  state: TournamentState;
  selectedDiscipline: DisciplineId;
  currentUser: AppUserProfile | null;
  onSelectDiscipline: (id: DisciplineId) => void;
  onOpenAuth: () => void;
  onOpenMatchMvp: (match: Match) => void;
  onVoteChampionshipMvp: (disciplineId: DisciplineId, player: Player) => Promise<void> | void;
  onVotePositionAward: (
    disciplineId: DisciplineId,
    positionKey: string,
    positionLabel: string,
    player: Player
  ) => Promise<void> | void;
  onSubmitTotyBallot: (
    disciplineId: DisciplineId,
    selections: Record<string, string>
  ) => Promise<void> | void;
}

export function VotationsView({
  state,
  selectedDiscipline,
  currentUser,
  onSelectDiscipline,
  onOpenAuth,
  onOpenMatchMvp,
  onVoteChampionshipMvp,
  onVotePositionAward,
  onSubmitTotyBallot,
}: VotationsViewProps) {
  const [activeTab, setActiveTab] = useState<VotationTab>('potm');
  const [potmDisciplineFilter, setPotmDisciplineFilter] = useState<'ALL' | DisciplineId>(
    selectedDiscipline
  );
  const [potmGroupFilter, setPotmGroupFilter] = useState<'ALL' | string>('ALL');
  const [potmStageFilter, setPotmStageFilter] = useState<'ALL' | MatchPhase>('ALL');
  const [selectedPositionKey, setSelectedPositionKey] = useState<string>('');
  const [showAllPlayersForPosition, setShowAllPlayersForPosition] = useState(false);
  const [positionPlayerSearch, setPositionPlayerSearch] = useState('');
  const [positionTeamFilter, setPositionTeamFilter] = useState<'ALL' | string>('ALL');
  const [totyDraft, setTotyDraft] = useState<Record<string, string>>({});
  const [totyBoardMode, setTotyBoardMode] = useState<'community' | 'draft'>('community');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const discMeta = DISCIPLINE_MAP[selectedDiscipline];
  const sportPositions = useMemo(
    () => getPositionsForSport(discMeta.sportType),
    [discMeta.sportType]
  );
  const totyFormation = useMemo(
    () => getTotyFormationForSport(discMeta.sportType),
    [discMeta.sportType]
  );

  // Keep selectedPositionKey & POTM filters valid when switching discipline/sport
  useEffect(() => {
    if (!sportPositions.some((p) => p.key === selectedPositionKey)) {
      setSelectedPositionKey(sportPositions[0]?.key ?? '');
    }
    setPotmDisciplineFilter(selectedDiscipline);
    setPotmGroupFilter('ALL');
    setPotmStageFilter('ALL');
    setShowAllPlayersForPosition(false);
    setPositionPlayerSearch('');
    setPositionTeamFilter('ALL');
    setFeedbackMsg(null);
  }, [selectedDiscipline, sportPositions, selectedPositionKey]);

  const teamMap = useMemo(() => new Map(state.teams.map((t) => [t.id, t])), [state.teams]);

  const disciplinePlayers = useMemo(
    () =>
      state.players
        .filter((p) => p.disciplineId === selectedDiscipline)
        .sort((a, b) =>
          `${a.nombre} ${a.apellidoPaterno}`.localeCompare(
            `${b.nombre} ${b.apellidoPaterno}`,
            'es'
          )
        ),
    [state.players, selectedDiscipline]
  );

  const sortedAllMatches = useMemo(
    () =>
      [...state.matches].sort((a, b) =>
        `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`)
      ),
    [state.matches]
  );

  const filteredPotmMatches = useMemo(
    () =>
      filterMatchesByOrg(sortedAllMatches, {
        disciplineId: potmDisciplineFilter,
        groupName: potmGroupFilter,
        fase: potmStageFilter,
      }),
    [sortedAllMatches, potmDisciplineFilter, potmGroupFilter, potmStageFilter]
  );

  // Sync user's existing TOTY ballot into local draft when discipline or user changes
  const existingTotyBallot = useMemo(() => {
    if (!currentUser) return undefined;
    return state.totyBallots.find(
      (b) => b.disciplineId === selectedDiscipline && b.voterUid === currentUser.uid
    );
  }, [state.totyBallots, selectedDiscipline, currentUser]);

  useEffect(() => {
    setTotyDraft(
      existingTotyBallot?.selections
        ? normalizeTotyBallotSelections(existingTotyBallot.selections, discMeta.sportType)
        : {}
    );
  }, [existingTotyBallot, selectedDiscipline, discMeta.sportType]);

  // --- POTM Matches Categorization ---
  const potmBuckets = useMemo(() => {
    const openNow: Match[] = [];
    const finalized: Match[] = [];
    const upcoming: Match[] = [];
    filteredPotmMatches.forEach((m) => {
      if (canVoteMatchMvp(m)) {
        openNow.push(m);
      } else if (shouldRevealPublicMatchData(m)) {
        finalized.push(m);
      } else {
        upcoming.push(m);
      }
    });
    return { openNow, finalized, upcoming };
  }, [filteredPotmMatches]);

  // --- Championship MVP Aggregation ---
  const nomineeIds = state.awardNominees[selectedDiscipline] ?? [];
  const championshipMvpSummary = useMemo(
    () =>
      aggregateChampionshipMvpVotes(
        selectedDiscipline,
        nomineeIds,
        state.championshipMvpVotes,
        state.players,
        state.teams
      ),
    [selectedDiscipline, nomineeIds, state.championshipMvpVotes, state.players, state.teams]
  );

  const userChampionshipMvpVote = useMemo(() => {
    if (!currentUser) return undefined;
    return state.championshipMvpVotes.find(
      (v) => v.disciplineId === selectedDiscipline && v.voterUid === currentUser.uid
    );
  }, [state.championshipMvpVotes, selectedDiscipline, currentUser]);

  // --- Position Awards Aggregation ---
  const positionAwardStandings = useMemo(
    () =>
      aggregatePositionAwardVotes(
        selectedDiscipline,
        discMeta.sportType,
        state.positionAwardVotes,
        state.players,
        state.teams
      ),
    [selectedDiscipline, discMeta.sportType, state.positionAwardVotes, state.players, state.teams]
  );

  const activePositionStanding =
    positionAwardStandings.find((s) => s.position.key === selectedPositionKey) ??
    positionAwardStandings[0];

  const eligibleForActivePosition = useMemo(() => {
    if (!activePositionStanding) return { matched: [], all: [] };
    return getEligiblePlayersForPosition(
      disciplinePlayers,
      discMeta.sportType,
      activePositionStanding.position.key
    );
  }, [disciplinePlayers, discMeta.sportType, activePositionStanding]);

  const disciplineTeams = useMemo(
    () =>
      state.teams
        .filter((t) => t.disciplineId === selectedDiscipline)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [state.teams, selectedDiscipline]
  );

  const positionCandidatesBase = useMemo(() => {
    // When user types a manual search query, search across ALL discipline players (ranking position matches first)
    // so they immediately find any player they look up by name/dorsal/team!
    if (positionPlayerSearch.trim().length > 0) {
      const matchedIds = new Set(eligibleForActivePosition.matched.map((p) => p.id));
      return [...eligibleForActivePosition.all].sort((a, b) => {
        const aSpec = matchedIds.has(a.id) ? 0 : 1;
        const bSpec = matchedIds.has(b.id) ? 0 : 1;
        return aSpec - bSpec;
      });
    }
    return !showAllPlayersForPosition && eligibleForActivePosition.matched.length > 0
      ? eligibleForActivePosition.matched
      : eligibleForActivePosition.all;
  }, [eligibleForActivePosition, showAllPlayersForPosition, positionPlayerSearch]);

  const positionCandidatesToDisplay = useMemo(
    () =>
      positionCandidatesBase.filter((pl) => {
        if (positionTeamFilter !== 'ALL' && pl.teamId !== positionTeamFilter) return false;
        return playerMatchesQuery(pl, teamMap.get(pl.teamId), positionPlayerSearch);
      }),
    [positionCandidatesBase, positionTeamFilter, positionPlayerSearch, teamMap]
  );

  const userPositionVote = useMemo(() => {
    if (!currentUser || !activePositionStanding) return undefined;
    return state.positionAwardVotes.find(
      (v) =>
        v.disciplineId === selectedDiscipline &&
        v.positionKey === activePositionStanding.position.key &&
        v.voterUid === currentUser.uid
    );
  }, [state.positionAwardVotes, selectedDiscipline, activePositionStanding, currentUser]);

  // --- Community TOTY ---
  const communityToty = useMemo(
    () =>
      computeCommunityToty(
        selectedDiscipline,
        discMeta.sportType,
        state.totyBallots,
        state.players,
        state.teams
      ),
    [selectedDiscipline, discMeta.sportType, state.totyBallots, state.players, state.teams]
  );

  const handleChampionshipMvpClick = async (playerId: string) => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return;
    setSavingKey(`mvp-${playerId}`);
    setFeedbackMsg(null);
    try {
      await onVoteChampionshipMvp(selectedDiscipline, player);
      setFeedbackMsg(
        `Tu voto al MVP del Campeonato en ${discMeta.nombreCorto} fue registrado por ${player.nombre} ${player.apellidoPaterno}.`
      );
    } finally {
      setSavingKey(null);
    }
  };

  const handlePositionAwardClick = async (player: Player) => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    if (!activePositionStanding) return;
    setSavingKey(`pos-${player.id}`);
    setFeedbackMsg(null);
    try {
      await onVotePositionAward(
        selectedDiscipline,
        activePositionStanding.position.key,
        activePositionStanding.position.label,
        player
      );
      setFeedbackMsg(
        `Voto registrado para ${activePositionStanding.position.awardTitle}: ${player.nombre} ${player.apellidoPaterno}.`
      );
    } finally {
      setSavingKey(null);
    }
  };

  const totySelectedCount = useMemo(
    () =>
      totyFormation.slots.reduce(
        (acc, slot) => (totyDraft[slot.slotKey] ? acc + 1 : acc),
        0
      ),
    [totyFormation.slots, totyDraft]
  );

  const totyDraftPlayerIdSet = useMemo(() => {
    const ids = new Set<string>();
    totyFormation.slots.forEach((slot) => {
      const pid = totyDraft[slot.slotKey];
      if (pid) ids.add(pid);
    });
    return ids;
  }, [totyFormation.slots, totyDraft]);

  const totyRowsGrouped = useMemo(() => {
    const rowMap = new Map<
      number,
      { row: number; rowLabel: string; slots: typeof communityToty.slots }
    >();
    for (const slotRes of communityToty.slots) {
      const existing = rowMap.get(slotRes.slot.row);
      if (existing) {
        existing.slots.push(slotRes);
      } else {
        rowMap.set(slotRes.slot.row, {
          row: slotRes.slot.row,
          rowLabel: slotRes.slot.rowLabel,
          slots: [slotRes],
        });
      }
    }
    // Render top-to-bottom: Attack/Net (highest row) down to Goal/Base/Libero (row 0)
    return Array.from(rowMap.values()).sort((a, b) => b.row - a.row);
  }, [communityToty.slots]);

  const handleSaveToty = async () => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    const cleanSelections = normalizeTotyBallotSelections(totyDraft, discMeta.sportType);
    const selectedEntries = Object.entries(cleanSelections);
    if (selectedEntries.length === 0) {
      setFeedbackMsg('Selecciona al menos un jugador antes de guardar tu TOTY.');
      return;
    }
    setSavingKey('toty-save');
    setFeedbackMsg(null);
    try {
      await onSubmitTotyBallot(selectedDiscipline, cleanSelections);
      setFeedbackMsg(
        `Tu ${totyFormation.formationName} (${selectedEntries.length}/${totyFormation.slots.length}) para ${discMeta.nombreCorto} quedó guardado y sumado al recuento oficial.`
      );
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f6f8] pb-20">
      {/* Carbon Editorial Header */}
      <section className="bg-[#0d0d0d] text-white border-b border-white/10">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#707ef9] font-medium">
                Premios Oficiales de la Comunidad · Temporada {state.temporada}
              </p>
              <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-tight mt-2">
                Centro de Votaciones UFRO
              </h1>
              <p className="text-sm text-neutral-300 mt-2 max-w-2xl">
                Elige al <strong>Player of The Match (POTM)</strong> en cada encuentro, vota entre
                los 5 nominados al <strong>MVP del Campeonato</strong>, premia a los mejores por
                posición según deporte y construye el <strong>TOTY oficial</strong>.
              </p>
            </div>

            {!currentUser ? (
              <div className="bg-white/5 border border-white/15 px-4 py-3 flex items-center justify-between gap-4">
                <div className="text-xs text-neutral-300">
                  <p className="font-semibold text-white">Votación verificada por cuenta</p>
                  <p>Inicia sesión con Google para emitir o actualizar tus votos.</p>
                </div>
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="px-3.5 py-2 bg-[#707ef9] hover:bg-white hover:text-[#0d0d0d] text-white text-xs font-display font-bold uppercase tracking-wider whitespace-nowrap transition-colors cursor-pointer"
                >
                  Ingresar
                </button>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/15 px-4 py-3 flex items-center gap-3 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-semibold text-white">{currentUser.displayName}</p>
                  <p className="text-neutral-400">Habilitado para votar en todas las categorías</p>
                </div>
              </div>
            )}
          </div>

          {/* Discipline Switcher */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 border-t border-white/10 pt-5">
            {DISCIPLINES.map((d) => {
              const active = selectedDiscipline === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onSelectDiscipline(d.id)}
                  className={`px-3.5 py-2 text-xs font-display font-bold uppercase tracking-wider whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#707ef9] text-white'
                      : 'bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {d.nombreCorto}
                </button>
              );
            })}
          </div>

          {/* 4 Sub-tabs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-2">
            {(
              [
                {
                  id: 'potm',
                  label: 'POTM por Partido',
                  sub: 'Player of The Match',
                  icon: Star,
                },
                {
                  id: 'mvp',
                  label: 'MVP del Campeonato',
                  sub: '5 Nominados Oficiales',
                  icon: Trophy,
                },
                {
                  id: 'posiciones',
                  label: 'Premios por Posición',
                  sub: `${sportPositions.length} categorías · ${discMeta.nombreCorto}`,
                  icon: Award,
                },
                {
                  id: 'toty',
                  label: 'Equipo Ideal (TOTY)',
                  sub: `${communityToty.totalBallots} votos recibidos`,
                  icon: Crown,
                },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setFeedbackMsg(null);
                  }}
                  className={`text-left p-4 border transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-white text-[#0d0d0d] border-white'
                      : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-lg font-bold uppercase tracking-wide">
                      {tab.label}
                    </span>
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#707ef9]' : 'text-neutral-400'}`} />
                  </div>
                  <p className={`text-xs mt-1 ${isActive ? 'text-neutral-600' : 'text-neutral-400'}`}>
                    {tab.sub}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {feedbackMsg && (
          <div className="bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* ================================================================
            TAB 1: POTM POR PARTIDO (Player of The Match)
           ================================================================ */}
        {activeTab === 'potm' && (
          <div className="space-y-8">
            <MatchFilterBar
              idPrefix="potm"
              matches={sortedAllMatches}
              disciplineFilter={potmDisciplineFilter}
              onDisciplineChange={(val) => {
                setPotmDisciplineFilter(val);
                setPotmGroupFilter('ALL');
                if (val !== 'ALL') {
                  onSelectDiscipline(val);
                }
              }}
              groupFilter={potmGroupFilter}
              onGroupChange={setPotmGroupFilter}
              stageFilter={potmStageFilter}
              onStageChange={setPotmStageFilter}
              filteredCount={filteredPotmMatches.length}
              totalCount={sortedAllMatches.length}
              onReset={() => {
                setPotmDisciplineFilter(selectedDiscipline);
                setPotmGroupFilter('ALL');
                setPotmStageFilter('ALL');
              }}
              compact
            />

            {/* Active Voting Window */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3">
                <div>
                  <h2 className="font-display text-2xl font-bold uppercase text-[#0d0d0d]">
                    Votación POTM Abierta Ahora
                  </h2>
                  <p className="text-xs text-neutral-600">
                    Disponible durante la hora programada de cada encuentro en{' '}
                    {potmDisciplineFilter === 'ALL' ? 'todas las disciplinas' : discMeta.nombre}.
                  </p>
                </div>
                <span className="text-xs font-mono text-[#707ef9] font-semibold">
                  {potmBuckets.openNow.length} partido(s) en ventana activa
                </span>
              </div>

              {potmBuckets.openNow.length === 0 ? (
                <div className="bg-white border border-neutral-200 p-6 text-sm text-neutral-600 flex items-center gap-3">
                  <Clock className="w-5 h-5 text-neutral-400 shrink-0" />
                  <span>
                    No hay encuentros en horario de votación POTM activa en este momento para{' '}
                    <strong>
                      {potmDisciplineFilter === 'ALL' ? 'todas las disciplinas' : discMeta.nombre}
                    </strong>
                    . Revisa los partidos finalizados o próximos a disputarse abajo.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {potmBuckets.openNow.map((m) => {
                    const home = teamMap.get(m.homeTeamId);
                    const away = teamMap.get(m.awayTeamId);
                    const standings = computeMatchMvpStandings(m.id, state.mvpVotes);
                    const myVote = currentUser
                      ? state.mvpVotes.find((v) => v.matchId === m.id && v.voterUid === currentUser.uid)
                      : undefined;

                    return (
                      <div
                        key={m.id}
                        className="bg-white border border-[#707ef9] p-5 flex flex-col justify-between gap-4"
                      >
                        <div className="flex items-center justify-between text-xs text-neutral-500">
                          <span className="font-semibold text-[#707ef9] uppercase tracking-wider">
                            POTM Abierto · {m.fecha} {m.hora}
                          </span>
                          <span>{m.fase !== 'Grupos' ? m.fase : m.groupName}</span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <TeamCrest
                              escudo={home?.escudo}
                              sigla={home?.sigla ?? 'LOC'}
                              nombre={home?.nombre ?? m.homeTeamId}
                              size="sm"
                            />
                            <span className="font-display text-lg font-bold uppercase truncate">
                              {home?.nombre ?? m.homeTeamId}
                            </span>
                          </div>
                          <span className="text-xs font-mono text-neutral-400 shrink-0">VS</span>
                          <div className="flex items-center gap-2.5 min-w-0 justify-end">
                            <span className="font-display text-lg font-bold uppercase truncate text-right">
                              {away?.nombre ?? m.awayTeamId}
                            </span>
                            <TeamCrest
                              escudo={away?.escudo}
                              sigla={away?.sigla ?? 'VIS'}
                              nombre={away?.nombre ?? m.awayTeamId}
                              size="sm"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-3">
                          <span className="text-xs text-neutral-600">
                            {myVote
                              ? `Tu voto POTM: ${myVote.playerName}`
                              : `${standings.totalVotes} voto(s) acumulados`}
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenMatchMvp(m)}
                            className="px-4 py-2 bg-[#707ef9] hover:bg-[#0d0d0d] text-white text-xs font-display font-bold uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            {myVote ? 'Cambiar voto POTM' : 'Votar Player of The Match'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Finalized Matches with Official POTM Winner */}
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <h2 className="font-display text-2xl font-bold uppercase text-[#0d0d0d]">
                  Ganadores POTM — Partidos Finalizados
                </h2>
                <span className="text-xs font-mono text-neutral-500">
                  {potmBuckets.finalized.length} encuentros
                </span>
              </div>

              {potmBuckets.finalized.length === 0 ? (
                <div className="bg-white border border-neutral-200 p-6 text-sm text-neutral-500">
                  Aún no hay encuentros finalizados en {discMeta.nombre}.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {potmBuckets.finalized.map((m) => {
                    const home = teamMap.get(m.homeTeamId);
                    const away = teamMap.get(m.awayTeamId);
                    const summary = computeMatchMvpStandings(m.id, state.mvpVotes);
                    const winner = summary.winner;

                    return (
                      <div
                        key={m.id}
                        className="bg-white border border-neutral-200 p-4 flex flex-col justify-between gap-4"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-[11px] text-neutral-500 font-mono">
                            <span>
                              {m.fecha} · {m.fase !== 'Grupos' ? m.fase : m.groupName}
                            </span>
                            <span>FINAL</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <TeamCrest
                                escudo={home?.escudo}
                                sigla={home?.sigla ?? 'LOC'}
                                nombre={home?.nombre ?? m.homeTeamId}
                                size="xs"
                              />
                              <span className="text-sm font-semibold truncate">
                                {home?.sigla ?? m.homeTeamId}
                              </span>
                            </div>
                            <span className="font-display text-xl font-bold tabular-nums text-[#0d0d0d]">
                              {m.homeScore} — {m.awayScore}
                            </span>
                            <div className="flex items-center gap-2 min-w-0 justify-end">
                              <span className="text-sm font-semibold truncate">
                                {away?.sigla ?? m.awayTeamId}
                              </span>
                              <TeamCrest
                                escudo={away?.escudo}
                                sigla={away?.sigla ?? 'VIS'}
                                nombre={away?.nombre ?? m.awayTeamId}
                                size="xs"
                              />
                            </div>
                          </div>

                          <div className="bg-[#f5f6f8] border border-neutral-200/80 p-3">
                            <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
                              Player of The Match (POTM)
                            </p>
                            {winner ? (
                              <div className="flex items-center justify-between gap-2 mt-1">
                                <p className="text-sm font-bold text-[#0d0d0d] truncate">
                                  {winner.playerName}
                                </p>
                                <span className="text-xs font-mono text-[#707ef9] font-semibold shrink-0">
                                  {winner.votes} votos ({winner.percentage}%)
                                </span>
                              </div>
                            ) : (
                              <p className="text-xs text-neutral-500 mt-1">
                                Sin votos registrados durante el partido.
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onOpenMatchMvp(m)}
                          className="w-full py-2 border border-neutral-300 hover:border-[#0d0d0d] text-xs font-display font-bold uppercase tracking-wider text-[#0d0d0d] transition-colors cursor-pointer"
                        >
                          Ver desglose POTM y ficha
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Upcoming matches */}
            {potmBuckets.upcoming.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-display text-xl font-bold uppercase text-neutral-700">
                  Próximas Votaciones POTM ({potmBuckets.upcoming.length})
                </h2>
                <div className="bg-white border border-neutral-200 divide-y divide-neutral-200">
                  {potmBuckets.upcoming.slice(0, 6).map((m) => {
                    const home = teamMap.get(m.homeTeamId);
                    const away = teamMap.get(m.awayTeamId);
                    return (
                      <div
                        key={m.id}
                        className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2 font-medium text-[#0d0d0d]">
                          <span>{home?.nombre ?? m.homeTeamId}</span>
                          <span className="text-neutral-400">vs</span>
                          <span>{away?.nombre ?? m.awayTeamId}</span>
                        </div>
                        <div className="flex items-center gap-3 text-neutral-500 font-mono">
                          <span>
                            {m.fecha} · {m.hora}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            Abre en horario del partido
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ================================================================
            TAB 2: MVP DEL CAMPEONATO (5 Admin-Nominated Players)
           ================================================================ */}
        {activeTab === 'mvp' && (
          <div className="space-y-6">
            <div className="bg-white border border-neutral-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#707ef9] font-semibold">
                  {discMeta.nombre} · Temporada {state.temporada}
                </p>
                <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-[#0d0d0d] mt-1">
                  MVP del Campeonato — 5 Nominados Oficiales
                </h2>
                <p className="text-sm text-neutral-600 mt-1">
                  La organización selecciona a los 5 jugadores finalistas de la disciplina. Cada
                  usuario registrado puede emitir un voto y actualizarlo mientras la votación esté
                  abierta.
                </p>
              </div>
              <div className="text-left md:text-right shrink-0">
                <p className="text-[11px] uppercase tracking-wider text-neutral-500">
                  Total votos válidos
                </p>
                <p className="font-display text-3xl font-bold tabular-nums text-[#0d0d0d]">
                  {championshipMvpSummary.totalVotes}
                </p>
              </div>
            </div>

            {championshipMvpSummary.candidates.length === 0 ? (
              <div className="bg-white border border-neutral-200 p-10 text-center space-y-2">
                <Trophy className="w-10 h-10 text-neutral-300 mx-auto" />
                <h3 className="font-display text-xl font-bold uppercase text-[#0d0d0d]">
                  Nominados aún no publicados para {discMeta.nombreCorto}
                </h3>
                <p className="text-sm text-neutral-600 max-w-lg mx-auto">
                  Un administrador debe seleccionar a los 5 nominados oficiales desde el{' '}
                  <strong>Panel Oficial → Votaciones / MVP</strong> para habilitar esta votación.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
                {championshipMvpSummary.candidates.map((cand, index) => {
                  const isMyPick = userChampionshipMvpVote?.playerId === cand.playerId;
                  const isLeader = index === 0 && cand.votes > 0;
                  return (
                    <div
                      key={cand.playerId}
                      className={`bg-white border p-5 flex flex-col justify-between gap-5 ${
                        isMyPick
                          ? 'border-[#707ef9] ring-1 ring-[#707ef9]'
                          : 'border-neutral-200'
                      }`}
                    >
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <TeamCrest
                              escudo={cand.teamEscudo}
                              sigla={cand.teamSigla}
                              nombre={cand.teamName}
                              size="md"
                            />
                            <div className="min-w-0">
                              <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">
                                #{index + 1} · Dorsal {cand.dorsal} · {cand.posicion}
                              </p>
                              <h3 className="font-display text-2xl font-bold uppercase text-[#0d0d0d] truncate">
                                {cand.playerName}
                              </h3>
                              <p className="text-xs text-neutral-600 truncate">{cand.teamName}</p>
                            </div>
                          </div>
                          {isLeader && (
                            <Trophy className="w-5 h-5 text-amber-500 shrink-0" aria-label="Líder actual" />
                          )}
                        </div>

                        {/* Progress bar */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="font-semibold text-[#0d0d0d]">{cand.votes} votos</span>
                            <span className="text-[#707ef9] font-semibold">{cand.percentage}%</span>
                          </div>
                          <div className="h-2 bg-neutral-100 overflow-hidden">
                            <div
                              className="h-full bg-[#707ef9] transition-all"
                              style={{ width: `${cand.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={savingKey === `mvp-${cand.playerId}`}
                        onClick={() => handleChampionshipMvpClick(cand.playerId)}
                        className={`w-full py-2.5 text-xs font-display font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                          isMyPick
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#0d0d0d] hover:bg-[#707ef9] text-white'
                        }`}
                      >
                        {isMyPick
                          ? 'Tu voto actual al MVP'
                          : savingKey === `mvp-${cand.playerId}`
                          ? 'Guardando...'
                          : currentUser
                          ? 'Votar por este jugador'
                          : 'Ingresar para votar'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================================================================
            TAB 3: PREMIOS POR POSICIÓN (Adaptado por Deporte)
           ================================================================ */}
        {activeTab === 'posiciones' && activePositionStanding && (
          <div className="space-y-6">
            {/* Position selector strip */}
            <div className="bg-white border border-neutral-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">
                  Categorías de posición para {discMeta.nombre}
                </p>
                <span className="text-xs text-neutral-500">
                  Vota por 1 jugador en cada posición de este deporte
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {positionAwardStandings.map((st) => {
                  const active = st.position.key === activePositionStanding.position.key;
                  const userVotedPos = currentUser
                    ? state.positionAwardVotes.some(
                        (v) =>
                          v.disciplineId === selectedDiscipline &&
                          v.positionKey === st.position.key &&
                          v.voterUid === currentUser.uid
                      )
                    : false;
                  return (
                    <button
                      key={st.position.key}
                      type="button"
                      onClick={() => {
                        setSelectedPositionKey(st.position.key);
                        setShowAllPlayersForPosition(false);
                        setFeedbackMsg(null);
                      }}
                      className={`px-3.5 py-2 text-xs font-display font-bold uppercase tracking-wider border transition-colors cursor-pointer flex items-center gap-1.5 ${
                        active
                          ? 'bg-[#0d0d0d] text-white border-[#0d0d0d]'
                          : 'bg-white text-[#0d0d0d] border-neutral-300 hover:border-[#0d0d0d]'
                      }`}
                    >
                      <span>{st.position.awardTitle}</span>
                      {userVotedPos && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Live Position Ranking */}
              <div className="lg:col-span-5 bg-white border border-neutral-200">
                <div className="bg-[#0d0d0d] text-white p-5 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-[#707ef9]">
                      Ranking en Vivo
                    </p>
                    <h3 className="font-display text-2xl font-bold uppercase mt-0.5">
                      {activePositionStanding.position.awardTitle}
                    </h3>
                  </div>
                  <span className="font-mono text-xs text-neutral-300">
                    {activePositionStanding.totalVotes} votos
                  </span>
                </div>

                {activePositionStanding.rankings.length === 0 ? (
                  <div className="p-6 text-sm text-neutral-500">
                    Aún no hay votos en esta categoría. Sé el primero en votar desde el listado.
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-200">
                    {activePositionStanding.rankings.slice(0, 8).map((r, idx) => (
                      <div key={r.playerId} className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-display text-xl font-bold text-neutral-400 w-5 text-center tabular-nums">
                              {idx + 1}
                            </span>
                            <TeamCrest
                              escudo={r.teamEscudo}
                              sigla={r.teamSigla}
                              nombre={r.teamName}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[#0d0d0d] truncate">
                                {r.playerName}
                              </p>
                              <p className="text-xs text-neutral-500 truncate">{r.teamName}</p>
                            </div>
                          </div>
                          <div className="text-right font-mono shrink-0">
                            <p className="text-sm font-bold text-[#0d0d0d]">{r.votes}</p>
                            <p className="text-[11px] text-[#707ef9]">{r.percentage}%</p>
                          </div>
                        </div>
                        <div className="h-1.5 bg-neutral-100">
                          <div
                            className="h-full bg-[#707ef9]"
                            style={{ width: `${r.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Eligible Candidates to Vote with Manual Player Search */}
              <div className="lg:col-span-7 bg-white border border-neutral-200 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
                  <div>
                    <h3 className="font-display text-xl font-bold uppercase text-[#0d0d0d]">
                      Elegir {activePositionStanding.position.awardTitle}
                    </h3>
                    <p className="text-xs text-neutral-600">
                      {positionPlayerSearch.trim()
                        ? `Búsqueda manual en ${discMeta.nombreCorto}: ${positionCandidatesToDisplay.length} coincidencia(s).`
                        : eligibleForActivePosition.matched.length > 0 && !showAllPlayersForPosition
                        ? `Mostrando ${positionCandidatesToDisplay.length} jugador(es) en posición ${activePositionStanding.position.label}.`
                        : `Mostrando ${positionCandidatesToDisplay.length} de ${eligibleForActivePosition.all.length} jugadores inscritos en ${discMeta.nombreCorto}.`}
                    </p>
                  </div>

                  {eligibleForActivePosition.matched.length > 0 && !positionPlayerSearch.trim() && (
                    <button
                      type="button"
                      onClick={() => setShowAllPlayersForPosition((v) => !v)}
                      className="text-xs text-[#707ef9] hover:underline font-medium cursor-pointer"
                    >
                      {showAllPlayersForPosition
                        ? 'Ver solo posición específica'
                        : 'Ver todo el plantel de la disciplina'}
                    </button>
                  )}
                </div>

                {/* Manual Player Search + Team Filter */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-7 relative">
                    <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="votations-position-player-search"
                      type="text"
                      value={positionPlayerSearch}
                      onChange={(e) => setPositionPlayerSearch(e.target.value)}
                      placeholder="Buscar jugador por nombre, apellido, dorsal o equipo..."
                      aria-label="Buscar jugador manualmente para votar"
                      className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm border border-neutral-300 bg-white text-[#0d0d0d] focus:border-[#707ef9] focus:outline-none"
                    />
                    {positionPlayerSearch && (
                      <button
                        type="button"
                        onClick={() => setPositionPlayerSearch('')}
                        aria-label="Limpiar búsqueda de jugador"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-[#0d0d0d] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="sm:col-span-5">
                    <select
                      aria-label="Filtrar candidatos por equipo"
                      value={positionTeamFilter}
                      onChange={(e) => setPositionTeamFilter(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-neutral-300 bg-white text-[#0d0d0d] focus:border-[#707ef9] focus:outline-none"
                    >
                      <option value="ALL">Todos los equipos ({disciplineTeams.length})</option>
                      {disciplineTeams.map((tm) => (
                        <option key={tm.id} value={tm.id}>
                          {tm.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {positionCandidatesToDisplay.length === 0 ? (
                  <div className="py-8 text-center space-y-2 border border-dashed border-neutral-200 bg-[#f5f6f8]">
                    <p className="text-sm text-neutral-600">
                      {positionPlayerSearch.trim() || positionTeamFilter !== 'ALL'
                        ? 'No se encontraron jugadores con ese criterio de búsqueda.'
                        : `No hay jugadores inscritos aún en ${discMeta.nombre}.`}
                    </p>
                    {(positionPlayerSearch.trim() || positionTeamFilter !== 'ALL') && (
                      <button
                        type="button"
                        onClick={() => {
                          setPositionPlayerSearch('');
                          setPositionTeamFilter('ALL');
                        }}
                        className="text-xs font-bold uppercase tracking-wider text-[#707ef9] hover:underline cursor-pointer"
                      >
                        Limpiar búsqueda
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[540px] overflow-y-auto pr-1">
                    {positionCandidatesToDisplay.map((pl) => {
                      const team = teamMap.get(pl.teamId);
                      const isVoted = userPositionVote?.playerId === pl.id;
                      return (
                        <div
                          key={pl.id}
                          className={`border p-3.5 flex items-center justify-between gap-3 ${
                            isVoted
                              ? 'border-[#707ef9] bg-[#707ef9]/5'
                              : 'border-neutral-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <TeamCrest
                              escudo={team?.escudo}
                              sigla={team?.sigla ?? 'EQ'}
                              nombre={team?.nombre ?? pl.teamId}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[#0d0d0d] truncate">
                                #{pl.dorsal} {pl.nombre} {pl.apellidoPaterno}
                              </p>
                              <p className="text-[11px] text-neutral-500 truncate">
                                {team?.nombre ?? pl.teamId} · {pl.posicion}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={savingKey === `pos-${pl.id}`}
                            onClick={() => handlePositionAwardClick(pl)}
                            className={`px-3 py-1.5 text-[11px] font-display font-bold uppercase tracking-wider shrink-0 transition-colors cursor-pointer ${
                              isVoted
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[#0d0d0d] hover:bg-[#707ef9] text-white'
                            }`}
                          >
                            {isVoted ? 'Votado' : 'Votar'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            TAB 4: TOTY (TEAM OF THE YEAR — FORMACIÓN COMPLETA DE LA COMUNIDAD)
           ================================================================ */}
        {activeTab === 'toty' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Live Tactical Full-Formation TOTY Board */}
            <div className="lg:col-span-7 bg-[#0d0d0d] text-white border border-neutral-800 overflow-hidden">
              <div className="p-6 border-b border-white/10 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[#707ef9] font-medium flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      {totyFormation.formationName} · {discMeta.nombreCorto}
                    </p>
                    <h2 className="font-display text-3xl font-bold uppercase tracking-tight mt-1">
                      TOTY de la Comunidad {state.temporada}
                    </h2>
                    <p className="text-xs text-neutral-400 mt-1">
                      {totyFormation.summaryText}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wider text-neutral-400">
                      Papeletas TOTY
                    </p>
                    <p className="font-display text-3xl font-bold text-[#707ef9] tabular-nums">
                      {communityToty.totalBallots}
                    </p>
                  </div>
                </div>

                {/* Toggle: Community Winning Lineup vs User's Draft Formation Preview */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="inline-flex border border-white/15 bg-white/5 p-0.5">
                    <button
                      type="button"
                      onClick={() => setTotyBoardMode('community')}
                      className={`px-3 py-1.5 text-[11px] font-display font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                        totyBoardMode === 'community'
                          ? 'bg-[#707ef9] text-white'
                          : 'text-neutral-300 hover:text-white'
                      }`}
                    >
                      TOTY Oficial ({totyFormation.slots.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTotyBoardMode('draft')}
                      className={`px-3 py-1.5 text-[11px] font-display font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                        totyBoardMode === 'draft'
                          ? 'bg-white text-[#0d0d0d]'
                          : 'text-neutral-300 hover:text-white'
                      }`}
                    >
                      Mi Formación ({totySelectedCount}/{totyFormation.slots.length})
                    </button>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-400">
                    {totyBoardMode === 'community'
                      ? 'Los más votados en cada línea forman el equipo titular'
                      : 'Vista previa táctica de tu papeleta actual'}
                  </span>
                </div>
              </div>

              {/* Tactical Pitch / Court Surface */}
              <div className="relative p-5 sm:p-6 bg-[#111318] overflow-hidden">
                {/* Architectural Sport Court / Pitch Line Markings */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 600 520"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-0 w-full h-full opacity-20"
                >
                  <rect
                    x="18"
                    y="18"
                    width="564"
                    height="484"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  {discMeta.sportType === 'futbol7' && (
                    <>
                      <line x1="18" y1="260" x2="582" y2="260" stroke="#ffffff" strokeWidth="1.2" />
                      <circle cx="300" cy="260" r="64" fill="none" stroke="#ffffff" strokeWidth="1.2" />
                      <rect x="170" y="18" width="260" height="82" fill="none" stroke="#ffffff" strokeWidth="1.2" />
                      <rect x="170" y="420" width="260" height="82" fill="none" stroke="#ffffff" strokeWidth="1.2" />
                    </>
                  )}
                  {(discMeta.sportType === 'basquetbol' || discMeta.sportType === 'basquetbol3x3') && (
                    <>
                      <path
                        d="M 85 18 L 85 170 A 215 215 0 0 0 515 170 L 515 18"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="1.2"
                      />
                      <rect x="215" y="18" width="170" height="175" fill="none" stroke="#ffffff" strokeWidth="1.2" />
                      <circle cx="300" cy="193" r="52" fill="none" stroke="#ffffff" strokeWidth="1.2" />
                      <line x1="18" y1="430" x2="582" y2="430" stroke="#ffffff" strokeWidth="1" strokeDasharray="6 6" />
                    </>
                  )}
                  {discMeta.sportType === 'voleibol' && (
                    <>
                      <line x1="18" y1="42" x2="582" y2="42" stroke="#707ef9" strokeWidth="2.5" />
                      <line x1="18" y1="196" x2="582" y2="196" stroke="#ffffff" strokeWidth="1.2" strokeDasharray="8 6" />
                      <line x1="18" y1="382" x2="582" y2="382" stroke="#707ef9" strokeWidth="1" strokeDasharray="4 6" />
                    </>
                  )}
                </svg>

                <div className="relative z-10 space-y-5">
                  {totyRowsGrouped.map((rowGroup) => {
                    const colClass =
                      rowGroup.slots.length === 1
                        ? 'grid-cols-1 max-w-sm mx-auto'
                        : rowGroup.slots.length === 2
                        ? 'grid-cols-1 sm:grid-cols-2'
                        : 'grid-cols-1 sm:grid-cols-3';

                    return (
                      <div key={rowGroup.row} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="h-px flex-1 bg-white/10" />
                          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-400">
                            {rowGroup.rowLabel}
                          </span>
                          <span className="h-px flex-1 bg-white/10" />
                        </div>

                        <div className={`grid ${colClass} gap-3`}>
                          {rowGroup.slots.map((slotRes) => {
                            const draftPlayerId = totyDraft[slotRes.slot.slotKey];
                            const draftPlayer = draftPlayerId
                              ? disciplinePlayers.find((p) => p.id === draftPlayerId)
                              : undefined;
                            const draftTeam = draftPlayer
                              ? teamMap.get(draftPlayer.teamId)
                              : undefined;

                            const isLibero = Boolean(slotRes.slot.isLibero);
                            const cardBorder = isLibero
                              ? 'border-[#707ef9] bg-[#707ef9]/15'
                              : 'border-white/15 bg-[#0d0d0d]/90';

                            return (
                              <div
                                key={slotRes.slot.slotKey}
                                className={`border p-3.5 flex flex-col justify-between gap-2.5 backdrop-blur-xs ${cardBorder}`}
                              >
                                <div className="flex items-center justify-between gap-2 min-w-0">
                                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#707ef9] font-bold truncate">
                                    {slotRes.slot.shortCode} · {slotRes.slot.label}
                                  </span>
                                  {totyBoardMode === 'community' ? (
                                    <span className="text-[10px] font-mono text-neutral-400 tabular-nums shrink-0 whitespace-nowrap">
                                      {slotRes.winner
                                        ? `${slotRes.winner.votes} v.`
                                        : '0 v.'}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-mono text-neutral-400 shrink-0 whitespace-nowrap">
                                      {draftPlayer ? 'Elegido' : 'Pendiente'}
                                    </span>
                                  )}
                                </div>

                                {totyBoardMode === 'community' ? (
                                  slotRes.winner ? (
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <TeamCrest
                                        escudo={slotRes.winner.teamEscudo}
                                        sigla={slotRes.winner.teamSigla}
                                        nombre={slotRes.winner.teamName}
                                        size="sm"
                                        surface="dark"
                                      />
                                      <div className="min-w-0">
                                        <p className="font-display text-lg font-bold uppercase leading-tight truncate text-white">
                                          {slotRes.winner.playerName}
                                        </p>
                                        <p className="text-[11px] text-neutral-300 truncate">
                                          {slotRes.winner.teamName}
                                        </p>
                                        <p className="text-[10px] font-mono text-emerald-400 mt-0.5 tabular-nums">
                                          {slotRes.winner.votes} votos ({slotRes.winner.percentage}%)
                                        </p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="py-2 text-xs text-neutral-400 flex items-center gap-2">
                                      <Users className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                      <span>Puesto vacante</span>
                                    </div>
                                  )
                                ) : draftPlayer ? (
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <TeamCrest
                                      escudo={draftTeam?.escudo}
                                      sigla={draftTeam?.sigla ?? 'EQ'}
                                      nombre={draftTeam?.nombre ?? draftPlayer.teamId}
                                      size="sm"
                                      surface="dark"
                                    />
                                    <div className="min-w-0">
                                      <p className="font-display text-lg font-bold uppercase leading-tight truncate text-white">
                                        #{draftPlayer.dorsal} {draftPlayer.nombre}{' '}
                                        {draftPlayer.apellidoPaterno}
                                      </p>
                                      <p className="text-[11px] text-neutral-300 truncate">
                                        {draftTeam?.nombre ?? draftPlayer.teamId}
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="py-2 text-xs text-neutral-500 flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                                    <span>Selecciona en tu papeleta →</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Compact Runner-Ups / Bench Watch */}
              {totyBoardMode === 'community' &&
                communityToty.slots.some((s) => s.runnerUps.length > 0) && (
                  <div className="px-6 py-4 border-t border-white/10 bg-[#0d0d0d] space-y-2">
                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-400">
                      Siguientes más votados por posición
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {communityToty.slots
                        .filter((s) => s.runnerUps.length > 0)
                        .map((s) => (
                          <div
                            key={`ru-${s.slot.slotKey}`}
                            className="bg-white/5 border border-white/10 px-3 py-2 text-[11px]"
                          >
                            <p className="font-mono text-[10px] uppercase text-[#707ef9] mb-1">
                              {s.position.label}
                            </p>
                            {s.runnerUps.slice(0, 2).map((ru) => (
                              <div
                                key={ru.playerId}
                                className="flex items-center justify-between text-neutral-300 gap-2"
                              >
                                <span className="truncate">{ru.playerName}</span>
                                <span className="font-mono text-neutral-400 shrink-0 tabular-nums">
                                  {ru.votes} v.
                                </span>
                              </div>
                            ))}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
            </div>

            {/* Right: Interactive Full-Formation User TOTY Ballot */}
            <div className="lg:col-span-5 bg-white border border-neutral-200 p-6 space-y-5">
              <div className="border-b border-neutral-200 pb-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-widest text-[#707ef9] font-semibold">
                    Tu Papeleta · {totyFormation.formationName}
                  </p>
                  <span className="text-xs font-mono font-bold text-[#0d0d0d] tabular-nums">
                    {totySelectedCount}/{totyFormation.slots.length} puestos
                  </span>
                </div>
                <h3 className="font-display text-2xl font-bold uppercase text-[#0d0d0d]">
                  Arma tu TOTY — {discMeta.nombreCorto}
                </h3>
                <p className="text-xs text-neutral-600">
                  Completa la formación oficial ({totyFormation.summaryText}). No puedes repetir al
                  mismo jugador en dos puestos.
                </p>
                <div className="w-full h-1.5 bg-neutral-100 overflow-hidden">
                  <div
                    className="h-full bg-[#707ef9] transition-all duration-300"
                    style={{
                      width: `${Math.round(
                        (totySelectedCount / Math.max(1, totyFormation.slots.length)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {disciplinePlayers.length === 0 ? (
                <p className="text-sm text-neutral-500 py-4">
                  Aún no hay jugadores registrados en {discMeta.nombre}.
                </p>
              ) : (
                <div className="space-y-4">
                  {totyFormation.slots.map((slot) => {
                    const { matched, all } = getEligiblePlayersForPosition(
                      disciplinePlayers,
                      discMeta.sportType,
                      slot.positionKey
                    );
                    const pickedId = totyDraft[slot.slotKey] ?? '';

                    return (
                      <TotyPlayerSearchPicker
                        key={`${selectedDiscipline}-${slot.slotKey}`}
                        posKey={slot.slotKey}
                        shortCode={slot.shortCode}
                        label={slot.label}
                        matched={matched}
                        all={all}
                        teamMap={teamMap}
                        selectedPlayerId={pickedId}
                        excludedPlayerIds={totyDraftPlayerIdSet}
                        highlightAccent={Boolean(slot.isLibero)}
                        onSelect={(playerId) => {
                          setTotyDraft((prev) => ({
                            ...prev,
                            [slot.slotKey]: playerId,
                          }));
                        }}
                      />
                    );
                  })}

                  <button
                    type="button"
                    disabled={savingKey === 'toty-save'}
                    onClick={handleSaveToty}
                    className="w-full py-3 bg-[#707ef9] hover:bg-[#0d0d0d] disabled:opacity-50 text-white font-display text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    {savingKey === 'toty-save'
                      ? 'Guardando formación TOTY...'
                      : !currentUser
                      ? 'Iniciar sesión para enviar mi TOTY'
                      : existingTotyBallot
                      ? `Actualizar mi TOTY (${totySelectedCount}/${totyFormation.slots.length})`
                      : `Enviar mi TOTY Oficial (${totySelectedCount}/${totyFormation.slots.length})`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
