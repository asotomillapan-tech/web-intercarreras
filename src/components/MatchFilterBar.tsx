import type { ReactNode } from 'react';
import { ArrowUpDown, Filter, Layers, RotateCcw, SlidersHorizontal, Users, X } from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
import {
  computeMatchFilterFacets,
  extractMatchGroups,
  type MatchGroupByMode,
  type MatchSortOrder,
} from '../domain/matchFilterEngine';
import type { DisciplineId, DisciplineMeta, Match, MatchPhase } from '../types/tournament';

export interface MatchFilterBarProps {
  matches: Match[];
  disciplineFilter: 'ALL' | DisciplineId;
  onDisciplineChange?: (value: 'ALL' | DisciplineId) => void;
  disciplineOptions?: DisciplineMeta[];
  allowAllDisciplines?: boolean;
  disciplineLocked?: boolean;
  groupFilter: 'ALL' | string;
  onGroupChange: (value: 'ALL' | string) => void;
  stageFilter: 'ALL' | MatchPhase;
  onStageChange: (value: 'ALL' | MatchPhase) => void;
  groupBy?: MatchGroupByMode;
  onGroupByChange?: (value: MatchGroupByMode) => void;
  sortOrder?: MatchSortOrder;
  onSortOrderChange?: (value: MatchSortOrder) => void;
  extraControls?: ReactNode;
  filteredCount?: number;
  totalCount?: number;
  hasExtraActiveFilters?: boolean;
  onReset?: () => void;
  idPrefix: string;
  compact?: boolean;
}

export function MatchFilterBar({
  matches,
  disciplineFilter,
  onDisciplineChange,
  disciplineOptions = DISCIPLINES,
  allowAllDisciplines = true,
  disciplineLocked = false,
  groupFilter,
  onGroupChange,
  stageFilter,
  onStageChange,
  groupBy,
  onGroupByChange,
  sortOrder,
  onSortOrderChange,
  extraControls,
  filteredCount,
  totalCount,
  hasExtraActiveFilters = false,
  onReset,
  idPrefix,
  compact = false,
}: MatchFilterBarProps) {
  const facets = computeMatchFilterFacets(matches, {
    disciplineId: disciplineFilter,
    groupName: groupFilter,
    fase: stageFilter,
  });

  const effectiveGroupValue = facets.availableGroups.includes(groupFilter) ? groupFilter : 'ALL';
  const shownCount = filteredCount ?? facets.matchingCount;
  const shownTotal = totalCount ?? facets.totalCount;

  const isDisciplineFiltered = !disciplineLocked && allowAllDisciplines && disciplineFilter !== 'ALL';
  const isGroupFiltered = effectiveGroupValue !== 'ALL';
  const isStageFiltered = stageFilter !== 'ALL';
  const isGroupByFiltered = groupBy !== undefined && groupBy !== 'none';
  const isSortOrderFiltered = sortOrder !== undefined && sortOrder !== 'newest';

  const hasActiveFilters =
    isDisciplineFiltered ||
    isGroupFiltered ||
    isStageFiltered ||
    isGroupByFiltered ||
    isSortOrderFiltered ||
    hasExtraActiveFilters;

  const handleDisciplineSelect = (nextValue: 'ALL' | DisciplineId) => {
    onDisciplineChange?.(nextValue);
    if (groupFilter !== 'ALL') {
      const nextGroups = extractMatchGroups(matches, { disciplineId: nextValue });
      if (!nextGroups.includes(groupFilter)) {
        onGroupChange('ALL');
      }
    }
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
      return;
    }
    if (!disciplineLocked && allowAllDisciplines) {
      onDisciplineChange?.('ALL');
    }
    onGroupChange('ALL');
    onStageChange('ALL');
    onGroupByChange?.('none');
    onSortOrderChange?.('newest');
  };

  const activeDisciplineLabel =
    disciplineFilter !== 'ALL'
      ? DISCIPLINE_MAP[disciplineFilter]?.nombreCorto ?? disciplineFilter
      : null;

  const selectClass =
    'w-full rounded-xl bg-[#111117] border border-white/[0.1] hover:border-white/[0.18] px-3 py-2 text-xs sm:text-sm text-zinc-100 font-normal focus:outline-none focus:border-[#707ef9] transition-colors disabled:opacity-50';

  return (
    <div
      data-match-filter-bar={idPrefix}
      className={`rounded-2xl bg-[#0c0c10] border border-white/[0.08] ${
        compact ? 'p-4 space-y-3' : 'p-5 space-y-3.5'
      }`}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[185px] flex-1">
          <label
            htmlFor={`${idPrefix}-discipline`}
            className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 mb-1.5"
          >
            <Filter className="w-3 h-3 text-[#9aa5ff]" />
            <span>Disciplina</span>
          </label>
          <select
            id={`${idPrefix}-discipline`}
            value={disciplineFilter}
            disabled={disciplineLocked || !onDisciplineChange}
            onChange={(e) => handleDisciplineSelect(e.target.value as 'ALL' | DisciplineId)}
            className={selectClass}
          >
            {allowAllDisciplines && (
              <option value="ALL">Todas ({disciplineOptions.length})</option>
            )}
            {disciplineOptions.map((d) => {
              const count = facets.disciplineCounts[d.id] ?? 0;
              return (
                <option key={d.id} value={d.id}>
                  {d.nombre} ({count})
                </option>
              );
            })}
          </select>
        </div>

        <div className="min-w-[155px] flex-1">
          <label
            htmlFor={`${idPrefix}-group`}
            className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 mb-1.5"
          >
            <Users className="w-3 h-3 text-[#9aa5ff]" />
            <span>Grupo</span>
          </label>
          <select
            id={`${idPrefix}-group`}
            value={effectiveGroupValue}
            onChange={(e) => onGroupChange(e.target.value)}
            className={selectClass}
          >
            <option value="ALL">Todos ({facets.availableGroups.length})</option>
            {facets.availableGroups.map((g) => {
              const count = facets.groupCounts[g] ?? 0;
              return (
                <option key={g} value={g}>
                  {g} ({count})
                </option>
              );
            })}
          </select>
        </div>

        <div className="min-w-[155px] flex-1">
          <label
            htmlFor={`${idPrefix}-stage`}
            className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 mb-1.5"
          >
            <Layers className="w-3 h-3 text-[#9aa5ff]" />
            <span>Fase</span>
          </label>
          <select
            id={`${idPrefix}-stage`}
            value={stageFilter}
            onChange={(e) => onStageChange(e.target.value as 'ALL' | MatchPhase)}
            className={selectClass}
          >
            <option value="ALL">Todas</option>
            {facets.availableStages.map((st) => {
              const count = facets.stageCounts[st] ?? 0;
              const label = st === 'Grupos' ? 'Fase de Grupos' : st;
              return (
                <option key={st} value={st}>
                  {label} ({count})
                </option>
              );
            })}
          </select>
        </div>

        {extraControls}

        {sortOrder !== undefined && onSortOrderChange && (
          <div className="min-w-[180px] flex-1">
            <label
              htmlFor={`${idPrefix}-sort`}
              className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 mb-1.5"
            >
              <ArrowUpDown className="w-3 h-3 text-[#9aa5ff]" />
              <span>Orden</span>
            </label>
            <select
              id={`${idPrefix}-sort`}
              value={sortOrder}
              onChange={(e) => onSortOrderChange(e.target.value as MatchSortOrder)}
              className={selectClass}
            >
              <option value="newest">Recientes / próximos</option>
              <option value="oldest">Más antiguos primero</option>
            </select>
          </div>
        )}

        {groupBy !== undefined && onGroupByChange && (
          <div className="min-w-[165px] flex-1">
            <label
              htmlFor={`${idPrefix}-groupby`}
              className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 mb-1.5"
            >
              <SlidersHorizontal className="w-3 h-3 text-[#9aa5ff]" />
              <span>Agrupar</span>
            </label>
            <select
              id={`${idPrefix}-groupby`}
              value={groupBy}
              onChange={(e) => onGroupByChange(e.target.value as MatchGroupByMode)}
              className={selectClass}
            >
              <option value="none">Lista continua</option>
              {allowAllDisciplines && !disciplineLocked && (
                <option value="disciplina">Por disciplina</option>
              )}
              <option value="fase">Por fase</option>
              <option value="grupo">Por grupo</option>
            </select>
          </div>
        )}

        <div className="shrink-0">
          <button
            type="button"
            onClick={handleReset}
            disabled={!hasActiveFilters}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] hover:border-white/25 text-xs font-medium text-zinc-200 cursor-pointer disabled:opacity-35 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpiar</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-white/[0.06] text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-zinc-500 tabular-nums">
            <strong className="text-zinc-200 font-medium">{shownCount}</strong> de{' '}
            <strong className="text-zinc-200 font-medium">{shownTotal}</strong> partidos
          </span>

          {isDisciplineFiltered && activeDisciplineLabel && (
            <button
              type="button"
              onClick={() => handleDisciplineSelect('ALL')}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/[0.08] border border-white/[0.12] text-zinc-100 text-[11px] hover:border-white/30 transition-colors cursor-pointer"
              title="Quitar filtro de disciplina"
            >
              <span>{activeDisciplineLabel}</span>
              <X className="w-3 h-3" />
            </button>
          )}

          {isGroupFiltered && (
            <button
              type="button"
              onClick={() => onGroupChange('ALL')}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#707ef9]/20 border border-[#707ef9]/35 text-[#c7ceff] text-[11px] hover:bg-[#707ef9]/30 transition-colors cursor-pointer"
              title="Quitar filtro de grupo"
            >
              <span>{effectiveGroupValue}</span>
              <X className="w-3 h-3" />
            </button>
          )}

          {isStageFiltered && (
            <button
              type="button"
              onClick={() => onStageChange('ALL')}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/[0.08] border border-white/[0.12] text-zinc-100 text-[11px] hover:border-white/30 transition-colors cursor-pointer"
              title="Quitar filtro de fase"
            >
              <span>{stageFilter === 'Grupos' ? 'Fase de Grupos' : stageFilter}</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
