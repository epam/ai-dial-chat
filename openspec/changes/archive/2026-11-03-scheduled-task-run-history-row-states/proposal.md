## Why

QA reopened issue #9297 ([comment](https://github.com/epam/ai-dial-chat/issues/9297#issuecomment-6463950446)): the run-history rows do not match the design's "Run item states" frame. Today a failed run shows its failure only in a hover/focus tooltip on the status icon (`libs/scheduled-tasks/src/components/ScheduledTaskRunHistoryList/ScheduledTaskRunHistoryList.tsx`, the `Tooltip` around `RunStatusIcon`). Only clickable rows get hover feedback. The row's end slot only ever holds the unread dot, so a failed run has no chevron and no inline details. The design specifies five row states (Default, Hover, Selected, Not read, Error) and makes a failed row an accordion that shows the error text under the row.

## What Changes

- **Row states.** Every row matches the design:
  - Default: status icon at the start, timestamp at `dial-small-paragraph-text`.
  - Hover: a light pill tint on every interactive row, expandable rows included.
  - Selected: the existing current-run highlight (`currentRunId`), unchanged.
  - Not read: semibold timestamp plus the blue dot in the end slot.
  - Error: red circle-X at the start and a chevron in the end slot.
- **Failed rows become accordions.** A row is expandable when its status is `Error` and it has non-empty `errorText`.
  - Clicking it, or pressing Enter/Space on it, expands and collapses the error text underneath, aligned with the timestamp. The chevron rotates.
  - The open and close movement is animated with no layout jump.
  - The header exposes `aria-expanded` and `aria-controls`.
  - Rows start collapsed. Each row has its own expanded state, held inside the list.
- **Error row with a conversation.** When an expandable row also has a `conversationId` and the host supplies `onRunClick`, the expanded panel shows an "Open conversation" `LinkButton` that calls `onRunClick`. Clicking the row header only toggles it. (Decided with the user.)
- **The error tooltip is removed.** The error text moves out of the tooltip and out of the row's accessible name, and into the panel the header controls. The header's accessible name stays status + timestamp + duration (+ unread / current run).
- **End slot.** The fixed 12px end slot shows the chevron on an expandable row and the unread dot on every other row. An expandable row that is also unread still has the semibold timestamp and the unread suffix in its accessible name. It just doesn't draw the dot.
- **New lib props** (each optional, English default):
  - `ScheduledTaskRunHistoryListLabels.openConversationLabel`, threaded through `ScheduledTaskHistorySection`, `ScheduledTaskDetailView` and `ScheduledTaskConversationHistorySection`.
  - `colors.errorDetailsTextColor`.
  - `typography.errorDetailsClassName`.
  - `rowExpandedBackground`.
- **App wiring.** `apps/chat` fills the new label in `ScheduledTaskDetailPage` and `TaskHistorySection` through one new key, `scheduledTasks.detail.historyOpenConversationLabel` ("Open conversation").

Not breaking. Every new prop is optional, and no prop is removed or renamed. The one visible change hosts will notice: `errorText` now shows in an inline panel, not a tooltip.

## Non-goals

- Changes to the runs API, the DTO mapping (`mapScheduledTaskRunDtoToItem` already passes `errorText`), pagination, sorting, skeletons, or the empty and error list states.
- Expandable details for `Missed`, `InProgress` or `Success` runs, or for an `Error` run that has no `errorText`. That last one stays a plain row with no chevron.
- Saving which rows are expanded across reloads or pages. Expanding a row does not mark it viewed.
- Changing the Selected/current-run visuals, the unread derivation, or navigation targets. Navigation stays host-owned through `onRunClick`.

## Alternatives considered

- **Kit `Accordion` per row.** Planned first, then rejected after the apply spike. Its caret is a fixed right-pointing chevron that turns down when expanded, where the design has a down chevron that turns up. It also adds a fixed `pt-3` gap above the content, and props can change neither. The lib uses a native disclosure button with the same `grid-template-rows` and `inert` mechanism instead (design.md, D1).
- **Navigate on row click, toggle with a separate chevron button.** Rejected by the user: it puts two tab stops on a row and doesn't match the design's whole-row toggle.
- **Keep the tooltip and add the accordion.** Rejected: the same text in two places, and a screen reader would announce it twice.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `scheduled-task-detail-page`: the "History rows show skeleton loading, status icon, timestamp, and duration" requirement gains the hover/expanded states and the failed-run accordion, and drops the tooltip.
- `scheduled-task-panel-sections`: the "History run rows lead with the status icon and distinguish not-yet-viewed runs" requirement now says what the end slot shows (chevron or unread dot) on the sources-panel History.

## Acceptance criteria

- All six frame states render as designed. Checked in light and dark theme, LTR and RTL, at 360px and on desktop:
  - Default in-progress (spinner)
  - Default
  - Hover
  - Selected
  - Not read (semibold + dot)
  - Error (circle-X + chevron)
- Clicking, Enter or Space on an expandable row toggles its error panel. The chevron and `aria-expanded` update. The panel opens and closes smoothly, and the rows below don't jump. With `prefers-reduced-motion: reduce` it opens and closes instantly.
- Long error text wraps inside the panel (`wrap-break-word`, `whitespace-pre-wrap`) and never widens the row or the History card.
- An expandable row with a conversation shows "Open conversation" in its panel. Clicking it calls `onRunClick` once. Clicking the header never calls it.
- Collapsed panel content can't be reached with Tab or by a screen reader. A visible focus ring matches the hover tint (WCAG 2.4.7). Contrast meets the repository AAA target.
- No regressions: Show more pagination, skeletons, empty and error states, unread semibold and dot on non-error rows, the current-run highlight, and navigation on clickable non-error rows. Covered by `npm exec nx test scheduled-tasks` and the `apps/chat` suites for the two host screens.

## Impact

- **Lib (`libs/scheduled-tasks`)**:
  - `ScheduledTaskRunHistoryList` component and its `.module.scss`.
  - `models/scheduled-task-run-history-list-props.ts`, `models/scheduled-task-run-item.ts` (JSDoc for `errorText`).
  - Label threading in `ScheduledTaskHistorySection`, `ScheduledTaskDetailView` and `ScheduledTaskConversationHistorySection`.
  - Tests and README.

  Shared-lib scope: this lib only, nothing global. It still knows nothing about the host. The host passes the label, colors and `onRunClick`. The lib decides only whether to expand, from `status` + `errorText`.
- **App (`apps/chat`)**: `pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx`, `components/ConversationSourcesPanel/TaskHistorySection/TaskHistorySection.tsx`, `constants/translation-keys.ts`, `i18n/locales/en.json`.
- **i18n**: one new user-visible string ("Open conversation"). No other copy changes.
- **No backend, API, dependency or context changes.**
- **Rollback**: revert the commit. The lib API is purely additive, so a host still on the older lib loses nothing.
