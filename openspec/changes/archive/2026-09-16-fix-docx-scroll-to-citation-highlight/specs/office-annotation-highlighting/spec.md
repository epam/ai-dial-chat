## ADDED Requirements

### Requirement: Citation navigation reaches the cited passage, not merely its page

Navigation SHALL bring the **selected highlight's cited passage** into the preview's visible area, not merely the page, slide, or sheet that contains it. A navigation that leaves the cited passage outside the scroll host's visible box SHALL NOT be treated as successful.

For DOCX specifically, `scrollToPage` alone SHALL NOT satisfy this requirement. `DocxScrollViewer.scrollToPage(index)` aligns a page's top edge with the viewport top and accepts no intra-page offset, so a passage in the lower part of a page — routine, since a page is taller than the canvas body at most zoom levels — remains offscreen. DOCX navigation SHALL therefore:

- Resolve the selected location's rectangle geometry, which is already expressed as fractions of the page box (see the DOCX resolution requirement), and combine it with the page's offset inside the scroll host's content box and the page's current pixel size to produce an **absolute scroll offset** in that content box.
- Derive the page offset from the same single function that already encodes page stacking for the overlay, rather than reimplementing the stacking arithmetic, so a vendor layout change still breaks exactly one function and one test.
- Clamp the computed offset to the host's scrollable range, so a passage near the document's start or end scrolls as far as it can rather than not at all.
- Place the passage's **start** inside the visible box with a margin of leading context above it, so the first line of a cited paragraph is not flush against the viewport's top edge. When the passage is taller than the visible box, its start SHALL be what is aligned.
- Produce the same result at any viewer scale and any scroll-host size, since every input is read live rather than captured at load.

Navigation SHALL still occur when the location resolves to **no rectangle**: the user is taken to the cited page, slide, or sheet, as today. When no page can be determined at all, the viewer SHALL be left where it is; navigation SHALL NOT fall back to scrolling to page one, because a confident jump to the wrong place is worse than no jump.

PPTX and XLSX navigation already addresses a location rather than a coarse container — `scrollToSlide` for a whole slide, and the sheet switch plus `scrollToCell` with `align: 'center'` for a single cell — and SHALL retain its current behaviour.

**State ownership**: the per-format highlight surface owns scroll-target computation; `OoxmlContent` owns only the decision of *when* to navigate and the announcement that follows.
**i18n**: none — no new user-visible string. The existing `attachmentCanvas.ooxmlHighlightNavigatedLabel` is reused.
**RTL**: none. Scroll offsets are physical canvas coordinates in the same space the overlay already uses, inside a page whose own layout the vendor resolved including RTL. They SHALL NOT be converted to logical properties, for the reason stated in the physical-geometry requirement.
**Feature flag**: none.
**Memoisation**: none required; the computation is pure arithmetic over values already resolved for the overlay and runs once per navigation, not per frame.
**Telemetry**: none.

#### Scenario: A passage in the lower part of its page is brought into view

- **WHEN** a citation is opened whose highlight sits near the bottom of a page that is taller than the preview's visible area
- **THEN** the preview scrolls so the cited passage is inside the visible area, rather than stopping with the page's top edge at the viewport top

#### Scenario: Navigation succeeds at a non-default scale

- **WHEN** the viewer's scale is not 1 and a citation is opened whose highlight is outside the initial viewport
- **THEN** the cited passage is inside the visible area, and the scroll offset reflects the page's size at the current scale

#### Scenario: Navigation succeeds after the container is resized

- **WHEN** the preview container's size changes and a citation is then selected
- **THEN** the cited passage is brought into view against the new container size, not the size at load time

#### Scenario: The passage's start is aligned when the passage is taller than the viewport

- **WHEN** the selected highlight spans more of the page than the visible area can show
- **THEN** the passage's first line is inside the visible area

#### Scenario: An unresolvable location does not jump to page one

- **WHEN** the selected location resolves to neither a rectangle nor a page
- **THEN** the viewer stays where it is, no highlight is drawn, and no error state is shown

---

### Requirement: Navigation waits for layout readiness and never for a fixed delay

DOCX navigation SHALL synchronise on the vendor's published layout-readiness signal before scanning for the page that carries a location. It SHALL NOT scan against a page count that may still be growing, and it SHALL NOT approximate readiness with a timeout, a fixed number of animation frames, or a poll for a stabilising page count.

The reason is concrete: the DOCX page scan is bounded by `DocxDocument.pageCount`, and progressive layout resolves `DocxDocument.load()` while layout is still publishing pages. A scan over a partial page list finds no match, and the current implementation then scrolls to page one — the wrong-page symptom this requirement exists to remove. `DocxDocument.waitUntilLayoutComplete()` is the vendor's explicit synchronisation point for exactly this, and `onVisiblePageChange` reports a `layoutComplete` flag for the same reason.

Requirements:

- DOCX navigation SHALL await layout completion before the page scan, guarded by the renderer's existing disposal check so a completion arriving after unmount performs no work.
- A layout that **fails** SHALL be treated as an unresolved location — no scroll, no error state — consistent with the graceful-degradation requirement.
- Rectangle **measurement** SHALL NOT await layout completion. Measurement runs on every frame of a zoom or scroll burst and is already correct against whatever is laid out; a highlight on a not-yet-laid-out page gains its rectangle through the existing page-window invalidation. Serialising the coalesced measurement path behind layout completion is forbidden.
- The document SHALL remain visible and scrollable while navigation waits. No additional loading indicator SHALL be introduced, and the renderer's loading state SHALL NOT be extended to cover layout completion.

**State ownership**: the DOCX highlight surface owns the await; no new component state is introduced.
**i18n**: none.
**RTL**: none.
**Feature flag**: none.
**Memoisation**: none.
**Telemetry**: none.

#### Scenario: Layout completes after first paint

- **WHEN** a citation on a later page is opened and the document's layout is still in progress when the viewer is constructed
- **THEN** navigation waits for layout completion and then scrolls to the cited passage, rather than settling on page one

#### Scenario: Measurement is not blocked by the layout wait

- **WHEN** the user zooms or scrolls while navigation is waiting for layout completion
- **THEN** rectangle recomputation continues to run on its coalesced frame callback and is not serialised behind the wait

#### Scenario: Layout failure degrades gracefully

- **WHEN** layout completion rejects
- **THEN** no scroll occurs, no highlight is drawn, and the renderer's error state is not shown

---

### Requirement: The latest citation selection wins over superseded navigations

Navigation SHALL be ordered last-write-wins. When a new navigation begins, every navigation already in flight SHALL be considered superseded and SHALL perform no scroll and no announcement, whatever order their asynchronous work completes in.

A disposal flag held by the calling effect is **not** sufficient and SHALL NOT be relied on alone: the scroll is issued from inside the highlight surface, after awaits the effect cannot cancel, so an effect-level flag can only suppress the state update that follows a scroll that has already happened. The ordering guard SHALL therefore live in the highlight surface and SHALL be re-checked after **every** suspension point in the navigation path — layout readiness, run collection, and rectangle resolution.

`navigate` SHALL report its outcome to the caller rather than returning nothing, distinguishing at minimum: navigation completed, navigation was superseded, and the location could not be resolved. The renderer SHALL announce only a completed navigation.

Any cache used to short-circuit navigation SHALL NOT be able to defeat this ordering. A cache that cannot hit in practice — for example, one keyed on the identity of location objects that callers rebuild on every citation click — SHALL be removed rather than retained, since it costs memory for the lifetime of the surface and supplies no benefit.

**State ownership**: the highlight surface owns the ordering token.
**i18n**: none.
**RTL**: none.
**Feature flag**: none.
**Memoisation**: none.
**Telemetry**: none.

#### Scenario: A slower earlier selection does not override a newer one

- **WHEN** two citations are selected in rapid succession and the first selection's asynchronous work resolves after the second's
- **THEN** the preview is left at the second citation's passage and the first performs no scroll

#### Scenario: A superseded navigation is not announced

- **WHEN** a navigation is superseded before it completes
- **THEN** no navigation announcement is produced for it

#### Scenario: Navigation reports its outcome

- **WHEN** navigation completes, is superseded, or cannot resolve the location
- **THEN** the caller can distinguish the three outcomes from `navigate`'s result

---

### Requirement: Automatic scrolling is confined to the preview and does not repeat

Automatic navigation SHALL change the scroll position of the preview's own scroll host and nothing else. It SHALL be applied by writing that element's scroll position directly. `Element.scrollIntoView` SHALL NOT be used, because it scrolls every scrollable ancestor and would move the surrounding chat page — the user's place in the conversation SHALL be preserved.

Scrolling SHALL be instantaneous rather than animated. A smooth scroll is still in flight when a subsequent citation is selected, which reopens the ordering hazard above, and an instantaneous scroll carries no motion-sensitivity concern. The live-region announcement supplies the feedback that a visible glide would otherwise convey.

Navigation SHALL be **one-shot per selection**. It SHALL be triggered by exactly two things: the document becoming ready for a selected highlight, and a change of `selectedHighlightId`. It SHALL NOT be triggered by scroll, zoom, container resize, page-window change, or a new `highlights` array that carries the same selection — those signals feed rectangle recomputation only. After a navigation completes the user SHALL be able to scroll, zoom, and resize freely without being returned to the highlight.

When the preview's scroll host cannot be located, navigation SHALL perform no scroll rather than scroll to a guessed position — the same failure mode overlay measurement already uses when the host is absent.

**State ownership**: `OoxmlContent` owns the navigation trigger; the surface owns the scroll application.
**i18n**: none.
**RTL**: none — the host's horizontal scroll position is read and written in the same physical space the overlay already uses.
**Feature flag**: none.
**Memoisation**: the navigation effect SHALL be keyed so that a new `highlights` array with an unchanged `selectedHighlightId` does not re-trigger it.
**Telemetry**: none.

#### Scenario: The chat page does not move

- **WHEN** the preview automatically scrolls to a cited passage
- **THEN** only the preview's scroll host changes scroll position, and the surrounding page's scroll position is unchanged

#### Scenario: The user is not pulled back after navigating

- **WHEN** navigation completes and the user then scrolls away, zooms, or resizes the preview
- **THEN** the preview stays where the user left it and does not scroll back to the highlight

#### Scenario: A repeated highlights array does not re-navigate

- **WHEN** a new `highlights` array is passed that names the same `selectedHighlightId`
- **THEN** no new navigation is triggered

#### Scenario: A missing scroll host performs no scroll

- **WHEN** the viewer's scroll host cannot be located
- **THEN** no scroll occurs and no highlight rectangles are drawn

---

## MODIFIED Requirements

### Requirement: Highlights render as an overlay with exactly one selected

`OoxmlContent` SHALL render resolved rectangles in an overlay positioned above the viewer's canvases and below no interactive control, and SHALL mark exactly one highlight selected.

The overlay SHALL:

- Be non-interactive (`pointer-events: none`) so text selection, hyperlink clicks, cell selection, and scrolling continue to work through it.
- Render every highlight in `content.highlights`, not only the selected one, so a reader sees each cited passage from that document — matching what the PDF path does, where `PdfContent` receives all of the group's highlights and only `selectedHighlightId` is emphasised.
- Distinguish the selected highlight visually from the unselected ones by more than one channel, so the distinction survives a colour-vision deficiency.
- Reuse the citation highlight's existing visual language — the PDF path's `CITATION_HIGHLIGHT_STYLE` is a transparent fill with a 2px `--stroke-accent` border — so an Office highlight and a PDF highlight read as the same feature.
- Expose highlight colours as themeable CSS custom properties through the existing `AttachmentCanvasColors` mechanism, following `libs/*` styling rules: no hardcoded hex in the component, `buildCssVars` mapping, and one interface field per var the stylesheet reads.
- Be removed entirely when `content.highlights` is absent or resolves to no rectangles.

Navigation SHALL bring the selected highlight's location into view on initial load and whenever `selectedHighlightId` changes. The per-format mechanism is: an absolute scroll offset computed from the resolved rectangle for DOCX, `scrollToSlide` for PPTX, and the sheet-switch-plus-`scrollToCell` sequence for XLSX. Navigation SHALL happen even when the location resolves to **no rectangle** — the user is still taken to the right page, slide, or sheet, which mirrors the PDF requirement that page navigation is independent of highlight geometry. The passage-level contract, layout-readiness synchronisation, ordering under rapid selection, and containment of the scroll to the preview are specified in the four navigation requirements above; this requirement owns only the overlay's rendering and the fact that a selection change navigates.

**State ownership**: `OoxmlContent` owns the resolved-rectangle state and the engine/viewer refs. No new context is introduced; the canvas's own open/content state stays where it already lives.
**i18n**: the overlay's region label — see the accessibility requirement.
**RTL**: see the RTL requirement.
**Feature flag**: none.
**Memoisation**: rectangle resolution runs in effects keyed on locations/scale/page-range; the overlay's rectangle list SHALL be derived state, not recomputed inline on every render.
**Telemetry**: none.

#### Scenario: All same-source highlights render with one selected

- **WHEN** content carries three highlights and `selectedHighlightId` names the second
- **THEN** all three render and only the second carries the selected treatment

#### Scenario: The overlay does not block interaction

- **WHEN** the user selects text under a highlight, or clicks a cell under one
- **THEN** the interaction reaches the viewer and behaves as it does without highlights

#### Scenario: Navigation happens without a rectangle

- **WHEN** the selected location names a valid page but resolves to no rectangle
- **THEN** the viewer still scrolls to that page and no highlight is drawn

#### Scenario: Changing the selected highlight re-navigates

- **WHEN** `selectedHighlightId` changes to a highlight on another page
- **THEN** the viewer scrolls to that highlight's passage and the selected treatment moves

#### Scenario: Switching to a citation above the current position

- **WHEN** the user has navigated to a citation and then selects one that sits earlier in the document
- **THEN** the preview scrolls backwards to the earlier passage and brings it into view

#### Scenario: No highlights means no overlay

- **WHEN** `content.highlights` is `undefined`
- **THEN** no overlay element is rendered

---

### Requirement: Highlight overlay is accessible

The overlay is purely visual and conveys location, which a screen-reader user cannot perceive from a canvas. The following SHALL apply.

- The overlay container SHALL be a labelled region: `role="region"` with an `aria-label` supplied by the host through the existing labels mechanism, defaulting in the library to the English string `'Cited locations'`. Individual rectangles are decorative and SHALL be `aria-hidden`, since a rectangle carries no independent meaning.
- Bringing the cited location into view SHALL be announced through a polite live region (`role="status"`, `aria-live="polite"`), because scrolling a canvas produces no announcement of its own and the user otherwise receives no confirmation that Preview did anything. The announcement SHALL fire when navigation completes for the selected highlight, and SHALL NOT re-fire on scroll, zoom, or resize.
- The announcement SHALL fire **once per completed navigation**, for the second and every subsequent citation as well as the first. The announced state SHALL therefore be reset when `selectedHighlightId` changes, so a later navigation is not silently swallowed by a flag that is still set from the first one. A navigation that was superseded or could not resolve its location SHALL NOT be announced.
- The overlay SHALL NOT be focusable and SHALL NOT enter the tab order — it is not an interactive control, and adding stops between the document and the panel's real controls would harm keyboard navigation. Existing keyboard interaction with the viewer (text selection, cell selection, scrolling) SHALL be unaffected, which the `pointer-events: none` overlay guarantees.
- While the document is loading and resolution is in flight, the existing `aria-busy` on the viewer container SHALL continue to convey that state; no separate busy signal is added.
- A resolution failure SHALL NOT be announced, consistent with the graceful-degradation requirement that it is not reported to the user at all.
- Highlight border and fill colours SHALL preserve the contrast of the underlying document text: the selected treatment SHALL NOT rely on a fill that reduces the text's contrast below the repository's AAA target, which the transparent-fill-plus-border style inherited from the PDF path already satisfies.

**i18n keys** — added to `apps/chat/src/i18n/locales/en.json` and `AttachmentCanvasI18nKeys` in `apps/chat/src/constants/translation-keys.ts`, following the existing `attachmentCanvas.*` convention:

- `attachmentCanvas.ooxmlHighlightsLabel` = `"Cited locations"` → `AttachmentCanvasI18nKeys.OoxmlHighlightsLabel`
- `attachmentCanvas.ooxmlHighlightNavigatedLabel` = `"Scrolled to the cited location"` → `AttachmentCanvasI18nKeys.OoxmlHighlightNavigatedLabel`

Both SHALL be threaded as optional fields on `AttachmentCanvasLabels` with English defaults, forwarded through `AttachmentCanvasBodyLabels` to `OoxmlContent`. A label declared on the parent but not forwarded would leave the child on its hardcoded default, so both SHALL be wired end to end.

**State ownership**: the renderer owns the announcement string.
**RTL**: see the RTL requirement.
**Feature flag**: none.
**Memoisation**: none.
**Telemetry**: none.

#### Scenario: Overlay is a labelled region with decorative children

- **WHEN** highlights render
- **THEN** the overlay is a `region` with the accessible name from `ooxmlHighlightsLabel`, and each rectangle is `aria-hidden`

#### Scenario: Navigation is announced once

- **WHEN** the canvas opens and scrolls to the selected citation
- **THEN** a polite status announces it once, and scrolling or zooming afterwards does not repeat it

#### Scenario: A second citation is also announced

- **WHEN** the user selects a different citation in the already-open preview and navigation completes
- **THEN** the polite status announces that navigation too, rather than staying silent because the first one already announced

#### Scenario: The overlay adds no tab stops

- **WHEN** the user tabs through the canvas panel
- **THEN** focus moves between the panel's real controls and never onto the overlay or a rectangle

#### Scenario: Labels reach the renderer

- **WHEN** the host supplies both new labels on `AttachmentCanvas`
- **THEN** the values appear on the overlay region and in the announcement, rather than the library's English defaults
