## 1. Prerequisites

- [x] 1.1 Read the DIAL Core Applications API OpenAPI spec at https://dialx.ai/dial_api#tag/Applications/operation/getApplicationMetadata; confirm pagination query param name (e.g. `token`), next-page response field (e.g. `nextToken`), empty-page sentinel, and exact field names in the application object (`displayName`, `iconUrl`, `maxInputAttachments`, `inputAttachmentTypes`, `description`). Document findings as inline comments in `ApplicationsService` before writing loop logic.
- [x] 1.2 Confirm that `@epam/ai-dial-typescript-sdk` does not expose the Applications API (check `node_modules/@epam/ai-dial-typescript-sdk` exports). If it does, use it in step 2; otherwise proceed with raw fetch.
- [x] 1.3 Read `apps/chat-api/AGENTS.md` in full to confirm NestJS conventions before implementing any backend files.

## 2. Backend — Applications Domain

- [x] 2.1 Create `apps/chat-api/src/applications/dto/application.dto.ts` — define `ApplicationDto` (`id`, `displayName`, `description?`, `iconUrl?`, `maxInputAttachments?`, `inputAttachmentTypes?`) and `ApplicationsResponseDto` (`data: ApplicationDto[]`) with `@ApiProperty` decorators; no `any` types.
- [x] 2.2 Create `apps/chat-api/src/applications/applications.service.ts` — `ApplicationsService extends AppService`; raw `fetch` + `AbortController` (timeout from `EnvironmentVariables.DIAL_APPLICATIONS_TIMEOUT_MS` defaulting to 5000); pagination loop with `seenCursors` set and 10 000-item hard cap; cache key `applications:list:<userSub>` at 30 000 ms; reuse `mapDialHttpStatus` / `handleDialFetchError`; no token logging.
- [x] 2.3 Create `apps/chat-api/src/applications/applications.controller.ts` — `@Get() listApplications(@Req() req)` with `@Controller({ path: 'applications', version: '1' })`, `@Throttle({ default: { limit: 60, ttl: 60000 } })`, `@Header('Cache-Control', 'private, max-age=30')`, full Swagger annotations (`operationId: 'listApplications'`, 200/401/403/429/502/503 responses).
- [x] 2.4 Create `apps/chat-api/src/applications/applications.module.ts` — `ApplicationsModule` importing `CacheModule`; registers controller and service; export `ApplicationsService`.
- [x] 2.5 Register `ApplicationsModule` in `apps/chat-api/src/app/app.module.ts` imports array.
- [x] 2.6 Add `DIAL_APPLICATIONS_TIMEOUT_MS` to `apps/chat-api/src/config/environment.config.ts` with `@IsOptional()` and `@IsNumber()` validator, defaulting to `5000`.
- [x] 2.7 Verify: `npm exec nx build chat-api -- --skip-nx-cache` passes.
- [x] 2.8 Verify: `npm exec nx lint chat-api -- --skip-nx-cache` passes.

## 3. Backend — Applications Service Tests

- [x] 3.1 Create `apps/chat-api/src/applications/tests/applications.service.spec.ts` — mock all DIAL Core fetch calls; cover: single-page response, multi-page merge (≥ 3 pages), empty list, last page without next token, upstream error on intermediate page (throws 502), repeated cursor (throws BadGatewayException `'Pagination loop detected'`), cache hit (no fetch).
- [x] 3.2 Create `apps/chat-api/src/applications/tests/applications.controller.spec.ts` — mock `ApplicationsService`; cover: 200 on success, 401 when no session (via guard), 403/502/503 propagated from service.
- [x] 3.3 Verify: `npm exec nx test chat-api -- --skip-nx-cache` passes with new tests.

## 4. Backend — Catalog Domain

- [x] 4.1 Create `apps/chat-api/src/catalog/dto/catalog-item.dto.ts` — define `CatalogItemDto` (`id`, `displayName`, `type: 'model' | 'application'`, `description?`, `iconUrl?`, `maxInputAttachments?`, `inputAttachmentTypes?`) and `CatalogResponseDto` (`data: CatalogItemDto[]`) with `@ApiProperty` decorators; no `any` types.
- [x] 4.2 Create `apps/chat-api/src/catalog/catalog.service.ts` — `CatalogService`; injects `ModelsService` and `ApplicationsService`; runs both in `Promise.all`; maps to `CatalogItemDto[]`; sorts case-insensitively by `displayName` with `id` tiebreaker; caches result under `catalog:list:<userSub>` at 30 000 ms; rethrows any upstream exception without partial data.
- [x] 4.3 Create `apps/chat-api/src/catalog/catalog.controller.ts` — `@Get() listCatalogItems(@Req() req)` with `@Controller({ path: 'catalog', version: '1' })`, throttle, cache-control header, and full Swagger annotations (`operationId: 'listCatalogItems'`, 200/401/403/429/502/503 responses).
- [x] 4.4 Create `apps/chat-api/src/catalog/catalog.module.ts` — imports `ModelsModule`, `ApplicationsModule`, `CacheModule`; registers controller and service.
- [x] 4.5 Register `CatalogModule` in `apps/chat-api/src/app/app.module.ts` imports array.
- [x] 4.6 Add `@ApiOperation({ deprecated: true })` and `@Header('Deprecation', 'true')` to the existing `GET /api/deployments` handler in `apps/chat-api/src/deployments/deployments.controller.ts`.
- [x] 4.7 Verify: `npm exec nx build chat-api -- --skip-nx-cache` passes.
- [x] 4.8 Verify: `npm exec nx lint chat-api -- --skip-nx-cache` passes.

## 5. Backend — Catalog Service Tests

- [x] 5.1 Create `apps/chat-api/src/catalog/tests/catalog.service.spec.ts` — mock `ModelsService` and `ApplicationsService`; cover: successful merge and sort, sort correctness (case-insensitive, id tiebreaker), models fetch fails → rethrows, applications fetch fails → rethrows, empty applications list → returns models only, cache hit.
- [x] 5.2 Create `apps/chat-api/src/catalog/tests/catalog.controller.spec.ts` — mock `CatalogService`; cover: 200 on success, 401 without session, 502/503 propagated from service.
- [x] 5.3 Verify: `npm exec nx test chat-api -- --skip-nx-cache` passes with all new tests.

## 6. OpenAPI and Generated Client

- [x] 6.1 Run `npm run openapi` to regenerate `@epam/chat-api-client` from the updated spec.
- [x] 6.2 Run `npm run openapi:check` and confirm no diff (spec and client are in sync).
- [x] 6.3 Verify generated client exports `ApplicationsApi` with `listApplications()` returning `Promise<ApplicationsResponseDto>`.
- [x] 6.4 Verify generated client exports `CatalogApi` with `listCatalogItems()` returning `Promise<CatalogResponseDto>`.
- [x] 6.5 Run `npm exec nx build chat-api-client -- --skip-nx-cache` — must pass.
- [x] 6.6 Run `npm exec nx lint chat-api-client -- --skip-nx-cache` — must pass.

## 7. Frontend — Server-API Wrappers

- [x] 7.1 Add `applicationsApi = new ApplicationsApi(config)` and `catalogApi = new CatalogApi(config)` to `apps/chat/src/server-api/api-client.ts` alongside the existing `modelsApi`.
- [x] 7.2 Create `apps/chat/src/server-api/applications.ts` — export `getApplications(): Promise<ApplicationsResponseDto>` delegating to `applicationsApi.listApplications()`.
- [x] 7.3 Create `apps/chat/src/server-api/catalog.ts` — export `getCatalogItems(): Promise<CatalogResponseDto>` delegating to `catalogApi.listCatalogItems()`.
- [x] 7.4 Verify: `npm exec nx build chat -- --skip-nx-cache` passes.
- [x] 7.5 Verify: `npm exec nx lint chat -- --skip-nx-cache` passes.

## 8. Frontend — CatalogContext

- [x] 8.1 Add i18n keys to `apps/chat/src/i18n/locales/en.json`: `catalog.loading`, `catalog.error`, `catalog.empty`, `catalog.type.model`, `catalog.type.application`.
- [x] 8.2 Create `apps/chat/src/context/CatalogContext.tsx` — `CatalogContextType` interface (`items`, `selectedItemId`, `setSelectedItemId`, `isLoading`, `error`); `CatalogProvider` using `useEffect` with `cancelled` flag, `useMemo` context value, `getCatalogItems()` from server-api; `useCatalog()` hook that throws when used outside provider. Follow `ModelsContext.tsx` as the reference pattern.
- [x] 8.3 Register `CatalogProvider` in `apps/chat/src/app/app.tsx` (or in the root provider tree alongside `ModelsProvider`).
- [x] 8.4 Update the conversation-flow model/application selection component to consume `useCatalog()` instead of `useModels()`; leave `ModelsContext` / `ModelsProvider` in place and unchanged.
- [x] 8.5 Verify: `npm exec nx build chat -- --skip-nx-cache` passes.
- [x] 8.6 Verify: `npm exec nx lint chat -- --skip-nx-cache` passes.

## 9. Frontend — Tests

- [x] 9.1 Create `apps/chat/src/context/tests/CatalogContext.spec.tsx` — cover: items loaded on mount, selectedItemId defaults to first item, error state set on fetch failure, cancelled flag prevents setState after unmount, useCatalog throws outside provider.
- [x] 9.2 Create `apps/chat/src/server-api/tests/applications.api.spec.ts` — mock `applicationsApi`; confirm `getApplications` delegates correctly.
- [x] 9.3 Create `apps/chat/src/server-api/tests/catalog.api.spec.ts` — mock `catalogApi`; confirm `getCatalogItems` delegates correctly.
- [x] 9.4 Verify: `npm exec nx test chat -- --skip-nx-cache` passes with all new frontend tests.

## 10. Final Verification

- [x] 10.1 Run `npm exec nx affected --target=lint --base=origin/development` — no new lint errors.
- [x] 10.2 Run `npm exec nx affected --target=test --base=origin/development` — all tests pass.
- [x] 10.3 Run `npm exec nx affected --target=build --base=origin/development` — all builds pass.
- [ ] 10.4 Manually verify `GET /api/v1/applications` and `GET /api/v1/catalog` are visible in Swagger UI at `/api/docs`.
- [ ] 10.5 Confirm `GET /api/deployments` appears as `deprecated: true` in Swagger UI.
- [x] 10.6 Confirm `GET /api/v1/models` is unchanged and its tests still pass.
