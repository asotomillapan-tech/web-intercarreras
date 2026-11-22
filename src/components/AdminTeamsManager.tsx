import { useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Plus,
  Search,
  Shield,
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
}

interface TeamFormDraft {
  id?: string;
  disciplineId: DisciplineId;
  nombre: string;
  sigla: string;
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
}: AdminTeamsManagerProps) {
  const [search, setSearch] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState<'ALL' | DisciplineId>('ALL');

  const [mode, setMode] = useState<'none' | 'create' | 'edit'>('none');
  const [draft, setDraft] = useState<TeamFormDraft | null>(null);
  const [siglaTouched, setSiglaTouched] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [pendingDeleteTeam, setPendingDeleteTeam] = useState<Team | null>(null);

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

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.teams
      .filter((t) => {
        if (disciplineFilter !== 'ALL' && t.disciplineId !== disciplineFilter) return false;
        if (!q) return true;
        return (
          t.nombre.toLowerCase().includes(q) ||
          t.sigla.toLowerCase().includes(q) ||
          t.carrera.toLowerCase().includes(q) ||
          t.facultad.toLowerCase().includes(q) ||
          t.groupName.toLowerCase().includes(q)
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
      carrera: draft.carrera.trim().slice(0, 140),
      facultad: draft.facultad.trim().slice(0, 140),
      groupName: draft.groupName.trim().slice(0, 40),
      escudo: draft.escudo,
      anioFundacion: validYear,
      logrosAnteriores: draft.logrosAnteriores.trim()
        ? draft.logrosAnteriores.trim().slice(0, 160)
        : undefined,
    };

    if (mode === 'create') {
      onAddTeam(teamRecord);
      setStatusMsg(
        `Equipo "${teamRecord.nombre}" (${teamRecord.sigla}) agregado a ${DISCIPLINE_MAP[teamRecord.disciplineId].nombreCorto} y guardado en Firestore.`
      );
    } else {
      onUpdateTeam(teamRecord);
      setStatusMsg(`Equipo "${teamRecord.nombre}" actualizado en Firestore.`);
    }

    setMode('none');
    setDraft(null);
    setFormErrors([]);
  };

  const confirmDeleteTeam = () => {
    if (!pendingDeleteTeam) return;
    const deleted = pendingDeleteTeam;
    onDeleteTeam(deleted);
    setStatusMsg(
      `Equipo "${deleted.nombre}" eliminado de Firestore junto a sus registros asociados.`
    );
    if (draft?.id === deleted.id) {
      setMode('none');
      setDraft(null);
    }
    setPendingDeleteTeam(null);
  };

  const pendingPlayersCount = pendingDeleteTeam
    ? playerCountByTeam.get(pendingDeleteTeam.id) ?? 0
    : 0;
  const pendingMatchesCount = pendingDeleteTeam
    ? matchCountByTeam.get(pendingDeleteTeam.id) ?? 0
    : 0;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-neutral-200 pb-5">
        <div className="flex items-start gap-3">
          <Shield className="w-6 h-6 text-[#707ef9] shrink-0 mt-1" />
          <div>
            <h2 className="font-display text-3xl uppercase tracking-wide text-[#0d0d0d]">
              Administración de Equipos Inscritos
            </h2>
            <p className="text-xs text-neutral-600 mt-1 max-w-2xl">
              Agrega nuevos equipos directamente a cualquier disciplina, edita su grupo, carrera o
              sigla, o elimina equipos con limpieza automática en Firestore y Google Sheets.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display uppercase tracking-widest text-sm transition-colors cursor-pointer self-start lg:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar Equipo</span>
        </button>
      </div>

      {statusMsg && (
        <div
          role="status"
          className="bg-emerald-50 border border-emerald-300 p-4 text-xs text-emerald-950 flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{statusMsg}</span>
          </span>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            aria-label="Cerrar notificación"
            className="text-emerald-800 hover:text-emerald-950 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* CREATE / EDIT TEAM FORM */}
      {mode !== 'none' && draft && (
        <form
          onSubmit={handleSubmit}
          className="border-2 border-[#0d0d0d] bg-[#f5f6f8] p-6 space-y-6"
        >
          <div className="flex items-center justify-between gap-3 border-b border-neutral-300 pb-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
                {mode === 'create' ? 'Nuevo Equipo Oficial UFRO' : 'Edición Administrativa de Equipo'}
              </p>
              <h3 className="font-display text-2xl uppercase tracking-wide text-[#0d0d0d]">
                {mode === 'create'
                  ? 'Agregar Equipo al Campeonato'
                  : `Modificar: ${draft.nombre}`}
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
              className="p-2 text-neutral-600 hover:text-[#0d0d0d] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {formErrors.length > 0 && (
            <div role="alert" className="bg-red-50 border border-red-300 p-4 text-xs text-red-900 space-y-1">
              {formErrors.map((err, i) => (
                <p key={i} className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>{err}</span>
                </p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="adm-tm-disc" className="block text-xs font-medium text-neutral-700 mb-1">
                Disciplina {mode === 'edit' && '(fija)'}
              </label>
              <select
                id="adm-tm-disc"
                disabled={mode === 'edit'}
                value={draft.disciplineId}
                onChange={(e) =>
                  setDraft({ ...draft, disciplineId: e.target.value as DisciplineId })
                }
                className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
              >
                {DISCIPLINES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="adm-tm-nombre" className="block text-xs font-medium text-neutral-700 mb-1">
                Nombre del Equipo *
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
                className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="adm-tm-sigla" className="block text-xs font-medium text-neutral-700 mb-1">
                Sigla (2-8 letras) *
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
                className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm uppercase font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="adm-tm-carrera" className="block text-xs font-medium text-neutral-700 mb-1">
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
                className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm"
              >
                {UFRO_CAREERS.map((c) => (
                  <option key={c.carrera} value={c.carrera}>
                    {c.carrera}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="adm-tm-grupo" className="block text-xs font-medium text-neutral-700 mb-1">
                Grupo *
              </label>
              <select
                id="adm-tm-grupo"
                value={draft.groupName}
                onChange={(e) => setDraft({ ...draft, groupName: e.target.value })}
                className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm"
              >
                {GROUP_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="adm-tm-year" className="block text-xs font-medium text-neutral-700 mb-1">
                Año de fundación (opcional)
              </label>
              <input
                id="adm-tm-year"
                type="number"
                min={1950}
                max={2035}
                value={draft.anioFundacion}
                onChange={(e) => setDraft({ ...draft, anioFundacion: e.target.value })}
                placeholder="Ej: 2018"
                className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label htmlFor="adm-tm-logros" className="block text-xs font-medium text-neutral-700 mb-1">
                Títulos y logros anteriores (opcional)
              </label>
              <input
                id="adm-tm-logros"
                type="text"
                maxLength={160}
                value={draft.logrosAnteriores}
                onChange={(e) => setDraft({ ...draft, logrosAnteriores: e.target.value })}
                placeholder="Ej: Campeón 2024, Subcampeón 2025"
                className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <CrestUploader
            value={draft.escudo}
            onChange={(nextUrl) => setDraft({ ...draft, escudo: nextUrl })}
            teamName={draft.nombre || 'Equipo'}
            compact
          />

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setMode('none');
                setDraft(null);
                setFormErrors([]);
              }}
              className="px-4 py-2.5 border border-neutral-300 bg-white text-xs font-medium text-neutral-700 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#0d0d0d] hover:bg-[#707ef9] text-white font-display uppercase tracking-widest text-sm transition-colors cursor-pointer"
            >
              {mode === 'create' ? 'Registrar Equipo en Firestore' : 'Guardar Cambios del Equipo'}
            </button>
          </div>
        </form>
      )}

      {/* Filters Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#f5f6f8] border border-neutral-200 p-4">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar equipo por nombre, sigla, carrera o grupo..."
            aria-label="Buscar equipos en panel administrador"
            className="w-full bg-white border border-neutral-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#707ef9]"
          />
        </div>

        <select
          value={disciplineFilter}
          onChange={(e) => setDisciplineFilter(e.target.value as 'ALL' | DisciplineId)}
          aria-label="Filtrar equipos por disciplina"
          className="bg-white border border-neutral-300 px-3 py-2 text-sm"
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
        <div className="border border-neutral-200 bg-[#f5f6f8] p-10 text-center space-y-2">
          <p className="font-display text-2xl uppercase text-[#0d0d0d]">
            No hay equipos registrados con estos filtros
          </p>
          <p className="text-xs text-neutral-600">
            Usa el botón «Agregar Equipo» para registrar nuevos equipos directamente en el
            campeonato o importa tus equipos desde Google Sheets.
          </p>
        </div>
      ) : (
        <div className="border border-neutral-200 overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#f5f6f8] border-b border-neutral-200 text-xs text-neutral-500 uppercase">
                <th className="py-3 px-4 font-medium">Equipo</th>
                <th className="py-3 px-3 font-medium">Disciplina / Grupo</th>
                <th className="py-3 px-3 hidden md:table-cell font-medium">Carrera / Facultad</th>
                <th className="py-3 px-3 text-right font-medium tabular-nums">Plantel / Partidos</th>
                <th className="py-3 px-4 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredTeams.map((team) => {
                const disc = DISCIPLINE_MAP[team.disciplineId];
                const playersCount = playerCountByTeam.get(team.id) ?? 0;
                const matchesCount = matchCountByTeam.get(team.id) ?? 0;

                return (
                  <tr key={team.id} className="hover:bg-[#f9fafb]">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <TeamCrest
                          escudo={team.escudo}
                          sigla={team.sigla}
                          nombre={team.nombre}
                          size="sm"
                        />
                        <div>
                          <p className="font-bold text-[#0d0d0d]">{team.nombre}</p>
                          <p className="text-[11px] text-neutral-500">
                            {team.sigla}
                            {team.anioFundacion ? ` · Fund. ${team.anioFundacion}` : ''}
                          </p>
                          {team.logrosAnteriores && (
                            <p className="text-[11px] text-[#707ef9]">{team.logrosAnteriores}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-medium text-[#0d0d0d]">{disc?.nombreCorto ?? team.disciplineId}</p>
                      <p className="text-xs text-neutral-500">{team.groupName}</p>
                    </td>
                    <td className="py-3 px-3 hidden md:table-cell text-xs text-neutral-600">
                      <p className="font-medium text-[#0d0d0d]">{team.carrera}</p>
                      <p className="text-neutral-500 truncate max-w-[240px]">{team.facultad}</p>
                    </td>
                    <td className="py-3 px-3 text-right text-xs tabular-nums">
                      <p className="font-bold text-[#0d0d0d]">{playersCount} jugadores</p>
                      <p className="text-neutral-500">{matchesCount} partidos</p>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(team)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0d0d0d] hover:bg-[#707ef9] text-white text-xs font-display uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Modificar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteTeam(team)}
                          aria-label={`Eliminar equipo ${team.nombre}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-red-300 bg-white hover:bg-red-600 hover:text-white hover:border-red-600 text-red-700 text-xs font-display uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Eliminar</span>
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

      <ConfirmDialog
        open={pendingDeleteTeam !== null}
        title={pendingDeleteTeam ? `Eliminar equipo ${pendingDeleteTeam.nombre}` : 'Eliminar equipo'}
        description="Esta acción eliminará el equipo permanentemente de Firestore y lo quitará en la próxima sincronización con Google Sheets. No se puede deshacer."
        details={
          pendingDeleteTeam
            ? [
                `Equipo: ${pendingDeleteTeam.nombre} (${pendingDeleteTeam.sigla})`,
                `Disciplina: ${DISCIPLINE_MAP[pendingDeleteTeam.disciplineId]?.nombre ?? pendingDeleteTeam.disciplineId} · ${pendingDeleteTeam.groupName}`,
                `Jugadores inscritos en este equipo que también serán eliminados: ${pendingPlayersCount}`,
                `Partidos asociados que también serán removidos: ${pendingMatchesCount}`,
              ]
            : []
        }
        confirmLabel="Confirmar y eliminar equipo"
        onConfirm={confirmDeleteTeam}
        onCancel={() => setPendingDeleteTeam(null)}
      />
    </div>
  );
}
