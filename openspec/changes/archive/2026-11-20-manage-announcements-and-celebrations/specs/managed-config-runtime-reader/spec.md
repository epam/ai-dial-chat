## MODIFIED Requirements

### Requirement: Snapshot acceptance

A candidate SHALL be accepted only if every check below passes, in this order.

1. **Identity.** `instanceId` equals the mapped instance and `appId` equals the mapped application identifier. When `MANAGED_CONFIG_ENVIRONMENT` is set, `environment` equals it.
2. **Envelope.** `schemaVersion` is `MAJOR.MINOR.PATCH`. `schemaSha256` and `sha256` are 64 lowercase hexadecimal characters. `revisionId` is a non-empty string of at most 128 characters. `publishedAt` is an ISO-8601 instant. `payload` is a JSON object.
3. **Depth and size.** `payload` nests objects and arrays at most 32 levels deep (the payload itself being level 1), checked without recursion before any other walk of it. Its canonical serialization is at most 57,344 bytes (`MAX_MANAGED_PAYLOAD_BYTES` in `apps/chat-api/src/app-config/managed-config/managed-config.constants.ts`).
4. **Immutability.** For a `revisionId` already accepted on this instance, `sha256` and the canonical payload are unchanged.
5. **For `ai-dial-chat` only:**
   - `schemaVersion` is listed in `SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS`;
   - `schemaSha256` equals its entry in `PINNED_MANAGED_CONFIG_SCHEMA_SHA256`;
   - `payload` validates against that version's committed artifact (`apps/chat-api/managed-config-schema/ai-dial-chat-<version>.json`) under JSON Schema 2020-12, with formats not enforced;
   - `payload` passes the `calendar_date` and `window_order` checks of `apps/chat-api/src/app-config/managed-config/managed-semantics.ts`.

A failed check SHALL reject the whole candidate with a reason: `identity_mismatch`, `malformed`, `payload_too_large`, `revision_changed`, `unsupported_schema`, `invalid_payload`, or `semantic_violation`. A rejection SHALL leave the active snapshot unchanged. A foreign application identifier SHALL skip check 5. Its payload SHALL NOT be validated against any schema by Chat.

Every supported version SHALL have its committed artifact bundled into the build, and each snapshot SHALL be validated against the artifact of its own `schemaVersion`, never against a newer one. At startup, when the mode is not `off`, the backend SHALL verify that each supported artifact's canonical hash equals its pin, and SHALL fail startup otherwise.

#### Scenario: Wrong instance

- **WHEN** the read for `chat-dev` returns a snapshot whose `instanceId` is `chat-prod`
- **THEN** it is rejected with `identity_mismatch` and the previous snapshot stays active

#### Scenario: Schema edited under the same version

- **WHEN** a `ai-dial-chat` snapshot carries `schemaVersion` `1.0.0` with a `schemaSha256` that differs from the pin
- **THEN** it is rejected with `unsupported_schema`

#### Scenario: Unsupported version

- **WHEN** a `ai-dial-chat` snapshot carries `schemaVersion` `1.2.0` and this build supports only `1.0.0` and `1.1.0`
- **THEN** it is rejected with `unsupported_schema`

#### Scenario: A 1.0.0 snapshot keeps working after the upgrade

- **WHEN** a build that supports `1.0.0` and `1.1.0` reads a `1.0.0` snapshot that sets only `onboarding.hints`
- **THEN** it is accepted against `ai-dial-chat-1.0.0.json`, the tour applies when `onboarding.hints` is active, and the announcement and celebration keys resolve from explicit ENV or their registry defaults

#### Scenario: A 1.1.0 member under the 1.0.0 version

- **WHEN** a snapshot that claims `schemaVersion` `1.0.0` with its pinned hash sets `config["announcement.title"]`
- **THEN** it is rejected with `invalid_payload`, because the 1.0.0 artifact does not declare the key

#### Scenario: A 1.1.0 snapshot is accepted

- **WHEN** a `ai-dial-chat` snapshot carries `schemaVersion` `1.1.0` with its pinned `schemaSha256` and a payload that sets the banner, three announcements and `ui.activeEventId` `new-year`
- **THEN** it is accepted as the instance's snapshot

#### Scenario: Oversized announcement title in a snapshot

- **WHEN** a `1.1.0` snapshot sets `announcement.title` to 201 characters, which Studio would never publish
- **THEN** it is rejected with `invalid_payload`, and the previous snapshot stays active

#### Scenario: Unknown policy member

- **WHEN** a feature state in a `ai-dial-chat` payload contains `"percentage": 5`
- **THEN** the snapshot is rejected with `invalid_payload`, and the member is never silently ignored

#### Scenario: Impossible date

- **WHEN** a `ai-dial-chat` payload sets `startsAt` to `2027-02-30T00:00:00Z`
- **THEN** the snapshot is rejected with `semantic_violation`

#### Scenario: Changed content for a known revision

- **WHEN** revision `R1` was accepted and a later read returns `R1` with a different `sha256` or payload
- **THEN** it is rejected with `revision_changed`, and the earlier `R1` content stays active

#### Scenario: Foreign payload is not schema-validated

- **WHEN** the read for `launchpad` returns a payload that matches no Chat schema, within the size limit and with a matching identity
- **THEN** it is accepted
