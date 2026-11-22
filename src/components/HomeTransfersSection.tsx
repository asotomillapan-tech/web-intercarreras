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
      className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-14 border-b border-neutral-200"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-medium text-[#707ef9] uppercase tracking-widest">
            Mercado Oficial UFRO · Doble Aprobación de Delegados
          </p>
          <h2
            id="home-transfers-heading"
            className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#0d0d0d] mt-1"
          >
            Últimas Transferencias
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {approvedTransfers.length > 0 && (
            <span className="text-xs text-neutral-500 tabular-nums">
              {approvedTransfers.length}{' '}
              {approvedTransfers.length === 1
                ? 'transferencia efectuada'
                : 'transferencias efectuadas'}
            </span>
          )}
          {isDelegado && (
            <button
              type="button"
              onClick={() => onNavigate('transferencias')}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#0d0d0d] text-[#0d0d0d] hover:bg-[#0d0d0d] hover:text-white font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Solicitudes de delegado</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('transferencias-publicas')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0d0d0d] hover:bg-[#707ef9] text-white font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>Ver todas las transferencias</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {latestTransfers.length === 0 ? (
        <div className="border border-neutral-200 bg-[#f5f6f8] p-8 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-[#707ef9]" />
              <span>Anuncios Públicos de Traspasos · Temporada {temporada}</span>
            </p>
            <h3 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
              Sin transferencias confirmadas todavía
            </h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Cada transferencia solicitada y aceptada por los delegados de ambos equipos se
              anunciará automáticamente aquí y quedará archivada en el directorio público por
              deporte, rama y división.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('transferencias-publicas')}
            className="px-5 py-3 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-xs transition-colors whitespace-nowrap self-start md:self-auto cursor-pointer"
          >
            Explorar directorio oficial →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-neutral-200 border border-neutral-200">
          {latestTransfers.map((tr) => {
            const meta = DISCIPLINE_MAP[tr.disciplineId];
            const sportLabel = SPORT_FILTER_LABELS[getSportCategoryForDiscipline(tr.disciplineId)];
            const divisionLabel = getDivisionLabelForDiscipline(tr.disciplineId);

            return (
              <article
                key={tr.id}
                className="bg-white p-5 sm:p-6 flex flex-col justify-between gap-4 hover:bg-[#f9fafb] transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="px-2 py-0.5 bg-[#0d0d0d] text-white font-display font-bold uppercase tracking-wider shrink-0">
                        {sportLabel}
                      </span>
                      <span className="text-neutral-600 font-medium truncate">
                        {divisionLabel}
                      </span>
                    </div>
                    <span className="text-neutral-400 tabular-nums shrink-0">{tr.fecha}</span>
                  </div>

                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-neutral-500">
                      {meta?.rama ?? 'UFRO'} · Traspaso Oficial
                    </p>
                    <h3 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d] mt-0.5 leading-tight">
                      {tr.playerName}
                    </h3>
                  </div>

                  <div className="bg-[#f5f6f8] border border-neutral-200 p-3 flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => onInspectTeam(tr.fromTeamId)}
                      className="text-left min-w-0 flex-1 text-neutral-600 hover:text-[#707ef9] transition-colors cursor-pointer"
                    >
                      <span className="block text-[10px] uppercase tracking-wider text-neutral-400">
                        Origen
                      </span>
                      <span className="font-semibold truncate block">{tr.fromTeamName}</span>
                    </button>

                    <ArrowRight className="w-4 h-4 text-[#707ef9] shrink-0" />

                    <button
                      type="button"
                      onClick={() => onInspectTeam(tr.toTeamId)}
                      className="text-right min-w-0 flex-1 text-[#0d0d0d] hover:text-[#707ef9] transition-colors cursor-pointer"
                    >
                      <span className="block text-[10px] uppercase tracking-wider text-neutral-400">
                        Destino
                      </span>
                      <span className="font-bold truncate block">{tr.toTeamName}</span>
                    </button>
                  </div>

                  <p className="text-xs text-neutral-600 leading-relaxed line-clamp-2">
                    {tr.motivo}
                  </p>
                </div>

                <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Confirmada por ambos delegados</span>
                  </span>
                  <span className="text-neutral-400 tabular-nums">{tr.id}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
