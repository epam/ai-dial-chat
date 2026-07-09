# @epam/ai-dial-attachment-input

File attachment input components with upload validation, progress tracking, and drag-and-drop support.

## Overview

This library provides components and utilities for handling file attachments in a conversation input. It covers upload state display, drag-and-drop overlays, clipboard paste, and MIME type validation.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-attachment-input": "*"
  }
}
```

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`
- `@tabler/icons-react`

## Components

### AttachmentCard

Displays a single attachment with its name, status, and actions (remove, retry, etc.).

```tsx
import { AttachmentCard } from '@epam/ai-dial-attachment-input';

<AttachmentCard attachment={file} onRemove={handleRemove} />;
```

### AttachmentTray

Container that renders a list of `AttachmentCard` items.

```tsx
import { AttachmentTray } from '@epam/ai-dial-attachment-input';

<AttachmentTray attachments={files} onRemove={handleRemove} />;
```

### FileDndOverlay

Full-area drag-and-drop overlay that activates when files are dragged over the input area.

```tsx
import { FileDndOverlay } from '@epam/ai-dial-attachment-input';

<FileDndOverlay onDrop={handleDrop} isVisible={isDragging} />;
```

## Hooks

### useClipboardPaste

Listens for paste events and extracts files from the clipboard.

```tsx
import { useClipboardPaste } from '@epam/ai-dial-attachment-input';

useClipboardPaste({ onPaste: (files) => handleFiles(files) });
```

### useLazyImageLoad

Defers image loading until the element is visible in the viewport.

```tsx
import { useLazyImageLoad } from '@epam/ai-dial-attachment-input';

const { ref, src } = useLazyImageLoad(imageUrl);
```

## Utilities

```tsx
import {
  generateAttachmentId,
  getAttachmentCardState,
  getAttachmentIcon,
  getNameWithoutExtension,
  mimeTypesToExtensionLabels,
  isMimeTypeAllowed,
  MAX_UPLOADS_PER_MINUTE,
} from '@epam/ai-dial-attachment-input';

// Check if a file type is permitted
const allowed = isMimeTypeAllowed(file.type, allowedMimeTypes);

// Convert MIME types to human-readable extension labels
const labels = mimeTypesToExtensionLabels(['image/png', 'application/pdf']);
```
