## Why

`backend-owned-generation-persistence` and `chat-hooks-conversation-stream` already guarantee that a completion survives a closed tab: the backend keeps generating and saves the conversation at start, final, stop, and error regardless of the browser connection. But a user who reopens that conversation while generation is still running elsewhere (refresh, a new tab, a second device under the same login) sees only a static typing indicator — `resumeIfAwaitingGeneration` watches the generic conversation-update SSE channel and re-fetches the whole conversation on each event, so nothing is visible until the backend's terminal save lands. The assistant's answer, though it is being generated character by character right now, is invisible until it is completely finished. This was called out as an explicit non-goal in the resume-after-refresh work ("would require the backend to buffer and multicast an in-flight completion to late subscribers — a materially bigger backend change, left for a future proposal if ever needed"); this change is that proposal.

## What Changes

- The backend retains the in-flight assembled assistant message for each active generation (not just an `AbortController` and a status enum, as `ConversationGenerationService`'s registry does today), updated as chunks are produced by the existing relay/adapter path and passed through `applyChunkToMessage`.
- A new backend capability lets a late-joining client attach to an active generation for a conversation path: it receives an immediate snapshot of whatever has been generated so far, then every subsequent chunk live, in the same wire shape the original streaming request uses, until the generation reaches a terminal state. Multiple concurrent late subscribers (e.g. two tabs of the same login) are supported.
- `resumeIfAwaitingGeneration` (`libs/chat-hooks/src/conversation/useConversationStream`) attaches to that live stream instead of only watching for a terminal update, feeding chunks into the same per-path buffering/message-update path `startStream`'s `onChunk` already uses — so a resumed view renders progressively, through the existing typing-indicator and message-rendering UI, with no new components.
- The race where generation finishes between page load and the attach attempt falls back cleanly to the existing watch-then-refetch/`getConversation` behavior — that path is not removed, only no longer the sole way to observe an in-progress generation.
- `ConversationStreamTransport` (`libs/chat-hooks`) gains the capability surface this needs; the concrete REST/SSE wiring is added at the app edge (`apps/chat/src/utils/conversation-stream-transport.ts`, `apps/chat/src/server-api/chat-stream.api.ts`), keeping the lib free of hardcoded paths, CSRF handling, or SSE-parsing details beyond what the transport interface already abstracts.
- `docs/architecture.md`'s Conversations section is corrected in the same change (it currently describes pre-`backend-owned-generation-persistence` behavior and doesn't mention backend-owned persistence, the resume flow, or this new replay capability at all).

**Not BREAKING**: existing completion, stop, and non-replaying resume behavior are unchanged; this only adds an additional, better-informed path for the resume case.

## Capabilities

### New Capabilities

- `generation-live-replay`: backend retention of in-flight assembled message content per active generation, keyed for lookup by conversation path (not just `generationId`, which a resuming client does not have), multicast of a snapshot-then-live-chunks stream to any number of late subscribers, and correct handling of a generation that finishes before or during the attach attempt.

### Modified Capabilities

- `chat-hooks-conversation-stream`: `resumeIfAwaitingGeneration`'s behavior changes from "mark path streaming, watch for a terminal update, refetch" to "mark path streaming, attach to the live replay stream and apply chunks progressively, falling back to the existing watch/refetch behavior when attach is unavailable or the generation has already finished."
- `chat-hooks-api-transport`: `createChatStreamApi`/`ConversationStreamTransport` gain the injected capability to attach to and consume an in-progress generation's live replay stream, alongside the existing `streamCompletion`/`stopCompletion`/`watchConversation`/`getConversation` surface.

## Impact

- **apps/chat-api**: `apps/chat-api/src/conversations/conversation-generation.service.ts` (registry gains buffered content + multicast), `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts` (publish chunks to the buffer/multicast channel as they're relayed), `apps/chat-api/src/conversations/conversation.controller.ts` (new or extended endpoint), `apps/chat-api/src/conversations/dto/` (new DTOs as needed), OpenAPI regeneration (`npm run openapi`, `npm run openapi:check`) and `libs/chat-api-client` rebuild.
- **libs/chat-hooks**: `src/conversation/useConversationStream/useConversationStream.ts`, `generation-resume.ts`, `create-chat-stream-api.ts`, and the `ConversationStreamTransport` interface/models.
- **apps/chat**: `src/utils/conversation-stream-transport.ts`, `src/server-api/chat-stream.api.ts` (concrete wiring for the new transport capability).
- **docs**: `docs/architecture.md` (Conversations section correction), this change's own `specs/generation-live-replay/spec.md`, and delta specs for the two modified capabilities.
- **No changes** to `libs/chat-shared`, routing, auth/session handling, i18n keys, or RTL/UI markup — the resumed view reuses existing rendering and typing-indicator components.
