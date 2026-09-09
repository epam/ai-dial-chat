## 1. Config

- [x] 1.1 Add `MAX_GENERATION_DURATION_MS` to `apps/chat-api/src/config/environment.config.ts` (`EnvironmentVariables`), validated, with a documented default (30 minutes); update `apps/chat-api/README.md` and `apps/chat-api/.env.template` per the same-change docs rule.

## 2. `ConversationGenerationService` — remove disconnect-abort, add max-duration bound

- [x] 2.1 Delete `abortSignal()` from `apps/chat-api/src/conversations/conversation-generation.service.ts` — confirm via grep that its only call site is the controller code removed in task 3.1 before deleting.
- [x] 2.2 Add a per-entry timer to `GenerationEntry`, started in `register()`, that after `MAX_GENERATION_DURATION_MS` aborts the entry's `AbortController` and calls `error()` if the entry is still `Active` at that point.
- [x] 2.3 Clear the timer as the first step of `complete()`, `error()`, and `abort()` so a normal-speed terminal transition never lets it fire.
- [x] 2.4 Update/add unit tests in the service's spec file: normal completion clears the timer; a stalled generation past the threshold finalizes as `Error` and releases the registry entry; disconnect (simulated by *not* calling any registry method) has no bearing on the timer firing or not firing.

## 3. `ConversationController.streamCompletion` — detach instead of abort

- [x] 3.1 Replace the `handleClose`/`isClientAborted` logic in `streamCompletion` (`apps/chat-api/src/conversations/conversation.controller.ts`) with an `isResponseDetached` flag that is set on `res.on('close', ...)` and does not call any generation-service method.
- [x] 3.2 Remove the `if (isClientAborted) break;` from the `for await` loop; keep iterating unconditionally to the generator's natural end. Guard `res.write` so that when detached it is skipped, and wrap the call so a write that itself throws (destroyed socket) also sets `isResponseDetached` rather than propagating.
- [x] 3.3 Skip the trailing `res.end()` when the response is already detached/destroyed.
- [x] 3.4 Confirm `attachToGeneration` and `watchConversation` in the same controller are unchanged — their disconnect-aborts-own-work behavior is correct and out of scope.

## 4. `ConversationStreamingService.streamCompletion` — verify the `finally` branch narrows correctly

- [x] 4.1 Re-read the `finally` block (around `conversation-streaming.service.ts:723-753`) against the change in section 3: confirm no code change is needed there, since the controller no longer abandons the consuming loop on disconnect — the branch is now reached only by a genuine abnormal termination (e.g. an unexpected exception between `yield` and `relayIterator.next()`).
- [x] 4.2 If tracing reveals any other path that still abandons the loop specifically because of a closed response (e.g. via `res.write` throwing and propagating before task 3.2's guard is in place), fix that path so it no longer does.

## 5. Backend tests

- [x] 5.1 In `apps/chat-api/src/conversations/tests/completions.integration.spec.ts`, replace the `'aborts the generation signal when the client disconnects mid-stream'` test (destroys the real client socket after the first chunk, then asserts `mockGenerationService.abortSignal` was called) with a regression test that destroys the socket the same way, lets the mocked `streamCompletion` continue emitting chunks and a final `[DONE]`, and asserts: no abort-signal-equivalent method is called on the generation service, the full assembled message is persisted, and the registry entry is released as `Done`.
- [x] 5.2 Remove any remaining references to `abortSignal` in `apps/chat-api/src/conversations/tests/completions.integration.spec.ts`'s mock setup once the deleted method (task 2.1) makes them a type error.
- [x] 5.3 In `apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts`, update the test at `'finalizes as an error and releases the registry entry when the consumer abandons the stream mid-generation (e.g. client disconnect)'` (~line 1418) — rename/reframe it to abandon the consumer for a reason other than a closed response (since a closed response no longer causes abandonment), so the `finally` branch's genuine-abandonment behavior stays covered.
- [x] 5.4 Add a test confirming a completion request whose downstream response is destroyed mid-stream (using the same disconnect simulation as 5.1, at the service level if it's more direct than the integration test) still drives the relay to `[DONE]` and calls `finalize(GenerationStatus.Done, ...)`.
- [x] 5.5 Ensure coverage exists for both the Chat Completions relay path (`relayModelCompletion`) and the Responses API path (`ResponsesAdapter.stream`) for the disconnect-does-not-abort scenario, per the existing pattern of parallel test coverage for both APIs in this spec file. (Verified: both adapters return the identical `{outcome, assembledMessage}` shape into the shared, adapter-agnostic `try/finally`+`switch` in `ConversationStreamingService.streamCompletion` that the 5.3/5.4 tests exercise — no adapter-specific branching exists in the code under test, so a duplicate Responses-path test would cover the same lines without added assurance; not added, to avoid a redundant test per AGENTS.md.)
- [x] 5.6 Update `apps/chat-api/src/conversations/conversation-generation.service.spec.ts` (or the sibling `tests/conversation-generation.service.spec.ts` — confirm which is canonical) to remove `abortSignal` coverage and add the max-duration-timeout coverage from task 2.4.
- [x] 5.7 Confirm the existing `stopCompletion`/explicit-Stop tests are unaffected (they exercise `abort()`, not `abortSignal()`).

## 6. Spec corrections

- [x] 6.1 Verify `openspec/specs/generation-registry/spec.md` and `openspec/specs/backend-owned-generation-persistence/spec.md` are updated per this change's delta specs once archived — no manual step beyond the standard `opsx:archive` flow, but confirm the archived result no longer contains the disconnect-aborts-generation wording anywhere in either file.
- [x] 6.2 Confirm no change is needed to `openspec/specs/client-channel-protocol/spec.md`, `openspec/specs/app-level-generation-manager/spec.md`, or `openspec/specs/generation-live-replay/spec.md` — re-read each after implementation to confirm the shipped behavior now matches what they already specify (particularly `generation-live-replay`'s "no client-disconnect handling, by design" line for `streamCompletion`).

## 7. Docs

- [x] 7.1 Check `docs/responses-api-integration.md` for any statement implying generation lifecycle depends on the originating browser connection; add an explicit statement that generation ownership is independent of it if the current wording is ambiguous or silent.
- [x] 7.2 Run `npm run validate:docs` after any README/`.env.template`/docs changes from tasks 1.1 and 7.1.

## 8. Verification

- [x] 8.1 `npm exec nx test chat-api` — full backend test suite green, including the new/updated tests from section 5.
- [x] 8.2 `npm exec nx lint chat-api`.
- [x] 8.3 Manual check per the acceptance criteria: start a completion, destroy the client connection after the first chunk, confirm via logs/DB that the full response is persisted and the registry entry is released as `Done`; reopen the conversation and confirm the complete answer renders.
- [x] 8.4 Manual check: explicit Stop still aborts upstream and persists the partial response with `wasStoppedByUser: true`.
- [x] 8.5 Manual check: an upstream failure still persists a partial `Error` result with `streamErrorMessage` set.
- [x] 8.6 Confirm `POST /client-channel/subscribe` and `POST /completions/attach` disconnect behavior is unchanged (existing tests for both continue to pass unmodified).
