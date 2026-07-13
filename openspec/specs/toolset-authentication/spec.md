# toolset-authentication Specification

## Purpose
TBD - created by archiving change add-toolset-editor-flow. Update Purpose after archive.
## Requirements
### Requirement: Authentication type selection
The Settings step SHALL present a list-style single-select for the authentication type
with three options — None, API Key, and OAuth — driven by a single `authenticationType`
state value so that only one option is expanded at a time.

#### Scenario: Select API Key auth
- **WHEN** a user selects the API Key option
- **THEN** the API Key panel expands, the other panels collapse, and `authenticationType`
  becomes the API Key value

#### Scenario: Select None auth
- **WHEN** a user selects the None option
- **THEN** no credential sub-fields are shown for authentication

### Requirement: API Key credential fields
When API Key auth is selected with login enabled, the system SHALL require a key header name
and an API key value, and SHALL validate that the key header name is present.

#### Scenario: Missing key header
- **WHEN** API Key auth is selected with login and the key header name is empty
- **THEN** the system shows a required error for the key header and blocks the save

### Requirement: OAuth credential fields
When OAuth auth is selected with config, the system SHALL allow entering client id, client
secret, authorization endpoint, token endpoint, and scopes, and SHALL require client id and
client secret before triggering the login.

#### Scenario: Missing OAuth client credentials
- **WHEN** OAuth auth with config is selected and client id or client secret is empty
- **THEN** the system shows required errors for the missing field(s) and blocks the login

### Requirement: Login mode selection
For API Key and OAuth, the system SHALL offer login-mode options (with login, without login,
and — for OAuth — with login & config) that determine whether credential fields are required
and whether a login is triggered on save.

#### Scenario: Without login mode
- **WHEN** a user selects "without login"
- **THEN** the configuration can be saved without submitting credentials and without
  triggering a login

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

### Requirement: Logged-in state and logout
When a toolset is logged in at a credentials level, the system SHALL disable the
authentication type selector and credential fields and SHALL offer a Log out action guarded
by a confirmation dialog that revokes the credentials on confirm.

#### Scenario: Disabled fields when logged in
- **WHEN** the loaded toolset is already logged in
- **THEN** the auth type selector and credential fields are disabled and only Log out is active

#### Scenario: Confirm logout
- **WHEN** a user clicks Log out and confirms the dialog
- **THEN** the system calls the logout endpoint to revoke the credentials

#### Scenario: Cancel logout
- **WHEN** a user clicks Log out and cancels the dialog
- **THEN** no logout request is sent and the logged-in state is unchanged

### Requirement: Auth section disabled while saving
The authentication section SHALL be disabled while a save is in progress to prevent a race
between the saving state and authentication-type changes.

#### Scenario: Saving disables auth controls
- **WHEN** a save is in progress
- **THEN** the authentication type selector and credential fields are disabled until the
  save completes

