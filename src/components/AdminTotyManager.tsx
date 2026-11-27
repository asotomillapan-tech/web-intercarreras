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
import { formatDorsalLabel } from '../domain/attendanceEngine';
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
  }, [
    draftCounts,
    draftName,
    savedConfig,
    defaultCounts,
    savedEffectiveFormation.formationName,
    positionKeys,
  ]);

  const matchesSportDefault = useMemo(
    () => countsAreEqual(draftCounts, defaultCounts, positionKeys),
    [draftCounts, defaultCounts, positionKeys]
  );

  const disciplinePlayers = useMemo(
    () => state.players.filter((p) => p.disciplineId === selectedDiscId),
    [state.players, selectedDiscId]
  );

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
    [
      selectedDiscId,
      discMeta.sportType,
      state.totyBallots,
      state.players,
      state.teams,
      draftConfigPreview,
    ]
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
      if (existing) existing.slots.push(slotRes);
      else {
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
      if (delta > 0 && nextTotal > TOTY_MAX_SLOTS) return prev;
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
    for (const k of positionKeys) next[k] = presetCounts[k] ?? 0;
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
        `Formación "${validation.sanitizedName}" guardada para ${discMeta.nombre}.`
      );
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'No se pudo guardar la configuración TOTY.'
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
      if (savedConfig) await onResetTotyConfig(selectedDiscId);
      const def = getDefaultPositionCountsForSport(discMeta.sportType);
      const defFormation = buildTotyFormationConfig(discMeta.sportType, null);
      setDraftCounts(def);
      setDraftName(defFormation.formationName);
      setResetConfirmOpen(false);
      setStatusMessage(`Se restauró la formación estándar de ${discMeta.nombre}.`);
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
        lines.push(
          `${s.slot.shortCode.padEnd(6)} | ${s.slot.label.padEnd(20)} | Sin votos registrados`
        );
      }
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedActa(true);
      window.setTimeout(() => setCopiedActa(false), 2600);
    } catch {
      setErrorMessage('No se pudo copiar al portapapeles.');
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
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#101016] p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#a5b0ff]">
            TOTYs · Escrutinio en Vivo
          </p>
          <h2 className="text-2xl sm:text-3xl font-medium tracking-[-0.025em] text-white">
            Formaciones{' '}
            <span className="font-editorial italic font-normal text-[#c8ceff]">TOTYs</span>
          </h2>
          <p className="text-xs text-zinc-400 max-w-xl">
            Configura los puestos titulares de los TOTYs por disciplina y revisa el escrutinio en
            tiempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 shrink-0 border-t lg:border-t-0 lg:border-l border-white/[0.08] pt-4 lg:pt-0 lg:pl-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <Radio
                className={`w-3.5 h-3.5 ${
                  totyRealtimeActive ? 'text-emerald-400 animate-pulse' : 'text-zinc-500'
                }`}
              />
              <span className={totyRealtimeActive ? 'text-emerald-300' : 'text-zinc-400'}>
                {totyRealtimeActive ? 'En tiempo real' : 'Conectando'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1 tabular-nums">
              {syncTimeFormatted ? `Sync ${syncTimeFormatted}` : 'Esperando votos...'}
            </p>
          </div>
          <div className="border-l border-white/[0.08] pl-4">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Papeletas</p>
            <p className="text-2xl font-medium text-white tabular-nums leading-none mt-1">
              {totalBallotsAllDisciplines}
            </p>
          </div>
        </div>
      </div>

      {/* 8-Discipline Selector Strip */}
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
              className={`text-left p-3.5 rounded-2xl border transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                isSelected
                  ? 'bg-white text-[#050507] border-white'
                  : 'bg-[#101016] text-white border-white/[0.08] hover:border-white/[0.22]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold leading-tight">{disc.nombreCorto}</span>
                {customCfg && (
                  <span
                    className={`text-[9px] uppercase px-1.5 py-0.5 rounded-full shrink-0 ${
                      isSelected
                        ? 'bg-[#707ef9] text-white'
                        : 'bg-[#707ef9]/20 text-[#c8ceff]'
                    }`}
                  >
                    Custom
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                <p
                  className={`text-[11px] truncate ${
                    isSelected ? 'text-zinc-600' : 'text-zinc-400'
                  }`}
                >
                  {effFormation.formationName} ({effFormation.slots.length})
                </p>
                <p
                  className={`text-[11px] font-mono tabular-nums ${
                    isSelected ? 'text-[#5766eb]' : 'text-zinc-500'
                  }`}
                >
                  {discBallotCount} {discBallotCount === 1 ? 'papeleta' : 'papeletas'}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Formation Configurator */}
        <div className="xl:col-span-5 rounded-3xl border border-white/[0.08] bg-[#0c0c10] overflow-hidden">
          <div className="px-6 py-5 border-b border-white/[0.08] bg-[#101016] flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#a5b0ff]">
                {discMeta.rama}
              </p>
              <h3 className="text-lg font-medium text-white mt-0.5">{discMeta.nombre}</h3>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Puestos</p>
              <p
                className={`text-2xl font-medium tabular-nums leading-none mt-1 ${
                  validation.valid ? 'text-white' : 'text-red-400'
                }`}
              >
                {validation.totalSlots}
                <span className="text-sm text-zinc-500">/{TOTY_MAX_SLOTS}</span>
              </p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <p className="text-xs text-zinc-400">Preajustes tácticos</p>
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
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                        isActivePreset
                          ? 'bg-white text-[#050507] border-white'
                          : 'bg-white/[0.04] text-zinc-300 border-white/[0.1] hover:border-white/[0.25]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="toty-formation-name" className="text-xs text-zinc-400">
                  Nombre de la formación
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setDraftName(suggestTotyFormationName(discMeta.sportType, draftCounts))
                  }
                  className="inline-flex items-center gap-1 text-[11px] text-[#a5b0ff] hover:text-white cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Sugerir</span>
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
                className="w-full rounded-xl bg-[#050507] border border-white/[0.1] px-3.5 py-2 text-sm text-white focus:border-[#707ef9] focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400">Cupos por posición</p>
                <span className="text-[11px] text-zinc-500">Máx. {TOTY_MAX_SLOTS}</span>
              </div>

              <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] overflow-hidden">
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
                      className={`px-4 py-3 flex items-center justify-between gap-3 ${
                        count === 0 ? 'bg-[#050507]/60' : 'bg-[#101016]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${
                              count > 0
                                ? pos.key === 'libero'
                                  ? 'bg-[#707ef9] text-white'
                                  : 'bg-white text-[#050507]'
                                : 'bg-white/[0.06] text-zinc-500'
                            }`}
                          >
                            {pos.shortCode}
                          </span>
                          <p
                            className={`text-xs font-medium truncate ${
                              count > 0 ? 'text-white' : 'text-zinc-500'
                            }`}
                          >
                            {pos.label}
                          </p>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5 tabular-nums">
                          {matched.length} registrados
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={!canDecrement}
                          onClick={() => handleAdjustPositionCount(pos.key, -1)}
                          aria-label={`Restar cupo en ${pos.label}`}
                          className="w-7 h-7 rounded-full border border-white/[0.12] flex items-center justify-center text-zinc-300 hover:bg-white/[0.1] disabled:opacity-30 cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center text-base font-medium tabular-nums text-white">
                          {count}
                        </span>
                        <button
                          type="button"
                          disabled={!canIncrement}
                          onClick={() => handleAdjustPositionCount(pos.key, 1)}
                          aria-label={`Sumar cupo en ${pos.label}`}
                          className="w-7 h-7 rounded-full border border-white/[0.12] flex items-center justify-center text-zinc-300 hover:bg-[#707ef9] hover:border-[#707ef9] hover:text-white disabled:opacity-30 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#101016] px-4 py-3 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Resumen</p>
              <p className="text-xs font-medium text-white">
                {validation.valid
                  ? formatTotyFormationSummary(discMeta.sportType, validation.sanitizedCounts)
                  : 'Formación incompleta'}
              </p>
              {isDirty && (
                <p className="text-[11px] text-[#a5b0ff]">Cambios pendientes por guardar.</p>
              )}
            </div>

            {!validation.valid && validation.error && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <span>{validation.error}</span>
              </div>
            )}

            {errorMessage && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {statusMessage && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <span>{statusMessage}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={!validation.valid || saving || (!isDirty && Boolean(savedConfig))}
                  onClick={handleSave}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#707ef9] hover:bg-[#5c6bf0] disabled:opacity-40 text-xs font-medium text-white transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Guardando...' : 'Guardar formación'}</span>
                </button>

                <button
                  type="button"
                  disabled={saving || (matchesSportDefault && !savedConfig && !isDirty)}
                  onClick={() => {
                    if (savedConfig) setResetConfirmOpen(true);
                    else void handleResetToDefault();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-35 text-xs font-medium text-zinc-200 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Estándar</span>
                </button>
              </div>

              {resetConfirmOpen && (
                <div className="rounded-2xl border border-white/[0.12] bg-[#101016] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs text-zinc-300">
                    ¿Restaurar formación estándar de <strong>{discMeta.nombreCorto}</strong>?
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setResetConfirmOpen(false)}
                      className="px-3 py-1.5 rounded-full border border-white/[0.12] text-xs text-zinc-300 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleResetToDefault()}
                      className="px-3 py-1.5 rounded-full bg-red-500/80 hover:bg-red-500 text-xs font-medium text-white cursor-pointer"
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Real-Time Vote Tallying */}
        <div className="xl:col-span-7 rounded-3xl border border-white/[0.08] bg-[#0c0c10] overflow-hidden">
          <div className="grid grid-cols-3 border-b border-white/[0.08] divide-x divide-white/[0.08] bg-[#101016]">
            <div className="p-4 sm:p-5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Papeletas</p>
              <p className="text-2xl font-medium text-white tabular-nums mt-1">
                {liveToty.totalBallots}
              </p>
            </div>
            <div className="p-4 sm:p-5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Con ganador</p>
              <p className="text-2xl font-medium text-[#a5b0ff] tabular-nums mt-1">
                {filledSlotsCount}
                <span className="text-sm text-zinc-500">/{liveToty.formation.slots.length}</span>
              </p>
            </div>
            <div className="p-4 sm:p-5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Empates</p>
              <p
                className={`text-2xl font-medium tabular-nums mt-1 ${
                  tiedBreakdownsCount > 0 ? 'text-amber-300' : 'text-emerald-300'
                }`}
              >
                {tiedBreakdownsCount}
              </p>
            </div>
          </div>

          <div className="px-5 py-4 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-full bg-[#050507] border border-white/[0.08] p-1">
              {(
                [
                  { id: 'summary', icon: Trophy, label: 'Resumen' },
                  { id: 'pitch', icon: LayoutGrid, label: 'Cancha' },
                  { id: 'table', icon: ListOrdered, label: 'Escrutinio' },
                ] as const
              ).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setViewMode(id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    viewMode === id
                      ? 'bg-white text-[#050507]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void handleCopyActa()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] hover:border-[#707ef9] text-xs font-medium text-zinc-200 cursor-pointer"
            >
              {copiedActa ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copiada</span>
                </>
              ) : (
                <>
                  <ClipboardCopy className="w-3.5 h-3.5 text-[#a5b0ff]" />
                  <span>Copiar acta</span>
                </>
              )}
            </button>
          </div>

          {viewMode === 'summary' && (
            <div className="p-5 space-y-4">
              {liveToty.totalBallots === 0 && (
                <div className="rounded-2xl border border-white/[0.08] bg-[#101016] p-6 text-center space-y-1">
                  <p className="text-sm font-medium text-white">
                    Sin papeletas en {discMeta.nombreCorto}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Los ganadores aparecerán aquí en vivo al recibir votos.
                  </p>
                </div>
              )}

              <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] overflow-hidden">
                {liveToty.slots.map((slotRes) => {
                  const winner = slotRes.winner;
                  return (
                    <div
                      key={slotRes.slot.slotKey}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-12 py-1.5 rounded-full text-center font-mono text-[10px] shrink-0 ${
                            slotRes.slot.isLibero
                              ? 'bg-[#707ef9] text-white'
                              : 'bg-white/[0.08] text-zinc-200'
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
                                <span className="text-[11px] text-zinc-500">
                                  {slotRes.slot.label}
                                </span>
                                {slotRes.isTiedWithRunnerUp && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full">
                                    <AlertTriangle className="w-3 h-3" />
                                    Empate
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-medium text-white truncate flex items-center gap-1.5">
                                <Crown className="w-3.5 h-3.5 text-[#a5b0ff] shrink-0" />
                                <span className="truncate">{winner.playerName}</span>
                              </p>
                              <p className="text-xs text-zinc-500 truncate">
                                {formatDorsalLabel(winner.dorsal)} · {winner.teamName}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="min-w-0">
                            <p className="text-[11px] text-zinc-500">{slotRes.slot.label}</p>
                            <p className="text-xs text-zinc-500 flex items-center gap-1.5 mt-0.5">
                              <Users className="w-3.5 h-3.5" />
                              <span>Sin votos todavía</span>
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="sm:w-44 shrink-0 space-y-1.5">
                        <div className="flex items-baseline justify-between text-xs font-mono tabular-nums">
                          <span className="text-white">
                            {winner ? `${winner.votes} v.` : '0 v.'}
                          </span>
                          <span className="text-zinc-500">
                            {winner ? `${winner.percentage}%` : '0%'}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              slotRes.isTiedWithRunnerUp ? 'bg-amber-400' : 'bg-[#707ef9]'
                            }`}
                            style={{ width: `${winner ? winner.percentage : 0}%` }}
                          />
                        </div>
                        {slotRes.runnerUps.length > 0 && (
                          <p className="text-[11px] text-zinc-500 truncate">
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

          {viewMode === 'pitch' && (
            <div className="bg-[#050507] text-white">
              <div className="px-5 py-3.5 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] text-[#a5b0ff] font-medium">
                    {liveToty.formation.formationName}
                  </p>
                  <p className="text-xs text-zinc-400">{liveToty.formation.summaryText}</p>
                </div>
                <span className="text-xs font-mono text-zinc-500 tabular-nums">
                  {liveToty.totalBallots} papeletas
                </span>
              </div>

              <div className="relative p-5 bg-[#0a0a0f] overflow-hidden">
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
                          <span className="h-px flex-1 bg-white/[0.08]" />
                          <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                            {rowGroup.rowLabel}
                          </span>
                          <span className="h-px flex-1 bg-white/[0.08]" />
                        </div>

                        <div className={`grid ${colClass} gap-3`}>
                          {rowGroup.slots.map((slotRes) => (
                            <div
                              key={slotRes.slot.slotKey}
                              className={`rounded-2xl border p-3.5 flex flex-col justify-between gap-2.5 ${
                                slotRes.slot.isLibero
                                  ? 'border-[#707ef9]/60 bg-[#707ef9]/15'
                                  : slotRes.isTiedWithRunnerUp
                                  ? 'border-amber-400/50 bg-[#101016]'
                                  : 'border-white/[0.1] bg-[#101016]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 min-w-0">
                                <span className="text-[10px] font-mono uppercase text-[#a5b0ff] truncate">
                                  {slotRes.slot.shortCode} · {slotRes.slot.label}
                                </span>
                                <span className="text-[10px] font-mono text-zinc-500 tabular-nums shrink-0">
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
                                    <p className="text-sm font-medium leading-tight truncate text-white">
                                      {slotRes.winner.playerName}
                                    </p>
                                    <p className="text-[11px] text-zinc-400 truncate">
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
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div className="py-2 text-xs text-zinc-500 flex items-center gap-2">
                                  <Users className="w-3.5 h-3.5 shrink-0" />
                                  <span>Vacante</span>
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

          {viewMode === 'table' && (
            <div className="p-5 space-y-5">
              {liveToty.positionBreakdowns.map((group) => {
                const winnerSet = new Set(group.winnerIds);
                return (
                  <div
                    key={group.position.key}
                    className="rounded-2xl border border-white/[0.08] overflow-hidden"
                  >
                    <div className="px-4 py-3 bg-[#101016] border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-white text-[#050507]">
                          {group.position.shortCode}
                        </span>
                        <h4 className="text-sm font-medium text-white">{group.position.label}</h4>
                        <span className="text-xs text-zinc-500">
                          · {group.slotsAllocated} cupo{group.slotsAllocated === 1 ? '' : 's'}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-zinc-400 tabular-nums">
                        {group.ballotsContributing} papeletas
                      </span>
                    </div>

                    {group.candidates.length === 0 ? (
                      <p className="px-4 py-5 text-xs text-zinc-500">Sin votos en esta posición.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-zinc-500">
                              <th className="py-2.5 pl-4 pr-2 w-10">#</th>
                              <th className="py-2.5 px-2">Jugador</th>
                              <th className="py-2.5 px-2">Equipo</th>
                              <th className="py-2.5 px-2 text-right">Votos</th>
                              <th className="py-2.5 px-2 text-right w-20">%</th>
                              <th className="py-2.5 pl-2 pr-4 text-right">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.05]">
                            {group.candidates.map((cand, idx) => {
                              const isWinner = winnerSet.has(cand.playerId);
                              return (
                                <tr
                                  key={cand.playerId}
                                  className={isWinner ? 'bg-[#707ef9]/[0.08]' : ''}
                                >
                                  <td className="py-2.5 pl-4 pr-2 font-mono text-zinc-500 tabular-nums">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2.5 px-2 font-medium text-white">
                                    {formatDorsalLabel(cand.dorsal)} {cand.playerName}
                                  </td>
                                  <td className="py-2.5 px-2 text-zinc-400">
                                    <div className="flex items-center gap-2">
                                      <TeamCrest
                                        escudo={cand.teamEscudo}
                                        sigla={cand.teamSigla}
                                        nombre={cand.teamName}
                                        size="xs"
                                      />
                                      <span className="truncate max-w-[150px]">{cand.teamName}</span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-2 text-right font-mono text-white tabular-nums">
                                    {cand.votes}
                                  </td>
                                  <td className="py-2.5 px-2 text-right font-mono text-zinc-400 tabular-nums">
                                    {cand.percentage}%
                                  </td>
                                  <td className="py-2.5 pl-2 pr-4 text-right">
                                    {isWinner ? (
                                      <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-[#707ef9]/25 text-[#c8ceff]">
                                        TOTY
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-zinc-500">En disputa</span>
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
