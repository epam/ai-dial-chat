## ADDED Requirements

---

### Requirement: `DialAttachment` and `Attachment` types in `chat-shared`

`libs/chat-shared/src/models/chat.ts` SHALL define:
- `DialAttachment` interface with `type: string`, `title: string`, and optional `data?: string`, `url?: string`, `reference_type?: string`, `reference_url?: string`
- `Attachment` interface with `id: string`, `name: string`, `contentType: string`, `file: File`, `type: AttachmentType`, `status: RequestStatus`, and optional `previewUrl?: string`
- `Message` interface with optional `custom_content?: { attachments?: DialAttachment[] }`

#### Scenario: DialAttachment with data field

- **WHEN** a `DialAttachment` object is constructed with `type`, `title`, and `data`
- **THEN** it satisfies the `DialAttachment` interface without TypeScript errors

#### Scenario: Message with no attachments

- **WHEN** a `Message` is constructed without `custom_content`
- **THEN** `message.custom_content` is `undefined` and the type is satisfied

---

### Requirement: `mapDialAttachmentToAttachment` maps a response attachment to display model

`libs/chat-shared/src/utils/attachment-mapper.ts` SHALL export `mapDialAttachmentToAttachment(dialAttachment: DialAttachment): Attachment` that:
- Sets `id` to a deterministic value derived from `title` (e.g. the title itself)
- Sets `name` to `dialAttachment.title`
- Sets `contentType` to `dialAttachment.type`
- Creates a zero-byte `File` stub (`new File([], title, { type })`) as `file`
- Sets `type` to `AttachmentType.Image` when `contentType` starts with `image/`, otherwise `AttachmentType.File`
- Sets `status` to `RequestStatus.Idle`
- Sets `previewUrl` to a data-URL when `dialAttachment.data` is present (`data:${type};base64,${data}`), otherwise `undefined`

#### Scenario: Image attachment with data gets previewUrl

- **WHEN** `mapDialAttachmentToAttachment` is called with a `DialAttachment` of type `image/png` and a non-empty `data`
- **THEN** the returned `Attachment` has `type: AttachmentType.Image` and a `previewUrl` starting with `data:image/png;base64,`

#### Scenario: Non-image file gets no previewUrl

- **WHEN** called with a `DialAttachment` of type `application/pdf`
- **THEN** the returned `Attachment` has `type: AttachmentType.File` and `previewUrl` is `undefined`

#### Scenario: Stub File has no content

- **WHEN** `mapDialAttachmentToAttachment` is called with any `DialAttachment`
- **THEN** the returned `Attachment.file.size` is `0`

---

### Requirement: `UserMessageBubble` renders user-sent attachments above text

`libs/conversation-messages/src/components/MessageBubble/UserMessageBubble.tsx` SHALL accept an optional `attachments?: DialAttachment[]` prop. When non-empty, it SHALL render an `AttachmentTray` above the message text, populated by mapping each `DialAttachment` through `mapDialAttachmentToAttachment`. The tray SHALL be read-only: no remove button, no retry button (`alwaysShowActions={false}`, no `onRemove`, no `onRetry`).

#### Scenario: User bubble with attachments shows tray above text

- **WHEN** `UserMessageBubble` is rendered with two attachments and a text body
- **THEN** the `AttachmentTray` appears before the text content in the DOM

#### Scenario: User bubble without attachments shows no tray

- **WHEN** `attachments` is `undefined` or empty
- **THEN** no `AttachmentTray` is rendered

#### Scenario: User bubble tray is read-only

- **WHEN** the tray is rendered in a user bubble
- **THEN** no remove (×) or retry (↺) buttons are shown

---

### Requirement: `AssistantMessageBubble` renders assistant-generated attachments below text

`libs/conversation-messages/src/components/MessageBubble/AssistantMessageBubble.tsx` SHALL accept the same optional `attachments?: DialAttachment[]` prop. When non-empty, it SHALL render an `AttachmentTray` below the message text. The tray SHALL be read-only (no `onRemove`, no `onRetry`).

#### Scenario: Assistant bubble with attachments shows tray below text

- **WHEN** `AssistantMessageBubble` is rendered with two attachments and a text body
- **THEN** the `AttachmentTray` appears after the text content in the DOM

#### Scenario: Assistant bubble without attachments shows no tray

- **WHEN** `attachments` is `undefined` or empty
- **THEN** no `AttachmentTray` is rendered

---

### Requirement: `Conversation` page passes attachments to message bubbles

`apps/chat/src/pages/Conversation/Conversation.tsx` SHALL pass `message.custom_content?.attachments` from each `Message` in the conversation history as the `attachments` prop to the corresponding `UserMessageBubble` or `AssistantMessageBubble`.

#### Scenario: Persisted user message with attachments renders cards

- **WHEN** the conversation history contains a user `Message` with `custom_content.attachments`
- **THEN** the `UserMessageBubble` for that message renders one `AttachmentCard` per attachment

#### Scenario: Persisted assistant message with attachments renders cards

- **WHEN** the conversation history contains an assistant `Message` with `custom_content.attachments`
- **THEN** the `AssistantMessageBubble` for that message renders one `AttachmentCard` per attachment
