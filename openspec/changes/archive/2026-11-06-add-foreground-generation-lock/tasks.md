<!--
Slicing strategy: risk-first, then vertical. Slice 1 fixes the contract (the marker DTO,
the shared type, the helpers) so every later slice builds on frozen shapes. Slice 2 proves the
riskiest claim first: two writers on two service instances, one of them refused through storage alone.
Each later slice adds one writer or reader of the marker and is verifiable on its own.
The frontend (slice 8) only reads the field, so it can follow once slice 1 is merged.
Backend work follows apps/chat-api/AGENTS.md; lib work follows .claude/rules/libs.md.
-->

## 1. Marker contract and helpers

- [x] 1.1 Add `ForegroundGenerationDto` in `apps/chat-api/src/conversations/dto/foreground-generation.dto.ts`:
  - fields `generationId` (`@IsUUID('4')`), `startedAt` and `expiresAt` (`@IsInt`), and optional `stopRequestedAt` (`@IsOptional() @IsInt()`);
  - `@ApiProperty` / `@ApiPropertyOptional` with a description and an example on every field;
  - wire it into `ConversationMessageDto` (`apps/chat-api/src/conversations/dto/conversation-message.dto.ts`) as optional `foregroundGeneration` with `@IsOptional() @ValidateNested() @Type(() => ForegroundGenerationDto)`, like `backgroundGeneration`.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/tests/foreground-generation.dto.spec.ts` (new: accepts a valid marker, rejects a non-UUID id and non-integer times)
- [x] 1.2 Run `npm run openapi`, then `npm run openapi:check`, then build and lint `chat-api-client` (`npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`). Commit the regenerated artifacts and do not hand-edit them.
- [x] 1.3 Add `ForegroundGeneration` and `Message.foregroundGeneration?` with JSDoc on every field in `libs/chat-shared/src/models/chat.ts`, and export the interface from the `libs/chat-shared` entry point. Update `libs/chat-shared/README.md` where `Message` fields are listed.
  - Verification: `npm exec nx typecheck chat-shared`
- [x] 1.4 Create `apps/chat-api/src/conversations/generation/foreground-generation.ts` with:
  - the constants `FOREGROUND_EXPIRY_GRACE_MS`, `FOREGROUND_REREAD_INTERVAL_MS` and `FOREGROUND_SHUTDOWN_FLUSH_MS`;
  - `buildForegroundStopReleaseMs`, `buildForegroundMarker`, `isLiveForegroundMarker`, `findLiveForegroundMessage`, `findForegroundMessageIndex` and `neutralizeForegroundMarkers`;
  - `findActiveGeneration`, which composes the foreground lookup with `findPendingBackgroundMessage` from `background-message.ts`.

  Add `'foregroundGeneration'` to `SERVER_OWNED_MESSAGE_FIELDS` in `apps/chat-api/src/conversations/generation/background-message.ts`.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/generation/foreground-generation.spec.ts` (new: liveness at and around `expiresAt`, a background message found as active, an expired marker not active, neutralization sets `streamErrorMessage: ''` only without terminal markers), `npm run test:file -- apps/chat-api/src/conversations/generation/background-message.spec.ts`
- [x] 1.5 Add the `ForegroundGenerationOutcome` string enum and the `generation.foreground.outcomes` counter next to `backgroundGenerationOutcomesTotal` in `apps/chat-api/src/conversations/generation/generation-metrics.ts`.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/generation/foreground-generation.spec.ts`
- [x] 1.6 Run `npm run verify:changed`. (Lint and tests of the affected projects pass; `attachment-canvas-consumer-fixture:pack-lib` fails in this environment with `ETARGET` for `@epam/ai-dial-react-pdf-highlighter@0.3.1` from the registry, independent of this change.)

## 2. Start-state write takes the lock (risk-first)

- [x] 2.1 In `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`:
  - replace the post-read `findPendingBackgroundMessage` check with `findActiveGeneration`;
  - replace the `StartStateSave` step's `saveConversation` with `persistenceService.updateConversation(..., storedConversation)`. Its closure: `409` on an active generation, neutralize expired markers, `buildConversationHistory` on the given version, set the marker built by `buildForegroundMarker` with the configured `MAX_GENERATION_DURATION_MS` and `GENERATION_FINALIZE_TIMEOUT_MS`, and `503` on a version without an `ETag`;
  - `Conflict` → `409`;
  - remove the catch that logs and continues: every failure releases the lease through `generationService.error(lease)` and rethrows before `onReadyToStream`.

  Count `start_conflict`, `expired_takeover` and `start_failed`.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts` (live marker → 409 with no write; expired marker taken over; storage error → rejection before `onReadyToStream`, lease released, no upstream call)
- [x] 2.2 After a start-state failure that is not a conflict or `409`, make one release write: `updateForegroundMessage` from 3.1 with a mutation setting `streamErrorMessage: ''`. It is a no-op without the generation's marker. Implement it after 3.1, or land 2.2 together with slice 3.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts` (a timeout after Core stored the write removes the marker; nothing stored → no write)
- [x] 2.3 Integration test proving the issue scenario. Two completion requests for one conversation, through two separate service instances (each with its own process-local registry, as two replicas have) that share one versioned store honouring `If-Match`: exactly one streams, and the other gets `409` before SSE headers. Cover one top-level conversation (two cookie sessions of one user) and one project conversation (owner and editor), plus a sender who reads after the other start state was stored.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/tests/project-completions.integration.spec.ts`
- [x] 2.4 Update the existing tests that assert "a failed start-state save does not abort the stream" to the new rule, without changing unrelated assertions.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/tests/completion-persistence.integration.spec.ts`
- [x] 2.5 Run `npm run verify:changed`.

## 3. Terminal write applies only to its own marker

- [x] 3.1 Add `updateForegroundMessage` to `apps/chat-api/src/conversations/generation/foreground-message.ts` (a separate file, so `background-message.ts` can import the pure helpers of `foreground-generation.ts` without an import cycle), modeled on `updatePendingBackgroundMessage`:
  - locate by `foregroundGeneration.generationId`, skip when it is missing or not this generation's;
  - `withServerOwnedFields` with the new set, which drops the marker;
  - an optional conversation-level mutation;
  - return a `BackgroundWriteResult`.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/generation/foreground-message.spec.ts` (client-owned `rating` kept, other messages and the name kept, a missing marker skipped, a conflict re-read and retried)
- [x] 3.2 In `finalize` (`conversation-streaming.service.ts`), replace the terminal `saveConversation` with `updateForegroundMessage`:
  - merge `html_tag` annotations with `mergeHtmlTagAnnotationsIntoViewState` into the **re-read** `customViewState`;
  - map `Skipped`/`Conflict` to `persistenceFailed(lease)` with no HTTP status and with the terminal markers of an answer that did not complete;
  - count `terminal_skipped` and `terminal_conflict`.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts` (rename during the generation survives; a deleted conversation is not re-created and the stream reports `conversation_save_failed` without `status`; one terminal operation per generation)
- [x] 3.3 Update the `customViewState` terminal-merge tests to the re-read source, adding "a key written during the generation is preserved".
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts`, `npm run test:file -- apps/chat-api/src/conversations/tests/completion-persistence.integration.spec.ts`
- [x] 3.4 Run `npm run verify:changed`.

## 4. Release on early exits and bounded shutdown flush

- [x] 4.1 In `apps/chat-api/src/conversations/generation/conversation-generation.service.ts`:
  - add `GenerationCancelReason.LockLost`;
  - give each entry a `settled` promise resolved in `releaseKey`;
  - make `onModuleDestroy` `async`: abort all entries, deliver `stopped`, detach background entries, wait for foreground entries for at most `FOREGROUND_SHUTDOWN_FLUSH_MS`, then settle the rest.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/generation/conversation-generation.service.spec.ts` (subscribers get one `stopped`; a foreground entry that settles inside the bound is not force-settled; a never-settling one is released after the bound; background entries are detached at once)
- [x] 4.2 In `conversation-streaming.service.ts`:
  - detect shutdown at preparation boundaries through `getCancellation(lease)?.reason === GenerationCancelReason.Shutdown`, because the entry is now retained;
  - after a stored start state, make the release write before failing;
  - in `releaseAfterAbandonedStep`, make the release write when the abandoned step is `StartStateSave` and did not end in a conflict.

  Count `released_before_stream` and `release_failed`.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts` (shutdown after the stored start → one release write, no upstream call; abandoned start write that lands later → release write, then key released once)
- [x] 4.3 Integration test: shutting the app down while a foreground generation streams leaves no `foregroundGeneration` in storage and the answer stored with `streamErrorMessage: ''`. Nest's destroy hooks run before the HTTP adapter closes, so the SSE response and `DialClientService` stay usable meanwhile.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/tests/completion-persistence.integration.spec.ts` (it runs the real Nest app against a fixture Core server)
- [x] 4.4 Run `npm run verify:changed`.

## 5. Cooperative Stop and worker re-read

- [x] 5.1 In `conversation-generation.service.ts`, add:
  - `requestUserStop(lease)`;
  - `cancel(lease, reason)`;
  - `abortByGeneration(path, generationId)`, which finds the active foreground entry for the path with that id under any owner, and leaves `register`, `abort` and `attach` unchanged.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/generation/conversation-generation.service.spec.ts` (another principal's entry aborted as user-stop; unknown id / background entry / non-active entry → `false`)
- [x] 5.2 In `conversation-streaming.service.ts`, start the `FOREGROUND_REREAD_INTERVAL_MS` re-read after `onReadyToStream`. Rules:
  - foreground path only, one read in flight, cleared at `beginFinalizing` and in `finally`;
  - `stopRequestedAt` → `requestUserStop`;
  - marker gone → `cancel(LockLost)` plus count `lock_lost`;
  - read errors are ignored.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts` (fake timers: a stored Stop ends the stream as stopped with the partial saved; a deleted conversation aborts upstream with no write; no reads on the background path or after finalizing)
- [x] 5.3 Add `stopForegroundGeneration(path, token, bucket, generationId)` returning a `ForegroundStopResult` string enum (`Stored`, `AlreadyRequested`, `NotFound`, `Failed`) to `conversation-streaming.service.ts`, and expose it on `ConversationService`. It sets `stopRequestedAt` and the shortened `expiresAt` through `updateConversation`, and maps Core `403`/`404` to `NotFound`. Count `stop_stored`.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts`
- [x] 5.4 In `ConversationCompletionsResponder.stopCompletion` (`apps/chat-api/src/conversations/streaming/conversation-completions.responder.ts`), after `BackgroundStopResult.NotBackground`, call `stopForegroundGeneration`:
  - `Stored` → `abortByGeneration`, then `204`;
  - `AlreadyRequested` → `204`;
  - `NotFound` → the registry `abort` path (`404` when it fails);
  - `Failed` → `503`.

  Keep the existing `@ApiResponse` set, since `204`, `404` and `503` are documented, and confirm `npm run openapi:check` shows no diff.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/tests/completions.integration.spec.ts` (supertest: another session's Stop → 204 and the marker carries `stopRequestedAt`; repeated Stop → 204 without a write; a caller without access → 404), `npm run test:file -- apps/chat-api/src/conversations/tests/project-completions.integration.spec.ts` (an editor stops another editor's generation; view-only → 403)
- [x] 5.5 Run `npm run verify:changed`.

## 6. Client saves, copies, publish and the background placeholder

- [x] 6.1 In `apps/chat-api/src/conversations/generation/background-message.ts`:
  - generalize `mergeClientMessages` and `updateConversationUnlessPending` to the marked message returned by `findActiveGeneration`;
  - neutralize foreign and expired foreground markers with `neutralizeForegroundMarkers`.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/generation/background-message.spec.ts` (a stale tab keeps another participant's live exchange; a body cannot create a marker; persistent conflicts with a live marker → `Conflict`)
- [x] 6.2 In `BackgroundGenerationService.saveClientConversation` (`apps/chat-api/src/conversations/generation/background-generation.service.ts`) and `ConversationStreamingService.saveClientConversation`, make a read error throw `503` instead of falling back to the unconditional save. A `null` read (missing conversation) keeps the create path.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/generation/background-generation.service.spec.ts`, `npm run test:file -- apps/chat-api/src/conversations/tests/background-attach.integration.spec.ts` (PUT over HTTP with a failing read → 503, no write)
- [x] 6.3 In `savePlaceholder` (`background-generation.service.ts`), treat a live foreground marker as a conflict (`409`) and neutralize an expired one.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/generation/background-generation.service.spec.ts`
- [x] 6.4 In `ConversationLifecycleService` duplicate (`apps/chat-api/src/conversations/lifecycle/conversation-lifecycle.service.ts`), apply `neutralizeForegroundMarkers` next to `neutralizeForeignPendingMessages`.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/lifecycle/tests/conversation-lifecycle.service.spec.ts`
- [x] 6.5 In `ConversationPublishService` (`apps/chat-api/src/conversations/conversation-publish.service.ts`), replace `findPendingBackgroundMessage` with `findActiveGeneration`.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/tests/conversation-publish.service.spec.ts` (a live marker → 409 without `createPublication`; an expired marker publishes)
- [x] 6.6 Reword `GENERATION_ACTIVE_MESSAGE` in `background-generation.service.ts` to the neutral text, and update the assertions that quote it.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/generation/background-generation.service.spec.ts`
- [x] 6.7 Run `npm run verify:changed`.

## 7. Backend contract checks

- [x] 7.1 Run `npm exec nx test chat-api`, `npm exec nx lint chat-api` and `npm exec nx build chat-api` (Nest startup and shutdown hooks are affected), plus `npm run openapi:check`.

## 8. Frontend: live marker awareness and conflict copy

- [x] 8.1 In `libs/chat-hooks/src/conversation/useConversationStream/generation-resume.ts`, add `findLiveForegroundMessageIndex(conversation, now)`. Use it in:
  - `isAwaitingGenerationResume`, at any index;
  - the resume buffer index;
  - `isOrphanedPlaceholder`, which excludes a live marker;
  - the watch-timeout path, which writes no interrupted text while the marker is live.
  - Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/generation-resume.spec.ts` (status message after the marker; expired marker → placeholder rule; live marker never labelled interrupted)
- [x] 8.2 Make Stop use a live marker's `generationId` as the last fallback after the local, background and attach ids. Keep it hidden during a conflict handover, and drop it once a reload has no live marker.
  - Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.stop.spec.ts`
- [x] 8.3 Cover the resume of another participant's generation end to end in the hook: attach `404`, watch reloads with a live marker keep `isStreaming`, then the saved answer replaces the placeholder.
  - Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.background.spec.ts` (or a new `useConversationStream.foreground-marker.spec.ts` next to it)
- [x] 8.4 Change `DEFAULT_GENERATION_CONFLICT_MESSAGE` in `libs/chat-hooks/src/conversation/create-chat-stream-api.ts`, and the English text of `chat.generationConflict` in `apps/chat/src/i18n/locales/en.json` (existing key, no new key), to `A response is already being generated in this conversation. Wait for it to finish before sending another message.`
  - Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.errors.spec.ts`
- [x] 8.5 Architecture guard for `libs/chat-hooks` and `libs/chat-shared`. Confirm the change adds none of the following, and that liveness uses only the message field and `Date.now()`:
  - an `/api` path or a generated-client import;
  - a `server-api` import or an app context;
  - auth, session, cookie or env access;
  - a feature flag or route knowledge;
  - telemetry;
  - a storage key.

  Update `libs/chat-hooks/README.md` if it lists the exports of `generation-resume.ts`.
  - Verification: `npm exec nx lint chat-hooks`, `npm exec nx lint chat-shared`
- [x] 8.6 RTL: no new markup is introduced, and the existing typing indicator, Stop control and stream-error card render unchanged in `dir="rtl"`. Record "none" in the PR description; no code task.
- [x] 8.7 Run `npm run verify:changed`.

## 9. Docs and specs

- [x] 9.1 Update `docs/architecture.md` in the paragraphs "The backend, not the frontend, owns conversation persistence" and "Generation lifecycle and admission":
  - storage-side admission through the `foregroundGeneration` marker;
  - the conditional start and terminal writes;
  - start-state failure fails the send;
  - cooperative Stop;
  - the bounded shutdown flush.
- [x] 9.2 Check whether `docs/observability.md` lists generation instruments. If it does, add `generation.foreground.outcomes` next to the background counter.
- [x] 9.3 Run `npm run validate:docs`, `npm run validate:specs` and `npm run spec:impact`, and resolve every failure and every listed spec this change does not already cover.

## 10. Follow-up (no code in this change)

- [x] 10.1 Draft a GitHub issue for end-to-end optimistic concurrency of client conversation saves: the client sends the version it edited, and a stale save after a generation is refused. Link #9731 and the known limitation in `foreground-generation-lock`. Show the draft to the user and publish it only after approval.

## 11. Final verification

- [x] 11.1 Run `npm run verify:full` once and fix any failure it reports. (typecheck, lint, format and every test project pass; only `attachment-canvas-consumer-fixture:pack-lib` fails in this environment, with `ETARGET` for `@epam/ai-dial-react-pdf-highlighter@0.3.1` from the registry.)
