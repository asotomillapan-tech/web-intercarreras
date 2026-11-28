import {
  getTrialAcceptanceChance,
  SPORT_CONFIG,
  type LeyendasClub,
  type LeyendasSportKey,
} from '../../domain/leyendasEngine';
import { TeamCrest } from '../TeamCrest';

interface LeyendasTryoutsScreenProps {
  sportKey: LeyendasSportKey;
  selectedCareer: string;
  playerName: string;
  pos: string;
  previewOvr: number;
  careerTryoutClubs: LeyendasClub[];
  otherCampusClubs: LeyendasClub[];
  showOtherCampusTryouts: boolean;
  rejectedClubIds: string[];
  tryoutNotice: string | null;
  onBackToCreate: () => void;
  onToggleOtherCampus: (showOther: boolean) => void;
  onAttemptTryout: (club: LeyendasClub, guaranteedRepesca: boolean) => void;
}

export function LeyendasTryoutsScreen({
  sportKey,
  selectedCareer,
  playerName,
  pos,
  previewOvr,
  careerTryoutClubs,
  otherCampusClubs,
  showOtherCampusTryouts,
  rejectedClubIds,
  tryoutNotice,
  onBackToCreate,
  onToggleOtherCampus,
  onAttemptTryout,
}: LeyendasTryoutsScreenProps) {
  const allCareerRejected =
    careerTryoutClubs.length > 0 &&
    careerTryoutClubs.every((c) => rejectedClubIds.includes(c.id));
  const activeList = showOtherCampusTryouts ? otherCampusClubs : careerTryoutClubs;

  return (
    <div className="rounded-3xl bg-[#0c0c10] border border-white/[0.08] p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="space-y-1">
          <p className="text-xs text-[#a5b0ff]">
            Paso 2 de 2 · Pruebas mechonas {SPORT_CONFIG[sportKey].name}
          </p>
          <h2 className="text-2xl sm:text-3xl font-medium tracking-[-0.03em] text-white">
            Equipos de <span className="font-editorial text-[#c8ceff]">{selectedCareer}</span>
          </h2>
          <p className="text-sm text-white/60">
            Postulas como <strong className="text-white font-medium">{playerName}</strong> ({pos} ·
            OVR inicial {previewOvr}). Se muestran todos los planteles de tu carrera (
            {careerTryoutClubs.length}).
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToCreate}
          className="text-xs text-white/65 hover:text-white transition-colors cursor-pointer self-start sm:self-auto"
        >
          ← Cambiar ficha
        </button>
      </div>

      {/* Career vs Other Campus Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full bg-[#111117] border border-white/[0.08] p-1">
          <button
            type="button"
            onClick={() => onToggleOtherCampus(false)}
            className={`px-4 py-2 rounded-full text-xs font-medium cursor-pointer transition-colors ${
              !showOtherCampusTryouts
                ? 'bg-[#707ef9] text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Tu carrera ({careerTryoutClubs.length})
          </button>
          {otherCampusClubs.length > 0 && (
            <button
              type="button"
              onClick={() => onToggleOtherCampus(true)}
              className={`px-4 py-2 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                showOtherCampusTryouts
                  ? 'bg-[#707ef9] text-white'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Otros clubes del campus ({otherCampusClubs.length})
            </button>
          )}
        </div>

        {allCareerRejected && !showOtherCampusTryouts && (
          <span className="text-xs font-medium text-emerald-300">
            Repesca desbloqueada: 100% de cupo en tu carrera
          </span>
        )}
      </div>

      {tryoutNotice && (
        <div
          role="status"
          className="rounded-2xl bg-amber-500/[0.09] border border-amber-400/35 p-4 text-xs text-amber-200 leading-relaxed"
        >
          {tryoutNotice}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeList.map((club, idx) => {
          const isOwn =
            club.carrera.toLowerCase().trim() === selectedCareer.toLowerCase().trim();
          const wasRejected = rejectedClubIds.includes(club.id);
          const canRepesca = wasRejected && allCareerRejected && !showOtherCampusTryouts;
          const chance = canRepesca
            ? 100
            : getTrialAcceptanceChance(previewOvr, club.ovr, isOwn);

          return (
            <div
              key={club.id}
              style={{ animationDelay: `${Math.min(idx * 45, 360)}ms` }}
              className={`leyendas-card-deal rounded-2xl border p-5 flex flex-col justify-between gap-4 transition-colors ${
                wasRejected && !canRepesca
                  ? 'bg-[#09090d] border-white/[0.05] opacity-60'
                  : 'bg-[#111117] border-white/[0.08] hover:border-[#707ef9]/55'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <TeamCrest
                    escudo={club.escudo}
                    sigla={club.sigla}
                    nombre={club.name}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-white/50 truncate">
                      <span className="text-[#a5b0ff] font-medium">{club.div}</span>
                      {club.isRealTeam && ' · Equipo real UFRO'}
                      {isOwn && ' · Tu carrera'}
                    </p>
                    <h3 className="text-lg font-medium text-white truncate mt-0.5">{club.name}</h3>
                    <p className="text-xs text-white/45 truncate">{club.carrera}</p>
                  </div>
                </div>

                <div className="rounded-xl bg-[#050507] border border-white/[0.08] px-3 py-2 text-center shrink-0">
                  <p className="text-[10px] text-white/45">OVR</p>
                  <p className="text-xl font-semibold text-white tabular-nums leading-tight">
                    {club.ovr}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-3.5 border-t border-white/[0.06]">
                <span className="text-xs text-white/55 tabular-nums">
                  {canRepesca
                    ? 'Repesca mechona garantizada (100%)'
                    : wasRejected
                    ? 'Sin cupo en esta prueba'
                    : `Probabilidad de quedar: ${chance}%`}
                </span>
                <button
                  type="button"
                  disabled={wasRejected && !canRepesca}
                  onClick={() => onAttemptTryout(club, canRepesca)}
                  className={`px-4 py-2 rounded-full text-xs font-medium transition-colors ${
                    wasRejected && !canRepesca
                      ? 'bg-white/[0.06] text-white/35 cursor-not-allowed'
                      : canRepesca
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-[#050507] cursor-pointer'
                      : 'bg-[#707ef9] hover:bg-[#5e6df5] text-white cursor-pointer'
                  }`}
                >
                  {canRepesca
                    ? 'Firmar repesca'
                    : wasRejected
                    ? 'No seleccionado'
                    : 'Probarme'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
