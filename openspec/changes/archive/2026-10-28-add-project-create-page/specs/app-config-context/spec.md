## ADDED Requirements

### Requirement: AppConfigContext exposes the project context limits

`AppConfigContext` (`apps/chat/src/context/AppConfigContext.tsx`) SHALL surface three fields from the `GET /api/v1/client-config` response on `AppConfigState.config`:

- `projectContextFileMaxBytes: number`;
- `projectContextTotalMaxBytes: number`;
- `projectContextAllowedExtensions: string[]`.

Behaviour:

- Three module-level defaults SHALL be used as the initial values, before the API call completes: `DEFAULT_PROJECT_CONTEXT_FILE_MAX_BYTES = 1_048_576`, `DEFAULT_PROJECT_CONTEXT_TOTAL_MAX_BYTES = 10_485_760` and `DEFAULT_PROJECT_CONTEXT_ALLOWED_EXTENSIONS = ['csv', 'pdf', 'xlsx']`. They are kept on a first-load failure, matching the existing error-preservation semantics.
- On success, each value is taken from the response when present and valid, and falls back to its default otherwise:
  - a byte limit must be a positive finite number;
  - the extension list must be an array of non-empty strings, lower-cased on read.
- A failed re-fetch keeps the last successfully loaded values.

The only consumer is `ProjectCreatePage`, which passes the values to `ProjectCreateForm` and to `useProjectFileManagerPicker`. No new context is introduced.

**Feature flag:** none. **RTL impact:** none. **i18n impact:** none.

#### Scenario: Values are exposed when config is ready

- **WHEN** the provider has fetched a config with `projectContextFileMaxBytes: 2097152` and `projectContextAllowedExtensions: ['csv', 'md']`
- **THEN** `useAppConfig().config.projectContextFileMaxBytes` is `2097152`, and `projectContextAllowedExtensions` is `['csv', 'md']`

#### Scenario: Defaults during loading, on error, or for an older BFF

- **WHEN** the config request is in flight or has rejected on first load, or the response omits the three fields
- **THEN** the fields read `1048576`, `10485760` and `['csv', 'pdf', 'xlsx']`

#### Scenario: Invalid value falls back

- **WHEN** the response carries `projectContextTotalMaxBytes: 0`
- **THEN** `useAppConfig().config.projectContextTotalMaxBytes` is `10485760`
