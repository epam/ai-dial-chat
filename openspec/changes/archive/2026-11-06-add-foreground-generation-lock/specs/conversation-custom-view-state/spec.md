## MODIFIED Requirements

### Requirement: The terminal save accumulates `html_tag` annotations from the agent message

`ConversationStreamingService` (`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`) SHALL merge the terminal assistant message's `html_tag`-selector annotations into `customViewState.annotations` inside the single terminal write operation that `backend-owned-generation-persistence` permits. That operation is a conditional update, so each of its attempts SHALL apply the merge to the `customViewState` of the stored version it re-read, not to the one loaded when the generation started. A pool entry or another `customViewState` key written by another writer during the generation is therefore kept. The merge MUST NOT issue a second write, and it MUST NOT move, duplicate, or delay the existing terminal write.

The merge SHALL:

- Read the annotations from the terminal message's `custom_content.annotations`, selecting only those whose `target.selector.type` is `'html_tag'` and which carry both a selector `id` and a `body.source.attachment.url`. Annotations with any other selector type SHALL NOT be written, because they are resolved by character offsets inside their own message and have no cross-message identity.
- Deduplicate by the selector `id`. When an id is already present in the pool, the existing entry SHALL be kept and the incoming duplicate discarded, so a pool entry is stable for the life of the conversation.
- Append new entries in arrival order after the existing ones.
- Preserve every other key of the stored `customViewState` verbatim, producing a new object rather than mutating the stored conversation.
- Leave `customViewState` absent when the terminal message contributes no qualifying annotation and the stored conversation had no `customViewState` — an empty pool SHALL NOT be written.

A failure to build the merged state MUST NOT prevent the terminal write. The conversation SHALL still be written with its messages, and the failure logged as a warning, consistent with how `finalize` already treats a save failure.

The merge applies to every terminal status — `Done`, `Stopped`, and `Error` — because a stopped or errored message can still have carried a complete annotation payload before the interruption.

**i18n / RTL / a11y / feature flag / caching / telemetry**: none.

#### Scenario: A finished agent message contributes its citations to the pool

- **WHEN** a generation reaches `[DONE]` and the assembled assistant message
  carries two `html_tag` annotations with ids `e1` and `e2`, on a
  conversation whose `customViewState` is absent
- **THEN** the saved conversation has
  `customViewState.annotations` containing exactly those two annotations, in
  arrival order

#### Scenario: A repeated citation id is not duplicated

- **WHEN** a later agent message carries an `html_tag` annotation with id
  `e1`, already present in `customViewState.annotations`
- **THEN** the saved pool still contains exactly one entry for `e1`, and it is
  the originally stored object

#### Scenario: Other `customViewState` keys are preserved

- **WHEN** the stored conversation has
  `customViewState: { annotations: [<e1>], layout: 'wide' }` and the terminal
  message adds id `e2`
- **THEN** the saved `customViewState` is
  `{ annotations: [<e1>, <e2>], layout: 'wide' }`

#### Scenario: A key written during the generation is preserved

- **WHEN** a client save stores `customViewState.layout: 'wide'` while the
  generation streams, and the terminal message then adds id `e2`
- **THEN** the saved `customViewState` keeps `layout: 'wide'` and contains
  `e2`

#### Scenario: Offset-based annotations are not pooled

- **WHEN** the terminal message's annotations are all
  `text_character_range` or `pdf_bbox` selectors
- **THEN** no `annotations` key is written and an absent `customViewState`
  stays absent

#### Scenario: A stopped generation still contributes

- **WHEN** the user presses Stop and the partial assistant message already
  carries an `html_tag` annotation with id `e9`
- **THEN** the partial save includes `e9` in `customViewState.annotations`
  alongside `wasStoppedByUser: true`

#### Scenario: Exactly one terminal write

- **WHEN** any generation finalizes
- **THEN** exactly one terminal write operation is invoked by `finalize`,
  and every attempt it makes writes the merged `customViewState` of the
  version that attempt re-read
