Slicing strategy: vertical. One app-level helper (`formatRunDuration`) feeds both the History list and the conversation banner, so a single slice (strings → helper → tests) delivers the whole behaviour. The close-out follows.

## 1. Translation strings

- [x] 1.1 In `apps/chat/src/i18n/locales/en.json`, under `scheduledTasks.detail`, change `historyDurationSuffix` from `({{seconds}}s)` to `({{duration}})`. Add `historyDurationHours: "{{count}}h"`, `historyDurationMinutes: "{{count}}m"`, and `historyDurationSeconds: "{{count}}s"` next to it.
- [x] 1.2 In `apps/chat/src/constants/translation-keys.ts`, add `DetailHistoryDurationHours`, `DetailHistoryDurationMinutes`, and `DetailHistoryDurationSeconds` to `ScheduledTasksI18nKeys` next to `DetailHistoryDurationSuffix`.

**Verification:** covered by task 2's test run (the helper fails to compile without the enum members).

## 2. Duration formatting

- [x] 2.1 In `apps/chat/src/utils/map-scheduled-task-run-dto.ts`, rewrite `formatRunDuration`:
  - Keep the signature `(durationSeconds: number | undefined, t: TFunction) => string | undefined` and return `undefined` for a nullish input.
  - Split the input into `hours = Math.floor(s / 3600)`, `minutes = Math.floor((s % 3600) / 60)`, and `seconds = s % 60`.
  - Translate each non-zero unit with its new key, passing `{ count }`. Keep the seconds unit when every unit is zero, so `0` gives `(0s)`.
  - Join the units with `' '` and pass the result as `duration` to `DetailHistoryDurationSuffix`.
  - Write any helper as a module-level `const` arrow function.
  - Update the JSDoc on `formatRunDuration` and `formatRunTimestamp` so the examples read `(45s)` / `(1m 1s)` instead of `(99s)`.
  - Do not change `mapScheduledTaskRunDtoToItem`, `formatRunTimestamp`, or `ScheduledTaskConversationBanner`. Both consumers already go through this helper.
- [x] 2.2 In `apps/chat/src/utils/tests/map-scheduled-task-run-dto.spec.ts`:
  - Add a translator that resolves the four duration keys to their English templates with interpolation, so assertions read as display text.
  - Add a `describe('formatRunDuration')` with one test per spec scenario: `45` → `(45s)`, `0` → `(0s)`, `61` → `(1m 1s)`, `60` → `(1m)`, `99` → `(1m 39s)`, `3600` → `(1h)`, `3605` → `(1h 5s)`, `3723` → `(1h 2m 3s)`, `90180` → `(25h 3m)`, and `undefined` → `undefined`.
  - Update the existing "maps durationSeconds to a separate durationLabel" test, which asserts the old `{ seconds: 99 }` interpolation, so it checks the new `{ duration }` output.
  - Name tests after the observable output (e.g. "shows durations of 60 seconds or more in minutes and seconds").

**Verification:** `npm run test:file -- apps/chat/src/utils/tests/map-scheduled-task-run-dto.spec.ts`, then `npm run test:file -- apps/chat/src/components/ScheduledTaskConversationBanner/tests/ScheduledTaskConversationBanner.spec.tsx`. The banner test matches the suffix key by regex and should still pass unchanged; if it doesn't, fix only that assertion. Then run `npm run verify:changed`.

## 3. Specs and close-out

- [x] 3.1 Run `npm run validate:specs` for the `scheduled-task-detail-page` delta, which cites `apps/chat/src/utils/map-scheduled-task-run-dto.ts` and the new `scheduledTasks.detail.historyDuration*` translation keys.
- [x] 3.2 Leave `libs/scheduled-tasks/README.md` as is: its `durationLabel: '(99s)'` examples are arbitrary pre-formatted host input and stay valid, and no `docs/` file describes the duration format. Architecture guard: confirm the diff touches nothing under `libs/`, so no host formatting or i18n moves into the lib.
- [ ] 3.3 Run `npm run verify:full` once to close the change.
