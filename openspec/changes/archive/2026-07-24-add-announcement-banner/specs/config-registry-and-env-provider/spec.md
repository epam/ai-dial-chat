## ADDED Requirements

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
