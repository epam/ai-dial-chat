# bff-auth-session-metrics Specification

## Purpose

Make the BFF's authentication and session decisions observable — login starts, OIDC callback
processing, refresh-token exchanges, `SessionGuard` authorization outcomes, and logout — with
bounded attributes, so an identity-provider problem, a rejected caller, and a BFF-side fault are
distinguishable from each other and from the HTTP status coverage the transport instruments
already provide.

## Requirements

### Requirement: Six auth instruments with bounded attribute values

The application SHALL record `dial.chat.auth.login.started` (counter, `{operation}`),
`dial.chat.auth.callback.duration` (histogram, `s`), `dial.chat.auth.refresh.duration`
(histogram, `s`), `dial.chat.auth.refresh.coalesced` (counter, `{request}`),
`dial.chat.auth.authorization` (counter, `{request}`), and `dial.chat.auth.logout` (counter,
`{operation}`) on the `dial-chat-api` meter scope. Every attribute value SHALL come from a fixed
enum. The application SHALL NOT record a subject, session id, CSRF token, access or refresh
token, redirect URL, or exception message as an attribute value.

#### Scenario: A provider id from the request path cannot grow attribute cardinality

- **WHEN** a client requests a login or callback for a provider id that this build cannot
  construct a provider for
- **THEN** the recorded `dial.chat.auth.provider` attribute is the bounded literal `unknown`

#### Scenario: Request-scoped identifiers never reach an attribute

- **WHEN** any of the six instruments records a data point
- **THEN** no attribute value equals the session's id, subject, access token, or refresh token

### Requirement: Login starts count issued redirects, not sign-ins

`dial.chat.auth.login.started` SHALL be incremented when the redirect to the identity provider
is actually issued, and SHALL NOT be incremented for a login request that fails before that
redirect. It SHALL NOT be interpreted as a count of successful sign-ins.

#### Scenario: Unconfigured provider is not counted as a login start

- **WHEN** a login is requested for a provider that is not configured
- **THEN** the request fails before the redirect
- **AND** `dial.chat.auth.login.started` records no data point for it

### Requirement: One terminal callback observation per processed callback

`dial.chat.auth.callback.duration` SHALL record exactly one data point per callback the
application processed, on every exit path, with `dial.chat.auth.outcome` in `success`,
`validation_rejected`, `exchange_failed`, `internal_error`. It SHALL measure only the
application's own callback processing and SHALL NOT include the time the user spent on the
identity provider.

#### Scenario: A refused callback is distinguished from a failed exchange

- **WHEN** a callback is refused before the code exchange (identity-provider error, missing code
  or state, missing/expired/unreadable transaction cookie, state, provider, or issuer mismatch,
  or an unconfigured provider)
- **THEN** the recorded outcome is `validation_rejected`
- **AND** **WHEN** instead the authorization-code exchange with the identity provider fails
- **THEN** the recorded outcome is `exchange_failed`

### Requirement: Refresh duration observes real exchanges; coalesced callers are counted separately

`dial.chat.auth.refresh.duration` SHALL record exactly one data point per refresh-token exchange
actually performed against the identity provider, with `dial.chat.auth.outcome` in `refreshed`,
`race_absorbed`, `invalid_grant`, `upstream_error`. A request that joins an exchange already in
flight for the same session SHALL increment `dial.chat.auth.refresh.coalesced` and SHALL NOT
contribute a duration observation.

#### Scenario: An absorbed rotation race is its own outcome

- **WHEN** the exchange fails with `invalid_grant` while the session's access token is still valid
- **THEN** the recorded outcome is `race_absorbed`
- **AND** no `refreshed` or `invalid_grant` data point is recorded for that exchange

#### Scenario: A coalesced caller does not inflate the exchange count

- **WHEN** two concurrent requests for the same session need a refresh on the same instance
- **THEN** `dial.chat.auth.refresh.duration` records exactly one data point
- **AND** `dial.chat.auth.refresh.coalesced` is incremented exactly once

### Requirement: One counted authorization decision per guarded request

`dial.chat.auth.authorization` SHALL record exactly one data point per request on which
`SessionGuard` makes an authorization decision, attributed with the matching strategy's own
credential source (or `none` when no strategy claimed the request), an outcome of `accepted` or
`rejected`, and a bounded reason derived from the strategy's own error code. A route marked
`@Public()` SHALL NOT produce a data point, because it makes no authorization decision.

#### Scenario: A rejection is attributed to the strategy that rejected it

- **WHEN** a supported strategy throws while authenticating a request
- **THEN** the data point's source is that strategy's credential source
- **AND** its reason is the bounded reason for that strategy's error code

#### Scenario: A valid credential with an unavailable dependency is not a rejected caller

- **WHEN** authentication succeeds but resolving the caller's DIAL Core bucket fails
- **THEN** the recorded reason is `bucket_unavailable`, distinct from every credential-rejection
  reason

#### Scenario: Public routes are not counted

- **WHEN** a request reaches a route marked `@Public()`
- **THEN** `dial.chat.auth.authorization` records no data point for it

### Requirement: Logout records the local result and the revocation outcome separately

`dial.chat.auth.logout` SHALL record exactly one data point per logout, with
`dial.chat.auth.result` in `cookie_cleared`, `header_noop`, `origin_rejected` and
`dial.chat.auth.revocation` in `success`, `failed`, `not_attempted`. A failed revocation SHALL
NOT fail the logout. `cookie_cleared` SHALL NOT be presented as a confirmed federated logout at
the identity provider.

#### Scenario: A failed best-effort revocation is visible without changing the logout result

- **WHEN** the session cookie is cleared and the token revocation call fails
- **THEN** the recorded result is `cookie_cleared` and the recorded revocation is `failed`
- **AND** the logout still completes with its redirect

### Requirement: Explicit, stable duration bucket boundaries

Both auth histograms SHALL declare explicit bucket boundaries in seconds —
`0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 10, 30, 60` — rather than the SDK defaults,
whose first positive boundary is 5 seconds. The largest finite boundary SHALL match the HTTP
transport histogram's, so one last-finite-bucket guard serves both. These boundaries SHALL NOT be
changed under the same metric names; a different layout requires a new metric family.

#### Scenario: Sub-second exchanges are measurable

- **WHEN** a callback or refresh exchange completes in under one second
- **THEN** its duration falls in a sub-second bucket rather than the first default bucket

### Requirement: No server-side active-session signal is claimed

This capability SHALL NOT expose an active-sessions gauge, a user count, or a login success rate.
The BFF holds no server-side session state, and one browser session produces many authorization
decisions and several refresh exchanges. The documentation for these metrics SHALL state that
limit rather than presenting a counter as a session or user count.

#### Scenario: The callback-to-login ratio is presented as approximate

- **WHEN** a dashboard panel compares callbacks with login starts
- **THEN** the panel states that the ratio is approximate and is not a login success rate

### Requirement: Importable auth and sessions dashboard

The repository SHALL ship an importable Grafana dashboard at
`docs/examples/dashboards/05-bff-auth-sessions.json` covering login redirects, callback outcomes
and latency, refresh exchanges and coalesced callers, authorization decisions and bounded
rejection reasons, and logout results with revocation outcome. Its identity-provider template
variable SHALL be applied only to the instruments that carry a provider attribute. Percentile
panels SHALL aggregate buckets by `le` and SHALL suppress a quantile that falls above the largest
finite boundary.

#### Scenario: The provider filter is not applied where the attribute does not exist

- **WHEN** the dashboard queries the authorization or logout counters
- **THEN** those queries carry no `dial_chat_auth_provider` selector

#### Scenario: Metric contracts are documented in the same change

- **WHEN** these instruments, their attribute values, or their bucket boundaries change
- **THEN** `docs/observability.md`'s auth metric-contract section is updated in the same change
