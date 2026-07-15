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
