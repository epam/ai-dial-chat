## MODIFIED Requirements

### Requirement: 401 responses surface as a typed UnauthorizedError and reset the session

When the `request()` helper observes an HTTP `401` response, it SHALL throw an `UnauthorizedError` (subclass of `Error`, `status: 401`, exposes the originating URL) and SHALL invoke every listener registered through an `onUnauthorized(listener)` API exposed from the same module.

The `UserContext` provider MUST register a single listener that, before resetting `status`, first attempts a bounded self-heal probe: if `status` is currently `Authenticated`, it issues one `GET /api/v1/auth/me` using whatever session cookie the browser currently holds.

- If that probe succeeds, the listener SHALL adopt the returned profile (`setUser(profile)`), keep `status` as `Authenticated`, and SHALL NOT reset `status` to `Unauthenticated` — the original 401 is treated as resolved (e.g. a same-instant refresh-token race the backend or a concurrent request already resolved), and the protected tree is NOT unmounted.
- If the probe also fails (returns `401` or any other error), the listener SHALL reset `status` to `Unauthenticated` and clear `user`, allowing the redirect policy from the "Automatic redirect" requirement to take over, exactly as before this probe was introduced.
- If `status` is not currently `Authenticated` (e.g. still `Loading` or already `Unauthenticated`), the listener SHALL skip the probe and reset the session immediately, as before — there is no already-authenticated state to attempt to recover.

#### Scenario: 401 on a protected endpoint resets context when the session is genuinely invalid

- **WHEN** any non-bootstrap API call returns `401` while `status === Authenticated`, and the subsequent `GET /api/v1/auth/me` self-heal probe also returns `401`
- **THEN** the helper throws `UnauthorizedError`, the registered `UserContext` listener is invoked, the probe is attempted and fails, `status` becomes `Unauthenticated`, and `user` becomes `null`

#### Scenario: 401 on a protected endpoint recovers when the session is actually still valid

- **WHEN** any non-bootstrap API call returns `401` while `status === Authenticated`, and the subsequent `GET /api/v1/auth/me` self-heal probe returns `200` with a valid `UserProfile`
- **THEN** the listener adopts the returned profile, `status` remains `Authenticated`, `user` is updated to the probed profile, and the protected tree is NOT unmounted

#### Scenario: Non-401 errors are unchanged

- **WHEN** an API call returns any non-OK status other than `401` (e.g. `500`, `502`)
- **THEN** the helper throws a generic `Error` with a message containing the status and URL, and the `UnauthorizedError` listeners are NOT invoked

#### Scenario: Listener subscription is cleanable

- **WHEN** the cleanup function returned by `onUnauthorized(listener)` is invoked
- **THEN** that listener is no longer called on subsequent `401`s, and unrelated listeners remain registered

---

### Requirement: Session identity revalidation on tab focus/visibility regain

While `UserContext.status === Authenticated`, the SPA SHALL re-validate the session by issuing `GET /api/v1/auth/me` whenever the tab regains visibility (`document.visibilitychange` firing with `document.visibilityState === 'visible'`) or the window regains focus (`window` `focus` event), so that an identity change made in another tab or another same-origin flow is detected without waiting for a `401` on some other request. The revalidation SHALL be skipped while a previous bootstrap/revalidation request for this provider instance is still in flight, and SHALL NOT be performed while `status` is `Loading` or `Unauthenticated`.

The comparison SHALL use `UserProfile.sub` (the stable subject identifier), not `providerId` or any other claim. If the newly fetched profile's `sub` differs from the currently held `user.sub`, the SPA SHALL clear the CSRF token and adopt the new profile in place by calling `setUser(newProfile)`, leaving `status` as `Authenticated`. The protected tree SHALL NOT be unmounted for this case — the session is already validly authenticated as the new identity, so there is nothing to redirect to a login screen for. Every identity-scoped context (see `conversations-context`, `user-config-frontend-init`, and `deployments-context`) is responsible for detecting the changed `sub` on its own and resetting/refetching accordingly. If the newly fetched profile's `sub` is unchanged, the SPA SHALL update `user` in place (to pick up any other changed claims) without altering `status`.

If the revalidation request itself returns `401` (rather than a differing-`sub` profile), the SPA SHALL first attempt the same bounded self-heal probe described in "401 responses surface as a typed UnauthorizedError and reset the session" (a fresh `GET /api/v1/auth/me` retry) before deciding the session is genuinely revoked:

- If that retry succeeds, the SPA SHALL adopt the returned profile and keep `status` as `Authenticated`, exactly as the "unchanged identity" / "identity changed" scenarios above — the original `401` is treated as a transient race, not a revocation.
- If the retry also fails, the SPA SHALL treat that identically to the existing `onUnauthorized` invalidation path — clearing the CSRF token, setting `user` to `null`, and setting `status` to `Unauthenticated` — so `RequireAuth` unmounts the protected tree and the normal bootstrap/redirect policy re-authenticates from scratch.

#### Scenario: Tab regains focus with an unchanged identity

- **WHEN** an authenticated tab's window regains focus and `GET /api/v1/auth/me` returns `200` with a `UserProfile` whose `sub` matches the currently held `user.sub`
- **THEN** `user` is updated in place with the fresh profile, `status` remains `Authenticated`, and the protected tree is NOT unmounted

#### Scenario: Tab regains focus after the underlying session identity changed

- **WHEN** an authenticated tab's window regains focus and `GET /api/v1/auth/me` returns `200` with a `UserProfile` whose `sub` differs from the currently held `user.sub`
- **THEN** the CSRF token is cleared, `user` is set to the newly-fetched profile, `status` remains `Authenticated`, and the protected tree (including `DeploymentsProvider`, `ConversationsProvider`, `UserConfigProvider`) is NOT unmounted

#### Scenario: Tab regains visibility after a same-instant refresh race, not a real revocation

- **WHEN** an authenticated tab's `document.visibilityState` becomes `'visible'`, the revalidation `GET /api/v1/auth/me` returns `401`, and an immediate retry of `GET /api/v1/auth/me` returns `200` with a valid `UserProfile`
- **THEN** `user` is set to the profile returned by the retry, `status` remains `Authenticated`, and the protected tree is NOT unmounted

#### Scenario: Tab regains visibility after the session was genuinely revoked

- **WHEN** an authenticated tab's `document.visibilityState` becomes `'visible'`, the revalidation `GET /api/v1/auth/me` returns `401`, and the retry of `GET /api/v1/auth/me` also returns `401`
- **THEN** the same invalidation as a genuinely-failed `401` (`onUnauthorized`) is applied: CSRF cleared, `user` becomes `null`, `status` becomes `Unauthenticated`

#### Scenario: Revalidation is skipped while unauthenticated or loading

- **WHEN** `focus` or `visibilitychange` fires while `UserContext.status` is `Loading` or `Unauthenticated`
- **THEN** no additional `GET /api/v1/auth/me` request is issued by this mechanism

#### Scenario: Concurrent revalidation requests are not stacked

- **WHEN** `focus` and `visibilitychange` both fire in quick succession while a revalidation request triggered by the first event is still in flight
- **THEN** only one `GET /api/v1/auth/me` request is issued; the second event is a no-op
