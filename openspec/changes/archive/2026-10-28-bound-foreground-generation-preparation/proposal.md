## Why

A non-background completion registers its generation and then awaits four preparation steps before it opens the SSE response: the hidden-model check, generation-capability resolution, the stored-conversation read and the unconditional start-state save. None of them receives the lease's abort signal and nothing bounds them. `MAX_GENERATION_DURATION_MS` only sets a cancellation flag, the stale sweep skips non-`active` entries, and `GENERATION_FINALIZE_TIMEOUT_MS` is armed only by `beginFinalizing`. If one step never settles, the entry, its attach subscribers (each with a 15 s keepalive), the originating request and the principal+path key are held until restart. The docs already list this as a known limit ("The timeout does not … bound preflight", `docs/architecture.md`). This change is queue item 02 and builds on the implemented late-attach fix (`2026-10-28-fix-generation-late-attach-release`, commit `9e0ab1715`).

## What Changes

- **A preparation deadline.** `ConversationStreamingService.streamCompletion` arms one timer right after `register` and clears it when preparation ends. Preparation ends at `onReadyToStream` on the foreground path, at the handoff to `BackgroundGenerationService.startAndRelay` on the background path, or when preparation fails. Each preparation step is awaited against that deadline. The current awaits are at `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts:634`, `:642`, `:660` and `:733`, `register` is at `:619` and `onReadyToStream` is at `:798`.
- **Abandonment keeps ownership.** If the deadline expires, the worker stops waiting and runs nothing after the pending step: no further preparation, no start-state save, no SSE headers and no upstream model request. A new lease-scoped registry method then releases subscribers and resources and moves the entry to the existing `settling` state while it keeps the key. It follows the finalization-bound pattern at `apps/chat-api/src/conversations/conversation-generation.service.ts:344` (`requestFinalizationBound`). The key is freed only when the abandoned step itself resolves or rejects, through the existing single settlement. A late rejection is observed and logged.
- **Pre-stream `503`.** The originating request fails with `ServiceUnavailableException` before any SSE header is sent. The controller's existing pre-header branch delivers it (`apps/chat-api/src/conversations/conversation.controller.ts:464`). Clients already treat any non-`409` pre-stream status as a generic failed send.
- **New env var.** `GENERATION_PREPARATION_TIMEOUT_MS` is optional, typed and validated (`@Min(1000)`), with a default of `30000`. That is well above normal preparation and below the 60 s pre-header read timeout common in ingress proxies, so the client sees our status rather than a proxy's. It is added to `apps/chat-api/src/config/environment.config.ts`, `apps/chat-api/.env.template` and the `apps/chat-api/README.md` env table.
- **Continuation is suppressed after shutdown or cancellation.** After every preparation step the worker checks that its lease still resolves. If shutdown has already released the entry, it stops there, with no start-state save and no relay. If the lease was aborted during preparation (Stop, maximum duration, stale expiry), the relay is not invoked and the generation goes straight to the existing `aborted` classification. Stop keeps its current observable behavior: `204`, then the original request opens its stream, persists the stopped partial and closes.
- **Left as they are:** `register`'s `409` on any present entry, lease isolation, the late-attach `404` from 01, the finalization bound, exactly one terminal write per generation, background conditional writes, the start-state "warn and continue" rule, pre-stream failure release for a step that *rejects*, shutdown settlement, and the Swagger document and generated client.
- Not breaking.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `generation-registry`: adds a requirement that bounds a preparing generation's subscriber and resource release with the preparation deadline, while an abandoned preparation's entry stays in `settling` and keeps its key until the abandoned operation settles. The present-entry/ownership requirement now covers settlement without a terminal write: a rejected or abandoned preparation.
- `generation-live-replay`: the attach `404` rule also covers a retained entry whose preparation was abandoned.
- `backend-owned-generation-persistence`: the pre-stream failure rules distinguish a step that *rejects* (release immediately, as today) from a step abandoned at the deadline (`503`, ownership retained until it settles). A new requirement says no upstream request is dispatched once the lease is cancelled or released during preparation, while the current Stop behavior is preserved.

## Problem

The table lists each preparation await. "Signal" means whether the call receives the lease's `AbortSignal`.

| Step | Call | Signal | Side effect if it settles late |
|---|---|---|---|
| Hidden-model check | `DeploymentsService.resolveDeploymentItem` (DIAL Core reads) | no | none (read) |
| Capability resolution | `getDeploymentDetails` (cached, in-flight requests shared across callers), two `FeatureFlagsService.isEnabled` calls, `getDeploymentInterfaces` | no | cache population only |
| Stored-conversation read | `ConversationPersistenceService.getConversationWithStoredVersion` | no | title-cache population |
| Start-state save | `ConversationPersistenceService.saveConversation`: a display-name read, an **unconditional PUT**, a title-cache write and LLM-naming scheduling | no | **a remote write** that can land at any later time |

A `Promise.race` timeout alone does not stop the PUT. Releasing the key when the timeout fires would let a replacement generation start and save. The late start-state body could then overwrite the replacement's answer. That is the stale overwrite `generation-registry` D2/D7 exists to prevent.

## Solution

Bound the *wait*, not the remote work. The worker stops waiting at the deadline, suppresses its own continuation, releases everything visible (attach subscribers, keepalives, timers, the originating HTTP request) and keeps the key until the abandoned step settles. The design compares this with propagating the abort signal into each step and with reusing `GENERATION_FINALIZE_TIMEOUT_MS`, and explains why both were rejected.

## Non-goals

- Cancelling an in-flight DIAL Core request, or claiming any upstream cancellation guarantee.
- Threading `AbortSignal` through `DeploymentsService` or the persistence port (recorded as a follow-up for the read-only conversation read).
- Bounding the background placeholder save inside `startAndRelay` (background path, queue item 08).
- Writing a terminal marker after a late start-state save commits, or retrying an ambiguous write.
- A new lifecycle state, a new telemetry instrument, cross-pod coordination, a global queue, or splitting the streaming service (queue item 09).
- Changing Stop, max-duration, stale-sweep or shutdown semantics beyond the continuation suppression described above.
- Client (`libs/chat-hooks`), UI, i18n, RTL or accessibility changes.
- Claiming this explains or fixes any observed production OOM.

## Acceptance criteria

- With a preparation step that never settles and `GENERATION_PREPARATION_TIMEOUT_MS` elapsed, the completion request responds `503` with `res.headersSent === false`. `sendChatCompletionRequest`/`createResponse` are never called, and no start-state save is dispatched after the deadline.
- In that state, existing attach subscribers receive exactly one terminal event (`error`, or `stopped` after a user Stop) and are released. A later attach responds `404`, `register` for the same principal and path throws `ConflictException`, and Stop responds `404`.
- When the abandoned step later resolves or rejects, the key is released exactly once, a rejection is logged rather than left unhandled, a new `register` succeeds, and the old lease cannot affect the new entry.
- One preparation timer exists per generation and is cleared on every path. No abort listener is added by preparation. `vi.getTimerCount()` returns to zero after settlement.
- A user Stop during a preparation that completes in time still yields `204`, an opened stream, a persisted `wasStoppedByUser: true` partial and no upstream model request.
- A shutdown during preparation causes no start-state save and no relay.
- Existing streaming, registry, persistence and integration suites pass unchanged except for tests deliberately updated for the behaviors above.
- `openspec validate bound-foreground-generation-preparation --strict`, `npm run validate:specs` and `npm run validate:docs` pass. `npm run verify:changed` passes per slice, and one final `npm run verify:full` passes.

## Impact

- **Code:** `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts` (the preparation deadline, the post-step ownership check and the relay guard), `apps/chat-api/src/conversations/conversation-generation.service.ts` (one lease-scoped retain method), `apps/chat-api/src/config/environment.config.ts`. The controller stays unchanged.
- **Tests:** `apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts`, `apps/chat-api/src/conversations/tests/conversation-generation.service.spec.ts`, `apps/chat-api/src/conversations/tests/completions.integration.spec.ts`, `apps/chat-api/src/conversations/tests/completion-persistence.integration.spec.ts`.
- **API:** a new `503` cause on `POST /api/v1/conversations/completions`, which already documents `503` ("DIAL Core unreachable"). Every preparation step is a DIAL Core request or app-config evaluation, so the description stays accurate. No schema, `operationId` or generated-client change, and no OpenAPI regeneration.
- **Clients:** they get the existing generic failed-send path instead of an indefinitely pending request. A start-state save that commits late leaves an unresolved placeholder, which current clients already handle through attach `404` and the bounded `watch` fallback.
- **Docs:** `docs/architecture.md` and `docs/observability.md` (preflight is now bounded; `settling` also covers an abandoned preparation), plus the `apps/chat-api/README.md` env rows and `apps/chat-api/.env.template`.
- **Libs / i18n / RTL / a11y / feature flags:** none.
- **Rollback:** revert the change. Unsetting the variable does not disable the bound, because the default applies. Setting it very high approximates the previous unbounded behavior without a code rollback. There is no data or schema migration. A reverted build ignores the leftover variable, because `apps/chat-api/src/config/validation.ts` does not reject unknown keys.
