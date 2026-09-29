Slicing strategy: **risk-first, then vertical**. Slice 1 (backend keepalive) and slice 2 (typed interruption + watchdog) are each independently shippable and safe on their own — alone they only change which bytes flow or which error class reaches today's banner path. Slices 3–4 build recovery on top and are verified end to end in the hook tests. Docs close the change.

## 1. Backend: SSE keepalive on `/completions`

- [x] 1.1 In `apps/chat-api/src/conversations/conversation.controller.ts` `streamCompletion`, wrap the `() => startSseResponse(res)` callback so it also starts a `setInterval(SSE_KEEPALIVE_INTERVAL_MS)` that writes `SSE_KEEPALIVE_PAYLOAD` only when `responseState === SseResponseState.Streaming` and the last written byte was `\n`. Track the boundary with a boolean updated after each chunk write (string: `endsWith('\n')`; `Uint8Array`: last byte `=== 0x0a`); `startSseResponse`'s `: init\n\n` counts as a boundary. Run the keepalive write through the same `writableLength > SSE_COMPLETION_MAX_BUFFERED_BYTES` / throw → `detachForBackpressure()` handling as chunk writes. Clear the interval first in `finally`.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/tests/completion-response-lifecycle.spec.ts`
- [x] 1.2 Add tests (fake timers) next to the controller in `apps/chat-api/src/conversations/tests/completion-response-lifecycle.spec.ts`: keepalive emitted while a generation is silent; none after `ClientClosed`/`BackpressureDetached`; a tick is skipped while the last upstream slice ends mid-line; no keepalive and `409` preserved when the generator rejects before `onReadyToStream`; no interval remains after the handler returns for each outcome.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/tests/completion-response-lifecycle.spec.ts` and `npm run test:file -- apps/chat-api/src/conversations/tests/completions.integration.spec.ts`
- [x] 1.3 Slice check: `npm run verify:changed`. No OpenAPI change is expected — confirm with `npm run openapi:check`.

## 2. Transport: `StreamInterruptedError` and idle watchdog

- [x] 2.1 In `libs/chat-hooks/src/conversation/create-chat-stream-api.ts` add and export `StreamInterruptedError` (`name = 'StreamInterruptedError'`, optional `cause`) and `DEFAULT_STREAM_IDLE_TIMEOUT_MS = 45_000`; add optional `idleTimeoutMs` to `CreateChatStreamApiDeps`. Wrap non-abort `fetch` rejections and non-abort `reader.read()` rejections after a 2xx response in `StreamInterruptedError`; leave HTTP-status, missing-body, in-band, and abort paths unchanged. It is re-exported automatically through `export *` in `libs/chat-hooks/src/index.ts`.
  - Verification: `npm run test:file -- libs/chat-hooks/src/conversation/tests/create-chat-stream-api.spec.ts`
- [x] 2.2 Add the idle watchdog to the same file: record last-byte time on every `read()` value; re-armed `setTimeout(idleTimeoutMs)`; eager check on `document` `visibilitychange` (visible), `window` `online` and `pageshow`, guarded by `typeof window/document !== 'undefined'`. On stall: set a local `settled` flag, `reader.cancel()`, call `onError(new StreamInterruptedError())` once, and ignore the cancelled reader's subsequent resolution/rejection. Never abort the caller's `signal`. Remove listeners/timer on every settle path including caller abort. Guarantee at most one of `onComplete`/`onError` per call.
  - Verification: `npm run test:file -- libs/chat-hooks/src/conversation/tests/create-chat-stream-api.spec.ts`
- [x] 2.3 Unit tests in `libs/chat-hooks/src/conversation/tests/create-chat-stream-api.spec.ts` (fake timers, stubbed `fetch` with a controllable `ReadableStream`): mid-read rejection → one `StreamInterruptedError` with `cause`; `fetch` rejection → `StreamInterruptedError`; `502` is not one; caller abort is silent; silence for `idleTimeoutMs` → interruption; keepalive comments keep it alive; `visibilitychange` past the deadline interrupts synchronously and before the deadline does not; listeners removed after complete/error/abort; `onComplete` never follows an interruption.
  - Verification: `npm run test:file -- libs/chat-hooks/src/conversation/tests/create-chat-stream-api.spec.ts`
- [x] 2.4 Update existing hook assertions that relied on the built-in transport surfacing a raw `TypeError` (if any) in `libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts` — until slice 4 lands, `StreamInterruptedError` must still reach the `streamErrorMessage: ''` path.
  - Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts`
- [x] 2.5 Slice check: `npm run verify:changed`.

## 3. Resume: internal entry point with seed, settle callback, dedupe bypass

- [x] 3.1 In `libs/chat-hooks/src/conversation/useConversationStream/generation-resume.ts` refactor `createResumeIfAwaitingGeneration` so its closure body is reachable through an internal variant taking `{ seedMessage?: Message; onSettled?: () => void; skipDedupe?: boolean }`. `seedMessage` initializes `resumedBuffer.message`; `onSettled` fires exactly once after `finish()` or when `ownsBuffer()` is lost; `skipDedupe` bypasses the `resumingPathsRef.has` early-return (still deletes the entry on finish). Keep the public `resumeIfAwaitingGeneration(id, conversation)` signature and behavior unchanged (calls the variant with no options). Do not export the variant from `src/index.ts`.
  - Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/generation-resume.spec.ts`
- [x] 3.2 Tests in `libs/chat-hooks/src/conversation/useConversationStream/tests/generation-resume.spec.ts`: seeded buffer is what `restoreBufferedGeneration` shows before the snapshot; `onSettled` fires once for done/error/stopped/watch-timeout/ownership-lost; `skipDedupe` resumes when the path is already in `resumingPathsRef`; existing public-path tests still pass unchanged.
  - Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/generation-resume.spec.ts`

## 4. Hook: recovery on `StreamInterruptedError`

- [x] 4.1 In `libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts` `startStream`'s `onError`: after `onStreamError`, if the error is a `StreamInterruptedError` and the generation is not superseded, enter recovery instead of settling — keep the streaming path, buffer, `activeGenerationIdRef`/`activeGenerationPathRef`/`stoppablePath`; add the path to `resumingPathsRef`; run the bounded re-fetch (`RECOVERY_REFETCH_DELAYS_MS = [1000, 2000, 4000, 8000, 16000]`, `online` skips the pending delay, listener/timer removed when done); classify per `generation-stream-recovery` (still generating → internal resume with `seedMessage` = buffered message, `skipDedupe`, `onSettled`; finished → apply as `onComplete` does; otherwise → existing banner path). Factor the shared settlement bookkeeping (`removeStreamingPath`, active/stoppable refs, `completeGeneration`, `notifyGenerationSettled`, `notifyGenerationEnd` unless stopped) into one local helper used by the error, complete, and recovery paths, without changing their behavior. Abort recovery silently if superseded at any await point.
  - Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts`
- [x] 4.2 Wire the internal resume variant into the hook (a second `useMemo` alongside `resumeIfAwaitingGeneration`, same dependency list) so recovery and the public API share one factory instance of state. Keep `startStream`'s `useCallback` deps complete.
  - Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts`
- [x] 4.3 Hook tests in `libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts` with a fake transport: interruption + server placeholder → no `streamErrorMessage`, `isStreaming` stays true, `attachToGeneration` called, snapshot/chunk update the message; interruption + finished server copy → state replaced, `isStreaming` false; rejections then success within backoff (incl. `online` shortcut) → recovers; all rejections or no assistant at `messageIndex` → `streamErrorMessage: ''` and streaming cleared; concurrent `resumeIfAwaitingGeneration` during recovery is a no-op; superseded generation makes no fetch; Stop during recovery calls `stopCompletion` with the original id, settles on `stopped`, and skips `notifyGenerationEnd`; conflict/persistence/upstream errors unchanged; `onStreamError` called exactly once per interruption.
  - Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts`
- [x] 4.4 Architecture guard for `libs/chat-hooks`: confirm the diff adds no `/api` path, generated-client instance, `server-api` import, app context, auth/session/env access, feature flag, routing, i18n, or logging transport — only DOM-standard `window`/`document` events and the injected transport. Relative imports stay extensionless.
- [x] 4.5 Slice check: `npm run verify:changed`.

## 5. Docs

- [x] 5.1 `libs/chat-hooks/README.md` `useConversationStream` / `createChatStreamApi` sections: document `StreamInterruptedError`, `DEFAULT_STREAM_IDLE_TIMEOUT_MS`, the `idleTimeoutMs` dep, and the recovery behavior on interruption (update the `onStreamError` row accordingly). Every code fence must match the exported names.
- [x] 5.2 `docs/architecture.md` §SSE streaming: `/completions` now sends `: keepalive`; the client watchdog and interruption recovery (summary + link to the specs). `docs/responses-api-integration.md` §Completion, Errors, and Stopping: one line noting the completion keepalive and that a dropped client reattaches via attach/watch.
- [x] 5.3 Run `npm run validate:docs`.

## 6. Close

- [x] 6.1 Run `npm run verify:full` once.

## Follow-ups (out of scope)

- [ ] F.1 Treat a clean EOF without a terminal marker as an interruption — requires the BFF to guarantee a client-facing terminal marker for both the Chat Completions and Responses adapters.
- [ ] F.2 Cross-replica attach (shared generation registry) so recovery on another BFF replica gets progressive chunks instead of the watch fallback.
