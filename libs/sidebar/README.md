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

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-sidebar/styles.css';
```

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`

## Components

### SidebarPanel

Root container. Renders the header bar and a scrollable content area.
`isOpen`, `orientation`, `labels`, and `children` are required. `onClose` is what
makes the close button appear — omit it to hide the button. With `resizable`, the
handle sits on the edge opposite `orientation`, and width defaults to `360` px
(min `280`, max `600`).

By default the panel opens and closes by animating its layout width, so it pushes
the content it sits beside. Pass `isOverlay` when the host positions the panel
_over_ the content instead (a mobile drawer, for example): the panel then keeps
its full width in both states and slides in and out of the `orientation` edge,
which keeps its content from reflowing mid-animation. Positioning stays the
host's job — `isOverlay` only changes how the panel animates.

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

The header bar is `h-12` and its trailing actions sit in one cluster. Both
take a class through `styles`, merged after the panel's own utilities, so a
`h-*` or `gap-*` you pass wins over the default without `!important`:

```tsx
<SidebarPanel
  isOpen={isOpen}
  title="Conversations"
  orientation={SidebarOrientation.Left}
  labels={{ ariaLabel: 'Conversations', closeLabel: 'Close' }}
  rightActions={<NewChatButton />}
  styles={{
    headerClassName: 'h-[64px]',
    headerActionsClassName: 'gap-2',
  }}
>
  {children}
</SidebarPanel>
```

### PanelEmpty

Empty-state block shown when a panel has no items at all.

```tsx
import { PanelEmpty } from '@epam/ai-dial-sidebar';

<PanelEmpty label="No conversations" />;
```

### PanelNoResults

No-results state shown when a search or filter produces no matches.

```tsx
import { PanelNoResults } from '@epam/ai-dial-sidebar';

<PanelNoResults label="No results" />;
```

## Public class names

The panel chrome carries stable `dial-sb-*` classes in addition to its internal
classes. Target those instead of `[role='complementary']` and its
`> div:nth-child(n)` descendants — the role is an accessibility contract, not a
styling one, and the child order changes without notice. The names are exported
so you never hardcode them:

```tsx
import { SIDEBAR_CLASS } from '@epam/ai-dial-sidebar';

SIDEBAR_CLASS.aside; // 'dial-sb-aside'
```

| Class            | Element                                    |
| ---------------- | ------------------------------------------ |
| `dial-sb-aside`  | The panel's `<aside role="complementary">` |
| `dial-sb-header` | The 48 px header bar rendered by `Header`  |

These classes carry no declarations of their own, so they change nothing until
you style them, and they are additive to the `className`, `headerClassName`, and
`styles` props, which keep working exactly as before.

A class on `.dial-sb-header` competes at equal specificity with the header's own
`h-12` utility, so reach for `styles.headerClassName` when you are replacing a
utility the panel already sets and keep the class for everything else.

`dial-sb-aside` is on the region, **not** on the wrapper around it. The wrapper
is where `styles.className` lands, which is how the libs built on this panel
mark themselves — [`@epam/ai-dial-attachment-canvas`](../attachment-canvas/README.md)
with `dial-attachment-canvas-panel` and
[`@epam/ai-dial-source-panel`](../source-panel/README.md) with
`dial-source-panel-panel`. Size or position the wrapper, and descend from it to
reach the region:

```css
.dial-attachment-canvas-panel {
  inline-size: 720px;
}

.dial-attachment-canvas-panel .dial-sb-aside {
  background: var(--bg-layer-base);
}
```

### Replacing fragile selectors

| Instead of                                 | Use               |
| ------------------------------------------ | ----------------- |
| `[role='complementary']`                   | `.dial-sb-aside`  |
| `[role='complementary'] > div:first-child` | `.dial-sb-header` |

### Stability

A `dial-sb-*` class is public API: renaming it, removing it, or moving it to a
different element is a breaking change, announced in the release notes and
recorded here with its replacement. The element itself stays free — its Tailwind
utilities, its CSS-module class, and its position in the DOM may all change.

Your own overrides are responsible for direction: the class names are
direction-agnostic and identical under `dir="rtl"`, so use CSS logical
properties (`border-inline-end`, `inset-inline-start`) rather than physical ones.

The full convention is in
[`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

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
