## Why

### Problem

When a PDF citation carries a page but no usable geometry — for example `body.selector: [{ type: 'pdf_region', page: 2 }]` — the preview opens at page 1. `getAnnotationPdfPage` reads the page only from a selector whose `bbox` also validates, so a page-only selector is discarded together with its geometry. The attachment canvas and the PDF viewer already support navigating to a page without a highlight (`PdfCanvasContent.page` → `selectedPageNumber`); the page is lost earlier, in the parser in `libs/quotations`.

A related report (a conversation whose cited annotation `b3d83b` has no `body.selector` at all) is not fixed by this change: without any selector there is no page to navigate to, and the fix belongs in the producing agent.

## What Changes

### Solution

- `getAnnotationPdfPage` keeps preferring the first selector with valid geometry, so the opened page still matches the selected highlight.
- When no selector has valid geometry, it falls back to the first `pdf_bbox`/`pdf_region` selector whose `page` is an integer `>= 1`.
- Highlight geometry is unchanged: a selector without valid geometry produces no highlight from `annotationsToPdfHighlights`.
- `annotationToPdfCanvasContent` adds an invisible zero-area page-anchor highlight for such a page and selects it, as `referenceAttachmentToPdfCanvasContent` already does for `#page=N` references. The vendor viewer applies a bare page request before its initial auto-zoom, which resets it to page 1; highlight navigation runs after that zoom. The root cause is fixed upstream in `@epam/pdf-highlighter-kit` (`setPage` now updates `currentPage`); the anchor keeps navigation working until that release reaches this repo.
- Consequence: `annotationToPdfCanvasContent` sets `page` for page-only citations, and the sources sidebar qualifies such PDF sources with `#page=N` (its spec already defers to `getAnnotationPdfPage`).

### Non-goals

- Locating a citation by searching its `quote` text in the PDF.
- A visible highlight for a page-only selector.
- Changing the wire, persisted, or `customViewState` annotation formats, or the backend.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `canvas`: "One PDF selector reader serves both highlight geometry and page navigation" and "PDF citation preview navigates to the annotation's referenced page independent of highlight geometry" now allow a page-only fallback for navigation.

## Impact

- `libs/quotations/src/utils/annotation.ts` (`getAnnotationPdfPage`, new internal `readPdfSelectorPage`) and its README entry.
- Tests in `libs/quotations` and `libs/chat-hooks` (`attachment-canvas.spec.ts`).
- No public export, dependency, endpoint, i18n, RTL, or a11y change.
