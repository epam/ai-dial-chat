## MODIFIED Requirements

### Requirement: `annotationToOoxmlCanvasContent` maps a citation to canvas content

`libs/chat-hooks/src/files/attachment-canvas.ts` SHALL export `annotationToOoxmlCanvasContent(annotation, annotations, resolvers)` returning `OoxmlCanvasContent | null`, as a direct sibling of the existing `annotationToPdfCanvasContent` and following its structure.

It SHALL:

- Return `null` when the annotation has no source attachment, or when the source's MIME type / URL extension does not resolve to `OoxmlFileType.Docx`, `Xlsx`, or `Pptx`. It SHALL return `null` for CSV, so CSV keeps its current plain preview.
- Resolve the file URL through the injected resolvers — `resolveDialFileDownloadUrl` for a DIAL file id (`isDialFileId`), otherwise the source URL as-is — mirroring `annotationToPdfCanvasContent`. It SHALL return `null` when no URL resolves.
- Gather same-source annotations per the requirement above, call `libs/quotations`'s `annotationToOfficeHighlightLocations` per annotation, and build one `OoxmlHighlight` per annotation that yields at least one location — translating each `OfficeHighlightLocation` into `OoxmlHighlightLocation` by assigning the matching `OoxmlHighlightKind` value (this translation is this mapper's responsibility; see the `message-annotations` capability's normalisation requirement) — dropping annotations that yield none.
- Set `selectedHighlightId` to the clicked annotation's highlight id, and SHALL omit `selectedHighlightId` when the clicked annotation produced no highlight — never silently selecting a different annotation's highlight.
- Derive highlight ids the same way the PDF path does, reusing `annotationHighlightId` — `annotation.index` when the wire supplied one, otherwise an id derived from the annotation's own identity (its `cit` tag id plus a digest of its selectors), falling back to the position within the gathered list only for an annotation carrying neither — so ids stay stable, comparable, and unique per annotation even when two Office ranges share one `cit` id.
- Return content with `highlights` omitted (not an empty array) when no annotation yields a location, so the renderer takes its existing non-highlight path unchanged.

The mapper SHALL remain a pure function of its arguments plus the injected resolvers, with no fetch and no DOM access.

**State ownership**: none — pure mapper. The canvas's open state stays with the existing `useOpenAttachmentCanvas` / canvas context.
**Adapter contract**: `AttachmentCanvasUrlResolvers`, already injected by `apps/chat`. No new host coupling.
**i18n**: none.
**RTL**: none.
**Feature flag**: none.
**Memoisation**: the `apps/chat` call site SHALL keep its existing `useCallback` wrapping of the preview handler.
**Telemetry**: none.

#### Scenario: A DOCX citation produces highlights and a selected id

- **WHEN** the user previews a DOCX citation whose annotation carries one valid DOCX selector
- **THEN** the result is `{ type: Ooxml, url, format: Docx, highlights: [...], selectedHighlightId }` with the selected id present in `highlights`

#### Scenario: A CSV source returns null

- **WHEN** the annotation's source is a `.csv` file
- **THEN** the mapper returns `null` and the existing plain-attachment path handles it

#### Scenario: An unresolvable selector yields content with no highlights

- **WHEN** the annotation's only selector is malformed
- **THEN** the result carries `url` and `format` with `highlights` and `selectedHighlightId` both `undefined`

#### Scenario: Selected id is omitted when the clicked annotation resolves to nothing

- **WHEN** two annotations cite one file, the clicked one's selector is malformed, and the other's is valid
- **THEN** `highlights` contains the other annotation's highlight and `selectedHighlightId` is `undefined`

#### Scenario: A DIAL file id is resolved through the injected resolver

- **WHEN** the source URL is a DIAL `files/…` id
- **THEN** `resolveDialFileDownloadUrl` supplies `url`, and returning `undefined` from it makes the mapper return `null`
