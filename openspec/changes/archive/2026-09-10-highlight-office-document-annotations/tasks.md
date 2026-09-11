# Tasks — Highlight Office document annotations

## Slicing strategy

**Risk-first.** The riskiest layer is OOXML geometry resolution: it depends on vendor behaviour that is only partly in the public type surface (page offsets, run coordinate space), and it is the one part that cannot be validated by reading code. Slices 2–4 prove it per format against real fixture documents, behind a prop nothing yet passes, before slices 5–7 widen the wire types and wire the app.

This ordering means a geometry dead end is discovered while only `libs/attachment-canvas` has changed, instead of after four libs and a backend DTO have moved.

Slice 1 is a blocking prerequisite. Slices 2, 3, and 4 are independent of each other once slice 1 lands and may proceed in any order or in parallel. Slices 5→6→7 are strictly sequential. Slice 8 is documentation and closes the change.

Each slice ends with `npm run verify:changed`. `npm run build:quiet` appears only where bundling can change. Exactly one `npm run verify:full` closes the change, in slice 8.

---

## 1. Prerequisite — capture the upstream selector fixture

**Blocks every other slice.** The DOCX and PPTX `type` discriminator strings are not established by the available contract, and `.claude/rules`/`AGENTS.md` forbid inventing them.

- [x] 1.1 Capture a real `dial-document` response containing at least one DOCX, one PPTX, and one XLSX citation. Save the raw annotation payloads as test fixtures at `libs/quotations/src/utils/tests/fixtures/office-selectors.json`.
- [x] 1.2 Record the two confirmed discriminator strings in `design.md` §Open questions, replacing question 1 with the answer.
- [x] 1.3 If the fixture cannot be obtained, stop and escalate rather than proceeding — structural guards are acceptable as an interim implementation detail but not as the shipped contract.

**UNBLOCKED** (2026-09-10): three real `dial-document` responses were captured, one per format, and saved to `libs/quotations/src/utils/tests/fixtures/office-selectors.json`. Confirmed discriminators: DOCX = `docx_text_range`, PPTX = `pptx_text_range`, XLSX = `excel_rc_range` (reconfirmed). **Additional finding, not anticipated by the original design**: the captured DOCX/PPTX samples show `end` is already **exclusive** on the wire (`end - start === text.length` in every sample, verified computationally), contradicting design.md D3's original inclusive assumption. D3 and the Open Questions section were corrected in the same pass — normalisation (task 5.5) must copy `end` through as `endExclusive` unchanged, **not** apply `+ 1`. `excel_rc_range`'s cell-address `end` is unaffected (still inclusive, still the last cell).

**Verification**: none — no code changes in this slice.

---

## 2. Slice — DOCX geometry resolution (highest risk, proved first)

Introduces the geometry utilities and the shared-parse acquisition path. Nothing passes highlights yet, so no user-visible behaviour changes.

- [x] 2.1 Add `OoxmlHighlightKind` to `libs/attachment-canvas/src/types/attachment-canvas.ts` as a string enum (`DocxTextRange`, `PptxTextRange`, `XlsxCellRange`), per the repository's enum-over-union rule.
- [x] 2.2 Add the highlight descriptor types (`OoxmlDocxHighlightLocation`, `OoxmlPptxHighlightLocation`, `OoxmlXlsxHighlightLocation`, `OoxmlHighlightLocation`, `OoxmlHighlight`) to `libs/attachment-canvas/src/models/attachment-canvas.ts`, with JSDoc on every exported symbol and every property. Name the DOCX/PPTX upper bound `endExclusive`, documenting that the wire's inclusive `end` was already converted.
- [x] 2.3 Add `highlights?: OoxmlHighlight[]` and `selectedHighlightId?: string` to `OoxmlCanvasContent`. Document that an empty array is not used to mean "none" — the field is omitted.
- [x] 2.4 Export every new type and the enum from `libs/attachment-canvas/src/index.ts` (enum as a value export).
- [x] 2.5 Create `libs/attachment-canvas/src/utils/ooxml-highlight-geometry.ts` with: the single page/slide-offset function (page size × 1.3333 × scale, plus configured `gap`/padding — the only place this relationship is encoded); partial-run width measurement using a canvas measurement context and the run's own `font` and `letterSpacingPx`; and same-visual-line rectangle merging with a vertical tolerance.
- [x] 2.6 Add DOCX run-matching and range-to-rectangle resolution to the same file: match on `source.story` **and** element-wise `source.path`; exclude runs with no `source` or no `sourceRunIndex`; skip runs with a `transform`; prefer `highlightBounds` over `x`/`y`/`w`/`h`; accumulate matched-run text with per-run spans; validate `resolvedText.slice(start, endExclusive) === location.text` before emitting rectangles.
- [x] 2.7 In `libs/attachment-canvas/src/components/OoxmlContent/OoxmlContent.tsx`, branch acquisition on whether highlights are present: with highlights and `format: Docx`, use `DocxDocument.load(url, opts)` then `DocxScrollViewer.fromDocument(container, document, opts)`; without highlights, keep the existing `new DocxScrollViewer(...)` + `load(url)` path verbatim. Keep `chart-ex`, `enableTextSelection`, `refitOnResize`, and `onError` in both modes.
- [x] 2.8 Extend the existing teardown to destroy the viewer, then the borrowed engine, then clear the container — `from*()` viewers deliberately leave the engine alive. Extend the existing `disposed` flag to guard engine load, run collection, and measurement; do not add a second cancellation mechanism.
- [x] 2.9 Add the overlay: an absolutely-positioned, `pointer-events: none`, `role="region"` container with rectangles as `aria-hidden` children, rendered only when rectangles exist. Position rectangles with physical `left`/`top` and add the comment stating this is canvas geometry that must not be mirrored in RTL.
- [x] 2.10 Add resolution and navigation effects keyed on `[locations, scale, visiblePageRange]` and `[selectedHighlightId]`; wire `onScaleChange` and `onVisiblePageChange` into one `requestAnimationFrame`-coalesced recompute; cancel the pending frame on teardown. `scrollToPage` runs even when the location resolves to no rectangle.
- [x] 2.11 Add highlight colour vars to `AttachmentCanvasColors` and `OoxmlContent.module.scss` via `buildCssVars`, one interface field per var the stylesheet reads, in both directions. No hardcoded hex in the component. Distinguish selected from unselected on two channels (border weight and opacity), not colour alone.

**Verification**
```sh
npm run test:file -- libs/attachment-canvas/src/utils/tests/ooxml-highlight-geometry.spec.ts
npm run test:file -- libs/attachment-canvas/src/components/OoxmlContent/tests/OoxmlContent.spec.tsx
npm run verify:changed
npm run build:quiet
```

### 2.12 Tests — DOCX resolution and geometry

- [x] Story matches but `path` differs → only the matching path contributes rectangles.
- [x] A run with no `source` (header page number) contributes neither a rectangle nor any character offset.
- [x] A run with no `sourceRunIndex` is likewise excluded.
- [x] A partial run's width comes from font measurement, not linear character-count interpolation (assert against a measured width, not a proportion).
- [x] Three consecutive runs on one visual line merge into one rectangle.
- [x] A range wrapping across a line break yields two rectangles and they do not merge.
- [x] A range spanning a page boundary yields one rectangle group per page.
- [x] A run with a `transform` is skipped.
- [x] `resolvedText.slice` mismatch against `location.text` → no rectangle, no error state, document still renders.
- [x] `endExclusive` beyond the resolved text length → no rectangle, no throw.
- [x] Page-offset function: known page size and scale produce the expected offset, including the configured `gap` and `paddingTop`.
- [x] Scale is not applied twice: run coordinates returned at a given render width are used as-is.

### 2.13 Tests — acquisition and lifecycle

- [x] With highlights, a `DocxDocument` is loaded and the viewer is created from that instance (assert one engine load, not two).
- [x] Without highlights, the viewer self-loads via `load(url)` and no separate engine is created.
- [x] On document replacement, viewer `destroy()` and engine `destroy()` are both called, in that order.
- [x] Unmount mid-`collectPageRuns` discards the result: no state update, no React warning.
- [x] Replacing a highlighted document with a non-highlighted one leaves no rectangle from the previous document.
- [x] A pending coalesced frame callback is cancelled on teardown.
- [x] The overlay is absent when `highlights` is `undefined`.
- [x] Rendering three highlights with the second selected marks exactly one selected (query by role/label, not by class).

---

## 3. Slice — PPTX geometry resolution

Independent of slice 2 once slice 1 lands; reuses slice 2's shared utilities, so sequence it after 2 if the same person does both.

- [x] 3.1 Add PPTX run matching and resolution to `libs/attachment-canvas/src/utils/ooxml-highlight-geometry.ts`: convert 1-based `slide` to the vendor's 0-based index exactly once; reject slides outside `[1, slideCount]`; match `String(run.shapeId) === location.shapeId`; exclude runs with no `shapeId` and runs whose `origin` is not slide source text; compose absolute position as `shapeX + inShapeX` / `shapeY + inShapeY`; skip runs whose `rotation`, `textBodyRotation`, `shapeFlipH`, or `shapeFlipV` indicates rotation or flipping; reuse the partial-run measurement and same-line merging from 2.5; validate resolved text against `location.text`.
- [x] 3.2 Add the `format: Pptx` shared-parse branch to `OoxmlContent`: `PptxPresentation.load(url, opts)` then `PptxScrollViewer.fromPresentation(container, presentation, opts)`, with the same ordered viewer-then-engine teardown.
- [x] 3.3 Wire `onVisibleSlideChange` and `onScaleChange` into the shared coalesced recompute; navigate with `scrollToSlide`, which runs even when no rectangle resolves.

**Verification**
```sh
npm run test:file -- libs/attachment-canvas/src/utils/tests/ooxml-highlight-geometry.spec.ts
npm run test:file -- libs/attachment-canvas/src/components/OoxmlContent/tests/OoxmlContent.spec.tsx
npm run verify:changed
```

### 3.4 Tests — PPTX resolution

- [x] `slide: 1` collects runs for the presentation's first slide (proves the 1-based→0-based conversion happens once).
- [x] `shapeId: '7'` matches a run whose `shapeId` stringifies to `'7'`.
- [x] On the correct slide, a non-matching shape contributes no rectangle.
- [x] A run with no `shapeId` is excluded.
- [x] A partial run inside a shape is measured, not interpolated.
- [x] A rotated shape (non-zero `rotation`) yields no rectangle, and the slide still renders and scrolls.
- [x] A flipped shape (`shapeFlipH`) yields no rectangle.
- [x] `slide: 99` in a 10-slide deck yields no rectangle and no error surfaced to the user.
- [x] Text mismatch yields no rectangle but the deck still renders.
- [x] Viewer and borrowed presentation are both destroyed on replacement.

---

## 4. Slice — XLSX cell and range resolution

Independent of slices 2 and 3. XLSX keeps the self-loading viewer path — cell geometry is on the viewer, so no engine access is needed.

- [x] 4.1 Add XLSX resolution to `libs/attachment-canvas/src/utils/ooxml-highlight-geometry.ts`: exact sheet-name match against `viewer.sheetNames`; pass selector `row`/`col` to `getCellViewportRect` **unconverted** (both are 1-based; `getCellViewportRect` itself rejects `row < 1 || col < 1`); treat a `null` return as not-measurable and emit no rectangle rather than a zero rectangle; merge a same-row column span into one rectangle; clip a range wider than the viewport to the grid bounds, keeping the rectangle anchored at `start.col` and not drawing a closed border at the clip edge.
- [x] 4.2 In `OoxmlContent`, add the XLSX navigation sequence: `goToSheet(index)` when the target sheet is not active, awaited, then `scrollToCell(startRef, { align: 'center' })`, then measure.
- [x] 4.3 Wire `onViewportChange`, `onScaleChange`, and `onSheetChange` into the shared coalesced recompute — all three invalidate viewport-relative rectangles.

**Verification**
```sh
npm run test:file -- libs/attachment-canvas/src/utils/tests/ooxml-highlight-geometry.spec.ts
npm run test:file -- libs/attachment-canvas/src/components/OoxmlContent/tests/OoxmlContent.spec.tsx
npm run verify:changed
```

### 4.4 Tests — XLSX resolution

- [x] A target sheet that is not active triggers `goToSheet` for its index, awaited before any measurement.
- [x] An unknown sheet name yields no rectangle, the workbook still opens, and no error state appears.
- [x] Sheet matching is exact — a name differing only in case does not match.
- [x] An offscreen cell is scrolled into view first, and the subsequent `getCellViewportRect` returns a rectangle rather than `null`.
- [x] `start: { row: 14, col: 3 }` reaches `getCellViewportRect` unchanged.
- [x] A same-row range over columns 3–6 merges into one rectangle.
- [x] `getCellViewportRect` returning `null` yields no rectangle — assert no zero-size rectangle is rendered.
- [x] Scrolling the grid triggers `onViewportChange` and the rectangle is recomputed.
- [x] Zooming triggers `onScaleChange` and the rectangle is recomputed.
- [x] Switching sheets removes the highlight, and switching back restores it correctly positioned.
- [x] A range wider than the viewport keeps the starting cell visible and clips without a closed border at the clip edge.

---

## 5. Slice — wire types and selector normalisation

With geometry proven, widen the types that carry selectors to it.

- [x] 5.1 Add `DocxRangeSelector`, `PptxRangeSelector`, and `ExcelRcRangeSelector` to `libs/chat-shared/src/models/annotation.ts`, with JSDoc on every property. Type `story` as an opaque `string` (only `'body'` is confirmed — no closed enum), `shape_id` as `string`, and `end` on the Excel selector as optional **and** nullable. Declare no `storyInstance`.
- [x] 5.2 Extend the `AnnotationSelector` union with all three, leaving the open `{ type: string; [key: string]: unknown }` branch in place. Note in the new selectors' docs that, unlike `TextCharacterRangeSelector`'s inclusive `end`, `DocxRangeSelector`/`PptxRangeSelector`'s `end` is already exclusive on the wire (confirmed against captured fixtures — see design.md D3).
- [x] 5.3 Export the three types from `libs/chat-shared/src/index.ts`.
- [x] 5.4 Add `isDocxRangeSelector`, `isPptxRangeSelector`, and `isExcelRcRangeSelector` to `libs/quotations/src/utils/annotation.ts`. Match `excel_rc_range` by its confirmed literal; identify DOCX (`docx_text_range`) and PPTX (`pptx_text_range`) by the confirmed discriminator strings from task 1.2, requiring the full field set so a partially-shaped `*_range` selector is rejected. Do not narrow via `selector.type === '…'` on a `string`-typed discriminator — use these guards everywhere.
- [x] 5.5 Add the normaliser converting an `Annotation` to a validated `OfficeHighlightLocation[]` (`libs/quotations/src/models/office-highlight.ts` — see the scope note below, not the literal `OoxmlHighlightLocation` type tasks.md originally named): accept scalar or array `body.selector`; for `docx_text_range`/`pptx_text_range`, copy the wire's already-exclusive `end` through unchanged as `endExclusive` — **no `+ 1`** (design.md D3, corrected 2026-09-10 against captured fixtures); skip invalid selectors without throwing (non-integer or negative offsets, `end < start`, `slide < 1`, `row`/`col` `< 1`, empty `sheet`, `path` not an integer array, non-string `text`); for `excel_rc_range`, `end` stays the inclusive last-cell address, unaffected by this correction — reject an XLSX `end` whose `row` differs from `start.row` or whose `col` precedes `start.col`; treat `end: null` and omitted `end` identically.

  **Scope note (discovered during implementation, 2026-09-10):** `libs/quotations` cannot import `OoxmlHighlightLocation`/`OoxmlHighlight`/`OoxmlHighlightKind` from `libs/attachment-canvas` — the Nx graph flagged a real circular dependency, because `libs/attachment-canvas` already imports `annotationsToPdfHighlights` from `libs/quotations` (in a test). The normaliser instead produces a quotations-owned `OfficeHighlightLocation` union (`libs/quotations/src/models/office-highlight.ts`), discriminated by the wire's own `type` string (`'docx_text_range' | 'pptx_text_range' | 'excel_rc_range'`) rather than `OoxmlHighlightKind`. Task 6.1's mapper — in `libs/chat-hooks`, which already depends on both libs — is the layer that translates this into `OoxmlHighlight[]`/`OoxmlHighlightLocation[]` for `libs/attachment-canvas`. `design.md`'s architecture diagram (§Architecture) undersold this as `libs/quotations` emitting `OoxmlHighlight[]` directly; the type ownership boundary is corrected here, not the data flow.
- [x] 5.6 Add the same-source gathering helper to `libs/quotations/src/utils/group-annotations-by-source.ts`: given the clicked annotation and the message's full annotation list, return every annotation whose `body.source.attachment.url` equals the clicked one's, in input order, identifying the clicked one by reference identity; return the clicked annotation alone when it is absent from the list. Key on URL only — never on `title`.
- [x] 5.7 Export the guards, the normaliser, and the gathering helper from `libs/quotations/src/index.ts`.
- [x] 5.8 **Architecture guard**: confirm `libs/chat-shared` and `libs/quotations` gained no hardcoded `/api` path, generated-client or `server-api` import, app context, auth/session/cookie/env access, feature flag, route knowledge, analytics client, or storage behaviour in this slice.

**Verification**
```sh
npm run test:file -- libs/quotations/src/utils/tests/annotation.spec.ts
npm run test:file -- libs/quotations/src/utils/tests/group-annotations-by-source.spec.ts
npm run verify:changed
```

### 5.9 Tests — selector validation, normalisation, and grouping

- [x] A valid DOCX selector normalises with `endExclusive === end` (the wire's `end` is already exclusive — see design.md D3).
- [x] **Boundary**: `start: 5, end: 6` yields `[5, 6)` and slices to exactly one character.
- [x] **Boundary**: `start: 0, end: 10` against 10-character text yields `[0, 10)`, slices to the whole string, and is not out of bounds.
- [x] `end < start` is rejected.
- [x] Non-integer `start` and string `end` are rejected.
- [x] A selector array with one valid and one invalid entry keeps only the valid one.
- [x] An array of two valid selectors produces one highlight with two locations.
- [x] An XLSX multi-row range is rejected; a same-row range is accepted.
- [x] `end: null` and omitted `end` both produce a single-cell location.
- [x] `slide: 0` is rejected; `row: 0` and `col: 0` are rejected; an empty `sheet` is rejected.
- [x] An annotation with no selector produces no locations and does not throw.
- [x] An unrecognised `type` still satisfies `AnnotationSelector` through the open branch.
- [x] `isExcelRcRangeSelector` accepts the confirmed literal and rejects the same fields under a different `type`.
- [x] A `_range`-suffixed selector with neither DOCX nor PPTX field sets matches no guard.
- [x] DOCX and PPTX selectors are told apart, with neither matching both guards.
- [x] **Duplicate titles**: two annotations titled `report.docx` with URLs `files/a/report.docx` and `files/b/report.docx` never merge, and neither leaks the other's locations.
- [x] **Cross-marker gathering**: three `html_tag` annotations with distinct `cit` ids, two citing one file — previewing one of those two returns both and excludes the third.
- [x] Four annotations for one URL return in original order with the clicked one identifiable by reference.
- [x] A clicked annotation absent from the supplied list returns itself alone.

---

## 6. Slice — mapper and app wiring (first end-to-end behaviour)

- [x] 6.1 Add `annotationToOoxmlCanvasContent(annotation, annotations, resolvers)` to `libs/chat-hooks/src/files/attachment-canvas.ts`, beside `annotationToPdfCanvasContent` and following its structure: return `null` when there is no source attachment, when the format is not `Docx`/`Xlsx`/`Pptx` (CSV returns `null`), or when no URL resolves; resolve DIAL ids through `resolveDialFileDownloadUrl` via `isDialFileId`; gather same-source annotations; build one highlight per annotation yielding at least one location; reuse `annotationHighlightId` for ids; set `selectedHighlightId` only when the clicked annotation produced a highlight; omit `highlights` entirely (not `[]`) when nothing resolved.

  Implemented using `getOoxmlFileType` (already exported from `libs/attachment-canvas`) for format detection, and a local `toOoxmlHighlightLocation` translator mapping `libs/quotations`'s `OfficeHighlightLocation` (see the 5.5 scope note) into `OoxmlHighlightLocation` with the `OoxmlHighlightKind` enum.
- [x] 6.2 Export it from `libs/chat-hooks/src/index.ts`.
- [x] 6.3 Forward `content.highlights` and `content.selectedHighlightId` from `AttachmentCanvasBody` to `OoxmlContent`.
- [x] 6.4 Add `ooxmlHighlightsLabel` and `ooxmlHighlightNavigatedLabel` to `AttachmentCanvasLabels` with English defaults `'Cited locations'` and `'Scrolled to the cited location'`; add both to the `AttachmentCanvasBodyLabels` `Pick` list; forward both to `OoxmlContent` and read them on the overlay region and the status announcement. Verify end to end — a label declared but not forwarded leaves the child on its hardcoded default.

  Forwarding chain: `AttachmentCanvasContainer` → `AttachmentCanvas` → `AttachmentCanvasBody` → `OoxmlContent`; verified end to end by a dedicated `AttachmentCanvasBody.spec.tsx` test asserting both labels reach the (mocked) `OoxmlContent`, and a second test asserting they're `undefined` (not the English default) when omitted, since the default lives in `OoxmlContent` itself.
- [x] 6.5 Add the announcement: `role="status" aria-live="polite"` firing once when navigation for the selected highlight completes, and not re-firing on scroll, zoom, or resize.
- [x] 6.6 Add the second branch to `handleCitationPreview` in `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`, after the PDF mapper and before the `annotationToDisplayAttachment` fallback. Pass the message's resolved annotation list (not a single `AnnotationGroup`). Reuse the existing `fileName` derivation. Update the `useCallback` dependency list.

  **Behavioural note:** this makes an Office citation with no selector at all (a legacy annotation, or a backend that stripped it) open the OOXML canvas with no highlight, rather than falling through to the plain-attachment path — matching design.md's acceptance criterion 5 ("a missing… selector opens the document with no highlight"). One pre-existing test (`routes a persisted XLSX citation mislabeled as PDF to generic attachment preview`) asserted the old fall-through behavior and was updated to assert the new one, since this is exactly the behavior change the feature specifies, not an incidental regression.
- [x] 6.7 **Architecture guard**: confirm `libs/chat-hooks` and `libs/attachment-canvas` gained no `/api` path, `server-api` import, app context, auth/session/cookie/env access, feature flag, route knowledge, analytics client, or storage behaviour; and that `libs/attachment-canvas` receives only a URL, a format enum, and document coordinates.

**Verification**
```sh
npm run test:file -- libs/chat-hooks/src/files/tests/attachment-canvas.spec.ts
npm run test:file -- libs/attachment-canvas/src/components/AttachmentCanvasBody/tests/AttachmentCanvasBody.spec.tsx
npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx
npm run verify:changed
npm run build:quiet
```

### 6.8 Tests — mapping, integration, and regression

- [x] A DOCX citation returns content with `highlights` and a `selectedHighlightId` present in `highlights`.
- [x] A PPTX citation and an XLSX citation each return content with the correct `format`.
- [x] A CSV source returns `null`.
- [x] A non-Office source (e.g. `.txt`) returns `null`.
- [x] An annotation whose only selector is malformed returns content with `highlights` and `selectedHighlightId` both `undefined`.
- [x] When the clicked annotation resolves to nothing but a sibling resolves, `highlights` holds the sibling and `selectedHighlightId` is `undefined`.
- [x] A DIAL `files/…` id is resolved through `resolveDialFileDownloadUrl`; the resolver returning `undefined` makes the mapper return `null`.
- [x] `highlights` is omitted rather than `[]` when nothing resolves.
- [x] **Integration**: previewing a DOCX citation opens the canvas with `Ooxml` content, the right `format`, and the clicked annotation selected.
- [x] **Integration**: a grouped Office citation switched to its second annotation previews *that* annotation, not `primaryAnnotation`.
- [x] **Integration**: an Office citation with an unresolvable selector opens the document and does **not** fall through to the plain-attachment path.
- [x] **Regression**: a PDF citation still resolves through `annotationToPdfCanvasContent`, and the Office mapper is never consulted. (Covered by the pre-existing, unmodified PDF integration test in `ConversationMessageItem.spec.tsx`, which still passes unchanged — the Office branch only runs when the PDF mapper returns `null`.)
- [x] **Regression**: a CSV citation falls through to `annotationToDisplayAttachment` exactly as today.
- [x] **Regression**: an Office attachment opened outside a citation produces content with no highlight fields and takes the self-loading viewer path. (Covered by the pre-existing `resolveOoxmlCanvasContent` tests in `libs/chat-hooks`, untouched by this change — that path never calls `annotationToOoxmlCanvasContent`.)
- [x] Both new labels reach the overlay region and the announcement; omitting them falls back to the English defaults.
- [x] The announcement fires once on navigation and not again on scroll or zoom.
- [x] The overlay adds no tab stops — tabbing moves between the panel's real controls only.
- [x] No `findText` call occurs on any resolution failure.

---

## 7. Slice — backend DTO widening

Independently deployable and safe to ship before or after the frontend: it only ever accepts more input than before.

- [x] 7.1 Widen `AnnotationSelectorDto` in `apps/chat-api/src/conversations/dto/annotation.dto.ts` with optional, validated `story?: string`, `path?: number[]`, `slide?: number`, `shape_id?: string`, `sheet?: string`. Widen `start`/`end` to accept a number or the nested `{ row: number; col: number }` address, and `end` to additionally accept `null`. Keep the class an open shape, not a discriminated union. Give every added field `@ApiPropertyOptional` metadata. Follow `apps/chat-api/AGENTS.md` §DTOs.
- [x] 7.2 Run `npm run openapi` and `npm run openapi:check`.
- [x] 7.3 Build and lint `chat-api-client`.
- [x] 7.4 No new endpoint, so no `apps/chat/src/server-api/api-client.ts` singleton change and no new server-api wrapper. Confirm no route, method, path, status code, authorization, `@Throttle`, or cache behaviour changed.

**Verification**
```sh
npm exec nx test chat-api
npm exec nx lint chat-api
npm run openapi && npm run openapi:check
npm exec nx build chat-api-client && npm exec nx lint chat-api-client
npm run verify:changed
```

### 7.5 Tests — DTO validation

- [x] A DOCX selector with `story`, `path`, `start`, `end`, `text` passes the production-style transforming, whitelisting, `forbidNonWhitelisted` pipe with every field present after validation.
- [x] A PPTX selector with `slide` and `shape_id` is accepted and both survive serialization and reload.
- [x] An `excel_rc_range` selector with nested `start`/`end` addresses is accepted and both survive.
- [x] An `excel_rc_range` selector with `end: null` is accepted and `end` is preserved as `null`.
- [x] `normalizeRawAnnotationsServer` retains an Office selector in `body.selector` unchanged through streaming assembly.
- [x] **Regression**: a `pdf_bbox` selector with numeric coordinates and a `text_character_range` selector still validate exactly as before, including rejecting a string-valued nested `page`.
- [x] **Regression**: a payload with a genuinely unknown property is still rejected by `forbidNonWhitelisted`.

---

## 8. Slice — documentation and close-out

- [x] 8.1 Update `libs/chat-shared/README.md` with the three new selector types, noting `story` is an opaque string and that `DocxRangeSelector`/`PptxRangeSelector`'s `end` is already exclusive on the wire — unlike `TextCharacterRangeSelector`'s inclusive `end` (design.md D3, corrected against captured fixtures).
- [x] 8.2 Update `libs/quotations/README.md` with the guards, the normaliser, and the gathering helper. Document the normaliser as `annotationToOfficeHighlightLocations` returning `OfficeHighlightLocation[]` (`libs/quotations/src/models/office-highlight.ts`) — not `OoxmlHighlightLocation` from `attachment-canvas`, which this lib cannot depend on (see the 5.5 scope note) — and note `endExclusive` is a rename of the wire's already-exclusive `end`, not a `+ 1` conversion.
- [x] 8.3 Update `libs/chat-hooks/README.md` with `annotationToOoxmlCanvasContent`.
- [x] 8.4 Update `libs/attachment-canvas/README.md` with the highlight descriptor types, `OoxmlHighlightKind`, the new `OoxmlCanvasContent` fields, the two new labels, and the new colour vars. Every example must compile against the actual API — correct names, required props included, imported from the package that really exports them.
- [x] 8.5 Add both i18n keys to `apps/chat/src/i18n/locales/en.json` and matching members to `AttachmentCanvasI18nKeys` in `apps/chat/src/constants/translation-keys.ts`. Grep `en.json` for each English string first to avoid duplicating an existing value.
- [x] 8.6 RTL check: confirm the overlay's rectangle positioning uses physical `left`/`top` with the intentional-geometry comment in place, that all surrounding UI uses logical properties (`ms`/`me`, `ps`/`pe`, `start`/`end`), and that no new directional icon was added. Verify highlights land on the same text with `dir="rtl"` as with `dir="ltr"`.

  **Found and fixed:** `OoxmlContent.module.scss`'s `.highlight[data-clipped='true']` used `border-inline-end`/`border-start-end-radius`/`border-end-end-radius` — logical properties that flip under the **host page's** `dir="rtl"`, even though the clipped rectangle's `left`/`width` are canvas geometry in increasing-x order, unrelated to the host page's direction. Changed to `border-right`/`border-top-right-radius`/`border-bottom-right-radius` with a comment explaining why, consistent with D7 and the rest of the overlay. No directional icon was added by this change. Rectangle positioning (`left`/`top` inline styles) already carried the intentional-geometry comment from the original implementation.
- [x] 8.7 No `docs/` update is required: this change adds no lib, app, backend domain, controller base path, React context, route, `ApiEndpoints` entry, or tooling major, and changes no cross-cutting mechanism `docs/architecture.md` describes. Re-confirm this before closing rather than assuming it.

  Re-confirmed: every change is new exports/fields on existing libs (`chat-shared`, `quotations`, `chat-hooks`, `attachment-canvas`), a widened existing backend DTO (no new controller/route), and new i18n keys under an existing namespace. No new lib/app directory, backend domain folder, React context, route, or `ApiEndpoints` entry was added; no tooling major version changed.
- [x] 8.8 Run `npm run validate:docs` — four lib READMEs and public API surfaces changed, and nothing in `lint`/`test`/`build` covers README accuracy.

**Verification**
```sh
npm run validate:docs
npm run verify:full
```
