## MODIFIED Requirements

### Requirement: EnvConfigProvider resolves values from ConfigService

`EnvConfigProvider` SHALL read values from `ConfigService<EnvironmentVariables>` (never from `process.env` directly) using the `envVar` field from the matching `ConfigDefinition`.

`EnvConfigProvider` SHALL return a value from a key's `envVar` only when that variable is explicitly present in the deployment environment. A value that exists only because the environment class declares a typed default (for example `SCHEDULED_TASKS_ENABLED = false`, `USAGE_LIMITS_WARNING_THRESHOLD_PERCENT = 75`, `UI_EVENT_ENABLED_BY_DEFAULT = true`) SHALL NOT be treated as explicit; the provider SHALL return `undefined` so that the next provider applies. Explicit presence SHALL be determined from the raw environment input (process variables and loaded `.env` files) before class defaults are applied; a variable set to the empty string is present. For a managed key, an explicit string value that is empty or whitespace-only SHALL resolve to `undefined`: the client mapping hides blank and null alike, so the effective value is unchanged, and a blank variable cannot shadow a lower-priority source. Schema 1.0.0 manages no string key, so this rule applies to no key of 1.0.0; a blank text of an unmanaged key resolves to `''`, and its client-config field is `null` either way. Derived feature keys (`features.asrEnabled`, `features.llmConversationNaming`, `features.footer`) keep their documented derivations.

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

- **WHEN** the variable of a managed string key is set to the empty string or to spaces
- **THEN** `EnvConfigProvider.resolve` returns `undefined` for that key, while a blank `ANNOUNCEMENT_TITLE`, unmanaged in 1.0.0, resolves to `''` and the client-config `announcementTitle` is `null` as before

#### Scenario: Effective values are unchanged for unset variables

- **WHEN** every registry key whose environment variable declares a typed default is resolved with that variable absent
- **THEN** the client-config response and every `FeatureFlagsService.isEnabled` result equal the values produced before explicit presence was introduced


### Requirement: Environment admission, capability and policy are separate from shared normalization

Resolving a key SHALL proceed through distinct stages: source admission (parsing and admitting a raw environment value with the key's existing fail-open rules), selection by the provider chain, shared normalization (the client-config mapping stage: sanitizers, trimming, caps and allow-lists that run on the selected value whatever its source), capability checks, and policy (deployment role gates). The environment-specific parsing currently inside `EnvConfigProvider` (announcements, custom client variables, custom and application visualizers, file-manager tabs, publication filter sources, content locales) SHALL be pure functions independent of `ConfigService`, so that another source can reuse normalization without environment parsing. Capability rules (`ASR_MODEL` for ASR; `UTILITY_MODEL`, `DIAL_API_KEY` and `LLM_CONVERSATION_NAMING_ENABLED` for conversation naming; `FOOTER_HTML_MESSAGE` for the footer) SHALL be expressed as pure checks that return the same results as today. Environment admission SHALL keep today's behavior, including dropping malformed entries with a warning, and SHALL NOT apply managed-contract bounds.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Existing parser behavior is preserved

- **WHEN** the characterization matrices for each special parser (valid, malformed, empty and absent input) are run after the extraction
- **THEN** every resolved value and every emitted warning text equals the result recorded before the extraction

#### Scenario: Environment values are not bounded by managed constraints

- **WHEN** `ONBOARDING_HINTS` holds 60 hints with 300-character titles and 800-character descriptions
- **THEN** the client-config `onboardingHints` holds all 60 hints unchanged, although a published tour is limited to 50 hints, 100-character titles and 500-character descriptions

#### Scenario: Capability checks are unchanged

- **WHEN** `ASR_MODEL` is absent
- **THEN** `features.asrEnabled` is `false` for every caller, and when `ASR_MODEL` is set and no role restriction applies it is `true`


### Requirement: Managed source sits between explicit environment and the registry default

`CompositeConfigProvider` SHALL resolve in this order: `EnvConfigProvider`, a managed provider, then `StaticDefaultsProvider`. The managed provider SHALL return a value only when all of the following hold:

- `MANAGED_CONFIG_MODE` is `active`;
- the key is listed in `MANAGED_CONFIG_ACTIVE_KEYS`;
- the context's captured `managed` view is usable;
- the captured payload has a member for the key.

The value it returns SHALL be the member's value for a configuration key, or the member's `enabled` for a feature. Otherwise it SHALL return `undefined`. It SHALL NOT read the environment, call Core, or use any snapshot other than the captured one. Because `EnvConfigProvider` returns a value only for an explicitly present variable, the selected value is explicit environment → managed → registry default. The existing per-provider error handling SHALL apply: a managed provider error falls through to the registry default and is logged without values. Feature policy beyond the enabled bit is applied after selection (`managed-config-activation`).

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Managed value is selected when the environment is silent

- **WHEN** `onboarding.hints` is active, `ONBOARDING_HINTS` is not set, and the captured fresh payload sets a tour
- **THEN** `CompositeConfigProvider.resolve` returns that tour

#### Scenario: Typed default does not shadow the managed value

- **WHEN** a feature variable holds only its typed class default and the captured payload sets `enabled: true`
- **THEN** the selected enabled bit is `true`

#### Scenario: Managed provider is silent outside active mode

- **WHEN** the mode is `shadow`
- **THEN** the managed provider returns `undefined` for every key

