import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Crown,
  Flame,
  GraduationCap,
  Image as ImageIcon,
  Medal,
  RefreshCw,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { UFRO_CAREERS } from '../data/ufroSeed';
import {
  buildLeaderboardEntryFromCareer,
  buildLeyendasTeamsFromTournament,
  buildFallbackTryoutTeams,
  buildTryoutPool,
  buildWeeklyLeaderboardViews,
  calculateCareerLeaderboardScore,
  computeCreativeLegacyBanner,
  createInitialCareerState,
  drawSemesterFocusCards,
  formatWeeklyCountdown,
  getAcademicNarrativeHint,
  getChileWeekInfo,
  getPlayerAge,
  getSportPositions,
  getTrialAcceptanceChance,
  inferCareerYears,
  pickContextualKeyMoment,
  pickSemesterEvent,
  RANDOM_NAMES_FEMALE,
  RANDOM_NAMES_MALE,
  resolveKeyMomentChoice,
  simulateSemesterFull,
  SPORT_CONFIG,
  type LeyendasBranch,
  type LeyendasCareerState,
  type LeyendasClub,
  type LeyendasEventOption,
  type LeyendasFocusCard,
  type LeyendasGameEvent,
  type LeyendasKeyMoment,
  type LeyendasKeyMomentChoice,
  type LeyendasRankingCategory,
  type LeyendasSportKey,
} from '../domain/leyendasEngine';
import type {
  AppUserProfile,
  LeyendasLeaderboardEntry,
  TournamentState,
} from '../types/tournament';
import { LeyendasPosterModal } from './LeyendasPosterModal';
import { LeyendasTrophyIcon } from './LeyendasTrophyIcon';
import { TeamCrest } from './TeamCrest';

const LOCAL_HOF_KEY = 'ufro_leyendas_hof_v1';

interface LeyendasGameProps {
  state: TournamentState;
  currentUser: AppUserProfile | null;
  onOpenAuth: () => void;
  onSaveLeyendasEntry: (entry: LeyendasLeaderboardEntry) => Promise<void>;
  onBackToHub: () => void;
}

type GameScreen = 'create' | 'tryouts' | 'career';
type SemesterPhase =
  | 'FOCUS'
  | 'EVENT'
  | 'MOMENT'
  | 'CELEBRATION'
  | 'LOAN'
  | 'TRANSFER'
  | 'POSTGRAD';

interface LocalHofEntry {
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

function loadLocalHof(): LocalHofEntry[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_HOF_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function saveLocalHof(entry: LocalHofEntry): LocalHofEntry[] {
  const prev = loadLocalHof().filter((item) => item.id !== entry.id);
  const next = [entry, ...prev].sort((a, b) => b.score - a.score).slice(0, 5);
  try {
    window.localStorage.setItem(LOCAL_HOF_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export function LeyendasGame({
  state,
  currentUser,
  onOpenAuth,
  onSaveLeyendasEntry,
  onBackToHub,
}: LeyendasGameProps) {
  const allClubs = useMemo(
    () => buildLeyendasTeamsFromTournament(state.teams, state.matches),
    [state.teams, state.matches]
  );

  const realClubCount = useMemo(
    () => allClubs.filter((c) => c.isRealTeam).length,
    [allClubs]
  );

  // Screen & Creation State
  const [screen, setScreen] = useState<GameScreen>('create');
  const [playerName, setPlayerName] = useState<string>(
    currentUser?.displayName?.split(' ').slice(0, 2).join(' ') || ''
  );
  const [sportKey, setSportKey] = useState<LeyendasSportKey>('futbol');
  const [branch, setBranch] = useState<LeyendasBranch>('hombre');
  const [pos, setPos] = useState<string>('DEL');
  const [selectedCareer, setSelectedCareer] = useState<string>(
    currentUser?.carrera && UFRO_CAREERS.some((c) => c.carrera === currentUser.carrera)
      ? currentUser.carrera
      : 'Ingeniería Civil Industrial'
  );
  const [creationError, setCreationError] = useState<string | null>(null);

  // Tryouts State
  const [tryoutClubs, setTryoutClubs] = useState<LeyendasClub[]>([]);
  const [fallbackClubs, setFallbackClubs] = useState<LeyendasClub[]>([]);
  const [tryoutNotice, setTryoutNotice] = useState<string | null>(null);
  const [previewOvr, setPreviewOvr] = useState<number>(66);

  // Active Career Loop State
  const [career, setCareer] = useState<LeyendasCareerState | null>(null);
  const [semPhase, setSemPhase] = useState<SemesterPhase>('FOCUS');
  const [focusCards, setFocusCards] = useState<LeyendasFocusCard[]>([]);
  const [chosenFocus, setChosenFocus] = useState<LeyendasFocusCard | null>(null);
  const [activeEvent, setActiveEvent] = useState<LeyendasGameEvent | null>(null);
  const [eventResult, setEventResult] = useState<{
    ovrDelta: number;
    gpaDelta: number;
    statBonus: number;
    teamOvrBoost?: number;
    extraSemester?: boolean;
    injuryTriggered?: boolean;
    narrative: string;
  } | null>(null);
  const [activeMoment, setActiveMoment] = useState<LeyendasKeyMoment | null>(null);
  const [momentNarrative, setMomentNarrative] = useState<string | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);

  // Poster, Ranking & Detail Modal State
  const [showPoster, setShowPoster] = useState(false);
  const [submittingGlobal, setSubmittingGlobal] = useState(false);
  const [submittedGlobal, setSubmittedGlobal] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rankingTab, setRankingTab] = useState<LeyendasRankingCategory>('general');
  const [inspectedEntry, setInspectedEntry] = useState<LeyendasLeaderboardEntry | null>(null);
  const [localHof, setLocalHof] = useState<LocalHofEntry[]>(() => loadLocalHof());
  const [weekInfo, setWeekInfo] = useState(() => getChileWeekInfo(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setWeekInfo(getChileWeekInfo(new Date()));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Keep position valid when sport changes
  const sportPositions = useMemo(() => getSportPositions(sportKey), [sportKey]);
  useEffect(() => {
    if (!sportPositions.some((p) => p.code === pos)) {
      setPos(sportPositions[0]?.code ?? 'DEL');
    }
  }, [sportPositions, pos]);

  const weeklyRanking = useMemo(
    () => buildWeeklyLeaderboardViews(state.leyendasLeaderboard, weekInfo.weekKey, rankingTab),
    [state.leyendasLeaderboard, weekInfo.weekKey, rankingTab]
  );

  // Auto-save finished career to local Hall of Fame once
  useEffect(() => {
    if (!career || !career.finished) return;
    const legacy = computeCreativeLegacyBanner(career);
    const score = calculateCareerLeaderboardScore(career);
    const entry: LocalHofEntry = {
      id: `${career.playerName}-${career.startYear}-${career.semestersPlayed}-${score}`,
      playerName: career.playerName,
      career: career.career,
      sportKey: career.sportKey,
      maxOvr: career.maxOvr,
      score,
      titlesCount: career.trophies.length,
      legacyTitle: legacy.title,
      finalTeam: career.team.name,
      savedAt: new Date().toISOString(),
    };
    setLocalHof(saveLocalHof(entry));
  }, [career]);

  const handleRandomName = () => {
    const pool = branch === 'mujer' ? RANDOM_NAMES_FEMALE : RANDOM_NAMES_MALE;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    setPlayerName(picked);
    setCreationError(null);
  };

  const launchCareerWithClub = (club: LeyendasClub) => {
    const nextCareer = createInitialCareerState({
      playerName: playerName.trim() || 'Leyenda UFRO',
      careerName: selectedCareer,
      sportKey,
      branch,
      pos,
      team: club,
      allClubs,
    });
    setCareer(nextCareer);
    setFocusCards(drawSemesterFocusCards());
    setChosenFocus(null);
    setActiveEvent(null);
    setEventResult(null);
    setActiveMoment(null);
    setMomentNarrative(null);
    setSemPhase('FOCUS');
    setSubmittedGlobal(false);
    setSubmitError(null);
    setConfirmRestart(false);
    setScreen('career');
  };

  const handleGoToTryouts = () => {
    const trimmed = playerName.trim();
    if (trimmed.length < 2) {
      setCreationError('Ingresa tu nombre deportivo o usa el botón de Nombre Aleatorio.');
      return;
    }
    setCreationError(null);
    const isEgg = trimmed.toLowerCase() === 'mathias bello';
    setPreviewOvr(isEgg ? 90 : 66);
    const pool = buildTryoutPool(allClubs, sportKey, branch, selectedCareer);
    setTryoutClubs(pool);
    setFallbackClubs([]);
    setTryoutNotice(null);
    setScreen('tryouts');
  };

  const handleQuickRandomDebut = () => {
    const trimmed = playerName.trim() || (branch === 'mujer' ? RANDOM_NAMES_FEMALE[0] : RANDOM_NAMES_MALE[0]);
    if (!playerName.trim()) setPlayerName(trimmed);
    setCreationError(null);
    const scoped = allClubs.filter((c) => c.sportKey === sportKey && c.branch === branch);
    const lowerOrMid = scoped.filter((c) => c.ovr <= 80);
    const pool = lowerOrMid.length > 0 ? lowerOrMid : scoped;
    const chosen = pool[Math.floor(Math.random() * pool.length)] ?? allClubs[0];
    if (chosen) {
      launchCareerWithClub(chosen);
    }
  };

  const handleAttemptTryout = (club: LeyendasClub, guaranteed = false) => {
    const isOwnCareer = club.carrera.toLowerCase() === selectedCareer.toLowerCase();
    const chance = guaranteed ? 100 : getTrialAcceptanceChance(previewOvr, club.ovr, isOwnCareer);
    if (Math.random() * 100 <= chance) {
      launchCareerWithClub(club);
    } else {
      setTryoutNotice(
        `${club.name} (${club.ovr} OVR) agradeció tu participación en pruebas mechonas, pero por ahora el plantel está completo. Elige un club de Plan B para debutar este semestre.`
      );
      setFallbackClubs(buildFallbackTryoutTeams(allClubs, sportKey, branch, club.id));
    }
  };

  // --- Gameplay Step Handlers ---

  const handleChooseFocus = (card: LeyendasFocusCard) => {
    if (!career) return;
    setChosenFocus(card);
    setActiveEvent(pickSemesterEvent(career));
    setEventResult(null);
    setSemPhase('EVENT');
  };

  const handleChooseEventOption = (opt: LeyendasEventOption) => {
    if (!career || !chosenFocus) return;
    const roll = Math.random();
    const succeeded = opt.successChance === undefined ? true : roll <= opt.successChance;
    const ovrDelta = succeeded ? opt.ovrDelta : opt.altOvrDelta ?? 0;
    const gpaDelta = succeeded ? opt.gpaDelta : opt.altGpaDelta ?? 0;
    const extraSemester = !succeeded && Boolean(opt.extraSemester);
    const injuryProb = Math.max(0, (opt.injuryChance ?? 0) + chosenFocus.injuryRiskDelta);
    const injuryTriggered = injuryProb > 0 && Math.random() < injuryProb;
    const narrative =
      (succeeded ? opt.outcomeSuccess : opt.outcomeFail || opt.outcomeSuccess) +
      (injuryTriggered ? ' Además sufriste una molestia física que limitó tus minutos.' : '');

    setEventResult({
      ovrDelta,
      gpaDelta,
      statBonus: succeeded ? opt.statBonus : 0,
      teamOvrBoost: succeeded ? opt.teamOvrBoost : 0,
      extraSemester,
      injuryTriggered,
      narrative,
    });
    setActiveMoment(pickContextualKeyMoment(career));
    setMomentNarrative(null);
    setSemPhase('MOMENT');
  };

  const handleChooseKeyMoment = (choice: LeyendasKeyMomentChoice) => {
    if (!career || !chosenFocus || !eventResult) return;
    const resolved = resolveKeyMomentChoice(career.ovr, choice);
    setMomentNarrative(resolved.narrative);

    const nextCareer = simulateSemesterFull({
      career,
      allClubs,
      focusCard: chosenFocus,
      eventDelta: eventResult,
      momentDelta: { ovrDelta: resolved.ovrDelta, statBoost: resolved.statBoost },
    });
    setCareer(nextCareer);
    setSemPhase('CELEBRATION');
  };

  const handleContinueAfterCelebration = () => {
    if (!career) return;
    if (career.finished) return;
    if (career.pendingPostgradOption) {
      setSemPhase('POSTGRAD');
      return;
    }
    if (career.pendingLoanOffers.length > 0) {
      setSemPhase('LOAN');
      return;
    }
    if (career.pendingTransferOffers.length > 0) {
      setSemPhase('TRANSFER');
      return;
    }
    startNextSemesterCycle();
  };

  const startNextSemesterCycle = () => {
    setFocusCards(drawSemesterFocusCards());
    setChosenFocus(null);
    setActiveEvent(null);
    setEventResult(null);
    setActiveMoment(null);
    setMomentNarrative(null);
    setSemPhase('FOCUS');
  };

  const handleLoanDecision = (loanClub: LeyendasClub | null) => {
    if (!career) return;
    if (loanClub) {
      setCareer({
        ...career,
        homeClub: career.team,
        team: loanClub,
        onLoan: true,
        pendingLoanOffers: [],
        timeline: [
          {
            id: `tl-loan-${career.year}`,
            year: career.year,
            semester: 2,
            badge: 'PRÉSTAMO',
            title: `Préstamo a ${loanClub.name} para Playoffs`,
            detail: `Te sumas como refuerzo temporal en ${loanClub.div} buscando el título.`,
            tone: 'accent',
          },
          ...career.timeline,
        ],
      });
    } else {
      setCareer({ ...career, pendingLoanOffers: [] });
    }
    startNextSemesterCycle();
  };

  const handleTransferDecision = (newClub: LeyendasClub | null) => {
    if (!career) return;
    if (newClub) {
      const nextStints = [
        ...career.stints,
        {
          team: newClub.name,
          teamId: newClub.realTeamId,
          sigla: newClub.sigla,
          escudo: newClub.escudo,
          div: newClub.div,
          years: String(career.year),
        },
      ];
      setCareer({
        ...career,
        team: newClub,
        stints: nextStints,
        pendingTransferOffers: [],
        timeline: [
          {
            id: `tl-tr-${career.year}`,
            year: career.year,
            semester: 1,
            badge: 'FICHAJE',
            title: `Nuevo refuerzo de ${newClub.name} (${newClub.div})`,
            detail: `Cambiaste de camiseta para el nuevo año universitario.`,
            tone: 'accent',
          },
          ...career.timeline,
        ],
      });
    } else {
      setCareer({ ...career, pendingTransferOffers: [] });
    }
    startNextSemesterCycle();
  };

  const handlePostgradDecision = (accept: boolean) => {
    if (!career || !career.pendingPostgradOption) return;
    if (!accept) {
      setCareer({
        ...career,
        pendingPostgradOption: null,
        finished: true,
      });
      return;
    }
    const nextStage = career.pendingPostgradOption;
    const extraSemesters = nextStage === 'MAGISTER' ? 4 : 6;
    setCareer({
      ...career,
      postgradStage: nextStage,
      totalSemesters: career.totalSemesters + extraSemesters,
      year: career.year + 1,
      semester: 1,
      pendingPostgradOption: null,
      timeline: [
        {
          id: `tl-pg-${nextStage}-${career.year}`,
          year: career.year + 1,
          semester: 1,
          badge: nextStage,
          title:
            nextStage === 'MAGISTER'
              ? '¡Aceptado en Magíster UFRO! (+2 años)'
              : '¡Aceptado en Doctorado UFRO! (+3 años)',
          detail: 'Extiendes tu elegibilidad universitaria para seguir agrandando tu legado.',
          tone: 'gold',
        },
        ...career.timeline,
      ],
    });
    startNextSemesterCycle();
  };

  const handleSubmitToGlobalRanking = async () => {
    if (!career || !currentUser || submittingGlobal || submittedGlobal) return;
    setSubmittingGlobal(true);
    setSubmitError(null);
    try {
      const entry = buildLeaderboardEntryFromCareer(career, currentUser.uid, new Date());
      await onSaveLeyendasEntry(entry);
      setSubmittedGlobal(true);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : 'No se pudo guardar en el Top Global Semanal.'
      );
    } finally {
      setSubmittingGlobal(false);
    }
  };

  const handleResetToCreation = () => {
    setCareer(null);
    setScreen('create');
    setConfirmRestart(false);
    setSubmittedGlobal(false);
    setSubmitError(null);
  };

  const academicHint = career ? getAcademicNarrativeHint(career.gpa, career.hasScholarship) : null;
  const legacyBanner = career && career.finished ? computeCreativeLegacyBanner(career) : null;
  const finalScore = career && career.finished ? calculateCareerLeaderboardScore(career) : 0;

  return (
    <div className="min-h-screen bg-[#f5f6f8] pb-20">
      {/* Top Carbon Editorial Bar */}
      <section className="bg-[#0d0d0d] text-white border-b border-white/10">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBackToHub}
              className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-300 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-[#707ef9]" />
              <span>Volver a Minijuegos</span>
            </button>

            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-300">
              <span className="font-mono text-[11px] text-[#707ef9] uppercase tracking-wider">
                {realClubCount > 0
                  ? `${realClubCount} equipos reales UFRO integrados`
                  : 'Clubes oficiales de carreras UFRO activos'}
              </span>
              {career && (
                confirmRestart ? (
                  <span className="inline-flex items-center gap-2 bg-white/10 px-3 py-1">
                    <span>¿Reiniciar carrera?</span>
                    <button
                      type="button"
                      onClick={handleResetToCreation}
                      className="text-red-300 hover:text-white font-bold uppercase cursor-pointer"
                    >
                      Sí, reiniciar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRestart(false)}
                      className="text-neutral-300 hover:text-white cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmRestart(true)}
                    className="inline-flex items-center gap-1.5 text-neutral-300 hover:text-white cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Nueva Carrera</span>
                  </button>
                )
              )}
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-[#707ef9]">
                Simulador de Carrera Universitaria · Intercarreras UFRO
              </p>
              <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-tight mt-1">
                LEYENDAS
              </h1>
            </div>

            <div className="bg-white/5 border border-white/10 px-4 py-2.5 flex items-center gap-3 self-start lg:self-auto">
              <Clock className="w-4 h-4 text-[#707ef9] shrink-0" />
              <div className="text-xs">
                <p className="text-neutral-400 uppercase tracking-wider text-[10px]">
                  Top Global · {weekInfo.label}
                </p>
                <p className="font-mono font-bold text-white tabular-nums">
                  Cierre semanal: {formatWeeklyCountdown(weekInfo.msRemaining)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-10">
        {/* ==================== STEP 1A: CHARACTER CREATION ==================== */}
        {screen === 'create' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 bg-white border border-neutral-200 p-6 sm:p-8 space-y-6">
              <div className="border-b border-neutral-200 pb-4">
                <p className="text-xs font-mono uppercase tracking-widest text-[#707ef9]">
                  Paso 1 de 2 · Ficha del Mechón
                </p>
                <h2 className="font-display text-3xl font-bold uppercase tracking-wide text-[#0d0d0d] mt-1">
                  Crea tu Jugador Universitario
                </h2>
                <p className="text-xs text-neutral-600 mt-1">
                  Elige tu deporte, rama, posición y carrera UFRO. Competirás contra los equipos
                  reales inscritos en el campeonato y podrás subir tu legado al Top Global Semanal.
                </p>
              </div>

              {creationError && (
                <div role="alert" className="bg-red-50 border border-red-300 px-4 py-3 text-xs text-red-900">
                  {creationError}
                </div>
              )}

              {/* Name + Random Button */}
              <div className="space-y-2">
                <label htmlFor="leyendas-player-name" className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Nombre y Apellido
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="leyendas-player-name"
                    type="text"
                    maxLength={60}
                    value={playerName}
                    onChange={(e) => {
                      setPlayerName(e.target.value);
                      setCreationError(null);
                    }}
                    placeholder="Ej: Lucas Morales"
                    className="flex-1 bg-white border border-neutral-300 px-3.5 py-2.5 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
                  />
                  <button
                    type="button"
                    onClick={handleRandomName}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#f5f6f8] border border-neutral-300 hover:border-[#0d0d0d] text-xs font-bold uppercase tracking-wider text-[#0d0d0d] cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#707ef9]" />
                    <span>Aleatorio</span>
                  </button>
                </div>
              </div>

              {/* Sport Selector */}
              <div className="space-y-2">
                <span className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Deporte Oficial UFRO
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(['futbol', 'basquet', 'voley'] as LeyendasSportKey[]).map((key) => {
                    const active = sportKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSportKey(key)}
                        className={`p-3 border text-left transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#0d0d0d] text-white border-[#0d0d0d]'
                            : 'bg-white text-[#0d0d0d] border-neutral-300 hover:border-[#707ef9]'
                        }`}
                      >
                        <p className="font-display text-xl font-bold uppercase">
                          {SPORT_CONFIG[key].name}
                        </p>
                        <p className={`text-[11px] mt-0.5 ${active ? 'text-neutral-300' : 'text-neutral-500'}`}>
                          {key === 'futbol'
                            ? '3 Divisiones H / Damas'
                            : key === 'basquet'
                            ? '5x5 H / 3x3 Damas'
                            : 'Varones y Damas'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Branch Selector */}
              <div className="space-y-2">
                <span className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Rama
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: 'hombre', label: 'Hombres' },
                    { id: 'mujer', label: 'Mujeres' },
                  ] as const).map((item) => {
                    const active = branch === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setBranch(item.id)}
                        className={`px-4 py-2.5 border text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#707ef9] text-white border-[#707ef9]'
                            : 'bg-white text-[#0d0d0d] border-neutral-300 hover:border-[#0d0d0d]'
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
                <span className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Posición en Cancha
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {sportPositions.map((p) => {
                    const active = pos === p.code;
                    return (
                      <button
                        key={p.code}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setPos(p.code)}
                        className={`p-3 border text-left transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#0d0d0d] text-white border-[#0d0d0d]'
                            : 'bg-[#f5f6f8] text-[#0d0d0d] border-neutral-200 hover:border-[#707ef9]'
                        }`}
                      >
                        <p className="font-mono text-xs font-bold text-[#707ef9]">{p.code}</p>
                        <p className="text-xs font-bold mt-0.5">{p.label}</p>
                        <p className={`text-[10px] mt-1 leading-tight ${active ? 'text-neutral-300' : 'text-neutral-500'}`}>
                          {p.shortDesc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* UFRO Career Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="leyendas-career" className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                    Carrera UFRO
                  </label>
                  <span className="text-[11px] font-mono text-[#707ef9] font-semibold">
                    Duración: {inferCareerYears(selectedCareer)} años ({inferCareerYears(selectedCareer) * 2} semestres)
                  </span>
                </div>
                <select
                  id="leyendas-career"
                  value={selectedCareer}
                  onChange={(e) => setSelectedCareer(e.target.value)}
                  className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
                >
                  {UFRO_CAREERS.map((c) => (
                    <option key={c.carrera} value={c.carrera}>
                      {c.carrera} ({inferCareerYears(c.carrera)} años)
                    </option>
                  ))}
                </select>
              </div>

              {/* Primary CTAs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleGoToTryouts}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-[#0d0d0d] hover:bg-[#707ef9] text-white font-display font-bold uppercase tracking-widest text-sm transition-colors cursor-pointer"
                >
                  <span>Ir a Pruebas Mechonas</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleQuickRandomDebut}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-white border border-neutral-300 hover:border-[#0d0d0d] text-[#0d0d0d] font-display font-bold uppercase tracking-widest text-sm transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#707ef9]" />
                  <span>Debut en Equipo Aleatorio</span>
                </button>
              </div>
            </div>

            {/* Right Column: How it works + Local Hall of Fame */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-[#0d0d0d] text-white p-6 space-y-4">
                <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#707ef9]">
                  Mecánicas Oficiales UFRO
                </p>
                <h3 className="font-display text-2xl font-bold uppercase">
                  De Mechón a Leyenda del Campus
                </h3>
                <ul className="space-y-3 text-xs text-neutral-300 leading-relaxed">
                  <li className="flex items-start gap-2.5">
                    <Shield className="w-4 h-4 text-[#707ef9] shrink-0 mt-0.5" />
                    <span>
                      <strong>Equipos Reales Intercarreras:</strong> Ficha por clubes inscritos en
                      Firestore con sus escudos oficiales, o asciende desde 3ª hasta 1ª División.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <GraduationCap className="w-4 h-4 text-[#707ef9] shrink-0 mt-0.5" />
                    <span>
                      <strong>Beca Deportiva y Postgrados:</strong> Equilibra tus entrenamientos y
                      estudios para activar Beca Deportiva, Magíster (+2 años) y Doctorado (+3 años).
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Trophy className="w-4 h-4 text-[#707ef9] shrink-0 mt-0.5" />
                    <span>
                      <strong>Torneos y Selección UFRO:</strong> Pelea Fase de Grupos, Copa Facultad,
                      Playoffs, Interfacultades y nóminas CNU / LDES / FENAUDE.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Local Hall of Fame Top 5 */}
              <div className="bg-white border border-neutral-200 p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-[#707ef9]" />
                    <h3 className="font-display text-xl font-bold uppercase text-[#0d0d0d]">
                      Tu Salón de la Fama Local
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-500">Top 5</span>
                </div>

                {localHof.length === 0 ? (
                  <p className="text-xs text-neutral-500">
                    Completa tu primera carrera para guardar tus mejores registros en este dispositivo.
                  </p>
                ) : (
                  <div className="divide-y divide-neutral-200">
                    {localHof.map((item, idx) => (
                      <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-bold text-[#0d0d0d] truncate">
                            #{idx + 1} {item.playerName}
                          </p>
                          <p className="text-neutral-500 truncate">
                            {item.legacyTitle} · {item.finalTeam}
                          </p>
                        </div>
                        <div className="text-right shrink-0 tabular-nums">
                          <p className="font-display text-lg font-bold text-[#707ef9]">
                            {item.score.toLocaleString('es-CL')} pts
                          </p>
                          <p className="text-[10px] text-neutral-500">
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
        )}

        {/* ==================== STEP 1B: PRUEBAS MECHONAS ==================== */}
        {screen === 'tryouts' && (
          <div className="bg-white border border-neutral-200 p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-neutral-200 pb-4">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-[#707ef9]">
                  Paso 2 de 2 · Pruebas Mechonas {SPORT_CONFIG[sportKey].name}
                </p>
                <h2 className="font-display text-3xl font-bold uppercase text-[#0d0d0d] mt-1">
                  Elige tu Club para Probarte
                </h2>
                <p className="text-xs text-neutral-600 mt-1">
                  Postulas como <strong>{playerName}</strong> ({pos} · {selectedCareer}). Tu carrera
                  te otorga ventaja en clubes de la misma carrera.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScreen('create')}
                className="text-xs font-medium text-neutral-600 hover:text-[#0d0d0d] cursor-pointer self-start sm:self-auto"
              >
                ← Cambiar ficha
              </button>
            </div>

            {tryoutNotice && (
              <div className="bg-amber-50 border border-amber-300 p-4 text-xs text-amber-950">
                {tryoutNotice}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(fallbackClubs.length > 0 ? fallbackClubs : tryoutClubs).map((club) => {
                const isOwn = club.carrera.toLowerCase() === selectedCareer.toLowerCase();
                const isFallback = fallbackClubs.length > 0;
                const chance = isFallback
                  ? 100
                  : getTrialAcceptanceChance(previewOvr, club.ovr, isOwn);

                return (
                  <div
                    key={club.id}
                    className="border border-neutral-200 p-5 flex flex-col justify-between gap-4 hover:border-[#707ef9] transition-colors bg-white"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <TeamCrest
                          escudo={club.escudo}
                          sigla={club.sigla}
                          nombre={club.name}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase">
                            <span className="text-[#707ef9] font-bold">{club.div}</span>
                            {club.isRealTeam && (
                              <span className="text-emerald-700 font-bold">· Equipo Real UFRO</span>
                            )}
                            {isOwn && <span className="text-[#0d0d0d] font-bold">· Tu Carrera</span>}
                          </div>
                          <h3 className="font-display text-2xl font-bold uppercase text-[#0d0d0d] truncate">
                            {club.name}
                          </h3>
                          <p className="text-xs text-neutral-500 truncate">{club.carrera}</p>
                        </div>
                      </div>

                      <div className="bg-[#0d0d0d] text-white px-3 py-1.5 text-center shrink-0">
                        <p className="text-[9px] font-mono uppercase text-neutral-400">OVR</p>
                        <p className="font-display text-2xl font-bold tabular-nums">{club.ovr}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-neutral-200">
                      <span className="text-xs text-neutral-600 tabular-nums">
                        {isFallback
                          ? 'Cupo de Rescate Garantizado (100%)'
                          : `Probabilidad de quedar: ${chance}%`}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAttemptTryout(club, isFallback)}
                        className="px-4 py-2 bg-[#0d0d0d] hover:bg-[#707ef9] text-white font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
                      >
                        {isFallback ? 'Firmar ahora' : 'Probarme'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== STEP 2 & 3: ACTIVE CAREER OR RETIRED LEGACY ==================== */}
        {screen === 'career' && career && (
          <div className="space-y-8">
            {/* Carbon Player HUD */}
            <div className="bg-[#0d0d0d] text-white p-6 border border-white/10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* Identity + Crest */}
                <div className="lg:col-span-6 flex items-center gap-4 min-w-0">
                  <TeamCrest
                    escudo={career.team.escudo}
                    sigla={career.team.sigla}
                    nombre={career.team.name}
                    size="lg"
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono uppercase tracking-wider">
                      <span className="text-[#707ef9] font-bold">
                        {career.year} · Semestre {career.semester}
                      </span>
                      <span className="text-neutral-500">·</span>
                      <span className="text-neutral-300 tabular-nums">
                        {getPlayerAge(career.startYear, career.year)} años
                      </span>
                      <span className="text-neutral-500">·</span>
                      <span className="text-neutral-300">{career.postgradStage}</span>
                      {career.onLoan && (
                        <span className="bg-amber-400 text-[#0d0d0d] px-1.5 py-0.5 font-bold">
                          A PRÉSTAMO
                        </span>
                      )}
                      {career.hasScholarship && (
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-1.5 py-0.5 font-bold">
                          BECA DEPORTIVA
                        </span>
                      )}
                      {career.climbedFromThirdToFirst && (
                        <span className="bg-[#707ef9] text-white px-1.5 py-0.5 font-bold">
                          3ª → 1ª
                        </span>
                      )}
                    </div>
                    <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight truncate">
                      {career.playerName}
                    </h2>
                    <p className="text-xs text-neutral-300 truncate">
                      {career.team.name} ({career.team.div} · OVR {career.team.ovr}) · {career.pos} ·{' '}
                      <strong>{career.role}</strong> · {career.career}
                    </p>
                  </div>
                </div>

                {/* Right HUD Metrics */}
                <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div
                    className={`p-3 border text-center ${
                      career.ovr >= 100
                        ? 'bg-amber-400 text-[#0d0d0d] border-amber-300'
                        : 'bg-[#18181f] border-white/15'
                    }`}
                  >
                    <p className={`text-[10px] font-mono uppercase ${career.ovr >= 100 ? 'text-[#0d0d0d]/80 font-bold' : 'text-neutral-400'}`}>
                      {career.ovr >= 100 ? 'GOAT OVR' : 'OVR ACTUAL'}
                    </p>
                    <p className="font-display text-4xl font-bold tabular-nums leading-none mt-1">
                      {career.ovr}
                    </p>
                  </div>

                  <div className="bg-[#18181f] border border-white/15 p-3 text-center">
                    <p className="text-[10px] font-mono uppercase text-neutral-400">Avance</p>
                    <p className="font-display text-3xl font-bold tabular-nums leading-none mt-1">
                      {career.semestersPlayed}/{career.totalSemesters}
                    </p>
                    <p className="text-[10px] text-neutral-400 mt-1">semestres</p>
                  </div>

                  <div className="bg-[#18181f] border border-white/15 p-3 text-center">
                    <p className="text-[10px] font-mono uppercase text-neutral-400">Palmarés</p>
                    <p className="font-display text-3xl font-bold text-amber-400 tabular-nums leading-none mt-1">
                      {career.trophies.length}
                    </p>
                    <p className="text-[10px] text-neutral-400 mt-1">
                      {career.awards.length} premios
                    </p>
                  </div>

                  <div className="bg-[#18181f] border border-white/15 p-3 text-center">
                    <p className="text-[10px] font-mono uppercase text-neutral-400">Sel. UFRO</p>
                    <p className="font-display text-3xl font-bold text-[#707ef9] tabular-nums leading-none mt-1">
                      {career.caps}
                    </p>
                    <p className="text-[10px] text-neutral-400 mt-1">partidos</p>
                  </div>
                </div>
              </div>

              {/* Hidden GPA Narrative Bar + Recurring Rival Strip */}
              <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {academicHint && (
                  <div className="flex items-start gap-2.5">
                    <GraduationCap
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        academicHint.tone === 'good'
                          ? 'text-emerald-400'
                          : academicHint.tone === 'warn'
                          ? 'text-amber-400'
                          : academicHint.tone === 'danger'
                          ? 'text-red-400'
                          : 'text-[#707ef9]'
                      }`}
                    />
                    <div>
                      <span className="font-bold uppercase tracking-wider text-white">
                        Pulso Académico: {academicHint.label}
                      </span>
                      <p className="text-neutral-400 mt-0.5">{academicHint.detail}</p>
                    </div>
                  </div>
                )}

                {career.rival && (
                  <div className="flex items-start gap-2.5 md:justify-end">
                    <Swords className="w-4 h-4 text-[#707ef9] shrink-0 mt-0.5" />
                    <div className="md:text-right">
                      <span className="font-bold uppercase tracking-wider text-white">
                        Rival Recurrente: {career.rival.name} ({career.rival.clubName})
                      </span>
                      <p className="text-neutral-400 mt-0.5 tabular-nums">
                        OVR {career.rival.ovr} · Historial H2H: {career.rival.h2hWins}G —{' '}
                        {career.rival.h2hLosses}P
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* MAIN CAREER STAGE OR FINAL LEGACY SUMMARY */}
            {career.finished && legacyBanner ? (
              <div className="space-y-8">
                {/* Legacy Hero Card */}
                <div className="bg-white border-2 border-[#0d0d0d] p-6 sm:p-8 space-y-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-neutral-200 pb-6">
                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-[0.2em] text-[#707ef9]">
                        <Crown className="w-4 h-4" />
                        <span>Legado Final · Categoría {legacyBanner.tier}</span>
                      </span>
                      <h3 className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-tight text-[#0d0d0d]">
                        {legacyBanner.title}
                      </h3>
                      <p className="text-sm text-neutral-600 max-w-2xl">
                        {legacyBanner.subtitle}
                      </p>
                    </div>

                    <div className="bg-[#0d0d0d] text-white px-6 py-4 text-center shrink-0">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-[#707ef9]">
                        Puntaje Oficial Semanal
                      </p>
                      <p className="font-display text-5xl font-bold tabular-nums mt-1">
                        {finalScore.toLocaleString('es-CL')}
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        Max OVR {career.maxOvr} · {career.semestersPlayed} semestres
                      </p>
                    </div>
                  </div>

                  {/* Global Ranking Submission + Poster + Replay */}
                  <div className="flex flex-wrap items-center gap-3">
                    {currentUser ? (
                      <button
                        type="button"
                        onClick={handleSubmitToGlobalRanking}
                        disabled={submittingGlobal || submittedGlobal}
                        className="inline-flex items-center gap-2 px-5 py-3 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer disabled:opacity-60"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {submittedGlobal
                            ? 'Publicado en el Top Global Semanal'
                            : submittingGlobal
                            ? 'Publicando...'
                            : 'Publicar en Top Global Semanal'}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onOpenAuth}
                        className="inline-flex items-center gap-2 px-5 py-3 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>Inicia sesión con Google para publicar en el Top Global</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowPoster(true)}
                      className="inline-flex items-center gap-2 px-5 py-3 bg-[#0d0d0d] hover:bg-neutral-800 text-white font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
                    >
                      <ImageIcon className="w-4 h-4 text-[#707ef9]" />
                      <span>Tarjeta Final PNG (1080×1920)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetToCreation}
                      className="inline-flex items-center gap-2 px-5 py-3 bg-white border border-neutral-300 hover:border-[#0d0d0d] text-[#0d0d0d] font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Jugar Otra Carrera</span>
                    </button>
                  </div>

                  {submitError && (
                    <div role="alert" className="bg-red-50 border border-red-300 px-4 py-3 text-xs text-red-900">
                      {submitError}
                    </div>
                  )}

                  {/* Trophy Cabinet + Individual Awards + Stints */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
                    <div className="border border-neutral-200 bg-[#f5f6f8] p-5 space-y-3">
                      <h4 className="font-display text-xl font-bold uppercase text-[#0d0d0d] flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-[#707ef9]" />
                        <span>Vitrina de Títulos ({career.trophies.length})</span>
                      </h4>
                      {career.trophies.length === 0 ? (
                        <p className="text-xs text-neutral-500">Sin títulos colectivos en esta carrera.</p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {career.trophies.map((t) => (
                            <div key={t.id} className="bg-white border border-neutral-200 p-2.5 flex items-center gap-2.5 text-xs">
                              <LeyendasTrophyIcon title={t.title} kind="trophy" size="sm" />
                              <div className="min-w-0">
                                <p className="font-bold text-[#0d0d0d] truncate">{t.title}</p>
                                <p className="text-neutral-500 truncate">{t.year} · {t.team}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border border-neutral-200 bg-[#f5f6f8] p-5 space-y-3">
                      <h4 className="font-display text-xl font-bold uppercase text-[#0d0d0d] flex items-center gap-2">
                        <Award className="w-4 h-4 text-[#707ef9]" />
                        <span>Premios Individuales ({career.awards.length})</span>
                      </h4>
                      {career.awards.length === 0 ? (
                        <p className="text-xs text-neutral-500">Sin premios individuales registrados.</p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {career.awards.map((a) => (
                            <div key={a.id} className="bg-white border border-neutral-200 p-2.5 flex items-center gap-2.5 text-xs">
                              <LeyendasTrophyIcon title={a.title} kind="award" size="sm" />
                              <div className="min-w-0">
                                <p className="font-bold text-[#0d0d0d] truncate">{a.title}</p>
                                <p className="text-neutral-500">Temporada {a.year}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border border-neutral-200 bg-[#f5f6f8] p-5 space-y-3">
                      <h4 className="font-display text-xl font-bold uppercase text-[#0d0d0d] flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#707ef9]" />
                        <span>Clubes Defendidos ({career.stints.length})</span>
                      </h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {career.stints.map((s, idx) => (
                          <div key={`${s.team}-${idx}`} className="bg-white border border-neutral-200 p-2.5 flex items-center justify-between gap-2 text-xs">
                            <div className="min-w-0">
                              <p className="font-bold text-[#0d0d0d] truncate">{s.team}</p>
                              <p className="text-neutral-500">{s.div}</p>
                            </div>
                            <span className="font-mono text-[11px] text-[#707ef9] shrink-0">
                              {s.years}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ACTIVE SEMESTER LOOP + SIDEBAR */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Main Interactive Stage (8 cols) */}
                <div className="lg:col-span-8 bg-white border border-neutral-200 p-6 sm:p-8 space-y-6">
                  {/* PHASE 1: FOCUS CARDS */}
                  {semPhase === 'FOCUS' && (
                    <div className="space-y-5">
                      <div className="border-b border-neutral-200 pb-4">
                        <p className="text-xs font-mono uppercase tracking-widest text-[#707ef9]">
                          {career.year} · Semestre {career.semester} · Planificación
                        </p>
                        <h3 className="font-display text-3xl font-bold uppercase text-[#0d0d0d] mt-1">
                          Elige tu Enfoque de Semestre
                        </h3>
                        <p className="text-xs text-neutral-600 mt-1">
                          Define cómo repartirás tu energía entre el Complejo Deportivo UFRO y tus
                          ramos universitarios.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {focusCards.map((card) => (
                          <button
                            key={card.id}
                            type="button"
                            onClick={() => handleChooseFocus(card)}
                            className="text-left border border-neutral-200 hover:border-[#707ef9] p-5 bg-white hover:bg-[#f9fafb] transition-colors flex flex-col justify-between gap-4 cursor-pointer"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2 text-[11px] font-mono font-bold uppercase">
                                <span
                                  className={
                                    card.tier === 'ORO'
                                      ? 'text-amber-600'
                                      : card.tier === 'PLATA'
                                      ? 'text-[#707ef9]'
                                      : 'text-neutral-500'
                                  }
                                >
                                  CARTA {card.tier}
                                </span>
                                <span className="tabular-nums text-[#0d0d0d]">
                                  {card.ovrDelta >= 0 ? `+${card.ovrDelta}` : card.ovrDelta} OVR
                                </span>
                              </div>
                              <h4 className="font-display text-2xl font-bold uppercase text-[#0d0d0d]">
                                {card.title}
                              </h4>
                              <p className="text-xs text-neutral-600">{card.subtitle}</p>
                            </div>
                            <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
                              <span>{card.flair}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PHASE 2: CAMPUS / CAREER EVENT */}
                  {semPhase === 'EVENT' && activeEvent && (
                    <div className="space-y-6">
                      <div className="border-b border-neutral-200 pb-4">
                        <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#707ef9]">
                          {activeEvent.tag}
                        </span>
                        <h3 className="font-display text-3xl font-bold uppercase text-[#0d0d0d] mt-1">
                          {activeEvent.title}
                        </h3>
                        <p className="text-sm text-neutral-700 mt-2 leading-relaxed">
                          {activeEvent.description}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        {activeEvent.options.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleChooseEventOption(opt)}
                            className="text-left p-5 border border-neutral-300 hover:border-[#707ef9] hover:bg-[#f5f6f8] transition-colors cursor-pointer space-y-1"
                          >
                            <p className="font-display text-xl font-bold uppercase text-[#0d0d0d]">
                              {opt.label}
                            </p>
                            <p className="text-xs font-mono text-[#707ef9]">{opt.hint}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PHASE 3: KEY MOMENT ON PITCH/COURT */}
                  {semPhase === 'MOMENT' && activeMoment && (
                    <div className="space-y-6">
                      {eventResult && (
                        <div className="bg-[#f5f6f8] border border-neutral-200 p-4 text-xs text-neutral-700">
                          <strong className="text-[#0d0d0d] uppercase">Resultado del evento:</strong>{' '}
                          {eventResult.narrative}
                        </div>
                      )}

                      <div className="bg-[#0d0d0d] text-white p-6 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-400">
                          <Flame className="w-4 h-4" />
                          <span>Momento Clave en Cancha</span>
                        </div>
                        <h3 className="font-display text-3xl font-bold uppercase">
                          {activeMoment.title}
                        </h3>
                        <p className="text-sm text-neutral-300">{activeMoment.context}</p>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        {activeMoment.choices.map((ch) => (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() => handleChooseKeyMoment(ch)}
                            className="text-left p-4 border border-neutral-300 hover:border-[#707ef9] hover:bg-[#f5f6f8] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer"
                          >
                            <span className="font-display text-xl font-bold uppercase text-[#0d0d0d]">
                              {ch.label}
                            </span>
                            <span className="text-[11px] font-mono uppercase tracking-wider text-[#707ef9] font-bold shrink-0">
                              Riesgo: {ch.riskTag}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PHASE 4: SEMESTER CELEBRATION & SUMMARY */}
                  {semPhase === 'CELEBRATION' && career.lastSemesterCelebration && (
                    <div className="space-y-6">
                      {momentNarrative && (
                        <div className="bg-[#f5f6f8] border border-neutral-200 p-4 text-xs text-neutral-700">
                          <strong className="text-[#0d0d0d] uppercase">Jugada decisiva:</strong>{' '}
                          {momentNarrative}
                        </div>
                      )}

                      <div
                        className={`p-6 space-y-3 border ${
                          career.lastSemesterCelebration.trophiesWon.length > 0
                            ? 'bg-[#0d0d0d] text-white border-amber-400'
                            : 'bg-[#0d0d0d] text-white border-white/10'
                        }`}
                      >
                        <p className="text-xs font-mono uppercase tracking-widest text-[#707ef9]">
                          Cierre de Semestre · Balance Oficial
                        </p>
                        <h3 className="font-display text-3xl sm:text-4xl font-bold uppercase">
                          {career.lastSemesterCelebration.headline}
                        </h3>
                        <p className="text-sm text-neutral-300">
                          {career.lastSemesterCelebration.subheadline}
                        </p>

                        {career.lastSemesterCelebration.promoted && (
                          <p className="text-xs font-mono uppercase text-emerald-400 font-bold">
                            ↑ {career.lastSemesterCelebration.promoted}
                          </p>
                        )}
                        {career.lastSemesterCelebration.relegated && (
                          <p className="text-xs font-mono uppercase text-red-400 font-bold">
                            ↓ {career.lastSemesterCelebration.relegated}
                          </p>
                        )}
                        {career.lastSemesterCelebration.seleccionUfro && (
                          <p className="text-xs font-mono uppercase text-[#707ef9] font-bold">
                            ★ {career.lastSemesterCelebration.seleccionUfro}
                          </p>
                        )}
                      </div>

                      {(career.lastSemesterCelebration.trophiesWon.length > 0 ||
                        career.lastSemesterCelebration.awardsWon.length > 0) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {career.lastSemesterCelebration.trophiesWon.map((t) => (
                            <div key={t.id} className="border border-amber-300 bg-amber-50 p-3.5 flex items-center gap-3">
                              <LeyendasTrophyIcon title={t.title} kind="trophy" size="md" />
                              <div>
                                <p className="text-[10px] font-mono uppercase text-amber-800 font-bold">
                                  Nuevo Título
                                </p>
                                <p className="text-xs font-bold text-[#0d0d0d]">{t.title}</p>
                              </div>
                            </div>
                          ))}
                          {career.lastSemesterCelebration.awardsWon.map((a) => (
                            <div key={a.id} className="border border-[#707ef9]/40 bg-[#707ef9]/5 p-3.5 flex items-center gap-3">
                              <LeyendasTrophyIcon title={a.title} kind="award" size="md" />
                              <div>
                                <p className="text-[10px] font-mono uppercase text-[#707ef9] font-bold">
                                  Premio Individual
                                </p>
                                <p className="text-xs font-bold text-[#0d0d0d]">{a.title}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleContinueAfterCelebration}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-sm transition-colors cursor-pointer"
                      >
                        <span>
                          {career.pendingPostgradOption
                            ? 'Revisar Opción de Postgrado'
                            : career.pendingLoanOffers.length > 0
                            ? 'Ver Ofertas de Préstamo S2'
                            : career.pendingTransferOffers.length > 0
                            ? 'Abrir Mercado de Pases'
                            : 'Avanzar al Siguiente Semestre'}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* PHASE 5: LOAN CHOICE (S1 ELIMINATED) */}
                  {semPhase === 'LOAN' && (
                    <div className="space-y-5">
                      <div className="border-b border-neutral-200 pb-4">
                        <p className="text-xs font-mono uppercase tracking-widest text-[#707ef9]">
                          Ventana Especial · Préstamo de Playoffs
                        </p>
                        <h3 className="font-display text-3xl font-bold uppercase text-[#0d0d0d] mt-1">
                          Clubes Clasificados te Buscan a Préstamo
                        </h3>
                        <p className="text-xs text-neutral-600 mt-1">
                          Puedes jugar el Semestre 2 a préstamo con un candidato al título y volver
                          a {career.team.name} al finalizar el año.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {career.pendingLoanOffers.map((club) => (
                          <div key={club.id} className="border border-neutral-200 p-4 space-y-3">
                            <div className="flex items-center gap-3">
                              <TeamCrest escudo={club.escudo} sigla={club.sigla} nombre={club.name} size="sm" />
                              <div className="min-w-0">
                                <p className="font-display text-xl font-bold uppercase text-[#0d0d0d] truncate">
                                  {club.name}
                                </p>
                                <p className="text-xs text-neutral-500">
                                  {club.div} · OVR {club.ovr}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleLoanDecision(club)}
                              className="w-full py-2 bg-[#0d0d0d] hover:bg-[#707ef9] text-white font-display font-bold uppercase tracking-widest text-xs cursor-pointer"
                            >
                              Aceptar Préstamo S2
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleLoanDecision(null)}
                        className="px-4 py-2.5 border border-neutral-300 text-xs font-bold uppercase tracking-wider text-neutral-700 hover:border-[#0d0d0d] cursor-pointer"
                      >
                        Quedarme entrenando en {career.team.name}
                      </button>
                    </div>
                  )}

                  {/* PHASE 6: TRANSFER MARKET (END OF YEAR) */}
                  {semPhase === 'TRANSFER' && (
                    <div className="space-y-5">
                      <div className="border-b border-neutral-200 pb-4">
                        <p className="text-xs font-mono uppercase tracking-widest text-[#707ef9]">
                          Mercado de Pases Intercarreras · Temporada {career.year}
                        </p>
                        <h3 className="font-display text-3xl font-bold uppercase text-[#0d0d0d] mt-1">
                          Ofertas sobre la Mesa
                        </h3>
                        <p className="text-xs text-neutral-600 mt-1">
                          Puedes aceptar un traspaso o renovar lealtad con {career.team.name}.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        {career.pendingTransferOffers.map((offer) => (
                          <div
                            key={offer.id}
                            className="border border-neutral-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <TeamCrest
                                escudo={offer.club.escudo}
                                sigla={offer.club.sigla}
                                nombre={offer.club.name}
                                size="md"
                              />
                              <div className="min-w-0">
                                <span
                                  className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                                    offer.tag === 'TRAICIÓN'
                                      ? 'text-red-600'
                                      : offer.tag === 'SALTO DE DIVISIÓN'
                                      ? 'text-emerald-700'
                                      : 'text-[#707ef9]'
                                  }`}
                                >
                                  {offer.tag} · {offer.club.div} · OVR {offer.club.ovr}
                                </span>
                                <h4 className="font-display text-2xl font-bold uppercase text-[#0d0d0d] truncate">
                                  {offer.club.name}
                                </h4>
                                <p className="text-xs text-neutral-600">{offer.pitch}</p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleTransferDecision(offer.club)}
                              className="px-4 py-2.5 bg-[#0d0d0d] hover:bg-[#707ef9] text-white font-display font-bold uppercase tracking-widest text-xs shrink-0 cursor-pointer"
                            >
                              Fichar ({offer.rolePromise})
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleTransferDecision(null)}
                        className="px-5 py-2.5 bg-[#f5f6f8] border border-neutral-300 hover:border-[#0d0d0d] text-xs font-bold uppercase tracking-wider text-[#0d0d0d] cursor-pointer"
                      >
                        Renovar en {career.team.name} (Lealtad al Club)
                      </button>
                    </div>
                  )}

                  {/* PHASE 7: POSTGRAD EXTENSION */}
                  {semPhase === 'POSTGRAD' && career.pendingPostgradOption && (
                    <div className="space-y-6">
                      <div className="bg-[#0d0d0d] text-white p-6 space-y-2">
                        <p className="text-xs font-mono uppercase tracking-widest text-amber-400">
                          Ceremonia de Egreso UFRO
                        </p>
                        <h3 className="font-display text-3xl sm:text-4xl font-bold uppercase">
                          {career.pendingPostgradOption === 'MAGISTER'
                            ? '¡Clasificaste a Magíster UFRO (+2 Años)!'
                            : '¡Beca de Doctorado UFRO Disponible (+3 Años)!'}
                        </h3>
                        <p className="text-sm text-neutral-300">
                          Tu rendimiento académico y deportivo te permite extender tu carrera
                          universitaria y seguir sumando copas, premios y OVR en Intercarreras.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => handlePostgradDecision(true)}
                          className="px-5 py-3.5 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-xs cursor-pointer"
                        >
                          Continuar con {career.pendingPostgradOption}
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePostgradDecision(false)}
                          className="px-5 py-3.5 bg-white border border-neutral-300 hover:border-[#0d0d0d] text-[#0d0d0d] font-display font-bold uppercase tracking-widest text-xs cursor-pointer"
                        >
                          Retirarme y Ver Legado Final
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Sidebar: Live Stats + Timeline (4 cols) */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-white border border-neutral-200 p-5 space-y-4">
                    <h4 className="font-display text-xl font-bold uppercase text-[#0d0d0d] border-b border-neutral-200 pb-2">
                      Estadísticas de Carrera
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
                      <div className="bg-[#f5f6f8] border border-neutral-200 p-2.5">
                        <p className="text-[10px] uppercase text-neutral-500">PJ</p>
                        <p className="font-display text-2xl font-bold text-[#0d0d0d]">
                          {career.stats.m}
                        </p>
                      </div>
                      {career.sportKey === 'futbol' ? (
                        <>
                          <div className="bg-[#f5f6f8] border border-neutral-200 p-2.5">
                            <p className="text-[10px] uppercase text-neutral-500">Goles</p>
                            <p className="font-display text-2xl font-bold text-[#707ef9]">
                              {career.stats.g}
                            </p>
                          </div>
                          <div className="bg-[#f5f6f8] border border-neutral-200 p-2.5">
                            <p className="text-[10px] uppercase text-neutral-500">Asist.</p>
                            <p className="font-display text-2xl font-bold text-[#0d0d0d]">
                              {career.stats.a}
                            </p>
                          </div>
                        </>
                      ) : career.sportKey === 'basquet' ? (
                        <>
                          <div className="bg-[#f5f6f8] border border-neutral-200 p-2.5">
                            <p className="text-[10px] uppercase text-neutral-500">Pts</p>
                            <p className="font-display text-2xl font-bold text-[#707ef9]">
                              {career.stats.pts}
                            </p>
                          </div>
                          <div className="bg-[#f5f6f8] border border-neutral-200 p-2.5">
                            <p className="text-[10px] uppercase text-neutral-500">Reb / Ast</p>
                            <p className="font-display text-xl font-bold text-[#0d0d0d]">
                              {career.stats.reb}/{career.stats.ast}
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="bg-[#f5f6f8] border border-neutral-200 p-2.5">
                            <p className="text-[10px] uppercase text-neutral-500">Pts</p>
                            <p className="font-display text-2xl font-bold text-[#707ef9]">
                              {career.stats.pts}
                            </p>
                          </div>
                          <div className="bg-[#f5f6f8] border border-neutral-200 p-2.5">
                            <p className="text-[10px] uppercase text-neutral-500">Blq / Ace</p>
                            <p className="font-display text-xl font-bold text-[#0d0d0d]">
                              {career.stats.blk}/{career.stats.ace}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Bitácora Cronológica */}
                  <div className="bg-white border border-neutral-200 p-5 space-y-3">
                    <h4 className="font-display text-xl font-bold uppercase text-[#0d0d0d] border-b border-neutral-200 pb-2">
                      Bitácora de Carrera
                    </h4>
                    <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                      {career.timeline.map((item) => (
                        <div key={item.id} className="border border-neutral-200 bg-[#f5f6f8] p-3 text-xs space-y-1">
                          <div className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase">
                            <span
                              className={
                                item.tone === 'gold'
                                  ? 'text-amber-700 font-bold'
                                  : item.tone === 'danger'
                                  ? 'text-red-700 font-bold'
                                  : 'text-[#707ef9] font-bold'
                              }
                            >
                              {item.badge}
                            </span>
                            <span className="text-neutral-500">
                              {item.year} · S{item.semester}
                            </span>
                          </div>
                          <p className="font-bold text-[#0d0d0d]">{item.title}</p>
                          <p className="text-neutral-600 leading-snug">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TOP GLOBAL SEMANAL (FIRESTORE) ==================== */}
        <section className="bg-white border border-neutral-200 p-6 sm:p-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-neutral-200 pb-4">
            <div className="min-w-0">
              <p className="text-xs font-mono uppercase tracking-widest text-[#707ef9]">
                Ranking Oficial Firestore · {weekInfo.label}
              </p>
              <h2 className="font-display text-3xl font-bold uppercase text-[#0d0d0d] mt-1">
                Top Global Semanal LEYENDAS
              </h2>
              <p className="text-xs text-neutral-600 mt-1">
                Las mejores carreras universitarias completadas esta semana por jugadores con cuenta
                Google UFRO. Haz clic en cualquier fila para inspeccionar su vitrina completa.
              </p>
            </div>

            <div className="flex flex-wrap lg:flex-nowrap items-center gap-1 bg-[#f5f6f8] border border-neutral-200 p-1 shrink-0">
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
                  onClick={() => setRankingTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-display font-bold uppercase tracking-wider whitespace-nowrap cursor-pointer transition-colors ${
                    rankingTab === tab.id
                      ? 'bg-[#0d0d0d] text-white'
                      : 'text-neutral-600 hover:text-[#0d0d0d]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {weeklyRanking.length === 0 ? (
            <div className="border border-neutral-200 bg-[#f5f6f8] p-10 text-center space-y-2">
              <Medal className="w-7 h-7 text-[#707ef9] mx-auto" />
              <p className="font-display text-2xl font-bold uppercase text-[#0d0d0d]">
                Aún no hay carreras registradas esta semana
              </p>
              <p className="text-xs text-neutral-600 max-w-md mx-auto">
                Completa una carrera en LEYENDAS y publícala con tu cuenta de Google para inaugurar
                el Top Global de {weekInfo.label}.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-neutral-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f5f6f8] border-b border-neutral-200 text-neutral-500 uppercase">
                    <th className="py-3 px-3 w-12 font-medium">#</th>
                    <th className="py-3 px-3 font-medium">Leyenda</th>
                    <th className="py-3 px-3 hidden md:table-cell font-medium">Club Final · Carrera</th>
                    <th className="py-3 px-3 text-right font-medium tabular-nums">Max OVR</th>
                    <th className="py-3 px-3 text-right font-medium tabular-nums">Títulos</th>
                    <th className="py-3 px-3 text-right font-bold text-[#0d0d0d] tabular-nums">Puntaje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {weeklyRanking.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      onClick={() => setInspectedEntry(entry)}
                      className="hover:bg-[#f9fafb] cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3 font-display text-lg font-bold tabular-nums text-[#707ef9]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-[#0d0d0d] text-sm">{entry.playerName}</p>
                        <p className="text-neutral-500">{entry.legacyTitle}</p>
                      </td>
                      <td className="py-3 px-3 hidden md:table-cell text-neutral-600">
                        <p className="font-medium text-[#0d0d0d]">{entry.finalTeam}</p>
                        <p className="text-neutral-500">
                          {entry.career} · {SPORT_CONFIG[entry.sportKey].shortName} ({entry.pos})
                        </p>
                      </td>
                      <td className="py-3 px-3 text-right font-display text-lg font-bold tabular-nums">
                        {entry.maxOvr}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-neutral-700">
                        {entry.titlesCount}
                      </td>
                      <td className="py-3 px-3 text-right font-display text-xl font-bold text-[#0d0d0d] tabular-nums">
                        {entry.score.toLocaleString('es-CL')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Poster PNG Modal */}
      {showPoster && career && (
        <LeyendasPosterModal career={career} onClose={() => setShowPoster(false)} />
      )}

      {/* Global Ranking Career Inspector Modal */}
      {inspectedEntry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Detalle de carrera de ${inspectedEntry.playerName}`}
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white border border-neutral-300 max-w-2xl w-full overflow-hidden my-auto">
            <div className="bg-[#0d0d0d] text-white p-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-widest text-[#707ef9]">
                  {inspectedEntry.legacyTitle} · {inspectedEntry.weekKey}
                </p>
                <h3 className="font-display text-3xl font-bold uppercase mt-0.5">
                  {inspectedEntry.playerName}
                </h3>
                <p className="text-xs text-neutral-300 mt-1">
                  {inspectedEntry.finalTeam} · {inspectedEntry.career} · Max OVR{' '}
                  {inspectedEntry.maxOvr} · {inspectedEntry.score.toLocaleString('es-CL')} pts
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedEntry(null)}
                aria-label="Cerrar detalle de carrera"
                className="p-2 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-neutral-200 bg-[#f5f6f8] p-4 space-y-2">
                  <h4 className="font-display text-lg font-bold uppercase text-[#0d0d0d]">
                    Títulos ({inspectedEntry.trophies.length})
                  </h4>
                  {inspectedEntry.trophies.length === 0 ? (
                    <p className="text-xs text-neutral-500">Sin títulos registrados.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {inspectedEntry.trophies.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 text-xs">
                          <LeyendasTrophyIcon title={t.title} kind="trophy" size="sm" />
                          <span>
                            <strong>{t.title}</strong> ({t.year})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border border-neutral-200 bg-[#f5f6f8] p-4 space-y-2">
                  <h4 className="font-display text-lg font-bold uppercase text-[#0d0d0d]">
                    Clubes ({inspectedEntry.stints.length})
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    {inspectedEntry.stints.map((s, idx) => (
                      <div key={`${s.team}-${idx}`} className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[#0d0d0d]">{s.team} ({s.div})</span>
                        <span className="font-mono text-neutral-500">{s.years}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
