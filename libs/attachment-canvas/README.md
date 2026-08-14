# @epam/ai-dial-attachment-canvas

Canvas/viewer component for rendering attachment content inline — images, audio, PDFs, JSON, markdown, code, HTML, and plain text.

## Overview

`@epam/ai-dial-attachment-canvas` solves the problem of rendering heterogeneous attachment content — images, audio, PDFs with text highlighting, JSON trees, markdown documents, syntax-highlighted source files, sandboxed HTML, third-party visualizers, and plain text — inside a single unified preview panel. Without this library, each consuming feature would need to independently wire up content-type detection, lazy loading, and a PDF renderer. The library centralises all of that behind a React context, meaning any component in the tree can push new content to the canvas without drilling props through intermediate layers. Use it whenever a conversation view, side panel, or modal needs to display an attachment that the user has opened or clicked. When a MIME type is not natively supported, or a fetch fails, the library provides graceful `UnsupportedCanvasContent` / `ErrorCanvasContent` fallbacks and a download utility so users can still retrieve the file.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-attachment-canvas": "*"
  }
}
```

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-sidebar`
- `@epam/ai-dial-ui-kit`
- `@epam/pdf-highlighter-kit`
- `@epam/ai-dial-react-pdf-highlighter`
- `@tabler/icons-react`
- `react-json-view-lite`

## Components

### AttachmentCanvas

Renders the active attachment content based on its type, inside a resizable side panel. `isOpen`, `onClose`, `content`, and `labels` are required.

```tsx
import {
  AttachmentCanvas,
  AttachmentContentType,
} from '@epam/ai-dial-attachment-canvas';

<AttachmentCanvas
  isOpen={isOpen}
  onClose={handleClose}
  content={{
    type: AttachmentContentType.Image,
    url: 'https://example.com/image.png',
  }}
  fileName="image.png"
  labels={{ ariaLabel: 'Attachment preview', closeLabel: 'Close' }}
  onDownload={handleDownload}
  isMobile={isMobile}
/>;
```

### AttachmentCanvasContainer

Context-connected container that reads state from `AttachmentCanvasProvider` and renders `AttachmentCanvas` with download support wired up. Every prop is optional — `labels` fields all have English defaults.

```tsx
import {
  AttachmentCanvasProvider,
  AttachmentCanvasContainer,
} from '@epam/ai-dial-attachment-canvas';

<AttachmentCanvasProvider>
  <AttachmentCanvasContainer isMobile={isMobile} maxWidth={1200} />
</AttachmentCanvasProvider>;
```

### CodeContent

Standalone syntax-highlighted code view used by the canvas for `CodeCanvasContent`. Exported for hosts that need the same rendering outside the panel.

```tsx
import {
  CodeContent,
  AttachmentContentType,
} from '@epam/ai-dial-attachment-canvas';

<CodeContent
  content={{
    type: AttachmentContentType.Code,
    text: source,
    language: 'typescript',
  }}
  codeBlockTheme={codeBlockTheme}
/>;
```

## Context

### AttachmentCanvasProvider / useAttachmentCanvas

The context owns open/close state, the current content, the file name, and the id of the attachment being displayed. Object URLs created for blob-backed content are revoked automatically when the content changes or the canvas closes.

```tsx
import {
  useAttachmentCanvas,
  AttachmentContentType,
} from '@epam/ai-dial-attachment-canvas';

const { isOpen, isLoading, openCanvasLoading, openCanvas, closeCanvas } =
  useAttachmentCanvas();

/* Open the panel immediately, before the file has been fetched. */
openCanvasLoading('report.pdf', attachment.id);

/* Then push the resolved content in. */
openCanvas(
  { type: AttachmentContentType.Pdf, url: objectUrl },
  'report.pdf',
  attachment.id,
);
```

## Content Types

`AttachmentContentType` is the discriminant on every content descriptor.

| Enum member                         | Content type               | Description                                      |
| ----------------------------------- | -------------------------- | ------------------------------------------------ |
| `AttachmentContentType.PlainText`   | `PlainTextCanvasContent`   | Renders plain text                               |
| `AttachmentContentType.Image`       | `ImageCanvasContent`       | Renders an image from a URL                      |
| `AttachmentContentType.Audio`       | `AudioCanvasContent`       | Renders an audio player                          |
| `AttachmentContentType.Markdown`    | `MarkdownCanvasContent`    | Renders markdown text                            |
| `AttachmentContentType.Json`        | `JsonCanvasContent`        | Renders a JSON tree viewer                       |
| `AttachmentContentType.Pdf`         | `PdfCanvasContent`         | Renders a PDF with highlight support             |
| `AttachmentContentType.Code`        | `CodeCanvasContent`        | Renders syntax-highlighted source                |
| `AttachmentContentType.Html`        | `HtmlCanvasContent`        | Renders HTML in a sandboxed frame, or its source |
| `AttachmentContentType.Visualizer`  | `VisualizerCanvasContent`  | Renders a registered custom visualizer           |
| `AttachmentContentType.Unsupported` | `UnsupportedCanvasContent` | Fallback for unsupported MIME types              |
| `AttachmentContentType.Error`       | `ErrorCanvasContent`       | Load failure or forbidden access                 |

`AttachmentErrorType` distinguishes the two failure kinds carried by
`ErrorCanvasContent`: `LoadFailed` (network error or a non-`403` non-OK
response) and `Forbidden` (HTTP `403`).

## Utilities

```tsx
import {
  downloadAttachmentContent,
  isDownloadable,
  isTextPreviewable,
  isHtmlPreviewable,
  extensionToLanguage,
  createUnsupportedCanvasContent,
  createLoadErrorCanvasContent,
  createForbiddenCanvasContent,
} from '@epam/ai-dial-attachment-canvas';

// Check whether a file name's extension can be previewed as text or as HTML
if (isTextPreviewable(fileName)) { ... }
if (isHtmlPreviewable(fileName)) { ... }

// Resolve a syntax-highlighting language from a file extension
const language = extensionToLanguage('ts');

// Build fallback content descriptors
const unsupported = createUnsupportedCanvasContent(url);
const loadError = createLoadErrorCanvasContent(url);
const forbidden = createForbiddenCanvasContent(url);

// Offer the raw file when preview is not possible
if (isDownloadable(content)) {
  downloadAttachmentContent(content, fileName);
}
```

## Types

Style overrides go through `AttachmentCanvasStyles` (`AttachmentCanvasColors`,
`AttachmentCanvasTypography`, plus a `panelStyles` passthrough to the underlying
`SidebarPanel`), and every user-visible string lives on
`AttachmentCanvasLabels`. `AttachmentCanvasProps`,
`AttachmentCanvasContainerProps`, `CodeContentProps`, and
`AttachmentCanvasContextValue` are exported for hosts building those objects.
