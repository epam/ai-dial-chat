# managed-config-runtime-reader Specification

## Purpose
Defines how the Chat backend reads, verifies, and keeps the published Config Studio snapshot of each served application identifier through DIAL Core. It also defines which snapshot state a request may use and how failures, staleness, and recovery behave.

## Requirements

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

- **WHEN** `CLIENT_CONFIG_APP_IDS=chat-ui` and `MANAGED_CONFIG_INSTANCES=chat-ui=chat-dev,launchpad=launchpad-dev`
- **THEN** environment validation fails and names `MANAGED_CONFIG_INSTANCES`

#### Scenario: Browser cannot select an instance

- **WHEN** a browser calls `GET /api/v1/client-config?appId=chat-ui&instance=chat-prod`
- **THEN** the response is `400 Bad Request` (`forbidNonWhitelisted`), and `chat-prod` is never read

#### Scenario: Unmapped served identifier

- **WHEN** `CLIENT_CONFIG_APP_IDS=chat-ui,models-garden` and only `chat-ui` is mapped
- **THEN** `appId=models-garden` receives the environment-only response without managed metadata

### Requirement: Runtime read request

For each mapped instance, when the mode is `shadow` or `active`, the backend SHALL request `GET {DIAL_CORE_URL}/v1/deployments/<url-encoded instanceId>/route/v1/published`. The request SHALL carry the header `Api-Key: <MANAGED_CONFIG_API_KEY>` and no session token or cookie. The backend SHALL NOT call Config Studio, Core Files, or a storage service directly.

Each request SHALL:

- have a 5-second deadline;
- stop reading and fail after 131,072 response bytes;
- never be retried with another credential.

At most one request SHALL be in flight per instance. No request SHALL be made per configuration key or per browser request.

#### Scenario: Request shape

- **WHEN** the reader refreshes instance `chat-dev`
- **THEN** exactly one `GET /v1/deployments/chat-dev/route/v1/published` reaches Core, with the reader key and without `Authorization` or `Cookie`

#### Scenario: Browser traffic does not reach Core

- **WHEN** 500 `client-config` requests arrive between two refreshes
- **THEN** no additional runtime-read request is sent

#### Scenario: Oversized response

- **WHEN** Core streams a 200 body larger than 131,072 bytes
- **THEN** the reader stops reading, records `rejected_malformed`, and the active snapshot is unchanged

### Requirement: Response classification

The reader SHALL classify each outcome as follows:

- 200 with a JSON object body within the limit is a candidate;
- 404 with body `{"code":"not_published"}` is `not_published`;
- 401, 403, or a 404 with any other body is `denied`;
- 502 with `{"code":"integrity_mismatch"}` is `rejected_integrity_mismatch`;
- any other 5xx, a network error, or a timeout is `unavailable`;
- any other status, a non-JSON body, or an oversized body is `rejected_malformed`.

#### Scenario: Reader key without a reader role

- **WHEN** Core relays Studio's generic `404` for a key whose roles are not in the instance's `readerRoles`
- **THEN** the outcome is `denied`, an error is logged once per transition naming the instance, and no other credential is tried

#### Scenario: Not published

- **WHEN** Core relays `404 {"code":"not_published"}`
- **THEN** the outcome is `not_published`

### Requirement: Snapshot acceptance

A candidate SHALL be accepted only if every check below passes, in this order.

1. **Identity.** `instanceId` equals the mapped instance and `appId` equals the mapped application identifier. When `MANAGED_CONFIG_ENVIRONMENT` is set, `environment` equals it.
2. **Envelope.** `schemaVersion` is `MAJOR.MINOR.PATCH`. `schemaSha256` and `sha256` are 64 lowercase hexadecimal characters. `revisionId` is a non-empty string of at most 128 characters. `publishedAt` is an ISO-8601 instant. `payload` is a JSON object.
3. **Depth and size.** `payload` nests objects and arrays at most 32 levels deep (the payload itself being level 1), checked without recursion before any other walk of it. Its canonical serialization is at most 57,344 bytes (`MAX_MANAGED_PAYLOAD_BYTES` in `apps/chat-api/src/app-config/managed-config/managed-config.constants.ts`).
4. **Immutability.** For a `revisionId` already accepted on this instance, `sha256` and the canonical payload are unchanged.
5. **For `chat-ui` only:**
   - `schemaVersion` is listed in `SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS`;
   - `schemaSha256` equals its entry in `PINNED_MANAGED_CONFIG_SCHEMA_SHA256`;
   - `payload` validates against that version's committed artifact (`apps/chat-api/managed-config-schema/chat-ui-<version>.json`) under JSON Schema 2020-12, with formats not enforced;
   - `payload` passes the `calendar_date` and `window_order` checks of `apps/chat-api/src/app-config/managed-config/managed-semantics.ts`.

A failed check SHALL reject the whole candidate with a reason: `identity_mismatch`, `malformed`, `payload_too_large`, `revision_changed`, `unsupported_schema`, `invalid_payload`, or `semantic_violation`. A rejection SHALL leave the active snapshot unchanged. A foreign application identifier SHALL skip check 5. Its payload SHALL NOT be validated against any schema by Chat.

At startup, when the mode is not `off`, the backend SHALL verify that each supported artifact's canonical hash equals its pin, and SHALL fail startup otherwise.

#### Scenario: Wrong instance

- **WHEN** the read for `chat-dev` returns a snapshot whose `instanceId` is `chat-prod`
- **THEN** it is rejected with `identity_mismatch` and the previous snapshot stays active

#### Scenario: Schema edited under the same version

- **WHEN** a `chat-ui` snapshot carries `schemaVersion` `1.0.0` with a `schemaSha256` that differs from the pin
- **THEN** it is rejected with `unsupported_schema`

#### Scenario: Unsupported version

- **WHEN** a `chat-ui` snapshot carries `schemaVersion` `1.1.0` and this build supports only `1.0.0`
- **THEN** it is rejected with `unsupported_schema`

#### Scenario: Unknown policy member

- **WHEN** a feature state in a `chat-ui` payload contains `"percentage": 5`
- **THEN** the snapshot is rejected with `invalid_payload`, and the member is never silently ignored

#### Scenario: Impossible date

- **WHEN** a `chat-ui` payload sets `startsAt` to `2027-02-30T00:00:00Z`
- **THEN** the snapshot is rejected with `semantic_violation`

#### Scenario: Changed content for a known revision

- **WHEN** revision `R1` was accepted and a later read returns `R1` with a different `sha256` or payload
- **THEN** it is rejected with `revision_changed`, and the earlier `R1` content stays active

#### Scenario: Foreign payload is not schema-validated

- **WHEN** the read for `launchpad` returns a payload that matches no Chat schema, within the size limit and with a matching identity
- **THEN** it is accepted

### Requirement: Immutable snapshot swap and capture

An accepted candidate SHALL replace the instance's active snapshot atomically, as one deeply immutable parsed value. Each `client-config` response, `isEnabled` call, and `resolveValue` call SHALL capture the instance's snapshot, its state, and the evaluation instant once, and SHALL evaluate every key from that capture. A swap during a request SHALL NOT affect that request.

#### Scenario: Swap during a response

- **WHEN** a new revision is accepted while a `client-config` response is being assembled
- **THEN** every field of that response comes from the earlier revision, and the next response uses the new one

#### Scenario: Snapshot cannot be mutated

- **WHEN** consuming code attempts to modify a value read from the captured snapshot
- **THEN** the modification fails, and later captures are unaffected

### Requirement: Freshness and maximum staleness

Freshness SHALL be the time since the last successful verification of the active snapshot. A verification is the acceptance of a new revision, or a 200 that returns the active revision with unchanged hashes. Freshness SHALL NOT be derived from `publishedAt`.

The captured state SHALL be one of:

| State | Meaning |
| --- | --- |
| `fresh` | A verified snapshot whose last attempt succeeded, within the maximum staleness |
| `degraded` | A snapshot within the maximum staleness whose last attempt failed or was rejected |
| `stale` | A snapshot older than the maximum staleness |
| `unavailable` | No snapshot has been accepted |
| `not_published` | The last outcome was `not_published` |

Only `fresh` and `degraded` SHALL be usable. The state SHALL be computed from the clock at capture time, not only when a refresh runs.

#### Scenario: Staleness boundary

- **WHEN** the maximum staleness is 900 s, the last verification was at `T`, and every refresh since has failed
- **THEN** a capture at `T + 900 s` is `degraded` and usable, and a capture at `T + 900.001 s` is `stale` and unusable, without any refresh completing in between

#### Scenario: Old publication is still fresh

- **WHEN** the active revision was published 30 days ago and verified 10 s ago
- **THEN** the state is `fresh`

### Requirement: Failure states and recovery

The reader SHALL apply these transitions:

| Situation | Result |
| --- | --- |
| Cold start | One attempt per instance, bounded by the request deadline, completes or times out before the server accepts requests. A failure never prevents startup and leaves the state `unavailable` |
| `unavailable`, `denied`, or a rejection while a snapshot is active | The snapshot is kept: `degraded` within the maximum staleness, `stale` beyond it |
| `not_published` | The active snapshot is discarded, and the state is `not_published` |
| Rejection while no snapshot is active | The state stays `unavailable` |
| A later 200 for the active revision | The snapshot is verified again and `fresh` |
| A previously rejected revision that now passes every check | It is accepted |

A rejected revision SHALL be re-evaluated on every refresh, so the same revision can recover. A failure SHALL NOT cause environment values to replace managed values for an active key without the state being reported as unusable.

#### Scenario: Cold start with Core unreachable

- **WHEN** a pod starts while Core is unreachable
- **THEN** startup completes after at most the request deadline, the state is `unavailable`, and refreshes continue with backoff

#### Scenario: Studio backend down within maximum staleness

- **WHEN** a snapshot was verified 5 minutes ago, the maximum staleness is 15 minutes, and Core answers 503 because the Studio backend is down
- **THEN** the state is `degraded` and the snapshot stays usable

#### Scenario: Studio backend down beyond maximum staleness

- **WHEN** the same outage lasts past 15 minutes after the last verification
- **THEN** the state becomes `stale`, managed values for active keys stop applying, and active managed features are `false`

#### Scenario: Denied credentials after a valid load

- **WHEN** the reader key loses its reader role after a successful load
- **THEN** the state is `degraded` until the maximum staleness passes, then `stale`, and an error is logged at each transition

#### Scenario: Integrity mismatch keeps the previous snapshot

- **WHEN** revision `R1` is active and the next read returns `502 {"code":"integrity_mismatch"}`
- **THEN** `R1` stays active as `degraded`

#### Scenario: Unpublished instance discards the snapshot

- **WHEN** revision `R1` is active and the next read returns `not_published`
- **THEN** no snapshot is active and the state is `not_published`

#### Scenario: Recovery with the same revision

- **WHEN** revision `R2` was rejected with `rejected_integrity_mismatch` and a later read returns `R2`, which passes every check
- **THEN** `R2` is accepted and the state is `fresh`

#### Scenario: Recovery from an outage without a new publication

- **WHEN** an outage ends and the read returns the still-active revision `R1` with unchanged hashes
- **THEN** the state returns to `fresh`, no swap occurs, and freshness restarts

### Requirement: Refresh cadence, backoff, and attempt isolation

After a successful attempt, the next attempt for an instance SHALL start after the refresh interval R multiplied by `1 + u`, with u uniformly in [0, 0.1). After n consecutive failed or rejected attempts, the delay SHALL be `min(R × 2ⁿ, 5 × R) × (1 + u)`.

Attempts of one instance SHALL never overlap: the next one SHALL be scheduled only after the previous one ended. A response SHALL apply only while its attempt is current, that is, neither timed out nor stopped. A late response after a timeout SHALL be discarded and counted. Anything an attempt throws, while reading or while applying a result, SHALL count as a failed attempt: polling SHALL continue with backoff, startup SHALL NOT fail, and nothing SHALL escape as an unhandled rejection. Timers and in-flight requests SHALL stop on module shutdown, and a pending first attempt SHALL then settle. The clock and timers SHALL be injectable, so that tests run without real time.

#### Scenario: Backoff is capped

- **WHEN** R is 60 s and four consecutive attempts fail
- **THEN** the following delays fall within [120 s, 132 s), [240 s, 264 s), [300 s, 330 s), and [300 s, 330 s)

#### Scenario: Deeply nested payload

- **WHEN** a mapped foreign instance returns a payload nested 5,000 levels deep
- **THEN** it is rejected as malformed, startup completes, and the next refresh is scheduled

#### Scenario: Late response is discarded

- **WHEN** an attempt times out, a new attempt accepts revision `R2`, and the timed-out response for revision `R1` then arrives
- **THEN** `R1` is not applied, `R2` stays active, and `late_discarded` is counted

### Requirement: Instance and pod isolation

Snapshots, states, accepted-revision memory, caches, and metrics SHALL be kept per instance. A snapshot of one instance SHALL never be used for another application identifier. Separate pods SHALL refresh independently, without shared state. After a publication, pods MAY serve different revisions for at most one jittered refresh interval.

#### Scenario: Two instances

- **WHEN** `chat-ui=chat-dev` and `launchpad=launchpad-dev` are mapped, and `launchpad-dev` returns `not_published` while `chat-dev` is `fresh`
- **THEN** `appId=chat-ui` uses `chat-dev`'s snapshot, `appId=launchpad` has none, and neither response or cache entry contains the other's data

#### Scenario: Separate pods converge

- **WHEN** two backend instances read the same fake Core and a new revision is published
- **THEN** each accepts it within one jittered refresh interval of its own schedule, without communicating with the other

### Requirement: Managed configuration observability

The backend SHALL emit, per instance:

- the counter `dial.chat.managed_config.refresh` by `outcome` (`accepted`, `verified`, `not_published`, `denied`, `unavailable`, `rejected_<reason>`, `late_discarded`);
- the histogram `dial.chat.managed_config.refresh.duration` in seconds;
- the observable gauge `dial.chat.managed_config.snapshot.age` in seconds;
- the observable gauge `dial.chat.managed_config.state` by `state`.

Labels SHALL be limited to the configured instance identifiers and these fixed values. A state transition SHALL be logged once, with the instance, the revision identifier, and the reason. Logs and metrics SHALL NOT contain payloads, configuration values, roles, credentials, or response bodies. Liveness and readiness SHALL NOT depend on managed state.

#### Scenario: Rejection is observable without contents

- **WHEN** a candidate is rejected with `invalid_payload`
- **THEN** `refresh{instance="chat-dev",outcome="rejected_invalid_payload"}` increments and one error log names the instance, revision, and reason, without payload text

#### Scenario: Health is independent of Studio

- **WHEN** the state of every instance is `stale`
- **THEN** `GET /api/health` still reports healthy
