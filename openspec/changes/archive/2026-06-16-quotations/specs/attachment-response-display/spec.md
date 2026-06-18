## MODIFIED Requirements

### Requirement: `AssistantMessageBubble` renders assistant-generated attachments below text

`libs/conversation-messages/src/components/MessageBubble/AssistantMessageBubble.tsx` SHALL accept the same optional `attachments?: DisplayAttachment[]` display prop. When non-empty, it SHALL render an `AttachmentTray` below the message text. The tray SHALL be read-only (no `onRemove`, no `onRetry`).

The component SHALL also accept an optional `onAttachmentClick?: (attachment: DisplayAttachment) => void` callback prop. When provided, clicking an `AttachmentCard` in the tray SHALL call this callback. This callback is the shared entry point for both the tray's direct click and the citation popup's "Preview" button — the app passes the same handler to both.

#### Scenario: Assistant bubble with attachments shows tray below text

- **WHEN** `AssistantMessageBubble` is rendered with two attachments and a text body
- **THEN** the `AttachmentTray` appears after the text content in the DOM

#### Scenario: Assistant bubble without attachments shows no tray

- **WHEN** `attachments` is `undefined` or empty
- **THEN** no `AttachmentTray` is rendered

#### Scenario: Citation popup "Preview" triggers the same attachment handler

- **WHEN** the user clicks "Preview" in the citation popup for a cited attachment
- **THEN** `onAttachmentClick` is called with the `DisplayAttachment` derived from the annotation's `body.source.attachment`
- **AND** the same visual preview behavior is produced as when clicking the attachment card directly
