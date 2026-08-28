# attachment-canvas-workflow Specification

## Purpose

Specifies the host-agnostic attachment-opening workflow exported from
`@epam/ai-dial-attachment-canvas`, covering attachment-type dispatch
(Image/Audio/File/Pasted/Prompt), the File content-type routing precedence
(reference-only PDF, custom visualizers, plain text, Office, MIME, extension,
HTML, code fallback), and the pure `findVisualizerForMime` matcher, all driven
by injected content resolvers and callbacks instead of application React
contexts.

The hook now lives entirely in the library; `apps/chat` owns no
`useOpenAttachmentCanvas` of its own, only the
`useAttachmentCanvasResolvers` adapter that binds the injected resolvers.

## Requirements

### Requirement: Attachment-opening hook exported from the package root

`@epam/ai-dial-attachment-canvas` SHALL export a hook that, given a `DisplayAttachment`
(from `@epam/ai-dial-chat-shared`) and an optional caller-scoped
`canvasAttachmentId`, decides whether and how to open the attachment canvas,
using only injected content resolvers, an injected `resolveContentUrl`
callback, an injected `customVisualizers` list, an optional `themeId`, and an
optional `onBeforeOpen` callback — never an application React context. The
hook SHALL return `{ openAttachmentCanvas: (attachment, canvasAttachmentId?)
=> Promise<boolean> }`, resolving `true` when the canvas was opened and
`false` when the attachment could not be previewed.

#### Scenario: Consumer supplies resolvers instead of the hook reading contexts

- **WHEN** a host calls the exported hook with its own
  `resolveImageContent`/`resolveTextContent`/`resolveMarkdownContent`/
  `resolveCodeContent`/`resolveHtmlContent`/`resolvePdfContent`/
  `resolveOoxmlContent`/`resolveJsonContent`/`resolveVisualizerContent`/
  `resolveReferencePdfContent`/`resolveContentUrl`/`hasTextSource` callbacks
  and a `customVisualizers` array
- **THEN** the hook never imports or reads any React context, and every
  content decision is made by calling the supplied resolver for the matched
  content type

#### Scenario: Panel coordination is delegated to the host

- **WHEN** the hook is about to open the canvas for an image, file, pasted,
  or prompt attachment
- **THEN** it calls the supplied `onBeforeOpen` callback (if provided) before
  opening the canvas, and does not call it for an audio attachment

### Requirement: Attachment-type dispatch preserves every current decision path

The hook SHALL preserve the exact dispatch behavior of `apps/chat`'s
`useOpenAttachmentCanvas` for every attachment type and content-routing
branch: `Image` (synchronous, no loading state), `Audio` (uses `playUrl` then
`url`, no panel-close), `File` (loading state via `openCanvasLoading`, then
the full content-type dispatcher), `Pasted`/`Prompt` (loading state, then
text resolution), and any other type returns `false`.

#### Scenario: Image attachment opens synchronously without a loading state

- **WHEN** `openAttachmentCanvas` is called with an `Image` attachment whose
  resolver returns content
- **THEN** the canvas opens directly via `openCanvas`, without an
  intermediate `openCanvasLoading` call

#### Scenario: Audio attachment does not trigger panel coordination

- **WHEN** `openAttachmentCanvas` is called with an `Audio` attachment
- **THEN** `onBeforeOpen` is not called, and the canvas opens with
  `{ type: Audio, url, mimeType }` derived from `playUrl ?? url`

#### Scenario: File attachment enters a loading state before resolving

- **WHEN** `openAttachmentCanvas` is called with a `File` attachment
- **THEN** the hook calls `onBeforeOpen`, then `openCanvasLoading`, before
  awaiting the file-content dispatcher, and calls `closeCanvas` if the
  dispatcher resolves to no content

### Requirement: File content-type dispatcher preserves MIME/extension precedence and fallbacks

For `File` attachments, the hook SHALL apply, in order: (1) reference-only
PDF page resolution when `url` is absent and `referenceUrl` is present, which
pre-empts every other routing; (2) custom-visualizer matching by MIME type
against the supplied `customVisualizers`, which short-circuits all further
routing including PDF/Markdown/JSON when content resolves; (3) plain-text
resolution when `contentType` is empty and inline `data` is present; (4)
Office detection from the MIME type via `getOoxmlFileType('', contentType)`;
(5) MIME-type-based routing for PDF/Markdown/JSON, falling back to an
"unsupported" content and returning `true` when the matched resolver
returns no content; (6) Office detection from the file name via
`getOoxmlFileType(fileName)`; (7) extension-based routing for
`.pdf`/`.md`/`.markdown`/`.json`, returning `false` (not "unsupported") when
the matched resolver returns no content; (8) HTML detection by either the
attachment's display name or its URL's filename; (9) an "unsupported" gate
for any named attachment that is neither text- nor HTML-previewable; (10)
HTML resolution, falling back to a direct URL iframe only when nothing was
fetched, and to "unsupported" when fetched content was rejected by the
resolver; (11) a code resolver as the final fallback.

Each Office branch sits immediately ahead of the switch keyed on the same
signal, so the pairing stays local; both return `true` even when the resolver
yields nothing, opening "unsupported" content instead — the format *was*
recognised (see the `attachment-canvas-ooxml-viewer` capability).

#### Scenario: Office MIME detection pre-empts the content-type switch

- **WHEN** a `File` attachment's `contentType` is the canonical DOCX MIME type
- **THEN** `resolveOoxmlContent` is called and the `contentType` switch is
  never reached

#### Scenario: MIME-routed resolver failure opens Unsupported content

- **WHEN** a `File` attachment's `contentType` matches `MIMEType.PDF` and the
  supplied `resolvePdfContent` resolves to `null`
- **THEN** the hook opens `createUnsupportedCanvasContent(resolveContentUrl(attachment))`
  and returns `true`

#### Scenario: Extension-routed resolver failure returns false, not Unsupported

- **WHEN** a `File` attachment has no `contentType` but a `.pdf`-suffixed
  `name`, and the supplied `resolvePdfContent` resolves to `null`
- **THEN** the hook returns `false` without opening any canvas content

#### Scenario: Custom visualizer match short-circuits MIME/extension routing

- **WHEN** a `File` attachment's `contentType` matches an entry in the
  supplied `customVisualizers` and `resolveVisualizerContent` resolves to
  content
- **THEN** the hook opens that content and never calls the PDF/Markdown/JSON
  resolvers for that attachment

#### Scenario: Reference-only PDF page pre-empts all other routing

- **WHEN** a `File` attachment has no `url` but has a `referenceUrl`
  containing a page anchor, and `resolveReferencePdfContent` resolves to
  content
- **THEN** the hook opens that content immediately, without evaluating
  visualizer, MIME, or extension routing

#### Scenario: HTML resolver rejection due to size limit opens Unsupported, not a URL iframe

- **WHEN** an attachment is HTML-previewable, has fetchable text content, and
  the supplied `resolveHtmlContent` resolves to `null` (e.g. content exceeded
  a size limit)
- **THEN** the hook opens "unsupported" content rather than falling back to a
  direct URL iframe

#### Scenario: Pure external URL with no text source falls back to a URL iframe

- **WHEN** an attachment is HTML-previewable, has no fetchable text source,
  and has a non-null `url`
- **THEN** the hook opens `{ type: Html, url }` directly

### Requirement: `findVisualizerForMime` is a library-owned pure function

`@epam/ai-dial-attachment-canvas` SHALL export `findVisualizerForMime(mimeType:
string, visualizers: CustomVisualizer[]): CustomVisualizer | undefined`,
matching case-insensitively against each visualizer's comma-separated
`contentType` field, first match wins.

#### Scenario: Case-insensitive match against a comma-separated content-type list

- **WHEN** `findVisualizerForMime('application/PDF', visualizers)` is called
  against a visualizer entry whose `contentType` is
  `'text/plain,application/pdf'`
- **THEN** that visualizer is returned

#### Scenario: No match returns undefined

- **WHEN** no visualizer's `contentType` list contains the given MIME type
- **THEN** the function returns `undefined` and the hook does not call
  `resolveVisualizerContent`
