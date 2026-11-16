## MODIFIED Requirements

### Requirement: FeatureFlagsService.isEnabled evaluates a feature key

`FeatureFlagsService` in `apps/chat-api/src/app-config/feature-flags/feature-flags.service.ts` SHALL expose:

```typescript
async isEnabled(key: FeatureKey, context: AppConfigEvalContext): Promise<boolean>
```

It SHALL first look the key up in `CONFIG_DEFINITIONS` and MUST reject calls for keys that are missing or not `type='feature'` by throwing `BadRequestException` (`Key "<key>" is not a valid feature flag key`). It SHALL then delegate to `AppConfigService.isEnabled(key, context)`. That method captures the managed view once, resolves the enabled bit through `CompositeConfigProvider.resolve`, and applies the deployment role gate. For a feature listed in `MANAGED_CONFIG_ACTIVE_KEYS`, it also applies the managed gates of `managed-config-activation`: usable state, policy present, capability, availability window, and role targeting. It returns `true` only when the result is `value === true` (no cast).

**Failure behavior:**
- If the resolved value is `undefined` or any non-`true` value (including non-boolean values), return `false` (fail closed) without logging; there is no `critical`-based branching at this layer.
- If `CompositeConfigProvider.resolve` throws, `AppConfigService.isEnabled` logs at `error` level and returns `false`.
- If `AppConfigService.isEnabled` throws anything other than `BadRequestException`, `FeatureFlagsService` logs at `warn` level and returns `false`; a `BadRequestException` is rethrown.
- `critical`-based `error`/`warn` logging exists only in `CompositeConfigProvider`, for provider exceptions.

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None.

#### Scenario: Returns true when feature is enabled

- **WHEN** `ASR_MODEL=whisper-1` is set and `featureFlagsService.isEnabled(FeatureKey.AsrEnabled, ctx)` is called
- **THEN** it returns `true`

#### Scenario: Returns false when feature is disabled

- **WHEN** `ASR_MODEL` is not set and `featureFlagsService.isEnabled(FeatureKey.AsrEnabled, ctx)` is called
- **THEN** it returns `false`

#### Scenario: Non-boolean value returns false

- **WHEN** the resolved value for a feature key is a non-boolean such as the string `'true'`
- **THEN** `featureFlagsService.isEnabled` returns `false` because only `value === true` enables the feature

#### Scenario: Returns false on resolution failure

- **WHEN** `CompositeConfigProvider.resolve` throws
- **THEN** `featureFlagsService.isEnabled` returns `false` without rethrowing

#### Scenario: Rejects config-type keys

- **WHEN** `featureFlagsService.isEnabled('asr.modelId' as FeatureKey, ctx)` is called (key is type='config', not 'feature')
- **THEN** it throws `BadRequestException`

---

#### Scenario: Unusable managed state fails closed

- **WHEN** an active managed feature's instance is `stale` and its environment variable is `true`
- **THEN** `featureFlagsService.isEnabled` returns `false`

#### Scenario: Window evaluated at call time

- **WHEN** an active managed feature has `endsAt` at `T`, and `isEnabled` is called at `T - 1 ms` and at `T`
- **THEN** the results are `true` and `false`
