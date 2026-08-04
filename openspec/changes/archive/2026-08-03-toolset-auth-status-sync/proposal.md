## Why

GitHub issue #8096 reports that after logging out of an auth-configured toolset from the
Toolset Editor's Auth section, the Catalog's toolset card badge keeps showing the stale
logged-in credential status until an unrelated refresh happens. The root cause is concrete:
`ToolsetEditor.tsx`'s `handleAuthChange` only calls `refetchToolsets()` when
`patch.isLoggedIn === true` (the comment above it explicitly says this keeps the catalog in
sync after a *login*), so a logout's `onAuthChange({ isLoggedIn: false })` patch is silently
excluded from refreshing the shared toolset list that feeds the Catalog badge.

The same issue also reports that reopening the Editor for a previously-authenticated toolset
always prompts to log in again. Unlike the badge bug, this one does not have a single
identifiable defect on inspection: the server-side single-toolset cache is invalidated on both
`loginToolset` and `logoutToolset` (`toolsets.service.ts` `invalidateCaches`, including the
separate deployment-details cache), the DTO mapping from Core's `user_level_auth_status` through
to the client's `isSignedIn` check is consistent end-to-end, and `AuthSection`'s render logic
already shows the logged-in state whenever `auth.isLoggedIn` is `true`. This change proposes the
one confirmed fix (badge refresh on logout) and treats the second symptom as needing live
reproduction before any code change, since no static defect explains it yet.

## What Changes

- Refresh the shared toolset list on **both** login and logout from the Toolset Editor's Auth
  section, not only on login, so the Catalog badge reflects a logout without requiring an
  unrelated navigation or refresh to happen first.
- Reproduce issue #8096's "Edit screen always re-prompts login" symptom against the current
  codebase before writing any fix for it. If reproduction confirms a real defect, this change's
  scope covers investigating and fixing it; if the badge-refresh fix above already resolves the
  perceived symptom (a stale badge can look like "not logged in" even when the stored credential
  is still valid), or if reproduction points to a DIAL Core-side status propagation gap outside
  this app's control, this change documents that finding instead of guessing at a client-side
  fix for a defect that isn't there.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `toolset-authentication`: the "Logged-in state and logout" requirement gains a refetch-the-
  shared-toolset-list scenario for logout, mirroring the existing login-refresh behavior.

## Impact

- `apps/chat/src/pages/ToolsetEditor/ToolsetEditor.tsx` — `handleAuthChange`'s
  `if (patch.isLoggedIn === true)` guard.
- `apps/chat/src/pages/ToolsetEditor/tests/ToolsetEditor.spec.tsx` — add logout-refresh
  coverage.
- No confirmed backend or DTO changes; if reproduction of the second symptom reveals one, this
  proposal's scope will be revisited before implementation continues on it.
