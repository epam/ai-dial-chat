## Context

Current selection flow, cited exactly as it exists today:

- `resolveGenerationApi(features?: GenerationApiFeatures): GenerationApi` — pure function, `apps/chat-api/src/conversations/generation/generation-api.ts:22-27`. Returns `GenerationApi.Responses` iff `features?.responsesApi === true`, else `GenerationApi.ChatCompletions`.
- `ConversationStreamingService.resolveGenerationApiForDeployment(sub, model, token)` — `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts:80-107`. Calls `this.deploymentsService.getDeploymentDetails(sub, model, token)` (line 85-89), throws `BadRequestException` if `details.type === 'toolset'` (lines 91-96), reads `features` off `applicationDetails`/`modelDetails` depending on `details.type` (lines 98-101), and returns `{ generationApi: resolveGenerationApi(features), temperatureSupported: features?.temperature === true }` (lines 103-106).
- `ConversationStreamingService.streamCompletion` — calls `resolveGenerationApiForDeployment` at lines 387-398 (inside a try/catch that increments `generationCapabilityResolutionTotal` and releases the registered generation on failure), then at lines 534-557 branches: `generationApi === GenerationApi.Responses ? this.responsesAdapter.stream(...) : this.relayModelCompletion(...)`.
- `DeploymentsService.getDeploymentDetails` facade (`apps/chat-api/src/deployments/deployments.service.ts:36-38`) delegates to `DeploymentsDetailsService.getDeploymentDetails` (`apps/chat-api/src/deployments/details/deployments-details.service.ts:108-137`), which is cache-backed (`cacheManager` keyed `deployments:details:${userSub}:${deployment}`, in-flight de-dup via `pendingDetailsRequests`) but calls DIAL Core over the network on a cache miss.
- `ConversationModule` (`apps/chat-api/src/conversations/conversation.module.ts:20-26`) already imports `AppConfigModule` and `DeploymentsModule`; `ConversationStreamingService` is already constructed with `deploymentsService` and `responsesAdapter` (lines 72-78).
- Existing feature-flag mechanism: `FeatureFlagsService.isEnabled(key, context)` (`apps/chat-api/src/app-config/feature-flags/feature-flags.service.ts:13-35`) — looks up the key in `CONFIG_DEFINITIONS`, throws `BadRequestException` for a non-`'feature'`-typed key, and **fails closed** (`return false`) if the underlying `AppConfigService.isEnabled` call throws. `AppConfigModule` exports `FeatureFlagsService` (`apps/chat-api/src/app-config/app-config.module.ts`).
- Existing precedent for a *server-only* feature flag consulted from inside a domain service (not a controller guard): `ConversationNamingService` — `apps/chat-api/src/conversations/conversation-naming.service.ts:32` defines `const SERVER_APP_CONFIG_CONTEXT = { appId: 'chat-api' };` and line 180-183 calls `this.appConfigService.isEnabled(FeatureKey.LlmConversationNaming, SERVER_APP_CONFIG_CONTEXT)`. `features.llmConversationNaming` is registered with `visibility: 'server'` and no `allowedRolesEnvVar` (`config-registry.constants.ts:171-181`).
- Existing `@RequireFeature`/`FeatureGuard` usages are all whole-route: `apps/chat-api/src/external-services/external-services.controller.ts:34-36`, `apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts:45-46`, `apps/chat-api/src/client-channel/client-channel.controller.ts:36-37,135-136`. `FeatureGuard.canActivate` throws `ForbiddenException` (403) for the entire request when the flag is off.

## Goals / Non-Goals

**Goals:**
- A single server-only, boolean, env-backed flag that must be `true` before `features.responsesApi === true` is ever honored.
- Zero change to `POST /api/v1/conversations/completions`'s request/response/SSE contract.
- Zero change to `resolveGenerationApi`'s existing signature, behavior, or spec scenarios.
- Disabling the flag must be indistinguishable, from the deployment's/user's perspective, from a deployment that never declared `responsesApi: true` — same Chat Completions path, same toolset validation, same temperature detection.
- Fail closed: any feature-flag resolution failure results in Chat Completions, never a 500 or a 403.

**Non-Goals:**
- Role-based rollout (`RESPONSES_API_ENABLED_ROLES`) — explicitly deferred; see proposal.md Non-goals.
- Any change to `ResponsesAdapter`'s internal SSE handling, error taxonomy, or the "no retry after a Responses call has started" behavior — those requirements are untouched.
- Any change to `getDeploymentDetails` caching, toolset rejection, or temperature-capability derivation.
- A configuration-management UI, percentage rollouts, or multi-tenant overrides — out of scope for the underlying feature-flag mechanism itself (already stated as non-goals in `2026-06-22-centralize-app-config-and-feature-flags`).

## Decisions

### D1 — Gate in the orchestration layer (`ConversationStreamingService`), not inside `resolveGenerationApi`

**Decision:** `resolveGenerationApiForDeployment` resolves the feature flag via the already-available `FeatureFlagsService` and combines it with the existing `resolveGenerationApi(features)` result:

```typescript
const [details, responsesApiEnabled] = await Promise.all([
  this.deploymentsService.getDeploymentDetails(sub, model, token),
  this.featureFlagsService.isEnabled(
    FeatureKey.ResponsesApiEnabled,
    SERVER_APP_CONFIG_CONTEXT,
  ),
]);

// ...existing toolset check and features extraction, unchanged...

const generationApi = responsesApiEnabled
  ? resolveGenerationApi(features)
  : GenerationApi.ChatCompletions;
```

`resolveGenerationApi` itself is not touched — no new parameter, no new branch, no spec change to the "Generation API resolver" requirement.

**Alternatives considered:**

1. **Inside `resolveGenerationApi`** — add `responsesApiEnabled: boolean` as a second parameter, e.g. `resolveGenerationApi(features, responsesApiEnabled)`. Rejected: `generation-api.ts` is a small, independently unit-tested pure module (`generation-api.spec.ts`) whose entire existing contract (`openspec/specs/responses-api-generation/spec.md`, "Generation API resolver" requirement) is a pure function of `features` alone. Adding a flag parameter forces every existing test and the one real caller to pass an extra argument, and mixes an async, I/O-backed concern (feature-flag resolution, which itself depends on `AppConfigService`/`ConfigService`) into a function whose only job is a synchronous, side-effect-free mapping. It also does not reduce risk anywhere: the flag still has to be resolved via `FeatureFlagsService` in the orchestration layer before it can be passed in, so this option adds a parameter for no risk reduction.
2. **In the orchestration layer, before capability resolution finalizes** (chosen) — resolves the flag exactly where `DeploymentsService` is already injected and where the existing try/catch/fail-closed error handling (`streamCompletion`, lines 387-398) already lives. `generation-api.ts` and its spec/tests are untouched, so this option's blast radius is the smallest: one already-covered method (`resolveGenerationApiForDeployment`) gains one additional resolved value and one `? :` — the toolset check, the `features` extraction, and `temperatureSupported` derivation are unchanged by inspection.

**Why option 2 has the lowest risk to the legacy Chat Completions path:** Chat Completions requests already flow through `resolveGenerationApiForDeployment` today (that call is not new — it predates this change and already serves toolset validation and temperature detection for every generation, not only Responses-eligible ones). Option 2 adds exactly one new resolved value to a method Chat Completions already depends on, with the same fail-closed pattern the flag-resolution helper already guarantees (`FeatureFlagsService.isEnabled` never throws). Option 1 would have made the same guarantee, but at the cost of also changing a currently side-effect-free, independently-tested pure function's public shape — unnecessary surface area for the same outcome.

---

### D2 — Do NOT short-circuit before `getDeploymentDetails` when the flag is disabled

**Investigated:** could the disabled-flag path skip `getDeploymentDetails` entirely, so a disabled experimental feature adds no latency and no failure mode to Chat Completions?

**Decision: No.** `getDeploymentDetails` (`conversation-streaming.service.ts:85-89`) is not solely in service of Responses API selection. Its result also drives:

1. **Toolset rejection** (lines 91-96): `details.type === 'toolset'` throws `BadRequestException` before any generation call — this applies to Chat Completions requests exactly as much as Responses-eligible ones, and predates the Responses feature.
2. **`temperatureSupported` derivation** (line 105): `features?.temperature === true` is read from the same `features` object and passed to whichever adapter builds the request — Chat Completions' `buildRequest` also consumes this today via the shared `resolveGenerationApiForDeployment` return value.

If the flag-disabled path skipped `getDeploymentDetails` outright, it would silently remove toolset validation and temperature-capability detection for **every** generation request whenever `RESPONSES_API_ENABLED=false` (i.e. always, by default) — a behavior regression for Chat Completions that has nothing to do with this change's purpose. That is a strictly *higher*-risk outcome than the (already-existing, already-cached) network/cache lookup this change would have tried to save.

**Effect on the existing toolset-deployment validation:** none. `getDeploymentDetails` continues to run unconditionally for every `streamCompletion` call, exactly as it does today; toolset rejection and temperature detection are completely unaffected by this change in every combination of flag state and deployment capability. The only thing gated by the new flag is the final `generationApi` value's ability to become `GenerationApi.Responses`.

**Cost accepted:** when the flag is disabled (the default), the backend still performs the same `getDeploymentDetails` cache lookup (and, on a cold cache, the same DIAL Core round-trip) it already performs today for Chat Completions' own toolset/temperature needs — this is not new cost introduced by this change; it is the pre-existing cost of the capability-resolution step this change deliberately does not touch.

---

### D3 — Feature-flag registry shape

**Decision:** New `CONFIG_DEFINITIONS` entry:

```typescript
{
  key: 'features.responsesApiEnabled',
  type: 'feature',
  valueType: 'boolean',
  visibility: 'server',
  defaultValue: false,
  critical: false,
  description:
    'Server-side kill switch for routing eligible generations through the ' +
    'OpenAI Responses API. Even when a deployment reports ' +
    'features.responsesApi=true, Responses is only used when this flag is ' +
    'also true. Defaults to false. Not exposed to the frontend client-config ' +
    'endpoint (visibility: server). Role-based rollout ' +
    '(RESPONSES_API_ENABLED_ROLES) is not implemented — out of scope.',
  owner: 'chat-team',
  envVar: 'RESPONSES_API_ENABLED',
}
```

`visibility: 'server'` follows the `features.llmConversationNaming` precedent exactly (`config-registry.constants.ts:171-181`) — `AppConfigService.getClientConfig` filters to `visibility='client'` only, so this key can never leak into the client-config response by construction, without needing a bespoke check anywhere.

No `allowedRolesEnvVar` is set, matching the "no role-based rollout" non-goal.

### D4 — Env var validation

**Decision (revised during implementation):** Add to `EnvironmentVariables` (`apps/chat-api/src/config/environment.config.ts`) using the `obj`/`key`-reading boolean-coercion `@Transform` already used for `OVERLAY_ENABLED`/`OVERLAY_SANDBOX_ENABLED` (lines 682-704), not the `({ value }) => ...`-only variant used by `LIVE_CHAT_INTERACTION_ENABLED`/`SCHEDULED_TASKS_ENABLED`:

```typescript
@IsOptional()
@Transform(({ obj, key }) => {
  const raw = (obj as Record<string, unknown>)[key];
  if (raw == null) return undefined;
  if (typeof raw === 'boolean') return raw;
  return !['false', '0', 'no'].includes(String(raw).toLowerCase());
})
@IsBoolean()
RESPONSES_API_ENABLED?: boolean = false;
```

**Why revised:** the originally-planned `({ value }) => ...` pattern (as copied from `LIVE_CHAT_INTERACTION_ENABLED`) fails a real end-to-end validation test: `class-transformer`'s `enableImplicitConversion` coerces the raw string `"false"` to boolean `true` *before* the field's own `@Transform` runs, so `value` already arrives as `true` and the string-comparison branch (`!['false','0','no'].includes(...)`) never fires as intended. `OVERLAY_ENABLED`'s existing code comment (`environment.config.ts:682-688`) documents this exact pitfall and works around it by reading the raw pre-conversion value via `obj[key]` instead of the already-coerced `value`. `RESPONSES_API_ENABLED=false` in a real `.env` file must resolve to `false`, so this change adopts the `obj`/`key` pattern rather than propagating the same latent bug that (untested) `LIVE_CHAT_INTERACTION_ENABLED`/`SCHEDULED_TASKS_ENABLED` already carry. Fixing those two pre-existing fields is out of scope for this change — flagged here as a follow-up worth a separate fix, not bundled into this proposal.

No `RESPONSES_API_ENABLED_ROLES` field is added — out of scope per the proposal's Non-goals.

### D5 — Eval context: fixed server context, no roles

**Decision:** Reuse the `SERVER_APP_CONFIG_CONTEXT = { appId: 'chat-api' }` pattern verbatim, defined locally in `conversation-streaming.service.ts` (mirroring the existing per-file constant in `conversation-naming.service.ts:32` — this repo does not currently share that constant across files, so this change does not introduce a shared-constant refactor as a drive-by change).

**Why not thread real user `roles` through:** the controller call site (`apps/chat-api/src/conversations/conversation.controller.ts:213-229`) only extracts `req.user as SessionUser` (`{ at, bucket, sid, sub }`) — no `roles` array is read from the session today. Threading roles through would require a change to the controller, the service interface, and `SessionUser` handling purely to support a rollout mechanism (`RESPONSES_API_ENABLED_ROLES`) this change explicitly does not implement. If role-based rollout is requested later, that follow-up change should thread `roles` through at that point, alongside adding `allowedRolesEnvVar` to the registry entry and updating `EnvConfigProvider`.

## Risks / Trade-offs

- **Extra async call per generation request**: `FeatureFlagsService.isEnabled` is resolved via `Promise.all` alongside the existing `getDeploymentDetails` call, so it does not add sequential latency. The flag resolves through `EnvConfigProvider`/`StaticDefaultsProvider` (in-memory, boot-time-constant env values per `config-registry-and-env-provider` spec) — no network call, no meaningful latency cost.
- **Silent behavior change on first deploy for already-opted-in deployments**: any deployment that already reports `features.responsesApi: true` will fall back to Chat Completions the moment this change ships, until an operator sets `RESPONSES_API_ENABLED=true`. This is the intended fail-safe default, called out explicitly in the docs update task so it is not mistaken for a bug during rollout.
- **Two independent conditions to reason about**: `features.responsesApi` (per-deployment, Core-controlled) and `features.responsesApiEnabled` (global, Chat-operator-controlled) must both be `true`. `docs/responses-api-integration.md`'s selection table is updated to show the combined truth table (see tasks.md) to avoid confusion.

## Migration Plan

None required — additive env var with a safe default (`false`), additive enum member, additive registry entry, no schema/data migration, no breaking endpoint change. See proposal.md "Rollback / backward compatibility".

## Open Questions

None — all design forks were resolved above (D1: orchestration layer; D2: do not skip `getDeploymentDetails`).
