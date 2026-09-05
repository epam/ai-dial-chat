## MODIFIED Requirements

### Requirement: Annotation types defined in `libs/chat-shared`

`libs/chat-shared/src/models/annotation.ts` SHALL export the following TypeScript interfaces:

- `TextCharacterRangeSelector` — `{ type: 'text_character_range'; start: number; end: number }`
- `HtmlTagSelector` — `{ type: 'html_tag'; tag: string; id: string }` — targets a void inline tag (e.g. `<cit id="e43864">`) inside the accumulated message text by its `id` attribute.
- `AnnotationSelector` — discriminated union of `TextCharacterRangeSelector`, `PdfBBoxSelector`, and `HtmlTagSelector`; unknown selector shapes SHALL be represented as `{ type: string; [key: string]: unknown }`
- `AnnotationTarget` — `{ source?: unknown; selector?: AnnotationSelector }`
- `AttachmentResource` — `{ type: string; url: string }` (same shape as `MessageAttachment` but scoped to citations)
- `AnnotationSource` — `{ type: 'attachment'; attachment: AttachmentResource }`
- `AnnotationBody` — `{ title?: string; quote?: string; source?: AnnotationSource; selector?: AnnotationSelector | AnnotationSelector[]; configuration?: Record<string, unknown> }`
- `Annotation` — `{ index?: number; target?: AnnotationTarget; body?: AnnotationBody }`

The `Message` interface in `libs/chat-shared/src/models/chat.ts` SHALL be extended so that `custom_content` includes an optional `annotations?: Annotation[]` field alongside the existing `attachments` field.

`Annotation.index` SHALL remain optional: an `html_tag`-selector annotation never carries an `index` (DIAL Core sends the whole annotation array in one late, non-incremental chunk, keyed only by tag `id`), and this SHALL NOT be treated as invalid.

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
- When `isStreaming` is `true`, returns only the subset of `resolveMessageAnnotations(message)` whose `target?.selector?.type === 'html_tag'` — every other selector type (`text_character_range`, `pdf_bbox`, unknown) is suppressed while streaming, unchanged from prior behavior. This lets a `cit`-tag citation's pill appear as soon as its annotation resolves, mid-stream, while the offset-based citation family keeps rendering nothing until the message finishes.
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

#### Scenario: Streaming suppresses non-html_tag annotations

- **WHEN** `useAnnotations` is called with `isStreaming: true` and the message's resolved annotations contain one `text_character_range` annotation and one `html_tag` annotation
- **THEN** it returns only the `html_tag` annotation

#### Scenario: Streaming with no html_tag annotations returns empty

- **WHEN** `useAnnotations` is called with `isStreaming: true` and the message's resolved annotations contain only `text_character_range` annotations
- **THEN** it returns `[]`

## ADDED Requirements

### Requirement: Dual-shape wire normalization in `normalizeRawAnnotations`

`libs/quotations/src/utils/annotation.ts` SHALL export `normalizeRawAnnotations(rawAnnotations: unknown[], attachments: MessageAttachment[]): Annotation[]` that recognizes two raw wire shapes and normalizes both into the same internal `Annotation` shape:

- **Attachment-index shape** (unchanged): `target.source.attachment_index` (number) resolved against `attachments`, with `target.selector.type === 'pdf_region'` (`{ page, bbox: { left, top, width, height } }`) converted to `PdfBBoxSelector`.
- **html_tag shape**: `target.selector.type === 'html_tag'` with `target.selector.tag` and `target.selector.id` both strings, and `body.source` present as a flat `{ type: 'attachment', url: string }` (no `attachment_index` lookup, no `pdf_region`). Normalized to `body.source.attachment = { type: <guessed from url or defaulted>, url, title: body.title }`; `target.selector` is preserved as the `html_tag` selector; `index` is left `undefined`.

A raw entry that matches neither shape (no resolvable attachment index and no `html_tag` selector with a flat `body.source.url`) is omitted from the result, same as today.

**i18n**: none.
**RTL**: none — pure data transformation.

#### Scenario: html_tag entry with flat body.source.url normalizes correctly

- **WHEN** `normalizeRawAnnotations` receives one raw entry with `target.selector = { type: 'html_tag', tag: 'cit', id: 'e43864' }` and `body = { title: 'MT_14dayTrialNote (2).pdf', quote: 'Patient meets ALL criteria', source: { type: 'attachment', url: 'files/.../MT_14dayTrialNote%20(2).pdf' } }`
- **THEN** the result contains one `Annotation` with `target.selector.id === 'e43864'`, `body.source.attachment.url === 'files/.../MT_14dayTrialNote%20(2).pdf'`, `body.source.attachment.title === 'MT_14dayTrialNote (2).pdf'`, `body.title === 'MT_14dayTrialNote (2).pdf'`, and `index === undefined`

#### Scenario: Two html_tag entries citing the same URL normalize to two separate annotations

- **WHEN** `normalizeRawAnnotations` receives two raw `html_tag` entries with different `target.selector.id` values but the same `body.source.url`
- **THEN** the result contains two `Annotation` objects, one per `id`, both with the same `body.source.attachment.url`

#### Scenario: attachment_index shape still normalizes unchanged

- **WHEN** `normalizeRawAnnotations` receives a raw entry with `target.source.attachment_index: 0` and `target.selector.type: 'pdf_region'`, and `attachments` contains a matching entry at index 0
- **THEN** the result contains one `Annotation` with a `pdf_bbox` selector and `body.source.attachment.url` resolved from the matching attachment

#### Scenario: Entry matching neither shape is dropped

- **WHEN** a raw entry has neither a resolvable `attachment_index` nor an `html_tag` selector with `body.source.url`
- **THEN** the entry is omitted from the result
