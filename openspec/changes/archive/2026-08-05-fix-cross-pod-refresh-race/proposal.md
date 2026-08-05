## Why

GitHub issue #8150 (Case 1 and Case 2): after a chat tab has been idle for a while, navigating to any menu/section inside the chat intermittently throws a generic "Something went wrong" error page (fixed only by a manual reload). Separately, duplicating a browser tab often redirects the user to the login page instead of opening a working duplicate of the session — even though the original session is still valid.

Root cause (shared by both symptoms): `SessionGuard.canActivate` (`apps/chat-api/src/auth/session/session.guard.ts`) unconditionally calls `RefreshService.refresh()` whenever the access token is within 60 seconds of expiry, with no try/catch around that call. `RefreshService` (`apps/chat-api/src/auth/refresh/refresh.service.ts`) only mutexes concurrent refreshes **per pod** (an in-memory `Map<sid, Promise<SessionPayload>>`), not across replicas — a hard constraint of this app's stateless-BFF architecture, which has no Redis or other shared session store (`docs/auth/auth-bff-encrypted-cookie.md`).

In a multi-replica deployment, two near-simultaneous authenticated requests carrying the same not-yet-refreshed session cookie (e.g. a bootstrap `/auth/me` call from the original tab and from a just-duplicated tab, or several parallel API calls fired by one tab's own navigation) can land on two different pods. Neither pod's in-memory mutex knows about the other's request, so both independently exchange the same one-time-use, provider-rotated refresh token. Whichever exchange lands second gets `invalid_grant` from the IdP, which `RefreshService` turns into an `UnauthorizedException` — and because the guard call site has no try/catch, that becomes an unguarded 401, even though the session is, from the other pod's perspective, perfectly valid and was just refreshed successfully.

On the frontend, `notifyUnauthorized` (`apps/chat/src/server-api/base.ts` / `api-client.ts`) treats every 401 as a genuine logout: `UserContext.invalidateSession()` flips auth status to `Unauthenticated`, and `RequireAuth` (`apps/chat/src/main.tsx`) unmounts the entire authenticated provider subtree in one tick. If this happens mid-navigation, any context hook that briefly renders without its provider mounted (`useDeployments`, `useClientChannel`, etc. in `apps/chat/src/context/*.tsx`) throws synchronously, landing in the nearest error boundary as "Something went wrong" (Case 1). If it happens on a duplicated tab's own bootstrap call, `useAuthRedirect`'s `sessionStorage`-based redirect de-duplication (inherited by Chrome's tab-duplication, which clones `sessionStorage`) can send the duplicate straight to the login picker instead of retrying (Case 2).

## What Changes

- `RefreshService`/`SessionGuard` distinguish a **lost-race rotated-token collision** (the access token was still valid moments ago; the refresh token being rejected is very likely a same-second duplicate exchange, not a genuinely revoked session) from a **genuinely expired/revoked** refresh token, without requiring any external session store or shared cache — the constraint from `docs/auth/auth-bff-encrypted-cookie.md` stays intact.
- `SessionGuard`'s call to `RefreshService.refresh()` is wrapped so a refresh failure always produces a clean, typed 401 response rather than an unhandled/ambiguous failure path.
- The frontend gains a bounded, one-shot recovery path for a 401 encountered during an otherwise-healthy session, instead of immediately treating every single 401 as a hard logout — so a lost-race collision on one request doesn't tear down the whole authenticated provider tree mid-navigation.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `spa-auth-session`: add requirements for how the frontend responds to a 401 that arrives while the session was otherwise healthy (bounded retry against the freshest cookie before invalidating), and for how the auth-redirect de-duplication interacts with a duplicated browser tab's inherited `sessionStorage`.

## Impact

- `apps/chat-api/src/auth/session/session.guard.ts` — guarded refresh call, typed error handling.
- `apps/chat-api/src/auth/refresh/refresh.service.ts` — race-aware handling of a rejected refresh token.
- `apps/chat/src/context/auth/UserContext.tsx` — 401 handling before invalidating session.
- `apps/chat/src/hooks/auth/useAuthRedirect.ts` — redirect de-duplication behavior for duplicated tabs.
- No new external dependency (no Redis/shared cache introduced); no change to the cookie shape or OIDC flow.
