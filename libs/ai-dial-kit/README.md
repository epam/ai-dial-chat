# @epam/ai-dial-kit

UI component primitives for AI DIAL Chat applications.

## Overview

`@epam/ai-dial-kit` is the shared UI component primitives layer for the AI DIAL Chat workspace. It sits between the base design system (`@epam/ai-dial-ui-kit`) and feature-level libraries, providing the small, composable building blocks — buttons, search inputs, tab rows, icon buttons — that appear in many different panels and views. Use this library when you need a standard interactive control that is more opinionated than the raw design-system primitives but should not carry any domain knowledge (no API calls, no app state). All components are built with Tailwind CSS, support RTL layouts via logical properties, and accept standard className overrides for theming.

## Installation

This package is an internal workspace library. Add it as a dependency in your `package.json`:

```json
{
  "dependencies": {
    "@epam/ai-dial-kit": "*"
  }
}
```

## Peer Dependencies

- `react` ^19.0.0
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`

## Components

### FolderPath

Read-only, non-clickable breadcrumb for folder-style path segments: a leading folder icon, a chevron separator mirrored in RTL, and the last segment styled as the current/leaf item. Scrolls horizontally on overflow rather than truncating.

```tsx
import { FolderPath } from '@epam/ai-dial-kit';

<FolderPath segments={['Public', 'Project folder']} />;
```

### SearchBar

Search input field with a leading search icon.

```tsx
import { SearchBar } from '@epam/ai-dial-kit';

<SearchBar
  value={query}
  onChange={setQuery}
  labels={{ placeholder: 'Search...' }}
/>;
```

### Button variants

Three button variants for different visual emphasis levels.

```tsx
import { PrimaryButton, NeutralButton, GhostButton } from '@epam/ai-dial-kit';

<PrimaryButton onClick={handleSave}>Save</PrimaryButton>
<NeutralButton onClick={handleCancel}>Cancel</NeutralButton>
<GhostButton onClick={handleMore}>More</GhostButton>
```

### GhostIconButton

An icon-only button with a ghost (transparent) background.

```tsx
import { GhostIconButton } from '@epam/ai-dial-kit';
import { IconSettings } from '@tabler/icons-react';

<GhostIconButton icon={IconSettings} onClick={handleSettings} />;
```

### TabRow

Horizontal tab navigation component.

```tsx
import { TabRow } from '@epam/ai-dial-kit';

<TabRow
  tabs={[
    { id: 'all', label: 'All' },
    { id: 'favorites', label: 'Favorites' },
  ]}
  activeTab="all"
  onTabChange={setActiveTab}
/>;
```

### GradientCheckIcon

Check icon rendered with a gradient fill, used for selection indicators.

```tsx
import { GradientCheckIcon } from '@epam/ai-dial-kit';

<GradientCheckIcon />;
```
