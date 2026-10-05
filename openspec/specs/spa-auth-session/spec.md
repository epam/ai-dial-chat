# spa-auth-session Specification

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

The redirect MUST NOT fire while the bootstrap status is `loading`, MUST NOT perform a provider-list redirect on the `/login` route itself, and MUST NOT loop when the BFF immediately re-issues a `401`. After one automatic single-provider attempt for a given callback URL in the current tab, a subsequent unauthenticated bootstrap within 60 seconds (`AUTH_REDIRECT_ATTEMPT_TTL_MS`) MUST fall back to `/login?callbackUrl=...` instead of starting another automatic provider redirect. The attempt is recorded in `sessionStorage` under `chat.auth.redirectAttempt` (`AUTH_REDIRECT_ATTEMPT_STORAGE_KEY`) as `{ callbackUrl, createdAt }`; it is cleared once the user is authenticated, and after it expires another automatic provider redirect for the same callback URL is allowed. The SPA MUST only generate same-origin callback URLs; the BFF remains authoritative for final validation.

#### Scenario: Single provider auto-redirect

- **WHEN** the bootstrap finishes with `status = 'unauthenticated'` and `GET /api/v1/auth/providers` returns one entry, and the hook was not called with `disabled: true`
- **THEN** the SPA performs `window.location.assign('/api/v1/auth/login/<id>?callbackUrl=<encoded-current-url>')` exactly once during that session

#### Scenario: Repeat unauthenticated bootstrap falls back to the picker

- **WHEN** an automatic single-provider redirect for the same callback URL was recorded in `chat.auth.redirectAttempt` less than 60 seconds ago and the bootstrap again finishes with `status = 'unauthenticated'`
- **THEN** the SPA navigates to `/login?callbackUrl=<encoded-current-url>` instead of calling `window.location.assign` again
- **AND** once the recorded attempt is older than 60 seconds, the automatic provider redirect is allowed again

#### Scenario: Multi-provider navigation to picker

- **WHEN** the bootstrap finishes with `status = 'unauthenticated'` and `GET /api/v1/auth/providers` returns two or more entries, and the hook was not called with `disabled: true`
- **THEN** the SPA calls React Router `navigate('/login?callbackUrl=<encoded-current-url>', { replace: true })` exactly once and renders the lazy-loaded `<LoginPage />`

#### Scenario: Already authenticated user lands on /login

- **WHEN** the bootstrap finishes with `status = 'authenticated'` and the current URL pathname is `/login`
- **THEN** the SPA calls `navigate('<callback-path>', { replace: true })` when a same-origin `callbackUrl` query parameter is present, otherwise `navigate('/', { replace: true })`

#### Scenario: No redirect during loading

- **WHEN** the bootstrap status is `loading`
- **THEN** no redirect is performed, and `<RequireAuth>` renders a centred ui-kit `<Spinner />` outside overlay mode (`null` in overlay mode)

#### Scenario: Disabled flag suppresses every automatic side effect

- **WHEN** `useAuthRedirect({ disabled: true })` is called with `status = 'unauthenticated'` and `pathname !== '/login'`
- **THEN** the SPA does NOT call `GET /api/v1/auth/providers`, does NOT call `navigate(...)`, and does NOT call `window.location.assign(...)`

#### Scenario: Omitted options preserve existing behavior

- **WHEN** `useAuthRedirect()` is called with no arguments (as `<LoginPage />` does today)
- **THEN** its behavior is identical to every scenario above that does not mention the `disabled` flag

---

### Requirement: All SPA API requests send the session cookie

Every SPA request to the BFF SHALL be sent with `credentials: 'include'`, so the `__Host-chat.sess` cookie is sent on both same-origin (dev via Vite proxy) and cross-origin (production) deployments. Requests go through one of three paths:

- **Generated client (most calls)** — the `@epam/ai-dial-chat-api-client` API instances in `apps/chat/src/server-api/api-client.ts` (`authApi`, `conversationsApi`, `deploymentsApi`, …) share one `Configuration` built by `createApiConfiguration()` with `basePath: ''`, `credentials: 'include'`, and the middleware chain `[csrfMiddleware, unauthorizedMiddleware, telemetryMiddleware]`. `getMe()` (`authApi.getCurrentUserRaw`) and `getProviders()` (`authApi.listProviders`) in `server-api/auth.api.ts` use it.
- **`request()` helper** — the `get`/`post`/`put` helpers in `apps/chat/src/server-api/base.ts` remain for the remaining legacy paths and always set `credentials: 'include'`.
- **Direct `fetch`** — a few call sites that need raw `fetch` options set `credentials: 'include'` themselves: `logout()` in `server-api/auth.api.ts`, the CSRF refresh probe in `base.ts`, and `client-channel.ts`'s subscribe call.

#### Scenario: Generated client sends credentials

- **WHEN** any call is made through an API instance from `server-api/api-client.ts`
- **THEN** the underlying `fetch` is invoked with `credentials: 'include'`

#### Scenario: GET sends credentials

- **WHEN** any caller invokes `get<T>(url)` from `server-api/base.ts`
- **THEN** the underlying `fetch` is invoked with `credentials: 'include'` in its `RequestInit`

#### Scenario: POST and PUT send credentials

- **WHEN** any caller invokes `post<T>(url, body)` or `put<T>(url, body)` from `server-api/base.ts`
- **THEN** the underlying `fetch` is invoked with `credentials: 'include'` in its `RequestInit`

---

### Requirement: 401 responses surface as a typed UnauthorizedError and reset the session

When the `request()` helper in `server-api/base.ts` or the generated client's `unauthorizedMiddleware` (built in `api-client.ts` from `createUnauthorizedMiddleware` in `libs/chat-hooks/src/api-transport/create-unauthorized-middleware.ts`) observes an HTTP `401` response, it SHALL call `notifyUnauthorized(url)` — which clears the CSRF token and invokes every listener registered through `onUnauthorized(listener)` in `base.ts` — and SHALL throw an `UnauthorizedError` (subclass of `Error`, `status: 401`, exposes the originating URL). The middleware also treats a `403` with an invalid-CSRF body as recoverable: it refreshes the CSRF token and retries the request once, and notifies/throws `UnauthorizedError` only when the refresh reports unauthorized or the retry fails the same way.

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

- **WHEN** a `request()` helper call returns any non-OK status other than `401` (e.g. `500`, `502`)
- **THEN** the helper throws a generic `Error` with a message containing the status and URL, and the `UnauthorizedError` listeners are NOT invoked

#### Scenario: Listener subscription is cleanable

- **WHEN** the cleanup function returned by `onUnauthorized(listener)` is invoked
- **THEN** that listener is no longer called on subsequent `401`s, and unrelated listeners remain registered

---

### Requirement: Routing gates protected UI behind a resolved session

The SPA SHALL declare three top-level routes in `apps/chat/src/main.tsx`: `/login` (the provider picker), `/overlay-close` (`<OverlayClose />`, outside the auth gate), and `*` (everything else, wrapped in `<OverlayModeGate>` and a `<RequireAuth>` gate). The `<RequireAuth>` component MUST render its `children` only when `status === 'authenticated'`. While `status === 'loading'` it renders a centred ui-kit `<Spinner />` outside overlay mode and `null` in overlay mode (see `chat-overlay-app-mode` for the overlay-mode loading presentation). When `status === 'unauthenticated'`:

- outside overlay mode (`useOptionalOverlay()` returns `undefined`): call `useAuthRedirect()` with no disabling options, triggering the existing automatic redirect policy;
- inside overlay mode (`useOptionalOverlay()` returns a defined value): call `useAuthRedirect({ disabled: true })`, so no automatic redirect is attempted, and render the overlay login gate defined in `overlay-external-login` instead of `null`.

#### Scenario: Authenticated user sees the chat

- **WHEN** `<RequireAuth>` mounts with `status = 'authenticated'`
- **THEN** it renders its `children` (the existing `<App />`)

#### Scenario: Loading user sees a spinner

- **WHEN** `<RequireAuth>` mounts with `status = 'loading'` outside overlay mode
- **THEN** it renders a centred `<Spinner />`, not its `children`, and does NOT trigger any redirect
- **AND WHEN** the same happens in overlay mode
- **THEN** it renders `null`

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

The `<LoginPage />` component (`apps/chat/src/pages/auth/Login.tsx`) SHALL own provider loading on the `/login` route, load the provider list once on mount via `getProviders()` (`authApi.listProviders()`, i.e. `GET /api/v1/auth/providers`), read an optional `callbackUrl` from the route query string, and render one ui-kit `NeutralButton` with an `href` (which renders an `<a>`) per provider, whose `href` is `/api/v1/auth/login/<encoded-providerId>?callbackUrl=<encoded-callback-url>`, whose `label` is the provider's `label` as-is, and whose `iconBefore` is a `ProviderIcon`. The buttons are preceded by a `t(AuthI18nKeys.LoginDescription)` line (`auth.loginDescription`, "Sign in with:") under the `auth.loginTitle` heading. The page SHALL use `callbackUrl` only when it parses as a same-origin URL (and does not start with `//`); otherwise, or when the query omits it, it SHALL default to the application root (`window.location.origin + '/'`). Provider links MUST NOT be React Router `<Link>` elements, because the destination is a BFF route that requires a top-level browser navigation to the IdP. While loading, a localised placeholder MUST be shown; on failure, a localised error message MUST be shown.

#### Scenario: Provider list rendered

- **WHEN** `GET /api/v1/auth/providers` returns `[{ id: 'keycloak', label: 'Keycloak' }, { id: 'auth0', label: 'Auth0' }]`
- **THEN** `<LoginPage />` renders two links with `href` values `/api/v1/auth/login/keycloak?callbackUrl=<encoded-callback-url>` and `/api/v1/auth/login/auth0?callbackUrl=<encoded-callback-url>`, named `Keycloak` and `Auth0`

#### Scenario: Callback URL preserved through provider picker

- **WHEN** the current route is `/login?callbackUrl=http%3A%2F%2Flocalhost%3A4207%2Fconversation%3Fx%3D1`
- **THEN** every provider anchor forwards that same encoded `callbackUrl` to `/api/v1/auth/login/<providerId>`

#### Scenario: Loading placeholder

- **WHEN** `<LoginPage />` is mounted and the providers fetch is still in flight
- **THEN** the i18n key `auth.loading` is rendered as the placeholder

#### Scenario: Fetch failure surfaces a localised message

- **WHEN** `GET /api/v1/auth/providers` rejects with any error
- **THEN** `<LoginPage />` renders the i18n key `auth.providersError` (the error is caught and only sets the error state; it is not logged)

---

### Requirement: User menu shows identity and offers sign-out behind a confirmation

On desktop, `apps/chat/src/components/Navigation/Navigation.tsx` SHALL render the `UserMenu` from `@epam/ai-dial-navigation-panel` in the footer of the `NavigationPanel` rail, only when `status === 'authenticated'` with a `user` and `OverlayFeature.HideUserMenu` is not set. The menu's trigger is an avatar `Button` with `aria-label` `t(AuthI18nKeys.SignedInAs, { email })` (`auth.signedInAs`) and an email tooltip; the avatar uses `auth.userAvatar` as its alt text. Its 2.0 `Dropdown` holds the user's identity, the language group (when one is offered), a Settings item (`basic.settings`, omitted when `OverlayFeature.HideSettingsPage` is set), and a Log out item (`ButtonsI18nKeys.LogOut`, `buttons.logOut`). On mobile, the `NavigationSheet` profile page's Log out row triggers the same flow.

Both Log out entries SHALL call `openLogout()` from `useLogout()`, which opens `LogoutConfirmationModal` (a ui-kit `ConfirmationPopup` with `auth.logOutConfirmTitle`, `auth.logOutConfirmDescription`, and confirm label `buttons.logOut`). Confirming SHALL call `logout()` from `server-api/auth.api.ts`, which sends `fetch(ApiEndpoints.AUTH_LOGOUT, { method: 'POST', credentials: 'include', redirect: 'manual' })` with an `X-CSRF-Token` header when a token is held and always clears the CSRF token afterwards. The modal then logs any request failure via `console.error`, calls `useUser().reset()`, and, outside overlay mode, navigates to `ROUTES.Login`; in overlay mode the current route is kept. There is no HTML form submission.

#### Scenario: Authenticated state shows the user menu

- **WHEN** the user is authenticated with email `u@x.io` on a desktop viewport and `OverlayFeature.HideUserMenu` is not set
- **THEN** the rail footer renders a button named by `auth.signedInAs` interpolated with `u@x.io`, opening a dropdown that contains the Log out item

#### Scenario: Unauthenticated or hidden state omits the menu

- **WHEN** `status` is not `'authenticated'`, or `OverlayFeature.HideUserMenu` is set
- **THEN** no `UserMenu` is rendered

#### Scenario: Log out asks for confirmation first

- **WHEN** the user picks Log out in the `UserMenu` or the mobile sheet
- **THEN** `LogoutConfirmationModal` opens and no logout request has been sent yet

#### Scenario: Confirming sign-out posts to the BFF and resets the session

- **WHEN** the user confirms in `LogoutConfirmationModal` outside overlay mode
- **THEN** a `fetch` `POST` to `/api/v1/auth/logout` is sent with `credentials: 'include'`, the CSRF token is cleared, `useUser().reset()` is called, and the app navigates to `/login`
- **AND WHEN** the same happens in overlay mode
- **THEN** the app stays on the current route

---

### Requirement: All new user-visible strings flow through react-i18next

Every user-visible auth string MUST be looked up via `useTranslation()` from `react-i18next`, through a member of the `AuthI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts` (or a shared enum such as `ButtonsI18nKeys` for generic labels like Log out). Auth-specific keys MUST live under the `auth.*` namespace in `apps/chat/src/i18n/locales/en.json`. Provider names on the login page are the BFF-supplied `label` values and are rendered as-is. No hard-coded English strings are permitted in auth components, pages, or hooks.

#### Scenario: Auth namespace populated

- **WHEN** `apps/chat/src/i18n/locales/en.json` is inspected
- **THEN** it contains the keys `auth.signedInAs`, `auth.loading`, `auth.loginTitle`, `auth.loginDescription`, `auth.providersError`, `auth.overlayLoginTitle`, `auth.overlayLoginDescription`, `auth.overlayExternalLoginBlocked`, `auth.overlayLoginTakingLonger`, `auth.overlayProviderPickerLoading`, `auth.overlayProvidersError`, `auth.logOutConfirmTitle`, `auth.logOutConfirmDescription`, `auth.loggingOutStatus`, and `auth.userAvatar`
- **AND** the Log out label is the shared `buttons.logOut` key

#### Scenario: Components use the typed key enum

- **WHEN** any auth component, page, or hook renders a user-visible string
- **THEN** that string comes from `t(AuthI18nKeys.<Member>)` (or a shared key enum), not a string literal or a raw key string

---

### Requirement: Auth endpoint constants in the server-api module

The `ApiEndpoints` enum in `apps/chat/src/server-api/base.ts` SHALL contain `AUTH_ME = '/api/v1/auth/me'` (used by the CSRF refresh probe) and `AUTH_LOGOUT = '/api/v1/auth/logout'` (used by `logout()`). There is no `AUTH_PROVIDERS` member: the provider list is fetched through the generated client (`authApi.listProviders()` via `getProviders()`), and `getMe()` uses `authApi.getCurrentUserRaw()`. The dynamic login URL `/api/v1/auth/login/<encoded-providerId>?callbackUrl=<encoded-url>` MAY be constructed inline since `providerId` and `callbackUrl` are runtime values; it is built in three places: `hooks/auth/useAuthRedirect.ts`, `pages/auth/Login.tsx`, and `hooks/auth/useOverlayProviderLogin.ts`. No call site outside `server-api/` is permitted to hard-code any static `/api/v1/auth/*` literal other than the dynamic login URL.

#### Scenario: Enum contains auth endpoints

- **WHEN** `ApiEndpoints` is imported from `apps/chat/src/server-api/base.ts`
- **THEN** it exposes `AUTH_ME` and `AUTH_LOGOUT` with the exact path values listed, and no `AUTH_PROVIDERS`

#### Scenario: No hard-coded auth paths outside server-api

- **WHEN** searching the `apps/chat/src/` tree (excluding `apps/chat/src/server-api/**` and tests) for the literal `/api/v1/auth/`
- **THEN** the only occurrences are the dynamic login URLs in `useAuthRedirect`, `Login`, and `useOverlayProviderLogin`, with no static `'/api/v1/auth/me'`, `'/api/v1/auth/providers'`, or `'/api/v1/auth/logout'` literals

---

### Requirement: Tests cover the auth integration surface

The auth surface SHALL be covered by co-located Vitest specs: `apps/chat/src/context/auth/UserContext.spec.tsx`, `apps/chat/src/hooks/auth/useAuthRedirect.spec.tsx`, `apps/chat/src/pages/auth/Login.spec.tsx`, `apps/chat/src/server-api/tests/base.spec.ts`, `apps/chat/src/server-api/tests/auth.api.spec.ts`, `apps/chat/src/components/LogoutConfirmation/tests/LogoutConfirmationModal.spec.tsx`, and `libs/navigation-panel/src/components/UserMenu/tests/UserMenu.spec.tsx`. Tests MUST use `@testing-library/react` role/label/text queries instead of implementation-specific selectors and describe observable behaviour, not implementation details.

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
- **THEN** assertions resolve the trigger by `getByRole('button', { name: labels.trigger })` and the avatar by `getByRole('img', { name: labels.avatarAlt })`, without implementation-specific selectors

#### Scenario: Logout confirmation navigation is tested

- **WHEN** the test suite for `LogoutConfirmationModal` runs
- **THEN** it covers navigating to `/login` after logout outside overlay mode and keeping the current route in overlay mode

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
