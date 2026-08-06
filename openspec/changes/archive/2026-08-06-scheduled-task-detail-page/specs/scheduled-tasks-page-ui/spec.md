## MODIFIED Requirements

### Requirement: ScheduledTaskCard renders a single task with highlighted search matches

`libs/scheduled-tasks` SHALL export a `ScheduledTaskCard` component rendering: a title (highlighting the current search match via the shared `Highlight` component from `@epam/ai-dial-chat-shared`, per `.claude/rules/search-results-highlight.md`), an optional "N NEW"-style badge when `isNew`/a new-count is set, an optional description/prompt-preview line, a schedule pill showing `scheduleLabel`, and an optional location breadcrumb built from `locationSegments` (outermost segment first, chevron separator between segments). The card exposes an overflow-menu trigger only when at least one action callback is supplied; the menu renders only the actions for which a corresponding callback prop (`onEdit`, `onRunNow`, `onDelete`) was provided by the caller.

`ScheduledTaskCard` SHALL accept an optional `onCardClick?: (id: string) => void` prop. When supplied, the card's root SHALL be an activatable element (clickable and keyboard-operable) that calls `onCardClick(id)` when activated by click or Enter/Space. The overflow-menu trigger button, and every action inside the opened overflow menu, MUST call `event.stopPropagation()` so activating the trigger or any menu action never also invokes `onCardClick`. When `onCardClick` is not supplied, the card renders exactly as before (no added interactive root semantics).

#### Scenario: Title highlights the active search query

- **WHEN** `ScheduledTaskCard` renders with `displayName="Competitor Updates"` and `searchQuery="comp"`
- **THEN** the title is rendered through `Highlight` with the matching substring marked, not as plain unhighlighted text

#### Scenario: Schedule pill and location breadcrumb render from pre-formatted values

- **WHEN** `ScheduledTaskCard` renders with `scheduleLabel="Every Monday 12:00"` and `locationSegments=["Public", "Project folder"]`
- **THEN** the schedule pill renders the label verbatim and the breadcrumb renders each segment in order with a chevron separator between them; the component performs no date formatting or trigger-shape parsing itself

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

### Requirement: Card click navigates to the task detail route

`onCardClick` SHALL be threaded from `ScheduledTasksPage` through `ScheduledTasks` and `ScheduledTaskCardGrid` down to each rendered `ScheduledTaskCard`, without either intermediate component inspecting or transforming the id. `ScheduledTasksPage` SHALL supply an `onCardClick` implementation that calls `navigate(getScheduledTaskDetailRoute(id))` (from `apps/chat/src/constants/routes.ts`). `ScheduledTasks` and `ScheduledTaskCardGrid` remain host-agnostic: they accept and forward the callback as a prop and perform no navigation, routing import, or id transformation themselves.

#### Scenario: Clicking a card navigates to its detail route

- **WHEN** the user clicks a task card's body on `/scheduled-tasks`
- **THEN** the app navigates to `/scheduled-tasks/{id}` for that card's task id

#### Scenario: Overflow menu actions do not trigger navigation

- **WHEN** the user clicks the overflow-menu trigger on a card, or an action inside the opened menu (Edit/Run/Delete)
- **THEN** the app does not navigate away from `/scheduled-tasks`, and only the corresponding action callback (if any) is invoked

#### Scenario: Intermediate components forward the callback without transformation

- **WHEN** `ScheduledTasks`/`ScheduledTaskCardGrid` source is statically analyzed
- **THEN** `onCardClick` is passed through as received, with no routing import, `useNavigate` call, or id transformation present in either component
