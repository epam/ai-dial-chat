# scheduled-tasks-offline-credentials-login delta

## MODIFIED Requirements

### Requirement: Route-level offline-credentials status check
The system SHALL check offline-credentials status once per entry into the
Scheduled Tasks **list** route (`ROUTES.ScheduledTasks`) for an authenticated
user, in parallel with that route's own data loading. The system SHALL NOT
run this check on `ROUTES.ScheduledTaskCreate`, `ROUTES.ScheduledTaskEdit`, or
the OAuth callback route. `ROUTES.ScheduledTaskDetail` (`ScheduledTaskDetailPage`)
also calls `useOfflineCredentialsGate` on entry, but renders the same
`ScheduledTasksLoginBanner` only when one of the task's runs failed with
`status: Error` and `resultStage: 'credentials'` (body text
`scheduledTasks.detail.runCredentialsRequired`, "Sign in to DIAL Chat to run
this task."), and re-fetches the status once per newly seen credentials-failed
run. When the same check reports `schedulerServiceConsent: 'signed_out'`, the
list route SHALL render the limited-access banner (the
`scheduled-tasks-page-ui` "Limited-access banner and create gating on the list
page" requirement) instead of the login-required banner. The detail route
renders no limited-access banner — its banner behaviour, including the
credentials-failed-run login banner, is unchanged by the consent state (a
review decision: the banner is a list-page surface only).
A `schedulerServiceConsent` of `signed_in` or `unknown` changes nothing: the
pre-change banner conditions apply unchanged.

#### Scenario: Entering the Scheduled Tasks list
- **WHEN** an authenticated user navigates to `ROUTES.ScheduledTasks`
- **THEN** exactly one `GET /api/v1/offline-credentials` request is made,
  concurrently with the page's own scheduled-tasks list request

#### Scenario: React 18 StrictMode does not duplicate the check
- **WHEN** the list page mounts under StrictMode's double-invocation of
  effects
- **THEN** the first effect's request is aborted by its cleanup and exactly
  one non-aborted offline-credentials status request settles and updates
  state for that route entry

#### Scenario: Create and edit routes do not check status
- **WHEN** an authenticated user navigates to `ROUTES.ScheduledTaskCreate` or
  `ROUTES.ScheduledTaskEdit`
- **THEN** no `GET /api/v1/offline-credentials` request is made for that
  navigation, and no login-required UI of any kind renders on that page

#### Scenario: Detail route shows the banner only for a credentials-failed run
- **WHEN** an authenticated user opens `ROUTES.ScheduledTaskDetail` and the
  status check reports `connected: false`
- **THEN** the login-required banner renders only if a run of that task has
  `status: Error` and `resultStage: 'credentials'`; otherwise no banner renders

#### Scenario: Revoked consent replaces the login banner on the list route
- **WHEN** the status check reports `schedulerServiceConsent: 'signed_out'`
- **THEN** the list route renders the limited-access banner instead of the login-required banner (regardless of `connected`), and the detail route renders no limited-access banner

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

### Requirement: Login-required banner
The system SHALL show a non-blocking inline banner on the Scheduled Tasks
list page explaining that logging in is required for scheduled tasks to run,
whenever the status check reports `connected: false` and
`schedulerServiceConsent` is not `signed_out`, and SHALL NOT show it
once `connected: true` is confirmed or while `schedulerServiceConsent` is
`signed_out` (the limited-access banner replaces it — see the
`scheduled-tasks-page-ui` delta). The banner SHALL render between the page's
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

#### Scenario: Revoked consent suppresses the login banner
- **WHEN** the status check returns `schedulerServiceConsent: 'signed_out'`
- **THEN** the login-required banner does not render on any condition, and the limited-access banner renders in its place

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
