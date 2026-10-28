Slicing strategy: **risk-first**. Slice 1 proves the defect and pins today's correct behavior with the highest-risk timing (fake timers plus a deferred, never-settling save) before any production edit. Slice 2 makes the one-guard change and widens to HTTP. Slice 3 proves resource release and that existing subscribers see no regression. Slice 4 aligns the contracts and docs.

Conventions for every slice: follow `apps/chat-api/AGENTS.md` (§11 tests, §12 verification). Use Vitest only, keep imports extensionless, and use no `.test.ts` files. Tests go in `apps/chat-api/src/conversations/tests/`. Do not touch `libs/*`, `apps/chat`, the generated client or `openspec/specs/**` before archive.

## 1. Characterize late attach against a retained entry (tests only)

- [x] 1.1 In `apps/chat-api/src/conversations/tests/conversation-generation.service.spec.ts`, add a `describe('attach after the finalization bound', …)` block (**proposed addition**). It uses `vi.useFakeTimers()`, a service built with `makeConfigService({ GENERATION_FINALIZE_TIMEOUT_MS: 5000 })`, and a local deferred-promise helper that stands in for the pending terminal save. The save is never resolved, and the test calls `complete(lease)` only after an explicit `resolve()`. Cover:
  - (a) Attach during `Finalizing` before the bound: it returns the attachment, and its `terminal` listener fires exactly once when the bound elapses.
  - (b) Attach after the bound while the save is pending: it returns `undefined`, `attachment.emitter`/entry listener count stays 0, `vi.getTimerCount()` is 0, and `register` for the same owner and path still throws `ConflictException`.
  - (c) Three repeated late attaches each return `undefined`.
  - (d) After `resolve()` + `complete(lease)`, `register` for the same key succeeds, and a second `complete`/`error`/`persistenceFailed` on the old lease leaves the new entry's `attach`, `getStatus` and gauge unchanged.
  - (e) `hasLocalForegroundGeneration(OWNER_KEY, PATH)` stays `true` and `abort(...)` returns `false` for the retained entry.
  - (f) Another owner's attach on the same path during the window returns `undefined`, and that owner's own active entry is unaffected.

  Write (b) and (c) as `it.fails(...)` so the slice stays green against current code. They document the defect and are flipped in 2.1.
- [x] 1.2 Leave existing tests unchanged, in particular `finalization bound — subscriber release without ownership release` and `race matrix — overlapping cleanup paths settle an entry exactly once`. Do not weaken any existing assertion.
  - Apply note: (f) was also written as `it.fails`, because its first assertion depends on the guard. In 2.1 the shutdown test `releases retained generations, timers, and listeners on module shutdown` asserted that an attach from inside a `terminal` listener returns an attachment. With the user's agreement it was reworded rather than weakened: it still checks that the key is owned during notification, and it now also asserts that the attachment is refused (design D1, "Re-entrant attach during release").

### Verification

- `npm run test:file -- apps/chat-api/src/conversations/tests/conversation-generation.service.spec.ts`. Every new non-`fails` case passes, and the `it.fails` cases are reported as expected failures.
- `npm run verify:changed` once for the slice. Record any pre-existing failure with its output instead of treating it as fresh.

## 2. Refuse attachments to a released entry (registry guard + HTTP contract)

- [x] 2.1 In `apps/chat-api/src/conversations/conversation-generation.service.ts`, change `attach` to return `undefined` when the entry is absent **or** `entry.resourcesReleased` is true. Key the check on the flag, not on `lifecycleState` (design D1). Update the `attach` JSDoc: "no entry, or one whose subscribers were already released while its key is retained". Also update the `GenerationEntry.resourcesReleased` field comment to say it gates `attach`. Do not change `register`, `releaseResources`, `releaseKey`, `settle`, `requestFinalizationBound`, `hasLocalForegroundGeneration`, `abort` or any lease-scoped method. Convert the `it.fails` cases from 1.1 to plain `it`.
- [x] 2.2 Leave `apps/chat-api/src/conversations/conversation.controller.ts` `attachToGeneration` logic unchanged (design D2). Optionally add one comment line at the `!attachment` branch saying that it also covers a retained entry whose subscribers were released. Do not change `@ApiResponse`/`@ApiOperation` text (design D4). If review requires a Swagger wording change, add tasks to run `npm run openapi`, `npm run openapi:check`, `npm exec nx build chat-api-client -- --skip-nx-cache` and `npm exec nx lint chat-api-client`, and never hand-edit `libs/chat-api-client`.
- [x] 2.3 In `apps/chat-api/src/conversations/tests/attach-generation.integration.spec.ts`, add a `describe` block (**proposed addition**) that builds its own testing module with `ConfigService.get` returning `GENERATION_FINALIZE_TIMEOUT_MS: 1000`, the configured minimum, and otherwise mirrors the existing `beforeEach`. Use `vi.useFakeTimers({ toFake: ['setTimeout'] })` only around `register` + `beginFinalizing` + `vi.advanceTimersByTime(1000)`, and restore real timers before issuing supertest requests. Cover:
  - (a) `POST /conversations/completions/attach` returns `404` with the existing message and no `text/event-stream` content type, for two consecutive requests.
  - (b) `resolveBackgroundAttach` was not called.
  - (c) `register` for the same owner and path still throws `ConflictException`, and after `complete(lease)` an attach returns `404` and `register` succeeds.
  - (d) A header-authenticated owner sees the same `404`. Reuse the existing `header-authenticated caller` setup pattern.

  The existing `returns 404 when the generation already finished before attach arrives` and live-replay cases stay unchanged.

### Verification

- `npm run test:file -- apps/chat-api/src/conversations/tests/conversation-generation.service.spec.ts apps/chat-api/src/conversations/tests/attach-generation.integration.spec.ts`
- `npm exec nx test chat-api` and `npm exec nx lint chat-api`. Nest startup and bundling are unaffected, so `npm exec nx build chat-api` and `npm run build:quiet` are not required.
- `npm run verify:changed` once for the slice.

## 3. Prove listener/timer release and no regression for existing subscribers

- [x] 3.1 In `apps/chat-api/src/conversations/tests/attach-generation-backpressure.spec.ts`, extend `makeController` with an optional config override (**proposed addition**, test helper only) so the generation service can get `GENERATION_FINALIZE_TIMEOUT_MS`. Add a `describe('attachToGeneration — retained entry after the finalization bound', …)` (**proposed addition**) using `vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearInterval'] })`. Cover:
  - (a) A subscriber attached before the bound receives exactly one `error` (or `stopped` after `abort`) terminal frame when the bound elapses. Its keepalive interval is cleared, its response is ended through the bounded release, and `dial_chat_sse_active{kind="generation_attach"}` returns to its prior value.
  - (b) A subscriber whose client disconnects (`res.emit('close')`) before the bound releases its listeners once. The bound then delivers nothing to it and does not re-end it.
  - (c) A controller attach after the bound rejects with `NotFoundException` before any header is written (`headersSent` false, no SSE frame). No interval is armed (`vi.getTimerCount()` unchanged by the call), and the entry's emitter has zero listeners.
  - (d) After `complete(lease)`, nothing writes to any of those responses again.

  Existing slow-subscriber, bounded-destroy, idempotent-cleanup and background-replay cases stay unchanged.
- [x] 3.2 Run `apps/chat-api/src/conversations/tests/completion-response-lifecycle.spec.ts` as an unchanged regression gate. It drives `streamCompletion` against a mocked generation service, so the registry guard cannot change its behavior. No new case is planned there. If 2.1 forces any edit to it, stop and record why, because that would contradict design D2.

### Verification

- `npm run test:file -- apps/chat-api/src/conversations/tests/attach-generation-backpressure.spec.ts apps/chat-api/src/conversations/tests/completion-response-lifecycle.spec.ts apps/chat-api/src/conversations/tests/attach-generation.integration.spec.ts apps/chat-api/src/conversations/tests/conversation-generation.service.spec.ts`
- `npm exec nx test chat-api` and `npm exec nx lint chat-api`
- `npm run verify:changed` once for the slice.

## 4. Align documentation with the contract

- [x] 4.1 In `docs/architecture.md` ("Generation lifecycle and admission", the paragraph after it), replace "A late attachment can still join a retained entry after terminal notification and is not covered by the expired timer." with a statement that a retained entry admits no new attachment. Such an attach gets `404`, and the client falls back to `watch`.
- [x] 4.2 In `docs/observability.md` (the `GENERATION_FINALIZE_TIMEOUT_MS` paragraph under process memory and outstanding work), drop "or attachments created after its terminal notification" from the list of things the timeout does not bound. Add that attaches to a `settling` entry are refused with `404` and add no `generation_attach` SSE subscription.
- [x] 4.3 In `apps/chat-api/README.md`, change both `GENERATION_FINALIZE_TIMEOUT_MS` table rows (environment table and configuration reference): replace "This does not bound attachments created after the timeout." with "Later attaches to the retained entry receive `404`." Leave `apps/chat-api/.env.template` and the `EnvironmentVariables` JSDoc unchanged (no late-attach claim). No diagram covers this path.
  - Apply note: after the working tree moved to `development` @ `41fdcf8a8`, the README held four such rows instead of two. All four were updated, so the intent is unchanged.
- [x] 4.4 Keep the delta specs in `openspec/changes/fix-generation-late-attach-release/specs/` as the only spec edits. Do not edit `openspec/specs/generation-registry/spec.md`, `openspec/specs/generation-live-replay/spec.md` or the archived `2026-09-21-fix-generation-eviction-lifecycle` and `2026-09-18-fix-completion-response-backpressure-lifecycle` changes. Main specs change only at archive or sync.

### Verification

- `npm run validate:docs`
- `npm run validate:specs`, plus advisory `npm run spec:impact`. Record its output.
- `openspec validate fix-generation-late-attach-release --strict`
- `npm run test:file -- apps/chat-api/src/conversations/tests/conversation-generation.service.spec.ts` (doc-only slice, regression confirmation)
- `npm run verify:changed` once for the slice.

## 5. Close the change

- [x] 5.1 Run exactly one `npm run verify:full` after slices 1–4 are complete. Record actual pass/fail and the coverage reported for `chat-api`, and list any pre-existing failure with its output rather than inheriting earlier passes.
  - Result (2026-10-28, `development` @ `41fdcf8a8` plus this change's working tree):
    - `typecheck:full`, `lint:check` and `format:check` PASS.
    - `test:full` FAIL, exit 1. `@epam/chat-api:test` passed: 5614 tests in the per-slice Nx run, and green in the full run.
    - The two failures are in `@epam/ai-dial-attachment-canvas`, with `dist` rebuilt in the same run:
      - `tests/package-boundary/bundle-budgets.spec.ts`, "stays within the eager-entry raw size budget": `expected 69234 to be less than or equal to 66500`.
      - `tests/package-boundary/package-artifact-size.spec.mjs`, "stays within the OOXML-free unpacked size budget": `expected 255254 to be less than or equal to 242000`.
    - Both reproduce on their own with `npm run test:file`. This change touches no file under `libs/`, so the failures pre-exist on that HEAD and are outside this change's scope.
    - `test:full` reports no coverage, so no coverage figure is claimed.
    - Earlier, the slice-1 `verify:changed` timed out once in `apps/chat-api/src/skills/tests/skills.controller.spec.ts` (5 s). It passed in isolation and in every later run: load flakiness, unrelated.
- [x] 5.2 Record a follow-up for queue item 02 (`bound-foreground-generation-preparation`) and do not implement it here: recheck it against this guard, since preparation-phase bounds may also release resources while retaining the key.
  - Follow-up: item 02 must reuse `resourcesReleased` as the single gate. Any new bound that releases subscribers while it keeps the key goes through `releaseResources`, so `attach` refuses it with no extra check. Its proposal should cite design D1 of this change.
