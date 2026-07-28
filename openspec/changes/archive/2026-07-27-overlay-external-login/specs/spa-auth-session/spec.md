## MODIFIED Requirements

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
