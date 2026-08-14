# @epam/ai-dial-attachment-input

File attachment components with upload validation, progress tracking, clipboard paste, and drag-and-drop support.

## Overview

`@epam/ai-dial-attachment-input` provides everything needed to let users attach files to a conversation message and to display the attachments a message already carries. It covers the full lifecycle of an upload: MIME type and size validation before the file is sent, an `AttachmentCard` that shows per-file name, progress, error state, and removal or retry actions, an `AttachmentTray` that groups multiple cards in the input area, an `AttachmentGroup` that renders a sent message's images and file rows with a "download all" action, a drag-and-drop overlay for dropping files anywhere on the input zone, and a clipboard-paste hook for pasting images or long text directly from the clipboard. Use this library rather than building file handling from scratch whenever you need a production-quality attachment UX that enforces rate limits, shows meaningful error states, and lazily loads image previews only when they scroll into view.

Like every lib in this workspace, it holds no i18n, no transport, and no state of its own — user-visible strings arrive through `labels` props with English defaults, and the host supplies the attachment data and the callbacks that act on it.

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

Displays a single attachment with its name, status, and actions. Every callback receives the attachment `id`. Passing `searchQuery` highlights matches in the file name.

```tsx
import { AttachmentCard } from '@epam/ai-dial-attachment-input';

<AttachmentCard
  attachment={attachment}
  searchQuery={searchQuery}
  onRemove={handleRemove}
  onRetry={handleRetry}
  onDownload={handleDownload}
  isSelected={attachment.id === selectedAttachmentId}
  labels={{ removeLabel: 'Remove', retryLabel: 'Retry' }}
/>;
```

### AttachmentTray

Renders the list of in-progress attachments above the composer.

```tsx
import { AttachmentTray } from '@epam/ai-dial-attachment-input';

<AttachmentTray
  attachments={attachments}
  onRemove={handleRemove}
  onRetry={handleRetry}
  onExpand={handleExpandPastedText}
  onAttachmentClick={handleOpenInCanvas}
/>;
```

### AttachmentGroup

Renders a sent message's attachments — image tiles plus file rows — with a header action that downloads everything downloadable at once. Collapses beyond `ATTACHMENT_COLLAPSE_THRESHOLD` items.

```tsx
import {
  AttachmentGroup,
  ATTACHMENT_COLLAPSE_THRESHOLD,
} from '@epam/ai-dial-attachment-input';

<AttachmentGroup
  attachments={message.attachments}
  onAttachmentClick={handleOpenInCanvas}
  onDownloadAll={handleDownloadAll}
  selectedAttachmentId={selectedAttachmentId}
/>;
```

### FileDndOverlay

Full-area drag-and-drop overlay. Set `isAttachmentsAllowed={false}` to render the denied state, which suppresses the drop instead of forwarding it.

```tsx
import { FileDndOverlay } from '@epam/ai-dial-attachment-input';

<FileDndOverlay
  isVisible={isDragging}
  isAttachmentsAllowed={isAttachmentsAllowed}
  labels={{ title: 'Drop files to attach' }}
/>;
```

## Hooks

### useClipboardPaste

Returns a `handlePaste` handler for a textarea. Pasted images become image attachments; pasted text longer than `threshold` characters becomes a pasted-text attachment instead of inline input content.

```tsx
import { useClipboardPaste } from '@epam/ai-dial-attachment-input';

const { handlePaste } = useClipboardPaste(handleAttachments, 1000, {
  screenshotName: 'Screenshot.png',
  pastedTextName: 'Pasted text',
});

<textarea onPaste={handlePaste} />;
```

### useLazyImageLoad

Defers image loading until the element is visible, and reports the load state so the caller can keep a skeleton up.

```tsx
import {
  useLazyImageLoad,
  LazyImageLoadStatus,
} from '@epam/ai-dial-attachment-input';

const { imageRef, imageLoadStatus } = useLazyImageLoad({
  enabled: isVisible,
  src: previewUrl,
});

<img
  ref={imageRef}
  alt={fileName}
  className={
    imageLoadStatus === LazyImageLoadStatus.Loaded ? 'opacity-100' : 'opacity-0'
  }
/>;
```

`LazyImageLoadStatus` values: `Idle`, `Loading`, `Loaded`, `Error`.

## Utilities

```tsx
import {
  generateAttachmentId,
  getAttachmentCardState,
  getAttachmentIcon,
  getExtFromContentType,
  getNameWithoutExtension,
  mimeTypesToExtensionLabels,
  isMimeTypeAllowed,
  MAX_UPLOADS_PER_MINUTE,
  ATTACHMENT_COLLAPSE_THRESHOLD,
} from '@epam/ai-dial-attachment-input';

// Check if a file type is permitted (an empty allowlist permits nothing)
const isAllowed = isMimeTypeAllowed(file.type, allowedMimeTypes);

// Convert MIME types to a human-readable extension label string
const label = mimeTypesToExtensionLabels(['image/png', 'application/pdf']);

// Resolve an extension and a Tabler icon from a content type
const ext = getExtFromContentType(file.type);
const Icon = getAttachmentIcon(file.type);

// Derive everything a card needs to render (visual state, type label, preview)
const cardState = getAttachmentCardState(attachment, typeLabels);
```

## Types

Props, labels, colors, typography, and styles interfaces are exported for every
component: `AttachmentCardProps` / `AttachmentCardLabels` /
`AttachmentCardColors` / `AttachmentCardTypography` / `AttachmentCardStyles` /
`AttachmentCardState` / `AttachmentTypeLabels`, `AttachmentTrayProps` /
`AttachmentTrayLabels` / `AttachmentTrayStyles`, `AttachmentGroupProps` and its
label/color/typography/style companions, `FileDndOverlayProps` and its
companions, the `FileAttachment*` row types, and `UseClipboardPasteLabels`.
