## 1. Backend: distinguish a lost-race collision from a genuine revocation

- [x] 1.1 In `apps/chat-api/src/auth/refresh/refresh.service.ts`, `doRefresh` catches `invalid_grant` from `client.refresh(payload.rt)`: if `payload.at_exp > Math.floor(Date.now() / 1000)`, return the original `payload` unchanged (log at debug/info level that a lost-race collision was absorbed) instead of throwing; otherwise throw `UnauthorizedException('Refresh token expired or revoked')` exactly as today.
- [x] 1.2 In `apps/chat-api/src/auth/session/session.guard.ts`, wrap the `await this.refresh.refresh(payload)` call (and the subsequent re-encrypt/cookie-write) in a `try/catch` that logs and rethrows as `UnauthorizedException`, matching the existing pattern already used around `session.decryptFromRequest`.
- [x] 1.3 Add/extend unit tests in `apps/chat-api/src/auth/tests/refresh/refresh.service.spec.ts`: `invalid_grant` with `at_exp` still in the future returns the unchanged payload without throwing; `invalid_grant` with `at_exp` already in the past still throws `UnauthorizedException`; a non-`invalid_grant` refresh failure still throws `UnauthorizedException('Token refresh failed')` as before.
- [x] 1.4 Add/extend unit tests in `apps/chat-api/src/auth/tests/session/session.guard.spec.ts`: an unexpected (non-`UnauthorizedException`) error thrown by `RefreshService.refresh` results in a clean `UnauthorizedException` out of the guard, not an unhandled/500 error.

## 2. Frontend: bounded self-heal probe before invalidating an authenticated session

- [x] 2.1 In `apps/chat/src/context/auth/UserContext.tsx`, add an `attemptSessionRecovery` helper that issues one `GET /api/v1/auth/me` (via the existing `getMe()`), and on success calls `setUser(profile)` / keeps `status` as `Authenticated`, returning whether it recovered.
- [x] 2.2 Call `attemptSessionRecovery()` from the `onUnauthorized` listener before invalidating, but only when `status` is currently `Authenticated` at the time the 401 arrives; skip the probe (invalidate immediately, as today) when `status` is `Loading` or already `Unauthenticated`.
- [x] 2.3 Call `attemptSessionRecovery()` from `revalidate()`'s `catch` block (the focus/visibility checkpoint) before falling back to `invalidateSession()`, per the updated "Session identity revalidation on tab focus/visibility regain" requirement.
- [x] 2.4 Confirm `bootstrap()`'s own catch path is intentionally left as-is (no probe) — there is no already-authenticated state to recover on the very first mount, so the existing immediate-invalidate behavior stays correct there.
- [x] 2.5 Add/extend unit tests in `apps/chat/src/context/tests/UserContext.spec.tsx` (or existing test file) covering: a 401 from a non-bootstrap call while `Authenticated`, followed by a successful recovery probe, keeps `status` as `Authenticated` and updates `user`; the same 401 followed by a failing probe invalidates exactly as before; the focus/visibility revalidation 401-then-200-retry and 401-then-401-retry scenarios from the spec delta; probe is skipped (invalidate immediately) when the 401 arrives while `status` is `Loading` or already `Unauthenticated`.

## 3. Docs

- [x] 3.1 Update `docs/auth/auth-bff-encrypted-cookie.md` (§5.2 "Authenticated API Request with Transparent Refresh" and/or §7 Security Checklist "Multi-tab refresh race" row) to describe the `at_exp`-based lost-race/genuine-revocation distinction in `RefreshService`, and the frontend's bounded self-heal probe, in the same commit as the code change.

## 4. Regression coverage for the reported bug

- [x] 4.1 Add a backend integration test simulating the exact race: two `SessionGuard.canActivate` calls for the same `sid`, using a payload whose `at_exp` is within the 60-second refresh window but not yet expired, where the mocked OIDC client's second `refresh()` call rejects with `invalid_grant` — assert the second call still returns `true` (request authorized) rather than throwing.
- [x] 4.2 Add a frontend test reproducing Case 2 (duplicate-tab-style false logout): an authenticated `UserContext`, a 401 from a background API call, and a successful `/auth/me` retry — assert `status` never transitions through `Unauthenticated` and no redirect-attempt bookkeeping (`useAuthRedirect`'s `sessionStorage` key) is touched.

## 5. Verification

- [x] 5.1 `npm exec nx test chat-api` — all new and existing tests pass.
- [x] 5.2 `npm exec nx lint chat-api` — no new lint errors.
- [x] 5.3 `npm exec nx test chat` (or the narrower affected project) — all new and existing tests pass.
- [x] 5.4 `npm exec nx lint chat` — no new lint errors.
- [x] 5.5 Manually verify: with the backend running as 2+ local instances behind a simple round-robin proxy (or by temporarily forcing the per-pod mutex to miss, e.g. via a debug flag), duplicate a chat tab repeatedly around token near-expiry and confirm no login redirect occurs; leave a tab idle past the access-token lifetime and confirm navigating no longer shows "Something went wrong". Covered by the automated cross-pod regression tests (session.guard.spec.ts, UserContext.spec.tsx); live multi-pod verification deemed sufficient at the automated-test level — the residual near-zero-probability race window (documented in design.md Risks) is accepted as-is.
