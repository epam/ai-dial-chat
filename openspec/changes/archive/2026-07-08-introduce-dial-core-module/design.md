## Context

`apps/chat-api/src/app/app.service.ts` is registered as a provider in `AppModule` but `AppController` has no routes — the class exists solely as an inheritance base so that 13 domain services can call `super(configService)` in their constructors to obtain a `createSDK({ baseUrl })` client, `configService`, `baseUrl`, `dialApiVersion`, and a (usually overridden) `logger`. Each subclass constructor triggers a fresh `createSDK` call, so the process holds 13 independent SDK client instances pointed at the same `DIAL_CORE_URL` instead of one shared client.

Separately, five of those services (`ModelsService`, `ApplicationsService`, `ApplicationSchemasService`, `DeploymentsService`, `ToolsetsService`) each hand-write the same cache → SDK call → `mapDialHttpStatus`/`handleDialFetchError` → `cacheManager.set` sequence for their list/single read methods, with only the cache key, TTL, and fetch call differing.

Constraints:
- No REST contract may change (routes, DTOs, status codes, OpenAPI) — this is purely an internal wiring/DI change.
- `ApplicationsService` needs raw `fetch` access to `baseUrl` for endpoints the SDK doesn't cover (`/v1/bucket`, `/v1/applications/...`); this escape hatch must survive the refactor.
- `ChatService`, `TranscriptionService`, `ConversationNamingService` need `dialApiVersion` for the `api-version` query param on chat completion calls.
- `DeploymentsService.listDeployments` (interface-filter cache key + fallback read from a base key) and `ToolsetsService.listToolsets`/`getToolset` (redacted cache + post-cache ownership enrichment on both hit and miss) have caching logic that is not a straight cache-hit/cache-miss shape — they must not be force-fit into a helper that would silently change behavior.
- `apps/chat-api/AGENTS.md` currently instructs contributors to inject `ConfigService` + extend `AppService`; it must be updated in the same change so it doesn't describe a pattern that no longer exists.

## Goals / Non-Goals

**Goals:**
- One shared DIAL SDK client instance for the whole process, owned by an injectable `DialClientService`.
- Replace `extends AppService` / `super(configService)` in all 13 services with constructor injection of `DialClientService`.
- Extract the repeated cache-hit/cache-miss/error-map/cache-set flow into a single reusable helper, and migrate the four callers whose caching logic is a straightforward instance of that flow.
- Delete `AppService` once nothing references it.
- Keep every existing test green after each slice; update mocks from `AppService`/`createSDK` spies to `DialClientService` mocks.

**Non-Goals:**
- Splitting god services (`ConversationService`, `FilesService`) into smaller units — out of scope, tracked separately (Phase 2.2+).
- Forcing `DeploymentsService.listDeployments` or `ToolsetsService.listToolsets`/`getToolset` into the cache helper if doing so would obscure or change their current fallback/enrichment behavior — they may keep hand-written caching.
- Any REST endpoint, DTO, status code, or OpenAPI/generated-client change.
- Any frontend change.
- New integration tests (files integration tests remain a separate future item).

## Decisions

**1. `DialCoreModule` is `@Global()`.**
Every domain module needs `DialClientService`; `CacheModule` and `ConfigModule` are already registered globally in this codebase, so following the same pattern avoids re-importing `DialCoreModule` in all 13 domain modules. Alternative considered: non-global module imported explicitly everywhere — rejected as pure boilerplate with no isolation benefit, since there is exactly one DIAL Core backend per deployment.

**2. `DialClientService` owns exactly one `createSDK({ baseUrl })` call, built in the constructor.**
Matches current effective behavior (one client per `baseUrl`), but reduces 13 client instances to 1. Alternative considered: lazy/on-demand client creation — rejected, adds complexity for no benefit since `DIAL_CORE_URL` is static configuration read once at boot.

**3. `DialClientService` exposes `client`, `baseUrl`, `dialApiVersion` as public readonly members (not a wider facade).**
This is the minimal surface every current subclass actually reads from `AppService`. Alternative considered: wrapping every SDK call in `DialClientService` methods (e.g. `listModels()`) — rejected as out of scope; it would turn this refactor into a service-boundary redesign instead of a DI-mechanics change, and duplicates work already tracked for future god-service splitting.

**4. Cache helper (`withCachedDialRequest`) takes an options object with `cacheManager`, `cacheKey`, `ttlMs`, `context`, `logger`, `fetch`, optional `transform`.**
An options object (vs. positional args) keeps call sites self-documenting given 5+ parameters, and matches existing NestJS options-object conventions in this codebase (e.g. DTO-style config). Error handling stays delegated to the existing `mapDialHttpStatus`/`handleDialFetchError` from `common/dial/dial-error.mapper.ts` — the helper is a structural extraction, not a new error-handling strategy.

**5. Only 4 of 5 duplicated-cache services migrate to the helper in this change; `DeploymentsService` and `ToolsetsService` are evaluated case-by-case.**
`ModelsService.listModels`/`getModel`, `ApplicationsService.listApplications`, `ApplicationSchemasService.listApplicationSchemas` are pure cache-hit/cache-miss/set with no extra branching — clean helper fits. `DeploymentsService.listDeployments` has a secondary fallback-key read; `ToolsetsService` has post-cache enrichment that must run identically on both hit and miss paths. Forcing these into the helper's basic shape risks subtly changing when enrichment or fallback reads happen. Decision: attempt migration only if it can be proven behavior-equivalent via existing tests; otherwise leave their hand-written logic in place and note it as a follow-up, per the proposal's explicit allowance.

**6. Migration order: foundation → one simple + one complex PoC → helper → remaining simple → remaining SDK-only services → cleanup.**
Landing `DeploymentsService` early (as the "complex" case) surfaces whether the helper's shape needs adjustment before the other four simple services commit to that shape, avoiding rework.

## Risks / Trade-offs

- **[Risk]** Migrating 13 services' constructors risks missing a call site that still reads `this.client`/`this.baseUrl`/`this.dialApiVersion` post-migration, causing a runtime `undefined` error. → **Mitigation**: migrate one service per commit/slice, run `nx test chat-api` after each, and do a final repo-wide `rg "extends AppService"` grep before cleanup (Slice 6).
- **[Risk]** `ToolsetsService`/`DeploymentsService` caching is subtle (redaction, enrichment, fallback keys); an incorrect helper migration could silently change cached data shape or staleness. → **Mitigation**: keep their current hand-written logic unless a migration is proven equivalent by existing unit tests; this is explicitly allowed to ship unmigrated in this change.
- **[Risk]** Deleting `AppService` before all 13 services are migrated breaks the build. → **Mitigation**: deletion is the last slice (Slice 6), gated on the grep check finding zero remaining references.
- **[Trade-off]** Making `DialCoreModule` global slightly reduces explicitness of module dependencies (any module can inject `DialClientService` without declaring an import) — accepted because the codebase already uses this pattern for `ConfigModule`/`CacheModule`.

## Migration Plan

1. Add `DialCoreModule`/`DialClientService` alongside the existing `AppService`; both coexist temporarily.
2. Migrate services one at a time (or in small batches per slice), each behind green tests, with `AppService` still present but progressively unused.
3. Once `rg "extends AppService"` returns zero hits in `apps/chat-api/src`, remove `AppService` from `AppModule.providers` and delete the file.
4. No feature flag or staged rollout needed — this ships as a single internal refactor behind normal CI (`nx test`/`lint`/`build`); rollback is a plain revert since there is no data migration or external contract change.

## Open Questions

None outstanding — the proposal explicitly allows `DeploymentsService`/`ToolsetsService` to remain unmigrated to the cache helper if equivalence can't be proven, resolving the only ambiguity in scope.
