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

