## Context

Issue #9176 reports that the page freezes when switching conversations or
regenerating while the user has a large history. The investigation found
several independent sources of main-thread work per navigation and per stream
chunk. This change takes only the two cheapest, lowest-risk ones (see
proposal):

1. A no-op `updateConversationTitle` on every `loadConversation`
   (`apps/chat/src/pages/Conversation/Conversation.tsx:458-460`). It replaces
   the `conversations` array, so every `useConversations()` consumer and every
   memo keyed on the list runs a second time per navigation.
2. Broken memo boundaries around the sidebar:
   - `app.tsx:259` passes an inline arrow to `memo(ConversationPanelView)`;
   - `ConversationPanelView.tsx:1284-1313` passes inline `labels` and
     `headerActions` to the lib's `memo(ConversationPanel)`.

   Because `App` consumes `SourcesSidebarContext`, whose value includes
   `messages` (`app.tsx:156`, `SourcesSidebarContext.tsx:52-73`), every stream
   chunk re-renders `App`. With the memo boundaries broken, it also re-renders
   the whole sidebar.

State ownership does not change. `ConversationsProvider` still owns
`conversations`, `App` still owns `panelRequestedFilter`, and
`ConversationPanelView` still owns the derived labels. No new context and no
new hook.

## Goals / Non-Goals

**Goals:**

- A navigation whose loaded name matches the list title does not replace
  `conversations`.
- `ConversationPanelView` is skipped on `App` re-renders with unchanged panel
  inputs. `ConversationPanel` is skipped on view re-renders with unchanged
  inputs.

**Non-Goals:**

- The remaining per-navigation work that still runs when
  `activeConversationId` legitimately changes:
  - `useConversationPanelItems` O(N × D);
  - `collapseScheduledTaskConversations`;
  - `rowProps`, overscan, and `getActions` per row.

  That work is deferred to a follow-up.
- `SourcesSidebarContext` split, message-list memo/virtualization, and chunk
  batching.
- The `loadConversation` stale-response race.

## Decisions

### D1. Idempotent updaters in the provider, not a guard at the call site

`updateConversationTitle`, `removeConversationFromList` and the optimistic
branch of `pinConversation` return `prev` when nothing would change. For the
title updater:

```ts
setConversations((prev) => {
  const index = prev.findIndex((item) => conversationIdsMatch(item.id, id));
  if (index === -1 || prev[index].title === title) return prev;
  const next = prev.slice();
  next[index] = { ...prev[index], title };
  return next;
});
```

- `removeConversationFromList` filters, then returns `prev` when the filtered
  length equals `prev.length`.
- `pinConversation` uses the same `findIndex` shape for both the optimistic
  write and the revert. It matches on strict `c.id === id`, which is the
  current behavior and stays unchanged.
- The updater stays pure. React may call it twice in StrictMode, and nothing
  outside it is mutated.

Two constraints on this change:

- `findIndex` + `slice` keeps the "only the matched item gets a new object"
  property the current `map` has, and stops at the first match. The current
  `map` updates every match, but conversation ids are unique in the list, so
  a single match is the actual invariant.
- `loadConversation` is **not** changed. The provider bail-out already makes
  its unconditional call a no-op, and a page-side comparison would need
  another O(N) list lookup plus a dependency on `conversations` in a callback
  that deliberately avoids it (see the `loadConversationRef` comment in
  `Conversation.tsx:578-585`). This deviates from the literal wording of the
  request ("loadConversation does not call…") while delivering the same
  observable result. It is recorded here so a reviewer can overrule it.

Alternative rejected: deep-equal the new list before `setConversations`. That
is O(N) on every write and masks allocation in the updaters.

`bumpConversationActivity` and `markConversationViewed` are left as they are.
The first always changes `updatedAt`. The second already returns early when
the target is not unread (`ConversationsContext.tsx:331-332`).

### D2. `useCallback` for `onRequestedFilterChange` in `App`

```ts
const handlePanelRequestedFilterChange = useCallback(
  () => setPanelRequestedFilter(undefined),
  [],
);
```

This follows the pattern of the neighboring `handlePanelActiveFilterChange` /
`handleDuplicateReadonly` (`app.tsx:196-210`). The other props `App` passes are
already stable: `closePanel` comes from context, and `handleSelectConversation`
/ `handleNewChat` are `useCallback`s keyed on `navigate`, `isMobile` and
`closePanel`. `activeConversationId` is `useMemo([pathname])`, and
`requestedFilter` is state.

### D3. Memoize `labels` and `headerActions` in `ConversationPanelView`

- `labels`: `useMemo` over `t`, `filterLabels`, `groupLabels` and
  `unreadIndicatorLabel`. The label parts are already memoized
  (`ConversationPanelView.tsx:617-636`), and `unreadIndicatorLabel` is a
  string.
- `headerActions`: `useMemo` returning `<ConversationPanelMenu … />`, keyed on
  `activeConversationId`, `isConversationExportHidden`, `handleExportAll` and
  `handleImportClick`. `ConversationPanelMenu` is itself `memo`-wrapped
  (`ConversationPanelMenu.tsx:206`), so this only restores identity for the
  lib's shallow compare.
- `className={mergeClasses(...)}` is a string, and
  `onToggle={isMobile ? onClose : undefined}` resolves to a stable reference.
  Neither needs a change.
- Props that change when `activeConversationId` changes (`getActions`,
  `handleMoveConversation`, `conversations`) keep changing. That is correct
  and out of scope.

### D4. How the memo boundaries are tested

- **Lib boundary.** `ConversationPanelView.spec.tsx` already replaces
  `ConversationPanel` with a mock (`:42`). A render counter on that mock
  shows that re-rendering the view with identical props (`rerender` with the
  same prop objects, and the mocked `useConversations` returning the same
  value) does not increment the count, while changing `activeConversationId`
  does.
- **View boundary.** `App` has no component spec today, and its hook surface
  is large (38 imports). The test mocks `ConversationPanelView` with a render
  counter, forces an `App` re-render through a mocked `useSourcesSidebar`
  whose value changes identity, and asserts the counter is unchanged. It
  lives in a new `apps/chat/src/app/tests/app.spec.tsx`. If mocking `App`'s
  providers proves disproportionate, the fallback is to assert prop identity
  (`onRequestedFilterChange` is the same function across two renders) with
  the same harness. The fallback must be recorded in `tasks.md` when it is
  taken.

## Risks / Trade-offs

- [A consumer relies on getting a new array after a no-op title update] →
  Checked: callers are `Conversation.tsx:459` and `ConversationsContext.tsx:253`.
  Neither needs a re-render when the title is unchanged, because the page
  updates its own `conversation.name` separately.
- [`findIndex` stops at the first match while the old `map` updated all
  matches] → Ids are unique in the list. `duplicateConversation` uses a
  UUID temp id, which is later replaced.
- [A memoized `labels` goes stale on a language change] → It is keyed on `t`,
  which `react-i18next` replaces on language change. `filterLabels` and
  `groupLabels` already rely on this.
- [The gain is smaller than the freeze] → Expected: this removes the
  duplicate pass per navigation and the sidebar re-render per stream chunk.
  The remaining costs are listed in Non-Goals and deferred to follow-up
  changes.

## Migration Plan

No migration. The change is app-only and not breaking. Rollback is a plain
revert of the commit.

## Open Questions

- Should `loadConversation` also skip the call explicitly (as the request
  literally asked), in addition to the provider bail-out? The current plan
  says no (D1). Confirm during review.
