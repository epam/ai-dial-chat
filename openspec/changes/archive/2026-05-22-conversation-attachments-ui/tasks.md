## 1. Shared Types (`libs/chat-shared`)

- [x] 1.1 Add `AttachmentType` enum (`file | image | prompt | pasted`) to `libs/chat-shared/src/models/chat.ts`
- [x] 1.2 Add shared `RequestStatus` enum (`idle | loading | error`) to `libs/chat-shared/src/models/chat.ts` — reusable for any async operation, not attachment-specific
- [x] 1.3 Add `Attachment` interface (`id`, `name`, `contentType`, `file`, `type: AttachmentType`, `status: RequestStatus`, `previewUrl?`) with JSDoc to `libs/chat-shared/src/models/chat.ts`
- [x] 1.4 Export all new symbols from `libs/chat-shared/src/index.ts`
- [x] 1.5 Verify: `npm exec nx typecheck chat-shared`

## 2. File-type icon utility (`libs/conversation-input`)

- [x] 2.1 Create `libs/conversation-input/src/utils/getAttachmentIcon.ts` — maps `contentType` string to the appropriate `@tabler/icons-react` icon component (csv → `IconCsv`, text → `IconTxt`, pdf → `IconPdf`, image/\* → `IconPhoto`, fallback → `IconFile`)
- [x] 2.2 Export `getAttachmentIcon` from the lib's barrel (`libs/conversation-input/src/index.ts` if applicable, or keep internal)

## 3. `AttachmentCard` component (`libs/conversation-input`)

- [x] 3.1 Create folder `libs/conversation-input/src/components/AttachmentCard/`
- [x] 3.2 Create `AttachmentCardProps` interface in `libs/conversation-input/src/models/AttachmentCard.ts` — props: `attachment: Attachment`, `onRemove: (id: string) => void`, `onRetry?: (id: string) => void`, `className?: string`
- [x] 3.3 Implement `AttachmentCard.tsx` — renders title, format label, type icon; applies hover/selected/focus/loading/error states per Figma design
- [x] 3.4 For `type: 'image'` render `<img>` thumbnail using `attachment.previewUrl`; for all other types render the icon from `getAttachmentIcon`
- [x] 3.5 Show remove (×) button (`IconX`) on hover and focus; hide it during `loading` state
- [x] 3.6 Show retry (↺) button (`IconRefresh`) alongside remove button in `error` state
- [x] 3.7 Apply `aria-label` for remove button using i18n key `conversationInput.attachment.remove`
- [x] 3.8 Apply `aria-label` for retry button using i18n key `conversationInput.attachment.retry`
- [x] 3.9 Add i18n keys `conversationInput.attachment.remove` and `conversationInput.attachment.retry` to `apps/chat/src/i18n/locales/en.json`
- [x] 3.10 Create `AttachmentCard.module.scss` for any states not expressible with Tailwind alone (hover show/hide of button overlay)
- [x] 3.11 Write unit tests in `AttachmentCard/tests/AttachmentCard.spec.tsx` covering: default render, image thumbnail, loading state hides remove, error state shows retry, remove callback, keyboard remove
- [x] 3.12 Verify: `npm exec nx test conversation-input`

## 4. `AttachmentTray` component (`libs/conversation-input`)

- [x] 4.1 Create folder `libs/conversation-input/src/components/AttachmentTray/`
- [x] 4.2 Create `AttachmentTrayProps` interface in `libs/conversation-input/src/models/AttachmentTray.ts` — props: `attachments: Attachment[]`, `onRemove: (id: string) => void`, `onRetry?: (id: string) => void`, `className?: string`
- [x] 4.3 Implement `AttachmentTray.tsx` — renders `role="list"` horizontal scrollable container; maps `attachments` to `AttachmentCard`s; returns `null` when list is empty
- [x] 4.4 Add i18n key `conversationInput.attachmentTray.label` to `apps/chat/src/i18n/locales/en.json`
- [x] 4.5 Apply `aria-label` from i18n key `conversationInput.attachmentTray.label` to the tray container
- [x] 4.6 Write unit tests in `AttachmentTray/tests/AttachmentTray.spec.tsx` covering: renders cards, returns null when empty, remove callback forwarded, last card removal hides tray
- [x] 4.7 Verify: `npm exec nx test conversation-input`

## 5. Attach button & pending state in `Input` (`libs/conversation-input`)

- [x] 5.1 Add `onAttachmentsChange?: (attachments: Attachment[]) => void` prop to `InputProps` in `libs/conversation-input/src/models/Input.ts`
- [x] 5.2 Add `useState<Attachment[]>([])` for the attachment list inside `Input.tsx`
- [x] 5.3 Add a visually-hidden `<input type="file" multiple ref={fileInputRef}>` element to `Input.tsx`
- [x] 5.4 Add a `+` button (`GhostIconButton` with `IconPlus`, 40×40, icon 18px `BASE_ICON_SIZE`) wrapped in `DialDropdown` with a single "Attach file" item; clicking the item calls `fileInputRef.current?.click()`. Trigger button aria-label from `conversationInput.addMenu.ariaLabel`; item label from `conversationInput.attach.label`.
- [x] 5.5 Add i18n keys `conversationInput.addMenu.ariaLabel` and `conversationInput.attach.label` to `apps/chat/src/i18n/locales/en.json`
- [x] 5.6 Implement `handleFileChange` — converts selected `File[]` to `Attachment[]` (generate uuid id, set `type` from MIME, `status: RequestStatus.Idle`, `previewUrl` for images via `URL.createObjectURL`)
- [x] 5.7 Merge new attachments into state; call `onAttachmentsChange` with updated list
- [x] 5.8 Implement `handleRemove(id)` — filter out the attachment, call `URL.revokeObjectURL` if it had a `previewUrl`, call `onAttachmentsChange`
- [x] 5.9 Add `useEffect` cleanup that calls `URL.revokeObjectURL` for all image `previewUrl`s on unmount
- [x] 5.10 Render `<AttachmentTray>` above the textarea when list is non-empty
- [x] 5.11 Extend existing `Input` unit tests in `Input/tests/` to cover: attach button present, file picked adds card, remove removes card, object URL revoked on remove
- [x] 5.12 Verify: `npm exec nx test conversation-input`

## 6. Propagate prop through `ConversationInput` (`libs/conversation-input`)

- [x] 6.1 Add `onAttachmentsChange?: (attachments: Attachment[]) => void` to `ConversationInputProps` in `libs/conversation-input/src/models/ConversationInput.ts`
- [x] 6.2 Forward `onAttachmentsChange` from `ConversationInput.tsx` down to `<Input>`
- [x] 6.3 Verify: `npm exec nx typecheck conversation-input`

## 7. Wire-up in `apps/chat` (optional observation)

- [x] 7.1 In `ConversationView`, add `onAttachmentsChange` prop to `Props` (optional, `(attachments: Attachment[]) => void`)
- [x] 7.2 Pass it through to `<ConversationInput onAttachmentsChange={onAttachmentsChange}>` (no-op if not provided)
- [x] 7.3 Verify: `npm exec nx typecheck chat` and `npm exec nx build chat`

## 8. Final verification

- [ ] 8.1 Run `npm exec nx test conversation-input` — all tests pass
- [ ] 8.2 Run `npm exec nx lint conversation-input` — no lint errors
- [ ] 8.3 Run `npm exec nx typecheck chat-shared conversation-input chat` — no type errors
- [ ] 8.4 Smoke-test in the browser: pick files, confirm cards render, hover shows ×, clicking × removes the card, tray disappears when last card is removed
