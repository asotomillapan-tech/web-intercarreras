import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Calendar,
  Edit3,
  MapPin,
  Shield,
  Star,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { DISCIPLINE_MAP } from '../data/ufroSeed';
import {
  findClubSquadsForTeam,
  formatUnifiedClubDisplayName,
} from '../domain/identityCrossRefEngine';
import { formatDorsalLabel } from '../domain/attendanceEngine';
import { canRefereeMatches, shouldRevealPublicMatchData } from '../domain/rbacEngine';
import {
  computeTeamHistoricalStats,
  computeTeamMatchProgression,
} from '../domain/tournamentEngine';
import { TeamProgressionChart } from './TeamProgressionChart';
import {
  filterMatchesByOrg,
  sortMatchesChronologically,
  type MatchSortOrder,
} from '../domain/matchFilterEngine';
import type {
  AppUserProfile,
  Match,
  MatchPhase,
  MatchStatus,
  MvpVoteRecord,
  Player,
  Team,
} from '../types/tournament';
import { MatchFilterBar } from './MatchFilterBar';
import { EDITORIAL_EASE } from './MotionPrimitives';
import { TeamCrest } from './TeamCrest';

interface TeamProfileModalProps {
  team: Team | null;
  teams: Team[];
  players: Player[];
  matches: Match[];
  mvpVotes: MvpVoteRecord[];
  currentUser: AppUserProfile | null;
  onClose: () => void;
  onToggleFavoriteTeam: (teamId: string) => void;
  onOpenMatchModal: (match: Match) => void;
  onInspectPlayer: (player: Player) => void;
  onAdminEditMatch?: (matchId: string) => void;
}

export function TeamProfileModal({
  team,
  teams,
  players,
  matches,
  mvpVotes,
  currentUser,
  onClose,
  onToggleFavoriteTeam,
  onOpenMatchModal,
  onInspectPlayer,
  onAdminEditMatch,
}: TeamProfileModalProps) {
  const [activeTeamId, setActiveTeamId] = useState<string | null>(team?.id ?? null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | MatchStatus>('ALL');
  const [groupFilter, setGroupFilter] = useState<'ALL' | string>('ALL');
  const [stageFilter, setStageFilter] = useState<'ALL' | MatchPhase>('ALL');
  const [sortOrder, setSortOrder] = useState<MatchSortOrder>('newest');

  useEffect(() => {
    setActiveTeamId(team?.id ?? null);
    setStatusFilter('ALL');
    setGroupFilter('ALL');
    setStageFilter('ALL');
    setSortOrder('newest');
  }, [team?.id]);

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const clubSquads = useMemo<Team[]>(() => {
    if (!team) return [];
    return findClubSquadsForTeam(team, teams).squads;
  }, [team, teams]);

  const activeTeam: Team | null = useMemo(() => {
    if (!team) return null;
    if (!activeTeamId) return team;
    return clubSquads.find((s) => s.id === activeTeamId) ?? team;
  }, [team, activeTeamId, clubSquads]);

  const unifiedClubName = useMemo(() => {
    if (clubSquads.length <= 1) return activeTeam?.nombre ?? '';
    return formatUnifiedClubDisplayName(clubSquads);
  }, [clubSquads, activeTeam]);

  const disciplineMeta = activeTeam ? DISCIPLINE_MAP[activeTeam.disciplineId] : null;

  const roster = useMemo(() => {
    if (!activeTeam) return [];
    return players
      .filter((p) => p.teamId === activeTeam.id)
      .sort((a, b) => a.dorsal - b.dorsal);
  }, [players, activeTeam]);

  const historicalStats = useMemo(() => {
    if (!activeTeam || !disciplineMeta) return null;
    return computeTeamHistoricalStats(activeTeam, disciplineMeta.sportType, matches);
  }, [activeTeam, disciplineMeta, matches]);

  const matchProgression = useMemo(() => {
    if (!activeTeam) return [];
    return computeTeamMatchProgression(activeTeam, matches, teamMap);
  }, [activeTeam, matches, teamMap]);

  const mvpAwardsCount = useMemo(() => {
    if (!activeTeam || !historicalStats) return 0;
    let count = 0;
    for (const item of historicalStats.history) {
      if (item.match.status !== 'FINALIZADO') continue;
      const votes = mvpVotes.filter((v) => v.matchId === item.match.id);
      if (votes.length === 0) continue;
      const tallies = new Map<string, { teamId: string; votes: number }>();
      for (const v of votes) {
        const cur = tallies.get(v.playerId) ?? { teamId: v.teamId, votes: 0 };
        cur.votes += 1;
        tallies.set(v.playerId, cur);
      }
      const winner = Array.from(tallies.values()).sort((a, b) => b.votes - a.votes)[0];
      if (winner && winner.teamId === activeTeam.id) {
        count += 1;
      }
    }
    return count;
  }, [activeTeam, historicalStats, mvpVotes]);

  if (!activeTeam || !disciplineMeta || !historicalStats) return null;

  const isFavorite = currentUser?.favoriteTeamIds.includes(activeTeam.id) ?? false;
  const isAdmin = currentUser?.role === 'admin';
  const selectedUfroCount = roster.filter((p) => p.esSeleccionadoUfro).length;

  const teamAllMatches = historicalStats.history.map((h) => h.match);
  const orgAllowedMatchIds = new Set(
    filterMatchesByOrg(teamAllMatches, {
      disciplineId: activeTeam.disciplineId,
      groupName: groupFilter,
      fase: stageFilter,
    }).map((m) => m.id)
  );

  const historyByMatchId = new Map(historicalStats.history.map((item) => [item.match.id, item]));
  const matchingMatches = teamAllMatches.filter((m) => {
    if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
    if (!orgAllowedMatchIds.has(m.id)) return false;
    return true;
  });
  const filteredHistory = sortMatchesChronologically(matchingMatches, sortOrder)
    .map((m) => historyByMatchId.get(m.id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const favorLabel =
    disciplineMeta.sportType === 'futbol7'
      ? 'GF'
      : disciplineMeta.sportType === 'voleibol'
      ? 'Sets F'
      : 'PF';
  const contraLabel =
    disciplineMeta.sportType === 'futbol7'
      ? 'GC'
      : disciplineMeta.sportType === 'voleibol'
      ? 'Sets C'
      : 'PC';

  const getTopMvpForMatch = (matchId: string): string | null => {
    const votes = mvpVotes.filter((v) => v.matchId === matchId);
    if (votes.length === 0) return null;
    const tally = new Map<string, { name: string; count: number }>();
    for (const v of votes) {
      const prev = tally.get(v.playerId) ?? { name: v.playerName, count: 0 };
      prev.count += 1;
      tally.set(v.playerId, prev);
    }
    const top = Array.from(tally.values()).sort((a, b) => b.count - a.count)[0];
    return top ? `${top.name} (${top.count})` : null;
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-profile-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: EDITORIAL_EASE }}
        className="rounded-3xl bg-[#0a0a0e] text-zinc-100 w-full max-w-4xl border border-white/[0.1] shadow-2xl shadow-black my-6 overflow-hidden"
      >
        {/* Obsidian Header */}
        <div className="bg-[#0e0e14] border-b border-white/[0.08] p-6 sm:p-8 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <TeamCrest
                escudo={activeTeam.escudo}
                sigla={activeTeam.sigla}
                nombre={activeTeam.nombre}
                size="xl"
                surface="dark"
              />
              <div>
                <p className="text-xs text-[#a5b0ff] font-medium">
                  {disciplineMeta.nombre} · {activeTeam.groupName}
                  {activeTeam.anioFundacion ? ` · Est. ${activeTeam.anioFundacion}` : ''}
                </p>
                <h2
                  id="team-profile-title"
                  className="text-3xl sm:text-4xl font-medium tracking-[-0.03em] text-white mt-1 leading-tight"
                >
                  {clubSquads.length > 1 ? unifiedClubName : activeTeam.nombre}
                </h2>
                {clubSquads.length > 1 && activeTeam.nombre !== unifiedClubName && (
                  <p className="text-xs text-zinc-400 mt-1">
                    Plantel: <span className="text-white">{activeTeam.nombre}</span>
                  </p>
                )}
                <p className="text-xs text-zinc-500 mt-1.5">
                  {activeTeam.carrera} · {activeTeam.facultad}
                </p>
                {activeTeam.logrosAnteriores && (
                  <p className="text-xs text-amber-300 mt-1.5 flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 shrink-0" />
                    <span>{activeTeam.logrosAnteriores}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-start shrink-0">
              <button
                type="button"
                onClick={() => onToggleFavoriteTeam(activeTeam.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isFavorite
                    ? 'bg-[#707ef9] border-[#707ef9] text-white'
                    : 'bg-white/[0.04] border-white/[0.14] text-zinc-200 hover:border-white/30'
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-white' : ''}`} />
                <span>{isFavorite ? 'Siguiendo' : 'Seguir'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar perfil del equipo"
                className="w-9 h-9 rounded-full inline-flex items-center justify-center bg-white/[0.04] border border-white/[0.1] text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {clubSquads.length > 1 && (
            <div className="pt-4 border-t border-white/[0.08] space-y-2">
              <p className="text-xs text-zinc-500">
                Ramas del club ({clubSquads.length})
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {clubSquads.map((squad) => {
                  const squadMeta = DISCIPLINE_MAP[squad.disciplineId];
                  const selected = squad.id === activeTeam.id;
                  return (
                    <button
                      key={squad.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setActiveTeamId(squad.id);
                        setGroupFilter('ALL');
                        setStageFilter('ALL');
                        setStatusFilter('ALL');
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        selected
                          ? 'bg-white text-[#050507]'
                          : 'bg-white/[0.05] text-zinc-300 hover:bg-white/[0.12] hover:text-white'
                      }`}
                    >
                      {squadMeta.nombreCorto} ({squad.groupName})
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          {/* HISTORICAL STATISTICS */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-white/[0.08] pb-3">
              <div>
                <p className="text-xs text-[#a5b0ff]">Rendimiento acumulado</p>
                <h3 className="text-xl font-medium tracking-[-0.02em] text-white mt-0.5">
                  Estadísticas históricas
                </h3>
              </div>
              {historicalStats.racha.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-500 mr-1">Racha:</span>
                  {historicalStats.racha.map((r, i) => (
                    <span
                      key={i}
                      className={`w-6 h-6 rounded-full text-[11px] font-semibold flex items-center justify-center ${
                        r === 'G'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : r === 'E'
                          ? 'bg-white/[0.1] text-zinc-200'
                          : 'bg-red-500/15 text-red-300 border border-red-500/25'
                      }`}
                    >
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
              {[
                { label: 'PJ', val: historicalStats.pj, cls: 'text-white' },
                { label: 'PG', val: historicalStats.pg, cls: 'text-emerald-400' },
                { label: 'PE', val: historicalStats.pe, cls: 'text-zinc-300' },
                { label: 'PP', val: historicalStats.pp, cls: 'text-red-400' },
                {
                  label: favorLabel,
                  val:
                    disciplineMeta.sportType === 'voleibol'
                      ? historicalStats.setsFavor ?? 0
                      : historicalStats.favor,
                  cls: 'text-white',
                },
                {
                  label: contraLabel,
                  val:
                    disciplineMeta.sportType === 'voleibol'
                      ? historicalStats.setsContra ?? 0
                      : historicalStats.contra,
                  cls: 'text-white',
                },
                {
                  label: 'DIF',
                  val:
                    historicalStats.diferencia > 0
                      ? `+${historicalStats.diferencia}`
                      : historicalStats.diferencia,
                  cls: 'text-white',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/[0.08] bg-[#101016] p-3"
                >
                  <p className="text-[11px] text-zinc-500">{stat.label}</p>
                  <p className={`text-2xl font-medium tabular-nums mt-0.5 ${stat.cls}`}>
                    {stat.val}
                  </p>
                </div>
              ))}
              <div className="rounded-2xl border border-[#707ef9]/35 bg-[#707ef9]/15 p-3">
                <p className="text-[11px] text-[#c7ceff]">Puntos</p>
                <p className="text-2xl font-semibold tabular-nums text-white mt-0.5">
                  {historicalStats.puntos}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-2xl border border-white/[0.08] bg-[#101016] p-3.5 flex items-center justify-between">
                <span className="text-zinc-400 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#9aa5ff]" />
                  <span>Efectividad</span>
                </span>
                <strong className="text-lg font-medium tabular-nums text-white">
                  {historicalStats.winRatePct}%
                </strong>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-[#101016] p-3.5 flex items-center justify-between">
                <span className="text-zinc-400 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#9aa5ff]" />
                  <span>Plantel (Selec. UFRO)</span>
                </span>
                <strong className="text-lg font-medium tabular-nums text-white">
                  {roster.length} ({selectedUfroCount})
                </strong>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-[#101016] p-3.5 flex items-center justify-between">
                <span className="text-zinc-400 flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#9aa5ff]" />
                  <span>Premios MVP</span>
                </span>
                <strong className="text-lg font-medium tabular-nums text-white">
                  {mvpAwardsCount}
                </strong>
              </div>
            </div>
          </section>

          {/* COMPARATIVE PROGRESSION CHART */}
          <TeamProgressionChart
            progression={matchProgression}
            sportType={disciplineMeta.sportType}
            teamName={activeTeam.nombre}
          />

          {/* MATCH HISTORY */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-white/[0.08] pb-3">
              <div>
                <p className="text-xs text-[#a5b0ff]">Encuentros</p>
                <h3 className="text-xl font-medium tracking-[-0.02em] text-white mt-0.5">
                  Historial ({historicalStats.history.length})
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-1 rounded-full bg-white/[0.04] p-1 border border-white/[0.08]">
                {(
                  [
                    { id: 'ALL', label: `Todos (${historicalStats.history.length})` },
                    {
                      id: 'FINALIZADO',
                      label: `Finalizados (${historicalStats.history.filter((h) => h.match.status === 'FINALIZADO').length})`,
                    },
                    {
                      id: 'EN_VIVO',
                      label: `En juego (${historicalStats.history.filter((h) => h.match.status === 'EN_VIVO').length})`,
                    },
                    {
                      id: 'PROGRAMADO',
                      label: `Programados (${historicalStats.history.filter((h) => h.match.status === 'PROGRAMADO').length})`,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                      statusFilter === tab.id
                        ? 'bg-white text-[#050507]'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <MatchFilterBar
              idPrefix="team-history"
              matches={teamAllMatches}
              disciplineFilter={activeTeam.disciplineId}
              disciplineOptions={[disciplineMeta]}
              allowAllDisciplines={false}
              disciplineLocked
              groupFilter={groupFilter}
              onGroupChange={setGroupFilter}
              stageFilter={stageFilter}
              onStageChange={setStageFilter}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              filteredCount={filteredHistory.length}
              totalCount={historicalStats.history.length}
              hasExtraActiveFilters={statusFilter !== 'ALL'}
              onReset={() => {
                setGroupFilter('ALL');
                setStageFilter('ALL');
                setStatusFilter('ALL');
                setSortOrder('newest');
              }}
              compact
            />

            {filteredHistory.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.08] bg-[#101016] p-8 text-center text-xs text-zinc-500">
                Sin encuentros para el filtro seleccionado.
              </div>
            ) : (
              <div className="rounded-2xl divide-y divide-white/[0.06] border border-white/[0.08] bg-[#101016] overflow-hidden">
                {filteredHistory.map((item) => {
                  const { match, isHome, opponentTeamId, outcome } = item;
                  const homeTeam = teamMap.get(match.homeTeamId);
                  const awayTeam = teamMap.get(match.awayTeamId);
                  const opponent = teamMap.get(opponentTeamId);
                  const revealScore =
                    canRefereeMatches(currentUser) || shouldRevealPublicMatchData(match);
                  const topMvp =
                    match.status === 'FINALIZADO' ? getTopMvpForMatch(match.id) : null;

                  const outcomeBadge =
                    outcome === 'G'
                      ? { text: 'Victoria', cls: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25' }
                      : outcome === 'E'
                      ? { text: 'Empate', cls: 'bg-white/[0.08] text-zinc-200' }
                      : outcome === 'P'
                      ? { text: 'Derrota', cls: 'bg-red-500/15 text-red-300 border border-red-500/25' }
                      : outcome === 'EN_VIVO'
                      ? { text: 'En juego', cls: 'bg-[#707ef9]/20 text-[#c7ceff]' }
                      : { text: 'Programado', cls: 'bg-white/[0.05] text-zinc-400' };

                  return (
                    <div
                      key={match.id}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${outcomeBadge.cls}`}>
                            {outcomeBadge.text}
                          </span>
                          <span className="text-zinc-400">
                            {match.fase} · J{match.jornada} · {match.groupName}
                          </span>
                          <span className="text-zinc-500 inline-flex items-center gap-1 tabular-nums">
                            <Calendar className="w-3 h-3" />
                            {match.fecha} {match.hora}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className={isHome ? 'font-medium text-white' : 'text-zinc-400'}>
                            {homeTeam?.nombre ?? match.homeTeamId}
                          </span>
                          <span className="text-sm font-semibold tabular-nums px-2.5 py-0.5 rounded-full bg-white/[0.08] text-white">
                            {revealScore ? `${match.homeScore} — ${match.awayScore}` : 'vs'}
                          </span>
                          <span className={!isHome ? 'font-medium text-white' : 'text-zinc-400'}>
                            {awayTeam?.nombre ?? opponent?.nombre ?? match.awayTeamId}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#9aa5ff]" />
                            {match.cancha}
                          </span>
                          {revealScore && match.periods.length > 0 && (
                            <span className="tabular-nums">
                              {match.periods
                                .map((p, idx) =>
                                  disciplineMeta.sportType === 'voleibol'
                                    ? `S${idx + 1} ${p.home}-${p.away}`
                                    : disciplineMeta.sportType === 'futbol7'
                                    ? `T${idx + 1} ${p.home}-${p.away}`
                                    : `Q${idx + 1} ${p.home}-${p.away}`
                                )
                                .join(' · ')}
                            </span>
                          )}
                          {topMvp && <span className="text-[#a5b0ff]">MVP: {topMvp}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenMatchModal(match);
                          }}
                          className="px-3.5 py-1.5 rounded-full border border-white/[0.12] hover:border-white/30 text-xs text-zinc-200 cursor-pointer transition-colors"
                        >
                          Acta / MVP
                        </button>
                        {isAdmin && onAdminEditMatch && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onAdminEditMatch(match.id);
                            }}
                            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-[#707ef9] hover:bg-[#5f6ef5] text-white text-xs cursor-pointer transition-colors"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Editar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* TEAM ROSTER */}
          <section className="space-y-4">
            <div className="border-b border-white/[0.08] pb-3">
              <p className="text-xs text-[#a5b0ff]">Nómina oficial</p>
              <h3 className="text-xl font-medium tracking-[-0.02em] text-white mt-0.5">
                Plantel ({roster.length})
              </h3>
            </div>

            {roster.length === 0 ? (
              <p className="text-xs text-zinc-500 rounded-2xl bg-[#101016] border border-white/[0.08] p-4">
                Sin jugadores registrados en este plantel.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {roster.map((player) => {
                  const mainStat =
                    disciplineMeta.sportType === 'futbol7'
                      ? `${player.stats.goles}G · ${player.stats.asistencias}A`
                      : disciplineMeta.sportType === 'voleibol'
                      ? `${player.stats.puntos} Pts · ${player.stats.aces} Aces`
                      : `${player.stats.puntos} Pts · ${player.stats.rebotes} Reb`;
                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        onInspectPlayer(player);
                      }}
                      className="text-left rounded-2xl border border-white/[0.08] bg-[#101016] hover:border-white/[0.2] p-3.5 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-xl bg-white/[0.08] text-white text-xs font-medium flex items-center justify-center shrink-0 tabular-nums">
                          {formatDorsalLabel(player.dorsal)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {player.nombre} {player.apellidoPaterno}
                          </p>
                          <p className="text-xs text-zinc-500 truncate">
                            {player.posicion}
                            {player.esSeleccionadoUfro && (
                              <span className="text-[#a5b0ff]"> · UFRO</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-medium text-zinc-200 tabular-nums">{mainStat}</p>
                        <p className="text-[11px] text-zinc-500 tabular-nums">
                          {player.stats.partidosJugados} PJ
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <div className="flex items-center justify-between pt-4 border-t border-white/[0.08] text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#9aa5ff]" />
              <span>Estadísticas oficiales UFRO</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full bg-white text-[#050507] hover:bg-zinc-200 font-medium text-xs cursor-pointer transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
