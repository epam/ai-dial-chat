## MODIFIED Requirements

### Requirement: OAuth redirect and callback handshake

For OAuth login with config, the system SHALL save the OAuth configuration, encode the
redirect state (`toolsetId`, `credentialsLevel`, `csrfToken`) as a base64url JSON payload in
the OAuth `state` query parameter, and open the provider authorization URL in a new window. A
dedicated callback route SHALL decode `state` and complete login by submitting the
authorization `code` and `redirectUri`.

This requirement previously specified persisting the redirect state to `sessionStorage` before
navigating the whole tab to the provider. That description no longer matches how the OAuth
window is opened (`window.open(..., 'noopener,noreferrer')`, not a full-page redirect), and
`noopener` severs `sessionStorage` sharing with the opened window — so a
`sessionStorage`-based redirect state can never be read back by the callback. This revision
replaces `sessionStorage` with the `state`-encoded payload described above so the handshake
actually completes.

The same callback route SHALL additionally support a second, popup-based variant of this
handshake for OAuth logins initiated from an embedded iframe outside this app (e.g. the
`ai-dial-quickapps-frontend` Quick App editor, embedded via `AppEditorIframe`). This variant
SHALL be triggered without any new registered `redirect_uri` — it reuses the same
`/toolset-editor/callback` route the admin flow uses — and SHALL be distinguished from the
admin flow by the callback window having `window.opener` set and
`window.name === 'quickapps-toolset-auth-popup'`, checked before decoding `state`.

In the popup variant, the handshake state (`toolsetId`, `credentialsLevel`, the initiating
window's origin, and a nonce) SHALL travel in the OAuth `state` query parameter as a
base64url-encoded JSON payload (`ToolsetPopupState`), not in `sessionStorage`, because a popup
opened from a different-origin caller does not share `sessionStorage` with that caller. On
completion (success or failure), the callback SHALL post a
`{ type: 'quickapps/TOOLSET_LOGIN_COMPLETE', payload: { toolsetId, credentialsLevel, success } }`
message to `window.opener`, targeted at the decoded, validated origin from `state` (never
`'*'`), then close the popup window. Credentials, tokens, and the authorization `code` SHALL
never appear in this message.

If `state` cannot be decoded into a well-formed `ToolsetPopupState` (missing/invalid
`toolsetId`, `originatingOrigin`, `nonce`, or `credentialsLevel`), the callback SHALL NOT call
the login endpoint. If `originatingOrigin` itself is unrecoverable, it SHALL NOT call
`postMessage` at all and SHALL instead render a safe "you can close this window" fallback;
otherwise it MAY still post a `success: false` message to the recovered origin.

The existing admin-flow (non-popup) branch's *observable outcome* — a successful login call
given a valid authorization `code` — is unchanged by this requirement, but its state-passing
mechanism is fixed from `sessionStorage` to `state`-encoding as part of this same requirement,
since the previous mechanism could not work given how the OAuth window is opened (see the
correction above).

#### Scenario: Initiate OAuth login

- **WHEN** a user saves an OAuth toolset in login-with-config mode
- **THEN** the system encodes the redirect state into the OAuth `state` query parameter and
  opens the provider authorization URL in a new window

#### Scenario: Complete OAuth callback

- **WHEN** the provider redirects back to the callback route with an authorization code and a
  `state` that decodes into a well-formed `ToolsetRedirectState`
- **THEN** the system calls the login endpoint with the decoded `toolsetId`,
  `credentialsLevel`, code, and redirect URI, then closes the window

#### Scenario: Callback without a well-formed redirect state

- **WHEN** the callback route is reached with no authorization code, or a `state` that fails to
  decode into a well-formed `ToolsetRedirectState`, and it is not a popup opened with the
  `quickapps-toolset-auth-popup` window name
- **THEN** the system does not attempt a login and closes the window

#### Scenario: Popup callback completes successfully

- **WHEN** the callback route is reached in a window where `window.opener` is set and
  `window.name === 'quickapps-toolset-auth-popup'`, with a `state` that decodes into a
  well-formed `ToolsetPopupState` and a valid `code`
- **THEN** the system calls the login endpoint with the decoded `toolsetId` and
  `credentialsLevel`
- **AND** posts `{ type: 'quickapps/TOOLSET_LOGIN_COMPLETE', payload: { toolsetId,
  credentialsLevel, success: true } }` to `window.opener` at the decoded `originatingOrigin`
- **AND** closes the popup window

#### Scenario: Popup callback fails login

- **WHEN** the popup callback's login endpoint call rejects (non-2xx or network error)
- **THEN** the system posts the same message shape with `success: false` to the decoded
  `originatingOrigin` and closes the popup window
- **AND** the message never includes the authorization `code`, an access token, or any other
  credential material

#### Scenario: Popup callback with malformed state

- **WHEN** the callback route is reached with `window.opener` set and
  `window.name === 'quickapps-toolset-auth-popup'`, but `state` fails to decode into a
  well-formed `ToolsetPopupState`
- **THEN** the system does not call the login endpoint
- **AND** if `originatingOrigin` could not be recovered from `state`, the system does not call
  `postMessage` and instead renders a safe "you can close this window" message

#### Scenario: Admin flow completes without relying on window.opener or sessionStorage

- **WHEN** the callback route is reached with no `window.opener` (the real-world case, since
  `initiateOAuthLogin` opens with `noopener`), or with `window.opener` set but `window.name`
  not matching the popup marker, and a `state` that decodes into a well-formed
  `ToolsetRedirectState`
- **THEN** the system calls the login endpoint with the decoded `toolsetId` and
  `credentialsLevel`, without reading or writing `sessionStorage`, and without referencing
  `ToolsetPopupState` or any popup-only field
