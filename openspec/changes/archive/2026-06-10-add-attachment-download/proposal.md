## Why

The conversation sources sidebar shows uploaded and generated attachments as read-only cards, but offered no way for users to retrieve those files. A per-card download action closes this gap without requiring a full "Download All" implementation.

## What Changes

- `AttachmentCard` (`libs/conversation-input`) gains optional `onDownload` and `downloadLabel` props; when `onDownload` is provided the card renders a download icon button in the top-right action area alongside retry/remove.
- A new `download-attachment.ts` utility in `apps/chat/src/utils/` resolves a DIAL file ID or absolute URL to a browser-triggerable download URL and initiates the download via a hidden `<a>` element.
- `FilesSection` wires `onDownload` for each attachment that has a `url`, using `downloadAttachment` from the new utility.
- `resolveDialFileUrl` in `apps/chat/src/utils/icon-path.ts` is exported so the download utility can reuse the existing DIAL-file-ID → BFF-URL conversion.
- A new i18n key `sidebar.sources.downloadFile` ("Download file") is added to `SidebarI18nKeys` and `en.json`.

## Capabilities

### New Capabilities

_(none — this change extends existing capabilities only)_

### Modified Capabilities

- `conversation-sources-sidebar`: The "read-only attachment cards" requirement changes — cards with a remote URL now render a per-card download button that triggers `downloadAttachment`; cards without a URL (inline base64) remain action-free. A new i18n key `sidebar.sources.downloadFile` is added.
- `conversation-input-attachments`: `AttachmentCard` gains `onDownload?: (id: string) => void` and `downloadLabel?: string` props; a download `DialGhostIconButton` is rendered before the retry/remove buttons when `onDownload` is defined.

## Impact

- `libs/conversation-input/src/models/AttachmentCard.ts` — two new optional props.
- `libs/conversation-input/src/components/AttachmentCard/AttachmentCard.tsx` — new `IconDownload` action button in the action area.
- `apps/chat/src/utils/icon-path.ts` — `resolveDialFileUrl` changed from private to named export.
- `apps/chat/src/utils/download-attachment.ts` — new file.
- `apps/chat/src/constants/translation-keys.ts` — `SidebarI18nKeys.DownloadFile` added.
- `apps/chat/src/i18n/locales/en.json` — `sidebar.sources.downloadFile` key added.
- `apps/chat/src/components/ConversationSourcesPanel/sections/FilesSection/FilesSection.tsx` — `onDownload` + `downloadLabel` wired.
- No API surface, routing, auth, or database changes.
