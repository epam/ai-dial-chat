# Proposal

## Why

When a long generation finishes, the backend saves the answer with the credentials of the request that started it. If those credentials are no longer accepted when the generation ends, the save is rejected with `401`. The user then sees "Couldn't finish this response — the response could not be saved", even though the full answer is on screen and the browser session is still valid ([#9324](https://github.com/epam/ai-dial-chat/issues/9324)). `apps/chat-api/README.md` ("Completion persistence failures") already documents this cause. Production logs show it only for long runs (about 2 minutes and longer), typically agentic deployments such as DIAL Loop. The browser keeps a fresh session the whole time, so a save sent from the browser after the failure can succeed where the backend's terminal save did not.

## Problem

- The terminal save is the backend's only write for the generation (`backend-owned-generation-persistence`), and it is never retried. The reason is that a rejected write can have an ambiguous commit outcome.
- When it fails, the answer survives only in the open tab. It is lost on reload, and the only recovery the user is offered is regenerating, which reruns the whole generation.
- The client cannot tell a rejected-credentials failure from any other storage failure. The persistence error carries no cause.

## Solution

1. **Backend.** The existing `conversation_save_failed` error on the completion stream gains an optional `status` field: the HTTP status of the rejected terminal write. It is sent **only for a completed answer**. A stopped, aborted, or failed answer carries markers only the backend's write would store (`wasStoppedByUser`, an empty or upstream `streamErrorMessage`), so it never triggers a client save. Nothing else about the error, its text, or the backend's single-write rule changes.
2. **Client.** When that error arrives with `status: 401` on a stream started in this tab, `useConversationStream` makes **one** recovery save through the host transport. It reads the stored conversation, puts the received answer back at its index, and saves it.
   - A `401` means the write was refused before anything was stored, so a retry cannot duplicate or overwrite a committed write.
3. **No flicker.** While that recovery runs, no warning is shown. The warning appears only if the recovery fails. If it succeeds, the user sees nothing unusual.
4. **Host contract.** The host supplies the save as a new **optional** `ConversationStreamTransport.saveConversation`. A host that does not implement it keeps today's behavior.

Every other case keeps today's behavior exactly: any other status, a missing status, an attach or replay subscriber, or a host without `saveConversation`.

## Non-goals

- The backend makes no second write, and does not store, refresh, or reuse any token.
- No recovery for other statuses (`413`, `5xx`, unreachable storage). Their commit outcome can be ambiguous.
- No change for attach/replay subscribers (another tab, or a re-attach after reload), so two tabs never race to write the same answer.
- No change to the reload heuristic that shows the warning without a backend report.
- No new logging, metrics, UI, or user-visible strings.

## Alternatives considered

- **Retry on every `conversation_save_failed`.** Simpler, but it retries failures whose commit outcome is ambiguous, and it is broader than this issue. Rejected for scope.
- **Show the warning first and clear it on success.** Simpler, but the warning would flash for up to a couple of seconds on every successful recovery. Rejected.
- **Backend keeps the newest token per session and retries with it.** Rejected: no token storage on the backend.
- **Backend refreshes the token itself before saving.** Rejected: with refresh-token rotation it can invalidate the browser's refresh token and log the user out.
- **Longer access-token lifetime, or a refresh before long runs.** Out of our control, and it does not help when a run outlives the token's whole lifetime.

## Acceptance criteria

- A rejected terminal write of a completed answer with `401` sends `conversation_save_failed` with `status: 401`. A stopped, aborted, or failed answer's rejected write sends no `status`. The error type and text are unchanged.
- After that error with `status: 401` on a stream started in this tab, with a transport that implements `saveConversation`:
  - exactly one recovery read and one save are made, carrying the received answer;
  - no warning is shown while they run;
  - on success, no warning is ever shown and a reload shows the saved answer;
  - on failure, today's warning is shown.
- Any other status, a missing status, an attach subscriber, or a transport without `saveConversation` behaves exactly as today. The warning is shown immediately and no recovery request is made.
- A superseded generation, a replaced buffer, or a conversation the user navigated away from never has its displayed state changed by the recovery.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `backend-owned-generation-persistence`: the `conversation_save_failed` stream error carries the rejected write's `status`. The single-write rule is clarified as a backend rule, distinct from the client's one recovery save. The "explicit `conversation_save_failed` events keep their warning" rule notes the deferred `401` case.
- `chat-hooks-api-transport`: `createChatStreamApi` exposes that `status` on `GenerationPersistenceError`.
- `chat-hooks-conversation-stream`: the single `401` client recovery save, its deferred warning, and the optional `saveConversation` transport method. Two existing requirements that said the warning is always written immediately, and that the buffer is always kept, now point to it.
- `generation-stream-recovery`: the "other errors keep today's behavior" scenario notes that a `401` persistence error is then handled by the separate recovery save, not by interrupted-stream recovery.

## Impact

- **Backend.** `apps/chat-api/src/conversations/generation/persistence-error.ts` and `finalize` in `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`.
  - The status already exists on the caught `HttpException` that `handleDialSdkError` throws.
  - Attach events and the background path are unchanged.
  - The SSE frame is not part of the OpenAPI document, so there is no generated-client change.
- **Lib.** `libs/chat-hooks`:
  - `GenerationPersistenceError` and its parsing in `libs/chat-hooks/src/conversation/create-chat-stream-api.ts`.
  - The persistence branch of `settleAsFailed` and the `ConversationStreamTransport` interface in `libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts`.
  - The recovery reuses the existing `restoreBufferedMessage` helper (`libs/chat-hooks/src/conversation/useConversationStream/buffered-generation.ts:30`) and the existing `transport.getConversation` read.
- **Lib isolation.** The lib still knows no endpoint, and it calls the injected `transport.saveConversation`. The app adapter `apps/chat/src/utils/conversation-stream-transport.ts` maps it to the existing `saveConversation` in `apps/chat/src/server-api/conversations.api.ts:47`, the client save the app already uses for other conversation edits. `Conversation.tsx` and `AppPreviewChat.tsx` both use that adapter.
- **Backward compatibility.** Both the error field and the transport method are optional and additive. An old client ignores `status`. A new client receiving no `status` behaves as today. Rollback is a plain revert, with no data migration.
- **i18n.** None. The existing persistence warning is reused.
- **Docs.** The `apps/chat-api/README.md` "Completion persistence failures" section, the transport and persistence paragraphs in `libs/chat-hooks/README.md`, and the persistence summary in `docs/architecture.md`.
- **Scope flag.** This touches a shared lib (`libs/chat-hooks`) and one backend error path, and only the reported-persistence-failure branch of each.
