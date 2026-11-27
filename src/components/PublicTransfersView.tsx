import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Filter,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
import { canAccessDelegateTransfers } from '../domain/rbacEngine';
import {
  filterPublicTransfers,
  getDivisionLabelForDiscipline,
  getPublicApprovedTransfers,
  getSportCategoryForDiscipline,
  SPORT_FILTER_LABELS,
  type PublicTransferRamaFilter,
  type PublicTransferSportFilter,
} from '../domain/transfersEngine';
import type {
  AppUserProfile,
  DisciplineId,
  TournamentState,
} from '../types/tournament';
import { RevealSection, SectionKicker } from './MotionPrimitives';
import type { NavSection } from './Navbar';

interface PublicTransfersViewProps {
  state: TournamentState;
  currentUser: AppUserProfile | null;
  onInspectTeam: (teamId: string) => void;
  onNavigate: (section: NavSection) => void;
}

const SPORT_TABS: PublicTransferSportFilter[] = ['ALL', 'futbol7', 'basquetbol', 'voleibol'];

export function PublicTransfersView({
  state,
  currentUser,
  onInspectTeam,
  onNavigate,
}: PublicTransfersViewProps) {
  const [sport, setSport] = useState<PublicTransferSportFilter>('ALL');
  const [rama, setRama] = useState<PublicTransferRamaFilter>('ALL');
  const [disciplineId, setDisciplineId] = useState<'ALL' | DisciplineId>('ALL');
  const [search, setSearch] = useState('');

  const allApproved = useMemo(
    () => getPublicApprovedTransfers(state.transfers),
    [state.transfers]
  );

  const countsBySport = useMemo(() => {
    const counts: Record<PublicTransferSportFilter, number> = {
      ALL: allApproved.length,
      futbol7: 0,
      basquetbol: 0,
      voleibol: 0,
    };
    allApproved.forEach((tr) => {
      counts[getSportCategoryForDiscipline(tr.disciplineId)] += 1;
    });
    return counts;
  }, [allApproved]);

  const availableDisciplines = useMemo(
    () =>
      DISCIPLINES.filter((d) => {
        if (sport !== 'ALL' && getSportCategoryForDiscipline(d.id) !== sport) return false;
        if (rama !== 'ALL' && d.rama !== rama) return false;
        return true;
      }),
    [sport, rama]
  );

  const effectiveDisciplineId: 'ALL' | DisciplineId =
    disciplineId === 'ALL' || availableDisciplines.some((d) => d.id === disciplineId)
      ? disciplineId
      : 'ALL';

  const filteredTransfers = useMemo(
    () =>
      filterPublicTransfers(state.transfers, {
        sport,
        rama,
        disciplineId: effectiveDisciplineId,
        search,
      }),
    [state.transfers, sport, rama, effectiveDisciplineId, search]
  );

  const hasActiveFilters =
    sport !== 'ALL' || rama !== 'ALL' || effectiveDisciplineId !== 'ALL' || search.trim() !== '';

  const resetFilters = () => {
    setSport('ALL');
    setRama('ALL');
    setDisciplineId('ALL');
    setSearch('');
  };

  const isDelegado = canAccessDelegateTransfers(currentUser);

  return (
    <div className="bg-[#050507] text-zinc-100 min-h-[80vh]">
      {/* Obsidian Header */}
      <div className="border-b border-white/[0.08]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onNavigate('inicio')}
              className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver al inicio</span>
            </button>

            {isDelegado && (
              <button
                type="button"
                onClick={() => onNavigate('transferencias')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Gestionar solicitudes</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            <SectionKicker index="01" label={`Boletín Oficial · ${state.temporada}`} />
            <h1 className="text-4xl sm:text-5xl font-medium tracking-[-0.035em] text-white">
              Transferencias <span className="font-editorial text-[#c8ceff]">oficiales</span>
            </h1>
            <p className="text-sm text-zinc-400 max-w-xl">
              Traspasos confirmados por ambos delegados en todas las disciplinas del campeonato.
            </p>
          </div>

          {/* Quantitative Breakdown Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 border-t border-white/[0.08]">
            {[
              { label: 'Total efectuadas', value: countsBySport.ALL },
              { label: 'Fútbol 7', value: countsBySport.futbol7 },
              { label: 'Básquetbol', value: countsBySport.basquetbol },
              { label: 'Voleibol', value: countsBySport.voleibol },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-light tracking-[-0.03em] tabular-nums text-white">
                  {stat.value}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <RevealSection className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        {/* Sport Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {SPORT_TABS.map((tab) => {
            const active = sport === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setSport(tab);
                  setDisciplineId('ALL');
                }}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap border ${
                  active
                    ? 'bg-white text-[#050507] border-white'
                    : 'bg-white/[0.03] text-zinc-400 border-white/[0.08] hover:text-white hover:bg-white/[0.07]'
                }`}
              >
                {SPORT_FILTER_LABELS[tab]} ({countsBySport[tab]})
              </button>
            );
          })}
        </div>

        {/* Division, Rama & Search Filter Bar */}
        <div className="rounded-2xl bg-[#0c0c10] border border-white/[0.08] p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-4">
            <label htmlFor="pub-tr-division" className="block text-xs text-zinc-400 mb-1.5">
              División
            </label>
            <select
              id="pub-tr-division"
              value={effectiveDisciplineId}
              onChange={(e) => setDisciplineId(e.target.value as 'ALL' | DisciplineId)}
              className="w-full rounded-xl bg-[#111117] border border-white/[0.1] px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[#707ef9]"
            >
              <option value="ALL">Todas las divisiones ({availableDisciplines.length})</option>
              {availableDisciplines.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <label htmlFor="pub-tr-rama" className="block text-xs text-zinc-400 mb-1.5">
              Rama
            </label>
            <select
              id="pub-tr-rama"
              value={rama}
              onChange={(e) => {
                setRama(e.target.value as PublicTransferRamaFilter);
                setDisciplineId('ALL');
              }}
              className="w-full rounded-xl bg-[#111117] border border-white/[0.1] px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[#707ef9]"
            >
              <option value="ALL">Todas las ramas</option>
              <option value="Hombres">Hombres</option>
              <option value="Mujeres">Mujeres</option>
            </select>
          </div>

          <div className="lg:col-span-4">
            <label htmlFor="pub-tr-search" className="block text-xs text-zinc-400 mb-1.5">
              Buscar
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="pub-tr-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Jugador, equipo o motivo..."
                className="w-full rounded-xl bg-[#111117] border border-white/[0.1] pl-10 pr-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
              />
            </div>
          </div>

          <div className="lg:col-span-1 flex justify-end">
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              aria-label="Restablecer filtros"
              className="w-full lg:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] text-xs text-zinc-300 disabled:opacity-35 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="lg:hidden">Limpiar</span>
            </button>
          </div>
        </div>

        {/* Results Meta */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
          <p className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#9aa5ff]" />
            <span className="tabular-nums">
              <strong className="text-zinc-200 font-medium">{filteredTransfers.length}</strong> de{' '}
              <strong className="text-zinc-200 font-medium">{allApproved.length}</strong> transferencias
            </span>
          </p>
        </div>

        {/* Transfers List / Empty State */}
        {filteredTransfers.length === 0 ? (
          <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-12 text-center space-y-3">
            <p className="text-xl font-medium text-white">
              {allApproved.length === 0
                ? `Sin transferencias en ${state.temporada}`
                : 'Sin coincidencias para estos filtros'}
            </p>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              {allApproved.length === 0
                ? 'Los traspasos confirmados por ambos delegados se publican automáticamente aquí.'
                : 'Prueba cambiando el deporte, la división o limpiando el buscador.'}
            </p>
            {hasActiveFilters && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-5 py-2.5 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium cursor-pointer transition-colors"
                >
                  Restablecer filtros
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/[0.08] text-xs text-zinc-500">
                  <th className="py-3.5 px-4 font-medium">Fecha</th>
                  <th className="py-3.5 px-3 font-medium">Disciplina</th>
                  <th className="py-3.5 px-3 font-medium">Jugador</th>
                  <th className="py-3.5 px-3 font-medium">Movimiento</th>
                  <th className="py-3.5 px-3 hidden lg:table-cell font-medium">Motivo</th>
                  <th className="py-3.5 px-4 text-right font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredTransfers.map((tr) => {
                  const meta = DISCIPLINE_MAP[tr.disciplineId];
                  const sportLabel =
                    SPORT_FILTER_LABELS[getSportCategoryForDiscipline(tr.disciplineId)];
                  const divisionLabel = getDivisionLabelForDiscipline(tr.disciplineId);

                  return (
                    <tr key={tr.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-4 tabular-nums text-xs text-zinc-400 whitespace-nowrap">
                        <span className="font-medium text-zinc-200 block">{tr.fecha}</span>
                        <span className="text-[11px] text-zinc-600">{tr.id}</span>
                      </td>
                      <td className="py-4 px-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-medium text-zinc-200">
                            {sportLabel} · {meta?.rama ?? 'UFRO'}
                          </span>
                          <span className="text-xs text-[#9aa5ff]">{divisionLabel}</span>
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <p className="font-medium text-white">{tr.playerName}</p>
                        <p className="text-xs text-zinc-500">{meta?.nombreCorto}</p>
                      </td>
                      <td className="py-4 px-3 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => onInspectTeam(tr.fromTeamId)}
                            className="text-zinc-400 hover:text-[#a5b0ff] transition-colors cursor-pointer"
                          >
                            {tr.fromTeamName}
                          </button>
                          <ArrowRight className="w-3.5 h-3.5 text-[#9aa5ff] shrink-0" />
                          <button
                            type="button"
                            onClick={() => onInspectTeam(tr.toTeamId)}
                            className="text-white hover:text-[#a5b0ff] font-medium transition-colors cursor-pointer"
                          >
                            {tr.toTeamName}
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-3 hidden lg:table-cell text-xs text-zinc-400 max-w-xs">
                        {tr.motivo}
                      </td>
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Efectuada</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </RevealSection>
    </div>
  );
}
