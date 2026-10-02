## Why

Issue #8840 (P3, milestone release-1.2): in the Scheduler flow, the right sources sidebar closes on its own when the user switches between scheduled-task conversations, forcing them to reopen it on every switch. The worst instance is self-defeating — clicking a run in the sidebar's own History list closes the sidebar the click happened inside.

Root cause: `apps/chat/src/pages/Conversation/Conversation.tsx:283-285` unconditionally calls `handleCloseSourcesSidebar()` on every `conversationId` change (introduced by 311d73d41 for #7213/#7936). In the Scheduler flow every "task" is a distinct run conversation with a distinct route id (`apps/chat/src/utils/collapse-scheduled-task-conversations.ts:20-27`), so every task switch or run switch fires the close — even when the sidebar's subject (the task identified by its `scheduleId`) has not changed.

## What Changes

- The sources sidebar's reset-on-navigation rule moves off the raw route param (`conversationId`) and onto the sidebar's actual subject: the resolved `scheduleId` of the active conversation.
- New rule, replacing the unconditional `conversationId`-keyed close in `Conversation.tsx:283-285`:
  - switching between runs of the **same** task (`scheduleId` unchanged) → sidebar stays open, content already swaps per existing `ActiveScheduledTaskContext` behavior;
  - switching to a **different** task (`scheduleId` changes) → sidebar closes;
  - switching to any conversation that resolves to **no** `scheduleId` (normal conversations, feature-flag-disabled, unresolved-in-list), or to a route that resolves to no conversation id at all (bare `/conversations`, a malformed path segment) → sidebar closes — byte-for-byte today's behavior;
  - leaving `/conversations/*` (unmount) → sidebar closes (existing cleanup at `Conversation.tsx:293-300` is preserved).
- Ownership moves from the route-param-driven effect in `Conversation.tsx` to the layer that already owns the sidebar's subject (`SourcesSidebarContext` / `ActiveScheduledTaskContext`), following the established context pattern (`apps/chat/src/context/ThemeContext.tsx` as the reference factory pattern).

No UI strings, no API changes, no lib changes.

## Non-goals

- Not changing the sidebar's open behavior (it still opens only by explicit user action).
- Not changing section-level expand/collapse reset-on-conversation-change (already speced separately in `conversation-sources-sidebar`).
- Not introducing any new task→task keep-open behavior (product explicitly chose the stricter rule: task→task **closes**, only same-task run→run stays open).
- No changes to `libs/*`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `conversation-sources-sidebar`: adds a requirement covering the sidebar's open/close lifecycle across navigation — which conversation switches close the sidebar (any switch that changes the resolved `scheduleId`, or resolves to none) and which keep it open (same-`scheduleId` run switches). Today this behavior exists only as an unconditional close on every conversation-id change, undocumented in the spec.

## Impact

- **Code**: `apps/chat/src/pages/Conversation/Conversation.tsx` (reset effect removed/replaced), `apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx` (mounts the reset hook), `apps/chat/src/context/ActiveScheduledTaskContext.tsx` (expose the route conversation id alongside the resolved `scheduleId` on the context value). No backend, no generated client, no `libs/*` changes — no library-isolation implications, no i18n impact (no user-visible strings).
- **Regression surface**: the #7213/#7936 contract — sidebar closes on normal conversation switches — must be preserved and explicitly tested (see acceptance criteria). One subtlety: `undefined → undefined` (normal → normal conversation) must still close, so the rule is "close when the current conversation resolves to no `scheduleId`", not "close when `scheduleId` changed".
- **Rollback / backward-compat**: single-branch frontend-only revert; no persisted state, no API contract, no migration. Reverting restores the pre-change behavior exactly.

## Alternatives considered

1. **Guard the existing effect in place** (`Conversation.tsx` skips the close when old and new conversations share a `scheduleId`) — smallest diff, but embeds task-world knowledge in the page component and keeps the reset keyed on the raw route param with id-encoding matcher gymnastics. Rejected: the ownership belongs with the sidebar's subject.
2. **Intent flag** (task-run clicks set a keep-open marker the effect consumes) — rejected: two entry points to keep in sync (panel row click + History run click) and flag-vs-effect ordering races.
3. **Keep sidebar open on any task→task switch** — rejected by product decision (2026-09-30): task→task is a context change and must close, matching navigation to a normal conversation. Only same-task run→run stays open.

Option chosen: key the close rule on the resolved `scheduleId` (2's goal, 1's mechanism, at the context layer) — it reuses an already-speced stability signal (`scheduled-task-conversation-context`: "Switching between runs of the same schedule avoids refetching task details") and needs no conversation-id comparison at all.

## Acceptance criteria

- Switching between two runs of the same task (History row click, conversation-panel navigation, direct URL) keeps the sidebar open, showing the new run's content.
- Switching from one task's run to a different task's row closes the sidebar (issue #8840's repro path, with the product-chosen stricter outcome).
- Switching from a task conversation to a normal conversation, and normal → normal, still closes the sidebar (#7213/#7936 preserved — explicit test required).
- Leaving `/conversations/*` still closes the sidebar.
- Direct navigation to a run whose conversation list entry has not loaded resolves to no `scheduleId` and closes the sidebar (today's behavior, no hold-open limbo).
