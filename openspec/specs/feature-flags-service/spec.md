# feature-flags-service Specification

## Purpose

Backend feature keys, `FeatureFlagsService.isEnabled`, and the route guard built on them.

## ADDED Requirements

### Requirement: FeatureKey enum enumerates all feature keys

The system SHALL define a `FeatureKey` string enum in `apps/chat-api/src/app-config/feature-flags/feature-key.enum.ts` containing at least:

```typescript
enum FeatureKey {
  AsrEnabled = 'features.asrEnabled',
  LlmConversationNaming = 'features.llmConversationNaming',
  LiveChatInteraction = 'features.liveChatInteraction',
  ScheduledTasksEnabled = 'features.scheduledTasksEnabled',
  Footer = 'features.footer',
  ResponsesApiEnabled = 'features.responsesApiEnabled',
}
```

New feature keys MUST be added to this enum before being used in any service, guard, or decorator. String values MUST match the corresponding `ConfigDefinition.key` exactly.

`FeatureKey.ResponsesApiEnabled` MAY be consulted directly from a domain service via `FeatureFlagsService.isEnabled` (as `ConversationStreamingService` does), not only from a `@RequireFeature`-decorated controller route via `FeatureGuard` — both consumption paths resolve through the same `AppConfigService`-backed mechanism and share the same fail-closed failure behavior.

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None.

#### Scenario: FeatureKey values match registry keys

- **WHEN** all `FeatureKey` enum values are compared to `CONFIG_DEFINITIONS`
- **THEN** every `FeatureKey` value MUST have a matching entry in the registry with `type='feature'`

#### Scenario: ResponsesApiEnabled is usable from a domain service without a controller guard

- **WHEN** `ConversationStreamingService` calls `featureFlagsService.isEnabled(FeatureKey.ResponsesApiEnabled, context)` directly (not via `@RequireFeature`/`FeatureGuard` on a controller route)
- **THEN** the call resolves a boolean using the same registry entry and the same fail-closed behavior as any other `FeatureKey`, with no `ForbiddenException` thrown by this call path since no `FeatureGuard` is involved

---

### Requirement: FeatureFlagsService.isEnabled evaluates a feature key

`FeatureFlagsService` in `apps/chat-api/src/app-config/feature-flags/feature-flags.service.ts` SHALL expose:

```typescript
async isEnabled(key: FeatureKey, context: AppConfigEvalContext): Promise<boolean>
```

It SHALL delegate to `AppConfigService.resolveValue(key, context)` and cast the result to `boolean`. It MUST reject calls for keys that are not `type='feature'` in the registry by throwing `BadRequestException` with a descriptive message.

**Failure behavior:**
- If resolution fails or returns `undefined`, return `false` (fail closed).
- If the resolved value is not a boolean and the key has `critical=true`, return `false` and log at `error` level.
- If the resolved value is not a boolean and `critical=false`, return `false` and log at `warn` level.

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None.

#### Scenario: Returns true when feature is enabled

- **WHEN** `ASR_MODEL=whisper-1` is set and `featureFlagsService.isEnabled(FeatureKey.AsrEnabled, ctx)` is called
- **THEN** it returns `true`

#### Scenario: Returns false when feature is disabled

- **WHEN** `ASR_MODEL` is not set and `featureFlagsService.isEnabled(FeatureKey.AsrEnabled, ctx)` is called
- **THEN** it returns `false`

#### Scenario: Returns false on resolution failure

- **WHEN** `CompositeConfigProvider.resolve` throws
- **THEN** `featureFlagsService.isEnabled` returns `false` without rethrowing

#### Scenario: Rejects config-type keys

- **WHEN** `featureFlagsService.isEnabled('asr.modelId' as FeatureKey, ctx)` is called (key is type='config', not 'feature')
- **THEN** it throws `BadRequestException`

---

### Requirement: FeatureGuard protects routes behind a feature flag

The system SHALL provide `FeatureGuard` in `apps/chat-api/src/app-config/feature-flags/feature.guard.ts` implementing `CanActivate`. When `featureFlagsService.isEnabled(key, context)` returns `false`, the guard MUST throw `ForbiddenException`. When `true`, the guard passes.

`@RequireFeature(key: FeatureKey)` decorator SHALL set metadata consumed by `FeatureGuard` via `Reflector`.

Feature guards MUST NOT replace authorization checks. Routes protected by `@RequireFeature` MUST also carry appropriate auth guards. Role checks and feature checks remain separate concerns.

**Authorization:** Guards using `@RequireFeature` apply feature gating only; session/role guards are orthogonal.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Guard allows request when feature is enabled

- **WHEN** `FeatureKey.AsrEnabled` is enabled and a request hits a route decorated with `@RequireFeature(FeatureKey.AsrEnabled)`
- **THEN** the guard returns `true` and the request proceeds

#### Scenario: Guard blocks request when feature is disabled

- **WHEN** `FeatureKey.AsrEnabled` is disabled and a request hits a route decorated with `@RequireFeature(FeatureKey.AsrEnabled)`
- **THEN** the guard throws `ForbiddenException` with status 403

#### Scenario: Missing RequireFeature metadata passes through

- **WHEN** a route has no `@RequireFeature` decorator
- **THEN** `FeatureGuard` returns `true` (no-op when no feature key is set)

---

### Requirement: AppConfigService.resolveValue does not expose server-only values to callers that ask for client config

`AppConfigService.getClientConfig(context)` SHALL filter resolved values to only include definitions with `visibility='client'`. Server-only keys (e.g. hypothetical future server-side flags) MUST be excluded from the response even if they are in the registry.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Server-only key is excluded from getClientConfig

- **WHEN** a `ConfigDefinition` with `visibility='server'` exists in the registry
- **THEN** `AppConfigService.getClientConfig(context)` MUST NOT include that key in the returned DTO

#### Scenario: Client-only key is included in getClientConfig

- **WHEN** a `ConfigDefinition` with `visibility='client'` exists in the registry
- **THEN** `AppConfigService.getClientConfig(context)` MUST include that key under the appropriate `features` or `config` map
