# attachment-response-display Specification

## Purpose

How user-sent and assistant-generated attachments are mapped to display models and rendered in message bubbles, without leaking the DIAL API shape into UI components.

## Requirements

---

### Requirement: Attachment types do not leak DIAL API shape into UI components

`libs/chat-shared/src/models/chat.ts` SHALL define:
- `MessageAttachment` interface with `title: string` and optional `index?: number`, `type?: string` (absent in some streamed runtime payloads), `data?: string`, `url?: string`, `reference_type?: string`, `reference_url?: string`
- `DisplayAttachment` interface with `id: string`, `name: string`, `contentType: string`, `type: AttachmentType`, `status: RequestStatus`, and optional `errorReason?: AttachmentErrorReason`, `previewUrl?: string`, `playUrl?: string`, `url?: string`, `referenceUrl?: string`, `data?: string`
- `Attachment` interface extending `DisplayAttachment` with `file: File` for browser-selected files that can be encoded and sent
- `Message` interface with optional `custom_content?: { attachments?: MessageAttachment[] }`

`libs/chat-shared/src/types/attachment.ts` SHALL define `AttachmentType` with at minimum: `File`, `Image`, `Audio`, `Prompt`, `Pasted`.

#### Scenario: MessageAttachment with data field

- **WHEN** a `MessageAttachment` object is constructed with `type`, `title`, and `data`
- **THEN** it satisfies the `MessageAttachment` interface without TypeScript errors

#### Scenario: Message with no attachments

- **WHEN** a `Message` is constructed without `custom_content`
- **THEN** `message.custom_content` is `undefined` and the type is satisfied

---

### Requirement: API attachment DTO maps to display model in the app

`libs/chat-hooks/src/files/attachment-dto-to-display.ts` SHALL export `attachmentDtoToDisplayAttachment(dto: MessageAttachment, resolvers: AttachmentDisplayResolvers): DisplayAttachment`, a thin wrapper over the pure `chat-shared` mapper (see the `attachment-display-mapping` capability), that:
- Sets `id` to the first identifying value the DTO carries: `url ?? data ?? title`
- Sets `name` to `dto.title`
- Sets `contentType` to `dto.type`, except for a reference-only DTO, where it is inferred as described in the `attachment-display-mapping` capability
- Does not create or require a browser `File` object for display-only response attachments
- Sets `type` to `AttachmentType.Image` when `contentType` starts with `image/`, `AttachmentType.Audio` when it starts with `audio/`, otherwise `AttachmentType.File`
- Sets `status` to `RequestStatus.Idle`
- Preserves `dto.url` as `url` when present
- Sets `previewUrl` for image attachments from the injected `resolvers.resolvePreviewUrl` when `dto.url` is present, falling back to `dto.url` itself, or to a `data:${type};base64,${data}` URL when only inline image `data` is present
- Sets `playUrl` for audio attachments from the injected `resolvers.resolvePlayUrl` when `dto.url` is present, falling back to `dto.url` itself, or to a `data:` URL built from inline audio `data`

The URL resolution is injected rather than imported — `apps/chat` supplies `resolveCatalogIconUrl` for image previews and `resolveDialFileDownloadUrl`-backed resolution for audio playback — so the mapper stays host-agnostic.

#### Scenario: Image attachment with data gets previewUrl

- **WHEN** `attachmentDtoToDisplayAttachment` is called with a `MessageAttachment` of type `image/png` and a non-empty `data`
- **THEN** the returned `DisplayAttachment` has `type: AttachmentType.Image` and a `previewUrl` starting with `data:image/png;base64,`

#### Scenario: Image attachment with URL keeps URL and resolves preview

- **WHEN** `attachmentDtoToDisplayAttachment` is called with a `MessageAttachment` of image type and a non-empty `url`
- **THEN** the returned `DisplayAttachment` has `type: AttachmentType.Image`
- **AND** the original `url` is preserved on `DisplayAttachment.url`
- **AND** `previewUrl` contains the resolved display/download URL for the image thumbnail

#### Scenario: Audio attachment gets type Audio and playUrl

- **WHEN** `attachmentDtoToDisplayAttachment` is called with a `MessageAttachment` of type `audio/mpeg` and a non-empty `url`
- **THEN** the returned `DisplayAttachment` has `type: AttachmentType.Audio`
- **AND** the original `url` is preserved on `DisplayAttachment.url`
- **AND** `playUrl` is set to a `/api/v1/files/download?...` URL derived from `url`

#### Scenario: Audio attachment with data field gets playUrl as data-URI

- **WHEN** `attachmentDtoToDisplayAttachment` is called with a `MessageAttachment` of type `audio/mpeg` and a non-empty `data` (no `url`)
- **THEN** the returned `DisplayAttachment` has `type: AttachmentType.Audio`
- **AND** `playUrl` starts with `data:audio/mpeg;base64,`

#### Scenario: Non-image, non-audio file gets no previewUrl or playUrl

- **WHEN** called with a `MessageAttachment` of type `application/pdf`
- **THEN** the returned `DisplayAttachment` has `type: AttachmentType.File`, `previewUrl` is `undefined`, and `playUrl` is `undefined`

#### Scenario: Response attachment has no local file

- **WHEN** `attachmentDtoToDisplayAttachment` is called with any `MessageAttachment`
- **THEN** the returned `DisplayAttachment` does not include a `file` property

---

### Requirement: `UserMessageBubble` renders user-sent attachments above text

`libs/conversation-messages/src/components/MessageBubble/UserMessageBubble.tsx` SHALL accept an optional `attachments?: DisplayAttachment[]` display prop. When non-empty, it SHALL render an `AttachmentGroup` above the message text. The group SHALL be read-only: no remove button, no retry button. API attachment DTOs SHALL be mapped to `DisplayAttachment[]` before reaching this component.

The group SHALL be end-aligned (cards packed to the trailing edge via a logical `ms-auto` / `items-end` column) and capped at `max-w-[640px]`, so it wraps to further rows instead of scrolling horizontally.

#### Scenario: User bubble with attachments shows tray above text

- **WHEN** `UserMessageBubble` is rendered with two attachments and a text body
- **THEN** the `AttachmentGroup` appears before the text content in the DOM

#### Scenario: User bubble without attachments shows no group

- **WHEN** `attachments` is `undefined` or empty
- **THEN** no `AttachmentGroup` is rendered

#### Scenario: User bubble attachments are read-only

- **WHEN** the group is rendered in a user bubble
- **THEN** no remove (×) or retry (↺) buttons are shown

#### Scenario: User bubble attachments are end-aligned

- **WHEN** the text bubble is wider than the attachment cards
- **THEN** the attachment cards are packed against the trailing edge

#### Scenario: User bubble attachments wrap instead of scrolling

- **WHEN** a user message has more attachments than fit the capped width
- **THEN** the group wraps to a further row rather than scrolling horizontally

---

### Requirement: `AssistantMessageBubble` renders assistant-generated attachments below text

`libs/conversation-messages/src/components/MessageBubble/AssistantMessageBubble.tsx` SHALL accept the same optional `attachments?: DisplayAttachment[]` display prop. When non-empty, it SHALL render an `AttachmentGroup` below the message text. The group SHALL be read-only (no `onRemove`, no `onRetry`).

The component SHALL also accept an optional `onAttachmentClick?: (attachment: DisplayAttachment) => void` callback prop. When provided, clicking an `AttachmentCard` in the tray SHALL call this callback. This callback is the shared entry point for both the tray's direct click and the citation popup's "Preview" button — the app passes the same handler to both.

Audio attachments (`type === AttachmentType.Audio`) SHALL be filtered out while the message is streaming (`isStreaming === true`), because a half-written audio attachment is not playable. Once streaming ends they appear as ordinary file tiles — the card renders no inline `<audio>` element (see the `attachment-input-lib` capability); playback is reached through the card's click action.

#### Scenario: Assistant bubble with attachments shows tray below text

- **WHEN** `AssistantMessageBubble` is rendered with two attachments and a text body
- **THEN** the `AttachmentGroup` appears after the text content in the DOM

#### Scenario: Assistant bubble without attachments shows no group

- **WHEN** `attachments` is `undefined` or empty
- **THEN** no `AttachmentGroup` is rendered

#### Scenario: Audio attachment hidden during streaming

- **WHEN** `AssistantMessageBubble` is rendered with an audio attachment and `isStreaming` is `true`
- **THEN** the audio attachment card is not rendered

#### Scenario: Audio attachment shown after streaming ends

- **WHEN** `isStreaming` transitions to `false` for a message that has an audio attachment
- **THEN** the audio attachment renders as a standard file tile, with no `<audio>` element in the DOM

#### Scenario: Citation popup "Preview" triggers the same attachment handler

- **WHEN** the user clicks "Preview" in the citation popup for a cited attachment
- **THEN** `onAttachmentClick` is called with the `DisplayAttachment` derived from the annotation's `body.source.attachment`
- **AND** the same visual preview behavior is produced as when clicking the attachment card directly

---

### Requirement: Reference-only attachments are excluded from the plain attachment tray

`apps/chat/src/components/ConversationView/ConversationMessageItem.tsx` SHALL exclude any `MessageAttachment` for which `isReferenceOnlyAttachment` (see `attachment-reference-links` capability) is `true` — i.e. `url == null && reference_url != null` — from the array passed to `attachmentDtosToDisplayAttachments` before it reaches `AssistantMessageBubble`'s `AttachmentGroup`.

Attachments that carry a `url` (with or without a `reference_url`) SHALL continue to be included in the tray unchanged.

#### Scenario: Reference-only attachment does not render a tray tile

- **WHEN** an assistant message's `custom_content.attachments` contains an entry with `reference_url` set and no `url`
- **THEN** the `DisplayAttachment[]` passed to `AttachmentGroup` does not include an entry for it

#### Scenario: File attachment with a url still renders a tray tile

- **WHEN** an assistant message's `custom_content.attachments` contains an entry with `url` set (with or without `reference_url`)
- **THEN** the `DisplayAttachment[]` passed to `AttachmentGroup` includes an entry for it, unchanged from current behavior

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
