# Design: auth-frontend-integration

## Context

The BFF authentication layer in `apps/chat-api/src/auth/*` (shipped in `auth-bff-encrypted-cookie` Slices 1-2) is functional from the server's perspective:

- `GET /api/v1/auth/providers` returns the configured provider list.
- `GET /api/v1/auth/login/:providerId?callbackUrl=<app-url>` starts the OIDC Authorization Code + PKCE flow and remembers the validated app landing URL in the encrypted transaction cookie.
- `GET /api/v1/auth/callback/:providerId` exchanges the code, sets the encrypted `__Host-chat.sess` cookie, and redirects to the validated `callbackUrl`.
- `GET /api/v1/auth/me` is protected by the global `SessionGuard` and returns the `UserProfile` from the decrypted cookie.
- The global `SessionGuard` protects non-public API routes and transparently refreshes near-expired access tokens.

The SPA at `apps/chat` does not know any of this. Its entry tree is `<StrictMode> → <BrowserRouter> → <ThemeProvider> → <App />`. There is exactly one context provider (`ThemeContext`), one server-api helper module (`server-api/base.ts`) that calls `fetch` without `credentials`, and no UI that mentions the user. The single visible page is `apps/chat/src/app/app.tsx` — a chat with `ConversationInput` / `ConversationView`.

This design wires the SPA so that:

1. On every cold load, the app first asks the BFF "who am I?" via `GET /api/v1/auth/me`.
2. If the BFF says `401`, the browser is redirected (or shown a picker) to log in via the BFF login endpoint.
3. Once authenticated, the user's identity is available everywhere via a `useUser()` hook.
4. The header shows the authenticated user's identity and a backend-dependent sign-out affordance.
5. Any subsequent `401` from a protected endpoint resets the session state and re-triggers the login flow.

The frontend conventions to follow are codified in `openspec/config.yaml` and exemplified by `apps/chat/src/context/ThemeContext.tsx`, `apps/chat/src/hooks/useFavicon.ts`, and `apps/chat/src/server-api/base.ts`. The backend conventions in `apps/chat-api/AGENTS.md` are out of scope for this change — there are no NestJS modifications.

## Goals / Non-Goals

**Goals:**

- Bootstrap the user session on app mount via a single `GET /api/v1/auth/me` call and expose the resulting `UserProfile` through a `UserContext` consumer hook.
- Auto-redirect to the BFF login endpoint on `401`, with a `/login` page fallback when multiple providers are registered, while preserving the current app URL in an application `callbackUrl` query parameter.
- Send cookies (`credentials: 'include'`) on every SPA `fetch` so the encrypted session cookie reaches the BFF on every API call.
- Surface protected-endpoint `401`s as a typed `UnauthorizedError` and let `UserContext` reset state in response — one canonical recovery path for the whole app.
- Add a minimal signed-in-as / backend-dependent sign-out UI in `Header.tsx` using existing design-system primitives.

**Non-Goals:**

- No CSRF token wiring (`X-CSRF-Token` header). Lands together with backend `CsrfGuard` in a future change.
- No backend changes except relying on the `callbackUrl` contract from `auth-bff-encrypted-cookie`. `APP_GUARD` and `RefreshService` are already implemented in Slice 2; `POST /api/v1/auth/logout` remains tracked in backend Slice 3.
- No new external dependencies (no `react-query`, no `swr`, no auth library).
- No new global state-management library — strictly React Context, mirroring `ThemeContext`.
- No changes to protection of `apps/chat-api` endpoints — the global `SessionGuard` already owns that behaviour.

## Decisions

### D1 — State ownership: a new `UserContext`, mirroring `ThemeContext`

A new `UserContext` lives at `apps/chat/src/context/auth/UserContext.tsx` and follows the exact pattern of `apps/chat/src/context/ThemeContext.tsx`:

- `createContext<UserContextType | undefined>(undefined)`.
- Provider performs the bootstrap fetch inside `useEffect` with a `cancelled` flag.
- The context value is wrapped in `useMemo` to prevent unnecessary consumer re-renders.
- A consumer hook `useUser()` throws a clear error when used outside the provider.

The exposed shape is:

```ts
type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface UserContextType {
  status: AuthStatus;
  user: UserProfile | null;
  refresh: () => Promise<void>;
  reset: () => void; // called by the API layer on a global 401
}
```

`UserProfile` is the shared interface already exported from `libs/chat-shared/src/models/auth.ts` — no new shared types are introduced.

_Alternatives considered:_

- **Redux / Zustand**: rejected. There is no existing store in `apps/chat`; introducing one only for auth contradicts the "React Context + custom hooks" rule in `openspec/config.yaml`.
- **`@tanstack/react-query`**: rejected for the same reason — adds a dependency for a single fetch.
- **Hook-only (no Provider)**: rejected. Multiple components (header, gate, login page) need the same state; a Provider is the idiomatic React 19 answer.

### D2 — Bootstrap location: `<UserProvider>` in `main.tsx`, outside `<ThemeProvider>`

`apps/chat/src/main.tsx` becomes:

```tsx
<BrowserRouter>
  <UserProvider>
    <ThemeProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="*"
          element={
            <RequireAuth>
              <App />
            </RequireAuth>
          }
        />
      </Routes>
    </ThemeProvider>
  </UserProvider>
</BrowserRouter>
```

Rationale:

- Theme bootstrap (`GET /api/themes`) does **not** require an authenticated session today and stays accessible to the public `/login` page.
- Routing exists already (`BrowserRouter`) but no `<Routes>` is declared yet. Adding `<Routes>` here is the minimal step that lets `/login` exist as a distinct route while every other path stays under `<RequireAuth>`.
- `UserProvider` sitting at the outermost layer means `useUser()` is available on the `/login` page too, which lets it auto-redirect to the same-origin `callbackUrl` path, or `/` when no callback is present, if an already-authenticated user lands on `/login` (e.g. via a stale tab).

_Alternative considered:_ keep everything in `app.tsx` without routing. Rejected — we would need an ad-hoc state machine inside `App` to switch between `<LoginPicker />` and the chat UI, and that complicates the existing `lazy` setup with `Suspense`.

### D3 — Unauthenticated redirect policy

`apps/chat/src/hooks/auth/useAuthRedirect.ts` is a new hook that consumes `useUser()` and, outside `/login`, the `GET /api/v1/auth/providers` response. It centralises the redirect rule for protected routes while leaving the `/login` page as the owner of provider-list rendering:

- Before any unauthenticated redirect, compute `callbackUrl` from the current browser URL (`window.location.href`) so the BFF can return the user to the same SPA origin and page after authentication. This must include pathname, search, and hash.
- If `status === 'unauthenticated'` **and** the providers list has length `1`: `window.location.assign('/api/v1/auth/login/<id>?callbackUrl=<encoded-current-url>')`. This is a real browser navigation, not React Router — the next response is a `302` from the BFF and must replace the document.
- If `status === 'unauthenticated'` **and** the providers list has length `> 1`: `navigate('/login?callbackUrl=<encoded-current-url>', { replace: true })`. The login page shows one button per provider and forwards the same callback URL to the selected BFF login link.
- If `status === 'authenticated'` and the current path is `/login`: if a same-origin `callbackUrl` query parameter exists, navigate to that URL's path/search/hash; otherwise `navigate('/', { replace: true })`.
- If `status === 'loading'`: render nothing (or a tiny "Checking your session…" splash — see D8).

`useAuthRedirect()` is called from `<RequireAuth>` and from `<LoginPage>` so both code paths agree on the authenticated-on-login redirect. On `/login`, the hook MUST NOT fetch providers or perform unauthenticated provider redirects; that avoids a duplicate `/auth/providers` request because `<LoginPage>` fetches the list itself.

_Alternative considered:_ always show a login picker even for a single provider. Rejected — the user picked `auto_redirect` in the proposal questions, and a one-button picker is poor UX.

### D4 — Global `401` handling: a typed `UnauthorizedError` from the API helper

`apps/chat/src/server-api/base.ts` already centralises every API call. We extend it minimally:

```ts
export class UnauthorizedError extends Error {
  readonly status = 401 as const;
  constructor(public readonly url: string) {
    super(`Unauthorized: ${url}`);
    this.name = 'UnauthorizedError';
  }
}
```

In `request()`:

- Add `credentials: 'include'` to the `fetch` options. Same-origin via the Vite proxy is the dev case, cross-origin via `CORS_ORIGIN` is the prod case; `'include'` covers both.
- On `response.status === 401`: throw `new UnauthorizedError(url)` **instead of** the generic `Error`.
- All other non-OK statuses keep the current behaviour (`Error('Request failed…')`).

The API consumer pattern for non-bootstrap calls becomes:

```ts
try {
  const data = await get<T>(url);
  …
} catch (err) {
  if (err instanceof UnauthorizedError) {
    user.reset();      // from useUser()
    return;
  }
  throw err;
}
```

To avoid spreading this boilerplate everywhere, the `UserContext` registers a process-wide listener via a tiny module-scoped event emitter inside `server-api/base.ts`:

```ts
type UnauthorizedListener = (url: string) => void;
const listeners = new Set<UnauthorizedListener>();
export const onUnauthorized = (l: UnauthorizedListener) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
// Inside request() on 401:
listeners.forEach((l) => l(url));
throw new UnauthorizedError(url);
```

`UserProvider`'s `useEffect` subscribes once, sets `status = 'unauthenticated'`, and `useAuthRedirect()` does the rest. The listener pattern is intentionally tiny (no `EventEmitter` dependency, no global window event); it is encapsulated to `server-api/base.ts` so the rest of the app keeps treating API errors uniformly.

_Alternatives considered:_

- **Window event (`window.dispatchEvent`)**: rejected — would leak into `e2e/Playwright` setups and require typed CustomEvent.
- **React Router error elements**: rejected — they don't fire for `fetch` errors raised inside `useEffect`.
- **Per-call recovery**: rejected — every consumer of `get`/`post` would need the same `try/catch` block; centralisation in the API layer is the whole point.

### D5 — Sign-out via HTML form, not `fetch`

The eventual `POST /api/v1/auth/logout` (backend Slice 3) ends with a `302 Redirect` to either `/` or the IdP `end_session_endpoint`. A `fetch` call cannot follow a cross-origin redirect to an IdP `end_session_endpoint` (CORS would block it), so the affordance is implemented as a standard HTML `<form method="POST" action="/api/v1/auth/logout">` with a button. The browser navigates the top-level document, the BFF clears the cookie and issues its redirect, the IdP terminates its session, and the browser lands back on the SPA with no session — at which point `<UserProvider>` re-bootstraps and the redirect dance from D3 kicks in.

This means the Sign-out button is wired in this change, but successful logout depends on backend Slice 3. That dependency is documented in the proposal's "Out of scope" section; the wiring is intentionally additive so the eventual backend change requires zero frontend work.

_Alternative considered:_ `fetch(..., { method: 'POST', redirect: 'manual' })` and then read `Location` and `window.location.assign` to it. Rejected — fragile, breaks on CORS to the IdP, requires reading response headers that browsers may strip.

### D6 — Provider picker page: lazy-loaded route at `/login`

`apps/chat/src/pages/auth/Login.tsx` is a small functional component inside the auth domain's `pages/` concern:

1. Calls `get<ProviderInfo[]>(ApiEndpoints.AUTH_PROVIDERS)` once on mount.
2. Reads `callbackUrl` from the route query string. If absent, defaults to the current app root (`window.location.origin + '/'`). The page does not accept or rewrite off-origin values; backend validation remains authoritative.
3. Renders one `<a href="/api/v1/auth/login/<id>?callbackUrl=<encoded-callback-url>">…</a>` per provider — anchor tags, not `react-router` `Link`, because the destination is a BFF route that must trigger a top-level browser navigation to the IdP.
4. While loading: shows a small "Loading providers…" placeholder.
5. On error: surfaces a user-readable message via `t('auth.providersError')`.

The page is `React.lazy`-imported in `main.tsx` to keep the unauthenticated bundle minimal — only the picker is downloaded on the `/login` route. The convention "lazy-load every route component" is mandated by `openspec/config.yaml` design rules.

### D7 — Header user widget

`apps/chat/src/components/Header/Header.tsx` currently just renders the logo. We add a right-aligned `<UserMenu />` whose two states are:

- `status === 'authenticated'`: avatar / initial circle from `claims.email` + dropdown with "Signed in as <email>" + a "Sign out" button (the form from D5).
- `status === 'unauthenticated' | 'loading'`: nothing (the gate from D3 already redirected).

`<UserMenu />` lives at `apps/chat/src/components/Header/UserMenu.tsx`; `Header` imports the auth-owned widget from there. The icon comes from `@tabler/icons-react` per the project rule "use @tabler/icons-react for all icons".

### D8 — Loading state: render `null`, not a splash

While `status === 'loading'`, `<RequireAuth>` renders `null`. Rationale: the bootstrap fetch is single-digit milliseconds on the LAN dev setup, single-digit-hundreds in prod; a flashing "Checking session…" splash creates more visual churn than it solves. The existing `Suspense` fallback in `app.tsx` ("Loading…") still handles the chunk-loading flash for `<ConversationView>` once auth resolves.

`<LoginPage>` uses the `auth.loading` key while its own provider-list fetch is in flight, because the user is already on the explicit login route and needs page-level feedback.

### D9 — i18n keys (auth.\*)

New keys under `apps/chat/src/i18n/locales/en.json`:

```json
{
  "auth": {
    "signOut": "Sign out",
    "signedInAs": "Signed in as {{email}}",
    "loading": "Checking your session…",
    "loginTitle": "Sign in to continue",
    "loginDescription": "Choose your identity provider",
    "providerButtonLabel": "Sign in with {{provider}}",
    "providersError": "Could not load identity providers. Please retry.",
    "userMenuLabel": "User menu"
  }
}
```

Key format follows the project rule `auth.<element>`.

### D10 — Vite proxy and `credentials: 'include'`

The Vite proxy in `apps/chat/vite.config.mts` already forwards `/api → http://localhost:5000`. From the browser's perspective every API call is same-origin (`http://localhost:4207`), so cookies are sent regardless of `credentials`. We still set `credentials: 'include'` explicitly in `request()` so:

- Cross-origin prod deployments (where the API may live at `api.example.com`) work without further code changes — only `CORS_ORIGIN` + `Access-Control-Allow-Credentials: true` on the BFF (already configured in `apps/chat-api/src/main.ts`).
- The intent is documented in code, not hidden in dev-proxy magic.

## Risks / Trade-offs

| Risk                                                                                                                                                                       | Mitigation                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sign-out endpoint pending until backend Slice 3:** the button is wired before the BFF endpoint exists.                                                                   | Document the backend dependency in the PR. The wiring is additive — when Slice 3 ships, no frontend change is needed.                                                                                                                                      |
| **Refresh-token expiry while SPA is open:** backend Slice 2 already provides transparent refresh, but refresh can still fail after refresh-token expiry or IdP revocation. | The `UnauthorizedError` listener resets state and `useAuthRedirect()` debounces by checking `status`, so the recovery path is a fresh login rather than a broken UI.                                                                                       |
| **`<RequireAuth>` shows a blank gate during cold load:** if bootstrap takes > 0 ms, the user briefly sees `null` (D8) before either content or the login page paints.      | Acceptable for v1. The explicit `/login` page still shows `auth.loading` while its provider-list request is in flight.                                                                                                                                     |
| **CORS and `credentials: 'include'`:** an accidental `Access-Control-Allow-Origin: *` on the BFF would block the cookie.                                                   | Already handled in `apps/chat-api/src/main.ts` (`origin: process.env.CORS_ORIGIN`, `credentials: true`); covered by the existing backend tests. This change adds no new CORS surface area.                                                                 |
| **i18n keys with `{{email}}` and `{{provider}}` interpolation:** typos in keys silently produce `undefined` on screen.                                                     | Adding all keys in a single PR-friendly diff and including a Vitest assertion that every key referenced in code exists in `en.json` (a small new test file under `apps/chat/src/i18n/`). Optional polish, not strictly required by `openspec/config.yaml`. |

## Migration Plan

This is an **additive** change: no existing route, context, or component is removed.

1. Ship the API layer change (`credentials: 'include'`, `UnauthorizedError`, `onUnauthorized`) first — purely additive, the existing call sites keep working.
2. Ship `UserContext` + `useUser()` — wired into `main.tsx` but the existing `<App />` does not consume it yet. Verifiable via the bootstrap `GET /api/v1/auth/me` call appearing in DevTools.
3. Ship `useAuthRedirect()` and `<RequireAuth>` — at this point unauthenticated users start being redirected. This is the user-visible breaking moment.
4. Ship `<LoginPage />` route (only matters when ≥ 2 providers; for single-provider deployments the auto-redirect from D3 means this page is never rendered).
5. Ship `<UserMenu />` in `Header`.
6. Update `apps/chat/src/i18n/locales/en.json` in a single batch.

A revert is trivial: removing `<UserProvider>` and `<Routes>` from `main.tsx` puts the app back into "no auth" mode. The new files (`UserContext.tsx`, `useAuthRedirect.ts`, `pages/Login.tsx`, `UserMenu.tsx`) can be deleted without touching any existing component.

## Open Questions

1. **Should `<UserMenu />` show the provider id alongside the email?** (e.g. "u@x.io · keycloak"). Useful for multi-IdP debugging; possibly noisy for end users. Default: hide; expose via a future settings toggle.
2. **Should the bootstrap `GET /api/v1/auth/me` retry on a `5xx`?** A single retry with 500 ms backoff would smooth over transient pod restarts. Default for v1: no retry, surface the error in `<RequireAuth>` and let the user reload. Revisit if observability shows it is common.
3. **Should the frontend allow user-supplied off-origin `callbackUrl` values?** Default: no. The SPA only generates same-origin callback URLs, and the BFF enforces the final allow-list.
