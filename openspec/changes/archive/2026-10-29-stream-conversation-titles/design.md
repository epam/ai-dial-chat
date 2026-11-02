## Context

`ConversationTitlesService` currently joins every JSON batch with `Promise.all`; `useConversationTitleEnrichment` awaits each batch before starting the next. The shared cache already limits Core reads to 25 per process, queues at most 250 reads for five seconds, retains 5000 title summaries for five minutes, and fences older reads against writes/deletes. Its current pending promise has no subscriber-owned cancellation. A browser abort therefore stops UI work but does not abort an already accepted Core batch.

The existing `watchConversation` controller and generated Raw wrapper demonstrate authenticated POST SSE, cleanup and backpressure. The shared `ConversationList` already uses `react-window`'s `List`, whose `onRowsRendered` reports visible and overscan ranges; no new DOM observer or virtualization library is needed. `ConversationsContext` already owns history snapshots, while its enrichment hook owns title revisions, deletion tombstones and local-title protection.

This design is required because the change crosses the API/client/library boundary and changes ownership of cancellable, coalesced reads. Backend implementation follows `apps/chat-api/AGENTS.md`, particularly sections 2–6; existing DIAL operations continue through `DialClientService`.

## Goals / Non-Goals

**Goals:** publish ready titles before slower peers; continuously fill available read slots; prioritize the visible viewport at request creation; bound work and cleanup; retain exact IDs, permissions, title authority and UI race protections; measure first-result latency independently of whole-stream duration.

**Non-goals:** removing Core body reads, a distributed cache, persistent history subscriptions, WebSockets, an in-stream priority control API, new list/search behavior, layout changes or new global state providers.

## Decisions

### 1. Add a finite POST SSE contract

Add `POST /api/v1/conversations/titles/stream`, operation `streamConversationTitles`. The authenticated session and CSRF rules match the existing JSON titles endpoint; no additional role or feature flag is introduced. The request DTO is `StreamConversationTitlesBodyDto` with `{ ids: string[] }`. Validate all input before opening SSE: 1–500 entries, the existing 4096-character resource-ID bound and exact-path parser, and at most 256 KiB of UTF-8 encoded `JSON.stringify(ids)`. Duplicates retain their first position and produce one outcome; different accepted textual aliases retain their exact requested identities while sharing normalized Core reads.

The 200 response has `Content-Type: text/event-stream`. Every event uses one JSON `data:` line followed by a blank line; `type` is a discriminator. Document `ConversationTitleStreamEventDto` as a Swagger `oneOf` union of typed event DTOs, expose those generated types, and document the stream body as a string with concrete frame examples. The generated `ConversationsApi.streamConversationTitlesRaw` method is used because the normal generated JSON/string decoder cannot deliver incremental frames. `apps/chat/src/server-api/conversations.api.ts` owns the typed stream adapter; components/hooks never call `fetch` or construct URLs.

| Event         | Payload beyond `type`                                                                    | Meaning                                                                           |
| ------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `title`       | `id`, `title`                                                                            | A resolved title; no body/messages                                                |
| `unavailable` | `id`                                                                                     | Missing/forbidden resource, without exposing which                                |
| `item_error`  | `id`, `code: upstream_error or timeout`                                                  | This item was attempted but failed                                                |
| `done`        | `reason: complete or budget`, `processed`, `total`                                       | Successful protocol completion; `processed` counts item outcomes, not only titles |
| `error`       | `status`/`code`: `401`/`unauthenticated`, `502`/`upstream_error`, or `503`/`unavailable` | Terminal failure after headers; no `done` follows                                 |

Before headers: 400 for invalid IDs/count, 401 for missing/invalid authentication, 403 for CSRF rejection, 413 for the input byte bound, 503 for stream admission overload, and 502/503 for an upstream setup failure if setup occurs before headers. After headers these failures must be represented by an `error` frame and closure, never an attempted HTTP status rewrite. A resource 403/404 is an `unavailable` item outcome. Authentication rejection, rate limiting and read-queue unavailability are stream-fatal. Isolated upstream 5xx/read timeouts emit `item_error`; five consecutive upstream read failures terminate the attempt with 502/503. A successful upstream read resets that streak. A batch containing only missing/forbidden items can complete normally.

Keep `GET /conversations/list` and `POST /conversations/titles` contracts intact. Compared with replacing the JSON endpoint, an additive route allows staged rollout and rollback.

### 2. Stream scheduling and resource limits

Use a finite request-owned ID queue and at most 25 workers per stream, with all actual reads admitted through the existing **global** 25-read gate shared by JSON and SSE. Workers take the next ID when a previous item settles; they do not await a group of 25. Do not create a promise or global-queue entry for all 500 IDs at once. Serve cache hits without a Core request.

Proposed initial bounds are deliberately explicit and are not claimed to be production-tuned:

| Resource                            | Bound                                                      |
| ----------------------------------- | ---------------------------------------------------------- |
| Input per stream                    | 500 IDs; 256 KiB serialized ID array                       |
| Active title streams per process    | 16, including initialization/cleanup                       |
| Actual Core title reads             | 25 process-wide across both endpoints                      |
| Global queued reads / queue wait    | Existing 250 / 5 seconds                                   |
| Individual Core request             | Existing 10-second timeout                                 |
| Request admission window / lifetime | Stop taking new IDs at 45 seconds; terminate by 60 seconds |
| Ready event buffer / maximum frame  | 25 item events / 64 KiB per frame                          |
| Keepalive / writable drain wait     | Existing 15 seconds / 5 seconds                            |

Use `startSseResponse`, `writeSseChunk`, `waitForDrain` and response cleanup helpers. One writer serializes event frames and keepalives. Reserve an outcome-buffer permit before admitting an item and release it only when that outcome is written or discarded; active items plus buffered outcomes cannot exceed 25. Backpressure pauses admission, so completed workers cannot accumulate extra results in blocked enqueue promises outside the buffer. A stalled writer closes the stream and cancels its ownership, including when no error frame can be delivered. Connection closure or shutdown prevents further writes and admissions. Timer/close/error races finalize once.

At the 45-second admission boundary, drain already-admitted work and emit `done` with `reason: budget`; untouched IDs have no item event. The 60-second hard deadline cancels outstanding request ownership, emits `item_error` with `code: timeout` for still-admitted IDs when writable, then emits the budget terminal frame. The hard deadline also bounds output-drain waiting: if remaining frames cannot be written then, close as an interruption instead of extending lifetime or sending dishonest terminal counts. If none of the IDs made progress, emit a terminal 503 instead of allowing empty budget continuations forever. Large histories are partitioned by both count and byte bounds; unattempted IDs are eligible for the next request. An actual 25-item scheduling barrier is never reintroduced inside a stream.

### 3. Cancellation belongs to consumers of a shared read

Extend the cache's in-flight entry into a read operation with an operation-owned abort controller, a subscriber count and identity fencing. Each JSON/SSE consumer holds a lease and may detach independently. A queued operation with no consumers is removed; an active operation with no consumers is aborted. Its global slot remains occupied until the underlying SDK call settles, so cancellation cannot temporarily exceed the concurrency cap. An operation still needed by another consumer continues.

The SDK receives the operation cancellation signal combined with the 10-second timeout. Do not attach the first stream's signal directly to a coalesced fetch. Discard cancelled results and retain the existing entry-identity fence so neither late success nor late 404 can restore a deleted title or overwrite a newer write. JSON's public response and error mapping stay unchanged; its controller also detaches request ownership on disconnect.

Keep cache key `conversations:title:<sha256(token)>:<normalized-resource-id>`, five-minute TTL, 5000-entry bound, metadata-version invalidation and successful read/save/rename/LLM/delete hooks. No durable data or cross-pod invalidation is added. Empty entries after cancelled/failed reads are removed when no current summary/consumer requires them. Retain only title projections after I/O.

### 4. App scheduling, framing and state

`ConversationsContext` remains the history owner; `useConversationTitleEnrichment` owns one enrichment attempt per accepted snapshot. The hook maintains unattempted IDs plus settled outcomes, and opens at most one title stream at a time. A budget terminal or request-size boundary starts the next finite request for remaining unattempted IDs. An item failure is not retried within the same attempt. A fatal event, invalid protocol, EOF without a terminal event or network failure stops the attempt; a later list refresh can retry unresolved names. This avoids an automatic outage/reconnect loop.

The app adapter parses UTF-8 across arbitrary byte boundaries, CRLF, comments, blank event boundaries and multi-line SSE data; enforce the 64 KiB event limit and validate event types/payloads at runtime. Unknown, duplicate or non-requested IDs cannot mutate state. Terminal counts must match received item outcomes. Always cancel/release the reader on abort, terminal completion or parse failure. Typed event DTOs are the external contract; do not extract or broaden the private generation-resume parser as a drive-by refactor.

Apply title events by exact ID with the existing snapshot/revision guards and use a bounded pending-update map, flushing once per animation frame with a 100 ms timer fallback. This avoids a render per network fragment and still applies fast titles before slow reads. Flush pending valid updates before settling progress. Preserve rename protection, deletion tombstones/rollback, local pin/unread state and active search-result retention.

Missing/forbidden/failed items retain their existing fallback title. `isUpdatingTitles` is true only during active work; the current provisional-search and accessible status behavior remains. Reuse `conversationPanel.updatingTitles`; no new visible strings or generic error toast are needed. No UI route, context, environment variable or feature flag is added. On an initial HTTP 404/405 from this route, select the existing JSON adapter for the current identity session; do not fallback after receiving SSE or on 401/403/429/5xx. Reset this capability choice on identity change.

### 5. Visible rows are a host-agnostic library signal

Add optional `onVisibleConversationIdsChange(ids: string[]): void` to `ConversationList`, `ConversationListSection` and `ConversationPanel`, threading it through every container and public prop type. Translate `react-window`'s actual visible range, excluding overscan/group headers and deduplicating IDs; do not query DOM text or treat every filtered row as visible. Report an empty set when no rows are visible. Emit only when the ID sequence changes, use stable callbacks/memoized derived lists, and clear the host registration on unmount or panel hide.

`ConversationPanelView` registers that list's visible IDs with the existing context. Registrations are keyed per mounted view so closing one panel does not erase another view's priority; the app, not the lib, merges registrations. After rendering a new metadata snapshot, allow one animation frame (at most 100 ms) for viewport reporting, then order pending IDs as visible first, followed by the current metadata order. No panel report means normal background order. Sample fresh visibility before each continuation. Scroll/filter/title changes update the next request's order but do not abort the current stream just to reprioritize it. This limitation avoids adding a server-side job registry or control endpoint.

Do not restrict the total work to currently matching/visible rows: hidden groups, filtered-out items and older scheduled runs must remain eligible, otherwise title search cannot become complete. The same callback is used by desktop and mobile; hiding the drawer clears priority but does not discard snapshot work. There is no direction-sensitive geometry, new styling or icon; preserve current keyboard focus, logical layout and polite status announcements without reading each incoming title aloud.

### 6. Observe delivery separately from upstream work

Extend `SseSubscriptionKind` with `conversation_titles` and the explicit HTTP streaming-route set with `/api/v1/conversations/titles/stream`. Count a stream from admission until owned asynchronous cleanup settles. Instrument first successful title-frame write, actual SDK read duration (once per coalesced operation), global queue wait and emitted item outcomes. Use existing OpenTelemetry enablement and fixed outcome/code labels only; never label or log raw IDs, titles, tokens or user identifiers. Define metrics in the telemetry delta. Update `docs/observability.md` so whole-response duration is not mistaken for time to first title.

Deterministic deferred-promise tests must prove early emission and work-slot reuse; do not claim a latency speedup based solely on moving the same `Promise.all` into an SSE handler. Controlled fixtures measure first useful result and complete-history duration separately, without adding a standalone benchmark framework.

## Risks / Trade-offs

- Core body latency and volume remain → preserve global concurrency; prioritize initial viewport and expose early results; Core indexing remains a separate project.
- SSE buffering in deployment infrastructure → reuse established stream headers/keepalives; integration tests consume response bytes before completion; live environment latency remains unmeasured.
- Coalesced cancellation can affect another consumer → lease ownership, abort only on last detachment, and tests for both JSON/SSE consumers.
- Cached titles differ across pods/token refresh → retain existing expiry and local-title guards; no cross-pod consistency promise.
- A newly scrolled-to row can wait for the current finite request → priority affects future requests, with a bounded stream lifetime; continuous reprioritization is deferred explicitly.
- Larger requests retain more IDs → count, byte, active-stream and output bounds; credentials remain request-scoped.

## Migration Plan

1. Add the stream endpoint, typed Swagger events, cancellation ownership and regression tests while existing clients continue using JSON.
2. Regenerate/build/check the SDK, add the Raw app adapter, then switch the existing enrichment hook and wire visible-ID reporting.
3. Update architecture, API/UI/telemetry specs and the library README; keep the JSON route for older clients and rollback.
4. Validate both endpoints, mixed-version fallback and cancellation. Backend-first deployment is preferred. Roll back the frontend to the JSON path if needed; no storage migration is involved.

## Open Questions

No unresolved product-scope decision blocks implementation. The stated count/lifetime/buffer bounds are proposed defaults to verify with controlled tests; actual Core latency, cache hit rate and infrastructure buffering must be measured before making a production speed claim. State ownership and finite-stream behavior follow the existing history context and the agreed initial-load scope.
