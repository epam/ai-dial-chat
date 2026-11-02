Slicing strategy: **risk-first**.

1. Pin today's preparation behaviour.
2. Prove the riskiest piece, the retained-ownership primitive with one bounded step, with deferred-operation tests.
3. Only then widen to the remaining steps, the cancellation and shutdown guards, HTTP and docs.

Each group is one slice. Run `npm run verify:changed` once when a slice is complete, together with the `apps/chat-api/AGENTS.md` §12 checks (`npm exec nx test chat-api`, `npm exec nx lint chat-api`). Run exactly one `npm run verify:full` at the end. Record pre-existing failures as found, and do not carry earlier passes forward as fresh results.

Conventions for every TypeScript change:

- Follow `apps/chat-api/AGENTS.md` (Logger, `ConfigService` with `infer: true`, typed exceptions, no `process.env`).
- Use extensionless relative imports.
- Use string enums for finite sets.
- Use `/* … */` for multi-line comments.

No `libs/*` file is touched.

## 1. Characterize current preparation behaviour (tests only)

- [x] 1.1 In `apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts`, inside the existing `describe('streamCompletion — cross-layer races against the real registry')`, add these proposed tests. Each uses a manually resolved deferred promise for `mockDialClient.client.getConversation`, with no fake-timer advancement past any bound:
  - `'a user Stop during a pending conversation read still persists a stopped partial once the read resolves'`. Asserts `realGenerationService.abort(...) === true` while pending, one start-state save, one terminal save with `wasStoppedByUser: true`, the stream opened, and the key released.
  - `'a max-duration cancellation during a pending read persists a non-user abort once the read resolves'`. Uses a 1000 ms `MAX_GENERATION_DURATION_MS` with fake timers and asserts `streamErrorMessage: ''`.
  - `'while preparation is pending the entry is owned and attachable'`. Asserts `register` throws `ConflictException` and `attach` returns the placeholder snapshot.

  **Verification:** `npm run test:file -- apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts`. All new tests pass against unchanged production code.

- [x] 1.2 In the same file, add the proposed test `'shutdown during a pending conversation read currently continues to write'`. It pins today's behaviour: after `realGenerationService.onModuleDestroy()` and the read resolving, `saveConversation` is still called. Mark it with a `/* Flipped by task 4.2 */` comment, because slice 4 deliberately inverts it.

  **Verification:** `npm run test:file -- apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts`

- [x] 1.3 In `apps/chat-api/src/conversations/tests/conversation-generation.service.spec.ts`, add the proposed `describe('preparation-phase entries')`:
  - `'an active entry is not swept or finalized while it waits'`: an `active` entry past `MAX_GENERATION_DURATION_MS` becomes `cancel_requested`, keeps its key, and `attach` still returns an attachment.
  - `'abort during preparation moves the entry to cancel_requested once'`.

  **Verification:** `npm run test:file -- apps/chat-api/src/conversations/tests/conversation-generation.service.spec.ts`

- [x] 1.4 Slice close: `npm run verify:changed`, `npm exec nx test chat-api`, `npm exec nx lint chat-api`.

## 2. Retained-ownership primitive plus one bounded step (stored-conversation read)

- [x] 2.1 Add `GENERATION_PREPARATION_TIMEOUT_MS?: number = 30_000` to `EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts`. Use `@IsOptional()`, `@Transform(({ value }) => parseInt(value, 10))`, `@IsInt()` and `@Min(1000)`, and add a block comment next to `GENERATION_FINALIZE_TIMEOUT_MS` describing the bound and that it does not cancel remote work. Add the commented `# GENERATION_PREPARATION_TIMEOUT_MS=30000` line to `apps/chat-api/.env.template` beside the other generation timeouts.

  Add the proposed tests `'defaults GENERATION_PREPARATION_TIMEOUT_MS to 30000'` and `'rejects GENERATION_PREPARATION_TIMEOUT_MS below 1000'` to `apps/chat-api/src/config/tests/validation.spec.ts`.

  **Verification:** `npm run test:file -- apps/chat-api/src/config/tests/validation.spec.ts`

- [x] 2.2 Add the `GenerationPreparationStep` string enum (`HiddenModelCheck = 'hidden_model_check'`, `CapabilityResolution = 'capability_resolution'`, `ConversationRead = 'conversation_read'`, `StartStateSave = 'start_state_save'`) to `apps/chat-api/src/conversations/generation/generation.types.ts`.

  **Verification:** covered by 2.3 and 2.4.

- [x] 2.3 In `apps/chat-api/src/conversations/conversation-generation.service.ts`, add the lease-scoped `abandonPreparation(lease, step: GenerationPreparationStep)`, following `requestFinalizationBound`'s callback. On a resolved entry whose resources are not yet released it does four things:
  - sets `Settling` and updates the gauge;
  - logs one `warn` with `logLabel` and `step`;
  - calls `releaseResources` with `stopped` for `UserStop`, otherwise `error`;
  - never calls `releaseKey`.

  It is a no-op otherwise. Update the doc comments on `GenerationLifecycleState.Settling` and the class comment so `settling` also covers an abandoned preparation. Add the proposed `describe('abandoned preparation — subscriber release without ownership release')` to `apps/chat-api/src/conversations/tests/conversation-generation.service.spec.ts`:
  - `'releases subscribers and keeps the key'`: `register` throws, `attach` returns `undefined`, `abort` returns `false`.
  - `'delivers stopped after a user Stop and error otherwise'`.
  - `'a later error(lease) releases the key and gauge exactly once'`.
  - `'is a no-op for a released or replaced lease'`.
  - `'logs the step without the owner key'`.
  - `'leaves no timer armed'` (`vi.getTimerCount() === 0` after settlement).

  **Verification:** `npm run test:file -- apps/chat-api/src/conversations/tests/conversation-generation.service.spec.ts`

- [x] 2.4 In `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`, inject `ConfigService<EnvironmentVariables>` and read `GENERATION_PREPARATION_TIMEOUT_MS` with `infer: true` and the `30_000` fallback. Then implement the deadline from design D1 and D2, applied to the `getConversationWithStoredVersion` step only:
  - one timer armed after `register` and cleared in a `finally` covering every preparation exit;
  - a private `ServiceUnavailableException` subclass (`GenerationPreparationInterruptedException`, also raised for the shutdown check in 4.2) that the existing pre-stream `catch` blocks rethrow without calling `error(lease)`;
  - on abandonment, `abandonPreparation(lease, GenerationPreparationStep.ConversationRead)`, a settlement observer on the pending promise (`debug` on resolve, `warn` with the error on reject, then `generationService.error(lease)`), and a throw of `ServiceUnavailableException('Generation preparation timed out')`.

  Update the service-construction sites in the spec files that instantiate `ConversationStreamingService` directly to pass a config stub. Add these proposed tests to a new `describe('streamCompletion — bounded preparation against the real registry')` in `apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts`, using a deferred `getConversation` and fake timers:
  - `'abandons a stalled conversation read with ServiceUnavailableException before onReadyToStream'`;
  - `'makes no start-state save and no upstream request after abandonment, even when the read later resolves'`;
  - `'keeps the key until the abandoned read settles, then admits a new register'`;
  - `'observes a late read rejection without an unhandled rejection and releases the key once'`;
  - `'releases an attach subscriber with an error terminal event at the deadline'`; old-lease isolation after re-registration is asserted inside the key-retention test;
  - `'a read that resolves before the deadline proceeds unchanged and clears the timer'`;
  - `'arms exactly one preparation timer and adds no abort-signal listener'` (assert `vi.getTimerCount()` before and after, and spy on the lease signal's `addEventListener`).

  **Verification:** `npm run test:file -- apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts`, then `npm run test:file -- apps/chat-api/src/conversations/tests/conversation-generation.service.spec.ts`

- [x] 2.5 Slice close: `npm run verify:changed`, `npm exec nx test chat-api`, `npm exec nx lint chat-api`, and `npm run build:quiet` (env validation changes Nest startup).

## 3. Extend the bound to the remaining preparation steps

- [x] 3.1 Apply the same deadline wrapper to `assertModelNotHidden` (`HiddenModelCheck`) and `resolveGenerationApiForDeployment` (`CapabilityResolution`). The capability `catch` keeps its `generationCapabilityResolutionTotal` `failed` increment for the sentinel but skips `error(lease)`. Add the proposed tests `'abandons a stalled hidden-model check'` and `'abandons a stalled capability resolution and still counts it as failed'` to the slice-2 `describe` in `apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts`. Give `mockDeploymentsService.resolveDeploymentItem` and `getDeploymentDetails` deferred promises.

  **Verification:** `npm run test:file -- apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts`

- [x] 3.2 Apply the wrapper to the non-background start-state `saveConversation` (`StartStateSave`). A save that *rejects* before the deadline keeps the existing warn-and-continue behaviour. A save still pending at the deadline abandons. Add these proposed tests:
  - `'abandons a stalled start-state save, keeps the key while the PUT is pending, and makes no terminal save'`;
  - `'a late successful start-state save releases the key and triggers no further write from the worker'`;
  - `'a start-state save that rejects before the deadline still streams'`, which keeps the existing behaviour.

  **Verification:** `npm run test:file -- apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts`

- [x] 3.3 Confirm the background branch clears the preparation timer at the `startAndRelay` handoff, and that a `BackgroundStartResult.Fallback` re-arms a fresh deadline for the stateless start-state save (design D2). Add the proposed test `'clears the preparation timer before the background placeholder save'` in a `describe('background start — preparation bound')` next to the existing `describe('background start')`.

  **Verification:** `npm run test:file -- apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts`

- [x] 3.4 Slice close: `npm run verify:changed`, `npm exec nx test chat-api`, `npm exec nx lint chat-api`.

## 4. No upstream request after cancellation, no continuation after shutdown

- [x] 4.1 In `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`, when preparation completes with `lease.abortController.signal.aborted`, skip building and invoking `relayModelCompletion` / `ResponsesAdapter.stream`. Take the existing `aborted` classification directly, keeping `onReadyToStream`, metrics and the single `finalize` (design D4). Extend the slice-1 tests from 1.1 to assert `sendChatCompletionRequest` and `createResponse` are not called. Add the proposed test `'a Responses-API generation stopped during preparation makes no Responses request'`.

  **Verification:** `npm run test:file -- apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts`

- [x] 4.2 After each preparation step settles in time, stop with `ServiceUnavailableException` when `generationService.getCancellation(lease)` is `undefined` (released by shutdown), making no further call. Flip the 1.2 test into `'makes no further write or request after shutdown releases the entry during the conversation read'`. Move the replaced-lease mock in `'falls back to the locally-held assembled message when the lease has been replaced, in the abandoned-generator branch'` to after the first chunk, because a lease released during preparation now stops the worker before streaming.

  **Verification:** `npm run test:file -- apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts`

- [x] 4.3 Slice close: `npm run verify:changed`, `npm exec nx test chat-api`, `npm exec nx lint chat-api`.

## 5. HTTP contract: pre-header failure and post-header release

- [x] 5.1 In `apps/chat-api/src/conversations/tests/completion-persistence.integration.spec.ts`, add a `describe('bounded preparation')`. It runs over the real loopback stack: controller, streaming service, registry and SDK against the fixture DIAL Core, which can hold a conversation read or write. It uses a 300 ms `GENERATION_PREPARATION_TIMEOUT_MS`. Tests:
  - `'responds 503 with no SSE headers when the conversation read stalls'`;
  - `'ends an attach made during a stalled preparation with an error event and refuses a later attach with 404'`;
  - `'rejects a new completion with 409 until the abandoned read settles, then accepts it'`;
  - `'refuses Stop with 404 after preparation was abandoned'`.

  These tests live here rather than in `apps/chat-api/src/conversations/tests/completions.integration.spec.ts`, because that suite replaces `ConversationService.streamCompletion` with a stub and so never runs preparation.

  **Verification:** `npm run test:file -- apps/chat-api/src/conversations/tests/completion-persistence.integration.spec.ts`

- [x] 5.2 In the same `describe('bounded preparation')`, add:
  - `'accepts a Stop during preparation, then streams and persists a stopped answer without calling the model'`, which covers Stop `204` followed by the original stream opening and closing;
  - `'makes the abandoned start-state save the only write, with no terminal save after it settles'`.

  **Verification:** `npm run test:file -- apps/chat-api/src/conversations/tests/completion-persistence.integration.spec.ts`

- [x] 5.3 Confirm that `apps/chat-api/src/conversations/conversation.controller.ts` needs no change (the pre-header branch already delivers the `503`) and that the `streamCompletion` `@ApiResponse` set is unchanged. If any Swagger text does change, run `npm run openapi` and `npm run openapi:check`, and build and lint `chat-api-client` per `apps/chat-api/AGENTS.md` §12. Otherwise record that no regeneration was needed.

  **Verification:** `npm run openapi:check`. Result: the controller and Swagger are unchanged, the check exits 0, and no regeneration was needed.

- [x] 5.4 Slice close: `npm run verify:changed`, `npm exec nx test chat-api`, `npm exec nx lint chat-api`.

## 6. Documentation and configuration docs

- [x] 6.1 Update `docs/architecture.md` ("Generation lifecycle and admission" and the paragraph after it): preflight is now bounded by `GENERATION_PREPARATION_TIMEOUT_MS`, abandonment retains the key in `settling` until the step settles, and the bound does not cancel remote work. Update `docs/observability.md` ("Process memory and outstanding work"): `settling` also covers an abandoned preparation, "does not bound preflight" now names the new variable, and the abandonment `warn` is an operator signal. No diagram encodes these states; confirm before finishing.

  **Verification:** `npm run validate:docs`

- [x] 6.2 In `apps/chat-api/README.md`, add a `GENERATION_PREPARATION_TIMEOUT_MS` row next to *every* occurrence of the `GENERATION_FINALIZE_TIMEOUT_MS` row (the file currently repeats its sections). Adjust the `MAX_GENERATION_DURATION_MS` and `GENERATION_FINALIZE_TIMEOUT_MS` rows that say they do not bound preflight. Do not deduplicate the README in this change.

  **Verification:** `npm run validate:docs`

- [x] 6.3 Slice close: `npm run verify:changed`, `npm run validate:docs`, `npm run validate:specs`.

## 7. Close-out

- [x] 7.1 Run `openspec validate bound-foreground-generation-preparation --strict` and fix any delta-format findings.

  **Verification:** the command exits 0.

- [x] 7.2 Run exactly one `npm run verify:full`. Record the real result, including any pre-existing failures with their test names.

  **Verification:** the `npm run verify:full` output.

  **Result (2026-10-28, single run):** `typecheck:full`, `lint:check` and `format:check` pass. `test:full` fails in two projects this change does not touch, while `@epam/chat-api:test` passes:
  - `@epam/ai-dial-catalog`: `libs/catalog/src/components/Catalog/tests/CreateButton.mobile.spec.tsx` › "announces the no-results label and clears the query on close" (no `role="status"` element);
  - `@epam/ai-dial-attachment-canvas`: `tests/package-boundary/bundle-budgets.spec.ts` › "stays within the eager-entry raw size budget" (69234 > 66500) and "stays within the OOXML-free unpacked size budget".

  Neither lib's files changed in this working tree, and libs cannot depend on `apps/chat-api`.

- [ ] 7.3 In the PR description, record:
  - the limits that remain: a never-settling step retains the key until restart, no upstream request is cancelled, a late-committing start-state save leaves an unresolved placeholder, the background placeholder save is unbounded, and fencing is process-local;
  - that this change makes no OOM-causality claim;
  - these follow-ups: threading the lease signal into the stored-conversation read, bounding the background placeholder save (queue item 08), and deduplicating `apps/chat-api/README.md`.

  **Verification:** the PR description lists each item.
