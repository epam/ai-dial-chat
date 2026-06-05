## 1. Upload Path Utility

- [x] 1.1 Create `apps/chat/src/utils/build-upload-path.ts` exporting `buildUploadPath(fileName: string): string` that generates `uploads/YYYY-MM/<encoded-file-name>` using `new Date()` for the month prefix and `encodeURIComponent` for the final file name segment
- [x] 1.2 Cover year-month prefix, absence of bucket duplication, `%20` space encoding, path traversal sanitization, leading-dot stripping, and names without extensions in `apps/chat/src/utils/tests/build-upload-path.spec.ts`

## 2. Uploaded Attachment DTO Mapping

- [x] 2.1 Update `apps/chat/src/utils/attachment-to-dto.ts` so `attachmentToDto` / `attachmentsToDtos` map already-uploaded attachments to URL-based `AttachmentDto` values and throw when an attachment is missing `url`
- [x] 2.2 Update `apps/chat/src/utils/tests/attachment-to-dto.spec.ts` to cover empty array, uploaded URL mapping, ordered mapping, and missing URL rejection

## 3. Library Immediate Upload Contract

- [x] 3.1 Add optional `onUploadAttachment?: (attachment: Attachment) => Promise<string>` to `Input`, `ConversationInput`, and `EditMessageInput` props
- [x] 3.2 In `libs/conversation-input/src/components/Input/Input.tsx`, call `onUploadAttachment` immediately after attachments are added; set per-attachment `RequestStatus.Loading`, store returned `url`, set `RequestStatus.Error` on rejection, and wire retry to call the callback again
- [x] 3.3 Block send/save while any attachment is loading or failed; keep successful-send tray clearing unchanged
- [x] 3.4 Verify library isolation: no REST paths, generated clients, app contexts, auth/session, bucket, env, or upload path logic enters `libs/conversation-input`
- [x] 3.5 Update `libs/conversation-input/src/components/Input/tests/Input.spec.tsx` for immediate upload, loading send block, failed upload retry, tray retention, and successful-send clearing

## 4. App Edge Upload Wiring

- [x] 4.1 In `apps/chat/src/hooks/conversation/useConversationHandlers.ts`, add `handleUploadAttachment` that uses `bucket`, `buildUploadPath(attachment.name)`, and `uploadFile`; change `handleSend` and `handleEditMessage` to use `attachmentsToDtos` without uploading
- [x] 4.2 In `apps/chat/src/pages/Conversation/Conversation.tsx`, pass `handleUploadAttachment` to `ConversationView`
- [x] 4.3 In `apps/chat/src/components/ConversationView/ConversationView.tsx` and `ConversationMessageItem.tsx`, pass `onUploadAttachment` to `ConversationInput` and `EditMessageInput`
- [x] 4.4 In `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`, add an app-level `handleUploadAttachment` using `useUser().user?.bucket`, `buildUploadPath(attachment.name)`, and `uploadFile`; pass it to `ConversationInput`
- [x] 4.7 Add backend upload diagnostics logging in `apps/chat-api/src/files/files.service.ts` for bucket, path, MIME type, size, upstream status, and success URL without logging tokens
- [x] 4.6 Update `apps/chat-api/src/files/dto/file-path.validator.ts` so percent-encoded file names such as `IMG_4740%202.jpg` are valid path values
- [x] 4.5 Preserve `url` in `apps/chat/src/utils/attachment-dto-to-display.ts`

## 5. Tests

- [x] 5.1 Update `apps/chat/src/hooks/conversation/tests/useConversationHandlers.spec.ts` to cover immediate upload callback and send with pre-uploaded URL DTOs
- [x] 5.2 Update `apps/chat/src/pages/ConversationRoute/ConversationRoute.spec.tsx` to cover app-level immediate upload and send DTO mapping behavior

## 6. Verification

- [x] 6.1 Run `npm exec nx test chat` — all tests pass
- [x] 6.2 Run `npm exec nx test @epam/ai-dial-conversation-input` — all tests pass
- [x] 6.3 Run `npm exec nx lint chat` — no lint errors
- [x] 6.4 Run `npm exec nx lint @epam/ai-dial-conversation-input` — no lint errors (warnings only from existing non-null assertions in tests)
- [x] 6.5 Run `npm exec nx test chat-api` — all tests pass
- [x] 6.6 Run `npm exec nx lint chat-api` — no lint errors
