## MODIFIED Requirements

### Requirement: History section shows the task's run list with the active run highlighted

For a scheduled-task conversation, the panel SHALL render a History section built from a shared, host-agnostic presentational component (`ScheduledTaskRunHistoryList`, extracted from the existing `ScheduledTaskDetailView` history rendering into `libs/scheduled-tasks`) fed by the same `useScheduledTaskRuns` state already owned by `ActiveScheduledTaskContext` — no independent fetch is issued by the sources panel.

Each row SHALL show: a localized timestamp (reusing the existing `formatRunTimestamp` convention), a duration suffix when available, and a status icon for `Success`, `Error`, `InProgress`, or `Missed` (reusing the existing `ScheduledTaskRunStatus` enum and icon mapping). Each row's accessible name SHALL include both its status and its timestamp.

The row whose `id` equals the active conversation's `runId` SHALL receive a current-run visual treatment matching the reference design, AND an accessible indication that does not rely on color alone (e.g. an `aria-current="true"` attribute or equivalent text conveyed to assistive technology). If the active `runId` is not present in the currently loaded pages, no row is marked current until a subsequent page load includes it; the section SHALL NOT eagerly fetch every page solely to locate that run.

A row SHALL render as interactive (`role="button"`, keyboard-activatable) and, on activation, navigate to that run's conversation via `getConversationRoute(run.conversationId)` — if and only if that run has a non-empty `conversationId` (mapped from the upstream `conversation_id` field, per the `scheduled-tasks-api` capability). A row whose run has no `conversationId` SHALL remain informational-only: activating it SHALL NOT navigate, fetch run details, or expose any additional row action. `ConversationSourcesPanelContainer` performs no `markConversationViewed` call itself for this navigation — the app's existing `useActiveConversationSync` already marks the newly-active conversation viewed once the URL changes, the same mechanism `scheduled-task-detail-page`'s equivalent History card relies on.

A row whose matched conversation (resolved by matching `run.conversationId` against `useConversations().conversations` via `conversationIdsMatch`, tolerating id-format differences) has `isUnread: true` SHALL additionally show the shared unread-dot indicator, with the unread state folded into that row's accessible name (per `scheduled-task-detail-page`'s equivalent requirement — an ancestor `aria-label` overrides nested `sr-only` content, so the label cannot be a separate nested span). A run with no `conversationId`, or whose `conversationId` matches no loaded conversation item, SHALL show no unread dot.

Runs SHALL be shown in server order (newest first), matching the order already returned by `listScheduledTaskRuns` and preserved by `useScheduledTaskRuns`'s append-without-resort behavior.

#### Scenario: Row shows status, timestamp, and duration

- **WHEN** a loaded run has `status: 'Success'` and a `durationSeconds` value
- **THEN** its row shows a success status icon, its formatted timestamp, and a duration suffix
- **AND** the row's accessible name mentions both the status and the timestamp

#### Scenario: Active run is visually and accessibly marked

- **WHEN** a loaded run's `id` equals the active conversation's `runId`
- **THEN** that row receives the current-run visual treatment
- **AND** an accessible attribute or text conveys "current run" independent of color

#### Scenario: Active run not yet loaded shows no highlighted row

- **WHEN** the active `runId` is not present among the currently loaded run items
- **THEN** no row is marked as current
- **AND WHEN** a later page load includes that run
- **THEN** that row becomes marked as current without any additional fetch triggered solely to find it

#### Scenario: Row with a conversation id navigates to it

- **WHEN** the user clicks (or activates via keyboard) a row whose run has a non-empty `conversationId`
- **THEN** the app navigates to `getConversationRoute(run.conversationId)`, and `ConversationSourcesPanelContainer` makes no direct `markConversationViewed` call

#### Scenario: Row without a conversation id stays a no-op

- **WHEN** the user clicks or activates a run row whose run has no `conversationId`
- **THEN** no navigation occurs, no run-detail request is issued, and no additional menu or action appears

#### Scenario: Unread run shows the dot and accessible suffix

- **WHEN** a row's run has a `conversationId` matching a loaded conversation-list item whose `isUnread` is `true`
- **THEN** the row renders the unread dot and its accessible name ends with the unread indicator label

#### Scenario: Read or unmatched run shows no dot

- **WHEN** a row's run has no `conversationId`, or a `conversationId` that matches no loaded conversation-list item, or matches one whose `isUnread` is `false`
- **THEN** the row renders no unread dot and no unread suffix in its accessible name
