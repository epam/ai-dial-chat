## 1. Shared PDF-selector reader

- [x] 1.1 In `libs/quotations/src/utils/annotation.ts`, add a non-exported `readPdfSelectorBox(selector: AnnotationSelector): BBox | undefined` (importing `BBox` as a type from `@epam/pdf-highlighter-kit`, alongside the existing `HighlightStyle`/`InputHighlightData` type imports). Accept `pdf_bbox` with `{ page, x1, y1, x2, y2 }`; return `undefined` for every other `type`.
- [x] 1.2 Extend the reader to `pdf_region`: read `bbox` as a `Record<string, unknown>`, prefer `lt: [left, top]` / `wh: [width, height]` over `left`/`top`/`width`/`height` per design D3, and convert with `x1 = left`, `y1 = top`, `x2 = left + width`, `y2 = top + height`.
- [x] 1.3 Apply one shared validation gate to both shapes: reject unless `page` is an integer `>= 1` and all four resulting coordinates satisfy `Number.isFinite`. Return `undefined` (never throw) for `null`, primitives, a missing or non-object `bbox`, and short or non-numeric `lt`/`wh` arrays. Keep zero-area boxes valid.
- [x] 1.4 Add a block comment (`/* … */`, per AGENTS.md) above the reader stating the three accepted shapes, the region→edges conversion, the `lt`/`wh` precedence, and why one reader serves both call sites (design D2).

## 2. Route both entry points through the reader

- [x] 2.1 Rewrite `annotationsToPdfHighlights` to build its `bboxes` by mapping each selector through `readPdfSelectorBox` and keeping the defined results in selector order. Leave untouched: the scalar-vs-array handling, one-highlight-per-annotation, the `annotation.index ?? i` ID, `CITATION_HIGHLIGHT_STYLE`, and the empty-`bboxes` skip.
- [x] 2.2 Rewrite `getAnnotationPdfPage` to return the `page` of the first selector `readPdfSelectorBox` accepts, and `undefined` otherwise — removing its own duplicated page validation and its `PdfBBoxSelector` type predicate.
- [x] 2.3 Update both functions' JSDoc: they recognise `pdf_bbox` and both `pdf_region` coordinate forms, not `pdf_bbox` alone. Note on `getAnnotationPdfPage` that a page now requires finite geometry too (design D2's stated consequence).
- [x] 2.4 Drop the now-unused `PdfBBoxSelector` type import if nothing else in the file references it, so `noUnusedLocals` stays satisfied.

## 3. Unit tests — `libs/quotations/src/utils/tests/annotation.spec.ts`

- [x] 3.1 Add a `pdfRegion` fixture builder next to the existing `bbox` builder, parameterised over the `lt`/`wh` and `left/top/width/height` forms.
- [x] 3.2 Add the equivalence test: build the supplied rectangle in all three formats (`x1: 58.752, y1: 383.328` with `wh: [492.048, 29.304]` → `x2: 550.8, y2: 412.632`), assert each yields that exact box, and assert the three `annotationsToPdfHighlights` results are equal to each other and the three `getAnnotationPdfPage` results are all `1`.
- [x] 3.3 Cover a scalar `pdf_region` selector and a mixed array (`pdf_bbox` page 2, `pdf_region` page 5, `text_character_range`) producing one highlight with both boxes in order and page `2`.
- [x] 3.4 Cover malformed input: short `lt`, `page: 0`, `null`, missing `bbox`, non-object `bbox`, `NaN` in `wh`, unknown `type` — each skipped without throwing, none discarding a valid page-6 sibling.
- [x] 3.5 Cover a zero-size region (`wh: [0, 0]`) still yielding a box and its page, and a `bbox` carrying both coordinate forms resolving to the `lt`/`wh` values.
- [x] 3.6 Cover an annotation with a `quote` and a PDF source but no `body.selector`: no highlight, `getAnnotationPdfPage` returns `undefined`.
- [x] 3.7 Confirm every existing `getAnnotationPdfPage` and highlight test in the file still passes unmodified; if any assertion must change, stop and reconcile it against design D2 before editing it.
- [x] 3.8 Run `npm run test:file -- libs/quotations/src/utils/tests/annotation.spec.ts`.

## 4. Integration test — citation to preview content

- [x] 4.1 In `libs/chat-hooks/src/files/tests/attachment-canvas.spec.ts`, add an `annotationToPdfCanvasContent` case for an annotation with a `pdf_region` `lt`/`wh` selector on page 1: assert `page === 1`, one highlight with the converted box, and `selectedHighlightId` set to that annotation's highlight ID.
- [x] 4.2 Add a case for two same-source annotations, one `pdf_bbox` and one `pdf_region`, both producing highlights with the clicked one selected.
- [x] 4.3 Add a case asserting a `pdf_region` annotation whose coordinates are malformed still yields `page: undefined` and no highlight, without throwing.
- [x] 4.4 Run `npm run test:file -- libs/chat-hooks/src/files/tests/attachment-canvas.spec.ts`.

## 5. Documentation

- [x] 5.1 `libs/quotations/README.md`: update the `getAnnotationPdfPage` bullet (currently "from its `pdf_bbox` body selectors") and the `annotationsToPdfHighlights` entry to name all three accepted shapes and the region→edges conversion. Check the overview paragraph's `text_character_range`/`pdf_region` phrasing still reads correctly.
- [x] 5.2 `libs/chat-hooks/README.md`: update the `annotationToPdfCanvasContent` paragraph that says `page` comes from "its first valid `pdf_bbox` body selector".
- [x] 5.3 `openspec/specs/canvas/spec.md`: update the prose outside the requirement blocks that the archive merge will not touch — the "PDF sources (highlights)" steps 2 and 6, and the "Selector type" subsection's `pdf_bbox`-only claim plus its code fence.
- [x] 5.4 Check `docs/architecture.md` for a citation/selector description; update it only if it names the recognised selector types (this change adds no lib, app, context, route, or backend domain).
- [x] 5.5 Run `npm run validate:docs`.

## 6. Verification

- [x] 6.1 `npm run verify:changed` — lint and typecheck the affected projects (`quotations`, `chat-hooks`).
- [x] 6.2 Run the wider citation suites for regressions: `libs/quotations/src/utils/tests/useAnnotations.spec.ts`, `libs/attachment-canvas/src/hooks/useOpenAttachmentCanvas/tests/useOpenAttachmentCanvas.spec.ts`, and `apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx`.
- [x] 6.3 `npm run verify:full` once, before declaring the change complete.
- [x] 6.4 Manual check in the running app (`npm run start:all`): click a `<cit>` citation backed by a `pdf_region` annotation and confirm the PDF opens scrolled to the cited region with the highlight drawn; repeat with a `pdf_bbox` citation to confirm no regression.
