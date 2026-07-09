# @epam/ai-dial-sidebar

Resizable sidebar panel container with a header, search input, and empty/no-results states.

## Overview

This library provides the structural shell used by sidebar-style panels throughout AI DIAL Chat (conversation history, sources, catalog, etc.). It handles responsive resizing, optional search, a configurable header with action buttons, and built-in empty and no-results states.

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

Root container. Renders the header, optional search bar, and a scrollable content area.

```tsx
import { SidebarPanel, SidebarOrientation } from '@epam/ai-dial-sidebar';
import type { SidebarPanelProps } from '@epam/ai-dial-sidebar';

<SidebarPanel
  title="Conversations"
  orientation={SidebarOrientation.Left}
  onClose={handleClose}
>
  {children}
</SidebarPanel>;
```

### SearchInput

Standalone search field used inside sidebars.

```tsx
import { SearchInput } from '@epam/ai-dial-sidebar';

<SearchInput
  value={query}
  onChange={setQuery}
  placeholder="Search conversations..."
/>;
```

### PanelEmpty

Empty-state component shown when a panel has no items to display.

```tsx
import { PanelEmpty } from '@epam/ai-dial-sidebar';

<PanelEmpty
  title="No conversations"
  description="Start a new chat to see it here."
/>;
```

### PanelNoResults

No-results state shown when a search or filter returns nothing.

```tsx
import { PanelNoResults } from '@epam/ai-dial-sidebar';

<PanelNoResults query={searchQuery} />;
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
  SearchInputProps,
  PanelEmptyProps,
  PanelNoResultsProps,
} from '@epam/ai-dial-sidebar';
```
