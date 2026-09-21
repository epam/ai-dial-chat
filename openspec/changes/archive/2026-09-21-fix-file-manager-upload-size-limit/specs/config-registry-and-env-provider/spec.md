## ADDED Requirements

### Requirement: Registry declares the attachments.maxFileSizeBytes key

The `CONFIG_DEFINITIONS` registry SHALL include an `attachments.maxFileSizeBytes` entry: `type='config'`, `valueType='number'`, `visibility='client'`, `defaultValue=536870912`, `critical=false`, and `envVar='FILE_UPLOAD_MAX_BYTES'`. This entry SHALL reuse the existing `FILE_UPLOAD_MAX_BYTES` environment variable — the same one that already backs the `MulterModule` file-size limit on `POST /api/v1/files` (`apps/chat-api/src/files/files.module.ts`) — rather than declaring a new environment variable, so the frontend's pre-upload check and the backend's actual enforcement can never diverge. `FILE_UPLOAD_MAX_BYTES` is already declared as an optional numeric `EnvironmentVariables` field with the same default; no change to `environment.config.ts` is needed.

#### Scenario: Registry contains the attachments.maxFileSizeBytes key

- **WHEN** the registry is imported
- **THEN** it MUST contain an entry with `key='attachments.maxFileSizeBytes'`, `type='config'`, `valueType='number'`, `visibility='client'`, `envVar='FILE_UPLOAD_MAX_BYTES'`, and `defaultValue=536870912`

#### Scenario: Operator-configured limit is resolved

- **WHEN** `FILE_UPLOAD_MAX_BYTES=104857600` is set
- **THEN** `EnvConfigProvider.resolve('attachments.maxFileSizeBytes', ctx)` resolves to `104857600`

#### Scenario: Unconfigured limit falls back to the default

- **WHEN** `FILE_UPLOAD_MAX_BYTES` is not set
- **THEN** the key resolves to the registry's `defaultValue` of `536870912`, matching `MulterModule`'s own hardcoded fallback in `files.module.ts`
