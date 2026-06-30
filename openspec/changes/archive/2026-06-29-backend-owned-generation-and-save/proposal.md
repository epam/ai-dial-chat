## Why

When a user sends a message and then navigates to another conversation while the assistant is still generating a response, the frontend-owned save mechanism can corrupt state: chunks land in the wrong conversation, or the final `saveConversation()` call overwrites the wrong conversation path. The root cause is that generation lifecycle and persistence are both managed by the frontend (`useConversationStream.ts`), which is torn down and re-created on every navigation.

## What Changes

- **Backend owns generation persistence.** `ConversationService.streamCompletion` saves the conversation at three points: (1) immediately after adding the user message + assistant placeholder, (2) on `[DONE]` with the full assembled assistant message, and (3) on stop/error/client-disconnect with a partial assistant message flagged `wasStoppedByUser` or `hasStreamError`.
- **Backend tracks active generations.** A new `ConversationGenerationService` holds an in-memory registry (`sessionId + path + generationId → AbortController + status`). Concurrent requests for the same path return HTTP 409.
- **Backend assembles assistant message from SSE chunks.** A new server-side util mirrors the frontend `applyChunkToMessages` logic for `content`, `responseId`, `form_schema`, `attachments`, `stages`, and `annotations`.
- **New stop endpoint.** `POST /api/v1/conversations/completions/stop` cancels the upstream DIAL stream and persists a partial stopped assistant message.
- **`SendCompletionDto` gains `generationId` and `mode`.** `mode` is one of `append | continue_last_user | regenerate | edit`, covering all entry points. `messageIndex` is provided for `regenerate` and `edit`.
- **Frontend removes save ownership.** `useConversationStream.ts` no longer calls `saveConversation` on complete or stop. Instead it does a `getConversation` reload after the stream ends to sync with the server-persisted state.
- **App-level generation manager.** A new `GenerationContext` lives above the conversation page and holds active SSE subscriptions for the current tab. Navigating between chats does not abort an in-progress stream — the stream continues; the frontend simply has no active UI subscriber until the user returns. Closing the browser tab disconnects the SSE, which the backend treats as a client-close and saves a partial result.
- **Chunk guard.** The frontend applies incoming chunks only when `generationId` matches the active subscription, preventing stale chunks from mutating a different conversation's state.

## Capabilities

### New Capabilities

- `backend-owned-generation-persistence`: Backend saves conversation at stream start, final, stop, and error; frontend no longer owns persistence.
- `generation-registry`: In-memory `ConversationGenerationService` tracking active streams per `sessionId + path + generationId`.
- `server-chunk-assembler`: Backend util that merges SSE deltas into a `ConversationMessageDto` (mirrors `apply-chunk.ts`).
- `stop-generation-endpoint`: `POST /api/v1/conversations/completions/stop` — cancels upstream stream, saves partial stopped assistant message.
- `completion-mode`: `CompletionMode` enum (`Append | ContinueLastUser | Regenerate | Edit`) added to `SendCompletionDto` with `generationId` and optional `messageIndex`.
- `app-level-generation-manager`: `GenerationContext` provider above the conversation page; SSE streams survive inter-chat navigation within the same tab.

### Modified Capabilities

- `conversations-completions-api`: `POST /api/v1/conversations/completions` extended with `generationId`, `mode`, `messageIndex`; backend now handles persistence; same SSE chunk format forwarded to frontend.
- `useConversationStream`: Removed `saveConversation` on complete/stop; added `generationId` guard; replaced with `getConversation` reload on complete.
- `handleSend / handleStop / handleRegenerate / handleEditMessage`: Pass `mode` and `generationId`; delegate stop to new stop endpoint.

## Impact

- **Backend** (`apps/chat-api`): new `ConversationGenerationService`; new stop endpoint; `SendCompletionDto` extended; server chunk assembler util; `ConversationService.streamCompletion` refactored.
- **Frontend** (`apps/chat`): `useConversationStream.ts` save logic removed; new `GenerationContext`; `chat-stream.api.ts` extended with `generationId`/`mode`; `handleSend`/`handleStop`/`handleRegenerate`/`handleEditMessage` updated.
- **Generated API client** (`libs/chat-api-client`): regeneration required after DTO and endpoint changes.
- **Breaking change**: frontend must send `generationId` and `mode` with every completion request; old requests without `generationId` are rejected (400).
