## Context

Verified against `feat/9605-project-create-page` @ `78a20a8d9` (clean tree, 2026-10-28). The queue's October 28 audit was treated as evidence to recheck, and every claim below was re-read from source.

**Registry (`apps/chat-api/src/conversations/conversation-generation.service.ts`).**

- `releaseResources` sets `resourcesReleased`, clears both timers, invokes each raw `terminal` listener in isolation, then runs `emitter.removeAllListeners()`. It is guarded to run at most once.
- `settle` is `releaseResources` + `releaseKey`. `releaseKey` deletes the map entry and finishes the gauge tracker. It never touches the emitter.
- `requestFinalizationBound` (armed by `beginFinalizing`) moves the entry to `Settling` and calls `releaseResources` only. The key is retained, which is D7 of the archived `2026-09-21-fix-generation-eviction-lifecycle` design.
- `attach(ownerKey, path)` returns `{ assembledMessage, generationId, emitter }` for **any** entry in the map. It never checks `resourcesReleased`.
- `hasLocalForegroundGeneration` is true for any non-background entry in the map, `Settling` included.

**Controller (`apps/chat-api/src/conversations/conversation.controller.ts`, `attachToGeneration`).** For a local foreground entry it skips `resolveBackgroundAttach` and calls `attach()`. On `undefined` it throws `NotFoundException` before `startSseResponse`. Otherwise, in one synchronous step, it writes the snapshot, starts a `setInterval` keepalive and adds `chunk`/`terminal`/`close` listeners. Only `onTerminal`, `res 'close'` or backpressure end that subscription.

**The defect, traced.** Here is what happens when an attach arrives after the bound fired and while the save is still pending:

1. Listeners and the keepalive are added to an emitter that will never emit again.
2. When the save settles, `settle` → `releaseResources` returns immediately because `resourcesReleased` is already true. `releaseKey` does not touch the emitter.
3. The subscription lives until the client disconnects. If the save never settles, the `Settling` entry keeps the emitter, and with it the controller closures, alive for the process lifetime.

`docs/architecture.md`, `docs/observability.md` and `apps/chat-api/README.md` currently document this as an accepted limit. No test covers it. The `attach` describe block in `apps/chat-api/src/conversations/tests/conversation-generation.service.spec.ts` covers only absent, completed and replaced entries.

**Client recovery (`libs/chat-hooks/src/conversation/useConversationStream/generation-resume.ts`).**

- `runAttach` returns `false` on any request failure, including `404`. `resume` then runs `runWatch`, which re-reads the conversation and then waits for a storage `UPDATE` for up to `GENERATION_RESUME_WATCH_TIMEOUT_MS` (5 min) before a final read.
- When the attach stream delivers a terminal event, `runAttach` does one `finalCheck` read and finishes.
- When the stream ends without a terminal event, it falls back to `runWatch`.
- With no terminal event and no stream end, it waits indefinitely, which is deliberate. That is the client-visible half of this defect.

**Preceding changes preserved as-is:** the archived eviction-lifecycle design (D2 ownership until settlement, D4 one settle path, D7 bounded subscriber release with unbounded ownership) and the archived `2026-09-18-fix-completion-response-backpressure-lifecycle` design (D3, the bounded `releaseSseResponse` in attach cleanup). No active change touches these files. The active changes are `catalog-add-on-picker`, `allow-dotted-custom-api-core-path` and `extend-custom-api-operations`.

## Goals / Non-Goals

**Goals:**

- Once an entry's subscriber resources are released, no attach can create a listener, keepalive or SSE response for it.
- The result is deterministic and the same for every repeated attach: `404`, no SSE headers.
- Every invariant listed in the proposal is preserved: principal/path isolation, leases, retained-key `409`, single worker settlement, terminal delivery to earlier listeners, live replay, backpressure/disconnect cleanup and shutdown.

**Non-Goals:**

- Early release of ownership, replacement generation, persistence retry/CAS changes, a different finalization timeout, preparation-phase bounds (queue item 02), new lifecycle states, new telemetry, client/UI changes.
- Any claim about production memory or OOM behavior.

## Decisions

### D1 — A released entry is absent to `attach` (conservative absent result)

`attach` returns `undefined` when the entry is missing **or** `entry.resourcesReleased` is true. The controller's existing `404` branch then applies unchanged.

The guard keys on `resourcesReleased`, not on `lifecycleState === Settling`. The flag is the exact invariant: "no further terminal notification will ever run for this emitter". `Settling` is only today's sole way to reach it while the key is retained. If a future path releases resources while retaining the key, it inherits the guard with no further change.

**Re-entrant attach during release.** `releaseResources` sets the flag before it notifies listeners. So an `attach` called from inside a `terminal` listener is refused too, even though the key is still owned at that moment. Before this change it returned the emitter, and the release then dropped that listener without delivering a terminal event: the same defect, reached synchronously. The existing shutdown test `releases retained generations, timers, and listeners on module shutdown` asserted the old result. During apply it was reworded with the user's agreement. It keeps its original intent (the key is still owned during notification, checked through `hasLocalForegroundGeneration`) and now also asserts that the attachment is refused.

**Atomicity.** `attach()` and the controller's subscription run in one synchronous step: no `await` between `attach()` and `emitter.on(...)`. `releaseResources` runs only from synchronous callers or timer callbacks, so the event loop cannot interleave a release between the check and the subscription. An attach that passes the guard is therefore always reached by the later `releaseResources`.

**Alternatives compared.** Each was traced through the controller and `generation-resume.ts`:

| Option                                                                                                                                                                   | HTTP/SSE result for a released-but-owned entry                                                     | Client path (current and older clients)                                                                                                                                                                                                                                                            | Verdict                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **A. Absent → `404`** (chosen)                                                                                                                                           | `404`, no SSE headers, nothing armed                                                               | `runAttach` → `false` → `runWatch` re-reads, then waits ≤ 5 min for the real save's `UPDATE`, then a final read. This observes the eventual write.                                                                                                                                                  | Matches the existing spec ("including when a generation existed but already finalized") and Swagger text. Smallest diff, no state. |
| **B. Bounded stored terminal snapshot**: keep the bound's outcome on the entry, and on late attach write snapshot + stored terminal, then end                             | `200` SSE: snapshot, `error` (or `stopped`), end                                                   | `sawTerminal` → a single `finalCheck` read while the save is still pending. The reload shows the unresolved placeholder, and the client then shows a persistence warning (the "Legacy backend reports done but storage still has a placeholder" scenario) even though the write may still succeed. | Rejected. Sends a lossy `error` to clients that never needed it, and skips the `watch` that would see the real save.               |
| **C. Discriminated internal result** `{ kind: 'live', … } \| { kind: 'released' } \| undefined`                                                                          | Whatever the controller maps it to. Mapping to `404` is identical to A, mapping to a stream is B.  | Same as A or B                                                                                                                                                                                                                                                                                     | Rejected. Changes the `attach` signature and every caller/test with no consumer of the distinction (no telemetry is in scope).    |
| D. Open the stream and end it with no terminal event                                                                                                                     | `200` SSE: snapshot, end                                                                           | No terminal → `runWatch` (correct for the current client)                                                                                                                                                                                                                                          | Rejected. Violates "exactly one terminal event" on an opened stream, and opens a response only to discard it.                      |

### D2 — Route selection and Stop are unchanged

`hasLocalForegroundGeneration` keeps returning `true` for a retained non-background entry. As a result, attach for that path still skips `resolveBackgroundAttach`, so no storage read, and no recovery logic runs against a conversation whose foreground terminal write is in flight. The request falls through to `attach()` and gets `404`.

Making that predicate false would add a storage read on every late attach and would also change Stop routing. Stop on a retained entry stays `404`, because `abort` requires `Active`.

### D3 — Exact per-state contract

`POST /api/v1/conversations/completions/attach`, for the caller's `ownerKey + path`:

| Registry state                                                                    | `attach()` result | HTTP / SSE                                                                                                                      | `register` same key |
| --------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `Active` / `CancelRequested`                                                      | attachment        | `200`: snapshot (+ `generationId`), live chunks, exactly one terminal event, end                                                | `409`               |
| `Finalizing` (bound not elapsed)                                                  | attachment        | `200`: snapshot; no further chunks; one terminal event when the save settles **or** the bound elapses, whichever comes first    | `409`               |
| `Settling` (released but owned; resources released, save pending)                 | `undefined`       | **`404`** (`No active generation found for the given path`), no SSE headers, no listener, keepalive or `sse_active` contribution | `409` until the save settles |
| Absent (never registered, settled, other principal)                               | `undefined`       | `404` (unchanged); a `pending` background message still takes the background path                                               | admitted            |
| Background entry (any state)                                                      | not reached       | served by `resolveBackgroundAttach`, unchanged                                                                                  | unchanged           |

Shutdown settles every entry. Afterward an attach finds no entry and gets `404`, which is unchanged.

### D4 — No API schema or generated-client change

`404` is already a declared `@ApiResponse` of `attachToGeneration`, with the description "including one that already finished". From the client's side, a `Settling` entry has finished streaming and has delivered its terminal event to the subscribers it had. The Swagger text, `libs/chat-api-client/openapi.json` and the generated client are therefore left untouched, and `npm run openapi` / `openapi:check` are not required.

If review asks for the Swagger description to name the retained case explicitly, that is a description-only edit. It would require `npm run openapi`, `npm run openapi:check` and the `chat-api-client` build/lint from `apps/chat-api/AGENTS.md` §12, with no hand edit of generated files.

### D5 — Documentation follows the contract

Three docs currently assert the defect as a limit. Each will say that a retained entry admits no new attachment, which gets `404` and recovers through `watch`:

- `docs/architecture.md`, the "Generation lifecycle and admission" paragraph
- `docs/observability.md`, the `GENERATION_FINALIZE_TIMEOUT_MS` paragraph
- `apps/chat-api/README.md`, both `GENERATION_FINALIZE_TIMEOUT_MS` rows

`apps/chat-api/.env.template` and the `EnvironmentVariables` JSDoc make no claim about late attaches and stay unchanged. No diagram covers this path.

## Risks / Trade-offs

- **[Risk] A client attaching during `Settling` no longer sees the snapshot of partial content it previously got (along with a hang).** → It gets `404` and runs `runWatch`, which shows the stored conversation once the save lands, or after the 5-minute watch bound. That is strictly better than an indefinite hang. A one-shot snapshot is not worth reintroducing an unbounded subscription.
- **[Risk] A `Settling` entry whose save never settles keeps answering attach with `404` and register with `409` for the process lifetime.** → This is unchanged, deliberate ownership retention (archived D7). It stays visible as `state="settling"` on `dial.chat.generations.active`.
- **[Risk] A future path releases resources without the flag.** → `releaseResources` is the only writer of `resourcesReleased`, and every terminal-notification path goes through it. The new service tests pin the guard to the flag.
- **[Trade-off] A late attach and "already finished" give the same `404`.** → This is intentional. Telling them apart would expose server-internal retention to clients with no client behavior that needs it (option C).

## Migration Plan

1. Land the characterization tests. Mark the post-bound attach expectations as expected-failing (`it.fails`) or omit them until slice 2, so slice 1 stays green.
2. Add the guard and flip the expectations. Add the HTTP-level `404` coverage.
3. Run the resource-release and regression checks.
4. Update the docs and delta specs.

Deploy needs no flag and no coordination: the wire contract is unchanged, and every deployed client already handles attach `404`.

**Rollback:** revert the guard commit. Late attaches go back to hanging, and nothing persisted or cached depends on the new behavior.

## Open Questions

None blocking. The minor assumption, that the Swagger description stays as-is, is recorded in D4.
