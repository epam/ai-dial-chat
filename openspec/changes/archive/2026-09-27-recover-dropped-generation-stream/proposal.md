## Why

Issue [#8959](https://github.com/epam/ai-dial-chat/issues/8959). When the device sleeps (laptop sleep, phone lock) during a long generation such as Deep Research, the browser's `POST /api/v1/conversations/completions` connection drops. The chat then shows "Couldn't finish this response", even though the backend keeps generating and saves the answer (`backend-owned-generation-persistence`). The answer only appears after the user switches conversations or reloads, because that is the only path that runs the existing attach/watch resume. Clicking "Try again" while the backend is still generating returns `409`.

## Problem

- `createChatStreamApi` reports a mid-stream `reader.read()` rejection as a generic `Error` (`libs/chat-hooks/src/conversation/create-chat-stream-api.ts:262`).
- `useConversationStream`'s `onError` handles that error the same way as a terminal failure (`libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts:475-529`). It drops the live buffer, clears the streaming state and writes `streamErrorMessage: ''`, which makes the host render the error banner. It never asks the server whether the generation is still running.
- `resumeIfAwaitingGeneration` already reattaches correctly (`libs/chat-hooks/src/conversation/useConversationStream/generation-resume.ts:171-381`), but only `loadConversation` calls it (`apps/chat/src/pages/Conversation/Conversation.tsx:479-481`).
- A socket that is silently dead after a wake-up may never reject. The reader then hangs with no timeout.
- `/completions` sends no SSE keepalive, while `/completions/attach` and `/watch` send one every 15 s (`apps/chat-api/src/conversations/conversation.controller.ts:529-531`, `:604-608`). That leaves the client nothing to measure liveness against, and intermediaries can idle-close a quiet Deep Research "Thinking" phase.

## What Changes

- **Typed interruption.** `createChatStreamApi` reports a network-level failure as a new exported `StreamInterruptedError`. This covers a rejected `fetch` and a rejected `reader.read()` after a 2xx response. HTTP status errors, `GenerationConflictError`, `GenerationPersistenceError` and `StreamUpstreamError` are unchanged.
- **Idle watchdog.** Once a 2xx response is open, `createChatStreamApi` tracks the time of the last received byte, keepalive comments included. After `idleTimeoutMs` (default 45 s, three keepalive intervals) with no byte, it cancels the reader and reports `StreamInterruptedError`. It checks that deadline immediately on `visibilitychange` (to `visible`), `online` and `pageshow`, so a wake-up is noticed without waiting for a throttled timer.
- **Recovery instead of banner.** When `useConversationStream` receives `StreamInterruptedError` for a generation that is not superseded:
  - It keeps the path streaming and the partial message visible. It re-fetches the conversation with a bounded retry that also retries on `online`.
  - If the server copy still ends in this generation's placeholder, it hands over to the existing resume flow: attach, with watch as the fallback.
  - If the generation has already finished, it applies the saved conversation.
  - It shows the banner only if recovery cannot resolve.
  - Stop stays available during recovery, because the hook still knows the `generationId`.
- **Completion keepalive.** `POST /api/v1/conversations/completions` writes `: keepalive` every 15 s while the response is `Streaming`. The timer is cleared on every exit path.

## Non-goals

- Treating a clean end of stream without `[DONE]` as an interruption. The client does not reliably receive `[DONE]` today (the Responses adapter normalizes chunks), so that stays on the existing `onComplete` reload path.
- Retrying a completion whose request never reached the backend. If the server copy shows no placeholder for this turn, the banner is shown as today.
- Cross-replica attach. The in-memory registry is unchanged, and watch remains the fallback.
- Responses API background mode or `response.id` polling (`docs/responses-api-integration.md` "Not yet supported").
- New UI, copy or i18n keys.

## Alternatives considered

1. **Baseline: auto-reload the conversation on `visibilitychange`.** Rejected. It only covers visible tabs, reloads even when the stream is healthy, and still leaves `onError` showing the banner first.
2. **Recovery in the host (`Conversation.tsx`) through `onStreamError`.** Rejected. The buffer, the supersede checks and resume are private to the hook, so the host would have to duplicate that state machine. Every other chat-hooks consumer would also stay broken.
3. **Recovery in the hook with a typed error from the transport (chosen).** It reuses the tested `resumeIfAwaitingGeneration`. Detection stays in the transport, which owns the bytes, and the hook only reacts to a typed error. It is additive: a custom transport that never emits `StreamInterruptedError` behaves as before.
4. **Responses API `background: true` plus polling by response id.** Rejected for this fix. Core GET/CANCEL are not integrated, and it would not cover Chat Completions deployments.

## Capabilities

### New Capabilities

- `generation-stream-recovery`: client-side recovery of a live generation whose completion stream was interrupted. It covers interruption detection (typed error plus idle watchdog with wake-up triggers), the server re-check with bounded retry, the handover to attach/watch resume, Stop during recovery, and the banner fallback.

### Modified Capabilities

- `chat-hooks-conversation-stream`: `onError` no longer settles a `StreamInterruptedError` as a failure. It enters recovery, and the transport contract gains `StreamInterruptedError`.
- `backend-owned-generation-persistence`: `POST /conversations/completions` gains a periodic SSE keepalive while streaming.

## Acceptance criteria

- **Issue scenario.** Sleep the device mid-Deep-Research and wake it while the backend is still generating. The message keeps its partial content and a typing indicator, then continues through attach with no error banner. The final answer matches the persisted one.
- **Wake after finish.** Wake after the backend has already finished. The saved answer is shown with no banner and no manual reload.
- **Network still down.** Wake with the network still down. Recovery waits for `online` or retries within its bound. If it cannot resolve, the banner is shown as today.
- **Stop during recovery.** Stop works during recovery. After the backend confirms, the stopped partial is shown.
- **Silent hang.** A connection that hangs with no rejection is detected within `idleTimeoutMs` of the last byte, or immediately on wake when the deadline has already passed.
- **Unchanged errors.** Conflict (`409`), persistence and upstream errors behave exactly as today.
- **Keepalive.** `/completions` emits `: keepalive` every 15 s. It writes nothing after `ClientClosed`/`BackpressureDetached`, and no timer outlives the handler.
- `nx test`/`lint` pass for `chat-hooks`, `chat` and `chat-api`, and `npm run validate:docs` passes.

## Impact

- **`libs/chat-hooks`:**
  - `create-chat-stream-api.ts`: `StreamInterruptedError`, the idle watchdog, and an optional `idleTimeoutMs` dep.
  - `useConversationStream.ts`: the recovery branch in `onError`.
  - `generation-resume.ts`: the resume factory accepts an optional settle callback, which is internal and leaves the public `resumeIfAwaitingGeneration(id, conversation)` signature unchanged.
  - `src/index.ts` exports `StreamInterruptedError`, and the README documents it.
  - Scope note: this is a shared lib. The change uses only standard DOM events (`visibilitychange`, `online`, `pageshow`) and the injected transport. It adds no host knowledge such as routes, auth or flags. Paths and CSRF still come from the host through `CreateChatStreamApiDeps`.
- **`apps/chat`:**
  - No new wiring, since `server-api/chat-stream.api.ts` already uses `createChatStreamApi`.
  - `logConversationStreamError` still receives the raw error through `onStreamError`.
- **`apps/chat-api`:** `conversation.controller.ts` gets the keepalive timer on `streamCompletion`. There is no contract or OpenAPI change, because an SSE comment is not part of the schema.
- **Docs:** `docs/architecture.md` §SSE streaming (keepalive plus client recovery), the `libs/chat-hooks/README.md` `useConversationStream` section, and `docs/responses-api-integration.md` §Completion, Errors, and Stopping (one line on the keepalive).
- **i18n:** none. Recovery reuses the typing indicator, and the fallback reuses `chat.streamErrorTitle`/`chat.streamError`.
- **RTL / a11y:** no new markup.
- **Rollback / compatibility:** not breaking. The new error class extends `Error`, and consumers that check `instanceof Error` are unaffected. To revert, drop the recovery branch, so `StreamInterruptedError` falls through to today's banner. The keepalive is an SSE comment that every reader in the repo already ignores (`docs/architecture.md` §SSE streaming). Frontend and BFF ship together. A frontend running against a BFF without the keepalive can see a spurious idle interruption during a silent phase longer than 45 s, but recovery then reattaches losslessly.
