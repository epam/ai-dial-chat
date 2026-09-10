## Purpose

Pure server-side assembly of DIAL SSE chunks into a conversation message, mirroring the frontend chunk applier.

## Requirements

### Requirement: Server-side SSE chunk assembler

`applyChunkToMessage` (`apps/chat-api/src/conversations/utils/apply-chunk.server.ts`) SHALL merge a parsed DIAL SSE chunk into a `ConversationMessageDto`, mirroring the frontend `apply-chunk.ts`. It MUST be a pure function with no imports from `apps/chat`.

It SHALL handle: `delta.content` (string concatenation), `delta.custom_content.attachments` (accumulate), `delta.custom_content.stages` (merge by index, concatenate `name` and `content`), `delta.custom_content.annotations` (merge by `index` when both entries carry one, otherwise by `target.selector.id` when both are `html_tag`-selector annotations — never collapsing two distinct entries that both lack an `index` and are not matching `html_tag` ids; concatenate `body.title`/`body.quote` on a match), `delta.custom_fields.annotations` (raw wire-format annotations — normalized via `normalizeRawAnnotationsServer` against the accumulated attachment list, then merged into `custom_content.annotations` using the same rule, so a reload of the saved conversation still resolves citation pills), `delta.custom_content.form_schema` (replace, last wins), `delta.custom_content.state` (replace, last wins — the DIAL stateful-app contract only cares about the latest value), and `chunk.id` / `delta.responseId` (set the message response id).

`normalizeRawAnnotationsServer(raw: unknown[], attachments: MessageAttachment[]): AnnotationDto[]` is a server-local pure function (no shared import with `libs/quotations`) that recognizes both the attachment-index + `pdf_region` wire shape and the `html_tag` + flat `body.source.url` wire shape, mirroring `normalizeRawAnnotations` in `libs/quotations/src/utils/annotation.ts`. It is called with the union of the message's already-accumulated attachments and this chunk's incoming attachments, so an `attachment_index` reference can resolve even when the referenced attachment arrived in an earlier chunk.

For the `html_tag` shape, the server infers recognized document MIME types from the URL extension, including PDF, HTML/XHTML, DOCX, XLSX, and PPTX, and falls back to PDF only when the extension is not recognized.

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

#### Scenario: Raw XLSX html_tag citation is persisted with its spreadsheet MIME type

- **WHEN** a raw `html_tag` annotation's `body.source.url` ends in `.xlsx`
- **THEN** the persisted `body.source.attachment.type` is `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, not `application/pdf`

#### Scenario: Two html_tag annotations in the same raw chunk do not collapse

- **WHEN** `delta.custom_fields.annotations` carries two entries that both lack an `index` but have distinct `target.selector.id` values
- **THEN** the assembled message's `custom_content.annotations` contains two distinct entries, not one merged entry

#### Scenario: Legacy attachment_index raw annotations still normalize

- **WHEN** a chunk carries `delta.custom_fields.annotations` with an entry using `target.source.attachment_index` and a `pdf_region` selector, and the message's accumulated attachments include a matching entry at that index
- **THEN** the assembled message's `custom_content.annotations` contains one normalized entry with a `pdf_bbox` selector

#### Scenario: A later chunk's annotation merges into the earlier one by cit id

- **WHEN** the assembled message already has a `custom_content.annotations` entry with `target.selector.id: "e43864"` and `body.quote: "Patient"`, and a later chunk's `delta.custom_fields.annotations` carries an entry with the same `id` and `body.quote: " meets criteria"`
- **THEN** the merged entry has `body.quote: "Patient meets criteria"` and there is still exactly one entry for that `id`

### Requirement: PDF citation selectors survive server assembly and serialization

The server SHALL preserve optional `body.selector` and supplied annotation indexes when normalizing raw `html_tag` citations. Quote-only updates SHALL preserve prior selector data. Legacy `pdf_region` normalization SHALL place its PDF location in `body.selector`, consistent with the frontend. The conversation message DTO and generated OpenAPI client SHALL support object-or-array body selectors and nested validation without adding an endpoint or changing authorization.

#### Scenario: Streamed PDF citation followed by a quote-only delta

- **WHEN** an indexed citation with page 3 in its body selector is assembled and later receives a quote-only delta for that index
- **THEN** serialization and reload retain page 3, the index and the html-tag marker target

#### Scenario: Validated message carries an object or array selector

- **WHEN** a conversation message passes through the production-style transforming, whitelisting validation pipe with either selector shape
- **THEN** the PDF location survives serialization; a string-valued nested page fails numeric validation

### Requirement: Office citation selectors survive request validation and serialization

Office range selectors SHALL survive the backend's validation pipeline and appear in the generated OpenAPI client, so a citation's document location reaches the frontend instead of being discarded.

`AnnotationSelectorDto` (`apps/chat-api/src/conversations/dto/annotation.dto.ts`) is currently a **closed field allowlist** — `type`, `start`, `end`, `page`, `x1`, `y1`, `x2`, `y2`, `tag`, `id` — and `apps/chat-api/src/main.ts` installs `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`. An annotation carrying `story`, `path`, `slide`, `shape_id`, or `sheet` therefore has those fields **stripped**, or — on the conversation-save request path — causes the entire save to be **rejected with 400**. This is a DTO gap; it SHALL NOT be addressed by adding an endpoint.

`AnnotationSelectorDto` SHALL be widened with the Office selector fields, each optional and each validated:

- `story?: string`
- `path?: number[]` — validated as an array of integers
- `slide?: number`
- `shape_id?: string`
- `sheet?: string`
- `text?: string` — the cited text, compared against the resolved range for DOCX/PPTX
- `start` and `end` — currently `@IsNumber()`, and SHALL be widened to also accept the nested `{ row: number; col: number }` address shape used by `excel_rc_range`, while continuing to accept a number for the existing character-range and Office text-range selectors. `end` SHALL additionally accept `null`, which the contract uses for a single-cell range.

The DTO SHALL remain an **open shape** — `type` plus every known optional field — rather than becoming a discriminated union, matching the comment already on the class and mirroring `AnnotationSelector` in `chat-shared`. Widening only ever accepts more input than before, so payloads that validate today continue to validate.

Every added field SHALL carry `@ApiPropertyOptional` metadata so it appears in `libs/chat-api-client/openapi.json` with a strong type, and the client SHALL be regenerated and rebuilt.

Server-side normalization in `apps/chat-api/src/conversations/utils/apply-chunk-annotations.server.ts` requires no change to preserve these selectors: `normalizeBodySelector` retains any selector object with a string `type`, so an Office selector already passes through streaming assembly untouched. This SHALL be verified by test rather than assumed.

**Endpoint impact**: none. No new route, no changed HTTP method, path, status code, authorization, rate limit, or cache behaviour. The affected requests are the existing conversation create/save and fetch operations under `/api/v1/conversations`.
**Generated-client impact**: no new `operationId` and no new SDK method. The regenerated `AnnotationSelectorDto` model gains the optional fields; existing frontend callers are unchanged and continue to use the same generated methods.
**Rate limiting**: unchanged — no new endpoint, so no new `@Throttle`.
**Cache**: unchanged — annotations are not separately cached.
**i18n**: none — backend DTO.
**RTL**: none — backend DTO.
**Feature flag**: none.
**Telemetry**: none.

#### Scenario: A DOCX selector survives the production-style validation pipe

- **WHEN** a conversation message carrying a selector with `story`, `path`, `start`, `end`, and `text` passes through the transforming, whitelisting, `forbidNonWhitelisted` validation pipe
- **THEN** the request is accepted and all Office selector fields are present after validation

#### Scenario: A PPTX selector survives validation

- **WHEN** a message carries a selector with `slide` and `shape_id`
- **THEN** the request is accepted and both fields survive serialization and reload

#### Scenario: An Excel selector's nested addresses survive validation

- **WHEN** a message carries `{ type: 'excel_rc_range', sheet: 'Q3', start: { row: 14, col: 3 }, end: { row: 14, col: 6 } }`
- **THEN** the request is accepted and both nested addresses survive serialization and reload

#### Scenario: An Excel selector with a null end is accepted

- **WHEN** a message carries an `excel_rc_range` selector with `end: null`
- **THEN** the request is accepted and `end` is preserved as `null` rather than rejected

#### Scenario: Office selectors pass through streaming assembly

- **WHEN** a raw streamed `html_tag` citation carries an Office selector in `body.selector`
- **THEN** `normalizeRawAnnotationsServer` retains that selector unchanged in the assembled annotation

#### Scenario: Existing PDF and character-range selectors still validate

- **WHEN** a message carries a `pdf_bbox` selector with numeric coordinates, or a `text_character_range` selector with numeric `start`/`end`
- **THEN** validation behaves exactly as before this change, including rejecting a string-valued nested `page`

#### Scenario: Office selector fields appear in the generated client

- **WHEN** `npm run openapi` and `npm run openapi:check` run after the DTO change
- **THEN** `libs/chat-api-client/openapi.json` contains the new optional fields on the annotation selector schema and the check passes
