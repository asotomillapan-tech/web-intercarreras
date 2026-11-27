import { useMemo } from 'react';
import { ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { DISCIPLINE_MAP } from '../data/ufroSeed';
import { canAccessDelegateTransfers } from '../domain/rbacEngine';
import {
  getDivisionLabelForDiscipline,
  getPublicApprovedTransfers,
  getSportCategoryForDiscipline,
  SPORT_FILTER_LABELS,
} from '../domain/transfersEngine';
import type { AppUserProfile, TransferRecord } from '../types/tournament';
import { RevealSection, SectionKicker } from './MotionPrimitives';
import type { NavSection } from './Navbar';

interface HomeTransfersSectionProps {
  transfers: TransferRecord[];
  temporada: string;
  currentUser: AppUserProfile | null;
  onInspectTeam: (teamId: string) => void;
  onNavigate: (section: NavSection) => void;
}

export function HomeTransfersSection({
  transfers,
  temporada,
  currentUser,
  onInspectTeam,
  onNavigate,
}: HomeTransfersSectionProps) {
  const approvedTransfers = useMemo(
    () => getPublicApprovedTransfers(transfers),
    [transfers]
  );

  const latestTransfers = useMemo(
    () => approvedTransfers.slice(0, 6),
    [approvedTransfers]
  );

  const isDelegado = canAccessDelegateTransfers(currentUser);

  return (
    <section
      aria-labelledby="home-transfers-heading"
      className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 border-b border-white/[0.06]"
    >
      <RevealSection>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div className="space-y-2.5">
            <SectionKicker index="04" label="Mercado Oficial" />
            <h2
              id="home-transfers-heading"
              className="text-3xl sm:text-4xl font-medium tracking-[-0.03em] text-white"
            >
              Últimas <span className="font-editorial text-[#c8ceff]">transferencias</span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isDelegado && (
              <button
                type="button"
                onClick={() => onNavigate('transferencias')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.12] text-zinc-200 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#9aa5ff]" />
                <span>Solicitudes</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('transferencias-publicas')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.12] text-zinc-100 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Ver todas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {latestTransfers.length === 0 ? (
          <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-8 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <p className="text-xs text-zinc-500 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-[#9aa5ff]" />
                <span>Temporada {temporada}</span>
              </p>
              <h3 className="text-xl sm:text-2xl font-medium tracking-[-0.02em] text-white">
                Sin transferencias confirmadas
              </h3>
              <p className="text-sm text-zinc-400">
                Los traspasos aprobados por ambos delegados se publicarán automáticamente aquí.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('transferencias-publicas')}
              className="px-5 py-2.5 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium transition-colors whitespace-nowrap self-start md:self-auto cursor-pointer"
            >
              Explorar directorio →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {latestTransfers.map((tr) => {
              const meta = DISCIPLINE_MAP[tr.disciplineId];
              const sportLabel = SPORT_FILTER_LABELS[getSportCategoryForDiscipline(tr.disciplineId)];
              const divisionLabel = getDivisionLabelForDiscipline(tr.disciplineId);

              return (
                <article
                  key={tr.id}
                  className="rounded-2xl bg-[#0c0c10] border border-white/[0.08] hover:border-white/[0.18] p-5 sm:p-6 flex flex-col justify-between gap-4 transition-all duration-200 hover:-translate-y-0.5"
                >
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2.5 py-0.5 rounded-full bg-white/[0.07] text-zinc-200 text-[11px] font-medium shrink-0">
                          {sportLabel}
                        </span>
                        <span className="text-zinc-500 truncate">{divisionLabel}</span>
                      </div>
                      <span className="text-zinc-500 tabular-nums shrink-0">{tr.fecha}</span>
                    </div>

                    <div>
                      <p className="text-[11px] text-zinc-500">{meta?.rama ?? 'UFRO'}</p>
                      <h3 className="text-lg font-medium tracking-[-0.02em] text-white mt-0.5 leading-snug">
                        {tr.playerName}
                      </h3>
                    </div>

                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3 flex items-center justify-between gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => onInspectTeam(tr.fromTeamId)}
                        className="text-left min-w-0 flex-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <span className="block text-[10px] text-zinc-500">Origen</span>
                        <span className="font-medium truncate block">{tr.fromTeamName}</span>
                      </button>

                      <ArrowRight className="w-3.5 h-3.5 text-[#9aa5ff] shrink-0" />

                      <button
                        type="button"
                        onClick={() => onInspectTeam(tr.toTeamId)}
                        className="text-right min-w-0 flex-1 text-white hover:text-[#9aa5ff] transition-colors cursor-pointer"
                      >
                        <span className="block text-[10px] text-zinc-500">Destino</span>
                        <span className="font-medium truncate block">{tr.toTeamName}</span>
                      </button>
                    </div>

                    {tr.motivo && (
                      <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">
                        {tr.motivo}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Confirmada</span>
                    </span>
                    <span className="text-zinc-600 tabular-nums">{tr.id}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </RevealSection>
    </section>
  );
}
