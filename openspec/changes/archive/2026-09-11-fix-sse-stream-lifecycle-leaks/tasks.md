## 1. Shared SSE backpressure helper

- [x] 1.1 In `apps/chat-api/src/common/utils/sse.ts`, add `writeSseChunk(res, chunk)` returning `{ written, needsDrain }`, and `waitForDrain(res, signal, timeoutMs)` returning `'drained' | 'timeout' | 'aborted'`, per design.md Decision 3. Ensure `waitForDrain` always removes its own `'drain'`/`abort`/timer listeners before resolving, on every branch.
- [x] 1.2 Add `SSE_DRAIN_TIMEOUT_MS = 5000`, `SSE_COMPLETION_MAX_BUFFERED_BYTES = 1024 * 1024`, and `SSE_ATTACH_MAX_BUFFERED_BYTES = 1024 * 1024` as exported constants alongside the helper (or in the domain files that use them, matching the existing `SSE_KEEPALIVE_INTERVAL_MS` placement pattern).
- [x] 1.3 Add `apps/chat-api/src/common/utils/tests/sse.spec.ts` covering: `writeSseChunk` reports `needsDrain: true` when the underlying `Writable` returns `false`; `waitForDrain` resolves `'drained'` on a real `'drain'` event, `'aborted'` when the signal fires first, and `'timeout'` when neither happens within the timeout — use a real Node `Writable` with a small `highWaterMark` and manually withheld reads to force backpressure, not a mocked boolean return.

## 2. Client-channel subscribe: early-close + backpressure

- [x] 2.1 In `client-channel.controller.ts`'s `subscribe`, move `new AbortController()` and `res.on('close', handleClose)` registration to before `await this.clientChannelService.subscribe(...)`, so `handleClose` exists and can abort during that await. Keep `trackSseSubscription` counting from the same point it does today.
- [x] 2.2 Replace the relay loop's raw `res.write(value)` with `writeSseChunk`; on `needsDrain`, `await waitForDrain(res, abortController.signal, SSE_DRAIN_TIMEOUT_MS)` before the next `reader.read()`. On `'timeout'`, treat it as a disconnect: set `isClientAborted = true`, cancel the reader, end the response.
- [x] 2.3 Update `apps/chat-api/src/client-channel/tests/client-channel.controller.spec.ts` (or create it if it does not yet cover this): a disconnect fired while `clientChannelService.subscribe` is still pending aborts that call's signal and never starts a reader; a slow `Writable` that never drains is closed after the timeout with the upstream reader cancelled.
- [x] 2.4 Extend `apps/chat-api/src/telemetry/tests/sse-subscription-metrics.spec.ts`'s `client_channel` cases: an early close during pending setup now results in the upstream call actually receiving an aborted signal (not just the gauge staying at 1), and the gauge still returns to 0 exactly once.

## 3. Conversation watch: signal plumbing + early-close + backpressure

- [x] 3.1 Add a `signal: AbortSignal` parameter to `ConversationStreamingService.watchConversation` and pass it to `this.dialClient.client.subscribeToResources({ ..., signal })`. Confirm `ConversationService.watchConversation` needs no edit (bound property re-export).
- [x] 3.2 In `conversation.controller.ts`'s `watchConversation`, construct the `AbortController` and register `res.on('close', handleClose)` before calling `this.conversationService.watchConversation(dto.path, at, bucket, abortController.signal)`; keep `trackSseSubscription` counting from the same point.
- [x] 3.3 Replace the relay loop's `res.write(value)` and the keepalive `res.write(SSE_KEEPALIVE_PAYLOAD)` with `writeSseChunk`; on `needsDrain` from the main relay write, `await waitForDrain(...)` bounded by `abortController.signal` and `SSE_DRAIN_TIMEOUT_MS` before the next `reader.read()`, same timeout-as-disconnect handling as client-channel. Keepalive writes only need the `written` check (skip when already detached), not a drain wait.
- [x] 3.4 Add/extend `apps/chat-api/src/conversations/tests/conversation.controller.spec.ts` (or the relevant streaming test file) with: `subscribeToResources` receives the propagated signal and observes it aborting on early close; a stalled watch connection is closed after the drain timeout with the keepalive timer cleared and the reader cancelled.
- [x] 3.5 Extend `sse-subscription-metrics.spec.ts`'s `conversation_watch` cases the same way as task 2.4.

## 4. Completion delivery: bounded backpressure without pausing generation

- [x] 4.1 In `conversation.controller.ts`'s `streamCompletion`, replace `res.write(chunk)` with `writeSseChunk`; immediately after, if `res.writableLength > SSE_COMPLETION_MAX_BUFFERED_BYTES`, set `isResponseDetached = true` (reusing the existing flag/finally cleanup — no new code path). Do not await drain here — the generator loop must keep running regardless of the response's write speed.
- [x] 4.2 Add a test (in `apps/chat-api/src/conversations/tests/`, alongside `completions.integration.spec.ts`) using a real `Writable`-backed mock response with a small `highWaterMark`: feed chunks fast enough to exceed `SSE_COMPLETION_MAX_BUFFERED_BYTES`, assert the response stops receiving further writes (detached) while the generator is driven to completion and `finalize()` still persists the full assembled message — mirroring the existing "closed response" persistence assertions in that spec.
- [x] 4.3 Add a regression test for the existing "closed downstream response" scenarios (disconnect before/around `onReadyToStream`, disconnect mid-stream) to confirm they still pass unchanged after the `writeSseChunk` swap — this is a refactor-safety check, not new behavior.

## 5. Generation attach: bounded backpressure per subscriber

- [x] 5.1 In `conversation.controller.ts`'s `attachToGeneration`, replace both `writeEvent`'s `res.write(...)` call and the keepalive `res.write(SSE_KEEPALIVE_PAYLOAD)` with `writeSseChunk`. After each event write (snapshot, chunk, terminal), if `res.writableLength > SSE_ATTACH_MAX_BUFFERED_BYTES`, call the existing `cleanup()` instead of continuing to write to that subscriber.
- [x] 5.2 Verify `cleanup()`'s idempotency guard (`isCleanedUp`) correctly short-circuits when backpressure-triggered cleanup races with a `terminal` event or a `close` event arriving around the same time — add a test forcing that race (emit `terminal` and trigger the buffered-bytes threshold in the same tick) and assert listeners are removed exactly once and `finishSubscription()` runs exactly once.
- [x] 5.3 Add a test with two concurrent attach subscribers on the same generation (mirroring `generation-live-replay`'s existing "two concurrent subscribers" scenario): one has a real slow `Writable` that exceeds the byte limit and gets detached, the other keeps draining normally and receives every chunk plus the terminal event — confirms detaching one subscriber never affects another or the generation.
- [x] 5.4 Extend `sse-subscription-metrics.spec.ts`'s `generation attachment` describe block with a case asserting the gauge returns to 0 when a subscriber is detached for backpressure (not just on `close`/terminal).

## 6. Cross-cutting verification

- [x] 6.1 Run `npm exec nx test chat-api` and confirm all new and existing specs pass, including `runtime-metrics.spec.ts`, `sse-subscription-metrics.spec.ts`, `conversation-generation.service.spec.ts`, and `completions.integration.spec.ts`.
- [x] 6.2 Run `npm exec nx lint chat-api` and fix any findings.
- [x] 6.3 Run `npm exec nx build chat-api` to confirm the Nest bundle still starts cleanly with the new shared helper.
- [ ] 6.4 Manually verify via `npm run start:api` + `npm start`: open a conversation, start a completion, and close the tab mid-stream — confirm (via logs or a debugger) that the generation still completes and persists, matching `backend-owned-generation-persistence`'s existing manual-check precedent.
- [x] 6.5 Update `apps/chat-api/README.md`'s SSE-handling section (if present) to document the drain-timeout and buffered-bytes constants and which handlers use which, then run `npm run validate:docs`.
- [x] 6.6 Run `npm run openapi:check` to confirm no accidental OpenAPI drift (no DTO/endpoint shape changed in this work).
