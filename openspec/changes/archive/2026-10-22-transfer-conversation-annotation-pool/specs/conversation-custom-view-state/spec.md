## MODIFIED Requirements

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

No rendering library — `libs/quotations`, and the component and hook surface
of `libs/chat-shared` — SHALL read `customViewState`, know the field's name,
or know that the pool is persisted at all. That boundary carries annotation
groups only. This keeps the persistence contract — a host-owned storage
schema — out of the code that renders citations, per the library-isolation
rule.

Two places outside the rendering boundary know the field, and no other lib
code SHALL:

- `libs/chat-shared/src/models/chat.ts` declares `customViewState` on the
  domain `Conversation` type, as the data contract every consumer of the
  conversation object types against.
- The conversation transfer helpers in
  `libs/chat-hooks/src/conversation/conversation-transfer/` (export and
  import, see the `conversation-export` and `conversation-import`
  capabilities) visit `customViewState.annotations[].body.source.attachment`
  as one of the conversation's file-reference sites, so that the citations a
  conversation carries are bundled, stripped, re-pointed and dropped together
  with the message-level ones (issue #9003). They already own the persisted
  conversation format end to end — they serialize and re-save the whole
  object — and leaving the pool out lets an imported conversation keep
  references into another user's bucket. They SHALL touch only the
  `annotations` key, SHALL treat every other key as opaque and carry it
  verbatim, and SHALL leave a non-array pool or a `null` / non-object entry
  unchanged. This exception does not extend to reading the pool for display,
  and does not license any other lib code to read `customViewState`.

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

#### Scenario: Only the domain model and conversation transfer name the field under libs

- **WHEN** the implementation is searched for `customViewState` under `libs/`,
  excluding build output, tests, and the generated `libs/chat-api-client`
- **THEN** the only matches are the domain `Conversation` declaration in
  `libs/chat-shared/src/models/chat.ts` and files under
  `libs/chat-hooks/src/conversation/conversation-transfer/`, and
  `libs/quotations` has none
