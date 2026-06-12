## ADDED Requirements

### Requirement: `DeploymentIcon` accepts an optional `tooltip` prop and displays it on hover

`DeploymentIcon` (in `libs/conversation-input`) SHALL accept an optional `tooltip?: string` prop. When `tooltip` is provided, the badge SHALL be wrapped in a `DialTooltip` that shows `tooltip` on hover and focus. When `tooltip` is absent or `undefined`, the component SHALL render exactly as before with no wrapper element.

#### Scenario: Tooltip shown when prop is provided

- **WHEN** `DeploymentIcon` renders with `tooltip="GPT-4o"`
- **THEN** hovering the icon badge shows a tooltip containing "GPT-4o"

#### Scenario: No tooltip wrapper when prop is absent

- **WHEN** `DeploymentIcon` renders without a `tooltip` prop
- **THEN** no tooltip is shown and the DOM structure is unchanged
