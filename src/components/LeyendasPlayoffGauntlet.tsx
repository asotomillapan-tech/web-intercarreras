import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Crown,
  Flame,
  Shield,
  Sparkles,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import {
  applyTacticToScenario,
  buildGauntletFinalResult,
  type LeyendasGauntletResult,
  type LeyendasGauntletTactic,
  type LeyendasMiniGameOutcome,
  type LeyendasPlayoffGauntlet,
} from '../domain/leyendasEngine';
import { LeyendasMiniGame } from './LeyendasMiniGame';

interface LeyendasPlayoffGauntletProps {
  gauntlet: LeyendasPlayoffGauntlet;
  onComplete: (result: LeyendasGauntletResult) => void;
}

type RoundStatus = 'CLEARED' | 'ACTIVE' | 'UPCOMING' | 'ELIMINATED';

export function LeyendasPlayoffGauntlet({
  gauntlet,
  onComplete,
}: LeyendasPlayoffGauntletProps) {
  const [roundIndex, setRoundIndex] = useState(0);
  const [step, setStep] = useState<'TACTIC' | 'PLAY' | 'SUMMARY'>('TACTIC');
  const [selectedTactic, setSelectedTactic] = useState<LeyendasGauntletTactic | null>(null);
  const [roundsCleared, setRoundsCleared] = useState(0);
  const [perfectRounds, setPerfectRounds] = useState(0);
  const [tacticXpAccumulated, setTacticXpAccumulated] = useState(0);
  const [statBoostAccumulated, setStatBoostAccumulated] = useState(0);
  const [eliminatedAtRoundIndex, setEliminatedAtRoundIndex] = useState<number | null>(null);
  const [finalResult, setFinalResult] = useState<LeyendasGauntletResult | null>(null);

  const currentRound = gauntlet.rounds[roundIndex] ?? gauntlet.rounds[0];

  const activeScenario = useMemo(() => {
    if (!currentRound || !selectedTactic) return currentRound?.scenario;
    return applyTacticToScenario(currentRound.scenario, selectedTactic);
  }, [currentRound, selectedTactic]);

  const handleSelectTactic = (tactic: LeyendasGauntletTactic) => {
    setSelectedTactic(tactic);
    setStep('PLAY');
  };

  const handleRoundMiniGameComplete = (outcome: LeyendasMiniGameOutcome) => {
    const tacticBonus = selectedTactic?.xpBonus ?? 0;

    if (outcome.success) {
      const nextCleared = roundsCleared + 1;
      const nextPerfect = perfectRounds + (outcome.tier === 'PERFECT' ? 1 : 0);
      const nextTacticXp = tacticXpAccumulated + tacticBonus;
      const nextStats = statBoostAccumulated + outcome.statBoost;

      setRoundsCleared(nextCleared);
      setPerfectRounds(nextPerfect);
      setTacticXpAccumulated(nextTacticXp);
      setStatBoostAccumulated(nextStats);

      if (roundIndex + 1 >= gauntlet.rounds.length) {
        const res = buildGauntletFinalResult({
          gauntlet,
          roundsCleared: nextCleared,
          perfectRounds: nextPerfect,
          tacticXpAccumulated: nextTacticXp,
          statBoostAccumulated: nextStats,
          eliminatedAtRoundIndex: null,
        });
        setFinalResult(res);
        setStep('SUMMARY');
      } else {
        setRoundIndex(roundIndex + 1);
        setSelectedTactic(null);
        setStep('TACTIC');
      }
    } else {
      const res = buildGauntletFinalResult({
        gauntlet,
        roundsCleared,
        perfectRounds,
        tacticXpAccumulated,
        statBoostAccumulated,
        eliminatedAtRoundIndex: roundIndex,
      });
      setEliminatedAtRoundIndex(roundIndex);
      setFinalResult(res);
      setStep('SUMMARY');
    }
  };

  const getRoundStatus = (idx: number): RoundStatus => {
    if (eliminatedAtRoundIndex === idx) return 'ELIMINATED';
    if (idx < roundsCleared) return 'CLEARED';
    if (step !== 'SUMMARY' && idx === roundIndex) return 'ACTIVE';
    return 'UPCOMING';
  };

  return (
    <div
      className="rounded-3xl bg-[#0c0c10] border border-white/[0.1] overflow-hidden leyendas-card-deal"
      data-gauntlet-id={gauntlet.id}
    >
      {/* Special Event Header + Live Bracket Progress Strip */}
      <div className="px-5 sm:px-7 py-5 border-b border-white/[0.08] bg-gradient-to-r from-[#707ef9]/[0.14] via-[#0c0c10] to-amber-500/[0.08] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 text-xs text-amber-300">
              <Crown className="w-3.5 h-3.5 shrink-0" />
              <span>
                Actividad especial de playoffs · {gauntlet.rounds.length} llaves consecutivas
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-medium tracking-[-0.03em] text-white leading-tight">
              {gauntlet.title.split('·')[0].trim()}{' '}
              <span className="font-editorial text-[#c8ceff]">
                {gauntlet.startStage === 'OCTAVOS' ? 'desde Octavos' : 'desde Cuartos'}
              </span>
            </h2>
            <p className="text-sm text-white/65 leading-relaxed">{gauntlet.subtitle}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-white/45">Llaves superadas</p>
            <p className="text-2xl font-semibold tabular-nums text-white">
              {roundsCleared}
              <span className="text-white/40 text-base font-normal">
                /{gauntlet.rounds.length}
              </span>
            </p>
          </div>
        </div>

        {/* Bracket Progress Strip */}
        <div
          className={`grid gap-2.5 ${
            gauntlet.rounds.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'
          }`}
        >
          {gauntlet.rounds.map((r, idx) => {
            const status = getRoundStatus(idx);
            const cardTone =
              status === 'CLEARED'
                ? 'bg-emerald-500/[0.08] border-emerald-400/35 text-emerald-200'
                : status === 'ACTIVE'
                ? 'bg-[#707ef9]/[0.16] border-[#707ef9]/60 text-white'
                : status === 'ELIMINATED'
                ? 'bg-rose-500/[0.1] border-rose-400/40 text-rose-200'
                : 'bg-[#09090d] border-white/[0.06] text-white/45';

            return (
              <div
                key={r.stageCode}
                className={`rounded-2xl px-3.5 py-3 border transition-colors ${cardTone}`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-medium truncate">{r.stageLabel}</span>
                  {status === 'CLEARED' && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  {status === 'ACTIVE' && <Flame className="w-3.5 h-3.5 text-[#a5b0ff] shrink-0" />}
                  {status === 'ELIMINATED' && <X className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                </div>
                <p className="text-xs text-white/80 font-medium truncate mt-1">
                  vs. {r.rivalClub.name}
                </p>
                <p className="text-[11px] text-white/45 tabular-nums mt-0.5">
                  Rival {r.rivalClub.ovr} OVR
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Body: TACTIC / PLAY / SUMMARY */}
      <div className="p-5 sm:p-7">
        {step === 'TACTIC' && currentRound && (
          <div className="space-y-6 leyendas-card-deal">
            {/* Match Scoreboard Banner */}
            <div className="rounded-2xl bg-[#09090d] border border-white/[0.08] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs text-[#a5b0ff]">
                  {currentRound.stageLabel} · {currentRound.clockText}
                </p>
                <h3 className="text-xl sm:text-2xl font-medium tracking-[-0.02em] text-white">
                  {currentRound.scoreboardText}
                </h3>
                <p className="text-xs text-white/55">{currentRound.stakesText}</p>
              </div>
              <div className="sm:text-right shrink-0">
                <p className="text-xs text-white/45">Rival de llave</p>
                <p className="text-sm font-medium text-white">{currentRound.rivalClub.name}</p>
                <p className="text-xs text-white/55 tabular-nums">
                  {currentRound.rivalClub.div} · {currentRound.rivalClub.ovr} OVR
                </p>
              </div>
            </div>

            {/* Tactical Approach Selection */}
            <div className="space-y-3">
              <div>
                <h4 className="text-base font-medium text-white">
                  Elige cómo encarar la última jugada de {currentRound.stageLabel}
                </h4>
                <p className="text-xs text-white/55 mt-0.5">
                  Ajusta el equilibrio entre margen de precisión, velocidad del medidor y ganancia de OVR XP.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {currentRound.tactics.map((tactic) => {
                  const Icon =
                    tactic.id === 'TEMPLE'
                      ? Shield
                      : tactic.id === 'EQUILIBRADO'
                      ? Zap
                      : Sparkles;
                  const accent =
                    tactic.id === 'HEROICO'
                      ? 'text-amber-300'
                      : tactic.id === 'EQUILIBRADO'
                      ? 'text-[#a5b0ff]'
                      : 'text-emerald-300';

                  return (
                    <button
                      key={tactic.id}
                      type="button"
                      onClick={() => handleSelectTactic(tactic)}
                      className="text-left rounded-2xl bg-[#111117] hover:bg-[#16161f] border border-white/[0.08] hover:border-[#707ef9]/60 p-4 sm:p-5 transition-all cursor-pointer flex flex-col justify-between gap-4 group"
                    >
                      <div className="space-y-2">
                        <div className={`flex items-center justify-between gap-2 text-xs font-medium ${accent}`}>
                          <span className="inline-flex items-center gap-1.5">
                            <Icon className="w-3.5 h-3.5" />
                            <span>
                              {tactic.id === 'TEMPLE'
                                ? 'Control y temple'
                                : tactic.id === 'EQUILIBRADO'
                                ? 'Jugada preparada'
                                : 'Ejecución heroica'}
                            </span>
                          </span>
                          <span className="tabular-nums">+{tactic.xpBonus} XP</span>
                        </div>
                        <p className="text-base font-medium text-white group-hover:text-[#c8ceff] transition-colors">
                          {tactic.label}
                        </p>
                        <p className="text-xs text-white/60 leading-relaxed">
                          {tactic.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-white/50">
                        <span>
                          {tactic.id === 'TEMPLE'
                            ? 'Zona amplia · Ritmo lento'
                            : tactic.id === 'EQUILIBRADO'
                            ? 'Zona estándar · Ritmo medio'
                            : 'Zona estrecha · Ritmo veloz'}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-white/40 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 'PLAY' && currentRound && activeScenario && (
          <LeyendasMiniGame
            embedded
            scenario={activeScenario}
            kickerOverride={`${currentRound.stageLabel} · ${currentRound.clockText} · Enfoque ${
              selectedTactic?.id === 'TEMPLE'
                ? 'Temple'
                : selectedTactic?.id === 'HEROICO'
                ? 'Heroico'
                : 'Equilibrado'
            }`}
            continueLabelOverride={
              roundIndex + 1 >= gauntlet.rounds.length
                ? 'Ver resultado de la Gran Final'
                : `Avanzar a ${gauntlet.rounds[roundIndex + 1]?.stageLabel ?? 'la siguiente llave'}`
            }
            extraXpBonus={selectedTactic?.xpBonus ?? 0}
            onComplete={handleRoundMiniGameComplete}
          />
        )}

        {step === 'SUMMARY' && finalResult && (
          <div className="space-y-6 leyendas-card-deal">
            <div
              className={`rounded-2xl p-6 sm:p-7 border space-y-4 ${
                finalResult.wonChampionship
                  ? 'bg-gradient-to-br from-amber-500/[0.12] via-[#111117] to-[#707ef9]/[0.12] border-amber-400/40'
                  : 'bg-[#111117] border-white/[0.1]'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 text-xs font-medium text-amber-300">
                    <Trophy className="w-4 h-4" />
                    <span>
                      {finalResult.wonChampionship
                        ? 'Ruta completa de eliminación directa superada'
                        : `Campaña cerrada en ${finalResult.eliminatedAtStage ?? 'Playoffs'}`}
                    </span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-medium tracking-[-0.03em] text-white">
                    {finalResult.headline}
                  </h3>
                  <p className="text-sm text-white/70 leading-relaxed max-w-2xl">
                    {finalResult.narrative}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/[0.08]">
                <div>
                  <p className="text-xs text-white/45">Llaves ganadas</p>
                  <p className="text-xl font-semibold tabular-nums text-white mt-0.5">
                    {finalResult.roundsCleared}/{finalResult.totalRounds}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/45">Jugadas perfectas</p>
                  <p className="text-xl font-semibold tabular-nums text-[#c8ceff] mt-0.5">
                    {finalResult.perfectRounds}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/45">Impulso OVR XP</p>
                  <p
                    className={`text-xl font-semibold tabular-nums mt-0.5 ${
                      finalResult.totalXpEarned >= 0 ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {finalResult.totalXpEarned >= 0
                      ? `+${finalResult.totalXpEarned}`
                      : finalResult.totalXpEarned}{' '}
                    XP
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                id="btn-gauntlet-finish"
                onClick={() => onComplete(finalResult)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#707ef9] hover:bg-[#5e6df5] text-white text-sm font-medium transition-colors cursor-pointer"
              >
                <span>Continuar al balance del semestre</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
