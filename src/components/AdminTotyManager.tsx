import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Crown,
  LayoutGrid,
  ListOrdered,
  Minus,
  Plus,
  Radio,
  RotateCcw,
  Save,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
import {
  buildTotyFormationConfig,
  computeCommunityToty,
  formatTotyFormationSummary,
  getDefaultPositionCountsForSport,
  getEligiblePlayersForPosition,
  getPositionsForSport,
  suggestTotyFormationName,
  TOTY_FORMATION_PRESETS,
  TOTY_MAX_PER_POSITION,
  TOTY_MAX_SLOTS,
  validateDisciplineTotyConfig,
  type TotySlotResult,
} from '../domain/awardsEngine';
import type {
  DisciplineId,
  DisciplineTotyConfig,
  TournamentState,
} from '../types/tournament';
import { TeamCrest } from './TeamCrest';

interface AdminTotyManagerProps {
  state: TournamentState;
  totyLastSyncAt: string | null;
  totyRealtimeActive: boolean;
  onSaveTotyConfig: (config: DisciplineTotyConfig) => Promise<void>;
  onResetTotyConfig: (disciplineId: DisciplineId) => Promise<void>;
}

type TallyViewMode = 'summary' | 'pitch' | 'table';

function countsAreEqual(a: Record<string, number>, b: Record<string, number>, keys: string[]): boolean {
  return keys.every((k) => (a[k] ?? 0) === (b[k] ?? 0));
}

export function AdminTotyManager({
  state,
  totyLastSyncAt,
  totyRealtimeActive,
  onSaveTotyConfig,
  onResetTotyConfig,
}: AdminTotyManagerProps) {
  const [selectedDiscId, setSelectedDiscId] = useState<DisciplineId>('f7-h-1');
  const [viewMode, setViewMode] = useState<TallyViewMode>('summary');

  const discMeta = DISCIPLINE_MAP[selectedDiscId];
  const sportPositions = useMemo(
    () => getPositionsForSport(discMeta.sportType),
    [discMeta.sportType]
  );
  const sportPresets = useMemo(
    () => TOTY_FORMATION_PRESETS[discMeta.sportType] ?? [],
    [discMeta.sportType]
  );

  const savedConfig = state.totyConfigs?.[selectedDiscId] ?? null;
  const defaultCounts = useMemo(
    () => getDefaultPositionCountsForSport(discMeta.sportType),
    [discMeta.sportType]
  );
  const savedEffectiveFormation = useMemo(
    () => buildTotyFormationConfig(discMeta.sportType, savedConfig),
    [discMeta.sportType, savedConfig]
  );

  const [draftCounts, setDraftCounts] = useState<Record<string, number>>(() => {
    if (savedConfig?.positionCounts) {
      return { ...defaultCounts, ...savedConfig.positionCounts };
    }
    return { ...defaultCounts };
  });
  const [draftName, setDraftName] = useState<string>(
    () => savedConfig?.formationName || savedEffectiveFormation.formationName
  );
  const [saving, setSaving] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedActa, setCopiedActa] = useState(false);

  // Sync draft state whenever discipline or remote saved config changes
  useEffect(() => {
    const baseDefaults = getDefaultPositionCountsForSport(discMeta.sportType);
    const remote = state.totyConfigs?.[selectedDiscId];
    const effective = buildTotyFormationConfig(discMeta.sportType, remote);
    if (remote?.positionCounts) {
      const merged: Record<string, number> = {};
      for (const pos of getPositionsForSport(discMeta.sportType)) {
        merged[pos.key] = Math.max(
          0,
          Math.min(TOTY_MAX_PER_POSITION, Math.trunc(Number(remote.positionCounts[pos.key]) || 0))
        );
      }
      setDraftCounts(merged);
      setDraftName(remote.formationName || effective.formationName);
    } else {
      setDraftCounts(baseDefaults);
      setDraftName(effective.formationName);
    }
    setResetConfirmOpen(false);
    setStatusMessage(null);
    setErrorMessage(null);
  }, [selectedDiscId, discMeta.sportType, state.totyConfigs]);

  const positionKeys = useMemo(() => sportPositions.map((p) => p.key), [sportPositions]);

  const validation = useMemo(
    () => validateDisciplineTotyConfig(discMeta.sportType, draftCounts, draftName),
    [discMeta.sportType, draftCounts, draftName]
  );

  const draftConfigPreview: DisciplineTotyConfig | null = useMemo(() => {
    if (!validation.valid) return savedConfig;
    return {
      disciplineId: selectedDiscId,
      temporada: state.temporada,
      formationName: validation.sanitizedName,
      positionCounts: validation.sanitizedCounts,
    };
  }, [validation, savedConfig, selectedDiscId, state.temporada]);

  const isDirty = useMemo(() => {
    const baselineCounts = savedConfig?.positionCounts
      ? { ...defaultCounts, ...savedConfig.positionCounts }
      : defaultCounts;
    const baselineName = savedConfig?.formationName || savedEffectiveFormation.formationName;
    return (
      !countsAreEqual(draftCounts, baselineCounts, positionKeys) ||
      draftName.trim() !== baselineName.trim()
    );
  }, [draftCounts, draftName, savedConfig, defaultCounts, savedEffectiveFormation.formationName, positionKeys]);

  const matchesSportDefault = useMemo(
    () => countsAreEqual(draftCounts, defaultCounts, positionKeys),
    [draftCounts, defaultCounts, positionKeys]
  );

  const disciplinePlayers = useMemo(
    () => state.players.filter((p) => p.disciplineId === selectedDiscId),
    [state.players, selectedDiscId]
  );

  // Real-time community TOTY calculation reflecting draft formation live
  const liveToty = useMemo(
    () =>
      computeCommunityToty(
        selectedDiscId,
        discMeta.sportType,
        state.totyBallots,
        state.players,
        state.teams,
        draftConfigPreview
      ),
    [selectedDiscId, discMeta.sportType, state.totyBallots, state.players, state.teams, draftConfigPreview]
  );

  const totalBallotsAllDisciplines = state.totyBallots.length;

  const ballotsByDiscipline = useMemo(() => {
    const map = new Map<DisciplineId, number>();
    for (const d of DISCIPLINES) map.set(d.id, 0);
    for (const b of state.totyBallots) {
      map.set(b.disciplineId, (map.get(b.disciplineId) ?? 0) + 1);
    }
    return map;
  }, [state.totyBallots]);

  const filledSlotsCount = useMemo(
    () => liveToty.slots.filter((s) => Boolean(s.winner)).length,
    [liveToty.slots]
  );

  const tiedBreakdownsCount = useMemo(
    () => liveToty.positionBreakdowns.filter((b) => b.hasCutoffTie).length,
    [liveToty.positionBreakdowns]
  );

  const pitchRowsGrouped = useMemo(() => {
    const map = new Map<number, { row: number; rowLabel: string; slots: TotySlotResult[] }>();
    for (const slotRes of liveToty.slots) {
      const existing = map.get(slotRes.slot.row);
      if (existing) {
        existing.slots.push(slotRes);
      } else {
        map.set(slotRes.slot.row, {
          row: slotRes.slot.row,
          rowLabel: slotRes.slot.rowLabel,
          slots: [slotRes],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.row - a.row);
  }, [liveToty.slots]);

  const handleAdjustPositionCount = (posKey: string, delta: number) => {
    setDraftCounts((prev) => {
      const current = prev[posKey] ?? 0;
      const nextVal = Math.max(0, Math.min(TOTY_MAX_PER_POSITION, current + delta));
      if (nextVal === current) return prev;
      const next = { ...prev, [posKey]: nextVal };
      const nextTotal = positionKeys.reduce((acc, k) => acc + (next[k] ?? 0), 0);
      if (delta > 0 && nextTotal > TOTY_MAX_SLOTS) {
        return prev;
      }
      // If user hasn't typed a custom name (name matches previous auto-suggestion), update name automatically
      const prevSuggested = suggestTotyFormationName(discMeta.sportType, prev);
      if (draftName.trim() === '' || draftName.trim() === prevSuggested) {
        setDraftName(suggestTotyFormationName(discMeta.sportType, next));
      }
      return next;
    });
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleApplyPreset = (presetCounts: Record<string, number>, presetName: string) => {
    const next: Record<string, number> = {};
    for (const k of positionKeys) {
      next[k] = presetCounts[k] ?? 0;
    }
    setDraftCounts(next);
    setDraftName(presetName);
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleSave = async () => {
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Revisa la configuración de puestos.');
      return;
    }
    setSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      await onSaveTotyConfig({
        disciplineId: selectedDiscId,
        temporada: state.temporada,
        formationName: validation.sanitizedName,
        positionCounts: validation.sanitizedCounts,
        updatedAt: new Date().toISOString(),
      });
      setStatusMessage(
        `Formación "${validation.sanitizedName}" guardada en Firestore para ${discMeta.nombre}. Ya está activa en el Centro de Votaciones.`
      );
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'No se pudo guardar la configuración TOTY en Firestore.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    setSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      if (savedConfig) {
        await onResetTotyConfig(selectedDiscId);
      }
      const def = getDefaultPositionCountsForSport(discMeta.sportType);
      const defFormation = buildTotyFormationConfig(discMeta.sportType, null);
      setDraftCounts(def);
      setDraftName(defFormation.formationName);
      setResetConfirmOpen(false);
      setStatusMessage(`Se restauró la formación estándar oficial de ${discMeta.nombre}.`);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'No se pudo restaurar la formación estándar.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCopyActa = async () => {
    const lines: string[] = [
      `ACTA OFICIAL TOTY · CAMPEONATO INTERCARRERAS UFRO ${state.temporada}`,
      `Disciplina: ${discMeta.nombre}`,
      `Formación: ${liveToty.formation.formationName} (${liveToty.formation.summaryText})`,
      `Papeletas contabilizadas: ${liveToty.totalBallots}`,
      `Fecha de corte: ${new Date().toLocaleString('es-CL')}`,
      '------------------------------------------------------------',
    ];
    for (const s of liveToty.slots) {
      if (s.winner) {
        const tieNote = s.isTiedWithRunnerUp ? ' [EMPATE EN CORTE]' : '';
        lines.push(
          `${s.slot.shortCode.padEnd(6)} | ${s.slot.label.padEnd(20)} | ${s.winner.playerName} (${s.winner.teamSigla}) — ${s.winner.votes} votos (${s.winner.percentage}%)${tieNote}`
        );
      } else {
        lines.push(`${s.slot.shortCode.padEnd(6)} | ${s.slot.label.padEnd(20)} | Sin votos registrados`);
      }
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedActa(true);
      window.setTimeout(() => setCopiedActa(false), 2600);
    } catch {
      setErrorMessage('No se pudo copiar al portapapeles en este navegador.');
    }
  };

  const syncTimeFormatted = useMemo(() => {
    if (!totyLastSyncAt) return null;
    try {
      return new Date(totyLastSyncAt).toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return null;
    }
  }, [totyLastSyncAt]);

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-[#0d0d0d] text-white border border-[#0d0d0d] p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <p className="text-xs uppercase tracking-[0.2em] text-[#707ef9] font-semibold">
            Administración de Premios · Equipo Ideal (TOTY)
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight">
            Configuración de Formaciones TOTY y Escrutinio en Vivo
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl">
            Define exactamente qué posiciones y cuántos puestos componen la formación del Equipo
            Ideal de cada disciplina, y monitorea el conteo de votos en tiempo real para definir a
            los ganadores oficiales de cada puesto.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider">
              <Radio
                className={`w-3.5 h-3.5 ${
                  totyRealtimeActive ? 'text-emerald-400 animate-pulse' : 'text-neutral-400'
                }`}
              />
              <span className={totyRealtimeActive ? 'text-emerald-400' : 'text-neutral-300'}>
                {totyRealtimeActive ? 'Conteo en tiempo real' : 'Conectando Firestore'}
              </span>
            </div>
            <p className="text-[11px] font-mono text-neutral-400 mt-1 tabular-nums">
              {syncTimeFormatted
                ? `Última sincronización: ${syncTimeFormatted}`
                : 'Esperando actualización en vivo...'}
            </p>
          </div>
          <div className="border-l border-white/10 pl-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              Papeletas Totales
            </p>
            <p className="font-display text-3xl font-bold text-white tabular-nums leading-none mt-1">
              {totalBallotsAllDisciplines}
            </p>
          </div>
        </div>
      </div>

      {/* 8-Discipline Selector Strip */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase tracking-[0.18em] text-neutral-500">
            Selecciona una disciplina para configurar y escrutar
          </h3>
          <span className="text-xs text-neutral-500 font-mono tabular-nums">
            {Object.keys(state.totyConfigs ?? {}).length} / {DISCIPLINES.length} personalizadas
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {DISCIPLINES.map((disc) => {
            const isSelected = disc.id === selectedDiscId;
            const customCfg = state.totyConfigs?.[disc.id];
            const effFormation = buildTotyFormationConfig(disc.sportType, customCfg);
            const discBallotCount = ballotsByDiscipline.get(disc.id) ?? 0;

            return (
              <button
                key={disc.id}
                type="button"
                onClick={() => setSelectedDiscId(disc.id)}
                className={`text-left p-3.5 border transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'bg-[#0d0d0d] text-white border-[#0d0d0d]'
                    : 'bg-white text-[#0d0d0d] border-neutral-200 hover:border-[#707ef9]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-display text-base font-bold uppercase leading-tight">
                    {disc.nombreCorto}
                  </span>
                  {customCfg && (
                    <span
                      className={`text-[9px] font-mono uppercase px-1.5 py-0.5 shrink-0 ${
                        isSelected
                          ? 'bg-[#707ef9] text-white'
                          : 'bg-[#707ef9]/10 text-[#707ef9]'
                      }`}
                    >
                      Custom
                    </span>
                  )}
                </div>
                <div className="space-y-0.5">
                  <p
                    className={`text-[11px] font-mono truncate ${
                      isSelected ? 'text-neutral-300' : 'text-neutral-600'
                    }`}
                  >
                    {effFormation.formationName} ({effFormation.slots.length})
                  </p>
                  <p
                    className={`text-[11px] font-mono tabular-nums ${
                      isSelected ? 'text-[#707ef9]' : 'text-neutral-400'
                    }`}
                  >
                    {discBallotCount} {discBallotCount === 1 ? 'papeleta' : 'papeletas'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Formation Configurator */}
        <div className="xl:col-span-5 border border-neutral-200 bg-white">
          <div className="px-6 py-5 border-b border-neutral-200 bg-[#f5f6f8] flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#707ef9] font-semibold">
                Formación Oficial ·{' '}
                {discMeta.sportType === 'futbol7'
                  ? 'Fútbol 7'
                  : discMeta.sportType === 'basquetbol'
                  ? 'Básquetbol 5x5'
                  : discMeta.sportType === 'basquetbol3x3'
                  ? 'Básquetbol 3x3'
                  : 'Voleibol'}{' '}
                · {discMeta.rama}
              </p>
              <h3 className="font-display text-2xl font-bold uppercase text-[#0d0d0d] mt-0.5">
                {discMeta.nombre}
              </h3>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                Puestos Titulares
              </p>
              <p
                className={`font-display text-3xl font-bold tabular-nums leading-none mt-1 ${
                  validation.valid ? 'text-[#0d0d0d]' : 'text-red-600'
                }`}
              >
                {validation.totalSlots}
                <span className="text-base text-neutral-400">/{TOTY_MAX_SLOTS}</span>
              </p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Tactical Presets */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-[#0d0d0d]">
                Preajustes tácticos rápidos
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sportPresets.map((preset) => {
                  const isActivePreset = countsAreEqual(
                    draftCounts,
                    preset.positionCounts,
                    positionKeys
                  );
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset.positionCounts, preset.formationName)}
                      className={`px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
                        isActivePreset
                          ? 'bg-[#0d0d0d] text-white border-[#0d0d0d]'
                          : 'bg-white text-neutral-700 border-neutral-300 hover:border-[#707ef9] hover:text-[#0d0d0d]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Editable Formation Name */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="toty-formation-name"
                  className="text-xs font-bold uppercase tracking-wider text-[#0d0d0d]"
                >
                  Nombre de la formación
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setDraftName(suggestTotyFormationName(discMeta.sportType, draftCounts))
                  }
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#707ef9] hover:underline cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Sugerir nombre</span>
                </button>
              </div>
              <input
                id="toty-formation-name"
                type="text"
                maxLength={80}
                value={draftName}
                onChange={(e) => {
                  setDraftName(e.target.value);
                  setStatusMessage(null);
                  setErrorMessage(null);
                }}
                placeholder="Ej. Formación 1-2-2-2"
                className="w-full border border-neutral-300 px-3 py-2 text-sm text-[#0d0d0d] focus:border-[#707ef9] focus:outline-none"
              />
            </div>

            {/* Position Slot Steppers */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-[#0d0d0d]">
                  Cupos por posición
                </p>
                <span className="text-[11px] font-mono text-neutral-500">
                  Mín. 1 · Máx. {TOTY_MAX_SLOTS} puestos
                </span>
              </div>

              <div className="divide-y divide-neutral-200 border border-neutral-200">
                {sportPositions.map((pos) => {
                  const count = draftCounts[pos.key] ?? 0;
                  const { matched } = getEligiblePlayersForPosition(
                    disciplinePlayers,
                    discMeta.sportType,
                    pos.key
                  );
                  const canIncrement =
                    count < TOTY_MAX_PER_POSITION && validation.totalSlots < TOTY_MAX_SLOTS;
                  const canDecrement = count > 0;

                  return (
                    <div
                      key={pos.key}
                      className={`px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
                        count === 0 ? 'bg-neutral-50/70' : 'bg-white'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-[10px] font-bold px-1.5 py-0.5 ${
                              count > 0
                                ? pos.key === 'libero'
                                  ? 'bg-[#707ef9] text-white'
                                  : 'bg-[#0d0d0d] text-white'
                                : 'bg-neutral-200 text-neutral-500'
                            }`}
                          >
                            {pos.shortCode}
                          </span>
                          <p
                            className={`text-sm font-bold truncate ${
                              count > 0 ? 'text-[#0d0d0d]' : 'text-neutral-400'
                            }`}
                          >
                            {pos.label}
                          </p>
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-0.5 tabular-nums">
                          {matched.length}{' '}
                          {matched.length === 1 ? 'jugador registrado' : 'jugadores registrados'} en
                          esta posición
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={!canDecrement}
                          onClick={() => handleAdjustPositionCount(pos.key, -1)}
                          aria-label={`Restar cupo en ${pos.label}`}
                          className="w-8 h-8 border border-neutral-300 flex items-center justify-center text-[#0d0d0d] hover:border-[#0d0d0d] hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center font-display text-xl font-bold tabular-nums text-[#0d0d0d]">
                          {count}
                        </span>
                        <button
                          type="button"
                          disabled={!canIncrement}
                          onClick={() => handleAdjustPositionCount(pos.key, 1)}
                          aria-label={`Sumar cupo en ${pos.label}`}
                          className="w-8 h-8 border border-neutral-300 flex items-center justify-center text-[#0d0d0d] hover:border-[#707ef9] hover:bg-[#707ef9] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Formation Summary Box */}
            <div className="border border-neutral-200 bg-[#f5f6f8] px-4 py-3 space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-neutral-500">
                Resumen resultante
              </p>
              <p className="text-sm font-bold text-[#0d0d0d]">
                {validation.valid
                  ? formatTotyFormationSummary(discMeta.sportType, validation.sanitizedCounts)
                  : 'Formación incompleta'}
              </p>
              {isDirty && (
                <p className="text-[11px] font-medium text-[#707ef9]">
                  Hay cambios pendientes por guardar. El escrutinio derecho ya previsualiza cómo
                  quedarían los ganadores con esta formación.
                </p>
              )}
            </div>

            {/* Validation / Feedback Messages */}
            {!validation.valid && validation.error && (
              <div className="border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{validation.error}</span>
              </div>
            )}

            {errorMessage && (
              <div className="border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {statusMessage && (
              <div className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{statusMessage}</span>
              </div>
            )}

            {/* Save & Reset Actions */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={!validation.valid || saving || (!isDirty && Boolean(savedConfig))}
                  onClick={handleSave}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#707ef9] hover:bg-[#0d0d0d] disabled:opacity-45 text-white font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Guardando...' : 'Guardar Formación TOTY'}</span>
                </button>

                <button
                  type="button"
                  disabled={saving || (matchesSportDefault && !savedConfig && !isDirty)}
                  onClick={() => {
                    if (savedConfig) {
                      setResetConfirmOpen(true);
                    } else {
                      void handleResetToDefault();
                    }
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-3 border border-neutral-300 bg-white hover:border-[#0d0d0d] disabled:opacity-40 text-[#0d0d0d] font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Estándar</span>
                </button>
              </div>

              {resetConfirmOpen && (
                <div className="border border-neutral-300 bg-[#f5f6f8] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs text-neutral-700">
                    ¿Restaurar la formación oficial por defecto para{' '}
                    <strong>{discMeta.nombreCorto}</strong>? Las papeletas ya enviadas se
                    mantendrán intactas.
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setResetConfirmOpen(false)}
                      className="px-3 py-1.5 text-xs font-medium border border-neutral-300 bg-white text-neutral-700 hover:text-[#0d0d0d] cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleResetToDefault()}
                      className="px-3 py-1.5 text-xs font-bold uppercase bg-[#0d0d0d] text-white hover:bg-red-600 cursor-pointer"
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Real-Time Vote Tallying & Winners */}
        <div className="xl:col-span-7 border border-neutral-200 bg-white overflow-hidden">
          {/* Top KPI Strip */}
          <div className="grid grid-cols-3 border-b border-neutral-200 divide-x divide-neutral-200 bg-[#f5f6f8]">
            <div className="p-4 sm:p-5">
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-neutral-500">
                Papeletas Recibidas
              </p>
              <p className="font-display text-3xl font-bold text-[#0d0d0d] tabular-nums mt-1">
                {liveToty.totalBallots}
              </p>
            </div>
            <div className="p-4 sm:p-5">
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-neutral-500">
                Puestos Con Ganador
              </p>
              <p className="font-display text-3xl font-bold text-[#707ef9] tabular-nums mt-1">
                {filledSlotsCount}
                <span className="text-lg text-neutral-400">/{liveToty.formation.slots.length}</span>
              </p>
            </div>
            <div className="p-4 sm:p-5">
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-neutral-500">
                Empates en Corte
              </p>
              <p
                className={`font-display text-3xl font-bold tabular-nums mt-1 ${
                  tiedBreakdownsCount > 0 ? 'text-amber-600' : 'text-emerald-700'
                }`}
              >
                {tiedBreakdownsCount}
              </p>
            </div>
          </div>

          {/* Sub-Toolbar: Mode Switcher + Copy Acta */}
          <div className="px-6 py-4 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3 bg-white">
            <div className="inline-flex border border-neutral-200 bg-[#f5f6f8] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('summary')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  viewMode === 'summary'
                    ? 'bg-[#0d0d0d] text-white'
                    : 'text-neutral-600 hover:text-[#0d0d0d]'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Resumen por Puesto</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('pitch')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  viewMode === 'pitch'
                    ? 'bg-[#0d0d0d] text-white'
                    : 'text-neutral-600 hover:text-[#0d0d0d]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cancha Táctica</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-[#0d0d0d] text-white'
                    : 'text-neutral-600 hover:text-[#0d0d0d]'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span>Escrutinio Completo</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => void handleCopyActa()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-neutral-300 bg-white hover:border-[#707ef9] text-xs font-display font-bold uppercase tracking-wider text-[#0d0d0d] transition-colors cursor-pointer"
            >
              {copiedActa ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Acta Copiada</span>
                </>
              ) : (
                <>
                  <ClipboardCopy className="w-3.5 h-3.5 text-[#707ef9]" />
                  <span>Copiar Acta de Ganadores</span>
                </>
              )}
            </button>
          </div>

          {isDirty && (
            <div className="px-6 py-2.5 bg-[#707ef9]/10 border-b border-[#707ef9]/25 text-xs text-[#0d0d0d] flex items-center justify-between gap-2">
              <span>
                <strong>Vista previa de borrador:</strong> mostrando ganadores proyectados con{' '}
                <span className="font-mono">{liveToty.formation.formationName}</span>. Guarda para
                publicar esta formación.
              </span>
            </div>
          )}

          {/* MODE 1: RESUMEN POR PUESTO */}
          {viewMode === 'summary' && (
            <div className="p-6 space-y-4">
              {liveToty.totalBallots === 0 && (
                <div className="border border-neutral-200 bg-[#f5f6f8] p-6 text-center space-y-1.5">
                  <p className="font-display text-lg font-bold uppercase text-[#0d0d0d]">
                    Aún no hay papeletas TOTY en {discMeta.nombreCorto}
                  </p>
                  <p className="text-xs text-neutral-600 max-w-md mx-auto">
                    En cuanto los usuarios envíen su Equipo Ideal en el Centro de Votaciones, los
                    ganadores de cada puesto aparecerán aquí automáticamente sin recargar la página.
                  </p>
                </div>
              )}

              <div className="divide-y divide-neutral-200 border border-neutral-200">
                {liveToty.slots.map((slotRes) => {
                  const winner = slotRes.winner;
                  return (
                    <div
                      key={slotRes.slot.slotKey}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#f5f6f8]/60 transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-14 py-1.5 text-center font-mono text-[11px] font-bold shrink-0 ${
                            slotRes.slot.isLibero
                              ? 'bg-[#707ef9] text-white'
                              : 'bg-[#0d0d0d] text-white'
                          }`}
                        >
                          {slotRes.slot.shortCode}
                        </div>

                        {winner ? (
                          <div className="flex items-center gap-3 min-w-0">
                            <TeamCrest
                              escudo={winner.teamEscudo}
                              sigla={winner.teamSigla}
                              nombre={winner.teamName}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] font-mono uppercase text-neutral-500">
                                  {slotRes.slot.label}
                                </span>
                                {slotRes.isTiedWithRunnerUp && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase text-amber-700 bg-amber-100 px-1.5 py-0.5">
                                    <AlertTriangle className="w-3 h-3" />
                                    Empate en corte
                                  </span>
                                )}
                              </div>
                              <p className="font-display text-xl font-bold uppercase text-[#0d0d0d] leading-tight truncate flex items-center gap-1.5">
                                <Crown className="w-4 h-4 text-[#707ef9] shrink-0" />
                                <span className="truncate">{winner.playerName}</span>
                              </p>
                              <p className="text-xs text-neutral-500 truncate">
                                #{winner.dorsal} · {winner.teamName} ({winner.teamSigla})
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="min-w-0">
                            <p className="text-[11px] font-mono uppercase text-neutral-500">
                              {slotRes.slot.label}
                            </p>
                            <p className="text-sm text-neutral-400 flex items-center gap-1.5 mt-0.5">
                              <Users className="w-3.5 h-3.5" />
                              <span>Puesto sin votos todavía</span>
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="sm:w-44 shrink-0 space-y-1.5">
                        <div className="flex items-baseline justify-between text-xs font-mono tabular-nums">
                          <span className="font-bold text-[#0d0d0d]">
                            {winner ? `${winner.votes} ${winner.votes === 1 ? 'voto' : 'votos'}` : '0 votos'}
                          </span>
                          <span className="text-neutral-500">
                            {winner ? `${winner.percentage}%` : '0%'}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-neutral-100 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              slotRes.isTiedWithRunnerUp ? 'bg-amber-500' : 'bg-[#707ef9]'
                            }`}
                            style={{ width: `${winner ? winner.percentage : 0}%` }}
                          />
                        </div>
                        {slotRes.runnerUps.length > 0 && (
                          <p className="text-[11px] text-neutral-500 truncate">
                            Sigue: {slotRes.runnerUps[0].playerName} ({slotRes.runnerUps[0].votes} v.)
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MODE 2: CANCHA TÁCTICA EN VIVO */}
          {viewMode === 'pitch' && (
            <div className="bg-[#0d0d0d] text-white">
              <div className="px-6 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#707ef9]">
                    {liveToty.formation.formationName}
                  </p>
                  <p className="text-xs text-neutral-300 mt-0.5">
                    {liveToty.formation.summaryText}
                  </p>
                </div>
                <span className="text-xs font-mono text-neutral-400 tabular-nums">
                  {liveToty.totalBallots} papeletas
                </span>
              </div>

              <div className="relative p-5 sm:p-6 bg-[#111318] overflow-hidden">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 600 520"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-0 w-full h-full opacity-20"
                >
                  <rect
                    x="18"
                    y="18"
                    width="564"
                    height="484"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  {discMeta.sportType === 'futbol7' && (
                    <>
                      <line x1="18" y1="260" x2="582" y2="260" stroke="#ffffff" strokeWidth="1.2" />
                      <circle cx="300" cy="260" r="64" fill="none" stroke="#ffffff" strokeWidth="1.2" />
                      <rect x="170" y="18" width="260" height="82" fill="none" stroke="#ffffff" strokeWidth="1.2" />
                      <rect x="170" y="420" width="260" height="82" fill="none" stroke="#ffffff" strokeWidth="1.2" />
                    </>
                  )}
                  {(discMeta.sportType === 'basquetbol' || discMeta.sportType === 'basquetbol3x3') && (
                    <>
                      <path
                        d="M 85 18 L 85 170 A 215 215 0 0 0 515 170 L 515 18"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="1.2"
                      />
                      <rect x="215" y="18" width="170" height="175" fill="none" stroke="#ffffff" strokeWidth="1.2" />
                      <circle cx="300" cy="193" r="52" fill="none" stroke="#ffffff" strokeWidth="1.2" />
                      <line x1="18" y1="430" x2="582" y2="430" stroke="#ffffff" strokeWidth="1" strokeDasharray="6 6" />
                    </>
                  )}
                  {discMeta.sportType === 'voleibol' && (
                    <>
                      <line x1="18" y1="42" x2="582" y2="42" stroke="#707ef9" strokeWidth="2.5" />
                      <line x1="18" y1="196" x2="582" y2="196" stroke="#ffffff" strokeWidth="1.2" strokeDasharray="8 6" />
                      <line x1="18" y1="382" x2="582" y2="382" stroke="#707ef9" strokeWidth="1" strokeDasharray="4 6" />
                    </>
                  )}
                </svg>

                <div className="relative z-10 space-y-5">
                  {pitchRowsGrouped.map((rowGroup) => {
                    const colClass =
                      rowGroup.slots.length === 1
                        ? 'grid-cols-1 max-w-sm mx-auto'
                        : rowGroup.slots.length === 2
                        ? 'grid-cols-1 sm:grid-cols-2'
                        : 'grid-cols-1 sm:grid-cols-3';

                    return (
                      <div key={rowGroup.row} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="h-px flex-1 bg-white/10" />
                          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-400">
                            {rowGroup.rowLabel}
                          </span>
                          <span className="h-px flex-1 bg-white/10" />
                        </div>

                        <div className={`grid ${colClass} gap-3`}>
                          {rowGroup.slots.map((slotRes) => (
                            <div
                              key={slotRes.slot.slotKey}
                              className={`border p-3.5 flex flex-col justify-between gap-2.5 backdrop-blur-xs ${
                                slotRes.slot.isLibero
                                  ? 'border-[#707ef9] bg-[#707ef9]/15'
                                  : slotRes.isTiedWithRunnerUp
                                  ? 'border-amber-400/70 bg-[#0d0d0d]/95'
                                  : 'border-white/15 bg-[#0d0d0d]/90'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 min-w-0">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-[#707ef9] font-bold truncate">
                                  {slotRes.slot.shortCode} · {slotRes.slot.label}
                                </span>
                                <span className="text-[10px] font-mono text-neutral-400 tabular-nums shrink-0">
                                  {slotRes.winner ? `${slotRes.winner.votes} v.` : '0 v.'}
                                </span>
                              </div>

                              {slotRes.winner ? (
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <TeamCrest
                                    escudo={slotRes.winner.teamEscudo}
                                    sigla={slotRes.winner.teamSigla}
                                    nombre={slotRes.winner.teamName}
                                    size="sm"
                                    surface="dark"
                                  />
                                  <div className="min-w-0">
                                    <p className="font-display text-lg font-bold uppercase leading-tight truncate text-white">
                                      {slotRes.winner.playerName}
                                    </p>
                                    <p className="text-[11px] text-neutral-300 truncate">
                                      {slotRes.winner.teamName}
                                    </p>
                                    <p
                                      className={`text-[10px] font-mono mt-0.5 tabular-nums ${
                                        slotRes.isTiedWithRunnerUp
                                          ? 'text-amber-300'
                                          : 'text-emerald-400'
                                      }`}
                                    >
                                      {slotRes.winner.votes} votos ({slotRes.winner.percentage}%)
                                      {slotRes.isTiedWithRunnerUp ? ' · Empate' : ''}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div className="py-2 text-xs text-neutral-400 flex items-center gap-2">
                                  <Users className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                  <span>Puesto vacante</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* MODE 3: ESCRUTINIO COMPLETO POR POSICIÓN */}
          {viewMode === 'table' && (
            <div className="p-6 space-y-6">
              {liveToty.positionBreakdowns.map((group) => {
                const winnerSet = new Set(group.winnerIds);
                return (
                  <div key={group.position.key} className="border border-neutral-200">
                    <div className="px-4 py-3 bg-[#f5f6f8] border-b border-neutral-200 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-[#0d0d0d] text-white">
                          {group.position.shortCode}
                        </span>
                        <h4 className="font-display text-lg font-bold uppercase text-[#0d0d0d]">
                          {group.position.label}
                        </h4>
                        <span className="text-xs font-mono text-neutral-500">
                          · {group.slotsAllocated}{' '}
                          {group.slotsAllocated === 1 ? 'cupo titular' : 'cupos titulares'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                        {group.hasCutoffTie && (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 px-2 py-0.5 font-bold uppercase text-[10px]">
                            <AlertTriangle className="w-3 h-3" />
                            Empate en corte
                          </span>
                        )}
                        <span className="text-neutral-600">
                          {group.ballotsContributing} papeletas con voto
                        </span>
                      </div>
                    </div>

                    {group.candidates.length === 0 ? (
                      <p className="px-4 py-5 text-xs text-neutral-500">
                        Sin votos registrados en esta posición todavía.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-neutral-200 text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                              <th className="py-2.5 pl-4 pr-2 w-10">#</th>
                              <th className="py-2.5 px-2">Jugador</th>
                              <th className="py-2.5 px-2">Equipo</th>
                              <th className="py-2.5 px-2 text-right">Votos</th>
                              <th className="py-2.5 px-2 text-right w-24">%</th>
                              <th className="py-2.5 pl-2 pr-4 text-right">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 text-xs">
                            {group.candidates.map((cand, idx) => {
                              const isWinner = winnerSet.has(cand.playerId);
                              return (
                                <tr
                                  key={cand.playerId}
                                  className={isWinner ? 'bg-[#707ef9]/5' : 'bg-white'}
                                >
                                  <td className="py-2.5 pl-4 pr-2 font-mono text-neutral-500 tabular-nums">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2.5 px-2 font-bold text-[#0d0d0d]">
                                    #{cand.dorsal} {cand.playerName}
                                  </td>
                                  <td className="py-2.5 px-2 text-neutral-600">
                                    <div className="flex items-center gap-2">
                                      <TeamCrest
                                        escudo={cand.teamEscudo}
                                        sigla={cand.teamSigla}
                                        nombre={cand.teamName}
                                        size="xs"
                                      />
                                      <span className="truncate max-w-[160px]">{cand.teamName}</span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-2 text-right font-mono font-bold text-[#0d0d0d] tabular-nums">
                                    {cand.votes}
                                  </td>
                                  <td className="py-2.5 px-2 text-right font-mono text-neutral-600 tabular-nums">
                                    {cand.percentage}%
                                  </td>
                                  <td className="py-2.5 pl-2 pr-4 text-right">
                                    {isWinner ? (
                                      <span className="inline-block font-mono text-[10px] font-bold uppercase px-2 py-0.5 bg-[#0d0d0d] text-white">
                                        Ganador TOTY
                                      </span>
                                    ) : (
                                      <span className="font-mono text-[10px] uppercase text-neutral-400">
                                        En disputa
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
