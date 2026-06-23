## 1. Config Registry, Types, and Providers

Files: `apps/chat-api/src/app-config/config-registry/`, `apps/chat-api/src/app-config/app-config.types.ts`

- [x] 1.1 Create `apps/chat-api/src/app-config/app-config.types.ts` with `ConfigDefinition`, `ConfigProvider`, and `AppConfigEvalContext` interfaces
- [x] 1.2 Create `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts` with `CONFIG_DEFINITIONS` array containing entries for `asr.modelId`, `asr.transcribeSizeLimitBytes`, and `features.asrEnabled`
- [x] 1.3 Create `apps/chat-api/src/app-config/config-registry/env-config.provider.ts` implementing `ConfigProvider`; reads `EnvironmentVariables` via `ConfigService`, derives `features.asrEnabled` from `ASR_MODEL` presence, returns `undefined` on type mismatch with warning log
- [x] 1.4 Create `apps/chat-api/src/app-config/config-registry/static-defaults.provider.ts` implementing `ConfigProvider`; returns `definition.defaultValue` for known keys, `undefined` for unknown
- [x] 1.5 Create `apps/chat-api/src/app-config/config-registry/composite-config.provider.ts` iterating providers in order, catching errors per-provider (warn/error based on `critical`), debug-logging resolution outcome without values
- [x] 1.6 Write unit tests in `apps/chat-api/src/app-config/tests/config-registry/env-config.provider.spec.ts` covering: env present returns typed value, env absent returns undefined, type mismatch returns undefined + logs warning, `features.asrEnabled` derivation
- [x] 1.7 Write unit tests in `apps/chat-api/src/app-config/tests/config-registry/composite-config.provider.spec.ts` covering: first-provider-wins, fallthrough, provider-error-swallowed, critical key logs at error level
- [x] 1.8 Verify: `npm exec nx test chat-api` and `npm exec nx lint chat-api` pass

## 2. FeatureFlagsService and AppConfigService

Files: `apps/chat-api/src/app-config/feature-flags/`, `apps/chat-api/src/app-config/app-config.service.ts`

- [x] 2.1 Create `apps/chat-api/src/app-config/config-registry/managed-config.provider.ts` — a `ManagedConfigProvider` class that implements `ConfigProvider` but throws `Error('ManagedConfigProvider is not yet configured — provide an implementation before registering it')` from `resolve()`; add a JSDoc comment describing the expected runtime-toggle contract (poll/subscribe to an external config store, return `undefined` to fall through, no boot-time requirement); wire it as a disabled stub in `CompositeConfigProvider`'s provider array comment so the slot position is clear without activating it
- [x] 2.2 Create `apps/chat-api/src/app-config/feature-flags/feature-key.enum.ts` with `FeatureKey` string enum (`AsrEnabled = 'features.asrEnabled'`); values MUST match registry keys exactly
- [x] 2.3 Create `apps/chat-api/src/app-config/app-config.service.ts` as `@Injectable()` with `resolveValue(key, context)` (delegates to `CompositeConfigProvider`), `getClientConfig(context)` (filters by `visibility='client'`, builds response DTO), and `isEnabled(key, context)` (boolean cast, fail closed)
- [x] 2.4 Create `apps/chat-api/src/app-config/feature-flags/feature-flags.service.ts` as `@Injectable()` wrapping `AppConfigService.isEnabled`; throws `BadRequestException` for non-feature keys
- [x] 2.5 Create `apps/chat-api/src/app-config/feature-flags/require-feature.decorator.ts` using `SetMetadata` to attach a `FeatureKey` to route metadata
- [x] 2.6 Create `apps/chat-api/src/app-config/feature-flags/feature.guard.ts` implementing `CanActivate`; reads `FeatureKey` via `Reflector`, calls `featureFlagsService.isEnabled`, throws `ForbiddenException` when disabled, passes when no metadata is set
- [x] 2.7 Write unit tests in `apps/chat-api/src/app-config/tests/app-config.service.spec.ts` covering: `getClientConfig` filters server-only keys, `isEnabled` returns false on provider error, `isEnabled` throws on config-type key, `resolveValue` delegates correctly
- [x] 2.8 Write unit tests in `apps/chat-api/src/app-config/tests/feature-flags/feature-flags.service.spec.ts` covering: returns true/false, rejects non-feature keys, returns false on provider error
- [x] 2.9 Write unit tests in `apps/chat-api/src/app-config/tests/feature-flags/feature.guard.spec.ts` covering: allows when enabled, blocks (403) when disabled, passes when no decorator metadata
- [x] 2.10 Verify: `npm exec nx test chat-api` and `npm exec nx lint chat-api` pass

## 3. Client-Config Endpoint, DTOs, and Integration Tests

Files: `apps/chat-api/src/app-config/app-config.controller.ts`, `apps/chat-api/src/app-config/dto/`, `apps/chat-api/src/app-config/app-config.module.ts`

- [x] 3.1 Create `apps/chat-api/src/app-config/dto/get-client-config.dto.ts` with `appId: string` validated by `@IsString()` and `@IsIn(['chat-ui'])` with `@ApiProperty`
- [x] 3.2 Create `apps/chat-api/src/app-config/dto/client-config-response.dto.ts` with `appId`, `features` (`Record<string, boolean>`), `config` (nested DTO with `asrModelId` and `transcribeSizeLimitBytes`), and `metadata` (`resolvedAt`, `cacheTtlSeconds`); all fields annotated with `@ApiProperty`
- [x] 3.3 Rewrite `apps/chat-api/src/app-config/app-config.controller.ts` with handler `getClientConfig(@Query() query: GetClientConfigDto)`, `@Controller({ path: 'client-config', version: '1' })`, `@ApiTags('app-config')`, `@ApiOperation({ summary: '...' })`, `@ApiResponse` for 200 (`type: ClientConfigResponseDto`), 400, 429; `@Throttle({ default: { limit: 60, ttl: 60_000 } })`; builds `AppConfigEvalContext` from query and optional session context; delegates to `AppConfigService.getClientConfig`, which applies a 60 s identity/role-aware in-memory cache
- [x] 3.4 Delete the old `GET /api/v1/config` handler from `app-config.controller.ts` and delete `apps/chat-api/src/app-config/dto/app-config.dto.ts`
- [x] 3.5 Update `apps/chat-api/src/app-config/app-config.module.ts` to provide `CompositeConfigProvider`, `EnvConfigProvider`, `StaticDefaultsProvider`, `AppConfigService`, `FeatureFlagsService`; import `CacheModule` if not already global
- [x] 3.6 Write integration tests in `apps/chat-api/src/app-config/tests/app-config.controller.spec.ts` covering: 200 with ASR configured, 200 with defaults when ASR absent, 400 on missing appId, 400 on unknown appId, 429 when rate limit exceeded, response does not contain server-only keys
- [x] 3.7 Verify: `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api` all pass

## 4. OpenAPI Regeneration and Generated Client

Files: `libs/chat-api-client/src/generated/`

- [x] 4.1 Run `npm run openapi` to regenerate `@epam/chat-api-client` from the updated Swagger spec
- [x] 4.2 Run `npm run openapi:check` to confirm no unexpected drift
- [x] 4.3 Inspect `libs/chat-api-client/src/generated/src/apis/AppConfigApi.ts` — confirm `getClientConfig` method exists with return type `Promise<ClientConfigResponseDto>` (not `void` or `any`); confirm old `ConfigApi.getConfig` is removed
- [x] 4.4 Verify: `npm exec nx build chat-api-client -- --skip-nx-cache` and `npm exec nx lint chat-api-client` pass

## 5. Frontend Server-API Wrapper and AppConfigContext

Files: `apps/chat/src/server-api/app-config.api.ts`, `apps/chat/src/context/AppConfigContext.tsx`, `apps/chat/src/main.tsx`

- [x] 5.1 Create `apps/chat/src/server-api/app-config.api.ts` — thin wrapper calling `AppConfigApi.getClientConfig({ appId: 'chat-ui' })` from the configured generated-client instance in `api-client.ts`; delete `apps/chat/src/server-api/config.api.ts`
- [x] 5.2 Rewrite `apps/chat/src/context/AppConfigContext.tsx`: `createContext<AppConfigState | undefined>(undefined)`, initial `status='loading'` with safe defaults, `async`/`await` fetch in `useEffect` with `AbortController` and `cancelled` flag, `useMemo` on context value, `useAppConfig()` guard hook throws outside provider, `useFeatureFlag(key)` returns `false` while loading/error
- [x] 5.3 Move `<AppConfigProvider>` in `apps/chat/src/main.tsx` to wrap before `RequireAuth` (after `ThemeProvider`)
- [x] 5.4 Update `ApiEndpoints` in `apps/chat/src/server-api/base.ts` — remove the `CONFIG = '/api/v1/config'` entry (if it still exists after deletion of the old caller)
- [x] 5.5 Write unit tests in `apps/chat/src/context/tests/AppConfigContext.spec.tsx` covering: status transitions (loading → ready, loading → error), `useFeatureFlag` returns false while loading, `useFeatureFlag` returns true/false when ready, `useAppConfig` throws outside provider, AbortController cleans up on unmount
- [x] 5.6 Verify: `npm exec nx test chat`, `npm exec nx lint chat`, `npm exec nx build chat` pass

## 6. Migrate Existing ASR Callers to New Config Shape

Files: any component calling `useAppConfig().asrModelId` or `useAppConfig().transcribeSizeLimitBytes`

- [x] 6.1 Run `grep -r "useAppConfig()" apps/chat/src --include="*.ts" --include="*.tsx" -l` to find all callers
- [x] 6.2 Update each caller: `asrModelId` → `config.asrModelId`; `transcribeSizeLimitBytes` → `config.transcribeSizeLimitBytes`
- [x] 6.3 Verify no remaining references to the old flat shape: `grep -r "useAppConfig()\.asrModelId\|useAppConfig()\.transcribeSizeLimitBytes" apps/chat/src` returns empty
- [x] 6.4 Verify: `npm exec nx test chat`, `npm exec nx lint chat` pass

## 7. Documentation and Diagrams

Files: `openspec/changes/centralize-app-config-and-feature-flags/design.md`, `apps/chat-api/README.md` (if exists), inline code comments

- [x] 7.1 Add code comment in `CompositeConfigProvider` explicitly documenting the provider priority order and the extension points for future managed-config and OpenFeature adapters
- [x] 7.2 Add code comment in `AppConfigController` documenting that the cache key includes app ID, user identity, and sorted roles to isolate role-restricted values
- [x] 7.3 Confirm `design.md` Mermaid diagrams remain accurate against the final implementation (no code changes needed unless implementation deviated from design)

## 8. Final Nx Verification

- [x] 8.1 Run `npm exec nx affected --target=test --base=origin/development-1.0` — all tests pass
- [x] 8.2 Run `npm exec nx affected --target=lint --base=origin/development-1.0` — no lint errors
- [x] 8.3 Run `npm exec nx affected --target=build --base=origin/development-1.0` — all builds succeed
- [x] 8.4 Confirm `GET /api/v1/config` returns 404 (old endpoint removed)
- [x] 8.5 Confirm `GET /api/v1/client-config?appId=chat-ui` returns 200 with correct shape
