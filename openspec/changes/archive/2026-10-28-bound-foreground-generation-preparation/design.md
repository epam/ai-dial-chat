## Context

`ConversationStreamingService.streamCompletion` (`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`) is an async generator. On the controller's first `next()` it calls `ConversationGenerationService.register`, which admits the entry as `active`, arms the max-duration timer and mints a lease. It then awaits preparation and only after that calls `onReadyToStream`, the point where the controller sends SSE headers and starts its keepalive. All preparation is therefore pre-header. A rejection is delivered by the controller's pre-header branch as a normal HTTP status (`backend-owned-generation-persistence`, "A failure before the stream opens is reported with its own status code").

### Inventory (verified against `9e0ab1715`, `development` HEAD `44a6abc90`)

| # | Await | Underlying calls | Receives lease signal | Late-settlement side effects | Current failure handling |
|---|---|---|---|---|---|
| 1 | `assertModelNotHidden` | `DeploymentsService.resolveDeploymentItem`: DIAL Core model/application/shared-resource reads | no | none | rejects → `error(lease)` (release, no write) → rethrow |
| 2 | `resolveGenerationApiForDeployment` | `getDeploymentDetails` (cache, plus a **shared in-flight promise** across callers keyed by user and deployment), 2× `FeatureFlagsService.isEnabled` (app-config evaluation), and conditionally `getDeploymentInterfaces` (cached; failure resolves `[]`) | no | cache population | same as 1; counts `generation.capability_resolution{outcome=failed}` |
| 3 | `getConversationWithStoredVersion` | DIAL Core `getConversation` | no | title-cache population | rejects → release → rethrow; a pending background message → `409` |
| 4 | start-state `saveConversation` (foreground only) | `preserveLlmDisplayName` read, then an **unconditional** DIAL Core PUT, then a title-cache write and `maybeRenameAfterFirstReply` scheduling (an `If-Match`-fenced naming write) | no | **a remote write** of user message plus empty placeholder, landing at any time | rejects → `warn`, stream continues |

The background branch hands off to `BackgroundGenerationService.startAndRelay` after step 3. Its placeholder save is a conditional write owned by `background-responses-generation`.

SDK capability: `SDKRequestInit` has an index signature, and `openapi-fetch` 0.17 forwards extra init keys into `fetch`. The relay (`sendChatCompletionRequest`) and `watchConversation` (`subscribeToResources`) already pass `signal` this way. So a signal *can* reach every DIAL Core call above. None of them receives one today, and `DeploymentsService` and `ConversationPersistencePort` accept no signal parameter. `apps/chat-api/src/net/proxy-agent.setup.ts` installs `EnvHttpProxyAgent` with undici's default header and body timeouts. Those may eventually reject some stalled sockets, but they are a transport default, not a contract, and a trickling body defeats them. This design does not rely on them.

### What happens today

- **Stop during preparation:** `hasLocalForegroundGeneration` is true (`isBackground` is still false), so `abort` succeeds with `204` and the entry becomes `cancel_requested`. Preparation continues and the start-state save is written. `onReadyToStream` opens SSE. The relay is invoked with an already-aborted signal and returns `aborted`. The terminal save persists `wasStoppedByUser: true` and the stream closes. The client (`libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts`, `sendStop`) deliberately keeps its fetch open and reloads on `onComplete`.
- **Max duration or stale expiry during preparation:** same path, persisted as a non-user abort (`streamErrorMessage: ''`).
- **Shutdown during preparation:** `onModuleDestroy` settles the entry and releases the key. Preparation then continues, writes the start state, invokes the relay with an aborted signal and writes a terminal save for an entry nobody owns any more.
- **A step that never settles:** the entry stays `active`, or `cancel_requested` after max duration or Stop. The stale sweep ignores it once it is no longer `active`, and no finalization timer is armed. Attach (`hasLocalForegroundGeneration` → registry) hands out the placeholder snapshot and a keepalive that nothing ends. The originating request stays pending without headers. `register` returns `409` until restart.

## Goals / Non-Goals

**Goals:**

- A server-owned bound on how long preparation can hold visible resources: the originating request, attach subscribers and keepalives, the max-duration timer, and the preparation timer itself.
- No unsafe ownership release. While an abandoned operation may still write, the key stays owned.
- An abandoned preparation runs no continuation: no later step, no start-state save, no headers, no upstream request.
- Late settlement is observed exactly once, and late rejections are logged, never left unhandled.
- After shutdown, preparation makes no write and no relay.
- No upstream model request is dispatched after cancellation, for any cancellation reason.
- Stop, max-duration, stale-sweep, finalization-bound and late-attach behaviour is unchanged wherever preparation completes in time.

**Non-Goals:** see the proposal. In short: no upstream cancellation claim, no signal threading through shared services, no background placeholder bound, no post-hoc terminal write, no new lifecycle state, metric or global queue, no streaming-service split, and no client change.

## Decisions

### D1 — Bound the wait with a phase deadline; retain ownership until the abandoned step settles

The worker awaits each preparation step against a single preparation deadline. On expiry it gives up on the step and does the following:

1. Sets a local `isPreparationAbandoned` guard so no later code in this generator runs. This is what suppresses continuation.
2. Calls a new lease-scoped registry method, `abandonPreparation(lease)`. On a live entry whose resources are not yet released, the method moves it to `settling`, updates the gauge and releases resources through the existing `releaseResources`. Releasing resources delivers the terminal event (`stopped` for `user_stop`, otherwise `error`), removes listeners and clears the max-duration timer. The method logs one `warn` with the entry's `logLabel` and the bounded step name, and never the owner key. It is a no-op for a missing or already-released entry.
3. Attaches one settlement observer to the *pending step's* promise. On resolve it logs at `debug`. On reject it logs at `warn` (the error object, same pattern as the existing start-state warning). Either way it then calls the existing `error(lease)`, whose `settle` finds resources already released and only releases the key and gauge contribution. This is the single settlement.
4. Throws `ServiceUnavailableException('Generation preparation timed out')`. The abandonment does **not** pass through the existing pre-stream `catch` blocks that call `error(lease)`: those would free the key while the step is still pending. The implementation throws a private `ServiceUnavailableException` subclass, which those blocks recognize by type and rethrow without releasing.

A max-duration, stale or user-stop cancellation that lands during preparation **does not** abandon. It keeps today's flag-plus-abort semantics, the deadline still bounds the wait, and D4 makes sure no upstream request follows.

`settling` is reused rather than adding a state. Its meaning widens from "terminal write pending past the finalization bound" to "subscribers released, key retained for an unsettled operation". The gauge, `attach` (resources-released guard from 01), `abort` (requires `active`), `hasLocalForegroundGeneration` and `register` (`409`) already behave correctly for it.

Alternatives considered:

- **Plain timeout plus delete (or plain timeout plus `error(lease)`).** Rejected as unsafe. Step 4 is an unconditional PUT. Releasing the key admits a replacement whose start or terminal save the late PUT can overwrite with a stale placeholder: the exact stale overwrite D2 and D7 of `2026-09-21-fix-generation-eviction-lifecycle` forbid. Even for read-only steps 1–3, deleting while a closure still holds the lease adds a release path that no test covers, and gains nothing once the read settles.
- **Cooperative abort propagation.** Thread an `AbortSignal` (lease signal plus deadline) into steps 1–4. Rejected as the primary mechanism, for three reasons:
  - Step 2 shares an in-flight promise across callers in `DeploymentsDetailsService`. Aborting one caller's signal would reject every other caller's wait, and fixing that means per-caller waits, which is this design again.
  - Aborting a PUT client-side does not establish whether DIAL Core committed it. An aborted step 4 is an ambiguous write, so the key could not be released on abort anyway, only on settlement.
  - It changes `DeploymentsService`, `resolveDeploymentItem`, the persistence port and every caller, which is broad churn for no stronger guarantee.

  It is kept as a follow-up for step 3 alone, a private read with no sharing, where a real abort would settle the step and free the key sooner.
- **Reusing `GENERATION_FINALIZE_TIMEOUT_MS` for preparation.** Rejected. Its documented meaning is "from entering terminal finalization", and operators raise it to tolerate slow storage on terminal writes. Silently lengthening the pre-header bound, which a client and its proxy wait on with no bytes, is a different trade-off. The cost of a separate variable is one validated optional field and its doc rows.
- **Treat a timed-out start-state save like a failed one (warn and stream), and await its settlement before the terminal save.** Rejected. It violates the spec's "saved before opening the upstream stream" ordering. It moves the unbounded wait to just before `beginFinalizing`, or forces the finalization bound earlier. And it makes the shape of the pre-header phase depend on which step stalled.

### D2 — Deadline timing, configuration and precedence

- **Measurement:** the deadline runs from immediately after `register` succeeds until the end of preparation. Preparation ends at the `onReadyToStream()` call (foreground), at the `startAndRelay` handoff (background), or when any step rejects or is abandoned.
- **Background fallback:** when `startAndRelay` cannot store its placeholder (`BackgroundStartResult.Fallback`), the request continues on the stateless path. A fresh deadline is armed for that path's start-state save, so a fallback is bounded like any other non-background start.
- **Timer:** exactly one `setTimeout` per generation (one more only after a background fallback), cleared in a `finally` that covers every exit from preparation. The deadline is a single promise created once, and each step races against it. That adds at most four reactions, all collectable with the promise once the timer is cleared. The timer itself adds no `AbortSignal` listener.
- **Configuration:** `GENERATION_PREPARATION_TIMEOUT_MS`, optional, `@Transform(parseInt)`, `@IsInt()`, `@Min(1000)`, default `30000`. It is read through `ConfigService` with `infer: true` in `ConversationStreamingService`, following the `GENERATION_FINALIZE_TIMEOUT_MS` read in `ConversationGenerationService`'s constructor. There is no upper bound and no cross-field validation against `MAX_GENERATION_DURATION_MS`. If max duration is configured shorter, it fires first, sets the reason and aborts. Preparation still ends at the earlier of completion and its own deadline.
- **Precedence when two events race:** whichever of step settlement and deadline settles the race first wins. A step that resolved before the timer callback runs proceeds normally. Once abandoned, a step's later result is discarded.
- **Default rationale:** normal preparation takes milliseconds to low seconds (cached details plus two DIAL Core reads plus one PUT). Thirty seconds leaves wide headroom and stays below the common 60 s ingress read timeout, so the client receives this `503` instead of a proxy `504`. This is an assumption: deployments with known-slow storage can raise the value.

### D3 — Pre-stream HTTP failure, never post-header termination

Every step precedes `onReadyToStream`, so abandonment is always delivered before headers exist. The controller's existing branch (`hasFailedBeforeStreamOpened = !res.headersSent`) hands the exception to the filter. The status is `503`, per `apps/chat-api/AGENTS.md` §6 ("Upstream timed out / unreachable → `ServiceUnavailableException`"). The `@ApiResponse({ status: 503, description: 'DIAL Core unreachable' })` on `streamCompletion` already covers it, because every step is a DIAL Core request or app-config evaluation. So there is no Swagger, OpenAPI or generated-client change. Opening SSE earlier to report the timeout in-band was rejected, because it changes the committed-status contract and the client's idle watchdog semantics.

Client effect (`libs/chat-hooks/src/conversation/create-chat-stream-api.ts`): a non-`409` failure before streaming becomes `Error('Stream request failed with status 503')`, then `settleAsFailed`. No client change is needed.

### D4 — No upstream request after cancellation; no continuation after shutdown

- After each step settles in time, the worker checks `generationService.getCancellation(lease)`. `undefined` means the entry was released underneath it, which during preparation can only be `onModuleDestroy`. In that case it throws the `503` with no further step, no start-state save and no relay. The key is already gone and there is nothing to settle.
- When preparation completes and `lease.abortController.signal.aborted` is already true (Stop, max duration or stale expiry during preparation), the worker does not build or invoke `relayModelCompletion` or `ResponsesAdapter.stream`. It takes the existing `aborted` classification directly (`wasStoppedByUser` for `user_stop`, otherwise `streamErrorMessage: ''`), with `onReadyToStream`, the start-state save and the single terminal save exactly as today. Today the relay *is* invoked and only fetch's aborted-signal rejection keeps the request off the wire. That is an SDK and fetch behaviour, not a contract, so the guard makes it explicit. Persisted markers, statuses and the client-observed sequence stay the same.
- This check runs only at the preparation boundary. It does not change Stop, max-duration or stale semantics.

### D5 — Visible versus retained resources after abandonment

| Released at the deadline | Retained until the abandoned step settles (or restart) |
|---|---|
| Originating HTTP request (`503` sent), including its closure over `res` | Registry entry and key (`settling`, `409` on `register`) |
| Attach subscribers: terminal event, listeners removed, their keepalives cleared by the controller's cleanup | The entry's placeholder snapshot, its listener-less emitter and its `AbortController` |
| Max-duration timer and preparation timer | `dial_chat_generations_active{state="settling"}` contribution |
| — | The pending step's promise and its closure (token, start-state body for step 4), plus the settlement observer |

If the step never settles, the right-hand column persists for the process lifetime. That is the same documented limit as a never-settling terminal write.

### D6 — Telemetry and logging

There is no new instrument. The abandonment `warn`, the `settling` gauge state and the existing `503` request metrics (`MetricsInterceptor`) are the signals. An abandoned step 2 still records `generation.capability_resolution{outcome=failed}` through its existing `catch`, which keeps its metric increment and skips only the release. The step name in the log comes from a string enum (`GenerationPreparationStep`: `hidden_model_check`, `capability_resolution`, `conversation_read`, `start_state_save`) in `apps/chat-api/src/conversations/generation/generation.types.ts`, which keeps log values bounded.

## Risks / Trade-offs

- [A healthy but slow preparation exceeds the bound, so the user sees a failed send. If step 4 then commits, storage holds an unresolved placeholder.] → The default is generous and configurable. Current clients treat an unresolved placeholder as `isAwaitingGenerationResume`: attach returns `404` (entry retained or released), then they fall back to the 5-minute bounded `watch` and show the existing outcome. This is the same state a failed terminal save already produces. No post-hoc terminal write is added (non-goal).
- [Stop followed by a stall past the bound gives the stopping client a failure instead of a stopped answer.] → This happens only when preparation itself stalls past the bound, which today hangs indefinitely. The persisted state is whatever step 4 achieved.
- [A never-settling step retains the key until restart.] → This is deliberate, because releasing it is unsafe (D1). It is visible as `settling` and documented alongside the finalization-bound limit. The follow-up signal threading for step 3 reduces it for reads.
- [The sentinel accidentally passes through an existing `catch` that calls `error(lease)`.] → Slice 2 adds a deferred-operation test asserting `register` still throws `409` after abandonment of each step, before settlement.
- [Process-local only.] → Unchanged: other pods are not fenced. `docs/architecture.md` already states this.
- [`apps/chat-api/README.md` currently repeats its sections four times, a pre-existing duplication.] → Update every occurrence of the affected rows and record the duplication as a follow-up. Do not deduplicate in this change.

## Migration Plan

1. Deploy with the default (`30000`). No data migration, no API or client change.
2. Watch `dial_chat_generations_active{state="settling"}` and the abandonment `warn` for unexpected abandonment. Raise `GENERATION_PREPARATION_TIMEOUT_MS` if healthy deployments trip it.
3. Rollback: revert the commit, or set a very large value to approximate the old unbounded wait without a code rollback. A reverted build ignores the leftover variable (`apps/chat-api/src/config/validation.ts` does not reject unknown keys).

## Open Questions

- Default value: `30000` is an assumption tied to typical ingress timeouts. Confirm it against the deployment's proxy `proxy_read_timeout` before apply.
- Follow-up, not in this change: threading the lease signal into the stored-conversation read (step 3) so a stalled read settles, and frees the key, at the deadline.
- Follow-up, not in this change: bounding the background placeholder save (queue item 08), and deduplicating `apps/chat-api/README.md`.
