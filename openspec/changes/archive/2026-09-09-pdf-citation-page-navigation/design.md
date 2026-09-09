## Context and Evidence

This design supersedes the pre-PR-#8560 assumption that `html_tag` citations do not exist.

- `libs/quotations/src/utils/group-annotations-by-source.ts:112` groups HTML-tag annotations by cit ID. Different groups may share a URL; one group may reference multiple PDFs.
- `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx:295` receives the exact annotation selected by the citation popup.
- `libs/chat-hooks/src/files/attachment-canvas.ts:417` maps that annotation to PDF content. The pre-integration URL-only group lookup could select another group's highlights.
- `libs/quotations/src/utils/annotation.ts` and `apps/chat-api/src/conversations/utils/apply-chunk-annotations.server.ts` normalize raw annotations independently. Their html-tag branches previously discarded `body.selector`.
- `apps/chat-api/src/conversations/dto/annotation.dto.ts:115` previously exposed only title/quote/source on the body.
- `libs/attachment-canvas/src/components/PdfContent/PdfContent.tsx` already forwards a page independently of highlights but its default-page effect did not check the explicit page.

## Data Contract

A citation's `target.selector = { type: 'html_tag', tag: 'cit', id }` identifies the message marker. Its `body.selector = { type: 'pdf_bbox', page, x1, y1, x2, y2 }` identifies a location in the document. The body selector can also be an array.

Preserve selector objects with a string discriminator, filtering null/primitives from arrays. Preserve the object-versus-array shape. Omit the body field when absent so later quote-only raw deltas do not overwrite an earlier selector. Retain an explicitly supplied annotation index; existing index-based stream merge keeps multiple annotations behind one marker distinct.

The backend legacy attachment-index normalizer must also put PDF location in `body.selector`, matching frontend normalization, rather than substituting it for marker identity.

`AnnotationBodyDto.selector` uses Swagger `oneOf` (selector object or selector array), nested transformation, and validation. Existing conversation endpoints and client methods retain their signatures. Their message DTO now accepts/returns the optional field. Unknown/wrongly typed request fields remain subject to the existing ValidationPipe; UI handling of malformed upstream metadata remains defensive.

## Page and Highlight Selection

`getAnnotationPdfPage` selects the first `pdf_bbox` whose page is a positive integer, skipping malformed entries and invalid pages. Coordinates do not determine whether page-only navigation is possible.

The mapper retains its `(annotation, groups, resolvers)` signature. It finds the group containing the exact annotation object and filters its annotations to the clicked source URL before deriving highlights and the selected fallback index. If no group contains the annotation, it uses that annotation alone. This avoids URL-only identity ambiguity and prevents highlights from another PDF leaking into the viewer.

PDF highlights require a positive integer page and finite coordinates. Zero-area boxes remain accepted. Only set a selected highlight ID when it exists in the resulting highlight array. Thus missing/invalid selectors can reach the normal fallback without an invalid highlight selection blocking it.

No new context or persisted UI state: `AttachmentCanvasContext` continues owning the open content, and `PdfContent` owns the current page input. Existing memoized app callbacks remain in use.

## Viewer Timing

Retain the explicit `page`/selected-page prop chain. Guard the page-1 effect against both a selected highlight and an explicit page. This closes the wrapper-level reset.

An additional intermittent race exists in the installed vendor implementation: `PDFHighlightViewer.setPage` sets scrollTop, while its current-page update is debounced. `reRenderVisiblePages` captures currentPage, awaits page dimensions during zoom, then restores the captured page. The React wrapper invokes auto zoom and selected-page navigation in separate effects. A late restore may therefore return to page 1. This is evidence from installed source, not a reproduced browser trace; do not assume a fixed delay or repeated forced scrolling solves it.

## Architecture, Compatibility and Security

Follow root AGENTS.md library isolation and `apps/chat-api/AGENTS.md`. URL resolution remains injected into chat-hooks. The canvas API is host-agnostic. The server owns DTOs and normalization. No new dependencies, providers, endpoints, auth/cache/rate-limit changes, or deployment migration.

All additions are optional. Existing non-PDF routing and `#page=N` reference previews retain their behavior. Previously saved annotations whose page was discarded cannot be repaired without upstream data.

## Verification and Risks

### TypeScript follow-up

Fixing the reported `apply-chunk.server.spec.ts` diagnostics also required restoring backend declaration emission: import Vitest explicitly in that test, align the SSE delta's form-schema type with the existing message DTO, narrow localized display values to strings, capture SDK response status before discriminated-union narrowing, remove the unused archive timeout helper, and type ShareService's already-validated configuration consistently with AuthController. These are verification prerequisites, not new PDF/API features; they do not disable strict checks or reintroduce diagnostic logging. A focused localized-value regression suite covers the string guard. Remaining unrelated backend test-project errors are tracked separately from the now-clean production backend and citation test.

Use real normalization/grouping/mapping in tests, click real rendered `<cit>` markers and popup controls in the app component test, test DTO serialization through the actual ValidationPipe, and test server assembly across a quote-only delta and JSON reload. Verify the wrapper never calls its page-1 fallback for explicit pages.

Regenerate OpenAPI/client, run focused tests, docs/OpenSpec validation, changed verification and one full verification. Record unrelated failures explicitly. Browser PDF rendering and the intermittent auto-zoom reset remain unverified until an actual trace/reproduction is available; mocks only establish the app's data and navigation contracts.
