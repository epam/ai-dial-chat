## ADDED Requirements

### Requirement: Office citation preview navigates to and highlights the annotation's cited location

When opening a citation whose source attachment is a DOCX, XLSX, or PPTX file, the attachment canvas SHALL open that document, navigate to the cited location, and mark the clicked annotation's highlight selected — mirroring the existing PDF requirement that navigation happens whether or not the cited region is renderable as a visible highlight.

`apps/chat/src/components/ConversationView/ConversationMessageItem.tsx` SHALL extend `handleCitationPreview` with one additional branch, ordered so existing behaviour is unchanged:

1. `annotationToPdfCanvasContent` — unchanged, still first.
2. **New**: `annotationToOoxmlCanvasContent`, attempted only when the PDF mapper returned `null`. When it returns non-`null`, the canvas opens with that content and the same `fileName` derivation the PDF branch already uses (`attachment.title`, falling back to the decoded last URL segment).
3. `annotationToDisplayAttachment` + `handleAttachmentClick` — unchanged, still the final fallback, now reached only when neither mapper resolves.

The clicked annotation SHALL be the one whose highlight is selected, never the group's `primaryAnnotation` — the same rule the PDF path already follows when a grouped citation's popup has been switched to another annotation.

The annotation list passed to the Office mapper SHALL be the message's resolved annotation list, not a single `AnnotationGroup`, so annotations citing the same document from behind other `cit` markers are included. Same-source identity SHALL be the source attachment URL, never the display title.

`handleCitationPreview` SHALL remain wrapped in `useCallback`, and its dependency list SHALL be updated to include whatever the new branch reads.

Download behaviour, the citation popup's close-on-Preview behaviour, PDF citation preview, ordinary Office preview opened outside a citation, and CSV preview SHALL all remain unchanged.

**i18n**: no new strings at this call site; the two new accessibility strings are declared by the `office-annotation-highlighting` capability and supplied to `AttachmentCanvas` alongside the existing `attachmentCanvas.*` labels.
**RTL**: none at this call site — no new UI; navigation is an internal viewer scroll operation.
**Feature flag**: none. The OOXML viewer is not gated behind `ENABLED_FEATURES` or `ENABLED_FEATURES_ROLES`, and this change follows that precedent.
**Memoisation**: `useCallback` on the handler, `useMemo` on any derived annotation list, matching the existing `citationGroups` memoisation.
**Telemetry**: none.

#### Scenario: A DOCX citation opens with a selected highlight

- **WHEN** the user clicks Preview on a citation whose source is a `.docx` file with a valid DOCX range selector
- **THEN** the canvas opens the document, scrolls to the cited page, and that annotation's highlight is rendered selected

#### Scenario: A PPTX citation opens on the cited slide

- **WHEN** the user clicks Preview on a citation with a PPTX range selector for slide 4
- **THEN** the canvas opens the deck and scrolls to slide 4

#### Scenario: An XLSX citation opens on the cited sheet and cell

- **WHEN** the user clicks Preview on a citation with an `excel_rc_range` selector for sheet `'Q3'`, row 14, column 3
- **THEN** the canvas opens the workbook, switches to `'Q3'`, scrolls that cell into view, and highlights it

#### Scenario: A grouped Office citation previews the selected annotation, not the primary one

- **WHEN** a citation group holds annotations for pages 2 and 9 of one DOCX, the primary is the page-2 entry, and the user has switched the popup to the page-9 annotation before clicking Preview
- **THEN** the mapper receives the page-9 annotation and the canvas navigates to page 9 with that highlight selected

#### Scenario: An Office citation with no resolvable selector still opens the document

- **WHEN** the citation's source is a `.pptx` file whose selector is malformed
- **THEN** the canvas opens the deck with no highlight, and the plain-attachment fallback is not used

#### Scenario: PDF citations are unaffected

- **WHEN** the user clicks Preview on a PDF citation
- **THEN** `annotationToPdfCanvasContent` resolves it exactly as before and the Office mapper is never consulted

#### Scenario: A CSV citation falls through to the existing path

- **WHEN** the citation's source is a `.csv` file
- **THEN** both mappers return `null` and the existing `annotationToDisplayAttachment` fallback handles it as it does today
