# foreground-generation-lock Specification

## Purpose

Serializes Chat Completions and stateless Responses generations in one conversation across principals, sessions and BFF instances through a stored, server-owned `foregroundGeneration` marker written with `If-Match`: how the marker is created, expires, is released, honours a Stop from any writer, and is treated by client saves, copies and publish.

## Requirements

### Requirement: A foreground generation is identified by a stored marker on its assistant message

A generation on the Chat Completions or stateless Responses path (a *foreground* generation, as opposed to the background path of `background-responses-generation`) SHALL hold its conversation through a server-owned marker on the assistant message it produces. The marker is the field `foregroundGeneration` of `ConversationMessageDto` (`apps/chat-api/src/conversations/dto/conversation-message.dto.ts`), typed by a new `ForegroundGenerationDto` (`apps/chat-api/src/conversations/dto/foreground-generation.dto.ts`):

| Field | Type | Meaning |
| --- | --- | --- |
| `generationId` | string (UUID v4) | The client-supplied id of the request that started the generation. It identifies the message across writes, because messages have no ids of their own. |
| `startedAt` | number (epoch ms) | Server time at which the start-state write was built. |
| `expiresAt` | number (epoch ms) | Server time after which the marker no longer holds the conversation. |
| `stopRequestedAt` | number (epoch ms), optional | Server time at which a Stop was written to the marker. |

```json
{
  "role": "assistant",
  "content": "",
  "deploymentId": "gpt-4o",
  "foregroundGeneration": {
    "generationId": "4b2c8f1e-7d3a-4c5b-9e2f-0a1b2c3d4e5f",
    "startedAt": 1793875200000,
    "expiresAt": 1793877120000
  }
}
```

**Who writes the marker.**

- Only the backend creates, changes or removes a marker.
- The start-state write creates it. Its `expiresAt` is `startedAt + MAX_GENERATION_DURATION_MS + GENERATION_FINALIZE_TIMEOUT_MS + FOREGROUND_EXPIRY_GRACE_MS`, using the configuration of the instance that writes it. `FOREGROUND_EXPIRY_GRACE_MS` is 60 s. The stored value is authoritative, so instances with different configuration agree on the same marker.
- The terminal write removes it.
- No heartbeat renews it.

**Liveness.** A marker is *live* while the reading instance's clock is before `expiresAt`. An expired marker SHALL be treated by every reader as if the generation were absent.

**Shared helper.** `findActiveGeneration` SHALL return a conversation's active generation, if any: a message with `backgroundGeneration.status: "pending"`, or a message with a live `foregroundGeneration`. Every check that decides whether a conversation is generating SHALL use it:

- completion admission;
- the background placeholder;
- the client-save merge;
- publish.

It lives with the other marker helpers in `apps/chat-api/src/conversations/generation/foreground-generation.ts`, outside the service files, like `apps/chat-api/src/conversations/generation/background-message.ts`.

This applies to every conversation, top-level and project alike. Feature-flag gating: none. The marker is part of core completion behavior and is not gated by `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`.

**Generated-client impact.** `ConversationMessageDto` gains an optional `foregroundGeneration` property of schema `ForegroundGenerationDto`. No operation, operationId or SDK method changes. `npm run openapi` regenerates `libs/chat-api-client`. Every frontend caller keeps the methods it uses today.

#### Scenario: The start-state write carries the marker

- **WHEN** a foreground generation with `generationId` G writes its start state at server time T, with `MAX_GENERATION_DURATION_MS` 1800000 and `GENERATION_FINALIZE_TIMEOUT_MS` 60000
- **THEN** the stored assistant placeholder carries `foregroundGeneration { generationId: G, startedAt: T, expiresAt: T + 1920000 }`

#### Scenario: An expired marker does not hold the conversation

- **WHEN** a conversation's only marker has `expiresAt` earlier than the reading instance's clock
- **THEN** `findActiveGeneration` returns no active generation for it

#### Scenario: A background generation is still an active generation

- **WHEN** a conversation holds a message with `backgroundGeneration.status: "pending"` and no `foregroundGeneration`
- **THEN** `findActiveGeneration` returns that message

### Requirement: The start-state write takes the lock or fails the request before streaming

`ConversationStreamingService.streamCompletion` (`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`) SHALL write the start state of a foreground generation through `ConversationPersistencePort.updateConversation`, passing the stored version it read as `initial`. The first attempt therefore needs no extra read.

**Admission check.** After reading the conversation, and before any write, a conversation with an active generation (`findActiveGeneration`) SHALL be rejected with `409` (`ConflictException(GENERATION_ACTIVE_MESSAGE)`).

**Each update attempt SHALL:**

1. Respond `409` when the version it applies to has an active generation.
2. Neutralize every expired `foregroundGeneration` marker in that version:
   - remove the field;
   - set `streamErrorMessage: ''` on that message when it carries neither `streamErrorMessage` nor `wasStoppedByUser`.
3. Build the history with `buildConversationHistory` on that version, not on the version read before.
4. Set this generation's marker on the assistant placeholder.
5. Write with `If-Match` on that version's `ETag`.

A version conflict re-reads and repeats, up to `CONDITIONAL_WRITE_ATTEMPTS` (3). When every attempt conflicts, the request SHALL end with `409`.

**Failures.** Any other failure of this write SHALL end the request before SSE headers are sent, with the status the exception filter maps it to. That includes:

- a storage error (`502`);
- a missing project or conversation (`404`);
- a full project (`413`);
- a stored version read without an `ETag` (`503`).

On every failure the registry entry SHALL be released exactly once, as for any other pre-stream failure. The stream SHALL NOT open without the marker stored, because the terminal write can only apply to its own marker.

**Timing.** The write is the `StartStateSave` preparation step, bounded by `GENERATION_PREPARATION_TIMEOUT_MS` as `generation-registry` defines.

#### Scenario: Two principals start at the same time on different instances

- **GIVEN** two principals read the same version of one conversation on two instances
- **WHEN** both write their start state
- **THEN** exactly one write is stored with its marker, and the other request gets `409` before SSE headers, with no upstream model request made for it

#### Scenario: A start after another start was stored sees the marker

- **WHEN** a principal posts a completion after another principal's start state, with a live marker, was stored
- **THEN** the response is `409`, no write is made, and the stored conversation is unchanged

#### Scenario: Two sessions of one user in a personal conversation

- **WHEN** two cookie sessions of the same user post completions to one personal conversation at the same time
- **THEN** one of them gets `409`, although their registry keys differ

#### Scenario: An expired marker is taken over

- **GIVEN** a conversation whose last assistant message carries an expired marker and no terminal markers
- **WHEN** a new completion is posted
- **THEN** the start-state write stores that message with `streamErrorMessage: ''` and without the marker, appends the new exchange with the new marker, and the generation streams

#### Scenario: A storage error fails the request without streaming

- **WHEN** the start-state write fails with a DIAL Core `5xx`
- **THEN** the response is `502` before SSE headers, no upstream model request is made, the registry key is released, and a retry is not rejected by the registry

### Requirement: The terminal write applies only to the generation's own marker

A foreground generation's terminal write SHALL be a single operation through `ConversationPersistencePort.updateConversation`. Each attempt re-reads the latest stored version and SHALL:

1. Locate the assistant message whose `foregroundGeneration.generationId` equals the generation's id.
2. Replace that message's server-owned fields with the assembled result, removing every server-owned field the result does not carry. The server-owned fields are `content`, `custom_content`, `responseId`, `streamErrorMessage` and `wasStoppedByUser`.
3. Keep that message's client-owned fields, for example `rating`, as stored.
4. Remove its `foregroundGeneration`.
5. Merge the message's `html_tag` annotations into the stored version's `customViewState`, as `conversation-custom-view-state` defines.
6. Write with `If-Match`.

Every other message and every conversation-level field SHALL be written as stored, so a rename, a rating or a settings change made during the generation survives.

When the message is missing, its marker carries another `generationId`, the marker is gone, or the conversation is gone, the attempt SHALL write nothing (`Skipped`). The operation is bounded to `CONDITIONAL_WRITE_ATTEMPTS` (3); a project write repeats internally on changes to other project files, as `ProjectConversationStore.saveConversationIfMatch` does.

The outcomes SHALL be reported as follows:

| Outcome | Completion stream / attach subscribers | Registry |
| --- | --- | --- |
| Saved | Unchanged from `backend-owned-generation-persistence` (`done`, `stopped`, or `error`) | Settles |
| Skipped (the marker is no longer this generation's) | `conversation_save_failed` without `status` and with the terminal markers of an answer that did not complete | Settles |
| Every attempt conflicted | `conversation_save_failed` without `status`, as above | Settles |
| Storage error | `conversation_save_failed` with the mapped `status`, as today | Settles |

A skipped or conflicted write SHALL NOT be retried by the backend, and SHALL NOT write the conversation unconditionally.

#### Scenario: A rename during the generation survives

- **GIVEN** a foreground generation is streaming and a client renames the conversation
- **WHEN** the generation's terminal write runs
- **THEN** the stored conversation has the new name and the final answer, and the answer message has no `foregroundGeneration`

#### Scenario: A rating on an earlier message survives

- **WHEN** a client rates an earlier assistant message while the generation streams, and the generation then completes
- **THEN** the stored earlier message keeps its rating and the final answer is stored

#### Scenario: A deleted conversation is not re-created

- **WHEN** the conversation is deleted while its generation streams, and the terminal write then runs
- **THEN** no write is made, the conversation stays deleted, and the stream reports `conversation_save_failed` without `status`

#### Scenario: A taken-over marker is not overwritten

- **GIVEN** a generation's marker expired and a new generation took the conversation over
- **WHEN** the old generation's terminal write runs
- **THEN** no write is made and the new generation's exchange is unchanged

### Requirement: A generation that stored its marker always releases it

Every foreground generation whose start-state write stored its marker SHALL end with exactly one write operation that removes that marker. The only exception is a process crash. The terminal write above is that operation for a generation that streamed.

A *release write* removes the marker and sets `streamErrorMessage: ''` on the placeholder. It uses the same precondition as the terminal write: it applies only while the marker carries this generation's id. It is the one operation for:

- a generation stopped by process shutdown after its start state was stored and before its stream opened;
- an abandoned `StartStateSave` step (`generation-registry` "Generation preparation is bounded, and an abandoned preparation retains ownership until it settles") whose write is later stored. That request already failed with `503`, so the release write runs when the abandoned write settles, before the entry settles;
- a start-state write that failed with anything other than a version conflict or `409`, such as a timeout or a `5xx`. Its outcome is unknown, because DIAL Core may have stored it before the failure reached the BFF. The worker SHALL attempt one release write before releasing the entry, and that write is a no-op when nothing was stored.

A release write that fails SHALL be logged, and the marker then stops holding the conversation at its `expiresAt`. A process crash leaves the marker in place until its `expiresAt`; this is a known limitation.

#### Scenario: An abandoned start write that lands later is released

- **GIVEN** the start-state write outlived `GENERATION_PREPARATION_TIMEOUT_MS` and the request failed with `503`
- **WHEN** that write is then stored
- **THEN** one release write removes the marker and stores `streamErrorMessage: ''` on the placeholder, and a new completion for the conversation is admitted

#### Scenario: A start write with an unknown outcome is released

- **GIVEN** the start-state write timed out after DIAL Core stored it
- **WHEN** the request fails before SSE headers
- **THEN** one release write finds the generation's marker, removes it and stores `streamErrorMessage: ''` on the placeholder, and a retry is admitted

#### Scenario: Shutdown before the stream opens releases the marker

- **GIVEN** the start state with the marker was stored
- **WHEN** the module is destroyed before the stream opens
- **THEN** the request fails before SSE headers, and one release write removes the marker within the shutdown flush bound

### Requirement: The worker re-reads its conversation and honours a stored Stop

While a foreground generation streams, from the moment its stream opens until its terminal write is dispatched, the worker SHALL re-read its stored conversation every `FOREGROUND_REREAD_INTERVAL_MS` (10 s). It reads with the generation's own token, through `ConversationPersistencePort.readConversationWithEtag`, and makes no write.

- When its own marker carries `stopRequestedAt`, the worker SHALL cancel its lease with reason user-stop. The generation then ends exactly as a Stop on its own instance does: the partial answer is stored with `wasStoppedByUser: true` by its terminal write.
- When its own marker is absent — the conversation was deleted, the message removed, or the marker neutralized — the worker SHALL cancel its lease with reason lock-lost (`generation-registry`). The upstream request is aborted, so no tokens are spent on an answer that cannot be stored, and its terminal write is then skipped.
- A failed re-read SHALL be ignored until the next interval.

No re-read runs on the background path or after the terminal write is dispatched, and the interval timer is cleared at settlement.

#### Scenario: A Stop written from another instance stops the generation

- **GIVEN** a foreground generation streams on instance A
- **WHEN** instance B stores `stopRequestedAt` on its marker
- **THEN** within `FOREGROUND_REREAD_INTERVAL_MS` instance A aborts the upstream request, and the stored answer carries `wasStoppedByUser: true` and the partial content

#### Scenario: A deleted conversation stops the generation

- **WHEN** the conversation is deleted while its generation streams
- **THEN** at the next re-read the upstream request is aborted, the cancellation reason is lock-lost, and no conversation write is made

### Requirement: A Stop from any writer is stored on the marker

When a Stop names a `generationId` that this instance does not run for the caller's principal, and no pending background message carries it, the backend SHALL try to store the Stop on the conversation's foreground marker. This is the `stop-generation-endpoint` foreground-marker branch. The write is a conditional update with the caller's own token that applies only while the message carrying that `generationId` has a live marker. It SHALL set:

- `stopRequestedAt` to the current server time;
- `expiresAt` to `min(expiresAt, now + FOREGROUND_STOP_RELEASE_MS)`, where `FOREGROUND_STOP_RELEASE_MS` is `2 × FOREGROUND_REREAD_INTERVAL_MS + GENERATION_FINALIZE_TIMEOUT_MS` (80 s with defaults).

This bounds a marker whose worker is gone without a separate rule. A marker that already carries `stopRequestedAt` is left unchanged and the Stop succeeds.

**Authorization.** DIAL Core decides it through the write itself:

- a caller who cannot read or write the conversation gets the same `404` as for an unknown generation;
- in a project, `ProjectAccessService.assertCanWrite` refuses a view-only caller with `403` first.

**Local fast path.** After the write is stored, or when the marker already carries `stopRequestedAt`, a generation on this instance with that `generationId` on the same conversation resource SHALL be aborted at once with reason user-stop. Its worker does not wait for its next re-read.

The resource is the `path` qualified by the stopping caller's bucket (`qualifySessionConversationPath`), compared with the qualified path the generation registered with. A personal `path` is bucket-relative, so matching on it alone would let a Stop stored on a same-named conversation in one user's bucket abort another user's generation.

**Diagnostics.** When reading or writing the marker throws for a reason other than an access refusal (`403`, `404`), or the write cannot be stored, the backend SHALL log one warning naming the `generationId`, the result, whether the read or the write failed, the error class name and the HTTP status. It SHALL NOT log a token, a message text, a response body or a conversation path, and a plain `not_found` (a generation this instance runs itself) SHALL NOT be logged.

#### Scenario: An editor stops another editor's generation

- **GIVEN** editor E1 is generating in a shared project conversation on instance A
- **WHEN** editor E2 posts Stop with that `generationId` to instance B
- **THEN** the response is `204`, `stopRequestedAt` is stored, and the generation stops within `FOREGROUND_REREAD_INTERVAL_MS`

#### Scenario: Stop releases the lock of a crashed generation

- **GIVEN** a marker whose instance crashed is still live
- **WHEN** a writer posts Stop with its `generationId` at time T
- **THEN** the stored marker's `expiresAt` is at most `T + FOREGROUND_STOP_RELEASE_MS`, and a completion posted after that time is admitted

#### Scenario: Stop on the same instance aborts at once

- **WHEN** a writer's Stop is stored and the generation runs on the same instance under another principal
- **THEN** that generation is aborted before the response is sent, without waiting for a re-read

#### Scenario: A repeated Stop on the same instance aborts at once

- **GIVEN** a Stop for a generation was stored through another instance, and the generation runs on this instance under another principal
- **WHEN** a writer posts Stop with its `generationId` to this instance
- **THEN** no write is made, the response is `204`, and that generation is aborted before the response is sent

#### Scenario: A Stop never reaches a same-named conversation in another bucket

- **GIVEN** user A generates in their conversation at bucket-relative path P with `generationId` G on this instance
- **WHEN** user B stores a Stop on a marker carrying G in B's own conversation at the same relative path P
- **THEN** A's generation is not aborted

### Requirement: Client saves, copies and publish never carry or drop a live marker

Client saves are governed by `background-responses-generation` "Client conversation saves cannot change a pending background message", which SHALL treat a stored live `foregroundGeneration` exactly as a stored `pending` background message:

- the stored marked message's server-owned fields and its marker win over the body's copy;
- a body without a copy gets the stored messages back up to and including the marked one;
- a body message carrying a foreground marker that storage no longer holds, at a position where storage has a finished assistant answer without a marker, takes that stored answer's server-owned fields while the body still lines up with storage (the same number of messages and the same preceding message). A stale tab therefore never turns a finished foreground answer into an interrupted one;
- every other foreground marker in the body that storage does not hold as live is neutralized;
- persistent conflicts or a missing `ETag` while it is live end in `503`.

The body's copy is the message carrying the same `foregroundGeneration.generationId` or, because a client never receives the marker during its own live stream, the unmarked assistant message at the stored position.

**Copies.** When the backend creates a conversation from another one's content (`apps/chat-api/src/conversations/lifecycle/conversation-lifecycle.service.ts`, duplicate), every `foregroundGeneration` SHALL be removed in the copy. A message that carries neither `streamErrorMessage` nor `wasStoppedByUser` SHALL get `streamErrorMessage: ''`. Import reaches the backend as a client save and is covered above.

**Publish.** `POST /api/v1/conversations/publish` SHALL reject a conversation with a live marker with `409` and `PUBLISH_WHILE_GENERATING_MESSAGE`, as for a pending background message, before creating any publication. An expired marker does not block publishing.

#### Scenario: A stale tab saves during another participant's generation

- **GIVEN** storage holds `[q1, a1, q2, a2(foregroundGeneration live)]` and another tab still holds `[q1, a1]`
- **WHEN** that tab saves a rating on `a1`
- **THEN** storage holds `[q1, a1(rated), q2, a2(foregroundGeneration live)]` and the later terminal write of `a2` succeeds

#### Scenario: A client body cannot create a marker

- **WHEN** a client body carries a `foregroundGeneration` that storage does not hold as live
- **THEN** the saved message has no `foregroundGeneration`, and has `streamErrorMessage: ''` when it had no terminal markers

#### Scenario: A stale tab's copy of a finished answer keeps the answer

- **GIVEN** storage holds `[q1, a1("final answer")]` and a tab still holds `[q1, a1(foregroundGeneration)]` from while the answer was generating
- **WHEN** that tab saves the conversation
- **THEN** the saved `a1` is `"final answer"` without a marker and without `streamErrorMessage`

#### Scenario: Duplicate while an answer is generating

- **WHEN** a conversation with a live marker is duplicated
- **THEN** the copy's message has no marker and has `streamErrorMessage: ''`, and the original generation's terminal write still lands in the original

#### Scenario: Publish while an answer is generating

- **WHEN** a conversation with a live marker is published
- **THEN** the response is `409` with `PUBLISH_WHILE_GENERATING_MESSAGE` and no publication is created

### Requirement: Lock outcomes are observable without content

The backend SHALL count foreground lock outcomes on a counter `generation.foreground.outcomes`, defined next to `generation.background.outcomes` in `apps/chat-api/src/conversations/generation/generation-metrics.ts`. Its attribute `outcome` is drawn from a named string enum `ForegroundGenerationOutcome` with exactly these values:

- `start_conflict`;
- `expired_takeover`;
- `start_failed`;
- `terminal_skipped`;
- `terminal_conflict`;
- `stop_stored`;
- `lock_lost`;
- `released_before_stream`;
- `release_failed`.

Log lines MAY carry `generationId` and the conversation path. They SHALL NOT carry prompt or answer text, tokens, or principal identity.

#### Scenario: A conflict at start is counted

- **WHEN** a start-state write ends in `409` because another generation's marker is live
- **THEN** one `start_conflict` outcome is recorded and no message text appears in logs

#### Scenario: A skipped terminal write is counted

- **WHEN** a terminal write is skipped because the marker is no longer the generation's
- **THEN** one `terminal_skipped` outcome is recorded
