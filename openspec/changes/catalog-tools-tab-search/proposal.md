## Why

A toolset's Tools tab lists every tool with no way to find one and no indication of how many there are. Toolsets routinely expose dozens of tools (Notion, Figma), so the list is hard to scan. The design shows a search field and a tool count above the list. The Quick App editor (ai-dial-quickapps-frontend, issue #231) renders the same `ToolsTab` from `@epam/ai-dial-catalog`, so the gap shows in both apps.

## What Changes

- **`Tools` / `ToolsTab` (`libs/catalog/src/components/Details/TabsContent/Tools/Tools.tsx`)** renders, above the list:
  - a ui-kit `Search` field that narrows the list to tools whose name or description contains the trimmed query, ignoring case;
  - a polite `role="status"` count of the tools shown;
  - an empty state when a non-empty query matches no tool.
- **`ToolsLabels`** gains `searchPlaceholder`, `searchClearLabel`, `toolCount(count)` and `noResults`, with English defaults (`'Search...'`, `'Clear search'`, `` `${count} tools` ``, `'No results found'`).
- **`ToolsProps`** gains `countClassName` (default `'dial-tiny-text'`).
- **`ItemDetailsTexts`** gains `toolsSearchPlaceholder`, `toolsSearchClearLabel`, `toolsCountLabel` and `toolsNoResultsLabel`, which `DetailsPanel` forwards to the tab. **`ItemDetailsColors`** gains `toolsCountText` (`--cat-tools-count-text`).
- **Chat app:** `CatalogView` passes translated strings — `basic.searchPlaceholder`, `basic.clearSearch`, `basic.noResults`, and a new pluralised `catalog.details.toolCount`.
- **README:** `libs/catalog/README.md` documents the new labels.

## Impact

- `libs/catalog` — additive props; the Tools tab output gains the search/count header.
- `apps/chat` — `CatalogView` details texts, `en.json`, `translation-keys.ts`.
- ai-dial-quickapps-frontend picks the feature up on its next chat-libs bump and passes its own translated `labels.tools`.
