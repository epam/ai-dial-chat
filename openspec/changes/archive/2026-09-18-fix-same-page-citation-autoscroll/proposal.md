## Why

Switching between two citations that point at the same PDF page does not scroll the
preview to the newly selected citation (issue #8907): the highlight moves, but the
viewport stays where it was, so the reader cannot see where the cited passage is.
The PDF viewer's navigation is purely declarative — the vendor re-issues
`goToHighlight` only when `selectedHighlightId` changes and `setPage` only when
`page` changes — while `libs/quotations` derives a highlight id from the
annotation's *position inside the clicked citation group*. For `html_tag` (`cit`)
citations each citation is its own single-annotation group and the wire's
`annotation.index` is usually absent, so **every** such citation resolves to the id
`"0"`. Two citations on the same page therefore produce canvas content that is
value-identical, no navigation is re-issued, and nothing scrolls. Across different
pages it still works only because `page` happens to change.

## What Changes

- Derive a **message-unique, content-derived** highlight id per annotation in
  `libs/quotations/src/utils/annotation.ts`, shared by `annotationsToPdfHighlights`
  and `annotationHighlightId` so the two stay identical by construction: keep
  `annotation.index` when the wire provides it, otherwise build the id from the
  annotation's own identity (its `cit` tag id plus a digest of its selectors),
  falling back to the input position only when the annotation carries neither.
- Keep the highlight **scope** unchanged: the PDF canvas still receives only the
  clicked citation group's same-document annotations, and the OOXML path still
  gathers same-source annotations across the message. Only the id formula changes.
- Keep OOXML ids unique: the digest covers the Office selector shapes
  (`docx_text_range`, `pptx_text_range`, `excel_rc_range`, and the table anchor
  forms), so two ranges sharing one `cit` id do not collapse onto one id.
- Add regression coverage: two same-page `cit` citations yield different
  `selectedHighlightId` values (`libs/chat-hooks`), and the id helpers agree and stay
  unique per annotation (`libs/quotations`).

No breaking change: the ids are opaque, produced and consumed inside the same
render pass, and never persisted or sent over the wire.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `canvas`: the PDF citation highlight **id formula** (currently "`annotation.index`
  when present, otherwise the annotation's position in the group") becomes
  annotation-identity-derived, and the spec gains the requirement that selecting a
  different citation on the **same** page re-navigates the preview.
- `office-annotation-highlighting`: its statement that ids reuse
  `annotationHighlightId` ("`annotation.index` when present, otherwise the position
  within the gathered list") is restated against the new formula, with the
  uniqueness guarantee for two ranges under one `cit` id.

## Impact

- `libs/quotations/src/utils/annotation.ts` — `annotationHighlightId`,
  `annotationsToPdfHighlights`, plus a new internal identity-key helper; its
  `README.md` and JSDoc.
- Consumers of the id formula, unchanged in shape but exercised by new tests:
  `libs/chat-hooks/src/files/attachment-canvas.ts`
  (`annotationToPdfCanvasContent`, `annotationToOoxmlCanvasContent`).
- Specs: `openspec/specs/canvas/spec.md`,
  `openspec/specs/office-annotation-highlighting/spec.md`.
- No change to `libs/attachment-canvas`, to `PdfContent`, or to the vendor
  packages (`@epam/ai-dial-react-pdf-highlighter`, `@epam/pdf-highlighter-kit`):
  both were verified to re-issue navigation correctly once the id actually changes.
