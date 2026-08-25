# @epam/ai-dial-sidebar

Resizable sidebar panel shell with a header bar, action slots, and empty/no-results states.

## Overview

`@epam/ai-dial-sidebar` provides the reusable structural shell for every sidebar-style panel in AI DIAL Chat — conversation history, sources, catalog, and any future panels. Without a shared shell, each panel would implement its own header, close button, scroll container, resize handle, empty state, and no-results state independently, leading to visual inconsistencies and duplicated layout code. This library solves that by offering a single `SidebarPanel` wrapper with a 48 px header bar (title plus start/end action slots), a scrollable body, opt-in drag-to-resize with persisted width, and two ready-made states (`PanelEmpty`, `PanelNoResults`) for when the content area has nothing to show. The panel supports both left and right orientation via the `SidebarOrientation` enum so it can be anchored to either edge of the viewport. Feature libraries like `conversation-panel`, `source-panel`, and `catalog` use this shell as their layout foundation, keeping their own focus on domain-specific content rather than chrome.

The shell owns no search field of its own — a panel that needs one renders it in
`children` or in a header action slot, which is why `conversation-panel` and
`source-panel` each pass their own.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-sidebar": "*"
  }
}
```

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`
- `@tabler/icons-react`

## Components

### SidebarPanel

Root container. Renders the header bar and a scrollable content area.
`isOpen`, `orientation`, `labels`, and `children` are required. `onClose` is what
makes the close button appear — omit it to hide the button. With `resizable`, the
handle sits on the edge opposite `orientation`, and width defaults to `360` px
(min `280`, max `600`).

```tsx
import { SidebarPanel, SidebarOrientation } from '@epam/ai-dial-sidebar';

<SidebarPanel
  isOpen={isOpen}
  title="Conversations"
  orientation={SidebarOrientation.Left}
  labels={{ ariaLabel: 'Conversations', closeLabel: 'Close' }}
  leftActions={<CollapseButton />}
  rightActions={<NewChatButton />}
  resizable
  onClose={handleClose}
  onResizeStop={setStoredWidth}
>
  {children}
</SidebarPanel>;
```

### PanelEmpty

Empty-state block shown when a panel has no items at all. Icon defaults to
`IconMessageCircle` at `48` px.

```tsx
import { PanelEmpty } from '@epam/ai-dial-sidebar';
import { IconFolderOff } from '@tabler/icons-react';

<PanelEmpty label="No conversations" icon={IconFolderOff} iconSize={40} />;
```

### PanelNoResults

No-results state shown when a search or filter produces no matches. Icon defaults
to `IconZoomCancel` at `45` px.

```tsx
import { PanelNoResults } from '@epam/ai-dial-sidebar';

<PanelNoResults label="No results" />;
```

## Enums

```tsx
import { SidebarOrientation } from '@epam/ai-dial-sidebar';

SidebarOrientation.Left; // panel anchored to the left edge
SidebarOrientation.Right; // panel anchored to the right edge
```

## Types

```tsx
import type {
  SidebarPanelProps,
  SidebarPanelStyles,
  SidebarPanelColors,
  SidebarPanelLabels,
  SidebarPanelTypography,
  PanelEmptyProps,
  PanelNoResultsProps,
} from '@epam/ai-dial-sidebar';
```
