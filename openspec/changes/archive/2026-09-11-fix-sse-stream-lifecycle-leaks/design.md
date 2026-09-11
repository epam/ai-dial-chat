## Context

Four handlers in `apps/chat-api` open an SSE response and relay bytes from
either a DIAL Core upstream stream or an in-process `EventEmitter`:

| Handler | File | Upstream source | Client-owned lifecycle? |
|---|---|---|---|
| `subscribe` | `client-channel/client-channel.controller.ts` | DIAL Core fetch stream | Yes — aborts upstream on disconnect |
| `watchConversation` | `conversations/conversation.controller.ts` | DIAL Core fetch stream | Yes — aborts upstream on disconnect |
| `streamCompletion` | `conversations/conversation.controller.ts` | `ConversationStreamingService`'s async generator | No — generation is backend-owned (`backend-owned-generation-persistence`); disconnect only stops writes |
| `attachToGeneration` | `conversations/conversation.controller.ts` | `ConversationGenerationService`'s per-generation `EventEmitter` | Partial — the *subscription* is client-owned, the *generation* it observes is not |

All four share two defects, confirmed by reading the current code (not
assumed): (1) the two upstream-owning handlers construct their
`AbortController`/register `res.on('close', ...)` *after* the `await` that
opens the upstream call, so a disconnect during that await has nothing to
cancel; (2) all four call `res.write(value)` without checking its boolean
return, so a client that reads slower than bytes are produced (or a
completely stalled `Writable`) has its output buffered by Node without bound.
`dial_chat_sse_active`/`dial_chat_generations_active` (already merged on this
branch, see `observability-telemetry`) give visibility into the first defect
class (subscriptions outliving their justification) but do not themselves
bound the second (per-connection buffered bytes), which is why the change
adds an explicit, measured limit rather than relying on the gauges alone.

The two client-owned handlers (`subscribe`, `watchConversation`) already
close their own upstream work — the fix is *timing* (attach the cancellation
path earlier) and, for `watchConversation`, *plumbing* (no `AbortSignal`
reaches `subscribeToResources` today at all). The two generation-owning
handlers (`streamCompletion`, `attachToGeneration`) must never cancel the
generation on a slow/closed client — the fix there is purely about bounding
buffered output and stopping writes, mirroring the existing
`isResponseDetached` pattern `streamCompletion` already uses for disconnect.

## Goals / Non-Goals

**Goals:**
- Close the two confirmed retention paths without changing SSE framing,
  auth, feature flags, or the documented backend-owned-generation guarantee.
- Share the backpressure-handling logic across all four handlers instead of
  writing four bespoke copies of "check `res.write()`'s return value."
- Keep the runtime gauges (`dial_chat_sse_active`, `dial_chat_generations_active`)
  accurate under every new code path — settle-exactly-once must still hold.
- Make the fix independently verifiable: real Node `Writable`/`ReadableStream`
  primitives in tests, not full HTTP integration, so backpressure and
  early-abort behavior are exercised deterministically.

**Non-Goals:**
- Changing the wire format of any SSE event, or any DTO/OpenAPI contract.
- Introducing reconnection/resume logic on the frontend — this is a backend
  resource-lifecycle fix only.
- Solving unrelated retention findings from the local memory-leak
  investigation that are not confirmed defects (tracked as follow-ups per
  the proposal's scope).
- A general-purpose stream-piping abstraction; the shared helper here is
  scoped to this repo's four SSE call sites, not a public utility.

## Decisions

### 1. Attach `res.on('close', ...)` and construct the `AbortController` before the first `await`

For `subscribe` and `watchConversation`, move the existing
`new AbortController()` + `res.on('close', handleClose)` lines to the top of
the handler, before calling `clientChannelService.subscribe(...)` /
`conversationService.watchConversation(...)`. `handleClose` already calls
`abortController.abort()`; the only change is *when* the listener starts
existing, not its body. This makes the already-passed `AbortSignal` (for
`subscribe`) actually useful for the setup-phase window, and — combined with
Decision 2 — extends the same coverage to `watchConversation`.

No alternative was considered here: this is a straightforward reordering
with no behavioral trade-off, confirmed safe because `res` exists (Express
already supplied it) before either upstream call is made.

### 2. Thread an `AbortSignal` through `watchConversation`

`ConversationStreamingService.watchConversation(conversationPath, token, sessionBucket)`
gains a fourth parameter, `signal: AbortSignal`, passed straight to
`this.dialClient.client.subscribeToResources({ ..., signal })` (the SDK's
underlying `fetch` already accepts `signal` — `relayModelCompletion` in the
same file does exactly this for the completions call). `ConversationController.watchConversation`
passes its own `AbortController`'s signal. `ConversationService.watchConversation`
needs no change — it is a bound property re-export
(`this.streamingService.watchConversation.bind(...)`), so the new parameter
flows through automatically.

**Alternative considered:** give `ConversationStreamingService` its own
internal `AbortController` and only expose a `cancel()` method. Rejected —
every other upstream call in this service (`relayModelCompletion`) already
takes the caller's `AbortSignal` directly; introducing a second pattern for
one method adds inconsistency for no benefit.

### 3. A shared SSE backpressure helper in `common/utils/sse.ts`

Add one function used by all four handlers instead of four ad hoc
backpressure implementations:

```ts
export interface SseWriteResult {
  written: boolean; // false only when the response was already ended/detached
  needsDrain: boolean; // true when res.write() returned false
}

export const writeSseChunk = (res: Response, chunk: Uint8Array | string): SseWriteResult => { ... };

export const waitForDrain = (
  res: Response,
  signal: AbortSignal, // aborts the wait early: connection closed / upstream errored
  timeoutMs: number,
): Promise<'drained' | 'timeout' | 'aborted'> => { ... };
```

`writeSseChunk` wraps `res.write()` and reports whether the caller must now
wait for `'drain'`. `waitForDrain` resolves on the response's `'drain'`
event, the given `AbortSignal` firing, or `timeoutMs` elapsing — whichever
comes first — and always removes its own listeners before resolving (a
`Promise.race` over three cleanly-torn-down listeners, not a bare
`once('drain')` that could leak if the signal fires instead).

The two upstream-relay loops (`subscribe`, `watchConversation`) use both
functions: on `needsDrain`, they `await waitForDrain(...)` (bounded by the
existing `AbortController`'s signal plus a new 5000ms
`SSE_DRAIN_TIMEOUT_MS`) before issuing the next `reader.read()`. A `'timeout'`
result is treated exactly like a disconnect: cancel the reader, clear any
keepalive timer, end the response.

The two generation-owning handlers (`streamCompletion`, `attachToGeneration`)
use only `writeSseChunk` plus a synchronous `res.writableLength` check (no
`waitForDrain` — they must never block the generation loop on a slow
client). Immediately after each write, if `res.writableLength` exceeds the
relevant constant (`SSE_COMPLETION_MAX_BUFFERED_BYTES` /
`SSE_ATTACH_MAX_BUFFERED_BYTES`, both 1 MiB — see Decision 4), the handler
sets its existing detach flag (`isResponseDetached` for `streamCompletion`,
the existing `cleanup()` path for `attachToGeneration`) and stops writing,
without awaiting anything. This is a check, not a wait, so it adds no
latency to the generation's own progress.

**Alternative considered:** use a `stream.pipeline`/`Writable` wrapper
(Node's `Readable.pipe(res)`) instead of manual `read()`/`write()` loops for
the two upstream relays, letting Node's own backpressure handling apply
automatically. Rejected for this change: it would require restructuring the
existing reader loops (which also parse SSE frames inline for
`watchConversation`'s keepalive interleaving and `client-channel`'s
pass-through), a larger refactor than this fix's scope, and it would not
help the two generation-owning handlers at all, since those write from an
async generator / `EventEmitter` callback, not a `Readable`. A shared
small helper keeps both families of handler on the same drain-detection
logic without restructuring either.

### 4. Concrete limits

| Constant | Value | Applies to | Rationale |
|---|---|---|---|
| `SSE_DRAIN_TIMEOUT_MS` | 5000 | `subscribe`, `watchConversation` | Matches the existing 15s keepalive cadence with margin — a connection that can't drain in 5s is failing, not momentarily slow, and holding the upstream Core connection open past that point produces exactly the retention this change targets. |
| `SSE_COMPLETION_MAX_BUFFERED_BYTES` | 1 MiB (`1024 * 1024`) | `streamCompletion` | The local reproduction accumulated ~16 MiB against a 1 KiB `highWaterMark`; 1 MiB bounds worst-case per-connection buffering to roughly the size of a large single assistant turn while being generous enough that no normal client trips it. |
| `SSE_ATTACH_MAX_BUFFERED_BYTES` | 1 MiB | `attachToGeneration` | Same reasoning; attach mirrors completion delivery's chunk shape. |

These are internal constants (`apps/chat-api/src/common/utils/sse.ts` and/or
each domain's controller), not environment variables — they are a safety
bound on an implementation detail, not an operator-tunable setting, matching
how `SSE_KEEPALIVE_INTERVAL_MS` is already handled today.

**Alternative considered:** count buffered *chunks* instead of bytes.
Rejected — chunk size varies enormously (a keepalive comment vs. a large
tool-call argument delta), so a byte bound is the only one that actually
caps memory.

### 5. Detaching for backpressure reuses each handler's existing disconnect path exactly

`streamCompletion` already has `isResponseDetached`/`handleClose`;
`attachToGeneration` already has `cleanup()`. Backpressure detection calls
into these same functions rather than introducing a parallel "detached for
backpressure" state, so `backend-owned-generation-persistence` and
`generation-live-replay`'s existing "no writes to a closed response"
guarantees apply unchanged to the new trigger.

## Risks / Trade-offs

- **[Risk]** A legitimately large single completion (very long assistant
  turn plus large `stages`/tool-call payloads) could exceed 1 MiB of
  buffered output on a merely slow-but-not-broken connection, causing a
  premature detach → **Mitigation**: detachment only stops *delivery* to
  that one response; generation and persistence are unaffected (per
  `backend-owned-generation-persistence`), and the frontend's existing
  disconnect/resume path (`generation-live-replay`'s attach endpoint) already
  handles a client that needs to pick the stream back up. The 1 MiB bound is
  also revisitable via the same constant if production metrics show it
  firing on healthy connections.
- **[Risk]** `SSE_DRAIN_TIMEOUT_MS` too aggressive for a genuinely slow but
  recovering mobile connection → **Mitigation**: 5s only starts counting
  once `res.write()` has already signaled backpressure (not from connection
  start), and hitting it only closes that one relay (client-channel or
  watch), both of which the frontend already reconnects/retries by design
  (`client-channel-protocol`'s reconnect header, `conversation-watch-sse`'s
  timeout-and-silent-completion scenario).
- **[Risk]** Sharing one helper across four call sites could couple unrelated
  handlers → **Mitigation**: the helper is two small pure-ish functions
  (`writeSseChunk`, `waitForDrain`) with no shared state between calls; each
  handler still owns its own loop, flags, and cleanup.
- **[Trade-off]** This does not eliminate every theoretical retention path
  in the SSE stack (e.g. pathological upstream behavior beyond what was
  reproduced) — scope is the two confirmed defects; anything else surfaces
  through the PR #8738 gauges for a follow-up.

## Migration Plan

No data migration. Deploy behind the normal release process; the change is
backend-only and behaviorally additive (existing well-behaved clients never
observe the new timeout/byte-limit paths). Verification after deploy: watch
`dial_chat_process_memory{kind="rss"}` and `dial_chat_sse_active` over a
comparable load window to 1.0.15's post-deploy period; a fix that works
shows RSS plateauing instead of climbing, and `dial_chat_sse_active` gauges
returning to baseline between load spikes instead of trending upward.
Rollback is a plain revert — no schema or persisted-state change to unwind.

## Open Questions

- None outstanding for this slice. The two remaining "confirmed defects
  reproduced locally, contribution to production growth not yet measured"
  framing in the proposal stays true after this fix ships — the metrics
  comparison above is how that gets answered, not something this design can
  resolve in advance.
