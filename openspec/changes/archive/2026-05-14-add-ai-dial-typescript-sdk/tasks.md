# Tasks: add-ai-dial-typescript-sdk

## Implementation tasks for enabling the @epam/ai-dial-typescript-sdk in chat-api

---

### 1. Activate SDK in AppService

- [x] Remove all TODO comments from `apps/chat-api/src/app/app.service.ts`
- [x] Uncomment `import { createSDK } from '@epam/ai-dial-typescript-sdk'`
- [x] Uncomment `protected client: ReturnType<typeof createSDK>`
- [x] Uncomment the `this.client = createSDK({ ... })` constructor body
- [x] Verify TypeScript compiles with no errors: `npm exec nx build chat-api --skip-nx-cache`

---

### 2. Make DIAL_CORE_URL and DIAL_API_KEY required

- [x] In `apps/chat-api/src/config/environment.config.ts`:
  - Remove `@IsOptional()` from `DIAL_CORE_URL`
  - Change `@IsOptional() @IsUrl({ require_tld: false }) DIAL_CORE_URL?: string` → `@IsNotEmpty() @IsUrl({ require_tld: false }) DIAL_CORE_URL: string`
  - Remove `@IsOptional()` from `DIAL_API_KEY`
  - Change `@IsOptional() @IsString() DIAL_API_KEY?: string` → `@IsNotEmpty() @IsString() DIAL_API_KEY: string`
  - Remove the TODO comment above these fields
- [x] Update any downstream `configService.get(...)` calls that used `as string` casts for these two variables — cast is kept because ConfigService<T>.get() returns `T[key] | undefined` regardless of the required assertion
- [x] Ensure `.env.local` or `.env` in the repo's dev setup documents these two variables — documented in `apps/chat-api/.env.template`
- [x] Run validation test to confirm startup fails without `DIAL_CORE_URL`: `npm exec nx test chat-api`

---

### 3. Add common error helper

- [x] Create `apps/chat-api/src/common/utils/dial-error.ts`
  - Export `handleDialError(error: unknown): never`
  - Map fetch/network errors to `ServiceUnavailableException`
  - Map 404 responses to `NotFoundException`
  - Map 400 responses to `BadRequestException`
  - Map all other unexpected shapes to `BadGatewayException`
- [x] Add unit tests for `dial-error.ts` in `apps/chat-api/src/common/utils/dial-error.spec.ts`

---

### 4. Create DeploymentsModule

- [x] Create `apps/chat-api/src/deployments/deployments.service.ts`
  - Extend `AppService`
  - Implement `getDeployments()` — calls `this.client.getDeployments()`, wraps errors with `handleDialError`
  - Implement `getDeployment(name: string)` — calls `this.client.getDeployment(name)`, maps 404 to `NotFoundException`
- [x] Create `apps/chat-api/src/deployments/deployments.controller.ts`
  - `GET /deployments` → `DeploymentsService.getDeployments()`
  - `GET /deployments/:deployment` → `DeploymentsService.getDeployment(deployment)`
  - Add `@ApiTags('deployments')`, `@ApiOperation`, `@ApiResponse` decorators
- [x] Create `apps/chat-api/src/deployments/deployments.module.ts`
  - Declare `DeploymentsController` and `DeploymentsService`
  - Import nothing extra (inherits `ConfigModule` from global)
- [x] Register `DeploymentsModule` in `AppModule` imports
- [x] Write unit tests in `apps/chat-api/src/deployments/tests/deployments.service.spec.ts`
  - Mock the SDK client on the service instance
  - Test `getDeployments()` success and error paths
- [x] Write unit tests in `apps/chat-api/src/deployments/tests/deployments.controller.spec.ts`

---

### 5. Create ChatModule

- [x] Create `apps/chat-api/src/chat/dto/chat-completion.dto.ts`
  - Export `MessageDto` with `role: 'system' | 'user' | 'assistant'` and `content: string`
  - Export `ChatCompletionDto` with `messages: MessageDto[]`, optional `temperature`, optional `max_tokens`
  - Use `class-validator` + `class-transformer` decorators throughout
- [x] Create `apps/chat-api/src/chat/chat.service.ts`
  - Extend `AppService`
  - Implement `sendCompletion(deployment: string, dto: ChatCompletionDto)`
    - Calls `this.client.sendChatCompletionRequest(deployment, { body: dto })`
    - Wraps errors with `handleDialError`
- [x] Create `apps/chat-api/src/chat/chat.controller.ts`
  - `POST /chat/completions/:deployment` → `ChatService.sendCompletion(deployment, body)`
  - Validate body with `ChatCompletionDto`
  - Add `@ApiTags('chat')`, `@ApiOperation`, `@ApiBody`, `@ApiResponse` decorators
- [x] Create `apps/chat-api/src/chat/chat.module.ts`
  - Declare `ChatController` and `ChatService`
- [x] Register `ChatModule` in `AppModule` imports
- [x] Write unit tests in `apps/chat-api/src/chat/tests/chat.service.spec.ts`
- [x] Write unit tests in `apps/chat-api/src/chat/tests/chat.controller.spec.ts`

---

### 6. Update Swagger in main.ts

- [x] Add `.addTag('deployments', 'List and inspect available AI DIAL deployments')` to `DocumentBuilder`
- [x] Add `.addTag('chat', 'Chat completion proxy to DIAL Core')` to `DocumentBuilder`
- [ ] Verify Swagger UI renders the new tags at `http://localhost:5000/api/docs`

---

### 7. Integration tests

- [x] Add integration test `apps/chat-api/src/deployments/tests/deployments.controller.integration.spec.ts`
  - Boot test app with `AppService` providing a mock SDK client via custom provider
  - Test `GET /api/deployments` returns 200 with deployment array
  - Test `GET /api/deployments/unknown` returns 404
  - Test `GET /api/deployments` returns 503 when SDK throws network error
- [x] Add integration test `apps/chat-api/src/chat/tests/chat.controller.integration.spec.ts`
  - Test `POST /api/chat/completions/:deployment` with valid body returns 201
  - Test invalid body returns 400
  - Test missing deployment returns 404

---

### 8. Build and lint verification

- [x] Run `npm exec nx lint chat-api` — passes with 0 errors (11 pre-existing warnings)
- [x] Run `npm exec nx test chat-api` — 7/9 test files pass (31 tests); 2 pre-existing theme test files fail due to missing `CACHE_MANAGER` mock setup (not caused by this change). Tests run with: `vitest run --config apps/chat-api/vitest.config.ts` from workspace root. `nx test` target exists but has an issue with Nx child-process environment vs direct vitest invocation.
- [ ] Run `npm exec nx build chat-api` — build not yet verified

---

### 9. Infra: Add vitest test runner to chat-api (added during implementation)

- [x] Create `apps/chat-api/vitest.config.ts` with oxc decorator support (`decorator.legacy: true`, `decorator.emitDecoratorMetadata: true`)
- [x] Create `apps/chat-api/src/test-setup.ts` importing `reflect-metadata`
- [x] Add `test` target to `apps/chat-api/package.json`
