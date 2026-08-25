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
}
```

Every key with `visibility='client'` MUST have a `defaultValue` that is safe to expose publicly. Keys with `visibility='server'` MUST NOT appear in the client-config response.

The registry SHALL include a `features.responsesApiEnabled` entry: `type='feature'`, `valueType='boolean'`, `visibility='server'`, `defaultValue=false`, `critical=false`, `envVar='RESPONSES_API_ENABLED'`, and no `allowedRolesEnvVar` (role-based rollout via `RESPONSES_API_ENABLED_ROLES` is explicitly out of scope for this entry). This flag SHALL NOT be included in `AppConfigService.getClientConfig`'s response under any circumstance, by virtue of its `visibility='server'` classification — the same mechanism that already excludes `features.llmConversationNaming`.

**Feature flag:** Not gated. The registry entry itself has no user-visible flag; it declares the `features.responsesApiEnabled` key consumed elsewhere.

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
