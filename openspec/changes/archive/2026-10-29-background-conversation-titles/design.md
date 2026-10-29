## Context

Before this change, `ConversationListingService` listed all metadata pages and then read every body in sequential batches of 25. The extra reads only supplied `name` and `llmNamingDone` to `resolveListDisplayTitle`. `ConversationsContext` owns list refresh, manual title updates and identity transitions; `ConversationList` performs client-side title filtering. Existing resource-specific watch streams do not deliver title projections for an entire history.

## Goals / Non-Goals

**Goals:** release first render from body reads, reuse recent names, bound background work, preserve identity isolation and user edits, and make incomplete search explicit on mobile and desktop.

**Non-goals:** changing Core, migrating stored conversations, server-side full-history search, or promising fully current names before a cold history is enriched.

## Decisions

### Metadata first; request-scoped title batches

`GET /api/v1/conversations/list` retains metadata pagination, grouping and ordering. It adds optional `isTitlePending` and substitutes a cached title when available. It does not initiate body reads.

`POST /api/v1/conversations/titles` (`getConversationTitles`) takes `{ "ids": ["conversations/<bucket>/<encoded-path>"] }`, with 1–25 IDs. It returns `200 { "items": [{ "id": "...", "title": "Current title" }] }`. Missing or inaccessible items are omitted so one obsolete item does not fail the history. Authentication failures stop enrichment; malformed input returns 400, missing session 401, upstream batch-level failures 502/503 as applicable. The standard session/CSRF policy applies. No client token or message body is returned.

Client-driven batches keep authentication request-scoped. Browser cancellation stops applying obsolete responses and scheduling later batches; an already accepted backend batch can finish within the five-second queue deadline and ten-second SDK read deadline. No detached history-wide job retains credentials. An SSE session would add reconnection/state complexity without reducing Core reads. The app calls the generated client through `server-api/conversations.api.ts`.

### Bounded title projections

Store only the fields required to resolve a title, scoped by a digest of the caller's token and a normalized exact resource identifier. Use a bounded process-local cache with a five-minute lifetime; it is an optimization, not a durable index. Never put bearer tokens in keys or logs. Coalesce identical concurrent reads and bound body-read concurrency. Successful reads/writes refresh the projection; delete invalidates it. Write/delete version fencing prevents an older in-flight fetch from restoring stale data.

Keep URL segments encoded until the SDK boundary. Removing the leading `conversations/` must not decode a literal `%25` escape again. Validate resource type, bucket, traversal and control characters before accepting title IDs. Core remains the authority for body access. A changed access token gets an independent cache namespace.

### Progressive app state

Process pending IDs in list order using sequential bounded batches. Abort obsolete work on a newer accepted list, identity change, or unmount. Apply only to still-existing pending entries in the originating snapshot and never reorder items or replace pin/unread state. Manual rename and an authoritative opened-conversation title take precedence over a previous background result. Completion or failure settles the current attempt without a retry loop or a perpetual loading state.

Protect locally confirmed titles for 315 seconds (the server cache lifetime plus the maximum queued/read duration), so a later refresh routed to another pod cannot immediately undo a rename. Keep deletion tombstones until a list requested after deletion succeeds can supersede them. If deletion fails, restore only the removed rows into current state, preserving unrelated title and pin updates.

### Search continuity

The shared list receives only host-agnostic updating state and translated labels. While title enrichment is active, an empty search is provisional. Keep an opened matching row visible for the same search query when its title is corrected; clear that retention when the query changes. New titles may introduce additional matches. No platform-specific UI branch is introduced; the shared list serves both sidebar and mobile drawer. Status is announced through an accessible live region and uses existing logical-direction styles.

### Core follow-up

A persistent, versioned title index in Core with a background backfill could remove per-conversation body reads from title listing. That requires a separate Core change. This Chat change only moves cold body reads off the initial list critical path.

## Risks / Trade-offs

- Cold names and search can be temporarily incomplete → expose progress and retain the active match.
- Body reads still consume Core capacity → bounded batches, coalescing and a bounded cache; stop obsolete client requests.
- Process-local cache differs across pods and token refresh → correctness must not depend on cache hits.
- External changes may be stale until refresh/expiry → short TTL plus local successful-write updates; no claim of cross-pod synchronization.
- Background result races local rename/delete → both server write fencing and client snapshot/title guards.

## Migration Plan

Deploy the additive backend contract and generated app client together. No storage migration. Old clients retain the list shape but do not resolve pending names. Rollback restores synchronous enrichment and discards the ephemeral cache.

## Open Questions

None blocking implementation. Durable indexing and migration remain outside this Chat change.
