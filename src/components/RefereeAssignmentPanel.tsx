import { useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Filter,
  Search,
  Shield,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { DISCIPLINE_MAP } from '../data/ufroSeed';
import {
  getRefereeChiefDisciplines,
  isRefereeOrChiefRole,
  ROLE_META,
} from '../domain/rbacEngine';
import type {
  AppUserProfile,
  DisciplineId,
  Match,
  MatchStatus,
  TournamentState,
} from '../types/tournament';

interface RefereeAssignmentPanelProps {
  state: TournamentState;
  currentUser: AppUserProfile;
  onUpdateMatch: (match: Match) => void;
  onOpenMatchInDesk?: (matchId: string) => void;
}

interface AssignableRefereeOption {
  uid: string;
  displayName: string;
  roleLabel: string;
}

export function RefereeAssignmentPanel({
  state,
  currentUser,
  onUpdateMatch,
  onOpenMatchInDesk,
}: RefereeAssignmentPanelProps) {
  const allowedDisciplines = useMemo(
    () => getRefereeChiefDisciplines(currentUser),
    [currentUser]
  );

  const [disciplineFilter, setDisciplineFilter] = useState<'ALL' | DisciplineId>('ALL');
  const [assignmentFilter, setAssignmentFilter] = useState<'ALL' | 'UNASSIGNED' | 'ASSIGNED'>(
    'ALL'
  );
  const [statusFilter, setStatusFilter] = useState<'ALL' | MatchStatus>('ALL');
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const teamMap = useMemo(
    () => new Map(state.teams.map((t) => [t.id, t])),
    [state.teams]
  );

  // Merge lightweight /referee_roster with state.users (when admin/moderator loaded it)
  const assignableReferees = useMemo<AssignableRefereeOption[]>(() => {
    const byUid = new Map<string, AssignableRefereeOption>();

    for (const entry of state.refereeRoster ?? []) {
      if (!entry.uid) continue;
      byUid.set(entry.uid, {
        uid: entry.uid,
        displayName: entry.displayName || 'Árbitro UFRO',
        roleLabel: ROLE_META[entry.role]?.shortLabel ?? entry.role,
      });
    }

    for (const u of state.users) {
      if (!isRefereeOrChiefRole(u.role)) continue;
      byUid.set(u.uid, {
        uid: u.uid,
        displayName: u.displayName || u.email,
        roleLabel: ROLE_META[u.role]?.shortLabel ?? u.role,
      });
    }

    // Ensure the acting chief/admin can also self-assign if needed
    if (isRefereeOrChiefRole(currentUser.role) && !byUid.has(currentUser.uid)) {
      byUid.set(currentUser.uid, {
        uid: currentUser.uid,
        displayName: currentUser.displayName || currentUser.email,
        roleLabel: ROLE_META[currentUser.role]?.shortLabel ?? currentUser.role,
      });
    }

    return Array.from(byUid.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName, 'es')
    );
  }, [state.refereeRoster, state.users, currentUser]);

  const refereeByUid = useMemo(
    () => new Map(assignableReferees.map((r) => [r.uid, r])),
    [assignableReferees]
  );

  const scopedMatches = useMemo(() => {
    const allowedSet = new Set<DisciplineId>(allowedDisciplines);
    return state.matches.filter((m) => allowedSet.has(m.disciplineId));
  }, [state.matches, allowedDisciplines]);

  const filteredMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scopedMatches
      .filter((m) => {
        if (disciplineFilter !== 'ALL' && m.disciplineId !== disciplineFilter) return false;
        if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
        const isAssigned = Boolean(m.assignedRefereeUid);
        if (assignmentFilter === 'UNASSIGNED' && isAssigned) return false;
        if (assignmentFilter === 'ASSIGNED' && !isAssigned) return false;
        if (!q) return true;
        const homeName = teamMap.get(m.homeTeamId)?.nombre.toLowerCase() ?? '';
        const awayName = teamMap.get(m.awayTeamId)?.nombre.toLowerCase() ?? '';
        const refName = (m.assignedRefereeName ?? '').toLowerCase();
        return (
          homeName.includes(q) ||
          awayName.includes(q) ||
          refName.includes(q) ||
          m.cancha.toLowerCase().includes(q) ||
          m.fecha.includes(q)
        );
      })
      .sort((a, b) => {
        // Prioritize upcoming / live matches chronologically
        const order = { EN_VIVO: 0, PROGRAMADO: 1, FINALIZADO: 2 };
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        const dateCmp = `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`);
        return a.status === 'FINALIZADO' ? -dateCmp : dateCmp;
      });
  }, [scopedMatches, disciplineFilter, statusFilter, assignmentFilter, query, teamMap]);

  const assignedCount = scopedMatches.filter((m) => Boolean(m.assignedRefereeUid)).length;
  const unassignedCount = scopedMatches.length - assignedCount;

  const handleAssignReferee = (match: Match, nextUid: string) => {
    const homeName = teamMap.get(match.homeTeamId)?.nombre ?? match.homeTeamId;
    const awayName = teamMap.get(match.awayTeamId)?.nombre ?? match.awayTeamId;

    if (!nextUid) {
      const cleared: Match = {
        ...match,
        assignedRefereeUid: undefined,
        assignedRefereeName: undefined,
        refereeId: 'sin-asignar',
      };
      onUpdateMatch(cleared);
      setFeedback(`Designación retirada en ${homeName} vs ${awayName}.`);
      return;
    }

    const ref = refereeByUid.get(nextUid);
    const updated: Match = {
      ...match,
      assignedRefereeUid: nextUid,
      assignedRefereeName: ref?.displayName ?? 'Árbitro designado',
      refereeId: nextUid,
    };
    onUpdateMatch(updated);
    setFeedback(
      `${ref?.displayName ?? 'Árbitro'} designado para ${homeName} vs ${awayName}.`
    );
  };

  return (
    <div className="space-y-6" data-testid="referee-assignment-panel">
      {/* Header & KPI strip */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#a5b0ff]">
            <Shield className="w-3.5 h-3.5" />
            <span>Jefatura de Arbitraje · {ROLE_META[currentUser.role].label}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-medium tracking-[-0.025em] text-white">
            Designación de{' '}
            <span className="font-editorial italic font-normal text-[#c8ceff]">árbitros</span>
          </h2>
          <p className="text-xs text-zinc-400 max-w-2xl">
            Asigna un árbitro oficial a cada encuentro de tus categorías. Los árbitros solo
            visualizarán en su Mesa Arbitral los partidos designados a su cuenta.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 shrink-0">
          <div className="rounded-2xl border border-white/[0.08] bg-[#101016] px-4 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Partidos</p>
            <p className="text-xl font-medium tabular-nums text-white mt-0.5">
              {scopedMatches.length}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-300/80">Asignados</p>
            <p className="text-xl font-medium tabular-nums text-emerald-300 mt-0.5">
              {assignedCount}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.07] px-4 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-[0.14em] text-amber-300/80">Pendientes</p>
            <p className="text-xl font-medium tabular-nums text-amber-300 mt-0.5">
              {unassignedCount}
            </p>
          </div>
        </div>
      </div>

      {/* Discipline Scope Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setDisciplineFilter('ALL')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
            disciplineFilter === 'ALL'
              ? 'bg-white text-[#050507]'
              : 'bg-white/[0.04] text-zinc-300 border border-white/[0.08] hover:border-white/[0.2]'
          }`}
        >
          Todas mis categorías ({scopedMatches.length})
        </button>
        {allowedDisciplines.map((dId) => {
          const meta = DISCIPLINE_MAP[dId];
          const count = scopedMatches.filter((m) => m.disciplineId === dId).length;
          return (
            <button
              key={dId}
              type="button"
              onClick={() => setDisciplineFilter(dId)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                disciplineFilter === dId
                  ? 'bg-[#707ef9] text-white'
                  : 'bg-white/[0.04] text-zinc-300 border border-white/[0.08] hover:border-white/[0.2]'
              }`}
            >
              {meta.nombreCorto} ({count})
            </button>
          );
        })}
      </div>

      {assignableReferees.length === 0 && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs text-amber-200 flex items-start gap-2.5">
          <UserX className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
          <span>
            Aún no hay cuentas registradas con rol de <strong>Árbitro</strong> en el sistema. Un
            Administrador o Moderador puede asignar el rol en{' '}
            <strong>Administración General → Usuarios y Roles</strong>.
          </span>
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200 flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedback}</span>
          </span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Cerrar aviso"
            className="text-emerald-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl border border-white/[0.08] bg-[#101016] p-4">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar equipo, árbitro, cancha o fecha..."
            aria-label="Buscar partidos para designación"
            className="w-full rounded-xl bg-[#050507] border border-white/[0.1] pl-10 pr-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
          />
        </div>

        <div className="relative flex items-center">
          <Filter className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 pointer-events-none" />
          <select
            value={assignmentFilter}
            onChange={(e) =>
              setAssignmentFilter(e.target.value as 'ALL' | 'UNASSIGNED' | 'ASSIGNED')
            }
            aria-label="Filtrar por estado de designación"
            className="w-full rounded-xl bg-[#050507] border border-white/[0.1] pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#707ef9]"
          >
            <option value="ALL">Todas las designaciones</option>
            <option value="UNASSIGNED">Sin árbitro asignado ({unassignedCount})</option>
            <option value="ASSIGNED">Con árbitro asignado ({assignedCount})</option>
          </select>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'ALL' | MatchStatus)}
          aria-label="Filtrar partidos por estado"
          className="w-full rounded-xl bg-[#050507] border border-white/[0.1] px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#707ef9]"
        >
          <option value="ALL">Todos los estados</option>
          <option value="PROGRAMADO">Programados</option>
          <option value="EN_VIVO">En juego</option>
          <option value="FINALIZADO">Finalizados</option>
        </select>
      </div>

      {/* Matches Assignment List */}
      {filteredMatches.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#101016] p-10 text-center space-y-2">
          <p className="text-base font-medium text-white">Sin encuentros en este filtro</p>
          <p className="text-xs text-zinc-400">
            Ajusta los filtros de disciplina o estado para revisar otros partidos.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] divide-y divide-white/[0.06] overflow-hidden">
          {filteredMatches.map((m) => {
            const home = teamMap.get(m.homeTeamId);
            const away = teamMap.get(m.awayTeamId);
            const disc = DISCIPLINE_MAP[m.disciplineId];
            const currentAssignedUid = m.assignedRefereeUid ?? '';
            const currentAssignedMissing =
              Boolean(currentAssignedUid) && !refereeByUid.has(currentAssignedUid);

            return (
              <div
                key={m.id}
                className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                        m.status === 'EN_VIVO'
                          ? 'bg-[#707ef9]/20 text-[#c8ceff] border border-[#707ef9]/40'
                          : m.status === 'FINALIZADO'
                          ? 'bg-white/[0.08] text-zinc-300'
                          : 'bg-white/[0.04] text-zinc-400 border border-white/[0.08]'
                      }`}
                    >
                      {m.status === 'EN_VIVO'
                        ? 'En juego'
                        : m.status === 'FINALIZADO'
                        ? 'Finalizado'
                        : 'Programado'}
                    </span>
                    <span className="text-[#a5b0ff] font-medium">{disc?.nombreCorto}</span>
                    <span className="text-zinc-500">
                      {m.fase} · J{m.jornada} · {m.groupName}
                    </span>
                    <span className="inline-flex items-center gap-1 text-zinc-400 tabular-nums">
                      <Calendar className="w-3 h-3" />
                      {m.fecha} · {m.hora}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-white">
                    {home?.nombre ?? m.homeTeamId}{' '}
                    <span className="text-zinc-500 font-normal mx-1">
                      {m.status === 'PROGRAMADO' ? 'vs' : `${m.homeScore} — ${m.awayScore}`}
                    </span>{' '}
                    {away?.nombre ?? m.awayTeamId}
                  </p>
                  <p className="text-[11px] text-zinc-500">{m.cancha}</p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
                  <div className="flex items-center gap-2">
                    <UserCheck
                      className={`w-4 h-4 shrink-0 ${
                        currentAssignedUid ? 'text-emerald-400' : 'text-zinc-600'
                      }`}
                    />
                    <select
                      aria-label={`Designar árbitro para ${home?.nombre ?? m.homeTeamId} vs ${away?.nombre ?? m.awayTeamId}`}
                      value={currentAssignedUid}
                      onChange={(e) => handleAssignReferee(m, e.target.value)}
                      className="min-w-[220px] rounded-full bg-[#101016] border border-white/[0.12] px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#707ef9] cursor-pointer"
                    >
                      <option value="">Sin árbitro designado</option>
                      {currentAssignedMissing && (
                        <option value={currentAssignedUid}>
                          {m.assignedRefereeName ?? currentAssignedUid} (Actual)
                        </option>
                      )}
                      {assignableReferees.map((ref) => (
                        <option key={ref.uid} value={ref.uid}>
                          {ref.displayName} · {ref.roleLabel}
                        </option>
                      ))}
                    </select>
                  </div>

                  {onOpenMatchInDesk && (
                    <button
                      type="button"
                      onClick={() => onOpenMatchInDesk(m.id)}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full border border-white/[0.12] bg-white/[0.04] hover:bg-white hover:text-[#050507] text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      <span>Abrir mesa</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
