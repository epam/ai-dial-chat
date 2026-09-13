## MODIFIED Requirements

### Requirement: `OoxmlCanvasContent` model interface

`libs/attachment-canvas/src/models/attachment-canvas.ts` SHALL export:

```ts
interface OoxmlCanvasContent {
  type: AttachmentContentType.Ooxml;
  url: string;
  format: OoxmlFileType;
  highlights?: OoxmlHighlight[];
  selectedHighlightId?: string;
}
```

- `url` — a resolved download URL or object URL for the Office or CSV file. Required; the viewer has no other source.
- `format` — selects the format-specific renderer.
- `highlights` — optional citation locations to draw over the rendered document, expressed in document coordinates (story/path/offsets, slide/shape/offsets, sheet/row/col). Omitted for a plain preview. An empty array SHALL NOT be used to mean "no highlights"; the field is omitted instead, so the renderer's non-highlight path is selected by absence.
- `selectedHighlightId` — optional id of the one highlight to mark selected and navigate to on load. Omitted when nothing is selected, and omitted rather than defaulted when the clicked citation resolved to no highlight, so no unrelated highlight is silently selected.

`highlights` is only meaningful for `OoxmlFileType.Docx`, `Xlsx`, and `Pptx`. For `OoxmlFileType.Csv` it SHALL be ignored — citation selectors target Office documents, and CSV has no OOXML layout model.

`OoxmlCanvasContent` SHALL be added to the `AttachmentCanvasContent` discriminated union, and the interface type, `OoxmlFileType`, `OoxmlHighlight`, `OoxmlHighlightKind`, and every location type reachable from `OoxmlHighlight` SHALL be exported from the library's public entry point.

These fields are the **entire** library boundary contract for Office and CSV previews. The library SHALL NOT receive a MIME type, a DIAL file path, a bucket, an auth token, or a fetch function — see the app-layer resolver requirement below. Highlight descriptors carry document coordinates only and SHALL NOT carry pixels, URLs, or host identifiers.

#### Scenario: OoxmlCanvasContent is part of the union

- **WHEN** a function accepts `AttachmentCanvasContent`
- **THEN** it can receive an `OoxmlCanvasContent` value without a TypeScript error

#### Scenario: content type is exported for host construction

- **WHEN** `apps/chat` imports `OoxmlCanvasContent` and `OoxmlFileType` from `@epam/ai-dial-attachment-canvas`
- **THEN** both names resolve, and the host can build a payload without `Parameters<>` gymnastics

#### Scenario: highlight types are exported for host construction

- **WHEN** `libs/chat-hooks` imports `OoxmlHighlight` and `OoxmlHighlightKind` from `@epam/ai-dial-attachment-canvas`
- **THEN** both resolve, and a highlight can be built with named enum members rather than string literals

#### Scenario: a plain preview omits the highlight fields

- **WHEN** an Office attachment is opened outside a citation
- **THEN** `highlights` and `selectedHighlightId` are both `undefined` and the payload is identical in shape to before this change

#### Scenario: CSV ignores highlights

- **WHEN** an `OoxmlCanvasContent` with `format: Csv` carries a `highlights` array
- **THEN** no overlay is rendered and the CSV preview behaves exactly as it does today

## ADDED Requirements

### Requirement: Highlight-aware viewer acquisition uses the shared-parse factories

`OoxmlContent` SHALL choose its viewer acquisition mode from whether highlights were requested, and the two modes SHALL be mutually exclusive for a given document.

- **Without highlights** — the current path is retained verbatim: construct the viewer with `new DocxScrollViewer(container, opts)` / `new XlsxViewer(container, opts)` / `new PptxScrollViewer(container, opts)` / `new XlsxSheetViewer(canvas, opts)` and call `viewer.load(url)`. The viewer owns its engine and `viewer.destroy()` releases everything.
- **With highlights** for `Docx` and `Pptx` — load the engine first (`DocxDocument.load(url, opts)` / `PptxPresentation.load(url, opts)`), then create the viewer from it (`DocxScrollViewer.fromDocument(container, document, opts)` / `PptxScrollViewer.fromPresentation(container, presentation, opts)`). The resolver reads run geometry from that same engine instance, so rectangles and pixels cannot come from different parses.
- **With highlights** for `Xlsx` — the current `new XlsxViewer(container, opts)` + `load(url)` path is retained, because cell geometry comes from the viewer's own `getCellViewportRect` and no separate engine access is needed.

A viewer returned by a `from*()` factory has type `Omit<Viewer, 'load'>`; the renderer SHALL NOT attempt to call `load` on it. Because `destroy()` on such a viewer deliberately leaves the borrowed engine alive, the renderer SHALL destroy the engine itself after destroying the viewer.

The `chart-ex` renderer, `enableTextSelection`, `refitOnResize`, and `onError` options SHALL continue to be passed in both modes, so a highlighted document renders identically to a plain one apart from the overlay.

#### Scenario: A highlighted DOCX uses the shared-parse factory

- **WHEN** `OoxmlContent` receives `format: Docx` with highlights
- **THEN** a `DocxDocument` is loaded and the viewer is created via `DocxScrollViewer.fromDocument` from that instance

#### Scenario: A plain DOCX keeps the self-loading path

- **WHEN** `OoxmlContent` receives `format: Docx` with no highlights
- **THEN** the viewer is constructed directly and `load(url)` is called on it

#### Scenario: A highlighted XLSX keeps the self-loading path

- **WHEN** `OoxmlContent` receives `format: Xlsx` with highlights
- **THEN** the viewer is constructed directly, `load(url)` is called, and cell rectangles come from `getCellViewportRect`

#### Scenario: Both viewer and engine are destroyed in shared-parse mode

- **WHEN** a highlighted PPTX is replaced or unmounted
- **THEN** the viewer is destroyed and the borrowed `PptxPresentation` is destroyed afterwards

---

### Requirement: `AttachmentCanvasBody` forwards highlight props and labels to `OoxmlContent`

`AttachmentCanvasBody` SHALL pass `content.highlights` and `content.selectedHighlightId` to `OoxmlContent` when rendering the `Ooxml` branch, alongside the existing `content`, `fileName`, `loadErrorLabel`, `formulaLabel`, and `formulaLabelClassName` props.

`AttachmentCanvasLabels` SHALL gain `ooxmlHighlightsLabel?: string` and `ooxmlHighlightNavigatedLabel?: string`, both defaulting in the library to `'Cited locations'` and `'Scrolled to the cited location'` respectively. Both SHALL be added to the `AttachmentCanvasBodyLabels` `Pick` list and forwarded to `OoxmlContent`, so a host-supplied value actually reaches the element that renders it rather than leaving the child on its English default.

#### Scenario: Highlight props reach the renderer

- **WHEN** `AttachmentCanvasBody` renders `OoxmlCanvasContent` carrying highlights and a selected id
- **THEN** `OoxmlContent` receives both values

#### Scenario: New labels are forwarded end to end

- **WHEN** a host supplies `ooxmlHighlightsLabel` and `ooxmlHighlightNavigatedLabel` on `AttachmentCanvas`
- **THEN** both values are present on the overlay region and the status announcement inside `OoxmlContent`

#### Scenario: Labels fall back to library defaults

- **WHEN** a host supplies neither label
- **THEN** the overlay region is named `'Cited locations'` and the announcement reads `'Scrolled to the cited location'`
