# Spec: overlay-external-login

## ADDED Requirements

### Requirement: Overlay login gate renders when unauthenticated in overlay mode

When `RequireAuth` is mounted in overlay mode (`useOptionalOverlay()` returns a defined value) and `status === AuthStatus.Unauthenticated`, it SHALL render `OverlayLoginGate` (`apps/chat/src/components/OverlayLoginGate/OverlayLoginGate.tsx`) instead of `null`.

The gate SHALL render a centered, direction-agnostic vertical layout containing a title, a short description, and one focusable "Log in" action built from the `PrimaryButton` wrapper from `@epam/ai-dial-kit`, never a raw `<button>`.

i18n keys: `auth.overlayLoginTitle`, `auth.overlayLoginDescription`; the button label reuses the existing `buttons.logIn` key.

RTL: the layout uses logical Tailwind spacing utilities only; no directional icon is required.

Accessibility: the "Log in" button is keyboard-focusable and reachable via Tab; it is disabled while an auth window attempt is `opening` or `waiting`. The container exposes `aria-busy="true"` while an auth window attempt is `opening`, `waiting`, or `takingLonger`.

#### Scenario: Gate renders for unauthenticated overlay session

- **WHEN** `RequireAuth` is mounted with `useOptionalOverlay()` defined and `status === AuthStatus.Unauthenticated`
- **THEN** `OverlayLoginGate` renders with a focusable "Log in" button labelled via the `buttons.logIn` i18n key

#### Scenario: Gate does not render outside overlay mode

- **WHEN** `RequireAuth` is mounted with `useOptionalOverlay()` returning `undefined` and `status === AuthStatus.Unauthenticated`
- **THEN** `RequireAuth` renders `null`, matching existing non-overlay behavior

#### Scenario: Login button disabled while an auth attempt is starting or in the initial wait

- **WHEN** the user has clicked "Log in" and the external auth state is `opening` or `waiting`
- **THEN** the "Log in" button is disabled and its container exposes `aria-busy="true"`

---

### Requirement: `useOverlayExternalLogin` opens auth outside the iframe

`useOverlayExternalLogin` (`apps/chat/src/hooks/auth/useOverlayExternalLogin.ts`) SHALL expose a lifecycle state of exactly one of `idle | opening | waiting | blocked | takingLonger`, and an `openLogin()` action.

On `openLogin()`, the hook SHALL synchronously, without awaiting before `window.open`:

1. Build a login target `/login?callbackUrl=<encoded-overlay-close-url>`, where `overlay-close-url` is `${window.location.origin}/overlay-close`.
2. Call `window.open(target, '_blank')`.
3. If the returned window handle is `null`/`undefined`, or is immediately observed as closed, set state to `blocked`.
4. Otherwise set state to `waiting`, clear `window.opener` on the opened window best-effort, start one sequential current-user poll timer no coarser than 5000ms, and start one long-wait timer no longer than 120 seconds.

The first current-user poll MUST NOT run before one full poll interval has elapsed. Each next poll MUST be scheduled only after the previous poll settles, so at most one auth poll is in flight per attempt. When the long-wait timer elapses before an authenticated refresh result, the hook SHALL set state to `takingLonger`, keep polling, and schedule later polls no coarser than every 15000ms. Every previous attempt's poll timer and long-wait timer MUST be torn down before a new `openLogin()` call starts a new one, and MUST be torn down on hook unmount.

#### Scenario: Successful synchronous auth tab open transitions to waiting

- **WHEN** `openLogin()` is called and `window.open` returns a non-null window reference
- **THEN** the hook state becomes `waiting`
- **AND** the opened target is `/login?callbackUrl=<overlay-close-url>`
- **AND** the target window name is `_blank`

#### Scenario: Blocked auth tab surfaces immediately

- **WHEN** `openLogin()` is called and `window.open` returns `null`
- **THEN** the hook state becomes `blocked` without entering `waiting`

#### Scenario: Re-opening tears down the previous attempt

- **WHEN** `openLogin()` is called again while a previous attempt's poll timer or long-wait timer is still active
- **THEN** the previous attempt's poll timer and long-wait timer are cleared before the new attempt starts

#### Scenario: Unmount cleans up all resources

- **WHEN** the component using `useOverlayExternalLogin` unmounts while an auth attempt is `waiting`
- **THEN** the poll timer and long-wait timer are cleared

---

### Requirement: Current-user polling completes external overlay login

While the external auth tab/window is open, the overlay iframe SHALL poll `GET /api/v1/auth/me` through `useUser().refresh({ setLoading: false })`. An authenticated refresh result is the authoritative completion signal because it proves the externally established session cookie is now sent from the iframe context and updates `UserContext` in the same operation. When that poll returns `authenticated`, the hook SHALL close the opened window best-effort so protected overlay content renders without replacing the login gate with the global loading presentation.

If `refresh({ setLoading: false })` rejects or returns an unauthenticated status, the hook SHALL keep polling until a later authenticated refresh result, a retry starts a new attempt, or the hook unmounts. The hook SHALL NOT rely on `authWindow.closed` after entering the waiting state because provider COOP headers can make that signal unreliable. The hook SHALL NOT stop polling only because the long-wait timer elapsed.

No token, session identifier, or other credential MAY be included in the opened URL beyond the same-origin `callbackUrl`.

#### Scenario: Successful login refreshes the overlay session in place

- **WHEN** the BFF callback sets the auth cookie and redirects the external auth window to `/overlay-close`
- **AND** the overlay iframe's `refresh({ setLoading: false })` poll returns `authenticated`
- **THEN** the hook closes the external auth window best-effort
- **AND** does not reload the iframe

#### Scenario: Polling is not concurrent

- **WHEN** a current-user refresh poll is still pending
- **THEN** the hook does not start another current-user refresh poll

#### Scenario: Long wait before authenticated current-user response

- **WHEN** the long-wait timer elapses before `GET /api/v1/auth/me` returns an authenticated profile in the iframe
- **THEN** the hook state becomes `takingLonger`, the auth window is left open, the login gate shows a retryable long-wait message, and polling continues with the slower interval

---

### Requirement: Blocked and long-running states are retryable and announced

When the hook state is `blocked` or `takingLonger`, `OverlayLoginGate` SHALL render a localized, retryable message associated with an `aria-live="polite"` region, or `role="alert"` for the blocked-window case, and SHALL re-enable the "Log in" button so the user can call `openLogin()` again.

i18n keys: `auth.overlayExternalLoginBlocked` (shown when state is `blocked`), `auth.overlayLoginTakingLonger` (shown when state is `takingLonger`).

#### Scenario: Blocked auth tab shows an alert with retry

- **WHEN** the hook state is `blocked`
- **THEN** `OverlayLoginGate` renders the `auth.overlayExternalLoginBlocked` message inside a `role="alert"` region, and the "Log in" button is enabled

#### Scenario: Long-running attempt shows a polite live-region message with retry

- **WHEN** the hook state is `takingLonger`
- **THEN** `OverlayLoginGate` renders the `auth.overlayLoginTakingLonger` message inside an `aria-live="polite"` region, and the "Log in" button is enabled

#### Scenario: Retrying after blocked or long-running state starts a clean new attempt

- **WHEN** the user clicks "Log in" again while the hook state is `blocked` or `takingLonger`
- **THEN** `openLogin()` runs its synchronous `window.open` sequence again

---

### Requirement: Secure overlay embedding uses iframe-compatible auth cookies

When the backend is configured for overlay embedding (`OVERLAY_ENABLED=true` and `ALLOWED_IFRAME_ORIGINS` is non-empty) and secure auth cookies are enabled, the BFF SHALL set auth cookies with `SameSite=None; Secure`. This allows the overlay iframe to send the session cookie after the external auth tab/window establishes it.

When overlay embedding is not enabled, when no allowed iframe origins are configured, or when secure cookies are explicitly disabled for local development, the BFF SHALL keep the normal `SameSite=Lax` default.

#### Scenario: Secure overlay deployment sets cross-site iframe cookies

- **GIVEN** `OVERLAY_ENABLED=true`, `ALLOWED_IFRAME_ORIGINS` contains at least one origin, and `AUTH_COOKIE_SECURE=true`
- **WHEN** the BFF callback sets the auth session cookie after external auth login
- **THEN** the `Set-Cookie` header includes `SameSite=None` and `Secure`

#### Scenario: Normal deployment keeps Lax cookies

- **GIVEN** overlay embedding is disabled or no iframe origins are configured
- **WHEN** the BFF callback sets the auth session cookie
- **THEN** the `Set-Cookie` header uses `SameSite=Lax`

#### Scenario: Local insecure overlay testing keeps Lax cookies

- **GIVEN** `OVERLAY_ENABLED=true`, `ALLOWED_IFRAME_ORIGINS` contains at least one origin, and `AUTH_COOKIE_SECURE=false`
- **WHEN** the BFF callback sets the auth session cookie
- **THEN** the `Set-Cookie` header uses `SameSite=Lax`
- **AND** the `Set-Cookie` header does not include `Secure`
