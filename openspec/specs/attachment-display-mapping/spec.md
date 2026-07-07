## ADDED Requirements

### Requirement: Single pure MessageAttachment-to-DisplayAttachment mapper in chat-shared
The system SHALL expose one pure mapper, `message-attachment-to-display.ts` in `libs/chat-shared`, that converts a `MessageAttachment` DTO into a `DisplayAttachment` and accepts optional `resolvePreviewUrl` and `resolvePlayUrl` callbacks for app-specific URL resolution. The mapper SHALL NOT import `resolveCatalogIconUrl`, `resolveDialFileDownloadUrl`, i18n, `/api` paths, or any other host-owned integration detail.

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
