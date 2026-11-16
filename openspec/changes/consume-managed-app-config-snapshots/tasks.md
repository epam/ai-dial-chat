## Slicing

The slices are **vertical and risk-first**. The reader and its failure states (slice 2) are the highest risk. They are proven in `shadow` before any response changes (slices 3 and 4). Each slice ends with `npm run verify:changed`, and the change closes with one `npm run verify:full`.

Paths under `managed-runtime/` and `useClientConfigRefresh` are proposed. Backend specs follow the existing `apps/chat-api/src/app-config/tests/` layout. Before editing `apps/chat-api/**`, read `apps/chat-api/AGENTS.md`.

**Out of scope, recorded as follow-ups:**

- the schema 1.1.0 export with announcement `severity`;
- Studio step 09 enforcement of `calendar_date` and `window_order`;
- the per-application `appId` switches in Launchpad, Models Garden, and Studio;
- live Core and Studio checks.

**Not applicable:**

- i18n keys: no new user-visible strings;
- RTL: no new UI;
- `ENABLED_FEATURES` wiring: not gated.

## 1. Behavior-preserving provider separation

- [x] 1.1 Add the optional internal `managed` member (type `ManagedResolutionView`) to `AppConfigEvalContext` in `apps/chat-api/src/app-config/app-config.types.ts`. `AppConfigService` (`apps/chat-api/src/app-config/app-config.service.ts`) captures it once per `getClientConfig`, `isEnabled`, and `resolveValue`, overwrites any caller value, and leaves it inert (no instance, state `unavailable`). **Verification:** `npm run test:file -- apps/chat-api/src/app-config/tests/app-config.service.spec.ts` (a caller-supplied view is replaced; one capture per response).
- [x] 1.2 Insert a no-op `ManagedConfigProvider` (`apps/chat-api/src/app-config/managed-runtime/managed-config.provider.ts`) at slot 1 of `CompositeConfigProvider` (`apps/chat-api/src/app-config/config-registry/composite-config.provider.ts`), register it in `apps/chat-api/src/app-config/app-config.module.ts`, and replace the "future" comments with the real order. **Verification:** `npm run test:file -- apps/chat-api/src/app-config/tests/config-registry/composite-config.provider.spec.ts apps/chat-api/src/app-config/tests/config-registry/env-resolution-characterization.spec.ts` (characterization matrix unchanged).
- [x] 1.3 Slice check: run `npm run verify:changed`.

## 2. Shadow loader against the runtime read

- [x] 2.1 Add `apps/chat-api/src/config/env/managed-config.env.ts`, composed into `apps/chat-api/src/config/environment.config.ts`, with the variables and cross-field rules of design D2 (mapping ⊆ `CLIENT_CONFIG_APP_IDS`, staleness ≥ 3 × interval, active keys only managed and only in `active`). **Verification:** add `apps/chat-api/src/config/tests/managed-config-environment.spec.ts` (each failure names the variable without values; `off` requires nothing) and run `npm run test:file -- apps/chat-api/src/config/tests/managed-config-environment.spec.ts apps/chat-api/src/config/tests/environment-composition.spec.ts`.
- [x] 2.2 Declare `ajv` (`^8.20.0`, locked at `8.20.0`) in the `dependencies` of `apps/chat-api/package.json`, the manifest the BFF image's pruned deploy output is built from. The root `devDependencies` entry stays for the artifact tests. **Verification:** `npm exec -- nx run @epam/chat-api:prune-lockfile`; `apps/chat-api/dist/package.json` lists `ajv` and `apps/chat-api/dist/package-lock.json` pins `8.20.0`.
- [x] 2.3 Implement the pure acceptance in `apps/chat-api/src/app-config/managed-runtime/snapshot-acceptance.ts`: identity, envelope, canonical size via `apps/chat-api/src/app-config/managed-config/canonical-json.ts`, the immutability map, the supported-version and pin check, Ajv 2020 over the bundled `apps/chat-api/managed-config-schema/chat-ui-<version>.json`, and `validateManagedSemantics`. It also includes the startup verification that each bundled artifact hash equals its pin. **Verification:** add `apps/chat-api/src/app-config/tests/managed-runtime/snapshot-acceptance.spec.ts` (every rejection reason, a foreign payload skipping schema checks, deep-frozen result) and run it with `npm run test:file`.
- [x] 2.4 Implement `apps/chat-api/src/app-config/managed-runtime/snapshot-reader.ts`: `dialClient.fetchCore` to `/v1/deployments/<id>/route/v1/published` with `getApiKeyAuthHeaders` from `apps/chat-api/src/common/utils/auth-header.ts`, the 5 s deadline, a streamed 131,072-byte cap, and the status classification of design D3. **Verification:** add `apps/chat-api/src/app-config/tests/managed-runtime/snapshot-reader.spec.ts` (no `Authorization`/`Cookie`, each status class, oversized stream aborted, timeout) and run it with `npm run test:file`.
- [x] 2.5 Implement `apps/chat-api/src/app-config/managed-runtime/snapshot-store.ts` (the per-instance state machine of design D5, atomic swap, accepted-revision map of 32, capture-time state from the injected clock) and `refresh-scheduler.ts` (jitter, capped backoff, generations, aborts, bounded cold-start attempt in `onApplicationBootstrap`, teardown in `onModuleDestroy`, no timers in `off`). **Verification:** add `apps/chat-api/src/app-config/tests/managed-runtime/snapshot-store.spec.ts`, `refresh-scheduler.spec.ts`, and `managed-runtime.service.spec.ts` (the service over a fake reader) with a fake clock. They cover: cold start, warm outage within and beyond staleness (the Studio backend down as Core 503), denied key, `not_published`, `integrity_mismatch`, incompatible revision, same-revision recovery, late-response discard, backoff bounds, two instances, and two scheduler instances over one fake Core (separate pods). Run them with `npm run test:file`.
- [x] 2.6 Implement the shadow comparison of design D16 (`equal`/`differs`/`env_shadowed`/`absent` per managed key, without values) and wire the reader into `AppConfigModule` for `shadow` and `active`. **Verification:** add `apps/chat-api/src/app-config/tests/managed-runtime/shadow-comparison.spec.ts`. Extend `apps/chat-api/src/app-config/tests/app-config.controller.spec.ts` (supertest) to prove that a `shadow` response body and cache key equal the `off` ones. Run both with `npm run test:file`.
- [x] 2.7 Slice check: run `npm run verify:changed`.

## 3. Controlled key activation

- [x] 3.1 Make `ManagedConfigProvider` return active config values from the captured usable view (design D8), so they flow through `CLIENT_CONFIG_MAPPINGS` in `apps/chat-api/src/app-config/client-config.mapper.ts`. **Verification:** add `apps/chat-api/src/app-config/tests/managed-runtime/managed-activation.spec.ts` over the real resolution stack and a fake reader (managed value applies; explicit ENV wins; omitted member; unusable → ENV/default; sanitized description; unlisted key unchanged) and run it with `npm run test:file`.
- [x] 3.2 Extend the cache key and TTL in `AppConfigService` (design D12: instance, revision, state; TTL clipped by window boundary and staleness; unchanged in `off` and `shadow`). **Verification:** add fake-clock cases to `apps/chat-api/src/app-config/tests/managed-runtime/managed-activation.spec.ts` (a new revision misses the cache; TTL never crosses a boundary or staleness) and run it.
- [x] 3.3 Add the optional `metadata.nextRefreshAt`, `metadata.managed` (`ManagedConfigState` string enum), and top-level `appConfig` to `apps/chat-api/src/app-config/dto/client-config-response.dto.ts`, with full Swagger annotations, and populate them in `active` mode only (design D11, D12). **Verification:** extend `apps/chat-api/src/app-config/tests/app-config.controller.spec.ts` (supertest): `chat-ui` and `launchpad` mapped to two instances; `appConfig` only for `launchpad` with a usable view; no managed fields in `off`/`shadow`; `Cache-Control: private, no-store` kept; an undeclared `instance` query is 400. Run it.
- [x] 3.4 Regenerate the client: run `npm run openapi` and `npm run openapi:check`, then build and lint the generated client with `npm exec nx run-many -t build,lint -p chat-api-client`. The singleton in `apps/chat/src/server-api/api-client.ts` and the wrapper `apps/chat/src/server-api/app-config.api.ts` keep using the normal `getClientConfig` method. **Verification:** the commands pass, and `libs/chat-api-client/openapi.json` shows the optional fields.
- [x] 3.5 Slice check: run `npm run verify:changed`.

## 4. Full feature gates

- [x] 4.1 Implement `apps/chat-api/src/app-config/managed-runtime/managed-evaluation.ts` with pure functions for window activity (inclusive start, exclusive end), role targeting (verified roles, anonymous never matches), and the next boundary. **Verification:** add `apps/chat-api/src/app-config/tests/managed-runtime/managed-evaluation.spec.ts` (fake instants at, before, and after each boundary; one boundary missing; anonymous) and run it.
- [x] 4.2 Compose the gates of design D9 in `AppConfigService.isEnabled` and in the feature loop of `getClientConfig`, for active managed features: ENV `false` kill switch, ENV `true` unable to bypass, policy absent → closed, `isCapabilityAvailable`, window, targeting, and `applyDeploymentRoleGate`. **Verification:** cover in `apps/chat-api/src/app-config/tests/managed-runtime/managed-activation.spec.ts`, through both `AppConfigService` and `FeatureFlagsService`: window opening on an unchanged snapshot, window ending while `degraded`, rolled-back ended window, and a stale instance with ENV `true`. Run it.
- [x] 4.3 Prove that server guards agree with `client-config`. **Verification:** add `FeatureGuard` cases for `FeatureKey.UsageLimitsControl` to `apps/chat-api/src/app-config/tests/managed-runtime/managed-activation.spec.ts`. The guard must refuse (403) an untargeted user and any user after `endsAt`, while `client-config` agrees. Run it.
- [x] 4.4 Slice check: run `npm run verify:changed`.

## 5. Browser refresh

- [x] 5.1 Add `apps/chat/src/hooks/useClientConfigRefresh/useClientConfigRefresh.ts` (JSDoc explaining why; follows the `useAppVersionCheck` event pattern). It covers visibility, focus, `pageshow` persisted, `online`, and a visible-only timer at `nextRefreshAt`, clamped to [15 s, 15 min], with 15 s coalescing. It is inactive without a hint. **Verification:** add `apps/chat/src/hooks/useClientConfigRefresh/tests/useClientConfigRefresh.spec.ts` with fake timers and `document.visibilityState` stubs, and run it.
- [x] 5.2 Update `apps/chat/src/context/AppConfigContext.tsx`: load sequence numbers and identity guards, abort on a newer load, background refresh without `Loading`, catalog-creation state kept for the same identity, a failed refresh keeping `Ready` and values, stable references for unchanged arrays, and `useMemo` kept. **Verification:** extend `apps/chat/src/context/tests/AppConfigContext.spec.tsx` (out-of-order results, identity switch during refresh, failed refresh keeps `useFeatureFlag` true, no request without `nextRefreshAt`) and run it.
- [x] 5.3 Slice check: run `npm run verify:changed`, plus `npm run build:quiet`, because the frontend bundle and the backend's bundled artifact JSON change.

## 6. Observability and documentation

- [x] 6.1 Add `apps/chat-api/src/app-config/managed-runtime/managed-runtime.telemetry.ts` with the instruments of design D17, recorded by the scheduler and the shadow comparison, and the once-per-transition logs without values. **Verification:** add `apps/chat-api/src/app-config/tests/managed-runtime/managed-runtime.telemetry.spec.ts` (bounded labels; no payload, role, or key text in logs) and run it. Confirm that `apps/chat-api/src/health` behavior is unchanged with every instance `stale` (its controller depends only on `ConfigService`, so no managed state can reach it).
- [x] 6.2 Update the documentation in the same commit:
  - `docs/managed-config-schema.md`: a runtime section covering modes, variables, states, gates, the propagation target, the migration runbook (D15), and the rollback;
  - `docs/observability.md`: a "Managed configuration" metric contract;
  - `docs/architecture.md`: the managed-runtime component;
  - the variable table in `apps/chat-api/README.md`.

  **Verification:** `npm run validate:docs`.
- [x] 6.3 Run `npm run validate:specs` and `npm run spec:impact`, and `openspec validate consume-managed-app-config-snapshots --type change --strict --no-interactive`, all green.
- [x] 6.4 Final gate: run `npm run verify:full` once.
