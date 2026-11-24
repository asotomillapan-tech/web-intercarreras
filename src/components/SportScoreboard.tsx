import type { ReactNode } from 'react';
import { ArrowLeftRight, CircleDot, Repeat2 } from 'lucide-react';
import {
  SPORT_LIVE_RULES,
  formatMatchClock,
  getBasketballBonusStatus,
  getNormalizedLiveState,
  getVolleyballSetPointStatus,
} from '../domain/liveMatchEngine';
import type { Match, SportType, Team } from '../types/tournament';
import { TeamCrest } from './TeamCrest';

export interface SportScoreboardProps {
  match: Match;
  sportType: SportType;
  disciplineName: string;
  homeTeam?: Team;
  awayTeam?: Team;
  mode: 'live' | 'final';
  clockSeconds?: number;
  clockRunning?: boolean;
  onToggleServeSide?: (side: 'home' | 'away') => void;
  embedded?: boolean;
  homeAction?: ReactNode;
  awayAction?: ReactNode;
}

function getPeriodColumnLabel(sportType: SportType, index: number): string {
  if (sportType === 'voleibol') return `Set ${index + 1}`;
  if (sportType === 'futbol7') {
    if (index === 0) return '1T';
    if (index === 1) return '2T';
    return 'PR';
  }
  if (sportType === 'basquetbol3x3') {
    return index === 0 ? 'REG' : 'OT';
  }
  if (index < 4) return `Q${index + 1}`;
  return index === 4 ? 'OT' : `OT${index - 3}`;
}

export function SportScoreboard({
  match,
  sportType,
  disciplineName,
  homeTeam,
  awayTeam,
  mode,
  clockSeconds,
  clockRunning = false,
  onToggleServeSide,
  embedded = false,
  homeAction,
  awayAction,
}: SportScoreboardProps) {
  const liveState = getNormalizedLiveState(match, sportType);
  const rules = SPORT_LIVE_RULES[sportType];
  const displayClockSeconds = clockSeconds ?? liveState.clockSeconds;
  const formattedClock =
    sportType === 'voleibol'
      ? match.periodLabel
      : formatMatchClock(displayClockSeconds, sportType, liveState.stoppageMinutes);

  const homeName = homeTeam?.nombre ?? match.homeTeamId;
  const awayName = awayTeam?.nombre ?? match.awayTeamId;
  const homeSigla = homeTeam?.sigla ?? homeName.slice(0, 3).toUpperCase();
  const awaySigla = awayTeam?.sigla ?? awayName.slice(0, 3).toUpperCase();

  // Discipline tallies derived directly from match events
  const homeYellows = match.events.filter(
    (e) => e.teamId === match.homeTeamId && e.type === 'AMARILLA'
  ).length;
  const awayYellows = match.events.filter(
    (e) => e.teamId === match.awayTeamId && e.type === 'AMARILLA'
  ).length;
  const homeReds = match.events.filter(
    (e) => e.teamId === match.homeTeamId && e.type === 'ROJA'
  ).length;
  const awayReds = match.events.filter(
    (e) => e.teamId === match.awayTeamId && e.type === 'ROJA'
  ).length;

  const homeBonus = getBasketballBonusStatus(sportType, liveState.periodFouls.home);
  const awayBonus = getBasketballBonusStatus(sportType, liveState.periodFouls.away);
  const volleyPointAlert =
    sportType === 'voleibol' && mode === 'live' ? getVolleyballSetPointStatus(match) : null;

  const currentVolleySet =
    sportType === 'voleibol' && match.periods.length > 0
      ? match.periods[match.periods.length - 1]
      : { home: 0, away: 0 };

  const basketPeriodSlots =
    sportType === 'basquetbol' ? Math.max(4, match.periods.length) : match.periods.length;
  const volleySetSlots =
    sportType === 'voleibol' ? Math.max(3, match.periods.length) : match.periods.length;

  const sportSubtitle =
    sportType === 'futbol7'
      ? 'Fútbol 7 · 2×25 min'
      : sportType === 'basquetbol'
      ? 'Básquetbol 5x5 · 4×10 min FIBA'
      : sportType === 'basquetbol3x3'
      ? 'Básquetbol 3x3 · Meta 21 pts · 10 min'
      : 'Voleibol · Al mejor de 3 sets (25 / 25 / 15)';

  return (
    <div className={embedded ? 'text-white' : 'bg-[#0d0d0d] text-white border border-white/10'}>
      {/* Top Broadcast Meta Strip */}
      <div
        className={`${
          embedded ? 'py-2.5 border-t border-b border-white/10' : 'px-5 py-3 border-b border-white/10'
        } flex flex-wrap items-center justify-between gap-2 text-xs`}
      >
        <div className="flex flex-wrap items-center gap-2 text-neutral-300 min-w-0">
          {!embedded && <span className="font-semibold text-white truncate">{disciplineName}</span>}
          {!embedded && (
            <span className="text-neutral-600" aria-hidden="true">
              ·
            </span>
          )}
          <span className="text-neutral-400">{sportSubtitle}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0 tabular-nums">
          {mode === 'live' ? (
            <>
              <span className="text-[11px] uppercase tracking-widest font-bold text-[#707ef9]">
                {match.status === 'EN_VIVO' ? match.periodLabel : match.status === 'FINALIZADO' ? 'Finalizado' : 'Por iniciar'}
              </span>
              {sportType !== 'voleibol' && (
                <span
                  data-testid="live-match-clock"
                  className={`px-2 py-0.5 font-mono text-sm font-bold border ${
                    clockRunning
                      ? 'bg-[#707ef9]/20 border-[#707ef9] text-white'
                      : 'bg-[#18181f] border-white/15 text-neutral-200'
                  }`}
                >
                  {formattedClock}
                </span>
              )}
            </>
          ) : (
            <span className="text-[11px] uppercase tracking-widest font-bold text-emerald-400">
              Resultado Oficial
            </span>
          )}
        </div>
      </div>

      {/* Volleyball Set Point / Match Point Callout */}
      {volleyPointAlert && (
        <div
          role="status"
          className="px-5 py-2 bg-[#707ef9] text-white text-xs font-display font-bold uppercase tracking-widest flex items-center justify-between"
        >
          <span>
            {volleyPointAlert.kind === 'MATCH_POINT' ? 'Match Point' : 'Set Point'} · Set{' '}
            {volleyPointAlert.setNumber}
          </span>
          <span>
            {volleyPointAlert.side === 'home' ? homeName : awayName} a 1 punto de cerrar
          </span>
        </div>
      )}

      {/* Main Team & Primary Score Row */}
      <div
        className={`${
          embedded ? 'py-5' : 'px-5 py-5'
        } grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-5`}
      >
        {/* Home Side */}
        <div className="flex items-center gap-3 min-w-0">
          <TeamCrest
            escudo={homeTeam?.escudo}
            sigla={homeSigla}
            nombre={homeName}
            size="md"
            surface="dark"
            className="hidden sm:flex"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-display text-lg sm:text-2xl font-bold uppercase leading-tight break-words">
                {homeName}
              </p>
              {mode === 'live' && sportType === 'voleibol' && liveState.servingSide === 'home' && (
                <span
                  title="Saque activo Local"
                  className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#707ef9] shrink-0"
                >
                  <CircleDot className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Saque</span>
                </span>
              )}
              {mode === 'live' && sportType === 'basquetbol' && liveState.servingSide === 'home' && (
                <span
                  title="Posesión alterna Local"
                  className="text-[10px] font-bold uppercase tracking-wider text-[#707ef9] shrink-0"
                >
                  ◄ POS
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-400 truncate mt-0.5">
              {homeTeam?.carrera ?? 'Local'}
            </p>
            {homeAction}
          </div>
        </div>

        {/* Center Score Display */}
        <div className="px-4 sm:px-6 py-3 bg-[#16161d] border border-white/15 text-center shrink-0">
          {sportType === 'voleibol' && mode === 'live' ? (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-neutral-400">
                Sets ({match.periodLabel})
              </p>
              <span
                data-testid="live-scoreboard"
                className="font-display text-3xl sm:text-4xl font-bold tabular-nums whitespace-nowrap block"
              >
                {match.homeScore} — {match.awayScore}
              </span>
              <div className="pt-1 border-t border-white/10">
                <span className="font-mono text-base sm:text-lg font-bold text-[#707ef9] tabular-nums">
                  {currentVolleySet.home} - {currentVolleySet.away}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-neutral-400 block">
                  Puntos Set {Math.max(1, match.periods.length)}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <span
                data-testid={mode === 'live' ? 'live-scoreboard' : 'final-scoreboard'}
                className="font-display text-3xl sm:text-5xl font-bold tabular-nums whitespace-nowrap block leading-none"
              >
                {match.homeScore} — {match.awayScore}
              </span>
              {sportType === 'voleibol' && mode === 'final' && (
                <p className="text-[10px] uppercase tracking-widest text-neutral-400 mt-1.5">
                  Sets ganados
                </p>
              )}
              {sportType === 'basquetbol3x3' && (
                <p className="text-[10px] uppercase tracking-widest text-neutral-400 mt-1.5 tabular-nums">
                  Meta 21 pts
                </p>
              )}
            </div>
          )}
        </div>

        {/* Away Side */}
        <div className="flex items-center justify-end gap-3 min-w-0 text-right">
          <div className="min-w-0">
            <div className="flex items-center justify-end gap-2">
              {mode === 'live' && sportType === 'voleibol' && liveState.servingSide === 'away' && (
                <span
                  title="Saque activo Visita"
                  className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#707ef9] shrink-0"
                >
                  <span className="hidden md:inline">Saque</span>
                  <CircleDot className="w-3.5 h-3.5" />
                </span>
              )}
              {mode === 'live' && sportType === 'basquetbol' && liveState.servingSide === 'away' && (
                <span
                  title="Posesión alterna Visita"
                  className="text-[10px] font-bold uppercase tracking-wider text-[#707ef9] shrink-0"
                >
                  POS ►
                </span>
              )}
              <p className="font-display text-lg sm:text-2xl font-bold uppercase leading-tight break-words">
                {awayName}
              </p>
            </div>
            <p className="text-[11px] text-neutral-400 truncate mt-0.5">
              {awayTeam?.carrera ?? 'Visita'}
            </p>
            {awayAction}
          </div>
          <TeamCrest
            escudo={awayTeam?.escudo}
            sigla={awaySigla}
            nombre={awayName}
            size="md"
            surface="dark"
            className="hidden sm:flex"
          />
        </div>
      </div>

      {/* SPORT-SPECIFIC TELEMETRY & BREAKDOWN AREA */}
      <div className={embedded ? 'pb-1 space-y-4' : 'px-5 pb-5 space-y-4'}>
        {/* 1. FÚTBOL 7 */}
        {sportType === 'futbol7' && (
          <div className="border-t border-white/10 pt-4 space-y-3">
            {match.periods.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-4 text-xs tabular-nums">
                {match.periods.map((p, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-1 bg-[#16161d] border border-white/10 flex items-center gap-2"
                  >
                    <span className="text-[10px] uppercase tracking-wider text-neutral-400">
                      {getPeriodColumnLabel('futbol7', idx)}
                    </span>
                    <span className="font-mono font-bold text-white">
                      {p.home} - {p.away}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                {
                  label: homeSigla,
                  fouls: match.fouls.home,
                  yellows: homeYellows,
                  reds: homeReds,
                  subs: liveState.substitutionsCount.home,
                  align: 'left' as const,
                },
                {
                  label: awaySigla,
                  fouls: match.fouls.away,
                  yellows: awayYellows,
                  reds: awayReds,
                  subs: liveState.substitutionsCount.away,
                  align: 'right' as const,
                },
              ].map((teamStat) => (
                <div
                  key={teamStat.label}
                  className={`bg-[#16161d] border border-white/10 px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 tabular-nums ${
                    teamStat.align === 'right' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <span className="inline-flex items-center gap-1 text-neutral-300" title="Tarjetas amarillas">
                    <span className="w-2.5 h-3.5 bg-amber-400 inline-block" aria-hidden="true" />
                    <strong className="text-white">{teamStat.yellows}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1 text-neutral-300" title="Tarjetas rojas">
                    <span className="w-2.5 h-3.5 bg-red-600 inline-block" aria-hidden="true" />
                    <strong className="text-white">{teamStat.reds}</strong>
                  </span>
                  <span className="text-neutral-400">
                    Faltas: <strong className="text-white">{teamStat.fouls}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1 text-neutral-400">
                    <Repeat2 className="w-3 h-3 text-[#707ef9]" />
                    <span>
                      Cambios: <strong className="text-white">{teamStat.subs}</strong>
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. BÁSQUETBOL 5x5 (FIBA Quarter Table + Fouls Bonus + Timeouts) */}
        {sportType === 'basquetbol' && (
          <div className="border-t border-white/10 pt-4 space-y-3">
            {/* Quarter-by-Quarter Table */}
            <div className="overflow-x-auto bg-[#16161d] border border-white/10">
              <table className="w-full text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-neutral-400">
                    <th className="text-left px-3 py-2 font-medium">Equipo</th>
                    {Array.from({ length: basketPeriodSlots }).map((_, idx) => {
                      const isCurrent = mode === 'live' && idx === Math.max(0, match.periods.length - 1);
                      return (
                        <th
                          key={idx}
                          className={`text-center px-2 py-2 font-semibold ${
                            isCurrent ? 'text-[#707ef9]' : ''
                          }`}
                        >
                          {getPeriodColumnLabel('basquetbol', idx)}
                        </th>
                      );
                    })}
                    <th className="text-center px-3 py-2 font-bold text-white border-l border-white/10">
                      TOT
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  <tr>
                    <td className="px-3 py-2 font-display font-bold uppercase tracking-wide text-white truncate max-w-[140px]">
                      {homeSigla}
                    </td>
                    {Array.from({ length: basketPeriodSlots }).map((_, idx) => (
                      <td key={idx} className="text-center px-2 py-2 text-neutral-200 font-mono">
                        {match.periods[idx] ? match.periods[idx].home : '—'}
                      </td>
                    ))}
                    <td className="text-center px-3 py-2 font-mono font-bold text-white border-l border-white/10">
                      {match.homeScore}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-display font-bold uppercase tracking-wide text-white truncate max-w-[140px]">
                      {awaySigla}
                    </td>
                    {Array.from({ length: basketPeriodSlots }).map((_, idx) => (
                      <td key={idx} className="text-center px-2 py-2 text-neutral-200 font-mono">
                        {match.periods[idx] ? match.periods[idx].away : '—'}
                      </td>
                    ))}
                    <td className="text-center px-3 py-2 font-mono font-bold text-white border-l border-white/10">
                      {match.awayScore}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Fouls per quarter (Bonus at 5) + Timeouts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {[
                {
                  side: 'home' as const,
                  sigla: homeSigla,
                  periodFouls: liveState.periodFouls.home,
                  totalFouls: match.fouls.home,
                  bonus: homeBonus,
                  timeoutsUsed: match.timeouts.home,
                  subs: liveState.substitutionsCount.home,
                },
                {
                  side: 'away' as const,
                  sigla: awaySigla,
                  periodFouls: liveState.periodFouls.away,
                  totalFouls: match.fouls.away,
                  bonus: awayBonus,
                  timeoutsUsed: match.timeouts.away,
                  subs: liveState.substitutionsCount.away,
                },
              ].map((info) => {
                const maxTo = rules.maxTimeoutsPerPeriod;
                const remainingTo = Math.max(0, maxTo - info.timeoutsUsed);
                return (
                  <div
                    key={info.side}
                    className="bg-[#16161d] border border-white/10 px-3 py-2.5 space-y-2 tabular-nums"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] uppercase tracking-wider text-neutral-400">
                        {info.sigla} · Faltas {mode === 'live' ? 'Cuarto' : 'Totales'}
                      </span>
                      {mode === 'live' && info.bonus === 'BONUS' ? (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                          BONUS (TL)
                        </span>
                      ) : (
                        <span className="text-[11px] text-neutral-400">
                          Total: <strong className="text-white">{info.totalFouls}</strong>
                        </span>
                      )}
                    </div>

                    {mode === 'live' && (
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span
                            key={i}
                            className={`h-2 flex-1 ${
                              i < info.periodFouls
                                ? info.periodFouls >= 5
                                  ? 'bg-red-500'
                                  : 'bg-amber-400'
                                : 'bg-white/10'
                            }`}
                          />
                        ))}
                        <span className="font-mono text-white font-bold ml-1">
                          {info.periodFouls}/5
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1 border-t border-white/10">
                      <span className="flex items-center gap-1.5">
                        <span>T. Muertos:</span>
                        <span className="inline-flex items-center gap-1">
                          {Array.from({ length: maxTo }).map((_, idx) => (
                            <span
                              key={idx}
                              className={`w-2 h-2 inline-block ${
                                idx < remainingTo ? 'bg-[#707ef9]' : 'bg-white/15'
                              }`}
                            />
                          ))}
                        </span>
                        <strong className="text-white">{info.timeoutsUsed}</strong>
                      </span>
                      <span>
                        Cambios: <strong className="text-white">{info.subs}</strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. BÁSQUETBOL 3x3 (Race to 21 + Bonus 7 / Double Bonus 10) */}
        {sportType === 'basquetbol3x3' && (
          <div className="border-t border-white/10 pt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs tabular-nums">
              {[
                {
                  side: 'home' as const,
                  sigla: homeSigla,
                  score: match.homeScore,
                  fouls: match.fouls.home,
                  bonus: getBasketballBonusStatus('basquetbol3x3', match.fouls.home),
                  timeoutsUsed: match.timeouts.home,
                  subs: liveState.substitutionsCount.home,
                },
                {
                  side: 'away' as const,
                  sigla: awaySigla,
                  score: match.awayScore,
                  fouls: match.fouls.away,
                  bonus: getBasketballBonusStatus('basquetbol3x3', match.fouls.away),
                  timeoutsUsed: match.timeouts.away,
                  subs: liveState.substitutionsCount.away,
                },
              ].map((info) => {
                const pct = Math.min(100, Math.round((info.score / 21) * 100));
                const reached = info.score >= 21;
                return (
                  <div
                    key={info.side}
                    className="bg-[#16161d] border border-white/10 px-3 py-2.5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wider text-neutral-300 font-semibold">
                        {info.sigla} · Carrera a 21
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          reached ? 'text-emerald-400' : 'text-white'
                        }`}
                      >
                        {info.score} / 21
                      </span>
                    </div>
                    <div className="h-2 bg-white/10 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          reached ? 'bg-emerald-400' : 'bg-[#707ef9]'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-400 pt-1">
                      <span>
                        Faltas: <strong className="text-white">{info.fouls}</strong>
                        {info.bonus === 'DOUBLE_BONUS' && (
                          <span className="ml-1.5 text-red-400 font-bold uppercase">
                            DOBLE BONUS (10+)
                          </span>
                        )}
                        {info.bonus === 'BONUS' && (
                          <span className="ml-1.5 text-amber-400 font-bold uppercase">
                            BONUS (7+)
                          </span>
                        )}
                      </span>
                      <span>
                        TM: <strong className="text-white">{info.timeoutsUsed}/1</strong> · Cambios:{' '}
                        <strong className="text-white">{info.subs}</strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. VOLEIBOL (Set-by-Set Table + Serve Toggle + Set Timeouts & Subs) */}
        {sportType === 'voleibol' && (
          <div className="border-t border-white/10 pt-4 space-y-3">
            <div className="overflow-x-auto bg-[#16161d] border border-white/10">
              <table className="w-full text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-neutral-400">
                    <th className="text-left px-3 py-2 font-medium">Equipo</th>
                    {Array.from({ length: volleySetSlots }).map((_, idx) => {
                      const isCurrent = mode === 'live' && idx === Math.max(0, match.periods.length - 1);
                      return (
                        <th
                          key={idx}
                          className={`text-center px-2 py-2 font-semibold ${
                            isCurrent ? 'text-[#707ef9]' : ''
                          }`}
                        >
                          {idx === 2 ? 'Set 3 (15)' : `Set ${idx + 1}`}
                        </th>
                      );
                    })}
                    <th className="text-center px-3 py-2 font-bold text-white border-l border-white/10">
                      SETS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  <tr>
                    <td className="px-3 py-2 font-display font-bold uppercase tracking-wide text-white">
                      <span className="inline-flex items-center gap-1.5">
                        {mode === 'live' && liveState.servingSide === 'home' && (
                          <CircleDot className="w-3 h-3 text-[#707ef9]" />
                        )}
                        {homeSigla}
                      </span>
                    </td>
                    {Array.from({ length: volleySetSlots }).map((_, idx) => (
                      <td key={idx} className="text-center px-2 py-2 text-neutral-200 font-mono">
                        {match.periods[idx] ? match.periods[idx].home : '—'}
                      </td>
                    ))}
                    <td className="text-center px-3 py-2 font-mono font-bold text-white border-l border-white/10">
                      {match.homeScore}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-display font-bold uppercase tracking-wide text-white">
                      <span className="inline-flex items-center gap-1.5">
                        {mode === 'live' && liveState.servingSide === 'away' && (
                          <CircleDot className="w-3 h-3 text-[#707ef9]" />
                        )}
                        {awaySigla}
                      </span>
                    </td>
                    {Array.from({ length: volleySetSlots }).map((_, idx) => (
                      <td key={idx} className="text-center px-2 py-2 text-neutral-200 font-mono">
                        {match.periods[idx] ? match.periods[idx].away : '—'}
                      </td>
                    ))}
                    <td className="text-center px-3 py-2 font-mono font-bold text-white border-l border-white/10">
                      {match.awayScore}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs tabular-nums">
              {[
                {
                  side: 'home' as const,
                  sigla: homeSigla,
                  timeouts: match.timeouts.home,
                  subs: liveState.substitutionsCount.home,
                },
                {
                  side: 'away' as const,
                  sigla: awaySigla,
                  timeouts: match.timeouts.away,
                  subs: liveState.substitutionsCount.away,
                },
              ].map((info) => (
                <div
                  key={info.side}
                  className="bg-[#16161d] border border-white/10 px-3 py-2 flex items-center justify-between gap-2 text-[11px] text-neutral-400"
                >
                  <span className="font-semibold text-neutral-200">{info.sigla}</span>
                  <div className="flex items-center gap-3">
                    <span>
                      T. Técnicos: <strong className="text-white">{info.timeouts}/2</strong>
                    </span>
                    <span>
                      Cambios Set: <strong className="text-white">{info.subs}/6</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {mode === 'live' && onToggleServeSide && (
              <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-400 pt-1">
                <span>
                  Saque actual:{' '}
                  <strong className="text-white">
                    {liveState.servingSide === 'home' ? homeName : awayName}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onToggleServeSide(liveState.servingSide === 'home' ? 'away' : 'home')
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white font-medium cursor-pointer"
                >
                  <ArrowLeftRight className="w-3 h-3 text-[#707ef9]" />
                  <span>Cambiar saque</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
