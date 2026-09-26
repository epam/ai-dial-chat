# @epam/ai-dial-share

## Overview

Provides the `SharePopover` UI component, a scannable `QrCode` view, and the associated share-link types for sharing catalog deployments in AI DIAL Chat. The component is host-agnostic: it receives all runtime data (URL, loading state, error, access levels) via props and calls back via `onAccessChange` and `onClose`. The consuming app is responsible for fetching share-link data, mapping the entity type to `canEditAccess`, and passing translated strings.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-share": "*"
  }
}
```

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-share/styles.css';
```

## Peer Dependencies

- `react` ^19.2.8
- `@epam/ai-dial-ui-kit`
- `@epam/ai-dial-chat-shared`

## Components

### SharePopover

Share popover with a link body and a QR body, plus per-level access control.
`access` is a list, so a link can grant view and edit at once. `url` is
`undefined` while `isLoading` is `true`. Exported as the module's default and as
a named export.

```tsx
import { SharePopover, ShareLinkAccess } from '@epam/ai-dial-share';

<SharePopover
  url={shareLink?.url}
  isLoading={isLoading}
  error={error}
  access={shareLink?.access ?? [ShareLinkAccess.View]}
  canEditAccess={isEditableEntityType}
  onAccessChange={handleAccessChange}
  onClose={handleClose}
  labels={{ title: 'Share' }}
/>;
```

#### QR view actions

The QR body shows **Copy** and **Download** buttons under the code:

- **Copy** writes the QR code to the clipboard as a PNG image. When the browser
  cannot put an image on the clipboard (no `ClipboardItem`, or the write is
  refused), it copies the share URL as text instead. Either way the button
  briefly reads "Copied" and a polite live region announces it.
- **Download** saves the QR code as a PNG file.

Both images are dark on white with a quiet-zone margin, whatever the active
theme, so they stay scannable. They are rasterized from the rendered SVG
through a `data:` image, so the host's Content Security Policy must allow
`data:` in `img-src`; otherwise Copy falls back to the URL text and Download
does nothing.

Override the strings through `labels` — all four are optional:

```tsx
<SharePopover
  {...props}
  labels={{
    qrCopyButtonLabel: 'Copy', // default
    qrCopiedButtonLabel: 'Copied', // default
    qrDownloadButtonLabel: 'Download', // default
    qrDownloadFileName: 'share-qr-code.png', // default
  }}
/>
```

### QrCode

QR rendering of the share link, scannable to open it on another device. Used by
`SharePopover`'s QR body, and exported for hosts that need it standalone. The
standalone component renders the code only — the Copy and Download actions
belong to `SharePopover`. Pass the optional `svgRef` to receive the rendered
`<svg>` element.

```tsx
import { QrCode } from '@epam/ai-dial-share';
import { useRef } from 'react';

const svgRef = useRef<SVGSVGElement>(null);

<QrCode
  value={shareLink.url}
  labels={{ ariaLabel: 'Share link QR code' }}
  svgRef={svgRef}
/>;
```

## Enums

```tsx
import { ShareLinkAccess, SharePopoverView } from '@epam/ai-dial-share';

ShareLinkAccess.View; // 'view'
ShareLinkAccess.Edit; // 'edit'

SharePopoverView.Link; // 'link' — the copyable-link body
SharePopoverView.Qr; // 'qr' — the QR-code body
```

## Types

```tsx
import type {
  SharePopoverProps,
  SharePopoverLabels,
  SharePopoverStyles,
  SharePopoverColors,
  SharePopoverTypography,
  QrCodeProps,
  QrCodeLabels,
  QrCodeStyles,
  QrCodeColors,
  ShareLinkData,
} from '@epam/ai-dial-share';
```

`ShareLinkData` — `{ url: string; expiresInDays: number; access: ShareLinkAccess[] }` —
is the shape the host's share-link seam returns; the popover takes its fields as
individual props rather than the object.

## Public class names

A host embedding this package cannot style it through its CSS-module locals —
they are hashed at build time — nor through DOM order or ARIA attributes, which
are structure and accessibility contracts rather than styling ones. Selected
elements therefore carry a stable public class.

| Key       | Class                | Element                                                                    |
| --------- | -------------------- | -------------------------------------------------------------------------- |
| `popover` | `dial-share-popover` | The popover's `role="dialog"` root, which carries the themed CSS variables |

```tsx
import { SHARE_CLASS } from '@epam/ai-dial-share';

SHARE_CLASS.popover; // 'dial-share-popover'
```

The popover's `aria-label` is its localisable title, so it was never usable as
a selector — this class replaces it.

The classes carry no declarations of their own: nothing in `styles.css`
selects on them, so they change nothing until a host writes a rule. Renaming
one, or moving it to a different element, is a breaking change. The convention
is in [`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

Write host overrides with CSS logical properties (`margin-inline-start`,
`inset-inline-end`) so they keep working under `dir="rtl"`.
