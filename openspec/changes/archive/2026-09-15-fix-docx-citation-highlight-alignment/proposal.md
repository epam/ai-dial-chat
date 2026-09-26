## Why

A DOCX citation highlight drifts off its cited text as soon as the preview's zoom or the preview container's width changes ([issue #8811](https://github.com/epam/ai-dial-chat/issues/8811), P2, milestone `release-1.1`). The text rescales correctly while the bounding box keeps its old size and slides toward the page origin, so the feature actively misleads the reader about which passage was cited — worse than drawing no box at all. The behaviour is already specified as working (`openspec/specs/office-annotation-highlighting/spec.md:515-552`); the implementation does not honour it.

## Problem

DOCX highlight rectangles are computed in **absolute CSS pixels at the viewer's current scale**, in an overlay that sits outside the viewer's page elements. Every stage of that pipeline is a function of the live scale:

```
collectPageRuns(page, { width })   → run boxes, in the pixel space of `width`
resolveDocxRects(...)              → page-local rectangles, same space
resolveSurfaceOffset(...)          → page origin in the scroll host's content box
measure(): offset + rect − host.scrollLeft/Top
overlay: absolute left/top/width/height in px
```

`width` is `docxPageSizePx(pageSize(i), viewer.getScale()).width` (`libs/attachment-canvas/src/utils/ooxml-highlight-surfaces.ts:115-116`), and `CollectPageRunsOptions.width` is `Pick<RenderPageOptions, 'width' | …>` (`node_modules/@silurus/ooxml/dist/types/docx.d.ts:2148`), so a run's `x`/`y`/`w`/`h`/`highlightBounds`/`font` are all expressed in that width's pixel space. Two confirmed defects follow.

**Root cause 1 — absolute-pixel geometry cached across scales (primary; covers both zoom and resize).** `runsByPage` is a `Map<number, readonly DocxTextRunInfo[]>` keyed by page index only (`ooxml-highlight-surfaces.ts:112`), and `collectPage` returns the cached entry whenever present (`:118-130`). Nothing clears it on a scale change. After a zoom, `resolveSurfaceOffset`/`sizeAt` are at the **new** scale while every `rect.left/top/width/height` still comes from runs measured at the **old** one — the box keeps its previous dimensions and its offset error grows with distance from the page origin, exactly the screenshot in the issue. This also fires on resize, because the vendor's `_onResize` preserves the user's relative zoom via `setScale(baseScale * ratio)`, which emits `onScaleChange` and recomputes against the same stale runs. It violates the existing spec sentence at `spec.md:244`.

DOCX-only, which is why the issue is DOCX-only: the PPTX surface re-collects runs on every `measure` with no cache (`ooxml-highlight-surfaces.ts:268-271`), and XLSX reads live viewport rectangles from the viewer (`:399-420`).

**Root cause 2 — the container is never observed.** There is no `ResizeObserver` and no `window` resize listener anywhere in the OOXML path; invalidation comes only from `onScaleChange`, `onVisiblePageChange`, a capturing `scroll` listener, and a new `highlights` array (`libs/attachment-canvas/src/components/OoxmlContent/OoxmlContent.tsx:156-158`, `:341`, `:391`, `:413-415`). Two resize paths change `host.clientWidth` while emitting no `onScaleChange`, because `DocxScrollViewer.setScale` early-returns on `if (r === this._scale) return;` and `_onResize` early-returns on `if (t === this._lastFitWidth) { this._mountVisible(); return; }`: a refit whose target scale clamps at `zoomMin`/`zoomMax`, and a resize that leaves the fit width unchanged. Since `left = Math.max(paddingLeft, (hostClientWidth - width) / 2)` (`libs/attachment-canvas/src/utils/ooxml-highlight-geometry.ts:204`), every rectangle then holds the old centring and shifts by half the width delta. The spec already requires observing the container (`spec.md:519`); it was never implemented.

**Why no test caught it.** `libs/attachment-canvas/src/components/OoxmlContent/tests/OoxmlContent.spec.tsx:1093` has a scale-change recompute test for **XLSX only**. There is no DOCX scale-change test and no resize test for any format.

**The deeper point.** The vendor solves this exact problem in its own find-highlighting, and it does so by not using absolute pixels at all. `buildDocxHighlightLayer` writes every rectangle as a **percentage of the page box**:

```js
div.style.cssText = `position:absolute;left:${A(run.x + v, cssWidth)};top:${A(run.y, cssHeight)};width:${A(y, cssWidth)};height:${A(run.h, cssHeight)};…`
// A(e, t) => t > 0 ? `${e / t * 100}%` : '0%'   —  packages/core/src/search/highlight-rect.ts
```

A ratio of `run.x` to the page width is scale-free, so the browser rescales the highlight with the page and no recompute is needed. This repo instead converts to absolute pixels and must therefore redo the conversion on every scale change — which is the bug. The helper is byte-identical in the installed `0.86.1` and in `0.87.0`, so the representation is stable across versions rather than a novelty.

## Solution

Adopt the vendor's own scale-invariant representation, keep this repo's overlay DOM, and move to the current vendor release. Three parts, in `libs/attachment-canvas` only:

- **Upgrade `@silurus/ooxml` to `^0.87.0`.** Independent of the fix and landed first so a vendor regression cannot be entangled with the geometry change. The type-surface diff is purely additive — `CjkFallback`/`CjkLang` and a `cjkFallback?` option; nothing removed, no signature changed — and `DocxScrollViewer`'s public surface is identical.
- **Normalise DOCX rectangles to fractions of the page box**, as the vendor does. Runs are then collected **once per page at a fixed reference width** instead of once per scale, because a fraction is the same number at every scale. This deletes root cause 1 structurally: there is no cache to invalidate, no re-collection on zoom, and no way to mix scales.
- **Observe the viewer container with a `ResizeObserver`**, routed into the existing rAF-coalesced `scheduleRecompute`. Still required after the normalisation, because page *placement* — the `(hostClientWidth − pageWidth) / 2` centring — remains container-dependent even when rectangle *shape* no longer is.

No hardcoded offsets and no correction factors: the fix removes a scale-bound representation, it does not compensate for one.

### Alternatives considered

1. **Vendor's representation, this repo's overlay DOM (chosen).** Takes the part of the vendor's design that is portable — percent-of-page geometry — through its public API, while keeping the overlay this repo owns. That matters because the overlay carries `data-selected`, `data-clipped`, and the a11y contract (`spec.md:556`, `:387-435`) that the vendor's own layer cannot express.
2. **Attach a layer into the vendor's page wrapper and draw with `buildDocxHighlightLayer`.** The maximal form: zoom, resize, and scroll all become free, and `resolveSurfaceOffset`, the scroll arithmetic, and the `ResizeObserver` all disappear. Rejected on coupling. The page slot is private (`_acquireSlot`/`_positionSlot`/`_recycleSlot`) with no `data-*`, class, id, or public accessor, so pages could only be identified by an `offsetTop` heuristic — which needs the very page-stacking arithmetic the move was meant to delete. Slots are pooled and reused for other pages, and `_recycleSlot` clears only the vendor's own layers, so a foreign child survives recycling onto the wrong page. The vendor's `highlightLayer` cannot be shared, since `buildDocxHighlightLayer` opens with `layer.innerHTML = ''` on every find redraw. The function is exported but undocumented in the vendor README, and it emits bare divs carrying only `background`, so selection state and a11y would need post-processing of vendor-generated DOM. Net effect: depending on private, recycled DOM is *more* fragile than today, not less.
3. **`findText` / `findNext` / `clearFind` — the vendor's only public highlight API.** Rejected as semantically wrong. A citation is addressed by story + source-tree path + character offsets (`libs/attachment-canvas/src/models/attachment-canvas.ts:71-149`), which identifies one passage; `findText` is addressed by a string and its `DocxMatchLocation` is `{ page: number }` and nothing else (`docx.d.ts:2234-2236`). A quote occurring three times yields three matches distinguishable only by page, the viewer highlights all hits, and the capability already forbids exactly this — "never search by quote" (`spec.md:436`).
4. **`DocxViewer` instead of `DocxScrollViewer`**, which does expose `canvasElement` publicly. Rejected: it is single-page (`goToPage`/`nextPage`/`prevPage`), so it would trade continuous scrolling for paged navigation — a UX regression far larger than the bug.
5. **Keep absolute pixels and key the run cache by `(pageIndex, collectionWidth)`.** The minimal patch: correct, and it introduces no new assumption. Rejected as the primary fix because it treats the symptom — it keeps a scale-bound representation and pays for it with a `collectPageRuns` call per zoom step plus an LRU bound to stop a wheel-zoom sweep accumulating entries. Normalisation removes the class of bug instead of bounding its cost. Retained as the fallback if normalisation proves inaccurate (see design Decision 2).
6. **Do nothing / wait for a vendor fix.** Rejected: the geometry is computed in this repo, and `0.87.0` adds no range-based highlight API. There is nothing upstream to wait for — though an upstream request for a public range-highlight API or a page-element accessor is recorded as a follow-up, since it is what would make alternative 2 viable later.

## Non-goals

- PPTX, XLSX, PDF, CSV, HTML, and code preview highlighting. PPTX and XLSX keep their absolute-pixel geometry untouched; they are read for regression risk only.
- Calling `buildDocxHighlightLayer` itself, or rendering into vendor-owned DOM (alternative 2).
- Adding a zoom UI to the DOCX preview (only XLSX exposes `showZoomSlider`, `OoxmlContent.tsx:84`).
- The pre-existing RTL question of `host.scrollLeft`'s sign in a right-to-left scroll container (`ooxml-highlight-surfaces.ts:209-211`). Flagged, recorded as a follow-up; highlight geometry stays intentionally physical per `spec.md:602`.
- Any change to the wire selector format, `libs/quotations` normalisation, or `libs/chat-hooks` mapping.
- Adopting `cjkFallback`, the new `0.87.0` option. Out of scope; noted so the upgrade is not mistaken for enabling it.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `office-annotation-highlighting`: two requirements tighten. **DOCX text ranges resolve from the displayed parse** replaces "collect at the viewer's current render width" with scale-invariant fractions of the page box, collected once at a reference width, and forbids retaining scale-bound geometry. **Highlight geometry survives resize, refit, zoom, and navigation** turns the existing "SHALL observe the container" sentence into a testable requirement, naming container resize with no scale change as its own invalidation source, and separates rectangle *shape* (now scale-free) from page *placement* (still container-dependent).

## Impact

**Code (all in `libs/attachment-canvas`):**

- `libs/attachment-canvas/package.json` — `@silurus/ooxml` from `^0.86.1` to `^0.87.0` in `dependencies`. A caret on a `0.x` version pins the minor, so `0.87.0` is **not** covered by the current range; this is a real manifest change governed by `.claude/rules/libs.md`, and `docs/host-install-matrix.md` is generated from these manifests.
- `libs/attachment-canvas/src/utils/ooxml-highlight-geometry.ts` — `resolveDocxRects` and its helpers emit fractions of the page box; same-line merging stays in reference-width pixels so its tolerances keep their meaning. `resolvePptxRects`/`resolveXlsxRects` unchanged.
- `libs/attachment-canvas/src/utils/ooxml-highlight-surfaces.ts` — `createDocxHighlightSurface` collects once per page at the reference width, drops the scale-keyed cache problem entirely, and converts fractions to overlay pixels at measure time.
- `libs/attachment-canvas/src/components/OoxmlContent/OoxmlContent.tsx` — one `ResizeObserver` inside the existing mount effect, disconnected in its existing teardown.
- Tests — DOCX scale-change, resize, and normalisation-accuracy coverage in `OoxmlContent/tests/OoxmlContent.spec.tsx` and `utils/tests/ooxml-highlight-geometry.spec.ts`.

**Not affected:** no backend endpoint, no OpenAPI or generated-client change, no new npm dependency. `OoxmlHighlightRect` is internal — it is not exported from `libs/attachment-canvas/src/index.ts` — so the package's public API, props, and exported types are unchanged. `ResizeObserver` is already used in the PDF path (`PdfContent.tsx:282`, `:464-519`) and stubbed for jsdom (`src/test-setup.ts:13-23`), so no new runtime dependency. The lazy-chunk boundary tests (`tests/package-boundary/*.spec.ts`) must still pass.

**Library isolation:** the change stays inside `libs/attachment-canvas` and adds no host knowledge — it reads only DOM geometry and the vendor's published API. No `/api` path, generated client, app context, route, feature flag, env var, or storage key. The host keeps passing highlights through `OoxmlCanvasContent.highlights`/`selectedHighlightId`, and panel-resize knowledge stays on the host side of `AttachmentCanvasProps.onResizeStop` (`models/attachment-canvas.ts:470`) — the lib observes its own container rather than being told about the panel.

**i18n:** none. No new user-visible strings; the overlay renders geometry only.

**Responsive:** the `ResizeObserver` is what makes mobile correct — orientation change and virtual-keyboard show/hide resize the container with no zoom gesture and, in the vertical-only case, no fit-width change, so all of it is currently unobserved. No breakpoint-conditional logic is added.

## Acceptance criteria

1. Zooming a highlighted DOCX in, out, and back to the starting scale leaves each rectangle covering the same cited characters at every step.
2. Resizing the window or the preview container at an unchanged zoom level — including a refit whose scale clamps at `zoomMin`/`zoomMax`, where `onScaleChange` never fires — keeps rectangles aligned.
3. Repeated and interleaved zoom/resize sequences introduce no cumulative drift; returning to a previously visited scale reproduces that scale's rectangles exactly.
4. Alignment holds after scrolling, and for citations on pages other than the first, including a range spanning a page boundary.
5. Alignment holds in both mobile and desktop canvas layouts, including orientation change.
6. Alignment recovers automatically, without reopening the preview or re-clicking the citation.
7. `collectPageRuns` is called at most once per page per document, regardless of how many times the scale changes.
8. Normalised rectangles agree with directly-measured geometry across scales within a stated sub-pixel tolerance, verified by test at two render widths.
9. A wheel-zoom or drag-resize burst still produces at most one recompute per animation frame.
10. PPTX and XLSX highlight behaviour is unchanged.
11. `npm run verify:full`, `npm run validate:docs`, and the package-boundary suite pass.

## Rollback / backward compatibility

Not breaking. No public API, prop, exported type, wire format, or persisted data changes — `OoxmlHighlightRect` is internal, and the fix only corrects geometry already being drawn.

The change lands as three independently revertable slices: the vendor upgrade, the normalisation, and the container observation. Reverting the upgrade is a manifest-and-lock revert plus `npm run docs:install-matrix`; the normalisation and the observer are each self-contained in one library with no migration, no data backfill, and no coordination with the backend or `libs/quotations`. Because the slices are ordered upgrade → normalisation → observer, a problem in any one can be dropped without giving back the others.

The realistic risk is accuracy rather than breakage: normalisation trades exact per-scale measurement for a ratio, so a sub-pixel discrepancy is possible. Acceptance criterion 8 bounds it by test, and alternative 5 (width-keyed cache, absolute pixels) is the pre-analysed fallback if the tolerance cannot be met.
