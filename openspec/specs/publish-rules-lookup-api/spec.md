## Purpose

Define the new read endpoint that lets the frontend pre-fill the access-rules editor with a destination folder's already-configured DIAL Core publication rules, wrapping the DIAL Core SDK's `getPublicationRules` operation. Shared by both the conversation and catalog (application/toolset) publish flows, since the lookup is folder-scoped, not entity-type-scoped.

## Requirements

### Requirement: Rules-lookup endpoint proxies DIAL Core's getPublicationRules, scoped to the exact requested folder

The backend SHALL expose `GET /api/v1/publish/rules?folderPath=<path>` in `apps/chat-api/src/publish/` (new `publish-rules.controller.ts`, `publish-rules.service.ts`, `dto/publish-rules-result.dto.ts`, sibling to the existing `publish.controller.ts`/`publish.service.ts`), following `apps/chat-api/AGENTS.md` (thin controller, `@ApiTags`/`@ApiOperation`/`@ApiResponse` per status code, Logger + ConfigService, validated DTOs).

`PublishRulesService.getRules` SHALL NOT persist anything — it is a pure pass-through read of DIAL Core's own `getPublicationRules` response, called via `DialClientService` (`this.dialClient.client.getPublicationRules({ headers, body: { url } })`), identical in spirit to how `publish.service.ts` calls `createPublication`.

The service SHALL:
1. Build `url: "public/{folderPath}/"` using the same shared target-folder construction utility (`publish-target.util.ts`, extracted per `conversation-publish-api`) already used for `createPublication`, so folder-path encoding stays consistent across the publish and rules-lookup calls.
2. Call `this.dialClient.client.getPublicationRules({ headers: getBearerAuthHeaders(accessToken), body: { url } })`.
3. Decode the response's `rules` map keys and return **only** the entry whose decoded, normalized key matches the requested `folderPath` exactly — every other key in the response (any ancestor folder's rules) SHALL be discarded server-side, never returned to the client. A folder with no rules of its own SHALL yield `rules: []`, not 404.

Request:
```
GET /api/v1/publish/rules?folderPath=Organization/Data%20Science/Shared%20chats
```

Core call made by the service (via `DialClientService.client.getPublicationRules`):
```json
{ "url": "public/Organization/Data Science/Shared chats/" }
```

Response (200), folder has its own rules:
```json
{
  "rules": [
    { "source": "role", "function": "CONTAIN", "targets": ["engineering"] }
  ]
}
```

Response (200), folder has no rules of its own:
```json
{ "rules": [] }
```

`folderPath` SHALL be validated with `class-validator` reusing the existing `IsValidFilePath` decorator, exactly as `PublishConversationDto.folderPath`/`PublishCatalogEntityDto.folderPath` are, to block path traversal before being forwarded to Core.

Generated-client impact: new OpenAPI `operationId: getPublishRules`; request via a query DTO (`folderPath: string`); response DTO `PublishRulesResultDto { rules: PublishRuleDto[] }`, reusing the existing `PublishRuleDto` defined for the publish request bodies (same shape, no duplicate type). Frontend caller: new `apps/chat/src/server-api/publish-rules.api.ts` thin wrapper using the normal (non-`Raw`) generated method.

Rate limiting: default global throttle applies (read endpoint, no stricter override needed) — matching the existing publish-history endpoints' profile.

Caching: none. This is a live, interaction-scoped lookup fired once per folder-selection click, not a background-refreshed list; caching would risk surfacing stale rules immediately after another user changes them, at exactly the moment accuracy matters for a publisher deciding whether to add redundant rules.

Authorization: caller SHALL be authenticated (existing session guard). No additional write-access enforcement is performed by this endpoint — it is a read of what rules already apply to a folder, not a write; DIAL Core's own response is passed through as-is.

#### Scenario: Folder with existing rules returns them
- **WHEN** an authenticated user requests rules for a folder that has previously configured rules
- **THEN** the endpoint returns 200 with `rules` containing exactly that folder's rule set, in DIAL Core's stored order

#### Scenario: Folder with no rules of its own returns an empty array
- **WHEN** an authenticated user requests rules for a folder that has never had rules configured
- **THEN** the endpoint returns 200 with `rules: []`, not a 404

#### Scenario: Ancestor-folder rules are never returned for a different exact path
- **GIVEN** DIAL Core's `getPublicationRules` response for a given lookup includes entries for both the requested folder and one of its ancestor folders
- **WHEN** the service processes the response
- **THEN** the returned `rules` array reflects only the exact requested `folderPath` entry; the ancestor folder's entry is discarded and never appears in the response

#### Scenario: Invalid folder path is rejected with 400
- **WHEN** `folderPath` fails `IsValidFilePath` validation (e.g. contains `..`)
- **THEN** the request is rejected at the `ValidationPipe` with 400 before reaching the service or Core

#### Scenario: Upstream failure
- **WHEN** the Core `getPublicationRules` call fails unexpectedly (network error, 5xx, timeout)
- **THEN** the service throws `BadGatewayException` or `ServiceUnavailableException` (per `handleDialSdkError`) and logs the failure without logging request bodies containing tokens

#### Scenario: Core rejects the request with a structured error
- **WHEN** `getPublicationRules` resolves with a structured error response (`result.error`)
- **THEN** the service calls `mapDialHttpStatus` with `result.error` and `extractDialErrorMessage(result.error)`, so the thrown exception's `message` is Core's own reason instead of a generic placeholder

#### Scenario: Unauthenticated request is rejected
- **WHEN** the endpoint is called without a valid session
- **THEN** the request is rejected with 401 before reaching the service or Core
