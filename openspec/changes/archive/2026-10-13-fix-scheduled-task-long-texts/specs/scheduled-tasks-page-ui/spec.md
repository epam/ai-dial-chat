# Delta: scheduled-tasks-page-ui

## MODIFIED Requirements

### Requirement: ScheduledTaskCard renders a single task with highlighted search matches

`libs/scheduled-tasks` SHALL export a `ScheduledTaskCard` component, rendered on the kit's `CardShell`, showing: a title (highlighting the current search match via the shared `Highlight` component from `@epam/ai-dial-ui-kit`, per `.claude/rules/search-results-highlight.md`), an optional "NEW" badge when `item.isNew` is set, an optional description/prompt-preview line (clamped to three lines from the desktop breakpoint up and to two lines below it, where the card also drops its fixed height and lets the title wrap to two lines; a preview value too long to break at a space — a long URL and the like — SHALL wrap inside the card via `overflow-wrap: anywhere` instead of stretching the card past its grid track, and ordinary words SHALL wrap whole), a schedule/status pill, and an optional location breadcrumb built from `locationSegments` through the kit's `FolderPath` (outermost segment first). The card has no overflow menu and no per-task action callbacks: its only callback is `onCardClick`; Edit and Delete are offered only in the detail page header (see `scheduled-task-detail-page`).

The schedule/status pill SHALL render the schedule pill showing `scheduleLabel` when `item.isActive` is `true` or `undefined`, and a "Paused" badge (with a pause icon) in that same position when `item.isActive` is explicitly `false`. The two are mutually exclusive — the card never renders both at once. This is a display-only distinction; the card issues no pause/resume request and takes no other action based on `isActive` (the mutating pause/resume switch is confined to the detail page — see `scheduled-task-detail-page`).

`ScheduledTaskCard` SHALL accept an optional `onCardClick?: (id: string) => void` prop. When supplied, the card's root SHALL be `role="button"` with `tabIndex={0}` that calls `onCardClick(id)` on click or on Enter/Space. When `onCardClick` is not supplied, the root is `role="group"` with no click or keyboard handlers. In both cases the root's accessible name is `item.displayName`.

#### Scenario: Title highlights the active search query

- **WHEN** `ScheduledTaskCard` renders with `displayName="Competitor Updates"` and `searchQuery="comp"`
- **THEN** the title is rendered through `Highlight` with the matching substring marked, not as plain unhighlighted text

#### Scenario: Schedule pill and location breadcrumb render from pre-formatted values

- **WHEN** `ScheduledTaskCard` renders with `scheduleLabel="Every Monday 12:00"`, `isActive` omitted, and `locationSegments=["Public", "Project folder"]`
- **THEN** the schedule pill renders the label verbatim and `FolderPath` renders each segment in order; the component performs no date formatting or trigger-shape parsing itself

#### Scenario: Paused badge replaces the schedule pill when isActive is false

- **WHEN** `ScheduledTaskCard` renders with `isActive: false`
- **THEN** a "Paused" badge renders in place of the schedule pill, and the schedule pill's own text (`scheduleLabel`) is not rendered anywhere on the card

#### Scenario: Schedule pill renders when isActive is true

- **WHEN** `ScheduledTaskCard` renders with `isActive: true`
- **THEN** the schedule pill renders as usual and no "Paused" badge is shown

#### Scenario: Card renders no overflow menu

- **WHEN** `ScheduledTaskCard` renders
- **THEN** no overflow-menu trigger and no Edit, Run now or Delete action is present on the card

#### Scenario: Clicking the card body invokes onCardClick

- **WHEN** `onCardClick` is supplied and the user clicks anywhere on the card
- **THEN** `onCardClick` is called exactly once with the card's `id`

#### Scenario: Keyboard activation invokes onCardClick

- **WHEN** `onCardClick` is supplied, the card has focus, and the user presses Enter or Space
- **THEN** `onCardClick` is called exactly once with the card's `id`

#### Scenario: Card without onCardClick has no added interactive semantics

- **WHEN** `ScheduledTaskCard` renders without `onCardClick`
- **THEN** the card root is `role="group"`, is not focusable, and clicking it invokes no callback

#### Scenario: Unbreakable description token wraps inside the card instead of stretching it

- **WHEN** `ScheduledTaskCard` renders with a `descriptionPreview` containing a single token longer than the card's width (a long URL)
- **THEN** the token wraps within the card's description area, the card does not stretch past its grid track, and the description still clamps at its line budget with an ellipsis
