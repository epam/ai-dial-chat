## 1. Red tests (fail on current code)

- [x] 1.1 Add a regression test in `libs/chat-hooks/src/files/tests/attachment-canvas.spec.ts`: two `html_tag` citations with distinct `cit` ids, both citing one PDF with a `pdf_bbox` on the same page (one near the top, one near the bottom) and no `annotation.index`, grouped with `groupAnnotations`, MUST yield different `selectedHighlightId` values from `annotationToPdfCanvasContent`, with each id present in that call's own `highlights`.
- [x] 1.2 Add tests in `libs/quotations/src/utils/tests/` for the id helper: `annotationHighlightId` and `annotationsToPdfHighlights` agree for the same annotation; `annotation.index` still wins (`index: 7` → `'7'`); two annotations differing only in `cit` id, or only in selector geometry, get different ids; the same annotation mapped twice gets the same id.
- [x] 1.3 Add a test that two annotations sharing one `cit` id but carrying different `docx_text_range` selectors (no `index`) get different ids, so `annotationToOoxmlCanvasContent` returns two distinct highlights — the OOXML non-regression case.
- [x] 1.4 Add a test that every produced id is CSS-attribute-selector-safe (matches `/^[A-Za-z0-9_-]+$/`), since `@epam/pdf-highlighter-kit` interpolates it into `[data-term-id="<id>"]`.
- [x] 1.5 Run the three suites and confirm 1.1–1.4 fail for the documented reason (`npm run test:file -- <path>` per file).

## 2. Implementation in `libs/quotations`

- [x] 2.1 In `libs/quotations/src/utils/annotation.ts`, add an internal `annotationSelectorDigest(annotation)` helper that folds the annotation's `body.selector` entries (single object or array, in order) into one canonical string: PDF entries via the existing selector reader's resolved `{ page, x1, y1, x2, y2 }`, Office entries by their discriminating fields (`docx_text_range`: `story`/`path`/`start`/`end`; `pptx_text_range`: `slide`/`shape_id`/`start`/`end`; `excel_rc_range`: `sheet`/`start`/`end`; `docx_text_anchor`/`pptx_text_anchor`: `cells`/`occurrence`/`slide`). Non-throwing for `null`, primitives, and unrecognised shapes.
- [x] 2.2 Add an internal djb2 → base36 hash and an `annotationIdentityKey(annotation)` helper that combines the `html_tag` `cit` id (when the annotation's `target.selector` is `html_tag`) with the digest, returning `undefined` when neither part exists.
- [x] 2.3 Rewrite `annotationHighlightId(annotation, fallbackIndex)` to resolve `String(annotation.index)` → identity key → `String(fallbackIndex)`, and make `annotationsToPdfHighlights` call it with the input position instead of inlining `String(annotation.index ?? i)`, so both cannot drift.
- [x] 2.4 Update the JSDoc on both exported functions (and the `annotationsToPdfHighlights` block comment that currently states "`annotation.index` when present, otherwise the position in the input array") to describe the new resolution order and the opaque-id contract.
- [x] 2.5 Confirm the tests from group 1 now pass, and that no host/app knowledge entered the lib (pure functions over `Annotation` fields only).

## 3. Verification

- [x] 3.1 Run the full suites for the three affected projects: `@epam/ai-dial-quotations`, `@epam/ai-dial-chat-hooks`, `@epam/ai-dial-attachment-canvas`; fix any existing assertion that pinned a group-position id.
- [x] 3.2 Run lint for the affected projects and `npm run verify:changed`.
- [x] 3.3 Sanity-check the end-to-end chain with a focused test (real `DocumentPreview`, stubbed `@epam/pdf-highlighter-kit`) or by reasoning against the investigation notes in `design.md`: distinct ids ⇒ the vendor re-issues `goToHighlight` on a same-page selection.

## 4. Documentation

- [x] 4.1 Update `libs/quotations/README.md` (the `annotationsToPdfHighlights` / `annotationHighlightId` entries) to state the new id derivation and that ids are opaque and must not be parsed.
- [x] 4.2 Run `npm run validate:docs`.
- [x] 4.3 Note for the archive step (`/opsx:archive`): besides merging the delta requirement blocks, correct the narrative prose in `openspec/specs/canvas/spec.md` that still states the old formula — the citation-flow walkthrough step "The highlight `id` is `annotation.index` when present, otherwise the annotation's position in the group" and the neighbouring `selectedHighlightId` line — so the archived spec does not contradict its own requirements.
