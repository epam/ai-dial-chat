## MODIFIED Requirements

### Requirement: One pending background generation per conversation

While a conversation has an active generation — a message with `backgroundGeneration.status: "pending"`, or a live `foregroundGeneration` marker (`foreground-generation-lock` `findActiveGeneration`) — the backend SHALL reject every new completion request for it with the existing generation-conflict error (`409`, `ConflictException(GENERATION_ACTIVE_MESSAGE)`). This covers send, regenerate and edit modes alike, regardless of the current flag values. `streamCompletion` (`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`) first resolves the deployment's generation API (DIAL Core deployment reads), then reads the conversation and throws the `409`. No Core generation or job call is made before it.

The placeholder save that starts a background generation SHALL be a conditional write against the conversation version the backend read, and SHALL complete before any Core job is created:

- **saved** → the backend creates the background job;
- **rejected because the conversation changed** → the backend SHALL re-read.
  - If the conversation now has an active generation of either kind, it SHALL respond `409`.
  - Otherwise it SHALL rebuild the placeholder on the new version and retry, up to 3 attempts, then respond `409`.
  - An expired foreground marker in that version is neutralized by the placeholder write as `foreground-generation-lock` defines for a start-state write.
- **failed for any other reason** (storage error, timeout) → the backend SHALL NOT create a background job. It SHALL continue the same request on the stateless Responses path exactly as it runs when the background flag is off, including that path's conditional start-state write. This is not a resubmission: no generation has started yet.

#### Scenario: Two tabs send at the same time

- **WHEN** two completion requests for the same conversation race on different BFF instances
- **THEN** exactly one placeholder save succeeds and creates a Core job; the other request receives `409` and no Core job is created for it

#### Scenario: Send from another instance while a job is pending

- **WHEN** a send, regenerate, or edit request arrives while the conversation contains a `pending` background message
- **THEN** the request receives `409` and no Core job is created

#### Scenario: A background start while a foreground generation holds the conversation

- **WHEN** a background-eligible request reads a conversation whose last assistant message carries a live `foregroundGeneration` marker
- **THEN** the request receives `409` and no placeholder and no Core job is created

#### Scenario: A naming write between read and placeholder save is not a conflict

- **WHEN** the placeholder save is rejected because the display-name writer updated the conversation, and the re-read shows no active generation
- **THEN** the backend retries the placeholder save on the new version and the generation starts, with no `409`

#### Scenario: Placeholder save hits a storage error

- **WHEN** the placeholder save fails with a storage error that is not a version conflict
- **THEN** no request with `background: true` is sent, and the completion continues on the stateless Responses path (`store: false`), whose conditional start-state write then decides whether it streams

### Requirement: Client conversation saves cannot change a pending background message

`PUT /api/v1/conversations?path=<path>` (operationId `saveConversation`, body `SaveConversationBodyDto`, response `200` with `ConversationResponseDto`) SHALL keep its contract. A *marked message* below is a stored message with `backgroundGeneration.status: "pending"`, or a stored message with a live `foregroundGeneration` marker (`foreground-generation-lock`). A conversation holds at most one marked message, because a new generation is refused while one exists.

**When the stored conversation holds a marked message,** the backend SHALL save the client's body as follows:

- that message's server-owned fields and its marker are replaced by the stored values;
- the message is re-inserted at its stored position if the body omitted it;
- the client's values for that message's client-owned fields are kept;
- the write is conditional, with bounded re-read on a version conflict.

The body's copy of the marked message is the message carrying the same `generationId` in the same marker. Because a client never receives the marker during a live stream, it may instead be the assistant message at the marked message's stored position. When the body has no copy of the marked message (a stale tab or device), the backend SHALL put back the stored messages from the body's end (or the marked position, whichever comes first) through the marked message, so a stale body can drop neither the question nor the answer. The response SHALL be the conversation as actually saved.

**Every client save of an existing conversation SHALL be conditional** on the version it read, with bounded re-read on a version conflict, whether or not a marked message exists. An unconditional save could overwrite a placeholder or a final answer written between the read and the write.

- **Body markers.** Pending background markers in the body are neutralized as before. A `foregroundGeneration` in the body that storage does not hold as live is removed, with `streamErrorMessage: ''` set on a message that has no terminal markers. A title LLM naming already stored is kept.
- **New conversation.** A conversation that does not exist yet keeps the unconditional save.
- **Read failure.** A read that fails SHALL make the save respond `503` instead of saving unconditionally, because the backend cannot tell whether a marked message would be overwritten.
- **No `ETag`.** Storage that returns no `ETag` keeps the unconditional save, except that a stored marked message without an `ETag` makes the save respond `503`, because it cannot be protected.

**Finished and stale background copies.**

- A body message whose `generationId` storage already holds as `completed`, `stopped`, or `failed` SHALL take the stored server-owned fields, so a stale tab still showing it as `pending` never turns the finished answer into `failed`.
- When no body message carries that `generationId`, an unmarked assistant message at the stored message's position is its copy and SHALL take the stored server-owned fields too. An example is a tab that streamed the answer and has not reloaded, saving after Stop on another device. This holds only while the body still lines up with storage (the same number of messages and the same preceding message): after earlier messages are deleted, positions shift, and a different answer at that position SHALL be saved as sent.
- When the body holds a different generation's assistant message at the marked message's position (a tab that has not seen a regenerate), the stored marked message SHALL replace it.

**Persistent conflicts.** After 3 conflicts in a row, the backend SHALL read the conversation once more:

- when that read holds no marked message, the body merged against it SHALL be saved unconditionally (the behavior before fencing);
- when it holds one, the save SHALL respond `503`, as other conversation endpoints do when storage is unavailable, because the conflict may come from that message's own write.

Rename SHALL handle persistent conflicts the same way.

Example: stored `[user, assistant{content:"", responseId:"dial_x", backgroundGeneration:{status:"pending",...}}]`; client body `[user, assistant{content:"Hel", rating:true}]` with a new `prompt` → saved and returned `[user, assistant{content:"", responseId:"dial_x", backgroundGeneration:{status:"pending",...}, rating:true}]` with the new `prompt`.

No new error code is introduced; the generated `chat-api-client` method and every frontend caller stay unchanged.

#### Scenario: Rating an older message during a background generation

- **WHEN** the client saves the conversation to store a rating on an earlier message while the last answer is `pending`
- **THEN** the rating is saved, the pending message keeps its stored `backgroundGeneration` and `responseId`, and the later final write succeeds

#### Scenario: Overlay sets the system prompt during a background generation

- **WHEN** an overlay host sets the system prompt while a background generation is `pending`
- **THEN** the new prompt is saved and the pending message is unchanged

#### Scenario: Save without a marked message

- **WHEN** the stored conversation has no marked message
- **THEN** the client body is saved with its markers neutralized, as a conditional write on the version read

#### Scenario: A placeholder is saved between the read and the write

- **WHEN** a client save reads a conversation without a marked message and a new generation stores its placeholder before the client's write
- **THEN** the client's write gets a version conflict, re-reads, and saves with the placeholder protected

#### Scenario: Conflicts persist on a conversation without a marked message

- **WHEN** a client save meets a version conflict on every attempt and the read after them has no marked message
- **THEN** the body is saved unconditionally, as before fencing, and the endpoint returns `200`

#### Scenario: The last conflict comes from a new placeholder

- **WHEN** a client save meets a version conflict on every attempt, the last one caused by a new generation's placeholder
- **THEN** the read after the conflicts sees the placeholder, the save responds `503`, and the placeholder is kept

#### Scenario: A stale tab saves during a background generation

- **GIVEN** storage holds `[q1, a1, q2, a2(pending)]` and another tab still holds `[q1, a1]`
- **WHEN** that tab saves a rating on `a1`
- **THEN** storage holds `[q1, a1(rated), q2, a2(pending)]`

#### Scenario: A stale tab saves during another participant's foreground generation

- **GIVEN** storage holds `[q1, a1, q2, a2(foregroundGeneration live)]` and another participant's tab still holds `[q1, a1]`
- **WHEN** that tab renames the conversation
- **THEN** storage holds the new name and `[q1, a1, q2, a2(foregroundGeneration live)]`

#### Scenario: A failed read refuses the save

- **WHEN** the client saves an existing conversation and the stored version cannot be read
- **THEN** the response is `503` and no write is made
