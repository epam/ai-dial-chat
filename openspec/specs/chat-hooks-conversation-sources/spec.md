# chat-hooks-conversation-sources Specification

## Purpose

Reusable hook exported by `@epam/ai-dial-chat-hooks` for deriving a conversation's attachments and quotation sources from its message list.

## Requirements

### Requirement: Conversation sources derivation hook

`@epam/ai-dial-chat-hooks` SHALL export `useConversationSources`
(`libs/chat-hooks/src/conversation-sources/useConversationSources/useConversationSources.ts`,
from the package root and from the `@epam/ai-dial-chat-hooks/conversation-sources`
subpath entry point, which `apps/chat`'s `ConversationSourcesPanel` imports)
that derives, via a pure `useMemo` computation with no side effects and no
network calls, deduplicated lists of a conversation's user-uploaded and
assistant-generated attachments and a list of quotation sources from a
conversation's message list. The hook SHALL depend on `Message`,
`DisplayAttachment`, `Annotation`, `AttachmentDisplayResolvers`,
`MessageRole`, and `messageAttachmentToDisplayAttachment` from
`@epam/ai-dial-chat-shared` directly (these describe DIAL Core's
message/attachment/annotation shape identically for any DIAL-Core-backed
consumer) and on the already-published `@epam/ai-dial-quotations` (annotation
resolution, reference-only detection, PDF page helpers) and
`@epam/ai-dial-source-panel` (the `QuotationSource` type) packages.

The hook SHALL accept `messages: Message[]` and an optional
`resolvers: AttachmentDisplayResolvers` (defaulting to a stable empty object,
forwarded to `messageAttachmentToDisplayAttachment` for preview/play URL
resolution) and SHALL return `UseConversationSourcesResult` —
`{ uploaded: DisplayAttachment[], generated: DisplayAttachment[], sources: QuotationSource[] }`
— recomputing only when the `messages` or `resolvers` reference changes.

- `uploaded` holds the attachments of `MessageRole.User` messages,
  deduplicated by display-attachment `id` (the attachment's `url`, else
  `data`, else `title`).
- `generated` holds the non-reference-only attachments of
  `MessageRole.Assistant` messages, deduplicated the same way.
- `sources` is built from assistant messages only: their reference-only
  attachments (keyed by `reference_url`) and the file attachments of their
  resolved annotations, deduplicated by URL. An annotation source whose URL is
  a `.pdf` without a fragment, and whose annotation names a PDF page, is
  qualified with `#page=N`.

#### Scenario: Attachments are deduplicated across messages

- **WHEN** the same uploaded attachment (same `url`) appears in the
  `custom_content` of two different user messages in the input list
- **THEN** the returned `uploaded` list contains that attachment only once

#### Scenario: Reference-only attachments are excluded from the attachment list

- **WHEN** an assistant message's `custom_content.attachments` includes an
  entry that is reference-only (an annotation source, not a user-facing
  attachment)
- **THEN** that entry is excluded from the returned `generated` list but
  contributes to `sources` instead

#### Scenario: No sources for a message list without annotations

- **WHEN** the input message list contains no annotations and no
  reference-only attachments
- **THEN** the returned `sources` list is empty

#### Scenario: Cited PDF page is qualified in the source URL

- **WHEN** an assistant message's annotation has a PDF selector whose page
  (`getAnnotationPdfPage`) is `N` and its source attachment url is
  `files/b/doc.pdf`
- **THEN** `sources` contains an entry with url `files/b/doc.pdf#page=N`

#### Scenario: Recomputation is stable across unrelated re-renders

- **WHEN** a consumer re-renders with the same `messages` array reference
  and the same (or omitted) `resolvers`
- **THEN** the hook does not recompute `uploaded`/`generated`/`sources`
  (referential stability is preserved via `useMemo`)
