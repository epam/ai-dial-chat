## MODIFIED Requirements

### Requirement: FeatureKey enum enumerates all feature keys

The system SHALL define a `FeatureKey` string enum in `apps/chat-api/src/app-config/feature-flags/feature-key.enum.ts` containing:

```typescript
enum FeatureKey {
  AsrEnabled = 'features.asrEnabled',
  LlmConversationNaming = 'features.llmConversationNaming',
  LiveChatInteraction = 'features.liveChatInteraction',
  ScheduledTasksEnabled = 'features.scheduledTasksEnabled',
  ProjectsEnabled = 'features.projectsEnabled',
  Footer = 'features.footer',
  ResponsesApiEnabled = 'features.responsesApiEnabled',
  ResponsesBackgroundEnabled = 'features.responsesBackgroundEnabled',
  DefaultDeploymentPinned = 'features.defaultDeploymentPinned',
  VisualizerSendMessages = 'features.visualizerSendMessages',
  UsageLimitsControl = 'features.usageLimitsControl',
}
```

New feature keys MUST be added to this enum before being used in any service, guard, or decorator. String values MUST match the corresponding `ConfigDefinition.key` exactly.

`FeatureKey.ResponsesApiEnabled` and `FeatureKey.ResponsesBackgroundEnabled` MAY be consulted directly from a domain service via `FeatureFlagsService.isEnabled` (as `ConversationStreamingService` does), not only from a `@RequireFeature`-decorated controller route via `FeatureGuard` — both consumption paths resolve through the same `AppConfigService`-backed mechanism and share the same fail-closed failure behavior.

`FeatureKey.ProjectsEnabled` gates the `/api/v1/projects` endpoints through the class-level `@RequireFeature` on `ProjectsController` (`apps/chat-api/src/projects/projects.controller.ts`), and is exposed to the client as `features.projectsEnabled`.

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None.

#### Scenario: FeatureKey values match registry keys

- **WHEN** all `FeatureKey` enum values are compared to `CONFIG_DEFINITIONS`
- **THEN** every `FeatureKey` value MUST have a matching entry in the registry with `type='feature'`

#### Scenario: ProjectsEnabled has a client-visible registry entry

- **WHEN** `CONFIG_DEFINITIONS` is searched for `features.projectsEnabled`
- **THEN** exactly one entry exists, with `type: 'feature'`, `visibility: 'client'`, `defaultValue: false`, `envVar: 'PROJECTS_ENABLED'` and `allowedRolesEnvVar: 'PROJECTS_ENABLED_ROLES'`

#### Scenario: ResponsesApiEnabled is usable from a domain service without a controller guard

- **WHEN** `ConversationStreamingService` calls `featureFlagsService.isEnabled(FeatureKey.ResponsesApiEnabled, context)` directly (not via `@RequireFeature`/`FeatureGuard` on a controller route)
- **THEN** the call resolves a boolean using the same registry entry and the same fail-closed behavior as any other `FeatureKey`, with no `ForbiddenException` thrown by this call path since no `FeatureGuard` is involved

#### Scenario: ResponsesBackgroundEnabled is usable from a domain service and fails closed

- **WHEN** `ConversationStreamingService` calls `featureFlagsService.isEnabled(FeatureKey.ResponsesBackgroundEnabled, context)` and resolution fails
- **THEN** the call resolves `false` without throwing, and no `FeatureGuard` is involved
