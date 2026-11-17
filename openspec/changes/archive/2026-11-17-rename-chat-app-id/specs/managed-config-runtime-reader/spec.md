## MODIFIED Requirements

### Requirement: Trusted instance mapping and reader credential

The backend SHALL read its managed-configuration settings only from validated environment variables:

- `MANAGED_CONFIG_MODE` (`off` by default, `shadow`, `active`);
- `MANAGED_CONFIG_INSTANCES`, comma-separated `appId=instanceId` pairs;
- `MANAGED_CONFIG_API_KEY`;
- `MANAGED_CONFIG_MAX_STALENESS_SECONDS`;
- `MANAGED_CONFIG_REFRESH_INTERVAL_SECONDS` (default 60, 15–3,600);
- `MANAGED_CONFIG_CLIENT_REFRESH_SECONDS` (default 120, 30–900);
- `MANAGED_CONFIG_ACTIVE_KEYS`;
- `MANAGED_CONFIG_ENVIRONMENT`.

They SHALL be declared on the composed `EnvironmentVariables` (`apps/chat-api/src/config/environment.config.ts`).

Unless the mode is `off`, the following SHALL hold, or startup SHALL fail with an `Environment validation failed:` message that names the variable and prints no value:

- the mapping, the key, and the maximum staleness are required;
- every mapped `appId` SHALL match `^[a-z0-9][a-z0-9-]{0,62}$` and be listed in `CLIENT_CONFIG_APP_IDS`;
- every `instanceId` SHALL match `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`;
- no `appId` or `instanceId` SHALL repeat;
- there SHALL be at most 16 pairs;
- the maximum staleness SHALL be an integer from three refresh intervals to 86,400 seconds.

The instance SHALL be selected only by this mapping. No request parameter, header, cookie, or browser input SHALL name or change an instance. A served `appId` without a mapping SHALL keep pure environment behavior. The reader key SHALL be distinct from the session, never forwarded to browsers, and never logged.

**Feature flag:** Not gated through `ENABLED_FEATURES`. The mode is the activation control. **RTL impact:** None. **i18n impact:** None.

#### Scenario: Default deployment reads nothing

- **WHEN** `MANAGED_CONFIG_MODE` is unset
- **THEN** no runtime-read request is ever sent, and no other managed variable is required

#### Scenario: Missing staleness fails startup

- **WHEN** `MANAGED_CONFIG_MODE=shadow` and `MANAGED_CONFIG_MAX_STALENESS_SECONDS` is unset
- **THEN** environment validation fails and names `MANAGED_CONFIG_MAX_STALENESS_SECONDS`

#### Scenario: Mapping for an unserved identifier fails startup

- **WHEN** `CLIENT_CONFIG_APP_IDS=ai-dial-chat` and `MANAGED_CONFIG_INSTANCES=ai-dial-chat=chat-dev,launchpad=launchpad-dev`
- **THEN** environment validation fails and names `MANAGED_CONFIG_INSTANCES`

#### Scenario: Browser cannot select an instance

- **WHEN** a browser calls `GET /api/v1/client-config?appId=ai-dial-chat&instance=chat-prod`
- **THEN** the response is `400 Bad Request` (`forbidNonWhitelisted`), and `chat-prod` is never read

#### Scenario: Unmapped served identifier

- **WHEN** `CLIENT_CONFIG_APP_IDS=ai-dial-chat,models-garden` and only `ai-dial-chat` is mapped
- **THEN** `appId=models-garden` receives the environment-only response without managed metadata

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

At startup, when the mode is not `off`, the backend SHALL verify that each supported artifact's canonical hash equals its pin, and SHALL fail startup otherwise.

#### Scenario: Wrong instance

- **WHEN** the read for `chat-dev` returns a snapshot whose `instanceId` is `chat-prod`
- **THEN** it is rejected with `identity_mismatch` and the previous snapshot stays active

#### Scenario: Schema edited under the same version

- **WHEN** a `ai-dial-chat` snapshot carries `schemaVersion` `1.0.0` with a `schemaSha256` that differs from the pin
- **THEN** it is rejected with `unsupported_schema`

#### Scenario: Unsupported version

- **WHEN** a `ai-dial-chat` snapshot carries `schemaVersion` `1.1.0` and this build supports only `1.0.0`
- **THEN** it is rejected with `unsupported_schema`

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

### Requirement: Instance and pod isolation

Snapshots, states, accepted-revision memory, caches, and metrics SHALL be kept per instance. A snapshot of one instance SHALL never be used for another application identifier. Separate pods SHALL refresh independently, without shared state. After a publication, pods MAY serve different revisions for at most one jittered refresh interval.

#### Scenario: Two instances

- **WHEN** `ai-dial-chat=chat-dev` and `launchpad=launchpad-dev` are mapped, and `launchpad-dev` returns `not_published` while `chat-dev` is `fresh`
- **THEN** `appId=ai-dial-chat` uses `chat-dev`'s snapshot, `appId=launchpad` has none, and neither response or cache entry contains the other's data

#### Scenario: Separate pods converge

- **WHEN** two backend instances read the same fake Core and a new revision is published
- **THEN** each accepts it within one jittered refresh interval of its own schedule, without communicating with the other
