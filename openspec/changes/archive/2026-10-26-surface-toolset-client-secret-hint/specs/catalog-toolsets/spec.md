## ADDED Requirements

### Requirement: Toolset auth settings expose the stored client secret hint

The backend `GET /api/v1/toolsets` and `GET /api/v1/toolsets/{toolsetName}` responses SHALL include `authSettings.clientSecretHint` whenever DIAL Core's `auth_settings` carries `client_secret_hint`, copied unchanged (no masking, trimming, or padding). The field SHALL be documented on `DialToolsetAuthSettingsDto` (`apps/chat-api/src/openapi/openapi-response.dto.ts`) as an optional string and mapped by `mapAuthSettings` (`apps/chat-api/src/toolsets/utils/toolset-mapper.util.ts`) through its existing allowlist. For a custom toolset, the hint comes from the `getCustomToolSet` response, whose `auth_settings` wins in `mergeCustomToolsetDetails`.

The responses SHALL continue to exclude `clientSecret`/`codeVerifier`. The hint SHALL NOT be accepted on any toolset write: `ToolsetBodyDto` gains no hint field (so the global `ValidationPipe` rejects one with `400`), and `preserveHiddenAuthSettings` SHALL NOT copy `client_secret_hint` into the DIAL Core update body.

Generated-client impact: operationIds `listToolsets` / `getToolset` are unchanged; `DialToolsetAuthSettingsDto` in `libs/chat-api-client` gains optional `clientSecretHint`, regenerated through `npm run openapi`. Frontend callers keep using the normal (non-`Raw`) generated methods via `apps/chat/src/server-api/toolsets.ts`.

Caching is unchanged: the hint is part of the mapped DTO cached under `toolsets:single:<user.sub>:<toolsetName>` (60 s) and is cleared with it by `ToolsetsListingService.invalidateCaches` after every toolset write.

Example response fragment (`GET /api/v1/toolsets/toolsets%2F<bucket>%2Fgithub_valery__1.0.0`, 200):

```json
{
  "authSettings": {
    "authenticationType": "OAUTH",
    "dynamicallyRegistered": false,
    "clientId": "Iv23li6Tjp68EjvaPGsd",
    "clientSecretHint": "d4c6",
    "redirectUri": "http://localhost:4207/auth/toolset-signin",
    "authorizationEndpoint": "https://github.com/login/oauth/authorize",
    "tokenEndpoint": "https://github.com/login/oauth/access_token",
    "globalAuthStatus": "SIGNED_OUT",
    "userLevelAuthStatus": "SIGNED_IN"
  }
}
```

#### Scenario: Core hint is forwarded unchanged

- **GIVEN** DIAL Core's `getCustomToolSet` response has `auth_settings.client_secret_hint: "d4c6"`
- **WHEN** the authenticated user calls `GET /api/v1/toolsets/{toolsetName}`
- **THEN** the response has `authSettings.clientSecretHint: "d4c6"`
- **AND** it has no `clientSecret`, `client_secret`, or `codeVerifier` field anywhere

#### Scenario: No hint from Core

- **GIVEN** DIAL Core's toolset response has no `client_secret_hint`
- **WHEN** the user calls `GET /api/v1/toolsets/{toolsetName}`
- **THEN** `authSettings.clientSecretHint` is absent

#### Scenario: Hint is rejected on write

- **WHEN** a client sends `PATCH /api/v1/toolsets/{toolsetName}` with `authSettings.clientSecretHint` in the body
- **THEN** the request is rejected with `400 Bad Request` and nothing is sent to DIAL Core
