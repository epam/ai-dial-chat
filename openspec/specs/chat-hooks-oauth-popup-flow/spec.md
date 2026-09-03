# chat-hooks-oauth-popup-flow Specification

## Purpose

The OAuth authorization-code popup flow published from `@epam/ai-dial-chat-hooks`'s
`oauth/` module: authorize-URL construction, opening the popup and handing the redirect
state to it, the redundant completion handshake that resolves success/failure/cancellation,
and the shared enums and models those signatures use. The module knows no application
route, context, or transport — the callback path and every other host-owned detail is
supplied by the caller.

## Requirements

### Requirement: Host-agnostic OAuth popup module

`@epam/ai-dial-chat-hooks` SHALL publish the OAuth authorization-code popup flow from a new
`libs/chat-hooks/src/oauth/` module: `buildToolsetAuthorizeUrl`, `openToolsetOAuthPopup`,
`navigateToolsetOAuthPopup`, `initiateOAuthLogin`, `waitForToolsetOAuthResult`,
`getToolsetOAuthChannelName`, `encodeToolsetId`, `decodeToolsetId`, and `isPublicToolsetId`, together
with the enums and models their signatures require. The module SHALL NOT import routing, app
contexts, auth/session/cookies, environment variables, feature flags, i18n, or any
`apps/chat/src/server-api` module, per `AGENTS.md` §Library isolation.

#### Scenario: Module boundary holds

- **WHEN** the `oauth/` module is built
- **THEN** it imports only browser APIs, `@epam/ai-dial-chat-shared`, and
  `@epam/ai-dial-chat-api-client` types — no host routing, context, storage-key, i18n, or
  `server-api` import appears anywhere in the module

#### Scenario: Duplicate helper is retired

- **WHEN** `isPublicToolsetId` is published from `oauth/`
- **THEN** the private duplicate in `libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts` is
  deleted and that file imports the shared one instead

### Requirement: Callback route path is supplied by the host

The lib SHALL NOT know any application route. Every function that needs the OAuth callback location
SHALL accept it as a caller-supplied `callbackPath` string: `getToolsetRedirectUri(callbackPath)`
resolves it against `window.location.origin`, and the popup-URL result reader compares the popup's
pathname against the `callbackPath` its caller passed.

#### Scenario: Redirect URI resolves against the supplied path

- **WHEN** a host calls the authorize-URL builder with its own callback path
- **THEN** the `redirect_uri` query parameter is `` `${window.location.origin}${callbackPath}` ``

#### Scenario: Result reader matches only the caller's route

- **WHEN** the opener polls the popup URL for a completion marker
- **THEN** it treats the URL as a result only when the pathname equals the `callbackPath` that flow
  was started with, and ignores same-origin URLs on any other path

#### Scenario: Host with two callback routes

- **WHEN** an application serves more than one callback route
- **THEN** each flow passes the route it actually opened, and the lib contains no knowledge that
  multiple callback routes exist

### Requirement: Authorize-URL construction

`buildToolsetAuthorizeUrl(auth, redirectUri, state)` SHALL return an authorization-code URL carrying
`response_type=code`, `client_id`, `redirect_uri`, `state`, and — when present on the supplied auth
settings — `code_challenge`, `code_challenge_method`, and a space-joined `scope`. It SHALL return
`null` rather than throw for a configuration that cannot produce a valid URL. The `state` value SHALL
be generated per flow by the caller-facing entry points and SHALL double as the flow id.

The authorization endpoint SHALL be reachable only over a secure transport: `https:` SHALL be
accepted, and plain `http:` SHALL be accepted **only** when the host is on the loopback interface
(`localhost`, `127.0.0.0/8`, or `[::1]`), matched exactly so a public host that merely begins with
`localhost` is never treated as loopback. A remote `http:` endpoint SHALL yield `null`: the
provider's redirect carries the authorization code in the URL, so plain HTTP would expose it to any
passive observer, and PKCE does not close that gap when the challenge is verified server-side.

#### Scenario: Complete configuration

- **WHEN** the auth settings carry a `clientId` and an `https:` `authorizationEndpoint`
- **THEN** the returned URL carries `response_type=code`, that client id, the redirect URI, and the
  generated state

#### Scenario: Unusable configuration returns null

- **WHEN** `clientId` or `authorizationEndpoint` is absent, blank, unparseable, or uses a protocol
  other than `http:`/`https:`
- **THEN** the builder returns `null` and no exception escapes

#### Scenario: A remote plain-HTTP authorization endpoint is refused

- **WHEN** the authorization endpoint uses `http:` with a host that is not on the loopback interface
- **THEN** the builder returns `null`, so no flow can start against a transport that would expose the
  returned authorization code

#### Scenario: Loopback HTTP stays usable for local development

- **WHEN** the authorization endpoint uses `http:` with `localhost`, a `127.0.0.0/8` address, or
  `[::1]`
- **THEN** the builder returns a URL, since loopback traffic never reaches an observable network

#### Scenario: A public host resembling loopback is not treated as loopback

- **WHEN** the authorization endpoint is `http://localhost.evil.com/authorize` (or another public
  host whose name merely contains or begins with a loopback name)
- **THEN** the builder returns `null`

#### Scenario: PKCE and scopes forwarded when present

- **WHEN** the auth settings carry `codeChallenge`, `codeChallengeMethod`, and a non-empty scope list
- **THEN** the URL carries `code_challenge`, `code_challenge_method`, and one space-joined `scope`
  parameter; each is omitted when its source value is absent or empty

### Requirement: Popup opening and redirect-state handoff

The popup SHALL be opened as a blank, same-origin window as the first synchronous statement of the
user-gestured path, so a blocked popup is detectable and the browser still treats the call as
user-triggered. Before navigating it to the provider, the flow SHALL write the redirect state into
**the popup's own** `sessionStorage` and SHALL set the popup's `opener` to `null`.

#### Scenario: Redirect state written to the popup's partition

- **WHEN** a flow is initiated
- **THEN** the redirect state is written via the popup's own `sessionStorage`, not the opener's,
  because the two contexts do not share a partition once the popup navigates cross-origin

#### Scenario: Opener severed before cross-origin navigation

- **WHEN** the popup is navigated to the provider
- **THEN** its `opener` has already been set to `null`, so the provider cannot navigate the
  application tab

#### Scenario: Blocked popup detected

- **WHEN** the browser blocks the popup
- **THEN** the flow reports a blocked initiation and issues no network request

#### Scenario: Deferred navigation for an asynchronously resolved config

- **WHEN** the caller must complete a network call before the provider URL is known
- **THEN** it opens the blank popup first and navigates it afterwards, and an unusable config at that
  point closes the already-open popup and reports an invalid-config initiation

### Requirement: Completion handshake

`waitForToolsetOAuthResult` SHALL resolve success, failure, or cancellation by listening on three
redundant channels: a same-origin `BroadcastChannel` named for the flow id, a poll of the popup's
same-origin URL for the completion marker, and a focus listener on the initiating window. A closed
popup SHALL be treated as cancelled **only** via the focus check, never from the poll alone, because
cross-origin navigation can make a retained window reference report closed while the popup is open. A
consumed result SHALL be acknowledged over the channel, and the channel SHALL remain open past the
current tick so that acknowledgement is delivered. A caller-configurable timeout SHALL close the
popup and resolve cancellation. All listeners, intervals, and timeouts SHALL be torn down exactly
once, on first settle.

#### Scenario: Result over the broadcast channel

- **WHEN** the callback posts a success message on the flow channel
- **THEN** the promise resolves success, an acknowledgement is posted, and the popup is closed

#### Scenario: Result read from the popup URL

- **WHEN** no channel message arrives but the popup's same-origin URL carries the marker
- **THEN** the next poll resolves with that result

#### Scenario: Channel unavailable

- **WHEN** constructing the `BroadcastChannel` throws
- **THEN** the flow still resolves via URL polling rather than rejecting

#### Scenario: Cross-origin popup URL is unreadable

- **WHEN** reading the popup's URL throws because the provider page is cross-origin
- **THEN** the poll swallows the error and continues without settling

#### Scenario: Closed popup alone is not a cancel

- **WHEN** the popup reports closed but the initiating window has not regained focus
- **THEN** the flow does not resolve cancelled

#### Scenario: Cancellation on opener focus

- **WHEN** the initiating window regains focus, no result marker is present, and the popup is closed
- **THEN** the flow resolves cancelled

#### Scenario: Result wins over cancellation

- **WHEN** the popup is closed but its URL carries a result and the opener regains focus
- **THEN** the flow resolves with that result, not cancellation

#### Scenario: Timeout

- **WHEN** no result arrives within the configured timeout
- **THEN** the popup is closed and the flow resolves cancelled

#### Scenario: Single teardown

- **WHEN** the flow settles by any path
- **THEN** the focus listener, poll interval, and timeout are cleared exactly once and no later
  event re-settles or re-closes anything

### Requirement: Shared enum and model declarations

The enums and models the flow's signatures use SHALL be declared once in the lib and imported
directly by every call site, never re-declared per host and never laundered through a host-side
re-export shim — TypeScript string enums are nominal, so a structurally identical copy would not
type-check against a lib signature.
`libs/chat-hooks` SHALL own `ToolsetAuthTypes`, `ToolsetAuthStatus`, `ToolsetCredentialsLevel`,
`WithLogin`, `OAuthResourceKind`, `ToolsetOAuthInitiationResultType`, `ToolsetOAuthResultType`,
`ToolsetOAuthFailureReason`, `ToolsetOAuthChannelControlType`, `ToolsetOAuthCallbackQuery`,
`TOOLSET_REDIRECT_STATE_KEY`, and the `ToolsetRedirectState`, `ToolsetOAuthInitiationResult`,
`ToolsetOAuthResult`, `ToolsetOAuthChannelMessage`, and `ToolsetOAuthResultAcknowledgement` shapes.

#### Scenario: Host enum member type-checks against the lib signature

- **WHEN** an application passes its imported `ToolsetCredentialsLevel.User` into a lib function
- **THEN** it type-checks, because the enum is the single shared declaration rather than a
  structurally identical copy

#### Scenario: App constants keep only their editor-only members

- **WHEN** `apps/chat/src/constants/toolsets.ts` is migrated
- **THEN** it retains exactly the members the lib does not own — `ToolsetTransportType`,
  `ToolsetEditorSteps`, `ToolsetEditorQuery`, `AUTH_TYPE_OPTIONS`, and the default-toolset
  constants — and re-exports none of the moved declarations

#### Scenario: Call sites import the moved declarations from the package

- **WHEN** an application module needs a moved enum, model, or function
- **THEN** it imports it directly from `@epam/ai-dial-chat-hooks`, so no host module stands between
  the declaration and its consumers

#### Scenario: i18n and icon mapping stay in the app

- **WHEN** `AUTH_TYPE_OPTIONS` is considered for extraction
- **THEN** it stays app-owned, because it maps enum members to translation keys and
  `@tabler/icons-react` components, both forbidden in the lib
