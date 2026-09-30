## Context

`readPdfSelectorBox` is the single validation gate for `pdf_bbox`/`pdf_region` selectors: it requires an integer `page >= 1` **and** four finite coordinates. The current `canvas` spec makes both `annotationsToPdfHighlights` and `getAnnotationPdfPage` derive from it, so the selectors that produce a highlight and those that produce a page are "identical by construction".

Producers do send page-only selectors (`{ type: 'pdf_region', page: 2 }`, seen in a persisted `customViewState.annotations` entry). Under the current rule their page is dropped, although `PdfCanvasContent.page` and `PdfContent.selectedPageNumber` already navigate without a highlight.

## Goals / Non-Goals

**Goals:** open the cited page for a page-only PDF selector; keep highlight geometry and page in agreement whenever geometry exists.

**Non-Goals:** quote-text search, synthetic highlights, format or backend changes.

## Decisions

1. **Two-pass lookup in `getAnnotationPdfPage`.** First pass: the first selector `readPdfSelectorBox` accepts (unchanged). Second pass, only when the first finds nothing: the first `pdf_bbox`/`pdf_region` selector with a valid page. Rejected alternative — a single pass taking the first valid page — would let an earlier page-only selector override a later highlighted one, so the viewer could open a page other than the selected highlight's.
2. **Separate `readPdfSelectorPage` reader, not a relaxed `readPdfSelectorBox`.** The box reader keeps its strict contract for highlights and ids (`annotationSelectorDigest`), so highlight ids and geometry do not change. The page reader checks only `type` and `page`, so a `page` on a non-PDF selector is never used.
3. **Invalid geometry is treated like absent geometry.** A `pdf_region` with `NaN` or a malformed `bbox` but a valid page navigates to that page. The page field is independently validated; discarding it because a sibling field is malformed loses user-visible value with no safety gain.

4. **Invisible page-anchor highlight in `annotationToPdfCanvasContent`.** Manual testing showed a page-only citation still opened at page 1. In `@epam/ai-dial-react-pdf-highlighter`, `setPage` runs as soon as the PDF loads, before the initial auto-zoom; the zoom's `reRenderVisiblePages` restores the scroll from a `currentPage` the scroll handler has not yet updated. `goToHighlight` runs only after `zoomChanged`, so citations with any geometry — including zero-area `pdf_bbox` boxes, which some producers send — are unaffected. Adding and selecting a zero-area, `opacity: 0` highlight on the page moves page-only citations onto that path, reusing the shape `referenceAttachmentToPdfCanvasContent` already emits. Its id is prefixed `page-anchor-` so it never collides with a generated highlight id. Rejected alternative — re-issuing `navigateToPage` in `PdfContent` after polling the zoom — depends on guessing when the vendor's asynchronous re-render finishes.

## Risks / Trade-offs

- [The spec's "identical by construction" guarantee becomes one-directional: every highlight has a page, but not every page has a highlight] → both requirements state the fallback explicitly, and tests cover precedence of geometry over page-only selectors.
- [The sources sidebar now splits page-only citations of one PDF into per-page rows] → intended; it matches how geometry-backed citations are already listed.
