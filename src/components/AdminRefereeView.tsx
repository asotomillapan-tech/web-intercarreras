import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Lock,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  Upload,
  UserCog,
} from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
import {
  filterMatchesByOrg,
  sortMatchesChronologically,
  type MatchSortOrder,
} from '../domain/matchFilterEngine';
import type { PlayerStatDelta } from '../domain/liveMatchEngine';
import {
  ALL_USER_ROLES,
  BOOTSTRAPPED_ADMIN_EMAIL,
  canAccessAdminPanel,
  canManageFormatAndSheets,
  canManageNews,
  canManageRoles,
  canRefereeMatches,
  ROLE_META,
  validateRoleChange,
} from '../domain/rbacEngine';
import { getFirebaseIdToken } from '../services/firebaseAuth';
import type { Editorial2025Photos } from '../services/googleDrive';
import type { DeletedEntityIds, SheetImportDelta } from '../domain/sheetsMergeEngine';
import type {
  AiScoresheetResult,
  AppUserProfile,
  DisciplineFormatConfig,
  DisciplineId,
  DisciplineTotyConfig,
  HomeFeaturedConfig,
  MasterSheetKey,
  MasterSheetsConfig,
  Match,
  MatchPhase,
  NewsArticle,
  Player,
  Team,
  TournamentStage,
  TournamentState,
  UserRole,
} from '../types/tournament';
import { AdminAwardsManager } from './AdminAwardsManager';
import { AdminFeaturedManager } from './AdminFeaturedManager';
import { AdminMatchEditor } from './AdminMatchEditor';
import { AdminNewsManager } from './AdminNewsManager';
import { AdminPlayersManager } from './AdminPlayersManager';
import { AdminTeamsManager } from './AdminTeamsManager';
import { AdminTotyManager } from './AdminTotyManager';
import { LiveScoreboardPanel } from './LiveScoreboardPanel';
import { MasterSheetsPanel, type AutoSyncStatusInfo } from './MasterSheetsPanel';
import { MatchFilterBar } from './MatchFilterBar';

export type PanelSubTab =
  | 'arbitro'
  | 'portada'
  | 'noticias'
  | 'partidos'
  | 'equipos'
  | 'jugadores'
  | 'votaciones'
  | 'toty'
  | 'usuarios'
  | 'formato'
  | 'sheets';

interface AdminRefereeViewProps {
  state: TournamentState;
  currentUser: AppUserProfile | null;
  editorialPhotos: Editorial2025Photos | null;
  initialSubTab?: PanelSubTab;
  focusedMatchId?: string | null;
  pendingSyncKeys: MasterSheetKey[];
  deletedIds?: DeletedEntityIds;
  autoSyncSessionApproved: boolean;
  autoSyncState: AutoSyncStatusInfo;
  onUpdateMatch: (match: Match, scorerPlayerId?: string, statDelta?: PlayerStatDelta) => void;
  onAddMatch?: (match: Match) => void;
  onAddTeam: (team: Team) => void;
  onUpdateTeam: (team: Team) => void;
  onDeleteTeam: (team: Team) => void;
  onAddPlayer: (player: Player) => void;
  onUpdatePlayer: (player: Player) => void;
  onDeletePlayer: (player: Player) => void;
  onAddNews: (article: NewsArticle) => Promise<void> | void;
  onUpdateNews: (article: NewsArticle) => Promise<void> | void;
  onDeleteNews: (article: NewsArticle) => Promise<void> | void;
  onUpdateConfig: (disciplineId: DisciplineId, config: DisciplineFormatConfig, rebuildGroups: boolean) => void;
  onSaveMasterSheets: (
    nextMasterSheets: MasterSheetsConfig,
    nextAutoSyncEnabled?: boolean
  ) => Promise<void>;
  onApproveAutoSyncSession: (approved: boolean) => void;
  onClearPendingSyncKeys: (keys: MasterSheetKey[]) => void;
  onClearDeletedTombstones: () => void;
  onApplySheetImports: (imports: SheetImportDelta) => Promise<void>;
  onMarkSynced: (spreadsheetId: string) => void;
  onAdminChangeUserRole: (
    targetUid: string,
    nextRole: UserRole,
    delegatedTeamId?: string,
    linkedPlayerId?: string
  ) => Promise<void> | void;
  onSaveAwardNominees: (disciplineId: DisciplineId, nomineeIds: string[]) => Promise<void> | void;
  totyLastSyncAt: string | null;
  totyRealtimeActive: boolean;
  onSaveTotyConfig: (config: DisciplineTotyConfig) => Promise<void>;
  onResetTotyConfig: (disciplineId: DisciplineId) => Promise<void>;
  onSaveHomeFeatured: (config: HomeFeaturedConfig) => Promise<void>;
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
  editorialPhotos,
  initialSubTab = 'arbitro',
  focusedMatchId = null,
  pendingSyncKeys,
  deletedIds,
  autoSyncSessionApproved,
  autoSyncState,
  onUpdateMatch,
  onAddMatch,
  onAddTeam,
  onUpdateTeam,
  onDeleteTeam,
  onAddPlayer,
  onUpdatePlayer,
  onDeletePlayer,
  onAddNews,
  onUpdateNews,
  onDeleteNews,
  onUpdateConfig,
  onSaveMasterSheets,
  onApproveAutoSyncSession,
  onClearPendingSyncKeys,
  onClearDeletedTombstones,
  onApplySheetImports,
  onMarkSynced,
  onAdminChangeUserRole,
  onSaveAwardNominees,
  totyLastSyncAt,
  totyRealtimeActive,
  onSaveTotyConfig,
  onResetTotyConfig,
  onSaveHomeFeatured,
  onRefreshUsers,
  onOpenAuth,
}: AdminRefereeViewProps) {
  const isAdmin = canManageRoles(currentUser);
  const canManageAdminTabs = canManageFormatAndSheets(currentUser);
  const canEditNews = canManageNews(currentUser);
  const canReferee = canRefereeMatches(currentUser);
  const [subTab, setSubTab] = useState<PanelSubTab>(() => {
    if (isAdmin) return initialSubTab;
    if (canEditNews && !canReferee) return 'noticias';
    return 'arbitro';
  });

  // Admin User & Role Management State
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [roleDrafts, setRoleDrafts] = useState<
    Record<string, { role: UserRole; delegatedTeamId: string; linkedPlayerId: string }>
  >({});
  const [roleSavingUid, setRoleSavingUid] = useState<string | null>(null);
  const [roleStatusMsg, setRoleStatusMsg] = useState<string | null>(null);
  const [roleErrorMsg, setRoleErrorMsg] = useState<string | null>(null);

  // Referee Console State (Action-First -> Player Menu -> Confirmar Registro)
  const [selectedRefId, setSelectedRefId] = useState<string>(state.referees[0]?.id ?? 'ref-f7-1');
  const [refDisciplineFilter, setRefDisciplineFilter] = useState<'ALL' | DisciplineId>('ALL');
  const [refGroupFilter, setRefGroupFilter] = useState<'ALL' | string>('ALL');
  const [refStageFilter, setRefStageFilter] = useState<'ALL' | MatchPhase>('ALL');
  const [refSortOrder, setRefSortOrder] = useState<MatchSortOrder>('newest');
  const [selectedMatchId, setSelectedMatchId] = useState<string>(
    focusedMatchId ?? state.matches.find((m) => m.status === 'EN_VIVO')?.id ?? state.matches[0]?.id ?? ''
  );

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

  useEffect(() => {
    if (isAdmin) {
      setSubTab(initialSubTab);
    } else if (canEditNews && !canReferee) {
      setSubTab('noticias');
    } else {
      setSubTab('arbitro');
    }
  }, [initialSubTab, isAdmin, canEditNews, canReferee]);

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

  const teamMap = useMemo(() => new Map(state.teams.map((t) => [t.id, t])), [state.teams]);
  const activeReferee = state.referees.find((r) => r.id === selectedRefId) ?? state.referees[0];

  const refereeSportMatches = useMemo(() => {
    return state.matches.filter((m) => {
      const sport = DISCIPLINE_MAP[m.disciplineId].sportType;
      if (activeReferee.sportType === 'basquetbol') {
        return sport === 'basquetbol' || sport === 'basquetbol3x3';
      }
      return sport === activeReferee.sportType;
    });
  }, [state.matches, activeReferee]);

  const refereeDisciplines = useMemo(() => {
    return DISCIPLINES.filter((d) => {
      if (activeReferee.sportType === 'basquetbol') {
        return d.sportType === 'basquetbol' || d.sportType === 'basquetbol3x3';
      }
      return d.sportType === activeReferee.sportType;
    });
  }, [activeReferee]);

  const refereeMatches = useMemo(() => {
    const filtered = filterMatchesByOrg(refereeSportMatches, {
      disciplineId: refDisciplineFilter,
      groupName: refGroupFilter,
      fase: refStageFilter,
    });
    return sortMatchesChronologically(filtered, refSortOrder);
  }, [refereeSportMatches, refDisciplineFilter, refGroupFilter, refStageFilter, refSortOrder]);

  const activeMatch: Match | undefined =
    refereeMatches.find((m) => m.id === selectedMatchId) ??
    state.matches.find((m) => m.id === selectedMatchId) ??
    refereeMatches[0] ??
    state.matches[0];

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
    setRefDisciplineFilter('ALL');
    setRefGroupFilter('ALL');
    setRefStageFilter('ALL');
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

  // RBAC Guard: Panel Oficial is exclusively for Árbitro Oficial, Prensa Oficial and Administrador UFRO
  if (!canAccessAdminPanel(currentUser)) {
    return (
      <div className="bg-white min-h-[75vh]">
        <div className="bg-[#0d0d0d] text-white border-b border-white/10">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
              Acceso Restringido · Dirección de Deportes UFRO
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight mt-2">
              Panel Oficial de Arbitraje, Prensa y Administración
            </h1>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
          <div className="border border-neutral-200 bg-[#f5f6f8] p-8 space-y-5">
            <div className="flex items-center gap-2.5 text-[#0d0d0d]">
              <Lock className="w-5 h-5 text-[#707ef9]" />
              <h2 className="font-display text-2xl font-bold uppercase tracking-wide">
                Sección exclusiva para Árbitros, Prensa y Administradores
              </h2>
            </div>
            <p className="text-sm text-neutral-700 leading-relaxed">
              {currentUser ? (
                <>
                  Tu sesión actual corresponde al rol{' '}
                  <strong>{ROLE_META[currentUser.role].label}</strong>. La Mesa Arbitral, Sala de
                  Prensa, gestión de roles de usuario, formato anual y sincronización con Google
                  Sheets requieren acreditación de <strong>Árbitro Oficial</strong>,{' '}
                  <strong>Prensa Oficial</strong> o <strong>Administrador UFRO</strong>.
                </>
              ) : (
                <>
                  Debes iniciar sesión con una cuenta acreditada de{' '}
                  <strong>Árbitro Oficial</strong>, <strong>Prensa Oficial</strong> o{' '}
                  <strong>Administrador UFRO</strong> para operar en el Panel Oficial.
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

  const effectiveSubTab: PanelSubTab = isAdmin
    ? subTab
    : canEditNews && !canReferee
    ? 'noticias'
    : 'arbitro';

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
                  ? 'Panel Oficial de Arbitraje, Prensa y Administración'
                  : currentUser?.role === 'prensa'
                  ? 'Sala de Prensa · Noticias del Campeonato'
                  : 'Consola Privada de Mesa Arbitral'}
              </h1>
              <p className="text-sm text-neutral-400 mt-2 max-w-2xl">
                {isAdmin
                  ? 'Control de marcadores en mesa arbitral, publicación de noticias destacadas, asignación de roles de usuario, formato anual y Google Sheets.'
                  : currentUser?.role === 'prensa'
                  ? 'Publicación y edición de anuncios destacados en portada, gestión de borradores y generación automática de noticias breves del campeonato.'
                  : 'Control privado de marcadores por disciplina, validación de planillas físicas con IA y cierre oficial para publicación de resultados.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1 bg-white/5 p-1 self-start lg:self-auto">
              {canReferee && (
                <button
                  type="button"
                  onClick={() => setSubTab('arbitro')}
                  className={`px-3.5 py-2 text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap ${
                    effectiveSubTab === 'arbitro'
                      ? 'bg-[#707ef9] text-white'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  Mesa Arbitral
                </button>
              )}
              {canEditNews && (
                <button
                  type="button"
                  onClick={() => setSubTab('noticias')}
                  className={`px-3.5 py-2 text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap ${
                    effectiveSubTab === 'noticias'
                      ? 'bg-[#707ef9] text-white'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  Noticias ({state.news.length})
                </button>
              )}
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => setSubTab('portada')}
                    className={`px-3.5 py-2 text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap ${
                      effectiveSubTab === 'portada'
                        ? 'bg-[#707ef9] text-white'
                        : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    Portada
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubTab('partidos')}
                    className={`px-3.5 py-2 text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap ${
                      effectiveSubTab === 'partidos'
                        ? 'bg-[#707ef9] text-white'
                        : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    Partidos ({state.matches.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubTab('equipos')}
                    className={`px-3.5 py-2 text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap ${
                      effectiveSubTab === 'equipos'
                        ? 'bg-[#707ef9] text-white'
                        : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    Equipos ({state.teams.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubTab('jugadores')}
                    className={`px-3.5 py-2 text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap ${
                      effectiveSubTab === 'jugadores'
                        ? 'bg-[#707ef9] text-white'
                        : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    Jugadores ({state.players.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubTab('votaciones')}
                    className={`px-3.5 py-2 text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap ${
                      effectiveSubTab === 'votaciones'
                        ? 'bg-[#707ef9] text-white'
                        : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    Votaciones / MVP
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubTab('toty')}
                    className={`px-3.5 py-2 text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap ${
                      effectiveSubTab === 'toty'
                        ? 'bg-[#707ef9] text-white'
                        : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    Configuración TOTY
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubTab('usuarios')}
                    className={`px-3.5 py-2 text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap ${
                      effectiveSubTab === 'usuarios'
                        ? 'bg-[#707ef9] text-white'
                        : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    Usuarios ({state.users.length})
                  </button>
                </>
              )}
              {canManageAdminTabs && (
                <>
                  <button
                    type="button"
                    onClick={() => setSubTab('formato')}
                    className={`px-3.5 py-2 text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap ${
                      effectiveSubTab === 'formato'
                        ? 'bg-[#707ef9] text-white'
                        : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    Períodos y Formato
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubTab('sheets')}
                    className={`px-3.5 py-2 text-xs font-display font-bold uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap ${
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
        {effectiveSubTab === 'arbitro' && canReferee && (
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
                <div className="space-y-3">
                  <MatchFilterBar
                    idPrefix="referee-matches"
                    matches={refereeSportMatches}
                    disciplineFilter={refDisciplineFilter}
                    onDisciplineChange={(val) => {
                      setRefDisciplineFilter(val);
                      setRefGroupFilter('ALL');
                    }}
                    disciplineOptions={refereeDisciplines}
                    groupFilter={refGroupFilter}
                    onGroupChange={setRefGroupFilter}
                    stageFilter={refStageFilter}
                    onStageChange={setRefStageFilter}
                    sortOrder={refSortOrder}
                    onSortOrderChange={setRefSortOrder}
                    filteredCount={refereeMatches.length}
                    totalCount={refereeSportMatches.length}
                    compact
                  />

                  <div className="bg-[#f5f6f8] border border-neutral-200 p-3.5">

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label
                      htmlFor="ref-match-select"
                      className="text-xs font-medium uppercase tracking-wider text-neutral-600"
                    >
                      Encuentro ({refereeMatches.length} disponibles)
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
                      className="sm:w-[26rem] bg-white border border-neutral-300 px-3 py-2 text-sm font-medium text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
                    >
                      {refereeMatches.length === 0 ? (
                        <option value={activeMatch.id}>
                          Sin encuentros con estos filtros (manteniendo actual)
                        </option>
                      ) : (
                        refereeMatches.map((m) => (
                          <option key={m.id} value={m.id}>
                            [{m.status === 'EN_VIVO' ? 'EN VIVO' : m.status === 'FINALIZADO' ? 'FINAL' : 'PROG'}]{' '}
                            {DISCIPLINE_MAP[m.disciplineId].nombreCorto} · {m.fase} ({m.groupName}) ·{' '}
                            {teamMap.get(m.homeTeamId)?.nombre} vs {teamMap.get(m.awayTeamId)?.nombre}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  </div>
                </div>

                {/* Upgraded Sport-Specific Live Scoreboard, Substitutions & Action Console */}
                <LiveScoreboardPanel
                  match={activeMatch}
                  sportType={activeMatchMeta.sportType}
                  disciplineName={activeMatchMeta.nombre}
                  homeTeam={homeTeam}
                  awayTeam={awayTeam}
                  matchPlayers={matchPlayers}
                  onUpdateMatch={onUpdateMatch}
                />
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

        {/* TAB 1B (ADMIN ONLY): EDIT PAST & SCHEDULED MATCHES */}
        {effectiveSubTab === 'partidos' && isAdmin && (
          <AdminMatchEditor
            state={state}
            initialEditMatchId={focusedMatchId}
            onUpdateMatch={(updated) => onUpdateMatch(updated)}
            onAddMatch={onAddMatch}
          />
        )}

        {/* TAB 1C (ADMIN ONLY): ADD, MODIFY & DELETE TEAMS */}
        {effectiveSubTab === 'equipos' && isAdmin && (
          <AdminTeamsManager
            state={state}
            onAddTeam={onAddTeam}
            onUpdateTeam={onUpdateTeam}
            onDeleteTeam={onDeleteTeam}
          />
        )}

        {/* TAB 1D (ADMIN ONLY): ADD, MODIFY & DELETE PLAYERS */}
        {effectiveSubTab === 'jugadores' && isAdmin && (
          <AdminPlayersManager
            state={state}
            onAddPlayer={onAddPlayer}
            onUpdatePlayer={onUpdatePlayer}
            onDeletePlayer={onDeletePlayer}
          />
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

        {/* TAB 3: PERIOD TOGGLES + CONFIGURABLE TOURNAMENT FORMAT & CUPOS */}
        {effectiveSubTab === 'formato' && canManageAdminTabs && (
          <div className="space-y-10">
            {/* Instant Period Control Matrix (Inscripciones & Transferencias ON/OFF) */}
            <section className="border border-neutral-200 bg-white">
              <div className="bg-[#0d0d0d] text-white p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Power className="w-5 h-5 text-[#707ef9] shrink-0 mt-1" />
                  <div>
                    <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
                      Control Inmediato en Firestore
                    </p>
                    <h2 className="font-display text-2xl sm:text-3xl uppercase tracking-wide">
                      Interruptores de Período de Inscripciones y Transferencias
                    </h2>
                    <p className="text-xs text-neutral-400 mt-1">
                      Enciende o apaga las ventanas de inscripciones y transferencias por disciplina
                      o de forma masiva en un clic. Los cambios se aplican al instante.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      DISCIPLINES.forEach((d) => {
                        const cfg = state.configs[d.id];
                        if (!cfg.inscripcionesAbiertas) {
                          onUpdateConfig(d.id, { ...cfg, inscripcionesAbiertas: true }, false);
                        }
                      });
                      setDraftConfig((c) => ({ ...c, inscripcionesAbiertas: true }));
                      setConfigSavedMsg('Período de inscripciones ENCENDIDO en las 8 disciplinas.');
                    }}
                    className="px-3 py-2 bg-[#707ef9] hover:bg-[#5766eb] text-white text-xs font-display uppercase tracking-wider cursor-pointer"
                  >
                    Abrir todas Inscripciones
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      DISCIPLINES.forEach((d) => {
                        const cfg = state.configs[d.id];
                        if (cfg.inscripcionesAbiertas) {
                          onUpdateConfig(d.id, { ...cfg, inscripcionesAbiertas: false }, false);
                        }
                      });
                      setDraftConfig((c) => ({ ...c, inscripcionesAbiertas: false }));
                      setConfigSavedMsg('Período de inscripciones APAGADO en las 8 disciplinas.');
                    }}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-display uppercase tracking-wider cursor-pointer"
                  >
                    Cerrar todas Inscripciones
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      DISCIPLINES.forEach((d) => {
                        const cfg = state.configs[d.id];
                        if (!cfg.transferenciasAbiertas) {
                          onUpdateConfig(d.id, { ...cfg, transferenciasAbiertas: true }, false);
                        }
                      });
                      setDraftConfig((c) => ({ ...c, transferenciasAbiertas: true }));
                      setConfigSavedMsg('Ventana de transferencias ENCENDIDA en las 8 disciplinas.');
                    }}
                    className="px-3 py-2 bg-[#707ef9] hover:bg-[#5766eb] text-white text-xs font-display uppercase tracking-wider cursor-pointer"
                  >
                    Abrir todas Transferencias
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      DISCIPLINES.forEach((d) => {
                        const cfg = state.configs[d.id];
                        if (cfg.transferenciasAbiertas) {
                          onUpdateConfig(d.id, { ...cfg, transferenciasAbiertas: false }, false);
                        }
                      });
                      setDraftConfig((c) => ({ ...c, transferenciasAbiertas: false }));
                      setConfigSavedMsg('Ventana de transferencias APAGADA en las 8 disciplinas.');
                    }}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-display uppercase tracking-wider cursor-pointer"
                  >
                    Cerrar todas Transferencias
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#f5f6f8] border-b border-neutral-200 text-xs text-neutral-500 uppercase">
                      <th className="py-3 px-4 font-medium">Disciplina</th>
                      <th className="py-3 px-4 font-medium">Fase actual</th>
                      <th className="py-3 px-4 text-center font-medium">Inscripciones</th>
                      <th className="py-3 px-4 text-center font-medium">Transferencias</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {DISCIPLINES.map((d) => {
                      const cfg = state.configs[d.id];
                      const toggleInscripciones = () => {
                        const nextCfg: DisciplineFormatConfig = {
                          ...cfg,
                          inscripcionesAbiertas: !cfg.inscripcionesAbiertas,
                        };
                        onUpdateConfig(d.id, nextCfg, false);
                        if (d.id === configDiscId) setDraftConfig(nextCfg);
                        setConfigSavedMsg(
                          `Inscripciones de ${d.nombreCorto}: ${nextCfg.inscripcionesAbiertas ? 'ENCENDIDAS' : 'APAGADAS'} y guardadas en Firestore.`
                        );
                      };
                      const toggleTransferencias = () => {
                        const nextCfg: DisciplineFormatConfig = {
                          ...cfg,
                          transferenciasAbiertas: !cfg.transferenciasAbiertas,
                        };
                        onUpdateConfig(d.id, nextCfg, false);
                        if (d.id === configDiscId) setDraftConfig(nextCfg);
                        setConfigSavedMsg(
                          `Transferencias de ${d.nombreCorto}: ${nextCfg.transferenciasAbiertas ? 'ENCENDIDAS' : 'APAGADAS'} y guardadas en Firestore.`
                        );
                      };
                      return (
                        <tr key={d.id} className="hover:bg-[#f9fafb]">
                          <td className="py-3 px-4">
                            <p className="font-bold text-[#0d0d0d]">{d.nombre}</p>
                          </td>
                          <td className="py-3 px-4 text-xs text-neutral-600 uppercase">
                            {cfg.faseActual.replace('_', ' ')}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={cfg.inscripcionesAbiertas}
                              aria-label={`Inscripciones para ${d.nombre}`}
                              onClick={toggleInscripciones}
                              className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-display uppercase tracking-wider border transition-colors cursor-pointer ${
                                cfg.inscripcionesAbiertas
                                  ? 'bg-[#707ef9] border-[#707ef9] text-white'
                                  : 'bg-white border-neutral-300 text-neutral-600 hover:border-[#0d0d0d]'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                              <span>{cfg.inscripcionesAbiertas ? 'ABIERTAS' : 'CERRADAS'}</span>
                            </button>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={cfg.transferenciasAbiertas}
                              aria-label={`Transferencias para ${d.nombre}`}
                              onClick={toggleTransferencias}
                              className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-display uppercase tracking-wider border transition-colors cursor-pointer ${
                                cfg.transferenciasAbiertas
                                  ? 'bg-[#0d0d0d] border-[#0d0d0d] text-white'
                                  : 'bg-white border-neutral-300 text-neutral-600 hover:border-[#0d0d0d]'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                              <span>{cfg.transferenciasAbiertas ? 'ABIERTAS' : 'CERRADAS'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

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
                        {cfg.playoffsIdaYVuelta ? ' · Ida y Vuelta' : ''}
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

                <label className="inline-flex items-center gap-2.5 text-sm font-medium text-[#0d0d0d] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draftConfig.incluyeTercerLugar !== false}
                    onChange={(e) =>
                      setDraftConfig((c) => ({ ...c, incluyeTercerLugar: e.target.checked }))
                    }
                    className="accent-[#707ef9] w-4 h-4"
                  />
                  <span>Incluir partido por el Tercer Lugar en Playoffs</span>
                </label>

                <label className="inline-flex items-center gap-2.5 text-sm font-medium text-[#0d0d0d] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(draftConfig.playoffsIdaYVuelta)}
                    onChange={(e) =>
                      setDraftConfig((c) => ({ ...c, playoffsIdaYVuelta: e.target.checked }))
                    }
                    className="accent-[#707ef9] w-4 h-4"
                  />
                  <span>Playoffs con partidos de Ida y Vuelta (marcador global)</span>
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
          </div>
        )}

        {/* TAB 4: MULTI-MASTER GOOGLE SHEETS WORKSPACE INTEGRATION */}
        {effectiveSubTab === 'sheets' && canManageAdminTabs && (
          <MasterSheetsPanel
            state={state}
            pendingSyncKeys={pendingSyncKeys}
            deletedIds={deletedIds}
            autoSyncSessionApproved={autoSyncSessionApproved}
            autoSyncState={autoSyncState}
            onSaveMasterSheets={onSaveMasterSheets}
            onApproveAutoSyncSession={onApproveAutoSyncSession}
            onClearPendingSyncKeys={onClearPendingSyncKeys}
            onClearDeletedTombstones={onClearDeletedTombstones}
            onApplySheetImports={onApplySheetImports}
            onMarkSynced={onMarkSynced}
          />
        )}

        {/* TAB 5: NOTICIAS DEL CAMPEONATO (ADMIN & PRENSA OFICIAL) */}
        {effectiveSubTab === 'noticias' && canEditNews && currentUser && (
          <AdminNewsManager
            state={state}
            currentUser={currentUser}
            editorialPhotos={editorialPhotos}
            onAddNews={onAddNews}
            onUpdateNews={onUpdateNews}
            onDeleteNews={onDeleteNews}
          />
        )}

        {/* TAB 6: NOMINADOS MVP DEL CAMPEONATO (SOLO ADMIN) */}
        {effectiveSubTab === 'votaciones' && isAdmin && (
          <AdminAwardsManager state={state} onSaveAwardNominees={onSaveAwardNominees} />
        )}

        {/* TAB 7: CONFIGURACIÓN TOTY POR DISCIPLINA Y CONTEO EN TIEMPO REAL (SOLO ADMIN) */}
        {effectiveSubTab === 'toty' && isAdmin && (
          <AdminTotyManager
            state={state}
            totyLastSyncAt={totyLastSyncAt}
            totyRealtimeActive={totyRealtimeActive}
            onSaveTotyConfig={onSaveTotyConfig}
            onResetTotyConfig={onResetTotyConfig}
          />
        )}

        {/* TAB 8: PORTADA DESTACADA (SOLO ADMIN) */}
        {effectiveSubTab === 'portada' && isAdmin && (
          <AdminFeaturedManager
            state={state}
            onSaveHomeFeatured={onSaveHomeFeatured}
          />
        )}
      </div>
    </div>
  );
}
