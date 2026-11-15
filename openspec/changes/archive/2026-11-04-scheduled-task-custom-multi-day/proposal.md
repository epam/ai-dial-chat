# Proposal

## Why

Issue [epam/ai-dial-chat#9478](https://github.com/epam/ai-dial-chat/issues/9478) added a "Custom" Repeat option. What shipped (`ScheduledTaskRepeat.Custom`) runs "every N weeks on one weekday at one time", and QA and UX flagged it as indistinguishable from Weekly.

The team weighed richer designs:
- different times per day;
- a full hourly/daily/weekly/monthly builder.

It chose a smaller step that keeps the form simple: Custom becomes "**several weekdays at one time**", with the same optional activity window the other recurring repeats have. That is the clear differentiator from Weekly, which stays one weekday.

## What Changes

- **Custom picks several weekdays.** The existing row of circular day buttons becomes a multi-select; at least one day stays selected.
- **One time for all selected days.** The existing Time field is unchanged.
- **The "Every N weeks" selector is removed** from Custom.
- **Custom gets the optional Start date / End date pickers** (date-only), exactly like Daily, Weekly, Monthly and Hourly.
- **Wire shape stays a single `trigger.cron`:** `{ day_of_week: '<list>', hour, minute }` plus the optional window. Every selected day shifts by the same UTC day offset, so one entry always suffices and the conversion is exact. No DIAL Scheduler or `chat-api` change is needed; the existing cron-field validator already accepts weekday lists.
- **Reopening a task** maps a single cron with a list of weekdays to Custom. A single weekday still reopens as Weekly.
- **Former every-N-weeks Custom tasks are not supported.** That option was never released (it exists only in development builds since 27 Oct 2026), so no compatibility path is kept: any trigger with a `week` field opens in the existing non-destructive "can't be edited here" state and shows the generic "Recurring schedule" label, while still running and staying pausable and deletable. The every-N-weeks label kind, its formatter callback and its i18n key are removed.
- **Schedule labels** describe Custom as "Every Monday, Wednesday and Friday at 9:00 AM", reusing the Weekly label with a localized list of days.
- **BREAKING (library APIs only)**:
  - `libs/scheduled-tasks` removes the Custom-only `everyWeeks` form value, the `everyLabel`/`everyWeekOptions` labels and the `ScheduledTaskEveryWeekOption` type, and adds a `daysOfWeek` form value and a `daysOfWeekLabel` label.
  - `libs/chat-hooks` removes `ScheduledTaskTriggerDescriptionKind.EveryNWeeks`, the description's `intervalWeeks` and the `everyNWeeks` callback of `ScheduledTaskScheduleLabels`.

  All of these exist only in `1.3.0-dev.*` prereleases (introduced on 27 Oct 2026); no stable release (`latest` 1.2.21, `release-1.1` 1.1.18) contains them. The BFF contract is not affected.

### Alternatives considered

| Option | Verdict |
| --- | --- |
| **A. Several weekdays, one time, optional window (chosen)** | Minimal UI change and an exact single-cron encoding, with no backend dependency. Clearly distinct from Weekly. |
| B. Keep "Every N weeks" and add multi-day | More options for little demand. Keeps the year-boundary quirks of ISO week steps (`*/N`). Rejected by the team. |
| C. Different time per weekday (`trigger.crons`) | Covers the issue comment's example exactly, but needs Scheduler MR `Deltix/openai-apps/dial-scheduler!79`, BFF changes and a larger form. Deferred by the team. |
| D. Full hourly/daily/weekly/monthly builder | Maximum flexibility, but complex UI and UTC approximation cases. Rejected as too heavy. |

## Non-goals

- Different times on different days, "every N weeks", "every N days", ordinal weekdays, weekday-only presets, DST handling, schedule `metadata`, and the `trigger.crons` wire variant.

## Known limitations (accepted)

- **DST**: as for Weekly today, the UTC offset is fixed at save time. After a DST change the task runs one hour earlier or later in local time, and the editor shows the real current local time.
- **One weekday equals Weekly**: a Custom rule with a single selected day is identical on the wire to Weekly and reopens as Weekly.
- **Former every-N-weeks Custom tasks** (development builds only) cannot be edited and show the generic label (see What Changes).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `scheduled-task-create-form`:
  - the Custom controls (multi-select days, one time, window, no Every);
  - the form-to-trigger mapping;
  - the i18n keys;
  - the window pickers and repeat-switch rule;
  - the reverse mapping.
- `scheduled-tasks-page-ui`: the card schedule label describes weekday lists.
- `scheduled-task-detail-page`: the Repeats value and the active-window label handle Custom with a window.

## Impact

- **`libs/scheduled-tasks`**:
  - `models/scheduled-task-create-form-props.ts`, `types/scheduled-task-schedule.ts` (`Custom` JSDoc), `index.ts`;
  - `validation/scheduled-task-validation.ts`;
  - `utils/window-boundary.ts` (the Custom special case disappears);
  - `components/ScheduledTaskCreateForm/ScheduledTaskCreateForm.tsx`;
  - `README.md`.
- **`libs/chat-hooks/src/scheduled-task`**:
  - `scheduled-task-trigger.ts`: forward and reverse mapping; the former `week` parsing is removed;
  - `scheduled-task-description.ts`: weekday lists; the every-N-weeks kind is removed;
  - `scheduled-task-display.ts`: the weekday-list label; the `everyNWeeks` callback is removed;
  - `scheduled-task-next-occurrence.ts`: weekday lists;
  - `README.md` and tests.
- **`apps/chat`**:
  - `hooks/scheduled-tasks/useScheduledTaskFormLabels.ts`;
  - `constants/translation-keys.ts` and `i18n/locales/en.json`: remove `everyLabel`/`everyWeeksOption` and `scheduledTasks.card.scheduleEveryNWeeks`, add `daysOfWeekLabel`;
  - `utils/map-scheduled-task-dto.ts`;
  - the create and edit pages.
- **Docs and reuse**: `tools/scheduled-tasks-consumer-fixture/src/main.tsx` (stops passing the removed labels) and `docs/scheduled-tasks-reuse.md` (migration row and release note).
- **No change**: `apps/chat-api`, `libs/chat-api-client`, DIAL Scheduler.
- **Library isolation**: `libs/scheduled-tasks` still only receives values, labels and callbacks; the UTC conversion stays in `libs/chat-hooks`.
- **RTL / a11y**: the day row keeps its logical layout and `aria-pressed` buttons, and the multi-select adds no new control type.
- **Rollback**: revert the change. Tasks saved with a weekday list would then open as "can't be edited here" in the old form, which rejects lists, but keep running.

## Acceptance criteria

- **Creating:** a user can create "Every Monday, Wednesday and Friday at 09:00" with Start and End dates. The request carries one `trigger.cron` with the UTC-shifted weekday list, hour, minute and window.
- **Reopening:** the task reopens in the same timezone with the same days, time and window.
- **Card and detail labels:** both show the localized day list.
- **Other repeats:** Weekly, Daily, Monthly, Hourly and One time send exactly the same requests as before.
- **Former Custom tasks:** any trigger with a `week` field shows "can't be edited here" and the "Recurring schedule" label.
- **Checks:** `npm run validate:specs`, `npm run validate:docs` and `npm run verify:full` pass.
