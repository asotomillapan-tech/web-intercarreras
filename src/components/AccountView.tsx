import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Award,
  Bell,
  Camera,
  CheckCircle2,
  ClipboardList,
  Layers,
  Newspaper,
  Shield,
  Star,
  Upload,
  User,
  UserCog,
} from 'lucide-react';
import { DISCIPLINE_MAP, UFRO_CAREERS } from '../data/ufroSeed';
import { findPlayerParticipations } from '../domain/identityCrossRefEngine';
import { formatDorsalLabel } from '../domain/attendanceEngine';
import {
  buildFavoriteNotifications,
  ROLE_META,
} from '../domain/rbacEngine';
import { formatRut, validateRut, validateUfroEmail } from '../domain/tournamentEngine';
import type {
  AcademicLevel,
  AppUserProfile,
  Match,
  Player,
  TournamentState,
} from '../types/tournament';
import { RevealSection, SectionKicker } from './MotionPrimitives';
import type { NavSection } from './Navbar';

interface AccountViewProps {
  state: TournamentState;
  currentUser: AppUserProfile | null;
  onOpenAuth: () => void;
  onToggleFavoriteTeam: (teamId: string) => void;
  onToggleNotifications: (enabled: boolean) => void;
  onUpdateUserProfile: (updates: {
    displayName: string;
    fechaNacimiento: string;
    carrera: string;
    facultad: string;
    telefono: string;
  }) => Promise<void> | void;
  onUpdatePlayerProfile: (updated: Player) => void;
  onInspectTeam: (teamId: string) => void;
  onOpenMatchModal: (match: Match) => void;
  onNavigate: (section: NavSection) => void;
}

const INPUT_CLASS =
  'w-full rounded-xl bg-[#111117] border border-white/[0.1] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9] transition-colors';

const READONLY_INPUT_CLASS =
  'w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3.5 py-2.5 text-sm text-zinc-400';

export function AccountView({
  state,
  currentUser,
  onOpenAuth,
  onToggleFavoriteTeam,
  onToggleNotifications,
  onUpdateUserProfile,
  onUpdatePlayerProfile,
  onInspectTeam,
  onOpenMatchModal,
  onNavigate,
}: AccountViewProps) {
  const [teamSearch, setTeamSearch] = useState('');
  const [profileSavedMsg, setProfileSavedMsg] = useState<string | null>(null);
  const [profileErrors, setProfileErrors] = useState<string[]>([]);

  const [userDisplayName, setUserDisplayName] = useState(currentUser?.displayName ?? '');
  const [userBirthDate, setUserBirthDate] = useState(currentUser?.fechaNacimiento ?? '');
  const [userPhone, setUserPhone] = useState(currentUser?.telefono ?? '');
  const [userCareer, setUserCareer] = useState(currentUser?.carrera ?? '');
  const [userFaculty, setUserFaculty] = useState(currentUser?.facultad ?? '');
  const [userProfileSaving, setUserProfileSaving] = useState(false);
  const [userProfileSavedMsg, setUserProfileSavedMsg] = useState<string | null>(null);
  const [userProfileError, setUserProfileError] = useState<string | null>(null);

  useEffect(() => {
    setUserDisplayName(currentUser?.displayName ?? '');
    setUserBirthDate(currentUser?.fechaNacimiento ?? '');
    setUserPhone(currentUser?.telefono ?? '');
    setUserCareer(currentUser?.carrera ?? '');
    setUserFaculty(currentUser?.facultad ?? '');
    setUserProfileSavedMsg(null);
    setUserProfileError(null);
  }, [
    currentUser?.uid,
    currentUser?.displayName,
    currentUser?.fechaNacimiento,
    currentUser?.telefono,
    currentUser?.carrera,
    currentUser?.facultad,
  ]);

  const teamMap = useMemo(() => new Map(state.teams.map((t) => [t.id, t])), [state.teams]);
  const matchMap = useMemo(() => new Map(state.matches.map((m) => [m.id, m])), [state.matches]);

  const linkedPlayer = useMemo(() => {
    if (!currentUser) return null;
    if (currentUser.linkedPlayerId) {
      return state.players.find((p) => p.id === currentUser.linkedPlayerId) ?? null;
    }
    return (
      state.players.find(
        (p) => p.correoInstitucional.toLowerCase() === currentUser.email.toLowerCase()
      ) ?? null
    );
  }, [currentUser, state.players]);

  const linkedParticipations = useMemo(() => {
    if (!linkedPlayer) return [];
    return findPlayerParticipations(linkedPlayer, state.players, state.teams);
  }, [linkedPlayer, state.players, state.teams]);

  const [selectedLinkedPlayerId, setSelectedLinkedPlayerId] = useState<string | null>(null);
  const activeLinkedPlayer = useMemo(() => {
    if (!linkedPlayer) return null;
    if (selectedLinkedPlayerId) {
      const found = linkedParticipations.find((p) => p.player.id === selectedLinkedPlayerId);
      if (found) return found.player;
    }
    return linkedPlayer;
  }, [linkedPlayer, selectedLinkedPlayerId, linkedParticipations]);

  const [draftPlayer, setDraftPlayer] = useState<Player | null>(null);
  const activeDraft =
    draftPlayer && activeLinkedPlayer && draftPlayer.id === activeLinkedPlayer.id
      ? draftPlayer
      : activeLinkedPlayer;

  const notifications = useMemo(
    () => buildFavoriteNotifications(currentUser, state.matches, state.teams, state.mvpVotes),
    [currentUser, state.matches, state.teams, state.mvpVotes]
  );

  const userMvpVotes = useMemo(() => {
    if (!currentUser) return [];
    return state.mvpVotes.filter((v) => v.voterUid === currentUser.uid);
  }, [currentUser, state.mvpVotes]);

  const filteredTeams = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    return state.teams
      .filter((t) => {
        if (!q) return true;
        return (
          t.nombre.toLowerCase().includes(q) ||
          t.carrera.toLowerCase().includes(q) ||
          DISCIPLINE_MAP[t.disciplineId].nombreCorto.toLowerCase().includes(q)
        );
      })
      .slice(0, 12);
  }, [state.teams, teamSearch]);

  if (!currentUser) {
    return (
      <div className="bg-[#050507] text-zinc-100 min-h-[75vh] flex items-center justify-center p-6">
        <RevealSection className="max-w-lg w-full rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-8 sm:p-10 text-center space-y-5">
          <div className="flex justify-center">
            <SectionKicker index="01" label="Acceso UFRO" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-medium tracking-[-0.03em] text-white">
            Gestiona tu <span className="font-editorial text-[#c8ceff]">cuenta</span>
          </h1>
          <p className="text-sm text-zinc-400">
            Guarda equipos favoritos, vota por el MVP y accede a las herramientas de tu rol.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="px-7 py-3 rounded-full bg-white text-[#050507] hover:bg-zinc-200 font-medium text-sm transition-colors cursor-pointer"
          >
            Iniciar sesión
          </button>
        </RevealSection>
      </div>
    );
  }

  const roleMeta = ROLE_META[currentUser.role];
  const delegatedTeam = currentUser.delegatedTeamId
    ? teamMap.get(currentUser.delegatedTeamId)
    : undefined;

  const updateDraftField = <K extends keyof Player>(field: K, value: Player[K]) => {
    if (!activeDraft) return;
    if (field === 'carrera') {
      const found = UFRO_CAREERS.find((c) => c.carrera === value);
      setDraftPlayer({
        ...activeDraft,
        carrera: String(value),
        facultad: found?.facultad ?? activeDraft.facultad,
      });
      return;
    }
    setDraftPlayer({ ...activeDraft, [field]: value });
  };

  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateDraftField('fotografia', reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveOwnPlayerData = (e: FormEvent) => {
    e.preventDefault();
    if (!activeDraft) return;
    const errs: string[] = [];
    if (!activeDraft.nombre.trim()) errs.push('Ingresa tu Nombre.');
    if (!activeDraft.apellidoPaterno.trim()) errs.push('Ingresa tu Apellido Paterno.');
    if (!activeDraft.apellidoMaterno.trim()) errs.push('Ingresa tu Apellido Materno.');
    if (!validateRut(activeDraft.rut)) errs.push('El RUT ingresado no es válido.');
    if (!activeDraft.numeroMatricula.trim()) errs.push('Ingresa tu Número de Matrícula.');
    if (!validateUfroEmail(activeDraft.correoInstitucional)) {
      errs.push('El correo institucional debe ser @ufromail.cl o @ufrontera.cl.');
    }
    if (!activeDraft.fechaNacimiento) errs.push('Ingresa tu Fecha de Nacimiento.');

    if (errs.length > 0) {
      setProfileErrors(errs);
      setProfileSavedMsg(null);
      return;
    }

    onUpdatePlayerProfile({
      ...activeDraft,
      rut: formatRut(activeDraft.rut),
      correoInstitucional: activeDraft.correoInstitucional.trim().toLowerCase(),
    });
    setProfileErrors([]);
    setProfileSavedMsg('Tus datos estudiantiles oficiales han sido actualizados correctamente.');
  };

  const handleUserCareerChange = (nextCareer: string) => {
    setUserCareer(nextCareer);
    const matchedCareer = UFRO_CAREERS.find((c) => c.carrera === nextCareer);
    if (matchedCareer) {
      setUserFaculty(matchedCareer.facultad);
    } else if (!nextCareer) {
      setUserFaculty('');
    }
  };

  const handleSaveUserAccountProfile = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = userDisplayName.trim();
    const trimmedDob = userBirthDate.trim();
    const trimmedPhone = userPhone.trim();
    const trimmedCareer = userCareer.trim();
    const trimmedFaculty = userFaculty.trim();

    if (!trimmedName) {
      setUserProfileError('Ingresa tu nombre completo.');
      setUserProfileSavedMsg(null);
      return;
    }
    if (trimmedName.length > 120) {
      setUserProfileError('El nombre no puede superar los 120 caracteres.');
      setUserProfileSavedMsg(null);
      return;
    }
    if (trimmedDob && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDob)) {
      setUserProfileError('Selecciona una fecha de nacimiento válida.');
      setUserProfileSavedMsg(null);
      return;
    }
    if (trimmedPhone.length > 30) {
      setUserProfileError('El teléfono no puede superar los 30 caracteres.');
      setUserProfileSavedMsg(null);
      return;
    }
    if (trimmedCareer.length > 140 || trimmedFaculty.length > 140) {
      setUserProfileError('La carrera y la facultad no pueden superar los 140 caracteres.');
      setUserProfileSavedMsg(null);
      return;
    }

    setUserProfileSaving(true);
    setUserProfileError(null);
    setUserProfileSavedMsg(null);
    try {
      await onUpdateUserProfile({
        displayName: trimmedName,
        fechaNacimiento: trimmedDob,
        carrera: trimmedCareer,
        facultad: trimmedFaculty,
        telefono: trimmedPhone,
      });
      setUserProfileSavedMsg('Tus datos personales han sido actualizados correctamente.');
    } catch (err) {
      setUserProfileError(
        err instanceof Error ? err.message : 'No se pudieron guardar tus datos personales.'
      );
    } finally {
      setUserProfileSaving(false);
    }
  };

  const isCustomCareerValue =
    Boolean(userCareer) &&
    userCareer !== 'Otra / Externo UFRO' &&
    !UFRO_CAREERS.some((c) => c.carrera === userCareer);

  return (
    <div className="bg-[#050507] text-zinc-100 min-h-[75vh]">
      {/* Profile Header */}
      <section className="border-b border-white/[0.06]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2.5">
              <SectionKicker index="01" label={`Mi cuenta · ${roleMeta.label}`} />
              <h1 className="font-display text-4xl sm:text-5xl font-medium tracking-[-0.03em] text-white">
                {currentUser.displayName}
              </h1>
              <p className="text-sm text-zinc-400">
                {currentUser.email} · {roleMeta.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-4 py-2.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.12] text-zinc-100 text-xs font-medium transition-colors cursor-pointer"
              >
                Cambiar cuenta
              </button>
              {currentUser.role === 'delegado' && (
                <button
                  type="button"
                  onClick={() => onNavigate('inscripciones')}
                  className="px-5 py-2.5 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  Gestionar mi equipo
                </button>
              )}
              {currentUser.role === 'fotografo' && (
                <button
                  type="button"
                  onClick={() => onNavigate('galeria')}
                  className="px-5 py-2.5 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  Subir fotografías
                </button>
              )}
              {(currentUser.role === 'admin' ||
                currentUser.role === 'arbitro' ||
                currentUser.role === 'prensa') && (
                <button
                  type="button"
                  onClick={() => onNavigate('panel')}
                  className="px-5 py-2.5 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  {currentUser.role === 'prensa' ? 'Sala de prensa' : 'Panel oficial'}
                </button>
              )}
            </div>
          </div>

          {/* Permissions Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/[0.06] text-xs text-zinc-400">
            {roleMeta.permissions.map((perm, idx) => (
              <div key={idx} className="flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-[#a5b0ff] shrink-0 mt-0.5" />
                <span>{perm}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Role-specific shortcut banners */}
        {currentUser.role === 'delegado' && delegatedTeam && (
          <RevealSection className="rounded-3xl border border-[#707ef9]/25 bg-[#0c0d18] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <ClipboardList className="w-5 h-5 text-[#a5b0ff] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-[#a5b0ff]">Delegado oficial asignado</p>
                <h2 className="font-display text-2xl font-medium tracking-[-0.02em] text-white mt-0.5">
                  {delegatedTeam.nombre}{' '}
                  <span className="text-zinc-400 text-base font-normal">
                    ({DISCIPLINE_MAP[delegatedTeam.disciplineId].nombreCorto})
                  </span>
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Administra inscripciones, nómina oficial y transferencias de tu equipo.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('inscripciones')}
                className="px-4 py-2.5 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium transition-colors cursor-pointer"
              >
                Inscripciones y plantel
              </button>
              <button
                type="button"
                onClick={() => onNavigate('transferencias')}
                className="px-4 py-2.5 rounded-full border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.1] text-zinc-100 text-xs font-medium transition-colors cursor-pointer"
              >
                Transferencias
              </button>
            </div>
          </RevealSection>
        )}

        {currentUser.role === 'fotografo' && (
          <RevealSection className="rounded-3xl border border-[#707ef9]/25 bg-[#0c0d18] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <Camera className="w-5 h-5 text-[#a5b0ff] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-[#a5b0ff]">Fotógrafo acreditado UFRO</p>
                <h2 className="font-display text-2xl font-medium tracking-[-0.02em] text-white mt-0.5">
                  Estudio fotográfico y archivo
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Sube fotografías por disciplina y encuentro directamente a la galería oficial.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('galeria')}
              className="px-5 py-2.5 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium transition-colors cursor-pointer self-start md:self-auto"
            >
              Abrir estudio →
            </button>
          </RevealSection>
        )}

        {currentUser.role === 'prensa' && (
          <RevealSection className="rounded-3xl border border-[#707ef9]/25 bg-[#0c0d18] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <Newspaper className="w-5 h-5 text-[#a5b0ff] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-[#a5b0ff]">Prensa oficial UFRO</p>
                <h2 className="font-display text-2xl font-medium tracking-[-0.02em] text-white mt-0.5">
                  Sala de prensa y noticias
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Crea, edita y destaca comunicados oficiales en el inicio del campeonato.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('panel')}
              className="px-5 py-2.5 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium transition-colors cursor-pointer self-start md:self-auto"
            >
              Abrir sala de prensa →
            </button>
          </RevealSection>
        )}

        {/* PERSONAL ACCOUNT PROFILE EDITOR */}
        <RevealSection className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-[#a5b0ff]" />
              <div>
                <h2 className="font-display text-2xl font-medium tracking-[-0.02em] text-white">
                  Datos <span className="font-editorial text-[#c8ceff]">personales</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Actualiza tu nombre visible, fecha de nacimiento, carrera y teléfono.
                </p>
              </div>
            </div>
          </div>

          {userProfileSavedMsg && (
            <div
              role="status"
              className="rounded-2xl bg-emerald-500/10 border border-emerald-500/25 p-4 text-xs text-emerald-200 flex items-center gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{userProfileSavedMsg}</span>
            </div>
          )}

          {userProfileError && (
            <div
              role="alert"
              className="rounded-2xl bg-red-500/10 border border-red-500/25 p-4 text-xs text-red-200"
            >
              {userProfileError}
            </div>
          )}

          <form onSubmit={handleSaveUserAccountProfile} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="account-display-name" className="block text-xs text-zinc-400 mb-1.5">
                  Nombre completo *
                </label>
                <input
                  id="account-display-name"
                  type="text"
                  required
                  maxLength={120}
                  value={userDisplayName}
                  onChange={(e) => setUserDisplayName(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label htmlFor="account-email-readonly" className="block text-xs text-zinc-400 mb-1.5">
                  Correo electrónico (Google)
                </label>
                <input
                  id="account-email-readonly"
                  type="email"
                  readOnly
                  value={currentUser.email}
                  className={READONLY_INPUT_CLASS}
                />
              </div>

              <div>
                <label htmlFor="account-dob" className="block text-xs text-zinc-400 mb-1.5">
                  Fecha de nacimiento
                </label>
                <input
                  id="account-dob"
                  type="date"
                  value={userBirthDate}
                  onChange={(e) => setUserBirthDate(e.target.value)}
                  className={`${INPUT_CLASS} tabular-nums`}
                />
              </div>

              <div>
                <label htmlFor="account-phone" className="block text-xs text-zinc-400 mb-1.5">
                  Teléfono de contacto
                </label>
                <input
                  id="account-phone"
                  type="tel"
                  maxLength={30}
                  value={userPhone}
                  onChange={(e) => setUserPhone(e.target.value)}
                  placeholder="+56 9 1234 5678"
                  className={`${INPUT_CLASS} tabular-nums`}
                />
              </div>

              <div>
                <label htmlFor="account-career" className="block text-xs text-zinc-400 mb-1.5">
                  Carrera / Unidad
                </label>
                <select
                  id="account-career"
                  value={userCareer}
                  onChange={(e) => handleUserCareerChange(e.target.value)}
                  className={INPUT_CLASS}
                >
                  <option value="">No especificada</option>
                  {UFRO_CAREERS.map((c) => (
                    <option key={c.carrera} value={c.carrera}>
                      {c.carrera}
                    </option>
                  ))}
                  <option value="Otra / Externo UFRO">Otra / Externo UFRO</option>
                  {isCustomCareerValue && <option value={userCareer}>{userCareer}</option>}
                </select>
              </div>

              <div>
                <label htmlFor="account-faculty" className="block text-xs text-zinc-400 mb-1.5">
                  Facultad / Área
                </label>
                <input
                  id="account-faculty"
                  type="text"
                  maxLength={140}
                  value={userFaculty}
                  onChange={(e) => setUserFaculty(e.target.value)}
                  placeholder="Ej: Facultad de Ingeniería y Ciencias"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-white/[0.06]">
              <button
                type="submit"
                disabled={userProfileSaving}
                className="px-6 py-2.5 rounded-full bg-white text-[#050507] hover:bg-zinc-200 disabled:opacity-50 font-medium text-xs transition-colors cursor-pointer"
              >
                {userProfileSaving ? 'Guardando...' : 'Guardar mis datos'}
              </button>
            </div>
          </form>
        </RevealSection>

        {/* UNIFIED ACTIVE TEAM PARTICIPATIONS */}
        {linkedParticipations.length > 0 && (
          <RevealSection className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-6 sm:p-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Layers className="w-5 h-5 text-[#a5b0ff]" />
                <div>
                  <h2 className="font-display text-2xl font-medium tracking-[-0.02em] text-white">
                    Equipos donde <span className="font-editorial text-[#c8ceff]">juegas</span>{' '}
                    <span className="text-zinc-500 text-lg tabular-nums">
                      ({linkedParticipations.length})
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Inscripciones activas agrupadas automáticamente por disciplina.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {linkedParticipations.map((part) => {
                const pDisc = DISCIPLINE_MAP[part.disciplineId];
                const isSelected = activeLinkedPlayer?.id === part.player.id;
                return (
                  <div
                    key={part.player.id}
                    className={`rounded-2xl bg-[#101016] border p-4 flex flex-col justify-between gap-3 transition-colors ${
                      isSelected ? 'border-[#707ef9]/60' : 'border-white/[0.08]'
                    }`}
                  >
                    <div>
                      <p className="text-[11px] font-medium text-[#a5b0ff]">
                        {pDisc.nombreCorto}
                      </p>
                      <p className="font-display text-lg font-medium text-white mt-0.5 truncate">
                        {part.team?.nombre ?? part.player.teamId}
                      </p>
                      <p className="text-xs text-zinc-400 mt-1 tabular-nums">
                        Dorsal {formatDorsalLabel(part.player.dorsal)} · {part.player.posicion} ·{' '}
                        {part.player.stats.partidosJugados} PJ
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/[0.06]">
                      <button
                        type="button"
                        onClick={() => onInspectTeam(part.player.teamId)}
                        className="text-xs font-medium text-zinc-200 hover:text-white cursor-pointer"
                      >
                        Ver equipo →
                      </button>
                      {currentUser.role === 'jugador' && linkedParticipations.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSelectedLinkedPlayerId(part.player.id)}
                          className={`text-[11px] font-medium cursor-pointer ${
                            isSelected ? 'text-emerald-400' : 'text-[#a5b0ff] hover:underline'
                          }`}
                        >
                          {isSelected ? 'Editando ficha' : 'Editar ficha'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </RevealSection>
        )}

        {/* PLAYER SELF-SERVICE PROFILE EDITOR */}
        {currentUser.role === 'jugador' && activeDraft && (
          <RevealSection className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <UserCog className="w-5 h-5 text-[#a5b0ff]" />
                <div>
                  <h2 className="font-display text-2xl font-medium tracking-[-0.02em] text-white">
                    Ficha de <span className="font-editorial text-[#c8ceff]">jugador</span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Equipo: <strong className="text-zinc-200">{teamMap.get(activeDraft.teamId)?.nombre}</strong> ·{' '}
                    {DISCIPLINE_MAP[activeDraft.disciplineId].nombre}
                  </p>
                </div>
              </div>
              {linkedParticipations.length > 1 && (
                <select
                  aria-label="Seleccionar ficha de equipo a editar"
                  value={activeDraft.id}
                  onChange={(e) => setSelectedLinkedPlayerId(e.target.value)}
                  className="rounded-full bg-[#111117] border border-white/[0.12] px-4 py-2 text-xs text-zinc-100 focus:border-[#707ef9] focus:outline-none"
                >
                  {linkedParticipations.map((part) => (
                    <option key={part.player.id} value={part.player.id}>
                      {part.team?.nombre ?? part.player.teamId} ({DISCIPLINE_MAP[part.disciplineId].nombreCorto})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {profileSavedMsg && (
              <div
                role="status"
                className="rounded-2xl bg-emerald-500/10 border border-emerald-500/25 p-4 text-xs text-emerald-200 flex items-center gap-2.5"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{profileSavedMsg}</span>
              </div>
            )}

            {profileErrors.length > 0 && (
              <div
                role="alert"
                className="rounded-2xl bg-red-500/10 border border-red-500/25 p-4 text-xs text-red-200 space-y-1"
              >
                {profileErrors.map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
              </div>
            )}

            <form onSubmit={handleSaveOwnPlayerData} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="self-nombre" className="block text-xs text-zinc-400 mb-1.5">
                    Nombre
                  </label>
                  <input
                    id="self-nombre"
                    type="text"
                    value={activeDraft.nombre}
                    onChange={(e) => updateDraftField('nombre', e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="self-app" className="block text-xs text-zinc-400 mb-1.5">
                    Apellido Paterno
                  </label>
                  <input
                    id="self-app"
                    type="text"
                    value={activeDraft.apellidoPaterno}
                    onChange={(e) => updateDraftField('apellidoPaterno', e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="self-apm" className="block text-xs text-zinc-400 mb-1.5">
                    Apellido Materno
                  </label>
                  <input
                    id="self-apm"
                    type="text"
                    value={activeDraft.apellidoMaterno}
                    onChange={(e) => updateDraftField('apellidoMaterno', e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="self-dorsal" className="block text-xs text-zinc-400 mb-1.5">
                    Dorsal / Posición
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      id="self-dorsal"
                      type="number"
                      min={1}
                      max={99}
                      value={activeDraft.dorsal}
                      onChange={(e) => updateDraftField('dorsal', Number(e.target.value) || 1)}
                      className={`${INPUT_CLASS} tabular-nums !px-2.5`}
                    />
                    <input
                      aria-label="Posición de juego"
                      type="text"
                      value={activeDraft.posicion}
                      onChange={(e) => updateDraftField('posicion', e.target.value)}
                      className={`col-span-2 ${INPUT_CLASS}`}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="self-carrera" className="block text-xs text-zinc-400 mb-1.5">
                    Carrera
                  </label>
                  <select
                    id="self-carrera"
                    value={activeDraft.carrera}
                    onChange={(e) => updateDraftField('carrera', e.target.value)}
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
                  <label htmlFor="self-facultad" className="block text-xs text-zinc-400 mb-1.5">
                    Facultad
                  </label>
                  <input
                    id="self-facultad"
                    type="text"
                    readOnly
                    value={activeDraft.facultad}
                    className={READONLY_INPUT_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="self-rut" className="block text-xs text-zinc-400 mb-1.5">
                    RUT
                  </label>
                  <input
                    id="self-rut"
                    type="text"
                    value={activeDraft.rut}
                    onChange={(e) => updateDraftField('rut', e.target.value)}
                    className={`${INPUT_CLASS} tabular-nums`}
                  />
                </div>
                <div>
                  <label htmlFor="self-mat" className="block text-xs text-zinc-400 mb-1.5">
                    Número de Matrícula
                  </label>
                  <input
                    id="self-mat"
                    type="text"
                    value={activeDraft.numeroMatricula}
                    onChange={(e) => updateDraftField('numeroMatricula', e.target.value)}
                    className={`${INPUT_CLASS} tabular-nums`}
                  />
                </div>

                <div>
                  <label htmlFor="self-email" className="block text-xs text-zinc-400 mb-1.5">
                    Correo Institucional
                  </label>
                  <input
                    id="self-email"
                    type="email"
                    value={activeDraft.correoInstitucional}
                    onChange={(e) => updateDraftField('correoInstitucional', e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="self-nivel" className="block text-xs text-zinc-400 mb-1.5">
                    Pregrado / Postgrado
                  </label>
                  <select
                    id="self-nivel"
                    value={activeDraft.nivelAcademico}
                    onChange={(e) =>
                      updateDraftField('nivelAcademico', e.target.value as AcademicLevel)
                    }
                    className={INPUT_CLASS}
                  >
                    <option value="Pregrado">Pregrado</option>
                    <option value="Postgrado">Postgrado</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="self-dob" className="block text-xs text-zinc-400 mb-1.5">
                    Fecha de Nacimiento
                  </label>
                  <input
                    id="self-dob"
                    type="date"
                    value={activeDraft.fechaNacimiento}
                    onChange={(e) => updateDraftField('fechaNacimiento', e.target.value)}
                    className={`${INPUT_CLASS} tabular-nums`}
                  />
                </div>
                <div>
                  <label htmlFor="self-foto" className="block text-xs text-zinc-400 mb-1.5">
                    Fotografía del Estudiante
                  </label>
                  <label
                    htmlFor="self-foto"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-[#111117] px-3 py-2.5 text-xs text-zinc-200 hover:border-[#707ef9] transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#a5b0ff]" />
                    <span>{activeDraft.fotografia ? 'Cambiar foto' : 'Subir foto'}</span>
                  </label>
                  <input
                    id="self-foto"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="sr-only"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-white/[0.06]">
                <label className="inline-flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeDraft.esSeleccionadoUfro}
                    onChange={(e) => updateDraftField('esSeleccionadoUfro', e.target.checked)}
                    className="accent-[#707ef9] w-4 h-4"
                  />
                  <span>Seleccionado oficial UFRO</span>
                </label>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-[#707ef9] hover:bg-[#5c6bf5] text-white font-medium text-xs transition-colors cursor-pointer"
                >
                  Guardar datos oficiales
                </button>
              </div>
            </form>
          </RevealSection>
        )}

        {/* FAVORITE TEAMS + NOTIFICATIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 7 cols: Favorite Teams Manager */}
          <RevealSection className="lg:col-span-7 rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <Star className="w-5 h-5 text-[#a5b0ff]" />
                <div>
                  <h2 className="font-display text-2xl font-medium tracking-[-0.02em] text-white">
                    Equipos <span className="font-editorial text-[#c8ceff]">favoritos</span>{' '}
                    <span className="text-zinc-500 text-base tabular-nums">
                      ({currentUser.favoriteTeamIds.length}/20)
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Sigue equipos para recibir alertas de partidos, MVP y resultados.
                  </p>
                </div>
              </div>
            </div>

            {currentUser.favoriteTeamIds.length > 0 ? (
              <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-[#101016] overflow-hidden">
                {currentUser.favoriteTeamIds.map((teamId) => {
                  const t = teamMap.get(teamId);
                  if (!t) return null;
                  return (
                    <div
                      key={t.id}
                      className="px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => onInspectTeam(t.id)}
                        className="min-w-0 text-left group cursor-pointer"
                      >
                        <p className="font-medium text-sm text-white group-hover:text-[#a5b0ff] transition-colors truncate">
                          {t.nombre}
                        </p>
                        <p className="text-xs text-zinc-400 truncate mt-0.5">
                          {DISCIPLINE_MAP[t.disciplineId].nombreCorto} · {t.carrera} · {t.groupName}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleFavoriteTeam(t.id)}
                        className="text-xs font-medium text-red-400 hover:text-red-300 whitespace-nowrap cursor-pointer"
                      >
                        Quitar
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 rounded-2xl bg-[#101016] p-4 border border-white/[0.06]">
                Aún no sigues equipos. Búscalos abajo para activar notificaciones.
              </p>
            )}

            <div className="space-y-3 pt-2">
              <label htmlFor="fav-team-search" className="block text-xs font-medium text-zinc-400">
                Agregar equipo a favoritos
              </label>
              <input
                id="fav-team-search"
                type="text"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                placeholder="Buscar por nombre, carrera o disciplina..."
                className={INPUT_CLASS}
              />
              {filteredTeams.length === 0 ? (
                <p className="text-xs text-zinc-400 rounded-2xl bg-[#101016] p-4 border border-white/[0.06]">
                  {state.teams.length === 0
                    ? `Aún no hay equipos inscritos en la temporada ${state.temporada}.`
                    : 'No se encontraron equipos con ese criterio.'}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                  {filteredTeams.map((team) => {
                    const isFav = currentUser.favoriteTeamIds.includes(team.id);
                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => onToggleFavoriteTeam(team.id)}
                        className={`text-left p-3.5 rounded-2xl border text-xs transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          isFav
                            ? 'bg-[#121322] text-white border-[#707ef9]/60'
                            : 'bg-[#101016] text-zinc-200 border-white/[0.08] hover:border-white/[0.2]'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{team.nombre}</p>
                          <p className="text-zinc-400 truncate mt-0.5">
                            {DISCIPLINE_MAP[team.disciplineId].nombreCorto}
                          </p>
                        </div>
                        <Star
                          className={`w-4 h-4 shrink-0 ${
                            isFav ? 'fill-[#707ef9] text-[#707ef9]' : 'text-zinc-500'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </RevealSection>

          {/* Right 5 cols: Notifications Feed + MVP History */}
          <div className="lg:col-span-5 space-y-6">
            <RevealSection className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
                <div className="flex items-center gap-2.5">
                  <Bell className="w-4 h-4 text-[#a5b0ff]" />
                  <h2 className="font-display text-lg font-medium text-white">
                    Notificaciones{' '}
                    <span className="text-zinc-500 text-sm tabular-nums">
                      ({notifications.length})
                    </span>
                  </h2>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentUser.notificationsEnabled}
                    onChange={(e) => onToggleNotifications(e.target.checked)}
                    className="accent-[#707ef9]"
                  />
                  <span>Activas</span>
                </label>
              </div>

              {notifications.length === 0 ? (
                <p className="text-xs text-zinc-400">
                  {currentUser.notificationsEnabled
                    ? 'Agrega equipos favoritos para recibir alertas de votación MVP y resultados.'
                    : 'Las notificaciones están pausadas.'}
                </p>
              ) : (
                <div className="divide-y divide-white/[0.06] max-h-80 overflow-y-auto pr-1">
                  {notifications.map((n) => {
                    const matchObj = matchMap.get(n.matchId);
                    return (
                      <div key={n.id} className="py-3.5 space-y-1.5">
                        <span
                          className={`text-[11px] font-medium ${
                            n.type === 'VOTACION_MVP'
                              ? 'text-[#a5b0ff]'
                              : n.type === 'RESULTADO'
                              ? 'text-emerald-400'
                              : 'text-zinc-400'
                          }`}
                        >
                          {n.title}
                        </span>
                        <p className="text-xs text-zinc-400 leading-relaxed">{n.detail}</p>
                        {matchObj && (
                          <button
                            type="button"
                            onClick={() => onOpenMatchModal(matchObj)}
                            className="text-xs font-medium text-white hover:text-[#a5b0ff] transition-colors cursor-pointer"
                          >
                            {n.isLiveMvp ? 'Ir a votar MVP →' : 'Ver detalle →'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </RevealSection>

            <RevealSection className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-6 space-y-4">
              <div className="flex items-center gap-2.5 border-b border-white/[0.08] pb-3.5">
                <Award className="w-4 h-4 text-[#a5b0ff]" />
                <h2 className="font-display text-lg font-medium text-white">
                  Mis votos MVP{' '}
                  <span className="text-zinc-500 text-sm tabular-nums">
                    ({userMvpVotes.length})
                  </span>
                </h2>
              </div>
              {userMvpVotes.length === 0 ? (
                <p className="text-xs text-zinc-400">
                  Aún no has votado en una encuesta MVP. Puedes participar durante el horario de
                  cada partido.
                </p>
              ) : (
                <ul className="divide-y divide-white/[0.06] text-xs">
                  {userMvpVotes.map((v) => (
                    <li key={v.id} className="py-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-white">{v.playerName}</p>
                        <p className="text-zinc-400 mt-0.5">
                          {DISCIPLINE_MAP[v.disciplineId].nombreCorto} ·{' '}
                          {teamMap.get(v.teamId)?.nombre}
                        </p>
                      </div>
                      <span className="text-[11px] text-[#a5b0ff] font-medium shrink-0">
                        Registrado
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </RevealSection>
          </div>
        </div>
      </div>
    </div>
  );
}
