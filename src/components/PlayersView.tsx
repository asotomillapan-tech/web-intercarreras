import {
  forwardRef,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
} from 'react';
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
import { motion } from 'motion/react';
import {
  TableVirtuoso,
  type TableComponents,
  type TableVirtuosoHandle,
} from 'react-virtuoso';
import { DISCIPLINES, DISCIPLINE_MAP, UFRO_CAREERS, UFRO_FACULTIES } from '../data/ufroSeed';
import { computePlayerAttendanceSummary } from '../domain/attendanceEngine';
import {
  buildUnifiedPlayers,
  findPlayerParticipations,
  normalizeTextToken,
  type UnifiedPlayerProfile,
} from '../domain/identityCrossRefEngine';
import { computePlayerSeasonPerformance } from '../domain/playerPerformanceEngine';
import { canEditPlayerProfile } from '../domain/rbacEngine';
import { formatRut, validateRut, validateUfroEmail } from '../domain/tournamentEngine';
import { EDITORIAL_EASE, SectionKicker } from './MotionPrimitives';
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

const getPlayerInitials = (p: Player) =>
  `${p.nombre[0] ?? ''}${p.apellidoPaterno[0] ?? ''}`.toUpperCase();

const VIRTUOSO_TABLE_COMPONENTS: TableComponents<UnifiedPlayerProfile> = {
  Scroller: forwardRef<HTMLDivElement, ComponentProps<'div'> & { context?: unknown }>(
    function VirtuosoScroller({ context: _context, className, ...props }, ref) {
      return (
        <div
          {...props}
          ref={ref}
          className={`overflow-x-auto bg-[#0c0c10] ${className ?? ''}`}
        />
      );
    }
  ),
  Table: ({ context: _context, ...props }) => (
    <table {...props} className="w-full text-left border-collapse text-sm" />
  ),
  TableHead: forwardRef<
    HTMLTableSectionElement,
    ComponentProps<'thead'> & { context?: unknown }
  >(function VirtuosoTableHead({ context: _context, ...props }, ref) {
    return <thead {...props} ref={ref} className="bg-[#111117] z-10" />;
  }),
  TableRow: ({ item: _item, context: _context, ...props }) => (
    <tr
      {...props}
      className="border-b border-white/[0.06] hover:bg-white/[0.03] transition-colors bg-[#0c0c10]"
    />
  ),
  TableBody: forwardRef<
    HTMLTableSectionElement,
    ComponentProps<'tbody'> & { context?: unknown }
  >(function VirtuosoTableBody({ context: _context, ...props }, ref) {
    return <tbody {...props} ref={ref} />;
  }),
};

const renderPlayersTableHeader = () => (
  <tr className="bg-[#111117] text-[11px] text-zinc-500 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)]">
    <th className="py-3 px-4 font-medium bg-[#111117]">Estudiante</th>
    <th className="py-3 px-3 font-medium bg-[#111117]">Equipos y Disciplinas</th>
    <th className="py-3 px-3 hidden md:table-cell font-medium bg-[#111117]">Carrera</th>
    <th className="py-3 px-3 hidden lg:table-cell font-medium bg-[#111117]">RUT</th>
    <th className="py-3 px-3 text-right font-medium tabular-nums bg-[#111117]">PJ</th>
    <th className="py-3 px-3 text-right font-medium tabular-nums bg-[#111117]">Rendimiento</th>
    <th className="py-3 px-4 text-right font-medium bg-[#111117]">Ficha</th>
  </tr>
);

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
  const virtuosoRef = useRef<TableVirtuosoHandle>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Player | null>(null);
  const [editErrors, setEditErrors] = useState<string[]>([]);
  const [editSaved, setEditSaved] = useState<string | null>(null);

  const teamMap = useMemo(() => new Map(state.teams.map((t) => [t.id, t])), [state.teams]);

  const unifiedPlayers = useMemo(
    () => buildUnifiedPlayers(state.players, state.teams),
    [state.players, state.teams]
  );

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

  useEffect(() => {
    virtuosoRef.current?.scrollToIndex({ index: 0, behavior: 'auto' });
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
    setEditSaved('Ficha oficial actualizada.');
  };

  const matchedProfiles = useMemo(() => {
    const normalizedQ = normalizeTextToken(deferredQuery);
    const terms = normalizedQ ? normalizedQ.split(' ') : [];
    const results: (typeof unifiedPlayers)[number][] = [];

    for (let i = 0; i < indexedProfiles.length; i++) {
      const entry = indexedProfiles[i];
      if (disciplineFilter !== 'ALL' && !entry.disciplineSet.has(disciplineFilter)) continue;
      if (facultyFilter !== 'ALL' && !entry.faculties.has(facultyFilter)) continue;
      if (levelFilter !== 'ALL' && !entry.levels.has(levelFilter)) continue;
      if (onlySelectedUfro && !entry.profile.esSeleccionadoUfro) continue;
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

  const renderPlayerRow = useCallback(
    (_index: number, profile: UnifiedPlayerProfile) => {
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
        <>
          <td className="py-3.5 px-4">
            <div className="flex items-center gap-3">
              {primary.fotografia ? (
                <img
                  src={primary.fotografia}
                  alt={`${primary.nombre} ${primary.apellidoPaterno}`}
                  loading="lazy"
                  decoding="async"
                  className="w-9 h-9 rounded-xl object-cover border border-white/[0.1] shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-white/[0.07] border border-white/[0.1] text-zinc-200 text-xs font-medium flex items-center justify-center shrink-0">
                  {getPlayerInitials(primary)}
                </div>
              )}
              <div>
                <p className="font-medium text-white">
                  {primary.nombre} {primary.apellidoPaterno}
                  {primary.apellidoMaterno && !/^[-–—\s.]+$/.test(primary.apellidoMaterno)
                    ? ` ${primary.apellidoMaterno}`
                    : ''}
                </p>
                <p className="text-xs text-zinc-500">
                  #{player.dorsal} · {player.posicion}
                  {isMulti && (
                    <span className="text-[#a5b0ff]">
                      {' '}· {profile.participations.length} equipos
                    </span>
                  )}
                  {profile.esSeleccionadoUfro && (
                    <span className="text-[#a5b0ff]"> · UFRO</span>
                  )}
                </p>
              </div>
            </div>
          </td>
          <td className="py-3.5 px-3">
            <div className="space-y-1">
              {profile.participations.map((part) => {
                const partDisc = DISCIPLINE_MAP[part.disciplineId];
                return (
                  <div key={part.player.id} className="leading-tight">
                    <button
                      type="button"
                      onClick={() => onInspectTeam(part.player.teamId)}
                      className="text-left group cursor-pointer"
                    >
                      <span className="font-medium text-zinc-200 group-hover:text-[#c8ceff] transition-colors">
                        {part.team?.nombre ?? part.player.teamId}
                      </span>
                      <span className="text-xs text-zinc-500 ml-1.5">
                        · {partDisc.nombreCorto} (#{part.player.dorsal})
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </td>
          <td className="py-3.5 px-3 hidden md:table-cell">
            <p className="text-xs text-zinc-300">{primary.carrera}</p>
            <p className="text-xs text-zinc-500">{primary.nivelAcademico}</p>
          </td>
          <td className="py-3.5 px-3 hidden lg:table-cell text-xs tabular-nums text-zinc-500">
            {primary.rut || 'Reservado'}
          </td>
          <td className="py-3.5 px-3 text-right tabular-nums text-zinc-400">
            {disciplineFilter !== 'ALL'
              ? player.stats.partidosJugados
              : profile.totalPartidosJugados}
          </td>
          <td className="py-3.5 px-3 text-right tabular-nums font-medium text-white">
            <span>{statLabel}</span>
            {isMulti && disciplineFilter === 'ALL' && (
              <span className="block text-[10px] font-normal text-zinc-500">
                {disc.nombreCorto}
              </span>
            )}
          </td>
          <td className="py-3.5 px-4 text-right">
            <button
              type="button"
              onClick={() => onSelectPlayer(player)}
              className="text-xs font-medium text-[#a5b0ff] hover:text-white transition-colors cursor-pointer"
            >
              Perfil →
            </button>
          </td>
        </>
      );
    },
    [disciplineFilter, onInspectTeam, onSelectPlayer]
  );

  const getInitials = getPlayerInitials;
  const inputClass =
    'w-full rounded-xl bg-[#111117] border border-white/[0.1] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9] transition-colors';

  return (
    <div className="bg-[#050507] text-zinc-100 min-h-[75vh] pb-20">
      {/* Header */}
      <div className="border-b border-white/[0.06]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-3">
          <SectionKicker index="01" label="Registro UFRO" />
          <h1 className="text-4xl sm:text-5xl font-medium tracking-[-0.035em] text-white">
            Padrón de <span className="font-editorial text-[#c8ceff]">jugadores</span>
          </h1>
          <p className="text-sm text-zinc-400 max-w-lg">
            Perfiles unificados, estadísticas históricas y rendimiento por disciplina.
          </p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="border-b border-white/[0.06] bg-[#0a0a0e]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar nombre, RUT, equipo o carrera..."
              aria-label="Buscar jugadores"
              className="w-full rounded-xl bg-[#111117] border border-white/[0.1] pl-10 pr-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
            />
          </div>

          <div className="lg:col-span-3">
            <select
              value={disciplineFilter}
              onChange={(e) => setDisciplineFilter(e.target.value as 'ALL' | DisciplineId)}
              aria-label="Filtrar por disciplina"
              className={inputClass}
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
              className={inputClass}
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
              className={inputClass}
            >
              <option value="ALL">Nivel</option>
              <option value="Pregrado">Pregrado</option>
              <option value="Postgrado">Postgrado</option>
            </select>
          </div>

          <div className="lg:col-span-2 flex items-center justify-end">
            <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlySelectedUfro}
                onChange={(e) => setOnlySelectedUfro(e.target.checked)}
                className="accent-[#707ef9] w-4 h-4 rounded"
              />
              <span>Selección UFRO</span>
            </label>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 mb-4">
          <span className="tabular-nums">
            {matchedProfiles.length}
            {matchedProfiles.length !== unifiedPlayers.length
              ? ` de ${unifiedPlayers.length}`
              : ''}{' '}
            perfiles
            {multiTeamPlayerCount > 0 && (
              <span className="text-[#a5b0ff]"> · {multiTeamPlayerCount} multirrama</span>
            )}
          </span>
          <span>Selecciona un jugador para abrir su ficha</span>
        </div>

        {matchedProfiles.length === 0 ? (
          <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-12 text-center space-y-3">
            <p className="text-lg font-medium text-white">
              {state.players.length === 0
                ? `Sin estudiantes inscritos en ${state.temporada}`
                : 'Sin jugadores para los filtros aplicados'}
            </p>
            {state.players.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setDisciplineFilter('ALL');
                  setFacultyFilter('ALL');
                  setLevelFilter('ALL');
                  setOnlySelectedUfro(false);
                }}
                className="px-4 py-2 rounded-full text-xs font-medium bg-white text-[#050507] cursor-pointer"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div
            data-testid="virtualized-players-container"
            className={`rounded-2xl border border-white/[0.08] bg-[#0c0c10] overflow-hidden ${
              matchedProfiles.length <= 3
                ? 'h-[260px]'
                : matchedProfiles.length <= 6
                ? 'h-[450px]'
                : 'h-[70vh] min-h-[480px] max-h-[760px]'
            }`}
          >
            <TableVirtuoso
              ref={virtuosoRef}
              className="h-full w-full"
              data={matchedProfiles}
              defaultItemHeight={68}
              increaseViewportBy={{ top: 240, bottom: 320 }}
              computeItemKey={(_index, profile) => profile.personKey}
              components={VIRTUOSO_TABLE_COMPONENTS}
              fixedHeaderContent={renderPlayersTableHeader}
              itemContent={renderPlayerRow}
            />
          </div>
        )}
      </div>

      {/* Player Profile Modal */}
      {activeParticipationRecord && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="player-profile-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onSelectPlayer(null);
          }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-md p-4 sm:py-8 overflow-y-auto"
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.28, ease: EDITORIAL_EASE }}
            className="rounded-3xl bg-[#0a0a0e] text-zinc-100 w-full max-w-3xl border border-white/[0.1] shadow-2xl shadow-black my-auto overflow-hidden"
          >
            <div className="bg-[#0e0e14] border-b border-white/[0.08] p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4 sm:gap-5">
                  {activeParticipationRecord.fotografia ? (
                    <img
                      src={activeParticipationRecord.fotografia}
                      alt={`${activeParticipationRecord.nombre} ${activeParticipationRecord.apellidoPaterno}`}
                      className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl object-cover border border-white/[0.14] shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-white/[0.05] border border-white/[0.1] flex flex-col items-center justify-center shrink-0">
                      <span className="text-xl font-semibold text-[#a5b0ff]">
                        {getInitials(activeParticipationRecord)}
                      </span>
                      <span className="text-[11px] text-zinc-500 tabular-nums">
                        #{activeParticipationRecord.dorsal}
                      </span>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-[#a5b0ff] font-medium">
                      {selectedPlayerParticipations.length > 1
                        ? `Perfil unificado · ${selectedPlayerParticipations.length} equipos`
                        : DISCIPLINE_MAP[activeParticipationRecord.disciplineId].nombre}
                    </p>
                    <h2
                      id="player-profile-title"
                      className="text-2xl sm:text-3xl font-medium tracking-[-0.025em] text-white mt-0.5"
                    >
                      {activeParticipationRecord.nombre} {activeParticipationRecord.apellidoPaterno}
                      {activeParticipationRecord.apellidoMaterno &&
                      !/^[-–—\s.]+$/.test(activeParticipationRecord.apellidoMaterno)
                        ? ` ${activeParticipationRecord.apellidoMaterno}`
                        : ''}
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectPlayer(null);
                          onInspectTeam(activeParticipationRecord.teamId);
                        }}
                        className="underline hover:text-[#c8ceff] cursor-pointer"
                      >
                        {teamMap.get(activeParticipationRecord.teamId)?.nombre}
                      </button>{' '}
                      · {activeParticipationRecord.posicion} · #{activeParticipationRecord.dorsal}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectPlayer(null)}
                  aria-label="Cerrar perfil de jugador"
                  className="w-9 h-9 rounded-full inline-flex items-center justify-center bg-white/[0.04] border border-white/[0.1] text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selectedPlayerParticipations.length > 1 && (
                <div className="border-t border-white/[0.08] pt-4 space-y-2">
                  <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#9aa5ff]" />
                    <span>Equipos ({selectedPlayerParticipations.length})</span>
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
                          className={`px-3.5 py-2 rounded-2xl text-xs border transition-colors text-left cursor-pointer ${
                            isCurrent
                              ? 'bg-[#707ef9] text-white border-[#707ef9]'
                              : 'bg-white/[0.04] text-zinc-300 border-white/[0.1] hover:bg-white/[0.08]'
                          }`}
                        >
                          <span className="font-medium block">
                            {part.team?.nombre ?? part.player.teamId}
                          </span>
                          <span className="block text-[10px] opacity-80">
                            {pDisc.nombreCorto} · #{part.player.dorsal}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal View Switcher */}
            <div
              role="tablist"
              aria-label="Secciones del perfil del jugador"
              className="flex items-center gap-2 border-b border-white/[0.08] bg-[#0c0c10] px-6 py-3"
            >
              <button
                type="button"
                role="tab"
                aria-selected={profileTab === 'ficha'}
                onClick={() => setProfileTab('ficha')}
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  profileTab === 'ficha'
                    ? 'bg-white text-[#050507]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Ficha</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={profileTab === 'rendimiento'}
                onClick={() => setProfileTab('rendimiento')}
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  profileTab === 'rendimiento'
                    ? 'bg-white text-[#050507]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Rendimiento histórico</span>
              </button>
            </div>

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
                      className="rounded-2xl bg-emerald-500/15 border border-emerald-500/30 p-3 text-xs text-emerald-200 flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{editSaved}</span>
                    </div>
                  )}

                  <div className="rounded-2xl bg-[#101016] border border-white/[0.08] p-4 space-y-3">
                    <p className="text-xs text-zinc-400">
                      Participación activa ({selectedPlayerParticipations.length}{' '}
                      {selectedPlayerParticipations.length === 1 ? 'equipo' : 'equipos'})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {selectedPlayerParticipations.map((part) => {
                        const pDisc = DISCIPLINE_MAP[part.disciplineId];
                        const isCurrent = part.player.id === activeParticipationRecord.id;
                        return (
                          <div
                            key={`card-${part.player.id}`}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-2 bg-[#0c0c10] ${
                              isCurrent ? 'border-[#707ef9]/50' : 'border-white/[0.08]'
                            }`}
                          >
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectPlayer(null);
                                  onInspectTeam(part.player.teamId);
                                }}
                                className="text-xs font-medium text-white hover:text-[#c8ceff] truncate block cursor-pointer"
                              >
                                {part.team?.nombre ?? part.player.teamId}
                              </button>
                              <p className="text-[11px] text-zinc-500 truncate">
                                {pDisc.nombreCorto} · #{part.player.dorsal} · {part.player.posicion}
                              </p>
                            </div>
                            {selectedPlayerParticipations.length > 1 && !isCurrent && (
                              <button
                                type="button"
                                onClick={() => setActiveParticipationId(part.player.id)}
                                className="text-[11px] font-medium text-[#a5b0ff] hover:text-white shrink-0 cursor-pointer"
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
                    <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-2.5 mb-4">
                      <h3 className="text-xs font-medium text-zinc-400">Ficha estudiantil</h3>
                      {canEditSelected && !isEditing && (
                        <button
                          type="button"
                          onClick={() => {
                            setDraft(activeParticipationRecord);
                            setEditErrors([]);
                            setEditSaved(null);
                            setIsEditing(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#707ef9] hover:bg-[#5f6ef5] text-white text-xs font-medium cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                      )}
                    </div>

                    {isEditing && draft ? (
                      <form onSubmit={handleSaveEdit} className="space-y-4">
                        {editErrors.length > 0 && (
                          <div
                            role="alert"
                            className="rounded-2xl bg-red-500/15 border border-red-500/30 p-3 text-xs text-red-200 space-y-1"
                          >
                            {editErrors.map((err, i) => (
                              <p key={i}>{err}</p>
                            ))}
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div>
                            <label htmlFor="ed-nombre" className="block text-xs text-zinc-400 mb-1">
                              Nombre
                            </label>
                            <input
                              id="ed-nombre"
                              type="text"
                              value={draft.nombre}
                              onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label htmlFor="ed-app" className="block text-xs text-zinc-400 mb-1">
                              Apellido Paterno
                            </label>
                            <input
                              id="ed-app"
                              type="text"
                              value={draft.apellidoPaterno}
                              onChange={(e) =>
                                setDraft({ ...draft, apellidoPaterno: e.target.value })
                              }
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label htmlFor="ed-apm" className="block text-xs text-zinc-400 mb-1">
                              Apellido Materno
                            </label>
                            <input
                              id="ed-apm"
                              type="text"
                              value={draft.apellidoMaterno}
                              onChange={(e) =>
                                setDraft({ ...draft, apellidoMaterno: e.target.value })
                              }
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label htmlFor="ed-carrera" className="block text-xs text-zinc-400 mb-1">
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
                              className={inputClass}
                            >
                              {UFRO_CAREERS.map((c) => (
                                <option key={c.carrera} value={c.carrera}>
                                  {c.carrera}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label htmlFor="ed-rut" className="block text-xs text-zinc-400 mb-1">
                              RUT
                            </label>
                            <input
                              id="ed-rut"
                              type="text"
                              value={draft.rut}
                              onChange={(e) => setDraft({ ...draft, rut: e.target.value })}
                              className={`${inputClass} tabular-nums`}
                            />
                          </div>
                          <div>
                            <label htmlFor="ed-mat" className="block text-xs text-zinc-400 mb-1">
                              Matrícula
                            </label>
                            <input
                              id="ed-mat"
                              type="text"
                              value={draft.numeroMatricula}
                              onChange={(e) =>
                                setDraft({ ...draft, numeroMatricula: e.target.value })
                              }
                              className={`${inputClass} tabular-nums`}
                            />
                          </div>
                          <div>
                            <label htmlFor="ed-email" className="block text-xs text-zinc-400 mb-1">
                              Correo institucional
                            </label>
                            <input
                              id="ed-email"
                              type="email"
                              value={draft.correoInstitucional}
                              onChange={(e) =>
                                setDraft({ ...draft, correoInstitucional: e.target.value })
                              }
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label htmlFor="ed-nivel" className="block text-xs text-zinc-400 mb-1">
                              Nivel
                            </label>
                            <select
                              id="ed-nivel"
                              value={draft.nivelAcademico}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  nivelAcademico: e.target.value as AcademicLevel,
                                })
                              }
                              className={inputClass}
                            >
                              <option value="Pregrado">Pregrado</option>
                              <option value="Postgrado">Postgrado</option>
                            </select>
                          </div>
                          <div>
                            <label htmlFor="ed-dob" className="block text-xs text-zinc-400 mb-1">
                              Fecha de nacimiento
                            </label>
                            <input
                              id="ed-dob"
                              type="date"
                              value={draft.fechaNacimiento}
                              onChange={(e) =>
                                setDraft({ ...draft, fechaNacimiento: e.target.value })
                              }
                              className={`${inputClass} tabular-nums`}
                            />
                          </div>
                          <div className="flex items-end pb-2">
                            <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={draft.esSeleccionadoUfro}
                                onChange={(e) =>
                                  setDraft({ ...draft, esSeleccionadoUfro: e.target.checked })
                                }
                                className="accent-[#707ef9] w-4 h-4"
                              />
                              <span>Seleccionado UFRO</span>
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
                            className="px-4 py-2 rounded-full border border-white/[0.12] text-xs text-zinc-300 cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            className="px-5 py-2 rounded-full bg-white text-[#050507] text-xs font-medium cursor-pointer"
                          >
                            Guardar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 text-sm">
                        <div>
                          <dt className="text-xs text-zinc-500">Nombre</dt>
                          <dd className="text-zinc-100">{activeParticipationRecord.nombre}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-zinc-500">Apellidos</dt>
                          <dd className="text-zinc-100">
                            {activeParticipationRecord.apellidoPaterno}{' '}
                            {activeParticipationRecord.apellidoMaterno}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-zinc-500">Carrera</dt>
                          <dd className="text-zinc-100">{activeParticipationRecord.carrera}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-zinc-500">Facultad</dt>
                          <dd className="text-zinc-100">{activeParticipationRecord.facultad}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-zinc-500">RUT</dt>
                          <dd className="tabular-nums text-zinc-300">
                            {activeParticipationRecord.rut || 'Reservado'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-zinc-500">Matrícula</dt>
                          <dd className="tabular-nums text-zinc-300">
                            {activeParticipationRecord.numeroMatricula || 'Reservado'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-zinc-500">Correo institucional</dt>
                          <dd className="text-zinc-300 break-all">
                            {activeParticipationRecord.correoInstitucional || 'Reservado'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-zinc-500">Nivel</dt>
                          <dd className="text-zinc-100">
                            {activeParticipationRecord.nivelAcademico}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-zinc-500">Nacimiento</dt>
                          <dd className="tabular-nums text-zinc-300">
                            {activeParticipationRecord.fechaNacimiento || 'Reservado'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-zinc-500">Selección UFRO</dt>
                          <dd className="text-zinc-100 flex items-center gap-1.5">
                            {activeParticipationRecord.esSeleccionadoUfro ? (
                              <>
                                <Award className="w-4 h-4 text-[#a5b0ff]" />
                                <span className="text-[#a5b0ff] font-medium">Sí · UFRO</span>
                              </>
                            ) : (
                              <span className="text-zinc-400">No</span>
                            )}
                          </dd>
                        </div>
                      </dl>
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5 mb-4">
                      <h3 className="text-xs font-medium text-zinc-400">
                        Temporada {state.temporada} ·{' '}
                        {DISCIPLINE_MAP[activeParticipationRecord.disciplineId].nombreCorto}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setProfileTab('rendimiento')}
                        className="inline-flex items-center gap-1.5 text-xs text-[#a5b0ff] hover:text-white cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Ver gráficos →</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-2xl bg-[#101016] p-4 border border-white/[0.08]">
                      <div>
                        <p className="text-xs text-zinc-500">PJ</p>
                        <p className="text-2xl font-medium tabular-nums text-white mt-0.5">
                          {activeParticipationRecord.stats.partidosJugados}
                        </p>
                      </div>
                      {DISCIPLINE_MAP[activeParticipationRecord.disciplineId].sportType ===
                        'futbol7' && (
                        <>
                          <div>
                            <p className="text-xs text-zinc-500">Goles</p>
                            <p className="text-2xl font-medium tabular-nums text-[#a5b0ff] mt-0.5">
                              {activeParticipationRecord.stats.goles}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500">Asistencias</p>
                            <p className="text-2xl font-medium tabular-nums text-white mt-0.5">
                              {activeParticipationRecord.stats.asistencias}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500">TA / TR</p>
                            <p className="text-2xl font-medium tabular-nums text-white mt-0.5">
                              {activeParticipationRecord.stats.tarjetasAmarillas} /{' '}
                              {activeParticipationRecord.stats.tarjetasRojas}
                            </p>
                          </div>
                        </>
                      )}
                      {(DISCIPLINE_MAP[activeParticipationRecord.disciplineId].sportType ===
                        'basquetbol' ||
                        DISCIPLINE_MAP[activeParticipationRecord.disciplineId].sportType ===
                          'basquetbol3x3') && (
                        <>
                          <div>
                            <p className="text-xs text-zinc-500">Puntos</p>
                            <p className="text-2xl font-medium tabular-nums text-[#a5b0ff] mt-0.5">
                              {activeParticipationRecord.stats.puntos}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500">Reb / 3P</p>
                            <p className="text-2xl font-medium tabular-nums text-white mt-0.5">
                              {activeParticipationRecord.stats.rebotes} /{' '}
                              {activeParticipationRecord.stats.triples}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500">Faltas</p>
                            <p className="text-2xl font-medium tabular-nums text-white mt-0.5">
                              {activeParticipationRecord.stats.faltas}
                            </p>
                          </div>
                        </>
                      )}
                      {DISCIPLINE_MAP[activeParticipationRecord.disciplineId].sportType ===
                        'voleibol' && (
                        <>
                          <div>
                            <p className="text-xs text-zinc-500">Puntos</p>
                            <p className="text-2xl font-medium tabular-nums text-[#a5b0ff] mt-0.5">
                              {activeParticipationRecord.stats.puntos}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500">Aces</p>
                            <p className="text-2xl font-medium tabular-nums text-white mt-0.5">
                              {activeParticipationRecord.stats.aces}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500">Bloqueos</p>
                            <p className="text-2xl font-medium tabular-nums text-white mt-0.5">
                              {activeParticipationRecord.stats.bloqueos}
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {activeAttendanceSummary &&
                      (activeAttendanceSummary.registeredTeamMatches > 0 ||
                        activeAttendanceSummary.omittedTeamMatches > 0) && (
                        <div className="mt-3 rounded-2xl bg-[#101016] border border-white/[0.08] px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="flex items-center gap-2 text-zinc-200">
                            <ClipboardCheck className="w-4 h-4 text-[#9aa5ff] shrink-0" />
                            <span>
                              Asistencia:{' '}
                              <strong className="tabular-nums text-white">
                                {activeAttendanceSummary.attendedMatches}/
                                {activeAttendanceSummary.registeredTeamMatches}
                              </strong>
                              {activeAttendanceSummary.attendanceRate !== null
                                ? ` (${activeAttendanceSummary.attendanceRate}%)`
                                : ''}
                            </span>
                          </span>
                          {activeAttendanceSummary.omittedTeamMatches > 0 && (
                            <span className="text-[11px] text-zinc-500 tabular-nums">
                              {activeAttendanceSummary.omittedTeamMatches} omitido(s)
                            </span>
                          )}
                        </div>
                      )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
