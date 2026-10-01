## Context

A navigation changes one thing: which conversation is active. The sidebar
nevertheless recomputes and re-renders as if the whole list had changed. The
chain is below; file references are in the proposal.

1. `activeConversationId` changes, and `collapseScheduledTaskConversations`
   returns a new array.
2. `useConversationPanelItems` rebuilds all N items. Each deployment lookup
   is a linear scan, so this step is O(N × D).
3. The lib panel rebuilds `filteredItems`, the groups and `virtualRows`, and
   then `rowProps`.
4. react-window's shallow row `memo` sees new `rowProps` keys: `rows`,
   `activeConversationId`, `getActions` and an inline `onDragStart`. Every
   mounted `RowRenderer` re-renders.
5. `ConversationRow` has no `memo` and calls `getActions(item)` on every render.
   With two viewports of overscan on each side, about 125 rows do this.

`RowRenderer` passes each `ConversationRow` the following props:

- `item` and `isActive`;
- `searchQuery`;
- `onSelectConversation`, `getActions` and `onActionMenuOpen`;
- two label strings and two class-name strings;
- `rowGroupKey` and `rows`;
- `draggingId`, `dragOverId` and `allowedDropGroups`;
- five drag callbacks.

Every one of these must be stable across a navigation for a row `memo` to hold.

State ownership does not change:

- `ConversationsContext` owns the list.
- `ConversationPanelView` owns the collapse and the resolvers.
- The lib owns its filter, group, expansion, drag and scroll state.

No new context or provider is added.

This change depends on PR #9184. That PR stabilizes `labels`, `headerActions`
and `onRequestedFilterChange`. Without it, `memo(ConversationPanel)` never
holds, and the render-count assertions below cannot be met.

## Goals / Non-Goals

**Goals:**

- A navigation that does not change any scheduled task's representative
  leaves the collapsed list, the panel items and `virtualRows` referentially
  unchanged.
- A navigation re-renders exactly two `ConversationRow` bodies.
- Panel-item mapping becomes O(N), and unchanged DTOs keep their item
  identity.
- Fewer rows are mounted: half a viewport of overscan instead of two
  viewports.

**Non-Goals:**

- Changing any public prop of `ConversationPanel`, or the return shape of
  `useConversationPanelItems`.
- A lazy action-menu API (see D5).
- Stream-chunk costs, which belong to `conversation-stream-chunk-render-cost`.
- Diffing the result of `refreshConversations`. A full refresh still
  rebuilds everything, because every DTO is a new object.

## Decisions

### D1. Deployment lookup maps inside `useConversationPanelItems`

The hook builds two maps with `useMemo` on `[deployments]`:

- `byId: Map<string, DeploymentItemDto>`;
- `byReference: Map<string, DeploymentItemDto>`.

Both are filled in a single pass. A key is set only when it is absent, which
reproduces `Array#find`'s first-match semantics. The lookup is
`byId.get(modelId) ?? byReference.get(modelId)`, the same precedence as
`findDeploymentByIdOrReference` (`libs/chat-hooks/src/catalog/deployment-id.ts:60-69`).
That helper stays as it is for its other callers.

This follows the pattern in `useConversationLookupMaps`
(`libs/chat-hooks/src/conversation/useConversationLookupMaps/useConversationLookupMaps.ts:27-43`).

Rejected alternative: memoize `findDeploymentByIdOrReference` itself. It is a
pure utility used elsewhere, and hidden module-level caching would leak
between hosts and tests.

### D2. Per-DTO item cache without render-phase writes

The hook keeps `cacheRef = useRef<{ inputs: unknown[]; byDto: Map<ConversationListItemDto, ConversationItem> }>()`.

- **Inside the existing `useMemo`.** The hook compares the non-`items` inputs
  (`deployments`, `isDeploymentsLoading` and the five resolvers) element-wise
  with `cacheRef.current.inputs`:
  - When they are equal, it reuses `byDto.get(dto)` for every DTO present.
  - When they differ, it rebuilds every item.

  It returns the mapped array and, alongside it, a fresh `Map` that holds only
  the current DTOs.
- **After commit.** A `useEffect` stores that fresh map and inputs into
  `cacheRef`.

Writing the ref in an effect keeps render pure:

- a discarded concurrent render cannot poison the cache;
- StrictMode's double memo invocation reads the same committed cache.

The fresh map drops entries for DTOs that left the list, so the cache is
bounded by N.

Rejected alternatives:

- A `WeakMap` keyed on DTO, written during render. It is impure, and a
  discarded render could store items built with resolvers that never
  committed.
- Caching by `item.id`. A refreshed DTO with the same id but changed fields
  would return a stale item.

### D3. Two-phase scheduled-task collapse

This keeps the representative rules of
`apps/chat/src/utils/collapse-scheduled-task-conversations.ts` and splits the
work into two phases.

- **`groupScheduledTaskConversations(items, { conversationIdsMatch })`**
  returns:
  - `collapsed`: the result with no active id applied, i.e. the newest
    unpinned run per group;
  - `runs`: the unpinned grouped runs as `{ item, groupKey, isRepresentative }`
    entries;
  - `items`: the source list, which the rare swap path needs.

  Cost: O(N).
- **`applyActiveScheduledTaskRun(grouping, activeConversationId)`** does the
  following:
  1. It scans only `grouping.runs` with `conversationIdsMatch`. That is
     O(S), where S is the number of unpinned task runs, not O(N).
  2. If there is no match, or the match is already its group's
     representative, it returns `grouping.collapsed` unchanged.
  3. Otherwise it recomputes with `items.filter` over a kept set, where the
     active run replaces its group's representative. This preserves input
     order and matches the current single-pass output exactly. It costs O(N),
     but only in the rare case where the open conversation is an older run.
- **`collapseScheduledTaskConversations`** stays exported and becomes the two
  phases composed. That keeps every existing spec scenario, test and caller
  valid.
- **`ConversationPanelView`** changes its memos as follows:

  ```ts
  const grouping = useMemo(
    () => groupScheduledTaskConversations(items, { conversationIdsMatch }),
    [items],
  );
  const panelItems = useMemo(
    () => applyActiveScheduledTaskRun(grouping, activeConversationId),
    [grouping, activeConversationId],
  );
  ```

Rejected alternative: drop `activeConversationId` from collapsing and
highlight the task row instead. It would break the "Opening an older run from
History keeps task context" scenario, where the panel must show run B.

### D4. `getActions` reads the active id through a ref

`panelActiveConversationId` is used only inside the duplicate action's
`onClick`, where it decides whether to navigate to the new copy
(`ConversationPanelView.tsx:763-769`).

- Store it in `activeIdRef`, assigned in a `useEffect` on
  `[panelActiveConversationId]`.
- Read `activeIdRef.current` inside the click handler.
- Remove `panelActiveConversationId` from `getActions`' dependencies.

`getActions` then changes only when a real input changes. Examples: a lookup
result (`getPublishHistory` or `getRecipientsCount` identity), feature flags,
`t`, or the lookup maps after a list change. This follows the
`loadConversationRef` pattern (`apps/chat/src/pages/Conversation/Conversation.tsx:578-585`).

### D5. `memo(ConversationRow)` with a memoized menu, not a lazy menu API

In `libs/conversation-panel`:

- **Menu items.** `ConversationRow` becomes `memo(...)`. Its menu items become
  `useMemo(() => getActions?.(item) ?? [], [getActions, item])`.
  - A row that does not re-render never calls `getActions`.
  - An open menu still refreshes when the host's `getActions` changes, because
    the dependency changed. The revoke/unpublish lookups rely on this.
- **`DeploymentIcon` props.** `labels` becomes
  `useMemo(() => ({ tooltip: item.iconTooltip }), [item.iconTooltip])`, and
  `styles` becomes a `useMemo` on `itemIconBadgeClassName`.
- **`onDragStart` in `rowProps`.** It is currently an inline
  `(id) => handleDragStart(id, virtualRows)`. It becomes a `useCallback` that
  reads `virtualRows` from a ref assigned in an effect. It then keeps its
  identity when `virtualRows` changes. `handleDragStart` itself depends only
  on `visibleConversations`.
- **Other `RowRenderer` inputs.** `searchQuery`, the label and class-name
  strings, `rows`, the drag state values and the other drag callbacks are
  already stable across a navigation. That holds once `virtualRows` is stable,
  which follows from D2 and D3 plus PR #9184.
- **`rowProps` still changes on navigation**, because it carries
  `activeConversationId`. react-window re-renders every `RowRenderer`, but
  these are thin wrappers. Their `ConversationRow` children receive identical
  props except for the two rows whose `isActive` flipped. Keeping
  `activeConversationId` in `rowProps` avoids introducing a new context.

Rejected alternative: a lazy `getActions`, for example `hasActions(item)` plus
build-on-open. It is a public API change, and the kit `Dropdown` takes eager
`items`. Building on open would move the cost to click time without removing
the need to know `hasActions` up front.

### D6. Overscan: half a viewport per side, minimum 5 rows

`handleListResize` sets
`Math.max(5, Math.ceil(Math.ceil(height / ITEM_ROW_HEIGHT) / 2))`. The value
must be large enough that a normal wheel scroll does not show blank rows, and
small enough to cut the mounted rows by about 4×. Two viewports per side is
more than smooth scrolling needs, because react-window renders
synchronously on scroll.

This is recorded as an assumption: it has not been measured on
low-end hardware.

## Risks / Trade-offs

- **[Stale item from the cache]** The cache is keyed on DTO identity and
  invalidated whenever any other input changes. `ConversationsContext`
  updaters create a new object for every changed DTO (`{ ...item, … }`). A
  mutated-in-place DTO would go stale, but no code path mutates DTOs in place,
  and the provider updaters are all spread-based.
- **[The two-phase collapse diverges from the single pass]** Mitigation: a
  test runs every existing collapse scenario through both paths and asserts
  equal output. `collapseScheduledTaskConversations` is implemented as the two
  phases composed, so there is no second implementation that could drift.
- **[A missed dependency hides a menu update]** The row memo depends on
  `getActions` and `item`. The host's `getActions` still lists
  `getPublishHistory` and `getRecipientsCount`, so a landed lookup changes
  its identity. A test covers an open menu refreshing on a new `getActions`.
- **[Blank rows on very fast scroll]** This is possible with less overscan.
  The minimum of 5 rows bounds it, and the cost is visual only, with no
  change to data or accessibility semantics.
- **[react-window internals]** The row-memo behaviour described here is that
  of react-window 2.2.7's internal `memo`. Nothing in this design depends on
  it beyond "equal props skip a render", which is standard React
  behaviour.

## Migration Plan

This is app and lib internal, with no public API change. Merge after
PR #9184. Rollback is a revert.

## Open Questions

- Overscan constant: half a viewport per side, minimum 5 rows, is an
  unmeasured default. A profiling pass on a low-end device could tune it, but
  that tuning is not a blocker.
