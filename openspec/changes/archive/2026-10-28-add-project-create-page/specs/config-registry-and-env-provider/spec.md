## ADDED Requirements

### Requirement: Registry declares the project context limit keys

`CONFIG_DEFINITIONS` (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`) SHALL include three entries, each with `type='config'`, `visibility='client'`, `critical=false` and `owner='chat-team'`:

| Key | `valueType` | `defaultValue` | `envVar` |
| --- | --- | --- | --- |
| `projects.contextFileMaxBytes` | `number` | `1048576` | `PROJECT_CONTEXT_FILE_MAX_BYTES` |
| `projects.contextTotalMaxBytes` | `number` | `10485760` | `PROJECT_CONTEXT_TOTAL_MAX_BYTES` |
| `projects.contextAllowedExtensions` | `json` | `['csv', 'pdf', 'xlsx']` | `PROJECT_CONTEXT_ALLOWED_EXTENSIONS` |

The keys reuse the same environment variables that `ProjectsService.createProject` enforces, through the `EnvironmentVariables` fields declared in `project-create-api`. The browser's pre-upload checks and the BFF's enforcement can therefore never diverge.

`CLIENT_CONFIG_MAPPINGS` (`apps/chat-api/src/app-config/client-config.mapper.ts`) SHALL map the three keys to these `ClientConfigDto` fields:

- `projectContextFileMaxBytes` (`number`);
- `projectContextTotalMaxBytes` (`number`);
- `projectContextAllowedExtensions` (`string[]`).

Each field has `@ApiProperty` and is always emitted, like every other mapped field (`MappedClientConfig` is `Required`), so the existing registry-coverage test stays green. The keys are not gated by `projectsEnabled`, because they are plain limits with no secret value. Like other client config values, they are boot-time constants, so there is no cache and no invalidation.

**Feature flag:** none on the keys themselves. **RTL impact:** none. **i18n impact:** none.

#### Scenario: Registry contains the three keys

- **WHEN** the registry is imported
- **THEN** it contains the three entries with exactly the `valueType`, `defaultValue` and `envVar` above

#### Scenario: Operator-configured values are resolved

- **WHEN** `PROJECT_CONTEXT_FILE_MAX_BYTES=2097152` and `PROJECT_CONTEXT_ALLOWED_EXTENSIONS=csv, PDF ,.md` are set
- **THEN** `EnvConfigProvider` resolves `projects.contextFileMaxBytes` to `2097152` and `projects.contextAllowedExtensions` to `['csv', 'pdf', 'md']`

#### Scenario: Unset values fall back to defaults

- **WHEN** none of the three variables is set
- **THEN** the client config response carries `projectContextFileMaxBytes: 1048576`, `projectContextTotalMaxBytes: 10485760` and `projectContextAllowedExtensions: ['csv', 'pdf', 'xlsx']`
