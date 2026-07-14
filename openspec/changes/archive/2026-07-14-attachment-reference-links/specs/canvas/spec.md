## ADDED Requirements

### Requirement: Reference-only PDF-page attachments are routed to the canvas ahead of normal content-type routing

`useOpenAttachmentCanvas`'s `openFileCanvas` SHALL, before its MIME-type/extension routing table, check whether `attachment.url == null && attachment.referenceUrl != null`. When true, it SHALL call `referenceAttachmentToPdfCanvasContent({ type: attachment.contentType, url: attachment.referenceUrl, title: attachment.name })`. If that returns non-`null`, it SHALL open the canvas with the returned `PdfCanvasContent` and return `true` immediately, without falling through to the MIME-type/extension switch below. If it returns `null` (the `referenceUrl` does not target a PDF), normal content-type routing proceeds unchanged.

This applies to every surface that renders a `DisplayAttachment` via `useOpenAttachmentCanvas`, including `CollapsedGroup` stage attachments (`ConversationMessageItem.tsx` → `onAttachmentClick`) and the plain attachment tray, so a reference-only PDF-page chunk (e.g. `reference_url: 'files/{bucket}/report.pdf#page=81'`, `data`/`type` describing an unrelated OCR text chunk) opens the actual referenced PDF at the referenced page instead of rendering its `data` as Markdown.

#### Scenario: Reference-only PDF-page attachment opens the PDF canvas, not the Markdown canvas

- **WHEN** `openAttachmentCanvas` is called with a `DisplayAttachment` whose `url` is `undefined`, `referenceUrl` is `'files/{bucket}/report.pdf#page=81'`, and `contentType` is `'text/markdown'` (inherited from the chunk's own data format)
- **THEN** the canvas opens with a `PdfCanvasContent` for `report.pdf` scrolled to page 81, and `resolveMarkdownCanvasContent` is never called

#### Scenario: Reference-only non-PDF attachment falls through to normal routing

- **WHEN** `openAttachmentCanvas` is called with a `DisplayAttachment` whose `url` is `undefined` and `referenceUrl` is `'files/{bucket}/notes.md'`
- **THEN** `referenceAttachmentToPdfCanvasContent` returns `null` and the existing MIME-type/extension routing (Markdown resolver) proceeds unchanged
