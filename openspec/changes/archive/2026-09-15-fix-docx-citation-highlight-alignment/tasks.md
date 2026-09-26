## Slicing strategy

**Risk-first, three independently revertable slices.** Each lands and verifies on its own, so a problem in one never forces giving back another.

- **Slice 1 (§1)** — vendor upgrade to `^0.87.0`. Lands **first and alone**. It fixes nothing by itself (`DocxScrollViewer`'s public surface is identical between versions), but the vendor ships no changelog, so behavioural change can only be found by running the suite against the new build. Entangling that with the geometry rewrite would make any regression ambiguous between the two.
- **Slice 2 (§2-§4)** — scale-free geometry. Adopts the vendor's own percent-of-page representation, so runs are collected once per page at a reference width. Removes root cause 1 structurally and fixes the reported zoom symptom. §2 is a test-infrastructure prerequisite.
- **Slice 3 (§5-§6)** — container observation. Fixes the resize paths that emit no `onScaleChange`. Gated on §2.1 because the shared `ResizeObserver` stub is constructor-only and cannot deliver a size change today.

§7 is cross-slice regression and closeout. `npm run verify:changed` runs once per completed slice; exactly one `npm run verify:full` closes the change.

Every task is confined to `libs/attachment-canvas`. No task touches `apps/`, `libs/quotations`, `libs/chat-hooks`, or `openspec/specs/` (the delta spec is applied at archive time, not by these tasks).

## 1. Slice 1 — upgrade `@silurus/ooxml` to `^0.87.0`

- [x] 1.1 Change `@silurus/ooxml` from `^0.86.1` to `^0.87.0` in the `dependencies` of `libs/attachment-canvas/package.json:22`, and refresh the lockfile. A caret on a `0.x` version pins the minor, so `0.87.0` is **not** covered by the current range — this is a real manifest change, not a lock refresh. Follow `.claude/rules/libs.md` for version-range form (an upper bound is required) and for `dependencies` vs `peerDependencies` placement; the package stays a normal `dependencies` entry, as the package-boundary test at `libs/attachment-canvas/tests/package-boundary/externalized-peers.spec.ts:18` documents it as the deliberate bundled exception.

- [x] 1.2 Regenerate the install matrix with `npm run docs:install-matrix` and commit the result, since `docs/host-install-matrix.md` is generated from these manifests. Check whether `libs/attachment-canvas/README.md` cites the vendor version anywhere and update it in the **same** commit if so — `npm run validate:docs` fails when a README cites a version its own manifest does not carry.

- [x] 1.3 Record in the change that the type-surface diff between `0.86.1` and `0.87.0` is purely additive — `CjkLang`, `CjkFallback`, and a `cjkFallback?` option added; nothing removed and no signature changed — and that `DocxScrollViewer`'s public surface is byte-identical. Note explicitly that `cjkFallback` is **not** being adopted, so the upgrade is not mistaken for enabling it.

  **Verification notes:** `@silurus/ooxml@0.87.0` type diff confirmed purely additive (`CjkLang`, `CjkFallback`, `cjkFallback?` on `RenderPageOptions`); no removed export, no changed signature, `DocxScrollViewer`'s surface unchanged. `cjkFallback` is not adopted anywhere in this change. `libs/attachment-canvas/README.md` cites no vendor version, so no README edit was needed; `npm run docs:install-matrix` produced no diff to `docs/host-install-matrix.md` (the package is a plain `dependencies` entry, not tracked there). Full attachment-canvas suite (OoxmlContent, ooxml-highlight-geometry, PdfContent, package-boundary ×3) plus `npm run validate:docs` pass against the upgraded build. `chat-api:typecheck` fails under `nx affected` but is confirmed pre-existing on `development` before this change (reproduced by stashing and re-running), unrelated to this upgrade.

  **Verification:** the full attachment-canvas suite against the new build, before any geometry change lands — `npm run test:file -- libs/attachment-canvas/src/components/OoxmlContent/tests/OoxmlContent.spec.tsx`, `npm run test:file -- libs/attachment-canvas/src/utils/tests/ooxml-highlight-geometry.spec.ts`, `npm run test:file -- libs/attachment-canvas/src/components/PdfContent/tests/PdfContent.spec.tsx`, plus the three `libs/attachment-canvas/tests/package-boundary/*.spec.ts` files. Then `npm run validate:docs` and `npm run verify:changed`. Any failure here belongs to the upgrade, not to the fix.

## 2. Slice 2 — test infrastructure and failing tests for scale-bound geometry

- [x] 2.1 Extend the `ResizeObserver` stub in `libs/attachment-canvas/src/test-setup.ts:13-23` so a test can drive a size change. Today `observe`/`unobserve`/`disconnect` are all no-ops with no callback registry, so no resize can be delivered. Keep the class globally assigned and all three methods present and non-throwing, so `PdfContent`'s existing observers (`libs/attachment-canvas/src/components/PdfContent/PdfContent.tsx:282`, `:464-519`) keep working unchanged. Record constructed instances and their observed elements, expose a way to deliver entries to a chosen instance, and expose a reset so instances do not leak between test files. This is a prerequisite for §5 as well as §3.

  **Verification:** `npm run test:file -- libs/attachment-canvas/src/components/PdfContent/tests/PdfContent.spec.tsx` (the shared stub's existing consumer) and `npm run test:file -- libs/attachment-canvas/src/components/OoxmlContent/tests/OoxmlContent.spec.tsx`.

- [x] 2.2 In the DOCX section of `libs/attachment-canvas/src/components/OoxmlContent/tests/OoxmlContent.spec.tsx` (suite at `:536-800`), make the `run` fixture at `:552-561` width-dependent, so run `x`/`y`/`w`/`h` scale with the `width` passed to the mocked `collectPageRuns`. This mirrors the vendor contract that `CollectPageRunsOptions.width` (`node_modules/@silurus/ooxml/dist/types/docx.d.ts:2148`) places returned coordinates in that width's pixel space. Have the fixture reproduce today's numbers at the initial scale so existing expectations stay intact.

- [x] 2.3 Add a DOCX test asserting `collectPageRuns` is called **exactly once** for the cited page across several `onScaleChange` deliveries, and that the rendered rectangle still covers the cited text after each. Model it on the existing XLSX scale-change test (`OoxmlContent.spec.tsx:1093-1108`), whose absence for DOCX is why this shipped. **Must fail against the current implementation** — today a scale change re-measures against a stale page-indexed cache. Record the failure before fixing.

- [x] 2.4 Add a test asserting no rectangle retains a previous scale's dimensions: after a scale change the rectangle's width and height reflect the new scale rather than keeping the old size while the offset moves. This is the assertion that distinguishes the real bug — box keeps its old size and drifts toward the page origin — from a generic "a recompute happened" check.

- [x] 2.5 Add geometry unit tests in `libs/attachment-canvas/src/utils/tests/ooxml-highlight-geometry.spec.ts` for the new representation: fractions of the page box are derived correctly for a fully-covered run, for a partially-covered run, and for a range spanning a page boundary.

- [x] 2.6 Add the linearity-tolerance test that bounds design Decision 2's central assumption: resolve one page's runs collected at the reference width and again at a different render width, and assert the derived fractions agree within a documented sub-pixel tolerance. State the chosen tolerance in the test name or a comment. This is acceptance criterion 8, and it is the test that would fail loudly if a future vendor version made `width` affect layout rather than act as a pure scale factor.

  **Verification for §2:** `npm run test:file -- libs/attachment-canvas/src/components/OoxmlContent/tests/OoxmlContent.spec.tsx` and `npm run test:file -- libs/attachment-canvas/src/utils/tests/ooxml-highlight-geometry.spec.ts` — expect 2.3, 2.4, 2.5, and 2.6 to fail and everything else to pass. Do not proceed to §3 until the failures are the expected ones for the expected reason.

## 3. Slice 2 — normalise DOCX geometry to fractions of the page box

- [x] 3.1 In `libs/attachment-canvas/src/utils/ooxml-highlight-geometry.ts`, change `resolveDocxRects` (`:408-470`) to emit fractions of the page box — left, top, width, and height each as a ratio of the page's width or height — instead of reference-width pixels. Introduce a distinct type for the normalised rect rather than repurposing `OoxmlHighlightRect`, so `resolvePptxRects` (`:494`) and `resolveXlsxRects` (`:577`) keep their absolute-pixel contract untouched; `isClippedAtEnd` (`:25`, `:599`) is XLSX-only and must not be dragged into the DOCX type. `OoxmlHighlightRect` is internal — it is not exported from `libs/attachment-canvas/src/index.ts` — so this is not a public API change.

- [x] 3.2 Apply `mergeSameLineRects` (`:215-247`) **before** normalisation, in reference-width pixels, so `SAME_LINE_TOLERANCE_PX` and `ADJACENT_TOLERANCE_PX` (`:138-141`) keep their stated pixel meaning. Applying a 2px tolerance to fractions would silently make it page-size-dependent. Do not change the tolerance values.

- [x] 3.3 Keep `resolveRunRect`'s algorithm (`:301-342`) as it stands — it already computes what the vendor's own slice math computes. Change only the output space. Preserve the three deliberate divergences from the vendor's find layer, each of which is a spec requirement rather than an oversight: the `run.highlightBounds` preference (`spec.md:238`), the full-run shortcut that skips measurement when a run is wholly covered (`:313-315`), and same-line merging (`spec.md:236`). Record them in a block comment so a later reader does not "align with the vendor" by removing them.

- [x] 3.4 In `libs/attachment-canvas/src/utils/ooxml-highlight-surfaces.ts`, change `createDocxHighlightSurface` to collect each page's runs **once** at a fixed reference width derived solely from the document — the page's scale-1 CSS width, `pageSize(i).widthPt * PT_TO_CSS_PX` — rather than at `sizeAt(pageIndex).width` (`:115-116`, `:124`). The page-indexed `runsByPage` cache (`:112`) becomes correct as written, because the collection width no longer varies; no cache key change and no LRU bound are needed. Nothing in the resolution path should read `viewer.getScale()` any more.

- [x] 3.5 In the same file, convert fractions to overlay pixels at `measure` time (`:186-213`): multiply each fraction by the page's current pixel size and add the page offset and scroll position, keeping `resolveSurfaceOffset` as the single place page stacking is encoded. Per design Decision 3, shape is now scale-free but placement is not — so this conversion, and only this conversion, still depends on the live scale and `host.clientWidth`.

- [x] 3.6 Confirm `pageOfLocation` (`:113`, written at `:194-196`, read by `navigate` at `:220-223`) still works: which page a citation lives on does not change with zoom. Add or extend a test that `navigate` scrolls to the right page after a scale change.

- [x] 3.7 Rewrite the assertion at `libs/attachment-canvas/src/utils/tests/ooxml-highlight-geometry.spec.ts:387` ("uses run coordinates as returned, applying no second scale pass"). It pins the representation being replaced, so it must be rewritten to state the **new** invariant explicitly — geometry is scale-free fractions of the page box — and reviewed as a deliberate contract change. Do not delete it and do not quietly relax it; a test that changes to match new behaviour is how a regression gets normalised.

- [x] 3.8 Update the JSDoc on `resolveDocxRects`, `createDocxHighlightSurface`, and the new rect type to state why geometry is scale-free and why the reference width is document-derived, citing the vendor's own percent-of-page highlight layer as the precedent. Match the existing comment density in these files (see `ooxml-highlight-surfaces.ts:139-146`, `:24-30`, `ooxml-highlight-geometry.ts:181-188`) rather than adding a bare note. Use block comments for anything multi-line, per `AGENTS.md` § Code comments.

- [x] 3.9 Architecture guard for this slice: confirm the edited files introduce no host-owned integration knowledge — no `/api` path, generated API client import, `server-api` import, app context, auth/session/cookie/env access, feature flag, route or navigation knowledge, analytics/telemetry/logging client, third-party SDK setup, or app storage behaviour. They must read only DOM geometry and the vendor's published API. Confirm relative TypeScript imports remain extensionless.

  **Verification for §3:** `npm run test:file -- libs/attachment-canvas/src/utils/tests/ooxml-highlight-geometry.spec.ts`, `npm run test:file -- libs/attachment-canvas/src/components/OoxmlContent/tests/OoxmlContent.spec.tsx`, and `npm run test:file -- libs/attachment-canvas/tests/package-boundary/bundle-budgets.spec.ts`. Then `npm run verify:changed` once for the completed slice.

## 4. Slice 2 — confirm the tolerance decision

- [x] 4.1 Record the sub-pixel tolerance §2.6 settled on, and the measured discrepancy behind it, in the design's Open Questions. Per design Decision 2, a tolerance that has to be loosened beyond roughly a pixel is the signal to fall back to proposal alternative 5 — absolute pixels with a `(pageIndex, collectionWidth)`-keyed cache — and that judgement must be made with the numbers in hand. If the fallback is taken, stop and revise the design before continuing to §5.

## 5. Slice 3 — failing tests for the missing container observation

- [x] 5.1 Add a renderer test to `libs/attachment-canvas/src/components/OoxmlContent/tests/OoxmlContent.spec.tsx` asserting that a container size change delivered through the §2.1 stub recomputes placement **with no `onScaleChange` emitted**. This is the clamped-refit case the vendor's early returns swallow (`setScale`'s `if (r === this._scale) return;` and `_onResize`'s `if (t === this._lastFitWidth)` branch), and it is the resize half of the reported bug. **Must fail** — there is no `ResizeObserver` anywhere in the OOXML path (invalidation sources are only `OoxmlContent.tsx:156-158`, `:341`, `:391`, `:413-415`).

- [x] 5.2 Add a test asserting the recompute uses the new container width: with the mocked scroll host reporting a changed `clientWidth`, the rectangle's horizontal position reflects the new centring rather than the old. `resolveSurfaceOffset` derives `left` from `Math.max(paddingLeft, (hostClientWidth - width) / 2)` (`ooxml-highlight-geometry.ts:204`), so an unobserved width change shifts every rectangle by half the width delta — assert that specific failure is gone.

- [x] 5.3 Add a test asserting a resize burst coalesces: many size deliveries within one frame produce at most one recompute, entering the **same** rAF path as scale and scroll invalidations (`OoxmlContent.tsx:306-313`), not a separate one.

- [x] 5.4 Add a test asserting the observation is released with the viewer: `disconnect` runs in the same teardown that destroys viewer and engine, both on unmount and on document replacement (`content.url` change), and no recompute is scheduled afterwards. Extend the existing teardown coverage near `OoxmlContent.spec.tsx:729` rather than duplicating its setup.

- [x] 5.5 Add a test asserting no cumulative drift across interleaved zoom and resize: drive a sequence of scale and size changes that returns to an earlier scale **and** container width, and assert the rectangles equal those produced at that pair the first time. This is the acceptance criterion neither slice proves on its own.

  **Verification for §5:** `npm run test:file -- libs/attachment-canvas/src/components/OoxmlContent/tests/OoxmlContent.spec.tsx` — expect 5.1 through 5.5 to fail and §3's tests to still pass.

## 6. Slice 3 — observe the container in the mount effect

- [x] 6.1 In `libs/attachment-canvas/src/components/OoxmlContent/OoxmlContent.tsx`, register one `ResizeObserver` on the viewer container inside the **existing** mount effect (`:289-408`), with `scheduleRecompute` (`:306-313`) as its callback, so resize invalidations share the established rAF coalescing. Register it unconditionally rather than behind `hasHighlights`, per design Decision 5: `scheduleRecompute` already no-ops when no highlight surface is assigned (`:314-317`), and gating would decouple the observer's lifetime from the viewer's.

- [x] 6.2 Call `observe` **after** the viewer is constructed — after `createHighlightedSurface`/`createViewer` resolves in `loadDocument` (`:346-370`) — not at effect entry. `ResizeObserver` callbacks fire in registration order within one delivery, and the vendor registers its own observer during viewer construction, so observing afterwards means the vendor's refit has already run and the recompute measures post-refit `clientWidth` and post-refit scale (design Decision 4). Guard the `disposed` case the way the surrounding code does.

- [x] 6.3 `disconnect` the observer in the effect's existing cleanup (`:400-407`), alongside the `scroll` listener removal and `cancelAnimationFrame`, and before `viewer.destroy()`/`engine.destroy()`. Do not add a second effect or a second cleanup path.

- [x] 6.4 Do not add a "skip the first callback" flag. `observe()` fires once with the initial size; that delivery is harmlessly coalesced with `loadDocument`'s own first `measure()` (`:372`) and no-ops while the surface is unassigned. A skip flag would be untestable and would break the legitimate case where the container's first observed size differs from its mount size (design Decision 5).

- [x] 6.5 Add a block comment at the observer explaining why the container is observed rather than the private scroll host (`findScrollHost` is an `overflow:auto` heuristic that can return `null`, `ooxml-highlight-surfaces.ts:59-64`), why `window.resize` is insufficient (it misses panel resizes that do not change the window), and why the host's `onResizeStop` is not routed down (it fires on drag stop, so the highlight would lag the drag, and it would make the lib depend on host panel mechanics).

- [x] 6.6 Verify no `ResizeObserver loop completed with undelivered notifications` warning appears when driving zoom and resize together. The callback sets React state, re-rendering the overlay; the overlay is `pointer-events-none absolute inset-0` with absolutely-positioned children (`:485-514`), so it cannot change the observed container's size and cannot feed back — confirm that holds in practice, since the failure mode is console spam rather than a wrong pixel.

- [x] 6.7 Architecture guard for this slice: confirm `OoxmlContent.tsx` still contains no host-owned integration knowledge (same checklist as 3.9) and that the lib learns about its own container's size rather than being told about the host panel — `AttachmentCanvasProps.onResizeStop` (`libs/attachment-canvas/src/models/attachment-canvas.ts:470`) stays a host-ward callback with nothing flowing back down. Confirm relative imports remain extensionless.

  **Verification for §6:** `npm run test:file -- libs/attachment-canvas/src/components/OoxmlContent/tests/OoxmlContent.spec.tsx` and `npm run test:file -- libs/attachment-canvas/src/components/PdfContent/tests/PdfContent.spec.tsx`. Then `npm run verify:changed` once for the completed slice.

## 7. Cross-slice regression and closeout

- [x] 7.1 Run the PPTX and XLSX sections of the OOXML suite (`OoxmlContent.spec.tsx:802-946` and `:948-1145`) and confirm unchanged behaviour. All three formats share the edited files, and neither PPTX nor XLSX is meant to change: PPTX re-collects runs on every `measure` with no cache (`ooxml-highlight-surfaces.ts:268-271`) and keeps absolute-pixel geometry; XLSX reads live viewport rectangles (`:399-420`). Note that PPTX now also benefits from the container observation via §6.1, and confirm that is additive rather than a change its existing tests contradict.

- [x] 7.2 Run the full package-boundary suite — `bundle-budgets.spec.ts`, `dist-static-closure.spec.ts`, `externalized-peers.spec.ts` under `libs/attachment-canvas/tests/package-boundary/` — confirming the highlight-surface module stays in its lazy chunk, no import reached the eager entry, and the vendor bump did not disturb the externalisation contract.

- [ ] 7.3 Confirm on a real multi-page DOCX with a citation on a later page that zooming triggers **no** `collectPageRuns` call, since the zoom path is now pure arithmetic. This is acceptance criterion 7 and the payoff for choosing normalisation over a width-keyed cache; record the observation in the change.

- [x] 7.4 Record two out-of-scope findings as explicit follow-ups rather than fixing them here: (a) the RTL `host.scrollLeft` sign question in a right-to-left scroll container (`ooxml-highlight-surfaces.ts:209-211`), given highlight geometry is intentionally physical per `openspec/specs/office-annotation-highlighting/spec.md:602`; (b) an upstream request to the vendor for a public range-highlight API — or merely a page-index `data-*` attribute and a layer accessor — which is what would make proposal alternative 2 viable and would additionally remove the `resolveSurfaceOffset` coupling this change does not reduce. No drive-by edits in untouched files.

- [x] 7.5 Confirm documentation state, then run `npm run validate:docs`. The vendor bump in §1 already required `npm run docs:install-matrix`; verify nothing else drifted. No public export, prop, exported type, or enum member changes — `OoxmlHighlightRect` is internal — so `libs/attachment-canvas/README.md` and `docs/architecture.md` need no edit for the geometry work. If any of that turns out to change during implementation, update the affected README and `docs/architecture.md` in the **same** commit per `.claude/rules/docs.md`.

- [ ] 7.6 Close the change with exactly one `npm run verify:full`. Add `npm run build:quiet` only if bundling was affected beyond what §7.2 covers.
