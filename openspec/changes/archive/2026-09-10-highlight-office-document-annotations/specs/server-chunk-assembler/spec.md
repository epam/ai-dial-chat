## ADDED Requirements

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
