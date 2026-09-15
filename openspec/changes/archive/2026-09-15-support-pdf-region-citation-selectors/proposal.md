## Why

`libs/quotations` reads only `pdf_bbox` entries out of an annotation's `body.selector`, so citations whose document application emits `pdf_region` selectors open the PDF with no highlight and no jump to the cited page. The wire format is already in circulation — `@epam/ai-dial-chat-shared` converts `pdf_region` to `pdf_bbox` on the *legacy* `attachment_index` normalization path, but the modern `html_tag` path (`<cit data-id="…"></cit>`) passes `body.selector` through verbatim, so a `pdf_region` selector reaches the preview boundary unconverted and is silently dropped. The result is a citation the user can click that lands on page 1 of an unmarked document.

## What Changes

- Introduce a shared PDF-selector reader in `libs/quotations/src/utils/annotation.ts` that normalizes one `AnnotationSelector` to the existing `{ page, x1, y1, x2, y2 }` shape, accepting three input forms:
  - `pdf_bbox` — `{ page, x1, y1, x2, y2 }` (unchanged behavior)
  - `pdf_region` with `bbox: { lt: [x, y], wh: [w, h] }`
  - `pdf_region` with `bbox: { left, top, width, height }`
- Region coordinates convert as `x1 = left`, `y1 = top`, `x2 = left + width`, `y2 = top + height`.
- Route both `annotationsToPdfHighlights` and `getAnnotationPdfPage` through that one reader, so highlight geometry and page navigation can never disagree about which selectors they understand.
- Accept a scalar `body.selector` and an array, including arrays that mix `pdf_bbox` and `pdf_region` entries and span multiple pages; one annotation still produces one highlight carrying every valid box it owns.
- Validate page and geometry per selector: a malformed entry is skipped without throwing and without discarding the other valid entries in the same array.
- Not a breaking change: annotations and the persisted message format are untouched, `pdf_bbox` behavior is byte-for-byte preserved, and citation IDs, highlight selection, and styling are unchanged.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `canvas`: the PDF citation highlight mapping (`annotationsToPdfHighlights`) and the page-navigation rule for `annotationToPdfCanvasContent` currently name `pdf_bbox` as the only recognized selector type; both become "any recognized PDF selector", with the `pdf_region` shapes and the region→bbox conversion specified.

## Impact

- **Code**: `libs/quotations/src/utils/annotation.ts` (the new reader plus both call sites). No change to `libs/chat-hooks/src/files/attachment-canvas.ts`, `libs/attachment-canvas`, `libs/chat-shared`, or any app — they consume the reader's output through the existing `InputHighlightData` / `page` contract.
- **Tests**: `libs/quotations/src/utils/tests/annotation.spec.ts` (reader, both entry points, the three supplied coordinate sets, scalar/array/mixed selectors, malformed input), `libs/chat-hooks/src/files/tests/attachment-canvas.spec.ts` (citation → preview content integration).
- **Docs**: `libs/quotations/README.md` (`getAnnotationPdfPage` / `annotationsToPdfHighlights` descriptions both say `pdf_bbox` today), `libs/chat-hooks/README.md` (the `annotationToPdfCanvasContent` paragraph).
- **Out of scope**: no backend, DTO, OpenAPI, or `chat-shared` wire-normalizer change; no persistence migration; no PDF viewer replacement; no text-search fallback for quote-only citations.
