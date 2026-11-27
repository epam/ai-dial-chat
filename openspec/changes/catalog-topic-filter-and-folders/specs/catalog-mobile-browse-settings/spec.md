## MODIFIED Requirements

### Requirement: Below the desktop breakpoint the browse controls move into a settings sheet

`TitleRow` (`libs/catalog/src/components/Toolbar/Rows/TitleRow.tsx`) SHALL branch on the phone-menu query (below 768px) from `@epam/ai-dial-chat-shared`.

From 768px:

- The title row holds the folder heading (`CatalogFolderHeader`, or `browseHeaderRenderer`) and the Folders button.
- The search row renders, in inline order:
  - the search field;
  - the view-mode `SegmentedControl`;
  - the icon-only `SortMenuButton` from `@epam/ai-dial-chat-shared`;
  - the icon-only `Filter` trigger.
- The sort button is named and tooltipped by `sortLabel` (default `'Sort'`) whichever option is applied. It renders only when `sortOptions` is non-empty.
- The vertical divider that separated the view toggle from the sort is removed.

Below 768px:

- The title row holds the folder heading and the round folders button.
- The search row holds the search field and a `GhostIconButton` (`ElementSize.Large`, `IconAdjustmentsHorizontal`) that opens `BrowseSettingsSheet` (`libs/catalog/src/components/Toolbar/BrowseSettingsSheet.tsx`).

On every breakpoint, the applied-topic tags (`AppliedTopicTags`) render below the search row.

This layout applies to every host of `Catalog`'s built-in toolbar, including the "Change agent" window (`apps/chat/src/components/DeploymentSelector/CatalogModal.tsx`).

The settings button:

- is named by the sheet's `title` label;
- carries `aria-haspopup="dialog"`, and `aria-expanded` reflecting whether the sheet is open;
- shows a decorative dot (`aria-hidden`) on its top-end corner while any topic is applied. The dot is coloured by `ToolbarColors.settingsActiveDot` through `--cat-browse-settings-dot`, with the fallback `--bg-control-accent`.

A folder selection does not light the dot, because the breadcrumb already shows it.

When the viewport crosses 768px while focus was inside the row, focus SHALL move to the view toggle's first radio (to desktop) or to the settings button (to phone), as today.

RTL impact: the search row is a flex row with logical gaps, so the order mirrors under `dir="rtl"`. `IconArrowsSort` is not mirrored.

#### Scenario: A phone shows the settings button instead of the inline controls

- **WHEN** the Catalog renders at a viewport below 768px
- **THEN** no view toggle, sort button or filter dropdown is rendered, and a "Browse settings" button sits next to the search field

#### Scenario: An applied filter is flagged on the button

- **WHEN** a topic is applied on mobile
- **THEN** the settings button shows the active-filter dot

#### Scenario: Desktop view toggle and sort sit beside the search

- **WHEN** Catalog renders at 1280px with sort options
- **THEN** the search row's controls, in DOM order, are the search input, the `radiogroup` named by `viewToggleLabel`, the button named "Sort", and the button named "Filter by topic", and the title row contains no `radiogroup` and no sort button

#### Scenario: Sort trigger does not show the applied order

- **WHEN** Catalog renders with `sortKey` Newest
- **THEN** no button is named "Newest", and opening the "Sort" button shows "Newest" as `aria-checked="true"`

#### Scenario: Tablet browse controls use desktop menus

- **WHEN** Catalog renders at 768, 1024 or 1279px
- **THEN** view, sort and filter use the desktop controls in the search row, while the catalog grid, spacing and modal layout keep their existing responsive rules

#### Scenario: Phone shows applied topics as tags

- **WHEN** two topics are applied at a 375px viewport
- **THEN** two removable tags render below the search row

### Requirement: The sheet drills into View, Sorting and Filtering pages

`BrowseSettingsSheet` SHALL render the kit `BottomSheet` with pages from the `BrowseSettingsPage` enum (`Root`, `View`, `Sorting`, `Filtering`). The header title is the current page's label, and every page except `Root` shows a back button that returns to `Root`. Closing the sheet SHALL reset it to `Root`.

- **Root** lists a `menu` of `menuitem` rows, each with an RTL-mirrored chevron: View, Sorting (only when sort options exist) and Filtering. While topics are applied, the Filtering row's description is `formatFilterCount(applied, total)`, where `applied` is the number of selected topics and `total` is the number of topics.
- **View** lists the grid (`gridView`) and list (`listView`) modes as `menuitemradio` rows, with a trailing check on the current mode. Picking one SHALL apply it immediately and close the sheet.
- **Sorting** lists the sort options as `menuitemradio` rows, with a trailing check on the active key. Picking one SHALL apply it immediately and close the sheet.
- **Filtering** opens with a section header row: the Topics label, and a `LinkButton` labelled `clearAll` at the inline end, disabled while no topic is applied. Below it, one `menuitemcheckbox` row per topic in sorted order.
  - Toggling a row SHALL apply the change immediately through `onFiltersChange`. The page stays open.
  - "Clear all" SHALL apply an empty topic set immediately.
  - The page has no footer and no Clear or Apply buttons. The rows scroll under the fixed header.
  - The page has no "My" row.

#### Scenario: View and sort apply on pick

- **WHEN** the user opens View and picks List
- **THEN** the Catalog switches to the list view and the sheet closes

#### Scenario: Topics apply on toggle

- **WHEN** the user opens Filtering and checks a topic
- **THEN** the topic is applied at once, its tag appears behind the sheet, and the Filtering page stays open

#### Scenario: Clear all removes every topic

- **WHEN** topics are applied and the user taps "Clear all" on the Filtering page
- **THEN** the topic set is emptied and the page stays open

#### Scenario: The Root row counts topics only

- **WHEN** 2 of 47 topics are applied and the user returns to Root
- **THEN** the Filtering row reads the `formatFilterCount(2, 47)` summary

#### Scenario: No sort options hide the Sorting row

- **WHEN** the Catalog is given no sort options
- **THEN** the Root page lists only View and Filtering

### Requirement: The sheet's texts are host-supplied with English defaults

`BrowseSettingsSheetLabels` (`libs/catalog/src/models/toolbar-props.ts`) SHALL carry `title`, `view`, `sorting`, `filtering`, `gridView`, `listView`, `topics`, `clearAll`, `back`, `close` and `formatFilterCount(selected, total)`.

`DEFAULT_BROWSE_SETTINGS_LABELS` (`libs/catalog/src/constants/browse-settings.ts`) supplies the English defaults: "Browse settings", "View", "Sorting", "Filtering", "Cards", "List", "Topics", "Clear all", "Back", "Close" and `` `${selected} of ${total}` ``.

`CatalogTitles.browseSettings?: Partial<BrowseSettingsSheetLabels>` SHALL reach the sheet through `Toolbar`'s `browseSettingsLabels`. `TitleRow` merges, in increasing precedence:

1. the defaults;
2. `filterTopicsLabel` for `topics` and `filterClearAllLabel` for `clearAll`;
3. `browseSettingsLabels`.

`CatalogView` SHALL translate every label:

- the sheet-specific texts (title, view, sorting, filtering, cards, list, topics, filterCount) with the `catalog.browseSettings.*` translation keys;
- `clearAll` with the `catalog.filter.clearAll` translation key;
- the generic ones with the shared `ButtonsI18nKeys.Close` and `NavigationI18nKeys.Back`.

#### Scenario: Partial overrides keep the remaining defaults

- **WHEN** a host passes `browseSettings: { title: 'Réglages', view: 'Affichage' }`
- **THEN** the sheet uses those two strings and the English defaults for every other label
