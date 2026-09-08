## Context

`ConversationController.streamCompletion` (`apps/chat-api/src/conversations/conversation.controller.ts:250`) drains `ConversationStreamingService.streamCompletion`, an async generator that owns the entire completion lifecycle: registering the generation, relaying the upstream Chat Completions or Responses API stream, and calling `finalize()` on a terminal outcome to persist the conversation and release the `ConversationGenerationService` registry entry.

PR #8640 added a `res.on('close', ...)` handler to that controller method which calls a new `ConversationGenerationService.abortSignal()`, aborting the generation's `AbortController`, and made the controller `break` out of its `for await` loop. Breaking a `for await` injects `.return()` into the async generator at its current `yield`, unwinding it past the relay loop's own terminal `switch` and into a `finally` block (also added by #8640) that treats the abandonment as an abort and calls `finalize(GenerationStatus.Error | Stopped, partialMessage)`.

This is the correct pattern for two *other* SSE handlers in the same controller — `attachToGeneration` and `watchConversation` — and for `ClientChannelController.subscribe`. Those are all observer/proxy streams with no independent backend state: closing the browser connection should stop the associated upstream work because nothing else depends on it continuing. `streamCompletion` is different by design: `app-level-generation-manager` requires the generation to survive the frontend's own conversation-page unmount and navigation, and the archived `generation-live-replay` spec documents this exact controller method as deliberately having no disconnect handling. #8640 missed that distinction and treated the memory-leak symptom (registry entries surviving past `evictStale`'s 30-minute sweep) as if the fix required aborting the upstream request, when the actual defect was narrower: the generator's own terminal bookkeeping (`finalize()`) never ran when its consumer was abandoned, for *any* reason — including future reasons, not just disconnect.

## Goals / Non-Goals

**Goals:**
- Restore the documented contract: closing/refreshing/navigating away from the browser connection to `POST /conversations/completions` has no effect on the generation. The backend keeps consuming the upstream stream and persists the complete response when it reaches its terminal state.
- Preserve #8640's actual fix — the registry entry is still released exactly once, promptly, on every real terminal outcome (`[DONE]`, provider error, explicit Stop) — without depending on the downstream response's lifecycle to trigger it.
- Close the gap #8640's removal reopens: an upstream stream that never reaches a terminal event (a hung provider connection) needs a bound that does not depend on the client connection, since disconnect-triggered abort is no longer that bound.
- Make `POST /completions/stop` the only path that intentionally aborts a generation.

**Non-Goals:**
- Changing the persisted-message outcome table in `backend-owned-generation-persistence` for `[DONE]`, provider error, or explicit Stop — those are correct today and untouched.
- Changing `attachToGeneration`, `watchConversation`, or `ClientChannelController.subscribe` — their disconnect-aborts-upstream behavior is correct for what they proxy and is out of scope.
- Moving completion execution into a separate detached job/worker process. Evaluated and rejected below (Decision 1).
- Building a general-purpose SSE-disconnect abstraction shared across handlers — same non-goal #8640's own design already called out; still out of scope here.

## Decisions

### 1. Keep completion execution inside the request-scoped async generator; do not move it to a detached background job.

Considered moving `ConversationStreamingService.streamCompletion`'s relay work into a job queue or a fire-and-forget task detached from the HTTP request entirely, with the controller becoming a thin subscriber to that job's output. Rejected for this change: it is a much larger surface change (job scheduling, a new persistence/status channel between job and controller, retry/crash semantics for the job runner) to solve a problem that a smaller fix already resolves — the generator already runs to completion independent of the controller once the controller stops forcing it to unwind early. The existing `ConversationGenerationService` registry plus its emitter (used by `generation-live-replay` attach) already gives late subscribers a way to observe an in-flight generation without the controller's original HTTP response; that is effectively the same capability a detached-job design would add, at a fraction of the change. Revisit only if a future requirement needs generations to survive a pod restart (they currently do not, by design — the registry is in-memory and not persisted).

### 2. The controller detaches the response instead of breaking the consuming loop.

`streamCompletion` keeps its `for await` running unconditionally to the generator's natural end. `res.on('close', ...)` sets an `isResponseDetached` flag and does **not** touch the `AbortController` or the loop. Each iteration writes to `res` only when not detached; a `res.write` that itself throws (destroyed socket) also flips the flag rather than propagating. The trailing `res.end()` is skipped once detached, since the socket is already gone.

This is the smallest change that satisfies the requirement: the generator's own terminal logic (`finalize()`, called from the relay loop's `switch`) is what persists and releases the registry entry, exactly as it did before #8640, and exactly as `backend-owned-generation-persistence` already specifies for `[DONE]`/error/stop. No new code path duplicates that logic for the disconnect case, because disconnect no longer needs one.

*Alternative considered:* keep the `break` but stop calling `abortSignal()`. Rejected — breaking still unwinds the generator via `.return()`, running the `finally` abandonment branch and finalizing the generation as `Error` with whatever partial content existed at the moment of disconnect, which is exactly the bug: the upstream relay stops being consumed (nothing reads `relayIterator.next()` after `.return()` unwinds it), so the answer never completes even without the explicit `abortController.abort()` call. The consuming loop must keep running, not merely avoid calling abort.

### 3. `ConversationGenerationService.abortSignal()` is deleted rather than kept unused.

It has exactly one call site (the disconnect handler being removed) and no other legitimate caller — `abort()` already exists for the one case that should abort a generation (explicit user Stop). Keeping a second, semantically-different abort method around invites the same mistake to recur.

### 4. Narrow, not remove, the `finally` abandonment branch in `ConversationStreamingService.streamCompletion`.

The `try/finally` around the relay loop (added by #8640) stays, because it still correctly answers a question independent of disconnect: *what happens if the consuming loop is abandoned by something other than reaching a terminal relay outcome* — e.g. an unexpected exception thrown between `yield` and the next `relayIterator.next()` call, or a future caller of this generator that does legitimately need to cancel it. With decision 2 in place, the controller itself never abandons the loop on disconnect, so in practice this branch is reached only by genuine abnormal termination, which is exactly what its guard (`relayCompletedNormally`) already distinguishes from the normal `switch`-driven finalize path. No code change is needed here beyond what decision 2 already implies — call this out explicitly in the task list so the implementer verifies it by running the existing `finally`-branch test as a regression check, not by editing the branch itself.

### 5. Add a server-owned max-generation-duration bound, independent of client connection, in `ConversationGenerationService`.

#8640's actual (correct) motivation was that registry entries could accumulate faster than the existing 30-minute `evictStale` sweep reclaims them — but `evictStale` only runs lazily, inside the next `register()` call, so it does not bound how long a *currently registered* generation can occupy the registry once nothing forces cleanup. Removing disconnect-triggered abort (decision 2) does not reopen that original leak — `finalize()` still runs on every real terminal outcome, same as before #8640 — but it does mean a hung upstream request (DIAL Core stops sending bytes without closing the socket or emitting `[DONE]`) now runs unbounded rather than being cut short the moment a client happens to disconnect. That was never a deliberate bound; it was incidental to the bug being fixed here.

Add a per-entry timer, started in `register()` alongside the existing `AbortController`: if the entry has not reached a terminal status within `MAX_GENERATION_DURATION_MS` (proposed: 30 minutes — comfortably above any observed legitimate completion, matching the existing stale-sweep TTL's order of magnitude), the timer aborts the entry's `AbortController` and finalizes it as `Error` via the same path `finalize()` already uses for a provider-side abort, then clears itself. `complete()`/`error()` (both already-existing terminal transitions) clear the timer as their first step, so a normal-speed generation never touches this path. This is additive to `evictStale`, not a replacement for it: `evictStale` remains the backstop for the case this timer cannot cover either (a process crash that loses the in-memory timer along with everything else the registry holds).

*Alternative considered:* rely solely on `evictStale`'s existing 30-minute TTL and accept the wider bound. Rejected — 30 minutes is calibrated as a crash-recovery backstop assuming an already-connected pod scans it lazily on the next `register()` for the *same* session+path; under low traffic for that specific conversation, a stuck generation could occupy its registry slot far longer than 30 minutes since nothing calls `register()` again to trigger the sweep. A dedicated timer bounds every entry deterministically regardless of subsequent traffic.

*Alternative considered:* bound total generation duration by wall-clock elapsed from `register()`, cancelling even a healthy, still-progressing generation past the limit. Rejected — the goal is bounding a *stalled* generation, not capping legitimately long ones (e.g. a large tool-augmented response); an idle/no-progress timeout would require tracking last-chunk-received time instead of just elapsed time, which is more mechanism for the same problem this change is scoped to close. Recorded as a possible follow-up if real long-hang cases turn out to still be making (slow) progress right up to a fixed deadline.

## Risks / Trade-offs

- **[Risk]** A slow client that never explicitly closes the connection but also never reads (a stalled `res.write` due to backpressure) could hold the loop open indefinitely. → **Mitigation**: `res.write` back-pressure already surfaces as a rejected/failed write or an eventual `close`/`error` event from Node's HTTP layer in practice; the max-duration timer (decision 5) is the deterministic backstop regardless. Not a new risk introduced by this change — it existed identically before #8640 and is unrelated to disconnect handling.
- **[Risk]** Removing `abortSignal()` and its call site changes covered test behavior; if any other in-progress branch relies on disconnect-triggered abort semantics (e.g. a load-shedding mechanism), removing it could regress that. → **Mitigation**: `abortSignal()` has exactly one call site in the current codebase (verified via grep during proposal investigation); no other caller exists to regress.
- **[Trade-off]** Choosing 30 minutes for `MAX_GENERATION_DURATION_MS` is a judgment call with no telemetry backing it yet. → **Mitigation**: flag as configurable (env-backed, following `apps/chat-api/src/config/environment.config.ts` conventions) rather than a hardcoded literal, so it can be tuned post-deployment without a code change; validate against actual p99 generation duration during apply/QA if metrics are available (`generationStreamDuration` histogram already recorded in `conversation-streaming.service.ts`).
- **[Trade-off]** A generation that legitimately keeps a client waiting for the full max-duration window before timing out now finalizes as a generic `Error` with `streamErrorMessage: ''`, same as any other non-user abort — no more specific "timed out" marker. Consistent with the existing outcome table's "aborted for any other reason" row; a distinguishable timeout marker is a reasonable future enhancement but not required to restore the specified disconnect behavior.

## Migration Plan

No data migration. Deploy as a normal `chat-api` release. Rollback is a plain revert of this change (which is itself mostly a revert of #8640's backend files plus the new timer) — no persisted schema or API contract is touched. Roll out behind no feature flag; this is a correctness fix restoring already-specified behavior, not new user-facing functionality.

## Open Questions

- Exact value for `MAX_GENERATION_DURATION_MS` — proposed default 30 minutes; confirm during apply against any available production `generationStreamDuration` data, or leave as a documented placeholder if no data exists yet.
