## ADDED Requirements

### Requirement: Download behavior is one exhaustive table per content type

`libs/attachment-canvas/src/utils/download.ts` SHALL define the download behavior of every `AttachmentContentType` in a single table, typed so that a content type without an entry fails to compile. Each entry declares:

- whether the content is downloadable;
- the URL and MIME type used to derive a file extension;
- how to download it.

`isDownloadable` and `downloadAttachmentContent` SHALL dispatch through that table, with unchanged signatures and behavior.

#### Scenario: A non-downloadable kind does nothing

- **WHEN** `downloadAttachmentContent` is called with `MarkdownTable`, `Visualizer`, `GroupedVisualizer` or `McpApp` content
- **THEN** no download is triggered, and `isDownloadable` returns `false` for it

#### Scenario: Forbidden errors stay non-downloadable

- **WHEN** the content is `Error` with `errorType` `Forbidden`
- **THEN** `isDownloadable` returns `false` and no download is triggered

### Requirement: Open routing and body layout use lookups

`useOpenAttachmentCanvas` SHALL choose the resolver for a MIME type, and then for a file extension, from lookups keyed by `MIMEType` and `FileExtension`.

- A MIME match whose resolver returns nothing SHALL fall back to Unsupported content.
- An extension match whose resolver returns nothing SHALL make the open return `false`.

`AttachmentCanvasBody` SHALL take its body container class from a lookup keyed by `AttachmentContentType`.

#### Scenario: Extension routing keeps its no-fallback rule

- **WHEN** an attachment with no matching MIME type has a `.md` name and its markdown resolver returns `undefined`
- **THEN** the open returns `false` and no canvas is committed

### Requirement: MIME strings come from MIMEType

Code in `libs/attachment-input` and `libs/attachment-canvas` that compares or maps MIME types SHALL use members of `MIMEType` from `@epam/ai-dial-chat-shared`, not string literals. `MIMEType` SHALL include the Office, archive and source-code MIME types those libs map.

#### Scenario: Icons are unchanged

- **WHEN** `getAttachmentIcon` receives any MIME type it recognized before
- **THEN** it returns the same icon as before
