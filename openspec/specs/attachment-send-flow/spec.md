# attachment-send-flow Specification

## Purpose

Immediate app-level upload of attachments and their mapping to URL DTOs when a message is sent.

## MODIFIED Requirements

### Requirement: `attachmentsToDtos` maps uploaded attachments to URL DTOs

`apps/chat/src/utils/attachment-to-dto.ts` SHALL export `attachmentToDto(attachment: Attachment): AttachmentDto` and `attachmentsToDtos(attachments: Attachment[]): AttachmentDto[] | undefined`.

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

`apps/chat` SHALL provide `onUploadAttachment(attachment: Attachment): Promise<string>` to `ConversationInput` and `EditMessageInput` through the app component tree.

The callback SHALL:

- read `user?.bucket` from `useUser()` / conversation handler params at the app edge;
- throw when the bucket is absent or empty;
- call `uploadFile(bucket, buildUploadPath(attachment.name), attachment.file)` from `apps/chat/src/server-api/files.api.ts`;
- return `FileUploadResponseDto.url`.

This callback SHALL be invoked by the input library immediately when an attachment is added, not when the user sends the message.

#### Scenario: Attachment added starts upload

- **WHEN** a user selects, drops, or pastes a file into the input
- **THEN** `onUploadAttachment` is called for that attachment immediately
- **THEN** the file is uploaded to `POST /api/v1/files` through the existing app wrapper

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

## ADDED Requirements

### Requirement: App-level upload path generation utility

`apps/chat/src/utils/build-upload-path.ts` SHALL export a pure function `buildUploadPath(fileName: string): string` that constructs the `path` form field for `POST /api/v1/files`.

**Path format**: `uploads/YYYY-MM/<encoded-file-name>` where:

- `YYYY-MM` is the current year and month from `new Date()` at call time.
- `<encoded-file-name>` is the final file name segment encoded with `encodeURIComponent`, after removing path separators and stripping leading dots.

The generated `path` SHALL be relative to the separate `bucket` form field and MUST NOT include `files/<bucket>`, because DIAL Core upload handling combines `bucket` and `path`.

The generated path SHALL satisfy the backend path validator: no leading `/`, no raw `..` sequences, no backslashes, and percent-encoded spaces are allowed. The backend SHALL still reject invalid percent escapes and encoded path traversal characters such as `%2E`, `%2F`, and `%5C`.

#### Scenario: Upload path uses current year-month

- **WHEN** `buildUploadPath("report.pdf")` is called in June 2026
- **THEN** the returned string is `uploads/2026-06/report.pdf`

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
