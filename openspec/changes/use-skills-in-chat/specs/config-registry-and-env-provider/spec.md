# Spec Delta: config-registry-and-env-provider

## ADDED Requirements

### Requirement: Registry contains the skillUsageEnabled client feature key

The `CONFIG_DEFINITIONS` registry SHALL include a `features.skillUsageEnabled` entry: `type='feature'`, `valueType='boolean'`, `visibility='client'`, `defaultValue=false`, `critical=false`, `envVar='SKILL_USAGE_ENABLED'`, and no `allowedRolesEnvVar` (role-based rollout is out of scope). Unlike `features.responsesApiEnabled` (server-only), this key SHALL be included in `AppConfigService.getClientConfig`'s response by virtue of its `visibility='client'` classification, because it gates frontend UI (the catalog skill "Use in chat" button and the conversation input's Skills menu).

`EnvironmentVariables` (`apps/chat-api/src/config/environment.config.ts`) SHALL gain the validated boolean `SKILL_USAGE_ENABLED` (default `false`) using the same raw-source-value `@Transform` as `RESPONSES_API_ENABLED`, so the literal string `"false"` parses to `false`. The `FeatureKey` enum SHALL gain `SkillUsageEnabled = 'features.skillUsageEnabled'` (its string value matching the registry key exactly), per the feature-flags-service requirement that every feature key be declared in the enum before use.

**Feature flag:** the entry declares `features.skillUsageEnabled`, consumed by the frontend via `useFeatureFlag('skillUsageEnabled')` and by the `catalog-use-in-chat` / `skill-input-attachment` capabilities.

**RTL impact:** None. **i18n impact:** None (the flag carries no user-visible text).

#### Scenario: Registry contains the skillUsageEnabled feature key with client visibility

- **WHEN** the registry is imported
- **THEN** it MUST contain an entry with `key='features.skillUsageEnabled'`, `type='feature'`, `valueType='boolean'`, `visibility='client'`, `critical=false`, `envVar='SKILL_USAGE_ENABLED'`, `defaultValue=false`, and no `allowedRolesEnvVar`

#### Scenario: Flag is exposed to the client and off by default

- **WHEN** the client-config endpoint is called on a deployment that has not set `SKILL_USAGE_ENABLED`
- **THEN** the response's `features` map contains `skillUsageEnabled: false`

#### Scenario: Literal "false" parses to false

- **WHEN** the deployment sets `SKILL_USAGE_ENABLED=false` in the environment
- **THEN** the resolved `features.skillUsageEnabled` value is `false`, not `true`

#### Scenario: FeatureKey enum stays in sync with the registry

- **WHEN** all `FeatureKey` enum values are compared to `CONFIG_DEFINITIONS`
- **THEN** `FeatureKey.SkillUsageEnabled` has a matching `type='feature'` entry with the identical key string
