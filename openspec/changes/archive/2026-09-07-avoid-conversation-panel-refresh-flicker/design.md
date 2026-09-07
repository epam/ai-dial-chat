## Context

`ConversationsProvider` owns both the cached conversation list and an
`isLoading` flag. The identity-keyed load effect uses that flag correctly for
the initial request and for a user change: it clears the old list and blocks the
panel until the new identity's data arrives.

The same flag is also toggled by `refreshConversations()`. When navigation makes
a newly created conversation active, `useActiveConversationSync` cannot find it
in the previous list and calls that refresh. `ConversationPanelView` forwards
the flag to `ConversationPanel`, which replaces its complete body with skeleton
rows. This makes a normal background synchronization look like a fresh page
load.

## Goals / Non-Goals

**Goals:**

- Keep already loaded conversation rows visible while an explicit list refresh
  is pending.
- Preserve blocking loading behavior for initial load and authenticated-identity
  changes.
- Continue replacing the list with the server response and reporting refresh
  errors through the existing context state.

**Non-Goals:**

- Change when `useActiveConversationSync` requests a refresh.
- Add an optimistic row for a newly created conversation.
- Change `ConversationPanel`'s generic `isLoading` rendering contract.
- Change routing, backend endpoints, generated clients, or any `libs/*` code.

## Decisions

### Keep loading semantics in `ConversationsContext`

`refreshConversations()` SHALL stop setting `isLoading` before and after its
request. It will keep clearing `error`, replace `conversations` on success, and
store an `Error` on failure. The identity-keyed load effect remains the sole
owner of blocking conversation-list loading.

This follows the context's existing public description of `isLoading` as the
initial-fetch state and fixes every background-refresh caller consistently. It
also keeps the app-level ownership of server-backed state in
`apps/chat/src/context/ConversationsContext.tsx`.

Masking the flag only in `ConversationPanelView` was rejected because other
consumers would still observe a background refresh as a full load. Changing the
presentational `ConversationPanel` was rejected because it correctly renders
the state supplied by its host and should not infer whether a request is
initial or background work.

### Preserve stale rows until replacement data arrives

The existing array stays rendered during the request and is atomically replaced
by `response.items` on success. No list merge or optimistic insertion is added.
This keeps server ordering and metadata authoritative while removing the visual
reset.

An additional background-loading flag was considered and rejected because no
current UI consumes refresh progress. Adding state without a consumer would
increase the context surface without changing observable behavior.

## Risks / Trade-offs

- [Risk] Rows can be briefly stale while a refresh is pending. → This is the
  intended stale-while-refresh behavior; the response still replaces the full
  list when it arrives.
- [Risk] A failed refresh leaves the old rows visible. → Preserve the existing
  error assignment so current error handling can observe the failure without
  discarding usable data.
- [Risk] Future code may assume `isLoading` covers every list request. → Document
  the background-refresh contract on `refreshConversations()` and cover it with
  a deferred-response context test.

## Migration Plan

No data, API, dependency, feature-flag, or rollout migration is required. Deploy
the frontend change normally. Roll back by restoring the `isLoading` toggles in
`refreshConversations()`.

## Open Questions

None.
