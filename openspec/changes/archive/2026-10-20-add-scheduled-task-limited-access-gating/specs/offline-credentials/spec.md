# offline-credentials delta

## MODIFIED Requirements

### Requirement: Offline-credentials status endpoint
The system SHALL expose `GET /api/v1/offline-credentials`, proxying DIAL
Core's `GET /v1/user/offline-credentials` via `DialClientService` using the
session user's bearer access token, and SHALL require a valid session and
at least one of `scheduledTasksEnabled` or `liveChatInteraction` before returning a response. Both flags SHALL be evaluated for the same caller and roles. No new flag is introduced.

The response SHALL additionally carry `schedulerServiceConsent`, the consent state of the `DIAL_NATIVE` scheduler external service, read per request (never cached) from Core's application resource via the shared consent read owned by `SchedulerConsentService` (`apps/chat-api/src/external-services/scheduler-consent.service.ts`) — the same read `ScheduledTasksService.assertSchedulerConsent` applies to mutations. The field SHALL take the value `signed_out` only when the scheduler service's `appLevelAuthStatus` reports an explicit `SIGNED_OUT` on a `DIAL_NATIVE` service; `signed_in` when it reports `SIGNED_IN`; and `unknown` when the read itself fails (logged at warn) — including a non-`DIAL_NATIVE` scheduler service, an absent status, or any unexpected value. A failed consent read SHALL NOT fail the status call: `available` and `connected` keep their meaning and the endpoint still returns `200` with `schedulerServiceConsent: 'unknown'`.

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
