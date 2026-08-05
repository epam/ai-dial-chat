## Context

`ScheduledTasksService` already reads one required-for-feature, optional-in-schema environment variable this way: `SCHEDULER_APP_ID`, guarded by a private `getSchedulerAppId()` that throws `ServiceUnavailableException` on first use if unset. `toUpstreamSchedulePayload` (in `scheduled-tasks.mapper.ts`) is a pure function called from both `createScheduledTask` and `updateScheduledTask`; it currently hardcodes `service_id: 'dial-oauth'` as both a literal value and a literal TypeScript type (`UpstreamSchedulePayload.service_id: 'dial-oauth'`). This change adds a second, structurally identical env-backed value (`SCHEDULER_SERVICE_ID`) and threads it through the same call path.

## Goals / Non-Goals

**Goals:**

- `service_id` sent to the DIAL Scheduler on create/update comes from `SCHEDULER_SERVICE_ID`, read once at service construction.
- Missing `SCHEDULER_SERVICE_ID` fails the same way missing `SCHEDULER_APP_ID` does today: `503 Service Unavailable` on first use, not a silent bad upstream call.
- No change to the shape of `properties` or `target_type`, no change to `SCHEDULER_APP_ID`'s own semantics or the route URL it builds.

**Non-Goals:**

- Migrating schedules already created upstream under `service_id: 'dial-oauth'`.
- Any frontend change — the create form never collects `service_id`.
- Allowlisting specific `service_id` string values in code; any non-empty string an operator configures is valid.

## Decisions

- **Config field shape**: add `SCHEDULER_SERVICE_ID?: string` to `EnvironmentVariables` with `@IsOptional() @IsString()`, matching `SCHEDULER_APP_ID` exactly (not required at the class-validator level, but required functionally once the feature flag is on and an endpoint is hit). Rationale: keeps the existing "optional-but-feature-required" pattern used across this config file (see also `THEMES_CONFIG_URL`) instead of introducing a new validation category.
- **Guard placement**: add a second private field + getter (`schedulerServiceId` / `getSchedulerServiceId()`) in `ScheduledTasksService`, following the exact structure of `schedulerAppId` / `getSchedulerAppId()`. Alternative considered — merging both into one `getSchedulerConfig()` that returns `{ appId, serviceId }` and throws once — rejected because the two are logged/used at different call sites (`getSchedulerAppId()` is used by every URL builder, while `serviceId` is only needed by create/update), so a merged getter would force appId-only callers to also depend on `serviceId` being set, incorrectly widening the failure surface for list/get.
- **Mapper signature**: `toUpstreamSchedulePayload(body, dialCoreUrl, dialApiVersion, serviceId: string)` — a plain 4th parameter, consistent with the function's existing style of passing resolved values in rather than reading config itself (mappers stay pure/config-free). `UpstreamSchedulePayload.service_id` changes from the literal type `'dial-oauth'` to `string`.
- **Call sites**: only `createScheduledTask` and `updateScheduledTask` call the mapper, so both are updated to call `this.getSchedulerServiceId()` before building the payload — mirroring how `buildSchedulesUrl()` already calls `this.getSchedulerAppId()` internally. `fromUpstreamSchedule` (response mapping) is untouched; `serviceId` there is diagnostic (whatever the upstream schedule reports), not a source of truth for outgoing requests.

## Risks / Trade-offs

- [Existing upstream schedules created under `dial-oauth` before this change keeps working, but a newly configured `SCHEDULER_SERVICE_ID` won't retroactively update them] → Out of scope per proposal; operators keep `SCHEDULER_SERVICE_ID=dial-oauth` if they want continuity, which requires no upstream migration.
- [Two independent required-when-feature-on env vars (`SCHEDULER_APP_ID`, `SCHEDULER_SERVICE_ID`) increase deployment configuration surface] → Mitigated by identical fail-fast behavior and identical documentation placement, so operators configure both together from one README section.

## Migration Plan

- Additive, backward-incompatible only for deployments that have `features.scheduledTasksEnabled` on but do not set `SCHEDULER_SERVICE_ID` after this ships — they will start getting `503` on create/update where they previously got a (silently hardcoded) `201`/`200`. Document this in the PR description / release notes so operators set `SCHEDULER_SERVICE_ID=dial-oauth` (or their actual value) before/at deploy time.
- No data migration; no rollback concerns beyond reverting the code change, since no persisted state changes shape.
