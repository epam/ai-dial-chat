# attachment-send-flow Specification

## Purpose

Immediate app-level upload of attachments and their mapping to URL DTOs when a message is sent.

## Requirements

### Requirement: `attachmentsToDtos` maps uploaded attachments to URL DTOs

`libs/chat-hooks/src/conversation/useConversationHandlers/attachment-to-dto.ts` SHALL export `attachmentToDto(attachment: Attachment): AttachmentDto` and `attachmentsToDtos(attachments: Attachment[]): AttachmentDto[] | undefined`, beside the send handler that uses them.

`attachmentsToDtos` SHALL return `undefined` for an empty array. For non-empty input, it SHALL synchronously map each attachment to an `AttachmentDto` with:

- `type`: `attachment.contentType`
- `title`: `attachment.name`
- `url`: `attachment.url`

The functions SHALL NOT use `FileReader`, base64 encoding, or `uploadFile`. Uploading is completed before send by the app-level `onUploadAttachment` callback. If any attachment is missing `url`, `attachmentToDto` SHALL throw and the caller SHALL NOT make a chat request.

#### Scenario: Empty attachments returns undefined

- **WHEN** `attachmentsToDtos([])` is called
- **THEN** it returns `undefined`

#### Scenario: Uploaded attachment maps to URL DTO

- **WHEN** `attachmentToDto` receives an `Attachment` with `url`
- **THEN** it returns an `AttachmentDto` with `type`, `title`, and `url`
- **THEN** `AttachmentDto.data` is absent

#### Scenario: Missing URL prevents send

- **WHEN** `attachmentToDto` receives an `Attachment` without `url`
- **THEN** it throws an error
- **THEN** the caller does not proceed to make the chat request

---

### Requirement: App-level immediate attachment upload

The host SHALL provide `onUploadAttachment(attachment: Attachment): Promise<UploadedAttachmentResult>` to `ConversationInput` and `EditMessageInput` through the component tree. `useAttachmentUpload` (`libs/chat-hooks`) builds that callback from an injected bucket and files API, so each surface wires it rather than re-implementing the upload. `UploadedAttachmentResult` is `{ url, name }` from `@epam/ai-dial-chat-shared`; the input SHALL store both the returned URL and stored filename on the attachment so the displayed name and outgoing DTO title reflect any conflict suffix.

The callback SHALL:

- receive the resolved user bucket from the host;
- throw when the bucket is absent or empty;
- allocate a sanitized filename within `uploads/<YYYY-MM>/` and call the files API's `uploadFile` with that bucket, the allocated path, the attachment's file under its allocated name when renamed, and `uploadMode: 'create-only'`;
- resolve filename conflicts according to the `chat-hooks-attachments` capability, using the injected client's `listFiles` to skip stored names after a 409;
- return the uploaded file's `url` and actual stored `name`;
- when the upload rejects while `navigator.onLine` is `false`, tag the error with `AttachmentErrorReason.Network` and report the batch of offline filenames to the host (see the `attachment-network-error-notification` capability).

This callback SHALL be invoked by the input library immediately when an attachment is added, not when the user sends the message.

Both the new-conversation composer and existing-conversation input SHALL
receive the configured files client with `uploadFile` and `listFiles`.
Removing an attachment from the composer SHALL only remove the local input
entry; it SHALL NOT delete the uploaded file from DIAL Core. A new uploader
instance SHALL NOT assume that its month folder is empty merely because its
local name reservations are empty.

#### Scenario: Attachment added starts upload

- **WHEN** a user selects, drops, or pastes a file into the input
- **THEN** `onUploadAttachment` is called for that attachment immediately
- **THEN** the file is uploaded to `POST /api/v1/files` through the injected generated client

#### Scenario: The same file is attached in a new chat after earlier uploads

- **WHEN** a user starts a new chat and attaches a file whose original and suffixed names already exist in the month's upload folder
- **AND** the initial upload returns 409 and listing the folder succeeds
- **THEN** the uploader skips the listed occupied names and retries with a free suffixed name
- **AND** a successful retry leaves the attachment ready to send with its new URL and stored name
- **AND** files referenced by earlier chats remain unchanged

#### Scenario: Removing and reattaching a file preserves the stored upload

- **WHEN** a user successfully uploads a file, removes its attachment from the composer, and attaches the same local file again
- **THEN** removal does not issue a file-delete request
- **AND** the new upload uses a distinct name based on local reservations or conflict recovery
- **AND** after that upload succeeds, the new attachment is ready to send and references the new stored file

#### Scenario: Send uses already uploaded URLs

- **WHEN** the user sends a message after all attachments uploaded successfully
- **THEN** the chat request body contains URL-based attachment DTOs
- **THEN** no upload request is made during the send handler

#### Scenario: Loading attachment blocks send

- **WHEN** any attachment is still uploading
- **THEN** the send action is unavailable
- **THEN** no chat request is made

#### Scenario: Failed attachment blocks send

- **WHEN** any attachment upload failed
- **THEN** the send action is unavailable until the user retries successfully or removes the failed attachment
- **THEN** no chat request is made

#### Scenario: Send without attachments

- **WHEN** the user sends a message with no attachments
- **THEN** `attachments` is omitted from the chat request body

---

### Requirement: App-level upload path generation utility

`libs/chat-hooks/src/conversation/conversation-transfer/build-upload-path.ts` SHALL export a pure function `buildUploadPath(fileName: string, date?: Date): string` that constructs the `path` form field for the file-upload endpoint.

**Path format**: `uploads/YYYY-MM/<encoded-file-name>` where:

- `YYYY-MM` comes from `date`, defaulting to now. Conversation import passes a date fixed for the whole job so every attachment in it lands in the same month folder.
- `<encoded-file-name>` is the final file name segment encoded with `encodeURIComponent`, after dropping path separators, collapsing repeated dots, and stripping leading dots. A name that sanitizes to nothing falls back to `file`.

`buildUploadPath` does **not** de-duplicate: a name collision is left for the upload call to reject in create-only mode. The same module SHALL export `createUploadPathAllocator`, a stateful allocator that hands out collision-free ` (n)`-suffixed names inside one month folder, for callers (attachment upload and conversation import) that must resolve collisions themselves rather than fail.

The generated `path` SHALL be relative to the separate `bucket` form field and MUST NOT include `files/<bucket>`, because DIAL Core upload handling combines `bucket` and `path`.

The generated path SHALL satisfy the backend path validator: no leading `/`, no raw `..` sequences, no backslashes, and percent-encoded spaces are allowed. The backend SHALL still reject invalid percent escapes and encoded path traversal characters such as `%2E`, `%2F`, and `%5C`.

#### Scenario: Upload path uses the year-month of the supplied date

- **WHEN** `buildUploadPath("report.pdf")` is called in June 2026 with no explicit date
- **THEN** the returned string is `uploads/2026-06/report.pdf`
- **AND** passing an explicit `date` uses that month instead

#### Scenario: The allocator suffixes a taken name

- **WHEN** an allocator created with `existingNames: ["report.pdf"]` allocates `report.pdf`
- **THEN** it returns the path for `report (1).pdf`, with `isRenamed` true

#### Scenario: User bucket is not duplicated in path

- **WHEN** `buildUploadPath("IMG_4740 2.jpg")` is called in June 2026
- **THEN** the returned string is `uploads/2026-06/IMG_4740%202.jpg`
- **THEN** the returned string does not contain `files/`

#### Scenario: Spaces are percent-encoded

- **WHEN** `buildUploadPath("my report.pdf")` is called
- **THEN** the file name segment ends with `my%20report.pdf`

#### Scenario: Path traversal characters are sanitized

- **WHEN** `buildUploadPath("../../etc/passwd")` is called
- **THEN** the generated path does not contain `..`
