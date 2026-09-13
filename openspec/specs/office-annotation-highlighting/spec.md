# office-annotation-highlighting Specification

## Purpose

Office (DOCX/PPTX/XLSX) citation location resolution and highlight rendering: selector typing and normalisation, annotation-to-canvas mapping, OOXML layout resolution against the displayed parse, overlay rendering and navigation, graceful fallback, viewer lifecycle, geometry invalidation, accessibility, RTL geometry exemptions, and performance.

## Requirements


### Requirement: Host-agnostic Office highlight descriptors

`libs/attachment-canvas/src/models/attachment-canvas.ts` SHALL export the descriptor types the host passes in, expressed purely in **document** coordinates — never in pixels, never in DIAL terms:

```ts
interface OoxmlDocxHighlightLocation {
  kind: OoxmlHighlightKind.DocxTextRange;
  story: string;
  path: number[];
  /** Inclusive start character offset within the story. */
  start: number;
  /** Exclusive end character offset — already exclusive on the wire (confirmed against captured fixtures), renamed here for clarity rather than converted. */
  endExclusive: number;
  /** Selector text, used to validate the resolved range before a highlight is shown. */
  text: string;
}

interface OoxmlPptxHighlightLocation {
  kind: OoxmlHighlightKind.PptxTextRange;
  /** 1-based slide number. */
  slide: number;
  shapeId: string;
  start: number;
  endExclusive: number;
  text: string;
}

interface OoxmlXlsxHighlightLocation {
  kind: OoxmlHighlightKind.XlsxCellRange;
  sheet: string;
  /** 1-based, matching `@silurus/ooxml`'s own `CellAddress`. */
  start: { row: number; col: number };
  /** Omitted for a single cell. */
  end?: { row: number; col: number };
}

interface OoxmlHighlight {
  /** Stable id used to mark exactly one highlight selected. */
  id: string;
  /** One or more locations; a single selector may resolve to several. */
  locations: OoxmlHighlightLocation[];
}
```

`OoxmlHighlightKind` SHALL be a string enum (`DocxTextRange = 'docxTextRange'`, `PptxTextRange = 'pptxTextRange'`, `XlsxCellRange = 'xlsxCellRange'`), following the repository's enum-over-union rule, and SHALL be a value export from the library's public entry point so the host can name its members.

The library SHALL receive DOCX/PPTX offsets already in their exclusive-upper-bound form, named `endExclusive` rather than `end` so the boundary convention is unambiguous at the type level. `libs/quotations` cannot depend on this library's types (see the `message-annotations` capability's normalisation requirement and its scope note) — `libs/chat-hooks`, which depends on both, is the layer that assigns `OoxmlHighlightKind` and produces these descriptors.

Every type reachable through `OoxmlCanvasContent` SHALL be exported from `libs/attachment-canvas/src/index.ts` and documented in its `README.md`.

**State ownership**: none — data contract only.
**Adapter contract**: the host resolves the file URL (`AttachmentCanvasUrlResolvers.resolveDialFileDownloadUrl` / `resolveDialUrl`, already injected into `libs/chat-hooks`) and passes a plain URL plus these descriptors. No DIAL file id, bucket, `/api` path, MIME string, auth token, or fetch function crosses into `libs/attachment-canvas`.
**i18n**: none.
**RTL**: none — types only.
**Feature flag**: none.
**Memoisation**: none.
**Telemetry**: none.

#### Scenario: Descriptors carry no host knowledge

- **WHEN** an `OoxmlHighlight` value is constructed
- **THEN** it contains no URL path, bucket, file id, MIME type, or callback — only document coordinates and an id

#### Scenario: Kind enum is a value export

- **WHEN** `apps/chat` or `libs/chat-hooks` imports `OoxmlHighlightKind` from `@epam/ai-dial-attachment-canvas`
- **THEN** the import resolves and `OoxmlHighlightKind.DocxTextRange` equals `'docxTextRange'`

#### Scenario: One highlight can carry several locations

- **WHEN** an annotation's `body.selector` is an array of two valid DOCX selectors
- **THEN** the resulting single `OoxmlHighlight` has `locations.length === 2` and one `id`

---

### Requirement: Selector validation and normalisation in `libs/quotations`

`libs/quotations/src/utils/annotation.ts` SHALL export `annotationToOfficeHighlightLocations`, a normaliser that converts an `Annotation` into `OfficeHighlightLocation[]` (`libs/quotations/src/models/office-highlight.ts`), and SHALL export the three named type guards required by the "Office range selector discriminators are confirmed by a captured fixture" requirement of the `message-annotations` capability.

`OfficeHighlightLocation` SHALL be owned by `libs/quotations`, discriminated by a `type` field carrying the wire's own confirmed literal (`'docx_text_range'`, `'pptx_text_range'`, `'excel_rc_range'`) — **not** `@epam/ai-dial-attachment-canvas`'s `OoxmlHighlightKind`. `libs/quotations` SHALL NOT import from `libs/attachment-canvas`: that lib already depends on `libs/quotations` for the PDF highlight path (`annotationsToPdfHighlights`), and a dependency in the other direction would be circular. `libs/chat-hooks`, which depends on both libs, SHALL be the layer that maps `OfficeHighlightLocation[]` into `OoxmlHighlight[]`/`OoxmlHighlightLocation[]`, assigning the `OoxmlHighlightKind` enum value per location (see the "`annotationToOoxmlCanvasContent` maps a citation to canvas content" requirement below).

Normalisation SHALL:

- Accept `body.selector` as either a single selector or an array, reusing the existing array/scalar handling already present for `pdf_bbox`.
- Convert each valid selector to its corresponding location descriptor. For `docx_text_range`/`pptx_text_range`, copy the wire's already-exclusive `end` through **unchanged** into `endExclusive` — a rename, not an `end + 1` conversion (see the `message-annotations` capability's offset requirement). For `excel_rc_range`, `end` stays the inclusive last-cell address, unaffected by that rename.
- Skip — never throw on — any selector that is absent, of an unrecognised type, structurally incomplete, or numerically invalid (`start`/`end` non-integer, `start < 0`, `end < start`; `slide < 1`; `row < 1` or `col < 1`; empty `sheet`; `path` not an array of integers; `text` not a string for DOCX/PPTX).
- Reject an XLSX `end` that is not on the same row as `start` (`end.row !== start.row`), and reject `end.col < start.col`. A multi-row or reversed range yields no location rather than a wrong one.
- Treat `end: null` and an omitted `end` identically as a single-cell range.
- Return an empty result — not a partial or guessed one — when no selector in the array is valid.

Normalisation SHALL be a pure function over `Annotation` values, with no fetch, no DOM access, and no host imports.

**State ownership**: none — pure function.
**i18n**: none.
**RTL**: none.
**Feature flag**: none.
**Memoisation**: callers that derive highlights during render SHALL memoise on the annotation list identity, matching how `ConversationMessageItem` already memoises `groupAnnotations` with `useMemo`.
**Telemetry**: none.

#### Scenario: A valid DOCX selector normalises with endExclusive equal to the wire's end

- **WHEN** normalisation receives `{ type: 'docx_text_range', story: 'body', path: [1, 0], start: 4, end: 9, text: 'cited' }`
- **THEN** the result is one `OfficeHighlightLocation` with `type: 'docx_text_range'`, `start: 4`, `endExclusive: 9`, `story: 'body'`, and `path: [1, 0]`

#### Scenario: A selector array mixing valid and invalid entries keeps only the valid ones

- **WHEN** `body.selector` is an array of one valid PPTX selector and one selector with `slide: 0`
- **THEN** the result contains exactly one location with `type: 'pptx_text_range'`

#### Scenario: An XLSX multi-row range is rejected

- **WHEN** a selector has `start: { row: 2, col: 1 }` and `end: { row: 5, col: 3 }`
- **THEN** normalisation returns no location for that selector

#### Scenario: An XLSX same-row range is accepted

- **WHEN** a selector has `sheet: 'Q3'`, `start: { row: 14, col: 3 }`, `end: { row: 14, col: 6 }`
- **THEN** the result is one location with `type: 'excel_rc_range'` spanning columns 3 to 6 on row 14

#### Scenario: `end: null` is a single cell

- **WHEN** a selector has `start: { row: 14, col: 3 }` and `end: null`
- **THEN** the result is one location with `type: 'excel_rc_range'` and `end` omitted

#### Scenario: An annotation with no selector produces no locations

- **WHEN** `body.selector` is `undefined`
- **THEN** normalisation returns an empty result without throwing

---

### Requirement: Annotations are gathered by source attachment identity, not display title

`libs/quotations` SHALL export a helper that, given the clicked annotation and the full annotation list for the message, returns every annotation whose `body.source.attachment.url` **equals the clicked annotation's own** `body.source.attachment.url`, preserving input order.

Identity SHALL be the source attachment URL. A display title SHALL NOT be used, alone or as a fallback, because two different files can carry the same `title` — grouping on it would render one document's highlights over another's.

This helper SHALL operate on the message's whole annotation list rather than on a single `AnnotationGroup`. `groupAnnotationsByCitId` scopes a group to one `cit` id, so annotations behind other markers that cite the same file are not reachable from one group; gathering across the list is what makes "include annotations belonging to the same source document" true for `html_tag` citations as well as offset-based ones.

The clicked annotation SHALL be identified within the returned list by reference identity, so its highlight can be marked selected. When the clicked annotation is not present in the supplied list, the result SHALL be the clicked annotation alone.

**State ownership**: none — pure function.
**i18n**: none.
**RTL**: none.
**Feature flag**: none.
**Memoisation**: none required of the helper itself; call sites memoise as described above.
**Telemetry**: none.

#### Scenario: Two files with identical titles never merge

- **WHEN** the message has two annotations with `title: 'report.docx'` but URLs `files/a/report.docx` and `files/b/report.docx`, and the user previews the first
- **THEN** only the first annotation is returned, and the second document's locations are absent from the result

#### Scenario: Same-source annotations behind different `cit` markers are gathered together

- **WHEN** the message has three `html_tag` annotations with distinct `cit` ids, two of which cite `files/a/contract.docx`, and the user previews one of those two
- **THEN** both annotations citing `files/a/contract.docx` are returned and the third is excluded

#### Scenario: The clicked annotation is identifiable in the result

- **WHEN** four annotations cite the same URL and the user previews the third
- **THEN** the result contains all four in their original order and the third is identified by reference identity

---

### Requirement: `annotationToOoxmlCanvasContent` maps a citation to canvas content

`libs/chat-hooks/src/files/attachment-canvas.ts` SHALL export `annotationToOoxmlCanvasContent(annotation, annotations, resolvers)` returning `OoxmlCanvasContent | null`, as a direct sibling of the existing `annotationToPdfCanvasContent` and following its structure.

It SHALL:

- Return `null` when the annotation has no source attachment, or when the source's MIME type / URL extension does not resolve to `OoxmlFileType.Docx`, `Xlsx`, or `Pptx`. It SHALL return `null` for CSV, so CSV keeps its current plain preview.
- Resolve the file URL through the injected resolvers — `resolveDialFileDownloadUrl` for a DIAL file id (`isDialFileId`), otherwise the source URL as-is — mirroring `annotationToPdfCanvasContent`. It SHALL return `null` when no URL resolves.
- Gather same-source annotations per the requirement above, call `libs/quotations`'s `annotationToOfficeHighlightLocations` per annotation, and build one `OoxmlHighlight` per annotation that yields at least one location — translating each `OfficeHighlightLocation` into `OoxmlHighlightLocation` by assigning the matching `OoxmlHighlightKind` value (this translation is this mapper's responsibility; see the `message-annotations` capability's normalisation requirement) — dropping annotations that yield none.
- Set `selectedHighlightId` to the clicked annotation's highlight id, and SHALL omit `selectedHighlightId` when the clicked annotation produced no highlight — never silently selecting a different annotation's highlight.
- Derive highlight ids the same way the PDF path does, reusing `annotationHighlightId` (`annotation.index` when present, otherwise the position within the gathered list) so ids stay stable and comparable.
- Return content with `highlights` omitted (not an empty array) when no annotation yields a location, so the renderer takes its existing non-highlight path unchanged.

The mapper SHALL remain a pure function of its arguments plus the injected resolvers, with no fetch and no DOM access.

**State ownership**: none — pure mapper. The canvas's open state stays with the existing `useOpenAttachmentCanvas` / canvas context.
**Adapter contract**: `AttachmentCanvasUrlResolvers`, already injected by `apps/chat`. No new host coupling.
**i18n**: none.
**RTL**: none.
**Feature flag**: none.
**Memoisation**: the `apps/chat` call site SHALL keep its existing `useCallback` wrapping of the preview handler.
**Telemetry**: none.

#### Scenario: A DOCX citation produces highlights and a selected id

- **WHEN** the user previews a DOCX citation whose annotation carries one valid DOCX selector
- **THEN** the result is `{ type: Ooxml, url, format: Docx, highlights: [...], selectedHighlightId }` with the selected id present in `highlights`

#### Scenario: A CSV source returns null

- **WHEN** the annotation's source is a `.csv` file
- **THEN** the mapper returns `null` and the existing plain-attachment path handles it

#### Scenario: An unresolvable selector yields content with no highlights

- **WHEN** the annotation's only selector is malformed
- **THEN** the result carries `url` and `format` with `highlights` and `selectedHighlightId` both `undefined`

#### Scenario: Selected id is omitted when the clicked annotation resolves to nothing

- **WHEN** two annotations cite one file, the clicked one's selector is malformed, and the other's is valid
- **THEN** `highlights` contains the other annotation's highlight and `selectedHighlightId` is `undefined`

#### Scenario: A DIAL file id is resolved through the injected resolver

- **WHEN** the source URL is a DIAL `files/…` id
- **THEN** `resolveDialFileDownloadUrl` supplies `url`, and returning `undefined` from it makes the mapper return `null`

---

### Requirement: DOCX text ranges resolve from the displayed parse

`libs/attachment-canvas` SHALL resolve a `DocxTextRange` location to rectangles using `DocxDocument.collectPageRuns(pageIndex, { width })` on **the same `DocxDocument` instance** the active `DocxScrollViewer` was created from via `DocxScrollViewer.fromDocument`.

Resolution SHALL:

- Match a run only when **both** `run.source.story === location.story` **and** `run.source.path` is element-wise equal to `location.path`. Matching on story alone is insufficient — the same story contains many paragraphs.
- **Exclude synthesized runs**: any run whose `source` is `undefined`, or whose `sourceRunIndex` is `undefined`, does not correspond to source document text (page numbers, generated field results, list bullets) and SHALL NOT contribute to a highlight or to offset accounting.
- Accumulate matched runs' `text` in layout order to form the resolved text, tracking each run's character span, so a range crossing several runs is covered.
- For a run only partially covered by `[start, endExclusive)`, compute the partial rectangle from **rendered font metrics** — measuring the run's own `font` via a canvas measurement context — rather than by linear interpolation on character count, so proportional fonts land correctly. `letterSpacingPx` SHALL be included when present.
- Prefer `run.highlightBounds` over `x`/`y`/`w`/`h` when it is present, since it is the vendor's own highlight geometry for that run.
- **Merge adjacent rectangles on the same visual line** — rectangles whose vertical extents coincide within a small tolerance and which touch or overlap horizontally SHALL become one rectangle, so a multi-run sentence renders as one band rather than a row of boxes.
- Produce one rectangle group per page when a range spans a page boundary.
- Skip a run whose `transform` is set, since a transformed run's axis-aligned rectangle would be wrong.

`collectPageRuns` SHALL be called with the same `width` the viewer renders at, so returned coordinates are already in the page's CSS pixel space and no second scaling pass is applied to them.

**State ownership**: the engine instance and the resolved rectangles are owned by the `OoxmlContent` renderer, in refs and state respectively.
**i18n**: none.
**RTL**: `run.direction` is reported per run; resolution SHALL use the run's own reported geometry rather than assuming left-to-right, and the resulting rectangles are physical canvas geometry (see the RTL requirement below).
**Feature flag**: none.
**Memoisation**: resolution SHALL run in an effect keyed on the locations, the scale, and the page range — not on every render.
**Telemetry**: none.

#### Scenario: Story matches but path differs

- **WHEN** a location targets `story: 'body', path: [3, 1]` and the page also contains runs with `story: 'body', path: [4, 0]`
- **THEN** only runs whose path equals `[3, 1]` contribute rectangles

#### Scenario: Synthesized runs are excluded from offsets

- **WHEN** a page's runs include a header page-number run with no `source`
- **THEN** that run contributes neither a rectangle nor any character offset, and the resolved text is unaffected by it

#### Scenario: A partial run is measured, not interpolated

- **WHEN** a range covers the first 3 characters of a 10-character proportional-font run
- **THEN** the rectangle's width comes from measuring those 3 characters in the run's own font, and does not equal three tenths of the run width for a font where those characters are not exactly three tenths wide

#### Scenario: Adjacent same-line rectangles merge

- **WHEN** a range spans three consecutive runs rendered on one visual line
- **THEN** one merged rectangle is produced for that line, not three

#### Scenario: A range spanning two lines produces two rectangles

- **WHEN** a range wraps across a line break
- **THEN** two rectangles are produced, one per visual line, and they are not merged

---

### Requirement: PPTX text ranges resolve by slide and shape id

`libs/attachment-canvas` SHALL resolve a `PptxTextRange` location using `PptxPresentation.collectSlideRuns(slideIndex, width)` on the same `PptxPresentation` instance the active `PptxScrollViewer` was created from via `PptxScrollViewer.fromPresentation`.

Resolution SHALL:

- Convert the 1-based `location.slide` to the vendor's 0-based `slideIndex` exactly once, and reject a slide outside `[1, presentation.slideCount]`.
- Match a run only when `String(run.shapeId) === location.shapeId`, comparing as strings because the wire type is a string while the run field is optional.
- Exclude runs with no `shapeId`, and exclude runs whose `origin` indicates they do not come from the slide's own source text.
- Compute absolute rectangles by composing the shape's own position with the run's shape-relative offsets (`shapeX + inShapeX`, `shapeY + inShapeY`).
- Skip a run whose `rotation`, `textBodyRotation`, `shapeFlipH`, or `shapeFlipV` indicates a rotated or flipped shape, producing no highlight for that location rather than a misplaced rectangle. This is a documented non-goal, not a defect.
- Apply the same partial-run font measurement and same-line merging rules as DOCX.

**State ownership**: as for DOCX — engine in a ref, rectangles in state, owned by the renderer.
**i18n**: none.
**RTL**: physical canvas geometry; see the RTL requirement.
**Feature flag**: none.
**Memoisation**: as for DOCX.
**Telemetry**: none.

#### Scenario: Slide number is 1-based on the wire

- **WHEN** a location has `slide: 1`
- **THEN** runs are collected for the presentation's first slide

#### Scenario: Shape id is compared as a string

- **WHEN** a location has `shapeId: '7'` and the matching run reports a `shapeId` that stringifies to `'7'`
- **THEN** the run matches

#### Scenario: A non-matching shape on the right slide contributes nothing

- **WHEN** the target slide contains runs for shapes `'7'` and `'9'` and the location targets `'7'`
- **THEN** only shape `'7'`'s runs contribute rectangles

#### Scenario: A rotated shape produces no highlight

- **WHEN** the matched shape reports a non-zero `rotation`
- **THEN** no rectangle is produced for that location and the slide still renders and scrolls normally

#### Scenario: An out-of-range slide is rejected

- **WHEN** a location targets `slide: 99` in a 10-slide deck
- **THEN** no rectangle is produced and no error is surfaced to the user

---

### Requirement: XLSX cell and same-row ranges resolve through the viewer's cell geometry

`libs/attachment-canvas` SHALL resolve an `XlsxCellRange` location through the viewer's own geometry API rather than by computing grid arithmetic.

Resolution SHALL:

- Find the sheet by **name**, matching `location.sheet` against `viewer.sheetNames`, and SHALL produce no highlight when the name is absent. Matching SHALL be exact; no case-insensitive or trimmed fallback is defined.
- Call `goToSheet(index)` when the target sheet is not the active `sheetIndex`, and await it before measuring.
- Call `scrollToCell` for the starting cell before measuring, so an offscreen cell has a viewport rectangle at all. `align: 'center'` SHALL be used for the selected highlight so the cited cell is not flush against a viewport edge.
- Obtain each cell's rectangle from `getCellViewportRect`, which accepts a 1-based `CellAddress`. Selector `row`/`col` are already 1-based and SHALL be passed through **without conversion**; `getCellViewportRect` itself rejects `row < 1 || col < 1`.
- Treat a `null` return from `getCellViewportRect` as "not currently measurable" and produce no rectangle for that cell, rather than substituting a zero rectangle.
- For a same-row range, measure each column from `start.col` to `end.col` and merge the results into one rectangle spanning the row, since they are adjacent by construction.
- **Recompute geometry** after any of: viewport scroll (`onViewportChange`), zoom (`onScaleChange`), sheet change (`onSheetChange`), container resize, or a change of the selected highlight. Rectangles returned by `getCellViewportRect` are viewport-relative and become stale on all five.
- Handle a range **wider than the visible viewport** by clipping the merged rectangle to the grid viewport bounds and keeping the starting cell in view. The highlight SHALL remain anchored at `start.col` rather than re-centring on the range's midpoint, so the cited cell stays visible; the clipped edge SHALL NOT be drawn as a closed border implying the range ends there.

**State ownership**: the active sheet is the viewer's own state; the renderer owns only the derived rectangles and the pending-recompute flag.
**i18n**: none.
**RTL**: `getCellViewportRect` already returns viewport-relative geometry with the engine's own horizontal mapping applied. The renderer SHALL use the returned `x` verbatim and SHALL NOT mirror it.
**Feature flag**: none.
**Memoisation**: recomputation SHALL be scheduled through a single coalescing frame callback so a scroll burst produces one recompute per frame, not one per event.
**Telemetry**: none.

#### Scenario: A named sheet that is not active is switched to

- **WHEN** a location targets sheet `'Q3'` while sheet `'Summary'` is active
- **THEN** `goToSheet` is called for `'Q3'`'s index and awaited before any rectangle is measured

#### Scenario: An unknown sheet name yields no highlight

- **WHEN** a location targets sheet `'Q5'` and the workbook has no such sheet
- **THEN** no rectangle is produced, the workbook still opens, and no error state is shown

#### Scenario: An offscreen cell is scrolled into view before measuring

- **WHEN** a location targets a cell far below the current viewport
- **THEN** `scrollToCell` runs first and the subsequent `getCellViewportRect` returns a rectangle rather than `null`

#### Scenario: Selector coordinates are passed through unconverted

- **WHEN** a location has `start: { row: 14, col: 3 }`
- **THEN** `getCellViewportRect` receives `{ row: 14, col: 3 }` unchanged

#### Scenario: A same-row range merges into one rectangle

- **WHEN** a location spans row 14, columns 3 through 6
- **THEN** one rectangle covering all four cells is produced

#### Scenario: Geometry is recomputed after scrolling

- **WHEN** the user scrolls the grid after a highlight has been drawn
- **THEN** `onViewportChange` triggers a recompute and the highlight stays over its cell

#### Scenario: Geometry is recomputed after a sheet change

- **WHEN** the user switches to another sheet and back
- **THEN** the highlight is absent on the other sheet and correctly positioned again on return

#### Scenario: A range wider than the viewport stays anchored at its start

- **WHEN** a same-row range spans more columns than fit on screen
- **THEN** the starting cell remains visible and the drawn rectangle is clipped to the viewport without a closed border at the clip edge

---

### Requirement: Highlights render as an overlay with exactly one selected

`OoxmlContent` SHALL render resolved rectangles in an overlay positioned above the viewer's canvases and below no interactive control, and SHALL mark exactly one highlight selected.

The overlay SHALL:

- Be non-interactive (`pointer-events: none`) so text selection, hyperlink clicks, cell selection, and scrolling continue to work through it.
- Render every highlight in `content.highlights`, not only the selected one, so a reader sees each cited passage from that document — matching what the PDF path does, where `PdfContent` receives all of the group's highlights and only `selectedHighlightId` is emphasised.
- Distinguish the selected highlight visually from the unselected ones by more than one channel, so the distinction survives a colour-vision deficiency.
- Reuse the citation highlight's existing visual language — the PDF path's `CITATION_HIGHLIGHT_STYLE` is a transparent fill with a 2px `--stroke-accent` border — so an Office highlight and a PDF highlight read as the same feature.
- Expose highlight colours as themeable CSS custom properties through the existing `AttachmentCanvasColors` mechanism, following `libs/*` styling rules: no hardcoded hex in the component, `buildCssVars` mapping, and one interface field per var the stylesheet reads.
- Be removed entirely when `content.highlights` is absent or resolves to no rectangles.

Navigation SHALL scroll the selected highlight's location into view on initial load and whenever `selectedHighlightId` changes: `scrollToPage` for DOCX, `scrollToSlide` for PPTX, and the sheet-switch-plus-`scrollToCell` sequence for XLSX. Navigation SHALL happen even when the location resolves to **no rectangle** — the user is still taken to the right page, slide, or sheet, which mirrors the PDF requirement that page navigation is independent of highlight geometry.

**State ownership**: `OoxmlContent` owns the resolved-rectangle state and the engine/viewer refs. No new context is introduced; the canvas's own open/content state stays where it already lives.
**i18n**: the overlay's region label — see the accessibility requirement.
**RTL**: see the RTL requirement.
**Feature flag**: none.
**Memoisation**: rectangle resolution runs in effects keyed on locations/scale/page-range; the overlay's rectangle list SHALL be derived state, not recomputed inline on every render.
**Telemetry**: none.

#### Scenario: All same-source highlights render with one selected

- **WHEN** content carries three highlights and `selectedHighlightId` names the second
- **THEN** all three render and only the second carries the selected treatment

#### Scenario: The overlay does not block interaction

- **WHEN** the user selects text under a highlight, or clicks a cell under one
- **THEN** the interaction reaches the viewer and behaves as it does without highlights

#### Scenario: Navigation happens without a rectangle

- **WHEN** the selected location names a valid page but resolves to no rectangle
- **THEN** the viewer still scrolls to that page and no highlight is drawn

#### Scenario: Changing the selected highlight re-navigates

- **WHEN** `selectedHighlightId` changes to a highlight on another page
- **THEN** the viewer scrolls to that page and the selected treatment moves

#### Scenario: No highlights means no overlay

- **WHEN** `content.highlights` is `undefined`
- **THEN** no overlay element is rendered

---

### Requirement: Unresolvable locations degrade gracefully and never search by quote

When a selector is missing, of an unsupported family, structurally ambiguous, malformed, out of range, or cannot be resolved to geometry, the document SHALL open normally with no highlight, and the failure SHALL NOT surface as the renderer's error state — that state is reserved for a parse/render failure, and showing it here would tell the user the file is broken when it is not.

Resolved DOCX and PPTX text SHALL be validated before a highlight is shown: the resolved text sliced by `[start, endExclusive)` SHALL equal the location's `text`. On a mismatch, no highlight SHALL be drawn for that location. Navigation to the page or slide MAY still occur, since the location's page reference is independent of its text.

The implementation SHALL NOT fall back to searching the document for the selector's `text` or the annotation's `quote`. `findText` is available on every viewer, but a quote occurring more than once gives no deterministic way to choose the right occurrence, so a quote-search fallback would silently point the user at the wrong passage. Such a fallback is permitted only behind a deterministic, independently testable matching policy, and no such policy is defined by this change.

**State ownership**: none beyond the renderer's existing loading/error state, which is unchanged.
**i18n**: none — no new message is shown, because no failure is reported to the user.
**RTL**: none.
**Feature flag**: none.
**Memoisation**: none.
**Telemetry**: none. A resolution mismatch is expected when a document has been edited since the citation was produced, so it is not an error signal worth emitting.

#### Scenario: Text mismatch suppresses the highlight but keeps the preview

- **WHEN** the resolved DOCX text over the range does not equal the selector's `text`
- **THEN** no highlight is drawn, the document renders normally, and the error overlay is not shown

#### Scenario: An out-of-range offset is not treated as a render failure

- **WHEN** a selector's `endExclusive` exceeds the resolved text length
- **THEN** no highlight is drawn and the document remains usable

#### Scenario: No quote search occurs on failure

- **WHEN** a location fails to resolve and the annotation carries a `quote`
- **THEN** no `findText` call is made and no highlight appears

#### Scenario: An unsupported selector family opens the document plainly

- **WHEN** the annotation's only selector is `text_character_range`, which addresses message text rather than a document location
- **THEN** the Office document opens with no highlight

---

### Requirement: Viewer and engine lifecycle is disposed on replacement and unmount

`OoxmlContent` SHALL tear down completely when the document changes or the component unmounts, extending its existing `disposed`-flag effect rather than replacing it.

Teardown SHALL:

- Destroy the viewer, then destroy the engine it borrowed. Because `fromDocument` / `fromPresentation` deliberately leave a borrowed engine alive on `viewer.destroy()`, failing to destroy the engine leaks a parsed document and its worker. The renderer SHALL own that second `destroy()` call.
- Clear the container's children and remove the overlay, so no stale rectangles survive into the next document.
- Guard every asynchronous continuation — engine load, `collectPageRuns` / `collectSlideRuns`, `goToSheet`, `scrollToCell`, measurement — so a result arriving after disposal is discarded and no state update occurs after unmount. The existing `disposed` local flag pattern SHALL be extended to the new async work, not duplicated with a second mechanism.
- Cancel any pending coalescing frame callback or observer used for geometry invalidation.

When highlights are **not** requested, acquisition SHALL remain the current self-loading path (`new Viewer(container, opts)` then `viewer.load(url)`), whose teardown is a single `viewer.destroy()` because the viewer owns its engine. The two acquisition modes are mutually exclusive and SHALL NOT be mixed for one document.

**State ownership**: the renderer, via refs for the viewer and engine and a disposal flag per effect run.
**i18n**: none.
**RTL**: none.
**Feature flag**: none.
**Memoisation**: none.
**Telemetry**: none.

#### Scenario: Borrowed engine is destroyed alongside the viewer

- **WHEN** a highlighted document is replaced by another
- **THEN** both the previous viewer and the previous engine are destroyed

#### Scenario: A late async result after unmount updates nothing

- **WHEN** the component unmounts while run collection is still in flight
- **THEN** the resolved result is discarded and no state update or React warning occurs

#### Scenario: Stale overlays do not survive a document change

- **WHEN** a document with highlights is replaced by one without
- **THEN** no rectangle from the previous document remains rendered

#### Scenario: Non-highlighted previews keep single-owner teardown

- **WHEN** content has no highlights
- **THEN** the viewer self-loads and teardown is the viewer's own `destroy()` with no separate engine to release

---

### Requirement: Highlight geometry survives resize, refit, zoom, and navigation

Rectangles SHALL be invalidated and recomputed whenever the mapping from document coordinates to CSS pixels changes.

For DOCX and PPTX, the scale is the invalidation signal: the renderer SHALL subscribe to `onScaleChange` and recompute rectangles for the affected pages/slides, and SHALL observe the container so a resize-driven refit (`refitOnResize`, on by default in the current renderer) is also caught. Page-window changes SHALL be tracked through `onVisiblePageChange` / `onVisibleSlideChange` so a highlight on a page scrolled into view is resolved when it becomes visible rather than only at load.

Page and slide offsets in the scroll host's coordinate space SHALL be derived from the vendor's own published geometry inputs — the page or slide size, the current scale, and the configured `gap` / padding — in **one** function, so the single place that encodes this relationship is testable and reviewable. That relationship is verified against the installed build but is not part of the vendor's documented public contract; the design records this explicitly as a version-coupling risk.

For XLSX, invalidation is driven by `onViewportChange`, `onScaleChange`, and `onSheetChange` as specified in the XLSX requirement.

Recomputation SHALL be coalesced through a single animation-frame callback so a continuous gesture — wheel zoom, drag-scroll — produces at most one recompute per frame.

**State ownership**: the renderer.
**i18n**: none.
**RTL**: none.
**Feature flag**: none.
**Memoisation**: coalescing is required as stated; subscriptions SHALL be established once per document, not per render.
**Telemetry**: none.

#### Scenario: Zooming keeps the highlight over its text

- **WHEN** the user zooms a highlighted DOCX
- **THEN** `onScaleChange` triggers a recompute and the rectangle still covers the cited text

#### Scenario: Resizing the panel keeps the highlight aligned

- **WHEN** the canvas panel is resized, causing a refit
- **THEN** rectangles are recomputed and stay aligned

#### Scenario: A highlight on a later page resolves when scrolled to

- **WHEN** a highlight targets a page outside the initially mounted window and the user scrolls to it
- **THEN** its rectangle is resolved and drawn

#### Scenario: A zoom gesture coalesces recomputes

- **WHEN** a continuous zoom gesture fires many scale changes within one frame
- **THEN** at most one recompute runs per frame

---

### Requirement: Highlight overlay is accessible

The overlay is purely visual and conveys location, which a screen-reader user cannot perceive from a canvas. The following SHALL apply.

- The overlay container SHALL be a labelled region: `role="region"` with an `aria-label` supplied by the host through the existing labels mechanism, defaulting in the library to the English string `'Cited locations'`. Individual rectangles are decorative and SHALL be `aria-hidden`, since a rectangle carries no independent meaning.
- Bringing the cited location into view SHALL be announced through a polite live region (`role="status"`, `aria-live="polite"`), because scrolling a canvas produces no announcement of its own and the user otherwise receives no confirmation that Preview did anything. The announcement SHALL fire when navigation completes for the selected highlight, and SHALL NOT re-fire on scroll, zoom, or resize.
- The overlay SHALL NOT be focusable and SHALL NOT enter the tab order — it is not an interactive control, and adding stops between the document and the panel's real controls would harm keyboard navigation. Existing keyboard interaction with the viewer (text selection, cell selection, scrolling) SHALL be unaffected, which the `pointer-events: none` overlay guarantees.
- While the document is loading and resolution is in flight, the existing `aria-busy` on the viewer container SHALL continue to convey that state; no separate busy signal is added.
- A resolution failure SHALL NOT be announced, consistent with the graceful-degradation requirement that it is not reported to the user at all.
- Highlight border and fill colours SHALL preserve the contrast of the underlying document text: the selected treatment SHALL NOT rely on a fill that reduces the text's contrast below the repository's AAA target, which the transparent-fill-plus-border style inherited from the PDF path already satisfies.

**i18n keys** — added to `apps/chat/src/i18n/locales/en.json` and `AttachmentCanvasI18nKeys` in `apps/chat/src/constants/translation-keys.ts`, following the existing `attachmentCanvas.*` convention:

- `attachmentCanvas.ooxmlHighlightsLabel` = `"Cited locations"` → `AttachmentCanvasI18nKeys.OoxmlHighlightsLabel`
- `attachmentCanvas.ooxmlHighlightNavigatedLabel` = `"Scrolled to the cited location"` → `AttachmentCanvasI18nKeys.OoxmlHighlightNavigatedLabel`

Both SHALL be threaded as optional fields on `AttachmentCanvasLabels` with English defaults, forwarded through `AttachmentCanvasBodyLabels` to `OoxmlContent`. A label declared on the parent but not forwarded would leave the child on its hardcoded default, so both SHALL be wired end to end.

**State ownership**: the renderer owns the announcement string.
**RTL**: see the RTL requirement.
**Feature flag**: none.
**Memoisation**: none.
**Telemetry**: none.

#### Scenario: Overlay is a labelled region with decorative children

- **WHEN** highlights render
- **THEN** the overlay is a `region` with the accessible name from `ooxmlHighlightsLabel`, and each rectangle is `aria-hidden`

#### Scenario: Navigation is announced once

- **WHEN** the canvas opens and scrolls to the selected citation
- **THEN** a polite status announces it once, and scrolling or zooming afterwards does not repeat it

#### Scenario: The overlay adds no tab stops

- **WHEN** the user tabs through the canvas panel
- **THEN** focus moves between the panel's real controls and never onto the overlay or a rectangle

#### Scenario: Labels reach the renderer

- **WHEN** the host supplies both new labels on `AttachmentCanvas`
- **THEN** the values appear on the overlay region and in the announcement, rather than the library's English defaults

---

### Requirement: Highlight geometry is intentionally physical and must not be mirrored

Highlight rectangles SHALL be treated as canvas geometry rather than as directional layout: `left` and `top` describe positions inside a rendered page, slide, or grid whose own layout the vendor already resolved, including for right-to-left content (`DocxTextRunInfo.direction` is reported per run, and `getCellViewportRect` applies the engine's own horizontal mapping).

Therefore the overlay's rectangle positioning SHALL use **physical** `left` / `top` (or an equivalent transform) and SHALL NOT be converted to `inset-inline-start` or any other logical property, and SHALL NOT be flipped under `dir="rtl"`. Mirroring them would move every highlight off its text in Arabic while leaving it correct in English. This SHALL be recorded as an intentional, commented exemption at the code site, so a later RTL sweep does not "fix" it.

All surrounding UI SHALL continue to follow the repository's RTL rules: the overlay container's own non-geometric styling, and any control or label added alongside it, use logical properties, and no new directional icon is introduced.

**i18n**: covered above.
**Feature flag**: none.
**Memoisation**: none.
**Telemetry**: none.

#### Scenario: Highlights stay on their text in an RTL locale

- **WHEN** the app is in Arabic with `dir="rtl"` and a highlighted DOCX is opened
- **THEN** rectangles are positioned by physical offsets and cover the same text they cover in English

#### Scenario: The exemption is documented at the code site

- **WHEN** the rectangle positioning code is reviewed
- **THEN** a comment states that the physical offsets are canvas geometry and must not be mirrored

---

### Requirement: One parse per document and no eager cross-format loading

Opening a highlighted Office document SHALL parse it **once**. The resolver SHALL NOT construct its own engine alongside the viewer's; it SHALL read from the engine the viewer was created from.

The existing lazy per-format loading SHALL be preserved: opening a DOCX SHALL dynamically import only the DOCX entry point (plus the shared `chart-ex` renderer, as today), and SHALL NOT pull in the PPTX or XLSX entry point. Highlight resolution code SHALL sit behind the same dynamic boundary as the format it serves, so a plain non-Office preview does not pay for it.

Resolution SHALL be bounded to what is displayed or navigated to: runs SHALL be collected per page or slide for pages that carry a highlight or become visible, and SHALL NOT be collected for the whole document up front.

**State ownership**: none new.
**i18n**: none.
**RTL**: none.
**Feature flag**: none.
**Memoisation**: collected runs per page/slide MAY be cached for the document's lifetime and SHALL be discarded on teardown.
**Telemetry**: none.

#### Scenario: A highlighted DOCX parses once

- **WHEN** a DOCX opens with highlights
- **THEN** exactly one engine load occurs and the viewer is created from that engine

#### Scenario: Opening a DOCX does not load other format renderers

- **WHEN** a DOCX opens with highlights
- **THEN** the PPTX and XLSX entry points are not imported

#### Scenario: Runs are not collected for the whole document

- **WHEN** a 200-page DOCX opens with one highlight on page 3
- **THEN** run collection covers the highlighted and visible pages, not all 200
