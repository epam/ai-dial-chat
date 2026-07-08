## 1. Foundation — DialCoreModule + DialClientService

- [x] 1.1 Create `apps/chat-api/src/dial/dial-client.service.ts`: `@Injectable()` class injecting `ConfigService<EnvironmentVariables>`, reading `DIAL_CORE_URL`/`DIAL_API_VERSION` via `{ infer: true }`, creating one `createSDK({ baseUrl })` instance in the constructor, exposing readonly `client`, `baseUrl`, `dialApiVersion`, and its own `Logger(DialClientService.name)`
- [x] 1.2 Create `apps/chat-api/src/dial/dial-core.module.ts`: `@Global()` module with `providers: [DialClientService]` and `exports: [DialClientService]`
- [x] 1.3 Write `apps/chat-api/src/dial/dial-client.service.spec.ts`: mock `ConfigService`, assert a single `createSDK` call, assert `client`/`baseUrl`/`dialApiVersion` are exposed correctly
- [x] 1.4 Import `DialCoreModule` in `AppModule`, before domain modules
- [x] 1.5 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` — must pass with `AppService` still present and unused by the new module

## 2. PoC migration — simple + complex cache cases

- [x] 2.1 Migrate `ModelsService` (`models/models.service.ts`): remove `extends AppService`/`super(configService)`, inject `DialClientService`, replace `this.client`/`this.baseUrl`/`this.dialApiVersion` with `this.dialClient.*`, add own `Logger`
- [x] 2.2 Update `models/models.service.spec.ts` to mock `DialClientService` instead of `AppService`/`createSDK`
- [x] 2.3 Migrate `DeploymentsService` (`deployments/deployments.service.ts`) the same way, preserving its interface-filter cache key + fallback-key read exactly as-is
- [x] 2.4 Update `deployments/deployments.service.spec.ts` to mock `DialClientService`
- [x] 2.5 Update `ModelsModule`/`DeploymentsModule` registrations if they referenced `AppService` directly (neither did; `DialCoreModule` is global so no import needed)
- [x] 2.6 Run `npm exec nx test chat-api` — must pass

## 3. Cached-list helper

- [x] 3.1 Create `apps/chat-api/src/dial/cached-dial-request.helper.ts` exporting `withCachedDialRequest<T>({ cacheManager, cacheKey, ttlMs = 30_000, context, logger, fetch, transform? })`, delegating errors to `mapDialHttpStatus`/`handleDialFetchError` from `common/dial/dial-error.mapper.ts`
- [x] 3.2 Write `apps/chat-api/src/dial/cached-dial-request.helper.spec.ts` covering: cache hit (no fetch call), cache miss (fetch + cache set with correct TTL), error propagation via the existing mapper, default TTL fallback
- [x] 3.3 Refactor `ModelsService.listModels` and `ModelsService.getModel` to use `withCachedDialRequest`, preserving existing cache key formats (`models:list:${userSub}`, `models:single:${userSub}:${name}`) and TTL
- [x] 3.4 Run `npm exec nx test chat-api` — `models.service.spec.ts` behavior must be unchanged

## 4. Remaining cached services

- [x] 4.1 Migrate `ApplicationsService` (`applications/applications.service.ts`) off `AppService` to `DialClientService`, keeping its raw-`fetch`-via-`baseUrl` escape hatch intact, and refactor `listApplications` to use `withCachedDialRequest`
- [x] 4.2 Migrate `ApplicationSchemasService` (`application-schemas/application-schemas.service.ts`) off `AppService` and refactor `listApplicationSchemas` to use `withCachedDialRequest`
- [x] 4.3 Migrate `ToolsetsService` (`toolsets/toolsets.service.ts`) off `AppService` to `DialClientService`; `listToolsets`/`getToolset` keep their hand-written caching because ownership enrichment must run identically on both the cache-hit and cache-miss paths, which the helper's single-fetch shape cannot express without changing behavior
- [x] 4.4 Update `applications.service.spec.ts`, `application-schemas.service.spec.ts`, `toolsets.service.spec.ts` to mock `DialClientService`
- [x] 4.5 Run `npm exec nx test chat-api` — must pass

## 5. Remaining SDK-only services (injection only, no helper)

- [x] 5.1 Migrate `ConversationService` (`conversations/conversation.service.ts`) off `AppService` to `DialClientService`
- [x] 5.2 Migrate `ConversationNamingService` (`conversations/conversation-naming.service.ts`) off `AppService` to `DialClientService`, preserving its use of `dialApiVersion`
- [x] 5.3 Migrate `FilesService` (`files/files.service.ts`) off `AppService` to `DialClientService`
- [x] 5.4 Migrate `ChatService` (`chat/chat.service.ts`) off `AppService` to `DialClientService`, preserving its use of `dialApiVersion`
- [x] 5.5 Migrate `RateService` (`rate/rate.service.ts`) off `AppService` to `DialClientService`
- [x] 5.6 Migrate `TranscriptionService` (`transcription/transcription.service.ts`) off `AppService` to `DialClientService`, preserving its use of `dialApiVersion`
- [x] 5.7 Migrate `UserConfigService` (`user-config/user-config.service.ts`) off `AppService` to `DialClientService`
- [x] 5.8 Migrate `BucketService` (`auth/bucket/bucket.service.ts`) off `AppService` to `DialClientService`
- [x] 5.9 Update all corresponding `*.spec.ts` files to mock `DialClientService` instead of `AppService`/`createSDK`
- [x] 5.10 Run `npm exec nx test chat-api` — must pass

## 6. Cleanup

- [x] 6.1 Run `rg "extends AppService|from '\\.\\./app/app.service'|from '\\.\\./\\.\\./app/app.service'" apps/chat-api/src` and confirm zero matches
- [x] 6.2 Remove `AppService` from `AppModule.providers`
- [x] 6.3 Delete `apps/chat-api/src/app/app.service.ts` (and its spec file if present — none existed)
- [x] 6.4 Update `apps/chat-api/AGENTS.md`: replace "extend AppService" guidance with "inject DialClientService" guidance, referencing `apps/chat-api/src/dial/dial-client.service.ts` as the reference pattern

## 7. Verification

- [x] 7.1 Run `npm exec nx test chat-api`
- [x] 7.2 Run `npm exec nx lint chat-api`
- [x] 7.3 Run `npm exec nx build chat-api`
- [x] 7.4 Confirm no OpenAPI changes: `git diff` shows no changes under generated OpenAPI/client output (no `npm run openapi` run needed since no controller/DTO changed)

## 8. Existing spec accuracy

- [x] 8.1 Add MODIFIED Requirements delta specs for `applications-listing` and `deployments-api` correcting the "extends AppService" implementation-detail bullet to "injects DialClientService" (no scenario/behavior change) so `/opsx:archive` updates the live specs to match the new code
