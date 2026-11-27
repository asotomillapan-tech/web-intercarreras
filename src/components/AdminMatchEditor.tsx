import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Edit3,
  History,
  Plus,
  Search,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
import {
  filterMatchesByOrg,
  groupMatchesByOrg,
  sortMatchesChronologically,
  type MatchGroupByMode,
  type MatchSortOrder,
} from '../domain/matchFilterEngine';
import type {
  DisciplineId,
  Match,
  MatchPhase,
  MatchPlayoffLeg,
  MatchStatus,
  PeriodScore,
  TournamentState,
} from '../types/tournament';
import { MatchFilterBar } from './MatchFilterBar';

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
  const [groupFilter, setGroupFilter] = useState<'ALL' | string>('ALL');
  const [stageFilter, setStageFilter] = useState<'ALL' | MatchPhase>('ALL');
  const [groupBy, setGroupBy] = useState<MatchGroupByMode>('none');
  const [sortOrder, setSortOrder] = useState<MatchSortOrder>('newest');
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
        penaltyScore: found.penaltyScore ? { ...found.penaltyScore } : undefined,
      });
      setCorrectionNote('');
      setErrorMsg(null);
    }
  }, [initialEditMatchId, state.matches]);

  const filteredMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const orgFiltered = filterMatchesByOrg(state.matches, {
      disciplineId: disciplineFilter,
      groupName: groupFilter,
      fase: stageFilter,
    });
    const matched = orgFiltered.filter((m) => {
      if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
      if (!q) return true;
      const homeName = teamMap.get(m.homeTeamId)?.nombre.toLowerCase() ?? '';
      const awayName = teamMap.get(m.awayTeamId)?.nombre.toLowerCase() ?? '';
      return (
        homeName.includes(q) ||
        awayName.includes(q) ||
        m.cancha.toLowerCase().includes(q) ||
        m.groupName.toLowerCase().includes(q) ||
        m.fase.toLowerCase().includes(q) ||
        m.fecha.includes(q)
      );
    });
    return sortMatchesChronologically(matched, sortOrder);
  }, [
    state.matches,
    disciplineFilter,
    groupFilter,
    stageFilter,
    statusFilter,
    query,
    teamMap,
    sortOrder,
  ]);

  const groupedMatchSections = useMemo(
    () =>
      groupMatchesByOrg(
        filteredMatches,
        groupBy,
        Object.fromEntries(DISCIPLINES.map((d) => [d.id, d.nombre])) as Record<DisciplineId, string>,
        DISCIPLINES.map((d) => d.id)
      ),
    [filteredMatches, groupBy]
  );

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
      penaltyScore: match.penaltyScore ? { ...match.penaltyScore } : undefined,
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
        penaltyScore: discMeta.sportType === 'futbol7' ? prev.penaltyScore : undefined,
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
    const isFootball = DISCIPLINE_MAP[editingMatch.disciplineId]?.sportType === 'futbol7';

    const auditNote =
      correctionNote.trim() ||
      (isCreatingMatch
        ? `Programación oficial (${editingMatch.fase}): ${homeName} vs ${awayName}.`
        : `Corrección administrativa: ${homeName} ${editingMatch.homeScore} - ${editingMatch.awayScore} ${awayName} (${editingMatch.status}).`);

    const finalHomeScore = Math.max(0, Math.min(300, Math.trunc(Number(editingMatch.homeScore) || 0)));
    const finalAwayScore = Math.max(0, Math.min(300, Math.trunc(Number(editingMatch.awayScore) || 0)));

    const normalizedPenalty =
      isFootball && editingMatch.penaltyScore
        ? {
            home: Math.max(0, Math.min(50, Math.trunc(Number(editingMatch.penaltyScore.home) || 0))),
            away: Math.max(0, Math.min(50, Math.trunc(Number(editingMatch.penaltyScore.away) || 0))),
          }
        : undefined;

    const normalizedLeg: MatchPlayoffLeg | undefined =
      editingMatch.fase === 'Grupos'
        ? undefined
        : editingMatch.playoffLeg ??
          (state.configs[editingMatch.disciplineId]?.playoffsIdaYVuelta ? 'IDA' : 'UNICO');

    const savedMatch: Match = {
      ...editingMatch,
      playoffLeg: normalizedLeg,
      groupName:
        editingMatch.groupName.trim() || (editingMatch.fase === 'Grupos' ? 'Grupo A' : 'Playoffs'),
      homeScore: finalHomeScore,
      awayScore: finalAwayScore,
      penaltyScore: normalizedPenalty,
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
              refereeName: 'Administración UFRO',
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
          penaltyScore: undefined,
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
          `Llave Ida y Vuelta programada (${savedMatch.fase}): ${homeName} vs ${awayName}.`
        );
      } else {
        setSavedMsg(`Encuentro programado (${savedMatch.fase}): ${homeName} vs ${awayName}.`);
      }
    } else {
      onUpdateMatch(savedMatch);
      setSavedMsg(
        `Partido actualizado: ${homeName} ${savedMatch.homeScore} — ${savedMatch.awayScore} ${awayName}${
          savedMatch.penaltyScore
            ? ` (Pen. ${savedMatch.penaltyScore.home}-${savedMatch.penaltyScore.away})`
            : ''
        }.`
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

  const inputCls =
    'w-full rounded-xl bg-[#050507] border border-white/[0.1] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]';

  const isEditingFootball =
    editingMatch && DISCIPLINE_MAP[editingMatch.disciplineId]?.sportType === 'futbol7';

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#a5b0ff]">
            <History className="w-3.5 h-3.5" />
            <span>Fixture y Resultados Oficiales</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-medium tracking-[-0.025em] text-white">
            Gestión de{' '}
            <span className="font-editorial italic font-normal text-[#c8ceff]">partidos</span>
          </h2>
          <p className="text-xs text-zinc-400 max-w-2xl">
            Programa encuentros, corrige resultados pasados, parciales y definiciones por penales
            con recálculo automático de tablas y llaves.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {onAddMatch && (
            <button
              type="button"
              onClick={startCreatingMatch}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-[#050507] text-xs font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Programar encuentro</span>
            </button>
          )}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl border border-white/[0.08] bg-[#101016] px-3.5 py-2">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Pasados</p>
              <p className="text-lg font-medium tabular-nums text-white">{pastCount}</p>
            </div>
            <div className="rounded-2xl border border-[#707ef9]/30 bg-[#707ef9]/10 px-3.5 py-2">
              <p className="text-[10px] uppercase tracking-wider text-[#c8ceff]">En Vivo</p>
              <p className="text-lg font-medium tabular-nums text-[#a5b0ff]">{liveCount}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#101016] px-3.5 py-2">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Prox.</p>
              <p className="text-lg font-medium tabular-nums text-zinc-300">{scheduledCount}</p>
            </div>
          </div>
        </div>
      </div>

      {savedMsg && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200 flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{savedMsg}</span>
          </span>
          <button
            type="button"
            onClick={() => setSavedMsg(null)}
            aria-label="Cerrar notificación"
            className="text-emerald-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MATCH EDITOR FORM */}
      {editingMatch && (
        <form
          onSubmit={handleSave}
          className="rounded-3xl border border-white/[0.12] bg-[#101016] p-6 space-y-6"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#a5b0ff]">
                {isCreatingMatch ? 'Nuevo Encuentro' : 'Edición de Partido'} ·{' '}
                {DISCIPLINE_MAP[editingMatch.disciplineId].nombre}
              </p>
              <h3 className="text-xl font-medium text-white mt-0.5">
                {isCreatingMatch
                  ? `Programar (${editingMatch.fase})`
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
              className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {isCreatingMatch && (
            <div>
              <label htmlFor="create-m-disc" className="block text-xs text-zinc-400 mb-1.5">
                Disciplina del encuentro
              </label>
              <select
                id="create-m-disc"
                value={editingMatch.disciplineId}
                onChange={(e) => handleCreateDisciplineChange(e.target.value as DisciplineId)}
                className="w-full sm:w-96 rounded-xl bg-[#050507] border border-white/[0.1] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#707ef9]"
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
            <div
              role="alert"
              className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Teams & Official Score */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end rounded-2xl bg-[#050507] border border-white/[0.08] p-5">
            <div className="md:col-span-4">
              <label htmlFor="edit-m-home-team" className="block text-xs text-zinc-400 mb-1.5">
                Equipo Local
              </label>
              <select
                id="edit-m-home-team"
                value={editingMatch.homeTeamId}
                onChange={(e) => setEditingMatch({ ...editingMatch, homeTeamId: e.target.value })}
                className="w-full rounded-xl bg-[#101016] border border-white/[0.12] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#707ef9]"
              >
                {disciplineTeamsForEdit.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} ({t.groupName})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="edit-m-home-score" className="block text-xs text-[#a5b0ff] mb-1.5">
                Local
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
                className="w-full rounded-xl bg-white text-[#050507] px-3 py-2 text-2xl font-medium tabular-nums text-center"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="edit-m-away-score" className="block text-xs text-[#a5b0ff] mb-1.5">
                Visita
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
                className="w-full rounded-xl bg-white text-[#050507] px-3 py-2 text-2xl font-medium tabular-nums text-center"
              />
            </div>

            <div className="md:col-span-4">
              <label htmlFor="edit-m-away-team" className="block text-xs text-zinc-400 mb-1.5">
                Equipo Visitante
              </label>
              <select
                id="edit-m-away-team"
                value={editingMatch.awayTeamId}
                onChange={(e) => setEditingMatch({ ...editingMatch, awayTeamId: e.target.value })}
                className="w-full rounded-xl bg-[#101016] border border-white/[0.12] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#707ef9]"
              >
                {disciplineTeamsForEdit.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} ({t.groupName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Football 7 Penalty Shootout Config */}
          {isEditingFootball && (
            <div className="rounded-2xl border border-[#707ef9]/25 bg-[#707ef9]/[0.06] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <label className="inline-flex items-center gap-2.5 text-xs font-medium text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(editingMatch.penaltyScore)}
                  onChange={(e) =>
                    setEditingMatch({
                      ...editingMatch,
                      penaltyScore: e.target.checked ? { home: 0, away: 0 } : undefined,
                    })
                  }
                  className="accent-[#707ef9] w-4 h-4"
                />
                <Target className="w-4 h-4 text-[#a5b0ff]" />
                <span>Definición por penales (Fútbol 7)</span>
              </label>

              {editingMatch.penaltyScore && (
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="edit-pen-home" className="text-[11px] text-zinc-400">
                      Pen. Local
                    </label>
                    <input
                      id="edit-pen-home"
                      type="number"
                      min={0}
                      max={50}
                      value={editingMatch.penaltyScore.home}
                      onChange={(e) =>
                        setEditingMatch({
                          ...editingMatch,
                          penaltyScore: {
                            home: Math.max(0, Number(e.target.value) || 0),
                            away: editingMatch.penaltyScore?.away ?? 0,
                          },
                        })
                      }
                      className="w-16 rounded-xl bg-[#050507] border border-white/[0.15] px-2.5 py-1.5 text-sm text-white text-center tabular-nums"
                    />
                  </div>
                  <span className="text-zinc-500">—</span>
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="edit-pen-away" className="text-[11px] text-zinc-400">
                      Pen. Visita
                    </label>
                    <input
                      id="edit-pen-away"
                      type="number"
                      min={0}
                      max={50}
                      value={editingMatch.penaltyScore.away}
                      onChange={(e) =>
                        setEditingMatch({
                          ...editingMatch,
                          penaltyScore: {
                            home: editingMatch.penaltyScore?.home ?? 0,
                            away: Math.max(0, Number(e.target.value) || 0),
                          },
                        })
                      }
                      className="w-16 rounded-xl bg-[#050507] border border-white/[0.15] px-2.5 py-1.5 text-sm text-white text-center tabular-nums"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Match Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="edit-m-status" className="block text-xs text-zinc-400 mb-1.5">
                Estado
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
                className={inputCls}
              >
                <option value="PROGRAMADO">PROGRAMADO</option>
                <option value="EN_VIVO">EN VIVO</option>
                <option value="FINALIZADO">FINALIZADO</option>
              </select>
            </div>

            <div>
              <label htmlFor="edit-m-fase" className="block text-xs text-zinc-400 mb-1.5">
                Fase
              </label>
              <select
                id="edit-m-fase"
                value={editingMatch.fase}
                onChange={(e) => {
                  const nextFase = e.target.value as Match['fase'];
                  const isTwoLegged = Boolean(
                    state.configs[editingMatch.disciplineId]?.playoffsIdaYVuelta
                  );
                  setEditingMatch({
                    ...editingMatch,
                    fase: nextFase,
                    playoffLeg:
                      nextFase === 'Grupos'
                        ? undefined
                        : editingMatch.playoffLeg ?? (isTwoLegged ? 'IDA' : 'UNICO'),
                  });
                }}
                className={inputCls}
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
                <label htmlFor="edit-m-leg" className="block text-xs text-zinc-400 mb-1.5">
                  Instancia (Ida / Vuelta)
                </label>
                <select
                  id="edit-m-leg"
                  value={
                    editingMatch.playoffLeg ??
                    (state.configs[editingMatch.disciplineId]?.playoffsIdaYVuelta
                      ? 'IDA'
                      : 'UNICO')
                  }
                  onChange={(e) =>
                    setEditingMatch({
                      ...editingMatch,
                      playoffLeg: e.target.value as MatchPlayoffLeg,
                    })
                  }
                  className={inputCls}
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
                <div className="sm:col-span-2 lg:col-span-3 rounded-xl bg-[#707ef9]/10 border border-[#707ef9]/30 px-3.5 py-2.5">
                  <label className="inline-flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createReturnLeg}
                      onChange={(e) => setCreateReturnLeg(e.target.checked)}
                      className="accent-[#707ef9] w-4 h-4"
                    />
                    <span>Crear automáticamente el partido de Vuelta (+7 días)</span>
                  </label>
                </div>
              )}

            <div>
              <label htmlFor="edit-m-group" className="block text-xs text-zinc-400 mb-1.5">
                Grupo / Llave
              </label>
              <input
                id="edit-m-group"
                type="text"
                value={editingMatch.groupName}
                onChange={(e) => setEditingMatch({ ...editingMatch, groupName: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="edit-m-jornada" className="block text-xs text-zinc-400 mb-1.5">
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
                className={`${inputCls} tabular-nums`}
              />
            </div>

            <div>
              <label htmlFor="edit-m-fecha" className="block text-xs text-zinc-400 mb-1.5">
                Fecha
              </label>
              <input
                id="edit-m-fecha"
                type="date"
                value={editingMatch.fecha}
                onChange={(e) => setEditingMatch({ ...editingMatch, fecha: e.target.value })}
                className={`${inputCls} tabular-nums`}
              />
            </div>

            <div>
              <label htmlFor="edit-m-hora" className="block text-xs text-zinc-400 mb-1.5">
                Hora (HH:MM)
              </label>
              <input
                id="edit-m-hora"
                type="time"
                value={editingMatch.hora}
                onChange={(e) => setEditingMatch({ ...editingMatch, hora: e.target.value })}
                className={`${inputCls} tabular-nums`}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="edit-m-cancha" className="block text-xs text-zinc-400 mb-1.5">
                Recinto / Cancha
              </label>
              <input
                id="edit-m-cancha"
                type="text"
                value={editingMatch.cancha}
                onChange={(e) => setEditingMatch({ ...editingMatch, cancha: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          {/* Periods / Sets Editor */}
          <div className="space-y-3 pt-4 border-t border-white/[0.08]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">
                Parciales por Período / Set ({editingMatch.periods.length})
              </p>
              <button
                type="button"
                onClick={addPeriodRow}
                disabled={editingMatch.periods.length >= 10}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.1] hover:border-[#707ef9] text-xs text-zinc-200 cursor-pointer disabled:opacity-40"
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
                    className="rounded-xl bg-[#050507] border border-white/[0.08] p-3 flex items-center justify-between gap-2"
                  >
                    <span className="text-xs font-mono text-zinc-500">P{idx + 1}</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        aria-label={`Parcial ${idx + 1} Local`}
                        type="number"
                        min={0}
                        value={p.home}
                        onChange={(e) => updatePeriod(idx, 'home', Number(e.target.value) || 0)}
                        className="w-14 rounded-lg bg-[#101016] border border-white/[0.12] px-2 py-1 text-xs text-white text-center tabular-nums"
                      />
                      <span className="text-zinc-600">-</span>
                      <input
                        aria-label={`Parcial ${idx + 1} Visita`}
                        type="number"
                        min={0}
                        value={p.away}
                        onChange={(e) => updatePeriod(idx, 'away', Number(e.target.value) || 0)}
                        className="w-14 rounded-lg bg-[#101016] border border-white/[0.12] px-2 py-1 text-xs text-white text-center tabular-nums"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removePeriodRow(idx)}
                      aria-label={`Eliminar parcial ${idx + 1}`}
                      className="text-zinc-500 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="edit-m-note" className="block text-xs text-zinc-400 mb-1.5">
              Nota de bitácora (opcional)
            </label>
            <input
              id="edit-m-note"
              type="text"
              value={correctionNote}
              onChange={(e) => setCorrectionNote(e.target.value)}
              placeholder="Ej: Corrección tras revisión de acta física oficial."
              className={inputCls}
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                setEditingMatch(null);
                setIsCreatingMatch(false);
                setErrorMsg(null);
              }}
              className="px-4 py-2.5 rounded-full border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-300 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full bg-[#707ef9] hover:bg-[#5c6bf0] text-xs font-medium text-white transition-colors cursor-pointer"
            >
              {isCreatingMatch ? 'Crear encuentro' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      )}

      {/* Unified Match Filter Bar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por equipo, cancha, grupo, fase o fecha..."
            aria-label="Buscar partidos"
            className="w-full rounded-xl bg-[#101016] border border-white/[0.1] pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
          />
        </div>

        <MatchFilterBar
          idPrefix="admin-matches"
          matches={state.matches}
          disciplineFilter={disciplineFilter}
          onDisciplineChange={(val) => {
            setDisciplineFilter(val);
            setGroupFilter('ALL');
          }}
          groupFilter={groupFilter}
          onGroupChange={setGroupFilter}
          stageFilter={stageFilter}
          onStageChange={setStageFilter}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          filteredCount={filteredMatches.length}
          totalCount={state.matches.length}
          hasExtraActiveFilters={statusFilter !== 'ALL' || query.trim().length > 0}
          onReset={() => {
            setDisciplineFilter('ALL');
            setGroupFilter('ALL');
            setStageFilter('ALL');
            setGroupBy('none');
            setSortOrder('newest');
            setStatusFilter('ALL');
            setQuery('');
          }}
          extraControls={
            <div className="min-w-[175px] flex-1">
              <label
                htmlFor="admin-matches-status"
                className="block text-[11px] uppercase tracking-wider text-zinc-500 mb-1"
              >
                Estado
              </label>
              <select
                id="admin-matches-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | MatchStatus)}
                aria-label="Filtrar partidos por estado"
                className="w-full rounded-xl bg-[#050507] border border-white/[0.1] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#707ef9]"
              >
                <option value="ALL">Todos los estados</option>
                <option value="FINALIZADO">Finalizados ({pastCount})</option>
                <option value="EN_VIVO">En Vivo ({liveCount})</option>
                <option value="PROGRAMADO">Programados ({scheduledCount})</option>
              </select>
            </div>
          }
        />
      </div>

      {/* Matches List */}
      {filteredMatches.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#101016] p-10 text-center space-y-2">
          <p className="text-base font-medium text-white">Sin encuentros con estos filtros</p>
          <p className="text-xs text-zinc-400">
            Ajusta los filtros o programa un nuevo partido.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedMatchSections.map((section) => (
            <div key={section.key} className="space-y-2.5">
              {groupBy !== 'none' && (
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                  <h3 className="text-base font-medium text-white">{section.label}</h3>
                  <span className="text-xs font-mono text-zinc-500 tabular-nums">
                    {section.matches.length}{' '}
                    {section.matches.length === 1 ? 'partido' : 'partidos'}
                  </span>
                </div>
              )}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] divide-y divide-white/[0.06] overflow-hidden">
                {section.matches.map((m) => {
                  const home = teamMap.get(m.homeTeamId);
                  const away = teamMap.get(m.awayTeamId);
                  const disc = DISCIPLINE_MAP[m.disciplineId];
                  return (
                    <div
                      key={m.id}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                              m.status === 'FINALIZADO'
                                ? 'bg-white/[0.08] text-zinc-200'
                                : m.status === 'EN_VIVO'
                                ? 'bg-[#707ef9]/20 text-[#c8ceff] border border-[#707ef9]/40'
                                : 'bg-white/[0.03] text-zinc-400 border border-white/[0.08]'
                            }`}
                          >
                            {m.status === 'FINALIZADO'
                              ? 'Finalizado'
                              : m.status === 'EN_VIVO'
                              ? 'En vivo'
                              : 'Programado'}
                          </span>
                          <span className="font-medium text-[#a5b0ff]">{disc.nombreCorto}</span>
                          <span className="text-zinc-500">
                            {m.fase} · J{m.jornada} · {m.groupName}
                          </span>
                          {m.fase !== 'Grupos' &&
                            (m.playoffLeg === 'IDA' || m.playoffLeg === 'VUELTA') && (
                              <span className="px-2 py-0.5 rounded-full bg-[#707ef9]/15 text-[#c8ceff] text-[10px] font-medium">
                                {m.playoffLeg}
                              </span>
                            )}
                          <span className="text-zinc-500 inline-flex items-center gap-1 tabular-nums">
                            <Calendar className="w-3 h-3" />
                            {m.fecha} {m.hora}
                          </span>
                        </div>

                        <p className="text-sm font-medium text-white flex flex-wrap items-center gap-2">
                          <span>{home?.nombre ?? m.homeTeamId}</span>
                          <span className="px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-sm font-mono tabular-nums text-white">
                            {m.homeScore} — {m.awayScore}
                          </span>
                          {m.penaltyScore && (
                            <span className="px-2 py-0.5 rounded-full bg-[#707ef9]/15 border border-[#707ef9]/35 text-[11px] text-[#c8ceff] tabular-nums">
                              Pen. {m.penaltyScore.home} — {m.penaltyScore.away}
                            </span>
                          )}
                          <span>{away?.nombre ?? m.awayTeamId}</span>
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {m.cancha}
                          {m.assignedRefereeName ? ` · Árbitro: ${m.assignedRefereeName}` : ''}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => startEditing(m)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white hover:text-[#050507] text-xs font-medium text-zinc-200 transition-colors cursor-pointer self-start md:self-auto shrink-0"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{m.status === 'FINALIZADO' ? 'Corregir' : 'Editar'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
