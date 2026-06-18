## Requirements

---

### Requirement: Annotation types defined in `libs/chat-shared`

`libs/chat-shared/src/models/annotation.ts` SHALL export the following TypeScript interfaces:

- `TextCharacterRangeSelector` — `{ type: 'text_character_range'; start: number; end: number }`
- `AnnotationSelector` — discriminated union starting with `TextCharacterRangeSelector`; unknown selector shapes SHALL be represented as `{ type: string; [key: string]: unknown }`
- `AnnotationTarget` — `{ source?: unknown; selector?: AnnotationSelector }`
- `AttachmentResource` — `{ type: string; url: string }` (same shape as `MessageAttachment` but scoped to citations)
- `AnnotationSource` — `{ type: 'attachment'; attachment: AttachmentResource }`
- `AnnotationBody` — `{ title?: string; quote?: string; source?: AnnotationSource; selector?: AnnotationSelector | AnnotationSelector[]; configuration?: Record<string, unknown> }`
- `Annotation` — `{ index?: number; target?: AnnotationTarget; body?: AnnotationBody }`

The `Message` interface in `libs/chat-shared/src/models/chat.ts` SHALL be extended so that `custom_content` includes an optional `annotations?: Annotation[]` field alongside the existing `attachments` field.

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

---

### Requirement: Annotation delta accumulation in `apply-chunk.ts`

`apps/chat/src/utils/apply-chunk.ts` SHALL accumulate streaming annotation deltas into `message.custom_content.annotations` using the same merge-by-index pattern used for stages:

- A `mergeAnnotations(existing: Annotation[], incoming: Annotation[]): Annotation[]` helper iterates over incoming annotations.
- If an incoming annotation's `index` matches an existing entry, the two are merged: `body.title` and `body.quote` are **concatenated** (partial streamed strings), all other fields are last-write-wins via object spread.
- If no match is found, the annotation is appended to the result array.
- When a chunk carries no annotations (`annotations` is absent or empty), the existing array is left unchanged.

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

---

### Requirement: Annotation filtering in `useAnnotations`

`apps/chat/src/hooks/annotations/useAnnotations.ts` SHALL export a `useAnnotations` hook that:

- Accepts a `message: Message` prop.
- Returns `annotations: Annotation[]` — the filtered annotation list derived from `message.custom_content?.annotations ?? []`.
- Skips annotations that have no `body.source.attachment.url`.
- Handles `undefined` or `null` annotation items gracefully (skips them without throwing).

**i18n**: none.
**RTL**: none — hook returns data only.
**Memoisation**: the returned `annotations` array SHALL be referentially stable when the input has not changed (use `useMemo`).

#### Scenario: Completed message returns annotations directly

- **WHEN** `useAnnotations` is called with a message containing two annotations
- **THEN** it returns the two `Annotation` objects immediately

#### Scenario: Annotations without source are excluded from the returned array

- **WHEN** the message contains two annotations, one with `body.source.attachment.url` and one without
- **THEN** only the annotation with a source URL is included in the returned array

#### Scenario: Undefined annotation items are skipped

- **WHEN** `message.custom_content.annotations` contains a `null` or `undefined` entry
- **THEN** `useAnnotations` returns without throwing and the nullish entry is absent from the result
