## MODIFIED Requirements

### Requirement: OAuth redirect and callback handshake

For OAuth login with config, the system SHALL save the OAuth configuration (Editor) or use the
already-configured toolset (Catalog), persist the redirect state (`toolsetId`,
`credentialsLevel`) to `sessionStorage`, and open the provider authorization URL in a new
browser window/tab rather than navigating the current page away. `credentialsLevel` SHALL be an
explicit, caller-supplied value — `USER` for the Toolset Editor; `USER` or `GLOBAL` for a
Catalog-initiated login (`GLOBAL` only reachable by an admin managing a public toolset). The
authorize URL SHALL include `code_challenge`/`code_challenge_method` query parameters when the
toolset's stored OAuth configuration includes them. A shared callback route, loaded inside that
new window, SHALL read the persisted state and complete login by submitting the authorization
`code`, `redirectUri`, and the stored `credentialsLevel`, then post the outcome to the opener over
the flow's `BroadcastChannel` and wait, without closing itself. The opener SHALL close the
callback window itself immediately after receiving that message, so the window never closes
before its result has been delivered. The callback window SHALL additionally carry its own
bounded safety-net auto-close timer, started once the outcome has been posted, that closes the
window if the opener has not already done so by the time it fires — covering the case where the
opener tab was itself closed or navigated away before it could process the message. The page that
initiated login (Toolset Editor or Catalog) is never navigated away and does not automatically
refresh; the user reopens it to see updated status.

#### Scenario: Initiate OAuth login from the editor
- **WHEN** a user saves an OAuth toolset in login-with-config mode from the Toolset Editor, or
  clicks "Log in" on an already-configured OAuth toolset
- **THEN** the system stores redirect state with `credentialsLevel: USER`, opens the provider
  authorization URL in a new window/tab, and the editor tab remains on its current page

#### Scenario: Initiate OAuth login from the Catalog at USER level
- **WHEN** a user clicks "Log in" for an OAuth toolset in the Catalog Details Panel in a section
  scoped to `USER`
- **THEN** the system stores redirect state with `credentialsLevel: USER`, opens the provider
  authorization URL in a new window/tab, and the Catalog tab remains on its current page

#### Scenario: Initiate OAuth login from the Catalog at GLOBAL level
- **WHEN** an admin clicks "Log in" in the "Entire organization credentials" section of an OAuth
  toolset in the Catalog Details Panel
- **THEN** the system stores redirect state with `credentialsLevel: GLOBAL`, opens the provider
  authorization URL in a new window/tab, and the Catalog tab remains on its current page

#### Scenario: Authorize URL includes PKCE parameters when configured
- **WHEN** the toolset's stored OAuth configuration includes a `code_challenge` and
  `code_challenge_method`
- **THEN** the authorize URL includes both as query parameters

#### Scenario: Complete OAuth callback and report the result
- **WHEN** the provider redirects back to the callback route inside the window opened for
  login
- **THEN** the system reads the stored redirect state, calls the login endpoint with the code,
  redirect URI, and the stored `credentialsLevel`, and posts the outcome to the opener over the
  flow's `BroadcastChannel` without closing itself

#### Scenario: Opener closes the callback window on receiving the result
- **WHEN** the opener's `BroadcastChannel` listener receives the callback window's posted result
- **THEN** the opener resolves the login outcome and closes the callback window itself, so the
  window is never observed closed before its message was delivered

#### Scenario: Callback window self-closes if the opener never does
- **WHEN** the callback window has posted its result but the opener has not closed it before the
  window's own safety-net timer elapses (e.g. because the opener tab was closed or navigated
  away)
- **THEN** the callback window closes itself

#### Scenario: Callback without stored state
- **WHEN** the callback route is reached with no valid stored redirect state
- **THEN** the system does not attempt a login and closes the window

## ADDED Requirements

### Requirement: API-key login success notification

When an API-key login succeeds, the system SHALL show a success notification, matching the
notification already shown for a successful OAuth login, regardless of whether the login was
initiated from the Toolset Editor's Auth section or the Catalog Details Panel.

#### Scenario: API-key login success notification in the Toolset Editor
- **WHEN** a user submits a valid API key in the Toolset Editor's Auth section and the login
  request succeeds
- **THEN** the system shows a success notification in addition to marking the toolset as logged
  in
