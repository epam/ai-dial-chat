# Spec: scheduled-task-conversation-context

## Purpose

Specifies how the currently active conversation is matched to the scheduled task and run that produced it, how that task's detail and initial run-history page are fetched independently of conversation rendering, how identifier changes reset and de-race those fetches, and how a compact task-summary banner surfaces this context above the conversation messages.

## Requirements

### Requirement: Active conversation is matched to scheduler metadata via the canonical conversation-list item

A new context, `ActiveScheduledTaskContext` (`apps/chat/src/context/ActiveScheduledTaskContext.tsx`, provider `ActiveScheduledTaskProvider`, consumer hook `useActiveScheduledTask`), SHALL own resolution of scheduler metadata for the currently routed conversation. The consumer hook SHALL throw a clear error when used outside the provider, per the `ThemeContext` pattern.

The context SHALL derive the active conversation id from the route (the same wildcard route param `Conversation.tsx` reads) and locate the matching item in `useConversations().conversations` using `conversationIdsMatch` from `apps/chat/src/utils/conversation-id-match.ts` — SHALL NOT use `Array.prototype.includes` substring matching, raw `===` on undecoded ids, or any parsing of the visible conversation title.

The context SHALL treat a conversation as a "scheduled-task conversation" only when the matched item has `isScheduledTask === true` AND `scheduleId` is a non-empty string AND `runId` is a non-empty string AND `useFeatureFlag('scheduledTasksEnabled')` is `true`. When any condition is false (including while `conversations` has not yet loaded for the first time since the identity/session began), the context's derived state SHALL be `'resolving'` until the conversation list has loaded once, then `'not-a-task-conversation'` if the conditions still do not hold.

The context value SHALL be wrapped in `useMemo`, recomputed only when the route conversation id, the `conversations` array reference, or the feature-flag value changes.

#### Scenario: Matching uses the canonical id-matching helper

- **WHEN** the active route's conversation id and a list item's `id` differ only by URL-encoding or normalization handled by `conversationIdsMatch`
- **THEN** the context still identifies that list item as the match

#### Scenario: Substring or raw-title matching is not used

- **WHEN** two different conversation ids share a common substring but do not satisfy `conversationIdsMatch`
- **THEN** the context does not treat them as the same conversation

#### Scenario: Direct navigation waits for the conversation list before resolving

- **WHEN** a user navigates directly to a scheduled-task conversation's URL and `useConversations().isLoading` is still `true`
- **THEN** the context's derived state is `'resolving'`, not `'not-a-task-conversation'`
- **AND** the conversation route renders and is usable while `'resolving'`

#### Scenario: Non-task conversation triggers no scheduler derivation

- **WHEN** the matched list item has `isScheduledTask === false` (or is not found)
- **THEN** the context's derived state is `'not-a-task-conversation'` and exposes no `scheduleId`/`runId`

#### Scenario: Feature flag disabled treats the conversation as non-task

- **WHEN** the matched list item has `isScheduledTask === true` with `scheduleId` and `runId` present, but `useFeatureFlag('scheduledTasksEnabled')` is `false`
- **THEN** the context's derived state is `'not-a-task-conversation'`

---

### Requirement: Task detail and initial run-history page are fetched concurrently and independently

Once the context derives a valid `{ scheduleId, runId }` pair, it SHALL start two requests without either waiting for the other:

- `getScheduledTask(scheduleId)` from `apps/chat/src/server-api/scheduled-tasks.api.ts`, tracked as `taskState: 'loading' | 'error' | 'success'` with the resolved `ScheduledTaskDto` on success.
- The first page of `useScheduledTaskRuns(scheduleId, true)` (reused unmodified), exposed as-is on the context value.

Fetches SHALL use the existing `cancelled`-flag-before-`setState` convention (per `useFavicon.ts` and `useScheduledTaskRuns.ts:59`). Rendering of the conversation messages and the existing sources-panel content SHALL NOT be blocked or delayed by either request's pending or failed state.

#### Scenario: Both requests start together

- **WHEN** the context resolves a valid `scheduleId`/`runId` pair for the first time in a session
- **THEN** `getScheduledTask(scheduleId)` and the initial `listScheduledTaskRuns` page are both requested before either resolves

#### Scenario: Conversation renders while task data is pending or failed

- **WHEN** `taskState` is `'loading'` or `'error'`
- **THEN** the conversation's messages continue to render normally

---

### Requirement: Requests reset and stale responses are ignored on identifier change

When the active `scheduleId` changes (including transitioning to no scheduled-task conversation), the context SHALL reset `taskState` to `'loading'`/`undefined` and re-run both fetches for the new `scheduleId` before any new state is committed. In-flight requests for a previous `scheduleId` SHALL be aborted or their results ignored — a response belonging to a stale `scheduleId` SHALL NEVER overwrite state for the current `scheduleId`.

When only `runId` changes while `scheduleId` stays the same (navigating between two conversations produced by the same schedule), the context SHALL NOT refetch `getScheduledTask`, and SHALL update the current-run derivation (used for highlighting and the banner timestamp) from already-loaded `history.items` plus the new `runId` without a new task-detail request.

#### Scenario: Switching to an unrelated scheduled-task conversation replaces state cleanly

- **WHEN** the user navigates from scheduled-task conversation A (`scheduleId = X`) to scheduled-task conversation B (`scheduleId = Y`) before A's `getScheduledTask` request resolves
- **THEN** A's eventual response does not populate state once B is active
- **AND** B's own `getScheduledTask` and run-history requests are issued

#### Scenario: Switching between runs of the same schedule avoids refetching task details

- **WHEN** the user navigates from one conversation to another conversation where both share the same `scheduleId` but different `runId`
- **THEN** `getScheduledTask` is not called again
- **AND** the current-run highlight and banner timestamp update to reflect the new `runId`

---

### Requirement: Compact task-summary banner renders above conversation messages

`ConversationView` (`apps/chat/src/components/ConversationView/ConversationView.tsx`) SHALL accept an optional `topContent?: ReactNode` prop rendered inside the scrollable message container, immediately above the message list. `ConversationPage` (`apps/chat/src/pages/Conversation/Conversation.tsx`) SHALL pass a `ScheduledTaskConversationBanner` (`apps/chat/src/components/ScheduledTaskConversationBanner/ScheduledTaskConversationBanner.tsx`) as `topContent` only when `useActiveScheduledTask()`'s derived state is a scheduled-task conversation.

The banner matches the reference Figma design (node `143:6385` in the "DIAL Chat 2.0 — Scheduled tasks" file): a single rounded card (`bg-layer-sunken` background, `border-secondary` border) containing the name+timestamp text on the start side and a "Task details" pill action on the end side.

The banner SHALL show:
- The fetched task's `displayName` once `taskState === 'success'`; a skeleton/compact loading placeholder while `taskState === 'loading'`.
- A run timestamp next to `displayName`, on the same line, SHALL be shown as soon as the task's `displayName` is shown — it is never omitted while `taskState === 'success'`. Its source is resolved in this priority order:
  1. The exact run's formatted timestamp (via the existing `formatRunTimestamp` convention, including any duration suffix) once a run matching the active `runId` is present in `history.items`.
  2. Until then, a fallback timestamp formatted via the same `formatRunTimestamp` convention from the matched conversation list item's own `updatedAt` (exposed by `useActiveScheduledTask()` as `conversationUpdatedAt`) — the run that created this conversation is frequently not yet present in the first loaded page of run history, so this fallback avoids a banner with a name but no date.
  3. The banner swaps from the fallback to the exact run's timestamp in place, without a layout shift, once that run loads.
- An inline-end "Task details" navigation action (semantic link/button, SPA navigation, no full page reload) to `getScheduledTaskDetailRoute(scheduleId)`, with a directional chevron icon.

The banner SHALL NOT be added to the conversation's `messages` array and SHALL NOT be persisted as a conversation message. On `taskState === 'error'`, the banner SHALL NOT hide or displace the conversation messages; it SHALL render a scoped retry action or omit the unavailable metadata, following the nearest existing inline-error pattern in the codebase, without blocking message rendering.

The "Task details" action's `href`/navigation target SHALL be computed by `getScheduledTaskDetailRoute` inside `apps/chat` (the app), not inside any `libs/*` package.

#### Scenario: Banner shows task name and run timestamp once both are available

- **WHEN** `taskState === 'success'` and `history.items` contains a run with `id === runId`
- **THEN** the banner shows the task's `displayName` and that run's formatted timestamp

#### Scenario: Banner falls back to the conversation's own timestamp before the run has loaded

- **WHEN** `taskState === 'success'` but `history.items` does not yet contain a run with `id === runId`
- **THEN** the banner shows the task's `displayName` and a timestamp formatted from `conversationUpdatedAt`
- **AND WHEN** subsequent history pages load the matching run
- **THEN** the banner swaps to that run's formatted timestamp (including any duration suffix) without hiding the timestamp at any point in the transition

#### Scenario: Banner loading state does not block messages

- **WHEN** `taskState === 'loading'`
- **THEN** the banner shows a skeleton/compact loading placeholder
- **AND** conversation messages render normally beneath it

#### Scenario: Banner error does not hide messages

- **WHEN** `taskState === 'error'`
- **THEN** conversation messages remain visible
- **AND** the banner shows a scoped retry action or omits unavailable metadata, without an app-wide error state

#### Scenario: Task details action navigates via the SPA router

- **WHEN** the user activates "Task details"
- **THEN** the application navigates (via the SPA router, no full reload) to `getScheduledTaskDetailRoute(scheduleId)`

#### Scenario: Banner is never persisted

- **WHEN** a scheduled-task conversation is reloaded or its messages are refetched
- **THEN** the banner is not present in `messages` and is not sent to or received from the conversation-messages API

#### Scenario: Non-task conversations render no banner

- **WHEN** `useActiveScheduledTask()`'s derived state is `'not-a-task-conversation'`
- **THEN** `ConversationPage` passes no `topContent` and `ConversationView` renders unchanged

---

### Requirement: Task-summary banner is accessible, RTL-aware, and responsive

The banner SHALL use semantic navigation markup (e.g. a real link/button element) with a clear accessible name that includes both the action ("Task details") and enough context to be unambiguous when read out of context. Its directional chevron SHALL mirror in RTL per `.claude/rules/rtl.md` (`rtl:scale-x-[-1]` or an equivalent logical construct). The banner SHALL wrap safely at narrow widths without introducing horizontal scrolling, using logical Tailwind spacing utilities only (no `ml-*`/`mr-*`/`pl-*`/`pr-*`/`text-left`/`text-right`).

#### Scenario: Chevron mirrors in RTL

- **WHEN** the document direction is `rtl`
- **THEN** the banner's directional chevron is horizontally mirrored relative to its `ltr` rendering

#### Scenario: Banner wraps at narrow widths

- **WHEN** the banner is rendered at a 360px viewport width with a long task `displayName`
- **THEN** the banner's text wraps and no horizontal scrollbar appears on the conversation container

---

### Requirement: All new user-visible strings are sourced from i18n

New strings introduced by this capability (task-summary loading/unavailable/retry text, "Task details" action label, and any current-run accessible label reused by the summary) SHALL be added under `apps/chat/src/i18n/locales/en.json`, reusing `scheduledTasks.detail.*` keys where their meaning already matches (e.g. status/run-timestamp formatting keys) instead of duplicating equivalent English strings under a new namespace. New keys specific to this capability SHALL be namespaced `scheduledTasks.conversationBanner.*`.

#### Scenario: No hardcoded English literals

- **WHEN** `ScheduledTaskConversationBanner` renders any user-visible text
- **THEN** the text is produced via `t(...)` against a key in `en.json`, not a hardcoded string literal
