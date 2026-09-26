## 1. Failing tests first (red)

- [x] 1.1 In `apps/chat-api/src/conversations/tests/completions.integration.spec.ts`, extend the existing "detaches the response once buffered output exceeds SSE_COMPLETION_MAX_BUFFERED_BYTES" case (line ~431) with the lifecycle assertions it is missing: after the handler resolves, assert `writableEnded === true` and that `writableLength` no longer holds the full backlog. It must fail on current code with `writableEnded === false` and `writableLength === 1048584`.
- [x] 1.2 Add `apps/chat-api/src/conversations/tests/completion-response-lifecycle.spec.ts` covering, against a real `stream.Writable` (`highWaterMark: 1024`) driving the real controller with a mocked `ConversationService`/`ConversationGenerationService`:
      (a) no further `write` calls after the threshold is crossed;
      (b) the generator reaches its natural end (`reachedNaturalEnd`) and the mocked terminal save ran before the response was released;
      (c) `generationService.abort` was never called;
      (d) the response is terminal — `writableEnded === true`, and `destroyed === true` only when the timeout fallback fired;
      (e) a client that stays under the threshold is never detached and is ended exactly once;
      (f) an actual `res.emit('close')` mid-stream still drains the generator and results in no `end`/`destroy`/`write` call against the closed response.
      Use fake timers for the `SSE_RELEASE_TIMEOUT_MS` branches so the suite does not wait 15s.
- [x] 1.3 Add a real-HTTP case to the same new spec: `http.createServer` mounting the handler (or a minimal Nest app as `completions.integration.spec.ts` already does), plus a `net.Socket` client that sends the request and never reads. Assert the pre-fix fingerprint is gone: after release, `res.writableEnded === true`, and after the destroy fallback `res.writableLength === 0` and `res.destroyed === true`. This is the case a hand-rolled fake cannot express, because a plain `Writable` does not zero `writableLength` on destroy while a real `ServerResponse` does.
- [x] 1.4 Add `releaseSseResponse` cases to `apps/chat-api/src/common/utils/tests/sse.spec.ts`: already-terminal input is untouched; `end()` then `'finish'` within the bound resolves `'ended'` without destroying; a stalled writable resolves `'destroyed'` after the bound; `'close'` mid-wait resolves `'ended'`; listeners and the timer are removed on every branch (assert `listenerCount('finish')`/`listenerCount('close')` return to their pre-call values); a double call is safe.
- [x] 1.5 Extend `apps/chat-api/src/conversations/tests/attach-generation-backpressure.spec.ts` so the slow subscriber's fake response also models `destroy()`/`writableFinished`, asserting the detached subscriber reaches a terminal state and that a second `cleanup()` neither re-ends nor re-destroys it. The existing assertions (fast subscriber unaffected, detached subscriber gets no terminal event, `end` called once) must keep passing unchanged.

## 2. Shared release helper

- [x] 2.1 In `apps/chat-api/src/common/utils/sse.ts`, add the `SseResponseState` string enum (`Streaming`, `ClientClosed`, `BackpressureDetached`, `Completed`) with a JSDoc line per member stating the cleanup obligation.
- [x] 2.2 Add `SSE_RELEASE_TIMEOUT_MS = 15_000` with a JSDoc comment recording why (≈1 MiB flushed at ≈560 kbit/s; same order as `SSE_KEEPALIVE_INTERVAL_MS`; internal constant, not an env var).
- [x] 2.3 Implement `releaseSseResponse(res, timeoutMs = SSE_RELEASE_TIMEOUT_MS): Promise<'already-terminal' | 'ended' | 'destroyed'>` per design D2 — early return when `writableFinished || destroyed`, `res.end()` with no extra SSE frame, race `'finish'`/`'close'`/timeout, `res.destroy()` on timeout only. Reuse `waitForDrain`'s single-`isSettled` + one-`cleanup()` shape so no branch leaks a listener or timer.
- [x] 2.4 Run `npm run test:file -- apps/chat-api/src/common/utils/tests/sse.spec.ts` — task 1.4 goes green.

## 3. Termination counter

- [x] 3.1 Add `apps/chat-api/src/conversations/streaming/completion-response-metrics.ts` following `conversations/generation/generation-metrics.ts`: module-level `meter.createCounter('dial.chat.completion.response.terminations', { unit: '{response}' })` plus the `CompletionResponseTermination` string enum (`completed`, `client_closed`, `backpressure_ended`, `backpressure_destroyed`). Comment why no gauge and no `writableLength` aggregate exist (instrumentation must not retain a `Response`, per `runtime-metrics.ts`).
- [x] 3.2 Add a unit spec asserting exactly one point per response and the four bounded `reason` values, mirroring how `apps/chat-api/src/telemetry/tests/` specs assert recorded attributes.

## 4. Completion handler state machine

- [x] 4.1 In `ConversationController.streamCompletion`, replace `let isResponseDetached = false` with `let state: SseResponseState = SseResponseState.Streaming`; `handleClose` sets `ClientClosed` unconditionally; the write guard becomes `if (state !== SseResponseState.Streaming) continue;` — keep `continue`, never `break`/`return`.
- [x] 4.2 Set `BackpressureDetached` (only when `state === Streaming`) both on `res.writableLength > SSE_COMPLETION_MAX_BUFFERED_BYTES` and in the `catch` around the write, and update the block comment above the loop so it states the two distinct facts instead of the current single-flag explanation.
- [x] 4.3 Rewrite the `finally` cleanup per design D4: `BackpressureDetached` → `await releaseSseResponse(...)` and count `backpressure_ended`/`backpressure_destroyed`; `Streaming` and not `hasFailedBeforeStreamOpened` and not `writableEnded` → `res.end()`, set `Completed`, count `completed`; `ClientClosed` → count `client_closed` and touch nothing. Leave `hasFailedBeforeStreamOpened` precedence exactly as it is — the issue-#8688 path must stay intact.
- [x] 4.4 Run `npm run test:file -- apps/chat-api/src/conversations/tests/completions.integration.spec.ts` and `npm run test:file -- apps/chat-api/src/conversations/tests/completion-response-lifecycle.spec.ts` — tasks 1.1-1.3 go green. Confirm the pre-existing disconnect tests ("keeps draining the generator to completion…", the 409 pre-stream case) still pass untouched.

## 5. Attach path parity

- [x] 5.1 In `attachToGeneration`'s `cleanup()`, replace `if (!res.writableEnded) res.end()` with a fire-and-forget `void releaseSseResponse(res, SSE_RELEASE_TIMEOUT_MS)` (no `await` — `cleanup()` is called from synchronous emitter callbacks), keeping the existing `isCleanedUp` idempotence guard as the single entry gate.
- [x] 5.2 Run `npm run test:file -- apps/chat-api/src/conversations/tests/attach-generation-backpressure.spec.ts` and `npm run test:file -- apps/chat-api/src/conversations/tests/attach-generation.integration.spec.ts`, plus `npm run test:file -- apps/chat-api/src/telemetry/tests/sse-subscription-metrics.spec.ts` (it asserts gauge release on attach backpressure) — no regression.

## 6. Docs

- [x] 6.1 Update `apps/chat-api/README.md`'s "SSE stream lifecycle" bullet for `conversations/completions` / `completions/attach` (currently "marking it detached / running its existing cleanup"): describe the four states, the graceful-end-then-bounded-destroy release, and `SSE_RELEASE_TIMEOUT_MS`.
- [x] 6.2 Add `dial.chat.completion.response.terminations` to that README's OpenTelemetry instrument table with its four `reason` values, and state that completion delivery still does not contribute to `dial_chat_sse_active`.
- [x] 6.3 Confirm no `docs/architecture.md` edit is needed (its SSE section documents `startSseResponse` framing, not the detach lifecycle) and record that conclusion in the PR description rather than editing the doc. Do not touch anything under `openspec/changes/archive/`.

## 7. Verification

- [ ] 7.1 `npm exec nx lint chat-api` and `npm run verify:changed`. **Blocked, not by this change:** lint is clean (0 errors), `lint:affected` and `test:changed` pass, and `typecheck` reports no error from this change — but `verify:changed` exits non-zero on two pre-existing errors in `apps/chat-api/src/auth/tests/auth-metrics.spec.ts` (TS2322/TS18046, landed in `aa6e73274`, reproduced on a clean stashed tree). Left untouched by decision; whoever fixes that spec unblocks this checkbox.
- [x] 7.2 `npm run validate:docs` (README was touched).
- [ ] 7.3 Manual check per design "Local validation" step 7: start a long completion, stall the reading client past 1 MiB, and confirm RSS returns to baseline and the request leaves `dial_chat_http_requests_active`. **Not performed:** needs an interactive OIDC login (the endpoint answers `401` without a session) and a single model answer over 1 MiB, neither available in this environment. What was verified instead: `build:affected` passes, and the patched build boots and serves in a real Nest process (`/api/health` → 200). The real-`http.Server` case in `completion-response-lifecycle.spec.ts` covers the Node-level mechanism (4 MiB buffered → `writableLength` 0 after the bounded release).
- [x] 7.4 Re-run the reproduction from the proposal against the patched controller and paste the before/after `{ writableLength, writableEnded, destroyed }` triples into the PR description as the evidence for the fix.
