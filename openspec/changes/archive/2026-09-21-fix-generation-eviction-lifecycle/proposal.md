# Safe generation eviction and finalization

## Why

`ConversationGenerationService.evictStale` removes a registry entry — clearing its
max-duration timer, deleting the map key, and releasing runtime tracking — without
cancelling the upstream work or notifying attach subscribers
(`apps/chat-api/src/conversations/conversation-generation.service.ts:168-176`,
`:133-139`). The evicted worker keeps running with a live `AbortController` and a
still-pending terminal `saveConversation`, while the freed key lets a new generation
register for the same principal and path. The old worker then finalizes and writes
its own older conversation body over the replacement's — and, because
`ConversationStreamingService` classifies that finalization by reading
`getStatus(ownerKey, conversationPath)` and
`attach(ownerKey, conversationPath)?.assembledMessage` with no generation identity
(`streaming/conversation-streaming.service.ts:704`, `:755-760`), it reads the
*replacement's* status and partial message while doing so.

The same hole is reachable without eviction: `abort()` marks an entry `Stopped`
and leaves it in the registry (`:287`), and `register()` rejects only `Active`
entries (`:187`), so a Stop immediately followed by a new completion replaces an
entry whose partial save has not settled. An existing test asserts exactly that
replacement as correct behaviour
(`tests/conversation-generation.service.spec.ts:490`); it encodes the race rather
than a requirement, and is replaced by this change.

Two secondary defects share the same root cause. `MAX_GENERATION_DURATION_MS` is
validated with `@Min(1000)` and no upper bound
(`apps/chat-api/src/config/environment.config.ts:955`), while the stale threshold
is the fixed `STALE_ENTRY_TTL_MS = 30 * 60 * 1000` (`:17`) — so a configured
maximum above 30 minutes has its own timer cleared by eviction before it can fire.
And `complete()`/`error()` broadcast the terminal event with a bare
`emitter.emit('terminal', …)` (`:304`, `:330`), so one throwing subscriber
propagates out and skips both `removeAllListeners()` and `removeEntry()` — the
`onModuleDestroy` path already guards against this with `rawListeners` + try/catch
(`:150-161`), and the ordinary terminal paths do not.

Evidence class separation, kept deliberately distinct:

| Class | Status |
|---|---|
| The overlap races above | **Demonstrated** by source reading at `b39ed33c2` (re-validated against the `13f09a8f8` review; the cited code is unchanged). Reproducible with fake timers — no production access needed. |
| Retention of an evicted entry's worker, subscribers and assembled message | **Suspected** consequence of the same code path. Retention duration is bounded only by the upstream provider, not by the registry. Not measured here. |
| The 2026-09-16 production OOM | **Unmeasured.** No container-limit, `OOMKilled`, prior-log or controlled-load data was collected. This change does **not** claim to resolve it. |

## What Changes

- Give every admitted generation an **internal operation identity** minted by the
  registry, separate from the client-supplied `generationId`. Lifecycle callbacks
  address their entry through that identity, so a later request that reuses the
  same client-provided `generationId` can never be inspected, mutated, removed,
  notified, or tracking-decremented by an older worker's callback.
- Replace the unconditional stale **removal** with a stale **cancellation**:
  expiry requests cancellation and aborts the upstream, and the owning worker
  still performs its own finalization and releases the entry. Eviction no longer
  clears a live max-duration timer, no longer frees the key under a running
  worker, and no longer silently orphans upstream work.
- Make **admission conservative**: `register()` rejects with 409 for any entry
  still owned by a worker — including one that is cancelling or finalizing — not
  only an `Active` one. Ownership is released by the owning worker, after its
  single terminal save attempt has settled.
- Introduce an explicit internal lifecycle with a named string enum
  (`Active → CancelRequested → Finalizing → Settling → Released`) and a separate
  `GenerationCancelReason` enum (`UserStop | StaleExpiry | MaxDuration |
  Shutdown`), so **stale cancellation is not a user Stop**: only `UserStop`
  persists `wasStoppedByUser: true`. The existing persisted-marker table for
  success, user Stop, provider error, and non-user abort is preserved unchanged.
- Make cleanup **idempotent and fully-releasing** across overlapping Stop,
  expiry, max-duration timeout, completion, error and shutdown: one settle path,
  guarded once, releasing timer, listeners and runtime tracking exactly once, and
  broadcasting the terminal event through isolated `rawListeners` so a throwing
  subscriber cannot prevent other subscribers or essential cleanup from running.
- Derive the **stale TTL from the configured maximum duration** so it can never
  pre-empt the max-duration timer, and state explicitly that the sweep still runs
  on `register()` only — recovery of an in-process-orphaned entry therefore
  depends on later traffic from *some* principal. No per-request sweep timer and
  no queue are added.
- Bound **subscriber release and upstream termination** unconditionally, and do
  **not** bound safe ownership handoff. When a terminal save never settles, the
  entry is released of timers, listeners and subscribers but **retained** as
  `Settling` — still owning the key, still counted — because releasing the key
  would readmit the overwrite this change exists to prevent. This is the change's
  stated limitation, not an oversight.
- Report retained entries **truthfully**: add a bounded `state` attribute to
  `dial.chat.generations.active` so a `Settling` backlog is distinguishable from
  live generations, instead of a falling count reading as successful persistence.
- **No public HTTP API change.** The full internal call surface is 12 call sites
  in two files (`conversation.controller.ts:426`, `:468`;
  `conversation-streaming.service.ts:437`–`:758`). `POST
  /api/v1/conversations/completions`, `/completions/stop` and
  `/completions/attach` keep their request/response shapes and status codes. The
  one externally observable change is that a same-principal, same-path submission
  arriving *during* another generation's finalization now receives the documented
  409 instead of silently replacing the finalizing entry. No frontend change is
  required (see Impact).

Not breaking at the HTTP contract level; behaviourally narrowing in one
documented case. Rollback is a single revert of the `apps/chat-api` commits —
see design.md for in-flight-work implications.

## Capabilities

### New Capabilities

None. The lifecycle belongs to the capabilities that already own admission,
cancellation and persistence; introducing a parallel capability would split one
invariant across two specs.

### Modified Capabilities

- `generation-registry`: replaces the unconditional "Stale entries are evicted"
  requirement with stale *cancellation*; adds internal operation identity
  distinct from the client `generationId`; makes admission reject cancelling and
  finalizing entries; defines the lifecycle state machine, cancel reasons,
  idempotent single-settle cleanup, throwing-listener isolation, the stale-TTL /
  max-duration relationship, and the retained-`Settling` limitation. Reconciles
  the existing claim (`spec.md:53`) that a process-local stale sweep is a
  backstop for "a process crash that loses the in-memory timer along with the
  rest of the registry" — it cannot be, because the crash loses the sweep too.
- `backend-owned-generation-persistence`: requires the terminal save and its
  stop/error classification to be scoped to the finalizing generation's own
  operation identity rather than read by owner+path; defines the outcome when
  cancellation races normal completion or an already-dispatched save; states
  which fencing guarantees are process-local and which would require a verified
  DIAL Core contract; keeps the preflight-failure paths saveless.
- `observability-telemetry`: adds a bounded `state` attribute to the
  `dial.chat.generations.active` gauge and states that the gauge must not be
  read as evidence of durable persistence.

Reviewed as dependencies, **no delta required** — each is preserved as-is and
covered by regression tests rather than changed requirements:
`generation-live-replay` (snapshot-then-live attach, terminal delivery,
disconnect cleanup), `stop-generation-endpoint` (204/404 contract, stop
authorization, partial-answer marker), `generation-principal-ownership` (the
owner key and its log redaction are untouched), `generation-resume-on-refresh`
(resume path is unchanged), `responses-api-generation` (the Responses adapter
shares this single `finalize` path, so it inherits the fix without its own
requirement change).

## Impact

**Backend (`apps/chat-api`), the whole of the change:**

- `src/conversations/conversation-generation.service.ts` — lifecycle states,
  cancel reasons, operation identity, lease-scoped accessors, single settle path,
  derived stale TTL, stale cancellation.
- `src/conversations/streaming/conversation-streaming.service.ts` — consume the
  lease returned by `register()`; replace the owner+path reads at `:704` and
  `:755-760` with lease-scoped ones; keep `finalize` as the single terminal-save
  attempt; keep the two preflight release paths saveless.
- `src/conversations/conversation.controller.ts` — unchanged behaviour; touched
  only if the `abort()`/`attach()` signatures shift. The documented
  `BackpressureDetached` / `ClientClosed` release lifecycle from PR #8908 is
  **preserved verbatim**: its `SSE_RELEASE_TIMEOUT_MS` bound starts after
  generator finalization, bounds the transport only, and its
  `dial.chat.completion.response.terminations` counters are transport counters —
  this change neither redoes that work nor reinterprets those counters as
  persistence-success signals.
- `src/telemetry/runtime-metrics.ts` — bounded `state` attribute on the
  generations gauge.
- `src/config/environment.config.ts` — only if a finalization bound is
  introduced as a validated variable.

**Persistence interface.** `ConversationPersistencePort` exposes no cancellation
or conditional-write parameter (`conversation-persistence.port.ts:10-15`), and
`ConversationPersistenceService.saveConversation` performs an awaited
display-name-preservation **read** before its SDK write (`:103-108`, `:153-181`)
and then fire-and-forget schedules `ConversationNamingService.maybeRenameAfterFirstReply`
(`:130-137`), which is an independent asynchronous writer to the same path.
Inspection of the installed `@epam/ai-dial-typescript-sdk@0.1.1` shows DIAL Core
*does* declare ETag preconditions for this path — `saveConversation` accepts
`If-Match`/`If-None-Match` and can answer `412`, and both `saveConversation` and
`getConversation` return an `ETag` on `200`. That is the only candidate for real
storage-side fencing, and design.md evaluates it against the conservative option
rather than assuming it; it is **not** adopted in this change, and the reasons
and consequences are recorded there.

**Frontend: no change required — verified, not assumed.**
`useConversationStream.handleStop` signals the backend and deliberately keeps its
own completion fetch open, reloading from `onComplete` rather than after Stop
(`libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts:545-565`).
The controller ends that response only after the generator returns, which is
after the terminal save and registry release — so by the time the frontend
observes the stream ending, ownership is already free and a subsequent submit is
admitted. Regenerate is gated on not-streaming
(`ConversationView.tsx:675-687`), so no existing flow stops and immediately
restarts. In the one narrow window that does change — a client whose completion
fetch was already disconnected resubmitting during finalization — the backend
returns 409 and `create-chat-stream-api.ts:10,187` already maps it to
`GenerationConflictError`, rendered as the existing `generationConflictMessage`.
No lib-boundary change: the fix is entirely host-side backend behaviour.

**Docs, same change:** `docs/architecture.md` (generation lifecycle),
`apps/chat-api/README.md` (any new environment variable),
`docs/observability.md` (gauge attribute and the "retained ≠ persisted" reading).
Local, Git-excluded investigation notes to update:
`technical-debt-remediation-plan.md` item 2, `refactoring-backend.md`,
`refactoring.md`, `memory-leak-analysis-1.0.14.md`. The tracked OpenSpec
artifacts carry their own evidence and acceptance criteria and do not depend on
those files.

**Non-goals:** upload memory limits, deployment-cache invalidation, folder
fanout, general telemetry/dashboard expansion, typecheck repair (the separate
`make-typecheck-reproducible` work is untouched), frontend restructuring, and any
NestJS upgrade. No production mutation and no OOM-resolution claim is authorized
by this change.
