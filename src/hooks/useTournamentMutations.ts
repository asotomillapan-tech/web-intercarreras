import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { DISCIPLINE_MAP } from '../data/ufroSeed';
import { applyStatDeltaClamped, type PlayerStatDelta } from '../domain/liveMatchEngine';
import { canManageNews, isAdminOrModerator } from '../domain/rbacEngine';
import type { DeletedEntityIds } from '../domain/sheetsMergeEngine';
import { generateEquitableGroups, generateRoundRobinMatches } from '../domain/tournamentEngine';
import {
  approveFirestoreTransferRequest,
  bulkUpdateFirestoreTeams,
  createFirestoreTransferRequest,
  deleteFirestoreMatchesForDiscipline,
  deleteFirestoreNewsArticle,
  deleteFirestorePhoto,
  deleteFirestorePlayer,
  deleteFirestoreTeam,
  rejectFirestoreTransferRequest,
  saveFirestoreAwardNominees,
  saveFirestoreChampionshipMvpVote,
  saveFirestoreDisciplineConfig,
  saveFirestoreLeyendasEntry,
  saveFirestoreMatch,
  saveFirestoreMvpVote,
  saveFirestoreNewsArticle,
  saveFirestorePhoto,
  saveFirestorePlayer,
  saveFirestorePositionAwardVote,
  saveFirestoreSettings,
  saveFirestoreTeam,
  updateFirestorePlayerStats,
} from '../services/firestoreService';
import { saveCachedPublicTournamentState } from '../services/localCache';
import type {
  AppUserProfile,
  ChampionshipMvpVoteRecord,
  DisciplineFormatConfig,
  DisciplineId,
  HomeFeaturedConfig,
  LeyendasLeaderboardEntry,
  Match,
  MvpVoteRecord,
  NewsArticle,
  PhotoEntry,
  Player,
  PositionAwardVoteRecord,
  Team,
  TournamentState,
  TransferRecord,
} from '../types/tournament';

interface UseTournamentMutationsParams {
  state: TournamentState;
  setState: Dispatch<SetStateAction<TournamentState>>;
  stateRef: MutableRefObject<TournamentState>;
  currentUser: AppUserProfile | null;
  inspectedTeamId: string | null;
  activeNewsArticleId: string | null;
  onCloseInspectedTeam: () => void;
  onSyncOpenNewsArticle: (article: NewsArticle | null) => void;
  onRequireAuth: () => void;
  setDeletedTombstones: Dispatch<SetStateAction<DeletedEntityIds>>;
  queueMasterSyncForDiscipline: (disciplineId: DisciplineId) => void;
  reportCloudError: (context: string, err: unknown, streamKey?: string) => void;
}

export function useTournamentMutations({
  state,
  setState,
  stateRef,
  currentUser,
  inspectedTeamId,
  activeNewsArticleId,
  onCloseInspectedTeam,
  onSyncOpenNewsArticle,
  onRequireAuth,
  setDeletedTombstones,
  queueMasterSyncForDiscipline,
  reportCloudError,
}: UseTournamentMutationsParams) {
  const handleVoteMvp = (match: Match, player: Player) => {
    if (!currentUser) {
      onRequireAuth();
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
    }).catch((err) => reportCloudError('Error guardando voto POTM', err));
  };

  const handleSaveAwardNominees = async (disciplineId: DisciplineId, nomineeIds: string[]) => {
    if (!isAdminOrModerator(currentUser)) return;
    const cleaned = Array.from(new Set(nomineeIds.map((id) => id.trim()).filter(Boolean))).slice(
      0,
      5
    );
    setState((prev) => ({
      ...prev,
      awardNominees: {
        ...prev.awardNominees,
        [disciplineId]: cleaned,
      },
    }));
    try {
      await saveFirestoreAwardNominees(disciplineId, stateRef.current.temporada, cleaned);
    } catch (err) {
      reportCloudError('Error guardando nominados al MVP del Campeonato', err);
      throw err;
    }
  };

  const handleVoteChampionshipMvp = async (disciplineId: DisciplineId, player: Player) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    const voteId = `${disciplineId}_${currentUser.uid}`;
    const now = new Date().toISOString();
    const record: ChampionshipMvpVoteRecord = {
      id: voteId,
      disciplineId,
      temporada: stateRef.current.temporada,
      voterUid: currentUser.uid,
      playerId: player.id,
      playerName: `${player.nombre} ${player.apellidoPaterno}`,
      teamId: player.teamId,
      createdAt: now,
      updatedAt: now,
    };
    setState((prev) => {
      const exists = prev.championshipMvpVotes.some((v) => v.id === voteId);
      return {
        ...prev,
        championshipMvpVotes: exists
          ? prev.championshipMvpVotes.map((v) => (v.id === voteId ? record : v))
          : [record, ...prev.championshipMvpVotes],
      };
    });
    try {
      await saveFirestoreChampionshipMvpVote(record);
    } catch (err) {
      reportCloudError('Error guardando voto MVP del Campeonato', err);
    }
  };

  const handleVotePositionAward = async (
    disciplineId: DisciplineId,
    positionKey: string,
    positionLabel: string,
    player: Player
  ) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    const voteId = `${disciplineId}_${positionKey}_${currentUser.uid}`;
    const now = new Date().toISOString();
    const record: PositionAwardVoteRecord = {
      id: voteId,
      disciplineId,
      temporada: stateRef.current.temporada,
      positionKey,
      positionLabel,
      voterUid: currentUser.uid,
      playerId: player.id,
      playerName: `${player.nombre} ${player.apellidoPaterno}`,
      teamId: player.teamId,
      createdAt: now,
      updatedAt: now,
    };
    setState((prev) => {
      const exists = prev.positionAwardVotes.some((v) => v.id === voteId);
      return {
        ...prev,
        positionAwardVotes: exists
          ? prev.positionAwardVotes.map((v) => (v.id === voteId ? record : v))
          : [record, ...prev.positionAwardVotes],
      };
    });
    try {
      await saveFirestorePositionAwardVote(record);
    } catch (err) {
      reportCloudError('Error guardando voto por posición', err);
    }
  };

  const handleSaveLeyendasEntry = async (entry: LeyendasLeaderboardEntry) => {
    if (!currentUser) {
      onRequireAuth();
      throw new Error('Debes iniciar sesión con Google para publicar en el Top Global.');
    }
    try {
      await saveFirestoreLeyendasEntry(entry);
      setState((prev) => {
        const filtered = prev.leyendasLeaderboard.filter((item) => item.id !== entry.id);
        const next = [entry, ...filtered].sort((a, b) => b.score - a.score);
        return {
          ...prev,
          leyendasLeaderboard: next,
        };
      });
    } catch (err) {
      reportCloudError('Error publicando carrera en el Top Global de LEYENDAS', err);
      throw err;
    }
  };

  const handleUpdatePlayer = (updatedPlayer: Player) => {
    if (!currentUser) return;
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) => (p.id === updatedPlayer.id ? updatedPlayer : p)),
    }));
    queueMasterSyncForDiscipline(updatedPlayer.disciplineId);
    void saveFirestorePlayer(updatedPlayer, false, currentUser.role).catch((err) =>
      reportCloudError('Error actualizando ficha del estudiante', err)
    );
  };

  const handleAddPlayerToTeam = (newPlayer: Player) => {
    if (!currentUser) return;
    setState((prev) => ({ ...prev, players: [newPlayer, ...prev.players] }));
    queueMasterSyncForDiscipline(newPlayer.disciplineId);
    void saveFirestorePlayer(newPlayer, true, currentUser.role).catch((err) =>
      reportCloudError('Error registrando estudiante en la base de datos', err)
    );
  };

  const handleDeletePlayer = (player: Player) => {
    if (!isAdminOrModerator(currentUser)) return;
    setState((prev) => ({
      ...prev,
      players: prev.players.filter((p) => p.id !== player.id),
    }));
    setDeletedTombstones((prev) => ({
      ...prev,
      playerIds: Array.from(new Set([...(prev.playerIds ?? []), player.id])),
    }));
    queueMasterSyncForDiscipline(player.disciplineId);
    void deleteFirestorePlayer(player.id).catch((err) =>
      reportCloudError('Error eliminando jugador en la base de datos', err)
    );
  };

  const handleAdminAddTeam = (team: Team) => {
    if (!currentUser || !isAdminOrModerator(currentUser)) return;
    const enriched: Team = { ...team, createdByUid: currentUser.uid };
    setState((prev) => ({
      ...prev,
      teams: [...prev.teams, enriched],
    }));
    queueMasterSyncForDiscipline(enriched.disciplineId);
    void saveFirestoreTeam(enriched, currentUser.uid, true, currentUser.role).catch((err) =>
      reportCloudError('Error agregando equipo en la base de datos', err)
    );
  };

  const handleUpdateTeam = (team: Team) => {
    if (!currentUser) return;
    const isStaff = isAdminOrModerator(currentUser);
    const isAuthorizedDelegado =
      currentUser.role === 'delegado' &&
      (currentUser.delegatedTeamId === team.id || team.createdByUid === currentUser.uid);
    if (!isStaff && !isAuthorizedDelegado) return;

    setState((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => (t.id === team.id ? { ...t, ...team } : t)),
    }));
    queueMasterSyncForDiscipline(team.disciplineId);
    void saveFirestoreTeam(team, currentUser.uid, false, currentUser.role).catch((err) =>
      reportCloudError('Error actualizando equipo en la base de datos', err)
    );
  };

  const handleBulkUpdateTeams = async (
    updates: Array<{ team: Team; clearAnioFundacion?: boolean }>
  ) => {
    if (!currentUser || !isAdminOrModerator(currentUser) || updates.length === 0) return;
    const updateMap = new Map(updates.map((u) => [u.team.id, u]));
    setState((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => {
        const match = updateMap.get(t.id);
        if (!match) return t;
        const merged: Team = { ...t, ...match.team };
        if (match.clearAnioFundacion) {
          merged.anioFundacion = undefined;
        }
        return merged;
      }),
    }));
    const affectedDisciplines = new Set(updates.map((u) => u.team.disciplineId));
    affectedDisciplines.forEach((d) => queueMasterSyncForDiscipline(d));
    try {
      await bulkUpdateFirestoreTeams({
        teams: updates.map((u) => u.team),
        actorUid: currentUser.uid,
        actorRole: currentUser.role,
        clearAnioFundacion: updates.some((u) => u.clearAnioFundacion),
      });
    } catch (err) {
      reportCloudError('Error aplicando edición masiva de equipos en la base de datos', err);
      throw err;
    }
  };

  const handleAdminDeleteTeam = (team: Team) => {
    if (!isAdminOrModerator(currentUser)) return;
    const affectedPlayerIds = stateRef.current.players
      .filter((p) => p.teamId === team.id)
      .map((p) => p.id);
    const affectedMatchIds = stateRef.current.matches
      .filter((m) => m.homeTeamId === team.id || m.awayTeamId === team.id)
      .map((m) => m.id);

    setState((prev) => ({
      ...prev,
      teams: prev.teams.filter((t) => t.id !== team.id),
      players: prev.players.filter((p) => p.teamId !== team.id),
      matches: prev.matches.filter((m) => m.homeTeamId !== team.id && m.awayTeamId !== team.id),
    }));
    if (inspectedTeamId === team.id) {
      onCloseInspectedTeam();
    }
    setDeletedTombstones((prev) => ({
      teamIds: Array.from(new Set([...(prev.teamIds ?? []), team.id])),
      playerIds: Array.from(new Set([...(prev.playerIds ?? []), ...affectedPlayerIds])),
      matchIds: Array.from(new Set([...(prev.matchIds ?? []), ...affectedMatchIds])),
    }));
    queueMasterSyncForDiscipline(team.disciplineId);
    void deleteFirestoreTeam(team.id, {
      playerIds: affectedPlayerIds,
      matchIds: affectedMatchIds,
    }).catch((err) => reportCloudError('Error eliminando equipo en la base de datos', err));
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

  const handleAddNews = async (article: NewsArticle) => {
    if (!canManageNews(currentUser)) return;
    await saveFirestoreNewsArticle(article, true);
    setState((prev) => ({
      ...prev,
      news: [article, ...prev.news],
    }));
  };

  const handleUpdateNews = async (article: NewsArticle) => {
    if (!canManageNews(currentUser)) return;
    await saveFirestoreNewsArticle(article, false);
    setState((prev) => ({
      ...prev,
      news: prev.news.map((n) => (n.id === article.id ? article : n)),
    }));
    if (activeNewsArticleId === article.id) {
      onSyncOpenNewsArticle(article);
    }
  };

  const handleDeleteNews = async (article: NewsArticle) => {
    if (!canManageNews(currentUser)) return;
    await deleteFirestoreNewsArticle(article.id);
    setState((prev) => ({
      ...prev,
      news: prev.news.filter((n) => n.id !== article.id),
    }));
    if (activeNewsArticleId === article.id) {
      onSyncOpenNewsArticle(null);
    }
  };

  const handleSaveDriveRootFolder = async (folderId: string, folderName: string) => {
    await saveFirestoreSettings({
      temporada: state.temporada,
      driveUploadRootFolderId: folderId,
      driveUploadRootFolderName: folderName,
      masterSheets: state.masterSheets,
      autoSyncSheetsEnabled: state.autoSyncSheetsEnabled,
      lastSyncedSpreadsheetId: state.lastSyncedSpreadsheetId,
      lastSyncedAt: state.lastSyncedAt,
    });
    setState((prev) => ({
      ...prev,
      driveUploadRootFolderId: folderId,
      driveUploadRootFolderName: folderName,
    }));
  };

  const handleUpdateMatch = (
    updatedMatch: Match,
    scorerPlayerId?: string,
    statDelta?: PlayerStatDelta
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
                stats: applyStatDeltaClamped(p.stats, statDelta),
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

    queueMasterSyncForDiscipline(updatedMatch.disciplineId);

    void saveFirestoreMatch(updatedMatch, false, currentUser.role).catch((err) =>
      reportCloudError('Error actualizando marcador en la base de datos', err)
    );
    if (updatedPlayerForCloud) {
      const target = updatedPlayerForCloud as Player;
      void updateFirestorePlayerStats(target.id, target.stats).catch((err) =>
        reportCloudError('Error actualizando estadísticas del jugador', err)
      );
    }
  };

  const handleAdminAddMatch = (newMatch: Match) => {
    if (!currentUser || !isAdminOrModerator(currentUser)) return;
    setState((prev) => ({
      ...prev,
      matches: [newMatch, ...prev.matches],
    }));
    queueMasterSyncForDiscipline(newMatch.disciplineId);
    void saveFirestoreMatch(newMatch, true, currentUser.role).catch((err) =>
      reportCloudError('Error programando nuevo encuentro en la base de datos', err)
    );
  };

  const handleRegisterTeam = (team: Team, roster: Player[]) => {
    if (!currentUser) return;
    setState((prev) => ({
      ...prev,
      teams: [...prev.teams, team],
      players: [...roster, ...prev.players],
    }));
    queueMasterSyncForDiscipline(team.disciplineId);

    void (async () => {
      try {
        await saveFirestoreTeam(team, currentUser.uid, true);
        await Promise.all(roster.map((p) => saveFirestorePlayer(p, true, currentUser.role)));
      } catch (err) {
        reportCloudError('Error guardando inscripción del equipo en la base de datos', err);
      }
    })();
  };

  const handleCreateTransferRequest = (transfer: TransferRecord) => {
    if (!currentUser || currentUser.role !== 'delegado') return;
    const enrichedTransfer: TransferRecord = { ...transfer, createdByUid: currentUser.uid };
    setState((prev) => ({
      ...prev,
      transfers: [enrichedTransfer, ...prev.transfers],
    }));

    void createFirestoreTransferRequest(enrichedTransfer, currentUser.uid).catch((err) =>
      reportCloudError('Error enviando solicitud de transferencia en la base de datos', err)
    );
  };

  const handleApproveTransferRequest = (
    updatedTransfer: TransferRecord,
    isFromDelegate: boolean
  ) => {
    if (!currentUser || currentUser.role !== 'delegado') return;
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.id === updatedTransfer.playerId ? { ...p, teamId: updatedTransfer.toTeamId } : p
      ),
      transfers: prev.transfers.map((t) =>
        t.id === updatedTransfer.id ? updatedTransfer : t
      ),
    }));
    queueMasterSyncForDiscipline(updatedTransfer.disciplineId);

    void approveFirestoreTransferRequest(updatedTransfer, currentUser.uid, isFromDelegate).catch(
      (err) => reportCloudError('Error confirmando transferencia en la base de datos', err)
    );
  };

  const handleRejectTransferRequest = (updatedTransfer: TransferRecord) => {
    if (!currentUser || currentUser.role !== 'delegado') return;
    setState((prev) => ({
      ...prev,
      transfers: prev.transfers.map((t) =>
        t.id === updatedTransfer.id ? updatedTransfer : t
      ),
    }));

    void rejectFirestoreTransferRequest(updatedTransfer.id, currentUser.uid).catch((err) =>
      reportCloudError('Error rechazando solicitud de transferencia en la base de datos', err)
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
    if (oldMatchIdsToDelete.length > 0) {
      setDeletedTombstones((prev) => ({
        ...prev,
        matchIds: Array.from(new Set([...(prev.matchIds ?? []), ...oldMatchIdsToDelete])),
      }));
    }
    queueMasterSyncForDiscipline(disciplineId);

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

  const handleSaveHomeFeatured = async (config: HomeFeaturedConfig) => {
    await saveFirestoreSettings({
      temporada: state.temporada,
      driveUploadRootFolderId: state.driveUploadRootFolderId,
      driveUploadRootFolderName: state.driveUploadRootFolderName,
      masterSheets: state.masterSheets,
      autoSyncSheetsEnabled: state.autoSyncSheetsEnabled,
      lastSyncedSpreadsheetId: state.lastSyncedSpreadsheetId,
      lastSyncedAt: state.lastSyncedAt,
      homeFeatured: config,
    });
    setState((prev) => {
      const next = { ...prev, homeFeatured: config };
      saveCachedPublicTournamentState(next);
      return next;
    });
  };

  return {
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
  };
}
