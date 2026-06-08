# Tasks: auth-frontend-integration

Implementation is split into six thin vertical slices on the SPA. Each slice is additive, independently testable, and leaves the app in a green state. Work through slices in order and run the per-slice `Verify` block before moving on (per `.cursor/rules/incremental-implementation.mdc`).

---

## 1. Slice 1 — API layer: credentials, UnauthorizedError, onUnauthorized listener

- [x] 1.1 In `apps/chat/src/server-api/base.ts`, add `credentials: 'include'` to the `fetch` options inside the shared `request()` helper. Keep the change additive (do not touch existing signatures or call sites).
- [x] 1.2 In `apps/chat/src/server-api/base.ts`, export an `UnauthorizedError` class extending `Error` with `readonly status: 401` and a `readonly url: string` field; set `name = 'UnauthorizedError'`.
- [x] 1.3 In `apps/chat/src/server-api/base.ts`, replace the generic 401 path inside `request()` so that on `response.status === 401` it throws `new UnauthorizedError(url)` instead of a generic `Error`. Non-401 non-OK statuses keep the existing `Error('Request failed with status …')` message.
- [x] 1.4 In `apps/chat/src/server-api/base.ts`, add a module-scoped listener registry: `const listeners = new Set<(url: string) => void>()` plus an exported `onUnauthorized(listener)` function that returns a cleanup callback (`() => listeners.delete(listener)`). Inside `request()`, invoke each listener synchronously **before** throwing the `UnauthorizedError`.
- [x] 1.5 Extend the `ApiEndpoints` enum in `apps/chat/src/server-api/base.ts` with `AUTH_ME = '/api/v1/auth/me'`, `AUTH_PROVIDERS = '/api/v1/auth/providers'`, and `AUTH_LOGOUT = '/api/v1/auth/logout'`. Do **not** add a `LOGIN` constant (the URL is built per-provider at the call site).
- [x] 1.6 Update `apps/chat/src/server-api/base.spec.ts` with co-located Vitest cases (use `vi.spyOn(globalThis, 'fetch')` and avoid implementation-specific selectors):
  - 1.6.a `get<T>(url)` passes `credentials: 'include'` to `fetch`.
  - 1.6.b `post<T>(url, body)` and `put<T>(url, body)` pass `credentials: 'include'`.
  - 1.6.c A `401` response causes `request()` to throw an instance of `UnauthorizedError` whose `status === 401` and whose `url` matches the call.
  - 1.6.d A `500` response throws a plain `Error` (not `UnauthorizedError`).
  - 1.6.e Listeners registered via `onUnauthorized` are invoked exactly once per `401` and not at all for non-401 errors; the cleanup callback unregisters the listener.
- [x] 1.7 Verify the slice in isolation: `npm exec nx test chat` and `npm exec nx lint chat`.

## 2. Slice 2 — UserContext provider and useUser hook

- [x] 2.1 Create `apps/chat/src/context/auth/UserContext.tsx`. Mirror the structure of `apps/chat/src/context/ThemeContext.tsx`:
  - `createContext<UserContextType | undefined>(undefined)`.
  - `UserContextType = { status: 'loading' | 'authenticated' | 'unauthenticated'; user: UserProfile | null; refresh: () => Promise<void>; reset: () => void }`.
  - Provider performs `GET ApiEndpoints.AUTH_ME` once on mount inside `useEffect` with a `cancelled` flag.
  - On success → `status='authenticated'`, `user = response`.
  - On `UnauthorizedError` (catch via `instanceof`) → `status='unauthenticated'`, `user = null`.
  - On any other error → log via `console.error('UserContext bootstrap failed', err)` and set `status='unauthenticated'`.
  - `reset()` sets `status='unauthenticated'`, `user=null` synchronously.
  - `refresh()` re-runs the bootstrap fetch and updates state.
  - Wrap the context value in `useMemo`.
  - Register a single `onUnauthorized` listener inside `useEffect` that calls `reset()`; return the cleanup callback.
- [x] 2.2 Export `useUser(): UserContextType` from the same file; throw `Error('useUser must be used within a UserProvider')` when the context is `undefined`.
- [x] 2.3 Import `UserProfile` from `@epam/ai-dial-chat-shared` — do not redefine it locally.
- [x] 2.4 In `apps/chat/src/main.tsx`, wrap the existing `<ThemeProvider>` with `<UserProvider>` so the tree becomes `<BrowserRouter><UserProvider><ThemeProvider>…</ThemeProvider></UserProvider></BrowserRouter>`. Do **not** add `<Routes>` yet (that lands in slice 3).
- [x] 2.5 Add `apps/chat/src/context/auth/UserContext.spec.tsx` with Vitest + `@testing-library/react`. Use role/label/text queries only. Cover:
  - 2.5.a 200 path → `status` transitions to `'authenticated'` and `user` equals the mocked profile.
  - 2.5.b 401 path → `status` transitions to `'unauthenticated'` and `user === null`.
  - 2.5.c Network-failure path → `status` becomes `'unauthenticated'` and a `console.error` is emitted.
  - 2.5.d `reset()` clears state without re-fetching.
  - 2.5.e `refresh()` re-runs the fetch and updates state on a previously failed bootstrap.
  - 2.5.f `useUser()` outside `<UserProvider>` throws a descriptive `Error`.
  - 2.5.g A `401` from any subsequent call (simulated by manually firing a registered `onUnauthorized` listener) resets the context.
- [x] 2.6 Verify the slice: `npm exec nx test chat` and `npm exec nx lint chat`.

## 3. Slice 3 — i18n keys batch

- [x] 3.1 Add the `auth` namespace to `apps/chat/src/i18n/locales/en.json` (and any other locale files present in the repo at the time of implementation) with the following keys and English copy:
  - `auth.signOut`: "Sign out"
  - `auth.signedInAs`: "Signed in as {{email}}"
  - `auth.loading`: "Checking your session…"
  - `auth.loginTitle`: "Sign in to continue"
  - `auth.loginDescription`: "Choose your identity provider"
  - `auth.providerButtonLabel`: "Sign in with {{provider}}"
  - `auth.providersError`: "Could not load identity providers. Please retry."
  - `auth.userMenuLabel`: "User menu"
- [x] 3.2 Run `npm exec nx lint chat` to confirm no ESLint key-format rule is violated.

## 4. Slice 4 — useAuthRedirect hook and <RequireAuth> gate with routing

- [x] 4.1 Create `apps/chat/src/hooks/auth/useAuthRedirect.ts`. JSDoc at the top explains WHY the policy is centralised here (per the design doc D3). The hook:
  - Reads `status` from `useUser()` and the current pathname from `react-router-dom` (`useLocation`).
  - Computes a same-origin `callbackUrl` from the current browser URL (`window.location.href`, including pathname, search, and hash) before any unauthenticated redirect.
  - Loads the provider list via `get<ProviderInfo[]>(ApiEndpoints.AUTH_PROVIDERS)` once when `status === 'unauthenticated'` and the current pathname is not `/login`, using a `cancelled` flag in the effect. The `/login` route owns its own provider-list fetch.
  - If exactly one provider, status is `'unauthenticated'`, and the current pathname is not `/login`: `window.location.assign('/api/v1/auth/login/' + encodeURIComponent(id) + '?callbackUrl=' + encodeURIComponent(callbackUrl))`.
  - If two or more providers and status is `'unauthenticated'` and current pathname is **not** `/login`: `navigate('/login?callbackUrl=' + encodeURIComponent(callbackUrl), { replace: true })`.
  - If `status === 'authenticated'` and current pathname is `/login`: navigate to the same-origin `callbackUrl` query parameter's path/search/hash when present, otherwise `navigate('/', { replace: true })`.
  - Returns `void`.
- [x] 4.2 Create `apps/chat/src/components/RequireAuth/RequireAuth.tsx`. It is a functional component with prop `children: ReactNode` that:
  - Calls `useUser()` and `useAuthRedirect()`.
  - Returns `null` when `status === 'loading'` or `status === 'unauthenticated'`.
  - Returns `<>{children}</>` only when `status === 'authenticated'`.
- [x] 4.3 Update `apps/chat/src/main.tsx` to add a `<Routes>` block inside `<ThemeProvider>`:
  - `<Route path="/login" element={<LoginPage />} />` (lazy import added in slice 5; for now use a temporary placeholder component or skip this route until slice 5).
  - `<Route path="*" element={<RequireAuth><App /></RequireAuth>} />`.
    Wrap the routes in `<Suspense fallback={null}>` consistent with the existing lazy-loading pattern.
- [x] 4.4 Add a `ProviderInfo` type to `libs/chat-shared/src/models/auth.ts`: `export interface ProviderInfo { id: string; label: string }`. Re-export it from `libs/chat-shared/src/index.ts` if such a barrel exists; otherwise leave the named export at the file level.
- [x] 4.5 Add `apps/chat/src/hooks/auth/useAuthRedirect.spec.tsx`. Cover:
  - 4.5.a Mocked `window.location.assign` is called once with the correct login URL and encoded `callbackUrl` when one provider, `status='unauthenticated'`, and pathname is not `/login`.
  - 4.5.b `navigate('/login?callbackUrl=...', { replace: true })` is called when ≥ 2 providers and `status='unauthenticated'` and the pathname is `/conversation`.
  - 4.5.c No navigation happens when `status='loading'`.
  - 4.5.d `navigate('<callback-path>', { replace: true })` is called when `status='authenticated'`, pathname is `/login`, and a same-origin `callbackUrl` query parameter exists; otherwise `navigate('/', { replace: true })`.
  - 4.5.e No provider-list fetch or unauthenticated redirect happens on `/login`; `LoginPage` owns provider loading there.
  - 4.5.f No redirect loop: re-rendering after the assign/navigate does not trigger a second call.
- [x] 4.6 Add `apps/chat/src/components/RequireAuth/tests/RequireAuth.spec.tsx`. Cover:
  - 4.6.a Renders `null` when `status='loading'`.
  - 4.6.b Renders `null` when `status='unauthenticated'` (and `useAuthRedirect` is invoked — assert via a spy on its module export, or by asserting the side-effect from 4.5.a).
  - 4.6.c Renders children (resolved by role/text) when `status='authenticated'`.
- [x] 4.7 Verify the slice: `npm exec nx test chat` and `npm exec nx lint chat`.

## 5. Slice 5 — LoginPage route

- [x] 5.1 Create `apps/chat/src/pages/auth/Login.tsx` as a functional component named `LoginPage`. It:
  - Calls `useUser()` and `useAuthRedirect()` so that an already-authenticated user is bounced back to `/`.
  - Loads providers via `get<ProviderInfo[]>(ApiEndpoints.AUTH_PROVIDERS)` once on mount inside `useEffect` with a `cancelled` flag.
  - Reads `callbackUrl` from the route query string via React Router. If absent, defaults to `window.location.origin + '/'`.
  - While loading: renders `t('auth.loading')` in a small centred container.
  - On error: renders `t('auth.providersError')` and logs the error via `console.error`.
  - On success: renders an `<h1>` with `t('auth.loginTitle')`, a paragraph with `t('auth.loginDescription')`, and one `<a>` per provider whose `href` is `'/api/v1/auth/login/' + encodeURIComponent(id) + '?callbackUrl=' + encodeURIComponent(callbackUrl)` and whose accessible name is `t('auth.providerButtonLabel', { provider: label })`. Anchor tags MUST NOT be React Router `<Link>`.
  - Layout uses Tailwind utility classes only (no inline styles).
- [x] 5.2 In `apps/chat/src/main.tsx`, swap the slice-4 placeholder for a lazy-loaded import: `const LoginPage = React.lazy(() => import('./pages/auth/Login'))`. The `<Suspense fallback={null}>` from slice 4.3 covers it.
- [x] 5.3 Add `apps/chat/src/pages/auth/Login.spec.tsx`. Cover:
  - 5.3.a Loading state shows the `auth.loading` text (resolved by `getByText` against the translated string).
  - 5.3.b Successful providers fetch renders one anchor per provider with the correct `href`, encoded `callbackUrl`, and accessible name (resolved by `getByRole('link', { name })`).
  - 5.3.c Failed providers fetch renders the `auth.providersError` text and logs an error.
  - 5.3.d Anchors are real `<a>` elements (assert `anchor.tagName === 'A'`) — guards against the regression "someone replaced with `<Link>`".
  - 5.3.e Direct visits to `/login` without `callbackUrl` use `window.location.origin + '/'` as the default callback URL.
- [x] 5.4 Verify the slice: `npm exec nx test chat` and `npm exec nx lint chat`.

## 6. Slice 6 — UserMenu widget in Header

- [x] 6.1 Create `apps/chat/src/components/Header/UserMenu.tsx`. Wrap with `React.memo` and export as a named export plus default of the same name. The component:
  - Calls `useUser()`.
  - Returns `null` when `status !== 'authenticated'`.
  - Otherwise renders a `<button>` (accessible name: `t('auth.signedInAs', { email })`) that toggles a dropdown panel.
  - Dropdown contains an inline `<form method="POST" action="/api/v1/auth/logout">` with a submit `<button>` whose label is `t('auth.signOut')`.
  - Icon for the trigger button uses `@tabler/icons-react` (e.g. `IconUserCircle`).
  - All layout via Tailwind utilities; no inline styles. Use `clsx` for any conditional classes.
- [x] 6.2 Update `apps/chat/src/components/Header/Header.tsx` to render `<UserMenu />` on the right side of the existing flex container. Adjust the `<header>` Tailwind classes minimally to accommodate the new child without regressing the existing centred `<Logo />` alignment.
- [x] 6.3 Add `apps/chat/src/components/Header/tests/UserMenu.spec.tsx`. Cover:
  - 6.3.a Returns `null` when `status='loading'`.
  - 6.3.b Returns `null` when `status='unauthenticated'`.
  - 6.3.c When authenticated with `claims.email = 'u@x.io'`, the trigger button is resolvable by `getByRole('button', { name: /u@x\.io/ })`.
  - 6.3.d Clicking the trigger reveals the sign-out form (`getByRole('form')` or a role-equivalent query) whose `method` attribute is `'post'` and `action` attribute is `'/api/v1/auth/logout'`.
  - 6.3.e The submit button is resolvable by `getByRole('button', { name: /sign out/i })`.
  - 6.3.f No assertion uses implementation-specific selectors.
- [x] 6.4 Update `apps/chat/src/components/Header/tests/Header.spec.tsx` minimally: add a single test verifying the `<UserMenu />` mount point exists when `<UserProvider>` is mocked with an authenticated user. Existing logo assertions stay intact.
- [x] 6.5 Verify the slice: `npm exec nx test chat` and `npm exec nx lint chat`.

## 7. Final cross-slice verification

- [x] 7.1 Run `npm exec nx test chat` and confirm green.
- [x] 7.2 Run `npm exec nx lint chat` and confirm green.
- [x] 7.3 Run `npm exec nx build chat` to confirm the bundle builds (validates the new lazy chunk for `LoginPage`).
- [x] 7.4 Run `npm exec nx affected --target=lint --base=origin/development` from the workspace root to catch any cross-project regressions in `libs/chat-shared` (the only shared lib touched, via the new `ProviderInfo` type).
- [x] 7.5 Run `npm exec nx affected --target=test --base=origin/development` from the workspace root.
- [x] 7.6 Open `apps/chat-api/AGENTS.md` and confirm that no rule in §1–§13 is violated by this change (sanity check — this change touches `apps/chat` only, but `libs/chat-shared` is shared with the API).

## 8. Out-of-scope notes (record only, no implementation here)

- [ ] 8.1 Document in the PR description that **backend Slice 3** (`auth-bff-encrypted-cookie/tasks.md` §3 — `POST /api/v1/auth/logout`) is required for the `<UserMenu />` Sign-out button to complete successfully; until then the form submits to a pending endpoint.
- [ ] 8.2 Document in the PR description that the BFF global `SessionGuard` + `RefreshService` from Slice 2 are already implemented prerequisites for this frontend change.
- [ ] 8.3 Open a follow-up change `auth-frontend-csrf` once the backend `CsrfGuard` (Slice 5) lands — that change will wire the `X-CSRF-Token` header read from the `/api/v1/auth/me` response into non-GET calls in `server-api/base.ts`.
