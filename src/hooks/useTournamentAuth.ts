import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import {
  canAssignReferees,
  canManageNews,
  canManageRoles,
  isAdminOrModerator,
  isRefereeOrChiefRole,
  validateRoleChange,
} from '../domain/rbacEngine';
import { mergeLazyPlayersPreservingPii } from '../domain/readOptimizationEngine';
import {
  initGoogleAuth,
  signInWithGoogleBasic,
  signOutGoogle,
} from '../services/firebaseAuth';
import {
  adminUpdateFirestoreUserRole,
  ensureAllConfigsInFirestore,
  fetchPlayerById,
  listAllFirestoreNews,
  listAllFirestoreTransfers,
  listDelegateFirestoreTransfers,
  listFirestoreRefereeRoster,
  listFirestoreUsers,
  loadAuthorizedPlayerPrivateMap,
  syncGoogleUserToFirestore,
  syncRefereeRosterFromUsers,
  updateFirestoreUserPreferences,
} from '../services/firestoreService';
import type {
  AppUserProfile,
  DisciplineFormatConfig,
  DisciplineId,
  Player,
  TournamentState,
  UserRole,
} from '../types/tournament';

interface UseTournamentAuthParams {
  state: TournamentState;
  setState: Dispatch<SetStateAction<TournamentState>>;
  stateRef: MutableRefObject<TournamentState>;
  currentUserRoleRef: MutableRefObject<UserRole | null>;
  reportCloudError: (context: string, err: unknown, streamKey?: string) => void;
  clearCloudError: () => void;
  handleLoadTeamPlayers: (teamId: string, disciplineId?: DisciplineId) => Promise<Player[]>;
  onBeforeSignOut: () => Promise<void>;
}

export function useTournamentAuth({
  state,
  setState,
  stateRef,
  currentUserRoleRef,
  reportCloudError,
  clearCloudError,
  handleLoadTeamPlayers,
  onBeforeSignOut,
}: UseTournamentAuthParams) {
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false);
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);

  const hydrateForAuthenticatedProfile = useCallback(
    async (
      profile: AppUserProfile,
      currentPlayers: Player[],
      currentConfigs: Record<DisciplineId, DisciplineFormatConfig>
    ) => {
      if (
        isAdminOrModerator(profile) ||
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

      if (canManageNews(profile)) {
        try {
          const allNews = await listAllFirestoreNews();
          setState((prev) => ({ ...prev, news: allNews }));
        } catch (err) {
          console.error('Error cargando borradores de noticias:', err);
        }
      }

      if (canAssignReferees(profile)) {
        try {
          const roster = await listFirestoreRefereeRoster();
          setState((prev) => ({ ...prev, refereeRoster: roster }));
        } catch (err) {
          console.error('Error cargando padrón arbitral:', err);
        }
      }

      if (profile.role === 'delegado' && profile.delegatedTeamId) {
        try {
          const delegateTransfers = await listDelegateFirestoreTransfers(profile.delegatedTeamId);
          setState((prev) => {
            const byId = new Map(prev.transfers.map((t) => [t.id, t]));
            delegateTransfers.forEach((tr) => byId.set(tr.id, tr));
            return { ...prev, transfers: Array.from(byId.values()) };
          });
        } catch (err) {
          console.error('Error cargando solicitudes de transferencia del delegado:', err);
        }
      }

      if (isAdminOrModerator(profile)) {
        try {
          const [cloudUsers, allTransfers] = await Promise.all([
            listFirestoreUsers(),
            listAllFirestoreTransfers().catch(() => null),
            ensureAllConfigsInFirestore(currentConfigs).catch(() => undefined),
          ]);
          void syncRefereeRosterFromUsers(cloudUsers);
          setState((prev) => {
            const byUid = new Map(prev.users.map((u) => [u.uid, u]));
            cloudUsers.forEach((cu) => byUid.set(cu.uid, cu));
            return {
              ...prev,
              users: Array.from(byUid.values()),
              transfers: allTransfers ?? prev.transfers,
            };
          });
        } catch (err) {
          reportCloudError('Error cargando directorio de usuarios', err);
        }
      }
    },
    [reportCloudError, setState]
  );

  useEffect(() => {
    const unsub = initGoogleAuth(
      async (firebaseUser) => {
        try {
          const profile = await syncGoogleUserToFirestore(firebaseUser);
          currentUserRoleRef.current = profile.role;

          setState((prev) => {
            const exists = prev.users.some((u) => u.uid === profile.uid);
            const mergedUsers = exists
              ? prev.users.map((u) => (u.uid === profile.uid ? profile : u))
              : [profile, ...prev.users];
            return { ...prev, users: mergedUsers };
          });
          setCurrentUserUid(profile.uid);
          clearCloudError();

          await hydrateForAuthenticatedProfile(
            profile,
            stateRef.current.players,
            stateRef.current.configs
          );
        } catch (err) {
          reportCloudError('Error sincronizando sesión con la base de datos', err);
        }
      },
      () => {
        currentUserRoleRef.current = null;
        setCurrentUserUid(null);
        setState((prev) => ({
          ...prev,
          users: [],
          news: prev.news.filter((n) => n.published),
          transfers: prev.transfers.filter((t) => t.estado === 'APROBADA'),
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
  }, [clearCloudError, currentUserRoleRef, hydrateForAuthenticatedProfile, reportCloudError, setState, stateRef]);

  const currentUser: AppUserProfile | null = useMemo(() => {
    if (!currentUserUid) return null;
    return state.users.find((u) => u.uid === currentUserUid) ?? null;
  }, [currentUserUid, state.users]);

  useEffect(() => {
    currentUserRoleRef.current = currentUser?.role ?? null;
  }, [currentUser?.role, currentUserRoleRef]);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'delegado' && currentUser.delegatedTeamId) {
      void handleLoadTeamPlayers(currentUser.delegatedTeamId);
    }
    if (currentUser.role === 'jugador' && currentUser.linkedPlayerId) {
      const alreadyLoaded = stateRef.current.players.some(
        (p) => p.id === currentUser.linkedPlayerId
      );
      if (!alreadyLoaded) {
        fetchPlayerById(currentUser.linkedPlayerId)
          .then((playerDoc) => {
            if (!playerDoc) return;
            setState((prev) => ({
              ...prev,
              players: mergeLazyPlayersPreservingPii(prev.players, [playerDoc]),
            }));
          })
          .catch(() => {
            // Non-blocking fallback
          });
      }
    }
  }, [currentUser, handleLoadTeamPlayers, setState, stateRef]);

  const piiHydratedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentUser) {
      piiHydratedKeyRef.current = null;
      return;
    }
    if (
      !isAdminOrModerator(currentUser) &&
      currentUser.role !== 'delegado' &&
      currentUser.role !== 'jugador'
    ) {
      return;
    }
    if (state.players.length === 0) return;

    const hydrationKey = `${currentUser.uid}:${currentUser.role}:${state.players.length}`;
    if (piiHydratedKeyRef.current === hydrationKey) return;
    piiHydratedKeyRef.current = hydrationKey;

    let active = true;
    loadAuthorizedPlayerPrivateMap(currentUser, state.players)
      .then((privateMap) => {
        if (!active || Object.keys(privateMap).length === 0) return;
        setState((prev) => ({
          ...prev,
          players: prev.players.map((p) => {
            const pii = privateMap[p.id];
            return pii ? { ...p, ...pii } : p;
          }),
        }));
      })
      .catch((err) => {
        console.error('Error hidratando datos privados de jugadores:', err);
      });

    return () => {
      active = false;
    };
  }, [currentUser, state.players, setState]);

  const handleGoogleSignIn = async () => {
    setGoogleAuthLoading(true);
    setGoogleAuthError(null);
    try {
      const { user } = await signInWithGoogleBasic();
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
      await hydrateForAuthenticatedProfile(profile, stateRef.current.players, stateRef.current.configs);
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
    await onBeforeSignOut();
    try {
      await signOutGoogle();
    } catch {
      // Ignore if already signed out
    }
    setCurrentUserUid(null);
  };

  const handleRefreshUsers = async () => {
    if (!canManageRoles(currentUser)) return;
    try {
      const cloudUsers = await listFirestoreUsers();
      void syncRefereeRosterFromUsers(cloudUsers);
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

  const handleUpdateUserProfile = async (updates: {
    displayName: string;
    fechaNacimiento: string;
    carrera: string;
    facultad: string;
    telefono: string;
  }) => {
    if (!currentUser) return;
    const sanitized = {
      displayName: updates.displayName.trim().slice(0, 120),
      fechaNacimiento: updates.fechaNacimiento.trim().slice(0, 20),
      carrera: updates.carrera.trim().slice(0, 140),
      facultad: updates.facultad.trim().slice(0, 140),
      telefono: updates.telefono.trim().slice(0, 30),
    };
    if (!sanitized.displayName) {
      throw new Error('Ingresa un nombre válido.');
    }

    await updateFirestoreUserPreferences(currentUser.uid, sanitized);

    const updatedUser: AppUserProfile = {
      ...currentUser,
      ...sanitized,
      updatedAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.uid === currentUser.uid ? updatedUser : u)),
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
      targetDisplayName: targetUser.displayName,
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

    setState((prev) => {
      const nextRoster = (prev.refereeRoster ?? []).filter((r) => r.uid !== targetUid);
      if (isRefereeOrChiefRole(nextRole)) {
        nextRoster.push({
          uid: targetUid,
          displayName: targetUser.displayName,
          role: nextRole as
            | 'arbitro'
            | 'jefe_arbitros_futbol'
            | 'jefe_arbitros_basquetbol'
            | 'jefe_arbitros_voleibol',
          updatedAt: new Date().toISOString(),
        });
        nextRoster.sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));
      }
      return {
        ...prev,
        users: prev.users.map((u) => (u.uid === targetUid ? updatedTarget : u)),
        refereeRoster: nextRoster,
      };
    });
  };

  return {
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
  };
}
