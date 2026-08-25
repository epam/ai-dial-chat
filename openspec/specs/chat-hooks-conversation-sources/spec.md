# chat-hooks-conversation-sources Specification

## Purpose

Reusable hook exported by `@epam/ai-dial-chat-hooks` for deriving a conversation's attachments and quotation sources from its message list.

## Requirements

### Requirement: Conversation sources derivation hook

`@epam/ai-dial-chat-hooks` SHALL export a hook (moved as-is from `apps/chat`'s
`useConversationSources`) that derives, via a pure `useMemo` computation with
no side effects and no network calls, a deduplicated list of a conversation's
uploaded/generated attachments and a list of quotation sources from a
conversation's message list. The hook SHALL depend on `Message`,
`DisplayAttachment`, and `MessageRole` from `@epam/ai-dial-chat-shared`
directly (these types describe DIAL Core's message/attachment/annotation
shape identically for any DIAL-Core-backed consumer) and on the
already-published `@epam/ai-dial-quotations` and `@epam/ai-dial-source-panel`
packages for annotation resolution and the `QuotationSource` type.

The hook SHALL accept `messages: Message[]` and SHALL return `{ attachments:
DisplayAttachment[], sources: QuotationSource[] }`, recomputing only when the
input message list reference changes.

#### Scenario: Attachments are deduplicated across messages

- **WHEN** the same uploaded attachment reference appears in the
  `custom_content` of two different messages in the input list
- **THEN** the returned `attachments` list contains that attachment only once

#### Scenario: Reference-only attachments are excluded from the attachment list

- **WHEN** a message's `custom_content.attachments` includes an entry that is
  reference-only (an annotation source, not a user-facing attachment)
- **THEN** that entry is excluded from the returned `attachments` list but
  contributes to `sources` instead

#### Scenario: No sources for a message list without annotations

- **WHEN** the input message list contains no annotations
- **THEN** the returned `sources` list is empty

#### Scenario: Recomputation is stable across unrelated re-renders

- **WHEN** a consumer re-renders with the same `messages` array reference
  unchanged
- **THEN** the hook does not recompute `attachments`/`sources` (referential
  stability is preserved via `useMemo`)
