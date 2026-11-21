import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { createInitialTournamentState, DISCIPLINE_MAP } from './data/ufroSeed';
import { validateRoleChange } from './domain/rbacEngine';
import { generateEquitableGroups, generateRoundRobinMatches } from './domain/tournamentEngine';
import {
  initGoogleAuth,
  signInWithGoogleWorkspace,
  signOutGoogle,
} from './services/firebaseAuth';
import {
  adminUpdateFirestoreUserRole,
  deleteFirestoreMatchesForDiscipline,
  deleteFirestorePhoto,
  ensureAllConfigsInFirestore,
  executeFirestoreTransfer,
  listFirestoreUsers,
  loadAuthorizedPlayerPrivateMap,
  loadPublicTournamentState,
  saveFirestoreDisciplineConfig,
  saveFirestoreMatch,
  saveFirestoreMvpVote,
  saveFirestorePhoto,
  saveFirestorePlayer,
  saveFirestoreSettings,
  saveFirestoreTeam,
  syncGoogleUserToFirestore,
  updateFirestorePlayerStats,
  updateFirestoreUserPreferences,
} from './services/firestoreService';
import { AccountView } from './components/AccountView';
import { AdminRefereeView, type PanelSubTab } from './components/AdminRefereeView';
import { AuthModal } from './components/AuthModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { GalleryView } from './components/GalleryView';
import { HomeView } from './components/HomeView';
import { MatchMvpModal } from './components/MatchMvpModal';
import { Navbar, type NavSection } from './components/Navbar';
import { PlayersView } from './components/PlayersView';
import { RegistrationView } from './components/RegistrationView';
import { StandingsView } from './components/StandingsView';
import { TransfersView } from './components/TransfersView';
import type {
  AppUserProfile,
  DisciplineFormatConfig,
  DisciplineId,
  Match,
  MvpVoteRecord,
  PhotoEntry,
  Player,
  Team,
  TournamentState,
  TransferRecord,
  UserRole,
} from './types/tournament';

function AppContent() {
  const [state, setState] = useState<TournamentState>(() => createInitialTournamentState());
  const [activeSection, setActiveSection] = useState<NavSection>('inicio');
  const [selectedDiscipline, setSelectedDiscipline] = useState<DisciplineId>('f7-h-1');
  const [inspectedPlayer, setInspectedPlayer] = useState<Player | null>(null);
  const [panelInitialSubTab, setPanelInitialSubTab] = useState<PanelSubTab>('arbitro');
  const [focusedMatchId, setFocusedMatchId] = useState<string | null>(null);

  // Auth, Modal & Cloud Sync Feedback State
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [activeMatchModalId, setActiveMatchModalId] = useState<string | null>(null);
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false);
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);

  const reportCloudError = useCallback((context: string, err: unknown) => {
    const detail = err instanceof Error ? err.message : 'Error de sincronización con Firestore.';
    console.error(`[Firestore] ${context}:`, err);
    setCloudError(`${context}: ${detail}`);
  }, []);

  // 1. Hydrate all public tournament data directly from Firestore on mount
  useEffect(() => {
    let active = true;
    loadPublicTournamentState()
      .then((cloud) => {
        if (!active) return;
        setState((prev) => ({
          ...prev,
          temporada: cloud.temporada ?? prev.temporada,
          driveUploadRootFolderId: cloud.driveUploadRootFolderId ?? prev.driveUploadRootFolderId,
          driveUploadRootFolderName: cloud.driveUploadRootFolderName ?? prev.driveUploadRootFolderName,
          lastSyncedSpreadsheetId: cloud.lastSyncedSpreadsheetId ?? prev.lastSyncedSpreadsheetId,
          lastSyncedAt: cloud.lastSyncedAt ?? prev.lastSyncedAt,
          configs: cloud.configs ?? prev.configs,
          teams: cloud.teams ?? prev.teams,
          players: cloud.players ?? prev.players,
          matches: cloud.matches ?? prev.matches,
          transfers: cloud.transfers ?? prev.transfers,
          mvpVotes: cloud.mvpVotes ?? prev.mvpVotes,
          photos: cloud.photos ?? prev.photos,
        }));
      })
      .catch((err) => {
        if (active) reportCloudError('Error cargando datos del campeonato', err);
      });
    return () => {
      active = false;
    };
  }, [reportCloudError]);

  const hydrateForAuthenticatedProfile = useCallback(
    async (profile: AppUserProfile, currentPlayers: Player[], currentConfigs: Record<DisciplineId, DisciplineFormatConfig>) => {
      // Hydrate authorized isolated student PII (/player_private)
      if (
        profile.role === 'admin' ||
        profile.role === 'delegado' ||
        profile.role === 'jugador'
      ) {
        try {
          const privateMap = await loadAuthorizedPlayerPrivateMap(profile, currentPlayers);
          if (Object.keys(privateMap).length > 0) {
            setState((prev) => ({
              ...prev,
              players: prev.players.map((p) => {
                const pii = privateMap[p.id];
                return pii ? { ...p, ...pii } : p;
              }),
            }));
          }
        } catch (err) {
          console.error('Error hidratando datos privados de jugadores:', err);
        }
      }

      // If signed-in user is an Admin, load all Firestore users & ensure 8 discipline configs exist
      if (profile.role === 'admin') {
        try {
          const [cloudUsers] = await Promise.all([
            listFirestoreUsers(),
            ensureAllConfigsInFirestore(currentConfigs).catch(() => undefined),
          ]);
          setState((prev) => {
            const byUid = new Map(prev.users.map((u) => [u.uid, u]));
            cloudUsers.forEach((cu) => byUid.set(cu.uid, cu));
            return { ...prev, users: Array.from(byUid.values()) };
          });
        } catch (err) {
          reportCloudError('Error cargando directorio de usuarios', err);
        }
      }
    },
    [reportCloudError]
  );

  // 2. Subscribe to real Firebase Google Auth state (NO demo/test users)
  useEffect(() => {
    const unsub = initGoogleAuth(
      async (firebaseUser) => {
        try {
          const profile = await syncGoogleUserToFirestore(firebaseUser);
          let snapshotPlayers: Player[] = [];
          let snapshotConfigs: Record<DisciplineId, DisciplineFormatConfig> = createInitialTournamentState().configs;

          setState((prev) => {
            snapshotPlayers = prev.players;
            snapshotConfigs = prev.configs;
            const exists = prev.users.some((u) => u.uid === profile.uid);
            const mergedUsers = exists
              ? prev.users.map((u) => (u.uid === profile.uid ? profile : u))
              : [profile, ...prev.users];
            return { ...prev, users: mergedUsers };
          });
          setCurrentUserUid(profile.uid);

          // Ensure public state + authorized private PII are synced
          const freshPublic = await loadPublicTournamentState().catch(() => null);
          if (freshPublic) {
            snapshotPlayers = freshPublic.players ?? snapshotPlayers;
            snapshotConfigs = freshPublic.configs ?? snapshotConfigs;
            setState((prev) => ({
              ...prev,
              temporada: freshPublic.temporada ?? prev.temporada,
              driveUploadRootFolderId: freshPublic.driveUploadRootFolderId ?? prev.driveUploadRootFolderId,
              driveUploadRootFolderName: freshPublic.driveUploadRootFolderName ?? prev.driveUploadRootFolderName,
              lastSyncedSpreadsheetId: freshPublic.lastSyncedSpreadsheetId ?? prev.lastSyncedSpreadsheetId,
              lastSyncedAt: freshPublic.lastSyncedAt ?? prev.lastSyncedAt,
              configs: freshPublic.configs ?? prev.configs,
              teams: freshPublic.teams ?? prev.teams,
              players: freshPublic.players ?? prev.players,
              matches: freshPublic.matches ?? prev.matches,
              transfers: freshPublic.transfers ?? prev.transfers,
              mvpVotes: freshPublic.mvpVotes ?? prev.mvpVotes,
              photos: freshPublic.photos ?? prev.photos,
            }));
          }

          await hydrateForAuthenticatedProfile(profile, snapshotPlayers, snapshotConfigs);
        } catch (err) {
          reportCloudError('Error sincronizando sesión con Firestore', err);
        }
      },
      () => {
        setCurrentUserUid(null);
        // Strip isolated PII from memory on sign-out
        setState((prev) => ({
          ...prev,
          users: [],
          players: prev.players.map((p) => ({
            ...p,
            rut: '',
            numeroMatricula: '',
            correoInstitucional: '',
            fechaNacimiento: '',
          })),
        }));
      }
    );
    return () => unsub();
  }, [hydrateForAuthenticatedProfile, reportCloudError]);

  const currentUser: AppUserProfile | null = useMemo(() => {
    if (!currentUserUid) return null;
    return state.users.find((u) => u.uid === currentUserUid) ?? null;
  }, [currentUserUid, state.users]);

  const activeModalMatch: Match | null = useMemo(() => {
    if (!activeMatchModalId) return null;
    return state.matches.find((m) => m.id === activeMatchModalId) ?? null;
  }, [activeMatchModalId, state.matches]);

  const handleNavigate = (section: NavSection) => {
    setActiveSection(section);
    if (section !== 'jugadores') {
      setInspectedPlayer(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoogleSignIn = async () => {
    setGoogleAuthLoading(true);
    setGoogleAuthError(null);
    try {
      const { user } = await signInWithGoogleWorkspace();
      const profile = await syncGoogleUserToFirestore(user);
      setState((prev) => {
        const exists = prev.users.some((u) => u.uid === profile.uid);
        const nextUsers = exists
          ? prev.users.map((u) => (u.uid === profile.uid ? profile : u))
          : [profile, ...prev.users];
        return { ...prev, users: nextUsers };
      });
      setCurrentUserUid(profile.uid);
      setAuthModalOpen(false);
      await hydrateForAuthenticatedProfile(profile, state.players, state.configs);
    } catch (err: unknown) {
      setGoogleAuthError(
        err instanceof Error
          ? err.message
          : 'No se pudo iniciar sesión con Google. Verifica que las ventanas emergentes estén habilitadas.'
      );
    } finally {
      setGoogleAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutGoogle();
    } catch {
      // Ignore if already signed out
    }
    setCurrentUserUid(null);
  };

  const handleRefreshUsers = async () => {
    if (currentUser?.role !== 'admin') return;
    try {
      const cloudUsers = await listFirestoreUsers();
      setState((prev) => ({ ...prev, users: cloudUsers }));
    } catch (err) {
      reportCloudError('No se pudo actualizar la lista de usuarios', err);
    }
  };

  const handleToggleFavoriteTeam = (teamId: string) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    const exists = currentUser.favoriteTeamIds.includes(teamId);
    const nextFavs = exists
      ? currentUser.favoriteTeamIds.filter((id) => id !== teamId)
      : [...currentUser.favoriteTeamIds, teamId].slice(0, 20);

    const updatedUser: AppUserProfile = {
      ...currentUser,
      favoriteTeamIds: nextFavs,
      updatedAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.uid === currentUser.uid ? updatedUser : u)),
    }));

    void updateFirestoreUserPreferences(currentUser.uid, { favoriteTeamIds: nextFavs }).catch(
      (err) => reportCloudError('Error actualizando favoritos', err)
    );
  };

  const handleToggleNotifications = (enabled: boolean) => {
    if (!currentUser) return;
    const updatedUser: AppUserProfile = {
      ...currentUser,
      notificationsEnabled: enabled,
      updatedAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.uid === currentUser.uid ? updatedUser : u)),
    }));

    void updateFirestoreUserPreferences(currentUser.uid, {
      notificationsEnabled: enabled,
    }).catch((err) => reportCloudError('Error actualizando notificaciones', err));
  };

  const handleVoteMvp = (match: Match, player: Player) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    const voteId = `${match.id}_${currentUser.uid}`;
    const voteRecord: MvpVoteRecord = {
      id: voteId,
      matchId: match.id,
      disciplineId: match.disciplineId,
      playerId: player.id,
      playerName: `${player.nombre} ${player.apellidoPaterno}`,
      teamId: player.teamId,
      voterUid: currentUser.uid,
      voterName: currentUser.displayName,
      createdAt: new Date().toISOString(),
    };

    setState((prev) => {
      const existingIdx = prev.mvpVotes.findIndex((v) => v.id === voteId);
      const nextVotes =
        existingIdx >= 0
          ? prev.mvpVotes.map((v, idx) => (idx === existingIdx ? voteRecord : v))
          : [voteRecord, ...prev.mvpVotes];
      return { ...prev, mvpVotes: nextVotes };
    });

    void saveFirestoreMvpVote({
      matchId: match.id,
      disciplineId: match.disciplineId,
      playerId: player.id,
      playerName: voteRecord.playerName,
      teamId: player.teamId,
      voterUid: currentUser.uid,
    }).catch((err) => reportCloudError('Error guardando voto MVP', err));
  };

  const handleUpdatePlayer = (updatedPlayer: Player) => {
    if (!currentUser) return;
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) => (p.id === updatedPlayer.id ? updatedPlayer : p)),
    }));
    void saveFirestorePlayer(updatedPlayer, false, currentUser.role).catch((err) =>
      reportCloudError('Error actualizando ficha del estudiante', err)
    );
  };

  const handleAddPlayerToTeam = (newPlayer: Player) => {
    if (!currentUser) return;
    setState((prev) => ({ ...prev, players: [newPlayer, ...prev.players] }));
    void saveFirestorePlayer(newPlayer, true, currentUser.role).catch((err) =>
      reportCloudError('Error registrando estudiante en Firestore', err)
    );
  };

  const handleAddPhoto = async (photo: PhotoEntry) => {
    await saveFirestorePhoto(photo);
    setState((prev) => ({ ...prev, photos: [photo, ...prev.photos] }));
  };

  const handleDeletePhoto = async (photoId: string) => {
    await deleteFirestorePhoto(photoId);
    setState((prev) => ({
      ...prev,
      photos: prev.photos.filter((p) => p.id !== photoId),
    }));
  };

  const handleSaveDriveRootFolder = async (folderId: string, folderName: string) => {
    await saveFirestoreSettings({
      temporada: state.temporada,
      driveUploadRootFolderId: folderId,
      driveUploadRootFolderName: folderName,
      lastSyncedSpreadsheetId: state.lastSyncedSpreadsheetId,
      lastSyncedAt: state.lastSyncedAt,
    });
    setState((prev) => ({
      ...prev,
      driveUploadRootFolderId: folderId,
      driveUploadRootFolderName: folderName,
    }));
  };

  const handleAdminChangeUserRole = async (
    targetUid: string,
    nextRole: UserRole,
    delegatedTeamId?: string,
    linkedPlayerId?: string
  ) => {
    const targetUser = state.users.find((u) => u.uid === targetUid);
    if (!targetUser || !currentUser) return;
    const check = validateRoleChange(currentUser, targetUser, nextRole);
    if (!check.allowed) {
      throw new Error(check.error || 'No autorizado para modificar roles.');
    }

    await adminUpdateFirestoreUserRole({
      actorUid: currentUser.uid,
      targetUid: targetUser.uid,
      targetEmail: targetUser.email,
      nextRole,
      delegatedTeamId: nextRole === 'delegado' ? delegatedTeamId : undefined,
      linkedPlayerId: nextRole === 'jugador' ? linkedPlayerId : undefined,
    });

    const updatedTarget: AppUserProfile = {
      ...targetUser,
      role: nextRole,
      delegatedTeamId: nextRole === 'delegado' ? delegatedTeamId : undefined,
      linkedPlayerId: nextRole === 'jugador' ? linkedPlayerId : undefined,
      updatedAt: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.uid === targetUid ? updatedTarget : u)),
    }));
  };

  const handleInspectPlayerFromHome = (player: Player) => {
    setInspectedPlayer(player);
    setActiveSection('jugadores');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenMatchInReferee = (matchId: string) => {
    setFocusedMatchId(matchId);
    setPanelInitialSubTab('arbitro');
    setActiveSection('panel');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenSheetsSync = () => {
    setPanelInitialSubTab('sheets');
    setActiveSection('panel');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateMatch = (
    updatedMatch: Match,
    scorerPlayerId?: string,
    statDelta?: Partial<{
      goles: number;
      tarjetasAmarillas: number;
      tarjetasRojas: number;
      puntos: number;
      triples: number;
      faltas: number;
      aces: number;
      bloqueos: number;
    }>
  ) => {
    if (!currentUser) return;
    let updatedPlayerForCloud: Player | null = null;

    setState((prev) => {
      const nextMatches = prev.matches.map((m) => (m.id === updatedMatch.id ? updatedMatch : m));
      const nextPlayers =
        scorerPlayerId && statDelta
          ? prev.players.map((p) => {
              if (p.id !== scorerPlayerId) return p;
              const nextP: Player = {
                ...p,
                stats: {
                  ...p.stats,
                  goles: p.stats.goles + (statDelta.goles ?? 0),
                  tarjetasAmarillas: p.stats.tarjetasAmarillas + (statDelta.tarjetasAmarillas ?? 0),
                  tarjetasRojas: p.stats.tarjetasRojas + (statDelta.tarjetasRojas ?? 0),
                  puntos: p.stats.puntos + (statDelta.puntos ?? 0),
                  triples: p.stats.triples + (statDelta.triples ?? 0),
                  faltas: p.stats.faltas + (statDelta.faltas ?? 0),
                  aces: p.stats.aces + (statDelta.aces ?? 0),
                  bloqueos: p.stats.bloqueos + (statDelta.bloqueos ?? 0),
                },
              };
              updatedPlayerForCloud = nextP;
              return nextP;
            })
          : prev.players;

      return {
        ...prev,
        matches: nextMatches,
        players: nextPlayers,
      };
    });

    void saveFirestoreMatch(updatedMatch, false, currentUser.role).catch((err) =>
      reportCloudError('Error actualizando marcador en Firestore', err)
    );
    if (updatedPlayerForCloud) {
      const target = updatedPlayerForCloud as Player;
      void updateFirestorePlayerStats(target.id, target.stats).catch((err) =>
        reportCloudError('Error actualizando estadísticas del jugador', err)
      );
    }
  };

  const handleRegisterTeam = (team: Team, roster: Player[]) => {
    if (!currentUser) return;
    setState((prev) => ({
      ...prev,
      teams: [...prev.teams, team],
      players: [...roster, ...prev.players],
    }));

    void (async () => {
      try {
        await saveFirestoreTeam(team, currentUser.uid, true);
        await Promise.all(roster.map((p) => saveFirestorePlayer(p, true, currentUser.role)));
      } catch (err) {
        reportCloudError('Error guardando inscripción del equipo en Firestore', err);
      }
    })();
  };

  const handleExecuteTransfer = (transfer: TransferRecord) => {
    if (!currentUser) return;
    const enrichedTransfer: TransferRecord = { ...transfer, createdByUid: currentUser.uid };
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.id === enrichedTransfer.playerId ? { ...p, teamId: enrichedTransfer.toTeamId } : p
      ),
      transfers: [enrichedTransfer, ...prev.transfers],
    }));

    void executeFirestoreTransfer(enrichedTransfer, currentUser.uid).catch((err) =>
      reportCloudError('Error registrando transferencia en Firestore', err)
    );
  };

  const handleUpdateConfig = (
    disciplineId: DisciplineId,
    config: DisciplineFormatConfig,
    rebuildGroups: boolean
  ) => {
    if (!currentUser) return;
    let nextTeams = state.teams;
    let nextMatches = state.matches;
    let regroupedForCloud: Team[] = [];
    let oldMatchIdsToDelete: string[] = [];
    let rebuiltMatchesForCloud: Match[] = [];

    if (rebuildGroups) {
      const otherTeams = state.teams.filter((t) => t.disciplineId !== disciplineId);
      const discTeams = state.teams.filter((t) => t.disciplineId === disciplineId);
      regroupedForCloud = generateEquitableGroups(discTeams, config.numGrupos);
      nextTeams = [...otherTeams, ...regroupedForCloud];

      oldMatchIdsToDelete = state.matches
        .filter((m) => m.disciplineId === disciplineId)
        .map((m) => m.id);
      const otherMatches = state.matches.filter((m) => m.disciplineId !== disciplineId);
      const meta = DISCIPLINE_MAP[disciplineId];
      const refId =
        meta.sportType === 'futbol7'
          ? 'ref-f7-1'
          : meta.sportType === 'voleibol'
          ? 'ref-vl-1'
          : 'ref-bk-1';
      const groups = Array.from(new Set(regroupedForCloud.map((t) => t.groupName))).sort();
      rebuiltMatchesForCloud = groups.flatMap((g) =>
        generateRoundRobinMatches(
          disciplineId,
          g,
          regroupedForCloud.filter((t) => t.groupName === g),
          meta.sedePrincipal,
          refId
        )
      );
      nextMatches = [...otherMatches, ...rebuiltMatchesForCloud];
    }

    setState((prev) => ({
      ...prev,
      configs: {
        ...prev.configs,
        [disciplineId]: config,
      },
      teams: nextTeams,
      matches: nextMatches,
    }));

    void (async () => {
      try {
        await saveFirestoreDisciplineConfig(config);
        if (rebuildGroups) {
          await Promise.all(
            regroupedForCloud.map((t) => saveFirestoreTeam(t, currentUser.uid, false))
          );
          if (oldMatchIdsToDelete.length > 0) {
            await deleteFirestoreMatchesForDiscipline(oldMatchIdsToDelete);
          }
          await Promise.all(
            rebuiltMatchesForCloud.map((m) => saveFirestoreMatch(m, true, currentUser.role))
          );
        }
      } catch (err) {
        reportCloudError('Error guardando configuración del campeonato', err);
      }
    })();
  };

  const handleMarkSynced = (spreadsheetId: string) => {
    const syncedAt = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      lastSyncedSpreadsheetId: spreadsheetId,
      lastSyncedAt: syncedAt,
    }));
    void saveFirestoreSettings({
      temporada: state.temporada,
      driveUploadRootFolderId: state.driveUploadRootFolderId,
      driveUploadRootFolderName: state.driveUploadRootFolderName,
      lastSyncedSpreadsheetId: spreadsheetId,
      lastSyncedAt: syncedAt,
    }).catch((err) => reportCloudError('Error guardando ID de Google Sheets', err));
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0d0d0d]">
      <Navbar
        activeSection={activeSection}
        currentUser={currentUser}
        state={state}
        onNavigate={handleNavigate}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenMatchModal={(match) => setActiveMatchModalId(match.id)}
      />

      {cloudError && (
        <div
          role="alert"
          className="bg-red-50 border-b border-red-300 text-red-900 px-4 py-2.5 text-xs"
        >
          <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{cloudError}</span>
            </span>
            <button
              type="button"
              onClick={() => setCloudError(null)}
              aria-label="Cerrar alerta"
              className="p-1 text-red-700 hover:text-red-950 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        {activeSection === 'inicio' && (
          <HomeView
            state={state}
            currentUser={currentUser}
            selectedDiscipline={selectedDiscipline}
            onSelectDiscipline={setSelectedDiscipline}
            onNavigate={handleNavigate}
            onInspectPlayer={handleInspectPlayerFromHome}
            onOpenMatchModal={(match) => setActiveMatchModalId(match.id)}
            onOpenMatchInReferee={handleOpenMatchInReferee}
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
            onOpenMatchModal={(match) => setActiveMatchModalId(match.id)}
            onToggleFavoriteTeam={handleToggleFavoriteTeam}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}

        {activeSection === 'jugadores' && (
          <PlayersView
            state={state}
            currentUser={currentUser}
            selectedPlayer={inspectedPlayer}
            onSelectPlayer={setInspectedPlayer}
            onUpdatePlayer={handleUpdatePlayer}
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
            onUpdatePlayer={handleUpdatePlayer}
            onAddPlayerToTeam={handleAddPlayerToTeam}
            onOpenSheetsSync={handleOpenSheetsSync}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}

        {activeSection === 'transferencias' && (
          <TransfersView
            state={state}
            currentUser={currentUser}
            onExecuteTransfer={handleExecuteTransfer}
            onOpenSheetsSync={handleOpenSheetsSync}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}

        {activeSection === 'cuenta' && (
          <AccountView
            state={state}
            currentUser={currentUser}
            onOpenAuth={() => setAuthModalOpen(true)}
            onToggleFavoriteTeam={handleToggleFavoriteTeam}
            onToggleNotifications={handleToggleNotifications}
            onUpdatePlayerProfile={handleUpdatePlayer}
            onOpenMatchModal={(match) => setActiveMatchModalId(match.id)}
            onNavigate={handleNavigate}
          />
        )}

        {activeSection === 'panel' && (
          <AdminRefereeView
            state={state}
            currentUser={currentUser}
            initialSubTab={panelInitialSubTab}
            focusedMatchId={focusedMatchId}
            onUpdateMatch={handleUpdateMatch}
            onUpdateConfig={handleUpdateConfig}
            onMarkSynced={handleMarkSynced}
            onAdminChangeUserRole={handleAdminChangeUserRole}
            onRefreshUsers={handleRefreshUsers}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}
      </main>

      <Footer onNavigate={handleNavigate} />

      <MatchMvpModal
        match={activeModalMatch}
        teams={state.teams}
        players={state.players}
        mvpVotes={state.mvpVotes}
        currentUser={currentUser}
        onClose={() => setActiveMatchModalId(null)}
        onVoteMvp={handleVoteMvp}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenMatchInReferee={handleOpenMatchInReferee}
        onToggleFavoriteTeam={handleToggleFavoriteTeam}
      />

      <AuthModal
        open={authModalOpen}
        currentUser={currentUser}
        googleAuthLoading={googleAuthLoading}
        googleAuthError={googleAuthError}
        onClose={() => setAuthModalOpen(false)}
        onGoogleSignIn={handleGoogleSignIn}
        onSignOut={handleSignOut}
        onOpenAccountHub={() => handleNavigate('cuenta')}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
