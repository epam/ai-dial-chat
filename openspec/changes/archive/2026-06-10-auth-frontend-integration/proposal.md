# Proposal: auth-frontend-integration

## Why

The `auth-bff-encrypted-cookie` change shipped the backend half of the authentication flow (`apps/chat-api/src/auth/*`): OIDC login, callback, encrypted session cookie, `GET /api/v1/auth/me`, global `SessionGuard`, and transparent refresh. The React SPA in `apps/chat` is unaware of any of this — there is no `UserContext`, no bootstrap call to `/api/v1/auth/me`, no UI affordance for sign-in, and no handling for `401` responses from protected endpoints.

Without SPA-side wiring, the encrypted cookie is not exercised by the frontend, the user is silently anonymous, and protected API `401` responses have no recovery path. This change closes that gap.

## What Changes

- Add a `UserProvider` context at `apps/chat/src/context/auth/UserContext.tsx` that loads the current session on app mount via `GET /api/v1/auth/me` and exposes the `UserProfile` (plus loading/auth status) to the rest of the SPA.
- Add a `useUser()` consumer hook that throws when used outside the provider (mirroring `useTheme`).
- Extend `apps/chat/src/server-api/base.ts` with the static auth endpoints (`AUTH_ME`, `AUTH_PROVIDERS`, `AUTH_LOGOUT`), set `credentials: 'include'` on every request, and surface `401` responses as a typed `UnauthorizedError`. Dynamic login URLs remain constructed from the runtime provider id.
- Add a `useAuthRedirect()` hook that, on `401`/`unauthenticated` state, computes the current app URL as an application `callbackUrl`, then performs an automatic `window.location.assign` to `/api/v1/auth/login/<defaultProviderId>?callbackUrl=<encoded-url>` when exactly one provider is registered, or routes to `/login?callbackUrl=<encoded-url>` with a provider picker when multiple are registered.
- Add a lazy-loaded `apps/chat/src/pages/auth/Login.tsx` route (provider picker) and a `<RequireAuth>` wrapper from `apps/chat/src/main.tsx` that gates the main UI behind a resolved session.
- Add a minimal user widget to `apps/chat/src/components/Header/Header.tsx` showing the email/initials and a backend-dependent Sign-out affordance. The form is wired to `POST /api/v1/auth/logout`, which remains pending in `auth-bff-encrypted-cookie` Slice 3.
- Wire `<UserProvider>` into `apps/chat/src/main.tsx` outside `<ThemeProvider>` so theme bootstrap stays independent of auth.
- Add i18n keys under the `auth.*` namespace in `apps/chat/src/i18n/locales/en.json` for every new user-visible string.

## Capabilities

### New Capabilities

- `spa-auth-session`: How the React SPA discovers, displays, and reacts to the BFF session cookie — bootstrap call, unauthenticated redirect, session widget in the header, and global `401` handling for protected API calls.

### Modified Capabilities

<!-- None: no existing capability specs in openspec/specs/ to modify -->

## Impact

- **Scope**: `apps/chat`, plus the already-specified `callbackUrl` contract in `apps/chat-api` (`auth-bff-encrypted-cookie`). The required BFF login, callback, providers, `/me`, global guard, and refresh behaviour already exist in `auth-bff-encrypted-cookie` Slices 1-2.
- **Shared libs**: re-uses the existing `UserProfile` type from `libs/chat-shared/src/models/auth.ts` (shipped in Slice 1) — no new exports.
- **Routing**: introduces a single new route, `/login`, lazy-loaded; the rest of the app remains behind the (new) `<RequireAuth>` gate.
- **i18n**: adds the `auth.*` namespace to `en.json` (new user-visible strings: sign-in / signed-in-as / sign-out / loading / provider-picker copy).
- **Breaking changes**: none for the API; from the SPA user perspective the experience changes from "no auth" to "redirect to IdP on first load" — a UX change that is the entire point of this work.
- **Out of scope** (deferred):
  - Backend Slice 3 (`POST /api/v1/auth/logout`) — the frontend form is intentionally wired now, but successful sign-out is tracked in the existing `auth-bff-encrypted-cookie/tasks.md`.
- **Implemented via `auth-bff-encrypted-cookie` Slice 5** (originally deferred):
  - CSRF token wiring (`X-CSRF-Token` header on non-GET requests) — `GET /api/v1/auth/me` issues the token; frontend stores and sends it on every state-mutating call; rotated tokens from session refresh are captured from response headers.
