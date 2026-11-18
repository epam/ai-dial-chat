# managed-config-contract Specification

## Purpose

Which configuration registry keys Chat exports to DIAL Config Studio as managed values, which keys stay local-only and why, and the `{ config, features }` payload shape and its value constraints. Export is not activation: no runtime value depends on the managed classification.

## Requirements

### Requirement: Managed opt-in is explicit and separate from activation

A registry key SHALL be part of the managed contract only when its definition's `management` is a managed config key (`managedConfigKey`) or a managed feature (`managedFeatureKey`). The default SHALL be unmanaged (`management` absent). `management` SHALL be one discriminated value, so a key cannot be both managed and local-only. A managed key's contract SHALL carry an operator-facing English `title` and `description`, a numeric display `order` and an optional `isHidden` flag; a managed config key's contract SHALL also carry a value schema, and a managed feature's contract SHALL NOT, because a feature's value is always a feature state. A managed config key SHALL belong to a `type: 'config'` entry and a managed feature to a `type: 'feature'` entry. Marking a key managed SHALL NOT change any effective resolved value, client-config field, feature-flag result or cache entry; the runtime reads no managed source until a later change adds activation. Operator-facing descriptions SHALL NOT contain environment-variable names, environment values, secrets, or deployment URLs.

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None — operator titles and descriptions are schema annotations rendered by Config Studio, not Chat UI strings.

#### Scenario: Default is unmanaged

- **WHEN** a registry entry has no `management` field
- **THEN** it is absent from the exported schema

#### Scenario: Managed config key without a schema does not compile

- **WHEN** an entry declares `managedConfigKey` with a contract that has no `value`
- **THEN** the TypeScript build fails

#### Scenario: Managed kind that does not match the entry type is rejected

- **WHEN** a `type: 'config'` entry is declared with `managedFeatureKey`
- **THEN** the registry rule test fails and the generator throws

#### Scenario: Description leaks an environment variable name

- **WHEN** a managed key's operator description contains the name of any `EnvironmentVariables` field
- **THEN** the registry rule test fails

### Requirement: Local-only keys are classified with a reason and never exported

A key that depends on a local capability, credential, deployment topology, security policy, backend-enforced limit, build metadata, a derivation from another local value, or opaque client-owned JSON SHALL be classified with `localOnlyKey` and one of the reasons `capability`, `deployment-topology`, `security-policy`, `backend-enforced-limit`, `build-metadata`, `derived` or `opaque`. Local-only keys SHALL never appear in the exported schema, so a payload that contains one is rejected as an unknown key. Every current registry key SHALL be classified, and at least the following SHALL be local-only: `asr.modelId`, `features.asrEnabled`, `utility.modelId`, `features.llmConversationNaming`, `features.orgUnitsEnabled` (DIAL Core org units), `features.liveChatInteraction` (the DIAL Core client channel), `features.scheduledTasksEnabled` (the DIAL Scheduler) and `publish.publicationFilterSources` (claim and category sources the Core and identity-provider deployment defines) as `capability`; `dialCore.externalUrl` and `mcpApps.sandboxUrl` as `deployment-topology`; `overlay.allowedOrigins`, `documents.allowedConnectOrigins`, `customVisualizers`, `applicationVisualizers` and `announcement.html` as `security-policy`; `attachments.maxFileSizeBytes` and the project context limits as `backend-enforced-limit`; `app.version` as `build-metadata`; `features.footer` as `derived`; and `customVariables` as `opaque`. A key that needs a local service or Core feature SHALL be local-only even when the deployment degrades safely without it; a capability check alone does not make such a key manageable. Reclassifying an eligible key as local-only SHALL NOT change its environment resolution or its client-config field.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Local-only key in a payload

- **WHEN** a payload contains `config["asr.modelId"]`
- **THEN** validation against the exported schema fails with an `additionalProperties` error at `/config`

#### Scenario: Server-internal URL is never manageable

- **WHEN** the exported schema is inspected
- **THEN** it contains no property for `dialCore.externalUrl`, `mcpApps.sandboxUrl` or any key whose definition references `DIAL_CORE_URL`

#### Scenario: Keys that depend on Core or identity-provider features are local-only

- **WHEN** the registry is inspected
- **THEN** `features.orgUnitsEnabled`, `features.liveChatInteraction`, `features.scheduledTasksEnabled` and `publish.publicationFilterSources` are local-only with reason `capability`

#### Scenario: Reclassification keeps the environment value

- **WHEN** `ORG_UNITS_ENABLED=true`, `LIVE_CHAT_INTERACTION_ENABLED=true` and `SCHEDULED_TASKS_ENABLED=true` are set and `PUBLICATION_FILTER_SOURCES` is `title,role`
- **THEN** `GET /api/v1/client-config` returns the same `features` and `config` values as before the reclassification

#### Scenario: Reclassification leaves the 1.0.0 artifact unchanged

- **WHEN** the schema generator runs after the reclassification
- **THEN** `apps/chat-api/managed-config-schema/ai-dial-chat-1.0.0.json` and `index.json` are unchanged and the pinned 1.0.0 hash still matches

### Requirement: Managed payload shape

A managed payload SHALL be a JSON object with exactly two required members, `config` and `features`, each an object that may be empty and that rejects any property not declared in the schema. Members SHALL be keyed by full registry keys (for example `onboarding.hints`). A config member SHALL be the key's plain JSON value, never `null`; an omitted key SHALL mean that the publication supplies no value for it. A feature member SHALL be a feature state `{ enabled, availability?, targeting? }`:

- `enabled` is a required boolean;
- `availability`, when present, has at least one of `startsAt` (inclusive) and `endsAt` (exclusive), each a UTC timestamp `YYYY-MM-DDTHH:MM:SS[.fff]Z` with no offset;
- `targeting`, when present, has `roles`: 1 to 50 unique role names, each 1–128 characters with no whitespace or comma; omitted targeting means no role restriction, and an empty list is invalid;
- no other member is accepted.

A schema version that exports no managed feature, such as 1.0.0, still exports the feature state as `$defs/featureState`, which every managed feature of a later version references; the feature-state rules above are checked against that definition.

The canonical serialization of a payload SHALL be at most 57,344 bytes.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Valid payload

- **WHEN** a payload sets `config["onboarding.hints"]` to `[{ "id": "tour.composer", "target": "conversation-input", "title": "Ask anything", "description": "Type a question." }, { "id": "tour.new-chat", "target": "new-chat", "title": "Start a new chat" }]` and `features` to `{}`
- **THEN** it validates

#### Scenario: Valid feature state

- **WHEN** the feature state `{ "enabled": true, "availability": { "startsAt": "2026-11-01T08:00:00Z" }, "targeting": { "roles": ["beta"] } }` is validated against the exported `$defs/featureState`
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

- **WHEN** `config["onboarding.hints"]` is `null`
- **THEN** validation fails

### Requirement: Value constraints use only enforceable keywords

Every managed value constraint SHALL be expressible by JSON Schema 2020-12 validation keywords that Ajv enforces with `validateFormats: false`: `type`, `enum`, `minLength`, `maxLength`, `pattern`, `minimum`, `maximum`, `minItems`, `maxItems`, `uniqueItems`, `minProperties`, `required` and `additionalProperties: false`. The schema SHALL NOT rely on `format`. Every managed string and array SHALL have an upper bound. Rules that JSON Schema cannot express SHALL be listed with a stable code in the root `dial:semanticConstraints` annotation and SHALL be enforced by Chat's semantic validator, which returns `{ pointer, code }` issues. Version 1.0.0 defines `calendar_date` (the timestamp exists in the calendar) and `window_order` (`startsAt` earlier than `endsAt` when both are present).

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Non-http link

- **WHEN** an onboarding hint carries a `link` member with `href` `javascript:alert(1)`
- **THEN** schema validation fails with an `additionalProperties` error at that hint, because a hint has no link member

#### Scenario: Out-of-range threshold

- **WHEN** a 1.0.0 payload sets `config["usageLimits.warningThresholdPercent"]` to `100`
- **THEN** schema validation fails with an `additionalProperties` error at `/config`, because 1.0.0 does not manage the key; its 1–99 range returns with the key in a later version

#### Scenario: Unknown file-manager tab

- **WHEN** a 1.0.0 payload sets `config["fileManager.availableTabs"]` to `["all", "nope"]`
- **THEN** schema validation fails with an `additionalProperties` error at `/config`, because 1.0.0 does not manage the key; its tab enum returns with the key in a later version

#### Scenario: Unknown hint target

- **WHEN** an onboarding hint's `target` is `settings-gear` or a CSS selector such as `#new-chat`
- **THEN** schema validation fails with an `enum` error at that hint's `target`

#### Scenario: Too many hints

- **WHEN** `onboarding.hints` has 51 entries
- **THEN** schema validation fails with a `maxItems` error

#### Scenario: Unknown hint member

- **WHEN** an onboarding hint has a `selector` member
- **THEN** schema validation fails with an `additionalProperties` error at that hint

#### Scenario: Blank text

- **WHEN** an onboarding hint's `title` is three spaces
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

Schema version 1.0.0 SHALL contain exactly one managed key, `onboarding.hints`, and no managed feature. Its value SHALL be an array of at most 50 hints. Each hint SHALL be an object with only the members `id`, `target`, `title` and `description`, of which `id`, `target` and `title` are required: `id` matches `^[A-Za-z0-9._-]{1,64}$`; `target` is one of the `OnboardingHintTarget` values (`apps/chat-api/src/app-config/types/onboarding-hint-target.ts`); `title` is 1–100 characters with at least one non-whitespace character; `description` is at most 500 characters. The array order SHALL be the tour order. The schema SHALL NOT require distinct ids, which JSON Schema cannot express; the client mapping keeps the first hint with an id and drops later ones with a warning, and the key's operator description SHALL say so. A new `OnboardingHintTarget` value SHALL need a new schema version. `announcement.title`, `announcement.description`, `announcement.items`, `welcomeScreen.description`, `fileManager.availableTabs`, `usageLimits.warningThresholdPercent`, `usageLimits.spendingLimitsMode` and `features.usageLimitsControl` SHALL be eligible but unmanaged in 1.0.0. Including a key in this set SHALL NOT be treated as approval to activate it in any deployment. Each key's safe fallback for missing, rejected or stale managed state SHALL be its registry default, and a managed feature SHALL fail closed to `false`.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Exported key set

- **WHEN** the 1.0.0 schema is generated
- **THEN** `properties.config.properties` has exactly `onboarding.hints` and `properties.features.properties` is empty

#### Scenario: Hint targets are the known anchors

- **WHEN** the 1.0.0 schema is generated
- **THEN** the `target` enum of `onboarding.hints` items equals the `OnboardingHintTarget` values, in declaration order

#### Scenario: A new anchor needs a new version

- **WHEN** a value is added to `OnboardingHintTarget` and `MANAGED_CONFIG_SCHEMA_VERSION` is not bumped
- **THEN** the artifact test fails because the committed 1.0.0 differs from the generator output, and the generator refuses to rewrite the pinned version

#### Scenario: Repeated ids pass the schema and the first one wins

- **WHEN** a published tour has two hints with the id `tour.start`
- **THEN** schema validation passes, and the client-config `onboardingHints` contains only the first of them

#### Scenario: Largest publication fits the payload limit

- **WHEN** a payload holds 50 hints with a 64-character id, a 100-character title and a 500-character description
- **THEN** it validates and its canonical serialization is at most 57,344 bytes

#### Scenario: A key that returns in a later version is rejected

- **WHEN** a 1.0.0 payload sets `config["welcomeScreen.description"]` or `features["features.usageLimitsControl"]`
- **THEN** validation fails with an `additionalProperties` error at `/config` or `/features`

### Requirement: Managed opt-in prerequisites

An eligible key SHALL become managed only in a schema version that also meets its prerequisite below. Each prerequisite SHALL be checked by a registry test, so a version that breaks it fails the build.

| Key | Prerequisite |
| --- | --- |
| `footer.html` | `features.footer` is no longer derived only from the local footer value, and the classification of `footer.html` and `announcement.html` is decided together |
| `deployments.defaultDeploymentId`, `features.defaultDeploymentPinned` | both are managed in the same schema version |

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None.

#### Scenario: Footer copy managed while its visibility is still local

- **WHEN** `footer.html` is managed while `features.footer` is still local-only with reason `derived`
- **THEN** the registry test fails

#### Scenario: Default deployment keys move together

- **WHEN** exactly one of `deployments.defaultDeploymentId` and `features.defaultDeploymentPinned` is managed
- **THEN** the registry test fails
