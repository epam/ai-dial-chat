## 1. BFF: DTO and validation

- [x] 1.1 Add optional `startDate`/`endDate` (`@IsOptional() @IsISO8601()`) to `ScheduleCronDto` in `apps/chat-api/src/scheduled-tasks/dto/schedule-trigger.dto.ts`, with `@ApiPropertyOptional` Swagger metadata and examples.
- [x] 1.2 Extend `assertExactlyOneTriggerVariant` (or add an adjacent check called alongside it) in `scheduled-tasks.mapper.ts` to throw `BadRequestException` when `endDate` is not strictly after `startDate` (both present), and when `startDate`/`endDate` is present alongside a `date` trigger.

## 2. BFF: mapper round-trip

- [x] 2.1 Extend `UpstreamScheduleTrigger.cron` type with `start_date?: string` / `end_date?: string`.
- [x] 2.2 Update `toUpstreamTrigger`/`toUpstreamSchedulePayload` to include `start_date`/`end_date` only when the corresponding camelCase value is present and non-empty (mirror the `description` omission pattern) — applies to both create and update paths.
- [x] 2.3 Update `fromUpstreamSchedule` to map `trigger.cron.start_date`/`end_date` back to `startDate`/`endDate` on the response DTO, defaulting to `undefined`, without throwing when `trigger` is absent.

## 3. BFF: tests

- [x] 3.1 Add/extend mapper unit tests: window omitted → no upstream keys; window present → both upstream keys; `endDate <= startDate` → `400`; window on a `date` trigger → `400`; get-response round-trip; list-item mapping with no `trigger` field does not throw.
- [x] 3.2 Add/extend `scheduled-tasks.controller.spec.ts` (or service spec) coverage for create/update accepting the new fields end-to-end through validation.
- [x] 3.3 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`.

## 4. BFF: OpenAPI and Postman

- [x] 4.1 Run `npm run openapi` to regenerate `libs/chat-api-client/openapi.json` and the generated SDK, then `npm run openapi:check`.
- [x] 4.2 Build/lint `chat-api-client` (`npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`) to confirm the regenerated client compiles.
- [x] 4.3 Add a Postman example under `postman/chat-api.postman_collection.json` showing a create body with a bounded cron window.

## 5. Lib: calendar-value helpers

- [x] 5.1 Add `dateValueToCalendarValue`/`calendarValueToDateValue` to `libs/scheduled-tasks/src/utils/calendar-value.ts`, producing/consuming a `YYYY-MM-DD` string, with JSDoc per `libs.md` conventions.
- [x] 5.2 Add/extend `libs/scheduled-tasks/src/utils/tests/calendar-value.spec.ts` covering both new helpers (round-trip, `null`/empty input).

## 6. Lib: form values, errors, labels

- [x] 6.1 Add `startDate?: string` / `endDate?: string` to `ScheduledTaskCreateFormValues` and `startDate?: string` / `endDate?: string` to `ScheduledTaskCreateFormErrors` in `libs/scheduled-tasks/src/models/scheduled-task-create-form-props.ts`.
- [x] 6.2 Add `startDateLabel`, `endDateLabel`, `startDatePlaceholder`, `endDatePlaceholder` to `ScheduledTaskCreateFormLabels`, with JSDoc stating the defaults ("Pick start date" / "Pick end date").

## 7. Lib: ScheduledTaskCreateForm rendering

- [x] 7.1 Render Start date / End date `Calendar` (`mode={CalendarMode.Date}`) pickers below the existing Time field in the recurring branch of `ScheduledTaskCreateForm.tsx`, using `dateValueToCalendarValue`/`calendarValueToDateValue` for the controlled-value adaptation, following the `runAt`/`time` pattern.
- [x] 7.2 Lay the two pickers out as a two-column `flex gap-*` row (each `flex-1`) on desktop, stacked on mobile, per `.claude/skills/responsive-design`.
- [x] 7.3 Render `errors.startDate`/`errors.endDate` with the existing inline-error `<p>` pattern used for `runAt`/`time`.
- [x] 7.4 Update/add tests in `libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/tests/ScheduledTaskCreateForm.spec.tsx` for: pickers hidden when `scheduleType === 'once'`; pickers render for recurring; `onChange` calls `onFieldChange('startDate'/'endDate', ...)`; error paragraphs render; no new host/integration imports.
- [x] 7.5 Run `npm exec nx test @epam/ai-dial-scheduled-tasks` and `npm exec nx lint @epam/ai-dial-scheduled-tasks`.

## 8. App: create page wiring

- [x] 8.1 Add `startDate: undefined` / `endDate: undefined` to `DEFAULT_VALUES` in `ScheduledTaskCreatePage.tsx`.
- [x] 8.2 Add i18n keys `scheduledTasks.create.startDateLabel`, `.endDateLabel`, `.startDatePlaceholder`, `.endDatePlaceholder`, `.endDateBeforeStartError` to `apps/chat/src/i18n/locales/en.json`, with matching `ScheduledTasksI18nKeys` enum entries in `apps/chat/src/constants/translation-keys.ts`, and pass them into `<ScheduledTaskCreateForm labels={...} />`.
- [x] 8.3 Add pre-submit validation in `ScheduledTaskCreatePage`: when both `startDate` and `endDate` are set and `endDate` is not after `startDate`, set `errors.endDate` and block submit; both empty is valid.

## 9. App: trigger mapping and UTC boundary conversion

- [x] 9.1 In `apps/chat/src/utils/scheduled-task-trigger.ts`, extend the recurring branch of `mapFormValuesToCreateBody` to build `trigger.cron` as `{ fields, ...(startDate ? { startDate: <iso> } : {}), ...(endDate ? { endDate: <iso> } : {}) }`; leave the one-shot branch untouched.
- [x] 9.2 Add a boundary-conversion helper next to `buildCronFields` that converts a `YYYY-MM-DD` local date to `00:00:00.000` local (for `startDate`) or `23:59:59.999` local (for `endDate`), then to its UTC ISO string, using the same reference-`Date`/UTC-getters technique `buildCronFields` already documents — extend that function's code comment to cover the new conversion.
- [x] 9.3 Add/extend `apps/chat/src/utils/tests/scheduled-task-trigger.spec.ts`: no dates → no keys; both dates → correct UTC-converted ISO strings; a case with a non-zero timezone offset; a case crossing a DST transition; `scheduleType: 'once'` never includes `startDate`/`endDate` even if present in `values`.

## 10. App: page tests and verification

- [x] 10.1 Update/add tests in `apps/chat/src/pages/ScheduledTaskCreatePage/tests/ScheduledTaskCreatePage.spec.tsx`: submit blocked with inline error when `endDate <= startDate`; submit allowed when both empty; switching `scheduleType` to `'once'` after setting dates does not include them in the submit body.
- [x] 10.2 Run `npm exec nx test chat` and `npm exec nx lint chat`.
- [x] 10.3 Manually verify in the running app: recurring task with no dates (no upstream keys), recurring task with both dates (correct UTC window), inverted dates (inline error, no request), one-shot task (pickers hidden), mobile stacking, RTL row mirroring and on-screen calendar popovers.

## 11. Detail page (conditional)

- [x] 11.1 The scheduled-task detail view is already merged on this branch — surfaced `startDate`/`endDate` as an "Active" field (`Aug 1, 2026 – Dec 31, 2026`) in `ScheduledTaskDetailView`'s Details section, wired through `ScheduledTaskDetailPage`.
