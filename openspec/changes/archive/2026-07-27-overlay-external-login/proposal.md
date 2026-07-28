## Why

When `dial-overlay-ng` (or the `/overlay-sandbox/` test surface) embeds the chat as an iframe and the user is not already authenticated, the app currently starts the normal OIDC redirect inside the iframe. Microsoft's login pages send `X-Frame-Options: deny`, so the iframe cannot render the IdP page and login silently fails, leaving the overlay stuck. The regular top-level `dial-ng` chat is unaffected because it isn't framed, but overlay users have no way to authenticate at all today.

## What Changes

- `useAuthRedirect` gains an optional `disabled` flag. When set, it performs none of its side effects (no provider fetch, no `window.location.assign`, no `navigate('/login?...')`) instead of just skipping the terminal redirect call.
- `RequireAuth` detects overlay mode via `useOptionalOverlay()` and passes `disabled: Boolean(overlay)` to `useAuthRedirect`, so an unauthenticated overlay iframe never attempts the automatic top-level/IdP redirect.
- In overlay mode, an unauthenticated session now renders a manual login gate (a focusable "Log in" action) instead of the loader-only presentation described in `chat-overlay-app-mode`.
- The login gate opens the existing `/login?callbackUrl=<overlay-close-url>` flow in a new browser tab/window; after the BFF callback sets cookies, the auth tab lands on `/overlay-close` and closes itself.
- The overlay iframe polls `UserContext.refresh({ setLoading: false })`, which calls the BFF current-user endpoint, until the newly established cookie is observable from the iframe. It then closes the external auth window best-effort and renders protected content without reloading the iframe or losing overlay state.
- Tab/window blocked cases keep the login gate visible with a retryable error. Long-running login attempts continue polling, but after 2 minutes the gate shows a retryable "taking longer" message and slows the poll interval.
- Secure overlay embedding emits auth cookies with `SameSite=None; Secure` so the iframe can send the session established by the external auth tab/window; non-overlay/default auth keeps `SameSite=Lax`.
- No changes to `libs/chat-overlay`'s public API, the `libs/chat-shared` overlay protocol, or any backend endpoint. The regular (non-overlay) `dial-ng` auth redirect flow is unchanged.

## Capabilities

### New Capabilities

- `overlay-external-login`: the overlay-only login gate and the external auth tab/window flow that confirms completion through iframe-side current-user polling after the auth tab returns to `/overlay-close`.

### Modified Capabilities

- `spa-auth-session`: `useAuthRedirect` adds an optional `disabled` flag that fully suppresses the automatic-redirect requirement (provider fetch, single-provider `window.location.assign`, multi-provider `navigate`) for the caller that sets it; behavior is unchanged when the flag is omitted or `false`.
- `chat-overlay-app-mode`: replaces the existing "loader stays up until `READY`" unauthenticated presentation with the overlay login gate described in `overlay-external-login` when the bootstrap session is unauthenticated.

## Impact

- Affected code: `apps/chat/src/hooks/auth/useAuthRedirect.ts`, `apps/chat/src/hooks/auth/useOverlayExternalLogin.ts`, `apps/chat/src/components/RequireAuth/RequireAuth.tsx`, `apps/chat/src/components/OverlayLoginGate/`, `apps/chat/src/pages/auth/OverlayClose.tsx`, `apps/chat/src/context/auth/UserContext.tsx`, `apps/chat/src/server-api/auth.api.ts`, `apps/chat/src/i18n/locales/en.json`, and `apps/chat-api/src/auth/cookies/cookie-options.ts`.
- Backend endpoints remain unchanged; existing `GET /api/v1/auth/login/:providerId` and `GET /api/v1/auth/callback/:providerId` endpoints and `resolveCallbackUrl` same-origin validation are reused as-is. Backend cookie attributes change only for secure overlay embedding.
- No changes to `libs/chat-overlay` or `libs/chat-shared`.
- Docs: `docs/auth/auth-bff-encrypted-cookie.md` gets an update describing the overlay external-login behavior.
