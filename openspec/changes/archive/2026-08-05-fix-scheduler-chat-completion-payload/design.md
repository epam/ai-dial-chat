## Context

`toUpstreamSchedulePayload` (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts`) builds the request body `ScheduledTasksService.createScheduledTask`/`updateScheduledTask` POST/PUT to DIAL Scheduler (`.../route/v1/schedules/`). The Scheduler runs each schedule by calling DIAL Core chat completion with `properties` as the call spec. Today `properties` only carries `target_type`, `url`, `api_version`, and a `payload` with `stream` nested inside it (client-controlled, default `true`). The Scheduler team has specified the full set of fields a `chat_completion`/`dial-oauth` schedule needs, and flagged that `create_conversation: true` is required for the run to create a conversation under `.scheduler/{scheduleId}/{runId}/`, and that background runs must be non-streaming (`properties.stream: false`, not nested in `payload`).

`url` and `api_version` are already sourced correctly (`DialClientService.baseUrl` / `DialClientService.dialApiVersion`, both backed by env with `ChatService.sendCompletion` reading `dialApiVersion` from the same field) — this change tightens their construction and test coverage rather than re-deriving them from a new source.

## Goals / Non-Goals

**Goals:**
- Emit the complete upstream `properties` object: `target_type`, `url`, `api_version`, `create_conversation: true`, `stream: false`, `extra_headers: {}`, `retry: null`, `timeout: null`, `payload: { messages, model }`.
- Normalize URL construction (strip trailing slash from base, append `/openai`) via a small pure, unit-tested helper.
- Remove client control over `stream` end-to-end: DTO, OpenAPI, generated client, create form.
- Keep `api_version` sourced from `DialClientService.dialApiVersion` and stop hardcoding an unrelated preview version string in tests.

**Non-Goals:**
- Changing `service_id`, trigger validation/shape, list/sort/pagination, or OBO consent flows.
- Introducing per-request overrides for `extra_headers`/`retry`/`timeout` — they are fixed constants per the Scheduler team's spec, not configurable.
- Exposing `DIAL_CORE_URL`/`DIAL_API_VERSION` to the browser — the server continues to own these env reads.

## Decisions

**`create_conversation`, `extra_headers`, `retry`, `timeout` are compile-time constants in the mapper, not DTO fields.** They have exactly one valid value today (`true`, `{}`, `null`, `null`) and no product requirement to vary per-schedule. Adding them as optional DTO fields would let a client override values the Scheduler team says must be fixed, and would require validating combinations that have no meaning yet. If the Scheduler team later needs per-schedule overrides, that's a new proposal with its own validation rules — not a default assumed here.

**`stream` moves from `properties.payload.stream` to `properties.stream`, fixed to `false`, and is deleted from the public DTOs.** Alternative considered: keep `stream` as an optional DTO field but ignore its value server-side. Rejected — an accepted-but-ignored field is confusing API surface and the OpenAPI contract would lie about client control that doesn't exist. Removing it outright from `CreateScheduledTaskBodyDto`/`UpdateScheduledTaskBodyDto` is a breaking change to the internal BFF contract, but there are no external consumers of this endpoint beyond this repo's own frontend, and the create form never rendered a visible toggle for it (verified: no `streamLabel`/switch usage found in `ScheduledTaskCreateForm.tsx` or `en.json`) — so removal has no user-facing UI impact, only a values/props/mapping cleanup.

**URL construction is extracted into `buildScheduledTaskChatCompletionUrl(baseUrl: string): string`.** Alternative considered: leave the inline template string (`` `${dialCoreUrl}/openai` ``). Rejected — `DialClientService.baseUrl` is read from `DIAL_CORE_URL` at startup with no guarantee about a trailing slash, and the inline form would silently produce `http://core//openai` for a base URL configured with a trailing slash. A small pure helper is easy to unit test against `http://core`, `http://core/`, and (defensively) `http://core/openai` inputs, and keeps the normalization logic out of the mapper's object-literal shape.

**`api_version` and `url` keep their current source (`DialClientService`), only test fixtures change.** The existing mapper spec hardcodes `'2025-01-01-preview'`, a stale value unrelated to the `DIAL_API_VERSION` default (`2024-10-21`) `DialClientService` actually falls back to. Tests are updated to use a fixture matching that default (or clearly labeled as an arbitrary placeholder), so a future reader doesn't mistake the test value for a real, still-relevant API version.

## Risks / Trade-offs

- [Risk] Removing `stream` from the DTOs is a breaking change to the BFF request/response contract → Mitigation: no external consumers exist outside this repo; regenerate `@epam/chat-api-client` and update every internal call site (create form, page, mapping util) in the same change so nothing references the removed field.
- [Risk] The exact upstream `properties` shape (field names, whether `/openai` needs a trailing slash) is asserted from the Scheduler team's spec, not re-confirmed against a live Scheduler instance in this change → Mitigation: manual verification step in tasks.md inspects the actual upstream POST body against a running Scheduler before merge; keep the existing code comment convention (already used in this file for the `description` field) noting anything still unconfirmed.
- [Risk] Fixing `stream: false` removes the only lever to test streaming scheduled runs → Mitigation: not a regression — the Scheduler team's guidance is that background runs are non-streaming by design; interactive streaming stays in the normal chat path (`ChatService.sendCompletion`), which this change does not touch.

## Migration Plan

- Single-PR change: mapper + DTOs + OpenAPI regen + generated client + frontend cleanup land together so no intermediate state has a DTO/implementation mismatch.
- No data migration — this only affects the shape of new outbound Scheduler create/update calls. Existing schedules already created upstream are unaffected until their next update.
- Rollback: revert the PR; the previous (incomplete) `properties` shape resumes, no persisted state depends on the new fields.
