# managed-config-contract Specification

## Purpose

Which configuration registry keys Chat exports to DIAL Config Studio as managed values, which keys stay local-only and why, the `{ config, features }` payload shape and its value constraints, and the snapshot identity checks a future runtime reader applies. Export is not activation: no runtime value depends on the managed flag.

## Requirements
### Requirement: Managed opt-in is explicit and separate from activation

A registry key SHALL be part of the managed contract only when its definition sets `managed: true`. The default SHALL be unmanaged. A managed key SHALL declare a `managedContract` with an operator-facing English `title` and `description`, a numeric display `order`, an optional `isHidden` flag, and a value schema when the key is not a feature, and SHALL NOT be local-only. A key with `valueType: 'json'` SHALL be managed only with a declared value schema. Marking a key managed SHALL NOT change any resolved value, client-config field, feature-flag result or cache entry; the runtime reads no managed source until a later change adds activation. Operator-facing descriptions SHALL NOT contain environment-variable names, environment values, secrets, or deployment URLs.

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None — operator titles and descriptions are schema annotations rendered by Config Studio, not Chat UI strings.

#### Scenario: Default is unmanaged

- **WHEN** a registry entry has no `managed` field
- **THEN** it is absent from the exported schema

#### Scenario: Managed JSON key without a schema is rejected

- **WHEN** an entry with `valueType: 'json'` sets `managed: true` without a value schema
- **THEN** the registry rule test fails

#### Scenario: Managed and local-only together are rejected

- **WHEN** an entry sets both `managed: true` and `localOnly`
- **THEN** the registry rule test fails

#### Scenario: Description leaks an environment variable name

- **WHEN** a managed key's operator description contains the name of any `EnvironmentVariables` field
- **THEN** the registry rule test fails

### Requirement: Local-only keys are classified with a reason and never exported

A key that depends on a local capability, credential, deployment topology, security policy, backend-enforced limit, build metadata, a derivation from another local value, or opaque client-owned JSON SHALL be marked `localOnly` with one of the reasons `capability`, `deployment-topology`, `security-policy`, `backend-enforced-limit`, `build-metadata`, `derived` or `opaque`. Local-only keys SHALL never appear in the exported schema, so a payload that contains one is rejected as an unknown key. Every current registry key SHALL be classified, and at least the following SHALL be local-only: `asr.modelId`, `features.asrEnabled`, `utility.modelId` and `features.llmConversationNaming` as `capability`; `dialCore.externalUrl` and `mcpApps.sandboxUrl` as `deployment-topology`; `overlay.allowedOrigins`, `documents.allowedConnectOrigins`, `customVisualizers`, `applicationVisualizers` and `announcement.html` as `security-policy`; `attachments.maxFileSizeBytes` and the project context limits as `backend-enforced-limit`; `app.version` as `build-metadata`; `features.footer` as `derived`; and `customVariables` as `opaque`.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Local-only key in a payload

- **WHEN** a payload contains `config["asr.modelId"]`
- **THEN** validation against the exported schema fails with an `additionalProperties` error at `/config`

#### Scenario: Server-internal URL is never manageable

- **WHEN** the exported schema is inspected
- **THEN** it contains no property for `dialCore.externalUrl`, `mcpApps.sandboxUrl` or any key whose definition references `DIAL_CORE_URL`

### Requirement: Managed payload shape

A managed payload SHALL be a JSON object with exactly two required members, `config` and `features`, each an object that may be empty and that rejects any property not declared in the schema. Members SHALL be keyed by full registry keys (for example `features.usageLimitsControl`). A config member SHALL be the key's plain JSON value, never `null`; an omitted key SHALL mean that the publication supplies no value for it. A feature member SHALL be a feature state `{ enabled, availability?, targeting? }`:

- `enabled` is a required boolean;
- `availability`, when present, has at least one of `startsAt` (inclusive) and `endsAt` (exclusive), each a UTC timestamp `YYYY-MM-DDTHH:MM:SS[.fff]Z` with no offset;
- `targeting`, when present, has `roles`: 1 to 50 unique role names, each 1–128 characters with no whitespace or comma; omitted targeting means no role restriction, and an empty list is invalid;
- no other member is accepted.

The canonical serialization of a payload SHALL be at most 57,344 bytes.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Valid payload

- **WHEN** a payload sets `config["usageLimits.warningThresholdPercent"]` to `80` and `features["features.usageLimitsControl"]` to `{ "enabled": true, "availability": { "startsAt": "2026-11-01T08:00:00Z" }, "targeting": { "roles": ["beta"] } }`
- **THEN** it validates

#### Scenario: Empty publication

- **WHEN** a payload is `{ "config": {}, "features": {} }`
- **THEN** it validates

#### Scenario: Timestamp with an offset

- **WHEN** `startsAt` is `2026-11-01T08:00:00+02:00`
- **THEN** validation fails with a `pattern` error at that pointer

#### Scenario: Empty role list

- **WHEN** `targeting.roles` is `[]`
- **THEN** validation fails with a `minItems` error

#### Scenario: Unknown policy field

- **WHEN** a feature state contains `"percentage": 5`
- **THEN** validation fails with an `additionalProperties` error, so the field cannot be silently ignored

#### Scenario: Null config value

- **WHEN** `config["announcement.title"]` is `null`
- **THEN** validation fails

### Requirement: Value constraints use only enforceable keywords

Every managed value constraint SHALL be expressible by JSON Schema 2020-12 validation keywords that Ajv enforces with `validateFormats: false`: `type`, `enum`, `minLength`, `maxLength`, `pattern`, `minimum`, `maximum`, `minItems`, `maxItems`, `uniqueItems`, `minProperties`, `required` and `additionalProperties: false`. The schema SHALL NOT rely on `format`. Every managed string and array SHALL have an upper bound. Rules that JSON Schema cannot express SHALL be listed with a stable code in the root `dial:semanticConstraints` annotation and SHALL be enforced by Chat's semantic validator, which returns `{ pointer, code }` issues. Version 1.0.0 defines `calendar_date` (the timestamp exists in the calendar) and `window_order` (`startsAt` earlier than `endsAt` when both are present).

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Non-http link

- **WHEN** an announcement item link `href` is `javascript:alert(1)`
- **THEN** schema validation fails with a `pattern` error

#### Scenario: Out-of-range threshold

- **WHEN** `usageLimits.warningThresholdPercent` is `100`
- **THEN** schema validation fails with a `maximum` error

#### Scenario: Unknown file-manager tab

- **WHEN** `fileManager.availableTabs` is `["all", "nope"]`
- **THEN** schema validation fails with an `enum` error

#### Scenario: Blank text

- **WHEN** `announcement.title` is three spaces
- **THEN** schema validation fails with a `pattern` error

#### Scenario: Impossible date passes the pattern but fails semantics

- **WHEN** `startsAt` is `2026-02-30T00:00:00Z`
- **THEN** schema validation passes and the semantic validator reports `calendar_date` at that pointer

#### Scenario: Inverted window

- **WHEN** `startsAt` is `2026-12-01T00:00:00Z` and `endsAt` is `2026-11-01T00:00:00Z`
- **THEN** the semantic validator reports `window_order` at the availability pointer

#### Scenario: Equal boundaries

- **WHEN** `startsAt` equals `endsAt`
- **THEN** the semantic validator reports `window_order`

### Requirement: Initial managed set

Schema version 1.0.0 SHALL contain exactly these managed keys: `announcement.title` (1–200 characters), `announcement.description` (1–2,000 characters), `announcement.items` (at most 10 items of `{ title, description?, link? }` with link `{ label, href }` and an `http`/`https` `href` of at most 2,048 characters), `welcomeScreen.description` (1–1,000 characters), `fileManager.availableTabs` (1–4 unique values of `all`, `my_files`, `shared`, `organization`), `usageLimits.warningThresholdPercent` (integer 1–99), and the feature `features.usageLimitsControl`. Including a key in this set SHALL NOT be treated as approval to activate it in any deployment. Each key's safe fallback for missing, rejected or stale managed state SHALL be its registry default, and a managed feature SHALL fail closed to `false`.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Exported key set

- **WHEN** the 1.0.0 schema is generated
- **THEN** `properties.config.properties` has exactly the six config keys above and `properties.features.properties` has exactly `features.usageLimitsControl`

#### Scenario: Excluded candidates stay unmanaged

- **WHEN** the registry is inspected
- **THEN** `features.scheduledTasksEnabled`, `features.projectsEnabled`, `footer.html` and `uiFeatures.enabledUiFeatures` are eligible but unmanaged

### Requirement: Snapshot identity acceptance for a runtime consumer

Chat SHALL provide a pure check, performing no I/O and not wired to any reader, that a future runtime consumer applies to a published snapshot `{ instanceId, appId, environment, schemaVersion, schemaSha256, revisionId, sha256, publishedAt, payload }` before using it. The snapshot SHALL be accepted only when:

- `appId` is `chat-ui`;
- `instanceId` equals the configured instance;
- `environment` equals the configured environment when one is configured;
- `schemaVersion` is in the build's supported list;
- `schemaSha256` equals the canonical hash of Chat's own artifact for that version;
- `revisionId` and `sha256` are non-empty;
- the canonical payload is at most 57,344 bytes;
- a `revisionId` seen before still carries the same `sha256`.

Each rejection SHALL return a distinct code: `app_mismatch`, `instance_mismatch`, `environment_mismatch`, `unsupported_schema`, `schema_hash_mismatch`, `invalid_identity`, `payload_too_large`, or `revision_changed`. Payload schema and semantic validation are separate checks with their own issues.

**RTL impact:** None. **i18n impact:** None. **Observability:** None in this change; the check returns codes and logs nothing.

#### Scenario: Matching snapshot

- **WHEN** a snapshot for the configured instance names `schemaVersion` `1.0.0` with the hash from `index.json`
- **THEN** the check returns ok

#### Scenario: Same version, different schema

- **WHEN** a snapshot names `schemaVersion` `1.0.0` but a different `schemaSha256`
- **THEN** the check returns `schema_hash_mismatch`

#### Scenario: Another instance

- **WHEN** the snapshot's `instanceId` is `chat-prod` while the configured instance is `chat-dev`
- **THEN** the check returns `instance_mismatch`

#### Scenario: Unsupported version

- **WHEN** the snapshot names `2.0.0`, which this build does not list
- **THEN** the check returns `unsupported_schema`

#### Scenario: Rewritten revision

- **WHEN** a snapshot repeats an already seen `revisionId` with a different `sha256`
- **THEN** the check returns `revision_changed`

