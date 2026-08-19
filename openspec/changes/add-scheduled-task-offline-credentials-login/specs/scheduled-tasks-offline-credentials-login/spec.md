## ADDED Requirements

### Requirement: Route-level offline-credentials status check
The system SHALL check offline-credentials status once per entry into any
Scheduled Tasks route (`ROUTES.ScheduledTasks`, `ROUTES.ScheduledTaskCreate`,
`ROUTES.ScheduledTaskDetail`, `ROUTES.ScheduledTaskEdit`) for an
authenticated user, in parallel with that route's own data loading, and
SHALL NOT run this check on the OAuth callback route.

#### Scenario: Entering the Scheduled Tasks list
- **WHEN** an authenticated user navigates to `ROUTES.ScheduledTasks`
- **THEN** exactly one `GET /api/v1/offline-credentials` request is made,
  concurrently with the page's own scheduled-tasks list request

#### Scenario: React 18 StrictMode does not duplicate the check
- **WHEN** the route-level gate mounts under StrictMode's double-invocation
  of effects
- **THEN** only one offline-credentials status request is sent for that
  route entry

#### Scenario: Callback route is excluded
- **WHEN** the OAuth provider redirects back to `ROUTES.ToolsetSignIn`
- **THEN** no offline-credentials status check runs on that route

#### Scenario: Re-entry re-checks status
- **WHEN** a user leaves a Scheduled Tasks route and re-enters it later in
  the same session
- **THEN** the status check runs again for the new entry rather than reusing
  a stale in-memory result

#### Scenario: Check is cancelled on navigation away
- **WHEN** the user navigates away from a Scheduled Tasks route before the
  status request resolves
- **THEN** the in-flight request is aborted and does not update state after
  unmount

#### Scenario: Status failure does not falsely report disconnected
- **WHEN** the status request fails (network error or non-2xx response)
- **THEN** the gate does not show the "log in required" modal and does not
  treat the failure as `connected: false`

### Requirement: Login-required modal
The system SHALL show a modal explaining that logging in is required for
scheduled tasks to run whenever the status check reports
`available: true, connected: false`, and SHALL NOT show it otherwise.

#### Scenario: Credentials available but not connected
- **WHEN** the status check returns `{ available: true, connected: false }`
- **THEN** a modal appears with an explanation and a "Log in" action

#### Scenario: Credentials not available
- **WHEN** the status check returns `{ available: false }`
- **THEN** no modal appears

#### Scenario: Already connected
- **WHEN** the status check returns `{ available: true, connected: true }`
- **THEN** no modal appears

#### Scenario: Dismissing the modal does not block the page
- **WHEN** the user dismisses the modal without logging in
- **THEN** the underlying Scheduled Tasks page remains fully usable
  (list, create, detail, edit all continue to function)

### Requirement: OAuth login flow reusing toolset infrastructure
The system SHALL let the user complete offline-credentials OAuth consent
from the modal's "Log in" action by reusing the existing toolset OAuth
popup/callback/BroadcastChannel infrastructure, extended with a new
`OAuthResourceKind` member, and SHALL treat a fresh status refetch — not the
raw callback result — as authoritative for closing the modal.

#### Scenario: Popup opens synchronously on click
- **WHEN** the user clicks "Log in"
- **THEN** a same-origin popup window opens as the first synchronous action
  of the click handler, before any awaited network call

#### Scenario: Successful login closes the modal only after reconfirmation
- **WHEN** the OAuth callback reports success
- **THEN** the client re-fetches offline-credentials status, and the modal
  closes only if that refetch reports `connected: true`

#### Scenario: Callback reports success but status still shows disconnected
- **WHEN** the OAuth callback reports success but the subsequent status
  refetch still reports `connected: false`
- **THEN** the modal remains open showing a failed-login retry state, not a
  success state

#### Scenario: Popup blocked
- **WHEN** the browser blocks the popup from opening
- **THEN** the modal shows a popup-blocked message with a retry action, and
  no login request is sent

#### Scenario: User cancels the flow
- **WHEN** the user closes the popup without completing the provider flow
- **THEN** the modal shows a cancelled message with a retry action

#### Scenario: Flow times out
- **WHEN** no result is received within the shared OAuth result timeout
- **THEN** the popup is closed and the modal shows a timeout message with a
  retry action

#### Scenario: Sign-in request fails
- **WHEN** the BFF sign-in call itself fails
- **THEN** the modal shows a failed message with a retry action

#### Scenario: Existing toolset OAuth flow is unaffected
- **WHEN** a toolset OAuth login is performed after this change ships
- **THEN** its behavior (popup, callback branch, BroadcastChannel messages,
  status re-verification) is unchanged from before this change

#### Scenario: Existing external-service OAuth flow is unaffected
- **WHEN** an external-service OAuth login is performed after this change
  ships
- **THEN** its behavior is unchanged from before this change

### Requirement: Accessible modal
The login-required modal SHALL meet WCAG 2.1 AAA expectations: keyboard
operability, focus management, live-region status announcements, and
minimum interactive target sizing.

#### Scenario: Keyboard operation
- **WHEN** a keyboard-only user opens the modal
- **THEN** focus moves into the modal, Tab cycles only within it, Escape
  closes it, and focus returns to the triggering context on close

#### Scenario: Busy state is announced
- **WHEN** the login flow is in progress
- **THEN** the modal's busy region exposes `aria-busy="true"` until a
  terminal state is reached

#### Scenario: Retry-state transitions are announced
- **WHEN** the flow transitions to a popup-blocked, cancelled, timeout, or
  failed state
- **THEN** an `aria-live="polite"` region announces the corresponding
  message without changing the stable label of the "Log in" button

#### Scenario: Targets meet minimum size
- **WHEN** the modal is rendered on any supported breakpoint
- **THEN** its "Log in" and dismiss controls are at least 44x44 CSS pixels
