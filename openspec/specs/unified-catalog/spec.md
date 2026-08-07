### Requirement: Unified catalog endpoint
The system SHALL expose `GET /api/v1/catalog` that returns models and applications merged into a single sorted list for the authenticated session user, optionally filtered by model capability query parameters.

The endpoint SHALL:
- Require a valid session; respond 401 when no session is present.
- Accept an optional `CatalogQueryDto` as query parameters; bind and validate via NestJS `ValidationPipe` (whitelist, forbidNonWhitelisted).
- Fetch models via `ModelsService.listModels` and applications via `ApplicationsService.listApplications` (both may be served from their respective caches).
- If either upstream call fails, respond with the mapped error status (502 or 503); do not return a partial list.
- Merge results into `CatalogItemDto[]` and sort by `displayName` case-insensitively ascending; use `id` as a tiebreaker.
- Apply `CatalogFilterService.apply` to the sorted merged list using the normalized capability-only `CatalogFilter` from `CatalogFilterService.parse(dto)`.
- Record `total` (count before filtering) and `filtered` (count after filtering) and include them in `CatalogResponseDto`.
- Cache the **unfiltered** merged list under key `catalog:list:<userSub>` for 30 000 ms; filtering is applied after cache retrieval and filtered results are NOT cached separately.
- Apply `@Throttle({ default: { limit: 60, ttl: 60000 } })`.
- Set response header `Cache-Control: private, max-age=30`.
- Not log the access token, session cookie, or any secret.

#### Scenario: Successful merge with no filter params
- **WHEN** the authenticated user calls `GET /api/v1/catalog` with no query parameters
- **THEN** the endpoint responds 200 with `{ data: CatalogItemDto[], total: N, filtered: N }` where `total === filtered === N`

#### Scenario: Successful merge with model capability filters
- **WHEN** the authenticated user calls `GET /api/v1/catalog?modelCapabilities.chat_completion=true&modelCapabilities.embeddings=false`
- **THEN** the endpoint responds 200 with matching model items and unfiltered application items in `data`, and `total` reflects the full unfiltered count while `filtered` reflects the matching model count plus the application count

#### Scenario: Invalid query param returns 400
- **WHEN** `GET /api/v1/catalog?types=model` is called
- **THEN** the endpoint responds 400 with a validation error

#### Scenario: Sort is case-insensitive and alphabetical
- **WHEN** the merged list contains items with `displayName` values `['Zebra App', 'alpha model', 'Beta App']`
- **THEN** the sorted order is `['alpha model', 'Beta App', 'Zebra App']`

#### Scenario: Id tiebreaker when displayNames are equal
- **WHEN** two items share the same `displayName`
- **THEN** the item with the lexicographically smaller `id` appears first

#### Scenario: Models fetch fails — full request fails
- **WHEN** `ModelsService.listModels` throws a mapped HTTP exception
- **THEN** `CatalogService` rethrows the exception and the endpoint responds with the corresponding error status (502 or 503); no partial list is returned

#### Scenario: Applications fetch fails — full request fails
- **WHEN** `ApplicationsService.listApplications` throws a mapped HTTP exception
- **THEN** `CatalogService` rethrows the exception and the endpoint responds with the corresponding error status; no partial list is returned

#### Scenario: Empty application list merged with models
- **WHEN** applications returns `{ data: [] }` and models returns N items
- **THEN** the catalog responds 200 with `{ data: CatalogItemDto[N], total: N, filtered: N }`

#### Scenario: Unauthenticated request
- **WHEN** a request arrives with no valid session cookie
- **THEN** the endpoint responds 401

#### Scenario: Rate limit exceeded
- **WHEN** the request rate exceeds 60 per minute for the client
- **THEN** the endpoint responds 429

#### Scenario: Catalog cache hit — filter applied to cached list
- **WHEN** `catalog:list:<userSub>` is present in the cache
- **AND** the request includes `?modelCapabilities.chat_completion=true&modelCapabilities.embeddings=false`
- **THEN** the service returns the cached merged list and applies the capability filter to model items without calling models or applications services; `total` equals the cached count, `filtered` equals the matching model count plus the application count

---

### Requirement: CatalogItemDto shape
`CatalogItemDto` SHALL be a strongly typed Swagger DTO with the following fields:

- `id: string` — unique stable identifier from DIAL Core
- `displayName: string` — human-readable display name; falls back to `id` when absent in source
- `type: 'model' | 'application'` — discriminator for UI rendering
- `description?: string` — optional description
- `iconUrl?: string` — optional icon URL
- `maxInputAttachments?: number` — maximum number of input attachments
- `inputAttachmentTypes?: string[]` — accepted MIME types for input attachments
- `capabilities?: Record<string, boolean>` — DIAL Core boolean capability fields from `ModelData.capabilities`; absent for `type: 'application'` items; `scale_types` is excluded (it is a string array, not a boolean flag)

`CatalogResponseDto` SHALL wrap this as `{ data: CatalogItemDto[], total: number, filtered: number }`.

No `any` types are allowed in success response shapes.

#### Scenario: Model item has type model and model-specific fields
- **WHEN** a model is mapped to `CatalogItemDto`
- **THEN** `type` is `'model'`, `capabilities` MAY be present, and application-specific fields are absent

#### Scenario: Application item has type application and application-specific fields
- **WHEN** an application is mapped to `CatalogItemDto`
- **THEN** `type` is `'application'`, and `capabilities` is absent

#### Scenario: displayName falls back to id
- **WHEN** a source item has no `displayName`
- **THEN** `CatalogItemDto.displayName` equals the source `id`

#### Scenario: total and filtered both present in response
- **WHEN** any request is made to `GET /api/v1/catalog` regardless of filter params
- **THEN** both `total` and `filtered` are present in the response body as non-negative integers

---

### Requirement: Catalog domain structure
The backend SHALL implement the catalog feature in `apps/chat-api/src/catalog/` following the established domain pattern:

- `catalog.controller.ts` — thin controller with `@Get() listCatalogItems(@Query() query: CatalogQueryDto, @Req() req)`
- `catalog.service.ts` — injects `ModelsService`, `ApplicationsService`, and `CatalogFilterService`; merges, sorts, filters, caches
- `catalog-filter.service.ts` — `CatalogFilterService`; parse + capability predicate; no upstream calls
- `catalog.module.ts` — `CatalogModule` that imports `ModelModule`, `ApplicationsModule`, and `CacheModule`; provides both `CatalogService` and `CatalogFilterService`
- `dto/catalog-item.dto.ts` — `CatalogItemDto` and `CatalogResponseDto` with `@ApiProperty` decorators
- `dto/catalog-query.dto.ts` — `CatalogQueryDto` with `class-validator`, `class-transformer`, and `@ApiQuery` decorators
- `tests/catalog.controller.spec.ts`
- `tests/catalog.service.spec.ts`
- `tests/catalog-filter.service.spec.ts`

`CatalogModule` SHALL be imported into `AppModule`.

#### Scenario: CatalogModule imports dependencies
- **WHEN** NestJS boots
- **THEN** `CatalogModule` resolves `ModelsService`, `ApplicationsService`, `CatalogService`, and `CatalogFilterService` without circular dependency errors

#### Scenario: Controller delegates to service with parsed filter
- **WHEN** `listCatalogItems` is called with a validated `CatalogQueryDto`
- **THEN** the controller extracts `sub` and `at` from `req.user` and calls `catalogService.listCatalogItems(sub, at, filter)` where `filter` is produced by `CatalogFilterService.parse(query)`

---

### Requirement: Swagger and generated client for catalog
The `listCatalogItems` handler SHALL be annotated:

- `@ApiOperation({ operationId: 'listCatalogItems', summary: 'List all catalog items (models and applications)' })`
- Swagger query metadata for each `CatalogQueryDto` capability field
- `@ApiResponse({ status: 200, type: CatalogResponseDto })`
- Swagger examples for at least: no filter and `modelCapabilities.chat_completion=true&modelCapabilities.embeddings=false`
- Standard 400, 401, 403, 429, 502, 503 `@ApiResponse` entries

Running `npm run openapi`, `npm run openapi:check`, `npm exec nx build chat-api-client -- --skip-nx-cache`, and `npm exec nx lint chat-api-client` SHALL pass.

#### Scenario: Generated client exposes typed listCatalogItems params
- **WHEN** `npm run openapi` runs after adding the catalog query params
- **THEN** `@epam/chat-api-client` exports a `CatalogApi` class with a `listCatalogItems(requestParameters?: ListCatalogItemsRequest)` method typed to return `Promise<CatalogResponseDto>` where `ListCatalogItemsRequest` contains all query param fields as optional typed properties

---

### Requirement: Frontend server-api wrapper for catalog
`apps/chat/src/server-api/catalog.ts` SHALL accept an optional `ListCatalogItemsRequest` argument and forward it unchanged to the generated `catalogApi.listCatalogItems(params)`.

The generated `@epam/chat-api-client` request type SHALL be used directly as the param type (no hand-crafted wrapper type).

`catalogApi` SHALL be instantiated in `api-client.ts` alongside `modelsApi` and `deploymentsApi`.

#### Scenario: getCatalogItems passes capability filter params to generated client
- **WHEN** `getCatalogItems({ modelCapabilitiesChatCompletion: true, modelCapabilitiesEmbeddings: false })` is called
- **THEN** it calls `catalogApi.listCatalogItems({ modelCapabilitiesChatCompletion: true, modelCapabilitiesEmbeddings: false })` and returns the result

#### Scenario: getCatalogItems with no params calls without params
- **WHEN** `getCatalogItems()` is called
- **THEN** it calls `catalogApi.listCatalogItems()` without throwing

---

### Requirement: DeploymentsContext owns unified deployment selection
`apps/chat/src/context/DeploymentsContext.tsx` (replaces `CatalogContext.tsx`) SHALL provide:

- `items: DeploymentItemDto[]` — full deployment list from `GET /api/v1/deployments` (replaces `CatalogItemDto[]` from `GET /api/v1/catalog`)
- `selectedItemId: string | null` — currently selected deployment id
- `setSelectedItemId: (id: string) => void`
- `isLoading: boolean`
- `error: Error | null`

The provider SHALL:
- Fetch deployments on mount using `getDeployments()` from `server-api/deployments.api.ts` (replaces `getCatalogItems()` from `server-api/catalog.ts`).
- Use a `cancelled` flag inside `useEffect` to guard against setState-on-unmount.
- Use `useMemo` to memoize the context value.
- Default `selectedItemId` to the first item's `id` on successful load.
- If the deployments reload and the previously selected `id` is no longer present in `items`, reset `selectedItemId` to `items[0]?.id ?? null`.
- Export a `useDeployments()` hook (replaces `useCatalog()`) that throws a clear error when called outside the provider.

The conversation input model/application selection component in `apps/chat` SHALL consume `useDeployments()` to supply `catalogItems`, `selectedCatalogItemId`, and `onSelectedCatalogItemChange` props to `ConversationInput`. `setSelectedItemId` from `DeploymentsContext` is the handler for `onSelectedCatalogItemChange`.

`ModelsContext` and `useModels` SHALL remain unchanged. `CatalogContext.tsx` SHALL be deleted.

#### Scenario: DeploymentsProvider loads items on mount
- **WHEN** `DeploymentsProvider` mounts
- **THEN** it calls `getDeployments()`, sets `isLoading: true` during fetch, sets `items` on success, sets `error` on failure, and sets `isLoading: false` when done

#### Scenario: selectedItemId defaults to first item
- **WHEN** the deployments load successfully with one or more items
- **THEN** `selectedItemId` is set to `items[0].id`

#### Scenario: useDeployments throws outside provider
- **WHEN** `useDeployments()` is called outside a `DeploymentsProvider`
- **THEN** it throws `Error('useDeployments must be used within a DeploymentsProvider')`

#### Scenario: Unmount before fetch completes — no state update
- **WHEN** `DeploymentsProvider` unmounts before `getDeployments()` resolves
- **THEN** the `cancelled` flag prevents any `setState` calls

#### Scenario: Conversation model selection uses DeploymentsContext
- **WHEN** the user opens the conversation model/application/toolset selector
- **THEN** the displayed items come from `useDeployments().items`, not from `useModels().models`

#### Scenario: onSelectedCatalogItemChange updates DeploymentsContext
- **WHEN** the user selects a deployment with `id: "dep-2"` via the `DialDropdownIcon` menu
- **THEN** `useDeployments().selectedItemId === "dep-2"` in `DeploymentsContext`

---

### Requirement: i18n keys for catalog UI strings
All user-visible strings introduced by the catalog selection UI SHALL use `react-i18next` keys in `apps/chat/src/i18n/locales/en.json`.

Required keys (minimum, extend as needed):
- `catalog.loading` — e.g. `"Loading catalog…"`
- `catalog.error` — e.g. `"Failed to load catalog. Please try again."`
- `catalog.empty` — e.g. `"No models or applications available."`
- `catalog.type.model` — e.g. `"Model"`
- `catalog.type.application` — e.g. `"Application"`

#### Scenario: Loading state displays deployment skeletons
- **WHEN** `isLoading` is `true` in `CatalogContext`
- **THEN** the selector trigger shows a circular `Skeleton` from `@epam/ai-dial-ui-kit`
- **AND** the opened desktop dropdown and mobile bottom sheet each show exactly seven disabled rows
- **AND** every row contains one circular icon skeleton and one text skeleton
- **AND** the text resolved from `catalog.loading` remains available to assistive technology without being shown as a visible loading row

#### Scenario: Error state displays translated string
- **WHEN** `error` is non-null in `CatalogContext`
- **THEN** the selection UI shows the text resolved from `catalog.error`

---

### Requirement: Backend service tests for catalog
`catalog.service.spec.ts` SHALL cover:

- Successful merge and sort of models and applications (no filter)
- Sort correctness: case-insensitive ascending by displayName, id as tiebreaker
- Models fetch fails → rethrows without partial data
- Applications fetch fails → rethrows without partial data
- Empty applications list → returns models only
- Cache hit → returns cached value without calling ModelsService or ApplicationsService
- Filter applied after cache hit → correct `total` and `filtered` counts
- `modelCapabilities.chat_completion=true&modelCapabilities.embeddings=false` filter → matching models and unfiltered applications returned; `filtered < total` when any model is filtered out
- Empty result after filtering → `{ data: [], total: N, filtered: 0 }`

All upstream calls SHALL be mocked; no live network calls.

#### Scenario: Service test — filter after cache hit
- **WHEN** the cache returns N items (mix of models and applications) and filter is `{ capabilities: { chat_completion: true, embeddings: false } }`
- **THEN** `CatalogService.listCatalogItems` returns `{ data: <matching models and all applications>, total: N, filtered: <matching model count + application count> }` without calling ModelsService or ApplicationsService

#### Scenario: Service test for sort order
- **WHEN** models returns `[{ id: 'm1', displayName: 'Zebra' }]` and applications returns `[{ id: 'a1', displayName: 'alpha' }]`
- **THEN** the merged result is `[{ id: 'a1', displayName: 'alpha', type: 'application' }, { id: 'm1', displayName: 'Zebra', type: 'model' }]`

#### Scenario: Service test for partial failure
- **WHEN** ApplicationsService.listApplications throws BadGatewayException
- **THEN** CatalogService.listCatalogItems rethrows BadGatewayException without calling cacheManager.set

---

### Requirement: Legacy deployments endpoint deprecated
`GET /api/deployments` SHALL remain functional but SHALL be annotated `@ApiOperation({ deprecated: true })` in Swagger and SHALL include a `Deprecation: true` response header.

No new business logic SHALL be added to it. New consumers SHALL use `/api/v1/catalog`.

#### Scenario: Legacy endpoint still responds
- **WHEN** a client calls `GET /api/deployments`
- **THEN** the endpoint responds with the existing behavior unchanged

#### Scenario: Swagger marks endpoint as deprecated
- **WHEN** the OpenAPI spec is generated
- **THEN** `GET /api/deployments` appears with `deprecated: true`


---

### Requirement: DeploymentsContext owns frontend deployment selection (replaces CatalogContext)

`apps/chat/src/context/DeploymentsContext.tsx` (replaces the deleted `CatalogContext.tsx`) SHALL provide:

- `items: DeploymentItemDto[]` — full deployment list from `GET /api/v1/deployments` (replaces `CatalogItemDto[]` from `GET /api/v1/catalog`)
- `selectedItemId: string | null` — currently selected deployment id
- `setSelectedItemId: (id: string) => void`
- `isLoading: boolean`
- `error: Error | null`

The provider SHALL:
- Fetch deployments on mount using `getDeployments()` from `server-api/deployments.api.ts` (replaces `getCatalogItems()` from `server-api/catalog.ts`).
- Use a `cancelled` flag inside `useEffect` to guard against setState-on-unmount.
- Use `useMemo` to memoize the context value.
- Default `selectedItemId` to the first item's `id` on successful load.
- If the deployments reload and the previously selected `id` is no longer present in `items`, reset `selectedItemId` to `items[0]?.id ?? null`.
- Export a `useDeployments()` hook that throws a clear error when called outside the provider.

The conversation input model/application selection component in `apps/chat` SHALL consume `useDeployments()` to supply `catalogItems`, `selectedCatalogItemId`, and `onSelectedCatalogItemChange` props to `ConversationInput`. `setSelectedItemId` from `DeploymentsContext` is the handler for `onSelectedCatalogItemChange`.

`ModelsContext` and `useModels` SHALL remain unchanged. `CatalogContext.tsx` SHALL be deleted.

#### Scenario: DeploymentsProvider loads items on mount

- **WHEN** `DeploymentsProvider` mounts
- **THEN** it calls `getDeployments()`, sets `isLoading: true` during fetch, sets `items` on success, sets `error` on failure, and sets `isLoading: false` when done

#### Scenario: selectedItemId defaults to first item

- **WHEN** the deployments load successfully with one or more items
- **THEN** `selectedItemId` is set to `items[0].id`

#### Scenario: useDeployments throws outside provider

- **WHEN** `useDeployments()` is called outside a `DeploymentsProvider`
- **THEN** it throws `Error('useDeployments must be used within a DeploymentsProvider')`

#### Scenario: Previously selected item removed after reload

- **WHEN** `selectedItemId` is `"old-dep"` and the deployments reload returning items that do not include `"old-dep"`
- **THEN** `selectedItemId` is reset to `items[0]?.id ?? null`

#### Scenario: Conversation model selection uses DeploymentsContext

- **WHEN** the user opens the conversation model/application selector
- **THEN** the displayed items come from `useDeployments().items`

#### Scenario: onSelectedCatalogItemChange updates DeploymentsContext

- **WHEN** the user selects a deployment with `id: "dep-2"` via the `DialDropdownIcon` menu
- **THEN** `useDeployments().selectedItemId === "dep-2"` in `DeploymentsContext`
