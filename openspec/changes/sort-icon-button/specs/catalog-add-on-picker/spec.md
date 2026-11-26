## ADDED Requirements

### Requirement: The catalog picker sorts through the icon-only sort button

`CatalogPickerModal` (`libs/catalog/src/components/CatalogPickerModal/CatalogPickerModal.tsx`), which `AddOnCatalogModal` renders, SHALL render its sort control as the `SortMenuButton` from `@epam/ai-dial-chat-shared`, at the inline end of the heading row. The control has these properties:

- It is named and tooltipped by `labels.sort` (default `'Sort'`) whichever option is applied, and shows no visible text.
- Its menu lists Recently Updated, Newest and Name A-Z (`labels.sortUpdated`, `labels.sortNewest`, `labels.sortNameAZ`), with the applied one marked `aria-checked="true"`.
- Choosing an option re-sorts the listed rows exactly as before.

The picker's sort state stays local `useState`, starting at `CatalogSortKey.RecentlyUpdated`. The `labels.sort` JSDoc SHALL describe it as the sort button's accessible name and tooltip.

**i18n:** no new keys; hosts already pass `labels.sort`. **RTL:** the glyph is not mirrored.

#### Scenario: Picker sort trigger is icon-only

- **WHEN** the picker opens with `labels.sort` "Sort"
- **THEN** the heading row holds one button named "Sort" with no visible text, and no button is named "Recently Updated"

#### Scenario: Picking an order re-sorts the rows

- **WHEN** the user opens "Sort" and activates "Name A-Z"
- **THEN** the rows are listed by name, and reopening the menu shows "Name A-Z" checked
