# Spec: attachment-card-click

## Purpose

Specifies how `AttachmentCard` exposes an optional click handler, how `resolveDialFileDownloadUrl` turns a DIAL file id into a BFF download URL, and how the `useAttachmentAction` hook resolves and triggers the correct action (download, canvas preview, or external open for reference-only attachments) when a card is activated.

---

## Requirements

### Requirement: `AttachmentCard` accepts an `onClick` callback

`libs/attachment-input/src/models/attachment-card.ts` SHALL declare the following optional members of `AttachmentCardProps`:

- `onClick?: (id: string) => void` — Called when the user clicks or keyboard-activates the card. Receives the attachment `id`.
- `clickLabel?: string` — Accessible label applied to the card root. Its default depends on the tile variant, because the two do different things: the file tile defaults to `'Download attachment'` and the image/pasted tile to `'Open attachment'`.

`AttachmentCard` SHALL:
- Render the card root as `role="button"` with `tabIndex={0}`, `aria-label={clickLabel}`, and `cursor-pointer`.
- Call `onClick(id)` on left-click and on `Enter` or `Space` key press.
- Ensure that clicks on inner action buttons (`onRemove`, `onRetry`, download) do NOT propagate to the card-level `onClick`.

The interactive attributes are unconditional rather than gated on `onClick`: the tile is the primary affordance for its attachment in every surface that renders it, and toggling `role`/`tabIndex` per prop would make the same visual tile focusable in one list and skipped in another.

The `onClick` prop SHALL be independent of `onExpand`. When both are supplied, `onExpand` takes precedence for pasted-text cards (existing behaviour unchanged); `onClick` applies only when `onExpand` is not active.

#### Scenario: Card root is interactive

- **WHEN** `AttachmentCard` is rendered
- **THEN** the card root has `role="button"`, `tabIndex={0}`, and `cursor-pointer`
- **AND** the `aria-label` on the card root equals the `clickLabel` prop value

#### Scenario: The default label matches the tile variant

- **WHEN** `clickLabel` is omitted
- **THEN** a file tile is labelled `'Download attachment'` and an image or pasted tile `'Open attachment'`

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
- **THEN** clicking the card invokes `onExpand`, not `onClick`

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

1. If `attachment.url` or inline `attachment.data` is set, delegate to `downloadAttachment`, which downloads a DIAL file id through `resolveDownloadUrl` + `triggerAnchorDownload`, or builds a blob from inline base64 `data` and downloads it through `triggerBlobDownload`. A `url` that is set but is not a DIAL file id, with no `data`, resolves to no download.
2. Otherwise, if `attachment.referenceUrl` is set (a reference-only attachment — no `url`, e.g. a RAG/search-grounding chunk):
   - If the reference targets a PDF (optionally with a `#page=N` fragment), open the canvas with the resulting `PdfCanvasContent` via `openCanvas(content, attachment.name)`. A referenced page is expressed as a single transparent, zero-area highlight plus a matching `selectedHighlightId`, so the viewer scrolls to that page without painting anything over it.
   - Otherwise, download DIAL-hosted files through `resolveDownloadUrl` or open external URLs via `window.open(url, '_blank', 'noopener,noreferrer')`.
3. If neither `attachment.url`, `attachment.data`, nor `attachment.referenceUrl` is set, do nothing.

The module SHALL also export `downloadAttachment(attachment, resolveDownloadUrl): boolean` and `isDownloadableAttachment(attachment): boolean`, so callers can skip reference-only attachments without duplicating the DIAL-file-id and inline-data checks.

The hook SHALL be extensible: future handlers for different MIME types, attachment types, or metadata SHALL be addable by extending the routing logic inside `useAttachmentAction` without modifying callers.

The returned callback SHALL be stable across re-renders (wrapped in `useCallback` over `openCanvas` and `resolveDownloadUrl`).

#### Scenario: DIAL file attachment triggers a download

- **WHEN** `handleAttachmentClick` is called with an attachment whose `url` is `'files/my-bucket/folder/file.pdf'`
- **THEN** `triggerAnchorDownload` is called with the URL that `resolveDownloadUrl` returned and the attachment's name

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
