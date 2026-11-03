## MODIFIED Requirements

### Requirement: Below the desktop breakpoint the browse controls move into a settings sheet

`TitleRow` (`libs/catalog/src/components/Toolbar/Rows/TitleRow.tsx`) SHALL branch on the new phone-menu query (below 768px) from `@epam/ai-dial-chat-shared`:

- from 768px it renders the view-mode `SegmentedControl` and the sort `ButtonDropdown` next to the Browse title, and the `Filter` dropdown next to the search field;
- below 768px the title row holds the title alone, and the `Filter` is replaced by a `GhostIconButton` (`ElementSize.Large`, `IconAdjustmentsHorizontal`) that opens `BrowseSettingsSheet` (`libs/catalog/src/components/Toolbar/BrowseSettingsSheet.tsx`).

The settings button SHALL be named by the sheet's `title` label and carry `aria-haspopup="dialog"` and `aria-expanded` reflecting whether the sheet is open. While the "My" filter or any topic is applied, a decorative dot (`aria-hidden`) SHALL sit on the button's top-end corner, coloured by `ToolbarColors.settingsActiveDot` through `--cat-browse-settings-dot` (fallback `--bg-control-accent`).

#### Scenario: A phone shows the settings button instead of the inline controls

- **WHEN** the Catalog renders at a viewport below 768px
- **THEN** no view toggle, sort dropdown or filter dropdown is rendered, and a "Browse settings" button sits next to the search field

#### Scenario: An applied filter is flagged on the button

- **WHEN** the "My" filter or a topic is applied on mobile
- **THEN** the settings button shows the active-filter dot

#### Scenario: Tablet browse controls use desktop menus
- **WHEN** Catalog renders at 768, 1024 or 1279px
- **THEN** view, sort and filter use existing desktop controls while catalog grid, spacing and modal layout keep their existing responsive rules
