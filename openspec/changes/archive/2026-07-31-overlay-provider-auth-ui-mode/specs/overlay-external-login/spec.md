# Spec delta: overlay-external-login

## MODIFIED Requirements

### Requirement: Overlay login gate renders when unauthenticated in overlay mode

When `RequireAuth` is mounted in overlay mode (`useOptionalOverlay()` returns a defined value) and `status === AuthStatus.Unauthenticated`, it SHALL render `OverlayLoginGate` (`apps/chat/src/components/OverlayLoginGate/OverlayLoginGate.tsx`) instead of `null`.

The gate SHALL call `useOverlayProviderLogin` and render in one of two branches:

**Branch A — no provider-mode configuration** (`authProviderUiModes` is `undefined` or empty in the overlay context): render a centered, direction-agnostic vertical layout containing a title, a short description, and one focusable "Log in" action built from the `PrimaryButton` wrapper from `@epam/ai-dial-kit`. This single-button behavior is identical to the previous implementation.

**Branch B — provider-mode configuration present**: render a provider picker. Loading, error, empty-list, and populated states are defined in the `overlay-provider-auth-ui-mode` spec. The blocked and taking-longer feedback from the external attempt is displayed below the provider list, using the same `role="alert"` / `aria-live="polite"` pattern as before.

i18n keys (existing, unchanged): `auth.overlayLoginTitle`, `auth.overlayLoginDescription`; the single-button label reuses the existing `buttons.logIn` key. New keys for Branch B are defined in the `overlay-provider-auth-ui-mode` spec.

RTL: the layout uses logical Tailwind spacing utilities only; no directional icon is required for either branch.

Accessibility: the "Log in" button (Branch A) and all provider buttons (Branch B) are keyboard-focusable and reachable via Tab. Login controls are disabled only during `opening` and remain available during `waiting` and `takingLonger` so they can replace the attempt. The container exposes `aria-busy="true"` while loading providers or while an auth window attempt is `opening`, `waiting`, or `takingLonger`.

#### Scenario: Gate renders for unauthenticated overlay session — no configuration

- **WHEN** `RequireAuth` is mounted with `useOptionalOverlay()` defined and `status === AuthStatus.Unauthenticated`
- **AND** `authProviderUiModes` in the overlay context is `undefined`
- **THEN** `OverlayLoginGate` renders with a single focusable "Log in" button labelled via the `buttons.logIn` i18n key
- **AND** no provider picker UI is rendered

#### Scenario: Gate renders provider picker when configuration is present

- **WHEN** `RequireAuth` is mounted with `useOptionalOverlay()` defined and `status === AuthStatus.Unauthenticated`
- **AND** `authProviderUiModes` in the overlay context has at least one entry
- **THEN** `OverlayLoginGate` renders in provider-picker mode

#### Scenario: Gate does not render outside overlay mode

- **WHEN** `RequireAuth` is mounted with `useOptionalOverlay()` returning `undefined` and `status === AuthStatus.Unauthenticated`
- **THEN** `RequireAuth` renders `null`, matching existing non-overlay behavior

#### Scenario: Logout returns an overlay session to the external login gate

- **WHEN** a user confirms logout while `useOptionalOverlay()` returns a defined value
- **THEN** the SPA clears the current user state without navigating the iframe to `/login`
- **AND** the iframe URL remains on the current protected route governed by `RequireAuth`
- **AND** `RequireAuth` renders `OverlayLoginGate` after the user status becomes `AuthStatus.Unauthenticated`

#### Scenario: Logout outside overlay mode keeps normal login navigation

- **WHEN** a user confirms logout while `useOptionalOverlay()` returns `undefined`
- **THEN** the SPA clears the current user state and navigates to `/login`, matching existing non-overlay behavior

#### Scenario: Login controls are disabled only while an auth attempt is starting

- **WHEN** the user has clicked a login control and the external auth state is `opening`
- **THEN** all interactive login controls are disabled and the container exposes `aria-busy="true"`
- **AND** the controls become available when the state advances to `waiting`

---

### Requirement: `useOverlayExternalLogin` opens auth outside the iframe

`useOverlayExternalLogin` (`apps/chat/src/hooks/auth/useOverlayExternalLogin.ts`) SHALL expose a lifecycle state of exactly one of `idle | opening | waiting | blocked | takingLonger` and an `openLogin()` action that opens `/login?callbackUrl=<encoded-overlay-close-url>` with `window.open`.

`useOverlayProviderLogin` delegates the external-window path to the same logic as `useOverlayExternalLogin`, constructing a provider-specific BFF login URL instead of the generic `/login` route. The core mechanics (sequential polling, long-wait timer, cleanup, COOP-tolerance) are unchanged.

On `openLogin()` / `openProviderLogin(id)` for `External` mode, the hook SHALL synchronously, without awaiting before `window.open`:

1. Build a provider-specific login target `/api/v1/auth/login/${encodeURIComponent(providerId)}?callbackUrl=<encoded-overlay-close-url>`, where overlay-close-url is `${window.location.origin}/overlay-close`. For the no-configuration single-button path, the generic target `/login?callbackUrl=<encoded-overlay-close-url>` is used.
2. Call `window.open(target, '_blank')`.
3. If the returned window handle is `null`/`undefined`, or is immediately observed as closed, set state to `blocked`.
4. Otherwise set state to `waiting`, clear `window.opener` on the opened window best-effort, start one sequential current-user poll timer no coarser than 5000ms, and start one long-wait timer no longer than 120 seconds.

The first current-user poll MUST NOT run before one full poll interval has elapsed. Each next poll MUST be scheduled only after the previous poll settles. The hook SHALL NOT rely on `authWindow.closed` after entering the waiting state. Every previous attempt's poll timer and long-wait timer MUST be torn down before a new login call starts a new one and on hook unmount. Replacement SHALL invalidate an in-flight poll result and best-effort close the retained auth window before opening the next attempt.

#### Scenario: Successful synchronous auth tab open transitions to waiting

- **WHEN** `openProviderLogin(id)` is called for an `External` provider and `window.open` returns a non-null window reference
- **THEN** the hook state becomes `waiting`
- **AND** the opened target starts with `/api/v1/auth/login/${encodeURIComponent(id)}`
- **AND** the `callbackUrl` parameter is `${window.location.origin}/overlay-close` (encoded)
- **AND** the target window name is `_blank`

#### Scenario: Blocked auth tab surfaces immediately

- **WHEN** `openProviderLogin(id)` is called for an `External` provider and `window.open` returns `null`
- **THEN** the hook state becomes `blocked` without entering `waiting`

#### Scenario: Re-opening tears down the previous attempt

- **WHEN** `openProviderLogin` is called again while a previous attempt's poll timer or long-wait timer is still active
- **THEN** the previous attempt's poll timer and long-wait timer are cleared before the new attempt starts

#### Scenario: Unmount cleans up all resources

- **WHEN** the component using `useOverlayProviderLogin` unmounts while an auth attempt is `waiting`
- **THEN** the poll timer and long-wait timer are cleared

---

### Requirement: Active, blocked, and long-running states are replaceable or retryable and announced

Login controls SHALL remain enabled during `waiting` and `takingLonger`; selecting one starts a clean replacement attempt. The brief synchronous `opening` state MAY disable login controls. When the state is `blocked` or `takingLonger`, the gate SHALL render the existing localized status message associated with an `aria-live="polite"` region, or `role="alert"` for the blocked-window case.

i18n keys: `auth.overlayExternalLoginBlocked` (shown when state is `blocked`) and `auth.overlayLoginTakingLonger` (shown when state is `takingLonger`).

#### Scenario: Waiting attempt can be replaced

- **WHEN** the hook state is `waiting`
- **THEN** login controls are enabled
- **AND** selecting a login control tears down the previous attempt before opening the replacement

#### Scenario: Blocked auth tab shows an alert with retry

- **WHEN** the hook state is `blocked`
- **THEN** `OverlayLoginGate` renders the `auth.overlayExternalLoginBlocked` message inside a `role="alert"` region
- **AND** the login controls are enabled

#### Scenario: Long-running attempt shows a polite live-region message with retry

- **WHEN** the hook state is `takingLonger`
- **THEN** `OverlayLoginGate` renders the `auth.overlayLoginTakingLonger` message inside an `aria-live="polite"` region
- **AND** the login controls are enabled

#### Scenario: Retrying after blocked or long-running state starts a clean new attempt

- **WHEN** the user clicks a login control again while the hook state is `blocked` or `takingLonger`
- **THEN** `openProviderLogin` (or `openLogin` for the single-button path) runs its synchronous `window.open` sequence again
