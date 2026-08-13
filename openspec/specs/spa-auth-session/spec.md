# Spec: spa-auth-session

## Purpose

SPA session bootstrap, cookie-backed API requests, 401 handling, and the routing gates around a resolved session.

## Requirements

### Requirement: SPA session bootstrap on application mount

The SPA SHALL load the current user session from the BFF on initial mount by issuing a single `GET /api/v1/auth/me` request, store the resulting `UserProfile` in a React Context, and expose it through a `useUser()` consumer hook. The hook MUST throw a clear error when used outside the corresponding provider.

#### Scenario: Authenticated user

- **WHEN** the SPA mounts and `GET /api/v1/auth/me` returns `200` with a `UserProfile` body
- **THEN** the `UserContext` status becomes `authenticated`, the `user` value equals the response body, and any descendant consumer of `useUser()` receives that profile on the next render

#### Scenario: Unauthenticated user

- **WHEN** the SPA mounts and `GET /api/v1/auth/me` returns `401`
- **THEN** the `UserContext` status becomes `unauthenticated`, the `user` value is `null`, and no further `/auth/me` call is issued until `refresh()` is called explicitly or the provider remounts

#### Scenario: Bootstrap network or server failure

- **WHEN** the SPA mounts and `GET /api/v1/auth/me` rejects with a non-`401` error (network failure, `5xx`, malformed JSON)
- **THEN** the `UserContext` status remains `loading` no longer than the in-flight request, transitions to `unauthenticated`, and an error is logged via `console.error`

#### Scenario: Consumer used outside provider

- **WHEN** any component calls `useUser()` without an ancestor `<UserProvider>`
- **THEN** the hook MUST throw an `Error` whose message names the missing provider, matching the pattern used by `useTheme`

---

### Requirement: Automatic redirect to the BFF login flow when unauthenticated

The SPA SHALL automatically initiate the BFF login flow when the user is unauthenticated, **unless the caller explicitly disables this behavior**. `useAuthRedirect` SHALL accept an optional `options: { disabled?: boolean }` argument. When `options.disabled` is `true`, the hook's effect MUST return before performing any of the following: fetching `GET /api/v1/auth/providers`, reading or writing the session-storage redirect-attempt guard, calling `navigate(...)`, or calling `window.location.assign(...)`. Omitting `options` or passing `{ disabled: false }` (or `{}`) MUST preserve the exact behavior below, unchanged.

Before redirecting (when not disabled), it MUST compute an application `callbackUrl` from the current browser URL (`window.location.href`, including pathname, search, and hash) so the BFF can return the user to the same application origin/page after authentication. The redirect policy MUST depend on the number of registered providers reported by `GET /api/v1/auth/providers`:

- Exactly one provider → top-level browser navigation to `/api/v1/auth/login/<providerId>?callbackUrl=<encoded-current-url>` via `window.location.assign`.
- More than one provider → client-side navigation to `/login?callbackUrl=<encoded-current-url>` via React Router `navigate(..., { replace: true })`, where the user picks a provider.

The redirect MUST NOT fire while the bootstrap status is `loading`, MUST NOT perform a provider-list redirect on the `/login` route itself, and MUST NOT loop when the BFF immediately re-issues a `401`. After one automatic single-provider attempt for a given callback URL in the current tab, a subsequent unauthenticated bootstrap MUST fall back to `/login?callbackUrl=...` instead of starting another automatic provider redirect. The SPA MUST only generate same-origin callback URLs; the BFF remains authoritative for final validation.

#### Scenario: Single provider auto-redirect

- **WHEN** the bootstrap finishes with `status = 'unauthenticated'` and `GET /api/v1/auth/providers` returns one entry, and the hook was not called with `disabled: true`
- **THEN** the SPA performs `window.location.assign('/api/v1/auth/login/<id>?callbackUrl=<encoded-current-url>')` exactly once during that session

#### Scenario: Multi-provider navigation to picker

- **WHEN** the bootstrap finishes with `status = 'unauthenticated'` and `GET /api/v1/auth/providers` returns two or more entries, and the hook was not called with `disabled: true`
- **THEN** the SPA calls React Router `navigate('/login?callbackUrl=<encoded-current-url>', { replace: true })` exactly once and renders the lazy-loaded `<LoginPage />`

#### Scenario: Already authenticated user lands on /login

- **WHEN** the bootstrap finishes with `status = 'authenticated'` and the current URL pathname is `/login`
- **THEN** the SPA calls `navigate('<callback-path>', { replace: true })` when a same-origin `callbackUrl` query parameter is present, otherwise `navigate('/', { replace: true })`

#### Scenario: No redirect during loading

- **WHEN** the bootstrap status is `loading`
- **THEN** no redirect is performed and the gate renders `null`

#### Scenario: Disabled flag suppresses every automatic side effect

- **WHEN** `useAuthRedirect({ disabled: true })` is called with `status = 'unauthenticated'` and `pathname !== '/login'`
- **THEN** the SPA does NOT call `GET /api/v1/auth/providers`, does NOT call `navigate(...)`, and does NOT call `window.location.assign(...)`

#### Scenario: Omitted options preserve existing behavior

- **WHEN** `useAuthRedirect()` is called with no arguments (as `<LoginPage />` does today)
- **THEN** its behavior is identical to every scenario above that does not mention the `disabled` flag

---

### Requirement: All SPA API requests send the session cookie

The shared `request()` helper in `apps/chat/src/server-api/base.ts` SHALL include `credentials: 'include'` on every outbound `fetch`, ensuring the `__Host-chat.sess` cookie is sent on both same-origin (dev via Vite proxy) and cross-origin (production) deployments. No call site is permitted to call `fetch` directly bypassing the helper.

#### Scenario: GET sends credentials

- **WHEN** any caller invokes `get<T>(url)` from `server-api/base.ts`
- **THEN** the underlying `fetch` is invoked with `credentials: 'include'` in its `RequestInit`

#### Scenario: POST and PUT send credentials

- **WHEN** any caller invokes `post<T>(url, body)` or `put<T>(url, body)` from `server-api/base.ts`
- **THEN** the underlying `fetch` is invoked with `credentials: 'include'` in its `RequestInit`

---

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

### Requirement: Routing gates protected UI behind a resolved session

The SPA SHALL declare two top-level routes in `apps/chat/src/main.tsx`: `/login` (the provider picker) and `*` (everything else, wrapped in a `<RequireAuth>` gate). The `<RequireAuth>` component MUST render its `children` only when `status === 'authenticated'`, render `null` while `status === 'loading'` and overlay mode is not active (see `chat-overlay-app-mode` for the overlay-mode loading presentation), and, when `status === 'unauthenticated'`:

- outside overlay mode (`useOptionalOverlay()` returns `undefined`): call `useAuthRedirect()` with no disabling options, triggering the existing automatic redirect policy;
- inside overlay mode (`useOptionalOverlay()` returns a defined value): call `useAuthRedirect({ disabled: true })`, so no automatic redirect is attempted, and render the overlay login gate defined in `overlay-external-login` instead of `null`.

#### Scenario: Authenticated user sees the chat

- **WHEN** `<RequireAuth>` mounts with `status = 'authenticated'`
- **THEN** it renders its `children` (the existing `<App />`)

#### Scenario: Loading user sees nothing

- **WHEN** `<RequireAuth>` mounts with `status = 'loading'` outside overlay mode
- **THEN** it renders `null` and does NOT trigger any redirect

#### Scenario: Login route renders the picker

- **WHEN** the URL pathname is `/login` and there are two or more registered providers
- **THEN** the lazy-loaded `<LoginPage />` mounts and the `<RequireAuth>` gate is NOT mounted for the same render

#### Scenario: Unauthenticated outside overlay mode still auto-redirects

- **WHEN** `<RequireAuth>` mounts with `status = 'unauthenticated'` and `useOptionalOverlay()` returns `undefined`
- **THEN** `useAuthRedirect()` is called without `disabled`, so the existing single-provider/multi-provider automatic redirect policy still applies

#### Scenario: Unauthenticated inside overlay mode does not auto-redirect

- **WHEN** `<RequireAuth>` mounts with `status = 'unauthenticated'` and `useOptionalOverlay()` returns a defined overlay context value
- **THEN** `useAuthRedirect({ disabled: true })` is called, no `window.location.assign` or `navigate` call is made as a result, and the overlay login gate renders instead of `null`

---

### Requirement: Login picker page lists providers and links to the BFF login endpoint

The `<LoginPage />` component SHALL own provider loading on the `/login` route, load the provider list via `GET /api/v1/auth/providers` exactly once on mount, read an optional `callbackUrl` from the route query string, and render one HTML anchor element per provider whose `href` is `/api/v1/auth/login/<providerId>?callbackUrl=<encoded-callback-url>`. If the route query omits `callbackUrl`, the page SHALL default to the application root (`window.location.origin + '/'`). Anchors MUST NOT be React Router `<Link>` elements, because the destination is a BFF route that requires a top-level browser navigation to the IdP. While loading, a localised placeholder MUST be shown; on failure, a localised error message MUST be shown.

#### Scenario: Provider list rendered

- **WHEN** `GET /api/v1/auth/providers` returns `[{ id: 'keycloak', label: 'Keycloak' }, { id: 'auth0', label: 'Auth0' }]`
- **THEN** `<LoginPage />` renders two anchor elements with `href` values `/api/v1/auth/login/keycloak?callbackUrl=<encoded-callback-url>` and `/api/v1/auth/login/auth0?callbackUrl=<encoded-callback-url>`, labelled with the i18n key `auth.providerButtonLabel` interpolated with each provider's `label`

#### Scenario: Callback URL preserved through provider picker

- **WHEN** the current route is `/login?callbackUrl=http%3A%2F%2Flocalhost%3A4207%2Fconversation%3Fx%3D1`
- **THEN** every provider anchor forwards that same encoded `callbackUrl` to `/api/v1/auth/login/<providerId>`

#### Scenario: Loading placeholder

- **WHEN** `<LoginPage />` is mounted and the providers fetch is still in flight
- **THEN** the i18n key `auth.loading` is rendered as the placeholder

#### Scenario: Fetch failure surfaces a localised message

- **WHEN** `GET /api/v1/auth/providers` rejects with any error
- **THEN** `<LoginPage />` renders the i18n key `auth.providersError` and logs the error via `console.error`

---

### Requirement: Header user widget shows identity and offers sign-out

The header component (`apps/chat/src/components/Header/Header.tsx`) SHALL render a `<UserMenu />` widget on the right side of the bar. When `status === 'authenticated'`, the widget MUST display the user's email (from `user.claims.email`) or a fallback initial, and expose a backend-dependent sign-out affordance implemented as an HTML `<form method="POST" action="/api/v1/auth/logout">`. The form wiring is part of this change; successful logout depends on backend Slice 3 of `auth-bff-encrypted-cookie`. When `status` is anything else, the widget MUST render `null`.

#### Scenario: Authenticated state shows email and sign-out

- **WHEN** the user is authenticated with `claims.email = 'u@x.io'`
- **THEN** `<UserMenu />` renders an accessible button labelled with `u@x.io` (i18n key `auth.signedInAs` interpolation) that opens a dropdown containing a form whose submit button is labelled with the i18n key `auth.signOut`

#### Scenario: Loading or unauthenticated state hides the widget

- **WHEN** `status` is `'loading'` or `'unauthenticated'`
- **THEN** `<UserMenu />` renders `null`

#### Scenario: Sign-out submits to the BFF endpoint

- **WHEN** the user clicks the "Sign out" button inside the dropdown
- **THEN** the browser performs a top-level `POST` form submission to `/api/v1/auth/logout` (no `fetch` is used)

---

### Requirement: All new user-visible strings flow through react-i18next

Every user-visible string introduced by this change MUST be looked up via `useTranslation()` from `react-i18next`. The corresponding keys MUST live under the `auth.*` namespace in `apps/chat/src/i18n/locales/en.json`. No hard-coded English strings are permitted in any component, page, or hook added or modified by this change.

#### Scenario: Auth namespace populated

- **WHEN** the change is applied
- **THEN** `apps/chat/src/i18n/locales/en.json` contains the keys `auth.signOut`, `auth.signedInAs`, `auth.loading`, `auth.loginTitle`, `auth.loginDescription`, `auth.providerButtonLabel`, `auth.providersError`, and `auth.userMenuLabel`

#### Scenario: Components use the t function

- **WHEN** any component, page, or hook added by this change renders a user-visible string
- **THEN** that string MUST come from a `t('auth.<element>')` call, not a string literal

---

### Requirement: Auth endpoint constants in the server-api module

The `ApiEndpoints` enum in `apps/chat/src/server-api/base.ts` SHALL be extended with at minimum `AUTH_ME = '/api/v1/auth/me'`, `AUTH_PROVIDERS = '/api/v1/auth/providers'`, and `AUTH_LOGOUT = '/api/v1/auth/logout'`. The dynamic login URL `/api/v1/auth/login/<providerId>?callbackUrl=<encoded-url>` MAY be constructed inline since `providerId` and `callbackUrl` are runtime values. No call site outside `server-api/` is permitted to hard-code any static `/api/v1/auth/*` literal other than the dynamic login URL builder.

#### Scenario: Enum contains auth endpoints

- **WHEN** the change is applied
- **THEN** importing `ApiEndpoints` from `apps/chat/src/server-api/base.ts` exposes the three constants above with the exact path values listed

#### Scenario: No hard-coded auth paths outside server-api

- **WHEN** searching the `apps/chat/src/` tree (excluding `apps/chat/src/server-api/**`) for the literal `/api/v1/auth/`
- **THEN** the only occurrences are the dynamic login URL built from `providerId`, with no static `'/api/v1/auth/me'`, `'/api/v1/auth/providers'`, or `'/api/v1/auth/logout'` literals

---

### Requirement: Tests cover the auth integration surface

The change SHALL ship co-located Vitest specs that cover every new module: `UserContext.spec.tsx`, `useAuthRedirect.spec.ts`, `Login.spec.tsx`, `UserMenu.spec.tsx`, and additions to `base.spec.ts`. Tests MUST use `@testing-library/react` role/label/text queries instead of implementation-specific selectors and describe observable behaviour, not implementation details.

#### Scenario: UserContext bootstrap paths are tested

- **WHEN** the test suite for `UserContext` runs
- **THEN** it covers at least: `200`-success, `401`-unauthenticated, network failure, the `reset()` method clearing state, and the consumer-outside-provider error

#### Scenario: useAuthRedirect policy is tested

- **WHEN** the test suite for `useAuthRedirect` runs
- **THEN** it covers at least: single-provider auto-redirect via a mocked `window.location.assign` including `callbackUrl`, multi-provider `navigate('/login?callbackUrl=...')` call, no-op while `loading`, and the already-authenticated-on-/login redirect to the same-origin callback path or `/`

#### Scenario: API helper raises UnauthorizedError on 401

- **WHEN** the test suite for `server-api/base.ts` runs
- **THEN** it covers at least: a `401` response throws `UnauthorizedError` with the expected `status` and `url`, an `onUnauthorized` listener is invoked exactly once per 401, and a `500` response still throws a generic `Error`

#### Scenario: UserMenu role-based queries

- **WHEN** the test suite for `UserMenu` runs
- **THEN** assertions resolve the email button by `getByRole('button', { name: ... })` and the sign-out form by `getByRole('form')`, without implementation-specific selectors

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
- **THEN** only one `GET /api/v1/auth/me` request is in flight at a time for this mechanism; the second trigger does not issue a duplicate request
