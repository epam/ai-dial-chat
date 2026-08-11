## ADDED Requirements

### Requirement: Adapter recognizes reasoning-summary streaming events

`ResponsesAdapter.relay` (`apps/chat-api/src/conversations/generation/responses.adapter.ts`) SHALL recognize `response.reasoning_summary_part.added`, `response.reasoning_summary_text.delta`, and `response.reasoning_summary_text.done` as known event types. None of these SHALL increment `generationUnknownEventsTotal` (`generation-metrics.ts`) or fall into the existing unknown-event `default` branch.

#### Scenario: Reasoning-summary events do not inflate the unknown-event metric

- **WHEN** a Responses stream includes `response.reasoning_summary_part.added`, `response.reasoning_summary_text.delta`, and `response.reasoning_summary_text.done` events
- **THEN** `generationUnknownEventsTotal` is not incremented for any of them

#### Scenario: Deployments without reasoning summaries are unaffected

- **WHEN** a Responses stream contains only `response.created`, `response.output_text.delta`, and `response.completed` (no reasoning-summary events)
- **THEN** the resulting normalized chunks and persisted message are byte-for-byte equivalent to the adapter's behavior before this change

### Requirement: Reasoning-summary text is accumulated per key without duplication between delta and done

The adapter SHALL track, per in-flight response, which `(item_id, output_index, summary_index)` keys have received at least one `response.reasoning_summary_text.delta`. On `response.reasoning_summary_text.delta`, it SHALL emit a `custom_content.reasoning_summaries` chunk entry with the delta's `delta` text for that key and mark the key as seen. On `response.reasoning_summary_text.done`, it SHALL emit an entry with the done event's full `text` **only if** that key was not already marked as seen (i.e., no prior delta arrived for that exact key); otherwise it SHALL emit nothing for that done event. An entry with empty text SHALL never be emitted.

#### Scenario: Delta then done does not duplicate text

- **WHEN** `response.reasoning_summary_text.delta` events for key `(item_id: "rs_1", output_index: 0, summary_index: 0)` are followed by a `response.reasoning_summary_text.done` event for the same key
- **THEN** the persisted summary text for that key equals the concatenation of the delta fragments, not the delta text plus the done text again

#### Scenario: Done-only fallback preserves text once

- **WHEN** a `response.reasoning_summary_text.done` event arrives for a key that received no prior delta
- **THEN** the persisted summary text for that key equals the done event's `text`, emitted exactly once

#### Scenario: Empty summary text produces no chunk

- **WHEN** a `response.reasoning_summary_text.delta` or `.done` event carries empty text
- **THEN** the adapter emits no `reasoning_summaries` chunk entry for that event

### Requirement: Multiple reasoning items and summary parts preserve stable order

When a response contains more than one reasoning output item, or a reasoning item contains more than one summary part, the adapter and merge layer SHALL key every entry by `(item_id, output_index, summary_index)` and SHALL NOT rely on event-arrival order alone to determine display order — `output_index` and `summary_index` determine ordering.

#### Scenario: Two reasoning items ordered by output_index

- **WHEN** a response emits reasoning-summary events for `output_index: 1` before `output_index: 0` (out-of-order arrival)
- **THEN** the persisted `reasoning_summaries` array reflects both entries keyed by their respective `output_index`/`summary_index`, and rendering order follows those indexes rather than arrival order

#### Scenario: Multiple summary parts within one reasoning item

- **WHEN** a single reasoning item emits `summary_index: 0` and `summary_index: 1` parts
- **THEN** both parts are persisted as distinct entries under the same `item_id`/`output_index`, distinguished by `summary_index`

### Requirement: Normalized chunk and persisted DTO expose `reasoning_summaries`

`NormalizedStreamChunk` (`generation.types.ts`) SHALL support an optional `custom_content.reasoning_summaries: ReasoningSummaryChunk[]` field, where each entry has `itemId: string`, `outputIndex: number`, `summaryIndex: number`, `text: string`. `ConversationMessageCustomContentDto` (`apps/chat-api/src/conversations/dto/message-custom-content.dto.ts`) SHALL declare a corresponding optional, validated, Swagger-documented `reasoning_summaries` array field using the same shape, and `libs/chat-api-client/openapi.json` SHALL be regenerated to include it with strong types (no `any`).

#### Scenario: Generated client exposes the new field with a strong type

- **WHEN** `npm run openapi` is regenerated after the DTO change
- **THEN** the generated `ConversationMessageCustomContentDto` model in `libs/chat-api-client` includes a typed, optional `reasoning_summaries` array field

#### Scenario: Conversations without reasoning summaries remain valid

- **WHEN** a persisted conversation message has no `reasoning_summaries` field
- **THEN** DTO validation succeeds and the message is treated identically to before this change

### Requirement: Reasoning-summary content and terminal states never leak content into logs or metrics

The adapter SHALL never write reasoning-summary text to a log line or to a metric attribute. Reasoning-summary state accumulated before a terminal event (`response.failed`, `response.incomplete`, a top-level `error`, an unterminated stream, or a user abort) SHALL be preserved in `assembledMessage` exactly as accumulated — the adapter SHALL NOT discard previously accumulated `reasoning_summaries` entries on any terminal path.

#### Scenario: Reasoning summary text never appears in logs

- **WHEN** any reasoning-summary event is processed, including a malformed one
- **THEN** no log line emitted by the adapter contains the summary text

#### Scenario: Partial reasoning summary survives a failed response

- **WHEN** a response accumulates reasoning-summary text and then receives `response.failed`
- **THEN** the returned `assembledMessage` still contains the reasoning-summary entries accumulated before the failure

#### Scenario: Partial reasoning summary survives a user abort

- **WHEN** a response accumulates reasoning-summary text and the request is aborted via the existing stop-generation AbortSignal
- **THEN** the returned `assembledMessage` still contains the reasoning-summary entries accumulated before the abort
