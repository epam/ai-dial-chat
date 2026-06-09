## 1. Lib — AttachmentCard props

- [x] 1.1 Add `onDownload?: (id: string) => void` and `downloadLabel?: string` to `AttachmentCardProps` in `libs/conversation-input/src/models/AttachmentCard.ts`
- [x] 1.2 Import `IconDownload` and destructure the new props in `libs/conversation-input/src/components/AttachmentCard/AttachmentCard.tsx`
- [x] 1.3 Render a `DialGhostIconButton` with `IconDownload` as the first button in the `absolute right-1 top-1` action container, guarded by `onDownload`
- [x] 1.4 Verify typecheck passes: `nx run @epam/ai-dial-conversation-input:typecheck`

## 2. App — download utility

- [x] 2.1 Export `resolveDialFileUrl` from `apps/chat/src/utils/icon-path.ts`
- [x] 2.2 Create `apps/chat/src/utils/download-attachment.ts` with `downloadAttachment(url, filename)` using hidden `<a>` approach

## 3. App — i18n

- [x] 3.1 Add `DownloadFile = 'sidebar.sources.downloadFile'` to `SidebarI18nKeys` in `apps/chat/src/constants/translation-keys.ts`
- [x] 3.2 Add `"downloadFile": "Download file"` to `sidebar.sources` in `apps/chat/src/i18n/locales/en.json`

## 4. App — FilesSection wiring

- [x] 4.1 Import `downloadAttachment` and `useTranslation`/`SidebarI18nKeys` in `FilesSection.tsx`
- [x] 4.2 Implement `handleDownload` callback with `useCallback` that looks up the attachment by id and calls `downloadAttachment`
- [x] 4.3 Pass `onDownload={att.url ? handleDownload : undefined}` and `downloadLabel` to each `AttachmentCard`
- [x] 4.4 Verify typecheck passes: `nx run @epam/chat:typecheck`
