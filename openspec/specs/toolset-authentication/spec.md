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

### Requirement: QuickApps toolset login relay via postMessage

The embedded QuickApps iframe (`AppEditorIframe.tsx`, `/apps-editor`) SHALL be able to request a
toolset login by sending `window.parent.postMessage({ type: 'REQUEST_TOOLSET_LOGIN', toolsetId }, hostOrigin)`
carrying only the raw toolset id, with no OAuth client configuration. The host SHALL percent-encode
each `/`-separated segment of the raw id before using it in any backend call (via `encodeToolsetId`),
fetch the toolset's stored OAuth configuration itself (`getToolset`), open the OAuth popup, drive the
existing admin login handshake (`navigateToolsetOAuthPopup` + `waitForToolsetOAuthResult`, the same
`sessionStorage`/`BroadcastChannel`/callback-route machinery the Toolset Editor's Log In button
already uses, unchanged), and post the outcome back to the iframe as
`{ type: 'TOOLSET_LOGIN_RESULT', toolsetId, success, credentialsLevel?, reason?, credentials? }` —
`toolsetId` in the result SHALL be the original raw id as sent by the iframe, not the encoded form.
Messages from an origin other than the iframe's own `editorUrl` origin SHALL be ignored.

#### Scenario: Successful OAuth login requested from QuickApps
- **WHEN** the QuickApps iframe posts `REQUEST_TOOLSET_LOGIN` with a `toolsetId` for a toolset
  configured for OAuth
- **THEN** the host opens the OAuth popup, completes the login, and posts
  `TOOLSET_LOGIN_RESULT` with `success: true`, the resolved `credentialsLevel`, and refreshed
  `credentials` reflecting the new signed-in status

#### Scenario: Raw id with reserved characters is encoded before any backend call
- **WHEN** the requested `toolsetId` contains characters the toolsets API does not accept raw
  (e.g. a literal space)
- **THEN** the host percent-encodes each `/`-segment of the id before calling `getToolset` or
  initiating the OAuth popup, and echoes the original, un-encoded `toolsetId` back in the result
  message

#### Scenario: Browser blocks the login popup
- **WHEN** the host's popup-open call is blocked by the browser
- **THEN** the host posts `TOOLSET_LOGIN_RESULT` with `success: false` and
  `reason: 'popup-blocked'` without calling `getToolset`

#### Scenario: Requested toolset does not use OAuth
- **WHEN** the resolved toolset's authentication type is not OAuth
- **THEN** the host closes the already-opened popup and posts `TOOLSET_LOGIN_RESULT` with
  `success: false` and `reason: 'not-oauth'`

#### Scenario: Toolset lookup fails
- **WHEN** fetching the toolset's stored auth configuration fails
- **THEN** the host closes the already-opened popup and posts `TOOLSET_LOGIN_RESULT` with
  `success: false` and `reason: 'toolset-fetch-failed'`

#### Scenario: Login result lost to a popup-close race is recovered
- **WHEN** the OAuth popup reports `Cancelled` (e.g. it closed before its success message was
  delivered) but a subsequent lookup of the toolset shows the user-level status as signed in
- **THEN** the host posts `TOOLSET_LOGIN_RESULT` with `success: true` instead of a false failure

#### Scenario: Message from an unexpected origin is ignored
- **WHEN** a `message` event's `origin` does not match the iframe's own `editorUrl` origin
- **THEN** the host does not process it as a `REQUEST_TOOLSET_LOGIN`

### Requirement: QuickApps toolset logout relay via postMessage

The embedded QuickApps iframe SHALL be able to request a toolset logout by sending
`{ type: 'REQUEST_TOOLSET_LOGOUT', toolsetId }`. Unlike login, the host SHALL call the logout
endpoint directly (no popup, no OAuth round-trip) using the percent-encoded id and `USER`-level
credentials, then post `{ type: 'TOOLSET_LOGOUT_RESULT', toolsetId, success, credentialsLevel?, reason?, credentials? }`
back to the iframe, with `toolsetId` again echoed as the original raw id.

#### Scenario: Successful logout requested from QuickApps
- **WHEN** the QuickApps iframe posts `REQUEST_TOOLSET_LOGOUT` with a `toolsetId`
- **THEN** the host calls the logout endpoint with the encoded id and `USER` credentials level,
  and posts `TOOLSET_LOGOUT_RESULT` with `success: true` and refreshed `credentials`

#### Scenario: Logout call fails
- **WHEN** the logout endpoint call rejects
- **THEN** the host posts `TOOLSET_LOGOUT_RESULT` with `success: false` and
  `reason: 'logout-failed'`

#### Scenario: Message from an unexpected origin is ignored
- **WHEN** a `message` event's `origin` does not match the iframe's own `editorUrl` origin
- **THEN** the host does not process it as a `REQUEST_TOOLSET_LOGOUT`

### Requirement: Logout resolves authentication type server-side when omitted

`POST /api/v1/toolsets/{toolsetName}/logout` SHALL accept a request body that omits
`authenticationType`. When omitted, the server SHALL resolve it by looking up the toolset's own
stored authentication type (the same lookup `GET /api/v1/toolsets/{toolsetName}` performs)
before revoking credentials, so a caller that only knows a toolset id does not need a prior
lookup call of its own. When the resolved (or explicitly supplied) authentication type is
neither `API_KEY` nor `OAUTH`, the request SHALL fail with `400 Bad Request`.

#### Scenario: Logout without authenticationType succeeds for a known toolset
- **WHEN** a logout request omits `authenticationType` for a toolset stored with OAuth
  authentication
- **THEN** the server resolves the authentication type from the stored toolset and completes
  the logout

#### Scenario: Logout without authenticationType fails for an unsupported stored type
- **WHEN** a logout request omits `authenticationType` and the stored toolset's authentication
  type is `NONE`
- **THEN** the server responds `400 Bad Request`

#### Scenario: Explicit authenticationType is honored without a lookup
- **WHEN** a logout request includes `authenticationType`
- **THEN** the server uses the supplied value directly and does not perform the stored-toolset
  lookup

