import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { AnimatePresence, MotionConfig } from 'motion/react';
import type { PanelSubTab } from './components/AdminRefereeView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { HomeView } from './components/HomeView';
import { InitialLoadSkeleton } from './components/InitialLoadSkeleton';
import { PageTransition } from './components/MotionPrimitives';
import { Navbar } from './components/Navbar';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SectionLoadingFallback } from './components/SectionLoadingFallback';
import { isAdminOrModerator } from './domain/rbacEngine';
import { shouldShowPublicReadNotice } from './domain/syncHealthEngine';
import { useSheetsAutoSync } from './hooks/useSheetsAutoSync';
import { useTotySync } from './hooks/useTotySync';
import { useTournamentAuth } from './hooks/useTournamentAuth';
import {
  buildInitialBootSnapshot,
  useTournamentCoreData,
} from './hooks/useTournamentCoreData';
import { useTournamentMutations } from './hooks/useTournamentMutations';
import { useTournamentRouting } from './hooks/useTournamentRouting';
import type { DisciplineId, Player, TournamentState, UserRole } from './types/tournament';

// Code-split every secondary view & modal so the landing page ships only essential JS
const StandingsView = lazy(() =>
  import('./components/StandingsView').then((m) => ({ default: m.StandingsView }))
);
const TeamsView = lazy(() =>
  import('./components/TeamsView').then((m) => ({ default: m.TeamsView }))
);
const PlayersView = lazy(() =>
  import('./components/PlayersView').then((m) => ({ default: m.PlayersView }))
);
const VotationsView = lazy(() =>
  import('./components/VotationsView').then((m) => ({ default: m.VotationsView }))
);
const MinigamesView = lazy(() =>
  import('./components/MinigamesView').then((m) => ({ default: m.MinigamesView }))
);
const GalleryView = lazy(() =>
  import('./components/GalleryView').then((m) => ({ default: m.GalleryView }))
);
const RegistrationView = lazy(() =>
  import('./components/RegistrationView').then((m) => ({ default: m.RegistrationView }))
);
const TransfersView = lazy(() =>
  import('./components/TransfersView').then((m) => ({ default: m.TransfersView }))
);
const PublicTransfersView = lazy(() =>
  import('./components/PublicTransfersView').then((m) => ({ default: m.PublicTransfersView }))
);
const AccountView = lazy(() =>
  import('./components/AccountView').then((m) => ({ default: m.AccountView }))
);
const AdminRefereeView = lazy(() =>
  import('./components/AdminRefereeView').then((m) => ({ default: m.AdminRefereeView }))
);
const PrivacyPolicyView = lazy(() =>
  import('./components/PrivacyPolicyView').then((m) => ({ default: m.PrivacyPolicyView }))
);
const NewsArticleModal = lazy(() =>
  import('./components/NewsArticleModal').then((m) => ({ default: m.NewsArticleModal }))
);
const TeamProfileModal = lazy(() =>
  import('./components/TeamProfileModal').then((m) => ({ default: m.TeamProfileModal }))
);
const MatchMvpModal = lazy(() =>
  import('./components/MatchMvpModal').then((m) => ({ default: m.MatchMvpModal }))
);
const AuthModal = lazy(() =>
  import('./components/AuthModal').then((m) => ({ default: m.AuthModal }))
);

function AppContent() {
  const [initialBoot] = useState(buildInitialBootSnapshot);
  const [state, setState] = useState<TournamentState>(() => initialBoot.state);
  const [selectedDiscipline, setSelectedDiscipline] = useState<DisciplineId>('f7-h-1');
  const [panelInitialSubTab, setPanelInitialSubTab] = useState<PanelSubTab>('arbitro');
  const [focusedMatchId, setFocusedMatchId] = useState<string | null>(null);

  const stateRef = useRef(state);
  const currentUserRoleRef = useRef<UserRole | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // 1. Direct URL Routing & Deep-Links (/equipos/:id, /partidos/:id, /noticias/:id)
  const {
    activeSection,
    setActiveSection,
    inspectedPlayer,
    setInspectedPlayer,
    inspectedTeamId,
    inspectedTeam,
    openTeamModal,
    activeModalMatch,
    openMatchModal,
    activeNewsArticleId,
    activeNewsArticle,
    openNewsArticle,
    syncBrowserUrlForSection,
    handleNavigate,
  } = useTournamentRouting(state);

  // 2. Core Data Boot, Offline Cache & Section Lazy Loaders
  const {
    editorialPhotos,
    cloudError,
    setCloudError,
    clearCloudError,
    syncHealth,
    dismissedPublicNoticeKind,
    setDismissedPublicNoticeKind,
    initialSyncPhase,
    initialSyncErrorDetail,
    realtimeRetryNonce,
    adminFullPlayersLoadedRef,
    markPlayersStreamHealthy,
    reportCloudError,
    handleRetryInitialSync,
    handleLoadTeamPlayers,
    handleSearchPlayers,
  } = useTournamentCoreData({
    initialBoot,
    state,
    setState,
    stateRef,
    currentUserRoleRef,
    activeSection,
    selectedDiscipline,
    activeNewsArticleId,
  });

  // 3. Google Auth, Profile Hydration & Role Management
  const beforeSignOutRef = useRef<() => Promise<void>>(async () => undefined);
  const handleBeforeSignOut = useCallback(() => beforeSignOutRef.current(), []);

  const {
    currentUserUid,
    currentUser,
    authModalOpen,
    setAuthModalOpen,
    googleAuthLoading,
    googleAuthError,
    handleGoogleSignIn,
    handleSignOut,
    handleRefreshUsers,
    handleToggleFavoriteTeam,
    handleToggleNotifications,
    handleUpdateUserProfile,
    handleAdminChangeUserRole,
  } = useTournamentAuth({
    state,
    setState,
    stateRef,
    currentUserRoleRef,
    reportCloudError,
    clearCloudError,
    handleLoadTeamPlayers,
    onBeforeSignOut: handleBeforeSignOut,
  });

  const requireAuth = useCallback(() => setAuthModalOpen(true), [setAuthModalOpen]);

  // 4. TOTY Sync, Batched Ballot Queue, Countdown Deadline & Migration
  const {
    totyLastSyncAt,
    totyRealtimeActive,
    pendingTotyDisciplines,
    pendingTotyQueueRef,
    flushPendingTotyBallots,
    handleSubmitTotyBallot,
    handleSaveTotyConfig,
    handleResetTotyConfig,
    handleSaveTotyDeadline,
    handleMigrateTotyFromFirestore,
    handleImportLocalTotyBackup,
  } = useTotySync({
    initialBallots: initialBoot.state.totyBallots,
    initialCachedAtIso: initialBoot.totyCachedAtIso,
    activeSection,
    selectedDiscipline,
    currentUser,
    currentUserUid,
    realtimeRetryNonce,
    stateRef,
    adminFullPlayersLoadedRef,
    setState,
    onRequireAuth: requireAuth,
    onPlayersStreamHealthy: markPlayersStreamHealthy,
    reportCloudError,
  });

  // 5. Bidirectional Master Google Sheets Sync
  const {
    autoSyncSessionApproved,
    setAutoSyncSessionApproved,
    pendingSyncKeys,
    deletedTombstones,
    setDeletedTombstones,
    autoSyncState,
    queueMasterSyncForDiscipline,
    handleClearDeletedTombstones,
    handleApplySheetImports,
    handleSaveMasterSheets,
    handleClearPendingSyncKeys,
    handleMarkSynced,
  } = useSheetsAutoSync({
    state,
    setState,
    stateRef,
    currentUser,
    reportCloudError,
  });

  beforeSignOutRef.current = async () => {
    if (pendingTotyQueueRef.current.length > 0) {
      await flushPendingTotyBallots();
    }
    setAutoSyncSessionApproved(false);
  };

  // 6. Tournament Domain Mutations
  const {
    handleVoteMvp,
    handleSaveAwardNominees,
    handleVoteChampionshipMvp,
    handleVotePositionAward,
    handleSaveLeyendasEntry,
    handleUpdatePlayer,
    handleAddPlayerToTeam,
    handleDeletePlayer,
    handleAdminAddTeam,
    handleUpdateTeam,
    handleBulkUpdateTeams,
    handleAdminDeleteTeam,
    handleAddPhoto,
    handleDeletePhoto,
    handleAddNews,
    handleUpdateNews,
    handleDeleteNews,
    handleSaveDriveRootFolder,
    handleUpdateMatch,
    handleAdminAddMatch,
    handleRegisterTeam,
    handleCreateTransferRequest,
    handleApproveTransferRequest,
    handleRejectTransferRequest,
    handleUpdateConfig,
    handleSaveHomeFeatured,
  } = useTournamentMutations({
    state,
    setState,
    stateRef,
    currentUser,
    inspectedTeamId,
    activeNewsArticleId,
    onCloseInspectedTeam: () => openTeamModal(null),
    onSyncOpenNewsArticle: openNewsArticle,
    onRequireAuth: requireAuth,
    setDeletedTombstones,
    queueMasterSyncForDiscipline,
    reportCloudError,
  });

  // 7. Cross-section Panel & Player Deep Navigation Shortcuts
  const openPanelSubTab = useCallback(
    (subTab: PanelSubTab, matchId?: string) => {
      if (matchId !== undefined) setFocusedMatchId(matchId);
      setPanelInitialSubTab(subTab);
      setActiveSection('panel');
      syncBrowserUrlForSection('panel');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [setActiveSection, syncBrowserUrlForSection]
  );

  const handleInspectPlayerFromHome = useCallback(
    (player: Player) => {
      openTeamModal(null);
      setInspectedPlayer(player);
      setActiveSection('jugadores');
      syncBrowserUrlForSection('jugadores');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [openTeamModal, setActiveSection, setInspectedPlayer, syncBrowserUrlForSection]
  );

  const handleOpenMatchInReferee = useCallback(
    (matchId: string) => {
      openMatchModal(null);
      openPanelSubTab('arbitro', matchId);
    },
    [openMatchModal, openPanelSubTab]
  );

  const handleAdminEditMatch = useCallback(
    (matchId: string) => {
      openTeamModal(null);
      openPanelSubTab('partidos', matchId);
    },
    [openPanelSubTab, openTeamModal]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#050507] text-zinc-100">
      <Navbar
        activeSection={activeSection}
        currentUser={currentUser}
        state={state}
        onNavigate={handleNavigate}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenMatchModal={(match) => openMatchModal(match.id)}
      />

      {!(activeSection === 'panel' && isAdminOrModerator(currentUser)) &&
        !(activeSection !== 'privacidad' && initialSyncPhase === 'error') &&
        shouldShowPublicReadNotice({
          summary: syncHealth,
          dismissedKind: dismissedPublicNoticeKind,
        }) && (
          <div
            data-testid="public-read-notice"
            role="status"
            className="bg-[#12100b]/95 border-b border-amber-400/25 text-amber-100/95 px-4 py-2.5 text-xs backdrop-blur-md"
          >
            <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-3">
              <span className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-300 shrink-0" />
                <span>{syncHealth.publicNoticeMessage}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  if (syncHealth.incident) {
                    setDismissedPublicNoticeKind(syncHealth.incident.kind);
                  }
                }}
                aria-label="Cerrar aviso de lectura"
                className="p-1 text-amber-200/75 hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      {cloudError && (
        <div
          role="alert"
          className="bg-red-950/60 border-b border-red-500/30 text-red-200 px-4 py-2.5 text-xs backdrop-blur-md"
        >
          <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{cloudError}</span>
            </span>
            <button
              type="button"
              onClick={() => setCloudError(null)}
              aria-label="Cerrar alerta"
              className="p-1 text-red-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        {activeSection !== 'privacidad' && initialSyncPhase !== 'ready' ? (
          <InitialLoadSkeleton
            phase={initialSyncPhase}
            errorDetail={initialSyncErrorDetail}
            isQuotaOrReadIssue={syncHealth.hasReadIssues}
            isAdmin={isAdminOrModerator(currentUser)}
            onRetry={handleRetryInitialSync}
          />
        ) : (
          <Suspense fallback={<SectionLoadingFallback />}>
            <AnimatePresence mode="wait">
              <PageTransition key={activeSection}>
                {activeSection === 'inicio' && (
                  <HomeView
                    state={state}
                    currentUser={currentUser}
                    selectedDiscipline={selectedDiscipline}
                    editorialPhotos={editorialPhotos}
                    onSelectDiscipline={setSelectedDiscipline}
                    onNavigate={handleNavigate}
                    onInspectPlayer={handleInspectPlayerFromHome}
                    onInspectTeam={(teamId) => openTeamModal(teamId)}
                    onOpenMatchModal={(match) => openMatchModal(match.id)}
                    onOpenMatchInReferee={handleOpenMatchInReferee}
                    onOpenNewsArticle={openNewsArticle}
                    onOpenNewsManager={() => openPanelSubTab('noticias')}
                    onOpenFeaturedManager={() => openPanelSubTab('portada')}
                    onToggleFavoriteTeam={handleToggleFavoriteTeam}
                    onOpenAuth={() => setAuthModalOpen(true)}
                  />
                )}

                {activeSection === 'posiciones' && (
                  <StandingsView
                    state={state}
                    currentUser={currentUser}
                    selectedDiscipline={selectedDiscipline}
                    onSelectDiscipline={setSelectedDiscipline}
                    onInspectTeam={(teamId) => openTeamModal(teamId)}
                    onOpenMatchModal={(match) => openMatchModal(match.id)}
                    onToggleFavoriteTeam={handleToggleFavoriteTeam}
                    onOpenAuth={() => setAuthModalOpen(true)}
                  />
                )}

                {activeSection === 'equipos' && (
                  <TeamsView
                    state={state}
                    selectedDiscipline={selectedDiscipline}
                    onSelectDiscipline={setSelectedDiscipline}
                    onOpenTeamProfile={(team) => openTeamModal(team.id)}
                  />
                )}

                {activeSection === 'jugadores' && (
                  <PlayersView
                    state={state}
                    currentUser={currentUser}
                    selectedPlayer={inspectedPlayer}
                    onSelectPlayer={setInspectedPlayer}
                    onInspectTeam={(teamId) => openTeamModal(teamId)}
                    onUpdatePlayer={handleUpdatePlayer}
                    onLoadTeamPlayers={handleLoadTeamPlayers}
                    onSearchPlayers={handleSearchPlayers}
                  />
                )}

                {activeSection === 'votaciones' && (
                  <VotationsView
                    state={state}
                    selectedDiscipline={selectedDiscipline}
                    currentUser={currentUser}
                    onSelectDiscipline={setSelectedDiscipline}
                    onOpenAuth={() => setAuthModalOpen(true)}
                    onOpenMatchMvp={(match) => openMatchModal(match.id)}
                    onVoteChampionshipMvp={handleVoteChampionshipMvp}
                    onVotePositionAward={handleVotePositionAward}
                    onSubmitTotyBallot={handleSubmitTotyBallot}
                    pendingTotyDisciplines={pendingTotyDisciplines}
                    onFlushTotyBatch={flushPendingTotyBallots}
                    onLoadTeamPlayers={handleLoadTeamPlayers}
                    onSearchPlayers={handleSearchPlayers}
                  />
                )}

                {activeSection === 'minijuegos' && (
                  <MinigamesView
                    state={state}
                    currentUser={currentUser}
                    onOpenAuth={() => setAuthModalOpen(true)}
                    onSaveLeyendasEntry={handleSaveLeyendasEntry}
                  />
                )}

                {activeSection === 'galeria' && (
                  <GalleryView
                    state={state}
                    currentUser={currentUser}
                    onAddPhoto={handleAddPhoto}
                    onDeletePhoto={handleDeletePhoto}
                    onSaveDriveRootFolder={handleSaveDriveRootFolder}
                    onOpenAuth={() => setAuthModalOpen(true)}
                  />
                )}

                {activeSection === 'inscripciones' && (
                  <RegistrationView
                    state={state}
                    currentUser={currentUser}
                    onRegisterTeam={handleRegisterTeam}
                    onUpdateTeam={handleUpdateTeam}
                    onUpdatePlayer={handleUpdatePlayer}
                    onAddPlayerToTeam={handleAddPlayerToTeam}
                    onOpenSheetsSync={() => openPanelSubTab('sheets')}
                    onOpenAuth={() => setAuthModalOpen(true)}
                  />
                )}

                {activeSection === 'transferencias' && (
                  <TransfersView
                    state={state}
                    currentUser={currentUser}
                    onCreateTransferRequest={handleCreateTransferRequest}
                    onApproveTransferRequest={handleApproveTransferRequest}
                    onRejectTransferRequest={handleRejectTransferRequest}
                    onNavigate={handleNavigate}
                    onOpenAuth={() => setAuthModalOpen(true)}
                    onLoadTeamPlayers={handleLoadTeamPlayers}
                  />
                )}

                {activeSection === 'transferencias-publicas' && (
                  <PublicTransfersView
                    state={state}
                    currentUser={currentUser}
                    onInspectTeam={(teamId) => openTeamModal(teamId)}
                    onNavigate={handleNavigate}
                  />
                )}

                {activeSection === 'cuenta' && (
                  <AccountView
                    state={state}
                    currentUser={currentUser}
                    onOpenAuth={() => setAuthModalOpen(true)}
                    onToggleFavoriteTeam={handleToggleFavoriteTeam}
                    onToggleNotifications={handleToggleNotifications}
                    onUpdateUserProfile={handleUpdateUserProfile}
                    onUpdatePlayerProfile={handleUpdatePlayer}
                    onInspectTeam={(teamId) => openTeamModal(teamId)}
                    onOpenMatchModal={(match) => openMatchModal(match.id)}
                    onNavigate={handleNavigate}
                  />
                )}

                {activeSection === 'panel' && (
                  <AdminRefereeView
                    state={state}
                    currentUser={currentUser}
                    editorialPhotos={editorialPhotos}
                    initialSubTab={panelInitialSubTab}
                    focusedMatchId={focusedMatchId}
                    pendingSyncKeys={pendingSyncKeys}
                    deletedIds={deletedTombstones}
                    autoSyncSessionApproved={autoSyncSessionApproved}
                    autoSyncState={autoSyncState}
                    onUpdateMatch={handleUpdateMatch}
                    onAddMatch={handleAdminAddMatch}
                    onAddTeam={handleAdminAddTeam}
                    onUpdateTeam={handleUpdateTeam}
                    onDeleteTeam={handleAdminDeleteTeam}
                    onBulkUpdateTeams={handleBulkUpdateTeams}
                    onAddPlayer={handleAddPlayerToTeam}
                    onUpdatePlayer={handleUpdatePlayer}
                    onDeletePlayer={handleDeletePlayer}
                    onAddNews={handleAddNews}
                    onUpdateNews={handleUpdateNews}
                    onDeleteNews={handleDeleteNews}
                    onAddPhoto={handleAddPhoto}
                    onDeletePhoto={handleDeletePhoto}
                    onSaveDriveRootFolder={handleSaveDriveRootFolder}
                    onUpdateConfig={handleUpdateConfig}
                    onSaveMasterSheets={handleSaveMasterSheets}
                    onApproveAutoSyncSession={setAutoSyncSessionApproved}
                    onClearPendingSyncKeys={handleClearPendingSyncKeys}
                    onClearDeletedTombstones={handleClearDeletedTombstones}
                    onApplySheetImports={handleApplySheetImports}
                    onMarkSynced={handleMarkSynced}
                    onAdminChangeUserRole={handleAdminChangeUserRole}
                    onSaveAwardNominees={handleSaveAwardNominees}
                    totyLastSyncAt={totyLastSyncAt}
                    totyRealtimeActive={totyRealtimeActive}
                    onSaveTotyConfig={handleSaveTotyConfig}
                    onResetTotyConfig={handleResetTotyConfig}
                    onSaveTotyDeadline={handleSaveTotyDeadline}
                    onMigrateTotyFromFirestore={handleMigrateTotyFromFirestore}
                    onImportLocalTotyBackup={handleImportLocalTotyBackup}
                    onSaveHomeFeatured={handleSaveHomeFeatured}
                    onRefreshUsers={handleRefreshUsers}
                    syncHealth={syncHealth}
                    onRetryCloudSync={handleRetryInitialSync}
                    onOpenAuth={() => setAuthModalOpen(true)}
                  />
                )}

                {activeSection === 'privacidad' && (
                  <PrivacyPolicyView onNavigate={handleNavigate} />
                )}
              </PageTransition>
            </AnimatePresence>
          </Suspense>
        )}
      </main>

      <Footer
        onNavigate={handleNavigate}
        hasOpenRegistrations={Object.values(state.configs).some(
          (c) => c.inscripcionesAbiertas
        )}
      />

      <OfflineIndicator />

      <Suspense fallback={null}>
        {activeNewsArticle && (
          <NewsArticleModal
            article={activeNewsArticle}
            onClose={() => openNewsArticle(null)}
          />
        )}

        {inspectedTeam && (
          <TeamProfileModal
            team={inspectedTeam}
            teams={state.teams}
            players={state.players}
            matches={state.matches}
            mvpVotes={state.mvpVotes}
            currentUser={currentUser}
            onClose={() => openTeamModal(null)}
            onToggleFavoriteTeam={handleToggleFavoriteTeam}
            onOpenMatchModal={(match) => openMatchModal(match.id)}
            onInspectPlayer={handleInspectPlayerFromHome}
            onAdminEditMatch={handleAdminEditMatch}
            onLoadTeamPlayers={handleLoadTeamPlayers}
          />
        )}

        {activeModalMatch && (
          <MatchMvpModal
            match={activeModalMatch}
            teams={state.teams}
            players={state.players}
            mvpVotes={state.mvpVotes}
            currentUser={currentUser}
            onClose={() => openMatchModal(null)}
            onVoteMvp={handleVoteMvp}
            onOpenAuth={() => setAuthModalOpen(true)}
            onOpenMatchInReferee={handleOpenMatchInReferee}
            onToggleFavoriteTeam={handleToggleFavoriteTeam}
            onLoadTeamPlayers={handleLoadTeamPlayers}
          />
        )}

        {authModalOpen && (
          <AuthModal
            open={authModalOpen}
            currentUser={currentUser}
            googleAuthLoading={googleAuthLoading}
            googleAuthError={googleAuthError}
            onClose={() => setAuthModalOpen(false)}
            onGoogleSignIn={handleGoogleSignIn}
            onSignOut={handleSignOut}
            onOpenAccountHub={() => handleNavigate('cuenta')}
            onOpenPrivacy={() => handleNavigate('privacidad')}
          />
        )}
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <AppContent />
      </MotionConfig>
    </ErrorBoundary>
  );
}
