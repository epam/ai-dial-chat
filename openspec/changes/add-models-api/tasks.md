## 1. Shared Types

- [x] 1.1 Create `libs/chat-shared/src/models.ts` — define and export `DialModel` (with `[key: string]: unknown` index signature) and `DialModelListResponse`
- [x] 1.2 Re-export `DialModel` and `DialModelListResponse` from `libs/chat-shared/src/index.ts`

## 2. Backend — Config

- [x] 2.1 Add `DIAL_CORE_TIMEOUT_MS` optional field (`@IsOptional`, `@Transform parseInt`, `@IsNumber`, default `10000`) to `apps/chat-api/src/config/environment.config.ts`

## 3. Backend — DTOs

- [x] 3.1 Create `apps/chat-api/src/models/dto/get-model.dto.ts` — `GetModelDto` with `modelName: string` validated by `@IsString`, `@Matches(/^[a-zA-Z0-9_\-.:@/]+$/, { message: '...' })`, and `@ApiProperty`

## 4. Backend — Service

- [x] 4.1 Create `apps/chat-api/src/models/models.service.ts` — `ModelsService` with `private readonly logger = new Logger(ModelsService.name)`, injecting `ConfigService<EnvironmentVariables>` and `CACHE_MANAGER`
- [x] 4.2 Implement `listModels(userSub: string, accessToken: string): Promise<DialModelListResponse>` — cache key `models:list:<userSub>`, TTL 30 s, proxies `GET <DIAL_CORE_URL>/openai/models` with `Authorization: Bearer <accessToken>`, AbortController + `DIAL_CORE_TIMEOUT_MS` timeout
- [x] 4.3 Implement `getModel(userSub: string, accessToken: string, modelName: string): Promise<DialModel>` — cache key `models:single:<userSub>:<modelName>`, TTL 60 s, proxies `GET <DIAL_CORE_URL>/openai/models/<modelName>`
- [x] 4.4 Map upstream HTTP errors to Nest exceptions in both methods: `401` → `UnauthorizedException`, `403` → `ForbiddenException`, `404` → `NotFoundException`, `429` → `HttpException(429)`, `5xx` → `BadGatewayException`, timeout/unreachable → `ServiceUnavailableException`; rethrow Nest exceptions untouched

## 5. Backend — Controller

- [x] 5.1 Create `apps/chat-api/src/models/models.controller.ts` — `ModelsController` with `@ApiTags('models')`, `@Controller({ path: 'models', version: '1' })`; inject `ModelsService`
- [x] 5.2 Implement `GET /` handler — `@Get()`, `@Throttle({ default: { limit: 60, ttl: 60000 } })`, `@Header('Cache-Control', 'private, max-age=30')`, full `@ApiOperation` and `@ApiResponse` for 200/401/403/429/500/502/503; reads `req.user.sub` and `req.user.at`, delegates to `modelsService.listModels`
- [x] 5.3 Implement `GET /:modelName` handler — `@Get(':modelName')`, `@Throttle({ default: { limit: 60, ttl: 60000 } })`, `@Header('Cache-Control', 'private, max-age=60')`, `@Param() dto: GetModelDto`, full `@ApiOperation` and `@ApiResponse` for 200/400/401/403/404/429/500/502/503; delegates to `modelsService.getModel`
- [x] 5.4 Annotate both handlers with `@ApiResponse` entries for all error codes listed in the specs (400, 401, 403, 404, 429, 502, 503, 500)

## 6. Backend — Module & Registration

- [x] 6.1 Create `apps/chat-api/src/models/models.module.ts` — `ModelsModule` declaring `ModelsController` and `ModelsService`
- [x] 6.2 Import `ModelsModule` in `apps/chat-api/src/app/app.module.ts`

## 7. Backend — Tests

- [x] 7.1 Create `apps/chat-api/src/models/tests/models.service.spec.ts` — unit tests for `ModelsService`: happy path list (cache miss and hit), happy path single (cache miss and hit), each error mapping (401, 403, 404, 429, 5xx, timeout), cache key isolation between users
- [x] 7.2 Create `apps/chat-api/src/models/tests/models.controller.spec.ts` — supertest integration tests against the bootstrapped app: `GET /api/v1/models` returns 200 with `{ data: [...] }` for authenticated user; `GET /api/v1/models/gpt-4o` returns 200 with a `DialModel`; unauthenticated requests return 401; invalid `:modelName` returns 400; missing session returns 401; upstream 404 returns 404; rate limit returns 429 after limit exceeded

## 8. Frontend — Server-API Helper

- [x] 8.1 Create `apps/chat/src/server-api/models.ts` — export `getModels(): Promise<DialModelListResponse>` and `getModel(modelName: string): Promise<DialModel>` using the `get` typed helper from `server-api/base.ts`; import types from `@epam/chat-shared`

## 9. Verification

- [x] 9.1 Run `pnpm nx test chat-api` — all models tests pass (1 pre-existing failure in conversation.controller.integration.spec.ts unrelated to this change)
- [x] 9.2 Run `pnpm nx lint chat-api` — no lint errors (11 pre-existing warnings only)
- [x] 9.3 Run `pnpm nx build chat-api` — build succeeds
- [x] 9.4 Run `pnpm nx affected --target=typecheck --base=origin/development` — pre-existing failures in chat-shared and chat.service only; no new type errors introduced
