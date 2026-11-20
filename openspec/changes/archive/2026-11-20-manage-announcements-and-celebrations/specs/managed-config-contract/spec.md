## ADDED Requirements

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
- **THEN** validation fails with an `additionalProperties` error at `/config` or `/features`

#### Scenario: Registry counts

- **WHEN** the registry is inspected
- **THEN** it declares 53 keys: 10 managed, 29 local-only and 14 eligible but unmanaged

### Requirement: Banner text bounds

In the 1.1.0 schema, `announcement.title` SHALL be a non-blank string of 1–200 characters and `announcement.description` a non-blank string of 1–2,000 characters.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Oversized title rejected before Chat sees it

- **WHEN** an editor publishes `announcement.title` with 201 characters
- **THEN** validation against the 1.1.0 artifact with Config Studio's Ajv options fails with a `maxLength` error at `/config/announcement.title`, so Studio refuses the publication

#### Scenario: Oversized description

- **WHEN** `announcement.description` has 2,001 characters
- **THEN** validation fails with a `maxLength` error

#### Scenario: Blank announcement title

- **WHEN** `announcement.title` is three spaces
- **THEN** validation fails with a `pattern` error

### Requirement: Announcement list bounds

In the 1.1.0 schema, `announcement.items` SHALL hold at most 10 closed objects: a required non-blank `title` of 1–200 characters, an optional `description` of at most 2,000, an optional `link` with a required non-blank `label` of 1–100 characters and a required `href` of at most 2,048 characters matching `^https?://\S+$`, and an optional `severity` of `info` or `warning`.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Too many announcements

- **WHEN** `announcement.items` has 11 entries
- **THEN** validation fails with a `maxItems` error

#### Scenario: Script link rejected

- **WHEN** an item's `link.href` is `javascript:alert(1)`
- **THEN** validation fails with a `pattern` error at that item's `link/href`

#### Scenario: Link without a label

- **WHEN** an item's `link` has only `href`
- **THEN** validation fails with a `required` error at that item's `link`

#### Scenario: Unknown severity

- **WHEN** an item's `severity` is `critical`
- **THEN** validation fails with an `enum` error; the environment path, which forgives it as `info`, is unchanged

#### Scenario: Unknown item member

- **WHEN** an item carries `"icon": "bell"`
- **THEN** validation fails with an `additionalProperties` error at that item

### Requirement: Announcement descriptions are a sanitized HTML subset

The descriptions of `announcement.description` and an item's `description` SHALL list the surviving tags (`b`, `strong`, `em`, `br`, `span`, `a`), say that a link keeps only its address, target and rel and that links to other pages open in a new tab. The `announcement.title` description SHALL say it is plain text. None SHALL name an environment variable.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Descriptions tell editors the subset

- **WHEN** the 1.1.0 artifact is inspected
- **THEN** the `description` annotation of `announcement.description` and of the item `description` lists `b`, `strong`, `em`, `br`, `span` and `a`, and the annotation of `announcement.title` says the text is shown as typed

#### Scenario: Schema accepts markup that the server later strips

- **WHEN** `announcement.description` is `<b>Hi</b><script>alert(1)</script><img src=x onerror=alert(1)>`
- **THEN** schema validation passes, because sanitizing is Chat's job, not the contract's

### Requirement: Celebration event bounds

In the 1.1.0 schema, `ui.activeEventId` SHALL be a string of at most 64 characters matching the environment's event pattern `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`, and `ui.celebrationsEnabledByDefault` SHALL be a boolean with the default `true`.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Uppercase event ID

- **WHEN** `ui.activeEventId` is `New-Year`
- **THEN** validation fails with a `pattern` error

#### Scenario: Over-long event ID

- **WHEN** `ui.activeEventId` is 65 characters of `a`
- **THEN** validation fails with a `maxLength` error

#### Scenario: Non-boolean default switch

- **WHEN** `ui.celebrationsEnabledByDefault` is `"no"`
- **THEN** validation fails with a `type` error

### Requirement: Delivery policy bounds

In the 1.1.0 schema, `ui.celebrationDelivery.mode` SHALL be `bundled` or `prefer-external`, `revision` SHALL match `^[A-Za-z0-9._-]{1,64}$`, `externalScenes` SHALL hold at most 64 distinct `eventId/sceneId` strings whose parts are event-pattern IDs of at most 64 characters, and `externalEvents` SHALL hold at most 64 distinct event-pattern IDs of at most 64 characters.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Malformed scene pair

- **WHEN** `externalScenes` contains `new-year/Snowman` or `new-year`
- **THEN** validation fails with a `pattern` error at that entry

#### Scenario: Repeated allowlist entry

- **WHEN** `externalEvents` is `["company-anniversary", "company-anniversary"]`
- **THEN** validation fails with a `uniqueItems` error

#### Scenario: Too many allowlist entries

- **WHEN** `externalScenes` has 65 distinct valid pairs
- **THEN** validation fails with a `maxItems` error

#### Scenario: Unknown delivery mode

- **WHEN** `ui.celebrationDelivery.mode` is `external-only`
- **THEN** validation fails with an `enum` error

#### Scenario: Same rules as the environment

- **WHEN** every valid and invalid example of the environment validation tests for `UI_EVENT`, `UI_EVENT_DELIVERY_REVISION`, `UI_EVENT_EXTERNAL_SCENES` and `UI_EVENT_EXTERNAL_EVENTS` is checked against the 1.1.0 value schemas
- **THEN** each is valid exactly when environment validation accepts it, with two exceptions: the schema also rejects an active event ID longer than 64 characters, and it rejects repeated list entries, which the environment de-duplicates

### Requirement: Event IDs are not enumerated by the contract

The 1.1.0 schema SHALL NOT restrict `ui.activeEventId` to the compiled events and SHALL NOT add a semantic constraint that ties it to `externalEvents`; `dial:semanticConstraints` SHALL stay `calendar_date` and `window_order`. The key's description SHALL name the compiled events, say that `none` turns celebrations off, and say that an uncompiled event must be listed in the external events.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: The description guides editors

- **WHEN** the 1.1.0 artifact is inspected
- **THEN** the `description` of `ui.activeEventId` names `halloween` and `new-year`, mentions `none`, and refers to the external events list

#### Scenario: An external event ID validates

- **WHEN** `ui.activeEventId` is `company-anniversary` and `externalEvents` is empty
- **THEN** schema and semantic validation both pass

#### Scenario: Semantic codes are unchanged

- **WHEN** the 1.1.0 artifact is inspected
- **THEN** its `dial:semanticConstraints` lists exactly `calendar_date` and `window_order`

### Requirement: The celebration delivery policy is managed while its source stays local

The four `ui.celebrationDelivery.*` keys SHALL be managed config keys in 1.1.0 instead of local-only `security-policy` keys. The themes service URL, every other URL, and the BFF's admission of packs (path containment, redirect refusal, size, hash and media-type checks) SHALL stay local. No managed key SHALL carry a URL or a path of the pack source. `announcement.html` SHALL stay local-only with reason `security-policy`.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: No pack source in the contract

- **WHEN** the 1.1.0 artifact is inspected
- **THEN** it has no property for the themes service URL, and no managed value schema has a member that holds a URL other than an announcement link

#### Scenario: Announcement HTML stays local

- **WHEN** a 1.1.0 payload sets `config["announcement.html"]`
- **THEN** validation fails with an `additionalProperties` error at `/config`

### Requirement: The payload limit is a total

Each 1.1.0 key at its largest value SHALL validate and fit in 57,344 canonical bytes on its own, and a representative publication SHALL fit. That publication holds a 10-hint tour, a banner, three announcements and a delivery policy with 8 scenes and 4 events. The contract SHALL NOT promise that every key at its maximum fits at once. Such a publication SHALL be refused by Config Studio's payload limit.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Largest announcement list fits alone

- **WHEN** a payload holds only 10 announcements, each with every member at its maximum length
- **THEN** it validates and its canonical serialization is at most 57,344 bytes

#### Scenario: Every key at its maximum is refused as a whole

- **WHEN** a payload sets every 1.1.0 key at its maximum
- **THEN** it validates against the schema, but its canonical serialization exceeds 57,344 bytes, and Chat rejects such a snapshot with `payload_too_large` and keeps the previous one

## MODIFIED Requirements

### Requirement: Managed opt-in prerequisites

An eligible key SHALL become managed only in a schema version that also meets its prerequisite below. Each prerequisite SHALL be checked by a registry test, so a version that breaks it fails the build.

| Key | Prerequisite |
| --- | --- |
| `footer.html` | `features.footer` is no longer derived only from the local footer value, and the classification of `footer.html` and `announcement.html` is decided together |
| `deployments.defaultDeploymentId`, `features.defaultDeploymentPinned` | both are managed in the same schema version |
| `ui.celebrationDelivery.mode`, `ui.celebrationDelivery.revision`, `ui.celebrationDelivery.externalScenes`, `ui.celebrationDelivery.externalEvents` | all four are managed in the same schema version |

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None.

#### Scenario: Footer copy managed while its visibility is still local

- **WHEN** `footer.html` is managed while `features.footer` is still local-only with reason `derived`
- **THEN** the registry test fails

#### Scenario: Default deployment keys move together

- **WHEN** exactly one of `deployments.defaultDeploymentId` and `features.defaultDeploymentPinned` is managed
- **THEN** the registry test fails

#### Scenario: Delivery keys move together

- **WHEN** `ui.celebrationDelivery.mode` is managed while `ui.celebrationDelivery.revision` is still local-only
- **THEN** the registry test fails
