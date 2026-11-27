import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Award,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  Layers,
  Search,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP, UFRO_CAREERS, UFRO_FACULTIES } from '../data/ufroSeed';
import { computePlayerAttendanceSummary } from '../domain/attendanceEngine';
import {
  buildUnifiedPlayers,
  findPlayerParticipations,
  normalizeTextToken,
} from '../domain/identityCrossRefEngine';
import { computePlayerSeasonPerformance } from '../domain/playerPerformanceEngine';
import { canEditPlayerProfile } from '../domain/rbacEngine';
import { formatRut, validateRut, validateUfroEmail } from '../domain/tournamentEngine';
import { PlayerPerformanceChart } from './PlayerPerformanceChart';
import type {
  AcademicLevel,
  AppUserProfile,
  DisciplineId,
  Player,
  TournamentState,
} from '../types/tournament';

interface PlayersViewProps {
  state: TournamentState;
  currentUser: AppUserProfile | null;
  selectedPlayer: Player | null;
  onSelectPlayer: (player: Player | null) => void;
  onInspectTeam: (teamId: string) => void;
  onUpdatePlayer: (updated: Player) => void;
}

const PAGE_SIZE = 40;

export function PlayersView({
  state,
  currentUser,
  selectedPlayer,
  onSelectPlayer,
  onInspectTeam,
  onUpdatePlayer,
}: PlayersViewProps) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [disciplineFilter, setDisciplineFilter] = useState<'ALL' | DisciplineId>('ALL');
  const [facultyFilter, setFacultyFilter] = useState<string>('ALL');
  const [levelFilter, setLevelFilter] = useState<'ALL' | AcademicLevel>('ALL');
  const [onlySelectedUfro, setOnlySelectedUfro] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Inline edit state for authorized roles (admin, delegate of same team, or player editing self)
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Player | null>(null);
  const [editErrors, setEditErrors] = useState<string[]>([]);
  const [editSaved, setEditSaved] = useState<string | null>(null);

  const teamMap = useMemo(() => new Map(state.teams.map((t) => [t.id, t])), [state.teams]);

  // Consolidate players who compete in multiple teams/disciplines into 1 profile per person (O(N))
  const unifiedPlayers = useMemo(
    () => buildUnifiedPlayers(state.players, state.teams),
    [state.players, state.teams]
  );

  // Precomputed O(1) lookup map from any playerId -> unified profile + accent-insensitive search index
  const { profileByPlayerId, indexedProfiles, multiTeamPlayerCount } = useMemo(() => {
    const byId = new Map<string, (typeof unifiedPlayers)[number]>();
    let multiCount = 0;
    const indexed = unifiedPlayers.map((profile) => {
      if (profile.participations.length > 1) multiCount += 1;
      const faculties = new Set<string>();
      const levels = new Set<AcademicLevel>();
      const searchTokens: string[] = [];

      for (const part of profile.participations) {
        const p = part.player;
        byId.set(p.id, profile);
        faculties.add(p.facultad);
        levels.add(p.nivelAcademico);
        searchTokens.push(
          p.nombre,
          p.apellidoPaterno,
          p.apellidoMaterno,
          p.rut,
          p.carrera,
          part.team?.nombre ?? '',
          DISCIPLINE_MAP[p.disciplineId].nombreCorto,
          p.numeroMatricula
        );
      }

      return {
        profile,
        disciplineSet: new Set(profile.disciplines),
        faculties,
        levels,
        searchText: normalizeTextToken(searchTokens.join(' ')),
      };
    });
    return {
      profileByPlayerId: byId,
      indexedProfiles: indexed,
      multiTeamPlayerCount: multiCount,
    };
  }, [unifiedPlayers]);

  const liveSelectedPlayer = useMemo(() => {
    if (!selectedPlayer) return null;
    const unified = profileByPlayerId.get(selectedPlayer.id);
    if (unified) {
      return unified.records.find((p) => p.id === selectedPlayer.id) ?? selectedPlayer;
    }
    return state.players.find((p) => p.id === selectedPlayer.id) ?? selectedPlayer;
  }, [selectedPlayer, profileByPlayerId, state.players]);

  const selectedPlayerParticipations = useMemo(() => {
    if (!liveSelectedPlayer) return [];
    const unified = profileByPlayerId.get(liveSelectedPlayer.id);
    if (unified) return unified.participations;
    return findPlayerParticipations(liveSelectedPlayer, state.players, state.teams);
  }, [liveSelectedPlayer, profileByPlayerId, state.players, state.teams]);

  const [activeParticipationId, setActiveParticipationId] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<'ficha' | 'rendimiento'>('ficha');

  useEffect(() => {
    setActiveParticipationId(liveSelectedPlayer?.id ?? null);
    setProfileTab('ficha');
  }, [liveSelectedPlayer?.id]);

  const activeParticipationRecord = useMemo(() => {
    if (!liveSelectedPlayer) return null;
    if (activeParticipationId) {
      const found = selectedPlayerParticipations.find((p) => p.player.id === activeParticipationId);
      if (found) return found.player;
    }
    return liveSelectedPlayer;
  }, [liveSelectedPlayer, activeParticipationId, selectedPlayerParticipations]);

  // Compute historical performance chart data lazily only when the Rendimiento tab is active
  const activePerformanceSummary = useMemo(() => {
    if (!activeParticipationRecord || profileTab !== 'rendimiento') return null;
    const sportType = DISCIPLINE_MAP[activeParticipationRecord.disciplineId].sportType;
    return computePlayerSeasonPerformance(
      activeParticipationRecord,
      state.matches,
      sportType,
      teamMap
    );
  }, [activeParticipationRecord, profileTab, state.matches, teamMap]);

  const activeAttendanceSummary = useMemo(() => {
    if (!activeParticipationRecord || profileTab !== 'ficha') return null;
    return computePlayerAttendanceSummary(
      state.matches,
      activeParticipationRecord.id,
      activeParticipationRecord.teamId
    );
  }, [activeParticipationRecord, profileTab, state.matches]);

  useEffect(() => {
    setIsEditing(false);
    setDraft(activeParticipationRecord);
    setEditErrors([]);
    setEditSaved(null);
  }, [activeParticipationRecord?.id]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [deferredQuery, disciplineFilter, facultyFilter, levelFilter, onlySelectedUfro]);

  const canEditSelected = activeParticipationRecord
    ? canEditPlayerProfile(currentUser, activeParticipationRecord)
    : false;

  const handleSaveEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const errs: string[] = [];
    if (!draft.nombre.trim()) errs.push('Falta el Nombre.');
    if (!draft.apellidoPaterno.trim()) errs.push('Falta el Apellido Paterno.');
    if (!draft.apellidoMaterno.trim()) errs.push('Falta el Apellido Materno.');
    if (!validateRut(draft.rut)) errs.push('El RUT ingresado no es válido.');
    if (!draft.numeroMatricula.trim()) errs.push('Falta el Número de Matrícula.');
    if (!validateUfroEmail(draft.correoInstitucional)) {
      errs.push('El correo institucional debe ser @ufromail.cl o @ufrontera.cl.');
    }
    if (!draft.fechaNacimiento) errs.push('Falta la Fecha de Nacimiento.');

    if (errs.length > 0) {
      setEditErrors(errs);
      return;
    }

    const cleaned: Player = {
      ...draft,
      nombre: draft.nombre.trim(),
      apellidoPaterno: draft.apellidoPaterno.trim(),
      apellidoMaterno: draft.apellidoMaterno.trim(),
      rut: formatRut(draft.rut),
      numeroMatricula: draft.numeroMatricula.trim(),
      correoInstitucional: draft.correoInstitucional.trim().toLowerCase(),
    };
    onUpdatePlayer(cleaned);
    onSelectPlayer(cleaned);
    setEditErrors([]);
    setIsEditing(false);
    setEditSaved('Ficha oficial actualizada correctamente.');
  };

  const matchedProfiles = useMemo(() => {
    const normalizedQ = normalizeTextToken(deferredQuery);
    const terms = normalizedQ ? normalizedQ.split(' ') : [];
    const results: (typeof unifiedPlayers)[number][] = [];

    for (let i = 0; i < indexedProfiles.length; i++) {
      const entry = indexedProfiles[i];
      if (disciplineFilter !== 'ALL' && !entry.disciplineSet.has(disciplineFilter)) {
        continue;
      }
      if (facultyFilter !== 'ALL' && !entry.faculties.has(facultyFilter)) {
        continue;
      }
      if (levelFilter !== 'ALL' && !entry.levels.has(levelFilter)) {
        continue;
      }
      if (onlySelectedUfro && !entry.profile.esSeleccionadoUfro) {
        continue;
      }
      if (terms.length > 0) {
        let allMatched = true;
        for (let t = 0; t < terms.length; t++) {
          if (!entry.searchText.includes(terms[t])) {
            allMatched = false;
            break;
          }
        }
        if (!allMatched) continue;
      }
      results.push(entry.profile);
    }

    return results;
  }, [indexedProfiles, deferredQuery, disciplineFilter, facultyFilter, levelFilter, onlySelectedUfro]);

  const filteredProfiles = useMemo(
    () => matchedProfiles.slice(0, visibleCount),
    [matchedProfiles, visibleCount]
  );

  const hasMoreProfiles = filteredProfiles.length < matchedProfiles.length;
  const remainingProfilesCount = matchedProfiles.length - filteredProfiles.length;

  const getInitials = (p: Player) =>
    `${p.nombre[0] ?? ''}${p.apellidoPaterno[0] ?? ''}`.toUpperCase();

  return (
    <div className="bg-white min-h-[75vh]">
      {/* Dark Header */}
      <div className="bg-[#0d0d0d] text-white border-b border-white/10">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
            Registro oficial estudiantil · UFRO
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight mt-2">
            Perfiles de Jugadores y Estadísticas
          </h1>
          <p className="text-sm text-neutral-400 mt-2 max-w-2xl">
            Consulta el padrón verificado de deportistas de pregrado y postgrado, su rendimiento
            por disciplina y condición de seleccionado universitario UFRO.
          </p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="border-b border-neutral-200 bg-[#f5f6f8]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, RUT, matrícula, equipo o carrera..."
              aria-label="Buscar jugadores"
              className="w-full bg-white border border-neutral-300 pl-9 pr-3 py-2 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
            />
          </div>

          <div className="lg:col-span-3">
            <select
              value={disciplineFilter}
              onChange={(e) => setDisciplineFilter(e.target.value as 'ALL' | DisciplineId)}
              aria-label="Filtrar por disciplina"
              className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
            >
              <option value="ALL">Todas las disciplinas</option>
              {DISCIPLINES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={facultyFilter}
              onChange={(e) => setFacultyFilter(e.target.value)}
              aria-label="Filtrar por facultad"
              className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
            >
              <option value="ALL">Todas las facultades</option>
              {UFRO_FACULTIES.map((fac) => (
                <option key={fac} value={fac}>
                  {fac}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-1">
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as 'ALL' | AcademicLevel)}
              aria-label="Filtrar por nivel académico"
              className="w-full bg-white border border-neutral-300 px-2 py-2 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
            >
              <option value="ALL">Nivel</option>
              <option value="Pregrado">Pregrado</option>
              <option value="Postgrado">Postgrado</option>
            </select>
          </div>

          <div className="lg:col-span-2 flex items-center justify-end">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0d0d0d] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlySelectedUfro}
                onChange={(e) => setOnlySelectedUfro(e.target.checked)}
                className="accent-[#707ef9] w-4 h-4"
              />
              <span>Solo Seleccionado UFRO</span>
            </label>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500 mb-4">
          <span className="tabular-nums">
            Mostrando {filteredProfiles.length} de {matchedProfiles.length} perfiles
            {matchedProfiles.length !== unifiedPlayers.length
              ? ` (${unifiedPlayers.length} totales)`
              : ' únicos'}
            {multiTeamPlayerCount > 0 && (
              <span className="text-[#707ef9] font-medium">
                {' '}· {multiTeamPlayerCount} participan en múltiples equipos/disciplinas
              </span>
            )}
          </span>
          <span>Haz clic en un jugador para abrir su ficha unificada UFRO</span>
        </div>

        {filteredProfiles.length === 0 ? (
          <div className="border border-neutral-200 bg-[#f5f6f8] p-12 text-center space-y-3">
            <p className="font-display text-xl uppercase text-[#0d0d0d]">
              {state.players.length === 0
                ? `Aún no hay estudiantes inscritos en la temporada ${state.temporada}`
                : 'No se encontraron jugadores con los filtros aplicados'}
            </p>
            {state.players.length === 0 ? (
              <p className="text-xs text-neutral-600 max-w-md mx-auto">
                Las fichas estudiantiles aparecerán aquí automáticamente conforme los Delegados de
                Equipo y Administradores registren los planteles oficiales en Inscripciones.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setDisciplineFilter('ALL');
                  setFacultyFilter('ALL');
                  setLevelFilter('ALL');
                  setOnlySelectedUfro(false);
                }}
                className="px-4 py-2 text-xs font-display uppercase tracking-widest bg-[#0d0d0d] text-white cursor-pointer"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="border border-neutral-200 overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#f5f6f8] border-b border-neutral-200 text-xs text-neutral-500 uppercase">
                  <th className="py-3 px-4 font-medium">Estudiante</th>
                  <th className="py-3 px-3 font-medium">Equipos y Disciplinas</th>
                  <th className="py-3 px-3 hidden md:table-cell font-medium">Carrera / Nivel</th>
                  <th className="py-3 px-3 hidden lg:table-cell font-medium">RUT</th>
                  <th className="py-3 px-3 text-right font-medium tabular-nums">PJ</th>
                  <th className="py-3 px-3 text-right font-medium tabular-nums">Rendimiento</th>
                  <th className="py-3 px-4 text-right font-medium">Ficha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredProfiles.map((profile) => {
                  const focusedParticipation =
                    disciplineFilter !== 'ALL'
                      ? profile.participations.find((p) => p.disciplineId === disciplineFilter) ??
                        profile.participations[0]
                      : profile.participations[0];
                  const player = focusedParticipation.player;
                  const primary = profile.primaryRecord;
                  const disc = DISCIPLINE_MAP[player.disciplineId];
                  const statLabel =
                    disc.sportType === 'futbol7'
                      ? `${player.stats.goles}G / ${player.stats.asistencias}A`
                      : disc.sportType === 'voleibol'
                      ? `${player.stats.puntos} Pts / ${player.stats.aces} Aces`
                      : `${player.stats.puntos} Pts / ${player.stats.rebotes} Reb`;
                  const isMulti = profile.participations.length > 1;

                  return (
                    <tr
                      key={profile.personKey}
                      className="hover:bg-[#f9fafb] transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {primary.fotografia ? (
                            <img
                              src={primary.fotografia}
                              alt={`${primary.nombre} ${primary.apellidoPaterno}`}
                              loading="lazy"
                              decoding="async"
                              className="w-9 h-9 object-cover border border-neutral-200 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-9 h-9 bg-[#0d0d0d] text-white font-display text-xs font-bold flex items-center justify-center shrink-0">
                              {getInitials(primary)}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-[#0d0d0d]">
                              {primary.nombre} {primary.apellidoPaterno}
                              {primary.apellidoMaterno && !/^[-–—\s.]+$/.test(primary.apellidoMaterno)
                                ? ` ${primary.apellidoMaterno}`
                                : ''}
                            </p>
                            <p className="text-xs text-neutral-500">
                              #{player.dorsal} · {player.posicion}
                              {isMulti && (
                                <span className="text-[#707ef9] font-medium">
                                  {' '}· {profile.participations.length} equipos
                                </span>
                              )}
                              {profile.esSeleccionadoUfro && (
                                <span className="text-[#707ef9] font-medium"> · Seleccionado UFRO</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="space-y-1.5">
                          {profile.participations.map((part) => {
                            const partDisc = DISCIPLINE_MAP[part.disciplineId];
                            return (
                              <div key={part.player.id} className="leading-tight">
                                <button
                                  type="button"
                                  onClick={() => onInspectTeam(part.player.teamId)}
                                  className="text-left group cursor-pointer"
                                >
                                  <span className="font-medium text-[#0d0d0d] group-hover:text-[#707ef9] transition-colors">
                                    {part.team?.nombre ?? part.player.teamId}
                                  </span>
                                  <span className="text-xs text-neutral-500 ml-1.5">
                                    · {partDisc.nombreCorto} (#{part.player.dorsal})
                                  </span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 hidden md:table-cell">
                        <p className="text-xs text-[#0d0d0d]">{primary.carrera}</p>
                        <p className="text-xs text-neutral-500">{primary.nivelAcademico}</p>
                      </td>
                      <td className="py-3.5 px-3 hidden lg:table-cell text-xs tabular-nums text-neutral-600">
                        {primary.rut || 'Reservado'}
                      </td>
                      <td className="py-3.5 px-3 text-right tabular-nums text-neutral-700">
                        {disciplineFilter !== 'ALL'
                          ? player.stats.partidosJugados
                          : profile.totalPartidosJugados}
                      </td>
                      <td className="py-3.5 px-3 text-right tabular-nums font-medium text-[#0d0d0d]">
                        <span>{statLabel}</span>
                        {isMulti && disciplineFilter === 'ALL' && (
                          <span className="block text-[10px] font-normal text-neutral-500">
                            {disc.nombreCorto}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectPlayer(player)}
                          className="text-xs font-display font-bold uppercase tracking-wider text-[#707ef9] hover:text-[#0d0d0d] cursor-pointer"
                        >
                          Ver perfil
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {hasMoreProfiles && (
              <div className="bg-[#f5f6f8] border-t border-neutral-200 px-4 py-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-neutral-600 tabular-nums">
                  Mostrando {filteredProfiles.length} de {matchedProfiles.length} jugadores
                </p>
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                  className="px-4 py-2 bg-[#0d0d0d] hover:bg-[#707ef9] text-white text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer"
                >
                  Mostrar {Math.min(PAGE_SIZE, remainingProfilesCount)} más ({remainingProfilesCount} restantes)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detailed Unified Player Profile Modal with all 12 official UFRO fields & Multi-Team Participations */}
      {activeParticipationRecord && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="player-profile-title"
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 p-4 sm:py-8 overflow-y-auto"
        >
          <div className="bg-white w-full max-w-3xl border border-neutral-200 shadow-2xl my-auto overflow-hidden">
            {/* Dark Editorial Header */}
            <div className="bg-[#0d0d0d] text-white p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-5">
                  {activeParticipationRecord.fotografia ? (
                    <img
                      src={activeParticipationRecord.fotografia}
                      alt={`${activeParticipationRecord.nombre} ${activeParticipationRecord.apellidoPaterno}`}
                      className="w-20 h-20 object-cover border border-white/20 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-[#1c1c22] border border-white/15 flex flex-col items-center justify-center shrink-0">
                      <span className="font-display text-2xl font-bold text-[#707ef9]">
                        {getInitials(activeParticipationRecord)}
                      </span>
                      <span className="text-[11px] text-neutral-400 tabular-nums">
                        #{activeParticipationRecord.dorsal}
                      </span>
                    </div>
                  )}

                  <div>
                    <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
                      {selectedPlayerParticipations.length > 1
                        ? `Perfil Unificado · ${selectedPlayerParticipations.length} equipos activos`
                        : DISCIPLINE_MAP[activeParticipationRecord.disciplineId].nombre}
                    </p>
                    <h2
                      id="player-profile-title"
                      className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-tight mt-1"
                    >
                      {activeParticipationRecord.nombre} {activeParticipationRecord.apellidoPaterno}
                      {activeParticipationRecord.apellidoMaterno &&
                      !/^[-–—\s.]+$/.test(activeParticipationRecord.apellidoMaterno)
                        ? ` ${activeParticipationRecord.apellidoMaterno}`
                        : ''}
                    </h2>
                    <p className="text-xs text-neutral-300 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectPlayer(null);
                          onInspectTeam(activeParticipationRecord.teamId);
                        }}
                        className="underline hover:text-[#707ef9] cursor-pointer"
                      >
                        {teamMap.get(activeParticipationRecord.teamId)?.nombre}
                      </button>{' '}
                      · {activeParticipationRecord.posicion} · Dorsal #{activeParticipationRecord.dorsal}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectPlayer(null)}
                  aria-label="Cerrar perfil de jugador"
                  className="p-2 text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Multi-team / Multi-discipline switcher */}
              {selectedPlayerParticipations.length > 1 && (
                <div className="border-t border-white/10 pt-4 space-y-2">
                  <p className="text-[11px] uppercase tracking-widest text-neutral-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#707ef9]" />
                    <span>Equipos donde participa ({selectedPlayerParticipations.length})</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedPlayerParticipations.map((part) => {
                      const isCurrent = part.player.id === activeParticipationRecord.id;
                      const pDisc = DISCIPLINE_MAP[part.disciplineId];
                      return (
                        <button
                          key={part.player.id}
                          type="button"
                          onClick={() => setActiveParticipationId(part.player.id)}
                          className={`px-3 py-1.5 text-xs border transition-colors text-left cursor-pointer ${
                            isCurrent
                              ? 'bg-[#707ef9] text-white border-[#707ef9]'
                              : 'bg-white/5 text-neutral-200 border-white/15 hover:bg-white/15'
                          }`}
                        >
                          <span className="font-bold">{part.team?.nombre ?? part.player.teamId}</span>
                          <span className="block text-[10px] opacity-85">
                            {pDisc.nombreCorto} · #{part.player.dorsal} · {part.player.posicion}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal View Switcher: Ficha vs Rendimiento Histórico */}
            <div
              role="tablist"
              aria-label="Secciones del perfil del jugador"
              className="flex items-center border-b border-neutral-200 bg-[#f5f6f8] px-6"
            >
              <button
                type="button"
                role="tab"
                aria-selected={profileTab === 'ficha'}
                onClick={() => setProfileTab('ficha')}
                className={`inline-flex items-center gap-2 px-4 py-3 text-xs font-display font-bold uppercase tracking-widest border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  profileTab === 'ficha'
                    ? 'border-[#707ef9] text-[#0d0d0d] bg-white'
                    : 'border-transparent text-neutral-500 hover:text-[#0d0d0d]'
                }`}
              >
                <User className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Ficha y Resumen</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={profileTab === 'rendimiento'}
                onClick={() => setProfileTab('rendimiento')}
                className={`inline-flex items-center gap-2 px-4 py-3 text-xs font-display font-bold uppercase tracking-widest border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  profileTab === 'rendimiento'
                    ? 'border-[#707ef9] text-[#0d0d0d] bg-white'
                    : 'border-transparent text-neutral-500 hover:text-[#0d0d0d]'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Rendimiento Histórico</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {profileTab === 'rendimiento' && activePerformanceSummary ? (
                <PlayerPerformanceChart
                  summary={activePerformanceSummary}
                  playerName={`${activeParticipationRecord.nombre} ${activeParticipationRecord.apellidoPaterno}`}
                  teamName={
                    teamMap.get(activeParticipationRecord.teamId)?.nombre ??
                    activeParticipationRecord.teamId
                  }
                  disciplineLabel={DISCIPLINE_MAP[activeParticipationRecord.disciplineId].nombreCorto}
                  season={state.temporada}
                />
              ) : (
                <>
              {editSaved && (
                <div
                  role="status"
                  className="bg-emerald-50 border border-emerald-300 p-3 text-xs text-emerald-950 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{editSaved}</span>
                </div>
              )}

              {/* Explicit Teams Participations Summary Card */}
              <div className="bg-[#f5f6f8] border border-neutral-200 p-4 space-y-2.5">
                <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 font-semibold">
                  Participación Activa en el Campeonato ({selectedPlayerParticipations.length}{' '}
                  {selectedPlayerParticipations.length === 1 ? 'equipo' : 'equipos'})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedPlayerParticipations.map((part) => {
                    const pDisc = DISCIPLINE_MAP[part.disciplineId];
                    const isCurrent = part.player.id === activeParticipationRecord.id;
                    return (
                      <div
                        key={`card-${part.player.id}`}
                        className={`p-2.5 border flex items-center justify-between gap-2 bg-white ${
                          isCurrent ? 'border-[#707ef9]' : 'border-neutral-200'
                        }`}
                      >
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectPlayer(null);
                              onInspectTeam(part.player.teamId);
                            }}
                            className="text-xs font-bold text-[#0d0d0d] hover:text-[#707ef9] truncate block cursor-pointer"
                          >
                            {part.team?.nombre ?? part.player.teamId}
                          </button>
                          <p className="text-[11px] text-neutral-500 truncate">
                            {pDisc.nombreCorto} · #{part.player.dorsal} · {part.player.posicion}
                          </p>
                        </div>
                        {selectedPlayerParticipations.length > 1 && !isCurrent && (
                          <button
                            type="button"
                            onClick={() => setActiveParticipationId(part.player.id)}
                            className="text-[11px] font-bold text-[#707ef9] hover:underline shrink-0 cursor-pointer"
                          >
                            Ver stats
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 border-b border-neutral-200 pb-2 mb-4">
                  <h3 className="font-display text-sm font-bold uppercase tracking-widest text-neutral-500">
                    Ficha Estudiantil Oficial (Plantilla Google Sheets UFRO)
                  </h3>
                  {canEditSelected && !isEditing && (
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(activeParticipationRecord);
                        setEditErrors([]);
                        setEditSaved(null);
                        setIsEditing(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#707ef9] hover:bg-[#5766eb] text-white text-xs font-display font-bold uppercase tracking-wider cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar ficha oficial</span>
                    </button>
                  )}
                </div>

                {isEditing && draft ? (
                  <form onSubmit={handleSaveEdit} className="space-y-4">
                    {editErrors.length > 0 && (
                      <div role="alert" className="bg-red-50 border border-red-300 p-3 text-xs text-red-900 space-y-1">
                        {editErrors.map((err, i) => (
                          <p key={i}>{err}</p>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <label htmlFor="ed-nombre" className="block text-xs text-neutral-500 mb-1">
                          Nombre
                        </label>
                        <input
                          id="ed-nombre"
                          type="text"
                          value={draft.nombre}
                          onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
                          className="w-full border border-neutral-300 px-2.5 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="ed-app" className="block text-xs text-neutral-500 mb-1">
                          Apellido Paterno
                        </label>
                        <input
                          id="ed-app"
                          type="text"
                          value={draft.apellidoPaterno}
                          onChange={(e) => setDraft({ ...draft, apellidoPaterno: e.target.value })}
                          className="w-full border border-neutral-300 px-2.5 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="ed-apm" className="block text-xs text-neutral-500 mb-1">
                          Apellido Materno
                        </label>
                        <input
                          id="ed-apm"
                          type="text"
                          value={draft.apellidoMaterno}
                          onChange={(e) => setDraft({ ...draft, apellidoMaterno: e.target.value })}
                          className="w-full border border-neutral-300 px-2.5 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="ed-carrera" className="block text-xs text-neutral-500 mb-1">
                          Carrera
                        </label>
                        <select
                          id="ed-carrera"
                          value={draft.carrera}
                          onChange={(e) => {
                            const found = UFRO_CAREERS.find((c) => c.carrera === e.target.value);
                            setDraft({
                              ...draft,
                              carrera: e.target.value,
                              facultad: found?.facultad ?? draft.facultad,
                            });
                          }}
                          className="w-full border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
                        >
                          {UFRO_CAREERS.map((c) => (
                            <option key={c.carrera} value={c.carrera}>
                              {c.carrera}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="ed-rut" className="block text-xs text-neutral-500 mb-1">
                          RUT
                        </label>
                        <input
                          id="ed-rut"
                          type="text"
                          value={draft.rut}
                          onChange={(e) => setDraft({ ...draft, rut: e.target.value })}
                          className="w-full border border-neutral-300 px-2.5 py-1.5 text-sm tabular-nums"
                        />
                      </div>
                      <div>
                        <label htmlFor="ed-mat" className="block text-xs text-neutral-500 mb-1">
                          Número de matrícula
                        </label>
                        <input
                          id="ed-mat"
                          type="text"
                          value={draft.numeroMatricula}
                          onChange={(e) => setDraft({ ...draft, numeroMatricula: e.target.value })}
                          className="w-full border border-neutral-300 px-2.5 py-1.5 text-sm tabular-nums"
                        />
                      </div>
                      <div>
                        <label htmlFor="ed-email" className="block text-xs text-neutral-500 mb-1">
                          Correo institucional
                        </label>
                        <input
                          id="ed-email"
                          type="email"
                          value={draft.correoInstitucional}
                          onChange={(e) =>
                            setDraft({ ...draft, correoInstitucional: e.target.value })
                          }
                          className="w-full border border-neutral-300 px-2.5 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="ed-nivel" className="block text-xs text-neutral-500 mb-1">
                          Nivel académico
                        </label>
                        <select
                          id="ed-nivel"
                          value={draft.nivelAcademico}
                          onChange={(e) =>
                            setDraft({ ...draft, nivelAcademico: e.target.value as AcademicLevel })
                          }
                          className="w-full border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
                        >
                          <option value="Pregrado">Pregrado</option>
                          <option value="Postgrado">Postgrado</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="ed-dob" className="block text-xs text-neutral-500 mb-1">
                          Fecha de nacimiento
                        </label>
                        <input
                          id="ed-dob"
                          type="date"
                          value={draft.fechaNacimiento}
                          onChange={(e) => setDraft({ ...draft, fechaNacimiento: e.target.value })}
                          className="w-full border border-neutral-300 px-2.5 py-1.5 text-sm tabular-nums"
                        />
                      </div>
                      <div className="flex items-end pb-1">
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0d0d0d] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={draft.esSeleccionadoUfro}
                            onChange={(e) =>
                              setDraft({ ...draft, esSeleccionadoUfro: e.target.checked })
                            }
                            className="accent-[#707ef9] w-4 h-4"
                          />
                          <span>Seleccionado Oficial UFRO</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(false);
                          setEditErrors([]);
                        }}
                        className="px-4 py-2 border border-neutral-300 text-xs font-medium text-neutral-700 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-[#707ef9] hover:bg-[#5766eb] text-white text-xs font-display font-bold uppercase tracking-widest cursor-pointer"
                      >
                        Guardar cambios
                      </button>
                    </div>
                  </form>
                ) : (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 text-sm">
                    <div>
                      <dt className="text-xs text-neutral-500">Nombre</dt>
                      <dd className="font-medium text-[#0d0d0d]">{activeParticipationRecord.nombre}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-neutral-500">Apellidos (Paterno / Materno)</dt>
                      <dd className="font-medium text-[#0d0d0d]">
                        {activeParticipationRecord.apellidoPaterno} {activeParticipationRecord.apellidoMaterno}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-neutral-500">Carrera</dt>
                      <dd className="font-medium text-[#0d0d0d]">{activeParticipationRecord.carrera}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-neutral-500">Facultad</dt>
                      <dd className="font-medium text-[#0d0d0d]">{activeParticipationRecord.facultad}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-neutral-500">RUT</dt>
                      <dd className="font-medium tabular-nums text-[#0d0d0d]">
                        {activeParticipationRecord.rut || 'Reservado (Solo Admin/Delegado)'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-neutral-500">Número de matrícula</dt>
                      <dd className="font-medium tabular-nums text-[#0d0d0d]">
                        {activeParticipationRecord.numeroMatricula || 'Reservado (Solo Admin/Delegado)'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-neutral-500">Correo electrónico institucional</dt>
                      <dd className="font-medium text-[#0d0d0d] break-all">
                        {activeParticipationRecord.correoInstitucional || 'Reservado (Solo Admin/Delegado)'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-neutral-500">Nivel académico</dt>
                      <dd className="font-medium text-[#0d0d0d]">{activeParticipationRecord.nivelAcademico}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-neutral-500">Fecha de nacimiento</dt>
                      <dd className="font-medium tabular-nums text-[#0d0d0d]">
                        {activeParticipationRecord.fechaNacimiento || 'Reservado (Solo Admin/Delegado)'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-neutral-500">Seleccionado Universidad UFRO</dt>
                      <dd className="font-medium text-[#0d0d0d] flex items-center gap-1.5">
                        {activeParticipationRecord.esSeleccionadoUfro ? (
                          <>
                            <Award className="w-4 h-4 text-[#707ef9]" />
                            <span className="text-[#707ef9] font-bold">Sí — Seleccionado Oficial UFRO</span>
                          </>
                        ) : (
                          <span>No</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>

              {/* Discipline Stats Grid */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-2 mb-4">
                  <h3 className="font-display text-sm font-bold uppercase tracking-widest text-neutral-500">
                    Estadísticas Temporada {state.temporada} ·{' '}
                    {DISCIPLINE_MAP[activeParticipationRecord.disciplineId].nombreCorto} (
                    {teamMap.get(activeParticipationRecord.teamId)?.nombre ??
                      activeParticipationRecord.teamId}
                    )
                  </h3>
                  <button
                    type="button"
                    onClick={() => setProfileTab('rendimiento')}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#707ef9] hover:text-[#5766eb] hover:underline cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Ver gráficos históricos →</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[#f5f6f8] p-4 border border-neutral-200">
                  <div>
                    <p className="text-xs text-neutral-500">Partidos jugados</p>
                    <p className="font-display text-2xl font-bold tabular-nums text-[#0d0d0d]">
                      {activeParticipationRecord.stats.partidosJugados}
                    </p>
                  </div>
                  {DISCIPLINE_MAP[activeParticipationRecord.disciplineId].sportType === 'futbol7' && (
                    <>
                      <div>
                        <p className="text-xs text-neutral-500">Goles</p>
                        <p className="font-display text-2xl font-bold tabular-nums text-[#707ef9]">
                          {activeParticipationRecord.stats.goles}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">Asistencias</p>
                        <p className="font-display text-2xl font-bold tabular-nums text-[#0d0d0d]">
                          {activeParticipationRecord.stats.asistencias}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">Tarjetas (A / R)</p>
                        <p className="font-display text-2xl font-bold tabular-nums text-[#0d0d0d]">
                          {activeParticipationRecord.stats.tarjetasAmarillas} /{' '}
                          {activeParticipationRecord.stats.tarjetasRojas}
                        </p>
                      </div>
                    </>
                  )}
                  {(DISCIPLINE_MAP[activeParticipationRecord.disciplineId].sportType === 'basquetbol' ||
                    DISCIPLINE_MAP[activeParticipationRecord.disciplineId].sportType === 'basquetbol3x3') && (
                    <>
                      <div>
                        <p className="text-xs text-neutral-500">Puntos</p>
                        <p className="font-display text-2xl font-bold tabular-nums text-[#707ef9]">
                          {activeParticipationRecord.stats.puntos}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">Rebotes / Triples</p>
                        <p className="font-display text-2xl font-bold tabular-nums text-[#0d0d0d]">
                          {activeParticipationRecord.stats.rebotes} /{' '}
                          {activeParticipationRecord.stats.triples}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">Faltas personales</p>
                        <p className="font-display text-2xl font-bold tabular-nums text-[#0d0d0d]">
                          {activeParticipationRecord.stats.faltas}
                        </p>
                      </div>
                    </>
                  )}
                  {DISCIPLINE_MAP[activeParticipationRecord.disciplineId].sportType === 'voleibol' && (
                    <>
                      <div>
                        <p className="text-xs text-neutral-500">Puntos totales</p>
                        <p className="font-display text-2xl font-bold tabular-nums text-[#707ef9]">
                          {activeParticipationRecord.stats.puntos}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">Aces</p>
                        <p className="font-display text-2xl font-bold tabular-nums text-[#0d0d0d]">
                          {activeParticipationRecord.stats.aces}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">Bloqueos</p>
                        <p className="font-display text-2xl font-bold tabular-nums text-[#0d0d0d]">
                          {activeParticipationRecord.stats.bloqueos}
                        </p>
                      </div>
                    </>
                  )}
                </div>
                {activeAttendanceSummary &&
                  (activeAttendanceSummary.registeredTeamMatches > 0 ||
                    activeAttendanceSummary.omittedTeamMatches > 0) && (
                    <div className="mt-3 bg-white border border-neutral-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-2 text-[#0d0d0d] font-medium">
                        <ClipboardCheck className="w-4 h-4 text-[#707ef9] shrink-0" />
                        <span>
                          Asistencia arbitral verificada:{' '}
                          <strong className="tabular-nums">
                            {activeAttendanceSummary.attendedMatches} de{' '}
                            {activeAttendanceSummary.registeredTeamMatches}
                          </strong>{' '}
                          partido(s) con registro
                          {activeAttendanceSummary.attendanceRate !== null
                            ? ` (${activeAttendanceSummary.attendanceRate}%)`
                            : ''}
                        </span>
                      </span>
                      {activeAttendanceSummary.omittedTeamMatches > 0 && (
                        <span className="text-[11px] text-neutral-500 tabular-nums">
                          {activeAttendanceSummary.omittedTeamMatches} partido(s) con asistencia
                          omitida (no afectan el porcentaje)
                        </span>
                      )}
                    </div>
                  )}
              </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
