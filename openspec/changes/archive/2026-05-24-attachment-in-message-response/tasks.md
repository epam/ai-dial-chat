## 1. Shared types (`libs/chat-shared`)

- [x] 1.1 Add `DialAttachment` interface (`type`, `title`, `data?`, `url?`, `reference_type?`, `reference_url?`) to `libs/chat-shared/src/models/chat.ts`
- [x] 1.2 Add `Attachment` interface (`id`, `name`, `contentType`, `file`, `type`, `status`, `previewUrl?`) to `libs/chat-shared/src/models/chat.ts`
- [x] 1.3 Add `custom_content?: { attachments?: DialAttachment[] }` to the `Message` interface in `libs/chat-shared/src/models/chat.ts`
- [x] 1.4 Export `mapDialAttachmentToAttachment` from `libs/chat-shared/src/utils/attachment-mapper.ts` (zero-byte File stub, previewUrl from `data` for images)
- [x] 1.5 Export new types and utility from `libs/chat-shared/src/index.ts`

## 2. Backend DTOs and service (`apps/chat-api`)

- [x] 2.1 Create `libs/chat-api/src/conversations/dto/dial-attachment.dto.ts` with `DialAttachmentDto` (`type`, `title`, `data?`, `url?`), `@IsString()` / `@IsOptional()` decorators, and `@ApiProperty` docs
- [x] 2.2 Add `attachments?: DialAttachmentDto[]` to `SendCompletionDto` with `@IsOptional()`, `@IsArray()`, `@ValidateNested({ each: true })`, `@Type(() => DialAttachmentDto)`
- [x] 2.3 Add same `attachments` field to `CreateConversationDto`
- [x] 2.4 Update `conversation.service.ts` — embed `attachments` (filtered to those with `data` or `url`) into `message.custom_content.attachments` before forwarding to DIAL Core
- [x] 2.5 Add/update integration test in `conversation.controller.integration.spec.ts` to cover send with valid attachments and send with a malformed attachment (expect 400)

## 3. Frontend encoding utility (`apps/chat`)

- [x] 3.1 Create `apps/chat/src/utils/attachment-to-dial.ts` with `attachmentToDialAttachment` (FileReader → base64) and `attachmentsToDialAttachments` (parallel map, returns `undefined` for empty array)
- [x] 3.2 Write unit tests for `attachment-to-dial.ts` covering: successful encode, empty array → `undefined`, FileReader error → rejects

## 4. Send path wiring (`apps/chat`)

- [x] 4.1 Update `Conversation.tsx` `handleSend`: call `attachmentsToDialAttachments` before API call; on file-read error, set error state and abort send
- [x] 4.2 Pass encoded `DialAttachment[]` to `streamCompletion` / `createConversation` API calls in `apps/chat/src/server-api/`
- [x] 4.3 Update `chat-stream.api.ts` to throw on non-OK SSE response / error event
- [x] 4.4 Show streaming error banner in `Conversation.tsx`; add i18n key `conversation.streamError` to `en.json`

## 5. Response rendering in message bubbles (`libs/conversation-messages`)

- [x] 5.1 Add optional `attachments?: DialAttachment[]` prop to `UserMessageBubblePros` in `libs/conversation-messages/src/models/MessageBubble.ts`
- [x] 5.2 Update `UserMessageBubble.tsx` — map `attachments` via `mapDialAttachmentToAttachment` and render `AttachmentTray` above text (read-only: no `onRemove`, no `onRetry`)
- [x] 5.3 Add optional `attachments?: DialAttachment[]` prop to `AssistantMessageBubbleProps`
- [x] 5.4 Update `AssistantMessageBubble.tsx` — render `AttachmentTray` below text (read-only)
- [x] 5.5 Update `Conversation.tsx` to pass `message.custom_content?.attachments` to each bubble
- [x] 5.6 Add/update tests for `UserMessageBubble` and `AssistantMessageBubble` (tray present/absent, position

## 6. `AttachmentCard` display updates (`libs/conversation-input`)

- [x] 6.1 Derive `nameWithoutExtension` via `useMemo` using `name.lastIndexOf('.')` in `AttachmentCard.tsx`
- [x] 6.2 Wrap the name span in `DialTooltip` with `tooltip={nameWithoutExtension}` — keep `line-clamp-3 break-words` classes; use full name (with extension) as tooltip content
- [x] 6.3 Update/add `AttachmentCard` tests: name without extension shown, tooltip content includes extension, full name retained for names without extension
