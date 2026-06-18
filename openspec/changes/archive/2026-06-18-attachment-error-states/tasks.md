## 1. Shared model — AttachmentErrorReason

- [x] 1.1 Add `AttachmentErrorReason` string enum (`Network`, `UnsupportedType`) to `libs/chat-shared/src/types/attachment.ts` alongside `AttachmentType`
- [x] 1.2 Add optional `errorReason?: AttachmentErrorReason` field to `DisplayAttachment` interface in `libs/chat-shared/src/models/chat.ts`
- [x] 1.3 Export `AttachmentErrorReason` from `libs/chat-shared/src/index.ts`
- [x] 1.4 Run `npm exec nx lint chat-shared` and `npm exec nx build chat-shared` — verify clean

## 2. Lib — validateAttachment prop and retry suppression

- [x] 2.1 Add `validateAttachment?: (attachment: Attachment) => AttachmentErrorReason | undefined` to `InputProps` in `libs/conversation-input/src/models/Input.ts` (or wherever `InputProps` is defined)
- [x] 2.2 Forward `validateAttachment` through `ConversationInputProps` to the inner `Input`
- [x] 2.3 In the attachment-add handler inside `libs/conversation-input`, call `validateAttachment(attachment)` before calling `onUploadAttachment`; if a reason is returned, set `{ status: RequestStatus.Error, errorReason: reason }` and skip `onUploadAttachment`
- [x] 2.4 In `AttachmentCard.tsx`, suppress the retry button when `attachment.errorReason === AttachmentErrorReason.UnsupportedType` (guard the existing `isError && onRetry` condition)
- [x] 2.5 Run `npm exec nx lint conversation-input` and `npm exec nx build conversation-input` — verify clean

## 3. Lib — error card layout redesign

- [x] 3.1 In `AttachmentCard.tsx`, inside the non-image branch, swap layout when `isError`: render icon + `DialEllipsisTooltip`(label) as the top row, then render filename with `DialEllipsisTooltip` (multiline) occupying `flex-1` below
- [x] 3.2 In `AttachmentCard.tsx`, keep the current layout (filename top, icon+label bottom) for non-error non-image cards
- [x] 3.3 Update `AttachmentCard.spec.tsx` to cover error-state layout (icon on top, name below) and normal layout (name on top)
- [x] 3.4 Run `npm exec nx test conversation-input` — verify tests pass

## 4. App — MIME validation utility

- [x] 4.1 Add `mimeTypesToExtensionLabels(types: string[]): string` pure function to `apps/chat/src/utils/` (converts MIME entries to display labels; handles wildcards like `image/*`)
- [x] 4.2 Add `isMimeTypeAllowed(mimeType: string, allowedTypes: string[]): boolean` helper to the same utils file (supports exact and wildcard prefix matching)
- [x] 4.3 Add unit tests for both utilities in `apps/chat/src/utils/` covering exact match, wildcard match, unrecognised type, and empty list

## 5. App — unsupported-type error wiring

- [x] 5.1 Add i18n keys `attachments.unsupportedType.title` and `attachments.unsupportedType.message` to `apps/chat/src/i18n/locales/en.json`
- [x] 5.2 Add `AttachmentsI18nKeys.UnsupportedTypeTitle` and `AttachmentsI18nKeys.UnsupportedTypeMessage` to `apps/chat/src/constants/translation-keys.ts`
- [x] 5.3 In `ConversationView.tsx`, create a `validateAttachment` callback (memoised with `useCallback`) that checks the file's `contentType` against `inputAttachmentTypes` using `isMimeTypeAllowed`; when invalid, call `showNotification` with the unsupported-type message (collecting all invalid files per batch before notifying)
- [x] 5.4 Pass the `validateAttachment` callback to `ConversationInput` / `Input` in `ConversationView.tsx`
- [x] 5.5 Repeat 5.3–5.4 for `ConversationRoute.tsx` (the new-conversation page)

## 6. App — network-error notification wiring

- [x] 6.1 Add i18n keys `attachments.networkError.title` and `attachments.networkError.message` to `apps/chat/src/i18n/locales/en.json`
- [x] 6.2 Add `AttachmentsI18nKeys.NetworkErrorTitle` and `AttachmentsI18nKeys.NetworkErrorMessage` to `apps/chat/src/constants/translation-keys.ts`
- [x] 6.3 In `useConversationHandlers.ts`, wrap `handleUploadAttachment` so that when `uploadFile` throws and `navigator.onLine === false`, the error is recorded as `errorReason: AttachmentErrorReason.Network` and the filename is added to a debounced `useRef` batch; after 100 ms, flush to `showNotification` with the network-error message listing all filenames
- [x] 6.4 Verify that when `navigator.onLine === true` on failure, no network notification is shown (generic error path is unchanged)

## 7. Verification

- [x] 7.1 Run `npm exec nx affected --target=lint --base=origin/development-1.0` — no new errors
- [x] 7.2 Run `npm exec nx affected --target=test --base=origin/development-1.0` — all tests pass
- [x] 7.3 Run `npm exec nx affected --target=build --base=origin/development-1.0` — clean build
- [x] 7.4 Manual smoke: upload a supported file → normal flow; upload an unsupported file → error card (no retry), notification shows accepted formats; simulate offline (DevTools → offline) → upload fails, network notification shows filename, retry button present
