## ADDED Requirements

### Requirement: Detail and history layout have public per-instance settings

ScheduledTaskDetailView SHALL expose className, backIcon, typed column layout and forwarded historyStyles. The Details/Configuration divider SHALL stretch the full shared desktop content height. History SHALL expose maxHeight, rowMinHeight, hover/focus colors and retain its own vertical scroll. Responsive fallback SHALL preserve existing mobile tabs; no structural child selectors SHALL be needed by a host.

#### Scenario: Short metadata does not shorten the divider

- **WHEN** Details text is shorter than Configuration content in desktop columns
- **THEN** the divider spans the shared content height.

#### Scenario: Wider history is configurable without stealing configuration width

- **WHEN** the host configures the design.md column sizes including history up to 408px
- **THEN** history expands within available space, configuration retains its minimum, and the layout falls back rather than causing horizontal overflow.

#### Scenario: History interactions and empty label are configurable

- **WHEN** a history row is hovered or keyboard-focused, or there are no runs
- **THEN** the configured interaction background/focus treatment is visible; an empty panel renders the host label, including 'No tasks runs yet' when supplied.

### Requirement: Details show independent metadata and load states

The app SHALL use trigger-only descriptions and host-resolved model display names with stored-id fallback. It SHALL preserve explicit not-found/retry states already required by the detail specification. History initial and incremental errors SHALL be separate from task loading; later-page failure SHALL preserve runs.

#### Scenario: Model name is resolved for display

- **WHEN** a task model id resolves to a deployment with a display name
- **THEN** details show that name; unresolved ids remain visible as raw-id fallback.

#### Scenario: Task not-found never becomes a blank page

- **WHEN** getScheduledTask returns 404
- **THEN** the existing NotFound content renders.

#### Scenario: History retry does not erase task details or prior runs

- **WHEN** task details and first history page succeeded but the next runs request fails
- **THEN** details and runs remain visible and the retry targets only the failed history page.

### Requirement: Delete confirmation presentation is reusable and host-configurable

scheduled-tasks SHALL export ScheduledTaskDeleteConfirmation with controlled open/pending state, task name, host-provided title/body/consequences/action labels, callbacks, cancelAppearance (Ghost by default), and typed title/action styling. It SHALL render safe React content and contain no API, routing or i18n imports. The parent SHALL retain mutation, notification and navigation ownership.

#### Scenario: Host supplies the complete deletion design

- **WHEN** the host passes 'Delete task', the specified permanent-action body and four consequences, a 16px title style and ghost Cancel
- **THEN** the confirmation renders that content and styling without private selectors or hardcoded package English.

#### Scenario: Cancel and confirm have distinct effects

- **WHEN** the user cancels or confirms an idle dialog
- **THEN** Cancel requests close without mutation; Confirm invokes the supplied confirmation callback once per activation.

#### Scenario: Pending deletion prevents duplicate actions and dismissal

- **WHEN** isDeleting is true and the user activates actions, Escape or backdrop
- **THEN** no further confirm or dismissal callback is emitted and pending feedback is accessible.

#### Scenario: Task name remains data

- **WHEN** a task name contains markup-like characters
- **THEN** the name is rendered as text/React content and never executed as HTML.

