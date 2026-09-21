## 1. Extract the run-at block into ScheduledTaskRunAtField

- [x] 1.1 Create `libs/scheduled-tasks/src/components/ScheduledTaskRunAtField/ScheduledTaskRunAtField.tsx` with props `label`, `value` (`datetime-local` string), `onChange`, `error?`, `errorClassName?` (default `'dial-small-text'`), owning the kit `Calendar` (`mode={CalendarMode.DateTime}`), the `runAtToCalendarValue`/`calendarValueToRunAt` conversions (via a `handleCalendarChange` adapter), the required label, `invalid`, and the submit-time error paragraph.
- [x] 1.2 Add `ScheduledTaskRunAtField.module.scss` with `.error` reading the parent form's `--stcf-error-text` var (the `ScheduledTaskHistorySection` cascade pattern), so `styles.colors.instructionsErrorText` keeps styling the error with no new color prop.
- [x] 1.3 Replace the form's inline run-at block with `<ScheduledTaskRunAtField …/>` in the `'oneTime'` branch, adapting via `handleRunAtChange`; remove the now-unneeded converter imports from the form.
- [x] 1.4 Keep the field internal: no re-export from `@epam/ai-dial-scheduled-tasks`'s index (matches `ScheduledTaskHistorySection`), so the public API is unchanged.

## 2. Earliest selectable moment

- [x] 2.1 Pin `minDate = useMemo(() => new Date(), [])` inside the field and pass it to the `Calendar`, with a comment stating why the pin is mount-time (no per-render drift, no churn of the kit's internal effects).
- [x] 2.2 Confirm the kit's behavior end-to-end in its compiled source: out-of-range day buttons render `disabled` and their click handler returns early (`isDateOutOfRange`), so past selections neither render as available nor fire `onChange`.
- [x] 2.3 Leave the submit-time lead validation untouched — the earliest selectable moment is "now", not "now + 60 s"; a `now`-ish selection still fails at submit with the existing message.

## 3. Tests

- [x] 3.1 `ScheduledTaskRunAtField.spec.tsx` (kit mocked): required label, minimum date present, `datetime-local` round-trip via `fireEvent.change` (a local timezone-suffix-free string; `userEvent.type` would be reverted by the controlled value between keys), unparseable draft → `''`, error + invalid flag, clean state without an error.
- [x] 3.2 `ScheduledTaskRunAtField.calendar.spec.tsx` (no kit mock — separate file because `vi.mock` is file-wide): open the real popover, assert yesterday's day button is `disabled` and its activation (via `fireEvent`, since `userEvent` refuses disabled buttons) fires no `onChange`; a future day reports a `datetime-local` value; a pre-picked future day shows `aria-pressed="true"` and re-picking keeps its time-of-day. Shared `onChange` mock at module level with `afterEach` clearing.
- [x] 3.3 Move the run-at unit assertions out of the form spec (the minDate marker and the mock surface revert to the form spec's pre-marker shape); keep the form-level section test and the `onFieldChange('runAt', …)` wiring test.

## 4. Docs and verification

- [x] 4.1 One sentence in `libs/scheduled-tasks/README.md`: the one-shot run-at picker sets the earliest selectable moment at the moment the form mounted, so past moments are unselectable.
- [x] 4.2 `npm run test:file` across the field's two specs, the form spec, and the create/edit page specs — all green.
- [x] 4.3 `npm exec nx -- run-many -t typecheck lint -p @epam/ai-dial-scheduled-tasks @epam/chat` and `npm run validate:docs` — green.
