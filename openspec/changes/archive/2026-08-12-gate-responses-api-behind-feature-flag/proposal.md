## Why

The OpenAI Responses API integration (`openspec/specs/responses-api-generation/spec.md`, delivered by `2026-08-06-responses-api-support` and hardened since) is already live for any deployment that reports `features.responsesApi === true` (`apps/chat-api/src/conversations/generation/generation-api.ts:22-27`, called from `ConversationStreamingService.resolveGenerationApiForDeployment` at `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts:80-107`). Selection today depends entirely on a value DIAL Core reports for the deployment — there is no server-side kill switch. If a Core rollout starts advertising `responses_api: true` for more deployments than intended, or the Responses path exhibits an issue in production (upstream contract drift, unexpected error rates, a regression in `ResponsesAdapter`), the only way to stop new generations from using it is a Core-side change or a Chat code rollback — both slower than flipping one operator-controlled setting.

This change adds a server-only feature flag that must be explicitly enabled before deployment-reported Responses support is ever honored, using the feature-flag mechanism already built for this exact purpose in `2026-06-22-centralize-app-config-and-feature-flags` (`apps/chat-api/src/app-config/**`).

## What Changes

- **New**: `FeatureKey.ResponsesApiEnabled = 'features.responsesApiEnabled'` in `apps/chat-api/src/app-config/feature-flags/feature-key.enum.ts`.
- **New**: A `CONFIG_DEFINITIONS` registry entry for `features.responsesApiEnabled` in `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts` — `type: 'feature'`, `visibility: 'server'` (never exposed to the frontend client-config endpoint), `defaultValue: false`, `envVar: 'RESPONSES_API_ENABLED'`.
- **New**: `RESPONSES_API_ENABLED?: boolean = false` on `EnvironmentVariables` (`apps/chat-api/src/config/environment.config.ts`), validated with the `obj`/`key`-reading boolean-coercion `@Transform` already used for `OVERLAY_ENABLED`/`OVERLAY_SANDBOX_ENABLED` (see `design.md` D4 for why this pattern was chosen over the superficially-similar but subtly buggy one used by `LIVE_CHAT_INTERACTION_ENABLED`/`SCHEDULED_TASKS_ENABLED`).
- **Modified**: `ConversationStreamingService.resolveGenerationApiForDeployment` (`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts:80-107`) resolves `FeatureFlagsService.isEnabled(FeatureKey.ResponsesApiEnabled, ctx)` and ANDs it with the existing `resolveGenerationApi(features)` result: `GenerationApi.Responses` is only ever selected when **both** the flag is enabled **and** the deployment reports `features.responsesApi === true`. When the flag is disabled (default, missing, or its resolution fails), the outcome is always `GenerationApi.ChatCompletions`, and `ResponsesAdapter.buildRequest`/`.stream` are never invoked for that request.
- **Not changed**: `resolveGenerationApi` (`generation-api.ts:22-27`) — stays a pure function of `features` only; its existing unit tests and spec scenarios are untouched. See `design.md` D1 for why the flag is combined in the orchestration layer, not inside this function.
- **Not changed**: the `getDeploymentDetails` call and its toolset-rejection / `temperatureSupported` derivation (`conversation-streaming.service.ts:85-105`) — this call is not skipped when the flag is disabled. See `design.md` D2 for why.
- **New**: `ConversationModule` gains no new imports — `AppConfigModule` is already imported (`apps/chat-api/src/conversations/conversation.module.ts:24`) and already exports `FeatureFlagsService` (`apps/chat-api/src/app-config/app-config.module.ts`), which is sufficient to inject it into `ConversationStreamingService`.
- **Docs**: `docs/responses-api-integration.md` and `apps/chat-api/README.md`/`.env.template` gain the new flag and env var.
- **Explicitly out of scope**: `RESPONSES_API_ENABLED_ROLES` (role-based rollout) — not implemented in this change; see Non-goals.

## Capabilities

### Modified Capabilities

- `responses-api-generation`: the "ConversationService resolves generation API before opening the upstream stream" requirement gains a feature-flag precondition — Responses is selected only when `features.responsesApiEnabled` is also enabled.
- `config-registry-and-env-provider`: the `CONFIG_DEFINITIONS` registry requirement gains a new entry (`features.responsesApiEnabled`) and a new scenario.
- `feature-flags-service`: the `FeatureKey` enum requirement gains a new member and a scenario confirming it is consulted from `ConversationStreamingService` (a domain service, not a `@RequireFeature`-guarded controller — see Non-goals).

### New Capabilities

*(none)*

## Non-goals

- No `@RequireFeature`/`FeatureGuard` on `POST /api/v1/conversations/completions` or any other controller route. `FeatureGuard` throws `ForbiddenException` (403) for the entire request (`apps/chat-api/src/external-services/external-services.controller.ts:34-36` is the existing pattern) — that is the wrong shape here: a disabled flag must silently select Chat Completions, not block generation.
- No frontend toggle, no client-visible flag. `visibility: 'server'` keeps the key out of `AppConfigService.getClientConfig` by construction (same as `features.llmConversationNaming`, `config-registry.constants.ts:171-181`). The client already cannot select the generation API and this does not change.
- No automatic retry through Chat Completions after a Responses request has started — unchanged from the existing "No automatic fallback after a Responses call has started" requirement in `responses-api-generation`; this change only affects the *pre-request* selection step.
- No role-based rollout in this change. `RESPONSES_API_ENABLED_ROLES` is explicitly out of scope — the registry entry has no `allowedRolesEnvVar`, and `FeatureFlagsService.isEnabled` is called with a fixed server context (no user `roles`), matching the existing `features.llmConversationNaming` precedent (`apps/chat-api/src/conversations/conversation-naming.service.ts:32,180-183`). A follow-up change may add it if per-role rollout is later needed.
- No change to `apps/chat`, `libs/*`, OpenAPI/generated-client, i18n, RTL, or accessibility. This is a backend-only, server-side routing change with no new or altered HTTP contract, request/response shape, or user-visible surface.

## Alternatives considered

Gate placement was the only real design fork; both options were evaluated against "lowest risk to the legacy Chat Completions path" (see `design.md` D1 for the full comparison):

1. **Inside the generation API resolver** (`resolveGenerationApi` in `generation-api.ts`) — add a `responsesApiEnabled: boolean` parameter to the pure function. Rejected as the primary approach: it changes the signature of an existing, independently-spec'd, fully-tested pure function for a concern (async feature-flag resolution) that does not belong inside a pure selector, and it is unnecessary — the same outcome is achievable one layer up with zero risk to `generation-api.ts`'s existing contract and tests.
2. **In the orchestration layer, before capability resolution finalizes** (`ConversationStreamingService.resolveGenerationApiForDeployment`) — **selected**. The flag is resolved via the already-injected `FeatureFlagsService` (once `AppConfigModule` is imported) and ANDed with the untouched `resolveGenerationApi(features)` result. `generation-api.ts` and its spec scenarios are not touched at all, so the risk surface is confined to one already-tested orchestration method that already has its own try/catch/fail-closed error handling.

A third variant — short-circuiting *before* `getDeploymentDetails` is even called when the flag is disabled, so a disabled experimental feature adds zero latency to Chat Completions — was investigated and rejected. `getDeploymentDetails` is not Responses-specific: it also performs the toolset-deployment rejection (`BadRequestException` for `type: 'toolset'`, `conversation-streaming.service.ts:91-96`) and derives `temperatureSupported`, both of which Chat Completions already depends on today, independent of Responses. Skipping the call would silently drop toolset validation and temperature-capability detection for every generation request whenever the flag is off — a regression unrelated to this change's purpose. See `design.md` D2 for the full analysis.

## Rollback / backward compatibility

- **Rollback**: set `RESPONSES_API_ENABLED=false` (or unset it — the default is already `false`) and restart the backend. All new generations immediately use Chat Completions regardless of what any deployment reports for `features.responsesApi`. No data migration, no persisted state to revert — the flag only affects the in-flight selection of an upstream API for new streaming requests.
- **Backward compatible**: default is `false`, so no existing deployment's behavior changes until an operator explicitly opts in. Deployments that already have `features.responsesApi === true` and were previously routed to Responses will, on first deploy of this change with the flag unset, fall back to Chat Completions until the operator sets `RESPONSES_API_ENABLED=true` — this is the intended safety behavior, not a regression, and is called out in the docs update as a deployment note.
- No OpenAPI/generated-client, DTO, or endpoint-contract changes. `POST /api/v1/conversations/completions` and its SSE payload shape are unchanged for both Chat Completions and Responses-routed generations.

## i18n / RTL / accessibility impact

None. No user-visible strings, no UI surface, no frontend change of any kind.
