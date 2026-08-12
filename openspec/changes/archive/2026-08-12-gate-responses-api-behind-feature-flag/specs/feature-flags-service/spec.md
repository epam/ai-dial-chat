## MODIFIED Requirements

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
