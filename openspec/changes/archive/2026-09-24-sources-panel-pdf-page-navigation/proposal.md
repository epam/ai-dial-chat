## Why

Issue [#9029](https://github.com/epam/ai-dial-chat/issues/9029) (P2, StatGPT Deep Research): when a PDF is opened from the **Sources** panel it always opens on page 1. The same citation opened from the chat response text opens at the cited page. Users have to scroll through long reports by hand to find the passage the answer relied on.

## Problem

The page is lost in two places:

1. **The click handler skips the page-aware path.** `handleSourceClick` (`apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx:254-290`) builds a `DisplayAttachment` with the source link in `url`.
   - `useOpenAttachmentCanvas` (`libs/attachment-canvas/src/hooks/useOpenAttachmentCanvas/useOpenAttachmentCanvas.ts:192`) only runs the page-aware `resolveReferencePdfContent` when `url == null && referenceUrl != null`.
   - So the click falls through to the generic `resolvePdfCanvasContent` (`libs/chat-hooks/src/files/attachment-canvas.ts:696-709`). That function strips the `#page=N` fragment and returns no `page`.
2. **Annotation-based sources never carry a page.** `useConversationSources` (`libs/chat-hooks/src/conversation-sources/useConversationSources/useConversationSources.ts:85-96`) builds sources from citation annotations with just `att.url`.
   - The page stored in the annotation's `pdf_bbox`/`pdf_region` selector is dropped. `getAnnotationPdfPage` (`libs/quotations/src/utils/annotation.ts:264`) could read it, but nothing calls it here.
   - Rows are also deduplicated by the bare file URL. Every later citation of the same PDF collapses into the first row, so no row can take the user to a later page.

The inline-citation path that works today is `handlePreviewReference` (`apps/chat/src/components/ConversationView/ConversationView.tsx:395-406`) → `referenceAttachmentToPdfCanvasContent` (`libs/chat-hooks/src/files/attachment-canvas.ts:625-655`). This change reuses that path.

## What Changes

- **Sources-panel click honours the PDF page.** When a source URL is a PDF page reference (`parsePdfPageReference(url)` returns a `page`), `handleSourceClick` opens the canvas through the reference-PDF path. It does this by setting `referenceUrl` and leaving `url` unset, so the PDF canvas receives `page` and a `selectedHighlightId`. The existing `referenceUrl` branch of `useOpenAttachmentCanvas` handles it; no new canvas API is needed. Fallbacks keep today's behaviour:
  - a DIAL file downloads the bare file (without the fragment);
  - an external URL opens in a new tab with the `#page=N` fragment kept, so a browser's native PDF viewer also lands on the page.
- **Annotation sources carry their page.** `useConversationSources` appends `#page=N` to an annotation source's `url`, taking the page from `getAnnotationPdfPage(annotation)`.
  - This happens only when the URL is a PDF reference with no fragment yet.
  - The result has the same `#page=N` form that reference-only attachments already use.
- **One row per cited page.** Sources are deduplicated by this page-qualified URL. Two citations of the same PDF on different pages become two rows; two citations of the same page still collapse into one row.
- Docs: add a note to `libs/source-panel/README.md` (`QuotationSource.url` may carry a `#page=N` fragment) and update the `libs/chat-hooks/README.md` description of `useConversationSources` dedup.

## Non-goals

- Markdown (`.md`) or other text sources jumping to a heading, anchor or line. Markdown has no pages, and the renderer emits no heading ids. That would be a separate feature.
- Highlighting the exact quoted region (bbox) when a PDF is opened from the Sources panel. Only the page is restored. Inline citations keep their bbox highlight.
- PDFs whose URL has no `.pdf` extension (opaque ids with `application/pdf`). `parsePdfPageReference` only recognizes `*.pdf[#page=N]`, which is the same limit inline reference links have today. These still open on page 1 (see design Open Questions).
- Any change to the `QuotationSource` type, `SourcesSection` rendering, or `libs/attachment-canvas`.

## Alternatives considered

- **Add `page?: number` to `QuotationSource`.** Rejected. It changes the public lib model and README, and it duplicates information reference-only sources already carry in `#page=N`. The copy-link button would also copy a URL without the page.
- **Call `referenceAttachmentToPdfCanvasContent` + `openCanvas` directly in `handleSourceClick`,** as `handlePreviewReference` does. Workable, but it bypasses `openAttachmentCanvas`'s commit/loading/`onBeforeOpen` handling. Setting `referenceUrl` reaches the same resolver through the standard hook.
- **Keep one row per file and open at the first citation's page.** Rejected by the product owner: every cited page should be reachable.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `conversation-sources-sidebar`: the requirement "Source link clicks are routed by URL and content type" adds a page-aware PDF branch. The requirement "`useConversationSources` derives Uploaded, Generated, and Sources lists from messages" now qualifies annotation source URLs with `#page=N` and deduplicates by the page-qualified URL.

## Impact

- **App:** `apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx` (`handleSourceClick`) and its test `apps/chat/src/components/ConversationSourcesPanel/tests/ConversationSourcesPanel.spec.tsx`.
- **Lib `libs/chat-hooks`:** `useConversationSources.ts` and its spec. The change only adds a call to `getAnnotationPdfPage` from `@epam/ai-dial-quotations`, which is already a declared dependency. It introduces no host-owned knowledge: no URLs are resolved and no routing or client code is added. It is pure message-shape derivation.
- **Lib `libs/source-panel`:** README note only; no code change.
- **Scope creep flag:** touches two shared libs (docs-only for `source-panel`). No global providers or contexts.
- **i18n:** no new user-visible strings.
- **RTL / a11y:** no UI change. The number of rows can grow, and each keeps its existing accessible link.
- **API / backend:** none.

## Acceptance criteria

- Clicking a Sources-panel entry whose URL is `…/report.pdf#page=81` opens the PDF canvas at page 81.
- A PDF source that comes from a citation annotation with a `pdf_bbox` on page 12 is listed as `…/doc.pdf#page=12` and opens at page 12.
- Citations of the same PDF on pages 3 and 7 produce two Sources rows. Two citations on page 3 produce one row.
- Sources without a page (plain PDF URL, non-PDF) behave exactly as before.
- Canvas-open failure falls back to downloading the bare DIAL file, or to opening the external URL in a new tab.
- Unit tests cover all of the above. `npm run verify:full` and `npm run validate:docs` pass.

## Rollback / backward compatibility

Not breaking. `QuotationSource`'s shape is unchanged; only its `url` values for annotation-derived PDF sources gain a `#page=N` suffix, a form hosts already receive from reference-only sources. Reverting the two source files restores the previous behaviour.
