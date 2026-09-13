## ADDED Requirements

### Requirement: ScheduledTasks lib component renders an optional banner slot

`libs/scheduled-tasks`'s `ScheduledTasks` component SHALL accept an optional
`banner?: ReactNode` prop. When provided, the component SHALL render it
between the search/sort toolbar row and the content region (the status
message and card grid/spinner/error/empty states) in the resulting layout.
When omitted, nothing renders in that position. The component SHALL treat
`banner` as opaque content — it MUST NOT interpret, style beyond layout
placement, or attach any auth/BFF/routing/feature-flag behavior to it, and
MUST NOT import any type describing what the banner represents.

#### Scenario: Banner renders between toolbar and content

- **WHEN** `ScheduledTasks` renders with `banner={<div>Example</div>}` and a
  non-empty `items` array
- **THEN** the rendered "Example" content appears after the search/sort
  toolbar and before the task card grid in document order

#### Scenario: No banner prop renders nothing extra

- **WHEN** `ScheduledTasks` renders without a `banner` prop
- **THEN** no additional element appears between the toolbar and the content
  region, and the rendered output is unchanged from before this requirement
  was added

#### Scenario: Banner renders across every content-region state

- **WHEN** `ScheduledTasks` renders with a `banner` prop while `isLoading` is
  `true`, while `error` is set, and while `items` is empty
- **THEN** the banner renders in each of these states — its visibility does
  not depend on the content region's loading/error/empty/populated state
