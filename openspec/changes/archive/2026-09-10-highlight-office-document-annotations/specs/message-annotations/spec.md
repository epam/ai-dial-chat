## MODIFIED Requirements

### Requirement: Annotation types defined in `libs/chat-shared`

`libs/chat-shared/src/models/annotation.ts` SHALL export the following TypeScript interfaces:

- `TextCharacterRangeSelector` — `{ type: 'text_character_range'; start: number; end: number }`
- `HtmlTagSelector` — `{ type: 'html_tag'; tag: string; id: string }` — targets the supported paired inline element `<cit data-id="e43864"></cit>` inside the accumulated message text by its `data-id` attribute.
- `DocxRangeSelector` — `{ type: 'docx_text_range'; story: string; path: number[]; start: number; end: number; text: string }` — targets a character range inside a DOCX story. `story` SHALL be typed as an opaque `string`, NOT a closed union: only the value `'body'` is confirmed by the available contract, and inventing a closed enum from one confirmed value would reject valid upstream data. `path` is an array of integer source-tree indices. `end` is already an exclusive character offset on the wire (confirmed against captured `dial-document` responses — see the "Office range selector offsets are exclusive on the wire for DOCX/PPTX" requirement), unlike `TextCharacterRangeSelector.end`. No `storyInstance` field SHALL be declared, because the available contract does not demonstrate one.
- `PptxRangeSelector` — `{ type: 'pptx_text_range'; slide: number; shape_id: string; start: number; end: number; text: string }` — targets a character range inside one PPTX shape. `slide` is 1-based. `shape_id` SHALL be typed `string`, matching the wire shape. `end` is already exclusive on the wire, the same as `DocxRangeSelector.end`.
- `ExcelRcRangeSelector` — `{ type: 'excel_rc_range'; sheet: string; start: { row: number; col: number }; end?: { row: number; col: number } | null }` — targets one cell, or a contiguous range from `start` to `end`, on the sheet named `sheet`. `row` and `col` are 1-based. `end` SHALL be optional AND nullable, because the contract permits an explicit `null` for a single-cell selector. `end` here is a distinct concept from the DOCX/PPTX selectors' `end` — a 1-based cell address naming the range's last (inclusive) cell, not a character offset.
- `AnnotationSelector` — discriminated union of `TextCharacterRangeSelector`, `PdfBBoxSelector`, `HtmlTagSelector`, `DocxRangeSelector`, `PptxRangeSelector`, and `ExcelRcRangeSelector`; unknown selector shapes SHALL continue to be represented as `{ type: string; [key: string]: unknown }`. This open catch-all branch SHALL NOT be removed or narrowed — an unrecognised selector must keep parsing even though the three named members now cover the confirmed DOCX/PPTX/XLSX discriminators (see the "Office range selector discriminators are confirmed by a captured fixture" requirement).
- `AnnotationTarget` — `{ source?: unknown; selector?: AnnotationSelector }`
- `AttachmentResource` — `{ type: string; url: string }` (same shape as `MessageAttachment` but scoped to citations)
- `AnnotationSource` — `{ type: 'attachment'; attachment: AttachmentResource }`
- `AnnotationBody` — `{ title?: string; quote?: string; source?: AnnotationSource; selector?: AnnotationSelector | AnnotationSelector[]; configuration?: Record<string, unknown> }`
- `Annotation` — `{ index?: number; target?: AnnotationTarget; body?: AnnotationBody }`

Because `DocxRangeSelector.type` and `PptxRangeSelector.type` are declared as `string`, they SHALL NOT be used for control-flow narrowing. Every consumer SHALL narrow through an exported type-guard function instead of a `selector.type === '…'` comparison.

The `Message` interface in `libs/chat-shared/src/models/chat.ts` SHALL be extended so that `custom_content` includes an optional `annotations?: Annotation[]` field alongside the existing `attachments` field.

`Annotation.index` SHALL remain optional: an `html_tag`-selector annotation never carries an `index` (DIAL Core sends the whole annotation array in one late, non-incremental chunk, keyed only by tag `id`), and this SHALL NOT be treated as invalid.

All three new interfaces SHALL be exported from `libs/chat-shared/src/index.ts` as type exports, and documented in `libs/chat-shared/README.md`.

**State ownership**: none — type declarations only, no state.
**i18n**: no new user-visible strings in this requirement.
**RTL**: no directional impact — type definitions only.
**Feature flag**: none.
**Memoisation**: none — types only.
**Telemetry**: none.

#### Scenario: Annotation with all fields satisfies the interface

- **WHEN** an `Annotation` object is constructed with `index`, `target.selector` of type `text_character_range`, and `body` containing `title`, `quote`, and `source.attachment`
- **THEN** it satisfies the `Annotation` interface without TypeScript errors

#### Scenario: Annotation with missing body is valid

- **WHEN** an `Annotation` object is constructed with only an `index` field and no `body`
- **THEN** it satisfies the `Annotation` interface without TypeScript errors

#### Scenario: Message with annotations satisfies the Message interface

- **WHEN** a `Message` object is constructed with `custom_content.annotations` containing one `Annotation`
- **THEN** it satisfies the `Message` interface without TypeScript errors

#### Scenario: Message without annotations is still valid

- **WHEN** a `Message` object is constructed without `custom_content`
- **THEN** `message.custom_content` is `undefined` and the type is satisfied

#### Scenario: html_tag selector annotation with no index satisfies the interface

- **WHEN** an `Annotation` object is constructed with `target.selector = { type: 'html_tag', tag: 'cit', id: 'e43864' }`, no `index`, and `body.source = { type: 'attachment', attachment: { type: 'application/pdf', url: '...' } }`
- **THEN** it satisfies the `Annotation` interface without TypeScript errors

#### Scenario: DOCX range selector satisfies the union

- **WHEN** a `body.selector` is assigned `{ type: 'docx_text_range', story: 'body', path: [2, 0, 1], start: 12, end: 47, text: 'the cited sentence' }`
- **THEN** it satisfies `AnnotationSelector` without a TypeScript error, and `story` accepts any string value

#### Scenario: PPTX range selector satisfies the union

- **WHEN** a `body.selector` is assigned `{ type: 'pptx_text_range', slide: 3, shape_id: '7', start: 0, end: 14, text: 'Quarterly plan' }`
- **THEN** it satisfies `AnnotationSelector` without a TypeScript error, and `shape_id` is typed `string`

#### Scenario: Excel single-cell selector omits or nulls `end`

- **WHEN** a `body.selector` is assigned `{ type: 'excel_rc_range', sheet: 'Q3', start: { row: 14, col: 3 } }` and, separately, the same object with `end: null`
- **THEN** both satisfy `ExcelRcRangeSelector` without a TypeScript error

#### Scenario: An unrecognised selector type still parses

- **WHEN** a `body.selector` is assigned `{ type: 'some_future_selector', anything: 1 }`
- **THEN** it satisfies `AnnotationSelector` through the open catch-all branch, exactly as before this change

## ADDED Requirements

### Requirement: Office range selector offsets are exclusive on the wire for DOCX/PPTX

`TextCharacterRangeSelector` documents `start`/`end` as **inclusive** indices, and any implementation that computes text overlap with `String.prototype.slice` requires an **exclusive** upper bound. This is a real conflict between selector families, and it SHALL be resolved explicitly rather than silently.

Three real `dial-document` responses were captured (`libs/quotations/src/utils/tests/fixtures/office-selectors.json`) and confirm computationally, for every sample, that `end - start === text.length`. This means `DocxRangeSelector.end` and `PptxRangeSelector.end` are **already exclusive** on the wire — the opposite of `TextCharacterRangeSelector.end`, not an extension of it.

Normalisation SHALL copy the wire's `end` through **unchanged** into an internal field named `endExclusive`, exactly once, at the point a raw selector is validated into its internal form — a rename for clarity, not an arithmetic conversion. No downstream consumer — run-overlap arithmetic, `slice` call, or rectangle calculation — SHALL add or subtract 1 from it.

A selector SHALL be rejected as malformed when `start` or `end` is not an integer, when `start < 0`, or when `end < start`.

The existing `TextCharacterRangeSelector` JSDoc — which describes its own `end` as inclusive — SHALL be left as the normative statement for that selector, and the Office selectors' docs SHALL cross-reference it while stating their own, opposite convention, so a reader cannot conclude the two families agree.

`ExcelRcRangeSelector.end` is unaffected by this requirement: it is a 1-based cell address naming the range's last (inclusive) cell, not a character offset, and stays inclusive as originally designed.

**State ownership**: none — pure data transformation.
**i18n**: none.
**RTL**: none — data only.
**Feature flag**: none.
**Memoisation**: none.
**Telemetry**: none.

#### Scenario: A single-character range normalises with endExclusive equal to the wire's end

- **WHEN** a DOCX selector with `start: 5, end: 6` is normalised
- **THEN** the internal range is `endExclusive === 6`, and slicing the resolved text with `[5, 6)` yields exactly one character

#### Scenario: A range ending at the resolved text's length is not out of bounds

- **WHEN** a DOCX selector with `start: 0, end: 10` is normalised against resolved text of length 10
- **THEN** the internal range is `endExclusive === 10`, slicing `[0, 10)` yields the entire 10-character string, and the range is not treated as out of bounds

#### Scenario: A range whose end precedes its start is rejected

- **WHEN** a selector has `start: 8, end: 3`
- **THEN** normalisation returns no valid selector and the document opens without a highlight

#### Scenario: Non-integer offsets are rejected

- **WHEN** a selector has `start: 1.5` or `end: '4'`
- **THEN** normalisation returns no valid selector

### Requirement: Office range selector discriminators are confirmed by a captured fixture

Three real `dial-document` responses were captured (`libs/quotations/src/utils/tests/fixtures/office-selectors.json`), confirming the `type` discriminator strings for all three Office range selectors: `'docx_text_range'`, `'pptx_text_range'`, and `'excel_rc_range'`. None SHALL be matched by generic `_range`-suffix matching in the shipped contract.

The discriminator check SHALL be isolated in one named type guard per format — `isDocxRangeSelector`, `isPptxRangeSelector`, `isExcelRcRangeSelector` — each matching its confirmed literal `type` string and additionally requiring the full field set for that format, so a partially-shaped or unrelated `*_range` selector is rejected rather than mis-resolved.

**State ownership**: none.
**i18n**: none.
**RTL**: none.
**Feature flag**: none.
**Memoisation**: none.
**Telemetry**: none.

#### Scenario: Excel selector is matched by its confirmed literal

- **WHEN** a selector has `type: 'excel_rc_range'` with a valid `sheet` and `start`
- **THEN** `isExcelRcRangeSelector` returns `true`, and a selector with the same fields but a different `type` string returns `false`

#### Scenario: A `_range` selector missing required DOCX fields is rejected

- **WHEN** a selector has `type: 'docx_text_range'` but no `path`
- **THEN** `isDocxRangeSelector` returns `false`, and the annotation resolves to no highlight

#### Scenario: DOCX and PPTX selectors are told apart by their confirmed literals

- **WHEN** two selectors are supplied, one with `type: 'docx_text_range'` carrying `story` + `path` and one with `type: 'pptx_text_range'` carrying `slide` + `shape_id`
- **THEN** the first is identified as DOCX only and the second as PPTX only, with no selector matching both guards
