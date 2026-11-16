## Context

See proposal.md for the motivation. This section separates three kinds of statement: what was observed in this checkout (Chat `origin/development` at `7b6d8472b`), what this change proposes, and assumptions about deployments that have not been verified.

**Observed in Chat:**

- `AppConfigService.getClientConfig` resolves every client key per request through `resolveSelected`: `CompositeConfigProvider` → `applyDeploymentRoleGate`. It then maps values through `CLIENT_CONFIG_MAPPINGS` (`client-config.mapper.ts`). The result is cached per `appId`/user/roles for 60 s in the shared `CACHE_MANAGER` (`app-config.service.ts:30`, `:225`).
- `CompositeConfigProvider` holds `[EnvConfigProvider, StaticDefaultsProvider]`. It swallows provider errors and has a reserved "Slot 1" for a managed provider (`composite-config.provider.ts:28`).
- `EnvConfigProvider` returns a generic value only when the variable is explicitly present (`ExplicitEnvironment`). Special parsers run through the pure `env-admission/*` functions. Capability features are derived from `feature-capabilities.ts`. A blank managed text is not an operator value.
- `FeatureGuard` evaluates with `appId` `chat-ui` through `FeatureFlagsService` → `AppConfigService.isEnabled`. No guard uses `features.usageLimitsControl`, which the UI reads with `useFeatureFlag`.
- The managed contract code is already present:
  - `managed-config.constants.ts`: `SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS = ['1.0.0']`, `PINNED_MANAGED_CONFIG_SCHEMA_SHA256`, `MAX_MANAGED_PAYLOAD_BYTES = 57_344`;
  - `canonical-json.ts`;
  - `validateManagedSemantics` (`calendar_date`, `window_order`);
  - the committed artifact `apps/chat-api/managed-config-schema/chat-ui-1.0.0.json`.

  `ajv` is only a root devDependency, used by tests.
- Core calls with a server key follow `ModelCatalogService`, which uses `getApiKeyAuthHeaders` and shares in-flight requests (`model-catalog.service.ts:65`). Raw route calls follow `DeploymentRouteController`, which uses `dialClient.fetchCore` to `/v1/deployments/<id>/route/<path>` (`deployment-route.controller.ts:74`). The SDK has no deployment-route operation.
- `AppConfigProvider` loads only when authentication settles or the identity changes (`AppConfigContext.tsx:280`). A failed load sets `status: Error`, and `useFeatureFlag` returns `false` unless the status is `Ready`. `useAppVersionCheck` in `libs/chat-hooks` is the existing visible-tab, return, and interval pattern (`useAppVersionCheck.ts:48`).
- Metrics are OpenTelemetry instruments named `dial.chat.<area>.*` (`custom-api-telemetry.ts:50`, `runtime-metrics.ts`).

**External contract (Config Studio, read only).** The runtime read and its responses:

```text
GET {DIAL_CORE_URL}/v1/deployments/<instance>/route/v1/published   (Api-Key: <reader key>)
200 {instanceId, appId, environment, schemaVersion, schemaSha256, revisionId, sha256, publishedAt, payload}
404 {"code":"not_published"}   404 (other body): no reader role or unknown deployment
502 {"code":"integrity_mismatch"}   403: Core admission refused   5xx/503: Core or backend unavailable
```

- The key's roles must be in the instance's `userRoles` and `readerRoles`.
- `Cache-Control: no-store`, and no conditional requests.
- A rollback is an ordinary new revision with a new `revisionId`, the same shape, and no `rollbackOf` field.
- `sha256` hashes the stored revision bytes, not the payload, so Chat cannot recompute it.

**Unverified deployment assumptions.**

- Core accepts an `Api-Key` initiator on a runner instance route.
- The production Studio backend runs at least two replicas.
- Core's added latency on this route is in line with a 5 s read deadline.

None of this has live evidence (Studio `core-compat` is unmet).

## Goals / Non-Goals

**Goals:**

- One in-process reader per served, mapped instance, with bounded cost that is independent of traffic.
- Behavior defined for every failure, and deterministic under a fake clock.
- No silent fallback.
- A mode `off` that is byte-for-byte today's behavior.

**Non-Goals:** in addition to the proposal's:

- no new endpoint;
- no lib changes;
- no Core-side push;
- no cross-pod coordination;
- no per-user Core traffic.

## Decisions

### D1. Architecture: an in-process poller with immutable in-memory snapshots

| Option                                                         | Correctness                                                                 | Delivery risk                              | Performance / security                               | Rollback                 |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------- | ------------------------ |
| A. Poller per instance, swap a parsed snapshot (**chosen**)    | One captured snapshot per request; explicit staleness                       | Moderate: scheduler, state machine         | Fixed Core load (pods × instances / interval)        | Mode `off`               |
| B. Fetch on request with a short cache                         | Mixed snapshots inside one response unless carefully keyed; request latency | Low code, high operational risk            | Core and Studio load scales with traffic; outages surface per request | Same                     |
| C. Push from Studio (webhook/SSE)                              | Needs a Core and Studio capability that does not exist                      | High; two repositories plus Core           | Lowest latency                                       | Complex                  |
| D. Sidecar syncing to a file                                   | Adds a second trust path and file integrity                                 | High: new deployable                       | Credentials outside the BFF                          | Separate rollout         |

B breaks "no Core fetch per key or per browser request". C and D add components the plan explicitly excludes.

**Code placement.** All new backend code is in `apps/chat-api/src/app-config/managed-runtime/` inside the existing domain (no `modules/` wrapper):

- `managed-runtime.config.ts`: the parsed, validated settings;
- `snapshot-reader.ts`: HTTP;
- `snapshot-acceptance.ts`: pure checks;
- `snapshot-store.ts`: the per-instance state machine;
- `refresh-scheduler.ts`: timers, with an injected clock;
- `managed-evaluation.ts`: pure gates and windows;
- `managed-config.provider.ts`: composite slot 1;
- `managed-runtime.telemetry.ts`.

The services are registered in `AppConfigModule`.

### D2. Configuration (new `apps/chat-api/src/config/env/managed-config.env.ts`, composed into `EnvironmentVariables`)

| Variable                                  | Values / default                                                     | Validation (startup fails with `Environment validation failed:` naming the variable)                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MANAGED_CONFIG_MODE`                     | `off` (default) · `shadow` · `active`                                | enum                                                                                                                                                         |
| `MANAGED_CONFIG_INSTANCES`                | `appId=instanceId` pairs, comma-separated, for example `chat-ui=chat-dev,launchpad=launchpad-dev` | Required unless `off`. Each `appId` matches `APP_ID_PATTERN` and is listed in `CLIENT_CONFIG_APP_IDS`. `instanceId` matches `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`. No duplicate `appId` or `instanceId`. At most 16 pairs |
| `MANAGED_CONFIG_API_KEY`                  | secret                                                               | Required and non-blank unless `off`. Never logged. Separate from `DIAL_API_KEY` and `MODEL_CATALOG_API_KEY`, so its Core role can be limited to `readerRoles` |
| `MANAGED_CONFIG_MAX_STALENESS_SECONDS`    | **no default**                                                       | Required unless `off`. An integer from `3 × MANAGED_CONFIG_REFRESH_INTERVAL_SECONDS` to 86,400                                                                |
| `MANAGED_CONFIG_REFRESH_INTERVAL_SECONDS` | 60                                                                   | Integer 15–3,600                                                                                                                                             |
| `MANAGED_CONFIG_CLIENT_REFRESH_SECONDS`   | 120                                                                  | Integer 30–900. The browser's visible interval, sent as `nextRefreshAt`                                                                                      |
| `MANAGED_CONFIG_ACTIVE_KEYS`              | comma-separated registry keys, empty by default                      | Allowed only in `active` mode. Each key must be managed (`managedKeyOf`) in the current schema version. Any other key fails startup                           |
| `MANAGED_CONFIG_ENVIRONMENT`              | optional label                                                       | When set, a snapshot's `environment` must equal it                                                                                                            |

There is deliberately no default staleness, because the production value is an operator decision (D14). An instance-ID pattern is used instead of a Core lookup, because Core is the authority and answers 404 for unknown IDs. Fixed limits are constants, not variables:

- a request deadline of 5 s, matching Studio's per-call read deadline;
- a response body of at most 131,072 bytes;
- a canonical payload of at most `MAX_MANAGED_PAYLOAD_BYTES`.

### D3. Transport

`snapshot-reader.ts` calls `dialClient.fetchCore(`${DIAL_CORE_URL}/v1/deployments/${encodeURIComponent(instanceId)}/route/v1/published`, { headers: getApiKeyAuthHeaders(key), signal })`. It is a raw `fetch` because the SDK has no deployment-route operation (a documented SDK gap, following `DeploymentRouteController`). The body is read as a stream and aborted once it passes 131,072 bytes.

| Upstream                                             | Outcome                                       |
| ---------------------------------------------------- | --------------------------------------------- |
| 200, a JSON object within the limit                  | `candidate` (to acceptance, D4)               |
| 404 with `{"code":"not_published"}`                  | `not_published`                               |
| 401, 403, or 404 with any other body                 | `denied` (configuration error, error log)     |
| 502 with `{"code":"integrity_mismatch"}`             | `rejected: integrity_mismatch`                |
| Other 5xx, network error, timeout                    | `unavailable`                                 |
| Over the byte limit, non-JSON, other status          | `rejected: malformed`                         |

No credential other than `MANAGED_CONFIG_API_KEY` is ever tried, and no session token is forwarded.

### D4. Acceptance pipeline, in order, on a fresh `candidate`

1. **Identity.** `instanceId` equals the mapped instance, `appId` equals the mapped `appId`, and `environment` equals `MANAGED_CONFIG_ENVIRONMENT` when it is set.
2. **Envelope types.** `schemaVersion` is `MAJOR.MINOR.PATCH`; `schemaSha256` and `sha256` are 64 lowercase hex characters; `revisionId` is a string of at most 128 characters; `publishedAt` is an ISO instant; `payload` is an object.
3. **Size.** The canonical bytes of `payload` (`canonical-json.ts`) are at most 57,344.
4. **Immutability.** If `revisionId` is in the instance's bounded map of accepted revisions (the last 32: `revisionId → sha256`, plus the canonical payload hash), both hashes must match. A mismatch is `rejected: revision_changed`.
5. **`chat-ui` only:**
   - `schemaVersion` is in `SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS`, and `schemaSha256 === PINNED_MANAGED_CONFIG_SCHEMA_SHA256[schemaVersion]`; otherwise the result is `rejected: unsupported_schema`;
   - then Ajv validation against that version's artifact schema (`rejected: invalid_payload`);
   - then `validateManagedSemantics` (`rejected: semantic_violation`).

   Foreign `appId`s skip step 5.

**Validator.** Ajv 2020 (`ajv/dist/2020`) with `strict: false` (unknown `dial:*` keywords are annotations), `allErrors: false`, and `validateFormats: false`, the same keyword semantics as Studio (`STUDIO_AJV_OPTIONS` in the artifact tests). At startup, schemas are compiled from the committed artifact JSON files of every supported version, imported into the bundle. Startup fails if a file's canonical hash differs from its pin. `ajv` is declared in the `dependencies` of `apps/chat-api/package.json`, with the version already locked (`8.20.0`). The pruned chat-api deploy output takes its dependencies from that manifest, so the image ships it. The root devDependency stays for the artifact tests.

- **Alternative: build the schema from `CONFIG_DEFINITIONS` at runtime.** Rejected: it covers only the current version, and a pinned older version must keep validating as it shipped.
- **Alternative: a hand-written validator.** Rejected: it would be a second contract implementation.

Rejection never alters the active snapshot. Rejected candidates are not remembered except to deduplicate logs, so the same revision is re-evaluated on every poll and accepted as soon as it validates (same-revision recovery).

### D5. Per-instance state and freshness

The store holds `{ active?: ParsedSnapshot, lastVerifiedAt?, lastOutcome, consecutiveFailures, generation }`. `ParsedSnapshot` is deeply frozen. Freshness is the time since the last successful verification of `active`. Verification means a 200 that names the same revision with unchanged hashes, or the acceptance of a new revision. It is never measured from `publishedAt`.

| State           | Definition                                                                     | Usable | Values for active keys                    | Active managed features |
| --------------- | ------------------------------------------------------------------------------ | ------ | ----------------------------------------- | ----------------------- |
| `fresh`         | `active` present, last attempt verified it, age ≤ max staleness                | yes    | ENV override → managed → default          | gates (D9)              |
| `degraded`      | `active` present, last attempt failed or was rejected, age ≤ max staleness     | yes    | same                                      | gates                   |
| `stale`         | `active` present, age > max staleness                                          | no     | ENV override → default                    | `false`                 |
| `unavailable`   | no `active` (cold start, or never accepted)                                    | no     | ENV override → default                    | `false`                 |
| `not_published` | the last outcome was `not_published`; `active` is discarded                    | no     | ENV override → default                    | `false`                 |

State is computed when the snapshot is captured, from the injected clock. A snapshot therefore becomes `stale` at the exact boundary without waiting for a poll.

| Situation                                                         | Result                                                                                                                  |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Cold start                                                        | One bounded attempt per instance in `onApplicationBootstrap`, awaited for at most the 5 s deadline. Failure never blocks startup; the state stays `unavailable` |
| Warm outage of Core or Studio (5xx, timeout)                      | `degraded` until the age exceeds max staleness, then `stale`. Backoff applies (D6)                                     |
| Studio backend down within / beyond maximum staleness             | Same as a warm outage (Core relays 5xx/503)                                                                             |
| Denied key                                                        | `degraded` → `stale`, with an error log on each transition. Polling continues with backoff, so a fixed role assignment recovers without a restart |
| `not_published`                                                   | `not_published` at once. An explicit "nothing is published" is authoritative and is not a reason to keep last-known-good |
| `integrity_mismatch`, an incompatible revision, any rejection     | `degraded` (previous kept) → `stale`. From `unavailable`, it stays `unavailable`                                        |
| Recovery with the same revision                                   | A later 200 for the same revision verifies it (`fresh`, new `lastVerifiedAt`, no swap). A previously rejected revision that now passes is accepted and swapped |
| A new revision is accepted                                        | Atomic swap of `active`; state `fresh`                                                                                  |

### D6. Scheduler and generations

- **Single in-flight.** There is one timer per instance and at most one request in flight per instance.
- **Next delay.**
  - After a success: `R × (1 + u)` with `u ∈ [0, 0.1)`, where R is the refresh interval.
  - After the n-th consecutive failure: `min(R × 2ⁿ, 5R) × (1 + u)`.
- **Generations.** Each attempt takes `generation = ++counter` and an `AbortController` with the 5 s deadline. The result applies only if its generation is still the latest and it was not aborted. A late response after a timeout, an abort at shutdown (`onModuleDestroy`), or a superseded attempt is discarded and counted as `late_discarded`.
- **No load in `off`.** Mode `off` creates no timers and issues no requests.
- **Injected dependencies.** The clock and the timer are injected (`ManagedRuntimeClock`) for fake-clock tests.

### D7. Persisted last-known-good is not required

The options were:

- an encrypted file on an ephemeral volume, which is lost on reschedule, so it gives little benefit;
- a shared protected store, which needs credentials, integrity, and its own outage handling, and so adds a second source of truth;
- **none (chosen).**

Consequence: a pod that starts while Core or Studio is unreachable serves registry defaults and ENV overrides, and its active managed features are closed, until the first success. The bounded attempt in D5 and rolling deployments (old pods keep serving) limit the exposure. This is revisited only if operations shows frequent cold starts during Studio outages. If a persisted snapshot is ever added, it must pass the D4 identity, schema, and hash checks again on load, and it must live in protected storage.

### D8. One captured view per request; resolution order

- **Captured view.** `AppConfigService` captures `ManagedResolutionView = { appId, instanceId?, state, snapshot?, now }` once at the start of `getClientConfig`, `isEnabled`, or `resolveValue`, using `appId` `chat-ui` for guards. It passes the view in an internal extension of the evaluation context (`AppConfigEvalContext` gains an optional `managed` member that only `AppConfigService` sets and that is never serialized). Every key of one response reads the same snapshot and the same `now`.
- **Provider.** `ManagedConfigProvider` occupies composite slot 1, between `EnvConfigProvider` and `StaticDefaultsProvider`. It returns a value only when all of these hold:
  - the mode is `active`;
  - the key is in `MANAGED_CONFIG_ACTIVE_KEYS`;
  - the view is usable;
  - the payload has the member.

  For a config key it returns the payload value. For a feature it returns the `enabled` bit. The provider order yields `explicit ENV → managed → registry default`. The existing per-provider error handling makes a throwing managed provider fall through to the default. That is the declared safe fallback for values, and features are closed independently by D9.
- **Normalization.** The selected managed value goes through the same `CLIENT_CONFIG_MAPPINGS` normalization as ENV values: sanitizing, trimming, caps, and allow-lists.
- **ENV shadowing.** An explicit ENV value always wins, so a deployment must remove the variable to let a managed value apply. Shadow mode reports this case (D16).

Alternative: a managed branch inside `AppConfigService` that bypasses the composite. Rejected, because it would fork the selection path that the characterization tests protect.

### D9. Feature gate composition

For a feature key `k`:

```text
configuredEnabled = explicitEnv(k) ?? managedEnabled(k) ?? registryDefault(k)

if k ∉ activeKeys:  effective = deploymentRoleGate(configuredEnabled)             # unchanged legacy path
else:
  effective = configuredEnabled === true
          AND envExplicitFalse(k) is false        # ENV false is a kill switch (already implied by configuredEnabled)
          AND viewUsable
          AND managedState(k) present             # an active feature absent from a usable snapshot is closed
          AND isCapabilityAvailable(k)
          AND windowActive(k.availability, now)   # inclusive start, exclusive end; no window = always
          AND targetingMatches(k.targeting, verifiedRoles)   # no targeting = all; anonymous never matches a list
          AND deploymentRoleGate(allowedRolesEnvVar)
```

- ENV `true` sets only `configuredEnabled`, so it can never satisfy another gate.
- Requiring the member keeps activation meaningful: once a feature is active, only a usable publication can enable it.
- Roles are the session's verified roles (`UserRolesService.getRoles`, honoring `rolesClaim`).
- The window is evaluated on every request with the captured `now`, including on unchanged and `degraded` snapshots.
- `FeatureGuard` → `FeatureFlagsService.isEnabled` → `AppConfigService.isEnabled` uses the same function, so server guards enforce the policy independently of UI flags.
- Unknown policy members cannot reach evaluation, because D4 rejects them (`additionalProperties: false`).

### D10. Availability windows before Studio step 09

Studio currently discloses `calendar_date` and `window_order` but does not check them, so Studio may accept a publication that Chat rejects as a whole (D4 step 5). This is accepted:

- the rejection fails closed and keeps the previous snapshot;
- it is visible as `degraded` in metrics and logs;
- Studio can fix it with a new publication or a rollback.

The initial migration set (D15) contains no feature. The runbook requires Studio 09's enforcement before a deployment adds `features.usageLimitsControl` to `MANAGED_CONFIG_ACTIVE_KEYS`. Window evaluation is still fully implemented and tested here, so that activation needs no Chat change later.

### D11. Foreign application payloads

For a served `appId` other than `chat-ui` that has a mapping, in mode `active`, with a usable view, the response carries `appConfig: { schemaVersion, schemaSha256, revisionId, publishedAt, payload }`, where `payload` is the accepted payload unchanged. Without a usable view, `appConfig` is omitted, and `metadata.managed.state` says why. The application validates its own schema. The typed `features` and `config` of a foreign `appId` remain the `chat-ui` ENV-driven values, unchanged. `FeatureGuard` and text refinement keep evaluating `chat-ui`.

### D12. Response cache and refresh hint

- **Cache key.** It becomes `app-config:client:<appId>:user:<userId|anonymous>:roles:<roles|none>:managed:<instanceId>:<revisionId|none>:<state>` when the `appId` is mapped and the mode is not `off`. Otherwise it is unchanged. Activation (a new revision) and every usability transition change the key, which invalidates by construction. Old entries expire through their own TTL.
- **TTL.** `min(60 s, ms until the next startsAt/endsAt boundary of any active feature in the snapshot, ms until staleness expiry)`, with a floor of 1 s.
- **Shadow.** Shadow mode uses the unchanged key and TTL, because responses do not change.
- **Refresh hint.** `metadata.nextRefreshAt` is sent in `active` mode only. Its value is `min(resolvedAt + MANAGED_CONFIG_CLIENT_REFRESH_SECONDS, next boundary, staleness expiry)`, and it is cached together with the response.
- **Managed metadata.** `metadata.managed = { instanceId, state, revisionId?, schemaVersion?, publishedAt? }`, sent in `active` mode for a mapped `appId`. The revision fields are present only when usable. No operator identity, hash, reason, or payload policy is added.

### D13. Browser refresh

- **Hook.** `apps/chat/src/hooks/useClientConfigRefresh/useClientConfigRefresh.ts` is app-level because it serves `AppConfigProvider`, so no lib change is needed. It follows the `useAppVersionCheck` event pattern. While `nextRefreshAt` is present, it triggers a refresh on:
  - `visibilitychange` to visible;
  - window `focus`;
  - `pageshow` with `persisted` (resume);
  - `online`;
  - a timer at `nextRefreshAt`, clamped to [15 s, 15 min], that runs only while visible.

  Triggers within 15 s of the last started load are coalesced. A hidden tab schedules nothing.
- **Provider.**
  - Each load gets a sequence number and the identity at start.
  - A newer trigger or an identity change aborts the in-flight load.
  - A result applies only if its sequence is the latest and the identity is unchanged.
  - A background refresh never sets `status` to `Loading`, and does not reset catalog-creation readiness when the identity is unchanged.
  - A failed background refresh keeps the last values and `Ready`. The server, not the browser, enforces staleness, and server guards are independent.
  - Without `nextRefreshAt` (mode `off` or an older backend), behavior is exactly today's.

### D14. Maximum staleness, interval, and propagation target

**Proposed target:** under normal operation, an open, visible Chat tab shows a new publication within **4 minutes**, and a tab regains it within about **70 s of focus**. The budget is:

- server polling, at most 66 s;
- the server response cache, 0 s, because the revision is in the key;
- the browser interval, at most 120 s by default.

Hidden tabs update on return.

There is no default for maximum staleness. The recommended starting value for dev is 900 s (15 intervals). The production value, and whether 4 minutes is acceptable, are operator decisions recorded in Open Questions. Raising the interval lengthens propagation. Lowering it multiplies Core load by pods × instances.

### D15. Initial migration set

| Stage | Keys                                                                                                                    | Precondition                                                           |
| ----- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Shadow | all 7 managed keys                                                                                                      | mode `shadow`                                                          |
| Active 1 | `welcomeScreen.description`, `usageLimits.warningThresholdPercent`, `fileManager.availableTabs`, `announcement.title`, `announcement.description` | shadow shows no unexplained difference; ENV variable removed per key   |
| Later | `announcement.items`                                                                                                    | Chat exports schema 1.1.0 with `severity` (separate change), and the reader supports it |
| Later | `features.usageLimitsControl`                                                                                           | Studio 09 enforces `calendar_date`/`window_order` (D10)                |

None of these is activated by this change in any real deployment.

### D16. Shadow comparison

In `shadow` mode, each accepted or verified snapshot is compared, without request traffic, against the effective legacy values:

- each `chat-ui` managed key's normalized managed value against the ENV/default value;
- each managed feature's gate result for an anonymous context against the legacy result.

The comparison reports per key one of `equal`, `differs`, `env_shadowed` (an explicit ENV value would win), or `absent`. It records them as a bounded counter (the key label comes from the registry) and one info log per revision. Values are never logged. Responses, cache keys, and `nextRefreshAt` are unchanged.

### D17. Observability

The meter is in `managed-runtime.telemetry.ts`, following `custom-api-telemetry.ts`:

- `dial.chat.managed_config.refresh` (counter): `{instance, outcome}`, where `outcome` is one of `accepted`, `verified`, `not_published`, `denied`, `unavailable`, `rejected_<reason>`, `late_discarded`;
- `dial.chat.managed_config.refresh.duration` (histogram, s);
- `dial.chat.managed_config.snapshot.age` (observable gauge, s): `{instance}`;
- `dial.chat.managed_config.state` (observable gauge, 1 for the current state): `{instance, state}`;
- `dial.chat.managed_config.shadow.comparison` (counter): `{instance, key, result}`.

`instance` is bounded by configuration (at most 16). `revisionId` appears only in logs, never as a label.

- **Logs.** A state transition is logged once (`warn` for degraded or stale, `error` for denied and for rejections), with the instance, revision ID, and reason.
- **Never in logs or metrics:** payloads, values, roles, keys of secrets, or response bodies.
- **Health.** `/api/health` liveness and readiness do not depend on managed state, because a Studio outage must not take Chat down.
- **Documentation.** `docs/observability.md` gains a "Managed configuration" metric contract.

### D18. Announcement `severity` (schema 1.1.0) is a precursor change, not part of this one

Adding it here would mix a frozen-artifact contract change, which needs its own pin, upload, and Studio schema migration, with runtime activation. The reader is version-agnostic: `1.1.0` becomes supported by adding its artifact and pin. Until then, `announcement.items` stays out of the active set, and managed items carry no severity (`info`).

### D19. Separate pods

Pods poll independently, with no coordination. After a publication, different pods may serve different revisions for at most one jittered interval. A browser that alternates between pods may briefly see the previous revision. This is accepted and documented. Pods converge without shared state, and tests run two service instances over one fake Core.

## Risks / Trade-offs

- **The reader's Core identity.** Core must accept an API-key initiator on the instance route, and the key must hold a reader role. This is unverified live. → Startup and runtime logs state `denied` explicitly, and the live check belongs to Studio `core-compat` plus a Chat deployment smoke.
- **ENV values shadow managed values.** An existing ENV value silently wins over a managed value (by design). → Shadow `env_shadowed` results, and a runbook step to remove the variable before listing the key.
- **Whole-snapshot rejection.** One invalid window makes the whole instance `degraded` and eventually `stale` (D10). → No feature in the initial set, metrics alert on `degraded`, and Studio rollback.
- **Cold start during an outage.** Defaults and closed features are served (D7). → A bounded first attempt, and rolling deployment.
- **Browser load.** Visible tabs poll every 120 s. → Server-side per-user cache; hidden tabs do not poll; the interval is configurable.
- **Disclosure.** `metadata.managed.instanceId` and `revisionId` are visible to anonymous callers. → Both are non-secret identifiers that are already part of the published read, and no operator identity or policy is exposed.
- **Bundle size.** `ajv` becomes a runtime dependency of the BFF image (about 120 KB). → It is already in the lockfile, the prune step keeps only the chat-api manifest's `dependencies`, and Trivy covers it.

## Migration Plan

1. Deploy with `MANAGED_CONFIG_MODE` unset (`off`). Behavior is identical.
2. Studio and Admin create the instance with the reader role. Chat's deployment receives `MANAGED_CONFIG_API_KEY`, `MANAGED_CONFIG_INSTANCES`, and `MANAGED_CONFIG_MAX_STALENESS_SECONDS`.
3. `shadow`: watch the refresh and state metrics and the shadow comparisons. Remove ENV variables that shadow keys about to be activated.
4. `active` with the Active 1 set (D15). Verify `metadata.managed.state` and the propagation target.
5. Later sets after their preconditions.

**Rollback.** Remove keys, or set `MANAGED_CONFIG_MODE=off`. This is a deliberate deployment change, effective on the next request, because the cache keys change with the mode. A configuration rollback is done in Studio as a new revision.

## Open Questions

These are operator inputs. They do not change the specs or tasks.

- The production `MANAGED_CONFIG_MAX_STALENESS_SECONDS`, and acceptance of the 4-minute propagation target.
- Which deployments, and when, move from `shadow` to Active 1.
- Whether `metadata.managed` should be withheld from anonymous callers in some deployments. It is currently always included in `active` mode, for diagnostics.
