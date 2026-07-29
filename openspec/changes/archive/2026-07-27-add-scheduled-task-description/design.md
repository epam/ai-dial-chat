## Context

Scheduled Tasks (BFF: `apps/chat-api/src/scheduled-tasks/`, lib: `libs/scheduled-tasks`, app glue: `apps/chat/src/utils/map-scheduled-task-dto.ts`) ships create/list/get/update against the DIAL Scheduler. The card and search layers already accept an optional `descriptionPreview` on `ScheduledTaskItem` (`libs/scheduled-tasks/src/models/scheduled-task-item.ts:21`, rendered in `ScheduledTaskCard.tsx:125`, matched in `libs/scheduled-tasks/src/utils/filter-sort.ts:23`), but three links in the chain are missing: the BFF DTOs have no `description` field, `scheduled-tasks.mapper.ts`'s `toUpstreamSchedulePayload`/`fromUpstreamSchedule` don't send or read one, and the create form is explicitly speced to omit a description input. `prompt` is a separate, required field that always maps to `properties.payload.messages[0].content` — this change must not conflate the two.

## Goals / Non-Goals

**Goals:**

- Let a user set an optional, ≤500-character description when creating a schedule, and see it on the list-page card.
- Thread `description` end-to-end: form → BFF request DTO → upstream schedule → BFF response DTO → mapper → card.
- Keep `update` symmetric with `create` (BFF-side only; no edit UI in this change).

**Non-Goals:**

- Building the edit-flow UI (PUT is only extended at the DTO/mapper level so a future edit change inherits the field for free).
- Highlighting matched description text on the card (title-only `Highlight` usage stays as-is).
- Any change to `prompt`, `properties.payload`, or LLM-facing behavior.

## Decisions

**Upstream field name is `description` at the top level of the schedule object, not inside `properties.payload`.** This mirrors `display_name`/`trigger`/`service_id`, which all live at the top level in `UpstreamSchedulePayload`/`UpstreamScheduleResponse` (`scheduled-tasks.mapper.ts:14-46`). *Alternative considered:* nesting it under `properties` alongside the chat-completion payload — rejected because `properties.payload` is defined by the `chat_completion` target-type contract (messages/model/stream) and mixing in unrelated display metadata would blur that boundary. **This name must be confirmed against a live `GET/POST .../route/v1/schedules/` response or the scheduler `openapi.json` before implementation** (per the existing "confirmed against a live upstream response" pattern already used for `next_run_time`/`created_by`/etc. in the current spec). If upstream uses a different key, `toUpstreamSchedulePayload`/`fromUpstreamSchedule` are the only two functions that need to change.

**500-char limit enforced in both layers, independently.** BFF: `@MaxLength(500)` on `CreateScheduledTaskBodyDto.description` and `UpdateScheduledTaskBodyDto.description` (class-validator), returning 400 on violation — consistent with the existing `displayName` `@MaxLength(256)` pattern. Client: `maxLength={500}` on the textarea plus the same limit in the page's client-side validator, so the user gets immediate feedback before the round trip. Neither layer trusts the other.

**Empty description is sent as `undefined`, not `''`.** The create page trims the value and omits the key entirely when empty (matching how `stream` is already optional-and-omittable), rather than sending an empty string that the mapper would have to special-case. This keeps `fromUpstreamSchedule`'s "field absent → `undefined`" contract uniform for `description` alongside `nextRunTime`/`createdAt`/etc.

**Mapper: `map-scheduled-task-dto.ts` gains a one-line addition**, not new logic: `descriptionPreview: task.description` in the object literal returned by `mapScheduledTaskDtoToItem`. No truncation is added here — `ScheduledTaskCard`'s existing line-clamp/ellipsis handling (already required for `descriptionPreview`) is the presentation-layer truncation boundary, and the 500-char cap already keeps the raw value bounded.

**Create form field placement:** `ScheduledTaskCreateForm` renders Description as an optional textarea between **Display name** and **Schedule type**, following the same `values`/`errors`/`onFieldChange` prop contract as `prompt` (required guard) — but Description does NOT participate in the Create-button required-field guard (`displayName`/`modelId`/`prompt` only), since it's optional.

## Risks / Trade-offs

- **[Risk]** Upstream scheduler may not expose `description` on `GET` list items even if it accepts it on `POST`/`PUT` (mirrors the existing gap noted for other optional fields in `scheduled-tasks-api`). → **Mitigation:** spec scenario documents graceful `undefined` fallback on list, matching the existing `nextRunTime`/`createdAt` "does not throw" precedent; no UI assumes presence.
- **[Risk]** Upstream field name differs from `description` (e.g. `notes`, `summary`). → **Mitigation:** isolated to two mapper functions plus one DTO name; design flags this as an implementation-time verification step, not an assumption.
- **[Trade-off]** No character counter is mandated by a11y rules beyond "accessible feedback when non-empty" — exact UI (counter vs. inline error only) is left to implementation to match existing textarea patterns in the repo rather than inventing a new one.

## Open Questions

- Exact upstream field name/casing for description — resolve during `tasks.md` step 1 against a live response or `openapi.json`, before writing the mapper code.
