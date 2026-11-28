import {
  ArrowRight,
  Compass,
  Crown,
  Flame,
  RefreshCw,
  Shield,
  Sparkles,
} from 'lucide-react';
import { UFRO_CAREERS } from '../../data/ufroSeed';
import {
  inferCareerYears,
  SPORT_CONFIG,
  type LeyendasBranch,
  type LeyendasSportKey,
} from '../../domain/leyendasEngine';

export interface LocalHofEntry {
  id: string;
  playerName: string;
  career: string;
  sportKey: LeyendasSportKey;
  maxOvr: number;
  score: number;
  titlesCount: number;
  legacyTitle: string;
  finalTeam: string;
  savedAt: string;
}

interface SportPositionOption {
  code: string;
  label: string;
  shortDesc: string;
}

interface LeyendasCreateScreenProps {
  playerName: string;
  sportKey: LeyendasSportKey;
  branch: LeyendasBranch;
  pos: string;
  selectedCareer: string;
  creationError: string | null;
  sportPositions: SportPositionOption[];
  localHof: LocalHofEntry[];
  onPlayerNameChange: (value: string) => void;
  onClearError: () => void;
  onRandomName: () => void;
  onSelectSport: (key: LeyendasSportKey) => void;
  onSelectBranch: (branch: LeyendasBranch) => void;
  onSelectPos: (pos: string) => void;
  onSelectCareer: (career: string) => void;
  onGoToTryouts: () => void;
  onQuickRandomDebut: () => void;
}

export function LeyendasCreateScreen({
  playerName,
  sportKey,
  branch,
  pos,
  selectedCareer,
  creationError,
  sportPositions,
  localHof,
  onPlayerNameChange,
  onClearError,
  onRandomName,
  onSelectSport,
  onSelectBranch,
  onSelectPos,
  onSelectCareer,
  onGoToTryouts,
  onQuickRandomDebut,
}: LeyendasCreateScreenProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className="lg:col-span-7 rounded-3xl bg-[#0c0c10] border border-white/[0.08] p-6 sm:p-8 space-y-6">
        <div className="border-b border-white/[0.08] pb-5 space-y-1.5">
          <p className="text-xs text-[#a5b0ff]">Paso 1 de 2 · Ficha del mechón</p>
          <h2 className="text-2xl sm:text-3xl font-medium tracking-[-0.03em] text-white">
            Crea tu jugador{' '}
            <span className="font-editorial text-[#c8ceff]">universitario</span>
          </h2>
          <p className="text-sm text-white/60 leading-relaxed">
            Elige tu deporte, rama, posición y carrera UFRO. El techo de 99 OVR ahora exige
            constancia real, decisiones difíciles a medio semestre y nervios de acero en playoffs.
          </p>
        </div>

        {creationError && (
          <div
            role="alert"
            className="rounded-2xl bg-rose-500/[0.1] border border-rose-400/35 px-4 py-3 text-xs text-rose-200"
          >
            {creationError}
          </div>
        )}

        {/* Name + Random Button */}
        <div className="space-y-2">
          <label
            htmlFor="leyendas-player-name"
            className="block text-xs font-medium text-white/75"
          >
            Nombre y apellido
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              id="leyendas-player-name"
              type="text"
              maxLength={60}
              value={playerName}
              onChange={(e) => {
                onPlayerNameChange(e.target.value);
                onClearError();
              }}
              placeholder="Ej: Lucas Morales"
              className="flex-1 rounded-xl bg-[#111117] border border-white/[0.1] px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-[#707ef9]"
            />
            <button
              type="button"
              onClick={onRandomName}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-xs font-medium text-white/85 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#a5b0ff]" />
              <span>Aleatorio</span>
            </button>
          </div>
        </div>

        {/* Sport Selector */}
        <div className="space-y-2">
          <span className="block text-xs font-medium text-white/75">Deporte oficial UFRO</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {(['futbol', 'basquet', 'voley'] as LeyendasSportKey[]).map((key) => {
              const active = sportKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelectSport(key)}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    active
                      ? 'bg-[#707ef9]/[0.16] text-white border-[#707ef9]/70'
                      : 'bg-[#111117] text-white/80 border-white/[0.08] hover:border-white/25'
                  }`}
                >
                  <p className="text-base font-medium text-white">{SPORT_CONFIG[key].name}</p>
                  <p className="text-xs text-white/50 mt-0.5">
                    {key === 'futbol'
                      ? '3 Divisiones H · Damas'
                      : key === 'basquet'
                      ? '5x5 H · 3x3 Damas'
                      : 'Varones y Damas'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Branch Selector */}
        <div className="space-y-2">
          <span className="block text-xs font-medium text-white/75">Rama</span>
          <div className="grid grid-cols-2 gap-2.5">
            {(
              [
                { id: 'hombre', label: 'Hombres' },
                { id: 'mujer', label: 'Mujeres' },
              ] as const
            ).map((item) => {
              const active = branch === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelectBranch(item.id)}
                  className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                    active
                      ? 'bg-[#707ef9] text-white border-[#707ef9]'
                      : 'bg-[#111117] text-white/75 border-white/[0.08] hover:border-white/25 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Position Selector */}
        <div className="space-y-2">
          <span className="block text-xs font-medium text-white/75">Posición en cancha</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {sportPositions.map((p) => {
              const active = pos === p.code;
              return (
                <button
                  key={p.code}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelectPos(p.code)}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    active
                      ? 'bg-[#707ef9]/[0.16] text-white border-[#707ef9]/70'
                      : 'bg-[#111117] text-white/80 border-white/[0.08] hover:border-white/25'
                  }`}
                >
                  <p className="text-xs font-semibold text-[#a5b0ff]">{p.code}</p>
                  <p className="text-sm font-medium text-white mt-0.5">{p.label}</p>
                  <p className="text-[11px] text-white/45 mt-1 leading-snug">{p.shortDesc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* UFRO Career Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="leyendas-career" className="text-xs font-medium text-white/75">
              Carrera UFRO
            </label>
            <span className="text-xs text-[#a5b0ff] tabular-nums">
              {inferCareerYears(selectedCareer)} años ({inferCareerYears(selectedCareer) * 2}{' '}
              semestres)
            </span>
          </div>
          <select
            id="leyendas-career"
            value={selectedCareer}
            onChange={(e) => onSelectCareer(e.target.value)}
            className="w-full rounded-xl bg-[#111117] border border-white/[0.1] px-4 py-3 text-sm text-white focus:outline-none focus:border-[#707ef9]"
          >
            {UFRO_CAREERS.map((c) => (
              <option key={c.carrera} value={c.carrera} className="bg-[#0c0c10] text-white">
                {c.carrera} ({inferCareerYears(c.carrera)} años)
              </option>
            ))}
          </select>
        </div>

        {/* Primary CTAs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            id="btn-leyendas-tryouts"
            onClick={onGoToTryouts}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-[#707ef9] hover:bg-[#5e6df5] text-white text-sm font-medium transition-colors cursor-pointer"
          >
            <span>Ir a pruebas mechonas</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            id="btn-leyendas-random-debut"
            onClick={onQuickRandomDebut}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-white text-sm font-medium transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#a5b0ff]" />
            <span>Debut aleatorio</span>
          </button>
        </div>
      </div>

      {/* Right Column: How it works + Local Hall of Fame */}
      <div className="lg:col-span-5 space-y-6">
        <div className="rounded-3xl bg-[#0c0c10] border border-white/[0.08] p-6 sm:p-7 space-y-5">
          <div className="space-y-1">
            <p className="text-xs text-[#a5b0ff]">Novedades de temporada</p>
            <h3 className="text-2xl font-medium tracking-[-0.03em] text-white">
              De mechón a <span className="font-editorial text-[#c8ceff]">leyenda real</span>
            </h3>
          </div>
          <ul className="space-y-4 text-sm text-white/65 leading-relaxed">
            <li className="flex items-start gap-3">
              <Flame className="w-4 h-4 text-[#a5b0ff] shrink-0 mt-1" />
              <span>
                <strong className="text-white font-medium">Progresión OVR exigente:</strong> Cada
                jugada suma XP hacia tu siguiente nivel. Superar los 90 y rozar el 99 OVR ahora es
                una verdadera hazaña universitaria.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Compass className="w-4 h-4 text-[#a5b0ff] shrink-0 mt-1" />
              <span>
                <strong className="text-white font-medium">Cruces de medio semestre:</strong>{' '}
                Decide si te quedas peleando el pase de fase con tu carrera o aceptas la citación de
                la Selección UFRO.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Crown className="w-4 h-4 text-amber-300 shrink-0 mt-1" />
              <span>
                <strong className="text-white font-medium">Rutas épicas de playoffs:</strong> En
                pocas ocasiones especiales jugarás la última pelota consecutiva desde Octavos o
                Cuartos hasta la Gran Final.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Shield className="w-4 h-4 text-[#a5b0ff] shrink-0 mt-1" />
              <span>
                <strong className="text-white font-medium">Clubes reales y postgrado:</strong>{' '}
                Equipos oficiales Intercarreras, Beca Deportiva, Magíster (+2 años) y Doctorado (+3
                años).
              </span>
            </li>
          </ul>
        </div>

        {/* Local Hall of Fame Top 5 */}
        <div className="rounded-3xl bg-[#0c0c10] border border-white/[0.08] p-6 sm:p-7 space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-300" />
              <h3 className="text-lg font-medium text-white">Salón de la Fama local</h3>
            </div>
            <span className="text-xs text-white/45">Top 5</span>
          </div>

          {localHof.length === 0 ? (
            <p className="text-xs text-white/50 leading-relaxed">
              Completa tu primera carrera para guardar tus mejores registros en este dispositivo.
            </p>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {localHof.map((item, idx) => (
                <div
                  key={item.id}
                  className="py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">
                      #{idx + 1} {item.playerName}
                    </p>
                    <p className="text-white/45 truncate mt-0.5">
                      {item.legacyTitle} · {item.finalTeam}
                    </p>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <p className="text-base font-semibold text-[#c8ceff]">
                      {item.score.toLocaleString('es-CL')} pts
                    </p>
                    <p className="text-[11px] text-white/45">
                      {item.maxOvr} OVR · {item.titlesCount} copas
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
