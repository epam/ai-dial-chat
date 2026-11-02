## Why

Issue [#9469](https://github.com/epam/ai-dial-chat/issues/9469): a scheduled task's History shows run duration in raw seconds, so a 61-second run reads `(61s)` and a 40-minute run reads `(2400s)`. Long durations are hard to read at a glance. Durations of 60 seconds or more should be shown in minutes and seconds (e.g. `(1m 1s)`).

## Problem

`formatRunDuration` (`apps/chat/src/utils/map-scheduled-task-run-dto.ts:26`) passes `durationSeconds` unchanged to the `scheduledTasks.detail.historyDurationSuffix` translation key, whose English value is `({{seconds}}s)` (`apps/chat/src/i18n/locales/en.json:867`). Nothing converts the value into larger units. The same helper produces:

- the History row's `durationLabel` (`mapScheduledTaskRunDtoToItem`, rendered by `libs/scheduled-tasks/src/components/ScheduledTaskRunHistoryList/ScheduledTaskRunHistoryList.tsx:190`);
- the duration suffix in the scheduled-task conversation banner's timestamp (`formatRunTimestamp`, called from `apps/chat/src/components/ScheduledTaskConversationBanner/ScheduledTaskConversationBanner.tsx:44`).

## Solution

- Split `durationSeconds` into hours, minutes, and seconds in the app-level helper. Render each non-zero unit from its own localized translation key, then join the units with a space:
  - `< 60` → `(45s)` (unchanged; `0` → `(0s)`)
  - `60–3599` → `(1m 1s)`, `(2m)` when the seconds part is zero
  - `≥ 3600` → `(1h 2m 3s)`; a zero unit is left out (`(1h)`, `(1h 5s)`)
- Change the interpolation of `scheduledTasks.detail.historyDurationSuffix` from `{{seconds}}` to `{{duration}}`, so the parentheses come from the translation and the units inside come from the new keys.
- The fix covers both consumers (History rows and the conversation banner) because both already go through `formatRunDuration`.

## Non-goals

- No change to the BFF (`apps/chat-api`): `durationSeconds` stays a whole number of seconds in `ScheduledTaskRunDto`.
- No change to `libs/scheduled-tasks`: `durationLabel` is already a pre-formatted string that the host supplies.
- No days unit. A run longer than 24 hours shows as hours, e.g. `(25h 3m)`.
- No `Intl.DurationFormat` (see Alternatives).

## Alternatives considered

- **`Intl.DurationFormat`** (narrow style gives `1m 1s` in `en`): rejected. Older browsers in the support range don't have it, TypeScript 6's `lib` typings may not include it, and it would format in the browser locale instead of the i18next language that the surrounding `(…)` and "today at" strings use.
- **One key per unit combination** (`{{m}}m {{s}}s`, `{{h}}h {{m}}m {{s}}s`, …): rejected. It needs more keys than per-unit keys and still needs logic to drop zero units.
- **Per-unit keys composed in code** (chosen): three short keys keep each unit translatable, and the zero-dropping rule lives in one tested helper.

## Acceptance criteria

- A run with `durationSeconds: 61` shows `(1m 1s)` in the History list and in the conversation banner.
- `durationSeconds` values `45`, `60`, `3600`, and `3723` render as `(45s)`, `(1m)`, `(1h)`, and `(1h 2m 3s)` respectively.
- A run without `durationSeconds` (e.g. one still in progress) still shows no duration.
- Every unit string comes from `en.json`; no unit letter is hard-coded in the TypeScript.
- Unit tests in `apps/chat/src/utils/tests/map-scheduled-task-run-dto.spec.ts` cover the boundaries above; the existing banner and History tests still pass.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `scheduled-task-detail-page`: the "History rows show skeleton loading, status icon, timestamp, and duration" requirement changes. The duration is shown in hours/minutes/seconds units instead of raw seconds.

## Impact

- **Code:** `apps/chat/src/utils/map-scheduled-task-run-dto.ts`, its spec, and `apps/chat/src/constants/translation-keys.ts` (`ScheduledTasksI18nKeys`).
- **i18n:** new user-visible strings `scheduledTasks.detail.historyDurationHours` (`{{count}}h`), `historyDurationMinutes` (`{{count}}m`), `historyDurationSeconds` (`{{count}}s`). `historyDurationSuffix` changes to `({{duration}})`. Only `en.json` exists today.
- **Libs:** none. `libs/scheduled-tasks` receives the formatted `durationLabel` as before, so no host knowledge moves into the lib.
- **APIs / backend:** none.
- **Backward compatibility / rollback:** not breaking. Only the displayed text changes. To roll back, revert the commit; the suffix key returns to `({{seconds}}s)` in the same revert.
