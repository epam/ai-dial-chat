# @epam/ai-dial-attachment-canvas

Canvas/viewer component for rendering attachment content inline — images, audio, PDFs, DOCX/XLSX/PPTX, JSON, markdown, code, HTML, and plain text.

## Overview

`@epam/ai-dial-attachment-canvas` solves the problem of rendering heterogeneous attachment content — images, audio, PDFs with text highlighting, DOCX/XLSX/PPTX documents, JSON trees, markdown documents, syntax-highlighted source files, sandboxed HTML, third-party visualizers, and plain text — inside a single unified preview panel. Without this library, each consuming feature would need to independently wire up content-type detection, lazy loading, and document renderers. The library centralises all of that behind a React context, meaning any component in the tree can push new content to the canvas without drilling props through intermediate layers. Use it whenever a conversation view, side panel, or modal needs to display an attachment that the user has opened or clicked. When a MIME type is not natively supported, or a fetch fails, the library provides graceful `UnsupportedCanvasContent` / `ErrorCanvasContent` fallbacks and a download utility so users can still retrieve the file.

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
- `@epam/ai-dial-shared`
- `@epam/ai-dial-sidebar`
- `@epam/ai-dial-visualizer-connector`
- `@epam/ai-dial-ui-kit`
- `@epam/pdf-highlighter-kit`
- `@epam/ai-dial-react-pdf-highlighter`
- `@tabler/icons-react`
- `react-json-view-lite`
- `react-syntax-highlighter`

The library uses `@silurus/ooxml` as a bundled runtime dependency. Its DOCX,
XLSX, and PPTX entry points are loaded independently on demand, so opening one
format does not eagerly load the other renderers.

The PDF renderer (`PdfContent`, used internally by `AttachmentCanvasBody` for
`AttachmentContentType.Pdf`) is loaded through a dynamic import the first time
an attachment actually resolves to a PDF, not eagerly with the rest of the
library — `pdfjs-dist` and `@epam/ai-dial-react-pdf-highlighter`'s own weight,
including their CSS, only enters a host bundle once a user opens a PDF.
`AttachmentCanvasBody` shows a `Spinner` while that first load resolves;
opening a non-PDF attachment never triggers it.

The library never configures `pdfjs-dist`'s worker itself —
`GlobalWorkerOptions.workerSrc` is a global shared by every `pdfjs-dist`
consumer in the host app, so deciding it is the host's responsibility, not
this library's. Pass `configurePdfWorker` (on `AttachmentCanvasContainer`,
`AttachmentCanvas`, or `AttachmentCanvasBody`) to supply it; it's called once,
the first time a PDF is opened. When omitted,
`@epam/pdf-highlighter-kit`'s own CDN-hosted worker fallback is used instead.

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

### AttachmentCanvasBody

Content-only renderer shared by `AttachmentCanvas` — the same Markdown/JSON/code/HTML/PDF/OOXML/image/audio/visualizer/unsupported/error rendering, with no sidebar chrome (no panel, header, close/download/copy actions). Use it when a host wants to mount an attachment preview inline in its own layout instead of the resizable side panel `AttachmentCanvas`/`AttachmentCanvasContainer` render.

```tsx
import { AttachmentCanvasBody } from '@epam/ai-dial-attachment-canvas';

<AttachmentCanvasBody
  content={canvasContent}
  isLoading={isLoading}
  fileName="report.pdf"
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
  <AttachmentCanvasContainer
    isMobile={isMobile}
    maxWidth={1200}
    configurePdfWorker={configurePdfWorker}
  />
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

## Hooks

### useOpenAttachmentCanvas

Decides whether and how to open the attachment canvas for a given `DisplayAttachment`, dispatching on its type (`Image`/`Audio`/`File`/`Pasted`/`Prompt`) and, for `File` attachments, on MIME type, extension, and custom-visualizer registry matches. The hook owns all of the dispatch logic; the host supplies the content resolvers, the custom-visualizer registry, the active theme, and an optional panel-coordination callback.

```tsx
import {
  useOpenAttachmentCanvas,
  type UseOpenAttachmentCanvasResolvers,
  type UseOpenAttachmentCanvasOptions,
} from '@epam/ai-dial-attachment-canvas';

const resolvers: UseOpenAttachmentCanvasResolvers = {
  resolveImageContent,
  resolveTextContent,
  resolveMarkdownContent,
  resolveCodeContent,
  resolveHtmlContent,
  resolvePdfContent,
  resolveJsonContent,
  resolveVisualizerContent,
  resolveReferencePdfContent,
  resolveContentUrl,
};

const options: UseOpenAttachmentCanvasOptions = {
  customVisualizers,
  themeId,
  onBeforeOpen: () => {
    closeConversationPanel();
    closeSourcesSidebar();
  },
};

const { openAttachmentCanvas } = useOpenAttachmentCanvas(resolvers, options);

const opened = await openAttachmentCanvas(attachment);
if (!opened) {
  // fall back to downloading the attachment
}
```

`openAttachmentCanvas` resolves `true` when the canvas was opened and `false`
when the attachment could not be previewed. `onBeforeOpen` runs for
`Image`/`File`/`Pasted`/`Prompt` attachments, never for `Audio`.

### findVisualizerForMime

Pure lookup used internally by `useOpenAttachmentCanvas` to match an
attachment's MIME type against a custom-visualizer registry entry's
comma-separated `contentType` list. Exported for hosts that need the same
matching logic outside the hook (e.g. to decide whether to offer a visualizer
before the canvas opens).

```tsx
import { findVisualizerForMime } from '@epam/ai-dial-attachment-canvas';

const visualizer = findVisualizerForMime('application/pdf', customVisualizers);
```

## Content Types

`AttachmentContentType` is the discriminant on every content descriptor.

| Enum member                         | Content type               | Description                                       |
| ----------------------------------- | -------------------------- | ------------------------------------------------- |
| `AttachmentContentType.PlainText`   | `PlainTextCanvasContent`   | Renders plain text                                |
| `AttachmentContentType.Image`       | `ImageCanvasContent`       | Renders an image from a URL                       |
| `AttachmentContentType.Audio`       | `AudioCanvasContent`       | Renders an audio player                           |
| `AttachmentContentType.Markdown`    | `MarkdownCanvasContent`    | Renders markdown text                             |
| `AttachmentContentType.Json`        | `JsonCanvasContent`        | Renders a JSON tree viewer                        |
| `AttachmentContentType.Pdf`         | `PdfCanvasContent`         | Renders a PDF with highlight support              |
| `AttachmentContentType.Ooxml`       | `OoxmlCanvasContent`       | Renders DOCX, XLSX, or PPTX with `@silurus/ooxml` |
| `AttachmentContentType.Code`        | `CodeCanvasContent`        | Renders syntax-highlighted source                 |
| `AttachmentContentType.Html`        | `HtmlCanvasContent`        | Renders HTML in a sandboxed frame, or its source  |
| `AttachmentContentType.Visualizer`  | `VisualizerCanvasContent`  | Renders a registered custom visualizer            |
| `AttachmentContentType.Unsupported` | `UnsupportedCanvasContent` | Fallback for unsupported MIME types               |
| `AttachmentContentType.Error`       | `ErrorCanvasContent`       | Load failure or forbidden access                  |

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
  isOoxmlPreviewable,
  getOoxmlFileType,
  extensionToLanguage,
  createUnsupportedCanvasContent,
  createLoadErrorCanvasContent,
  createForbiddenCanvasContent,
} from '@epam/ai-dial-attachment-canvas';

// Check whether a file can be previewed by a built-in renderer
if (isTextPreviewable(fileName)) { ... }
if (isHtmlPreviewable(fileName)) { ... }
if (isOoxmlPreviewable(fileName, mimeType)) { ... }

// Resolve the format needed by OoxmlCanvasContent
const format = getOoxmlFileType(fileName, mimeType);

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
