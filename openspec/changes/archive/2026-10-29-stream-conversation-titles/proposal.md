## Why

### Problem

History metadata now loads without conversation bodies, but title enrichment still waits for the slowest read in each 25-item batch before displaying any result or requesting the next batch. A cold history therefore remains visibly incomplete even when many titles are already available. This is observable in `apps/chat-api/src/conversations/listing/conversation-titles.service.ts:50` and `apps/chat/src/hooks/conversation/useConversationTitleEnrichment.ts:169`; production latency has not been measured for this proposal.

## What Changes

### Solution

- Add a finite `POST /api/v1/conversations/titles/stream` SSE endpoint. Emit each resolved title immediately, and admit the next ID whenever a read slot becomes free, without a 25-item completion barrier.
- Retain metadata-first listing, the JSON titles endpoint for compatibility, and the existing bounded, token-isolated title cache. Make shared in-flight reads cancellable by subscriber ownership.
- Use the existing `ConversationsContext` and `useConversationTitleEnrichment` for streaming state, incremental updates, cancellation and rename/delete guards; introduce no new global provider.
- Prioritize actual visible conversation IDs when forming each stream request. Add an optional host-agnostic visible-ID callback to the shared virtual list and its containers; use its existing `react-window` range callback. Priority is sampled at request creation, without restarting a stream on every scroll.
- Bound request size, active streams, read concurrency, output buffering and lifetime. Continue large histories through finite requests for remaining unattempted IDs; stop on fatal errors or disconnection.
- Add low-cardinality measurements of first-title delivery, queue/read duration and stream cleanup, and preserve existing search, accessibility, mobile and RTL behavior.

### Alternatives

| Option                                           | Correctness and delivery risk                                                                  | Performance and security                                                                                        | Migration                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Keep JSON; reduce batch size or overlap requests | Smallest change, existing contract                                                             | Reduces some waiting but still holds each response for its slowest item; more HTTP requests or competing queues | No API migration                                |
| Finite SSE plus continuously filled read slots   | Reuses existing stream/auth patterns; needs explicit framing, cancellation and terminal events | Early delivery with the same global Core concurrency limit; bounded request-owned work                          | Additive endpoint; JSON fallback during rollout |
| WebSocket or permanent history subscription      | Adds bidirectional connection and subscription lifecycle ownership                             | Does not eliminate initial body reads; keeping idle subscriptions adds retained state                           | New transport and deployment concerns           |

Choose finite SSE. Follow `watchConversation` in `apps/chat-api/src/conversations/conversation.controller.ts:763`, `startSseResponse` in `apps/chat-api/src/common/utils/sse.ts:32`, and the generated Raw client wrapper in `apps/chat/src/server-api/conversations.api.ts:104`. The [SSE protocol](https://html.spec.whatwg.org/multipage/server-sent-events.html) supplies incremental HTTP events; the continuously filled read pool is what removes batch scheduling stalls.

### Non-goals

- Core-side title indexing, removal of cold conversation body reads, distributed caches or new persistence.
- A permanent rename subscription, WebSockets, or an API to reprioritize already-submitted work on every scroll.
- New list ordering, search semantics, UI layout, user-visible labels, or a new feature flag.
- Cleanup of unrelated local diagnostics or other OpenSpec changes.

### Acceptance criteria

1. A fast title reaches the client while another read in the same request is still unresolved; freeing a read slot starts the next ID without waiting for the remaining reads.
2. No more than 25 upstream title reads run per BFF process, including the existing JSON endpoint. Queued work, stream/output memory and connection lifetime have explicit bounds.
3. Disconnecting a sole consumer removes its queued work and aborts its active reads; disconnecting one of multiple consumers preserves shared reads until the final consumer leaves.
4. Visible IDs precede background IDs at request creation, and histories exceeding one request are fully eligible for enrichment. Hidden/collapsed panels and an empty provisional search do not prevent background progress.
5. Late events cannot undo a rename, restore a deleted row, cross an identity boundary, reorder the list or lose pin/unread state. Partial failures and EOF settle progress truthfully.
6. Existing JSON clients continue to work. Stream framing, backpressure, identity isolation, encoded paths, viewport reporting and all existing race regressions have automated coverage.

## Capabilities

### New Capabilities

None; this extends existing conversation and telemetry contracts.

### Modified Capabilities

- `conversations-api`: finite title stream, bounded work scheduling and subscriber-aware cache cancellation.
- `conversation-history-panel`: incremental stream consumption and visible-ID prioritization through the existing context/hook.
- `observability-telemetry`: title-stream lifecycle accounting and bounded latency/result instruments.
- `bff-http-lifecycle-metrics`: classify the new endpoint as streaming.

## Impact

Backend: conversation controller/DTOs/listing/cache services and existing SSE/telemetry integration. Frontend: the generated conversations API adapter, title-enrichment hook, existing context and `ConversationPanelView`. Shared library scope is limited to an optional `onVisibleConversationIdsChange(ids)` callback threaded through list/section/panel props and documented in the README; transport, auth, priorities and metrics remain app-owned. The generated `libs/chat-api-client` changes only through OpenAPI generation. No new runtime dependency is planned.

i18n: reuse `conversationPanel.updatingTitles` and existing empty/search status text; introduce no new visible strings. The same virtual list is used for mobile and desktop, and the new callback is direction-agnostic.

### Compatibility and rollback

Keep `GET /conversations/list` and `POST /conversations/titles` unchanged. Deploy the additive backend first; an older backend returning 404/405 before a stream starts allows the app to use the JSON path for that identity session. Authentication, capacity and mid-stream failures do not trigger a second full-history fallback. Rollback switches the app back to JSON and leaves the additive endpoint unused. This proposal replaces the sequential-batch frontend requirement from `background-conversation-titles`; it preserves that change's cache, title-authority and search-continuity guarantees.
