## Why

QA ticket: a one-time task saved for `16:45` in `Europe/Paris` by a viewer in `Europe/Kyiv` shows `Once on Nov 19, 2026, 4:45 PM (Europe/Paris)` on its card and `Next run: Nov 19, 2026, 5:45 PM` in the History panel. The Next run is the same moment converted to the viewer's zone, but nothing says so. With a 7-hour offset (`America/New_York`) the jump from `4:27 PM` to `11:27 PM` looks like a bug. Every date and time on the detail page should name the zone it is shown in.

## Problem

Checked on `origin/development` after #9929 ("format scheduled-task times by language"):

- **Repeats** already names the task's zone every time: `buildScheduleLabel(task, t, displayLanguage, true)` in `apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx`. The ticket's "Repeats has no label" is fixed here (it still happens in hosts that have not ported #9929). But the `scheduled-task-timezone` spec still says the detail view appends the zone only when it differs from the browser's, so the spec and the code disagree.
- **Next run** is `formatScheduledTaskInstant(nextRunTime, locale)`: the absolute instant in the viewer's zone, with **no zone label**. This is the open defect.
- **Active window** (`activeWindowValue`, `start – end`) is formatted with `formatScheduledTaskTriggerTime` in the **task's** zone, also with **no label**. When the zones differ, it disagrees with Next run in the same way.

## Solution

Leave each value in the zone it is shown in today, and name that zone, reusing the existing translated suffix `scheduledTasks.card.scheduleZoneSuffix` (`{{label}} ({{timezone}})`):

1. **Next run** stays in the viewer's zone (absolute instant, which also matches the History run rows directly beneath it) and always gets the viewer's zone: `Next run: Nov 19, 2026, 5:45 PM (Europe/Kyiv)`. The zone comes from `getBrowserTimezone()` (`libs/chat-hooks/src/shared/browser-timezone.ts`). The instant is formatted explicitly in that zone, so the number and the label always agree. If no browser zone can be found, the label is omitted (the runtime default zone is used, as today).
2. **Active window** stays in the task's zone and always gets the task's zone: `Nov 1, 2026, 9:00 AM – Dec 1, 2026, 9:00 AM (Europe/Paris)`.
3. **Repeats**: no code change. The spec is updated to match the behaviour shipped in #9929 (the card names the zone only when it differs from the browser's; the detail view always names it).

Implementation follows the existing adapter split of `formatScheduledTaskScheduleLabel` (`libs/chat-hooks/src/scheduled-task/scheduled-task-display.ts`) and `buildScheduleLabel` (`apps/chat/src/utils/map-scheduled-task-dto.ts`). The rules live in the lib behind host label callbacks, and the app adds only `t()`. That way other hosts built on the published libs render the same values without copying page code.

**Lib touch (scope note):** `@epam/ai-dial-chat-hooks` gains `formatScheduledTaskNextRunTime`, `formatScheduledTaskActiveWindow`, `getScheduledTaskActivationBlock` (moved out of the detail page's inline logic for the Active switch), the `ScheduledTaskActivationBlock` enum, the label/option interfaces, and an optional `timeZone` parameter on `formatScheduledTaskInstant`. All of it is additive. The lib stays host-agnostic: every word comes from host callbacks, and the viewer's zone defaults to `getBrowserTimezone()` but can be passed in.

## What Changes

- `@epam/ai-dial-chat-hooks`: the new display adapters listed above and `formatScheduledTaskInstant(instant, locale?, timeZone?)`. README export table updated.
- `apps/chat`: thin `buildNextRunLabel` and `buildActiveWindowLabel` adapters in `map-scheduled-task-dto.ts`. `ScheduledTaskDetailPage` uses them, and uses `getScheduledTaskActivationBlock` for the Active switch (no behaviour change for the switch).
- Specs: `scheduled-task-timezone` (detail view always names the zone), `scheduled-task-detail-page` (Next run and Active window name their zone) and `chat-hooks-scheduled-task-display` (new lib adapters).

## i18n impact

No new strings. Reuses `scheduledTasks.card.scheduleZoneSuffix`, `scheduledTasks.detail.nextRunLabel` and `scheduledTasks.detail.activeWindowValue`.

## Non-goals

- History run rows (`formatScheduledTaskRunTimestamp`) stay in the viewer's zone with no per-row label. They are past runs, not the scheduled moment, and the labelled Next run line above them names the zone they share.
- The task card keeps naming the zone only when it differs from the browser's (list density).
- No change to the create/edit form, which already shows the selected zone in the Time field.
- Showing both zones at once (`4:45 PM Europe/Paris · 5:45 PM Europe/Kyiv`) is out of scope.

## Alternatives considered

| Option | Verdict |
|---|---|
| **A. Name the zone each value is already shown in (pick)** | Smallest change. Keeps #9929's rule (wall times in the task's zone, instants in the viewer's) and meets the ticket's "always show the zone label". |
| B. Show Next run in the task's zone | Matches Repeats exactly, but Next run would then disagree with the History run rows beneath it, which are in the viewer's zone. That moves the confusion instead of removing it. |
| C. Show both zones on Next run | The clearest option, but it needs a new string and design input. Can be added on top of A later. |

## Acceptance criteria

- With the browser in `Europe/Kyiv` and a task in `Europe/Paris` whose `nextRunTime` is `2026-11-19T15:45:00Z`, the History "Next run" reads `Next run: Nov 19, 2026, 5:45 PM (Europe/Kyiv)` (en-US), and Repeats reads `Once on Nov 19, 2026, 4:45 PM (Europe/Paris)`.
- The Active window value ends with ` (<task zone>)`, including when the task's zone equals the browser's.
- `npm run validate:specs`, `openspec validate label-scheduled-task-detail-zones --strict` and `npm run verify:changed` pass.

## Rollback / compatibility

Not breaking. The lib parameter is optional, and the app change only edits label text. Revert the commit to roll back.
