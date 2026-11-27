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
    point.outcome === 'G'
      ? 'Victoria'
      : point.outcome === 'P'
      ? 'Derrota'
      : 'Empate';

  const diffFormatted =
    point.diferencia > 0 ? `+${point.diferencia}` : String(point.diferencia);
  const accDiffFormatted =
    point.acumuladoDiferencia > 0
      ? `+${point.acumuladoDiferencia}`
      : String(point.acumuladoDiferencia);

  return (
    <div className="bg-[#0d0d0d] text-white border border-white/15 px-3.5 py-3 shadow-xl text-xs min-w-[225px]">
      <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-1.5 mb-2">
        <span className="font-display text-base uppercase tracking-wider text-white">
          {point.shortDate}
        </span>
        <span className="text-[11px] text-neutral-400 tabular-nums">
          {point.fecha || point.label}
        </span>
      </div>

      <p className="text-[11px] uppercase tracking-wider text-[#a5b0ff] mb-1">
        {point.fullLabel}
      </p>

      <p className="text-neutral-300 mb-2">
        {point.isHome ? 'Local vs ' : 'Visita vs '}
        <strong className="text-white">{point.opponentName}</strong>
        <span className="text-neutral-400"> · {outcomeLabel}</span>
      </p>

      <div className="space-y-1 tabular-nums">
        <div className="flex items-center justify-between gap-4">
          <span className="text-neutral-300 flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 bg-[#707ef9]" aria-hidden="true" />
            <span>
              {mode === 'acumulado' ? `${unitPlural} a favor (acum.)` : `${unitPlural} a favor`}
            </span>
          </span>
          <strong className="text-white">
            {mode === 'acumulado' ? point.acumuladoFavor : point.favor}
          </strong>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-neutral-300 flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 bg-[#dc2626]" aria-hidden="true" />
            <span>
              {mode === 'acumulado' ? `${unitPlural} en contra (acum.)` : `${unitPlural} en contra`}
            </span>
          </span>
          <strong className="text-white">
            {mode === 'acumulado' ? point.acumuladoContra : point.contra}
          </strong>
        </div>

        <div className="flex items-center justify-between gap-4 pt-1.5 mt-1.5 border-t border-white/15 text-[11px] text-neutral-300">
          <span>
            {mode === 'acumulado'
              ? `Marcador partido: ${point.favor} - ${point.contra}`
              : 'Balance acumulado:'}
          </span>
          <strong className="text-[#a5b0ff]">
            {mode === 'acumulado'
              ? `Dif. ${accDiffFormatted}`
              : `${point.acumuladoFavor}-${point.acumuladoContra} (${accDiffFormatted})`}
          </strong>
        </div>

        {mode === 'por_fecha' && (
          <div className="flex items-center justify-between gap-4 text-[11px] text-neutral-400">
            <span>Diferencia en partido</span>
            <span className="text-white">{diffFormatted}</span>
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
    sportType === 'futbol7'
      ? 'Goles'
      : sportType === 'voleibol'
      ? 'Sets'
      : 'Puntos';

  const unitLower = unitPlural.toLowerCase();
  const unitShort =
    sportType === 'futbol7' ? 'goles' : sportType === 'voleibol' ? 'sets' : 'pts';

  const favorSeriesName = `${unitPlural} a favor`;
  const contraSeriesName = `${unitPlural} en contra`;

  const matchCount = progression.length;
  const lastPoint = matchCount > 0 ? progression[matchCount - 1] : null;
  const avgFavor =
    matchCount > 0 && lastPoint
      ? (lastPoint.acumuladoFavor / matchCount).toFixed(1)
      : '0.0';
  const avgContra =
    matchCount > 0 && lastPoint
      ? (lastPoint.acumuladoContra / matchCount).toFixed(1)
      : '0.0';

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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-neutral-200 pb-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
            Análisis Comparativo · Ordenado por Fecha
          </p>
          <h3 className="font-display text-2xl uppercase tracking-wide text-[#0d0d0d]">
            Progresión de {unitPlural} a Favor vs. en Contra
          </h3>
        </div>

        {matchCount > 0 && (
          <div
            role="tablist"
            aria-label="Tipo de gráfico comparativo"
            className="flex items-center gap-1 bg-[#f5f6f8] p-1 border border-neutral-200 self-start sm:self-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'acumulado'}
              onClick={() => setMode('acumulado')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                mode === 'acumulado'
                  ? 'bg-[#0d0d0d] text-white'
                  : 'text-neutral-600 hover:text-[#0d0d0d]'
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
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                mode === 'por_fecha'
                  ? 'bg-[#0d0d0d] text-white'
                  : 'text-neutral-600 hover:text-[#0d0d0d]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Por fecha</span>
            </button>
          </div>
        )}
      </div>

      {matchCount === 0 ? (
        <div className="border border-neutral-200 bg-[#f5f6f8] px-6 py-8 text-center space-y-2">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-white border border-neutral-200 text-[#707ef9] mx-auto">
            <TrendingUp className="w-5 h-5" aria-hidden="true" />
          </div>
          <p className="font-display text-xl uppercase tracking-wide text-[#0d0d0d]">
            Sin fechas disputadas registradas
          </p>
          <p className="text-xs text-neutral-600 max-w-md mx-auto leading-relaxed">
            La curva comparativa de {unitLower} a favor y en contra se generará automáticamente cuando {teamName} finalice su primer encuentro oficial.
          </p>
        </div>
      ) : (
        <div className="border border-neutral-200 bg-white p-4 sm:p-5 space-y-4">
          {/* Legend & Compact Comparative Metrics */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-neutral-100 pb-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <span className="inline-flex items-center gap-2 text-[#0d0d0d] font-medium">
                <span className="inline-block w-3.5 h-1 bg-[#707ef9]" aria-hidden="true" />
                <span>{favorSeriesName}</span>
              </span>
              <span className="inline-flex items-center gap-2 text-[#0d0d0d] font-medium">
                <span
                  className="inline-block w-3.5 h-0 border-t-2 border-dashed border-[#dc2626]"
                  aria-hidden="true"
                />
                <span>{contraSeriesName}</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-neutral-600 tabular-nums">
              <span>
                Prom. favor:{' '}
                <strong className="text-[#0d0d0d]">{avgFavor}</strong> / partido
              </span>
              <span aria-hidden="true" className="text-neutral-300">·</span>
              <span>
                Prom. contra:{' '}
                <strong className="text-[#0d0d0d]">{avgContra}</strong> / partido
              </span>
              <span aria-hidden="true" className="text-neutral-300">·</span>
              <span>
                Partidos:{' '}
                <strong className="text-[#0d0d0d]">{matchCount}</strong>
              </span>
            </div>
          </div>

          {/* Recharts Visualization */}
          <div className="w-full min-w-0 h-[260px]">
            <ResponsiveContainer width="100%" height={260} minWidth={0}>
              {mode === 'acumulado' ? (
                <AreaChart
                  data={progression}
                  margin={{ top: 10, right: 16, left: -12, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="ufroFavorFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#707ef9" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#707ef9" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="ufroContraFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.14} />
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis
                    dataKey="index"
                    tickFormatter={formatXAxisTick}
                    interval="preserveStartEnd"
                    minTickGap={18}
                    tick={{ fill: '#525252', fontSize: 12 }}
                    axisLine={{ stroke: '#d4d4d4' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#525252', fontSize: 12 }}
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
                    dot={{ r: 4, fill: '#707ef9', stroke: '#ffffff', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#707ef9', stroke: '#0d0d0d', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="acumuladoContra"
                    name={contraSeriesName}
                    stroke="#dc2626"
                    strokeWidth={2.2}
                    strokeDasharray="5 4"
                    fill="url(#ufroContraFill)"
                    dot={{ r: 4, fill: '#dc2626', stroke: '#ffffff', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#dc2626', stroke: '#0d0d0d', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              ) : (
                <BarChart
                  data={progression}
                  margin={{ top: 10, right: 16, left: -12, bottom: 4 }}
                  barGap={6}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis
                    dataKey="index"
                    tickFormatter={formatXAxisTick}
                    interval="preserveStartEnd"
                    minTickGap={18}
                    tick={{ fill: '#525252', fontSize: 12 }}
                    axisLine={{ stroke: '#d4d4d4' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#525252', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: '#f5f6f8' }}
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
                    maxBarSize={32}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="contra"
                    name={contraSeriesName}
                    fill="#dc2626"
                    maxBarSize={32}
                    isAnimationActive={false}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Biggest Win / Most Scored vs. Worst Defeat / Most Conceded Cards */}
          <div
            data-testid="team-scoring-extremes"
            className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4 border-t border-neutral-200"
          >
            {/* A quién han goleado más / metido más puntos */}
            <div
              data-testid="extreme-for-card"
              className="border border-neutral-200 border-l-4 border-l-[#707ef9] bg-[#f8f9ff] p-3.5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-widest text-[#707ef9] font-semibold flex items-center gap-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{forCardTitle}</span>
                </p>
                {primaryFor && (
                  <span className="font-display text-lg leading-none tabular-nums px-2 py-0.5 bg-[#0d0d0d] text-white shrink-0">
                    {primaryFor.favor} — {primaryFor.contra}
                  </span>
                )}
              </div>

              {primaryFor ? (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[#0d0d0d] leading-snug">
                    vs {primaryFor.opponentName}
                  </p>
                  <p className="text-xs text-neutral-600 tabular-nums">
                    {extremes.biggestWin ? (
                      <>
                        Diferencia{' '}
                        <strong className="text-[#0d0d0d]">
                          +{primaryFor.diferencia} {unitShort}
                        </strong>
                        {formatVolleyPeriodTag(primaryFor, sportType)
                          ? ` (${formatVolleyPeriodTag(primaryFor, sportType)})`
                          : ''}
                      </>
                    ) : (
                      <>
                        Anotaron{' '}
                        <strong className="text-[#0d0d0d]">
                          {primaryFor.favor} {unitShort}
                        </strong>
                      </>
                    )}{' '}
                    · {primaryFor.shortDate} · {primaryFor.fullLabel}
                  </p>

                  {secondaryMostScored && (
                    <p className="text-[11px] text-neutral-600 pt-2 mt-1.5 border-t border-neutral-200/80 tabular-nums">
                      Más {unitLower} en un partido:{' '}
                      <strong className="text-[#0d0d0d]">
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
                <p className="text-xs text-neutral-500">
                  Sin {unitLower} a favor registrados todavía en encuentros finalizados.
                </p>
              )}
            </div>

            {/* Quién los ha goleado / les ha metido más puntos */}
            <div
              data-testid="extreme-against-card"
              className="border border-neutral-200 border-l-4 border-l-[#dc2626] bg-[#fef7f7] p-3.5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-widest text-[#dc2626] font-semibold flex items-center gap-1.5">
                  {primaryAgainst ? (
                    <ArrowDownRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span>{againstCardTitle}</span>
                </p>
                {primaryAgainst && (
                  <span className="font-display text-lg leading-none tabular-nums px-2 py-0.5 bg-[#dc2626] text-white shrink-0">
                    {primaryAgainst.favor} — {primaryAgainst.contra}
                  </span>
                )}
              </div>

              {primaryAgainst ? (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[#0d0d0d] leading-snug">
                    vs {primaryAgainst.opponentName}
                  </p>
                  <p className="text-xs text-neutral-600 tabular-nums">
                    {extremes.worstDefeat ? (
                      <>
                        Diferencia{' '}
                        <strong className="text-[#dc2626]">
                          {primaryAgainst.diferencia} {unitShort}
                        </strong>
                        {formatVolleyPeriodTag(primaryAgainst, sportType)
                          ? ` (${formatVolleyPeriodTag(primaryAgainst, sportType)})`
                          : ''}
                      </>
                    ) : (
                      <>
                        Recibieron{' '}
                        <strong className="text-[#dc2626]">
                          {primaryAgainst.contra} {unitShort}
                        </strong>{' '}
                        (Invicto)
                      </>
                    )}{' '}
                    · {primaryAgainst.shortDate} · {primaryAgainst.fullLabel}
                  </p>

                  {secondaryMostConceded && (
                    <p className="text-[11px] text-neutral-600 pt-2 mt-1.5 border-t border-neutral-200/80 tabular-nums">
                      Más {unitLower} recibidos en un partido:{' '}
                      <strong className="text-[#0d0d0d]">
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
                <p className="text-xs text-neutral-600 tabular-nums">
                  0 {unitLower} recibidos en {matchCount}{' '}
                  {matchCount === 1 ? 'partido finalizado' : 'partidos finalizados'}.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
