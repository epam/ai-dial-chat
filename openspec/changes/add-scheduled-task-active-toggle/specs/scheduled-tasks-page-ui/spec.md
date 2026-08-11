## MODIFIED Requirements

### Requirement: ScheduledTaskCard renders a single task with highlighted search matches

`libs/scheduled-tasks` SHALL export a `ScheduledTaskCard` component rendering: a title (highlighting the current search match via the shared `Highlight` component from `@epam/ai-dial-chat-shared`, per `.claude/rules/search-results-highlight.md`), an optional "N NEW"-style badge when `isNew`/a new-count is set, an optional description/prompt-preview line, a schedule/status pill, and an optional location breadcrumb built from `locationSegments` (outermost segment first, chevron separator between segments). The card exposes an overflow-menu trigger only when at least one action callback is supplied; the menu renders only the actions for which a corresponding callback prop (`onEdit`, `onRunNow`, `onDelete`) was provided by the caller.

The schedule/status pill SHALL render the schedule pill showing `scheduleLabel` when `item.isActive` is `true` or `undefined`, and a "Paused" badge (with a pause icon) in that same position when `item.isActive` is explicitly `false`. The two are mutually exclusive — the card never renders both at once. This is a display-only distinction; the card issues no pause/resume request and takes no other action based on `isActive` (the mutating pause/resume switch is confined to the detail page — see `scheduled-task-detail-page`).

#### Scenario: Title highlights the active search query

- **WHEN** `ScheduledTaskCard` renders with `displayName="Competitor Updates"` and `searchQuery="comp"`
- **THEN** the title is rendered through `Highlight` with the matching substring marked, not as plain unhighlighted text

#### Scenario: Schedule pill and location breadcrumb render from pre-formatted values

- **WHEN** `ScheduledTaskCard` renders with `scheduleLabel="Every Monday 12:00"`, `isActive` omitted, and `locationSegments=["Public", "Project folder"]`
- **THEN** the schedule pill renders the label verbatim and the breadcrumb renders each segment in order with a chevron separator between them; the component performs no date formatting or trigger-shape parsing itself

#### Scenario: Paused badge replaces the schedule pill when isActive is false

- **WHEN** `ScheduledTaskCard` renders with `isActive: false`
- **THEN** a "Paused" badge renders in place of the schedule pill, and the schedule pill's own text (`scheduleLabel`) is not rendered anywhere on the card

#### Scenario: Schedule pill renders when isActive is true

- **WHEN** `ScheduledTaskCard` renders with `isActive: true`
- **THEN** the schedule pill renders as usual and no "Paused" badge is shown

#### Scenario: Overflow menu only shows actions with a supplied handler

- **WHEN** `ScheduledTaskCard` renders with only `onDelete` supplied (no `onEdit`, no `onRunNow`)
- **THEN** the overflow menu, when opened, shows exactly one action item, and activating it calls `onDelete` with the card's `id`

#### Scenario: Clicking the card body invokes onCardClick

- **WHEN** `onCardClick` is supplied and the user clicks anywhere on the card body outside the overflow-menu trigger
- **THEN** `onCardClick` is called exactly once with the card's `id`

#### Scenario: Clicking the overflow-menu trigger or an action does not invoke onCardClick

- **WHEN** `onCardClick` and at least one action callback are both supplied, and the user clicks the overflow-menu trigger, or opens the menu and clicks an action item
- **THEN** `onCardClick` is not called, and only the trigger's open behavior (or the clicked action's own callback) fires

#### Scenario: Card without onCardClick has no added interactive semantics

- **WHEN** `ScheduledTaskCard` renders without `onCardClick`
- **THEN** the card root is not exposed as a button/clickable element and clicking it invokes no navigation-related callback

## ADDED Requirements

### Requirement: Card active state is populated from the BFF isActive field

`map-scheduled-task-dto.ts` SHALL map `ScheduledTaskDto.isActive` to `ScheduledTaskItem.isActive` in `mapScheduledTaskDtoToItem`, with no reinterpretation of the value — the frontend SHALL NOT re-derive active/paused state from `nextRunTime`, `triggerType`, or any other field itself; that derivation is owned entirely by the BFF mapper (see `scheduled-tasks-api`'s "Scheduled task active-state field"). When `ScheduledTaskDto.isActive` is `undefined`, `ScheduledTaskItem.isActive` SHALL be `undefined`, which `ScheduledTaskCard` renders identically to `true` (schedule pill shown, no "Paused" badge).

#### Scenario: isActive false maps through to the card

- **WHEN** a `ScheduledTaskDto` with `isActive: false` is mapped and rendered
- **THEN** the resulting `ScheduledTaskItem.isActive` is `false`, and the card shows the "Paused" badge

#### Scenario: isActive true maps through to the card

- **WHEN** a `ScheduledTaskDto` with `isActive: true` is mapped and rendered
- **THEN** the resulting `ScheduledTaskItem.isActive` is `true`, and the card shows the schedule pill

#### Scenario: Missing isActive does not throw and shows the schedule pill

- **WHEN** a `ScheduledTaskDto` omits `isActive`
- **THEN** the resulting `ScheduledTaskItem.isActive` is `undefined`, mapping does not throw, and the card shows the schedule pill (not the "Paused" badge)
