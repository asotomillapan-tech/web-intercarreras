import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { CheckCircle2, Edit3, Lock, Plus, Trash2, Upload, Users } from 'lucide-react';
import {
  DISCIPLINES,
  DISCIPLINE_MAP,
  LOGO_DARK_SVG,
  UFRO_CAREERS,
} from '../data/ufroSeed';
import { canManageRegistrationsAndTransfers } from '../domain/rbacEngine';
import { formatRut, validateRut, validateUfroEmail } from '../domain/tournamentEngine';
import type {
  AcademicLevel,
  AppUserProfile,
  DisciplineId,
  Player,
  Team,
  TournamentState,
} from '../types/tournament';

interface RegistrationViewProps {
  state: TournamentState;
  currentUser: AppUserProfile | null;
  onRegisterTeam: (team: Team, roster: Player[]) => void;
  onUpdatePlayer: (updated: Player) => void;
  onAddPlayerToTeam: (player: Player) => void;
  onOpenSheetsSync: () => void;
  onOpenAuth: () => void;
}

interface DraftPlayer {
  tempId: string;
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
  dorsal: string;
  posicion: string;
}

function createEmptyPlayer(defaultCarrera: string, defaultFacultad: string, index: number): DraftPlayer {
  return {
    tempId: `draft-${Date.now()}-${index}`,
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    carrera: defaultCarrera,
    facultad: defaultFacultad,
    rut: '',
    numeroMatricula: '',
    correoInstitucional: '',
    nivelAcademico: 'Pregrado',
    fechaNacimiento: '',
    fotografia: '',
    esSeleccionadoUfro: false,
    dorsal: String(index + 1),
    posicion: 'Titular',
  };
}

export function RegistrationView({
  state,
  currentUser,
  onRegisterTeam,
  onUpdatePlayer,
  onAddPlayerToTeam,
  onOpenSheetsSync,
  onOpenAuth,
}: RegistrationViewProps) {
  const [modeTab, setModeTab] = useState<'nuevo' | 'plantel'>('nuevo');
  const [disciplineId, setDisciplineId] = useState<DisciplineId>('f7-h-1');
  const [teamName, setTeamName] = useState('');
  const [teamCarrera, setTeamCarrera] = useState(UFRO_CAREERS[0].carrera);
  const [capitanCorreo, setCapitanCorreo] = useState('');
  const [roster, setRoster] = useState<DraftPlayer[]>([
    createEmptyPlayer(UFRO_CAREERS[0].carrera, UFRO_CAREERS[0].facultad, 0),
  ]);
  const [errors, setErrors] = useState<string[]>([]);
  const [successInfo, setSuccessInfo] = useState<{ teamName: string; count: number } | null>(null);

  // Existing Roster Management State (Delegado / Admin)
  const canManage = canManageRegistrationsAndTransfers(currentUser);
  const managedTeams = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'admin') {
      return [...state.teams].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    }
    if (currentUser.role === 'delegado' && currentUser.delegatedTeamId) {
      return state.teams.filter((t) => t.id === currentUser.delegatedTeamId);
    }
    return [];
  }, [currentUser, state.teams]);

  const [selectedManagedTeamId, setSelectedManagedTeamId] = useState<string>('');
  const effectiveManagedTeam =
    managedTeams.find((t) => t.id === selectedManagedTeamId) ?? managedTeams[0] ?? null;

  const managedTeamPlayers = useMemo(() => {
    if (!effectiveManagedTeam) return [];
    return state.players.filter((p) => p.teamId === effectiveManagedTeam.id);
  }, [state.players, effectiveManagedTeam]);

  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [rosterMsg, setRosterMsg] = useState<string | null>(null);
  const [rosterErrors, setRosterErrors] = useState<string[]>([]);
  const [newMemberDraft, setNewMemberDraft] = useState<DraftPlayer>(() =>
    createEmptyPlayer(UFRO_CAREERS[0].carrera, UFRO_CAREERS[0].facultad, 99)
  );
  const [showAddMember, setShowAddMember] = useState(false);

  const selectedCareerObj =
    UFRO_CAREERS.find((c) => c.carrera === teamCarrera) ?? UFRO_CAREERS[0];
  const currentConfig = state.configs[disciplineId];
  const currentMeta = DISCIPLINE_MAP[disciplineId];
  const enrolledCount = state.teams.filter((t) => t.disciplineId === disciplineId).length;
  const remainingSlots = Math.max(0, currentConfig.maxCupos - enrolledCount);

  const handleTeamCarreraChange = (newCarrera: string) => {
    setTeamCarrera(newCarrera);
    const found = UFRO_CAREERS.find((c) => c.carrera === newCarrera);
    if (found) {
      setRoster((prev) =>
        prev.map((p) =>
          p.nombre === '' ? { ...p, carrera: found.carrera, facultad: found.facultad } : p
        )
      );
    }
  };

  const updateDraftPlayer = <K extends keyof DraftPlayer>(
    tempId: string,
    field: K,
    value: DraftPlayer[K]
  ) => {
    setRoster((prev) =>
      prev.map((p) => {
        if (p.tempId !== tempId) return p;
        if (field === 'carrera') {
          const found = UFRO_CAREERS.find((c) => c.carrera === value);
          return { ...p, carrera: String(value), facultad: found?.facultad ?? p.facultad };
        }
        return { ...p, [field]: value };
      })
    );
  };

  const handlePhotoUpload = (tempId: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateDraftPlayer(tempId, 'fotografia', reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const addPlayerRow = () => {
    if (roster.length >= currentMeta.maxJugadores) return;
    setRoster((prev) => [
      ...prev,
      createEmptyPlayer(selectedCareerObj.carrera, selectedCareerObj.facultad, prev.length),
    ]);
  };

  const removePlayerRow = (tempId: string) => {
    if (roster.length <= 1) return;
    setRoster((prev) => prev.filter((p) => p.tempId !== tempId));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const validationErrors: string[] = [];

    if (!canManage) {
      validationErrors.push(
        'Solo los perfiles de Delegado de Equipo o Administrador UFRO pueden inscribir equipos.'
      );
    }
    if (!currentConfig.inscripcionesAbiertas) {
      validationErrors.push(`El período de inscripciones para ${currentMeta.nombre} está cerrado.`);
    }
    if (remainingSlots <= 0) {
      validationErrors.push(`No quedan cupos disponibles en ${currentMeta.nombre}.`);
    }
    if (!teamName.trim() || teamName.trim().length < 3) {
      validationErrors.push('Ingresa un nombre de equipo válido (mínimo 3 caracteres).');
    }
    if (
      state.teams.some(
        (t) =>
          t.disciplineId === disciplineId &&
          t.nombre.toLowerCase() === teamName.trim().toLowerCase()
      )
    ) {
      validationErrors.push('Ya existe un equipo inscrito con ese nombre en esta disciplina.');
    }
    if (!validateUfroEmail(capitanCorreo)) {
      validationErrors.push('El correo del capitán debe ser institucional (@ufromail.cl o @ufrontera.cl).');
    }

    let selectedUfroCount = 0;
    roster.forEach((p, idx) => {
      const n = idx + 1;
      if (!p.nombre.trim()) validationErrors.push(`Jugador #${n}: falta el Nombre.`);
      if (!p.apellidoPaterno.trim()) validationErrors.push(`Jugador #${n}: falta el Apellido Paterno.`);
      if (!p.apellidoMaterno.trim()) validationErrors.push(`Jugador #${n}: falta el Apellido Materno.`);
      if (!validateRut(p.rut)) {
        validationErrors.push(`Jugador #${n}: el RUT "${p.rut || '(vacío)'}" no es válido (ej: 20.456.789-1).`);
      }
      if (!p.numeroMatricula.trim()) {
        validationErrors.push(`Jugador #${n}: falta el Número de Matrícula.`);
      }
      if (!validateUfroEmail(p.correoInstitucional)) {
        validationErrors.push(`Jugador #${n}: el correo institucional debe terminar en @ufromail.cl o @ufrontera.cl.`);
      }
      if (!p.fechaNacimiento) {
        validationErrors.push(`Jugador #${n}: falta la Fecha de Nacimiento.`);
      }
      if (p.esSeleccionadoUfro) selectedUfroCount += 1;
    });

    if (selectedUfroCount > currentMeta.maxSeleccionadosPorEquipo) {
      validationErrors.push(
        `Se permiten máximo ${currentMeta.maxSeleccionadosPorEquipo} seleccionados UFRO por equipo en ${currentMeta.nombreCorto}.`
      );
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setSuccessInfo(null);
      return;
    }

    // Assign equitably to the group with fewest teams in this discipline
    const discTeams = state.teams.filter((t) => t.disciplineId === disciplineId);
    const groupCounts = new Map<string, number>();
    for (let i = 0; i < currentConfig.numGrupos; i++) {
      groupCounts.set(`Grupo ${String.fromCharCode(65 + i)}`, 0);
    }
    discTeams.forEach((t) => {
      groupCounts.set(t.groupName, (groupCounts.get(t.groupName) ?? 0) + 1);
    });
    const assignedGroup = Array.from(groupCounts.entries()).sort((a, b) => a[1] - b[1])[0][0];

    const newTeamId = `REG-${disciplineId.toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const sigla = teamName
      .trim()
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 3)
      .toUpperCase();

    const newTeam: Team = {
      id: newTeamId,
      nombre: teamName.trim(),
      sigla: sigla || 'UFR',
      disciplineId,
      carrera: selectedCareerObj.carrera,
      facultad: selectedCareerObj.facultad,
      groupName: assignedGroup,
      capitanCorreo: capitanCorreo.trim().toLowerCase(),
      createdByUid: currentUser?.uid,
    };

    const newPlayers: Player[] = roster.map((p, idx) => ({
      id: `PL-REG-${Date.now().toString().slice(-4)}-${idx + 1}`,
      teamId: newTeamId,
      disciplineId,
      dorsal: Number(p.dorsal) || idx + 1,
      posicion: p.posicion.trim() || 'Titular',
      nombre: p.nombre.trim(),
      apellidoPaterno: p.apellidoPaterno.trim(),
      apellidoMaterno: p.apellidoMaterno.trim(),
      carrera: p.carrera,
      facultad: p.facultad,
      rut: formatRut(p.rut),
      numeroMatricula: p.numeroMatricula.trim(),
      correoInstitucional: p.correoInstitucional.trim().toLowerCase(),
      nivelAcademico: p.nivelAcademico,
      fechaNacimiento: p.fechaNacimiento,
      fotografia: p.fotografia,
      esSeleccionadoUfro: p.esSeleccionadoUfro,
      stats: {
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
      },
    }));

    onRegisterTeam(newTeam, newPlayers);
    setErrors([]);
    setSuccessInfo({ teamName: newTeam.nombre, count: newPlayers.length });
    setTeamName('');
    setCapitanCorreo('');
    setRoster([createEmptyPlayer(selectedCareerObj.carrera, selectedCareerObj.facultad, 0)]);
  };

  const handleSaveEditedMember = (e: FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;
    const errs: string[] = [];
    if (!editingPlayer.nombre.trim()) errs.push('Falta el Nombre del jugador.');
    if (!editingPlayer.apellidoPaterno.trim()) errs.push('Falta el Apellido Paterno.');
    if (!editingPlayer.apellidoMaterno.trim()) errs.push('Falta el Apellido Materno.');
    if (!validateRut(editingPlayer.rut)) errs.push('El RUT ingresado no es válido.');
    if (!editingPlayer.numeroMatricula.trim()) errs.push('Falta el Número de Matrícula.');
    if (!validateUfroEmail(editingPlayer.correoInstitucional)) {
      errs.push('El correo debe ser institucional (@ufromail.cl o @ufrontera.cl).');
    }
    if (!editingPlayer.fechaNacimiento) errs.push('Falta la Fecha de Nacimiento.');
    if (errs.length > 0) {
      setRosterErrors(errs);
      return;
    }
    onUpdatePlayer({
      ...editingPlayer,
      nombre: editingPlayer.nombre.trim(),
      apellidoPaterno: editingPlayer.apellidoPaterno.trim(),
      apellidoMaterno: editingPlayer.apellidoMaterno.trim(),
      rut: formatRut(editingPlayer.rut),
      correoInstitucional: editingPlayer.correoInstitucional.trim().toLowerCase(),
    });
    setRosterErrors([]);
    setRosterMsg(
      `Jugador ${editingPlayer.nombre} ${editingPlayer.apellidoPaterno} actualizado correctamente.`
    );
    setEditingPlayer(null);
  };

  const handleAddMemberSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!effectiveManagedTeam) return;
    const errs: string[] = [];
    if (!newMemberDraft.nombre.trim()) errs.push('Falta el Nombre.');
    if (!newMemberDraft.apellidoPaterno.trim()) errs.push('Falta el Apellido Paterno.');
    if (!newMemberDraft.apellidoMaterno.trim()) errs.push('Falta el Apellido Materno.');
    if (!validateRut(newMemberDraft.rut)) errs.push('El RUT ingresado no es válido.');
    if (!newMemberDraft.numeroMatricula.trim()) errs.push('Falta el Número de Matrícula.');
    if (!validateUfroEmail(newMemberDraft.correoInstitucional)) {
      errs.push('El correo debe ser institucional (@ufromail.cl o @ufrontera.cl).');
    }
    if (!newMemberDraft.fechaNacimiento) errs.push('Falta la Fecha de Nacimiento.');
    if (errs.length > 0) {
      setRosterErrors(errs);
      return;
    }

    const newPlayer: Player = {
      id: `PL-ADD-${Date.now().toString().slice(-5)}`,
      teamId: effectiveManagedTeam.id,
      disciplineId: effectiveManagedTeam.disciplineId,
      dorsal: Number(newMemberDraft.dorsal) || managedTeamPlayers.length + 1,
      posicion: newMemberDraft.posicion.trim() || 'Titular',
      nombre: newMemberDraft.nombre.trim(),
      apellidoPaterno: newMemberDraft.apellidoPaterno.trim(),
      apellidoMaterno: newMemberDraft.apellidoMaterno.trim(),
      carrera: newMemberDraft.carrera,
      facultad: newMemberDraft.facultad,
      rut: formatRut(newMemberDraft.rut),
      numeroMatricula: newMemberDraft.numeroMatricula.trim(),
      correoInstitucional: newMemberDraft.correoInstitucional.trim().toLowerCase(),
      nivelAcademico: newMemberDraft.nivelAcademico,
      fechaNacimiento: newMemberDraft.fechaNacimiento,
      fotografia: newMemberDraft.fotografia,
      esSeleccionadoUfro: newMemberDraft.esSeleccionadoUfro,
      stats: {
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
      },
    };
    onAddPlayerToTeam(newPlayer);
    setRosterErrors([]);
    setRosterMsg(
      `Estudiante ${newPlayer.nombre} ${newPlayer.apellidoPaterno} agregado al plantel de ${effectiveManagedTeam.nombre}.`
    );
    setNewMemberDraft(
      createEmptyPlayer(
        effectiveManagedTeam.carrera,
        effectiveManagedTeam.facultad,
        managedTeamPlayers.length + 2
      )
    );
    setShowAddMember(false);
  };

  return (
    <div className="bg-white min-h-[75vh]">
      {/* Header */}
      <div className="bg-[#0d0d0d] text-white border-b border-white/10">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
            Postulación oficial · Temporada {state.temporada}
          </p>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mt-2">
            <div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight">
                Inscripción de Equipos y Nóminas UFRO
              </h1>
              <p className="text-sm text-neutral-400 mt-2 max-w-2xl">
                Gestiona cupos disponibles por disciplina, inscribe equipos nuevos o actualiza el
                plantel oficial de jugadores (12 campos exigidos por Deportes UFRO).
              </p>
            </div>

            <div className="flex items-center gap-1 bg-white/5 p-1 self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setModeTab('nuevo')}
                className={`px-4 py-2 text-xs font-display font-bold uppercase tracking-widest cursor-pointer whitespace-nowrap ${
                  modeTab === 'nuevo'
                    ? 'bg-[#707ef9] text-white'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                Inscribir Nuevo Equipo
              </button>
              <button
                type="button"
                onClick={() => setModeTab('plantel')}
                className={`px-4 py-2 text-xs font-display font-bold uppercase tracking-widest cursor-pointer whitespace-nowrap ${
                  modeTab === 'plantel'
                    ? 'bg-[#707ef9] text-white'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                Modificar Plantel Existente
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cupos Availability Matrix */}
      <div className="bg-[#f5f6f8] border-b border-neutral-200">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {DISCIPLINES.map((d) => {
              const cfg = state.configs[d.id];
              const count = state.teams.filter((t) => t.disciplineId === d.id).length;
              const avail = Math.max(0, cfg.maxCupos - count);
              const isSelected = d.id === disciplineId;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDisciplineId(d.id)}
                  className={`text-left p-3 border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#0d0d0d] text-white border-[#0d0d0d]'
                      : 'bg-white text-[#0d0d0d] border-neutral-200 hover:border-[#707ef9]'
                  }`}
                >
                  <p className="font-display text-xs font-bold uppercase tracking-wide truncate">
                    {d.nombreCorto}
                  </p>
                  <p className="font-display text-xl font-bold tabular-nums mt-1">
                    {count}
                    <span className={isSelected ? 'text-neutral-400 text-xs font-normal' : 'text-neutral-500 text-xs font-normal'}>
                      /{cfg.maxCupos}
                    </span>
                  </p>
                  <p
                    className={`text-[11px] mt-0.5 ${
                      !cfg.inscripcionesAbiertas
                        ? 'text-red-500'
                        : avail > 0
                        ? isSelected
                          ? 'text-[#707ef9]'
                          : 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {!cfg.inscripcionesAbiertas
                      ? 'Cerrada'
                      : avail > 0
                      ? `${avail} cupos libres`
                      : 'Cupos llenos'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {!canManage && (
          <div className="mb-8 bg-[#f5f6f8] border-l-4 border-[#707ef9] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-[#707ef9] shrink-0 mt-0.5" />
              <div className="text-sm text-neutral-700">
                <p className="font-bold text-[#0d0d0d]">
                  Gestión de inscripciones habilitada para Delegados de Equipo y Administradores
                </p>
                <p className="text-xs text-neutral-600 mt-1">
                  Puedes revisar los cupos disponibles por disciplina arriba. Para inscribir un
                  equipo o modificar jugadores de una nómina, inicia sesión con un perfil de{' '}
                  <strong>Delegado</strong> o <strong>Administrador UFRO</strong>.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-4 py-2.5 bg-[#0d0d0d] hover:bg-[#707ef9] text-white text-xs font-display font-bold uppercase tracking-widest whitespace-nowrap shrink-0 cursor-pointer"
            >
              Iniciar sesión con Google
            </button>
          </div>
        )}

        {modeTab === 'plantel' ? (
          <div className="space-y-6">
            {!canManage || !effectiveManagedTeam ? (
              <div className="border border-neutral-200 p-8 text-center space-y-3">
                <p className="font-display text-xl font-bold uppercase text-[#0d0d0d]">
                  Sin equipo asignado para edición de plantel
                </p>
                <p className="text-xs text-neutral-600 max-w-md mx-auto">
                  Inicia sesión como Delegado de Equipo (con equipo asignado) o como Administrador
                  UFRO para modificar la nómina oficial de jugadores.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
                      Gestión de Nómina Oficial ({currentUser?.role === 'admin' ? 'Administrador' : 'Delegado'})
                    </p>
                    <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                      Plantel de {effectiveManagedTeam.nombre} ({managedTeamPlayers.length} jugadores)
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {managedTeams.length > 1 && (
                      <select
                        aria-label="Seleccionar equipo a administrar"
                        value={effectiveManagedTeam.id}
                        onChange={(e) => {
                          setSelectedManagedTeamId(e.target.value);
                          setEditingPlayer(null);
                          setShowAddMember(false);
                        }}
                        className="border border-neutral-300 bg-white px-3 py-2 text-sm text-[#0d0d0d]"
                      >
                        {managedTeams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nombre} ({DISCIPLINE_MAP[t.disciplineId].nombreCorto})
                          </option>
                        ))}
                      </select>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowAddMember((prev) => !prev);
                        setEditingPlayer(null);
                        setRosterErrors([]);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#707ef9] hover:bg-[#5766eb] text-white text-xs font-display font-bold uppercase tracking-widest cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{showAddMember ? 'Cerrar formulario' : 'Agregar jugador al plantel'}</span>
                    </button>
                  </div>
                </div>

                {rosterMsg && (
                  <div
                    role="status"
                    className="bg-emerald-50 border border-emerald-300 p-4 text-xs text-emerald-950 flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>{rosterMsg}</span>
                  </div>
                )}

                {rosterErrors.length > 0 && (
                  <div role="alert" className="bg-red-50 border border-red-300 p-4 text-xs text-red-900 space-y-1">
                    {rosterErrors.map((err, i) => (
                      <p key={i}>{err}</p>
                    ))}
                  </div>
                )}

                {/* Add New Player to Existing Team Form */}
                {showAddMember && (
                  <form
                    onSubmit={handleAddMemberSubmit}
                    className="border border-[#707ef9] bg-[#f5f6f8] p-6 space-y-4"
                  >
                    <h3 className="font-display text-lg font-bold uppercase text-[#0d0d0d]">
                      Incorporar Estudiante a {effectiveManagedTeam.nombre}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <input
                        type="text"
                        placeholder="Nombre *"
                        value={newMemberDraft.nombre}
                        onChange={(e) =>
                          setNewMemberDraft({ ...newMemberDraft, nombre: e.target.value })
                        }
                        className="bg-white border border-neutral-300 px-3 py-2 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Apellido Paterno *"
                        value={newMemberDraft.apellidoPaterno}
                        onChange={(e) =>
                          setNewMemberDraft({ ...newMemberDraft, apellidoPaterno: e.target.value })
                        }
                        className="bg-white border border-neutral-300 px-3 py-2 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Apellido Materno *"
                        value={newMemberDraft.apellidoMaterno}
                        onChange={(e) =>
                          setNewMemberDraft({ ...newMemberDraft, apellidoMaterno: e.target.value })
                        }
                        className="bg-white border border-neutral-300 px-3 py-2 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="RUT (ej: 20.456.789-1) *"
                        value={newMemberDraft.rut}
                        onChange={(e) =>
                          setNewMemberDraft({ ...newMemberDraft, rut: e.target.value })
                        }
                        className="bg-white border border-neutral-300 px-3 py-2 text-sm tabular-nums"
                      />
                      <select
                        value={newMemberDraft.carrera}
                        onChange={(e) => {
                          const found = UFRO_CAREERS.find((c) => c.carrera === e.target.value);
                          setNewMemberDraft({
                            ...newMemberDraft,
                            carrera: e.target.value,
                            facultad: found?.facultad ?? newMemberDraft.facultad,
                          });
                        }}
                        className="bg-white border border-neutral-300 px-3 py-2 text-sm"
                      >
                        {UFRO_CAREERS.map((c) => (
                          <option key={c.carrera} value={c.carrera}>
                            {c.carrera}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Número de Matrícula *"
                        value={newMemberDraft.numeroMatricula}
                        onChange={(e) =>
                          setNewMemberDraft({ ...newMemberDraft, numeroMatricula: e.target.value })
                        }
                        className="bg-white border border-neutral-300 px-3 py-2 text-sm tabular-nums"
                      />
                      <input
                        type="email"
                        placeholder="correo@ufromail.cl *"
                        value={newMemberDraft.correoInstitucional}
                        onChange={(e) =>
                          setNewMemberDraft({
                            ...newMemberDraft,
                            correoInstitucional: e.target.value,
                          })
                        }
                        className="bg-white border border-neutral-300 px-3 py-2 text-sm"
                      />
                      <input
                        type="date"
                        value={newMemberDraft.fechaNacimiento}
                        onChange={(e) =>
                          setNewMemberDraft({ ...newMemberDraft, fechaNacimiento: e.target.value })
                        }
                        className="bg-white border border-neutral-300 px-3 py-2 text-sm tabular-nums"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 pt-2">
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0d0d0d] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newMemberDraft.esSeleccionadoUfro}
                          onChange={(e) =>
                            setNewMemberDraft({
                              ...newMemberDraft,
                              esSeleccionadoUfro: e.target.checked,
                            })
                          }
                          className="accent-[#707ef9] w-4 h-4"
                        />
                        <span>Seleccionado UFRO</span>
                      </label>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-[#0d0d0d] hover:bg-[#707ef9] text-white text-xs font-display font-bold uppercase tracking-widest cursor-pointer"
                      >
                        Guardar nuevo jugador
                      </button>
                    </div>
                  </form>
                )}

                {/* Inline Edit Existing Player Form */}
                {editingPlayer && (
                  <form
                    onSubmit={handleSaveEditedMember}
                    className="border border-[#0d0d0d] bg-[#f5f6f8] p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-lg font-bold uppercase text-[#0d0d0d]">
                        Editando ficha: {editingPlayer.nombre} {editingPlayer.apellidoPaterno}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setEditingPlayer(null)}
                        className="text-xs text-neutral-600 hover:text-[#0d0d0d] cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <input
                        type="text"
                        aria-label="Nombre del jugador"
                        value={editingPlayer.nombre}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, nombre: e.target.value })
                        }
                        className="bg-white border border-neutral-300 px-3 py-2 text-sm"
                      />
                      <input
                        type="text"
                        aria-label="Apellido paterno"
                        value={editingPlayer.apellidoPaterno}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, apellidoPaterno: e.target.value })
                        }
                        className="bg-white border border-neutral-300 px-3 py-2 text-sm"
                      />
                      <input
                        type="text"
                        aria-label="Apellido materno"
                        value={editingPlayer.apellidoMaterno}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, apellidoMaterno: e.target.value })
                        }
                        className="bg-white border border-neutral-300 px-3 py-2 text-sm"
                      />
                      <input
                        type="text"
                        aria-label="RUT"
                        value={editingPlayer.rut}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, rut: e.target.value })
                        }
                        className="bg-white border border-neutral-300 px-3 py-2 text-sm tabular-nums"
                      />
                      <select
                        aria-label="Carrera"
                        value={editingPlayer.carrera}
                        onChange={(e) => {
                          const found = UFRO_CAREERS.find((c) => c.carrera === e.target.value);
                          setEditingPlayer({
                            ...editingPlayer,
                            carrera: e.target.value,
                            facultad: found?.facultad ?? editingPlayer.facultad,
                          });
                        }}
                        className="bg-white border border-neutral-300 px-3 py-2 text-sm"
                      >
                        {UFRO_CAREERS.map((c) => (
                          <option key={c.carrera} value={c.carrera}>
                            {c.carrera}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        aria-label="Número de matrícula"
                        value={editingPlayer.numeroMatricula}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, numeroMatricula: e.target.value })
                        }
                        className="bg-white border border-neutral-300 px-3 py-2 text-sm tabular-nums"
                      />
                      <input
                        type="email"
                        aria-label="Correo institucional"
                        value={editingPlayer.correoInstitucional}
                        onChange={(e) =>
                          setEditingPlayer({
                            ...editingPlayer,
                            correoInstitucional: e.target.value,
                          })
                        }
                        className="bg-white border border-neutral-300 px-3 py-2 text-sm"
                      />
                      <input
                        type="date"
                        aria-label="Fecha de nacimiento"
                        value={editingPlayer.fechaNacimiento}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, fechaNacimiento: e.target.value })
                        }
                        className="bg-white border border-neutral-300 px-3 py-2 text-sm tabular-nums"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0d0d0d] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingPlayer.esSeleccionadoUfro}
                          onChange={(e) =>
                            setEditingPlayer({
                              ...editingPlayer,
                              esSeleccionadoUfro: e.target.checked,
                            })
                          }
                          className="accent-[#707ef9] w-4 h-4"
                        />
                        <span>Seleccionado UFRO</span>
                      </label>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-[#707ef9] hover:bg-[#5766eb] text-white text-xs font-display font-bold uppercase tracking-widest cursor-pointer"
                      >
                        Guardar cambios del jugador
                      </button>
                    </div>
                  </form>
                )}

                {/* Roster Table */}
                <div className="border border-neutral-200 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#f5f6f8] border-b border-neutral-200 text-xs text-neutral-500 uppercase">
                        <th className="py-3 px-4 font-medium">Dorsal / Estudiante</th>
                        <th className="py-3 px-3 font-medium">RUT</th>
                        <th className="py-3 px-3 hidden md:table-cell font-medium">Carrera / Nivel</th>
                        <th className="py-3 px-3 hidden lg:table-cell font-medium">Correo</th>
                        <th className="py-3 px-4 text-right font-medium">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {managedTeamPlayers.map((p) => (
                        <tr key={p.id} className="hover:bg-[#f9fafb]">
                          <td className="py-3 px-4">
                            <p className="font-bold text-[#0d0d0d]">
                              #{p.dorsal} {p.nombre} {p.apellidoPaterno} {p.apellidoMaterno}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {p.posicion}
                              {p.esSeleccionadoUfro && ' · Seleccionado UFRO'}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-xs tabular-nums text-neutral-700">
                            {p.rut}
                          </td>
                          <td className="py-3 px-3 hidden md:table-cell text-xs text-neutral-700">
                            {p.carrera} ({p.nivelAcademico})
                          </td>
                          <td className="py-3 px-3 hidden lg:table-cell text-xs text-neutral-600">
                            {p.correoInstitucional}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPlayer(p);
                                setShowAddMember(false);
                                setRosterErrors([]);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-display font-bold uppercase tracking-wider text-[#707ef9] hover:text-[#0d0d0d] cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
        {successInfo && (
          <div
            role="status"
            className="mb-8 border border-emerald-300 bg-emerald-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-display text-lg font-bold uppercase text-emerald-950">
                  Equipo «{successInfo.teamName}» inscrito correctamente
                </p>
                <p className="text-sm text-emerald-900 mt-0.5">
                  Se registraron {successInfo.count} estudiante(s) y el equipo ya aparece asignado en
                  la tabla de posiciones y cupos de {currentMeta.nombre}.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenSheetsSync}
              className="px-4 py-2.5 bg-[#0d0d0d] text-white text-xs font-display font-bold uppercase tracking-widest hover:bg-[#707ef9] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Guardar en Google Sheets
            </button>
          </div>
        )}

        {errors.length > 0 && (
          <div role="alert" className="mb-8 border border-red-300 bg-red-50 p-5 space-y-2">
            <p className="font-display text-base font-bold uppercase text-red-900">
              Corrige los siguientes campos antes de inscribir el equipo
            </p>
            <ul className="list-disc pl-5 text-sm text-red-800 space-y-1">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-10">
          {/* Team Data Block */}
          <div className="border border-neutral-200 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-4">
              <div className="flex items-center gap-3">
                <img
                  src={LOGO_DARK_SVG}
                  alt=""
                  aria-hidden="true"
                  className="h-6 w-auto"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                    1. Datos del Equipo
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Disciplina seleccionada: {currentMeta.nombre} · Cupos restantes:{' '}
                    <strong className="text-[#0d0d0d] tabular-nums">{remainingSlots}</strong> ·
                    Máx. seleccionados UFRO: {currentMeta.maxSeleccionadosPorEquipo}
                  </p>
                </div>
              </div>
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  currentConfig.inscripcionesAbiertas ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {currentConfig.inscripcionesAbiertas ? 'Inscripciones Abiertas' : 'Inscripciones Cerradas'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label htmlFor="reg-discipline" className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Disciplina y División *
                </label>
                <select
                  id="reg-discipline"
                  value={disciplineId}
                  onChange={(e) => setDisciplineId(e.target.value as DisciplineId)}
                  className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
                >
                  {DISCIPLINES.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="reg-team-name" className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Nombre Oficial del Equipo *
                </label>
                <input
                  id="reg-team-name"
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Ej: Atlético Ingeniería UFRO"
                  className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
                />
              </div>

              <div>
                <label htmlFor="reg-team-career" className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Carrera Representada *
                </label>
                <select
                  id="reg-team-career"
                  value={teamCarrera}
                  onChange={(e) => handleTeamCarreraChange(e.target.value)}
                  className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
                >
                  {UFRO_CAREERS.map((c) => (
                    <option key={c.carrera} value={c.carrera}>
                      {c.carrera}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-neutral-500 mt-1 truncate">
                  {selectedCareerObj.facultad}
                </p>
              </div>

              <div>
                <label htmlFor="reg-captain-email" className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Correo Institucional Capitán *
                </label>
                <input
                  id="reg-captain-email"
                  type="email"
                  value={capitanCorreo}
                  onChange={(e) => setCapitanCorreo(e.target.value)}
                  placeholder="capitan@ufromail.cl"
                  className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
                />
              </div>
            </div>
          </div>

          {/* Roster Builder (All 12 Mandatory Fields) */}
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                  2. Nómina de Jugadores (12 Campos Oficiales UFRO)
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Mínimo reglamentario en cancha: {currentMeta.minJugadores} · Máximo en plantilla:{' '}
                  {currentMeta.maxJugadores} jugadores.
                </p>
              </div>

              <button
                type="button"
                onClick={addPlayerRow}
                disabled={roster.length >= currentMeta.maxJugadores}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0d0d0d] hover:bg-[#707ef9] text-white text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar estudiante ({roster.length}/{currentMeta.maxJugadores})</span>
              </button>
            </div>

            {roster.map((player, idx) => (
              <div
                key={player.tempId}
                className="border border-neutral-200 bg-white p-6 space-y-5"
              >
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#707ef9]" />
                    <h3 className="font-display text-base font-bold uppercase tracking-wide text-[#0d0d0d]">
                      Estudiante #{idx + 1}
                    </h3>
                  </div>
                  {roster.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePlayerRow(player.tempId)}
                      aria-label={`Eliminar estudiante ${idx + 1}`}
                      className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Quitar</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor={`p-nombre-${idx}`} className="block text-xs text-neutral-600 mb-1">
                      1. Nombre *
                    </label>
                    <input
                      id={`p-nombre-${idx}`}
                      type="text"
                      value={player.nombre}
                      onChange={(e) => updateDraftPlayer(player.tempId, 'nombre', e.target.value)}
                      placeholder="Ej: Sofía"
                      className="w-full border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-[#707ef9]"
                    />
                  </div>
                  <div>
                    <label htmlFor={`p-app-${idx}`} className="block text-xs text-neutral-600 mb-1">
                      2. Apellido Paterno *
                    </label>
                    <input
                      id={`p-app-${idx}`}
                      type="text"
                      value={player.apellidoPaterno}
                      onChange={(e) =>
                        updateDraftPlayer(player.tempId, 'apellidoPaterno', e.target.value)
                      }
                      placeholder="Ej: Catrileo"
                      className="w-full border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-[#707ef9]"
                    />
                  </div>
                  <div>
                    <label htmlFor={`p-apm-${idx}`} className="block text-xs text-neutral-600 mb-1">
                      3. Apellido Materno *
                    </label>
                    <input
                      id={`p-apm-${idx}`}
                      type="text"
                      value={player.apellidoMaterno}
                      onChange={(e) =>
                        updateDraftPlayer(player.tempId, 'apellidoMaterno', e.target.value)
                      }
                      placeholder="Ej: Muñoz"
                      className="w-full border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-[#707ef9]"
                    />
                  </div>
                  <div>
                    <label htmlFor={`p-rut-${idx}`} className="block text-xs text-neutral-600 mb-1">
                      4. RUT (Chile) *
                    </label>
                    <input
                      id={`p-rut-${idx}`}
                      type="text"
                      value={player.rut}
                      onChange={(e) => updateDraftPlayer(player.tempId, 'rut', e.target.value)}
                      placeholder="20.456.789-1"
                      className="w-full border border-neutral-300 px-3 py-2 text-sm tabular-nums focus:outline-none focus:border-[#707ef9]"
                    />
                  </div>

                  <div>
                    <label htmlFor={`p-carrera-${idx}`} className="block text-xs text-neutral-600 mb-1">
                      5. Carrera *
                    </label>
                    <select
                      id={`p-carrera-${idx}`}
                      value={player.carrera}
                      onChange={(e) => updateDraftPlayer(player.tempId, 'carrera', e.target.value)}
                      className="w-full border border-neutral-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#707ef9]"
                    >
                      {UFRO_CAREERS.map((c) => (
                        <option key={c.carrera} value={c.carrera}>
                          {c.carrera}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`p-facultad-${idx}`} className="block text-xs text-neutral-600 mb-1">
                      6. Facultad (automática)
                    </label>
                    <input
                      id={`p-facultad-${idx}`}
                      type="text"
                      value={player.facultad}
                      readOnly
                      className="w-full border border-neutral-200 bg-[#f5f6f8] px-3 py-2 text-sm text-neutral-600"
                    />
                  </div>
                  <div>
                    <label htmlFor={`p-mat-${idx}`} className="block text-xs text-neutral-600 mb-1">
                      7. Número de Matrícula *
                    </label>
                    <input
                      id={`p-mat-${idx}`}
                      type="text"
                      value={player.numeroMatricula}
                      onChange={(e) =>
                        updateDraftPlayer(player.tempId, 'numeroMatricula', e.target.value)
                      }
                      placeholder="20456789122"
                      className="w-full border border-neutral-300 px-3 py-2 text-sm tabular-nums focus:outline-none focus:border-[#707ef9]"
                    />
                  </div>
                  <div>
                    <label htmlFor={`p-email-${idx}`} className="block text-xs text-neutral-600 mb-1">
                      8. Correo Institucional *
                    </label>
                    <input
                      id={`p-email-${idx}`}
                      type="email"
                      value={player.correoInstitucional}
                      onChange={(e) =>
                        updateDraftPlayer(player.tempId, 'correoInstitucional', e.target.value)
                      }
                      placeholder="s.catrileo01@ufromail.cl"
                      className="w-full border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-[#707ef9]"
                    />
                  </div>

                  <div>
                    <label htmlFor={`p-nivel-${idx}`} className="block text-xs text-neutral-600 mb-1">
                      9. Pregrado / Postgrado *
                    </label>
                    <select
                      id={`p-nivel-${idx}`}
                      value={player.nivelAcademico}
                      onChange={(e) =>
                        updateDraftPlayer(
                          player.tempId,
                          'nivelAcademico',
                          e.target.value as AcademicLevel
                        )
                      }
                      className="w-full border border-neutral-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#707ef9]"
                    >
                      <option value="Pregrado">Pregrado</option>
                      <option value="Postgrado">Postgrado</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`p-dob-${idx}`} className="block text-xs text-neutral-600 mb-1">
                      10. Fecha de Nacimiento *
                    </label>
                    <input
                      id={`p-dob-${idx}`}
                      type="date"
                      value={player.fechaNacimiento}
                      onChange={(e) =>
                        updateDraftPlayer(player.tempId, 'fechaNacimiento', e.target.value)
                      }
                      className="w-full border border-neutral-300 px-3 py-2 text-sm tabular-nums focus:outline-none focus:border-[#707ef9]"
                    />
                  </div>
                  <div>
                    <label htmlFor={`p-foto-${idx}`} className="block text-xs text-neutral-600 mb-1">
                      11. Fotografía del Estudiante
                    </label>
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor={`p-foto-${idx}`}
                        className="flex-1 inline-flex items-center justify-center gap-2 border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:border-[#707ef9] cursor-pointer truncate"
                      >
                        <Upload className="w-3.5 h-3.5 shrink-0 text-[#707ef9]" />
                        <span className="truncate">
                          {player.fotografia ? 'Foto cargada (cambiar)' : 'Subir foto'}
                        </span>
                      </label>
                      <input
                        id={`p-foto-${idx}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(player.tempId, e)}
                        className="sr-only"
                      />
                      {player.fotografia && (
                        <img
                          src={player.fotografia}
                          alt="Vista previa estudiante"
                          className="w-9 h-9 object-cover border border-neutral-200 shrink-0"
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="inline-flex items-center gap-2.5 text-xs font-medium text-[#0d0d0d] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={player.esSeleccionadoUfro}
                        onChange={(e) =>
                          updateDraftPlayer(player.tempId, 'esSeleccionadoUfro', e.target.checked)
                        }
                        className="accent-[#707ef9] w-4 h-4"
                      />
                      <span>12. Seleccionado de la Universidad (UFRO)</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-neutral-200">
            <p className="text-xs text-neutral-500">
              Al enviar, el equipo quedará asignado al grupo con menor carga de la disciplina y
              disponible para sincronización en la plantilla de Google Sheets.
            </p>
            <button
              type="submit"
              disabled={!canManage || !currentConfig.inscripcionesAbiertas || remainingSlots <= 0}
              className="px-7 py-3.5 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-sm transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              Confirmar inscripción oficial
            </button>
          </div>
        </form>
          </>
        )}
      </div>
    </div>
  );
}
