## ADDED Requirements

### Requirement: Session identity revalidation on tab focus/visibility regain

While `UserContext.status === Authenticated`, the SPA SHALL re-validate the session by issuing `GET /api/v1/auth/me` whenever the tab regains visibility (`document.visibilitychange` firing with `document.visibilityState === 'visible'`) or the window regains focus (`window` `focus` event), so that an identity change made in another tab or another same-origin flow is detected without waiting for a `401` on some other request. The revalidation SHALL be skipped while a previous bootstrap/revalidation request for this provider instance is still in flight, and SHALL NOT be performed while `status` is `Loading` or `Unauthenticated`.

The comparison SHALL use `UserProfile.sub` (the stable subject identifier), not `providerId` or any other claim: if the newly fetched profile's `sub` differs from the currently held `user.sub`, or the revalidation request now returns `401`, the SPA SHALL treat this identically to the existing `onUnauthorized` invalidation path — clearing the CSRF token, setting `user` to `null`, and setting `status` to `Unauthenticated` — so `RequireAuth` unmounts the protected tree and the normal bootstrap/redirect policy re-authenticates and remounts it fresh. If the newly fetched profile's `sub` is unchanged, the SPA SHALL update `user` in place (to pick up any other changed claims) without altering `status`.

#### Scenario: Tab regains focus with an unchanged identity

- **WHEN** an authenticated tab's window regains focus and `GET /api/v1/auth/me` returns `200` with a `UserProfile` whose `sub` matches the currently held `user.sub`
- **THEN** `user` is updated in place with the fresh profile, `status` remains `Authenticated`, and the protected tree is NOT unmounted

#### Scenario: Tab regains focus after the underlying session identity changed

- **WHEN** an authenticated tab's window regains focus and `GET /api/v1/auth/me` returns `200` with a `UserProfile` whose `sub` differs from the currently held `user.sub`
- **THEN** the CSRF token is cleared, `user` becomes `null`, `status` becomes `Unauthenticated`, `RequireAuth` unmounts the protected tree (including `DeploymentsProvider`), and the existing bootstrap/redirect policy re-authenticates against the new identity

#### Scenario: Tab regains visibility after the session was revoked

- **WHEN** an authenticated tab's `document.visibilityState` becomes `'visible'` and the revalidation `GET /api/v1/auth/me` returns `401`
- **THEN** the same invalidation as an in-flight `401` (`onUnauthorized`) is applied: CSRF cleared, `user` becomes `null`, `status` becomes `Unauthenticated`

#### Scenario: Revalidation is skipped while unauthenticated or loading

- **WHEN** `focus` or `visibilitychange` fires while `UserContext.status` is `Loading` or `Unauthenticated`
- **THEN** no additional `GET /api/v1/auth/me` request is issued by this mechanism

#### Scenario: Concurrent revalidation requests are not stacked

- **WHEN** `focus` and `visibilitychange` both fire in quick succession while a revalidation request triggered by the first event is still in flight
- **THEN** only one `GET /api/v1/auth/me` request is in flight at a time for this mechanism; the second trigger does not issue a duplicate request

### Requirement: Session invalidation clears identity-scoped Catalog preferences from localStorage

Whenever `UserContext` invalidates the session — via `reset()`, the `onUnauthorized` listener, or the identity-revalidation mismatch/`401` branch above — it SHALL also remove the `localStorage` entries keyed `StorageKey.CatalogFilterTopics` and `StorageKey.CatalogIsMyAppsActive` (written by `useCatalogSortFilterPreference`), so a Catalog "From" topic filter or "My Apps" toggle selected by one identity does not carry over to the next identity that authenticates in the same browser. `StorageKey.CatalogSortKey` SHALL NOT be removed by this invalidation — it is a display preference with no ownership semantics.

#### Scenario: Explicit logout clears the persisted Catalog filter preferences

- **WHEN** the user confirms logout via `LogoutConfirmationModal`, which calls `useUser().reset()`
- **THEN** `localStorage.getItem('catalogFilterTopics')` and `localStorage.getItem('catalogIsMyAppsActive')` both return `null` afterward, while `localStorage.getItem('catalogSortKey')` is unchanged

#### Scenario: An identity mismatch detected on revalidation clears the persisted Catalog filter preferences

- **WHEN** the focus/visibility revalidation checkpoint detects a `sub` mismatch (per the identity revalidation requirement above) and invalidates the session
- **THEN** `catalogFilterTopics` and `catalogIsMyAppsActive` are removed from `localStorage` as part of that same invalidation

#### Scenario: A 401 from any API call clears the persisted Catalog filter preferences

- **WHEN** `onUnauthorized` fires from any non-bootstrap API call returning `401`
- **THEN** `catalogFilterTopics` and `catalogIsMyAppsActive` are removed from `localStorage` in addition to the existing CSRF/user/status reset
