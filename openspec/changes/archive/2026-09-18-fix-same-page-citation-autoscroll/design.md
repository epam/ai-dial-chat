## Context

`PdfContent` (`libs/attachment-canvas`) drives the PDF viewer **declaratively**: it
forwards `selectedHighlightId` and `selectedPageNumber` to `DocumentPreview`
(`@epam/ai-dial-react-pdf-highlighter`), whose internal `PdfViewer` re-issues
`goToHighlight(id)` from an effect keyed on `[isReady, zoomReady, selectedHighlightId]`
and `setPage(page)` from one keyed on `[isReady, selectedPageNumber]`. There is no
imperative navigation escape hatch: `PdfViewerApi` exposes `navigateToPage` only.

The ids come from `libs/quotations/src/utils/annotation.ts`:

```ts
id: String(annotation.index ?? i)                       // annotationsToPdfHighlights
String(annotation.index ?? fallbackIndex)               // annotationHighlightId
```

where `i` / `fallbackIndex` is the position **inside the list the caller gathered**.
`annotationToPdfCanvasContent` gathers only the clicked citation **group**, and
`groupAnnotationsByCitId` puts each `html_tag` (`cit`) citation in its own group, so
a group usually holds exactly one annotation. `annotation.index` is optional on the
wire (`normalizeRawAnnotations` reads it from the raw `index` field and leaves it
`undefined` when absent). Net effect: every `cit` citation of a PDF resolves to the
id `"0"`.

Verified during investigation of issue #8907, on this working tree:

- `annotationToPdfCanvasContent` for two same-page `cit` citations returns
  `selectedHighlightId` `"0"` and `"0"`, with `page` `4` and `4` — value-identical
  content, so neither vendor effect re-runs and nothing scrolls.
- The React chain is otherwise correct: with a real `DocumentPreview` and a stubbed
  `@epam/pdf-highlighter-kit`, changing only `selectedHighlightId` (same
  `selectedPageNumber`) produces `loadHighlights → goToHighlight:0 … loadHighlights
  → goToHighlight:1`.
- The kit's `goToHighlight` scrolls correctly within one page
  (`container.scrollTop` 2970 → 3990 for a top vs. bottom bbox on the same page).
- `@epam/pdf-highlighter-kit@0.0.19` is the latest published version, so there is no
  upstream fix to wait for. (Unrelated local nit: `node_modules` holds
  `@epam/ai-dial-react-pdf-highlighter@0.2.0` while the lockfile pins
  `0.3.0-dev.1`; the navigation code is byte-identical between the two.)

Cross-page switching works today only incidentally, because `page` differs and the
`setPage` effect fires.

## Goals / Non-Goals

**Goals:**

- Make two different citations of the same document produce different
  `selectedHighlightId` values, so a same-page selection re-navigates the preview.
- Keep the PDF and OOXML paths using **one** id helper, so the id a highlight
  carries and the id computed for the clicked annotation cannot drift apart.
- Keep ids CSS-selector-safe: the kit interpolates them into
  `[data-term-id="<id>"]` selectors (`PDFHighlightViewer`), so quotes, brackets, and
  backslashes in an id would break highlight styling and selection.
- Regression tests that fail on today's code.

**Non-Goals:**

- Widening what the PDF canvas highlights (it stays the clicked citation group's
  same-document annotations). That is a product decision, not this bug.
- Touching `libs/attachment-canvas`, `PdfContent`, or the vendor packages.
- Adding an imperative navigation API or a navigation nonce to `PdfCanvasContent`.
- Changing the persisted message format or anything on the wire.

## Decisions

### 1. Derive the id from the annotation's own identity, behind one shared helper

`annotationHighlightId(annotation, fallbackIndex)` becomes the single entry point,
and `annotationsToPdfHighlights` calls it with the input position instead of
inlining the formula. Resolution order:

1. `String(annotation.index)` when present — already message-unique, short, and
   backwards-compatible with every existing test and persisted expectation.
2. Otherwise an identity-derived id: the `cit` id from a `html_tag`
   `target.selector` plus a digest of the `body.selector` entries.
3. Otherwise `String(fallbackIndex)` — today's behavior, for an annotation that
   carries neither an index, a `cit` id, nor any recognised selector.

Alternative considered — **make the group scope message-wide** (pass all
same-source annotations like the OOXML path does, which is why OOXML has no such
collision): it fixes ids as a side effect but changes what the reader sees
highlighted in the preview, and the current scope is asserted by an existing test
("selects highlights from the clicked cit group and only its PDF"). Rejected as a
behavior change riding on a bug fix.

Alternative considered — **a navigation nonce** on `PdfCanvasContent` that changes
on every open: it would re-navigate even for an identical selection, and with no
imperative `goToHighlight` in `PdfViewerApi` the only lever left is remounting the
viewer (re-fetching and re-rendering the PDF). Rejected; also does not fix the
duplicate ids themselves, which are wrong independently of scrolling.

### 2. Hash the selector digest (djb2, base36), do not embed raw selector JSON

The digest is built by walking the annotation's selectors in order and folding
their discriminating fields into a canonical string, then hashing it to a short
base36 string. Rationale:

- **Selector-safety** (see Goals): a raw JSON digest contains `"`, `{`, `[`, which
  break the kit's `[data-term-id="…"]` interpolation.
- Ids also travel into React keys and DOM attributes in `OoxmlContent`; short ids
  keep the DOM readable.
- Collision risk is irrelevant to correctness here: a collision can only occur
  between two annotations whose selectors are equal *and* whose `cit` ids are
  equal — i.e. the same cited region, which may legitimately share one id.

The canonical string covers both families so neither path regresses:

- PDF: `type`, `page`, and the four resolved edges (via the existing selector
  reader's output, so the three accepted coordinate forms of one region agree).
- Office: `docx_text_range` (`story`, `path`, `start`, `end`), `pptx_text_range`
  (`slide`, `shape_id`, `start`, `end`), `excel_rc_range` (`sheet`, `start`, `end`),
  and the `docx_text_anchor` / `pptx_text_anchor` table forms (`cells`,
  `occurrence`, `slide`).

Office coverage is not optional: `annotationToOoxmlCanvasContent` shares this
helper, and two ranges under one `cit` id must not collapse onto the `cit` id alone.

### 3. `libs/quotations` stays host-agnostic

Everything here is a pure function over `Annotation` fields — no host, transport, or
app knowledge enters the lib, so §Library isolation is unaffected. The ids remain
opaque: callers may compare them, never parse them, and nothing persists them.

## Risks / Trade-offs

- **An id format change leaks into a snapshot or an equality assertion** → run the
  full `libs/quotations`, `libs/chat-hooks`, and `libs/attachment-canvas` suites;
  existing specs that pin `index`-derived ids (`'0'`, `'7'`) keep passing because
  branch 1 is unchanged, and the reference-PDF path keeps its own
  `reference-page-N` ids, which are built in `libs/chat-hooks` and untouched here.
- **Longer, non-numeric ids in the DOM** → mitigated by hashing to base36; ids stay
  short and selector-safe.
- **Two genuinely distinct citations with byte-identical selectors and `cit` ids
  still share an id** → they point at the same region on the same page, so a
  no-op navigation is correct; noted in the spec as permitted.
- **Reference-only PDF chips (`reference-page-N`) still cannot re-navigate between
  two references to the same page** → out of scope: both target the same page top,
  so there is nothing to scroll to. Left as-is deliberately rather than papered over.
- **The main `canvas` spec's narrative sections (not its requirement blocks) also
  state the old formula** → the delta only rewrites requirement blocks, so the
  prose at `openspec/specs/canvas/spec.md` (the citation-flow walkthrough and the
  `PdfCanvasContent` table) is corrected as part of this change's task list, so the
  archived spec does not contradict itself.
