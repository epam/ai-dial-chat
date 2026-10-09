# Delta: offline-credentials

## ADDED Requirements

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
