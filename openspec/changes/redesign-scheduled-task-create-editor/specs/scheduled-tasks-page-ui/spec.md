# scheduled-tasks-page-ui — mobile adaptive-design deltas

## ADDED Requirements

### Requirement: Scheduled Tasks list toolbar adapts to mobile

Below 768px (a phone-width cutoff inside the `mobile` band — tablets keep both controls), focusing the toolbar's search input SHALL hide the sort control and let the search field expand to the full toolbar width; blurring the search input SHALL restore the sort control. From 768px up, the toolbar SHALL be unchanged by search focus. When the sort control is hidden while its menu is open (e.g. focus arrives via keyboard rather than a tap, so no outside-click closes it), the menu SHALL be closed so no portaled popup lingers on screen without its trigger.

#### Scenario: Mobile search focus expands the field and hides the sort control

- **WHEN** the viewport is below 768px and the search input receives focus
- **THEN** the sort control is hidden and the search field occupies the full toolbar width

#### Scenario: Mobile search blur restores the sort control

- **WHEN** the search input loses focus
- **THEN** the sort control is visible again beside the search field

#### Scenario: Sort menu does not linger when its trigger is hidden

- **WHEN** the sort menu is open and the search input then receives focus below 768px
- **THEN** the sort menu closes together with its hidden trigger

#### Scenario: Toolbar at 768px and up is unchanged

- **WHEN** the viewport is 768px or wider (tablet band and desktop alike)
- **THEN** focusing the search input changes nothing — the sort control stays visible beside the field
