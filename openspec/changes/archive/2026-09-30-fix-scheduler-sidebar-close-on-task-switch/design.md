## Context

The sources sidebar's open state lives in `SourcesSidebarContext` (`apps/chat/src/context/SourcesSidebarContext.tsx:39-48`), mounted above routing, so it survives navigation by itself. Something must actively close it. Today that is an effect in `apps/chat/src/pages/Conversation/Conversation.tsx:283-285`, keyed on the raw route param `conversationId`, introduced by 311d73d41 (#7213/#7936) and correct for normal conversations.

In the Scheduler flow every "task" is a distinct run conversation with a distinct route id (`apps/chat/src/utils/collapse-scheduled-task-conversations.ts:20-27`), so every task or run switch fires the close — issue #8840. `ActiveScheduledTaskContext` (`apps/chat/src/context/ActiveScheduledTaskContext.tsx`) already resolves the active conversation's `scheduleId` through a canonical conversation-list lookup (already speced in `scheduled-task-conversation-context`: "Switching between runs of the same schedule avoids refetching task details"), which is exactly the sidebar's real subject.

Product decision (2026-09-30): the stricter rule — task → different task **closes** (same as navigating to a normal conversation); only run → run within the same task stays open. Unresolved conversation entries close (reproduces today's behavior, no hold-open limbo).

## Goals / Non-Goals

**Goals:**

- Sidebar stays open only when the active conversation moves between runs of the same `scheduleId`.
- Sidebar closes when the resolved `scheduleId` changes, when the new conversation resolves to no `scheduleId` (normal conversations, flag-disabled, not-yet-loaded list entries), and when leaving `/conversations/*` (existing unmount cleanup).
- Reset ownership moves out of the route-param-driven effect in `Conversation.tsx` to the layer that already owns the sidebar's subject.

**Non-Goals:**

- No new open behavior; the sidebar still opens only by explicit user action.
- No changes to section-level expand/collapse reset (separately speced in `conversation-sources-sidebar`).
- No `libs/*`, backend, generated-client, or i18n changes (no new user-visible strings).

## Decisions

### D1. Key the reset on the resolved `scheduleId`, not the conversation id

The close rule is `close when the current conversation's subject changes or is absent`, where the subject is the `scheduleId` resolved by `useActiveScheduledTask()` (a `task-conversation` status resolves to a scheduleId; everything else resolves to none). This reuses an already-speced stability signal, needs no conversation-id comparison, and avoids the URL-encoding matcher (`conversationIdsMatch`) entirely — `scheduleId`s are plain strings.

Rejected: guarding the existing `conversationId` effect in `Conversation.tsx` (embeds task-world knowledge in the page, keeps id-encoding gymnastics); intent-flag approaches (two entry points to sync, ordering races).

### D2. The rule lives in a dedicated hook consumed by the sidebar layer

New hook `apps/chat/src/hooks/sources-sidebar/useCloseSourcesSidebarOnSubjectChange.ts` (JSDoc explaining WHY, per `useFavicon.ts` reference pattern). It consumes `useActiveScheduledTask()` — which exposes both the traversal-guarded route conversation id (derived inside the provider from the pathname, so a malformed path resolves to `null`) and the resolved `scheduleId` on its memoized context value — and `useSourcesSidebar()` (`handleClose`). Consuming the ids through the context value (rather than a `useLocation`/`useParams` subscription of its own) keeps the memo-wrapped, prop-less panel container re-rendering only when the ids change, not on every location change (search/hash-only navigations). It is mounted once inside `ConversationSourcesPanel`, which is mounted on every `/conversations/*` route regardless of the sidebar's open state (the panel is hidden-when-closed, not unmounted) — so the rule runs wherever the sidebar can be open. The effect in `Conversation.tsx:277-285` is removed; the unmount cleanup (`Conversation.tsx:293-300`, closing when leaving the conversations routes) is preserved unchanged.

Rejected: wiring the close into `ActiveScheduledTaskContext` itself (couples two independent contexts — the task context would need to know a sidebar exists); keeping the rule in `Conversation.tsx` (D1's rejection).

### D3. Close only on a conversation-id *transition* — not on a transient resolve flicker

The effect fires on `[conversationId, scheduleId]` and closes when the conversation id changed **and** the new scheduleId is absent or different from the previous conversation's. When the conversation id is unchanged, nothing happens — even if `scheduleId` transiently resolves to `undefined` (conversation-list refetch swapping the items array). This is required because `ActiveScheduledTaskContext` resolves through the in-memory list, and a refetch can momentarily produce an empty/stale list; without this guard the sidebar would spuriously close during a list reload.

Implementation shape (refs holding the previous conversation id and scheduleId):

- `conversationId` unchanged → no action (list reload, same conversation).
- `conversationId` changed, new `scheduleId` defined and equal to the previous → keep open (same-task run switch; content already follows the new run).
- `conversationId` changed, otherwise (new `scheduleId` defined but different, or resolves to none) → close.
- `conversationId` changed to `null` (bare `/conversations`, a malformed path segment — the panel stays mounted on those routes) → close, matching the pre-change effect's close on the raw param change; leaving `/conversations/*` entirely unmounts the panel before the effect can run, so that close stays owned by the Conversation page's unmount cleanup.

### D4. Test placement and the #7213/#7936 regression guard

The hook's unit tests live beside it (`apps/chat/src/hooks/sources-sidebar/tests/`). The existing `Conversation` tests that assert the sidebar closes on conversation switch must be re-pointed at the new rule — in particular an explicit **normal → normal still closes** test (the `undefined → undefined` case D3 makes non-trivial), plus **task → different task closes** (issue #8840's repro with the product-chosen outcome).

## Risks / Trade-offs

- [Transient resolve flicker spuriously closes the sidebar during a conversation-list reload] → D3's transition guard: the close only happens on a conversation-id change, never on a same-conversation resolve change.
- [Direct navigation to a task conversation whose list entry has not loaded yet closes the sidebar even if it is the same task] → Accepted deliberately (product decision): reproduces today's behavior exactly, no hold-open limbo. The same window opens mid-session: `ConversationsContext` clears the list during an identity revalidation, so a same-task History click landing in that reload also closes. Still accepted — the alternative (holding the sidebar open while a resolution is pending) is worse: a different-task switch during the same window would resolve late and never close, because the conversation-id-unchanged guard would swallow the late resolution.
- [A task conversation whose list entry never appears (deleted mid-session) never resolves as a task] → Closes, same as today; no regression.
- [Behavior change is observable: users who relied on the sidebar closing on same-task run switches] → No known consumer wants that; the run-switch path is the sidebar's own History list, whose click closing the sidebar is the reported defect.

## Migration Plan

Single frontend change on this branch (`fix/scheduled-task-sidebar-closed-when-switching-between-tasks`); no API, storage, or persisted-state impact. Rollback is a plain revert restoring the pre-change behavior exactly. No feature flag: the change only relaxes an over-broad close rule inside the already-flagged scheduled-tasks surface.

## Open Questions

None — the stricter rule, the unresolved-entry behavior, and the boundary behavior were all decided during exploration (2026-09-30).
