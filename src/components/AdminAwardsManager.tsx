import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Plus, Search, Trash2, Trophy } from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
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
      if (prev.length >= 5) {
        return prev;
      }
      return [...prev, playerId];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await onSaveAwardNominees(disciplineId, draftIds);
      setFeedback(
        `Nómina oficial de ${draftIds.length} nominado(s) al MVP de ${DISCIPLINE_MAP[disciplineId].nombreCorto} guardada en Firestore.`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-neutral-200 p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#707ef9] font-semibold">
              Administración de Premios Oficiales
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase text-[#0d0d0d] mt-0.5">
              Nominados al MVP del Campeonato (Máx. 5 por disciplina)
            </h2>
            <p className="text-xs text-neutral-600 mt-1">
              Los 5 jugadores seleccionados aparecerán de inmediato en la sección pública{' '}
              <strong>Votaciones → MVP del Campeonato</strong> para que la comunidad vote.
            </p>
          </div>

          <select
            value={disciplineId}
            onChange={(e) => setDisciplineId(e.target.value as DisciplineId)}
            className="px-3.5 py-2.5 text-sm font-medium border border-neutral-300 bg-white focus:border-[#707ef9] focus:outline-none"
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
          <div className="bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Selected 5 Nominees */}
        <div className="lg:col-span-5 bg-white border border-neutral-200">
          <div className="bg-[#0d0d0d] text-white p-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#707ef9]" />
              <h3 className="font-display text-xl font-bold uppercase">
                Nominados Actuales ({draftIds.length}/5)
              </h3>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-3.5 py-1.5 bg-[#707ef9] hover:bg-white hover:text-[#0d0d0d] disabled:opacity-50 text-white text-xs font-display font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              {saving ? 'Guardando...' : 'Guardar Nominados'}
            </button>
          </div>

          {draftIds.length === 0 ? (
            <div className="p-6 text-xs text-neutral-500">
              Aún no has seleccionado nominados para {DISCIPLINE_MAP[disciplineId].nombreCorto}.
              Agrega hasta 5 jugadores desde el buscador.
            </div>
          ) : (
            <div className="divide-y divide-neutral-200">
              {draftIds.map((pid, idx) => {
                const pl = playerMap.get(pid);
                const tm = pl ? teamMap.get(pl.teamId) : undefined;
                return (
                  <div key={pid} className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-display text-lg font-bold text-[#707ef9] w-5">
                        {idx + 1}.
                      </span>
                      <TeamCrest
                        escudo={tm?.escudo}
                        sigla={tm?.sigla ?? 'EQ'}
                        nombre={tm?.nombre ?? 'Equipo'}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#0d0d0d] truncate">
                          {pl ? `${pl.nombre} ${pl.apellidoPaterno}` : pid}
                        </p>
                        <p className="text-xs text-neutral-500 truncate">
                          {tm?.nombre ?? 'Equipo UFRO'} · {pl?.posicion ?? 'Jugador'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleNominee(pid)}
                      className="p-1.5 text-neutral-400 hover:text-red-600 cursor-pointer"
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

        {/* Player Picker */}
        <div className="lg:col-span-7 bg-white border border-neutral-200 p-5 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Buscar jugadores en ${DISCIPLINE_MAP[disciplineId].nombreCorto}...`}
              className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-300 focus:border-[#707ef9] focus:outline-none"
            />
          </div>

          {disciplinePlayers.length === 0 ? (
            <p className="text-sm text-neutral-500 py-8 text-center">
              No hay jugadores registrados en esta disciplina.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
              {disciplinePlayers.map((pl) => {
                const tm = teamMap.get(pl.teamId);
                const selected = draftIds.includes(pl.id);
                const full = !selected && draftIds.length >= 5;
                return (
                  <div
                    key={pl.id}
                    className={`border p-3 flex items-center justify-between gap-2 ${
                      selected ? 'border-[#707ef9] bg-[#707ef9]/5' : 'border-neutral-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#0d0d0d] truncate">
                        #{pl.dorsal} {pl.nombre} {pl.apellidoPaterno}
                      </p>
                      <p className="text-[11px] text-neutral-500 truncate">
                        {tm?.sigla ?? 'EQ'} · {pl.posicion} · {pl.stats.goles}G / {pl.stats.puntos}P
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={full}
                      onClick={() => toggleNominee(pl.id)}
                      className={`px-2.5 py-1.5 text-[11px] font-display font-bold uppercase tracking-wider shrink-0 cursor-pointer disabled:opacity-40 ${
                        selected
                          ? 'bg-red-600 text-white'
                          : 'bg-[#0d0d0d] hover:bg-[#707ef9] text-white'
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
