## ADDED Requirements

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
`authorizationEndpoint`, `tokenEndpoint` (http/https URLs) and `scopesSupported` (OAuth scope tokens).
`apiKeyHeader` SHALL be an RFC 7230 token. The body is sent to Core as `ExternalService`
(`display_name`, `description`, `auth_settings` in snake case); fields left out stay out.

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
(non-`Raw`) methods. No UI, no i18n, no RTL impact.

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
