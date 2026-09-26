## ADDED Requirements

### Requirement: `customViewState` is an open, conversation-scoped view-state container

The conversation contract SHALL carry an optional
`customViewState?: Record<string, unknown>` field, declared on
`Conversation` in `libs/chat-shared/src/models/chat.ts` and on
`ConversationResponseDto` in
`apps/chat-api/src/openapi/openapi-response.dto.ts` (as
`@ApiPropertyOptional({ type: 'object', additionalProperties: true })`,
following the `llmNamingDone` precedent in the same class), and exported
through the regenerated `@epam/ai-dial-chat-api-client`.

The field SHALL be a shared namespace keyed by feature, not a single
feature's payload. This change defines exactly one key, `annotations`; any
other key SHALL be treated as opaque by every writer defined here.

`SaveConversationBodyDto` validates its `conversation` property with a bare
`@IsObject()` and no nested validation, so the global `ValidationPipe`'s
`forbidNonWhitelisted` does not strip the field. The DTO declaration exists
for the OpenAPI contract and the generated TypeScript types, not for runtime
rejection.

No new backend endpoint is introduced: the field travels on the existing
`PUT /api/v1/conversations` save operation (`saveConversation`) and the
existing `GET` read, with `SaveConversationBodyDto` / `ConversationResponseDto`
unchanged apart from the new property. Frontend callers keep using the normal
(non-`Raw`) generated methods via
`apps/chat/src/server-api/conversations.api.ts`.

**State ownership**: no React context owns this field. It is part of the
conversation object already held by the `ConversationRoute` /
`Conversation` page state and passed to `ConversationView` through its
existing `conversation` prop.

**Feature flag**: none — not gated behind `ENABLED_FEATURES` or
`ENABLED_FEATURES_ROLES`.

**i18n**: no new user-visible strings.
**RTL**: none — data contract only.
**a11y**: none — data contract only.
**Caching**: none — the field rides the conversation object and inherits its
existing read path; no new cache key or TTL.
**Telemetry**: none.

#### Scenario: A conversation without the field is valid

- **WHEN** a conversation object with no `customViewState` property is read
  or saved
- **THEN** it satisfies `Conversation` and `ConversationResponseDto` without
  a TypeScript error, and the save succeeds unchanged

#### Scenario: An unknown key survives a round trip

- **WHEN** a conversation is saved with
  `customViewState: { somethingElse: { a: 1 } }` and then read back
- **THEN** `customViewState.somethingElse` is returned unchanged

#### Scenario: The generated client exposes the field

- **WHEN** `npm run openapi` regenerates `@epam/ai-dial-chat-api-client`
- **THEN** `ConversationResponseDto` in the generated models declares
  `customViewState?: { [key: string]: unknown }` and `npm run openapi:check`
  reports no drift

---

### Requirement: The terminal save accumulates `html_tag` annotations from the agent message

`ConversationStreamingService` SHALL, when its `finalize` step builds
`finalConversation`
(`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`),
merge the terminal assistant message's `html_tag`-selector annotations into
`customViewState.annotations` before the single
`persistenceService.saveConversation` call that
`backend-owned-generation-persistence` permits. It MUST NOT issue a second
save, and it MUST NOT move, duplicate, or delay the existing terminal write.

The merge SHALL:

- Read the annotations from the terminal message's
  `custom_content.annotations`, selecting only those whose
  `target.selector.type` is `'html_tag'` and which carry both a selector
  `id` and a `body.source.attachment.url`. Annotations with any other
  selector type SHALL NOT be written, because they are resolved by character
  offsets inside their own message and have no cross-message identity.
- Deduplicate by the selector `id`. When an id is already present in the
  pool, the existing entry SHALL be kept and the incoming duplicate
  discarded, so a pool entry is stable for the life of the conversation.
- Append new entries in arrival order after the existing ones.
- Preserve every other key of the incoming `customViewState` verbatim,
  producing a new object rather than mutating the loaded conversation.
- Leave `customViewState` absent when the terminal message contributes no
  qualifying annotation and the conversation had no `customViewState`
  already — an empty pool SHALL NOT be written.

A failure to build the merged state MUST NOT prevent the terminal save: the
conversation SHALL still be written with its messages, and the failure logged
as a warning, consistent with how `finalize` already treats a save failure.

The merge applies to every terminal status — `Done`, `Stopped`, and `Error` —
because a stopped or errored message can still have carried a complete
annotation payload before the interruption.

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

- **WHEN** the loaded conversation has
  `customViewState: { annotations: [<e1>], layout: 'wide' }` and the terminal
  message adds id `e2`
- **THEN** the saved `customViewState` is
  `{ annotations: [<e1>, <e2>], layout: 'wide' }`

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
- **THEN** `persistenceService.saveConversation` is invoked exactly once by
  `finalize`, with the merged `customViewState` already part of the
  conversation passed to it

---

### Requirement: The host resolves the conversation-level pool and passes it into the lib as data

`apps/chat` SHALL derive the fallback annotation pool from
`conversation.customViewState?.annotations` at the application edge and pass
it into `libs/quotations` as plain `Annotation[]` / `AnnotationGroup[]` data.

`ConversationView` (`apps/chat/src/components/ConversationView/`) already
receives the whole conversation through its `conversation` prop; it SHALL
read the pool from there, validate its shape defensively (a non-array, or an
entry that is not a well-formed annotation, SHALL be ignored rather than
thrown on, since the value is untrusted persisted JSON), group it with
`groupAnnotationsByCitId`, and pass the resulting groups to
`ConversationMessageItem` as a prop.

No library SHALL read `customViewState`, know the field's name, or know that
the pool is persisted at all. The lib boundary carries annotation groups
only. This keeps the persistence contract — a host-owned storage schema —
outside `libs/quotations` and `libs/chat-shared`'s hook surface, per the
library-isolation rule.

**Memoisation**: the derived pool and its grouping SHALL be wrapped in
`useMemo` keyed on `conversation.customViewState` in `ConversationView`, so
the array identity is stable across renders and does not invalidate
`ConversationMessageItem`'s memoisation or force `MarkdownRenderer` to
re-parse every assistant message. The prop SHALL default to a module-level
shared empty array when no pool exists, for the same reason
`NO_CITATION_COMPONENTS` is a module-level constant in
`useCitationMarkdownComponents`.

**i18n / RTL / feature flag / caching / telemetry**: none.
**a11y**: a pooled citation renders through the existing `CitationDropdown`
and inherits its keyboard and ARIA behaviour unchanged.

#### Scenario: The pool reaches the message item

- **WHEN** a conversation is loaded whose `customViewState.annotations` has
  one `html_tag` annotation
- **THEN** `ConversationView` passes a one-group pool to every
  `ConversationMessageItem`

#### Scenario: A malformed persisted pool is ignored

- **WHEN** `customViewState.annotations` is a string, or an array containing
  `null` and an object with no selector
- **THEN** the derived pool is empty (or contains only the well-formed
  entries) and no error is thrown

#### Scenario: The pool identity is stable across renders

- **WHEN** `ConversationView` re-renders with an unchanged
  `conversation.customViewState`
- **THEN** the pool prop passed to `ConversationMessageItem` is
  reference-identical to the previous render's

#### Scenario: No lib reads the persistence field

- **WHEN** the implementation is searched for `customViewState` under `libs/`
- **THEN** there are no matches

---

### Requirement: Preview and download for a pooled citation target the pooled annotation

A pool-resolved citation marker SHALL resolve its Preview and
Open-in-browser actions against the pooled annotation's attachment — that is,
a marker matched through the fallback pool rather than through the message's
own annotations MUST NOT fail and MUST NOT fall back to an unrelated
attachment.

`ConversationMessageItem`'s `handleCitationPreview` and
`handleCitationOpenInBrowser` currently resolve canvas content against the
message-scoped `citationGroups`. They SHALL resolve against the union of the
message's groups and the pooled groups, so that
`annotationToPdfCanvasContent` / `annotationToOoxmlCanvasContent` can find the
sibling annotations of a pooled group.

The union SHALL be used **only** for these lookups and for the `data-id`
resolution described in the `quotations-citation-markdown` delta. It SHALL
NOT be passed as the hook's primary `groups` argument (see that delta for
why).

**i18n / RTL / feature flag / caching / telemetry**: none.

#### Scenario: Preview opens the pooled source

- **WHEN** a message renders a citation resolved from the pool and the user
  activates Preview
- **THEN** the attachment canvas opens the pooled annotation's attachment,
  highlighted at that annotation's location

#### Scenario: Open-in-browser uses the pooled attachment URL

- **WHEN** the user activates Open-in-browser on a pool-resolved citation
- **THEN** the pooled annotation's `body.source.attachment.url` is resolved
  and opened
