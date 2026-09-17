## Why

Opening a DOCX attachment from a citation is supposed to take the reader to the cited passage. Today it takes them to the **top of a page** — often the wrong page, and even on the right page the cited sentence is frequently below the fold at the current zoom. The user is left to hunt for a highlight that the product just promised to show them, which defeats the purpose of citation preview.

The existing spec already requires this to work (`openspec/specs/office-annotation-highlighting/spec.md:426`, "Navigation SHALL scroll the selected highlight's location into view"). The DOCX implementation does not honour it: `navigate` ends at `viewer.scrollToPage(index)` (`libs/attachment-canvas/src/utils/ooxml-highlight-surfaces.ts:238-251`), which aligns a page top with the viewport top and knows nothing about where inside the page the passage sits.

## Problem

Four defects, all confirmed by reading the implementation and the installed `@silurus/ooxml@0.87.0` type/bundle surface.

**1. Navigation is page-granular, never passage-granular (confirmed).**
`DocxScrollViewer.scrollToPage(index, opts?: { behavior })` (`node_modules/@silurus/ooxml/dist/types/docx.d.ts:2515-2517`) is the only scroll entry point the vendor exposes, and it accepts no intra-page offset. A US-Letter page is 792pt ≈ 1056 CSS px at scale 1; the canvas body is routinely shorter than that, and any zoom above fit-page makes it taller still. A citation in the lower two-thirds of its page therefore lands offscreen even when navigation "succeeded". The resolved rectangle that *would* locate it is already computed in `measure` and then discarded for navigation purposes.

**2. Navigation fires before layout is complete, so the page is often wrong (confirmed).**
`findPages` bounds its scan with `docxDocument.pageCount` (`ooxml-highlight-surfaces.ts:157-161`). In the installed build `pageCount` reads `this._meta ? this._meta.pageCount : this._getLayout()?.pages.length ?? 0`, and progressive layout resolves `load()` while `_layoutCompletion` is still pending — `waitUntilLayoutComplete()` is the vendor's explicit sync point for exactly this, and `onVisiblePageChange` carries a `layoutComplete` flag for the same reason (`docx.d.ts:2208-2210, 2378`). `OoxmlContent` calls `setIsLoading(false)` as soon as `createHighlightedSurface` returns (`OoxmlContent.tsx:405`), and the navigation effect is gated only on that flag (`OoxmlContent.tsx:448-473`). A scan over a partial page list finds no match and falls through to `viewer.scrollToPage(pages.at(0)?.pageIndex ?? 0)` — **page one**, which is the exact symptom users report.

**3. Stale navigation can override a newer selection (confirmed).**
The navigation effect's cleanup sets a local `disposed` flag, but that flag only guards `setHasNavigated` (`OoxmlContent.tsx:456-467`). The awaited `highlightSurface.navigate(location)` is not cancelled: inside it, `findPages` awaits `collectPage`, and on resolution unconditionally calls `viewer.scrollToPage(...)`. Two citation clicks in quick succession therefore race, and the slower (older) one wins whenever it resolves last.

**4. The resolved-page cache never hits, and leaks (confirmed).**
`pageOfLocation` is a `Map` keyed by `OoxmlHighlightLocation` **object identity** (`ooxml-highlight-surfaces.ts:113, 203, 241`). `annotationToOoxmlCanvasContent` builds fresh location objects on every citation click (`libs/chat-hooks/src/files/attachment-canvas.ts:568-575`), so the lookup always misses and the map grows for the life of the surface. Run collection is separately cached by page, so the cost is bounded — but the cache is dead code today and must not be relied on for the race fix.

Secondary, in-scope: `hasNavigated` is set once and never reset when `selectedHighlightId` changes, so the polite live region announces the first navigation and stays silent for every subsequent citation — contrary to `spec.md:624` ("SHALL fire when navigation completes for the selected highlight").

## Relationship to the uncommitted working tree

The working tree carries the completed (archived) change `2026-09-15-fix-docx-citation-highlight-alignment`, which made DOCX highlight **shape** scale-free and added a `ResizeObserver` on the renderer's container. That work is the baseline for this one and must be preserved, not revisited:

- `resolveDocxRects` now returns `OoxmlDocxNormalizedRect` — fractions of the page box rather than CSS pixels (`ooxml-highlight-geometry.ts:83-108, 447-520`).
- `createDocxHighlightSurface` collects runs once at a fixed scale-1 reference width (`referenceSizeAt`) and multiplies fractions by the live `sizeAt(pageIndex)` only at placement time (`ooxml-highlight-surfaces.ts:115-142, 206-233`).
- `OoxmlContent` observes its container with a `ResizeObserver` that feeds the existing coalescing `scheduleRecompute` (`OoxmlContent.tsx:345-370, 430`).

This change **builds directly on that normalisation**: because a resolved rectangle is now a stable fraction of its page box, the fraction plus `resolveSurfaceOffset` plus the live page size is enough to compute an exact scroll target in the scroll host's content coordinates, at any zoom, without re-collecting runs. Without the archived change this fix would have needed its own re-resolution pass on every zoom. No file touched by that change is reverted or rewritten here; the only overlap is additive work inside `createDocxHighlightSurface.navigate` and the `OoxmlContent` navigation effect.

## What Changes

- **Passage-level DOCX navigation.** `OoxmlHighlightSurface.navigate` gains an explicit outcome contract and, for DOCX, resolves the *rectangle* for the target location (not just its page), computes the absolute content-box offset via `resolveSurfaceOffset` + the page-box fraction + the live page size, and scrolls the vendor's scroll host to place the passage inside the visible area with a margin — instead of stopping at `scrollToPage`.
- **Layout-readiness synchronisation.** Navigation awaits `DocxDocument.waitUntilLayoutComplete()` (guarded by the existing `isDisposed`) before scanning for the target page, so `pageCount` is authoritative. No timeouts, no polling. `scrollToPage(0)` stops being the silent answer to "layout wasn't ready yet".
- **Last-write-wins navigation.** A monotonic navigation generation inside the DOCX surface makes every superseded in-flight navigation abandon its scroll, so rapid citation changes settle on the newest selection.
- **Scrolling stays inside the preview.** The scroll target is applied by writing to the scroll host's own `scrollTop`/`scrollLeft` (via `scrollTo`), never `Element.scrollIntoView`, which would walk ancestors and drag the surrounding chat page.
- **One-shot navigation.** Navigation runs on open and on each `selectedHighlightId` change and then stops; it is *not* re-triggered by scroll, zoom, resize, or `onVisiblePageChange`, so the user is never pulled back after navigation completes.
- **Announcement re-fires per selection.** `hasNavigated` resets when the selected highlight changes, so each navigation is announced once.
- **Graceful degradation is preserved and specified.** An unresolvable location keeps today's behaviour — navigate to the cited page if one is found, otherwise leave the viewer where it is rather than yanking it to page one.
- Regression coverage in `libs/attachment-canvas/src/components/OoxmlContent/tests/OoxmlContent.spec.tsx` and the geometry spec for: offscreen-within-page targets, above/below and cross-page switching, non-unit scale, post-resize navigation, late layout completion, superseded navigation, unresolved locations, and no ancestor scrolling.
- **Not breaking.** No public prop, i18n key, or exported type of `@epam/ai-dial-attachment-canvas` changes. `OoxmlHighlightSurface.navigate` is internal to the lib (not re-exported from `src/index.ts`).

### Alternatives considered

- **Ask the vendor for an intra-page scroll API / use `goToComment`-style targeting** — rejected: `goToComment` is comment-specific and `scrollToPage` has no offset parameter in `0.87.0`. Waiting on an upstream release blocks a P2 bug on a third party.
- **Render an invisible anchor element inside the page and call `scrollIntoView`** — rejected: the overlay lives *outside* the viewer's recycled page slots, `scrollIntoView` scrolls every scrollable ancestor (moving the chat page, an explicit non-goal), and its `block: 'center'` behaviour is not honourably comparable across the mobile browsers we support.
- **Poll with `requestAnimationFrame`/`setTimeout` until `pageCount` stops changing** — rejected: it is the arbitrary-delay pattern the vendor's `waitUntilLayoutComplete()` exists to replace, and it is untestable without fake timers.
- **Re-navigate on every geometry invalidation so the highlight stays centred** — rejected: it satisfies "always visible" by taking scrolling away from the user, violating the free-scroll requirement.
- **Conservative baseline — keep `scrollToPage` and only add the layout wait** — rejected as insufficient: it fixes the wrong-page case (defect 2) but leaves defect 1, which is the more common complaint at typical zoom levels. The layout wait is kept as *part* of the chosen fix.

### Rollback / backward compatibility

Non-breaking and self-contained: the change is additive inside `createDocxHighlightSurface` and the `OoxmlContent` navigation effect. Reverting the commit restores page-granular navigation with no data migration, no persisted state, and no host-side change. Nothing outside `libs/attachment-canvas` is touched, so no host app needs to be updated in lockstep.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `office-annotation-highlighting`: the "Navigation and highlight selection" requirement is strengthened from page/slide-granular to passage-granular for DOCX, and gains explicit requirements for layout-readiness synchronisation, last-write-wins ordering for superseded navigations, containment of scrolling to the preview's own scroll host, one-shot navigation (no re-pull after the user scrolls), and per-selection announcement.

## Impact

**Code (all inside `libs/attachment-canvas`, no host change):**

- `libs/attachment-canvas/src/utils/ooxml-highlight-surfaces.ts` — `OoxmlHighlightSurface.navigate` contract; DOCX `navigate` gains layout-await, rectangle resolution, scroll-host targeting, and a generation guard. The PPTX and XLSX surfaces adopt the new return contract but keep their current behaviour.
- `libs/attachment-canvas/src/utils/ooxml-highlight-geometry.ts` — one new pure helper that turns a page index, a page-box fraction, and the host's client box into a scroll offset; sits next to `resolveSurfaceOffset`, which already owns the page-stacking arithmetic.
- `libs/attachment-canvas/src/components/OoxmlContent/OoxmlContent.tsx` — navigation effect guards the scroll (not just the `setHasNavigated`) and resets `hasNavigated` per selection.
- Tests: `OoxmlContent.spec.tsx`, `utils/tests/ooxml-highlight-geometry.spec.ts`, and the `DocxDocument`/`DocxScrollViewer` mocks (which today expose `pageCount: 1` and no `waitUntilLayoutComplete`).

**Library isolation:** unchanged and unaffected. The scroll host is the vendor viewer's own element, discovered inside the lib; no REST path, app context, route, storage key, or host panel mechanism is introduced. The lib continues to take `highlights`/`selectedHighlightId` as props and reports nothing back to the host.

**Dependencies:** none added. Uses `waitUntilLayoutComplete()` and `pageSize()`, already part of the installed `@silurus/ooxml@0.87.0` public type surface.

**i18n:** no new user-visible strings. The existing `attachmentCanvas.ooxmlHighlightNavigatedLabel` key is reused; only *when* it is announced changes.

**RTL:** none beyond what exists. Highlight/scroll coordinates are canvas geometry inside a page whose layout the vendor already resolved (including RTL), and `OoxmlContent.tsx:526-532` already documents why these must not become logical properties. Horizontal scroll targeting uses the same physical `scrollLeft` space `measure` already uses.

**Responsive:** the fix is layout-agnostic — it reads the live scroll host client box, so a short mobile viewport and a wide desktop panel are the same code path. Verified on both by the acceptance criteria below; no breakpoint branching is introduced.

**Feature flags:** none. Not gated behind `ENABLED_FEATURES`.

**Telemetry:** none required.

## Acceptance criteria

1. Opening a DOCX attachment from a citation whose highlight is outside the initial viewport leaves the cited passage visible inside the preview's scrollable area, not merely its page.
2. Selecting a different citation in an already-open preview scrolls to the new highlight, whether it is above or below the current position and whether or not it is on a different page.
3. Criteria 1–2 hold at a scale other than 1, and after the preview container or window has been resized.
4. When layout completes after the first paint, navigation still reaches the correct page — the preview does not settle on page one.
5. Two citation selections in rapid succession settle on the later selection; the earlier one's late-resolving navigation performs no scroll.
6. After navigation completes, scrolling, zooming, and resizing do not re-scroll the preview back to the highlight.
7. Automatic navigation changes only the preview's own scroll position; the surrounding chat page's scroll position is unchanged.
8. A location that resolves to no rectangle navigates to its cited page if one is found and otherwise leaves the viewer where it is; no error state is shown.
9. The "Scrolled to the cited location" status is announced once per completed navigation, including for the second and subsequent citations.
10. Criteria 1–2 hold in both the mobile and desktop canvas layouts.
11. DOCX highlight alignment under zoom and resize — the behaviour delivered by the uncommitted alignment work — is unchanged, proven by the existing geometry and `OoxmlContent` tests still passing untouched.

## Non-goals

- PPTX and XLSX navigation behaviour. Both are already location-granular for their formats (`scrollToSlide`, `goToSheet` + `scrollToCell` with `align: 'center'`) and are out of scope beyond adopting the shared return contract.
- PDF citation navigation (`PdfContent`), which uses a different vendor and already works.
- Changing DOCX highlight *shape* or alignment geometry — that is the archived `fix-docx-citation-highlight-alignment` change, which this one preserves.
- Any new host-facing prop, callback, or configuration for scroll alignment.
- Upgrading `@silurus/ooxml`.

## Open questions / assumptions

- **Assumption:** the vendor's scroll host remains discoverable through the existing `findScrollHost` inline-`overflow:auto` heuristic (`ooxml-highlight-surfaces.ts:59-64`). `measure` already depends on it and returns no rectangles when it is absent; navigation adopts the same failure mode (no scroll rather than a wrong scroll). This is recorded as version-coupling risk in the design, alongside the existing `resolveSurfaceOffset` note.
- **Assumption:** placing the passage's top roughly one viewport-quarter below the visible top (rather than dead-centre) reads better for a paragraph-length citation and matches how the XLSX path already centres a single cell. The exact alignment constant is a design decision, not a spec requirement, so it can be tuned without a spec change.
