## ADDED Requirements

### Requirement: Attachment content resolvers prefer a resolvable DIAL download URL over a 0-byte local File

Every attachment-canvas content resolver in `@epam/ai-dial-chat-hooks` that can resolve content from either a local `attachment.file` or a DIAL file id — `resolveImageCanvasContent`, `resolveAttachmentBlobUrl` (and the resolvers built on it, including `resolvePdfCanvasContent` and `resolveOoxmlCanvasContent`), `resolveAttachmentText` (and the resolvers built on it, including text/Markdown/code/JSON and `resolveVisualizerCanvasContent`), and `hasAttachmentTextSource` — SHALL apply this source precedence: a local `attachment.file` **with bytes** resolves first; when the local `File` is 0-byte or absent, the host-injected DIAL download URL (`resolvers.resolveDialUrl(attachment)`, i.e. a `files/{bucket}/{path}` id in `attachment.url` or `attachment.referenceUrl`) resolves before the 0-byte local `File`. The remaining fallback order (`attachment.previewUrl`, then inline base64 `attachment.data`, then any type-specific external-URL tail) SHALL be unchanged.

Rationale: a file-manager-selected attachment carries a 0-byte placeholder `File` (synthesized by `dialFileToAttachment` to satisfy the required `Attachment.file` field) while its real content sits behind the DIAL url; local-`File`-first precedence hands the renderer an object URL over that empty placeholder (issue #8761). Conversely, the composer's eager-upload flow assigns the DIAL url before send while keeping the real local `File`, so a `File` with bytes must keep winning to preserve the instant, offline-capable in-memory preview. The text-based resolvers already resolve DIAL-first (after inline `data`) and conform; this requirement fixes the two inverted gates (`resolveImageCanvasContent`, `resolveAttachmentBlobUrl`).

#### Scenario: File-manager image previews from its DIAL content

- **GIVEN** an image attachment shaped like a file-manager selection: `attachment.file` is a 0-byte `File` typed `image/png` and `attachment.url` is `files/{bucket}/path/image.png`
- **WHEN** `resolveImageCanvasContent` is called
- **THEN** it returns `ImageCanvasContent` whose `url` is the resolved DIAL download URL, not an object URL over `attachment.file`

#### Scenario: File-manager PDF content is fetched from the DIAL download URL

- **GIVEN** an attachment whose `attachment.file` is a 0-byte placeholder `File` and whose `attachment.url` is a `files/{bucket}/{path}` id
- **WHEN** `resolvePdfCanvasContent` (via `resolveAttachmentBlobUrl`) is called
- **THEN** content is fetched from the resolved DIAL download URL (through the existing blob cache and error classification), not from `attachment.file`

#### Scenario: An uploaded-but-unsent attachment previews from its local File without network

- **GIVEN** an attachment whose `attachment.file` holds the real bytes and whose `attachment.url` is the DIAL id assigned by the composer's eager upload
- **WHEN** `resolveImageCanvasContent` or `resolvePdfCanvasContent` (via `resolveAttachmentBlobUrl`) is called
- **THEN** the content resolves from the local `File` (an object URL), and no DIAL download or metadata fetch is issued

#### Scenario: A genuine local file still resolves locally, including zero-byte text

- **GIVEN** an attachment with a local `attachment.file` and no `files/` id in `url` or `referenceUrl`
- **WHEN** any content resolver or `hasAttachmentTextSource` is called
- **THEN** behavior is unchanged from local resolution: blob/text content comes from `attachment.file`, and a zero-byte text `File` resolves to empty text rather than "no source"

#### Scenario: hasAttachmentTextSource reports a DIAL-hosted attachment as a text source

- **GIVEN** an attachment whose `attachment.url` is a `files/{bucket}/{path}` id (with or without a placeholder `File`)
- **WHEN** `hasAttachmentTextSource` is called
- **THEN** it returns `true`, so a fetched-and-rejected HTML payload is classified as "fetched and rejected" rather than "nothing to fetch"
