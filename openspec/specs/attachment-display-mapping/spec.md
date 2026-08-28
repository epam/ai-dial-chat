# attachment-display-mapping Specification

## Purpose

One pure mapper in `chat-shared` from the API `MessageAttachment` shape to the UI `DisplayAttachment` model.

## Requirements

### Requirement: Single pure MessageAttachment-to-DisplayAttachment mapper in chat-shared
The system SHALL expose one pure mapper, `message-attachment-to-display.ts` in `libs/chat-shared`, that converts a `MessageAttachment` DTO into a `DisplayAttachment` and accepts optional `resolvePreviewUrl` and `resolvePlayUrl` callbacks for app-specific URL resolution. The mapper SHALL NOT import `resolveCatalogIconUrl`, `resolveDialFileDownloadUrl`, i18n, `/api` paths, or any other host-owned integration detail.

For a reference-only DTO (`dto.url == null && dto.reference_url != null`), the mapper SHALL compute `DisplayAttachment.contentType` as `dto.reference_type ?? inferMimeTypeFromPath(dto.reference_url) ?? dto.type ?? ''`. `inferMimeTypeFromPath` is the shared `chat-shared` helper that maps a path's file extension (ignoring any query string or `#` fragment) to a `MIMEType`, returning `undefined` for an unrecognized or absent extension; it is not specific to this mapper and covers documents, source-code and text extensions, images, and audio. For any DTO where `dto.url` is present, `contentType` SHALL remain `dto.type ?? ''` as before, unaffected by `reference_url`.

The mapper SHALL also derive:

- `id` as `dto.url ?? dto.data ?? dto.title` — the first identifying value the DTO carries.
- `type` as the attachment type inferred from the MIME type, except that a DTO carrying **both** `url` and `reference_url` with no `reference_type` SHALL map to `AttachmentType.Link` — a file that is also a citation target is presented as a link rather than as a plain file tile.
- `previewUrl` only for image attachments and `playUrl` only for audio ones, from the matching resolver when `dto.url` is present, or from a synthesized `data:` URL when only inline `data` is present and its MIME type matches the expected `image/` or `audio/` prefix.
- `data` only for attachments that are neither image nor audio, so inline bytes already folded into a `data:` URL are not duplicated.

Alongside the single-DTO mapper, `chat-shared` SHALL export `messageAttachmentsToDisplayAttachments`, which maps a list and **deduplicates by `id`, first occurrence winning** — the same attachment referenced by several annotations must render once.

#### Scenario: Default mapping with no resolvers
- **WHEN** the shared mapper is called without `resolvePreviewUrl` or `resolvePlayUrl`
- **THEN** it falls back to `dto.url` for image preview and audio play, and synthesizes a `data:` URL when `dto.data` is present and `dto.url` is not

#### Scenario: The adapter threads host resolvers through
- **WHEN** `libs/chat-hooks/src/files/attachment-dto-to-display.ts` calls the shared mapper
- **THEN** it forwards the `resolvers` object it was given — a **required** parameter, so a caller cannot silently fall back to raw URLs — and the app supplies `resolveCatalogIconUrl` for image `previewUrl` and `resolveDialFileDownloadUrl`-backed resolution for audio `playUrl`

#### Scenario: A url plus a reference_url maps to a Link attachment
- **WHEN** a DTO carries both `url` and `reference_url` and no `reference_type`
- **THEN** the resulting `DisplayAttachment.type` is `AttachmentType.Link`

#### Scenario: The list mapper deduplicates by id
- **WHEN** `messageAttachmentsToDisplayAttachments` is called with two DTOs that resolve to the same `id`
- **THEN** the result contains one entry, the first occurrence

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
