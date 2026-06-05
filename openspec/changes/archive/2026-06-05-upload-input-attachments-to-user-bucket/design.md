## Context And Constraints

`POST /api/v1/files` already accepts `multipart/form-data` with `file`, `bucket`, and `path`, and `apps/chat/src/server-api/files.api.ts` already exposes `uploadFile(bucket, path, file)`.

The key lifecycle requirement is immediate upload: adding an attachment starts the upload. Sending a message must not start file uploads; it only consumes uploaded URLs.

`libs/conversation-input` remains host-agnostic. It may own UI state and callbacks, but it must not know API paths, bucket rules, generated clients, auth/session state, app contexts, or upload path construction.

## Selected Approach

### 1. Host-Provided Upload Callback

`Input`, `ConversationInput`, and `EditMessageInput` accept:

```ts
onUploadAttachment?: (attachment: Attachment) => Promise<string>
```

When a file is selected, dropped, or pasted, the lib:

1. Adds the local `Attachment`.
2. Calls `onUploadAttachment` immediately when provided.
3. Sets that attachment to `RequestStatus.Loading`.
4. Stores the returned URL on `attachment.url` and returns the card to `RequestStatus.Idle`.
5. Sets `RequestStatus.Error` if the callback rejects.

Retry calls the same callback again for the failed attachment.

### 2. App Edge Upload Implementation

`apps/chat` implements the callback at the app edge:

- `ConversationRoute` uses `useUser().user?.bucket`.
- `ConversationPage` receives `bucket` through `useConversationHandlers`.
- Both paths call `uploadFile(bucket, buildUploadPath(attachment.name), attachment.file)`.
- The callback returns `FileUploadResponseDto.url`.

This keeps all bucket, path, auth/session, and generated-client knowledge in the app.

### 3. Send Uses Uploaded URLs

`apps/chat/src/utils/attachment-to-dto.ts` maps only already-uploaded attachments:

- `attachmentToDto(attachment)` returns `{ type, title, url }`.
- `attachmentsToDtos([])` returns `undefined`.
- Missing `attachment.url` throws so no chat request is made with an unuploaded attachment.

The input disables send/save while any attachment is `Loading` or `Error`, so the normal UI path only sends when all attachments are ready.

### 4. Upload Path

`buildUploadPath(fileName)` returns:

```text
uploads/YYYY-MM/<encoded-file-name>
```

The user-specific storage container is the separate `bucket` form field. The generated `path` is relative to that bucket and must not include `files/<bucket>`; DIAL Core/SKD path handling combines the two. File names are encoded with `encodeURIComponent`, so `IMG_4740 2.jpg` becomes `IMG_4740%202.jpg`.

## Error Handling

- Upload failure is represented on the attachment card as `RequestStatus.Error`.
- The failed card remains visible with retry and remove actions.
- Send/save is unavailable until all attachments are idle or the failed attachment is removed.
- If a send path somehow receives an attachment without `url`, DTO mapping throws and the chat request is not made.

## Accessibility And i18n

- Existing card retry/remove labels remain host-provided labels.
- The tray remains visible for failed uploads so keyboard users can reach retry/remove controls.
- Existing app-level upload error key `conversation.attachmentUploadError` can still be used for defensive send-time failures, but immediate upload failure is primarily represented per attachment.

## Library Isolation

No source file under `libs/conversation-input` imports or constructs:

- `/api` routes or REST paths;
- generated API clients;
- `apps/chat/src/server-api`;
- auth/session/user contexts;
- bucket names or path rules;
- environment variables or deployment details.

The lib receives behavior through `onUploadAttachment` and stores only the resolved URL.

## Verification

- `npm exec nx test chat`
- `npm exec nx test @epam/ai-dial-conversation-input`
- `npm exec nx lint chat`
- `npm exec nx lint @epam/ai-dial-conversation-input`
