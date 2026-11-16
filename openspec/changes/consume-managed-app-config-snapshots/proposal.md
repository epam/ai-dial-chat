## Why

Chat exports its managed contract (`chat-ui-1.0.0.json`, #9787), and Config Studio publishes, inspects, and rolls back instance snapshots behind `GET /v1/deployments/<instance>/route/v1/published`. Chat still reads only ENV. `CompositeConfigProvider` keeps an empty "future" managed slot (`apps/chat-api/src/app-config/config-registry/composite-config.provider.ts:28`). An open browser tab never refreshes client config: `AppConfigProvider` loads only when the identity changes (`apps/chat/src/context/AppConfigContext.tsx:280`). Without a reader, a Studio publication has no effect. Activation also needs guarantees that ENV never had: a fresh snapshot, fail-closed features, and no silent fallback.

## What Changes

- **Reader.** A server-side reader that polls the runtime read of each served application identifier mapped to a Config Studio instance in trusted deployment configuration. It uses Chat's own reader key and goes through Core only. Polling is bounded: jitter, backoff, a timeout, and a response byte limit, with one request in flight per instance.
- **Acceptance and swap.** Identity, schema version and pinned hash, size, and revision immutability are checked. `chat-ui` payloads also pass schema and semantic validation. An accepted snapshot becomes one immutable parsed snapshot, swapped atomically. A late response after its attempt timed out is discarded, and nothing a snapshot contains can stop polling or the process.
- **Freshness.** Freshness counts from the last successful verification. Last-known-good is kept only in memory and is usable up to an explicit maximum staleness. The design defines a state for each case: cold start, warm outage, stale, denied key, `not_published`, `integrity_mismatch`, incompatible revision, and recovery with the same revision.
- **Staged activation** through `MANAGED_CONFIG_MODE`:
  - `off` (default) is exactly today's behavior;
  - `shadow` compares managed and effective values without changing responses;
  - `active` applies managed values only to the keys listed in `MANAGED_CONFIG_ACTIVE_KEYS`.
- **Values and features.** Values resolve as explicit ENV → managed → registry default, through the existing shared normalization. A managed feature is enabled only when every gate holds: usable policy, the configured enabled bit, local capability, the availability window, managed role targeting, and any deployment role gate. ENV `true` cannot bypass a gate, and ENV `false` is a kill switch. `FeatureGuard` evaluates the same gates.
- **`GET /api/v1/client-config`** keeps every existing field and `Cache-Control: private, no-store`. Optional fields are added, with updated Swagger and generated client:
  - `metadata.managed`: instance, revision, publication time, state;
  - `metadata.nextRefreshAt`;
  - a top-level `appConfig` for served identifiers other than `chat-ui`, delivered unchanged and not validated against a foreign schema.

  The per-user response cache key gains the instance, revision, and usability state, and its TTL is clipped at the next window boundary and at staleness expiry.
- **Browser refresh.** `AppConfigProvider` also refreshes when the tab becomes visible, on focus, on resume, and at the server-hinted interval while visible. Requests are cancellable, stale results are rejected, and a refresh does not drop back to the loading state. It is enabled only when the response carries `nextRefreshAt`.
- **Observability and docs.** Metrics and logs for refresh outcomes, snapshot age, and state, never contents or credentials. Documentation of the variables, the migration runbook, and the propagation target.

No breaking change. In mode `off`, requests, responses, and browser behavior are unchanged.

## Capabilities

### New Capabilities

- `managed-config-runtime-reader`: trusted instance mapping and reader credential; polling, limits, and attempt isolation; snapshot acceptance; immutable swap; freshness and maximum staleness; failure states and recovery; observability.
- `managed-config-activation`: modes `off`/`shadow`/`active`; per-key activation; value resolution order; feature gate composition; time-window and role-targeting evaluation; server-guard enforcement; delivery of foreign payloads.

### Modified Capabilities

- `client-config-endpoint`: the optional managed metadata, `nextRefreshAt`, and `appConfig` fields; a response cache keyed and bounded by the managed snapshot; the list of allowed response metadata.
- `app-config-context`: replaces "no polling or timed refresh" with visibility, focus, resume, and hinted-interval refresh that keeps the ready state.
- `config-registry-and-env-provider`: the managed source between explicit ENV and the registry default; role gates compose with managed policy; the cache reference.
- `feature-flags-service`: `isEnabled` applies the managed feature gates and fails closed on unusable managed state.

## Non-goals

- Enabling managed reading in any real deployment, or choosing production values. Staleness, interval, and the key list are operator inputs that must be set explicitly.
- Exporting schema 1.1.0 with announcement `severity`. It is a separate precursor change, and `announcement.items` stays out of the initial active set until it lands.
- Persisted last-known-good. It is not required (design D7). A cold start without Core serves defaults and closed features.
- Scheduled config values, percentage rollout, user or tenant targeting, and validation of foreign application schemas.
- Changes to Config Studio, Launchpad, Models Garden, or the Studio policy editor (Studio step 09).

## Acceptance criteria

- With `MANAGED_CONFIG_MODE` unset, the characterization tests, the client-config response, and the browser network pattern are unchanged.
- Fake-clock tests show:
  - jittered polling with backoff;
  - maximum staleness turns a warm snapshot unusable at the exact boundary;
  - inclusive `startsAt` and exclusive `endsAt`, also on an unchanged and on a last-known-good snapshot;
  - a cache TTL that never crosses a window boundary or staleness expiry.
- Each of these keeps the previous usable snapshot and reports the rejection:
  - wrong instance or `appId`;
  - an unsupported version or a hash that does not match the pin;
  - an oversized payload;
  - a schema or semantic failure;
  - changed content for a known `revisionId`;
  - a late response after its attempt timed out.
- `not_published` drops managed state at once. A denied key and Core or Studio 5xx keep last-known-good within staleness and fail closed beyond it. After a rejection, the same revision is accepted once it validates.
- Two instances, `chat-ui` → A and `launchpad` → B, never share snapshots, caches, or responses. Two service instances (separate pods) over one fake Core converge independently.
- ENV `false` disables an active managed feature, and ENV `true` cannot enable one whose policy is unusable, outside its window, or untargeted. `FeatureGuard` agrees with `client-config`.
- Browser tests show:
  - refresh on visibility, focus, resume, and the hinted interval;
  - no refresh while hidden;
  - abort on identity change;
  - a stale or old-identity result is rejected;
  - a failed refresh keeps the last values in the ready state.
- `npm run openapi:check`, `npm run validate:specs`, `npm run validate:docs`, and one `npm run verify:full` pass.

## Alternatives considered

- **ENV only (baseline).** Kept as mode `off` and as the explicit deployment rollback. Rejected as the end state because Studio publications would have no effect.
- **A fetch per request or per key.** Rejected: it couples every page load to Core and Studio latency and availability, and breaks "one captured snapshot per request".
- **Persisted last-known-good on disk.** Rejected for now. Container storage is ephemeral, a protected store would need its own integrity scheme, and cold-start defaults are a safe documented outcome (design D7).
- **A hand-written payload validator.** Rejected: it duplicates the generated schema. The reader compiles the pinned artifact with Ajv (design D4).

## Rollback and compatibility

Every response field added is optional, and older browsers ignore them. Rollback is one of:

- **Explicit.** Set `MANAGED_CONFIG_MODE=off`, or remove keys from `MANAGED_CONFIG_ACTIVE_KEYS`. Effective behavior returns to ENV on the next request. This is a deliberate deployment change, never an automatic reaction to failure.
- **Code.** Revert the change. The generated client returns to its previous optional fields.

## Impact

- **Backend:**
  - new `apps/chat-api/src/app-config/managed-runtime/` (reader, acceptance, store, scheduler, evaluation, telemetry) and `apps/chat-api/src/config/env/managed-config.env.ts`;
  - changes to `AppConfigService`, `CompositeConfigProvider`, `AppConfigModule`, `FeatureFlagsService`, and the response DTOs;
  - `ajv` is added to the `dependencies` of `apps/chat-api/package.json`, the manifest the BFF image's pruned output is built from, because the reader needs it at runtime.
- **Frontend:** `apps/chat/src/context/AppConfigContext.tsx`, a new `apps/chat/src/hooks/useClientConfigRefresh/useClientConfigRefresh.ts`, and the generated client (`libs/chat-api-client`). No hand-authored lib changes.
- **Docs:** `docs/managed-config-schema.md` and a new runtime section, `docs/architecture.md`, `docs/observability.md`, and the variable table in `apps/chat-api/README.md`.
- **i18n / RTL / a11y:** no new user-visible strings and no new UI surface.
- **External contracts (read only):** Config Studio's runtime read (`docs/core-integration.md` "Runtime read", spec `runtime-config-read`). Studio step 09 must enforce `calendar_date` and `window_order` before a deployment activates a managed feature with an availability window (design D10).
