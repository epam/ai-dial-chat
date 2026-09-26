## Context

A citation carries its PDF page in one of two forms:

- **Reference-only attachment:** the page is a `#page=N` fragment on `reference_url`, for example `files/bucket/report.pdf#page=81`. `parsePdfPageReference` (`libs/quotations/src/utils/reference-attachment.ts:23-33`) parses it.
- **Citation annotation:** the page is the `page` of a `pdf_bbox`/`pdf_region` selector. `getAnnotationPdfPage` (`libs/quotations/src/utils/annotation.ts:264-277`) reads it.

The chat-response paths already honour both forms:

- The inline marker path is `annotationToPdfCanvasContent`, which sets `page` (`libs/chat-hooks/src/files/attachment-canvas.ts:508`).
- The reference-chip path is `handlePreviewReference` → `referenceAttachmentToPdfCanvasContent` (`attachment-canvas.ts:625-655`). It returns `{ page, highlights: [reference-page-N], selectedHighlightId }`.
- `PdfContent` (`libs/attachment-canvas/src/components/PdfContent/PdfContent.tsx:246-276`) opens at `selectedPageNumber`, falling back to the selected highlight's page.

The Sources panel loses the page on both paths:

- **Build step:** `useConversationSources` drops the annotation page, and deduplicates by bare file URL.
- **Click step:** `handleSourceClick` puts the URL in `DisplayAttachment.url`. That makes `useOpenAttachmentCanvas` skip its `referenceUrl` branch (`useOpenAttachmentCanvas.ts:192`). The generic `resolvePdfCanvasContent` then strips the fragment.

## Goals / Non-Goals

**Goals:**

- A PDF source opened from the Sources panel lands on its cited page, for both DIAL files and external PDFs.
- Every distinct cited page of a PDF is its own row in the Sources section.
- Reuse the existing page-reference resolver. Add no new canvas API and no lib model change.

**Non-Goals:**

- Markdown/text anchor, heading or line navigation.
- Restoring the exact bbox highlight from the Sources panel. Only the page is restored, through the invisible `reference-page-N` highlight the reference path already uses.
- Page navigation for PDFs whose URL lacks a `.pdf` extension.

## Decisions

### D1. Carry the page as a `#page=N` fragment on `QuotationSource.url`, not as a new field

Reference-only sources already arrive as `…pdf#page=N`, so annotation sources are normalized to that same form. As a result, one parser (`parsePdfPageReference`) serves both kinds of source.

- The panel's copy-link button copies a page-accurate URL. An external `…pdf#page=N` link pasted into a browser opens at that page in the native PDF viewer.
- `SourcesSection` keys its rows by `source.url` (`libs/source-panel/src/components/SourcesSection/SourcesSection.tsx:84`). A page-qualified URL is therefore a unique, stable key per row.

*Alternative:* add an optional `page?: number` to `QuotationSource`. This was rejected because it widens a published lib type and its README, and it duplicates information that reference sources already encode. Every host would also have to learn a second page channel.

### D2. Qualify annotation URLs only when safe

`useConversationSources` appends `#page=N` only when all three conditions hold:

- `getAnnotationPdfPage(annotation)` returns a page;
- `parsePdfPageReference(att.url)` matches, meaning the URL is a `.pdf` URL;
- that match has `page === null`, meaning no fragment is present yet.

A non-PDF URL, a URL that already has a fragment, or a URL without an extension is kept verbatim. This makes the rule idempotent and prevents an output like `x.pdf#page=3#page=3`. The `.pdf` condition also ensures that every qualified URL is one the click handler can route through D3.

Library isolation: this is pure derivation from the message shape. It uses only `@epam/ai-dial-quotations` helpers, which are already a declared dependency of `libs/chat-hooks`. No URL resolution, client, routing or host knowledge enters the lib.

### D3. Route page references through `referenceUrl` in the app container

In `handleSourceClick`, after the existing non-previewable early return:

```ts
const pageRef = parsePdfPageReference(url);
if (pageRef?.page != null) {
  const attachment: DisplayAttachment = {
    id: url, name: title, contentType: MIMEType.PDF,
    type: AttachmentType.File, status: RequestStatus.Idle,
    referenceUrl: url,               // url intentionally undefined
  };
  if (await openAttachmentCanvas(attachment)) { handleClose(); return; }
  if (isDialFileId(pageRef.baseUrl)) downloadAttachment({ ...attachment, url: pageRef.baseUrl, referenceUrl: undefined });
  else window.open(url, '_blank', 'noopener,noreferrer');
  return;
}
// …existing path unchanged
```

`useOpenAttachmentCanvas` then calls `resolvers.resolveReferencePdfContent`. The app wires it in `apps/chat/src/hooks/attachment/useAttachmentCanvasResolvers.ts:66-74` to `referenceAttachmentToPdfCanvasContent`, which returns `page` and `selectedHighlightId`. The page therefore travels through the standard commit, loading and `onBeforeOpen` flow.

*Alternative:* call `referenceAttachmentToPdfCanvasContent` and `openCanvas` directly, as `handlePreviewReference` does. This was rejected because it duplicates the canvas-open lifecycle that `openAttachmentCanvas` owns, and the panel would need a second canvas hook.

Every piece of page-routing knowledge stays in the app container. `libs/source-panel` only forwards the clicked `QuotationSource`.

### D4. Deduplicate by page-qualified URL

The existing shared `seenUrls` set now holds the page-qualified URL. No new data structure is needed. When a reference-only source (`doc.pdf#page=3`) and an annotation on the same file and page resolve to the same string, the first one wins, as before.

## Risks / Trade-offs

- **[More rows]** A Deep Research answer that cites one report on 10 pages now shows 10 rows instead of 1. → This is intended (confirmed by the product owner). Rows keep the same title, and the quote excerpt tells them apart.
- **[Hosts that parse `QuotationSource.url`]** An embedding host that string-compares source URLs may now see `#page=N` on annotation-derived PDF sources. → That form already appears for reference-only sources. The README will document it.
- **[Stale state if a PDF is already open]** Opening the same PDF at another page while the canvas shows it must still jump. → Not yet verified. Task 2.3 checks that each open commits its own `page` and that `PdfContent` honours a changed `selectedPageNumber`. If it does not, the fix is a small follow-up in `libs/attachment-canvas`, which would also benefit inline citations.
- **[Extensionless PDF URLs]** Annotation PDFs with opaque ids (no `.pdf`) still open at page 1. → This is out of scope and tracked as an open question.

## Migration Plan

No data or config migration. The change ships behind no flag. To roll back, revert `useConversationSources.ts` and `ConversationSourcesPanel.tsx`; nothing persisted depends on the new URL form.

## Open Questions

- Should page navigation also work for `application/pdf` sources whose URL has no `.pdf` extension? That would need a content-type-aware variant of `parsePdfPageReference`, shared with the inline reference path. Proposed as a follow-up.
- Should the Sources row show the page, for example "p. 12", so that same-title rows are easier to tell apart? That would add a new i18n string and a `source-panel` UI change, so it is proposed as a follow-up.
