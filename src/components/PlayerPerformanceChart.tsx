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
        color: '#2dd4bf',
        gradientId: 'ufroPlayerAssistsFill',
      },
      {
        slot: 'tertiary',
        label: 'Tarjetas',
        perMatchKey: 'tarjetas',
        cumulativeKey: 'acumuladoTarjetas',
        color: '#f59e0b',
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
        color: '#2dd4bf',
        gradientId: 'ufroPlayerAcesFill',
      },
      {
        slot: 'tertiary',
        label: 'Bloqueos',
        perMatchKey: 'bloqueos',
        cumulativeKey: 'acumuladoBloqueos',
        color: '#f59e0b',
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
      color: '#2dd4bf',
      gradientId: 'ufroPlayerRebFill',
    },
    {
      slot: 'tertiary',
      label: 'Faltas',
      perMatchKey: 'faltas',
      cumulativeKey: 'acumuladoFaltas',
      color: '#f59e0b',
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
    <div className="rounded-2xl bg-[#111117] text-zinc-100 border border-white/[0.14] px-4 py-3 shadow-2xl text-xs min-w-[225px]">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-1.5 mb-2">
        <span className="font-medium text-white">{point.fullLabel}</span>
        <span className="text-[11px] text-zinc-400 tabular-nums">{point.fecha}</span>
      </div>

      {point.opponentName && (
        <p className="text-zinc-300 mb-2">
          {point.teamScore !== null && point.opponentScore !== null ? (
            <>
              {point.isHome ? 'Local vs ' : 'Visita vs '}
              <strong className="text-white font-medium">{point.opponentName}</strong>
              <span className="text-zinc-500 tabular-nums">
                {' '}
                · {point.teamScore}-{point.opponentScore}
                {outcomeLabel ? ` (${outcomeLabel})` : ''}
              </span>
            </>
          ) : (
            <strong className="text-white font-medium">{point.opponentName}</strong>
          )}
        </p>
      )}

      <div className="space-y-1.5 tabular-nums">
        {seriesDefs.map((series) => {
          const perVal = Number(point[series.perMatchKey]) || 0;
          const accVal = Number(point[series.cumulativeKey]) || 0;
          return (
            <div key={series.slot} className="flex items-center justify-between gap-4">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: series.color }}
                  aria-hidden="true"
                />
                <span>
                  {series.label}
                  {mode === 'acumulado' ? ' (acum.)' : ''}
                </span>
              </span>
              <span className="text-right">
                <strong className="text-white">
                  {mode === 'acumulado' ? accVal : perVal}
                </strong>
                <span className="text-[11px] text-zinc-500 ml-1.5">
                  {mode === 'acumulado' ? `(+${perVal})` : `(acum. ${accVal})`}
                </span>
              </span>
            </div>
          );
        })}

        {sportType === 'futbol7' && (
          <div className="flex items-center justify-between gap-4 pt-1.5 mt-1.5 border-t border-white/[0.08] text-[11px] text-zinc-400">
            <span>Tarjetas ({mode === 'acumulado' ? 'acum.' : 'fecha'})</span>
            <span className="text-white">
              {mode === 'acumulado'
                ? `${point.acumuladoTarjetasAmarillas} TA · ${point.acumuladoTarjetasRojas} TR`
                : `${point.tarjetasAmarillas} TA · ${point.tarjetasRojas} TR`}
            </span>
          </div>
        )}

        {(sportType === 'basquetbol' || sportType === 'basquetbol3x3') && (
          <div className="flex items-center justify-between gap-4 pt-1.5 mt-1.5 border-t border-white/[0.08] text-[11px] text-zinc-400">
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
        className="rounded-2xl border border-white/[0.08] bg-[#101016] px-6 py-10 text-center space-y-2.5"
      >
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/[0.05] border border-white/[0.08] text-[#9aa5ff] mx-auto">
          <TrendingUp className="w-5 h-5" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-medium text-white">Sin registros en {season}</h3>
        <p className="text-xs text-zinc-500 max-w-sm mx-auto">
          Los gráficos aparecerán cuando {playerName} finalice partidos oficiales con {teamName}.
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-white/[0.08] pb-3.5">
        <div>
          <p className="text-xs text-[#a5b0ff]">
            {season} · {disciplineLabel} · {teamName}
          </p>
          <h3 className="text-xl font-medium tracking-[-0.02em] text-white mt-0.5">
            Evolución de rendimiento
          </h3>
        </div>

        <div
          role="tablist"
          aria-label="Modo de visualización de estadísticas"
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
            <span>Por partido</span>
          </button>
        </div>
      </div>

      {/* Compact 4-KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl bg-[#101016] border border-white/[0.08] p-4 tabular-nums">
        {summary.sportType === 'futbol7' ? (
          <>
            <div>
              <p className="text-xs text-zinc-500">Goles</p>
              <p className="text-2xl font-medium text-[#a5b0ff] mt-0.5">{summary.totals.goles}</p>
              <p className="text-[11px] text-zinc-500">{summary.averages.goles.toFixed(1)} / PJ</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Asistencias</p>
              <p className="text-2xl font-medium text-teal-400 mt-0.5">
                {summary.totals.asistencias}
              </p>
              <p className="text-[11px] text-zinc-500">
                {summary.averages.asistencias.toFixed(1)} / PJ
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Tarjetas</p>
              <p className="text-2xl font-medium text-white mt-0.5">
                {summary.totals.tarjetasAmarillas} / {summary.totals.tarjetasRojas}
              </p>
              <p className="text-[11px] text-zinc-500">TA / TR</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Fechas</p>
              <p className="text-2xl font-medium text-white mt-0.5">{summary.matchesCount}</p>
              <p className="text-[11px] text-zinc-500 truncate">
                {summary.bestMatch ? `Pico: ${summary.bestMatch.primaryValue}` : 'Temporada'}
              </p>
            </div>
          </>
        ) : summary.sportType === 'voleibol' ? (
          <>
            <div>
              <p className="text-xs text-zinc-500">Puntos</p>
              <p className="text-2xl font-medium text-[#a5b0ff] mt-0.5">{summary.totals.puntos}</p>
              <p className="text-[11px] text-zinc-500">{summary.averages.puntos.toFixed(1)} / PJ</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Aces</p>
              <p className="text-2xl font-medium text-teal-400 mt-0.5">{summary.totals.aces}</p>
              <p className="text-[11px] text-zinc-500">{summary.averages.aces.toFixed(1)} / PJ</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Bloqueos</p>
              <p className="text-2xl font-medium text-amber-400 mt-0.5">
                {summary.totals.bloqueos}
              </p>
              <p className="text-[11px] text-zinc-500">
                {summary.averages.bloqueos.toFixed(1)} / PJ
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Fechas</p>
              <p className="text-2xl font-medium text-white mt-0.5">{summary.matchesCount}</p>
              <p className="text-[11px] text-zinc-500 truncate">
                {summary.bestMatch ? `Pico: ${summary.bestMatch.primaryValue} pts` : 'Temporada'}
              </p>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-xs text-zinc-500">Puntos</p>
              <p className="text-2xl font-medium text-[#a5b0ff] mt-0.5">{summary.totals.puntos}</p>
              <p className="text-[11px] text-zinc-500">{summary.averages.puntos.toFixed(1)} / PJ</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Reb / 3P</p>
              <p className="text-2xl font-medium text-teal-400 mt-0.5">
                {summary.totals.rebotes} / {summary.totals.triples}
              </p>
              <p className="text-[11px] text-zinc-500">
                {summary.averages.rebotes.toFixed(1)} reb / PJ
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Faltas</p>
              <p className="text-2xl font-medium text-amber-400 mt-0.5">{summary.totals.faltas}</p>
              <p className="text-[11px] text-zinc-500">Acumuladas</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Fechas</p>
              <p className="text-2xl font-medium text-white mt-0.5">{summary.matchesCount}</p>
              <p className="text-[11px] text-zinc-500 truncate">
                {summary.bestMatch ? `Pico: ${summary.bestMatch.primaryValue} pts` : 'Temporada'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Main Recharts Container */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#101016] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-3">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar métricas del gráfico">
            {seriesDefs.map((series) => {
              const active = visibleSeries[series.slot];
              return (
                <button
                  key={series.slot}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleSeries(series.slot)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white/[0.1] text-white border-white/[0.2]'
                      : 'bg-transparent text-zinc-500 border-white/[0.08] hover:text-zinc-300'
                  }`}
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: active ? series.color : '#52525b',
                    }}
                    aria-hidden="true"
                  />
                  <span>{series.label}</span>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-zinc-500">
            {mode === 'acumulado' ? 'Progresión acumulada' : 'Por partido'}
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
                      <stop offset="5%" stopColor={series.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={series.color} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis
                  dataKey="label"
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
                        dot={{ r: 4, fill: series.color, stroke: '#101016', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: series.color, stroke: '#ffffff', strokeWidth: 2 }}
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis
                  dataKey="label"
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
                        radius={[5, 5, 0, 0]}
                        maxBarSize={26}
                        isAnimationActive={false}
                      />
                    )
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        <p className="text-[11px] text-zinc-500 border-t border-white/[0.06] pt-2.5">
          {summary.source === 'eventos_partido'
            ? 'Registrado partido a partido desde el acta arbitral.'
            : summary.source === 'mixto'
            ? 'Combina actas arbitrales con totales de planilla.'
            : 'Distribución sobre fechas finalizadas según planilla oficial.'}
        </p>
      </div>

      {hasCardsChart && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#101016] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] pb-2.5">
            <h4 className="text-xs font-medium text-zinc-200">Tarjetas por fecha</h4>
            <div className="flex items-center gap-4 text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-[#eab308]" aria-hidden="true" />
                <span>Amarillas ({summary.totals.tarjetasAmarillas})</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-[#ef4444]" aria-hidden="true" />
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#a1a1aa', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#a1a1aa', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
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
                  fill="#ef4444"
                  maxBarSize={24}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Chronological Match Breakdown Table */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#101016] overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/[0.07] text-zinc-500 font-medium">
              <th className="py-2.5 px-3.5">Fecha</th>
              <th className="py-2.5 px-3">Rival</th>
              <th className="py-2.5 px-3 text-center">Marcador</th>
              {summary.sportType === 'futbol7' ? (
                <>
                  <th className="py-2.5 px-3 text-right">Goles</th>
                  <th className="py-2.5 px-3 text-right">Asist.</th>
                  <th className="py-2.5 px-3.5 text-right">TA / TR</th>
                </>
              ) : summary.sportType === 'voleibol' ? (
                <>
                  <th className="py-2.5 px-3 text-right">Pts</th>
                  <th className="py-2.5 px-3 text-right">Aces</th>
                  <th className="py-2.5 px-3.5 text-right">Bloq.</th>
                </>
              ) : (
                <>
                  <th className="py-2.5 px-3 text-right">Pts</th>
                  <th className="py-2.5 px-3 text-right">Reb / 3P</th>
                  <th className="py-2.5 px-3.5 text-right">Faltas</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05] tabular-nums">
            {summary.points.map((pt) => (
              <tr key={pt.matchId} className="hover:bg-white/[0.03] transition-colors">
                <td className="py-2.5 px-3.5 font-medium text-white whitespace-nowrap">
                  {pt.label}
                  {pt.fecha && pt.fecha !== 'Temporada' && (
                    <span className="text-[11px] text-zinc-500 ml-1.5">{pt.fecha}</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-zinc-300 truncate max-w-[180px]">
                  {pt.opponentName}
                </td>
                <td className="py-2.5 px-3 text-center text-zinc-400 whitespace-nowrap">
                  {pt.teamScore !== null && pt.opponentScore !== null
                    ? `${pt.teamScore} - ${pt.opponentScore}`
                    : '—'}
                </td>
                {summary.sportType === 'futbol7' ? (
                  <>
                    <td className="py-2.5 px-3 text-right font-semibold text-[#a5b0ff]">
                      {pt.goles}
                    </td>
                    <td className="py-2.5 px-3 text-right text-zinc-200">{pt.asistencias}</td>
                    <td className="py-2.5 px-3.5 text-right text-zinc-400">
                      {pt.tarjetasAmarillas} / {pt.tarjetasRojas}
                    </td>
                  </>
                ) : summary.sportType === 'voleibol' ? (
                  <>
                    <td className="py-2.5 px-3 text-right font-semibold text-[#a5b0ff]">
                      {pt.puntos}
                    </td>
                    <td className="py-2.5 px-3 text-right text-zinc-200">{pt.aces}</td>
                    <td className="py-2.5 px-3.5 text-right text-zinc-400">{pt.bloqueos}</td>
                  </>
                ) : (
                  <>
                    <td className="py-2.5 px-3 text-right font-semibold text-[#a5b0ff]">
                      {pt.puntos}
                    </td>
                    <td className="py-2.5 px-3 text-right text-zinc-200">
                      {pt.rebotes} / {pt.triples}
                    </td>
                    <td className="py-2.5 px-3.5 text-right text-zinc-400">{pt.faltas}</td>
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
