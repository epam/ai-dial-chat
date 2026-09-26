## Context

Inline citations reach the frontend as `<cit data-id="…"></cit>` markers plus an annotation list. When the user clicks Preview on a PDF citation, `annotationToPdfCanvasContent` (`libs/chat-hooks/src/files/attachment-canvas.ts:458`) builds the `PdfCanvasContent` the canvas renders, and it gets the two pieces of document location from `libs/quotations`:

- `annotationsToPdfHighlights(annotations)` → `InputHighlightData[]` for the highlighter
- `getAnnotationPdfPage(annotation)` → the 1-based page to scroll to

Both functions live in `libs/quotations/src/utils/annotation.ts` and both filter on `s.type !== 'pdf_bbox'`. That is the whole bug: a document application emitting `pdf_region` gets an unhighlighted PDF opened at the viewer's default page.

Two facts from the current code shape the design:

1. **`pdf_region` already exists in the repo, but only on the path this bug does not use.** `normalizePdfRegionToBbox` in `libs/chat-shared/src/utils/annotation.ts:63` converts `pdf_region` → `pdf_bbox`, and it handles only `{ left, top, width, height }`. It is reachable exclusively from `normalizeAttachmentIndexAnnotation` — the legacy `target.source.attachment_index` wire shape. The modern `html_tag` path (`normalizeHtmlTagAnnotation`, same file) puts `body.selector` through `normalizeBodySelector`, which only checks that each entry is an object carrying a string `type`. A `pdf_region` body selector therefore arrives at `libs/quotations` verbatim.
2. **`AnnotationSelector` is an open union.** Its last member is `{ type: string; [key: string]: unknown }` (`libs/chat-shared/src/models/annotation.ts:101`), so a `pdf_region` selector is already a well-typed `AnnotationSelector` and needs no model change to flow through. The existing code in this file (`isDocxRangeSelector` and friends) reads unknown fields by casting to `Record<string, unknown>` and type-guarding each one; the new reader follows that established shape.

Constraint from `AGENTS.md` §Library isolation: `libs/quotations` is host-agnostic. The reader is a pure function over types `@epam/ai-dial-chat-shared` already owns — no URL building, no app context, no new dependency — so isolation is preserved without an app-level adapter. No lib manifest changes, so `.claude/rules/libs.md` does not come into play.

## Goals / Non-Goals

**Goals:**

- Equivalent selectors in `pdf_bbox`, `pdf_region` `lt`/`wh`, and `pdf_region` `left/top/width/height` form produce byte-identical highlight geometry and the same selected page.
- Highlight geometry and page navigation can never again diverge on which selector shapes they understand.
- Byte-for-byte compatibility for `pdf_bbox`, including its existing edge cases (all-zero boxes stay valid, malformed entries are skipped, a missing page yields `undefined`).
- Malformed input never throws and never takes valid siblings down with it.
- Annotations and the persisted message format are untouched.

**Non-Goals:**

- No backend, `AnnotationSelectorDto`, OpenAPI, or generated-client change. The wire already carries these selectors; nothing new needs validating server-side.
- No change to `libs/chat-shared`'s wire normalizers, including no `lt`/`wh` support on the legacy `attachment_index` path (see D5).
- No `PdfRegionSelector` interface added to the `AnnotationSelector` union (see D4).
- No persistence migration, no PDF viewer replacement, no text-search fallback for quote-only citations.
- No change to the Office (DOCX/XLSX/PPTX) selector path.

## Decisions

### D1 — Normalize at the preview boundary, not at ingestion

The reader lives in `libs/quotations/src/utils/annotation.ts`, converting on each read, rather than rewriting `pdf_region` → `pdf_bbox` when annotations are normalized in `libs/chat-shared`.

*Why:* normalizing at ingestion would silently rewrite `body.selector` on every annotation the app holds, and `resolveMessageAnnotations` output is what the app re-persists — so the stored message would drift away from what the producer sent, breaking the "preserve the original annotations and persisted message format" requirement. It would also have to happen in two places (the streaming path in `apply-chunk.ts` and the load path), and a third on the server (`apply-chunk-annotations.server.ts`), each a separate compatibility surface. Converting where the highlighter's coordinate shape is actually needed keeps one conversion point and leaves the data as received.

*Alternative considered:* convert inside `libs/attachment-canvas`, closer to the highlighter. Rejected — `annotationsToPdfHighlights` already returns `InputHighlightData`, so the conversion would sit downstream of the function whose type contract already commits to the box shape, and `getAnnotationPdfPage` (which does not flow through `attachment-canvas`) would need its own copy.

### D2 — One reader over one selector, returning the box or `undefined`

The shared unit is `readPdfSelectorBox(selector: AnnotationSelector): BBox | undefined`, where `BBox` is the `{ x1, y1, x2, y2, page }` interface `@epam/pdf-highlighter-kit` already exports and `InputHighlightData.bboxes` is typed as. `annotationsToPdfHighlights` maps a selector list through it and keeps every defined result; `getAnnotationPdfPage` maps through it and takes the first defined result's `page`.

*Why one reader rather than a shared type-guard plus two conversions:* the acceptance criterion is that geometry and page agree. A guard-only abstraction lets the two call sites keep independently-written validation (which is exactly how today's code ended up with `getAnnotationPdfPage` checking `typeof s.page === 'number' && Number.isInteger` while `annotationsToPdfHighlights` checks `Number.isInteger` and also the coordinates). Returning the finished box makes agreement structural: if geometry is rejected, the page is rejected with it.

`InputHighlightData.bboxOrigin` stays unset, exactly as today. The kit's `lt` naming (left-top) and the existing `pdf_bbox` edges are both read under the viewer's default origin, and a region rectangle converted to the same edges needs no different interpretation — so this change introduces no origin handling and no `bboxSourceDimensions`.

*Consequence worth stating:* `getAnnotationPdfPage` becomes slightly stricter — a selector with a valid page but non-finite coordinates no longer yields a page. That is the intended unification, and it matches the existing spec sentence "Highlight generation SHALL ignore malformed selectors, invalid pages, and non-finite coordinates". A selector with a valid page and *finite* coordinates, including all-zero ones, still yields its page, which is the only case the existing scenarios actually exercise.

### D3 — `lt`/`wh` wins when a bbox carries both forms

The reader checks `lt`/`wh` first and falls back to `left/top/width/height`.

*Why:* the two forms are alternative encodings of the same rectangle, so a producer sending both is either transitional or buggy; either way a fixed precedence is more debuggable than merging or rejecting. `lt`/`wh` is the current format and `left/top/width/height` is explicitly the legacy one, so preferring the current form means a producer that adds `lt`/`wh` alongside its legacy fields is read the new way immediately.

*Alternative considered:* reject a bbox carrying both, as ambiguous. Rejected — it turns a harmless overlap into a lost highlight, which is the failure mode this change exists to remove.

### D4 — No new member on the `AnnotationSelector` union

`pdf_region` is read through a `Record<string, unknown>` cast inside the reader, with a local non-exported type for the parsed bbox. No `PdfRegionSelector` interface is added to `libs/chat-shared`.

*Why:* the union's open catch-all already types these selectors, so an interface buys no compile-time safety at the boundary — the data arrives as `unknown` from the wire and must be runtime-validated regardless. Adding a member to the union is a public API change to `@epam/ai-dial-chat-shared` (README, `validate:docs`, narrowing behavior in every `switch` over the union) in exchange for nothing the runtime check does not already provide. Note the existing `isDocxRangeSelector` precedent does both — but there the exported guard is part of the lib's public API and the interface predates it; here nothing outside the reader needs to name the shape.

*Revisit if:* a second consumer outside `libs/quotations` needs to recognise `pdf_region`. Then the shape is shared vocabulary and belongs in the model.

### D5 — Leave `chat-shared`'s legacy `attachment_index` normalizer alone

`normalizePdfRegionToBbox` keeps handling only `{ left, top, width, height }`, so a legacy `attachment_index` annotation whose `pdf_region` uses `lt`/`wh` is still dropped during normalization (it returns `null`, and the whole annotation with it).

*Why:* the requested scope is the `body.selector` preview boundary, and the two producers are disjoint in practice — the `lt`/`wh` form appears on the modern `html_tag` path, the `attachment_index` shape is the legacy wire format that predates it. Widening the legacy normalizer would mean a matching server-side change in `apps/chat-api/src/conversations/utils/apply-chunk-annotations.server.ts` (which mirrors it, deliberately without a shared import) plus its spec, i.e. exactly the backend work this change excludes.

*Stated explicitly as a known gap* rather than left implicit, because it is the one combination of formats this change does not make work. If it is ever observed, it is a small follow-up touching both mirrors together.

### D6 — Tests assert equivalence across formats, not per-format output

The core regression test builds the same rectangle in all three formats and asserts the three results are equal, in addition to asserting one expected box literal. `x2 = 58.752 + 492.048 = 550.8` is exact in IEEE 754 binary floating point, but `y2 = 383.328 + 29.304` is not — it evaluates to `412.63199999999995`. Rather than special-case that coordinate, the expected literal computes `y2` with the same expression (`383.328 + 29.304`) the reader itself runs, so the assertion still uses plain equality without an epsilon: both sides perform the identical floating-point addition and land on the identical bit pattern.

## Risks / Trade-offs

- **`getAnnotationPdfPage` gets stricter about coordinates (D2)** → Only affects a selector with a valid page and non-finite coordinates, which no current test or observed payload produces, and which already produced no highlight. The delta spec's "Missing or invalid page data" scenario is reworded to cover it, and a unit test pins the behavior so it is a decision on record rather than an accident.
- **A producer using some fourth region encoding still silently yields nothing** → Unchanged from today, and a silent skip is the required behavior (no throwing, no dropped siblings). The mitigation is structural rather than defensive: one reader means one place to add a shape, and the spec enumerates exactly what is recognised.
- **Legacy `attachment_index` + `lt`/`wh` remains unsupported (D5)** → Documented in the design and the change's out-of-scope list rather than discovered later from a blank preview.
- **The canvas spec's prose sections name `pdf_bbox` as the only mapped type** (`openspec/specs/canvas/spec.md` "PDF sources (highlights)" step 2/6 and "Selector type") → These sit outside any `### Requirement:` block, so the archive merge will not touch them; a task updates them explicitly.

## Migration Plan

None required — additive and backward compatible. No data migration, no version gate, no feature flag. Rollback is reverting the commit: `pdf_bbox` behavior is unchanged by construction, so a revert restores the prior state exactly and only re-loses `pdf_region` highlighting.

## Open Questions

None blocking. The `lt`/`wh` precedence (D3) and the legacy-normalizer gap (D5) are recorded decisions rather than open questions; both are cheap to revisit if a real payload contradicts them.
