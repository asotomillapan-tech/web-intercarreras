import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { CheckCircle2, Edit3, Lock, Plus, Shield, Trash2, Upload, Users } from 'lucide-react';
import {
  DISCIPLINES,
  DISCIPLINE_MAP,
  LOGO_LIGHT_SVG,
  UFRO_CAREERS,
} from '../data/ufroSeed';
import { formatDorsalLabel } from '../domain/attendanceEngine';
import { canManageRegistrationsAndTransfers, isAdminOrModerator } from '../domain/rbacEngine';
import { formatRut, validateRut, validateUfroEmail } from '../domain/tournamentEngine';
import type {
  AcademicLevel,
  AppUserProfile,
  DisciplineId,
  Player,
  Team,
  TournamentState,
} from '../types/tournament';
import { CrestUploader } from './CrestUploader';
import { RevealSection, SectionKicker } from './MotionPrimitives';
import { TeamCrest } from './TeamCrest';

interface RegistrationViewProps {
  state: TournamentState;
  currentUser: AppUserProfile | null;
  onRegisterTeam: (team: Team, roster: Player[]) => void;
  onUpdateTeam: (team: Team) => void;
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
  sinNumeroDefinido: boolean;
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
    sinNumeroDefinido: false,
    posicion: 'Titular',
  };
}

const INPUT_CLASS =
  'w-full rounded-xl bg-[#111117] border border-white/[0.1] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9] transition-colors';

const READONLY_INPUT_CLASS =
  'w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3.5 py-2.5 text-sm text-zinc-400';

export function RegistrationView({
  state,
  currentUser,
  onRegisterTeam,
  onUpdateTeam,
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
  const [teamEscudo, setTeamEscudo] = useState<string>('');
  const [teamAnioFundacion, setTeamAnioFundacion] = useState<string>('');
  const [teamLogros, setTeamLogros] = useState<string>('');
  const [roster, setRoster] = useState<DraftPlayer[]>([
    createEmptyPlayer(UFRO_CAREERS[0].carrera, UFRO_CAREERS[0].facultad, 0),
  ]);
  const [errors, setErrors] = useState<string[]>([]);
  const [successInfo, setSuccessInfo] = useState<{ teamName: string; count: number } | null>(null);

  const canManage = canManageRegistrationsAndTransfers(currentUser);
  const managedTeams = useMemo(() => {
    if (!currentUser) return [];
    if (isAdminOrModerator(currentUser)) {
      return [...state.teams].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    }
    if (currentUser.role === 'delegado') {
      return state.teams.filter(
        (t) =>
          (currentUser.delegatedTeamId && t.id === currentUser.delegatedTeamId) ||
          t.createdByUid === currentUser.uid
      );
    }
    return [];
  }, [currentUser, state.teams]);

  const [selectedManagedTeamId, setSelectedManagedTeamId] = useState<string>('');
  const effectiveManagedTeam =
    managedTeams.find((t) => t.id === selectedManagedTeamId) ?? managedTeams[0] ?? null;

  const [editTeamEscudo, setEditTeamEscudo] = useState<string>('');
  const [editTeamAnio, setEditTeamAnio] = useState<string>('');
  const [editTeamLogros, setEditTeamLogros] = useState<string>('');
  const [showIdentityEditor, setShowIdentityEditor] = useState(false);

  useEffect(() => {
    if (effectiveManagedTeam) {
      setEditTeamEscudo(effectiveManagedTeam.escudo ?? '');
      setEditTeamAnio(
        effectiveManagedTeam.anioFundacion ? String(effectiveManagedTeam.anioFundacion) : ''
      );
      setEditTeamLogros(effectiveManagedTeam.logrosAnteriores ?? '');
    }
  }, [
    effectiveManagedTeam?.id,
    effectiveManagedTeam?.escudo,
    effectiveManagedTeam?.anioFundacion,
    effectiveManagedTeam?.logrosAnteriores,
  ]);

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

    const parsedYear = teamAnioFundacion.trim() ? Number(teamAnioFundacion.trim()) : undefined;
    if (
      parsedYear !== undefined &&
      (!Number.isInteger(parsedYear) || parsedYear < 1950 || parsedYear > 2035)
    ) {
      validationErrors.push('El año de fundación debe ser un número entero entre 1950 y 2035.');
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setSuccessInfo(null);
      return;
    }

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
      escudo: teamEscudo || undefined,
      anioFundacion: parsedYear,
      logrosAnteriores: teamLogros.trim() ? teamLogros.trim().slice(0, 160) : undefined,
      createdByUid: currentUser?.uid,
    };

    const newPlayers: Player[] = roster.map((p, idx) => ({
      id: `PL-REG-${Date.now().toString().slice(-4)}-${idx + 1}`,
      teamId: newTeamId,
      disciplineId,
      dorsal: p.sinNumeroDefinido ? 0 : Math.min(99, Math.max(0, Number(p.dorsal) || 0)),
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
    setTeamEscudo('');
    setTeamAnioFundacion('');
    setTeamLogros('');
    setRoster([createEmptyPlayer(selectedCareerObj.carrera, selectedCareerObj.facultad, 0)]);
  };

  const handleSaveTeamIdentity = (e: FormEvent) => {
    e.preventDefault();
    if (!effectiveManagedTeam) return;
    const trimmedYear = editTeamAnio.trim();
    const parsedYear = trimmedYear ? Number(trimmedYear) : undefined;
    if (
      parsedYear !== undefined &&
      (!Number.isInteger(parsedYear) || parsedYear < 1950 || parsedYear > 2035)
    ) {
      setRosterErrors(['El año de fundación debe ser un número entero entre 1950 y 2035.']);
      return;
    }

    const updatedTeam: Team = {
      ...effectiveManagedTeam,
      escudo: editTeamEscudo,
      anioFundacion: parsedYear,
      logrosAnteriores: editTeamLogros.trim().slice(0, 160),
    };
    onUpdateTeam(updatedTeam);
    setRosterErrors([]);
    setRosterMsg(`Identidad y escudo de ${effectiveManagedTeam.nombre} actualizados correctamente.`);
    setShowIdentityEditor(false);
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
      dorsal: newMemberDraft.sinNumeroDefinido
        ? 0
        : Math.min(99, Math.max(0, Number(newMemberDraft.dorsal) || 0)),
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
    <div className="bg-[#050507] text-zinc-100 min-h-[75vh]">
      {/* Header */}
      <section className="border-b border-white/[0.06]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-3">
              <SectionKicker index="01" label={`Postulación · Temporada ${state.temporada}`} />
              <h1 className="font-display text-4xl sm:text-5xl font-medium tracking-[-0.03em] text-white">
                Inscripciones y <span className="font-editorial text-[#c8ceff]">nóminas</span>
              </h1>
              <p className="text-sm text-zinc-400 max-w-xl">
                Cupos por disciplina, alta de equipos y gestión de planteles oficiales UFRO.
              </p>
            </div>

            <div className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-[#0c0c10] p-1 self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setModeTab('nuevo')}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  modeTab === 'nuevo'
                    ? 'bg-white text-[#050507]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Inscribir equipo
              </button>
              <button
                type="button"
                onClick={() => setModeTab('plantel')}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  modeTab === 'plantel'
                    ? 'bg-white text-[#050507]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Modificar plantel
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Cupos Availability Matrix */}
      <section className="border-b border-white/[0.06] bg-[#08080c]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
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
                  className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#121322] border-[#707ef9]/70 text-white'
                      : 'bg-[#0c0c10] border-white/[0.08] text-zinc-200 hover:border-white/[0.2]'
                  }`}
                >
                  <p className="text-xs font-medium truncate text-zinc-300">{d.nombreCorto}</p>
                  <p className="font-display text-xl font-medium tabular-nums mt-1.5 text-white">
                    {count}
                    <span className="text-zinc-500 text-xs font-normal">/{cfg.maxCupos}</span>
                  </p>
                  <p
                    className={`text-[11px] mt-1 ${
                      !cfg.inscripcionesAbiertas
                        ? 'text-red-400'
                        : avail > 0
                        ? isSelected
                          ? 'text-[#a5b0ff]'
                          : 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {!cfg.inscripcionesAbiertas
                      ? 'Cerrada'
                      : avail > 0
                      ? `${avail} libres`
                      : 'Completo'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {!canManage && (
          <RevealSection className="mb-8 rounded-3xl border border-[#707ef9]/25 bg-[#0c0d18] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-full bg-[#707ef9]/15 border border-[#707ef9]/30 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 text-[#a5b0ff]" />
              </div>
              <div className="text-sm">
                <p className="font-medium text-white">
                  Acceso para Delegados y Administradores UFRO
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Inicia sesión con un perfil autorizado para inscribir equipos o editar nóminas.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-5 py-2.5 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Iniciar sesión con Google
            </button>
          </RevealSection>
        )}

        {modeTab === 'plantel' ? (
          <RevealSection className="space-y-6">
            {!canManage || !effectiveManagedTeam ? (
              <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-12 text-center space-y-3">
                <p className="font-display text-2xl font-medium tracking-[-0.02em] text-white">
                  Sin equipo asignado para <span className="font-editorial text-[#c8ceff]">edición</span>
                </p>
                <p className="text-sm text-zinc-400 max-w-md mx-auto">
                  Inicia sesión como Delegado con equipo asignado o Administrador UFRO para gestionar
                  el plantel oficial.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
                  <div className="flex items-center gap-4">
                    <TeamCrest
                      escudo={effectiveManagedTeam.escudo}
                      sigla={effectiveManagedTeam.sigla}
                      nombre={effectiveManagedTeam.nombre}
                      size="md"
                    />
                    <div>
                      <p className="text-xs text-[#a5b0ff] font-medium">
                        {currentUser?.role === 'admin' ? 'Administrador' : 'Delegado'} · Nómina oficial
                      </p>
                      <h2 className="font-display text-2xl font-medium tracking-[-0.02em] text-white mt-0.5">
                        {effectiveManagedTeam.nombre}{' '}
                        <span className="text-zinc-500 text-lg tabular-nums">
                          ({managedTeamPlayers.length})
                        </span>
                      </h2>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {effectiveManagedTeam.carrera}
                        {effectiveManagedTeam.anioFundacion
                          ? ` · Fundado en ${effectiveManagedTeam.anioFundacion}`
                          : ''}
                        {effectiveManagedTeam.logrosAnteriores
                          ? ` · ${effectiveManagedTeam.logrosAnteriores}`
                          : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {managedTeams.length > 1 && (
                      <select
                        aria-label="Seleccionar equipo a administrar"
                        value={effectiveManagedTeam.id}
                        onChange={(e) => {
                          setSelectedManagedTeamId(e.target.value);
                          setEditingPlayer(null);
                          setShowAddMember(false);
                          setShowIdentityEditor(false);
                        }}
                        className="rounded-full bg-[#111117] border border-white/[0.12] px-4 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#707ef9]"
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
                        setShowIdentityEditor((prev) => !prev);
                        setShowAddMember(false);
                        setEditingPlayer(null);
                        setRosterErrors([]);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.1] text-zinc-100 text-xs font-medium transition-colors cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5 text-[#a5b0ff]" />
                      <span>{showIdentityEditor ? 'Cerrar escudo' : 'Escudo e historia'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowAddMember((prev) => !prev);
                        setShowIdentityEditor(false);
                        setEditingPlayer(null);
                        setRosterErrors([]);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{showAddMember ? 'Cerrar formulario' : 'Agregar jugador'}</span>
                    </button>
                  </div>
                </div>

                {rosterMsg && (
                  <div
                    role="status"
                    className="rounded-2xl bg-emerald-500/10 border border-emerald-500/25 p-4 text-xs text-emerald-200 flex items-center gap-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{rosterMsg}</span>
                  </div>
                )}

                {rosterErrors.length > 0 && (
                  <div
                    role="alert"
                    className="rounded-2xl bg-red-500/10 border border-red-500/25 p-4 text-xs text-red-200 space-y-1"
                  >
                    {rosterErrors.map((err, i) => (
                      <p key={i}>{err}</p>
                    ))}
                  </div>
                )}

                {showIdentityEditor && (
                  <form
                    onSubmit={handleSaveTeamIdentity}
                    className="rounded-3xl border border-white/[0.12] bg-[#0c0c10] p-6 space-y-5"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                      <div>
                        <h3 className="font-display text-lg font-medium text-white">
                          Identidad de {effectiveManagedTeam.nombre}
                        </h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Actualiza escudo, año de fundación y palmarés del equipo.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowIdentityEditor(false)}
                        className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>

                    <CrestUploader
                      value={editTeamEscudo}
                      onChange={(nextUrl) => setEditTeamEscudo(nextUrl ?? '')}
                      teamName={effectiveManagedTeam.nombre}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label
                          htmlFor="edit-team-year"
                          className="block text-xs text-zinc-400 mb-1.5"
                        >
                          Año de fundación (opcional)
                        </label>
                        <input
                          id="edit-team-year"
                          type="number"
                          min={1950}
                          max={2035}
                          placeholder="Ej: 2018"
                          value={editTeamAnio}
                          onChange={(e) => setEditTeamAnio(e.target.value)}
                          className={`${INPUT_CLASS} tabular-nums`}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label
                          htmlFor="edit-team-logros"
                          className="block text-xs text-zinc-400 mb-1.5"
                        >
                          Títulos anteriores y palmarés (opcional)
                        </label>
                        <input
                          id="edit-team-logros"
                          type="text"
                          maxLength={160}
                          placeholder="Ej: Campeón 2023, Subcampeón 2025"
                          value={editTeamLogros}
                          onChange={(e) => setEditTeamLogros(e.target.value)}
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-6 py-2.5 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                      >
                        Guardar identidad
                      </button>
                    </div>
                  </form>
                )}

                {showAddMember && (
                  <form
                    onSubmit={handleAddMemberSubmit}
                    className="rounded-3xl border border-[#707ef9]/35 bg-[#0c0c10] p-6 space-y-5"
                  >
                    <h3 className="font-display text-lg font-medium text-white">
                      Incorporar estudiante a {effectiveManagedTeam.nombre}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <input
                        type="text"
                        placeholder="Nombre *"
                        value={newMemberDraft.nombre}
                        onChange={(e) =>
                          setNewMemberDraft({ ...newMemberDraft, nombre: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                      <input
                        type="text"
                        placeholder="Apellido Paterno *"
                        value={newMemberDraft.apellidoPaterno}
                        onChange={(e) =>
                          setNewMemberDraft({ ...newMemberDraft, apellidoPaterno: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                      <input
                        type="text"
                        placeholder="Apellido Materno *"
                        value={newMemberDraft.apellidoMaterno}
                        onChange={(e) =>
                          setNewMemberDraft({ ...newMemberDraft, apellidoMaterno: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                      <input
                        type="text"
                        placeholder="RUT (ej: 20.456.789-1) *"
                        value={newMemberDraft.rut}
                        onChange={(e) =>
                          setNewMemberDraft({ ...newMemberDraft, rut: e.target.value })
                        }
                        className={`${INPUT_CLASS} tabular-nums`}
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
                        className={INPUT_CLASS}
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
                        className={`${INPUT_CLASS} tabular-nums`}
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
                        className={INPUT_CLASS}
                      />
                      <input
                        type="date"
                        value={newMemberDraft.fechaNacimiento}
                        onChange={(e) =>
                          setNewMemberDraft({ ...newMemberDraft, fechaNacimiento: e.target.value })
                        }
                        className={`${INPUT_CLASS} tabular-nums`}
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          disabled={newMemberDraft.sinNumeroDefinido}
                          placeholder={newMemberDraft.sinNumeroDefinido ? 'S/N' : 'Dorsal (1-99)'}
                          value={newMemberDraft.sinNumeroDefinido ? '' : newMemberDraft.dorsal}
                          onChange={(e) =>
                            setNewMemberDraft({ ...newMemberDraft, dorsal: e.target.value })
                          }
                          className={`${INPUT_CLASS} tabular-nums disabled:opacity-40`}
                        />
                      </div>
                      <label className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#111117] px-3.5 py-2.5 text-xs text-zinc-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={newMemberDraft.sinNumeroDefinido}
                          onChange={(e) =>
                            setNewMemberDraft({
                              ...newMemberDraft,
                              sinNumeroDefinido: e.target.checked,
                              dorsal: e.target.checked ? '' : newMemberDraft.dorsal || '1',
                            })
                          }
                          className="accent-[#707ef9] w-4 h-4"
                        />
                        <span>Sin número definido</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Posición (ej: Titular)"
                        value={newMemberDraft.posicion}
                        onChange={(e) =>
                          setNewMemberDraft({ ...newMemberDraft, posicion: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 pt-2">
                      <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
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
                        className="px-6 py-2.5 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                      >
                        Guardar jugador
                      </button>
                    </div>
                  </form>
                )}

                {editingPlayer && (
                  <form
                    onSubmit={handleSaveEditedMember}
                    className="rounded-3xl border border-white/[0.14] bg-[#0c0c10] p-6 space-y-5"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-lg font-medium text-white">
                        Editando ficha: {editingPlayer.nombre} {editingPlayer.apellidoPaterno}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setEditingPlayer(null)}
                        className="text-xs text-zinc-400 hover:text-white cursor-pointer"
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
                        className={INPUT_CLASS}
                      />
                      <input
                        type="text"
                        aria-label="Apellido paterno"
                        value={editingPlayer.apellidoPaterno}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, apellidoPaterno: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                      <input
                        type="text"
                        aria-label="Apellido materno"
                        value={editingPlayer.apellidoMaterno}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, apellidoMaterno: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                      <input
                        type="text"
                        aria-label="RUT"
                        value={editingPlayer.rut}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, rut: e.target.value })
                        }
                        className={`${INPUT_CLASS} tabular-nums`}
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
                        className={INPUT_CLASS}
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
                        className={`${INPUT_CLASS} tabular-nums`}
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
                        className={INPUT_CLASS}
                      />
                      <input
                        type="date"
                        aria-label="Fecha de nacimiento"
                        value={editingPlayer.fechaNacimiento}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, fechaNacimiento: e.target.value })
                        }
                        className={`${INPUT_CLASS} tabular-nums`}
                      />
                      <input
                        type="number"
                        min={1}
                        max={99}
                        aria-label="Dorsal"
                        disabled={editingPlayer.dorsal === 0}
                        placeholder={editingPlayer.dorsal === 0 ? 'S/N' : 'Dorsal'}
                        value={editingPlayer.dorsal === 0 ? '' : editingPlayer.dorsal}
                        onChange={(e) =>
                          setEditingPlayer({
                            ...editingPlayer,
                            dorsal: Math.min(99, Math.max(1, Number(e.target.value) || 1)),
                          })
                        }
                        className={`${INPUT_CLASS} tabular-nums disabled:opacity-40`}
                      />
                      <label className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#111117] px-3.5 py-2.5 text-xs text-zinc-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={editingPlayer.dorsal === 0}
                          onChange={(e) =>
                            setEditingPlayer({
                              ...editingPlayer,
                              dorsal: e.target.checked ? 0 : 1,
                            })
                          }
                          className="accent-[#707ef9] w-4 h-4"
                        />
                        <span>Sin número definido</span>
                      </label>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
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
                        className="px-6 py-2.5 rounded-full bg-[#707ef9] hover:bg-[#5c6bf5] text-white text-xs font-medium transition-colors cursor-pointer"
                      >
                        Guardar cambios
                      </button>
                    </div>
                  </form>
                )}

                {/* Roster Table */}
                <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.08] bg-white/[0.02] text-xs text-zinc-400">
                          <th className="py-3.5 px-5 font-medium">Dorsal / Estudiante</th>
                          <th className="py-3.5 px-4 font-medium">RUT</th>
                          <th className="py-3.5 px-4 hidden md:table-cell font-medium">Carrera / Nivel</th>
                          <th className="py-3.5 px-4 hidden lg:table-cell font-medium">Correo</th>
                          <th className="py-3.5 px-5 text-right font-medium">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06]">
                        {managedTeamPlayers.map((p) => (
                          <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3.5 px-5">
                              <p className="font-medium text-white">
                                <span
                                  className={`tabular-nums mr-1.5 ${
                                    p.dorsal === 0
                                      ? 'inline-block px-1.5 py-0.5 rounded bg-white/[0.06] text-[10px] text-zinc-300'
                                      : 'text-zinc-500'
                                  }`}
                                >
                                  {formatDorsalLabel(p.dorsal)}
                                </span>
                                {p.nombre} {p.apellidoPaterno} {p.apellidoMaterno}
                              </p>
                              <p className="text-xs text-zinc-400 mt-0.5">
                                {p.posicion}
                                {p.esSeleccionadoUfro && ' · Seleccionado UFRO'}
                              </p>
                            </td>
                            <td className="py-3.5 px-4 text-xs tabular-nums text-zinc-300">
                              {p.rut}
                            </td>
                            <td className="py-3.5 px-4 hidden md:table-cell text-xs text-zinc-400">
                              {p.carrera} ({p.nivelAcademico})
                            </td>
                            <td className="py-3.5 px-4 hidden lg:table-cell text-xs text-zinc-400">
                              {p.correoInstitucional}
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPlayer(p);
                                  setShowAddMember(false);
                                  setRosterErrors([]);
                                }}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#a5b0ff] hover:text-white transition-colors cursor-pointer"
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
                </div>
              </>
            )}
          </RevealSection>
        ) : (
          <>
            {successInfo && (
              <div
                role="status"
                className="mb-8 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-display text-lg font-medium text-white">
                      Equipo «{successInfo.teamName}» inscrito correctamente
                    </p>
                    <p className="text-xs text-emerald-200/80 mt-0.5">
                      {successInfo.count} estudiante(s) registrados en {currentMeta.nombre}.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenSheetsSync}
                  className="px-5 py-2.5 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Guardar en Google Sheets
                </button>
              </div>
            )}

            {errors.length > 0 && (
              <div
                role="alert"
                className="mb-8 rounded-3xl border border-red-500/30 bg-red-500/10 p-5 sm:p-6 space-y-2"
              >
                <p className="font-display text-base font-medium text-red-200">
                  Corrige los siguientes campos antes de inscribir el equipo
                </p>
                <ul className="list-disc pl-5 text-xs text-red-200/90 space-y-1">
                  {errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-8">
              {/* Team Data Block */}
              <RevealSection className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-6 sm:p-8 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={LOGO_LIGHT_SVG}
                      alt=""
                      aria-hidden="true"
                      className="h-6 w-auto opacity-90"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h2 className="font-display text-2xl font-medium tracking-[-0.02em] text-white">
                        1. Datos del <span className="font-editorial text-[#c8ceff]">equipo</span>
                      </h2>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {currentMeta.nombre} · Cupos restantes:{' '}
                        <strong className="text-white tabular-nums">{remainingSlots}</strong> · Máx.
                        seleccionados UFRO: {currentMeta.maxSeleccionadosPorEquipo}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${
                      currentConfig.inscripcionesAbiertas
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-red-500/30 bg-red-500/10 text-red-300'
                    }`}
                  >
                    {currentConfig.inscripcionesAbiertas
                      ? 'Inscripciones abiertas'
                      : 'Inscripciones cerradas'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div>
                    <label
                      htmlFor="reg-discipline"
                      className="block text-xs text-zinc-400 mb-1.5"
                    >
                      Disciplina y división *
                    </label>
                    <select
                      id="reg-discipline"
                      value={disciplineId}
                      onChange={(e) => setDisciplineId(e.target.value as DisciplineId)}
                      className={INPUT_CLASS}
                    >
                      {DISCIPLINES.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-team-name"
                      className="block text-xs text-zinc-400 mb-1.5"
                    >
                      Nombre oficial del equipo *
                    </label>
                    <input
                      id="reg-team-name"
                      type="text"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="Ej: Atlético Ingeniería UFRO"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-team-career"
                      className="block text-xs text-zinc-400 mb-1.5"
                    >
                      Carrera representada *
                    </label>
                    <select
                      id="reg-team-career"
                      value={teamCarrera}
                      onChange={(e) => handleTeamCarreraChange(e.target.value)}
                      className={INPUT_CLASS}
                    >
                      {UFRO_CAREERS.map((c) => (
                        <option key={c.carrera} value={c.carrera}>
                          {c.carrera}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-zinc-500 mt-1 truncate">
                      {selectedCareerObj.facultad}
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-captain-email"
                      className="block text-xs text-zinc-400 mb-1.5"
                    >
                      Correo institucional capitán *
                    </label>
                    <input
                      id="reg-captain-email"
                      type="email"
                      value={capitanCorreo}
                      onChange={(e) => setCapitanCorreo(e.target.value)}
                      placeholder="capitan@ufromail.cl"
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 border-t border-white/[0.06]">
                  <div>
                    <label
                      htmlFor="reg-team-year"
                      className="block text-xs text-zinc-400 mb-1.5"
                    >
                      Año de fundación (opcional)
                    </label>
                    <input
                      id="reg-team-year"
                      type="number"
                      min={1950}
                      max={2035}
                      value={teamAnioFundacion}
                      onChange={(e) => setTeamAnioFundacion(e.target.value)}
                      placeholder="Ej: 2019"
                      className={`${INPUT_CLASS} tabular-nums`}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label
                      htmlFor="reg-team-logros"
                      className="block text-xs text-zinc-400 mb-1.5"
                    >
                      Títulos y logros anteriores (opcional)
                    </label>
                    <input
                      id="reg-team-logros"
                      type="text"
                      maxLength={160}
                      value={teamLogros}
                      onChange={(e) => setTeamLogros(e.target.value)}
                      placeholder="Ej: Campeón 2024, 3er Lugar 2025"
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <CrestUploader
                  value={teamEscudo}
                  onChange={(nextUrl) => setTeamEscudo(nextUrl ?? '')}
                  teamName={teamName || 'Equipo'}
                />
              </RevealSection>

              {/* Roster Builder (All 12 Mandatory Fields) */}
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-2xl font-medium tracking-[-0.02em] text-white">
                      2. Nómina de <span className="font-editorial text-[#c8ceff]">jugadores</span>
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      12 campos oficiales · Mínimo {currentMeta.minJugadores} · Máximo{' '}
                      {currentMeta.maxJugadores} jugadores.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addPlayerRow}
                    disabled={roster.length >= currentMeta.maxJugadores}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.1] text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#a5b0ff]" />
                    <span>
                      Agregar estudiante ({roster.length}/{currentMeta.maxJugadores})
                    </span>
                  </button>
                </div>

                {roster.map((player, idx) => (
                  <div
                    key={player.tempId}
                    className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-6 space-y-5"
                  >
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-3.5">
                      <div className="flex items-center gap-2.5">
                        <Users className="w-4 h-4 text-[#a5b0ff]" />
                        <h3 className="font-display text-base font-medium text-white">
                          Estudiante #{idx + 1}
                        </h3>
                      </div>
                      {roster.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePlayerRow(player.tempId)}
                          aria-label={`Eliminar estudiante ${idx + 1}`}
                          className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Quitar</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label htmlFor={`p-nombre-${idx}`} className="block text-xs text-zinc-400 mb-1.5">
                          1. Nombre *
                        </label>
                        <input
                          id={`p-nombre-${idx}`}
                          type="text"
                          value={player.nombre}
                          onChange={(e) => updateDraftPlayer(player.tempId, 'nombre', e.target.value)}
                          placeholder="Ej: Sofía"
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div>
                        <label htmlFor={`p-app-${idx}`} className="block text-xs text-zinc-400 mb-1.5">
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
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div>
                        <label htmlFor={`p-apm-${idx}`} className="block text-xs text-zinc-400 mb-1.5">
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
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div>
                        <label htmlFor={`p-rut-${idx}`} className="block text-xs text-zinc-400 mb-1.5">
                          4. RUT (Chile) *
                        </label>
                        <input
                          id={`p-rut-${idx}`}
                          type="text"
                          value={player.rut}
                          onChange={(e) => updateDraftPlayer(player.tempId, 'rut', e.target.value)}
                          placeholder="20.456.789-1"
                          className={`${INPUT_CLASS} tabular-nums`}
                        />
                      </div>

                      <div>
                        <label htmlFor={`p-carrera-${idx}`} className="block text-xs text-zinc-400 mb-1.5">
                          5. Carrera *
                        </label>
                        <select
                          id={`p-carrera-${idx}`}
                          value={player.carrera}
                          onChange={(e) => updateDraftPlayer(player.tempId, 'carrera', e.target.value)}
                          className={INPUT_CLASS}
                        >
                          {UFRO_CAREERS.map((c) => (
                            <option key={c.carrera} value={c.carrera}>
                              {c.carrera}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor={`p-facultad-${idx}`} className="block text-xs text-zinc-400 mb-1.5">
                          6. Facultad (automática)
                        </label>
                        <input
                          id={`p-facultad-${idx}`}
                          type="text"
                          value={player.facultad}
                          readOnly
                          className={READONLY_INPUT_CLASS}
                        />
                      </div>
                      <div>
                        <label htmlFor={`p-mat-${idx}`} className="block text-xs text-zinc-400 mb-1.5">
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
                          className={`${INPUT_CLASS} tabular-nums`}
                        />
                      </div>
                      <div>
                        <label htmlFor={`p-email-${idx}`} className="block text-xs text-zinc-400 mb-1.5">
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
                          className={INPUT_CLASS}
                        />
                      </div>

                      <div>
                        <label htmlFor={`p-nivel-${idx}`} className="block text-xs text-zinc-400 mb-1.5">
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
                          className={INPUT_CLASS}
                        >
                          <option value="Pregrado">Pregrado</option>
                          <option value="Postgrado">Postgrado</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor={`p-dob-${idx}`} className="block text-xs text-zinc-400 mb-1.5">
                          10. Fecha de Nacimiento *
                        </label>
                        <input
                          id={`p-dob-${idx}`}
                          type="date"
                          value={player.fechaNacimiento}
                          onChange={(e) =>
                            updateDraftPlayer(player.tempId, 'fechaNacimiento', e.target.value)
                          }
                          className={`${INPUT_CLASS} tabular-nums`}
                        />
                      </div>
                      <div>
                        <label htmlFor={`p-foto-${idx}`} className="block text-xs text-zinc-400 mb-1.5">
                          11. Fotografía del Estudiante
                        </label>
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor={`p-foto-${idx}`}
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-[#111117] px-3 py-2.5 text-xs text-zinc-200 hover:border-[#707ef9] transition-colors cursor-pointer truncate"
                          >
                            <Upload className="w-3.5 h-3.5 shrink-0 text-[#a5b0ff]" />
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
                              className="w-10 h-10 rounded-xl object-cover border border-white/[0.1] shrink-0"
                            />
                          )}
                        </div>
                      </div>
                      <div className="flex items-end pb-2">
                        <label className="inline-flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={player.esSeleccionadoUfro}
                            onChange={(e) =>
                              updateDraftPlayer(player.tempId, 'esSeleccionadoUfro', e.target.checked)
                            }
                            className="accent-[#707ef9] w-4 h-4"
                          />
                          <span>12. Seleccionado UFRO</span>
                        </label>
                      </div>

                      <div>
                        <label htmlFor={`p-dorsal-${idx}`} className="block text-xs text-zinc-400 mb-1.5">
                          Dorsal (opcional si es rotativo)
                        </label>
                        <input
                          id={`p-dorsal-${idx}`}
                          type="number"
                          min={1}
                          max={99}
                          disabled={player.sinNumeroDefinido}
                          value={player.sinNumeroDefinido ? '' : player.dorsal}
                          onChange={(e) => updateDraftPlayer(player.tempId, 'dorsal', e.target.value)}
                          placeholder={player.sinNumeroDefinido ? 'S/N (rotativo)' : 'Ej: 10'}
                          className={`${INPUT_CLASS} tabular-nums disabled:opacity-40`}
                        />
                      </div>

                      <div className="flex items-end pb-2">
                        <label className="inline-flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={player.sinNumeroDefinido}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setRoster((prev) =>
                                prev.map((item) =>
                                  item.tempId === player.tempId
                                    ? {
                                        ...item,
                                        sinNumeroDefinido: checked,
                                        dorsal: checked ? '' : item.dorsal || String(idx + 1),
                                      }
                                    : item
                                )
                              );
                            }}
                            className="accent-[#707ef9] w-4 h-4"
                          />
                          <span>Sin número definido</span>
                        </label>
                      </div>

                      <div className="sm:col-span-2">
                        <label htmlFor={`p-pos-${idx}`} className="block text-xs text-zinc-400 mb-1.5">
                          Posición en cancha
                        </label>
                        <input
                          id={`p-pos-${idx}`}
                          type="text"
                          value={player.posicion}
                          onChange={(e) => updateDraftPlayer(player.tempId, 'posicion', e.target.value)}
                          placeholder="Ej: Delantero, Base, Armador..."
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 border-t border-white/[0.08]">
                <p className="text-xs text-zinc-400">
                  El equipo se asignará al grupo con menor carga y quedará sincronizable con Sheets.
                </p>
                <button
                  type="submit"
                  disabled={!canManage || !currentConfig.inscripcionesAbiertas || remainingSlots <= 0}
                  className="px-7 py-3 rounded-full bg-white text-[#050507] hover:bg-zinc-200 font-medium text-sm transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
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
