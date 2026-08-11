## ADDED Requirements

### Requirement: Server-side assembler merges reasoning summaries additively

`applyChunkToMessage` (`apps/chat-api/src/conversations/utils/apply-chunk.server.ts`) SHALL merge `delta.custom_content.reasoning_summaries` entries into the assembled message's `custom_content.reasoning_summaries`, upserting by the composite key `(itemId, outputIndex, summaryIndex)`: a new key is appended; an existing key has its `text` concatenated (mirroring the existing `mergeStages`/`mergeAnnotations` additive-merge pattern). This merge SHALL be independent of, and SHALL NOT be conflated with, the existing `stages` merge.

#### Scenario: New reasoning-summary key is appended

- **WHEN** a chunk carries `custom_content.reasoning_summaries: [{ itemId: "rs_1", outputIndex: 0, summaryIndex: 0, text: "Checking" }]` and the message has no entry for that key
- **THEN** the assembled message's `custom_content.reasoning_summaries` contains the new entry

#### Scenario: Existing reasoning-summary key concatenates text

- **WHEN** two chunks both carry `reasoning_summaries` entries for the same `(itemId, outputIndex, summaryIndex)` key
- **THEN** the assembled entry's `text` equals the concatenation of both fragments in arrival order

#### Scenario: Duplicate/replayed done-derived entries remain idempotent

- **WHEN** the same reasoning-summary chunk entry is applied twice (e.g. a replayed event)
- **THEN** applying it a second time with the same key and text produces the same concatenation behavior as any other repeated fragment — no special-cased deduplication is required at this layer, since the adapter (not the merge layer) is responsible for not emitting the same content twice

#### Scenario: Chunk without reasoning_summaries does not clear existing entries

- **WHEN** a chunk arrives with no `custom_content.reasoning_summaries`
- **THEN** the assembled message's existing `reasoning_summaries` entries are unchanged

### Requirement: Responses-origin stages reuse the existing stage merge unchanged

Stages produced by the Responses tool-stage mapping SHALL be merged through the existing `mergeStages` function with no new merge logic — they are ordinary `Stage` objects distinguished only by an optional `toolKind` field that this merge function passes through untouched (via its existing spread/passthrough behavior for unknown fields).

#### Scenario: Existing Chat Completions stage merge behavior is unchanged

- **WHEN** a Chat Completions response streams `custom_content.stages` exactly as before this change
- **THEN** the merge behavior and resulting persisted stages are identical to before this change

#### Scenario: Responses-origin stage merges through the same function

- **WHEN** a Responses tool-stage chunk carries a `Stage` with an additional `toolKind` field
- **THEN** `mergeStages` merges it the same way it merges any other stage, preserving the `toolKind` field on the assembled stage
