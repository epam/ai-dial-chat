## ADDED Requirements

### Requirement: Citation highlight ids identify the annotation, not its position in the clicked group

`libs/quotations/src/utils/annotation.ts` SHALL derive every citation highlight id from the annotation's own identity, so that two different citations of the same document never collapse onto one id. `annotationHighlightId(annotation, fallbackIndex)` and `annotationsToPdfHighlights` SHALL both call one shared internal helper, so the id a highlight carries and the id computed for the clicked annotation are identical by construction.

The id SHALL be resolved in this order:

1. `String(annotation.index)` when the wire supplied an `index` — it is already unique within the message and keeps ids short and stable.
2. Otherwise an identity-derived id built from the annotation's `target.selector.id` when its selector is `html_tag` (the `cit` id) **and** a digest of the annotation's `body.selector` entries (single object or array), covering the PDF shapes (`pdf_bbox`, `pdf_region`) and the Office shapes (`docx_text_range`, `pptx_text_range`, `excel_rc_range`, `docx_text_anchor`, `pptx_text_anchor`). Two annotations differing in either part SHALL receive different ids; two annotations agreeing in both describe the same cited region and MAY share one.
3. Otherwise `String(fallbackIndex)` — the annotation's position in the input list, as today.

The id SHALL be an opaque, deterministic string: derived only from the annotation's own fields, stable across re-renders of the same message, never persisted, and never sent over the wire. Callers SHALL NOT parse it or infer a page, an order, or an index from it.

Highlight **scope** is unchanged by this requirement: `annotationToPdfCanvasContent` still passes only the clicked citation group's same-document annotations, and `annotationToOoxmlCanvasContent` still gathers same-source annotations across the message.

**State ownership**: none — pure functions in `libs/quotations`; the canvas's open state stays with `useOpenAttachmentCanvas` / the canvas context.
**Adapter contract**: none — no host or external knowledge enters `libs/quotations`.
**i18n**: none — no user-visible strings.
**RTL**: none — no UI surface; ids are opaque strings.
**Feature flag**: none — the new formula applies unconditionally.
**Memoisation**: none beyond existing behavior; the helper is pure and called from the existing mappers, which stay `useCallback`-wrapped at their `apps/chat` call site.
**Accessibility**: unchanged.
**Telemetry**: none.

#### Scenario: Two `cit` citations of the same PDF page get different ids

- **WHEN** a message carries two `html_tag` citations with distinct `cit` ids, both citing `files/bucket/report.pdf` with a `pdf_bbox` selector on page 4 — one near the top of the page, one near the bottom — and neither annotation carries an `index`
- **THEN** `annotationToPdfCanvasContent` returns a different `selectedHighlightId` for each of them

#### Scenario: The clicked annotation's id is present in the highlights it ships with

- **WHEN** any citation is previewed and its annotation yields at least one accepted box
- **THEN** `selectedHighlightId` equals the `id` of one of the returned `highlights`, and is `undefined` when the clicked annotation yielded no highlight

#### Scenario: A wire-supplied index still wins

- **WHEN** an annotation carries `index: 7`
- **THEN** its highlight id is `'7'`, both from `annotationsToPdfHighlights` and from `annotationHighlightId`

#### Scenario: Two Office ranges under one `cit` id stay distinct

- **WHEN** two annotations share one `cit` id, cite the same DOCX, and carry different `docx_text_range` selectors, and neither carries an `index`
- **THEN** `annotationToOoxmlCanvasContent` returns two highlights with different ids, and `selectedHighlightId` names the clicked one

#### Scenario: The id is a stable function of the annotation

- **WHEN** the same annotation object is mapped twice within one message
- **THEN** both calls produce the same id, and no id is derived from anything outside that annotation's own fields

### Requirement: Selecting another citation on the same PDF page re-navigates the preview

Selecting a different citation of the same PDF while the canvas is already open SHALL bring the newly selected citation into view, including when both citations sit on the **same** page. Because `PdfContent` drives the viewer declaratively — the vendor re-issues `goToHighlight` only when `selectedHighlightId` changes and `setPage` only when `page` changes — the content the canvas is opened with SHALL differ from the previous content in `selectedHighlightId` whenever the reader selected a different citation. A same-page selection SHALL NOT rely on `page` changing.

Re-opening the **same** citation SHALL remain a no-op for navigation: an unchanged `selectedHighlightId` with an unchanged `page` is the existing "nothing to navigate to" case, consistent with the OOXML path's one-shot-per-selection rule.

**i18n**: none.
**RTL**: none — vertical scrolling of the preview is direction-agnostic.
**Feature flag**: none.
**Accessibility**: unchanged — the viewer's own focus and keyboard behavior are untouched.

#### Scenario: Switching between a top-of-page and a bottom-of-page citation scrolls

- **WHEN** the reader previews a citation at the top of page 4 of a PDF whose page is taller than the preview viewport, and then previews a second citation at the bottom of that same page
- **THEN** the canvas receives content whose `selectedHighlightId` differs from the first, so the viewer navigates to the second citation's bounding box instead of leaving the viewport where it was

#### Scenario: Cross-page navigation keeps working

- **WHEN** the reader switches between two citations on different pages of one PDF
- **THEN** both `page` and `selectedHighlightId` differ and the viewer navigates to the newly selected citation

#### Scenario: Re-previewing the same citation does not re-navigate

- **WHEN** the reader previews the citation that is already selected in the open canvas
- **THEN** `selectedHighlightId` and `page` are unchanged and the preview stays where the reader left it

## MODIFIED Requirements

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

`annotationsToPdfHighlights` SHALL keep its current contract with the wider set of selector shapes: `body.selector` may be a single selector or an array; one annotation still yields at most one `InputHighlightData` whose `bboxes` collects every box the reader accepted from that annotation, in selector order; the highlight `id` is derived by the shared annotation-identity helper described in the "Citation highlight ids identify the annotation, not its position in the clicked group" requirement (no longer the input position); `CITATION_HIGHLIGHT_STYLE` is unchanged; and an annotation contributing no accepted box still produces no highlight.

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

#### Scenario: Existing pdf_bbox annotations keep their geometry and page

- **WHEN** every selector on a message is `pdf_bbox`, including entries with all-zero coordinates, a missing page, or a non-integer page
- **THEN** the highlight geometry, styling, and selected page are identical to the behavior before this change, and the highlight ids are whatever the annotation-identity helper produces — equal to `annotation.index` when the wire supplied one
