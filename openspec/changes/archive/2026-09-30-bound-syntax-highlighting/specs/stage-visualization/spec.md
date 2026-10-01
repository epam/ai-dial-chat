## MODIFIED Requirements

### Requirement: `StageItem` collapses/expands its content body

Each `StageItem` SHALL render a header row (icon + name). When `stage.content` is present, the item SHALL be a button that toggles a content body mounted only while expanded, with immediate unmount on collapse. When `stage.content` is absent, the item is a static row with no toggle.

#### Scenario: Stage without content renders a plain row
- **WHEN** `stage.content` is undefined or empty
- **THEN** no toggle button is rendered

#### Scenario: Stage with content renders a collapsible button
- **WHEN** `stage.content` is a non-empty string
- **THEN** a button element is rendered and clicking it expands/collapses the content body

#### Scenario: Closed details are not rendered

- **WHEN** the item starts closed or is collapsed after opening
- **THEN** its Markdown body is unmounted and its disclosure exposes `aria-expanded="false"`
