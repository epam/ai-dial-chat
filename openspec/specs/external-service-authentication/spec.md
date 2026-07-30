# external-service-authentication Specification

## Purpose

BFF proxying of DIAL Core's application external-service metadata/sign-in/sign-out operations, driving the mid-completion `external-service/signin` interrupt.

## Requirements

### Requirement: Application external-service metadata is resolved via a dedicated endpoint

The backend SHALL expose `GET /api/v1/external-services/:appId/:serviceId` (NestJS domain `apps/chat-api/src/external-services/`, `ExternalServicesController`, `@Controller({ path: 'external-services', version: '1' })`), requiring a valid BFF session. `:appId` is the application's own resource id (the `external-service/signin` event's `params.url` with the `/external_services/{serviceId}` suffix removed); `:serviceId` is that suffix's final segment. Both path segments SHALL be validated with an allowlist `@Matches` regex (`DEPLOYMENT_ID_PATTERN`) before being logged, forwarded to Core, or reflected in an error message.

DIAL Core's application resource (`GET .../applications/{appId}`, via `getApplication`) does NOT include an `external_services` map in its response — a real Core application payload was confirmed to have no such field, even for applications that declare external services. Metadata SHALL instead come from `@epam/ai-dial-typescript-sdk`'s dedicated `getExternalService(appid, serviceId)` operation (`GET /v1/applications/{appid}/external-services/{serviceId}`), a separate REST resource from `getApplication`. The SDK's URL template already contains the literal `applications/` segment, so `appid` there is the app's `{bucket}/{path}` portion only, WITHOUT the `applications/` prefix — the backend SHALL strip that prefix from the route's `:appId` (which is the app's full resource id, e.g. `applications/public/finhub-via-openapi__1.0.0`) via `toDialExternalServiceAppId` before calling the SDK, or Core 404s on the doubled path with `Application not found: applications/{bucket}/{path}` (confirmed against a real Core instance). This stripping applies ONLY to this metadata call — sign-in/sign-out (below) still send the full `applications/`-prefixed id as part of the reconstructed scope id. The backend maps Core's response onto `GetExternalServiceResponseDto`: `displayName`, `description?`, `authenticationType` (`NONE` | `API_KEY` | `OAUTH`, defaulting to `NONE` when Core omits it), `userLevelAuthStatus?`, `globalAuthStatus?`, `clientId?`, `authorizationEndpoint?`, `scopesSupported?`, `codeChallenge?`, `codeChallengeMethod?`.

#### Scenario: Metadata resolved via the dedicated endpoint
- **WHEN** the frontend requests `GET /api/v1/external-services/applications%2Fpublic%2Ffinhub-via-openapi__1.0.0/finhub-api2`
- **THEN** the backend calls Core's `getExternalService('public/finhub-via-openapi__1.0.0', 'finhub-api2')` (the `applications/` prefix stripped) and returns `200` with `displayName`, `authenticationType`, and any auth fields Core provides

#### Scenario: Unknown service returns 404
- **WHEN** Core's `getExternalService` responds `404` for the given `appId`/`serviceId` pair
- **THEN** the backend returns `404`

### Requirement: BFF proxies external-service sign-in and sign-out using the full scope id

The backend SHALL expose `POST /api/v1/external-services/:appId/:serviceId/signin` and `POST /api/v1/external-services/:appId/:serviceId/signout`, both requiring a valid BFF session and both applying the standard global `CsrfGuard`. `:appId` and `:serviceId` SHALL be validated with the same allowlist `@Matches` regex as the metadata endpoint before being logged, forwarded to Core, or reflected in an error message.

DIAL Core requires the *full* external-service scope id (`{appId}/external_services/{serviceId}` — the `external-service/signin` event's original `params.url`) as the generic `ResourceSignInRequest`/`ResourceSignOutRequest` `url` field; Core rejects a bare application id with `400 Invalid external service scope id: <id>`. The frontend sends `appId` and `serviceId` as separate path segments (mirroring the metadata endpoint and `buildExternalServiceScopeId`'s split); the backend reconstructs the full scope id server-side (`toDialExternalServiceUrl(appId, serviceId)`, `apps/chat-api/src/external-services/external-services.mapper.ts`) before forwarding it as `url` — the frontend never assembles or sends the composite scope id itself over the wire.

Both endpoints SHALL call `@epam/ai-dial-typescript-sdk`'s `externalServiceSignIn`/`externalServiceSignOut` operations with the session's bearer token. Neither endpoint's request DTO, logs, or error messages SHALL ever include `apiKey` or `code` values; only the scope id, `authenticationType`, and `credentialsLevel` SHALL be logged, matching `ToolsetsService.loginToolset`'s logging discipline. On any non-2xx Core response, the backend SHALL log Core's own error body (via `extractDialErrorMessage`) and surface it as the thrown exception's message, so the real rejection reason (e.g. an invalid scope id) is visible both in server logs and to the client — not just a generic status-code message.

`POST /api/v1/external-services/:appId/:serviceId/signin`:
- Request body (`ExternalServiceSigninBodyDto`): `{ "credentialsLevel": "GLOBAL" | "APPLICATION" | "USER", "authenticationType": "OAUTH" | "API_KEY", "apiKey"?: string, "code"?: string, "redirectUri"?: string }` — validated with `class-validator`; exactly one of `apiKey` (when `authenticationType` is `API_KEY`) or `code`+`redirectUri` (when `OAUTH`) SHALL be required, enforced at the DTO level.
- Response: `200 {}` on success (Core returns `boolean`; the backend maps a `false`/falsy Core response to a `502`, since a rejected sign-in is a Core-side failure, not a client error).
- Error codes: `400` invalid body, invalid `appId`/`serviceId` path segment, or Core rejects the reconstructed scope id/request shape; `401` no valid BFF session; `403` flag disabled; `502` Core rejects or errors for another reason.

`POST /api/v1/external-services/:appId/:serviceId/signout`:
- Request body (`ExternalServiceLogoutBodyDto`): `{ "credentialsLevel": "GLOBAL" | "APPLICATION" | "USER", "authenticationType": "OAUTH" | "API_KEY" }`.
- Response: `200 {}` on success; Core's `404` (nothing to sign out) SHALL be treated as idempotent success, mirroring the existing `logoutToolset` precedent.

All three endpoints SHALL apply the `FeatureGuard`/`@RequireFeature(FeatureKey.LiveChatInteraction)` decorators at the individual route-method level (not the controller class level — `FeatureGuard` only reads method-level reflector metadata via `executionContext.getHandler()`), returning `403` when the flag resolves to `false` for the caller.

The global `ValidationPipe`'s `exceptionFactory` SHALL log each rejected request's `{ property, constraints }` pairs at `warn` level (never the submitted `value`, since validated DTOs across the app can carry secrets such as `apiKey`/`code`) before returning the standard `400 Bad Request` — this applies to every DTO-validated endpoint in `chat-api`, not just this capability, and is what makes a silent DTO-validation rejection (e.g. a missing required `apiKey`) diagnosable from server logs alone.

Generated-client impact: `npm run openapi` is currently blocked by a pre-existing, unrelated bug in `apps/chat-api/src/app-config/app-config.service.ts` (a `packageJson.version` import that breaks under `swc-node`'s CJS/ESM interop, reproducible on a clean checkout with none of this capability's files present). All three endpoints ARE declared with Swagger `@ApiOperation`/`operationIdFactory` names `getExternalService` / `signInExternalService` / `signOutExternalService` and are intended to be exposed through the generated `@epam/chat-api-client`; until the bug is fixed and the client regenerated, `apps/chat/src/server-api/external-services.ts` hand-writes the request/response types and calls (matching the DTOs exactly) using the raw `get`/`post` helpers from `apps/chat/src/server-api/base.ts`.

#### Scenario: API key sign-in succeeds
- **WHEN** the frontend posts `{ credentialsLevel: "USER", authenticationType: "API_KEY", apiKey: "<key>" }` to `POST /api/v1/external-services/applications%2Fpublic%2Ffinhub-via-openapi__1.0.0/finhub-api2/signin`
- **THEN** the backend forwards a `ResourceSignInRequest` with `url` set to `applications/public/finhub-via-openapi__1.0.0/external_services/finhub-api2` to Core via `externalServiceSignIn` and returns `200` on a truthy Core response

#### Scenario: Core rejects an invalid scope id
- **WHEN** the reconstructed scope id is malformed and Core responds `400 Invalid external service scope id: ...`
- **THEN** the backend logs Core's error body and returns `400` with that same message

#### Scenario: Core rejects the sign-in
- **WHEN** Core's `externalServiceSignIn` call returns a falsy result or errors
- **THEN** the backend returns `502` and does not treat the call as successful

#### Scenario: OAuth sign-in forwards code and redirect URI
- **WHEN** the frontend posts `{ credentialsLevel: "USER", authenticationType: "OAUTH", code: "<code>", redirectUri: "<uri>" }`
- **THEN** the backend forwards both values to Core's `externalServiceSignIn` and never logs the `code` value

#### Scenario: Sign-out on an already-signed-out service
- **WHEN** `POST /api/v1/external-services/:appId/:serviceId/signout` targets credentials Core responds to with `404`
- **THEN** the backend returns `200` (idempotent)

#### Scenario: Flag disabled rejects metadata, sign-in, and sign-out
- **WHEN** `liveChatInteraction` resolves to `false` for the caller
- **THEN** the metadata `GET`, `signin`, and `signout` routes all return `403` without contacting Core

#### Scenario: Invalid appId or serviceId rejected before reaching Core
- **WHEN** the `:appId` or `:serviceId` path segment fails the allowlist validation
- **THEN** the backend returns `400` without calling Core or logging the raw invalid value

#### Scenario: A validation-rejected signin is diagnosable from server logs
- **WHEN** a `signin` request body fails DTO validation (e.g. a missing required `apiKey`)
- **THEN** the server logs a `warn`-level line naming the failed property and constraint (e.g. `apiKey should not be empty`) without ever logging the submitted value

#### Scenario: Secrets never logged
- **WHEN** the backend logs a sign-in attempt at debug level
- **THEN** the log line includes the scope id, `authenticationType`, and `credentialsLevel` but never `apiKey` or `code`
