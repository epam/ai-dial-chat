## MODIFIED Requirements

### Requirement: Application external-service metadata is resolved via a dedicated endpoint

The backend SHALL expose `GET /api/v1/external-services/:appId/:serviceId` (NestJS domain `apps/chat-api/src/external-services/`, `ExternalServicesController`, `@Controller({ path: 'external-services', version: '1' })`), requiring a valid BFF session. `:appId` is the application's own resource id (the `external-service/signin` event's `params.url` with the `/external_services/{serviceId}` suffix removed); `:serviceId` is that suffix's final segment. Both path segments SHALL be validated with an allowlist `@Matches` regex (`DEPLOYMENT_ID_PATTERN`) before being logged, forwarded to Core, or reflected in an error message.

Metadata SHALL first come from the SDK's dedicated `getExternalService(appid, serviceId)` operation. If Core returns 403 or 404, the backend SHALL read the accessible application's public metadata through `listExternalServices(accessToken, appId)` and select the matching service id. This uses SDK `getApplication`, whose single-application response can contain safe `external_services`, unlike the deployment listing. If that lookup cannot resolve the service and the original management response was 404, the backend SHALL retain the existing `getCustomApplication(bucket, path)` fallback. If no permitted fallback resolves the service, the original management error SHALL be preserved. Every successful path SHALL use the same public-field allowlist and SHALL NOT expose client secrets, API keys, authorization codes or tokens. The SDK's URL template already contains the literal `applications/` segment, so `appid` there is the app's `{bucket}/{path}` portion only, WITHOUT the `applications/` prefix — the backend SHALL strip that prefix from the route's `:appId` (which is the app's full resource id, e.g. `applications/public/finhub-via-openapi__1.0.0`) via `toDialExternalServiceAppId` before calling the SDK, or Core 404s on the doubled path with `Application not found: applications/{bucket}/{path}` (confirmed against a real Core instance). This stripping applies ONLY to this metadata call — sign-in/sign-out (below) still send the full `applications/`-prefixed id as part of the reconstructed scope id. The backend maps Core's response onto `GetExternalServiceResponseDto`: `displayName`, `description?`, `authenticationType` (`NONE` | `API_KEY` | `OAUTH` | `DIAL_NATIVE`, defaulting to `NONE` when Core omits it), `userLevelAuthStatus?`, `appLevelAuthStatus?`, `globalAuthStatus?`, `clientId?`, `authorizationEndpoint?`, `scopesSupported?`, `codeChallenge?`, `codeChallengeMethod?`, `resource?`. `resource` is the RFC 8707 resource indicator DIAL Core stores in `auth_settings.resource` (epam/ai-dial-core#2218); it is public, is copied as-is by `mapDialExternalServiceToDto` (`apps/chat-api/src/external-services/external-services.mapper.ts`) and so also appears on every `ApplicationExternalServiceDto` of the public listing, and is absent when Core has none. The frontend puts it on the authorize URL (see `chat-hooks-oauth-popup-flow`). The field is declared by `@epam/ai-dial-typescript-sdk` `0.2.0-dev.23` and later (`ResourceAuthSettings.resource`), so the mapper reads it through the SDK type directly.

Example `200` body for an OAuth service:

```json
{
  "displayName": "Notion",
  "authenticationType": "OAUTH",
  "userLevelAuthStatus": "SIGNED_OUT",
  "clientId": "dial-chat",
  "authorizationEndpoint": "https://mcp.notion.com/authorize",
  "scopesSupported": ["read"],
  "resource": "https://mcp.notion.com/mcp"
}
```

#### Scenario: Stored resource is returned

- **WHEN** Core's service carries `auth_settings.resource: "https://mcp.notion.com/mcp"`
- **THEN** both the single-service response and that service's entry in the application's external-service listing carry `resource: "https://mcp.notion.com/mcp"`
- **WHEN** Core's service has no `resource`
- **THEN** the response has no `resource` property

#### Scenario: Metadata resolved via the dedicated endpoint
- **WHEN** the frontend requests `GET /api/v1/external-services/applications%2Fpublic%2Ffinhub-via-openapi__1.0.0/finhub-api2`
- **THEN** the backend calls Core's `getExternalService('public/finhub-via-openapi__1.0.0', 'finhub-api2')` (the `applications/` prefix stripped) and returns `200` with `displayName`, `authenticationType`, and any auth fields Core provides

#### Scenario: Unknown service returns 404
- **WHEN** Core's `getExternalService` responds `404` and the application-resource fallback cannot resolve that service
- **THEN** the backend returns `404`

#### Scenario: Ordinary reader resolves an inline service after a management denial

- **WHEN** the management endpoint returns 403 or 404 for an inline service
- **AND** the caller can read that application's public metadata containing the requested service
- **THEN** the BFF returns the mapped service metadata with public OAuth settings and current credential statuses
- **AND** no administrator role or secret fields are required

#### Scenario: An unreadable application does not bypass the original denial

- **WHEN** the management endpoint returns 403 and the public application cannot be read or does not contain the service
- **THEN** the BFF preserves the 403 rather than returning empty or unauthorized metadata

#### Scenario: Legacy custom-application fallback remains available

- **WHEN** the management endpoint returns 404 and the public single-application lookup does not resolve the service
- **AND** the existing custom-application fallback resolves the service for that caller
- **THEN** the BFF returns that service through the same public-field mapper

### Requirement: BFF declares and removes an application external service

The BFF SHALL expose `PUT /api/v1/external-services/{appId}/{serviceId}` and
`DELETE /api/v1/external-services/{appId}/{serviceId}` in
`apps/chat-api/src/external-services/external-services.controller.ts`, proxying the
`putExternalService` / `deleteExternalService` operations of `@epam/ai-dial-typescript-sdk` with the
caller's session access token (`ExternalServicesService`). `appId` is the application id, `/` encoded as
`%2F`; the `applications/` prefix is dropped before the SDK call, as the sign-in routes do.
`serviceId` SHALL be one path segment (`EXTERNAL_SERVICE_ID_PATTERN`: letters, digits, `.`, `_`, `~`,
`-`; never `.` or `..`). Both routes sit behind the `liveChatInteraction` feature, like their
GET/signin/signout siblings. Authorization is DIAL Core's: the caller must be able to edit the
application. Nothing is cached.

Request body of `PUT` (`ExternalServiceDefinitionBodyDto`), validated with `forbidNonWhitelisted`:

```json
{
  "displayName": "Teams bot",
  "description": "This project's Teams bot",
  "authSettings": {
    "authenticationType": "API_KEY",
    "apiKeyHeader": "X-Bot-Secret"
  }
}
```

`authenticationType` is `API_KEY` or `OAUTH`; `OAUTH` may carry `clientId`, `clientSecret`,
`authorizationEndpoint`, `tokenEndpoint` (http/https URLs), `scopesSupported` (OAuth scope tokens)
and `resource` (the RFC 8707 resource indicator).
`apiKeyHeader` SHALL be an RFC 7230 token. `resource` SHALL be either `''` or an absolute URI without
a fragment, at most 2048 characters, checked with the allowlist `OAUTH_RESOURCE_PATTERN`
(`apps/chat-api/src/common/validators/oauth-resource.pattern.ts`: a URI scheme, `:`, then one or more
characters that are neither whitespace nor `#`) before it reaches Core, a log line or an error
message; Core applies the same rule and also rejects `resource` for any type other than `OAUTH`. The
body is sent to Core as `ExternalService` (`display_name`, `description`, `auth_settings` in snake
case, `resource` as `auth_settings.resource`); fields left out stay out, and `''` is forwarded as `''`.
A `PUT` replaces the whole service in Core, so a `PUT` that leaves `resource` out erases a stored
value — callers that edit an existing OAuth service SHALL resend it. The DTO's Swagger description
says so.

OAuth example:

```json
{
  "displayName": "Notion",
  "authSettings": {
    "authenticationType": "OAUTH",
    "clientId": "dial-chat",
    "clientSecret": "…",
    "authorizationEndpoint": "https://mcp.notion.com/authorize",
    "tokenEndpoint": "https://mcp.notion.com/token",
    "resource": "https://mcp.notion.com/mcp"
  }
}
```

is sent to Core as `auth_settings: { authentication_type: "OAUTH", client_id: "dial-chat", client_secret: "…", authorization_endpoint: "…", token_endpoint: "…", resource: "https://mcp.notion.com/mcp" }`
and answered `200` with `GetExternalServiceResponseDto` including `resource`.

Responses: `PUT` — `200` with `GetExternalServiceResponseDto` (secrets stripped):

```json
{ "displayName": "Teams bot", "authenticationType": "API_KEY" }
```

`DELETE` — `204`; a Core `404` (already gone) is also `204`. Errors through
`apps/chat-api/src/common/dial/dial-error.mapper.ts`: `400` invalid path or body, `401`, `403` (no edit
right, or the feature off), `404` application not found (`PUT`), `502` Core error, `503` Core
unreachable. The client secret SHALL never be logged or returned.

Generated client: `ExternalServicesApi.putExternalService({ appId, serviceId,
externalServiceDefinitionBodyDto })` → `GetExternalServiceResponseDto`;
`ExternalServicesApi.deleteExternalService({ appId, serviceId })` → `void`. Callers use the normal
(non-`Raw`) methods. Adding `resource` changes no operation id or method; the regenerated
`ExternalServiceAuthSettingsBodyDto` and `GetExternalServiceResponseDto` models gain an optional
`resource`. No UI, no i18n, no RTL impact.

#### Scenario: Declare an API-key service

- **WHEN** an editor sends `PUT /api/v1/external-services/applications%2Fbkt%2Floop__1.0.0/teams` with
  the body above
- **THEN** the BFF SHALL call Core's `putExternalService('bkt/loop__1.0.0', 'teams', …)` with
  `{ "display_name": "Teams bot", "auth_settings": { "authentication_type": "API_KEY", "api_key_header": "X-Bot-Secret" } }`
  and answer `200` with the declared service

#### Scenario: Remove a service that is already gone

- **WHEN** `DELETE` is sent for a service Core no longer has
- **THEN** the BFF SHALL answer `204`

#### Scenario: Refuse a traversing service id

- **WHEN** the `serviceId` is `..%2F..%2Fsecrets`
- **THEN** the BFF SHALL answer `400` without calling Core

#### Scenario: Refuse an undeclarable kind or a smuggled header

- **WHEN** `authenticationType` is `DIAL_NATIVE`, or `apiKeyHeader` contains a line break
- **THEN** the BFF SHALL answer `400`

#### Scenario: Forward an OAuth resource

- **WHEN** an editor sends the OAuth example body above
- **THEN** Core's `putExternalService` receives `auth_settings.resource: "https://mcp.notion.com/mcp"`

#### Scenario: Clear a resource

- **WHEN** the body carries `authSettings.resource: ""`
- **THEN** Core receives `auth_settings.resource: ""`

#### Scenario: Refuse an invalid resource

- **WHEN** `authSettings.resource` is `mcp.notion.com/mcp`, `https://mcp.notion.com/mcp#x`, or contains a space or a line break
- **THEN** the BFF SHALL answer `400` without calling Core
