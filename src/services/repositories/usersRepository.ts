import type { User } from 'firebase/auth';
import type { AppUserProfile, RefereeRosterEntry, UserRole } from '../../types/tournament';
import { tursoRequest } from '../tursoApiClient';

export async function syncGoogleUserToFirestore(user: User): Promise<AppUserProfile> {
  const res = await tursoRequest<{ profile: AppUserProfile }>('/auth/sync', {
    method: 'POST',
    requiresAuth: true,
    body: {
      displayName: user.displayName || user.email?.split('@')[0] || 'Usuario UFRO',
      photoURL: user.photoURL || undefined,
    },
  });
  return res.profile;
}

export async function updateFirestoreUserPreferences(
  _uid: string,
  updates: {
    favoriteTeamIds?: string[];
    notificationsEnabled?: boolean;
    displayName?: string;
    fechaNacimiento?: string;
    carrera?: string;
    facultad?: string;
    telefono?: string;
  }
): Promise<void> {
  await tursoRequest('/auth/preferences', {
    method: 'PATCH',
    requiresAuth: true,
    body: updates,
  });
}

export async function adminUpdateFirestoreUserRole(params: {
  actorUid: string;
  targetUid: string;
  targetEmail: string;
  targetDisplayName?: string;
  nextRole: UserRole;
  delegatedTeamId?: string;
  linkedPlayerId?: string;
}): Promise<void> {
  await tursoRequest(`/users/${encodeURIComponent(params.targetUid)}/role`, {
    method: 'PATCH',
    requiresAuth: true,
    body: {
      role: params.nextRole,
      delegatedTeamId: params.delegatedTeamId,
      linkedPlayerId: params.linkedPlayerId,
    },
  });
}

export async function listFirestoreUsers(): Promise<AppUserProfile[]> {
  const res = await tursoRequest<{ users: AppUserProfile[] }>('/users', {
    requiresAuth: true,
  });
  return res.users ?? [];
}

export async function listFirestoreRefereeRoster(): Promise<RefereeRosterEntry[]> {
  try {
    const res = await tursoRequest<{ roster: RefereeRosterEntry[] }>('/referee-roster', {
      requiresAuth: true,
    });
    return res.roster ?? [];
  } catch {
    return [];
  }
}

export async function syncRefereeRosterFromUsers(_users: AppUserProfile[]): Promise<void> {
  // Turso resolves the referee roster directly from the indexed `users` table (zero duplication needed).
}
