## ADDED Requirements

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
