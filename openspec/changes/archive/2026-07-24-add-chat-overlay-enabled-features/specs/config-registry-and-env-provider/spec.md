## ADDED Requirements

### Requirement: Registry contains the uiFeatures.enabledUiFeatures key

`CONFIG_DEFINITIONS` (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`) SHALL include an entry with `key='uiFeatures.enabledUiFeatures'`, `type='config'`, `valueType='json'`, `visibility='client'`, `defaultValue=null`, `critical=false`, `envVar='ENABLED_UI_FEATURES'`. This key is deliberately namespaced `uiFeatures.*` to avoid collision with the pre-existing `features.*` boolean capability flags (`features.asrEnabled`, `features.liveChatInteraction`), which this key does not affect.

**Feature flag:** Not gated. The registry is a backend implementation detail with no user-visible flag.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Registry contains the enabledUiFeatures key

- **WHEN** the registry is imported
- **THEN** it MUST contain an entry with `key='uiFeatures.enabledUiFeatures'`, `type='config'`, `valueType='json'`, `visibility='client'`, `envVar='ENABLED_UI_FEATURES'`, and `defaultValue=null`

### Requirement: EnvConfigProvider resolves ENABLED_UI_FEATURES as a trimmed string array or null

`EnvironmentVariables.ENABLED_UI_FEATURES` SHALL be declared `string[] | null`, optional, defaulting to `null`, parsed with a comma-separated-list `@Transform` that trims entries, filters empty strings, and returns `null` when the value is absent, empty, or produces an empty array — so the compiled-in `DEFAULT_ENABLED_UI_FEATURES` baseline is used unless the operator explicitly provides a non-empty list. Validated with `@IsString({ each: true })` — no enum-membership validation at this layer, so new `OverlayFeature` values never require an env-schema change.

**Cache:** None at the provider level — `ConfigService` values are boot-time constants, matching every other `EnvConfigProvider`-resolved key.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Comma-separated env var parses to a trimmed array

- **WHEN** `ENABLED_UI_FEATURES=header, likes ` is set
- **THEN** `EnvConfigProvider.resolve('uiFeatures.enabledUiFeatures', ctx)` returns `['header', 'likes']`

#### Scenario: Unset env var resolves to null

- **WHEN** `ENABLED_UI_FEATURES` is not set
- **THEN** `EnvConfigProvider.resolve('uiFeatures.enabledUiFeatures', ctx)` returns `null`, and the compiled-in `DEFAULT_ENABLED_UI_FEATURES` baseline is used

### Requirement: Unrecognized entries are filtered with a warning at the service layer, not at env validation

`AppConfigService.getClientConfig` SHALL filter the resolved `uiFeatures.enabledUiFeatures` list to values that are members of the shared `OverlayFeature` enum before including it in the response, logging a `warn`-level message (naming the unrecognized value) for each entry dropped. When all entries are unrecognized, the service SHALL log an additional warning and return `null` (falling back to compiled-in defaults), rather than sending an empty array that would break the entire UI. This filtering SHALL NOT cause application boot to fail and SHALL NOT reject the request — the response always returns `200 OK`.

#### Scenario: Unrecognized entry is dropped and logged

- **WHEN** `ENABLED_UI_FEATURES=header,not-a-real-feature` is set
- **THEN** `config.enabledUiFeatures` in the client-config response is `['header']`, and a warning naming `'not-a-real-feature'` is logged

#### Scenario: All-unrecognized input falls back to null, not an empty list

- **WHEN** `ENABLED_UI_FEATURES=totally-invalid` is set
- **THEN** the response is still `200 OK` with `config.enabledUiFeatures: null` (compiled-in defaults are used), and a warning is logged
