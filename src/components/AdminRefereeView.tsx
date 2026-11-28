import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Lock,
  Newspaper,
  Power,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Sliders,
  Sparkles,
  Upload,
  UserCog,
  Users,
} from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
import {
  computeMatchesAttendanceOverview,
  getNormalizedMatchAttendance,
  markMatchAttendanceOmitted,
} from '../domain/attendanceEngine';
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
  canAccessGeneralAdminPanel,
  canAccessPressPanel,
  canAccessRefereePanel,
  canAssignReferees,
  canEditMatchInRefereeDesk,
  canManageFormatAndSheets,
  canManageNews,
  canManageRoles,
  canRefereeMatches,
  canUploadPhotos,
  canViewMatchInRefereeDesk,
  getAccessibleOfficialPanels,
  getRefereeChiefDisciplines,
  isRefereeChief,
  ROLE_META,
  validateRoleChange,
  type OfficialPanelId,
} from '../domain/rbacEngine';
import { getFirebaseIdToken } from '../services/firebaseAuth';
import type { Editorial2025Photos } from '../services/googleDrive';
import type { DeletedEntityIds, SheetImportDelta } from '../domain/sheetsMergeEngine';
import type { SyncHealthSummary } from '../domain/syncHealthEngine';
import firebaseConfig from '../../firebase-applet-config.json';
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
  PhotoEntry,
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
import { AdminFormatConfigSection } from './admin/AdminFormatConfigSection';
import { AdminUsersRolesSection } from './admin/AdminUsersRolesSection';
import { LiveScoreboardPanel } from './LiveScoreboardPanel';
import { MasterSheetsPanel, type AutoSyncStatusInfo } from './MasterSheetsPanel';
import { MatchFilterBar } from './MatchFilterBar';
import { PressGalleryPanel } from './PressGalleryPanel';
import { RefereeAssignmentPanel } from './RefereeAssignmentPanel';

export type PanelSubTab =
  | 'arbitro'
  | 'designaciones'
  | 'galeria'
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
  onBulkUpdateTeams?: (
    updates: Array<{ team: Team; clearAnioFundacion?: boolean }>
  ) => Promise<void> | void;
  onAddPlayer: (player: Player) => void;
  onUpdatePlayer: (player: Player) => void;
  onDeletePlayer: (player: Player) => void;
  onAddNews: (article: NewsArticle) => Promise<void> | void;
  onUpdateNews: (article: NewsArticle) => Promise<void> | void;
  onDeleteNews: (article: NewsArticle) => Promise<void> | void;
  onAddPhoto: (photo: PhotoEntry) => Promise<void> | void;
  onDeletePhoto: (photoId: string) => Promise<void> | void;
  onSaveDriveRootFolder?: (folderId: string, folderName: string) => Promise<void> | void;
  onUpdateConfig: (
    disciplineId: DisciplineId,
    config: DisciplineFormatConfig,
    rebuildGroups: boolean
  ) => void;
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
  onSaveTotyDeadline?: (deadlineIso: string | null) => Promise<void>;
  onMigrateTotyFromFirestore?: () => Promise<{
    migratedBallots: number;
    migratedConfigs: number;
  }>;
  onImportLocalTotyBackup?: (payload: {
    ballots: TournamentState['totyBallots'];
    configs: TournamentState['totyConfigs'];
  }) => Promise<{
    importedBallots: number;
    importedConfigs: number;
  }>;
  onSaveHomeFeatured: (config: HomeFeaturedConfig) => Promise<void>;
  onRefreshUsers?: () => Promise<void> | void;
  syncHealth: SyncHealthSummary;
  onRetryCloudSync: () => void;
  onOpenAuth: () => void;
}

const GENERAL_SUB_TABS: PanelSubTab[] = [
  'partidos',
  'equipos',
  'jugadores',
  'formato',
  'usuarios',
  'votaciones',
  'toty',
  'portada',
  'sheets',
];

const PRESS_SUB_TABS: PanelSubTab[] = ['galeria', 'noticias'];
const REFEREE_SUB_TABS: PanelSubTab[] = ['designaciones', 'arbitro'];

function resolvePanelForSubTab(subTab: PanelSubTab): OfficialPanelId {
  if (PRESS_SUB_TABS.includes(subTab)) return 'prensa';
  if (REFEREE_SUB_TABS.includes(subTab)) return 'arbitraje';
  return 'general';
}

function getDefaultSubTabForPanel(
  panel: OfficialPanelId,
  user: AppUserProfile | null
): PanelSubTab {
  if (panel === 'general') return 'partidos';
  if (panel === 'prensa') {
    if (user?.role === 'fotografo') return 'galeria';
    if (canManageNews(user)) return 'noticias';
    return 'galeria';
  }
  if (canAssignReferees(user) && isRefereeChief(user)) return 'designaciones';
  return 'arbitro';
}

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
  ctx.fillText(
    `FECHA: ${new Date().toISOString().slice(0, 10)}   SEDE: UNIVERSIDAD DE LA FRONTERA`,
    48,
    182
  );

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
  onBulkUpdateTeams,
  onAddPlayer,
  onUpdatePlayer,
  onDeletePlayer,
  onAddNews,
  onUpdateNews,
  onDeleteNews,
  onAddPhoto,
  onDeletePhoto,
  onSaveDriveRootFolder,
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
  onSaveTotyDeadline,
  onMigrateTotyFromFirestore,
  onImportLocalTotyBackup,
  onSaveHomeFeatured,
  onRefreshUsers,
  syncHealth,
  onRetryCloudSync,
  onOpenAuth,
}: AdminRefereeViewProps) {
  const accessiblePanels = useMemo(
    () => getAccessibleOfficialPanels(currentUser),
    [currentUser]
  );
  const canGeneral = canAccessGeneralAdminPanel(currentUser);
  const canPress = canAccessPressPanel(currentUser);
  const canRefPanel = canAccessRefereePanel(currentUser);

  const canManageAdminTabs = canManageFormatAndSheets(currentUser);
  const canEditRoles = canManageRoles(currentUser);
  const canEditNews = canManageNews(currentUser);
  const canUpload = canUploadPhotos(currentUser);
  const canAssign = canAssignReferees(currentUser);
  const canReferee = canRefereeMatches(currentUser);

  const [activePanel, setActivePanel] = useState<OfficialPanelId>(() => {
    const requestedPanel = resolvePanelForSubTab(initialSubTab);
    if (accessiblePanels.includes(requestedPanel)) return requestedPanel;
    return accessiblePanels[0] ?? 'arbitraje';
  });

  const [subTab, setSubTab] = useState<PanelSubTab>(() => {
    const requestedPanel = resolvePanelForSubTab(initialSubTab);
    if (accessiblePanels.includes(requestedPanel)) return initialSubTab;
    return getDefaultSubTabForPanel(accessiblePanels[0] ?? 'arbitraje', currentUser);
  });

  // Sync panel & subTab when initialSubTab or role changes
  useEffect(() => {
    if (accessiblePanels.length === 0) return;
    const requestedPanel = resolvePanelForSubTab(initialSubTab);
    if (accessiblePanels.includes(requestedPanel)) {
      setActivePanel(requestedPanel);
      setSubTab(initialSubTab);
    } else if (!accessiblePanels.includes(activePanel)) {
      const fallbackPanel = accessiblePanels[0];
      setActivePanel(fallbackPanel);
      setSubTab(getDefaultSubTabForPanel(fallbackPanel, currentUser));
    }
  }, [initialSubTab, accessiblePanels, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Referee Console State (strictly scoped by RBAC)
  const [refDisciplineFilter, setRefDisciplineFilter] = useState<'ALL' | DisciplineId>('ALL');
  const [refGroupFilter, setRefGroupFilter] = useState<'ALL' | string>('ALL');
  const [refStageFilter, setRefStageFilter] = useState<'ALL' | MatchPhase>('ALL');
  const [refSortOrder, setRefSortOrder] = useState<MatchSortOrder>('newest');
  const [selectedMatchId, setSelectedMatchId] = useState<string>(focusedMatchId ?? '');

  // Scoresheet AI & Manual Validation State
  const [scoresheetImage, setScoresheetImage] = useState<string | null>(null);
  const [scoresheetMime, setScoresheetMime] = useState<string>('image/png');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<(AiScoresheetResult & { matchesLive?: boolean }) | null>(
    null
  );
  const [manualHome, setManualHome] = useState<string>('');
  const [manualAway, setManualAway] = useState<string>('');
  const [manualNotes, setManualNotes] = useState<string>('');
  const [validationBanner, setValidationBanner] = useState<string | null>(null);

  useEffect(() => {
    if (focusedMatchId) {
      setSelectedMatchId(focusedMatchId);
      const found = state.matches.find((m) => m.id === focusedMatchId);
      if (found) {
        setManualHome(String(found.homeScore));
        setManualAway(String(found.awayScore));
      }
      setAiResult(null);
      setScoresheetImage(null);
      setAiError(null);
      setValidationBanner(null);
    }
  }, [focusedMatchId, state.matches]);

  const teamMap = useMemo(() => new Map(state.teams.map((t) => [t.id, t])), [state.teams]);

  // Role-scoped matches visible in Mesa Arbitral:
  // - Admin: all matches
  // - Jefe de Árbitros: all matches in their unified discipline
  // - Árbitro designado: ONLY matches assigned to them
  const scopedRefereeMatches = useMemo(() => {
    return state.matches.filter((m) => canViewMatchInRefereeDesk(currentUser, m));
  }, [state.matches, currentUser]);

  const refereeDisciplineOptions = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'admin') return DISCIPLINES;
    if (isRefereeChief(currentUser)) {
      const allowed = new Set(getRefereeChiefDisciplines(currentUser));
      return DISCIPLINES.filter((d) => allowed.has(d.id));
    }
    const assignedDiscIds = new Set(scopedRefereeMatches.map((m) => m.disciplineId));
    return DISCIPLINES.filter((d) => assignedDiscIds.has(d.id));
  }, [currentUser, scopedRefereeMatches]);

  const refereeMatches = useMemo(() => {
    const filtered = filterMatchesByOrg(scopedRefereeMatches, {
      disciplineId: refDisciplineFilter,
      groupName: refGroupFilter,
      fase: refStageFilter,
    });
    return sortMatchesChronologically(filtered, refSortOrder);
  }, [scopedRefereeMatches, refDisciplineFilter, refGroupFilter, refStageFilter, refSortOrder]);

  const activeMatch: Match | undefined = useMemo(() => {
    return (
      refereeMatches.find((m) => m.id === selectedMatchId) ??
      scopedRefereeMatches.find((m) => m.id === selectedMatchId) ??
      refereeMatches[0] ??
      scopedRefereeMatches[0]
    );
  }, [refereeMatches, scopedRefereeMatches, selectedMatchId]);

  const activeMatchMeta = activeMatch ? DISCIPLINE_MAP[activeMatch.disciplineId] : undefined;
  const homeTeam = activeMatch ? teamMap.get(activeMatch.homeTeamId) : undefined;
  const awayTeam = activeMatch ? teamMap.get(activeMatch.awayTeamId) : undefined;
  const canEditActiveMatch = activeMatch
    ? canEditMatchInRefereeDesk(currentUser, activeMatch)
    : false;
  const recorderDisplayName = currentUser?.displayName || 'Árbitro Oficial';

  const matchPlayers = useMemo(() => {
    if (!activeMatch) return [];
    return state.players.filter(
      (p) => p.teamId === activeMatch.homeTeamId || p.teamId === activeMatch.awayTeamId
    );
  }, [state.players, activeMatch]);

  useEffect(() => {
    if (!activeMatch) return;
    setManualHome(String(activeMatch.homeScore));
    setManualAway(String(activeMatch.awayScore));
  }, [activeMatch?.id, activeMatch?.homeScore, activeMatch?.awayScore]);

  const handleOpenMatchFromAssignment = (matchId: string) => {
    setSelectedMatchId(matchId);
    setActivePanel('arbitraje');
    setSubTab('arbitro');
    setAiResult(null);
    setScoresheetImage(null);
    setAiError(null);
    setValidationBanner(null);
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
          'Sesión de Firebase inactiva. Inicia sesión con Google para validar planillas con IA.'
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
    if (!activeMatch || !canEditActiveMatch) return;
    const finalHome =
      method === 'IA_AUTOMATICA' && aiResult
        ? aiResult.homeScoreDetected
        : Math.max(0, Number(manualHome) || 0);
    const finalAway =
      method === 'IA_AUTOMATICA' && aiResult
        ? aiResult.awayScoreDetected
        : Math.max(0, Number(manualAway) || 0);

    if (method === 'MANUAL_ARBITRO' && manualNotes.trim().length < 5) {
      setAiError('Ingresa una breve nota arbitral confirmando el marcador.');
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
        refereeName: recorderDisplayName,
        method,
        ...(scoresheetImage ? { imagePreview: scoresheetImage } : {}),
        ...(aiResult ? { aiResult } : {}),
        ...(method === 'MANUAL_ARBITRO' && manualNotes.trim()
          ? { manualNotes: manualNotes.trim() }
          : {}),
        finalHomeScore: finalHome,
        finalAwayScore: finalAway,
      },
    });

    setAiError(null);
    setValidationBanner(
      method === 'IA_AUTOMATICA'
        ? `Partido cerrado con Validación IA (${finalHome} - ${finalAway}). Tablas actualizadas.`
        : `Partido cerrado por ${recorderDisplayName} (${finalHome} - ${finalAway}). Tablas actualizadas.`
    );
  };



  const handleSelectPanel = (panel: OfficialPanelId) => {
    setActivePanel(panel);
    const currentValid =
      (panel === 'general' && GENERAL_SUB_TABS.includes(subTab)) ||
      (panel === 'prensa' && PRESS_SUB_TABS.includes(subTab)) ||
      (panel === 'arbitraje' && REFEREE_SUB_TABS.includes(subTab));
    if (!currentValid) {
      setSubTab(getDefaultSubTabForPanel(panel, currentUser));
    }
  };

  // RBAC Guard: Restricted view (Obsidian Dark)
  if (!canAccessAdminPanel(currentUser)) {
    return (
      <div className="bg-[#050507] text-zinc-100 min-h-[78vh]">
        <div className="border-b border-white/[0.08]">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#a5b0ff] font-medium">
              Acceso Restringido · Intercarreras UFRO
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-white mt-2">
              Panel <span className="font-editorial font-normal text-[#c8ceff]">Oficial</span>
            </h1>
          </div>
        </div>

        <div className="max-w-xl mx-auto px-4 sm:px-6 py-16">
          <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-8 space-y-5">
            <div className="w-11 h-11 rounded-2xl bg-[#707ef9]/15 border border-[#707ef9]/30 flex items-center justify-center">
              <Lock className="w-5 h-5 text-[#a5b0ff]" />
            </div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white">
              Sección acreditada
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {currentUser ? (
                <>
                  Tu cuenta tiene rol{' '}
                  <span className="text-white font-medium">{ROLE_META[currentUser.role].label}</span>.
                  El acceso a Administración General, Panel de Prensa o Panel de Arbitraje requiere
                  acreditación oficial.
                </>
              ) : (
                <>
                  Inicia sesión con una cuenta acreditada de Administración, Moderación, Prensa,
                  Fotografía o Arbitraje para operar este panel.
                </>
              )}
            </p>
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-6 py-3 rounded-full bg-white hover:bg-[#c8ceff] text-[#050507] text-xs font-semibold tracking-wide transition-colors cursor-pointer"
            >
              Iniciar sesión con Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Resolve effective panel & subTab safely
  const effectivePanel: OfficialPanelId = accessiblePanels.includes(activePanel)
    ? activePanel
    : accessiblePanels[0];

  const effectiveSubTab: PanelSubTab = (() => {
    if (effectivePanel === 'general' && canGeneral) {
      return GENERAL_SUB_TABS.includes(subTab) ? subTab : 'partidos';
    }
    if (effectivePanel === 'prensa' && canPress) {
      if (subTab === 'galeria' && canUpload) return 'galeria';
      if (subTab === 'noticias' && canEditNews) return 'noticias';
      return canUpload ? 'galeria' : 'noticias';
    }
    if (effectivePanel === 'arbitraje' && canRefPanel) {
      if (subTab === 'designaciones' && canAssign) return 'designaciones';
      if (subTab === 'arbitro' && canReferee) return 'arbitro';
      return canAssign ? 'designaciones' : 'arbitro';
    }
    return 'arbitro';
  })();

  const panelMeta: Record<
    OfficialPanelId,
    { label: string; headline: string; italic: string; subtitle: string }
  > = {
    general: {
      label: 'Administración General',
      headline: 'Administración',
      italic: 'General',
      subtitle: 'Partidos, equipos, jugadores, períodos, roles, votaciones y Google Sheets.',
    },
    prensa: {
      label: 'Panel de Prensa',
      headline: 'Panel de',
      italic: 'Prensa',
      subtitle: 'Galería fotográfica oficial y redacción de noticias del campeonato.',
    },
    arbitraje: {
      label: 'Panel de Arbitraje',
      headline: 'Panel de',
      italic: 'Arbitraje',
      subtitle: 'Designación por disciplina unificada, mesa arbitral, asistencia y cierre con planilla.',
    },
  };

  const currentMeta = panelMeta[effectivePanel];

  const subTabClass = (active: boolean) =>
    `px-4 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
      active
        ? 'bg-[#707ef9] text-white shadow-[0_0_18px_rgba(112,126,249,0.28)]'
        : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
    }`;

  return (
    <div className="bg-[#050507] text-zinc-100 min-h-[80vh]">
      {/* Obsidian Editorial Header + 3-Panel Role Switcher */}
      <div className="border-b border-white/[0.08] bg-[#08080c]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#a5b0ff] font-medium">
                {currentUser ? ROLE_META[currentUser.role].label : 'Consola Oficial'} · Temporada{' '}
                {state.temporada}
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-white mt-2">
                {currentMeta.headline}{' '}
                <span className="font-editorial font-normal text-[#c8ceff]">
                  {currentMeta.italic}
                </span>
              </h1>
              <p className="text-sm text-zinc-400 mt-2 max-w-2xl">{currentMeta.subtitle}</p>
            </div>

            {/* 3 Role-Scoped Panel Switcher (only panels accessible to the current role) */}
            {accessiblePanels.length > 1 && (
              <div
                role="tablist"
                aria-label="Paneles oficiales"
                className="inline-flex flex-wrap items-center gap-1.5 rounded-full bg-[#101016] border border-white/[0.08] p-1.5 self-start lg:self-auto"
              >
                {accessiblePanels.includes('general') && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={effectivePanel === 'general'}
                    onClick={() => handleSelectPanel('general')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                      effectivePanel === 'general'
                        ? 'bg-white text-[#050507]'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Administración General</span>
                  </button>
                )}
                {accessiblePanels.includes('prensa') && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={effectivePanel === 'prensa'}
                    onClick={() => handleSelectPanel('prensa')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                      effectivePanel === 'prensa'
                        ? 'bg-white text-[#050507]'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Newspaper className="w-3.5 h-3.5" />
                    <span>Panel de Prensa</span>
                  </button>
                )}
                {accessiblePanels.includes('arbitraje') && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={effectivePanel === 'arbitraje'}
                    onClick={() => handleSelectPanel('arbitraje')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                      effectivePanel === 'arbitraje'
                        ? 'bg-white text-[#050507]'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Panel de Arbitraje</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sub-tab Strip scoped to the active Panel */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/[0.06]">
            {effectivePanel === 'general' && canGeneral && (
              <>
                <button
                  type="button"
                  onClick={() => setSubTab('partidos')}
                  className={subTabClass(effectiveSubTab === 'partidos')}
                >
                  Partidos ({state.matches.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab('equipos')}
                  className={subTabClass(effectiveSubTab === 'equipos')}
                >
                  Equipos ({state.teams.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab('jugadores')}
                  className={subTabClass(effectiveSubTab === 'jugadores')}
                >
                  Jugadores ({state.players.length})
                </button>
                {canManageAdminTabs && (
                  <button
                    type="button"
                    onClick={() => setSubTab('formato')}
                    className={subTabClass(effectiveSubTab === 'formato')}
                  >
                    Períodos y Formato
                  </button>
                )}
                {canEditRoles && (
                  <button
                    type="button"
                    onClick={() => setSubTab('usuarios')}
                    className={subTabClass(effectiveSubTab === 'usuarios')}
                  >
                    Usuarios ({state.users.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSubTab('votaciones')}
                  className={subTabClass(effectiveSubTab === 'votaciones')}
                >
                  Votaciones MVP
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab('toty')}
                  className={subTabClass(effectiveSubTab === 'toty')}
                >
                  TOTYs
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab('portada')}
                  className={subTabClass(effectiveSubTab === 'portada')}
                >
                  Portada
                </button>
                {canManageAdminTabs && (
                  <button
                    type="button"
                    onClick={() => setSubTab('sheets')}
                    className={subTabClass(effectiveSubTab === 'sheets')}
                  >
                    Google Sheets
                  </button>
                )}
              </>
            )}

            {effectivePanel === 'prensa' && canPress && (
              <>
                {canUpload && (
                  <button
                    type="button"
                    onClick={() => setSubTab('galeria')}
                    className={subTabClass(effectiveSubTab === 'galeria')}
                  >
                    Galería y Fotografía ({state.photos.length})
                  </button>
                )}
                {canEditNews && (
                  <button
                    type="button"
                    onClick={() => setSubTab('noticias')}
                    className={subTabClass(effectiveSubTab === 'noticias')}
                  >
                    Noticias ({state.news.length})
                  </button>
                )}
              </>
            )}

            {effectivePanel === 'arbitraje' && canRefPanel && (
              <>
                {canAssign && (
                  <button
                    type="button"
                    onClick={() => setSubTab('designaciones')}
                    className={subTabClass(effectiveSubTab === 'designaciones')}
                  >
                    Designación de Árbitros
                  </button>
                )}
                {canReferee && (
                  <button
                    type="button"
                    onClick={() => setSubTab('arbitro')}
                    className={subTabClass(effectiveSubTab === 'arbitro')}
                  >
                    Mesa Arbitral ({scopedRefereeMatches.length})
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* ================= ESTADO DE SINCRONIZACIÓN (SOLO ADMINISTRACIÓN GENERAL) ================= */}
        {effectivePanel === 'general' && canGeneral && (
          <section
            data-testid="admin-sync-health-panel"
            aria-label="Estado de sincronización con Firestore"
            className={`mb-8 rounded-3xl border transition-colors ${
              syncHealth.quotaExceeded
                ? 'border-amber-400/35 bg-[#120e09]'
                : syncHealth.hasReadIssues
                ? 'border-amber-400/25 bg-[#110f0c]'
                : 'border-white/[0.08] bg-[#0c0c10]'
            }`}
          >
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${
                      syncHealth.quotaExceeded
                        ? 'bg-amber-500/15 border-amber-400/35 text-amber-300'
                        : syncHealth.hasReadIssues
                        ? 'bg-amber-500/10 border-amber-400/25 text-amber-300'
                        : syncHealth.status === 'healthy'
                        ? 'bg-emerald-500/10 border-emerald-400/25 text-emerald-400'
                        : 'bg-[#707ef9]/15 border-[#707ef9]/30 text-[#a5b0ff]'
                    }`}
                  >
                    {syncHealth.hasReadIssues ? (
                      <AlertCircle className="w-5 h-5" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-zinc-400">
                        Estado de sincronización
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          syncHealth.quotaExceeded || syncHealth.hasReadIssues
                            ? 'text-amber-300'
                            : syncHealth.status === 'healthy'
                            ? 'text-emerald-400'
                            : 'text-[#a5b0ff]'
                        }`}
                      >
                        · {syncHealth.statusLabel}
                      </span>
                    </div>
                    <h2 className="text-base sm:text-lg font-medium tracking-[-0.02em] text-white">
                      {syncHealth.adminHeadline}
                    </h2>
                    <p className="text-xs text-zinc-400 leading-relaxed max-w-3xl">
                      {syncHealth.adminDescription}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={onRetryCloudSync}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reintentar sincronización</span>
                  </button>
                  {canManageAdminTabs && syncHealth.hasReadIssues && effectiveSubTab !== 'sheets' && (
                    <button
                      type="button"
                      onClick={() => setSubTab('sheets')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/[0.14] bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
                    >
                      <span>Abrir Google Sheets</span>
                    </button>
                  )}
                  {syncHealth.quotaExceeded &&
                    firebaseConfig.projectId &&
                    firebaseConfig.firestoreDatabaseId && (
                      <a
                        href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-amber-400/35 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-medium text-amber-200 transition-colors"
                      >
                        <span>Revisar cuota en Firebase</span>
                      </a>
                    )}
                </div>
              </div>

              {/* Compact diagnostic metrics strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/[0.07] text-xs">
                <div>
                  <p className="text-[11px] text-zinc-500">Colecciones activas</p>
                  <p className="font-mono text-sm text-white mt-0.5 tabular-nums">
                    {syncHealth.activeStreamsCount} / {syncHealth.totalTrackedStreams}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-zinc-500">Con error de lectura</p>
                  <p
                    className={`font-mono text-sm mt-0.5 tabular-nums ${
                      syncHealth.failedStreamsCount > 0 ? 'text-amber-300' : 'text-zinc-300'
                    }`}
                  >
                    {syncHealth.failedStreamsCount}
                    {syncHealth.incident && syncHealth.incident.occurrences > 1
                      ? ` (${syncHealth.incident.occurrences} eventos)`
                      : ''}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-zinc-500">Última sincronización</p>
                  <p className="font-mono text-sm text-zinc-200 mt-0.5 tabular-nums">
                    {syncHealth.lastSuccessfulSyncAt
                      ? new Date(syncHealth.lastSuccessfulSyncAt).toLocaleTimeString('es-CL', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Sin confirmar'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-zinc-500">Respaldo en caché local</p>
                  <p className="text-sm text-zinc-200 mt-0.5">
                    {syncHealth.usingLocalCache ? 'Disponible' : 'Sin respaldo previo'}
                  </p>
                </div>
              </div>

              {syncHealth.hasReadIssues && syncHealth.affectedStreamLabels.length > 0 && (
                <div className="pt-3 border-t border-white/[0.07] space-y-1.5 text-xs">
                  <p className="text-[11px] text-zinc-500">
                    Colecciones afectadas ({syncHealth.affectedStreamLabels.length}):{' '}
                    <span className="text-zinc-300">
                      {syncHealth.affectedStreamLabels.join(' · ')}
                    </span>
                  </p>
                  {syncHealth.incident?.detail && (
                    <p className="text-[11px] font-mono text-zinc-500 break-words">
                      Detalle técnico: {syncHealth.incident.detail}
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ================= PANEL DE ARBITRAJE ================= */}
        {effectivePanel === 'arbitraje' &&
          effectiveSubTab === 'designaciones' &&
          canAssign &&
          currentUser && (
            <RefereeAssignmentPanel
              state={state}
              currentUser={currentUser}
              onUpdateMatch={(updated) => onUpdateMatch(updated)}
              onOpenMatchInDesk={handleOpenMatchFromAssignment}
            />
          )}

        {effectivePanel === 'arbitraje' && effectiveSubTab === 'arbitro' && canReferee && (
          <div className="space-y-8">
            {/* Role Scope Indicator */}
            <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#707ef9]/15 border border-[#707ef9]/30 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-[#a5b0ff]" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">
                    {recorderDisplayName} · {currentUser ? ROLE_META[currentUser.role].label : ''}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {currentUser?.role === 'arbitro'
                      ? 'Solo visualizas los partidos a los que fuiste designado por tu Jefatura de Arbitraje.'
                      : currentUser && isRefereeChief(currentUser)
                      ? `Supervisión completa de ${getRefereeChiefDisciplines(currentUser)
                          .map((id) => DISCIPLINE_MAP[id].nombreCorto)
                          .join(', ')}.`
                      : 'Acceso administrativo a todos los partidos del campeonato.'}
                  </p>
                </div>
              </div>
              <div className="text-xs text-zinc-400 tabular-nums shrink-0">
                <span className="px-3 py-1.5 rounded-full bg-[#101016] border border-white/[0.08] text-zinc-200 font-medium">
                  {scopedRefereeMatches.length} partido{scopedRefereeMatches.length === 1 ? '' : 's'}{' '}
                  habilitado{scopedRefereeMatches.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            {!activeMatch || !activeMatchMeta ? (
              <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-12 text-center space-y-4">
                <p className="font-display text-2xl font-semibold text-white">
                  {currentUser?.role === 'arbitro'
                    ? 'Aún no tienes partidos designados'
                    : `Sin encuentros disponibles para la temporada ${state.temporada}`}
                </p>
                <p className="text-sm text-zinc-400 max-w-lg mx-auto">
                  {currentUser?.role === 'arbitro'
                    ? 'Cuando el Jefe de Árbitros de tu disciplina te designe a un partido, aparecerá automáticamente en esta consola.'
                    : 'Programa partidos o genera el fixture desde Períodos y Formato para operar la Mesa Arbitral.'}
                </p>
                {canAssign && (
                  <button
                    type="button"
                    onClick={() => setSubTab('designaciones')}
                    className="px-5 py-2.5 rounded-full bg-[#707ef9] hover:bg-[#5b69f0] text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Ir a Designación de Árbitros
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left 7 cols: Filters + Match Selector + Live Scoreboard & Attendance */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="space-y-3">
                    <MatchFilterBar
                      idPrefix="referee-matches"
                      matches={scopedRefereeMatches}
                      disciplineFilter={refDisciplineFilter}
                      onDisciplineChange={(val) => {
                        setRefDisciplineFilter(val);
                        setRefGroupFilter('ALL');
                      }}
                      disciplineOptions={refereeDisciplineOptions}
                      groupFilter={refGroupFilter}
                      onGroupChange={setRefGroupFilter}
                      stageFilter={refStageFilter}
                      onStageChange={setRefStageFilter}
                      sortOrder={refSortOrder}
                      onSortOrderChange={setRefSortOrder}
                      filteredCount={refereeMatches.length}
                      totalCount={scopedRefereeMatches.length}
                      compact
                    />

                    <div className="rounded-2xl bg-[#0c0c10] border border-white/[0.08] p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <label
                          htmlFor="ref-match-select"
                          className="text-xs font-medium text-zinc-400"
                        >
                          Encuentro ({refereeMatches.length} en filtro)
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
                          className="sm:w-[27rem] rounded-xl bg-[#101016] border border-white/[0.1] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#707ef9]"
                        >
                          {refereeMatches.length === 0 ? (
                            <option value={activeMatch.id}>
                              Sin encuentros con estos filtros (manteniendo actual)
                            </option>
                          ) : (
                            refereeMatches.map((m) => {
                              const att = getNormalizedMatchAttendance(m);
                              const attTotal =
                                att.homePresentIds.length + att.awayPresentIds.length;
                              const attTag =
                                att.status === 'REGISTRADA'
                                  ? ` · Asist: ${attTotal}`
                                  : att.status === 'OMITIDA'
                                  ? ' · Omitida'
                                  : '';
                              return (
                                <option key={m.id} value={m.id}>
                                  [
                                  {m.status === 'EN_VIVO'
                                    ? 'EN VIVO'
                                    : m.status === 'FINALIZADO'
                                    ? 'FINAL'
                                    : 'PROG'}
                                  ] {DISCIPLINE_MAP[m.disciplineId].nombreCorto} · {m.fase} (
                                  {m.groupName}) · {teamMap.get(m.homeTeamId)?.nombre} vs{' '}
                                  {teamMap.get(m.awayTeamId)?.nombre}
                                  {attTag}
                                </option>
                              );
                            })
                          )}
                        </select>
                      </div>

                      {(() => {
                        const overview = computeMatchesAttendanceOverview(refereeMatches);
                        if (overview.totalMatches === 0) return null;
                        return (
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-white/[0.06] text-[11px] text-zinc-400 tabular-nums">
                            <span className="inline-flex items-center gap-1.5">
                              <ClipboardCheck className="w-3.5 h-3.5 text-[#a5b0ff]" />
                              <span>
                                Asistencia:{' '}
                                <strong className="text-white">{overview.registeredCount}</strong>{' '}
                                registradas ·{' '}
                                <strong className="text-zinc-300">{overview.omittedCount}</strong>{' '}
                                omitidas · {overview.unregisteredCount} pendientes
                              </span>
                            </span>
                            {activeMatch.assignedRefereeName && (
                              <span className="text-[#a5b0ff]">
                                Árbitro: {activeMatch.assignedRefereeName}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <LiveScoreboardPanel
                    match={activeMatch}
                    sportType={activeMatchMeta.sportType}
                    disciplineName={activeMatchMeta.nombre}
                    homeTeam={homeTeam}
                    awayTeam={awayTeam}
                    matchPlayers={matchPlayers}
                    recorderName={recorderDisplayName}
                    canEditAttendance={canEditActiveMatch}
                    onUpdateMatch={onUpdateMatch}
                  />
                </div>

                {/* Right 5 cols: Scoresheet Photo Upload + Gemini AI Validation + Manual Fallback */}
                <div className="lg:col-span-5 rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-6 space-y-5 self-start">
                  <div className="border-b border-white/[0.08] pb-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a5b0ff]">
                      <Camera className="w-4 h-4" />
                      <span>Cierre con Planilla</span>
                    </div>
                    <h2 className="font-display text-2xl font-semibold tracking-tight text-white mt-1">
                      Validación <span className="font-editorial font-normal text-[#c8ceff]">IA y Manual</span>
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                      Sube la fotografía de la planilla física para cruzar el marcador o cierra
                      manualmente el encuentro.
                    </p>
                  </div>

                  {!canEditActiveMatch && (
                    <div className="rounded-2xl bg-amber-500/10 border border-amber-400/25 p-4 text-xs text-amber-200 flex items-start gap-2.5">
                      <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        Este partido ya fue finalizado. Solo el Jefe de Árbitros de la disciplina o
                        Administración pueden reabrirlo o editar su marcador.
                      </span>
                    </div>
                  )}

                  {/* Non-blocking Attendance Status Summary */}
                  {(() => {
                    const att = getNormalizedMatchAttendance(activeMatch);
                    const totalPresent = att.homePresentIds.length + att.awayPresentIds.length;
                    return (
                      <div className="rounded-2xl bg-[#101016] border border-white/[0.08] px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <ClipboardCheck
                            className={`w-4 h-4 shrink-0 mt-0.5 ${
                              att.status === 'REGISTRADA'
                                ? 'text-emerald-400'
                                : att.status === 'OMITIDA'
                                ? 'text-amber-400'
                                : 'text-[#a5b0ff]'
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-white">
                              {att.status === 'REGISTRADA'
                                ? `Asistencia guardada (${totalPresent} presentes)`
                                : att.status === 'OMITIDA'
                                ? 'Asistencia omitida'
                                : 'Asistencia sin registrar (opcional)'}
                            </p>
                            <p className="text-[11px] text-zinc-400">
                              {att.status === 'REGISTRADA'
                                ? `${homeTeam?.sigla ?? 'LOC'}: ${att.homePresentIds.length} · ${
                                    awayTeam?.sigla ?? 'VIS'
                                  }: ${att.awayPresentIds.length}`
                                : 'No bloquea el cierre oficial del partido.'}
                            </p>
                          </div>
                        </div>
                        {att.status === 'NO_REGISTRADA' && canEditActiveMatch && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateMatch(
                                markMatchAttendanceOmitted({
                                  match: activeMatch,
                                  recorderName: recorderDisplayName,
                                })
                              )
                            }
                            className="px-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-[11px] font-medium text-zinc-200 shrink-0 cursor-pointer transition-colors"
                          >
                            Omitir
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {validationBanner && (
                    <div
                      role="status"
                      className="rounded-2xl bg-emerald-500/10 border border-emerald-400/25 p-4 text-xs text-emerald-200 flex items-start gap-2.5"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{validationBanner}</span>
                    </div>
                  )}

                  {aiError && (
                    <div
                      role="alert"
                      className="rounded-2xl bg-red-500/10 border border-red-400/25 p-4 text-xs text-red-200 flex items-start gap-2.5"
                    >
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <span>{aiError}</span>
                    </div>
                  )}

                  {/* Upload & Sample Test Generator */}
                  <div className="space-y-3">
                    <label
                      htmlFor="scoresheet-upload"
                      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.16] bg-[#101016] p-5 text-center cursor-pointer hover:border-[#707ef9] transition-colors"
                    >
                      <Upload className="w-5 h-5 text-[#a5b0ff] mb-2" />
                      <span className="text-sm font-medium text-white">
                        Subir fotografía de la planilla
                      </span>
                      <span className="text-xs text-zinc-500 mt-0.5">JPG, PNG o WEBP</span>
                    </label>
                    <input
                      id="scoresheet-upload"
                      type="file"
                      accept="image/*"
                      disabled={!canEditActiveMatch}
                      onChange={handleScoresheetFileChange}
                      className="sr-only"
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!canEditActiveMatch}
                        onClick={() => handleGenerateSampleScoresheet(false)}
                        className="flex-1 px-3 py-2 rounded-full bg-white/[0.04] border border-white/[0.1] hover:border-white/25 text-xs font-medium text-zinc-200 cursor-pointer disabled:opacity-40 transition-colors"
                      >
                        Probar coincidente
                      </button>
                      <button
                        type="button"
                        disabled={!canEditActiveMatch}
                        onClick={() => handleGenerateSampleScoresheet(true)}
                        className="flex-1 px-3 py-2 rounded-full bg-white/[0.04] border border-white/[0.1] hover:border-white/25 text-xs font-medium text-zinc-200 cursor-pointer disabled:opacity-40 transition-colors"
                      >
                        Probar con error (+1)
                      </button>
                    </div>
                  </div>

                  {scoresheetImage && (
                    <div className="space-y-3">
                      <img
                        src={scoresheetImage}
                        alt="Fotografía de planilla subida por el árbitro"
                        className="w-full h-44 object-contain rounded-2xl bg-[#101016] border border-white/[0.08]"
                      />
                      <button
                        type="button"
                        onClick={handleAnalyzeWithAI}
                        disabled={aiLoading || !canEditActiveMatch}
                        className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-full bg-[#707ef9] hover:bg-[#5c6bf0] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>
                          {aiLoading
                            ? 'Analizando planilla con IA...'
                            : 'Analizar y validar con IA'}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* AI Validation Result Panel */}
                  {aiResult && (
                    <div className="rounded-2xl bg-[#101016] border border-white/[0.08] p-4 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                        <span className="font-semibold text-white">Lectura IA</span>
                        <span
                          className={`font-semibold ${
                            aiResult.requiresManualReview ? 'text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          Confianza {aiResult.confidence} ·{' '}
                          {aiResult.requiresManualReview ? 'Revisar' : 'Validada'}
                        </span>
                      </div>

                      <p className="text-zinc-300">{aiResult.summary}</p>

                      <div className="flex items-center justify-between rounded-xl bg-white/[0.04] p-3 tabular-nums">
                        <span className="text-zinc-400">Planilla detectada:</span>
                        <strong className="font-display text-base text-white">
                          {homeTeam?.sigla} {aiResult.homeScoreDetected} —{' '}
                          {aiResult.awayScoreDetected} {awayTeam?.sigla}
                        </strong>
                      </div>

                      {aiResult.discrepancies.length > 0 && (
                        <div className="rounded-xl bg-amber-500/10 border border-amber-400/25 p-3 space-y-1 text-amber-200">
                          <p className="font-semibold text-[11px]">Discrepancias detectadas:</p>
                          <ul className="list-disc pl-4 space-y-0.5">
                            {aiResult.discrepancies.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={!canEditActiveMatch}
                        onClick={() => finalizeMatch('IA_AUTOMATICA')}
                        className="w-full py-2.5 rounded-full bg-white hover:bg-[#c8ceff] text-[#050507] text-xs font-semibold cursor-pointer transition-colors disabled:opacity-40"
                      >
                        Aprobar marcador IA y finalizar
                      </button>
                    </div>
                  )}

                  {/* Manual Referee Validation Form */}
                  <div className="rounded-2xl bg-[#101016] border border-white/[0.08] p-4 space-y-3.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <ShieldCheck className="w-4 h-4 text-[#a5b0ff]" />
                      <span>Cierre Manual del Árbitro</span>
                    </div>

                    {activeMatch.penaltyScore && (
                      <div className="rounded-xl bg-[#707ef9]/10 border border-[#707ef9]/30 px-3 py-2 text-xs text-[#c8ceff] tabular-nums">
                        Penales activos: {homeTeam?.sigla ?? 'LOC'} {activeMatch.penaltyScore.home} —{' '}
                        {activeMatch.penaltyScore.away} {awayTeam?.sigla ?? 'VIS'}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="manual-home"
                          className="block text-[11px] text-zinc-400 mb-1 truncate"
                        >
                          {homeTeam?.nombre}
                        </label>
                        <input
                          id="manual-home"
                          type="number"
                          min={0}
                          disabled={!canEditActiveMatch}
                          value={manualHome}
                          onChange={(e) => setManualHome(e.target.value)}
                          className="w-full rounded-xl bg-[#0c0c10] border border-white/[0.1] px-3 py-2 text-sm text-white tabular-nums font-semibold focus:outline-none focus:border-[#707ef9] disabled:opacity-40"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="manual-away"
                          className="block text-[11px] text-zinc-400 mb-1 truncate"
                        >
                          {awayTeam?.nombre}
                        </label>
                        <input
                          id="manual-away"
                          type="number"
                          min={0}
                          disabled={!canEditActiveMatch}
                          value={manualAway}
                          onChange={(e) => setManualAway(e.target.value)}
                          className="w-full rounded-xl bg-[#0c0c10] border border-white/[0.1] px-3 py-2 text-sm text-white tabular-nums font-semibold focus:outline-none focus:border-[#707ef9] disabled:opacity-40"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="manual-notes" className="block text-[11px] text-zinc-400 mb-1">
                        Observación arbitral
                      </label>
                      <input
                        id="manual-notes"
                        type="text"
                        disabled={!canEditActiveMatch}
                        value={manualNotes}
                        onChange={(e) => setManualNotes(e.target.value)}
                        placeholder="Ej: Planilla física verificada con ambos capitanes."
                        className="w-full rounded-xl bg-[#0c0c10] border border-white/[0.1] px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#707ef9] disabled:opacity-40"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={!canEditActiveMatch}
                      onClick={() => finalizeMatch('MANUAL_ARBITRO')}
                      className="w-full py-2.5 rounded-full bg-white hover:bg-[#c8ceff] text-[#050507] text-xs font-semibold cursor-pointer transition-colors disabled:opacity-40"
                    >
                      Finalizar con Validación Manual
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= PANEL DE PRENSA ================= */}
        {effectivePanel === 'prensa' && effectiveSubTab === 'galeria' && canUpload && currentUser && (
          <PressGalleryPanel
            state={state}
            currentUser={currentUser}
            onAddPhoto={onAddPhoto}
            onDeletePhoto={onDeletePhoto}
            onSaveDriveRootFolder={onSaveDriveRootFolder}
          />
        )}

        {effectivePanel === 'prensa' &&
          effectiveSubTab === 'noticias' &&
          canEditNews &&
          currentUser && (
            <AdminNewsManager
              state={state}
              currentUser={currentUser}
              editorialPhotos={editorialPhotos}
              onAddNews={onAddNews}
              onUpdateNews={onUpdateNews}
              onDeleteNews={onDeleteNews}
            />
          )}

        {/* ================= ADMINISTRACIÓN GENERAL ================= */}
        {effectivePanel === 'general' && effectiveSubTab === 'partidos' && canGeneral && (
          <AdminMatchEditor
            state={state}
            initialEditMatchId={focusedMatchId}
            onUpdateMatch={(updated) => onUpdateMatch(updated)}
            onAddMatch={onAddMatch}
          />
        )}

        {effectivePanel === 'general' && effectiveSubTab === 'equipos' && canGeneral && (
          <AdminTeamsManager
            state={state}
            onAddTeam={onAddTeam}
            onUpdateTeam={onUpdateTeam}
            onDeleteTeam={onDeleteTeam}
            onBulkUpdateTeams={onBulkUpdateTeams}
          />
        )}

        {effectivePanel === 'general' && effectiveSubTab === 'jugadores' && canGeneral && (
          <AdminPlayersManager
            state={state}
            onAddPlayer={onAddPlayer}
            onUpdatePlayer={onUpdatePlayer}
            onDeletePlayer={onDeletePlayer}
          />
        )}

        {/* USERS & ROLES (ADMIN + MODERADOR with role escalation guard) */}
        {effectivePanel === 'general' && effectiveSubTab === 'usuarios' && canEditRoles && (
          <AdminUsersRolesSection
            currentUser={currentUser}
            users={state.users}
            teams={state.teams}
            players={state.players}
            onAdminChangeUserRole={onAdminChangeUserRole}
            onRefreshUsers={onRefreshUsers}
          />
        )}

        {/* PERIOD TOGGLES + FORMAT CONFIG */}
        {effectivePanel === 'general' && effectiveSubTab === 'formato' && canManageAdminTabs && (
          <AdminFormatConfigSection
            configs={state.configs}
            teams={state.teams}
            onUpdateConfig={onUpdateConfig}
          />
        )}

        {effectivePanel === 'general' && effectiveSubTab === 'sheets' && canManageAdminTabs && (
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

        {effectivePanel === 'general' && effectiveSubTab === 'votaciones' && canGeneral && (
          <AdminAwardsManager state={state} onSaveAwardNominees={onSaveAwardNominees} />
        )}

        {effectivePanel === 'general' && effectiveSubTab === 'toty' && canGeneral && (
          <AdminTotyManager
            state={state}
            totyLastSyncAt={totyLastSyncAt}
            totyRealtimeActive={totyRealtimeActive}
            onSaveTotyConfig={onSaveTotyConfig}
            onResetTotyConfig={onResetTotyConfig}
            onSaveTotyDeadline={onSaveTotyDeadline}
            onMigrateTotyFromFirestore={onMigrateTotyFromFirestore}
            onImportLocalTotyBackup={onImportLocalTotyBackup}
          />
        )}

        {effectivePanel === 'general' && effectiveSubTab === 'portada' && canGeneral && (
          <AdminFeaturedManager state={state} onSaveHomeFeatured={onSaveHomeFeatured} />
        )}
      </div>
    </div>
  );
}
