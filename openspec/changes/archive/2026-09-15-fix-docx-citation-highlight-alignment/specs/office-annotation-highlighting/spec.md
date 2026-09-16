## MODIFIED Requirements

### Requirement: DOCX text ranges resolve from the displayed parse

`libs/attachment-canvas` SHALL resolve a `DocxTextRange` location to rectangles using `DocxDocument.collectPageRuns(pageIndex, { width })` on **the same `DocxDocument` instance** the active `DocxScrollViewer` was created from via `DocxScrollViewer.fromDocument`.

Resolution SHALL:

- Match a run only when **both** `run.source.story === location.story` **and** `run.source.path` is element-wise equal to `location.path`. Matching on story alone is insufficient — the same story contains many paragraphs.
- **Exclude synthesized runs**: any run whose `source` is `undefined`, or whose `sourceRunIndex` is `undefined`, does not correspond to source document text (page numbers, generated field results, list bullets) and SHALL NOT contribute to a highlight or to offset accounting.
- Accumulate matched runs' `text` in layout order to form the resolved text, tracking each run's character span, so a range crossing several runs is covered.
- For a run only partially covered by `[start, endExclusive)`, compute the partial rectangle from **rendered font metrics** — measuring the run's own `font` via a canvas measurement context — rather than by linear interpolation on character count, so proportional fonts land correctly. `letterSpacingPx` SHALL be included when present.
- Prefer `run.highlightBounds` over `x`/`y`/`w`/`h` when it is present, since it is the vendor's own highlight geometry for that run.
- **Merge adjacent rectangles on the same visual line** — rectangles whose vertical extents coincide within a small tolerance and which touch or overlap horizontally SHALL become one rectangle, so a multi-run sentence renders as one band rather than a row of boxes.
- Produce one rectangle group per page when a range spans a page boundary.
- Skip a run whose `transform` is set, since a transformed run's axis-aligned rectangle would be wrong.

**Resolved rectangle geometry SHALL be scale-free.** A rectangle SHALL be expressed as fractions of its page box — each of left, top, width, and height as a ratio of the page's width or height — and SHALL NOT be stored or returned in absolute CSS pixels at the viewer's current scale. This mirrors the representation the vendor's own highlight layer uses, where each edge is written as a percentage of the page box, and it is what makes a rectangle's shape independent of zoom. Therefore:

- Runs SHALL be collected at a **fixed reference width** derived solely from the document — the page's scale-1 CSS width — and SHALL NOT be collected at the viewer's live render width.
- `collectPageRuns` SHALL be called at most **once per page per document**, regardless of how many times the scale subsequently changes. A scale change SHALL NOT trigger re-collection.
- No cache of run geometry, page size, or rectangle geometry SHALL be keyed on, or retain, a particular scale. Scale-bound rectangle geometry SHALL NOT exist to become stale.
- Same-line merging SHALL be applied **before** normalisation, in reference-width pixels, so its vertical and adjacency tolerances keep their stated pixel meaning rather than becoming page-size-dependent.
- The derived fractions SHALL agree with geometry measured directly at another render width within a documented sub-pixel tolerance, verified against the installed vendor build rather than assumed.

**State ownership**: the engine instance and the resolved rectangles are owned by the `OoxmlContent` renderer, in refs and state respectively. Normalised per-page geometry is owned by the DOCX highlight surface.
**i18n**: none.
**RTL**: `run.direction` is reported per run; resolution SHALL use the run's own reported geometry rather than assuming left-to-right, and the resulting rectangles are physical canvas geometry (see the RTL requirement below).
**Feature flag**: none.
**Memoisation**: resolution SHALL run in an effect keyed on the locations and the page range. It SHALL NOT be keyed on the scale, since scale no longer affects resolved geometry.
**Telemetry**: none.

#### Scenario: Story matches but path differs

- **WHEN** a location targets `story: 'body', path: [3, 1]` and the page also contains runs with `story: 'body', path: [4, 0]`
- **THEN** only runs whose path equals `[3, 1]` contribute rectangles

#### Scenario: Synthesized runs are excluded from offsets

- **WHEN** a page's runs include a header page-number run with no `source`
- **THEN** that run contributes neither a rectangle nor any character offset, and the resolved text is unaffected by it

#### Scenario: A partial run is measured, not interpolated

- **WHEN** a range covers the first 3 characters of a 10-character proportional-font run
- **THEN** the rectangle's width comes from measuring those 3 characters in the run's own font, and does not equal three tenths of the run width for a font where those characters are not exactly three tenths wide

#### Scenario: Adjacent same-line rectangles merge

- **WHEN** a range spans three consecutive runs rendered on one visual line
- **THEN** one merged rectangle is produced for that line, not three

#### Scenario: A range spanning two lines produces two rectangles

- **WHEN** a range wraps across a line break
- **THEN** two rectangles are produced, one per visual line, and they are not merged

#### Scenario: Runs are collected once regardless of zooming

- **WHEN** a highlighted page is measured and the viewer's scale then changes several times, with the page measured again after each change
- **THEN** `collectPageRuns` has been called exactly once for that page, at the reference width

#### Scenario: Rectangle shape does not depend on scale

- **WHEN** the same location is resolved and the viewer's scale changes
- **THEN** the resolved fractions of the page box are identical before and after, and no rectangle retains a width or height from a previous scale

#### Scenario: Normalised geometry matches geometry measured at another width

- **WHEN** one page's runs are collected at the reference width and again at a different render width, and both are resolved for the same location
- **THEN** the resulting fractions of the page box agree within the documented sub-pixel tolerance

#### Scenario: Merge tolerances keep their pixel meaning

- **WHEN** two rectangles on one visual line are separated by a gap within the adjacency tolerance
- **THEN** they merge for pages of any size, because merging is applied in reference-width pixels before normalisation

---

### Requirement: Highlight geometry survives resize, refit, zoom, and navigation

Rectangles SHALL be invalidated and recomputed whenever the mapping from document coordinates to CSS pixels changes.

**Rectangle shape and page placement SHALL be treated as separate concerns.** For DOCX, shape is scale-free (see the DOCX resolution requirement), so a scale change SHALL NOT re-resolve run geometry. Placement is not scale-free: converting a page-box fraction into overlay coordinates requires the page's current pixel size, the page's offset within the scroll host, and the host's scroll position, and the page offset is derived from the host's client width. A recompute of **placement** SHALL therefore still occur on zoom, container resize, page-window change, and scroll, and SHALL be pure arithmetic over already-resolved geometry rather than a re-collection of runs.

For DOCX and PPTX, the scale is one invalidation signal: the renderer SHALL subscribe to `onScaleChange` and recompute placement for the affected pages/slides. Page-window changes SHALL be tracked through `onVisiblePageChange` / `onVisibleSlideChange` so a highlight on a page scrolled into view is resolved when it becomes visible rather than only at load.

**The scale callback alone is not sufficient, and container resize SHALL be its own invalidation source.** The renderer SHALL observe its viewer container's box — for example with a `ResizeObserver` — and SHALL schedule a recompute on every observed size change, whether or not a scale change accompanies it. This is required because:

- A refit whose target scale clamps at the viewer's zoom minimum or maximum, or resolves to the scale already in effect, changes the container's client width while emitting no `onScaleChange`.
- A resize that leaves the fit width unchanged changes the container box without a refit.
- Page offsets are derived from the scroll host's client width, so an unobserved width change leaves every rectangle holding the previous horizontal centring and shifts it by half the width delta.

The container observation SHALL be established **after** the viewer is constructed, so that within one observation delivery the viewer's own resize handling runs first and the recompute measures post-refit geometry. The observation SHALL be torn down with the viewer, in the same teardown that releases the viewer and engine.

Page and slide offsets in the scroll host's coordinate space SHALL be derived from the vendor's own published geometry inputs — the page or slide size, the current scale, and the configured `gap` / padding — in **one** function, so the single place that encodes this relationship is testable and reviewable. That relationship is verified against the installed build but is not part of the vendor's documented public contract; the design records this explicitly as a version-coupling risk.

For XLSX, invalidation is driven by `onViewportChange`, `onScaleChange`, and `onSheetChange` as specified in the XLSX requirement, in addition to the container observation above.

Recomputation SHALL be coalesced through a single animation-frame callback so a continuous gesture — wheel zoom, drag-scroll, drag-resize — produces at most one recompute per frame. A resize-driven invalidation SHALL enter the same coalescing path as a scale- or scroll-driven one, not a separate one.

Recovery SHALL be automatic: after any zoom, resize, refit, reflow, or repagination, alignment SHALL be restored without the user reopening the preview, re-selecting the citation, or otherwise passing a new `highlights` array.

**State ownership**: the renderer.
**i18n**: none.
**RTL**: none.
**Feature flag**: none.
**Memoisation**: coalescing is required as stated; subscriptions and the container observation SHALL be established once per document, not per render.
**Telemetry**: none.

#### Scenario: Zooming keeps the highlight over its text

- **WHEN** the user zooms a highlighted DOCX
- **THEN** placement is recomputed from the already-resolved fractions and the rectangle still covers the cited text, with no re-collection of run geometry

#### Scenario: Resizing the panel keeps the highlight aligned

- **WHEN** the canvas panel is resized, causing a refit
- **THEN** rectangles are recomputed and stay aligned

#### Scenario: A resize that emits no scale change still recomputes

- **WHEN** the container is resized and the viewer's refit produces no `onScaleChange` — because the target scale clamps at the zoom limit or equals the current scale
- **THEN** the container observation schedules a recompute anyway, and the rectangles are re-placed against the new container width

#### Scenario: Repeated zoom and resize introduce no cumulative drift

- **WHEN** zoom and resize operations are interleaved repeatedly and the viewer returns to an earlier scale and container width
- **THEN** the rectangles equal those produced at that scale and width the first time, with no accumulated offset

#### Scenario: A highlight on a later page resolves when scrolled to

- **WHEN** a highlight targets a page outside the initially mounted window and the user scrolls to it
- **THEN** its rectangle is resolved and drawn

#### Scenario: A zoom gesture coalesces recomputes

- **WHEN** a continuous zoom gesture fires many scale changes within one frame
- **THEN** at most one recompute runs per frame

#### Scenario: A resize gesture coalesces recomputes

- **WHEN** a drag-resize delivers many container size changes within one frame
- **THEN** at most one recompute runs per frame

#### Scenario: The container observation is released with the viewer

- **WHEN** the previewed document is replaced or the renderer unmounts
- **THEN** the container observation is disconnected in the same teardown that destroys the viewer and engine, and no recompute is scheduled afterwards

#### Scenario: Alignment recovers without reopening the preview

- **WHEN** the user zooms and resizes a highlighted DOCX repeatedly without re-clicking the citation
- **THEN** the rectangles remain aligned throughout, with no new `highlights` array required to trigger correction
