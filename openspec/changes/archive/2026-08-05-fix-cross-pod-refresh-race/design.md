## Context

`apps/chat-api` is a stateless BFF (`docs/auth/auth-bff-encrypted-cookie.md`): the entire session (access token, refresh token, expiry, CSRF secret) lives inside one encrypted, `HttpOnly` cookie. There is no Redis or other shared server-side store — any pod can decrypt any cookie, but no pod knows what any other pod is doing with the same `sid` right now. That is a deliberate architectural constraint, not an oversight, and this fix must not introduce one.

`SessionGuard.canActivate` (`apps/chat-api/src/auth/session/session.guard.ts:62-78`) refreshes the access token whenever it is within 60 seconds of expiry, by calling `RefreshService.refresh()` (`apps/chat-api/src/auth/refresh/refresh.service.ts`). That call is not wrapped in `try/catch`. `RefreshService` deduplicates concurrent refreshes only **within the same process** (`inFlight: Map<sid, Promise<SessionPayload>>`, explicitly commented "Per-pod mutex"). When two requests carrying the same not-yet-rotated cookie land on two different pods — a duplicated browser tab's bootstrap call racing the original tab's, or several parallel requests a single tab fires on waking from idle (conversations list, deployments, user-config, all triggered by the same navigation) — each pod independently exchanges the same one-time-use refresh token with the IdP. The loser gets `invalid_grant`, which `RefreshService.doRefresh` (lines 33-37) turns into `UnauthorizedException`, and because nothing catches it in the guard, NestJS returns a normal 401 — but a **semantically wrong** one: the session is, from the winning pod's perspective, still perfectly valid and was just successfully rotated.

On the frontend, `notifyUnauthorized` (`apps/chat/src/server-api/base.ts:57-60`) and the dedicated 401 handling in `UserContext` (`apps/chat/src/context/auth/UserContext.tsx`) treat every 401 — from `bootstrap()` on mount, from the focus/visibility `revalidate()` checkpoint, and from any other API call via the `onUnauthorized` listener — as an unconditional, immediate logout. That is by design for a *genuine* 401 (see `spa-auth-session`'s "401 responses surface as a typed UnauthorizedError and reset the session" and "Session identity revalidation on tab focus/visibility regain" requirements), but it gives a lost-race 401 no chance to resolve itself before tearing down the whole authenticated provider tree (`RequireAuth` in `apps/chat/src/main.tsx`) — which is what produces the "Something went wrong" crash (Case 1: some context hook renders for one frame without its provider) and the duplicate-tab login redirect (Case 2: `useAuthRedirect`'s `sessionStorage`-based attempt de-dup, itself inherited by Chrome's tab-duplication, sends the "logged out" duplicate straight to `/login`).

## Goals / Non-Goals

**Goals:**
- Stop a same-instant refresh-token collision between two pods (or two near-simultaneous requests from the same browser) from producing a false "you are logged out" transition, using only data already available inside the request's own decrypted session payload — no shared cache, no Redis, no cross-pod RPC.
- Guarantee that any genuine refresh failure (revoked/expired refresh token, unreachable IdP, corrupt payload) still results in a clean, typed 401 — never an unhandled exception or a 500.
- Give the frontend one bounded, self-healing check before it commits to invalidating an otherwise-healthy session, so a transient false 401 from any single request doesn't unmount the authenticated app mid-navigation.
- Preserve existing genuine-logout behavior byte-for-byte: an actually revoked/expired session must still redirect to login exactly as it does today, with no added delay beyond one bounded probe.

**Non-Goals:**
- No Redis, external cache, or sticky-session/session-affinity load balancing — the stateless-BFF constraint stands.
- No change to the OIDC flow, cookie shape, chunking, or key-rotation mechanics (`docs/auth/auth-bff-encrypted-cookie.md` §3–§4 unchanged).
- Not a fix for every conceivable idle-tab scenario — a tab idle long enough that its refresh token itself has expired is a genuine logout, and must remain one.
- Not a general-purpose HTTP retry framework for the frontend API layer; the retry introduced here is narrowly scoped to the auth-invalidation decision.

## Decisions

### Decision 1: RefreshService distinguishes a lost-race collision from a genuine revocation using `at_exp` alone

When `client.refresh(payload.rt)` fails with `invalid_grant`, `doRefresh` currently always throws. Instead, it first checks whether the *access token already carried by this same stale payload* is still technically unexpired (`payload.at_exp > now`):

- **If still unexpired** — this is almost certainly a same-instant duplicate exchange of a refresh token that another pod (or an earlier in-flight request on this same pod, if the mutex somehow didn't catch it) already rotated a moment ago. The session is fine; this pod simply lost a race it didn't need to enter. `doRefresh` returns the **original payload unchanged** (same `at`, `at_exp`, `rt`, `iat`) instead of throwing. The guard proceeds exactly as if refresh had "succeeded" with no changes: it re-encrypts and re-writes the same cookie (a harmless no-op) and the request is authorized normally. The *next* request — whether on this pod or another — will read whatever cookie the browser currently holds, which by then almost always already reflects the winning pod's `Set-Cookie` from moments earlier (same-origin fetch responses apply `Set-Cookie` before the calling code observes the response), so it will see a fresh, non-expiring-soon access token and won't attempt to refresh at all.
- **If already expired** (`payload.at_exp <= now`) — there is no fallback: this pod has no evidence the session is still good, so `doRefresh` throws `UnauthorizedException` exactly as today. This is the correct behavior for a tab idle long enough that the access token has fully lapsed and the refresh token was already separately consumed/revoked.

This requires zero new state — `at_exp` is already part of every `SessionPayload`. It resolves the most common real-world trigger (two near-simultaneous requests, from a duplicated tab or from one tab's own parallel navigation calls, both still within the 60-second refresh window) without touching cross-pod visibility at all.

**Alternative considered — widen the per-pod mutex to a distributed lock (Redis, or a sticky-session load balancer).** Rejected outright: contradicts the explicit "no Redis / no external session store" constraint that is this architecture's whole reason for existing (`docs/auth/auth-bff-encrypted-cookie.md` §1). Sticky sessions would also silently reintroduce a dependency on load-balancer configuration that this BFF was specifically designed to avoid.

**Alternative considered — retry the refresh once against the IdP before giving up.** Rejected: `invalid_grant` on a rotated refresh token is not transient: retrying the exact same exchange will fail identically every time, because the IdP has already permanently consumed that refresh token. Only the locally-known `at_exp` tells us anything useful; retrying the IdP call adds latency for no benefit.

### Decision 2: SessionGuard wraps the refresh call so any failure is a clean, typed 401

`SessionGuard.canActivate` (`session.guard.ts:63-64`) currently calls `this.refresh.refresh(payload)` with no `try/catch` around it — unlike the `decryptFromRequest` call three lines above, which already has one. Any error the refresh path throws that is *not* already an `UnauthorizedException` (e.g. an unexpected exception from `ProviderRegistryService.getProvider` for a `providerId` the registry no longer recognizes) would otherwise surface as an unhandled 500 instead of a 401, which is exactly the ambiguous, un-routed failure mode the frontend's `onUnauthorized` handling isn't built to interpret correctly. The guard now wraps the refresh step in the same defensive pattern already used for decryption: catch, log, and rethrow as `UnauthorizedException`.

### Decision 3: Frontend gets one bounded self-heal probe before invalidating an authenticated session

`UserContext` currently has three places that call `invalidateSession()` on any `UnauthorizedError`: `bootstrap()`'s catch block, `revalidate()`'s catch block (focus/visibility), and the general `onUnauthorized` listener (fired by *every* 401 from *any* endpoint via `apps/chat/src/server-api/base.ts`). Each treats the 401 as unconditionally final. A single shared helper, `attemptSessionRecovery()`, is introduced and called from all three sites before they commit to `invalidateSession()`:

```ts
const attemptSessionRecovery = async (): Promise<boolean> => {
  try {
    const profile = await getMe();
    setUser(profile);
    setStatus(AuthStatus.Authenticated);
    return true;
  } catch {
    return false;
  }
};
```

This re-issues `GET /api/v1/auth/me` using whatever cookie the browser currently holds. For a lost-race 401 (the scenario Decision 1 doesn't already absorb — e.g. the access token had *just* ticked over into full expiry at the exact moment of the race, a narrow residual window Decision 1's `at_exp > now` check can miss by a few hundred milliseconds), the browser's cookie jar has, in virtually all realistic timings, already been updated by the winning pod's `Set-Cookie` header by the time this probe fires, so it succeeds and the session is kept alive with no visible interruption. For a genuine logout, the browser's cookie is invalid everywhere, the probe also 401s, and `invalidateSession()` proceeds exactly as it does today — same outcome, one extra round-trip.

This directly targets Case 1 (a request 401s mid-navigation, `RequireAuth` almost unmounts the tree, but the probe recovers the session first) and Case 2 (a duplicated tab's bootstrap 401s, the probe recovers before `useAuthRedirect`'s `sessionStorage`-inherited attempt de-dup ever triggers, because `status` never transitions through `Unauthenticated`).

**Alternative considered — retry the *original* failed request instead of probing `/auth/me`.** Rejected: the `onUnauthorized` listener in `UserContext` has no reference to the request that triggered it (only the URL string, for logging) and no generic way to safely re-issue an arbitrary GET/POST/PUT/DELETE with its original body — building that would be a much larger, riskier change to the shared request layer for marginal benefit over a cheap, always-safe `/auth/me` probe.

**Alternative considered — skip the probe and just increase `useAuthRedirect`'s de-dup TTL awareness.** Rejected as insufficient on its own: it only patches the *symptom* in Case 2 (an unnecessary redirect once already unauthenticated) and does nothing for Case 1, where the crash happens before any redirect logic runs at all.

### Decision 4: `spa-auth-session` requirements are updated, not the backend

There is no existing OpenSpec capability describing `apps/chat-api/src/auth/session/session.guard.ts` / `refresh.service.ts` server-side behavior — the original `auth-bff-encrypted-cookie` change (`openspec/changes/archive/2026-06-09-auth-bff-encrypted-cookie/`) shipped design/proposal/tasks only, with the ground-truth description of that subsystem living in `docs/auth/auth-bff-encrypted-cookie.md` per this repo's documented convention (`AGENTS.md` §Docs: "update that doc ... in the same commit" whenever behavior it describes changes). This change follows that same convention: the backend decisions above are reflected as a doc update to `docs/auth/auth-bff-encrypted-cookie.md` (a new bullet under §7 Security Checklist or a short new subsection under §5.2, describing the lost-race/at_exp distinction), not as a new OpenSpec capability invented to match this one fix. The frontend-observable contract change (401 handling, revalidation behavior) *is* already spec'd under `spa-auth-session`, so that capability's delta carries the frontend-facing requirement changes.

## Risks / Trade-offs

- **[Risk]** Decision 1's fallback (returning the unchanged payload) means a losing pod's response carries a cookie whose `at_exp` is still within the near-expiry window — if that exact pod happens to serve the *next* request too before the browser's cookie updates from elsewhere, it will attempt another refresh and could lose the race again. → **Mitigation**: each additional attempt is equally harmless (same fallback applies again) and cheap (no IdP round-trip on the fallback path); in practice the winning pod's `Set-Cookie` lands in the browser within one response cycle, so this self-corrects on the very next request in virtually all cases.
- **[Risk]** Decision 3's probe adds one extra `GET /api/v1/auth/me` round-trip to every 401, including genuine ones — a small latency cost on an already-rare, already-slow (redirect-bound) path. → **Mitigation**: this only runs when a 401 is about to invalidate an *already-authenticated* session (never on the very first unauthenticated bootstrap, where there is nothing to recover), and a genuine logout was already about to incur a full-page IdP redirect, so one extra same-origin request is immaterial next to that.
- **[Risk]** If `getMe()` itself is the request that originally 401'd (the `revalidate()` checkpoint), the probe re-issues the *same* call. → **Mitigation**: that is exactly the intended behavior — it re-tests the current cookie a moment later, which is precisely when a race-loser's cookie has had time to catch up; it is not a duplicate no-op.
- **[Trade-off]** This does not eliminate every theoretical false-401 window (e.g. an access token that expires at the exact same instant across two pods with zero clock skew and zero network delay between the winning `Set-Cookie` and the losing request) — it reduces the window to a near-zero-probability edge case rather than proving it away entirely, which is the best achievable outcome without shared state.

## Migration Plan

Backend and frontend ship together (the frontend probe is defense-in-depth; the backend fix removes most false 401s at the source, so shipping the backend half alone is safe but incomplete). No data migration, no cookie shape change, no feature flag needed — both are pure bug fixes to existing control flow. Rollback is a plain revert of both halves.
