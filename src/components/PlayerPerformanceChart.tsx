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
import { BarChart3, TrendingUp } from 'lucide-react';
import type {
  PlayerPerformancePoint,
  PlayerPerformanceSummary,
} from '../domain/playerPerformanceEngine';
import type { SportType } from '../types/tournament';

interface PlayerPerformanceChartProps {
  summary: PlayerPerformanceSummary;
  playerName: string;
  teamName: string;
  disciplineLabel: string;
  season: string;
}

type ChartMode = 'acumulado' | 'por_fecha';
type SeriesSlot = 'primary' | 'secondary' | 'tertiary';

interface SeriesDefinition {
  slot: SeriesSlot;
  label: string;
  perMatchKey: keyof PlayerPerformancePoint;
  cumulativeKey: keyof PlayerPerformancePoint;
  color: string;
  gradientId: string;
  dashed?: boolean;
}

function getSeriesDefinitions(sportType: SportType): SeriesDefinition[] {
  if (sportType === 'futbol7') {
    return [
      {
        slot: 'primary',
        label: 'Goles',
        perMatchKey: 'goles',
        cumulativeKey: 'acumuladoGoles',
        color: '#707ef9',
        gradientId: 'ufroPlayerGoalsFill',
      },
      {
        slot: 'secondary',
        label: 'Asistencias',
        perMatchKey: 'asistencias',
        cumulativeKey: 'acumuladoAsistencias',
        color: '#0f766e',
        gradientId: 'ufroPlayerAssistsFill',
      },
      {
        slot: 'tertiary',
        label: 'Tarjetas',
        perMatchKey: 'tarjetas',
        cumulativeKey: 'acumuladoTarjetas',
        color: '#d97706',
        gradientId: 'ufroPlayerCardsFill',
        dashed: true,
      },
    ];
  }

  if (sportType === 'voleibol') {
    return [
      {
        slot: 'primary',
        label: 'Puntos',
        perMatchKey: 'puntos',
        cumulativeKey: 'acumuladoPuntos',
        color: '#707ef9',
        gradientId: 'ufroPlayerPtsFill',
      },
      {
        slot: 'secondary',
        label: 'Aces',
        perMatchKey: 'aces',
        cumulativeKey: 'acumuladoAces',
        color: '#0f766e',
        gradientId: 'ufroPlayerAcesFill',
      },
      {
        slot: 'tertiary',
        label: 'Bloqueos',
        perMatchKey: 'bloqueos',
        cumulativeKey: 'acumuladoBloqueos',
        color: '#d97706',
        gradientId: 'ufroPlayerBlocksFill',
        dashed: true,
      },
    ];
  }

  return [
    {
      slot: 'primary',
      label: 'Puntos',
      perMatchKey: 'puntos',
      cumulativeKey: 'acumuladoPuntos',
      color: '#707ef9',
      gradientId: 'ufroPlayerBasketPtsFill',
    },
    {
      slot: 'secondary',
      label: 'Rebotes',
      perMatchKey: 'rebotes',
      cumulativeKey: 'acumuladoRebotes',
      color: '#0f766e',
      gradientId: 'ufroPlayerRebFill',
    },
    {
      slot: 'tertiary',
      label: 'Faltas',
      perMatchKey: 'faltas',
      cumulativeKey: 'acumuladoFaltas',
      color: '#d97706',
      gradientId: 'ufroPlayerFoulsFill',
      dashed: true,
    },
  ];
}

interface TooltipPayloadItem {
  payload?: PlayerPerformancePoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<TooltipPayloadItem>;
  mode: ChartMode;
  sportType: SportType;
  seriesDefs: SeriesDefinition[];
}

function PlayerPerformanceTooltip({
  active,
  payload,
  mode,
  sportType,
  seriesDefs,
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }

  const point = payload[0].payload;
  const outcomeLabel =
    point.outcome === 'G'
      ? 'Victoria'
      : point.outcome === 'P'
      ? 'Derrota'
      : point.outcome === 'E'
      ? 'Empate'
      : null;

  return (
    <div className="bg-[#0d0d0d] text-white border border-white/15 px-3.5 py-3 shadow-xl text-xs min-w-[225px]">
      <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-1.5 mb-2">
        <span className="font-display text-base uppercase tracking-wider text-white">
          {point.fullLabel}
        </span>
        <span className="text-[11px] text-neutral-400 tabular-nums">{point.fecha}</span>
      </div>

      {point.opponentName && (
        <p className="text-neutral-300 mb-2">
          {point.teamScore !== null && point.opponentScore !== null ? (
            <>
              {point.isHome ? 'Local vs ' : 'Visita vs '}
              <strong className="text-white">{point.opponentName}</strong>
              <span className="text-neutral-400 tabular-nums">
                {' '}
                · {point.teamScore}-{point.opponentScore}
                {outcomeLabel ? ` (${outcomeLabel})` : ''}
              </span>
            </>
          ) : (
            <strong className="text-white">{point.opponentName}</strong>
          )}
        </p>
      )}

      <div className="space-y-1.5 tabular-nums">
        {seriesDefs.map((series) => {
          const perVal = Number(point[series.perMatchKey]) || 0;
          const accVal = Number(point[series.cumulativeKey]) || 0;
          return (
            <div key={series.slot} className="flex items-center justify-between gap-4">
              <span className="text-neutral-300 flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 shrink-0"
                  style={{ backgroundColor: series.color }}
                  aria-hidden="true"
                />
                <span>
                  {series.label}
                  {mode === 'acumulado' ? ' (acum.)' : ' en fecha'}
                </span>
              </span>
              <span className="text-right">
                <strong className="text-white">
                  {mode === 'acumulado' ? accVal : perVal}
                </strong>
                <span className="text-[11px] text-neutral-400 ml-1.5">
                  {mode === 'acumulado' ? `(+${perVal})` : `(acum. ${accVal})`}
                </span>
              </span>
            </div>
          );
        })}

        {sportType === 'futbol7' && (
          <div className="flex items-center justify-between gap-4 pt-1.5 mt-1.5 border-t border-white/15 text-[11px] text-neutral-300">
            <span>Detalle tarjetas ({mode === 'acumulado' ? 'acum.' : 'fecha'})</span>
            <span className="text-white">
              {mode === 'acumulado'
                ? `${point.acumuladoTarjetasAmarillas} TA · ${point.acumuladoTarjetasRojas} TR`
                : `${point.tarjetasAmarillas} TA · ${point.tarjetasRojas} TR`}
            </span>
          </div>
        )}

        {(sportType === 'basquetbol' || sportType === 'basquetbol3x3') && (
          <div className="flex items-center justify-between gap-4 pt-1.5 mt-1.5 border-t border-white/15 text-[11px] text-neutral-300">
            <span>Triples ({mode === 'acumulado' ? 'acum.' : 'fecha'})</span>
            <span className="text-white">
              {mode === 'acumulado' ? point.acumuladoTriples : point.triples}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function PlayerPerformanceChart({
  summary,
  playerName,
  teamName,
  disciplineLabel,
  season,
}: PlayerPerformanceChartProps) {
  const [mode, setMode] = useState<ChartMode>('acumulado');
  const [visibleSeries, setVisibleSeries] = useState<Record<SeriesSlot, boolean>>({
    primary: true,
    secondary: true,
    tertiary: true,
  });

  const seriesDefs = useMemo(
    () => getSeriesDefinitions(summary.sportType),
    [summary.sportType]
  );

  const toggleSeries = (slot: SeriesSlot) => {
    setVisibleSeries((prev) => {
      const activeCount = Object.values(prev).filter(Boolean).length;
      // Keep at least one series active so the chart never renders empty by accident
      if (prev[slot] && activeCount <= 1) return prev;
      return { ...prev, [slot]: !prev[slot] };
    });
  };

  const hasCardsChart =
    summary.sportType === 'futbol7' &&
    (summary.totals.tarjetasAmarillas > 0 || summary.totals.tarjetasRojas > 0);

  if (summary.source === 'sin_datos' || summary.points.length === 0) {
    return (
      <section
        data-testid="player-performance-empty"
        aria-label={`Rendimiento histórico de ${playerName}`}
        className="border border-neutral-200 bg-[#f5f6f8] px-6 py-10 text-center space-y-2.5"
      >
        <div className="inline-flex items-center justify-center w-10 h-10 bg-white border border-neutral-200 text-[#707ef9] mx-auto">
          <TrendingUp className="w-5 h-5" aria-hidden="true" />
        </div>
        <h3 className="font-display text-2xl uppercase tracking-wide text-[#0d0d0d]">
          Sin registros de rendimiento en la temporada {season}
        </h3>
        <p className="text-xs text-neutral-600 max-w-md mx-auto leading-relaxed">
          Los gráficos de evolución de estadísticas se generarán automáticamente cuando{' '}
          {playerName} dispute partidos oficiales finalizados con {teamName}.
        </p>
      </section>
    );
  }

  return (
    <section
      data-testid="player-performance-chart"
      aria-label={`Gráficos de rendimiento histórico de ${playerName}`}
      className="space-y-5"
    >
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-neutral-200 pb-3">
        <div>
          <p className="text-xs text-[#707ef9] font-medium">
            Temporada {season} · {disciplineLabel} · {teamName}
          </p>
          <h3 className="font-display text-2xl uppercase tracking-wide text-[#0d0d0d]">
            Evolución Histórica de Rendimiento
          </h3>
        </div>

        <div
          role="tablist"
          aria-label="Modo de visualización de estadísticas"
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
            <span>Por partido</span>
          </button>
        </div>
      </div>

      {/* Compact 4-KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#f5f6f8] border border-neutral-200 p-4 tabular-nums">
        {summary.sportType === 'futbol7' ? (
          <>
            <div>
              <p className="text-xs text-neutral-500">Goles totales</p>
              <p className="font-display text-2xl font-bold text-[#707ef9]">
                {summary.totals.goles}
              </p>
              <p className="text-[11px] text-neutral-500">
                {summary.averages.goles.toFixed(1)} / partido
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Asistencias</p>
              <p className="font-display text-2xl font-bold text-[#0f766e]">
                {summary.totals.asistencias}
              </p>
              <p className="text-[11px] text-neutral-500">
                {summary.averages.asistencias.toFixed(1)} / partido
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Tarjetas (TA / TR)</p>
              <p className="font-display text-2xl font-bold text-[#0d0d0d]">
                {summary.totals.tarjetasAmarillas} / {summary.totals.tarjetasRojas}
              </p>
              <p className="text-[11px] text-neutral-500">
                {summary.totals.tarjetas} total(es)
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Fechas analizadas</p>
              <p className="font-display text-2xl font-bold text-[#0d0d0d]">
                {summary.matchesCount}
              </p>
              <p className="text-[11px] text-neutral-500 truncate">
                {summary.bestMatch
                  ? `Pico: ${summary.bestMatch.primaryValue} en ${summary.bestMatch.label}`
                  : 'Temporada regular'}
              </p>
            </div>
          </>
        ) : summary.sportType === 'voleibol' ? (
          <>
            <div>
              <p className="text-xs text-neutral-500">Puntos totales</p>
              <p className="font-display text-2xl font-bold text-[#707ef9]">
                {summary.totals.puntos}
              </p>
              <p className="text-[11px] text-neutral-500">
                {summary.averages.puntos.toFixed(1)} / partido
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Aces</p>
              <p className="font-display text-2xl font-bold text-[#0f766e]">
                {summary.totals.aces}
              </p>
              <p className="text-[11px] text-neutral-500">
                {summary.averages.aces.toFixed(1)} / partido
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Bloqueos</p>
              <p className="font-display text-2xl font-bold text-[#d97706]">
                {summary.totals.bloqueos}
              </p>
              <p className="text-[11px] text-neutral-500">
                {summary.averages.bloqueos.toFixed(1)} / partido
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Fechas analizadas</p>
              <p className="font-display text-2xl font-bold text-[#0d0d0d]">
                {summary.matchesCount}
              </p>
              <p className="text-[11px] text-neutral-500 truncate">
                {summary.bestMatch
                  ? `Pico: ${summary.bestMatch.primaryValue} pts (${summary.bestMatch.label})`
                  : 'Temporada regular'}
              </p>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-xs text-neutral-500">Puntos totales</p>
              <p className="font-display text-2xl font-bold text-[#707ef9]">
                {summary.totals.puntos}
              </p>
              <p className="text-[11px] text-neutral-500">
                {summary.averages.puntos.toFixed(1)} / partido
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Rebotes / Triples</p>
              <p className="font-display text-2xl font-bold text-[#0f766e]">
                {summary.totals.rebotes} / {summary.totals.triples}
              </p>
              <p className="text-[11px] text-neutral-500">
                {summary.averages.rebotes.toFixed(1)} reb / part.
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Faltas personales</p>
              <p className="font-display text-2xl font-bold text-[#d97706]">
                {summary.totals.faltas}
              </p>
              <p className="text-[11px] text-neutral-500">Acumuladas</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Fechas analizadas</p>
              <p className="font-display text-2xl font-bold text-[#0d0d0d]">
                {summary.matchesCount}
              </p>
              <p className="text-[11px] text-neutral-500 truncate">
                {summary.bestMatch
                  ? `Pico: ${summary.bestMatch.primaryValue} pts (${summary.bestMatch.label})`
                  : 'Temporada regular'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Main Recharts Container */}
      <div className="border border-neutral-200 bg-white p-4 sm:p-5 space-y-4">
        {/* Interactive Series Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-3">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar métricas del gráfico">
            {seriesDefs.map((series) => {
              const active = visibleSeries[series.slot];
              return (
                <button
                  key={series.slot}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleSeries(series.slot)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#0d0d0d] text-white border-[#0d0d0d]'
                      : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400 hover:text-[#0d0d0d]'
                  }`}
                >
                  <span
                    className="inline-block w-3 h-1 shrink-0"
                    style={{
                      backgroundColor: active ? series.color : '#a3a3a3',
                    }}
                    aria-hidden="true"
                  />
                  <span>{series.label}</span>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-neutral-500">
            {mode === 'acumulado'
              ? 'Progresión acumulada fecha a fecha'
              : 'Producción individual por partido'}
          </p>
        </div>

        <div className="w-full min-w-0 h-[260px]">
          <ResponsiveContainer width="100%" height={260} minWidth={0}>
            {mode === 'acumulado' ? (
              <AreaChart
                data={summary.points}
                margin={{ top: 10, right: 16, left: -12, bottom: 4 }}
              >
                <defs>
                  {seriesDefs.map((series) => (
                    <linearGradient
                      key={series.gradientId}
                      id={series.gradientId}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor={series.color} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={series.color} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
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
                    <PlayerPerformanceTooltip
                      active={tooltipProps.active}
                      payload={
                        tooltipProps.payload as ReadonlyArray<TooltipPayloadItem> | undefined
                      }
                      mode="acumulado"
                      sportType={summary.sportType}
                      seriesDefs={seriesDefs}
                    />
                  )}
                />
                {seriesDefs.map(
                  (series) =>
                    visibleSeries[series.slot] && (
                      <Area
                        key={series.slot}
                        type="monotone"
                        dataKey={series.cumulativeKey}
                        name={series.label}
                        stroke={series.color}
                        strokeWidth={series.dashed ? 2.2 : 2.5}
                        strokeDasharray={series.dashed ? '5 4' : undefined}
                        fill={`url(#${series.gradientId})`}
                        dot={{ r: 4, fill: series.color, stroke: '#ffffff', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: series.color, stroke: '#0d0d0d', strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                    )
                )}
              </AreaChart>
            ) : (
              <BarChart
                data={summary.points}
                margin={{ top: 10, right: 16, left: -12, bottom: 4 }}
                barGap={4}
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
                    <PlayerPerformanceTooltip
                      active={tooltipProps.active}
                      payload={
                        tooltipProps.payload as ReadonlyArray<TooltipPayloadItem> | undefined
                      }
                      mode="por_fecha"
                      sportType={summary.sportType}
                      seriesDefs={seriesDefs}
                    />
                  )}
                />
                {seriesDefs.map(
                  (series) =>
                    visibleSeries[series.slot] && (
                      <Bar
                        key={series.slot}
                        dataKey={series.perMatchKey}
                        name={series.label}
                        fill={series.color}
                        maxBarSize={26}
                        isAnimationActive={false}
                      />
                    )
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Source transparency note */}
        <p className="text-[11px] text-neutral-500 border-t border-neutral-100 pt-2.5 leading-relaxed">
          {summary.source === 'eventos_partido'
            ? 'Datos exactos registrados partido a partido desde el acta arbitral oficial.'
            : summary.source === 'mixto'
            ? 'Combina actas arbitrales en vivo con totales históricos de planilla oficial para mantener el acumulado exacto de la temporada.'
            : 'Evolución distribuida sobre las fechas oficiales finalizadas para reflejar el total exacto de la planilla de temporada; los encuentros arbitrados en vivo actualizan el desglose exacto.'}
        </p>
      </div>

      {/* Discipline Breakdown Chart (Amarillas vs Rojas) when Fútbol 7 player has cards */}
      {hasCardsChart && (
        <div className="border border-neutral-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-2">
            <h4 className="font-display text-sm font-bold uppercase tracking-widest text-[#0d0d0d]">
              Registro Disciplinario por Fecha (Amarillas vs. Rojas)
            </h4>
            <div className="flex items-center gap-4 text-xs text-neutral-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 bg-[#eab308]" aria-hidden="true" />
                <span>Amarillas ({summary.totals.tarjetasAmarillas})</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 bg-[#dc2626]" aria-hidden="true" />
                <span>Rojas ({summary.totals.tarjetasRojas})</span>
              </span>
            </div>
          </div>

          <div className="w-full min-w-0 h-[150px]">
            <ResponsiveContainer width="100%" height={150} minWidth={0}>
              <BarChart
                data={summary.points}
                margin={{ top: 6, right: 16, left: -12, bottom: 2 }}
                barGap={4}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#525252', fontSize: 11 }}
                  axisLine={{ stroke: '#d4d4d4' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#525252', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#f5f6f8' }}
                  content={(tooltipProps) => (
                    <PlayerPerformanceTooltip
                      active={tooltipProps.active}
                      payload={
                        tooltipProps.payload as ReadonlyArray<TooltipPayloadItem> | undefined
                      }
                      mode="por_fecha"
                      sportType={summary.sportType}
                      seriesDefs={seriesDefs}
                    />
                  )}
                />
                <Bar
                  dataKey="tarjetasAmarillas"
                  name="Tarjetas amarillas"
                  stackId="cards"
                  fill="#eab308"
                  maxBarSize={24}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="tarjetasRojas"
                  name="Tarjetas rojas"
                  stackId="cards"
                  fill="#dc2626"
                  maxBarSize={24}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Chronological Match Breakdown Table */}
      <div className="border border-neutral-200 bg-white overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-[#f5f6f8] border-b border-neutral-200 text-neutral-500 font-medium">
              <th className="py-2.5 px-3">Fecha</th>
              <th className="py-2.5 px-3">Rival</th>
              <th className="py-2.5 px-3 text-center">Marcador</th>
              {summary.sportType === 'futbol7' ? (
                <>
                  <th className="py-2.5 px-3 text-right">Goles</th>
                  <th className="py-2.5 px-3 text-right">Asist.</th>
                  <th className="py-2.5 px-3 text-right">TA / TR</th>
                </>
              ) : summary.sportType === 'voleibol' ? (
                <>
                  <th className="py-2.5 px-3 text-right">Pts</th>
                  <th className="py-2.5 px-3 text-right">Aces</th>
                  <th className="py-2.5 px-3 text-right">Bloq.</th>
                </>
              ) : (
                <>
                  <th className="py-2.5 px-3 text-right">Pts</th>
                  <th className="py-2.5 px-3 text-right">Reb / 3P</th>
                  <th className="py-2.5 px-3 text-right">Faltas</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 tabular-nums">
            {summary.points.map((pt) => (
              <tr key={pt.matchId} className="hover:bg-[#f5f6f8]/70 transition-colors">
                <td className="py-2 px-3 font-medium text-[#0d0d0d] whitespace-nowrap">
                  {pt.label}
                  {pt.fecha && pt.fecha !== 'Temporada' && (
                    <span className="text-[11px] text-neutral-400 ml-1.5">{pt.fecha}</span>
                  )}
                </td>
                <td className="py-2 px-3 text-neutral-700 truncate max-w-[180px]">
                  {pt.opponentName}
                </td>
                <td className="py-2 px-3 text-center text-neutral-600 whitespace-nowrap">
                  {pt.teamScore !== null && pt.opponentScore !== null
                    ? `${pt.teamScore} - ${pt.opponentScore}`
                    : '—'}
                </td>
                {summary.sportType === 'futbol7' ? (
                  <>
                    <td className="py-2 px-3 text-right font-semibold text-[#707ef9]">
                      {pt.goles}
                    </td>
                    <td className="py-2 px-3 text-right text-[#0d0d0d]">{pt.asistencias}</td>
                    <td className="py-2 px-3 text-right text-neutral-700">
                      {pt.tarjetasAmarillas} / {pt.tarjetasRojas}
                    </td>
                  </>
                ) : summary.sportType === 'voleibol' ? (
                  <>
                    <td className="py-2 px-3 text-right font-semibold text-[#707ef9]">
                      {pt.puntos}
                    </td>
                    <td className="py-2 px-3 text-right text-[#0d0d0d]">{pt.aces}</td>
                    <td className="py-2 px-3 text-right text-neutral-700">{pt.bloqueos}</td>
                  </>
                ) : (
                  <>
                    <td className="py-2 px-3 text-right font-semibold text-[#707ef9]">
                      {pt.puntos}
                    </td>
                    <td className="py-2 px-3 text-right text-[#0d0d0d]">
                      {pt.rebotes} / {pt.triples}
                    </td>
                    <td className="py-2 px-3 text-right text-neutral-700">{pt.faltas}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
