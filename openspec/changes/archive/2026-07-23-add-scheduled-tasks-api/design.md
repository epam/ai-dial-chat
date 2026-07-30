## Context

`apps/chat-api` proxies DIAL Core through `@epam/ai-dial-typescript-sdk` for every domain that has SDK coverage (applications, deployments, files, conversations, ...). The DIAL Scheduler is a separate DIAL Core *routed deployment* application (`v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/...`), and the SDK has no generated operations for it — confirmed against the SDK's `components['schemas']` and the client method surface used elsewhere in the codebase (`applications.service.ts:1`, `client-channel.service.ts:46-133`). The upstream contract is documented only informally, in `DIAL Scheduler.postman_collection.json` at the repo root; there is no `openapi.json` snapshot checked into the repo (the collection's `openapi` request is a live discovery call, not a static file), so this design treats the Postman bodies as the source of truth and narrows them rather than passing them through unvalidated.

The frontend `scheduled-tasks-page-ui` capability already ships a route, feature flag, and a lib that always renders an empty state — deliberately, because no backend exists yet. `features.scheduledTasksEnabled` / `FeatureKey.ScheduledTasksEnabled` and the `SCHEDULED_TASKS_ENABLED[_ROLES]` env vars already exist from that change; this change adds the `SCHEDULER_APP_ID` env var and the actual proxy behind the flag.

Two upstream auth mechanisms exist per the Postman collection: `dial-api-key` (server-held API key, sign-in via `/v1/ops/external-service/signin`) and `dial-oauth` (per-user OBO consent via `/v1/ops/external-service/obo-credentials`). Neither credential-provisioning flow is in scope here — this change only creates/reads/updates schedule *definitions* that reference a `dial-oauth` service id already known to the Scheduler app; if a user has never completed OBO consent for the scheduler application, upstream schedule execution fails at run time (out of scope), not at BFF create/update time.

## Goals / Non-Goals

**Goals:**
- Provide four thin, versioned, Swagger-documented BFF endpoints (list/create/get/update) that proxy the DIAL Scheduler routed-deployment API using the caller's session bearer token.
- Hide upstream snake_case and multi-target-type complexity behind a camelCase, `chat_completion` + `dial-oauth`-only contract, so the Chat UI never has to reason about `rest`/`responses`/`dial-api-key` variants.
- Fail fast at boot if `SCHEDULER_APP_ID` is required but misconfigured, consistent with how `DIAL_CORE_URL` and `AUTH_SESSION_SECRET` are validated today.
- Ship a generated-client + `server-api` contract the frontend can compile against, without wiring any UI.

**Non-Goals:**
- Pause/resume/run-history endpoints, delete, credentials sign-in/OBO flows — all separate DIAL Scheduler operations with their own auth and lifecycle concerns.
- Supporting `target_type: rest | responses` or `service_id: dial-api-key` — deferred until a concrete Chat UI use case needs them; validated away with `400` in this iteration.
- List cards and edit-form UI — `scheduled-tasks-page-ui` stays on its empty-state shell until a list-data change lands. Create-form submit is **not** in this change — it is implemented by the companion change `add-scheduled-task-create-form`, which depends on this change's `POST /api/v1/scheduled-tasks` and `scheduled-tasks.api.ts` wrapper.
- A full passthrough/generic schedule model — this design commits to a narrow, typed subset over upstream flexibility.

## Decisions

### D1 — Raw `fetch` against `DialClientService.baseUrl`, not the SDK

The SDK (`@epam/ai-dial-typescript-sdk`) has no `schedules` operations, so `ScheduledTasksService` builds requests manually against `` `${dialClient.baseUrl}/v1/deployments/applications/${encodeURIComponent(schedulerAppId)}/route/v1/schedules...` `` using `getBearerAuthHeaders(accessToken)`, an `AbortController` with a new `SCHEDULER_SERVICE_TIMEOUT_MS` env var (default `10_000`, mirroring `THEMES_SERVICE_TIMEOUT_MS`), and `handleDialFetchError`/`mapDialHttpStatus` for error translation — the same discipline `ThemeService` uses for its non-DIAL fetch path, adapted to `mapDialHttpStatus` since this *is* a DIAL Core-routed call, just one the SDK doesn't cover. `DialClientService` gains no new public surface beyond exposing `baseUrl` (already public).

**Alternative considered:** wait for an SDK update. Rejected — no scheduler methods exist today and the SDK is an external dependency chat-api doesn't control.

### D2 — camelCase DTOs with a fixed `chat_completion`/`dial-oauth` shape, not passthrough

`CreateScheduledTaskBodyDto`/`UpdateScheduledTaskBodyDto` accept only `displayName`, `trigger` (`{ date }` or `{ cron: { fields } }`), `model`, `prompt`, and optional `stream` (default `true`). The service is the only place that knows `service_id: 'dial-oauth'`, `properties.target_type: 'chat_completion'`, `properties.url: \`${dialCoreExternalOrInternalUrl}/openai\`` (using `DIAL_CORE_URL` — no browser ever sees this value; see D5), `properties.api_version` (from `DialClientService.dialApiVersion`), and `properties.payload.{messages,model,stream}`. Upstream responses are mapped back field-by-field into `ScheduledTaskDto` (`id`, `displayName`, `trigger`, `status` if present, `createdAt`/`updatedAt` if present — exact optional fields depend on the live `openapi.json`, see Open Questions).

**Alternative considered (Option B in proposal):** transparent passthrough of the upstream JSON body. Rejected for the Chat UI path — it would leak snake_case and all `target_type`/`service_id` combinations to the frontend, defeating the purpose of a BFF contract and making the frontend responsible for upstream validation it can't perform safely.

### D3 — `scheduleId` validated with an allowlist regex, not free-form

The Scheduler's `SCHEDULE_ID` Postman variable is opaque (empty by default in the collection, no documented format). To stay consistent with the repo's anti-path-traversal discipline (`applications.controller.ts` path params, `theme.controller.ts` icon name), `GetScheduledTaskDto`/`UpdateScheduledTaskDto` params validate `scheduleId` against `^[A-Za-z0-9_-]{1,128}$` via `@Matches`. If the live upstream ID format uses different characters (e.g. UUIDs with hyphens are already covered; confirm during implementation against a real `List schedules` response), the regex is the one place to widen.

### D4 — List cache mirrors `ApplicationsService`, Get is uncached

`listScheduledTasks` uses `withCachedDialRequest` with key `` `scheduled-tasks:list:${userSub}` `` and a 30s TTL, invalidated via `cacheManager.del` after a successful create/update, exactly like `ApplicationsService.createApplication`/`updateApplication`. `getScheduledTask` is not cached: a single schedule is looked up right after create/update (e.g. by a UI form-detail view) or before an update-diff, and a stale 30s-old read would silently discredit the update path — the cost of an uncached single-item GET is far lower than the cost of the List proxy fan-out.

### D5 — `properties.url` built from `DIAL_CORE_URL` (internal), never `DIAL_CORE_EXTERNAL_URL`

The scheduled job's `properties.url` is a value the *Scheduler application* calls server-to-server when the schedule fires — it is never rendered to or fetched by the browser. It therefore uses the same internal `DIAL_CORE_URL` the SDK client itself is constructed with (`DialClientService.baseUrl`), not `DIAL_CORE_EXTERNAL_URL` (reserved for browser-reachable links per `config-registry-and-env-provider`). Mixing the two would be an library-isolation-adjacent layering bug: `DIAL_CORE_EXTERNAL_URL`'s whole purpose is client-facing URLs, and using it here would be incorrect even though both are technically accessible server-side.

### D6 — `SCHEDULER_APP_ID` is required-when-used, not globally required

`SCHEDULER_APP_ID` is declared `@IsOptional()` on `EnvironmentVariables` (like `THEMES_CONFIG_URL`) rather than `@IsNotEmpty()`, because `features.scheduledTasksEnabled` already defaults to `false` and deployments that never enable the flag shouldn't be forced to configure a scheduler app id. `ScheduledTasksService`'s constructor throws a startup-time `Error` (mirroring `DialClientService`'s `DIAL_CORE_URL` check) only when the module is actually instantiated — since `ScheduledTasksModule` is a normal Nest module always loaded, the check instead happens lazily on first request via a guard clause that throws `ServiceUnavailableException` with a clear "SCHEDULER_APP_ID is not configured" message, logged at `error` level. This avoids breaking boot for the common case (flag off, id unset) while still failing loudly and immediately the first time a request needs it.

**Alternative considered:** hard `@IsNotEmpty()` requiring every environment to set `SCHEDULER_APP_ID` regardless of flag state. Rejected — needlessly couples an optional feature to a mandatory env var, breaking existing deployments that haven't opted in.

## Risks / Trade-offs

- **[Risk]** The live Scheduler `openapi.json` / actual response shapes for List and Get were not fetched against a running DIAL Core instance during this design (no reachable `DIAL_URL` in this environment) → **Mitigation:** `ScheduledTaskDto` is deliberately narrow (only fields the Chat UI needs: `id`, `displayName`, `trigger`) and additional upstream fields are dropped rather than guessed at; task 3 (DTOs + mapper) includes an explicit step to fetch `GET {DIAL_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/openapi.json` against a real environment before finalizing field names, and to widen the DTO only with confirmed field names.
- **[Risk]** `scheduleId` regex could reject a valid upstream id format not seen in the Postman collection → **Mitigation:** the regex is isolated in one DTO validator (`@Matches` on `GetScheduledTaskDto`/params), documented as the single widen point in D3, and covered by a unit test asserting the exact accepted character set.
- **[Risk]** Fixing `service_id`/`target_type` server-side means a future multi-target-type UI requires a new DTO variant, not just a field addition → **Mitigation:** accepted trade-off per D2; `properties` construction is isolated in one mapper function so adding `rest`/`responses` later is additive, not a rewrite.
- **[Trade-off]** No cache on Get trades a small latency/load cost for correctness right after writes (D4) — acceptable given Scheduler traffic volume is expected to be low (user-initiated CRUD, not a hot path).

## Migration Plan

1. Ship env var (`SCHEDULER_APP_ID`, optional) + domain scaffold behind the existing `scheduledTasksEnabled` flag (already defaults `false` in all environments) — no behavior change for any environment until an operator sets both the flag and the id.
2. Land endpoints slice by slice (create → get → update → list) per `tasks.md`; each slice is independently revertable since the controller only registers routes once its module is wired into `AppModule`.
3. Regenerate `chat-api-client` and add `server-api` wrappers last — safe because nothing in the frontend imports them yet.
4. **Rollback:** revert the PR(s); this deletes the `scheduled-tasks` domain folder, the env var, the OpenAPI operations, and the generated client methods. No DB/persisted state is introduced (DIAL Scheduler owns all schedule state), so rollback has no data-migration concern. The existing UI shell continues to show its empty state exactly as before this change.

## Open Questions

- Exact field set and casing for `properties`/metadata returned by `GET .../schedules/` (list) and `GET .../schedules/{id}` (get) beyond `display_name`/`trigger` — resolve by calling the live `openapi.json` discovery endpoint or a real List/Get response before finalizing `ScheduledTaskDto`'s optional fields (status, next-run time, timestamps).
- Whether DIAL Scheduler returns a wrapping envelope (`{ items: [...] }`, `{ data: [...] }`) or a bare array for List — the Postman collection's request has no saved example response. `ListScheduledTasksResponseDto` is specified as `{ items: ScheduledTaskDto[] }` at the BFF boundary regardless; the mapper adapts whatever upstream shape is confirmed.
- Whether upstream schedule creation is synchronous (schedule immediately `active`) or requires the OBO consent to already exist — if OBO consent is missing, confirm whether Core returns a 4xx at create time (should map cleanly via `mapDialHttpStatus`) or only fails at run time (silent until the user checks run history, out of scope for this change to surface).
