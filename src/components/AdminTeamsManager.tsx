import { useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Award,
  Building2,
  CheckCircle2,
  CheckSquare,
  Edit3,
  Eraser,
  Plus,
  Search,
  Shield,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP, UFRO_CAREERS } from '../data/ufroSeed';
import type { DisciplineId, Team, TournamentState } from '../types/tournament';
import { ConfirmDialog } from './ConfirmDialog';
import { CrestUploader } from './CrestUploader';
import { TeamCrest } from './TeamCrest';

interface AdminTeamsManagerProps {
  state: TournamentState;
  onAddTeam: (team: Team) => void;
  onUpdateTeam: (team: Team) => void;
  onDeleteTeam: (team: Team) => void;
  onBulkUpdateTeams?: (
    updates: Array<{ team: Team; clearAnioFundacion?: boolean }>
  ) => Promise<void> | void;
}

interface TeamFormDraft {
  id?: string;
  disciplineId: DisciplineId;
  nombre: string;
  sigla: string;
  clubName: string;
  carrera: string;
  facultad: string;
  groupName: string;
  escudo?: string;
  anioFundacion: string;
  logrosAnteriores: string;
}

const GROUP_OPTIONS = [
  'Grupo A',
  'Grupo B',
  'Grupo C',
  'Grupo D',
  'Grupo E',
  'Grupo F',
  'Grupo G',
  'Grupo H',
];

const FUTBOL7_IDS = new Set<DisciplineId>(['f7-h-1', 'f7-h-2', 'f7-h-3', 'f7-m']);

function suggestSigla(name: string): string {
  const words = name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, 4)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 5);
  }
  return (words[0] ?? '').toUpperCase().slice(0, 4);
}

function createNewTeamDraft(defaultDisc?: DisciplineId): TeamFormDraft {
  const defaultCareer = UFRO_CAREERS[0];
  return {
    disciplineId: defaultDisc ?? 'f7-h-1',
    nombre: '',
    sigla: '',
    clubName: '',
    carrera: defaultCareer.carrera,
    facultad: defaultCareer.facultad,
    groupName: 'Grupo A',
    escudo: undefined,
    anioFundacion: '',
    logrosAnteriores: '',
  };
}

export function AdminTeamsManager({
  state,
  onAddTeam,
  onUpdateTeam,
  onDeleteTeam,
  onBulkUpdateTeams,
}: AdminTeamsManagerProps) {
  const [search, setSearch] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState<'ALL' | DisciplineId>('ALL');

  const [mode, setMode] = useState<'none' | 'create' | 'edit'>('none');
  const [draft, setDraft] = useState<TeamFormDraft | null>(null);
  const [siglaTouched, setSiglaTouched] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [pendingDeleteTeam, setPendingDeleteTeam] = useState<Team | null>(null);

  // Bulk management state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkClubInput, setBulkClubInput] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [pendingBulkAction, setPendingBulkAction] = useState<
    null | { kind: 'clear_logros' } | { kind: 'clear_year' } | { kind: 'set_club'; clubName: string }
  >(null);

  const playerCountByTeam = useMemo(() => {
    const counts = new Map<string, number>();
    state.players.forEach((p) => {
      counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
    });
    return counts;
  }, [state.players]);

  const matchCountByTeam = useMemo(() => {
    const counts = new Map<string, number>();
    state.matches.forEach((m) => {
      counts.set(m.homeTeamId, (counts.get(m.homeTeamId) ?? 0) + 1);
      counts.set(m.awayTeamId, (counts.get(m.awayTeamId) ?? 0) + 1);
    });
    return counts;
  }, [state.matches]);

  const existingClubNames = useMemo(() => {
    const set = new Set<string>();
    state.teams.forEach((t) => {
      if (t.clubName?.trim()) set.add(t.clubName.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [state.teams]);

  const f7WithLogrosCount = useMemo(
    () =>
      state.teams.filter(
        (t) => FUTBOL7_IDS.has(t.disciplineId) && Boolean(t.logrosAnteriores?.trim())
      ).length,
    [state.teams]
  );

  const allWithLogrosCount = useMemo(
    () => state.teams.filter((t) => Boolean(t.logrosAnteriores?.trim())).length,
    [state.teams]
  );

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.teams
      .filter((t) => {
        if (disciplineFilter !== 'ALL' && t.disciplineId !== disciplineFilter) return false;
        if (!q) return true;
        return (
          t.nombre.toLowerCase().includes(q) ||
          t.sigla.toLowerCase().includes(q) ||
          (t.clubName ?? '').toLowerCase().includes(q) ||
          t.carrera.toLowerCase().includes(q) ||
          t.facultad.toLowerCase().includes(q) ||
          t.groupName.toLowerCase().includes(q) ||
          (t.logrosAnteriores ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const discCmp = a.disciplineId.localeCompare(b.disciplineId);
        if (discCmp !== 0) return discCmp;
        const grpCmp = a.groupName.localeCompare(b.groupName, 'es');
        if (grpCmp !== 0) return grpCmp;
        return a.nombre.localeCompare(b.nombre, 'es');
      });
  }, [state.teams, search, disciplineFilter]);

  const allVisibleSelected =
    filteredTeams.length > 0 && filteredTeams.every((t) => selectedIds.has(t.id));

  const toggleSelectOne = (teamId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filteredTeams.forEach((t) => next.delete(t.id));
      } else {
        filteredTeams.forEach((t) => next.add(t.id));
      }
      return next;
    });
  };

  const selectF7WithLogros = () => {
    const ids = state.teams
      .filter((t) => FUTBOL7_IDS.has(t.disciplineId) && Boolean(t.logrosAnteriores?.trim()))
      .map((t) => t.id);
    setSelectedIds(new Set(ids));
    setStatusMsg(
      ids.length > 0
        ? `${ids.length} equipo(s) de Fútbol 7 con títulos anteriores seleccionados.`
        : 'No se encontraron equipos de Fútbol 7 con títulos anteriores.'
    );
  };

  const selectAllWithLogros = () => {
    const ids = state.teams
      .filter((t) => Boolean(t.logrosAnteriores?.trim()))
      .map((t) => t.id);
    setSelectedIds(new Set(ids));
    setStatusMsg(
      ids.length > 0
        ? `${ids.length} equipo(s) con títulos anteriores seleccionados.`
        : 'Ningún equipo tiene títulos anteriores registrados.'
    );
  };

  const executeBulkAction = async () => {
    if (!pendingBulkAction || selectedIds.size === 0) return;
    const targets = state.teams.filter((t) => selectedIds.has(t.id));
    if (targets.length === 0) {
      setPendingBulkAction(null);
      return;
    }

    setBulkBusy(true);
    try {
      const updates: Array<{ team: Team; clearAnioFundacion?: boolean }> = targets.map((t) => {
        if (pendingBulkAction.kind === 'clear_logros') {
          return { team: { ...t, logrosAnteriores: '' } };
        }
        if (pendingBulkAction.kind === 'clear_year') {
          return { team: { ...t, anioFundacion: undefined }, clearAnioFundacion: true };
        }
        return {
          team: {
            ...t,
            clubName: pendingBulkAction.clubName.trim() || '',
          },
        };
      });

      if (onBulkUpdateTeams) {
        await onBulkUpdateTeams(updates);
      } else {
        updates.forEach((u) => onUpdateTeam(u.team));
      }

      if (pendingBulkAction.kind === 'clear_logros') {
        setStatusMsg(
          `Se eliminaron los títulos anteriores en ${updates.length} equipo(s) en bloque.`
        );
      } else if (pendingBulkAction.kind === 'clear_year') {
        setStatusMsg(
          `Se limpió el año de fundación en ${updates.length} equipo(s) en bloque.`
        );
      } else {
        setStatusMsg(
          pendingBulkAction.clubName.trim()
            ? `Club "${pendingBulkAction.clubName.trim()}" asignado a ${updates.length} equipo(s).`
            : `Se quitó la afiliación de club en ${updates.length} equipo(s).`
        );
        setBulkClubInput('');
      }
      setSelectedIds(new Set());
    } finally {
      setBulkBusy(false);
      setPendingBulkAction(null);
    }
  };

  const openCreateForm = () => {
    const preferredDisc = disciplineFilter !== 'ALL' ? disciplineFilter : undefined;
    setDraft(createNewTeamDraft(preferredDisc));
    setSiglaTouched(false);
    setFormErrors([]);
    setStatusMsg(null);
    setMode('create');
  };

  const openEditForm = (team: Team) => {
    setDraft({
      id: team.id,
      disciplineId: team.disciplineId,
      nombre: team.nombre,
      sigla: team.sigla,
      clubName: team.clubName ?? '',
      carrera: team.carrera,
      facultad: team.facultad,
      groupName: team.groupName,
      escudo: team.escudo,
      anioFundacion: team.anioFundacion ? String(team.anioFundacion) : '',
      logrosAnteriores: team.logrosAnteriores ?? '',
    });
    setSiglaTouched(true);
    setFormErrors([]);
    setStatusMsg(null);
    setMode('edit');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;

    const errs: string[] = [];
    const trimmedName = draft.nombre.trim();
    const trimmedSigla = draft.sigla.trim().toUpperCase();

    if (trimmedName.length < 2) {
      errs.push('El nombre del equipo debe tener al menos 2 caracteres.');
    }
    if (trimmedSigla.length < 2 || trimmedSigla.length > 8) {
      errs.push('La sigla debe tener entre 2 y 8 caracteres (ej: EFI, ING, MED).');
    }
    if (draft.carrera.trim().length < 2) {
      errs.push('Debes seleccionar o indicar una carrera UFRO.');
    }
    if (!draft.groupName.trim()) {
      errs.push('El grupo es obligatorio.');
    }

    const duplicate = state.teams.find(
      (t) =>
        t.id !== draft.id &&
        t.disciplineId === draft.disciplineId &&
        t.nombre.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      errs.push(
        `Ya existe un equipo llamado "${duplicate.nombre}" en ${DISCIPLINE_MAP[draft.disciplineId].nombreCorto}.`
      );
    }

    if (errs.length > 0) {
      setFormErrors(errs);
      return;
    }

    const slug = trimmedName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 28);

    const parsedYear = draft.anioFundacion.trim() ? Number(draft.anioFundacion.trim()) : undefined;
    const validYear =
      parsedYear && Number.isFinite(parsedYear) && parsedYear >= 1950 && parsedYear <= 2035
        ? Math.trunc(parsedYear)
        : undefined;

    const teamRecord: Team = {
      id: draft.id ?? `tm-${draft.disciplineId}-${slug || 'eq'}-${Date.now().toString(36)}`,
      disciplineId: draft.disciplineId,
      nombre: trimmedName.slice(0, 120),
      sigla: trimmedSigla.slice(0, 8),
      clubName: draft.clubName.trim() ? draft.clubName.trim().slice(0, 120) : '',
      carrera: draft.carrera.trim().slice(0, 140),
      facultad: draft.facultad.trim().slice(0, 140),
      groupName: draft.groupName.trim().slice(0, 40),
      escudo: draft.escudo,
      anioFundacion: validYear,
      logrosAnteriores: draft.logrosAnteriores.trim()
        ? draft.logrosAnteriores.trim().slice(0, 160)
        : '',
    };

    if (mode === 'create') {
      onAddTeam(teamRecord);
      setStatusMsg(
        `Equipo "${teamRecord.nombre}" (${teamRecord.sigla}) agregado a ${DISCIPLINE_MAP[teamRecord.disciplineId].nombreCorto}.`
      );
    } else {
      onUpdateTeam(teamRecord);
      setStatusMsg(`Equipo "${teamRecord.nombre}" actualizado correctamente.`);
    }

    setMode('none');
    setDraft(null);
    setFormErrors([]);
  };

  const confirmDeleteTeam = () => {
    if (!pendingDeleteTeam) return;
    const deleted = pendingDeleteTeam;
    onDeleteTeam(deleted);
    setStatusMsg(`Equipo "${deleted.nombre}" eliminado permanentemente.`);
    if (draft?.id === deleted.id) {
      setMode('none');
      setDraft(null);
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(deleted.id);
      return next;
    });
    setPendingDeleteTeam(null);
  };

  const pendingPlayersCount = pendingDeleteTeam
    ? playerCountByTeam.get(pendingDeleteTeam.id) ?? 0
    : 0;
  const pendingMatchesCount = pendingDeleteTeam
    ? matchCountByTeam.get(pendingDeleteTeam.id) ?? 0
    : 0;

  return (
    <div className="space-y-6" data-testid="admin-teams-manager">
      {/* Header & Primary Action */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#a5b0ff]">
            <Shield className="w-3.5 h-3.5" />
            <span>Gestión de Equipos y Clubes</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-medium tracking-[-0.025em] text-white">
            Equipos{' '}
            <span className="font-editorial italic font-normal text-[#c8ceff]">inscritos</span>
          </h2>
          <p className="text-xs text-zinc-400 max-w-2xl">
            Edita escudos, nombres, pertenencia a club, carreras o realiza limpieza masiva de
            títulos anteriores en lote.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-[#050507] text-xs font-medium transition-colors cursor-pointer self-start lg:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar equipo</span>
        </button>
      </div>

      {statusMsg && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200 flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusMsg}</span>
          </span>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            aria-label="Cerrar notificación"
            className="text-emerald-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* CREATE / EDIT TEAM FORM */}
      {mode !== 'none' && draft && (
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/[0.12] bg-[#101016] p-6 space-y-6"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#a5b0ff]">
                {mode === 'create' ? 'Nuevo Equipo Oficial' : 'Editar Identidad del Equipo'}
              </p>
              <h3 className="text-xl font-medium text-white mt-0.5">
                {mode === 'create' ? 'Registrar equipo' : draft.nombre}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setMode('none');
                setDraft(null);
                setFormErrors([]);
              }}
              aria-label="Cerrar formulario de equipo"
              className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formErrors.length > 0 && (
            <div
              role="alert"
              className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200 space-y-1"
            >
              {formErrors.map((err, i) => (
                <p key={i} className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span>{err}</span>
                </p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="adm-tm-disc" className="block text-xs text-zinc-400 mb-1.5">
                Disciplina {mode === 'edit' && '(fija)'}
              </label>
              <select
                id="adm-tm-disc"
                disabled={mode === 'edit'}
                value={draft.disciplineId}
                onChange={(e) =>
                  setDraft({ ...draft, disciplineId: e.target.value as DisciplineId })
                }
                className="w-full rounded-xl bg-[#050507] border border-white/[0.1] px-3.5 py-2.5 text-sm text-white disabled:opacity-50 focus:outline-none focus:border-[#707ef9]"
              >
                {DISCIPLINES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="adm-tm-nombre" className="block text-xs text-zinc-400 mb-1.5">
                Nombre del equipo *
              </label>
              <input
                id="adm-tm-nombre"
                type="text"
                value={draft.nombre}
                onChange={(e) => {
                  const nextName = e.target.value;
                  setDraft({
                    ...draft,
                    nombre: nextName,
                    sigla: siglaTouched ? draft.sigla : suggestSigla(nextName),
                  });
                }}
                placeholder="Ej: Efiorentina"
                className="w-full rounded-xl bg-[#050507] border border-white/[0.1] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
              />
            </div>

            <div>
              <label htmlFor="adm-tm-sigla" className="block text-xs text-zinc-400 mb-1.5">
                Sigla (2-8) *
              </label>
              <input
                id="adm-tm-sigla"
                type="text"
                maxLength={8}
                value={draft.sigla}
                onChange={(e) => {
                  setSiglaTouched(true);
                  setDraft({ ...draft, sigla: e.target.value.toUpperCase() });
                }}
                placeholder="Ej: EFI"
                className="w-full rounded-xl bg-[#050507] border border-white/[0.1] px-3.5 py-2.5 text-sm text-white uppercase font-mono placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="adm-tm-club" className="block text-xs text-zinc-400 mb-1.5">
                Club al que pertenece (opcional — unifica ramas)
              </label>
              <input
                id="adm-tm-club"
                list="ufro-existing-clubs"
                type="text"
                maxLength={120}
                value={draft.clubName}
                onChange={(e) => setDraft({ ...draft, clubName: e.target.value })}
                placeholder="Dejar vacío si es independiente (ej: Club Deportivo Ingeniería)"
                className="w-full rounded-xl bg-[#050507] border border-white/[0.1] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
              />
              <datalist id="ufro-existing-clubs">
                {existingClubNames.map((club) => (
                  <option key={club} value={club} />
                ))}
              </datalist>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="adm-tm-carrera" className="block text-xs text-zinc-400 mb-1.5">
                Carrera UFRO *
              </label>
              <select
                id="adm-tm-carrera"
                value={draft.carrera}
                onChange={(e) => {
                  const found = UFRO_CAREERS.find((c) => c.carrera === e.target.value);
                  setDraft({
                    ...draft,
                    carrera: e.target.value,
                    facultad: found?.facultad ?? draft.facultad,
                  });
                }}
                className="w-full rounded-xl bg-[#050507] border border-white/[0.1] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#707ef9]"
              >
                {UFRO_CAREERS.map((c) => (
                  <option key={c.carrera} value={c.carrera}>
                    {c.carrera}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="adm-tm-grupo" className="block text-xs text-zinc-400 mb-1.5">
                Grupo *
              </label>
              <select
                id="adm-tm-grupo"
                value={draft.groupName}
                onChange={(e) => setDraft({ ...draft, groupName: e.target.value })}
                className="w-full rounded-xl bg-[#050507] border border-white/[0.1] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#707ef9]"
              >
                {GROUP_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="adm-tm-year" className="block text-xs text-zinc-400 mb-1.5">
                Año fundación (opcional)
              </label>
              <input
                id="adm-tm-year"
                type="number"
                min={1950}
                max={2035}
                value={draft.anioFundacion}
                onChange={(e) => setDraft({ ...draft, anioFundacion: e.target.value })}
                placeholder="Ej: 2018"
                className="w-full rounded-xl bg-[#050507] border border-white/[0.1] px-3.5 py-2.5 text-sm text-white tabular-nums placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="adm-tm-logros" className="block text-xs text-zinc-400 mb-1.5">
                Títulos y logros anteriores (opcional)
              </label>
              <input
                id="adm-tm-logros"
                type="text"
                maxLength={160}
                value={draft.logrosAnteriores}
                onChange={(e) => setDraft({ ...draft, logrosAnteriores: e.target.value })}
                placeholder="Dejar vacío si no registra títulos"
                className="w-full rounded-xl bg-[#050507] border border-white/[0.1] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
              />
            </div>
          </div>

          <CrestUploader
            value={draft.escudo}
            onChange={(nextUrl) => setDraft({ ...draft, escudo: nextUrl })}
            teamName={draft.nombre || 'Equipo'}
            compact
          />

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                setMode('none');
                setDraft(null);
                setFormErrors([]);
              }}
              className="px-4 py-2.5 rounded-full border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-300 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full bg-[#707ef9] hover:bg-[#5c6bf0] text-xs font-medium text-white transition-colors cursor-pointer"
            >
              {mode === 'create' ? 'Registrar equipo' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      )}

      {/* Bulk Quick Selectors & Cleanup Toolbar */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#101016] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 mr-1">
              Acciones en masa:
            </span>
            <button
              type="button"
              onClick={selectF7WithLogros}
              disabled={f7WithLogrosCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] hover:border-[#707ef9]/50 hover:text-white disabled:opacity-40 text-xs text-zinc-300 transition-colors cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-[#a5b0ff]" />
              <span>Fútbol 7 con logros ({f7WithLogrosCount})</span>
            </button>
            <button
              type="button"
              onClick={selectAllWithLogros}
              disabled={allWithLogrosCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] hover:border-[#707ef9]/50 hover:text-white disabled:opacity-40 text-xs text-zinc-300 transition-colors cursor-pointer"
            >
              <span>Todos con logros ({allWithLogrosCount})</span>
            </button>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 rounded-full text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Limpiar selección ({selectedIds.size})
              </button>
            )}
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="pt-3 border-t border-white/[0.08] flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-[#707ef9]/20 text-[#c8ceff] text-xs font-medium tabular-nums">
                {selectedIds.size} seleccionado{selectedIds.size === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => setPendingBulkAction({ kind: 'clear_logros' })}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-500/15 border border-red-500/35 hover:bg-red-500/25 text-xs font-medium text-red-200 transition-colors cursor-pointer"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Eliminar logros ({selectedIds.size})</span>
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => setPendingBulkAction({ kind: 'clear_year' })}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-xs text-zinc-300 transition-colors cursor-pointer"
              >
                <span>Limpiar fundación</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Building2 className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  list="ufro-existing-clubs"
                  value={bulkClubInput}
                  onChange={(e) => setBulkClubInput(e.target.value)}
                  placeholder="Nombre del club..."
                  aria-label="Club para asignación masiva"
                  className="rounded-full bg-[#050507] border border-white/[0.12] pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9] w-48"
                />
              </div>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() =>
                  setPendingBulkAction({ kind: 'set_club', clubName: bulkClubInput.trim() })
                }
                className="px-3.5 py-1.5 rounded-full bg-[#707ef9] hover:bg-[#5c6bf0] text-xs font-medium text-white transition-colors cursor-pointer"
              >
                {bulkClubInput.trim() ? 'Asignar club' : 'Quitar club'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filters Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar equipo, club, sigla, carrera o logros..."
            aria-label="Buscar equipos en panel administrador"
            className="w-full rounded-xl bg-[#101016] border border-white/[0.1] pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
          />
        </div>

        <select
          value={disciplineFilter}
          onChange={(e) => setDisciplineFilter(e.target.value as 'ALL' | DisciplineId)}
          aria-label="Filtrar equipos por disciplina"
          className="rounded-xl bg-[#101016] border border-white/[0.1] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#707ef9]"
        >
          <option value="ALL">Todas las disciplinas ({state.teams.length})</option>
          {DISCIPLINES.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Teams Table */}
      {filteredTeams.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#101016] p-10 text-center space-y-2">
          <p className="text-base font-medium text-white">
            No hay equipos registrados con estos filtros
          </p>
          <p className="text-xs text-zinc-400">
            Usa «Agregar equipo» o importa tu planilla desde Google Sheets.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/[0.08] text-[11px] text-zinc-500 uppercase tracking-wider">
                <th className="py-3 px-4 w-10">
                  <button
                    type="button"
                    onClick={toggleSelectAllVisible}
                    aria-label={
                      allVisibleSelected
                        ? 'Deseleccionar equipos visibles'
                        : 'Seleccionar equipos visibles'
                    }
                    className="text-zinc-400 hover:text-white cursor-pointer flex items-center"
                  >
                    {allVisibleSelected ? (
                      <CheckSquare className="w-4 h-4 text-[#a5b0ff]" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3 font-medium">Equipo / Club</th>
                <th className="py-3 px-3 font-medium">Disciplina / Grupo</th>
                <th className="py-3 px-3 hidden md:table-cell font-medium">Carrera</th>
                <th className="py-3 px-3 text-right font-medium tabular-nums">Plantel</th>
                <th className="py-3 px-4 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filteredTeams.map((team) => {
                const disc = DISCIPLINE_MAP[team.disciplineId];
                const playersCount = playerCountByTeam.get(team.id) ?? 0;
                const matchesCount = matchCountByTeam.get(team.id) ?? 0;
                const isSelected = selectedIds.has(team.id);

                return (
                  <tr
                    key={team.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-[#707ef9]/[0.08]' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => toggleSelectOne(team.id)}
                        aria-label={`Seleccionar equipo ${team.nombre}`}
                        className="text-zinc-400 hover:text-white cursor-pointer flex items-center"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#a5b0ff]" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <TeamCrest
                          escudo={team.escudo}
                          sigla={team.sigla}
                          nombre={team.nombre}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-white">{team.nombre}</p>
                            {team.clubName && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#707ef9]/15 border border-[#707ef9]/30 text-[10px] text-[#c8ceff]">
                                <Building2 className="w-2.5 h-2.5" />
                                {team.clubName}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-500">
                            {team.sigla}
                            {team.anioFundacion ? ` · Fund. ${team.anioFundacion}` : ''}
                          </p>
                          {team.logrosAnteriores && (
                            <p className="text-[11px] text-[#a5b0ff] mt-0.5 line-clamp-1">
                              {team.logrosAnteriores}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <p className="text-xs font-medium text-zinc-200">
                        {disc?.nombreCorto ?? team.disciplineId}
                      </p>
                      <p className="text-[11px] text-zinc-500">{team.groupName}</p>
                    </td>
                    <td className="py-3 px-3 hidden md:table-cell text-xs">
                      <p className="text-zinc-200">{team.carrera}</p>
                      <p className="text-[11px] text-zinc-500 truncate max-w-[220px]">
                        {team.facultad}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-right text-xs tabular-nums">
                      <p className="font-medium text-white">{playersCount} jug.</p>
                      <p className="text-[11px] text-zinc-500">{matchesCount} part.</p>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditForm(team)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white hover:text-[#050507] text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteTeam(team)}
                          aria-label={`Eliminar equipo ${team.nombre}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-red-500/30 bg-red-500/10 hover:bg-red-500/25 text-red-300 text-xs transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm Single Delete */}
      <ConfirmDialog
        open={pendingDeleteTeam !== null}
        title={pendingDeleteTeam ? `Eliminar equipo ${pendingDeleteTeam.nombre}` : 'Eliminar equipo'}
        description="Esta acción eliminará el equipo permanentemente de Firestore. No se puede deshacer."
        details={
          pendingDeleteTeam
            ? [
                `Equipo: ${pendingDeleteTeam.nombre} (${pendingDeleteTeam.sigla})`,
                `Disciplina: ${DISCIPLINE_MAP[pendingDeleteTeam.disciplineId]?.nombre ?? pendingDeleteTeam.disciplineId} · ${pendingDeleteTeam.groupName}`,
                `Jugadores asociados: ${pendingPlayersCount} · Partidos asociados: ${pendingMatchesCount}`,
              ]
            : []
        }
        confirmLabel="Eliminar equipo"
        onConfirm={confirmDeleteTeam}
        onCancel={() => setPendingDeleteTeam(null)}
      />

      {/* Confirm Bulk Action */}
      <ConfirmDialog
        open={pendingBulkAction !== null}
        loading={bulkBusy}
        title={
          pendingBulkAction?.kind === 'clear_logros'
            ? `Eliminar títulos anteriores en ${selectedIds.size} equipo(s)`
            : pendingBulkAction?.kind === 'clear_year'
            ? `Limpiar año de fundación en ${selectedIds.size} equipo(s)`
            : pendingBulkAction?.clubName
            ? `Asignar club "${pendingBulkAction.clubName}" a ${selectedIds.size} equipo(s)`
            : `Quitar afiliación de club en ${selectedIds.size} equipo(s)`
        }
        description="Esta operación actualizará todos los equipos seleccionados en un solo lote en Firestore."
        confirmLabel="Aplicar en masa"
        onConfirm={() => void executeBulkAction()}
        onCancel={() => setPendingBulkAction(null)}
      />
    </div>
  );
}
