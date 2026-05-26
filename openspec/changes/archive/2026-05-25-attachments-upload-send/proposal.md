## Why

Phase 1 (`2026-05-22-conversation-attachments-ui`) shipped the attachment-picking UI but stopped short of actually sending files. Picked attachments lived only in component state — nothing was uploaded, nothing was attached to outgoing messages, and assistants could not see or respond to them.

Phase 2 closes that loop: files picked in `Input` are uploaded to DIAL storage through a new backend endpoint, the resulting URLs ride along with the user message in `custom_content`, and both user and assistant message bubbles render the attached files.

## What Changes

### Backend (`apps/chat-api`)

- New `POST /api/v1/files/upload` endpoint (multipart/form-data) that proxies files to DIAL Core under the user's bucket at `uploads/{yyyy-mm-dd}/`, deduplicates filenames, and returns `{ url, name, contentType, contentLength }`.
- `FilesService` handles the DIAL Core file API call, MIME validation, and filename dedup; `FilesController` enforces the `MAX_FILE_SIZE` limit via `FileInterceptor`.
- `SendCompletionDto` and `CreateConversationDto` gain an optional `attachments: AttachmentDto[]` field.
- `SendCompletionDto.message` drops its `@MinLength(1)` validator — empty text is valid when at least one attachment is present.
- `ConversationMessageDto` gains an optional `customContent` field carrying DIAL Core `custom_content` (attachments + auxiliary data).
- `conversation.service` forwards attachments into the outgoing chat completion request and persists them in saved messages.

### Generated API client (`libs/chat-api-client`)

- OpenAPI spec gains `FilesApi` (`/api/v1/files/upload`) plus `FileUploadResponseDto` and `AttachmentDto` models.
- `ConversationMessageDto` regenerated with the `customContent` field.
- `tools/openapi/postprocess-client.mjs` updated to type `formParams` as `FormData | URLSearchParams` and cast to `FormData` for file appends — replacing the generator's `: any` defaults.

### Frontend (`apps/chat`)

- `files.api.ts` uses the generated `FilesApi.uploadFile` (wired through `api-client.ts` like every other API).
- `handleSend` across `Conversation`, `ConversationRoute`, and `ConversationView` switches from positional `(message, attachments)` to an object payload `{ message, attachments }`.
- `chat-stream.api.ts` and `conversations.api.ts` forward `attachments` to the backend for both new-conversation and existing-conversation streaming.
- `message-factory.createMessagePair` accepts `{ content, attachments }`.

### Shared types (`libs/chat-shared`)

- New `ApiAttachment` interface — the wire-format shape (`type`, `title`, `url?`, `data?`, `reference_type?`, `reference_url?`).
- Phase-1 `Attachment` renamed to `UiAttachment` and gains `apiAttachment?: ApiAttachment` (populated after successful upload).
- New `getFileNameWithoutExtension`/`getFileNameExtension` utilities (shared between input and message bubble rendering).

### Input component (`libs/conversation-input`)

- New `uploadAttachment?: (file: File) => Promise<ApiAttachment>` prop on `InputProps` — the consuming app injects the upload function; the lib stays HTTP-free.
- On file pick, each `UiAttachment` is marked `RequestStatus.Loading`, the upload runs, and the result transitions to `Idle` (with `apiAttachment` filled) or `Error`.
- Send button is enabled when there is **either** non-whitespace text **or** at least one successfully uploaded attachment, and no attachment is still loading.
- `onSend` signature changes to `(payload: { message: string; attachments?: ApiAttachment[] }) => void`.
- Retry handler restarts the upload for an errored card.
- `ConversationInput` drops the unused `onAttachmentsChange` prop.

### Message rendering (`libs/conversation-messages`)

- New `MessageAttachmentTray` — read-only horizontal list of attachment thumbnails/file cards, right-aligned for user messages, left-aligned for assistant messages.
- `UserMessageBubble` and `AssistantMessageBubble` accept `attachments?: ApiAttachment[]` and render the tray above (user) / below (assistant) the text bubble.
- User text bubble is hidden when `text` is empty — only the attachment tray is shown for "attachments-only" messages.

## Capabilities

### Modified Capabilities

- `conversation-input-attachments` — extended with upload lifecycle, retry, `uploadAttachment` injection, and the new object-payload `onSend` signature.

### New Capabilities

- `files-upload-api` — `POST /api/v1/files/upload` endpoint on `apps/chat-api`.
- `conversation-messages-attachments` — rendering of `ApiAttachment[]` inside user and assistant message bubbles.

## Impact

- `apps/chat-api`: new `files/` module, attachment DTO additions across chat / conversation DTOs, custom_content propagation through save/load/send paths.
- `apps/chat`: new `files.api.ts`, signature changes ripple through `Conversation`, `ConversationRoute`, `ConversationView`, `chat-stream.api.ts`, `conversations.api.ts`, `message-factory.ts`.
- `libs/chat-shared`: new `ApiAttachment`, renamed `Attachment` → `UiAttachment`, new filename utilities.
- `libs/conversation-input`: `Input` and `ConversationInput` API changes (breaking — `onSend` payload shape).
- `libs/conversation-messages`: new `MessageAttachmentTray`, bubble components accept `attachments`.
- `libs/chat-api-client`: generated `FilesApi`, regenerated models, post-process script updated for `FormData` typing.
- New dependency: `@nestjs/platform-express` brings `multer` transitively for `FileInterceptor` to parse multipart uploads.
