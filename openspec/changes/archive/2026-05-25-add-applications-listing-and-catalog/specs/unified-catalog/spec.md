## ADDED Requirements

### Requirement: Unified catalog endpoint
The system SHALL expose `GET /api/v1/catalog` that returns models and applications merged into a single sorted list for the authenticated session user.

The endpoint SHALL:
- Require a valid session; respond 401 when no session is present.
- Fetch models via `ModelsService.listModels` and applications via `ApplicationsService.listApplications` (both may be served from their respective caches).
- If either upstream call fails, respond with the mapped error status (502 or 503); do not return a partial list.
- Merge results into `CatalogItemDto[]` and sort by `displayName` case-insensitively ascending; use `id` as a tiebreaker.
- Cache the merged result under key `catalog:list:<userSub>` for 30 000 ms.
- Apply `@Throttle({ default: { limit: 60, ttl: 60000 } })`.
- Set response header `Cache-Control: private, max-age=30`.
- Not log the access token, session cookie, or any secret.

#### Scenario: Successful merge of models and applications
- **WHEN** the authenticated user calls `GET /api/v1/catalog`
- **AND** models and applications are both available
- **THEN** the endpoint responds 200 with `{ data: CatalogItemDto[] }` containing all models and applications, sorted by `displayName` ascending

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
- **THEN** the catalog responds 200 with `{ data: CatalogItemDto[N] }` containing only models

#### Scenario: Unauthenticated request
- **WHEN** a request arrives with no valid session cookie
- **THEN** the endpoint responds 401

#### Scenario: Rate limit exceeded
- **WHEN** the request rate exceeds 60 per minute for the client
- **THEN** the endpoint responds 429

#### Scenario: Catalog cache hit
- **WHEN** `catalog:list:<userSub>` is present in the cache
- **THEN** the service returns the cached merged list without calling models or applications services

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

`CatalogResponseDto` SHALL wrap this as `{ data: CatalogItemDto[] }`.

No `any` types are allowed in success response shapes.

#### Scenario: Model item has type model
- **WHEN** a `DialModelDto` is mapped to `CatalogItemDto`
- **THEN** `type` is `'model'` and `id` and `displayName` are populated

#### Scenario: Application item has type application
- **WHEN** an `ApplicationDto` is mapped to `CatalogItemDto`
- **THEN** `type` is `'application'` and `id` and `displayName` are populated

#### Scenario: displayName falls back to id
- **WHEN** a source item has no `displayName`
- **THEN** `CatalogItemDto.displayName` equals the source `id`

---

### Requirement: Catalog domain structure
The backend SHALL implement the catalog feature in `apps/chat-api/src/catalog/` following the established domain pattern:

- `catalog.controller.ts` — thin controller with `@Get() listCatalogItems(@Req() req)`
- `catalog.service.ts` — `CatalogService extends AppService`; injects `ModelsService` and `ApplicationsService`; merges, sorts, caches
- `catalog.module.ts` — `CatalogModule` that imports `ModelModule`, `ApplicationsModule`, and `CacheModule`
- `dto/catalog-item.dto.ts` — `CatalogItemDto` and `CatalogResponseDto` with `@ApiProperty` decorators
- `tests/catalog.controller.spec.ts`
- `tests/catalog.service.spec.ts`

`CatalogModule` SHALL be imported into `AppModule`.

#### Scenario: CatalogModule imports dependencies
- **WHEN** NestJS boots
- **THEN** `CatalogModule` resolves `ModelsService` and `ApplicationsService` without circular dependency errors

#### Scenario: Controller delegates to service
- **WHEN** `listCatalogItems` is called
- **THEN** the controller extracts `sub` and `at` from `req.user` and calls `catalogService.listCatalogItems(sub, at)`

---

### Requirement: Swagger and generated client for catalog
The `listCatalogItems` handler SHALL be annotated:

- `@ApiOperation({ operationId: 'listCatalogItems', summary: 'List all catalog items (models and applications)' })`
- `@ApiResponse({ status: 200, type: CatalogResponseDto })`
- Standard 401, 403, 429, 502, 503 `@ApiResponse` entries

Running `npm run openapi`, `npm run openapi:check`, `npm exec nx build chat-api-client -- --skip-nx-cache`, and `npm exec nx lint chat-api-client` SHALL pass.

#### Scenario: Generated client exposes listCatalogItems
- **WHEN** `npm run openapi` runs after adding the catalog endpoint
- **THEN** `@epam/chat-api-client` exports a `CatalogApi` class with a `listCatalogItems()` method typed to return `Promise<CatalogResponseDto>`

---

### Requirement: Frontend server-api wrapper for catalog
`apps/chat/src/server-api/catalog.ts` SHALL export:

```typescript
export const getCatalogItems = (): Promise<CatalogResponseDto> =>
  catalogApi.listCatalogItems();
```

`catalogApi` SHALL be instantiated in `api-client.ts` alongside `modelsApi` and `deploymentsApi`.

#### Scenario: Wrapper delegates to generated client
- **WHEN** `getCatalogItems()` is called
- **THEN** it calls `catalogApi.listCatalogItems()` and returns the result without transformation

---

### Requirement: CatalogContext owns unified deployment selection
`apps/chat/src/context/CatalogContext.tsx` SHALL provide:

- `items: CatalogItemDto[]` — full sorted catalog from `GET /api/v1/catalog`
- `selectedItemId: string | null` — currently selected model or application id
- `setSelectedItemId: (id: string) => void`
- `isLoading: boolean`
- `error: Error | null`

The provider SHALL:
- Fetch catalog items on mount using `getCatalogItems()` from `server-api/catalog.ts`.
- Use a `cancelled` flag inside `useEffect` to guard against setState-on-unmount.
- Use `useMemo` to memoize the context value.
- Default `selectedItemId` to the first item's `id` on successful load.
- Export a `useCatalog()` hook that throws a clear error when called outside the provider.

The state management pattern SHALL follow `ModelsContext.tsx` as the reference implementation.

The conversation-flow model/application selection component SHALL consume `useCatalog` instead of `useModels`.

`ModelsContext` and `useModels` SHALL remain unchanged.

#### Scenario: CatalogProvider loads items on mount
- **WHEN** `CatalogProvider` mounts
- **THEN** it calls `getCatalogItems()`, sets `isLoading: true` during fetch, sets `items` on success, sets `error` on failure, and sets `isLoading: false` when done

#### Scenario: selectedItemId defaults to first item
- **WHEN** the catalog loads successfully with one or more items
- **THEN** `selectedItemId` is set to `items[0].id`

#### Scenario: useCatalog throws outside provider
- **WHEN** `useCatalog()` is called outside a `CatalogProvider`
- **THEN** it throws `Error('useCatalog must be used within a CatalogProvider')`

#### Scenario: Unmount before fetch completes — no state update
- **WHEN** `CatalogProvider` unmounts before `getCatalogItems()` resolves
- **THEN** the `cancelled` flag prevents any `setState` calls

#### Scenario: Conversation model selection uses CatalogContext
- **WHEN** the user opens the conversation model/application selector
- **THEN** the displayed items come from `useCatalog().items`, not `useModels().models`

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
- **THEN** the selector trigger shows a circular `DialSkeleton` from `@epam/ai-dial-ui-kit`
- **AND** the opened desktop dropdown and mobile bottom sheet each show exactly seven disabled rows
- **AND** every row contains one circular icon skeleton and one text skeleton
- **AND** the text resolved from `catalog.loading` remains available to assistive technology without being shown as a visible loading row

#### Scenario: Error state displays translated string
- **WHEN** `error` is non-null in `CatalogContext`
- **THEN** the selection UI shows the text resolved from `catalog.error`

---

### Requirement: Backend service tests for catalog
`catalog.service.spec.ts` SHALL cover:

- Successful merge and sort of models and applications
- Sort correctness: case-insensitive ascending by displayName, id as tiebreaker
- Models fetch fails → rethrows without partial data
- Applications fetch fails → rethrows without partial data
- Empty applications list → returns models only
- Cache hit → returns cached value without calling ModelsService or ApplicationsService

All upstream calls SHALL be mocked; no live network calls.

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
