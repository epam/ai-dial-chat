## MODIFIED Requirements

### Requirement: Schema 1.1.0 managed set

Schema version 1.1.0 SHALL manage exactly ten config keys and no feature: `onboarding.hints` unchanged from 1.0.0, the three announcement keys, the two celebration keys and the four celebration delivery keys. Every 1.0.0 payload SHALL remain valid under 1.1.0.

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None — titles and descriptions are schema annotations rendered by Config Studio.

#### Scenario: Exported key set

- **WHEN** the 1.1.0 schema is generated
- **THEN** `properties.config.properties` has exactly `onboarding.hints`, `announcement.title`, `announcement.description`, `announcement.items`, `ui.activeEventId`, `ui.celebrationsEnabledByDefault`, `ui.celebrationDelivery.mode`, `ui.celebrationDelivery.revision`, `ui.celebrationDelivery.externalScenes` and `ui.celebrationDelivery.externalEvents`, and `properties.features.properties` is empty

#### Scenario: A 1.0.0 publication validates under 1.1.0

- **WHEN** every valid fixture of `ai-dial-chat-1.0.0.fixtures.json` is validated against the 1.1.0 artifact with Config Studio's Ajv options
- **THEN** every one is valid

#### Scenario: Keys planned for 1.2.0 are still rejected

- **WHEN** a 1.1.0 payload sets `config["welcomeScreen.description"]` or `features["features.usageLimitsControl"]`
- **THEN** validation against `ai-dial-chat-1.1.0.json` fails with an `additionalProperties` error at `/config` or `/features`

#### Scenario: Registry counts

- **WHEN** the committed 1.1.0 artifact is inspected
- **THEN** it exports ten config keys and no feature; the registry counts of the current build are those of the schema 1.2.0 managed set

## ADDED Requirements

### Requirement: Schema 1.2.0 managed set

Schema version 1.2.0 SHALL manage the ten 1.1.0 config keys unchanged plus `welcomeScreen.description`, `fileManager.availableTabs`, `usageLimits.warningThresholdPercent` and `usageLimits.spendingLimitsMode`, and exactly one feature, `features.usageLimitsControl`. Every 1.0.0 and 1.1.0 payload SHALL remain valid under 1.2.0. The registry SHALL then declare 53 keys: 15 managed, 29 local-only and 9 eligible but unmanaged.

#### Scenario: Exported key set

- **WHEN** the 1.2.0 schema is generated
- **THEN** `properties.config.properties` has the ten 1.1.0 keys plus the four new config keys, and `properties.features.properties` has exactly `features.usageLimitsControl`

#### Scenario: Earlier publications validate under 1.2.0

- **WHEN** every valid fixture of `ai-dial-chat-1.0.0.fixtures.json` and `ai-dial-chat-1.1.0.fixtures.json` is validated against the 1.2.0 artifact with Config Studio's Ajv options
- **THEN** every one is valid

#### Scenario: Keys planned for later versions are rejected

- **WHEN** a 1.2.0 payload sets `config["mcpApps.theme"]` or `features["features.projectsEnabled"]`
- **THEN** validation fails with an `additionalProperties` error at `/config` or `/features`

#### Scenario: Registry counts

- **WHEN** the registry is inspected
- **THEN** it declares 53 keys: 15 managed, 29 local-only and 9 eligible but unmanaged

### Requirement: Welcome text bounds

In the 1.2.0 schema, `welcomeScreen.description` SHALL be a non-blank string of 1–1,000 characters. It SHALL reach the client as plain text, never as markup, exactly as the environment value does.

#### Scenario: Oversized welcome text

- **WHEN** an editor publishes `welcomeScreen.description` with 1,001 characters
- **THEN** validation against the 1.2.0 artifact with Config Studio's Ajv options fails with a `maxLength` error at `/config/welcomeScreen.description`

#### Scenario: Blank welcome text

- **WHEN** `welcomeScreen.description` is three spaces
- **THEN** validation fails with a `pattern` error

#### Scenario: Markup stays literal

- **WHEN** a fresh 1.2.0 snapshot sets `welcomeScreen.description` to `<b>Hi</b>` and the key is active
- **THEN** `config.welcomeScreenDescription` is the string `<b>Hi</b>`, as from the environment

### Requirement: File Manager tab list bounds

In the 1.2.0 schema, `fileManager.availableTabs` SHALL be an array of 1–4 unique items, each one of `all`, `my_files`, `shared` and `organization`, the same ids the environment admission accepts. The default SHALL be all four. Its description SHALL state that the tabs keep their fixed order and that All appears only with at least two source tabs.

#### Scenario: Unknown tab

- **WHEN** a 1.2.0 payload sets `config["fileManager.availableTabs"]` to `["all", "review"]`
- **THEN** validation fails with an `enum` error at `/config/fileManager.availableTabs/1`

#### Scenario: Repeated tab

- **WHEN** the list is `["my_files", "my_files"]`
- **THEN** validation fails with a `uniqueItems` error

#### Scenario: Empty list

- **WHEN** the list is `[]`
- **THEN** validation fails with a `minItems` error

#### Scenario: Valid subset

- **WHEN** the list is `["organization", "my_files"]`
- **THEN** validation succeeds

### Requirement: Usage limit bounds

In the 1.2.0 schema, `usageLimits.warningThresholdPercent` SHALL be an integer from 1 to 99 with default 75, and `usageLimits.spendingLimitsMode` SHALL be one of `off`, `shadow` and `enforce` with default `off`. These are the rules the environment validation enforces. The mode's description SHALL state that it must match DIAL Core's spending-limits mode and that it changes only what Chat shows.

#### Scenario: Out-of-range threshold

- **WHEN** a 1.2.0 payload sets `config["usageLimits.warningThresholdPercent"]` to `100` or `0`
- **THEN** validation fails with a `maximum` or `minimum` error

#### Scenario: Fractional threshold

- **WHEN** the threshold is `80.5`
- **THEN** validation fails with a `type` error

#### Scenario: Unknown mode

- **WHEN** `config["usageLimits.spendingLimitsMode"]` is `ENFORCE`
- **THEN** validation fails with an `enum` error

### Requirement: Usage-limits control is a managed feature

In the 1.2.0 schema, `features.usageLimitsControl` SHALL reference `$defs/featureState` unchanged from 1.0.0. The root `dial:semanticConstraints` SHALL stay `calendar_date` and `window_order`. Chat's semantic validator SHALL reject a feature state that Config Studio rejects for those codes, and accept one that Studio accepts.

#### Scenario: Valid policy

- **WHEN** a 1.2.0 payload sets `features["features.usageLimitsControl"]` to `{ "enabled": true, "availability": { "startsAt": "2026-12-01T00:00:00Z", "endsAt": "2027-01-01T00:00:00Z" }, "targeting": { "roles": ["beta"] } }`
- **THEN** schema and semantic validation both succeed

#### Scenario: Impossible date

- **WHEN** `availability.startsAt` is `2026-02-30T00:00:00Z`
- **THEN** the semantic validator returns `calendar_date` at `/features/features.usageLimitsControl/availability/startsAt`

#### Scenario: Inverted or empty window

- **WHEN** `startsAt` is equal to or later than `endsAt`
- **THEN** the semantic validator returns `window_order` at `/features/features.usageLimitsControl/availability`

#### Scenario: Leap day

- **WHEN** `startsAt` is `2028-02-29T00:00:00Z` and `endsAt` is later
- **THEN** no semantic issue is returned

#### Scenario: Offset timestamp

- **WHEN** `startsAt` is `2026-12-01T00:00:00+01:00`
- **THEN** schema validation fails with a `pattern` error, because the contract stores UTC only

### Requirement: Payload limit with the 1.2.0 keys

Each 1.2.0 key at its maximum SHALL fit the 57,344-byte payload limit on its own. A representative publication SHALL also fit: the dev tour, three announcements, a banner, a full delivery policy, a welcome text, three tabs, both usage values, and a usage-limits policy with a window and ten roles.

#### Scenario: Representative publication fits

- **WHEN** the representative 1.2.0 fixture is canonicalized
- **THEN** its size is at most 57,344 bytes

#### Scenario: Maximal feature policy fits on its own

- **WHEN** `features.usageLimitsControl` has a window and 50 roles of 128 characters
- **THEN** the payload with only that feature fits the limit
