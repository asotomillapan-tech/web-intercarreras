import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Lock,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  Upload,
  UserCog,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
import {
  ALL_USER_ROLES,
  BOOTSTRAPPED_ADMIN_EMAIL,
  canAccessAdminPanel,
  canManageFormatAndSheets,
  canManageRoles,
  ROLE_META,
  validateRoleChange,
} from '../domain/rbacEngine';
import { isVolleyballSetWon } from '../domain/tournamentEngine';
import {
  getFirebaseIdToken,
  getGoogleAccessToken,
  initGoogleAuth,
  signInWithGoogleSheets,
  signOutGoogle,
} from '../services/firebaseAuth';
import {
  TEMPLATE_TABS,
  buildTemplateSheetPayloads,
  createMasterGoogleSheet,
  downloadTemplateCsv,
  syncStateToExistingSpreadsheet,
  type SheetSyncSummary,
} from '../services/googleSheets';
import type {
  AiScoresheetResult,
  AppUserProfile,
  DisciplineFormatConfig,
  DisciplineId,
  Match,
  MatchEvent,
  TournamentStage,
  TournamentState,
  UserRole,
} from '../types/tournament';
import { ConfirmDialog } from './ConfirmDialog';

export type PanelSubTab = 'arbitro' | 'usuarios' | 'formato' | 'sheets';

interface AdminRefereeViewProps {
  state: TournamentState;
  currentUser: AppUserProfile | null;
  initialSubTab?: PanelSubTab;
  focusedMatchId?: string | null;
  onUpdateMatch: (match: Match, scorerPlayerId?: string, statDelta?: Partial<{ goles: number; tarjetasAmarillas: number; tarjetasRojas: number; puntos: number; triples: number; faltas: number; aces: number; bloqueos: number }>) => void;
  onUpdateConfig: (disciplineId: DisciplineId, config: DisciplineFormatConfig, rebuildGroups: boolean) => void;
  onMarkSynced: (spreadsheetId: string) => void;
  onAdminChangeUserRole: (
    targetUid: string,
    nextRole: UserRole,
    delegatedTeamId?: string,
    linkedPlayerId?: string
  ) => Promise<void> | void;
  onRefreshUsers?: () => Promise<void> | void;
  onOpenAuth: () => void;
}

/**
 * Generates a clean official match scoresheet PNG on an offscreen canvas
 * so referees can immediately test the real server-side Gemini Vision pipeline.
 */
function renderSampleScoresheetImage(params: {
  disciplineName: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  periodsText: string;
  injectDiscrepancy: boolean;
}): string {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 600;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#faf9f5';
  ctx.fillRect(0, 0, 900, 600);

  ctx.strokeStyle = '#0d0d0d';
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, 852, 552);

  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(24, 24, 852, 80);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('PLANILLA OFICIAL · CAMPEONATO INTERCARRERAS UFRO', 48, 72);

  ctx.fillStyle = '#0d0d0d';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`DISCIPLINA: ${params.disciplineName.toUpperCase()}`, 48, 148);
  ctx.font = '18px monospace';
  ctx.fillText(`FECHA: ${new Date().toISOString().slice(0, 10)}   SEDE: UNIVERSIDAD DE LA FRONTERA`, 48, 182);

  // Scoreboard Box
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 215, 804, 155);

  const writtenHome = params.injectDiscrepancy ? params.homeScore + 1 : params.homeScore;
  const writtenAway = params.awayScore;

  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`LOCAL: ${params.homeTeam}`, 70, 265);
  ctx.fillText(`VISITA: ${params.awayTeam}`, 70, 330);

  ctx.fillStyle = '#1d4ed8';
  ctx.font = 'bold 42px monospace';
  ctx.fillText(String(writtenHome), 740, 272);
  ctx.fillText(String(writtenAway), 740, 338);

  ctx.fillStyle = '#0d0d0d';
  ctx.font = '18px monospace';
  ctx.fillText(`PARCIALES: ${params.periodsText || 'Tiempo reglamentario completo'}`, 48, 418);
  ctx.fillText(
    params.injectDiscrepancy
      ? 'OBS: Corrección manuscrita en anotación local (+1)'
      : 'OBS: Encuentro disputado sin incidentes disciplinarios',
    48,
    458
  );

  // Signatures
  ctx.beginPath();
  ctx.moveTo(60, 535);
  ctx.lineTo(280, 535);
  ctx.moveTo(340, 535);
  ctx.lineTo(560, 535);
  ctx.moveTo(620, 535);
  ctx.lineTo(840, 535);
  ctx.stroke();

  ctx.font = '14px sans-serif';
  ctx.fillText('Firma Capitán Local', 100, 558);
  ctx.fillText('Firma Árbitro Oficial', 385, 558);
  ctx.fillText('Firma Capitán Visita', 665, 558);

  return canvas.toDataURL('image/png');
}

export function AdminRefereeView({
  state,
  currentUser,
  initialSubTab = 'arbitro',
  focusedMatchId = null,
  onUpdateMatch,
  onUpdateConfig,
  onMarkSynced,
  onAdminChangeUserRole,
  onRefreshUsers,
  onOpenAuth,
}: AdminRefereeViewProps) {
  const isAdmin = canManageRoles(currentUser);
  const canManageAdminTabs = canManageFormatAndSheets(currentUser);
  const [subTab, setSubTab] = useState<PanelSubTab>(
    isAdmin ? initialSubTab : 'arbitro'
  );

  // Admin User & Role Management State
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [roleDrafts, setRoleDrafts] = useState<
    Record<string, { role: UserRole; delegatedTeamId: string; linkedPlayerId: string }>
  >({});
  const [roleSavingUid, setRoleSavingUid] = useState<string | null>(null);
  const [roleStatusMsg, setRoleStatusMsg] = useState<string | null>(null);
  const [roleErrorMsg, setRoleErrorMsg] = useState<string | null>(null);

  // Referee Console State
  const [selectedRefId, setSelectedRefId] = useState<string>(state.referees[0]?.id ?? 'ref-f7-1');
  const [selectedMatchId, setSelectedMatchId] = useState<string>(
    focusedMatchId ?? state.matches.find((m) => m.status === 'EN_VIVO')?.id ?? state.matches[0]?.id ?? ''
  );
  const [selectedScorerId, setSelectedScorerId] = useState<string>('');

  // Scoresheet AI & Manual Validation State
  const [scoresheetImage, setScoresheetImage] = useState<string | null>(null);
  const [scoresheetMime, setScoresheetMime] = useState<string>('image/png');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<(AiScoresheetResult & { matchesLive?: boolean }) | null>(null);
  const [manualHome, setManualHome] = useState<string>('');
  const [manualAway, setManualAway] = useState<string>('');
  const [manualNotes, setManualNotes] = useState<string>('');
  const [validationBanner, setValidationBanner] = useState<string | null>(null);

  // Admin Format Config State
  const [configDiscId, setConfigDiscId] = useState<DisciplineId>('f7-h-1');
  const [draftConfig, setDraftConfig] = useState<DisciplineFormatConfig>(state.configs['f7-h-1']);
  const [configSavedMsg, setConfigSavedMsg] = useState<string | null>(null);

  // Google Sheets Auth & Sync State
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(getGoogleAccessToken());
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [targetSpreadsheetId, setTargetSpreadsheetId] = useState<string>(
    state.lastSyncedSpreadsheetId ?? ''
  );
  const [previewTab, setPreviewTab] = useState<(typeof TEMPLATE_TABS)[number]>('Jugadores_Plantilla');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<SheetSyncSummary | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [confirmMode, setConfirmMode] = useState<'create' | 'update' | null>(null);

  useEffect(() => {
    if (!isAdmin && initialSubTab !== 'arbitro') {
      setSubTab('arbitro');
    } else {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab, isAdmin]);

  useEffect(() => {
    if (focusedMatchId) {
      setSelectedMatchId(focusedMatchId);
      const found = state.matches.find((m) => m.id === focusedMatchId);
      if (found) {
        setSelectedRefId(found.refereeId);
        setManualHome(String(found.homeScore));
        setManualAway(String(found.awayScore));
      }
      setAiResult(null);
      setScoresheetImage(null);
      setAiError(null);
      setValidationBanner(null);
    }
  }, [focusedMatchId, state.matches]);

  useEffect(() => {
    setDraftConfig(state.configs[configDiscId]);
  }, [configDiscId, state.configs]);

  useEffect(() => {
    setConfigSavedMsg(null);
  }, [configDiscId]);

  useEffect(() => {
    const unsub = initGoogleAuth(
      (u, tok) => {
        setGoogleUser(u);
        setGoogleToken(tok);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => unsub();
  }, []);

  const teamMap = useMemo(() => new Map(state.teams.map((t) => [t.id, t])), [state.teams]);
  const activeReferee = state.referees.find((r) => r.id === selectedRefId) ?? state.referees[0];

  const refereeMatches = useMemo(() => {
    return state.matches
      .filter((m) => {
        const sport = DISCIPLINE_MAP[m.disciplineId].sportType;
        if (activeReferee.sportType === 'basquetbol') {
          return sport === 'basquetbol' || sport === 'basquetbol3x3';
        }
        return sport === activeReferee.sportType;
      })
      .sort((a, b) => {
        const w = (s: Match['status']) => (s === 'EN_VIVO' ? 0 : s === 'PROGRAMADO' ? 1 : 2);
        return w(a.status) - w(b.status);
      })
      .slice(0, 24);
  }, [state.matches, activeReferee]);

  const activeMatch: Match | undefined =
    state.matches.find((m) => m.id === selectedMatchId) ?? refereeMatches[0] ?? state.matches[0];

  const activeMatchMeta = activeMatch ? DISCIPLINE_MAP[activeMatch.disciplineId] : undefined;
  const homeTeam = activeMatch ? teamMap.get(activeMatch.homeTeamId) : undefined;
  const awayTeam = activeMatch ? teamMap.get(activeMatch.awayTeamId) : undefined;

  const matchPlayers = useMemo(() => {
    if (!activeMatch) return [];
    return state.players.filter(
      (p) => p.teamId === activeMatch.homeTeamId || p.teamId === activeMatch.awayTeamId
    );
  }, [state.players, activeMatch]);

  // Sync manual score fields when active match changes
  useEffect(() => {
    if (!activeMatch) return;
    setManualHome(String(activeMatch.homeScore));
    setManualAway(String(activeMatch.awayScore));
  }, [activeMatch?.id, activeMatch?.homeScore, activeMatch?.awayScore]);

  const handleSelectReferee = (refId: string) => {
    setSelectedRefId(refId);
    const ref = state.referees.find((r) => r.id === refId);
    if (!ref) return;
    const firstMatch = state.matches.find((m) => {
      const sport = DISCIPLINE_MAP[m.disciplineId].sportType;
      if (ref.sportType === 'basquetbol') return sport === 'basquetbol' || sport === 'basquetbol3x3';
      return sport === ref.sportType;
    });
    if (firstMatch) {
      setSelectedMatchId(firstMatch.id);
      setAiResult(null);
      setScoresheetImage(null);
      setAiError(null);
      setValidationBanner(null);
    }
  };

  // Live Scoreboard Actions per Sport
  const applyLiveAction = (
    side: 'home' | 'away',
    actionType: MatchEvent['type'],
    pointsDelta = 0
  ) => {
    if (!activeMatch || !activeMatchMeta) return;
    const teamId = side === 'home' ? activeMatch.homeTeamId : activeMatch.awayTeamId;
    const teamName = side === 'home' ? homeTeam?.nombre ?? 'Local' : awayTeam?.nombre ?? 'Visita';
    const scorer = matchPlayers.find((p) => p.id === selectedScorerId && p.teamId === teamId);
    const scorerLabel = scorer ? `${scorer.nombre} ${scorer.apellidoPaterno} (#${scorer.dorsal})` : teamName;

    let nextHome = activeMatch.homeScore;
    let nextAway = activeMatch.awayScore;
    let nextPeriods = activeMatch.periods.map((p) => ({ ...p }));
    let nextPeriodLabel = activeMatch.periodLabel;
    const nextFouls = { ...activeMatch.fouls };
    const nextTimeouts = { ...activeMatch.timeouts };
    let detail = '';

    const sport = activeMatchMeta.sportType;

    if (sport === 'futbol7') {
      if (actionType === 'GOL') {
        if (side === 'home') nextHome += 1;
        else nextAway += 1;
        detail = `Gol anotado por ${scorerLabel}`;
      } else if (actionType === 'AMARILLA') {
        detail = `Tarjeta amarilla para ${scorerLabel}`;
      } else if (actionType === 'ROJA') {
        detail = `Tarjeta roja directa para ${scorerLabel}`;
      } else if (actionType === 'FALTA') {
        if (side === 'home') nextFouls.home += 1;
        else nextFouls.away += 1;
        detail = `Falta acumulada (${teamName})`;
      }
    } else if (sport === 'basquetbol' || sport === 'basquetbol3x3') {
      if (actionType === 'PUNTO_1' || actionType === 'PUNTO_2' || actionType === 'PUNTO_3') {
        if (side === 'home') nextHome += pointsDelta;
        else nextAway += pointsDelta;
        if (nextPeriods.length === 0) nextPeriods = [{ home: 0, away: 0 }];
        const last = nextPeriods[nextPeriods.length - 1];
        if (side === 'home') last.home += pointsDelta;
        else last.away += pointsDelta;
        detail = `+${pointsDelta} pts (${actionType === 'PUNTO_3' ? 'Triple' : actionType === 'PUNTO_2' ? 'Doble' : 'Tiro libre'}) · ${scorerLabel}`;
      } else if (actionType === 'FALTA') {
        if (side === 'home') nextFouls.home += 1;
        else nextFouls.away += 1;
        detail = `Falta personal/equipo · ${scorerLabel}`;
      } else if (actionType === 'TIEMPO_MUERTO') {
        if (side === 'home') nextTimeouts.home += 1;
        else nextTimeouts.away += 1;
        detail = `Tiempo muerto solicitado por ${teamName}`;
      }
    } else {
      // Voleibol: manage current set points & automatically award set when 25/15 rule met
      if (actionType === 'PUNTO_VOLEY' || actionType === 'ACE' || actionType === 'BLOQUEO') {
        if (nextPeriods.length === 0) nextPeriods = [{ home: 0, away: 0 }];
        const setIdx = nextPeriods.length - 1;
        if (side === 'home') nextPeriods[setIdx].home += 1;
        else nextPeriods[setIdx].away += 1;

        const winner = isVolleyballSetWon(
          nextPeriods[setIdx].home,
          nextPeriods[setIdx].away,
          setIdx + 1
        );
        detail =
          actionType === 'ACE'
            ? `Ace directo de ${scorerLabel} (Set ${setIdx + 1}: ${nextPeriods[setIdx].home}-${nextPeriods[setIdx].away})`
            : actionType === 'BLOQUEO'
            ? `Bloqueo ganador de ${scorerLabel} (Set ${setIdx + 1}: ${nextPeriods[setIdx].home}-${nextPeriods[setIdx].away})`
            : `Punto de ${teamName} (Set ${setIdx + 1}: ${nextPeriods[setIdx].home}-${nextPeriods[setIdx].away})`;

        if (winner) {
          if (winner === 'home') nextHome += 1;
          else nextAway += 1;
          if (nextHome < 2 && nextAway < 2) {
            nextPeriods.push({ home: 0, away: 0 });
            nextPeriodLabel = `Set ${nextPeriods.length}`;
          } else {
            nextPeriodLabel = 'Partido definido (pendiente planilla)';
          }
        }
      } else if (actionType === 'TIEMPO_MUERTO') {
        if (side === 'home') nextTimeouts.home += 1;
        else nextTimeouts.away += 1;
        detail = `Tiempo técnico pedido por ${teamName}`;
      }
    }

    const newEvent: MatchEvent = {
      id: `ev-${Date.now()}`,
      minuteOrPeriod: activeMatch.clock === 'Por iniciar' ? nextPeriodLabel : activeMatch.clock,
      teamId,
      playerId: scorer?.id,
      playerName: scorer ? `${scorer.nombre} ${scorer.apellidoPaterno}` : undefined,
      type: actionType,
      detail,
    };

    const statDelta: Partial<{
      goles: number;
      tarjetasAmarillas: number;
      tarjetasRojas: number;
      puntos: number;
      triples: number;
      faltas: number;
      aces: number;
      bloqueos: number;
    }> = {};
    if (actionType === 'GOL') statDelta.goles = 1;
    if (actionType === 'AMARILLA') statDelta.tarjetasAmarillas = 1;
    if (actionType === 'ROJA') statDelta.tarjetasRojas = 1;
    if (actionType === 'PUNTO_1' || actionType === 'PUNTO_2' || actionType === 'PUNTO_3') {
      statDelta.puntos = pointsDelta;
      if (actionType === 'PUNTO_3') statDelta.triples = 1;
    }
    if (actionType === 'FALTA') statDelta.faltas = 1;
    if (actionType === 'PUNTO_VOLEY') statDelta.puntos = 1;
    if (actionType === 'ACE') {
      statDelta.puntos = 1;
      statDelta.aces = 1;
    }
    if (actionType === 'BLOQUEO') {
      statDelta.puntos = 1;
      statDelta.bloqueos = 1;
    }

    onUpdateMatch(
      {
        ...activeMatch,
        status: activeMatch.status === 'PROGRAMADO' ? 'EN_VIVO' : activeMatch.status,
        periodLabel: nextPeriodLabel === 'Programado' ? (sport === 'futbol7' ? '1° Tiempo' : sport === 'voleibol' ? 'Set 1' : '1° Cuarto') : nextPeriodLabel,
        clock: activeMatch.clock === 'Por iniciar' ? (sport === 'futbol7' ? "01'" : sport === 'voleibol' ? 'Set 1' : '10:00') : activeMatch.clock,
        homeScore: nextHome,
        awayScore: nextAway,
        periods: nextPeriods,
        fouls: nextFouls,
        timeouts: nextTimeouts,
        events: [newEvent, ...activeMatch.events],
      },
      scorer?.id,
      statDelta
    );
  };

  const advancePeriod = () => {
    if (!activeMatch || !activeMatchMeta) return;
    const sport = activeMatchMeta.sportType;
    let nextLabel = activeMatch.periodLabel;
    let nextClock = activeMatch.clock;
    const nextPeriods = [...activeMatch.periods];

    if (sport === 'futbol7') {
      nextLabel = activeMatch.periodLabel.includes('1°') ? '2° Tiempo' : '1° Tiempo';
      nextClock = nextLabel.includes('2°') ? "26'" : "01'";
    } else if (sport === 'basquetbol') {
      const q = Math.min(4, nextPeriods.length + 1);
      if (nextPeriods.length < 4) nextPeriods.push({ home: 0, away: 0 });
      nextLabel = `${q}° Cuarto`;
      nextClock = '10:00';
    } else if (sport === 'voleibol') {
      const s = Math.min(3, nextPeriods.length + 1);
      if (nextPeriods.length < 3) nextPeriods.push({ home: 0, away: 0 });
      nextLabel = s === 3 ? 'Set 3 (Tiebreak)' : `Set ${s}`;
      nextClock = `Set ${s}`;
    } else {
      nextLabel = 'Tiempo Regular 3x3';
      nextClock = '10:00';
    }

    onUpdateMatch({
      ...activeMatch,
      status: 'EN_VIVO',
      periodLabel: nextLabel,
      clock: nextClock,
      periods: nextPeriods,
    });
  };

  const handleScoresheetFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const rawDataUrl = reader.result;
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1400;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          const scale = MAX_DIM / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          setScoresheetMime('image/jpeg');
          setScoresheetImage(compressed);
        } else {
          setScoresheetMime(file.type || 'image/jpeg');
          setScoresheetImage(rawDataUrl);
        }
        setAiResult(null);
        setAiError(null);
        setValidationBanner(null);
      };
      img.onerror = () => {
        setScoresheetMime(file.type || 'image/png');
        setScoresheetImage(rawDataUrl);
        setAiResult(null);
        setAiError(null);
        setValidationBanner(null);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateSampleScoresheet = (injectDiscrepancy: boolean) => {
    if (!activeMatch || !activeMatchMeta) return;
    const periodsText =
      activeMatch.periods.length > 0
        ? activeMatch.periods.map((p, i) => `P${i + 1}: ${p.home}-${p.away}`).join(' | ')
        : 'Marcador final único';
    const dataUrl = renderSampleScoresheetImage({
      disciplineName: activeMatchMeta.nombre,
      homeTeam: homeTeam?.nombre ?? activeMatch.homeTeamId,
      awayTeam: awayTeam?.nombre ?? activeMatch.awayTeamId,
      homeScore: activeMatch.homeScore,
      awayScore: activeMatch.awayScore,
      periodsText,
      injectDiscrepancy,
    });
    setScoresheetMime('image/png');
    setScoresheetImage(dataUrl);
    setAiResult(null);
    setAiError(null);
    setValidationBanner(null);
  };

  const handleAnalyzeWithAI = async () => {
    if (!scoresheetImage || !activeMatch || !activeMatchMeta) return;
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    try {
      const idToken = await getFirebaseIdToken();
      if (!idToken) {
        throw new Error(
          'Tu sesión de Firebase no está activa. Inicia sesión con Google para validar planillas con IA.'
        );
      }
      const res = await fetch('/api/ai/validate-scoresheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          imageBase64: scoresheetImage,
          mimeType: scoresheetMime,
          disciplineName: activeMatchMeta.nombre,
          sportType: activeMatchMeta.sportType,
          homeTeamName: homeTeam?.nombre ?? activeMatch.homeTeamId,
          awayTeamName: awayTeam?.nombre ?? activeMatch.awayTeamId,
          liveHomeScore: activeMatch.homeScore,
          liveAwayScore: activeMatch.awayScore,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al analizar la planilla con IA.');
      }
      setAiResult(data);
      setManualHome(String(data.homeScoreDetected ?? activeMatch.homeScore));
      setManualAway(String(data.awayScoreDetected ?? activeMatch.awayScore));
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Error de red al validar la planilla.');
    } finally {
      setAiLoading(false);
    }
  };

  const finalizeMatch = (method: 'IA_AUTOMATICA' | 'MANUAL_ARBITRO') => {
    if (!activeMatch) return;
    const finalHome =
      method === 'IA_AUTOMATICA' && aiResult
        ? aiResult.homeScoreDetected
        : Math.max(0, Number(manualHome) || 0);
    const finalAway =
      method === 'IA_AUTOMATICA' && aiResult
        ? aiResult.awayScoreDetected
        : Math.max(0, Number(manualAway) || 0);

    if (method === 'MANUAL_ARBITRO' && manualNotes.trim().length < 5) {
      setAiError('Para la validación manual, ingresa una breve nota arbitral confirmando el marcador.');
      return;
    }

    onUpdateMatch({
      ...activeMatch,
      status: 'FINALIZADO',
      periodLabel: 'Finalizado',
      homeScore: finalHome,
      awayScore: finalAway,
      scoresheetValidation: {
        validatedAt: new Date().toISOString(),
        refereeName: activeReferee.nombre,
        method,
        imagePreview: scoresheetImage ?? undefined,
        aiResult: aiResult ?? undefined,
        manualNotes: method === 'MANUAL_ARBITRO' ? manualNotes.trim() : undefined,
        finalHomeScore: finalHome,
        finalAwayScore: finalAway,
      },
    });

    setAiError(null);
    setValidationBanner(
      method === 'IA_AUTOMATICA'
        ? `Encuentro cerrado automáticamente con Validación IA (${finalHome} - ${finalAway}). Tablas actualizadas.`
        : `Encuentro cerrado mediante Validación Manual del Árbitro ${activeReferee.nombre} (${finalHome} - ${finalAway}). Tablas actualizadas.`
    );
  };

  // Google Sheets handlers
  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await signInWithGoogleSheets();
      setGoogleUser(res.user);
      setGoogleToken(res.accessToken);
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'No se pudo iniciar sesión con Google. Verifica que las ventanas emergentes estén habilitadas.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const executeConfirmedSheetsSync = async () => {
    if (!googleToken || !confirmMode) return;
    setSyncLoading(true);
    setSyncError(null);
    try {
      const summary =
        confirmMode === 'create'
          ? await createMasterGoogleSheet(googleToken, state)
          : await syncStateToExistingSpreadsheet(googleToken, targetSpreadsheetId.trim(), state);
      setSyncResult(summary);
      setTargetSpreadsheetId(summary.spreadsheetId);
      onMarkSynced(summary.spreadsheetId);
      setConfirmMode(null);
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : 'Error sincronizando con Google Sheets.');
      setConfirmMode(null);
    } finally {
      setSyncLoading(false);
    }
  };

  const sheetPayloads = useMemo(() => buildTemplateSheetPayloads(state), [state]);

  const sortedTeams = useMemo(
    () => [...state.teams].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [state.teams]
  );

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return state.users.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        ROLE_META[u.role].label.toLowerCase().includes(q)
      );
    });
  }, [state.users, userSearch, roleFilter]);

  const getUserDraft = (u: AppUserProfile) =>
    roleDrafts[u.uid] ?? {
      role: u.role,
      delegatedTeamId: u.delegatedTeamId ?? '',
      linkedPlayerId: u.linkedPlayerId ?? '',
    };

  const updateUserDraft = (
    u: AppUserProfile,
    patch: Partial<{ role: UserRole; delegatedTeamId: string; linkedPlayerId: string }>
  ) => {
    const current = getUserDraft(u);
    setRoleDrafts((prev) => ({
      ...prev,
      [u.uid]: { ...current, ...patch },
    }));
  };

  const handleSaveUserRole = async (targetUser: AppUserProfile) => {
    const draft = getUserDraft(targetUser);
    const check = validateRoleChange(currentUser, targetUser, draft.role);
    if (!check.allowed) {
      setRoleErrorMsg(check.error || 'No tienes permiso para cambiar este rol.');
      setRoleStatusMsg(null);
      return;
    }

    setRoleSavingUid(targetUser.uid);
    setRoleErrorMsg(null);
    setRoleStatusMsg(null);
    try {
      await onAdminChangeUserRole(
        targetUser.uid,
        draft.role,
        draft.role === 'delegado' ? draft.delegatedTeamId || undefined : undefined,
        draft.role === 'jugador' ? draft.linkedPlayerId || undefined : undefined
      );
      setRoleStatusMsg(
        `Rol de ${targetUser.displayName} actualizado a ${ROLE_META[draft.role].label}.`
      );
    } catch (err: unknown) {
      setRoleErrorMsg(
        err instanceof Error ? err.message : 'Error al actualizar el rol del usuario.'
      );
    } finally {
      setRoleSavingUid(null);
    }
  };

  // RBAC Guard: Panel Oficial is exclusively for Árbitro Oficial and Administrador UFRO
  if (!canAccessAdminPanel(currentUser)) {
    return (
      <div className="bg-white min-h-[75vh]">
        <div className="bg-[#0d0d0d] text-white border-b border-white/10">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
              Acceso Restringido · Dirección de Deportes UFRO
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight mt-2">
              Panel Oficial de Arbitraje y Administración
            </h1>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
          <div className="border border-neutral-200 bg-[#f5f6f8] p-8 space-y-5">
            <div className="flex items-center gap-2.5 text-[#0d0d0d]">
              <Lock className="w-5 h-5 text-[#707ef9]" />
              <h2 className="font-display text-2xl font-bold uppercase tracking-wide">
                Sección exclusiva para Árbitros y Administradores
              </h2>
            </div>
            <p className="text-sm text-neutral-700 leading-relaxed">
              {currentUser ? (
                <>
                  Tu sesión actual corresponde al rol{' '}
                  <strong>{ROLE_META[currentUser.role].label}</strong>. La Mesa Arbitral, gestión de
                  roles de usuario, formato anual y sincronización con Google Sheets requieren
                  acreditación de <strong>Árbitro Oficial</strong> o{' '}
                  <strong>Administrador UFRO</strong>.
                </>
              ) : (
                <>
                  Debes iniciar sesión con una cuenta acreditada de{' '}
                  <strong>Árbitro Oficial</strong> o <strong>Administrador UFRO</strong> para operar
                  en el Panel Oficial.
                </>
              )}
            </p>
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-6 py-3 bg-[#0d0d0d] hover:bg-[#707ef9] text-white font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
            >
              Iniciar sesión con Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  const effectiveSubTab: PanelSubTab = isAdmin ? subTab : 'arbitro';

  return (
    <div className="bg-white min-h-[75vh]">
      {/* Carbon Subheader */}
      <div className="bg-[#0d0d0d] text-white border-b border-white/10">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
            Dirección de Deportes UFRO · {currentUser ? ROLE_META[currentUser.role].label : 'Consola Operativa'}
          </p>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mt-2">
            <div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight">
                {isAdmin
                  ? 'Panel Oficial de Arbitraje y Administración'
                  : 'Consola Privada de Mesa Arbitral'}
              </h1>
              <p className="text-sm text-neutral-400 mt-2 max-w-2xl">
                {isAdmin
                  ? 'Control de marcadores en mesa arbitral, asignación exclusiva de roles de usuario, validación de planillas con IA, formato anual y Google Sheets.'
                  : 'Control privado de marcadores por disciplina, validación de planillas físicas con IA y cierre oficial para publicación de resultados.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1 bg-white/5 p-1 self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setSubTab('arbitro')}
                className={`px-4 py-2 text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap ${
                  effectiveSubTab === 'arbitro'
                    ? 'bg-[#707ef9] text-white'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                Mesa Arbitral
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setSubTab('usuarios')}
                  className={`px-4 py-2 text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap ${
                    effectiveSubTab === 'usuarios'
                      ? 'bg-[#707ef9] text-white'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  Usuarios y Roles ({state.users.length})
                </button>
              )}
              {canManageAdminTabs && (
                <>
                  <button
                    type="button"
                    onClick={() => setSubTab('formato')}
                    className={`px-4 py-2 text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap ${
                      effectiveSubTab === 'formato'
                        ? 'bg-[#707ef9] text-white'
                        : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    Formato y Cupos
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubTab('sheets')}
                    className={`px-4 py-2 text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap ${
                      effectiveSubTab === 'sheets'
                        ? 'bg-[#707ef9] text-white'
                        : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    Google Sheets
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* TAB 1: REFEREE CONSOLE & AI SCORESHEET VALIDATION */}
        {effectiveSubTab === 'arbitro' && (
          <div className="space-y-8">
            {/* Referee Profile Selector */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {state.referees.map((ref) => {
                const isSelected = ref.id === activeReferee.id;
                return (
                  <button
                    key={ref.id}
                    type="button"
                    onClick={() => handleSelectReferee(ref.id)}
                    className={`text-left p-5 border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#0d0d0d] text-white border-[#0d0d0d]'
                        : 'bg-white text-[#0d0d0d] border-neutral-200 hover:border-[#707ef9]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className={isSelected ? 'text-[#707ef9] font-bold uppercase' : 'text-neutral-500 uppercase'}>
                        Perfil Árbitro · {ref.licencia}
                      </span>
                      <span className="tabular-nums opacity-75">{ref.partidosDirigidos} partidos</span>
                    </div>
                    <p className="font-display text-lg font-bold uppercase tracking-wide mt-1">
                      {ref.nombre}
                    </p>
                    <p className={`text-xs mt-1 ${isSelected ? 'text-neutral-300' : 'text-neutral-600'}`}>
                      {ref.disciplinaLabel} · RUT {ref.rut}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Match Selector + Live Console */}
            {!activeMatch || !activeMatchMeta ? (
              <div className="border border-neutral-200 bg-[#f5f6f8] p-10 text-center space-y-4">
                <p className="font-display text-2xl font-bold uppercase text-[#0d0d0d]">
                  Sin encuentros programados para la temporada {state.temporada}
                </p>
                <p className="text-sm text-neutral-600 max-w-xl mx-auto">
                  Para habilitar la Mesa Arbitral y la validación de planillas con IA, primero
                  inscribe al menos 2 equipos en una disciplina y luego genera los grupos y fixture
                  desde <strong>Formato y Cupos → Guardar y recalcular grupos equitativos</strong>.
                </p>
                {canManageAdminTabs && (
                  <button
                    type="button"
                    onClick={() => setSubTab('formato')}
                    className="px-5 py-2.5 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-xs cursor-pointer"
                  >
                    Ir a Formato y Cupos
                  </button>
                )}
              </div>
            ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left 7 cols: Live Scoreboard & Discipline-specific Controls */}
              <div className="lg:col-span-7 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <label htmlFor="ref-match-select" className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                    Encuentro asignado ({activeReferee.disciplinaLabel})
                  </label>
                  <select
                    id="ref-match-select"
                    value={activeMatch.id}
                    onChange={(e) => {
                      setSelectedMatchId(e.target.value);
                      setAiResult(null);
                      setScoresheetImage(null);
                      setAiError(null);
                      setValidationBanner(null);
                    }}
                    className="sm:w-96 bg-white border border-neutral-300 px-3 py-2 text-sm font-medium text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
                  >
                    {refereeMatches.map((m) => (
                      <option key={m.id} value={m.id}>
                        [{m.status === 'EN_VIVO' ? 'EN VIVO' : m.status === 'FINALIZADO' ? 'FINAL' : 'PROG'}] {DISCIPLINE_MAP[m.disciplineId].nombreCorto} · {teamMap.get(m.homeTeamId)?.nombre} vs {teamMap.get(m.awayTeamId)?.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Live Broadcast Scoreboard */}
                <div className="bg-[#0d0d0d] text-white p-6 space-y-6">
                  <div className="flex items-center justify-between text-xs text-neutral-300 border-b border-white/10 pb-3">
                    <span>
                      {activeMatchMeta.nombre} · {activeMatch.groupName}
                    </span>
                    <span className="font-bold text-[#707ef9] uppercase tracking-wider tabular-nums">
                      {activeMatch.status === 'EN_VIVO' ? `EN VIVO · ${activeMatch.periodLabel} (${activeMatch.clock})` : activeMatch.periodLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-4">
                    <div className="min-w-0">
                      <p className="font-display text-lg sm:text-2xl font-bold uppercase leading-tight break-words">
                        {homeTeam?.nombre}
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">
                        Faltas: <strong className="tabular-nums text-white">{activeMatch.fouls.home}</strong>
                        {activeMatchMeta.sportType !== 'futbol7' && (
                          <> · T. Muertos: <strong className="tabular-nums text-white">{activeMatch.timeouts.home}</strong></>
                        )}
                      </p>
                    </div>

                    <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-[#18181f] border border-white/15 text-center shrink-0">
                      <span
                        data-testid="live-scoreboard"
                        className="font-display text-3xl sm:text-5xl font-bold tabular-nums whitespace-nowrap"
                      >
                        {activeMatch.homeScore} — {activeMatch.awayScore}
                      </span>
                      {activeMatchMeta.sportType === 'voleibol' && activeMatch.periods.length > 0 && (
                        <p className="text-xs text-[#707ef9] font-mono mt-1 tabular-nums">
                          Set actual: {activeMatch.periods[activeMatch.periods.length - 1].home} -{' '}
                          {activeMatch.periods[activeMatch.periods.length - 1].away}
                        </p>
                      )}
                    </div>

                    <div className="text-right min-w-0">
                      <p className="font-display text-lg sm:text-2xl font-bold uppercase leading-tight break-words">
                        {awayTeam?.nombre}
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">
                        Faltas: <strong className="tabular-nums text-white">{activeMatch.fouls.away}</strong>
                        {activeMatchMeta.sportType !== 'futbol7' && (
                          <> · T. Muertos: <strong className="tabular-nums text-white">{activeMatch.timeouts.away}</strong></>
                        )}
                      </p>
                    </div>
                  </div>

                  {activeMatch.periods.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-white/10 text-xs text-neutral-300 tabular-nums">
                      {activeMatch.periods.map((p, idx) => (
                        <span key={idx}>
                          {activeMatchMeta.sportType === 'voleibol' ? `Set ${idx + 1}` : activeMatchMeta.sportType === 'futbol7' ? `T${idx + 1}` : `Q${idx + 1}`}:{' '}
                          <strong className="text-white">{p.home}-{p.away}</strong>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={advancePeriod}
                      className="inline-flex items-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-xs font-medium text-white cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 text-[#707ef9]" />
                      <span>
                        {activeMatch.status === 'PROGRAMADO'
                          ? 'Iniciar encuentro'
                          : activeMatchMeta.sportType === 'futbol7'
                          ? 'Cambiar tiempo (1° / 2°)'
                          : activeMatchMeta.sportType === 'voleibol'
                          ? 'Avanzar Set'
                          : 'Siguiente Cuarto'}
                      </span>
                    </button>

                    <div className="flex items-center gap-2">
                      <label htmlFor="ref-scorer" className="text-xs text-neutral-400">
                        Jugador implicado:
                      </label>
                      <select
                        id="ref-scorer"
                        value={selectedScorerId}
                        onChange={(e) => setSelectedScorerId(e.target.value)}
                        className="bg-[#18181f] border border-white/15 text-xs text-white px-2.5 py-1.5"
                      >
                        <option value="">Asignar al equipo</option>
                        {matchPlayers.map((p) => (
                          <option key={p.id} value={p.id}>
                            #{p.dorsal} {p.nombre} {p.apellidoPaterno} ({teamMap.get(p.teamId)?.sigla})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Discipline-Specific Live Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(['home', 'away'] as const).map((side) => {
                    const label = side === 'home' ? homeTeam?.nombre ?? 'Local' : awayTeam?.nombre ?? 'Visita';
                    return (
                      <div key={side} className="border border-neutral-200 p-4 space-y-3">
                        <p className="font-display text-sm font-bold uppercase tracking-wide text-[#0d0d0d] truncate">
                          {side === 'home' ? 'Local' : 'Visita'}: {label}
                        </p>

                        {activeMatchMeta.sportType === 'futbol7' && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => applyLiveAction(side, 'GOL', 1)}
                              className="py-2.5 bg-[#707ef9] hover:bg-[#5766eb] text-white text-xs font-display font-bold uppercase tracking-wider cursor-pointer"
                            >
                              +1 Gol ({side === 'home' ? 'Local' : 'Visita'})
                            </button>
                            <button
                              type="button"
                              onClick={() => applyLiveAction(side, 'FALTA')}
                              className="py-2.5 bg-[#f5f6f8] hover:bg-neutral-200 text-[#0d0d0d] text-xs font-medium cursor-pointer"
                            >
                              +1 Falta
                            </button>
                            <button
                              type="button"
                              onClick={() => applyLiveAction(side, 'AMARILLA')}
                              className="py-2 bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-medium cursor-pointer"
                            >
                              T. Amarilla
                            </button>
                            <button
                              type="button"
                              onClick={() => applyLiveAction(side, 'ROJA')}
                              className="py-2 bg-red-100 hover:bg-red-200 text-red-950 text-xs font-medium cursor-pointer"
                            >
                              T. Roja
                            </button>
                          </div>
                        )}

                        {(activeMatchMeta.sportType === 'basquetbol' ||
                          activeMatchMeta.sportType === 'basquetbol3x3') && (
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => applyLiveAction(side, 'PUNTO_1', 1)}
                              className="py-2.5 bg-[#0d0d0d] hover:bg-[#707ef9] text-white text-xs font-display font-bold cursor-pointer"
                            >
                              +1 TL
                            </button>
                            <button
                              type="button"
                              onClick={() => applyLiveAction(side, 'PUNTO_2', 2)}
                              className="py-2.5 bg-[#707ef9] hover:bg-[#5766eb] text-white text-xs font-display font-bold cursor-pointer"
                            >
                              +2 Doble
                            </button>
                            <button
                              type="button"
                              onClick={() => applyLiveAction(side, 'PUNTO_3', 3)}
                              className="py-2.5 bg-[#707ef9] hover:bg-[#5766eb] text-white text-xs font-display font-bold cursor-pointer"
                            >
                              +3 Triple
                            </button>
                            <button
                              type="button"
                              onClick={() => applyLiveAction(side, 'FALTA')}
                              className="col-span-2 py-2 bg-[#f5f6f8] hover:bg-neutral-200 text-[#0d0d0d] text-xs font-medium cursor-pointer"
                            >
                              +1 Falta equipo
                            </button>
                            <button
                              type="button"
                              onClick={() => applyLiveAction(side, 'TIEMPO_MUERTO')}
                              className="py-2 bg-[#f5f6f8] hover:bg-neutral-200 text-[#0d0d0d] text-xs font-medium cursor-pointer"
                            >
                              T. Muerto
                            </button>
                          </div>
                        )}

                        {activeMatchMeta.sportType === 'voleibol' && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => applyLiveAction(side, 'PUNTO_VOLEY', 1)}
                              className="col-span-2 py-2.5 bg-[#707ef9] hover:bg-[#5766eb] text-white text-xs font-display font-bold uppercase tracking-wider cursor-pointer"
                            >
                              +1 Punto Set ({side === 'home' ? 'Local' : 'Visita'})
                            </button>
                            <button
                              type="button"
                              onClick={() => applyLiveAction(side, 'ACE', 1)}
                              className="py-2 bg-[#0d0d0d] hover:bg-neutral-800 text-white text-xs font-medium cursor-pointer"
                            >
                              +1 Ace
                            </button>
                            <button
                              type="button"
                              onClick={() => applyLiveAction(side, 'BLOQUEO', 1)}
                              className="py-2 bg-[#f5f6f8] hover:bg-neutral-200 text-[#0d0d0d] text-xs font-medium cursor-pointer"
                            >
                              +1 Bloqueo
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Live Event Feed */}
                <div className="border border-neutral-200 p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Bitácora del encuentro ({activeMatch.events.length} incidencias)
                  </p>
                  {activeMatch.events.length === 0 ? (
                    <p className="text-xs text-neutral-500">
                      Aún no se registran eventos en vivo para este encuentro.
                    </p>
                  ) : (
                    <ul className="divide-y divide-neutral-100 max-h-44 overflow-y-auto text-xs">
                      {activeMatch.events.slice(0, 10).map((ev) => (
                        <li key={ev.id} className="py-2 flex items-center justify-between gap-3">
                          <span className="text-[#0d0d0d]">{ev.detail}</span>
                          <span className="text-neutral-500 tabular-nums shrink-0">{ev.minuteOrPeriod}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Right 5 cols: Scoresheet Photo Upload + Gemini AI Validation + Manual Fallback */}
              <div className="lg:col-span-5 border border-neutral-200 bg-[#f5f6f8] p-6 space-y-5">
                <div className="border-b border-neutral-200 pb-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#707ef9]">
                    <Camera className="w-4 h-4" />
                    <span>Cierre de encuentro con Planilla</span>
                  </div>
                  <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d] mt-1">
                    Validación IA y Revisión Manual
                  </h2>
                  <p className="text-xs text-neutral-600 mt-1">
                    Sube la fotografía de la planilla física. La IA verificará puntajes y detectará
                    errores frente al marcador en vivo; siempre podrás aplicar validación manual.
                  </p>
                </div>

                {validationBanner && (
                  <div role="status" className="bg-emerald-50 border border-emerald-300 p-4 text-xs text-emerald-950 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span>{validationBanner}</span>
                  </div>
                )}

                {aiError && (
                  <div role="alert" className="bg-red-50 border border-red-300 p-4 text-xs text-red-900 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{aiError}</span>
                  </div>
                )}

                {/* Upload & Sample Test Generator */}
                <div className="space-y-3">
                  <label
                    htmlFor="scoresheet-upload"
                    className="flex flex-col items-center justify-center border border-dashed border-neutral-400 bg-white p-5 text-center cursor-pointer hover:border-[#707ef9] transition-colors"
                  >
                    <Upload className="w-5 h-5 text-[#707ef9] mb-2" />
                    <span className="text-sm font-medium text-[#0d0d0d]">
                      Subir fotografía de la planilla oficial
                    </span>
                    <span className="text-xs text-neutral-500 mt-0.5">
                      Formatos JPG, PNG o WEBP
                    </span>
                  </label>
                  <input
                    id="scoresheet-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleScoresheetFileChange}
                    className="sr-only"
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleGenerateSampleScoresheet(false)}
                      className="flex-1 px-3 py-2 bg-white border border-neutral-300 hover:border-[#0d0d0d] text-xs font-medium text-[#0d0d0d] cursor-pointer"
                    >
                      Probar planilla coincidente
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenerateSampleScoresheet(true)}
                      className="flex-1 px-3 py-2 bg-white border border-neutral-300 hover:border-[#0d0d0d] text-xs font-medium text-[#0d0d0d] cursor-pointer"
                    >
                      Probar planilla con error (+1)
                    </button>
                  </div>
                </div>

                {scoresheetImage && (
                  <div className="space-y-3">
                    <img
                      src={scoresheetImage}
                      alt="Fotografía de planilla subida por el árbitro"
                      className="w-full h-44 object-contain bg-white border border-neutral-200"
                    />
                    <button
                      type="button"
                      onClick={handleAnalyzeWithAI}
                      disabled={aiLoading}
                      className="w-full inline-flex items-center justify-center gap-2 py-3 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>
                        {aiLoading
                          ? 'Analizando planilla con IA...'
                          : 'Analizar y validar planilla con IA'}
                      </span>
                    </button>
                  </div>
                )}

                {/* AI Validation Result Panel */}
                {aiResult && (
                  <div className="bg-white border border-neutral-200 p-4 space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                      <span className="font-bold uppercase tracking-wider text-[#0d0d0d]">
                        Resultado Lectura IA
                      </span>
                      <span
                        className={`font-bold uppercase ${
                          aiResult.requiresManualReview ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        Confianza {aiResult.confidence} ·{' '}
                        {aiResult.requiresManualReview ? 'Requiere revisión' : 'Validada'}
                      </span>
                    </div>

                    <p className="text-neutral-700">{aiResult.summary}</p>

                    <div className="flex items-center justify-between bg-[#f5f6f8] p-3 tabular-nums">
                      <span>Planilla detectada:</span>
                      <strong className="font-display text-base text-[#0d0d0d]">
                        {homeTeam?.sigla} {aiResult.homeScoreDetected} — {aiResult.awayScoreDetected}{' '}
                        {awayTeam?.sigla}
                      </strong>
                    </div>

                    {aiResult.discrepancies.length > 0 && (
                      <div className="bg-amber-50 border border-amber-300 p-3 space-y-1 text-amber-950">
                        <p className="font-bold uppercase text-[11px]">
                          Errores / Discrepancias detectadas:
                        </p>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {aiResult.discrepancies.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => finalizeMatch('IA_AUTOMATICA')}
                      className="w-full py-2.5 bg-[#0d0d0d] hover:bg-[#707ef9] text-white font-display font-bold uppercase tracking-widest text-xs cursor-pointer transition-colors"
                    >
                      Aprobar marcador IA y finalizar partido
                    </button>
                  </div>
                )}

                {/* Manual Referee Validation Form (Always available when AI has doubts or offline) */}
                <div className="bg-white border border-neutral-200 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0d0d0d]">
                    <ShieldCheck className="w-4 h-4 text-[#707ef9]" />
                    <span>Validación Manual del Árbitro</span>
                  </div>
                  <p className="text-xs text-neutral-600">
                    Utiliza esta opción si la IA presenta dudas, la foto está borrosa o debes
                    corregir un error de la planilla física.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="manual-home" className="block text-[11px] text-neutral-600 mb-1 truncate">
                        Marcador {homeTeam?.nombre}
                      </label>
                      <input
                        id="manual-home"
                        type="number"
                        min={0}
                        value={manualHome}
                        onChange={(e) => setManualHome(e.target.value)}
                        className="w-full border border-neutral-300 px-3 py-2 text-sm tabular-nums font-bold"
                      />
                    </div>
                    <div>
                      <label htmlFor="manual-away" className="block text-[11px] text-neutral-600 mb-1 truncate">
                        Marcador {awayTeam?.nombre}
                      </label>
                      <input
                        id="manual-away"
                        type="number"
                        min={0}
                        value={manualAway}
                        onChange={(e) => setManualAway(e.target.value)}
                        className="w-full border border-neutral-300 px-3 py-2 text-sm tabular-nums font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="manual-notes" className="block text-[11px] text-neutral-600 mb-1">
                      Observación arbitral obligatoria
                    </label>
                    <input
                      id="manual-notes"
                      type="text"
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      placeholder="Ej: Planilla física verificada con ambos capitanes."
                      className="w-full border border-neutral-300 px-3 py-2 text-xs"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => finalizeMatch('MANUAL_ARBITRO')}
                    className="w-full py-2.5 bg-[#0d0d0d] hover:bg-[#707ef9] text-white font-display font-bold uppercase tracking-widest text-xs cursor-pointer transition-colors"
                  >
                    Finalizar con Validación Manual
                  </button>
                </div>
              </div>
            </div>
            )}
          </div>
        )}

        {/* TAB 2 (ADMIN ONLY): USER & ROLE MANAGEMENT */}
        {effectiveSubTab === 'usuarios' && isAdmin && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-200 pb-5">
              <div className="flex items-start gap-3">
                <UserCog className="w-6 h-6 text-[#707ef9] shrink-0 mt-1" />
                <div>
                  <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                    Gestión Exclusiva de Usuarios y Roles RBAC
                  </h2>
                  <p className="text-xs text-neutral-600 mt-1 max-w-2xl">
                    Solo los Administradores UFRO pueden promover una cuenta tradicional al rol de{' '}
                    <strong>Fotógrafo Oficial</strong>, <strong>Árbitro Oficial</strong>,{' '}
                    <strong>Delegado de Equipo</strong>, <strong>Jugador</strong> o{' '}
                    <strong>Administrador</strong>.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Buscar por nombre o correo..."
                    aria-label="Buscar usuarios"
                    className="border border-neutral-300 pl-9 pr-3 py-2 text-sm text-[#0d0d0d] w-60 focus:outline-none focus:border-[#707ef9]"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as 'ALL' | UserRole)}
                  aria-label="Filtrar usuarios por rol"
                  className="bg-white border border-neutral-300 px-3 py-2 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
                >
                  <option value="ALL">Todos los roles ({state.users.length})</option>
                  {ALL_USER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_META[r].label}
                    </option>
                  ))}
                </select>
                {onRefreshUsers && (
                  <button
                    type="button"
                    onClick={() => void onRefreshUsers()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-neutral-300 hover:border-[#707ef9] text-xs font-medium text-[#0d0d0d] cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sincronizar</span>
                  </button>
                )}
              </div>
            </div>

            {/* Role Distribution Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {ALL_USER_ROLES.map((r) => {
                const count = state.users.filter((u) => u.role === r).length;
                return (
                  <div key={r} className="border border-neutral-200 bg-[#f5f6f8] p-3.5">
                    <p className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium truncate">
                      {ROLE_META[r].shortLabel}
                    </p>
                    <p className="font-display text-2xl font-bold tabular-nums text-[#0d0d0d] mt-1">
                      {count}
                    </p>
                  </div>
                );
              })}
            </div>

            {roleStatusMsg && (
              <div
                role="status"
                className="bg-emerald-50 border border-emerald-300 p-4 text-xs text-emerald-950 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{roleStatusMsg}</span>
              </div>
            )}

            {roleErrorMsg && (
              <div
                role="alert"
                className="bg-red-50 border border-red-300 p-4 text-xs text-red-900 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{roleErrorMsg}</span>
              </div>
            )}

            {/* Users Table */}
            <div className="border border-neutral-200 overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-[#f5f6f8] border-b border-neutral-200 text-xs text-neutral-500 uppercase">
                    <th className="py-3 px-4 font-medium">Usuario</th>
                    <th className="py-3 px-3 font-medium">Rol Actual</th>
                    <th className="py-3 px-3 font-medium">Asignar Nuevo Rol</th>
                    <th className="py-3 px-3 font-medium">Vínculo (Equipo / Jugador)</th>
                    <th className="py-3 px-4 text-right font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredUsers.map((u) => {
                    const draft = getUserDraft(u);
                    const isPrimaryAdmin =
                      u.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;
                    const hasChanged =
                      draft.role !== u.role ||
                      (draft.role === 'delegado' &&
                        draft.delegatedTeamId !== (u.delegatedTeamId ?? '')) ||
                      (draft.role === 'jugador' &&
                        draft.linkedPlayerId !== (u.linkedPlayerId ?? ''));

                    return (
                      <tr key={u.uid} className="hover:bg-[#f9fafb]">
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-[#0d0d0d]">{u.displayName}</p>
                          <p className="text-xs text-neutral-500">
                            {u.email} ·{' '}
                            <span className="uppercase">
                              {u.authSource === 'google' ? 'Google Auth' : 'Perfil UFRO'}
                            </span>
                          </p>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="inline-block px-2 py-0.5 text-[11px] font-display font-bold uppercase tracking-wider bg-[#0d0d0d] text-white">
                            {ROLE_META[u.role].label}
                          </span>
                          {isPrimaryAdmin && (
                            <span className="block text-[10px] text-[#707ef9] font-medium mt-1">
                              Admin Principal Protegido
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          <select
                            aria-label={`Cambiar rol de ${u.displayName}`}
                            disabled={isPrimaryAdmin}
                            value={draft.role}
                            onChange={(e) =>
                              updateUserDraft(u, { role: e.target.value as UserRole })
                            }
                            className="bg-white border border-neutral-300 px-2.5 py-1.5 text-xs text-[#0d0d0d] disabled:opacity-50"
                          >
                            {ALL_USER_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_META[r].label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3.5 px-3">
                          {draft.role === 'delegado' ? (
                            <select
                              aria-label={`Asignar equipo delegado para ${u.displayName}`}
                              value={draft.delegatedTeamId}
                              onChange={(e) =>
                                updateUserDraft(u, { delegatedTeamId: e.target.value })
                              }
                              className="bg-white border border-neutral-300 px-2.5 py-1.5 text-xs text-[#0d0d0d] max-w-[220px]"
                            >
                              <option value="">Seleccionar equipo...</option>
                              {sortedTeams.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.nombre} ({DISCIPLINE_MAP[t.disciplineId].nombreCorto})
                                </option>
                              ))}
                            </select>
                          ) : draft.role === 'jugador' ? (
                            <select
                              aria-label={`Vincular jugador para ${u.displayName}`}
                              value={draft.linkedPlayerId}
                              onChange={(e) =>
                                updateUserDraft(u, { linkedPlayerId: e.target.value })
                              }
                              className="bg-white border border-neutral-300 px-2.5 py-1.5 text-xs text-[#0d0d0d] max-w-[220px]"
                            >
                              <option value="">Vincular por correo o elegir...</option>
                              {state.players.slice(0, 40).map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.nombre} {p.apellidoPaterno} ({p.rut})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-neutral-400">
                              Favoritos: {u.favoriteTeamIds.length}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            disabled={isPrimaryAdmin || !hasChanged || roleSavingUid === u.uid}
                            onClick={() => void handleSaveUserRole(u)}
                            className="px-3.5 py-1.5 bg-[#707ef9] hover:bg-[#5766eb] text-white text-xs font-display font-bold uppercase tracking-widest cursor-pointer disabled:opacity-40 whitespace-nowrap"
                          >
                            {roleSavingUid === u.uid ? 'Guardando...' : 'Guardar rol'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CONFIGURABLE TOURNAMENT FORMAT & CUPOS */}
        {effectiveSubTab === 'formato' && canManageAdminTabs && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">
                Selecciona una disciplina
              </p>
              {DISCIPLINES.map((d) => {
                const cfg = state.configs[d.id];
                const teamCount = state.teams.filter((t) => t.disciplineId === d.id).length;
                const active = d.id === configDiscId;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setConfigDiscId(d.id)}
                    className={`w-full text-left px-4 py-3.5 border transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                      active
                        ? 'bg-[#0d0d0d] text-white border-[#0d0d0d]'
                        : 'bg-white text-[#0d0d0d] border-neutral-200 hover:border-[#707ef9]'
                    }`}
                  >
                    <div>
                      <p className="font-display text-sm font-bold uppercase tracking-wide">
                        {d.nombre}
                      </p>
                      <p className={`text-xs mt-0.5 ${active ? 'text-neutral-300' : 'text-neutral-500'}`}>
                        {cfg.numGrupos} grupos · Playoff Top {cfg.formatoPlayoff}
                      </p>
                    </div>
                    <span className="font-display text-base font-bold tabular-nums shrink-0">
                      {teamCount}/{cfg.maxCupos}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="lg:col-span-8 border border-neutral-200 p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-neutral-200 pb-4">
                <Sliders className="w-5 h-5 text-[#707ef9]" />
                <div>
                  <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                    Configuración: {DISCIPLINE_MAP[configDiscId].nombre}
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Ajusta cupos, cantidad de grupos equitativos y llaves de playoffs según las
                    inscripciones de cada año.
                  </p>
                </div>
              </div>

              {configSavedMsg && (
                <div role="status" className="bg-emerald-50 border border-emerald-300 p-4 text-sm text-emerald-950 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{configSavedMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <div>
                  <label htmlFor="cfg-cupos" className="block text-xs font-medium text-neutral-700 mb-1">
                    Cupos máximos de equipos
                  </label>
                  <input
                    id="cfg-cupos"
                    type="number"
                    min={4}
                    max={80}
                    value={draftConfig.maxCupos}
                    onChange={(e) =>
                      setDraftConfig((c) => ({ ...c, maxCupos: Math.max(4, Number(e.target.value) || 4) }))
                    }
                    className="w-full border border-neutral-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>

                <div>
                  <label htmlFor="cfg-grupos" className="block text-xs font-medium text-neutral-700 mb-1">
                    Cantidad de grupos equitativos
                  </label>
                  <input
                    id="cfg-grupos"
                    type="number"
                    min={1}
                    max={12}
                    value={draftConfig.numGrupos}
                    onChange={(e) =>
                      setDraftConfig((c) => ({ ...c, numGrupos: Math.max(1, Math.min(12, Number(e.target.value) || 1)) }))
                    }
                    className="w-full border border-neutral-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>

                <div>
                  <label htmlFor="cfg-clasif" className="block text-xs font-medium text-neutral-700 mb-1">
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
                        clasificadosPorGrupo: Math.max(1, Math.min(4, Number(e.target.value) || 1)),
                      }))
                    }
                    className="w-full border border-neutral-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>

                <div>
                  <label htmlFor="cfg-playoff" className="block text-xs font-medium text-neutral-700 mb-1">
                    Formato de Playoffs
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
                    className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm"
                  >
                    <option value={4}>Semifinales (4 clasificados)</option>
                    <option value={8}>Cuartos de Final (8 clasificados)</option>
                    <option value={16}>Octavos de Final (16 clasificados)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="cfg-fase" className="block text-xs font-medium text-neutral-700 mb-1">
                    Etapa actual del campeonato
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
                    className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm"
                  >
                    <option value="INSCRIPCIONES">Período de Inscripciones</option>
                    <option value="FASE_GRUPOS">Fase de Grupos</option>
                    <option value="TRANSFERENCIAS">Ventana de Transferencias</option>
                    <option value="PLAYOFFS">Playoffs</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="cfg-max-tr" className="block text-xs font-medium text-neutral-700 mb-1">
                    Máx. transferencias por equipo
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
                    className="w-full border border-neutral-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-8 pt-2 border-t border-neutral-200">
                <label className="inline-flex items-center gap-2.5 text-sm font-medium text-[#0d0d0d] cursor-pointer">
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

                <label className="inline-flex items-center gap-2.5 text-sm font-medium text-[#0d0d0d] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draftConfig.transferenciasAbiertas}
                    onChange={(e) =>
                      setDraftConfig((c) => ({ ...c, transferenciasAbiertas: e.target.checked }))
                    }
                    className="accent-[#707ef9] w-4 h-4"
                  />
                  <span>Ventana de transferencias post-grupos abierta</span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    onUpdateConfig(configDiscId, draftConfig, false);
                    setConfigSavedMsg('Parámetros guardados en Firestore correctamente.');
                  }}
                  className="px-5 py-3 bg-[#0d0d0d] hover:bg-neutral-800 text-white font-display font-bold uppercase tracking-widest text-xs cursor-pointer"
                >
                  Guardar cambios
                </button>
                <button
                  type="button"
                  disabled={state.teams.filter((t) => t.disciplineId === configDiscId).length < 2}
                  onClick={() => {
                    onUpdateConfig(configDiscId, draftConfig, true);
                    setConfigSavedMsg(
                      `Formato actualizado en Firestore y ${state.teams.filter((t) => t.disciplineId === configDiscId).length} equipos redistribuidos en ${draftConfig.numGrupos} grupos con fixture generado.`
                    );
                  }}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-xs cursor-pointer disabled:opacity-45"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Guardar y generar grupos / fixture</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: REAL GOOGLE SHEETS WORKSPACE INTEGRATION */}
        {effectiveSubTab === 'sheets' && canManageAdminTabs && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Connection & Sync Actions */}
              <div className="lg:col-span-5 border border-neutral-200 p-6 space-y-6">
                <div className="flex items-center gap-3 border-b border-neutral-200 pb-4">
                  <FileSpreadsheet className="w-5 h-5 text-[#707ef9]" />
                  <div>
                    <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                      Plantillas Google Sheets
                    </h2>
                    <p className="text-xs text-neutral-500">
                      Sincronización directa con tu cuenta de Google Workspace.
                    </p>
                  </div>
                </div>

                {authError && (
                  <div role="alert" className="bg-red-50 border border-red-300 p-3.5 text-xs text-red-900">
                    {authError}
                  </div>
                )}

                {syncError && (
                  <div role="alert" className="bg-red-50 border border-red-300 p-3.5 text-xs text-red-900">
                    {syncError}
                  </div>
                )}

                {syncResult && (
                  <div role="status" className="bg-emerald-50 border border-emerald-300 p-4 space-y-2 text-xs text-emerald-950">
                    <p className="font-bold uppercase">Sincronización completada con éxito</p>
                    <p>
                      {syncResult.totalRowsWritten} filas escritas en {syncResult.tabsUpdated.length}{' '}
                      pestañas ({syncResult.tabsUpdated.join(', ')}).
                    </p>
                    <a
                      href={syncResult.spreadsheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block font-bold text-[#707ef9] underline"
                    >
                      Abrir planilla en Google Sheets →
                    </a>
                  </div>
                )}

                {!googleToken ? (
                  <div className="space-y-4">
                    <p className="text-sm text-neutral-700 leading-relaxed">
                      Conecta tu cuenta de Google para crear o actualizar automáticamente las 5
                      pestañas oficiales del Campeonato Intercarreras UFRO en Google Sheets.
                    </p>
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={authLoading}
                      className="gsi-material-button w-full"
                    >
                      <div className="gsi-material-button-icon">
                        <svg viewBox="0 0 48 48" style={{ display: 'block' }}>
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                        </svg>
                      </div>
                      <span>{authLoading ? 'Conectando...' : 'Sign in with Google'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="bg-[#f5f6f8] border border-neutral-200 p-3.5 flex items-center justify-between gap-3 text-xs">
                      <div className="truncate">
                        <p className="font-bold text-[#0d0d0d] truncate">
                          {googleUser?.displayName || googleUser?.email || 'Cuenta conectada'}
                        </p>
                        <p className="text-neutral-500 truncate">{googleUser?.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => signOutGoogle()}
                        className="text-neutral-600 hover:text-red-600 underline shrink-0 cursor-pointer"
                      >
                        Desconectar
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setConfirmMode('create')}
                      className="w-full py-3 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-xs cursor-pointer"
                    >
                      Crear nueva planilla maestra en Google Sheets
                    </button>

                    <div className="pt-4 border-t border-neutral-200 space-y-2.5">
                      <label htmlFor="sheets-id" className="block text-xs font-medium text-neutral-700">
                        O actualizar una planilla existente (Spreadsheet ID)
                      </label>
                      <input
                        id="sheets-id"
                        type="text"
                        value={targetSpreadsheetId}
                        onChange={(e) => setTargetSpreadsheetId(e.target.value)}
                        placeholder="Ej: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                        className="w-full border border-neutral-300 px-3 py-2 text-xs font-mono"
                      />
                      <button
                        type="button"
                        disabled={!targetSpreadsheetId.trim()}
                        onClick={() => setConfirmMode('update')}
                        className="w-full py-2.5 bg-[#0d0d0d] hover:bg-neutral-800 text-white font-display font-bold uppercase tracking-widest text-xs cursor-pointer disabled:opacity-50"
                      >
                        Sobrescribir y sincronizar pestañas
                      </button>
                    </div>
                  </div>
                )}

                {/* Offline CSV Template Downloads */}
                <div className="pt-4 border-t border-neutral-200 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Descarga directa de plantillas (CSV para Google Sheets)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {TEMPLATE_TABS.map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => downloadTemplateCsv(tab, state)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#f5f6f8] hover:bg-neutral-200 text-xs font-medium text-[#0d0d0d] cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-[#707ef9]" />
                        <span>{tab}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Template Data Preview */}
              <div className="lg:col-span-7 border border-neutral-200 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display text-lg font-bold uppercase tracking-wide text-[#0d0d0d]">
                    Vista previa de estructura de planilla
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {TEMPLATE_TABS.map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setPreviewTab(tab)}
                        className={`px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                          previewTab === tab
                            ? 'bg-[#0d0d0d] text-white'
                            : 'bg-[#f5f6f8] text-neutral-600 hover:text-[#0d0d0d]'
                        }`}
                      >
                        {tab} ({sheetPayloads[tab].length - 1})
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border border-neutral-200 overflow-x-auto max-h-[420px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-[#f5f6f8] border-b border-neutral-200">
                      <tr>
                        {sheetPayloads[previewTab][0].slice(0, 8).map((col, idx) => (
                          <th key={idx} className="py-2.5 px-3 font-bold text-[#0d0d0d] whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {sheetPayloads[previewTab].slice(1, 13).map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-[#f9fafb]">
                          {row.slice(0, 8).map((cell, cIdx) => (
                            <td key={cIdx} className="py-2 px-3 text-neutral-700 whitespace-nowrap max-w-[180px] truncate tabular-nums">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-neutral-500">
                  Se muestran las primeras 8 columnas y 12 filas de muestra. Al sincronizar o
                  exportar se incluyen todas las columnas completas (incluidos los 12 campos de
                  estudiantes).
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mandatory User Confirmation Dialog for Google Sheets Write Operations */}
      <ConfirmDialog
        open={confirmMode !== null}
        title={
          confirmMode === 'create'
            ? 'Crear nueva planilla en Google Sheets'
            : 'Actualizar planilla existente en Google Sheets'
        }
        description={
          confirmMode === 'create'
            ? 'Esta acción creará una nueva hoja de cálculo en tu cuenta de Google con las 5 pestañas oficiales del Campeonato Intercarreras UFRO.'
            : `Esta acción sobrescribirá los rangos de datos en la hoja de cálculo ID "${targetSpreadsheetId.trim()}" con el estado actual del campeonato.`
        }
        details={[
          `Equipos: ${state.teams.length} registros`,
          `Jugadores_Plantilla (12 campos UFRO): ${state.players.length} registros`,
          `Resultados_Partidos: ${state.matches.length} registros`,
          `Transferencias: ${state.transfers.length} registros`,
          `Configuracion_Formato: ${Object.keys(state.configs).length} disciplinas`,
        ]}
        confirmLabel={confirmMode === 'create' ? 'Crear y escribir planilla' : 'Sobrescribir datos'}
        loading={syncLoading}
        onConfirm={executeConfirmedSheetsSync}
        onCancel={() => setConfirmMode(null)}
      />
    </div>
  );
}
