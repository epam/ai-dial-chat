# Design — Highlight Office document annotations

## Context

`OoxmlContent` already renders DOCX, XLSX, PPTX, and CSV. What is missing is the path that carries a citation's *location* from the wire to that renderer. Today the location is destroyed three times over: by a closed backend DTO allowlist, by a `chat-shared` union that has no Office selector members, and by a mapper (`annotationToPdfCanvasContent`) that returns `null` for anything that is not a PDF.

This design adds the missing path and the geometry resolution behind it, reusing the PDF citation-preview pipeline's shape at every layer so there is one citation-preview concept in the codebase rather than two.

### Evidence base

Every vendor API named below was read from the installed package, not from memory or documentation alone:

- `node_modules/@silurus/ooxml/package.json` — version **0.86.1**, with per-format subpath exports (`./docx`, `./xlsx`, `./pptx`, `./chart-ex`).
- `node_modules/@silurus/ooxml/dist/types/{docx,pptx,xlsx}.d.ts` — the class and interface declarations quoted throughout.
- `node_modules/@silurus/ooxml/dist/{docx,xlsx}-*.js` — the two facts that are **not** in the public type surface: the page-pixel formula and `CellAddress`'s 1-basedness.
- `node_modules/@silurus/ooxml/README.md` — the "Choose one loading mode" section that documents shared parse as a first-class mode.

**No proof-of-concept implementation was available.** The originating request asked for a table of differences between a POC's viewer APIs and the installed ones; that comparison is recorded here as **not done**, because there was nothing to compare against. The design is derived directly from the installed API surface instead, which is the stronger of the two sources anyway. The one thing the POC would have supplied and this design therefore lacks is the DOCX/PPTX discriminator strings — tracked as the blocking prerequisite in `tasks.md`.

## Goals / Non-Goals

**Goals**

- A DOCX/PPTX/XLSX citation opens its document, navigates to the cited location, and shows a visibly selected highlight.
- Rectangles are derived from the same parsed bytes the viewer paints.
- One parse per document; no eager loading of other formats' renderers.
- `libs/attachment-canvas` stays host-agnostic.
- PDF, plain Office, and CSV previews are untouched.

**Non-Goals** — CSV highlighting; multi-row/rectangular XLSX ranges; rotated or flipped PPTX shapes; quote-text search; editing or persisting highlights; backfilling conversations already saved with stripped selectors; a new backend endpoint; a feature flag.

## Decisions

### D1. Shared parse, not a second parse

**Decision.** When highlights are requested for DOCX or PPTX, load the engine first and create the viewer from it:

```ts
const document = await DocxDocument.load(url, opts);
const viewer = DocxScrollViewer.fromDocument(container, document, opts);
```

Resolution then calls `document.collectPageRuns(pageIndex, { width })` on that same instance.

**Why.** The alternative — `new DocxScrollViewer(container)` + `load(url)` for display, plus a separate `DocxDocument.load(url)` for geometry — parses and lays out every document twice, and worse, the two parses can disagree. Different `LoadOptions`, a different `progressiveLayout` state, or a different `showTrackedChanges` view produces different pagination, and a rectangle computed against pagination B drawn over pagination A is silently wrong. A wrong highlight is worse than no highlight, because the user trusts it. Shared parse makes the disagreement structurally impossible.

The vendor documents this as the answer to exactly this problem ("For master–detail, multi-pane, or multi-window UIs, create the Viewer from an already-loaded headless engine so every view shares **one** parse"), and it is available on all three formats (`fromDocument`, `fromPresentation`, `fromWorkbook`).

**Cost, accepted.** `from*()` returns `Omit<Viewer, 'load'>` and its `destroy()` deliberately leaves the borrowed engine alive — "the borrowed document is NOT destroyed — you own it". So the renderer must call `document.destroy()` after `viewer.destroy()`. Forgetting it leaks a parsed document and its worker. This is the one genuinely new lifecycle obligation in the change, and it gets its own test.

**Scope limit.** The self-loading path is retained verbatim for the no-highlight case, and for XLSX in every case. XLSX needs no engine access — `getCellViewportRect` is on the viewer — so introducing `XlsxWorkbook.load` + `fromWorkbook` there would add a lifecycle obligation for nothing. Two acquisition modes are enough; three would not be.

### D2. Render all same-source highlights, emphasise one

**Decision.** Render every highlight in `content.highlights` and mark exactly one selected, rather than rendering only the clicked one.

**Why.** This is what the PDF path already does. `annotationToPdfCanvasContent` builds highlights from *all* of the group's annotations for that document and sets `selectedHighlightId` to the clicked one; `PdfContent` then receives the full list. Rendering only one highlight for Office would make the two formats behave differently for no reason a user could infer, and it would hide the fact that a document is cited several times.

**Alternatives considered.**

- *Selected-only.* Simpler, and satisfies the stated minimum ("at minimum, the clicked annotation must be highlighted"). Rejected: it diverges from PDF parity, and it discards information already computed — the same-source gathering has to happen anyway to establish identity.
- *All highlights, none emphasised.* Rejected outright: the user clicked one specific citation and must be able to tell which rectangle answers that click.

**Consequence.** The selected/unselected distinction must survive colour-vision deficiency, so it uses two channels (border weight plus opacity), not colour alone.

### D3. Office selector `end` is exclusive on the wire — no conversion, only a rename

**Superseded (2026-09-10).** This decision originally assumed the DIAL contract's `end` is inclusive for the new Office selectors too, by extension from `TextCharacterRangeSelector`'s documented convention, and planned an `end + 1` conversion. Three real captured `dial-document` responses (`libs/quotations/src/utils/tests/fixtures/office-selectors.json`) prove the opposite for `docx_text_range` and `pptx_text_range`: every sample satisfies `end - start === text.length` exactly (verified computationally), which only holds if `end` is already **exclusive**. Applying `end + 1` against this evidence would push every highlight one character past the cited text — the exact silent off-by-one this decision was written to prevent, just introduced from the other direction. The assumption is corrected below; the rest of the reasoning (a stable, renamed field so the boundary is a type-level fact) still holds.

**Decision.** `docx_text_range` and `pptx_text_range` carry an already-exclusive `end` on the wire. Normalisation in `libs/quotations` copies it through unchanged into a field named `endExclusive` — a rename for clarity, not a conversion. `excel_rc_range`'s `end` is a distinct concept — a 1-based cell address naming the *last* cell of the range, not a character offset — and stays inclusive, exactly as originally designed; it is unaffected by this correction and keeps its own `OoxmlXlsxHighlightLocation.end?: OoxmlCellAddress` field (no rename, no conversion).

**Why the field is still renamed for DOCX/PPTX.** Even with no arithmetic conversion, keeping the wire's `end` name into the internal model would be misleading once other exclusive-boundary code (rectangle resolution, text validation via `slice(start, endExclusive)`) treats it as such — a reader must not have to check upstream evidence to know which convention a bare `end` means at each layer. `endExclusive` states the convention at the type.

**Why `TextCharacterRangeSelector`'s documented inclusive `end` is untouched.** That selector (`text_character_range`, used by the existing PDF/text-quote path) is unrelated to this change's scope and was not re-verified here — this correction is scoped to the two Office selector kinds this change introduces. Two different selector kinds documenting two different `end` conventions in the same union is the reality the evidence shows; recording that split explicitly is better than forcing a single rule that only one of them followed anyway.

**Test targets.** Every DOCX/PPTX normalisation test must assert `endExclusive === end` (not `end + 1`), including the boundary cases: a one-character range (`start === end - 1`) and a range whose `end` equals `text.length` (must not read as out of bounds).

### D4. Own the overlay; the vendor exposes no mount point for it

**Decision.** `libs/attachment-canvas` owns an absolutely-positioned, `pointer-events: none` overlay inside `OoxmlContent`, and positions rectangles in the scroll host's coordinate space.

**Why.** There is no public alternative. `buildDocxHighlightLayer` *is* exported, but its signature is find-oriented and unusable here:

```ts
declare function buildDocxHighlightLayer(
  layer: HTMLDivElement, runs: DocxTextRunInfo[], matches: DocxHighlightMatch[],
  cssWidth: number, cssHeight: number,
  measureForFont: (font: string) => (s: string) => number,
  colors?: DocxHighlightColors,
): void;
```

It requires a `layer` element already positioned over a specific page, and the scroll viewer's per-page slots are private (`_slots`, `_positionSlot`, `_redrawSlotHighlights` are all `private`). There is no way to obtain a correctly-positioned layer for a page from outside. `findHighlightColors` only restyles the viewer's own find highlights, which are driven by `findText` — and D6 rejects quote search.

**Consequence.** Positioning is this repository's responsibility, which makes D5 load-bearing.

### D5. Confine the page-offset formula to one function

**Decision.** DOCX/PPTX page and slide offsets in the scroll host's coordinate space are computed in exactly one function, from the vendor's own published inputs: page size, current scale, and the configured `gap`/padding.

The relationship was read out of the installed build:

```js
_pageWidthPx(e)  { return this._doc.pageSize(e).widthPt  * A * this._scale; }  // A = 1.3333
_pageHeightPx(e) { return this._doc.pageSize(e).heightPt * A * this._scale; }
```

Every input is public — `DocxDocument.pageSize(pageIndex)` returns `{ widthPt, heightPt }`, `getScale()` returns the scale, and `gap`/`paddingTop`/`paddingBottom` are options this code passes in. The constant is pt→CSS px (96/72).

**Why isolate it.** This is the one place the design depends on vendor behaviour that is *derivable from* but not *guaranteed by* the public contract. A future `@silurus/ooxml` could change how it stacks pages without a TypeScript signal — page offsets are not part of any exported type. Confining it to one named, tested function means a version bump breaks one function with one test, not a scattered set of arithmetic. It is also the natural home for the RTL exemption comment (D7).

**Corollary for run coordinates.** `collectPageRuns` is called with the same `width` the viewer renders at — the scroll viewer does exactly this internally (`this._doc.collectPageRuns(e, { width: this._renderWidth(), … })`) — so returned run coordinates are already in that page's CSS pixel space. No second scale multiplication is applied to them; scale enters only through the width passed in and through the page-offset function. Applying it twice would be the easiest available bug here, which is why the spec states the rule rather than leaving it implicit.

### D6. No quote search, in any form

**Decision.** A selector that cannot be resolved yields no highlight. `findText` is never called as a fallback.

**Why.** `findText(query)` exists on every viewer and would "work" — which is the problem. A quote that occurs five times in a contract gives no deterministic way to pick the cited occurrence, and the user cannot tell a correct highlight from an incorrect one. That converts a visible failure (no highlight) into an invisible one (confidently wrong highlight) on a surface the user is being asked to trust.

The originating request permits quote searching only behind "a deterministic and independently testable matching policy". No such policy exists for the multiple-occurrence case, so the option is closed rather than deferred. If one is defined later — say, nearest-occurrence-to-a-known-page with a uniqueness precondition — it is an additive change.

**Also decided:** a resolution failure is not the renderer's error state. That state means "this file failed to parse or render". Showing it because a *selector* did not resolve would tell the user the document is broken when it opens perfectly. It is also not announced, because a stale citation against an edited document is expected, not exceptional.

### D7. Highlight geometry is physical, deliberately

**Decision.** Rectangles are positioned with physical `left`/`top`, are not converted to logical properties, and are not mirrored under `dir="rtl"`. The exemption is commented at the code site.

**Why.** These are canvas coordinates inside a page whose layout the vendor already resolved, RTL included: `DocxTextRunInfo` reports `direction: 'ltr' | 'rtl'` per run, and `getCellViewportRect` applies the engine's own horizontal mapping before returning (`x: this.screenX(n.x, n.w)`). Mirroring them would move every highlight off its text in Arabic while leaving English correct.

The comment matters more than the decision. The repository has a standing rule to replace physical direction utilities with logical ones, and an RTL sweep that does not know these are canvas coordinates would "fix" them into breakage. All *surrounding* UI — the overlay container's own non-geometric styling, any label beside it — follows the normal logical-property rules.

### D8. Group by source URL, across the whole annotation list

**Decision.** Same-source identity is `body.source.attachment.url`. Gathering runs over the message's full annotation list, not over one `AnnotationGroup`.

**Why URL, not title.** `resolveSourceName` in `libs/quotations/src/utils/group-annotations-by-source.ts` falls back to `body.source.attachment.title` for display, and two different files can carry the same title. Grouping on it would render one document's highlights over another's — a correctness bug that looks like a rendering glitch.

**Why the whole list.** `groupAnnotationsByCitId` deliberately scopes a group to one `cit` id so two markers citing one document keep separate popup state. That is right for popups and wrong for highlights: from inside a single group, annotations behind *other* markers citing the same file are unreachable. `annotationToPdfCanvasContent` inherits this limitation today — it finds the group by membership and filters within it. Gathering across the list is what makes "include annotations belonging to the same source document" actually true.

This is a behavioural difference from the PDF mapper, confined to the new Office path; changing the PDF mapper to match is a follow-up, not part of this change.

### D9. Widen the backend DTO; do not add an endpoint

**Decision.** Widen `AnnotationSelectorDto`'s optional-field allowlist. No new route.

**Why this is forced.** The originating request allowed a backend change only if inspection proved selector data is currently lost. It is:

- `apps/chat-api/src/conversations/dto/annotation.dto.ts:22` declares a closed allowlist — `type`, `start`, `end`, `page`, `x1`, `y1`, `x2`, `y2`, `tag`, `id`.
- `apps/chat-api/src/main.ts:128-131` installs `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.

So a selector carrying `story`/`path`/`slide`/`shape_id`/`sheet` is either stripped, or — because `AnnotationDto` reaches this pipe through the conversation-save *request* body via `message-custom-content.dto.ts` — **rejects the entire save with 400**. The second outcome is the more serious: an Office citation could make a conversation unsaveable.

**Why widening only.** The class comment already states it is "validated as an open shape (`type` plus every known optional field) rather than a discriminated union, mirroring `AnnotationSelector` in `chat-shared`". Adding optional fields honours that design. It is also strictly backward compatible: the validator accepts a superset of what it accepted before, so nothing that validates today stops validating.

**One shape complication.** `start`/`end` are `@IsNumber()` today, but `excel_rc_range` uses `{ row, col }` objects and permits `end: null`. Those fields must accept a number, a nested address, or (for `end`) `null`. This is the least elegant part of the change and a direct consequence of the upstream contract reusing `start`/`end` for two different value kinds; it is documented here rather than smoothed over.

**Streaming needs no change.** `normalizeBodySelector` in `apply-chunk-annotations.server.ts` keeps any selector object with a string `type`, so Office selectors already survive assembly. Verified by test, not assumed.

## Architecture

```
DIAL Core (wire)
      │  body.selector: DocxRange | PptxRange | ExcelRcRange
      │  (docx/pptx `end` EXCLUSIVE; excel `end` an inclusive last-cell address — corrected D3)
      ▼
apps/chat-api  AnnotationSelectorDto ......................... widened allowlist (D9)
      │
      ▼
libs/chat-shared  annotation.ts .............................. 3 wire types, open branch kept
      │
      ▼
libs/quotations   annotation.ts .............................. validate + rename end→endExclusive (D3)
                  group-annotations-by-source.ts ............. gather by source URL (D8)
      │  OfficeHighlightLocation[] — quotations-owned type, document coordinates only
      ▼
libs/chat-hooks   annotationToOoxmlCanvasContent ............. maps into OoxmlHighlight[] + injected URL resolvers
      │  OoxmlCanvasContent { url, format, highlights?, selectedHighlightId? }
      ▼
libs/attachment-canvas  OoxmlContent ......................... shared parse (D1), overlay (D4),
                        utils/ooxml-highlight-geometry ....... page offsets (D5), rect math
      │
apps/chat  ConversationMessageItem.handleCitationPreview ..... one new branch
```

The library boundary carries a URL, a format enum, and document coordinates. It does not carry a DIAL file id, bucket, MIME type, auth token, `/api` path, or fetch function — DIAL file-id resolution stays in the host-injected `AttachmentCanvasUrlResolvers` callbacks that `libs/chat-hooks` already receives.

**Type ownership correction (2026-09-10).** The original diagram had `libs/quotations` emit `OoxmlHighlight[]` — `libs/attachment-canvas`'s own type — directly. Implementation found this creates a real circular dependency: `libs/attachment-canvas` already imports `annotationsToPdfHighlights` from `libs/quotations` (its own test exercises the existing PDF highlight path). `libs/quotations` instead owns and exports `OfficeHighlightLocation` (`libs/quotations/src/models/office-highlight.ts`), discriminated by the wire's own `type` string. `libs/chat-hooks` — which already depends on both libs, per its `package.json` peers — is the layer that maps `OfficeHighlightLocation[]` into `OoxmlHighlight[]`/`OoxmlHighlightLocation[]`, assigning the `OoxmlHighlightKind` enum value per location. The data flow this diagram describes is unchanged; only which lib owns the intermediate type is corrected.

## Implementation notes

### File layout

| Path | Change |
| --- | --- |
| `libs/chat-shared/src/models/annotation.ts` | add `DocxRangeSelector`, `PptxRangeSelector`, `ExcelRcRangeSelector`; extend the union, keep its open branch |
| `libs/quotations/src/utils/annotation.ts` | type guards + normalisation + inclusive→exclusive conversion |
| `libs/quotations/src/utils/group-annotations-by-source.ts` | same-source gathering by URL |
| `libs/chat-hooks/src/files/attachment-canvas.ts` | `annotationToOoxmlCanvasContent`, beside `annotationToPdfCanvasContent` |
| `libs/attachment-canvas/src/models/attachment-canvas.ts` | highlight descriptor types; `OoxmlCanvasContent` fields; two label fields |
| `libs/attachment-canvas/src/types/attachment-canvas.ts` | `OoxmlHighlightKind` enum |
| `libs/attachment-canvas/src/utils/ooxml-highlight-geometry.ts` | **new** — page offsets (D5), partial-run measurement, same-line merging |
| `libs/attachment-canvas/src/components/OoxmlContent/OoxmlContent.tsx` | acquisition branch, resolution effects, overlay |
| `libs/attachment-canvas/src/components/AttachmentCanvasBody/AttachmentCanvasBody.tsx` | forward highlight props + labels |
| `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx` | one branch in `handleCitationPreview` |
| `apps/chat-api/src/conversations/dto/annotation.dto.ts` | widen the allowlist |

New utility and model files use kebab-case per the repository's file-naming rule; component and hook files stay PascalCase.

### Resolution effects in `OoxmlContent`

The component keeps its current single load effect and adds resolution as separate effects, so a scale change re-resolves rectangles without reloading the document:

- **Load effect** — keyed on `[content.format, content.url, hasHighlights]`. Branches on `hasHighlights` for acquisition (D1). Extends the existing `disposed` flag to cover engine load; on teardown destroys the viewer, then the engine, then clears the container.
- **Resolution effect** — keyed on `[locations, scale, visiblePageRange]`. Calls `collectPageRuns`/`collectSlideRuns` for pages carrying a highlight or newly visible, computes rectangles, and sets state. Guarded by the same `disposed` pattern.
- **Navigation effect** — keyed on `[selectedHighlightId]`. Calls `scrollToPage`/`scrollToSlide`, or the XLSX `goToSheet` → `scrollToCell` sequence, then announces once.
- **Invalidation** — `onScaleChange`, `onVisiblePageChange`/`onVisibleSlideChange` (DOCX/PPTX) and `onViewportChange`/`onScaleChange`/`onSheetChange` (XLSX) feed a single `requestAnimationFrame`-coalesced recompute, so a wheel-zoom burst costs one recompute per frame.

The `cancelled`-flag-plus-`async/await` shape follows `useFavicon`, the repository's reference pattern, and the existing effect in this same file. The `ResizeObserver`-plus-coalescing approach follows `PdfContent`, which solves the same problem — keeping an overlay aligned against a viewer that exposes no change event for the thing you need.

### Lazy loading

`OoxmlContent` is imported statically by `AttachmentCanvasBody`; the *format entry points* are what is dynamically imported, inside `createViewer`. Resolution code therefore sits behind the same dynamic boundary as the format it serves — the DOCX resolver is reachable only from the `OoxmlFileType.Docx` branch — so opening a DOCX still pulls only `@silurus/ooxml/docx` plus the shared `chart-ex`, and a plain text or image preview pays nothing.

### XLSX coordinate basing

Selector `row`/`col` are 1-based and pass through **unconverted**. This was verified in the installed build rather than inferred:

```js
getCellViewportRect(e) {
  let t = typeof e == "string" ? Or(e) : e;
  if (!t || t.row < 1 || t.col < 1) return null;   // ← 1-based
  ...
}
```

`getCellViewportRect` accepts `CellAddress | string`, so an A1 string would also work; passing the address object avoids building and re-parsing a string for no gain. A `null` return means "not currently measurable" and yields no rectangle — never a zero rectangle, which would draw a visible artefact at the origin.

### Accessibility

Two new labels, both threaded end to end (`AttachmentCanvasLabels` → `AttachmentCanvasBodyLabels`'s `Pick` → `OoxmlContent`), with English defaults in the library and app keys under the existing `attachmentCanvas.*` namespace:

| Key | Enum member | English |
| --- | --- | --- |
| `attachmentCanvas.ooxmlHighlightsLabel` | `AttachmentCanvasI18nKeys.OoxmlHighlightsLabel` | `Cited locations` |
| `attachmentCanvas.ooxmlHighlightNavigatedLabel` | `AttachmentCanvasI18nKeys.OoxmlHighlightNavigatedLabel` | `Scrolled to the cited location` |

The overlay is `role="region"` with the first label; rectangles are `aria-hidden` (decorative on their own). Navigation completion announces once through `role="status" aria-live="polite"` — scrolling a canvas is otherwise silent, so a screen-reader user gets no confirmation that Preview did anything. Scroll, zoom, and resize do not re-announce. The overlay takes no focus and adds no tab stops, which `pointer-events: none` also guarantees for pointer interaction. The transparent-fill-plus-border style inherited from `CITATION_HIGHLIGHT_STYLE` keeps the underlying text's contrast intact, so the AAA target is unaffected.

### Theming

Highlight colours go through the existing `AttachmentCanvasColors` + `buildCssVars` mechanism — one interface field per CSS var the stylesheet reads, in both directions, with no hardcoded hex in the component. This follows `openspec/lib-styling-guide.md` and keeps the dead-style checks meaningful.

## Risks and mitigations

| Risk | Severity | Mitigation |
| --- | --- | --- |
| DOCX/PPTX discriminator strings unknown | **High** — wrong strings mean silent non-resolution | Structural guards requiring the full field set, isolated one-per-format so each becomes a one-line change; captured fixture is the first task and blocks release |
| Page-offset formula not in the public contract | Medium — a version bump could misalign every highlight | Confined to one tested function (D5); a bump breaks one test loudly |
| Borrowed-engine leak | Medium — leaks a parse and a worker per document | Explicit ordered teardown with a dedicated test |
| Double-applied scale | Medium — plausible-looking misalignment | Spec states runs come back pre-scaled; scale enters only via the passed width and the offset function |
| Off-by-one from the inclusive/exclusive conflict | Medium — silently plausible | Single conversion point, `endExclusive` naming, required boundary tests |
| `start`/`end` accepting number-or-object in the DTO | Low | Optional and additive; existing numeric validation retained and regression-tested |
| Rotated PPTX shapes | Low | Declared non-goal; falls back to no highlight, never a misplaced one |

## Open questions

1. ~~**The two discriminator strings.**~~ **Resolved (2026-09-10).** Three real `dial-document` responses were captured and saved at `libs/quotations/src/utils/tests/fixtures/office-selectors.json`: the DOCX discriminator is **`docx_text_range`**, the PPTX discriminator is **`pptx_text_range`**, and `excel_rc_range` is reconfirmed. The same evidence also corrected D3 above: for both `docx_text_range` and `pptx_text_range`, `end` is already exclusive on the wire (`end - start === text.length` in every sample), not inclusive as originally assumed — normalisation renames the field to `endExclusive` without adding 1.
2. **Should the PDF mapper also gather across the whole annotation list (D8)?** It has the same single-group limitation. Deliberately out of scope here — changing PDF behaviour is not this change's job — and recorded as a follow-up.
3. **Rotated PPTX shape geometry.** `PptxTextRunInfo` carries `rotation`, `shapeFlipH`, `shapeFlipV`, `textBodyRotation`; composing them is tractable but unbounded in verification cost. Deferred until a real citation needs it.
