# message-annotations Specification

## Purpose

Annotation types, delta accumulation during streaming, and the filtering `useAnnotations` applies.

## Requirements

---

### Requirement: Annotation types defined in `libs/chat-shared`

`libs/chat-shared/src/models/annotation.ts` SHALL export the following TypeScript interfaces:

- `TextCharacterRangeSelector` — `{ type: 'text_character_range'; start: number; end: number }`
- `HtmlTagSelector` — `{ type: 'html_tag'; tag: string; id: string }` — targets the supported paired inline element `<cit data-id="e43864"></cit>` inside the accumulated message text by its `data-id` attribute.
- `DocxRangeSelector` — `{ type: 'docx_text_range'; story: string; path: number[]; start: number; end: number; text: string }` — targets a character range inside a DOCX story. `story` SHALL be typed as an opaque `string`, NOT a closed union: only the value `'body'` is confirmed by the available contract, and inventing a closed enum from one confirmed value would reject valid upstream data. `path` is an array of integer source-tree indices. `end` is already an exclusive character offset on the wire (confirmed against captured `dial-document` responses — see the "Office range selector offsets are exclusive on the wire for DOCX/PPTX" requirement), unlike `TextCharacterRangeSelector.end`. No `storyInstance` field SHALL be declared, because the available contract does not demonstrate one.
- `PptxRangeSelector` — `{ type: 'pptx_text_range'; slide: number; shape_id: string; start: number; end: number; text: string }` — targets a character range inside one PPTX shape. `slide` is 1-based. `shape_id` SHALL be typed `string`, matching the wire shape. `end` is already exclusive on the wire, the same as `DocxRangeSelector.end`.
- `ExcelRcRangeSelector` — `{ type: 'excel_rc_range'; sheet: string; start: { row: number; col: number }; end?: { row: number; col: number } | null }` — targets one cell, or a contiguous range from `start` to `end`, on the sheet named `sheet`. `row` and `col` are 1-based. `end` SHALL be optional AND nullable, because the contract permits an explicit `null` for a single-cell selector. `end` here is a distinct concept from the DOCX/PPTX selectors' `end` — a 1-based cell address naming the range's last (inclusive) cell, not a character offset.
- `AnnotationSelector` — discriminated union of `TextCharacterRangeSelector`, `PdfBBoxSelector`, `HtmlTagSelector`, `DocxRangeSelector`, `PptxRangeSelector`, and `ExcelRcRangeSelector`; unknown selector shapes SHALL be represented as `{ type: string; [key: string]: unknown }`. This open catch-all branch SHALL NOT be removed or narrowed — an unrecognised selector must keep parsing even though the three named members now cover the confirmed DOCX/PPTX/XLSX discriminators (see the "Office range selector discriminators are confirmed by a captured fixture" requirement).
- `AnnotationTarget` — `{ source?: unknown; selector?: AnnotationSelector }`
- `AttachmentResource` — `{ type: string; url: string }` (same shape as `MessageAttachment` but scoped to citations)
- `AnnotationSource` — `{ type: 'attachment'; attachment: AttachmentResource }`
- `AnnotationBody` — `{ title?: string; quote?: string; source?: AnnotationSource; selector?: AnnotationSelector | AnnotationSelector[]; configuration?: Record<string, unknown> }`
- `Annotation` — `{ index?: number; target?: AnnotationTarget; body?: AnnotationBody }`

Because `DocxRangeSelector.type` and `PptxRangeSelector.type` are declared as string literals, they SHALL NOT be used for control-flow narrowing on a `string`-typed intermediate. Every consumer SHALL narrow through an exported type-guard function instead of an ad hoc `selector.type === '…'` comparison.

The `Message` interface in `libs/chat-shared/src/models/chat.ts` SHALL be extended so that `custom_content` includes an optional `annotations?: Annotation[]` field alongside the existing `attachments` field.

`Annotation.index` SHALL remain optional: an `html_tag`-selector annotation never carries an `index` (DIAL Core sends the whole annotation array in one late, non-incremental chunk, keyed only by tag `id`), and this SHALL NOT be treated as invalid.

All three new interfaces SHALL be exported from `libs/chat-shared/src/index.ts` as type exports, and documented in `libs/chat-shared/README.md`.

**i18n**: no new user-visible strings in this requirement.
**RTL**: no directional impact — type definitions only.
**Feature flag**: none.

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

---

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

---

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

---

### Requirement: Annotation delta accumulation in `apply-chunk.ts`

`libs/chat-hooks/src/conversation/useConversationStream/apply-chunk.ts` SHALL accumulate streaming annotation deltas into `message.custom_content.annotations` using a merge helper that matches on `index` when both the existing and incoming annotation carry one, and otherwise on `target.selector.id` when both are `html_tag`-selector annotations:

- A `mergeAnnotations(existing: Annotation[], incoming: Annotation[]): Annotation[]` helper iterates over incoming annotations.
- Two annotations are considered "the same" when: both have a defined `index` and those indices are equal; OR both lack an `index`, both have `target.selector.type === 'html_tag'`, and their `target.selector.id` values are equal.
- When a match is found, the two are merged: `body.title` and `body.quote` are **concatenated** (partial streamed strings), all other fields are last-write-wins via object spread.
- When no match is found, the annotation is appended to the result array. Two annotations that both lack an `index` and are not both matching `html_tag` ids are never considered the same and are always appended as separate entries — this prevents distinct `html_tag` annotations (which never carry an `index`) from collapsing into one on the first index-only match.
- When a chunk carries no annotations (`annotations` is absent or empty), the existing array is left unchanged.

Raw wire-format annotations arriving via `delta.custom_fields.annotations` are normalized first (see the "Dual-shape wire normalization" requirement below) and the normalized results are merged using the same helper as `delta.custom_content.annotations`.

**i18n**: none.
**RTL**: none — utility only.

#### Scenario: First annotation chunk creates a new entry

- **WHEN** `applyChunkToMessages` receives a chunk with one annotation (`index: 0, body.quote: "Q3 rev"`) and the message has no existing annotations
- **THEN** `message.custom_content.annotations` contains exactly that one annotation

#### Scenario: Second chunk for the same index concatenates body fields

- **WHEN** a second chunk arrives with `index: 0, body.quote: "enue was 1B$"` and the message already has `index: 0, body.quote: "Q3 rev"`
- **THEN** the merged annotation has `body.quote: "Q3 revenue was 1B$"`

#### Scenario: Chunks for different indices produce separate entries

- **WHEN** two chunks arrive, one with `index: 0` and one with `index: 1`
- **THEN** `message.custom_content.annotations` contains two distinct annotation objects

#### Scenario: Chunk with no annotations leaves the array unchanged

- **WHEN** a chunk carries no `custom_content.annotations`
- **THEN** the existing annotations array is returned as-is

#### Scenario: Two html_tag annotations with no index do not collapse

- **WHEN** a chunk's normalized `custom_fields.annotations` carries two `html_tag`-selector annotations with `target.selector.id` values `"e43864"` and `"e52dc2"`, neither carrying an `index`
- **THEN** `message.custom_content.annotations` contains two distinct entries, one per `id`

#### Scenario: A later chunk for the same cit id merges into the existing entry

- **WHEN** the message already has an `html_tag` annotation with `target.selector.id: "e43864"` and `body.quote: "Patient meets"`, and an incoming annotation with the same `id` and `body.quote: " ALL criteria"` arrives
- **THEN** the merged annotation has `body.quote: "Patient meets ALL criteria"` and there is still exactly one entry for that `id`

---

### Requirement: Annotation filtering in `useAnnotations`

`libs/quotations/src/utils/useAnnotations.ts` SHALL export a `useAnnotations` hook that:

- Accepts a `message: Message` and an `isStreaming: boolean` argument.
- When `isStreaming` is `false`, returns the full annotation list resolved via `resolveMessageAnnotations(message)` (which prefers `message.custom_content.annotations` and falls back to normalizing `message.custom_fields.annotations`).
- When `isStreaming` is `true`, returns `[]` unconditionally — every selector family, including `html_tag`, is suppressed until the message finishes streaming. (An earlier revision of this requirement let `html_tag` annotations through mid-stream; that carve-out was reverted because a `<cit>` tag split across an SSE chunk boundary can cause the HTML parser to swallow subsequently-streamed text as the tag's content — see the `citation-marker` capability's "Citation markers injected into rendered assistant message text" requirement.)
- Skips annotations that have no `body.source.attachment.url`.
- Handles `undefined` or `null` annotation items gracefully (skips them without throwing).

**i18n**: none.
**RTL**: none — hook returns data only.
**Memoisation**: the returned `annotations` array SHALL be referentially stable when the inputs have not changed (use `useMemo` keyed on `[isStreaming, message]`).

#### Scenario: Completed message returns annotations directly

- **WHEN** `useAnnotations` is called with `isStreaming: false` and a message containing two annotations
- **THEN** it returns the two `Annotation` objects immediately

#### Scenario: Annotations without source are excluded from the returned array

- **WHEN** the message contains two annotations, one with `body.source.attachment.url` and one without
- **THEN** only the annotation with a source URL is included in the returned array

#### Scenario: Undefined annotation items are skipped

- **WHEN** `message.custom_content.annotations` contains a `null` or `undefined` entry
- **THEN** `useAnnotations` returns without throwing and the nullish entry is absent from the result

#### Scenario: Streaming suppresses every selector family, including html_tag

- **WHEN** `useAnnotations` is called with `isStreaming: true` and the message's resolved annotations contain one `text_character_range` annotation and one `html_tag` annotation
- **THEN** it returns `[]`

---

### Requirement: Dual-shape wire normalization in `normalizeRawAnnotations`

`libs/quotations/src/utils/annotation.ts` SHALL export `normalizeRawAnnotations(rawAnnotations: unknown[], attachments: MessageAttachment[]): Annotation[]` that recognizes two raw wire shapes and normalizes both into the same internal `Annotation` shape:

- **Attachment-index shape** (unchanged): `target.source.attachment_index` (number) resolved against `attachments`, with `target.selector.type === 'pdf_region'` (`{ page, bbox: { left, top, width, height } }`) converted to `PdfBBoxSelector`.
- **html_tag shape**: `target.selector.type === 'html_tag'` with `target.selector.tag` and `target.selector.id` both strings, and `body.source` present as a flat `{ type: 'attachment', url: string }` (no `attachment_index` lookup, no `pdf_region`). Normalized to `body.source.attachment = { type: <inferred from the recognized URL extension, including DOCX/XLSX/PPTX, or defaulted to PDF>, url, title: body.title }`; `target.selector` is preserved as the `html_tag` selector; `index` is left `undefined`. When already-normalized `custom_content.annotations` are loaded, `resolveMessageAnnotations` also reconciles an `html_tag` attachment's stored type with any recognized URL extension so conversations persisted by the older all-PDF fallback remain previewable.

A raw entry that matches neither shape (no resolvable attachment index and no `html_tag` selector with a flat `body.source.url`) is omitted from the result, same as today.

**i18n**: none.
**RTL**: none — pure data transformation.

#### Scenario: html_tag entry with flat body.source.url normalizes correctly

- **WHEN** `normalizeRawAnnotations` receives one raw entry with `target.selector = { type: 'html_tag', tag: 'cit', id: 'e43864' }` and `body = { title: 'MT_14dayTrialNote (2).pdf', quote: 'Patient meets ALL criteria', source: { type: 'attachment', url: 'files/.../MT_14dayTrialNote%20(2).pdf' } }`
- **THEN** the result contains one `Annotation` with `target.selector.id === 'e43864'`, `body.source.attachment.url === 'files/.../MT_14dayTrialNote%20(2).pdf'`, `body.source.attachment.title === 'MT_14dayTrialNote (2).pdf'`, `body.title === 'MT_14dayTrialNote (2).pdf'`, and `index === undefined`

#### Scenario: Two html_tag entries citing the same URL normalize to two separate annotations

- **WHEN** `normalizeRawAnnotations` receives two raw `html_tag` entries with different `target.selector.id` values but the same `body.source.url`
- **THEN** the result contains two `Annotation` objects, one per `id`, both with the same `body.source.attachment.url`

#### Scenario: XLSX html_tag source is not normalized as PDF

- **WHEN** an `html_tag` annotation references `files/.../budget.xlsx`
- **THEN** its normalized `body.source.attachment.type` is `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- **AND** the same correction is applied when a persisted internal annotation carries `application/pdf` for that `.xlsx` URL

#### Scenario: attachment_index shape still normalizes unchanged

- **WHEN** `normalizeRawAnnotations` receives a raw entry with `target.source.attachment_index: 0` and `target.selector.type: 'pdf_region'`, and `attachments` contains a matching entry at index 0
- **THEN** the result contains one `Annotation` with a `pdf_bbox` selector and `body.source.attachment.url` resolved from the matching attachment

#### Scenario: Entry matching neither shape is dropped

- **WHEN** a raw entry has neither a resolvable `attachment_index` nor an `html_tag` selector with `body.source.url`
- **THEN** the entry is omitted from the result

---

### Requirement: HTML citation normalization preserves PDF document locations

Raw `html_tag` normalization SHALL retain an optional supplied annotation index and `body.selector` in object or array form, independently of the `target.selector` that identifies the inline `<cit>` marker. A later quote-only delta SHALL NOT erase the existing body selector. This is an additive PDF-navigation contract; non-PDF routing remains unchanged.

#### Scenario: Raw PDF citation with zero-area coordinates

- **WHEN** an indexed raw citation has an html-tag target and a `pdf_bbox` body selector with page 3 and all-zero coordinates
- **THEN** its normalized annotation retains the index, marker target and document selector and can resolve navigation page 3

#### Scenario: Array body selectors

- **WHEN** a raw citation supplies a body selector array with PDF locations
- **THEN** normalization retains the valid selector objects as an array
</content>
