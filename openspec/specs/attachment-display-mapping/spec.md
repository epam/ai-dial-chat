# attachment-display-mapping Specification

## Purpose

One pure mapper in `chat-shared` from the API `MessageAttachment` shape to the UI `DisplayAttachment` model.

## ADDED Requirements

### Requirement: Single pure MessageAttachment-to-DisplayAttachment mapper in chat-shared
The system SHALL expose one pure mapper, `message-attachment-to-display.ts` in `libs/chat-shared`, that converts a `MessageAttachment` DTO into a `DisplayAttachment` and accepts optional `resolvePreviewUrl` and `resolvePlayUrl` callbacks for app-specific URL resolution. The mapper SHALL NOT import `resolveCatalogIconUrl`, `resolveDialFileDownloadUrl`, i18n, `/api` paths, or any other host-owned integration detail.

For a reference-only DTO (`dto.url == null && dto.reference_url != null`), the mapper SHALL compute `DisplayAttachment.contentType` as `dto.reference_type ?? inferContentTypeFromReferenceUrl(dto.reference_url) ?? dto.type ?? ''`, where `inferContentTypeFromReferenceUrl` maps the `reference_url`'s file extension (ignoring any query string or `#` fragment) to a `MIMEType` via a small extension→MIME table (`pdf`→`application/pdf`, `md`/`markdown`→`text/markdown`, `json`→`application/json`), returning `undefined` for unrecognized extensions. For any DTO where `dto.url` is present, `contentType` SHALL remain `dto.type ?? ''` as before, unaffected by `reference_url`.

#### Scenario: Default mapping with no resolvers
- **WHEN** the shared mapper is called without `resolvePreviewUrl` or `resolvePlayUrl`
- **THEN** it falls back to `dto.url` for image preview and audio play, and synthesizes a `data:` URL when `dto.data` is present and `dto.url` is not

#### Scenario: App adapter supplies app-specific resolvers
- **WHEN** `apps/chat/src/utils/attachment-dto-to-display.ts` calls the shared mapper
- **THEN** it passes `resolveCatalogIconUrl` as `resolvePreviewUrl` for images and `resolveDialFileDownloadUrl`-backed resolution for audio `playUrl`, producing the same `DisplayAttachment` output as the pre-consolidation `apps/chat` mapper for every existing test case

#### Scenario: conversation-stages renders audio attachments
- **WHEN** `libs/conversation-stages` renders a `StageItem` whose attachment DTO has an audio MIME type
- **THEN** the shared mapper (used with default resolvers) produces a `DisplayAttachment` with a `playUrl`, and the audio attachment is displayed — unlike the pre-consolidation local mapper, which had no audio handling

#### Scenario: conversation-stages no longer has a local duplicate mapper
- **WHEN** `libs/conversation-stages/src/utils/to-display-attachment.ts` is checked after this change
- **THEN** the file no longer exists, and all its former call sites import the mapper from `libs/chat-shared` instead

#### Scenario: contentType is inferred from a PDF-page reference_url when the chunk type is generic

- **WHEN** the mapper is called with a DTO where `url` is absent, `type` is `'text/markdown'`, and `reference_url` is `'files/{bucket}/report.pdf#page=81'`
- **THEN** the resulting `DisplayAttachment.contentType` is `'application/pdf'`

#### Scenario: reference_type takes priority over the inferred extension

- **WHEN** the mapper is called with a DTO where `url` is absent, `reference_url` ends in `.pdf`, and `reference_type` is `'text/html'`
- **THEN** the resulting `DisplayAttachment.contentType` is `'text/html'`

#### Scenario: contentType inference does not apply when url is present

- **WHEN** the mapper is called with a DTO that has both `url` and a PDF-shaped `reference_url`
- **THEN** the resulting `DisplayAttachment.contentType` equals `dto.type`, unaffected by `reference_url`
