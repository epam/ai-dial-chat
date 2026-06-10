# Tasks: application-schemas-api

Reference design: `design.md` | Specs: `specs/application-schemas-list/spec.md`, `specs/application-schemas-get/spec.md`

---

## Slice 1 — Backend DTOs

- [x] **1.1** Create `apps/chat-api/src/applications/dto/application-schema.dto.ts` with `ApplicationSchemaSummaryDto` (5 optional string fields: `id`, `displayName`, `viewerUrl`, `editorUrl`, `schemaEndpoint`), `ApplicationSchemasResponseDto` (`schemas: ApplicationSchemaSummaryDto[]`), and `GetApplicationSchemaDto` (path param `id: string` with `@IsString()`, `@IsNotEmpty()`, `@Matches(/^\S+$/)`)

---

## Slice 2 — ApplicationSchemasService

- [x] **2.1** Create `apps/chat-api/src/applications/application-schemas.service.ts` — `ApplicationSchemasService extends AppService`, inject `CACHE_MANAGER`, implement `listApplicationSchemas(userSub, accessToken)` calling `this.client.listCustomApplicationSchemas`, normalize fields, cache 60 s at key `application-schemas:list:<userSub>`
- [x] **2.2** Implement `getApplicationSchema(userSub, accessToken, schemaId)` on `ApplicationSchemasService` calling `this.client.getCustomApplicationSchema({ params: { query: { id: schemaId } }, headers })`, pass through payload as `Record<string, unknown>`, cache 60 s at key `application-schemas:item:<userSub>:<schemaId>`

---

## Slice 3 — ApplicationSchemasController

- [x] **3.1** Create `apps/chat-api/src/applications/application-schemas.controller.ts` — thin controller `@Controller({ path: 'application-schemas', version: '1' })` with `listApplicationSchemas` (GET /) and `getApplicationSchema` (GET /:id), each with full Swagger annotations and `@Throttle({ default: { limit: 60, ttl: 60000 } })`
- [x] **3.2** Register `ApplicationSchemasController` and `ApplicationSchemasService` in `apps/chat-api/src/applications/applications.module.ts`

---

## Slice 4 — Service Unit Tests

- [x] **4.1** Create `apps/chat-api/src/applications/tests/application-schemas.service.spec.ts` covering: list and get on cache miss/hit, field normalization, per-user cache keys, Authorization header forwarded, upstream 401/403/404/429/5xx/network error mapped correctly

---

## Slice 5 — Controller Integration Tests

- [x] **5.1** Create `apps/chat-api/src/applications/tests/application-schemas.controller.spec.ts` using supertest: 200 happy path for list and get, service called with correct args, 401/403/502/503/404 error propagation

---

## Slice 6 — OpenAPI Generation and Client Verification

- [x] **6.1** Run `npm run openapi && npm run openapi:check && npm exec nx build chat-api-client -- --skip-nx-cache && npm exec nx lint chat-api-client`; verify `listApplicationSchemas` and `getApplicationSchema` methods appear in generated `ApplicationsApi` with correct return types

---

## Slice 7 — Frontend Server-API Wrapper

- [x] **7.1** Update `apps/chat/src/server-api/api-client.ts` if OpenAPI generation produced a new API class (e.g. `ApplicationSchemasApi`) — add singleton export; skip if methods landed in existing `ApplicationsApi`
- [x] **7.2** Create `apps/chat/src/server-api/application-schemas.ts` — thin wrappers `getApplicationSchemas()` and `getApplicationSchema(id)` delegating to the generated client

---

## Slice 8 — Frontend Server-API Tests

- [x] **8.1** Create `apps/chat/src/server-api/tests/application-schemas.api.spec.ts` — verify `getApplicationSchemas` delegates to `listApplicationSchemas()` and `getApplicationSchema(id)` delegates to `getApplicationSchema({ id })`

---

## Slice 9 — Final Verification

- [x] **9.1** Run `npm exec nx test chat-api && npm exec nx lint chat-api && npm exec nx build chat-api && npm exec nx test chat && npm exec nx lint chat` — all pass
