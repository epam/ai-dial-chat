## ADDED Requirements

### Requirement: One PDF selector reader serves both highlight geometry and page navigation

`libs/quotations/src/utils/annotation.ts` SHALL expose a single internal reader that converts one `AnnotationSelector` to the highlighter's `{ page, x1, y1, x2, y2 }` box shape, or `undefined` when the selector is not a recognised PDF selector or fails validation. Both `annotationsToPdfHighlights` and `getAnnotationPdfPage` SHALL derive their result from that one reader, so the set of selector shapes that produce a highlight and the set that produce a page number are identical by construction.

The reader SHALL recognise three input shapes:

```ts
/* 1. pdf_bbox — absolute edges (existing) */
{ type: 'pdf_bbox', page: 1, x1: 58.752, y1: 383.328, x2: 550.8, y2: 412.632 }

/* 2. pdf_region — origin/size pair form */
{ type: 'pdf_region', page: 1, bbox: { lt: [58.752, 383.328], wh: [492.048, 29.304] } }

/* 3. pdf_region — legacy named-coordinate form */
{ type: 'pdf_region', page: 1, bbox: { left: 58.752, top: 383.328, width: 492.048, height: 29.304 } }
```

A `pdf_region` bbox SHALL convert to edges as `x1 = left`, `y1 = top`, `x2 = left + width`, `y2 = top + height`, where `left`/`top` come from `lt[0]`/`lt[1]` and `width`/`height` from `wh[0]`/`wh[1]` in the origin/size form. All three shapes above describe the same region and SHALL therefore produce the identical box.

When both coordinate forms are present on the same `bbox`, the reader SHALL prefer `lt`/`wh` and ignore the named fields, so a producer emitting both is read one way deterministically.

Validation SHALL be per selector and non-throwing: the reader SHALL reject a selector whose `page` is absent, non-integer, or `< 1`, and one whose four resulting coordinates are not all finite numbers. A zero-area box SHALL remain valid (it still carries a page). Rejecting one selector SHALL NOT discard the other selectors in the same array and SHALL NOT throw for `null`, a primitive, a missing `bbox`, a non-object `bbox`, a short or non-numeric `lt`/`wh` array, or an unrecognised `type`.

`annotationsToPdfHighlights` SHALL keep its current contract with the wider set of selector shapes: `body.selector` may be a single selector or an array; one annotation still yields at most one `InputHighlightData` whose `bboxes` collects every box the reader accepted from that annotation, in selector order; the highlight `id` is still `annotation.index` when present and the input position otherwise; `CITATION_HIGHLIGHT_STYLE` is unchanged; and an annotation contributing no accepted box still produces no highlight.

`getAnnotationPdfPage` SHALL return the `page` of the first selector the reader accepts, and `undefined` when it accepts none.

The original annotations SHALL NOT be mutated and the persisted message format SHALL NOT change — conversion happens only where PDF preview data is built, so a message saved with `pdf_region` selectors is reloaded and re-read the same way.

**i18n**: none — no new user-visible strings.
**RTL**: none — no new UI; the change is pure coordinate reading.
**Feature flag**: none — the new shapes are accepted unconditionally.
**Memoisation**: none beyond existing behavior; the reader is a pure function called from the existing mappers.
**Accessibility**: unchanged — highlight selection, keyboard navigation, and the viewer's own affordances are untouched.

#### Scenario: The three supplied coordinate forms produce the same highlight

- **WHEN** three annotations carry, respectively, `{ type: 'pdf_bbox', page: 1, x1: 58.752, y1: 383.328, x2: 550.8, y2: 412.632 }`, `{ type: 'pdf_region', page: 1, bbox: { lt: [58.752, 383.328], wh: [492.048, 29.304] } }`, and `{ type: 'pdf_region', page: 1, bbox: { left: 58.752, top: 383.328, width: 492.048, height: 29.304 } }`
- **THEN** `annotationsToPdfHighlights` returns one highlight per annotation, each with a single bbox equal to `{ page: 1, x1: 58.752, y1: 383.328, x2: 550.8, y2: 412.632 }`, and `getAnnotationPdfPage` returns `1` for all three

#### Scenario: A scalar pdf_region selector produces a highlight and a page

- **WHEN** an annotation's `body.selector` is a single `pdf_region` object with `page: 4` and a valid `lt`/`wh` bbox
- **THEN** `annotationsToPdfHighlights` returns one highlight with one bbox on page 4 and `getAnnotationPdfPage` returns `4`

#### Scenario: A mixed selector array collects every box on one highlight

- **WHEN** one annotation's `body.selector` array holds a `pdf_bbox` entry on page 2, a `pdf_region` `lt`/`wh` entry on page 5, and a `text_character_range` entry
- **THEN** the annotation yields exactly one highlight whose `bboxes` are the page-2 and page-5 boxes in that order, the `text_character_range` entry is ignored, and `getAnnotationPdfPage` returns `2`

#### Scenario: A malformed region does not discard its valid siblings

- **WHEN** a selector array holds `{ type: 'pdf_region', page: 1, bbox: { lt: [1], wh: [2, 3] } }`, `{ type: 'pdf_region', page: 0, bbox: { left: 0, top: 0, width: 1, height: 1 } }`, `null`, and then a valid `pdf_region` entry on page 6
- **THEN** no error is thrown, the first three entries are skipped, the highlight carries only the page-6 box, and `getAnnotationPdfPage` returns `6`

#### Scenario: A region with a non-finite coordinate is rejected

- **WHEN** a `pdf_region` selector's `wh` contains `NaN`, or its `bbox` is absent or not an object
- **THEN** the reader rejects that selector, it contributes no bbox, and it is not considered for the page

#### Scenario: A zero-size region still navigates

- **WHEN** a `pdf_region` selector on page 5 has `wh: [0, 0]`
- **THEN** the box `{ page: 5, x1, y1, x2: x1, y2: y1 }` is produced and `getAnnotationPdfPage` returns `5`, matching the existing all-zero `pdf_bbox` behavior

#### Scenario: A quote-only citation gets no fabricated highlight

- **WHEN** an annotation has a `body.quote` and a PDF source attachment but no `body.selector`
- **THEN** `annotationsToPdfHighlights` produces no highlight for it, `getAnnotationPdfPage` returns `undefined`, and the PDF opens unhighlighted at the viewer's default page

#### Scenario: Both coordinate forms on one bbox resolve deterministically

- **WHEN** a `pdf_region` bbox carries `lt`/`wh` and `left`/`top`/`width`/`height` with conflicting values
- **THEN** the reader uses `lt`/`wh` and ignores the named fields

#### Scenario: Existing pdf_bbox annotations are unaffected

- **WHEN** every selector on a message is `pdf_bbox`, including entries with all-zero coordinates, a missing page, or a non-integer page
- **THEN** the highlights, highlight IDs, styling, and selected page are identical to the behavior before this change

## MODIFIED Requirements

### Requirement: PDF citation preview navigates to the annotation's referenced page independent of highlight geometry

When opening a PDF citation or a reference-only PDF-page chip in the attachment canvas, the panel SHALL navigate to the page specified by the triggering annotation's/reference's page number, whether or not that page's bounding box is renderable as a visible highlight.

`PdfCanvasContent` (`libs/attachment-canvas/src/models/attachment-canvas.ts`) SHALL include an optional `page?: number` field — a 1-based page to navigate to on initial load, independent of `highlights`/`selectedHighlightId`.

`annotationToPdfCanvasContent` (`libs/chat-hooks/src/files/attachment-canvas.ts`) SHALL set `page` from the clicked annotation's own `body.selector` (single object or array), taking the page of the first entry the PDF selector reader accepts — a `pdf_bbox` or a `pdf_region` selector with an integer `page >= 1` and finite geometry — skipping malformed entries and invalid pages; otherwise `page` is `undefined`. This selection SHALL use the exact annotation the caller passes in (the annotation the user clicked/selected within a grouped citation), never the group's `primaryAnnotation`, and SHALL NOT derive the page from `body.title` or any other display text.

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

#### Scenario: Citation with a pdf_region selector opens its page and highlights its region

- **WHEN** the user clicks Preview for a PDF citation whose annotation has `{ type: 'pdf_region', page: 1, bbox: { lt: [58.752, 383.328], wh: [492.048, 29.304] } }`
- **THEN** the canvas opens with `PdfCanvasContent.page === 1`, `highlights` carrying the converted box `{ page: 1, x1: 58.752, y1: 383.328, x2: 550.8, y2: 412.632 }`, and `selectedHighlightId` set to that annotation's highlight, so the viewer scrolls to the cited location

#### Scenario: A previously saved pdf_region message previews correctly on reload

- **GIVEN** a persisted assistant message whose `custom_content.annotations` carry `pdf_region` body selectors with their coordinates present
- **WHEN** the conversation is reloaded and the user clicks one of its citations
- **THEN** the preview highlights and page are the same as they would be for the equivalent `pdf_bbox` selectors, with no change to the stored message

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

- **WHEN** the clicked annotation has no recognised PDF selector, or every such selector's `page` is missing, non-integer, or less than 1
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
