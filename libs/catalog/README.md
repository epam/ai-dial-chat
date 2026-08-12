# @epam/ai-dial-catalog

Marketplace/catalog component for browsing models, tools, and assistants with search, filtering, sorting, favorites, and detail views.

## Overview

`@epam/ai-dial-catalog` is a self-contained marketplace panel for browsing the AI DIAL entity catalog — models, tools, and assistants. It addresses the challenge of presenting potentially hundreds of items in a performant, filterable, and searchable UI without forcing each app to re-implement pagination, sorting, and details logic. The library supports two view modes (card grid and ag-grid list table), virtualised rendering via `react-window` and ag-grid for large collections, sidebar filters by entity type and topic tags, a favorites section, and a per-item details panel with tabs for API documentation, tool definitions, pricing rows, and usage limits. Use it when an application needs to expose the full DIAL model/tool marketplace or any subset of it, or when building a picker for a specific entity type with consistent UX.

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

### InfoCard

Tinted card showing a catalog item's identity, used to anchor a message to the
item it is about. Defaults to the `Info` surface; pass `Danger` for destructive
messaging.

```tsx
import {
  InfoCard,
  DetailsConfirmationVariant,
} from '@epam/ai-dial-catalog';

<InfoCard item={item} />
<InfoCard item={item} variant={DetailsConfirmationVariant.Danger} />
```

## Enums

```tsx
import {
  CatalogEntityType,
  CatalogSortKey,
  CatalogViewMode,
  CatalogDetailsTab,
  CodeLanguage,
  DetailsConfirmationKind,
  DetailsConfirmationVariant,
} from '@epam/ai-dial-catalog';

CatalogEntityType.Model; // 'MODEL'
CatalogEntityType.Agent; // 'AGENT'
CatalogEntityType.Toolset; // 'TOOLSET'
CatalogEntityType.Prompt; // 'PROMPT'
CatalogEntityType.Skill; // 'SKILL'

CatalogViewMode.Grid; // 'grid'
CatalogViewMode.List; // 'list'

CatalogDetailsTab.About; // 'about'
CatalogDetailsTab.Content; // 'content' — long-form text body (prompts)
```

### Prompt entities

`CatalogEntityType.Prompt` is a display category for reusable text prompts.
Prompt items carry a body rather than a runtime, so the host supplies the text
through `details.promptContent`. The details panel renders it read-only in the
`Content` tab — labelled **Details** by default, overridable through
`detailsTexts.tabContentLabel` — with the item's `description` above it. The
body is selectable text and carries no copy control of its own.

A prompt shows exactly two tabs, `Content` then `Overview`, and never `About`:
its description is already in the Content tab, and its storage metadata belongs
in `overview`, so an About tab would only repeat them. Every other entity type
keeps `About` as its first tab. Omit `promptContent` and the Content tab is
hidden, exactly as with `overview`, `pricing`, `limits`, `api`, and `tools`.

The body is rendered as markdown, and each `{{placeholder}}` token is wrapped in
a `span.cat-prompt-variable` so a template can read apart from its prose.
Placeholders inside fenced code are left alone, since there they are being shown
as literal syntax. The lib ships no colour for that class — style it from the
host stylesheet, or the tokens render like the surrounding text.

```tsx
const promptItem: CatalogItem = {
  id: 'Work/AI/summarize',
  type: CatalogEntityType.Prompt,
  name: 'summarize',
  version: '',
  lastUsed: '2 days ago',
  description: 'Summarize a document',
  folder: ['Personal', 'Work', 'AI'],
  topics: [],
  details: {
    promptContent: { content: '## Original\n\n{{original_email}}' },
    overview: {
      sections: [
        { title: 'Prompt', specs: [{ label: 'Folder', value: 'Work / AI' }] },
      ],
    },
  },
};
```

The lib never learns where a prompt comes from: the body arrives already
resolved, and the host decides every prompt-specific action through the
existing `onFetchDetails` / `onEdit` / `onUseInChat` props.

### Declaring unsupported per-item capabilities

`isUnshareVisible` lets a host hide "Remove from My List" for items whose
backing capability does not exist, without the lib knowing why. It defaults to
**visible** when omitted.

```tsx
<Catalog
  items={items}
  favorites={favorites}
  // Hide "Remove from My List" on prompts — the host's API rejects prompt paths.
  isUnshareVisible={(item) => item.type !== CatalogEntityType.Prompt}
  onUnshare={handleUnshare}
/>
```

`isUnshareVisible` is combined (AND) with the built-in `sharedWithMe`/`isMyApp`
rule, so it can only ever narrow visibility.

## Types

```tsx
import type {
  CatalogItem,
  ApiResource,
  CatalogItemApiDetails,
  CatalogItemPromptContent,
  ToolDefinition,
  PricingRow,
  UsageLimitRow,
} from '@epam/ai-dial-catalog';
```

## Utilities

```tsx
import { filterCatalogItems, sortCatalogItems } from '@epam/ai-dial-catalog';

/*
 * Matches an item's `name`, `description`, or `type` — case-insensitive.
 * Note that a prompt's body is not searched: `details.promptContent` is
 * resolved lazily and is not part of the search index.
 */
const filtered = filterCatalogItems(items, 'gpt');
const sorted = sortCatalogItems(filtered, CatalogSortKey.NameAZ);
```
