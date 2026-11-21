import { useState } from 'react';
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
import { BarChart3, TrendingUp } from 'lucide-react';
import type { TeamProgressionPoint } from '../domain/tournamentEngine';
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
    <div className="bg-[#0d0d0d] text-white border border-white/15 px-3.5 py-3 shadow-xl text-xs min-w-[215px]">
      <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-1.5 mb-2">
        <span className="font-display text-base uppercase tracking-wider text-white">
          {point.fullLabel}
        </span>
        <span className="text-[11px] text-neutral-400 tabular-nums">{point.fecha}</span>
      </div>

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
              ? `Marcador fecha: ${point.favor} - ${point.contra}`
              : `Balance acumulado:`}
          </span>
          <strong className="text-[#a5b0ff]">
            {mode === 'acumulado' ? `Dif. ${accDiffFormatted}` : `${point.acumuladoFavor}-${point.acumuladoContra} (${accDiffFormatted})`}
          </strong>
        </div>

        {mode === 'por_fecha' && (
          <div className="flex items-center justify-between gap-4 text-[11px] text-neutral-400">
            <span>Diferencia en fecha</span>
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
  const maxFavorMatch =
    matchCount > 0
      ? progression.reduce((best, cur) => (cur.favor > best.favor ? cur : best), progression[0])
      : null;

  return (
    <section
      className="space-y-4"
      data-testid="team-progression-chart"
      aria-label={`Progresión de ${unitPlural.toLowerCase()} de ${teamName}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-neutral-200 pb-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
            Análisis Comparativo por Fecha
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
            La curva comparativa de {unitPlural.toLowerCase()} a favor y en contra se generará automáticamente cuando {teamName} finalice su primer encuentro oficial.
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
              {maxFavorMatch && (
                <>
                  <span aria-hidden="true" className="text-neutral-300">·</span>
                  <span>
                    Mejor fecha:{' '}
                    <strong className="text-[#0d0d0d]">
                      {maxFavorMatch.label} ({maxFavorMatch.favor}-{maxFavorMatch.contra})
                    </strong>
                  </span>
                </>
              )}
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
                    dataKey="label"
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
                    dataKey="label"
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
        </div>
      )}
    </section>
  );
}
