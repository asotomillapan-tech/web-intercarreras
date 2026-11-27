import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, BarChart3, ShieldCheck, TrendingUp } from 'lucide-react';
import {
  computeTeamScoringExtremes,
  type TeamMatchExtremeRecord,
  type TeamProgressionPoint,
} from '../domain/tournamentEngine';
import type { SportType } from '../types/tournament';

interface TeamProgressionChartProps {
  progression: TeamProgressionPoint[];
  sportType: SportType;
  teamName: string;
}

type ChartMode = 'acumulado' | 'por_fecha';

interface TooltipPayloadItem {
  payload?: TeamProgressionPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<TooltipPayloadItem>;
  unitPlural: string;
  mode: ChartMode;
}

function formatVolleyPeriodTag(record: TeamMatchExtremeRecord, sportType: SportType): string | null {
  if (
    sportType !== 'voleibol' ||
    record.periodPointsFavor === undefined ||
    record.periodPointsContra === undefined
  ) {
    return null;
  }
  return `${record.periodPointsFavor}-${record.periodPointsContra} pts`;
}

function ProgressionTooltip({ active, payload, unitPlural, mode }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }

  const point = payload[0].payload;
  const outcomeLabel =
    point.outcome === 'G' ? 'Victoria' : point.outcome === 'P' ? 'Derrota' : 'Empate';

  const diffFormatted =
    point.diferencia > 0 ? `+${point.diferencia}` : String(point.diferencia);
  const accDiffFormatted =
    point.acumuladoDiferencia > 0
      ? `+${point.acumuladoDiferencia}`
      : String(point.acumuladoDiferencia);

  return (
    <div className="rounded-2xl bg-[#111117] text-zinc-100 border border-white/[0.14] px-4 py-3 shadow-2xl text-xs min-w-[225px]">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-1.5 mb-2">
        <span className="font-medium text-white">{point.shortDate}</span>
        <span className="text-[11px] text-zinc-400 tabular-nums">
          {point.fecha || point.label}
        </span>
      </div>

      <p className="text-[11px] text-[#a5b0ff] mb-1">{point.fullLabel}</p>

      <p className="text-zinc-300 mb-2">
        {point.isHome ? 'Local vs ' : 'Visita vs '}
        <strong className="text-white font-medium">{point.opponentName}</strong>
        <span className="text-zinc-500"> · {outcomeLabel}</span>
      </p>

      <div className="space-y-1 tabular-nums">
        <div className="flex items-center justify-between gap-4">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-[#707ef9]" aria-hidden="true" />
            <span>
              {mode === 'acumulado' ? `${unitPlural} a favor (acum.)` : `${unitPlural} a favor`}
            </span>
          </span>
          <strong className="text-white">
            {mode === 'acumulado' ? point.acumuladoFavor : point.favor}
          </strong>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-[#ef4444]" aria-hidden="true" />
            <span>
              {mode === 'acumulado' ? `${unitPlural} en contra (acum.)` : `${unitPlural} en contra`}
            </span>
          </span>
          <strong className="text-white">
            {mode === 'acumulado' ? point.acumuladoContra : point.contra}
          </strong>
        </div>

        <div className="flex items-center justify-between gap-4 pt-1.5 mt-1.5 border-t border-white/[0.08] text-[11px] text-zinc-400">
          <span>
            {mode === 'acumulado'
              ? `Partido: ${point.favor} - ${point.contra}`
              : 'Balance acumulado:'}
          </span>
          <strong className="text-[#a5b0ff]">
            {mode === 'acumulado'
              ? `Dif. ${accDiffFormatted}`
              : `${point.acumuladoFavor}-${point.acumuladoContra} (${accDiffFormatted})`}
          </strong>
        </div>

        {mode === 'por_fecha' && (
          <div className="flex items-center justify-between gap-4 text-[11px] text-zinc-500">
            <span>Diferencia</span>
            <span className="text-zinc-200">{diffFormatted}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function TeamProgressionChart({
  progression,
  sportType,
  teamName,
}: TeamProgressionChartProps) {
  const [mode, setMode] = useState<ChartMode>('acumulado');

  const unitPlural =
    sportType === 'futbol7' ? 'Goles' : sportType === 'voleibol' ? 'Sets' : 'Puntos';
  const unitLower = unitPlural.toLowerCase();
  const unitShort =
    sportType === 'futbol7' ? 'goles' : sportType === 'voleibol' ? 'sets' : 'pts';

  const favorSeriesName = `${unitPlural} a favor`;
  const contraSeriesName = `${unitPlural} en contra`;

  const matchCount = progression.length;
  const lastPoint = matchCount > 0 ? progression[matchCount - 1] : null;
  const avgFavor =
    matchCount > 0 && lastPoint ? (lastPoint.acumuladoFavor / matchCount).toFixed(1) : '0.0';
  const avgContra =
    matchCount > 0 && lastPoint ? (lastPoint.acumuladoContra / matchCount).toFixed(1) : '0.0';

  const pointByIndex = useMemo(
    () => new Map(progression.map((p) => [p.index, p])),
    [progression]
  );

  const extremes = useMemo(
    () => computeTeamScoringExtremes(progression, sportType),
    [progression, sportType]
  );

  const primaryFor = extremes.biggestWin ?? extremes.mostScoredMatch;
  const secondaryMostScored =
    extremes.biggestWin &&
    extremes.mostScoredMatch &&
    extremes.mostScoredMatch.matchId !== extremes.biggestWin.matchId &&
    (sportType === 'voleibol'
      ? (extremes.mostScoredMatch.periodPointsFavor ?? extremes.mostScoredMatch.favor) >
        (extremes.biggestWin.periodPointsFavor ?? extremes.biggestWin.favor)
      : extremes.mostScoredMatch.favor > extremes.biggestWin.favor)
      ? extremes.mostScoredMatch
      : null;

  const primaryAgainst = extremes.worstDefeat ?? extremes.mostConcededMatch;
  const secondaryMostConceded =
    extremes.worstDefeat &&
    extremes.mostConcededMatch &&
    extremes.mostConcededMatch.matchId !== extremes.worstDefeat.matchId &&
    (sportType === 'voleibol'
      ? (extremes.mostConcededMatch.periodPointsContra ?? extremes.mostConcededMatch.contra) >
        (extremes.worstDefeat.periodPointsContra ?? extremes.worstDefeat.contra)
      : extremes.mostConcededMatch.contra > extremes.worstDefeat.contra)
      ? extremes.mostConcededMatch
      : null;

  const forCardTitle =
    sportType === 'futbol7'
      ? extremes.biggestWin
        ? 'Mayor goleada a favor'
        : 'Más goles anotados a un rival'
      : sportType === 'voleibol'
      ? extremes.biggestWin
        ? 'Mayor triunfo a favor'
        : 'Mayor anotación a favor'
      : extremes.biggestWin
      ? 'Mayor ventaja / puntos a favor'
      : 'Más puntos anotados a un rival';

  const againstCardTitle =
    sportType === 'futbol7'
      ? extremes.worstDefeat
        ? 'Mayor goleada recibida'
        : extremes.mostConcededMatch
        ? 'Rival que más goles les anotó'
        : 'Valla invicta'
      : sportType === 'voleibol'
      ? extremes.worstDefeat
        ? 'Mayor derrota sufrida'
        : extremes.mostConcededMatch
        ? 'Rival que más sets les ganó'
        : 'Sin sets en contra'
      : extremes.worstDefeat
      ? 'Mayor derrota / puntos recibidos'
      : extremes.mostConcededMatch
      ? 'Rival que más puntos les anotó'
      : 'Sin puntos en contra';

  const formatXAxisTick = (val: string | number) => {
    const pt = pointByIndex.get(Number(val));
    return pt ? pt.shortDate : String(val);
  };

  return (
    <section
      className="space-y-4"
      data-testid="team-progression-chart"
      aria-label={`Progresión de ${unitLower} de ${teamName}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-white/[0.08] pb-3.5">
        <div>
          <p className="text-xs text-[#a5b0ff]">Ordenado por fecha</p>
          <h3 className="text-xl font-medium tracking-[-0.02em] text-white mt-0.5">
            Progresión de {unitPlural} a Favor vs. en Contra
          </h3>
        </div>

        {matchCount > 0 && (
          <div
            role="tablist"
            aria-label="Tipo de gráfico comparativo"
            className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] p-1 border border-white/[0.08] self-start sm:self-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'acumulado'}
              onClick={() => setMode('acumulado')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                mode === 'acumulado'
                  ? 'bg-white text-[#050507]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Acumulado</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'por_fecha'}
              onClick={() => setMode('por_fecha')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                mode === 'por_fecha'
                  ? 'bg-white text-[#050507]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Por fecha</span>
            </button>
          </div>
        )}
      </div>

      {matchCount === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#101016] px-6 py-8 text-center space-y-2">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/[0.05] border border-white/[0.08] text-[#9aa5ff] mx-auto">
            <TrendingUp className="w-5 h-5" aria-hidden="true" />
          </div>
          <p className="text-base font-medium text-white">Sin fechas disputadas</p>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            La progresión se generará al finalizar el primer encuentro oficial de {teamName}.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-[#101016] p-4 sm:p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/[0.07] pb-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <span className="inline-flex items-center gap-2 text-zinc-200 font-medium">
                <span className="inline-block w-3.5 h-1 rounded-full bg-[#707ef9]" aria-hidden="true" />
                <span>{favorSeriesName}</span>
              </span>
              <span className="inline-flex items-center gap-2 text-zinc-200 font-medium">
                <span
                  className="inline-block w-3.5 h-0 border-t-2 border-dashed border-[#ef4444]"
                  aria-hidden="true"
                />
                <span>{contraSeriesName}</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-zinc-400 tabular-nums">
              <span>
                Prom. favor: <strong className="text-white">{avgFavor}</strong>
              </span>
              <span aria-hidden="true" className="text-zinc-700">·</span>
              <span>
                Prom. contra: <strong className="text-white">{avgContra}</strong>
              </span>
              <span aria-hidden="true" className="text-zinc-700">·</span>
              <span>
                Partidos: <strong className="text-white">{matchCount}</strong>
              </span>
            </div>
          </div>

          <div className="w-full min-w-0 h-[260px]">
            <ResponsiveContainer width="100%" height={260} minWidth={0}>
              {mode === 'acumulado' ? (
                <AreaChart
                  data={progression}
                  margin={{ top: 10, right: 16, left: -12, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="ufroFavorFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#707ef9" stopOpacity={0.34} />
                      <stop offset="95%" stopColor="#707ef9" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="ufroContraFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                  <XAxis
                    dataKey="index"
                    tickFormatter={formatXAxisTick}
                    interval="preserveStartEnd"
                    minTickGap={18}
                    tick={{ fill: '#a1a1aa', fontSize: 12 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#a1a1aa', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={(tooltipProps) => (
                      <ProgressionTooltip
                        active={tooltipProps.active}
                        payload={
                          tooltipProps.payload as ReadonlyArray<TooltipPayloadItem> | undefined
                        }
                        unitPlural={unitPlural}
                        mode="acumulado"
                      />
                    )}
                  />
                  <Area
                    type="monotone"
                    dataKey="acumuladoFavor"
                    name={favorSeriesName}
                    stroke="#707ef9"
                    strokeWidth={2.5}
                    fill="url(#ufroFavorFill)"
                    dot={{ r: 4, fill: '#707ef9', stroke: '#101016', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#707ef9', stroke: '#ffffff', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="acumuladoContra"
                    name={contraSeriesName}
                    stroke="#ef4444"
                    strokeWidth={2.2}
                    strokeDasharray="5 4"
                    fill="url(#ufroContraFill)"
                    dot={{ r: 4, fill: '#ef4444', stroke: '#101016', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#ef4444', stroke: '#ffffff', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              ) : (
                <BarChart
                  data={progression}
                  margin={{ top: 10, right: 16, left: -12, bottom: 4 }}
                  barGap={6}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                  <XAxis
                    dataKey="index"
                    tickFormatter={formatXAxisTick}
                    interval="preserveStartEnd"
                    minTickGap={18}
                    tick={{ fill: '#a1a1aa', fontSize: 12 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#a1a1aa', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    content={(tooltipProps) => (
                      <ProgressionTooltip
                        active={tooltipProps.active}
                        payload={
                          tooltipProps.payload as ReadonlyArray<TooltipPayloadItem> | undefined
                        }
                        unitPlural={unitPlural}
                        mode="por_fecha"
                      />
                    )}
                  />
                  <Bar
                    dataKey="favor"
                    name={favorSeriesName}
                    fill="#707ef9"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={32}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="contra"
                    name={contraSeriesName}
                    fill="#ef4444"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={32}
                    isAnimationActive={false}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Scoring Extremes Cards (clean hairline borders, no thick left stripe) */}
          <div
            data-testid="team-scoring-extremes"
            className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-4 border-t border-white/[0.07]"
          >
            <div
              data-testid="extreme-for-card"
              className="rounded-2xl border border-[#707ef9]/25 bg-[#707ef9]/[0.06] p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-[#a5b0ff] font-medium flex items-center gap-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{forCardTitle}</span>
                </p>
                {primaryFor && (
                  <span className="text-sm font-semibold tabular-nums px-2.5 py-0.5 rounded-full bg-white/[0.1] text-white shrink-0">
                    {primaryFor.favor} — {primaryFor.contra}
                  </span>
                )}
              </div>

              {primaryFor ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-white leading-snug">
                    vs {primaryFor.opponentName}
                  </p>
                  <p className="text-xs text-zinc-400 tabular-nums">
                    {extremes.biggestWin ? (
                      <>
                        Diferencia{' '}
                        <strong className="text-white">
                          +{primaryFor.diferencia} {unitShort}
                        </strong>
                        {formatVolleyPeriodTag(primaryFor, sportType)
                          ? ` (${formatVolleyPeriodTag(primaryFor, sportType)})`
                          : ''}
                      </>
                    ) : (
                      <>
                        Anotaron{' '}
                        <strong className="text-white">
                          {primaryFor.favor} {unitShort}
                        </strong>
                      </>
                    )}{' '}
                    · {primaryFor.shortDate} · {primaryFor.fullLabel}
                  </p>

                  {secondaryMostScored && (
                    <p className="text-[11px] text-zinc-400 pt-2 mt-1.5 border-t border-white/[0.08] tabular-nums">
                      Más {unitLower} en un partido:{' '}
                      <strong className="text-white">
                        {sportType === 'voleibol' && secondaryMostScored.periodPointsFavor
                          ? `${secondaryMostScored.periodPointsFavor} pts`
                          : `${secondaryMostScored.favor} ${unitShort}`}{' '}
                        vs {secondaryMostScored.opponentName}
                      </strong>{' '}
                      ({secondaryMostScored.favor}-{secondaryMostScored.contra} ·{' '}
                      {secondaryMostScored.shortDate})
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  Sin {unitLower} a favor registrados todavía.
                </p>
              )}
            </div>

            <div
              data-testid="extreme-against-card"
              className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-red-400 font-medium flex items-center gap-1.5">
                  {primaryAgainst ? (
                    <ArrowDownRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span>{againstCardTitle}</span>
                </p>
                {primaryAgainst && (
                  <span className="text-sm font-semibold tabular-nums px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-200 shrink-0">
                    {primaryAgainst.favor} — {primaryAgainst.contra}
                  </span>
                )}
              </div>

              {primaryAgainst ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-white leading-snug">
                    vs {primaryAgainst.opponentName}
                  </p>
                  <p className="text-xs text-zinc-400 tabular-nums">
                    {extremes.worstDefeat ? (
                      <>
                        Diferencia{' '}
                        <strong className="text-red-300">
                          {primaryAgainst.diferencia} {unitShort}
                        </strong>
                        {formatVolleyPeriodTag(primaryAgainst, sportType)
                          ? ` (${formatVolleyPeriodTag(primaryAgainst, sportType)})`
                          : ''}
                      </>
                    ) : (
                      <>
                        Recibieron{' '}
                        <strong className="text-red-300">
                          {primaryAgainst.contra} {unitShort}
                        </strong>{' '}
                        (Invicto)
                      </>
                    )}{' '}
                    · {primaryAgainst.shortDate} · {primaryAgainst.fullLabel}
                  </p>

                  {secondaryMostConceded && (
                    <p className="text-[11px] text-zinc-400 pt-2 mt-1.5 border-t border-white/[0.08] tabular-nums">
                      Más {unitLower} recibidos:{' '}
                      <strong className="text-white">
                        {sportType === 'voleibol' && secondaryMostConceded.periodPointsContra
                          ? `${secondaryMostConceded.periodPointsContra} pts`
                          : `${secondaryMostConceded.contra} ${unitShort}`}{' '}
                        vs {secondaryMostConceded.opponentName}
                      </strong>{' '}
                      ({secondaryMostConceded.favor}-{secondaryMostConceded.contra} ·{' '}
                      {secondaryMostConceded.shortDate})
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-zinc-400 tabular-nums">
                  0 {unitLower} recibidos en {matchCount}{' '}
                  {matchCount === 1 ? 'partido' : 'partidos'}.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
