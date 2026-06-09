### Requirement: GET /api/v1/deployments endpoint

The system SHALL expose `GET /api/v1/deployments` that proxies DIAL Core `GET /v1/deployments` and returns all deployments (models, applications, toolsets) visible to the authenticated session user, optionally filtered by interface type.

The endpoint:
- MUST require authentication via `SessionGuard`; respond 401 when no valid session is present.
- SHALL accept an optional `interface_type` query parameter as a repeatable string value validated against `('chat' | 'embeddings' | 'mcp' | 'custom_ui' | 'all')`; passing an unrecognised value MUST respond 400.
- SHALL forward the `interface_type` values to DIAL Core `GET /v1/deployments` when provided.
- SHALL call DIAL Core using the `@epam/ai-dial-typescript-sdk` client (`getDeploymentsByInterfaceType`), passing the session access token.
- SHALL map the DIAL Core response `deployments` array to `DeploymentItemDto[]` using the normalisation rules in the `DeploymentItemDto shape` requirement below.
- SHALL respond 200 with `{ deployments: DeploymentItemDto[] }` on success.
- SHALL respond 502 when DIAL Core returns a non-2xx response.
- SHALL respond 503 when DIAL Core is unreachable or times out.
- SHALL apply `@Throttle({ default: { limit: 60, ttl: 60000 } })`.
- SHALL cache the **unfiltered** full DIAL Core response under key `deployments:list:<userSub>` for 30 000 ms; `interface_type` filtering SHALL be applied in-process after cache retrieval.
- SHALL set response header `Cache-Control: private, max-age=30`.
- MUST NOT log the session access token.

#### Scenario: Authenticated user receives all deployments without filter

- **WHEN** `GET /api/v1/deployments` is called with a valid session and no `interface_type` parameter
- **THEN** the endpoint responds 200 with `{ deployments: DeploymentItemDto[] }` containing all models, applications, and toolsets from DIAL Core

#### Scenario: Authenticated user filters by single interface type

- **WHEN** `GET /api/v1/deployments?interface_type=chat` is called with a valid session
- **THEN** the endpoint responds 200 with `{ deployments: DeploymentItemDto[] }` containing only deployments whose DIAL Core `interfaces` array includes `'chat'`

#### Scenario: Authenticated user filters by multiple interface types

- **WHEN** `GET /api/v1/deployments?interface_type=chat&interface_type=mcp` is called with a valid session
- **THEN** the endpoint responds 200 with deployments matching either `'chat'` or `'mcp'` interface types

#### Scenario: Invalid interface_type value returns 400

- **WHEN** `GET /api/v1/deployments?interface_type=unknown` is called
- **THEN** the endpoint responds 400 with a validation error referencing `interface_type`

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

---

### Requirement: DeploymentItemDto shape

`DeploymentItemDto` SHALL be a strongly typed Swagger DTO that normalises DIAL Core's `ModelOpenAi | ApplicationOpenAi | ToolsetOpenAi` union into a flat structure:

- `id: string` — unique stable identifier from DIAL Core; items without an `id` SHALL be skipped during mapping
- `displayName: string` — `display_name` from DIAL Core, falling back to `id` when absent
- `type: 'model' | 'application' | 'toolset'` — discriminator; derived from DIAL Core `object` field (`"model"` → `'model'`, `"application"` → `'application'`); items with a `toolset` field present SHALL be mapped to `'toolset'`
- `iconUrl?: string` — `icon_url` from DIAL Core
- `description?: string` — `description` from DIAL Core
- `interfaces?: string[]` — `interfaces` from DIAL Core (list of interface types supported by the deployment)
- `inputAttachmentTypes?: string[]` — `input_attachment_types` from DIAL Core; omitted when the source field is absent or null

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

#### Scenario: inputAttachmentTypes mapped from DIAL Core

- **WHEN** a DIAL Core model entry has `input_attachment_types: ['audio/*', 'image/*']`
- **THEN** the mapped `DeploymentItemDto` has `inputAttachmentTypes: ['audio/*', 'image/*']`

#### Scenario: inputAttachmentTypes omitted when absent in source

- **WHEN** a DIAL Core model entry has no `input_attachment_types` field
- **THEN** the mapped `DeploymentItemDto` has `inputAttachmentTypes` as `undefined`

---

### Requirement: Deployments domain structure

The backend SHALL implement the deployments feature in `apps/chat-api/src/deployments/` following the established domain pattern:

- `deployments.controller.ts` — thin controller with `@Get() listDeployments(@Query() query: DeploymentsQueryDto, @Req() req)`
- `deployments.service.ts` — extends `AppService`; calls SDK `getDeploymentsByInterfaceType`; maps and caches results
- `deployments.module.ts` — `DeploymentsModule` providing `DeploymentsService`; no external domain imports needed
- `dto/deployment-item.dto.ts` — `DeploymentItemDto` and `DeploymentsResponseDto` with `@ApiProperty` decorators
- `dto/deployments-query.dto.ts` — `DeploymentsQueryDto` with `interface_type` field: `@IsOptional`, `@IsArray`, `@IsIn([...], { each: true })`, `@Transform` for comma-separated coercion
- `tests/deployments.controller.spec.ts`
- `tests/deployments.service.spec.ts`
- `tests/deployments.controller.integration.spec.ts`

`DeploymentsModule` SHALL be imported into `AppModule`.

#### Scenario: DeploymentsModule resolves without errors

- **WHEN** NestJS boots with `DeploymentsModule` imported into `AppModule`
- **THEN** `DeploymentsService` resolves without circular dependency errors

#### Scenario: Controller delegates to service with parsed query

- **WHEN** `listDeployments` is called with a validated `DeploymentsQueryDto`
- **THEN** the controller extracts `sub` and `at` from `req.user` and calls `deploymentsService.listDeployments(sub, at, query.interface_type)`

---

### Requirement: Swagger and generated client for deployments

The `listDeployments` handler SHALL be annotated:

- `@ApiTags('deployments')`
- `@ApiOperation({ operationId: 'listDeployments', summary: 'List deployments by interface type' })`
- `@ApiQuery` for `interface_type` with enum values and multi-value example
- `@ApiResponse({ status: 200, type: DeploymentsResponseDto })`
- Standard 400, 401, 403, 429, 502, 503 `@ApiResponse` entries

The `'deployments'` tag SHALL be added in `openapi.config.ts`; the `'catalog'` tag SHALL be removed.

Running `npm run openapi` SHALL produce a `DeploymentsApi` class in `@epam/chat-api-client` with a `listDeployments(params?: ListDeploymentsRequest)` method typed to return `Promise<DeploymentsResponseDto>` where `ListDeploymentsRequest` contains `interfaceType?: string[]`.

#### Scenario: Generated client exposes typed listDeployments method

- **WHEN** `npm run openapi` runs after adding the deployments controller
- **THEN** `@epam/chat-api-client` exports a `DeploymentsApi` class with `listDeployments` method accepting optional `interfaceType` array

---

### Requirement: Frontend server-api wrapper for deployments

`apps/chat/src/server-api/deployments.api.ts` SHALL export:

```ts
export const getDeployments = (interfaceType?: string[]): Promise<DeploymentsResponseDto> =>
  deploymentsApi.listDeployments({ interfaceType });
```

`deploymentsApi` SHALL be instantiated in `api-client.ts`. Any existing `catalogApi` instance SHALL be removed.

#### Scenario: getDeployments with no params returns all deployments

- **WHEN** `getDeployments()` is called
- **THEN** it calls `deploymentsApi.listDeployments()` without throwing

#### Scenario: getDeployments with interface_type filters correctly

- **WHEN** `getDeployments(['chat'])` is called
- **THEN** it calls `deploymentsApi.listDeployments({ interfaceType: ['chat'] })`

---

### Requirement: Backend service tests for deployments

`deployments.service.spec.ts` SHALL cover:

- Successful mapping of `ModelOpenAi`, `ApplicationOpenAi`, `ToolsetOpenAi` entries to `DeploymentItemDto[]`
- Items without `id` are skipped
- `displayName` falls back to `id` when `display_name` is absent
- Cache hit — returns cached value without calling DIAL Core
- `interface_type` filter applied after cache hit — correct item count returned
- DIAL Core 502 → service throws `BadGatewayException`
- DIAL Core unreachable → service throws `ServiceUnavailableException`

All DIAL Core calls SHALL be mocked; no live network calls.

#### Scenario: Service test — successful full listing

- **WHEN** DIAL Core returns 2 models, 1 application, 1 toolset
- **THEN** `listDeployments` returns `{ deployments: [DeploymentItemDto × 4] }` with correct `type` discriminators

#### Scenario: Service test — cache hit skips DIAL Core call

- **WHEN** `deployments:list:<userSub>` is populated in cache
- **THEN** the SDK `getDeploymentsByInterfaceType` is NOT called on the second request

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
