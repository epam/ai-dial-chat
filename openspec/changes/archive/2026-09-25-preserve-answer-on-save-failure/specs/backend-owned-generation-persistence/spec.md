## MODIFIED Requirements

### Requirement: Exactly one terminal write attempt, and cancellation never adds or replaces one

A generation SHALL attempt at most one terminal write. The worker SHALL record that the terminal write has been dispatched before awaiting it, and from that point:

- A cancellation request of any reason SHALL be recorded for logging and telemetry only. It SHALL NOT change the persisted outcome, SHALL NOT trigger a second write, and SHALL NOT cancel the dispatched write.
- A cancellation that arrives while the generation is still running SHALL set its reason before the worker's single classification read, so the worker's outcome reflects it.
- When a cancellation and a normal completion race, whichever reaches settlement first determines the outcome and the other is a no-op.

The pre-stream failure paths SHALL remain write-free: a failure resolving the deployment's generation capability, fetching the conversation, or building its history SHALL release the registry entry and rethrow **without** performing any conversation write. A preflight failure SHALL NOT invent a terminal save.

A rejected terminal write SHALL be logged and reported as a persistence error on the open completion stream and to generation-attach subscribers, and the entry SHALL settle and release its key. The completion stream SHALL use its existing error envelope with type `conversation_save_failed` and safe fallback text. This applies to successful, stopped, and failed model outcomes; a storage failure SHALL NOT be reported as a successful save. There SHALL be no automatic second write. A delivered terminal event, a released registry entry, and a recorded `dial.chat.completion.response.terminations` point SHALL NOT be treated as evidence that the conversation was durably persisted.

#### Scenario: Cancellation arriving after the terminal write was dispatched does not add a second write

- **GIVEN** a worker has dispatched its terminal write and is awaiting it
- **WHEN** a user Stop, a stale cancellation, or a max-duration timeout occurs
- **THEN** exactly one write was issued for that generation, the persisted outcome is the one the dispatched write carries, and the cancellation is recorded without changing it

#### Scenario: A pre-stream failure releases the entry without writing

- **WHEN** registration succeeds and the subsequent generation-capability resolution or `getConversation` throws
- **THEN** the backend releases the registry entry and rethrows, no `saveConversation` call is made on that path, and a retry is not rejected with 409

#### Scenario: A terminal write that is already dispatched cannot be fenced by an identity check

- **GIVEN** a worker checked its lease identity and then dispatched its terminal write
- **WHEN** that write is in flight
- **THEN** the capability makes no claim that the write can be prevented, cancelled, or proven uncommitted; safety instead rests on no replacement being admitted while the entry is owned
## ADDED Requirements

### Requirement: Terminal reloads cannot erase received assistant payload

A client SHALL retain its accumulated assistant payload on an explicit persistence error or when a terminal reload returns the unresolved empty placeholder at that generation's assistant index. It SHALL show an app-localized warning that server persistence is unconfirmed and a page reload can lose the local answer. It SHALL preserve text and custom content together and SHALL NOT attempt a client-side save. Successful reloads SHALL still replace local state with server-persisted data. A superseded generation or another displayed conversation SHALL NOT receive stale restoration.

#### Scenario: Empty terminal read after visible text and stages

- **WHEN** a client receives text and stages and its completion reload returns the unresolved assistant placeholder
- **THEN** the text and stages remain visible with a persistence warning and streaming controls settle

#### Scenario: Server enrichment survives a successful save

- **WHEN** the terminal reload contains the saved answer with server-enriched attachment data
- **THEN** the client uses the server answer without adding a persistence warning

#### Scenario: A newer generation supersedes a pending reload

- **WHEN** another generation starts before the prior generation's terminal reload returns
- **THEN** the old callback cannot restore its content over the new generation
