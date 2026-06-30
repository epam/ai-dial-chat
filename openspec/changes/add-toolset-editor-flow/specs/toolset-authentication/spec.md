## ADDED Requirements

### Requirement: Authentication type selection
The Settings step SHALL present an accordion-style single-select for the authentication type
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
For OAuth login with config, the system SHALL save the OAuth configuration, persist the
redirect state (`toolsetId`, `credentialsLevel`, `callbackUrl`) to `sessionStorage`, and
redirect to the provider authorization URL. A dedicated callback route SHALL read the
persisted state and complete login by submitting the authorization `code` and `redirectUri`.

#### Scenario: Initiate OAuth login
- **WHEN** a user saves an OAuth toolset in login-with-config mode
- **THEN** the system stores the redirect state in `sessionStorage` and navigates to the
  provider authorization URL

#### Scenario: Complete OAuth callback
- **WHEN** the provider redirects back to the callback route with an authorization code
- **THEN** the system reads the stored redirect state and calls the login endpoint with the
  code and redirect URI, then returns to the editor

#### Scenario: Callback without stored state
- **WHEN** the callback route is reached with no valid stored redirect state
- **THEN** the system does not attempt a login and routes the user to a safe location

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
