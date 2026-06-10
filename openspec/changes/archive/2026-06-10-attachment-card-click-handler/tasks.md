## 1. Lib — `AttachmentCard` click prop

- [x] 1.1 Add `onClick?: (id: string) => void` and `clickLabel?: string` (default `'Open attachment'`) to `AttachmentCardProps` in `libs/conversation-input/src/models/AttachmentCard.ts`
- [x] 1.2 Update `AttachmentCard.tsx`: set `role="button"`, `tabIndex={0}`, `aria-label={clickLabel}`, `cursor-pointer`, and `onClick`/`onKeyDown` handlers when `onClick` prop is supplied (mirror the `onExpand` pattern); ensure `isClickable` is independent of `isExpandable`
- [x] 1.3 Ensure inner action-button clicks (`onRemove`, `onRetry`) call `e.stopPropagation()` so they do not reach the card-level `onClick`
- [x] 1.4 Update `AttachmentCard` unit tests to cover: inert card (no `onClick`), interactive card with mouse click, keyboard activation (`Enter`/`Space`), action button stops propagation, `onExpand` precedence over `onClick` for pasted cards

## 2. App util — export `resolveDialFileDownloadUrl`

- [x] 2.1 Extract the private `resolveDialFileUrl` logic in `apps/chat/src/utils/icon-path.ts` into an exported `resolveDialFileDownloadUrl(fileId: string): string | undefined`; update `resolveCatalogIconUrl` to call the new export
- [x] 2.2 Add unit tests for `resolveDialFileDownloadUrl`: valid DIAL file ID, percent-encoded path, non-DIAL URL (returns `undefined`), missing path segment (returns `undefined`)

## 3. App hook — `useAttachmentAction`

- [x] 3.1 Create `apps/chat/src/hooks/attachment/useAttachmentAction.ts` exporting `useAttachmentAction()` returning stable `handleAttachmentClick: (attachment: DisplayAttachment) => void`
- [x] 3.2 Implement the download action: check `attachment.url` starts with `files/`; call `resolveDialFileDownloadUrl`; programmatically click a temporary `<a download>` element; no-op when URL is absent or resolution returns `undefined`
- [x] 3.3 Add unit tests: DIAL file attachment triggers anchor click with correct `href` and `download` attribute; non-DIAL attachment is no-op; callback reference is stable across re-renders

## 4. App component — `FilesSection`

- [x] 4.1 Add optional `onAttachmentClick?: (attachment: DisplayAttachment) => void` prop to `FilesSection` in `apps/chat/src/components/ConversationSourcesPanel/sections/FilesSection/FilesSection.tsx`
- [x] 4.2 Forward the handler to each `AttachmentCard` as `onClick={(id) => onAttachmentClick?.(att)}` and pass `clickLabel` from `t(SidebarI18nKeys.AttachmentDownloadLabel)`
- [x] 4.3 Update `FilesSection` tests: cards have no `onClick` when prop is absent; cards have `onClick` and correct `clickLabel` when prop is provided; activating a card calls `onAttachmentClick` with the correct attachment

## 5. App component — `ConversationSourcesPanel`

- [x] 5.1 Call `useAttachmentAction()` in `ConversationSourcesPanel` and pass `handleAttachmentClick` as `onAttachmentClick` to both `FilesSection` instances
- [x] 5.2 Update `ConversationSourcesPanel` tests: panel passes `onAttachmentClick` to both file sections

## 6. i18n

- [x] 6.1 Add `sidebar.sources.attachment.downloadLabel` key with value `"Download file"` to `apps/chat/src/i18n/locales/en.json`
- [x] 6.2 Add `AttachmentDownloadLabel` member to `SidebarI18nKeys` in `apps/chat/src/constants/translation-keys.ts`

## 7. Verification

- [x] 7.1 Run `npm exec nx run conversation-input:test` — all tests pass
- [x] 7.2 Run `npm exec nx run chat:test` — all tests pass
- [x] 7.3 Run `npm exec nx run chat:lint` and `npm exec nx run conversation-input:lint` — no lint errors
- [x] 7.4 Run `npm exec nx run chat:type-check` — no TypeScript errors
