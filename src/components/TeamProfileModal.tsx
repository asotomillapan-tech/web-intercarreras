import { useMemo, useState } from 'react';
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
import { DISCIPLINE_MAP } from '../data/ufroSeed';
import { canRefereeMatches, shouldRevealPublicMatchData } from '../domain/rbacEngine';
import {
  computeTeamHistoricalStats,
  computeTeamMatchProgression,
} from '../domain/tournamentEngine';
import { TeamProgressionChart } from './TeamProgressionChart';
import { extractMatchStages, MATCH_STAGE_ORDER } from '../domain/matchFilterEngine';
import type {
  AppUserProfile,
  Match,
  MatchPhase,
  MatchStatus,
  MvpVoteRecord,
  Player,
  Team,
} from '../types/tournament';
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
  const [statusFilter, setStatusFilter] = useState<'ALL' | MatchStatus>('ALL');
  const [stageFilter, setStageFilter] = useState<'ALL' | MatchPhase>('ALL');

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const disciplineMeta = team ? DISCIPLINE_MAP[team.disciplineId] : null;

  const roster = useMemo(() => {
    if (!team) return [];
    return players
      .filter((p) => p.teamId === team.id)
      .sort((a, b) => a.dorsal - b.dorsal);
  }, [players, team]);

  const historicalStats = useMemo(() => {
    if (!team || !disciplineMeta) return null;
    return computeTeamHistoricalStats(team, disciplineMeta.sportType, matches);
  }, [team, disciplineMeta, matches]);

  const matchProgression = useMemo(() => {
    if (!team) return [];
    return computeTeamMatchProgression(team, matches, teamMap);
  }, [team, matches, teamMap]);

  const mvpAwardsCount = useMemo(() => {
    if (!team || !historicalStats) return 0;
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
      if (winner && winner.teamId === team.id) {
        count += 1;
      }
    }
    return count;
  }, [team, historicalStats, mvpVotes]);

  if (!team || !disciplineMeta || !historicalStats) return null;

  const isFavorite = currentUser?.favoriteTeamIds.includes(team.id) ?? false;
  const isAdmin = currentUser?.role === 'admin';
  const selectedUfroCount = roster.filter((p) => p.esSeleccionadoUfro).length;

  const availableTeamStages = useMemo(() => {
    const teamMatches = historicalStats.history.map((h) => h.match);
    const present = extractMatchStages(teamMatches);
    return present.length > 0 ? present : MATCH_STAGE_ORDER;
  }, [historicalStats.history]);

  const filteredHistory = historicalStats.history.filter((item) => {
    if (statusFilter !== 'ALL' && item.match.status !== statusFilter) return false;
    if (stageFilter !== 'ALL' && item.match.fase !== stageFilter) return false;
    return true;
  });

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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-profile-title"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 p-4 overflow-y-auto"
    >
      <div className="bg-white w-full max-w-4xl border border-neutral-200 shadow-2xl my-6 overflow-hidden">
        {/* Carbon Editorial Team Header */}
        <div className="bg-[#0d0d0d] text-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <TeamCrest
              escudo={team.escudo}
              sigla={team.sigla}
              nombre={team.nombre}
              size="xl"
              surface="dark"
            />
            <div>
              <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
                {disciplineMeta.nombre} · {team.groupName}
                {team.anioFundacion ? ` · Fundado en ${team.anioFundacion}` : ''}
              </p>
              <h2
                id="team-profile-title"
                className="font-display text-3xl sm:text-4xl uppercase tracking-wide mt-1 leading-none"
              >
                {team.nombre}
              </h2>
              <p className="text-xs text-neutral-300 mt-2">
                {team.carrera} · {team.facultad}
              </p>
              {team.logrosAnteriores && (
                <p className="text-xs text-[#707ef9] mt-1 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 shrink-0" />
                  <span>{team.logrosAnteriores}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-start shrink-0">
            <button
              type="button"
              onClick={() => onToggleFavoriteTeam(team.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-display uppercase tracking-widest border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isFavorite
                  ? 'bg-[#707ef9] border-[#707ef9] text-white'
                  : 'border-white/25 text-white hover:border-[#707ef9]'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-white' : ''}`} />
              <span>{isFavorite ? 'En favoritos' : 'Seguir equipo'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar perfil del equipo"
              className="p-2 text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          {/* HISTORICAL STATISTICS SECTION */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-neutral-200 pb-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
                  Rendimiento Acumulado
                </p>
                <h3 className="font-display text-2xl uppercase tracking-wide text-[#0d0d0d]">
                  Estadísticas Históricas del Equipo
                </h3>
              </div>
              {historicalStats.racha.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-neutral-500 mr-1">
                    Racha reciente:
                  </span>
                  {historicalStats.racha.map((r, i) => (
                    <span
                      key={i}
                      className={`w-6 h-6 text-[11px] font-bold flex items-center justify-center ${
                        r === 'G'
                          ? 'bg-[#0d0d0d] text-white'
                          : r === 'E'
                          ? 'bg-neutral-200 text-[#0d0d0d]'
                          : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                      }`}
                    >
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <div className="border border-neutral-200 bg-[#f5f6f8] p-3">
                <p className="text-[11px] uppercase tracking-wider text-neutral-500">PJ</p>
                <p className="font-display text-3xl tabular-nums text-[#0d0d0d]">
                  {historicalStats.pj}
                </p>
              </div>
              <div className="border border-neutral-200 bg-[#f5f6f8] p-3">
                <p className="text-[11px] uppercase tracking-wider text-neutral-500">PG</p>
                <p className="font-display text-3xl tabular-nums text-emerald-700">
                  {historicalStats.pg}
                </p>
              </div>
              <div className="border border-neutral-200 bg-[#f5f6f8] p-3">
                <p className="text-[11px] uppercase tracking-wider text-neutral-500">PE</p>
                <p className="font-display text-3xl tabular-nums text-neutral-700">
                  {historicalStats.pe}
                </p>
              </div>
              <div className="border border-neutral-200 bg-[#f5f6f8] p-3">
                <p className="text-[11px] uppercase tracking-wider text-neutral-500">PP</p>
                <p className="font-display text-3xl tabular-nums text-red-700">
                  {historicalStats.pp}
                </p>
              </div>
              <div className="border border-neutral-200 bg-[#f5f6f8] p-3">
                <p className="text-[11px] uppercase tracking-wider text-neutral-500">{favorLabel}</p>
                <p className="font-display text-3xl tabular-nums text-[#0d0d0d]">
                  {disciplineMeta.sportType === 'voleibol'
                    ? historicalStats.setsFavor ?? 0
                    : historicalStats.favor}
                </p>
              </div>
              <div className="border border-neutral-200 bg-[#f5f6f8] p-3">
                <p className="text-[11px] uppercase tracking-wider text-neutral-500">{contraLabel}</p>
                <p className="font-display text-3xl tabular-nums text-[#0d0d0d]">
                  {disciplineMeta.sportType === 'voleibol'
                    ? historicalStats.setsContra ?? 0
                    : historicalStats.contra}
                </p>
              </div>
              <div className="border border-neutral-200 bg-[#f5f6f8] p-3">
                <p className="text-[11px] uppercase tracking-wider text-neutral-500">DIF</p>
                <p className="font-display text-3xl tabular-nums text-[#0d0d0d]">
                  {historicalStats.diferencia > 0
                    ? `+${historicalStats.diferencia}`
                    : historicalStats.diferencia}
                </p>
              </div>
              <div className="border border-[#707ef9] bg-[#0d0d0d] text-white p-3">
                <p className="text-[11px] uppercase tracking-wider text-[#707ef9]">Puntos</p>
                <p className="font-display text-3xl tabular-nums">{historicalStats.puntos}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="border border-neutral-200 p-3.5 flex items-center justify-between">
                <span className="text-neutral-600 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#707ef9]" />
                  <span>Efectividad de victorias</span>
                </span>
                <strong className="font-display text-xl tabular-nums text-[#0d0d0d]">
                  {historicalStats.winRatePct}%
                </strong>
              </div>
              <div className="border border-neutral-200 p-3.5 flex items-center justify-between">
                <span className="text-neutral-600 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#707ef9]" />
                  <span>Plantel inscrito (Selec. UFRO)</span>
                </span>
                <strong className="font-display text-xl tabular-nums text-[#0d0d0d]">
                  {roster.length} ({selectedUfroCount})
                </strong>
              </div>
              <div className="border border-neutral-200 p-3.5 flex items-center justify-between">
                <span className="text-neutral-600 flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#707ef9]" />
                  <span>Premios MVP del equipo</span>
                </span>
                <strong className="font-display text-xl tabular-nums text-[#0d0d0d]">
                  {mvpAwardsCount}
                </strong>
              </div>
            </div>
          </section>

          {/* COMPARATIVE PROGRESSION CHART (RECHARTS) */}
          <TeamProgressionChart
            progression={matchProgression}
            sportType={disciplineMeta.sportType}
            teamName={team.nombre}
          />

          {/* COMPLETE MATCH HISTORY SECTION */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-neutral-200 pb-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
                  Registro Oficial de Encuentros
                </p>
                <h3 className="font-display text-2xl uppercase tracking-wide text-[#0d0d0d]">
                  Historial Completo de Partidos ({historicalStats.history.length})
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Filtrar historial por fase"
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value as 'ALL' | MatchPhase)}
                  className="bg-white border border-neutral-300 px-3 py-1.5 text-xs font-medium text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
                >
                  <option value="ALL">Todas las fases</option>
                  {availableTeamStages.map((st) => (
                    <option key={st} value={st}>
                      {st === 'Grupos' ? 'Fase de Grupos' : st}
                    </option>
                  ))}
                </select>

                <div className="flex flex-wrap items-center gap-1 bg-[#f5f6f8] p-1 border border-neutral-200">
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
                      className={`px-3 py-1.5 text-xs font-display uppercase tracking-wider transition-colors cursor-pointer ${
                        statusFilter === tab.id
                          ? 'bg-[#0d0d0d] text-white'
                          : 'text-neutral-600 hover:text-[#0d0d0d]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="border border-neutral-200 bg-[#f5f6f8] p-8 text-center text-xs text-neutral-600">
                No hay encuentros registrados para este equipo con el filtro seleccionado.
              </div>
            ) : (
              <div className="divide-y divide-neutral-200 border border-neutral-200">
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
                      ? { text: 'VICTORIA', cls: 'bg-[#0d0d0d] text-white' }
                      : outcome === 'E'
                      ? { text: 'EMPATE', cls: 'bg-neutral-200 text-[#0d0d0d]' }
                      : outcome === 'P'
                      ? { text: 'DERROTA', cls: 'bg-red-50 text-red-800 border border-red-200' }
                      : outcome === 'EN_VIVO'
                      ? { text: 'EN JUEGO', cls: 'bg-[#707ef9] text-white' }
                      : { text: 'PROGRAMADO', cls: 'bg-[#f5f6f8] text-neutral-600 border border-neutral-200' };

                  return (
                    <div
                      key={match.id}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#f9fafb]"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={`px-2 py-0.5 font-display uppercase tracking-wider text-[11px] ${outcomeBadge.cls}`}
                          >
                            {outcomeBadge.text}
                          </span>
                          <span className="text-neutral-500 uppercase font-medium">
                            {match.fase} · Jornada {match.jornada} · {match.groupName}
                          </span>
                          <span className="text-neutral-400 inline-flex items-center gap-1 tabular-nums">
                            <Calendar className="w-3 h-3" />
                            {match.fecha} {match.hora}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className={isHome ? 'font-bold text-[#0d0d0d]' : 'text-neutral-700'}>
                            {homeTeam?.nombre ?? match.homeTeamId}
                          </span>
                          <span className="font-display text-xl tabular-nums px-2 py-0.5 bg-[#0d0d0d] text-white">
                            {revealScore ? `${match.homeScore} — ${match.awayScore}` : 'VS'}
                          </span>
                          <span className={!isHome ? 'font-bold text-[#0d0d0d]' : 'text-neutral-700'}>
                            {awayTeam?.nombre ?? opponent?.nombre ?? match.awayTeamId}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#707ef9]" />
                            {match.cancha}
                          </span>
                          {revealScore && match.periods.length > 0 && (
                            <span className="tabular-nums">
                              Parciales:{' '}
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
                          {topMvp && (
                            <span className="text-[#707ef9] font-medium">MVP: {topMvp}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenMatchModal(match);
                          }}
                          className="px-3 py-1.5 border border-neutral-300 hover:border-[#707ef9] text-xs font-display uppercase tracking-wider text-[#0d0d0d] cursor-pointer"
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
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0d0d0d] hover:bg-[#707ef9] text-white text-xs font-display uppercase tracking-wider cursor-pointer"
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

          {/* TEAM ROSTER SECTION */}
          <section className="space-y-4">
            <div className="border-b border-neutral-200 pb-3">
              <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
                Nómina Oficial UFRO
              </p>
              <h3 className="font-display text-2xl uppercase tracking-wide text-[#0d0d0d]">
                Plantel de Jugadores ({roster.length})
              </h3>
            </div>

            {roster.length === 0 ? (
              <p className="text-xs text-neutral-500 bg-[#f5f6f8] border border-neutral-200 p-4">
                Aún no hay jugadores registrados en el plantel de este equipo.
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
                      className="text-left border border-neutral-200 hover:border-[#707ef9] p-3.5 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 bg-[#0d0d0d] text-white font-display text-lg flex items-center justify-center shrink-0 tabular-nums">
                          {player.dorsal}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#0d0d0d] truncate">
                            {player.nombre} {player.apellidoPaterno}
                          </p>
                          <p className="text-xs text-neutral-500 truncate">
                            {player.posicion}
                            {player.esSeleccionadoUfro && (
                              <span className="text-[#707ef9] font-medium"> · Selec. UFRO</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-medium text-[#0d0d0d] tabular-nums">{mainStat}</p>
                        <p className="text-[11px] text-neutral-500 tabular-nums">
                          {player.stats.partidosJugados} PJ
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <div className="flex items-center justify-between pt-4 border-t border-neutral-200 text-xs text-neutral-500">
            <span className="inline-flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#707ef9]" />
              <span>Estadísticas oficiales sincronizadas desde Firestore · UFRO</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#0d0d0d] hover:bg-[#707ef9] text-white font-display uppercase tracking-widest text-xs cursor-pointer"
            >
              Cerrar perfil
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
