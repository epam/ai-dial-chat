## ADDED Requirements

### Requirement: Registry declares the announcement.title key

The `CONFIG_DEFINITIONS` registry SHALL include an `announcement.title` entry so the operator-set announcement heading is resolvable and client-visible. The entry SHALL be `type='config'`, `valueType='string'`, `visibility='client'`, `defaultValue=null`, `critical=false`, and `envVar='ANNOUNCEMENT_TITLE'`. The backing environment variable `ANNOUNCEMENT_TITLE` SHALL be declared as an optional string in `EnvironmentVariables` (a missing value is valid and resolves to the `null` default). No custom provider branch is required — the value SHALL resolve through the generic environment-variable path.

#### Scenario: Registry contains the announcement.title key

- **WHEN** `CONFIG_DEFINITIONS` is inspected
- **THEN** it MUST contain an entry with `key='announcement.title'`, `type='config'`, `valueType='string'`, `visibility='client'`, `envVar='ANNOUNCEMENT_TITLE'`, and `defaultValue=null`

#### Scenario: Announcement title resolves from the environment variable

- **WHEN** `ANNOUNCEMENT_TITLE` is set to `🎉 Welcome to DIAL! 🎉`
- **THEN** resolving `announcement.title` returns that exact string, emoji included

#### Scenario: Announcement title defaults to null when unset

- **WHEN** `ANNOUNCEMENT_TITLE` is not set
- **THEN** resolving `announcement.title` returns `null` and startup validation does not fail

---

### Requirement: Registry declares the announcement.description key

The `CONFIG_DEFINITIONS` registry SHALL include an `announcement.description` entry so the operator-set announcement body copy is resolvable and client-visible. The entry SHALL be `type='config'`, `valueType='string'`, `visibility='client'`, `defaultValue=null`, `critical=false`, and `envVar='ANNOUNCEMENT_DESCRIPTION'`. The backing environment variable `ANNOUNCEMENT_DESCRIPTION` SHALL be declared as an optional string in `EnvironmentVariables`.

The registry SHALL resolve the raw value through the generic environment-variable path; sanitization of the resolved HTML is the responsibility of the `client-config-endpoint` capability, not the registry.

#### Scenario: Registry contains the announcement.description key

- **WHEN** `CONFIG_DEFINITIONS` is inspected
- **THEN** it MUST contain an entry with `key='announcement.description'`, `type='config'`, `valueType='string'`, `visibility='client'`, `envVar='ANNOUNCEMENT_DESCRIPTION'`, and `defaultValue=null`

#### Scenario: Announcement description resolves from the environment variable

- **WHEN** `ANNOUNCEMENT_DESCRIPTION` is set to a non-empty string
- **THEN** resolving `announcement.description` returns that string unmodified, with sanitization applied downstream

#### Scenario: Announcement description defaults to null when unset

- **WHEN** `ANNOUNCEMENT_DESCRIPTION` is not set
- **THEN** resolving `announcement.description` returns `null` and startup validation does not fail
