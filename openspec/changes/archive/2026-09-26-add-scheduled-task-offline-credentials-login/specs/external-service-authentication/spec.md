## MODIFIED Requirements

### Requirement: Application external-service metadata is resolved via a dedicated endpoint

The backend SHALL expose `GET /api/v1/external-services/:appId/:serviceId` (NestJS domain `apps/chat-api/src/external-services/`, `ExternalServicesController`, `@Controller({ path: 'external-services', version: '1' })`), requiring a valid BFF session. `:appId` is the application's own resource id (the `external-service/signin` event's `params.url` with the `/external_services/{serviceId}` suffix removed); `:serviceId` is that suffix's final segment. Both path segments SHALL be validated with an allowlist `@Matches` regex (`DEPLOYMENT_ID_PATTERN`) before being logged, forwarded to Core, or reflected in an error message.

Metadata SHALL first come from the SDK's dedicated `getExternalService(appid, serviceId)` operation. If Core returns 404, the backend SHALL try the public application resource via `getCustomApplication(bucket, path)` and resolve `external_services[serviceId]`; this permits ordinary users to read inline services whose management endpoint is restricted. If the application or service cannot be read, the original 404 SHALL be returned. The SDK's URL template already contains the literal `applications/` segment, so `appid` there is the app's `{bucket}/{path}` portion only, WITHOUT the `applications/` prefix — the backend SHALL strip that prefix from the route's `:appId` (which is the app's full resource id, e.g. `applications/public/finhub-via-openapi__1.0.0`) via `toDialExternalServiceAppId` before calling the SDK, or Core 404s on the doubled path with `Application not found: applications/{bucket}/{path}` (confirmed against a real Core instance). This stripping applies ONLY to this metadata call — sign-in/sign-out (below) still send the full `applications/`-prefixed id as part of the reconstructed scope id. The backend maps Core's response onto `GetExternalServiceResponseDto`: `displayName`, `description?`, `authenticationType` (`NONE` | `API_KEY` | `OAUTH` | `DIAL_NATIVE`, defaulting to `NONE` when Core omits it), `userLevelAuthStatus?`, `appLevelAuthStatus?`, `globalAuthStatus?`, `clientId?`, `authorizationEndpoint?`, `scopesSupported?`, `codeChallenge?`, `codeChallengeMethod?`.

#### Scenario: Metadata resolved via the dedicated endpoint
- **WHEN** the frontend requests `GET /api/v1/external-services/applications%2Fpublic%2Ffinhub-via-openapi__1.0.0/finhub-api2`
- **THEN** the backend calls Core's `getExternalService('public/finhub-via-openapi__1.0.0', 'finhub-api2')` (the `applications/` prefix stripped) and returns `200` with `displayName`, `authenticationType`, and any auth fields Core provides

#### Scenario: Unknown service returns 404
- **WHEN** Core's `getExternalService` responds `404` and the application-resource fallback cannot resolve that service
- **THEN** the backend returns `404`

### Requirement: BFF proxies external-service sign-in and sign-out using the full scope id

The backend SHALL expose `POST /api/v1/external-services/:appId/:serviceId/signin` and `POST /api/v1/external-services/:appId/:serviceId/signout`, both requiring a valid BFF session and both applying the standard global `CsrfGuard`. `:appId` and `:serviceId` SHALL be validated with the same allowlist `@Matches` regex as the metadata endpoint before being logged, forwarded to Core, or reflected in an error message.

DIAL Core requires the *full* external-service scope id (`{appId}/external_services/{serviceId}` — the `external-service/signin` event's original `params.url`) as the generic `ResourceSignInRequest`/`ResourceSignOutRequest` `url` field; Core rejects a bare application id with `400 Invalid external service scope id: <id>`. The frontend sends `appId` and `serviceId` as separate path segments (mirroring the metadata endpoint and `buildExternalServiceScopeId`'s split); the backend reconstructs the full scope id server-side (`toDialExternalServiceUrl(appId, serviceId)`, `apps/chat-api/src/external-services/external-services.mapper.ts`) before forwarding it as `url` — the frontend never assembles or sends the composite scope id itself over the wire.

Both endpoints SHALL call `@epam/ai-dial-typescript-sdk`'s `externalServiceSignIn`/`externalServiceSignOut` operations with the session's bearer token. Neither endpoint's logs or error messages SHALL include `apiKey` or `code` values; only the scope id, `authenticationType`, and `credentialsLevel` SHALL be logged, matching `ToolsetsService.loginToolset`'s logging discipline. On any non-2xx Core response, the backend SHALL log Core's own error body (via `extractDialErrorMessage`) and surface it as the thrown exception's message, so the real rejection reason (e.g. an invalid scope id) is visible both in server logs and to the client — not just a generic status-code message.

`POST /api/v1/external-services/:appId/:serviceId/signin`:
- Request body (`ExternalServiceSigninBodyDto`): `{ "credentialsLevel": "GLOBAL" | "APPLICATION" | "USER", "authenticationType": "NONE" | "OAUTH" | "API_KEY", "apiKey"?: string, "code"?: string, "redirectUri"?: string, "offlineUsageConsent"?: boolean }` — validated with `class-validator`; exactly one of `apiKey` (when `authenticationType` is `API_KEY`) or `code`+`redirectUri` (when `OAUTH`) SHALL be required, enforced at the DTO level.
- Response: `200 { "success": true }` on success (Core returns `boolean`; the backend maps a `false`/falsy Core response to a `502`, since a rejected sign-in is a Core-side failure, not a client error).
- Error codes: `400` invalid body, invalid `appId`/`serviceId` path segment, or Core rejects the reconstructed scope id/request shape; `401` no valid BFF session; `403` flag disabled; `502` Core rejects or errors for another reason.

`POST /api/v1/external-services/:appId/:serviceId/signout`:
- Request body (`ExternalServiceLogoutBodyDto`): `{ "credentialsLevel": "GLOBAL" | "APPLICATION" | "USER", "authenticationType": "NONE" | "OAUTH" | "API_KEY" }`.
- Response: `200 { "success": true }` on success; Core's `404` (nothing to sign out) SHALL be treated as idempotent success, mirroring the existing `logoutToolset` precedent.

All three endpoints SHALL apply the `FeatureGuard`/`@RequireFeature(FeatureKey.LiveChatInteraction)` decorators at the individual route-method level (not the controller class level — `FeatureGuard` only reads method-level reflector metadata via `executionContext.getHandler()`), returning `403` when the flag resolves to `false` for the caller.

The global `ValidationPipe`'s `exceptionFactory` SHALL log each rejected request's `{ property, constraints }` pairs at `warn` level (never the submitted `value`, since validated DTOs across the app can carry secrets such as `apiKey`/`code`) before returning the standard `400 Bad Request` — this applies to every DTO-validated endpoint in `chat-api`, not just this capability, and is what makes a silent DTO-validation rejection (e.g. a missing required `apiKey`) diagnosable from server logs alone.

Generated-client impact: Swagger operations `getExternalService`, `signInExternalService`, and `signOutExternalService` SHALL be exposed by generated `ExternalServicesApi` in `@epam/ai-dial-chat-api-client`. The app adapter `apps/chat/src/server-api/external-services.ts` SHALL use their normal methods and generated DTO types. Client configuration, CSRF, and unauthorized handling SHALL remain at the application edge. Metadata SHALL include optional `appLevelAuthStatus`, mapped from Core's `app_level_auth_status`. Metadata is not cached. Per-service mutation DTOs SHALL reject `DIAL_NATIVE` with 400 before invoking Core; native services have no per-service credential to create or revoke.

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


#### Scenario: DIAL-native metadata separates user connection from application consent
- **WHEN** Core returns `{ "authentication_type": "DIAL_NATIVE", "user_level_auth_status": "SIGNED_IN", "app_level_auth_status": "SIGNED_OUT" }` in a service's auth settings
- **THEN** the response contains `{ "authenticationType": "DIAL_NATIVE", "userLevelAuthStatus": "SIGNED_IN", "appLevelAuthStatus": "SIGNED_OUT" }`, without conflating user login and administrator consent

#### Scenario: DIAL-native per-service mutations are rejected
- **WHEN** a caller posts `{ "credentialsLevel": "USER", "authenticationType": "DIAL_NATIVE" }` to either per-service `signin` or `signout`
- **THEN** the backend returns 400 without invoking the Core mutation

## ADDED Requirements

### Requirement: DIAL-native interrupts use offline credentials and separate administrator consent

`useExternalServiceLogin` SHALL handle `DIAL_NATIVE` through `useOfflineCredentialsLogin`, using the existing `OAuthResourceKind.OfflineCredentials` popup/callback flow. It SHALL NOT call per-service sign-in/sign-out, including when `forceStale` is true. A popup SHALL be reserved synchronously during the login click before awaiting fresh metadata or connection settings. The flow SHALL require `appLevelAuthStatus: SIGNED_IN` before continuing; `SIGNED_OUT` SHALL produce an administrator-consent message, and missing or unknown status SHALL fail without reporting success. An existing `connected: true` offline connection SHALL be reused without revocation. Otherwise the flow SHALL fetch connection settings, perform offline OAuth, and require a fresh `connected: true` status plus a fresh `appLevelAuthStatus: SIGNED_IN` before reporting success through `ClientChannelContext`. No additional client or backend cache or telemetry is introduced.

The existing `SigninInterruptDialog` SHALL own row progress/errors. Hook callbacks SHALL remain memoized. It SHALL use `toolsetSignin.dialNativeHint`, `toolsetSignin.adminConsentRequired`, and `toolsetSignin.offlineUnavailable` for explanatory/error text, announce errors with `role="alert"`, and keep text wrapping at mobile and desktop sizes. The added content has no directional layout or icons; inherited RTL behavior SHALL be preserved. The per-service offline-consent checkbox SHALL appear only when an API-key or OAuth row exists. User OAuth SHALL never grant or withdraw administrator consent.

#### Scenario: Native login uses the offline endpoint
- **WHEN** a native service requires login and its application consent is confirmed but offline credentials are disconnected
- **THEN** the client starts offline OAuth and the callback submits `{ code, redirectUri }` to `POST /api/v1/offline-credentials/signin`, with no per-service `signin` or `signout` request

#### Scenario: Existing offline connection is reused
- **WHEN** application consent is confirmed and fresh offline status reports `connected: true`
- **THEN** the reserved popup closes, credentials are not revoked, and the interrupt reports success

#### Scenario: Administrator consent is absent
- **WHEN** fresh metadata reports `appLevelAuthStatus: SIGNED_OUT`
- **THEN** the popup closes and the dialog instructs the user to contact an administrator and retry, without reporting success

#### Scenario: Consent status is unknown
- **WHEN** fresh metadata omits application consent status or returns an unrecognized status
- **THEN** the flow fails without assuming consent or reporting success

#### Scenario: Offline access is unavailable
- **WHEN** application consent is confirmed but offline status is disconnected and unavailable or lacks connection settings
- **THEN** the popup closes and the dialog shows `toolsetSignin.offlineUnavailable`

#### Scenario: Popup success is not sufficient
- **WHEN** the callback reports success but fresh offline status is still disconnected
- **THEN** the interrupt remains unresolved with a login-failure message

#### Scenario: Consent is withdrawn during OAuth
- **WHEN** offline OAuth succeeds but the subsequent metadata check reports application consent signed out
- **THEN** the client shows the administrator-consent message and does not report interrupt success

#### Scenario: Popup is blocked or initial status request fails
- **WHEN** the browser blocks the popup or fetching fresh metadata/settings fails
- **THEN** the client reports the corresponding blocked-popup or login-failure outcome, closes any reserved popup on request failure, and does not report success

#### Scenario: Native-only dialog does not request per-service consent
- **WHEN** the pending dialog contains only DIAL-native services
- **THEN** it shows no API-key field or per-service offline-consent checkbox; administrator consent remains a separate action outside Chat
