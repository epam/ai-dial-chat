# @epam/ai-dial-sidebar

Resizable sidebar panel container with a header, search input, and empty/no-results states.

## Overview

`@epam/ai-dial-sidebar` provides the reusable structural shell for every sidebar-style panel in AI DIAL Chat — conversation history, sources, catalog, and any future panels. Without a shared shell, each panel would implement its own header, close button, search bar, scroll container, empty state, and no-results state independently, leading to visual inconsistencies and duplicated layout code. This library solves that by offering a single `SidebarPanel` wrapper that handles responsive sizing, an optional integrated `SearchInput`, a configurable header with a title and action slots, and two ready-made states (`PanelEmpty`, `PanelNoResults`) for when the content area has nothing to show. The panel supports both left and right orientation via the `SidebarOrientation` enum so it can be anchored to either edge of the viewport. Feature libraries like `conversation-panel`, `source-panel`, and `catalog` use this shell as their layout foundation, keeping their own focus on domain-specific content rather than chrome.

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
- `@epam/ai-dial-kit`
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
