import type { ReactNode } from 'react';
import { Filter, Layers, RotateCcw, SlidersHorizontal, Users, X } from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
import {
  computeMatchFilterFacets,
  extractMatchGroups,
  type MatchGroupByMode,
} from '../domain/matchFilterEngine';
import type { DisciplineId, DisciplineMeta, Match, MatchPhase } from '../types/tournament';

export interface MatchFilterBarProps {
  matches: Match[];
  disciplineFilter: 'ALL' | DisciplineId;
  onDisciplineChange?: (value: 'ALL' | DisciplineId) => void;
  /** Optional custom list of disciplines (e.g. referee-authorized disciplines or a single team's discipline). */
  disciplineOptions?: DisciplineMeta[];
  /** Whether to include "Todas las disciplinas" option. Defaults to true. */
  allowAllDisciplines?: boolean;
  /** Locks the discipline selector visually when viewing a single fixed discipline/team. */
  disciplineLocked?: boolean;
  groupFilter: 'ALL' | string;
  onGroupChange: (value: 'ALL' | string) => void;
  stageFilter: 'ALL' | MatchPhase;
  onStageChange: (value: 'ALL' | MatchPhase) => void;
  groupBy?: MatchGroupByMode;
  onGroupByChange?: (value: MatchGroupByMode) => void;
  /** Optional additional dropdowns/inputs (e.g. Sede/Cancha, Estado, Búsqueda) rendered inside the same bar. */
  extraControls?: ReactNode;
  /** Optional override for displayed filtered count when parent applies additional filters (e.g. venue/status/search). */
  filteredCount?: number;
  /** Optional override for total count. Defaults to matches.length. */
  totalCount?: number;
  /** Whether extra parent filters are active (keeps the Limpiar button enabled). */
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

  const hasActiveFilters =
    isDisciplineFiltered ||
    isGroupFiltered ||
    isStageFiltered ||
    isGroupByFiltered ||
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
  };

  const activeDisciplineLabel =
    disciplineFilter !== 'ALL'
      ? DISCIPLINE_MAP[disciplineFilter]?.nombreCorto ?? disciplineFilter
      : null;

  return (
    <div
      data-match-filter-bar={idPrefix}
      className={`bg-[#f5f6f8] border border-neutral-200 ${compact ? 'p-3.5 space-y-3' : 'p-4 space-y-3.5'}`}
    >
      {/* Main Dropdown Selectors Row */}
      <div className="flex flex-wrap items-end gap-3">
        {/* 1. DISCIPLINA */}
        <div className="min-w-[195px] flex-1">
          <label
            htmlFor={`${idPrefix}-discipline`}
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-600 mb-1"
          >
            <Filter className="w-3 h-3 text-[#707ef9]" />
            <span>Disciplina</span>
          </label>
          <select
            id={`${idPrefix}-discipline`}
            value={disciplineFilter}
            disabled={disciplineLocked || !onDisciplineChange}
            onChange={(e) => handleDisciplineSelect(e.target.value as 'ALL' | DisciplineId)}
            className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs sm:text-sm text-[#0d0d0d] font-medium focus:outline-none focus:border-[#707ef9] disabled:bg-neutral-100 disabled:text-neutral-600"
          >
            {allowAllDisciplines && (
              <option value="ALL">
                Todas las disciplinas ({disciplineOptions.length})
              </option>
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

        {/* 2. GRUPO */}
        <div className="min-w-[160px] flex-1">
          <label
            htmlFor={`${idPrefix}-group`}
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-600 mb-1"
          >
            <Users className="w-3 h-3 text-[#707ef9]" />
            <span>Grupo</span>
          </label>
          <select
            id={`${idPrefix}-group`}
            value={effectiveGroupValue}
            onChange={(e) => onGroupChange(e.target.value)}
            className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs sm:text-sm text-[#0d0d0d] font-medium focus:outline-none focus:border-[#707ef9]"
          >
            <option value="ALL">Todos los grupos ({facets.availableGroups.length})</option>
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

        {/* 3. FASE */}
        <div className="min-w-[160px] flex-1">
          <label
            htmlFor={`${idPrefix}-stage`}
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-600 mb-1"
          >
            <Layers className="w-3 h-3 text-[#707ef9]" />
            <span>Fase</span>
          </label>
          <select
            id={`${idPrefix}-stage`}
            value={stageFilter}
            onChange={(e) => onStageChange(e.target.value as 'ALL' | MatchPhase)}
            className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs sm:text-sm text-[#0d0d0d] font-medium focus:outline-none focus:border-[#707ef9]"
          >
            <option value="ALL">Todas las fases</option>
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

        {/* 4. OPTIONAL EXTRA CONTROLS (Sede, Estado, etc.) */}
        {extraControls}

        {/* 5. OPTIONAL ORGANIZE BY */}
        {groupBy !== undefined && onGroupByChange && (
          <div className="min-w-[170px] flex-1">
            <label
              htmlFor={`${idPrefix}-groupby`}
              className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-600 mb-1"
            >
              <SlidersHorizontal className="w-3 h-3 text-[#707ef9]" />
              <span>Organizar por</span>
            </label>
            <select
              id={`${idPrefix}-groupby`}
              value={groupBy}
              onChange={(e) => onGroupByChange(e.target.value as MatchGroupByMode)}
              className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs sm:text-sm text-[#0d0d0d] font-medium focus:outline-none focus:border-[#707ef9]"
            >
              <option value="none">Orden cronológico</option>
              {allowAllDisciplines && !disciplineLocked && (
                <option value="disciplina">Agrupar por Disciplina</option>
              )}
              <option value="fase">Agrupar por Fase</option>
              <option value="grupo">Agrupar por Grupo</option>
            </select>
          </div>
        )}

        {/* RESET BUTTON */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={handleReset}
            disabled={!hasActiveFilters}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-neutral-300 hover:border-[#0d0d0d] text-xs font-medium text-[#0d0d0d] cursor-pointer disabled:opacity-40 whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpiar</span>
          </button>
        </div>
      </div>

      {/* Dynamic Active Filters & Results Counter Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-neutral-200/80 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-600 tabular-nums">
            Mostrando <strong className="text-[#0d0d0d]">{shownCount}</strong> de{' '}
            <strong className="text-[#0d0d0d]">{shownTotal}</strong> partidos
          </span>

          {isDisciplineFiltered && activeDisciplineLabel && (
            <button
              type="button"
              onClick={() => handleDisciplineSelect('ALL')}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#0d0d0d] text-white text-[11px] font-medium hover:bg-[#707ef9] transition-colors cursor-pointer"
              title="Quitar filtro de disciplina"
            >
              <span>Disciplina: {activeDisciplineLabel}</span>
              <X className="w-3 h-3" />
            </button>
          )}

          {isGroupFiltered && (
            <button
              type="button"
              onClick={() => onGroupChange('ALL')}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#707ef9] text-white text-[11px] font-medium hover:bg-[#0d0d0d] transition-colors cursor-pointer"
              title="Quitar filtro de grupo"
            >
              <span>Grupo: {effectiveGroupValue}</span>
              <X className="w-3 h-3" />
            </button>
          )}

          {isStageFiltered && (
            <button
              type="button"
              onClick={() => onStageChange('ALL')}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-[#0d0d0d] text-[#0d0d0d] text-[11px] font-medium hover:bg-[#0d0d0d] hover:text-white transition-colors cursor-pointer"
              title="Quitar filtro de fase"
            >
              <span>Fase: {stageFilter === 'Grupos' ? 'Fase de Grupos' : stageFilter}</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
