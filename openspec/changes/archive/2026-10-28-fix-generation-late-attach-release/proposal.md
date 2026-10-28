## Why

`ConversationGenerationService.attach` returns any entry present in the registry, including a `Settling` entry whose finalization bound has already delivered the terminal event and removed every listener. `releaseResources` is guarded to run once, so the eventual real settlement never notifies or removes a listener added afterward. A client that attaches in that window gets an SSE stream with a snapshot, an unbounded keepalive and two emitter listeners that nothing will ever end except its own disconnect. The documentation already records this as a known limit ("A late attachment can still join a retained entry after terminal notification", `docs/architecture.md`). This change closes it. It is the first slice of the generation lifecycle queue.

## What Changes

- `attach(ownerKey, path)` treats an entry whose subscriber resources were already released as absent and returns `undefined`. Today that is only a `Settling` entry. Nearest existing logic: `apps/chat-api/src/conversations/conversation-generation.service.ts:484` (`attach`), the guard pattern at `:244` (`releaseResources`) and `:342` (the finalization-bound timer callback).
- `POST /api/v1/conversations/completions/attach` therefore responds `404` with no SSE headers for a released-but-owned entry. This is the response the endpoint already gives for "a generation existed but already finalized". The controller's route selection in `apps/chat-api/src/conversations/conversation.controller.ts:555` stays as it is: a local non-background entry is still answered from the registry, without a storage read or background recovery.
- The following are left as they are: the retained key and its `409` from `register`, the owning worker's single settlement, lease-scoped worker methods, Stop on a retained entry (still `404`, because it is not `Active`), terminal delivery to listeners subscribed before the bound, snapshot-plus-live replay for `Active`/`CancelRequested`/`Finalizing` entries, backpressure and disconnect cleanup, and shutdown.
- Tests will characterize a late attach after the bound while persistence is still pending, repeated late attaches, a normal attach during `Finalizing`, and the HTTP `404` with no listeners or timers left behind.
- The `generation-registry` and `generation-live-replay` contracts, plus the three docs that describe this as a known limit, will be updated to match.
- No HTTP status, schema or generated-client change. **Not breaking.**

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `generation-registry`: subscriber release is bounded for attaches that arrive after the finalization bound too. A retained entry admits no new subscriber, but it keeps ownership and keeps returning `409`.
- `generation-live-replay`: the attach `404` rule explicitly covers a generation whose subscribers were already released while its terminal write is still pending.

## Problem

A late attach on a `Settling` entry starts a listener pair and a 15-second keepalive interval that no server-side path ever clears. It stays alive until the client disconnects, which can be indefinite for a stuck tab. Meanwhile it reports `dial_chat_sse_active{kind="generation_attach"}`. The client also never receives a terminal event, so `runAttach` in `libs/chat-hooks/src/conversation/useConversationStream/generation-resume.ts` waits on purpose with no timeout and never falls back to `watch`, which is the path that would observe the real save.

## Solution

Take the conservative absent result. After resources are released, `attach` returns `undefined` and the controller's existing `404` branch handles it. The design weighs this against a stored terminal snapshot and a discriminated internal attach result. Both were rejected: the first sends clients into a premature terminal reload, the second adds surface with no behavioral difference.

## Non-goals

- Releasing, replacing or deleting the owner entry early, or starting a replacement generation.
- Changing persistence retry, CAS/`If-Match` policy, the finalization timeout value or bounds on the preparation phase (queue item 02).
- Adding a new state manager, lifecycle state or telemetry instrument.
- Changing the client (`libs/chat-hooks`), the UI or i18n.
- Claiming this fixes any observed production OOM. It removes one locally reproducible unbounded subscriber path. Whether it contributes to production memory growth is not established.

## Acceptance criteria

- With `GENERATION_FINALIZE_TIMEOUT_MS` elapsed and the terminal save still pending, `attach` returns `undefined` and the endpoint returns `404` with `res.headersSent === false`. The emitter has no listeners, no keepalive or other timer is armed, and `dial_chat_sse_active{kind="generation_attach"}` does not grow.
- Repeating that attach any number of times gives the same result.
- `register` for the same principal and path still throws `ConflictException` until the real save settles. After that it succeeds. A late `complete`/`error`/`persistenceFailed` on the old lease cannot affect a later lease's entry.
- Attaches during `Active` and `Finalizing` (before the bound) still receive snapshot, chunks and exactly one terminal event. Existing replay, backpressure, disconnect and shutdown tests pass unchanged.
- `npm run verify:changed` passes per slice, `npm run validate:docs` and `npm run validate:specs` pass, `openspec validate fix-generation-late-attach-release --strict` passes, and one final `npm run verify:full` passes.

## Impact

- **Code:** `apps/chat-api/src/conversations/conversation-generation.service.ts` (one guard plus doc comment), and tests under `apps/chat-api/src/conversations/tests/`. The controller is expected to stay unchanged apart from possibly a comment.
- **API:** no wire change. `404` is already a documented response of `attachToGeneration`, and its Swagger description ("including one that already finished") covers this case, so neither `libs/chat-api-client` regeneration nor an OpenAPI diff is planned.
- **Clients:** current and older clients already treat attach `404` as "fall back to `watch`". They now reach the path that observes the eventual save instead of hanging.
- **Docs:** `docs/architecture.md`, `docs/observability.md` and `apps/chat-api/README.md` (two `GENERATION_FINALIZE_TIMEOUT_MS` rows) drop the "late attachments are not bounded" caveat.
- **Libs / i18n / RTL / a11y:** none. No new user-visible strings.
- **Rollback:** revert the single guard and its tests and docs. The previous behavior (a hanging late attach) returns, and no data or schema migration is involved.
