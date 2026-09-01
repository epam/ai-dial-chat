## ADDED Requirements

### Requirement: ImportExportQueue is a controlled, labels-driven component owned by `libs/chat-shared`

`@epam/ai-dial-chat-shared` SHALL export an `ImportExportQueue` component and its
`ImportExportQueueProps`/`ImportExportQueueLabels`/`ImportExportQueueColors`/`ImportExportQueueTypography`/`ImportExportQueueStyles`
types from the package root. The component SHALL accept `title: string`, `jobs: ConversationTransferJob[]`,
`onClose: () => void`, `onCancel: (jobId: string) => void`, and a `labels` object carrying every
user-visible string it renders. It SHALL NOT accept an `onRetry` prop.

The queue lives in `chat-shared` — beside the `ConversationTransferJob` contract it renders — rather
than in `conversation-panel`, so a host can show transfer progress without taking on the panel's
`react-window` and `@epam/ai-dial-sidebar` dependencies. It SHALL NOT import `react-i18next`, a
translation-key constant, an application Context, a routing utility,
`@epam/ai-dial-chat-hooks`, or `@epam/ai-dial-conversation-panel`.

#### Scenario: Component renders nothing with an empty queue
- **WHEN** `jobs` is an empty array
- **THEN** the component renders `null`

#### Scenario: Architecture guard — no i18n, hook, or panel import
- **WHEN** `libs/chat-shared` is linted and type-checked
- **THEN** `ImportExportQueue`'s source file contains no `react-i18next` import and no import from
  `@epam/ai-dial-chat-hooks` or `@epam/ai-dial-conversation-panel`

#### Scenario: A host renders the queue without the conversation panel
- **WHEN** an application depends on `@epam/ai-dial-chat-shared` but not on
  `@epam/ai-dial-conversation-panel`
- **THEN** it can import and render `ImportExportQueue` and `CircularProgress`

#### Scenario: Retry is not part of the component contract
- **WHEN** a host passes an `onRetry` prop
- **THEN** it is a type error; the component exposes no retry control in any job state

### Requirement: A job row is identified by its file, not its conversation

Each job row SHALL identify the job by the **file** it transfers: a leading file-type icon derived
from the file name's extension (`.dial`/`.zip`, `.json`, or a generic fallback), followed by
`job.fileName` rendered through `EllipsisTooltip` so the full name is revealed on hover and exposed
as `aria-label` only when the name is actually clipped. The conversation title and the source-folder
breadcrumb SHALL NOT be rendered.

Each row SHALL end in a fixed-footprint trailing status slot whose content is determined by
`job.status`:

- `InProgress` — a determinate `CircularProgress` bound to `job.progress`, sharing its grid cell
  with an always-mounted, always-focusable cancel control (see the hover-reveal requirement).
- `Success` — a check icon.
- `Failed` — a filled alert icon whose accessible name and tooltip are
  `labels.jobErrorMessage(job.errorCode)`.
- `Canceled` — no icon; instead the row renders `labels.canceledLabel` as trailing secondary text
  and dims the file name to the secondary text color.

`Success`, `Failed`, and `Canceled` rows SHALL expose no interactive control.

#### Scenario: A row is identified by its file name
- **WHEN** a job's `fileName` is `2026-09-01_ai_dial_chat_with_attachments.dial`
- **THEN** the row shows that string as its only label, with no conversation title and no breadcrumb line

#### Scenario: A clipped file name reveals itself on hover
- **GIVEN** a file name wider than the row
- **WHEN** the user hovers it
- **THEN** a tooltip shows the full name, and the truncated element carries the full name as its `aria-label`

#### Scenario: The file-type icon follows the extension
- **WHEN** a row's `fileName` ends in `.dial` or `.zip`
- **THEN** its leading icon is the archive icon; a `.json` name gets the JSON icon and any other
  extension gets the generic file icon

#### Scenario: A failed row explains itself without a tooltip
- **GIVEN** a job with status `Failed` and `errorCode` `FileTooLarge`
- **WHEN** the row renders
- **THEN** the alert icon's accessible name is `labels.jobErrorMessage(FileTooLarge)`, so the reason
  reaches a mobile screen where a tooltip renders nothing

#### Scenario: A cancelled row stays visible and is marked as cancelled
- **GIVEN** a job with status `Canceled`
- **THEN** its row is still present, shows `labels.canceledLabel` in the trailing slot, renders the
  file name in the secondary text color, and exposes no control

#### Scenario: Finished rows have no controls
- **WHEN** a job's status is `Success`, `Failed`, or `Canceled`
- **THEN** its row exposes no button of any kind

### Requirement: The cancel control is hover-revealed but always keyboard-reachable

An `InProgress` row's cancel control SHALL be mounted and focusable at all times, and SHALL share a
single grid cell with the row's `CircularProgress` so that revealing one and hiding the other causes
no layout shift. Visibility SHALL be driven by CSS on the row's hover and focus-within states, never
by conditional mounting or a JavaScript `onMouseEnter` state flag. The control SHALL carry
`labels.cancelJobAriaLabel(fileName)` as its accessible name and SHALL call `onCancel(job.id)`.

#### Scenario: Hovering an in-progress row swaps the ring for the cancel control
- **GIVEN** a row whose job is `InProgress`
- **WHEN** the pointer enters the row
- **THEN** the cancel control becomes visible in place of the progress ring, and the row's height and
  the horizontal position of every other element are unchanged

#### Scenario: The cancel control is reachable without a pointer
- **GIVEN** a row whose job is `InProgress` and a keyboard-only user
- **WHEN** the user tabs to the row's cancel control and activates it
- **THEN** `onCancel` is called with that job's id

#### Scenario: Cancel is not offered on a settled row
- **WHEN** a job's status is `Success`, `Failed`, or `Canceled`
- **THEN** no cancel control is mounted for that row

### Requirement: Per-row progress replaces the aggregate bar

The component SHALL NOT render an aggregate progress indicator; progress is rendered per row. A
header collapse/expand toggle SHALL hide or show the job rows without unmounting the header, and
SHALL expose `aria-expanded` plus an `aria-controls` pointing at the rows container. A failed-count
badge SHALL render only when at least one job has status `Failed`. The header's `title` SHALL be
rendered verbatim as supplied by the host, which is responsible for composing any count into it.

#### Scenario: No aggregate bar is rendered
- **GIVEN** 4 jobs where 2 are not `InProgress`
- **WHEN** the component renders
- **THEN** no aggregate progress indicator is present; each `InProgress` row carries its own
  determinate indicator reflecting only that job's `progress.percent`

#### Scenario: Collapsing hides rows, not the header
- **WHEN** the collapse toggle is activated
- **THEN** job rows are hidden while the header remains visible

#### Scenario: Failed-count badge appears only with a failure present
- **GIVEN** no job has status `Failed`
- **THEN** no failed-count badge is rendered

#### Scenario: The host owns the header count
- **GIVEN** the host passes `title` as `"Exporting 3 files"`
- **THEN** the header renders exactly that string; the component performs no pluralization

### Requirement: Close confirmation for unfinished or failed work

Activating `onClose`'s trigger SHALL call `onClose` immediately, without confirmation, when every
job has status `Success` or `Canceled` — a cancelled job represents work the user already chose to
stop, so nothing further is lost. If at least one job is `InProgress` or `Failed`, the component
SHALL first show its own confirmation dialog (`role="dialog"`) with a description selected by
`labels.closeQueueConfirmDescriptionInProgress` / `...Failed` / `...Mixed`, and SHALL call `onClose`
only if the user confirms.

#### Scenario: All-succeeded close needs no confirmation
- **GIVEN** every job has status `Success`
- **WHEN** the close trigger is activated
- **THEN** `onClose` is called immediately with no confirmation dialog shown

#### Scenario: A cancelled job needs no confirmation either
- **GIVEN** every job has status `Success` or `Canceled`, with at least one `Canceled`
- **WHEN** the close trigger is activated
- **THEN** `onClose` is called immediately with no confirmation dialog shown

#### Scenario: In-progress or failed work requires confirmation
- **GIVEN** at least one job is `InProgress` or `Failed`
- **WHEN** the close trigger is activated
- **THEN** a confirmation dialog appears and `onClose` is not yet called

#### Scenario: Cancelling the confirmation leaves the queue open
- **GIVEN** the confirmation dialog is open
- **WHEN** the user cancels it
- **THEN** the dialog closes and `onClose` is not called

### Requirement: Success-only auto-close after 8 seconds

The component SHALL call `onClose` automatically 8 seconds after the last job settles, but only while
every job in `jobs` has status `Success`. If any job is or becomes `InProgress`, `Failed`, or
`Canceled` at any point during that window, the scheduled auto-close SHALL be cancelled; a
subsequent render where every job is again `Success` SHALL restart the 8-second window. A
`Canceled` job suppresses auto-close so the user is guaranteed to see the outcome of their own
cancellation.

#### Scenario: All-success queue auto-closes
- **GIVEN** every job has status `Success`
- **WHEN** 8 seconds pass with no user interaction
- **THEN** `onClose` is called automatically

#### Scenario: A failed or in-progress job suppresses auto-close
- **GIVEN** at least one job is `Failed` or `InProgress`
- **WHEN** 8 seconds pass
- **THEN** `onClose` is not called

#### Scenario: A cancelled job suppresses auto-close
- **GIVEN** at least one job is `Canceled`
- **WHEN** 8 seconds pass
- **THEN** `onClose` is not called and the cancelled row stays on screen

#### Scenario: A new job starting during the countdown cancels it
- **GIVEN** every job is `Success` and the 8-second countdown is running
- **WHEN** a new `InProgress` job is added to `jobs`
- **THEN** the countdown is cancelled

### Requirement: ImportExportQueue exposes portable style overrides

`ImportExportQueue` SHALL accept an optional `styles` prop that groups typed colors, typography
classes, root/body class hooks, and arbitrary CSS custom properties. Themeable colors SHALL use
component-scoped CSS variables prefixed `--ieq-` with app-theme and hex fallbacks, and the panel's
`progressTrack`/`progressIndicator` colors SHALL feed the ring's own `--cprog-*` variables so a host
theming the queue does not have to reach past it to the ring.

#### Scenario: Consumer overrides queue styling
- **WHEN** the host passes `styles.colors`, `styles.typography`, class hooks, or `styles.cssVars`
- **THEN** the overrides are applied without importing host theme code into the library

#### Scenario: Ring colors are reachable through the queue's own styles prop
- **WHEN** the host passes `styles.colors.progressIndicator`
- **THEN** the in-progress rows' rings use that color

### Requirement: `CircularProgress` is a determinate, accessible ring owned by `libs/chat-shared`

`@epam/ai-dial-chat-shared` SHALL export a `CircularProgress` component and its
`CircularProgressProps` type, rendering an SVG ring whose filled arc is `value` percent of its
circumference, swept clockwise from twelve o'clock. It SHALL carry `role="progressbar"` with
`aria-valuenow={value}`, `aria-valuemin={0}`, `aria-valuemax={100}`, a caller-supplied `aria-label`,
and `aria-valuetext` only when the caller supplies one. `value` SHALL be clamped to 0–100. Its
colors SHALL be themeable through the `--cprog-track` and `--cprog-indicator` custom properties with
app-theme and hex fallbacks.

The ring SHALL NOT be mirrored under `dir="rtl"`: it is a symmetric indicator, and a
counter-clockwise sweep would read as work being undone.

#### Scenario: The arc reflects the value
- **GIVEN** `value` is `25`
- **WHEN** the component renders
- **THEN** the foreground arc covers one quarter of the ring's circumference and `aria-valuenow` is `25`

#### Scenario: A value outside the range is clamped
- **GIVEN** `value` is `140` or `-20`
- **THEN** `aria-valuenow` is `100` or `0` respectively

#### Scenario: The ring is never anonymous
- **WHEN** the component renders
- **THEN** it has a non-empty accessible name supplied by its caller

#### Scenario: The ring does not flip in RTL
- **GIVEN** an ancestor with `dir="rtl"`
- **WHEN** the component renders
- **THEN** the sweep direction is identical to the `dir="ltr"` rendering

### Requirement: Component tests live in `libs/chat-shared`

`libs/chat-shared` SHALL own the component-level Vitest/@testing-library/react test suites for
`ImportExportQueue` and `CircularProgress`, plus a unit suite for the pure `getTransferFileIcon`
extension mapping, covering every scenario above. `apps/chat` SHALL keep only a thin wiring test that
renders the real component connected to `useConversationExport`/`useConversationImport` and a real
`useTranslation`-backed labels object, asserting at least one translated string renders correctly.

#### Scenario: The extension mapping is unit-tested, not asserted through the DOM
- **WHEN** the file-icon mapping is verified
- **THEN** it is asserted against `getTransferFileIcon`'s return value, not by querying a vendor
  icon class name in the rendered row

#### Scenario: App wiring test catches a broken label wire-up
- **WHEN** the app-level wiring test renders `ImportExportQueue` through the app's real label-building
  code
- **THEN** it asserts a specific translated string (not a translation key) is present in the DOM
