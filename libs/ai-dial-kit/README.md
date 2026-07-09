# @epam/ai-dial-kit

UI component primitives for AI DIAL Chat applications.

## Overview

This library provides a set of low-level, reusable UI components used across the AI DIAL Chat workspace. Components are built on top of `@epam/ai-dial-ui-kit` and styled with Tailwind CSS.

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

### SearchBar

Search input field with a leading search icon.

```tsx
import { SearchBar } from '@epam/ai-dial-kit';

<SearchBar value={query} onChange={setQuery} placeholder="Search..." />;
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
