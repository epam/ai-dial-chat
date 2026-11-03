## ADDED Requirements

### Requirement: OAuth resource in toolset auth settings

`POST /api/v1/toolsets` and `PATCH /api/v1/toolsets/:toolsetName` SHALL accept an optional
`authSettings.resource` on `ToolsetAuthSettingsBodyDto`
(`apps/chat-api/src/toolsets/dto/toolset-body.dto.ts`) — the RFC 8707 resource indicator DIAL Core
stores in `auth_settings.resource` and sends on the token exchange and refresh
(epam/ai-dial-core#2218). Without the field, the global `ValidationPipe`'s `forbidNonWhitelisted`
would reject every body the toolset editor sends for a static OAuth toolset with `400`.

- **Validation.** `resource` SHALL be a string that is either `''` or an absolute URI without a
  fragment, at most 2048 characters, checked with the allowlist `OAUTH_RESOURCE_PATTERN`
  (`apps/chat-api/src/common/validators/oauth-resource.pattern.ts`, shared with the external-service
  DTO) before it reaches Core, a log line or an error message. An invalid value is `400` without a
  Core call.
- **Forwarding.** `toDialAuthSettings` (`apps/chat-api/src/toolsets/utils/toolset-mapper.util.ts`)
  SHALL forward it as `auth_settings.resource` only for `authenticationType: OAUTH`, and only when it
  is not `undefined`/`null` — `''` is forwarded as `''`, which DIAL Core reads as "clear the stored
  value"; an omitted field keeps the stored value in Core. For `NONE` and `API_KEY` it is dropped,
  as the other OAuth fields are.
- **No merge.** `resource` SHALL NOT be added to `OAUTH_MERGEABLE_KEYS`. DIAL Core already keeps an
  omitted value on update, and re-sending a stored value for a dynamically registered toolset would
  make Core reject the save (Core accepts `resource` only for static registration).
- **Read.** `mapAuthSettings` SHALL copy `auth_settings.resource` into
  `DialToolsetAuthSettingsDto.resource` (`apps/chat-api/src/openapi/openapi-response.dto.ts`) for
  `GET /api/v1/toolsets` and `GET /api/v1/toolsets/:toolsetName`; it is public, not a secret.
- **Types.** chat-api SHALL depend on `@epam/ai-dial-typescript-sdk` `0.2.0-dev.23` or later, whose
  `ResourceAuthSettings` declares `resource?: string`; `DialAuthSettings` stays the plain SDK type, with
  no local extension.

Example `PATCH /api/v1/toolsets/toolsets%2Fbkt%2Fnotion` body (other fields as today):

```json
{
  "name": "Notion",
  "endpoint": "https://mcp.notion.com/mcp",
  "transport": "HTTP",
  "authSettings": {
    "authenticationType": "OAUTH",
    "clientId": "dial-chat",
    "authorizationEndpoint": "https://mcp.notion.com/authorize",
    "tokenEndpoint": "https://mcp.notion.com/token",
    "redirectUri": "https://chat.example.com/auth/toolset-signin",
    "resource": "https://mcp.notion.com/mcp"
  }
}
```

Core receives `authSettings: { authentication_type: "OAUTH", client_id: "dial-chat", …, resource: "https://mcp.notion.com/mcp" }`;
the response stays `200` `MutatedToolsetDto` (`{ "id": "toolsets/bkt/notion" }`). A later
`GET /api/v1/toolsets/toolsets%2Fbkt%2Fnotion` returns
`authSettings: { "authenticationType": "OAUTH", "dynamicallyRegistered": false, "clientId": "dial-chat", …, "resource": "https://mcp.notion.com/mcp" }`.
Errors are unchanged: `400` validation (including a Core `400` for a `resource` it rejects), `401`,
`403`, `404`, `502`, `503`. Caching is unchanged: the existing toolset caches are invalidated on
every successful create/update as today; no new cache key.

Generated client: no operation id or method changes; the regenerated
`ToolsetAuthSettingsBodyDto` and `DialToolsetAuthSettingsDto` models gain an optional `resource`, and
callers keep the normal (non-`Raw`) `createToolset` / `updateToolset` / `getToolset` methods through
`apps/chat/src/server-api`. The endpoints stay behind the same feature gate as today; no new
`ENABLED_FEATURES` key. No telemetry change.

#### Scenario: Static OAuth toolset saved with a resource

- **WHEN** the example body is PATCHed
- **THEN** Core's save body carries `authSettings.resource: "https://mcp.notion.com/mcp"` and the
  endpoint answers `200`

#### Scenario: Cleared resource is forwarded as blank

- **WHEN** the body carries `authSettings.resource: ""`
- **THEN** Core's save body carries `authSettings.resource: ""`

#### Scenario: Omitted resource is not filled from the stored toolset

- **WHEN** an OAuth update body has no `resource` and the stored toolset has
  `auth_settings.resource`
- **THEN** Core's save body has no `resource` key, while the other `OAUTH_MERGEABLE_KEYS` are still
  carried over

#### Scenario: Resource dropped for non-OAuth types

- **WHEN** the body has `authenticationType: "API_KEY"` and a `resource`
- **THEN** Core's save body has no `resource` key

#### Scenario: Invalid resource rejected

- **WHEN** `authSettings.resource` is `mcp.notion.com/mcp`, `https://mcp.notion.com/mcp#tools`, or
  contains whitespace
- **THEN** the endpoint answers `400` and does not call DIAL Core

#### Scenario: Stored resource returned on read

- **WHEN** Core's toolset carries `auth_settings.resource`
- **THEN** `GET /api/v1/toolsets/:toolsetName` and the toolset listing return it as
  `authSettings.resource`, and omit the property when Core has none
