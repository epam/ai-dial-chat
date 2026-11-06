## Context

**Current state.** A foreground generation (Chat Completions or stateless Responses) is serialized only by `ConversationGenerationService`. That is an in-memory map keyed by `ownerKey::path`, where `ownerKey` is the cookie `sid` or the bearer (`providerId`, `sub`) pair from `resolvePrincipalKey` (`apps/chat-api/src/auth/session/principal-key.ts`). `ConversationStreamingService.streamCompletion` then writes twice, both times unconditionally:

- **Start-state save** — `persistenceService.saveConversation`. A failure is logged and the stream opens anyway.
- **Terminal save** — rebuilt from the `startConversation` snapshot, so it also reverts anything written during the generation.

Any two writers the registry cannot see are admitted: two principals, two cookie sessions of one user, or one session on two replicas. The later terminal save then wins ([#9731](https://github.com/epam/ai-dial-chat/issues/9731)).

**The background path already solves this with storage-side fencing:**

- `BackgroundGenerationService.savePlaceholder` puts a `pending` marker on the message with a conditional update;
- `updatePendingBackgroundMessage` locates the message by `generationId` and replaces only server-owned fields;
- `mergeClientMessages` keeps the pending message authoritative in client saves;
- `updateConversationUnlessPending` refuses an unconditional fallback while a pending message exists.

All of this runs through `ConversationPersistencePort.updateConversation` and `runConditionalUpdate` (`apps/chat-api/src/conversations/persistence/conversation-persistence.service.ts`).

**DIAL Core ETag behavior,** verified in the `ai-dial-core` sources on `development`:

- **Plain resource** (a top-level conversation). `ResourceService.putResource` validates `If-Match`/`If-None-Match` (`EtagHeader.validate`) under `lockService.lock(redisKey)`, a Redis-backed lock shared by all Core nodes, and only then writes. This is a real compare-and-set across nodes. The ETag is the MD5 of the body. `If-Match` on a missing resource is `412`, and no `If-Match` means overwrite.
- **Project file** (a complex resource). `ComplexResourceService.copyOnWrite` validates `If-Match` against the **project's aggregate ETag** under the marker's resource lock. The aggregate is the MD5 over the sorted `(path, file ETag)` pairs. There is no per-file precondition, and every file write copies the whole current version while the lock is held.
- **Bridge in this repo.** `ProjectConversationStore.saveConversationIfMatch` emulates a per-file condition: read metadata (aggregate ETag) → download the file and hash it → write with `If-Match: <aggregate>` → retry on `412` up to 5 times. Because the aggregate is read before the file, this is linearizable. It costs 3 calls per attempt and repeats on writes to other project files.

**Constraints.**

- Project-file subscriptions are not available, so a project conversation's watch is a client poll (`libs/chat-hooks/src/project/project-conversation-data-source.ts`, every 5 s).
- No DIAL Core change is in scope.
- `apps/chat-api/AGENTS.md` governs the backend part.

## Goals / Non-Goals

**Goals:**

- One active generation per conversation across principals, sessions and replicas. The second sender gets `409` before SSE headers.
- Terminal writes that apply only to their own message and keep everything written meanwhile.
- No permanent lock: fixed expiry, release on every non-crash exit, a manual exit through Stop from any writer.
- Reuse the background path's helpers and contracts instead of a parallel mechanism.

**Non-Goals:**

- End-to-end client `If-Match`. A stale client save *after* a generation finished is a follow-up issue.
- Attach to another principal's generation.
- A per-file `If-Match` in DIAL Core.
- Changing background-path behavior beyond recognising the foreground marker.

## Decisions

### D1. Storage is the lock: a marker on the message, written with `If-Match`

The start-state write stores a `foregroundGeneration` marker conditionally. Every later writer checks it: the terminal and release writes, Stop, client saves, publish, the background placeholder.

The rejected alternatives are the two the issue suggests, plus one more:

- **A registry key by path** is still process-local.
- **A conditional start-state write without a marker** leaves a writer that reads *after* the first start free to build on top of it, and both terminal saves still collide.
- **Heartbeat leases** are rejected in D3.

The cost is one conditional write per start and per end. Those writes already exist today, just unconditional.

### D2. A new field on the assistant message, not `backgroundGeneration` and not conversation-level

`ForegroundGenerationDto { generationId, startedAt, expiresAt, stopRequestedAt? }` lives in `apps/chat-api/src/conversations/dto/foreground-generation.dto.ts`. It gets `@ApiProperty` on every field, `@IsString` / `@IsUUID('4')` for the id, `@IsInt` for the times and `@IsOptional` for `stopRequestedAt`. It is wired into `ConversationMessageDto` with `@IsOptional() @ValidateNested() @Type(...)`, like `backgroundGeneration`.

**Why not reuse `backgroundGeneration`.** Every existing reader would act on it as a Core job:

- `resolveAttach` marks a pending message without `responseId` failed after `BACKGROUND_START_TIMEOUT_MS`, which would kill a live foreground generation running longer than 2 minutes;
- Stop would cancel a non-existent job;
- the client's `findPendingBackgroundMessageIndex` resumes it on the background flow.

**Why not conversation-level.** The terminal write and the merge need the message identity that `generationId` gives. An index is fragile.

**Helpers** go in a new `apps/chat-api/src/conversations/generation/foreground-generation.ts`:

- `isLiveForegroundMarker(marker, now)`;
- `findLiveForegroundMessage(conversation, now)`;
- `findForegroundMessageIndex(messages, generationId)`;
- `neutralizeForegroundMarkers(messages, keepGenerationId?)`;
- `findActiveGeneration(conversation, now)`, which composes the foreground lookup with `findPendingBackgroundMessage`;
- the constants `FOREGROUND_EXPIRY_GRACE_MS` (60 000), `FOREGROUND_REREAD_INTERVAL_MS` (10 000) and `FOREGROUND_SHUTDOWN_FLUSH_MS` (10 000);
- `buildForegroundStopReleaseMs(finalizeTimeoutMs)`.

`foregroundGeneration` joins `SERVER_OWNED_MESSAGE_FIELDS` in `background-message.ts`, so `withServerOwnedFields` / `pickServerOwnedFields` carry it through the existing merge code unchanged.

### D3. Fixed expiry stored in the marker; Stop shortens it; no heartbeat

- **Expiry.** `expiresAt = startedAt + MAX_GENERATION_DURATION_MS + GENERATION_FINALIZE_TIMEOUT_MS + 60 s` is computed by the writer and stored. Readers compare it with their own clock, so instances with different configuration, for example during a rollout, agree.
- **Clocks.** Skew between NTP-synced instances is absorbed by the 60 s grace period.
- **Stop.** Stop writes `stopRequestedAt = now` and `expiresAt = min(expiresAt, now + 2 × 10 s + GENERATION_FINALIZE_TIMEOUT_MS)`. A live worker sees the Stop within one re-read interval, and a dead worker's marker stops blocking about 80 s after Stop. Readers keep a single liveness rule (`now < expiresAt`).
- **Heartbeat rejected.** It would cost one write per interval per generation. In a project each write is a copy-on-write of the whole project, Core events go out to every watcher, and the writes would conflict with client saves.

### D4. Start-state write: conditional update; failure ends the request before streaming

`streamCompletion` replaces the `saveConversation` call in the `StartStateSave` preparation step with `persistenceService.updateConversation(path, token, bucket, update, storedConversation)`. The `update` closure:

1. throws `ConflictException(GENERATION_ACTIVE_MESSAGE)` on `findActiveGeneration`;
2. records a missing `ETag` and returns `null` (mapped to `503`);
3. neutralizes expired markers;
4. calls `buildConversationHistory` on the version it was given;
5. sets the marker on the assistant placeholder.

`Conflict` after 3 attempts → `409`. The first attempt reuses the version already read, which is the same pattern as `savePlaceholder`.

The current `catch` that logs and continues is removed. Every failure goes through the same `generationService.error(lease)` release as the conversation-read step, and is rethrown before `onReadyToStream`.

A failure that is neither a conflict nor a `409`, and the late settlement of an abandoned step, trigger a **release write**. The release write is `updateForegroundMessage` (D5) with a mutation that sets `streamErrorMessage: ''` and removes the marker. It is a no-op when the marker was not stored. This closes the case where DIAL Core stored the write but the BFF saw a timeout, which would otherwise hold the conversation for about 32 minutes.

The early check after the read (`findPendingBackgroundMessage` today) becomes `findActiveGeneration`. It covers the background branch too.

### D5. Terminal write: `updateForegroundMessage`, modeled on `updatePendingBackgroundMessage`

A new function in `foreground-generation.ts` takes the persistence port, the location, the `generationId` and a mutation. Through `updateConversation`, each attempt:

- re-reads the stored version and locates the message by `foregroundGeneration.generationId`;
- skips when the message is missing or not this generation's;
- applies `withServerOwnedFields(stored, { ...assembled server-owned fields })`, which removes the marker because it is not in the new set;
- merges `html_tag` annotations into the re-read `customViewState` (`mergeHtmlTagAnnotationsIntoViewState`).

It returns `{ result: Applied | Skipped | Failed }`, reusing `BackgroundWriteResult`. `finalize` maps the result:

| Result | Action |
| --- | --- |
| Applied | `complete` / `error` as today |
| Skipped or Conflict | `persistenceFailed(lease)` with no HTTP status, so the client keeps its answer and shows the warning, and makes no `401` recovery save |
| Thrown HTTP error | as today |

`beginFinalizing` still runs before the operation, so the finalize bound and retained ownership are unchanged.

LLM naming is still scheduled, because `saveConversationIfMatch` already calls `scheduleNaming`. `preserveLlmDisplayName` becomes unnecessary because the name comes from the re-read version.

### D6. Worker re-read for cooperative Stop

After `onReadyToStream`, `streamCompletion` starts an interval of `FOREGROUND_REREAD_INTERVAL_MS`. It is not started on the background path, and is cleared when `beginFinalizing` runs and in the generator's `finally`. Each tick calls `persistenceService.readConversationWithEtag` with the generation's token:

- own marker has `stopRequestedAt` → `generationService.requestUserStop(lease)`, a new lease-scoped variant of `abort` that sets `UserStop`;
- own marker or message gone → `generationService.cancel(lease, GenerationCancelReason.LockLost)`;
- read error → ignored.

Only one read is in flight at a time, and a tick is skipped while the previous read is pending.

`GenerationCancelReason.LockLost = 'lock_lost'` is added. Classification already maps every reason except `UserStop` to a non-user abort, so no other code path changes.

### D7. Stop from any writer: `ConversationStreamingService.stopForegroundGeneration`

`ConversationCompletionsResponder.stopCompletion` keeps steps 1–2 (local owner, background). When background answers `NotBackground`, it calls `stopForegroundGeneration(path, token, bucket, generationId)`. That method makes one `updateConversation`, whose closure finds the live marker with that id and sets `stopRequestedAt` and the shortened `expiresAt`, and returns `null` when `stopRequestedAt` is already set or no live marker exists. The result is a string enum:

| `ForegroundStopResult` | Meaning | Response |
| --- | --- | --- |
| `Stored` | The Stop was written | `204` |
| `AlreadyRequested` | The marker already carried `stopRequestedAt` | `204` |
| `NotFound` | No live marker with that id, or Core rejected the read or write with `403`/`404` | `404` |
| `Failed` | Storage error or persistent conflict | `503` |

On `Stored`, the responder calls `generationService.abortByGeneration(path, generationId)`, the new registry lookup, before answering `204`.

The project route reaches the same responder after `assertCanWrite`, so a view-only caller is `403` first. There is no new endpoint and no OpenAPI change.

### D8. Client saves: generalize the merge to "the marked message"

- `mergeClientMessages` keeps its algorithm. Where it reads "pending background message" it reads `findActiveGeneration(storedMessages, now)`, so a live foreground marker is protected identically: position fallback, re-insertion of missing tail messages, server-owned fields from storage.
- Foreign foreground markers in the body are removed by `neutralizeForegroundMarkers`. Expired stored markers count as foreign.
- `updateConversationUnlessPending` uses `findActiveGeneration` for its persistent-conflict check.
- `BackgroundGenerationService.saveClientConversation` stops resolving `null` on a read error. `ConversationStreamingService.saveClientConversation` therefore no longer falls back to `saveConversation` for an existing conversation, and the read error surfaces as `503`. `readConversationWithEtag` returns `null` on `404`, so a missing conversation still uses the create path.
- Duplicate (`ConversationLifecycleService`, which today calls `neutralizeForeignPendingMessages`) also applies `neutralizeForegroundMarkers`.
- `ConversationPublishService` replaces `findPendingBackgroundMessage` with `findActiveGeneration`.

### D9. Shutdown waits for foreground writes within a bound

`ConversationGenerationService.onModuleDestroy` becomes `async`. Each entry gets a `settled` promise, resolved in `releaseKey`. Shutdown then:

1. sets reason `Shutdown` and aborts every entry;
2. delivers `stopped` to subscribers through `releaseResources`;
3. settles background entries at once, as today;
4. awaits `Promise.race([Promise.all(foreground settled), timer(FOREGROUND_SHUTDOWN_FLUSH_MS)])`;
5. settles whatever remains.

Nest runs `onModuleDestroy` hooks before it closes the HTTP server, and `DialClientService` has no destroy hook, so open SSE responses and the SDK client stay usable while workers write. An integration test asserts this.

During preparation a worker today detects shutdown by its entry being released. Because the entry is now retained, the worker checks `getCancellation(lease)?.reason === Shutdown` at the same boundaries. If it already stored the start state, it makes the release write before failing.

### D10. Frontend: read the field, decide liveness from `expiresAt`, reuse existing states

- **`libs/chat-shared/src/models/chat.ts`** adds `ForegroundGeneration` and `Message.foregroundGeneration`, both exported with JSDoc.
- **`libs/chat-hooks/.../generation-resume.ts`** adds `findLiveForegroundMessageIndex(conversation, now = Date.now())`, and uses it in:
  - `isAwaitingGenerationResume`, at any index, as for background;
  - the resume's buffer index;
  - `isOrphanedPlaceholder`, which excludes a live marker, so no interrupted label and the path stays streaming until the watch resolves or times out;
  - Stop id resolution, as the last fallback after local, background and attach ids.
- **`DEFAULT_GENERATION_CONFLICT_MESSAGE`** and `en.json` `chat.generationConflict` get the neutral text.

**Library isolation.** The libs read only a data field of the conversation they are given, plus the clock. Endpoint choice stays in the injected transport, and copy stays in host-supplied labels. No routing, flag, storage key or Core call enters a lib.

**UI states** are all existing ones:

- typing indicator while the marker is live;
- the saved answer on a qualifying watch reload;
- the existing release on watch timeout;
- the conflict card on `409`.

The `stopCompletion` call goes through the existing transport.

The server-side `GENERATION_ACTIVE_MESSAGE` is reworded the same way. It is API text the UI does not show, because the hook substitutes the host message.

### D11. Observability

`generation.foreground.outcomes` is a counter next to `generation.background.outcomes` in `generation-metrics.ts`, with `ForegroundGenerationOutcome` values as the `outcome` attribute. Logs use the existing subject-free log label plus `generationId`. There is no new dashboard; the counter is documented in `docs/observability.md` next to the background one if that doc lists generation instruments.

### D12. Docs updated in the same change

- `docs/architecture.md`, "Generation lifecycle and admission" and the persistence paragraph. Both state that the non-background terminal save is unconditional and single-attempt, and that the registry is the only admission. Both statements become false.
- The "Known gap" bullet in `openspec/specs/project-conversations-api/spec.md` goes through its delta.
- `npm run validate:docs` and `npm run validate:specs` are run.

## Risks / Trade-offs

- **[Hard crash leaves a live marker for up to ~32 min]** → Mitigations: a Stop from any writer releases it in ~80 s; graceful shutdown flushes (D9); start-state writes with an unknown outcome are released (D4). The remaining case is documented as a known limitation.
- **[Start-state write failure now fails the send]** — an availability regression when storage is flaky. → Accepted: streaming without the lock reintroduces the bug. The user sees the existing failed-send state and retries.
- **[Client save with a failed read now returns `503`]** where it used to save unconditionally → Accepted for the same reason. Reads failing while writes succeed is rare. The client surfaces the save error.
- **[Project contention]** Every write to any file of a busy shared project invalidates the aggregate ETag. Conditional attempts repeat (3 × 5 inner) and may end in `Conflict`, which shows as a send `409` or a terminal `conversation_save_failed`. → Mitigation: bounded retries. A per-file `If-Match` in Core would remove this, but it is declined for now and recorded in the proposal.
- **[Re-read load]** One read every 10 s per active foreground generation, so 1 000 concurrent generations make about 100 reads/s against Core. Project reads are one download each. → Acceptable. The interval is a constant that can be raised.
- **[Long generation outlives its access token]** Re-reads with the captured token start failing with `401`, so a remote Stop is no longer honored. The terminal write may fail with `401` too, which is the existing client recovery-save path. → Documented. The generation still ends by max duration.
- **[Clock skew]** A skewed instance may see a marker as expired up to the skew early. → The 60 s grace period. Stop uses the writer's clock for both fields.
- **[Mixed versions during rollout]** An old BFF instance writes unconditionally and ignores markers, so the lock is complete only once all instances run the new version. An old frontend shows a live marker as interrupted and gets `409` with the old copy on send. → Transitional, with no data loss beyond today's behavior.
- **[Stale client save after a generation ends]** It still overwrites. → Known limitation; follow-up issue for end-to-end `If-Match`.

## Migration Plan

1. Ship the BFF and frontend together; they are one image (`apps/chat-api` serves `apps/chat/dist`). There is no data migration, because conversations without the field behave as before.
2. `npm run openapi` regenerates `libs/chat-api-client`. The change is additive.
3. **Rollback** is a revert. `SaveConversationBodyDto.conversation` is validated only as `@IsObject()`, so a leftover `foregroundGeneration` in stored or client bodies is passed through inertly by the old code, and no reader acts on it.

## Open Questions

- Should the follow-up issue for end-to-end client `If-Match` be filed before this change merges? It is drafted after the proposal, and published only with the user's approval.
- Does `docs/observability.md` enumerate generation instruments? If not, D11 adds no doc row. Check during implementation.
