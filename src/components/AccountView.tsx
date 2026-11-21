import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Award,
  Bell,
  Camera,
  CheckCircle2,
  ClipboardList,
  Shield,
  Star,
  Upload,
  UserCog,
} from 'lucide-react';
import { DISCIPLINE_MAP, UFRO_CAREERS } from '../data/ufroSeed';
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
import type { NavSection } from './Navbar';

interface AccountViewProps {
  state: TournamentState;
  currentUser: AppUserProfile | null;
  onOpenAuth: () => void;
  onToggleFavoriteTeam: (teamId: string) => void;
  onToggleNotifications: (enabled: boolean) => void;
  onUpdatePlayerProfile: (updated: Player) => void;
  onOpenMatchModal: (match: Match) => void;
  onNavigate: (section: NavSection) => void;
}

export function AccountView({
  state,
  currentUser,
  onOpenAuth,
  onToggleFavoriteTeam,
  onToggleNotifications,
  onUpdatePlayerProfile,
  onOpenMatchModal,
  onNavigate,
}: AccountViewProps) {
  const [teamSearch, setTeamSearch] = useState('');
  const [profileSavedMsg, setProfileSavedMsg] = useState<string | null>(null);
  const [profileErrors, setProfileErrors] = useState<string[]>([]);

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

  const [draftPlayer, setDraftPlayer] = useState<Player | null>(null);
  const activeDraft =
    draftPlayer && linkedPlayer && draftPlayer.id === linkedPlayer.id ? draftPlayer : linkedPlayer;

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
      <div className="bg-white min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-lg w-full border border-neutral-200 p-8 text-center space-y-5">
          <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
            Acceso de Usuarios UFRO
          </p>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-[#0d0d0d]">
            Inicia sesión para gestionar tu cuenta
          </h1>
          <p className="text-sm text-neutral-600">
            Guarda tus equipos favoritos para recibir notificaciones, vota por el MVP durante cada
            partido o accede a herramientas de Jugador, Delegado, Árbitro, Fotógrafo o Administrador.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="px-6 py-3 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-sm cursor-pointer"
          >
            Iniciar sesión
          </button>
        </div>
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

  return (
    <div className="bg-white min-h-[75vh]">
      {/* Carbon Profile Header */}
      <div className="bg-[#0d0d0d] text-white border-b border-white/10">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
                Mi Cuenta · {roleMeta.label}
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight mt-2">
                {currentUser.displayName}
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                {currentUser.email} · {roleMeta.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-display font-bold uppercase tracking-widest cursor-pointer"
              >
                Cambiar cuenta / Sesión
              </button>
              {currentUser.role === 'delegado' && (
                <button
                  type="button"
                  onClick={() => onNavigate('inscripciones')}
                  className="px-4 py-2.5 bg-[#707ef9] hover:bg-[#5766eb] text-white text-xs font-display font-bold uppercase tracking-widest cursor-pointer"
                >
                  Gestionar mi equipo
                </button>
              )}
              {currentUser.role === 'fotografo' && (
                <button
                  type="button"
                  onClick={() => onNavigate('galeria')}
                  className="px-4 py-2.5 bg-[#707ef9] hover:bg-[#5766eb] text-white text-xs font-display font-bold uppercase tracking-widest cursor-pointer"
                >
                  Subir fotografías
                </button>
              )}
              {(currentUser.role === 'admin' || currentUser.role === 'arbitro') && (
                <button
                  type="button"
                  onClick={() => onNavigate('panel')}
                  className="px-4 py-2.5 bg-[#707ef9] hover:bg-[#5766eb] text-white text-xs font-display font-bold uppercase tracking-widest cursor-pointer"
                >
                  Ir a Panel Oficial
                </button>
              )}
            </div>
          </div>

          {/* Permissions Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/10 text-xs text-neutral-300">
            {roleMeta.permissions.map((perm, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-[#707ef9] shrink-0 mt-0.5" />
                <span>{perm}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {/* Role-specific shortcut banners */}
        {currentUser.role === 'delegado' && delegatedTeam && (
          <div className="border border-neutral-200 bg-[#f5f6f8] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ClipboardList className="w-5 h-5 text-[#707ef9] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-[#707ef9]">
                  Delegado Oficial Asignado
                </p>
                <h2 className="font-display text-2xl font-bold uppercase text-[#0d0d0d]">
                  {delegatedTeam.nombre} ({DISCIPLINE_MAP[delegatedTeam.disciplineId].nombreCorto})
                </h2>
                <p className="text-xs text-neutral-600 mt-1">
                  Puedes inscribir equipos, editar la nómina de jugadores de tu equipo y gestionar
                  transferencias post-grupos.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('inscripciones')}
                className="px-4 py-2.5 bg-[#0d0d0d] hover:bg-[#707ef9] text-white text-xs font-display font-bold uppercase tracking-widest cursor-pointer"
              >
                Inscripciones y Plantel
              </button>
              <button
                type="button"
                onClick={() => onNavigate('transferencias')}
                className="px-4 py-2.5 border border-neutral-300 bg-white hover:border-[#707ef9] text-[#0d0d0d] text-xs font-display font-bold uppercase tracking-widest cursor-pointer"
              >
                Transferencias
              </button>
            </div>
          </div>
        )}

        {currentUser.role === 'fotografo' && (
          <div className="border border-neutral-200 bg-[#f5f6f8] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Camera className="w-5 h-5 text-[#707ef9] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-[#707ef9]">
                  Perfil Fotógrafo Acreditado UFRO
                </p>
                <h2 className="font-display text-2xl font-bold uppercase text-[#0d0d0d]">
                  Estudio Fotográfico y Archivo 2025
                </h2>
                <p className="text-xs text-neutral-600 mt-1">
                  Tienes autorización para subir nuevas fotografías organizadas por disciplina y
                  encuentro a la base de datos oficial.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('galeria')}
              className="px-4 py-2.5 bg-[#707ef9] hover:bg-[#5766eb] text-white text-xs font-display font-bold uppercase tracking-widest cursor-pointer self-start md:self-auto"
            >
              Abrir Estudio Fotográfico →
            </button>
          </div>
        )}

        {/* PLAYER SELF-SERVICE PROFILE EDITOR (ONLY for 'jugador' or linked player) */}
        {currentUser.role === 'jugador' && activeDraft && (
          <section className="border border-neutral-200 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-4">
              <div className="flex items-center gap-2.5">
                <UserCog className="w-5 h-5 text-[#707ef9]" />
                <div>
                  <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                    Editar Mis Datos de Jugador (Ficha Oficial UFRO)
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Equipo: <strong>{teamMap.get(activeDraft.teamId)?.nombre}</strong> ·{' '}
                    {DISCIPLINE_MAP[activeDraft.disciplineId].nombre}
                  </p>
                </div>
              </div>
            </div>

            {profileSavedMsg && (
              <div
                role="status"
                className="bg-emerald-50 border border-emerald-300 p-4 text-xs text-emerald-950 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{profileSavedMsg}</span>
              </div>
            )}

            {profileErrors.length > 0 && (
              <div role="alert" className="bg-red-50 border border-red-300 p-4 text-xs text-red-900 space-y-1">
                {profileErrors.map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
              </div>
            )}

            <form onSubmit={handleSaveOwnPlayerData} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="self-nombre" className="block text-xs text-neutral-600 mb-1">
                    Nombre
                  </label>
                  <input
                    id="self-nombre"
                    type="text"
                    value={activeDraft.nombre}
                    onChange={(e) => updateDraftField('nombre', e.target.value)}
                    className="w-full border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-[#707ef9]"
                  />
                </div>
                <div>
                  <label htmlFor="self-app" className="block text-xs text-neutral-600 mb-1">
                    Apellido Paterno
                  </label>
                  <input
                    id="self-app"
                    type="text"
                    value={activeDraft.apellidoPaterno}
                    onChange={(e) => updateDraftField('apellidoPaterno', e.target.value)}
                    className="w-full border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-[#707ef9]"
                  />
                </div>
                <div>
                  <label htmlFor="self-apm" className="block text-xs text-neutral-600 mb-1">
                    Apellido Materno
                  </label>
                  <input
                    id="self-apm"
                    type="text"
                    value={activeDraft.apellidoMaterno}
                    onChange={(e) => updateDraftField('apellidoMaterno', e.target.value)}
                    className="w-full border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-[#707ef9]"
                  />
                </div>
                <div>
                  <label htmlFor="self-dorsal" className="block text-xs text-neutral-600 mb-1">
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
                      className="border border-neutral-300 px-2 py-2 text-sm tabular-nums focus:outline-none focus:border-[#707ef9]"
                    />
                    <input
                      aria-label="Posición de juego"
                      type="text"
                      value={activeDraft.posicion}
                      onChange={(e) => updateDraftField('posicion', e.target.value)}
                      className="col-span-2 border border-neutral-300 px-2.5 py-2 text-sm focus:outline-none focus:border-[#707ef9]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="self-carrera" className="block text-xs text-neutral-600 mb-1">
                    Carrera
                  </label>
                  <select
                    id="self-carrera"
                    value={activeDraft.carrera}
                    onChange={(e) => updateDraftField('carrera', e.target.value)}
                    className="w-full border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#707ef9]"
                  >
                    {UFRO_CAREERS.map((c) => (
                      <option key={c.carrera} value={c.carrera}>
                        {c.carrera}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="self-facultad" className="block text-xs text-neutral-600 mb-1">
                    Facultad
                  </label>
                  <input
                    id="self-facultad"
                    type="text"
                    readOnly
                    value={activeDraft.facultad}
                    className="w-full border border-neutral-200 bg-[#f5f6f8] px-3 py-2 text-sm text-neutral-600"
                  />
                </div>
                <div>
                  <label htmlFor="self-rut" className="block text-xs text-neutral-600 mb-1">
                    RUT
                  </label>
                  <input
                    id="self-rut"
                    type="text"
                    value={activeDraft.rut}
                    onChange={(e) => updateDraftField('rut', e.target.value)}
                    className="w-full border border-neutral-300 px-3 py-2 text-sm tabular-nums focus:outline-none focus:border-[#707ef9]"
                  />
                </div>
                <div>
                  <label htmlFor="self-mat" className="block text-xs text-neutral-600 mb-1">
                    Número de Matrícula
                  </label>
                  <input
                    id="self-mat"
                    type="text"
                    value={activeDraft.numeroMatricula}
                    onChange={(e) => updateDraftField('numeroMatricula', e.target.value)}
                    className="w-full border border-neutral-300 px-3 py-2 text-sm tabular-nums focus:outline-none focus:border-[#707ef9]"
                  />
                </div>

                <div>
                  <label htmlFor="self-email" className="block text-xs text-neutral-600 mb-1">
                    Correo Institucional
                  </label>
                  <input
                    id="self-email"
                    type="email"
                    value={activeDraft.correoInstitucional}
                    onChange={(e) => updateDraftField('correoInstitucional', e.target.value)}
                    className="w-full border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-[#707ef9]"
                  />
                </div>
                <div>
                  <label htmlFor="self-nivel" className="block text-xs text-neutral-600 mb-1">
                    Pregrado / Postgrado
                  </label>
                  <select
                    id="self-nivel"
                    value={activeDraft.nivelAcademico}
                    onChange={(e) =>
                      updateDraftField('nivelAcademico', e.target.value as AcademicLevel)
                    }
                    className="w-full border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#707ef9]"
                  >
                    <option value="Pregrado">Pregrado</option>
                    <option value="Postgrado">Postgrado</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="self-dob" className="block text-xs text-neutral-600 mb-1">
                    Fecha de Nacimiento
                  </label>
                  <input
                    id="self-dob"
                    type="date"
                    value={activeDraft.fechaNacimiento}
                    onChange={(e) => updateDraftField('fechaNacimiento', e.target.value)}
                    className="w-full border border-neutral-300 px-3 py-2 text-sm tabular-nums focus:outline-none focus:border-[#707ef9]"
                  />
                </div>
                <div>
                  <label htmlFor="self-foto" className="block text-xs text-neutral-600 mb-1">
                    Fotografía del Estudiante
                  </label>
                  <label
                    htmlFor="self-foto"
                    className="inline-flex w-full items-center justify-center gap-2 border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:border-[#707ef9] cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#707ef9]" />
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

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-neutral-200">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0d0d0d] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeDraft.esSeleccionadoUfro}
                    onChange={(e) => updateDraftField('esSeleccionadoUfro', e.target.checked)}
                    className="accent-[#707ef9] w-4 h-4"
                  />
                  <span>Registro de Seleccionado Oficial de la Universidad (UFRO)</span>
                </label>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-xs cursor-pointer"
                >
                  Guardar mis datos oficiales
                </button>
              </div>
            </form>
          </section>
        )}

        {/* FAVORITE TEAMS + NOTIFICATIONS (For Traditional User and all roles) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left 7 cols: Favorite Teams Manager */}
          <section className="lg:col-span-7 border border-neutral-200 p-6 space-y-5">
            <div className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-4">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-[#707ef9]" />
                <div>
                  <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                    Mis Equipos Favoritos ({currentUser.favoriteTeamIds.length}/20)
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Sigue a tus equipos para recibir alertas de horarios, votaciones MVP y resultados
                    al terminar cada partido.
                  </p>
                </div>
              </div>
            </div>

            {/* Currently Saved Favorites */}
            {currentUser.favoriteTeamIds.length > 0 ? (
              <div className="divide-y divide-neutral-200 border border-neutral-200">
                {currentUser.favoriteTeamIds.map((teamId) => {
                  const t = teamMap.get(teamId);
                  if (!t) return null;
                  return (
                    <div
                      key={t.id}
                      className="px-4 py-3 flex items-center justify-between gap-3 bg-[#f9fafb]"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-[#0d0d0d] truncate">{t.nombre}</p>
                        <p className="text-xs text-neutral-500 truncate">
                          {DISCIPLINE_MAP[t.disciplineId].nombreCorto} · {t.carrera} · {t.groupName}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleFavoriteTeam(t.id)}
                        className="text-xs font-medium text-red-600 hover:text-red-800 whitespace-nowrap cursor-pointer"
                      >
                        Quitar favorito
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-neutral-500 bg-[#f5f6f8] p-4 border border-neutral-200">
                Aún no tienes equipos guardados en favoritos. Busca un equipo abajo para comenzar a
                recibir notificaciones.
              </p>
            )}

            {/* Search & Add Favorite Team */}
            <div className="space-y-3 pt-2">
              <label htmlFor="fav-team-search" className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                Agregar equipo a favoritos
              </label>
              <input
                id="fav-team-search"
                type="text"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                placeholder="Buscar por nombre de equipo, carrera o disciplina..."
                className="w-full border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-[#707ef9]"
              />
              {filteredTeams.length === 0 ? (
                <p className="text-xs text-neutral-500 bg-[#f5f6f8] p-4 border border-neutral-200">
                  {state.teams.length === 0
                    ? `Aún no hay equipos inscritos en la temporada ${state.temporada}. Cuando se inscriban equipos podrás guardarlos en tus favoritos.`
                    : 'No se encontraron equipos con ese criterio de búsqueda.'}
                </p>
              ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {filteredTeams.map((team) => {
                  const isFav = currentUser.favoriteTeamIds.includes(team.id);
                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => onToggleFavoriteTeam(team.id)}
                      className={`text-left p-3 border text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                        isFav
                          ? 'bg-[#0d0d0d] text-white border-[#0d0d0d]'
                          : 'bg-white text-[#0d0d0d] border-neutral-200 hover:border-[#707ef9]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-bold truncate">{team.nombre}</p>
                        <p className={isFav ? 'text-neutral-400 truncate' : 'text-neutral-500 truncate'}>
                          {DISCIPLINE_MAP[team.disciplineId].nombreCorto}
                        </p>
                      </div>
                      <Star
                        className={`w-4 h-4 shrink-0 ${
                          isFav ? 'fill-[#707ef9] text-[#707ef9]' : 'text-neutral-400'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              )}
            </div>
          </section>

          {/* Right 5 cols: Notifications Feed + MVP History */}
          <div className="lg:col-span-5 space-y-6">
            <section className="border border-neutral-200 p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-neutral-200 pb-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-[#707ef9]" />
                  <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                    Notificaciones ({notifications.length})
                  </h2>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-neutral-600 cursor-pointer">
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
                <p className="text-xs text-neutral-500">
                  {currentUser.notificationsEnabled
                    ? 'Agrega equipos a tus favoritos para recibir alertas de votación MVP y resultados publicados.'
                    : 'Las notificaciones están pausadas.'}
                </p>
              ) : (
                <div className="divide-y divide-neutral-200 max-h-80 overflow-y-auto">
                  {notifications.map((n) => {
                    const matchObj = matchMap.get(n.matchId);
                    return (
                      <div key={n.id} className="py-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[11px] font-bold uppercase tracking-wider ${
                              n.type === 'VOTACION_MVP'
                                ? 'text-[#707ef9]'
                                : n.type === 'RESULTADO'
                                ? 'text-emerald-700'
                                : 'text-neutral-500'
                            }`}
                          >
                            {n.title}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-600 leading-relaxed">{n.detail}</p>
                        {matchObj && (
                          <button
                            type="button"
                            onClick={() => onOpenMatchModal(matchObj)}
                            className="text-xs font-medium text-[#0d0d0d] hover:text-[#707ef9] cursor-pointer"
                          >
                            {n.isLiveMvp ? 'Ir a votar MVP →' : 'Ver detalle del encuentro →'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="border border-neutral-200 bg-[#f5f6f8] p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
                <Award className="w-5 h-5 text-[#707ef9]" />
                <h2 className="font-display text-xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                  Mis Votos MVP ({userMvpVotes.length})
                </h2>
              </div>
              {userMvpVotes.length === 0 ? (
                <p className="text-xs text-neutral-600">
                  Aún no has votado en una encuesta MVP. Durante la hora programada de cualquier
                  encuentro podrás votar desde el Inicio.
                </p>
              ) : (
                <ul className="divide-y divide-neutral-200 text-xs">
                  {userMvpVotes.map((v) => (
                    <li key={v.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-[#0d0d0d]">{v.playerName}</p>
                        <p className="text-neutral-500">
                          {DISCIPLINE_MAP[v.disciplineId].nombreCorto} ·{' '}
                          {teamMap.get(v.teamId)?.nombre}
                        </p>
                      </div>
                      <span className="text-[11px] text-[#707ef9] font-medium shrink-0">
                        Voto registrado
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
