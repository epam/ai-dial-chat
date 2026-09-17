## Context

`OoxmlContent` renders DOCX/XLSX/PPTX attachments with `@silurus/ooxml@0.87.0` and paints citation highlights in an overlay that sits **outside** the viewer's own DOM, positioned in the container's coordinate space. Per-format glue lives in `createDocxHighlightSurface` / `createPptxHighlightSurface` / `createXlsxHighlightSurface` (`libs/attachment-canvas/src/utils/ooxml-highlight-surfaces.ts`), each exposing `measure(highlights)` and `navigate(location)`.

The working tree carries the just-completed change `fix-docx-citation-highlight-alignment` (archived at `openspec/changes/archive/2026-09-15-fix-docx-citation-highlight-alignment/`). It is the baseline for this design and is preserved verbatim; three of its outcomes are load-bearing here:

1. **DOCX rectangles are scale-free.** `resolveDocxRects` returns `OoxmlDocxNormalizedRect` — `left`/`top`/`width`/`height` as fractions of the page box (`ooxml-highlight-geometry.ts:83-108`).
2. **Runs are collected once, at a fixed scale-1 reference width.** `referenceSizeAt` replaced `sizeAt` inside `collectPage`, so zooming never re-collects (`ooxml-highlight-surfaces.ts:121-142`).
3. **Placement is pure arithmetic over resolved geometry** — `offset + fraction × sizeAt(page) − host.scroll*` (`ooxml-highlight-surfaces.ts:206-233`), fed by one coalescing `requestAnimationFrame` from scroll, `onScaleChange`, `onVisiblePageChange`, and a `ResizeObserver` on the container (`OoxmlContent.tsx:345-370`).

Navigation, however, never participated in any of that. It ends at `viewer.scrollToPage(pageIndex)` (`ooxml-highlight-surfaces.ts:238-251`), which the vendor defines as page-top alignment with no offset parameter (`node_modules/@silurus/ooxml/dist/types/docx.d.ts:2515-2517`).

### Constraints

- **Vendor surface is fixed.** No upgrade, no fork. The only scroll primitives available for DOCX are `scrollToPage(index, { behavior })` and direct manipulation of the scroll host element `findScrollHost` locates.
- **Library isolation.** `libs/attachment-canvas` may not learn about host panels, routes, contexts, or storage. Every input this design uses is either a prop or something the lib reads from the viewer/DOM it owns.
- **The overlay must not become interactive.** It stays `pointer-events: none`; nothing here adds a focusable or scrollable element.
- **No arbitrary delays.** The vendor publishes `layoutComplete`, `waitUntilLayoutComplete()`, and a `layoutComplete` flag on `onVisiblePageChange` (`docx.d.ts:2208-2210, 2378`); readiness is synchronised through those, not timers.
- **Canvas geometry is not directional.** Highlight coordinates are physical by design and documented as such (`OoxmlContent.tsx:526-532`); scroll offsets share that space.

## Goals / Non-Goals

**Goals**

- DOCX citation navigation lands on the cited **passage**, not the cited page, at any zoom and any container size.
- Navigation waits for real layout readiness rather than a timeout, so the correct page is known before scrolling.
- The newest citation selection always wins over superseded in-flight navigations.
- Scrolling is confined to the preview's own scroll host; the surrounding chat page never moves.
- Navigation is one-shot per selection: after it completes, the user scrolls freely.
- Unresolvable locations degrade exactly as they do today — page-level navigation if a page is known, otherwise nothing.

**Non-Goals**

- Changing PPTX or XLSX navigation behaviour beyond adopting a shared return type.
- Changing DOCX highlight *shape* or alignment (the archived change owns that).
- Re-centring the highlight on zoom/resize/scroll after navigation has completed.
- Any new host-facing prop, callback, or alignment configuration.
- PDF navigation, which uses a different vendor path and already works.

## Decisions

### D1 — Compute an absolute scroll target from the already-resolved rectangle; do not extend `scrollToPage`

The scroll host's content box stacks pages with the arithmetic already encoded in `resolveSurfaceOffset` (`ooxml-highlight-geometry.ts:212-231`): `top = paddingTop + index·gap + Σ height(page<index)`, `left = max(paddingLeft, (hostClientWidth − width)/2)`. A resolved DOCX rectangle is a fraction of its page box. Therefore the passage's absolute top in content coordinates is exactly

```
contentTop = resolveSurfaceOffset({ index, sizeAt, hostClientWidth }).top
           + rect.top * sizeAt(index).height
```

and the scroll target is `contentTop − alignmentMargin`, clamped to `[0, scrollHeight − clientHeight]`. This is pure arithmetic over values the lib already computes for `measure`, which is why it belongs next to `resolveSurfaceOffset` as a small pure helper (`resolveDocxScrollTarget`) with its own unit test, rather than inline in the surface.

*Alternatives rejected.* Injecting a hidden anchor element into the viewer's page slot and calling `scrollIntoView` — the slots are recycled by the vendor and the overlay is outside them, and `scrollIntoView` scrolls **every** scrollable ancestor, which is precisely the "don't move the chat page" failure. Asking the vendor for an offset parameter — blocks a P2 bug on a third-party release. Approximating with `scrollToPage` then a fixed nudge — wrong at every zoom but one.

### D2 — Apply the target by writing the scroll host's own scroll position

`host.scrollTo({ top, left, behavior: 'auto' })` (with `host.scrollTop = …` as the fallback when `scrollTo` is unavailable) touches exactly one element. `Element.scrollIntoView` is explicitly forbidden by this design, and the spec delta states the requirement so a future contributor cannot reintroduce it. `behavior: 'auto'` (not `'smooth'`) is chosen because a smooth scroll is still in flight when the next citation click arrives, which reopens the race D4 closes, and because it respects `prefers-reduced-motion` by construction.

Horizontal position is set only when the passage would otherwise be outside the host's horizontal viewport — at fit-width, `scrollLeft` is 0 and must stay there. This mirrors what `measure` already assumes about `host.scrollLeft`.

### D3 — Synchronise on `waitUntilLayoutComplete()` before scanning for the page

`findPages` bounds its scan with `docxDocument.pageCount`, which in the installed build resolves to the partial layout's page list until layout completes, while `DocxDocument.load()` returns earlier (`_layoutCompletion` is a separate promise awaited only by `waitUntilLayoutComplete`). DOCX `navigate` therefore awaits `waitUntilLayoutComplete()` first, guarded by the existing `isDisposed()` continuation check, before any scanning.

The await is placed in `navigate` **only**, not in `measure`. `measure` is called on every frame of a zoom or scroll burst and is already correct against whatever is laid out: a highlight on a not-yet-laid-out page simply has no rectangle yet and gains one through `onVisiblePageChange`. Adding a layout await there would serialise the coalescing path for no benefit.

`waitUntilLayoutComplete()` rejects when layout failed (`throwIfFailed`); `navigate` treats that like any other resolution failure — no scroll, no error state — consistent with the graceful-degradation requirement.

*Alternative rejected.* Polling `pageCount` across animation frames until it stabilises: an arbitrary-delay pattern the vendor API exists to replace, and it cannot be tested without fake timers.

### D4 — A monotonic generation counter inside the DOCX surface, checked after every await

`createDocxHighlightSurface` keeps a `navigationGeneration` number. Each `navigate` call increments it, captures the value, and re-checks it after **each** suspension point (`waitUntilLayoutComplete`, `collectPage` inside `findPages`, rectangle resolution); a mismatch returns without scrolling.

The counter lives in the surface rather than in the `OoxmlContent` effect because the scroll itself happens inside the surface — an effect-level flag (which is what exists today) can only suppress the `setHasNavigated` that follows, not the scroll that already fired. The effect keeps its own `disposed` flag for the state update; the two are complementary, not duplicated.

`navigate` returns an outcome rather than `void`, so the component can tell "navigated" from "superseded" from "nothing to navigate to" and announce only the first:

```ts
export enum OoxmlNavigationOutcome {
  Navigated = 'navigated',
  Superseded = 'superseded',
  Unresolved = 'unresolved',
}
```

A string enum per the repo's enum rule; `Promise<OoxmlNavigationOutcome>` replaces `Promise<void>` on `OoxmlHighlightSurface.navigate`. PPTX and XLSX return `Navigated`/`Unresolved` and are otherwise untouched.

*Alternative rejected.* An `AbortSignal` threaded from the effect: heavier, and the surface's awaits are not abortable operations — a generation check at each continuation is the same guarantee with none of the plumbing.

### D5 — Navigation stays keyed on `[content.url, selectedHighlightId]`, not on `highlights`

Today the effect depends on `[highlights, selectedHighlightId, isLoading]` (`OoxmlContent.tsx:473`), and `highlights` is a fresh array reference on every citation click even when the selection did not change (`libs/chat-hooks/src/files/attachment-canvas.ts:568-575`). That makes navigation re-fire on unrelated re-renders, which is one way a user gets pulled back after scrolling away. The effect is re-keyed so it fires on: first readiness for a document, and each genuine change of `selectedHighlightId`. The location object is read through the existing `highlightsRef`, so the lookup still sees the latest array without depending on its identity.

This is also what makes "no re-pull after navigation" a structural property rather than a behaviour to be careful about: no invalidation signal — scroll, `onScaleChange`, `onVisiblePageChange`, `ResizeObserver` — is wired to navigation at all. They feed `scheduleRecompute`, which only re-measures.

### D6 — Drop the identity-keyed `pageOfLocation` cache

`pageOfLocation` is keyed by `OoxmlHighlightLocation` object identity and populated in `measure`, but callers construct fresh location objects per click, so it never hits and grows for the surface's lifetime. It is removed rather than re-keyed: `collectPage` already caches runs per page, which is where the real cost is, and a value-keyed cache would need a serialisation of `story` + `path` that buys nothing measurable. Removing it also eliminates a subtle correctness hazard for D4 — a cache written by a concurrent `measure` cannot short-circuit a navigation that should have been superseded.

### D7 — Alignment: passage top placed one quarter of the viewport below the visible top

`alignmentMargin = min(host.clientHeight * 0.25, contentTop)`. A DOCX citation is usually a sentence or paragraph, and dead-centring a multi-line passage pushes its opening line low; a quarter-viewport lead-in keeps the passage's start near the reading position with context above it. When the passage is taller than the viewport, its **start** is what gets aligned — reading begins at the top.

This is a design constant, not a spec requirement: the spec requires the passage be visible within the scrollable area, so the constant can be tuned later without a spec change. It is defined as a named constant beside `OOXML_SCROLL_GAP_DEFAULT` so the tuning point is obvious.

### D8 — Announcement resets per selection

`hasNavigated` is currently set once and never cleared except by a full reload, so only the first citation is announced. It is reset when `selectedHighlightId` changes and set only on an `OoxmlNavigationOutcome.Navigated` result, so each completed navigation announces once and a superseded or unresolved one announces nothing. The live region, its `role="status"`/`aria-live="polite"`, and the `highlightNavigatedLabel` prop are unchanged.

## Risks / Trade-offs

- **Scroll-host discovery is a heuristic (`style.overflow === 'auto'`), not a vendor contract** → Navigation adopts `measure`'s existing failure mode: a missing host yields `Unresolved` and no scroll, never a scroll to a guessed position. The heuristic already has one owner (`findScrollHost`) and is covered by the existing tests; a vendor upgrade breaks one function, visibly.
- **Page-stacking arithmetic in `resolveSurfaceOffset` is derived from the installed build, not guaranteed by a public type** → Unchanged risk, already documented on that function. This design adds no *second* place that encodes stacking — the new helper composes `resolveSurfaceOffset` rather than reimplementing it, so a vendor change still breaks exactly one function and one test.
- **`waitUntilLayoutComplete()` on a very large document delays the first scroll** → The document is already visible and scrollable while the await is pending; only the automatic jump waits. This is strictly better than today's behaviour, which jumps immediately to the wrong page. No spinner is added — the loading overlay is owned by parse/render, and blocking the document on layout completion would regress perceived load time.
- **`behavior: 'auto'` gives an instant jump rather than a smooth glide** → Deliberate (D2): it removes an in-flight-animation race and avoids a motion-sensitivity concern. The live-region announcement supplies the feedback a smooth scroll would have conveyed visually.
- **Changing `navigate`'s return type touches all three surfaces** → Contained: `OoxmlHighlightSurface` is internal to the lib and not re-exported from `src/index.ts`, so no consumer breaks. PPTX/XLSX changes are a `return` statement each.
- **Test doubles diverge from the real vendor** → The existing DOCX mock exposes `pageCount: 1` and no `waitUntilLayoutComplete`. Extending it is required work (tasks below), and the mock must model a *partial-then-complete* `pageCount` so the D3 regression is actually exercised rather than assumed.

## Migration Plan

Single non-breaking commit inside `libs/attachment-canvas`; no data, no persisted state, no host coordination.

1. Pure geometry helper + unit tests (no behaviour change yet).
2. Surface-level navigation rewrite behind the new return type; PPTX/XLSX adopt it.
3. Component effect re-keying and announcement reset.
4. Regression suite + `validate:docs` (the lib README documents no navigation API, so no README delta is expected — confirmed during implementation).

**Rollback:** revert the commit. Navigation returns to page-granular; the archived alignment work is in separate commits and is unaffected.

## Open Questions

- **Resolved by decision, flagged for review:** the quarter-viewport alignment constant (D7). If review prefers centring, only the constant changes; no spec or test structure changes.
- **Deferred:** whether PPTX should gain the same layout-readiness await. `PptxPresentation.collectSlideRuns` is indexed by an explicit 1-based slide number carried in the selector, so it has no page-scan dependency on layout progress — no evidence of the defect exists there. Out of scope until one does.
