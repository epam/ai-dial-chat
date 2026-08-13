# deployments-api Specification

## Purpose

`GET /api/v1/deployments`: the DTO shape, domain structure, generated client, and frontend wrapper.

### Requirement: GET /api/v1/deployments endpoint

The system SHALL expose `GET /api/v1/deployments` that proxies DIAL Core `GET /v1/deployments` and returns all models and applications (excluding toolsets) visible to the authenticated session user, optionally filtered by interface type.

The endpoint:
- MUST require authentication via `SessionGuard`; respond 401 when no valid session is present.
- SHALL accept an optional `interface_type` query parameter as a repeatable string value validated against `('chat' | 'embedding' | 'mcp' | 'custom_ui' | 'all')`; passing an unrecognised value MUST respond 400.
- SHALL accept an optional `refresh` query parameter validated as a boolean (`true` or `false` after DTO transformation); passing any other value MUST respond 400.
- SHALL forward the `interface_type` values to DIAL Core `GET /v1/deployments` as a single comma-joined query parameter (e.g. `interface_type=chat,mcp`) when more than one value is provided, not as repeated query keys — DIAL Core only honors the first occurrence of a repeated key.
- SHALL call DIAL Core using the `@epam/ai-dial-typescript-sdk` client (`listDeployments`), passing the session access token.
- SHALL map the DIAL Core response `deployments` array to `DeploymentItemDto[]` using the normalisation rules in the `DeploymentItemDto shape` requirement below.
- SHALL exclude toolset-typed entries (DIAL Core items with a `toolset` field present) from the mapped response, regardless of the `interface_type` filter applied — toolsets are served exclusively by the dedicated `GET /api/v1/toolsets` listing, whose payload carries fields (`auth_settings`, `endpoint`) that DIAL Core's `/v1/deployments` toolset entries do not include.
- SHALL respond 200 with `{ deployments: DeploymentItemDto[] }` on success.
- SHALL respond 502 when DIAL Core returns a non-2xx response.
- SHALL respond 503 when DIAL Core is unreachable or times out.
- SHALL apply `@Throttle({ default: { limit: 60, ttl: 60000 } })`.
- SHALL cache the unfiltered DIAL Core response under key `deployments:list:<userSub>` for 30 000 ms and filtered DIAL Core responses under key `deployments:list:<userSub>:interface:<type[,type]>` for 30 000 ms.
- SHALL, when a filtered cache entry is absent but the unfiltered cache entry is present, apply `interface_type` filtering in-process after cache retrieval without calling DIAL Core.
- SHALL bypass server-side deployments cache entirely when `refresh=true`, call DIAL Core, and replace the relevant cache entry with the fresh mapped response.
- SHALL set response header `Cache-Control: private, max-age=30` for normal requests.
- SHALL set response header `Cache-Control: private, no-store` when `refresh=true`.
- MUST NOT log the session access token.

#### Scenario: Authenticated user receives all deployments without filter

- **WHEN** `GET /api/v1/deployments` is called with a valid session and no `interface_type` parameter
- **THEN** the endpoint responds 200 with `{ deployments: DeploymentItemDto[] }` containing all models and applications from DIAL Core, with no toolset-typed entries

#### Scenario: Authenticated user filters by single interface type

- **WHEN** `GET /api/v1/deployments?interface_type=chat` is called with a valid session
- **THEN** the endpoint responds 200 with `{ deployments: DeploymentItemDto[] }` containing only deployments whose DIAL Core `interfaces` array includes `'chat'`

#### Scenario: New fields present on response items

- **WHEN** `GET /api/v1/deployments` returns items with DIAL Core `owner` populated
- **THEN** each item in the response includes `owner`, `isMy`, and (for folder-nested applications) `applicationFolder`

#### Scenario: Backward compatibility — clients ignoring new fields are unaffected

- **WHEN** an existing client calls `GET /api/v1/deployments` and does not read `owner`, `isMy`, or `applicationFolder`
- **THEN** the response is identical to the prior behavior for all pre-existing fields

#### Scenario: Authenticated user filters by multiple interface types

- **WHEN** `GET /api/v1/deployments?interface_type=chat&interface_type=mcp` is called with a valid session
- **THEN** the endpoint forwards `interface_type=chat,mcp` to DIAL Core as one comma-joined parameter
- **AND** the endpoint responds 200 with deployments matching either `'chat'` or `'mcp'` interface types

#### Scenario: MCP-interface applications are included, MCP toolsets are excluded

- **WHEN** `GET /api/v1/deployments?interface_type=mcp` is called and DIAL Core's response includes both an application with `dial:applicationTypeMcp` and a toolset, both exposing the `mcp` interface
- **THEN** the response includes the MCP-capable application
- **AND** the response does NOT include the toolset, even though it matches the requested interface

#### Scenario: Invalid interface_type value returns 400

- **WHEN** `GET /api/v1/deployments?interface_type=unknown` is called
- **THEN** the endpoint responds 400 with a validation error referencing `interface_type`

#### Scenario: Invalid refresh value returns 400

- **WHEN** `GET /api/v1/deployments?refresh=maybe` is called
- **THEN** the endpoint responds 400 with a validation error referencing `refresh`

#### Scenario: Unauthenticated request rejected

- **WHEN** `GET /api/v1/deployments` is called without a valid session cookie
- **THEN** the endpoint responds 401

#### Scenario: Rate limit exceeded

- **WHEN** the request rate exceeds 60 per minute for the client IP
- **THEN** the endpoint responds 429

#### Scenario: DIAL Core unreachable

- **WHEN** DIAL Core does not respond within the SDK timeout
- **THEN** the endpoint responds 503

#### Scenario: DIAL Core returns error

- **WHEN** DIAL Core returns a non-2xx response to `GET /v1/deployments`
- **THEN** the endpoint responds 502

#### Scenario: Cache hit — interface_type filter applied to cached list

- **WHEN** `deployments:list:<userSub>` is present in cache and `interface_type=chat` is requested
- **THEN** the service returns cached deployments filtered in-process without calling DIAL Core

#### Scenario: Refresh bypasses deployments cache

- **WHEN** `deployments:list:<userSub>:interface:chat` is present in cache and `GET /api/v1/deployments?interface_type=chat&refresh=true` is requested
- **THEN** the service calls DIAL Core instead of returning the cached entry
- **AND** the response header is `Cache-Control: private, no-store`

---

### Requirement: DeploymentItemDto shape

`DeploymentItemDto` SHALL be a strongly typed Swagger DTO that normalises DIAL Core's `ModelOpenAi | ApplicationOpenAi | ToolsetOpenAi` union into a flat structure:

- `id: string` — unique stable identifier from DIAL Core; items without an `id` SHALL be skipped during mapping
- `displayName: string | Record<string, string>` — `display_name` from DIAL Core, falling back to `id` when absent; either a plain string or a map of locale code to translated value when the entity has additional locales configured
- `type: 'model' | 'application' | 'toolset'` — discriminator; derived from DIAL Core `object` field (`"model"` → `'model'`, `"application"` → `'application'`); items with a `toolset` field present SHALL be mapped to `'toolset'`
- `iconUrl?: string` — `icon_url` from DIAL Core
- `description?: string | Record<string, string>` — `description` from DIAL Core; same plain-string-or-locale-map shape as `displayName`
- `interfaces?: string[]` — `interfaces` from DIAL Core (list of interface types supported by the deployment)
- `inputAttachmentTypes?: string[]` — `input_attachment_types` from DIAL Core; omitted when the source field is absent or null
- `owner?: string` — `owner` from DIAL Core's `DeploymentBase`; forwarded verbatim; omitted when DIAL Core does not provide it
- `isMy?: boolean` — `true` when the session `bucket` appears as a path segment of the deployment `id` (e.g. `applications/{bucket}/{name}`); `false` otherwise; computed post-cache and never stored in the cache entry
- `applicationFolder?: string` — parent directory path of the application derived from `id` (everything before the last `/`); set only for `type === 'application'` items whose `id` contains a `/`; absent for root-level applications and all non-application types
- `features?: DeploymentFeaturesDto` — feature flags from DIAL Core, including the `mcp?: boolean` field, and the `responsesApi?: boolean` / `chatCompletion?: boolean` fields (see below)
- `reference?: string` — `reference` from DIAL Core's raw deployment payload, forwarded verbatim; omitted when DIAL Core does not provide it. Callers MAY receive a deployment `id` elsewhere in the system (e.g. a stored conversation's `model` value) that actually holds this `reference` value instead of `id` — the frontend is responsible for matching against either field (see `deployment-reference-resolution`)

`DeploymentItemDto.conversationStarters?: ConversationStartersDto` SHALL expose Quick Apps conversation starter settings mapped from `application_properties.conversation_starters`. It SHALL be set only for `type === 'application'` items with at least one valid starter.

`ConversationStartersDto` SHALL contain:
- `introText?: string` mapped from `application_properties.conversation_starters.intro_text`
- `autoSubmit?: boolean` mapped from `application_properties.conversation_starters.auto_submit`
- `chatMessageInputDisabled?: boolean` mapped from `application_properties.conversation_starters.chat_message_input_disabled`
- `starters: ConversationStarterDto[]`, where each starter contains `title: string` and `text: string` from the corresponding raw starter

Invalid or blank starters SHALL be omitted. If no valid starters remain, `conversationStarters` SHALL be omitted. Non-application deployments SHALL NOT expose `conversationStarters`, even if a malformed source payload contains `application_properties`.

`DeploymentFeaturesDto.mcp?: boolean` SHALL be `true` when any of the following is present on the raw DIAL Core list entry, and `undefined` (omitted) otherwise:
- `features.mcp === true` (read defensively, the same way `DeploymentFeaturesDetailsDto.mcp` is already populated for the deployment-details endpoint);
- a root-level `mcp` descriptor object (`endpoint`/`transport`/`allowedTools`/...) is present (non-`null`), regardless of its contents;
- `interfaces` contains the string `'mcp'` (the same per-item signal DIAL Core's own `interface_type=mcp` list filter relies on).

These three signals are not mutually exclusive but are also not reliably combined — real DIAL Core list responses have been observed reporting MCP support through any one of them alone, with the other two absent, depending on the application's configuration.

`DeploymentFeaturesDto.responsesApi?: boolean` SHALL be `true` when the raw DIAL Core list entry has `features.responses_api === true`, and `undefined` (omitted) otherwise — mirroring how `DeploymentFeaturesDetailsDto.responsesApi` is already populated for the deployment-details endpoint (`mapDeploymentFeatures`). `DeploymentFeaturesDto.chatCompletion?: boolean` SHALL be mapped the same way from `features.chat_completion`. Both fields SHALL be read defensively (absent/non-boolean source values map to `undefined`, never throw). Neither field participates in any deployments-list caching key or filtering behavior; they are additive metadata only.

`DeploymentsResponseDto` SHALL wrap this as `{ deployments: DeploymentItemDto[] }`.

No `any` types are allowed in success response shapes.

The `DeploymentItem` interface in `libs/chat-shared/src/models/deployment.ts` SHALL also gain `inputAttachmentTypes?: string[]`. The deployment mapping in `apps/chat` SHALL copy the field through from `DeploymentItemDto`.

#### Scenario: Model item is mapped correctly

- **WHEN** a DIAL Core `ModelOpenAi` entry has `object: 'model'`, `id: 'gpt-4o'`, `display_name: 'GPT-4o'`
- **THEN** the mapped `DeploymentItemDto` has `type: 'model'`, `id: 'gpt-4o'`, `displayName: 'GPT-4o'`

#### Scenario: Application item is mapped correctly

- **WHEN** a DIAL Core `ApplicationOpenAi` entry has `object: 'application'`, `id: 'my-app'`, no `display_name`
- **THEN** the mapped `DeploymentItemDto` has `type: 'application'`, `id: 'my-app'`, `displayName: 'my-app'`

#### Scenario: Toolset item is mapped correctly

- **WHEN** a DIAL Core `ToolsetOpenAi` entry has a `toolset` field and `id: 'search-tool'`
- **THEN** the mapped `DeploymentItemDto` has `type: 'toolset'`, `id: 'search-tool'`

#### Scenario: Item with no id is skipped

- **WHEN** a DIAL Core deployment entry has no `id` field
- **THEN** it is excluded from the `deployments` array in the response

#### Scenario: displayName falls back to id

- **WHEN** a source item has no `display_name`
- **THEN** `DeploymentItemDto.displayName` equals the source `id`

#### Scenario: displayName passes through a locale map unresolved

- **WHEN** a source item's `display_name` from DIAL Core is a map of locale code to translated
  value rather than a plain string
- **THEN** `DeploymentItemDto.displayName` carries that map through unchanged — resolving it to
  a single display string is the frontend's responsibility, not this endpoint's

#### Scenario: inputAttachmentTypes mapped from DIAL Core

- **WHEN** a DIAL Core model entry has `input_attachment_types: ['audio/*', 'image/*']`
- **THEN** the mapped `DeploymentItemDto` has `inputAttachmentTypes: ['audio/*', 'image/*']`

#### Scenario: inputAttachmentTypes omitted when absent in source

- **WHEN** a DIAL Core model entry has no `input_attachment_types` field
- **THEN** the mapped `DeploymentItemDto` has `inputAttachmentTypes` as `undefined`

#### Scenario: Application item with MCP support maps features.mcp true

- **WHEN** a DIAL Core `ApplicationOpenAi` entry has `features.mcp: true`
- **THEN** the mapped `DeploymentItemDto` has `features.mcp: true`

#### Scenario: Application item without MCP support omits features.mcp

- **WHEN** a DIAL Core `ApplicationOpenAi` entry has no `features.mcp` field, no root-level `mcp` descriptor, and no `'mcp'` entry in `interfaces`
- **THEN** the mapped `DeploymentItemDto`'s `features.mcp` is `undefined`

#### Scenario: Application item with a root-level mcp descriptor maps features.mcp true

- **WHEN** a DIAL Core `ApplicationOpenAi` entry has a root-level `mcp` descriptor object and no `features.mcp`
- **THEN** the mapped `DeploymentItemDto` has `features.mcp: true`

#### Scenario: Application item with "mcp" in interfaces maps features.mcp true

- **WHEN** a DIAL Core `ApplicationOpenAi` entry has `interfaces` containing `'mcp'` and neither `features.mcp` nor a root-level `mcp` descriptor
- **THEN** the mapped `DeploymentItemDto` has `features.mcp: true`

#### Scenario: Application conversation starters mapped from application properties

- **WHEN** a DIAL Core `ApplicationOpenAi` entry has `application_properties.conversation_starters` with `intro_text`, `auto_submit`, `chat_message_input_disabled`, and one starter `{ title, text }`
- **THEN** the mapped `DeploymentItemDto` has `conversationStarters.introText`, `conversationStarters.autoSubmit`, `conversationStarters.chatMessageInputDisabled`, and `conversationStarters.starters[0]` mapped to `{ title, text }`

#### Scenario: Non-application item omits conversationStarters

- **WHEN** a model or toolset entry contains a malformed `application_properties.conversation_starters` payload
- **THEN** the mapped `DeploymentItemDto` has `conversationStarters` as `undefined`

#### Scenario: Empty or invalid starters omit conversationStarters

- **WHEN** an application entry has `application_properties.conversation_starters.starters` with no valid `{ title, text }` pairs
- **THEN** the mapped `DeploymentItemDto` has `conversationStarters` as `undefined`

#### Scenario: Model item with Responses support maps features.responsesApi true

- **WHEN** a DIAL Core `ModelOpenAi` entry has `features.responses_api: true`
- **THEN** the mapped `DeploymentItemDto` has `features.responsesApi: true`

#### Scenario: Application item with Responses support maps features.responsesApi true

- **WHEN** a DIAL Core `ApplicationOpenAi` entry has `features.responses_api: true`
- **THEN** the mapped `DeploymentItemDto` has `features.responsesApi: true`

#### Scenario: Item without Responses support omits features.responsesApi

- **WHEN** a DIAL Core entry has no `features.responses_api` field
- **THEN** the mapped `DeploymentItemDto`'s `features.responsesApi` is `undefined`

#### Scenario: Item with chat_completion support maps features.chatCompletion true

- **WHEN** a DIAL Core entry has `features.chat_completion: true`
- **THEN** the mapped `DeploymentItemDto` has `features.chatCompletion: true`

#### Scenario: reference mapped from DIAL Core

- **WHEN** a DIAL Core model entry has `id: 'gemini-3.1-flash-lite'` and `reference: 'ref-gemini-3-1-flash-lite'`
- **THEN** the mapped `DeploymentItemDto` has `reference: 'ref-gemini-3-1-flash-lite'`

#### Scenario: reference omitted when absent in source

- **WHEN** a DIAL Core deployment entry has no `reference` field
- **THEN** the mapped `DeploymentItemDto` has `reference` as `undefined`

#### Scenario: Backward compatibility — clients ignoring reference are unaffected

- **WHEN** an existing client calls `GET /api/v1/deployments` and does not read `reference`
- **THEN** the response is identical to the prior behavior for all pre-existing fields

---

### Requirement: Deployments domain structure

The backend SHALL implement the deployments feature in `apps/chat-api/src/deployments/` following the established domain pattern:

- `deployments.controller.ts` — thin controller with `@Get() listDeployments(@Query() query: DeploymentsQueryDto, @Req() req, @Res({ passthrough: true }) res)`
- `deployments.service.ts` — `DeploymentsService`, a thin delegation facade over `DeploymentsListingService`, `DeploymentsLookupService`, and `DeploymentsDetailsService`; `DeploymentsListingService` (`listing/deployments-listing.service.ts`) injects `DialClientService` (`apps/chat-api/src/dial/dial-client.service.ts`) for the shared DIAL SDK client, calls SDK `listDeployments`, and maps/caches results
- `deployments.module.ts` — `DeploymentsModule` providing `DeploymentsService`, `DeploymentsListingService`, `DeploymentsLookupService`, `DeploymentsDetailsService`; no external domain imports needed
- `dto/deployment-item.dto.ts` — `DeploymentItemDto` and `DeploymentsResponseDto` with `@ApiProperty` decorators
- `dto/deployments-query.dto.ts` — `DeploymentsQueryDto` with `interface_type` field: `@IsOptional`, `@IsArray`, `@IsIn([...], { each: true })`, `@Transform` for comma-separated coercion, and `refresh?: boolean` with `@IsBoolean` plus `true`/`false` string coercion
- `tests/deployments.controller.spec.ts`
- `tests/deployments.service.spec.ts`
- `tests/deployments.controller.integration.spec.ts`

`DeploymentsModule` SHALL be imported into `AppModule`.

#### Scenario: DeploymentsModule resolves without errors

- **WHEN** NestJS boots with `DeploymentsModule` imported into `AppModule`
- **THEN** `DeploymentsService` resolves without circular dependency errors

#### Scenario: Controller delegates to service with parsed query

- **WHEN** `listDeployments` is called with a validated `DeploymentsQueryDto`
- **THEN** the controller extracts `sub`, `at`, and `bucket` from `req.user`, sets the appropriate `Cache-Control` header, and calls `deploymentsService.listDeployments(sub, at, bucket, query.interface_type, query.refresh)`

---

### Requirement: Swagger and generated client for deployments

The `listDeployments` handler SHALL be annotated:

- `@ApiTags('deployments')`
- `@ApiOperation({ operationId: 'listDeployments', summary: 'List deployments by interface type' })`
- `@ApiQuery` for `interface_type` with enum values and multi-value example
- `@ApiQuery` for `refresh` as an optional boolean cache-bypass flag
- `@ApiResponse({ status: 200, type: DeploymentsResponseDto })`
- Standard 400, 401, 403, 429, 502, 503 `@ApiResponse` entries

The `'deployments'` tag SHALL be added in `openapi.config.ts`; the `'catalog'` tag SHALL be removed.

Running `npm run openapi` SHALL produce a `DeploymentsApi` class in `@epam/chat-api-client` with a `listDeployments(params?: ListDeploymentsRequest)` method typed to return `Promise<DeploymentsResponseDto>` where `ListDeploymentsRequest` contains `interfaceType?: string[]` and `refresh?: boolean`.

#### Scenario: Generated client exposes typed listDeployments method

- **WHEN** `npm run openapi` runs after adding the deployments controller
- **THEN** `@epam/chat-api-client` exports a `DeploymentsApi` class with `listDeployments` method accepting optional `interfaceType` array and `refresh` boolean

---

### Requirement: Frontend server-api wrapper for deployments

`apps/chat/src/server-api/deployments.api.ts` SHALL export:

```ts
export const getDeployments = (
  interfaceType?: string[],
  refresh?: boolean,
): Promise<DeploymentsResponseDto> =>
  deploymentsApi.listDeployments({ interfaceType, refresh });
```

`deploymentsApi` SHALL be instantiated in `api-client.ts`. Any existing `catalogApi` instance SHALL be removed.

#### Scenario: getDeployments with no params returns all deployments

- **WHEN** `getDeployments()` is called
- **THEN** it calls `deploymentsApi.listDeployments()` without throwing

#### Scenario: getDeployments with interface_type filters correctly

- **WHEN** `getDeployments(['chat'])` is called
- **THEN** it calls `deploymentsApi.listDeployments({ interfaceType: ['chat'] })`

#### Scenario: getDeployments can request a fresh list

- **WHEN** `getDeployments(['chat'], true)` is called
- **THEN** it calls `deploymentsApi.listDeployments({ interfaceType: ['chat'], refresh: true })`

---

### Requirement: Backend service tests for deployments

`deployments.service.spec.ts` SHALL cover:

- Successful mapping of `ModelOpenAi`, `ApplicationOpenAi`, `ToolsetOpenAi` entries to `DeploymentItemDto[]`
- Items without `id` are skipped
- `displayName` falls back to `id` when `display_name` is absent
- Quick Apps `application_properties.conversation_starters` is mapped to `conversationStarters`
- Cache hit — returns cached value without calling DIAL Core
- `interface_type` filter applied after cache hit — correct item count returned
- `refresh=true` bypasses the cached deployments list and calls DIAL Core
- DIAL Core 502 → service throws `BadGatewayException`
- DIAL Core unreachable → service throws `ServiceUnavailableException`

All DIAL Core calls SHALL be mocked; no live network calls.

#### Scenario: Service test — successful full listing

- **WHEN** DIAL Core returns 2 models, 1 application, 1 toolset
- **THEN** `listDeployments` returns `{ deployments: [DeploymentItemDto × 4] }` with correct `type` discriminators

#### Scenario: Service test — cache hit skips DIAL Core call

- **WHEN** `deployments:list:<userSub>` is populated in cache
- **THEN** the SDK `listDeployments` is NOT called on the second request

#### Scenario: Service test — refresh skips cached value

- **WHEN** `listDeployments` is called with `refresh=true` while a deployments cache entry exists
- **THEN** the SDK `listDeployments` is called and the returned deployments come from the fresh DIAL Core response

---

### Requirement: Catalog domain fully removed

The entire `apps/chat-api/src/catalog/` directory SHALL be deleted: `catalog.controller.ts`, `catalog.service.ts`, `catalog-filter.service.ts`, `catalog.module.ts`, all files under `dto/` and `tests/`.

`CatalogModule` SHALL be removed from `AppModule` imports. The `'catalog'` Swagger tag SHALL be removed from `openapi.config.ts`.

After removal, `GET /api/v1/catalog` SHALL return 404.

#### Scenario: Catalog endpoint removed

- **WHEN** `GET /api/v1/catalog` is called after the migration
- **THEN** the server returns 404

#### Scenario: No catalog imports remain in chat-api

- **WHEN** the codebase is scanned for `CatalogModule`, `CatalogService`, `CatalogFilterService`, `CatalogController`, `CatalogItemDto`
- **THEN** no references are found in `apps/chat-api/src/`
