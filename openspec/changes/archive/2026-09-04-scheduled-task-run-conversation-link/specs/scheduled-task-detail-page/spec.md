## MODIFIED Requirements

### Requirement: History rows show skeleton loading, status icon, timestamp, and duration

While the initial runs page is loading (`isLoading === true`, no items yet), the History panel SHALL render exactly 6 skeleton run rows. While a subsequent page is loading (`isLoadingMore === true`), the History panel SHALL render exactly 6 skeleton run rows appended below the already-loaded rows. Each loaded run row SHALL show: a human-readable relative/absolute timestamp derived from `startTime` (e.g. "today at 9:01 AM", "Jul 17 at 9:01 AM"); a duration suffix (e.g. `(99s)`) when `durationSeconds` is present or derivable from `startTime`/`endTime`; and a status icon reflecting the run's status — a spinner for `InProgress`, a green check for `Success`, a red X for `Error`, and a visually distinct treatment for `Missed`. Status icons SHALL be marked `aria-hidden`, and each row's accessible name SHALL include both the status and the timestamp so the status is conveyed to assistive technology without relying on icon color/shape alone.

A row whose run has a non-empty `conversationId` and for which the page supplies `onRunClick` SHALL render as interactive (`role="button"`, `tabIndex={0}`, activatable via click, Enter, or Space, `cursor-pointer`) and, on activation, invoke `onRunClick` with that run. A row whose run has no `conversationId` — regardless of whether `onRunClick` is supplied — SHALL render exactly as a non-interactive row: no button role, no `tabIndex`, no pointer cursor, and activating it (click or keyboard) SHALL have no effect and SHALL NOT invoke `onRunClick`. When a row is interactive, activating it SHALL NOT navigate directly from within `libs/scheduled-tasks` — only the host-supplied `onRunClick` callback fires.

When `item.isUnread` is `true`, the row SHALL additionally render the shared unread-dot treatment (a reserved `size-3` slot immediately before the timestamp, a `size-[5.33px] rounded-full` disk filled with `var(--text-accent, #1d4ed8)` by default — overridable via an `unreadDotColor` style — marked `aria-hidden`) so timestamps stay aligned across unread and read rows. Because the row's own `aria-label` (built from the status label and timestamp per the requirement above) overrides all descendant text per the ARIA accessible-name algorithm, the unread state MUST be conveyed by appending the row's `unreadIndicatorLabel` to that same `aria-label` — not by a nested `sr-only` span, which an ancestor `aria-label` renders unreachable to assistive technology. When `item.isUnread` is `false` or omitted, no dot renders and the accessible name carries no unread suffix.

#### Scenario: Initial load shows 6 skeleton rows

- **WHEN** the History panel is in its initial load (`isLoading === true`, no items yet)
- **THEN** exactly 6 skeleton run rows render, each marked `aria-hidden="true"`

#### Scenario: Load-more shows 6 skeleton rows below existing rows

- **WHEN** `isLoadingMore` becomes `true` after the user activates the "Show more" button
- **THEN** exactly 6 skeleton run rows render below the already-loaded rows, each marked `aria-hidden="true"`, and disappear once the request resolves and are replaced by the newly appended real rows

#### Scenario: Status icon and accessible name reflect each status value

- **WHEN** rows with `status` values `Success`, `Error`, `InProgress`, and `Missed` render
- **THEN** each shows its distinct status icon (green check, red X, spinner, and a distinct `Missed` treatment respectively), each icon is `aria-hidden`, and each row's accessible name includes the status and the row's timestamp

#### Scenario: Duration renders when available

- **WHEN** a run has `durationSeconds: 99` (or derivable `startTime`/`endTime` values yielding the same duration)
- **THEN** the row's timestamp text includes a `(99s)` duration suffix

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
- **THEN** the row renders the unread dot (`aria-hidden`) immediately before the timestamp, the timestamp's horizontal position matches a read row's timestamp position, and the row's `aria-label` ends with the row's `unreadIndicatorLabel` text (e.g. `"Succeeded today at 9:01 AM (99s) — Unread"`)

#### Scenario: Read row renders no dot and no unread suffix

- **WHEN** a row's item has `isUnread: false` or `isUnread` is omitted
- **THEN** no unread dot renders, and the row's `aria-label` contains no unread suffix

### Requirement: Presentational ScheduledTaskDetailView stays host-agnostic

`libs/scheduled-tasks` SHALL export a presentational `ScheduledTaskDetailView` component accepting only props: localized label strings (including Edit and Delete button labels, the Active switch's label/status announcements, a deleted-state label, and the History panel's `unreadIndicatorLabel`), detail field values (`description`, model display value, schedule label), either `instructionsMarkdown: string` or a `renderInstructions: (markdown: string) => ReactNode` callback, a runs list (each item optionally carrying `conversationId` and `isUnread`) plus `{ runsHasMore, runsIsLoadingMore, runsSkeletonCount, onRunsLoadMore, onRunClick? }`, top-level `isLoading`/`error` flags and their History-scoped counterparts, an `onBack` callback, an optional `onEdit?: () => void` callback, optional `isActive?: boolean`/`isActiveUpdating?: boolean`/`isActiveDisabled?: boolean`/`onActiveChange?: (nextActive: boolean) => void` for the Active switch, an optional `onDelete?: () => void` callback, an optional `isDeleting?: boolean` flag, and an optional `isDeleted?: boolean` flag.

When `onEdit` is supplied, the component SHALL render the Edit button; when omitted, no Edit button renders. When `onDelete` is supplied, the component SHALL render the Delete action; when omitted, no Delete action renders. When `isActive` is `undefined`, no Active switch SHALL render. When `isDeleted` is `true`, the component SHALL render its read-only deleted-state indicator and SHALL NOT render the Edit button, Delete action, or Active switch regardless of whether `onEdit`/`onDelete`/`isActive` are supplied — `isDeleted` takes precedence over the presence of those callbacks. When `isDeleting` is `true`, the component SHALL render the Edit button, Delete action, and Active switch (whichever are otherwise eligible to render) in a disabled state rather than omitting them. `onRunClick`, when supplied, SHALL be invoked by the History panel only for a row whose run carries a non-empty `conversationId`, per the "History rows show skeleton loading, status icon, timestamp, and duration" requirement; the component SHALL NOT itself navigate, resolve routes, or call `markConversationViewed`. The component SHALL NOT import `@epam/chat-api-client`, any routing module, i18n, or auth/env/analytics modules, and SHALL NOT render any confirmation dialog itself — activating Delete only invokes `onDelete`; the host page owns opening/closing the confirmation dialog, the API call, and all post-delete navigation.

#### Scenario: Lib has no host or integration imports

- **WHEN** `libs/scheduled-tasks`'s `ScheduledTaskDetailView` source is statically analyzed
- **THEN** it contains no imports of `apps/chat/*`, `@epam/chat-api-client`, routing, feature-flag, auth, env, or analytics modules, and no import of a confirmation-dialog component, and no import of `@epam/ai-dial-conversation-panel`

#### Scenario: Instructions rendering is delegated when a callback is supplied

- **WHEN** `ScheduledTaskDetailView` renders with a `renderInstructions` callback supplied
- **THEN** the Instructions content is produced by calling that callback with the `prompt` markdown string, rather than the lib rendering markdown itself

#### Scenario: onBack is invoked without the lib performing navigation

- **WHEN** the user activates the back control rendered by `ScheduledTaskDetailView`
- **THEN** `onBack` is called exactly once, and the lib performs no `navigate`/history call itself

#### Scenario: onEdit is invoked without the lib performing navigation

- **WHEN** the user activates the Edit button rendered by `ScheduledTaskDetailView`
- **THEN** `onEdit` is called exactly once, and the lib performs no `navigate`/history call or `scheduleId` resolution itself

#### Scenario: Edit button renders only when onEdit is supplied

- **WHEN** `ScheduledTaskDetailView` renders with `onEdit` left `undefined` and `isDeleted` is not `true`
- **THEN** no Edit button is present in the header, regardless of loading state

#### Scenario: onDelete is invoked without the lib opening a dialog or calling an API

- **WHEN** the user activates the Delete action rendered by `ScheduledTaskDetailView`
- **THEN** `onDelete` is called exactly once, and the lib renders no dialog, performs no network call, and performs no `scheduleId` resolution itself

#### Scenario: Delete action renders only when onDelete is supplied and the task is not deleted

- **WHEN** `ScheduledTaskDetailView` renders with `onDelete` left `undefined`, or with `isDeleted: true` regardless of whether `onDelete` is supplied
- **THEN** no Delete action is present in the header

#### Scenario: isDeleted suppresses Edit, Delete, and Active regardless of callback presence

- **WHEN** `ScheduledTaskDetailView` renders with `isDeleted: true` and `onEdit`, `onDelete`, and `isActive` all supplied with defined values
- **THEN** none of the Edit button, Delete action, or Active switch render; only the deleted-state indicator renders in their place

#### Scenario: Active switch renders only when isActive is defined

- **WHEN** `ScheduledTaskDetailView` renders with `isActive` left `undefined` (loading, error, or an upstream response with no basis to decide)
- **THEN** no Active switch is present in the header

#### Scenario: onActiveChange is invoked with the requested value without the lib calling any API

- **WHEN** the user toggles the Active switch from checked to unchecked (or vice versa)
- **THEN** `onActiveChange` is called exactly once with the newly requested boolean value, and the lib performs no network call, optimistic update, or `scheduleId` resolution itself

#### Scenario: Active switch is disabled while updating or explicitly disabled

- **WHEN** `isActiveUpdating` or `isActiveDisabled` is `true`
- **THEN** the rendered switch exposes a disabled state and does not call `onActiveChange` when interacted with

#### Scenario: onRunClick fires only for clickable rows and never navigates from the lib

- **WHEN** `onRunClick` is supplied and the user activates a row whose run has `conversationId` set, versus a row whose run has no `conversationId`
- **THEN** `onRunClick` is called exactly once for the first row and not at all for the second, and in neither case does the lib call `navigate`, resolve a route, or call `markConversationViewed`

## ADDED Requirements

### Requirement: Detail page navigates from a History run to its conversation

`ScheduledTaskDetailPage` SHALL pass `onRunClick` to `ScheduledTaskDetailView`. On activation of a row whose run item has a non-empty `conversationId`, the page SHALL call `navigate(getConversationRoute(run.conversationId))` (`apps/chat/src/constants/routes.ts`, which already strips a leading `conversations/` segment and rejects `.`/`..` path segments). The page SHALL NOT call `markConversationViewed` itself for this navigation — marking the newly active conversation viewed is already handled, for every route in the app, by the existing `useActiveConversationSync` hook (`@epam/ai-dial-chat-hooks`, wired into the always-mounted `ConversationPanelView` in `apps/chat/src/app/app.tsx`), which reacts to the URL-derived active conversation id changing and matching a loaded conversation-list item. `ScheduledTaskDetailView`'s own row-interactivity rule (no `conversationId` → no click) means the page never receives an activation for a run lacking one; the page SHALL NOT additionally guard against that case with its own no-op branch beyond what type-narrowing already requires.

#### Scenario: Activating a run with a conversation id navigates to it

- **WHEN** the user clicks (or activates via keyboard) a History row whose run has `conversationId: "conversations/bucket/.scheduler/sched_123/run_9f2a"`
- **THEN** the app navigates to `getConversationRoute("conversations/bucket/.scheduler/sched_123/run_9f2a")`, and the page itself makes no direct call to `markConversationViewed`

#### Scenario: Navigating to the conversation clears the History dot on the next render

- **GIVEN** a run row rendered with `isUnread: true` because its matched conversation's `isUnread` was `true`
- **WHEN** the user activates that row, the app navigates to the matched conversation, the existing `useActiveConversationSync` effect marks it viewed, and the conversation list subsequently reflects `isUnread: false` for that conversation
- **THEN** the same run row no longer renders the unread dot on the next render

### Requirement: History run unread state is derived from the existing conversation list, not a new source

`ScheduledTaskDetailPage` SHALL compute each run's `isUnread` by matching `run.conversationId` against the conversation items already loaded via `ConversationsContext`, using `conversationIdsMatch` (`apps/chat/src/utils/conversation-id-match.ts`) to tolerate id-format differences (a `conversations/`-prefixed resource path versus an unprefixed panel id, and URI-encoding differences) between the run's `conversationId` and a conversation list item's `id`. A run whose `conversationId` is absent, or which matches no loaded conversation item, SHALL resolve to `isUnread: false` (never `undefined` and never treated as an error). A run whose `conversationId` matches a loaded conversation item SHALL resolve to that item's own `isUnread` value exactly (`true` only when the matched item's `isUnread` is `true`). This computation SHALL NOT trigger a new fetch of the conversation list, a new fetch of run data, or persist anything — it is a pure derivation over data both contexts already hold.

#### Scenario: Matching conversation with isUnread true produces a dot

- **GIVEN** `ConversationsContext` holds a loaded conversation item with `id: "bucket/.scheduler/sched_123/run_9f2a"` and `isUnread: true`
- **WHEN** a run's `conversationId` is `"conversations/bucket/.scheduler/sched_123/run_9f2a"` (prefixed differently than the list item's `id`)
- **THEN** `conversationIdsMatch` resolves them as the same conversation, and the run's item passed to `ScheduledTaskRunHistoryList` has `isUnread: true`

#### Scenario: No matching conversation produces no dot

- **WHEN** a run's `conversationId` does not match any conversation item currently loaded in `ConversationsContext` (e.g. the conversation was deleted, or the list has not finished loading)
- **THEN** the run's item passed to `ScheduledTaskRunHistoryList` has `isUnread: false`, and no error is raised

#### Scenario: Absent conversation id produces no dot

- **WHEN** a run has no `conversationId`
- **THEN** the run's item passed to `ScheduledTaskRunHistoryList` has `isUnread: false`
