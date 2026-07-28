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
