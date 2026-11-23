## MODIFIED Requirements

### Requirement: EnvConfigProvider resolves values from ConfigService

`EnvConfigProvider` SHALL read values from `ConfigService<EnvironmentVariables>` (never from `process.env` directly) using the `envVar` field from the matching `ConfigDefinition`.

`EnvConfigProvider` SHALL return a value from a key's `envVar` only when that variable is explicitly present in the deployment environment. A value that exists only because the environment class declares a typed default (for example `SCHEDULED_TASKS_ENABLED = false`, `USAGE_LIMITS_WARNING_THRESHOLD_PERCENT = 75`, `UI_EVENT_ENABLED_BY_DEFAULT = true`) SHALL NOT be treated as explicit; the provider SHALL return `undefined` so that the next provider applies. Explicit presence SHALL be determined from the raw environment input (process variables and loaded `.env` files) before class defaults are applied; a variable set to the empty string is present. For a managed key, an explicit string value that is empty or whitespace-only SHALL resolve to `undefined`: the client mapping hides blank and null alike, so the effective value is unchanged, and a blank variable cannot shadow a lower-priority source. From schema 1.1.0 this rule applies to `announcement.title` and `announcement.description`; the celebration variables already reject or drop a blank value during environment validation. A blank text of an unmanaged key resolves to `''`, and its client-config field is `null` either way. Derived feature keys (`features.asrEnabled`, `features.llmConversationNaming`, `features.footer`) keep their documented derivations.

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

#### Scenario: A blank managed text is not an operator value

- **WHEN** `ANNOUNCEMENT_TITLE`, `ANNOUNCEMENT_DESCRIPTION` or `WELCOME_SCREEN_DESCRIPTION` is set to the empty string or to spaces
- **THEN** `EnvConfigProvider.resolve` returns `undefined` for that key, so a published value can apply, and with nothing published the client-config `announcementTitle`, `announcementDescription` or `welcomeScreenDescription` is `null` as before

#### Scenario: A blank unmanaged text is unchanged

- **WHEN** `MCP_APP_USER_AGENT`, unmanaged in 1.2.0, is set to spaces
- **THEN** `EnvConfigProvider.resolve('mcpApps.userAgent', ctx)` returns the spaces

#### Scenario: A typed delivery default does not shadow a published policy

- **WHEN** none of the `UI_EVENT_DELIVERY_*` or `UI_EVENT_EXTERNAL_*` variables is set
- **THEN** `EnvConfigProvider.resolve` returns `undefined` for each of the four `ui.celebrationDelivery.*` keys, although their class defaults are `bundled`, `"0"` and empty lists

#### Scenario: Effective values are unchanged for unset variables

- **WHEN** every registry key whose environment variable declares a typed default is resolved with that variable absent
- **THEN** the client-config response and every `FeatureFlagsService.isEnabled` result equal the values produced before explicit presence was introduced

#### Scenario: A typed usage default does not shadow a published value

- **WHEN** neither `USAGE_LIMITS_WARNING_THRESHOLD_PERCENT`, `SPENDING_LIMITS_MODE` nor `USAGE_LIMITS_CONTROL_ENABLED` is set
- **THEN** `EnvConfigProvider.resolve` returns `undefined` for `usageLimits.warningThresholdPercent`, `usageLimits.spendingLimitsMode` and `features.usageLimitsControl`, although their class defaults are `75`, `off` and `false`
