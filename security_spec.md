# Security Specification — Campeonato Intercarreras UFRO (Production Launch)

## 1. Data Invariants
1. **Strict Zero-Trust Default**: Unmatched collections deny all read/write access.
2. **Exclusive Admin Role Delegation**: Only `a.sotomillapan@gmail.com` (verified email) or an existing admin in `/admins/{uid}` / `/users/{uid}` (`role == 'admin'`) can promote/demote any user role — including designating or revoking other administrators (with self-demotion/self-deletion blocked).
3. **Self-Registration Lock**: New users creating `/users/{uid}` may ONLY create with `role == 'tradicional'` (except bootstrapped admin `a.sotomillapan@gmail.com` with `email_verified == true`), and cannot set `delegatedTeamId` or `linkedPlayerId`.
4. **Student PII Isolation**: Sensitive student fields (`rut`, `numeroMatricula`, `correoInstitucional`, `fechaNacimiento`) are stored exclusively in `/player_private/{playerId}`, NEVER in public `/players/{playerId}` or `/transfers/{transferId}`. Read/write on `/player_private/{playerId}` is restricted strictly to `Admin`, the team's assigned `Delegado`, or the linked `Jugador` owner.
5. **Terminal State Locking on Matches**: Once a match reaches `status == 'FINALIZADO'`, referees (`arbitro`) can NO LONGER modify the match; only an `Admin` may correct a finalized result.
6. **Delegado Scope & Mutual Transfer Approval**: A `delegado` may register a new team ONLY when `/configs/{disciplineId}.inscripcionesAbiertas == true`, and may edit players ONLY for their assigned `delegatedTeamId`. **ONLY** verified `delegado` accounts may create `/transfers/{transferId}` requests (never `tradicional`, `jugador`, `arbitro`, `fotografo`, `prensa`, or non-involved delegates), strictly with `estado == 'PENDIENTE'`, `/configs/{disciplineId}.transferenciasAbiertas == true`, and ONLY the initiating delegate's approval flag set (`fromTeamApproved == true && toTeamApproved == false` OR vice versa). Finalizing a transfer (`PENDIENTE -> APROBADA`) requires the **counterpart** team's delegate to accept it atomically alongside updating `/players/{playerId}.teamId == toTeamId` (`getAfter`). Either involved delegate may reject/cancel while `PENDIENTE` (`PENDIENTE -> RECHAZADA`). Once `APROBADA` or `RECHAZADA`, delegates cannot mutate the transfer (Terminal State Lock).
7. **Jugador Self-Edit Guard**: A `jugador` may edit ONLY their linked `/players/{playerId}` and `/player_private/{playerId}`, and CANNOT alter `teamId`, `disciplineId`, `esSeleccionadoUfro`, or `stats`.
8. **Referee Stats & Scoreboard Guard**: An `arbitro` may update non-finalized `/matches/{matchId}` (score/periods/events/status/validation) and ONLY `stats` + `updatedAt` on `/players/{playerId}`.
9. **Photographer Scope**: Only `fotografo` or `admin` can create, update, or delete `/photos/{photoId}` records.
10. **Press / Newsroom Scope**: Only `prensa` or `admin` can create, update, publish, delete, or read unpublished drafts in `/news/{newsId}`. Public visitors may only read `/news` documents where `published == true`.
11. **User Profile Personal Data Isolation & Self-Edit**: Authenticated owners may update their own `/users/{uid}` personal fields (`displayName`, `fechaNacimiento`, `carrera`, `facultad`, `telefono`, `photoURL`, `favoriteTeamIds`, `notificationsEnabled`) without being able to escalate `role`, `linkedPlayerId`, or `delegatedTeamId`. PII in `/users/{uid}` remains readable strictly by `isOwner(userId)` or `isAdmin()`.
12. **Playoff Phase Integrity**: `/matches/{matchId}.fase` is restricted strictly to `['Grupos', 'Octavos', 'Cuartos', 'Semifinal', 'Tercer Lugar', 'Final']`.
13. **Public Transfer Announcements vs Private Pending Requests**: Only effected transfers (`estado == 'APROBADA'`) are publicly readable in `/transfers/{transferId}` for the Homepage and Public Transfers Directory. `PENDIENTE` and `RECHAZADA` transfer records are readable strictly by the involved teams' delegates (`isDelegadoOf(fromTeamId) || isDelegadoOf(toTeamId)`) or `isAdmin()`.
14. **Strict Timestamps & Schema Validation**: Every write validates `isValidId()` on single-doc targets, `isValid[Entity](incoming())`, `hasAll`/`hasOnly` keys, string `.size()` limits, bounded arrays, and `request.time` for `createdAt`/`updatedAt`.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Self-Admin Escalation on Create**: `POST /users/{uid}` with `role: 'admin'` by non-bootstrapped user -> DENIED.
2. **Role Escalation on Update**: `PATCH /users/{uid}` changing `role` from `'tradicional'` to `'prensa'`, `'fotografo'` or `'admin'` by owner -> DENIED.
3. **Email Spoofing Without Verification**: Auth token with `email == 'a.sotomillapan@gmail.com'` and `email_verified == false` -> DENIED.
4. **Shadow Field Injection on Team**: `POST /teams/{id}` with ghost field `isOfficial: true` -> DENIED (`hasOnly` check).
5. **Public Student PII Scraping**: Unauthenticated or `tradicional` user calling `GET /player_private/PL-001` -> DENIED.
6. **Jugador Stat Tampering**: Linked `jugador` updating `stats.goles` or `esSeleccionadoUfro: true` on `/players/{playerId}` -> DENIED (`affectedKeys().hasOnly(...)`).
7. **Cross-Team Delegado Hijack**: `delegado` of `TEAM-A` updating a player belonging to `TEAM-B` -> DENIED.
8. **Referee Post-Finalization Tampering**: `arbitro` updating `homeScore` on a match whose existing `status == 'FINALIZADO'` -> DENIED (Terminal State Lock).
9. **Registration While Closed**: `delegado` creating `/teams/T-NEW` when `/configs/{disciplineId}.inscripcionesAbiertas == false` -> DENIED.
10. **Transfer Bypass / Self-Approval**:
    - Non-delegate (`tradicional`, `jugador`, `arbitro`, `prensa`) creating `/transfers/TR-1` -> DENIED.
    - `delegado` creating `/transfers/TR-1` directly with `estado: 'APROBADA'` or both `fromTeamApproved: true && toTeamApproved: true` -> DENIED.
    - Initiating `delegado` of `fromTeam` attempting to approve the `toTeam` side (`toTeamApproved: true`) -> DENIED.
    - Delegate mutating an already `APROBADA` or `RECHAZADA` transfer -> DENIED (Terminal State Lock).
    - Public visitor reading a `PENDIENTE` or `RECHAZADA` transfer document -> DENIED.
11. **Unauthorized News Publishing / Draft Leak**: `tradicional`, `jugador`, `delegado`, or `arbitro` creating/updating `/news/{id}` or reading `/news/{draftId}` (`published == false`) -> DENIED.
12. **Resource Poisoning / Oversized ID**: Creating `/photos/{200-char-id}` or `/news/{id}` with `content` > 12000 chars -> DENIED (`isValidId` + `.size()`).
