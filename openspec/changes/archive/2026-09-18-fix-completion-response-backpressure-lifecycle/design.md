## Context

### Summary

`POST /api/v1/conversations/completions` relays a backend-owned generation to the browser as
SSE. When the browser buffers too much, the handler stops writing — and then leaves the HTTP
response permanently open, because the same flag that means "stop writing" also means "the
client already closed, so there is nothing to end". The generation and its persistence are
unaffected (by design), but the downstream response never reaches a terminal state: on a real
`http.ServerResponse` the buffered megabyte stays resident and the browser's `fetch` stream
never reports `done`.

### Current behavior (verified against `development` @ `aa6e73274`)

`ConversationController.streamCompletion`
([conversation.controller.ts:266-341](../../../apps/chat-api/src/conversations/conversation.controller.ts#L266-L341)):

```ts
let isResponseDetached = false;
const handleClose = () => { isResponseDetached = true; };   // fact A: client is gone
res.on('close', handleClose);
...
for await (const chunk of stream) {
  if (isResponseDetached) continue;
  try {
    writeSseChunk(res, chunk);
    if (res.writableLength > SSE_COMPLETION_MAX_BUFFERED_BYTES) {
      isResponseDetached = true;                            // fact B: client is slow
    }
  } catch { isResponseDetached = true; }                    // fact C: write threw
} ...
} finally {
  res.off('close', handleClose);
  const shouldEndResponse =
    !hasFailedBeforeStreamOpened && !isResponseDetached && !res.writableEnded;
  if (shouldEndResponse) res.end();                         // skipped for A, B and C alike
}
```

Facts established by reading the current code and by execution, not assumed:

| Question | Answer |
|---|---|
| Are slow-client and client-disconnect the same state? | Yes — one `boolean`, three writers (`close`, threshold, write-throw). |
| Is `res.end()` skipped after backpressure detachment? | Yes — `!isResponseDetached` is a conjunct of `shouldEndResponse`. |
| Does generation continue after detachment? | Yes. The loop `continue`s rather than `break`s, which is load-bearing: `ConversationStreamingService.streamCompletion`'s `finally` aborts the `AbortController` when `relayCompletedNormally` is false, so a `break` (injecting `.return()`) would cancel the generation. |
| Does persistence still complete? | Yes, and it completes *before* the controller's `finally` — `finalize()` (`saveConversation` + registry release) is awaited inside the generator after its relay loop, so the generator only returns once persistence has settled. |
| Is `waitForDrain` involved? | No. `waitForDrain`/`SSE_DRAIN_TIMEOUT_MS` are used only by the two upstream relays (`client-channel/subscribe`, `conversations/watch`). The two generation-owning handlers deliberately never block on drain. |
| How does attach handle the same case? | Better, but not completely: `writeEvent` calls `cleanup()`, and `cleanup()` does `if (!res.writableEnded) res.end()`. It reaches a terminal marker; it does not reclaim the buffer (see D3). |
| Is there observability for a leaked response? | Only indirectly. `dial.chat.http.requests.active` stays inflated and `dial.chat.http.response.duration` never records a sample, but the active counter carries only `http.request.method` — no route — so completions cannot be isolated. `dial.chat.sse.active` excludes completion delivery by spec; `dial.chat.generations.active` has already released the entry. |
| What do existing tests cover? | `completions.integration.spec.ts:431` asserts `reachedNaturalEnd === true` and `pendingCallbacks.length < totalChunks + 1`. Both hold with the bug present. Nothing asserts `writableEnded`/`destroyed`. |

Reproduction on the unmodified controller, real `Writable` (`highWaterMark: 1024`, `_write`
never calls back), 20 × 64 KiB chunks, two extra event-loop turns after the handler resolved:

```
reachedNaturalEnd: true   persisted: true        abortCalled: 0
writableLength: 1048584   writableEnded: false   writableFinished: false   destroyed: false
```

Separately, against a real `http.createServer` and a raw socket that sends a request and never
reads (4 MiB written):

```
after writes    len=4195392  ended=false  finished=false  destroyed=false
after res.end() len=4195397  ended=true   finished=false  destroyed=false
+150ms          len=4195397  ended=true   finished=false  destroyed=false
after destroy() len=0        ended=true   finished=true   destroyed=true   ('finish' then 'close' fired here)
```

Also verified on a real `ServerResponse` after a genuine client abort: `res.end()` is safe
(no throw, no `'error'`), a second `end()` is safe, and `destroy()` after `end()` is safe.

### Problem

One boolean carries three different facts, and the only consumer that needs to tell them
apart — the cleanup in `finally` — cannot. For a closed connection, skipping `res.end()` is
correct: Node has already destroyed the response. For a slow connection it is a leak, because
the response object, its socket, and ≥1 MiB of queued chunks stay reachable with no remaining
owner: the `close` listener has just been removed, the generator has returned, and the handler
promise resolves.

`SSE_COMPLETION_MAX_BUFFERED_BYTES` was introduced to *bound* per-connection buffering
(archived change `2026-09-11-fix-sse-stream-lifecycle-leaks`, Decision 5: "Detaching for
backpressure reuses each handler's existing disconnect path exactly"). For attach that reuse
was sound, because attach's disconnect path ends the response. For completions it inverted the
intent: the bound is detected and then nothing reclaims what was already buffered.

The second empirical result above makes the shape of the fix non-obvious in one specific way:
`res.end()` is necessary but not sufficient. It marks the response terminal (`writableEnded`)
and prevents further writes, and for a client that is merely slow it eventually flushes and
fires `'finish'`. For a client that has stopped reading entirely, `'finish'` never arrives and
the bytes stay. Only `destroy()` reclaims them.

## Goals / Non-Goals

**Goals**

- Every downstream completion response reaches an observable terminal state — `writableEnded`,
  or `destroyed` when graceful termination could not complete in bounded time.
- Slow-client and client-closed become distinct, separately handled states.
- Generation and persistence behavior is bit-for-bit unchanged, including the
  `for await` … `continue` discipline that keeps the generator from being cancelled.
- Prefer graceful SSE completion; use socket destruction only as a bounded fallback.
- Make backpressure detachment and forced destruction visible in metrics.
- Tests assert the response lifecycle against real Node stream semantics, not a fake's.

**Non-Goals**

- Any change to SSE framing, event payloads, auth, DTOs, OpenAPI, or the frontend.
- Cancelling, pausing, or slowing generation on backpressure; changing what is persisted.
- Reworking `waitForDrain`, the two upstream relay loops, or `SSE_DRAIN_TIMEOUT_MS`.
- Re-tuning `SSE_COMPLETION_MAX_BUFFERED_BYTES` (1 MiB stays; the new counter is what would
  justify revisiting it later).
- Adding drain-based *re-attachment* of a recovered slow client (see D5).
- Editing the archived `2026-09-11-fix-sse-stream-lifecycle-leaks` design/proposal or any
  other archived document. Its Decision 5 is superseded by this change's delta specs, and the
  archive stays as the historical record.

## Decisions

### D1. Replace the boolean with a four-state enum

In `apps/chat-api/src/common/utils/sse.ts`:

```ts
export enum SseResponseState {
  /** Headers sent (or pending) and writes are still going to the client. */
  Streaming = 'streaming',
  /** `res.on('close')` fired — Node already destroyed the response; never touch it again. */
  ClientClosed = 'client_closed',
  /** Buffered bytes crossed the limit, or a write threw. Still open; this handler owns ending it. */
  BackpressureDetached = 'backpressure_detached',
  /** The handler ended it normally after the generator finished. */
  Completed = 'completed',
}
```

Per the repo's TypeScript-enum rule, a string enum rather than a union type. The controller
keeps one `let state: SseResponseState`, and the transition rules are:

- `res.on('close')` → `ClientClosed`, **unconditionally**. It is the strongest fact available
  (the socket is gone) and it may legitimately arrive while `BackpressureDetached`, e.g. during
  the release wait.
- threshold exceeded, or `writeSseChunk` threw → `BackpressureDetached`, **only from**
  `Streaming`. A write-throw is grouped here, not given a fifth state: the response is open as
  far as this handler knows, so it owns terminating it, which is exactly the
  `BackpressureDetached` obligation.
- normal loop exit with `state === Streaming` → `res.end()`, then `Completed`.

The write guard becomes `if (state !== SseResponseState.Streaming) continue;` — same effect as
today's flag check, and the same `continue` (never `break`, see the Invariants section).

**Alternative considered:** keep the boolean and add a second one
(`isDetachedForBackpressure`). Rejected — two booleans encode one invalid combination
(`closed && !detached` vs `detached && !closed` vs both), and the AGENTS.md enum rule exists
for precisely this "named finite set of lifecycle states" case.

### D2. `releaseSseResponse(res, timeoutMs)`: graceful end, bounded destroy

```ts
export const SSE_RELEASE_TIMEOUT_MS = 15_000;

export const releaseSseResponse = (
  res: Response,
  timeoutMs: number = SSE_RELEASE_TIMEOUT_MS,
): Promise<'already-terminal' | 'ended' | 'destroyed'> => { /* ... */ };
```

Behavior:

1. If `res.writableFinished || res.destroyed` → resolve `'already-terminal'`, touch nothing.
2. Otherwise call `res.end()` (safe even if the peer is gone — verified above). No final SSE
   event is written: the client by definition is not reading, and another frame would only grow
   the queue.
3. Wait for whichever comes first: `'finish'`, `'close'`, or `timeoutMs`. `'finish'`/`'close'`
   → `'ended'`.
4. On timeout → `res.destroy()` → `'destroyed'`.
5. Remove every listener and clear the timer on all branches, in the same shape `waitForDrain`
   already uses (single `isSettled` guard + one `cleanup()`), so repeated use cannot leak
   listeners.

`'finish'` is the right signal rather than `'drain'`: after `end()` no further writes occur, so
`'drain'` is not guaranteed, while `'finish'` fires exactly when the queue has flushed — and,
per the probe, never fires for a fully stalled client, which is what makes the timeout load-
bearing rather than defensive.

**Why 15 000 ms:** it must be long enough that a genuinely slow-but-progressing client flushes
~1 MiB (15 s ≈ 560 kbit/s of sustained throughput — below that, the connection cannot render a
streaming chat anyway) and short enough to bound retention. It matches the existing
`SSE_KEEPALIVE_INTERVAL_MS` order of magnitude and, like it, is an internal constant, not an
env var.

**Alternatives considered:**

- *`destroy()` immediately on detachment.* Rejected: converts every slow client into a
  transport error. The frontend's read loop (`create-chat-stream-api.ts`) turns an aborted body
  into `onError`, whereas a clean end becomes `onComplete` — so graceful-first is a visible UX
  difference, not only politeness.
- *`end()` with no fallback.* Rejected on the probe evidence: `writableEnded` flips but
  `writableLength` stays at 4 195 397 B indefinitely. The metric would look fixed while the
  memory was not.
- *Idle-progress deadline (reset the timer whenever `writableLength` decreases).* Attractive —
  it would never destroy a client that is still making progress — but needs a polling interval
  and its own teardown, in a critical-path handler, for a case the 15 s bound already covers.
  Recorded here as the first thing to reach for if the new `destroyed` counter turns out to be
  non-zero on healthy connections.

### D3. Apply the same release to `attachToGeneration`'s `cleanup()`

`cleanup()` currently does `if (!res.writableEnded) res.end()`. It becomes a fire-and-forget
`void releaseSseResponse(res, SSE_RELEASE_TIMEOUT_MS)` — `cleanup()` is invoked from
synchronous emitter callbacks and must stay synchronous. Same defect class, same file, one
line, and it closes the identical ≥1 MiB-per-stalled-subscriber residue. Everything the
existing attach test asserts (`end` called once, `writableEnded === true`, the detached
subscriber receives no terminal event) still holds, because step 2 of the helper is exactly the
`res.end()` it replaces.

**Alternative considered:** leave attach alone to keep the diff minimal. Rejected — a reader
comparing the two handlers after this change would otherwise find the completion path strictly
more correct than the one the archived design held up as the reference, with no recorded reason.

### D4. Awaiting the release in `finally`, only on the backpressure branch

```ts
} finally {
  res.off('close', handleClose);
  if (state === SseResponseState.BackpressureDetached) {
    const outcome = await releaseSseResponse(res, SSE_RELEASE_TIMEOUT_MS);
    completionResponseTerminations.add(1, { reason: outcome === 'destroyed'
      ? CompletionResponseTermination.BackpressureDestroyed
      : CompletionResponseTermination.BackpressureEnded });
  } else if (state === SseResponseState.Streaming && !hasFailedBeforeStreamOpened && !res.writableEnded) {
    res.end();
    state = SseResponseState.Completed;
    completionResponseTerminations.add(1, { reason: CompletionResponseTermination.Completed });
  }
  /* ClientClosed: Node already destroyed it — count it and touch nothing. */
}
```

The `await` extends the handler promise by up to 15 s **only** in the backpressure branch.
That is safe and deliberate: persistence and the registry release have already completed
inside the generator before `finally` runs (see the Context table), so nothing the await
delays can affect generation state. In exchange, the terminal state is reached before the
handler resolves, which is what makes it directly assertable in a test. `hasFailedBeforeStreamOpened`
keeps its existing precedence on the non-detached branch — the issue-#8688 path (a pre-stream
rejection must reach the exception filter with no headers sent) is untouched, and by
construction it cannot coincide with `BackpressureDetached`, which requires a successful write.

**Alternative considered:** `void releaseSseResponse(...)` fire-and-forget here too, so the
handler returns immediately. Rejected for the completion path: it makes the terminal state
observable only via polling in tests and leaves the promise unowned; the attach path takes the
fire-and-forget form because its `cleanup()` cannot be async.

### D5. A client that drains below the threshold is never released

Detachment is evaluated only immediately after a write that pushed `writableLength` past 1 MiB.
A client that buffers and drains simply never trips it — this is existing behavior and stays
unchanged; the delta spec keeps its "a well-behaved connection is never detached" scenario and
the new tests assert it explicitly. What this change does **not** add is un-detaching a client
that already crossed the threshold and then recovered: detachment stays one-way, as today. The
graceful `end()` is what makes that acceptable — a recovered client receives everything already
queued, then a clean stream end, instead of hanging forever.

### D6. One counter, no gauge

New module `apps/chat-api/src/conversations/streaming/completion-response-metrics.ts`,
following `conversations/generation/generation-metrics.ts` (module-level `meter.createCounter`,
no-op when metrics are disabled):

```ts
export enum CompletionResponseTermination {
  Completed = 'completed',
  ClientClosed = 'client_closed',
  BackpressureEnded = 'backpressure_ended',
  BackpressureDestroyed = 'backpressure_destroyed',
}

export const completionResponseTerminations = meter.createCounter(
  'dial.chat.completion.response.terminations',
  { description: '...', unit: '{response}' },
);
```

Four fixed values, no user/conversation/deployment attributes — the cardinality rule in
`observability-telemetry` ("No high-cardinality metric or span attributes") is satisfied by
construction. `backpressure_destroyed > 0` is the single alertable signal: graceful release did
not complete within the bound.

Two candidate metrics from the investigation are **deliberately not** added:

- *A gauge of currently open completion responses.* It would duplicate
  `dial.chat.http.requests.active` (which already counts an unfinished response for as long as
  it is unfinished) and, after this change, its interesting value is constant — the counter
  already says how each response ended.
- *Total/sampled `writableLength` across active responses.* This would require module-level
  instrumentation to retain `Response` objects, which `runtime-metrics.ts` explicitly forbids:
  "instrumentation never retains requests, credentials, streams, or per-user keys." The
  per-connection bound plus the destroyed-counter covers the same operational question without
  holding a reference to a live socket.

## Risks / Trade-offs

- **[Risk] Terminating a recoverable slow client too early.** → `res.end()` is attempted first
  and the client keeps receiving everything already queued; only failure to flush within 15 s
  escalates to `destroy()`. The 15 s bound is a named constant chosen against a measured
  ~1 MiB worst case, and `backpressure_destroyed` tells us if it is ever hit in practice (D2's
  idle-progress deadline is the recorded next step if so).
- **[Risk] Replacing graceful SSE completion with abrupt socket termination.** → Graceful is
  the default and the only path for `Completed` and `BackpressureEnded`. `destroy()` is reached
  only after a bounded wait on `'finish'`/`'close'`, is counted separately, and costs that one
  client a transport error on a response whose answer is already persisted and re-readable via
  `GET` or `completions/attach`. Net-vs-today it is an improvement even in the worst case: today
  that client's stream never ends at all, so its tab never leaves the streaming state.
- **[Risk] Accidentally cancelling upstream generation.** → The one way to do that is to stop
  iterating the generator: its `finally` aborts the `AbortController` whenever
  `relayCompletedNormally` is false. The loop therefore keeps `continue` (never `break`, never
  `return`) and the release happens strictly after the loop. Guarded by an explicit test that
  the generation service's `abort` is never called, and by the existing
  disconnect-keeps-draining tests.
- **[Risk] Changing persistence semantics.** → Release runs in `finally`, after the generator
  has returned; the generator only returns after awaiting `finalize()`. Nothing in the release
  path touches the persistence service or the registry. The delta spec restates the invariant
  and a test asserts the terminal save happened with `Done` before the response was released.
- **[Risk] Cleanup races (client closes during the release wait).** → The helper settles on
  `'close'` as well as `'finish'`, so a disconnect mid-wait resolves `'ended'` rather than
  waiting out the timeout. `handleClose` can still set `ClientClosed` concurrently, which is
  harmless: the branch has already been chosen and the helper's step 1 re-checks
  `destroyed`/`writableFinished` before touching anything.
- **[Risk] Double `end()` / `destroy()`.** → Verified safe on a real `ServerResponse`: a second
  `end()` and a `destroy()` after `end()` neither throw nor emit `'error'`. The helper still
  guards with step 1, single-settle semantics, and the `Completed`/`ClientClosed` branches never
  call it. Note the divergence risk with test doubles — a hand-rolled fake may not tolerate what
  a real response does, which is one reason for D7's real-server test.
- **[Risk] Mocked vs real Node response behavior.** → The current backpressure test's `Writable`
  cannot distinguish `end()` from `destroy()` faithfully (`writableLength` is not zeroed on
  destroy for a plain `Writable`, while a real `ServerResponse` drops it to 0). So the terminal
  assertions run on both: a real `Writable` for determinism and a real `http.Server` +
  non-reading socket for fidelity. Fakes that only track `writableEnded` are not accepted as
  evidence for this change.
- **[Trade-off] The handler promise can live 15 s longer than the generation.** Accepted: it
  holds one already-ended response and one stack frame, on a path that only a misbehaving client
  reaches, and `dial.chat.http.requests.active` counts that request until close either way.

## Migration Plan

No data migration, no config, no schema. Backend-only and invisible to a well-behaved client.

**Local validation** (in order):

1. `npm run test:file -- apps/chat-api/src/common/utils/tests/sse.spec.ts`
2. `npm run test:file -- apps/chat-api/src/conversations/tests/completions.integration.spec.ts`
3. `npm run test:file -- apps/chat-api/src/conversations/tests/attach-generation-backpressure.spec.ts`
4. `npm run test:file -- apps/chat-api/src/conversations/tests/completion-response-lifecycle.spec.ts` (new)
5. `npm exec nx lint chat-api` and `npm run verify:changed`
6. `npm run validate:docs` (README touched)
7. Manual: `npm run start:all`, start a long completion, suspend the reading client
   (e.g. `kill -STOP` on the browser process or a `curl` whose reader is paused) past 1 MiB;
   confirm the process's RSS returns to baseline and the request disappears from
   `dial_chat_http_requests_active`.

**Environment validation** — the change is done when, over a comparable load window:

- `dial_chat_completion_response_terminations_total{reason="completed"}` dominates and
  `{reason="backpressure_ended"}`/`{reason="backpressure_destroyed"}` are rare;
- `{reason="backpressure_destroyed"}` is at or near zero — a non-trivial rate means the 15 s
  bound is wrong for real clients, not that the leak is back;
- `dial_chat_http_requests_active` returns to baseline between load spikes;
- every completion request now produces a
  `dial_chat_http_response_duration{http_route="/api/v1/conversations/completions"}` sample
  (today a leaked response produces none, which is the pre-fix fingerprint to compare against);
- `dial_chat_process_memory{kind="rss"}` no longer steps up after slow-client traffic.

**Rollback**: plain revert of the commit. No persisted state to unwind.

## Open Questions

- `SSE_RELEASE_TIMEOUT_MS = 15_000` is reasoned from a ~1 MiB worst case, not measured against
  production client throughput. The `backpressure_destroyed` counter is how it gets answered;
  changing the constant later is a one-line follow-up, not a redesign.
- Whether the frontend should react to a clean-but-`[DONE]`-less stream end by reloading the
  persisted conversation is a separate frontend question. Out of scope here: today that stream
  never ends at all, so any behavior after this change is a strict improvement, and
  `resumeIfAwaitingGeneration` already covers the reload/remount path.
