## ADDED Requirements

### Requirement: PDF citation preview navigates to the annotation's referenced page independent of highlight geometry

When opening a PDF citation or a reference-only PDF-page chip in the attachment canvas, the panel SHALL navigate to the page specified by the triggering annotation's/reference's page number, whether or not that page's bounding box is renderable as a visible highlight.

`PdfCanvasContent` (`libs/attachment-canvas/src/models/attachment-canvas.ts`) SHALL include an optional `page?: number` field — a 1-based page to navigate to on initial load, independent of `highlights`/`selectedHighlightId`.

`annotationToPdfCanvasContent` (`libs/chat-hooks/src/files/attachment-canvas.ts`) SHALL set `page` from the clicked annotation's own `body.selector` (single object or array), taking the first `pdf_bbox` entry with an integer `page >= 1`, skipping malformed entries and invalid pages; otherwise `page` is `undefined`. This selection SHALL use the exact annotation the caller passes in (the annotation the user clicked/selected within a grouped citation), never the group's `primaryAnnotation`, and SHALL NOT derive the page from `body.title` or any other display text.

`referenceAttachmentToPdfCanvasContent` (`libs/chat-hooks/src/files/attachment-canvas.ts`) SHALL likewise set `page` to the parsed page fragment when a reference-only PDF URL carries one (e.g. `files/{bucket}/report.pdf#page=81`).

`PdfContent` (`libs/attachment-canvas/src/components/PdfContent/PdfContent.tsx`) SHALL accept a `selectedPageNumber?: number` prop, forward it directly to the vendor `DocumentPreview`'s own `selectedPageNumber` prop, and prefer it over the highlight-bbox lookup when initialising and syncing its internal `selectedPage` state (which also drives the thumbnails panel's scroll position). `AttachmentCanvasBody` SHALL pass `content.page` as this prop when rendering `PdfCanvasContent`.

The mapper SHALL find the group by exact annotation membership, not source URL alone, and include highlights only from that group's annotations for the selected PDF. It SHALL omit a selected highlight ID when no generated highlight matches. Highlight generation SHALL ignore malformed selectors, invalid pages, and non-finite coordinates, while retaining valid zero-area boxes. Download behavior and non-PDF routing SHALL remain unchanged.

The wrapper SHALL NOT schedule its default-page-1 fallback when an explicit page or selected highlight is present. This prevents wrapper-originated resets; asynchronous vendor auto-zoom resets remain a diagnostic investigation, not a verified fix in this change.

**i18n**: none — no new user-visible strings.
**RTL**: none — no new UI; page navigation is an internal viewer scroll operation.
**Feature flag**: none.

#### Scenario: Citation with page 1 opens page 1

- **WHEN** the user clicks Preview for a PDF citation whose annotation has a `pdf_bbox` selector with `page: 1`
- **THEN** the canvas opens with `PdfCanvasContent.page === 1` and the viewer navigates to page 1

#### Scenario: Citation with page 3 opens page 3

- **WHEN** the user clicks Preview for a PDF citation whose annotation has a `pdf_bbox` selector with `page: 3`
- **THEN** the canvas opens with `PdfCanvasContent.page === 3` and the viewer navigates to page 3

#### Scenario: Navigation succeeds with an all-zero bounding box

- **WHEN** the clicked annotation's `pdf_bbox` selector has `x1: 0, y1: 0, x2: 0, y2: 0` and `page: 5`
- **THEN** `PdfCanvasContent.page` is `5` and the viewer navigates to page 5, even though no visible highlight rectangle is rendered for that annotation

#### Scenario: Valid non-zero bounding boxes still render as highlights

- **WHEN** the clicked annotation's `pdf_bbox` selector has non-zero coordinates
- **THEN** `PdfCanvasContent.highlights`/`selectedHighlightId` are populated exactly as before, and the highlight renders at its bounding box in addition to the viewer navigating to `page`

#### Scenario: Two citations for the same PDF at different pages open their respective pages

- **WHEN** the user previews one citation with `page: 2` and then, in the same canvas session, a second citation for the same source PDF with `page: 9`
- **THEN** each preview's `PdfCanvasContent.page` matches its own annotation's page, and the viewer navigates to page 2 then page 9 respectively

#### Scenario: A grouped citation opens the page of the currently selected annotation, not the group's primary annotation

- **WHEN** a citation group contains annotations for pages 2 and 7 of the same PDF, the group's `primaryAnnotation` is the page-2 entry, and the user has switched the popup to the page-7 annotation before clicking Preview
- **THEN** `annotationToPdfCanvasContent` is called with the page-7 annotation and returns `PdfCanvasContent.page === 7`

#### Scenario: Missing or invalid page data falls back to the existing default

- **WHEN** the clicked annotation has no `pdf_bbox` selector, or its `page` is missing, non-integer, or less than 1
- **THEN** `getAnnotationPdfPage` returns `undefined`, `PdfCanvasContent.page` is `undefined`, and the canvas falls back to the existing default behavior (page 1) without throwing

#### Scenario: Reference-only PDF-page reference also navigates independent of highlight geometry

- **WHEN** a reference-only attachment's `reference_url` is `files/{bucket}/report.pdf#page=81`
- **THEN** `referenceAttachmentToPdfCanvasContent` returns `PdfCanvasContent.page === 81` in addition to its existing zero-area invisible highlight, and the viewer navigates to page 81

#### Scenario: Non-PDF citations and plain PDF previews are unaffected

- **WHEN** an annotation's source attachment is not `application/pdf`, or a PDF is opened directly (not through a citation) with no page data
- **THEN** `PdfCanvasContent.page` is not set by this requirement's logic, and the existing preview/open behavior for that content type is unchanged

#### Scenario: Malformed entries precede a valid page

- **WHEN** body selectors contain null, a non-positive page, and then a valid `pdf_bbox` with page 7
- **THEN** page 7 is selected without throwing

#### Scenario: Separate markers share a PDF and a group includes another PDF

- **WHEN** a selected annotation belongs to the second cit group, both groups cite the same PDF, and its group also cites a different PDF
- **THEN** preview highlights come only from the selected group's matching PDF annotations, and the selected highlight exists when valid geometry is available

#### Scenario: Explicit page without a highlight survives wrapper readiness

- **WHEN** the viewer reports readiness for page 3 with no selected highlight
- **THEN** the wrapper does not schedule or invoke its page-1 fallback
