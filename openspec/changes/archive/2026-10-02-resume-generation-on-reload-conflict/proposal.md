## Why

QA reported in [#8935](https://github.com/epam/ai-dial-chat/issues/8935) (2026-09-29 comment) that a reload during a streaming response loses or overwrites the answer. The backend lifecycle fixed by #8953 holds on a single pod. Source analysis found one frontend path that matches the symptom. It has not yet been reproduced against a running backend.

1. A first message in a new conversation is saved by `ConversationRoute` with only the user message (`apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx:446`). The conversation page then auto-starts generation A in `ContinueLastUser` mode (`apps/chat/src/pages/Conversation/Conversation.tsx:478-516`).
2. Until the backend saves its start state (user + empty assistant placeholder, `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts:651`), the stored last message is the user message. The typing indicator is already visible.
3. A reload in that window loads that user-last conversation. The page auto-starts generation B. The only duplicate guard (`autoStartedPathsRef`, `getGeneration(...)`) is client-local, so it is empty after the reload.
4. A is still registered for the same principal on the same pod (`sid` survives reload), so B gets `409`. `useConversationStream`'s `settleAsFailed` writes the conflict text into the assistant bubble and never re-reads the conversation (`libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts`, `settleAsFailed`).
5. A saves its answer, but the UI keeps the conflict error. The answer looks lost. If the user acts from that stale UI, it becomes a real overwrite:
   - **Regenerate:** replaces A's stored answer.
   - **Rate or delete:** sends a full-conversation `PUT` built from the stale `conversationRef`.

## Problem

A load-time auto-start treats "the last stored message is a user message" as "no generation exists". That is false during the pre-start window. It also treats the resulting `409` as a terminal failure, although for this caller a `409` means "the answer you wanted is already being produced".

## Solution

Frontend only.

- `useConversationStream.startStream` gains an optional trailing `options` argument: `{ resumeOnConflict?: boolean }` (default `false`).
- With `resumeOnConflict`, a `GenerationConflictError` does not settle as failed. The hook re-fetches the conversation and joins the generation that already exists, using the existing resume flow (attach, then watch fallback, then a final `getConversation`). This is the same handover `generation-stream-recovery` uses for `StreamInterruptedError`. The hook ends on the persisted answer, not on an error bubble.
- The handover also covers the pre-start shape: the server copy still ends in the user message. In that case the re-fetch is retried on the same bounded schedule until the backend's start state lands (design D2).
- The resume watch fallback re-checks the conversation once its subscription is open. Without that check, an update that landed between the re-fetch and the subscription leaves the watch waiting for the full 5-minute timeout.
- `ConversationPage`'s load-time auto-start passes `resumeOnConflict: true`. Every other caller (user send, regenerate, edit, starters, `AppPreviewChat`) keeps today's conflict message, so the second-tab case from #8688 is unchanged.

The model for the handover is the existing recovery path, `recoverInterruptedStream` in `useConversationStream.ts`, together with `createResumeIfAwaitingGeneration` in `generation-resume.ts`.

Alternatives considered:

- **Probe with `attachToGeneration` before every load-time auto-start.** Rejected. It adds a round trip to the start of every reloaded user-last conversation, and it still has to handle the `409` race between the probe and the start.
- **Backend: make `ContinueLastUser` idempotent, or let it attach to the running generation.** Rejected. It changes the completion contract and the #8953 lifecycle for a frontend-owned decision. The requested scope is frontend only.
- **Resume on every `409`.** Rejected. For a user-initiated send from a second tab, joining the other tab's generation would silently drop the message the user just typed. #8688 deliberately shows the conflict there.

## Non-goals

- General optimistic concurrency for client conversation saves (`If-Match` on rate/delete/settings `PUT`s). This change only removes the stale UI that made those saves dangerous in this scenario.
- Multi-pod behaviour. The registry is per process, and the deployment runs one pod.
- Exposing Stop for the joined generation. Its `generationId` belongs to the page that started it. This matches the existing "Stop is not exposed while resuming without a local generation id" rule.
- Any backend, DTO, or OpenAPI change.

## What Changes

- `libs/chat-hooks`: `startStream` (and the `UseConversationStreamResult` / `ConversationStreamStarter` types) accept an optional `options` argument with `resumeOnConflict`. The change is additive and non-breaking.
- `libs/chat-hooks`: conflict handover to the resume flow, including the pre-start shape.
- `libs/chat-hooks`: the resume watch fallback re-checks the conversation once its subscription is open.
- `apps/chat`: `ConversationPage`'s load-time auto-start opts in.
- Deterministic regression tests in `libs/chat-hooks` and `apps/chat`.
- `libs/chat-hooks/README.md` documents the new argument.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `chat-hooks-conversation-stream`:
  - A conflict for a start that opted into `resumeOnConflict` joins the running generation instead of showing the conflict message.
  - The resume watch fallback re-checks once its subscription is open.
- `generation-resume-on-refresh`: the load-time auto-start of a user-last conversation opts into `resumeOnConflict`, so a reload in the pre-start window ends on the persisted answer.
- `generation-stream-recovery`: the "Other errors keep today's behavior" scenario no longer covers an opted-in conflict, which now re-fetches through the shared classification.

## Impact

- **Code:**
  - `libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts`
  - `libs/chat-hooks/src/conversation/useConversationStream/generation-resume.ts`
  - `libs/chat-hooks/src/conversation/useConversationHandlers/useConversationHandlers.ts` (type only)
  - `apps/chat/src/pages/Conversation/Conversation.tsx`
- **Library isolation:** the lib gains a boolean option and keeps using only the injected `ConversationStreamTransport`. The decision that a load-time auto-start may join an existing generation stays in the app (`ConversationPage`). The lib reads no routes, storage, or app context.
- **Shared lib scope:** this touches `libs/chat-hooks`, which other hosts consume. The new argument is optional and defaults to today's behaviour.
- **i18n:** no new strings. The resume reuses the typing indicator, and the fallback reuses the existing conflict text.
- **RTL / a11y:** no markup changes.
- **APIs and backend:** none.
- **Rollback:** revert the commit. No persisted data or wire format changes, and callers that do not pass the option are unaffected.

## Acceptance criteria

- Reload in the pre-start window ends with the displayed conversation equal to the server copy, showing A's answer. No conflict text is written, and no second completion request is sent after the `409`.
- No duplicate user message appears in the displayed or stored conversation.
- No client `PUT` of the conversation is sent while the conflict-handover resume is in progress, and none carries a conflict placeholder.
- Without `resumeOnConflict`, a `409` still shows `generationConflictMessage`, so the #8688 tests pass unchanged.
- If the re-fetch and attach cannot resolve the conflict, the hook settles exactly as today, with the conflict message.
- The existing `useConversationStream`, `generation-resume`, and `Conversation` page tests pass.
