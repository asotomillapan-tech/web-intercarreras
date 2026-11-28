import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, Search, UserCog } from 'lucide-react';
import { DISCIPLINE_MAP } from '../../data/ufroSeed';
import {
  ALL_USER_ROLES,
  BOOTSTRAPPED_ADMIN_EMAIL,
  ROLE_META,
  validateRoleChange,
} from '../../domain/rbacEngine';
import type {
  AppUserProfile,
  Player,
  Team,
  UserRole,
} from '../../types/tournament';

interface AdminUsersRolesSectionProps {
  currentUser: AppUserProfile | null;
  users: AppUserProfile[];
  teams: Team[];
  players: Player[];
  onAdminChangeUserRole: (
    targetUid: string,
    newRole: UserRole,
    delegatedTeamId?: string,
    linkedPlayerId?: string
  ) => void | Promise<void>;
  onRefreshUsers?: () => void | Promise<void>;
}

export function AdminUsersRolesSection({
  currentUser,
  users,
  teams,
  players,
  onAdminChangeUserRole,
  onRefreshUsers,
}: AdminUsersRolesSectionProps) {
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [roleDrafts, setRoleDrafts] = useState<
    Record<string, { role: UserRole; delegatedTeamId: string; linkedPlayerId: string }>
  >({});
  const [roleSavingUid, setRoleSavingUid] = useState<string | null>(null);
  const [roleStatusMsg, setRoleStatusMsg] = useState<string | null>(null);
  const [roleErrorMsg, setRoleErrorMsg] = useState<string | null>(null);

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [teams]
  );

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        ROLE_META[u.role].label.toLowerCase().includes(q)
      );
    });
  }, [users, userSearch, roleFilter]);

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#707ef9]/15 border border-[#707ef9]/30 flex items-center justify-center shrink-0">
            <UserCog className="w-5 h-5 text-[#a5b0ff]" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white">
              Usuarios y <span className="font-editorial font-normal text-[#c8ceff]">Roles</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
              Asigna roles de Administración General, Prensa, Fotografía, Jefaturas de Arbitraje
              unificadas y Árbitros Oficiales.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Buscar nombre o correo..."
              aria-label="Buscar usuarios"
              className="rounded-full bg-[#101016] border border-white/[0.1] pl-10 pr-4 py-2 text-xs text-white placeholder:text-zinc-500 w-60 focus:outline-none focus:border-[#707ef9]"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'ALL' | UserRole)}
            aria-label="Filtrar usuarios por rol"
            className="rounded-full bg-[#101016] border border-white/[0.1] px-4 py-2 text-xs text-zinc-200 focus:outline-none focus:border-[#707ef9]"
          >
            <option value="ALL">Todos los roles ({users.length})</option>
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
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-medium text-zinc-200 cursor-pointer transition-colors"
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
          const count = users.filter((u) => u.role === r).length;
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(roleFilter === r ? 'ALL' : r)}
              className={`text-left rounded-2xl border p-3.5 transition-colors cursor-pointer ${
                roleFilter === r
                  ? 'bg-[#707ef9]/15 border-[#707ef9]/45'
                  : 'bg-[#0c0c10] border-white/[0.08] hover:border-white/[0.18]'
              }`}
            >
              <p className="text-[11px] text-zinc-400 font-medium truncate">
                {ROLE_META[r].shortLabel}
              </p>
              <p className="font-display text-2xl font-semibold tabular-nums text-white mt-1">
                {count}
              </p>
            </button>
          );
        })}
      </div>

      {roleStatusMsg && (
        <div
          role="status"
          className="rounded-2xl bg-emerald-500/10 border border-emerald-400/25 p-4 text-xs text-emerald-200 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{roleStatusMsg}</span>
        </div>
      )}

      {roleErrorMsg && (
        <div
          role="alert"
          className="rounded-2xl bg-red-500/10 border border-red-400/25 p-4 text-xs text-red-200 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{roleErrorMsg}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-white/[0.03] border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="py-3.5 px-4 font-medium">Usuario</th>
              <th className="py-3.5 px-3 font-medium">Rol Actual</th>
              <th className="py-3.5 px-3 font-medium">Asignar Rol</th>
              <th className="py-3.5 px-3 font-medium">Vínculo</th>
              <th className="py-3.5 px-4 text-right font-medium">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {filteredUsers.map((u) => {
              const draft = getUserDraft(u);
              const isPrimaryAdmin = u.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;
              const lockedForMod = currentUser?.role === 'moderador' && u.role === 'admin';
              const isRowLocked = isPrimaryAdmin || lockedForMod;
              const assignableRoles =
                currentUser?.role === 'moderador'
                  ? ALL_USER_ROLES.filter((r) => r !== 'admin')
                  : ALL_USER_ROLES;
              const hasChanged =
                draft.role !== u.role ||
                (draft.role === 'delegado' &&
                  draft.delegatedTeamId !== (u.delegatedTeamId ?? '')) ||
                (draft.role === 'jugador' &&
                  draft.linkedPlayerId !== (u.linkedPlayerId ?? ''));

              return (
                <tr key={u.uid} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-4">
                    <p className="font-medium text-white">{u.displayName}</p>
                    <p className="text-xs text-zinc-500">
                      {u.email} · {u.authSource === 'google' ? 'Google' : 'UFRO'}
                    </p>
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/[0.08] text-zinc-100">
                      {ROLE_META[u.role].label}
                    </span>
                    {isPrimaryAdmin && (
                      <span className="block text-[10px] text-[#a5b0ff] mt-1">
                        Admin Principal Protegido
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3">
                    <select
                      aria-label={`Cambiar rol de ${u.displayName}`}
                      disabled={isRowLocked}
                      value={draft.role}
                      onChange={(e) =>
                        updateUserDraft(u, { role: e.target.value as UserRole })
                      }
                      className="rounded-xl bg-[#101016] border border-white/[0.1] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#707ef9] disabled:opacity-40"
                    >
                      {assignableRoles.map((r) => (
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
                        className="rounded-xl bg-[#101016] border border-white/[0.1] px-2.5 py-1.5 text-xs text-white max-w-[220px]"
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
                        className="rounded-xl bg-[#101016] border border-white/[0.1] px-2.5 py-1.5 text-xs text-white max-w-[220px]"
                      >
                        <option value="">Vincular por correo o elegir...</option>
                        {players.slice(0, 40).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} {p.apellidoPaterno}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-zinc-500">
                        Favoritos: {u.favoriteTeamIds.length}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      disabled={isRowLocked || !hasChanged || roleSavingUid === u.uid}
                      onClick={() => void handleSaveUserRole(u)}
                      className="px-4 py-1.5 rounded-full bg-[#707ef9] hover:bg-[#5c6bf0] text-white text-xs font-semibold cursor-pointer disabled:opacity-35 whitespace-nowrap transition-colors"
                    >
                      {roleSavingUid === u.uid ? 'Guardando...' : 'Guardar'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
