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

## Peer Dependencies

- `react` ^19.0.0
- `@tabler/icons-react` ^3.0.0
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

### QrCode

QR rendering of the share link, scannable to open it on another device. Used by
`SharePopover`'s QR body, and exported for hosts that need it standalone.

```tsx
import { QrCode } from '@epam/ai-dial-share';

<QrCode value={shareLink.url} labels={{ ariaLabel: 'Share link QR code' }} />;
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
  SharePopoverTypography,
  QrCodeProps,
  QrCodeLabels,
  QrCodeStyles,
  ShareLinkData,
} from '@epam/ai-dial-share';
```

`ShareLinkData` — `{ url: string; expiresInDays: number; access: ShareLinkAccess[] }` —
is the shape the host's share-link seam returns; the popover takes its fields as
individual props rather than the object.
