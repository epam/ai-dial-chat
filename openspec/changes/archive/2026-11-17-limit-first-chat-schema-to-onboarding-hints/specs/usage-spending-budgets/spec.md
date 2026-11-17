## MODIFIED Requirements

### Requirement: Spending limits mode operator setting

`chat-api` SHALL accept an optional environment variable `SPENDING_LIMITS_MODE` with the values `off`,
`shadow` and `enforce`, defaulting to `off`. Any other value SHALL fail environment validation at
boot. The value SHALL reach the client as `config.spendingLimitsMode` on `GET /api/v1/client-config`.
The key SHALL be settable through managed config only in a schema version that manages
`usageLimits.spendingLimitsMode`; schema 1.0.0 does not, so there it is environment-only.

#### Scenario: Default mode

- **WHEN** `SPENDING_LIMITS_MODE` is not set and no managed value exists
- **THEN** `GET /api/v1/client-config` returns `"config": { "spendingLimitsMode": "off" }`

#### Scenario: Configured mode

- **WHEN** `SPENDING_LIMITS_MODE=enforce`
- **THEN** `config.spendingLimitsMode` is `"enforce"`

#### Scenario: Invalid value fails boot

- **WHEN** `SPENDING_LIMITS_MODE` is `ENFORCE `, `on` or `true`
- **THEN** environment validation rejects it and the service does not start

#### Scenario: Managed value applies when the environment is unset

- **WHEN** the current schema version manages `usageLimits.spendingLimitsMode`, the key is active, `SPENDING_LIMITS_MODE` is not set, and the published managed config sets it to `enforce`
- **THEN** `config.spendingLimitsMode` is `"enforce"`

#### Scenario: Schema 1.0.0 keeps the mode environment-only

- **WHEN** the current schema version is 1.0.0 and a deployment lists `usageLimits.spendingLimitsMode` in `MANAGED_CONFIG_ACTIVE_KEYS` with the mode `active`
- **THEN** environment validation fails and names the key

#### Scenario: Explicit environment value wins over managed config

- **WHEN** the current schema version manages the key, `SPENDING_LIMITS_MODE=shadow`, and the published managed config sets `enforce`
- **THEN** `config.spendingLimitsMode` is `"shadow"`, following the existing provider order (environment, then managed, then default)


### Requirement: Spending limits mode registry entry

The config registry SHALL declare the key `usageLimits.spendingLimitsMode` with `type: 'config'`,
`visibility: 'client'`, `defaultValue: 'off'` and `envVar: 'SPENDING_LIMITS_MODE'`. It SHALL be
eligible but unmanaged in schema 1.0.0. The schema version that manages it SHALL export a value
schema that enumerates `off`, `shadow` and `enforce`, as a MINOR bump with the artifact regenerated
and pinned.

#### Scenario: Managed schema enumerates the modes

- **WHEN** the managed-config schema artifact of a version that manages the key is generated
- **THEN** it contains `usageLimits.spendingLimitsMode` as a string with `enum: ["off", "shadow", "enforce"]`, and every payload valid under the previous version still validates

#### Scenario: Schema 1.0.0 does not export the mode

- **WHEN** the 1.0.0 artifact is generated
- **THEN** it has no `usageLimits.spendingLimitsMode` property, and the registry entry has no `management`

