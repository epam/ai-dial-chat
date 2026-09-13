This capability was originally specified and implemented by
`openspec/changes/add-scheduled-task-offline-credentials-login/` (its
`tasks.md` is fully checked off and the described code exists in the
repository today), but that change was never archived, so
`openspec/specs/scheduled-tasks-offline-credentials-login/spec.md` does not
exist yet. The delta below is written against that unarchived change's own
delta spec (`openspec/changes/add-scheduled-task-offline-credentials-login/
specs/scheduled-tasks-offline-credentials-login/spec.md`) as the actual
current-behavior baseline. Archiving that change (before or together with
this one) will reconcile the missing main spec file.

## MODIFIED Requirements

### Requirement: Route-level offline-credentials status check
The system SHALL check offline-credentials status once per entry into the
Scheduled Tasks **list** route (`ROUTES.ScheduledTasks`) for an authenticated
user, in parallel with that route's own data loading. The system SHALL NOT
run this check on `ROUTES.ScheduledTaskCreate`, `ROUTES.ScheduledTaskDetail`,
`ROUTES.ScheduledTaskEdit`, or the OAuth callback route.

#### Scenario: Entering the Scheduled Tasks list
- **WHEN** an authenticated user navigates to `ROUTES.ScheduledTasks`
- **THEN** exactly one `GET /api/v1/offline-credentials` request is made,
  concurrently with the page's own scheduled-tasks list request

#### Scenario: React 18 StrictMode does not duplicate the check
- **WHEN** the list page mounts under StrictMode's double-invocation of
  effects
- **THEN** only one offline-credentials status request is sent for that
  route entry

#### Scenario: Create, detail, and edit routes do not check status
- **WHEN** an authenticated user navigates to `ROUTES.ScheduledTaskCreate`,
  `ROUTES.ScheduledTaskDetail`, or `ROUTES.ScheduledTaskEdit`
- **THEN** no `GET /api/v1/offline-credentials` request is made for that
  navigation, and no login-required UI of any kind renders on that page

#### Scenario: Callback route is excluded
- **WHEN** the OAuth provider redirects back to `ROUTES.ToolsetSignIn`
- **THEN** no offline-credentials status check runs on that route

#### Scenario: Re-entry re-checks status
- **WHEN** a user leaves the Scheduled Tasks list route and re-enters it
  later in the same session
- **THEN** the status check runs again for the new entry rather than reusing
  a stale in-memory result

#### Scenario: Check is cancelled on navigation away
- **WHEN** the user navigates away from the Scheduled Tasks list route before
  the status request resolves
- **THEN** the in-flight request is aborted and does not update state after
  unmount

#### Scenario: Status failure does not falsely report disconnected
- **WHEN** the status request fails (network error or non-2xx response)
- **THEN** the page does not show the login-required banner and does not
  treat the failure as `connected: false`

### Requirement: OAuth login flow reusing toolset infrastructure
The system SHALL let the user complete offline-credentials OAuth consent from
the login-required banner's "Log in" action by reusing the existing toolset
OAuth popup/callback/`BroadcastChannel` infrastructure via the existing
`OAuthResourceKind.OfflineCredentials` member, and SHALL treat a fresh status
refetch — not the raw callback result — as authoritative for hiding the
banner.

#### Scenario: Popup opens synchronously on click
- **WHEN** the user clicks "Log in"
- **THEN** a same-origin popup window opens as the first synchronous action
  of the click handler, before any awaited network call

#### Scenario: Successful login hides the banner only after reconfirmation
- **WHEN** the OAuth callback reports success
- **THEN** the client re-fetches offline-credentials status, and the banner
  disappears only if that refetch reports `connected: true`

#### Scenario: Callback reports success but status still shows disconnected
- **WHEN** the OAuth callback reports success but the subsequent status
  refetch still reports `connected: false`
- **THEN** the banner remains visible showing a failed-login retry state, not
  a success state

#### Scenario: Popup blocked
- **WHEN** the browser blocks the popup from opening
- **THEN** the banner shows a popup-blocked message with a retry action, and
  no login request is sent

#### Scenario: User cancels the flow
- **WHEN** the user closes the popup without completing the provider flow
- **THEN** the banner shows a cancelled message with a retry action

#### Scenario: Flow times out
- **WHEN** no result is received within the shared OAuth result timeout
- **THEN** the popup is closed and the banner shows a timeout message with a
  retry action

#### Scenario: Sign-in request fails
- **WHEN** the BFF sign-in call itself fails
- **THEN** the banner shows a failed message with a retry action

#### Scenario: Existing toolset OAuth flow is unaffected
- **WHEN** a toolset OAuth login is performed after this change ships
- **THEN** its behavior (popup, callback branch, BroadcastChannel messages,
  status re-verification) is unchanged from before this change

#### Scenario: Existing external-service OAuth flow is unaffected
- **WHEN** an external-service OAuth login is performed after this change
  ships
- **THEN** its behavior is unchanged from before this change

## REMOVED Requirements

### Requirement: Login-required modal
**Reason**: Replaced by a non-blocking inline banner on the Scheduled Tasks
list page (see the new "Login-required banner" requirement) per the design
reference's requirement that the login prompt not interrupt the page on
load. The modal was also shown across all four Scheduled Tasks routes;
the replacement banner is list-page-only (see the modified "Route-level
offline-credentials status check" requirement).
**Migration**: No user action required. Any code or test that rendered or
asserted on `OfflineCredentialsLoginModal` must be updated to use
`ScheduledTasksLoginBanner` instead; the component and its file are deleted.

### Requirement: Accessible modal
**Reason**: The modal-specific accessibility guarantees (focus trap/restore,
Escape-to-close, `aria-busy` on a dialog body) do not apply to inline page
content. Replaced by the new "Accessible banner" requirement, which restates
the equivalent guarantees for a non-overlay, non-dismissible banner.
**Migration**: No user action required. Tests asserting modal-specific
keyboard/focus behavior (dialog role, focus trap, Escape) must be replaced
with the banner's own accessibility tests.

## ADDED Requirements

### Requirement: Login-required banner
The system SHALL show a non-blocking inline banner on the Scheduled Tasks
list page explaining that logging in is required for scheduled tasks to run,
whenever the status check reports `connected: false`, and SHALL NOT show it
once `connected: true` is confirmed. The banner SHALL render between the page's
search/sort toolbar and its task cards. The banner SHALL display a warning
icon, the bold text "Log in required.", the supporting text "Scheduled tasks
need authorization to run offline.", and, only when Core reports
`available: true` and supplies OAuth `connect` settings, a trailing "Log in"
button with a directional arrow that is mirrored under RTL layout. The banner
has no dismiss/close action.

#### Scenario: Credentials available but not connected
- **WHEN** the status check returns `{ available: true, connected: false }`
- **THEN** the banner appears with the warning icon, the bold "Log in
  required." text, the supporting text, and a "Log in" button

#### Scenario: Credentials not available
- **WHEN** the status check returns `{ available: false, connected: false }`
- **THEN** the banner appears with its warning icon, title, and supporting
  text, but without a "Log in" action because Core supplied no OAuth
  connection settings

#### Scenario: Already connected
- **WHEN** the status check returns `{ available: true, connected: true }`
- **THEN** the banner does not render

#### Scenario: Status still checking
- **WHEN** the status check has not yet resolved for the current route entry
- **THEN** the banner does not render

#### Scenario: No automatic popup on page load
- **WHEN** the list page loads and the banner becomes visible because
  credentials are available but not connected
- **THEN** no OAuth popup opens automatically; a popup opens only after the
  user explicitly activates the "Log in" button

#### Scenario: List and its actions stay usable while the banner is shown
- **WHEN** the banner is visible
- **THEN** the task list (search, sort, card clicks, create action, pagination)
  remains fully usable

#### Scenario: Banner disappears once connected is confirmed
- **WHEN** the banner is visible and a subsequent status refetch reports
  `connected: true`
- **THEN** the banner disappears from the page without a route change

### Requirement: Accessible banner
The login-required banner SHALL meet WCAG 2.1 AAA expectations: keyboard
operability, meaningful button labeling, decorative-icon handling, and
`aria-live` announcement of login outcomes, without relying on any
focus-trap/dialog semantics.

#### Scenario: Keyboard operation
- **WHEN** Core supplied OAuth connection settings and a keyboard-only user
  tabs to the banner's "Log in" button
- **THEN** the button is reachable and activatable via Tab and Enter/Space in
  normal page tab order, with no focus trap and no dialog role applied to the
  banner

#### Scenario: Warning icon is decorative
- **WHEN** the banner renders
- **THEN** its leading warning icon is marked `aria-hidden`, since the
  banner's `role="alert"` region already carries the equivalent information
  as text

#### Scenario: Banner announces itself once, assertively, on becoming visible
- **WHEN** the banner transitions from not-rendered to rendered
- **THEN** the banner's container is announced via `role="alert"` (assertive)
  exactly once for that transition

#### Scenario: Retry-state transitions are announced politely
- **WHEN** the login flow transitions to a popup-blocked, cancelled, timeout,
  or failed retry state while the banner is already visible
- **THEN** a separate `aria-live="polite"` region announces the corresponding
  message without re-triggering the banner's own assertive `role="alert"`
  announcement and without changing the stable label of the "Log in"/"Retry"
  button beyond swapping between those two labels

#### Scenario: Logging-in state is exposed on the button
- **WHEN** the login flow is in progress
- **THEN** the "Log in" button is `disabled` and its own visible label
  changes to text describing the in-progress state until a terminal outcome
  is reached

#### Scenario: Button meets minimum target size
- **WHEN** the banner includes a "Log in" or "Retry" action on any supported
  breakpoint
- **THEN** its "Log in"/"Retry" button is at least 44x44 CSS pixels
