import { Filter, Layers, RotateCcw, Users } from 'lucide-react';
import { DISCIPLINES } from '../data/ufroSeed';
import {
  extractMatchGroups,
  extractMatchStages,
  MATCH_STAGE_ORDER,
  type MatchGroupByMode,
} from '../domain/matchFilterEngine';
import type { DisciplineId, Match, MatchPhase } from '../types/tournament';

interface MatchFilterBarProps {
  matches: Match[];
  /** Pass to render the Discipline selector inside the bar. Omit when parent already has a Discipline switcher. */
  disciplineFilter?: 'ALL' | DisciplineId;
  onDisciplineChange?: (value: 'ALL' | DisciplineId) => void;
  /** Fixed discipline scope used to compute available groups/stages when discipline selector is external. */
  scopedDiscipline?: 'ALL' | DisciplineId;
  groupFilter: 'ALL' | string;
  onGroupChange: (value: 'ALL' | string) => void;
  stageFilter: 'ALL' | MatchPhase;
  onStageChange: (value: 'ALL' | MatchPhase) => void;
  groupBy?: MatchGroupByMode;
  onGroupByChange?: (value: MatchGroupByMode) => void;
  onReset?: () => void;
  idPrefix: string;
  compact?: boolean;
}

export function MatchFilterBar({
  matches,
  disciplineFilter,
  onDisciplineChange,
  scopedDiscipline,
  groupFilter,
  onGroupChange,
  stageFilter,
  onStageChange,
  groupBy,
  onGroupByChange,
  onReset,
  idPrefix,
  compact = false,
}: MatchFilterBarProps) {
  const effectiveDiscipline = disciplineFilter ?? scopedDiscipline ?? 'ALL';

  const availableGroups = extractMatchGroups(matches, {
    disciplineId: effectiveDiscipline,
  });

  const presentStages = extractMatchStages(matches, {
    disciplineId: effectiveDiscipline,
  });
  const stageOptions = presentStages.length > 0 ? presentStages : MATCH_STAGE_ORDER;

  const hasActiveFilters =
    (disciplineFilter !== undefined && disciplineFilter !== 'ALL') ||
    groupFilter !== 'ALL' ||
    stageFilter !== 'ALL' ||
    (groupBy !== undefined && groupBy !== 'none');

  const handleReset = () => {
    if (onReset) {
      onReset();
      return;
    }
    onDisciplineChange?.('ALL');
    onGroupChange('ALL');
    onStageChange('ALL');
    onGroupByChange?.('none');
  };

  return (
    <div
      className={`bg-[#f5f6f8] border border-neutral-200 ${
        compact ? 'p-3' : 'p-4'
      } flex flex-wrap items-end gap-3`}
    >
      {disciplineFilter !== undefined && onDisciplineChange && (
        <div className="min-w-[190px] flex-1">
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
            onChange={(e) => {
              onDisciplineChange(e.target.value as 'ALL' | DisciplineId);
              onGroupChange('ALL');
            }}
            className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs sm:text-sm text-[#0d0d0d] font-medium focus:outline-none focus:border-[#707ef9]"
          >
            <option value="ALL">Todas las disciplinas ({DISCIPLINES.length})</option>
            {DISCIPLINES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="min-w-[155px] flex-1">
        <label
          htmlFor={`${idPrefix}-group`}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-600 mb-1"
        >
          <Users className="w-3 h-3 text-[#707ef9]" />
          <span>Grupo</span>
        </label>
        <select
          id={`${idPrefix}-group`}
          value={availableGroups.includes(groupFilter) ? groupFilter : 'ALL'}
          onChange={(e) => onGroupChange(e.target.value)}
          className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs sm:text-sm text-[#0d0d0d] font-medium focus:outline-none focus:border-[#707ef9]"
        >
          <option value="ALL">Todos los grupos ({availableGroups.length})</option>
          {availableGroups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-[155px] flex-1">
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
          {stageOptions.map((st) => (
            <option key={st} value={st}>
              {st === 'Grupos' ? 'Fase de Grupos' : st}
            </option>
          ))}
        </select>
      </div>

      {groupBy !== undefined && onGroupByChange && (
        <div className="min-w-[165px] flex-1">
          <label
            htmlFor={`${idPrefix}-groupby`}
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-600 mb-1"
          >
            <Layers className="w-3 h-3 text-[#707ef9]" />
            <span>Organizar por</span>
          </label>
          <select
            id={`${idPrefix}-groupby`}
            value={groupBy}
            onChange={(e) => onGroupByChange(e.target.value as MatchGroupByMode)}
            className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs sm:text-sm text-[#0d0d0d] font-medium focus:outline-none focus:border-[#707ef9]"
          >
            <option value="none">Orden cronológico</option>
            {disciplineFilter !== undefined && (
              <option value="disciplina">Agrupar por Disciplina</option>
            )}
            <option value="fase">Agrupar por Fase</option>
            <option value="grupo">Agrupar por Grupo</option>
          </select>
        </div>
      )}

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
  );
}
