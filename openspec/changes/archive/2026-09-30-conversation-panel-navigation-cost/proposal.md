## Why

Issue #9176 reports that switching conversations freezes the page when the
history is large. PR #9184 (`conversation-switch-render-churn`) removed the
duplicate list rewrite and restored the view and lib memo boundaries. Even
with those fixes, one legitimate navigation still rebuilds the whole
sidebar: every panel item, every virtual row and every mounted row. The work
is proportional to the list size, not to what actually changed. Only two rows
change on a switch: the previously active one and the new one.

## Problem

Every step below runs on each change of `activeConversationId`. An unchanged
list does not stop any of them.

1. **The collapsed list is rebuilt.**
   `ConversationPanelView` memoizes `collapseScheduledTaskConversations(items, { activeConversationId, … })`
   on `[items, activeConversationId]` (`apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx:597-604`).
   The function always returns a new array
   (`apps/chat/src/utils/collapse-scheduled-task-conversations.ts:97-103`).
   The active id changes the result only when it points to an older,
   unpinned run of a scheduled task, but it is a dependency either way.
2. **Every panel item is rebuilt.**
   `useConversationPanelItems` re-maps all N items into new objects when
   `items` changes
   (`libs/chat-hooks/src/conversation/useConversationPanelItems/useConversationPanelItems.ts:77-125`).
   Each item resolves its deployment through `findDeploymentByIdOrReference`,
   which runs two linear scans (`libs/chat-hooks/src/catalog/deployment-id.ts:60-69`),
   so the rebuild costs **O(N × D)** (N items, D deployments).
3. **The lib's derived structures change.** New items produce new
   `filteredItems`, groups and `virtualRows`, which in turn produce a new
   react-window `rowProps`
   (`libs/conversation-panel/src/components/ConversationPanel/ConversationPanel.tsx:233-389`).
   react-window re-renders every mounted row when any `rowProps` key changes.
   `activeConversationId` and `getActions` are keys of `rowProps`, and both
   change on every navigation.
4. **`getActions` changes identity on every navigation.** The view's
   `getActions` depends on `panelActiveConversationId`
   (`ConversationPanelView.tsx:992-1014`), and it uses that value only
   inside one click handler.
5. **Every mounted row does full work.**
   - `ConversationRow` is not memoized
     (`libs/conversation-panel/src/components/ConversationRow/ConversationRow.tsx:78`).
   - It calls `getActions(item)` on every render (`:113`), which builds 6–9
     menu items with fresh icon JSX and closures.
   - It passes inline objects to `DeploymentIcon` (`:133-134`).
6. **Too many rows are mounted.** Overscan is two viewports on each side
   (`ConversationPanel.tsx:141-143`, `ITEM_ROW_HEIGHT = 36`). A 900px panel
   therefore mounts about 125 rows, and each one does the work in step 5.

## Solution

- **`useConversationPanelItems` (`libs/chat-hooks`)**
  - Resolve deployments through id and reference `Map`s built once per
    `deployments` array. The id match keeps precedence over the reference
    match.
  - Keep a per-DTO cache, so a `ConversationItem` keeps its identity while its
    source DTO and the resolvers are unchanged.
- **Scheduled-task collapsing (`apps/chat`)**
  - Split the work into an `items`-keyed grouping pass and a cheap step that
    applies the active run.
  - When the active id does not change any group's representative, the view
    receives the same collapsed array reference as before the navigation.
- **Panel lib (`libs/conversation-panel`)**
  - Wrap `ConversationRow` in `memo`, and give it stable per-row props: an
    `isActive` boolean, stable callbacks, and hoisted or memoized
    `DeploymentIcon` props.
  - Memoize `getActions(item)` inside the row on `[getActions, item]`.
  - Reduce overscan to half a viewport on each side, with a minimum of 5 rows.
- **View (`apps/chat`):** `getActions` reads the active id through a ref, so
  its identity no longer depends on navigation.

Models to follow: the `useConversationLookupMaps` `Map` pattern
(`libs/chat-hooks/src/conversation/useConversationLookupMaps/useConversationLookupMaps.ts:27-43`)
and the existing `loadConversationRef` pattern for reading a latest value
without widening callback dependencies
(`apps/chat/src/pages/Conversation/Conversation.tsx:578-585`).

## Non-goals

- Stream-chunk render cost (`SourcesSidebarContext.messages`,
  `ConversationMessageItem` props, chunk batching). It is covered by the
  separate change `conversation-stream-chunk-render-cost`.
- The stale-response race in `loadConversation`.
- A lazy `getActions` API, such as `hasActions` plus build-on-open. It would
  change the lib's public contract, and memoizing per row captures most of
  the benefit (design D5).
- Diffing the result of `refreshConversations`.
- Changing which run represents a scheduled task, row visuals, drag-and-drop
  or accessibility behavior.

## Alternatives considered

- **Move `activeConversationId` and `getActions` out of `rowProps` into a React
  context.** Rejected. Context consumers still re-render every row, so the
  saving comes from `memo(ConversationRow)` anyway, and the context adds a
  layer that must be kept in sync.
- **Custom `areEqual` for react-window's row memo.** Rejected. react-window
  2.2.7 applies its own shallow `memo` to `rowComponent`, and we do not
  control the comparator. Stable per-row props are the supported path.
- **Keep the collapse single-pass and deep-compare its output.** Rejected. It
  still costs O(N) per navigation and hides the dependency that causes the
  rebuild.
- **Conservative baseline: only reduce overscan.** Rejected as insufficient.
  It shrinks the constant factor but leaves the O(N × D) rebuild and the
  full-list invalidation in place.

## Acceptance criteria

- **Same collapsed list.** Navigating between two conversations, where the
  active id does not change any task's representative, keeps the collapsed
  list and the `useConversationPanelItems` output as the same array
  references.
- **Stable panel items.**
  - An unchanged DTO maps to the same `ConversationItem` object across calls.
  - A changed DTO maps to a new object.
  - Changing `deployments` or a resolver rebuilds every item.
- **Deployment resolution is unchanged.** Id matches still win over reference
  matches, and there are no regressions in the existing
  `findDeploymentByIdOrReference` and panel-item tests.
- **Only two rows re-render.** In a panel test, moving `activeConversationId`
  between two items re-renders only those two `ConversationRow`s.
- **Scheduled-task behavior is unchanged.** All existing
  `collapse-scheduled-task-conversations` scenarios pass, including the one
  where the active older run stands in for its task.
- **Row actions still work.**
  - The menu content still updates while open, when a revoke or unpublish
    lookup lands.
  - A row with no actions still renders no trigger.
- **Verification.** `npm run verify:full` passes and `npm run validate:docs`
  passes.

## What Changes

- `libs/chat-hooks`:
  - `useConversationPanelItems` gets `Map`-based deployment resolution and a
    per-DTO item cache.
  - Its README describes the per-item identity guarantee.
- `libs/conversation-panel`:
  - `memo(ConversationRow)` with stable per-row props, and the row's menu
    items memoized.
  - Smaller overscan.
  - No public prop changes.
- `apps/chat`:
  - The scheduled-task collapse is split into a grouping step and an
    active-run step.
  - The view uses both steps, and `getActions` reads the active id through a
    ref.
- No breaking changes.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `chat-hooks-conversation-panel-controller`: `useConversationPanelItems` keeps
  item identity for unchanged DTOs and resolves deployments in constant time
  per item.
- `scheduled-task-conversation-grouping`: the memoisation clause changes, so
  that an active id which does not change any representative leaves the
  collapsed list reference unchanged.
- `conversation-history-panel`: changing the active conversation re-renders
  only the previous and the new active rows.

## Impact

- **Libs touched.**
  - `libs/chat-hooks`: a pure data mapping; the resolvers are still injected
    by the host.
  - `libs/conversation-panel`: rendering internals only.
  - No host knowledge enters either lib. Deployment data, icon URLs, hrefs and
    labels still arrive through the existing resolver parameters and props.
- **App touched.** `apps/chat` (the collapse util and `ConversationPanelView`).
- **Depends on PR #9184.** Its memoized `labels`/`headerActions` and stable
  `onRequestedFilterChange` must land first. Without them, the lib panel
  re-renders for unrelated reasons, and this change's render-count
  guarantees cannot be observed.
- **No new user-visible strings,** i18n keys, endpoints, feature flags, or
  RTL/a11y surface.
- **Rollback.** Revert the commit. There is no data or contract migration.
