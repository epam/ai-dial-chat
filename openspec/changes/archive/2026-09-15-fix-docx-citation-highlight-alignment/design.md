## Context

A DOCX citation highlight is not drawn by the document renderer. `@silurus/ooxml`'s `DocxScrollViewer` paints page canvases; this repo computes the bounding boxes separately and draws them in a sibling overlay. The whole feature therefore rests on this repo keeping two independently-scaled coordinate spaces in agreement, with nothing in the type system to enforce it.

The pipeline today, all of it scale-bound:

```
DocxDocument.collectPageRuns(page, { width })      →  run boxes, in the pixel space of `width`
resolveDocxRects(...)                              →  page-local rectangles, same space
resolveSurfaceOffset({ index, sizeAt, hostClientWidth })
                                                   →  page origin in the scroll host's content box
measure(): offset + rect - host.scrollLeft/Top     →  overlay coordinates
OoxmlContent overlay: absolute left/top/width/height in px
```

`width` is `docxPageSizePx(pageSize(i), viewer.getScale()).width` (`ooxml-highlight-surfaces.ts:115-116`), so every stage is a function of the live scale. The invariant the code relies on is stated at `openspec/specs/office-annotation-highlighting/spec.md:244` and pinned by `libs/attachment-canvas/src/utils/tests/ooxml-highlight-geometry.spec.ts:387`: runs are collected at the viewer's own render width, so no second scaling pass is applied. A cache keyed by page index alone (`ooxml-highlight-surfaces.ts:112`) breaks it, and the absence of any `ResizeObserver` breaks the placement half. The proposal's Problem section carries the full citation list; this document is about what to build instead.

The decisive piece of evidence came from reading the vendor's own highlight implementation. It has the same problem to solve and does not use absolute pixels:

```js
// buildDocxHighlightLayer, dist/docx-*.js
div.style.cssText = `position:absolute;left:${A(run.x + v, cssWidth)};top:${A(run.y, cssHeight)};width:${A(y, cssWidth)};height:${A(run.h, cssHeight)};` + transform + `background:${color};pointer-events:none;`
// A(e, t) => t > 0 ? `${e / t * 100}%` : '0%'      —  packages/core/src/search/highlight-rect.ts
```

Every rectangle is a **fraction of the page box**, written into a layer that is `width:100%;height:100%` of the page wrapper. A ratio is the same number at every scale, so the browser rescales the highlight with the page and the vendor never recomputes. The `highlight-rect` chunk is byte-identical in the installed `0.86.1` and in `0.87.0`, so this is a stable representation, not a version detail.

Constraints that shape the fix:

- **Vendor coupling.** `RenderPageOptions.width` (`node_modules/@silurus/ooxml/dist/types/docx.d.ts:2006-2014`) documents no relationship between widths, and `resolveSurfaceOffset`'s page-stacking arithmetic is already flagged as read out of the installed build rather than guaranteed (`ooxml-highlight-geometry.ts:181-188`). Whatever we add must not deepen the reliance on private behaviour.
- **The overlay carries feature contract, not just pixels.** `data-selected`, `data-clipped`, and the a11y requirements (`spec.md:556`, `:387-435`) live on our overlay elements. The vendor's own layer emits bare divs with only a `background`.
- **Bundle boundary.** `ooxml-highlight-surfaces.ts` is deliberately out of the eager entry; `libs/attachment-canvas/tests/package-boundary/bundle-budgets.spec.ts` enforces it (comment at `ooxml-highlight-surfaces.ts:24-30`).
- **Library isolation.** `libs/attachment-canvas` must not learn about the host's panel. `AttachmentCanvasProps.onResizeStop` (`models/attachment-canvas.ts:470`) reports width upward and nothing flows back down.
- **Existing coalescing.** `OoxmlContent`'s mount effect already owns an rAF-coalesced `scheduleRecompute`, a `disposed` flag, and a capturing `scroll` listener registered and removed in that same effect (`OoxmlContent.tsx:306-327`, `:391`, `:404`). New signals belong there, not in a new effect.

## Goals / Non-Goals

**Goals:**

- Remove the class of bug rather than bounding its cost: make rectangle geometry scale-free so there is no scale-bound state left to go stale.
- Make container resize an invalidation source in its own right, covering the resize paths that emit no `onScaleChange`.
- Move to the current vendor release, as its own verifiable step.
- Encode all of it as regression tests that fail against today's code, so the next vendor bump cannot silently reintroduce the drift.
- Keep the change inside `libs/attachment-canvas`, with no public API change and no behavioural change for PPTX/XLSX.

**Non-Goals:**

- Rendering into vendor-owned DOM, or calling `buildDocxHighlightLayer` (Decision 1).
- PPTX, XLSX, PDF, CSV, HTML, code preview highlighting.
- The RTL `host.scrollLeft` sign question (`ooxml-highlight-surfaces.ts:209-211`) — pre-existing, orthogonal, recorded as a follow-up.
- Adopting `cjkFallback`, the option `0.87.0` adds.
- Any DOCX zoom UI.

## Decisions

### Decision 1 — Take the vendor's representation, not the vendor's DOM

The vendor's scale-invariance comes from two things: percent-of-page geometry, and a layer parented to the page element so the browser applies the page's own scaling. The first is portable through the public API. The second is not, and the two are separable.

**What we adopt.** Percent-of-page — strictly, fractions of the page box — as the storage form for DOCX rectangles. This is the part that carries the benefit, and it costs nothing in coupling: it is arithmetic on values `collectPageRuns` already returns.

**What we decline, and why.** Parenting a layer to the vendor's page wrapper was evaluated in detail and rejected as *more* fragile than the status quo:

- The slot is private — `_acquireSlot`/`_positionSlot`/`_recycleSlot`/`_renderSlot` — and carries no `data-*`, class, or id. `mountedPageIndicesForTest()` returns indices, not elements. So a page could only be matched to a wrapper by comparing `offsetTop` against computed page offsets, which needs the very page-stacking arithmetic the move was supposed to delete. Circular.
- Slots are pooled (`this._free.pop()`) and reused for other pages. `_recycleSlot` clears `textLayer.innerHTML`, `highlightLayer.innerHTML`, and its own transforms, but nothing clears a *foreign* child of the wrapper — so our layer would survive recycling and reappear on the wrong page. Correctness would then depend on tracking a private pool's lifecycle.
- The vendor's own `highlightLayer` cannot be shared: `buildDocxHighlightLayer` opens with `layer.innerHTML = ''`, so every find redraw would wipe our rectangles.
- `buildDocxHighlightLayer` is exported but absent from the vendor README, and emits divs carrying only `background` — no ids, no data attributes. `data-selected`, `data-clipped`, and the a11y contract would have to be bolted onto vendor-generated DOM after the fact.

The public alternative, `findText`/`findNext`/`clearFind`, is semantically wrong rather than merely limited: a citation identifies one passage by story + source path + offsets, while `findText` takes a string and returns `FindMatch<DocxMatchLocation>` where `DocxMatchLocation` is `{ page: number }` (`docx.d.ts:2234-2236`, `:1259-1263`). Repeated quotes cannot be disambiguated, all hits get highlighted, and `spec.md:436` already forbids searching by quote. `DocxViewer` does expose `canvasElement` publicly but is single-page, so it would trade continuous scrolling for paged navigation.

An upstream request — a public range-highlight API, or merely a page-index `data-*` attribute and a layer accessor — is the thing that would make the wrapper approach viable later. Recorded as a follow-up, not a dependency.

### Decision 2 — Fractions of the page box, collected once at a reference width

`resolveDocxRects` emits, per rectangle, four fractions of the page box rather than four pixel values. Runs are collected **once per page** at a fixed reference width — the scale-1 page width, `pageSize(i).widthPt * PT_TO_CSS_PX` — and never re-collected, because a fraction computed at that width is the fraction at every width.

Consequences, which are the point of the change:

- There is no scale-keyed cache to invalidate, so root cause 1 cannot recur. It is not patched, it is unrepresentable.
- `collectPageRuns` runs at most once per page per document (acceptance criterion 7), so the zoom path does no async work at all. The zoom-step latency that a width-keyed cache would have introduced never arises.
- A rectangle cannot mix scales, because rectangle shape no longer has a scale.

**This reverses a decision made earlier in this change, and the reason matters.** The first draft of this design rejected "collect once and scale arithmetically" precisely because it assumes `collectPageRuns`' `width` behaves as a linear factor, which the vendor does not document — an assumption we would be introducing into a fix whose purpose is removing geometry error. Reading `buildDocxHighlightLayer` changes the standing of that assumption: the vendor's own shipped highlight feature is built on it, identically in both released versions. It stops being our unverified guess and becomes the invariant the vendor itself relies on. That is a materially stronger footing, and it flips the decision.

It does not make the assumption free, so it is bounded by test rather than by argument. Acceptance criterion 8 requires collecting one page at two render widths and asserting the derived fractions agree within a stated sub-pixel tolerance, so the linearity claim is checked against the installed build instead of trusted. If that tolerance cannot be met, alternative 5 from the proposal — absolute pixels with a `(pageIndex, collectionWidth)`-keyed cache — is the pre-analysed fallback, and it is a smaller change from this state than from today's.

Why the *scale-1* width specifically: it makes the reference width a pure function of the document (`widthPt`), not of viewer state, so two runs of the same document normalise identically and nothing in the resolution path has to read `getScale()`. It also keeps the numbers close to the vendor's own `cssWidth` usage.

### Decision 3 — Shape becomes scale-free; placement does not

Normalisation removes the scale from rectangle *shape*. It does not remove it from page *placement*, and conflating the two would be the easy mistake here. `measure` must still convert fractions to overlay pixels:

```
left = offset.left + leftRatio  × pageWidthPx(scale)   − host.scrollLeft
top  = offset.top  + topRatio   × pageHeightPx(scale)  − host.scrollTop
```

and `resolveSurfaceOffset` still derives `offset.left` from `Math.max(paddingLeft, (hostClientWidth - width) / 2)` (`ooxml-highlight-geometry.ts:204`). So a recompute is still required on zoom, resize, and scroll — but it is now pure arithmetic over cached fractions, with no `await` and no run collection. That is why Decision 4's `ResizeObserver` is still needed after Decision 2, and why the delta spec states shape-invariance and placement-dependence as separate properties.

`resolveSurfaceOffset` keeps its role as the single place page stacking is encoded, and keeps its version-coupling note. This change does not reduce that coupling; it is the one thing the rejected wrapper approach would genuinely have removed, which is worth recording honestly.

### Decision 4 — Observe the container with a `ResizeObserver` inside the existing mount effect

One `ResizeObserver` on the viewer container, its callback being the existing `scheduleRecompute`, `observe`d after the viewer is constructed and `disconnect`ed in the effect's existing cleanup alongside `viewer.destroy()`.

*Why the container, not the scroll host.* The container is the element this component owns and the one the vendor itself observes; the scroll host is private and found by an `overflow:auto` heuristic that can return `null` (`findScrollHost`, `ooxml-highlight-surfaces.ts:59-64`). Observing the owned element cannot fail.

*Why registration order matters.* `ResizeObserver` callbacks fire in registration order within one delivery. The vendor registers its observer during viewer construction (`new ResizeObserver(() => this._onResize())`), so registering ours afterwards means the vendor's refit has already run and the rAF recompute measures post-refit `clientWidth` and post-refit scale. Registering first would measure the old layout and need a second pass. This is an implementation detail of the vendor's constructor, so the delta spec states the requirement as "established after the viewer is constructed" rather than naming the vendor's observer.

*Why it also covers mobile.* Orientation change and virtual-keyboard show/hide resize the container with no zoom gesture and, in the vertical-only case, no fit-width change — today wholly unobserved. This is what makes acceptance criterion 5 pass; no breakpoint-conditional code is added, because a resize is a resize.

*Why not `window.resize`.* It misses panel resizes that do not change the window — the case the issue's reproduction step 5 names and the case `onResizeStop` exists for.

*Why not route the host's `onResizeStop` down.* It would make the lib depend on host panel mechanics for something it can observe itself, and it fires on drag *stop*, so the highlight would lag the drag.

### Decision 5 — Register unconditionally, and do not special-case the first callback

The observer is registered in the mount effect rather than behind `hasHighlights`. `scheduleRecompute` already no-ops when `surface?.highlights` is `null` (`OoxmlContent.tsx:314-317`) and the effect's deps already include `hasHighlights` (`:407`); gating would add a branch whose only effect is skipping a callback that already returns immediately, and would decouple the observer's lifetime from the viewer's.

A `ResizeObserver` fires once on `observe()` with the initial size. That delivery is coalesced with `loadDocument`'s own first `measure()` (`:372`) through the same rAF and no-ops while the surface is unassigned, so it must **not** be suppressed with a "skip first callback" flag — such a flag would be untestable and would break the legitimate case where the container's first observed size differs from its mount size.

### Decision 6 — Keep the deliberate divergences from the vendor's rect math

Our `resolveRunRect` (`ooxml-highlight-geometry.ts:301-342`) already computes the same thing as the vendor's slice math — `measure(text.slice(0, start))` for the start offset, `letterSpacingPx` accumulation by code-point count, an East-Asian vertical scale factor. The change is the output space, not the algorithm. Three differences are kept on purpose, and each is a spec requirement rather than an oversight:

- **`highlightBounds` preference.** The vendor's find layer uses raw `run.x`/`y`/`h`; `spec.md:238` requires preferring `run.highlightBounds` when present, since it is the vendor's own highlight geometry for that run. Keep ours.
- **Full-run shortcut.** When a run is wholly covered we return its box without measuring (`:313-315`). The vendor always measures. Keep ours — it avoids a canvas measurement that cannot change the answer.
- **Same-line merging.** `mergeSameLineRects` (`:215-247`) is required by `spec.md:236` so a multi-run sentence renders as one band; the vendor draws each slice separately. Keep ours — and merge **before** normalising, in reference-width pixels, so `SAME_LINE_TOLERANCE_PX` and `ADJACENT_TOLERANCE_PX` (`:138-141`) keep their stated meaning. Applying a 2px tolerance to fractions would silently make it page-size-dependent.

### Decision 7 — Land the vendor upgrade as its own slice, first

`@silurus/ooxml` moves from `^0.86.1` to `^0.87.0` in `libs/attachment-canvas/package.json`. A caret on a `0.x` version pins the minor, so `0.87.0` is not covered by the current range — this is a real manifest change, governed by `.claude/rules/libs.md`, and `docs/host-install-matrix.md` is generated from these manifests.

The upgrade does not fix anything by itself: `DocxScrollViewer`'s public surface is identical between the two versions, and the `highlight-rect` percent helper is byte-identical, which is also the evidence that Decision 2's representation is stable rather than version-specific. The type-surface diff is purely additive — `CjkLang`, `CjkFallback`, and a `cjkFallback?` option; nothing removed, no signature changed.

It lands first and separately for one reason: the vendor publishes no changelog, so behavioural change can only be detected by running the suite against the new build. Entangling that with the geometry rewrite would make a regression ambiguous between the two.

### Decision 8 — Test at the layer each property lives at

- **Geometry unit tests** (`libs/attachment-canvas/src/utils/tests/ooxml-highlight-geometry.spec.ts`): fractions are derived correctly; merging happens in reference pixels with unchanged tolerances; the linearity tolerance of Decision 2 is asserted by resolving one page at two render widths. The existing assertion at `:387` ("uses run coordinates as returned, applying no second scale pass") describes the representation being replaced and must be rewritten to state the new invariant — this is the one place where an existing expectation legitimately changes, and it should change loudly rather than be deleted.
- **Surface/renderer tests** (`OoxmlContent/tests/OoxmlContent.spec.tsx`, whose DOCX suite already mocks `collectPageRuns` at `:552-561`): `collectPageRuns` is called at most once per page across many scale changes; rectangles track scale; a container resize with no `onScaleChange` still recomputes; bursts coalesce; `disconnect` runs on unmount and document replacement. The existing XLSX scale-change test (`:1093-1108`) is the template for the DOCX one, whose absence is why this shipped.

The jsdom `ResizeObserver` stub is constructor-only (`src/test-setup.ts:13-23`) and cannot deliver a size change, so extending it is a prerequisite for the resize tests and must not disturb the PDF suite that already relies on it.

## Risks / Trade-offs

**[Normalisation is a linearity assumption]** → A fraction derived at the reference width is only exactly right at other scales if `collectPageRuns`' `width` is an exact linear factor; text advance widths are subject to per-scale hinting and subpixel rounding. Mitigated by the vendor shipping its own highlight feature on this basis (so any residual error is error the vendor already accepts), by bounding it with the two-width tolerance test of acceptance criterion 8, and by keeping the width-keyed-cache alternative as a pre-analysed fallback. This is the change's central trade-off and should be reviewed as such.

**[Reflow rather than rescale]** → The assumption holds because DOCX line breaking is fixed by the page's section geometry in points, not by the raster width, so `width` is a pure scale factor. If a future vendor version made `width` affect layout, fractions would be wrong in a way that looks like the original bug. Mitigated by the two-width test, which would fail loudly on exactly that change.

**[`resolveSurfaceOffset` coupling is not reduced]** → Placement still depends on page-stacking arithmetic derived from the installed build (`ooxml-highlight-geometry.ts:181-188`). This change does not improve that, and the rejected wrapper approach was the option that would have. Mitigated only by the existing isolation into one function and one test; recorded so it is not mistaken for solved.

**[Rewriting a pinned test expectation]** → `ooxml-highlight-geometry.spec.ts:387` asserts the representation being replaced. A test that changes to match new behaviour is how a regression gets normalised, so it must be rewritten to state the *new* invariant explicitly and reviewed as a deliberate contract change, never quietly relaxed.

**[`ResizeObserver` loop warning]** → The callback sets React state, re-rendering the overlay. The overlay is `pointer-events-none absolute inset-0` with absolutely-positioned children (`OoxmlContent.tsx:485-514`), so it cannot change the observed container's size and cannot feed back. Worth verifying explicitly because the failure is console spam, not a wrong pixel.

**[Vendor upgrade with no changelog]** → `0.87.0` ships no changelog and the type diff only proves the *typed* surface is additive; runtime behaviour could still differ. Mitigated by Decision 7's separate slice and by running the full attachment-canvas suite against the new build before any geometry change lands.

**[Vendor upgrade changes observer registration order or `_onResize` semantics]** → Decision 4's ordering argument would no longer hold. Not detectable by TypeScript. Mitigated by keeping the requirement stated as constructed-then-observed, by the same version-coupling note that guards `resolveSurfaceOffset`, and by asserting the observable outcome (rectangles match the new width) rather than call ordering.

**[PPTX/XLSX regression]** → The change touches files all three formats share. Mitigated by confining the normalisation to the DOCX resolver and surface — PPTX has no cache to key (`ooxml-highlight-surfaces.ts:268-271`), XLSX reads live viewport rects (`:399-420`), and `isClippedAtEnd` is XLSX-only (`ooxml-highlight-geometry.ts:599`) — and by running the PPTX and XLSX suites (`OoxmlContent.spec.tsx:802-1145`) unchanged.

**[Lazy-chunk budget]** → Edits to a module guarded by the bundle-budget test could push it over. Mitigated by the normalisation being arithmetic with no new import, and by running the package-boundary suite.

## Migration Plan

No migration. No wire format, persisted data, public export, prop, or exported type changes — `OoxmlHighlightRect` is internal to the lib — so there is nothing to version and no coordination with `libs/quotations`, `libs/chat-hooks`, or the backend.

Three independently revertable slices, in order:

1. **Vendor upgrade** (Decision 7). Revert = manifest + lock revert plus `npm run docs:install-matrix`.
2. **Normalisation** (Decisions 2, 3, 6). Fixes the reported zoom symptom and removes root cause 1. Self-contained in the geometry and surface utilities.
3. **Container observation** (Decisions 4, 5). Fixes the no-scale-change resize paths.

Ordering matters: normalisation on top of the new vendor build means the two-width tolerance test of acceptance criterion 8 validates against the version we will ship. The observer last means it can be dropped without giving back the zoom fix.

## Open Questions

- ~~Does the `ResizeObserver` stub support driving a size change?~~ **Resolved: no.** `libs/attachment-canvas/src/test-setup.ts:13-23` is constructor-only — `observe`/`unobserve`/`disconnect` are all no-ops with no callback registry. Extending it is a prerequisite task, not a design change.
- ~~Does the vendor natively support range-anchored highlighting?~~ **Resolved: no**, in both `0.86.1` and `0.87.0`. The only public highlight API is text-query find; everything that maintains it is private. See Decision 1.
- ~~What sub-pixel tolerance does the two-width test settle on?~~ **Resolved: `0.0015` of the page box (~1.2px on the 816px-wide reference page used in tests), asserted in `resolveDocxRects — scale-free normalisation` in `ooxml-highlight-geometry.spec.ts`.** No real multi-page DOCX fixture exists in this repo's test infrastructure, and adding one plus the wasm-backed real-parse plumbing to exercise `DocxDocument.load`/`collectPageRuns` at two widths was judged disproportionate to a unit test — so the test instead models the vendor's font-hinting behaviour directly: it scales a run's reference-width coordinates to a second width (1200px) and rounds them to the nearest tenth of a pixel, the way real glyph metrics snap to device pixels, then asserts the two widths' derived fractions agree within the tolerance. This bounds the conversion arithmetic against a modelled discrepancy rather than a measured one. Acceptance criterion 8's remaining half — confirming the *actual* installed `@silurus/ooxml@0.87.0` build does not introduce more than sub-pixel disagreement — is covered by task 7.3's manual observation on a real multi-page DOCX, not by an automated test. The chosen tolerance (0.0015, ~1.2px) is well inside the "roughly a pixel" ceiling this design set for keeping alternative 5 as a fallback, so no fallback was needed.
- **Does `0.87.0` change any runtime behaviour the type diff cannot show?** Answered by running the full suite in slice 1 before anything else lands.
