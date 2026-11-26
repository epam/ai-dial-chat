# catalog-mobile-browse-settings Specification

## Purpose

Defines how the Catalog's browse controls — view mode, sort order and the source/topic filter — work below the 768px phone-menu breakpoint, where they move from the toolbar into a single browse-settings bottom sheet.

## Requirements

### Requirement: Below the desktop breakpoint the browse controls move into a settings sheet

`TitleRow` (`libs/catalog/src/components/Toolbar/Rows/TitleRow.tsx`) SHALL branch on the phone-menu query (below 768px) from `@epam/ai-dial-chat-shared`.

From 768px:

- The title row holds the Browse title (or `browseHeaderRenderer`) alone.
- The search row renders, in inline order: the search field, the view-mode `SegmentedControl`, the icon-only `SortMenuButton` from `@epam/ai-dial-chat-shared`, and the `Filter` dropdown.
- The sort button is named and tooltipped by `sortLabel` (default `'Sort'`) whichever option is applied. It renders only when `sortOptions` is non-empty.
- The vertical divider that separated the view toggle from the sort is removed.

Below 768px:

- The title row holds the title alone.
- The search row holds the search field and a `GhostIconButton` (`ElementSize.Large`, `IconAdjustmentsHorizontal`) that opens `BrowseSettingsSheet` (`libs/catalog/src/components/Toolbar/BrowseSettingsSheet.tsx`).

This layout applies to every host of `Catalog`'s built-in toolbar, including the "Change agent" window (`apps/chat/src/components/DeploymentSelector/CatalogModal.tsx`).

The settings button SHALL be named by the sheet's `title` label and carry `aria-haspopup="dialog"` and `aria-expanded` reflecting whether the sheet is open. While the "My" filter or any topic is applied, a decorative dot (`aria-hidden`) SHALL sit on the button's top-end corner, coloured by `ToolbarColors.settingsActiveDot` through `--cat-browse-settings-dot` (fallback `--bg-control-accent`).

When the viewport crosses 768px while focus was inside the row, focus SHALL move to the view toggle's first radio (to desktop) or the settings button (to phone), as today.

RTL impact: the search row is a flex row with logical gaps, so the order mirrors under `dir="rtl"`. `IconArrowsSort` is not mirrored.

#### Scenario: A phone shows the settings button instead of the inline controls

- **WHEN** the Catalog renders at a viewport below 768px
- **THEN** no view toggle, sort button or filter dropdown is rendered, and a "Browse settings" button sits next to the search field

#### Scenario: An applied filter is flagged on the button

- **WHEN** the "My" filter or a topic is applied on mobile
- **THEN** the settings button shows the active-filter dot

#### Scenario: Desktop view toggle and sort sit beside the search

- **WHEN** Catalog renders at 1280px with sort options
- **THEN** the search row's controls, in DOM order, are the search input, the `radiogroup` named by `viewToggleLabel`, the button named "Sort", and the filter trigger, and the title row contains no `radiogroup` and no sort button

#### Scenario: Sort trigger does not show the applied order

- **WHEN** Catalog renders with `sortKey` Newest
- **THEN** no button is named "Newest", and opening the "Sort" button shows "Newest" as `aria-checked="true"`

#### Scenario: Tablet browse controls use desktop menus

- **WHEN** Catalog renders at 768, 1024 or 1279px
- **THEN** view, sort and filter use the desktop controls in the search row, while the catalog grid, spacing and modal layout keep their existing responsive rules

### Requirement: The sheet drills into View, Sorting and Filtering pages

`BrowseSettingsSheet` SHALL render the kit `BottomSheet` with pages from the `BrowseSettingsPage` enum (`Root`, `View`, `Sorting`, `Filtering`). The header title is the current page's label; every page except `Root` shows a back button returning to `Root`. Closing the sheet SHALL reset it to `Root`.

- **Root** lists a `menu` of `menuitem` rows, each with an RTL-mirrored chevron: View, Sorting (only when sort options exist), and Filtering. While filters are applied, the Filtering row's description is `formatFilterCount(applied, total)`, where `applied` counts the selected topics plus one for an active "My" filter and `total` is the number of topics plus one.
- **View** lists the grid (`gridView`) and list (`listView`) modes as `menuitemradio` rows with a trailing check on the current mode. Picking one SHALL apply it immediately and close the sheet.
- **Sorting** lists the sort options as `menuitemradio` rows with a trailing check on the active key. Picking one SHALL apply it immediately and close the sheet.
- **Filtering** lists a "My" `menuitemcheckbox` row and, when topics exist, a divider, a Topics section label and one `menuitemcheckbox` row per topic in sorted order. The selection is buffered: opening the page copies the applied state, toggling rows changes only the copy, Apply commits topics and "My" and closes the sheet, Clear commits an empty topic set and "My" off and closes the sheet. Closing without Apply discards the buffered selection. The Clear/Apply footer stays pinned while the list scrolls, and its two buttons split the row in half.

#### Scenario: View and sort apply on pick

- **WHEN** the user opens View and picks List
- **THEN** the Catalog switches to the list view and the sheet closes

#### Scenario: Filters wait for Apply

- **WHEN** the user opens Filtering, checks a topic and closes the sheet
- **THEN** no filter is applied, and reopening Filtering shows the previously applied selection

#### Scenario: Apply commits the buffered filters

- **WHEN** the user checks "My" and a topic on the Filtering page and taps Apply
- **THEN** both filters are applied, the sheet closes, and the Root Filtering row reads the `formatFilterCount` summary next time it opens

#### Scenario: Clear removes every filter

- **WHEN** filters are applied and the user taps Clear on the Filtering page
- **THEN** the topic set is emptied, "My" is turned off and the sheet closes

#### Scenario: No sort options hide the Sorting row

- **WHEN** the Catalog is given no sort options
- **THEN** the Root page lists only View and Filtering

### Requirement: The sheet's texts are host-supplied with English defaults

`BrowseSettingsSheetLabels` (`libs/catalog/src/models/toolbar-props.ts`) SHALL carry `title`, `view`, `sorting`, `filtering`, `gridView`, `listView`, `myApps`, `topics`, `clear`, `apply`, `back`, `close` and `formatFilterCount(selected, total)`. `DEFAULT_BROWSE_SETTINGS_LABELS` (`libs/catalog/src/constants/browse-settings.ts`) supplies the English defaults ("Browse settings", "View", "Sorting", "Filtering", "Cards", "List", "My", "Topics", "Clear", "Apply", "Back", "Close", `` `${selected} of ${total}` ``).

`CatalogTitles.browseSettings?: Partial<BrowseSettingsSheetLabels>` SHALL reach the sheet through `Toolbar`'s `browseSettingsLabels`. `TitleRow` merges, in increasing precedence: the defaults, `filterMyAppsLabel` / `filterTopicsLabel` for `myApps` / `topics`, then `browseSettingsLabels`. The desktop `Filter` reuses `browseSettingsLabels.clear` / `apply` for its own footer.

`CatalogView` SHALL translate every label: the `catalog.browseSettings.*` translation keys for the sheet-specific texts (title, view, sorting, filtering, cards, list, my, topics, filterCount) and the shared `ButtonsI18nKeys.Clear`, `ButtonsI18nKeys.Apply`, `ButtonsI18nKeys.Close` and `NavigationI18nKeys.Back` for the generic ones.

#### Scenario: Partial overrides keep the remaining defaults

- **WHEN** a host passes `browseSettings: { title: 'Réglages', view: 'Affichage' }`
- **THEN** the sheet uses those two strings and the English defaults for every other label

### Requirement: The full-screen catalog pickers fill the phone screen

`PromptCatalogModal` (`apps/chat/src/components/PromptSelector/PromptCatalogModal.tsx`) and `SkillCatalogModal` (`libs/skills/src/components/SkillCatalogModal/SkillCatalogModal.tsx`) SHALL keep their large centred popup on desktop and, below the desktop breakpoint, drop the overlay padding and fill the viewport edge to edge with no rounded corners, so the embedded Catalog and its browse-settings sheet get the whole screen.

#### Scenario: The prompt picker is full-screen on a phone

- **WHEN** the prompt catalog modal opens at a 375px-wide viewport
- **THEN** the popup spans the full viewport width and height with no outer padding
