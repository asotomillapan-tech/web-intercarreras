import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Compass,
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
  applyOvrXpDelta,
  buildCareerTryoutList,
  buildLeaderboardEntryFromCareer,
  buildLeyendasTeamsFromTournament,
  buildPlayoffGauntlet,
  buildWeeklyLeaderboardViews,
  calculateCareerLeaderboardScore,
  computeCreativeLegacyBanner,
  createInitialCareerState,
  drawSemesterFocusCards,
  formatWeeklyCountdown,
  generateMidSemesterDilemma,
  getAcademicNarrativeHint,
  getChileWeekInfo,
  getOvrCapForCareer,
  getOvrProgressPercent,
  getOvrTierLabel,
  getPlayerAge,
  getSportPositions,
  getTrialAcceptanceChance,
  getVisualMiniGameScenario,
  getXpRequiredForNextOvr,
  inferCareerYears,
  legacyOvrDeltaToXp,
  pickSemesterEvent,
  RANDOM_NAMES_FEMALE,
  RANDOM_NAMES_MALE,
  resolveMidSemesterOption,
  shouldTriggerMidSemesterDilemma,
  shouldTriggerPlayoffGauntlet,
  simulateSemesterFull,
  SPORT_CONFIG,
  type LeyendasBranch,
  type LeyendasCareerState,
  type LeyendasClub,
  type LeyendasEventOption,
  type LeyendasFocusCard,
  type LeyendasGameEvent,
  type LeyendasGauntletResult,
  type LeyendasMidSemesterDilemma,
  type LeyendasMidSemesterOption,
  type LeyendasMidSemesterResolution,
  type LeyendasMiniGameKind,
  type LeyendasMiniGameOutcome,
  type LeyendasMiniGameScenario,
  type LeyendasPlayoffGauntlet,
  type LeyendasRankingCategory,
  type LeyendasSportKey,
} from '../domain/leyendasEngine';
import type {
  AppUserProfile,
  LeyendasLeaderboardEntry,
  TournamentState,
} from '../types/tournament';
import { LeyendasMiniGame } from './LeyendasMiniGame';
import { LeyendasPlayoffGauntlet as LeyendasPlayoffGauntletView } from './LeyendasPlayoffGauntlet';
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
  | 'MIDSEMESTER'
  | 'MOMENT'
  | 'GAUNTLET'
  | 'CELEBRATION'
  | 'LOAN'
  | 'RELEASED'
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

interface OvrFeedbackToast {
  id: number;
  label: string;
  tone: 'levelup' | 'xp' | 'down';
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

function getMomentumDisplay(momentum: number): { label: string; colorClass: string } {
  if (momentum >= 3) return { label: 'En llamas (+18% XP)', colorClass: 'text-amber-300' };
  if (momentum === 2) return { label: 'Gran racha (+12% XP)', colorClass: 'text-emerald-300' };
  if (momentum === 1) return { label: 'Buen ritmo (+6% XP)', colorClass: 'text-[#a5b0ff]' };
  if (momentum <= -2) return { label: 'Bache anímico', colorClass: 'text-rose-300' };
  if (momentum === -1) return { label: 'Presión alta', colorClass: 'text-amber-200' };
  return { label: 'Estable', colorClass: 'text-white/65' };
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
  const [careerTryoutClubs, setCareerTryoutClubs] = useState<LeyendasClub[]>([]);
  const [otherCampusClubs, setOtherCampusClubs] = useState<LeyendasClub[]>([]);
  const [showOtherCampusTryouts, setShowOtherCampusTryouts] = useState(false);
  const [rejectedClubIds, setRejectedClubIds] = useState<string[]>([]);
  const [tryoutNotice, setTryoutNotice] = useState<string | null>(null);
  const [previewOvr, setPreviewOvr] = useState<number>(66);

  // Active Career Loop State
  const [career, setCareer] = useState<LeyendasCareerState | null>(null);
  const [displayedOvr, setDisplayedOvr] = useState<number>(66);
  const [ovrToast, setOvrToast] = useState<OvrFeedbackToast | null>(null);
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
    rehabCompleted?: boolean;
    narrative: string;
  } | null>(null);

  // Dynamic Mid-Semester Crossroads & Rare Playoff Gauntlet State
  const [activeMidDilemma, setActiveMidDilemma] = useState<LeyendasMidSemesterDilemma | null>(null);
  const [midResolution, setMidResolution] = useState<LeyendasMidSemesterResolution | null>(null);
  const [activeGauntlet, setActiveGauntlet] = useState<LeyendasPlayoffGauntlet | null>(null);

  const [activeMiniGame, setActiveMiniGame] = useState<LeyendasMiniGameScenario | null>(null);
  const [lastMiniGameKind, setLastMiniGameKind] = useState<LeyendasMiniGameKind | null>(null);
  const [momentNarrative, setMomentNarrative] = useState<string | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);

  // Poster, Ranking & Detail Modal State
  const [showPoster, setShowPoster] = useState(false);
  const [submittingGlobal, setSubmittingGlobal] = useState(false);
  const [submittedGlobal, setSubmittedGlobal] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const autoPublishAttemptedKeyRef = useRef<string | null>(null);
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

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [screen]);

  // Smooth step-by-step animated OVR counter
  useEffect(() => {
    if (!career) return;
    if (displayedOvr === career.ovr) return;
    const step = career.ovr > displayedOvr ? 1 : -1;
    const timer = window.setInterval(() => {
      setDisplayedOvr((curr) => {
        if (curr === career.ovr) return curr;
        return curr + step;
      });
    }, 95);
    return () => window.clearInterval(timer);
  }, [career, displayedOvr]);

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

  const triggerOvrFeedback = (ovrDelta: number, appliedXp: number) => {
    if (ovrDelta !== 0) {
      setOvrToast({
        id: Date.now() + Math.random(),
        label: ovrDelta > 0 ? `+${ovrDelta} OVR` : `${ovrDelta} OVR`,
        tone: ovrDelta > 0 ? 'levelup' : 'down',
      });
    } else if (appliedXp !== 0) {
      setOvrToast({
        id: Date.now() + Math.random(),
        label: appliedXp > 0 ? `+${appliedXp} XP` : `${appliedXp} XP`,
        tone: appliedXp > 0 ? 'xp' : 'down',
      });
    }
  };

  const applyIncrementalOvrXp = (
    baseCareer: LeyendasCareerState,
    xpDelta: number
  ): LeyendasCareerState => {
    const cap = getOvrCapForCareer({
      trophiesCount: baseCareer.trophies.length,
      gauntletsWon: baseCareer.gauntletsWon ?? 0,
      ovr: baseCareer.ovr,
    });
    const res = applyOvrXpDelta({
      currentOvr: baseCareer.ovr,
      currentProgress: baseCareer.ovrProgress ?? 0,
      xpDelta,
      ovrCap: cap,
      semestersPlayed: baseCareer.semestersPlayed,
      momentum: baseCareer.momentum ?? 0,
    });
    triggerOvrFeedback(res.ovrDelta, res.appliedXp);
    return {
      ...baseCareer,
      ovr: res.nextOvr,
      ovrProgress: res.nextProgress,
      maxOvr: Math.max(baseCareer.maxOvr, res.nextOvr),
      lastOvrDelta: res.ovrDelta,
    };
  };

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
    setDisplayedOvr(nextCareer.ovr);
    setOvrToast(null);
    setFocusCards(drawSemesterFocusCards());
    setChosenFocus(null);
    setActiveEvent(null);
    setEventResult(null);
    setActiveMidDilemma(null);
    setMidResolution(null);
    setActiveGauntlet(null);
    setActiveMiniGame(null);
    setLastMiniGameKind(null);
    setMomentNarrative(null);
    setSemPhase('FOCUS');
    setSubmittedGlobal(false);
    setSubmitError(null);
    autoPublishAttemptedKeyRef.current = null;
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
    const directory = buildCareerTryoutList(allClubs, sportKey, branch, selectedCareer);
    setCareerTryoutClubs(directory.careerClubs);
    setOtherCampusClubs(directory.otherCampusClubs);
    setShowOtherCampusTryouts(false);
    setRejectedClubIds([]);
    setTryoutNotice(null);
    setScreen('tryouts');
  };

  const handleQuickRandomDebut = () => {
    const trimmed =
      playerName.trim() || (branch === 'mujer' ? RANDOM_NAMES_FEMALE[0] : RANDOM_NAMES_MALE[0]);
    if (!playerName.trim()) setPlayerName(trimmed);
    setCreationError(null);
    const directory = buildCareerTryoutList(allClubs, sportKey, branch, selectedCareer);
    const pool =
      directory.careerClubs.length > 0 ? directory.careerClubs : directory.otherCampusClubs;
    const chosen = pool[Math.floor(Math.random() * pool.length)] ?? allClubs[0];
    if (chosen) {
      launchCareerWithClub(chosen);
    }
  };

  const handleAttemptTryout = (club: LeyendasClub, guaranteed = false) => {
    const isOwnCareer =
      club.carrera.toLowerCase().trim() === selectedCareer.toLowerCase().trim();
    const chance = guaranteed ? 100 : getTrialAcceptanceChance(previewOvr, club.ovr, isOwnCareer);
    if (Math.random() * 100 <= chance) {
      launchCareerWithClub(club);
    } else {
      const nextRejected = rejectedClubIds.includes(club.id)
        ? rejectedClubIds
        : [...rejectedClubIds, club.id];
      setRejectedClubIds(nextRejected);

      const remainingCareerClubs = careerTryoutClubs.filter((c) => !nextRejected.includes(c.id));
      if (remainingCareerClubs.length > 0) {
        setTryoutNotice(
          `${club.name} (${club.ovr} OVR) agradeció tu prueba mechona, pero por ahora no hubo cupo en ese plantel. Aún puedes seguir probándote en los otros ${remainingCareerClubs.length} equipo(s) de tu carrera.`
        );
      } else {
        setTryoutNotice(
          `Completaste las pruebas en todos los equipos de ${selectedCareer}. Puedes usar tu Segunda Oportunidad (Repesca garantizada) en un club de tu carrera o explorar otros clubes del campus.`
        );
      }
    }
  };

  // Helper to route to Rare Playoff Gauntlet or Standard Decisive Mini-Game
  const routeToDecisiveStage = (currentCareer: LeyendasCareerState) => {
    const triggerGauntlet = shouldTriggerPlayoffGauntlet({
      semester: currentCareer.semester,
      year: currentCareer.year,
      lastGauntletYear: currentCareer.lastGauntletYear ?? null,
      hasActiveInjury: Boolean(currentCareer.activeInjury),
      ovr: currentCareer.ovr,
      momentum: currentCareer.momentum ?? 0,
    });

    if (triggerGauntlet) {
      const gauntlet = buildPlayoffGauntlet({
        year: currentCareer.year,
        sportKey: currentCareer.sportKey,
        branch: currentCareer.branch,
        pos: currentCareer.pos,
        playerOvr: currentCareer.ovr,
        team: currentCareer.team,
        allClubs,
        buildScenario: (rivalName, prevKind, speedBump) =>
          getVisualMiniGameScenario(currentCareer, Math.random, prevKind, {
            rivalName,
            speedBump,
          }),
      });
      setActiveGauntlet(gauntlet);
      setActiveMiniGame(null);
      setMomentNarrative(null);
      setSemPhase('GAUNTLET');
      return;
    }

    const nextMiniGame = getVisualMiniGameScenario(currentCareer, Math.random, lastMiniGameKind);
    setLastMiniGameKind(nextMiniGame.kind);
    setActiveMiniGame(nextMiniGame);
    setActiveGauntlet(null);
    setMomentNarrative(null);
    setSemPhase('MOMENT');
  };

  // --- Gameplay Step Handlers (Balanced Hardcore OVR XP Progression) ---

  const handleChooseFocus = (card: LeyendasFocusCard) => {
    if (!career) return;
    const focusXp = card.ovrXpDelta ?? legacyOvrDeltaToXp(card.ovrDelta);
    const updated = applyIncrementalOvrXp(career, focusXp);
    setCareer(updated);
    setChosenFocus(card);
    setActiveEvent(pickSemesterEvent(updated));
    setEventResult(null);
    setActiveMidDilemma(null);
    setMidResolution(null);
    setActiveGauntlet(null);
    setSemPhase('EVENT');
  };

  const handleChooseEventOption = (opt: LeyendasEventOption) => {
    if (!career || !chosenFocus) return;
    const roll = Math.random();
    const succeeded = opt.successChance === undefined ? true : roll <= opt.successChance;
    const ovrDelta = succeeded ? opt.ovrDelta : opt.altOvrDelta ?? 0;
    const gpaDelta = succeeded ? opt.gpaDelta : opt.altGpaDelta ?? 0;
    const extraSemester = !succeeded && Boolean(opt.extraSemester);
    const rehabCompleted = activeEvent?.category === 'LESION' && opt.id === 'opt-rehab-segura';
    const injuryProb = rehabCompleted
      ? 0
      : Math.max(
          0,
          (opt.injuryChance ?? 0) +
            (chosenFocus.injuryRiskDelta > 0 ? chosenFocus.injuryRiskDelta * 0.5 : 0)
        );
    const injuryTriggered = injuryProb > 0 && Math.random() < injuryProb;
    const narrative =
      (succeeded ? opt.outcomeSuccess : opt.outcomeFail || opt.outcomeSuccess) +
      (injuryTriggered
        ? ' Además sufriste una lesión que afectará tu continuidad.'
        : '');

    const updated = applyIncrementalOvrXp(career, legacyOvrDeltaToXp(ovrDelta));
    setCareer(updated);
    setEventResult({
      ovrDelta,
      gpaDelta,
      statBonus: succeeded ? opt.statBonus : 0,
      teamOvrBoost: succeeded ? opt.teamOvrBoost : 0,
      extraSemester,
      injuryTriggered,
      rehabCompleted,
      narrative,
    });

    // Dynamic Mid-Semester Crossroads (Selección UFRO vs Pase de Fase)
    const shouldMid = shouldTriggerMidSemesterDilemma({
      semestersPlayed: updated.semestersPlayed,
      semester: updated.semester,
      ovr: updated.ovr,
      hasActiveInjury: Boolean(updated.activeInjury) || injuryTriggered,
    });

    if (shouldMid) {
      const dilemma = generateMidSemesterDilemma({
        year: updated.year,
        semester: updated.semester,
        ovr: updated.ovr,
        teamName: updated.team.name,
        teamDiv: updated.team.div,
        sportName: SPORT_CONFIG[updated.sportKey].shortName,
        rivalClubName: updated.rival?.clubName ?? 'Clásico Rival UFRO',
        gpa: updated.gpa,
        injuryRisk: updated.injuryRisk,
        hasActiveInjury: Boolean(updated.activeInjury) || injuryTriggered,
      });
      setActiveMidDilemma(dilemma);
      setMidResolution(null);
      setSemPhase('MIDSEMESTER');
      return;
    }

    routeToDecisiveStage(updated);
  };

  const handleChooseMidSemesterOption = (option: LeyendasMidSemesterOption) => {
    if (!career || !activeMidDilemma || option.disabled) return;
    const resolution = resolveMidSemesterOption({
      dilemma: activeMidDilemma,
      option,
      playerOvr: career.ovr,
    });
    const updated = applyIncrementalOvrXp(career, resolution.xpDelta);
    setCareer(updated);
    setMidResolution(resolution);
    routeToDecisiveStage(updated);
  };

  const handleCompleteMiniGame = (outcome: LeyendasMiniGameOutcome) => {
    if (!career || !chosenFocus || !eventResult) return;
    setMomentNarrative(`${outcome.headline} — ${outcome.narrative}`);
    const momentXp = outcome.ovrXpDelta ?? legacyOvrDeltaToXp(outcome.ovrDelta);
    const afterMomentOvr = applyIncrementalOvrXp(career, momentXp);

    const nextCareer = simulateSemesterFull({
      career: afterMomentOvr,
      allClubs,
      focusCard: chosenFocus,
      eventDelta: eventResult,
      momentDelta: {
        ovrDelta: outcome.ovrDelta,
        ovrXpDelta: momentXp,
        statBoost: outcome.statBoost,
        success: outcome.success,
      },
      midSemesterImpact: midResolution,
      incrementalOvrAlreadyApplied: true,
    });
    if (nextCareer.ovr !== afterMomentOvr.ovr) {
      triggerOvrFeedback(nextCareer.ovr - afterMomentOvr.ovr, 0);
    }
    setCareer(nextCareer);
    setSemPhase('CELEBRATION');
  };

  const handleCompleteGauntlet = (result: LeyendasGauntletResult) => {
    if (!career || !chosenFocus || !eventResult) return;
    setMomentNarrative(`${result.headline} — ${result.narrative}`);
    const afterGauntletOvr = applyIncrementalOvrXp(career, result.totalXpEarned);

    const nextCareer = simulateSemesterFull({
      career: afterGauntletOvr,
      allClubs,
      focusCard: chosenFocus,
      eventDelta: eventResult,
      momentDelta: {
        ovrDelta: result.wonChampionship ? 2 : 0,
        ovrXpDelta: result.totalXpEarned,
        statBoost: result.totalStatBoost,
        success: result.wonChampionship,
      },
      midSemesterImpact: midResolution,
      gauntletResult: result,
      incrementalOvrAlreadyApplied: true,
    });
    if (nextCareer.ovr !== afterGauntletOvr.ovr) {
      triggerOvrFeedback(nextCareer.ovr - afterGauntletOvr.ovr, 0);
    }
    setCareer(nextCareer);
    setActiveGauntlet(null);
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
    if (career.pendingReleaseNotice) {
      setSemPhase('RELEASED');
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
    setActiveMidDilemma(null);
    setMidResolution(null);
    setActiveGauntlet(null);
    setActiveMiniGame(null);
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
      const wasReleased = Boolean(career.pendingReleaseNotice);
      setCareer({
        ...career,
        team: newClub,
        stints: nextStints,
        pendingTransferOffers: [],
        pendingReleaseNotice: null,
        timeline: [
          {
            id: `tl-tr-${career.year}`,
            year: career.year,
            semester: 1,
            badge: wasReleased ? 'NUEVO COMIENZO' : 'FICHAJE',
            title: `Nuevo refuerzo de ${newClub.name} (${newClub.div})`,
            detail: wasReleased
              ? `Firmaste como agente libre para relanzar tu carrera universitaria.`
              : `Cambiaste de camiseta para el nuevo año universitario.`,
            tone: 'accent',
          },
          ...career.timeline,
        ],
      });
    } else {
      setCareer({ ...career, pendingTransferOffers: [], pendingReleaseNotice: null });
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

  const handleSubmitToGlobalRanking = useCallback(async () => {
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
  }, [career, currentUser, submittingGlobal, submittedGlobal, onSaveLeyendasEntry]);

  // Auto-publish completed career to Firestore Weekly Global Ranking when signed in
  useEffect(() => {
    if (!career || !career.finished || !currentUser || submittedGlobal || submittingGlobal) return;
    const key = `${career.playerName}-${career.startYear}-${career.semestersPlayed}-${career.maxOvr}-${currentUser.uid}`;
    if (autoPublishAttemptedKeyRef.current === key) return;
    autoPublishAttemptedKeyRef.current = key;
    void handleSubmitToGlobalRanking();
  }, [career, currentUser, submittedGlobal, submittingGlobal, handleSubmitToGlobalRanking]);

  const handleResetToCreation = () => {
    setCareer(null);
    setScreen('create');
    setConfirmRestart(false);
    setSubmittedGlobal(false);
    setSubmitError(null);
    setLastMiniGameKind(null);
    setActiveMidDilemma(null);
    setMidResolution(null);
    setActiveGauntlet(null);
    autoPublishAttemptedKeyRef.current = null;
  };

  const academicHint = career ? getAcademicNarrativeHint(career.gpa, career.hasScholarship) : null;
  const legacyBanner = career && career.finished ? computeCreativeLegacyBanner(career) : null;
  const finalScore = career && career.finished ? calculateCareerLeaderboardScore(career) : 0;

  const ovrCap = career
    ? getOvrCapForCareer({
        trophiesCount: career.trophies.length,
        gauntletsWon: career.gauntletsWon ?? 0,
        ovr: career.ovr,
      })
    : 99;
  const ovrXpReq = career ? getXpRequiredForNextOvr(career.ovr) : 72;
  const ovrXpPct = career ? getOvrProgressPercent(career.ovr, career.ovrProgress ?? 0, ovrCap) : 0;
  const ovrTier = career ? getOvrTierLabel(career.ovr) : null;
  const momentumInfo = career ? getMomentumDisplay(career.momentum ?? 0) : null;

  const semesterStepIndex =
    semPhase === 'FOCUS'
      ? 1
      : semPhase === 'EVENT'
      ? 2
      : semPhase === 'MIDSEMESTER'
      ? 3
      : semPhase === 'MOMENT' || semPhase === 'GAUNTLET'
      ? 4
      : 5;

  return (
    <div className="min-h-screen bg-[#050507] text-white pb-24">
      {/* Top Obsidian Editorial Header */}
      <section className="relative overflow-hidden border-b border-white/[0.08] bg-gradient-to-b from-[#0f1022]/85 via-[#08080e] to-[#050507]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-[#707ef9]/15 blur-3xl"
        />
        <div className="relative max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBackToHub}
              className="inline-flex items-center gap-2 text-xs text-white/65 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-[#a5b0ff]" />
              <span>Volver a Minijuegos</span>
            </button>

            <div className="flex flex-wrap items-center gap-4 text-xs text-white/60">
              <span className="text-[#a5b0ff]">
                {realClubCount > 0
                  ? `${realClubCount} equipos reales UFRO integrados`
                  : 'Clubes oficiales de carreras UFRO activos'}
              </span>
              {career &&
                (confirmRestart ? (
                  <span className="inline-flex items-center gap-2.5 rounded-full bg-white/[0.06] border border-white/[0.1] px-3.5 py-1">
                    <span className="text-white/80">¿Reiniciar carrera?</span>
                    <button
                      type="button"
                      onClick={handleResetToCreation}
                      className="text-rose-300 hover:text-white font-medium cursor-pointer"
                    >
                      Sí, reiniciar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRestart(false)}
                      className="text-white/60 hover:text-white cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmRestart(true)}
                    className="inline-flex items-center gap-1.5 text-white/65 hover:text-white transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Nueva carrera</span>
                  </button>
                ))}
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div className="space-y-1.5">
              <p className="text-xs text-[#a5b0ff]">
                Simulador de carrera universitaria · Intercarreras UFRO
              </p>
              <h1 className="text-4xl sm:text-5xl font-medium tracking-[-0.04em] text-white leading-[1.02]">
                Leyendas{' '}
                <span className="font-editorial text-[#c8ceff]">UFRO</span>
              </h1>
            </div>

            <div className="rounded-2xl bg-[#0c0c10] border border-white/[0.08] px-4 py-3 flex items-center gap-3 self-start lg:self-auto">
              <Clock className="w-4 h-4 text-[#a5b0ff] shrink-0" />
              <div className="text-xs">
                <p className="text-white/45">Top global · {weekInfo.label}</p>
                <p className="font-medium text-white tabular-nums mt-0.5">
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
                      setPlayerName(e.target.value);
                      setCreationError(null);
                    }}
                    placeholder="Ej: Lucas Morales"
                    className="flex-1 rounded-xl bg-[#111117] border border-white/[0.1] px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-[#707ef9]"
                  />
                  <button
                    type="button"
                    onClick={handleRandomName}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-xs font-medium text-white/85 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#a5b0ff]" />
                    <span>Aleatorio</span>
                  </button>
                </div>
              </div>

              {/* Sport Selector */}
              <div className="space-y-2">
                <span className="block text-xs font-medium text-white/75">
                  Deporte oficial UFRO
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(['futbol', 'basquet', 'voley'] as LeyendasSportKey[]).map((key) => {
                    const active = sportKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSportKey(key)}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                          active
                            ? 'bg-[#707ef9]/[0.16] text-white border-[#707ef9]/70'
                            : 'bg-[#111117] text-white/80 border-white/[0.08] hover:border-white/25'
                        }`}
                      >
                        <p className="text-base font-medium text-white">
                          {SPORT_CONFIG[key].name}
                        </p>
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
                        onClick={() => setBranch(item.id)}
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
                <span className="block text-xs font-medium text-white/75">
                  Posición en cancha
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {sportPositions.map((p) => {
                    const active = pos === p.code;
                    return (
                      <button
                        key={p.code}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setPos(p.code)}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                          active
                            ? 'bg-[#707ef9]/[0.16] text-white border-[#707ef9]/70'
                            : 'bg-[#111117] text-white/80 border-white/[0.08] hover:border-white/25'
                        }`}
                      >
                        <p className="text-xs font-semibold text-[#a5b0ff]">{p.code}</p>
                        <p className="text-sm font-medium text-white mt-0.5">{p.label}</p>
                        <p className="text-[11px] text-white/45 mt-1 leading-snug">
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
                  onChange={(e) => setSelectedCareer(e.target.value)}
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
                  onClick={handleGoToTryouts}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-[#707ef9] hover:bg-[#5e6df5] text-white text-sm font-medium transition-colors cursor-pointer"
                >
                  <span>Ir a pruebas mechonas</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  id="btn-leyendas-random-debut"
                  onClick={handleQuickRandomDebut}
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
                    De mechón a{' '}
                    <span className="font-editorial text-[#c8ceff]">leyenda real</span>
                  </h3>
                </div>
                <ul className="space-y-4 text-sm text-white/65 leading-relaxed">
                  <li className="flex items-start gap-3">
                    <Flame className="w-4 h-4 text-[#a5b0ff] shrink-0 mt-1" />
                    <span>
                      <strong className="text-white font-medium">Progresión OVR exigente:</strong>{' '}
                      Cada jugada suma XP hacia tu siguiente nivel. Superar los 90 y rozar el 99
                      OVR ahora es una verdadera hazaña universitaria.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Compass className="w-4 h-4 text-[#a5b0ff] shrink-0 mt-1" />
                    <span>
                      <strong className="text-white font-medium">
                        Cruces de medio semestre:
                      </strong>{' '}
                      Decide si te quedas peleando el pase de fase con tu carrera o aceptas la
                      citación de la Selección UFRO.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Crown className="w-4 h-4 text-amber-300 shrink-0 mt-1" />
                    <span>
                      <strong className="text-white font-medium">
                        Rutas épicas de playoffs:
                      </strong>{' '}
                      En pocas ocasiones especiales jugarás la última pelota consecutiva desde
                      Octavos o Cuartos hasta la Gran Final.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Shield className="w-4 h-4 text-[#a5b0ff] shrink-0 mt-1" />
                    <span>
                      <strong className="text-white font-medium">
                        Clubes reales y postgrado:
                      </strong>{' '}
                      Equipos oficiales Intercarreras, Beca Deportiva, Magíster (+2 años) y
                      Doctorado (+3 años).
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
                    Completa tu primera carrera para guardar tus mejores registros en este
                    dispositivo.
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
        )}

        {/* ==================== STEP 1B: PRUEBAS MECHONAS ==================== */}
        {screen === 'tryouts' &&
          (() => {
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
                      Equipos de{' '}
                      <span className="font-editorial text-[#c8ceff]">{selectedCareer}</span>
                    </h2>
                    <p className="text-sm text-white/60">
                      Postulas como <strong className="text-white font-medium">{playerName}</strong>{' '}
                      ({pos} · OVR inicial {previewOvr}). Se muestran todos los planteles de tu
                      carrera ({careerTryoutClubs.length}).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScreen('create')}
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
                      onClick={() => setShowOtherCampusTryouts(false)}
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
                        onClick={() => setShowOtherCampusTryouts(true)}
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
                              <h3 className="text-lg font-medium text-white truncate mt-0.5">
                                {club.name}
                              </h3>
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
                            onClick={() => handleAttemptTryout(club, canRepesca)}
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
          })()}

        {/* ==================== STEP 2 & 3: ACTIVE CAREER OR RETIRED LEGACY ==================== */}
        {screen === 'career' && career && (
          <div className="space-y-8">
            {/* Obsidian Editorial Player HUD */}
            <div className="rounded-3xl bg-[#0c0c10] border border-white/[0.08] p-5 sm:p-7 space-y-5">
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
                    <p className="text-xs text-white/55 truncate tabular-nums">
                      <span className="text-[#a5b0ff] font-medium">
                        {career.year} · Semestre {career.semester}
                      </span>
                      {' · '}
                      {getPlayerAge(career.startYear, career.year)} años
                      {' · '}
                      {career.postgradStage === 'PREGRADO'
                        ? 'Pregrado'
                        : career.postgradStage === 'MAGISTER'
                        ? 'Magíster'
                        : 'Doctorado'}
                      {career.onLoan && ' · A préstamo'}
                      {career.hasScholarship && ' · Beca deportiva'}
                    </p>
                    <h2 className="text-2xl sm:text-3xl font-medium tracking-[-0.03em] text-white truncate">
                      {career.playerName}
                    </h2>
                    <p className="text-xs text-white/60 truncate">
                      {career.team.name} ({career.team.div} · OVR {career.team.ovr}) · {career.pos}{' '}
                      · <span className="text-white/90 font-medium">{career.role}</span> ·{' '}
                      {career.career}
                    </p>
                  </div>
                </div>

                {/* Right HUD Metrics with Animated OVR + XP Progress */}
                <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div
                    key={`ovr-box-${ovrToast?.id ?? 'static'}`}
                    className={`relative rounded-2xl p-3.5 border text-center ${
                      displayedOvr >= 99
                        ? 'bg-gradient-to-b from-amber-400/25 to-amber-500/10 border-amber-400/50'
                        : 'bg-[#111117] border-white/[0.08]'
                    } ${ovrToast ? 'leyendas-ovr-pop' : ''}`}
                  >
                    {ovrToast && (
                      <span
                        key={ovrToast.id}
                        className={`leyendas-delta-float absolute -top-3 right-2 px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${
                          ovrToast.tone === 'levelup'
                            ? 'bg-amber-300 text-[#050507]'
                            : ovrToast.tone === 'xp'
                            ? 'bg-emerald-400 text-[#050507]'
                            : 'bg-rose-500 text-white'
                        }`}
                      >
                        {ovrToast.label}
                      </span>
                    )}
                    <p className="text-[11px] text-white/50">
                      {ovrTier?.label ?? 'OVR actual'}
                    </p>
                    <p
                      className={`text-3xl sm:text-4xl font-semibold tabular-nums leading-none mt-1 ${
                        displayedOvr >= 99 ? 'text-amber-300' : 'text-white'
                      }`}
                    >
                      {displayedOvr}
                    </p>
                    {/* Live OVR XP Progress Bar */}
                    <div className="mt-2.5 space-y-1">
                      <div className="h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            displayedOvr >= 99
                              ? 'bg-amber-300'
                              : 'bg-gradient-to-r from-[#707ef9] to-[#a5b0ff]'
                          }`}
                          style={{ width: `${ovrXpPct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-white/45 tabular-nums">
                        {career.ovr >= ovrCap
                          ? `Techo ${ovrCap}`
                          : `${career.ovrProgress ?? 0}/${ovrXpReq} XP`}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#111117] border border-white/[0.08] p-3.5 text-center flex flex-col justify-center">
                    <p className="text-[11px] text-white/50">Avance</p>
                    <p className="text-2xl sm:text-3xl font-semibold text-white tabular-nums leading-none mt-1.5">
                      {career.semestersPlayed}/{career.totalSemesters}
                    </p>
                    <p className="text-[11px] text-white/45 mt-1.5">semestres</p>
                  </div>

                  <div className="rounded-2xl bg-[#111117] border border-white/[0.08] p-3.5 text-center flex flex-col justify-center">
                    <p className="text-[11px] text-white/50">Palmarés</p>
                    <p className="text-2xl sm:text-3xl font-semibold text-amber-300 tabular-nums leading-none mt-1.5">
                      {career.trophies.length}
                    </p>
                    <p className="text-[11px] text-white/45 mt-1.5 tabular-nums">
                      {career.awards.length} premios
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#111117] border border-white/[0.08] p-3.5 text-center flex flex-col justify-center">
                    <p className="text-[11px] text-white/50">Sel. UFRO</p>
                    <p className="text-2xl sm:text-3xl font-semibold text-[#c8ceff] tabular-nums leading-none mt-1.5">
                      {career.caps}
                    </p>
                    <p className="text-[11px] text-white/45 mt-1.5">partidos</p>
                  </div>
                </div>
              </div>

              {/* Active Injury Alert Strip */}
              {career.activeInjury && (
                <div className="rounded-2xl bg-rose-500/[0.1] border border-rose-400/35 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2.5 text-rose-200">
                    <Activity className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>
                      <strong className="text-white font-medium">
                        Lesión activa ({career.activeInjury.severity}): {career.activeInjury.name}
                      </strong>{' '}
                      — {career.activeInjury.description}
                    </span>
                  </div>
                  <span className="text-rose-300">Clínica Kinesiológica UFRO</span>
                </div>
              )}

              {/* Bottom HUD Strip: Academic + Physical + Momentum + Recurring Rival */}
              <div className="pt-4 border-t border-white/[0.08] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                {academicHint && (
                  <div className="flex items-start gap-2.5">
                    <GraduationCap
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        academicHint.tone === 'good'
                          ? 'text-emerald-400'
                          : academicHint.tone === 'warn'
                          ? 'text-amber-300'
                          : academicHint.tone === 'danger'
                          ? 'text-rose-400'
                          : 'text-[#a5b0ff]'
                      }`}
                    />
                    <div>
                      <p className="font-medium text-white">Académico · {academicHint.label}</p>
                      <p className="text-white/50 mt-0.5 leading-snug">{academicHint.detail}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2.5">
                  <Activity
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      career.activeInjury
                        ? 'text-rose-400'
                        : career.injuryRisk >= 45
                        ? 'text-amber-300'
                        : 'text-emerald-400'
                    }`}
                  />
                  <div>
                    <p className="font-medium text-white">
                      Físico ·{' '}
                      {career.activeInjury
                        ? `Lesionado (${career.activeInjury.severity})`
                        : career.injuryRisk >= 45
                        ? 'Fatiga alta'
                        : career.injuryRisk >= 25
                        ? 'Carga media'
                        : 'Óptimo'}
                    </p>
                    <p className="text-white/50 mt-0.5 tabular-nums">
                      Carga: {career.injuryRisk}% · Lesiones: {career.injuriesCount}
                    </p>
                  </div>
                </div>

                {momentumInfo && (
                  <div className="flex items-start gap-2.5">
                    <Flame className={`w-4 h-4 shrink-0 mt-0.5 ${momentumInfo.colorClass}`} />
                    <div>
                      <p className="font-medium text-white">Momento actual</p>
                      <p className={`mt-0.5 ${momentumInfo.colorClass}`}>{momentumInfo.label}</p>
                    </div>
                  </div>
                )}

                {career.rival && (
                  <div className="flex items-start gap-2.5">
                    <Swords className="w-4 h-4 text-[#a5b0ff] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">
                        Rival · {career.rival.name}
                      </p>
                      <p className="text-white/50 mt-0.5 tabular-nums truncate">
                        {career.rival.clubName} ({career.rival.ovr}) · {career.rival.h2hWins}G–
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
                <div className="rounded-3xl bg-[#0c0c10] border border-white/[0.1] p-6 sm:p-8 space-y-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-white/[0.08] pb-6">
                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-1.5 text-xs text-amber-300">
                        <Crown className="w-4 h-4" />
                        <span>Legado final · Categoría {legacyBanner.tier}</span>
                      </span>
                      <h3 className="text-3xl sm:text-4xl font-medium tracking-[-0.03em] text-white">
                        {legacyBanner.title}
                      </h3>
                      <p className="text-sm text-white/65 max-w-2xl leading-relaxed">
                        {legacyBanner.subtitle}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-[#111117] border border-white/[0.1] px-6 py-4 text-center shrink-0">
                      <p className="text-xs text-[#a5b0ff]">Puntaje oficial semanal</p>
                      <p className="text-4xl font-semibold text-white tabular-nums mt-1">
                        {finalScore.toLocaleString('es-CL')}
                      </p>
                      <p className="text-xs text-white/45 mt-1 tabular-nums">
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
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#707ef9] hover:bg-[#5e6df5] text-white text-xs sm:text-sm font-medium transition-colors cursor-pointer disabled:opacity-60"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {submittedGlobal
                            ? 'Guardado en el Top Global Semanal'
                            : submittingGlobal
                            ? 'Guardando en ranking semanal...'
                            : submitError
                            ? 'Reintentar guardado en Top Global'
                            : 'Publicar en Top Global Semanal'}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onOpenAuth}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#707ef9] hover:bg-[#5e6df5] text-white text-xs sm:text-sm font-medium transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>Inicia sesión con Google para guardar en el Top Global</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowPoster(true)}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-white text-xs sm:text-sm font-medium transition-colors cursor-pointer"
                    >
                      <ImageIcon className="w-4 h-4 text-[#a5b0ff]" />
                      <span>Tarjeta final PNG (1080×1920)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetToCreation}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] text-white/80 hover:text-white text-xs sm:text-sm font-medium transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Jugar otra carrera</span>
                    </button>
                  </div>

                  {submitError && (
                    <div
                      role="alert"
                      className="rounded-2xl bg-rose-500/[0.1] border border-rose-400/35 px-4 py-3 text-xs text-rose-200"
                    >
                      {submitError}
                    </div>
                  )}

                  {/* Trophy Cabinet + Individual Awards + Stints */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-2">
                    <div className="rounded-2xl border border-white/[0.08] bg-[#111117] p-5 space-y-3">
                      <h4 className="text-base font-medium text-white flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-300" />
                        <span>Vitrina de títulos ({career.trophies.length})</span>
                      </h4>
                      {career.trophies.length === 0 ? (
                        <p className="text-xs text-white/45">Sin títulos colectivos en esta carrera.</p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {career.trophies.map((t) => (
                            <div
                              key={t.id}
                              className="rounded-xl bg-[#09090d] border border-white/[0.06] p-2.5 flex items-center gap-2.5 text-xs"
                            >
                              <LeyendasTrophyIcon title={t.title} kind="trophy" size="sm" />
                              <div className="min-w-0">
                                <p className="font-medium text-white truncate">{t.title}</p>
                                <p className="text-white/45 truncate">
                                  {t.year} · {t.team}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-white/[0.08] bg-[#111117] p-5 space-y-3">
                      <h4 className="text-base font-medium text-white flex items-center gap-2">
                        <Award className="w-4 h-4 text-[#a5b0ff]" />
                        <span>Premios individuales ({career.awards.length})</span>
                      </h4>
                      {career.awards.length === 0 ? (
                        <p className="text-xs text-white/45">Sin premios individuales registrados.</p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {career.awards.map((a) => (
                            <div
                              key={a.id}
                              className="rounded-xl bg-[#09090d] border border-white/[0.06] p-2.5 flex items-center gap-2.5 text-xs"
                            >
                              <LeyendasTrophyIcon title={a.title} kind="award" size="sm" />
                              <div className="min-w-0">
                                <p className="font-medium text-white truncate">{a.title}</p>
                                <p className="text-white/45">Temporada {a.year}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-white/[0.08] bg-[#111117] p-5 space-y-3">
                      <h4 className="text-base font-medium text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#a5b0ff]" />
                        <span>Clubes defendidos ({career.stints.length})</span>
                      </h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {career.stints.map((s, idx) => (
                          <div
                            key={`${s.team}-${idx}`}
                            className="rounded-xl bg-[#09090d] border border-white/[0.06] p-2.5 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-white truncate">{s.team}</p>
                              <p className="text-white/45">{s.div}</p>
                            </div>
                            <span className="text-[11px] text-[#a5b0ff] tabular-nums shrink-0">
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
                <div className="lg:col-span-8 space-y-5">
                  {/* Clean Semester Stepper Indicator */}
                  {['FOCUS', 'EVENT', 'MIDSEMESTER', 'MOMENT', 'GAUNTLET', 'CELEBRATION'].includes(
                    semPhase
                  ) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/40 px-1">
                      {[
                        { step: 1, label: 'Enfoque' },
                        { step: 2, label: 'Evento campus' },
                        { step: 3, label: 'Medio semestre' },
                        { step: 4, label: semPhase === 'GAUNTLET' ? 'Ruta playoffs' : 'Jugada clave' },
                        { step: 5, label: 'Balance' },
                      ].map((item, idx) => (
                        <span key={item.step} className="inline-flex items-center gap-2">
                          {idx > 0 && <span className="text-white/20">·</span>}
                          <span
                            className={
                              semesterStepIndex === item.step
                                ? 'text-[#c8ceff] font-medium'
                                : semesterStepIndex > item.step
                                ? 'text-white/65'
                                : 'text-white/35'
                            }
                          >
                            {item.step}. {item.label}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* PHASE 1: FOCUS CARDS */}
                  {semPhase === 'FOCUS' && (
                    <div className="rounded-3xl bg-[#0c0c10] border border-white/[0.08] p-6 sm:p-8 space-y-6">
                      <div className="border-b border-white/[0.08] pb-5 space-y-1.5">
                        <p className="text-xs text-[#a5b0ff]">
                          {career.year} · Semestre {career.semester} · Planificación
                        </p>
                        <h3 className="text-2xl sm:text-3xl font-medium tracking-[-0.03em] text-white">
                          Elige tu enfoque de{' '}
                          <span className="font-editorial text-[#c8ceff]">semestre</span>
                        </h3>
                        <p className="text-sm text-white/60">
                          Reparte tu energía entre entrenamiento en cancha, ramos universitarios y
                          carga física para llegar entero a las definiciones.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {focusCards.map((card, idx) => {
                          const xpGain = card.ovrXpDelta ?? legacyOvrDeltaToXp(card.ovrDelta);
                          return (
                            <button
                              key={`${career.year}-${career.semester}-${card.id}`}
                              type="button"
                              onClick={() => handleChooseFocus(card)}
                              style={{ animationDelay: `${idx * 55}ms` }}
                              className="leyendas-card-deal text-left rounded-2xl border border-white/[0.08] hover:border-[#707ef9]/60 bg-[#111117] hover:bg-[#15151e] p-5 flex flex-col justify-between gap-4 transition-all cursor-pointer group"
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <span
                                    className={
                                      card.tier === 'ORO'
                                        ? 'text-amber-300 font-medium'
                                        : card.tier === 'PLATA'
                                        ? 'text-[#a5b0ff] font-medium'
                                        : 'text-white/50'
                                    }
                                  >
                                    {card.tier === 'ORO'
                                      ? 'Enfoque de élite'
                                      : card.tier === 'PLATA'
                                      ? 'Enfoque equilibrado'
                                      : 'Enfoque de soporte'}
                                  </span>
                                  <span className="tabular-nums font-medium text-emerald-300">
                                    {xpGain > 0 ? `+${xpGain} XP` : 'Foco estudio'}
                                  </span>
                                </div>
                                <h4 className="text-lg font-medium text-white group-hover:text-[#c8ceff] transition-colors">
                                  {card.title}
                                </h4>
                                <p className="text-xs text-white/55">{card.subtitle}</p>
                              </div>
                              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2 text-[11px] text-white/45">
                                <span>{card.flair}</span>
                                <ArrowRight className="w-3.5 h-3.5 shrink-0 text-white/35 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* PHASE 2: CAMPUS / CAREER / INJURY EVENT */}
                  {semPhase === 'EVENT' && activeEvent && (
                    <div
                      key={activeEvent.id}
                      className="rounded-3xl bg-[#0c0c10] border border-white/[0.08] p-6 sm:p-8 space-y-6 leyendas-card-deal"
                    >
                      <div className="border-b border-white/[0.08] pb-5 space-y-2">
                        <p
                          className={`text-xs font-medium ${
                            activeEvent.category === 'LESION'
                              ? 'text-rose-300'
                              : activeEvent.category === 'CARRERA'
                              ? 'text-[#a5b0ff]'
                              : 'text-amber-300'
                          }`}
                        >
                          {activeEvent.tag}
                        </p>
                        <h3 className="text-2xl sm:text-3xl font-medium tracking-[-0.03em] text-white">
                          {activeEvent.title}
                        </h3>
                        <p className="text-sm text-white/65 leading-relaxed">
                          {activeEvent.description}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        {activeEvent.options.map((opt, idx) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleChooseEventOption(opt)}
                            style={{ animationDelay: `${idx * 55}ms` }}
                            className="leyendas-card-deal text-left p-5 rounded-2xl bg-[#111117] hover:bg-[#161620] border border-white/[0.08] hover:border-[#707ef9]/60 transition-all cursor-pointer flex items-center justify-between gap-4 group"
                          >
                            <div className="space-y-1">
                              <p className="text-base font-medium text-white group-hover:text-[#c8ceff] transition-colors">
                                {opt.label}
                              </p>
                              <p className="text-xs text-[#a5b0ff]/90">{opt.hint}</p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-white/35 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PHASE 2B: MID-SEMESTER DYNAMIC CROSSROADS (SELECCIÓN UFRO VS PASE DE FASE) */}
                  {semPhase === 'MIDSEMESTER' && activeMidDilemma && (
                    <div
                      key={activeMidDilemma.id}
                      className="rounded-3xl bg-[#0c0c10] border border-[#707ef9]/35 p-6 sm:p-8 space-y-6 leyendas-card-deal"
                      data-midsemester-kind={activeMidDilemma.kind}
                    >
                      {eventResult && (
                        <div className="rounded-2xl bg-[#111117] border border-white/[0.06] px-4 py-3 text-xs text-white/65">
                          <span className="text-white/90 font-medium">Evento anterior:</span>{' '}
                          {eventResult.narrative}
                        </div>
                      )}

                      <div className="border-b border-white/[0.08] pb-5 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-amber-300">
                          <Compass className="w-3.5 h-3.5 shrink-0" />
                          <span>{activeMidDilemma.kicker}</span>
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-medium tracking-[-0.03em] text-white">
                          {activeMidDilemma.title}
                        </h3>
                        <p className="text-sm text-white/70 leading-relaxed">
                          {activeMidDilemma.description}
                        </p>
                        <p className="text-xs text-[#a5b0ff]">{activeMidDilemma.stakesLabel}</p>
                      </div>

                      <div className="grid grid-cols-1 gap-3.5">
                        {activeMidDilemma.options.map((opt, idx) => {
                          const tagColor =
                            opt.riskTag === 'SELECCIÓN'
                              ? 'text-[#a5b0ff]'
                              : opt.riskTag === 'DOBLE FRENTE'
                              ? 'text-amber-300'
                              : opt.riskTag === 'CLUB'
                              ? 'text-emerald-300'
                              : 'text-white/70';

                          return (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={opt.disabled}
                              onClick={() => handleChooseMidSemesterOption(opt)}
                              style={{ animationDelay: `${idx * 60}ms` }}
                              className={`leyendas-card-deal text-left p-5 rounded-2xl border transition-all flex flex-col gap-3 ${
                                opt.disabled
                                  ? 'bg-[#09090d] border-white/[0.05] opacity-55 cursor-not-allowed'
                                  : 'bg-[#111117] hover:bg-[#161622] border-white/[0.08] hover:border-[#707ef9]/65 cursor-pointer group'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <span className={`font-medium ${tagColor}`}>{opt.badge}</span>
                                <span className="text-white/55 tabular-nums">
                                  Éxito +{opt.successXp} XP
                                  {opt.capsGainSuccess > 0 ? ` · +${opt.capsGainSuccess} caps` : ''}
                                  {opt.injuryRiskDelta > 0
                                    ? ` · +${opt.injuryRiskDelta}% carga`
                                    : ''}
                                </span>
                              </div>
                              <div>
                                <p className="text-base font-medium text-white group-hover:text-[#c8ceff] transition-colors">
                                  {opt.label}
                                </p>
                                <p className="text-xs text-white/60 mt-1 leading-relaxed">
                                  {opt.summary}
                                </p>
                              </div>
                              {opt.disabled && opt.disabledReason && (
                                <p className="text-xs text-rose-300">{opt.disabledReason}</p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* PHASE 3A: STANDARD VISUAL MINI-GAME */}
                  {semPhase === 'MOMENT' && activeMiniGame && (
                    <div className="space-y-4">
                      {midResolution ? (
                        <div
                          className={`rounded-2xl border px-4 py-3.5 text-xs leading-relaxed leyendas-card-deal ${
                            midResolution.success
                              ? 'bg-emerald-500/[0.08] border-emerald-400/30 text-emerald-100'
                              : 'bg-rose-500/[0.08] border-rose-400/30 text-rose-100'
                          }`}
                        >
                          <p className="font-medium text-white">{midResolution.headline}</p>
                          <p className="text-white/70 mt-0.5">{midResolution.narrative}</p>
                        </div>
                      ) : (
                        eventResult && (
                          <div className="rounded-2xl bg-[#0c0c10] border border-white/[0.08] px-4 py-3.5 text-xs text-white/65 leyendas-card-deal">
                            <span className="text-white font-medium">Resultado del evento:</span>{' '}
                            {eventResult.narrative}
                          </div>
                        )
                      )}

                      <LeyendasMiniGame
                        scenario={activeMiniGame}
                        onComplete={handleCompleteMiniGame}
                      />
                    </div>
                  )}

                  {/* PHASE 3B: RARE SPECIAL LONG ACTIVITY — PLAYOFF ELIMINATION GAUNTLET */}
                  {semPhase === 'GAUNTLET' && activeGauntlet && (
                    <div className="space-y-4">
                      {midResolution && (
                        <div
                          className={`rounded-2xl border px-4 py-3.5 text-xs leading-relaxed leyendas-card-deal ${
                            midResolution.success
                              ? 'bg-emerald-500/[0.08] border-emerald-400/30 text-emerald-100'
                              : 'bg-rose-500/[0.08] border-rose-400/30 text-rose-100'
                          }`}
                        >
                          <p className="font-medium text-white">{midResolution.headline}</p>
                          <p className="text-white/70 mt-0.5">{midResolution.narrative}</p>
                        </div>
                      )}

                      <LeyendasPlayoffGauntletView
                        gauntlet={activeGauntlet}
                        onComplete={handleCompleteGauntlet}
                      />
                    </div>
                  )}

                  {/* PHASE 4: SEMESTER CELEBRATION & SUMMARY */}
                  {semPhase === 'CELEBRATION' && career.lastSemesterCelebration && (
                    <div className="rounded-3xl bg-[#0c0c10] border border-white/[0.08] p-6 sm:p-8 space-y-6 leyendas-card-deal">
                      {momentNarrative && (
                        <div className="rounded-2xl bg-[#111117] border border-white/[0.06] px-4 py-3.5 text-xs text-white/70 leading-relaxed">
                          <span className="text-white font-medium">Jugada decisiva:</span>{' '}
                          {momentNarrative}
                        </div>
                      )}

                      <div
                        className={`rounded-2xl p-6 space-y-3 border ${
                          career.lastSemesterCelebration.trophiesWon.length > 0
                            ? 'bg-gradient-to-br from-amber-500/[0.12] via-[#111117] to-[#707ef9]/[0.1] border-amber-400/40'
                            : 'bg-[#111117] border-white/[0.08]'
                        }`}
                      >
                        <p className="text-xs text-[#a5b0ff]">
                          Cierre de semestre · Balance oficial
                          {career.lastSemesterCelebration.gauntletBadge
                            ? ` · ${career.lastSemesterCelebration.gauntletBadge}`
                            : ''}
                        </p>
                        <h3 className="text-2xl sm:text-3xl font-medium tracking-[-0.03em] text-white">
                          {career.lastSemesterCelebration.headline}
                        </h3>
                        <p className="text-sm text-white/70 leading-relaxed">
                          {career.lastSemesterCelebration.subheadline}
                        </p>

                        <div className="space-y-1.5 pt-1 text-xs">
                          {career.lastSemesterCelebration.injuryNote && (
                            <p className="text-rose-300 font-medium">
                              ✚ {career.lastSemesterCelebration.injuryNote}
                            </p>
                          )}
                          {career.lastSemesterCelebration.promoted && (
                            <p className="text-emerald-300 font-medium">
                              ↑ {career.lastSemesterCelebration.promoted}
                            </p>
                          )}
                          {career.lastSemesterCelebration.relegated && (
                            <p className="text-rose-300 font-medium">
                              ↓ {career.lastSemesterCelebration.relegated}
                            </p>
                          )}
                          {career.lastSemesterCelebration.seleccionUfro && (
                            <p className="text-[#c8ceff] font-medium">
                              ★ {career.lastSemesterCelebration.seleccionUfro}
                            </p>
                          )}
                        </div>
                      </div>

                      {(career.lastSemesterCelebration.trophiesWon.length > 0 ||
                        career.lastSemesterCelebration.awardsWon.length > 0) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {career.lastSemesterCelebration.trophiesWon.map((t) => (
                            <div
                              key={t.id}
                              className="rounded-2xl border border-amber-400/30 bg-amber-500/[0.08] p-4 flex items-center gap-3"
                            >
                              <LeyendasTrophyIcon title={t.title} kind="trophy" size="md" />
                              <div>
                                <p className="text-[11px] text-amber-300 font-medium">
                                  Nuevo título
                                </p>
                                <p className="text-sm font-medium text-white">{t.title}</p>
                              </div>
                            </div>
                          ))}
                          {career.lastSemesterCelebration.awardsWon.map((a) => (
                            <div
                              key={a.id}
                              className="rounded-2xl border border-[#707ef9]/35 bg-[#707ef9]/[0.09] p-4 flex items-center gap-3"
                            >
                              <LeyendasTrophyIcon title={a.title} kind="award" size="md" />
                              <div>
                                <p className="text-[11px] text-[#a5b0ff] font-medium">
                                  Premio individual
                                </p>
                                <p className="text-sm font-medium text-white">{a.title}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        id="btn-celebration-continue"
                        onClick={handleContinueAfterCelebration}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#707ef9] hover:bg-[#5e6df5] text-white text-sm font-medium transition-colors cursor-pointer"
                      >
                        <span>
                          {career.pendingPostgradOption
                            ? 'Revisar opción de postgrado'
                            : career.pendingLoanOffers.length > 0
                            ? 'Ver ofertas de préstamo S2'
                            : career.pendingReleaseNotice
                            ? 'Reunión con el DT'
                            : career.pendingTransferOffers.length > 0
                            ? 'Abrir mercado de pases'
                            : 'Avanzar al siguiente semestre'}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* PHASE 5: LOAN CHOICE */}
                  {semPhase === 'LOAN' && (
                    <div className="rounded-3xl bg-[#0c0c10] border border-white/[0.08] p-6 sm:p-8 space-y-6 leyendas-card-deal">
                      <div className="border-b border-white/[0.08] pb-5 space-y-1.5">
                        <p className="text-xs text-[#a5b0ff]">
                          Ventana especial · Préstamo de playoffs
                        </p>
                        <h3 className="text-2xl sm:text-3xl font-medium tracking-[-0.03em] text-white">
                          Clubes clasificados te buscan a préstamo
                        </h3>
                        <p className="text-sm text-white/60">
                          Puedes jugar el Semestre 2 a préstamo con un candidato al título y volver
                          a {career.team.name} al finalizar el año.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {career.pendingLoanOffers.map((club) => (
                          <div
                            key={club.id}
                            className="rounded-2xl bg-[#111117] border border-white/[0.08] p-4 space-y-4"
                          >
                            <div className="flex items-center gap-3">
                              <TeamCrest
                                escudo={club.escudo}
                                sigla={club.sigla}
                                nombre={club.name}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <p className="text-base font-medium text-white truncate">
                                  {club.name}
                                </p>
                                <p className="text-xs text-white/50">
                                  {club.div} · OVR {club.ovr}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleLoanDecision(club)}
                              className="w-full py-2.5 rounded-full bg-[#707ef9] hover:bg-[#5e6df5] text-white text-xs font-medium transition-colors cursor-pointer"
                            >
                              Aceptar préstamo S2
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleLoanDecision(null)}
                        className="px-5 py-2.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-xs font-medium text-white/80 cursor-pointer"
                      >
                        Quedarme entrenando en {career.team.name}
                      </button>
                    </div>
                  )}

                  {/* PHASE 5B: COACH NON-RENEWAL */}
                  {semPhase === 'RELEASED' && career.pendingReleaseNotice && (
                    <div className="rounded-3xl bg-[#0c0c10] border border-white/[0.08] p-6 sm:p-8 space-y-6 leyendas-card-deal">
                      <div className="rounded-2xl bg-rose-500/[0.08] border border-rose-400/35 p-6 space-y-3 leyendas-shake">
                        <div className="flex items-center gap-2 text-xs text-rose-300">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Decisión del cuerpo técnico · {career.team.name}</span>
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-medium tracking-[-0.03em] text-white">
                          El DT no cuenta contigo para la próxima temporada
                        </h3>
                        <p className="text-sm text-white/80 italic">
                          {career.pendingReleaseNotice.coachQuote}
                        </p>
                        <p className="text-xs text-white/55 pt-1">
                          — <strong className="text-white">{career.pendingReleaseNotice.coachName}</strong>{' '}
                          · {career.pendingReleaseNotice.reason}
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="border-b border-white/[0.08] pb-3">
                          <h4 className="text-xl font-medium text-white">
                            Agente libre · Elige tu nuevo club
                          </h4>
                          <p className="text-xs text-white/55 mt-0.5">
                            Firma con uno de estos equipos interesados para disputar la temporada{' '}
                            {career.year}.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          {career.pendingTransferOffers.map((offer, idx) => (
                            <div
                              key={offer.id}
                              style={{ animationDelay: `${idx * 55}ms` }}
                              className="leyendas-card-deal rounded-2xl bg-[#111117] border border-white/[0.08] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <TeamCrest
                                  escudo={offer.club.escudo}
                                  sigla={offer.club.sigla}
                                  nombre={offer.club.name}
                                  size="md"
                                />
                                <div className="min-w-0">
                                  <p className="text-xs text-[#a5b0ff]">
                                    {offer.tag} · {offer.club.div} · OVR {offer.club.ovr}
                                  </p>
                                  <h4 className="text-lg font-medium text-white truncate">
                                    {offer.club.name}
                                  </h4>
                                  <p className="text-xs text-white/55">{offer.pitch}</p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleTransferDecision(offer.club)}
                                className="px-4 py-2.5 rounded-full bg-[#707ef9] hover:bg-[#5e6df5] text-white text-xs font-medium shrink-0 cursor-pointer"
                              >
                                Firmar ({offer.rolePromise})
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PHASE 6: TRANSFER MARKET */}
                  {semPhase === 'TRANSFER' && (
                    <div className="rounded-3xl bg-[#0c0c10] border border-white/[0.08] p-6 sm:p-8 space-y-6 leyendas-card-deal">
                      <div className="border-b border-white/[0.08] pb-5 space-y-1">
                        <p className="text-xs text-[#a5b0ff]">
                          Mercado de pases Intercarreras · Temporada {career.year}
                        </p>
                        <h3 className="text-2xl sm:text-3xl font-medium tracking-[-0.03em] text-white">
                          Ofertas sobre la mesa
                        </h3>
                        <p className="text-sm text-white/60">
                          Puedes aceptar un traspaso o renovar lealtad con {career.team.name}.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        {career.pendingTransferOffers.map((offer, idx) => (
                          <div
                            key={offer.id}
                            style={{ animationDelay: `${idx * 55}ms` }}
                            className="leyendas-card-deal rounded-2xl bg-[#111117] border border-white/[0.08] hover:border-[#707ef9]/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <TeamCrest
                                escudo={offer.club.escudo}
                                sigla={offer.club.sigla}
                                nombre={offer.club.name}
                                size="md"
                              />
                              <div className="min-w-0">
                                <p
                                  className={`text-xs font-medium ${
                                    offer.tag === 'TRAICIÓN'
                                      ? 'text-rose-300'
                                      : offer.tag === 'SALTO DE DIVISIÓN'
                                      ? 'text-emerald-300'
                                      : 'text-[#a5b0ff]'
                                  }`}
                                >
                                  {offer.tag} · {offer.club.div} · OVR {offer.club.ovr}
                                </p>
                                <h4 className="text-lg font-medium text-white truncate">
                                  {offer.club.name}
                                </h4>
                                <p className="text-xs text-white/55">{offer.pitch}</p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleTransferDecision(offer.club)}
                              className="px-4 py-2.5 rounded-full bg-[#707ef9] hover:bg-[#5e6df5] text-white text-xs font-medium shrink-0 cursor-pointer"
                            >
                              Fichar ({offer.rolePromise})
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleTransferDecision(null)}
                        className="px-5 py-2.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-xs font-medium text-white/85 cursor-pointer"
                      >
                        Renovar en {career.team.name} (Lealtad al club)
                      </button>
                    </div>
                  )}

                  {/* PHASE 7: POSTGRAD EXTENSION */}
                  {semPhase === 'POSTGRAD' && career.pendingPostgradOption && (
                    <div className="rounded-3xl bg-[#0c0c10] border border-amber-400/35 p-6 sm:p-8 space-y-6 leyendas-card-deal">
                      <div className="space-y-2">
                        <p className="text-xs text-amber-300">Ceremonia de egreso UFRO</p>
                        <h3 className="text-2xl sm:text-3xl font-medium tracking-[-0.03em] text-white">
                          {career.pendingPostgradOption === 'MAGISTER'
                            ? '¡Clasificaste a Magíster UFRO (+2 años)!'
                            : '¡Beca de Doctorado UFRO disponible (+3 años)!'}
                        </h3>
                        <p className="text-sm text-white/65 leading-relaxed">
                          Tu rendimiento académico y deportivo te permite extender tu carrera
                          universitaria para seguir persiguiendo títulos y acercarte al límite de OVR.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => handlePostgradDecision(true)}
                          className="px-5 py-3.5 rounded-full bg-[#707ef9] hover:bg-[#5e6df5] text-white text-sm font-medium cursor-pointer"
                        >
                          Continuar con {career.pendingPostgradOption}
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePostgradDecision(false)}
                          className="px-5 py-3.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-white text-sm font-medium cursor-pointer"
                        >
                          Retirarme y ver legado final
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Sidebar: Live Stats + Timeline (4 cols) */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="rounded-3xl bg-[#0c0c10] border border-white/[0.08] p-5 sm:p-6 space-y-4">
                    <h4 className="text-base font-medium text-white border-b border-white/[0.08] pb-3">
                      Estadísticas de carrera
                    </h4>
                    <div className="grid grid-cols-3 gap-2.5 text-center tabular-nums">
                      <div className="rounded-2xl bg-[#111117] border border-white/[0.06] p-3">
                        <p className="text-[11px] text-white/45">PJ</p>
                        <p className="text-2xl font-semibold text-white mt-0.5">{career.stats.m}</p>
                      </div>
                      {career.sportKey === 'futbol' ? (
                        <>
                          <div className="rounded-2xl bg-[#111117] border border-white/[0.06] p-3">
                            <p className="text-[11px] text-white/45">Goles</p>
                            <p className="text-2xl font-semibold text-[#c8ceff] mt-0.5">
                              {career.stats.g}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-[#111117] border border-white/[0.06] p-3">
                            <p className="text-[11px] text-white/45">Asist.</p>
                            <p className="text-2xl font-semibold text-white mt-0.5">
                              {career.stats.a}
                            </p>
                          </div>
                        </>
                      ) : career.sportKey === 'basquet' ? (
                        <>
                          <div className="rounded-2xl bg-[#111117] border border-white/[0.06] p-3">
                            <p className="text-[11px] text-white/45">Pts</p>
                            <p className="text-2xl font-semibold text-[#c8ceff] mt-0.5">
                              {career.stats.pts}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-[#111117] border border-white/[0.06] p-3">
                            <p className="text-[11px] text-white/45">Reb/Ast</p>
                            <p className="text-lg font-semibold text-white mt-1">
                              {career.stats.reb}/{career.stats.ast}
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="rounded-2xl bg-[#111117] border border-white/[0.06] p-3">
                            <p className="text-[11px] text-white/45">Pts</p>
                            <p className="text-2xl font-semibold text-[#c8ceff] mt-0.5">
                              {career.stats.pts}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-[#111117] border border-white/[0.06] p-3">
                            <p className="text-[11px] text-white/45">Blq/Ace</p>
                            <p className="text-lg font-semibold text-white mt-1">
                              {career.stats.blk}/{career.stats.ace}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Bitácora Cronológica */}
                  <div className="rounded-3xl bg-[#0c0c10] border border-white/[0.08] p-5 sm:p-6 space-y-4">
                    <h4 className="text-base font-medium text-white border-b border-white/[0.08] pb-3">
                      Bitácora de carrera
                    </h4>
                    <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                      {career.timeline.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-white/[0.06] bg-[#111117] p-3.5 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span
                              className={
                                item.tone === 'gold'
                                  ? 'text-amber-300 font-medium'
                                  : item.tone === 'danger'
                                  ? 'text-rose-300 font-medium'
                                  : 'text-[#a5b0ff] font-medium'
                              }
                            >
                              {item.badge}
                            </span>
                            <span className="text-white/40 tabular-nums">
                              {item.year} · S{item.semester}
                            </span>
                          </div>
                          <p className="font-medium text-white">{item.title}</p>
                          <p className="text-white/55 leading-snug">{item.detail}</p>
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
        <section className="rounded-3xl bg-[#0c0c10] border border-white/[0.08] p-6 sm:p-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
            <div className="min-w-0 space-y-1">
              <p className="text-xs text-[#a5b0ff]">Ranking semanal · {weekInfo.label}</p>
              <h2 className="text-2xl sm:text-3xl font-medium tracking-[-0.03em] text-white">
                Top global{' '}
                <span className="font-editorial text-[#c8ceff]">Leyendas</span>
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
                  onClick={() => setRankingTab(tab.id)}
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
                Completa una carrera en Leyendas y publícala con tu cuenta de Google para inaugurar
                el Top Global de {weekInfo.label}.
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
                      onClick={() => setInspectedEntry(entry)}
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
                onClick={() => setInspectedEntry(null)}
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
    </div>
  );
}
