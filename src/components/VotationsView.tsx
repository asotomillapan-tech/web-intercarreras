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
import { formatDorsalLabel } from '../domain/attendanceEngine';
import {
  aggregateChampionshipMvpVotes,
  aggregatePositionAwardVotes,
  computeCommunityToty,
  getEligiblePlayersForPosition,
  getPositionsForSport,
  getTotyFormationForSport,
  normalizeTotyBallotSelections,
} from '../domain/awardsEngine';
import {
  filterMatchesByOrg,
  sortMatchesChronologically,
  type MatchSortOrder,
} from '../domain/matchFilterEngine';
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
import { RevealSection, SectionKicker } from './MotionPrimitives';
import { TeamCrest } from './TeamCrest';
import {
  TotyCoBrandLockup,
  TotyCrestBadge,
  TotyDoubleShieldFrame,
  TotyWordmark,
} from './TotyVisuals';

type VotationTab = 'toty' | 'potm' | 'mvp' | 'posiciones';

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

interface AutocompletePlayerOption {
  id: string;
  label: string;
  subtitle: string;
  badge?: string;
  escudo?: string;
  sigla: string;
  teamName: string;
  disabled?: boolean;
}

interface VotingPlayerAutocompleteBarProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  options: AutocompletePlayerOption[];
  onSelectOption: (option: AutocompletePlayerOption) => void;
  actionHint?: string;
}

function VotingPlayerAutocompleteBar({
  id,
  value,
  onChange,
  placeholder,
  ariaLabel,
  options,
  onSelectOption,
  actionHint = 'Seleccionar',
}: VotingPlayerAutocompleteBarProps) {
  const [focused, setFocused] = useState(false);

  const visibleSuggestions = useMemo(() => {
    if (!focused) return [];
    const q = normalizeSearchText(value);
    if (!q) return options.slice(0, 8);
    return options.slice(0, 10);
  }, [focused, value, options]);

  return (
    <div className="relative">
      <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={focused && visibleSuggestions.length > 0}
        aria-controls={`${id}-listbox`}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          window.setTimeout(() => setFocused(false), 160);
        }}
        onChange={(e) => {
          onChange(e.target.value);
          setFocused(true);
        }}
        placeholder={placeholder}
        className="w-full pl-10 pr-8 py-2.5 rounded-xl text-xs sm:text-sm border border-white/[0.1] bg-[#111117] text-zinc-100 placeholder:text-zinc-500 focus:border-[#707ef9] focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange('')}
          aria-label="Limpiar búsqueda de jugador"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {focused && value.trim().length > 0 && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          aria-label="Sugerencias de jugadores"
          className="absolute left-0 right-0 top-full mt-1.5 z-30 rounded-2xl border border-white/[0.12] bg-[#0e0e14] shadow-2xl max-h-64 overflow-y-auto divide-y divide-white/[0.06]"
        >
          {visibleSuggestions.length === 0 ? (
            <p className="px-3 py-3 text-xs text-zinc-500 text-center">
              Sin coincidencias para &ldquo;{value}&rdquo;.
            </p>
          ) : (
            visibleSuggestions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="option"
                disabled={opt.disabled}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (opt.disabled) return;
                  onSelectOption(opt);
                  setFocused(false);
                }}
                className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-2 transition-colors ${
                  opt.disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-white/[0.04] cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <TeamCrest
                    escudo={opt.escudo}
                    sigla={opt.sigla}
                    nombre={opt.teamName}
                    size="xs"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{opt.label}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{opt.subtitle}</p>
                  </div>
                </div>
                <span className="text-[11px] font-medium text-[#a5b0ff] shrink-0">
                  {opt.badge ?? actionHint}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
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
      const rest = all.filter((p) => !matchedIdSet.has(p.id));
      return [...matched, ...rest].slice(0, 20);
    }
    const filtered = all.filter((p) => playerMatchesQuery(p, teamMap.get(p.teamId), q));
    return filtered.sort((a, b) => {
      const aSpec = matchedIdSet.has(a.id) ? 0 : 1;
      const bSpec = matchedIdSet.has(b.id) ? 0 : 1;
      return aSpec - bSpec;
    });
  }, [query, matched, all, matchedIdSet, teamMap]);

  return (
    <div className="space-y-1.5 relative">
      <div className="flex items-center justify-between text-xs text-zinc-200">
        <label htmlFor={`toty-search-${posKey}`} className="flex items-center gap-2 font-medium">
          <span
            className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${
              highlightAccent
                ? 'bg-[#2557d6] text-white border border-[#9ec8ff]/40'
                : 'bg-[#122663]/75 text-[#c7e2ff] border border-[#9ec8ff]/20'
            }`}
          >
            {shortCode}
          </span>
          <span className="text-[#eef6ff]">{label}</span>
        </label>
        {matched.length > 0 && (
          <span className="text-[11px] text-[#9ec8ff]/65">{matched.length} en posición</span>
        )}
      </div>

      {selectedPlayer && !open ? (
        <div className="rounded-xl border border-[#6ea8ff]/45 bg-[#112c78]/35 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <TeamCrest
              escudo={selectedTeam?.escudo}
              sigla={selectedTeam?.sigla ?? 'EQ'}
              nombre={selectedTeam?.nombre ?? selectedPlayer.teamId}
              size="xs"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">
                {formatDorsalLabel(selectedPlayer.dorsal)} {selectedPlayer.nombre}{' '}
                {selectedPlayer.apellidoPaterno}
              </p>
              <p className="text-[11px] text-[#b8d4f8]/75 truncate">
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
              className="text-[11px] font-medium text-[#b8dcff] hover:text-white cursor-pointer"
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
              className="p-1 text-zinc-400 hover:text-red-400 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8bbaff]/65 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id={`toty-search-${posKey}`}
              type="text"
              value={query}
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              placeholder={`Buscar para ${label}...`}
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs sm:text-sm border border-[#9ec8ff]/18 bg-[#0b1430]/90 text-zinc-100 placeholder:text-[#8eb2e0]/55 focus:border-[#6ea8ff] focus:outline-none"
            />
            {(query || open) && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setOpen(false);
                }}
                aria-label="Cerrar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {open && (
            <div
              role="listbox"
              aria-label={`Opciones de jugadores para ${label}`}
              className="rounded-xl border border-[#9ec8ff]/24 bg-[#070f26] max-h-52 overflow-y-auto divide-y divide-white/[0.06] shadow-2xl"
            >
              {results.length === 0 ? (
                <p className="px-3 py-3 text-xs text-zinc-400 text-center">
                  Sin jugadores para &ldquo;{query}&rdquo;.
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
                          ? 'opacity-40 cursor-not-allowed'
                          : isCurrent
                          ? 'bg-[#2557d6]/25 cursor-pointer'
                          : 'hover:bg-[#1a3e9c]/25 cursor-pointer'
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
                          <p className="text-xs font-medium text-white truncate">
                            {formatDorsalLabel(p.dorsal)} {p.nombre} {p.apellidoPaterno}
                          </p>
                          <p className="text-[11px] text-[#9eb8df]/70 truncate">
                            {tm?.nombre ?? p.teamId} · {p.posicion}
                          </p>
                        </div>
                      </div>
                      {isUsedElsewhere ? (
                        <span className="text-[10px] text-zinc-400 shrink-0">En tu TOTY</span>
                      ) : isSpec ? (
                        <span className="text-[10px] text-[#9ec8ff] shrink-0">Posición</span>
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
  const [activeTab, setActiveTab] = useState<VotationTab>('toty');
  const [potmDisciplineFilter, setPotmDisciplineFilter] = useState<'ALL' | DisciplineId>(
    selectedDiscipline
  );
  const [potmGroupFilter, setPotmGroupFilter] = useState<'ALL' | string>('ALL');
  const [potmStageFilter, setPotmStageFilter] = useState<'ALL' | MatchPhase>('ALL');
  const [potmSortOrder, setPotmSortOrder] = useState<MatchSortOrder>('newest');
  const [mvpSearchQuery, setMvpSearchQuery] = useState('');
  const [selectedPositionKey, setSelectedPositionKey] = useState<string>('');
  const [showAllPlayersForPosition, setShowAllPlayersForPosition] = useState(false);
  const [positionPlayerSearch, setPositionPlayerSearch] = useState('');
  const [positionTeamFilter, setPositionTeamFilter] = useState<'ALL' | string>('ALL');
  const [totyQuickSearch, setTotyQuickSearch] = useState('');
  const [totyDraft, setTotyDraft] = useState<Record<string, string>>({});
  const [totyBoardMode, setTotyBoardMode] = useState<'community' | 'draft'>('community');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const discMeta = DISCIPLINE_MAP[selectedDiscipline];
  const activeTotyConfig = state.totyConfigs?.[selectedDiscipline] ?? null;
  const sportPositions = useMemo(
    () => getPositionsForSport(discMeta.sportType),
    [discMeta.sportType]
  );
  const totyFormation = useMemo(
    () => getTotyFormationForSport(discMeta.sportType, activeTotyConfig),
    [discMeta.sportType, activeTotyConfig]
  );

  useEffect(() => {
    if (!sportPositions.some((p) => p.key === selectedPositionKey)) {
      setSelectedPositionKey(sportPositions[0]?.key ?? '');
    }
    setPotmDisciplineFilter(selectedDiscipline);
    setPotmGroupFilter('ALL');
    setPotmStageFilter('ALL');
    setMvpSearchQuery('');
    setShowAllPlayersForPosition(false);
    setPositionPlayerSearch('');
    setPositionTeamFilter('ALL');
    setTotyQuickSearch('');
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
    () => sortMatchesChronologically(state.matches, potmSortOrder),
    [state.matches, potmSortOrder]
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

  const existingTotyBallot = useMemo(() => {
    if (!currentUser) return undefined;
    return state.totyBallots.find(
      (b) => b.disciplineId === selectedDiscipline && b.voterUid === currentUser.uid
    );
  }, [state.totyBallots, selectedDiscipline, currentUser]);

  useEffect(() => {
    setTotyDraft(
      existingTotyBallot?.selections
        ? normalizeTotyBallotSelections(
            existingTotyBallot.selections,
            discMeta.sportType,
            activeTotyConfig
          )
        : {}
    );
  }, [existingTotyBallot, selectedDiscipline, discMeta.sportType, activeTotyConfig]);

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

  const filteredMvpCandidates = useMemo(() => {
    const q = normalizeSearchText(mvpSearchQuery);
    if (!q) return championshipMvpSummary.candidates;
    return championshipMvpSummary.candidates.filter((c) => {
      const hay = normalizeSearchText(
        `${c.playerName} #${c.dorsal} ${c.dorsal} ${c.posicion} ${c.teamName} ${c.teamSigla}`
      );
      return q.split(/\s+/).every((tok) => hay.includes(tok));
    });
  }, [championshipMvpSummary.candidates, mvpSearchQuery]);

  const mvpAutocompleteOptions = useMemo<AutocompletePlayerOption[]>(
    () =>
      filteredMvpCandidates.map((c) => ({
        id: c.playerId,
        label: `${formatDorsalLabel(c.dorsal)} ${c.playerName}`,
        subtitle: `${c.teamName} · ${c.posicion}`,
        badge: `${c.votes} v.`,
        escudo: c.teamEscudo,
        sigla: c.teamSigla,
        teamName: c.teamName,
      })),
    [filteredMvpCandidates]
  );

  const userChampionshipMvpVote = useMemo(() => {
    if (!currentUser) return undefined;
    return state.championshipMvpVotes.find(
      (v) => v.disciplineId === selectedDiscipline && v.voterUid === currentUser.uid
    );
  }, [state.championshipMvpVotes, selectedDiscipline, currentUser]);

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

  const communityToty = useMemo(
    () =>
      computeCommunityToty(
        selectedDiscipline,
        discMeta.sportType,
        state.totyBallots,
        state.players,
        state.teams,
        activeTotyConfig
      ),
    [
      selectedDiscipline,
      discMeta.sportType,
      state.totyBallots,
      state.players,
      state.teams,
      activeTotyConfig,
    ]
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
        `Voto al MVP registrado por ${player.nombre} ${player.apellidoPaterno}.`
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
        `Voto registrado en ${activePositionStanding.position.awardTitle}: ${player.nombre} ${player.apellidoPaterno}.`
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
    return Array.from(rowMap.values()).sort((a, b) => b.row - a.row);
  }, [communityToty.slots]);

  const handleSaveToty = async () => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    const cleanSelections = normalizeTotyBallotSelections(
      totyDraft,
      discMeta.sportType,
      activeTotyConfig
    );
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
        `Tu ${totyFormation.formationName} (${selectedEntries.length}/${totyFormation.slots.length}) fue guardado.`
      );
    } finally {
      setSavingKey(null);
    }
  };

  const positionAutocompleteOptions = useMemo<AutocompletePlayerOption[]>(
    () =>
      positionCandidatesToDisplay.map((pl) => {
        const tm = teamMap.get(pl.teamId);
        return {
          id: pl.id,
          label: `${formatDorsalLabel(pl.dorsal)} ${pl.nombre} ${pl.apellidoPaterno}`,
          subtitle: `${tm?.nombre ?? pl.teamId} · ${pl.posicion}`,
          badge: userPositionVote?.playerId === pl.id ? 'Votado' : 'Filtrar',
          escudo: tm?.escudo,
          sigla: tm?.sigla ?? 'EQ',
          teamName: tm?.nombre ?? pl.teamId,
        };
      }),
    [positionCandidatesToDisplay, teamMap, userPositionVote]
  );

  const totyFilteredQuickPlayers = useMemo(() => {
    if (!totyQuickSearch.trim()) return disciplinePlayers;
    return disciplinePlayers.filter((pl) =>
      playerMatchesQuery(pl, teamMap.get(pl.teamId), totyQuickSearch)
    );
  }, [disciplinePlayers, teamMap, totyQuickSearch]);

  const totyQuickAutocompleteOptions = useMemo<AutocompletePlayerOption[]>(
    () =>
      totyFilteredQuickPlayers.map((pl) => {
        const tm = teamMap.get(pl.teamId);
        const alreadyInToty = totyDraftPlayerIdSet.has(pl.id);
        return {
          id: pl.id,
          label: `${formatDorsalLabel(pl.dorsal)} ${pl.nombre} ${pl.apellidoPaterno}`,
          subtitle: `${tm?.nombre ?? pl.teamId} · ${pl.posicion}`,
          badge: alreadyInToty ? 'En TOTY' : 'Asignar',
          escudo: tm?.escudo,
          sigla: tm?.sigla ?? 'EQ',
          teamName: tm?.nombre ?? pl.teamId,
          disabled: alreadyInToty,
        };
      }),
    [totyFilteredQuickPlayers, teamMap, totyDraftPlayerIdSet]
  );

  const handleQuickAssignTotyPlayer = (playerId: string) => {
    const player = disciplinePlayers.find((p) => p.id === playerId);
    if (!player || totyDraftPlayerIdSet.has(playerId)) return;

    const compatibleEmpty = totyFormation.slots.find((slot) => {
      if (totyDraft[slot.slotKey]) return false;
      const { matched } = getEligiblePlayersForPosition(
        [player],
        discMeta.sportType,
        slot.positionKey
      );
      return matched.length > 0;
    });
    const fallbackEmpty = totyFormation.slots.find((slot) => !totyDraft[slot.slotKey]);
    const targetSlot = compatibleEmpty ?? fallbackEmpty;

    if (!targetSlot) {
      setFeedbackMsg('Tu formación TOTY está completa. Quita un jugador para asignar otro.');
      return;
    }

    setTotyDraft((prev) => ({ ...prev, [targetSlot.slotKey]: player.id }));
    setTotyBoardMode('draft');
    setTotyQuickSearch('');
    setFeedbackMsg(`${player.nombre} ${player.apellidoPaterno} asignado a ${targetSlot.label}.`);
  };

  return (
    <div className="min-h-[80vh] bg-[#050507] text-zinc-100 pb-20">
      {/* Obsidian Editorial Header */}
      <section className="border-b border-white/[0.08]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-7">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <SectionKicker index="01" label={`Premios Comunidad · ${state.temporada}`} />
              <h1 className="text-4xl sm:text-5xl font-medium tracking-[-0.035em] text-white mt-4">
                Centro de <span className="font-editorial text-[#c8ceff]">votaciones</span>
              </h1>
              <p className="text-sm text-zinc-400 mt-3 max-w-xl">
                Arma tus TOTYs, elige al POTM de cada partido y vota al MVP del campeonato.
              </p>
            </div>

            {!currentUser ? (
              <div className="rounded-2xl bg-[#0c0c10] border border-white/[0.08] px-4 py-3 flex items-center justify-between gap-4">
                <div className="text-xs text-zinc-400">
                  <p className="font-medium text-white">Votación verificada</p>
                  <p>Ingresa con Google para votar.</p>
                </div>
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="px-4 py-2 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer"
                >
                  Ingresar
                </button>
              </div>
            ) : (
              <div className="rounded-2xl bg-[#0c0c10] border border-white/[0.08] px-4 py-3 flex items-center gap-3 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-medium text-white">{currentUser.displayName}</p>
                  <p className="text-zinc-500">Habilitado para votar</p>
                </div>
              </div>
            )}
          </div>

          {/* Discipline Switcher */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-white/[0.08] pt-5">
            {DISCIPLINES.map((d) => {
              const active = selectedDiscipline === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onSelectDiscipline(d.id)}
                  className={`px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer border ${
                    active
                      ? activeTab === 'toty'
                        ? 'bg-[#2152d4] text-white border-[#8bbaff]/65'
                        : 'bg-[#707ef9] text-white border-[#707ef9]'
                      : 'bg-white/[0.03] text-zinc-400 border-white/[0.08] hover:text-white hover:bg-white/[0.07]'
                  }`}
                >
                  {d.nombreCorto}
                </button>
              );
            })}
          </div>

          {/* 4 Sub-tabs — TOTYs first */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(
              [
                {
                  id: 'toty',
                  label: 'TOTYs',
                  sub: `${communityToty.totalBallots} papeletas`,
                  icon: Crown,
                },
                {
                  id: 'potm',
                  label: 'POTM',
                  sub: 'Jugador del partido',
                  icon: Star,
                },
                {
                  id: 'mvp',
                  label: 'MVP Torneo',
                  sub: '5 nominados oficiales',
                  icon: Trophy,
                },
                {
                  id: 'posiciones',
                  label: 'Por posición',
                  sub: `${sportPositions.length} categorías`,
                  icon: Award,
                },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isTotyTab = tab.id === 'toty';
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setFeedbackMsg(null);
                  }}
                  className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                    isActive
                      ? isTotyTab
                        ? 'toty-tab-active text-white'
                        : 'bg-white text-[#050507] border-white'
                      : isTotyTab
                      ? 'bg-[#09122c] text-white border-[#6ea8ff]/28 hover:border-[#9ec8ff]/50'
                      : 'bg-[#0c0c10] text-white border-white/[0.08] hover:border-white/[0.18]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-base font-medium tracking-[-0.02em] whitespace-nowrap ${
                        isTotyTab && isActive ? 'toty-text-ice font-semibold' : ''
                      }`}
                    >
                      {tab.label}
                    </span>
                    {isTotyTab ? (
                      <TotyCrestBadge
                        className={`h-5 w-auto shrink-0 transition-opacity ${
                          isActive ? 'opacity-100' : 'opacity-75'
                        }`}
                      />
                    ) : (
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-[#707ef9]' : 'text-zinc-500'
                        }`}
                      />
                    )}
                  </div>
                  <p
                    className={`text-xs mt-1 ${
                      isActive
                        ? isTotyTab
                          ? 'text-[#d6e8ff]'
                          : 'text-zinc-600'
                        : isTotyTab
                        ? 'text-[#9ec8ff]/75'
                        : 'text-zinc-500'
                    }`}
                  >
                    {tab.sub}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <RevealSection className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {feedbackMsg && (
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/25 px-4 py-3 text-xs sm:text-sm text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* TAB 1: POTM */}
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
              sortOrder={potmSortOrder}
              onSortOrderChange={setPotmSortOrder}
              onReset={() => {
                setPotmDisciplineFilter(selectedDiscipline);
                setPotmGroupFilter('ALL');
                setPotmStageFilter('ALL');
                setPotmSortOrder('newest');
              }}
              compact
            />

            {/* Active Voting Window */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                <h2 className="text-xl sm:text-2xl font-medium tracking-[-0.02em] text-white">
                  Votación <span className="font-editorial text-[#c8ceff]">abierta</span>
                </h2>
                <span className="text-xs font-mono text-[#a5b0ff]">
                  {potmBuckets.openNow.length} activos
                </span>
              </div>

              {potmBuckets.openNow.length === 0 ? (
                <div className="rounded-2xl bg-[#0c0c10] border border-white/[0.08] p-6 text-xs sm:text-sm text-zinc-400 flex items-center gap-3">
                  <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span>
                    Sin partidos en ventana activa para{' '}
                    <strong className="text-zinc-200 font-medium">
                      {potmDisciplineFilter === 'ALL' ? 'todas las disciplinas' : discMeta.nombre}
                    </strong>
                    .
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
                        className="rounded-3xl bg-[#0c0c10] border border-[#707ef9]/40 p-5 flex flex-col justify-between gap-4"
                      >
                        <div className="flex items-center justify-between text-xs text-zinc-500">
                          <span className="font-medium text-[#a5b0ff]">
                            Abierto · {m.fecha} {m.hora}
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
                            <span className="text-base font-medium text-white truncate">
                              {home?.nombre ?? m.homeTeamId}
                            </span>
                          </div>
                          <span className="font-editorial text-sm text-zinc-500 shrink-0">vs</span>
                          <div className="flex items-center gap-2.5 min-w-0 justify-end">
                            <span className="text-base font-medium text-white truncate text-right">
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

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-3">
                          <span className="text-xs text-zinc-400">
                            {myVote
                              ? `Tu voto: ${myVote.playerName}`
                              : `${standings.totalVotes} voto(s)`}
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenMatchMvp(m)}
                            className="px-4 py-2 rounded-full bg-[#707ef9] hover:bg-[#5c6bf0] text-white text-xs font-medium transition-colors cursor-pointer"
                          >
                            {myVote ? 'Cambiar voto' : 'Votar POTM'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Finalized Matches */}
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <h2 className="text-xl sm:text-2xl font-medium tracking-[-0.02em] text-white">
                  Ganadores <span className="font-editorial text-[#c8ceff]">POTM</span>
                </h2>
                <span className="text-xs font-mono text-zinc-500">
                  {potmBuckets.finalized.length} finalizados
                </span>
              </div>

              {potmBuckets.finalized.length === 0 ? (
                <div className="rounded-2xl bg-[#0c0c10] border border-white/[0.08] p-6 text-xs text-zinc-500">
                  Sin encuentros finalizados en {discMeta.nombre}.
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
                        className="rounded-3xl bg-[#0c0c10] border border-white/[0.08] hover:border-white/[0.16] p-5 flex flex-col justify-between gap-4 transition-colors"
                      >
                        <div className="space-y-3.5">
                          <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                            <span>
                              {m.fecha} · {m.fase !== 'Grupos' ? m.fase : m.groupName}
                            </span>
                            <span className="text-emerald-400">FINAL</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <TeamCrest
                                escudo={home?.escudo}
                                sigla={home?.sigla ?? 'LOC'}
                                nombre={home?.nombre ?? m.homeTeamId}
                                size="xs"
                              />
                              <span className="text-sm font-medium text-white truncate">
                                {home?.sigla ?? m.homeTeamId}
                              </span>
                            </div>
                            <span className="text-xl font-medium tabular-nums text-white">
                              {m.homeScore} — {m.awayScore}
                            </span>
                            <div className="flex items-center gap-2 min-w-0 justify-end">
                              <span className="text-sm font-medium text-white truncate">
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

                          <div className="rounded-2xl bg-[#111117] border border-white/[0.06] p-3">
                            <p className="text-[11px] text-zinc-500">POTM</p>
                            {winner ? (
                              <div className="flex items-center justify-between gap-2 mt-1">
                                <p className="text-sm font-medium text-white truncate">
                                  {winner.playerName}
                                </p>
                                <span className="text-xs font-mono text-[#a5b0ff] shrink-0">
                                  {winner.votes} ({winner.percentage}%)
                                </span>
                              </div>
                            ) : (
                              <p className="text-xs text-zinc-500 mt-1">Sin votos registrados.</p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onOpenMatchMvp(m)}
                          className="w-full py-2.5 rounded-full border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
                        >
                          Ver ficha
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
                <h2 className="text-lg font-medium text-zinc-300">
                  Próximos ({potmBuckets.upcoming.length})
                </h2>
                <div className="rounded-2xl bg-[#0c0c10] border border-white/[0.08] divide-y divide-white/[0.06]">
                  {potmBuckets.upcoming.slice(0, 6).map((m) => {
                    const home = teamMap.get(m.homeTeamId);
                    const away = teamMap.get(m.awayTeamId);
                    return (
                      <div
                        key={m.id}
                        className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2 font-medium text-zinc-200">
                          <span>{home?.nombre ?? m.homeTeamId}</span>
                          <span className="font-editorial text-zinc-500">vs</span>
                          <span>{away?.nombre ?? m.awayTeamId}</span>
                        </div>
                        <div className="flex items-center gap-3 text-zinc-500 font-mono">
                          <span>
                            {m.fecha} · {m.hora}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            <span>En horario</span>
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

        {/* TAB 2: CHAMPIONSHIP MVP */}
        {activeTab === 'mvp' && (
          <div className="space-y-6">
            <div className="rounded-3xl bg-[#0c0c10] border border-white/[0.08] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-xs text-[#9aa5ff] font-medium">
                  {discMeta.nombre} · {state.temporada}
                </p>
                <h2 className="text-2xl sm:text-3xl font-medium tracking-[-0.025em] text-white mt-1">
                  MVP del <span className="font-editorial text-[#c8ceff]">campeonato</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  5 finalistas oficiales seleccionados por la organización.
                </p>
              </div>
              <div className="text-left md:text-right shrink-0">
                <p className="text-xs text-zinc-500">Votos válidos</p>
                <p className="text-3xl font-light tracking-[-0.03em] tabular-nums text-white">
                  {championshipMvpSummary.totalVotes}
                </p>
              </div>
            </div>

            {championshipMvpSummary.candidates.length === 0 ? (
              <div className="rounded-3xl bg-[#0c0c10] border border-white/[0.08] p-12 text-center space-y-2">
                <Trophy className="w-8 h-8 text-zinc-600 mx-auto" />
                <h3 className="text-lg font-medium text-white">
                  Nominados aún no publicados para {discMeta.nombreCorto}
                </h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  Los 5 nominados oficiales se habilitan desde administración.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#0c0c10] border border-white/[0.08] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 max-w-lg">
                    <VotingPlayerAutocompleteBar
                      id="votations-mvp-autocomplete"
                      value={mvpSearchQuery}
                      onChange={setMvpSearchQuery}
                      placeholder="Buscar nominado por nombre, dorsal o equipo..."
                      ariaLabel="Buscar nominado al MVP del campeonato"
                      options={mvpAutocompleteOptions}
                      actionHint="Ver"
                      onSelectOption={(opt) => {
                        const picked = championshipMvpSummary.candidates.find(
                          (c) => c.playerId === opt.id
                        );
                        if (picked) setMvpSearchQuery(picked.playerName);
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono text-zinc-500 tabular-nums">
                    {filteredMvpCandidates.length} / {championshipMvpSummary.candidates.length}
                  </span>
                </div>

                {filteredMvpCandidates.length === 0 ? (
                  <div className="rounded-2xl bg-[#0c0c10] border border-white/[0.08] p-8 text-center space-y-2">
                    <p className="text-sm text-zinc-400">
                      Sin coincidencias para &ldquo;{mvpSearchQuery}&rdquo;.
                    </p>
                    <button
                      type="button"
                      onClick={() => setMvpSearchQuery('')}
                      className="text-xs text-[#a5b0ff] hover:text-white cursor-pointer"
                    >
                      Mostrar todos
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
                    {filteredMvpCandidates.map((cand) => {
                      const rankIndex = championshipMvpSummary.candidates.findIndex(
                        (c) => c.playerId === cand.playerId
                      );
                      const isMyPick = userChampionshipMvpVote?.playerId === cand.playerId;
                      const isLeader = rankIndex === 0 && cand.votes > 0;
                      return (
                        <div
                          key={cand.playerId}
                          className={`rounded-3xl bg-[#0c0c10] border p-5 flex flex-col justify-between gap-5 transition-colors ${
                            isMyPick
                              ? 'border-[#707ef9] bg-[#707ef9]/[0.06]'
                              : 'border-white/[0.08] hover:border-white/[0.16]'
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
                                  <p className="text-[11px] font-mono text-zinc-500">
                                    #{rankIndex + 1} · #{cand.dorsal} · {cand.posicion}
                                  </p>
                                  <h3 className="text-lg font-medium text-white truncate">
                                    {cand.playerName}
                                  </h3>
                                  <p className="text-xs text-zinc-400 truncate">{cand.teamName}</p>
                                </div>
                              </div>
                              {isLeader && (
                                <Trophy className="w-5 h-5 text-amber-400 shrink-0" aria-label="Líder actual" />
                              )}
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs font-mono">
                                <span className="text-zinc-300">{cand.votes} votos</span>
                                <span className="text-[#a5b0ff]">{cand.percentage}%</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                                <div
                                  className="h-full bg-[#707ef9] rounded-full transition-all"
                                  style={{ width: `${cand.percentage}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={savingKey === `mvp-${cand.playerId}`}
                            onClick={() => handleChampionshipMvpClick(cand.playerId)}
                            className={`w-full py-2.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                              isMyPick
                                ? 'bg-emerald-500 text-[#050507]'
                                : 'bg-white text-[#050507] hover:bg-zinc-200'
                            }`}
                          >
                            {isMyPick
                              ? 'Tu voto actual'
                              : savingKey === `mvp-${cand.playerId}`
                              ? 'Guardando...'
                              : currentUser
                              ? 'Votar'
                              : 'Ingresar para votar'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: POSITION AWARDS */}
        {activeTab === 'posiciones' && activePositionStanding && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-[#0c0c10] border border-white/[0.08] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                <span>Categorías · {discMeta.nombre}</span>
                <span>1 voto por posición</span>
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
                      className={`px-3.5 py-2 rounded-full text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
                        active
                          ? 'bg-white text-[#050507] border-white'
                          : 'bg-white/[0.03] text-zinc-300 border-white/[0.08] hover:border-white/[0.2]'
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
              <div className="lg:col-span-5 rounded-3xl bg-[#0c0c10] border border-white/[0.08] overflow-hidden">
                <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#9aa5ff]">Ranking en vivo</p>
                    <h3 className="text-xl font-medium text-white mt-0.5">
                      {activePositionStanding.position.awardTitle}
                    </h3>
                  </div>
                  <span className="font-mono text-xs text-zinc-500">
                    {activePositionStanding.totalVotes} votos
                  </span>
                </div>

                {activePositionStanding.rankings.length === 0 ? (
                  <div className="p-6 text-xs text-zinc-500">
                    Aún no hay votos en esta categoría.
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.06]">
                    {activePositionStanding.rankings.slice(0, 8).map((r, idx) => (
                      <div key={r.playerId} className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-base font-medium text-zinc-500 w-5 text-center tabular-nums">
                              {idx + 1}
                            </span>
                            <TeamCrest
                              escudo={r.teamEscudo}
                              sigla={r.teamSigla}
                              nombre={r.teamName}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {r.playerName}
                              </p>
                              <p className="text-xs text-zinc-500 truncate">{r.teamName}</p>
                            </div>
                          </div>
                          <div className="text-right font-mono shrink-0">
                            <p className="text-sm font-medium text-white">{r.votes}</p>
                            <p className="text-[11px] text-[#a5b0ff]">{r.percentage}%</p>
                          </div>
                        </div>
                        <div className="h-1 rounded-full bg-white/[0.08] overflow-hidden">
                          <div
                            className="h-full bg-[#707ef9] rounded-full"
                            style={{ width: `${r.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Eligible Candidates */}
              <div className="lg:col-span-7 rounded-3xl bg-[#0c0c10] border border-white/[0.08] p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
                  <div>
                    <h3 className="text-lg font-medium text-white">
                      {activePositionStanding.position.awardTitle}
                    </h3>
                    <p className="text-xs text-zinc-500">
                      {positionCandidatesToDisplay.length} candidato(s)
                    </p>
                  </div>

                  {eligibleForActivePosition.matched.length > 0 && !positionPlayerSearch.trim() && (
                    <button
                      type="button"
                      onClick={() => setShowAllPlayersForPosition((v) => !v)}
                      className="text-xs text-[#a5b0ff] hover:text-white cursor-pointer"
                    >
                      {showAllPlayersForPosition ? 'Solo posición' : 'Ver todo el plantel'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-7">
                    <VotingPlayerAutocompleteBar
                      id="votations-position-player-search"
                      value={positionPlayerSearch}
                      onChange={setPositionPlayerSearch}
                      placeholder="Buscar por nombre, dorsal o equipo..."
                      ariaLabel="Buscar jugador manualmente para votar"
                      options={positionAutocompleteOptions}
                      actionHint="Elegir"
                      onSelectOption={(opt) => {
                        const found = positionCandidatesToDisplay.find((p) => p.id === opt.id);
                        if (found) {
                          setPositionPlayerSearch(`${found.nombre} ${found.apellidoPaterno}`);
                        }
                      }}
                    />
                  </div>

                  <div className="sm:col-span-5">
                    <select
                      aria-label="Filtrar candidatos por equipo"
                      value={positionTeamFilter}
                      onChange={(e) => setPositionTeamFilter(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-xs sm:text-sm border border-white/[0.1] bg-[#111117] text-zinc-100 focus:border-[#707ef9] focus:outline-none"
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
                  <div className="py-8 text-center space-y-2 rounded-2xl border border-dashed border-white/[0.1] bg-[#101016]">
                    <p className="text-xs text-zinc-400">Sin jugadores con ese criterio.</p>
                    {(positionPlayerSearch.trim() || positionTeamFilter !== 'ALL') && (
                      <button
                        type="button"
                        onClick={() => {
                          setPositionPlayerSearch('');
                          setPositionTeamFilter('ALL');
                        }}
                        className="text-xs text-[#a5b0ff] hover:text-white cursor-pointer"
                      >
                        Limpiar
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
                          className={`rounded-2xl border p-3.5 flex items-center justify-between gap-3 transition-colors ${
                            isVoted
                              ? 'border-[#707ef9] bg-[#707ef9]/10'
                              : 'border-white/[0.08] bg-[#101016]'
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
                              <p className="text-sm font-medium text-white truncate">
                                {formatDorsalLabel(pl.dorsal)} {pl.nombre} {pl.apellidoPaterno}
                              </p>
                              <p className="text-[11px] text-zinc-500 truncate">
                                {team?.nombre ?? pl.teamId} · {pl.posicion}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={savingKey === `pos-${pl.id}`}
                            onClick={() => handlePositionAwardClick(pl)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors cursor-pointer ${
                              isVoted
                                ? 'bg-emerald-500 text-[#050507]'
                                : 'bg-white text-[#050507] hover:bg-zinc-200'
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

        {/* TAB 1: TOTYs */}
        {activeTab === 'toty' && (
          <div className="space-y-6">
            {/* Bespoke TOTYs Cobalt-Sapphire-Ice Editorial Banner */}
            <div className="relative overflow-hidden rounded-[2rem] toty-stage-bg border border-[#9ec8ff]/30 shadow-[0_28px_72px_-36px_rgba(24,78,224,0.72)]">
              <div aria-hidden="true" className="absolute inset-0 toty-grain" />

              {/* Official Escudo_TOTY architectural frame motif */}
              <div
                aria-hidden="true"
                className="pointer-events-none hidden md:flex items-center justify-center absolute right-14 lg:right-52 top-1/2 -translate-y-1/2 h-[86%] opacity-34"
              >
                <TotyDoubleShieldFrame className="h-full w-auto" />
              </div>

              <div className="relative z-10 p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-[#c7e2ff]">
                      TOTYs {state.temporada}
                    </p>
                    <p className="text-xs sm:text-sm font-medium text-white">
                      {discMeta.nombre}
                      <span className="text-[#9ec8ff]/80 font-normal">
                        {' '}
                        · {totyFormation.formationName}
                      </span>
                    </p>
                  </div>

                  <TotyWordmark size="banner" />

                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pt-0.5">
                    <p className="text-base sm:text-lg font-medium text-[#dbeeff]">
                      Vota por tus favoritos.
                    </p>
                    <p className="text-xs text-[#b8d4f8]/75">{totyFormation.summaryText}</p>
                  </div>
                </div>

                <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-5 shrink-0 border-t lg:border-t-0 border-[#b8dcff]/18 pt-4 lg:pt-0">
                  <TotyCoBrandLockup />
                  <div className="text-right">
                    <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#b8dcff]/80">
                      Papeletas TOTYs
                    </p>
                    <p className="text-3xl sm:text-4xl font-light toty-text-ice tabular-nums leading-tight">
                      {communityToty.totalBallots}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Tactical Full-Formation TOTYs Board */}
              <div className="lg:col-span-7 rounded-3xl bg-[#060b1d] text-white border border-[#9ec8ff]/24 overflow-hidden shadow-[0_24px_60px_-34px_rgba(20,66,204,0.6)]">
                <div className="px-6 py-5 border-b border-[#9ec8ff]/16 bg-gradient-to-r from-[#08102a] via-[#0c1d54]/85 to-[#08102a] flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <TotyCrestBadge className="h-9 w-auto opacity-90 shrink-0" />
                    <div className="space-y-0.5">
                      <p className="text-xs text-[#9ec8ff] font-medium flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#b8dcff]" />
                        <span>
                          {totyFormation.formationName} · {discMeta.nombreCorto}
                        </span>
                      </p>
                      <h2 className="text-xl sm:text-2xl font-medium tracking-[-0.025em] text-white">
                        {totyBoardMode === 'community' ? 'TOTY Oficial ' : 'Tu formación '}
                        <span className="font-editorial text-[#b8dcff]">{state.temporada}</span>
                      </h2>
                    </div>
                  </div>

                  <div className="inline-flex rounded-full border border-[#9ec8ff]/25 bg-[#040919]/80 p-1">
                    <button
                      type="button"
                      onClick={() => setTotyBoardMode('community')}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        totyBoardMode === 'community'
                          ? 'bg-[#2152d4] text-white shadow-sm'
                          : 'text-[#b8d4f8]/75 hover:text-white'
                      }`}
                    >
                      TOTY Oficial ({totyFormation.slots.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTotyBoardMode('draft')}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        totyBoardMode === 'draft'
                          ? 'bg-white text-[#050a1f]'
                          : 'text-[#b8d4f8]/75 hover:text-white'
                      }`}
                    >
                      Mi formación ({totySelectedCount}/{totyFormation.slots.length})
                    </button>
                  </div>
                </div>

                {/* Tactical Pitch / Court Surface */}
                <div className="relative p-5 sm:p-6 toty-pitch-bg overflow-hidden">
                  <div aria-hidden="true" className="absolute inset-0 toty-grain opacity-60" />

                  {/* Official Escudo_TOTY centered crest aura behind the tactical lineup */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.14]"
                  >
                    <TotyDoubleShieldFrame className="h-[88%] w-auto" />
                  </div>

                  <svg
                    aria-hidden="true"
                    viewBox="0 0 600 520"
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute inset-0 w-full h-full opacity-25"
                  >
                    <rect
                      x="18"
                      y="18"
                      width="564"
                      height="484"
                      fill="none"
                      stroke="#b8dcff"
                      strokeWidth="1.5"
                    />
                    {discMeta.sportType === 'futbol7' && (
                      <>
                        <line x1="18" y1="260" x2="582" y2="260" stroke="#b8dcff" strokeWidth="1.2" />
                        <circle cx="300" cy="260" r="64" fill="none" stroke="#b8dcff" strokeWidth="1.2" />
                        <rect x="170" y="18" width="260" height="82" fill="none" stroke="#b8dcff" strokeWidth="1.2" />
                        <rect x="170" y="420" width="260" height="82" fill="none" stroke="#b8dcff" strokeWidth="1.2" />
                      </>
                    )}
                    {(discMeta.sportType === 'basquetbol' || discMeta.sportType === 'basquetbol3x3') && (
                      <>
                        <path
                          d="M 85 18 L 85 170 A 215 215 0 0 0 515 170 L 515 18"
                          fill="none"
                          stroke="#b8dcff"
                          strokeWidth="1.2"
                        />
                        <rect x="215" y="18" width="170" height="175" fill="none" stroke="#b8dcff" strokeWidth="1.2" />
                        <circle cx="300" cy="193" r="52" fill="none" stroke="#b8dcff" strokeWidth="1.2" />
                        <line
                          x1="18"
                          y1="430"
                          x2="582"
                          y2="430"
                          stroke="#b8dcff"
                          strokeWidth="1"
                          strokeDasharray="6 6"
                        />
                      </>
                    )}
                    {discMeta.sportType === 'voleibol' && (
                      <>
                        <line x1="18" y1="42" x2="582" y2="42" stroke="#8bbaff" strokeWidth="2.5" />
                        <line
                          x1="18"
                          y1="196"
                          x2="582"
                          y2="196"
                          stroke="#b8dcff"
                          strokeWidth="1.2"
                          strokeDasharray="8 6"
                        />
                        <line
                          x1="18"
                          y1="382"
                          x2="582"
                          y2="382"
                          stroke="#8bbaff"
                          strokeWidth="1"
                          strokeDasharray="4 6"
                        />
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
                        <div key={rowGroup.row} className="space-y-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="h-px flex-1 bg-[#9ec8ff]/18" />
                            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[#b8dcff]/75">
                              {rowGroup.rowLabel}
                            </span>
                            <span className="h-px flex-1 bg-[#9ec8ff]/18" />
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

                              return (
                                <div
                                  key={slotRes.slot.slotKey}
                                  className={`toty-collector-card rounded-2xl p-3.5 flex flex-col justify-between gap-2.5 backdrop-blur-md ${
                                    isLibero ? '!border-[#78b3ff]/60' : ''
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2 min-w-0">
                                    <span className="text-[11px] font-mono text-[#9ec8ff] truncate">
                                      {slotRes.slot.shortCode} · {slotRes.slot.label}
                                    </span>
                                    {totyBoardMode === 'community' ? (
                                      <span className="text-[10px] font-mono text-[#c7e2ff]/75 tabular-nums shrink-0 whitespace-nowrap">
                                        {slotRes.winner ? `${slotRes.winner.votes} v.` : '0 v.'}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-mono text-[#c7e2ff]/75 shrink-0 whitespace-nowrap">
                                        {draftPlayer ? 'Elegido' : 'Pendiente'}
                                      </span>
                                    )}
                                  </div>

                                  {totyBoardMode === 'community' ? (
                                    slotRes.winner ? (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <TeamCrest
                                            escudo={slotRes.winner.teamEscudo}
                                            sigla={slotRes.winner.teamSigla}
                                            nombre={slotRes.winner.teamName}
                                            size="sm"
                                            surface="dark"
                                          />
                                          <div className="min-w-0">
                                            <p className="text-sm font-medium leading-tight truncate text-white">
                                              {slotRes.winner.playerName}
                                            </p>
                                            <p className="text-[11px] text-[#b8d4f8]/75 truncate">
                                              {slotRes.winner.teamName}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="space-y-1">
                                          <div className="w-full h-1 rounded-full bg-white/[0.08] overflow-hidden">
                                            <div
                                              className="h-full rounded-full bg-gradient-to-r from-[#3b74f5] to-[#dbeeff]"
                                              style={{
                                                width: `${Math.min(100, Math.max(8, slotRes.winner.percentage))}%`,
                                              }}
                                            />
                                          </div>
                                          <p className="text-[10px] font-mono text-[#b8dcff] tabular-nums">
                                            {slotRes.winner.votes} votos · {slotRes.winner.percentage}%
                                          </p>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="py-2 text-xs text-[#9eb8df]/60 flex items-center gap-2">
                                        <Users className="w-3.5 h-3.5 text-[#8bbaff]/50 shrink-0" />
                                        <span>Vacante</span>
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
                                        <p className="text-sm font-medium leading-tight truncate text-white">
                                          {formatDorsalLabel(draftPlayer.dorsal)}{' '}
                                          {draftPlayer.nombre} {draftPlayer.apellidoPaterno}
                                        </p>
                                        <p className="text-[11px] text-[#b8d4f8]/75 truncate">
                                          {draftTeam?.nombre ?? draftPlayer.teamId}
                                        </p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="py-2 text-xs text-[#9eb8df]/60 flex items-center gap-2">
                                      <Users className="w-3.5 h-3.5 text-[#8bbaff]/50 shrink-0" />
                                      <span>Selecciona en tu papeleta</span>
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

                {/* Runner-Ups */}
                {totyBoardMode === 'community' &&
                  communityToty.slots.some((s) => s.runnerUps.length > 0) && (
                    <div className="px-6 py-4 border-t border-[#9ec8ff]/16 bg-[#050a1a] space-y-2.5">
                      <p className="text-xs text-[#9ec8ff]/75">Siguientes más votados</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {communityToty.slots
                          .filter((s) => s.runnerUps.length > 0)
                          .map((s) => (
                            <div
                              key={`ru-${s.slot.slotKey}`}
                              className="rounded-xl bg-[#0a1432]/70 border border-[#9ec8ff]/14 px-3 py-2 text-[11px]"
                            >
                              <p className="text-[10px] font-mono text-[#9ec8ff] mb-1">
                                {s.position.label}
                              </p>
                              {s.runnerUps.slice(0, 2).map((ru) => (
                                <div
                                  key={ru.playerId}
                                  className="flex items-center justify-between text-zinc-200 gap-2"
                                >
                                  <span className="truncate">{ru.playerName}</span>
                                  <span className="font-mono text-[#b8dcff]/70 shrink-0 tabular-nums">
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

              {/* Right: User TOTYs Ballot */}
              <div className="lg:col-span-5 rounded-3xl bg-[#070d20] border border-[#9ec8ff]/24 p-6 space-y-5 shadow-[0_24px_60px_-34px_rgba(20,66,204,0.5)]">
                <div className="border-b border-[#9ec8ff]/16 pb-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-[#9ec8ff] font-medium flex items-center gap-2">
                      <TotyCrestBadge className="h-4 w-auto opacity-90" />
                      <span>Tu papeleta · {totyFormation.formationName}</span>
                    </p>
                    <span className="text-xs font-mono text-[#dbeeff] tabular-nums">
                      {totySelectedCount}/{totyFormation.slots.length}
                    </span>
                  </div>
                  <h3 className="text-2xl font-medium tracking-[-0.025em] text-white">
                    Arma tus <span className="font-editorial toty-text-ice">TOTYs</span>
                  </h3>
                  <div className="w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#2860e6] via-[#5c96ff] to-[#dbeeff] rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.round(
                          (totySelectedCount / Math.max(1, totyFormation.slots.length)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {disciplinePlayers.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-4">
                    Sin jugadores registrados en {discMeta.nombre}.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-[#0b1534]/85 border border-[#9ec8ff]/18 p-3.5 space-y-2">
                      <label
                        htmlFor="toty-quick-autocomplete"
                        className="block text-xs text-[#b8dcff]/85"
                      >
                        Asignación rápida
                      </label>
                      <VotingPlayerAutocompleteBar
                        id="toty-quick-autocomplete"
                        value={totyQuickSearch}
                        onChange={setTotyQuickSearch}
                        placeholder="Nombre, dorsal o equipo..."
                        ariaLabel="Buscar jugador con autocompletado para los TOTYs"
                        options={totyQuickAutocompleteOptions}
                        actionHint="Asignar"
                        onSelectOption={(opt) => handleQuickAssignTotyPlayer(opt.id)}
                      />
                    </div>

                    {totyFormation.slots.map((slot) => {
                      const { matched, all } = getEligiblePlayersForPosition(
                        totyFilteredQuickPlayers,
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
                      className="w-full py-3 rounded-full bg-gradient-to-r from-[#eef6ff] via-white to-[#cce3ff] hover:brightness-105 disabled:opacity-50 text-[#050a1f] text-xs font-semibold tracking-[0.01em] shadow-[0_14px_30px_-14px_rgba(184,220,255,0.75)] transition-transform duration-200 hover:-translate-y-0.5 cursor-pointer"
                    >
                      {savingKey === 'toty-save'
                        ? 'Guardando...'
                        : !currentUser
                        ? 'Iniciar sesión para votar TOTYs'
                        : existingTotyBallot
                        ? `Actualizar TOTY (${totySelectedCount}/${totyFormation.slots.length})`
                        : `Enviar TOTY (${totySelectedCount}/${totyFormation.slots.length})`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </RevealSection>
    </div>
  );
}
