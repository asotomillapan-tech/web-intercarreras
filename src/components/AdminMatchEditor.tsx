import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Edit3,
  History,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
import type {
  DisciplineId,
  Match,
  MatchPlayoffLeg,
  MatchStatus,
  PeriodScore,
  TournamentState,
} from '../types/tournament';

interface AdminMatchEditorProps {
  state: TournamentState;
  initialEditMatchId?: string | null;
  onUpdateMatch: (match: Match) => void;
  onAddMatch?: (match: Match) => void;
}

const MATCH_PHASES: Match['fase'][] = [
  'Grupos',
  'Octavos',
  'Cuartos',
  'Semifinal',
  'Tercer Lugar',
  'Final',
];

function addDaysToIsoDate(isoDate: string, days: number): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return isoDate;
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
  return d.toISOString().slice(0, 10);
}

export function AdminMatchEditor({
  state,
  initialEditMatchId,
  onUpdateMatch,
  onAddMatch,
}: AdminMatchEditorProps) {
  const [disciplineFilter, setDisciplineFilter] = useState<'ALL' | DisciplineId>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | MatchStatus>('ALL');
  const [query, setQuery] = useState('');

  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [isCreatingMatch, setIsCreatingMatch] = useState(false);
  const [createReturnLeg, setCreateReturnLeg] = useState(true);
  const [correctionNote, setCorrectionNote] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const teamMap = useMemo(() => new Map(state.teams.map((t) => [t.id, t])), [state.teams]);

  useEffect(() => {
    if (!initialEditMatchId) return;
    const found = state.matches.find((m) => m.id === initialEditMatchId);
    if (found) {
      setEditingMatch({
        ...found,
        periods: found.periods.map((p) => ({ ...p })),
      });
      setCorrectionNote('');
      setErrorMsg(null);
    }
  }, [initialEditMatchId, state.matches]);

  const filteredMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.matches
      .filter((m) => {
        if (disciplineFilter !== 'ALL' && m.disciplineId !== disciplineFilter) return false;
        if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
        if (!q) return true;
        const homeName = teamMap.get(m.homeTeamId)?.nombre.toLowerCase() ?? '';
        const awayName = teamMap.get(m.awayTeamId)?.nombre.toLowerCase() ?? '';
        return (
          homeName.includes(q) ||
          awayName.includes(q) ||
          m.cancha.toLowerCase().includes(q) ||
          m.groupName.toLowerCase().includes(q) ||
          m.fecha.includes(q)
        );
      })
      .sort((a, b) => {
        // Put FINALIZADO first so past matches are immediately accessible, then newest date
        const rank = (s: MatchStatus) => (s === 'FINALIZADO' ? 0 : s === 'EN_VIVO' ? 1 : 2);
        if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
        return `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`);
      });
  }, [state.matches, disciplineFilter, statusFilter, query, teamMap]);

  const disciplineTeamsForEdit = useMemo(() => {
    if (!editingMatch) return [];
    return state.teams
      .filter((t) => t.disciplineId === editingMatch.disciplineId)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [state.teams, editingMatch]);

  const startEditing = (match: Match) => {
    setIsCreatingMatch(false);
    setEditingMatch({
      ...match,
      periods: match.periods.map((p) => ({ ...p })),
    });
    setCorrectionNote('');
    setErrorMsg(null);
    setSavedMsg(null);
  };

  const startCreatingMatch = () => {
    const defaultDisc: DisciplineId =
      disciplineFilter !== 'ALL' ? disciplineFilter : DISCIPLINES[0].id;
    const discTeams = state.teams
      .filter((t) => t.disciplineId === defaultDisc)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const discMeta = DISCIPLINE_MAP[defaultDisc];
    const isTwoLegged = Boolean(state.configs[defaultDisc]?.playoffsIdaYVuelta);
    const defaultRef =
      discMeta.sportType === 'futbol7'
        ? 'ref-f7-1'
        : discMeta.sportType === 'voleibol'
        ? 'ref-vl-1'
        : 'ref-bk-1';

    setIsCreatingMatch(true);
    setCreateReturnLeg(isTwoLegged);
    setEditingMatch({
      id: `m-${defaultDisc}-${Date.now()}`,
      disciplineId: defaultDisc,
      groupName: 'Playoffs',
      fase: isTwoLegged ? 'Cuartos' : 'Tercer Lugar',
      playoffLeg: isTwoLegged ? 'IDA' : 'UNICO',
      jornada: 1,
      fecha: new Date().toISOString().slice(0, 10),
      hora: '19:00',
      cancha: discMeta.sedePrincipal,
      homeTeamId: discTeams[0]?.id ?? '',
      awayTeamId: discTeams[1]?.id ?? '',
      homeScore: 0,
      awayScore: 0,
      status: 'PROGRAMADO',
      periodLabel: 'Por iniciar',
      clock: '00:00',
      periods: [],
      fouls: { home: 0, away: 0 },
      timeouts: { home: 0, away: 0 },
      events: [],
      refereeId: defaultRef,
    });
    setCorrectionNote('');
    setErrorMsg(null);
    setSavedMsg(null);
  };

  const handleCreateDisciplineChange = (nextDiscId: DisciplineId) => {
    const isTwoLegged = Boolean(state.configs[nextDiscId]?.playoffsIdaYVuelta);
    setCreateReturnLeg(isTwoLegged);
    setEditingMatch((prev) => {
      if (!prev) return prev;
      const discTeams = state.teams
        .filter((t) => t.disciplineId === nextDiscId)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      const discMeta = DISCIPLINE_MAP[nextDiscId];
      const defaultRef =
        discMeta.sportType === 'futbol7'
          ? 'ref-f7-1'
          : discMeta.sportType === 'voleibol'
          ? 'ref-vl-1'
          : 'ref-bk-1';
      return {
        ...prev,
        disciplineId: nextDiscId,
        playoffLeg: prev.fase === 'Grupos' ? undefined : isTwoLegged ? 'IDA' : 'UNICO',
        cancha: discMeta.sedePrincipal,
        homeTeamId: discTeams[0]?.id ?? '',
        awayTeamId: discTeams[1]?.id ?? '',
        refereeId: defaultRef,
      };
    });
  };

  const updatePeriod = (index: number, side: 'home' | 'away', value: number) => {
    setEditingMatch((prev) => {
      if (!prev) return prev;
      const nextPeriods: PeriodScore[] = prev.periods.map((p, idx) =>
        idx === index ? { ...p, [side]: Math.max(0, Math.trunc(value)) } : p
      );
      return { ...prev, periods: nextPeriods };
    });
  };

  const addPeriodRow = () => {
    setEditingMatch((prev) => {
      if (!prev || prev.periods.length >= 10) return prev;
      return { ...prev, periods: [...prev.periods, { home: 0, away: 0 }] };
    });
  };

  const removePeriodRow = (index: number) => {
    setEditingMatch((prev) => {
      if (!prev) return prev;
      return { ...prev, periods: prev.periods.filter((_, i) => i !== index) };
    });
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!editingMatch) return;

    if (!editingMatch.homeTeamId || !editingMatch.awayTeamId) {
      setErrorMsg('Debes seleccionar equipo local y equipo visitante de la disciplina.');
      return;
    }
    if (editingMatch.homeTeamId === editingMatch.awayTeamId) {
      setErrorMsg('El equipo local y el equipo visitante deben ser distintos.');
      return;
    }
    if (!editingMatch.fecha.trim() || !editingMatch.hora.trim() || !editingMatch.cancha.trim()) {
      setErrorMsg('Fecha, hora y cancha son campos obligatorios.');
      return;
    }

    const homeName = teamMap.get(editingMatch.homeTeamId)?.nombre ?? editingMatch.homeTeamId;
    const awayName = teamMap.get(editingMatch.awayTeamId)?.nombre ?? editingMatch.awayTeamId;

    const auditNote =
      correctionNote.trim() ||
      (isCreatingMatch
        ? `Programación oficial (${editingMatch.fase}): ${homeName} vs ${awayName}.`
        : `Corrección administrativa: ${homeName} ${editingMatch.homeScore} - ${editingMatch.awayScore} ${awayName} (${editingMatch.status}).`);

    const finalHomeScore = Math.max(0, Math.min(300, Math.trunc(Number(editingMatch.homeScore) || 0)));
    const finalAwayScore = Math.max(0, Math.min(300, Math.trunc(Number(editingMatch.awayScore) || 0)));

    const normalizedLeg: MatchPlayoffLeg | undefined =
      editingMatch.fase === 'Grupos'
        ? undefined
        : editingMatch.playoffLeg ??
          (state.configs[editingMatch.disciplineId]?.playoffsIdaYVuelta ? 'IDA' : 'UNICO');

    const savedMatch: Match = {
      ...editingMatch,
      playoffLeg: normalizedLeg,
      groupName: editingMatch.groupName.trim() || (editingMatch.fase === 'Grupos' ? 'Grupo A' : 'Playoffs'),
      homeScore: finalHomeScore,
      awayScore: finalAwayScore,
      jornada: Math.max(1, Math.min(50, Math.trunc(Number(editingMatch.jornada) || 1))),
      periodLabel:
        editingMatch.status === 'FINALIZADO'
          ? editingMatch.periodLabel || 'Final'
          : editingMatch.periodLabel || 'Por iniciar',
      ...(isCreatingMatch && editingMatch.status === 'PROGRAMADO'
        ? {}
        : {
            scoresheetValidation: {
              ...(editingMatch.scoresheetValidation ?? {}),
              validatedAt: new Date().toISOString(),
              refereeName: 'Administrador UFRO',
              method: 'MANUAL_ARBITRO',
              manualNotes: auditNote,
              finalHomeScore,
              finalAwayScore,
            },
          }),
    };

    const shouldCreateReturnLeg =
      isCreatingMatch &&
      Boolean(onAddMatch) &&
      createReturnLeg &&
      savedMatch.fase !== 'Grupos' &&
      savedMatch.playoffLeg === 'IDA' &&
      Boolean(state.configs[savedMatch.disciplineId]?.playoffsIdaYVuelta);

    if (isCreatingMatch && onAddMatch) {
      onAddMatch(savedMatch);
      if (shouldCreateReturnLeg) {
        const returnDate = addDaysToIsoDate(savedMatch.fecha, 7);
        const returnMatch: Match = {
          ...savedMatch,
          id: `${savedMatch.id}-vta`,
          playoffLeg: 'VUELTA',
          homeTeamId: savedMatch.awayTeamId,
          awayTeamId: savedMatch.homeTeamId,
          fecha: returnDate,
          homeScore: 0,
          awayScore: 0,
          status: 'PROGRAMADO',
          periodLabel: 'Por iniciar',
          clock: '00:00',
          periods: [],
          fouls: { home: 0, away: 0 },
          timeouts: { home: 0, away: 0 },
          events: [],
          scoresheetValidation: undefined,
        };
        onAddMatch(returnMatch);
        setSavedMsg(
          `Llave Ida y Vuelta programada en Firestore (${savedMatch.fase}): Ida ${savedMatch.fecha} (${homeName} vs ${awayName}) y Vuelta ${returnDate} (${awayName} vs ${homeName}).`
        );
      } else {
        const legSuffix =
          savedMatch.playoffLeg === 'IDA'
            ? ' · Ida'
            : savedMatch.playoffLeg === 'VUELTA'
            ? ' · Vuelta'
            : '';
        setSavedMsg(
          `Encuentro programado en Firestore (${savedMatch.fase}${legSuffix}): ${homeName} vs ${awayName} · ${savedMatch.fecha} ${savedMatch.hora}.`
        );
      }
    } else {
      onUpdateMatch(savedMatch);
      setSavedMsg(
        `Partido actualizado en Firestore: ${homeName} ${savedMatch.homeScore} — ${savedMatch.awayScore} ${awayName} (${savedMatch.fase} · ${savedMatch.status}). Las tablas y el cuadro de playoffs se recalcularon automáticamente.`
      );
    }
    setEditingMatch(null);
    setIsCreatingMatch(false);
    setCorrectionNote('');
    setErrorMsg(null);
  };

  const pastCount = state.matches.filter((m) => m.status === 'FINALIZADO').length;
  const liveCount = state.matches.filter((m) => m.status === 'EN_VIVO').length;
  const scheduledCount = state.matches.filter((m) => m.status === 'PROGRAMADO').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-neutral-200 pb-5">
        <div className="flex items-start gap-3">
          <History className="w-6 h-6 text-[#707ef9] shrink-0 mt-1" />
          <div>
            <h2 className="font-display text-3xl uppercase tracking-wide text-[#0d0d0d]">
              Edición de Partidos Pasados y Programación
            </h2>
            <p className="text-xs text-neutral-600 mt-1 max-w-2xl">
              Como Administrador UFRO puedes corregir marcadores, parciales, estado, fecha, horario,
              cancha o equipos de partidos ya <strong>FINALIZADOS</strong> o programados. Cada
              modificación actualiza Firestore, recalcula posiciones e historial de equipos y queda
              auditada en la bitácora.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {onAddMatch && (
            <button
              type="button"
              onClick={startCreatingMatch}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Programar encuentro</span>
            </button>
          )}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="border border-neutral-200 bg-[#f5f6f8] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">Pasados</p>
              <p className="font-display text-2xl tabular-nums text-[#0d0d0d]">{pastCount}</p>
            </div>
            <div className="border border-neutral-200 bg-[#f5f6f8] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">En Vivo</p>
              <p className="font-display text-2xl tabular-nums text-[#707ef9]">{liveCount}</p>
            </div>
            <div className="border border-neutral-200 bg-[#f5f6f8] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">Programados</p>
              <p className="font-display text-2xl tabular-nums text-neutral-700">{scheduledCount}</p>
            </div>
          </div>
        </div>
      </div>

      {savedMsg && (
        <div
          role="status"
          className="bg-emerald-50 border border-emerald-300 p-4 text-xs text-emerald-950 flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{savedMsg}</span>
          </span>
          <button
            type="button"
            onClick={() => setSavedMsg(null)}
            aria-label="Cerrar notificación"
            className="text-emerald-800 hover:text-emerald-950 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MATCH EDITOR FORM */}
      {editingMatch && (
        <form
          onSubmit={handleSave}
          className="border-2 border-[#0d0d0d] bg-[#f5f6f8] p-6 space-y-6"
        >
          <div className="flex items-center justify-between gap-3 border-b border-neutral-300 pb-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
                {isCreatingMatch ? 'Programar Nuevo Encuentro' : 'Modificación Administrativa'} ·{' '}
                {DISCIPLINE_MAP[editingMatch.disciplineId].nombre}
              </p>
              <h3 className="font-display text-2xl uppercase tracking-wide text-[#0d0d0d]">
                {isCreatingMatch
                  ? `Nuevo encuentro (${editingMatch.fase})`
                  : `${teamMap.get(editingMatch.homeTeamId)?.nombre ?? editingMatch.homeTeamId} vs ${
                      teamMap.get(editingMatch.awayTeamId)?.nombre ?? editingMatch.awayTeamId
                    }`}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingMatch(null);
                setIsCreatingMatch(false);
                setErrorMsg(null);
              }}
              aria-label="Cerrar editor de partido"
              className="p-2 text-neutral-600 hover:text-[#0d0d0d] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {isCreatingMatch && (
            <div>
              <label htmlFor="create-m-disc" className="block text-xs font-medium text-neutral-700 mb-1">
                Disciplina del nuevo encuentro
              </label>
              <select
                id="create-m-disc"
                value={editingMatch.disciplineId}
                onChange={(e) => handleCreateDisciplineChange(e.target.value as DisciplineId)}
                className="w-full sm:w-96 bg-white border border-neutral-300 px-3 py-2 text-sm"
              >
                {DISCIPLINES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          {errorMsg && (
            <div role="alert" className="bg-red-50 border border-red-300 p-4 text-xs text-red-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Teams & Official Score */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-[#0d0d0d] text-white p-5">
            <div className="md:col-span-4">
              <label htmlFor="edit-m-home-team" className="block text-xs text-neutral-400 mb-1">
                Equipo Local
              </label>
              <select
                id="edit-m-home-team"
                value={editingMatch.homeTeamId}
                onChange={(e) => setEditingMatch({ ...editingMatch, homeTeamId: e.target.value })}
                className="w-full bg-[#18181f] border border-white/20 px-3 py-2 text-sm text-white"
              >
                {disciplineTeamsForEdit.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} ({t.groupName})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="edit-m-home-score" className="block text-xs text-[#707ef9] mb-1">
                Marcador Local
              </label>
              <input
                id="edit-m-home-score"
                type="number"
                min={0}
                max={300}
                value={editingMatch.homeScore}
                onChange={(e) =>
                  setEditingMatch({ ...editingMatch, homeScore: Number(e.target.value) || 0 })
                }
                className="w-full bg-white text-[#0d0d0d] px-3 py-2 text-xl font-display tabular-nums text-center"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="edit-m-away-score" className="block text-xs text-[#707ef9] mb-1">
                Marcador Visita
              </label>
              <input
                id="edit-m-away-score"
                type="number"
                min={0}
                max={300}
                value={editingMatch.awayScore}
                onChange={(e) =>
                  setEditingMatch({ ...editingMatch, awayScore: Number(e.target.value) || 0 })
                }
                className="w-full bg-white text-[#0d0d0d] px-3 py-2 text-xl font-display tabular-nums text-center"
              />
            </div>

            <div className="md:col-span-4">
              <label htmlFor="edit-m-away-team" className="block text-xs text-neutral-400 mb-1">
                Equipo Visitante
              </label>
              <select
                id="edit-m-away-team"
                value={editingMatch.awayTeamId}
                onChange={(e) => setEditingMatch({ ...editingMatch, awayTeamId: e.target.value })}
                className="w-full bg-[#18181f] border border-white/20 px-3 py-2 text-sm text-white"
              >
                {disciplineTeamsForEdit.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} ({t.groupName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Match Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="edit-m-status" className="block text-xs font-medium text-neutral-700 mb-1">
                Estado del Partido
              </label>
              <select
                id="edit-m-status"
                value={editingMatch.status}
                onChange={(e) => {
                  const nextStatus = e.target.value as MatchStatus;
                  setEditingMatch({
                    ...editingMatch,
                    status: nextStatus,
                    periodLabel:
                      nextStatus === 'FINALIZADO'
                        ? 'Final'
                        : nextStatus === 'PROGRAMADO'
                        ? 'Por iniciar'
                        : editingMatch.periodLabel,
                  });
                }}
                className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="PROGRAMADO">PROGRAMADO</option>
                <option value="EN_VIVO">EN VIVO</option>
                <option value="FINALIZADO">FINALIZADO (Partido Pasado)</option>
              </select>
            </div>

            <div>
              <label htmlFor="edit-m-fase" className="block text-xs font-medium text-neutral-700 mb-1">
                Fase
              </label>
              <select
                id="edit-m-fase"
                value={editingMatch.fase}
                onChange={(e) => {
                  const nextFase = e.target.value as Match['fase'];
                  const isTwoLegged = Boolean(state.configs[editingMatch.disciplineId]?.playoffsIdaYVuelta);
                  setEditingMatch({
                    ...editingMatch,
                    fase: nextFase,
                    playoffLeg:
                      nextFase === 'Grupos'
                        ? undefined
                        : editingMatch.playoffLeg ?? (isTwoLegged ? 'IDA' : 'UNICO'),
                  });
                }}
                className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm"
              >
                {MATCH_PHASES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            {editingMatch.fase !== 'Grupos' && (
              <div>
                <label htmlFor="edit-m-leg" className="block text-xs font-medium text-neutral-700 mb-1">
                  Instancia de Llave (Ida / Vuelta)
                </label>
                <select
                  id="edit-m-leg"
                  value={
                    editingMatch.playoffLeg ??
                    (state.configs[editingMatch.disciplineId]?.playoffsIdaYVuelta ? 'IDA' : 'UNICO')
                  }
                  onChange={(e) =>
                    setEditingMatch({
                      ...editingMatch,
                      playoffLeg: e.target.value as MatchPlayoffLeg,
                    })
                  }
                  className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm"
                >
                  <option value="IDA">Partido de Ida</option>
                  <option value="VUELTA">Partido de Vuelta</option>
                  <option value="UNICO">Partido Único</option>
                </select>
              </div>
            )}

            {isCreatingMatch &&
              editingMatch.fase !== 'Grupos' &&
              (editingMatch.playoffLeg ?? 'IDA') === 'IDA' &&
              Boolean(state.configs[editingMatch.disciplineId]?.playoffsIdaYVuelta) && (
                <div className="sm:col-span-2 lg:col-span-3 bg-[#707ef9]/5 border border-[#707ef9]/30 px-3.5 py-2.5">
                  <label className="inline-flex items-center gap-2.5 text-xs font-medium text-[#0d0d0d] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createReturnLeg}
                      onChange={(e) => setCreateReturnLeg(e.target.checked)}
                      className="accent-[#707ef9] w-4 h-4"
                    />
                    <span>
                      Crear automáticamente también el partido de Vuelta con localía invertida (+7 días)
                    </span>
                  </label>
                </div>
              )}

            <div>
              <label htmlFor="edit-m-group" className="block text-xs font-medium text-neutral-700 mb-1">
                Grupo / Llave
              </label>
              <input
                id="edit-m-group"
                type="text"
                value={editingMatch.groupName}
                onChange={(e) => setEditingMatch({ ...editingMatch, groupName: e.target.value })}
                className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="edit-m-jornada" className="block text-xs font-medium text-neutral-700 mb-1">
                Jornada
              </label>
              <input
                id="edit-m-jornada"
                type="number"
                min={1}
                max={50}
                value={editingMatch.jornada}
                onChange={(e) =>
                  setEditingMatch({ ...editingMatch, jornada: Number(e.target.value) || 1 })
                }
                className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="edit-m-fecha" className="block text-xs font-medium text-neutral-700 mb-1">
                Fecha
              </label>
              <input
                id="edit-m-fecha"
                type="date"
                value={editingMatch.fecha}
                onChange={(e) => setEditingMatch({ ...editingMatch, fecha: e.target.value })}
                className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="edit-m-hora" className="block text-xs font-medium text-neutral-700 mb-1">
                Hora (HH:MM)
              </label>
              <input
                id="edit-m-hora"
                type="time"
                value={editingMatch.hora}
                onChange={(e) => setEditingMatch({ ...editingMatch, hora: e.target.value })}
                className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="edit-m-cancha" className="block text-xs font-medium text-neutral-700 mb-1">
                Recinto / Cancha
              </label>
              <input
                id="edit-m-cancha"
                type="text"
                value={editingMatch.cancha}
                onChange={(e) => setEditingMatch({ ...editingMatch, cancha: e.target.value })}
                className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Periods / Sets Editor */}
          <div className="space-y-3 pt-4 border-t border-neutral-300">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                Parciales por Período / Set ({editingMatch.periods.length})
              </p>
              <button
                type="button"
                onClick={addPeriodRow}
                disabled={editingMatch.periods.length >= 10}
                className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-neutral-300 hover:border-[#707ef9] text-xs font-medium text-[#0d0d0d] cursor-pointer disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar parcial</span>
              </button>
            </div>

            {editingMatch.periods.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {editingMatch.periods.map((p, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-neutral-300 p-3 flex items-center justify-between gap-2"
                  >
                    <span className="text-xs font-bold text-neutral-500">P{idx + 1}</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        aria-label={`Parcial ${idx + 1} Local`}
                        type="number"
                        min={0}
                        value={p.home}
                        onChange={(e) => updatePeriod(idx, 'home', Number(e.target.value) || 0)}
                        className="w-14 border border-neutral-300 px-2 py-1 text-xs text-center tabular-nums"
                      />
                      <span className="text-neutral-400">-</span>
                      <input
                        aria-label={`Parcial ${idx + 1} Visita`}
                        type="number"
                        min={0}
                        value={p.away}
                        onChange={(e) => updatePeriod(idx, 'away', Number(e.target.value) || 0)}
                        className="w-14 border border-neutral-300 px-2 py-1 text-xs text-center tabular-nums"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removePeriodRow(idx)}
                      aria-label={`Eliminar parcial ${idx + 1}`}
                      className="text-neutral-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="edit-m-note" className="block text-xs font-medium text-neutral-700 mb-1">
              Motivo de modificación administrativa (se registra en bitácora del partido)
            </label>
            <input
              id="edit-m-note"
              type="text"
              value={correctionNote}
              onChange={(e) => setCorrectionNote(e.target.value)}
              placeholder="Ej: Corrección de marcador tras revisión de acta física oficial / fallo Tribunal de Disciplina."
              className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setEditingMatch(null);
                setIsCreatingMatch(false);
                setErrorMsg(null);
              }}
              className="px-4 py-2.5 border border-neutral-300 bg-white text-xs font-medium text-neutral-700 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display uppercase tracking-widest text-sm transition-colors cursor-pointer"
            >
              {isCreatingMatch ? 'Crear Encuentro en Firestore' : 'Guardar Corrección en Firestore'}
            </button>
          </div>
        </form>
      )}

      {/* Filters Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#f5f6f8] border border-neutral-200 p-4">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por equipo, cancha, grupo o fecha..."
            aria-label="Buscar partidos"
            className="w-full bg-white border border-neutral-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#707ef9]"
          />
        </div>

        <select
          value={disciplineFilter}
          onChange={(e) => setDisciplineFilter(e.target.value as 'ALL' | DisciplineId)}
          aria-label="Filtrar partidos por disciplina"
          className="bg-white border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="ALL">Todas las disciplinas ({state.matches.length})</option>
          {DISCIPLINES.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nombre}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'ALL' | MatchStatus)}
          aria-label="Filtrar partidos por estado"
          className="bg-white border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="ALL">Todos los estados</option>
          <option value="FINALIZADO">Finalizados — Partidos Pasados ({pastCount})</option>
          <option value="EN_VIVO">En Vivo ({liveCount})</option>
          <option value="PROGRAMADO">Programados ({scheduledCount})</option>
        </select>
      </div>

      {/* Matches List */}
      {filteredMatches.length === 0 ? (
        <div className="border border-neutral-200 bg-[#f5f6f8] p-10 text-center space-y-2">
          <p className="font-display text-2xl uppercase text-[#0d0d0d]">
            Sin encuentros registrados con estos filtros
          </p>
          <p className="text-xs text-neutral-600">
            Cuando existan partidos programados o finalizados podrás modificarlos aquí en cualquier
            momento.
          </p>
        </div>
      ) : (
        <div className="border border-neutral-200 divide-y divide-neutral-200">
          {filteredMatches.map((m) => {
            const home = teamMap.get(m.homeTeamId);
            const away = teamMap.get(m.awayTeamId);
            const disc = DISCIPLINE_MAP[m.disciplineId];
            return (
              <div
                key={m.id}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#f9fafb]"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`px-2 py-0.5 font-display uppercase tracking-wider text-[11px] ${
                        m.status === 'FINALIZADO'
                          ? 'bg-[#0d0d0d] text-white'
                          : m.status === 'EN_VIVO'
                          ? 'bg-[#707ef9] text-white'
                          : 'bg-[#f5f6f8] text-neutral-600 border border-neutral-300'
                      }`}
                    >
                      {m.status === 'FINALIZADO'
                        ? 'FINALIZADO'
                        : m.status === 'EN_VIVO'
                        ? 'EN VIVO'
                        : 'PROGRAMADO'}
                    </span>
                    <span className="font-medium text-[#707ef9]">{disc.nombreCorto}</span>
                    <span className="text-neutral-500">
                      {m.fase} · J{m.jornada} · {m.groupName}
                    </span>
                    {m.fase !== 'Grupos' && (m.playoffLeg === 'IDA' || m.playoffLeg === 'VUELTA') && (
                      <span className="px-1.5 py-0.5 bg-[#707ef9]/15 text-[#4250d6] font-display font-bold uppercase tracking-wider text-[10px]">
                        {m.playoffLeg === 'IDA' ? 'IDA' : 'VUELTA'}
                      </span>
                    )}
                    <span className="text-neutral-400 inline-flex items-center gap-1 tabular-nums">
                      <Calendar className="w-3 h-3" />
                      {m.fecha} {m.hora}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-[#0d0d0d]">
                    {home?.nombre ?? m.homeTeamId}{' '}
                    <span className="font-display text-xl px-2 py-0.5 mx-1 bg-[#f5f6f8] border border-neutral-200 tabular-nums">
                      {m.homeScore} — {m.awayScore}
                    </span>{' '}
                    {away?.nombre ?? m.awayTeamId}
                  </p>
                  <p className="text-xs text-neutral-500">{m.cancha}</p>
                </div>

                <button
                  type="button"
                  onClick={() => startEditing(m)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0d0d0d] hover:bg-[#707ef9] text-white font-display uppercase tracking-widest text-xs transition-colors cursor-pointer self-start md:self-auto shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{m.status === 'FINALIZADO' ? 'Modificar partido pasado' : 'Editar partido'}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
