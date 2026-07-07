## Why

The current `GET /api/v1/config` endpoint hard-codes two ASR settings directly in the controller and exposes them through a hand-rolled `base.ts` fetch call rather than the generated API client. There is no concept of feature flags, no declarative registry of known keys, no visibility separation between server-only and client-safe values, and no extensible provider chain — meaning the backend can never serve feature state to guards, decorators, or other services, and the frontend cannot rely on a typed, unified source of runtime configuration.

## What Changes

- **New**: Declarative `ConfigDefinition` registry mapping each known key to its type, visibility, default value, and environment variable binding.
- **New**: `EnvConfigProvider` reads the registry and resolves values from the validated `EnvironmentVariables` schema via `ConfigService` — services never read `process.env` directly.
- **New**: `StaticDefaultsProvider` returns the declared `defaultValue` for any key not resolved by a higher-priority provider.
- **New**: `CompositeConfigProvider` iterates providers in priority order (env → static defaults) with explicit extension points for future managed-config and OpenFeature adapters.
- **New**: `AppConfigService` wraps the composite provider, filters values by visibility, and serves both backend feature evaluation and the client endpoint.
- **New**: `FeatureFlagsService` exposes `isEnabled(key, context)` for backend guards and decorators; uses the same composite provider.
- **New**: `AppConfigContext` typed as `{ appId, userId?, roles?, environment? }` — passed to providers and later extended without breaking callers.
- **BREAKING**: `GET /api/v1/config` is **replaced** by `GET /api/v1/client-config?appId=chat-ui`. Response shape changes from `{ asrModelId, transcribeSizeLimitBytes }` to `{ appId, features, config, metadata }`. The old endpoint is removed in the same PR after updating the single frontend caller.
- **Updated**: `AppConfigContext.tsx` gains `useFeatureFlag(key)` hook, loading/error/ready state, async/await pattern, AbortController cleanup, and typed hooks backed by the generated API client.
- **Updated**: `apps/chat/src/server-api/config.api.ts` is replaced by a generated-client wrapper in `apps/chat/src/server-api/app-config.api.ts`.
- **Updated**: `EnvironmentVariables` retains `ASR_MODEL` and `TRANSCRIBE_SIZE_LIMIT_BYTES` — both are migrated to registry entries; no env var rename.
- **Non-breaking addition** to `openapi/config.yaml`: new `client-config` tag and operation; regenerated `@epam/chat-api-client` gains `AppConfigApi.getClientConfig()`.

## Capabilities

### New Capabilities

- `config-registry-and-env-provider`: Declarative `ConfigDefinition` registry, `EnvConfigProvider`, `StaticDefaultsProvider`, and `CompositeConfigProvider` with typed `AppConfigContext`. Covers key lifecycle (unknown keys, type mismatches, missing values, critical flags, server-only keys).
- `feature-flags-service`: `FeatureFlagsService.isEnabled(key, context)`, feature key string enum, and `@RequireFeature` / `FeatureGuard` for backend guards and decorators.
- `client-config-endpoint`: `GET /api/v1/client-config?appId=chat-ui`, `AppConfigService.getClientConfig(context)`, Swagger/OpenAPI annotations, rate limiting, caching policy, and integration tests. Migration of the existing `GET /api/v1/config`.
- `app-config-context`: Updated React `AppConfigContext`, `useAppConfig()`, `useFeatureFlag(key)`, loading/error/ready state, generated-client integration, and safe defaults while loading.

### Modified Capabilities

*(none — no existing spec-level requirements change)*

## Impact

**Backend (`apps/chat-api`)**
- New domain folder: `src/app-config/` (extends existing stub — current controller + module replaced).
- New files: `config-registry/`, `feature-flags/`, `composite-config-provider/`.
- `EnvironmentVariables` (`src/config/environment.config.ts`): no fields removed; `ASR_MODEL` and `TRANSCRIBE_SIZE_LIMIT_BYTES` gain registry counterparts.
- `AppConfigModule` expands; `AppConfigController` handler renamed; new `FeatureFlagsModule`.

**API surface**
- `GET /api/v1/config` removed; `GET /api/v1/client-config` introduced.
- OpenAPI spec regenerated; `@epam/chat-api-client` gains `AppConfigApi`.

**Frontend (`apps/chat`)**
- `src/server-api/config.api.ts` replaced by `src/server-api/app-config.api.ts` (generated-client wrapper).
- `src/context/AppConfigContext.tsx` rewritten; `useFeatureFlag` added.
- `src/main.tsx`: `AppConfigProvider` moves before `RequireAuth` to enable pre-auth bootstrap (loading state shown).

**Scope not included in this change**
- Configuration management UI.
- External provider integration (Unleash, LaunchDarkly, ConfigCat, OpenFeature).
- Percentage rollouts or experimentation.
- Multi-tenant or workspace-level flag overrides.
- Config for `mindmap-ui`, `admin-ui`, or `rageval-ui` apps (only `chat-ui` in first slice).

**Alternatives considered**
- *Extend `GET /api/v1/config`*: Rejected because the flat `{ asrModelId, transcribeSizeLimitBytes }` shape cannot cleanly accommodate features vs. config segregation, metadata, or appId scoping without a larger breaking change.
- *Single JSON env var (`APP_CONFIG_JSON`)*: Rejected as primary mechanism — harder to set in Kubernetes Helm values, no IDE autocomplete, and validation only at boot. Retained as a potential future override layer.
- *OpenFeature as the only backend provider*: Rejected for the first slice — adds an external SDK dependency with no concrete provider configured; start with `EnvConfigProvider` and add an `OpenFeatureProviderAdapter` later.
- *Keep `AppConfigProvider` after `RequireAuth`*: Rejected — prevents showing a loading skeleton or disabling features before the user is authenticated; moving it earlier allows a safer bootstrap sequence.

**Backward compatibility**
- The single caller of `GET /api/v1/config` is `apps/chat/src/server-api/config.api.ts`. It is updated in the same PR. No external callers are known.
- `ASR_MODEL` and `TRANSCRIBE_SIZE_LIMIT_BYTES` environment variable names are preserved; behavior is unchanged.
- `useAppConfig()` hook signature changes: the returned object gains `features`, `metadata`, and state fields; existing `asrModelId` and `transcribeSizeLimitBytes` fields move inside `config`. Callers are updated in the same PR.

**Rollback**
- Revert the PR. The old `GET /api/v1/config` endpoint is removed in the same commit, so rollback restores it atomically.
- No database migrations or persistent state changes are involved.

**i18n impact**
- None. No new user-visible strings. Feature flags are evaluated server-side; no locale-specific flag values in this slice.

**Scope-creep assessment**
- `@RequireFeature` decorator and `FeatureGuard` are in scope only as thin wrappers over `FeatureFlagsService.isEnabled` — not as a full RBAC replacement.
- Caching is limited to in-memory `cache-manager` with a short TTL; no Redis or distributed cache.
- The `AppConfigContext` eval context carries `appId`, `userId`, `roles`, and `environment` fields — all optional except `appId`; no tenant or workspace field in this slice.
