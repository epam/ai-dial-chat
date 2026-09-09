## 1. Slice A — Extraction utility: `getAnnotationPdfPage` in `libs/quotations`

- [x] 1.1 Add `getAnnotationPdfPage(annotation: Annotation): number | undefined` to `libs/quotations/src/utils/annotation.ts`, co-located with `annotationsToPdfHighlights`/`annotationHighlightId`. Read `annotation.body?.selector` (single object or array via `Array.isArray`), take the first entry with `type === 'pdf_bbox'`, and return its `page` only when `Number.isInteger(page) && page >= 1`; otherwise return `undefined`. Do not read `body.title` or any other display text.
- [x] 1.2 Export `getAnnotationPdfPage` from `libs/quotations/src/index.ts` alongside the existing `annotationsToPdfHighlights`/`annotationHighlightId`/`normalizeRawAnnotations`/`resolveMessageAnnotations` export block.
- [x] 1.3 Add `libs/quotations/src/utils/tests/annotation.spec.ts` covering only the new function (the pre-existing `annotationsToPdfHighlights`/`annotationHighlightId` have no tests today — out of scope, do not add tests for them here): a single `pdf_bbox` selector with a valid page; an array of selectors where a `pdf_bbox` entry is not first; an array with no `pdf_bbox` entry (returns `undefined`); a `pdf_bbox` selector with `page` missing, `0`, negative, or non-integer (returns `undefined`); an annotation with no `body.selector` at all (returns `undefined`); an all-zero-coordinate `pdf_bbox` selector still returns its `page` (coordinates are irrelevant to this function).
- [x] 1.4 Update `libs/quotations/README.md`'s Utilities list (after the `annotationsToPdfHighlights` bullet) to document `getAnnotationPdfPage(annotation)`.

**Verification**: `npm run test:file -- libs/quotations/src/utils/tests/annotation.spec.ts`

## 2. Slice B — `PdfCanvasContent.page` and the two content builders

- [x] 2.1 Add `page?: number` to the `PdfCanvasContent` interface in `libs/attachment-canvas/src/models/attachment-canvas.ts:49-58`, with a one-line JSDoc: 1-based page to navigate to on initial load, independent of highlight geometry.
- [x] 2.2 In `libs/chat-hooks/src/files/attachment-canvas.ts`, import `getAnnotationPdfPage` from `@epam/ai-dial-quotations` (alongside the existing `annotationHighlightId`/`annotationsToPdfHighlights`/`parsePdfPageReference` import) and set `page: getAnnotationPdfPage(annotation)` in the object `annotationToPdfCanvasContent` returns (`:416-439`).
- [x] 2.3 In the same file, set `page: parsed.page` in the page-present return branch of `referenceAttachmentToPdfCanvasContent` (`:460-477`); leave the no-page-fragment branch (`:461`) unchanged.
- [x] 2.4 Update `libs/chat-hooks/src/files/tests/attachment-canvas.spec.ts`:
  - Add tests for `annotationToPdfCanvasContent` (currently has zero coverage per investigation): returns `page` matching a single-annotation `pdf_bbox` selector's page; returns `page` for the clicked annotation in a two-page group without falling back to the group's first/primary annotation's page; returns `page: undefined` when the annotation has no `pdf_bbox` selector; returns the correct `page` when the selector's bbox coordinates are all zero.
  - Extend the existing `referenceAttachmentToPdfCanvasContent` "builds a PDF canvas payload with a page-scoped invisible highlight" test (`:431-452`) to also assert `page: 81`; extend the "no page anchor" test (`:454-468`) to assert `page` is `undefined`.

**Verification**: `npm run test:file -- libs/chat-hooks/src/files/tests/attachment-canvas.spec.ts`

## 3. Slice C — `PdfContent` navigates from `selectedPageNumber`, independent of highlight lookup

- [x] 3.1 Add `selectedPageNumber?: number` to `PdfContentProps` in `libs/attachment-canvas/src/components/PdfContent/PdfContent.tsx` (`:142+`), with a one-line JSDoc matching the vendor prop's own wording ("Navigate viewer to this page when provided.").
- [x] 3.2 Destructure `selectedPageNumber` in the component's props (`:184` area, alongside `selectedHighlightId`).
- [x] 3.3 Update the `selectedPage` lazy `useState` initializer (`:237-241`) to return `selectedPageNumber` first when it is not `null`/`undefined`, falling back to the existing highlight-bbox lookup, then `1`.
- [x] 3.4 Update the `selectedPage` sync `useEffect` (`:258-263`) to call `setSelectedPage(selectedPageNumber)` when `selectedPageNumber != null` (added to the effect's dependency array), before/instead of the existing highlight-bbox lookup branch — do not change behavior when `selectedPageNumber` is absent.
- [x] 3.5 Pass `selectedPageNumber={selectedPageNumber}` to the `<DocumentPreview>` element (`:600-614`).
- [x] 3.6 Leave the no-highlight `navigateToPage(1)` fallback effect (`:451-457`) unchanged — its guard (`!isViewerReady || selectedHighlightId`) already only applies to opens with neither a highlight nor a page, which this change does not affect.
- [x] 3.7 Update `libs/attachment-canvas/src/components/PdfContent/tests/PdfContent.spec.tsx`: add a test asserting the mocked `DocumentPreview` receives `selectedPageNumber` unchanged from the prop; add a test asserting `selectedPage`'s initial value (surfaced via the page-number `Input`'s value, per the existing page-navigator test pattern) is `selectedPageNumber` when provided, even when `highlights` is empty or contains only a zero-area bbox that does not match `selectedHighlightId`; add a test asserting that when `selectedPageNumber` is absent, existing highlight-bbox-derived behavior is unchanged (regression guard for this slice).

**Verification**: `npm run test:file -- libs/attachment-canvas/src/components/PdfContent/tests/PdfContent.spec.tsx`

## 4. Slice D — Thread `content.page` through `AttachmentCanvasBody`

- [x] 4.1 In `libs/attachment-canvas/src/components/AttachmentCanvasBody/AttachmentCanvasBody.tsx` (`:349-354`), pass `selectedPageNumber={content.page}` to the rendered `<PdfContent>` element, alongside the existing `url`/`highlights`/`selectedHighlightId` props.
- [x] 4.2 Update `libs/attachment-canvas/src/components/AttachmentCanvasBody/tests/AttachmentCanvasBody.spec.tsx`: add a test asserting that when `content.page` is set on a `PdfCanvasContent`, the rendered `PdfContent` (or its lazy-loaded mock) receives `selectedPageNumber` equal to that value; assert it is `undefined` when `content.page` is absent (regression guard).
- [x] 4.3 Update the `PdfCanvasContent` row's description in the Content Types table of `libs/attachment-canvas/README.md` (currently "Renders a PDF with highlight support") to also mention page-accurate navigation.

**Verification**: `npm run test:file -- libs/attachment-canvas/src/components/AttachmentCanvasBody/tests/AttachmentCanvasBody.spec.tsx`

## 5. Slice E — End-to-end regression coverage and non-PDF/non-citation guards

- [x] 5.1 In `libs/chat-hooks/src/files/tests/attachment-canvas.spec.ts` (or a small new integration-style test in the same file), assert the full chain for a two-page-in-one-group scenario: build two annotations in one `AnnotationGroup` targeting the same PDF at pages 2 and 9, call `annotationToPdfCanvasContent` once per annotation, and assert each call's `page` matches that annotation's own page (not the group's first/primary annotation) — directly covering acceptance criterion "a grouped citation opens the page belonging to the currently selected annotation." (Done as part of Slice B, task 2.4 — see the "sets page from the clicked annotation in a two-page group, not the group primary" test.)
- [x] 5.2 Confirm (no code change expected) that `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`'s `handleCitationPreview` (`:292-303`) still forwards the exact clicked annotation unchanged into `annotationToPdfCanvasContent` — if a pre-existing test for `ConversationMessageItem` already covers citation preview, confirm it still passes; do not add new tests here unless a gap is found (scope discipline — this file is not being edited). (Confirmed: no code change made to this file; no pre-existing citation-preview test exists to cover, and none added, per scope discipline; `ConversationMessageItem.spec.tsx` re-run and still passes in full.)
- [x] 5.3 Add/confirm a test that a non-PDF annotation (`source.type !== 'application/pdf'`) still routes through `annotationToDisplayAttachment`/`onAttachmentPreview` unchanged — i.e. `annotationToPdfCanvasContent` continues to return `null` and `page` is never considered for non-PDF sources. (Done as part of Slice B, task 2.4 — see the "returns null when the annotation source is not a PDF" test.)
- [x] 5.4 Add/confirm a test that a direct (non-citation) PDF attachment open via `resolvePdfCanvasContent` produces a `PdfCanvasContent` with no `page` field, and that `PdfContent`/`AttachmentCanvasBody` fall back to the existing page-1 default for it (regression guard for acceptance criterion "existing direct PDF attachment previews without citation page data continue to open with their current behavior"). (Confirmed via existing, unmodified `resolvePdfCanvasContent` tests — `resolvePdfCanvasContent` was not touched by this change and its `toEqual({ type, url })` assertions confirm no `page` key is present; `PdfContent`'s "computes an unclamped target..." test and the new "falls back to the existing highlight-derived page when selectedPageNumber is absent" test confirm the page-1/highlight-derived default is preserved when no page data is supplied.)

**Verification**: `npm run test:file -- libs/chat-hooks/src/files/tests/attachment-canvas.spec.ts` and `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx` (only if that spec file already exists and is touched by 5.2)

## 6. Slice F — Docs and full verification

- [x] 6.1 Run `npm run validate:docs` after the README edits in tasks 1.4 and 4.3 and fix any reported drift.
- [x] 6.2 Run `npm run verify:changed` once, after slices A–E are complete, to confirm typecheck/lint/build/test pass for every changed project (`quotations`, `chat-hooks`, `attachment-canvas`). (`typecheck:affected` also surfaces two pre-existing, unrelated issues on this branch, confirmed via `git stash` to exist without any of this change's edits: `@epam/chat-api:typecheck` — 806 stale-`tsbuildinfo` `TS6305` errors across `auth`/`toolsets`/`transcription`/`user-config`/`themes`, none of which this change touches; and `create-files-api.spec.ts` — 2 pre-existing `object.stream is not a function` failures unrelated to PDF/annotation code. Verified directly instead: `quotations`, `chat-hooks`, `attachment-canvas` all pass typecheck and lint cleanly; their full test suites pass except those 2 pre-existing failures; `@epam/chat` typecheck passes after rebuilding `chat-hooks`'s dist, which was stale relative to unrelated pre-existing source additions.)
- [ ] 6.3 Close the change with exactly one `npm run verify:full`.
