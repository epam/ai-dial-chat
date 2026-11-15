## Why

Two writers can generate in the same conversation at once and one exchange silently disappears ([#9731](https://github.com/epam/ai-dial-chat/issues/9731)). Once a project is shared with edit access, the owner and every editor may continue the same chat, so this is now reachable without any unusual setup.

The registry is the only thing that serializes foreground (non-background) generations, and it is process-local and keyed by principal (`apps/chat-api/src/conversations/generation/conversation-generation.service.ts:369`). Both foreground writes are unconditional:

- the start-state save (`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts:518`);
- the terminal save, rebuilt from the start snapshot (`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts:594`).

Two principals, two cookie sessions of the same user, or two BFF replicas are therefore all admitted, and the later terminal save overwrites the other exchange. Nobody sees an error.

The background path already solves exactly this problem with a stored marker and `If-Match` writes:

- `savePlaceholder` (`apps/chat-api/src/conversations/generation/background-generation.service.ts:377`);
- `updatePendingBackgroundMessage` (`apps/chat-api/src/conversations/generation/background-message.ts:133`).

DIAL Core checks `If-Match` atomically under a distributed lock, for a plain resource and for a project file alike. The project-file check uses the project's aggregate ETag, which `ProjectConversationStore.saveConversationIfMatch` already narrows to one file.

## What Changes

The storage becomes the lock for foreground generations in **every** conversation, personal and project.

- **Marker.** A new server-owned field `foregroundGeneration { generationId, startedAt, expiresAt, stopRequestedAt? }` sits on the assistant message a foreground generation is producing. Only the backend creates it.
  - `expiresAt` is fixed when the marker is written: `startedAt + MAX_GENERATION_DURATION_MS + GENERATION_FINALIZE_TIMEOUT_MS` plus a fixed grace period.
  - There is no heartbeat.
- **Start.** The start-state save becomes a conditional update.
  - A live marker of another generation, or a pending background message, gives `409`.
  - An expired marker is neutralized in the same write.
  - Any start-state write failure now fails the request before SSE headers. Streaming without the lock is not possible.
  - **Behavior change:** previously a failed start-state save was logged and the stream opened anyway.
- **Terminal write.** The terminal write becomes one operation with bounded conditional attempts:
  - locate the message by `generationId`;
  - replace only its server-owned fields;
  - merge annotations into the *current* `customViewState`;
  - remove the marker.

  It is skipped when the marker is no longer this generation's. A deleted conversation is therefore no longer re-created by a late terminal save. The "exactly one terminal write attempt" contract becomes "exactly one terminal write operation".
- **Cooperative Stop.** Any caller who can write the conversation can stop a foreground generation, from any instance.
  - Stop writes `stopRequestedAt` conditionally.
  - The worker re-reads its conversation every ~10 s and stops as a user stop. A marker that has disappeared also stops it.
  - A worker on the same instance is aborted at once through a new registry lookup by `(path, generationId)`.
  - A marker with `stopRequestedAt` whose worker is gone stops blocking about 1.5 minutes later.
- **Other writers.**
  - Client saves keep a live foreground marker from storage, exactly as they keep a pending background message, and neutralize foreign markers.
  - A client save that cannot be fenced while a generation is active answers `503` instead of writing unconditionally.
  - Duplicate neutralizes the marker.
  - Publish answers `409` while the marker is live.
  - The background placeholder treats a live foreground marker as a conflict.
- **Shutdown.** Module shutdown waits, within a fixed bound, for the terminal writes of the foreground generations it aborted. A rolling deploy therefore leaves no marker behind. Only a crash does.

  A generation whose marker was written but which failed before streaming, either by shutdown or by an abandoned preparation whose write later landed, still releases its marker.
- **Frontend** (`libs/chat-shared`, `libs/chat-hooks`, `apps/chat`):
  - `Message` gains `foregroundGeneration`.
  - A live marker is shown as generating elsewhere, never as interrupted.
  - Stop is offered with the marker's `generationId` when the page has no other id.
  - `chat.generationConflict` and `DEFAULT_GENERATION_CONFLICT_MESSAGE` are reworded to drop "another browser tab" and "stop it".
- **Docs.**
  - The "Known gap" bullet in `project-conversations-api` is removed.
  - `docs/architecture.md`, which states that the non-background terminal save is unconditional and single-attempt, is updated.

## Non-goals

- **End-to-end optimistic concurrency for client saves.** A client sending the version it edited, as the skill editor does, is out of scope. A stale client save made *after* a generation finished can still overwrite that exchange. This is recorded as a known limitation and goes to a follow-up issue.
- **Live attach to another principal's generation.** It is not added. Attach stays principal-scoped, and another participant sees the result through the watch or polling path.
- **DIAL Core changes.** There is no per-file `If-Match` for project files. A project conditional write keeps costing 3 Core calls per attempt and retries on writes to other files of the project.
- **Changing the background path's own lifecycle,** apart from recognising the foreground marker.

## Alternatives considered

| Option | Verdict |
| --- | --- |
| **Baseline:** registry conflict keyed by path for project locators (issue suggestion 1) | Rejected. Still process-local: it misses a second BFF replica and two sessions of one user in a personal conversation. |
| Conditional start-state save only, on the version read (issue suggestion 2) | Rejected. It closes only the window where both requests read the same version. A request reading *after* the first start save builds on its placeholder, and both terminal saves still overwrite each other. |
| **Stored marker + conditional writes, fixed TTL** (chosen) | Serializes across principals, sessions and replicas, and reuses the background-path pattern and helpers. For a personal conversation it costs one extra read per terminal write plus one read every ~10 s while generating. |
| Stored marker with a short TTL renewed by heartbeat | Rejected. A write every few seconds: in a project each one is a copy-on-write of the whole project plus resource events and conflicts with client saves. Cooperative Stop gives a manual exit after a crash instead. |
| Reuse `backgroundGeneration` with a kind discriminator | Rejected. Every existing reader would treat a foreground marker as a Core job: attach marks it failed after 120 s, Stop would cancel a non-existent job, and the client resumes it on the background flow. |

## Capabilities

### New Capabilities

- `foreground-generation-lock`: the stored `foregroundGeneration` marker and its life cycle:
  - liveness and expiry;
  - the conditional start and terminal writes;
  - the worker's re-read and cooperative Stop;
  - release on paths that fail before streaming;
  - bounded shutdown flush;
  - treatment by client saves, copies and publish.

### Modified Capabilities

- `backend-owned-generation-persistence`:
  - a start-state write failure fails the request;
  - the terminal write is one conditional operation instead of one unconditional attempt;
  - storage-side fencing is claimed for the non-background paths too;
  - the duplicate-generation `409` also comes from the stored marker.
- `generation-registry`:
  - a new cancellation reason for a lost marker;
  - a lookup by `(path, generationId)` for a storage-authorized Stop;
  - shutdown waits, within a bound, for foreground terminal writes.
- `generation-principal-ownership`: Stop of a foreground generation is authorized by write access to the stored conversation, not by principal key. Attach stays principal-scoped.
- `stop-generation-endpoint`: the foreground-marker branch (`stopRequestedAt`) and its status codes.
- `background-responses-generation`:
  - the placeholder save and the client-save merge treat a live foreground marker as an active generation;
  - persistent conflicts no longer save unconditionally while any generation is active.
- `conversations-api`: `PUT /api/v1/conversations` no longer falls back to an unconditional save when the stored version cannot be read.
- `conversation-publish-api`: publish is refused while a live foreground marker exists.
- `conversation-custom-view-state`: annotations merge into the stored `customViewState` inside the conditional terminal write.
- `project-conversations-api`: the "Known gap" bullet is removed, and editors may stop one another's generation.
- `chat-hooks-conversation-stream`:
  - a live foreground marker is awaiting resume;
  - Stop uses the marker's id as the last fallback;
  - the conflict default text changes.
- `generation-resume-on-refresh`: an unresolved placeholder with a live foreground marker is not shown as interrupted.

## Impact

- **`apps/chat-api`**:
  - `conversations/streaming/conversation-streaming.service.ts`;
  - `conversations/streaming/conversation-completions.responder.ts` (Stop);
  - `conversations/generation/conversation-generation.service.ts` (cancel reason, lookup, shutdown);
  - `conversations/generation/background-message.ts` and `background-generation.service.ts` (shared active-generation helpers, merge);
  - a new `conversations/generation/foreground-generation.ts` for the marker helpers;
  - `conversations/conversation-publish.service.ts`;
  - `conversations/lifecycle/conversation-lifecycle.service.ts`;
  - `conversations/dto/conversation-message.dto.ts` and a new `ForegroundGenerationDto`.
- **OpenAPI and generated client.** `ConversationMessageDto` gains an optional field: run `npm run openapi`, regenerate `libs/chat-api-client`. This is additive, and no operation changes.
- **Libs** (shared libs, flagged as scope):
  - `libs/chat-shared/src/models/chat.ts` gains the `Message.foregroundGeneration` type;
  - `libs/chat-hooks` gains resume, interrupted and Stop handling in `useConversationStream/`, plus the default conflict text in `create-chat-stream-api.ts`.

  Both read only a data field of the conversation they are given. Liveness is decided from the field's own `expiresAt`. No host knowledge, flag or Core call enters the libs.
- **i18n.** No new key: the English text of the existing `chat.generationConflict` changes (`en.json` is the only locale). No RTL or a11y impact. The existing stream-error card, typing indicator and Stop control are reused.
- **Config.** No new environment variable. The re-read interval (10 s), the expiry grace period and the shutdown-flush bound are code constants.
- **Cost.**
  - Personal conversation: start 0 extra calls; terminal write +1 read; generating 1 read every 10 s; foreign Stop 1 conditional write.
  - Project conversation: every conditional attempt is 3 Core calls.
- **Docs.** `docs/architecture.md` (generation lifecycle and admission); `openspec/specs/project-conversations-api/spec.md`.

## Acceptance criteria

1. **Issue scenario.** Two principals send into one project conversation at the same time on a non-background model. Exactly one generation runs, the other request gets `409` before SSE headers, and the stored conversation keeps the winner's question and answer. This also holds when the two requests reach different service instances that share storage, which an integration test proves with a storage fake honouring `If-Match`.
2. **Two sessions, personal conversation.** Two cookie sessions of the same user sending into one personal conversation behave the same way.
3. **Terminal write keeps concurrent changes.** A rename and a rating saved during the generation survive its terminal write. A conversation deleted during the generation is not re-created.
4. **Client save during a foreign generation.** A client save from a tab that has not seen the running exchange keeps it.
5. **Expired marker.** An expired marker is neutralized by the next start, and that start proceeds.
6. **Stop from another participant.** A participant with write access stops the generation from another instance. Within ~10 s the partial answer is stored as stopped. With no worker alive, a new start succeeds ~1.5 minutes after Stop.
7. **Graceful shutdown.** Shutdown during a foreground generation leaves no marker when its terminal write completes within the bound.
8. **Publish and duplicate.** Publish returns `409` while a marker is live. Duplicate produces a copy without it.
9. **Second participant's UI.** A live marker is never shown as interrupted, and the conflict text no longer mentions another tab or stopping.
10. **Verification gates.** `npm run openapi:check`, `npm run validate:specs`, `npm run validate:docs` and the affected tests pass, and the "Known gap" bullet is gone.

## Rollback and compatibility

- **Not breaking for the API.** The new message field is optional and additive. Older clients pass unknown message fields through, because `Message` has an index signature. A client body that drops the field is repaired by the merge.
- **Observable behavior changes:**
  - a second concurrent send now gets `409` across sessions and replicas;
  - a start-state write failure fails the send instead of streaming;
  - Stop from another writer is accepted.
- **Rollback.** Revert the change. Markers already stored are then ignored by every reader, because only this change reads `foregroundGeneration`, and the field stays inert in stored conversations. No migration is needed.
