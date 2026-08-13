# @epam/ai-dial-share

## Overview

Provides the `SharePopover` UI component and associated share-link types for sharing catalog deployments in AI DIAL Chat. The component is host-agnostic: it receives all runtime data (URL, loading state, access level) via props and calls back via `onAccessChange` and `onClose`. The consuming app is responsible for fetching share-link data and passing translated strings.

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

Quick share popover: link copy, QR placeholder, and per-type access-level control.

```tsx
import { SharePopover, ShareLinkAccess } from '@epam/ai-dial-share';

<SharePopover
  url="https://chat.dialx.ai/marketplace/share/my-app"
  isLoading={false}
  error={null}
  expiresInDays={3}
  access={ShareLinkAccess.View}
  canEditAccess={true}
  onAccessChange={(access) => setAccess(access)}
  onClose={() => setOpen(false)}
/>;
```

### QrPlaceholder

Placeholder rendered in the QR tab while a real QR-code generator is not yet wired in.

## Types

- `ShareLinkAccess` — `view | edit`
- `SharePopoverView` — `link | qr`
- `ShareLinkData` — `{ url, expiresInDays, access }`
