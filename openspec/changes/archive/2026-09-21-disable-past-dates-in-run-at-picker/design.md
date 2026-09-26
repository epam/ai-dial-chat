# Design: disable-past-dates-in-run-at-picker

## Context

`ScheduledTaskCreateForm` rendered the one-shot run-at picker inline: a kit `Calendar` (`mode={CalendarMode.DateTime}`) plus the `runAt` string ↔ `CalendarValue` conversions, the required label, the invalid flag, and the submit-time error paragraph. The page's submit validation rejects a `runAt` not at least 60 seconds in the future, but the picker offered every day — including past ones — as selectable.

## Goals / Non-Goals

- **Goal:** past moments are unselectable at the point of selection, in both the create and edit forms (the field is shared).
- **Goal:** the block becomes a self-contained component with its own unit tests, per the extraction request.
- **Non-goal:** enforcing the submit-side lead time (60 s) in the picker — the earliest selectable moment is "now"; a user may still pick the current minute and learn at submit that it needs to lead. Raising the earliest selectable moment to `Date.now() + 60_000` is a one-line follow-up if the design asks.
- **Non-goal:** changing `values.runAt`'s shape, `onFieldChange`'s contract, or the lib's public exports.

## Decisions

### 1. Mount-pinned `minDate`, not per-render `new Date()`

`minDate = useMemo(() => new Date(), [])`. A per-render `new Date()` would push the earliest selectable moment forward on every re-render of a long-lived form (churn in the kit's internal effects for a negligible correctness gain) — the earliest selectable moment is pinned once at the field's mount. Because the field mounts when the user switches Repeat to `'oneTime'`, the pin is also closer to submission time than the form's mount would be. The kit compares dates at day granularity (`isDateOutOfRange` builds Y/M/D values), so "today" stays selectable.

### 2. Extraction boundary: everything run-at-specific moves, the value contract stays

The field owns the `Calendar`, the conversions (`runAtToCalendarValue`/`calendarValueToRunAt`), the mount-pinned earliest selectable moment, the label, `invalid`, and the error paragraph. Its public props are deliberately string-typed (`value: string`, `onChange: (value: string) => void`) — the `CalendarValue` adaptation is an implementation detail, so the form (and any future host of the field) never sees it. The form adapts via `handleRunAtChange = (value) => onFieldChange('runAt', value)`.

### 3. Themable error channel without new color props

The error paragraph needs the form's `instructionsErrorClassName` (typography) and error color. Rather than adding a color prop, the field's `.module.scss` reads the parent form's existing `--stcf-error-text` var — CSS vars cascade from the form root where `buildCssVars` sets them — the same pattern `ScheduledTaskHistorySection` uses for `--stdv-*`. One prop (`errorClassName`) covers typography; colors stay overridable through the form's existing `styles.colors.instructionsErrorText`.

### 4. Internal component, not a public export

Like `ScheduledTaskHistorySection`, the field is internal to `libs/scheduled-tasks` — not re-exported from the package index — so the lib's public API and README coverage are unaffected.

### 5. Two spec files: mock contract vs real-kit interaction

`vi.mock` is file-wide, so the field has two specs:

- `ScheduledTaskRunAtField.spec.tsx` (kit mocked) pins the component contract: label, minimum date present, `datetime-local` round-trip (a local, timezone-suffix-free string parses identically in any runner timezone), unparseable draft → `''`, error + invalid flag, clean state. Value entry uses `fireEvent.change`, because `userEvent.type`'s per-keystroke events are reverted by the controlled value between keys.
- `ScheduledTaskRunAtField.calendar.spec.tsx` (no kit mock — the real `Calendar`, popover, and month grid render) drives the user-facing behavior: yesterday's day button is `disabled` and clicking it fires no `onChange` (`fireEvent`, because `userEvent` rightly refuses disabled buttons); a future day reports a `datetime-local` value; a pre-picked future day shows `aria-pressed="true"` and re-picking keeps its time-of-day. Day buttons are located by the kit's `en-GB` long-date aria-label (`weekday, day month year`) — deliberately kit-DOM-coupled, quarantined in its own file so kit upgrades break these two tests rather than the stable contract spec.

## Risks / Trade-offs

- **The real-kit spec is upgrade-brittle by design** (see above); the coupling is documented in the spec file's header comment.
- **The earliest selectable moment does not enforce the submit lead time** — a `now`-ish selection still fails at submit with the existing validation message. Accepted for now; one-line change if the design wants the picker to enforce it.
- **Runtime-relative test data:** the real-kit spec computes "yesterday"/"tomorrow" against the runner's clock rather than fixing dates, because the earliest selectable moment is a mount-time `new Date()` — a fixed past date would land before the earliest selectable moment (this exact mistake was made and caught during development), and a fixed future date would eventually become past.
