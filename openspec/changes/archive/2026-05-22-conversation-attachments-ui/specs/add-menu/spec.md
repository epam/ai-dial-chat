## ADDED Requirements

### Requirement: Add menu button

The `Input` component SHALL include a `+` button (`GhostIconButton`, 40×40, icon 18px `BASE_ICON_SIZE`) that opens a `DialDropdown` positioned below the trigger (`placement="bottom-start"`). The menu SHALL list available attachment and content sources. In phase 1 it contains a single item: "Attach file".

#### Scenario: Plus button opens dropdown

- **WHEN** the user clicks the `+` button
- **THEN** a dropdown menu appears below it

#### Scenario: Dropdown closes on outside click

- **WHEN** the dropdown is open and the user clicks outside it
- **THEN** the dropdown closes

### Requirement: Add menu accessibility

The `+` trigger button SHALL be keyboard accessible and labelled for screen readers.

#### Scenario: Plus button aria-label

- **WHEN** the `+` button is rendered
- **THEN** it has `aria-label` sourced from i18n key `conversationInput.addMenu.ariaLabel`

#### Scenario: Plus button keyboard activation

- **WHEN** the `+` button has focus and the user presses Enter or Space
- **THEN** the dropdown menu opens

### Requirement: Add menu items

Each menu item SHALL have a label, an icon, and an `onClick` handler. Items are extensible — future phases will add further sources without changing the trigger button or surrounding layout.

#### Scenario: Attach file item

- **WHEN** the dropdown is open
- **THEN** a "Attach file" item is present, labelled from i18n key `conversationInput.attach.label`, with a paperclip icon (`IconPaperclip`)

#### Scenario: Attach file item triggers file picker

- **WHEN** the user clicks the "Attach file" item
- **THEN** the native file picker opens (delegated to the `attachment-pick` capability)
