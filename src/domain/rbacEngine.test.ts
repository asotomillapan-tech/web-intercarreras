import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  buildFavoriteNotifications,
  canAccessAdminPanel,
  canDeletePhoto,
  canEditPlayerProfile,
  canManageNews,
  canManageRegistrationsAndTransfers,
  canManageRoles,
  canRefereeMatches,
  canUploadPhotos,
  canVoteMatchMvp,
  computeMatchMvpStandings,
  shouldRevealPublicMatchData,
  validateRoleChange,
} from './rbacEngine';
import type { AppUserProfile, Match, MvpVoteRecord, Player, Team } from '../types/tournament';

function makeUser(overrides: Partial<AppUserProfile>): AppUserProfile {
  return {
    uid: 'u-1',
    displayName: 'Usuario Test',
    email: 'test@ufromail.cl',
    role: 'tradicional',
    favoriteTeamIds: [],
    notificationsEnabled: true,
    authSource: 'demo',
    createdAt: '2026-04-01T10:00:00Z',
    updatedAt: '2026-04-01T10:00:00Z',
    ...overrides,
  };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'pl-1',
    teamId: 'team-1',
    disciplineId: 'f7-h-1',
    dorsal: 10,
    posicion: 'Delantero',
    nombre: 'Matías',
    apellidoPaterno: 'Soto',
    apellidoMaterno: 'Millapán',
    carrera: 'Ingeniería Civil Informática',
    facultad: 'Facultad de Ingeniería y Ciencias',
    rut: '20.456.789-1',
    numeroMatricula: '20456789122',
    correoInstitucional: 'm.soto01@ufromail.cl',
    nivelAcademico: 'Pregrado',
    fechaNacimiento: '2003-04-12',
    fotografia: '',
    esSeleccionadoUfro: false,
    stats: {
      partidosJugados: 2,
      goles: 3,
      asistencias: 1,
      tarjetasAmarillas: 0,
      tarjetasRojas: 0,
      puntos: 0,
      rebotes: 0,
      triples: 0,
      faltas: 0,
      aces: 0,
      bloqueos: 0,
    },
    ...overrides,
  };
}

test('only admins can manage roles and promote traditional users to photographer or referee', () => {
  const admin = makeUser({ uid: 'adm', role: 'admin', email: BOOTSTRAPPED_ADMIN_EMAIL });
  const traditional = makeUser({ uid: 'trad', role: 'tradicional', email: 'fan@ufromail.cl' });
  const delegate = makeUser({ uid: 'del', role: 'delegado', delegatedTeamId: 'team-1' });
  const referee = makeUser({ uid: 'ref', role: 'arbitro' });
  const photographer = makeUser({ uid: 'pho', role: 'fotografo' });

  assert.equal(canManageRoles(admin), true);
  assert.equal(canManageRoles(traditional), false);
  assert.equal(canManageRoles(delegate), false);
  assert.equal(canManageRoles(referee), false);
  assert.equal(canManageRoles(photographer), false);

  assert.equal(validateRoleChange(traditional, traditional, 'fotografo').allowed, false);
  assert.equal(validateRoleChange(delegate, traditional, 'arbitro').allowed, false);
  assert.equal(validateRoleChange(admin, traditional, 'fotografo').allowed, true);
  assert.equal(validateRoleChange(admin, traditional, 'arbitro').allowed, true);
  // Bootstrapped admin cannot be demoted
  assert.equal(validateRoleChange(admin, admin, 'tradicional').allowed, false);
});

test('role capabilities match UFRO requirements per profile', () => {
  const traditional = makeUser({ role: 'tradicional' });
  const playerUser = makeUser({
    role: 'jugador',
    linkedPlayerId: 'pl-1',
    email: 'm.soto01@ufromail.cl',
  });
  const delegate = makeUser({ role: 'delegado', delegatedTeamId: 'team-1' });
  const referee = makeUser({ role: 'arbitro' });
  const photographer = makeUser({ uid: 'pho-1', role: 'fotografo' });
  const admin = makeUser({ role: 'admin' });

  const ownPlayer = makePlayer({ id: 'pl-1', teamId: 'team-1' });
  const otherTeamPlayer = makePlayer({ id: 'pl-2', teamId: 'team-2', correoInstitucional: 'other@ufromail.cl' });

  // Player edits ONLY own data
  assert.equal(canEditPlayerProfile(playerUser, ownPlayer), true);
  assert.equal(canEditPlayerProfile(playerUser, otherTeamPlayer), false);

  // Delegate edits ONLY players of their team + registrations & transfers
  assert.equal(canEditPlayerProfile(delegate, ownPlayer), true);
  assert.equal(canEditPlayerProfile(delegate, otherTeamPlayer), false);
  assert.equal(canManageRegistrationsAndTransfers(delegate), true);
  assert.equal(canManageRegistrationsAndTransfers(traditional), false);
  assert.equal(canManageRegistrationsAndTransfers(playerUser), false);

  // Photographer uploads and deletes own photos
  assert.equal(canUploadPhotos(photographer), true);
  assert.equal(canUploadPhotos(traditional), false);
  assert.equal(canUploadPhotos(admin), true);
  assert.equal(canDeletePhoto(photographer, 'pho-1'), true);
  assert.equal(canDeletePhoto(photographer, 'pho-2'), false);
  assert.equal(canDeletePhoto(admin, 'pho-2'), true);

  // Referee console access
  assert.equal(canRefereeMatches(referee), true);
  assert.equal(canRefereeMatches(admin), true);
  assert.equal(canRefereeMatches(traditional), false);

  // Prensa role: manages championship news & enters Panel Oficial, but cannot manage roles or referee matches
  const press = makeUser({ uid: 'prs-1', role: 'prensa' });
  assert.equal(canManageNews(press), true);
  assert.equal(canManageNews(admin), true);
  assert.equal(canManageNews(referee), false);
  assert.equal(canManageNews(photographer), false);
  assert.equal(canManageNews(traditional), false);
  assert.equal(canAccessAdminPanel(press), true);
  assert.equal(canRefereeMatches(press), false);
  assert.equal(canManageRoles(press), false);
  assert.equal(validateRoleChange(admin, traditional, 'prensa').allowed, true);
  assert.equal(validateRoleChange(press, traditional, 'prensa').allowed, false);
});

test('public match data is hidden until finished while MVP voting is open during scheduled match hour', () => {
  assert.equal(shouldRevealPublicMatchData({ status: 'PROGRAMADO' }), false);
  assert.equal(shouldRevealPublicMatchData({ status: 'EN_VIVO' }), false);
  assert.equal(shouldRevealPublicMatchData({ status: 'FINALIZADO' }), true);

  assert.equal(canVoteMatchMvp({ status: 'PROGRAMADO' }), false);
  assert.equal(canVoteMatchMvp({ status: 'EN_VIVO' }), true);
  assert.equal(canVoteMatchMvp({ status: 'FINALIZADO' }), false);
});

test('MVP vote aggregation ranks candidates and computes percentages accurately', () => {
  const votes: MvpVoteRecord[] = [
    {
      id: 'v1',
      matchId: 'm-1',
      disciplineId: 'f7-h-1',
      playerId: 'p-1',
      playerName: 'Matías Soto',
      teamId: 't-1',
      voterUid: 'u-1',
      voterName: 'Ana',
      createdAt: '2026-05-01T18:05:00Z',
    },
    {
      id: 'v2',
      matchId: 'm-1',
      disciplineId: 'f7-h-1',
      playerId: 'p-1',
      playerName: 'Matías Soto',
      teamId: 't-1',
      voterUid: 'u-2',
      voterName: 'Luis',
      createdAt: '2026-05-01T18:06:00Z',
    },
    {
      id: 'v3',
      matchId: 'm-1',
      disciplineId: 'f7-h-1',
      playerId: 'p-2',
      playerName: 'Diego Pérez',
      teamId: 't-2',
      voterUid: 'u-3',
      voterName: 'Camila',
      createdAt: '2026-05-01T18:07:00Z',
    },
    {
      id: 'v4',
      matchId: 'm-1',
      disciplineId: 'f7-h-1',
      playerId: 'p-1',
      playerName: 'Matías Soto',
      teamId: 't-1',
      voterUid: 'u-4',
      voterName: 'Pedro',
      createdAt: '2026-05-01T18:08:00Z',
    },
  ];

  const tally = computeMatchMvpStandings('m-1', votes);
  assert.equal(tally.totalVotes, 4);
  assert.equal(tally.winner?.playerId, 'p-1');
  assert.equal(tally.winner?.votes, 3);
  assert.equal(tally.winner?.percentage, 75);
  assert.equal(tally.candidates[1].percentage, 25);
});

test('favorite team notifications prioritize active MVP polls without leaking live scores', () => {
  const fan = makeUser({
    role: 'tradicional',
    favoriteTeamIds: ['t-1'],
    notificationsEnabled: true,
  });
  const teams: Team[] = [
    {
      id: 't-1',
      nombre: 'Informática FC',
      sigla: 'INF',
      disciplineId: 'f7-h-1',
      carrera: 'Ingeniería Civil Informática',
      facultad: 'FICA',
      groupName: 'Grupo A',
    },
    {
      id: 't-2',
      nombre: 'Medicina FC',
      sigla: 'MED',
      disciplineId: 'f7-h-1',
      carrera: 'Medicina',
      facultad: 'Medicina',
      groupName: 'Grupo A',
    },
  ];
  const matches: Match[] = [
    {
      id: 'm-live',
      disciplineId: 'f7-h-1',
      groupName: 'Grupo A',
      fase: 'Grupos',
      jornada: 3,
      fecha: '2026-05-10',
      hora: '19:00',
      cancha: 'Cancha 1 UFRO',
      homeTeamId: 't-1',
      awayTeamId: 't-2',
      homeScore: 4,
      awayScore: 2,
      status: 'EN_VIVO',
      periodLabel: '2° Tiempo',
      clock: "38'",
      periods: [],
      fouls: { home: 2, away: 1 },
      timeouts: { home: 0, away: 0 },
      events: [],
      refereeId: 'ref-f7-1',
    },
    {
      id: 'm-fin',
      disciplineId: 'f7-h-1',
      groupName: 'Grupo A',
      fase: 'Grupos',
      jornada: 2,
      fecha: '2026-05-03',
      hora: '18:00',
      cancha: 'Cancha 1 UFRO',
      homeTeamId: 't-1',
      awayTeamId: 't-2',
      homeScore: 3,
      awayScore: 1,
      status: 'FINALIZADO',
      periodLabel: 'Finalizado',
      clock: "50'",
      periods: [],
      fouls: { home: 1, away: 2 },
      timeouts: { home: 0, away: 0 },
      events: [],
      refereeId: 'ref-f7-1',
    },
  ];

  const notifs = buildFavoriteNotifications(fan, matches, teams, []);
  assert.equal(notifs.length, 2);
  assert.equal(notifs[0].type, 'VOTACION_MVP');
  // Live score 4 - 2 must NOT appear in live notification text!
  assert.equal(notifs[0].detail.includes('4 - 2'), false);
  // Finalized score 3 - 1 SHOULD appear!
  assert.equal(notifs[1].type, 'RESULTADO');
  assert.equal(notifs[1].detail.includes('3 - 1'), true);
});

test('3-panel RBAC scopes General Admin, Press, and Referee panels accurately', async () => {
  const rbac = await import('./rbacEngine');

  const admin = makeUser({ uid: 'adm-1', role: 'admin', email: BOOTSTRAPPED_ADMIN_EMAIL });
  const mod = makeUser({ uid: 'mod-1', role: 'moderador', email: 'mod@ufromail.cl' });
  const prensa = makeUser({ uid: 'prs-1', role: 'prensa' });
  const fotografo = makeUser({ uid: 'pho-1', role: 'fotografo' });
  const jefeFutbol = makeUser({ uid: 'jf-1', role: 'jefe_arbitros_futbol' });
  const jefeBasket = makeUser({ uid: 'jb-1', role: 'jefe_arbitros_basquetbol' });
  const jefeVoley = makeUser({ uid: 'jv-1', role: 'jefe_arbitros_voleibol' });
  const arbitro = makeUser({ uid: 'arb-1', role: 'arbitro' });
  const trad = makeUser({ uid: 'tr-1', role: 'tradicional' });

  // Panel access matrix
  assert.deepEqual(rbac.getAccessibleOfficialPanels(admin), ['general', 'prensa', 'arbitraje']);
  assert.deepEqual(rbac.getAccessibleOfficialPanels(mod), ['general', 'prensa']);
  assert.deepEqual(rbac.getAccessibleOfficialPanels(prensa), ['prensa']);
  assert.deepEqual(rbac.getAccessibleOfficialPanels(fotografo), ['prensa']);
  assert.deepEqual(rbac.getAccessibleOfficialPanels(jefeFutbol), ['arbitraje']);
  assert.deepEqual(rbac.getAccessibleOfficialPanels(arbitro), ['arbitraje']);
  assert.deepEqual(rbac.getAccessibleOfficialPanels(trad), []);

  // Moderator can assign non-admin roles, but NEVER admin or edit an existing admin
  assert.equal(rbac.validateRoleChange(mod, trad, 'prensa').allowed, true);
  assert.equal(rbac.validateRoleChange(mod, trad, 'jefe_arbitros_voleibol').allowed, true);
  assert.equal(rbac.validateRoleChange(mod, trad, 'admin').allowed, false);
  assert.equal(rbac.validateRoleChange(mod, admin, 'tradicional').allowed, false);

  // Unified discipline scoping for Referee Chiefs
  assert.deepEqual(rbac.getRefereeChiefDisciplines(jefeFutbol), ['f7-h-1', 'f7-h-2', 'f7-h-3', 'f7-m']);
  assert.deepEqual(rbac.getRefereeChiefDisciplines(jefeBasket), ['basquet-h', 'basquet-3x3-m']);
  assert.deepEqual(rbac.getRefereeChiefDisciplines(jefeVoley), ['voley-m', 'voley-h']);
  assert.equal(rbac.canAssignRefereesForDiscipline(jefeFutbol, 'f7-m'), true);
  assert.equal(rbac.canAssignRefereesForDiscipline(jefeFutbol, 'voley-m'), false);
  assert.equal(rbac.canAssignRefereesForDiscipline(jefeVoley, 'voley-m'), true);
  assert.equal(rbac.canAssignRefereesForDiscipline(jefeVoley, 'voley-h'), true);
  assert.equal(rbac.canAssignRefereesForDiscipline(arbitro, 'f7-h-1'), false);

  // Referee Desk visibility: Chiefs see all matches in their sport; Arbitro sees ONLY assigned matches
  const mFutbolAssigned = { disciplineId: 'f7-m' as const, assignedRefereeUid: 'arb-1', refereeId: 'arb-1', status: 'PROGRAMADO' as const };
  const mFutbolOther = { disciplineId: 'f7-h-2' as const, assignedRefereeUid: 'arb-2', refereeId: 'arb-2', status: 'PROGRAMADO' as const };
  const mVoleyAssigned = { disciplineId: 'voley-m' as const, assignedRefereeUid: 'arb-1', refereeId: 'arb-1', status: 'EN_VIVO' as const };

  assert.equal(rbac.canViewMatchInRefereeDesk(jefeFutbol, mFutbolAssigned), true);
  assert.equal(rbac.canViewMatchInRefereeDesk(jefeFutbol, mFutbolOther), true);
  assert.equal(rbac.canViewMatchInRefereeDesk(jefeFutbol, mVoleyAssigned), false);

  assert.equal(rbac.canViewMatchInRefereeDesk(arbitro, mFutbolAssigned), true);
  assert.equal(rbac.canViewMatchInRefereeDesk(arbitro, mFutbolOther), false);
  assert.equal(rbac.canViewMatchInRefereeDesk(arbitro, mVoleyAssigned), true);
  assert.equal(rbac.canEditMatchInRefereeDesk(arbitro, mFutbolOther), false);
  assert.equal(rbac.canEditMatchInRefereeDesk(arbitro, { ...mFutbolAssigned, status: 'FINALIZADO' }), false);
  assert.equal(rbac.canEditMatchInRefereeDesk(admin, { ...mFutbolAssigned, status: 'FINALIZADO' }), true);
});

