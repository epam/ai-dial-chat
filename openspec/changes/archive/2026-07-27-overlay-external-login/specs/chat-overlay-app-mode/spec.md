## MODIFIED Requirements

### Requirement: Overlay mode is detected from runtime config, framing, and origin — not a build-time flag

The app SHALL treat overlay mode as eligible only when all of: (a) `AppConfigContext.config` reports the overlay-enabled flag from `chat-overlay-security-config` as true, (b) `window.self !== window.top` (the app is actually framed), and (c) no origin check performed so far has failed. None of these alone is sufficient.

While the app is framed and `AppConfigContext.status === 'loading'`, `OverlayModeGate` SHALL render `null` instead of rendering children without `OverlayProvider`. This prevents `RequireAuth` from mounting in a transient non-overlay state and starting the normal unauthenticated `/login` redirect inside the iframe before the runtime overlay flag is known. Top-level (not framed) rendering MUST NOT be delayed by this rule.

`RequireAuth`'s presentation while `status === AuthStatus.Loading` is unchanged by this requirement: in overlay-eligible mode, the library-visible loader stays up (no app-rendered content) until the handshake's `READY` event, matching non-overlay behavior of showing nothing meaningful until auth resolves.

`RequireAuth`'s presentation while `status === AuthStatus.Unauthenticated` in overlay-eligible mode is replaced by the overlay login gate defined in `overlay-external-login` (a focusable "Log in" affordance that opens the BFF login flow in an external tab/window) instead of the loader staying up indefinitely — because, unlike the `Loading` state (which always resolves once the session bootstrap completes), an `Unauthenticated` overlay session has no automatic path to `Authenticated` once the automatic redirect is disabled (see `spa-auth-session`), so a loader-only presentation would leave the user with no way to proceed. This is a presentation change scoped to overlay mode only; non-overlay behavior (automatic redirect, per `spa-auth-session`) is unchanged.

#### Scenario: Not framed, config enabled → normal mode

- **WHEN** overlay-enabled config is true but `window.self === window.top`
- **THEN** the app runs in normal (non-overlay) mode

#### Scenario: Framed, config disabled → normal mode (embedding still blocked by CSP)

- **WHEN** the app is framed but the overlay-enabled config flag is false
- **THEN** the app does not enter overlay mode (and CSP `frame-ancestors` from `chat-overlay-security-config` denies the embed regardless)

#### Scenario: Framed, config enabled → overlay mode

- **WHEN** the app is framed and overlay-enabled config is true
- **THEN** the app enters overlay mode and mounts `OverlayProvider`

#### Scenario: Framed, config still loading → no transient normal-mode redirect

- **WHEN** the app is framed and `AppConfigContext.status === 'loading'`
- **THEN** `OverlayModeGate` renders `null`, so `RequireAuth` is not mounted without overlay context and cannot start the normal iframe login redirect

#### Scenario: Not framed, config still loading → normal top-level rendering

- **WHEN** `AppConfigContext.status === 'loading'` and `window.self === window.top`
- **THEN** `OverlayModeGate` does not delay rendering its children

#### Scenario: Overlay mode, session loading → loader stays up

- **WHEN** the app is in overlay mode and `status === AuthStatus.Loading`
- **THEN** `RequireAuth` renders `null` and the library's own host-page loader remains the only visible loading indicator

#### Scenario: Overlay mode, session unauthenticated → login gate, no automatic redirect

- **WHEN** the app is in overlay mode and `status === AuthStatus.Unauthenticated`
- **THEN** `RequireAuth` does not call `window.location.assign` or `navigate` to start the BFF login flow, and instead renders the overlay login gate described in `overlay-external-login`
