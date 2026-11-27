import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Award,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Lock,
  MapPin,
  Repeat2,
  Search,
  ShieldCheck,
  Star,
  Trophy,
  X,
} from 'lucide-react';
import { DISCIPLINE_MAP } from '../data/ufroSeed';
import {
  formatDorsalLabel,
  getEffectiveMatchDorsal,
  getNormalizedMatchAttendance,
} from '../domain/attendanceEngine';
import {
  canRefereeMatches,
  canVoteMatchMvp,
  computeMatchMvpStandings,
  shouldRevealPublicMatchData,
} from '../domain/rbacEngine';
import type {
  AppUserProfile,
  Match,
  MvpVoteRecord,
  Player,
  Team,
} from '../types/tournament';
import { EDITORIAL_EASE } from './MotionPrimitives';
import { SportScoreboard } from './SportScoreboard';

interface MatchMvpModalProps {
  match: Match | null;
  teams: Team[];
  players: Player[];
  mvpVotes: MvpVoteRecord[];
  currentUser: AppUserProfile | null;
  onClose: () => void;
  onVoteMvp: (match: Match, player: Player) => void;
  onOpenAuth: () => void;
  onOpenMatchInReferee?: (matchId: string) => void;
  onToggleFavoriteTeam?: (teamId: string) => void;
}

export function MatchMvpModal({
  match,
  teams,
  players,
  mvpVotes,
  currentUser,
  onClose,
  onVoteMvp,
  onOpenAuth,
  onOpenMatchInReferee,
  onToggleFavoriteTeam,
}: MatchMvpModalProps) {
  const [playerQuery, setPlayerQuery] = useState('');
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  if (!match) return null;

  const disc = DISCIPLINE_MAP[match.disciplineId];
  const homeTeam = teamMap.get(match.homeTeamId);
  const awayTeam = teamMap.get(match.awayTeamId);
  const revealData = shouldRevealPublicMatchData(match);
  const votingOpen = canVoteMatchMvp(match);

  const normQuery = playerQuery
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  const matchesRosterSearch = (p: Player) => {
    if (!normQuery) return true;
    const effDorsal = getEffectiveMatchDorsal(match, p);
    const dorsalLabel = formatDorsalLabel(effDorsal);
    const text = `${p.nombre} ${p.apellidoPaterno} ${dorsalLabel} ${effDorsal} ${p.posicion}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return normQuery.split(/\s+/).every((tok) => text.includes(tok));
  };

  const homePlayers = players.filter((p) => p.teamId === match.homeTeamId && matchesRosterSearch(p));
  const awayPlayers = players.filter((p) => p.teamId === match.awayTeamId && matchesRosterSearch(p));

  const mvpSummary = computeMatchMvpStandings(match.id, mvpVotes);
  const existingUserVote = currentUser
    ? mvpVotes.find((v) => v.matchId === match.id && v.voterUid === currentUser.uid)
    : undefined;

  const isHomeFav = Boolean(currentUser?.favoriteTeamIds.includes(match.homeTeamId));
  const isAwayFav = Boolean(currentUser?.favoriteTeamIds.includes(match.awayTeamId));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-mvp-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.32, ease: EDITORIAL_EASE }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0a0a0e] text-zinc-100 w-full max-w-3xl rounded-3xl border border-white/[0.1] shadow-[0_32px_90px_rgba(0,0,0,0.85)] my-6 overflow-hidden"
      >
        {/* Header & Scoreboard */}
        <div className="bg-[#08080c] p-6 space-y-5 border-b border-white/[0.08]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-[#9aa5ff] font-medium">
                {disc.nombre} · {match.fase !== 'Grupos' ? match.fase : match.groupName}
                {match.fase !== 'Grupos' && match.playoffLeg === 'IDA'
                  ? ' · Ida'
                  : match.fase !== 'Grupos' && match.playoffLeg === 'VUELTA'
                  ? ' · Vuelta'
                  : ''}{' '}
                · J{match.jornada}
              </p>
              <h2
                id="match-mvp-modal-title"
                className="text-2xl sm:text-3xl font-medium tracking-[-0.025em] text-white mt-1"
              >
                {votingOpen ? (
                  <>
                    Votación <span className="font-editorial text-[#c8ceff]">POTM</span>
                  </>
                ) : revealData ? (
                  <>
                    Ficha <span className="font-editorial text-[#c8ceff]">oficial</span>
                  </>
                ) : (
                  <>
                    Encuentro <span className="font-editorial text-[#c8ceff]">programado</span>
                  </>
                )}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar detalle del encuentro"
              className="w-9 h-9 rounded-full bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.1] flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {revealData ? (
            <SportScoreboard
              match={match}
              sportType={disc.sportType}
              disciplineName={disc.nombre}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              mode="final"
              embedded
              homeAction={
                onToggleFavoriteTeam ? (
                  <button
                    type="button"
                    onClick={() =>
                      currentUser ? onToggleFavoriteTeam(match.homeTeamId) : onOpenAuth()
                    }
                    className={`inline-flex items-center gap-1 text-[11px] mt-1.5 cursor-pointer transition-colors ${
                      isHomeFav ? 'text-[#a5b0ff] font-medium' : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${isHomeFav ? 'fill-[#a5b0ff]' : ''}`} />
                    <span>{isHomeFav ? 'Favorito' : 'Seguir'}</span>
                  </button>
                ) : undefined
              }
              awayAction={
                onToggleFavoriteTeam ? (
                  <button
                    type="button"
                    onClick={() =>
                      currentUser ? onToggleFavoriteTeam(match.awayTeamId) : onOpenAuth()
                    }
                    className={`inline-flex items-center justify-end gap-1 text-[11px] mt-1.5 cursor-pointer ml-auto transition-colors ${
                      isAwayFav ? 'text-[#a5b0ff] font-medium' : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${isAwayFav ? 'fill-[#a5b0ff]' : ''}`} />
                    <span>{isAwayFav ? 'Favorito' : 'Seguir'}</span>
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-5 border-t border-white/[0.08] pt-5">
              <div className="min-w-0 space-y-1">
                <p className="text-lg sm:text-2xl font-medium tracking-[-0.02em] text-white leading-tight break-words">
                  {homeTeam?.nombre ?? match.homeTeamId}
                </p>
                <p className="text-xs text-zinc-500 truncate">{homeTeam?.carrera}</p>
                {onToggleFavoriteTeam && (
                  <button
                    type="button"
                    onClick={() =>
                      currentUser ? onToggleFavoriteTeam(match.homeTeamId) : onOpenAuth()
                    }
                    className={`inline-flex items-center gap-1 text-[11px] mt-1 cursor-pointer transition-colors ${
                      isHomeFav ? 'text-[#a5b0ff] font-medium' : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${isHomeFav ? 'fill-[#a5b0ff]' : ''}`} />
                    <span>{isHomeFav ? 'Favorito' : 'Seguir'}</span>
                  </button>
                )}
              </div>

              <div className="px-4 py-3 rounded-2xl bg-[#111118] border border-white/[0.1] text-center shrink-0">
                {votingOpen ? (
                  <>
                    <span className="text-sm font-medium text-[#a5b0ff] block whitespace-nowrap">
                      En juego
                    </span>
                    <p className="text-[11px] text-zinc-400 mt-1 flex items-center justify-center gap-1 whitespace-nowrap">
                      <Lock className="w-3 h-3" />
                      <span>Marcador al cierre</span>
                    </p>
                  </>
                ) : (
                  <>
                    <span className="font-editorial text-2xl text-zinc-300">vs</span>
                    <p className="text-[11px] text-zinc-500 tabular-nums mt-0.5">{match.hora}</p>
                  </>
                )}
              </div>

              <div className="text-right min-w-0 space-y-1">
                <p className="text-lg sm:text-2xl font-medium tracking-[-0.02em] text-white leading-tight break-words">
                  {awayTeam?.nombre ?? match.awayTeamId}
                </p>
                <p className="text-xs text-zinc-500 truncate">{awayTeam?.carrera}</p>
                {onToggleFavoriteTeam && (
                  <button
                    type="button"
                    onClick={() =>
                      currentUser ? onToggleFavoriteTeam(match.awayTeamId) : onOpenAuth()
                    }
                    className={`inline-flex items-center justify-end gap-1 text-[11px] mt-1 cursor-pointer ml-auto transition-colors ${
                      isAwayFav ? 'text-[#a5b0ff] font-medium' : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${isAwayFav ? 'fill-[#a5b0ff]' : ''}`} />
                    <span>{isAwayFav ? 'Favorito' : 'Seguir'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500 border-t border-white/[0.08] pt-3">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#9aa5ff]" />
              <span>
                {match.cancha} · {match.fecha} · {match.hora}
              </span>
            </span>
            {canRefereeMatches(currentUser) && onOpenMatchInReferee && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMatchInReferee(match.id);
                }}
                className="text-zinc-200 hover:text-[#a5b0ff] font-medium transition-colors cursor-pointer"
              >
                Abrir Mesa Arbitral →
              </button>
            )}
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6">
          {/* CASE 1: EN_VIVO — MVP Voting */}
          {votingOpen && (
            <>
              <div className="rounded-2xl bg-[#101016] border border-[#707ef9]/25 p-4 flex items-start gap-3">
                <Clock className="w-4 h-4 text-[#9aa5ff] shrink-0 mt-0.5" />
                <p className="text-xs text-zinc-300 leading-relaxed">
                  El marcador oficial se publica al cerrar la planilla. Mientras dura el encuentro,
                  todos los usuarios pueden votar por el MVP.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#9aa5ff]" />
                    <h3 className="text-lg font-medium text-white">
                      Votación <span className="font-editorial text-[#c8ceff]">MVP</span>
                    </h3>
                  </div>
                  <span className="text-xs text-zinc-500 tabular-nums">
                    {mvpSummary.totalVotes} voto(s)
                  </span>
                </div>

                {!currentUser && (
                  <div className="rounded-2xl border border-white/[0.08] bg-[#101016] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-xs text-zinc-400">
                      Inicia sesión para registrar tu voto oficial.
                    </p>
                    <button
                      type="button"
                      onClick={onOpenAuth}
                      className="px-4 py-2 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                    >
                      Iniciar sesión
                    </button>
                  </div>
                )}

                {existingUserVote && (
                  <div
                    role="status"
                    className="rounded-2xl bg-emerald-500/10 border border-emerald-500/25 p-3.5 text-xs text-emerald-200 flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Tu voto está registrado para <strong className="text-white">{existingUserVote.playerName}</strong>.
                    </span>
                  </div>
                )}

                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={playerQuery}
                    onChange={(e) => setPlayerQuery(e.target.value)}
                    placeholder="Buscar jugador por nombre o dorsal..."
                    aria-label="Buscar jugador del partido"
                    className="w-full pl-10 pr-8 py-2.5 rounded-full text-xs sm:text-sm border border-white/[0.1] bg-[#111117] text-zinc-100 placeholder:text-zinc-500 focus:border-[#707ef9] focus:outline-none"
                  />
                  {playerQuery && (
                    <button
                      type="button"
                      onClick={() => setPlayerQuery('')}
                      aria-label="Limpiar búsqueda"
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { team: homeTeam, list: homePlayers, sideLabel: 'Local' },
                    { team: awayTeam, list: awayPlayers, sideLabel: 'Visita' },
                  ].map(({ team, list, sideLabel }) => (
                    <div
                      key={sideLabel}
                      className="rounded-2xl border border-white/[0.08] bg-[#0e0e14] overflow-hidden"
                    >
                      <div className="bg-white/[0.03] px-4 py-2.5 border-b border-white/[0.08] flex items-center justify-between">
                        <span className="text-sm font-medium text-white truncate">
                          {team?.nombre ?? sideLabel}
                        </span>
                        <span className="text-[11px] text-zinc-500">{sideLabel}</span>
                      </div>
                      <div className="divide-y divide-white/[0.06]">
                        {list.map((player) => {
                          const tally = mvpSummary.candidates.find((c) => c.playerId === player.id);
                          const isVotedByMe = existingUserVote?.playerId === player.id;
                          return (
                            <div
                              key={player.id}
                              className={`p-3.5 flex items-center justify-between gap-3 transition-colors ${
                                isVotedByMe ? 'bg-[#707ef9]/10' : 'hover:bg-white/[0.02]'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-white truncate">
                                  <span className="text-zinc-500 font-mono mr-1.5">
                                    {formatDorsalLabel(getEffectiveMatchDorsal(match, player))}
                                  </span>
                                  {player.nombre} {player.apellidoPaterno}
                                </p>
                                <p className="text-xs text-zinc-500 truncate">
                                  {player.posicion} · {player.carrera}
                                </p>
                                {tally && (
                                  <div className="mt-1.5 flex items-center gap-2">
                                    <div className="h-1 flex-1 rounded-full bg-white/[0.08] overflow-hidden">
                                      <div
                                        className="h-full bg-[#707ef9] rounded-full"
                                        style={{ width: `${tally.percentage}%` }}
                                      />
                                    </div>
                                    <span className="text-[11px] tabular-nums text-zinc-400">
                                      {tally.votes} ({tally.percentage}%)
                                    </span>
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  if (!currentUser) {
                                    onOpenAuth();
                                    return;
                                  }
                                  onVoteMvp(match, player);
                                }}
                                aria-label={`Votar MVP por ${player.nombre} ${player.apellidoPaterno}`}
                                className={`px-3.5 py-1.5 rounded-full text-xs font-medium shrink-0 cursor-pointer transition-colors ${
                                  isVotedByMe
                                    ? 'bg-white text-[#050507]'
                                    : 'bg-[#707ef9] hover:bg-[#5c6bf0] text-white'
                                }`}
                              >
                                {isVotedByMe ? 'Votado' : 'Votar'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* CASE 2: FINALIZED MATCH */}
          {revealData && (
            <div className="space-y-5">
              {match.events.length > 0 && (
                <div className="rounded-2xl border border-white/[0.08] bg-[#0e0e14] overflow-hidden">
                  <div className="px-4 py-3 bg-white/[0.03] border-b border-white/[0.08] flex items-center justify-between gap-2">
                    <h3 className="text-xs font-medium text-zinc-200">
                      Cronología oficial ({match.events.length})
                    </h3>
                    {match.events.some((e) => e.type === 'CAMBIO') && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#9aa5ff]">
                        <Repeat2 className="w-3.5 h-3.5" />
                        <span>Cambios registrados</span>
                      </span>
                    )}
                  </div>
                  <ul className="divide-y divide-white/[0.06] max-h-60 overflow-y-auto text-xs">
                    {match.events.slice(0, 25).map((ev) => (
                      <li
                        key={ev.id}
                        className="px-4 py-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
                              ev.type === 'CAMBIO'
                                ? 'bg-[#707ef9]/20 text-[#c8ceff]'
                                : ev.type === 'AMARILLA'
                                ? 'bg-amber-500/20 text-amber-300'
                                : ev.type === 'ROJA'
                                ? 'bg-red-500/20 text-red-300'
                                : ev.type === 'GOL' ||
                                  ev.type === 'PUNTO_1' ||
                                  ev.type === 'PUNTO_2' ||
                                  ev.type === 'PUNTO_3' ||
                                  ev.type === 'PUNTO_VOLEY' ||
                                  ev.type === 'ACE'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-white/[0.06] text-zinc-300'
                            }`}
                          >
                            {ev.type.replace('_', ' ')}
                          </span>
                          <span className="text-zinc-200 truncate">{ev.detail}</span>
                        </div>
                        <span className="text-[11px] text-zinc-500 tabular-nums shrink-0">
                          {ev.minuteOrPeriod}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Official Attendance Record */}
              {(() => {
                const attendance = getNormalizedMatchAttendance(match);
                if (attendance.status === 'NO_REGISTRADA') return null;

                if (attendance.status === 'OMITIDA') {
                  return (
                    <div className="rounded-2xl border border-white/[0.08] bg-[#101016] px-4 py-3 text-xs text-zinc-400 flex items-center gap-2">
                      <ClipboardCheck className="w-4 h-4 text-zinc-500 shrink-0" />
                      <span>
                        Asistencia omitida{attendance.notes ? ` (${attendance.notes})` : ''}.
                      </span>
                    </div>
                  );
                }

                const homePresentSet = new Set(attendance.homePresentIds);
                const awayPresentSet = new Set(attendance.awayPresentIds);
                const homePresentPlayers = players
                  .filter((p) => p.teamId === match.homeTeamId && homePresentSet.has(p.id))
                  .sort((a, b) => a.dorsal - b.dorsal);
                const awayPresentPlayers = players
                  .filter((p) => p.teamId === match.awayTeamId && awayPresentSet.has(p.id))
                  .sort((a, b) => a.dorsal - b.dorsal);

                if (homePresentPlayers.length === 0 && awayPresentPlayers.length === 0) {
                  return null;
                }

                return (
                  <div className="rounded-2xl border border-white/[0.08] bg-[#0e0e14] overflow-hidden">
                    <div className="px-4 py-3 bg-white/[0.03] border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
                        <ClipboardCheck className="w-4 h-4 text-[#9aa5ff]" />
                        <span>Asistencia oficial</span>
                      </h3>
                      <span className="text-[11px] text-zinc-500 tabular-nums">
                        {homePresentPlayers.length + awayPresentPlayers.length} presentes
                        {attendance.recordedByName ? ` · ${attendance.recordedByName}` : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.08]">
                      {[
                        { label: homeTeam?.nombre ?? 'Local', list: homePresentPlayers },
                        { label: awayTeam?.nombre ?? 'Visita', list: awayPresentPlayers },
                      ].map(({ label, list }) => (
                        <div key={label} className="p-4 space-y-2">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-medium text-white truncate">{label}</span>
                            <span className="text-[11px] text-zinc-500 tabular-nums shrink-0">
                              {list.length}
                            </span>
                          </div>
                          {list.length === 0 ? (
                            <p className="text-xs text-zinc-500">Sin registros.</p>
                          ) : (
                            <ul className="space-y-1 text-xs text-zinc-300">
                              {list.map((p) => (
                                <li key={p.id} className="flex items-center gap-2">
                                  <span className="font-mono text-[#9aa5ff] w-8 shrink-0">
                                    {formatDorsalLabel(getEffectiveMatchDorsal(match, p))}
                                  </span>
                                  <span className="truncate">
                                    {p.nombre} {p.apellidoPaterno}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* MVP Winner Banner */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#101016] p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[#9aa5ff]">
                    <Trophy className="w-4 h-4" />
                    <span className="text-xs font-medium">MVP de la comunidad</span>
                  </div>
                  <span className="text-xs text-zinc-500 tabular-nums">
                    {mvpSummary.totalVotes} voto(s)
                  </span>
                </div>

                {mvpSummary.winner ? (
                  <div>
                    <p className="text-xl sm:text-2xl font-medium tracking-[-0.02em] text-white">
                      {mvpSummary.winner.playerName}
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {teamMap.get(mvpSummary.winner.teamId)?.nombre} ·{' '}
                      {mvpSummary.winner.percentage}% ({mvpSummary.winner.votes})
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">
                    Sin votos registrados en este partido.
                  </p>
                )}
              </div>

              {/* Validation Status */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0e0e14] p-4 flex items-center justify-between gap-3">
                <span className="text-xs text-zinc-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#9aa5ff] shrink-0" />
                  {match.scoresheetValidation ? (
                    <span>
                      Validado por{' '}
                      <strong className="text-zinc-200 font-medium">
                        {match.scoresheetValidation.refereeName}
                      </strong>
                    </span>
                  ) : (
                    <span>Resultado consolidado en tabla oficial.</span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* CASE 3: SCHEDULED UPCOMING MATCH */}
          {match.status === 'PROGRAMADO' && (
            <div className="rounded-2xl bg-[#101016] border border-white/[0.08] p-6 text-center space-y-2">
              <p className="text-base sm:text-lg font-medium text-white">
                Programado para el {match.fecha} · {match.hora}
              </p>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                La votación MVP se abre durante el partido y el marcador oficial se publica al finalizar.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
