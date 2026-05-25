## Why

Users can select files when composing a message, but the end-to-end contract — from client-side encoding through DIAL Core forwarding to rendering assistant-generated attachments in response bubbles — has no formal specification. Codifying it ensures consistent behaviour across the send path, error states, and response display.

## What Changes

- **Frontend send path**: `Attachment` objects are base64-encoded via `FileReader` and mapped to `DialAttachment` before the API call; the `ConversationInput` hands off the encoded list to `Conversation` page on send
- **Backend forwarding**: `SendCompletionDto` and `CreateConversationDto` now accept `DialAttachmentDto[]`; the service embeds them in the user message `custom_content.attachments` before forwarding to DIAL Core
- **Response rendering**: `UserMessageBubble` and `AssistantMessageBubble` accept `DialAttachment[]` from the persisted message; `AttachmentTray` + `AttachmentCard` display them (user attachments above text, assistant attachments below)
- **Error handling**: frontend shows a streaming error when the SSE response fails; file-read errors are surfaced before the request is made
- **AttachmentCard display**: name shown without file extension; `DialTooltip` wraps the name for multi-line overflow

## Capabilities

### New Capabilities

- `attachment-send-flow`: Full lifecycle of sending attachments — file selection → base64 encoding → DTO construction → DIAL Core forwarding; includes error handling for file-read failures and streaming errors
- `attachment-response-display`: Rendering `DialAttachment[]` from both user messages and assistant responses inside message bubbles using `AttachmentTray` and `AttachmentCard`

### Modified Capabilities

- `conversation-input-attachments`: `Input` now calls `attachmentsToDialAttachments` on send and clears the tray after submission; `AttachmentCard` displays name without extension and wraps it in `DialTooltip`

## Impact

- **`libs/conversation-input`** — `Input.tsx`, `AttachmentCard.tsx`; no breaking prop changes
- **`libs/conversation-messages`** — `UserMessageBubble.tsx`, `AssistantMessageBubble.tsx`; `attachments` prop added (optional, non-breaking)
- **`libs/chat-shared`** — `Attachment`, `DialAttachment`, `Message` models; `attachment-mapper` utility
- **`apps/chat`** — `Conversation.tsx` wires send path; `attachment-to-dial.ts` encoding utility; `chat-stream.api.ts` error handling
- **`apps/chat-api`** — `SendCompletionDto`, `CreateConversationDto`, `DialAttachmentDto`; `conversation.service.ts` message construction
- No new external dependencies; no API version change (additive fields on existing endpoints)
