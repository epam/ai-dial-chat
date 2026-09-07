## Why

After the first message creates a conversation and navigation moves from `/` to
`/conversations/<id>`, `useActiveConversationSync` does not find the new id in
the previously loaded list and requests a refresh. `ConversationsContext`
currently marks that refresh as a full loading state, so the conversation panel
temporarily replaces its existing rows with skeletons and visibly flickers.

## What Changes

### Solution

- Reserve `ConversationsContext.isLoading` for the initial load and an
  authenticated-identity change, where no prior user's list may remain visible.
- Make `refreshConversations()` update the conversation list in the background,
  preserving the currently loaded rows until the request settles.
- Add regression coverage proving that a background refresh leaves
  `isLoading=false` and keeps existing conversations visible until fresh data
  arrives.

The closest existing behavior is the missing-active-conversation refresh in
`libs/chat-hooks/src/conversation/useActiveConversationSync/useActiveConversationSync.ts:42`
and the initial/identity load in
`apps/chat/src/context/ConversationsContext.tsx:229`.

### Non-goals

- Changing the `/conversations/<id>` route or conversation creation API.
- Changing the generic `ConversationPanel` contract: it still renders skeleton
  rows whenever its host passes `isLoading=true`.
- Adding optimistic conversation-list entries or changing list ordering.
- Changing any library under `libs/*`.

### Acceptance criteria

- Navigating to a newly created conversation may refresh the list, but the
  already loaded panel rows remain rendered while that request is pending.
- The refreshed response still replaces the list when it resolves, and refresh
  failures continue to populate the context error state.
- Initial provider loading and an authenticated-identity change still clear the
  list and expose `isLoading=true` until their request settles.
- No new user-visible strings, RTL behavior, accessibility semantics, feature
  flags, telemetry, or backend/API changes are introduced.

The conservative alternative was to mask `isLoading` in
`ConversationPanelView`; it was rejected because the context already documents
the flag as initial-fetch state, and other refresh consumers would retain the
same stale full-loading behavior. Changing `libs/conversation-panel` was also
rejected because its prop contract is correct and host-agnostic.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `conversations-context`: define background-refresh behavior separately from
  initial and authenticated-identity loading.

## Impact

- Affected code:
  `apps/chat/src/context/ConversationsContext.tsx` and its colocated context
  tests.
- APIs and dependencies: no changes.
- Library isolation: no `libs/*` code changes and no host or external-system
  knowledge crosses into a library.
- Compatibility and rollback: non-breaking internal state-semantics change;
  rollback consists of restoring the loading-state toggle inside
  `refreshConversations()`.
