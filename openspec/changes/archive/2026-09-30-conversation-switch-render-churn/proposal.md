## Why

Switching conversations with a large history list, or regenerating in a long
conversation, can freeze the page (issue #9176). Two cheap sources of that
churn are addressed here:

- every conversation load rewrites the whole conversation list even when
  nothing in it changed, so the entire sidebar pipeline runs twice per
  navigation;
- `memo(ConversationPanelView)` never holds, so the sidebar re-renders on every
  `App` render, including every SSE stream chunk.

## Problem

1. `updateConversationTitle` (`apps/chat/src/context/ConversationsContext.tsx:155`)
   always returns `prev.map(...)` with a fresh object for the matched item.
   `ConversationPage.loadConversation` calls it unconditionally on every load
   (`apps/chat/src/pages/Conversation/Conversation.tsx:458-460`). Each switch
   therefore produces a new `conversations` array whose content is identical,
   and that re-runs `collapseScheduledTaskConversations`,
   `useConversationPanelItems` (O(N × D)), the panel's filter/group/virtual-row
   passes, every mounted row, and every other `useConversations()` consumer.
   `removeConversationFromList` (`:378`) and `pinConversation` (`:313`) have the
   same no-op-still-allocates shape.
2. `apps/chat/src/app/app.tsx:259` passes
   `onRequestedFilterChange={() => setPanelRequestedFilter(undefined)}`. The
   inline arrow is a new reference on each `App` render, which defeats
   `memo(ConversationPanelView)` (`ConversationPanelView.tsx:1538`). `App`
   re-renders on every stream chunk: it consumes `useSourcesSidebar()`
   (`app.tsx:156`), and that context value carries `messages`. Inside the view,
   the inline `labels={{...}}` object and the inline `headerActions` JSX
   (`ConversationPanelView.tsx:1284-1313`) likewise defeat the lib's
   `memo(ConversationPanel)` on every view render.

## Solution

- Make the in-place `ConversationsContext` list updaters idempotent: when an
  update changes nothing, return the previous array reference so React bails
  out of the state update. This covers `updateConversationTitle`,
  `removeConversationFromList` and the optimistic write in `pinConversation`.
  `loadConversation` keeps calling `updateConversationTitle`, which is now a
  no-op when the title already matches (see design D1).
- Stabilize every prop `App` passes to `ConversationPanelView`: replace the
  inline arrow with a `useCallback`.
- Stabilize the props `ConversationPanelView` passes to `ConversationPanel`:
  memoize the `labels` object and the `headerActions` element.

Model to follow: the existing memoized `filterLabels`/`groupLabels`
(`ConversationPanelView.tsx:617-636`) and `PANEL_STYLES` (`:143`).

## Non-goals

- Not in scope: the O(N × D) cost of `useConversationPanelItems`, the
  `activeConversationId` dependency of `collapseScheduledTaskConversations`,
  react-window `rowProps` churn, the overscan size, and eager `getActions`
  per row. These are the per-navigation costs that remain, deferred to a
  follow-up change.
- Moving `messages` out of `SourcesSidebarContext`, and `ConversationMessageItem`
  memo breakage, stream-chunk batching and message-list virtualization.
- The stale-response race in `loadConversation`, which is a correctness bug
  and gets its own change.
- Diffing `refreshConversations` results.

## Alternatives considered

- **Guard only at the call site** (`loadConversation` compares titles before
  calling). Rejected: it leaves the other callers (`watchForDisplayNameUpdate`,
  future ones) paying the same cost, and it needs the list item, which means
  another O(N) lookup in the page.
- **Deep-compare the list in the provider** before `setConversations`.
  Rejected: O(N) on every write, and it hides the real problem, which is
  updaters that allocate for no-ops.
- **Wrap `ConversationPanelView` in a custom `memo` comparator** that ignores
  callbacks. Rejected: fragile, and it silently drops legitimate callback
  updates.

## Acceptance criteria

- Calling `updateConversationTitle` with the current title, calling
  `removeConversationFromList` with an unknown id, or calling `pinConversation`
  with the current pin state leaves the `conversations` reference unchanged.
  Tests prove this.
- Opening a conversation whose loaded name equals its list title does not
  change the `conversations` reference. A test proves this.
- Re-rendering `App` with unchanged panel inputs does not re-render
  `ConversationPanelView`. Re-rendering `ConversationPanelView` with unchanged
  inputs does not re-render `ConversationPanel`. Tests prove both.
- Existing ConversationsContext, ConversationPanelView, app and Conversation
  page tests stay green, and `npm run verify:full` passes.

## What Changes

- `apps/chat/src/context/ConversationsContext.tsx`: no-op updaters return
  `prev`.
- `apps/chat/src/app/app.tsx`: `useCallback` for `onRequestedFilterChange`.
- `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`:
  memoized `labels` and `headerActions`.
- There are no breaking changes and no public API changes.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `conversations-context`: adds a requirement that in-place list updaters
  preserve the list reference when an update changes nothing.
- `conversation-history-panel`: adds a requirement that the host keeps the
  panel's props referentially stable, so the view and lib memo boundaries hold.

## Impact

- App-only change under `apps/chat/src`. No `libs/*` code changes, so the
  library isolation rule is unaffected. The lib's existing `memo` contract is
  what this change relies on.
- Global provider touched: `ConversationsProvider`. The behavior change is
  only on no-op updates, where consumers stop receiving a new, identical array.
- No new user-visible strings, i18n keys, endpoints, feature flags, RTL or a11y
  surface.
- Rollback: revert the commit. There is no data or contract migration.
