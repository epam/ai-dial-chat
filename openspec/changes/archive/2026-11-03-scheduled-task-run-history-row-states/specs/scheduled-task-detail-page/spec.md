## MODIFIED Requirements

### Requirement: History rows show skeleton loading, status icon, timestamp, and duration

While the initial runs page is loading (`isLoading === true`, no items yet), the History panel SHALL render exactly 6 skeleton run rows. While a subsequent page is loading (`isLoadingMore === true`), the History panel SHALL render exactly 6 skeleton run rows appended below the already-loaded rows.

Each loaded run row SHALL show:

- a human-readable relative or absolute timestamp derived from `startTime` (e.g. "today at 9:01 AM", "Jul 17 at 9:01 AM");
- a duration (e.g. `(45s)`, `(1m 39s)`, `(1h 2m 3s)`) after the timestamp, in the secondary text color, when `durationSeconds` is present or can be derived from `startTime`/`endTime`;
- a status icon at the row start: a spinner for `InProgress`, a grey check for `Success`, a red circle-X for `Error`, and a visually distinct treatment for `Missed`.

Status icons SHALL be marked `aria-hidden`. Each row's accessible name SHALL include both the status and the timestamp, so the status does not depend on icon color or shape alone.

A row is interactive when its run has a non-empty `conversationId`, the page supplies `onRunClick`, and it is not an expandable error row (see below). An interactive row SHALL render as a native `<button type="button">` nested inside the row's `<li>`, so the list keeps its `listitem` children. It SHALL be activatable by click, Enter or Space, use `cursor-pointer`, and call `onRunClick` with that run on activation.

A row whose run has no `conversationId`, and which is not an expandable error row, SHALL render as a non-interactive row whether or not `onRunClick` is supplied. It has no button, no `tabIndex` and no pointer cursor. Clicking it or pressing a key on it SHALL have no effect and SHALL NOT call `onRunClick`.

Activating an interactive row SHALL NOT navigate from within `libs/scheduled-tasks`. Only the host-supplied `onRunClick` callback fires.

**Row states.** `ScheduledTaskRunHistoryList` (`libs/scheduled-tasks/src/components/ScheduledTaskRunHistoryList/ScheduledTaskRunHistoryList.tsx`) SHALL render each row as a full-width rounded pill with the states below. Every color is read through a `var(--strhl-*, fallback)` custom property in its `.module.scss`.

- **Default**: no background. The timestamp uses `typography.runTimestampClassName` (default `'dial-small-paragraph-text'`).
- **Hover**: every interactive row, navigable or expandable, SHALL tint to `rowHoverBackground` (default `--bg-control-accent-alpha-hover-subtle`). `:focus-visible` SHALL apply the same tint plus the `rowFocusOutline` outline. Static rows SHALL NOT change on hover.
- **Selected**: the row whose `id` equals `currentRunId` keeps the existing `currentRunBackground` highlight and `aria-current="true"`. Hovering it SHALL still look different from the highlight.
- **Not read**: when `isUnread` is `true`, the timestamp uses `typography.runTimestampUnreadClassName` (default `'dial-small-paragraph-semi-text'`) and the end slot shows the unread dot (see below).
- **Error**: an `Error` run shows the red circle-X status icon. When the row is expandable, the end slot shows a chevron.
- **Expanded**: an expanded error row's header SHALL use `rowExpandedBackground` (default `--bg-control-accent-alpha-active`, the same token as the Selected highlight, as in the design).

**End slot.** Every row SHALL reserve a fixed `size-3` slot at its inline end, so timestamps keep the same width across rows. The slot SHALL show, in order of precedence:

1. the chevron, on an expandable error row;
2. otherwise the unread dot, when `isUnread` is `true`: a `size-[5.33px] rounded-full` disk filled with `var(--strhl-unread-dot, var(--text-accent, #1d4ed8))`, marked `aria-hidden`;
3. otherwise nothing.

An expandable error row that is also unread SHALL keep the semibold timestamp and the unread suffix in its accessible name, but SHALL NOT draw the dot.

**Accessible name.** A row's accessible name is its status label, timestamp and duration, joined by spaces. Per the ARIA accessible-name algorithm, this name overrides all descendant text. So the unread state MUST be added by appending `unreadIndicatorLabel` (default `'Unread'`) to that name, and the current-run state by appending `currentRunLabel`, each after a ` — ` separator. A nested `sr-only` span would not be heard. When `item.isUnread` is `false` or omitted, no dot renders and the name has no unread suffix. `errorText` SHALL NOT be part of any row's accessible name.

**Expandable failed runs.** A row SHALL be expandable exactly when `status === ScheduledTaskRunStatus.Error` and `errorText` is a non-empty string. An `Error` row without `errorText` follows the interactive/non-interactive rules above and shows no chevron.

An expandable row SHALL render as a native `<button type="button">` disclosure header followed by its details region. The kit 2.0 `Accordion` is not used, because its caret glyph and content spacing cannot be set to the design (see the change's design.md, D1). `ScheduledTaskRunHistoryList` SHALL control the row from component-local state: a `Set` of expanded run ids, with no context, no host state and no persistence. Rows start collapsed.

- **Toggling.** Clicking the header, or pressing Enter or Space while it is focused, SHALL toggle the row. The header SHALL expose `aria-expanded` and an `aria-controls` that points at the details region, which is a `role="region"` element labelled by the header. The header's accessible name SHALL be the row's accessible name above, set as its `aria-label`. Its chevron SHALL point down when collapsed and up when expanded. Toggling SHALL NOT call `onRunClick`, SHALL NOT mark the run viewed, and SHALL NOT move focus.
- **Details text.** The details region SHALL show `errorText` under the header, starting at the same edge as the timestamp. It uses `typography.errorDetailsClassName` (default `'dial-tiny-text'`) and `colors.errorDetailsTextColor` (default `var(--text-secondary, #57647a)`). It SHALL keep line breaks and wrap long unbroken strings (`whitespace-pre-wrap wrap-break-word`), so it never widens the row or the History card.
- **Collapsed and animation.** While collapsed, the region SHALL stay mounted and `inert`. Its text and any control inside are then out of the tab order and the accessibility tree. Opening and closing SHALL animate the region's height, moving the rows below by no more than the region's own height. Under `prefers-reduced-motion: reduce` it SHALL open and close instantly.
- **Open conversation link.** When the expandable run also has a non-empty `conversationId` and the host supplies `onRunClick`, the region SHALL also show a kit `LinkButton` labelled `labels.openConversationLabel` (default `'Open conversation'`). Each activation SHALL call `onRunClick` with the run exactly once. Without a `conversationId`, or without `onRunClick`, no link renders.
- **Tooltip removed.** The former hover/focus `Tooltip` on the error status icon SHALL be removed. No status icon is focusable.
- **Stability.** Expanded state SHALL survive "Show more" pages and re-renders with the same run ids. When a run id leaves `items`, that row simply stops rendering.

**Label wiring.** `ScheduledTaskHistorySection`, `ScheduledTaskDetailView` and `ScheduledTaskConversationHistorySection` SHALL pass `labels.openConversationLabel` through unchanged. The chat app SHALL fill it with `t(ScheduledTasksI18nKeys.DetailHistoryOpenConversationLabel)` in both `apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx` and `apps/chat/src/components/ConversationSourcesPanel/TaskHistorySection/TaskHistorySection.tsx`. The i18n key is `scheduledTasks.detail.historyOpenConversationLabel`, English "Open conversation".

**RTL, accessibility, gating.**

- RTL: the row uses logical padding and `text-start`, and the end slot follows `dir`. The chevron is a vertical expand/collapse glyph and SHALL NOT be mirrored.
- Accessibility: focus-visible SHALL match hover plus an outline (WCAG 2.4.7). Fallback colors SHALL meet the repository AAA target for the timestamp text.
- Memoisation: none required, beyond keeping row-render callbacks stable enough that toggling one row does not remount the others.
- Gating and telemetry: no `ENABLED_FEATURES` key beyond the existing Scheduled Tasks gate, and no telemetry.

**Duration format.** The host SHALL format the duration with `formatRunDuration` (`apps/chat/src/utils/map-scheduled-task-run-dto.ts`) and pass the result to `libs/scheduled-tasks` as the pre-formatted `ScheduledTaskRunItem.durationLabel`. The lib SHALL NOT format durations.

`formatRunDuration` SHALL split `durationSeconds` into whole hours (`Math.floor(s / 3600)`), minutes (`Math.floor((s % 3600) / 60)`) and seconds (`s % 60`). It SHALL render each non-zero unit, largest first, through its own translation key:

- `scheduledTasks.detail.historyDurationHours` (`{{count}}h`)
- `scheduledTasks.detail.historyDurationMinutes` (`{{count}}m`)
- `scheduledTasks.detail.historyDurationSeconds` (`{{count}}s`)

It SHALL join the rendered units with a single space and wrap them with the translation key `scheduledTasks.detail.historyDurationSuffix` (`({{duration}})`). A `durationSeconds` of `0` SHALL render `(0s)`. A duration of 24 hours or more SHALL stay in hours; there is no days unit. No unit letter SHALL be hard-coded outside `apps/chat/src/i18n/locales/en.json`.

The scheduled-task conversation banner's timestamp SHALL use the same format, because `formatRunTimestamp` builds its suffix with `formatRunDuration`. The duration is plain text in the row's existing duration slot, so it adds no RTL impact beyond the row's own. It sits behind no `ENABLED_FEATURES` gate other than the one that already guards Scheduled Tasks.


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

- **WHEN** a `Success` row's run has `conversationId: "conversations/bucket/.scheduler/sched_123/run_9f2a"` and the panel was given `onRunClick`
- **THEN** the row renders a native button with a pointer cursor and the hover tint
- **AND** clicking it, or pressing Enter or Space while it is focused, calls `onRunClick` exactly once with that run

#### Scenario: Row without a conversation id stays static even when onRunClick is supplied

- **WHEN** a non-expandable row's run has no `conversationId` (absent or `undefined`) and the panel was given `onRunClick`
- **THEN** the row renders with no button, no `tabIndex`, no pointer cursor and no hover tint
- **AND** clicking it, or pressing Enter or Space, does not call `onRunClick`

#### Scenario: Row with a conversation id stays static when onRunClick is omitted

- **WHEN** a non-expandable row's run has `conversationId` set but the panel was not given `onRunClick`
- **THEN** the row renders as a static, non-interactive row

#### Scenario: Unread row shows the dot at the row end and folds the label into the accessible name

- **WHEN** a non-expandable row's item has `isUnread: true`
- **THEN** the row renders the unread dot (`aria-hidden`) in the reserved end slot
- **AND** its timestamp carries `dial-small-paragraph-semi-text`, at the same horizontal position as a read row's timestamp
- **AND** the row's accessible name ends with the `unreadIndicatorLabel` text (e.g. `"Succeeded today at 9:01 AM (1m 39s) — Unread"`)

#### Scenario: Read row renders no dot and no unread suffix

- **WHEN** a row's item has `isUnread: false` or `isUnread` is omitted
- **THEN** no unread dot renders, and the row's accessible name contains no unread suffix

#### Scenario: Failed run with error text renders collapsed with a chevron

- **WHEN** a row has `status: Error` and `errorText: "The scheduled task failed to complete due to a connection timeout."`
- **THEN** the row shows the red circle-X at its start and a chevron in its end slot
- **AND** its header exposes `aria-expanded="false"` and an accessible name made of status, timestamp and duration, without the error text
- **AND** the error text cannot be reached by Tab and is not in the accessibility tree

#### Scenario: Activating a failed row toggles its details

- **WHEN** the user clicks that row's header, or focuses it and presses Enter or Space
- **THEN** the header's `aria-expanded` becomes `"true"`, the chevron flips, and the error text appears under the row, starting at the same edge as the timestamp
- **AND** activating the header again collapses the region
- **AND** the header never calls `onRunClick`

#### Scenario: Expanded failed run with a conversation offers an Open conversation link

- **WHEN** an expanded `Error` row has `errorText` and `conversationId: "conversations/bucket/.scheduler/sched_123/run_9f2a"`, and the panel was given `onRunClick`
- **THEN** the region renders a `LinkButton` named by `labels.openConversationLabel` (default "Open conversation")
- **AND** activating it calls `onRunClick` exactly once with that run

#### Scenario: Expanded failed run without a conversation renders no link

- **WHEN** an expanded `Error` row has `errorText` but no `conversationId`, or the panel was not given `onRunClick`
- **THEN** the region renders only the error text

#### Scenario: Error run without error text is not expandable

- **WHEN** a row has `status: Error` and `errorText` is absent or empty
- **THEN** no chevron and no details region render
- **AND** the row is interactive or static according to its `conversationId`

#### Scenario: Error text on a non-error run is ignored

- **WHEN** a row has `status: Success` and a non-empty `errorText`
- **THEN** the row is not expandable and the text is not rendered anywhere

#### Scenario: Unread failed run keeps the chevron

- **WHEN** an expandable `Error` row also has `isUnread: true`
- **THEN** the end slot shows the chevron and no dot
- **AND** the timestamp is semibold, and the accessible name ends with the `unreadIndicatorLabel` text

#### Scenario: Long error text wraps without breaking the layout

- **WHEN** an expanded row's `errorText` is 600 characters long, includes a 120-character run with no spaces, and renders in a 360px-wide History panel
- **THEN** the text wraps inside the region, and neither the row nor the History card scrolls horizontally

#### Scenario: Expanded state survives loading more runs

- **WHEN** a failed row is expanded and the user activates "Show more", which appends new rows
- **THEN** the same row stays expanded and the appended rows render collapsed
- **AND** no other row's expanded state changes

#### Scenario: Reduced motion opens instantly

- **WHEN** `prefers-reduced-motion: reduce` is set and the user toggles a failed row
- **THEN** the region opens and closes without a height transition

#### Scenario: RTL places the status icon and chevron on logical edges

- **WHEN** the History panel renders under `dir="rtl"`
- **THEN** the status icon sits at the right (inline start), and the chevron or unread dot at the left (inline end)
- **AND** the chevron glyph is not mirrored
