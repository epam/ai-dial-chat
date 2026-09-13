# Highlight Office document annotations

## Why

Clicking **Preview** on a citation that points at a PDF opens the attachment canvas, scrolls to the cited page, and draws a selected highlight over the quoted region. Clicking **Preview** on a citation that points at a DOCX, XLSX, or PPTX opens the same document with **no location and no highlight** — the user is dropped on page 1 of a 40-page contract and has to find the quote by hand.

The gap is not a missing viewer. `OoxmlContent` already renders all three formats. The gap is that `annotationToPdfCanvasContent` (`libs/chat-hooks/src/files/attachment-canvas.ts:334`) returns `null` for any non-PDF source, so `handleCitationPreview` (`apps/chat/src/components/ConversationView/ConversationMessageItem.tsx:309`) falls through to a plain attachment open that carries no selector information at all.

Two things now make this tractable. First, the installed `@silurus/ooxml@0.86.1` exposes exactly the geometry APIs this needs — `DocxDocument.collectPageRuns`, `PptxPresentation.collectSlideRuns`, and `XlsxViewerEngine.getCellViewportRect` — plus a documented "shared parse" mode (`DocxScrollViewer.fromDocument` / `PptxScrollViewer.fromPresentation`) that lets a resolver and a viewer share one parse instead of paying for two. Second, upstream has begun emitting Office range selectors, so the location data exists on the wire even though this repo currently discards it.

## Problem

1. **Office citations lose their location.** `annotationToPdfCanvasContent` gates on `source?.type !== MIMEType.PDF` and bails. Nothing downstream ever sees a DOCX/PPTX/XLSX selector.
2. **The selector types do not exist in the client.** `libs/chat-shared/src/models/annotation.ts` models only `text_character_range`, `pdf_bbox`, and `html_tag`. Office selectors land in the open forward-compatible `{ type: string; [key: string]: unknown }` branch and are structurally unreachable.
3. **The backend actively destroys the data.** `AnnotationSelectorDto` (`apps/chat-api/src/conversations/dto/annotation.dto.ts:22`) is a **closed field allowlist** — `type`, `start`, `end`, `page`, `x1`, `y1`, `x2`, `y2`, `tag`, `id` — and `main.ts:128-131` installs `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`. An Office selector carrying `story` / `path` / `slide` / `shape_id` / `sheet` therefore either has those fields **stripped**, or — on the conversation-save request path — **rejects the whole save with a 400**. This is the repository evidence that selector data is currently lost before it can round-trip; it is a DTO gap, **not** a missing endpoint.
4. **The renderer has no highlight surface.** `OoxmlContent` (`libs/attachment-canvas/src/components/OoxmlContent/OoxmlContent.tsx`) constructs a viewer, calls `load(url)`, and owns no overlay, no resolver, and no navigation entry point. `OoxmlCanvasContent` carries only `{ url, format }`.
5. **Same-source annotations are not gathered across markers.** `groupAnnotationsByCitId` (`libs/quotations/src/utils/group-annotations-by-source.ts`) scopes a group to a single `cit` id, so annotations behind *other* markers citing the same file are invisible to the mapper — even though `annotationToPdfCanvasContent` already re-filters by `attachment.url`.

## Solution

Extend the existing PDF citation-preview pipeline to Office documents, reusing its exact shape at every layer.

- **`libs/chat-shared`** gains the three Office selector wire types and keeps the open unknown-selector branch intact, so an unrecognised selector still parses.
- **`libs/quotations`** gains validation/normalisation for those selectors (including the inclusive→exclusive offset conversion below) and a same-source gathering helper that keys on the source attachment URL rather than the display title — two files can share a title, they cannot share a URL.
- **`libs/chat-hooks`** gains `annotationToOoxmlCanvasContent`, a direct sibling of `annotationToPdfCanvasContent`, producing a resolved, host-agnostic `OoxmlCanvasContent` with `highlights` + `selectedHighlightId`.
- **`libs/attachment-canvas`** owns OOXML layout resolution and overlay rendering. It receives already-resolved, host-agnostic highlight descriptors — never a DIAL URL scheme, never a conversation, never an app context — and turns them into rectangles using the same parsed bytes the viewer displays, via the shared-parse factories.
- **`apps/chat`** changes by one branch: try the Office mapper when the PDF mapper returns `null`, before the existing plain-attachment fallback.
- **`apps/chat-api`** widens `AnnotationSelectorDto` so the fields survive validation and appear in `openapi.json`. No new endpoint.

**Model to follow at each layer:** `annotationToPdfCanvasContent` for the mapper, `PdfContent`'s `selectedHighlightId` + `selectedPageNumber` props for the renderer contract, and `PdfContent`'s `ResizeObserver`-plus-poll geometry invalidation for keeping an overlay aligned against a viewer that exposes no change event.

### Offset semantics — a real, documented conflict

The upstream DIAL annotation contract defines `start`/`end` as **inclusive**, and `TextCharacterRangeSelector` in `libs/chat-shared/src/models/annotation.ts:1-9` documents them that way. The reference implementation for Office ranges computes overlaps with `slice(start, end)`, i.e. treats `end` as **exclusive**.

This proposal takes **the DIAL contract as normative**: `end` is inclusive on the wire. Normalisation converts to an exclusive internal boundary (`end + 1`) exactly once, at the library edge, before any `String.prototype.slice` or run-overlap arithmetic. The conflict is recorded rather than silently resolved, and boundary tests cover the two cases that expose an off-by-one: a one-character range (`start === end`) and a range whose `end` is the final character index.

### Unresolved upstream input

The DOCX and PPTX `type` discriminator strings are **not available**. The confirmed contract establishes only that they end in `_range` and that DOCX is distinguishable from PPTX structurally (`path` vs `slide`/`shape_id`). `excel_rc_range` **is** confirmed.

Planning proceeds on the confirmed structural contract. Obtaining a captured `dial-document` response fixture is an **implementation prerequisite**, tracked as the first task: named type guards replace structural discrimination before the feature ships. Generic `_range`-suffix matching must not become the permanent public contract.

## What Changes

- **New** Office selector wire types in `libs/chat-shared/src/models/annotation.ts`: `DocxRangeSelector`, `PptxRangeSelector`, `ExcelRcRangeSelector`, added to the `AnnotationSelector` union **without** closing its open `{ type: string; [key: string]: unknown }` branch.
- **New** selector validation/normalisation in `libs/quotations/src/utils/annotation.ts`, including inclusive→exclusive offset conversion and rejection of malformed/out-of-range selectors.
- **New** same-source annotation gathering keyed on `body.source.attachment.url`.
- **New** `annotationToOoxmlCanvasContent` in `libs/chat-hooks/src/files/attachment-canvas.ts`.
- **Changed** `OoxmlCanvasContent` gains optional `highlights?` and `selectedHighlightId?`. Both optional — existing plain Office previews are unaffected.
- **Changed** `OoxmlContent` switches to shared-parse acquisition (`DocxDocument.load` + `DocxScrollViewer.fromDocument`, `PptxPresentation.load` + `PptxScrollViewer.fromPresentation`) **only when highlights are requested**, adds an absolutely-positioned overlay layer, resolves rectangles from `collectPageRuns` / `collectSlideRuns` / `getCellViewportRect`, and navigates to the selected highlight.
- **Changed** `handleCitationPreview` tries the Office mapper before the plain-attachment fallback.
- **Changed** `AnnotationSelectorDto` accepts the Office selector fields so `whitelist`/`forbidNonWhitelisted` stop discarding or rejecting them; `npm run openapi` regenerates the client.
- **Unchanged** PDF citation preview, ordinary Office preview without a selector, and CSV. CSV is out of scope — citation selectors target Office documents only.

## Capabilities

### New Capabilities

- `office-annotation-highlighting`: Office (DOCX/PPTX/XLSX) citation location resolution and highlight rendering — selector typing and normalisation, annotation-to-canvas mapping, OOXML layout resolution against the displayed parse, overlay rendering and navigation, graceful fallback, viewer lifecycle, geometry invalidation, accessibility, RTL geometry exemptions, and performance.

### Modified Capabilities

- `message-annotations`: the `AnnotationSelector` union gains three Office selector shapes; `normalizeRawAnnotations` preserves them; the inclusive-`end` convention is stated normatively and the exclusive-boundary conversion point is fixed at the library edge.
- `attachment-canvas-ooxml-viewer`: `OoxmlCanvasContent` gains optional highlight fields; the `OoxmlContent` renderer gains shared-parse acquisition, an overlay layer, and navigation; lazy per-format loading is preserved.
- `canvas`: the citation-preview requirement extends from PDF-only to Office documents, mirroring the existing "PDF citation preview navigates to the annotation's referenced page independent of highlight geometry" requirement.
- `chat-api-backend`: `AnnotationSelectorDto` widens to carry Office selector fields through request validation and into the generated client.

## Non-goals

- **CSV highlighting.** Citation selectors target Office documents; CSV is delimited text with no OOXML layout model.
- **Multi-row / rectangular XLSX ranges.** The confirmed contract's use case is a single cell or a contiguous same-row range. A multi-row range resolves to no highlight rather than a wrong one.
- **Rotated / flipped PPTX shape geometry.** `PptxTextRunInfo` carries `rotation`, `shapeFlipH`, `shapeFlipV`, and `textBodyRotation`. Unrotated shapes are in scope; a rotated shape falls back to no highlight rather than a misplaced rectangle.
- **Quote-text search as a fallback.** Explicitly rejected — see Alternatives.
- **Editing, commenting, or persisting highlights.** Read-only preview.
- **Backfilling conversations already persisted with stripped selectors.** Unrecoverable; those citations keep today's no-highlight behaviour.
- **A new backend endpoint.** Inspection proved a DTO gap, not an endpoint gap.

## Alternatives considered

| Option | Correctness | API compatibility | Performance | Lifecycle complexity | Bundle | Rollback |
| --- | --- | --- | --- | --- | --- | --- |
| **A. Overlay + resolver on the existing scroll viewers** (`new DocxScrollViewer(...)` then `load(url)`, resolve rects from a second parse) | Same rect math, but the resolver's parse can disagree with the viewer's — different `LoadOptions`, different progressive-layout state | Uses only today's constructor path | **Parses and lays out every document twice** | Two independent lifecycles to keep in sync | No change | Trivial |
| **B. Shared parse — `Engine.load()` then `Viewer.fromDocument/fromPresentation()`** ← **chosen** | Rects come from the *same* parsed bytes the viewer paints, which is the correctness property the feature needs | A documented first-class mode in 0.86.1; `from*()` returns `Omit<Viewer,'load'>` and `destroy()` deliberately leaves the borrowed engine alive | One parse | Caller owns the engine and must destroy it after the viewer — real, but explicit and testable | No change (same entry points) | Highlight path is additive; drop the `highlights` prop and behaviour reverts |
| **C. Quote-search fallback** (`viewer.findText(quote)`) | **Unacceptable.** A quote appearing 5× highlights the wrong occurrence, with no way to tell. Non-deterministic against a user-visible surface | Public API | Full-document scan per citation | Simple | No change | Trivial |
| **D. No-location baseline** (today) | Correct but useless — the feature does not exist | n/a | Free | None | None | n/a |

**Chosen: B.** The whole value of the feature is that the highlight lands on the cited text; a rectangle derived from a *different* parse than the one on screen can be silently wrong, which is worse than no highlight. B is the only option where the resolver and the renderer cannot disagree, it is the vendor's documented answer to exactly this multi-view problem, and it removes A's double parse rather than adding cost. Its one real price — the caller owning engine teardown — is bounded and directly testable.

**A rejected** because a second parse is both slower and a correctness hazard. **C rejected** as a fallback in any form: the request permits quote searching only behind a deterministic, independently testable matching policy, and no such policy exists for a quote with multiple occurrences. When a selector is missing, unsupported, ambiguous, malformed, or unresolvable, the document opens **without** a highlight. **D** is the status quo this change exists to replace.

**Scope creep flagged:** this change touches three shared libs (`chat-shared`, `quotations`, `chat-hooks`) plus `attachment-canvas` and one backend DTO. That breadth is inherent — the selector data is discarded at the backend edge and must survive every layer to reach the renderer — but it is real, and the slicing in `tasks.md` is risk-first so the riskiest layer (OOXML resolution) is proven before the wire types are widened everywhere.

## Library isolation

`libs/attachment-canvas` receives resolved, host-agnostic preview data only: a download/object URL, a format enum, and highlight descriptors expressed in document coordinates (story/path/offsets, slide/shape/offsets, sheet/row/col). It constructs no `/api` path, imports no `server-api` module or app context, and knows nothing about DIAL authentication, storage keys, routing, or feature flags. DIAL file-id resolution stays where it already is — the `AttachmentCanvasUrlResolvers` callbacks injected by the host into `libs/chat-hooks` (`resolveDialFileDownloadUrl`, `resolveDialUrl`).

`libs/quotations` and `libs/chat-hooks` stay on the same footing as the existing PDF mapper: pure data transformation over `Annotation` values, with host URL resolution passed in.

## Acceptance criteria

1. Clicking **Preview** on a DOCX citation opens the document, scrolls to the cited page, and draws a visibly *selected* highlight over the cited character range — matched by both `story` and `path`, excluding synthesized runs, with partial-run rectangles computed from rendered font metrics and adjacent same-line rectangles merged.
2. The same holds for a PPTX citation, matched by 1-based `slide` and `shape_id` (compared as strings), scrolling to that slide.
3. The same holds for an XLSX citation: the sheet is found by name, switched to when it is not active, the starting cell is scrolled into view before measuring, and rectangles come from `getCellViewportRect` for a single cell or a contiguous same-row range.
4. Resolved DOCX/PPTX text is validated by comparing the resolved run text over the exclusive range against the selector's `text`. A mismatch yields **no highlight** and a still-usable preview.
5. A missing, unsupported, ambiguous, malformed, or unresolvable selector opens the document with no highlight and no error state. No quote searching occurs.
6. `body.selector` works as a single object or an array; one valid selector may yield several rectangles; several annotations for one source render together with exactly one marked selected.
7. Two attachments sharing a display title but differing in URL never merge, and never leak each other's highlights.
8. Highlights stay aligned across resize, refit, zoom, page/slide navigation, XLSX scrolling, and XLSX sheet switching.
9. Replacing or reloading the document destroys the previous viewer **and** the borrowed engine, removes stale overlays, and never applies an async result after unmount.
10. Opening a DOCX does not load the PPTX or XLSX renderer chunk; no document is parsed twice.
11. PDF citation preview, ordinary Office preview without a selector, and CSV preview are unchanged, proven by regression tests.
12. Office selector fields survive `ValidationPipe` and appear in `libs/chat-api-client/openapi.json`; `npm run openapi:check` passes.
13. Named DOCX/PPTX type guards — not `_range`-suffix matching — are in place before the feature is considered complete.

## Backward compatibility and rollback

**Not breaking.** Every addition is optional or additive:

- `AnnotationSelector` gains union members while retaining its open catch-all branch, so previously-unrecognised selectors keep parsing exactly as before.
- `OoxmlCanvasContent.highlights` / `.selectedHighlightId` are optional. Absent them, `OoxmlContent` takes its current self-loading `new Viewer(...)` + `load(url)` path verbatim — the shared-parse path is entered **only** when highlights are requested, so a plain Office preview's behaviour, lifecycle, and bundle are untouched.
- `AnnotationSelectorDto` only *widens* an allowlist; payloads that validate today continue to validate.
- Conversations persisted before this change simply have no Office selectors and keep today's no-highlight preview.

**Rollback** is two independent steps, either of which can be taken alone: stop passing `highlights` from `annotationToOoxmlCanvasContent` (highlighting disappears, previews keep working), or revert the `handleCitationPreview` branch (Office citations return to the plain-attachment fallback). The backend DTO widening is safe to leave in place either way, since it only accepts more input than before.

**No feature flag.** Inspection found none for this preview capability — `attachment-canvas-ooxml-viewer` records explicitly that the OOXML viewer "is not gated behind `ENABLED_FEATURES` or `ENABLED_FEATURES_ROLES`". This change follows that precedent rather than introducing the repo's first gate here.

## i18n

Two new user-visible strings, both accessibility-only, both following the libs convention of an English-defaulted `labels` prop (no `useTranslation` inside a lib), with app-side keys added to `apps/chat/src/i18n/locales/en.json` and `apps/chat/src/constants/translation-keys.ts`:

- an `aria-label` naming the highlight overlay region;
- an `aria-live` status announcing that the cited location has been brought into view, since scrolling a canvas produces no announcement of its own.

Exact key names are fixed in the delta spec. No visible label text is added.

## Impact

**Code**
- `libs/chat-shared/src/models/annotation.ts`, `src/index.ts`, `README.md`
- `libs/quotations/src/utils/annotation.ts`, `src/utils/group-annotations-by-source.ts`, `src/index.ts`, `README.md`
- `libs/chat-hooks/src/files/attachment-canvas.ts`, `README.md`
- `libs/attachment-canvas/src/components/OoxmlContent/`, `src/models/attachment-canvas.ts`, `src/utils/` (new OOXML resolution utilities), `src/index.ts`, `README.md`
- `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`, `src/i18n/locales/en.json`, `src/constants/translation-keys.ts`
- `apps/chat-api/src/conversations/dto/annotation.dto.ts`

**APIs** — no new endpoint. `AnnotationSelectorDto` widens, so `libs/chat-api-client/openapi.json` and the generated client regenerate.

**Dependencies** — none added. `@silurus/ooxml@0.86.1` is already installed; this uses APIs it already ships.

**Docs** — `docs/architecture.md` needs no structural entry (no new lib, app, backend domain, context, or route). Four lib READMEs change because public contracts change, so `npm run validate:docs` is required.

**Risks**
- The unresolved DOCX/PPTX discriminators are the top risk; the fixture prerequisite is task 1.
- Overlay alignment depends on `pageWidthPx = pageSize(i).widthPt * 1.3333 * getScale()`, a formula verified against the installed dist but not part of the vendor's public contract. The design records this and confines it to one function.
- `@silurus/ooxml` exposes no public per-page overlay mount, so the overlay is owned by this repo and positioned in the scroll host's coordinate space.
