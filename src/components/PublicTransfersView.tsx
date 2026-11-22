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
    <div className="bg-white min-h-[75vh]">
      {/* Dark Editorial Header */}
      <div className="bg-[#0d0d0d] text-white border-b border-white/10">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onNavigate('inicio')}
              className="inline-flex items-center gap-2 text-xs font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver al inicio</span>
            </button>

            {isDelegado && (
              <button
                type="button"
                onClick={() => onNavigate('transferencias')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Gestionar solicitudes (Delegado)</span>
              </button>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
              Boletín Público Oficial · Temporada {state.temporada}
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-tight">
              Transferencias Oficiales Efectuadas
            </h1>
            <p className="text-sm text-neutral-400 max-w-2xl leading-relaxed">
              Registro público de todos los traspasos confirmados por ambos delegados de equipo en
              el Campeonato Intercarreras UFRO. Filtra por deporte, rama o división.
            </p>
          </div>

          {/* Quantitative Breakdown Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/10">
            <div>
              <p className="font-display text-3xl font-bold tabular-nums text-white">
                {countsBySport.ALL}
              </p>
              <p className="text-xs text-neutral-400">Total efectuadas</p>
            </div>
            <div>
              <p className="font-display text-3xl font-bold tabular-nums text-white">
                {countsBySport.futbol7}
              </p>
              <p className="text-xs text-neutral-400">Fútbol 7</p>
            </div>
            <div>
              <p className="font-display text-3xl font-bold tabular-nums text-white">
                {countsBySport.basquetbol}
              </p>
              <p className="text-xs text-neutral-400">Básquetbol</p>
            </div>
            <div>
              <p className="font-display text-3xl font-bold tabular-nums text-white">
                {countsBySport.voleibol}
              </p>
              <p className="text-xs text-neutral-400">Voleibol</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content & Discrimination Controls */}
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Sport Tabs */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-neutral-200 pb-4">
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
                  className={`px-4 py-2.5 text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#0d0d0d] text-white'
                      : 'bg-[#f5f6f8] text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  {SPORT_FILTER_LABELS[tab]} ({countsBySport[tab]})
                </button>
              );
            })}
          </div>

          {/* Division, Rama & Search Filter Bar */}
          <div className="bg-[#f5f6f8] border border-neutral-200 p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
            <div className="lg:col-span-4">
              <label
                htmlFor="pub-tr-division"
                className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 mb-1.5"
              >
                División / Categoría
              </label>
              <select
                id="pub-tr-division"
                value={effectiveDisciplineId}
                onChange={(e) => setDisciplineId(e.target.value as 'ALL' | DisciplineId)}
                className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
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
              <label
                htmlFor="pub-tr-rama"
                className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 mb-1.5"
              >
                Rama
              </label>
              <select
                id="pub-tr-rama"
                value={rama}
                onChange={(e) => {
                  setRama(e.target.value as PublicTransferRamaFilter);
                  setDisciplineId('ALL');
                }}
                className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
              >
                <option value="ALL">Todas las ramas</option>
                <option value="Hombres">Hombres</option>
                <option value="Mujeres">Mujeres</option>
              </select>
            </div>

            <div className="lg:col-span-4">
              <label
                htmlFor="pub-tr-search"
                className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 mb-1.5"
              >
                Buscar jugador o equipo
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="pub-tr-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nombre, equipo origen, destino o motivo..."
                  className="w-full bg-white border border-neutral-300 pl-9 pr-3 py-2.5 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
                />
              </div>
            </div>

            <div className="lg:col-span-1 flex justify-end">
              <button
                type="button"
                onClick={resetFilters}
                disabled={!hasActiveFilters}
                aria-label="Restablecer filtros"
                className="w-full lg:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2.5 border border-neutral-300 bg-white hover:border-[#0d0d0d] text-xs font-medium text-neutral-700 disabled:opacity-40 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="lg:hidden">Limpiar</span>
              </button>
            </div>
          </div>
        </div>

        {/* Results Meta */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3">
          <p className="text-xs font-medium text-neutral-600 flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#707ef9]" />
            <span className="tabular-nums">
              Mostrando <strong className="text-[#0d0d0d]">{filteredTransfers.length}</strong> de{' '}
              <strong className="text-[#0d0d0d]">{allApproved.length}</strong> transferencias
              oficiales efectuadas
            </span>
          </p>
          <span className="text-xs text-neutral-500">
            Solo se publican traspasos confirmados por ambos delegados
          </span>
        </div>

        {/* Transfers List / Empty State */}
        {filteredTransfers.length === 0 ? (
          <div className="border border-neutral-200 bg-[#f5f6f8] p-10 text-center space-y-3">
            <p className="font-display text-2xl font-bold uppercase text-[#0d0d0d]">
              {allApproved.length === 0
                ? `Aún no hay transferencias efectuadas en ${state.temporada}`
                : 'No hay transferencias para los filtros seleccionados'}
            </p>
            <p className="text-sm text-neutral-600 max-w-xl mx-auto">
              {allApproved.length === 0
                ? 'Cuando los delegados de ambos equipos aprueben una solicitud de transferencia, el movimiento aparecerá anunciado oficialmente en este listado.'
                : 'Prueba cambiando el deporte, la división, la rama o limpiando el buscador.'}
            </p>
            {hasActiveFilters && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-5 py-2.5 bg-[#0d0d0d] hover:bg-[#707ef9] text-white font-display font-bold uppercase tracking-widest text-xs cursor-pointer"
                >
                  Restablecer filtros
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="border border-neutral-200 overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#f5f6f8] border-b border-neutral-200 text-xs text-neutral-500 uppercase">
                  <th className="py-3.5 px-4 font-medium">Fecha</th>
                  <th className="py-3.5 px-3 font-medium">Deporte / División</th>
                  <th className="py-3.5 px-3 font-medium">Estudiante</th>
                  <th className="py-3.5 px-3 font-medium">Movimiento</th>
                  <th className="py-3.5 px-3 hidden lg:table-cell font-medium">Motivo</th>
                  <th className="py-3.5 px-4 text-right font-medium">Confirmación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredTransfers.map((tr) => {
                  const meta = DISCIPLINE_MAP[tr.disciplineId];
                  const sportLabel =
                    SPORT_FILTER_LABELS[getSportCategoryForDiscipline(tr.disciplineId)];
                  const divisionLabel = getDivisionLabelForDiscipline(tr.disciplineId);

                  return (
                    <tr key={tr.id} className="hover:bg-[#f9fafb]">
                      <td className="py-4 px-4 tabular-nums text-xs text-neutral-600 whitespace-nowrap">
                        <span className="font-semibold text-[#0d0d0d] block">{tr.fecha}</span>
                        <span className="text-[11px] text-neutral-400">{tr.id}</span>
                      </td>
                      <td className="py-4 px-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold uppercase tracking-wider text-[#0d0d0d]">
                            {sportLabel} · {meta?.rama ?? 'UFRO'}
                          </span>
                          <span className="text-xs text-[#707ef9] font-medium">
                            {divisionLabel}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <p className="font-semibold text-[#0d0d0d]">{tr.playerName}</p>
                        <p className="text-xs text-neutral-500">{meta?.nombreCorto}</p>
                      </td>
                      <td className="py-4 px-3 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => onInspectTeam(tr.fromTeamId)}
                            className="text-neutral-600 hover:text-[#707ef9] font-medium cursor-pointer"
                          >
                            {tr.fromTeamName}
                          </button>
                          <ArrowRight className="w-3.5 h-3.5 text-[#707ef9] shrink-0" />
                          <button
                            type="button"
                            onClick={() => onInspectTeam(tr.toTeamId)}
                            className="text-[#0d0d0d] hover:text-[#707ef9] font-bold cursor-pointer"
                          >
                            {tr.toTeamName}
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-3 hidden lg:table-cell text-xs text-neutral-600 max-w-xs">
                        {tr.motivo}
                      </td>
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Efectuada</span>
                        </span>
                        <span className="block text-[10px] text-neutral-500 mt-0.5">
                          Ambos delegados
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
