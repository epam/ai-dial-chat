# starter-buttons-overflow Specification

## Purpose

Capping the number of visible conversation-starter pills and moving the rest into an accessible overflow menu.

## Requirements

### Requirement: Visible pill count is capped at four
When a deployment provides more than 4 starter options, the `StarterButtons` component SHALL display at most 4 pill buttons and collapse the remaining options into an overflow menu button. This applies while the lib's `isCollapsible` prop is `true` (its default); with `isCollapsible={false}` the component SHALL render every starter, each on its own row (`flex flex-col`), and no overflow menu. The app (`apps/chat/src/components/StarterButtons/StarterButtons.tsx`) passes `isCollapsible={!useUiFeature(OverlayFeature.ShowAllStarters)}`.

#### Scenario: Exactly four starters — no overflow button
- **WHEN** the deployment provides exactly 4 starter options
- **THEN** all 4 pills are shown and no overflow button is rendered

#### Scenario: Five or more starters — overflow button appears
- **WHEN** the deployment provides 5 or more starter options
- **THEN** the first 4 pills are shown followed by an overflow button, and the remaining options are hidden

#### Scenario: Show-all-starters overlay feature disables collapsing
- **WHEN** `OverlayFeature.ShowAllStarters` is enabled and the deployment provides 5 or more starter options
- **THEN** every starter is shown in a single column and no overflow button is rendered

#### Scenario: Fewer than five starters — all shown
- **WHEN** the deployment provides 1–4 starter options
- **THEN** all pills are shown without an overflow button

### Requirement: Overflow menu lists hidden starters
When the overflow button is visible, activating it SHALL open a dropdown menu that lists every hidden starter option by its `title`. The overflow control is an outlined `NeutralIconButton` whose icon is `IconDotsVertical` on desktop and `IconDots` (horizontal) when `isMobile` is `true`.

#### Scenario: Opening the overflow menu
- **WHEN** the user clicks or activates the overflow button
- **THEN** a dropdown opens containing one item per hidden starter, labelled with the starter's `title`

#### Scenario: Overflow icon depends on the viewport
- **WHEN** the overflow button is rendered with `isMobile` `false`, or with `isMobile` `true`
- **THEN** it shows `IconDotsVertical` on desktop and `IconDots` on mobile

#### Scenario: Selecting an item from the overflow menu
- **WHEN** the user clicks a starter title inside the overflow dropdown
- **THEN** the `onSelect` callback is called with that `StarterOption` and the dropdown closes

#### Scenario: Dismissing the overflow menu without selection
- **WHEN** the user presses `Escape` or clicks outside the dropdown
- **THEN** the dropdown closes and no `onSelect` call is made

### Requirement: Responsive narrowing via container width
The number of visible pills SHALL be dynamically reduced when the container is too narrow to fit the current visible pills plus the overflow button on a single row.

#### Scenario: Container shrinks below pill threshold
- **WHEN** the `StarterButtons` container is resized to a width that cannot fit all visible pills and the overflow button on one row
- **THEN** one or more pills are moved to the overflow menu so that the remaining pills and the overflow button fit in a single row

#### Scenario: Container expands to fit more pills
- **WHEN** the container is resized to a width that can fit additional pills alongside the overflow button
- **THEN** pills are moved back from the overflow menu into the visible row (up to the `MAX_VISIBLE` cap of 4)

### Requirement: Overflow button is keyboard accessible
The overflow button and its dropdown SHALL be fully operable via keyboard.

#### Scenario: Keyboard navigation inside the dropdown
- **WHEN** the overflow dropdown is open
- **THEN** `ArrowDown` / `ArrowUp` move focus between items and `Enter` / `Space` activates the focused item

#### Scenario: Closing with Escape key
- **WHEN** the overflow dropdown is open and the user presses `Escape`
- **THEN** the dropdown closes and focus returns to the overflow button

### Requirement: RTL layout support
The starter buttons row and the overflow button SHALL adapt correctly when the page direction is `rtl`.

#### Scenario: Overflow button position in RTL
- **WHEN** the page `dir` attribute is `rtl`
- **THEN** the overflow button appears at the inline-end of the pill row (visually on the left in RTL) and the dropdown opens aligned to that side
