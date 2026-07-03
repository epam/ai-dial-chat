## Why

Refreshing the page while an assistant reply is still generating leaves the UI stuck on a permanently empty assistant message: the backend only persists a conversation at generation start (empty placeholder) and at generation end (final message), so a reload mid-stream fetches that empty placeholder and never learns that a reply is still coming. Clicking Regenerate on that stuck message then throws a raw `409 "Generation is already active"` error, because the client has no memory that a generation is in flight after a reload. This is a direct, jarring gap in the otherwise-fixed duplicate-message-on-refresh flow and needs a better resume experience.

## What Changes

- On conversation load (including a hard refresh), detect an assistant placeholder message that has empty content and neither `hasStreamError` nor `wasStoppedByUser` set — the signature of a generation that was still active elsewhere when this page loaded.
- When detected, mark that conversation as locally "generating" using the same `isStreaming`/`isAssistantTyping` state already driven by live streams, so the existing typing/thinking indicator renders instead of a static empty bubble, and Regenerate/edit are suppressed by the guards that already check `isStreaming` — no new UI-disabling logic needed.
- Subscribe to the existing `/conversations/watch` SSE channel (`watchConversation`, already used for display-name updates) for that conversation path. On a resource-update event, re-fetch the conversation; once the placeholder is resolved (real content, or flagged `hasStreamError`/`wasStoppedByUser`), replace the local state and drop out of the "generating" state.
- Fall back to a timeout (same pattern as the existing display-name watch) so the UI never waits forever if the watch stream never fires or the backend crashed mid-generation without finalizing; on timeout, do one final re-fetch and release the "generating" state regardless, restoring normal actions (including Regenerate, which can now legitimately retry).
- **Explicit non-goal**: live token-by-token replay of the in-progress answer. The backend persists only a start placeholder and the final assembled message (no incremental save during streaming), so a refreshed tab cannot show partial tokens as they arrive — it will show a typing indicator until the full answer is saved, then render it. True mid-stream reattachment to see live tokens would require backend changes (buffering and multicasting an in-flight stream to late subscribers) and is out of scope for this change.

## Capabilities

### New Capabilities
- `generation-resume-on-refresh`: frontend behavior that detects an in-progress generation on conversation load, renders a generating/typing state instead of a static empty message, watches for its completion via the existing conversation-watch SSE channel (with a timeout fallback), and keeps Regenerate/edit disabled for the duration by reusing the existing streaming-state guards.

### Modified Capabilities
(none — this change adds new frontend behavior around an existing load path without altering the documented contracts of `app-level-generation-manager`, `conversation-watch-sse`, `backend-owned-generation-persistence`, or `generation-registry`)

## Impact

- `apps/chat/src/pages/Conversation/Conversation.tsx` — `loadConversation`'s branch for a non-user last message gains a sub-case for an unresolved placeholder.
- `apps/chat/src/hooks/conversation/useConversationStream.ts` — gains a way to mark a conversation path as streaming for the duration of a resume-watch (reusing the existing `streamingPaths` set that already backs `isStreaming`).
- New frontend util for placeholder/"awaiting resume" detection, colocated tests.
- `apps/chat/src/server-api/conversations.api.ts` — no change; the existing `watchConversation` function is reused as-is.
- No backend changes; no changes to `apps/chat-api/**`.
