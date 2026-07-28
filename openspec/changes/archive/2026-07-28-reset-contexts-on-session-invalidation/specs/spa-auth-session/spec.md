## MODIFIED Requirements

### Requirement: Session identity revalidation on tab focus/visibility regain

While `UserContext.status === Authenticated`, the SPA SHALL re-validate the session by issuing `GET /api/v1/auth/me` whenever the tab regains visibility (`document.visibilitychange` firing with `document.visibilityState === 'visible'`) or the window regains focus (`window` `focus` event), so that an identity change made in another tab or another same-origin flow is detected without waiting for a `401` on some other request. The revalidation SHALL be skipped while a previous bootstrap/revalidation request for this provider instance is still in flight, and SHALL NOT be performed while `status` is `Loading` or `Unauthenticated`.

The comparison SHALL use `UserProfile.sub` (the stable subject identifier), not `providerId` or any other claim. If the newly fetched profile's `sub` differs from the currently held `user.sub`, the SPA SHALL clear the CSRF token and adopt the new profile in place by calling `setUser(newProfile)`, leaving `status` as `Authenticated`. The protected tree SHALL NOT be unmounted for this case — the session is already validly authenticated as the new identity, so there is nothing to redirect to a login screen for. Every identity-scoped context (see `conversations-context`, `user-config-frontend-init`, and `deployments-context`) is responsible for detecting the changed `sub` on its own and resetting/refetching accordingly. If the revalidation request itself returns `401` (the session was revoked, not merely switched), the SPA SHALL treat that identically to the existing `onUnauthorized` invalidation path — clearing the CSRF token, setting `user` to `null`, and setting `status` to `Unauthenticated` — so `RequireAuth` unmounts the protected tree and the normal bootstrap/redirect policy re-authenticates from scratch. If the newly fetched profile's `sub` is unchanged, the SPA SHALL update `user` in place (to pick up any other changed claims) without altering `status`.

#### Scenario: Tab regains focus with an unchanged identity

- **WHEN** an authenticated tab's window regains focus and `GET /api/v1/auth/me` returns `200` with a `UserProfile` whose `sub` matches the currently held `user.sub`
- **THEN** `user` is updated in place with the fresh profile, `status` remains `Authenticated`, and the protected tree is NOT unmounted

#### Scenario: Tab regains focus after the underlying session identity changed

- **WHEN** an authenticated tab's window regains focus and `GET /api/v1/auth/me` returns `200` with a `UserProfile` whose `sub` differs from the currently held `user.sub`
- **THEN** the CSRF token is cleared, `user` is set to the newly-fetched profile, `status` remains `Authenticated`, and the protected tree (including `DeploymentsProvider`, `ConversationsProvider`, `UserConfigProvider`) is NOT unmounted

#### Scenario: Tab regains visibility after the session was revoked

- **WHEN** an authenticated tab's `document.visibilityState` becomes `'visible'` and the revalidation `GET /api/v1/auth/me` returns `401`
- **THEN** the same invalidation as an in-flight `401` (`onUnauthorized`) is applied: CSRF cleared, `user` becomes `null`, `status` becomes `Unauthenticated`

#### Scenario: Revalidation is skipped while unauthenticated or loading

- **WHEN** `focus` or `visibilitychange` fires while `UserContext.status` is `Loading` or `Unauthenticated`
- **THEN** no additional `GET /api/v1/auth/me` request is issued by this mechanism

#### Scenario: Concurrent revalidation requests are not stacked

- **WHEN** `focus` and `visibilitychange` both fire in quick succession while a revalidation request triggered by the first event is still in flight
- **THEN** only one `GET /api/v1/auth/me` request is in flight at a time for this mechanism; the second trigger does not issue a duplicate request

## REMOVED Requirements

### Requirement: Session invalidation clears identity-scoped Catalog preferences from localStorage

**Reason**: This requirement targeted the wrong layer. The Catalog "My Apps"/topic filter preferences it cleared are plain UI selections with no ownership semantics of their own — the actual stale-data bug (issue #7843) lives in `DeploymentsContext`'s (and `ConversationsContext`'s/`UserConfigContext`'s) in-memory, identity-scoped data, not in these `localStorage` preference keys. Clearing them neither fixed the reported bug nor is needed once the data layer correctly resets per identity (see the new `conversations-context` capability and the modified `user-config-frontend-init` requirement): a filter preference that survives an identity switch just filters the new identity's own fresh, correctly-scoped data.

**Migration**: `UserContext.invalidateSession()` no longer calls `removeFromLocalStorage` for `StorageKey.CatalogFilterTopics` / `StorageKey.CatalogIsMyAppsActive`. `removeFromLocalStorage` is removed from `apps/chat/src/utils/local-storage.ts` (no other call site exists). No user-facing migration is required — existing `localStorage` values, if present, are simply left in place and continue to work as ordinary display preferences.
