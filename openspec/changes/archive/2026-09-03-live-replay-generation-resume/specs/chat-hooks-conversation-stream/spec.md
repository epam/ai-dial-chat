## MODIFIED Requirements

### Requirement: Resume detection after a hard refresh mid-generation

The hook SHALL expose `resumeIfAwaitingGeneration(conversationId,
conversation)`, which detects a conversation left in an awaiting-generation
state, marks its path as streaming, and attempts to attach to the backend's
live replay stream via `transport.attachToGeneration` before falling back to
the watch-based resume path. On a successful attach, it SHALL seed the
per-path buffered message from the stream's `snapshot` event, apply every
subsequent `chunk` event through the same merge logic `startStream`'s
`onChunk` uses, and treat a terminal event (`done`/`error`/`stopped`) the same
way the hook already treats a live generation's own completion/error signal —
including performing the existing reload via `transport.getConversation`
rather than trusting the locally-accumulated replayed content. If
`attachToGeneration` fails outright (attach not found, network error, or any
unexpected response), or the attach stream ends without a terminal event
before `GENERATION_RESUME_WATCH_TIMEOUT_MS` elapses, the hook SHALL fall back
to the pre-existing behavior: watch for a resume/finalization signal via
`transport.watchConversation`, and perform a final `transport.getConversation`
check on timeout or stream end regardless of outcome.

#### Scenario: Awaiting-generation conversation is marked streaming

- **WHEN** `resumeIfAwaitingGeneration` is called with a conversation
  whose last message is an empty, non-stopped assistant placeholder
- **THEN** the conversation's path is added to the streaming-paths set

#### Scenario: Attach succeeds and replays progressively

- **WHEN** `transport.attachToGeneration` succeeds and delivers a `snapshot`
  event followed by one or more `chunk` events
- **THEN** the hook seeds the buffered message from the snapshot, applies each
  chunk to it via the existing merge logic, and — for the currently displayed
  conversation — the assistant message content visibly updates as each event
  arrives, before any terminal event or reload occurs

#### Scenario: Attach terminal event triggers the existing reload path

- **WHEN** the attach stream emits a `done`, `error`, or `stopped` terminal
  event
- **THEN** the hook reloads the conversation via `transport.getConversation`
  and applies the result exactly as it does for a live generation's own
  completion/error, discarding the locally-replayed content in favor of the
  fetched result

#### Scenario: Attach failure falls back to the watch-based resume path

- **WHEN** `transport.attachToGeneration` fails or is unavailable (e.g. no
  active generation found, or the backend does not yet expose the attach
  endpoint)
- **THEN** the hook falls back to subscribing via `transport.watchConversation`
  and re-checking `isAwaitingGenerationResume` on each qualifying update,
  exactly as it did before this change

#### Scenario: Resume resolves on a qualifying watch event (fallback path)

- **WHEN** the hook is on the fallback watch path and
  `transport.watchConversation`'s stream emits an update event after which the
  conversation is no longer awaiting generation
- **THEN** the hook reloads the conversation, updates displayed state if
  it is still the displayed conversation, and clears the path from
  streaming-paths

#### Scenario: Resume times out and still resolves

- **WHEN** no qualifying event arrives (via attach or the fallback watch)
  before the resume timeout
- **THEN** the hook performs one final `transport.getConversation` check
  and clears the path from streaming-paths regardless of the result
