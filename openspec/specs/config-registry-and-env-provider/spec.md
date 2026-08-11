## ADDED Requirements

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
  expiresAt?: string;
}
```

Every key with `visibility='client'` MUST have a `defaultValue` that is safe to expose publicly. Keys with `visibility='server'` MUST NOT appear in the client-config response.

The registry SHALL include a `dialCore.externalUrl` entry: `type='config'`, `valueType='string'`, `visibility='client'`, `defaultValue=null`, `critical=false`, `envVar='DIAL_CORE_EXTERNAL_URL'`. This is a distinct environment variable from `DIAL_CORE_URL` (the existing internal-only DIAL Core base URL used for server-to-server calls); `DIAL_CORE_URL` SHALL NOT be added to the registry and SHALL NOT become client-visible through this or any other entry.

**Feature flag:** Not gated. The registry is a backend implementation detail with no user-visible flag.

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

---

### Requirement: AppConfigEvalContext carries resolution context

The system SHALL define `AppConfigEvalContext` in `apps/chat-api/src/app-config/app-config.types.ts`:

```typescript
interface AppConfigEvalContext {
  appId: string;
  userId?: string;
  roles?: string[];
  environment?: string;
}
```

Context fields MUST NOT be serialized into the client response. Providers receive the full context but MAY ignore user-specific fields in the first slice.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Context is built from appId

- **WHEN** the controller receives `?appId=chat-ui`
- **THEN** an `AppConfigEvalContext` with `appId='chat-ui'` and `environment=NODE_ENV` is constructed and passed to `AppConfigService`

#### Scenario: Context does not appear in response

- **WHEN** the client-config response is serialized
- **THEN** it MUST NOT contain `userId`, `roles`, or `environment` fields

---

### Requirement: ConfigProvider interface is implemented by all providers

The system SHALL define a `ConfigProvider` interface:

```typescript
interface ConfigProvider {
  resolve(key: string, context: AppConfigEvalContext): Promise<unknown | undefined>;
}
```

All providers MUST implement this interface. Providers MUST return `undefined` when they do not have a value for the key (not `null`, not throw).

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Provider returns undefined for unknown key

- **WHEN** `EnvConfigProvider.resolve('unknown.key', context)` is called
- **THEN** it returns `undefined` without throwing

#### Scenario: Provider returns undefined when env var absent

- **WHEN** `EnvConfigProvider.resolve('asr.modelId', context)` is called and `ASR_MODEL` is not set
- **THEN** it returns `undefined`

---

### Requirement: EnvConfigProvider resolves values from ConfigService

`EnvConfigProvider` SHALL read values from `ConfigService<EnvironmentVariables>` (never from `process.env` directly) using the `envVar` field from the matching `ConfigDefinition`.

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

### Requirement: StaticDefaultsProvider returns the registry defaultValue

`StaticDefaultsProvider` SHALL look up the `ConfigDefinition` for the given key and return its `defaultValue`. If the key is not in the registry, it MUST return `undefined`.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Returns defaultValue for known key

- **WHEN** `StaticDefaultsProvider.resolve('asr.transcribeSizeLimitBytes', ctx)` is called
- **THEN** it returns `5242880`

#### Scenario: Returns undefined for unknown key

- **WHEN** `StaticDefaultsProvider.resolve('not.a.key', ctx)` is called
- **THEN** it returns `undefined`

---

### Requirement: CompositeConfigProvider iterates providers in priority order

`CompositeConfigProvider` SHALL accept an injected array of `ConfigProvider` instances and iterate them in index order (0 = highest priority) calling `resolve(key, context)`. It SHALL return the first non-`undefined` value. If all providers return `undefined`, it SHALL return `undefined`.

On provider error: log warning, skip to next provider. For keys with `critical=true`, log at `error` level instead.

**Observability:** Log at `debug` level for each resolution: key name, provider class name that resolved it, and resolution outcome (resolved / fallthrough / error). MUST NOT log the resolved value itself.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: First provider wins

- **WHEN** `EnvConfigProvider` returns a value for a key
- **THEN** `StaticDefaultsProvider.resolve` is NOT called for that key

#### Scenario: Falls through when first provider returns undefined

- **WHEN** `EnvConfigProvider` returns `undefined` for `'asr.transcribeSizeLimitBytes'`
- **THEN** `CompositeConfigProvider` calls `StaticDefaultsProvider.resolve` and returns `5242880`

#### Scenario: Provider error is caught and next provider is tried

- **WHEN** `EnvConfigProvider.resolve` throws an unexpected error
- **THEN** `CompositeConfigProvider` logs a warning, does NOT rethrow, and calls `StaticDefaultsProvider.resolve`

#### Scenario: Critical key provider error logs at error level

- **WHEN** a provider throws for a key with `critical=true`
- **THEN** `CompositeConfigProvider` logs at `error` level (not `warn`) and continues to the next provider

---

### Requirement: Type mismatch falls through to next provider

When `EnvConfigProvider` reads an env var whose parsed value does not match `definition.valueType` (e.g. `TRANSCRIBE_SIZE_LIMIT_BYTES` is `NaN` after `parseInt`), it MUST log a warning including the key name and return `undefined` so the next provider can supply a safe default.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Non-numeric TRANSCRIBE_SIZE_LIMIT_BYTES falls through

- **WHEN** `TRANSCRIBE_SIZE_LIMIT_BYTES=not-a-number` is set and `EnvConfigProvider.resolve('asr.transcribeSizeLimitBytes', ctx)` is called
- **THEN** the provider logs a warning and returns `undefined`
- **AND** `CompositeConfigProvider` falls through to `StaticDefaultsProvider` and returns `5242880`

---

### Requirement: Registry declares the announcement.html key

The `CONFIG_DEFINITIONS` registry SHALL include an `announcement.html` entry so the operator-set announcement message is resolvable and client-visible. The entry SHALL be `type='config'`, `valueType='string'`, `visibility='client'`, `defaultValue=null`, `critical=false`, and `envVar='ANNOUNCEMENT_HTML_MESSAGE'`. The backing environment variable `ANNOUNCEMENT_HTML_MESSAGE` SHALL be declared as an optional string in `EnvironmentVariables` (a missing value is valid and resolves to the `null` default). No custom provider branch is required — the value SHALL resolve through the generic environment-variable path.

#### Scenario: Registry contains the announcement.html key

- **WHEN** the registry is imported
- **THEN** it MUST contain an entry with `key='announcement.html'`, `type='config'`, `valueType='string'`, `visibility='client'`, `envVar='ANNOUNCEMENT_HTML_MESSAGE'`, and `defaultValue=null`

#### Scenario: Announcement message resolves from the environment variable

- **WHEN** `ANNOUNCEMENT_HTML_MESSAGE` is set to a non-empty string
- **THEN** resolving `announcement.html` returns that string

#### Scenario: Announcement message defaults to null when unset

- **WHEN** `ANNOUNCEMENT_HTML_MESSAGE` is not set
- **THEN** resolving `announcement.html` returns `null` and startup validation does not fail

---

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

---

### Requirement: Registry declares the customVisualizers key

The `CONFIG_DEFINITIONS` registry (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`) SHALL include a new entry:

- `key='customVisualizers'`
- `type='config'`
- `valueType='json'`
- `visibility='client'`
- `defaultValue=[]`
- `critical=false`
- `envVar='CUSTOM_VISUALIZERS'`
- `description` — human-readable summary of the visualizer registry semantics.
- `owner` — matches the ownership convention used by other registry entries.

The parsed value type MUST be `CustomVisualizer[]` (see `custom-visualizers` capability). Elements that fail per-entry validation SHALL be dropped with an error log at boot; total parse failure SHALL yield `[]`.

**Feature flag:** none. The registry entry is a backend implementation detail.

#### Scenario: Registry contains customVisualizers key

- **WHEN** the registry is imported
- **THEN** it MUST contain an entry with `key='customVisualizers'`, `type='config'`, `valueType='json'`, `visibility='client'`, `envVar='CUSTOM_VISUALIZERS'`, and `defaultValue=[]`

#### Scenario: Env resolves to parsed array

- **WHEN** `CUSTOM_VISUALIZERS='[{"contentType":"application/x-my-viz","url":"https://viz.example.com"}]'` and the config is resolved
- **THEN** the `customVisualizers` value on the resolved config equals `[{ contentType: 'application/x-my-viz', url: 'https://viz.example.com' }]`

#### Scenario: Missing env falls back to default

- **WHEN** `CUSTOM_VISUALIZERS` is unset
- **THEN** the `customVisualizers` value on the resolved config equals `[]`

---

### Requirement: Registry declares the publish.publicationFilterSources key

`CONFIG_DEFINITIONS` (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`) SHALL include a new entry:

- `key='publish.publicationFilterSources'`
- `type='config'`
- `valueType='json'`
- `visibility='client'`
- `defaultValue=['title', 'role', 'dial_roles']`
- `critical=false`
- `envVar='PUBLICATION_FILTER_SOURCES'`
- `description` — summarizes that this is the allowed set of claim/category names selectable as a publication access rule's `source`.
- `owner` — matches the ownership convention used by other registry entries (`'chat-team'`).

This follows the exact pattern of the existing `customVisualizers` and `uiFeatures.enabledUiFeatures` entries: a `valueType='json'` array resolved from a comma-separated environment variable, with a non-empty compiled-in default so the feature (the access-rules source picker) is always usable even when the operator has not configured anything.

**Feature flag:** Not gated. The registry entry is a backend implementation detail with no user-visible feature flag of its own — the rules editor UI is always shown (see `publish-access-rules-editor`), and this key only controls the *content* of its source list.

**RTL impact:** None. **i18n impact:** None (raw claim/category strings, not localized labels — see design.md's Open Questions).

#### Scenario: Registry contains the publish.publicationFilterSources key

- **WHEN** the registry is imported
- **THEN** it MUST contain an entry with `key='publish.publicationFilterSources'`, `type='config'`, `valueType='json'`, `visibility='client'`, `envVar='PUBLICATION_FILTER_SOURCES'`, and `defaultValue=['title', 'role', 'dial_roles']`

#### Scenario: Env resolves to a parsed, trimmed array

- **WHEN** `PUBLICATION_FILTER_SOURCES=roles, department , title` is set and the config is resolved
- **THEN** the resolved value is `['roles', 'department', 'title']` (trimmed, comma-separated)

#### Scenario: Missing env falls back to the product default

- **WHEN** `PUBLICATION_FILTER_SOURCES` is unset
- **THEN** the resolved value is `['title', 'role', 'dial_roles']`

#### Scenario: Empty env value falls back to the default, not an empty list

- **WHEN** `PUBLICATION_FILTER_SOURCES` is set to an empty string
- **THEN** the resolved value is `['title', 'role', 'dial_roles']`, not `[]` — an empty source list would make the access-rules source picker unusable, the same footgun already prevented for `uiFeatures.enabledUiFeatures`

#### Scenario: Oversized source fails environment validation

- **WHEN** any comma-separated `PUBLICATION_FILTER_SOURCES` entry is longer than 200 characters after trimming
- **THEN** environment validation fails at application startup instead of exposing the oversized value through client config

---

### Requirement: Registry declares the announcement.title key

The `CONFIG_DEFINITIONS` registry SHALL include an `announcement.title` entry so the operator-set announcement heading is resolvable and client-visible. The entry SHALL be `type='config'`, `valueType='string'`, `visibility='client'`, `defaultValue=null`, `critical=false`, and `envVar='ANNOUNCEMENT_TITLE'`. The backing environment variable `ANNOUNCEMENT_TITLE` SHALL be declared as an optional string in `EnvironmentVariables` (a missing value is valid and resolves to the `null` default). No custom provider branch is required — the value SHALL resolve through the generic environment-variable path.

#### Scenario: Registry contains the announcement.title key

- **WHEN** `CONFIG_DEFINITIONS` is inspected
- **THEN** it MUST contain an entry with `key='announcement.title'`, `type='config'`, `valueType='string'`, `visibility='client'`, `envVar='ANNOUNCEMENT_TITLE'`, and `defaultValue=null`

#### Scenario: Announcement title resolves from the environment variable

- **WHEN** `ANNOUNCEMENT_TITLE` is set to `🎉 Welcome to DIAL! 🎉`
- **THEN** resolving `announcement.title` returns that exact string, emoji included

#### Scenario: Announcement title defaults to null when unset

- **WHEN** `ANNOUNCEMENT_TITLE` is not set
- **THEN** resolving `announcement.title` returns `null` and startup validation does not fail

---

### Requirement: Registry declares the announcement.description key

The `CONFIG_DEFINITIONS` registry SHALL include an `announcement.description` entry so the operator-set announcement body copy is resolvable and client-visible. The entry SHALL be `type='config'`, `valueType='string'`, `visibility='client'`, `defaultValue=null`, `critical=false`, and `envVar='ANNOUNCEMENT_DESCRIPTION'`. The backing environment variable `ANNOUNCEMENT_DESCRIPTION` SHALL be declared as an optional string in `EnvironmentVariables`.

The registry SHALL resolve the raw value through the generic environment-variable path; sanitization of the resolved HTML is the responsibility of the `client-config-endpoint` capability, not the registry.

#### Scenario: Registry contains the announcement.description key

- **WHEN** `CONFIG_DEFINITIONS` is inspected
- **THEN** it MUST contain an entry with `key='announcement.description'`, `type='config'`, `valueType='string'`, `visibility='client'`, `envVar='ANNOUNCEMENT_DESCRIPTION'`, and `defaultValue=null`

#### Scenario: Announcement description resolves from the environment variable

- **WHEN** `ANNOUNCEMENT_DESCRIPTION` is set to a non-empty string
- **THEN** resolving `announcement.description` returns that string unmodified, with sanitization applied downstream

#### Scenario: Announcement description defaults to null when unset

- **WHEN** `ANNOUNCEMENT_DESCRIPTION` is not set
- **THEN** resolving `announcement.description` returns `null` and startup validation does not fail

---

### Requirement: Registry declares the announcement.items key

The `CONFIG_DEFINITIONS` registry SHALL include an `announcement.items` entry so the operator-set announcements list is resolvable and client-visible. The entry SHALL be `type='config'`, `valueType='json'`, `visibility='client'`, `defaultValue=[]`, `critical=false`, and `envVar='ANNOUNCEMENTS'`. The backing environment variable `ANNOUNCEMENTS` SHALL be declared as an optional string in `EnvironmentVariables`.

The environment provider SHALL parse the `ANNOUNCEMENTS` string into an array before returning it. The generic environment-variable path SHALL NOT be relied on for this key: it performs no type coercion for `valueType='json'` and would hand the raw string downstream, where an `Array.isArray` guard silently resolves it to an empty list. A dedicated parse branch is required, as for `customVisualizers`.

Malformed JSON in `ANNOUNCEMENTS` SHALL NOT fail application startup or environment validation: resolution SHALL fall back to the empty-array default. Entry-level validation and sanitization are the responsibility of the `client-config-endpoint` capability.

#### Scenario: Registry contains the announcement.items key

- **WHEN** `CONFIG_DEFINITIONS` is inspected
- **THEN** it MUST contain an entry with `key='announcement.items'`, `type='config'`, `valueType='json'`, `visibility='client'`, `envVar='ANNOUNCEMENTS'`, and `defaultValue=[]`

#### Scenario: Announcements resolve from valid JSON

- **WHEN** `ANNOUNCEMENTS` is set to `[{"title":"Upgraded to DIAL 1.43","link":{"label":"Changelog","href":"https://dialx.ai"}}]`
- **THEN** resolving `announcement.items` returns an array with one entry carrying that title and link

#### Scenario: The resolved value is an array, not the raw string

- **WHEN** `ANNOUNCEMENTS` holds any valid JSON array
- **THEN** `Array.isArray` of the resolved value is `true`, so downstream array guards do not silently discard it

#### Scenario: Malformed announcements JSON does not fail startup

- **WHEN** `ANNOUNCEMENTS` is set to `not-json`
- **THEN** startup validation does not fail and resolving `announcement.items` returns `[]`

#### Scenario: Announcements default to an empty array when unset

- **WHEN** `ANNOUNCEMENTS` is not set
- **THEN** resolving `announcement.items` returns `[]`
