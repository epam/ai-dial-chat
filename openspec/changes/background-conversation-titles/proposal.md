## Why

Synchronous title enrichment makes conversation listing wait for every full conversation body solely to resolve its display title. A recorded request took 14 seconds; the work grows with total history and repeats on refresh. Returning metadata first allows the history to become interactive while titles resolve in the background.

## What Changes

- Return metadata and cached titles immediately, with an optional pending-title marker.
- Add an authenticated, bounded batch title endpoint and a bounded, short-lived cache of title projections.
- Resolve pending titles after first render, cancel obsolete work, and merge results without overwriting newer user actions.
- Keep an opened search result visible through a background title change and distinguish incomplete search from an empty result.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `conversations-api`: Fast metadata listing, projected-title batching, cache isolation and write invalidation.
- `conversation-history-panel`: Progressive titles and stable active search results.

## Impact

`ConversationListingService` in `apps/chat-api/src/conversations/listing/conversation-listing.service.ts` returns metadata and cached titles without waiting for body reads. `ConversationsContext` retains ownership of listing and title updates, using the existing generated conversations API adapter and backend controller patterns.

The backend, generated client, app adapter/context, and shared history panel are affected. Library changes accept plain state and labels only; HTTP, user identity and cancellation stay in the app. A translated progress label is required. No new dependencies or feature flag are needed.

## Non-goals

Changing Core, changing conversation IDs, replacing storage, server-side search, changing the metadata pagination contract, or removing all cold-cache body reads.

## Acceptance criteria

- Listing finishes while conversation body reads remain unresolved; it initiates none.
- Background calls contain at most 25 IDs and return only ID/title projections.
- Warm lists reuse bounded cached names; writes/deletes fence older results.
- Identity switches, newer lists, local renames and deletes cannot be overwritten by stale responses.
- An opened search result remains visible when its title is corrected; empty search is not final during enrichment.
- Generated API, focused regression checks, affected checks, docs/spec validation and a quality pass are completed.

## Alternatives and compatibility

Keeping synchronous enrichment preserves naming but retains the delay. Restoring the old 20-item cap leaves older conversations permanently stale. A durable Core index is the long-term solution but requires a separate repository change and data migration. Background batching provides early interaction now, accepting briefly stale names and incomplete cold search.

Existing response fields remain; `isTitlePending` and the titles endpoint are additive. Coordinated deployment updates Chat to resolve pending names. Rollback restores synchronous enrichment; no stored conversations are migrated or rewritten.
