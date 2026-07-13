## ADDED Requirements

### Requirement: Reference-only attachments are excluded from the plain attachment tray

`apps/chat/src/components/ConversationView/ConversationMessageItem.tsx` SHALL exclude any `MessageAttachment` for which `isReferenceOnlyAttachment` (see `attachment-reference-links` capability) is `true` — i.e. `url == null && reference_url != null` — from the array passed to `attachmentDtosToDisplayAttachments` before it reaches `AssistantMessageBubble`'s `AttachmentTray`.

Attachments that carry a `url` (with or without a `reference_url`) SHALL continue to be included in the tray unchanged.

#### Scenario: Reference-only attachment does not render a tray tile

- **WHEN** an assistant message's `custom_content.attachments` contains an entry with `reference_url` set and no `url`
- **THEN** the `DisplayAttachment[]` passed to `AttachmentTray` does not include an entry for it

#### Scenario: File attachment with a url still renders a tray tile

- **WHEN** an assistant message's `custom_content.attachments` contains an entry with `url` set (with or without `reference_url`)
- **THEN** the `DisplayAttachment[]` passed to `AttachmentTray` includes an entry for it, unchanged from current behavior
