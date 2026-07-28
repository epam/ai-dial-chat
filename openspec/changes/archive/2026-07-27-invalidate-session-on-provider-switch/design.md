## Context

`UserContext` (`apps/chat/src/context/auth/UserContext.tsx`) bootstraps `GET /api/v1/auth/me` exactly once on mount and otherwise only resets on an explicit `401` (`onUnauthorized`) or a manual `reset()`/`refresh()` call — nothing else revalidates it. `DeploymentsContext` (`apps/chat/src/context/DeploymentsContext.tsx`) fetches deployments/toolsets once on mount via a `useEffect` whose only dependency is the stable `loadDeployments` callback, and never refetches on its own afterwards. `RequireAuth` unmounts/remounts the protected tree (which includes `DeploymentsProvider`) purely based on `UserContext.status` transitioning away from `Authenticated` — it has no way to react to "the identity changed but status stayed `Authenticated`".

If the browser's session cookie identity changes while a tab stays mounted and authenticated — e.g. the user logs out and back in as a different provider in one tab while a second tab stays open, or any other same-origin flow that swaps the session without that tab ever receiving a `401` — the mounted tab keeps `user`, `rawDeployments`, and `toolsets` from the previous identity. The Catalog then renders `isMy` flags computed server-side for the old user, and `useShareLink` can submit a stale `itemId` whose resource path belongs to the old user's bucket, which DIAL Core rejects with `400` once validated against the new session's bearer token (`apps/chat-api/src/share/share.service.ts:116-171`).

## Goals / Non-Goals

**Goals:**
- Detect, in an already-mounted authenticated tab, that the session's underlying identity (`sub`) has changed without relying on a `401`.
- Once detected, drive the same invalidation path an explicit logout/401 already produces today, so `RequireAuth` unmounts and remounts the protected tree (including `DeploymentsProvider`) against the new identity.
- Make `DeploymentsContext`'s fetch identity-aware so a remount (or an identity change surfaced without unmount) can never keep serving a snapshot fetched for a different `sub`.

**Non-Goals:**
- Changing the `/share` endpoint contract, DIAL Core's validation behavior, or the `400`→user-facing error mapping. The fix removes the stale `itemId` at its source; the endpoint itself is out of scope.
- Real-time, push-based cross-tab session sync (e.g. `BroadcastChannel`, `storage` events). This design uses a pull-based revalidation checkpoint (focus/visibility regain), not a live socket/channel.
- Changing the OIDC/BFF login or callback flow itself (`apps/chat-api` auth module) — the gap being closed is entirely client-side state staleness, not the auth handshake.

## Decisions

### 1. Revalidation checkpoint: `visibilitychange`/`focus`, not polling

`UserProvider` adds a listener that, when the tab regains visibility (`document.visibilitychange` → `document.visibilityState === 'visible'`) or the window regains focus, and only while `status === AuthStatus.Authenticated` (an unauthenticated or loading tab has nothing to revalidate, and this avoids fighting the existing redirect-to-login policy in `spa-auth-session`), calls `getMe()` directly through a dedicated `revalidate` function rather than the existing `bootstrap` callback. `bootstrap` unconditionally flips `status` to `Loading` at its start, which would transiently unmount the protected tree via `RequireAuth` on every background revalidation even when the identity turns out to be unchanged — `revalidate` reuses the same `getMe()` call and the same invalidation branch as `onUnauthorized`, but only transitions `status` when a mismatch or `401` is actually detected. This still piggybacks on the same `getMe()` call already used for bootstrap — no new endpoint, no new dependency.

**Alternative considered — interval polling**: rejected as needless request volume; identity only changes in response to a user action (login/logout), and focus/visibility regain reliably fires right after a user returns from completing such an action in another tab or after the OS-level app-switch that a provider-switch redirect implies.

**Alternative considered — `BroadcastChannel`/`storage` event cross-tab push**: more precise (would not depend on the user refocusing the stale tab) but adds a new cross-tab coordination primitive and a new failure mode (unsupported/blocked in some embedding contexts, e.g. the overlay/iframe mode this app also supports — see `OverlayContext`). Deferred as a future enhancement; not needed to close the reported bug, since the repro always involves returning to/refocusing the tab after the switch.

### 2. Identity comparison key: `UserProfile.sub`

The revalidation checkpoint compares the newly fetched profile's `sub` (the shared, stable subject identifier already defined on `UserProfile`) against the currently held `user.sub`, not `providerId` alone — a user could switch providers yet resolve to a linked identity with the same `sub` in some configurations, and that must not be treated as a change requiring invalidation. A mismatch (or transition to unauthenticated) is treated identically to the existing `onUnauthorized` handler: clear CSRF, set `user = null`, `status = Unauthenticated`, then let the normal bootstrap/redirect policy re-authenticate and remount from scratch. This reuses `RequireAuth`'s existing unmount/remount behavior instead of introducing a second, parallel invalidation mechanism.

**Alternative considered — silently swapping `user` in place without forcing `Unauthenticated`**: rejected because every downstream provider (`DeploymentsProvider`, `UserConfigProvider`, etc.) already assumes it only mounts once per authenticated identity; forcing the same unmount/remount `RequireAuth` already performs on logout is the smallest change that guarantees every identity-scoped provider re-initializes, rather than auditing and patching each one individually to react to an in-place `user` change.

### 3. `DeploymentsContext` keys its fetch to the resolved identity

Independent defense-in-depth: `DeploymentsProvider`'s load effect gains `user?.sub` (via `useUser()`) as an explicit dependency alongside `loadDeployments`, so that if a `DeploymentsProvider` instance is ever kept mounted across an identity change through any path other than the `RequireAuth` remount above (e.g. a future refactor, or overlay-mode embedding that mounts providers differently), it still refetches rather than serving a stale snapshot indefinitely. `rawDeployments`/`toolsets`/`schemas` are reset to empty and `isLoading` set to `true` for the duration, mirroring the existing mount-time behavior in `loadDeployments`.

**Alternative considered — relying solely on the `RequireAuth` remount**: sufficient for the reported repro, but leaves a latent trap for any future code path that keeps `DeploymentsProvider` mounted across identity changes (overlay mode already has different provider nesting — see `OverlayModeGate`). The extra dependency is a one-line, low-risk safeguard, so it's included rather than deferred.

### 4. Session invalidation clears identity-scoped `localStorage` preferences

`UserContext` currently has three separate places that invalidate the session (`reset()`, the `onUnauthorized` listener, and the new `revalidate` mismatch/`401` branch), each independently clearing CSRF and resetting `user`/`status`. This design extracts a single `invalidateSession()` helper inside `UserProvider` that all three call, and that helper additionally removes the two `localStorage` keys written by `useCatalogSortFilterPreference` that encode identity-relevant Catalog state — `StorageKey.CatalogFilterTopics` and `StorageKey.CatalogIsMyAppsActive` — via a small `removeFromLocalStorage` addition to `apps/chat/src/utils/local-storage.ts`. `StorageKey.CatalogSortKey` is a display preference with no ownership semantics and is deliberately left untouched.

**Alternative considered — clearing from `useCatalogSortFilterPreference` itself via a "logout" event/effect**: rejected because it would require the hook (or `CatalogView`) to know about auth/session lifecycle, inverting the dependency the wrong way — `UserContext` already owns "what happens on session invalidation," so it should own clearing session-scoped storage too, the same way it already owns clearing the CSRF token.

**Alternative considered — namespacing these localStorage keys per user (`catalogFilterTopics:<sub>`)**: would avoid ever needing to clear them (each identity gets its own slot) but leaves an unbounded, never-cleaned set of per-user keys accumulating in `localStorage` for any browser used by multiple identities, and doesn't fit the existing flat `StorageKey` enum pattern used by every other preference in this hook. Clearing on invalidation is simpler and matches how CSRF is already handled.

## Risks / Trade-offs

- **[Risk]** Adding a `bootstrap` call on every focus/visibility regain increases `GET /api/v1/auth/me` request volume for users who frequently alt-tab. → **Mitigation**: `getMe()` is a cheap, already-cached-at-the-BFF-session-layer read; debounce isn't required, but the handler skips re-invoking while a previous revalidation is still in flight (reuse the existing `signal.isCancelled` guard pattern).
- **[Risk]** A false-positive identity mismatch (e.g. a transient BFF read of a not-yet-refreshed token claim) could force an unnecessary remount/refetch mid-session. → **Mitigation**: only `sub` is compared (not volatile claims), and the same-tab in-flight request the user is actively using is unaffected since remount only replaces context state, not the current route.
- **[Risk]** Users mid-way through an unsaved action in a component that gets unmounted by the forced remount could lose that state. → **Mitigation**: this is the exact same unmount behavior that already happens on explicit logout or a `401`; no new class of data loss is introduced, and it only fires when the identity has genuinely changed underneath the tab, which is already a state the user does not expect to keep working in undisturbed.

## Migration Plan

No data migration. Purely client-side behavior change, ships as a normal frontend release. No rollback concerns beyond reverting the commit — no persisted schema or API contract changes.

## Open Questions

- None — the mechanism, comparison key, and invalidation path are settled by the decisions above; cross-tab push-based sync is explicitly deferred rather than left open.
