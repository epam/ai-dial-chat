## ADDED Requirements

### Requirement: BFF exposes external-service metadata lookup

The backend SHALL expose `GET /api/v1/external-services/:appId/:serviceId` (NestJS domain `apps/chat-api/src/external-services/`, `ExternalServicesController`, `@Controller({ path: 'external-services', version: '1' })`). `appId` and `serviceId` path segments SHALL be validated with an allowlist `@Matches` regex (safe resource-path/opaque-id character set) before being logged, forwarded to Core, or reflected in an error message. The service SHALL call `@epam/ai-dial-typescript-sdk`'s `getExternalService(appId, serviceId)` using the bearer access token from the caller's encrypted BFF session, and map the response into a response DTO exposing `displayName`, `description`, and `authenticationType` (`'OAUTH' | 'API_KEY' | 'NONE'`).

Request: no body.
Response: `200 { "displayName": string, "description": string, "authenticationType": "OAUTH" | "API_KEY" | "NONE" }`.
Error codes: `400` invalid `appId`/`serviceId` (allowlist rejection); `401` no valid BFF session; `403` `liveChatInteraction` flag resolves `false`; `404` Core reports the external service does not exist; `502` Core call fails/errors.
Generated-client impact: exposed through the generated `@epam/chat-api-client`, `operationIdFactory` name `getExternalService`; frontend calls it via a thin wrapper in `apps/chat/src/server-api/external-services.ts`, following the same pattern as `apps/chat/src/server-api/toolsets.ts`.
Rate limiting: standard `@Throttle` limits matching other read endpoints in `apps/chat-api/src/toolsets/toolsets.controller.ts`.
Cache: no server-side cache — always resolved fresh from Core so a stale `authenticationType`/`display_name` never blocks a signin-event row from rendering the correct login affordance.

#### Scenario: Metadata resolved successfully
- **WHEN** the frontend requests `GET /api/v1/external-services/applications%2Fpublic%2Ffinhub-via-openapi__1.0.0/finhub-api2`
- **THEN** the backend returns `200` with `displayName`, `description`, and `authenticationType` mapped from Core's `ExternalServiceData`

#### Scenario: Invalid path segment rejected before reaching Core
- **WHEN** `appId` or `serviceId` fails the allowlist validation
- **THEN** the backend returns `400` without calling Core or logging the raw invalid value

#### Scenario: External service not found
- **WHEN** Core responds `404` for the given `appId`/`serviceId`
- **THEN** the backend returns `404`

#### Scenario: Flag disabled rejects the request
- **WHEN** `liveChatInteraction` resolves to `false` for the caller
- **THEN** the backend returns `403` without contacting Core

### Requirement: BFF proxies external-service sign-in and sign-out

The backend SHALL expose `POST /api/v1/external-services/:appId/:serviceId/signin` and `POST /api/v1/external-services/:appId/:serviceId/signout`, both requiring a valid BFF session and both applying the standard global `CsrfGuard`. Both SHALL call `@epam/ai-dial-typescript-sdk`'s `externalServiceSignIn`/`externalServiceSignOut` operations with the session's bearer token, mapping the request DTO into the SDK's `ResourceSignInRequest`/`ResourceSignOutRequest` shape (`url` reconstructed from `appId`/`serviceId` server-side, `credentialsLevel`, `authenticationType`, and — for sign-in only — `apiKey` or `code`/`redirectUri`). Neither endpoint's request DTO, logs, or error messages SHALL ever include `apiKey` or `code` values; only `appId`, `serviceId`, `authenticationType`, and `credentialsLevel` SHALL be logged, matching `ToolsetsService.loginToolset`'s logging discipline.

`POST /api/v1/external-services/:appId/:serviceId/signin`:
- Request body (`ExternalServiceSigninBodyDto`): `{ "credentialsLevel": "GLOBAL" | "APPLICATION" | "USER", "authenticationType": "OAUTH" | "API_KEY", "apiKey"?: string, "code"?: string, "redirectUri"?: string }` — validated with `class-validator`; exactly one of `apiKey` (when `authenticationType` is `API_KEY`) or `code`+`redirectUri` (when `OAUTH`) SHALL be required, enforced at the DTO level.
- Response: `200 {}` on success (Core returns `boolean`; the backend maps a `false`/falsy Core response to a `502`, since a rejected sign-in is a Core-side failure, not a client error).
- Error codes: `400` invalid body or path segments; `401` no valid BFF session; `403` flag disabled; `502` Core rejects or errors.

`POST /api/v1/external-services/:appId/:serviceId/signout`:
- Request body (`ExternalServiceLogoutBodyDto`): `{ "credentialsLevel": "GLOBAL" | "APPLICATION" | "USER", "authenticationType": "OAUTH" | "API_KEY" }`.
- Response: `200 {}` on success; Core's `404` (nothing to sign out) SHALL be treated as idempotent success, mirroring the existing `logoutToolset` precedent.

Generated-client impact: both exposed through the generated `@epam/chat-api-client`, `operationIdFactory` names `signInExternalService` / `signOutExternalService`; frontend wrappers in `apps/chat/src/server-api/external-services.ts`.

#### Scenario: API key sign-in succeeds
- **WHEN** the frontend posts `{ credentialsLevel: "USER", authenticationType: "API_KEY", apiKey: "<key>" }` for a valid `appId`/`serviceId`
- **THEN** the backend forwards a `ResourceSignInRequest` to Core via `externalServiceSignIn` and returns `200` on a truthy Core response

#### Scenario: Core rejects the sign-in
- **WHEN** Core's `externalServiceSignIn` call returns a falsy result or errors
- **THEN** the backend returns `502` and does not treat the call as successful

#### Scenario: OAuth sign-in forwards code and redirect URI
- **WHEN** the frontend posts `{ credentialsLevel: "USER", authenticationType: "OAUTH", code: "<code>", redirectUri: "<uri>" }`
- **THEN** the backend forwards both values to Core's `externalServiceSignIn` and never logs the `code` value

#### Scenario: Sign-out on an already-signed-out service
- **WHEN** `POST /api/v1/external-services/:appId/:serviceId/signout` targets credentials Core responds to with `404`
- **THEN** the backend returns `200` (idempotent)

#### Scenario: Flag disabled rejects sign-in and sign-out
- **WHEN** `liveChatInteraction` resolves to `false` for the caller
- **THEN** both `signin` and `signout` return `403` without contacting Core

#### Scenario: Secrets never logged
- **WHEN** the backend logs a sign-in attempt at debug level
- **THEN** the log line includes `appId`, `serviceId`, `authenticationType`, and `credentialsLevel` but never `apiKey` or `code`
