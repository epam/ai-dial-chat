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
`code`, `redirectUri`, and the stored `credentialsLevel`, then close the window. The page that
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

#### Scenario: Complete OAuth callback and close the window
- **WHEN** the provider redirects back to the callback route inside the window opened for
  login
- **THEN** the system reads the stored redirect state, calls the login endpoint with the code,
  redirect URI, and the stored `credentialsLevel`, then closes the window

#### Scenario: Callback without stored state
- **WHEN** the callback route is reached with no valid stored redirect state
- **THEN** the system does not attempt a login and closes the window
