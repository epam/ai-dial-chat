## MODIFIED Requirements

### Requirement: History rows show skeleton loading, status icon, timestamp, and duration

While the initial runs page is loading (`isLoading === true`, no items yet), the History panel SHALL render exactly 6 skeleton run rows. While a subsequent page is loading (`isLoadingMore === true`), the History panel SHALL render exactly 6 skeleton run rows appended below the already-loaded rows. Each loaded run row SHALL show: a human-readable relative/absolute timestamp derived from `startTime` (e.g. "today at 9:01 AM", "Jul 17 at 9:01 AM"); a duration (e.g. `(45s)`, `(1m 39s)`, `(1h 2m 3s)`) rendered after the timestamp in the secondary text color when `durationSeconds` is present or derivable from `startTime`/`endTime`; and a status icon reflecting the run's status — a spinner for `InProgress`, a grey check for `Success`, a red X for `Error`, and a visually distinct treatment for `Missed`. Status icons SHALL be marked `aria-hidden`, and each row's accessible name SHALL include both the status and the timestamp so the status is conveyed to assistive technology without relying on icon color/shape alone.

A row whose run has a non-empty `conversationId` and for which the page supplies `onRunClick` SHALL render as interactive (`role="button"`, `tabIndex={0}`, activatable via click, Enter, or Space, `cursor-pointer`) and, on activation, invoke `onRunClick` with that run. A row whose run has no `conversationId` — regardless of whether `onRunClick` is supplied — SHALL render exactly as a non-interactive row: no button role, no `tabIndex`, no pointer cursor, and activating it (click or keyboard) SHALL have no effect and SHALL NOT invoke `onRunClick`. When a row is interactive, activating it SHALL NOT navigate directly from within `libs/scheduled-tasks` — only the host-supplied `onRunClick` callback fires.

The host SHALL format the duration through `formatRunDuration` (`apps/chat/src/utils/map-scheduled-task-run-dto.ts`) and pass the result to `libs/scheduled-tasks` as the pre-formatted `ScheduledTaskRunItem.durationLabel`. The lib SHALL NOT format durations. `formatRunDuration` SHALL split `durationSeconds` into whole hours (`Math.floor(s / 3600)`), minutes (`Math.floor((s % 3600) / 60)`), and seconds (`s % 60`). It SHALL render each non-zero unit, largest first, through its own translation key: `scheduledTasks.detail.historyDurationHours` (`{{count}}h`), `scheduledTasks.detail.historyDurationMinutes` (`{{count}}m`), and `scheduledTasks.detail.historyDurationSeconds` (`{{count}}s`). It SHALL join the rendered units with a single space and wrap them with the translation key `scheduledTasks.detail.historyDurationSuffix` (`({{duration}})`). A `durationSeconds` of `0` SHALL render `(0s)`. No unit letter SHALL be hard-coded outside `apps/chat/src/i18n/locales/en.json`. A duration of 24 hours or more SHALL stay in hours (no days unit). The scheduled-task conversation banner's timestamp SHALL show the same format, because `formatRunTimestamp` builds its suffix with `formatRunDuration`. The duration is plain text in the row's existing duration slot, so it has no RTL impact beyond what the row already handles. It is not behind any `ENABLED_FEATURES` gate other than the one that already guards Scheduled Tasks.

When `item.isUnread` is `true`, the row SHALL additionally render the shared unread-dot treatment (a reserved `size-3` slot immediately before the timestamp, a `size-[5.33px] rounded-full` disk filled with `var(--text-accent, #1d4ed8)` by default — overridable via an `unreadDotColor` style — marked `aria-hidden`) so timestamps stay aligned across unread and read rows. Because the row's own `aria-label` (built from the status label and timestamp per the requirement above) overrides all descendant text per the ARIA accessible-name algorithm, the unread state MUST be conveyed by appending the row's `unreadIndicatorLabel` to that same `aria-label` — not by a nested `sr-only` span, which an ancestor `aria-label` renders unreachable to assistive technology. When `item.isUnread` is `false` or omitted, no dot renders and the accessible name carries no unread suffix.

#### Scenario: Initial load shows 6 skeleton rows

- **WHEN** the History panel is in its initial load (`isLoading === true`, no items yet)
- **THEN** exactly 6 skeleton run rows render, each marked `aria-hidden="true"`

#### Scenario: Load-more shows 6 skeleton rows below existing rows

- **WHEN** `isLoadingMore` becomes `true` after the user activates the "Show more" button
- **THEN** exactly 6 skeleton run rows render below the already-loaded rows, each marked `aria-hidden="true"`, and disappear once the request resolves and are replaced by the newly appended real rows

#### Scenario: Status icon and accessible name reflect each status value

- **WHEN** rows with `status` values `Success`, `Error`, `InProgress`, and `Missed` render
- **THEN** each shows its distinct status icon (grey check, red X, spinner, and a distinct `Missed` treatment respectively), each icon is `aria-hidden`, and each row's accessible name includes the status and the row's timestamp

#### Scenario: Duration renders when available

- **WHEN** a run has `durationSeconds: 99` (or derivable `startTime`/`endTime` values yielding the same duration)
- **THEN** the row shows a `(1m 39s)` duration after its timestamp, in the secondary text color

#### Scenario: Duration under one minute stays in seconds

- **WHEN** a run has `durationSeconds: 45`
- **THEN** the row's duration reads `(45s)`, and a run with `durationSeconds: 0` reads `(0s)`

#### Scenario: Duration over 60 seconds is shown in minutes and seconds

- **WHEN** a run has `durationSeconds: 61`
- **THEN** the row's duration reads `(1m 1s)` rather than `(61s)`

#### Scenario: Zero-valued units are omitted

- **WHEN** runs have `durationSeconds` values `60`, `3600`, and `3605`
- **THEN** their durations read `(1m)`, `(1h)`, and `(1h 5s)` respectively

#### Scenario: Duration of an hour or more includes hours

- **WHEN** a run has `durationSeconds: 3723`
- **THEN** the row's duration reads `(1h 2m 3s)`, and a run with `durationSeconds: 90180` reads `(25h 3m)`

#### Scenario: Absent duration renders nothing

- **WHEN** a run has no `durationSeconds` (for example an `InProgress` run)
- **THEN** `formatRunDuration` returns `undefined` and the row shows no duration

#### Scenario: Row with a conversation id and onRunClick is interactive and invokes the callback

- **WHEN** a row's run has `conversationId: "conversations/bucket/.scheduler/sched_123/run_9f2a"` and the panel was given `onRunClick`
- **THEN** the row exposes `role="button"`, `tabIndex={0}`, and a pointer cursor, and clicking it (or pressing Enter/Space while it is focused) calls `onRunClick` exactly once with that run

#### Scenario: Row without a conversation id stays static even when onRunClick is supplied

- **WHEN** a row's run has no `conversationId` (absent or `undefined`) and the panel was given `onRunClick`
- **THEN** the row renders with no button role, no `tabIndex`, and no pointer-cursor affordance, and clicking it or pressing Enter/Space while it is focused does not call `onRunClick`

#### Scenario: Row with a conversation id stays static when onRunClick is omitted

- **WHEN** a row's run has `conversationId` set but the panel was not given `onRunClick`
- **THEN** the row renders as a static, non-interactive row identical to today's behavior

#### Scenario: Unread row shows the dot and folds the label into the accessible name

- **WHEN** a row's item has `isUnread: true`
- **THEN** the row renders the unread dot (`aria-hidden`) immediately before the timestamp, the timestamp's horizontal position matches a read row's timestamp position, and the row's `aria-label` ends with the row's `unreadIndicatorLabel` text (e.g. `"Succeeded today at 9:01 AM (1m 39s) — Unread"`)

#### Scenario: Read row renders no dot and no unread suffix

- **WHEN** a row's item has `isUnread: false` or `isUnread` is omitted
- **THEN** no unread dot renders, and the row's `aria-label` contains no unread suffix
