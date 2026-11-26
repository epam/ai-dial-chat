## MODIFIED Requirements

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
