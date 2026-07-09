# @epam/ai-dial-attachment-canvas

Canvas/viewer component for rendering attachment content inline — images, PDFs, JSON, markdown, and plain text.

## Overview

This library provides a full-featured attachment preview panel. It supports multiple content types and exposes a React context so that deeply nested components can control what is displayed without prop drilling.

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

Renders the active attachment content based on its type.

```tsx
import {
  AttachmentCanvas,
  AttachmentCanvasProvider,
} from '@epam/ai-dial-attachment-canvas';

<AttachmentCanvasProvider>
  <AttachmentCanvas />
</AttachmentCanvasProvider>;
```

### AttachmentCanvasContainer

Drop-in container that combines the provider and canvas in a single component for common use cases.

```tsx
import { AttachmentCanvasContainer } from '@epam/ai-dial-attachment-canvas';

<AttachmentCanvasContainer content={canvasContent} />;
```

## Context

### AttachmentCanvasProvider / useAttachmentCanvas

Use the context hook to imperatively set or clear the displayed content.

```tsx
import { useAttachmentCanvas } from '@epam/ai-dial-attachment-canvas';

const { setContent, clearContent } = useAttachmentCanvas();

setContent({ type: 'image', url: 'https://example.com/image.png' });
```

## Content Types

| Type                       | Description                          |
| -------------------------- | ------------------------------------ |
| `ImageCanvasContent`       | Renders an image from a URL          |
| `PdfCanvasContent`         | Renders a PDF with highlight support |
| `MarkdownCanvasContent`    | Renders markdown text                |
| `JsonCanvasContent`        | Renders a JSON tree viewer           |
| `PlainTextCanvasContent`   | Renders plain text                   |
| `UnsupportedCanvasContent` | Fallback for unsupported MIME types  |

## Utilities

```tsx
import {
  downloadAttachmentContent,
  isTextPreviewable,
  createUnsupportedCanvasContent,
} from '@epam/ai-dial-attachment-canvas';

// Check if a MIME type can be previewed as text
if (isTextPreviewable(mimeType)) { ... }

// Build a fallback content descriptor for unsupported types
const fallback = createUnsupportedCanvasContent(attachment);
```
