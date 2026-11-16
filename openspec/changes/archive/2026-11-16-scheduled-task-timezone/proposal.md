# Proposal

## Why

Scheduled tasks have no time zone. The frontend converts the user's local time to UTC cron fields with **today's** offset (`libs/chat-hooks/src/scheduled-task/scheduled-task-trigger.ts`), and DIAL Scheduler runs those fields in UTC. A "Daily 09:00" task created in summer therefore fires at 08:00 in winter, and weekly/monthly days drift the same way. A task also cannot target a zone other than the browser's. See GitHub issue #9680.

DIAL Scheduler now supports a per-schedule `timezone` (IANA ID, default `"UTC"`) and evaluates cron fields and naive `date`/`start_date`/`end_date` as **local wall time in that zone**, including DST handling. The chat stack can stop converting and start sending local time plus a zone.

## Problem

- Recurring tasks drift by an hour twice a year in any DST zone.
- Users cannot pick a zone different from their browser's.
- The edit page reads cron fields back with the browser's *current* offset, so the same task shows different times in different seasons.

## What Changes

- **chat-api**: add an optional top-level `timezone` (IANA ID) to the create/update body and to the task response; validate it (`400` on an unknown ID); forward it to DIAL Scheduler and map it back. Regenerate the OpenAPI document and `libs/chat-api-client`.
- **libs/chat-hooks**: add a non-rendering time-zone module (list, offset/abbreviation labels, sort, search) and rewrite the trigger mapping so cron fields, `date`, `startDate` and `endDate` carry **local wall time plus `timezone`**. The UTC shifting helpers are removed. A one-time `date` may be read back from an old task as a UTC instant and is converted into the task's zone for display.
- **libs/scheduled-tasks**: add `timezone` to the create-form values; add a props-only `ScheduledTaskTimezoneField` (a "Change timezone" link under the Time field that opens a searchable, grouped list built from UI-kit parts); evaluate "run at" and "start/end date in the past" checks in the selected zone.
- **apps/chat**: fill the picker's options and labels (`t()` keys), default the zone to the browser's, send `timezone` on every create/update, and show the zone in the card and detail schedule labels when it differs from the browser's.
- **Docs/specs**: lib READMEs, `docs/scheduled-tasks-reuse.md`, and the `scheduled-task-create-form` and `scheduled-tasks-api` specs.

### Decisions already made

| Topic | Decision |
|---|---|
| Zone list | Full IANA list from `Intl.supportedValuesOf('timeZone')`, plus `UTC` added manually (it is missing in Node 24 and may be in Chrome). |
| Row label | `GMT+01:00  Europe/Berlin • CET` (variant A). The abbreviation is shown only where `Intl` returns letters; it is locale-dependent. |
| Sort | By UTC offset, then alphabetically within one offset. |
| DST | Gap: fire once, shifted forward by the gap. Repeat: fire once, at the first occurrence. Both are implemented by DIAL Scheduler. |
| Conversion library | None. The scheduler converts wall time; the frontend only formats it with `Intl`. |
| Existing tasks | Read back as `UTC` with unchanged fields, so their run times do not change. |

### Non-goals

- A curated or generic-name ("Central European Time") zone list.
- Changing run history, next-run display, or the one-time past-time rule beyond evaluating them in the task's zone.
- Backfilling a real zone onto existing tasks.
- A DIAL Scheduler change (it is already shipped; the missing test for a one-time `date` in a DST gap is a follow-up for that team).

### Alternatives considered

| Option | Verdict |
|---|---|
| Keep converting to UTC in the browser and store the zone only for display | Rejected: does not fix the DST drift, which is the whole problem. |
| Convert wall time to UTC in the frontend with Temporal / `@date-fns/tz` and send UTC + zone | Rejected: the scheduler already does this correctly (including gaps and repeats); a second implementation can disagree with it. |
| Send local wall time + `timezone` (chosen) | Fixes drift, no new dependency, smallest mapping code. |

## Capabilities

### New Capabilities

- `scheduled-task-timezone`: choosing, persisting, listing, labelling, searching and displaying a scheduled task's IANA time zone.

### Modified Capabilities

- `scheduled-task-create-form`: the form-to-trigger mapping, the activity-window boundaries and the reverse (edit) mapping now carry local wall time plus a zone instead of UTC-shifted values.
- `scheduled-tasks-api`: the create/update/read contract gains the `timezone` field and accepts zone-local (offset-less) `date`/`startDate`/`endDate`.

## Impact

- **Code**: `apps/chat-api/src/scheduled-tasks/` (DTOs, `scheduled-tasks.mapper.ts`, `scheduler-upstream.client.ts`), `libs/chat-api-client` (generated), `libs/chat-hooks/src/scheduled-task/` and `libs/chat-hooks/src/shared/`, `libs/scheduled-tasks/src/` (form, models, validation), `apps/chat/src/pages/ScheduledTaskCreatePage`, `apps/chat/src/pages/ScheduledTaskEditPage`, `apps/chat/src/utils/map-scheduled-task-dto.ts`, `apps/chat/src/constants/translation-keys.ts`, `apps/chat/src/i18n/locales/en.json`.
- **API**: additive. `timezone` is optional on the wire; an omitted value means `UTC`, which is what DIAL Scheduler already assumes. Offset-less datetimes become legal input.
- **Dependencies**: none added.
- **i18n**: new user-visible strings (link text, search placeholder, group headings, empty state, results announcement, DST-gap hint, schedule-label suffix).
- **Library isolation**: libs receive zone options, labels and the selected value through props; the lib knows no endpoint, client or storage. Shared pure wall-clock helpers live in `libs/scheduled-tasks` and are imported by `libs/chat-hooks` (a pure-function import, allowed by `AGENTS.md`).
- **RTL / a11y / mobile**: new UI uses logical classes, a labelled dialog popover with a focus-managed search, and a full-width sheet on phones.

## Rollback / compatibility

Not breaking. Existing tasks keep running at the same instants (they read back as `UTC`). To roll back, revert the frontend and chat-api changes: tasks saved with another zone would then be read back by the old code as their stored local fields interpreted as UTC, so a rollback after release needs a data note. Ship the chat-api change first (it tolerates clients that omit `timezone`).

## Acceptance criteria

1. A time zone can be set for one-time and recurring tasks; the default is the browser's zone.
2. A recurring task keeps its local time and day across DST changes.
3. chat-api rejects an unknown zone with `400`.
4. Existing tasks keep their current run times.
5. The picker lists the full IANA list sorted by offset then name, with the browser zone first, searchable by offset, city and abbreviation, with the match highlighted.

## Open items (do not block implementation)

- DIAL Scheduler team: add a test for a one-time `date` in a DST gap (behaviour verified only through `zoneinfo`).
- Design: Figma frames show Berlin as `EST` and use two different search placeholders; treated as mock-data errors, to be confirmed.
