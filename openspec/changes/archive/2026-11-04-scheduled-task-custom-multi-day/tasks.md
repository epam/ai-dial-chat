# Tasks

**Slicing strategy: vertical.**
- Group 1 changes the lib model and validation.
- Group 2 makes the hooks map and describe weekday lists.
- Group 3 changes the form.
- Group 4 wires the app.

Each group is independently verifiable. Run `npm run verify:changed` once after each completed group and the single `npm run verify:full` at the end. Read `.claude/rules/libs.md` and `openspec/lib-styling-guide.md` before touching `libs/*`. Keep relative TypeScript imports extensionless.

## 1. Lib model and validation

- [x] 1.1 Update the public model:
  - In `libs/scheduled-tasks/src/models/scheduled-task-create-form-props.ts`:
    - add `daysOfWeek?: string[]` to `ScheduledTaskCreateFormValues`;
    - add `daysOfWeek` to `ScheduledTaskCreateFormErrors`;
    - add `daysOfWeekLabel` to `ScheduledTaskCreateFormLabels`;
    - remove `everyWeeks`, `everyLabel`, `everyWeekOptions` and the `ScheduledTaskEveryWeekOption` interface.
  - In `libs/scheduled-tasks/src/index.ts`, drop the removed export.
  - In `libs/scheduled-tasks/src/types/scheduled-task-schedule.ts`, update the `ScheduledTaskRepeat.Custom` JSDoc to "several weekdays at one `time`".
  - Give all new fields JSDoc.

  Verify: `npm exec nx typecheck @epam/ai-dial-scheduled-tasks` passes, and `npm run test:file -- libs/scheduled-tasks/src/tests/public-contract.spec.ts` no longer lists `ScheduledTaskEveryWeekOption`.
- [x] 1.2 In `libs/scheduled-tasks/src/validation/scheduled-task-validation.ts`, validate `daysOfWeek` for Custom (one to seven distinct `'0'`–`'6'` values, with a dedicated error code) and keep `dayOfWeek` for Weekly only. Verify: `npm run test:file -- libs/scheduled-tasks/src/validation/tests/scheduled-task-validation.spec.ts` covers the "Custom days are validated" scenarios.
- [x] 1.3 Remove the Custom special case from `keepWindowBoundaryOnRepeatSwitch` in `libs/scheduled-tasks/src/utils/window-boundary.ts`. It became an identity, so it is deleted together with its call sites in `ScheduledTaskCreateForm.tsx`. Verify: `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/tests/ScheduledTaskCreateForm.spec.tsx` covers the updated switch scenarios (no clearing into or out of Custom).
- [x] 1.4 Confirm `hasScheduledTaskFormChanges` in `libs/scheduled-tasks/src/utils/scheduled-task-form-values.ts` treats `daysOfWeek` correctly (the list stays sorted, so the JSON comparison is stable). Verify: `npm run test:file -- libs/scheduled-tasks/src/utils/tests/scheduled-task-form-values.spec.ts` covers an unchanged list (no change) and an added day (change).

## 2. Mapping and description (chat-hooks)

- [x] 2.1 Forward mapping in `libs/chat-hooks/src/scheduled-task/scheduled-task-trigger.ts`: Custom emits one cron. It builds one reference `Date` rolled to the first selected weekday and applies the shared UTC day shift to every day, producing an ascending `day_of_week` list. It emits no `week`, and converts the window as for Weekly. Verify: `npm run test:file -- libs/chat-hooks/src/scheduled-task/tests/scheduled-task-trigger.spec.ts` covers the forward Custom scenarios of the create-form delta at UTC+2, UTC−5 and UTC+5:30.
- [x] 2.2 Reverse mapping in the same file:
  - a weekday list of two or more days maps to Custom, with the window hydrated;
  - one weekday maps to Weekly;
  - any non-null `week` fails closed, and the former `CUSTOM_WEEK_PATTERN` parsing is deleted;
  - extra non-null fields fail closed.

  Verify: the same spec covers the reverse Custom scenarios, and a forward→reverse→forward round trip returns identical fields.
- [x] 2.3 Extend `describeScheduledTaskTrigger` in `libs/chat-hooks/src/scheduled-task/scheduled-task-description.ts` so the Weekly kind carries an ordered weekday list shifted with the time. Delete the `EveryNWeeks` kind and `intervalWeeks`. In `libs/chat-hooks/src/scheduled-task/scheduled-task-display.ts`, join the weekday names with `Intl.ListFormat` for `weeklyAt` and delete the `everyNWeeks` callback from `ScheduledTaskScheduleLabels`. Verify: `npm run test:file -- libs/chat-hooks/src/scheduled-task/tests/scheduled-task-description.spec.ts` and `npm run test:file -- libs/chat-hooks/src/scheduled-task/tests/scheduled-task-display.spec.ts` cover a list, a midnight shift, a range fallback and a `week` field falling to the generic kind.
- [x] 2.4 Let `getNextCronOccurrence` in `libs/chat-hooks/src/scheduled-task/scheduled-task-next-occurrence.ts` accept a comma-separated weekday list. Verify: `npm run test:file -- libs/chat-hooks/src/scheduled-task/tests/scheduled-task-next-occurrence.spec.ts` covers the earliest matching day for `'0,2'`.
- [x] 2.5 Update `libs/chat-hooks/README.md` for the removed `EveryNWeeks`/`intervalWeeks`/`everyNWeeks` and the weekday-list label. Verify: `npm run validate:docs` exits 0, then run `npm run verify:changed`.

## 3. Form

- [x] 3.1 In `libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/ScheduledTaskCreateForm.tsx`, change the Custom branch:
  - remove the Every `Select`;
  - make the circular day row multi-select on `values.daysOfWeek`, keeping `aria-pressed`, the no-op on the last selected day, and the "Days" label naming the group;
  - render the date-only boundary pickers for Custom;
  - update the Create guard.

  Verify: `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/tests/ScheduledTaskCreateForm.spec.tsx` covers the modified contract and picker scenarios with role, label and text queries, and all other repeats' cases pass unchanged.
- [x] 3.2 RTL and mobile check for the Custom branch: logical utilities only, no physical-direction class, and seven buttons fit 320px without horizontal scroll. Verify: the same spec asserts DOM order and the absence of physical classes under an `rtl` wrapper.
- [x] 3.3 Update `libs/scheduled-tasks/README.md`: the Custom paragraph (several days, one time, window, no Every), the labels example, and a migration note for the removed fields. Update `docs/scheduled-tasks-reuse.md` with a migration-map row and a release note for the removed `everyWeeks`/`everyLabel`/`everyWeekOptions`/`ScheduledTaskEveryWeekOption`. Update `tools/scheduled-tasks-consumer-fixture/src/main.tsx` to stop passing the removed labels and to pass `daysOfWeekLabel`. Verify: `npm run validate:docs` exits 0, then build the fixture through Nx (`npm exec nx build scheduled-tasks-consumer-fixture`), then run `npm run verify:changed`.

## 4. App wiring and i18n

- [x] 4.1 Make the i18n edits in one change, across `apps/chat/src/constants/translation-keys.ts` and `apps/chat/src/i18n/locales/en.json`:
  - add `ScheduledTasksI18nKeys.CreateDaysOfWeekLabel` = `scheduledTasks.create.daysOfWeekLabel` ("Days");
  - remove `CreateEveryLabel`, `CreateEveryWeeksOption` and `CardScheduleEveryNWeeks`, together with their `en.json` entries.

  Verify: `npm run test:file -- apps/chat/src/hooks/scheduled-tasks/tests/useScheduledTaskFormLabels.spec.ts` asserts `daysOfWeekLabel` and the absence of `everyLabel`/`everyWeekOptions`.
- [x] 4.2 Update `apps/chat/src/hooks/scheduled-tasks/useScheduledTaskFormLabels.ts`: drop the Every labels and add `daysOfWeekLabel`. Weekday names stay derived from `Intl.DateTimeFormat`. Verify: the spec from 4.1 passes.
- [x] 4.3 Update the pages:
  - `libs/scheduled-tasks/src/constants/scheduled-task-create-form.ts` (`SCHEDULED_TASK_CREATE_DEFAULT_VALUES`, used by the create page): drop `everyWeeks`; Custom starts with no day selected and blocks Save until one is chosen, as before;
  - `apps/chat/src/pages/ScheduledTaskEditPage/ScheduledTaskEditPage.tsx`: drop the `everyWeeks` default;
  - both pages: map the days-of-week error code to a translated message.

  Verify: `npm run test:file -- apps/chat/src/pages/ScheduledTaskCreatePage/tests/ScheduledTaskCreatePage.spec.tsx` and `npm run test:file -- apps/chat/src/pages/ScheduledTaskEditPage/tests/ScheduledTaskEditPage.spec.tsx` cover:
  - creating Mon/Wed/Fri 09:00 with a window (the request body is one `trigger.cron` with the UTC list and the window);
  - editing it;
  - the unsupported state for a task with a `week` field.
- [x] 4.4 Drop the `everyNWeeks` entry from `buildScheduleLabels` in `apps/chat/src/utils/map-scheduled-task-dto.ts`; `weeklyAt` keeps mapping to `scheduledTasks.card.scheduleWeeklyAt`. Verify: `npm run test:file -- apps/chat/src/utils/tests/map-scheduled-task-dto.spec.ts` covers the page-ui delta scenarios.
- [x] 4.5 Detail page: no code change is expected beyond the shared formatter and `getNextCronOccurrence`. Verify: `npm run test:file -- apps/chat/src/pages/ScheduledTaskDetailPage/tests/ScheduledTaskDetailPage.spec.tsx` covers a multi-day Custom task with a window (Repeats label, window label, active switch).
- [x] 4.6 Run `npm run verify:changed`. Verify: it exits 0.

## 5. Close-out

- [x] 5.1 Run `npm run validate:specs`, `npm run validate:docs`, `npm run build:quiet` (two libs changed) and the single `npm run verify:full`. Verify: all exit 0.

## Workflow follow-up

- The delta specs are already synced into `openspec/specs/` (required for `npm run validate:specs`); archive the change after review.
- Candidate follow-ups (out of scope, deferred by the team): different times per weekday via Scheduler `trigger.crons` (MR `Deltix/openai-apps/dial-scheduler!79`), "every N weeks", and "every N days".
