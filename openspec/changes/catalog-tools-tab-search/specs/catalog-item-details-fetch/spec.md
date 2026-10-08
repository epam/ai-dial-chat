## ADDED Requirements

### Requirement: The Tools tab offers a search field and a tool count

`Tools` (`libs/catalog/src/components/Details/TabsContent/Tools/Tools.tsx`, public as `ToolsTab`) SHALL render, above the tool list, whenever `tools` is defined:

- a search field (ui-kit `Search`) whose placeholder and accessible name are `labels.searchPlaceholder` (default `'Search...'`) and whose clear button is named `labels.searchClearLabel` (default `'Clear search'`);
- the text `labels.toolCount(n)` (default `` `${n} tools` ``), where `n` is the number of tools currently shown, in a `role="status"` polite live region.

The list SHALL show only the tools whose `name` or `description` contains the trimmed search query, ignoring case; with an empty query every tool shows. When a non-empty query matches no tool, the tab SHALL show `labels.noResults` (default `'No results found'`).

`DetailsPanel` SHALL forward `ItemDetailsTexts.toolsSearchPlaceholder`, `toolsSearchClearLabel`, `toolsCountLabel` and `toolsNoResultsLabel` to these labels, leaving the defaults in place for any it is not given. The chat app's catalog SHALL pass translated strings, using `catalog.details.toolCount` (pluralised) for the count.

The tab SHALL stay presentation-only: the query is local state and no string is read from i18n inside the lib.

#### Scenario: The tab shows the total and a search field

- **WHEN** `ToolsTab` renders a toolset with 27 tools and an empty query
- **THEN** a search field labelled "Search..." is shown, all 27 tools are listed, and the status reads "27 tools"

#### Scenario: Search narrows by name or description

- **WHEN** the user types "NOTION" into the search field
- **THEN** only tools whose name or description contains "notion" (any case) are listed, and the status reports how many

#### Scenario: Nothing matches

- **WHEN** the query matches no tool
- **THEN** no tool is listed, the status reads "0 tools", and "No results found" is shown

#### Scenario: Host-supplied strings

- **WHEN** `DetailsPanel` receives `texts.toolsSearchPlaceholder: 'Rechercher'` and a `texts.toolsCountLabel` returning "1 outil" for one tool
- **THEN** the Tools tab's search field is labelled "Rechercher" and its count uses the host's function, while unset strings keep their English defaults
