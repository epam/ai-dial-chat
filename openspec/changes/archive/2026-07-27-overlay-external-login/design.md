## Context

`RequireAuth` (`apps/chat/src/components/RequireAuth/RequireAuth.tsx`) is the single auth gate for the app: it calls `useAuthRedirect()` unconditionally and renders `null` for any non-authenticated status. `useAuthRedirect` (`apps/chat/src/hooks/auth/useAuthRedirect.ts`) owns the normal unauthenticated redirect policy: single-provider `window.location.assign` to the BFF login endpoint, multi-provider `navigate('/login?...')`, and a session-storage-backed "recent attempt" guard that prevents redirect loops.

`OverlayModeGate` (`apps/chat/src/context/overlay/OverlayContext.tsx`) mounts `OverlayProvider` only when overlay mode is eligible (config flag + actually framed + origin checks), and it wraps `RequireAuth` in `main.tsx`. `useOptionalOverlay()` returns `undefined` outside overlay mode and a defined context value inside it, so its presence is already the app's overlay-mode signal.

The BFF OIDC flow (`apps/chat-api/src/auth/auth.controller.ts`) already accepts a same-origin `callbackUrl` and redirects there after `GET /api/v1/auth/callback/:providerId` sets the encrypted session cookie. A new backend endpoint is not needed.

The problem: when this flow runs inside the overlay iframe, `window.location.assign`/`navigate` sends the iframe to the IdP, and Microsoft's `X-Frame-Options: deny` blocks the IdP page from rendering there. The fix keeps the normal top-level app flow unchanged while giving overlay mode a user-triggered external auth path.

## Goals / Non-Goals

**Goals:**

- Suppress `useAuthRedirect`'s automatic side effects for exactly one caller: overlay-mode `RequireAuth`.
- Let the overlay iframe open the existing login flow in a top-level browser tab/window.
- Keep the overlay auth completion logic close to the legacy chat behavior: use iframe-side current-user polling through `UserContext.refresh({ setLoading: false })` to detect when the external-auth session cookie is usable by the iframe and update the app session state in one step.
- Let secure cross-site overlay iframes send the session cookie established by the external auth tab/window.
- Avoid new backend endpoints, `libs/chat-overlay` protocol changes, and `libs/chat-shared` protocol changes.

**Non-Goals:**

- Getting any IdP to render inside an iframe: impossible, the browser enforces the IdP's own frame-ancestors/X-Frame-Options.
- Reintroducing the old chat's `signInOptions` protocol (host-selected provider, explicit token login, validation email).
- Guaranteeing the external auth tab/window lifecycle after IdP navigation. Some providers apply COOP or other isolation headers that can make `WindowProxy.closed` and `location` observations unreliable, so completion is driven by the iframe's own BFF session check.

## Decisions

### D1: `useAuthRedirect({ disabled })` flag

Add an optional `options: { disabled?: boolean }` parameter to the existing hook. Existing callers keep calling `useAuthRedirect()` with no argument, so their behavior is unchanged. When `disabled` is `true`, the effect returns before provider fetch, session-storage loop guard updates, `navigate`, or `window.location.assign`.

`RequireAuth` always calls the hook, but passes `disabled: Boolean(overlay)`. This respects React hook rules and keeps the non-overlay auth path unchanged.

### D1.1: Defer framed rendering while app config is still loading

`OverlayModeGate` depends on app config to know whether overlay mode is enabled. In a framed local sandbox, auth bootstrap can resolve to `Unauthenticated` before app config resolves. Rendering `RequireAuth` during that transient state would make `useOptionalOverlay()` return `undefined`, so the normal redirect could start inside the iframe before overlay eligibility is known. To avoid that race without changing top-level behavior, `OverlayModeGate` renders `null` while the window is framed and app config is still loading.

### D2: External tab/window + iframe-side sequential session polling

The overlay login gate opens `/login?callbackUrl=<origin>/overlay-close` with `window.open(..., '_blank')`. Browser preferences then decide whether this appears as a tab or a separate window. The auth window starts at a same-origin route, then can navigate to the external IdP, then returns to the same-origin `/overlay-close` route after the BFF callback sets cookies. That route immediately calls `window.close()` and renders no UI.

While the auth window is open, the iframe polls through `useUser().refresh({ setLoading: false })`, whose frontend API path calls `GET /api/v1/auth/me`. This is the authoritative completion signal because it proves the cookie established by the external auth tab/window is actually sent from the iframe context, including cross-site overlay deployments that require `SameSite=None; Secure`. On success, that same refresh updates `UserContext`, the hook closes the auth window best-effort, and protected overlay content renders without an iframe reload.

The first poll is scheduled only after one full 5 second interval. Each following poll is scheduled only after the previous refresh settles, so slow `/auth/me` responses cannot create concurrent polling requests. The hook does not use a hard authentication timeout: after 2 minutes it switches to a retryable `takingLonger` state and schedules later polls every 15 seconds, but it keeps polling until success, retry, or unmount. IdP COOP headers can sever or distort the opener relationship, so the hook does not rely on `authWindow.closed` after entering the waiting state.

This is intentionally simpler than a dedicated auth callback route plus `BroadcastChannel`/`localStorage` handshakes and matches the old chat's reliable completion signal: "the iframe can see an authenticated `/auth/me` response."

### D3: Where external auth state lives

`useOverlayExternalLogin` (`apps/chat/src/hooks/auth/useOverlayExternalLogin.ts`) owns the transient external auth attempt (`idle | opening | waiting | blocked | takingLonger`), the opened window reference, one current-user poll timeout, and one long-wait timer. It is invoked only by `OverlayLoginGate`, not by `OverlayContext`, because overlay host messaging is unrelated to re-authentication. `UserContext.refresh({ setLoading: false })` is the narrow app-level adapter that lets this overlay-only hook poll and update the authenticated user without briefly replacing the gate with the global loading presentation.

### D4: Overlay-capable deployments use `SameSite=None; Secure`

Current-user polling still cannot authenticate the iframe if the browser never sends the BFF session cookie from that iframe. The normal BFF cookie policy remains `SameSite=Lax`, but when `OVERLAY_ENABLED=true`, `ALLOWED_IFRAME_ORIGINS` is non-empty, and secure cookies are enabled, `getCookieOptions()` emits `SameSite=None; Secure`.

For local HTTP testing, use `AUTH_COOKIE_SECURE=false`. That exercises the same-site localhost overlay sandbox with `SameSite=Lax`. A true cross-site overlay cookie scenario must be tested over HTTPS.

## Risks / Trade-offs

- **Auth tab/window blocked by the browser** -> Mitigation: `window.open` is called synchronously in the click handler; blocked opens surface a retryable `blocked` state.
- **User closes auth tab/window before login completes** -> Mitigation: the iframe-side current-user poll remains the authoritative signal; after 2 minutes the gate exposes a retry action while polling continues at a slower cadence.
- **IdP COOP severs or distorts the opener window reference** -> Mitigation: completion does not depend on reading auth-window URL or `closed`; the iframe-side refresh response is authoritative.
- **External auth establishes a session that the iframe cannot send** -> Mitigation: secure cross-site overlay embedding uses `SameSite=None; Secure`; local insecure testing keeps `SameSite=Lax` and should use same-site localhost URLs.
- **Slow current-user responses create request bursts** -> Mitigation: polling is sequential; the next timer starts only after the previous refresh settles, and long-running attempts back off from 5 seconds to 15 seconds.

## Migration Plan

No data migration. Rollout is additive and reversible:

1. Ship `useAuthRedirect`'s `disabled` option first; default behavior remains unchanged.
2. Wire `RequireAuth` to pass `disabled: Boolean(overlay)` and render the login gate.
3. Use the external auth tab/window flow, return the auth tab to `/overlay-close`, and let the iframe poll `/auth/me` until the externally established session is usable.
4. Enable the overlay cookie policy for secure cross-site deployments; verify `Set-Cookie` includes `SameSite=None; Secure` and iframe `/auth/me` sends the session cookie.

Rollback: stop passing `disabled` and stop rendering the gate to restore the previous overlay behavior. If the cookie policy causes a deployment issue, disable overlay embedding or remove iframe origins while investigating; cross-site overlay auth will not work until `SameSite=None; Secure` is restored.

## Open Questions

- Single-provider optimization: always show the `/login` picker from the external auth tab/window, or open `/api/v1/auth/login/:providerId` directly when there is exactly one provider? Current implementation uses `/login` for parity with the normal provider picker.
