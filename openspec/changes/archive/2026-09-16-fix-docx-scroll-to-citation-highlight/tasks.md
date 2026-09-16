Scope note: the working tree's uncommitted `fix-docx-citation-highlight-alignment` work (scale-free DOCX rectangles, reference-width run collection, the container `ResizeObserver`) is the baseline. Nothing below reverts or rewrites it. Preserve all uncommitted work — do not reset, discard, stage, or commit it as part of this change.

Verification convention: use `npm run test:file -- <path>` for the red/green loop inside a slice and `npm run verify:changed` at each slice boundary, per `openspec/config.yaml`. Run `npm run verify:full` once before completion.

## 1. Scroll-target geometry (pure, no behaviour change)

- [x] 1.1 Add `DOCX_NAVIGATION_LEAD_FRACTION` (0.25) beside `OOXML_SCROLL_GAP_DEFAULT` in `libs/attachment-canvas/src/utils/ooxml-highlight-geometry.ts`, with a JSDoc stating it is a tuning constant, not a spec requirement (design D7).
- [x] 1.2 Add an exported pure helper `resolveDocxScrollTarget` to the same file: given the page index, the page-box-fraction rect (`OoxmlDocxNormalizedRect`), `sizeAt`, the host's `clientWidth`/`clientHeight`, and the host's `scrollHeight`/`scrollWidth`, return `{ top, left }` clamped to the scrollable range. It MUST compose `resolveSurfaceOffset` rather than reimplement page stacking (design D1); JSDoc must say so and must state that its coordinates are physical canvas geometry, not logical (spec: RTL clause of the passage-level requirement).
- [x] 1.3 Have `resolveDocxScrollTarget` return `left` unchanged from the host's current `scrollLeft` when the rect already falls inside the host's horizontal viewport, so fit-width previews stay at `scrollLeft: 0` (design D2).
- [x] 1.4 Unit-test the helper in `libs/attachment-canvas/src/utils/tests/ooxml-highlight-geometry.spec.ts`: a mid-page rect on page 0; the same rect at scale 2 producing a proportionally larger offset; a rect on page 3 accounting for gap + preceding page heights; clamping at the document start (target would be negative) and end (target exceeds `scrollHeight - clientHeight`); a passage taller than the viewport aligning its start; and horizontal position left untouched when the rect is already in view.
- [x] 1.5 `npm run test:file -- libs/attachment-canvas/src/utils/tests/ooxml-highlight-geometry.spec.ts` green, and the pre-existing tests in that file untouched and still passing (acceptance criterion 11).

## 2. Navigation outcome contract

- [x] 2.1 Add `OoxmlNavigationOutcome` as a string enum (`Navigated`/`Superseded`/`Unresolved`) in `libs/attachment-canvas/src/utils/ooxml-highlight-surfaces.ts`, per the repo's string-enum rule and design D4.
- [x] 2.2 Change `OoxmlHighlightSurface.navigate` to `Promise<OoxmlNavigationOutcome>` and update its JSDoc to state what each outcome means for the caller.
- [x] 2.3 Return the appropriate outcome from the PPTX surface (`Unresolved` for a wrong-kind or out-of-range slide, `Navigated` after `scrollToSlide`) and the XLSX surface (`Unresolved` for a wrong-kind location or unknown sheet, `Navigated` after `scrollToCell`), with no other behaviour change (spec: PPTX/XLSX retain current behaviour).
- [x] 2.4 Confirm `OoxmlHighlightSurface`, `OoxmlNavigationOutcome`, and the new geometry helper are **not** re-exported from `libs/attachment-canvas/src/index.ts`, so the lib's public API is unchanged and no README delta is owed (design "Migration Plan" step 4).

## 3. DOCX navigation rewrite

- [x] 3.1 Widen the `viewer` parameter type of `createDocxHighlightSurface` to also carry what navigation needs, and add `waitUntilLayoutComplete` to the `DocxDocument` shape the surface relies on — keeping both as the narrow structural types the file already uses rather than importing concrete vendor classes.
- [x] 3.2 Add a `navigationGeneration` counter to `createDocxHighlightSurface`; `navigate` increments and captures it, and re-checks it after **every** await — layout completion, each `collectPage` inside `findPages`, and rectangle resolution — returning `Superseded` on a mismatch without scrolling (design D4; spec: latest-selection-wins requirement).
- [x] 3.3 In DOCX `navigate`, await `docxDocument.waitUntilLayoutComplete()` before scanning, guarded by the existing `isDisposed()`; treat a rejection as `Unresolved` (design D3; spec: layout-readiness requirement). Do **not** add any await to `measure`.
- [x] 3.4 After the page is known, resolve the location's rectangles through the existing `resolveDocxRects` path, take the first rect on the first matching page, compute the target with `resolveDocxScrollTarget`, and apply it by writing the scroll host's own position (`host.scrollTo({ top, left, behavior: 'auto' })`, falling back to assigning `scrollTop`/`scrollLeft`). `Element.scrollIntoView` must not appear anywhere in the file (design D2; spec: scroll-containment requirement).
- [x] 3.5 Keep `viewer.scrollToPage(pageIndex)` as the path when a page is found but no rectangle resolves; return `Unresolved` and leave the viewer untouched when **no** page is found — remove the current `?? 0` fallback to page one (spec: "An unresolvable location does not jump to page one").
- [x] 3.6 Return `Unresolved` without scrolling when `findScrollHost` returns `null`, matching `measure`'s existing failure mode (spec: "A missing scroll host performs no scroll").
- [x] 3.7 Delete the `pageOfLocation` map and its two write/read sites; add a short comment on the surface explaining that `collectPage`'s per-page run cache is where the real cost is cached (design D6).

## 4. Renderer wiring

- [x] 4.1 Re-key the navigation effect in `libs/attachment-canvas/src/components/OoxmlContent/OoxmlContent.tsx` so it depends on `[selectedHighlightId, isLoading]` and reads the selected location through the existing `highlightsRef`, not through the `highlights` array identity (design D5; spec: "A repeated highlights array does not re-navigate").
- [x] 4.2 Reset `hasNavigated` to `false` when `selectedHighlightId` changes, and set it to `true` only when `navigate` resolves to `OoxmlNavigationOutcome.Navigated` (design D8; spec: "A second citation is also announced").
- [x] 4.3 Verify no invalidation signal reaches navigation: `scheduleRecompute` is still the only consumer of `onScaleChange`, `onVisiblePageChange`, the capturing `scroll` listener, and the `ResizeObserver`. Add a comment at the navigation effect stating that it is one-shot per selection by design (spec: "The user is not pulled back after navigating").
- [x] 4.4 Keep the existing effect-level `disposed` flag for the `setHasNavigated` guard — it is complementary to the surface's generation counter, not a duplicate (design D4).

## 5. Test doubles

- [x] 5.1 Extend the `DocxDocument` mock in `libs/attachment-canvas/src/components/OoxmlContent/tests/OoxmlContent.spec.tsx` to expose a controllable multi-page `pageCount`, a `waitUntilLayoutComplete()` whose promise a test can resolve or reject on demand, and a `pageCount` that starts **partial** and grows when that promise resolves — so the layout-readiness regression is exercised rather than assumed (design "Risks": test doubles diverge from the real vendor).
- [x] 5.2 Extend the mock `DocxScrollViewer.fromDocument` scroll host with controllable `clientWidth`/`clientHeight`/`scrollWidth`/`scrollHeight` and a recording `scrollTo`, so scroll targets can be asserted numerically.
- [x] 5.3 Add a spy that fails the test if `Element.prototype.scrollIntoView` is called during any DOCX navigation test (spec: chat page must not move).

## 6. Regression coverage

- [x] 6.1 Offscreen-within-page: a highlight low on a tall page results in a `scrollTo` whose `top` places the rect inside `clientHeight`, and is greater than the page's own top offset (acceptance criteria 1).
- [x] 6.2 Cross-page and directional switching: selecting a citation on a later page scrolls forward; then selecting one on an earlier page scrolls backward (acceptance criteria 2).
- [x] 6.3 Zoom: the same citation at scale 2 produces a proportionally larger `top`; assert the existing "navigates to the same cited page after a scale change" test still passes unchanged (acceptance criteria 3, 11).
- [x] 6.4 Resize: deliver a `ResizeObserver` entry with a new container size via `deliverResizeObserverEntry`, then select a citation, and assert the target reflects the new host box (acceptance criteria 3).
- [x] 6.5 Late layout: with `pageCount` partial at construction, assert no scroll happens until `waitUntilLayoutComplete` resolves, and that the resulting target is the correct later page — **not** page one (acceptance criteria 4).
- [x] 6.6 Rapid selection: select citation A then B, resolve A's layout/collection promise **after** B's, and assert the final scroll position is B's and that A issued no `scrollTo` (acceptance criteria 5).
- [x] 6.7 No re-pull: after navigation completes, fire a scroll event, an `onScaleChange`, an `onVisiblePageChange`, and a resize entry, and assert `scrollTo` was not called again while rectangles were recomputed (acceptance criteria 6).
- [x] 6.8 Unresolved location: a location that resolves to neither rectangle nor page issues no scroll, renders no overlay, and shows no error state; a location with a page but no rectangle still calls `scrollToPage` (acceptance criteria 8; spec scenarios on graceful degradation).
- [x] 6.9 Announcement: assert the status text appears once after the first navigation and again after a second citation is selected and navigates, and that a superseded navigation produces none (acceptance criteria 9).
- [x] 6.10 Missing scroll host: with the mock omitting the `overflow:auto` element, assert no scroll and no crash (spec scenario).
- [x] 6.11 Layout-wait does not block measurement: while `waitUntilLayoutComplete` is pending, fire a scale change and assert rectangles were recomputed (spec scenario).
- [x] 6.12 PPTX and XLSX navigation tests still pass unchanged apart from any assertion on `navigate`'s return value (spec: PPTX/XLSX behaviour retained).

## 7. Responsive and manual verification

- [x] 7.1 Confirm no breakpoint branching, `useBreakpoint`/`useIsMobile`, or `window.innerWidth` read was introduced — the fix reads the live scroll-host box, so mobile and desktop share one path (proposal "Responsive").
- [x] 7.2 Manually verify in the running app (`npm start`) on a desktop-width canvas and a mobile-width viewport: open a DOCX citation whose highlight is offscreen, switch to a citation on another page, zoom in and out, resize the canvas panel, and confirm the chat page behind the preview does not scroll (acceptance criteria 1, 2, 3, 7, 10).
- [x] 7.3 Confirm DOCX highlight alignment under zoom and resize is visually unchanged from the uncommitted baseline (acceptance criterion 11).

## 8. Completion

- [x] 8.1 `npm run verify:changed` green.
- [x] 8.2 `npm run validate:docs` green; confirm no lib README or `docs/architecture.md` delta is owed (no export, prop, lib, context, route, or dependency changed) and record that conclusion in the PR description.
- [x] 8.3 `npm run verify:full` green once before completion.
- [x] 8.4 Run the five-axis review per `.claude/skills/code-review-and-quality/SKILL.md`, including the responsive-parity and documentation-accuracy gates.
