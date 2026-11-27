import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Plus, Search, Trash2, Trophy } from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
import { formatDorsalLabel } from '../domain/attendanceEngine';
import type { DisciplineId, TournamentState } from '../types/tournament';
import { TeamCrest } from './TeamCrest';

interface AdminAwardsManagerProps {
  state: TournamentState;
  onSaveAwardNominees: (disciplineId: DisciplineId, nomineeIds: string[]) => Promise<void> | void;
}

export function AdminAwardsManager({
  state,
  onSaveAwardNominees,
}: AdminAwardsManagerProps) {
  const [disciplineId, setDisciplineId] = useState<DisciplineId>('f7-h-1');
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setDraftIds(state.awardNominees[disciplineId] ?? []);
    setFeedback(null);
  }, [disciplineId, state.awardNominees]);

  const teamMap = useMemo(() => new Map(state.teams.map((t) => [t.id, t])), [state.teams]);
  const playerMap = useMemo(() => new Map(state.players.map((p) => [p.id, p])), [state.players]);

  const disciplinePlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.players
      .filter((p) => {
        if (p.disciplineId !== disciplineId) return false;
        if (!q) return true;
        const tm = teamMap.get(p.teamId);
        return (
          `${p.nombre} ${p.apellidoPaterno} ${p.apellidoMaterno}`.toLowerCase().includes(q) ||
          (tm?.nombre ?? '').toLowerCase().includes(q) ||
          p.posicion.toLowerCase().includes(q)
        );
      })
      .sort((a, b) =>
        `${a.nombre} ${a.apellidoPaterno}`.localeCompare(`${b.nombre} ${b.apellidoPaterno}`, 'es')
      );
  }, [state.players, disciplineId, search, teamMap]);

  const toggleNominee = (playerId: string) => {
    setFeedback(null);
    setDraftIds((prev) => {
      if (prev.includes(playerId)) {
        return prev.filter((id) => id !== playerId);
      }
      if (prev.length >= 5) return prev;
      return [...prev, playerId];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await onSaveAwardNominees(disciplineId, draftIds);
      setFeedback(
        `Nómina de ${draftIds.length} nominado(s) al MVP de ${DISCIPLINE_MAP[disciplineId].nombreCorto} guardada.`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/[0.08] bg-[#101016] p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#a5b0ff]">
              Premios Oficiales · Máx. 5 por disciplina
            </p>
            <h2 className="text-2xl font-medium tracking-[-0.02em] text-white">
              Nominados al{' '}
              <span className="font-editorial italic font-normal text-[#c8ceff]">
                MVP del campeonato
              </span>
            </h2>
          </div>

          <select
            value={disciplineId}
            onChange={(e) => setDisciplineId(e.target.value as DisciplineId)}
            className="rounded-xl bg-[#050507] border border-white/[0.12] px-3.5 py-2.5 text-sm text-white focus:border-[#707ef9] focus:outline-none"
            aria-label="Seleccionar disciplina para nominados MVP"
          >
            {DISCIPLINES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
        </div>

        {feedback && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 rounded-3xl border border-white/[0.08] bg-[#0c0c10] overflow-hidden">
          <div className="bg-[#101016] border-b border-white/[0.08] p-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#a5b0ff]" />
              <h3 className="text-base font-medium text-white">
                Nominados ({draftIds.length}/5)
              </h3>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-4 py-2 rounded-full bg-[#707ef9] hover:bg-[#5c6bf0] disabled:opacity-50 text-xs font-medium text-white transition-colors cursor-pointer"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>

          {draftIds.length === 0 ? (
            <div className="p-6 text-xs text-zinc-500">
              Selecciona hasta 5 jugadores de {DISCIPLINE_MAP[disciplineId].nombreCorto} desde el
              buscador.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {draftIds.map((pid, idx) => {
                const pl = playerMap.get(pid);
                const tm = pl ? teamMap.get(pl.teamId) : undefined;
                return (
                  <div key={pid} className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-mono text-[#a5b0ff] w-5">{idx + 1}.</span>
                      <TeamCrest
                        escudo={tm?.escudo}
                        sigla={tm?.sigla ?? 'EQ'}
                        nombre={tm?.nombre ?? 'Equipo'}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {pl ? `${pl.nombre} ${pl.apellidoPaterno}` : pid}
                        </p>
                        <p className="text-xs text-zinc-500 truncate">
                          {tm?.nombre ?? 'Equipo UFRO'} · {pl?.posicion ?? 'Jugador'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleNominee(pid)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 cursor-pointer"
                      aria-label="Quitar nominado"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-7 rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-5 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Buscar jugadores en ${DISCIPLINE_MAP[disciplineId].nombreCorto}...`}
              className="w-full rounded-xl bg-[#050507] border border-white/[0.1] pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-[#707ef9] focus:outline-none"
            />
          </div>

          {disciplinePlayers.length === 0 ? (
            <p className="text-sm text-zinc-500 py-8 text-center">
              No hay jugadores registrados en esta disciplina.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
              {disciplinePlayers.map((pl) => {
                const tm = teamMap.get(pl.teamId);
                const selected = draftIds.includes(pl.id);
                const full = !selected && draftIds.length >= 5;
                return (
                  <div
                    key={pl.id}
                    className={`rounded-2xl border p-3 flex items-center justify-between gap-2 ${
                      selected
                        ? 'border-[#707ef9]/50 bg-[#707ef9]/10'
                        : 'border-white/[0.08] bg-[#101016]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {formatDorsalLabel(pl.dorsal)} {pl.nombre} {pl.apellidoPaterno}
                      </p>
                      <p className="text-[11px] text-zinc-500 truncate">
                        {tm?.sigla ?? 'EQ'} · {pl.posicion} · {pl.stats.goles}G / {pl.stats.puntos}P
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={full}
                      onClick={() => toggleNominee(pl.id)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-medium shrink-0 cursor-pointer disabled:opacity-35 transition-colors ${
                        selected
                          ? 'bg-red-500/20 text-red-200 border border-red-500/35'
                          : 'bg-white text-[#050507] hover:bg-zinc-200'
                      }`}
                    >
                      {selected ? (
                        'Quitar'
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Nominar
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
