## MODIFIED Requirements

### Requirement: ConfigDefinition registry declares all known keys

The system SHALL maintain a `CONFIG_DEFINITIONS` registry in `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts` that is the single authoritative list of all known configuration keys. Each entry SHALL conform to the `ConfigDefinition` interface:

```typescript
interface ConfigDefinition {
  key: string;          // dot-notation name, e.g. 'asr.modelId'
  type: 'feature' | 'config';
  valueType: 'boolean' | 'string' | 'number' | 'json';
  visibility: 'client' | 'server';
  defaultValue: unknown;
  critical: boolean;
  description: string;
  owner: string;
  envVar?: keyof EnvironmentVariables;
  allowedRolesEnvVar?: keyof EnvironmentVariables;
  expiresAt?: string;
  managed?: boolean;                  // default false: not in the exported managed contract
  localOnly?: LocalOnlyReason;        // never manageable; mutually exclusive with managed
  managedContract?: ManagedKeyContract; // required when managed is true
}
```

`managed`, `localOnly` and `managedContract` are defined by the `managed-config-contract` capability. Every entry SHALL be classified as exactly one of: managed (`managed: true` with a `managedContract`), local-only (`localOnly` set, `managed` absent or false), or eligible but unmanaged (neither). Setting `managed` has no effect on how any value is resolved in this capability; it only selects the key for the exported managed contract.

Every key with `visibility='client'` MUST have a `defaultValue` that is safe to expose publicly. Keys with `visibility='server'` MUST NOT appear in the client-config response.

The registry SHALL include a `dialCore.externalUrl` entry: `type='config'`, `valueType='string'`, `visibility='client'`, `defaultValue=null`, `critical=false`, `envVar='DIAL_CORE_EXTERNAL_URL'`. This is a distinct environment variable from `DIAL_CORE_URL` (the existing internal-only DIAL Core base URL used for server-to-server calls); `DIAL_CORE_URL` SHALL NOT be added to the registry and SHALL NOT become client-visible through this or any other entry.

The registry SHALL include a `features.responsesApiEnabled` entry: `type='feature'`, `valueType='boolean'`, `visibility='server'`, `defaultValue=false`, `critical=false`, `envVar='RESPONSES_API_ENABLED'`, and no `allowedRolesEnvVar` (role-based rollout via `RESPONSES_API_ENABLED_ROLES` is explicitly out of scope for this entry). This flag SHALL NOT be included in `AppConfigService.getClientConfig`'s response under any circumstance, by virtue of its `visibility='server'` classification — the same mechanism that already excludes `features.llmConversationNaming`.

The registry SHALL include a `features.responsesBackgroundEnabled` entry: `type='feature'`, `valueType='boolean'`, `visibility='server'`, `defaultValue=false`, `critical=false`, `envVar='RESPONSES_BACKGROUND_ENABLED'`, and no `allowedRolesEnvVar`. It SHALL NOT be included in `AppConfigService.getClientConfig`'s response under any circumstance. Its description SHALL state that it only affects how new generations start and that in-flight background jobs remain recoverable when it is disabled.

**Feature flag:** Not gated. The registry entries themselves have no user-visible flag; they declare the `features.responsesApiEnabled` and `features.responsesBackgroundEnabled` keys consumed elsewhere.

**RTL impact:** None.

**i18n impact:** None.

#### Scenario: Registry contains ASR model key

- **WHEN** the registry is imported
- **THEN** it MUST contain an entry with `key='asr.modelId'`, `type='config'`, `valueType='string'`, `visibility='client'`, `envVar='ASR_MODEL'`, and `defaultValue=null`

#### Scenario: Registry contains transcribe size limit key

- **WHEN** the registry is imported
- **THEN** it MUST contain an entry with `key='asr.transcribeSizeLimitBytes'`, `type='config'`, `valueType='number'`, `visibility='client'`, `envVar='TRANSCRIBE_SIZE_LIMIT_BYTES'`, and `defaultValue=5242880`

#### Scenario: Registry contains asrEnabled feature key

- **WHEN** the registry is imported
- **THEN** it MUST contain an entry with `key='features.asrEnabled'`, `type='feature'`, `valueType='boolean'`, `visibility='client'`, `critical=false`, and no direct `envVar` (derived from `ASR_MODEL` presence)

#### Scenario: Registry contains dialCore.externalUrl key

- **WHEN** the registry is imported
- **THEN** it MUST contain an entry with `key='dialCore.externalUrl'`, `type='config'`, `valueType='string'`, `visibility='client'`, `envVar='DIAL_CORE_EXTERNAL_URL'`, and `defaultValue=null`

#### Scenario: DIAL_CORE_URL is never registered as a client-visible key

- **WHEN** the registry is imported
- **THEN** no entry has `envVar='DIAL_CORE_URL'`

#### Scenario: Registry contains the responsesApiEnabled feature key with server-only visibility

- **WHEN** the registry is imported
- **THEN** it MUST contain an entry with `key='features.responsesApiEnabled'`, `type='feature'`, `valueType='boolean'`, `visibility='server'`, `critical=false`, `envVar='RESPONSES_API_ENABLED'`, `defaultValue=false`, and no `allowedRolesEnvVar`

#### Scenario: responsesApiEnabled is excluded from the client-config response

- **WHEN** `AppConfigService.getClientConfig(context)` is called, in any state of `RESPONSES_API_ENABLED`
- **THEN** the returned DTO's `features` map does not contain a `responsesApiEnabled` (or `features.responsesApiEnabled`) key

#### Scenario: Registry contains the responsesBackgroundEnabled feature key with server-only visibility

- **WHEN** the registry is imported
- **THEN** it MUST contain an entry with `key='features.responsesBackgroundEnabled'`, `type='feature'`, `valueType='boolean'`, `visibility='server'`, `critical=false`, `envVar='RESPONSES_BACKGROUND_ENABLED'`, `defaultValue=false`, and no `allowedRolesEnvVar`

#### Scenario: responsesBackgroundEnabled is excluded from the client-config response

- **WHEN** `AppConfigService.getClientConfig(context)` is called, in any state of `RESPONSES_BACKGROUND_ENABLED`
- **THEN** the returned DTO's `features` map does not contain a `responsesBackgroundEnabled` (or `features.responsesBackgroundEnabled`) key

#### Scenario: Every registry entry is classified

- **WHEN** the registry is imported
- **THEN** every entry is exactly one of managed, local-only, or eligible but unmanaged, and no entry has both `managed: true` and `localOnly`

#### Scenario: Marking a key managed does not change its resolved value

- **WHEN** a key is marked `managed: true` and `getClientConfig` or `isEnabled` is evaluated with the same environment and roles as before
- **THEN** the returned value equals the value returned while the key was unmanaged

### Requirement: EnvConfigProvider resolves values from ConfigService

`EnvConfigProvider` SHALL read values from `ConfigService<EnvironmentVariables>` (never from `process.env` directly) using the `envVar` field from the matching `ConfigDefinition`.

`EnvConfigProvider` SHALL return a value from a key's `envVar` (or read its `allowedRolesEnvVar`) only when that variable is explicitly present in the deployment environment. A value that exists only because the environment class declares a typed default (for example `SCHEDULED_TASKS_ENABLED = false`, `USAGE_LIMITS_WARNING_THRESHOLD_PERCENT = 75`, `UI_EVENT_ENABLED_BY_DEFAULT = true`) SHALL NOT be treated as explicit; the provider SHALL return `undefined` so that the next provider applies. Explicit presence SHALL be determined from the raw environment input (process variables and loaded `.env` files) before class defaults are applied; a variable set to the empty string is present. Derived feature keys (`features.asrEnabled`, `features.llmConversationNaming`, `features.footer`) keep their documented derivations.

For `type='feature'` keys derived from a config key (e.g. `features.asrEnabled` derived from `asr.modelId`), the provider SHALL apply the derivation logic declared in the registry.

Type coercion MUST NOT be performed — `ConfigService` already returns typed values via the validated `EnvironmentVariables` schema.

**Cache:** None at the provider level — `ConfigService` values are boot-time constants. Caching is applied by `AppConfigService` at the service level.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Env var present returns typed value

- **WHEN** `ASR_MODEL=whisper-1` is set in the environment and `EnvConfigProvider.resolve('asr.modelId', ctx)` is called
- **THEN** it returns `'whisper-1'`

#### Scenario: Features.asrEnabled is true when ASR_MODEL is set

- **WHEN** `ASR_MODEL=whisper-1` is set and `EnvConfigProvider.resolve('features.asrEnabled', ctx)` is called
- **THEN** it returns `true`

#### Scenario: Features.asrEnabled is undefined when ASR_MODEL is absent

- **WHEN** `ASR_MODEL` is not set and `EnvConfigProvider.resolve('features.asrEnabled', ctx)` is called
- **THEN** it returns `undefined` (falls through to StaticDefaultsProvider which returns `false`)

---

#### Scenario: A typed default is not an explicit value

- **WHEN** `SCHEDULED_TASKS_ENABLED` is absent from the environment and `EnvConfigProvider.resolve('features.scheduledTasksEnabled', ctx)` is called
- **THEN** it returns `undefined`, and `AppConfigService.isEnabled` still returns `false` through the registry default

#### Scenario: An explicit value equal to the default is explicit

- **WHEN** `USAGE_LIMITS_WARNING_THRESHOLD_PERCENT=75` is set explicitly
- **THEN** `EnvConfigProvider.resolve('usageLimits.warningThresholdPercent', ctx)` returns `75`

#### Scenario: Variables from a .env file count as explicit

- **WHEN** `PROJECTS_ENABLED=true` is supplied only through a loaded `.env` file
- **THEN** it is treated as explicitly present exactly as a process variable would be

#### Scenario: Effective values are unchanged for unset variables

- **WHEN** every registry key whose environment variable declares a typed default is resolved with that variable absent
- **THEN** the client-config response and every `FeatureFlagsService.isEnabled` result equal the values produced before explicit presence was introduced

## ADDED Requirements

### Requirement: Deployment role gates apply after value selection

The allowed-roles restriction of a feature (`allowedRolesEnvVar`) SHALL be applied once, after a value has been selected from the provider chain, for every resolution path of `AppConfigService` (`getClientConfig`, `isEnabled`, `resolveValue`). When the allowed-roles variable is explicitly present and non-empty and the caller has none of the listed roles, the effective value SHALL be `false`. When it is absent or empty, the selected value SHALL be returned unchanged. The gate SHALL be conjunctive: no provider can bypass it by returning `true`. For every combination of environment and roles supported today, effective feature values SHALL equal the values produced when the gate lived inside `EnvConfigProvider`.

**Feature flag:** Applies to `features.asrEnabled` (`ASR_ENABLED_ROLES`), `features.liveChatInteraction` (`LIVE_CHAT_INTERACTION_ENABLED_ROLES`), `features.scheduledTasksEnabled` (`SCHEDULED_TASKS_ENABLED_ROLES`) and `features.projectsEnabled` (`PROJECTS_ENABLED_ROLES`). **RTL impact:** None. **i18n impact:** None. **Cache:** Unchanged — `app-config:client:<appId>:user:<userId>:roles:<roles>`, 60 s TTL.

#### Scenario: Restricted user is gated off

- **WHEN** `SCHEDULED_TASKS_ENABLED=true` and `SCHEDULED_TASKS_ENABLED_ROLES=beta` and the caller has roles `['staff']`
- **THEN** `isEnabled('features.scheduledTasksEnabled')` returns `false` and the client-config `features.scheduledTasksEnabled` is `false`

#### Scenario: Allowed user keeps the selected value

- **WHEN** the same environment applies and the caller has roles `['beta']`
- **THEN** both results are `true`

#### Scenario: Anonymous caller with a role restriction

- **WHEN** a role restriction is configured and the request has no session
- **THEN** the effective value is `false`

#### Scenario: No restriction configured

- **WHEN** `SCHEDULED_TASKS_ENABLED_ROLES` is absent
- **THEN** the selected value is returned for every caller

### Requirement: Environment admission, capability and policy are separate from shared normalization

Resolving a key SHALL proceed through distinct stages: source admission (parsing and admitting a raw environment value with the key's existing fail-open rules), selection by the provider chain, shared normalization (the client-config mapping stage: sanitizers, trimming, caps and allow-lists that run on the selected value whatever its source), capability checks, and policy (deployment role gates). The environment-specific parsing currently inside `EnvConfigProvider` (announcements, custom client variables, custom and application visualizers, file-manager tabs, publication filter sources, content locales) SHALL be pure functions independent of `ConfigService`, so that another source can reuse normalization without environment parsing. Capability rules (`ASR_MODEL` for ASR; `UTILITY_MODEL`, `DIAL_API_KEY` and `LLM_CONVERSATION_NAMING_ENABLED` for conversation naming; `FOOTER_HTML_MESSAGE` for the footer) SHALL be expressed as pure checks that return the same results as today. Environment admission SHALL keep today's behavior, including dropping malformed entries with a warning, and SHALL NOT apply managed-contract bounds.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Existing parser behavior is preserved

- **WHEN** the characterization matrices for each special parser (valid, malformed, empty and absent input) are run after the extraction
- **THEN** every resolved value and every emitted warning text equals the result recorded before the extraction

#### Scenario: Environment values are not bounded by managed constraints

- **WHEN** `ANNOUNCEMENT_TITLE` holds a 300-character title
- **THEN** the client-config `announcementTitle` is that title, as before this change

#### Scenario: Capability checks are unchanged

- **WHEN** `ASR_MODEL` is absent
- **THEN** `features.asrEnabled` is `false` for every caller, and when `ASR_MODEL` is set and no role restriction applies it is `true`
