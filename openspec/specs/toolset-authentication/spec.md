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

#### Scenario: Reopen an OAuth toolset with dynamic client registration
- **WHEN** the editor loads a saved OAuth toolset that Core marks as dynamically registered
- **THEN** the login mode is restored as "with login", even though the returned OAuth settings
  contain the dynamically assigned client ID and endpoints

#### Scenario: Reopen an OAuth toolset with manual client configuration
- **WHEN** the editor loads a saved OAuth toolset that Core marks as not dynamically registered
- **THEN** the login mode is restored as "with login & config"

### Requirement: Persist unsaved changes before login
Clicking "Log in" (API Key or OAuth) SHALL first persist any unsaved editor changes — creating
the toolset if it has no id yet, or updating it if the form has changed since it was last
persisted — using the same persist logic as advancing past the General step. If the form has
not changed since it was last persisted, no create/update request SHALL be sent. If persisting
fails, the system SHALL show an error notification and SHALL NOT proceed to submit credentials
or open the OAuth authorization popup, so login never runs against a stale endpoint or
authentication configuration. The persist step SHALL return the toolset id it just resolved
(the newly created id, the updated id, or the already-persisted id when nothing changed), and
every subsequent call in the same login attempt — initiating the OAuth popup, re-checking
sign-in status after a Cancelled OAuth result, and the API-key login request — SHALL use that
returned id rather than any toolset id value captured before the persist step ran, so the very
first login for a brand-new toolset targets the id that was just created instead of an empty or
stale id.

#### Scenario: Log in persists unsaved endpoint/auth changes first
- **WHEN** a user edits the endpoint or authentication fields on the Settings step without
  saving, then clicks "Log in"
- **THEN** the system updates the toolset with the current form values before submitting
  credentials or opening the OAuth authorization popup

#### Scenario: Log in sends no request when nothing changed
- **WHEN** a user clicks "Log in" without having changed anything since the toolset was last
  persisted
- **THEN** the system sends no create/update request and proceeds directly to login

#### Scenario: Login is blocked when persisting fails
- **WHEN** persisting unsaved changes before login fails
- **THEN** the system shows an error notification and does not submit credentials or open the
  OAuth authorization popup

#### Scenario: First login for a brand-new toolset uses the freshly created id
- **WHEN** a user fills in a new toolset's settings and clicks "Log in" for the very first time,
  before the toolset has ever been persisted
- **THEN** the persist step creates the toolset and the login call (OAuth popup initiation or
  API-key login request) uses the id the create call just returned, not an empty or otherwise
  stale id, so the very first click succeeds

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
the flow's `BroadcastChannel` and write the same non-secret outcome into the callback popup's
same-origin URL. The callback SHALL remove the OAuth authorization code from its URL, repeat the
channel result until the opener acknowledges it, and close itself after acknowledgement. The
opener SHALL continue listening when cross-origin navigation makes its retained `WindowProxy`
appear closed while the opener is in the background, consume either the channel result or the
popup URL marker, and acknowledge the result before refreshing status. A popup SHALL be treated
as manually cancelled only after focus returns to the opener and the popup reference remains
closed, or after the pending flow timeout. Therefore, a completed login cannot be mistaken for
manual cancellation and the handoff requires no delay timer. The popup result URL SHALL NOT
contain the OAuth authorization code or credentials. The environment SHALL serve Chat with
`Cross-Origin-Opener-Policy: same-origin-allow-popups`, not Helmet's `same-origin` default, so
navigation to an external OAuth provider does not sever the opener's popup reference and make an
active login appear manually cancelled; the popup SHALL still clear its own `window.opener`
before external navigation. The page that initiated login (Toolset Editor or Catalog) SHALL
never be navigated away and, after receiving a successful result, SHALL show a success
notification and refetch the shared toolset list so the updated authentication status is visible
without a second login attempt or page reload.

For the Toolset Editor's "With Login" OAuth mode specifically (no manually configured client),
where the `clientId`/`authorizationEndpoint` are assigned by DIAL Core's dynamic client
registration during create/update rather than entered by the user, the system SHALL open the
same-origin placeholder popup synchronously in the click handler (before any asynchronous work),
then, after the persist-before-login step resolves the toolset id, fetch that toolset's current
`authSettings` and use the Core-issued `clientId`/`authorizationEndpoint` from that fetch — not
the pre-save form state, which does not carry them — to build the authorize URL and navigate the
already-open popup. If the manually configured client fields are already present in the editor's
form state (the "with login & config" mode, or an already-saved toolset being re-logged-in),
the system SHALL continue to build the authorize URL directly from that form state without an
extra fetch.

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
  redirect URI, and the stored `credentialsLevel`, removes the authorization code from the popup
  URL, writes the non-secret outcome into that URL, and repeats it over the flow's
  `BroadcastChannel` until the opener acknowledges consumption, after which the callback closes
  itself

#### Scenario: External provider navigation preserves popup tracking

- **WHEN** the OAuth popup navigates from Chat to a cross-origin identity provider
- **THEN** Chat's `same-origin-allow-popups` COOP policy keeps the popup reference observable by
  the opener, while the popup's cleared `window.opener` prevents the provider from navigating the
  Chat tab

#### Scenario: Opener recovers a result after the channel event is missed

- **WHEN** the callback wrote its result into the popup URL, but the opener did not receive the
  first `BroadcastChannel` event
- **THEN** the callback repeats the result, while the opener can also read it from the same-origin
  popup URL; after consuming either copy, the opener acknowledges the result, resolves the login
  outcome, and refreshes the toolset status

#### Scenario: Popup reference is severed during cross-origin navigation

- **WHEN** the OAuth provider navigation makes the opener's retained popup reference report
  `closed` while the OAuth window remains open
- **THEN** the opener keeps the flow channel active, consumes and acknowledges the callback
  result, and the callback closes its own window

#### Scenario: User manually closes the OAuth popup

- **WHEN** the popup is closed without a result and focus returns to the initiating tab
- **THEN** the system resolves the login flow as cancelled without showing an error notification

#### Scenario: Successful OAuth login refreshes the initiating page

- **WHEN** the opener receives a successful OAuth login result
- **THEN** it shows a success notification and refetches the shared toolset list so the updated
  authentication status is immediately available in the initiating tab

#### Scenario: Callback without stored state

- **WHEN** the callback route is reached with no valid stored redirect state
- **THEN** the system does not attempt a login and closes the window

#### Scenario: First login for a brand-new dynamically-registered toolset succeeds

- **WHEN** a user creates a new toolset, selects OAuth "With Login" (no manually configured
  client), and clicks "Log in" for the very first time
- **THEN** the system opens a placeholder popup synchronously, persists the new toolset, fetches
  its Core-issued `authSettings`, builds the authorize URL from the fetched `clientId`/
  `authorizationEndpoint`, and navigates the already-open popup to it instead of showing "Failed
  to log in"

#### Scenario: Manually configured OAuth client skips the extra fetch

- **WHEN** a user logs in via OAuth "With Login & Config" (client id/secret entered manually), or
  clicks "Log in" again on an already-saved OAuth toolset
- **THEN** the system builds the authorize URL directly from the editor's current form state
  without fetching the toolset again first

### Requirement: Logged-in state and logout
When a toolset is logged in at a credentials level, the system SHALL disable the
authentication type selector and credential fields and SHALL offer a Log out action guarded
by a confirmation dialog that revokes the credentials on confirm and shows a success
notification.

#### Scenario: Disabled fields when logged in
- **WHEN** the loaded toolset is already logged in
- **THEN** the auth type selector and credential fields are disabled and only Log out is active

#### Scenario: Confirm logout
- **WHEN** a user clicks Log out and confirms the dialog
- **THEN** the system calls the logout endpoint to revoke the credentials, closes the confirm
  dialog, and shows a success notification

#### Scenario: Cancel logout
- **WHEN** a user clicks Log out and cancels the dialog
- **THEN** no logout request is sent and the logged-in state is unchanged

#### Scenario: Logout failure
- **WHEN** the logout endpoint call fails
- **THEN** the system shows an error notification and the logged-in state is unchanged

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

### Requirement: API-key login success feedback and refresh

When an API-key login succeeds, the system SHALL show a success notification and refetch the
shared toolset list, matching the behavior of a successful OAuth login, regardless of whether
the login was initiated from the Toolset Editor's Auth section or the Catalog Details Panel.

#### Scenario: API-key login success notification in the Toolset Editor
- **WHEN** a user submits a valid API key in the Toolset Editor's Auth section and the login
  request succeeds
- **THEN** the system shows a success notification, marks the toolset as logged in, and refetches
  the shared toolset list
