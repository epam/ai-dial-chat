## Context

`PdfContent` (`libs/attachment-canvas/src/components/PdfContent/PdfContent.tsx`) wraps the vendor `DocumentPreview` from `@epam/ai-dial-react-pdf-highlighter`. Today it passes `DocumentPreview` two things derived from `PdfCanvasContent`: `highlights` and `selectedHighlightId` (`PdfContent.tsx:600-614`). Its own explicit page-navigation fallback only fires when there is **no** `selectedHighlightId` at all:

```ts
// PdfContent.tsx:451-457
useEffect(() => {
  if (!isViewerReady || selectedHighlightId) return;
  const raf = requestAnimationFrame(() => {
    viewerApiRef.current?.navigateToPage(1);
  });
  return () => cancelAnimationFrame(raf);
}, [isViewerReady, selectedHighlightId]);
```

Whenever `selectedHighlightId` is present — which is true for every PDF citation, because `annotationsToPdfHighlights` (`libs/quotations/src/utils/annotation.ts:27-49`) always emits an `InputHighlightData` for any annotation with a `pdf_bbox` selector regardless of its coordinates — navigation is delegated entirely to the vendor's own highlight-lookup effect, confirmed in the compiled `@epam/ai-dial-react-pdf-highlighter` source (`node_modules/@epam/ai-dial-react-pdf-highlighter/dist/ai-dial-react-pdf-highlighter.es.js:81`): `p && g && c && C(c)` where `C` is `goToHighlight(termId)`. Whether that vendor call successfully repositions the viewport for a zero-area bbox is not independently verifiable from compiled/minified source, but it is exactly the single path page navigation depends on today — there is no fallback once a highlight (of any geometry) exists.

Separately, the same vendor package already exposes a page-number-only navigation path that nothing in this repo currently wires up:

```
// node_modules/@epam/ai-dial-react-pdf-highlighter/dist/src/components/DocumentPreview/DocumentPreview.d.ts
/** Navigate viewer to this page when provided. */
selectedPageNumber?: number;
```

and, one layer down, in the compiled `PDFViewer` component:

```js
// ai-dial-react-pdf-highlighter.es.js:92-93
}, [p, s]), y(() => {
  p && i && n.current?.setPage?.(i);
}, [p, i]),
```

This effect (`i` = `selectedPageNumber`) is independent of the `goToHighlight` effect (`c` = `selectedHighlightId`, line 81) — both run off the same `PDFHighlightViewer` instance but neither is gated on the other. `PdfContent.tsx` never passes `selectedPageNumber` to `DocumentPreview` today (`PdfContent.tsx:600-614` omits it).

## Goals / Non-Goals

**Goals:**
- A PDF citation (or reference-only PDF-page chip) whose annotation specifies page N always navigates to page N on open, whether or not its bounding box is renderable as a highlight.
- Preserve every other current behavior byte-for-byte: highlight rendering for valid bboxes, the clicked-annotation (not group-primary) selection already in place, the page-1 fallback for missing/invalid page data, and non-PDF/plain-PDF preview paths.
- Keep the fix additive and low-risk: one new optional field, one new optional prop, no signature changes to existing exported functions.

**Non-Goals:**
- Migrating citation-marker resolution from the current character-offset-sentinel mechanism to a `<cit data-id>`/`html_tag`-selector mechanism — that mechanism does not exist in this codebase today (see proposal.md's investigation note) and is out of scope for this fix.
- Fixing or adding test coverage for the pre-existing, unrelated absence of unit tests on `annotationsToPdfHighlights`/`annotationHighlightId` — tracked as a follow-up, not bundled here.
- Any backend, endpoint, telemetry, feature-flag, or persistence change.

## Decisions

### 1. Add `PdfCanvasContent.page`, threaded to `DocumentPreview.selectedPageNumber`, instead of "fixing" highlight geometry

**Decision**: add `page?: number` to `PdfCanvasContent`; forward it through `PdfContent`'s new `selectedPageNumber` prop straight to `DocumentPreview.selectedPageNumber`. Leave `highlights`/`selectedHighlightId` untouched.

**Why**: this uses an already-existing, purpose-built vendor mechanism (`selectedPageNumber` → `setPage`) that is provably independent of the highlight-lookup effect, per the compiled source cited above. It directly satisfies "do not rely exclusively on highlight geometry to select the initial page" without needing to understand or patch vendor internals we cannot read (the vendor's `PDFHighlightViewer.goToHighlight` implementation is compiled/minified and out of our control).

**Alternative considered — pad zero-area bboxes to a minimum 1×1 size before building the highlight**: rejected. It would (a) still depend on unverifiable vendor behavior for whether a 1×1 box is enough to trigger a successful `goToHighlight` scroll, (b) risk rendering a faint but visible highlight rectangle where none should appear (misleading UI for a citation that legitimately has no visual region), and (c) not help the pre-existing, structurally identical case in `referenceAttachmentToPdfCanvasContent`, which already deliberately uses a zero-area, `opacity: 0` synthetic bbox for reference-only PDF pages.

**Alternative considered — call `viewerApiRef.current?.navigateToPage(page)` manually from `PdfContent` instead of adding a new prop**: rejected in favor of passing `selectedPageNumber` down to `DocumentPreview`. `PdfContent` cannot call `navigateToPage` until `isViewerReady` fires (`viewerApiRef` is populated by `onViewerReady`), which would require re-deriving the exact same "trigger once, on the right dependency change" effect that the vendor component's own `setPage` effect already implements correctly and is exercised by its own tests. Passing the prop is fewer lines, no new `useEffect`, and reuses vendor-owned logic instead of duplicating it at the wrapper layer.

### 2. `getAnnotationPdfPage` lives in `libs/quotations`, not `libs/chat-hooks` or `apps/chat`

**Decision**: add the new extraction helper to `libs/quotations/src/utils/annotation.ts`, exported from `@epam/ai-dial-quotations`, and have `libs/chat-hooks/src/files/attachment-canvas.ts` import and call it — the same pattern already used for `annotationsToPdfHighlights`/`annotationHighlightId`/`parsePdfPageReference` (`libs/chat-hooks/src/files/attachment-canvas.ts:36-41`).

**Why (library isolation)**: reading `annotation.body.selector`'s shape (`pdf_bbox` filtering, single-vs-array handling, integer/`>=1` validation) is pure annotation-data interpretation — no host/app knowledge (no URLs to resolve, no DIAL file IDs, no theme, no routing). `libs/quotations` already owns exactly this class of helper. `libs/chat-hooks` depending on `@epam/ai-dial-quotations` for it is already licensed by AGENTS.md's "second, narrower exception" for `libs/chat-hooks` (host-agnostic DIAL Core data-shape packages). Putting it in `apps/chat` would be a step backward — it would duplicate shape-parsing logic that already lives in a lib and force `annotationToPdfCanvasContent` to accept a pre-extracted page number as an extra parameter instead of deriving it from the annotation it already receives.

### 3. Also fix `referenceAttachmentToPdfCanvasContent`, in this same change

**Decision**: set `page: parsed.page` in the page-present branch of `referenceAttachmentToPdfCanvasContent` (`libs/chat-hooks/src/files/attachment-canvas.ts:460-477`) alongside the annotation-citation fix.

**Why**: it already computes `parsed.page` and already builds a deliberately zero-area, invisible synthetic bbox for it — the exact same "highlight geometry can't carry navigation" pattern this change fixes for real citations. Leaving it out would mean two call sites returning the same `PdfCanvasContent` type, one with page-accurate navigation and one without, for what is visibly the same feature (open a PDF at a specific page) from a user's perspective. The change is one line, reuses the field just added, and needs no new logic.

**Scope note**: this is a deliberate, disclosed inclusion (see proposal.md's Impact section), not silent scope creep — it touches only the one file already being changed and adds no new decisions beyond decision 1.

### 4. No change to the clicked-vs-primary-annotation selection

**Decision**: no code change for "use the currently selected/clicked annotation, not the group's primary/first." `ConversationMessageItem.handleCitationPreview` (`apps/chat/src/components/ConversationView/ConversationMessageItem.tsx:292-303`) already receives exactly the annotation the user's Preview click targeted (`CitationDropdown` → `CitationCard`'s `group.annotations[activeIndex] ?? group.primaryAnnotation`, `libs/quotations/src/components/CitationCard/CitationCard.tsx:105`, wired through the switcher's `activeIndex` state) and forwards it unchanged into `annotationToPdfCanvasContent`. `AnnotationGroup.primaryAnnotation` is used only for inline-marker character-offset placement, never for citation-preview page selection.

**Verification, not implementation**: add a regression test asserting `annotationToPdfCanvasContent` returns the clicked annotation's own page when a group contains annotations for two different pages of the same PDF (acceptance criterion "a grouped citation opens the page belonging to the currently selected annotation").

## Risks / Trade-offs

- **[Risk] Vendor behavior when both `selectedPageNumber` and `selectedHighlightId` are supplied simultaneously (the common case: a citation with a valid, non-zero bbox) is not independently verifiable from compiled/minified vendor source.** → **Mitigation**: the two effects are structurally independent in the compiled source (different dependency arrays, `setPage(i)` vs `goToHighlight(c)`, neither reads the other's prop) and both target the *same* page for a valid highlight, since `page` and the highlight's own `bboxes[0].page` come from the same annotation. Worst case if they interact oddly is a same-page reposition, not a wrong-page jump. Manually verify (open a PDF citation with a real, non-zero bbox in the running dev app) before merge, since this exact interaction is not unit-testable through mocks.
- **[Risk] `PdfContent`'s thumbnails-panel `selectedPage` state and the main viewer could disagree if `selectedPageNumber` and the highlight-derived page ever diverge (e.g., malformed data).** → **Mitigation**: `selectedPage`'s initializer/sync-effect is updated to prefer `selectedPageNumber` when present, so both the thumbnails panel and the main viewer read from the same source of truth; the highlight-derived lookup remains only as the fallback when no `selectedPageNumber` is supplied (plain PDF opens, or any other future caller that passes highlights without a page).
- **[Risk] Scope creep into `referenceAttachmentToPdfCanvasContent`.** → **Mitigation**: disclosed explicitly in proposal.md and decision 3 above, confined to the one field/one file already touched, no new behavior invented.
- **Rollback**: fully additive change (new optional interface field, new optional component prop, both default to `undefined`/current behavior when omitted). Revert is a single, clean commit revert with no data or migration implications — nothing persisted, no backend contract changed.

## Migration Plan

Frontend-only change shipped in one PR through normal review; no phased rollout, no feature flag, no data migration. Deploy alongside the next regular frontend release. Rollback = revert the commit; no follow-up cleanup needed since nothing is persisted.

## Open Questions

None outstanding — the one design choice with real trade-offs (decision 1) is resolved above with the vendor-source evidence found during investigation.
