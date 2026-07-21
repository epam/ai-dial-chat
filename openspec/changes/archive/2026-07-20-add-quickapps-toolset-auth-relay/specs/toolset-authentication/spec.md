## ADDED Requirements

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
