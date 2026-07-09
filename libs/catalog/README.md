# @epam/ai-dial-catalog

Marketplace/catalog component for browsing models, tools, and assistants with search, filtering, sorting, favorites, and detail views.

## Overview

The catalog library provides a full-featured browsable marketplace panel. It supports both grid and list view modes, virtual scrolling for large collections, per-item detail panels with API documentation, pricing, and usage limits.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-catalog": "*"
  }
}
```

## Peer Dependencies

- `react`
- `@epam/ai-dial-ui-kit`
- `@epam/ai-dial-kit`
- `@epam/ai-dial-chat-shared`
- `@tabler/icons-react`
- `ag-grid-community@35.3.0`

## Components

### Catalog

Root component. Manages all state internally (search, filters, view mode, selected item) and renders the toolbar and content area.

```tsx
import { Catalog } from '@epam/ai-dial-catalog';

<Catalog items={catalogItems} onSelect={handleSelect} />;
```

### CardGrid

Virtualized grid view of catalog cards.

```tsx
import { CardGrid } from '@epam/ai-dial-catalog';

<CardGrid items={filteredItems} onSelect={handleSelect} />;
```

### ListView

Table view powered by ag-grid with column sorting and row selection.

```tsx
import { ListView } from '@epam/ai-dial-catalog';

<ListView items={filteredItems} onSelect={handleSelect} />;
```

### Favorites

Renders the user's favorited items in a dedicated section.

```tsx
import { Favorites, FavoriteCard } from '@epam/ai-dial-catalog';

<Favorites items={favoriteItems} onSelect={handleSelect} />;
```

### Filter / TopicTag / EntityBadge

Filter sidebar and label components.

```tsx
import { Filter, TopicTag, EntityBadge } from '@epam/ai-dial-catalog';

<Filter filters={activeFilters} onChange={setFilters} />
<EntityBadge type={CatalogEntityType.Model} />
<TopicTag label="Vision" />
```

## Enums

```tsx
import {
  CatalogEntityType,
  CatalogSortKey,
  CatalogViewMode,
  CatalogDetailsTab,
  CodeLanguage,
  EntityTag,
} from '@epam/ai-dial-catalog';

CatalogEntityType.Model; // 'model'
CatalogEntityType.Tool; // 'tool'
CatalogEntityType.Assistant; // 'assistant'

CatalogViewMode.Grid; // 'grid'
CatalogViewMode.List; // 'list'
```

## Types

```tsx
import type {
  CatalogItem,
  CatalogItemSummary,
  ApiResource,
  CatalogItemApiDetails,
  ToolDefinition,
  PricingRow,
  UsageLimitRow,
} from '@epam/ai-dial-catalog';
```

## Utilities

```tsx
import { filterCatalogItems, sortCatalogItems } from '@epam/ai-dial-catalog';

const filtered = filterCatalogItems(items, {
  search: 'gpt',
  types: [CatalogEntityType.Model],
});
const sorted = sortCatalogItems(filtered, CatalogSortKey.Name);
```
