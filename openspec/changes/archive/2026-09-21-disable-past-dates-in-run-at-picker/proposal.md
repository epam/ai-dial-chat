## Why

The one-shot "Run at" picker on the scheduled-task create/edit form let the user select any moment, including past ones. The submit-time validator still rejected them (`runAt` must lead "now" by at least a minute), but the picker itself offered past days as if they were valid — the user only learned otherwise after trying to save. Per the "Delete Task PopUp" design round's follow-up, past moments should be unselectable at the point of selection.

## What Changes

- The run-at block of `ScheduledTaskCreateForm` (the kit `Calendar` in `mode={CalendarMode.DateTime}`, the `runAt` ↔ `CalendarValue` conversions, the required label, the invalid flag, and the submit-time error paragraph) is extracted into a new internal component, `libs/scheduled-tasks/src/components/ScheduledTaskRunAtField/ScheduledTaskRunAtField.tsx`, with props `label`, `value` (`datetime-local` string), `onChange`, `error?`, and `errorClassName?` (default `'dial-small-text'`). The form renders `<ScheduledTaskRunAtField …/>` in the `'oneTime'` branch via a `handleRunAtChange` adapter; the conversions (`runAtToCalendarValue`/`calendarValueToRunAt`) move inside the field.
- The field sets the earliest selectable moment with `minDate`: a `new Date()` pinned once at component mount (`useMemo`), so past days render disabled in the picker's month grid and their click handlers no-op (the kit's `isDateOutOfRange` gate). The pin is mount-time, not per-render, so the earliest selectable moment does not drift forward while the form is open and the memoized identity does not churn the kit's internal effects.
- The error paragraph keeps the form's themable channel two ways: the `errorClassName` prop for typography (the form forwards its `instructionsErrorClassName`), and the field's own `.module.scss` reading the parent form's `--stcf-error-text` CSS var through the cascade — the `ScheduledTaskHistorySection` pattern — so `styles.colors.instructionsErrorText` keeps working with no extra plumbing.
- The field is internal to the lib (not exported from `@epam/ai-dial-scheduled-tasks`'s index, like `ScheduledTaskHistorySection`), so no public API or README surface changes beyond one sentence in the lib README noting the earliest selectable moment.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `scheduled-task-create-form`: the run-at picker SHALL set its earliest selectable moment to the field's mount time, rendering past days unselectable in the picker and never reporting a past moment through `onChange`. The picker is extracted into an internal `ScheduledTaskRunAtField` component whose contract is `label`/`value`/`onChange`/`error`/`errorClassName`; the `values.runAt`/`onFieldChange('runAt', …)` shapes the page consumes are unchanged.

## Impact

- **Code**: `libs/scheduled-tasks/src/components/ScheduledTaskRunAtField/` (new component + `.module.scss` + two specs), `ScheduledTaskCreateForm.tsx` (block replaced by the field, `runAtMinDate` memo and converter imports removed, `handleRunAtChange` adapter added), the form spec (run-at unit tests moved to the field's spec).
- **Tests**: a mock-based spec covers the field's contract (label, minimum date present, `datetime-local` round-trip, unparseable draft → `''`, error + invalid flag); a separate real-kit spec (`ScheduledTaskRunAtField.calendar.spec.tsx`, no ui-kit mock — the file split exists because `vi.mock` is file-wide) drives the actual popover and asserts yesterday's day button is `disabled` and its click fires no `onChange`, while a future day reports a `datetime-local` value and a pre-picked day round-trips with its time-of-day intact.
- **No API/contract changes**: `ScheduledTaskCreateFormValues.runAt`/`onFieldChange` shapes are unchanged; the lib's public exports are unchanged (the field is internal).
- **Behavior**: only the one-shot branch of the create/edit form changes — past moments become unselectable in the UI; submit-time validation (including the 60-second lead check, which the picker deliberately does not enforce — the earliest selectable moment is "now", not "now + lead") is unchanged.
- **Docs**: the lib README gains one sentence about the earliest selectable moment; the `scheduled-task-create-form` capability spec gains this requirement via the delta spec.
