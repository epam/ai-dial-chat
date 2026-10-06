## Purpose

Lifecycle of an assistant generation that DIAL Core runs as a background Responses job: which deployments are eligible, how the job is associated with the persisted message, and how finalization, recovery, Stop, cleanup and telemetry work across browser disconnects, BFF restarts and BFF instances without the BFF accumulating the answer in memory.

## Requirements

### Requirement: Background eligibility is decided per new generation

A new completion request SHALL use the background Responses path only when all of the following hold at request start:

1. the server-only feature `features.responsesApiEnabled` resolves to `true`;
2. the server-only feature `features.responsesBackgroundEnabled` resolves to `true`;
3. the resolved deployment details report `features.responsesApi === true` (the existing Responses capability);
4. the target model or application is reported by DIAL Core's deployment info (`GET /v1/deployments/{deployment_name}`) with `interfaces` containing `"openaiResponses"`.

When any condition does not hold, the request SHALL follow the existing selection unchanged (stateless Responses when conditions 1 and 3 hold, otherwise Chat Completions). A failure to resolve either flag SHALL count as `false`. A failure to read the deployment's `interfaces` SHALL count as "not eligible" and SHALL NOT fail the request.

The `interfaces` lookup SHALL be performed only when conditions 1–3 hold, SHALL use the caller's token, and SHALL be cached under `deployments:interfaces:<userSub>:<deployment>` with the same TTL as the existing `deployments:details:<userSub>:<deployment>` entry, and invalidated together with it.

**Feature flag:** gated by `features.responsesBackgroundEnabled` (`RESPONSES_BACKGROUND_ENABLED`, server-only, default `false`) in addition to `features.responsesApiEnabled`. Not exposed through `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`; no role-based rollout.

#### Scenario: Eligible deployment starts a background job

- **WHEN** both flags are `true`, the deployment reports `features.responsesApi: true`, and its `interfaces` contains `"openaiResponses"`
- **THEN** the upstream request is `POST /openai/v1/responses` with `background: true`, `store: true`, `stream: true`

#### Scenario: Background flag off keeps today's behavior

- **WHEN** `features.responsesBackgroundEnabled` is `false`
- **THEN** no `interfaces` lookup is made and the request is sent exactly as before this change (stateless Responses or Chat Completions)

#### Scenario: Interface present but Responses capability absent

- **WHEN** both flags are `true`, the deployment's `interfaces` contains `"openaiResponses"`, but `features.responsesApi` is not `true`
- **THEN** no `interfaces` lookup is made and the request uses Chat Completions, as before this change

#### Scenario: Deployment without the interface keeps today's behavior

- **WHEN** both flags are `true`, `features.responsesApi` is `true`, and the deployment's `interfaces` does not contain `"openaiResponses"`
- **THEN** the request uses the stateless Responses path

#### Scenario: Interfaces lookup failure is not eligible

- **WHEN** conditions 1–3 hold and the deployment-info lookup fails with any error
- **THEN** the request is not routed to the background path and the completion still proceeds on the stateless Responses path

### Requirement: The background message is identified by its generationId and carries the association

A background generation's assistant message SHALL carry the existing optional `responseId` and a new optional `backgroundGeneration` object:

```json
{
  "role": "assistant",
  "content": "",
  "responseId": "dial_gpt-5_7f3c9a2e-...",
  "backgroundGeneration": {
    "generationId": "2d0b6c8e-5f7a-4c1b-9e3d-1a2b3c4d5e6f",
    "status": "pending",
    "startedAt": 1790000000000
  }
}
```

`status` SHALL be one of `pending`, `completed`, `stopped`, `failed`. `generationId` is the client-supplied generation id of the request that started the job. `startedAt` is the server time (epoch ms) at which the placeholder was saved. Messages produced by the Chat Completions or stateless Responses paths SHALL NOT carry `backgroundGeneration`.

`backgroundGeneration.generationId` SHALL be the identity of that message on the background path: every backend read, precondition, and write for a background generation SHALL locate the message by it, not by its position, and SHALL replace that one message in place, leaving every other message — including messages appended after it, such as a model-changed status message — unchanged.

The message's fields are split by owner. **Server-owned:** `content`, `custom_content`, `responseId`, `backgroundGeneration`, `streamErrorMessage`, `wasStoppedByUser`. **Client-owned:** every other message field (for example `rating`). Background-path writes change only server-owned fields and keep the stored client-owned fields.

#### Scenario: Placeholder is saved before the job is created

- **WHEN** an eligible generation starts
- **THEN** the conversation is saved with the assistant placeholder carrying `backgroundGeneration.status: "pending"`, its `generationId` and `startedAt`, and no `responseId`, before `POST /openai/v1/responses` is sent

#### Scenario: responseId is saved as soon as Core assigns it

- **WHEN** Core emits `response.created` for the background job
- **THEN** the backend saves the message with `responseId` set to that response's `id` while keeping `status: "pending"`, before relaying any content delta that follows

#### Scenario: The responseId save finds the message already stopped

- **WHEN** Stop changed the message before the `responseId` save, so it is no longer `pending` with this `generationId`
- **THEN** the backend does not write, sends a best-effort Core cancel for the new `responseId`, and ends its relay

#### Scenario: responseId save fails transiently

- **WHEN** the `responseId` save fails with a storage error
- **THEN** the backend retries it up to 3 times and, if it still fails, keeps relaying and includes `responseId` in the terminal write

#### Scenario: A status message appended after the pending message is kept

- **GIVEN** the user changed the model during a background generation, so a status message was appended after the pending assistant message
- **WHEN** the final answer is written
- **THEN** the assistant message identified by `generationId` is replaced in place and the status message after it is still present

#### Scenario: Non-background messages are unchanged

- **WHEN** a generation runs on the Chat Completions or stateless Responses path
- **THEN** the saved assistant message has no `backgroundGeneration` field

### Requirement: One pending background generation per conversation

While a conversation contains a message with `backgroundGeneration.status: "pending"`, the backend SHALL reject every new completion request for it — send, regenerate, and edit modes alike — with the existing generation-conflict error (`409`, `ConflictException(GENERATION_ACTIVE_MESSAGE)`), regardless of the current flag values. `streamCompletion` (`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`) first resolves the deployment's generation API (DIAL Core deployment reads), then reads the conversation and throws the `409`; no Core generation or job call is made before it.

The placeholder save that starts a background generation SHALL be a conditional write against the conversation version the backend read, and SHALL complete before any Core job is created:

- saved → the backend creates the background job;
- rejected because the conversation changed → the backend SHALL re-read; if the conversation now contains a `pending` background message it SHALL respond `409`, otherwise it SHALL rebuild the placeholder on the new version and retry, up to 3 attempts, then respond `409`;
- failed for any other reason (storage error, timeout) → the backend SHALL NOT create a background job and SHALL continue the same request on the stateless Responses path exactly as it runs when the background flag is off (including its best-effort start save). This is not a resubmission: no generation has started yet.

#### Scenario: Two tabs send at the same time

- **WHEN** two completion requests for the same conversation race on different BFF instances
- **THEN** exactly one placeholder save succeeds and creates a Core job; the other request receives `409` and no Core job is created for it

#### Scenario: Send from another instance while a job is pending

- **WHEN** a send, regenerate, or edit request arrives while the conversation contains a `pending` background message
- **THEN** the request receives `409` and no Core job is created

#### Scenario: A naming write between read and placeholder save is not a conflict

- **WHEN** the placeholder save is rejected because the display-name writer updated the conversation, and the re-read shows no `pending` background message
- **THEN** the backend retries the placeholder save on the new version and the generation starts, with no `409`

#### Scenario: Placeholder save hits a storage error

- **WHEN** the placeholder save fails with a storage error that is not a version conflict
- **THEN** no request with `background: true` is sent, the completion runs on the stateless Responses path (`store: false`), and the user receives the answer as before this change

### Requirement: Every background write applies only to the same pending generation

Every write the backend makes to a background message after the placeholder (saving `responseId`, final, stopped, failed, expired, interrupted) SHALL be a conditional write that applies only while the stored conversation still contains the message with the write's `generationId` in `status: "pending"`. On a version conflict the backend SHALL re-read and re-check, up to 3 attempts. When the precondition no longer holds (the message is finished, or was removed), the write SHALL be skipped as a no-op. Writers on different instances MAY run for the same generation; this precondition guarantees that exactly one terminal state is persisted and that no terminal state is ever replaced.

#### Scenario: An expiry write loses to a completed answer

- **GIVEN** the originating instance saved the final answer and deleted the Core response
- **WHEN** an attach on another instance, which read the message while it was still `pending`, receives `404` from Core and tries to save `failed`
- **THEN** the re-check finds `status: "completed"`, no write is made, and the completed answer is kept

#### Scenario: Two finalizers for one job

- **WHEN** the originating instance and an attach on another instance both finalize the same completed job
- **THEN** exactly one final write applies and the other is skipped

#### Scenario: Client-owned fields survive a background write

- **GIVEN** the user rated the pending message and the save endpoint stored that rating
- **WHEN** the final answer is written
- **THEN** the stored rating is still present on the finished message

### Requirement: Client conversation saves cannot change a pending background message

`PUT /api/v1/conversations?path=<path>` (operationId `saveConversation`, body `SaveConversationBodyDto`, response `200` with `ConversationResponseDto`) SHALL keep its contract. When the stored conversation contains a message with `backgroundGeneration.status: "pending"`, the backend SHALL save the client's body with that one message's server-owned fields replaced by the stored values (and the message re-inserted at its stored position if the body omitted it), keep the client's values for that message's client-owned fields, and write it as a conditional write with bounded re-read on a version conflict. The body's copy of the pending message is the message carrying the same `generationId` or, because a client never receives the marker during a live stream, the assistant message at the pending message's stored position. When the body has no copy of the pending message (a stale tab or device), the backend SHALL put back the stored messages from the body's end (or the pending position, whichever comes first) through the pending message, so a stale body can drop neither the question nor the answer. The response SHALL be the conversation as actually saved.

Every client save of an existing conversation SHALL be a conditional write on the version it read, with bounded re-read on a version conflict, whether or not a pending message exists: an unconditional save could overwrite a placeholder or a final answer written between the read and the write. Pending markers in the body are neutralized as before, and a title LLM naming already stored is kept. A conversation that does not exist yet, a read that fails, or storage that returns no `ETag` keeps the unconditional save — except that a stored `pending` message without an `ETag` makes the save respond `503`, because it cannot be protected. A body message whose `generationId` storage already holds as `completed`, `stopped`, or `failed` SHALL take the stored server-owned fields, so a stale tab still showing it as `pending` never turns the finished answer into `failed`. When no body message carries that `generationId`, an unmarked assistant message at the stored message's position is its copy and SHALL take the stored server-owned fields too (a tab that streamed the answer and has not reloaded, saving after Stop on another device), but only while the body still lines up with storage (the same number of messages and the same preceding message): after earlier messages are deleted, positions shift, and a different answer at that position SHALL be saved as sent. When the body holds a different generation's assistant message at the pending message's position (a tab that has not seen a regenerate), the stored pending message SHALL replace it. After 3 conflicts in a row, the backend SHALL read the conversation once more: when that read holds no `pending` background message, the body merged against it SHALL be saved unconditionally (the behavior before this change); when it holds one, the save SHALL respond `503`, as other conversation endpoints do when storage is unavailable, because the conflict may come from that message's own write. Rename SHALL handle persistent conflicts the same way.

Example: stored `[user, assistant{content:"", responseId:"dial_x", backgroundGeneration:{status:"pending",...}}]`; client body `[user, assistant{content:"Hel", rating:true}]` with a new `prompt` → saved and returned `[user, assistant{content:"", responseId:"dial_x", backgroundGeneration:{status:"pending",...}, rating:true}]` with the new `prompt`.

No new error code is introduced; the generated `chat-api-client` method and every frontend caller stay unchanged.

#### Scenario: Rating an older message during a background generation

- **WHEN** the client saves the conversation to store a rating on an earlier message while the last answer is `pending`
- **THEN** the rating is saved, the pending message keeps its stored `backgroundGeneration` and `responseId`, and the later final write succeeds

#### Scenario: Overlay sets the system prompt during a background generation

- **WHEN** an overlay host sets the system prompt while a background generation is `pending`
- **THEN** the new prompt is saved and the pending message is unchanged

#### Scenario: Save without a pending message

- **WHEN** the stored conversation has no `pending` background message
- **THEN** the client body is saved with its pending markers neutralized, as a conditional write on the version read

#### Scenario: A placeholder is saved between the read and the write

- **WHEN** a client save reads a conversation without a pending message and a new background start saves its placeholder before the client's write
- **THEN** the client's write gets a version conflict, re-reads, and saves with the placeholder protected

#### Scenario: Conflicts persist on a conversation without a pending answer

- **WHEN** a client save meets a version conflict on every attempt and the read after them has no `pending` background message
- **THEN** the body is saved unconditionally, as before this change, and the endpoint returns `200`

#### Scenario: The last conflict comes from a new placeholder

- **WHEN** a client save meets a version conflict on every attempt, the last one caused by a new generation's `pending` placeholder
- **THEN** the read after the conflicts sees the placeholder, the save responds `503`, and the placeholder is kept

#### Scenario: A stale tab saves during a background generation

- **GIVEN** storage holds `[q1, a1, q2, a2(pending)]` and another tab still holds `[q1, a1]`
- **WHEN** that tab saves a rating on `a1`
- **THEN** storage holds `[q1, a1(rated), q2, a2(pending)]`

### Requirement: The background path relays without accumulating the answer

While relaying a background generation, the backend SHALL forward each normalized chunk to the connected client and SHALL NOT retain the growing assistant text or assembled message for the generation's lifetime. Transport-level buffering and the existing backpressure limits remain. Closing the client connection SHALL NOT cancel the Core job; the originating instance SHALL keep reading the Core stream to its terminal event.

#### Scenario: Memory does not grow with answer length

- **WHEN** a background generation produces a very long answer
- **THEN** the backend's retained per-generation state stays constant-size (ids, status, timers) and does not include the answer text

#### Scenario: Tab closed mid-generation

- **WHEN** the browser closes the `/completions` connection while the job is running
- **THEN** the backend keeps consuming the Core stream and finalizes the message at the terminal event, and no Core cancel is sent

### Requirement: Finalization takes the final answer from Core

At the Core stream's terminal event, the backend SHALL retrieve the response once with `GET /openai/v1/responses/{response_id}`, normalize it, and write it following "Every background write applies only to the same pending generation", with the status mapped from the retrieved response:

| Retrieved Core status | Persisted |
|---|---|
| `completed` | final output, `status: "completed"` |
| `cancelled` | available output, `wasStoppedByUser: true`, no `streamErrorMessage`, `status: "stopped"` |
| `failed` | available output, `streamErrorMessage` (DIAL Core text, or `Responses generation failed`, as on the stateless path), `status: "failed"` |
| `incomplete` | available output, `streamErrorMessage: "Generation ended incomplete"` (as on the stateless path), `status: "failed"` |

"Output" is the text of the response's `message` items and their `output_text` parts only; reasoning text is never saved, the same as on the live stream.

A background job is only ever cancelled by the Stop endpoint (other cancels are sent after the message has already left `pending`), so every writer that observes `cancelled` persists the same user-stop outcome, whichever writes first.

A finalizing write that cannot be completed (retries exhausted, token rejected, storage error) SHALL leave the message `pending` so that recovery can finalize it later.

#### Scenario: Normal completion

- **WHEN** Core emits `response.completed` and the message is still `pending` with this `generationId`
- **THEN** the saved message contains the final text from the retrieved response, keeps `responseId`, and has `status: "completed"`

#### Scenario: The originating instance sees the cancel before the Stop handler writes

- **GIVEN** Stop was handled on another instance, which called Core cancel but has not written yet
- **WHEN** the originating instance's Core stream ends and its retrieve returns `status: "cancelled"`
- **THEN** it writes `stopped` with `wasStoppedByUser: true`, the Stop handler's own write is then skipped, and the user never sees an error for a Stop

#### Scenario: A newer message is never overwritten

- **WHEN** a finalizer runs after the message identified by its `generationId` was stopped, finished, or removed
- **THEN** no write is made and the conversation is unchanged

#### Scenario: Upstream failure is finalized as failed

- **WHEN** the Core stream ends with `response.failed`, `response.incomplete`, an in-band error, or without a terminal event
- **THEN** the message is saved with `status: "failed"`, the `streamErrorMessage` the stateless path would show for the retrieved status, and any partial output the retrieved response contains

### Requirement: The completion stream ends cleanly whenever the outcome comes from storage

On the background path, `POST /api/v1/conversations/completions` SHALL end its SSE response without an error envelope — so the client's reload-after-complete reads the stored state — whenever its own outcome is not a successful final write of its own: its terminal write was skipped, its terminal write failed, its relay was detached at the max duration, or the process is shutting down. The existing error envelope SHALL be sent on this stream only for failures before the Core job was created. `POST /api/v1/conversations/completions/attach` keeps its typed terminal events: `done`, `stopped`, or `error` matching the stored status when its write was skipped, and the existing `conversation_save_failed` error when its own write failed.

#### Scenario: Tab that pressed Stop, routed to another instance

- **GIVEN** a tab is receiving a background generation from the originating instance and the Stop request was handled by another instance
- **WHEN** the originating instance's stream ends and its write is skipped because the message is already `stopped`
- **THEN** the tab's completion stream ends cleanly, its reload shows the stopped partial, and no error banner is shown

#### Scenario: Final save fails on the originating instance

- **WHEN** the originating instance cannot write the final answer and the message stays `pending`
- **THEN** its completion stream ends cleanly, the client's reload finds the message `pending` and resumes through attach, and the attach retries finalization with the client's current token

#### Scenario: Attach whose own final write fails

- **WHEN** an attach cannot write the final answer
- **THEN** it sends the existing `conversation_save_failed` error and the client settles with its persistence warning, so resume does not loop

### Requirement: Any instance recovers a pending background message on attach

`POST /api/v1/conversations/completions/attach` with `{ "path": "<conversation path>" }` SHALL, when the caller's conversation contains a message with `backgroundGeneration.status: "pending"` and a `responseId`, serve it through DIAL Core using the caller's token — on any instance, including the one that started the generation and holds its relay:

- job still running → open the SSE stream, emit `{ "type": "snapshot", "message": <stored pending message> }`, then replay the job's events from the beginning via `GET /openai/v1/responses/{response_id}?stream=true` as `chunk` events, then one terminal event, and finalize as the originating instance would;
- job already terminal → finalize from the retrieved response, then emit the snapshot of the saved message and the matching terminal event;
- Core answers `404` (expired or deleted) → save the message with `status: "failed"` and `streamErrorMessage: ''`, then emit a terminal `error` event;
- Core answers `403` → respond `404` and change nothing.

Every write in this list follows "Every background write applies only to the same pending generation", so an attach running in parallel with the originating instance's finalization never produces a second terminal state. Replay from the beginning SHALL NOT produce duplicated content on the client because the client seeds its draft from the snapshot.

#### Scenario: Refresh routed to another instance while the job runs

- **WHEN** a client attaches on an instance that did not start the generation and the job is still running
- **THEN** the client receives a snapshot, every chunk from the first token onward, and one terminal event, and sees no missing or duplicated text

#### Scenario: User returns after a BFF restart and the job finished

- **WHEN** the originating instance restarted before finalizing and the user opens the conversation after the job completed
- **THEN** the attach finalizes the message from Core's stored response, the client receives the terminal event, and the reloaded conversation shows the full answer with `status: "completed"`

#### Scenario: Job expired in Core

- **WHEN** the conversation's `pending` message references a response Core no longer knows (`404`)
- **THEN** the message is saved as `failed` with `streamErrorMessage: ''`, the client receives an `error` terminal event, and the existing error banner with Retry is shown

#### Scenario: Recovery never resubmits

- **WHEN** any recovery path runs
- **THEN** no `POST /openai/v1/responses` is issued

### Requirement: A start interrupted before responseId was saved is marked failed after 2 minutes

A `pending` background message that has no `responseId` and whose `startedAt` is more than 120 000 ms in the past SHALL be treated as an interrupted start: on attach, the backend SHALL save it with `status: "failed"` and `streamErrorMessage: ''` and SHALL NOT create a new Core job. Within the 120 000 ms window, attach SHALL respond `404` so the client keeps its existing watch-based resume. Stop on such a message is governed by "Stop cancels the Core job from any instance" and always results in `stopped`, whatever the message's age.

#### Scenario: BFF crashed between Core create and the responseId save

- **WHEN** the user opens the conversation 3 minutes after a start whose `responseId` was never saved
- **THEN** the message is saved as `failed`, the error banner with Retry is shown, and no generation is resubmitted automatically

#### Scenario: Healthy start still waiting for response.created

- **WHEN** another tab attaches 5 seconds after a start whose `responseId` is not saved yet
- **THEN** attach responds `404`, nothing is written, and the originating instance's generation continues unaffected

### Requirement: Stop cancels the Core job from any instance

`POST /api/v1/conversations/completions/stop` with `{ "generationId", "path", "content"? }` SHALL, when the caller's conversation contains the message with that `generationId` in `status: "pending"` (with or without a local registry entry, and whether the client started the generation or resumed it), stop it in this order:

1. save the posted `content` (the answer text the client has shown; the stored text when `content` is absent) with `wasStoppedByUser: true` and `status: "stopped"` following "Every background write applies only to the same pending generation";
2. respond `204`;
3. call `POST /openai/v1/responses/{response_id}/cancel` with the caller's token, without delaying the response.

The backend never assembles the answer, and DIAL Core cannot return partial text in time: its JSON retrieve has no partial output for a running or cancelled job, and its replay starts from the first event at the job's own pace, so on dev it delivered no text within 3 s. The client is therefore the only timely source of the text the user saw. Writing before cancelling means every other writer (the originating relay, an attach) already finds the message finished and skips, so a Stop can never be overwritten by an empty or `failed` state. A Stop that arrives after the job has finished still wins: the message is saved as stopped with the shown text, as Stop does on the stateless path.

If Core rejects the cancel (cancellation not supported, or an error), the message stays stopped, the backend responds `204` and records `cancel_unsupported`; the job's later terminal event SHALL NOT change the message. If no `responseId` was saved yet (judged by the message as written, not as first read), Stop SHALL save the message as stopped with the shown text (empty when none was posted) and respond `204`, and SHALL NOT end the local relay: the relay then reads the `responseId`, finds the message no longer `pending`, and cancels the job, so no job is left running. If the message is no longer `pending`, Stop SHALL respond `204` without writing (nothing to stop) and SHALL NOT end a local relay, which may still need to cancel a job whose id it has not read yet. If the stopped state cannot be saved, Stop SHALL respond `503` and SHALL NOT cancel the job, so the user can retry and the answer is not lost.

When the instance handling Stop also runs the generation's relay, it SHALL end that relay after the save, so the stopping tab stops receiving tokens even when Core does not honour the cancel. A generation stopped through the registry (a Stop that arrived before the placeholder was stored, so no background message was found) SHALL be saved as stopped with `wasStoppedByUser: true`, and its job cancelled if it already has a `responseId`; it SHALL NOT be left `pending`.

If the conversation cannot be read, attach and Stop SHALL take the registry path that non-background generations use, so a storage error does not break Stop or attach for them.

Closing a streaming connection SHALL NOT be treated as Stop.

#### Scenario: Stop on a different instance

- **WHEN** a user stops a background generation and the request is routed to an instance that did not start it
- **THEN** the text the client posted is saved with `wasStoppedByUser: true`, Core cancel is called after that save, and the originating instance's later terminal handling makes no write

#### Scenario: Cancel not supported

- **WHEN** Core rejects the cancel because the deployment cannot cancel active jobs
- **THEN** the message is saved as stopped with the available output, the endpoint returns `204`, and the job's eventual completion does not overwrite it

#### Scenario: Stop arrives before the placeholder is stored

- **WHEN** Stop reaches the originating instance before the placeholder is saved
- **THEN** the registry aborts the relay, and the message is saved as `stopped` with `wasStoppedByUser: true` instead of staying `pending`

#### Scenario: The stopped state cannot be saved

- **WHEN** every conditional write of the stopped state fails
- **THEN** the endpoint returns `503` and no Core cancel is sent

#### Scenario: Stop races completion

- **WHEN** Stop and the terminal finalization run at the same time
- **THEN** exactly one of them writes, and the other finds the message no longer `pending` and makes no write

### Requirement: Background relays detach, not finish, at the max duration and at shutdown

When a background generation reaches `MAX_GENERATION_DURATION_MS`, or the process shuts down while it is running, the originating instance SHALL stop reading the Core stream, end the client's completion stream cleanly, and release its registry entry, and SHALL NOT cancel the Core job or write the conversation. The message stays `pending`; the client resumes through attach (`chat-hooks-conversation-stream` "A stream that ends on a pending background message resumes"), and the job's lifetime is bounded by Core's background-job TTL.

#### Scenario: Generation longer than the max duration

- **WHEN** a background job is still running after `MAX_GENERATION_DURATION_MS`
- **THEN** no Core cancel is sent, the message stays `pending`, and a subsequent attach resumes it through Core

#### Scenario: Rolling deploy during a background generation

- **WHEN** the originating instance shuts down while a background job is running
- **THEN** no Core cancel is sent, no `failed` or `stopped` state is written, and the user's next attach on another instance resumes and finalizes the job

### Requirement: Conversation delete does not cancel background jobs

Conversation delete SHALL NOT cancel jobs: the delete endpoints receive only ids, and reading every conversation to find pending jobs is not justified. A deleted conversation's job runs to its end in Core; its finalization finds no conversation and makes no write.

#### Scenario: Deleting a conversation with a pending job

- **WHEN** a conversation containing a `pending` background message is deleted
- **THEN** no Core cancel is sent, and the job's later finalization makes no write

### Requirement: Copies never carry a live background job

When the backend creates a conversation from another one's content — duplicate and import — every message with `backgroundGeneration.status: "pending"` SHALL be written to the copy with `status: "failed"` and `streamErrorMessage: ''`, so no recovery, Stop, finalization, or delete ever runs against the original's job from the copy. Import reaches the backend as a client save, so it is covered by the rule that a client body can never create a `pending` marker. Finished background messages are copied unchanged.

Publish is different: DIAL Core copies the stored file itself (`createPublication`), so the backend cannot rewrite the copy. `POST /api/v1/conversations/publish` SHALL therefore reject a conversation that contains a `pending` background message with `409` and the message `The answer is still being generated. Publish the conversation after it finishes.`, before creating any publication. The frontend's existing publish-error notification shows that message; no frontend change is required.

#### Scenario: Duplicate while an answer is still generating

- **WHEN** the user duplicates a conversation whose last answer is `pending`
- **THEN** the copy's message is `failed`, opening the copy makes no Core call, and the original's job is still finalized into the original conversation

#### Scenario: Publish while an answer is still generating

- **WHEN** the user publishes a conversation whose last answer is `pending`
- **THEN** the request is rejected with `409`, no publication is created, and the user sees the publish-error notification with the "still being generated" message

#### Scenario: Publish after the answer finished

- **WHEN** the user publishes a conversation whose background answer is `completed`
- **THEN** the publication is created as before this change

### Requirement: The Core response is deleted after a successful final save

After a `completed`, `stopped`, or `failed` write applies for a message with a `responseId`, the backend SHALL call `DELETE /openai/v1/responses/{response_id}` best-effort. A `404` (already deleted by another finalizer) SHALL be treated as success. A `409` (job still active, e.g. cancel not supported) or any other error SHALL be logged and SHALL NOT change the message. A skipped write SHALL NOT trigger a delete. After Stop, the job may still be running when the stopped state is saved, so Stop SHALL delete only after the cancel returns a finished status; a job still running after the cancel is left to Core's TTL. The message SHALL keep its `responseId` after deletion, so rating requests are built exactly as before; that rating keeps working against the deployment after deletion is verified on the target deployment during rollout, not asserted by this capability.

#### Scenario: Cleanup after completion

- **WHEN** the final answer is saved
- **THEN** one `DELETE /openai/v1/responses/{response_id}` is sent and the saved message still carries `responseId`

#### Scenario: Second finalizer's delete finds nothing

- **WHEN** a `DELETE` returns `404` because another instance already deleted the response
- **THEN** the backend treats it as success and records no `delete_failed` outcome

#### Scenario: Rating request after deletion is unchanged

- **WHEN** the user rates a message whose Core response was deleted
- **THEN** the rate request carries the same `responseId` it would have carried before deletion

### Requirement: Recovery and Stop do not depend on the background flag

Attach recovery, finalization, Stop, the pending-message protection of the save endpoint, the one-pending-generation rule, copy normalization, and cleanup of an existing `pending` background message SHALL work regardless of the current value of `features.responsesBackgroundEnabled`. The flag SHALL only affect whether a new generation starts on the background path.

#### Scenario: Flag turned off with jobs in flight

- **WHEN** an operator sets `RESPONSES_BACKGROUND_ENABLED=false` and restarts while background jobs are running
- **THEN** new generations use the existing paths, and the running jobs are still finalized, attachable, and stoppable

### Requirement: Access to a background generation is scoped to the DIAL user

Attach and Stop for a background message SHALL be authorized per DIAL user, not per session or authentication mode: the backend reads the conversation only from the caller's own bucket, and DIAL Core accepts retrieve, replay, cancel, and delete only from the user who created the job. Any authenticated client of the same user — another cookie session, another device, or a bearer-authenticated overlay client — MAY therefore attach to and stop that user's background generation. A caller of a different user SHALL receive the same `404` as for a path with no generation.

#### Scenario: Stop from another device of the same user

- **WHEN** the user started a background generation on one device and presses Stop on another device where they are signed in
- **THEN** the generation is stopped and `204` is returned

#### Scenario: Another user's response id

- **WHEN** a request of a different user presents a conversation or Stop that references a `responseId` it does not own
- **THEN** DIAL Core answers `403`, the backend exposes no content, and it responds `404`

### Requirement: Core credentials stay per-request and internal

Every Core call on the background path (create, retrieve, replay, cancel, delete) SHALL use the bearer token of the request being served. The backend SHALL NOT store access tokens, refresh tokens, or Core per-request API keys for later use, SHALL NOT send `DIAL_API_KEY` on these calls, and SHALL rely on Core's per-user ownership check for authorization. The `response_id` path segment SHALL be URL-encoded.

#### Scenario: No stored credentials

- **WHEN** a background generation is finalized by an attach long after the originating request ended
- **THEN** the Core calls use the attaching request's bearer token and no token or key saved from the originating request

### Requirement: Background lifecycle outcomes are observable without content

The backend SHALL log and count background-generation outcomes by reason without prompt or answer text and without principal identity: `finalized_origin`, `finalized_recovery`, `stopped`, `cancel_unsupported`, `expired`, `interrupted_start`, `save_failed`, `detached_max_duration`, `detached_shutdown`, `delete_failed`, `placeholder_fallback`. Log lines MAY include `responseId` and `generationId`.

#### Scenario: Recovery finalization is counted

- **WHEN** an attach finalizes a job that the originating instance did not finalize
- **THEN** one `finalized_recovery` outcome is recorded and no message text appears in logs
