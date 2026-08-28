## ADDED Requirements

### Requirement: Host-agnostic toolset login hook

`@epam/ai-dial-chat-hooks` SHALL publish `useToolsetLogin`, returning a `useCallback`-stable
`login(params)` that resolves a discriminated success / failure / popup-blocked / cancelled outcome.
The hook SHALL receive `loginToolset`, `logoutToolset`, and `getToolset` as injected callbacks and
SHALL NOT import any `server-api` module, app context, or client configuration — following
`useFavoriteEntitiesState`'s injected-callback contract. It SHALL NOT render, translate, or raise
notifications; mapping an outcome to user-visible feedback belongs to the caller.

#### Scenario: API access is injected

- **WHEN** the hook performs a login, logout, or status re-check
- **THEN** it calls the callbacks its caller supplied, and constructs no client instance and no base
  URL, auth header, or CSRF token

#### Scenario: Outcomes are returned, not announced

- **WHEN** any branch completes
- **THEN** the hook resolves an outcome value and shows nothing itself, so a deliberate cancellation
  stays silent while a blocked popup can be surfaced by the caller

#### Scenario: Stable callback identity

- **WHEN** a consuming component re-renders without changing the injected callbacks
- **THEN** `login` keeps its identity so caller memoization is preserved

### Requirement: API-key login path

For API-key authentication the hook SHALL submit the trimmed key at the requested credentials level.
When the target level's cached status is failed — or when the caller forces it — the hook SHALL log
that level out first, and a rejection from that pre-emptive logout SHALL NOT prevent the login
attempt.

#### Scenario: Key submitted at the requested level

- **WHEN** `login` runs for API-key authentication
- **THEN** the injected `loginToolset` receives the toolset id, the requested credentials level, the
  authentication type, and the trimmed key

#### Scenario: Failed credentials cleared first

- **WHEN** the target level's cached status is failed
- **THEN** `logoutToolset` is called for that level before `loginToolset`

#### Scenario: Best-effort pre-emptive logout

- **WHEN** that pre-emptive logout rejects
- **THEN** the login attempt still proceeds and can still resolve success

#### Scenario: Login rejection is classified, not thrown

- **WHEN** `loginToolset` rejects
- **THEN** `login` resolves failure and no exception escapes

#### Scenario: No popup for API-key authentication

- **WHEN** the authentication type is not OAuth
- **THEN** no popup is opened

### Requirement: OAuth login path

For OAuth the hook SHALL drive the shared popup flow and classify its outcome. A blocked popup SHALL
resolve popup-blocked without issuing any request. An unusable OAuth configuration SHALL resolve
failure. When the handshake reports cancellation, the hook SHALL re-check the backend via
`getToolset` and upgrade to success if the target level reads signed-in, so a login that completed
server-side is never reported as cancelled.

#### Scenario: Successful authorization

- **WHEN** the popup handshake reports success
- **THEN** `login` resolves success

#### Scenario: Popup blocked

- **WHEN** the browser blocks the popup
- **THEN** `login` resolves popup-blocked and no login request is issued

#### Scenario: Unusable OAuth configuration

- **WHEN** no authorize URL can be built from the supplied settings
- **THEN** `login` resolves failure and the handshake is never started

#### Scenario: Cancellation re-verified against the backend

- **WHEN** the handshake reports cancellation and `getToolset` shows the target level signed in
- **THEN** `login` resolves success

#### Scenario: Genuine cancellation stays cancelled

- **WHEN** the handshake reports cancellation and the backend still shows the level signed out, or
  the verification request rejects
- **THEN** `login` resolves cancelled

#### Scenario: Stale re-login keeps the popup user-gestured

- **WHEN** the caller forces a stale re-login for OAuth
- **THEN** the blank popup is opened before the logout is awaited, and the popup is navigated only
  after that logout resolves, so the browser still treats the open as user-triggered

### Requirement: OAuth callback completion hook

`@epam/ai-dial-chat-hooks` SHALL publish a callback-completion hook that runs inside the OAuth popup:
it reads the redirect state from the popup's own `sessionStorage`, clears it, removes the
authorization code from the visible URL before any request, validates the returned `state` against
the stored one, performs the exchange through an injected callback, then reports the outcome into the
popup URL and over the flow channel until acknowledged, closing the popup afterwards. It SHALL run
its effect once per mount even under StrictMode double-invocation, and SHALL expose the in-progress /
failed state so the host page can render and announce it.

#### Scenario: Successful exchange

- **WHEN** the provider returns a code with a matching state
- **THEN** the hook calls the injected exchange with that code and reports success

#### Scenario: State mismatch

- **WHEN** the returned `state` does not match the stored redirect state
- **THEN** no exchange is attempted and a state-mismatch failure is reported

#### Scenario: Missing code or redirect state

- **WHEN** the callback is reached with no code, or the popup holds no redirect state
- **THEN** no exchange is attempted and the corresponding failure reason is reported

#### Scenario: Exchange failure

- **WHEN** the injected exchange rejects
- **THEN** a login-request-failed outcome is reported

#### Scenario: Authorization code scrubbed before the request

- **WHEN** the hook has read its query parameters
- **THEN** the code is removed from the visible URL before the exchange is attempted, and no reported
  URL ever contains the code or any credential

#### Scenario: Reported until acknowledged

- **WHEN** the outcome is reported
- **THEN** it is written into the popup's own URL and repeated on the flow channel until the opener
  acknowledges it, after which the popup closes itself

#### Scenario: Exchange runs once

- **WHEN** the effect is invoked twice under StrictMode
- **THEN** exactly one exchange is performed

#### Scenario: Host renders the status

- **WHEN** the hook is in progress or has failed
- **THEN** it exposes that state and renders nothing itself, leaving the page shell to present and
  announce it in the host's own language

### Requirement: Host retains routing, i18n, and API dispatch

The consuming page SHALL remain app-owned. It supplies the callback path, the exchange callback, and
all user-visible text; it also owns any dispatch between multiple OAuth resource kinds, which the
hook sees only as its single injected exchange callback.

#### Scenario: Multiple resource kinds

- **WHEN** an application supports several OAuth resource kinds through one callback route
- **THEN** the page selects the API call for the stored resource kind and passes it as the exchange
  callback, and the hook contains no per-kind branching

#### Scenario: No translation in the lib

- **WHEN** the completion hook reports progress or failure
- **THEN** it returns state rather than text, and every string the user sees comes from the host page
