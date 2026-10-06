## Purpose

Pure server-side assembly of DIAL SSE chunks into a conversation message, mirroring the frontend chunk applier.

## Requirements

### Requirement: Server-side SSE chunk assembler

`applyChunkToMessage` (`apps/chat-api/src/conversations/utils/apply-chunk.server.ts`) SHALL merge a parsed DIAL SSE chunk into a `ConversationMessageDto`, mirroring the frontend `apply-chunk.ts` (`libs/chat-hooks/src/conversation/useConversationStream/apply-chunk.ts`). It MUST be a pure function with no imports from `apps/chat`.

It SHALL handle: `delta.content` (string concatenation), `delta.custom_content.attachments` (accumulate), `delta.custom_content.stages` (merge by index, concatenate `name` and `content`), `delta.custom_content.annotations` (merge by `index` when both entries carry one, otherwise by `target.selector.id` when both are `html_tag`-selector annotations — never collapsing two distinct entries that both lack an `index` and are not matching `html_tag` ids; concatenate `body.title`/`body.quote` on a match), `delta.custom_fields.annotations` (raw wire-format annotations — normalized via `normalizeRawAnnotationsServer` against the accumulated attachment list, then merged into `custom_content.annotations` using the same rule, so a reload of the saved conversation still resolves citation pills), `delta.custom_content.form_schema` (replace, last wins), `delta.custom_content.state` (replace, last wins — the DIAL stateful-app contract only cares about the latest value), and `chunk.id` / `delta.responseId` (set the message response id).

`normalizeRawAnnotationsServer(raw: unknown[], attachments: AttachmentDto[]): AnnotationDto[]` (`apps/chat-api/src/conversations/utils/apply-chunk-annotations.server.ts`, alongside `mergeAnnotations`; stage merging lives in `apply-chunk-stages.server.ts`) is a server-local pure function (no shared import with `libs/chat-shared` or `libs/quotations`) that recognizes both the attachment-index + `pdf_region` wire shape and the `html_tag` + flat `body.source.url` wire shape, mirroring `normalizeRawAnnotations` in `libs/chat-shared/src/utils/annotation.ts` (consumed by the frontend `apply-chunk.ts` and by `libs/quotations/src/utils/annotation.ts`). It is called with the union of the message's already-accumulated attachments and this chunk's incoming attachments, so an `attachment_index` reference can resolve even when the referenced attachment arrived in an earlier chunk.

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

`apps/chat-api/src/main.ts` installs `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`, so any selector field missing from `AnnotationSelectorDto` (`apps/chat-api/src/conversations/dto/annotation.dto.ts`) would be stripped or would reject the save with 400. The Office fields are therefore declared on the DTO itself; this SHALL NOT be addressed by adding an endpoint.

`AnnotationSelectorDto` SHALL declare, besides `type`, `page`, `x1`, `y1`, `x2`, `y2`, `tag` and `id`, the Office selector fields, each optional and each validated:

- `story?: string`
- `path?: number[]` — validated as an array of integers (`@IsArray()` + `@IsInt({ each: true })`)
- `slide?: number` — validated as an integer
- `shape_id?: string`
- `sheet?: string`
- `text?: string` — the cited text, compared against the resolved range for DOCX/PPTX
- `start?: number | CellAddressDto` and `end?: number | CellAddressDto | null` — validated by the custom `IsNumberOrCellAddress` constraint (with `@Type(() => CellAddressDto)`), which accepts a number for the character-range and Office text-range selectors or a nested `CellAddressDto` (`{ row?: number; col?: number }`, integers, re-validated with whitelist/`forbidNonWhitelisted`) for `excel_rc_range`. `end` additionally accepts `null` (via `@IsOptional()`), which the contract uses for a single-cell range.

The DTO SHALL remain an **open shape** — `type` plus every known optional field — rather than becoming a discriminated union, matching the comment on the class and mirroring `AnnotationSelector` in `chat-shared`. The Office fields only ever accept more input than the earlier PDF/character-range allowlist, so those payloads continue to validate.

Every Office field SHALL carry `@ApiPropertyOptional` metadata (`start`/`end` as a `oneOf` of `number` and a `CellAddressDto` `$ref`, registered via `@ApiExtraModels(CellAddressDto)`) so it appears in `libs/chat-api-client/openapi.json` with a strong type in the generated client.

Server-side normalization in `apps/chat-api/src/conversations/utils/apply-chunk-annotations.server.ts` preserves these selectors: `normalizeBodySelector` retains any selector object with a string `type`, so an Office selector passes through streaming assembly untouched. This SHALL be verified by test (`apply-chunk-annotations.server.spec.ts`) rather than assumed.

**Endpoint impact**: none. No new route, no changed HTTP method, path, status code, authorization, rate limit, or cache behaviour. The affected requests are the existing conversation create/save and fetch operations under `/api/v1/conversations`.
**Generated-client impact**: no new `operationId` and no new SDK method. The generated `AnnotationSelectorDto` model carries the optional fields; existing frontend callers are unchanged and continue to use the same generated methods.
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

- **WHEN** `npm run openapi` and `npm run openapi:check` run against the current DTO
- **THEN** `libs/chat-api-client/openapi.json` contains the new optional fields on the annotation selector schema and the check passes

### Requirement: Stage parent references survive assembly and persistence

The server stage assembler SHALL retain optional `parent_stage_index` on a stage-opening delta and preserve it when subsequent deltas for that stage omit it. Zero SHALL be a valid reference. It SHALL merge stages by their explicit streaming index, preserve the flat representation and existing text/attachment/status behavior, and keep child updates independent of parent status. The existing backend generation service SHALL persist this metadata with the assistant message; completed-message fetch and generation replay SHALL retain the same relationship. No alternate nested persistence representation or stage-specific cache SHALL be introduced.

#### Scenario: Opening-only parent metadata survives later deltas

- **WHEN** a stream opens parent 0 and child 1 with `parent_stage_index: 0`, then sends child content and completion deltas without parent metadata
- **THEN** the assembled child still references parent 0 and contains the concatenated content and explicit final status
- **AND** the parent's status changes only in response to its own delta

#### Scenario: Sparse indexes survive a saved conversation

- **WHEN** a generation with parent 4 and children 7 and 9 referencing 4 completes and the conversation is fetched again
- **THEN** the persisted stages retain those explicit indexes and both parent references
- **AND** frontend normalization does not reinterpret 4 as an array offset

#### Scenario: Flat legacy input remains compatible

- **WHEN** a stream has no `parent_stage_index` on any stage
- **THEN** assembly and persistence retain the existing flat payload without adding synthetic parent metadata

### Requirement: Conversation stage DTOs expose optional parent references

`StageDto` SHALL expose `parent_stage_index?: number` in Swagger as an optional integer with minimum zero and explain streaming-index versus complete-array-position semantics. Existing nested stage validation SHALL accept zero and positive integers, preserve the field during transformation/serialization, and reject present negative, fractional or string values. This SHALL NOT add a graph validator or change the opaque whole-conversation validation policy of `SaveConversationBodyDto.conversation`. Missing stages/parent metadata SHALL remain valid. The frontend renderer's malformed-reference fallback applies to upstream/history data; it does not weaken existing DTO validation.

`libs/chat-api-client/openapi.json` and the generated `StageDto` model SHALL be regenerated from the backend source. No generated file SHALL be hand-edited. Existing frontend wrappers SHALL continue using the configured `conversationsApi` singleton; no new operationId, SDK singleton or endpoint SHALL be introduced.

Existing contract surface affected by the additive model:

| Operation | Request | Success | Generated client |
| --- | --- | --- | --- |
| `GET /api/v1/conversations?path={path}` | `ConversationPathDto`, no body | 200 `ConversationResponseDto` | `ConversationsApi.getConversation`, normal method |
| `PUT /api/v1/conversations?path={path}` | `SaveConversationQueryDto` and `SaveConversationBodyDto` with full `conversation` | 200 `ConversationResponseDto` | `ConversationsApi.saveConversation`, normal method |

Operation IDs remain `getConversation` and `saveConversation`. The optional field is reachable through `ConversationResponseDto.messages[].custom_content.stages[]` and existing nested message DTOs. Streaming endpoints retain their existing SSE transport and methods. No `Raw` access is newly required.

Both routes retain existing session authentication, per-user conversation access and CSRF enforcement for writes. Existing errors remain 400 for invalid requests, 401 for unauthenticated access, 403 where existing access/CSRF guards reject the request, 404 for missing conversations, 502 for upstream errors and 503 for unavailability. No authorization expansion or new error code is part of the field addition. There is no new cache key/TTL/invalidation, feature/role gate, i18n text, RTL behavior or telemetry for this backend change.

Concrete existing save request with nested metadata:

```http
PUT /api/v1/conversations?path=test-bucket%2Fnested.json
Content-Type: application/json
X-CSRF-Token: <current-session-token>
Cookie: <current-session-cookie>
```

```json
{
  "conversation": {
    "id": "test-bucket/nested.json",
    "folderId": "test-bucket",
    "name": "Nested stages",
    "model": { "id": "agent" },
    "prompt": "",
    "temperature": 1,
    "messages": [
      {
        "role": "assistant",
        "content": "Result",
        "timestamp": "2026-09-30T10:00:00.000Z",
        "custom_content": {
          "stages": [
            { "index": 0, "name": "Plan", "status": "completed" },
            { "index": 1, "parent_stage_index": 0, "name": "Search", "status": "completed" }
          ]
        }
      }
    ],
    "lastActivityDate": 1790762400000,
    "updatedAt": 1790762400000,
    "selectedAddons": [],
    "assistantModelId": "agent"
  }
}
```

The 200 save response and subsequent GET response are the conversation object from that envelope, with both stage indexes and `parent_stage_index: 0` retained; existing server-managed metadata may be updated. For an upstream non-streaming snapshot the equivalent stage array is `[ { "name": "Plan", "status": "completed" }, { "name": "Search", "status": "completed", "parent_stage_index": 0 } ]`. Fetch SHALL preserve that representation, and `stage-visualization` defines positional normalization for rendering.

#### Scenario: Parent metadata survives nested validation

- **WHEN** a `ConversationMessageDto` with a child referencing parent 0 passes through the production-style transforming, whitelisting validation pipe
- **THEN** the request is accepted and the nested parent field survives transformation and serialization

#### Scenario: Invalid numeric parent metadata fails validation

- **WHEN** a nested stage DTO supplies a negative number, fraction or string for `parent_stage_index`
- **THEN** that DTO fails the existing request-validation path
- **AND** an omitted parent remains accepted

#### Scenario: Whole-conversation save retains its existing policy

- **WHEN** the example whole-conversation body is saved and fetched through the existing routes
- **THEN** the parent metadata round-trips without introducing new nested validation on the save envelope

#### Scenario: Generated client exposes the added property

- **WHEN** OpenAPI and client generation run from the updated DTO
- **THEN** the generated `StageDto` has optional numeric `parent_stage_index`, existing SDK methods remain unchanged, and `npm run openapi:check` passes
