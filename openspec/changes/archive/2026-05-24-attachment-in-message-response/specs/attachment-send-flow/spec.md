## ADDED Requirements

---

### Requirement: `attachmentToDialAttachment` encodes a file to base64

`apps/chat/src/utils/attachment-to-dial.ts` SHALL export `attachmentToDialAttachment(attachment: Attachment): Promise<DialAttachment>` that reads `attachment.file` via `FileReader.readAsDataURL`, strips the data-URL prefix, and returns a `DialAttachment` with `type` set to `attachment.contentType`, `title` set to `attachment.name`, and `data` set to the plain base64 string.

#### Scenario: Encodes a non-empty file

- **WHEN** `attachmentToDialAttachment` is called with a valid `Attachment` whose `file` has content
- **THEN** it resolves to a `DialAttachment` whose `data` field contains no `data:…;base64,` prefix

#### Scenario: Rejects on `FileReader` error

- **WHEN** the underlying `FileReader` fires an `error` event
- **THEN** the returned promise rejects with the reader error

---

### Requirement: `attachmentsToDialAttachments` maps an array in parallel

`apps/chat/src/utils/attachment-to-dial.ts` SHALL export `attachmentsToDialAttachments(attachments: Attachment[]): Promise<DialAttachment[] | undefined>` that returns `undefined` when the array is empty and `Promise.all(attachments.map(attachmentToDialAttachment))` otherwise.

#### Scenario: Empty array returns undefined

- **WHEN** `attachmentsToDialAttachments` is called with `[]`
- **THEN** it resolves to `undefined`

#### Scenario: Non-empty array resolves to encoded list

- **WHEN** called with two valid attachments
- **THEN** it resolves to an array of two `DialAttachment` objects in the same order

---

### Requirement: `Conversation` page encodes attachments before send

`apps/chat/src/pages/Conversation/Conversation.tsx` SHALL call `attachmentsToDialAttachments` inside `handleSend` before making the API request. If encoding throws, `handleSend` SHALL catch the error and display an error state without making any API call.

#### Scenario: Successful send with attachments

- **WHEN** the user sends a message with one or more attachments
- **THEN** the encoded `DialAttachment[]` is included in the API request body

#### Scenario: File-read error prevents send

- **WHEN** `attachmentsToDialAttachments` rejects for any file
- **THEN** no API request is made and an error message is shown to the user

#### Scenario: Send without attachments

- **WHEN** the user sends a message with no attachments
- **THEN** `attachments` is omitted from the API request body (field absent, not `[]` or `null`)

---

### Requirement: Backend `SendCompletionDto` accepts attachments

`apps/chat-api/src/conversations/dto/send-completion.dto.ts` SHALL define an optional `attachments?: DialAttachmentDto[]` field decorated with `@IsOptional()`, `@IsArray()`, and `@ValidateNested({ each: true })`. `DialAttachmentDto` SHALL validate `type` (non-empty string), `title` (non-empty string), and at most one of `data` or `url` (both optional strings).

#### Scenario: Valid request with attachments passes validation

- **WHEN** the request body contains a valid `attachments` array
- **THEN** the DTO validates without errors and the array is available in the service

#### Scenario: Request without attachments passes validation

- **WHEN** `attachments` is absent from the request body
- **THEN** the DTO validates without errors and `attachments` is `undefined`

#### Scenario: Malformed attachment fails validation

- **WHEN** an attachment item is missing the required `type` field
- **THEN** the request returns HTTP 400 with a validation error

---

### Requirement: Backend `CreateConversationDto` accepts attachments

`apps/chat-api/src/conversations/dto/create-conversation.dto.ts` SHALL include the same optional `attachments?: DialAttachmentDto[]` field with identical validation decorators as `SendCompletionDto`.

#### Scenario: Create conversation with attachments

- **WHEN** the request body includes a valid `attachments` array
- **THEN** the DTO validates and the attachments are available in the service

---

### Requirement: Service embeds attachments in user message `custom_content`

`apps/chat-api/src/conversations/conversation.service.ts` SHALL place the validated `DialAttachmentDto[]` inside `message.custom_content.attachments` when constructing the user `Message` object forwarded to DIAL Core. The service SHALL forward only attachments that have either a non-empty `data` or a non-empty `url` field.

#### Scenario: Attachments forwarded to DIAL Core

- **WHEN** the service processes a send request that includes attachments
- **THEN** the constructed DIAL Core request contains `custom_content.attachments` matching the validated input

#### Scenario: Attachments without data or url are filtered out

- **WHEN** an attachment has neither `data` nor `url`
- **THEN** that attachment is excluded from the DIAL Core request body

---

### Requirement: Streaming error surfaces to the user

`apps/chat/src/server-api/chat-stream.api.ts` SHALL throw an error when the SSE stream closes with a non-OK status or emits an error event. `Conversation.tsx` SHALL catch the thrown error in `handleSend` and set an error state rendered as a visible error banner inside the conversation view.

#### Scenario: SSE error propagates to conversation view

- **WHEN** the streaming request returns a non-2xx response
- **THEN** the conversation view renders an error banner with a human-readable message sourced from i18n key `conversation.streamError`

#### Scenario: SSE error does not crash the page

- **WHEN** a streaming error occurs
- **THEN** the conversation input remains usable and the user can retry
