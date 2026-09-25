## ADDED Requirements

### Requirement: Client-visible registry keys stay in sync with the client-config mapping

Every `CONFIG_DEFINITIONS` entry with `visibility: 'client'` and `type: 'config'` SHALL
fall into exactly one of two groups. Either it has exactly one entry in the
client-config mapping table, or it is `app.version`, which `AppConfigService` resolves
through its documented special path. Every mapping-table entry SHALL name a key that
exists in `CONFIG_DEFINITIONS` with `visibility: 'client'` and `type: 'config'`. No two
mapping entries SHALL write the same response field. The mapped fields, together with
`appVersion` and `aiTextRefinementAvailable`, SHALL cover every `ClientConfigDto`
field.

A unit test in `apps/chat-api/src/app-config/tests/` SHALL enforce these properties
against the real `CONFIG_DEFINITIONS`, so a new unmapped client key fails the test
suite during development. `ConfigDefinition.key` SHALL stay typed as `string`, and
`CONFIG_DEFINITIONS` SHALL stay annotated as `ConfigDefinition[]`. This requirement
does not require a type-level rewrite of the registry. Server-visible keys, such as
`utility.modelId`, and `type: 'feature'` keys SHALL have no mapping entry.

This requirement SHALL NOT change the contents or order of `CONFIG_DEFINITIONS`,
provider priority, or provider fallback behavior.

#### Scenario: A new client key without a mapping is caught

- **WHEN** a developer adds a `visibility: 'client'`, `type: 'config'` definition to `CONFIG_DEFINITIONS` without adding a mapping entry
- **THEN** the registry-coverage test fails and names the unmapped key

#### Scenario: A stale mapping is caught

- **WHEN** a mapping entry names a key that is absent from `CONFIG_DEFINITIONS`, or that is server-visible or a feature
- **THEN** the registry-coverage test fails and names the stale key

#### Scenario: Duplicate field ownership is caught

- **WHEN** two mapping entries write the same `ClientConfigDto` field
- **THEN** the registry-coverage test fails and names the field

#### Scenario: app.version is the only unmapped client config key

- **WHEN** the coverage test lists client-visible `type: 'config'` keys without a mapping entry
- **THEN** the only key listed is `app.version`

#### Scenario: Server-only keys stay out of the mapping

- **WHEN** the mapping table is inspected
- **THEN** it has no entry for `utility.modelId` or for any `features.*` key
