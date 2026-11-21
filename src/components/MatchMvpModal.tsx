import { useMemo } from 'react';
import { Award, CheckCircle2, Clock, Lock, MapPin, ShieldCheck, Star, Trophy, X } from 'lucide-react';
import { DISCIPLINE_MAP } from '../data/ufroSeed';
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
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  if (!match) return null;

  const disc = DISCIPLINE_MAP[match.disciplineId];
  const homeTeam = teamMap.get(match.homeTeamId);
  const awayTeam = teamMap.get(match.awayTeamId);
  const revealData = shouldRevealPublicMatchData(match);
  const votingOpen = canVoteMatchMvp(match);

  const homePlayers = players.filter((p) => p.teamId === match.homeTeamId);
  const awayPlayers = players.filter((p) => p.teamId === match.awayTeamId);

  const mvpSummary = computeMatchMvpStandings(match.id, mvpVotes);
  const existingUserVote = currentUser
    ? mvpVotes.find((v) => v.matchId === match.id && v.voterUid === currentUser.uid)
    : undefined;

  const isHomeFav = Boolean(currentUser?.favoriteTeamIds.includes(match.homeTeamId));
  const isAwayFav = Boolean(currentUser?.favoriteTeamIds.includes(match.awayTeamId));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-mvp-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto"
    >
      <div className="bg-white w-full max-w-3xl border border-neutral-200 shadow-2xl my-8 overflow-hidden">
        {/* Carbon Editorial Header */}
        <div className="bg-[#0d0d0d] text-white p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
                {disc.nombre} · {match.groupName} · Jornada {match.jornada}
              </p>
              <h2
                id="match-mvp-modal-title"
                className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-tight mt-1"
              >
                {votingOpen
                  ? 'Encuentro en Horario Programado · Votación MVP'
                  : revealData
                  ? 'Ficha Oficial Post-Partido y MVP'
                  : 'Encuentro Programado'}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar detalle del encuentro"
              className="p-2 text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Teams & Scoreboard (Respecting Public Visibility Rule) */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-5 border-t border-white/10 pt-5">
            <div className="min-w-0 space-y-1">
              <p className="font-display text-lg sm:text-2xl font-bold uppercase leading-tight break-words">
                {homeTeam?.nombre ?? match.homeTeamId}
              </p>
              <p className="text-xs text-neutral-400 truncate">{homeTeam?.carrera}</p>
              {onToggleFavoriteTeam && (
                <button
                  type="button"
                  onClick={() =>
                    currentUser ? onToggleFavoriteTeam(match.homeTeamId) : onOpenAuth()
                  }
                  className={`inline-flex items-center gap-1 text-[11px] mt-1 cursor-pointer ${
                    isHomeFav ? 'text-[#707ef9] font-bold' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${isHomeFav ? 'fill-[#707ef9]' : ''}`} />
                  <span>{isHomeFav ? 'Equipo favorito' : 'Seguir equipo'}</span>
                </button>
              )}
            </div>

            <div className="px-4 py-3 bg-[#18181f] border border-white/15 text-center shrink-0">
              {revealData ? (
                <>
                  <span className="font-display text-3xl sm:text-4xl font-bold tabular-nums whitespace-nowrap">
                    {match.homeScore} — {match.awayScore}
                  </span>
                  <p className="text-[11px] text-emerald-400 uppercase tracking-wider mt-1">
                    Resultado Oficial
                  </p>
                </>
              ) : votingOpen ? (
                <>
                  <span className="font-display text-lg sm:text-xl font-bold uppercase tracking-wider text-[#707ef9] block whitespace-nowrap">
                    En Juego
                  </span>
                  <p className="text-[11px] text-neutral-300 mt-1 flex items-center justify-center gap-1 whitespace-nowrap">
                    <Lock className="w-3 h-3" />
                    <span>Datos al finalizar</span>
                  </p>
                </>
              ) : (
                <>
                  <span className="font-display text-2xl font-bold uppercase text-neutral-300">
                    vs
                  </span>
                  <p className="text-[11px] text-neutral-400 tabular-nums mt-0.5">{match.hora}</p>
                </>
              )}
            </div>

            <div className="text-right min-w-0 space-y-1">
              <p className="font-display text-lg sm:text-2xl font-bold uppercase leading-tight break-words">
                {awayTeam?.nombre ?? match.awayTeamId}
              </p>
              <p className="text-xs text-neutral-400 truncate">{awayTeam?.carrera}</p>
              {onToggleFavoriteTeam && (
                <button
                  type="button"
                  onClick={() =>
                    currentUser ? onToggleFavoriteTeam(match.awayTeamId) : onOpenAuth()
                  }
                  className={`inline-flex items-center justify-end gap-1 text-[11px] mt-1 cursor-pointer ml-auto ${
                    isAwayFav ? 'text-[#707ef9] font-bold' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${isAwayFav ? 'fill-[#707ef9]' : ''}`} />
                  <span>{isAwayFav ? 'Equipo favorito' : 'Seguir equipo'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-400 border-t border-white/10 pt-3">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#707ef9]" />
              <span>
                {match.cancha} · {match.fecha} ({match.hora})
              </span>
            </span>
            {canRefereeMatches(currentUser) && onOpenMatchInReferee && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMatchInReferee(match.id);
                }}
                className="text-white hover:text-[#707ef9] font-medium cursor-pointer"
              >
                Abrir Mesa Arbitral →
              </button>
            )}
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6">
          {/* CASE 1: SCHEDULED MATCH HOUR (EN_VIVO) — Scores Hidden, MVP Voting Open for ALL roles */}
          {votingOpen && (
            <>
              <div className="bg-[#f5f6f8] border-l-4 border-[#707ef9] p-4 flex items-start gap-3">
                <Clock className="w-5 h-5 text-[#707ef9] shrink-0 mt-0.5" />
                <div className="text-sm text-neutral-700">
                  <p className="font-bold text-[#0d0d0d]">
                    Política de datos del Campeonato Intercarreras UFRO
                  </p>
                  <p className="text-xs text-neutral-600 mt-1">
                    Por la naturaleza del campeonato, el marcador oficial y las estadísticas del
                    encuentro se revelan públicamente únicamente al finalizar y cerrarse la planilla.
                    Durante la hora programada, <strong>todos los usuarios sin importar su rol</strong>{' '}
                    pueden votar por el MVP del partido.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-[#707ef9]" />
                    <h3 className="font-display text-xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                      Votación Oficial MVP del Partido
                    </h3>
                  </div>
                  <span className="text-xs text-neutral-500 tabular-nums">
                    {mvpSummary.totalVotes} voto(s) emitido(s)
                  </span>
                </div>

                {!currentUser && (
                  <div className="border border-neutral-300 bg-neutral-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-xs text-neutral-700">
                      Inicia sesión con tu cuenta (cualquier rol habilitado) para registrar tu voto
                      oficial por el MVP de este partido.
                    </p>
                    <button
                      type="button"
                      onClick={onOpenAuth}
                      className="px-4 py-2 bg-[#707ef9] hover:bg-[#5766eb] text-white text-xs font-display font-bold uppercase tracking-widest whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Iniciar sesión para votar
                    </button>
                  </div>
                )}

                {existingUserVote && (
                  <div
                    role="status"
                    className="bg-emerald-50 border border-emerald-300 p-3.5 text-xs text-emerald-950 flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      Tu voto MVP actual está registrado para{' '}
                      <strong>{existingUserVote.playerName}</strong>. Puedes cambiarlo mientras dure
                      el horario del encuentro.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {[
                    { team: homeTeam, list: homePlayers, sideLabel: 'Local' },
                    { team: awayTeam, list: awayPlayers, sideLabel: 'Visita' },
                  ].map(({ team, list, sideLabel }) => (
                    <div key={sideLabel} className="border border-neutral-200">
                      <div className="bg-[#f5f6f8] px-4 py-2.5 border-b border-neutral-200 flex items-center justify-between">
                        <span className="font-display text-sm font-bold uppercase tracking-wide text-[#0d0d0d] truncate">
                          {team?.nombre ?? sideLabel}
                        </span>
                        <span className="text-[11px] text-neutral-500 uppercase">{sideLabel}</span>
                      </div>
                      <div className="divide-y divide-neutral-100">
                        {list.map((player) => {
                          const tally = mvpSummary.candidates.find((c) => c.playerId === player.id);
                          const isVotedByMe = existingUserVote?.playerId === player.id;
                          return (
                            <div
                              key={player.id}
                              className={`p-3.5 flex items-center justify-between gap-3 ${
                                isVotedByMe ? 'bg-[#707ef9]/[0.06]' : 'bg-white'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-[#0d0d0d] truncate">
                                  #{player.dorsal} {player.nombre} {player.apellidoPaterno}
                                </p>
                                <p className="text-xs text-neutral-500 truncate">
                                  {player.posicion} · {player.carrera}
                                </p>
                                {tally && (
                                  <div className="mt-1.5 flex items-center gap-2">
                                    <div className="h-1.5 flex-1 bg-neutral-200 overflow-hidden">
                                      <div
                                        className="h-full bg-[#707ef9]"
                                        style={{ width: `${tally.percentage}%` }}
                                      />
                                    </div>
                                    <span className="text-[11px] tabular-nums font-medium text-neutral-600">
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
                                className={`px-3 py-1.5 text-xs font-display font-bold uppercase tracking-wider shrink-0 cursor-pointer transition-colors ${
                                  isVotedByMe
                                    ? 'bg-[#0d0d0d] text-white'
                                    : 'bg-[#707ef9] hover:bg-[#5766eb] text-white'
                                }`}
                              >
                                {isVotedByMe ? 'Votado' : 'Votar MVP'}
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

          {/* CASE 2: FINALIZED MATCH — Reveal Complete Official Results, Stats & MVP Winner */}
          {revealData && (
            <div className="space-y-6">
              {match.periods.length > 0 && (
                <div>
                  <h3 className="font-display text-sm font-bold uppercase tracking-widest text-neutral-500 mb-3">
                    Parciales Oficiales del Encuentro
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {match.periods.map((p, idx) => (
                      <div
                        key={idx}
                        className="border border-neutral-200 bg-[#f5f6f8] p-3 text-center"
                      >
                        <p className="text-[11px] text-neutral-500 uppercase">
                          {disc.sportType === 'voleibol'
                            ? `Set ${idx + 1}`
                            : disc.sportType === 'futbol7'
                            ? `${idx + 1}° Tiempo`
                            : `${idx + 1}° Cuarto`}
                        </p>
                        <p className="font-display text-xl font-bold tabular-nums text-[#0d0d0d] mt-0.5">
                          {p.home} — {p.away}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MVP Winner Banner */}
              <div className="border border-neutral-200 p-5 bg-[#f5f6f8] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[#707ef9]">
                    <Trophy className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">
                      MVP Elegido por la Comunidad UFRO
                    </span>
                  </div>
                  <span className="text-xs text-neutral-500 tabular-nums">
                    {mvpSummary.totalVotes} voto(s) totales
                  </span>
                </div>

                {mvpSummary.winner ? (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-display text-2xl font-bold uppercase text-[#0d0d0d]">
                        {mvpSummary.winner.playerName}
                      </p>
                      <p className="text-xs text-neutral-600">
                        {teamMap.get(mvpSummary.winner.teamId)?.nombre} ·{' '}
                        {mvpSummary.winner.percentage}% de los votos ({mvpSummary.winner.votes})
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-neutral-600">
                    No se registraron votos de MVP durante la ventana de este encuentro.
                  </p>
                )}
              </div>

              {/* Official Events & Validation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-neutral-200 p-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Resumen Disciplinario y Tiempos
                  </p>
                  <p className="text-sm text-[#0d0d0d] tabular-nums">
                    Faltas: <strong>{match.fouls.home}</strong> ({homeTeam?.sigla}) —{' '}
                    <strong>{match.fouls.away}</strong> ({awayTeam?.sigla})
                  </p>
                  {disc.sportType !== 'futbol7' && (
                    <p className="text-sm text-[#0d0d0d] tabular-nums">
                      Tiempos muertos: <strong>{match.timeouts.home}</strong> —{' '}
                      <strong>{match.timeouts.away}</strong>
                    </p>
                  )}
                </div>

                <div className="border border-neutral-200 p-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#707ef9]" />
                    <span>Validación de Planilla</span>
                  </p>
                  {match.scoresheetValidation ? (
                    <p className="text-xs text-neutral-700">
                      Cerrado por <strong>{match.scoresheetValidation.refereeName}</strong> (
                      {match.scoresheetValidation.method === 'IA_AUTOMATICA'
                        ? 'Validación IA'
                        : 'Validación Manual'}
                      ).
                    </p>
                  ) : (
                    <p className="text-xs text-neutral-600">
                      Resultado oficial consolidado en tabla de posiciones UFRO.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CASE 3: SCHEDULED UPCOMING MATCH */}
          {match.status === 'PROGRAMADO' && (
            <div className="bg-[#f5f6f8] border border-neutral-200 p-6 text-center space-y-2">
              <p className="font-display text-lg font-bold uppercase text-[#0d0d0d]">
                Encuentro programado para el {match.fecha} a las {match.hora}
              </p>
              <p className="text-xs text-neutral-600 max-w-lg mx-auto">
                La votación de MVP se habilitará automáticamente durante el horario del partido y
                el marcador oficial se publicará al finalizar el encuentro.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
