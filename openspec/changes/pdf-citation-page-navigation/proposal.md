## Why

Clicking "Preview" on a PDF citation opens the attachment canvas but does not reliably land on the annotation's referenced page. Page navigation for citation PDFs is delegated entirely to the vendor PDF viewer's highlight-lookup (`goToHighlight(selectedHighlightId)`), which needs a real, non-degenerate bounding box to compute a scroll target. When an annotation's `pdf_bbox` selector has `x1=y1=x2=y2=0` (a valid, page-only citation with no rendered highlight rectangle), `PdfContent` has no other path to the correct page — its one explicit `navigateToPage(1)` fallback (`libs/attachment-canvas/src/components/PdfContent/PdfContent.tsx:451-457`) is skipped whenever *any* `selectedHighlightId` is present, degenerate or not.

**Investigation note — architecture correction to the reported bug:** the bug report describes citation markers as `<cit data-id="...">` HTML tags resolved via an `annotation.target.selector.type === "html_tag"` selector. That mechanism does not exist anywhere in this codebase (`libs/chat-shared/src/models/annotation.ts:31-34` recognises only `text_character_range` and `pdf_bbox` selector types; exhaustive `grep` for `html_tag`/`data-id`/`<cit` across `apps/chat/src` and `libs/*` returns nothing). Markers are actually placed by injecting `⟦C{idx}⟧` character-offset sentinels at each `AnnotationGroup.primaryAnnotation`'s `text_character_range.end` offset (`libs/quotations/src/utils/citation-injection.ts:18-41`, consumed by `libs/quotations/src/hooks/useCitationMarkdownComponents/useCitationMarkdownComponents.tsx:53-101`), then swapping each sentinel for a `CitationDropdown`. This does not change what needs to be fixed: the "which annotation did the user actually click" tracking this sentinel/dropdown mechanism provides is **already correct** today (see Requirement 5 below) — the defect is purely in PDF page navigation once the correct annotation reaches the canvas-content builder. The design below is written against the real flow; if a backend migration to literal `<cit>` markers is planned separately, it is out of scope for this change and should be proposed independently.

## What Changes

- Add an optional `page?: number` field to `PdfCanvasContent` (`libs/attachment-canvas/src/models/attachment-canvas.ts:49-58`) — a 1-based page to navigate to on initial load, independent of highlight geometry.
- Add `getAnnotationPdfPage(annotation): number | undefined` to `libs/quotations/src/utils/annotation.ts` (co-located with the existing `annotationsToPdfHighlights`/`annotationHighlightId`), exported from `@epam/ai-dial-quotations`. It reads `annotation.body.selector` (single object or array), takes the first entry with `type === 'pdf_bbox'`, and returns its `page` only when it is an integer `>= 1`; otherwise `undefined`.
- `annotationToPdfCanvasContent` (`libs/chat-hooks/src/files/attachment-canvas.ts:416-439`) sets `page: getAnnotationPdfPage(annotation)` on the `PdfCanvasContent` it builds, using the exact clicked annotation it already receives (not the group's primary/first — this part of the flow is unchanged and already correct).
- `referenceAttachmentToPdfCanvasContent` (`libs/chat-hooks/src/files/attachment-canvas.ts:448-477`) also sets `page: parsed.page` when a page fragment is present — it already computes this page number for its own synthetic zero-area highlight, so this closes the identical latent gap for reference-only PDF-page chips at no extra design cost.
- `PdfContent` (`libs/attachment-canvas/src/components/PdfContent/PdfContent.tsx`) gains a `selectedPageNumber?: number` prop that it forwards directly to the vendor `DocumentPreview`'s existing (currently unused) `selectedPageNumber` prop, and prefers over the highlight-bbox lookup when initialising/syncing its own `selectedPage` state (used for the thumbnails panel). `DocumentPreview` already drives page navigation from this prop through an effect independent of its `selectedHighlightId`-driven `goToHighlight` effect (confirmed in `@epam/ai-dial-react-pdf-highlighter`'s compiled source), so this gives page-accurate navigation a path that does not depend on highlight geometry succeeding.
- `AttachmentCanvasBody` (`libs/attachment-canvas/src/components/AttachmentCanvasBody/AttachmentCanvasBody.tsx:349-354`) forwards `content.page` to that new prop.
- No backend changes, no new endpoints, no new user-visible strings, no feature flags, no telemetry, no persistence — purely a frontend data-flow fix.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `canvas`: adds a requirement that opening a PDF citation (or a reference-only PDF-page chip) navigates to the annotation's/reference's specified page even when its bounding box is degenerate (all-zero) or the citation carries no renderable highlight, without changing the existing highlight-rendering, download, or non-PDF routing requirements already documented in `openspec/specs/canvas/spec.md`.

## Impact

- **Affected code**: `libs/attachment-canvas/src/models/attachment-canvas.ts`, `libs/attachment-canvas/src/components/PdfContent/PdfContent.tsx`, `libs/attachment-canvas/src/components/AttachmentCanvasBody/AttachmentCanvasBody.tsx`, `libs/quotations/src/utils/annotation.ts`, `libs/quotations/src/index.ts`, `libs/chat-hooks/src/files/attachment-canvas.ts`. No changes to `apps/chat/src/**` — `ConversationMessageItem.tsx` already passes the correct clicked annotation into `annotationToPdfCanvasContent` (`apps/chat/src/components/ConversationView/ConversationMessageItem.tsx:292-303`) and needs no edits.
- **APIs**: none — frontend-only, no `apps/chat-api` or generated-client involvement.
- **Dependencies**: none new. `libs/chat-hooks` already depends on `@epam/ai-dial-quotations` for the sibling helpers (`annotationHighlightId`, `annotationsToPdfHighlights`, `parsePdfPageReference`); the new `getAnnotationPdfPage` follows the same existing, documented library-isolation exception (AGENTS.md §Library isolation, "second, narrower exception" for `libs/chat-hooks`).
- **Systems**: none — no cross-cutting mechanism (auth, routing, theming, SSE) is touched, so `docs/architecture.md` needs no update.
- **Docs**: `libs/quotations/README.md` (add `getAnnotationPdfPage` to Utilities) and `libs/attachment-canvas/README.md` (note page navigation in the `PdfCanvasContent` content-types table row). `npm run validate:docs` after both edits.
- **i18n**: none — no new user-visible strings.
- **Out of scope / follow-up**: `annotationsToPdfHighlights`/`annotationHighlightId` (`libs/quotations/src/utils/annotation.ts`) have no existing unit tests at all today (verified: no `libs/quotations/src/utils/tests/annotation.spec.ts` exists). This change adds tests only for the new `getAnnotationPdfPage`, not for the pre-existing untested functions — closing that gap is a separate follow-up, not bundled into this fix.
