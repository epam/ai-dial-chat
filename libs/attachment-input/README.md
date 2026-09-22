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

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-attachment-input/styles.css';
```

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`

## Components

### AttachmentCard

Displays a single attachment with its name, status, and actions. Every callback receives the attachment `id`. Passing `searchQuery` highlights matches in the file name.

Each action the card renders — download, retry, open-in-new-tab, remove — gets its own accessible name from `labels`, so pass every label whose action the card can show. They are laid out as one row in the tile's corner.

```tsx
import { AttachmentCard } from '@epam/ai-dial-attachment-input';

<AttachmentCard
  attachment={attachment}
  searchQuery={searchQuery}
  onRemove={handleRemove}
  onRetry={handleRetry}
  onDownload={handleDownload}
  isSelected={attachment.id === selectedAttachmentId}
  labels={{
    removeLabel: 'Remove attachment',
    retryLabel: 'Retry upload',
    openInNewTabLabel: 'Open in new tab',
    downloadLabel: 'Download attachment',
    uploadingLabel: 'Uploading',
  }}
/>;
```

### AttachmentTray

Renders the list of in-progress attachments above the composer.

While a file's upload is in flight its tile carries `aria-busy` and renders an
indeterminate `role="progressbar"` named by `labels.uploadingLabel` (default
`'Uploading'`), so the state is reachable without sight of the spinner. Pass a
translated string.

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

`styles.className` lands on the tray row and `styles.card` carries an
`AttachmentCardStyles` through to every tile, so a host sizes or restyles the
tiles through the tray it already renders instead of a descendant selector on
`dial-ai-attachment-tile`:

```tsx
<AttachmentTray
  attachments={attachments}
  onRemove={handleRemove}
  styles={{
    className: 'gap-3',
    card: {
      className: 'size-[120px]',
      typography: { metaClassName: 'dial-tiny-text' },
      colors: { border: 'var(--stroke-tertiary)' },
    },
  }}
/>
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

`screenshotName` is a template, not the final name: the paste timestamp is inserted before the extension (`Screenshot 2026-09-14 09-05-03.png`), and a paste carrying several images appends the item's position, so each pasted image is stored under its own name.

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

## Public class names

Every tray and tile element a host is likely to restyle carries a stable
`dial-ai-*` class in addition to its internal classes. Target those instead of
hashed CSS-module names, DOM order, or ARIA attributes — all three change
without notice. The names are exported so you never hardcode them:

```tsx
import { ATTACHMENT_INPUT_CLASS } from '@epam/ai-dial-attachment-input';

ATTACHMENT_INPUT_CLASS.tile; // 'dial-ai-attachment-tile'
```

| Class                              | Element                                                   |
| ---------------------------------- | --------------------------------------------------------- |
| `dial-ai-attachment-tray`          | The tray's `role="list"` root                             |
| `dial-ai-attachment-tray-item`     | Each `role="listitem"` wrapper in the tray                |
| `dial-ai-attachment-tile`          | The square tile, for both image and non-previewable files |
| `dial-ai-attachment-tile-selected` | The tile when selected, **additive** to the tile class    |
| `dial-ai-attachment-tile-name`     | The tile's filename element                               |
| `dial-ai-attachment-tile-type`     | The tile's type and size row                              |
| `dial-ai-attachment-tile-action`   | Every corner action: download, retry, open-link, remove   |

A selected tile carries both `dial-ai-attachment-tile` and
`dial-ai-attachment-tile-selected`, so one rule can style all tiles and a second
can style the selected case. An empty tray renders nothing at all, so no class
is emitted.

These classes carry no declarations of their own, so they change nothing until
you style them.

### Replacing fragile selectors

| Instead of                                        | Use                                       |
| ------------------------------------------------- | ----------------------------------------- |
| `[role='list'][aria-label='Attached files']`      | `.dial-ai-attachment-tray`                |
| `[role='listitem']`                               | `.dial-ai-attachment-tray-item`           |
| `[class*='_tile_']`                               | `.dial-ai-attachment-tile`                |
| `[class*='_selected_']`                           | `.dial-ai-attachment-tile-selected`       |
| `[class*='_nameText_']` / `[class*='_typeText_']` | `.dial-ai-attachment-tile-name` / `-type` |
| `[class*='_actionButton_']`                       | `.dial-ai-attachment-tile-action`         |

The `aria-label` selector deserves a specific warning: the tray's label is
localisable through `labels.ariaLabel`, so selecting by `'Attached files'`
breaks the moment your app translates it. Never use an ARIA attribute as a
styling hook.

Hover-reveal for the corner actions still comes from the tile's
`group/attachment-tile` and the actions'
`group-hover/attachment-tile:opacity-100` utilities. Those are Tailwind
utilities in this package's JSX, not rules in its stylesheet, so they only
apply when your own Tailwind build scans this package.

### Stability

A `dial-ai-*` class is public API: renaming it, removing it, or moving it to a
different element is a breaking change, announced in the release notes and
recorded here with its replacement. The element itself stays free — its Tailwind
utilities, its CSS-module class, and its position in the DOM may all change.

Your own overrides are responsible for direction: the class names are
direction-agnostic and identical under `dir="rtl"`, so use CSS logical
properties (`margin-inline-start`, `inset-inline-end`) rather than physical ones.

The full convention — naming grammar, why not BEM, and the rules these classes
follow — is in
[`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

## Types

Props, labels, colors, typography, and styles interfaces are exported for every
component: `AttachmentCardProps` / `AttachmentCardLabels` /
`AttachmentCardColors` / `AttachmentCardTypography` / `AttachmentCardStyles` /
`AttachmentCardState` / `AttachmentTypeLabels`, `AttachmentTrayProps` /
`AttachmentTrayLabels` / `AttachmentTrayStyles`, `AttachmentGroupProps` and its
label/color/typography/style companions, `FileDndOverlayProps` and its
companions, the `FileAttachment*` row types, and `UseClipboardPasteLabels`.
