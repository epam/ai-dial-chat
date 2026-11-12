# Tasks: add-model-catalog-endpoint

**Slicing strategy:** vertical. Slice 1 makes the list route work end to end, from env to Core and back with cache and error policy. Slices 2 and 3 widen it with the detail route and the client-config flag. Slice 4 regenerates the contract. Slice 5 updates the docs. Each slice is verified before the next one starts. Backend conventions: `apps/chat-api/AGENTS.md`.

## 1. Slice 1 — env key and list route

Depends on: nothing.

- [x] 1.1 Add `MODEL_CATALOG_API_KEY?: string` (`@IsOptional() @IsString()`, with JSDoc saying it is a server-only secret and is separate from `DIAL_API_KEY`) to `DialEnv` in `apps/chat-api/src/config/env/dial.env.ts`, directly after `DIAL_API_KEY`. Add `'MODEL_CATALOG_API_KEY'` to the snapshot list in `apps/chat-api/src/config/tests/environment-composition.spec.ts`.
  - Verification: `npm run test:file -- apps/chat-api/src/config/tests/environment-composition.spec.ts`
- [x] 1.2 Create `apps/chat-api/src/models/catalog/model-catalog-key.ts` exporting the arrow-function `resolveModelCatalogApiKey(configService: ConfigService<EnvironmentVariables>): string | undefined`. It returns the trimmed key, or `undefined` when the key is unset, empty or whitespace-only. Add `apps/chat-api/src/models/tests/catalog/model-catalog-key.spec.ts` covering unset, empty, whitespace-only and padded values.
  - Verification: `npm run test:file -- apps/chat-api/src/models/tests/catalog/model-catalog-key.spec.ts`
- [x] 1.3 Create `apps/chat-api/src/models/catalog/model-catalog.service.ts` (`ModelCatalogService`, with `Logger` and injected `DialClientService`, `CACHE_MANAGER` and `ConfigService`) per design D4/D5:
  - `listCatalog()` throws `NotFoundException` when the key is not configured.
  - It uses a private `inFlight: Promise<DialModelListResponseDto> | null` around `withCachedDialRequest({ cacheKey: 'models:catalog', ttlMs: 300_000, context: 'list model catalog', … })`, and clears the handle in `finally`.
  - `fetch` calls `dialClient.client.getModels({ headers: getApiKeyAuthHeaders(key) })`. A Core `401`/`403` logs `error` without the key and throws `ServiceUnavailableException('Model catalog is unavailable')`. Every other non-ok status goes to `mapDialHttpStatus` with no error body. Success returns `{ data }`.
- [x] 1.4 Unit-test the service in `apps/chat-api/src/models/tests/catalog/model-catalog.service.spec.ts`, mocking `DialClientService` and using a real in-memory cache. Cover:
  - an unset key returns 404 with no Core call;
  - `Api-Key` is sent trimmed, with no `Authorization` header;
  - a cache hit shares one entry across calls;
  - concurrent cold calls make exactly one Core call;
  - concurrent failures share one call and nothing is cached;
  - the handle is cleared, so a call after a failure retries;
  - the TTL passed is `300000`;
  - Core `401` and `403` become 503;
  - 404, 429 and 400 map as before, `500` becomes 502, and a network error becomes 503;
  - no logger call receives the key value (spy on `Logger` methods and assert that no argument contains the key).
  - Verification: `npm run test:file -- apps/chat-api/src/models/tests/catalog/model-catalog.service.spec.ts`
- [x] 1.5 Create `apps/chat-api/src/models/catalog/model-catalog.controller.ts`: `@ApiTags('models')`, `@Controller({ path: 'model-catalog', version: '1' })`, handler `listModelCatalog()` with `@Get()` and `@Header('Cache-Control', 'private, max-age=300')`. Add `@ApiOperation`, then `@ApiDialCoreErrors({ exclude: [HttpStatus.FORBIDDEN] })` above explicit `@ApiResponse` entries for 200 (`DialModelListResponseDto`), 401 (session only), 404 (key not configured) and 503 (key rejected or Core unreachable). Register the controller and service in `apps/chat-api/src/models/models.module.ts`.
- [x] 1.6 Add a supertest integration spec `apps/chat-api/src/models/tests/catalog/model-catalog.controller.spec.ts` (pattern: `apps/chat-api/src/rate/tests/rate.controller.spec.ts`) with a mocked `ModelCatalogService`. Cover:
  - 200 with the body passed through and `Cache-Control: private, max-age=300`;
  - 404 when the service throws `NotFoundException`, with no `Cache-Control` on the error;
  - 503 propagates, and no 401/403 ever comes from an upstream rejection.
  - Verification: `npm run test:file -- apps/chat-api/src/models/tests/catalog/model-catalog.controller.spec.ts`
- [x] 1.7 Confirm that `GET /api/v1/models` is untouched: the existing specs must still pass unchanged.
  - Verification: `npm run test:file -- apps/chat-api/src/models/tests/models.service.spec.ts` and `npm run test:file -- apps/chat-api/src/models/tests/models.controller.spec.ts`. After the slice: `npm run verify:changed`

## 2. Slice 2 — detail route

Depends on: slice 1.

- [x] 2.1 Add `getCatalogEntry(modelName: string): Promise<DialModelDto>` to `ModelCatalogService`. It awaits `listCatalog()`, returns the entry with `id === modelName`, and otherwise throws `NotFoundException('Model not found')`. It never calls `client.getModel`. Extend `model-catalog.service.spec.ts` to cover: found, not found, a cold cache that fetches the list once and caches it, the unset key, and that `client.getModel` is never called.
  - Verification: `npm run test:file -- apps/chat-api/src/models/tests/catalog/model-catalog.service.spec.ts`
- [x] 2.2 Add the handler `getModelCatalogEntry(@Param() dto: GetModelDto)` with `@Get(':modelName')` to `ModelCatalogController`, using the same `Cache-Control` and Swagger entries as the list route plus 400 (invalid name). The 404 description covers "key not configured or model not in catalog". Extend the controller spec to cover: 200; 400 for an invalid name (for example `bad%2Fname` and `a b`) with the service not called; 404; 503.
  - Verification: `npm run test:file -- apps/chat-api/src/models/tests/catalog/model-catalog.controller.spec.ts`. After the slice: `npm run verify:changed`

## 3. Slice 3 — `config.modelCatalogAvailable`

Depends on: task 1.2.

- [x] 3.1 Add `modelCatalogAvailable?: boolean` to `ClientConfigDto` in `apps/chat-api/src/app-config/dto/client-config-response.dto.ts`. Use `@ApiPropertyOptional({ type: Boolean, description: 'Whether GET /api/v1/model-catalog is configured. Missing means unavailable.', example: false })` and place it as the last property.
- [x] 3.2 Add `'modelCatalogAvailable'` to the `Omit` in `MappedClientConfig` (`apps/chat-api/src/app-config/client-config.mapper.ts`) and update its JSDoc list of service-assembled fields. In `AppConfigService.getClientConfig` (`apps/chat-api/src/app-config/app-config.service.ts`), append `modelCatalogAvailable: resolveModelCatalogApiKey(this.configService) != null` after `catalogCreationPermissions`.
- [x] 3.3 Update the tests. Add `'modelCatalogAvailable'` to `SERVICE_ASSEMBLED_FIELDS` in `apps/chat-api/src/app-config/tests/client-config.mapper.spec.ts`. Append it to the expected `config` key order in `apps/chat-api/src/app-config/tests/app-config.service.spec.ts`. Add a `describe('modelCatalogAvailable')` covering: true when set; false when unset or blank; false when only `DIAL_API_KEY` is set; the response never contains the key value.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/app-config.service.spec.ts` and `npm run test:file -- apps/chat-api/src/app-config/tests/client-config.mapper.spec.ts`. After the slice: `npm run verify:changed`

## 4. Slice 4 — OpenAPI contract and generated client

Depends on: slices 1–3.

- [x] 4.1 Run `npm run openapi` and commit the regenerated `libs/chat-api-client/openapi.json` and generated sources. Do not hand-edit generated files.
- [x] 4.2 Inspect `libs/chat-api-client/src/generated/src/apis/ModelsApi.ts`. It must contain `listModelCatalog` / `listModelCatalogRaw` returning `DialModelListResponseDto`, and `getModelCatalogEntry({ modelName })` returning `DialModelDto`, with no endpoint-level `any`. The generated `ClientConfigDto` must have `modelCatalogAvailable?: boolean`.
- [x] 4.3 Run `npm run openapi:check`, `npm exec nx build chat-api-client -- --skip-nx-cache` and `npm exec nx lint chat-api-client`.
  - Verification: all three commands exit 0. Then `npm exec nx build chat-api`. No `apps/chat/src/server-api/` wrapper is added (design, "Frontend / generated client").

## 5. Slice 5 — documentation

Depends on: slices 1–4.

- [x] 5.1 `apps/chat-api/README.md`:
  - add a `MODEL_CATALOG_API_KEY` row after `DIAL_API_KEY` in the env table: server-only `Api-Key` for `GET /api/v1/model-catalog`, separate from `DIAL_API_KEY`, needs a dedicated Core role added to every restricted model's `userRoles`, minimal limits, stored as a deployment secret, unset means the routes answer `404`;
  - add a `model-catalog` → `models/` row to "Versioned domains";
  - add a short "Model catalog" subsection describing both routes, the shared 5-minute cache and the `401`/`403` → `503` rule.

  The README body (from the first "Scheduled task manual-run contract" on) is repeated four times. Every copy got the same three additions so none goes stale. The duplication itself is recorded as a follow-up (task 6.2), not fixed here.
- [x] 5.2 `apps/chat-api/.env.template`: add a commented `# MODEL_CATALOG_API_KEY=your-model-catalog-api-key` with a two-line explanation under the DIAL Configuration block.
- [x] 5.3 `docs/architecture.md`: add the `/api/v1/model-catalog` row to the "API surface" table, and add both routes to the "Models & Deployments" endpoint table.
- [x] 5.4 Run `npm run validate:docs` and `npm run validate:specs`, and fix any failure introduced by this change.
  - Verification: `validate:specs` exits 0. `validate:docs` reports only one failure, which this change did not introduce: a broken link `./managed-config-schema.md` in `docs/centralized-app-config-design.md`. Clean `development` fails the same way, and the target file has never been committed. Accepted as out of scope.

## 6. Close-out

- [x] 6.1 Run `npm run verify:full` once and confirm it passes for this change.
  - Result: typecheck, lint, format and the chat-api tests pass. Two failures this change did not introduce remain, and are accepted as out of scope:
    - the `AddAttachmentButton` prompts/tools specs in `libs/conversation-input`, which fail the same way on clean `development`;
    - `attachment-canvas-consumer-fixture:pack-lib`, where `npm install` cannot resolve `@epam/pdf-highlighter-kit@^0.0.22` (ETARGET).
- [x] 6.2 Follow-up notes (out of scope, not fixed here, no issues filed):
  - the `apps/chat-api/README.md` body was repeated four times (fixed on `development` by #9837, which this change is rebased onto);
  - the field-order scenario in `openspec/specs/client-config-endpoint/spec.md` still says the order ends with `publicationFilterSources`, `maxAttachmentFileSizeBytes`, which is stale;
  - the broken `managed-config-schema.md` link and the failures listed in 6.1.

## 7. Review fixes

- [x] 7.1 Hold the catalog cache entry in `ModelCatalogService` instead of `CACHE_MANAGER`, so the shared 100-entry LRU cannot evict it before its TTL.
- [x] 7.2 Reject a Core `200` without a `data` array with `502` before caching it, and drop entries without a string `id`.
- [x] 7.3 Reduce each entry to `MODEL_CATALOG_ENTRY_FIELDS` and declare `ModelCatalogEntryDto` / `ModelCatalogListResponseDto`, then regenerate the OpenAPI spec and client.
- [x] 7.4 Update the `model-catalog` spec, the README section and the Swagger description.
