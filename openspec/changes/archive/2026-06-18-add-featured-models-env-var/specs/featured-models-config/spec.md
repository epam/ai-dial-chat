## ADDED Requirements

### Requirement: FEATURED_MODEL_IDS environment variable

The system SHALL accept an optional `FEATURED_MODEL_IDS` environment variable that lists the IDs of models to be marked as featured in the catalog.

The variable:
- SHALL be optional; when absent or empty all catalog items have `isFeatured: false`
- SHALL be a comma-separated string of model IDs (e.g. `chat-hub-v2,gpt-4o,dial-rag`)
- SHALL be parsed at application startup: split on `,`, each token trimmed of leading/trailing whitespace, empty tokens discarded
- SHALL be validated in `EnvironmentVariables` (`apps/chat-api/src/config/environment.config.ts`) as `@IsOptional() @IsString()` with a `@Transform` that produces `string[]`
- SHALL NOT be logged or exposed in any API response body or error message

Feature gate: none — this feature is always active when the env var is set.

Cache / invalidation: not applicable — the value is static per process lifetime; a restart is required to pick up changes.

#### Scenario: Variable is absent — empty featured set

- **WHEN** `FEATURED_MODEL_IDS` is not set in the environment
- **THEN** the parsed featured ID list is empty and all catalog items receive `isFeatured: false`

#### Scenario: Variable is a valid comma-separated list

- **WHEN** `FEATURED_MODEL_IDS=chat-hub-v2,gpt-4o,dial-rag` is set
- **THEN** the parsed set contains exactly `{ 'chat-hub-v2', 'gpt-4o', 'dial-rag' }`

#### Scenario: Variable entries with surrounding whitespace are trimmed

- **WHEN** `FEATURED_MODEL_IDS= chat-hub-v2 , gpt-4o ` is set
- **THEN** the parsed set contains `{ 'chat-hub-v2', 'gpt-4o' }` with no whitespace in the IDs

#### Scenario: Variable with trailing comma — empty token is discarded

- **WHEN** `FEATURED_MODEL_IDS=chat-hub-v2,` is set
- **THEN** the parsed set contains exactly `{ 'chat-hub-v2' }` and no empty string entry

#### Scenario: Variable set to empty string — treated as absent

- **WHEN** `FEATURED_MODEL_IDS=` (empty) is set
- **THEN** the parsed set is empty and all catalog items receive `isFeatured: false`
