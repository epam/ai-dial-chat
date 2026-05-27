## 1. Remove Catalog — Backend

- [x] 1.1 Delete `apps/chat-api/src/catalog/` directory entirely (controller, service, filter service, module, all DTOs, all tests)
- [x] 1.2 Remove `CatalogModule` import from `apps/chat-api/src/app/app.module.ts`
- [x] 1.3 Remove `'catalog'` tag from `apps/chat-api/src/openapi/openapi.config.ts`
- [x] 1.4 Run `npm exec nx test chat-api` — verify all remaining tests pass

## 2. Remove Catalog — Frontend

- [x] 2.1 Delete `apps/chat/src/context/CatalogContext.tsx` and `apps/chat/src/context/tests/CatalogContext.spec.tsx`
- [x] 2.2 Delete `apps/chat/src/server-api/catalog.ts`
- [x] 2.3 Remove `catalogApi` instance and `CatalogApi` import from `apps/chat/src/server-api/api-client.ts`
- [x] 2.4 Remove all `CatalogProvider` / `useCatalog` / `getCatalogItems` references from `apps/chat/src/`

## 3. Backend — DTOs

- [x] 3.1 Create `apps/chat-api/src/deployments/dto/deployment-item.dto.ts` — define `DeploymentItemDto` (`id`, `displayName`, `type: 'model' | 'application' | 'toolset'`, `iconUrl?`, `description?`, `interfaces?`) and `DeploymentsResponseDto` (`{ deployments: DeploymentItemDto[] }`) with `@ApiProperty` / `@ApiPropertyOptional` decorators
- [x] 3.2 Create `apps/chat-api/src/deployments/dto/deployments-query.dto.ts` — define `DeploymentsQueryDto` with `interface_type?: string[]`; apply `@IsOptional`, `@IsArray`, `@IsIn(['chat', 'embeddings', 'mcp', 'custom_ui', 'all'], { each: true })`, and `@Transform` to coerce comma-separated string to array

## 4. Backend — Service

- [x] 4.1 Create `apps/chat-api/src/deployments/deployments.service.ts` — extend `AppService`; inject `CACHE_MANAGER`; implement `listDeployments(userSub, accessToken, interfaceType?)` that calls `this.client.getDeploymentsByInterfaceType({ query: { interface_type: interfaceType } })`, maps the response to `DeploymentItemDto[]`, caches under `deployments:list:<userSub>` for 30 000 ms, and applies `interface_type` filtering in-process after cache retrieval
- [x] 4.2 Add mapping helper `mapToDeploymentItem(raw)` — derive `type` from `raw.object` (`'model'` | `'application'`) or `'toolset'` when `raw.toolset` is present; skip entries without `id`; map `display_name → displayName`, `icon_url → iconUrl`

## 5. Backend — Controller and Module

- [x] 5.1 Create `apps/chat-api/src/deployments/deployments.controller.ts` — `@ApiTags('deployments')`, `@Controller({ path: 'deployments', version: '1' })`; `@Get()` handler with `@Throttle({ default: { limit: 60, ttl: 60000 } })`, `@Header('Cache-Control', 'private, max-age=30')`, full `@ApiOperation` / `@ApiQuery` / `@ApiResponse` Swagger annotations (200, 400, 401, 403, 429, 502, 503)
- [x] 5.2 Create `apps/chat-api/src/deployments/deployments.module.ts` — `DeploymentsModule` providing `DeploymentsService`
- [x] 5.3 Import `DeploymentsModule` into `apps/chat-api/src/app/app.module.ts`
- [x] 5.4 Add `'deployments'` tag to `apps/chat-api/src/openapi/openapi.config.ts`

## 6. Backend — Tests

- [x] 6.1 Create `apps/chat-api/src/deployments/tests/deployments.service.spec.ts` — mock SDK `getDeploymentsByInterfaceType`; cover: successful 3-type mapping, items without `id` skipped, `displayName` fallback, cache hit skips SDK call, `interface_type` filter after cache, 502 and 503 error mapping
- [x] 6.2 Create `apps/chat-api/src/deployments/tests/deployments.controller.spec.ts` — mock `DeploymentsService`; cover: delegates to service with parsed query, extracts `sub` and `at` from request
- [x] 6.3 Create `apps/chat-api/src/deployments/tests/deployments.controller.integration.spec.ts` — use supertest; cover: 200 without filter, 200 with `?interface_type=chat`, 400 with invalid `interface_type`, 401 without session
- [x] 6.4 Run `npm exec nx test chat-api` — all tests pass

## 7. Generated Client

- [x] 7.1 Run `npm run openapi` — regenerates `openapi.json` and `@epam/chat-api-client`; verify `DeploymentsApi` class and `DeploymentItemDto` / `DeploymentsResponseDto` types are present; verify `CatalogApi` is absent
- [x] 7.2 Run `npm run openapi:check` — passes with no diff

## 8. Frontend — Server-API Wrapper

- [x] 8.1 Add `deploymentsApi = new DeploymentsApi(config)` to `apps/chat/src/server-api/api-client.ts`
- [x] 8.2 Create `apps/chat/src/server-api/deployments.api.ts` — export `getDeployments(interfaceType?: string[])` wrapping `deploymentsApi.listDeployments({ interfaceType })`

## 9. Frontend — DeploymentsContext

- [x] 9.1 Create `apps/chat/src/context/DeploymentsContext.tsx` — follow `ThemeContext.tsx` pattern; state: `items: DeploymentItemDto[]`, `selectedItemId: string | null`, `setSelectedItemId`, `isLoading`, `error`; fetch via `getDeployments()` on mount with `cancelled` flag; `useMemo` on context value; export `DeploymentsProvider` and `useDeployments()`
- [x] 9.2 Create `apps/chat/src/context/tests/DeploymentsContext.spec.tsx` — cover: items load and default selection, `setSelectedItemId` updates state, `useDeployments` throws outside provider, unmount guard, previously selected id not in new items resets selection, fetch error sets `error`

## 10. Frontend — Wire DeploymentsContext into Conversation Routes

- [x] 10.1 Update `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` — replace `useCatalog()` with `useDeployments()`; pass `items` as `catalogItems`, `selectedItemId` as `selectedCatalogItemId`, `setSelectedItemId` as `onSelectedCatalogItemChange`
- [x] 10.2 Update `apps/chat/src/components/ConversationView/ConversationView.tsx` — same swap if it consumes `useCatalog()`
- [x] 10.3 Replace `<CatalogProvider>` with `<DeploymentsProvider>` in the route wrapper
- [x] 10.4 Update `apps/chat/src/pages/ConversationRoute/ConversationRoute.spec.tsx` — update mocks and assertions to reference `getDeployments` and `DeploymentsContext`

## 11. Update model-selector-in-chat-input Openspec

- [x] 11.1 Replace all `CatalogContext` / `useCatalog()` / `getCatalogItems()` / `CatalogItemDto` references in `openspec/changes/model-selector-in-chat-input/specs/unified-catalog/spec.md` with `DeploymentsContext` / `useDeployments()` / `getDeployments()` / `DeploymentItemDto` per the delta spec at `openspec/changes/deployment-listing/specs/unified-catalog/spec.md`

## 12. Verification

- [x] 12.1 Run `npm exec nx test chat` — all frontend tests pass including `DeploymentsContext.spec.tsx` and updated `ConversationRoute.spec.tsx`
- [x] 12.2 Run `npm exec nx lint chat chat-api chat-api-client` — no lint errors
- [x] 12.3 Run `npm exec nx typecheck chat chat-api` — no type errors
- [x] 12.4 Run `npm exec nx build chat-api-client` — generated client builds successfully
- [x] 12.5 Verify `GET /api/v1/catalog` returns 404 and `GET /api/v1/deployments` returns 200
