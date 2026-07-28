## Why

Issue #7843 ("Catalog — stale session state after switching login providers") is still open and still reproduces after the earlier fix (PR #8033, `feat: implement session invalidation on identity change`) merged. That fix targeted the wrong layer: it cleared two Catalog filter preferences (`CatalogFilterTopics`, `CatalogIsMyAppsActive`) from `localStorage` on session invalidation, but the actual bug is that `DeploymentsContext`'s in-memory deployments/toolsets snapshot (and, more broadly, `ConversationsContext`'s and `UserConfigContext`'s in-memory state) can keep serving data fetched for the *previous* identity — a `localStorage` filter preference was never the source of the stale `isMy` flags or the stale `itemId` that DIAL Core rejects with `400` on Share.

Separately, the focus/visibility revalidation checkpoint `UserContext` added to detect a same-tab identity switch has its own bug: when it detects that the session's identity changed, it discards the freshly-fetched profile and forces `status` to `Unauthenticated`, sending an already-validly-authenticated user back through a login screen instead of continuing seamlessly as the new identity.

## What Changes

- `UserContext.invalidateSession()` no longer clears `StorageKey.CatalogFilterTopics` / `StorageKey.CatalogIsMyAppsActive` from `localStorage`. Filter preferences are UI-only; once the underlying data is correctly re-scoped per identity, a leftover filter selection has no correctness or data-leak impact. `removeFromLocalStorage` (added solely for this purpose) is removed along with its now-unused import.
- When the focus/visibility revalidation checkpoint detects that the session identity changed (`sub` mismatch), `UserContext` SHALL adopt the newly-fetched profile in place (`setUser(newProfile)`) instead of invalidating to `Unauthenticated`. The session is already validly authenticated as the new identity — there is nothing to log the user out of. A `401` returned by the revalidation call is unchanged and still invalidates the session.
- Because in-place adoption no longer unmounts/remounts the protected tree (the mechanism `ConversationsContext`, `UserConfigContext`, and `DeploymentsContext` currently rely on to reset), those contexts must reset and refetch their own state whenever the authenticated identity changes while they stay mounted:
  - `ConversationsContext` gains an identity-keyed load effect (new capability — it had no prior requirement governing this).
  - `UserConfigContext` gains the same, replacing its current "fetch exactly once per mount" contract.
  - `DeploymentsContext` already has an identity-keyed load effect (from #8033), but its `loadDeployments` never actually clears `rawDeployments` before refetching (only `schemas`/`toolsets` are cleared) — this is a pre-existing gap against the already-documented `deployments-context` spec, fixed as part of this change (implementation-only, no requirement text changes).
- Explicit logout (`LogoutConfirmationModal` → `reset()` → `invalidateSession()`) is unchanged: it still flips `status` to `Unauthenticated`, which still unmounts/remounts the whole protected tree. The identity-keyed effects added above are an additional, independent guarantee — not a replacement — so the reset+refetch behavior holds regardless of which path (explicit logout, a `401`, or an in-place identity swap) triggered it.

## Capabilities

### New Capabilities

- `conversations-context`: `ConversationsContext`'s data-loading contract, starting with the requirement that it resets its conversation list and refetches when the authenticated identity changes while mounted.

### Modified Capabilities

- `spa-auth-session`: identity-mismatch revalidation now adopts the new identity in place instead of forcing `Unauthenticated`; the requirement that invalidation clears identity-scoped Catalog `localStorage` preferences is removed.
- `user-config-frontend-init`: `UserConfigContext` now refetches (not just "loads once per mount") when the authenticated identity changes while mounted.

## Impact

- `apps/chat/src/context/auth/UserContext.tsx` — drop the two `removeFromLocalStorage` calls (and the now-dead import); change the `revalidate()` mismatch branch to adopt the new profile in place instead of calling `invalidateSession()`.
- `apps/chat/src/utils/local-storage.ts` — remove `removeFromLocalStorage`, its only call site is being deleted.
- `apps/chat/src/context/ConversationsContext.tsx` — add an identity-keyed (`useUser().user?.sub`) load effect that clears `conversations`/`error` and re-fetches.
- `apps/chat/src/context/UserConfigContext.tsx` — add the same identity-keyed dependency to its existing load effect.
- `apps/chat/src/context/DeploymentsContext.tsx` — `loadDeployments` also clears `rawDeployments` at the start of every run.
- Tests: `apps/chat/src/context/auth/UserContext.spec.tsx`, `apps/chat/src/context/tests/ConversationsContext.spec.tsx`, `apps/chat/src/context/tests/UserConfigContext.spec.tsx`, `apps/chat/src/context/tests/DeploymentsContext.spec.tsx`.
- No backend/API contract changes. No new capabilities beyond the client-side context reset behavior described above.
