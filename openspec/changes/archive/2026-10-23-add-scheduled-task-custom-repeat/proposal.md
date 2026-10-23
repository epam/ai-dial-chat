## Why

The Scheduler's Repeat frequency offers only five fixed cadences (one time, hourly, daily, weekly, monthly), so there is no way to run a task less often than every week — e.g. every second Monday. Issue [#9478](https://github.com/epam/ai-dial-chat/issues/9478) asks for a "Custom" option; the agreed shape is a structured editor (every N weeks on one weekday at a time), not a raw cron expression. The backend already accepts every field this needs — the BFF's `IsCronFields` validator whitelists `week` (1–53, steps allowed) and the mapper passes `cron.fields` through to DIAL Scheduler verbatim — so this is a frontend-only change.

## What Changes

- Add `ScheduledTaskRepeat.Custom` (`'custom'`) to the Repeat dropdown in `libs/scheduled-tasks`; the option list itself is host-supplied, so the app's `useScheduledTaskFormLabels` gains the Custom entry.
- When Custom is selected, the form shows three fields and **no start/end date window**:
  - an **"Every"** dropdown with options **"1 week" … "10 weeks"**;
  - a **day-of-week single-select button row** (M T W T F S S — toggle buttons, `aria-pressed`, one selected day required);
  - the existing masked **time-of-day field with timezone hint** (reuse the current picker).
- Forward mapping (`libs/chat-hooks/src/scheduled-task/scheduled-task-trigger.ts`): Custom stores `cron.fields = { week: '*/N', day_of_week, hour, minute }`, converting the local time and weekday to UTC with the same reference-`Date` technique the other cadences use. No activity window is sent.
- Reverse mapping: a `week` field value present in the stored cron maps back to Custom, so tasks that today fail closed as `UnsupportedCronShape` (and render the edit page's unsupported state) become editable. The stored shape `{day_of_week, hour, minute}` with no `week` (Weekly without bounds, which predates Custom) still hydrates as Weekly.
- Display: new shared schedule-label copy for custom tasks — e.g. "Every 2 weeks on Monday at 9:00 AM" — used by both the card's schedule pill and the detail page's "Repeats" field, plus a week-step-aware next-run computation extending `getNextCronOccurrence` (used by the detail page's run polling).
- Repeat-switch boundary handling (`keepWindowBoundaryOnRepeatSwitch`): switching into Custom clears any window-boundary values, since Custom renders no boundary fields to carry them into.

Not changing: the BFF (`apps/chat-api`), the generated API client, DIAL Core, the existing five options, or the Weekly option's behavior (Weekly keeps its optional date range; Custom covers the N-week/no-range combination — the two only overlap in the no-bounds corner where both mean "weekly").

**Accepted semantic caveat (product decision):** cron's `week` field counts calendar weeks of the year (1–53), not an interval anchored to the task. "Every N weeks" therefore fires in matching calendar weeks and its phase resets each January; for N=1 and N=2 this is indistinguishable from an anchored interval, for N≥3 the gap across a New Year can be shorter than N weeks. Firing-time verification against a live DIAL Scheduler is owned outside this change.

## Capabilities

### New Capabilities

(none — all behavior extends existing capabilities)

### Modified Capabilities

- `scheduled-task-create-form`: new Custom repeat section (Every dropdown, day-of-week button row, time), Custom form values and validation, forward mapping to `cron.fields` with `week`, reverse mapping recognizing the `week` key (previously `UnsupportedCronShape` tasks become editable), boundary clearing on repeat switches into Custom, and the new i18n strings.
- `scheduled-tasks-page-ui`: the card's schedule pill renders the new custom schedule label ("Every N weeks on {day} at {time}") instead of the generic "Recurring schedule" fallback.
- `scheduled-task-detail-page`: the "Repeats" field renders the same custom label, and the week-step-aware next-run computation feeds the runs polling.

## Impact

- `libs/scheduled-tasks` (lib change): gains the `Custom` enum member, form-values fields (`everyWeeks`, day-of-week for custom), the Custom form section, and validation. The lib stays host-agnostic — all strings arrive via the existing `labels` prop (new label entries: "Every" field label, week-count option labels, day-of-week button accessible names); the day-of-week button row is a plain button group built in the lib (the kit's `Calendar` weekday mode is a single-select popover list, not buttons, and no kit multi/single-select day control exists).
- `libs/chat-hooks` (allowed narrow exception): extends `buildCronFields`/`parseCronFields` in `scheduled-task-trigger.ts` — request/response-shape logic per the documented `chat-hooks` contract.
- `apps/chat`: `useScheduledTaskFormLabels` (Custom option + labels), `apps/chat/src/i18n/locales/en.json` + `translation-keys.ts` (new keys), `map-scheduled-task-dto.ts` (`buildScheduleLabel` custom case, `getNextCronOccurrence` week-step support), `describeScheduledTaskTrigger` in chat-hooks gains a week-step custom description.
- i18n impact: yes — new user-visible strings ("Every", "1 week"…"10 weeks", day-of-week short labels for the buttons, card/detail copy "Every {count} weeks on {day} at {time}", plus any Custom repeat-option label).
- No backend, OpenAPI, dependency, or storage-schema changes.

**Alternatives considered:** raw cron-expression input (rejected — needs an expression parser, APScheduler field semantics differ from Unix cron, and the UX team specified a structured editor); structured per-field cron editor with free-form field syntax (rejected — same parser surface, no product ask); removing Weekly in favor of Custom (rejected — visibly changes how existing weekly tasks hydrate in the edit form).

**Rollback / backward compatibility:** purely additive — a new enum member, new form fields, and a reverse-mapping branch. No stored task shape changes for existing cadences; tasks created with Custom are ordinary cron triggers the current display already tolerates (the `Custom` description kind with the generic "Recurring schedule" fallback predates this change). Reverting the commit removes the option; tasks created with `week` in that window fall back to the existing generic display and the pre-change fail-closed edit state.

## Non-goals

- Anchored "every N weeks from creation" semantics (not expressible in cron `week`; would need a DIAL Core change).
- Multi-day selection ("Mondays and Thursdays") — explicitly single-day per the agreed UX.
- A start/end activity window for Custom — explicitly out; Custom runs indefinitely.
- Raw cron expression entry or any free-form syntax field.
- Any BFF / DIAL Core / OpenAPI contract change.
