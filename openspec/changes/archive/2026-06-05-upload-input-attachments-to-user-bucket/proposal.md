## Why

Attachments added in the chat input are currently too late in the send lifecycle: the file upload work can happen only when the user submits the message. This makes the send action block on file transfer, makes failure recovery awkward, and risks sending attachments before DIAL Core has a stable URL for them.

Files should be uploaded to the user's DIAL Core bucket as soon as they are added to the input. Sending a message should only transform already-uploaded attachments into URL-based `AttachmentDto` values.

## What Changes

- `libs/conversation-input` gains a host-agnostic `onUploadAttachment` callback. The lib calls it immediately after a file is added, stores the returned URL on the local `Attachment`, and drives `RequestStatus.Loading` / `Error` / `Idle` for the card.
- `apps/chat` owns the callback implementation. It reads the user's bucket at the app edge, builds the upload path with `buildUploadPath`, and calls the existing `uploadFile(bucket, path, file)` wrapper.
- `apps/chat/src/utils/attachment-to-dto.ts` maps only already-uploaded attachments to DTOs. It no longer uploads files during send and no longer base64-encodes files.
- Message send and edit flows use uploaded attachment URLs and do not make a chat request while an attachment is still loading or failed.
- `POST /api/v1/files` is reused as-is. Backend attachment validation accepts returned DIAL file paths in addition to HTTPS URLs. No generated-client contract change is required.

## Capabilities

### New Capabilities

_(none — this change extends existing attachment send and input attachment capabilities)_

### Modified Capabilities

- `attachment-send-flow`: attachments must be uploaded immediately when added; send consumes existing `Attachment.url` values and omits `data`.
- `conversation-input-attachments`: the input tray owns per-attachment upload status and retry through a host-provided callback while keeping all API, bucket, auth, and path knowledge outside the lib.

## Impact

- **Frontend (apps/chat)**: upload callback wiring in `ConversationRoute`, `ConversationPage`, `ConversationView`, and `useConversationHandlers`; DTO mapping in `attachment-to-dto.ts`; path generation via `build-upload-path.ts`; tests near changed files.
- **Library (libs/conversation-input)**: optional `onUploadAttachment` prop, per-attachment immediate upload status, retry wiring, and send blocking while attachments are loading or failed. No REST paths, generated clients, auth/session, bucket, or path logic enters the lib.
- **Shared models (libs/chat-shared)**: `DisplayAttachment` carries optional `url` so uploaded local and display attachments can retain their remote reference.
- **Backend (apps/chat-api)**: file upload handling/logging and attachment URL validation support DIAL file paths returned by the upload endpoint.
- **Generated client (libs/chat-api-client)**: no regeneration required.
