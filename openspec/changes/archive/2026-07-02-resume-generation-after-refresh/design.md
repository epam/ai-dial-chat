## Context

`apps/chat/src/pages/Conversation/Conversation.tsx`'s `loadConversation` already branches on the last persisted message: if it's `role: user`, the page renders an assistant placeholder and auto-starts a fresh generation (`CompletionMode.ContinueLastUser`), guarded so it only fires once (`app-level-generation-manager`). If the last message is anything else, it just calls `setConversation(result)` and stops.

Per `backend-owned-generation-persistence`, the backend writes the conversation to storage exactly twice per generation: once at start (user message + **empty** assistant placeholder), once at the end (full assistant message, or a partial flagged `hasStreamError`/`wasStoppedByUser`). There is no incremental save while tokens stream. So a hard refresh that lands *after* the start-state save but *before* the final save fetches a conversation whose last message is already `role: assistant` with empty content — the `else` branch above — and nothing further happens. The page shows a static empty bubble forever unless the user refreshes again after the backend finishes.

Meanwhile `ConversationGenerationService` (`generation-registry`) still holds that generation as `active` server-side (there is no client-disconnect handling in `streamCompletion`, only in `/watch`), so a Regenerate click on that message starts a new `startStream` call, which the backend rejects with `409 ConflictException`. `useConversationHandlers.handleRegenerateMessage` already has an `if (isStreaming) return;` guard that silently no-ops during a *live, same-tab* generation — the 409 only happens because after a refresh, `isStreaming` (derived from `useConversationStream`'s client-local `streamingPaths` Set) is `false`, even though the backend disagrees.

The repo already has a generic, working push channel for exactly this kind of "did this conversation resource change" signal: `conversation-watch-sse` (`POST /api/v1/conversations/watch`), today consumed by `ConversationsContext.watchForDisplayNameUpdate` to detect when LLM naming finishes. It proxies DIAL Core's resource-update events for the conversation's storage path — any save to that resource (not just naming saves) fires an `UPDATE` event.

## Goals / Non-Goals

**Goals:**
- Detect, on load, that the last persisted message is an unresolved generation placeholder (empty, no terminal flag).
- Give that state a visible "still generating" treatment identical to a live stream (typing/thinking indicator), so the user isn't looking at a bubble that looks finished-but-empty.
- Make Regenerate/edit behave exactly as they already do during a live, same-tab generation (guarded no-op) instead of round-tripping to the backend and surfacing a raw 409.
- Detect completion pushed by the backend via the existing `/watch` SSE channel and switch back to normal state without another manual refresh.
- Bound the wait with a timeout so a crash or dropped event doesn't strand the UI in "generating" state forever.

**Non-Goals:**
- Replaying the in-progress answer's tokens live after a refresh. The backend does not persist partial content, so there is nothing to replay; the best available signal is "not done yet" → "done," not "here's what's been generated so far." True mid-stream reattachment would require the backend to buffer and multicast an in-flight completion to late subscribers — a materially bigger backend change, left for a future proposal if ever needed.
- Changing Regenerate/edit's behavior or visual treatment during an actual live, same-tab generation. That already works (hover-only actions, guarded no-op); this change only extends the *same* treatment to the post-refresh case.
- Deduplicating this new watch subscription with the existing display-name watch subscription when both happen to be open on the same conversation at once. Both hit the same cheap SSE proxy endpoint; consolidating them is a possible follow-up cleanup, not required for correctness.

## Decisions

### Detect "awaiting resume" from message shape, not a new backend field
A conversation is "awaiting generation resume" when its last message is `role: assistant`, `content` is empty, and neither `hasStreamError` nor `wasStoppedByUser` is set. This is implemented as a small pure predicate (e.g. `isAwaitingGenerationResume(conversation)`) next to the existing `shouldWatchForDisplayNameUpdate` pattern in `apps/chat/src/utils/`.

**Alternative considered**: add an explicit `isGenerating`/`generationId` field to the persisted conversation so the frontend doesn't have to infer state from message shape. Rejected for this change — it requires a backend contract change (`backend-owned-generation-persistence`, `ConversationResponseDto`) for a signal the message shape already gives us for free in the common case. The known false-negative/false-positive edge (a model legitimately returning an empty final answer, which the backend does not currently flag any differently) is accepted as a pre-existing, rare ambiguity — worst case it triggers one extra watch-and-timeout cycle before the user can act, no worse than today's permanently-stuck state.

### Fold "resuming" into the existing `streamingPaths` state instead of a parallel flag
`useConversationStream` already owns a `streamingPaths: Set<string>` that backs `isStreaming`/`isAssistantTyping` everywhere (typing indicator, starter suppression, edit suppression, and — critically — the `isStreaming` guards in `useConversationHandlers` for regenerate/edit/starter-submit). The hook gets one new function, e.g. `resumeIfAwaitingGeneration(conversationId, conversation)`, called once from `Conversation.tsx`'s existing load effect. It adds the path to `streamingPaths` for the duration of the watch and removes it when the watch resolves (event or timeout).

**Alternative considered**: introduce a separate `isResumingGeneration` boolean threaded through `ConversationPage` → `ConversationView` → `ConversationMessageItem` → `useConversationHandlers`. Rejected — it would require duplicating the same four `isStreaming` guard sites for no behavioral difference, and would need its own visual wiring in `ConversationMessageItem`/`message-display.ts` to get the same typing indicator for free. Reusing `streamingPaths` gets both the guard and the visual treatment with one line of new state.

### Reuse the raw-fetch SSE reader pattern, not `EventSource`
The new watch consumer copies the reader loop already used by `watchForDisplayNameUpdate` (`fetch` via the generated client's `Raw` variant → `ReadableStream` → manual `data:` line parsing), because `/watch` is a `POST` endpoint requiring session-cookie auth and a JSON body — `EventSource` supports neither.

**Alternative considered**: extract a shared `useSseWatch` hook to avoid the near-duplicate reader loop between `watchForDisplayNameUpdate` and this new consumer. Deferred — the two call sites resolve on different conditions (name change vs. placeholder resolution) and live in different modules (`ConversationsContext` vs. `useConversationStream`); a shared abstraction is a reasonable follow-up cleanup but not required to ship this fix, and forcing it now risks a larger, riskier diff.

### Resume watch is not aborted on navigation away

`useConversationStream` is a single, long-lived hook instance reused across conversation switches (`app-level-generation-manager`: "ConversationPage is NOT remounted when navigating between conversations"). Real live streams already establish the pattern for this: `onChunk`/`onComplete`/`onError` keep running regardless of which conversation is displayed, gating only their *state writes* on `isPathDisplayed`, so returning to a still-streaming conversation "just works" (chunks resume rendering). The resume watch follows the same pattern — it is not aborted on unmount/conversationId change; it keeps reading until it resolves or times out, applies its result only when `isPathDisplayed` is still true, and always removes the path from `streamingPaths` once resolved.

**Alternative considered (initial draft)**: abort the resume watch's `AbortController` on unmount/conversationId change, mirroring `watchForDisplayNameUpdate`'s cleanup. Rejected during implementation — it breaks the "return to a streaming conversation and it just resumes" guarantee the rest of `app-level-generation-manager` already provides (aborting would require re-opening an equivalent watch on return anyway, since `loadConversation` re-runs for that `conversationId`), adds a cleanup-vs-restart race window, and needs no extra code: reusing the existing `isPathDisplayed` gate is simpler than plumbing a cleanup function out of the hook and back through `Conversation.tsx`.

### Timeout is a safety net, not the primary completion signal
The primary signal is the `UPDATE` SSE event, which fires as soon as the backend's `finalize()` save happens — independent of how long the generation itself takes. The timeout only protects against the SSE channel never delivering that event (e.g. a backend crash mid-stream that clears the in-memory registry without ever writing a final save). A generous timeout (see Open Questions) is used so it practically never fires for a healthy generation, however long that takes.

### Regenerate/edit get no new UI-disabling logic
Because "resuming" reuses `streamingPaths`, `handleRegenerateMessage`'s existing `if (isStreaming) return;` guard (and the analogous guards for edit and starter-submit) already covers the resumed case, and the message actions row already hides behind hover (`hasAlwaysVisibleActions={!isStreaming}`) during any streaming state. This matches what the user already experiences during a live, same-tab generation — no separate "make Regenerate inactive/hidden" logic is needed.

### Stop remains available only for live same-tab streams
The resumed state is an observation of a server-side generation that started before the current page instance existed. The client has no local `generationId` for that run, so it cannot call `stopCompletion` safely. `useConversationStream` therefore exposes a separate "can stop" flag tied to the currently displayed path's live same-tab generation. The input still receives `isStreaming` while resuming, so sending/model changes remain blocked, but the Stop button is hidden unless an actual local stop handler can act on the displayed generation.

## Risks / Trade-offs

- **[Risk]** Small race window between the initial `getConversation` that detects the placeholder and the `/watch` subscription actually attaching — a finalize-save that lands in that gap could be missed. → **Mitigation**: the timeout fallback does one final `getConversation` before giving up, so the window only costs, at most, the timeout duration in the rare case it's hit; not a correctness issue, just a UX delay in an already-rare race.
- **[Risk]** Heuristic placeholder detection (`empty content, no terminal flag`) could misclassify a genuinely empty-but-final assistant answer as "still generating," briefly showing a typing indicator until the watch times out. → **Mitigation**: timeout fallback bounds the delay; this is strictly better than today's permanent stuck state, and the scenario (model returns a truly empty final answer) is already an edge case the rest of the system doesn't handle specially.
- **[Risk]** Two independent `/watch` SSE subscriptions (display-name + resume) can be open on the same conversation path simultaneously, doubling the proxy connections to DIAL Core for that resource. → **Mitigation**: `/watch` is cheap and already rate-limited (`20/60s` per `conversation-watch-sse`); two long-lived connections per page view is well within that budget. Consolidation is a possible later cleanup.
- **[Trade-off]** No live token replay after refresh (see Non-Goals) — accepted because it requires backend streaming-fan-out work well beyond this fix's scope, and a bounded "typing until done" wait is a large UX improvement over the current permanent empty state on its own.

## Open Questions

- Exact resume-watch timeout value: needs to be long enough to comfortably outlast a normal (even slow, tool-using) generation, since the timeout is purely a dead-channel safety net. Proposed default: 5 minutes, adjustable if p99 generation latency data suggests otherwise.
- Whether to eventually consolidate the display-name watch and resume watch into a single shared subscription per conversation — left as a follow-up, not blocking this change.
