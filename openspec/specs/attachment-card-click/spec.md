# Spec: attachment-card-click

## Purpose

Specifies how `AttachmentCard` exposes an optional click handler, how `resolveDialFileDownloadUrl` turns a DIAL file id into a BFF download URL, and how the `useAttachmentAction` hook resolves and triggers the correct action (download, canvas preview, or external open for reference-only attachments) when a card is activated.

---

## Requirements

### Requirement: `AttachmentCard` accepts an `onClick` callback

`libs/attachment-input/src/models/attachment-card.ts` SHALL declare the following optional members:

- `AttachmentCardProps.onClick?: (id: string) => void` — Called when the user clicks or keyboard-activates the card. Receives the attachment `id`.
- `AttachmentCardLabels.clickLabel?: string` (passed as `labels.clickLabel`) — Accessible name of the card root when it is interactive via `onClick`. Its default depends on the tile variant, because the two do different things: the file tile (which also renders link and pasted-text cards) defaults to `'Download attachment'` and the image tile to `'Open attachment'`.
- `AttachmentCardLabels.expandLabel?: string` (passed as `labels.expandLabel`) — Accessible name of a pasted-text card root when it is interactive via `onExpand`. Defaults to `'Expand pasted text'`.
- `AttachmentCardLabels.downloadLabel?: string` (passed as `labels.downloadLabel`) — Accessible name of the corner download button on image and file tiles, rendered when `onDownload` is given. Defaults to `'Download attachment'`. The download button SHALL NOT be named by `clickLabel`, so a tile that is both clickable and downloadable exposes two distinctly named buttons when the host passes distinct labels. `AttachmentGroup` SHALL accept `labels.downloadLabel` (default `'Download attachment'`) and forward it to every tile; `UserMessageBubble` and `AssistantMessageBubble` SHALL forward `labels.attachmentDownloadLabel` to it. `apps/chat` SHALL pass `t(AttachmentsI18nKeys.Download)` as the download label, and `t(ButtonsI18nKeys.OpenInCanvas)` as the tile click label when the tile opens the canvas rather than downloading.

`AttachmentCard` SHALL make the card root interactive only when activating it performs an action — `onExpand` on a pasted-text card, or otherwise `onClick` (on an image tile, only once the image is neither loading nor failed). An interactive card root SHALL:
- Render as `role="button"` with `tabIndex={0}` and `cursor-pointer`.
- Carry `aria-label={labels.expandLabel}` when the action is expand, and `aria-label={labels.clickLabel}` otherwise.
- Run the same action on left-click and on `Enter` or `Space` key press.
- Ensure that clicks and key presses on inner action buttons (`onRemove`, `onRetry`, download) do NOT propagate to the card-level action.

A card root with no action SHALL render as a plain element — no `role`, no `tabIndex`, no `aria-label`, no `cursor-pointer` — so it adds no unnamed or no-op Tab stop. Its corner action buttons remain individually focusable.

The `onClick` prop SHALL be independent of `onExpand`. When both are supplied, `onExpand` takes precedence for pasted-text cards — for mouse and keyboard activation alike; `onClick` applies only when `onExpand` is not active.

#### Scenario: Card with `onClick` is interactive

- **WHEN** `AttachmentCard` is rendered with `onClick`
- **THEN** the card root has `role="button"`, `tabIndex={0}`, and `cursor-pointer`
- **AND** the `aria-label` on the card root equals the `labels.clickLabel` value

#### Scenario: Card without an action is inert

- **WHEN** `AttachmentCard` is rendered with neither `onClick` nor an applicable `onExpand`
- **THEN** the card root has no `role="button"`, no `tabIndex`, and no `cursor-pointer`
- **AND** no element in the card is a button except its corner action buttons

#### Scenario: The default label matches the tile variant

- **WHEN** `labels.clickLabel` is omitted and the card has `onClick`
- **THEN** a file, link or pasted-text tile is labelled `'Download attachment'` and an image tile `'Open attachment'`

#### Scenario: An expandable pasted card is named by the expand label

- **WHEN** a pasted-text card receives `onExpand` (with or without `onClick`)
- **THEN** the card root's `aria-label` is `labels.expandLabel` (default `'Expand pasted text'`), not `labels.clickLabel`

#### Scenario: The download button is named by the download label, not the click label

- **WHEN** a file tile receives `onClick`, `onDownload`, `labels.clickLabel = 'Open in canvas'` and `labels.downloadLabel = 'Download file'`
- **THEN** the card root is a button named `'Open in canvas'` and the corner download button is a separate button named `'Download file'`
- **AND** activating the download button calls `onDownload` with the attachment `id` and does NOT call `onClick`

#### Scenario: Mouse click invokes `onClick`

- **WHEN** a user clicks the card body (not an action button) and `onClick` is provided
- **THEN** `onClick` is called once with the attachment's `id`

#### Scenario: Keyboard activation invokes `onClick`

- **WHEN** the card has focus and the user presses `Enter` or `Space` and `onClick` is provided
- **THEN** `onClick` is called once with the attachment's `id`

#### Scenario: Action button click does not propagate to `onClick`

- **WHEN** the user clicks the remove button and both `onRemove` and `onClick` are provided
- **THEN** `onRemove` is called and `onClick` is NOT called

#### Scenario: `onExpand` takes precedence over `onClick` for pasted cards

- **WHEN** `AttachmentCard` receives both `onExpand` and `onClick` and the card type is `AttachmentType.Pasted`
- **THEN** clicking the card, or pressing `Enter` or `Space` on it, invokes `onExpand`, not `onClick`

---

### Requirement: `resolveDialFileDownloadUrl` turns a DIAL file id into a BFF download URL

`apps/chat/src/utils/dial-file.ts` SHALL export `resolveDialFileDownloadUrl(fileId: string): string | undefined`; `icon-path.ts` imports it from there rather than owning it, so icon URLs and attachment downloads resolve through one implementation. The function SHALL convert a DIAL file identifier (`files/{bucket}/{path}`) to the BFF download query string URL (`/api/v1/files/download?bucket=…&path=…`). If the file ID does not start with `files/` or contains no path segment after the bucket, the function SHALL return `undefined`.

The path segment SHALL be decoded with `decodeURIComponent` before being set as the `path` query parameter; if decoding throws, the raw segment SHALL be used.

#### Scenario: Valid DIAL file ID resolves to BFF URL

- **WHEN** `resolveDialFileDownloadUrl('files/my-bucket/reports/q1.pdf')` is called
- **THEN** the returned URL is `/api/v1/files/download?bucket=my-bucket&path=reports%2Fq1.pdf` (or equivalent `URLSearchParams` encoding)

#### Scenario: Percent-encoded path segment is decoded before passing as query param

- **WHEN** `resolveDialFileDownloadUrl('files/my-bucket/folder%2Fname.pdf')` is called
- **THEN** the `path` query parameter value is `folder/name.pdf` (decoded)

#### Scenario: Non-DIAL-file URL returns undefined

- **WHEN** `resolveDialFileDownloadUrl('https://external.com/file.pdf')` is called
- **THEN** the function returns `undefined`

#### Scenario: File ID with no path segment returns undefined

- **WHEN** `resolveDialFileDownloadUrl('files/only-bucket')` is called
- **THEN** the function returns `undefined`

---

### Requirement: `useAttachmentAction` hook resolves and triggers the correct action per attachment

`libs/chat-hooks/src/attachment/useAttachmentAction/useAttachmentAction.ts` SHALL export `useAttachmentAction({ resolveDownloadUrl })` returning a stable callback `handleAttachmentClick: (attachment: DisplayAttachment) => void`.

The DIAL-file-id-to-URL step is host-owned — it encodes the application's own file-download endpoint — so it SHALL be injected as the `resolveDownloadUrl` parameter rather than imported by the hook. `apps/chat` passes `resolveDialFileDownloadUrl`.

When `handleAttachmentClick` is called with an attachment:

1. If `attachment.url` or inline `attachment.data` is set, delegate to `downloadAttachment`, which downloads a DIAL file id through `resolveDownloadUrl` + `triggerAnchorDownload`, or builds a blob from inline base64 `data` and downloads it through `triggerBlobDownload`. The download filename is produced by `ensureDownloadFilename(name, url, contentType)` — if the attachment's `name` already ends with a file extension, it is used as-is; otherwise the extension is derived first from `MIME_TYPE_EXT_MAP[contentType]`, then from the last path segment of `url` (`ensureDownloadFilename` lives in `libs/chat-shared/src/utils/file-download.ts`). A `url` that is set but is not a DIAL file id, with no `data`, resolves to no download.
2. Otherwise, if `attachment.referenceUrl` is set (a reference-only attachment — no `url`, e.g. a RAG/search-grounding chunk):
   - If the reference targets a PDF (optionally with a `#page=N` fragment), open the canvas with the resulting `PdfCanvasContent` via `openCanvas(content, attachment.name)`. A referenced page is expressed as a single transparent, zero-area highlight plus a matching `selectedHighlightId`, so the viewer scrolls to that page without painting anything over it.
   - Otherwise, download DIAL-hosted files through `resolveDownloadUrl` or open external URLs via `window.open(url, '_blank', 'noopener,noreferrer')`.
3. If neither `attachment.url`, `attachment.data`, nor `attachment.referenceUrl` is set, do nothing.

The module SHALL also export `downloadAttachment(attachment, resolveDownloadUrl): boolean` and `isDownloadableAttachment(attachment): boolean`, so callers can skip reference-only attachments without duplicating the DIAL-file-id and inline-data checks.

The hook SHALL be extensible: future handlers for different MIME types, attachment types, or metadata SHALL be addable by extending the routing logic inside `useAttachmentAction` without modifying callers.

The returned callback SHALL be stable across re-renders (wrapped in `useCallback` over `openCanvas` and `resolveDownloadUrl`).

#### Scenario: DIAL file attachment triggers a download

- **WHEN** `handleAttachmentClick` is called with an attachment whose `url` is `'files/my-bucket/folder/file.pdf'`
- **THEN** `triggerAnchorDownload` is called with the URL that `resolveDownloadUrl` returned and the filename produced by `ensureDownloadFilename`

#### Scenario: Download filename preserves an already-present extension

- **WHEN** `handleAttachmentClick` is called with an attachment whose `name` is `'Q3_2026_Financial_Performance.xlsx'`
- **THEN** `triggerAnchorDownload` is called with the filename `'Q3_2026_Financial_Performance.xlsx'` unchanged

#### Scenario: Download filename gains extension from the URL path when the name has none

- **WHEN** `handleAttachmentClick` is called with an attachment whose `name` is `'Thermo Fisher 10-K Summary'`, whose `url` ends with `'ThermoFisher_2024.xlsx'`, and whose `contentType` has no `MIME_TYPE_EXT_MAP` entry
- **THEN** `triggerAnchorDownload` is called with the filename `'Thermo Fisher 10-K Summary.xlsx'`

#### Scenario: Download filename takes the MIME-type extension when the name has none

- **WHEN** `handleAttachmentClick` is called with an attachment whose `name` has no extension, whose `url` path segment has no extension, and whose `contentType` is `'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'`
- **THEN** `triggerAnchorDownload` is called with a filename ending in `.xlsx`

#### Scenario: Inline data attachment downloads as a blob

- **WHEN** `handleAttachmentClick` is called with an attachment that has no DIAL `url` but carries inline base64 `data`
- **THEN** a blob is built from that data using the attachment's content type and downloaded through `triggerBlobDownload`

#### Scenario: Attachment without a DIAL file URL or referenceUrl is a no-op

- **WHEN** `handleAttachmentClick` is called with an attachment whose `url` is `undefined` or an absolute external URL, and both `data` and `referenceUrl` are also `undefined`
- **THEN** no download is triggered, no canvas is opened, and no navigation occurs

#### Scenario: Callback reference is stable

- **WHEN** `useAttachmentAction` is rendered twice without state changes
- **THEN** the returned `handleAttachmentClick` reference is the same object both times

#### Scenario: PDF-page referenceUrl opens the canvas

- **WHEN** `handleAttachmentClick` is called with an attachment whose `url` is `undefined` and `referenceUrl` is `'files/my-bucket/report.pdf#page=5'`
- **THEN** the canvas opens with a page-scrolled `PdfCanvasContent`, and no anchor download or `window.open` occurs

#### Scenario: Non-PDF DIAL-file referenceUrl triggers a download

- **WHEN** `handleAttachmentClick` is called with an attachment whose `url` is `undefined` and `referenceUrl` is `'files/my-bucket/notes.md'`
- **THEN** a temporary anchor download is triggered for the resolved DIAL download URL, and the canvas is not opened

#### Scenario: External (non-DIAL) referenceUrl opens in a new tab

- **WHEN** `handleAttachmentClick` is called with an attachment whose `url` is `undefined` and `referenceUrl` is `'https://example.com/source'`
- **THEN** `window.open` is called with the URL, `"_blank"`, and `"noopener,noreferrer"`, and the canvas is not opened
