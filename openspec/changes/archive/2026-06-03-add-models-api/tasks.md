## 1. Shared Types

- [x] 1.1 Create `libs/chat-shared/src/models/dial-model.ts` — define and export `DialModel` (with `[key: string]: unknown` index signature) and `DialModelListResponse`
- [x] 1.2 Re-export `DialModel` and `DialModelListResponse` from `libs/chat-shared/src/index.ts`

## 2. Backend — Config

- [x] 2.1 Remove `DIAL_API_KEY` from `apps/chat-api/src/config/environment.config.ts`; no `DIAL_CORE_TIMEOUT_MS` needed (SDK does not expose per-call timeout)

## 3. Backend — DTOs

- [x] 3.1 Create `apps/chat-api/src/models/dto/get-model.dto.ts` — `GetModelDto` with `modelName: string` validated by `@IsString`, `@Matches(/^[a-zA-Z0-9_\-.:@]+$/, { message: '...' })` (no slash — slashes split Express routing; callers must URL-encode `/` as `%2F`), and `@ApiProperty`

## 4. Backend — Service

- [x] 4.1 Create `apps/chat-api/src/models/models.service.ts` — `ModelsService extends AppService` with `protected logger = new Logger(ModelsService.name)`, injecting `CACHE_MANAGER`; uses `this.client` from `AppService`
- [x] 4.2 Implement `listModels(userSub: string, accessToken: string): Promise<DialModelListResponse>` — cache key `models:list:<userSub>`, TTL 30 s, calls `this.client.getModels({ headers: { Authorization: 'Bearer <accessToken>' } })`, handles `SDKResponse` error via `mapDialHttpStatus`
- [x] 4.3 Implement `getModel(userSub: string, accessToken: string, modelName: string): Promise<DialModel>` — cache key `models:single:<userSub>:<modelName>`, TTL 60 s, calls `this.client.getModel(modelName, { headers: ... })`, handles `SDKResponse` error via `mapDialHttpStatus`
- [x] 4.4 Map upstream HTTP errors via `mapDialHttpStatus` (from `common/utils/dial-fetch-error`): `401` → `UnauthorizedException`, `403` → `ForbiddenException`, `404` → `NotFoundException`, `429` → `HttpException(429)`, `5xx` → `BadGatewayException`; network errors via `handleDialFetchError` → `ServiceUnavailableException`

## 5. Backend — Controller

- [x] 5.1 Create `apps/chat-api/src/models/models.controller.ts` — `ModelsController` with `@ApiTags('models')`, `@Controller({ path: 'models', version: '1' })`; inject `ModelsService`
- [x] 5.2 Implement `GET /` handler — `@Get()`, `@Throttle({ default: { limit: 60, ttl: 60000 } })`, `@Header('Cache-Control', 'private, max-age=30')`, full `@ApiOperation` and `@ApiResponse` for 200/401/403/429/500/502/503; reads `req.user.sub` and `req.user.at`, delegates to `modelsService.listModels`
- [x] 5.3 Implement `GET /:modelName` handler — `@Get(':modelName')`, `@Throttle({ default: { limit: 60, ttl: 60000 } })`, `@Header('Cache-Control', 'private, max-age=60')`, `@Param() dto: GetModelDto`, full `@ApiOperation` and `@ApiResponse` for 200/400/401/403/404/429/500/502/503; delegates to `modelsService.getModel`
- [x] 5.4 Annotate both handlers with `@ApiResponse` entries for all error codes listed in the specs (400, 401, 403, 404, 429, 502, 503, 500)

## 6. Backend — Module & Registration

- [x] 6.1 Create `apps/chat-api/src/models/models.module.ts` — `ModelsModule` declaring `ModelsController` and `ModelsService`
- [x] 6.2 Import `ModelsModule` in `apps/chat-api/src/app/app.module.ts`

## 7. Backend — Tests

- [x] 7.1 Create `apps/chat-api/src/models/tests/models.service.spec.ts` — unit tests for `ModelsService`: happy path list (cache miss and hit), happy path single (cache miss and hit), each error mapping (401, 403, 404, 429, 5xx, network error), cache key isolation between users; mocks via `vi.spyOn(service['client'], 'getModels')`
- [x] 7.2 Create `apps/chat-api/src/models/tests/models.controller.spec.ts` — supertest integration tests against the bootstrapped app with `req.user` middleware: `GET /api/v1/models` returns 200; `GET /api/v1/models/gpt-4o` returns 200; invalid `:modelName` returns 400; error propagation for 401/404/503

## 8. Backend — Deployments refactor

- [x] 8.1 Remove `apiKey` from `AppService.createSDK` call — all services now use per-user session tokens
- [x] 8.2 Rewrite `DeploymentsService.getDeployments` and `getDeployment` to accept `accessToken: string`, pass via `Authorization: Bearer` header, and use `SDKResponse` + `mapDialHttpStatus` pattern
- [x] 8.3 Update `DeploymentsController` to read `req.user.at` via `@Req()` and pass to service methods
- [x] 8.4 Update all three deployments test files to match new signatures and SDKResponse mock pattern

## 9. Frontend — Server-API Helper

- [x] 9.1 Create `apps/chat/src/server-api/models.ts` — export `getModels(): Promise<DialModelListResponse>` and `getModel(modelName: string): Promise<DialModel>` using the `get` typed helper from `server-api/base.ts`; import types from `@epam/ai-dial-chat-shared`

## 10. Verification

- [x] 10.1 Run `npm exec nx test chat-api` — all models and deployments tests pass
- [x] 10.2 Run `npm exec nx lint chat-api` — no lint errors
- [x] 10.3 Run `npm exec nx build chat-api` — build succeeds
- [x] 10.4 Run `npm exec nx affected --target=typecheck --base=origin/development` — no new type errors introduced
