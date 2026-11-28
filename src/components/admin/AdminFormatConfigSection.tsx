import { useEffect, useState } from 'react';
import { CheckCircle2, Power, RefreshCw, Sliders } from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../../data/ufroSeed';
import type {
  DisciplineFormatConfig,
  DisciplineId,
  Team,
  TournamentStage,
} from '../../types/tournament';

interface AdminFormatConfigSectionProps {
  configs: Record<DisciplineId, DisciplineFormatConfig>;
  teams: Team[];
  onUpdateConfig: (
    disciplineId: DisciplineId,
    config: DisciplineFormatConfig,
    regenerateGroups: boolean
  ) => void;
}

export function AdminFormatConfigSection({
  configs,
  teams,
  onUpdateConfig,
}: AdminFormatConfigSectionProps) {
  const [configDiscId, setConfigDiscId] = useState<DisciplineId>('f7-h-1');
  const [draftConfig, setDraftConfig] = useState<DisciplineFormatConfig>(configs['f7-h-1']);
  const [configSavedMsg, setConfigSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setDraftConfig(configs[configDiscId]);
  }, [configDiscId, configs]);

  useEffect(() => {
    setConfigSavedMsg(null);
  }, [configDiscId]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] overflow-hidden">
        <div className="p-6 border-b border-white/[0.08] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#707ef9]/15 border border-[#707ef9]/30 flex items-center justify-center shrink-0">
              <Power className="w-5 h-5 text-[#a5b0ff]" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-white">
                Períodos de{' '}
                <span className="font-editorial font-normal text-[#c8ceff]">
                  Inscripción y Transferencias
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                La pestaña &ldquo;Inscripciones&rdquo; del menú principal solo se muestra cuando al
                menos una disciplina tiene inscripciones abiertas.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                DISCIPLINES.forEach((d) => {
                  const cfg = configs[d.id];
                  if (!cfg.inscripcionesAbiertas) {
                    onUpdateConfig(d.id, { ...cfg, inscripcionesAbiertas: true }, false);
                  }
                });
                setDraftConfig((c) => ({ ...c, inscripcionesAbiertas: true }));
                setConfigSavedMsg('Inscripciones abiertas en las 8 disciplinas.');
              }}
              className="px-3.5 py-2 rounded-full bg-[#707ef9] hover:bg-[#5c6bf0] text-white text-xs font-medium cursor-pointer transition-colors"
            >
              Abrir Inscripciones
            </button>
            <button
              type="button"
              onClick={() => {
                DISCIPLINES.forEach((d) => {
                  const cfg = configs[d.id];
                  if (cfg.inscripcionesAbiertas) {
                    onUpdateConfig(d.id, { ...cfg, inscripcionesAbiertas: false }, false);
                  }
                });
                setDraftConfig((c) => ({ ...c, inscripcionesAbiertas: false }));
                setConfigSavedMsg('Inscripciones cerradas en todas las disciplinas.');
              }}
              className="px-3.5 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-zinc-200 text-xs font-medium cursor-pointer transition-colors"
            >
              Cerrar Inscripciones
            </button>
            <button
              type="button"
              onClick={() => {
                DISCIPLINES.forEach((d) => {
                  const cfg = configs[d.id];
                  if (!cfg.transferenciasAbiertas) {
                    onUpdateConfig(d.id, { ...cfg, transferenciasAbiertas: true }, false);
                  }
                });
                setDraftConfig((c) => ({ ...c, transferenciasAbiertas: true }));
                setConfigSavedMsg('Transferencias abiertas en las 8 disciplinas.');
              }}
              className="px-3.5 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-zinc-200 text-xs font-medium cursor-pointer transition-colors"
            >
              Abrir Transferencias
            </button>
            <button
              type="button"
              onClick={() => {
                DISCIPLINES.forEach((d) => {
                  const cfg = configs[d.id];
                  if (cfg.transferenciasAbiertas) {
                    onUpdateConfig(d.id, { ...cfg, transferenciasAbiertas: false }, false);
                  }
                });
                setDraftConfig((c) => ({ ...c, transferenciasAbiertas: false }));
                setConfigSavedMsg('Transferencias cerradas en todas las disciplinas.');
              }}
              className="px-3.5 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-zinc-200 text-xs font-medium cursor-pointer transition-colors"
            >
              Cerrar Transferencias
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-white/[0.03] border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="py-3 px-4 font-medium">Disciplina</th>
                <th className="py-3 px-4 font-medium">Fase actual</th>
                <th className="py-3 px-4 text-center font-medium">Inscripciones</th>
                <th className="py-3 px-4 text-center font-medium">Transferencias</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {DISCIPLINES.map((d) => {
                const cfg = configs[d.id];
                const toggleInscripciones = () => {
                  const nextCfg: DisciplineFormatConfig = {
                    ...cfg,
                    inscripcionesAbiertas: !cfg.inscripcionesAbiertas,
                  };
                  onUpdateConfig(d.id, nextCfg, false);
                  if (d.id === configDiscId) setDraftConfig(nextCfg);
                  setConfigSavedMsg(
                    `Inscripciones de ${d.nombreCorto}: ${
                      nextCfg.inscripcionesAbiertas ? 'Abiertas' : 'Cerradas'
                    }.`
                  );
                };
                const toggleTransferencias = () => {
                  const nextCfg: DisciplineFormatConfig = {
                    ...cfg,
                    transferenciasAbiertas: !cfg.transferenciasAbiertas,
                  };
                  onUpdateConfig(d.id, nextCfg, false);
                  if (d.id === configDiscId) setDraftConfig(nextCfg);
                  setConfigSavedMsg(
                    `Transferencias de ${d.nombreCorto}: ${
                      nextCfg.transferenciasAbiertas ? 'Abiertas' : 'Cerradas'
                    }.`
                  );
                };
                return (
                  <tr key={d.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-medium text-white">{d.nombre}</td>
                    <td className="py-3 px-4 text-xs text-zinc-400">
                      {cfg.faseActual.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={cfg.inscripcionesAbiertas}
                        aria-label={`Inscripciones para ${d.nombre}`}
                        onClick={toggleInscripciones}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                          cfg.inscripcionesAbiertas
                            ? 'bg-[#707ef9] border-[#707ef9] text-white'
                            : 'bg-[#101016] border-white/[0.1] text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{cfg.inscripcionesAbiertas ? 'Abiertas' : 'Cerradas'}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={cfg.transferenciasAbiertas}
                        aria-label={`Transferencias para ${d.nombre}`}
                        onClick={toggleTransferencias}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                          cfg.transferenciasAbiertas
                            ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                            : 'bg-[#101016] border-white/[0.1] text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{cfg.transferenciasAbiertas ? 'Abiertas' : 'Cerradas'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-3">
            Disciplinas
          </p>
          {DISCIPLINES.map((d) => {
            const cfg = configs[d.id];
            const teamCount = teams.filter((t) => t.disciplineId === d.id).length;
            const active = d.id === configDiscId;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setConfigDiscId(d.id)}
                className={`w-full text-left px-4 py-3.5 rounded-2xl border transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                  active
                    ? 'bg-[#707ef9]/15 text-white border-[#707ef9]/50'
                    : 'bg-[#0c0c10] text-zinc-200 border-white/[0.08] hover:border-white/[0.18]'
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-white">{d.nombre}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {cfg.numGrupos} grupos · Top {cfg.formatoPlayoff}
                    {cfg.playoffsIdaYVuelta ? ' · Ida y Vuelta' : ''}
                  </p>
                </div>
                <span className="font-display text-sm font-semibold tabular-nums text-[#a5b0ff] shrink-0">
                  {teamCount}/{cfg.maxCupos}
                </span>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-8 rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-6 sm:p-8 space-y-6 self-start">
          <div className="flex items-center gap-3 border-b border-white/[0.08] pb-4">
            <div className="w-10 h-10 rounded-2xl bg-[#707ef9]/15 border border-[#707ef9]/30 flex items-center justify-center shrink-0">
              <Sliders className="w-5 h-5 text-[#a5b0ff]" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-white">
                {DISCIPLINE_MAP[configDiscId].nombre}
              </h2>
              <p className="text-xs text-zinc-400">
                Cupos, grupos equitativos y llaves de playoffs.
              </p>
            </div>
          </div>

          {configSavedMsg && (
            <div
              role="status"
              className="rounded-2xl bg-emerald-500/10 border border-emerald-400/25 p-4 text-xs text-emerald-200 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{configSavedMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label htmlFor="cfg-cupos" className="block text-xs text-zinc-400 mb-1.5">
                Cupos máximos
              </label>
              <input
                id="cfg-cupos"
                type="number"
                min={4}
                max={80}
                value={draftConfig.maxCupos}
                onChange={(e) =>
                  setDraftConfig((c) => ({
                    ...c,
                    maxCupos: Math.max(4, Number(e.target.value) || 4),
                  }))
                }
                className="w-full rounded-xl bg-[#101016] border border-white/[0.1] px-3 py-2 text-sm text-white tabular-nums focus:outline-none focus:border-[#707ef9]"
              />
            </div>

            <div>
              <label htmlFor="cfg-grupos" className="block text-xs text-zinc-400 mb-1.5">
                Grupos equitativos
              </label>
              <input
                id="cfg-grupos"
                type="number"
                min={1}
                max={12}
                value={draftConfig.numGrupos}
                onChange={(e) =>
                  setDraftConfig((c) => ({
                    ...c,
                    numGrupos: Math.max(1, Math.min(12, Number(e.target.value) || 1)),
                  }))
                }
                className="w-full rounded-xl bg-[#101016] border border-white/[0.1] px-3 py-2 text-sm text-white tabular-nums focus:outline-none focus:border-[#707ef9]"
              />
            </div>

            <div>
              <label htmlFor="cfg-clasif" className="block text-xs text-zinc-400 mb-1.5">
                Clasificados por grupo
              </label>
              <input
                id="cfg-clasif"
                type="number"
                min={1}
                max={4}
                value={draftConfig.clasificadosPorGrupo}
                onChange={(e) =>
                  setDraftConfig((c) => ({
                    ...c,
                    clasificadosPorGrupo: Math.max(
                      1,
                      Math.min(4, Number(e.target.value) || 1)
                    ),
                  }))
                }
                className="w-full rounded-xl bg-[#101016] border border-white/[0.1] px-3 py-2 text-sm text-white tabular-nums focus:outline-none focus:border-[#707ef9]"
              />
            </div>

            <div>
              <label htmlFor="cfg-playoff" className="block text-xs text-zinc-400 mb-1.5">
                Formato Playoffs
              </label>
              <select
                id="cfg-playoff"
                value={draftConfig.formatoPlayoff}
                onChange={(e) =>
                  setDraftConfig((c) => ({
                    ...c,
                    formatoPlayoff: Number(e.target.value) as 4 | 8 | 16,
                  }))
                }
                className="w-full rounded-xl bg-[#101016] border border-white/[0.1] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#707ef9]"
              >
                <option value={4}>Semifinales (4)</option>
                <option value={8}>Cuartos de Final (8)</option>
                <option value={16}>Octavos de Final (16)</option>
              </select>
            </div>

            <div>
              <label htmlFor="cfg-fase" className="block text-xs text-zinc-400 mb-1.5">
                Etapa actual
              </label>
              <select
                id="cfg-fase"
                value={draftConfig.faseActual}
                onChange={(e) =>
                  setDraftConfig((c) => ({
                    ...c,
                    faseActual: e.target.value as TournamentStage,
                  }))
                }
                className="w-full rounded-xl bg-[#101016] border border-white/[0.1] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#707ef9]"
              >
                <option value="INSCRIPCIONES">Inscripciones</option>
                <option value="FASE_GRUPOS">Fase de Grupos</option>
                <option value="TRANSFERENCIAS">Transferencias</option>
                <option value="PLAYOFFS">Playoffs</option>
              </select>
            </div>

            <div>
              <label htmlFor="cfg-max-tr" className="block text-xs text-zinc-400 mb-1.5">
                Máx. transferencias
              </label>
              <input
                id="cfg-max-tr"
                type="number"
                min={0}
                max={5}
                value={draftConfig.maxTransferenciasPorEquipo}
                onChange={(e) =>
                  setDraftConfig((c) => ({
                    ...c,
                    maxTransferenciasPorEquipo: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className="w-full rounded-xl bg-[#101016] border border-white/[0.1] px-3 py-2 text-sm text-white tabular-nums focus:outline-none focus:border-[#707ef9]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-white/[0.08]">
            <label className="inline-flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
              <input
                type="checkbox"
                checked={draftConfig.inscripcionesAbiertas}
                onChange={(e) =>
                  setDraftConfig((c) => ({ ...c, inscripcionesAbiertas: e.target.checked }))
                }
                className="accent-[#707ef9] w-4 h-4"
              />
              <span>Período de inscripciones abierto</span>
            </label>

            <label className="inline-flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
              <input
                type="checkbox"
                checked={draftConfig.transferenciasAbiertas}
                onChange={(e) =>
                  setDraftConfig((c) => ({ ...c, transferenciasAbiertas: e.target.checked }))
                }
                className="accent-[#707ef9] w-4 h-4"
              />
              <span>Ventana de transferencias abierta</span>
            </label>

            <label className="inline-flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
              <input
                type="checkbox"
                checked={draftConfig.incluyeTercerLugar !== false}
                onChange={(e) =>
                  setDraftConfig((c) => ({ ...c, incluyeTercerLugar: e.target.checked }))
                }
                className="accent-[#707ef9] w-4 h-4"
              />
              <span>Incluir partido por el Tercer Lugar</span>
            </label>

            <label className="inline-flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(draftConfig.playoffsIdaYVuelta)}
                onChange={(e) =>
                  setDraftConfig((c) => ({ ...c, playoffsIdaYVuelta: e.target.checked }))
                }
                className="accent-[#707ef9] w-4 h-4"
              />
              <span>Playoffs Ida y Vuelta</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                onUpdateConfig(configDiscId, draftConfig, false);
                setConfigSavedMsg('Parámetros guardados en la base de datos.');
              }}
              className="px-5 py-2.5 rounded-full bg-white hover:bg-[#c8ceff] text-[#050507] text-xs font-semibold cursor-pointer transition-colors"
            >
              Guardar cambios
            </button>
            <button
              type="button"
              disabled={teams.filter((t) => t.disciplineId === configDiscId).length < 2}
              onClick={() => {
                onUpdateConfig(configDiscId, draftConfig, true);
                setConfigSavedMsg(
                  `Grupos recalculados y fixture generado para ${DISCIPLINE_MAP[configDiscId].nombreCorto}.`
                );
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#707ef9] hover:bg-[#5c6bf0] text-white text-xs font-semibold cursor-pointer disabled:opacity-40 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Guardar y generar grupos / fixture</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
