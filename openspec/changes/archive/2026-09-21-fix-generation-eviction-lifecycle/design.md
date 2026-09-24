# Design — Safe generation eviction and finalization

## Context

`ConversationGenerationService` is an in-process `Map<string, GenerationEntry>`
keyed by `` `${ownerKey}::${path}` ``. Its full consumer surface is 12 call sites
in two files, which makes this a domain-local change rather than an
architectural one:

| Call site | Purpose |
|---|---|
| `conversation.controller.ts:426` | `abort` — the Stop endpoint |
| `conversation.controller.ts:468` | `attach` — the live-replay endpoint |
| `conversation-streaming.service.ts:437` | `register` |
| `:455`, `:485` | `error` — the two saveless preflight release paths |
| `:566`, `:576` | `seedAssembledMessage`, `applyChunk` |
| `:610`, `:616` | `complete` / `error` inside `finalize` |
| `:704`, `:755`, `:758` | `getStatus` / `attach` reads by **owner+path only** |

Three properties of the current code are the substance of the problem. First,
`removeEntry` (`:133-139`) frees the key, clears the max-duration timer and
decrements runtime tracking without cancelling anything, and `evictStale`
(`:168-176`) is its only unconditional caller. Second, `register` (`:187`)
rejects only `Active`, while `abort` (`:287`) leaves a `Stopped` entry in place —
so both expiry and Stop open a window in which a replacement is admitted over a
worker that has not finished writing. Third, the two reads at `:704` and
`:755-760` carry no generation identity, so an old worker's finalization reads
whatever entry currently occupies its key.

Constraints the design must not disturb:

- **Backend-owned generation.** A closed or backpressure-detached downstream
  response must never abort the generation or stop the controller's `for await`
  loop (`backend-owned-generation-persistence`). PR #8908's response-release
  lifecycle — `Streaming` / `ClientClosed` / `BackpressureDetached` / `Completed`,
  its `SSE_RELEASE_TIMEOUT_MS` bound that begins *after* generator finalization,
  and its four `dial.chat.completion.response.terminations` reasons — is
  preserved verbatim. Those are transport counters; nothing here reads them as
  evidence of a successful save.
- **Attach semantics.** `attach(ownerKey, path)` must keep returning a
  synchronously-consistent `{ assembledMessage, emitter }` pair, deliver exactly
  one terminal event per subscriber, and support unbounded subscribers
  (`emitter.setMaxListeners(0)`).
- **Principal isolation.** The owner key stays opaque to this service and never
  reaches a log line except as the 12-character digest (`:57-61`).
- **One terminal save attempt.** The preflight paths at `:455` and `:485`
  deliberately release without saving; that must not become a save.

## Goals / Non-Goals

**Goals**

1. For a registry owner+path, no replacement can overlap an old worker's ability
   to persist stale state — covering the start-state write, the terminal write,
   the awaited preparation read inside `saveConversation`, and the dependent
   asynchronous naming writer.
2. An old callback cannot inspect, mutate, remove, notify or decrement tracking
   for a replacement entry, including when the replacement reuses the same
   client-provided `generationId`.
3. Cleanup is idempotent across overlapping Stop, expiry, max-duration timeout,
   completion, error and shutdown, releasing timers, listeners and tracking
   exactly once, with a throwing terminal listener unable to block other
   listeners or essential cleanup.
4. Stale cancellation is never persisted as a user Stop.
5. Principal isolation and cross-conversation independence are unchanged, and a
   pre-stream conflict still fails before an SSE 200 is opened.
6. The stale TTL can never pre-empt a configured maximum generation duration.

**Non-Goals**

- A general task/job framework, a distributed lock, or cross-pod coordination.
  The registry is process-local and stays that way.
- Resolving the 2026-09-16 OOM, or any claim about it.
- Changing the HTTP contract, the frontend, or `libs/*`.
- Bounding safe ownership handoff when persistence never settles. Deliberately
  excluded — see Decision 6 and Risk R1.

## Decisions

### D1 — Internal operation identity, separate from the client `generationId`

`register()` mints a process-local `operationId` (monotonic counter, sufficient
because the registry is process-local and never compared across pods) and returns
a **lease**:

```ts
export interface GenerationLease {
  readonly abortController: AbortController;
  readonly operationId: number;
}
```

Every worker-facing method takes the lease instead of `(ownerKey, path,
generationId)` and matches on `entry.operationId === lease.operationId`:
`seedAssembledMessage`, `applyChunk`, `complete`, `error`, plus two new
lease-scoped readers that replace the identity-free reads at `:704` and
`:755-760`:

```ts
getCancellation(lease): { requested: boolean; reason?: GenerationCancelReason } | undefined
getAssembledMessage(lease): ConversationMessageDto | undefined
```

`abort(ownerKey, path, generationId)` and `attach(ownerKey, path)` keep their
signatures — they serve the public Stop and attach endpoints, which address a
generation the way a client can.

*Why not compare the client `generationId`?* It is client-supplied
(`SendCompletionDto.generationId`) and nothing prevents a later request from
reusing it, so it establishes addressability, not unique operation identity. The
`generationId` remains the public handle for Stop and for log correlation.

*Alternative rejected:* per-entry `AbortController` identity as the key. It
happens to be unique, but it conflates "cancellation channel" with "identity" and
gives nothing to log or assert on.

### D2 — Ownership until settlement; admission rejects any owned entry

An explicit named string enum replaces the overloaded `GenerationStatus` for
internal bookkeeping (`GenerationStatus` itself is preserved, because
`backend-owned-generation-persistence` maps its values to persisted markers):

```ts
export enum GenerationLifecycleState {
  Active = 'active',                   // admitted, upstream running
  CancelRequested = 'cancel_requested',// abort signalled, worker unwinding
  Finalizing = 'finalizing',           // terminal save dispatched
  Settling = 'settling',               // save never settled; retained, no resources
  Released = 'released',               // key freed
}

export enum GenerationCancelReason {
  UserStop = 'user_stop',
  StaleExpiry = 'stale_expiry',
  MaxDuration = 'max_duration',
  Shutdown = 'shutdown',
}
```

`register()` admits only when the key holds no entry. Any entry in `Active`,
`CancelRequested`, `Finalizing` or `Settling` is still owned by a worker (or by
an unsettled write) and yields the existing `ConflictException` → 409. Because
`Released` means "removed from the map", the rule collapses to: **a present entry
is always a conflict.** That is the whole of the fix for the Stop-then-replace
race, and it removes `register()`'s `if (existing) this.removeEntry(...)` branch
(`:192-194`) — the branch that made an unowned replacement possible.

`register()`'s conflict check runs before any `await` in `streamCompletion`, so
the 409 still propagates to the exception filter with `res.headersSent === false`
(`conversation.controller.ts:335-357`) and never opens an empty SSE 200.

*Alternative rejected — allow replacement but fence writes:* keeps today's
liveness and needs verified storage-side fencing for correctness (see D6). It is
the more capable design and the less provable one.

*Alternative rejected — serialize writes per key through an in-process queue:*
orders the two writes but does not make the *older* body lose. The old worker's
write would simply land last. Ordering is not fencing.

### D3 — Stale expiry cancels; it does not remove

`evictStale()` becomes `requestCancellationForExpired()`:

- For an entry past the stale threshold and still `Active`: transition to
  `CancelRequested` with `reason = StaleExpiry`, log at warn using the existing
  subject-free `logLabel`, and `abortController.abort()`. It does **not** clear
  the max-duration timer, does **not** delete the key, does **not** decrement
  tracking, and does **not** emit a terminal event — the owning worker's
  `finalize` still owns all of that, exactly once.
- An entry already in `CancelRequested`, `Finalizing` or `Settling` is left
  untouched: cancellation has already been requested and re-requesting it would
  be a second, pointless abort.

This is the point the remediation plan calls out as insufficient if done by
copying the shutdown path or by adding an unconditional `abort()` to every
`removeEntry` call. `onModuleDestroy` keeps its own distinct contract (D5) and
`removeEntry` keeps *no* abort — abort is requested by the four cancellation
entry points only, never as a side effect of release.

### D4 — One idempotent settle path

All terminal transitions funnel into one private method:

```
settle(entry, outcome: 'done' | 'error' | 'stopped')
```

guarded by a `settled` boolean on the entry so overlapping Stop, expiry, timeout,
completion, error, repeated cleanup and shutdown produce exactly one settlement.
In order: clear the max-duration timer; broadcast the terminal event over
`entry.emitter.rawListeners('terminal')`, each invocation in its own `try/catch`
logging a failure — generalizing the isolation that only `onModuleDestroy`
has today (`:150-161`) and fixing the bare `emit` at `:304` and `:330`, where a
throwing subscriber skips `removeAllListeners()` and `removeEntry()`;
`removeAllListeners()`; delete the key; call `finishTracking()` (already
self-idempotent, `runtime-metrics.ts:38-47`). `rawListeners` is retained over
`listeners` because it preserves `EventEmitter.once` wrappers, as the shutdown
path already documents.

`complete()` and `error()` keep their public names and their existing mapping to
persisted markers; they become thin lease-checked wrappers around `settle`.

**Terminal-event outcome is chosen from the cancel reason, not from a status
field.** Today `error()` infers a user stop from `entry.status === Stopped`
(`:328`), which any cancellation source can set. With reasons explicit, only
`UserStop` yields `{ type: 'stopped' }` / `wasStoppedByUser: true`;
`StaleExpiry` and `MaxDuration` yield `{ type: 'error' }` with
`streamErrorMessage: ''`, which is precisely the existing table's
"aborted for any other reason" row. The four persisted markers in
`backend-owned-generation-persistence` are unchanged in meaning.

### D5 — Race resolution: first terminal wins

The worker's `finalize` records that it has dispatched its terminal save
(`Finalizing`) before awaiting it. From that instant:

- A cancellation request of any reason is **recorded** (for logging and for the
  gauge) and does **not** change the persisted outcome, and does **not** trigger
  a second save. "Preserve one terminal save attempt" means exactly one.
- Conversely, a cancellation that arrives while still `Active` sets the reason
  before the worker reads it, and the worker's single subsequent read via
  `getCancellation(lease)` classifies the outcome. The read is lease-scoped, so
  it can only ever see its own entry.
- Normal completion racing a cancellation resolves the same way: whichever
  reaches `settle` first wins, the other is a no-op.

`onModuleDestroy` keeps its own contract, verified separately rather than reused:
process shutdown has no worker left to await, so it notifies every subscriber
with `{ type: 'stopped' }`, releases every resource, aborts every controller, and
**promises nothing about storage**. A shutdown or crash cannot assert that an
in-flight write did or did not commit. This is where the existing
`generation-registry` spec is wrong (`spec.md:53`): it names `evictStale` the
backstop for "a process crash that loses the in-memory timer along with the rest
of the registry", but a crash loses the sweep too. After a crash the registry is
simply empty and any in-flight write's fate is unknown; that is stated rather
than papered over.

### D6 — Conservative ownership, chosen over ETag fencing (evaluated, not assumed)

The prompt requires comparing conservative ownership against alternatives
supported by *actual* interfaces. Inspection of the installed
`@epam/ai-dial-typescript-sdk@0.1.1` found that a real conditional-write
primitive is declared:

- `operations['saveConversation']` accepts `If-Match` and `If-None-Match` headers
  and declares a `412 Precondition Failed — ETag mismatch` response.
- `saveConversation` `200` and `getConversation` `200` both declare an `ETag`
  response header, and the SDK's `SDKResponse` exposes the raw `response: Response`,
  so an ETag is readable. `SDKRequestInit.headers` accepts arbitrary headers, so
  `If-Match` is passable through the existing convenience wrapper.

| Option | Correctness | Risk | Retained resources | Recovery |
|---|---|---|---|---|
| **A. Conservative ownership until settlement** (chosen) | Process-local and complete: no replacement exists while an old worker can write, so there is nothing to fence. | Low — one service, no new interface, no external dependency. | An entry whose save never settles is retained (`Settling`) for the process lifetime. | Save settles → released; otherwise process restart. |
| **B. ETag compare-and-swap on every generation write** | Would fence at the storage layer *if* the deployed DIAL Core honours the declared preconditions. | High: unverified against a real deployment; `preserveLlmDisplayName` (`persistence/conversation-persistence.service.ts:153-181`) and the fire-and-forget `maybeRenameAfterFirstReply` (`:130-137`) are additional writers to the same path that would each have to join the CAS chain; a `412` has no safe automatic resolution — re-reading and retrying re-introduces the overwrite. | None extra. | Requires new ambiguity handling for every 412. |
| **C. In-process serialization per key** | Insufficient. Orders the writes; the older body still lands last. | Low | Queue depth. | n/a |

**Chosen: A.** It resolves every demonstrated race with process-local mechanisms
only, needs no interface change and no external claim. B is the only option that
could make bounded forced handoff *safe*, and it is deferred rather than
discarded: `ConversationPersistencePort` is left unchanged in this change, and
adopting B later requires (i) verifying `If-Match`/`412` against a real DIAL Core
deployment, (ii) bringing the display-name read and the naming writer into the
same CAS chain, and (iii) a defined 412 policy. Those are recorded in Open
Questions, not assumed here.

**What is guaranteed where.** Process-local: admission, operation identity,
cancellation propagation, single-settle cleanup, and the fact that no second
worker holds the key. **Not** guaranteed, and requiring a verified DIAL Core
contract to ever be guaranteed: that a write already handed to the SDK has not
committed. Concretely — a generation-ID or lease check placed *before*
`await saveConversation()` does not fence a write that has already been issued;
`Promise.race` with a timeout does not cancel it; and aborting the HTTP request
would not prove the storage server has neither committed nor will commit it. The
registry is not cross-pod coordination, and nothing here makes it so.

### D7 — Bounded subscriber release and upstream termination; unbounded ownership

Three bounds are deliberately distinguished:

| Bound | Guaranteed? | Mechanism |
|---|---|---|
| Upstream termination | **Yes** | `abortController.abort()` at every cancellation entry point. |
| Subscriber release | **Yes** | After `GENERATION_FINALIZE_TIMEOUT_MS` from entering `Finalizing`, the entry emits its terminal event, drops all listeners, clears its timer and releases runtime tracking — so no attach subscriber or SSE response is held by an unsettled save. |
| Safe ownership handoff | **No, by choice** | The key is **retained** as `Settling`. |

A `Settling` entry holds no timer, no listeners and no subscribers; it holds only
the key, and it keeps returning 409 for that principal and path. Releasing it
would readmit exactly the overwrite this change removes, so the honest outcome is
a retained entry, not a freed one. Ownership is never cleared merely to make the
gauge read zero. If the save later settles — resolve or reject — the entry moves
to `Released` and the path is admitted again; if it never does, recovery is a
process restart.

An ambiguous persistence failure (a rejection that does not distinguish
"not written" from "written") is treated as **settled**: ownership is released,
because the worker is demonstrably finished and holding the key buys nothing. The
existing behaviour of logging and swallowing a terminal save failure is preserved
(`streaming/conversation-streaming.service.ts:606-608`) with the explicit note
that a terminal event, a released entry, and a
`dial_chat_completion_response_terminations_total` point are each **not** proof of
durable persistence.

### D8 — Stale TTL derived from the configured maximum duration

```
staleTtlMs = max(STALE_ENTRY_TTL_FLOOR_MS /* 30 min */, maxGenerationDurationMs)
             + STALE_GRACE_MS
```

`MAX_GENERATION_DURATION_MS` is `@IsInt() @Min(1000)` with no upper bound
(`config/environment.config.ts:951-955`), so a configured 45 minutes currently
has its own timer cleared by the 30-minute sweep. Deriving the threshold makes
the ordering an invariant rather than a coincidence: the max-duration timer is
the primary bound on an `Active` generation, and expiry is strictly a backstop
for entries the timer could not cover.

**What triggers cleanup, stated plainly:** the sweep runs on `register()` only.
No per-request sweep timer and no queue are introduced, per the change's
constraints — so recovery of an in-process-orphaned entry depends on later
traffic from *some* principal, and a completely idle process never sweeps. The
max-duration timer, which is per-entry and traffic-independent, is what makes
this acceptable: it fires for any `Active` entry without needing another request.

### D9 — Truthful retained-entry telemetry

`dial.chat.generations.active` gains one bounded attribute,
`state`, taking only the five `GenerationLifecycleState` values. It still carries
no user, conversation, deployment, session or pod identifier and retains no
`Response`, socket or per-user key — the existing `runtime-metrics.ts` constraint
(`:21-24`). Its documented meaning stays "entries physically retained in the
registry, including stopped or aborted entries awaiting persistence"; the
attribute is what makes a `Settling` backlog visible instead of indistinguishable
from live work. `docs/observability.md` must state that a falling count is not
evidence of successful persistence.

## Risks / Trade-offs

- **R1 — A never-settling save retains ownership for the process lifetime, so
  that principal cannot generate on that path again.** → Accepted and documented,
  not mitigated away. Subscribers and resources are still released on a bound
  (D7), so the leak is one map entry, not a stream or a timer. It is visible as
  `state="settling"` on the gauge (D9), which is the operational signal to
  investigate. Adopting D6 option B is the only way to make forced handoff safe,
  and it requires the external verification listed in Open Questions.
- **R2 — Admission is strictly narrower: a submit during finalization now gets
  409 where it previously replaced the entry.** → Verified compatible with every
  existing frontend flow rather than assumed: `handleStop` keeps its completion
  fetch open and reloads from `onComplete`
  (`useConversationStream.ts:545-565`), regenerate is gated on not-streaming
  (`ConversationView.tsx:675-687`), and the window is bounded by the terminal
  save's duration. A disconnected client resubmitting inside that window gets a
  409 that `create-chat-stream-api.ts:10,187` already renders as
  `GenerationConflictError`. No frontend change; a controller/integration test
  pins the 409 rather than the old replacement.
- **R3 — Two existing registry tests assert the behaviour being removed.** →
  `'counts a replacement once when a stopped generation is overwritten'`
  (`tests/conversation-generation.service.spec.ts:490`) and
  `'stops counting a stale entry when a later registration evicts it'` (`:478`)
  both encode the unsafe replacement. They are replaced by tests that assert the
  new ownership policy, with the rationale recorded in the task — reviewed, per
  the change's instruction, rather than preserved.
- **R4 — The Responses adapter could diverge from the Chat Completions path.** →
  It cannot silently: both share the single `relayIterator`/`finalize` lifecycle
  in `streamCompletion` (`:614-660`). Coverage is required for both adapters so
  that stays true.
- **R5 — A regression in PR #8908's response-release lifecycle.** → Its tests
  (`tests/completion-response-lifecycle.spec.ts`,
  `tests/attach-generation-backpressure.spec.ts`,
  `streaming/tests/completion-response-metrics.spec.ts`) are reused unchanged as
  the guard. No new bound is layered onto the transport and its counters are not
  reinterpreted.
- **R6 — The generations gauge gaining an attribute could break a dashboard
  query.** → The gauge name and unattributed total are unchanged; the attribute
  is additive. `docs/observability.md` is updated in the same change.
- **R7 — A `finalize` bound that is too tight would release subscribers while a
  healthy slow save is still running.** → The bound only releases *resources*,
  never ownership, and never cancels or duplicates the save, so a slow-but-healthy
  save still completes and still releases the entry.

## Migration Plan

Vertical, risk-first: prove the races before changing behaviour.

1. **Characterize.** Add failing tests for each demonstrated race (expiry over a
   live worker, Stop-then-replace with a pending save, an old callback reading a
   replacement's status/message, a throwing terminal listener blocking cleanup,
   max duration above the stale TTL). Record the lifecycle/ownership table, the
   persistence-capability findings, and the D6 decision with its limitations.
2. **Ownership.** Land D1–D3 and D8 together: operation identity, the lease,
   lease-scoped readers replacing the owner+path reads, conservative admission,
   expiry-as-cancellation, derived stale TTL. This is the slice whose regression
   tests prove an old write cannot cross a handoff.
3. **Cleanup and cross-layer races.** Land D4, D5, D7, D9: single settle path,
   listener isolation, the finalize bound, the verified-separately shutdown
   contract, and the gauge attribute — with the full race matrix and
   multi-subscriber coverage.
4. **Specs, docs, verification.** Update the three delta specs,
   `docs/architecture.md`, `apps/chat-api/README.md`, `docs/observability.md`,
   run the repository checks, and record the operational-validation and rollback
   procedure.

**Rollback.** A revert of the `apps/chat-api` commits; no migration, no
persisted state and no HTTP contract to undo, and the env variable (if added) is
optional with a default. In-flight implications, stated because a revert is not
free for work already running: reverting restores the permissive `register()`, so
a generation that is finalizing across the deploy can again be replaced and its
older body written last. Any rollback should therefore drain — stop accepting new
completions and let in-flight generations settle — before the revert, and
`state="finalizing"`/`state="settling"` on the gauge is the drain signal. A pod
restart at any point clears the registry; per D5 nothing can then be asserted
about an in-flight write.

## Open Questions

1. **Does the deployed DIAL Core honour `If-Match` / return `412` for
   `saveConversation`?** The installed SDK's OpenAPI declares it; that is a
   contract declaration, not a verified deployment behaviour. Resolving this is
   the precondition for ever adopting D6 option B, and therefore for any bounded
   forced ownership handoff. Requires a controlled check against a real
   deployment — explicitly out of scope here.
2. **If 412 fencing were adopted, what is the policy on a 412?** Re-read and
   retry re-introduces the overwrite; failing the save loses the answer. Needs a
   decision before B is viable.
3. **Should `maybeRenameAfterFirstReply` be awaited or made cancellable?** It is
   an independent fire-and-forget writer to the same path
   (`persistence/conversation-persistence.service.ts:130-137`) and can write
   after a generation has released ownership. It writes only `name` /
   `llmNamingDone`, so it does not overwrite message content and is not part of
   the race this change fixes — but it is the one writer that could invalidate a
   future CAS chain. Deliberately left unchanged; it must be named as an
   unrelated writer in the spec rather than silently assumed harmless.
4. **What should `GENERATION_FINALIZE_TIMEOUT_MS` be, and should it be
   configurable?** A default in the tens of seconds is ample for a normal save;
   the value only bounds resource release, never ownership.
5. **Production unknowns that remain open.** Whether unsettled saves occur in
   production at all, and the 2026-09-16 OOM's actual cause. Neither is
   answerable from source, and neither is claimed by this change.
