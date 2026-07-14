## MODIFIED Requirements

### Requirement: `useAttachmentAction` hook resolves and triggers the correct action per attachment

`apps/chat/src/hooks/attachment/useAttachmentAction.ts` SHALL export `useAttachmentAction()` returning a stable callback `handleAttachmentClick: (attachment: DisplayAttachment) => void`.

When `handleAttachmentClick` is called with an attachment:

1. If `attachment.url` is set: if it is a DIAL file ID (starts with `files/`), resolve the BFF download URL via `resolveDialFileDownloadUrl` and trigger a browser download by programmatically clicking a temporary `<a>` element with `href` set to the resolved URL and the `download` attribute set to `attachment.name`. If `attachment.url` is set but is not a DIAL file ID, do nothing.
2. Otherwise, if `attachment.referenceUrl` is set (a reference-only attachment — no `url`, e.g. a RAG/search-grounding chunk):
   - If `referenceAttachmentToPdfCanvasContent` (built from `{ type: attachment.contentType, url: attachment.referenceUrl, title: attachment.name }`) returns non-`null` (the reference targets a PDF, optionally with a `#page=N` fragment), open the canvas with that content via `openCanvas(content, attachment.name)`.
   - Otherwise, call `openAnnotationAttachment({ type: attachment.contentType, url: attachment.referenceUrl, title: attachment.name })`, which downloads DIAL-hosted files or opens external URLs via `window.open`.
3. If neither `attachment.url` nor `attachment.referenceUrl` is set, do nothing.

The hook SHALL be extensible: future handlers for different MIME types, attachment types, or metadata SHALL be addable by extending the routing logic inside `useAttachmentAction` without modifying callers.

The returned callback SHALL be stable across re-renders (wrapped in `useCallback`, with `openCanvas` as its only dependency).

#### Scenario: DIAL file attachment triggers a download

- **WHEN** `handleAttachmentClick` is called with an attachment whose `url` is `'files/my-bucket/folder/file.pdf'`
- **THEN** a temporary anchor with `href` equal to the resolved BFF URL and `download` set to `attachment.name` is clicked programmatically

#### Scenario: Attachment without a DIAL file URL or referenceUrl is a no-op

- **WHEN** `handleAttachmentClick` is called with an attachment whose `url` is `undefined` or an absolute external URL, and `referenceUrl` is also `undefined`
- **THEN** no anchor is created, no canvas is opened, and no navigation occurs

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
