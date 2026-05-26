## 1. Shared types (`libs/chat-shared`)

- [x] 1.1 Add `ApiAttachment` interface (`type`, `title`, `url?`, `data?`, `reference_type?`, `reference_url?`, `index?`) to `libs/chat-shared/src/models/chat.ts` with JSDoc on every property
- [x] 1.2 Rename existing `Attachment` to `UiAttachment` across `libs/chat-shared` and all consumers
- [x] 1.3 Add `apiAttachment?: ApiAttachment` to `UiAttachment` (populated after successful upload)
- [x] 1.4 Add `getFileNameWithoutExtension` and `getFileNameExtension` utilities in `libs/chat-shared/src/utils/file-name.ts`
- [x] 1.5 Export new symbols from `libs/chat-shared/src/index.ts`
- [x] 1.6 Verify: `npm exec nx typecheck chat-shared`

## 2. Backend file-upload endpoint (`apps/chat-api`)

- [x] 2.1 Create `apps/chat-api/src/common/dto/attachment.dto.ts` with `AttachmentDto` (matches DIAL Core `attachment` schema, with class-validator decorators)
- [x] 2.2 Create `apps/chat-api/src/files/utils/file-name.ts` (dedup helper)
- [x] 2.3 Create `FileUploadResponseDto` in `apps/chat-api/src/files/dto/file-upload-response.dto.ts`
- [x] 2.4 Create `FilesService` that uploads to DIAL Core under `uploads/{yyyy-mm-dd}/`, dedups filenames, returns `{ url, name, contentType, contentLength }`
- [x] 2.5 Create `FilesController` with `POST /api/v1/files/upload` using `@UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }))`
- [x] 2.6 Register `FilesModule` in `app.module.ts`
- [x] 2.7 Decorate route for Swagger / OpenAPI exposure
- [x] 2.8 Verify: `npm exec nx test chat-api` (FilesService + controller tests pass)

## 3. Backend send / save with attachments (`apps/chat-api`)

- [x] 3.1 Add `attachments?: AttachmentDto[]` to `SendCompletionDto` (`@IsOptional`, `@ValidateNested({ each: true })`, `@Type(() => AttachmentDto)`)
- [x] 3.2 Drop `@MinLength(1)` from `SendCompletionDto.message` (empty text is valid with attachments)
- [x] 3.3 Add `attachments?: AttachmentDto[]` to `CreateConversationDto`
- [x] 3.4 Add `customContent?: CustomContentDto` to `ConversationMessageDto`
- [x] 3.5 Wire attachments into outgoing chat completion request inside `ChatService.sendCompletion`
- [x] 3.6 Wire attachments into persisted user message inside `ConversationService.createConversation` / `saveConversation`
- [x] 3.7 Verify: `npm exec nx test chat-api`

## 4. OpenAPI client regeneration (`libs/chat-api-client`)

- [x] 4.1 Regenerate `openapi.json` and the client (adds `FilesApi`, `AttachmentDto`, `FileUploadResponseDto`, `customContent` on `ConversationMessageDto`)
- [x] 4.2 Update `tools/openapi/postprocess-client.mjs`:
  - replace `let formParams: { append(param: string, value: any): any };` → `let formParams: FormData | URLSearchParams;`
  - replace `formParams.append('file', requestParameters['file'] as any);` → `(formParams as FormData).append('file', requestParameters['file']);`
- [x] 4.3 Verify the generated `FilesApi.uploadFile` compiles without `any`

## 5. Frontend file-upload client (`apps/chat`)

- [x] 5.1 Register `filesApi` in `apps/chat/src/server-api/api-client.ts` alongside other API singletons
- [x] 5.2 Implement `uploadFile(file: File): Promise<ApiAttachment>` in `apps/chat/src/server-api/files.api.ts` using `filesApi.uploadFile({ file })`
- [x] 5.3 Verify: `npm exec nx typecheck chat`

## 6. Upload-aware `Input` (`libs/conversation-input`)

- [x] 6.1 Add `uploadAttachment?: (file: File) => Promise<ApiAttachment>` to `InputProps`
- [x] 6.2 On file pick, mark each `UiAttachment` as `RequestStatus.Loading` and start upload immediately
- [x] 6.3 On upload success, transition status to `Idle` and fill `apiAttachment`
- [x] 6.4 On upload failure, transition status to `Error` and expose retry through `AttachmentCard`
- [x] 6.5 Compute `canSend = (message.trim().length > 0 || hasUploadedAttachment) && !hasLoadingAttachment`
- [x] 6.6 Change `onSend` signature to `(payload: { message: string; attachments?: ApiAttachment[] }) => void`
- [x] 6.7 Pass `apiAttachment` array (only for uploaded items) to `onSend`
- [x] 6.8 Implement `handleRetry(id)` — restart `uploadAttachment` for an errored card
- [x] 6.9 Forward `uploadAttachment` from `ConversationInput` to `Input`
- [x] 6.10 Drop unused `onAttachmentsChange` from `ConversationInputProps` and `ConversationInput`
- [x] 6.11 Update `Input.spec.tsx` and `ConversationInput.spec.tsx` for the new `onSend` payload, attachment-only send, and error/retry behaviour
- [x] 6.12 Verify: `npm exec nx test conversation-input`

## 7. Attachment rendering in messages (`libs/conversation-messages`)

- [x] 7.1 Create `MessageAttachmentTray` component that renders `ApiAttachment[]`: thumbnail for images (linked, opens original), file-card for everything else
- [x] 7.2 Add `attachments?: ApiAttachment[]` to `UserMessageBubbleProps` and `AssistantMessageBubbleProps`
- [x] 7.3 Render the tray above the text bubble for user, alongside the assistant message for assistant
- [x] 7.4 Hide the empty user text bubble when `text` is falsy (attachments-only message)
- [x] 7.5 Verify: `npm exec nx test conversation-messages`

## 8. App wiring (`apps/chat`)

- [x] 8.1 `ConversationView.onSend`: `(payload: { message: string; attachments?: ApiAttachment[] }) => void`
- [x] 8.2 `Conversation.handleSend` destructures `{ message, attachments }` and forwards into the streaming pipeline
- [x] 8.3 `ConversationRoute.handleSend` same change
- [x] 8.4 `createMessagePair({ content, attachments })` produces both user + assistant message stubs with attachments on the user side
- [x] 8.5 `chat-stream.api.ts.streamCompletion({ ..., attachments })` includes them in the request body
- [x] 8.6 `conversations.api.ts.createConversation` and `sendCompletion` paths include `attachments`
- [x] 8.7 Pass the app's `uploadFile` into `ConversationInput`'s `uploadAttachment` prop
- [x] 8.8 Verify: `npm exec nx typecheck chat` and `npm exec nx build chat`

## 9. Final verification

- [x] 9.1 `npm exec nx test conversation-input conversation-messages chat-api chat-shared`
- [x] 9.2 `npm exec nx lint conversation-input conversation-messages chat-api chat`
- [x] 9.3 `npm exec nx build chat-api chat`
- [x] 9.4 Manual smoke (Chromium): pick a single image → uploads, send → user bubble shows tray + text, assistant streams response.
- [x] 9.5 Manual smoke: pick a PDF → file card renders with filename + extension; send works.
- [x] 9.6 Manual smoke: pick multiple files at once → all upload in parallel, send button disabled until all `Idle`.
- [x] 9.7 Manual smoke: pick a file then click send with empty text → request goes through, no validation error.
- [x] 9.8 Manual smoke: reload the conversation → previously sent attachments restored on the user bubble.
