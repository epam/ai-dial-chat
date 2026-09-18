## Why

`ConversationController.streamCompletion` uses one boolean, `isResponseDetached`, for two
different facts: "the browser closed the connection" (`res.on('close')`) and "the browser is
still connected but buffered more than `SSE_COMPLETION_MAX_BUFFERED_BYTES`". Because the
handler's `finally` skips `res.end()` whenever that flag is set, a slow-client response is
never terminated: the handler returns, the generation finishes and persists, and a still-open
HTTP response keeps ≥1 MiB of buffered bytes alive with no code path left that will ever end
or destroy it.

Reproduced on current `development` (`aa6e73274`) by driving the real controller against a
real Node `Writable` whose `_write` never calls back:

```
{ reachedNaturalEnd: true, persisted: true, writableLength: 1048584,
  writableEnded: false, writableFinished: false, destroyed: false, abortCalled: 0 }
```

Two consequences, both production-relevant:

- **Memory.** Nothing releases those bytes. The response is not in `dial_chat_sse_active`
  (the `observability-telemetry` spec explicitly excludes completion delivery) and not in
  `dial_chat_generations_active` (the registry entry is released by the terminal save), so
  today's stable gauges cannot attribute the growth.
- **A stuck client.** `create-chat-stream-api.ts` only calls `onComplete()` when
  `reader.read()` reports `done`. A response that never ends means the tab stays in a
  streaming state indefinitely, even though the complete answer is already persisted.

A separate verification against a real `http.ServerResponse` and a socket that never reads
shows `res.end()` alone is not sufficient to reclaim the bytes — it sets
`writableEnded = true` but leaves `writableFinished = false` and `writableLength` unchanged
(4 195 397 B) indefinitely; only `res.destroy()` drops them to 0. So the fix needs a graceful
end **and** a bounded fallback, not one or the other.

## What Changes

- Replace the overloaded `isResponseDetached` boolean in `streamCompletion` with an explicit
  four-state lifecycle (`Streaming`, `ClientClosed`, `BackpressureDetached`, `Completed`), so
  the `finally` block can act differently on "the client is gone" and "the client is slow".
- On backpressure detachment: stop writing SSE chunks to that response, keep consuming the
  generator to its natural terminal outcome, then **release the response** — `res.end()`
  first, and `res.destroy()` only if `'finish'`/`'close'` has not fired within a bounded
  `SSE_RELEASE_TIMEOUT_MS`. A client-closed response is still left alone (Node already
  destroyed it); a normally completed response still ends exactly as today.
- Add one shared helper, `releaseSseResponse(res, timeoutMs)`, to
  `apps/chat-api/src/common/utils/sse.ts`, and use it from the completion path and from
  `attachToGeneration`'s existing `cleanup()` — attach already calls `res.end()`, so it has
  the observable terminal state but the same unreclaimed-buffer residue.
- Add one bounded counter, `dial.chat.completion.response.terminations`, with a fixed
  four-value `reason` attribute, so "detached for backpressure" and "had to be destroyed"
  are distinguishable in production instead of being inferred from a memory curve.
- **No change** to generation or persistence ownership, SSE framing, auth, DTOs, OpenAPI, or
  the frontend. The generator's terminal save has already run by the time the controller's
  `finally` executes, so releasing the response cannot alter it.

## Capabilities

### New Capabilities

(none — this fixes a resource-lifecycle defect in an existing endpoint; no new endpoint,
event, or externally observable capability is introduced)

### Modified Capabilities

- `backend-owned-generation-persistence`: the requirement "A closed downstream response does
  not alter generation persistence or outcome" currently *mandates* the defect — it says a
  backpressured response SHALL set "the same `isResponseDetached` flag used for a closed
  connection" and "stop calling `res.write`/`res.end` against it". That is replaced by
  separate closed/slow states, a required terminal state for the slow case, and the new
  termination counter.
- `generation-live-replay`: the attach-subscriber backpressure requirement gains the same
  bounded-release obligation (graceful `end()`, bounded `destroy()` fallback) instead of a
  bare `res.end()`, and its stale parenthetical claiming `streamCompletion` "has no
  client-disconnect handling" is corrected — it has had a `close` listener since the flag was
  introduced; what it lacks is a *distinct* one.

`observability-telemetry` is deliberately **not** modified: the new instrument is a counter,
not a gauge, so that spec's "Ordinary completion-response delivery SHALL NOT contribute to
this SSE gauge" stays true, and the existing per-domain counters in
`conversations/generation/generation-metrics.ts` set the precedent that domain counters are
specified by their own capability.

## Impact

- **Code**: `apps/chat-api/src/conversations/conversation.controller.ts` (the state machine
  and both call sites), `apps/chat-api/src/common/utils/sse.ts` (`SseResponseState`,
  `SSE_RELEASE_TIMEOUT_MS`, `releaseSseResponse`), and one new small metrics module for the
  termination counter.
- **Tests**: `apps/chat-api/src/conversations/tests/completions.integration.spec.ts` (the
  existing backpressure test asserts only generator completion and write count — it must also
  assert the response's terminal state), `apps/chat-api/src/common/utils/tests/sse.spec.ts`
  (the new helper), `apps/chat-api/src/conversations/tests/attach-generation-backpressure.spec.ts`
  (regression), plus one new real-`http.Server` test so the lifecycle is validated against
  actual Node semantics rather than a fake.
- **Docs**: `apps/chat-api/README.md` — the "SSE stream lifecycle" bullets (which currently
  describe the single-flag behavior) and the metrics table. `docs/architecture.md` needs no
  change; its SSE section documents `startSseResponse` framing, not the detach lifecycle.
- **No** DTO, OpenAPI, env-var, frontend, or persisted-state change. Rollback is a plain
  revert.
