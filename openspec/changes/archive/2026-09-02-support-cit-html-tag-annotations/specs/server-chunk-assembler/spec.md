## MODIFIED Requirements

### Requirement: Server-side SSE chunk assembler

`applyChunkToMessage` (`apps/chat-api/src/conversations/utils/apply-chunk.server.ts`) SHALL merge a parsed DIAL SSE chunk into a `ConversationMessageDto`, mirroring the frontend `apply-chunk.ts`. It MUST be a pure function with no imports from `apps/chat`.

It SHALL handle: `delta.content` (string concatenation), `delta.custom_content.attachments` (accumulate), `delta.custom_content.stages` (merge by index, concatenate `name` and `content`), `delta.custom_content.annotations` (merge by `index` when both entries carry one, otherwise by `target.selector.id` when both are `html_tag`-selector annotations — never collapsing two distinct entries that both lack an `index` and are not matching `html_tag` ids; concatenate `body.title`/`body.quote` on a match), `delta.custom_fields.annotations` (raw wire-format annotations — normalized via `normalizeRawAnnotationsServer` against the accumulated attachment list, then merged into `custom_content.annotations` using the same rule, so a reload of the saved conversation still resolves citation pills), `delta.custom_content.form_schema` (replace, last wins), `delta.custom_content.state` (replace, last wins — the DIAL stateful-app contract only cares about the latest value), and `chunk.id` / `delta.responseId` (set the message response id).

`normalizeRawAnnotationsServer(raw: unknown[], attachments: MessageAttachment[]): AnnotationDto[]` is a server-local pure function (no shared import with `libs/quotations`) that recognizes both the attachment-index + `pdf_region` wire shape and the `html_tag` + flat `body.source.url` wire shape, mirroring `normalizeRawAnnotations` in `libs/quotations/src/utils/annotation.ts`. It is called with the union of the message's already-accumulated attachments and this chunk's incoming attachments, so an `attachment_index` reference can resolve even when the referenced attachment arrived in an earlier chunk.

#### Scenario: Text deltas concatenate

- **WHEN** successive chunks carry `delta.content` fragments
- **THEN** the assembled message content is their in-order concatenation

#### Scenario: Stages merge by index

- **WHEN** chunks carry `delta.custom_content.stages` entries sharing an index
- **THEN** their `name` and `content` are concatenated within that stage

#### Scenario: form_schema replaced last-wins

- **WHEN** multiple chunks carry `delta.custom_content.form_schema`
- **THEN** the assembled message keeps the last one

#### Scenario: state replaced last-wins

- **WHEN** multiple chunks carry `delta.custom_content.state`
- **THEN** the assembled message keeps the last one, not a merge of all values

#### Scenario: Raw custom_fields annotations are normalized and persisted

- **WHEN** a chunk carries `delta.custom_fields.annotations` with two `html_tag`-selector entries (ids `"e43864"` and `"e52dc2"`), each with a flat `body.source.url`, and no `delta.custom_content.annotations`
- **THEN** the assembled message's `custom_content.annotations` contains two normalized `Annotation` entries, one per `id`, each with `body.source.attachment.url` set from the raw entry's `body.source.url`

#### Scenario: Two html_tag annotations in the same raw chunk do not collapse

- **WHEN** `delta.custom_fields.annotations` carries two entries that both lack an `index` but have distinct `target.selector.id` values
- **THEN** the assembled message's `custom_content.annotations` contains two distinct entries, not one merged entry

#### Scenario: Legacy attachment_index raw annotations still normalize

- **WHEN** a chunk carries `delta.custom_fields.annotations` with an entry using `target.source.attachment_index` and a `pdf_region` selector, and the message's accumulated attachments include a matching entry at that index
- **THEN** the assembled message's `custom_content.annotations` contains one normalized entry with a `pdf_bbox` selector

#### Scenario: A later chunk's annotation merges into the earlier one by cit id

- **WHEN** the assembled message already has a `custom_content.annotations` entry with `target.selector.id: "e43864"` and `body.quote: "Patient"`, and a later chunk's `delta.custom_fields.annotations` carries an entry with the same `id` and `body.quote: " meets criteria"`
- **THEN** the merged entry has `body.quote: "Patient meets criteria"` and there is still exactly one entry for that `id`
