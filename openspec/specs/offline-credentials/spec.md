# offline-credentials Specification

## Purpose

Provide authenticated, uncached offline-credentials status, OAuth sign-in, and grant sign-out for proactive Scheduled Tasks login and reactive DIAL-native chat interrupts.

## Requirements

### Requirement: Offline-credentials status endpoint
The system SHALL expose `GET /api/v1/offline-credentials`, proxying DIAL
Core's `GET /v1/user/offline-credentials` via `DialClientService` using the
session user's bearer access token, and SHALL require a valid session and
at least one of `scheduledTasksEnabled` or `liveChatInteraction` before returning a response. Both flags SHALL be evaluated for the same caller and roles. No new flag is introduced.

The response SHALL additionally carry `schedulerServiceConsent`, the consent state of the `DIAL_NATIVE` scheduler external service, read per request (never cached) from Core's application resource via the shared consent read owned by `SchedulerConsentService` (`apps/chat-api/src/external-services/scheduler-consent.service.ts`) — the same read `ScheduledTasksService.assertSchedulerConsent` applies to mutations. The read starts before the Core status call is awaited (the two round-trips run in parallel) and is bounded by an application deadline — past it, the abort cancels the upstream reads and the field defers to `unknown`. The field SHALL take the value `signed_out` only when the scheduler service's `appLevelAuthStatus` reports an explicit `SIGNED_OUT` on a `DIAL_NATIVE` service; `signed_in` when it reports `SIGNED_IN`; and `unknown` when the read itself fails (logged at warn) — including a non-`DIAL_NATIVE` scheduler service, an absent status, or any unexpected value. A failed consent read SHALL NOT fail the status call: `available` and `connected` keep their meaning and the endpoint still returns `200` with `schedulerServiceConsent: 'unknown'`.

Example — consent revoked, user connected:

```
GET /api/v1/offline-credentials
→ 200
{
  "available": true,
  "connected": true,
  "schedulerServiceConsent": "signed_out"
}
```

Generated-client impact: no new endpoint or operation; the existing `operationId: getOfflineCredentials` response DTO `GetOfflineCredentialsResponseDto` gains the required enum field `schedulerServiceConsent` (generated enum `SchedulerServiceConsentStatus`: `signed_in` / `signed_out` / `unknown`, lowercase values — Core's `SIGNED_IN`/`SIGNED_OUT` literals are mapped, not relayed). Frontend callers keep using the normal (non-`Raw`) generated methods. `OpenAPI` regeneration and `libs/chat-api-client` rebuild ship with this change.

No telemetry is added; a failed consent read emits a server-side warn log only. The endpoint's `Cache-Control: private, no-store` header applies to the consent field with no separate TTL or cache key.

#### Scenario: Authenticated user with available, unconnected credentials
- **WHEN** a session-authenticated user with `scheduledTasksEnabled` calls
  `GET /api/v1/offline-credentials` and DIAL Core reports
  `{ available: true, connected: false, connect: {...} }`
- **THEN** the endpoint returns `200` with
  `{ available: true, connected: false, schedulerServiceConsent, connect: { authorizationEndpoint, clientId, redirectUri?, scopes } }`
  (camelCase, mapped from Core's snake_case fields by `mapDialOfflineCredentialsToDto`); `redirectUri` is
  optional in `OfflineCredentialsConnectDto` and emitted only when Core sends `redirect_uri`, and `scopes`
  defaults to `[]` when Core omits it

#### Scenario: Scheduler consent state is relayed per request
- **WHEN** the scheduler external service reports `appLevelAuthStatus: 'SIGNED_OUT'` (never granted or revoked — Core reports both identically), `SIGNED_IN`, or the scheduler service is not `DIAL_NATIVE`
- **THEN** the response carries `schedulerServiceConsent: 'signed_out'`, `'signed_in'`, or `'unknown'` respectively, read fresh on every request with no caching

#### Scenario: Failed consent read does not fail the status call
- **WHEN** the consent read of the scheduler external service throws (HTTP or network error)
- **THEN** the endpoint logs a warning and returns `200` with the correct `available`/`connected` and `schedulerServiceConsent: 'unknown'`

#### Scenario: Consent read runs in parallel with the Core status call
- **WHEN** the status endpoint reads the scheduler service consent
- **THEN** the consent read starts before the Core status call is awaited, so the status response pays one round-trip of added latency instead of two in series

#### Scenario: Stalled consent read is bounded by a deadline
- **WHEN** the scheduler-metadata read (including its fallback reads) stalls and does not settle within the read deadline
- **THEN** the deadline aborts the upstream reads, the endpoint logs a warning, and the response returns `200` with the correct `available`/`connected` and `schedulerServiceConsent: 'unknown'` instead of being held open

#### Scenario: Missing scheduler configuration defers to unknown
- **WHEN** `SCHEDULER_APP_ID` or `SCHEDULER_SERVICE_ID` is unset so the scheduler identity cannot be resolved
- **THEN** the status call is not failed by the consent read and the response carries `schedulerServiceConsent: 'unknown'`

#### Scenario: Incomplete upstream connect object is dropped
- **WHEN** DIAL Core's `connect` lacks `authorization_endpoint` or `client_id`
- **THEN** the endpoint returns `{ available, connected, schedulerServiceConsent }` with no `connect` object

#### Scenario: Missing upstream redirect URI keeps connect usable
- **WHEN** DIAL Core's `connect` has `authorization_endpoint` and `client_id` but no `redirect_uri`
- **THEN** the returned `connect` contains `authorizationEndpoint`, `clientId`, and `scopes` and omits `redirectUri`

#### Scenario: Credentials already connected
- **WHEN** DIAL Core reports `{ available: true, connected: true }`
- **THEN** the endpoint returns `200` with `{ available: true, connected: true, schedulerServiceConsent }`
  and no `connect` object

#### Scenario: Missing optional upstream fields
- **WHEN** DIAL Core omits `available`, `connected`, or `connect` entirely
- **THEN** the endpoint applies safe defaults (`available: false`,
  `connected: false`, no `connect`) rather than throwing or returning `undefined` fields

#### Scenario: No session
- **WHEN** the caller has no valid session cookie
- **THEN** the endpoint returns `401` before invoking DIAL Core

#### Scenario: Feature disabled
- **WHEN** neither `scheduledTasksEnabled` nor `liveChatInteraction` is enabled for the caller
- **THEN** the endpoint returns `403`

#### Scenario: Upstream error
- **WHEN** DIAL Core returns a non-OK response to the offline-credentials status call
- **THEN** the endpoint applies the shared `mapDialHttpStatus` mapping, including `429` for an upstream rate-limit response and `502` for upstream server errors

#### Scenario: Upstream unreachable
- **WHEN** DIAL Core is unreachable or times out on the offline-credentials status call
- **THEN** the endpoint returns `503`

#### Scenario: Response is never cached
- **WHEN** any client or intermediary receives a response from this endpoint
- **THEN** the response includes `Cache-Control: private, no-store`

#### Scenario: Live chat enabled without Scheduled Tasks
- **WHEN** `liveChatInteraction` is enabled and `scheduledTasksEnabled` is disabled for an authenticated caller
- **THEN** the status endpoint permits the request and returns Core's mapped status with the `schedulerServiceConsent` field
### Requirement: Offline-credentials sign-in endpoint
The system SHALL expose `POST /api/v1/offline-credentials/signin`, proxying
DIAL Core's `POST /v1/user/offline-credentials/signin` via
`DialClientService`, accepting `{ code, redirectUri }`, and SHALL validate
`redirectUri` against an app-owned allowlist before forwarding it upstream. The endpoint SHALL require a valid session, the standard CSRF checks, and at least one of `scheduledTasksEnabled` or `liveChatInteraction`.

#### Scenario: Successful sign-in
- **WHEN** a session-authenticated, feature-enabled user submits a valid
  `code` and an allowlisted `redirectUri`, and DIAL Core's
  `offlineCredentialsSignIn` resolves to the literal boolean `true`
- **THEN** the endpoint returns `200` with `{ success: true }`

#### Scenario: Upstream reports failure via literal false
- **WHEN** DIAL Core's `offlineCredentialsSignIn` resolves to the literal
  boolean `false`
- **THEN** the endpoint returns `502` and never returns `{ success: true }`

#### Scenario: Disallowed redirect URI
- **WHEN** the submitted `redirectUri` does not resolve to the configured
  `AUTH_CALLBACK_BASE_URL` origin and an app-owned callback path
- **THEN** the endpoint returns `400` and does not forward the request to
  DIAL Core

#### Scenario: Missing or empty code
- **WHEN** `code` is missing, empty, or not a string
- **THEN** the endpoint returns `400`

#### Scenario: No session
- **WHEN** the caller has no valid session cookie
- **THEN** the endpoint returns `401`

#### Scenario: Feature disabled
- **WHEN** neither `scheduledTasksEnabled` nor `liveChatInteraction` is enabled for the caller
- **THEN** the endpoint returns `403`

#### Scenario: Upstream error
- **WHEN** DIAL Core returns a non-OK response (`response.error`)
- **THEN** the endpoint applies the shared `mapDialHttpStatus` mapping, including `429` for an upstream rate-limit response and `502` for upstream server errors, with the upstream message when the mapper permits it

#### Scenario: Upstream unreachable
- **WHEN** DIAL Core is unreachable or times out
- **THEN** the endpoint returns `503`

#### Scenario: Live chat OAuth exchange without Scheduled Tasks
- **WHEN** `liveChatInteraction` is enabled, `scheduledTasksEnabled` is disabled, and the authenticated caller submits a valid code, allowlisted redirect URI, and required CSRF header
- **THEN** the endpoint permits the exchange and returns `200 { "success": true }` when Core confirms success

### Requirement: Offline-credentials signout endpoint

The system SHALL expose `POST /api/v1/offline-credentials/signout`, proxying DIAL Core's `POST /v1/user/offline-credentials/signout` via `DialClientService` using the session user's bearer access token, with **no request body**. A valid session and at least one of `scheduledTasksEnabled` or `liveChatInteraction` SHALL be required (per-handler feature-guard placement, mirroring the `signin` handler). Responses SHALL be `Cache-Control: private, no-store`.

A DIAL Core `404` SHALL be treated as **idempotent success** (there was no grant left to revoke), mirroring `ExternalServicesService.signOut`'s 404 handling. Any other Core error SHALL map through the domain's existing `mapDialHttpStatus`/`handleDialFetchError` discipline; falsy Core data SHALL produce `502` ("Core reported failure"). The authorization token SHALL never be logged.

Generated-client impact: the endpoint adds OpenAPI operationId **`signOutOfflineCredentials`** (SDK method on `OfflineCredentialsApi`), no request DTO, response DTO `OfflineCredentialsAuthResultDto` — consumed by the frontend through the thin wrapper in `apps/chat/src/server-api/offline-credentials.ts` using the normal (non-`Raw`) generated method. No `ApiEndpoints` enum entry (generated-client domain).

#### Scenario: Connected user signs out

- **WHEN** a session-authenticated user with `scheduledTasksEnabled` calls `POST /api/v1/offline-credentials/signout` with no body and DIAL Core revokes the grant and responds `200`
- **THEN** the endpoint returns `200` with `{ "success": true }`

#### Scenario: No session

- **WHEN** the caller has no valid session cookie
- **THEN** the endpoint returns `401` before invoking DIAL Core

#### Scenario: Feature disabled

- **WHEN** neither `scheduledTasksEnabled` nor `liveChatInteraction` is enabled for the caller
- **THEN** the endpoint returns `403`

#### Scenario: Core 404 is idempotent success

- **WHEN** DIAL Core responds `404` (no grant stored for the user)
- **THEN** the endpoint returns `200` with `{ "success": true }` — not an error status

#### Scenario: Core error maps to 502

- **WHEN** DIAL Core responds with an error other than `404`, or returns a falsy body
- **THEN** the endpoint returns `502` with the domain's standard error mapping

#### Scenario: Core unreachable

- **WHEN** DIAL Core is unreachable
- **THEN** the endpoint returns `503`

### Requirement: Offline-credentials generated client

The application SHALL use the normal generated `OfflineCredentialsApi.getOfflineCredentials`, `OfflineCredentialsApi.signInOfflineCredentials`, and `OfflineCredentialsApi.signOutOfflineCredentials` methods through `apps/chat/src/server-api/offline-credentials.ts`. The contract SHALL use `GetOfflineCredentialsResponseDto`, `OfflineCredentialsSigninBodyDto`, and `OfflineCredentialsAuthResultDto`; transport configuration and auth SHALL remain at the application edge.

#### Scenario: OAuth request uses the generated contract
- **WHEN** the callback submits `{ "code": "authorization-code", "redirectUri": "https://chat.example.com/auth/toolset-signin" }`
- **THEN** the app adapter calls the generated `signInOfflineCredentials` operation and receives `{ "success": true }` on HTTP 200

### Requirement: Offline-credentials logging discipline
The system SHALL log offline-credentials operations at `debug`/`warn`/`error`
levels for observability, and SHALL NOT log authorization codes, tokens,
cookies, or full request/response bodies of the sign-in call.

#### Scenario: Sign-in attempt is logged without the code value
- **WHEN** a sign-in request is received
- **THEN** any debug log line for the request includes the redirect URI and
  the length of the code, and never the code's value

#### Scenario: Upstream failure is logged
- **WHEN** DIAL Core returns a non-OK response to the status call
- **THEN** `mapDialHttpStatus` logs a `warn` with the upstream status and, when an error body is present, a
  second `warn` with the JSON-serialized upstream error body, before throwing the mapped exception whose
  text is the message extracted by `extractDialErrorMessage` where the mapper permits it

#### Scenario: Sign-in failure is logged without the response body
- **WHEN** DIAL Core returns a non-OK response to the sign-in call
- **THEN** `mapDialHttpStatus` logs a single `warn` with the upstream status and operation context only —
  the upstream error body is not passed to it and is never logged — before throwing the mapped exception
  whose text is the message extracted by `extractDialErrorMessage` where the mapper permits it
- **AND** the sign-in response debug line records only the status and whether data/error were present,
  never the serialized response data
