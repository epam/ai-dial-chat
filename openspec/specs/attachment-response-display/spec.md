## Requirements

---

### Requirement: Attachment types do not leak DIAL API shape into UI components

`libs/chat-shared/src/models/chat.ts` SHALL define:
- `MessageAttachment` interface with `type: string`, `title: string`, and optional `data?: string`, `url?: string`, `reference_type?: string`, `reference_url?: string`
- `DisplayAttachment` interface with `id: string`, `name: string`, `contentType: string`, `type: AttachmentType`, `status: RequestStatus`, and optional `previewUrl?: string`, `url?: string`
- `Attachment` interface extending `DisplayAttachment` with `file: File` for browser-selected files that can be encoded and sent
- `Message` interface with optional `custom_content?: { attachments?: MessageAttachment[] }`

#### Scenario: MessageAttachment with data field

- **WHEN** a `MessageAttachment` object is constructed with `type`, `title`, and `data`
- **THEN** it satisfies the `MessageAttachment` interface without TypeScript errors

#### Scenario: Message with no attachments

- **WHEN** a `Message` is constructed without `custom_content`
- **THEN** `message.custom_content` is `undefined` and the type is satisfied

---

### Requirement: API attachment DTO maps to display model in the app

`apps/chat/src/utils/attachment-dto-to-display.ts` SHALL export `attachmentDtoToDisplayAttachment(attachmentDto: AttachmentDto): DisplayAttachment` that:
- Sets `id` to a deterministic value derived from `title` (e.g. the title itself)
- Sets `name` to `attachmentDto.title`
- Sets `contentType` to `attachmentDto.type`
- Does not create or require a browser `File` object for display-only response attachments
- Sets `type` to `AttachmentType.Image` when `contentType` starts with `image/`, otherwise `AttachmentType.File`
- Sets `status` to `RequestStatus.Idle`
- Preserves `attachmentDto.url` as `url` when present
- Sets `previewUrl` to the resolved display/download URL for `attachmentDto.url` when present for image attachments, otherwise to a data-URL when image `attachmentDto.data` is present (`data:${type};base64,${data}`)

#### Scenario: Image attachment with data gets previewUrl

- **WHEN** `attachmentDtoToDisplayAttachment` is called with an `AttachmentDto` of type `image/png` and a non-empty `data`
- **THEN** the returned `DisplayAttachment` has `type: AttachmentType.Image` and a `previewUrl` starting with `data:image/png;base64,`

#### Scenario: Image attachment with URL keeps URL and resolves preview

- **WHEN** `attachmentDtoToDisplayAttachment` is called with an `AttachmentDto` of image type and a non-empty `url`
- **THEN** the returned `DisplayAttachment` has `type: AttachmentType.Image`
- **AND** the original `url` is preserved on `DisplayAttachment.url`
- **AND** `previewUrl` contains the resolved display/download URL for the image thumbnail

#### Scenario: Non-image file gets no previewUrl

- **WHEN** called with an `AttachmentDto` of type `application/pdf`
- **THEN** the returned `DisplayAttachment` has `type: AttachmentType.File` and `previewUrl` is `undefined`

#### Scenario: Response attachment has no local file

- **WHEN** `attachmentDtoToDisplayAttachment` is called with any `AttachmentDto`
- **THEN** the returned `DisplayAttachment` does not include a `file` property

---

### Requirement: `UserMessageBubble` renders user-sent attachments above text

`libs/conversation-messages/src/components/MessageBubble/UserMessageBubble.tsx` SHALL accept an optional `attachments?: DisplayAttachment[]` display prop. When non-empty, it SHALL render an `AttachmentTray` above the message text. The tray SHALL be read-only: no remove button, no retry button (`alwaysShowActions={false}`, no `onRemove`, no `onRetry`). API attachment DTOs SHALL be mapped to `DisplayAttachment[]` before reaching this component.

The tray SHALL be right-aligned (cards packed to the right edge), wrap to multiple rows when there are more than 6 cards, and show at most 6 cards per row (capped at `640px` = 6 × 100px cards + 5 × 8px gaps).

#### Scenario: User bubble with attachments shows tray above text

- **WHEN** `UserMessageBubble` is rendered with two attachments and a text body
- **THEN** the `AttachmentTray` appears before the text content in the DOM

#### Scenario: User bubble without attachments shows no tray

- **WHEN** `attachments` is `undefined` or empty
- **THEN** no `AttachmentTray` is rendered

#### Scenario: User bubble tray is read-only

- **WHEN** the tray is rendered in a user bubble
- **THEN** no remove (×) or retry (↺) buttons are shown

#### Scenario: User bubble tray is right-aligned

- **WHEN** the text bubble is wider than the attachment cards
- **THEN** the attachment cards are packed against the right edge of the tray

#### Scenario: User bubble tray wraps beyond 6 cards

- **WHEN** a user message has more than 6 attachments
- **THEN** the tray wraps to a second row rather than scrolling horizontally
- **THEN** each row contains at most 6 cards, right-aligned

---

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

---

### Requirement: `Conversation` page passes attachments to message bubbles

`apps/chat/src/components/ConversationView/ConversationView.tsx` SHALL map each message's API attachment DTOs to `DisplayAttachment[]` before passing them as the `attachments` prop to the corresponding `UserMessageBubble` or `AssistantMessageBubble`.

#### Scenario: Persisted user message with attachments renders cards

- **WHEN** the conversation history contains a user `Message` with `custom_content.attachments`
- **THEN** the `UserMessageBubble` for that message renders one `AttachmentCard` per attachment
- **AND** image attachment cards use the lazy image preview behavior defined by `conversation-input-attachments`

#### Scenario: Persisted assistant message with attachments renders cards

- **WHEN** the conversation history contains an assistant `Message` with `custom_content.attachments`
- **THEN** the `AssistantMessageBubble` for that message renders one `AttachmentCard` per attachment
- **AND** image attachment cards use the lazy image preview behavior defined by `conversation-input-attachments`
