import { Medal, X } from 'lucide-react';
import {
  SPORT_CONFIG,
  type LeyendasRankingCategory,
} from '../../domain/leyendasEngine';
import type { LeyendasLeaderboardEntry } from '../../types/tournament';
import { LeyendasTrophyIcon } from '../LeyendasTrophyIcon';

interface LeyendasWeeklyRankingSectionProps {
  weekLabel: string;
  rankingTab: LeyendasRankingCategory;
  weeklyRanking: LeyendasLeaderboardEntry[];
  inspectedEntry: LeyendasLeaderboardEntry | null;
  onSelectTab: (tab: LeyendasRankingCategory) => void;
  onInspectEntry: (entry: LeyendasLeaderboardEntry | null) => void;
}

export function LeyendasWeeklyRankingSection({
  weekLabel,
  rankingTab,
  weeklyRanking,
  inspectedEntry,
  onSelectTab,
  onInspectEntry,
}: LeyendasWeeklyRankingSectionProps) {
  return (
    <>
      <section className="rounded-3xl bg-[#0c0c10] border border-white/[0.08] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
          <div className="min-w-0 space-y-1">
            <p className="text-xs text-[#a5b0ff]">Ranking semanal · {weekLabel}</p>
            <h2 className="text-2xl sm:text-3xl font-medium tracking-[-0.03em] text-white">
              Top global <span className="font-editorial text-[#c8ceff]">Leyendas</span>
            </h2>
            <p className="text-sm text-white/55">
              Las mejores carreras completadas esta semana. Selecciona cualquier fila para
              inspeccionar su palmarés completo.
            </p>
          </div>

          <div className="flex flex-wrap lg:flex-nowrap items-center gap-1 rounded-full bg-[#111117] border border-white/[0.08] p-1 shrink-0">
            {(
              [
                { id: 'general', label: 'General' },
                { id: 'futbol-h', label: 'F7 Hombres' },
                { id: 'futbol-m', label: 'F7 Mujeres' },
                { id: 'basquet', label: 'Básquet' },
                { id: 'voley', label: 'Voleibol' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  rankingTab === tab.id
                    ? 'bg-[#707ef9] text-white'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {weeklyRanking.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-[#111117] p-10 text-center space-y-2">
            <Medal className="w-7 h-7 text-[#a5b0ff] mx-auto" />
            <p className="text-lg font-medium text-white">
              Aún no hay carreras registradas esta semana
            </p>
            <p className="text-xs text-white/55 max-w-md mx-auto">
              Completa una carrera en Leyendas y publícala con tu cuenta de Google para inaugurar el
              Top Global de {weekLabel}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#111117] border-b border-white/[0.08] text-white/50">
                  <th className="py-3.5 px-4 w-12 font-medium">#</th>
                  <th className="py-3.5 px-4 font-medium">Leyenda</th>
                  <th className="py-3.5 px-4 hidden md:table-cell font-medium">
                    Club final · Carrera
                  </th>
                  <th className="py-3.5 px-4 text-right font-medium tabular-nums">Max OVR</th>
                  <th className="py-3.5 px-4 text-right font-medium tabular-nums">Títulos</th>
                  <th className="py-3.5 px-4 text-right font-medium text-white tabular-nums">
                    Puntaje
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {weeklyRanking.map((entry, idx) => (
                  <tr
                    key={entry.id}
                    onClick={() => onInspectEntry(entry)}
                    className="hover:bg-white/[0.03] cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 text-sm font-semibold tabular-nums text-[#a5b0ff]">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-white text-sm">{entry.playerName}</p>
                      <p className="text-white/50 mt-0.5">{entry.legacyTitle}</p>
                    </td>
                    <td className="py-3.5 px-4 hidden md:table-cell text-white/60">
                      <p className="font-medium text-white/90">{entry.finalTeam}</p>
                      <p className="text-white/45 mt-0.5">
                        {entry.career} · {SPORT_CONFIG[entry.sportKey].shortName} ({entry.pos})
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-right text-base font-semibold text-white tabular-nums">
                      {entry.maxOvr}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-white/75">
                      {entry.titlesCount}
                    </td>
                    <td className="py-3.5 px-4 text-right text-base font-semibold text-[#c8ceff] tabular-nums">
                      {entry.score.toLocaleString('es-CL')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Global Ranking Career Inspector Modal */}
      {inspectedEntry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Detalle de carrera de ${inspectedEntry.playerName}`}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="rounded-3xl bg-[#0c0c10] border border-white/[0.1] max-w-2xl w-full overflow-hidden my-auto">
            <div className="px-6 py-5 border-b border-white/[0.08] flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-[#a5b0ff]">
                  {inspectedEntry.legacyTitle} · {inspectedEntry.weekKey}
                </p>
                <h3 className="text-2xl font-medium tracking-[-0.03em] text-white mt-0.5">
                  {inspectedEntry.playerName}
                </h3>
                <p className="text-xs text-white/60 mt-1 tabular-nums">
                  {inspectedEntry.finalTeam} · {inspectedEntry.career} · Max OVR{' '}
                  {inspectedEntry.maxOvr} · {inspectedEntry.score.toLocaleString('es-CL')} pts
                </p>
              </div>
              <button
                type="button"
                onClick={() => onInspectEntry(null)}
                aria-label="Cerrar detalle de carrera"
                className="p-2 rounded-full bg-white/[0.04] hover:bg-white/[0.1] text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/[0.08] bg-[#111117] p-4 space-y-2.5">
                  <h4 className="text-sm font-medium text-white">
                    Títulos ({inspectedEntry.trophies.length})
                  </h4>
                  {inspectedEntry.trophies.length === 0 ? (
                    <p className="text-xs text-white/45">Sin títulos registrados.</p>
                  ) : (
                    <div className="space-y-2">
                      {inspectedEntry.trophies.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 text-xs text-white/80">
                          <LeyendasTrophyIcon title={t.title} kind="trophy" size="sm" />
                          <span>
                            <strong className="text-white font-medium">{t.title}</strong> ({t.year})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-[#111117] p-4 space-y-2.5">
                  <h4 className="text-sm font-medium text-white">
                    Clubes ({inspectedEntry.stints.length})
                  </h4>
                  <div className="space-y-2 text-xs">
                    {inspectedEntry.stints.map((s, idx) => (
                      <div
                        key={`${s.team}-${idx}`}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="font-medium text-white/85">
                          {s.team} ({s.div})
                        </span>
                        <span className="text-white/45 tabular-nums">{s.years}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
