import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP, UFRO_CAREERS } from '../data/ufroSeed';
import { formatDorsalLabel } from '../domain/attendanceEngine';
import { formatRut, validateRut, validateUfroEmail } from '../domain/tournamentEngine';
import { compressImageToDataUrl } from '../services/googleDrive';
import type {
  AcademicLevel,
  DisciplineId,
  Player,
  PlayerStats,
  TournamentState,
} from '../types/tournament';
import { ConfirmDialog } from './ConfirmDialog';

interface AdminPlayersManagerProps {
  state: TournamentState;
  onAddPlayer: (player: Player) => void;
  onUpdatePlayer: (player: Player) => void;
  onDeletePlayer: (player: Player) => void;
}

const EMPTY_STATS: PlayerStats = {
  partidosJugados: 0,
  goles: 0,
  asistencias: 0,
  tarjetasAmarillas: 0,
  tarjetasRojas: 0,
  puntos: 0,
  rebotes: 0,
  triples: 0,
  faltas: 0,
  aces: 0,
  bloqueos: 0,
};

interface PlayerFormDraft {
  id?: string;
  disciplineId: DisciplineId;
  teamId: string;
  dorsal: number;
  sinNumeroDefinido: boolean;
  posicion: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  carrera: string;
  facultad: string;
  rut: string;
  numeroMatricula: string;
  correoInstitucional: string;
  nivelAcademico: AcademicLevel;
  fechaNacimiento: string;
  fotografia: string;
  esSeleccionadoUfro: boolean;
  stats: PlayerStats;
}

function createNewPlayerDraft(state: TournamentState, defaultDisc?: DisciplineId): PlayerFormDraft {
  const firstTeam =
    (defaultDisc ? state.teams.find((t) => t.disciplineId === defaultDisc) : undefined) ??
    state.teams[0];
  const discId: DisciplineId = firstTeam?.disciplineId ?? defaultDisc ?? 'f7-h-1';
  const defaultCareer = UFRO_CAREERS[0];
  return {
    disciplineId: discId,
    teamId: firstTeam?.id ?? '',
    dorsal: 10,
    sinNumeroDefinido: false,
    posicion: 'Jugador',
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    carrera: firstTeam?.carrera ?? defaultCareer.carrera,
    facultad: firstTeam?.facultad ?? defaultCareer.facultad,
    rut: '',
    numeroMatricula: '',
    correoInstitucional: '',
    nivelAcademico: 'Pregrado',
    fechaNacimiento: '2003-01-01',
    fotografia: '',
    esSeleccionadoUfro: false,
    stats: { ...EMPTY_STATS },
  };
}

export function AdminPlayersManager({
  state,
  onAddPlayer,
  onUpdatePlayer,
  onDeletePlayer,
}: AdminPlayersManagerProps) {
  const [search, setSearch] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState<'ALL' | DisciplineId>('ALL');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');

  const [mode, setMode] = useState<'none' | 'create' | 'edit'>('none');
  const [draft, setDraft] = useState<PlayerFormDraft | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [pendingDeletePlayer, setPendingDeletePlayer] = useState<Player | null>(null);

  const teamMap = useMemo(() => new Map(state.teams.map((t) => [t.id, t])), [state.teams]);

  const filterTeams = useMemo(() => {
    return state.teams
      .filter((t) => disciplineFilter === 'ALL' || t.disciplineId === disciplineFilter)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [state.teams, disciplineFilter]);

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.players
      .filter((p) => {
        if (disciplineFilter !== 'ALL' && p.disciplineId !== disciplineFilter) return false;
        if (teamFilter !== 'ALL' && p.teamId !== teamFilter) return false;
        if (!q) return true;
        const fullName = `${p.nombre} ${p.apellidoPaterno} ${p.apellidoMaterno}`.toLowerCase();
        const teamName = teamMap.get(p.teamId)?.nombre.toLowerCase() ?? '';
        const dorsalText = formatDorsalLabel(p.dorsal).toLowerCase();
        return (
          fullName.includes(q) ||
          dorsalText.includes(q) ||
          p.rut.toLowerCase().includes(q) ||
          p.numeroMatricula.toLowerCase().includes(q) ||
          p.carrera.toLowerCase().includes(q) ||
          teamName.includes(q)
        );
      })
      .sort((a, b) =>
        `${a.apellidoPaterno} ${a.nombre}`.localeCompare(`${b.apellidoPaterno} ${b.nombre}`, 'es')
      );
  }, [state.players, search, disciplineFilter, teamFilter, teamMap]);

  const openCreateForm = () => {
    const preferredDisc = disciplineFilter !== 'ALL' ? disciplineFilter : undefined;
    setDraft(createNewPlayerDraft(state, preferredDisc));
    setFormErrors([]);
    setStatusMsg(null);
    setMode('create');
  };

  const openEditForm = (player: Player) => {
    setDraft({
      id: player.id,
      disciplineId: player.disciplineId,
      teamId: player.teamId,
      dorsal: player.dorsal,
      sinNumeroDefinido: player.dorsal === 0,
      posicion: player.posicion,
      nombre: player.nombre,
      apellidoPaterno: player.apellidoPaterno,
      apellidoMaterno: player.apellidoMaterno,
      carrera: player.carrera,
      facultad: player.facultad,
      rut: player.rut,
      numeroMatricula: player.numeroMatricula,
      correoInstitucional: player.correoInstitucional,
      nivelAcademico: player.nivelAcademico,
      fechaNacimiento: player.fechaNacimiento,
      fotografia: player.fotografia,
      esSeleccionadoUfro: player.esSeleccionadoUfro,
      stats: { ...player.stats },
    });
    setFormErrors([]);
    setStatusMsg(null);
    setMode('edit');
  };

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !draft) return;
    setUploadingPhoto(true);
    try {
      const dataUrl = await compressImageToDataUrl(file, 480, 0.72);
      setDraft((prev) => (prev ? { ...prev, fotografia: dataUrl } : prev));
    } catch (err) {
      setFormErrors([
        err instanceof Error ? err.message : 'No se pudo procesar la fotografía del estudiante.',
      ]);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;

    const errs: string[] = [];
    if (!draft.teamId) errs.push('Debes seleccionar un equipo inscrito para asignar al jugador.');
    if (!draft.nombre.trim()) errs.push('El Nombre es obligatorio.');
    if (!draft.apellidoPaterno.trim()) errs.push('El Apellido Paterno es obligatorio.');
    if (!draft.apellidoMaterno.trim()) errs.push('El Apellido Materno es obligatorio.');
    if (!draft.posicion.trim()) errs.push('La Posición es obligatoria.');

    const hasAnyPii =
      draft.rut.trim().length > 0 ||
      draft.numeroMatricula.trim().length > 0 ||
      draft.correoInstitucional.trim().length > 0 ||
      draft.fechaNacimiento.trim().length > 0;

    if (mode === 'create' || hasAnyPii) {
      if (!validateRut(draft.rut)) errs.push('El RUT ingresado no es válido (ej: 20.456.789-1).');
      if (draft.numeroMatricula.trim().length < 4) {
        errs.push('El Número de Matrícula debe tener al menos 4 caracteres.');
      }
      if (!validateUfroEmail(draft.correoInstitucional)) {
        errs.push('El correo institucional debe ser @ufromail.cl o @ufrontera.cl.');
      }
      if (!draft.fechaNacimiento) {
        errs.push('La Fecha de Nacimiento es obligatoria.');
      }
    }

    if (errs.length > 0) {
      setFormErrors(errs);
      return;
    }

    const selectedTeam = teamMap.get(draft.teamId);
    const resolvedDorsal = draft.sinNumeroDefinido
      ? 0
      : Math.max(0, Math.min(99, Math.trunc(Number(draft.dorsal) || 0)));

    const playerRecord: Player = {
      id: draft.id ?? `pl-${draft.disciplineId}-${Date.now()}`,
      teamId: draft.teamId,
      disciplineId: selectedTeam?.disciplineId ?? draft.disciplineId,
      dorsal: resolvedDorsal,
      posicion: draft.posicion.trim(),
      nombre: draft.nombre.trim(),
      apellidoPaterno: draft.apellidoPaterno.trim(),
      apellidoMaterno: draft.apellidoMaterno.trim(),
      carrera: draft.carrera,
      facultad: draft.facultad,
      rut: draft.rut.trim() ? formatRut(draft.rut) : '',
      numeroMatricula: draft.numeroMatricula.trim(),
      correoInstitucional: draft.correoInstitucional.trim().toLowerCase(),
      nivelAcademico: draft.nivelAcademico,
      fechaNacimiento: draft.fechaNacimiento.trim(),
      fotografia: draft.fotografia,
      esSeleccionadoUfro: draft.esSeleccionadoUfro,
      stats: {
        partidosJugados: Math.max(0, Math.trunc(Number(draft.stats.partidosJugados) || 0)),
        goles: Math.max(0, Math.trunc(Number(draft.stats.goles) || 0)),
        asistencias: Math.max(0, Math.trunc(Number(draft.stats.asistencias) || 0)),
        tarjetasAmarillas: Math.max(0, Math.trunc(Number(draft.stats.tarjetasAmarillas) || 0)),
        tarjetasRojas: Math.max(0, Math.trunc(Number(draft.stats.tarjetasRojas) || 0)),
        puntos: Math.max(0, Math.trunc(Number(draft.stats.puntos) || 0)),
        rebotes: Math.max(0, Math.trunc(Number(draft.stats.rebotes) || 0)),
        triples: Math.max(0, Math.trunc(Number(draft.stats.triples) || 0)),
        faltas: Math.max(0, Math.trunc(Number(draft.stats.faltas) || 0)),
        aces: Math.max(0, Math.trunc(Number(draft.stats.aces) || 0)),
        bloqueos: Math.max(0, Math.trunc(Number(draft.stats.bloqueos) || 0)),
      },
    };

    if (mode === 'create') {
      onAddPlayer(playerRecord);
      setStatusMsg(
        `Jugador ${playerRecord.nombre} ${playerRecord.apellidoPaterno} registrado en ${selectedTeam?.nombre ?? playerRecord.teamId}.`
      );
    } else {
      onUpdatePlayer(playerRecord);
      setStatusMsg(
        `Ficha oficial de ${playerRecord.nombre} ${playerRecord.apellidoPaterno} actualizada.`
      );
    }

    setMode('none');
    setDraft(null);
    setFormErrors([]);
  };

  const confirmDeletePlayer = () => {
    if (!pendingDeletePlayer) return;
    const deleted = pendingDeletePlayer;
    onDeletePlayer(deleted);
    setStatusMsg(`Jugador ${deleted.nombre} ${deleted.apellidoPaterno} eliminado.`);
    if (draft?.id === deleted.id) {
      setMode('none');
      setDraft(null);
    }
    setPendingDeletePlayer(null);
  };

  const teamsForDraftDiscipline = useMemo(() => {
    if (!draft) return [];
    return state.teams
      .filter((t) => t.disciplineId === draft.disciplineId)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [state.teams, draft]);

  const inputCls =
    'w-full rounded-xl bg-[#050507] border border-white/[0.1] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9] disabled:opacity-45';

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#a5b0ff]">
            <Users className="w-3.5 h-3.5" />
            <span>Planteles y Fichas UFRO</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-medium tracking-[-0.025em] text-white">
            Jugadores{' '}
            <span className="font-editorial italic font-normal text-[#c8ceff]">oficiales</span>
          </h2>
          <p className="text-xs text-zinc-400 max-w-2xl">
            Administra nóminas, dorsales fijos o sin número definido, seleccionados UFRO y
            estadísticas de la temporada.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          disabled={state.teams.length === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-zinc-200 disabled:opacity-40 text-[#050507] text-xs font-medium transition-colors cursor-pointer self-start lg:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar jugador</span>
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

      {state.teams.length === 0 && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs text-amber-200">
          Para agregar jugadores primero debe existir al menos un equipo inscrito en la temporada{' '}
          {state.temporada}.
        </div>
      )}

      {/* CREATE / EDIT PLAYER FORM */}
      {mode !== 'none' && draft && (
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/[0.12] bg-[#101016] p-6 space-y-6"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#a5b0ff]">
                {mode === 'create' ? 'Nuevo Registro Estudiantil' : 'Edición de Ficha'}
              </p>
              <h3 className="text-xl font-medium text-white mt-0.5">
                {mode === 'create'
                  ? 'Agregar jugador al campeonato'
                  : `${draft.nombre} ${draft.apellidoPaterno}`}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setMode('none');
                setDraft(null);
                setFormErrors([]);
              }}
              aria-label="Cerrar formulario de jugador"
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

          {/* Assignment: Discipline, Team, Dorsal, Position */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="adm-pl-disc" className="block text-xs text-zinc-400 mb-1.5">
                Disciplina {mode === 'edit' && '(fija)'}
              </label>
              <select
                id="adm-pl-disc"
                disabled={mode === 'edit'}
                value={draft.disciplineId}
                onChange={(e) => {
                  const nextDisc = e.target.value as DisciplineId;
                  const firstDiscTeam = state.teams.find((t) => t.disciplineId === nextDisc);
                  setDraft({
                    ...draft,
                    disciplineId: nextDisc,
                    teamId: firstDiscTeam?.id ?? '',
                  });
                }}
                className={inputCls}
              >
                {DISCIPLINES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="adm-pl-team" className="block text-xs text-zinc-400 mb-1.5">
                Equipo asignado
              </label>
              <select
                id="adm-pl-team"
                value={draft.teamId}
                onChange={(e) => setDraft({ ...draft, teamId: e.target.value })}
                className={inputCls}
              >
                {teamsForDraftDiscipline.length === 0 ? (
                  <option value="">Sin equipos en esta disciplina</option>
                ) : (
                  teamsForDraftDiscipline.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre} ({t.groupName})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="adm-pl-dorsal" className="block text-xs text-zinc-400">
                Dorsal (1-99)
              </label>
              <input
                id="adm-pl-dorsal"
                type="number"
                min={1}
                max={99}
                disabled={draft.sinNumeroDefinido}
                value={draft.sinNumeroDefinido ? '' : draft.dorsal || ''}
                placeholder={draft.sinNumeroDefinido ? 'S/N' : '10'}
                onChange={(e) => setDraft({ ...draft, dorsal: Number(e.target.value) || 0 })}
                className={`${inputCls} tabular-nums`}
              />
              <label className="inline-flex items-center gap-2 text-[11px] text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.sinNumeroDefinido}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      sinNumeroDefinido: e.target.checked,
                      dorsal: e.target.checked ? 0 : draft.dorsal || 10,
                    })
                  }
                  className="accent-[#707ef9] w-3.5 h-3.5"
                />
                <span>Sin número definido (S/N)</span>
              </label>
            </div>

            <div>
              <label htmlFor="adm-pl-pos" className="block text-xs text-zinc-400 mb-1.5">
                Posición
              </label>
              <input
                id="adm-pl-pos"
                type="text"
                value={draft.posicion}
                onChange={(e) => setDraft({ ...draft, posicion: e.target.value })}
                placeholder="Ej: Delantero, Base, Armador"
                className={inputCls}
              />
            </div>
          </div>

          {/* 12 Official UFRO Student Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-white/[0.08]">
            <div>
              <label htmlFor="adm-pl-nombre" className="block text-xs text-zinc-400 mb-1.5">
                Nombre *
              </label>
              <input
                id="adm-pl-nombre"
                type="text"
                value={draft.nombre}
                onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="adm-pl-app" className="block text-xs text-zinc-400 mb-1.5">
                Apellido Paterno *
              </label>
              <input
                id="adm-pl-app"
                type="text"
                value={draft.apellidoPaterno}
                onChange={(e) => setDraft({ ...draft, apellidoPaterno: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="adm-pl-apm" className="block text-xs text-zinc-400 mb-1.5">
                Apellido Materno *
              </label>
              <input
                id="adm-pl-apm"
                type="text"
                value={draft.apellidoMaterno}
                onChange={(e) => setDraft({ ...draft, apellidoMaterno: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="adm-pl-rut" className="block text-xs text-zinc-400 mb-1.5">
                RUT *
              </label>
              <input
                id="adm-pl-rut"
                type="text"
                value={draft.rut}
                onChange={(e) => setDraft({ ...draft, rut: e.target.value })}
                placeholder="20.456.789-1"
                className={`${inputCls} tabular-nums`}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="adm-pl-carrera" className="block text-xs text-zinc-400 mb-1.5">
                Carrera UFRO
              </label>
              <select
                id="adm-pl-carrera"
                value={draft.carrera}
                onChange={(e) => {
                  const found = UFRO_CAREERS.find((c) => c.carrera === e.target.value);
                  setDraft({
                    ...draft,
                    carrera: e.target.value,
                    facultad: found?.facultad ?? draft.facultad,
                  });
                }}
                className={inputCls}
              >
                {UFRO_CAREERS.map((c) => (
                  <option key={c.carrera} value={c.carrera}>
                    {c.carrera}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="adm-pl-mat" className="block text-xs text-zinc-400 mb-1.5">
                N° Matrícula *
              </label>
              <input
                id="adm-pl-mat"
                type="text"
                value={draft.numeroMatricula}
                onChange={(e) => setDraft({ ...draft, numeroMatricula: e.target.value })}
                className={`${inputCls} tabular-nums`}
              />
            </div>
            <div>
              <label htmlFor="adm-pl-email" className="block text-xs text-zinc-400 mb-1.5">
                Correo Institucional *
              </label>
              <input
                id="adm-pl-email"
                type="email"
                value={draft.correoInstitucional}
                onChange={(e) => setDraft({ ...draft, correoInstitucional: e.target.value })}
                placeholder="nombre@ufromail.cl"
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="adm-pl-nivel" className="block text-xs text-zinc-400 mb-1.5">
                Nivel Académico
              </label>
              <select
                id="adm-pl-nivel"
                value={draft.nivelAcademico}
                onChange={(e) =>
                  setDraft({ ...draft, nivelAcademico: e.target.value as AcademicLevel })
                }
                className={inputCls}
              >
                <option value="Pregrado">Pregrado</option>
                <option value="Postgrado">Postgrado</option>
              </select>
            </div>
            <div>
              <label htmlFor="adm-pl-dob" className="block text-xs text-zinc-400 mb-1.5">
                Fecha Nacimiento *
              </label>
              <input
                id="adm-pl-dob"
                type="date"
                value={draft.fechaNacimiento}
                onChange={(e) => setDraft({ ...draft, fechaNacimiento: e.target.value })}
                className={`${inputCls} tabular-nums`}
              />
            </div>
            <div>
              <span className="block text-xs text-zinc-400 mb-1.5">Fotografía</span>
              <label
                htmlFor="adm-pl-photo"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#050507] border border-white/[0.12] hover:border-[#707ef9] px-3 py-2.5 text-xs font-medium text-zinc-200 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#a5b0ff]" />
                <span>
                  {uploadingPhoto
                    ? 'Comprimiendo...'
                    : draft.fotografia
                    ? 'Cambiar foto'
                    : 'Subir foto'}
                </span>
              </label>
              <input
                id="adm-pl-photo"
                type="file"
                accept="image/*"
                onChange={(e) => void handlePhotoUpload(e)}
                className="sr-only"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="inline-flex items-center gap-2 text-xs text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.esSeleccionadoUfro}
                  onChange={(e) => setDraft({ ...draft, esSeleccionadoUfro: e.target.checked })}
                  className="accent-[#707ef9] w-4 h-4"
                />
                <span>Seleccionado UFRO</span>
              </label>
            </div>
          </div>

          {/* Individual Statistics Editor */}
          <div className="pt-4 border-t border-white/[0.08] space-y-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">
              Estadísticas individuales ({state.temporada})
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {(
                [
                  { key: 'partidosJugados', label: 'PJ' },
                  { key: 'goles', label: 'Goles' },
                  { key: 'asistencias', label: 'Asist.' },
                  { key: 'tarjetasAmarillas', label: 'T. Amar.' },
                  { key: 'tarjetasRojas', label: 'T. Rojas' },
                  { key: 'puntos', label: 'Puntos' },
                  { key: 'rebotes', label: 'Rebotes' },
                  { key: 'triples', label: 'Triples' },
                  { key: 'faltas', label: 'Faltas' },
                  { key: 'aces', label: 'Aces' },
                  { key: 'bloqueos', label: 'Bloqueos' },
                ] as const
              ).map((stat) => (
                <div key={stat.key}>
                  <label
                    htmlFor={`adm-stat-${stat.key}`}
                    className="block text-[11px] text-zinc-500 mb-1"
                  >
                    {stat.label}
                  </label>
                  <input
                    id={`adm-stat-${stat.key}`}
                    type="number"
                    min={0}
                    value={draft.stats[stat.key]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        stats: {
                          ...draft.stats,
                          [stat.key]: Math.max(0, Number(e.target.value) || 0),
                        },
                      })
                    }
                    className="w-full rounded-xl bg-[#050507] border border-white/[0.1] px-2.5 py-1.5 text-xs text-white tabular-nums focus:outline-none focus:border-[#707ef9]"
                  />
                </div>
              ))}
            </div>
          </div>

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
              {mode === 'create' ? 'Registrar jugador' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      )}

      {/* Filters Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar jugador, dorsal, RUT o equipo..."
            aria-label="Buscar jugadores en panel administrador"
            className="w-full rounded-xl bg-[#101016] border border-white/[0.1] pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
          />
        </div>

        <select
          value={disciplineFilter}
          onChange={(e) => {
            setDisciplineFilter(e.target.value as 'ALL' | DisciplineId);
            setTeamFilter('ALL');
          }}
          aria-label="Filtrar jugadores por disciplina"
          className="rounded-xl bg-[#101016] border border-white/[0.1] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#707ef9]"
        >
          <option value="ALL">Todas las disciplinas ({state.players.length})</option>
          {DISCIPLINES.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nombre}
            </option>
          ))}
        </select>

        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          aria-label="Filtrar jugadores por equipo"
          className="rounded-xl bg-[#101016] border border-white/[0.1] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#707ef9]"
        >
          <option value="ALL">Todos los equipos ({filterTeams.length})</option>
          {filterTeams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre} ({DISCIPLINE_MAP[t.disciplineId].nombreCorto})
            </option>
          ))}
        </select>
      </div>

      {/* Players Table */}
      {filteredPlayers.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#101016] p-10 text-center space-y-2">
          <p className="text-base font-medium text-white">
            No hay jugadores registrados con estos filtros
          </p>
          <p className="text-xs text-zinc-400">
            Usa «Agregar jugador» para incorporar deportistas al campeonato.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/[0.08] text-[11px] text-zinc-500 uppercase tracking-wider">
                <th className="py-3 px-4 font-medium">Estudiante</th>
                <th className="py-3 px-3 font-medium">Equipo / Disciplina</th>
                <th className="py-3 px-3 hidden md:table-cell font-medium">RUT / Matrícula</th>
                <th className="py-3 px-3 text-right font-medium tabular-nums">Rendimiento</th>
                <th className="py-3 px-4 text-right font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filteredPlayers.slice(0, 120).map((player) => {
                const team = teamMap.get(player.teamId);
                const disc = DISCIPLINE_MAP[player.disciplineId];
                const perf =
                  disc.sportType === 'futbol7'
                    ? `${player.stats.goles}G / ${player.stats.asistencias}A`
                    : disc.sportType === 'voleibol'
                    ? `${player.stats.puntos} Pts / ${player.stats.aces} Aces`
                    : `${player.stats.puntos} Pts / ${player.stats.rebotes} Reb`;

                return (
                  <tr key={player.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-medium text-white flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono ${
                            player.dorsal === 0
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : 'bg-white/[0.06] text-[#c8ceff]'
                          }`}
                        >
                          {formatDorsalLabel(player.dorsal)}
                        </span>
                        <span>
                          {player.nombre} {player.apellidoPaterno} {player.apellidoMaterno}
                        </span>
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        {player.posicion} · {player.carrera}
                        {player.esSeleccionadoUfro && (
                          <span className="text-[#a5b0ff] font-medium"> · Selec. UFRO</span>
                        )}
                      </p>
                    </td>
                    <td className="py-3 px-3">
                      <p className="text-xs font-medium text-zinc-200">
                        {team?.nombre ?? player.teamId}
                      </p>
                      <p className="text-[11px] text-zinc-500">{disc.nombreCorto}</p>
                    </td>
                    <td className="py-3 px-3 hidden md:table-cell text-xs tabular-nums text-zinc-400">
                      <p>{player.rut || 'Sin RUT'}</p>
                      <p className="text-[11px] text-zinc-600">{player.numeroMatricula || '—'}</p>
                    </td>
                    <td className="py-3 px-3 text-right text-xs tabular-nums">
                      <p className="font-medium text-white">{perf}</p>
                      <p className="text-[11px] text-zinc-500">{player.stats.partidosJugados} PJ</p>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditForm(player)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white hover:text-[#050507] text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeletePlayer(player)}
                          aria-label={`Eliminar jugador ${player.nombre} ${player.apellidoPaterno}`}
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

      <ConfirmDialog
        open={pendingDeletePlayer !== null}
        title={
          pendingDeletePlayer
            ? `Eliminar a ${pendingDeletePlayer.nombre} ${pendingDeletePlayer.apellidoPaterno}`
            : 'Eliminar jugador'
        }
        description="Esta acción eliminará permanentemente la ficha pública y privada del estudiante en Firestore."
        details={
          pendingDeletePlayer
            ? [
                `Estudiante: ${formatDorsalLabel(pendingDeletePlayer.dorsal)} ${pendingDeletePlayer.nombre} ${pendingDeletePlayer.apellidoPaterno} ${pendingDeletePlayer.apellidoMaterno}`,
                `Equipo: ${teamMap.get(pendingDeletePlayer.teamId)?.nombre ?? pendingDeletePlayer.teamId} (${DISCIPLINE_MAP[pendingDeletePlayer.disciplineId].nombreCorto})`,
                `RUT: ${pendingDeletePlayer.rut || 'Sin RUT'} · Carrera: ${pendingDeletePlayer.carrera}`,
              ]
            : []
        }
        confirmLabel="Eliminar jugador"
        onConfirm={confirmDeletePlayer}
        onCancel={() => setPendingDeletePlayer(null)}
      />
    </div>
  );
}
